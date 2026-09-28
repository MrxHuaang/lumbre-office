// Estadísticas y logros de quienes están en la sala. Los contadores se suman en memoria (el juego no
// espera a la base) y se guardan juntos cada unos segundos (`flushAll`) o al irse. Al llegar a un
// umbral del catálogo (@hyvento/shared: ACHIEVEMENTS) se desbloquea el logro y la sala avisa. Este
// módulo no conoce Colyseus.
import {
  achievementsOfStat,
  bogotaDay,
  MAX_STATS,
  newlyUnlocked,
  oddHour,
  STAT_KEYS,
  STAT_PREFIX,
  type Achievement,
  type StatChange,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";

interface Entry {
  /** Lo que se sabe de cada contador (lo de la base más lo pendiente). */
  stats: Map<string, number>;
  unlocked: Set<string>;
  /** Cambios que todavía no se guardaron. */
  pending: Map<string, StatChange>;
  loaded: boolean;
  loading?: Promise<void>;
  /** Fracción de tile caminada que todavía no suma uno entero. */
  walkCarry: number;
}

export interface AchievementDeps {
  repo(): Pick<GameRepository, "loadAchievements" | "saveStats" | "unlockAchievement">;
  /** Se desbloqueó un logro (la sala avisa al jugador y a los de su nivel). */
  onUnlock(userId: string, achievement: Achievement): void;
}

export class AchievementTracker {
  private users = new Map<string, Entry>();

  constructor(private readonly deps: AchievementDeps) {}

  private entry(userId: string): Entry {
    let e = this.users.get(userId);
    if (!e) {
      e = { stats: new Map(), unlocked: new Set(), pending: new Map(), loaded: false, walkCarry: 0 };
      this.users.set(userId, e);
    }
    return e;
  }

  /** Lee de la base lo que ya tenía (al entrar). Lo sumado mientras tanto no se pierde. */
  load(userId: string): Promise<void> {
    const e = this.entry(userId);
    if (e.loaded) return Promise.resolve();
    e.loading ??= this.fetch(userId, e).finally(() => (e.loading = undefined));
    return e.loading;
  }

  /** Vuelve a leer de la base (la web sumó algo: la racha del buzón, una misión). */
  async refresh(userId: string): Promise<void> {
    const e = this.users.get(userId);
    if (!e) return;
    await this.flush(userId);
    await this.fetch(userId, e);
  }

  private async fetch(userId: string, e: Entry) {
    let saved: { stats: Record<string, number>; unlocked: string[] };
    try {
      saved = await this.deps.repo().loadAchievements(userId);
    } catch (err) {
      console.error("loadAchievements", err);
      return; // se reintenta en el próximo guardado
    }
    // Lo de la base más lo que se sumó mientras se leía (los máximos se quedan con el mayor).
    const stats = new Map(Object.entries(saved.stats));
    for (const c of e.pending.values()) {
      const base = stats.get(c.key) ?? 0;
      stats.set(c.key, c.op === "inc" ? base + c.value : Math.max(base, c.value));
    }
    e.stats = stats;
    for (const id of saved.unlocked) e.unlocked.add(id);
    e.loaded = true;
    // Los niveles visitados se cuentan de nuevo (lo pendiente no sabía de los de antes).
    this.recountVisits(userId, e);
    this.check(userId, e, newlyUnlocked(Object.fromEntries(e.stats), e.unlocked));
  }

  /** Suma a un contador (las claves de máximo se tratan como `max`). */
  bump(userId: string, key: string, by = 1) {
    if (MAX_STATS.has(key)) return this.max(userId, key, by);
    if (!Number.isFinite(by) || by <= 0) return;
    const e = this.entry(userId);
    const n = Math.round(by);
    e.stats.set(key, (e.stats.get(key) ?? 0) + n);
    const p = e.pending.get(key);
    e.pending.set(key, { key, op: "inc", value: (p?.value ?? 0) + n });
    this.checkStat(userId, e, key);
  }

  /** Guarda el máximo entre lo que había y `value`. */
  max(userId: string, key: string, value: number) {
    if (!Number.isFinite(value)) return;
    const e = this.entry(userId);
    const v = Math.round(value);
    if ((e.stats.get(key) ?? -Infinity) >= v) return;
    e.stats.set(key, v);
    const p = e.pending.get(key);
    e.pending.set(key, { key, op: "max", value: Math.max(p?.value ?? v, v) });
    this.checkStat(userId, e, key);
  }

  /** Caminó `tiles` (con decimales): se suman los tiles enteros. */
  walk(userId: string, tiles: number) {
    if (!(tiles > 0)) return;
    const e = this.entry(userId);
    e.walkCarry += tiles;
    if (e.walkCarry < 1) return;
    const whole = Math.floor(e.walkCarry);
    e.walkCarry -= whole;
    this.bump(userId, STAT_KEYS.tilesWalked, whole);
  }

  /** Entró a un nivel. */
  visit(userId: string, area: string) {
    const e = this.entry(userId);
    const key = `${STAT_PREFIX.visit}${area}`;
    if (e.stats.has(key)) return;
    this.max(userId, key, 1);
    this.recountVisits(userId, e);
  }

  private recountVisits(userId: string, e: Entry) {
    let n = 0;
    for (const k of e.stats.keys()) if (k.startsWith(STAT_PREFIX.visit)) n++;
    if (n > 0) this.max(userId, STAT_KEYS.areasVisited, n);
  }

  /** Madrugador y búho: una vez por día de Bogotá, si estaba activo a esa hora. */
  activeAt(userId: string, now: number) {
    const kind = oddHour(now);
    if (!kind) return;
    const e = this.entry(userId);
    if (!e.loaded) return; // sin saber qué días ya contaron, mejor esperar
    const lastKey = `${STAT_PREFIX.lastDay}${kind}`;
    const day = bogotaDay(now);
    if ((e.stats.get(lastKey) ?? -1) >= day) return;
    this.max(userId, lastKey, day);
    this.bump(userId, kind === "early" ? STAT_KEYS.earlyDays : STAT_KEYS.owlDays);
  }

  private checkStat(userId: string, e: Entry, key: string) {
    if (!e.loaded) return; // sin saber qué tenía, no se desbloquea nada (evita avisos repetidos)
    const value = e.stats.get(key) ?? 0;
    this.check(
      userId,
      e,
      achievementsOfStat(key).filter((a) => !e.unlocked.has(a.id) && value >= a.min),
    );
  }

  private check(userId: string, e: Entry, list: Achievement[]) {
    let added = false;
    for (const a of list) {
      if (e.unlocked.has(a.id)) continue;
      e.unlocked.add(a.id);
      added = true;
      this.deps.onUnlock(userId, a);
      this.deps
        .repo()
        .unlockAchievement(userId, a.id)
        .catch((err) => console.error("unlockAchievement", err));
    }
    // Los logros de logros: cuántos tiene (puede destrabar otro, que vuelve a pasar por aquí).
    if (added || (e.unlocked.size > 0 && !e.stats.has(STAT_KEYS.achievementsUnlocked))) this.max(userId, STAT_KEYS.achievementsUnlocked, e.unlocked.size);
  }

  /** Guarda lo pendiente de alguien (si falla, queda para el próximo intento). */
  async flush(userId: string): Promise<void> {
    const e = this.users.get(userId);
    if (!e) return;
    if (!e.loaded && !e.loading) void this.load(userId); // la carga falló antes: se reintenta
    if (e.pending.size === 0) return;
    const changes = [...e.pending.values()];
    e.pending.clear();
    try {
      await this.deps.repo().saveStats(userId, changes);
    } catch (err) {
      console.error("saveStats", err);
      // Vuelven a la cola, juntándose con lo que llegó mientras tanto.
      for (const c of changes) {
        const p = e.pending.get(c.key);
        if (!p) e.pending.set(c.key, c);
        else e.pending.set(c.key, { ...p, value: p.op === "inc" ? p.value + c.value : Math.max(p.value, c.value) });
      }
    }
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.users.keys()].map((id) => this.flush(id)));
  }

  /** Se fue: se guarda lo pendiente y se olvida. */
  async forget(userId: string): Promise<void> {
    await this.flush(userId);
    const e = this.users.get(userId);
    if (e && e.pending.size === 0) this.users.delete(userId);
  }

  /** Para los tests: lo que se sabe de alguien. */
  snapshot(userId: string): { stats: Record<string, number>; unlocked: string[] } | null {
    const e = this.users.get(userId);
    return e ? { stats: Object.fromEntries(e.stats), unlocked: [...e.unlocked] } : null;
  }
}
