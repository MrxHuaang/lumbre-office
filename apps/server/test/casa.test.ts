import { buildArea, type AreaDef } from "@hyvento/map";
import { CASA, COUNTER_MAX, CURTAIN_TYPE, furnitureKey } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { CasaViva } from "../src/rooms/casa";
import { FurnitureUses } from "../src/rooms/usables";
import { c } from "./helpers";

// ---------- Reglas de los muebles nuevos (con un nivel de prueba) ----------

/** Una sala de 12x8 con nevera, cafetera, ajedrez, un cubículo del baño, la fogata con su tronco y una ventana. */
const TEST_AREA: AreaDef = {
  id: "prueba-casa",
  name: "Prueba",
  width: 12,
  height: 8,
  rooms: [{ id: "sala", rect: { x: 0, y: 0, w: 12, h: 8 }, floor: "wood", wallpaper: "cream" }],
  doors: [],
  zones: [],
  features: [{ kind: "window", edge: "h", x: 2, y: 0, width: 2 }],
  furniture: [
    { type: "fridge", x: 0, y: 0 },
    { type: "coffee-station", x: 1, y: 0 },
    { type: "chess-table", x: 4, y: 3 },
    { type: "toilet-stall", x: 6, y: 0 },
    { type: "fire-pit", x: 9, y: 4 },
    { type: "log-seat", x: 7, y: 4 },
    { type: "bookcase-tall", x: 0, y: 5 },
    { type: "plant", x: 11, y: 0 },
  ],
  portals: [],
  points: [{ type: "spawn", name: "Inicio", x: 5, y: 6 }],
};

function rules(occupied = new Map<string, string>()) {
  const map = buildArea(TEST_AREA);
  const switches = new Map<string, boolean>();
  const counters = new Map<string, number>();
  const uses = new FurnitureUses(switches, { counters, occupant: (k) => occupied.get(k) });
  return { map, switches, counters, uses, occupied };
}

const at = (tx: number, ty: number, userId = "u") => ({ userId, x: c(tx), y: c(ty) });

describe("casa viva: muebles que se usan (reglas)", () => {
  it("la nevera da algo gratis (con la semilla) y hay que esperar para sacar otra cosa", () => {
    const { map, uses } = rules();
    const first = uses.use(map, at(0, 1), { type: "fridge", x: 0, y: 0 }, 0, 4);
    expect(first).toMatchObject({ ok: true, kind: "event", gives: { afterMs: 0 } });
    if (!first.ok || first.kind !== "event") throw new Error("sin evento");
    expect(["jugo", "manzana", "banano"]).toContain(first.gives!.item);
    expect(first.event.item).toBe(first.gives!.item);
    // Ni la nevera ni la cafetera: la pausa de lo gratis es para todo.
    expect(uses.use(map, at(1, 1), { type: "coffee-station", x: 1, y: 0 }, 5_000)).toEqual({ ok: false, error: "busy" });
    // Otra persona sí puede.
    expect(uses.use(map, at(1, 1, "v"), { type: "coffee-station", x: 1, y: 0 }, 5_000)).toMatchObject({ gives: { item: "tinto" } });
    expect(uses.use(map, at(1, 1), { type: "coffee-station", x: 1, y: 0 }, CASA.freebieCooldownMs + 1)).toMatchObject({ ok: true, gives: { item: "tinto" } });
  });

  it("el ajedrez avanza un contador para todos y vuelve a empezar al llegar al tope", () => {
    const { map, counters, uses } = rules();
    const key = furnitureKey("prueba-casa", "chess-table", 4, 3);
    const max = COUNTER_MAX["chess-table"]!;
    for (let i = 1; i <= max; i++) {
      expect(uses.use(map, at(4, 4, `u${i}`), { type: "chess-table", x: 4, y: 3 }, 0)).toMatchObject({ counter: { key, value: i } });
    }
    expect(uses.use(map, at(4, 4, "otra"), { type: "chess-table", x: 4, y: 3 }, 0)).toMatchObject({ counter: { key, value: 0 } });
    expect(counters.get(key)).toBe(0);
  });

  it("al cubículo ocupado por otra persona no se entra", () => {
    const occupied = new Map<string, string>();
    const { map, uses } = rules(occupied);
    const key = furnitureKey("prueba-casa", "toilet-stall", 6, 0);
    expect(uses.use(map, at(8, 0), { type: "toilet-stall", x: 6, y: 0 }, 0)).toMatchObject({ ok: true, stall: key });
    occupied.set(key, "u");
    expect(uses.use(map, at(8, 0, "v"), { type: "toilet-stall", x: 6, y: 0 }, 0)).toEqual({ ok: false, error: "busy" });
  });

  it("las cortinas de las ventanas se cierran y se abren para todos", () => {
    const { map, switches, uses } = rules();
    const key = furnitureKey("prueba-casa", CURTAIN_TYPE, 2, 0);
    expect(uses.use(map, at(2, 1), { type: CURTAIN_TYPE, x: 2, y: 0 }, 0)).toEqual({ ok: true, kind: "toggle", key, on: true });
    expect(switches.get(key)).toBe(true);
    // Lejos de la ventana, no.
    expect(uses.use(map, at(9, 7), { type: CURTAIN_TYPE, x: 2, y: 0 }, 5_000)).toEqual({ ok: false, error: "far" });
  });

  it("el malvavisco se asa desde el tronco de la fogata y llega a la mano al rato", () => {
    const { map, uses } = rules();
    // Sentado en el tronco (x = 7), la fogata empieza en x = 9: más lejos que el alcance normal.
    const r = uses.use(map, at(7, 4), { type: "fire-pit", x: 9, y: 4 }, 0, 0);
    expect(r).toMatchObject({ ok: true, gives: { item: "malvavisco", afterMs: CASA.roastMs } });
    expect(uses.use(map, at(2, 7, "v"), { type: "fire-pit", x: 9, y: 4 }, 0)).toEqual({ ok: false, error: "far" });
  });

  it("libros y plantas son un evento, sin nada en la mano", () => {
    const { map, uses } = rules();
    expect(uses.use(map, at(1, 5), { type: "bookcase-tall", x: 0, y: 5 }, 0, 3)).toEqual({
      ok: true,
      kind: "event",
      event: { type: "bookcase-tall", x: 0, y: 5, action: "read", seed: 3 },
    });
    expect(uses.use(map, at(11, 1, "v"), { type: "plant", x: 11, y: 0 }, 0)).toMatchObject({ event: { action: "water" } });
  });
});

