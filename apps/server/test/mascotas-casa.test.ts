// La mascota en la casa de su dueño (VIR-85): con el dueño quieto se va a dormir a su cama de la casa (solo
// en la propia) y el comedero de la cocina la hace ir a comer.
import { buildCasaPropia, getWorld, type OfficeMap } from "@hyvento/map";
import { MUNDO, PET, PET_BOND } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Pets, type PetUser, type PetView } from "../src/rooms/mascotas";

const world = getWorld();
const casas = new Map<string, OfficeMap>();
const mapOf = (area: string): OfficeMap => {
  if (!area.startsWith("casa:")) return world.areas.get(area)!;
  let m = casas.get(area);
  if (!m) casas.set(area, (m = buildCasaPropia(area)!));
  return m;
};
const blank = (): PetView => ({ id: "", name: "", kind: "", coat: "", area: "", x: 0, y: 0, dir: "down", pose: "stand", ownerId: "", ownerName: "", love: 0 });
const NOON = Date.UTC(2026, 8, 27, 17, 0, 0);
const tile = (p: { x: number; y: number }) => ({ x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) });
const at = (area: string, x: number, y: number) => ({ area, x: x * 32 + 16, y: y * 32 + 16 });

function setup() {
  const pets = new Map<string, PetView>();
  const owners = new Map<string, PetUser & { name: string }>();
  let seed = 1;
  const sim = new Pets({ pets, create: blank, map: mapOf, rng: () => ((seed = (seed * 16807) % 2147483647) / 2147483647), owner: (id) => owners.get(id) });
  sim.start(NOON);
  const canela = pets.get("canela")!;
  sim.act({ userId: "a", name: "Ana", area: canela.area, x: canela.x + 32, y: canela.y }, { pet: "canela", action: "adopt" }, NOON);
  let now = NOON;
  const run = (ms: number) => {
    for (let i = 0; i < Math.ceil(ms / PET.tickMs); i++) sim.tick((now += PET.tickMs), PET.tickMs);
  };
  return { owners, sim, canela, run, now: () => now };
}

const bedsOf = (area: string) => mapOf(area).furniture.filter((f) => f.type === "pet-bed");

describe("la mascota en la casa", () => {
  it("cada piso de adentro tiene su cama de mascota y la cocina, el comedero", () => {
    expect(bedsOf("casa:a:abajo").length).toBeGreaterThan(0);
    expect(bedsOf("casa:a:arriba").length).toBeGreaterThan(0);
    expect(mapOf("casa:a:abajo").furniture.some((f) => f.type === "pet-bowl")).toBe(true);
  });

  it("en su casa, con el dueño quieto, se va a dormir a su cama; cuando el dueño camina, lo sigue", () => {
    const { owners, canela, run } = setup();
    owners.set("a", { userId: "a", name: "Ana", ...at("casa:a:abajo", 4, 6) });
    run(1_000);
    expect(canela.area).toBe("casa:a:abajo");
    run(PET_BOND.napAfterMs + 8_000);
    const bed = bedsOf("casa:a:abajo")[0]!;
    expect(tile(canela)).toEqual({ x: bed.x, y: bed.y });
    expect(canela.pose).toBe("sleep");
    // Sigue en la cama mientras el dueño no se mueva.
    run(20_000);
    expect(tile(canela)).toEqual({ x: bed.x, y: bed.y });
    // El dueño camina a la cocina: se levanta y lo sigue.
    owners.set("a", { userId: "a", name: "Ana", ...at("casa:a:abajo", 17, 6) });
    run(6_000);
    expect(Math.hypot(canela.x - 17 * 32 - 16, canela.y - 6 * 32 - 16)).toBeLessThanOrEqual(PET_BOND.catchUpTiles * 32);
  });

  it("en la casa de otra persona duerme al lado del dueño, no en la cama de la casa", () => {
    const { owners, canela, run } = setup();
    owners.set("a", { userId: "a", name: "Ana", ...at("casa:b:abajo", 4, 6) });
    run(PET_BOND.napAfterMs + 8_000);
    expect(canela.pose).toBe("sleep");
    expect(Math.hypot(canela.x - 4 * 32 - 16, canela.y - 6 * 32 - 16)).toBeLessThanOrEqual(PET_BOND.catchUpTiles * 32);
  });

  it("el comedero: va hasta el plato, come un rato y sube el cariño", () => {
    const { owners, sim, canela, run, now } = setup();
    owners.set("a", { userId: "a", name: "Ana", ...at("casa:a:abajo", 17, 6) });
    run(2_000);
    const bowl = mapOf("casa:a:abajo").furniture.find((f) => f.type === "pet-bowl")!;
    const before = canela.love;
    const r = sim.restAt("a", { ...bowl, area: "casa:a:abajo" }, now(), { love: MUNDO.bowlLove, reachTiles: MUNDO.bowlReachTiles, eat: true });
    expect(r).toMatchObject({ ok: true, pet: "canela", gained: true });
    run(3_000);
    expect(tile(canela)).toEqual({ x: bowl.x, y: bowl.y });
    expect(canela.pose).toBe("eat");
    expect(canela.love).toBeGreaterThan(before);
    // Al terminar de comer vuelve con el dueño.
    run(sim.bowlMs + 3_000);
    expect(canela.pose).not.toBe("eat");
  });
});
