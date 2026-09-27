import type { ColyseusTestServer } from "@colyseus/testing";
import { addStroke, BOARD, MSG, parseStoredStrokes, ROOM_NAME, type BoardRemoveEvent, type BoardStateEvent, type BoardStroke, type BoardStrokeEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, intoOffice, tick, token } from "./helpers";

// ---------- Reglas ----------

const stroke = (id: string, n = 4): BoardStroke => ({ id, by: "u", color: "#2b2233", width: 3, points: Array.from({ length: n }, (_, i) => i) });

describe("pizarra (reglas)", () => {
  it("con demasiados trazos se van los más viejos", () => {
    const list: BoardStroke[] = [];
    for (let i = 0; i < BOARD.maxStrokes; i++) expect(addStroke(list, stroke(`s${i}`))).toEqual([]);
    expect(addStroke(list, stroke("nuevo"))).toEqual(["s0"]);
    expect(list).toHaveLength(BOARD.maxStrokes);
    expect(list.at(-1)!.id).toBe("nuevo");
  });

  it("lo guardado se lee descartando lo que no es un trazo", () => {
    expect(parseStoredStrokes(null)).toEqual([]);
    expect(parseStoredStrokes([stroke("a"), { id: "b" }, { ...stroke("c"), color: "#fff" }, { ...stroke("d"), points: [1, 2, 3] }])).toEqual([stroke("a")]);
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
  OfficeRoom.boardSaveDelayMs = 30;
});

/** Alice es dueña de la oficina 4; Bob es visita. */
async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  repo.assign("office-4", "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

/** Todo lo que le llega a un cliente de la pizarra. */
function inbox(client: ClientRoom) {
  const got = { state: [] as BoardStateEvent[], strokes: [] as BoardStrokeEvent[], removed: [] as BoardRemoveEvent[] };
  client.onMessage(MSG.boardState, (m: BoardStateEvent) => got.state.push(m));
  client.onMessage(MSG.boardStrokeEvent, (m: BoardStrokeEvent) => got.strokes.push(m));
  client.onMessage(MSG.boardRemove, (m: BoardRemoveEvent) => got.removed.push(m));
  return got;
}

const line = { color: "#d93a2b", width: 7, points: [10, 10, 200, 150] };
const board = { board: "office-4" };

describe("pizarra (en la sala)", () => {
  it("se dibuja entre los que están en la oficina, se deshace lo propio y la borra la dueña", async () => {
    const { room, alice, bob } = await setup();
    const a = inbox(alice);
    const b = inbox(bob);
    // Desde el pasillo no se abre.
    bob.send(MSG.boardOpen, board);
    await tick(60);
    expect(b.state).toEqual([]);

    await intoOffice(alice, room, "office-4");
    await intoOffice(bob, room, "office-4");
    alice.send(MSG.boardOpen, board);
    bob.send(MSG.boardOpen, board);
    await tick(80);
    expect(a.state.at(-1)).toMatchObject({ board: "office-4", strokes: [], canClear: true });
    expect(b.state.at(-1)).toMatchObject({ canClear: false });

    bob.send(MSG.boardStroke, { ...board, stroke: line });
    await tick(80);
    expect(a.strokes.map((e) => e.stroke)).toEqual([{ ...line, id: expect.any(String), by: "u-bob" }]);
    // Un trazo raro (color que no existe) no entra.
    bob.send(MSG.boardStroke, { ...board, stroke: { ...line, color: "#ffffff" } });
    await tick(80);
    expect(a.strokes).toHaveLength(1);

    // Deshacer solo quita lo propio: Alice no tiene trazos, Bob sí.
    alice.send(MSG.boardUndo, board);
    await tick(60);
    expect(a.removed).toEqual([]);
    bob.send(MSG.boardUndo, board);
    await tick(60);
    expect(a.removed).toEqual([{ board: "office-4", ids: [a.strokes[0]!.stroke.id] }]);

    // Bob no puede borrarla entera; Alice sí.
    bob.send(MSG.boardStroke, { ...board, stroke: line });
    await tick(80);
    bob.send(MSG.boardClear, board);
    await tick(60);
    expect(b.removed.some((r) => r.ids === "all")).toBe(false);
    alice.send(MSG.boardClear, board);
    await tick(60);
    expect(b.removed.at(-1)).toEqual({ board: "office-4", ids: "all" });
  });

  it("queda guardada: al volver a abrirla (o en otra sala) están los trazos", async () => {
    const { room, alice } = await setup();
    await intoOffice(alice, room, "office-4");
    alice.send(MSG.boardOpen, board);
    await tick(60);
    alice.send(MSG.boardStroke, { ...board, stroke: line });
    await tick(120);
    expect(parseStoredStrokes(await repo.loadBoard("office-4"))).toEqual([{ ...line, id: expect.any(String), by: "u-alice" }]);
  });
});
