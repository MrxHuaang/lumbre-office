import type { ColyseusTestServer } from "@colyseus/testing";
import { curtainsOf, getWorld, isBlockedTile, seatAtTile } from "@hyvento/map";
import { CASA, CASA_MSG, MSG, PET_MSG, PETS, ROOM_NAME, furnitureKey, type CasaNotice, type FurnitureEvent, type PetEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { FurnitureUses } from "../src/rooms/usables";
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

  it("a un cubículo ocupado no entra otra persona, y se le avisa", async () => {
    const { room, alice } = await join();
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob") });
    await room.waitForNextPatch();
    const notices: CasaNotice[] = [];
    bob.onMessage(CASA_MSG.notice, (n: CasaNotice) => notices.push(n));
    await goToArea(alice, room, "planta-baja");
    await goToArea(bob, room, "planta-baja");
    await walkToTile(alice, room, 4, 22);
    alice.send(MSG.furnitureUse, { type: "toilet-stall", x: 4, y: 20 });
    await tick(80);
    const key = furnitureKey("planta-baja", "toilet-stall", 4, 20);
    expect(room.state.stalls.get(key)).toBe("u-alice");
    // Bob llega por otro lado (sin pisar a Alice) y prueba el mismo cubículo.
    await walkToTile(bob, room, 5, 22);
    bob.send(MSG.furnitureUse, { type: "toilet-stall", x: 4, y: 20 });
    await tick(80);
    expect(room.state.stalls.get(key)).toBe("u-alice");
    expect(notices).toEqual([{ code: "stall" }]);
  });

  it("a una mascota de otro nivel no se la acaricia, y llamarla seguido tiene pausa", async () => {
    const { room, alice } = await join();
    const events: PetEvent[] = [];
    const notices: CasaNotice[] = [];
    alice.onMessage(PET_MSG.event, (e: PetEvent) => events.push(e));
    alice.onMessage(CASA_MSG.notice, (n: CasaNotice) => notices.push(n));
    // Canela está en la planta baja; Alice, en el jardín.
    alice.send(PET_MSG.action, { pet: "canela", action: "pet" });
    await tick(60);
    expect(events).toEqual([]);
    expect(notices).toEqual([{ code: "petFar" }]);
    const tobi = room.state.pets.get("tobi")!;
    await walkToTile(alice, room, Math.floor(tobi.x / 32) - 3, Math.floor(tobi.y / 32) + 2);
    alice.send(PET_MSG.call, { pet: "tobi" });
    alice.send(PET_MSG.call, { pet: "tobi" });
    alice.send(PET_MSG.call, { pet: "tobi" });
    await tick(100);
    expect(events.filter((e) => e.action === "call")).toHaveLength(1);
  });

  it(
    "el malvavisco se asa desde un tronco de la fogata del jardín (más lejos que el alcance normal)",
    async () => {
      const { room, alice } = await join();
      const events: FurnitureEvent[] = [];
      alice.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.push(e));
      const map = getWorld().areas.get("jardin")!;
      const pit = map.furniture.find((f) => f.type === "fire-pit")!;
      const log = map.furniture.find((f) => f.type === "log-seat" && f.y === pit.y && f.x < pit.x)!;
      // Sentada en el tronco del oeste: más lejos de la fogata que el alcance normal, dentro del suyo.
      const seat = seatAtTile(map, log.x, log.y)!;
      const edge = pit.x - seat.x / 32;
      expect(edge).toBeGreaterThan(1.4);
      expect(edge).toBeLessThanOrEqual(CASA.roastReachTiles);
      expect(isBlockedTile(map, log.x - 1, log.y)).toBe(false);
      await walkToTile(alice, room, log.x - 1, log.y);
      alice.send(MSG.move, { x: seat.x, y: seat.y, dir: "right", moving: false, seated: true });
      await room.waitForNextPatch();
      await tick(20);
      expect(me(alice, room).seated).toBe(true);
      alice.send(MSG.furnitureUse, { type: "fire-pit", x: pit.x, y: pit.y });
      await tick(80);
      expect(events.at(-1)).toMatchObject({ type: "fire-pit", action: "roast" });
      expect(me(alice, room).held).toBe("");
      await tick(CASA.roastMs + 200);
      expect(me(alice, room).held).toBe("malvavisco");
    },
    CASA.roastMs + 8_000,
  );
});

describe("casa viva: cortinas", () => {
  it("cada cortina se alcanza desde algún tile libre del piso", () => {
    const uses = new FurnitureUses(new Map());
    for (const map of getWorld().areas.values()) {
      // stillInReach usa las mismas reglas que un uso de verdad (alcance, pared de por medio, oficina).
      for (const curtain of curtainsOf(map)) {
        let ok = false;
        for (let y = curtain.y - 2; y <= curtain.y + curtain.d + 1 && !ok; y++)
          for (let x = curtain.x - 2; x <= curtain.x + curtain.w + 1 && !ok; x++)
            if (!isBlockedTile(map, x, y) && uses.stillInReach(map, curtain, c(x), c(y))) ok = true;
        expect(ok, `${map.id} cortina ${curtain.x},${curtain.y}`).toBe(true);
      }
    }
  });
});
