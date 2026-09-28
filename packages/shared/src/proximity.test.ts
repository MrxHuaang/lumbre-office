import { describe, expect, it } from "vitest";
import { canHear, hearing, HEARING_HYSTERESIS, type Positioned } from "./proximity";
import { PROXIMITY_RADIUS, VOICE_RADIUS } from "./protocol";

const at = (x: number, y: number, zoneId: string | null = null, zoneIsolated = false): Positioned => ({
  x,
  y,
  zoneId,
  zoneIsolated,
});

describe("canHear", () => {
  it("en zonas abiertas depende de la distancia", () => {
    expect(canHear(at(0, 0, "lounge"), at(100, 0, "lounge"), 160)).toBe(true);
    expect(canHear(at(0, 0, "lounge"), at(200, 0, "lounge"), 160)).toBe(false);
    expect(canHear(at(0, 0), at(50, 50), 160)).toBe(true); // pasillo sin zona
  });

  it("dentro de una zona aislada se oyen todos, sin importar la distancia", () => {
    expect(canHear(at(0, 0, "meeting", true), at(900, 0, "meeting", true), 160)).toBe(true);
  });

  it("en niveles distintos no se oye aunque las coordenadas coincidan", () => {
    const a = { ...at(0, 0, "jardin"), area: "jardin" };
    const b = { ...at(10, 0, "recibidor"), area: "planta-baja" };
    expect(canHear(a, b, 160)).toBe(false);
    expect(hearing(a, new Map([["b", b]]), new Set(), 160).size).toBe(0);
  });

  it("no se oye a través de la pared de una zona aislada aunque estén cerca", () => {
    expect(canHear(at(0, 0, "office-1", true), at(10, 0, "lounge"), 160)).toBe(false);
    expect(canHear(at(0, 0, "lounge"), at(10, 0, "office-1", true), 160)).toBe(false);
    expect(canHear(at(0, 0, "office-1", true), at(10, 0, "office-2", true), 160)).toBe(false);
  });
});

describe("hearing", () => {
  const R = 160;

  it("por defecto la voz llega a una sala de distancia (más lejos que el chat de texto)", () => {
    expect(VOICE_RADIUS).toBeGreaterThanOrEqual(12 * 32);
    expect(VOICE_RADIUS).toBeGreaterThan(PROXIMITY_RADIUS);
    const others = new Map([
      ["otra-punta", at(16 * 32, 0)],
      ["sala-de-al-lado", at(12 * 32, 0)],
    ]);
    const h = hearing(at(0, 0), others);
    expect([...h.keys()]).toEqual(["sala-de-al-lado"]);
    expect(h.get("sala-de-al-lado")!).toBeGreaterThanOrEqual(0.15);
  });

  it("oye a quien está dentro del radio con volumen que baja con la distancia", () => {
    const others = new Map([
      ["cerca", at(10, 0, "lounge")],
      ["medio", at(120, 0, "lounge")],
      ["lejos", at(400, 0, "lounge")],
    ]);
    const h = hearing(at(0, 0, "lounge"), others, new Set(), R);
    expect([...h.keys()].sort()).toEqual(["cerca", "medio"]);
    expect(h.get("cerca")!).toBeGreaterThan(h.get("medio")!);
    expect(h.get("medio")!).toBeGreaterThanOrEqual(0.15);
  });

  it("aplica histéresis: quien ya se oía no se corta justo en el borde", () => {
    const others = new Map([["borde", at(R + HEARING_HYSTERESIS / 2, 0, "lounge")]]);
    expect(hearing(at(0, 0, "lounge"), others, new Set(), R).has("borde")).toBe(false);
    expect(hearing(at(0, 0, "lounge"), others, new Set(["borde"]), R).has("borde")).toBe(true);
  });

  it("en una zona aislada se oye a todos los de adentro a volumen completo y a nadie de afuera", () => {
    const others = new Map([
      ["adentro-lejos", at(300, 0, "meeting", true)],
      ["afuera-cerca", at(5, 0, "lounge")],
    ]);
    const h = hearing(at(0, 0, "meeting", true), others, new Set(), R);
    expect([...h.entries()]).toEqual([["adentro-lejos", 1]]);
  });
});
