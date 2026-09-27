import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType } from "@hyvento/map";
import {
  ARCADE_PRICE,
  HOCKEY,
  HOCKEY_MID,
  MSG,
  ROOM_NAME,
  type HockeyFrame,
  type HockeyResult,
  type HockeySettled,
  type HockeySide,
} from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { HockeyTable, type Timer } from "../src/rooms/hockey";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { HockeyState, type OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- Reloj de mentira: la mesa corre con el reloj de la sala, acá se adelanta a mano ----------

class FakeClock {
  now = 1_000_000;
  private timers: { at: number; every: number; fn: () => void; dead: boolean }[] = [];

  later = (ms: number, fn: () => void): Timer => this.add(ms, 0, fn);
  every = (ms: number, fn: () => void): Timer => this.add(ms, ms, fn);

  private add(ms: number, every: number, fn: () => void): Timer {
    const t = { at: this.now + ms, every, fn, dead: false };
    this.timers.push(t);
    return { clear: () => void (t.dead = true) };
  }

  /** Adelanta `ms` corriendo en orden todo lo que vence (y deja terminar los cobros y pagos). */
  async advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const due = this.timers.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.now = due.at;
      if (due.every) due.at += due.every;
      else due.dead = true;
      due.fn();
      await flush();
    }
    this.now = end;
    await flush();
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

const sotano = () => getWorld().areas.get("sotano")!;
const ends = () => pointsOfType(sotano(), "air_hockey");
/** Parado en la punta de ese lado. */
const atEnd = (side: HockeySide) => ({ area: "sotano", x: ends()[side]!.x, y: ends()[side]!.y });
const FUNDS = 100;
const FEE = ARCADE_PRICE.hockey;

async function setup() {
  const repo = new MemoryRepository();
  for (const u of ["u-a", "u-b", "u-c"]) await repo.awardPoints({ userId: u, amount: FUNDS, reason: "ADMIN" });
  const clock = new FakeClock();
  const state = new HockeyState();
  const where = new Map<string, { area: string; x: number; y: number }>();
  const frames: HockeyFrame[] = [];
  const settled: (HockeySettled & { userId: string })[] = [];
  const table = new HockeyTable({
    state,
    repo: () => repo,
    map: sotano,
    every: clock.every,
    later: clock.later,
    now: () => clock.now,
    where: (userId) => where.get(userId) ?? null,
    setPoints: () => undefined,
    frame: (f) => frames.push(f),
    settled: (userId, s) => settled.push({ userId, ...s }),
    bonus: async (userId, amount) => (await repo.awardPoints({ userId, amount, reason: "LEISURE" })).awarded,
  });
  /** Esa persona se para en una punta y se suma. */
  const join = (userId: string, side: HockeySide, bot = false) => {
    where.set(userId, atEnd(side));
    return table.join({ userId, name: userId.slice(2).toUpperCase(), ...atEnd(side) }, bot ? { bot: true } : {});
  };
  /** Dos personas en la mesa y el partido ya empezado. */
  const match = async () => {
    await join("u-a", 0);
    await join("u-b", 1);
    await clock.advance(HOCKEY.countdownMs);
    expect(state.phase).toBe("playing");
  };
  /**
   * Mete un gol en el arco de `into` (el disco sale hacia ahí desde cerca, con el arquero corrido):
   * espera hasta que la sala lo cuente y pase la pausa del gol.
   */
  const score = async (into: HockeySide) => {
    const w = table.debugWorld!;
    const keeper = w.mallets[into];
    keeper.x = keeper.tx = 3;
    w.puck = { x: HOCKEY.width / 2, y: into === 0 ? 8 : HOCKEY.length - 8, vx: 0, vy: into === 0 ? -100 : 100 };
    const before = state.sides[into === 0 ? 1 : 0]!.score;
    for (let i = 0; i < 40 && state.sides[into === 0 ? 1 : 0]!.score === before; i++) await clock.advance(HOCKEY.tickMs);
    // Los dos siguen moviendo el mazo (si no, pierden por no jugar).
    table.move("u-a", { x: 13, y: 6 });
    table.move("u-b", { x: 13, y: HOCKEY.length - 6 });
    if (state.phase === "goal") await clock.advance(HOCKEY.goalPauseMs);
  };
  return { repo, clock, state, where, frames, settled, table, join, match, score };
}

describe("hockey (reglas)", () => {
  it("hay una punta en cada extremo de la mesa y se llega a las dos", () => {
    const map = sotano();
    const [north, south] = ends();
    expect(ends()).toHaveLength(2);
    const table = map.furniture.find((f) => f.type === "air-hockey")!;
    expect(north!.tileY).toBe(table.y - 1);
    expect(south!.tileY).toBe(table.y + table.d);
    const door = { x: 26, y: 21 };
    for (const p of ends()) {
      expect(isBlockedTile(map, p.tileX, p.tileY), p.name).toBe(false);
      expect(findPath(map, door, { x: p.tileX, y: p.tileY }), p.name).not.toBeNull();
    }
  });

  it("sumarse cobra la entrada; lejos, sin monedas o con la mesa ocupada, no", async () => {
    const { repo, table, state, join } = await setup();
    expect(await table.join({ userId: "u-a", name: "A", area: "sotano", x: 0, y: 0 }, {})).toEqual({ ok: false, error: "far" });
    expect(await table.join({ userId: "u-a", name: "A", area: "jardin", ...{ x: atEnd(0).x, y: atEnd(0).y } }, {})).toEqual({ ok: false, error: "far" });
    await repo.spendPoints({ userId: "u-c", amount: FUNDS - FEE + 1, reason: "PURCHASE" });
    expect(await join("u-c", 0)).toEqual({ ok: false, error: "funds" });
    expect(await join("u-a", 0)).toEqual({ ok: true, balance: FUNDS - FEE });
    expect(state.phase).toBe("waiting");
    expect(state.sides[0]!.userId).toBe("u-a");
    // La misma punta ya está tomada; en la otra entra el rival y arranca la cuenta regresiva.
    expect(await join("u-b", 0)).toEqual({ ok: false, error: "busy" });
    expect(await join("u-b", 1)).toEqual({ ok: true, balance: FUNDS - FEE });
    expect(state.phase).toBe("countdown");
    await repo.awardPoints({ userId: "u-c", amount: 50, reason: "ADMIN" });
    expect(await join("u-c", 1)).toEqual({ ok: false, error: "busy" });
    expect(await repo.getPoints("u-c")).toBe(FEE - 1 + 50);
  });

  it("el mazo no cruza al campo rival ni va más rápido que su velocidad máxima", async () => {
    const { clock, table, match, frames } = await setup();
    await match();
    const w = table.debugWorld!;
    const from = { x: w.mallets[1].x, y: w.mallets[1].y };
    // El del sur quiere ir al arco del norte.
    table.move("u-b", { x: 13, y: 0 });
    await clock.advance(HOCKEY.tickMs);
    const moved = Math.hypot(w.mallets[1].x - from.x, w.mallets[1].y - from.y);
    expect(moved).toBeLessThanOrEqual((HOCKEY.malletSpeed * HOCKEY.tickMs) / 1000 + 1e-6);
    await clock.advance(2000);
    expect(w.mallets[1].y).toBeCloseTo(HOCKEY_MID + HOCKEY.malletR);
    // Lo que llega a los del sótano es lo mismo que simula el servidor.
    const last = frames.at(-1)!;
    expect(last.m[3]).toBeCloseTo(HOCKEY_MID + HOCKEY.malletR, 1);
    // Mensajes raros no hacen nada.
    table.move("u-b", { x: "a" });
    table.move("u-c", { x: 1, y: 1 });
    expect(w.mallets[1].ty).toBeCloseTo(HOCKEY_MID + HOCKEY.malletR);
  });

  it("la física es determinista: el mismo partido da los mismos cuadros", async () => {
    const run = async () => {
      const { clock, table, match, frames } = await setup();
      await match();
      for (let i = 0; i < 60; i++) {
        table.move("u-a", { x: 5 + (i % 7) * 2, y: 12 + (i % 5) });
        table.move("u-b", { x: 20 - (i % 6) * 2, y: 30 - (i % 4) });
        await clock.advance(HOCKEY.tickMs);
      }
      return frames.map((f) => [f.p, f.m, f.ev ?? []]);
    };
    const a = await run();
    expect(a.length).toBeGreaterThan(60);
    expect(await run()).toEqual(a);
  });

  it("un gol suma, saca quien lo recibió y a 7 goles el ganador se lleva el pozo", async () => {
    const { repo, clock, state, settled, table, match, score, frames } = await setup();
    await match();
    await score(0); // gol del sur en el arco del norte
    expect(state.sides[1]!.score).toBe(1);
    expect(frames.some((f) => f.ev?.includes("goal"))).toBe(true);
    // Saca el norte (lo recibió): el disco quedó quieto en su mitad.
    expect(table.debugWorld!.puck.y).toBeLessThan(HOCKEY_MID);
    expect(state.phase).toBe("playing");
    await score(1);
    expect(state.sides[0]!.score).toBe(1);
    for (let i = 0; i < HOCKEY.toWin - 1; i++) await score(0);
    expect(state.sides[1]!.score).toBe(HOCKEY.toWin);
    expect(state.phase).toBe("over");
    expect(state.winner).toBe(1);
    expect(state.forfeit).toBe(false);
    expect(settled).toEqual([
      { userId: "u-a", match: 1, outcome: "lose", won: 0, bonus: 0, forfeit: false },
      { userId: "u-b", match: 1, outcome: "win", won: 2 * FEE, bonus: 0, forfeit: false },
    ]);
    expect(await repo.getPoints("u-a")).toBe(FUNDS - FEE);
    expect(await repo.getPoints("u-b")).toBe(FUNDS + FEE);
    // Después de mostrar el resultado, la mesa queda libre.
    await clock.advance(HOCKEY.overMs);
    expect(state.phase).toBe("idle");
    expect(state.sides.map((p) => p.userId)).toEqual(["", ""]);
    expect(table.debugWorld).toBeNull();
  });

  it("quien se aleja de su punta pierde por abandono y el otro se lleva el pozo", async () => {
    const { repo, clock, state, where, settled, match } = await setup();
    await match();
    where.set("u-a", { area: "sotano", x: 0, y: 0 });
    await clock.advance(HOCKEY.tickMs);
    expect(state.phase).toBe("over");
    expect(state.winner).toBe(1);
    expect(state.forfeit).toBe(true);
    expect(settled.find((s) => s.userId === "u-a")).toMatchObject({ outcome: "lose", forfeit: true });
    expect(await repo.getPoints("u-b")).toBe(FUNDS + FEE);
  });

  it("dejar la mesa o no mover el mazo en mucho rato también es abandono", async () => {
    const left = await setup();
    await left.match();
    left.table.leave("u-b");
    await left.clock.advance(0);
    expect(left.state.winner).toBe(0);
    expect(await left.repo.getPoints("u-a")).toBe(FUNDS + FEE);

    const idle = await setup();
    await idle.match();
    // El norte juega; el sur se quedó quieto.
    for (let t = 0; t <= HOCKEY.idleMs; t += 1000) {
      idle.table.move("u-a", { x: 10 + (t % 3000) / 1000, y: 8 });
      await idle.clock.advance(1000);
    }
    await idle.clock.advance(1000);
    expect(idle.state.phase).toBe("over");
    expect(idle.state.winner).toBe(0);
    expect(idle.state.forfeit).toBe(true);
  });

  it("esperando rival: si nadie viene o se va, se le devuelve la moneda", async () => {
    const { repo, clock, state, settled, table, join } = await setup();
    await join("u-a", 0);
    await clock.advance(HOCKEY.waitMs);
    expect(state.phase).toBe("idle");
    expect(settled).toEqual([{ userId: "u-a", match: 1, outcome: "refund", won: FEE, bonus: 0, forfeit: false }]);
    expect(await repo.getPoints("u-a")).toBe(FUNDS);
    await join("u-a", 1);
    expect(state.match).toBe(2);
    table.leave("u-a");
    await clock.advance(0);
    expect(state.phase).toBe("idle");
    expect(await repo.getPoints("u-a")).toBe(FUNDS);
  });

  it("contra la máquina: ganarle devuelve la moneda y da premio de ocio; perder la pierde", async () => {
    const win = await setup();
    // Espera rival y después pide la máquina: no paga dos veces.
    await win.join("u-a", 1);
    expect(await win.join("u-a", 1, true)).toEqual({ ok: true, balance: FUNDS - FEE });
    expect(win.state.phase).toBe("countdown");
    expect(win.state.sides[0]!.bot).toBe(true);
    await win.clock.advance(HOCKEY.countdownMs);
    // La máquina juega sola: con el disco en su mitad, va a pegarle.
    const home = { x: win.table.debugWorld!.mallets[0].x, y: win.table.debugWorld!.mallets[0].y };
    win.table.debugWorld!.puck = { x: 8, y: 14, vx: 0, vy: 0 };
    await win.clock.advance(1000);
    expect(win.frames.some((f) => f.m[0] !== home.x || f.m[1] !== home.y)).toBe(true);
    for (let i = 0; i < HOCKEY.toWin; i++) {
      win.table.move("u-a", { x: 13, y: HOCKEY.length - 6 });
      const w = win.table.debugWorld!;
      w.mallets[0].x = w.mallets[0].tx = 3;
      w.puck = { x: HOCKEY.width / 2, y: 6, vx: 0, vy: -100 };
      for (let k = 0; k < 20 && win.state.sides[1]!.score === i; k++) await win.clock.advance(HOCKEY.tickMs);
      if (win.state.phase === "goal") await win.clock.advance(HOCKEY.goalPauseMs);
    }
    expect(win.state.winner).toBe(1);
    expect(win.settled).toEqual([{ userId: "u-a", match: 1, outcome: "win", won: FEE, bonus: ARCADE_PRICE.hockeyBotBonus, forfeit: false }]);
    expect(await win.repo.getPoints("u-a")).toBe(FUNDS + ARCADE_PRICE.hockeyBotBonus);

    const lose = await setup();
    await lose.join("u-b", 0, true);
    expect(lose.state.sides[1]!.bot).toBe(true);
    await lose.clock.advance(HOCKEY.countdownMs);
    for (let i = 0; i < HOCKEY.toWin; i++) await lose.score(0);
    expect(lose.state.winner).toBe(1);
    expect(lose.settled).toEqual([{ userId: "u-b", match: 1, outcome: "lose", won: 0, bonus: 0, forfeit: false }]);
    expect(await lose.repo.getPoints("u-b")).toBe(FUNDS - FEE);
  });

  it("si se acaba el tiempo gana el que va arriba; empatados, se devuelve todo", async () => {
    const lead = await setup();
    await lead.match();
    await lead.score(1);
    for (let t = 0; t < HOCKEY.maxMs; t += 10_000) {
      lead.table.move("u-a", { x: 10, y: 8 + (t % 20_000) / 10_000 });
      lead.table.move("u-b", { x: 10, y: 34 + (t % 20_000) / 10_000 });
      // El disco quieto en un rincón: no hay más goles.
      if (lead.table.debugWorld) lead.table.debugWorld.puck = { x: 22, y: 10, vx: 0, vy: 0 };
      await lead.clock.advance(10_000);
    }
    expect(lead.state.phase).toBe("over");
    expect(lead.state.winner).toBe(0);

    const tie = await setup();
    await tie.match();
    for (let t = 0; t < HOCKEY.maxMs; t += 10_000) {
      tie.table.move("u-a", { x: 3, y: 3 + (t % 20_000) / 10_000 });
      tie.table.move("u-b", { x: 3, y: 39 - (t % 20_000) / 10_000 });
      if (tie.table.debugWorld) tie.table.debugWorld.puck = { x: 22, y: 10, vx: 0, vy: 0 };
      await tie.clock.advance(10_000);
    }
    expect(tie.state.winner).toBe(-1);
    expect(tie.settled.map((s) => s.outcome)).toEqual(["tie", "tie"]);
    expect(await tie.repo.getPoints("u-a")).toBe(FUNDS);
    expect(await tie.repo.getPoints("u-b")).toBe(FUNDS);
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
});

describe("hockey (en la sala)", () => {
  it("en la punta de la mesa se paga, se juega contra la máquina y llegan los cuadros; salir cuenta como abandono", async () => {
    await repo.awardPoints({ userId: "u-alice", amount: 50, reason: "ADMIN" });
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    const results: HockeyResult[] = [];
    const frames: HockeyFrame[] = [];
    const settled: HockeySettled[] = [];
    alice.onMessage(MSG.hockeyResult, (r: HockeyResult) => results.push(r));
    alice.onMessage(MSG.hockeyFrame, (f: HockeyFrame) => frames.push(f));
    alice.onMessage(MSG.hockeySettled, (s: HockeySettled) => settled.push(s));
    // Lejos de la mesa, no.
    alice.send(MSG.hockeyJoin, {});
    await tick(60);
    expect(results.at(-1)).toEqual({ ok: false, error: "far" });
    await goToArea(alice, room, "sotano");
    const end = ends()[1]!;
    await walkToTile(alice, room, end.tileX, end.tileY);
    alice.send(MSG.hockeyJoin, { bot: true });
    await tick(120);
    expect(results.at(-1)).toEqual({ ok: true, balance: 50 - FEE });
    expect(room.state.players.get(alice.sessionId)!.points).toBe(50 - FEE);
    expect(room.state.hockey.phase).toBe("countdown");
    expect(room.state.hockey.sides[1]!.userId).toBe("u-alice");
    expect(room.state.hockey.sides[0]!.bot).toBe(true);
    await tick(200);
    expect(frames.length).toBeGreaterThan(1);
    alice.send(MSG.hockeyMove, { x: 5, y: 30 });
    alice.send(MSG.hockeyLeave, {});
    await tick(120);
    expect(room.state.hockey.phase).toBe("over");
    expect(room.state.hockey.winner).toBe(0);
    expect(settled.at(-1)).toMatchObject({ outcome: "lose", forfeit: true });
    expect(await repo.getPoints("u-alice")).toBe(50 - FEE);
  });
});
