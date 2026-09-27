import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, zoneAt } from "@hyvento/map";
import { DRUNK, MSG, ROOM_NAME, spinMs, spinProgress, SWIVEL, type DrunkStage, type SwivelEvent } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Drunkenness } from "../src/rooms/drunk";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { DEFAULT_SWIVEL_TIMINGS, Swivels } from "../src/rooms/swivels";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, type ServerRoom } from "./helpers";

// ---------- Reglas (sin sala) ----------

const pcChair = { type: "chair", computer: true };

describe("sillas giratorias (reglas)", () => {
  it("solo gira la silla de escritorio que mira al PC", () => {
    const swivels = new Swivels(() => 2);
    expect(swivels.spin("u", undefined, 0)).toEqual({ ok: false, error: "seat" }); // de pie
    expect(swivels.spin("u", { type: "chair", computer: false }, 0)).toEqual({ ok: false, error: "seat" }); // silla del comedor
    expect(swivels.spin("u", { type: "sofa", computer: true }, 0)).toEqual({ ok: false, error: "seat" });
    expect(swivels.spin("u", pcChair, 0)).toEqual({ ok: true, turns: 2, dizzy: false });
  });

  it("de 1 a 3 vueltas, y no se gira de nuevo hasta terminar", () => {
    let turns = 9;
    const swivels = new Swivels(() => turns);
    expect(swivels.spin("u", pcChair, 0)).toMatchObject({ turns: SWIVEL.maxTurns });
    const free = spinMs(SWIVEL.maxTurns) + SWIVEL.restMs;
    expect(swivels.spin("u", pcChair, free - 1)).toEqual({ ok: false, error: "busy" });
    turns = 0;
    expect(swivels.spin("u", pcChair, free)).toMatchObject({ ok: true, turns: SWIVEL.minTurns });
    // Cada uno con su pausa.
    expect(swivels.spin("otro", pcChair, free)).toMatchObject({ ok: true });
  });

  it("el giro arranca despacio, va rápido y frena", () => {
    expect(spinProgress(2, 0)).toBe(0);
    expect(spinProgress(2, 1)).toBeCloseTo(2);
    expect(spinProgress(2, 0.5)).toBeCloseTo(1);
    expect(spinProgress(2, 0.1)).toBeLessThan(0.1 * 2);
  });

  it(`girar ${SWIVEL.dizzyAfter} veces en ${SWIVEL.dizzyWindowMs / 1000} s marea (y se vuelve a contar)`, () => {
    const swivels = new Swivels(() => 1);
    const gap = spinMs(1) + SWIVEL.restMs;
    const dizzy: boolean[] = [];
    for (let k = 0; k < SWIVEL.dizzyAfter * 2; k++) {
      const r = swivels.spin("u", pcChair, k * gap);
      if (r.ok) dizzy.push(r.dizzy);
    }
    const expected = Array.from({ length: SWIVEL.dizzyAfter * 2 }, (_, k) => (k + 1) % SWIVEL.dizzyAfter === 0);
    expect(dizzy).toEqual(expected);
  });

  it("girando despacio (fuera de la ventana) no marea", () => {
    const swivels = new Swivels(() => 1);
    const gap = SWIVEL.dizzyWindowMs / (SWIVEL.dizzyAfter - 1) + 1;
    for (let k = 0; k < SWIVEL.dizzyAfter * 2; k++) expect(swivels.spin("u", pcChair, k * gap)).toMatchObject({ dizzy: false });
  });
});

describe("mareo sin alcohol", () => {
  function drunk() {
    let now = 0;
    const changes: DrunkStage[] = [];
    const d = new Drunkenness(
      { setTimeout: () => ({ clear() {} }) },
      () => now,
      { onChange: (_u, s) => changes.push(s), onBlackout: () => changes.push(4), onWake: () => {} },
    );
    return { d, changes, later: (ms: number) => void (now += ms) };
  }

  it("marea hasta 'mareado' como mucho: nunca emborracha ni desmaya", () => {
    const { d, changes } = drunk();
    expect(d.dizzy("u", SWIVEL.dizzyUnits, SWIVEL.dizzyCap)).toBe(1);
    expect(d.dizzy("u", SWIVEL.dizzyUnits, SWIVEL.dizzyCap)).toBe(2);
    for (let k = 0; k < 10; k++) d.dizzy("u", SWIVEL.dizzyUnits, SWIVEL.dizzyCap);
    expect(d.stage("u")).toBe(2);
    expect(changes).toEqual([1, 2]);
    expect(SWIVEL.dizzyCap).toBeLessThan(DRUNK.stages[2]);
  });

  it("si ya está más borracho por el bar, girar no le baja ni le sube", () => {
    const { d } = drunk();
    for (let k = 0; k < 6; k++) d.consumed("u", "whisky"); // 7,2: borracho
    expect(d.stage("u")).toBe(3);
    d.dizzy("u", SWIVEL.dizzyUnits, SWIVEL.dizzyCap);
    expect(d.stage("u")).toBe(3);
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  OfficeRoom.swivelTurns = () => 2;
  OfficeRoom.swivelTimings = { ...DEFAULT_SWIVEL_TIMINGS, spinMs: () => 20, restMs: 0 };
});
afterEach(() => {
  OfficeRoom.swivelTimings = { ...DEFAULT_SWIVEL_TIMINGS };
});

/** Una silla de escritorio con PC de una oficina del piso 2, y un asiento cualquiera que no gira. */
function seats() {
  const map = getWorld().areas.get("piso-2")!;
  const all = [...map.seats.values()];
  const pc = all.find((s) => s.computer && zoneAt(map, s.x, s.y)?.type === "office")!;
  const other = all.find((s) => !s.computer)!;
  return { pc, other };
}

async function inRoom() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const seen: SwivelEvent[] = [];
  bob.onMessage(MSG.swivelEvent, (e: SwivelEvent) => seen.push(e));
  alice.onMessage(MSG.swivelEvent, () => {});
  const a = room.state.players.get(alice.sessionId)!;
  const b = room.state.players.get(bob.sessionId)!;
  // Los dos en el piso 2; Alice sentada donde diga cada test.
  const sitAt = (seat: { x: number; y: number } | null) => {
    a.area = "piso-2";
    b.area = "piso-2";
    if (seat) [a.x, a.y] = [seat.x, seat.y];
    a.seated = Boolean(seat);
  };
  const spin = async () => {
    alice.send(MSG.swivel);
    await tick(40);
    await room.waitForNextPatch();
  };
  return { room, a, seen, sitAt, spin };
}

describe("sillas giratorias en la sala", () => {
  it("sentado en la silla del PC gira y lo ven los del nivel", async () => {
    const { seen, sitAt, spin } = await inRoom();
    sitAt(seats().pc);
    await spin();
    expect(seen).toEqual([{ sessionId: expect.any(String), turns: 2, dizzy: false }]);
  });

  it("de pie o en otro asiento no gira", async () => {
    const { seen, sitAt, spin } = await inRoom();
    sitAt(null);
    await spin();
    sitAt(seats().other);
    await spin();
    expect(seen).toEqual([]);
  });

  it("muchas vueltas seguidas marean un poco", async () => {
    const { room, a, seen, sitAt, spin } = await inRoom();
    sitAt(seats().pc);
    for (let k = 0; k < SWIVEL.dizzyAfter; k++) {
      await spin();
      await tick(30);
    }
    expect(seen.map((e) => e.dizzy)).toEqual([...Array(SWIVEL.dizzyAfter - 1).fill(false), true]);
    await room.waitForNextPatch();
    expect(a.drunk).toBe(1);
  });
});
