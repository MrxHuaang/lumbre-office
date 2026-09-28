import { HOCKEY } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { mesaFrame } from "./casino-mesa";
import { hockeyRinkOverlay, hockeyRinkRect, HOCKEY_RINK, HOCKEY_TABLE, rinkColor, rinkToScreen, scoreboardPiece, screenToRink } from "./hockey";

const table = () => getWorld().areas.get("sotano")!.furniture.find((f) => f.type === "air-hockey")!;

describe("hockey de mesa (arte)", () => {
  it("la mesa del sótano mide lo que dice el arte y la cancha entra entera con sus bandas", () => {
    const t = table();
    expect([t.w * 16, t.d * 16]).toEqual([HOCKEY_TABLE.w, HOCKEY_TABLE.d]);
    expect(HOCKEY_RINK.u0).toBeGreaterThanOrEqual(2);
    expect(HOCKEY_RINK.v0).toBeGreaterThanOrEqual(2);
  });

  it("pantalla ↔ cancha van y vuelven al mismo punto (el mouse apunta donde se dibuja)", () => {
    const fr = mesaFrame(table());
    for (const [x, y] of [
      [0, 0],
      [13, 21],
      [HOCKEY.width, HOCKEY.length],
      [4.5, 37.25],
    ] as const) {
      const s = rinkToScreen(fr, x, y);
      const back = screenToRink(fr, s.x, s.y);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
    }
  });

  it("la cancha en alta resolución solo pinta la cancha, y la cámara la encuadra entera", () => {
    const fr = mesaFrame(table());
    const ov = hockeyRinkOverlay(fr, 4);
    const rect = hockeyRinkRect(fr);
    expect(ov.sx).toBeGreaterThanOrEqual(rect.x);
    expect(ov.sy).toBeGreaterThanOrEqual(rect.y);
    expect(ov.sx + ov.canvas.width / 4).toBeLessThanOrEqual(rect.x + rect.w + 1);
    expect(ov.sy + ov.canvas.height / 4).toBeLessThanOrEqual(rect.y + rect.h + 1);
    expect(rinkColor(-0.5, 10, true)).toBeNull();
    expect(rinkColor(10, HOCKEY.length + 0.1, true)).toBeNull();
    expect(rinkColor(10, 10, true)).not.toBeNull();
  });

  it("el marcador crece con los dígitos pero sigue siendo chico al lado de la mesa", () => {
    const one = scoreboardPiece(4, [3, 5]).canvas;
    const two = scoreboardPiece(4, [10, 12]).canvas;
    expect(two.width).toBeGreaterThan(one.width);
    expect(two.width / 4).toBeLessThan(HOCKEY_TABLE.d);
  });
});
