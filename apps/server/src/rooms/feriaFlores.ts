// La Feria de las flores en la sala (ver feria-flores.ts de @hyvento/shared): armar la silleta en la mesa
// del silletero con las flores de la mochila, exhibirla en el patio de la feria (una por persona), votar
// (un voto por persona por feria, marcado en `UserStat`), el puesto de las semillas, el desfile de
// silleteros a las 16:00 del juego y, al cierre, la premiación de la más votada. Las silletas exhibidas
// viven en `state.feria` (en memoria: se ven para todos). Este módulo no conoce Colyseus: la sala le da el
// estado, la mochila, los contadores, la base, el reloj y cómo mandar.
import { INTERACT_REACH_TILES, nearPointOfType, pointsOfType, standOfPoint, type OfficeMap } from "@hyvento/map";
import {
  FERIA,
  FERIA_CINE,
  FeriaBuyMessage,
  STAT_KEYS,
  SilletaBuildMessage,
  SilletaStandMessage,
  canBuildSilleta,
  feriaActiva,
  feriaGanadora,
  feriaPrizeRef,
  feriaRefId,
  feriaShopItem,
  feriaVoteKey,
  missingFlowers,
  objItemId,
  silletaCodeOf,
  silletaFlowers,
  silletaId,
  standKey,
  type BuildResult,
  type ExhibitResult,
  type FeriaBuyResult,
  type FeriaMine,
  type VoteResult,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Quien arma, exhibe o vota: dónde está (en px del nivel). */
export interface FeriaWho {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

/** Una silleta exhibida, como la guarda el estado (SilletaExhibitState). */
export interface FeriaExhibit {
  stand: string;
  ownerId: string;
  ownerName: string;
  code: string;
  votes: number;
  at: number;
}

/** Las silletas exhibidas: un MapSchema en la sala, un Map en los tests. */
export interface FeriaExhibits<T extends FeriaExhibit> {
  get(key: string): T | undefined;
  set(key: string, e: T): unknown;
  values(): IterableIterator<T>;
  clear(): void;
  readonly size: number;
}

export interface FeriaFloresDeps<T extends FeriaExhibit> {
  /** El festival de ahora (`state.festival`, su fase), la fecha y la hora del juego. */
  festival(): { id: string; fase: string; day: number; año: number; minute: number };
  mapOf(area: string): OfficeMap;
  /** Las silletas exhibidas y donde se publica la ganadora (`state.feria`, que existe recién en onCreate). */
  exhibits(): FeriaExhibits<T>;
  winner(): { winnerId: string; winnerName: string; winnerVotes: number };
  /** Una silleta nueva para el estado (SilletaExhibitState). */
  create(): T;
  held: Pick<Bag, "count" | "fits" | "add" | "take" | "hand">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints" | "awardPointsOnce">;
  /** ¿Está conectado? (los contadores de quien no está no se tocan: se le dan al volver). */
  online(userId: string): boolean;
  /** Una cinemática para todos o solo para los de un nivel. */
  cine(id: string, vars?: Record<string, string | number>, area?: string): void;
  /** El aviso del desfile a los que no están en ese nivel. */
  desfileAviso(exceptArea: string): void;
  /** Se pagó el premio: el saldo nuevo y el "+N". */
  paid(userId: string, awarded: number, balance: number): void;
  now(): number;
  /** Cuánto espera la premiación después del cierre (los tests la acortan). */
  premiacionDelayMs(): number;
}

export class FeriaFlores<T extends FeriaExhibit> {
  private lastAt = new Map<string, number>();
  /** Por cuál votó cada uno en esta feria (lo que dice `UserStat` es solo que votó). */
  private votedFor = new Map<string, string>();
  /** El día del juego de lo que hay exhibido (al cambiar, se vacía). */
  private day = -1;
  private lastMinute: number | null = null;
  private desfileDay = -1;
  /** Cuándo cerró la feria (para la premiación) y si ya se premió este día. */
  private closedAt: number | null = null;
  private awardedDay = -1;
  /** Ganadores que no estaban al premiar: el logro les llega al volver. */
  private pendingGold = new Set<string>();

  constructor(private readonly deps: FeriaFloresDeps<T>) {}

  active(): boolean {
    const f = this.deps.festival();
    return feriaActiva(f.id, f.fase);
  }

  /** Pausa entre dos acciones de la misma persona. */
  private busy(userId: string): boolean {
    const now = this.deps.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < FERIA.cooldownMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  private clear() {
    this.deps.exhibits().clear();
    this.votedFor.clear();
    this.deps.winner().winnerId = "";
    this.deps.winner().winnerName = "";
    this.deps.winner().winnerVotes = 0;
    this.closedAt = null;
  }

  /**
   * Cada tanto (con el reloj de la sala): vacía lo de otro día, larga el desfile a las 16:00 del juego (solo
   * al cruzar la hora: si la sala arranca después, no) y premia un rato después del cierre.
   */
  tick() {
    const f = this.deps.festival();
    if (f.id !== FERIA.id) {
      if (this.day !== -1) {
        this.clear();
        this.day = -1;
      }
      this.lastMinute = null;
      return;
    }
    // Otro día de feria (las de varios años): lo de antes se va. El primer tick solo anota el día.
    if (this.day !== f.day) {
      if (this.day !== -1) this.clear();
      this.day = f.day;
    }
    const at = FERIA.desfileHora * 60;
    if (f.fase === "fiesta" && this.lastMinute !== null && this.lastMinute < at && f.minute >= at && this.desfileDay !== f.day) {
      this.desfileDay = f.day;
      this.deps.cine(FERIA_CINE.desfile, {}, "jardin");
      this.deps.desfileAviso("jardin");
    }
    this.lastMinute = f.minute;
    // Cerrada (las 22:00 del juego): se premia una vez, un rato después (si no hay votos, no pasa nada).
    if (f.fase === "fin" && this.closedAt === null && this.awardedDay !== f.day) this.closedAt = this.deps.now();
    if (this.closedAt !== null && this.awardedDay !== f.day && this.deps.now() - this.closedAt >= this.deps.premiacionDelayMs()) {
      this.awardedDay = f.day;
      void this.award(f.año);
    }
  }

  /**
   * El panel del director: el desfile de silleteros ya (solo la cinemática; no paga nada). Cuenta como el del
   * día: a las 16:00 ya no sale otra vez.
   */
  desfileYa(): "ok" | "off" {
    if (!this.active()) return "off";
    this.desfileDay = this.deps.festival().day;
    this.deps.cine(FERIA_CINE.desfile, {}, "jardin");
    this.deps.desfileAviso("jardin");
    return "ok";
  }

  /**
   * El panel del director: premiar ya, sin esperar el cierre. Es la premiación del día (después ya no se
   * exhibe ni se vota, y al cierre no se repite) y el premio es el mismo, una vez por feria.
   */
  premiarYa(): "ok" | "off" | "hecha" | "nadie" {
    if (!this.active()) return "off";
    const f = this.deps.festival();
    if (this.awardedDay === f.day) return "hecha";
    if (!feriaGanadora([...this.deps.exhibits().values()])) return "nadie";
    this.awardedDay = f.day;
    void this.award(f.año);
    return "ok";
  }

  /** ¿Ya se premió la feria de hoy? (adelantada por el director: ya no se exhibe ni se vota). */
  private premiada(): boolean {
    return this.awardedDay === this.deps.festival().day;
  }

  /** La premiación: la más votada gana el logro, el premio (una vez por feria) y su cinemática para todos. */
  async award(año: number) {
    const best = feriaGanadora([...this.deps.exhibits().values()]);
    if (!best) return null;
    const w = this.deps.winner();
    w.winnerId = best.ownerId;
    w.winnerName = best.ownerName;
    w.winnerVotes = best.votes;
    this.deps.cine(FERIA_CINE.premiacion, { ganador: best.ownerName, votos: best.votes, silleta: best.code });
    if (this.deps.online(best.ownerId)) this.deps.stats.bump(best.ownerId, STAT_KEYS.silleteroOro);
    else this.pendingGold.add(best.ownerId);
    const ref = feriaPrizeRef(año);
    try {
      const r = await this.deps.repo().awardPointsOnce({ userId: best.ownerId, amount: FERIA.premio, reason: "LEISURE", refId: ref, refPrefix: ref, maxPerDay: 1 });
      if (r.status === "ok") this.deps.paid(best.ownerId, r.awarded, r.balance);
    } catch (err) {
      console.error("feria awardPointsOnce", err);
    }
    return best;
  }

  /** Entró: si ganó estando afuera, el logro. */
  joined(userId: string) {
    if (this.pendingGold.delete(userId)) this.deps.stats.bump(userId, STAT_KEYS.silleteroOro);
  }

  /** Si ya votó en esta feria (y por cuál, si se sabe). */
  mine(userId: string): FeriaMine {
    const voted = this.votedFor.has(userId) || (this.deps.stats.stat(userId, feriaVoteKey(this.deps.festival().año)) ?? 0) >= 1;
    return { voted, stand: this.votedFor.get(userId) ?? null };
  }

  /** ¿Está junto al exhibidor `stand` (su punto, delante)? */
  private nearStand(who: FeriaWho, stand: string): boolean {
    const map = this.deps.mapOf(who.area);
    const reach = INTERACT_REACH_TILES * map.tileSize;
    return pointsOfType(map, "silleta_stand").some((p) => {
      const s = standOfPoint(p);
      return standKey(s.x, s.y) === stand && Math.hypot(p.x - who.x, p.y - who.y) <= reach;
    });
  }

  /** Armar una silleta en la mesa del silletero: gasta las flores y la silleta va a la mano. Null si el mensaje no sirve. */
  async build(who: FeriaWho, raw: unknown): Promise<BuildResult | null> {
    const parsed = SilletaBuildMessage.safeParse(raw);
    if (!parsed.success) return null;
    const code = parsed.data.code;
    if (!this.active()) return { ok: false, error: "off" };
    if (!nearPointOfType(this.deps.mapOf(who.area), "silletero_table", who.x, who.y)) return { ok: false, error: "far" };
    if (!canBuildSilleta(code)) return { ok: false, error: "code" };
    const held = this.deps.held;
    const missing = missingFlowers(code, (f) => held.count(who.userId, objItemId(f)));
    if (Object.keys(missing).length) return { ok: false, error: "flowers", missing };
    const itemId = objItemId(silletaId(code));
    if (held.fits(who.userId, [[itemId, 1]]) !== "ok") return { ok: false, error: "full" };
    if (this.busy(who.userId)) return { ok: false, error: "busy" };
    for (const [flower, n] of Object.entries(silletaFlowers(code))) if (!(await held.take(who.userId, objItemId(flower), n))) return { ok: false, error: "flowers" };
    await held.add(who.userId, itemId, 1, { pick: true });
    this.deps.stats.bump(who.userId, STAT_KEYS.silletasBuilt);
    return { ok: true, code };
  }

  /** Exhibir la silleta de la mano en un exhibidor libre (una por persona por feria). */
  exhibit(who: FeriaWho, raw: unknown): ExhibitResult | null {
    const parsed = SilletaStandMessage.safeParse(raw);
    if (!parsed.success) return null;
    const stand = parsed.data.stand;
    if (!this.active()) return { ok: false, error: "off" };
    if (this.premiada()) return { ok: false, error: "premiada" };
    if (!this.nearStand(who, stand)) return { ok: false, error: "far" };
    if (this.deps.exhibits().get(stand)) return { ok: false, error: "taken" };
    const code = silletaCodeOf(this.deps.held.hand(who.userId)?.id ?? "");
    if (!code) return { ok: false, error: "none" };
    if ([...this.deps.exhibits().values()].some((e) => e.ownerId === who.userId)) return { ok: false, error: "already" };
    if (this.busy(who.userId)) return { ok: false, error: "busy" };
    const e = this.deps.create();
    Object.assign(e, { stand, ownerId: who.userId, ownerName: who.name, code, votes: 0, at: this.deps.now() });
    this.deps.exhibits().set(stand, e);
    return { ok: true, stand };
  }

  /** Votar por la silleta de un exhibidor (junto a él): un voto por persona por feria, nunca por la propia. */
  vote(who: FeriaWho, raw: unknown): VoteResult | null {
    const parsed = SilletaStandMessage.safeParse(raw);
    if (!parsed.success) return null;
    const stand = parsed.data.stand;
    if (!this.active()) return { ok: false, error: "off" };
    if (this.premiada()) return { ok: false, error: "premiada" };
    if (!this.nearStand(who, stand)) return { ok: false, error: "far" };
    const e = this.deps.exhibits().get(stand);
    if (!e) return { ok: false, error: "empty" };
    if (e.ownerId === who.userId) return { ok: false, error: "own" };
    // Sin los contadores leídos no se sabe si ya votó (de otra conexión o antes de un reinicio).
    if (!this.deps.stats.isLoaded(who.userId)) return { ok: false, error: "busy" };
    if (this.mine(who.userId).voted) return { ok: false, error: "voted" };
    if (this.busy(who.userId)) return { ok: false, error: "busy" };
    this.deps.stats.max(who.userId, feriaVoteKey(this.deps.festival().año), 1);
    this.votedFor.set(who.userId, stand);
    e.votes += 1;
    return { ok: true, stand };
  }

  /** Comprar semillas en el puesto. `near`: si está junto al puesto (lo mide la sala). Null si el mensaje no sirve. */
  async buy(userId: string, raw: unknown, near: boolean): Promise<FeriaBuyResult | null> {
    const parsed = FeriaBuyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const item = feriaShopItem(parsed.data.item)!;
    const fail = (error: Extract<FeriaBuyResult, { ok: false }>["error"]): FeriaBuyResult => ({ ok: false, item: item.id, error });
    if (!this.active()) return fail("off");
    if (!near) return fail("far");
    const itemId = objItemId(item.id);
    const fits = this.deps.held.fits(userId, [[itemId, 1]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(userId)) return fail("busy");
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.deps.repo().spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId: feriaRefId(item.id) });
    } catch (err) {
      console.error("feria spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("funds");
    await this.deps.held.add(userId, itemId, 1);
    return { ok: true, item: item.id, balance: paid.balance };
  }

  /** Se fue de la sala. */
  forget(userId: string) {
    this.lastAt.delete(userId);
  }
}
