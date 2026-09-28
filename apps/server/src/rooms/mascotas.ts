// Casa viva: las mascotas. El servidor las mueve a paso lento por su nivel: eligen destinos al azar dentro
// de su zona, van con el A* del mundo (que no cruza paredes ni muebles, ni pisa portales), a veces se van a
// dormir a su cama, y vienen cuando alguien las llama. Una adoptada sigue a su dueño mientras está
// conectado (a poca distancia, con el mismo A*, y aparece a su lado al cambiar de nivel); cuando se va,
// vuelve a su casa. El cariño sube al acariciarla o alimentarla (con tope diario por persona) y baja con
// el tiempo. El azar es inyectable (los tests lo fijan). El editor de la casa puede mover la cama o poner un
// mueble encima de una mascota: la cama se busca en el nivel y la que quedó tapada se corre al tile libre
// más cercano.
import { findPath, isBlockedTile, portalAtTile, zoneAt, type OfficeMap, type TilePos } from "@hyvento/map";
import {
  dayStart,
  decayedLove,
  PET,
  PET_BOND,
  PETS,
  PetActionMessage,
  PetCallMessage,
  type Direction,
  type PetBondRecord,
  type PetDef,
  type PetEvent,
  type PetPose,
} from "@hyvento/shared";

/** Lo que se sincroniza de cada mascota (el `Pet` de state.ts). */
export interface PetView {
  id: string;
  name: string;
  kind: string;
  coat: string;
  area: string;
  x: number;
  y: number;
  dir: string;
  pose: string;
  /** User.id del dueño ("" = de la casa) y su nombre. */
  ownerId: string;
  ownerName: string;
  /** Cariño redondeado (0 a PET_BOND.max). */
  love: number;
}

/** Quien interactúa: su usuario, nivel y posición de los pies (y su nombre, para adoptar). */
export interface PetUser {
  userId: string;
  area: string;
  x: number;
  y: number;
  name?: string;
}

export interface PetsOptions {
  /** Donde viven en el estado (MapSchema<Pet>) y cómo se crea una. */
  pets: { get(id: string): PetView | undefined; set(id: string, p: PetView): unknown };
  create: () => PetView;
  /** El nivel (con la decoración actual) de un área. */
  map: (area: string) => OfficeMap;
  rng: () => number;
  /** Qué mascotas hay (los tests usan otras). */
  defs?: readonly PetDef[];
  /** Dónde está el dueño si está conectado (si no, undefined: la mascota se queda en su casa). */
  owner?: (userId: string) => (PetUser & { name: string }) | undefined;
  /** La comida que alguien tiene en la mano (la mano y su dibujo) y cómo se la da. */
  food?: { peek(userId: string): { part: number; art: string } | null; take(userId: string, part: number): void };
  /** Guardar dueño y cariño (se llama al adoptar o soltar, y con `flush`). */
  save?: (bond: PetBondRecord) => void;
}

/**
 * Por qué no: mal pedido, lejos (u otro nivel), muy seguido, ya comió (la pausa de los premios), sin
 * comida en la mano, ya tiene mascota, esta ya tiene dueño o no es suya.
 */
export type PetError = "invalid" | "far" | "busy" | "fed" | "noFood" | "hasPet" | "taken" | "notOwner";
export type PetResult =
  | { ok: true; action: PetEvent["action"]; /** Puntos que le tocan por cuidarla (0 si ya llegó al tope). */ reward: number; love: number; food?: string }
  | { ok: false; error: PetError };

/** Camas donde duermen (la "pet-bed"; la casita del perro es sólida, se duerme delante). */
const BED_TYPES = new Set(["pet-bed"]);

type Mode = "idle" | "walk" | "sleep" | "eat";
type Goal = "wander" | "bed" | "come";

interface Brain {
  def: PetDef;
  mode: Mode;
  goal: Goal;
  path: TilePos[];
  until: number;
  /** A quién mira al llegar (quien la llamó o la acarició). */
  lookAt?: { x: number; y: number };
  /** Dueño (User.id), si la adoptaron. */
  ownerId?: string;
  /** Está siguiendo a su dueño (conectado): va por todo el nivel, no solo por su zona. */
  following: boolean;
  /** Cariño con decimales y hasta cuándo se contó la baja. */
  love: number;
  loveAt: number;
  /** Cambió el dueño o el cariño y falta guardarlo. */
  dirty: boolean;
  /** Cuándo calculó la última ruta hacia el dueño. */
  pathAt: number;
  /** Dónde se quedó quieto el dueño y desde cuándo (para echarse a dormir a su lado). */
  still?: { x: number; y: number; since: number };
}

