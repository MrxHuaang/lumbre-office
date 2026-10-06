import { describe, expect, it } from "vitest";
import { DAR_PUNTOS, DarPuntosBody, darPuntosRef } from "./points";

describe("dar puntos desde /admin", () => {
  it("acepta enteros de 1 al tope, nada más", () => {
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: 50_000 }).success).toBe(true);
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: 1 }).success).toBe(true);
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: 0 }).success).toBe(false);
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: -5 }).success).toBe(false);
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: 2.5 }).success).toBe(false);
    expect(DarPuntosBody.safeParse({ userId: "u1", amount: DAR_PUNTOS.max + 1 }).success).toBe(false);
    expect(DarPuntosBody.safeParse({ userId: "", amount: 10 }).success).toBe(false);
  });

  it("los atajos caben en el tope y cada movimiento lleva su propio refId", () => {
    for (const a of DAR_PUNTOS.atajos) expect(a).toBeLessThanOrEqual(DAR_PUNTOS.max);
    expect(darPuntosRef("admin1", 1)).not.toBe(darPuntosRef("admin1", 2));
    expect(darPuntosRef("admin1", 1).startsWith("admin:dar:")).toBe(true);
  });
});
