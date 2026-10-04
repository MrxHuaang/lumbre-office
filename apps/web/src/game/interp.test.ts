import { describe, expect, it } from "vitest";
import { INTERP_DELAY_MS, INTERP_SEND_MS, INTERP_SNAP_PX, SnapshotBuffer } from "./interp";

const D = INTERP_DELAY_MS;

describe("interpolación de los otros jugadores", () => {
  it("sin muestras no hay posición; con una sola, se queda ahí", () => {
    const b = new SnapshotBuffer<string>();
    expect(b.sample(1000)).toBeNull();
    b.push(1000, 10, 20, "quieto");
    expect(b.sample(1000)).toEqual({ x: 10, y: 20, state: "quieto" });
    expect(b.sample(5000)).toEqual({ x: 10, y: 20, state: "quieto" });
  });

  it("dibuja 100 ms atrás, en línea recta entre las dos muestras que rodean ese momento", () => {
    const b = new SnapshotBuffer<string>();
    b.push(1000, 0, 0, "a");
    b.push(1050, 10, 0, "b");
    b.push(1100, 20, 10, "c");
    // 1025 + 100: a mitad de camino entre a y b.
    expect(b.sample(1025 + D)).toEqual({ x: 5, y: 0, state: "a" });
    expect(b.sample(1050 + D)).toEqual({ x: 10, y: 0, state: "b" });
    expect(b.sample(1075 + D)).toEqual({ x: 15, y: 5, state: "b" });
    // Pasada la última: se queda en ella, sin adivinar hacia dónde seguía.
    expect(b.sample(1300 + D)).toEqual({ x: 20, y: 10, state: "c" });
  });

  it("el jitter de llegada no cambia el ritmo: la posición avanza siempre hacia adelante", () => {
    const b = new SnapshotBuffer<null>();
    // Pasos de 10 px cada ~66 ms, con llegadas desparejas.
    const arrivals = [0, 50, 140, 200, 260, 345, 400];
    arrivals.forEach((t, i) => b.push(1000 + t, i * 10, 0, null));
    let prev = -Infinity;
    for (let now = 1000 + D; now <= 1400 + D; now += 16) {
      const x = b.sample(now)!.x;
      expect(x).toBeGreaterThanOrEqual(prev);
      prev = x;
    }
    expect(prev).toBe(60);
  });

  it("los saltos grandes y los marcados se aplican directo", () => {
    const b = new SnapshotBuffer<string>();
    b.push(1000, 0, 0, "a");
    b.push(1066, 10, 0, "b");
    expect(b.push(1132, 10 + INTERP_SNAP_PX + 1, 0, "lejos")).toBe(true);
    // Ya está allá, sin pasar por el medio, aunque el retraso diga que todavía no llegó.
    expect(b.sample(1132)).toEqual({ x: 10 + INTERP_SNAP_PX + 1, y: 0, state: "lejos" });
    expect(b.size).toBe(1);

    expect(b.push(1200, 120, 0, "nivel nuevo", true)).toBe(true);
    expect(b.sample(1200)).toEqual({ x: 120, y: 0, state: "nivel nuevo" });
    // Un paso chico normal no es salto.
    expect(b.push(1266, 125, 0, "paso")).toBe(false);
  });

  it("al arrancar después de estar quieto, el primer paso se recorre en un envío y no de golpe", () => {
    const b = new SnapshotBuffer<string>();
    b.push(1000, 0, 0, "quieto");
    // Diez segundos quieto, y arranca.
    b.push(11_000, 10, 0, "camina");
    // Justo al llegar todavía se ve donde estaba.
    expect(b.sample(11_000)).toEqual({ x: 0, y: 0, state: "quieto" });
    // A mitad del envío, a mitad del paso (y ya caminando).
    const mid = b.sample(11_000 - INTERP_SEND_MS / 2 + D)!;
    expect(mid.x).toBeCloseTo(5);
    expect(mid.state).toBe("camina");
    expect(b.sample(11_000 + D)).toEqual({ x: 10, y: 0, state: "camina" });
  });

  it("dos muestras en el mismo instante: vale la última", () => {
    const b = new SnapshotBuffer<string>();
    b.push(1000, 0, 0, "a");
    b.push(1050, 10, 0, "b");
    b.push(1050, 12, 0, "c");
    expect(b.size).toBe(2);
    expect(b.latest()).toEqual({ t: 1050, x: 12, y: 0, state: "c" });
  });

  it("descarta lo viejo y no guarda más de la cuenta", () => {
    const b = new SnapshotBuffer<number>();
    for (let i = 0; i < 100; i++) b.push(1000 + i * 50, i, 0, i);
    expect(b.size).toBeLessThanOrEqual(32);
    b.sample(1000 + 99 * 50 + D);
    expect(b.size).toBe(1);
    expect(b.latest()?.state).toBe(99);
  });
});
