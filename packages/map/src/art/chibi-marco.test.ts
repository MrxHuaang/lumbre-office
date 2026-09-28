import { HEAD_ITEMS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { SIT_BACK_ROWS, SIT_BASE_Z } from "../world/seats";
import { BODY_UP, BODY_X, BODY_Y, drawCharacter, drawSitting, FEET_Y, FRAME, HUMANS, SHEET_DIRECTIONS, SIT_DROP, type CharacterStyle } from "./chibi";
import { tone } from "./chibi/kit";
import type { PixelCanvas } from "./pixel";

// El tamaño del frame y dónde caen los pies, la cadera y la cabeza: de eso dependen los asientos
// (seats.ts), el nombre y lo que se lleva en la mano (Avatar.ts), los bailes y las miniaturas del editor.

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#4660a0", hairStyle: "short" };

/** Primera y última fila con algo pintado de una celda, y si algo toca los bordes de la celda. */
function extent(sheet: PixelCanvas, col: number, row: number) {
  let top = FRAME;
  let bottom = -1;
  let edge = false;
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!sheet.data[((row * FRAME + y) * sheet.width + col * FRAME + x) * 4 + 3]) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (x === 0 || x === FRAME - 1 || y === 0) edge = true;
    }
  return { top, bottom, edge };
}

const pixel = (sheet: PixelCanvas, col: number, row: number, x: number, y: number) => {
  const i = ((row * FRAME + y) * sheet.width + col * FRAME + x) * 4;
  return Array.from(sheet.data.slice(i, i + 4)).join();
};

describe("marco del chibi", () => {
  it("de pie, el contorno bajo las suelas cae justo en FEET_Y en todas las direcciones y pasos", () => {
    for (const style of [base, ...Object.values(HUMANS)]) {
      const sheet = drawCharacter(style);
      SHEET_DIRECTIONS.forEach((dir, row) => {
        // En los pasos se levanta un pie, pero el otro sigue apoyado.
        for (const frame of [0, 1, 2]) expect(extent(sheet, frame, row).bottom, `${dir}, paso ${frame}`).toBe(FEET_Y);
      });
    }
  });

  it("nada se sale de la celda: ni lo más alto de la cabeza ni los pies de sentado", () => {
    for (const head of HEAD_ITEMS)
      for (const hairStyle of ["afro", "mohawk", "short"] as const) {
        const style: CharacterStyle = { ...base, hairStyle, head };
        const walk = drawCharacter(style);
        const sit = drawSitting(style);
        SHEET_DIRECTIONS.forEach((dir, row) => {
          for (const frame of [0, 1, 2]) expect(extent(walk, frame, row).edge, `${head} con ${hairStyle}, ${dir}`).toBe(false);
          const s = extent(sit, row, 0);
          expect(s.edge, `${head} sentado, ${dir}`).toBe(false);
          expect(s.bottom, `${head} sentado, ${dir}`).toBeLessThan(FRAME);
        });
      }
  });

  it("sentado, la cintura queda 3 filas sobre FEET_Y: la altura de los asientos no depende del alto del chibi", () => {
    // La hoja de sentado está hecha para la silla (SIT_BASE_Z): lo que la ubica es la cadera, no la cabeza.
    expect(SIT_BASE_Z).toBe(11);
    expect(BODY_Y + 20 + SIT_DROP).toBe(FEET_Y - 3);
    const belt = tone(base.pants, -0.25).join();
    const sit = drawSitting({ ...base, top: "tshirt" });
    const right = SHEET_DIRECTIONS.indexOf("right");
    expect(pixel(sit, right, 0, BODY_X + 6, FEET_Y - 3)).toBe(belt);
  });

  it("sobre el respaldo se ven la cabeza y los hombros, y el respaldo empieza donde siempre", () => {
    // El respaldo tapa desde 6 filas sobre los pies de la hoja (así lo dibujan los muebles).
    expect(SIT_BACK_ROWS).toBe(FEET_Y - 6);
    // La cabeza entera (hasta el cuello, fila 12) queda arriba del corte, y también el hombro (fila 14).
    expect(BODY_Y + SIT_DROP + 14).toBeLessThan(SIT_BACK_ROWS);
  });

  it("las alturas del cuerpo que usa la cabaña van de la mano a la coronilla", () => {
    expect(BODY_UP.hand).toBeGreaterThan(0);
    expect(BODY_UP.hand).toBeLessThan(BODY_UP.shoulder);
    expect(BODY_UP.shoulder).toBeLessThan(BODY_UP.mouth);
    expect(BODY_UP.mouth).toBeLessThan(BODY_UP.crown);
    expect(BODY_UP.crown).toBeLessThan(FEET_Y);
    // La mano del frame quieto (brazo de adelante, columna 12 del cuerpo) es de piel.
    const skin = tone(base.skin, -0.3).join();
    const walk = drawCharacter(base);
    expect(pixel(walk, 0, SHEET_DIRECTIONS.indexOf("right"), BODY_X + 12, FEET_Y - BODY_UP.hand)).toBe(skin);
  });
});
