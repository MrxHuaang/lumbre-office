import { BUS_TIMINGS, busStopName } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BELL_MS, tripInfo, tripView, type BusTripState } from "./busTrip";

const t = BUS_TIMINGS;
const at = (phase: BusTripState["phase"], elapsed: number, nextAt = 0) => tripView({ phase, since: 1000, nextAt }, 1000 + elapsed, tripInfo({ phase, since: 1000, nextAt }));

describe("tripInfo", () => {
  it("hoy el bus vuelve a la Estación Hyvento en lo que dura la vuelta", () => {
    const info = tripInfo({ phase: "route", since: 0, nextAt: 0 });
    expect(info).toEqual({ stop: "estacion", durationMs: t.tripMs });
    expect(busStopName(info.stop)).toBe("Estación Hyvento");
  });
});

describe("tripView", () => {
  it("sale quieto, va a toda en la mitad y frena hasta pararse al llegar", () => {
    expect(at("route", 0).speed).toBe(0);
    expect(at("route", t.departMs / 2).speed).toBeCloseTo(0.5);
    expect(at("route", t.tripMs / 2).speed).toBe(1);
    expect(at("route", t.tripMs - t.approachMs / 2).speed).toBeCloseTo(0.5);
    expect(at("route", t.tripMs).speed).toBe(0);
  });

  it("la barra avanza con el viaje y nunca se pasa", () => {
    expect(at("route", 0).progress).toBe(0);
    expect(at("route", t.tripMs / 2).progress).toBeCloseTo(0.5);
    expect(at("route", t.tripMs * 2).progress).toBe(1);
    const a = at("route", 1000).progress;
    const b = at("route", 5000).progress;
    expect(b).toBeGreaterThan(a);
  });

  it("el timbre suena faltando poco y no antes", () => {
    expect(at("route", t.tripMs - BELL_MS - 1).bell).toBe(false);
    expect(at("route", t.tripMs - BELL_MS + 1).bell).toBe(true);
    expect(at("route", t.tripMs - 100).status).toBe("Parada solicitada");
    expect(at("route", 100).status).toBe("Saliendo");
    expect(at("route", t.tripMs / 2).status).toBe("En ruta");
  });

  it("parado en la estación: llegó, sin moverse y con la barra llena", () => {
    for (const phase of ["open", "closing"] as const) {
      const v = at(phase, 500);
      expect(v).toMatchObject({ arrived: true, speed: 0, progress: 1, etaMs: 0 });
    }
  });

  it("llegando en bus: frena con la llegada y cuenta lo que falta", () => {
    expect(at("arriving", 0).speed).toBe(1);
    expect(at("arriving", t.approachMs).speed).toBe(0);
    expect(at("arriving", 1000).etaMs).toBe(t.approachMs - 1000);
    // Esperando el bus que sale: va a toda y falta lo del horario más la llegada.
    const wait = tripView({ phase: "away", since: 0, nextAt: 11_000 }, 1000, tripInfo({ phase: "away", since: 0, nextAt: 11_000 }));
    expect(wait.speed).toBe(1);
    expect(wait.etaMs).toBe(10_000 + t.approachMs);
    expect(wait.arrived).toBe(false);
  });
});