describe("casa viva: lo que pasa después", () => {
  /** Reloj falso: `run(ms)` dispara lo que vence. */
  function fakeClock() {
    let t = 0;
    const timers: { at: number; fn: () => void; done: boolean }[] = [];
    return {
      setTimeout(fn: () => void, ms: number) {
        const timer = { at: t + ms, fn, done: false };
        timers.push(timer);
        return { clear: () => void (timer.done = true) };
      },
      run(ms: number) {
        t += ms;
        for (const timer of timers) if (!timer.done && timer.at <= t) {
          timer.done = true;
          timer.fn();
        }
      },
    };
  }

  it("lo de la nevera llega enseguida y el malvavisco al terminar de asarse", () => {
    const clock = fakeClock();
    const given: string[] = [];
    const casa = new CasaViva(new Map(), clock, (u, item) => given.push(`${u}:${item}`));
    const event = { type: "fridge", x: 0, y: 0, action: "take" as const, seed: 0 };
    casa.after("u", { ok: true, kind: "event", event, gives: { item: "jugo", afterMs: 0 } });
    expect(given).toEqual(["u:jugo"]);
    casa.after("u", { ok: true, kind: "event", event: { ...event, action: "roast" }, gives: { item: "malvavisco", afterMs: CASA.roastMs } });
    clock.run(CASA.roastMs - 10);
    expect(given).toHaveLength(1);
    clock.run(20);
    expect(given).toEqual(["u:jugo", "u:malvavisco"]);
  });

  it("el cubículo queda ocupado un rato y se libera solo, al moverse o al irse", () => {
    const clock = fakeClock();
    const stalls = new Map<string, string>();
    const casa = new CasaViva(stalls, clock, () => undefined, () => 1000);
    const event = { type: "toilet-stall", x: 6, y: 0, action: "stall" as const, seed: 0 };
    casa.after("u", { ok: true, kind: "event", event, stall: "k1" });
    expect(stalls.get("k1")).toBe("u");
    expect(casa.inStall("u")).toBe(true);
    clock.run(1001);
    expect(stalls.size).toBe(0);
    casa.after("u", { ok: true, kind: "event", event, stall: "k1" });
    casa.leaveStall("u");
    expect(stalls.size).toBe(0);
    // En uno a la vez: entrar a otro libera el anterior.
    casa.after("u", { ok: true, kind: "event", event, stall: "k1" });
    casa.after("u", { ok: true, kind: "event", event, stall: "k2" });
    expect([...stalls.keys()]).toEqual(["k2"]);
    casa.forget("u");
    expect(stalls.size).toBe(0);
  });
});
