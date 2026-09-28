import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, STAT_KEYS } from "./achievements";
import {
  CONSTELLATIONS,
  MARSHMALLOW,
  SKY,
  doneness,
  explorationLog,
  radarSignals,
  rollHeat,
  rollStar,
  screenBearing,
  type SignalSource,
} from "./observatorio";

describe("fogata de malvaviscos", () => {
  it("se pasa de crudo a tostado, dorado y quemado a fuego normal", () => {
    expect(doneness(1000, 100)).toBe("crudo");
    expect(doneness(MARSHMALLOW.toastedAtMs, 100)).toBe("tostado");
    expect(doneness(MARSHMALLOW.goldenAtMs + 10, 100)).toBe("dorado");
    expect(doneness(MARSHMALLOW.burntAtMs, 100)).toBe("quemado");
  });

  it("con más calor todo pasa antes (el mismo tiempo quema)", () => {
    const t = MARSHMALLOW.goldenAtMs + 500;
    expect(doneness(t, 100)).toBe("dorado");
    expect(doneness(t, MARSHMALLOW.heatMax)).toBe("quemado");
    expect(doneness(t, MARSHMALLOW.heatMin)).toBe("tostado");
  });

  it("el calor sorteado queda entre el mínimo y el máximo", () => {
    expect(rollHeat(() => 0)).toBe(MARSHMALLOW.heatMin);
    expect(rollHeat((n) => n - 1)).toBe(MARSHMALLOW.heatMax);
  });
});

describe("cielo del telescopio", () => {
  it("la estrella fugaz sale dentro del cielo y cruza hacia abajo", () => {
    for (const r of [() => 0, (n: number) => n - 1]) {
      const s = rollStar("s", 0, r);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(SKY.width);
      expect(s.y).toBeLessThan(SKY.height / 2);
      expect(Math.sin((s.angle * Math.PI) / 180)).toBeGreaterThan(0);
    }
  });

  it("las constelaciones tienen nombres propios y sus líneas unen estrellas que existen", () => {
    expect(new Set(CONSTELLATIONS.map((c) => c.name)).size).toBe(CONSTELLATIONS.length);
    for (const c of CONSTELLATIONS) {
      for (const [a, b] of c.lines) expect(c.stars[a] && c.stars[b], c.id).toBeTruthy();
      for (const [x, y] of c.stars) expect(x >= 0 && x < SKY.width && y >= 0 && y < SKY.height, c.id).toBe(true);
    }
  });
});

describe("radar de señales", () => {
  const src = (id: string, x: number, y: number, loudness = 1): SignalSource => ({ id, label: id, kind: "persona", x, y, loudness });

  it("la dirección es la de la pantalla: +x del mundo queda abajo a la derecha", () => {
    expect(screenBearing({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(26.57, 1);
    expect(screenBearing({ x: 0, y: 0 }, { x: -10, y: -10 })).toBeCloseTo(270, 5);
  });

  it("suena más fuerte lo que queda hacia donde se apunta, y lo cercano más que lo lejano", () => {
    const origin = { x: 0, y: 0 };
    const up = src("arriba", -10, -10);
    const right = src("derecha", 10, -10);
    const aimUp = radarSignals(origin, 270, [up, right]);
    expect(aimUp[0]!.source.id).toBe("arriba");
    expect(radarSignals(origin, screenBearing(origin, right), [up, right])[0]!.source.id).toBe("derecha");
    const near = radarSignals(origin, 270, [src("cerca", -3, -3)])[0]!.strength;
    const far = radarSignals(origin, 270, [src("lejos", -30, -30)])[0]!.strength;
    expect(near).toBeGreaterThan(far);
  });
});

describe("diario de exploración", () => {
  it("marca lo descubierto según los contadores y cada página apunta a un logro que existe", () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    const empty = explorationLog({});
    expect(empty.every((e) => !e.found)).toBe(true);
    for (const e of empty) if (e.achievementId) expect(ids.has(e.achievementId), e.id).toBe(true);
    const log = explorationLog({ "visit:observatorio": 1, [STAT_KEYS.shootingStars]: 2, [STAT_KEYS.mythicFish]: 1 });
    const found = log.filter((e) => e.found).map((e) => e.id);
    expect(found).toEqual(expect.arrayContaining(["lugar-observatorio", "cielo-fugaz", "lago-raro"]));
    expect(found).not.toContain("cielo-deseo");
  });
});
