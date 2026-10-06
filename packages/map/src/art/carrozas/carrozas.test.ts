import { CARROZA_IDS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { CARROZA_TILES } from "../../carnaval";
import { cajaDeParte, carrozaArte, posesCarroza } from "./index";

describe("las carrozas del Carnaval (VIR-173)", () => {
  it("cada carroza tiene su plataforma y varias partes que se mueven, con pivotes y padres que existen", () => {
    for (const id of CARROZA_IDS) {
      const a = carrozaArte(id);
      expect(a.partes[0]?.id, id).toBe("plataforma");
      expect(a.partes.length, id).toBeGreaterThanOrEqual(6);
      expect(a.partes.filter((p) => p.mov).length, id).toBeGreaterThanOrEqual(3);
      const ids = new Set(a.partes.map((p) => p.id));
      expect(ids.size, `${id}: ids repetidos`).toBe(a.partes.length);
      for (const p of a.partes) if (p.padre) expect(ids.has(p.padre), `${id}/${p.id} → ${p.padre}`).toBe(true);
      // Cabe en su largo de la fila.
      expect(a.largo / 16, id).toBeLessThanOrEqual(CARROZA_TILES[id] + 0.01);
    }
  });

  it("son de colores (no blanco y negro): muchos tonos saturados", () => {
    for (const id of CARROZA_IDS) {
      const colores = new Set<string>();
      let saturados = 0;
      for (const p of carrozaArte(id).partes) {
        const d = p.canvas.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3]! < 200) continue;
          const [r, g, b] = [d[i]!, d[i + 1]!, d[i + 2]!];
          colores.add(`${r >> 4},${g >> 4},${b >> 4}`);
          if (Math.max(r, g, b) - Math.min(r, g, b) > 70) saturados++;
        }
      }
      expect(colores.size, id).toBeGreaterThan(60);
      expect(saturados, id).toBeGreaterThan(2000);
    }
  });

  it("lo que se mueve no se sale de la plataforma (a lo ancho), en ningún momento", () => {
    for (const id of CARROZA_IDS) {
      const a = carrozaArte(id);
      for (let ms = 0; ms < 12_000; ms += 137) {
        const poses = posesCarroza(a, ms);
        a.partes.forEach((p, i) => {
          if (!poses[i]!.visible) return;
          const c = cajaDeParte(p, poses[i]!);
          expect(c.x0, `${id}/${p.id} a los ${ms} ms`).toBeGreaterThanOrEqual(a.marco.x0);
          expect(c.x1, `${id}/${p.id} a los ${ms} ms`).toBeLessThanOrEqual(a.marco.x1);
        });
      }
    }
  });

  it("todos ven lo mismo (la pose depende solo de la hora) y con menos movimiento casi no se mueve", () => {
    const a = carrozaArte("reloj");
    expect(posesCarroza(a, 4321)).toEqual(posesCarroza(a, 4321));
    const quieto = posesCarroza(a, 0, 0.12);
    const luego = posesCarroza(a, 900, 0.12);
    quieto.forEach((q, i) => {
      expect(Math.abs(q.x - luego[i]!.x)).toBeLessThan(2);
      expect(Math.abs(q.y - luego[i]!.y)).toBeLessThan(2);
    });
    // Sin menos movimiento, algo sí se mueve.
    const mov = posesCarroza(a, 900);
    expect(posesCarroza(a, 0).some((q, i) => Math.abs(q.rot - mov[i]!.rot) > 0.01 || Math.abs(q.y - mov[i]!.y) > 0.5)).toBe(true);
  });
});
