import { canStandAt, getWorld, wallBetween, zoneAt, type OfficeMap } from "@hyvento/map";
import { PET, PETS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Pets, type PetView } from "../src/rooms/mascotas";

/** Azar con semilla (mulberry32): cada corrida es la misma. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const world = getWorld();
const mapOf = (area: string): OfficeMap => world.areas.get(area)!;
const blank = (): PetView => ({ id: "", name: "", kind: "", coat: "", area: "", x: 0, y: 0, dir: "down", pose: "stand" });

function setup(seed = 1) {
  const pets = new Map<string, PetView>();
  const sim = new Pets({ pets, create: blank, map: mapOf, rng: seeded(seed) });
  sim.start(0);
  return { pets, sim };
}

describe("mascotas", () => {
  it("cada una aparece en su cama, que es un mueble de su nivel", () => {
    const { pets } = setup();
    for (const def of PETS) {
      const map = mapOf(def.area);
      expect(map.furniture.some((f) => f.type === "pet-bed" && f.x === def.bed.x && f.y === def.bed.y), def.id).toBe(true);
      const p = pets.get(def.id)!;
      expect([Math.floor(p.x / 32), Math.floor(p.y / 32), p.pose]).toEqual([def.bed.x, def.bed.y, "sleep"]);
    }
  });

  it("deambulan mucho rato sin atravesar paredes ni muebles, sin salir de su nivel ni entrar a oficinas", () => {
    for (const seed of [1, 7, 42]) {
      const { pets, sim } = setup(seed);
      const prev = new Map([...pets].map(([id, p]) => [id, { ...p }]));
      const moved = new Set<string>();
      for (let now = 0, i = 0; i < 4000; i++) {
        now += PET.tickMs;
        sim.tick(now, PET.tickMs);
        for (const def of PETS) {
          const p = pets.get(def.id)!;
          const before = prev.get(def.id)!;
          const map = mapOf(def.area);
          expect(p.area, def.id).toBe(def.area);
          expect(canStandAt(map, p.x, p.y), `${def.id} en (${p.x}, ${p.y})`).toBe(true);
          const ts = map.tileSize;
          const a = { x: Math.floor(before.x / ts), y: Math.floor(before.y / ts) };
          const b = { x: Math.floor(p.x / ts), y: Math.floor(p.y / ts) };
          // Un paso por vez (de un tile al vecino) y nunca a través de una pared.
          expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)), def.id).toBeLessThanOrEqual(1);
          if (a.x !== b.x && a.y === b.y) expect(wallBetween(map, a.x, a.y, b.x, b.y), def.id).toBe(false);
          if (a.y !== b.y && a.x === b.x) expect(wallBetween(map, a.x, a.y, b.x, b.y), def.id).toBe(false);
          expect(zoneAt(map, p.x, p.y)?.type, def.id).not.toBe("office");
          if (a.x !== b.x || a.y !== b.y) moved.add(def.id);
          prev.set(def.id, { ...p });
        }
      }
      // Y de verdad pasean (en 10 minutos simulados).
      expect([...moved].sort()).toEqual(PETS.map((d) => d.id).sort());
    }
  });

  it("caminan a paso lento", () => {
    const { pets, sim } = setup(3);
    let max = 0;
    for (let now = 0, i = 0; i < 2000; i++) {
      const before = new Map([...pets].map(([id, p]) => [id, { x: p.x, y: p.y }]));
      now += PET.tickMs;
      sim.tick(now, PET.tickMs);
      for (const [id, p] of pets) max = Math.max(max, Math.hypot(p.x - before.get(id)!.x, p.y - before.get(id)!.y));
    }
    expect(max).toBeLessThanOrEqual((PET.speed * PET.tickMs) / 1000 + 0.01);
  });

  it("a veces vuelven a dormir a su cama", () => {
    const { pets, sim } = setup(5);
    const slept = new Set<string>();
    for (let now = 0, i = 0; i < 6000; i++) {
      now += PET.tickMs;
      sim.tick(now, PET.tickMs);
      if (now < 60_000) continue; // después de despertarse la primera vez
      for (const def of PETS) {
        const p = pets.get(def.id)!;
        if (p.pose === "sleep" && Math.floor(p.x / 32) === def.bed.x && Math.floor(p.y / 32) === def.bed.y) slept.add(def.id);
      }
    }
    expect([...slept].sort()).toEqual(PETS.map((d) => d.id).sort());
  });

  it("se acerca a quien la llama y se sienta a mirarla; desde otro nivel no", () => {
    const { pets, sim } = setup(2);
    const tobi = pets.get("tobi")!;
    const who = { userId: "u", area: "jardin", x: tobi.x + 5 * 32, y: tobi.y + 2 * 32 };
    expect(sim.call({ ...who, area: "planta-baja" }, { pet: "tobi" }, 0)).toBeNull();
    expect(sim.call(who, { pet: "tobi" }, 0)).toBe("call");
    let now = 0;
    for (let i = 0; i < 200 && sim.modeOf("tobi") === "walk"; i++) sim.tick((now += PET.tickMs), PET.tickMs);
    expect(Math.hypot(tobi.x - who.x, tobi.y - who.y)).toBeLessThanOrEqual(1.5 * 32);
    expect(tobi.pose).toBe("sit");
    // Lejísimos no oye.
    expect(sim.call({ ...who, x: who.x + 40 * 32 }, { pet: "tobi" }, now)).toBeNull();
    expect(sim.call(who, { pet: "nadie" }, now)).toBeNull();
  });

  it("se acaricia y se le da un premio solo de cerca, con pausa entre premios", () => {
    const { pets, sim } = setup(2);
    const canela = pets.get("canela")!;
    const near = { userId: "u", area: "planta-baja", x: canela.x + 32, y: canela.y };
    expect(sim.act({ ...near, x: canela.x + 5 * 32 }, { pet: "canela", action: "pet" }, 0)).toBeNull();
    expect(sim.act(near, { pet: "canela", action: "pet" }, 0)).toBe("pet");
    // Muy seguido, no (la pausa de acariciar).
    expect(sim.act(near, { pet: "canela", action: "pet" }, 500)).toBeNull();
    expect(sim.act(near, { pet: "canela", action: "treat" }, 2_000)).toBe("treat");
    expect(canela.pose).toBe("eat");
    expect(sim.act(near, { pet: "canela", action: "treat" }, 5_000)).toBeNull();
    expect(sim.act(near, { pet: "canela", action: "treat" }, 2_000 + PET.treatCooldownMs)).toBe("treat");
    expect(sim.act(near, { pet: "canela", action: "bailar" }, 60_000)).toBeNull();
  });
});
