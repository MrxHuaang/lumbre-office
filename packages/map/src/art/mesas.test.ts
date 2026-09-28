import { BACCARAT_BETS, DADOS_TOTALS, HORSES, MESA_POINT, MESAS, validMesaBet } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { getWorld, pointsOfType } from "../index";
import { dieFaces, mesaFeltOverlay } from "./mesas";
import { mesaFrame } from "./casino-mesa";
import { MESA_CELLS, MESA_FURNITURE, baccaratInset, insideMesaCell, mesaCellAt } from "./mesas-layout";

const ALL_BETS = {
  baccarat: [...BACCARAT_BETS],
  dados: ["small", "big", "even", "odd", "triple", ...DADOS_TOTALS.map((t) => `t${t}`), ...[1, 2, 3, 4, 5, 6].map((n) => `d${n}`)],
  caballos: HORSES.map((_, i) => `h${i}`),
} as const;

describe("mesas de rondas compartidas", () => {
  it("cada mesa tiene una casilla por apuesta posible, sin repetir y sin encimarse", () => {
    for (const table of MESAS) {
      const cells = MESA_CELLS[table];
      expect(cells.map((c) => c.bet).sort(), table).toEqual([...ALL_BETS[table]].sort());
      for (const c of cells) {
        expect(validMesaBet(table, c.bet), c.bet).toBe(true);
        // El centro y el lugar de la ficha caen en la misma casilla.
        expect(mesaCellAt(table, (c.u0 + c.u1) / 2, (c.v0 + c.v1) / 2)?.bet).toBe(c.bet);
        expect(insideMesaCell(c, c.chip.u, c.chip.v), `${table} ${c.bet}`).toBe(true);
        for (const o of cells) if (o !== c) expect(c.u0 < o.u1 && o.u0 < c.u1 && c.v0 < o.v1 && o.v0 < c.v1, `${c.bet} y ${o.bet}`).toBe(false);
      }
    }
  });

  it("las casillas del baccarat quedan adentro del paño (fuera del cojín)", () => {
    for (const c of MESA_CELLS.baccarat) {
      expect(baccaratInset((c.u0 + c.u1) / 2, (c.v0 + c.v1) / 2)).toBeGreaterThan(2.4);
    }
  });

  it("las tres mesas están en el sótano con sus puntos pegados, y el paño se dibuja", () => {
    const map = getWorld().areas.get("sotano")!;
    for (const table of MESAS) {
      const f = map.furniture.find((x) => x.type === MESA_FURNITURE[table]);
      expect(f, table).toBeDefined();
      const pts = pointsOfType(map, MESA_POINT[table]);
      expect(pts.length).toBeGreaterThan(3);
      for (const p of pts) {
        // Cada punto toca la mesa (a un tile de su borde).
        const dx = Math.max(f!.x - p.tileX, 0, p.tileX - (f!.x + f!.w - 1));
        const dy = Math.max(f!.y - p.tileY, 0, p.tileY - (f!.y + f!.d - 1));
        expect(Math.max(dx, dy), `${table} ${p.tileX},${p.tileY}`).toBe(1);
      }
      const ov = mesaFeltOverlay(table, mesaFrame(f!), 4);
      expect(ov.canvas.width).toBeGreaterThan(100);
    }
  });

  it("el dado muestra tres caras vecinas (nunca una y su opuesta)", () => {
    for (let n = 1; n <= 6; n++) {
      const [t, l, r] = dieFaces(n);
      expect(new Set([t, l, r, 7 - t, 7 - l, 7 - r]).size).toBe(6);
    }
  });
});
