// Los oficios de quienes están en la sala (ver oficios.ts de @hyvento/shared). La experiencia de las
// acciones sale de cada suma de los contadores (`onStat`, con el tope diario por oficio) y la de los
// encargos llega ya guardada (`credit`); se suma en memoria —para avisar al instante la subida de nivel,
// con chispas para los del nivel— y se guarda junta cada unos segundos (`flush`). Aquí también se validan
// las ventajas del nivel 5: la barra de pesca, la cosecha doble, la porción de más, el detalle gratis del
// día y las pistas del diario. La sala le da la base, el reloj, el azar, la mochila y cómo avisar; este
// módulo no conoce Colyseus.
import {
  OFICIO,
  OFICIO_GIFT_DAY_STAT,
  OFICIO_MSG,
  OFICIO_PERKS,
  OFICIOS,
  OficioGiftMessage,
  bogotaDay,
  hasPerk,
  levelOf,
  neighborLevel,
  objItemId,
  oficioLevelStat,
  portionOf,
  statOficio,
  type Oficio,
  type OficioGiftResult,
  type OficioGiftedEvent,
  type OficioHints,
  type OficioLevelUpEvent,
  type OficioLevels,
  type OficioStateEvent,
  type OficioNotice,
  STAT_PREFIX,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { Bag } from "./bag";

export interface OficioWho {
  sessionId: string;
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface OficiosDeps {
  repo(): Pick<GameRepository, "loadSkills" | "addSkillXp">;
  now(): number;
  /** Entero en [0, n) (los tests lo fijan). */
  random(n: number): number;
  /** Las sesiones de alguien, y quién es una sesión. */
  sessionsOf(userId: string): OficioWho[];
  who(sessionId: string): OficioWho | null;
  send(userId: string, type: string, message: unknown): void;
  toArea(area: string, type: string, message: unknown): void;
  /** El "nivel de vecino" que se ve junto al nombre (Player.vecino). */
  setNeighbor(userId: string, level: number): void;
  /** Los contadores de los logros (el nivel de cada oficio es uno de máximo: así salen los legendarios). */
  stats: { max(userId: string, key: string, value: number): void; stat(userId: string, key: string): number | undefined; isLoaded(userId: string): boolean };
  held: Pick<Bag, "fits" | "add">;
  /** Las pistas del diario (exploración 5): el escondite del Man del Sombrero y los niveles que no conoce. */
  hints(userId: string): { hideout: string | null; unvisited: string[] };
  tileSize: number;
}

type PerOficio = Record<Oficio, number>;
const zero = (): PerOficio => Object.fromEntries(OFICIOS.map((o) => [o, 0])) as PerOficio;

interface Entry {
  xp: PerOficio;
  /** Lo que las acciones dieron hoy (el tope), y de qué día (de Bogotá). */
  today: PerOficio;
  day: number;
  /** Fracciones que todavía no suman un punto entero (caminar da de a poquito). */
  carry: PerOficio;
  /** Lo que falta guardar. */
  pending: PerOficio;
  loaded: boolean;
  loading?: Promise<void>;
  /** Cambia en cada entrada: un `forget` de una sesión anterior no borra lo nuevo. */
  gen: number;
}

export class Oficios {
  private users = new Map<string, Entry>();
  private giving = new Set<string>();

  constructor(private readonly deps: OficiosDeps) {}

  private entry(userId: string): Entry {
    let e = this.users.get(userId);
    if (!e) {
      e = { xp: zero(), today: zero(), day: bogotaDay(this.deps.now()), carry: zero(), pending: zero(), loaded: false, gen: 0 };
      this.users.set(userId, e);
    }
    return e;
  }

  /** Lee de la base (la primera vez calcula la experiencia de los veteranos). Lo sumado mientras tanto no se pierde. */
  load(userId: string, opts: { join?: boolean } = {}): Promise<void> {
    const e = this.entry(userId);
    if (opts.join) e.gen += 1;
    e.loading ??= this.fetch(userId, e).finally(() => (e.loading = undefined));
    return e.loading;
  }

  private async fetch(userId: string, e: Entry) {
    const now = this.deps.now();
    let saved: Awaited<ReturnType<GameRepository["loadSkills"]>>;
    try {
      saved = await this.deps.repo().loadSkills(userId, now);
    } catch (err) {
      console.error("loadSkills", err);
      return;
    }
    for (const o of OFICIOS) {
      e.xp[o] = saved.xp[o] + e.pending[o];
      e.today[o] = saved.today[o] + e.pending[o];
    }
    e.day = bogotaDay(now);
    e.loaded = true;
    // Los contadores de nivel (los logros legendarios y el título salen de ahí).
    for (const o of OFICIOS) this.deps.stats.max(userId, oficioLevelStat(o), levelOf(e.xp[o]));
    this.deps.setNeighbor(userId, neighborLevel(this.levels(userId)));
    this.sendState(userId);
  }

  /** Subió un contador: la experiencia de su oficio (con el tope diario de las acciones). */
  onStat(userId: string, key: string, by: number) {
    const hit = statOficio(key);
    if (!hit || !(by > 0)) return;
    const e = this.entry(userId);
    const day = bogotaDay(this.deps.now());
    if (day !== e.day) {
      e.day = day;
      e.today = zero();
    }
    const o = hit.oficio;
    const raw = hit.xp * by + e.carry[o];
    const whole = Math.floor(raw);
    e.carry[o] = raw - whole;
    const amount = Math.min(whole, OFICIO.dailyActionCap - e.today[o]);
    if (amount <= 0) return;
    e.today[o] += amount;
    e.pending[o] += amount;
    this.add(userId, e, o, amount);
  }

  /** La experiencia de un encargo entregado (ya está guardada: solo se suma aquí para el nivel). */
  credit(userId: string, oficio: string, xp: number) {
    if (!(OFICIOS as readonly string[]).includes(oficio) || !(xp > 0)) return;
    const e = this.users.get(userId);
    if (!e?.loaded) return;
    this.add(userId, e, oficio as Oficio, Math.round(xp));
  }

  private add(userId: string, e: Entry, o: Oficio, amount: number) {
    const before = levelOf(e.xp[o]);
    e.xp[o] += amount;
    if (!e.loaded) return; // sin saber lo de antes no se anuncia nada (la carga lo pone al día)
    const after = levelOf(e.xp[o]);
    if (after > before) this.levelUp(userId, o, after);
  }

  private levelUp(userId: string, oficio: Oficio, level: number) {
    this.deps.stats.max(userId, oficioLevelStat(oficio), level);
    this.deps.setNeighbor(userId, neighborLevel(this.levels(userId)));
    for (const s of this.deps.sessionsOf(userId)) {
      this.deps.toArea(s.area, OFICIO_MSG.levelUp, { sessionId: s.sessionId, name: s.name, oficio, level } satisfies OficioLevelUpEvent);
    }
    this.sendState(userId);
  }

  view(userId: string): OficioStateEvent {
    const e = this.entry(userId);
    const skills = Object.fromEntries(OFICIOS.map((o) => [o, { xp: e.xp[o], level: levelOf(e.xp[o]), today: e.today[o] }])) as OficioStateEvent["skills"];
    return { skills, neighbor: neighborLevel(this.levels(userId)) };
  }

  sendState(userId: string) {
    this.deps.send(userId, OFICIO_MSG.state, this.view(userId));
  }

  levels(userId: string): OficioLevels {
    const e = this.users.get(userId);
    return Object.fromEntries(OFICIOS.map((o) => [o, e ? levelOf(e.xp[o]) : 1])) as OficioLevels;
  }

  level(userId: string, oficio: string): number {
    return (this.levels(userId) as Record<string, number>)[oficio] ?? 1;
  }

  /** Guarda lo pendiente (si falla, queda para el próximo intento). */
  async flush(userId: string) {
    const e = this.users.get(userId);
    if (!e) return;
    const gains = { ...e.pending };
    if (!OFICIOS.some((o) => gains[o] > 0)) return;
    e.pending = zero();
    try {
      await this.deps.repo().addSkillXp(userId, gains, this.deps.now());
    } catch (err) {
      console.error("addSkillXp", err);
      for (const o of OFICIOS) e.pending[o] += gains[o];
    }
  }

  async flushAll() {
    await Promise.all([...this.users.keys()].map((id) => this.flush(id)));
  }

  /** La sesión de ahora (para que `forget` sepa si sigue siendo la misma). */
  generation(userId: string): number {
    return this.users.get(userId)?.gen ?? 0;
  }

  /** Se fue: se guarda y se olvida, salvo que haya vuelto a entrar mientras tanto (`gen`). */
  async forget(userId: string, gen?: number) {
    await this.flush(userId);
    const e = this.users.get(userId);
    if (!e || (gen !== undefined && e.gen !== gen) || e.loading) return;
    if (!OFICIOS.some((o) => e.pending[o] > 0)) this.users.delete(userId);
  }

  // ---------- Ventajas del nivel 5 ----------

  /** Pesca: la barra un poco más larga (se suma al equipo del lance). */
  fishingBonus(userId: string): { barBonus?: number } {
    return hasPerk("pesca", this.levels(userId)) ? { barBonus: OFICIO_PERKS.pesca.barBonus } : {};
  }

  /** Huerta: a veces la cosecha sale doble (si cabe). Devuelve si hubo. */
  async extraHarvest(userId: string, product: string): Promise<boolean> {
    if (!hasPerk("huerta", this.levels(userId))) return false;
    if (this.deps.random(1000) >= OFICIO_PERKS.huerta.extraHarvestPerMil) return false;
    const itemId = objItemId(product);
    if (this.deps.held.fits(userId, [[itemId, 1]]) !== "ok") return false;
    await this.deps.held.add(userId, itemId, 1);
    this.deps.send(userId, OFICIO_MSG.notice, { code: "harvest", item: product } satisfies OficioNotice);
    return true;
  }

  /** Cocina: cada plato de la parrilla o el horno trae una porción de más (si cabe). */
  async extraPortion(userId: string, dish: string): Promise<boolean> {
    if (!hasPerk("cocina", this.levels(userId))) return false;
    const itemId = objItemId(portionOf(dish));
    const n = OFICIO_PERKS.cocina.extraPortions;
    if (this.deps.held.fits(userId, [[itemId, n]]) !== "ok") return false;
    await this.deps.held.add(userId, itemId, n);
    this.deps.send(userId, OFICIO_MSG.notice, { code: "portion", item: dish } satisfies OficioNotice);
    return true;
  }

  /**
   * Social: el detalle gratis del día para alguien de al lado (del mismo nivel, cerca). Se regala algo que
   * no sale de la mochila de nadie; una vez por día de Bogotá (el día queda en un contador de máximo).
   */
  async gift(sessionId: string, raw: unknown): Promise<OficioGiftResult | null> {
    const parsed = OficioGiftMessage.safeParse(raw);
    const from = this.deps.who(sessionId);
    if (!parsed.success || !from) return null;
    const fail = (error: Extract<OficioGiftResult, { ok: false }>["error"]): OficioGiftResult => ({ ok: false, error });
    if (!hasPerk("social", this.levels(from.userId))) return fail("level");
    const to = this.deps.who(parsed.data.sessionId);
    if (!to) return fail("unknown");
    if (to.userId === from.userId) return fail("self");
    if (to.area !== from.area || Math.hypot(to.x - from.x, to.y - from.y) > OFICIO_PERKS.social.reachTiles * this.deps.tileSize) return fail("far");
    if (!this.deps.stats.isLoaded(from.userId) || this.giving.has(from.userId)) return fail("busy");
    const day = bogotaDay(this.deps.now());
    if ((this.deps.stats.stat(from.userId, OFICIO_GIFT_DAY_STAT) ?? -1) >= day) return fail("used");
    const itemId = objItemId(OFICIO_PERKS.social.giftItem);
    const fits = this.deps.held.fits(to.userId, [[itemId, 1]]);
    if (fits !== "ok") return fail(fits);
    this.giving.add(from.userId);
    try {
      this.deps.stats.max(from.userId, OFICIO_GIFT_DAY_STAT, day);
      await this.deps.held.add(to.userId, itemId, 1, { pick: true });
    } finally {
      this.giving.delete(from.userId);
    }
    this.deps.send(to.userId, OFICIO_MSG.gifted, { fromName: from.name, item: itemId } satisfies OficioGiftedEvent);
    return { ok: true, toName: to.name, item: itemId };
  }

  /** Exploración: las pistas del diario del observatorio (solo con el nivel). */
  hints(userId: string): OficioHints {
    if (!hasPerk("exploracion", this.levels(userId))) return { ok: false };
    return { ok: true, ...this.deps.hints(userId) };
  }

  /** Para los tests: la experiencia en memoria. */
  snapshot(userId: string) {
    const e = this.users.get(userId);
    return e ? { xp: { ...e.xp }, today: { ...e.today }, loaded: e.loaded } : null;
  }
}


/** Lo que la sala le presta a los oficios (así en OfficeRoom va una sola línea). */
export interface OficiosRoomParts {
  room: {
    state: { players: { get(id: string): OficioPlayer | undefined; entries(): IterableIterator<[string, OficioPlayer]> } };
    clients: Iterable<{ sessionId: string; send(type: string, message: unknown): void }>;
  };
  repo: OficiosDeps["repo"];
  held: OficiosDeps["held"];
  stats: OficiosDeps["stats"];
  now(): number;
  random(n: number): number;
  /** Dónde se esconde hoy el Man del Sombrero (para las pistas), y los niveles del mundo (id y nombre). */
  hideout(): string | null;
  areas(): { id: string; name: string }[];
  tileSize: number;
}

interface OficioPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  vecino: number;
}

/** Los oficios de una sala: quién está dónde, cómo avisar y el nivel de vecino de cada `Player`. */
export function oficiosDeSala(parts: OficiosRoomParts): Oficios {
  const { room } = parts;
  const who = (sessionId: string): OficioWho | null => {
    const p = room.state.players.get(sessionId);
    return p ? { sessionId, userId: p.userId, name: p.name, area: p.area, x: p.x, y: p.y } : null;
  };
  const sessionsOf = (userId: string) => [...room.state.players.entries()].filter(([, p]) => p.userId === userId).map(([id]) => who(id)!);
  return new Oficios({
    repo: parts.repo,
    now: parts.now,
    random: parts.random,
    sessionsOf,
    who,
    send: (userId, type, message) => {
      for (const c of room.clients) if (room.state.players.get(c.sessionId)?.userId === userId) c.send(type, message);
    },
    toArea: (area, type, message) => {
      for (const c of room.clients) if (room.state.players.get(c.sessionId)?.area === area) c.send(type, message);
    },
    setNeighbor: (userId, level) => {
      for (const [, p] of room.state.players.entries()) if (p.userId === userId) p.vecino = level;
    },
    stats: parts.stats,
    held: parts.held,
    hints: (userId) => ({
      hideout: parts.hideout(),
      unvisited: parts
        .areas()
        .filter((a) => !parts.stats.stat(userId, `${STAT_PREFIX.visit}${a.id}`))
        .map((a) => a.name),
    }),
    tileSize: parts.tileSize,
  });
}

/** Los mensajes de los oficios (el detalle gratis y las pistas del diario). */
export function bindOficios(room: { onMessage(type: string, cb: (client: { sessionId: string; send(type: string, message: unknown): void }, raw: unknown) => void): unknown }, oficios: Oficios, userOf: (sessionId: string) => string | null) {
  room.onMessage(OFICIO_MSG.gift, (client, raw) => {
    void oficios.gift(client.sessionId, raw).then((r) => r && client.send(OFICIO_MSG.giftResult, r satisfies OficioGiftResult));
  });
  room.onMessage(OFICIO_MSG.hints, (client) => {
    const userId = userOf(client.sessionId);
    if (userId) client.send(OFICIO_MSG.hintsResult, oficios.hints(userId) satisfies OficioHints);
  });
}
