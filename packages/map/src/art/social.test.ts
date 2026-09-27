import { EMOTE_IDS } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawEmote, EMOTE_ART, EMOTE_H, EMOTE_W, emoteFrames } from "./emotes";
import { hex } from "./pixel";
import { giftBox, GIFT_BOX_FRAMES, wavingArm } from "./social";

const opaque = (c: { data: Uint8ClampedArray }) => c.data.filter((_, i) => i % 4 === 3 && c.data[i]! > 0).length;
const same = (a: { data: Uint8ClampedArray }, b: { data: Uint8ClampedArray }) => a.data.every((v, i) => v === b.data[i]);

describe("arte de emotes", () => {
  it("cada emote tiene dibujo animado de 2 a 4 frames, y nada sobra", () => {
    expect([...EMOTE_ART].sort()).toEqual([...EMOTE_IDS].sort());
    for (const id of EMOTE_IDS) {
      const { count, ms } = emoteFrames(id);
      expect(count, id).toBeGreaterThanOrEqual(2);
      expect(count, id).toBeLessThanOrEqual(4);
      expect(ms, id).toBeGreaterThan(0);
      const frames = Array.from({ length: count }, (_, f) => drawEmote(id, f));
      for (const f of frames) {
        expect([f.width, f.height]).toEqual([EMOTE_W, EMOTE_H]);
        expect(opaque(f), id).toBeGreaterThan(10);
      }
      // Se anima: el segundo frame no es igual al primero.
      expect(same(frames[0]!, frames[1]!), id).toBe(false);
    }
    expect(drawEmote("fuego").width).toBe(1);
  });

  it("la caja de regalo se sacude y se abre", () => {
    const frames = Array.from({ length: GIFT_BOX_FRAMES }, (_, f) => giftBox(f));
    for (let f = 1; f < frames.length; f++) expect(same(frames[f - 1]!, frames[f]!), `frame ${f}`).toBe(false);
  });

  it("el brazo que saluda alterna dos poses a cada lado", () => {
    for (const side of [-1, 1] as const) {
      const a = wavingArm(hex("#e76f51"), hex("#f1c27d"), 0, side);
      const b = wavingArm(hex("#e76f51"), hex("#f1c27d"), 1, side);
      expect(same(a.canvas, b.canvas)).toBe(false);
      expect(a.canvas.alphaAt(a.shoulder.x, a.shoulder.y)).toBe(255);
    }
  });
});
