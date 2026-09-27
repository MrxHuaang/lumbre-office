import { DANCE_MOVE_IDS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { HUMANS } from "./chibi";
import { DANCE_FRAMES, drawFloorDance, drawPoleDance, FLOOR_MOVES, POLE_FRAME_H, POLE_FRAME_W, POLE_ROUTINE } from "./chibi-baile";
import { arcadeScreen, danceFloorLights, djBoothEq, FLOOR_LIGHT_PATTERNS, poleStageLights, speakerPulse } from "./club-vivo";
import type { PixelCanvas } from "./pixel";

/** Píxeles opacos de una celda de la hoja. */
function opaque(c: PixelCanvas, x0: number, y0: number, w: number, h: number) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (c.data[(y * c.width + x) * 4 + 3]) n++;
  return n;
}

describe("bailes del chibi", () => {
  it("la rutina del tubo tiene un frame por paso, todos con el personaje entero dentro", () => {
    // Dos frames por tiempo: la rutina cierra en tiempos enteros.
    expect(POLE_ROUTINE.length % 2).toBe(0);
    // Con todos los personajes (el pelo largo al viento y la pierna estirada llegan más lejos).
    for (const [who, style] of Object.entries(HUMANS)) {
      const sheet = drawPoleDance(style);
      expect(sheet.width).toBe(POLE_FRAME_W * POLE_ROUTINE.length);
      expect(sheet.height).toBe(POLE_FRAME_H);
      for (let i = 0; i < POLE_ROUTINE.length; i++) {
        expect(opaque(sheet, i * POLE_FRAME_W, 0, POLE_FRAME_W, POLE_FRAME_H), `${who} frame ${i}`).toBeGreaterThan(150);
        // Nada pegado al borde del frame (quedaría cortado).
        const edges = opaque(sheet, i * POLE_FRAME_W, 0, 1, POLE_FRAME_H) + opaque(sheet, i * POLE_FRAME_W + POLE_FRAME_W - 1, 0, 1, POLE_FRAME_H);
        expect(edges, `${who} frame ${i}`).toBe(0);
      }
    }
  });

  it("cada paso de la pista tiene sus frames y no son todos iguales", () => {
    const sheet = drawFloorDance(HUMANS.dario);
    expect(sheet.width).toBe(32 * DANCE_FRAMES);
    expect(sheet.height).toBe(32 * DANCE_MOVE_IDS.length);
    DANCE_MOVE_IDS.forEach((id, row) => {
      expect(FLOOR_MOVES[id]).toHaveLength(DANCE_FRAMES);
      const counts = [0, 1, 2, 3].map((col) => opaque(sheet, col * 32, row * 32, 32, 32));
      for (const n of counts) expect(n, id).toBeGreaterThan(150);
    });
  });
});

describe("capas del club", () => {
  it("cada capa pinta algo y los dibujos de la pista cambian", () => {
    const patterns = Array.from({ length: FLOOR_LIGHT_PATTERNS }, (_, p) => danceFloorLights(p));
    const signature = (s: { canvas: PixelCanvas }) => opaque(s.canvas, 0, 0, s.canvas.width, s.canvas.height);
    expect(new Set(patterns.map(signature)).size).toBeGreaterThan(3);
    for (const s of [poleStageLights(0), djBoothEq([1, 0.5]), speakerPulse(2), arcadeScreen("snake", 0), arcadeScreen("off", 1)]) expect(signature(s)).toBeGreaterThan(10);
  });
});
