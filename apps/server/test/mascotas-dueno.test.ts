// Mascotas con dueño: adoptar (una por persona), seguir al dueño por el nivel y de un nivel a otro,
// alimentarla con lo que se tiene en la mano y el cariño (sube con tope diario y baja con el tiempo).
import { canStandAt, findPath, getWorld, isBlockedTile, portalAtTile, spawnPoint, wallBetween, type OfficeMap, type TilePos } from "@hyvento/map";
import { heldParts, PET, PET_BOND, petFoodIn, usesOf, type PetBondRecord } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Pets, type PetUser, type PetView } from "../src/rooms/mascotas";

const world = getWorld();
const mapOf = (area: string): OfficeMap => world.areas.get(area)!;
const blank = (): PetView => ({ id: "", name: "", kind: "", coat: "", area: "", x: 0, y: 0, dir: "down", pose: "stand", ownerId: "", ownerName: "", love: 0 });
const DAY = 86_400_000;
/** Un mediodía de Bogotá (lejos del cambio de día). */
const NOON = Date.UTC(2026, 8, 27, 17, 0, 0);

function setup() {
  const pets = new Map<string, PetView>();
  const owners = new Map<string, PetUser & { name: string }>();
  const held = new Map<string, { item: string; left: number[] }>();
  const saved: PetBondRecord[] = [];
  let seed = 1;
  const sim = new Pets({
    pets,
    create: blank,
    map: mapOf,
    rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
    owner: (id) => owners.get(id),
    food: {
      peek: (id) => {
        const h = held.get(id);
        return h ? petFoodIn(h.item, h.left) : null;
      },
      take: (id, part) => {
        const h = held.get(id);
        if (!h) return;
        h.left[part] = 0;
        if (h.left.every((v) => v <= 0)) held.delete(id);
      },
    },
    save: (b) => saved.push(b),
  });
  sim.start(NOON);
  const give = (id: string, item: string) => held.set(id, { item, left: heldParts(item).map(usesOf) });
  return { pets, owners, held, saved, sim, give };
}

/** Alguien parado justo al lado de la mascota. */
const beside = (p: PetView, userId: string, name = userId): PetUser => ({ userId, name, area: p.area, x: p.x + 32, y: p.y });
const tileOf = (p: { x: number; y: number }): TilePos => ({ x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) });

describe("adoptar", () => {
  it("una mascota por persona, una persona por mascota; solo el dueño la suelta", () => {
    const { pets, sim, saved } = setup();
    const canela = pets.get("canela")!;
    const tobi = pets.get("tobi")!;
    let now = NOON;
    expect(sim.act(beside(canela, "a", "Ana"), { pet: "canela", action: "adopt" }, now)).toMatchObject({ ok: true, action: "adopt" });
    expect([canela.ownerId, canela.ownerName]).toEqual(["a", "Ana"]);
    expect(saved.at(-1)).toMatchObject({ petId: "canela", ownerId: "a" });
    expect(sim.petOf("a")).toBe("canela");
    now += 2_000;
    expect(sim.act(beside(canela, "b"), { pet: "canela", action: "adopt" }, now)).toEqual({ ok: false, error: "taken" });
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "adopt" }, now)).toEqual({ ok: false, error: "hasPet" });
    expect(sim.act(beside(canela, "b"), { pet: "canela", action: "release" }, (now += 2_000))).toEqual({ ok: false, error: "notOwner" });
    // De lejos no se adopta.
    expect(sim.act({ ...beside(tobi, "b"), x: tobi.x + 10 * 32 }, { pet: "tobi", action: "adopt" }, (now += 2_000))).toEqual({ ok: false, error: "far" });
    expect(sim.act(beside(canela, "a"), { pet: "canela", action: "release" }, (now += 2_000))).toMatchObject({ ok: true, action: "release" });
    expect([canela.ownerId, sim.petOf("a")]).toEqual(["", undefined]);
    expect(saved.at(-1)).toMatchObject({ petId: "canela", ownerId: null });
    // Ya sin mascota, puede adoptar otra.
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "adopt" }, (now += 2_000))).toMatchObject({ ok: true });
  });

  it("lo guardado vuelve al arrancar, con el cariño que perdió mientras tanto (y sin duplicar dueños)", () => {
    const { pets, sim } = setup();
    sim.loadBonds(
      [
        { petId: "tobi", ownerId: "a", ownerName: "Ana", love: 50, loveAt: NOON - 10 * 3_600_000 },
        { petId: "nube", ownerId: "a", ownerName: "Ana", love: 20, loveAt: NOON },
        { petId: "nadie", ownerId: "b", ownerName: "B", love: 20, loveAt: NOON },
      ],
      NOON,
    );
    expect(pets.get("tobi")).toMatchObject({ ownerId: "a", ownerName: "Ana", love: 50 - 10 * PET_BOND.decayPerHour });
    expect(pets.get("nube")).toMatchObject({ ownerId: "", love: 20 });
  });
});

