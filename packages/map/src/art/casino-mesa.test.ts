import { rouletteWins, type RouletteBetSpec } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { AREAS, BLACKJACK_SEATS } from "../world/areas";
import { pocketAt } from "./casino";
import { blackjackFeltRect, rouletteFeltRect, tableZoom, TABLE_MAX_ZOOM, TABLE_MIN_ZOOM, wheelBowlRect, wheelZoom } from "./casino-camara";
import {
  BLACKJACK_ARC,
  BLACKJACK_SEAT_TILES,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  BLACKJACK_TRAY,
  ROULETTE_CELLS,
  ROULETTE_TOP_Z,
  blackjackInset,
  insideCell,
  rouletteCellAt,
  specKey,
} from "./casino-layout";
import {
  BLACKJACK_HANDS,
  artToLocal,
  betChips,
  blackjackArcBoxes,
  blackjackArcGlyphs,
  blackjackDealerPlan,
  blackjackHandPlan,
  boxesTouch,
  localToArt,
  localToScreen,
  mesaFrame,
  numbersFit,
  restPose,
  rouletteFeltOverlay,
  screenToLocal,
  spinPose,
  tagSprite,
  toCanvas,
  type ScreenBox,
} from "./casino-mesa";
import { GLYPH_H, textMask, textWidth } from "./digits";

const TAU = Math.PI * 2;
const sameAngle = (a: number, b: number) => Math.abs(((((a - b) % TAU) + TAU + Math.PI) % TAU) - Math.PI) < 1e-6;

describe("paño de la ruleta", () => {
  it("tiene una casilla por cada apuesta posible, sin repetir", () => {
    const all: RouletteBetSpec[] = [
      ...Array.from({ length: 37 }, (_, n) => ({ kind: "number" as const, n })),
      ...([1, 2, 3] as const).map((d) => ({ kind: "dozen" as const, d })),
      ...([1, 2, 3] as const).map((c) => ({ kind: "column" as const, c })),
      ...(["red", "black", "even", "odd", "low", "high"] as const).map((kind) => ({ kind })),
    ];
    const keys = ROULETTE_CELLS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(all.map(specKey).sort());
  });

  it("el clic en el centro de cada casilla (y donde va su ficha) cae en esa casilla", () => {
    for (const c of ROULETTE_CELLS) {
      expect(rouletteCellAt(c.text.u, c.text.v)?.key, c.key).toBe(c.key);
      expect(rouletteCellAt(c.chip.u, c.chip.v)?.key, c.key).toBe(c.key);
    }
  });

  it("la columna 2:1 de cada número es la que lo gana", () => {
    for (let n = 1; n <= 36; n++) {
      const cell = ROULETTE_CELLS.find((c) => c.key === `number:${n}`)!;
      const col = ROULETTE_CELLS.find((c) => c.spec.kind === "column" && c.u0 === cell.u0)!;
      expect(rouletteWins(col.spec, n), `${n}`).toBe(true);
    }
  });

  it("a R4 (el zoom mínimo del paño) cada número queda adentro de su casilla", () => {
    const R = TABLE_MIN_ZOOM / 2;
    const fr = mesaFrame({ x: 5, y: 3, facing: "right" });
    const ov = rouletteFeltOverlay(fr, R);
    for (const cell of ROULETTE_CELLS) {
      if (!cell.label) continue;
      // Los puntos prendidos de cada letra, donde los pone drawTextCentered, vueltos al paño.
      const p = toCanvas(ov, localToScreen(fr, cell.text.u, cell.text.v, ROULETTE_TOP_Z));
      const m = textMask(cell.label);
      const x0 = Math.round(p.x - textWidth(cell.label) / 2);
      const y0 = Math.round(p.y - GLYPH_H / 2);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          if (!m.on(x, y)) continue;
          const l = screenToLocal(fr, ov.sx + (x0 + x + 0.5) / R, ov.sy + (y0 + y + 0.5) / R, ROULETTE_TOP_Z);
          expect(insideCell(cell, l.u, l.v), `${cell.key} (${x},${y})`).toBe(true);
        }
    }
  });

  it("se dibuja con los números del mismo tamaño que el mueble", () => {
    const fr = mesaFrame({ x: 2, y: 3, facing: "right" });
    const ov = rouletteFeltOverlay(fr, 4);
    let lit = 0;
    for (let i = 3; i < ov.canvas.data.length; i += 4) if (ov.canvas.data[i]) lit++;
    expect(lit).toBeGreaterThan(ov.canvas.width * ov.canvas.height * 0.3);
  });
});

