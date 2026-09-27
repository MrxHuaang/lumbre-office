import { COUNTER_MAX, PETS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { curtainFeature, curtainsOf, getWorld } from "../index";
import { curtainClosed, flame, FLAME_FRAMES, globeSpin, progressLayer } from "./casa-fx";
import { drawPet, PET_FRAME, PET_POSE_FRAMES, type PetArtPose } from "./mascotas";
import type { PixelCanvas } from "./pixel";

const opaque = (c: PixelCanvas) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("arte de la casa viva", () => {
  it("cada mascota tiene todos sus cuadros, parada sobre sus pies y distintos al caminar", () => {
    for (const pet of PETS) {
      for (const pose of Object.keys(PET_POSE_FRAMES) as PetArtPose[])
        for (const view of ["front", "back"] as const)
          for (let f = 0; f < PET_POSE_FRAMES[pose]; f++) {
            const c = drawPet(pet.kind, pet.coat, pose, view, f);
            expect(c.width).toBe(PET_FRAME.w);
            expect(opaque(c), `${pet.id} ${pose} ${view} ${f}`).toBeGreaterThan(40);
            // Algo del dibujo toca la fila de los pies (no flota).
            let feet = 0;
            for (let x = 0; x < c.width; x++) if (c.alphaAt(x, PET_FRAME.feetY - 1) >= 160) feet++;
            expect(feet, `${pet.id} ${pose}`).toBeGreaterThan(0);
          }
      const a = drawPet(pet.kind, pet.coat, "walk", "front", 0).data;
      const b = drawPet(pet.kind, pet.coat, "walk", "front", 1).data;
      expect(a.some((v, i) => v !== b[i])).toBe(true);
    }
  });

  it("la llama se mueve de un cuadro a otro y avivada es más grande", () => {
    const frames = Array.from({ length: FLAME_FRAMES }, (_, f) => flame(f, "pit").canvas);
    expect(new Set(frames.map((c) => Buffer.from(c.data).toString("base64"))).size).toBe(FLAME_FRAMES);
    expect(opaque(flame(0, "stoked").canvas)).toBeGreaterThan(opaque(flame(0, "pit").canvas));
    expect(opaque(flame(0, "hearth-stoked").canvas)).toBeGreaterThan(opaque(flame(0, "hearth").canvas));
  });

  it("el puzle, la pizarra y el caballete avanzan con el contador", () => {
    for (const type of ["puzzle-table", "cafe-sign", "easel"]) {
      const max = COUNTER_MAX[type]!;
      expect(progressLayer(type, 0, max)).toBeNull();
      let last = 0;
      for (const n of [1, Math.ceil(max / 2), max]) {
        const layer = progressLayer(type, n, max);
        expect(layer, `${type} ${n}`).not.toBeNull();
        const painted = opaque(layer!.canvas);
        expect(painted, `${type} ${n}`).toBeGreaterThanOrEqual(last);
        last = painted;
      }
      expect(last, type).toBeGreaterThan(5);
    }
  });

  it("el globo gira (los colores de la esfera se corren) y cada ventana tiene su cortina cerrada", () => {
    const a = globeSpin(0).canvas.data;
    const b = globeSpin(3).canvas.data;
    expect(a.some((v, i) => v !== b[i])).toBe(true);
    for (const map of getWorld().areas.values())
      for (const c of curtainsOf(map)) {
        const f = curtainFeature(map, c)!;
        expect(opaque(curtainClosed(f.edge, f.width ?? 1).canvas)).toBeGreaterThan(100);
      }
  });
});
