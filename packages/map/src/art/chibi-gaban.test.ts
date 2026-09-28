import { HAIR_STYLES, TOPS, PATTERNS, BOTTOMS, SHOES } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawCharacter, drawSitting, FEET_Y, FRAME, SHEET_DIRECTIONS, type CharacterStyle } from "./chibi";
import { tone } from "./chibi/kit";
import type { PixelCanvas } from "./pixel";

// El gabán, el chaleco y el sombrero de fieltro (los del Man del Sombrero y los crupieres del casino, que
// también puede ponerse cualquiera en el editor).

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#7d7f86", hairStyle: "short" };
const RIGHT = SHEET_DIRECTIONS.indexOf("right");
const UP = SHEET_DIRECTIONS.indexOf("up");

function cell(sheet: PixelCanvas, col: number, row: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = ((row * FRAME + y) * sheet.width + col * FRAME + x) * 4;
      out.push(sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!);
    }
  return out;
}
const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);

/** Color de un píxel del cuerpo (x de 0 a 15, fila del cuerpo) en la celda (col, row). */
function bodyPixel(sheet: PixelCanvas, col: number, row: number, x: number, bodyRow: number): string {
  const sx = col * FRAME + (FRAME - 16) / 2 + x;
  const sy = row * FRAME + FEET_Y - 24 + bodyRow;
  const i = (sy * sheet.width + sx) * 4;
  return Array.from(sheet.data.slice(i, i + 4)).join();
}

/** Las cuatro vistas que importan: de frente y de espaldas, quieto y sentado. */
const views = (s: CharacterStyle) => {
  const w = drawCharacter(s);
  const sit = drawSitting(s);
  return [cell(w, 0, RIGHT), cell(w, 0, UP), cell(w, 1, RIGHT), cell(w, 2, UP), cell(sit, RIGHT, 0), cell(sit, UP, 0)];
};

describe("gabán", () => {
  const coat: CharacterStyle = { ...base, outfit: "trenchcoat" };

  it("se ve en todas las vistas, caminando y sentado, con el color de acento", () => {
    const plain = views(base);
    views(coat).forEach((v, i) => expect(same(v, plain[i]!), `vista ${i}`).toBe(false));
    const recolored = views({ ...coat, accent: "#aa3355" });
    views(coat).forEach((v, i) => expect(same(v, recolored[i]!), `acento, vista ${i}`).toBe(false));
  });

  it("tapa la parte de arriba entera: ni el color, ni el patrón, ni la prenda cambian nada", () => {
    const ref = drawCharacter(coat).data;
    const refSit = drawSitting(coat).data;
    for (const top of TOPS)
      for (const pattern of PATTERNS) {
        const s: CharacterStyle = { ...coat, top, pattern, shirt: "#ff00ff", top2: "#00ff00" };
        expect(same(drawCharacter(s).data, ref), `${top} con ${pattern}`).toBe(true);
        expect(same(drawSitting(s).data, refSit), `${top} con ${pattern} sentado`).toBe(true);
      }
  });

  it("llega a las rodillas: de pie se ven las canillas con la parte de abajo y los zapatos", () => {
    const walk = drawCharacter(coat);
    const fabric = [tone(base.pants, -0.25), tone(base.pants, 0.1)].map((c) => c.join());
    expect(fabric).toContain(bodyPixel(walk, 0, RIGHT, 6, 21));
    // El faldón (fila 20) es del gabán, no del pantalón.
    expect(fabric).not.toContain(bodyPixel(walk, 0, RIGHT, 6, 20));
    for (const bottom of BOTTOMS)
      for (const shoes of SHOES) {
        const s = drawCharacter({ ...coat, bottom, shoes, shoeColor: "#ff00ff" });
        expect(same(s.data, drawCharacter({ ...coat, bottom, shoes }).data), `${bottom} con ${shoes}`).toBe(false);
      }
  });

  it("el cuello alzado sube a los lados de la quijada", () => {
    const walk = drawCharacter(coat);
    const accent = [tone(base.accent!, -0.3), tone(base.accent!, 0), tone(base.accent!, 0.25)].map((c) => c.join());
    expect(accent).toContain(bodyPixel(walk, 0, RIGHT, 4, 11));
  });
});

describe("chaleco", () => {
  it("se ve de frente y de espaldas y deja ver la camisa en la V y en las mangas", () => {
    const vest: CharacterStyle = { ...base, outfit: "vest", top: "longsleeve" };
    const plain = views({ ...base, top: "longsleeve" });
    views(vest).forEach((v, i) => expect(same(v, plain[i]!), `vista ${i}`).toBe(false));
    const shirt = [tone(base.shirt!, -0.3), tone(base.shirt!, 0), tone(base.shirt!, 0.25)].map((c) => c.join());
    const walk = drawCharacter(vest);
    // La V (fila 14 del torso, dos más por el margen de arriba) y el brazo de atrás con la manga.
    expect(shirt).toContain(bodyPixel(walk, 0, RIGHT, 7, 14));
    expect(shirt).toContain(bodyPixel(walk, 0, RIGHT, 3, 15));
  });
});

describe("sombrero de fieltro", () => {
  const hat: CharacterStyle = { ...base, head: "fedora" };

  it("se ve en todas las vistas con cualquier peinado y no usa el color de acento", () => {
    for (const hairStyle of HAIR_STYLES) {
      const plain = views({ ...base, hairStyle });
      views({ ...hat, hairStyle }).forEach((v, i) => expect(same(v, plain[i]!), `${hairStyle}, vista ${i}`).toBe(false));
    }
    expect(same(drawCharacter(hat).data, drawCharacter({ ...hat, accent: "#ff00ff" }).data)).toBe(true);
  });

  it("deja la frente en sombra bajo el ala", () => {
    // La fila de debajo del ala queda más oscura que sin sombrero (la cara en sombra del Man del Sombrero).
    const lum = (s: string) => s.split(",").slice(0, 3).reduce((a, v) => a + Number(v), 0);
    const bare = drawCharacter({ ...base, hairStyle: "buzz" });
    const worn = drawCharacter({ ...hat, hairStyle: "buzz" });
    let darker = 0;
    for (let x = 4; x <= 11; x++) if (lum(bodyPixel(worn, 0, RIGHT, x, 5)) < lum(bodyPixel(bare, 0, RIGHT, x, 5))) darker++;
    expect(darker).toBeGreaterThan(4);
  });
});