describe("marco de la mesa", () => {
  it("ida y vuelta entre lo local, el mundo y la pantalla, también espejada", () => {
    for (const facing of ["right", "down"]) {
      const fr = mesaFrame({ x: 5, y: 3, facing });
      const a = localToArt(fr, 10, 20);
      expect(artToLocal(fr, a.x, a.y)).toEqual({ u: 10, v: 20 });
      const s = localToScreen(fr, 10, 20, 14);
      const l = screenToLocal(fr, s.x, s.y, 14);
      expect(l.u).toBeCloseTo(10);
      expect(l.v).toBeCloseTo(20);
    }
  });
});

describe("giro de la rueda", () => {
  const T = 6000;

  it("empieza donde quedó la bola la ronda anterior y termina en el número que salió", () => {
    const start = spinPose(0, T, 8, 17, 32);
    const before = restPose(7, 32);
    expect(sameAngle(start.spin, before.spin)).toBe(true);
    expect(sameAngle(start.ball.a, before.ball!.a)).toBe(true);
    expect(start.ball.r).toBeCloseTo(before.ball!.r);

    const end = spinPose(T, T, 8, 17, 32);
    const after = restPose(8, 17);
    expect(sameAngle(end.spin, after.spin)).toBe(true);
    expect(sameAngle(end.ball.a, after.ball!.a)).toBe(true);
    expect(pocketAt(end.ball.a, end.spin).n).toBe(17);
  });

  it("la bola ya está en su casillero antes de que termine el giro, y va al revés que la rueda", () => {
    for (const result of [0, 5, 26, 36]) {
      const late = spinPose(T * 0.9, T, 3, result, 11);
      expect(pocketAt(late.ball.a, late.spin).n).toBe(result);
    }
    const a = spinPose(1000, T, 3, 5, 11);
    const b = spinPose(1016, T, 3, 5, 11);
    expect(b.spin).toBeGreaterThan(a.spin);
    expect(b.ball.a).toBeLessThan(a.ball.a);
  });

  it("los números solo se escriben si caben", () => {
    expect(numbersFit(2)).toBe(false);
    expect(numbersFit(8)).toBe(true);
  });
});

describe("encuadre del modo mesa", () => {
  const pano = rouletteFeltRect(mesaFrame({ x: 5, y: 3 }));
  const wheel = wheelBowlRect(mesaFrame({ x: 8, y: 3 }));
  const bj = blackjackFeltRect(mesaFrame({ x: 11, y: 4 }));
  // Ventanas de navegador típicas: laptop de 1366x768 (650 útiles), 1536x864 (730) y un monitor grande.
  const views = [650, 730, 950].map((h) => ({ w: 1366, h, strip: 170 }));

  it("la rueda siempre muestra los 37 números, también en laptops", () => {
    for (const view of [...views, { w: 1280, h: 600, strip: 170 }, { w: 1366, h: 650, strip: 260 }]) {
      const z = wheelZoom(view, wheel, tableZoom(view, pano, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM));
      expect(numbersFit(z.R), `${view.h}px`).toBe(true);
      // R entero: puntos de 1 o 2 píxeles parejos.
      expect([z.zoom, z.zoom / 2]).toContain(z.R);
    }
    expect(wheelZoom(views[0]!, wheel, 8).R).toBeGreaterThanOrEqual(7);
  });

  it("el paño y el blackjack van a R4 o más, con zoom par", () => {
    for (const view of views) {
      for (const rect of [pano, bj]) {
        const z = tableZoom(view, rect, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM);
        expect(z % 2).toBe(0);
        expect(z).toBeGreaterThanOrEqual(8);
      }
    }
    // Con 650 px de alto el paño entra entero a zoom 8 (antes, encuadrando toda la mesa, quedaba en 6).
    expect(pano.h * 8).toBeLessThanOrEqual(650 - 170);
    expect(tableZoom(views[0]!, bj, TABLE_MIN_ZOOM, TABLE_MAX_ZOOM)).toBe(10);
  });
});

