// La granja en el servidor: las gallinas y la cabra (caminan solas dentro de su patio y su corral, corren
// al comedero cuando alguien les da de comer y duermen de noche del juego), dar de comer con la racha,
// los huevos del día del juego, la votación de los nombres y el molino. Las reglas están en
// @hyvento/shared/granja. Este módulo no conoce Colyseus: la sala le da el mapa, la mochila, los
// contadores (logros), los puntos y el reloj, y manda lo que devuelve.
import { findPath, GRANJA_LAYOUT, isBlockedTile, type OfficeMap, type TilePos } from "@hyvento/map";
import {
  bogotaDay,
  careStreak,
  CORN,
  EGG,
  eggDayOf,
  FARM_ANIMALS,
  farmAnimalDef,
  feedPointsFor,
  FLOUR,
  GALLINERO,
  GRANJA_STATS,
  MOLINO,
  objItemId,
  tallyVotes,
  VoteMessage,
  voteOption,
  voteValue,
  winningName,
  type CoopState,
  type Direction,
  type FarmAnimalDef,
  type GameClockState,
  type GranjaNotice,
} from "@hyvento/shared";
import { facingOf } from "./mascotas";

/** Lo que se sincroniza de cada animal (el `FarmAnimal` de state.ts). */
export interface FarmAnimalView {
  id: string;
  kind: string;
  coat: string;
  name: string;
  x: number;
  y: number;
  dir: string;
  pose: string;
}

export interface GranjaDeps {
  /** Donde viven en el estado (MapSchema<FarmAnimal>) y cómo se crea uno; y los huevos del nido. */
  animals: { get(id: string): FarmAnimalView | undefined; set(id: string, a: FarmAnimalView): unknown };
  create(): FarmAnimalView;
  setEggs(n: number): void;
  /** El jardín (con los cambios del editor). */
  map(): OfficeMap;
  rng(): number;
  /** La mochila (Bag). */
  bag: {
    count(userId: string, itemId: string): number;
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    take(userId: string, itemId: string, quantity: number): Promise<boolean>;
    add(userId: string, itemId: string, quantity: number, opts: { pick?: boolean }): Promise<"ok" | "full" | "stack">;
  };
  /** Los contadores de cada persona (AchievementTracker): la racha y los votos viven ahí (UserStat). */
  stats: {
    isLoaded(userId: string): boolean;
    stat(userId: string, key: string): number | undefined;
    max(userId: string, key: string, value: number): void;
    bump(userId: string, key: string, by?: number): void;
  };
  /** Premio de ocio (LEISURE, con su tope diario): devuelve lo sumado. */
  award(userId: string, amount: number): Promise<number>;
  /** Los votos guardados de todos (al abrir el panel la primera vez). */
  loadVotes(): Promise<{ userId: string; key: string; value: number }[]>;
  /** Reloj del juego (los huevos) y si es de noche en el juego (los animales duermen). */
  gameClock(): GameClockState;
  gameNight(): boolean;
  later(ms: number, fn: () => void): { clear(): void };
  /** Aviso que llega después (la harina que sale del molino). */
  notify(userId: string, notice: GranjaNotice): void;
}

export interface GranjaWho {
  userId: string;
  name: string;
}

type Mode = "idle" | "walk" | "eat" | "sleep";

interface Brain {
  def: FarmAnimalDef;
  mode: Mode;
  path: TilePos[];
  until: number;
  /** Adónde va: a pasear, a comer o a dormir (al llegar cambia de modo). */
  goal: "wander" | "eat" | "sleep";
}