describe("sigue a su dueño", () => {
  it("camina detrás del dueño por el nivel, sin cruzar paredes ni muebles, y se sienta cerca", () => {
    const { pets, owners, sim } = setup();
    const canela = pets.get("canela")!;
    let now = NOON;
    const ana = { ...beside(canela, "a", "Ana"), name: "Ana" };
    sim.act(ana, { pet: "canela", action: "adopt" }, now);
    const map = mapOf("planta-baja");
    // Un paseo largo del dueño (con el A*), hasta un tile libre lejos.
    const start = tileOf(ana);
    let route: TilePos[] | null = null;
    for (let y = map.height - 1; y >= 0 && !route; y--)
      for (let x = map.width - 1; x >= 0 && !route; x--) {
        if (isBlockedTile(map, x, y) || portalAtTile(map, x, y)) continue;
        const p = findPath(map, start, { x, y });
        if (p && p.length >= 18 && p.length <= 40) route = p;
      }
    expect(route).toBeTruthy();
    const walker = { ...ana };
    owners.set("a", walker);
    const waypoints = [...route!];
    let prev = { x: canela.x, y: canela.y };
    let farthest = 0;
    let after = 0;
    for (let i = 0; i < 1000 && after < 30; i++) {
      if (!waypoints.length) after++;
      // El dueño camina a 150 px/s por su ruta.
      let budget = (150 * PET.tickMs) / 1000;
      while (budget > 0 && waypoints.length) {
        const t = waypoints[0]!;
        const tx = t.x * 32 + 16;
        const ty = t.y * 32 + 16;
        const d = Math.hypot(tx - walker.x, ty - walker.y);
        if (d <= budget) {
          walker.x = tx;
          walker.y = ty;
          budget -= d;
          waypoints.shift();
        } else {
          walker.x += ((tx - walker.x) / d) * budget;
          walker.y += ((ty - walker.y) / d) * budget;
          budget = 0;
        }
      }
      sim.tick((now += PET.tickMs), PET.tickMs);
      expect(canela.area).toBe("planta-baja");
      expect(canStandAt(map, canela.x, canela.y), `(${canela.x}, ${canela.y})`).toBe(true);
      const a = tileOf(prev);
      const b = tileOf(canela);
      expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeLessThanOrEqual(1);
      if (a.x !== b.x && a.y === b.y) expect(wallBetween(map, a.x, a.y, b.x, b.y)).toBe(false);
      if (a.y !== b.y && a.x === b.x) expect(wallBetween(map, a.x, a.y, b.x, b.y)).toBe(false);
      farthest = Math.max(farthest, Math.hypot(walker.x - canela.x, walker.y - canela.y));
      prev = { x: canela.x, y: canela.y };
    }
    // Nunca se quedó muy atrás y terminó sentada al lado.
    expect(farthest).toBeLessThan(PET_BOND.teleportTiles * 32);
    expect(Math.hypot(walker.x - canela.x, walker.y - canela.y)).toBeLessThanOrEqual(PET_BOND.catchUpTiles * 32);
    expect(canela.pose).toBe("sit");
    // Si el dueño se queda quieto un buen rato, se echa a dormir a su lado.
    for (let i = 0; i < Math.ceil(PET_BOND.napAfterMs / PET.tickMs) + 2; i++) sim.tick((now += PET.tickMs), PET.tickMs);
    expect(canela.pose).toBe("sleep");
  });

  it("cambia de nivel con el dueño y, cuando el dueño se va, vuelve a dormir a su casa", () => {
    const { pets, owners, sim } = setup();
    const canela = pets.get("canela")!;
    let now = NOON;
    sim.act(beside(canela, "a", "Ana"), { pet: "canela", action: "adopt" }, now);
    // Sube por la escalera: aparece donde llega el dueño en el piso 2 (en un tile libre, no en el portal).
    const stairs = mapOf("planta-baja").portals.find((p) => p.to.area === "piso-2")!;
    const target = mapOf("piso-2");
    const spot = { x: stairs.to.x * 32 + 16, y: stairs.to.y * 32 + 16 };
    owners.set("a", { userId: "a", name: "Ana", area: "piso-2", ...spot });
    sim.tick((now += PET.tickMs), PET.tickMs);
    expect(canela.area).toBe("piso-2");
    expect(canStandAt(target, canela.x, canela.y)).toBe(true);
    expect(portalAtTile(target, Math.floor(canela.x / 32), Math.floor(canela.y / 32))).toBeUndefined();
    expect(Math.hypot(canela.x - spot.x, canela.y - spot.y)).toBeLessThanOrEqual(5 * 32);
    // Y al jardín.
    const garden = spawnPoint(mapOf("jardin"));
    owners.set("a", { userId: "a", name: "Ana", area: "jardin", x: garden.x, y: garden.y });
    sim.tick((now += PET.tickMs), PET.tickMs);
    expect(canela.area).toBe("jardin");
    expect(canStandAt(mapOf("jardin"), canela.x, canela.y)).toBe(true);
    // Se desconectó: a su cama.
    owners.delete("a");
    sim.tick((now += PET.tickMs), PET.tickMs);
    expect(canela.area).toBe("planta-baja");
    expect(canela.pose).toBe("sleep");
    expect(canStandAt(mapOf("planta-baja"), canela.x, canela.y)).toBe(true);
  });

  it("a una mascota que sigue a su dueño solo la llama su dueño", () => {
    const { pets, owners, sim } = setup();
    const tobi = pets.get("tobi")!;
    const ana = { ...beside(tobi, "a", "Ana"), name: "Ana" };
    sim.act(ana, { pet: "tobi", action: "adopt" }, NOON);
    owners.set("a", ana);
    sim.tick(NOON + PET.tickMs, PET.tickMs);
    expect(sim.call({ ...ana, userId: "b", x: ana.x + 64 }, { pet: "tobi" }, NOON + 5_000)).toEqual({ ok: false, error: "busy" });
    expect(sim.call(ana, { pet: "tobi" }, NOON + 5_000)).toMatchObject({ ok: true, action: "call" });
  });
});

