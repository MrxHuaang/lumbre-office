import { rouletteWins, type RouletteBetSpec } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { pocketAt } from "./casino";
import { ROULETTE_CELLS, rouletteCellAt, specKey } from "./casino-layout";
import { artToLocal, localToArt, localToScreen, mesaFrame, numbersFit, restPose, rouletteFeltOverlay, screenToLocal, spinPose } from "./casino-mesa";

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
