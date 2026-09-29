// El fondo de un nivel con oficinas decoradas se arma con el del build (el del plano) y encima solo las
// salas que cambiaron: tiene que salir igual, píxel por píxel, que dibujar el nivel decorado entero.
import { describe, expect, it } from "vitest";
import type { AreaDecor } from "../decor";
import { decorateArea, getWorld } from "../index";
import type { PixelCanvas } from "./pixel";
import { drawAreaBase, drawAreaPatch } from "./room";

/** Píxeles distintos entre dos lienzos del mismo tamaño. */
function diff(a: PixelCanvas, b: PixelCanvas) {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
}

const opaque = (c: PixelCanvas) => c.data.filter((_, i) => i % 4 === 3 && c.data[i]! > 0).length;

describe("parche del fondo con oficinas decoradas", () => {
  const cases: [string, AreaDecor][] = [
    // Dos oficinas en esquinas opuestas del piso.
    ["piso-2", { "office-2": { items: null, floor: "wood", wallpaper: "rose" }, "office-4": { items: null, floor: "checker", wallpaper: "stripes" } }],
    // La oficina del garaje está dentro del taller (una sala dentro de otra).
    ["garaje", { "office-5": { items: null, floor: "wood", wallpaper: "rose" } }],
  ];

  it("sin salas cambiadas no hay parche", () => {
    expect(drawAreaPatch(getWorld().areas.get("piso-2")!, true, new Set())).toBeNull();
  });

  for (const [id, decor] of cases)
    for (const day of [true, false])
      it(`${id}: el fondo del plano con el parche encima es el fondo decorado (${day ? "día" : "noche"})`, () => {
        const def = getWorld().areas.get(id)!.def;
        const plain = decorateArea(def, {});
        const decorated = decorateArea(def, decor);
        const changed = new Set(decorated.def.rooms.flatMap((r, i) => (r.floor !== def.rooms[i]!.floor || r.wallpaper !== def.rooms[i]!.wallpaper ? [i] : [])));
        expect(changed.size).toBe(Object.keys(decor).length);

        const before = drawAreaBase(plain, day).base;
        const after = drawAreaBase(decorated, day).base;
        expect([after.ox, after.oy, after.canvas.width, after.canvas.height]).toEqual([before.ox, before.oy, before.canvas.width, before.canvas.height]);
        expect(diff(before.canvas, after.canvas)).toBeGreaterThan(500);

        const patch = drawAreaPatch(decorated, day, changed)!;
        // Pinta mucho menos que el nivel entero: es lo que se ahorra el navegador.
        expect(opaque(patch.canvas)).toBeLessThan(opaque(after.canvas) / 2);
        const dx = before.ox - patch.ox;
        const dy = before.oy - patch.oy;
        const d = patch.canvas.data;
        for (let y = 0; y < patch.canvas.height; y++)
          for (let x = 0; x < patch.canvas.width; x++) {
            const i = (y * patch.canvas.width + x) * 4;
            if (d[i + 3]) before.canvas.set(x + dx, y + dy, [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!]);
          }
        expect(diff(before.canvas, after.canvas)).toBe(0);
      });
});
