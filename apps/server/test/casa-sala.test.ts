import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, PET_MSG, PETS, ROOM_NAME, furnitureKey, type FurnitureEvent, type PetEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkTo, walkToTile, type ServerRoom } from "./helpers";

// La casa viva en la sala de verdad: la nevera de la zona de descanso, un baño de la planta baja y las
// mascotas en el estado.

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
  OfficeRoom.stallMs = 400;
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

async function join() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  return { room, alice };
}

describe("casa viva (en la sala)", () => {
  it("las mascotas están en el estado, cada una en su nivel", async () => {
    const { room, alice } = await join();
    expect([...room.state.pets.keys()].sort()).toEqual(PETS.map((p) => p.id).sort());
    for (const def of PETS) expect(room.state.pets.get(def.id)!.area).toBe(def.area);
    await tick(60);
    expect((alice.state as OfficeState).pets.size).toBe(PETS.length);
  });

  it("de la nevera sale algo gratis que queda en la mano (y lo ven los del nivel)", async () => {
    const { room, alice } = await join();
    const events: FurnitureEvent[] = [];
    alice.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.push(e));
    await goToArea(alice, room, "piso-2");
    // La nevera de la kitchenette (20, 14): se abre desde el tile de al lado.
    await walkToTile(alice, room, 21, 14);
    alice.send(MSG.furnitureUse, { type: "fridge", x: 20, y: 14 });
    await tick(80);
    await room.waitForNextPatch();
    expect(["jugo", "manzana", "banano"]).toContain(me(alice, room).held);
    expect(events.at(-1)).toMatchObject({ type: "fridge", action: "take", item: me(alice, room).held });
  });

  it("el cubículo del baño se ocupa, se ve para todos y se libera al moverse", async () => {
    const { room, alice } = await join();
    await goToArea(alice, room, "planta-baja");
    // Los cubículos miran al sur (la puerta hacia +y): se entra desde la fila de abajo.
    await walkToTile(alice, room, 4, 22);
    alice.send(MSG.furnitureUse, { type: "toilet-stall", x: 4, y: 20 });
    await tick(80);
    await room.waitForNextPatch();
    const key = furnitureKey("planta-baja", "toilet-stall", 4, 20);
    expect(room.state.stalls.get(key)).toBe("u-alice");
    await walkTo(alice, room, c(5), c(22));
    expect(room.state.stalls.get(key)).toBeUndefined();
    // Y solo, al rato (pasada la pausa entre usos).
    await tick(1500);
    alice.send(MSG.furnitureUse, { type: "toilet-stall", x: 5, y: 20 });
    await tick(80);
    expect(room.state.stalls.size).toBe(1);
    await tick(500);
    expect(room.state.stalls.size).toBe(0);
  });

  it("a una mascota se la llama desde su nivel y lo ven los demás", async () => {
    const { room, alice } = await join();
    const events: PetEvent[] = [];
    alice.onMessage(PET_MSG.event, (e: PetEvent) => events.push(e));
    // Tobi vive en el jardín, donde se aparece.
    const tobi = room.state.pets.get("tobi")!;
    const p = me(alice, room);
    alice.send(PET_MSG.call, { pet: "canela" }); // la gata está en la planta baja: no oye
    await tick(60);
    expect(events).toEqual([]);
    // Se acerca a unos tiles de Tobi y lo llama.
    const tile = { x: Math.floor(tobi.x / 32) - 3, y: Math.floor(tobi.y / 32) + 2 };
    await walkToTile(alice, room, tile.x, tile.y);
    expect(p.area).toBe("jardin");
    alice.send(PET_MSG.call, { pet: "tobi" });
    await tick(80);
    expect(events).toEqual([{ pet: "tobi", sessionId: alice.sessionId, action: "call" }]);
  });
});
