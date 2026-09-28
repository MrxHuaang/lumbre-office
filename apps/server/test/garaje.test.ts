import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, officeDoor, seatStandSpot } from "@hyvento/map";
import { MSG, ROOM_NAME } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, TILE, tick, token, walkToTile } from "./helpers";

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

const tileOf = (px: number) => Math.floor(px / TILE);
/** Adónde lleva un portal. */
const portalTo = (area: string, id: string) => getWorld().areas.get(area)!.portals.find((p) => p.id === id)!.to;

/** Tile de afuera y de adentro de la puerta de la oficina del garaje. */
function officeTiles() {
  const map = getWorld().areas.get("garaje")!;
  const zone = map.zones.find((z) => z.id === "office-5")!;
  const door = officeDoor(zone);
  const outside = { x: tileOf(door.x), y: tileOf(door.y) };
  // La puerta es la pared oeste de la oficina: dos pasos hacia +x ya se está adentro.
  return { outside, inside: { x: outside.x + 2, y: outside.y } };
}

describe("garaje", () => {
  it("se entra por la puerta chica del jardín, se llega al taller y se vuelve al mismo lugar", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    const me = () => room.state.players.get(alice.sessionId)!;
    expect(me().area).toBe("jardin");

    await goToArea(alice, room, "garaje");
    expect(me().area).toBe("garaje");
    const llegada = portalTo("jardin", "jardin-garaje");
    expect([tileOf(me().x), tileOf(me().y)]).toEqual([llegada.x, llegada.y]);
    expect(me().zoneId).toBe("taller");

    await goToArea(alice, room, "jardin");
    expect(me().area).toBe("jardin");
    const afuera = portalTo("garaje", "garaje-salida");
    expect([tileOf(me().x), tileOf(me().y)]).toEqual([afuera.x, afuera.y]);
  });

  it("la oficina del garaje es una oficina más: si está cerrada solo entra su dueña", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    repo.assign("office-5", "u-alice", "Alice");
    await repo.setOfficeLocked("office-5", true);
    await OfficeRoom.reloadOfficesEverywhere();
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-5")).toMatchObject({ ownerId: "u-alice", locked: true, name: "Oficina del garaje" });

    const { outside, inside } = officeTiles();
    for (const client of [alice, bob]) {
      await goToArea(client, room, "garaje");
      await walkToTile(client, room, outside.x, outside.y);
    }
    // Bob choca con la puerta cerrada; Alice entra.
    await walkToTile(bob, room, inside.x, inside.y);
    expect(room.state.players.get(bob.sessionId)!.zoneId).not.toBe("office-5");
    await walkToTile(alice, room, inside.x, inside.y);
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("office-5");
  });

  it("el PC de la oficina del garaje se prende al sentarse en la silla rota", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    const map = getWorld().areas.get("garaje")!;
    const seat = [...map.seats.values()].find((s) => s.computer)!;
    expect(seat.type).toBe("office-chair-broken");
    await goToArea(alice, room, "garaje");
    const { inside } = officeTiles();
    await walkToTile(alice, room, inside.x, inside.y);
    const spot = seatStandSpot(map, seat);
    await walkToTile(alice, room, tileOf(spot.x), tileOf(spot.y));
    alice.send(MSG.move, { x: seat.x, y: seat.y, dir: seat.facing, moving: false, seated: true });
    await room.waitForNextPatch();
    await tick(20);
    expect(room.state.players.get(alice.sessionId)!).toMatchObject({ area: "garaje", seated: true });
  });
});
