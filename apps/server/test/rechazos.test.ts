import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, RECHAZO_MSG, ROOM_NAME, type RechazoNotice } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// Los rechazos que eran mudos ahora avisan por qué: chat con límite, mueble lejos o en pausa.

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
});

async function join() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const notices: RechazoNotice[] = [];
  alice.onMessage(RECHAZO_MSG.notice, (n: RechazoNotice) => notices.push(n));
  return { room, alice, notices };
}

describe("rechazos con aviso", () => {
  it("el chat pasado del límite dice que se espere", async () => {
    const { alice, notices } = await join();
    for (let i = 0; i < 6; i++) alice.send(MSG.chatSend, { text: `hola ${i}`, scope: "proximity" });
    await tick(120);
    expect(notices).toEqual([{ code: "rate" }]);
  });

  it("usar un mueble lejos avisa 'far'", async () => {
    const { room, alice, notices } = await join();
    await goToArea(alice, room, "piso-2");
    // La nevera de la kitchenette está en (20, 14): desde el spawn no se alcanza.
    alice.send(MSG.furnitureUse, { type: "fridge", x: 20, y: 14 });
    await tick(120);
    expect(notices).toEqual([{ code: "far" }]);
  });

  it("usar un mueble otra vez sin esperar la pausa avisa 'cooldown'", async () => {
    const { room, alice, notices } = await join();
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 21, 14);
    alice.send(MSG.furnitureUse, { type: "fridge", x: 20, y: 14 });
    alice.send(MSG.furnitureUse, { type: "fridge", x: 20, y: 14 });
    await tick(120);
    expect(notices).toEqual([{ code: "cooldown" }]);
  });
});
