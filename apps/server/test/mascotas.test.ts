import { buildArea, canStandAt, getWorld, isBlockedTile, portalAtTile, wallBetween, zoneAt, type OfficeMap } from "@hyvento/map";
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
const blank = (): PetView => ({ id: "", name: "", kind: "", coat: "", area: "", x: 0, y: 0, dir: "down", pose: "stand", ownerId: "", ownerName: "", love: 0 });

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
    const who = { userId: "u", area: "jardin", x: tobi.x - 5 * 32, y: tobi.y + 1 * 32 };
    expect(sim.call({ ...who, area: "planta-baja" }, { pet: "tobi" }, 0)).toMatchObject({ ok: false });
    expect(sim.call(who, { pet: "tobi" }, 0)).toMatchObject({ ok: true, action: "call" });
    let now = 0;
    for (let i = 0; i < 200 && sim.modeOf("tobi") === "walk"; i++) sim.tick((now += PET.tickMs), PET.tickMs);
    expect(Math.hypot(tobi.x - who.x, tobi.y - who.y)).toBeLessThanOrEqual(1.5 * 32);
    expect(tobi.pose).toBe("sit");
    // Lejísimos no oye.
    expect(sim.call({ ...who, x: who.x + 40 * 32 }, { pet: "tobi" }, now)).toMatchObject({ ok: false });
    expect(sim.call(who, { pet: "nadie" }, now)).toMatchObject({ ok: false });
  });

  it("se acaricia y se le da un premio solo de cerca, con pausa entre premios", () => {
    const { pets, sim } = setup(2);
    const canela = pets.get("canela")!;
    const near = { userId: "u", area: "planta-baja", x: canela.x + 32, y: canela.y };
    expect(sim.act({ ...near, x: canela.x + 5 * 32 }, { pet: "canela", action: "pet" }, 0)).toEqual({ ok: false, error: "far" });
    expect(sim.act(near, { pet: "canela", action: "pet" }, 0)).toMatchObject({ ok: true, action: "pet" });
    // Muy seguido, no (la pausa de acariciar).
    expect(sim.act(near, { pet: "canela", action: "pet" }, 500)).toMatchObject({ ok: false });
    expect(sim.act(near, { pet: "canela", action: "treat" }, 2_000)).toMatchObject({ ok: true, action: "treat" });
    expect(canela.pose).toBe("eat");
    expect(sim.act(near, { pet: "canela", action: "treat" }, 5_000)).toEqual({ ok: false, error: "fed" });
    expect(sim.act(near, { pet: "canela", action: "treat" }, 2_000 + PET.treatCooldownMs)).toMatchObject({ ok: true, action: "treat" });
    expect(sim.act(near, { pet: "canela", action: "bailar" }, 60_000)).toMatchObject({ ok: false });
  });

  it("llamar tiene pausa por persona (cada llamada suena en todo el nivel)", () => {
    const { pets, sim } = setup(2);
    const tobi = pets.get("tobi")!;
    const who = { userId: "u", area: "jardin", x: tobi.x - 4 * 32, y: tobi.y + 32 };
    expect(sim.call(who, { pet: "tobi" }, 0)).toMatchObject({ ok: true, action: "call" });
    expect(sim.call(who, { pet: "tobi" }, 500)).toEqual({ ok: false, error: "busy" });
    // Otra persona sí puede, y la misma pasada la pausa.
    expect(sim.call({ ...who, userId: "v" }, { pet: "tobi" }, 500)).toMatchObject({ ok: true, action: "call" });
    expect(sim.call(who, { pet: "tobi" }, PET.callCooldownMs)).toMatchObject({ ok: true, action: "call" });
    // Muchas personas que pasaron no quedan guardadas para siempre.
    for (let i = 0; i < 200; i++) sim.call({ ...who, userId: `p${i}` }, { pet: "tobi" }, 10_000 + i * PET.callCooldownMs);
    expect(sim.pending).toBeLessThan(80);
  });

  it("si el editor pone un mueble encima y mueve la cama, se corre, sigue paseando y duerme en la cama nueva", () => {
    const pets = new Map<string, PetView>();
    const maps = new Map(world.areas);
    const sim = new Pets({ pets, create: blank, map: (a) => maps.get(a)!, rng: seeded(4) });
    sim.start(0);
    const canela = pets.get("canela")!;
    const def = PETS.find((d) => d.id === "canela")!;
    const base = world.areas.get("planta-baja")!;
    // Un tile libre a unos pasos para la cama nueva (dentro de su zona, sin portal ni oficina).
    let bed: { x: number; y: number } | undefined;
    for (let r = 3; r <= 6 && !bed; r++)
      for (let dx = -r; dx <= r && !bed; dx++) {
        const x = def.bed.x + dx;
        const y = def.bed.y + r;
        if (!isBlockedTile(base, x, y) && !portalAtTile(base, x, y) && zoneAt(base, x * 32 + 16, y * 32 + 16)?.type !== "office") bed = { x, y };
      }
    expect(bed).toBeDefined();
    const edited = buildArea({
      ...base.def,
      furniture: [...base.def.furniture.filter((f) => !(f.type === "pet-bed" && f.x === def.bed.x && f.y === def.bed.y)), { type: "radio", x: def.bed.x, y: def.bed.y }, { type: "pet-bed", x: bed!.x, y: bed!.y }],
    });
    expect(isBlockedTile(edited, def.bed.x, def.bed.y)).toBe(true);
    maps.set("planta-baja", edited);
    sim.rebuilt("planta-baja");
    expect(isBlockedTile(edited, Math.floor(canela.x / 32), Math.floor(canela.y / 32))).toBe(false);
    let slept = false;
    let moved = false;
    const start = { x: canela.x, y: canela.y };
    for (let now = 0, i = 0; i < 6000; i++) {
      now += PET.tickMs;
      sim.tick(now, PET.tickMs);
      expect(canStandAt(edited, canela.x, canela.y), `(${canela.x}, ${canela.y})`).toBe(true);
      if (canela.x !== start.x || canela.y !== start.y) moved = true;
      if (canela.pose === "sleep" && Math.floor(canela.x / 32) === bed!.x && Math.floor(canela.y / 32) === bed!.y) slept = true;
    }
    expect(moved).toBe(true);
    expect(slept).toBe(true);
  });

  it("si un mueble nuevo le tapa la ruta a mitad de camino, deja la ruta y no lo atraviesa", () => {
    const pets = new Map<string, PetView>();
    const maps = new Map(world.areas);
    const sim = new Pets({ pets, create: blank, map: (a) => maps.get(a)!, rng: seeded(9) });
    sim.start(0);
    const tobi = pets.get("tobi")!;
    const jardin = world.areas.get("jardin")!;
    const who = { userId: "u", area: "jardin", x: tobi.x - 6 * 32, y: tobi.y + 32 };
    expect(sim.call(who, { pet: "tobi" }, 0)).toMatchObject({ ok: true, action: "call" });
    let now = 0;
    sim.tick((now += PET.tickMs), PET.tickMs);
    expect(sim.modeOf("tobi")).toBe("walk");
    // Un mueble sólido justo en el tile al que va.
    const ahead = sim.nextStepOf("tobi")!;
    expect(ahead).toBeDefined();
    const edited = buildArea({ ...jardin.def, furniture: [...jardin.def.furniture, { type: "radio", x: ahead.x, y: ahead.y }] });
    expect(isBlockedTile(edited, ahead.x, ahead.y)).toBe(true);
    maps.set("jardin", edited);
    for (let i = 0; i < 400; i++) {
      sim.tick((now += PET.tickMs), PET.tickMs);
      expect(canStandAt(edited, tobi.x, tobi.y), `(${tobi.x}, ${tobi.y})`).toBe(true);
      expect([Math.floor(tobi.x / 32), Math.floor(tobi.y / 32)]).not.toEqual([ahead.x, ahead.y]);
    }
  });
});
