import { describe, expect, it } from "vitest";
import { HAIR_STYLES, HEAD_ITEMS, isSwimwear, Look, TOPS } from "./look";
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
  shoesTouchSkin,
  SWIM_NECK_ITEMS,
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
      // El zapato no se funde con el pantalón ni, si queda a la vista, con la pierna o el pie.
      expect(colorDistance(look.shoeColor!, look.pants)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
      if (shoesTouchSkin({ bottom: look.bottom!, shoes: look.shoes!, outfit: look.outfit }))
        expect(colorDistance(look.shoeColor!, look.skin)).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
    }
  });

  it("los trajes de baño salen muy poco, sin corbata ni bufanda y de un color que no se funde con la piel", () => {
    const many = Array.from({ length: 3000 }, (_, i) => randomLook(seededRandom(i * 104729 + 7)));
    const swim = many.filter((l) => isSwimwear(l.outfit));
    expect(swim.length).toBeGreaterThan(0);
    expect(swim.length).toBeLessThan(many.length * 0.05);
    for (const look of swim) {
      expect(SWIM_NECK_ITEMS).toContain(look.neck);
      const color = look.outfit === "trunks" ? look.pants : look.shirt;
      expect(colorDistance(color, look.skin), `${look.outfit} ${color} sobre ${look.skin}`).toBeGreaterThanOrEqual(MIN_COLOR_DISTANCE);
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
  it("un peinado alto no lleva sombrero y un calvo no lleva lazo ni flor", () => {
    expect(headItemsFor("mohawk")).not.toContain("cap");
    expect(headItemsFor("mohawk")).toContain("headphones");
    expect(headItemsFor("bald")).not.toContain("flower");
    expect(headItemsFor("bald")).toContain("beanie");
    expect(headItemsFor("short")).toHaveLength(HEAD_ITEMS.length);
  });

  it("los zapatos quedan junto a la piel salvo con pantalón largo y zapatos cerrados", () => {
    expect(shoesTouchSkin({ bottom: "pants", shoes: "sneakers" })).toBe(false);
    expect(shoesTouchSkin({ bottom: "pants", shoes: "boots", outfit: "jacket" })).toBe(false);
    expect(shoesTouchSkin({ bottom: "pants", shoes: "sandals" })).toBe(true);
    expect(shoesTouchSkin({ bottom: "pants", shoes: "boots", outfit: "dress" })).toBe(true);
    expect(shoesTouchSkin({ bottom: "shorts", shoes: "sneakers" })).toBe(true);
    expect(shoesTouchSkin({ bottom: "skirt", shoes: "boots" })).toBe(true);
    expect(shoesTouchSkin({ bottom: "pants", shoes: "sneakers", outfit: "trunks" })).toBe(true);
  });

  it("la camisa con corbata no lleva otra corbata", () => {
    expect(neckItemsFor("shirt-tie")).not.toContain("tie");
    expect(neckItemsFor("shirt-tie")).toContain("scarf");
    expect(neckItemsFor("polo")).toContain("bowtie");
    // Con el pecho al aire solo el collar.
    expect(neckItemsFor("polo", "bikini")).toEqual(["none", "necklace"]);
    expect(neckItemsFor("polo", "jacket")).toContain("bowtie");
  });
});
