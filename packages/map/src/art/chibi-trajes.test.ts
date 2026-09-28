import { COSTUME_DETAILS, COSTUME_IDS, COSTUMES, type CostumeId } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawCharacter, drawSitting, FRAME, HUMANS, SHEET_DIRECTIONS, type CharacterStyle } from "./chibi";
import { drawFloorDance, drawPoleDance, POLE_FRAME_H, POLE_FRAME_W, POLE_ROUTINE } from "./chibi-baile";
import type { PixelCanvas } from "./pixel";

// Trajes completos: cada uno se dibuja en las cuatro direcciones, caminando y sentado, cambia lo que se
// ve en todas las vistas y cabe en la celda (el gorro de chef y el sombrero de mago son altos).

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#4660a0", hairStyle: "short" };

function cell(sheet: PixelCanvas, col: number, row: number, w = FRAME, h = FRAME): number[] {
  const out: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((row * h + y) * sheet.width + col * w + x) * 4;
      out.push(sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!);
    }
  return out;
}
const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);
const opaque = (px: number[]) => px.filter((_, i) => i % 4 === 3 && px[i]! > 0).length;

/** ¿Algo pintado en el borde de la celda? (quedaría cortado). */
function touchesEdge(px: number[], w: number, h: number) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if ((x === 0 || x === w - 1 || y === 0) && px[(y * w + x) * 4 + 3]) return true;
  return false;
}

const wear = (costume: CostumeId, extra: Partial<CharacterStyle> = {}): CharacterStyle => ({ ...base, costume, ...extra });

describe("trajes completos del chibi", () => {
  it("cada traje cambia el dibujo en las cuatro direcciones, en los dos pasos y sentado", () => {
    const [walk0, sit0] = [drawCharacter(base), drawSitting(base)];
    for (const id of COSTUME_IDS) {
      const [walk, sit] = [drawCharacter(wear(id)), drawSitting(wear(id))];
      expect([walk.width, walk.height, sit.width, sit.height], id).toEqual([FRAME * 3, FRAME * 4, FRAME * 4, FRAME]);
      SHEET_DIRECTIONS.forEach((dir, row) => {
        for (const frame of [0, 1, 2]) {
          const px = cell(walk, frame, row);
          expect(opaque(px), `${id} ${dir} ${frame}`).toBeGreaterThan(150);
          expect(same(px, cell(walk0, frame, row)), `${id} ${dir} ${frame}`).toBe(false);
          expect(touchesEdge(px, FRAME, FRAME), `${id} ${dir} ${frame}: se sale`).toBe(false);
        }
        const s = cell(sit, row, 0);
        expect(same(s, cell(sit0, row, 0)), `${id} sentado ${dir}`).toBe(false);
        expect(touchesEdge(s, FRAME, FRAME), `${id} sentado ${dir}: se sale`).toBe(false);
      });
    }
  });

  it("los trajes se distinguen entre sí de frente y el dibujo es siempre el mismo", () => {
    const right = SHEET_DIRECTIONS.indexOf("right");
    const fronts = COSTUME_IDS.map((id) => cell(drawCharacter(wear(id)), 0, right));
    COSTUME_IDS.forEach((a, i) =>
      COSTUME_IDS.forEach((b, j) => {
        if (i < j) expect(same(fronts[i]!, fronts[j]!), `${a} = ${b}`).toBe(false);
      }),
    );
    for (const id of COSTUME_IDS) expect(same(drawCharacter(wear(id)).data, drawCharacter(wear(id)).data), id).toBe(true);
  });

  it("el traje tapa la ropa propia: da igual lo que se lleve debajo", () => {
    for (const id of COSTUME_IDS) {
      const a = drawCharacter(wear(id, { top: "hoodie", bottom: "skirt", outfit: "jacket", shoes: "sandals", pattern: "dots", shirt: "#5ea247" }));
      const b = drawCharacter(wear(id, { top: "tank", bottom: "shorts", shoes: "boots", pants: "#c05a4a", top2: "#ff00ff" }));
      expect(same(a.data, b.data), id).toBe(true);
    }
  });

  it("con «los míos» quedan el sombrero y los accesorios propios; el color del traje se puede cambiar", () => {
    for (const id of COSTUME_IDS) {
      const c = COSTUMES[id];
      const own = drawCharacter(wear(id, { costumeGear: false, head: "crown" }));
      const suit = drawCharacter(wear(id, { head: "crown" }));
      // Con los propios se ve la corona (el traje trae los suyos o nada).
      expect(same(own.data, suit.data), `${id}: accesorios`).toBe(false);
      if (c.tint) expect(same(drawCharacter(wear(id, { costumeColor: "#ff00ff" })).data, suit.data), `${id}: color`).toBe(false);
    }
  });

  it("cada detalle de traje lo usa algún traje", () => {
    for (const d of COSTUME_DETAILS) expect(COSTUME_IDS.some((id) => COSTUMES[id].details?.includes(d)), d).toBe(true);
  });

  it("los bailes también llevan el traje, sin salirse del frame", () => {
    for (const id of COSTUME_IDS) {
      const style = { ...HUMANS.eva, costume: id };
      const pole = drawPoleDance(style);
      for (let i = 0; i < POLE_ROUTINE.length; i++) {
        const px = cell(pole, i, 0, POLE_FRAME_W, POLE_FRAME_H);
        expect(opaque(px), `${id} tubo ${i}`).toBeGreaterThan(150);
        expect(touchesEdge(px, POLE_FRAME_W, POLE_FRAME_H), `${id} tubo ${i}`).toBe(false);
      }
      expect(same(drawFloorDance(style).data, drawFloorDance(HUMANS.eva).data), `${id} pista`).toBe(false);
    }
  });
});
