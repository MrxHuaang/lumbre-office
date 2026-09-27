// Casa viva: las mascotas. El servidor las mueve a paso lento por su nivel (nunca salen de él): eligen
// destinos al azar dentro de su zona, van con el A* del mundo (que no cruza paredes ni muebles, ni pisa
// portales), a veces se van a dormir a su cama, y vienen cuando alguien las llama. El azar es inyectable
// (los tests lo fijan).
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

  constructor(private readonly o: PetsOptions) {}

  private get defs() {
    return this.o.defs ?? PETS;
  }

  /** Aparecen durmiendo en su cama. */
  start(now: number) {
    for (const def of this.defs) {
      const map = this.o.map(def.area);
      const ts = map.tileSize;
      const p = this.o.create();
      Object.assign(p, { id: def.id, name: def.name, kind: def.kind, coat: def.coat, area: def.area, x: def.bed.x * ts + ts / 2, y: def.bed.y * ts + ts / 2, dir: "down", pose: "sleep" });
      this.o.pets.set(def.id, p);
      this.brains.set(def.id, { def, mode: "sleep", goal: "bed", path: [], until: now + this.between(4_000, 12_000) });
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
      if (brain.mode === "walk") this.walk(brain, pet, now, dtMs);
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
    const map = this.o.map(pet.area);
    const from = this.tileOf(pet, map.tileSize);
    const def = brain.def;
    if (brain.mode !== "sleep" && this.o.rng() < PET.sleepChance) {
      const path = from.x === def.bed.x && from.y === def.bed.y ? [] : this.route(def, map, from, def.bed);
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

  /** "Ven": se despierta y camina hasta el lado de quien la llamó (si está en su nivel y no muy lejos). */
  call(who: PetUser, raw: unknown, now: number): PetEvent["action"] | null {
    const parsed = PetCallMessage.safeParse(raw);
    if (!parsed.success) return null;
    const pet = this.o.pets.get(parsed.data.pet);
    const brain = this.brains.get(parsed.data.pet);
    if (!pet || !brain || !this.near(pet, who, PET.callTiles)) return null;
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
    return "call";
  }

  /** Acariciar o dar un premio: de cerca y respetando las pausas. */
  act(who: PetUser, raw: unknown, now: number): PetEvent["action"] | null {
    const parsed = PetActionMessage.safeParse(raw);
    if (!parsed.success) return null;
    const { pet: id, action } = parsed.data;
    const pet = this.o.pets.get(id);
    const brain = this.brains.get(id);
    if (!pet || !brain || !this.near(pet, who, PET.reachTiles)) return null;
    if (now - (this.lastPetAt.get(who.userId) ?? -Infinity) < PET.petCooldownMs) return null;
    const treatKey = `${who.userId}:${id}`;
    if (action === "treat" && now - (this.lastTreatAt.get(treatKey) ?? -Infinity) < PET.treatCooldownMs) return null;
    this.lastPetAt.set(who.userId, now);
    if (action === "treat") this.lastTreatAt.set(treatKey, now);
    // Deja lo que estaba haciendo y la mira (si dormía y la acarician, sigue durmiendo, feliz).
    if (brain.mode === "sleep" && action === "pet") return "pet";
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
    return action;
  }

  /** Qué está haciendo (para los tests). */
  modeOf(id: string) {
    return this.brains.get(id)?.mode;
  }
}
