import { describe, expect, it } from "vitest";
import { getWorld } from "../index";
import { EVENT_SPOTS, eventOverlays, focusTomato, KARAOKE_SIGN, partyHat, singerMic } from "./eventos";

const painted = (c: { data: Uint8ClampedArray }) => {
  let n = 0;
  for (let i = 3; i < c.data.length; i += 4) if (c.data[i]) n++;
  return n;
};

describe("arte de los eventos", () => {
  it("lo de sobre la cabeza es chiquito y tiene dibujo", () => {
    for (const s of [partyHat(), focusTomato(), singerMic()]) {
      expect(s.width).toBeLessThanOrEqual(10);
      expect(s.height).toBeLessThanOrEqual(12);
      expect(painted(s)).toBeGreaterThan(10);
    }
  });

  it("cada evento pone lo suyo solo en su nivel", () => {
    expect(eventOverlays("planta-baja", { birthday: true, karaoke: true }).map((o) => o.key)).toEqual(["evento-pastel"]);
    expect(eventOverlays("sotano", { birthday: true, karaoke: true }).map((o) => o.key).sort()).toEqual(["evento-microfono", "evento-neon-karaoke"]);
    expect(eventOverlays("sotano", { birthday: false, karaoke: false })).toEqual([]);
    for (const o of eventOverlays("sotano", { birthday: false, karaoke: true })) expect(painted(o.sprite.canvas)).toBeGreaterThan(50);
  });

  it("el pastel va sobre una mesa de la cafetería, el micrófono en la tarima y el neón en una pared alta del club", () => {
    const pb = getWorld().areas.get(EVENT_SPOTS.cake.area)!;
    expect(pb.furniture.some((f) => f.type === "cafe-table" && f.x === EVENT_SPOTS.cake.x && f.y === EVENT_SPOTS.cake.y)).toBe(true);
    const sotano = getWorld().areas.get(EVENT_SPOTS.mic.area)!;
    const stage = sotano.furniture.find((f) => f.type === "pole-stage")!;
    expect(EVENT_SPOTS.mic.x).toBeGreaterThanOrEqual(stage.x);
    expect(EVENT_SPOTS.mic.x).toBeLessThan(stage.x + stage.w);
    expect(EVENT_SPOTS.mic.y).toBeGreaterThanOrEqual(stage.y);
    expect(EVENT_SPOTS.mic.y).toBeLessThan(stage.y + stage.d);
    for (let x = KARAOKE_SIGN.x; x < KARAOKE_SIGN.x + KARAOKE_SIGN.width; x++) expect(sotano.wallH[KARAOKE_SIGN.y * sotano.width + x], `pared en x=${x}`).toBe(2);
  });
});