type Rect = { x: number; y: number; w: number; h: number };
const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export class Granja {
  private brains = new Map<string, Brain>();
  /** Quiénes les dieron de comer hoy (día de Bogotá), en orden. */
  private feeders: { day: number; names: string[] } = { day: -1, names: [] };
  /** Los huevos del día del juego: cuántos quedan y quién se los llevó. */
  private eggs = { day: Number.NaN, left: 0, by: "" };
  /** Votos de todos: userId → animal → valor guardado (null = todavía no se leyeron). */
  private votes: Map<string, Map<string, number>> | null = null;
  private votesLoading?: Promise<void>;
  private lastVoteAt = new Map<string, number>();
  /** Moliendo: hasta cuándo, por persona. */
  private grinding = new Map<string, number>();

  constructor(private readonly deps: GranjaDeps) {}

  // ---------- Los animales ----------

  private roam(def: FarmAnimalDef): Rect {
    return def.zone === "gallinero" ? GRANJA_LAYOUT.henYard : GRANJA_LAYOUT.corral;
  }

  private canGo(def: FarmAnimalDef, map: OfficeMap, x: number, y: number) {
    return inRect(this.roam(def), x, y) && !isBlockedTile(map, x, y);
  }

  /** Aparecen en su patio (las gallinas junto al gallinero, la cabra delante del establo). */
  start(now: number) {
    const map = this.deps.map();
    const ts = map.tileSize;
    FARM_ANIMALS.forEach((def, i) => {
      const home = def.kind === "cabra" ? GRANJA_LAYOUT.shedDoor : { x: GRANJA_LAYOUT.coopDoor.x + (i % 3), y: GRANJA_LAYOUT.coopDoor.y + Math.floor(i / 3) };
      const t = this.freeNear(def, map, home) ?? home;
      const a = this.deps.create();
      Object.assign(a, { id: def.id, kind: def.kind, coat: def.coat, name: def.names[0], x: t.x * ts + ts / 2, y: t.y * ts + ts / 2, dir: "down", pose: "stand" });
      this.deps.animals.set(def.id, a);
      this.brains.set(def.id, { def, mode: "idle", path: [], until: now + this.between(500, 3000), goal: "wander" });
    });
    this.checkEggs(now);
  }

  private between(a: number, b: number) {
    return a + (b - a) * this.deps.rng();
  }

  private freeNear(def: FarmAnimalDef, map: OfficeMap, t: TilePos): TilePos | undefined {
    for (let r = 0; r <= 4; r++)
      for (let y = t.y - r; y <= t.y + r; y++)
        for (let x = t.x - r; x <= t.x + r; x++)
          if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) === r && this.canGo(def, map, x, y)) return { x, y };
    return undefined;
  }

  private tileOf(a: FarmAnimalView, ts: number): TilePos {
    return { x: Math.floor(a.x / ts), y: Math.floor(a.y / ts) };
  }

  private route(def: FarmAnimalDef, map: OfficeMap, from: TilePos, goal: TilePos): TilePos[] | null {
    if (from.x === goal.x && from.y === goal.y) return [];
    const path = findPath(map, from, goal);
    return path && path.every((t) => this.canGo(def, map, t.x, t.y)) ? path : null;
  }

  tick(now: number, dtMs: number) {
    this.checkEggs(now);
    const night = this.deps.gameNight();
    const map = this.deps.map();
    for (const brain of this.brains.values()) {
      const a = this.deps.animals.get(brain.def.id);
      if (!a) continue;
      // Llegó la noche: todas a dormir (dejan lo que hacían). De día se despiertan solas.
      if (night && brain.goal !== "sleep") this.goSleep(brain, a, map, now);
      else if (!night && brain.mode === "sleep") {
        brain.mode = "idle";
        brain.goal = "wander";
        a.pose = "stand";
        brain.until = now + this.between(...GALLINERO.idleMs);
      }
      if (brain.mode === "walk") this.walk(brain, a, map, now, dtMs);
      else if (brain.mode !== "sleep" && now >= brain.until) this.decide(brain, a, map, now);
    }
  }

  private walk(brain: Brain, a: FarmAnimalView, map: OfficeMap, now: number, dtMs: number) {
    const ts = map.tileSize;
    const speed = brain.def.kind === "cabra" ? GALLINERO.goatSpeed : GALLINERO.henSpeed;
    // Al comedero se corre (como en el juego de verdad: llegan todas volando).
    let budget = (speed * (brain.goal === "eat" ? 2.2 : 1) * dtMs) / 1000;
    while (budget > 0 && brain.path.length) {
      const next = brain.path[0]!;
      if (!this.canGo(brain.def, map, next.x, next.y)) {
        brain.path = [];
        break;
      }
      const tx = next.x * ts + ts / 2;
      const ty = next.y * ts + ts / 2;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) a.dir = facingOf(dx, dy) satisfies Direction;
      if (dist <= budget) {
        a.x = tx;
        a.y = ty;
        budget -= dist;
        brain.path.shift();
      } else {
        a.x += (dx / dist) * budget;
        a.y += (dy / dist) * budget;
        budget = 0;
      }
    }
    a.pose = "walk";
    if (brain.path.length) return;
    if (brain.goal === "sleep") {
      brain.mode = "sleep";
      a.pose = "sleep";
    } else if (brain.goal === "eat") {
      brain.mode = "eat";
      a.pose = "peck";
      brain.until = now + GALLINERO.eatMs;
      this.faceTarget(a, brain.def, ts);
    } else {
      brain.mode = "idle";
      a.pose = this.deps.rng() < 0.55 ? "peck" : "stand";
      brain.until = now + this.between(...GALLINERO.idleMs);
    }
  }

  /** Comiendo mira al comedero (o al pesebre, la cabra). */
  private faceTarget(a: FarmAnimalView, def: FarmAnimalDef, ts: number) {
    const t = def.kind === "cabra" ? GRANJA_LAYOUT.hayRack : GRANJA_LAYOUT.feeder;
    a.dir = facingOf((t.x + 0.5) * ts - a.x, (t.y + 0.5) * ts - a.y);
  }

  private decide(brain: Brain, a: FarmAnimalView, map: OfficeMap, now: number) {
    const from = this.tileOf(a, map.tileSize);
    brain.goal = "wander";
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = from.x + Math.round((this.deps.rng() * 2 - 1) * GALLINERO.wanderTiles);
      const y = from.y + Math.round((this.deps.rng() * 2 - 1) * GALLINERO.wanderTiles);
      if ((x === from.x && y === from.y) || !this.canGo(brain.def, map, x, y)) continue;
      const path = this.route(brain.def, map, from, { x, y });
      if (path?.length) {
        brain.path = path;
        brain.mode = "walk";
        return;
      }
    }
    brain.mode = "idle";
    a.pose = this.deps.rng() < 0.5 ? "peck" : "stand";
    brain.until = now + this.between(...GALLINERO.idleMs);
  }

  private goSleep(brain: Brain, a: FarmAnimalView, map: OfficeMap, now: number) {
    const i = FARM_ANIMALS.indexOf(brain.def);
    const bed = brain.def.kind === "cabra" ? GRANJA_LAYOUT.shedDoor : { x: GRANJA_LAYOUT.coopDoor.x + (i % 2) - 1, y: GRANJA_LAYOUT.coopDoor.y + Math.floor(i / 2) };
    const to = this.freeNear(brain.def, map, bed);
    brain.goal = "sleep";
    brain.path = (to && this.route(brain.def, map, this.tileOf(a, map.tileSize), to)) ?? [];
    brain.mode = brain.path.length ? "walk" : "sleep";
    if (brain.mode === "sleep") a.pose = "sleep";
    brain.until = now;
  }

  /** ¡A comer!: las gallinas corren alrededor del comedero y la cabra al pesebre (despiertas o no). */
  private gather(now: number) {
    const map = this.deps.map();
    const around = (t: { x: number; y: number }) => [
      { x: t.x - 1, y: t.y },
      { x: t.x + 1, y: t.y },
      { x: t.x, y: t.y - 1 },
      { x: t.x, y: t.y + 1 },
      { x: t.x - 1, y: t.y - 1 },
      { x: t.x + 1, y: t.y + 1 },
    ];
    let k = 0;
    for (const brain of this.brains.values()) {
      const a = this.deps.animals.get(brain.def.id);
      if (!a) continue;
      const spots = around(brain.def.kind === "cabra" ? GRANJA_LAYOUT.hayRack : GRANJA_LAYOUT.feeder).filter((t) => this.canGo(brain.def, map, t.x, t.y));
      const spot = spots[k++ % Math.max(1, spots.length)];
      const path = spot ? this.route(brain.def, map, this.tileOf(a, map.tileSize), spot) : null;
      brain.goal = "eat";
      brain.path = path ?? [];
      brain.mode = brain.path.length ? "walk" : "eat";
      if (brain.mode === "eat") {
        a.pose = "peck";
        brain.until = now + GALLINERO.eatMs;
        this.faceTarget(a, brain.def, map.tileSize);
      }
    }
  }

  /** Qué está haciendo (tests). */
  modeOf(id: string) {
    return this.brains.get(id)?.mode;
  }

  // ---------- Dar de comer y la racha ----------

  /** Dar de comer (una vez por día de Bogotá por persona): puntos con la racha y los animales corren a comer. */
  async feed(who: GranjaWho, now: number): Promise<GranjaNotice> {
    const { stats } = this.deps;
    // Sin saber qué día les dio de comer por última vez, no se sabe si hoy ya lo hizo.
    if (!stats.isLoaded(who.userId)) return { code: "wait" };
    const today = bogotaDay(now);
    const next = careStreak(stats.stat(who.userId, GRANJA_STATS.lastDay), stats.stat(who.userId, GRANJA_STATS.since), today);
    if (!next) return { code: "alreadyFed" };
    stats.max(who.userId, GRANJA_STATS.lastDay, today);
    stats.max(who.userId, GRANJA_STATS.since, next.since);
    stats.max(who.userId, GRANJA_STATS.best, next.streak);
    stats.bump(who.userId, GRANJA_STATS.feeds);
    if (this.feeders.day !== today) this.feeders = { day: today, names: [] };
    if (!this.feeders.names.includes(who.name)) this.feeders.names.push(who.name);
    this.gather(now);
    const points = await this.deps.award(who.userId, feedPointsFor(next.streak));
    return { code: "fed", points: points || undefined, streak: next.streak };
  }

  // ---------- Huevos ----------

  /** Amaneció en el juego: el nido vuelve a tener los huevos del día. */
  private checkEggs(now: number) {
    const day = eggDayOf(this.deps.gameClock(), now);
    if (day === this.eggs.day) return;
    this.eggs = { day, left: GALLINERO.eggsPerDay, by: "" };
    this.deps.setEggs(this.eggs.left);
  }

  /** Buscar huevos: el primero que llega en el día del juego se los lleva todos (a la mochila). */
  async collectEggs(who: GranjaWho, now: number): Promise<GranjaNotice> {
    this.checkEggs(now);
    if (this.eggs.left <= 0) return { code: "noEggs", name: this.eggs.by || undefined };
    const n = this.eggs.left;
    if (this.deps.bag.fits(who.userId, [[objItemId(EGG), n]]) !== "ok") return { code: "bagFull" };
    // Se sacan del nido antes de esperar a la mochila: dos que llegan juntos no se llevan los mismos.
    this.eggs = { ...this.eggs, left: 0, by: who.name };
    this.deps.setEggs(0);
    const added = await this.deps.bag.add(who.userId, objItemId(EGG), n, {});
    if (added !== "ok") {
      this.eggs = { ...this.eggs, left: n, by: "" };
      this.deps.setEggs(n);
      return { code: "bagFull" };
    }
    this.deps.stats.bump(who.userId, GRANJA_STATS.eggs, n);
    return { code: "eggs", count: n };
  }

  // ---------- Molino ----------

  /**
   * Moler: una mazorca de la mochila se vuelve harina (a la mochila) al rato; con lluvia, más rápido.
   * Devuelve el aviso de ahora y cuánto tarda (para la animación de todos).
   */
  async grind(who: GranjaWho, wet: boolean, now: number): Promise<{ notice: GranjaNotice; ms?: number }> {
    if ((this.grinding.get(who.userId) ?? 0) > now) return { notice: { code: "busy" } };
    const corn = objItemId(CORN);
    const have = this.deps.bag.count(who.userId, corn);
    if (have < 1) return { notice: { code: "noCorn" } };
    // La harina tiene que caber (si era la última mazorca, su casilla queda libre).
    const flour: [string, number][] = [[objItemId(FLOUR), MOLINO.flourPerCorn]];
    if (have > 1 && this.deps.bag.fits(who.userId, flour) !== "ok") return { notice: { code: "bagFull" } };
    const ms = wet ? MOLINO.grindWetMs : MOLINO.grindMs;
    this.grinding.set(who.userId, now + ms);
    if (!(await this.deps.bag.take(who.userId, corn, 1))) {
      this.grinding.delete(who.userId);
      return { notice: { code: "noCorn" } };
    }
    this.deps.later(ms, () => {
      this.grinding.delete(who.userId);
      void this.deps.bag.add(who.userId, objItemId(FLOUR), MOLINO.flourPerCorn, {}).then((r) => {
        if (r === "ok") {
          this.deps.stats.bump(who.userId, GRANJA_STATS.grinds);
          this.deps.notify(who.userId, { code: "flour", count: MOLINO.flourPerCorn });
        } else {
          // No cupo la harina: se devuelve la mazorca (no se pierde nada).
          void this.deps.bag.add(who.userId, corn, 1, {});
          this.deps.notify(who.userId, { code: "bagFull" });
        }
      });
    });
    return { notice: { code: "grinding" }, ms };
  }

  // ---------- Votos de los nombres ----------

  private async ensureVotes() {
    if (this.votes) return;
    this.votesLoading ??= this.deps
      .loadVotes()
      .then((rows) => {
        const votes = new Map<string, Map<string, number>>();
        for (const r of rows) {
          const animal = r.key.slice(GRANJA_STATS.votePrefix.length);
          if (!farmAnimalDef(animal)) continue;
          const mine = votes.get(r.userId) ?? new Map<string, number>();
          mine.set(animal, r.value);
          votes.set(r.userId, mine);
        }
        this.votes = votes;
        this.applyNames();
      })
      .catch((err) => {
        console.error("loadVotes", err);
        this.votesLoading = undefined;
      });
    await this.votesLoading;
  }

  private tally() {
    return tallyVotes([...(this.votes ?? new Map()).values()].map((m) => new Map([...m].map(([animal, v]) => [animal, voteOption(v)]))));
  }

  /** El nombre que va ganando queda en cada animal (lo ven todos). */
  private applyNames() {
    const tally = this.tally();
    for (const def of FARM_ANIMALS) {
      const a = this.deps.animals.get(def.id);
      if (a) a.name = winningName(def, tally[def.id]);
    }
  }

  /** Lee los votos guardados al arrancar (así los nombres ganadores se ven sin abrir el panel). */
  loadNames() {
    return this.ensureVotes();
  }

  async coopState(who: GranjaWho, now: number): Promise<CoopState> {
    await this.ensureVotes();
    this.checkEggs(now);
    const tally = this.tally();
    const mine = this.votes?.get(who.userId);
    const today = bogotaDay(now);
    const last = this.deps.stats.stat(who.userId, GRANJA_STATS.lastDay);
    const since = this.deps.stats.stat(who.userId, GRANJA_STATS.since);
    const alive = last !== undefined && last >= today - 1 && since !== undefined;
    return {
      animals: FARM_ANIMALS.map((def) => ({
        id: def.id,
        kind: def.kind,
        names: def.names,
        votes: tally[def.id] ?? def.names.map(() => 0),
        mine: mine?.has(def.id) ? voteOption(mine.get(def.id)!) : -1,
        name: winningName(def, tally[def.id]),
      })),
      fedToday: last !== undefined && last >= today,
      streak: alive ? last! - since! + 1 : 0,
      best: this.deps.stats.stat(who.userId, GRANJA_STATS.best) ?? 0,
      feeders: this.feeders.day === today ? [...this.feeders.names] : [],
      eggsLeft: this.eggs.left,
      eggsBy: this.eggs.by,
    };
  }

  /** Votar un nombre (se puede cambiar el voto: vale el último). */
  async vote(who: GranjaWho, raw: unknown, now: number): Promise<GranjaNotice | null> {
    const parsed = VoteMessage.safeParse(raw);
    if (!parsed.success) return null;
    const def = farmAnimalDef(parsed.data.animal);
    if (!def || parsed.data.option >= def.names.length) return null;
    if (now - (this.lastVoteAt.get(who.userId) ?? -Infinity) < GALLINERO.voteCooldownMs) return null;
    this.lastVoteAt.set(who.userId, now);
    await this.ensureVotes();
    if (!this.votes) return { code: "failed" };
    const key = `${GRANJA_STATS.votePrefix}${def.id}`;
    // Un número mayor que el anterior (el voto de antes queda atrás): `max` en UserStat alcanza.
    const value = Math.max(voteValue(parsed.data.option, now), ((this.deps.stats.stat(who.userId, key) ?? -8) & ~7) + 8 + parsed.data.option);
    this.deps.stats.max(who.userId, key, value);
    const mine = this.votes.get(who.userId) ?? new Map<string, number>();
    mine.set(def.id, value);
    this.votes.set(who.userId, mine);
    this.applyNames();
    return { code: "voted" };
  }

  forget(userId: string) {
    this.lastVoteAt.delete(userId);
  }
}