describe("alimentar y cariño", () => {
  it("con comida de la mano (se la come, solo esa mano) o con el plato de croquetas; bebidas no", () => {
    const { pets, sim, held, give } = setup();
    const tobi = pets.get("tobi")!;
    let now = NOON;
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "feed" }, now)).toEqual({ ok: false, error: "noFood" });
    give("a", "tinto");
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "feed" }, (now += 2_000))).toEqual({ ok: false, error: "noFood" });
    // Las onces: tinto en una mano y pandebono en la otra. Se come el pandebono; el tinto queda.
    give("a", "onces");
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "feed" }, (now += 2_000))).toMatchObject({ ok: true, action: "feed", food: "pandebono" });
    expect(tobi.pose).toBe("eat");
    expect(held.get("a")?.left).toEqual([usesOf("tinto"), 0]);
    // Recién comió: ni otra comida ni croquetas de la misma persona por un rato.
    give("b", "empanada");
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "treat" }, (now += 2_000))).toEqual({ ok: false, error: "fed" });
    expect(sim.act(beside(tobi, "b"), { pet: "tobi", action: "feed" }, now)).toMatchObject({ ok: true, food: "empanada" });
    expect(held.has("b")).toBe(false);
    expect(sim.act(beside(tobi, "a"), { pet: "tobi", action: "treat" }, (now += PET.treatCooldownMs))).toMatchObject({ ok: true, action: "treat" });
  });

  it("el cariño sube con tope diario por persona, da pocos puntos al día y baja con el tiempo", () => {
    const { pets, sim } = setup();
    const nube = pets.get("nube")!;
    let now = NOON;
    const rewards: number[] = [];
    for (let i = 0; i < 25; i++) {
      const r = sim.act(beside(nube, "a"), { pet: "nube", action: "pet" }, (now += PET.petCooldownMs));
      expect(r.ok).toBe(true);
      if (r.ok) rewards.push(r.reward);
    }
    // Hasta el tope del día de esa persona, ni un poquito más.
    expect(nube.love).toBe(PET_BOND.dailyGainPerUser);
    expect(rewards.filter((r) => r > 0)).toHaveLength(PET_BOND.careRewardsPerDay);
    expect(rewards.slice(0, PET_BOND.careRewardsPerDay).every((r) => r === PET_BOND.careReward)).toBe(true);
    // Otra persona sí le suma.
    sim.act(beside(nube, "b"), { pet: "nube", action: "pet" }, (now += PET.petCooldownMs));
    expect(nube.love).toBe(PET_BOND.dailyGainPerUser + PET_BOND.gain.pet);
    // Diez horas sin nadie: baja.
    const before = nube.love;
    now += 10 * 3_600_000;
    sim.tick(now, PET.tickMs);
    expect(nube.love).toBe(before - 10 * PET_BOND.decayPerHour);
    // Al día siguiente la misma persona vuelve a sumar (y a ganar puntos), sobre lo que bajó en el día.
    const r = sim.act(beside(nube, "a"), { pet: "nube", action: "pet" }, now + DAY);
    expect(r).toMatchObject({ ok: true, reward: PET_BOND.careReward });
    expect(nube.love).toBe(Math.max(0, before - 34 * PET_BOND.decayPerHour) + PET_BOND.gain.pet);
  });

  it("guarda el cariño que cambió (flush) y no lo que no cambió", () => {
    const { pets, sim, saved } = setup();
    const canela = pets.get("canela")!;
    sim.act(beside(canela, "a"), { pet: "canela", action: "pet" }, NOON);
    sim.flush(NOON + 1_000);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ petId: "canela", ownerId: null, love: PET_BOND.gain.pet });
    sim.flush(NOON + 2_000);
    expect(saved).toHaveLength(1);
  });
});
