import { ACCESSORIES, HAIR_STYLES, OUTFITS, type Accessory } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawCharacter, drawSitting, FRAME, SHEET_DIRECTIONS, type CharacterStyle } from "./chibi";
import type { PixelCanvas } from "./pixel";

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#4660a0", hairStyle: "short" };

/** Píxeles de una celda de 32x32 de una hoja. */
function cell(sheet: PixelCanvas, col: number, row: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = ((row * FRAME + y) * sheet.width + col * FRAME + x) * 4;
      out.push(sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!);
    }
  return out;
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const RIGHT = SHEET_DIRECTIONS.indexOf("right");
const UP = SHEET_DIRECTIONS.indexOf("up");

/** ¿La prenda cambia el dibujo en todas las vistas (de frente y de espaldas, caminando y sentado)? */
function visibleEverywhere(style: CharacterStyle) {
  const walk0 = drawCharacter(base);
  const walk1 = drawCharacter(style);
  const sit0 = drawSitting(base);
  const sit1 = drawSitting(style);
  const views = {
    frente: !same(cell(walk0, 0, RIGHT), cell(walk1, 0, RIGHT)),
    espaldas: !same(cell(walk0, 0, UP), cell(walk1, 0, UP)),
    "paso de frente": [1, 2].every((f) => !same(cell(walk0, f, RIGHT), cell(walk1, f, RIGHT))),
    "paso de espaldas": [1, 2].every((f) => !same(cell(walk0, f, UP), cell(walk1, f, UP))),
    "sentado de frente": !same(cell(sit0, RIGHT, 0), cell(sit1, RIGHT, 0)),
    "sentado de espaldas": !same(cell(sit0, UP, 0), cell(sit1, UP, 0)),
  };
  return Object.entries(views)
    .filter(([, ok]) => !ok)
    .map(([v]) => v);
}

/** ¿Cambiar ese color del estilo cambia algún píxel, caminando o sentado? */
function usesColor(style: CharacterStyle, key: "pants" | "accent"): boolean {
  const other: CharacterStyle = { ...style, [key]: "#ff00ff" };
  return (
    !same([...drawCharacter(style).data], [...drawCharacter(other).data]) ||
    !same([...drawSitting(style).data], [...drawSitting(other).data])
  );
}

describe("personajes chibi", () => {
  it("cada peinado se distingue del corto en todas las vistas", () => {
    for (const hairStyle of HAIR_STYLES.filter((h) => h !== "short"))
      expect(visibleEverywhere({ ...base, hairStyle }), hairStyle).toEqual([]);
  });

  it("cada accesorio se ve de frente y de espaldas", () => {
    // Las gafas y la barba son de la cara: de espaldas casi no se ven (las gafas asoman por los lados).
    const faceOnly: Accessory[] = ["beard"];
    for (const a of ACCESSORIES) {
      const missing = visibleEverywhere({ ...base, accessories: [a] });
      expect(missing.filter((v) => !(faceOnly.includes(a) && v.includes("espaldas"))), a).toEqual([]);
    }
  });

  it("cada conjunto cambia el dibujo caminando y sentado", () => {
    for (const outfit of OUTFITS) expect(visibleEverywhere({ ...base, outfit }), outfit).toEqual([]);
  });

  it("cada prenda usa los colores que el editor deja elegir para ella", () => {
    // Tiene que coincidir con el editor (apps/web: CharacterEditor y ACCENT_ACCESSORIES / ACCENT_OUTFITS de
    // look-palette): con vestido no hay selector de pantalón y el de acento nombra lo que lo usa.
    const accentAccessories: Accessory[] = ["cap", "headphones", "beanie", "scarf"];
    const noAccent: CharacterStyle[] = [
      { ...base, accessories: [] },
      { ...base, hairStyle: "long", accessories: ACCESSORIES.filter((a) => !accentAccessories.includes(a)) },
    ];
    for (const plain of noAccent) {
      expect(usesColor(plain, "pants"), "sin conjunto, el pantalón").toBe(true);
      expect(usesColor(plain, "accent"), `sin nada de acento (${plain.accessories?.join(", ")})`).toBe(false);
      for (const outfit of OUTFITS) {
        expect(usesColor({ ...plain, outfit }, "pants"), `${outfit}: pantalón`).toBe(outfit !== "dress");
        expect(usesColor({ ...plain, outfit }, "accent"), `${outfit}: acento`).toBe(outfit === "jacket");
      }
    }
    for (const a of ACCESSORIES) expect(usesColor({ ...base, accessories: [a] }, "accent"), a).toBe(accentAccessories.includes(a));
  });

  it("el dibujo es determinista y la hoja mantiene su tamaño", () => {
    const style: CharacterStyle = { ...base, hairStyle: "afro", accessories: ["straw-hat", "flower", "scarf"], outfit: "dress" };
    const a = drawCharacter(style);
    expect(same([...a.data], [...drawCharacter(style).data])).toBe(true);
    expect([a.width, a.height]).toEqual([FRAME * 3, FRAME * 4]);
    const s = drawSitting(style);
    expect([s.width, s.height]).toEqual([FRAME * 4, FRAME]);
  });
});
