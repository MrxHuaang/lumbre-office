import { BUS, BUS_TIMINGS, type BusPhase } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BusLine } from "../src/rooms/bus";

/** Reloj falso: los temporizadores se disparan al avanzar la hora a mano. */
function fakeTime(start = 1_000_000) {
  let now = start;
  const timers: { at: number; fn: () => void; cleared: boolean }[] = [];
  return {
    now: () => now,
    clock: {
      setTimeout(fn: () => void, ms: number) {
        const t = { at: now + ms, fn, cleared: false };
        timers.push(t);
        return { clear: () => void (t.cleared = true) };
      },
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers.filter((t) => !t.cleared && t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        next.cleared = true;
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

const T = BUS_TIMINGS;
const OPEN_AT = T.approachMs;
const SCHEDULE = { firstInMs: 20_000, maxWaitMs: 15_000 };

function setup(minuteOfDay = 10 * 60) {
  const time = fakeTime();
  let minute = minuteOfDay;
  let riders = 0;
  /** Cuántos de los de a bordo van a su casa (el resto va a la estación). */
  let home = 0;
  let arrivedHome = 0;
  const phases: BusPhase[] = [];
  const bus = new BusLine({
    clock: time.clock,
    now: time.now,
    minuteOfDay: () => minute,
    timings: () => T,
    schedule: () => SCHEDULE,
    riders: () => riders,
    homeRiders: () => home,
    arriveHome: () => {
      // Los que van a su casa se bajan; quedan los que van a la estación.
      arrivedHome += home;
      riders -= home;
      home = 0;
      return riders;
    },
    onChange: (s) => {
      if (phases.at(-1) !== s.phase) phases.push(s.phase);
    },
  });
  bus.start();
  return {
    time,
    bus,
    phases,
    setMinute: (m: number) => void (minute = m),
    setRiders: (n: number) => void (riders = n),
    /** `n` a bordo, `toHome` de ellos van a su casa. */
    board: (n: number, toHome: number) => {
      riders = n;
      home = toHome;
    },
    arrivedHome: () => arrivedHome,
  };
}

describe("horario del Megabús", () => {
  it("el primer bus llega al rato de abrir la sala, abre, cierra y sigue de largo si va vacío", () => {
    const { time, bus, phases } = setup();
    expect(bus.phase).toBe("away");
    time.advance(SCHEDULE.firstInMs - 1);
    expect(bus.phase).toBe("away");
    time.advance(1);
    expect(bus.phase).toBe("arriving");
    expect(bus.doorsOpen()).toBe(false);
    time.advance(OPEN_AT);
    expect(bus.phase).toBe("open");
    expect(bus.doorsOpen()).toBe(false); // las puertas se están abriendo
    time.advance(T.doorsMs);
    expect(bus.doorsOpen()).toBe(true);
    time.advance(T.openMs - T.doorsMs + T.closingMs + T.departMs);
    expect(phases).toEqual(["away", "arriving", "open", "closing", "leaving", "away"]);
  });

  it("de día (horario laboral del juego) pasa cada 3 minutos reales y de noche cada 10", () => {
    const day = setup(9 * 60);
    day.time.advance(SCHEDULE.firstInMs);
    const first = day.bus.since;
    expect(day.bus.nextAt - first).toBe(BUS.dayEveryMs);
    day.time.advance(BUS.dayEveryMs);
    expect(day.bus.phase).toBe("arriving");
    expect(day.bus.run).toBe(2);

    const night = setup(22 * 60);
    night.time.advance(SCHEDULE.firstInMs);
    expect(night.bus.nextAt - night.bus.since).toBe(BUS.nightEveryMs);
    night.time.advance(BUS.dayEveryMs);
    expect(night.bus.run).toBe(1);
    night.time.advance(BUS.nightEveryMs - BUS.dayEveryMs);
    expect(night.bus.run).toBe(2);
  });

  it("el horario sigue el reloj del juego: al anochecer el siguiente ya es el de la noche", () => {
    const { time, bus, setMinute } = setup(18 * 60 + 58);
    time.advance(SCHEDULE.firstInMs);
    expect(bus.nextAt - bus.since).toBe(BUS.dayEveryMs);
    setMinute(19 * 60 + 5);
    time.advance(BUS.dayEveryMs);
    expect(bus.nextAt - bus.since).toBe(BUS.nightEveryMs);
  });

  it("con solo gente que va a la estación a bordo al cerrar, da la vuelta y vuelve a abrir en la estación", () => {
    const { time, bus, phases, setRiders } = setup();
    time.advance(SCHEDULE.firstInMs + OPEN_AT + T.doorsMs);
    expect(bus.doorsOpen()).toBe(true);
    setRiders(2);
    time.advance(T.openMs - T.doorsMs + T.closingMs);
    expect(bus.phase).toBe("route");
    expect(bus.doorsOpen()).toBe(false);
    time.advance(T.tripMs - 1);
    expect(bus.phase).toBe("route");
    time.advance(1);
    expect(bus.phase).toBe("open");
    // Se bajaron todos: esta vez se va.
    setRiders(0);
    time.advance(T.openMs + T.closingMs);
    expect(bus.phase).toBe("leaving");
    expect(phases).toEqual(["away", "arriving", "open", "closing", "route", "open", "closing", "leaving"]);
  });

  it("quien llega en bus no espera mucho: si el próximo tarda, sale uno de refuerzo y el horario sigue", () => {
    const { time, bus } = setup();
    time.advance(SCHEDULE.firstInMs + OPEN_AT + T.openMs + T.closingMs + T.departMs);
    expect(bus.phase).toBe("away");
    const scheduled = bus.nextAt;
    expect(scheduled - time.now()).toBeGreaterThan(SCHEDULE.maxWaitMs);
    bus.requestRide();
    expect(bus.phase).toBe("arriving");
    expect(bus.run).toBe(2);
    expect(bus.nextAt).toBe(scheduled);
  });

  it("si el próximo del horario está por llegar, el refuerzo no sale", () => {
    const { time, bus } = setup();
    time.advance(SCHEDULE.firstInMs - 5_000);
    bus.requestRide();
    expect(bus.phase).toBe("away");
    time.advance(5_000);
    expect(bus.phase).toBe("arriving");
  });

  it("si alguien aparece a bordo mientras el bus se va vacío, el bus vuelve", () => {
    const { time, bus, setRiders } = setup();
    time.advance(SCHEDULE.firstInMs + OPEN_AT + T.openMs + T.closingMs + 1000);
    expect(bus.phase).toBe("leaving");
    const since = bus.since;
    setRiders(1);
    bus.requestRide();
    expect(bus.phase).toBe("route");
    expect(bus.since).toBe(since);
    time.advance(T.tripMs - 1000);
    expect(bus.phase).toBe("open");
  });

  it("con gente que va a su casa: viaja a la parada Casa, los baja y se pierde hasta el próximo", () => {
    const { time, bus, phases, board, arrivedHome } = setup();
    time.advance(SCHEDULE.firstInMs + OPEN_AT + T.doorsMs);
    board(2, 2);
    time.advance(T.openMs - T.doorsMs + T.closingMs);
    expect(bus.phase).toBe("route");
    expect(bus.route).toEqual({ from: "estacion", to: "casa" });
    time.advance(T.tripMs);
    expect(arrivedHome()).toBe(2);
    expect(bus.phase).toBe("away");
    expect(phases).toEqual(["away", "arriving", "open", "closing", "route", "away"]);
  });

  it("los que van a la estación no se bajan en la casa: el bus vuelve con ellos y abre en la estación", () => {
    const { time, bus, board, arrivedHome } = setup();
    time.advance(SCHEDULE.firstInMs + OPEN_AT + T.doorsMs);
    // Dos van a su casa y uno se subió desde la suya (o llegó en bus) y va a la estación.
    board(3, 2);
    time.advance(T.openMs - T.doorsMs + T.closingMs + T.tripMs);
    expect(arrivedHome()).toBe(2);
    expect(bus.phase).toBe("route");
    expect(bus.route).toEqual({ from: "casa", to: "estacion" });
    time.advance(T.tripMs);
    expect(bus.phase).toBe("open");
  });
});
