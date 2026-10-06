// Los festivales en la sala: cuál corre según el calendario del juego, y las cinemáticas al abrir, al cerrar
// y para quien llega tarde (ver rooms/festivales.ts).
import { DIAS_POR_ESTACION, FESTIVAL_MSG, SEASONS, SUELTA_MINUTO, VELITAS_CINE, festivalCineId, type GameTime } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Festivales } from "../src/rooms/festivales";

/** El día del juego de (estación, día de la estación) en el año 1. */
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);

function setup(day: number, minute: number) {
  const time: GameTime = { day, minuteOfDay: minute, hour: Math.floor(minute / 60), minute: minute % 60 };
  const state = { festival: "", festivalFase: "" };
  const sent: { type: string; msg: unknown }[] = [];
  const changes: string[] = [];
  const f = new Festivales({
    state: () => state,
    time: () => time,
    broadcast: (type, msg) => sent.push({ type, msg }),
    changed: (x, fase) => changes.push(`${x?.id ?? ""}:${fase}`),
  });
  const at = (m: number) => {
    time.minuteOfDay = m;
    time.hour = Math.floor(m / 60);
  };
  return { f, state, sent, at, time, changes };
}

describe("festivales en la sala", () => {
  it("el día del festival: lo publica y manda la apertura a las 9:00 y el cierre a las 22:00", () => {
    const { f, state, sent, at } = setup(dayOf("otono", 21), 8 * 60);
    f.start();
    expect(state).toEqual({ festival: "brujas", festivalFase: "previa" });
    expect(sent).toEqual([]);
    at(9 * 60);
    f.tick();
    expect(state.festivalFase).toBe("fiesta");
    expect(sent).toEqual([{ type: FESTIVAL_MSG.cine, msg: { id: festivalCineId("brujas", "apertura") } }]);
    f.tick();
    expect(sent).toHaveLength(1);
    at(22 * 60);
    f.tick();
    expect(sent.at(-1)).toEqual({ type: FESTIVAL_MSG.cine, msg: { id: festivalCineId("brujas", "cierre") } });
  });

  it("un día sin festival no publica nada", () => {
    const { f, state, sent } = setup(dayOf("otono", 20), 10 * 60);
    f.start();
    expect(state).toEqual({ festival: "", festivalFase: "" });
    expect(sent).toEqual([]);
  });

  it("si la sala arranca en plena fiesta no la anuncia como si empezara, pero quien entra ve la llegada", () => {
    const { f, sent } = setup(dayOf("invierno", 7), 12 * 60);
    f.start();
    expect(sent).toEqual([]);
    const mine: { type: string; msg: unknown }[] = [];
    f.welcome((type, msg) => mine.push({ type, msg }));
    expect(mine).toEqual([{ type: FESTIVAL_MSG.cine, msg: { id: festivalCineId("velitas", "llegada") } }]);
  });

  it("antes de abrir o ya cerrado, quien entra no ve la llegada", () => {
    const { f } = setup(dayOf("invierno", 7), 23 * 60);
    f.start();
    const mine: unknown[] = [];
    f.welcome((_t, m) => mine.push(m));
    expect(mine).toEqual([]);
  });

  it("las novenas abren cada uno de sus nueve días", () => {
    const { f, sent, at, time } = setup(dayOf("invierno", 12), 8 * 60);
    f.start();
    at(9 * 60);
    f.tick();
    at(23 * 60);
    f.tick();
    time.day += 1;
    at(8 * 60);
    f.tick();
    at(9 * 60);
    f.tick();
    expect(sent.filter((s) => (s.msg as { id: string }).id === festivalCineId("novenas", "apertura"))).toHaveLength(2);
  });

  it("los momentos con hora salen una vez al llegar su minuto (la suelta de faroles a las 21:00)", () => {
    const { f, sent, at, time } = setup(dayOf("invierno", 7), 20 * 60);
    f.start();
    const faroles = () => sent.filter((s) => (s.msg as { id: string }).id === VELITAS_CINE.faroles);
    at(SUELTA_MINUTO - 1);
    f.tick();
    expect(faroles()).toEqual([]);
    at(SUELTA_MINUTO + 1);
    f.tick();
    expect(faroles()).toHaveLength(1);
    at(SUELTA_MINUTO + 30);
    f.tick();
    expect(faroles()).toHaveLength(1);
    // Otro día que no es de velitas: nada.
    time.day += 1;
    at(SUELTA_MINUTO - 1);
    f.tick();
    at(SUELTA_MINUTO + 1);
    f.tick();
    expect(faroles()).toHaveLength(1);
  });

  it("si la sala arranca después del momento no lo manda, y avisa cada cambio de festival o fase", () => {
    const { f, sent, at, changes } = setup(dayOf("invierno", 7), SUELTA_MINUTO + 5);
    f.start();
    at(SUELTA_MINUTO + 10);
    f.tick();
    expect(sent).toEqual([]);
    at(22 * 60);
    f.tick();
    expect(changes).toEqual(["velitas:fiesta", "velitas:fin"]);
  });

  it("en desarrollo se prende uno a mano (con su apertura) y se vuelve al calendario", () => {
    const { f, state, sent } = setup(dayOf("verano", 2), 10 * 60);
    f.start();
    f.force("carnaval");
    expect(state.festival).toBe("carnaval");
    expect(sent.at(-1)).toEqual({ type: FESTIVAL_MSG.cine, msg: { id: festivalCineId("carnaval", "apertura") } });
    f.force(null);
    expect(state.festival).toBe("");
  });
});
