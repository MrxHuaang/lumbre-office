// Casa viva: las mascotas. El servidor las mueve a paso lento por su nivel (nunca salen de él): eligen
// destinos al azar dentro de su zona, van con el A* del mundo (que no cruza paredes ni muebles, ni pisa
// portales), a veces se van a dormir a su cama, y vienen cuando alguien las llama. El azar es inyectable
// (los tests lo fijan). El editor de la casa puede mover la cama o poner un mueble encima de una
// mascota: la cama se busca en el nivel y la que quedó tapada se corre al tile libre más cercano.
import { findPath, isBlockedTile, portalAtTile, zoneAt, type OfficeMap, type TilePos } from "@hyvento/map";
import { PET, PETS, PetActionMessage, PetCallMessage, type Direction, type PetDef, type PetEvent, type PetPose } from "@hyvento/shared";

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
}

/** Quien interactúa: su usuario, nivel y posición de los pies. */
export interface PetUser {
  userId: string;
  area: string;
  x: number;
  y: number;
}

/** Por qué no: mal pedido, lejos (u otro nivel), muy seguido o ya comió (la pausa de los premios). */
export type PetError = "invalid" | "far" | "busy" | "fed";
export type PetResult = { ok: true; action: PetEvent["action"] } | { ok: false; error: PetError };

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
      Object.assign(p, { id: def.id, name: def.name, kind: def.kind, coat: def.coat, area: def.area, x: bed.x * ts + ts / 2, y: bed.y * ts + ts / 2, dir: "down", pose: "sleep" });
      this.o.pets.set(def.id, p);
      this.brains.set(def.id, { def, mode: "sleep", goal: "bed", path: [], until: now + this.between(4_000, 12_000) });
    }
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
    return best ?? this.freeNear(def, map, def.bed) ?? def.bed;
  }

  /** El tile libre (al que puede ir) más cercano a `t`, buscando en anillos. */
  private freeNear(def: PetDef, map: OfficeMap, t: TilePos): TilePos | undefined {
    if (this.canGo(def, map, t.x, t.y)) return t;
    for (let r = 1; r <= PET.bedSearchTiles; r++) {
      let best: TilePos | undefined;
      let bestD = Infinity;
      for (let y = t.y - r; y <= t.y + r; y++)
        for (let x = t.x - r; x <= t.x + r; x++) {
          if (Math.max(Math.abs(x - t.x), Math.abs(y - t.y)) !== r || !this.canGo(def, map, x, y)) continue;
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
    const stuck = !this.canGo(brain.def, map, at.x, at.y);
    if (!stuck && !dropPath) return;
    if (stuck) {
      const to = this.freeNear(brain.def, map, at);
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

  /** Un tile al que puede ir: libre, dentro de su zona, sin portal y fuera de las oficinas. */
  private canGo(def: PetDef, map: OfficeMap, x: number, y: number) {
    if (!inRect(def.roam, x, y) || isBlockedTile(map, x, y) || portalAtTile(map, x, y)) return false;
    const ts = map.tileSize;
    return zoneAt(map, x * ts + ts / 2, y * ts + ts / 2)?.type !== "office";
  }

  private tileOf(p: PetView, ts: number): TilePos {
    return { x: Math.floor(p.x / ts), y: Math.floor(p.y / ts) };
  }

  /** Ruta hasta `goal` que no salga de su zona ni entre a una oficina (o null). */
  private route(def: PetDef, map: OfficeMap, from: TilePos, goal: TilePos): TilePos[] | null {
    const path = findPath(map, from, goal);
    if (!path) return null;
    return path.every((t) => this.canGo(def, map, t.x, t.y)) ? path : null;
  }

  tick(now: number, dtMs: number) {
    for (const brain of this.brains.values()) {
      const pet = this.o.pets.get(brain.def.id);
      if (!pet) continue;
      if (brain.mode === "walk") {
        // El siguiente paso quedó tapado (un mueble nuevo): deja la ruta y piensa otra.
        const next = brain.path[0];
        if (next && !this.canGo(brain.def, this.o.map(pet.area), next.x, next.y)) {
          this.unstick(brain, pet, true);
          continue;
        }
        this.walk(brain, pet, now, dtMs);
      }
      else if (now >= brain.until) this.decide(brain, pet, now);
    }
  }

  private walk(brain: Brain, pet: PetView, now: number, dtMs: number) {
    const map = this.o.map(pet.area);
    const ts = map.tileSize;
    let budget = (PET.speed * dtMs) / 1000;
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
   * Con pausa por persona: cada llamada recalcula la ruta y suena para todo el nivel.
   */
  call(who: PetUser, raw: unknown, now: number): PetResult {
    const parsed = PetCallMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const pet = this.o.pets.get(parsed.data.pet);
    const brain = this.brains.get(parsed.data.pet);
    if (!pet || !brain) return { ok: false, error: "invalid" };
    if (!this.near(pet, who, PET.callTiles)) return { ok: false, error: "far" };
    if (now - (this.lastCallAt.get(who.userId) ?? -Infinity) < PET.callCooldownMs) return { ok: false, error: "busy" };
    this.forgetExpired(now);
    this.lastCallAt.set(who.userId, now);
    this.unstick(brain, pet, false);
    const map = this.o.map(pet.area);
    const ts = map.tileSize;
    const from = this.tileOf(pet, ts);
    const target = { x: Math.floor(who.x / ts), y: Math.floor(who.y / ts) };
    brain.lookAt = { x: who.x, y: who.y };
    // Hasta el tile de al lado (el último paso sería el de la persona).
    const full = findPath(map, from, target);
    const path = full?.slice(0, -1).filter((t) => this.canGo(brain.def, map, t.x, t.y)) ?? [];
    const ok = full && path.length === full.length - 1;
    if (ok && path.length) {
      this.go(brain, pet, path, "come", now);
    } else {
      // Ya está al lado (o no hay ruta): se sienta mirándola.
      brain.mode = "idle";
      brain.path = [];
      pet.pose = "sit";
      pet.dir = facingOf(who.x - pet.x, who.y - pet.y);
      brain.until = now + PET.followMs;
    }
    return { ok: true, action: "call" };
  }

  /** Acariciar o dar un premio: de cerca y respetando las pausas. */
  act(who: PetUser, raw: unknown, now: number): PetResult {
    const parsed = PetActionMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { pet: id, action } = parsed.data;
    const pet = this.o.pets.get(id);
    const brain = this.brains.get(id);
    if (!pet || !brain) return { ok: false, error: "invalid" };
    if (!this.near(pet, who, PET.reachTiles)) return { ok: false, error: "far" };
    if (now - (this.lastPetAt.get(who.userId) ?? -Infinity) < PET.petCooldownMs) return { ok: false, error: "busy" };
    const treatKey = `${who.userId}:${id}`;
    if (action === "treat" && now - (this.lastTreatAt.get(treatKey) ?? -Infinity) < PET.treatCooldownMs) return { ok: false, error: "fed" };
    this.forgetExpired(now);
    this.lastPetAt.set(who.userId, now);
    if (action === "treat") this.lastTreatAt.set(treatKey, now);
    // Deja lo que estaba haciendo y la mira (si dormía y la acarician, sigue durmiendo, feliz).
    if (brain.mode === "sleep" && action === "pet") return { ok: true, action: "pet" };
    brain.path = [];
    pet.dir = facingOf(who.x - pet.x, who.y - pet.y);
    if (action === "treat") {
      brain.mode = "eat";
      pet.pose = "eat" satisfies PetPose;
      brain.until = now + PET.eatMs;
    } else {
      brain.mode = "idle";
      pet.pose = "sit";
      brain.until = now + 4_000;
    }
    return { ok: true, action };
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
