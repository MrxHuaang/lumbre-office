import { describe, expect, it } from "vitest";
import { MSG_RATE, newBucket, takeToken } from "./limite-mensajes";
import { MOVE_SEND_HZ } from "./protocol";

describe("límite de mensajes (balde de fichas)", () => {
  it("deja pasar la ráfaga del balde y corta lo que sobra", () => {
    const cfg = { perSecond: 10, burst: 5 };
    const b = newBucket(0, cfg);
    const passed = Array.from({ length: 8 }, () => takeToken(b, 0, cfg)).filter(Boolean).length;
    expect(passed).toBe(5);
  });

  it("recupera fichas con el tiempo, sin pasarse del balde", () => {
    const cfg = { perSecond: 10, burst: 5 };
    const b = newBucket(0, cfg);
    for (let i = 0; i < 5; i++) takeToken(b, 0, cfg);
    expect(takeToken(b, 0, cfg)).toBe(false);
    // 100 ms a 10/s = una ficha.
    expect(takeToken(b, 100, cfg)).toBe(true);
    expect(takeToken(b, 100, cfg)).toBe(false);
    // Mucho rato quieto: el balde se llena, pero no más.
    const passed = Array.from({ length: 20 }, () => takeToken(b, 60_000, cfg)).filter(Boolean).length;
    expect(passed).toBe(5);
  });

  it("un reloj que va para atrás no regala fichas", () => {
    const cfg = { perSecond: 10, burst: 1 };
    const b = newBucket(1_000, cfg);
    expect(takeToken(b, 1_000, cfg)).toBe(true);
    expect(takeToken(b, 0, cfg)).toBe(false);
  });

  it("un cliente honesto (movimiento + hockey, por un minuto) nunca pierde un mensaje", () => {
    const b = newBucket(0);
    let dropped = 0;
    // Posición a 15/s y el mazo del hockey cada 30 ms, a la vez (peor caso honesto).
    const times: number[] = [];
    for (let t = 0; t < 60_000; t += 1000 / MOVE_SEND_HZ) times.push(t);
    for (let t = 0; t < 60_000; t += 30) times.push(t);
    times.sort((a, z) => a - z);
    for (const t of times) if (!takeToken(b, t)) dropped++;
    expect(dropped).toBe(0);
  });

  it("quien inunda a 1000/s se queda con el ritmo permitido", () => {
    const b = newBucket(0);
    let passed = 0;
    for (let t = 0; t < 10_000; t++) if (takeToken(b, t)) passed++;
    expect(passed).toBeLessThanOrEqual(MSG_RATE.burst + MSG_RATE.perSecond * 10);
    expect(passed).toBeGreaterThanOrEqual(MSG_RATE.perSecond * 10);
  });
});