describe("blackjack", () => {
  const sotano = AREAS.find((a) => a.id === "sotano")!;
  const table = sotano.furniture.find((f) => f.type === "blackjack-table")!;

  it("las banquetas del sótano son las que usa el dibujo de la mesa", () => {
    expect(table.facing ?? "right").toBe("right");
    expect(BLACKJACK_SEATS.map((s) => [s.x - table.x, s.y - table.y])).toEqual(BLACKJACK_SEAT_TILES.map((t) => [...t]));
  });

  it("el círculo de apuesta de cada asiento es el más cercano a su banqueta", () => {
    BLACKJACK_SPOTS.forEach((spot, i) => {
      // En px de mundo (tiles de 32; el arte va a la mitad).
      const sx = (table.x * 16 + spot.u) * 2;
      const sy = (table.y * 16 + spot.v) * 2;
      const d = BLACKJACK_SEATS.map((s) => Math.hypot((s.x + 0.5) * 32 - sx, (s.y + 0.5) * 32 - sy));
      expect(d.indexOf(Math.min(...d)), `asiento ${i + 1}`).toBe(i);
    });
  });

  it("las cinco manos con tres cartas no se tocan entre ellas ni con el crupier (R4 a R6)", () => {
    const fr = mesaFrame({ x: 0, y: 0 });
    for (const R of [4, 5, 6]) {
      // El peor caso: todos doblaron la apuesta más alta y llevan la placa más ancha.
      const chip = betChips(100, R, true, 1);
      const pieces: { who: number; box: ScreenBox }[] = [];
      for (let i = 0; i < 5; i++) {
        const plan = blackjackHandPlan(fr, R, i, 3, chip, tagSprite(i % 2 ? "BJ+75" : "7/17"));
        for (const box of [plan.chipBox, plan.cardsBox, plan.tag]) pieces.push({ who: i, box });
        // Las cartas se apoyan en el paño y la placa no queda en el aire, fuera de la mesa.
        for (const c of plan.cards) {
          const l = screenToLocal(fr, c.x, c.y, BLACKJACK_TOP_Z);
          expect(blackjackInset(l.u, l.v), `cartas ${i + 1} R${R}`).toBeGreaterThan(0.5);
        }
        for (const x of [plan.tag.x, plan.tag.x + plan.tag.w]) {
          const l = screenToLocal(fr, x, plan.tag.y + plan.tag.h, BLACKJACK_TOP_Z);
          expect(blackjackInset(l.u, l.v), `placa ${i + 1} R${R}`).toBeGreaterThanOrEqual(0);
        }
      }
      const dealer = blackjackDealerPlan(fr, R, 3, tagSprite("21"));
      pieces.push({ who: 5, box: dealer.cardsBox }, { who: 5, box: dealer.tag });
      for (const a of pieces)
        for (const b of pieces) if (a.who < b.who) expect(boxesTouch(a.box, b.box), `R${R}: ${a.who + 1} con ${b.who + 1}`).toBe(false);
    }
  });

  it("las cartas de cada asiento quedan claramente junto a su ficha", () => {
    BLACKJACK_HANDS.forEach((h, i) => {
      const d = BLACKJACK_SPOTS.map((s) => Math.hypot(s.u - h.u, s.v - h.v));
      d.forEach((x, j) => j !== i && expect(d[i]!, `mano ${i + 1}`).toBeLessThan(x * 0.7));
    });
  });

  it("el texto del arco queda sobre el paño, fuera de la bandeja, y las dos líneas no se montan", () => {
    const fr = mesaFrame({ x: 0, y: 0 });
    const t = BLACKJACK_TRAY;
    for (const R of [4, 5, 6, 8]) {
      const glyphs = blackjackArcGlyphs(R);
      expect(glyphs.length, `R${R}`).toBeGreaterThan(0);
      for (const b of blackjackArcBoxes(R)) {
        for (const [x, y] of [
          [b.x, b.y],
          [b.x + b.w, b.y],
          [b.x, b.y + b.h],
          [b.x + b.w, b.y + b.h],
        ] as const) {
          const l = screenToLocal(fr, x, y, BLACKJACK_TOP_Z);
          expect(blackjackInset(l.u, l.v), `R${R}`).toBeGreaterThan(0);
          expect(l.u >= t.u0 && l.u < t.u1 && l.v >= t.v0 && l.v < t.v1, `R${R} bandeja`).toBe(false);
        }
      }
      // Con dos líneas: entre letras de una y otra hay al menos el alto de una letra y dos puntos.
      const { u: cu, v: cv } = BLACKJACK_ARC;
      const radius = (g: { u: number; v: number }) => Math.round(Math.hypot(g.u - cu, g.v - cv) * 100);
      const radii = [...new Set(glyphs.map(radius))];
      if (radii.length === 2) {
        const [a, b] = radii.map((r) => glyphs.filter((g) => radius(g) === r).map((g) => localToScreen(fr, g.u, g.v, BLACKJACK_TOP_Z)));
        const gaps = a!.flatMap((p) => b!.filter((q) => Math.abs(q.x - p.x) < 6 / R).map((q) => Math.abs(q.y - p.y)));
        expect(Math.min(...gaps) * R, `R${R}`).toBeGreaterThanOrEqual(GLYPH_H + 2);
      }
    }
  });
});