/** Hacia dónde mira según el movimiento en el mundo (igual que los personajes: +x = sureste en pantalla). */
export function facingOf(dx: number, dy: number): Direction {
  const sx = dx - dy;
  const sy = dx + dy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

const inRect = (r: PetDef["roam"], x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export class Pets {
  private brains = new Map<string, Brain>();
  private lastPetAt = new Map<string, number>();
  private lastTreatAt = new Map<string, number>();
  private lastCallAt = new Map<string, number>();
  /** Cariño dado hoy por persona y mascota, y veces que ya le dieron puntos hoy a cada persona. */
  private gainedToday = new Map<string, { day: number; n: number }>();
  private rewardsToday = new Map<string, { day: number; n: number }>();

  constructor(private readonly o: PetsOptions) {}

  private get defs() {
    return this.o.defs ?? PETS;
  }

  /** Aparecen durmiendo en su cama. */
  start(now: number) {
    for (const def of this.defs) {
      const map = this.o.map(def.area);
      const ts = map.tileSize;
      const bed = this.bedTile(def, map);
      const p = this.o.create();
      Object.assign(p, {
        id: def.id,
        name: def.name,
        kind: def.kind,
        coat: def.coat,
        area: def.area,
        x: bed.x * ts + ts / 2,
        y: bed.y * ts + ts / 2,
        dir: "down",
        pose: "sleep",
        ownerId: "",
        ownerName: "",
        love: 0,
      });
      this.o.pets.set(def.id, p);
      this.brains.set(def.id, { def, mode: "sleep", goal: "bed", path: [], until: now + this.between(4_000, 12_000), following: false, love: 0, loveAt: now, dirty: false, pathAt: 0 });
    }
  }

  /**
   * Lo guardado en la base (dueños y cariño). Lo que cambió mientras se leía gana, y nadie queda con dos
   * mascotas.
   */
  loadBonds(records: readonly PetBondRecord[], now: number) {
    for (const r of records) {
      const brain = this.brains.get(r.petId);
      const pet = this.o.pets.get(r.petId);
      if (!brain || !pet || brain.dirty) continue;
      const owner = r.ownerId && !this.petOf(r.ownerId) ? r.ownerId : undefined;
      brain.ownerId = owner;
      pet.ownerId = owner ?? "";
      pet.ownerName = owner ? r.ownerName : "";
      brain.love = Math.min(PET_BOND.max, decayedLove(r.love, now - r.loveAt));
      brain.loveAt = now;
      pet.love = Math.round(brain.love);
    }
  }

  /** La mascota adoptada por alguien (id), si tiene. */
  petOf(userId: string): string | undefined {
    for (const b of this.brains.values()) if (b.ownerId === userId) return b.def.id;
    return undefined;
  }

  /** Guarda lo que cambió (el cariño de a poco; dueños al momento, en `act`). */
  flush(now: number) {
    for (const brain of this.brains.values()) if (brain.dirty) this.persist(brain, now);
  }

  private persist(brain: Brain, now: number) {
    const pet = this.o.pets.get(brain.def.id);
    if (!pet) return;
    this.decay(brain, pet, now);
    brain.dirty = false;
    this.o.save?.({ petId: brain.def.id, ownerId: brain.ownerId ?? null, ownerName: pet.ownerName, love: Math.round(brain.love), loveAt: brain.loveAt });
  }

  /**
   * Dónde está su cama ahora: la "pet-bed" del nivel más cercana a la de la definición (el editor de la
   * casa la pudo mover) o, si no hay, el tile libre más cercano a donde estaba.
   */
  private bedTile(def: PetDef, map: OfficeMap): TilePos {
    let best: TilePos | undefined;
    let bestD: number = PET.bedSearchTiles;
    for (const f of map.furniture) {
      if (!BED_TYPES.has(f.type) || !this.canGo(def, map, f.x, f.y)) continue;
      const d = Math.hypot(f.x - def.bed.x, f.y - def.bed.y);
      if (d <= bestD) {
        bestD = d;
        best = { x: f.x, y: f.y };
      }
    }
    return best ?? this.freeNear(map, def.bed, (x, y) => this.canGo(def, map, x, y)) ?? def.bed;
  }

  /** El tile que cumple `ok` más cercano a `t`, buscando en anillos (`t` incluido). */
  private freeNear(map: OfficeMap, t: TilePos, ok: (x: number, y: number) => boolean, maxR: number = PET.bedSearchTiles): TilePos | undefined {
    if (ok(t.x, t.y)) return t;
    for (let r = 1; r <= maxR; r++) {
      let best: TilePos | undefined;
      let bestD = Infinity;
      for (let y = t.y - r; y <= t.y + r; y++)
        for (let x = t.x - r; x <= t.x + r; x++) {
          if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) !== r || !ok(x, y)) continue;
          const d = Math.hypot(x - t.x, y - t.y);
          if (d < bestD) {
            bestD = d;
            best = { x, y };
          }
        }
      if (best) return best;
    }
    return undefined;
  }

  /**
   * Se rearmó un nivel (el editor de la casa, la decoración): la mascota que quedó debajo de un mueble se
   * corre al tile libre más cercano y deja la ruta (la siguiente la calcula con el nivel nuevo).
   */
  rebuilt(area: string) {
    for (const brain of this.brains.values()) {
      const pet = this.o.pets.get(brain.def.id);
      if (pet?.area === area) this.unstick(brain, pet, true);
    }
  }

  /** Si está parada en un tile que ya no se pisa, al libre más cercano. `dropPath`: descarta la ruta. */
  private unstick(brain: Brain, pet: PetView, dropPath: boolean) {
    const map = this.o.map(pet.area);
    const ts = map.tileSize;
    const at = this.tileOf(pet, ts);
    const stuck = !this.allowed(brain, map, at.x, at.y);
    if (!stuck && !dropPath) return;
    if (stuck) {
      const to = this.freeNear(map, at, (x, y) => this.allowed(brain, map, x, y));
      if (to) {
        pet.x = to.x * ts + ts / 2;
        pet.y = to.y * ts + ts / 2;
      }
    }
    if (brain.mode === "walk") {
      brain.path = [];
      brain.mode = "idle";
      pet.pose = "stand";
      brain.until = 0;
    }
  }

  private between(a: number, b: number) {
    return a + (b - a) * this.o.rng();
  }

  /** Un tile al que puede ir sola: libre, dentro de su zona, sin portal y fuera de las oficinas. */
  private canGo(def: PetDef, map: OfficeMap, x: number, y: number) {
    if (!inRect(def.roam, x, y) || isBlockedTile(map, x, y) || portalAtTile(map, x, y)) return false;
    const ts = map.tileSize;
    return zoneAt(map, x * ts + ts / 2, y * ts + ts / 2)?.type !== "office";
  }

  /** Siguiendo a su dueño va a cualquier tile libre del nivel (también a su oficina), pero nunca a un portal. */
  private followable(map: OfficeMap, x: number, y: number) {
    return !isBlockedTile(map, x, y) && !portalAtTile(map, x, y);
  }

  private allowed(brain: Brain, map: OfficeMap, x: number, y: number) {
    return brain.following ? this.followable(map, x, y) : this.canGo(brain.def, map, x, y);
  }

  private tileOf(p: { x: number; y: number }, ts: number): TilePos {
    return { x: Math.floor(p.x / ts), y: Math.floor(p.y / ts) };
  }

  /** Ruta hasta `goal` que no salga de su zona ni entre a una oficina (o null). */
  private route(def: PetDef, map: OfficeMap, from: TilePos, goal: TilePos): TilePos[] | null {
    const path = findPath(map, from, goal);
    if (!path) return null;
    return path.every((t) => this.canGo(def, map, t.x, t.y)) ? path : null;
  }

  /** El cariño baja con el tiempo (se cuenta al pasar, no hace falta guardarlo cada vez). */
  private decay(brain: Brain, pet: PetView, now: number) {
    if (now <= brain.loveAt) return;
    brain.love = decayedLove(brain.love, now - brain.loveAt);
    brain.loveAt = now;
    const shown = Math.round(brain.love);
    if (pet.love !== shown) pet.love = shown;
  }

  tick(now: number, dtMs: number) {
    for (const brain of this.brains.values()) {
      const pet = this.o.pets.get(brain.def.id);
      if (!pet) continue;
      this.decay(brain, pet, now);
      const owner = brain.ownerId ? this.o.owner?.(brain.ownerId) : undefined;
      if (owner) {
        this.follow(brain, pet, owner, now, dtMs);
        continue;
      }
      // El dueño se fue (o la soltó): de vuelta a su casa.
      if (brain.following) this.goHome(brain, pet, now);
      if (brain.mode === "walk") {
        // El siguiente paso quedó tapado (un mueble nuevo): deja la ruta y piensa otra.
        const next = brain.path[0];
        if (next && !this.canGo(brain.def, this.o.map(pet.area), next.x, next.y)) {
          this.unstick(brain, pet, true);
          continue;
        }
        this.walk(brain, pet, now, dtMs);
      } else if (now >= brain.until) this.decide(brain, pet, now);
    }
  }

  // ---------- Con dueño ----------

  /** Sigue al dueño: cerca se sienta a su lado (y si él no se mueve, se duerme); lejos camina o aparece. */
  private follow(brain: Brain, pet: PetView, owner: PetUser & { name: string }, now: number, dtMs: number) {
    brain.following = true;
    if (pet.ownerName !== owner.name) pet.ownerName = owner.name;
    const map = this.o.map(owner.area);
    const ts = map.tileSize;
    const dist = Math.hypot(owner.x - pet.x, owner.y - pet.y);
    if (pet.area !== owner.area || dist > PET_BOND.teleportTiles * ts) return this.appearNear(brain, pet, owner, map);
    const still = brain.still;
    if (!still || Math.hypot(owner.x - still.x, owner.y - still.y) > ts / 2) brain.still = { x: owner.x, y: owner.y, since: now };
    if (brain.mode === "eat" && now < brain.until) return;
    const walking = brain.mode === "walk";
    if (dist <= (walking ? PET_BOND.followTiles : PET_BOND.catchUpTiles) * ts) {
      brain.path = [];
      brain.mode = "idle";
      const nap = now - brain.still!.since >= PET_BOND.napAfterMs;
      pet.pose = nap ? "sleep" : "sit";
      if (!nap && dist > 1) pet.dir = facingOf(owner.x - pet.x, owner.y - pet.y);
      return;
    }
    if (!walking || now - brain.pathAt >= PET_BOND.repathMs) {
      brain.pathAt = now;
      this.unstick(brain, pet, false);
      const path = this.pathToOwner(map, pet, owner);
      if (!path) {
        // Sin camino (una puerta cerrada, un mueble nuevo): si quedó lejos, aparece a su lado.
        if (dist > PET_BOND.catchUpTiles * 2 * ts) this.appearNear(brain, pet, owner, map);
        return;
      }
      brain.path = path;
      brain.goal = "come";
      brain.mode = "walk";
      brain.lookAt = { x: owner.x, y: owner.y };
    }
    const next = brain.path[0];
    if (next && !this.followable(map, next.x, next.y)) {
      brain.path = [];
      brain.mode = "idle";
      return;
    }
    this.walk(brain, pet, now, dtMs, PET_BOND.followSpeed);
  }

  /** Ruta hasta el lado del dueño (sin pisar su tile; si está sentado, hasta un tile libre cerca). */
  private pathToOwner(map: OfficeMap, pet: PetView, owner: PetUser): TilePos[] | null {
    const ts = map.tileSize;
    const from = this.tileOf(pet, ts);
    const target = this.tileOf(owner, ts);
    const ok = (t: TilePos) => this.followable(map, t.x, t.y);
    const full = findPath(map, from, target);
    if (full) {
      const path = full.slice(0, -1);
      return path.every(ok) ? path : null;
    }
    const spot = this.freeNear(map, target, (x, y) => this.followable(map, x, y), 3);
    if (!spot) return null;
    const path = findPath(map, from, spot);
    return path && path.every(ok) ? path : null;
  }

  /** Aparece junto al dueño (cambió de nivel o quedó muy lejos): en un tile libre del mismo lado de la pared. */
  private appearNear(brain: Brain, pet: PetView, owner: PetUser, map: OfficeMap) {
    const ts = map.tileSize;
    const target = this.tileOf(owner, ts);
    const reachable = (x: number, y: number) => {
      if ((x === target.x && y === target.y) || !this.followable(map, x, y)) return false;
      const p = findPath(map, { x, y }, target);
      return !p || p.length <= 4; // sin ruta al tile del dueño (está sentado): basta con que esté libre
    };
    const spot = this.freeNear(map, target, reachable, 4) ?? this.freeNear(map, target, (x, y) => this.followable(map, x, y), 6) ?? target;
    pet.area = map.id;
    pet.x = spot.x * ts + ts / 2;
    pet.y = spot.y * ts + ts / 2;
    pet.pose = "sit";
    pet.dir = facingOf(owner.x - pet.x, owner.y - pet.y);
    brain.path = [];
    brain.mode = "idle";
    brain.lookAt = undefined;
  }

  /** Sin dueño conectado: si quedó lejos de su zona, vuelve a dormir a su cama; si no, sigue como antes. */
  private goHome(brain: Brain, pet: PetView, now: number) {
    brain.following = false;
    brain.path = [];
    brain.still = undefined;
    const map = this.o.map(brain.def.area);
    const ts = map.tileSize;
    const at = this.tileOf(pet, ts);
    if (pet.area === brain.def.area && this.canGo(brain.def, map, at.x, at.y)) {
      brain.mode = "idle";
      brain.until = now;
      return;
    }
    const bed = this.bedTile(brain.def, map);
    pet.area = brain.def.area;
    pet.x = bed.x * ts + ts / 2;
    pet.y = bed.y * ts + ts / 2;
    pet.pose = "sleep";
    brain.mode = "sleep";
    brain.goal = "bed";
    brain.until = now + this.between(...PET.sleepMs);
  }

  // ---------- Sola ----------

  private walk(brain: Brain, pet: PetView, now: number, dtMs: number, speed: number = PET.speed) {
    const map = this.o.map(pet.area);
    const ts = map.tileSize;
    let budget = (speed * dtMs) / 1000;
    while (budget > 0 && brain.path.length) {
      const next = brain.path[0]!;
      const tx = next.x * ts + ts / 2;
      const ty = next.y * ts + ts / 2;
      const dx = tx - pet.x;
      const dy = ty - pet.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) pet.dir = facingOf(dx, dy);
      if (dist <= budget) {
        pet.x = tx;
        pet.y = ty;
        budget -= dist;
        brain.path.shift();
      } else {
        pet.x += (dx / dist) * budget;
        pet.y += (dy / dist) * budget;
        budget = 0;
      }
    }
    pet.pose = "walk";
    if (brain.path.length) return;
    // Llegó.
    if (brain.lookAt) pet.dir = facingOf(brain.lookAt.x - pet.x, brain.lookAt.y - pet.y);
    if (brain.goal === "bed") {
      brain.mode = "sleep";
      pet.pose = "sleep";
      brain.until = now + this.between(...PET.sleepMs);
    } else if (brain.goal === "come") {
      brain.mode = "idle";
      pet.pose = "sit";
      brain.until = now + PET.followMs;
    } else {
      brain.mode = "idle";
      pet.pose = this.o.rng() < 0.6 ? "sit" : "stand";
      brain.until = now + this.between(...PET.idleMs);
    }
    brain.lookAt = undefined;
  }

  /** Terminó de descansar: a dormir a su cama o a pasear a un lugar al azar. */
  private decide(brain: Brain, pet: PetView, now: number) {
    // Si quedó debajo de un mueble (el editor), primero se corre: el A* no sale de un tile bloqueado.
    this.unstick(brain, pet, false);
    const map = this.o.map(pet.area);
    const from = this.tileOf(pet, map.tileSize);
    const def = brain.def;
    if (brain.mode !== "sleep" && this.o.rng() < PET.sleepChance) {
      const bed = this.bedTile(def, map);
      const path = from.x === bed.x && from.y === bed.y ? [] : this.route(def, map, from, bed);
      if (path) return this.go(brain, pet, path, "bed", now);
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = from.x + Math.round((this.o.rng() * 2 - 1) * PET.wanderTiles);
      const y = from.y + Math.round((this.o.rng() * 2 - 1) * PET.wanderTiles);
      if ((x === from.x && y === from.y) || !this.canGo(def, map, x, y)) continue;
      const path = this.route(def, map, from, { x, y });
      if (path?.length) return this.go(brain, pet, path, "wander", now);
    }
    // No encontró adónde ir: se queda un rato más.
    brain.mode = "idle";
    pet.pose = "sit";
    brain.until = now + this.between(...PET.idleMs);
  }

  private go(brain: Brain, pet: PetView, path: TilePos[], goal: Goal, now: number) {
    brain.path = path;
    brain.goal = goal;
    brain.mode = path.length ? "walk" : "idle";
    if (!path.length) {
      // Ya estaba en su cama.
      brain.mode = goal === "bed" ? "sleep" : "idle";
      pet.pose = goal === "bed" ? "sleep" : "sit";
      const [a, b] = goal === "bed" ? PET.sleepMs : PET.idleMs;
      brain.until = now + this.between(a, b);
    }
  }

  private near(pet: PetView, who: PetUser, tiles: number) {
    if (pet.area !== who.area) return false;
    return Math.hypot(pet.x - who.x, pet.y - who.y) <= tiles * this.o.map(pet.area).tileSize;
  }

  /**
   * "Ven": se despierta y camina hasta el lado de quien la llamó (si está en su nivel y no muy lejos).
   * Con pausa por persona: cada llamada recalcula la ruta y suena para todo el nivel. Una que sigue a su
   * dueño solo le hace caso a él (y ya va a su lado).
   */
  call(who: PetUser, raw: unknown, now: number): PetResult {
    const parsed = PetCallMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const pet = this.o.pets.get(parsed.data.pet);
    const brain = this.brains.get(parsed.data.pet);
    if (!pet || !brain) return { ok: false, error: "invalid" };
    if (!this.near(pet, who, PET.callTiles)) return { ok: false, error: "far" };
    if (now - (this.lastCallAt.get(who.userId) ?? -Infinity) < PET.callCooldownMs) return { ok: false, error: "busy" };
    if (brain.following && brain.ownerId !== who.userId) return { ok: false, error: "busy" };
    this.forgetExpired(now);
    this.lastCallAt.set(who.userId, now);
    const ok = { ok: true as const, action: "call" as const, reward: 0, love: pet.love };
    if (brain.following) return ok;
    this.unstick(brain, pet, false);
    const map = this.o.map(pet.area);
    const ts = map.tileSize;
    const from = this.tileOf(pet, ts);
    const target = { x: Math.floor(who.x / ts), y: Math.floor(who.y / ts) };
    brain.lookAt = { x: who.x, y: who.y };
    // Hasta el tile de al lado (el último paso sería el de la persona).
    const full = findPath(map, from, target);
    const path = full?.slice(0, -1).filter((t) => this.canGo(brain.def, map, t.x, t.y)) ?? [];
    const reached = full && path.length === full.length - 1;
    if (reached && path.length) {
      this.go(brain, pet, path, "come", now);
    } else {
      // Ya está al lado (o no hay ruta): se sienta mirándola.
      brain.mode = "idle";
      brain.path = [];
      pet.pose = "sit";
      pet.dir = facingOf(who.x - pet.x, who.y - pet.y);
      brain.until = now + PET.followMs;
    }
    return ok;
  }

  /**
   * De cerca: acariciar, darle croquetas, darle la comida de la mano, adoptarla o soltarla. Respeta las
   * pausas; el cariño sube hasta el tope diario de cada persona y los puntos, hasta su tope de veces.
   */
  act(who: PetUser, raw: unknown, now: number): PetResult {
    const parsed = PetActionMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { pet: id, action } = parsed.data;
    const pet = this.o.pets.get(id);
    const brain = this.brains.get(id);
    if (!pet || !brain) return { ok: false, error: "invalid" };
    if (!this.near(pet, who, PET.reachTiles)) return { ok: false, error: "far" };
    if (now - (this.lastPetAt.get(who.userId) ?? -Infinity) < PET.petCooldownMs) return { ok: false, error: "busy" };
    this.decay(brain, pet, now);

    if (action === "adopt" || action === "release") {
      if (action === "adopt") {
        if (brain.ownerId === who.userId) return { ok: false, error: "hasPet" };
        if (brain.ownerId) return { ok: false, error: "taken" };
        if (this.petOf(who.userId)) return { ok: false, error: "hasPet" };
        brain.ownerId = who.userId;
        pet.ownerId = who.userId;
        pet.ownerName = who.name ?? "";
      } else {
        if (brain.ownerId !== who.userId) return { ok: false, error: "notOwner" };
        brain.ownerId = undefined;
        pet.ownerId = "";
        pet.ownerName = "";
      }
      this.lastPetAt.set(who.userId, now);
      brain.dirty = true;
      this.persist(brain, now);
      // Contenta: se sienta a mirarla (la adoptada empieza a seguirla en el próximo paso).
      brain.path = [];
      brain.mode = "idle";
      brain.until = now + 3_000;
      pet.pose = "sit";
      pet.dir = facingOf(who.x - pet.x, who.y - pet.y);
      return { ok: true, action, reward: 0, love: pet.love };
    }

    const treatKey = `${who.userId}:${id}`;
    const eats = action === "treat" || action === "feed";
    if (eats && now - (this.lastTreatAt.get(treatKey) ?? -Infinity) < PET.treatCooldownMs) return { ok: false, error: "fed" };
    let food: string | undefined;
    if (action === "feed") {
      const held = this.o.food?.peek(who.userId);
      if (!held) return { ok: false, error: "noFood" };
      this.o.food!.take(who.userId, held.part);
      food = held.art;
    }
    this.forgetExpired(now);
    this.lastPetAt.set(who.userId, now);
    if (eats) this.lastTreatAt.set(treatKey, now);
    this.gain(brain, pet, who.userId, PET_BOND.gain[action], now);
    const reward = this.rewardFor(who.userId, now);
    const result: PetResult = { ok: true, action, reward, love: pet.love, ...(food ? { food } : {}) };
    // Deja lo que estaba haciendo y la mira (si dormía y la acarician, sigue durmiendo, feliz).
    if (brain.mode === "sleep" && action === "pet") return result;
    brain.path = [];
    pet.dir = facingOf(who.x - pet.x, who.y - pet.y);
    if (eats) {
      brain.mode = "eat";
      pet.pose = "eat" satisfies PetPose;
      brain.until = now + PET.eatMs;
    } else {
      brain.mode = "idle";
      pet.pose = "sit";
      brain.until = now + 4_000;
    }
    return result;
  }

  /** Suma cariño, sin pasarse del tope diario de esa persona con esa mascota ni del máximo. */
  private gain(brain: Brain, pet: PetView, userId: string, amount: number, now: number) {
    const day = dayStart(now);
    const key = `${userId}:${brain.def.id}`;
    const today = this.gainedToday.get(key);
    const used = today?.day === day ? today.n : 0;
    const add = Math.max(0, Math.min(amount, PET_BOND.dailyGainPerUser - used, PET_BOND.max - brain.love));
    this.gainedToday.set(key, { day, n: used + Math.max(0, Math.min(amount, PET_BOND.dailyGainPerUser - used)) });
    if (add <= 0) return;
    brain.love += add;
    brain.dirty = true;
    pet.love = Math.round(brain.love);
  }

  /** Puntos por cuidarla: los primeros `careRewardsPerDay` cuidados del día de cada persona. */
  private rewardFor(userId: string, now: number): number {
    const day = dayStart(now);
    const today = this.rewardsToday.get(userId);
    const n = today?.day === day ? today.n : 0;
    if (n >= PET_BOND.careRewardsPerDay) return 0;
    this.rewardsToday.set(userId, { day, n: n + 1 });
    return PET_BOND.careReward;
  }

  /** Las pausas vencidas no hacen falta: sin esto los mapas crecen con cada persona que pasó. */
  private forgetExpired(now: number) {
    const drop = (m: Map<string, number>, ms: number) => {
      if (m.size < 64) return;
      for (const [k, at] of m) if (now - at >= ms) m.delete(k);
    };
    drop(this.lastPetAt, PET.petCooldownMs);
    drop(this.lastTreatAt, PET.treatCooldownMs);
    drop(this.lastCallAt, PET.callCooldownMs);
    const day = dayStart(now);
    for (const m of [this.gainedToday, this.rewardsToday]) {
      if (m.size < 64) continue;
      for (const [k, v] of m) if (v.day !== day) m.delete(k);
    }
  }

  /** Cuántas pausas se recuerdan (para los tests). */
  get pending() {
    return this.lastPetAt.size + this.lastTreatAt.size + this.lastCallAt.size;
  }

  /** Qué está haciendo (para los tests). */
  modeOf(id: string) {
    return this.brains.get(id)?.mode;
  }

  /** El próximo tile de su ruta (para los tests). */
  nextStepOf(id: string): TilePos | undefined {
    return this.brains.get(id)?.path[0];
  }
}
