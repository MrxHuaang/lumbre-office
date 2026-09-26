import { describe, expect, it } from "vitest";
import { HAIR_STYLES, Look, TOPS } from "./look";
import {
  colorDistance,
  HAIR_CLIPS,
  HATS,
  headItemsFor,
  MIN_COLOR_DISTANCE,
  NECK_TIES,
  neckItemsFor,
  NO_TIE_TOPS,
  randomLook,
  seededRandom,
  TALL_HAIR,
} from "./look-random";

const SEEDS = Array.from({ length: 600 }, (_, i) => i * 7919 + 1);
const looks = SEEDS.map((s) => randomLook(seededRandom(s)));

describe("randomLook", () => {
  it("siempre es un Look válido y en el formato nuevo", () => {
    for (const look of looks) {
      const parsed = Look.safeParse(look);
      expect(parsed.success).toBe(true);
      expect(look.accessories).toEqual([]);
      // Todos los lugares quedan decididos (el editor no depende de los defectos).
      for (const key of ["eyes", "eyeColor", "top", "top2", "bottom", "shoes", "shoeColor", "head", "face", "neck", "back"] as const)
        expect(look[key]).toBeDefined();
    }
    // Con Math.random también.
    for (let i = 0; i < 100; i++) expect(Look.safeParse(randomLook()).success).toBe(true);
  });

  it("con la misma semilla sale el mismo personaje", () => {
    expect(randomLook(seededRandom(42))).toEqual(randomLook(seededRandom(42)));
    expect(randomLook(seededRandom(42))).not.toEqual(randomLook(seededRandom(43)));
  });

  it("nunca arma combinaciones rotas", () => {
    for (const look of looks) {
      if (TALL_HAIR.includes(look.hairStyle)) expect(HATS).not.toContain(look.head);
      if (look.hairStyle === "bald") expect(HAIR_CLIPS).not.toContain(look.head);
      if (NO_TIE_TOPS.includes(look.top!)) expect(NECK_TIES).not.toContain(look.neck);
      expect(colorDistance(look.shirt, look.pants)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      expect(colorDistance(look.shirt, look.top2!)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      expect(colorDistance(look.shirt, look.accent)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      expect(colorDistance(look.pants, look.accent)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
    }
  });

  it("sale variado: casi todos los peinados y partes de arriba, y a veces nada en la cabeza", () => {
    expect(new Set(looks.map((l) => l.hairStyle)).size).toBeGreaterThanOrEqual(HAIR_STYLES.length - 1);
    expect(new Set(looks.map((l) => l.top)).size).toBe(TOPS.length);
    expect(new Set(looks.map((l) => l.skin)).size).toBeGreaterThan(5);
    const bare = looks.filter((l) => l.head === "none").length;
    expect(bare).toBeGreaterThan(looks.length * 0.3);
    expect(bare).toBeLessThan(looks.length * 0.8);
  });
});

describe("reglas de combinación", () => {
  it("un peinado alto no lleva sombrero y un calvo no lleva moño ni flor", () => {
    expect(headItemsFor("mohawk")).not.toContain("cap");
    expect(headItemsFor("mohawk")).toContain("headphones");
    expect(headItemsFor("bald")).not.toContain("flower");
    expect(headItemsFor("bald")).toContain("beanie");
    expect(headItemsFor("short")).toHaveLength(9);
  });

  it("la camisa con corbata no lleva otra corbata", () => {
    expect(neckItemsFor("shirt-tie")).not.toContain("tie");
    expect(neckItemsFor("shirt-tie")).toContain("scarf");
    expect(neckItemsFor("polo")).toContain("bowtie");
  });
});
