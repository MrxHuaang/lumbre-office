import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, paintingItemId, type OfficeEditMessage, type OfficeEditResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, intoOffice, token, type ServerRoom } from "./helpers";

// Cuadros de la Pintura (VIR-71): viajan por la mochila como el mueble `cuadro:<id>` y se cuelgan con el
// editor de oficina, con las mismas reglas que cualquier mueble (ver decor.test.ts).
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
});

const ZONE = "office-2";
const CUADRO = paintingItemId("clx0cuadro0001");

async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  repo.assign(ZONE, "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await intoOffice(alice, room, ZONE);
  return { room, alice, office: () => room.state.offices.get(ZONE)! };
}

function edit(client: ClientRoom, msg: OfficeEditMessage): Promise<OfficeEditResult> {
  return new Promise((resolve) => {
    const off = client.onMessage(MSG.officeEditResult, (r: OfficeEditResult) => {
      off();
      resolve(r);
    });
    client.send(MSG.officeEdit, msg);
  });
}

const place = (type: string, x: number, y: number): OfficeEditMessage => ({ action: "place", zoneId: ZONE, type, x, y, facing: "right" });

describe("cuadros de la Pintura en la oficina", () => {
  it("un cuadro de la mochila se cuelga, choca como un mueble y se vuelve a guardar", async () => {
    const { alice, office } = await setup();
    repo.give("u-alice", CUADRO, 1);

    expect(await edit(alice, place(CUADRO, 32, 7))).toEqual({ ok: true });
    const hung = office().items.find((i) => i.type === CUADRO);
    expect(hung).toMatchObject({ x: 2, y: 7 });
    expect(repo.held("u-alice", CUADRO)).toBe(0);
    // Ocupa su tile: no se pone otro mueble encima.
    repo.give("u-alice", "plant", 1);
    expect(await edit(alice, place("plant", 32, 7))).toEqual({ ok: false, error: "blocked" });

    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: hung!.id })).toEqual({ ok: true });
    expect(repo.held("u-alice", CUADRO)).toBe(1);
    expect(office().items.some((i) => i.type === CUADRO)).toBe(false);
  });

  it("sin ese cuadro en la mochila no se cuelga (ni uno ajeno ni uno inventado)", async () => {
    const { alice } = await setup();
    repo.give("u-bruno", CUADRO, 1);
    expect(await edit(alice, place(CUADRO, 32, 7))).toEqual({ ok: false, error: "not-owned" });
    // Un id con forma rara no es un cuadro: ni se busca en la mochila.
    repo.give("u-alice", "cuadro:../x", 1);
    expect(await edit(alice, place("cuadro:../x", 32, 7))).toEqual({ ok: false, error: "unknown" });
  });
});
