import { describe, expect, it } from "vitest";
import { BILL_DENOMINATIONS, BILL_FRAMES, BILL_H, BILL_W, billsFor, drawBill } from "./tips";

const opaque = (c: ReturnType<typeof drawBill>) => {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.alphaAt(x, y) > 0) n++;
  return n;
};

describe("billetes de las propinas", () => {
  it("cada denominación tiene sus tres frames, y el billete plano es el que más se ve", () => {
    for (const amount of BILL_DENOMINATIONS) {
      const frames = Array.from({ length: BILL_FRAMES }, (_, f) => drawBill(amount, f));
      for (const f of frames) {
        expect([f.width, f.height]).toEqual([BILL_W, BILL_H]);
        expect(opaque(f)).toBeGreaterThan(0);
      }
      expect(opaque(frames[0]!)).toBeGreaterThan(opaque(frames[1]!));
      expect(opaque(frames[1]!)).toBeGreaterThan(opaque(frames[2]!));
    }
  });

  it("los colores cambian con la denominación y más plata vuela en más billetes", () => {
    const i = (3 * BILL_W + 2) * 4;
    const px = (amount: number) => [...drawBill(amount).data.slice(i, i + 3)].join();
    expect(new Set(BILL_DENOMINATIONS.map(px)).size).toBe(BILL_DENOMINATIONS.length);
    expect(BILL_DENOMINATIONS.map(billsFor)).toEqual([1, 2, 3, 5]);
  });
});
