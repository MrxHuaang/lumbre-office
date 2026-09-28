// En la sala: la insignia destacada (el servidor la valida con los logros que tiene cada persona) y la
// mascota adoptada, que sigue a su dueño de un nivel a otro y vuelve a su casa cuando se va.
import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile } from "@hyvento/map";
import { MSG, PET_MSG, ROOM_NAME, type PetNotice } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

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

const newRoom = async () => (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;

async function join(room: ServerRoom, id: string, name: string) {
  const client = await colyseus.connectTo(room, { token: await token(id, name) });
  await room.waitForNextPatch();
  await tick(60);
  return { client, me: () => room.state.players.get(client.sessionId)! };
}

describe("insignia destacada", () => {
  it("se ve solo si es de un logro que la persona tiene", async () => {
    await repo.unlockAchievement("u-ana", "primera-picada");
    repo.featuredBadges.set("u-ana", "primera-picada");
    repo.featuredBadges.set("u-beto", "primera-picada"); // no lo tiene
    repo.featuredBadges.set("u-caro", "no-existe");
    const room = await newRoom();
    const ana = await join(room, "u-ana", "Ana");
    const beto = await join(room, "u-beto", "Beto");
    const caro = await join(room, "u-caro", "Caro");
    expect(ana.me().badge).toBe("primera-picada");
    expect(beto.me().badge).toBe("");
    expect(caro.me().badge).toBe("");
    // La cambia (o la quita) en la web: al avisar, el servidor la relee y la vuelve a validar.
    repo.featuredBadges.delete("u-ana");
    ana.client.send(MSG.profileChanged);
    await tick(80);
    expect(ana.me().badge).toBe("");
    repo.featuredBadges.set("u-beto", "turista");
    beto.client.send(MSG.profileChanged);
    await tick(80);
    expect(beto.me().badge).toBe("");
  });
});

describe("mascota adoptada", () => {
  it("se adopta de cerca, sigue al dueño a otro nivel y al irse el dueño vuelve a su casa", async () => {
    const room = await newRoom();
    const ana = await join(room, "u-ana", "Ana");
    // Alguien más en la sala, para que no se cierre cuando Ana se vaya.
    await join(room, "u-beto", "Beto");
    const notices: PetNotice[] = [];
    ana.client.onMessage(PET_MSG.notice, (n: PetNotice) => notices.push(n));
    ana.client.onMessage(PET_MSG.event, () => undefined);
    const tobi = room.state.pets.get("tobi")!;
    const jardin = getWorld().areas.get("jardin")!;
    // Un tile libre junto a Tobi (que empieza durmiendo en su cama) al que se llegue caminando.
    const at = { x: Math.floor(tobi.x / 32), y: Math.floor(tobi.y / 32) };
    const me = ana.me();
    const from = { x: Math.floor(me.x / 32), y: Math.floor(me.y / 32) };
    const next = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: at.x + dx!, y: at.y + dy! }))
      .find((t) => !isBlockedTile(jardin, t.x, t.y) && findPath(jardin, from, t));
    expect(next).toBeDefined();
    await walkToTile(ana.client, room, next!.x, next!.y);
    ana.client.send(PET_MSG.action, { pet: "tobi", action: "adopt" });
    await tick(80);
    expect([tobi.ownerId, tobi.ownerName]).toEqual(["u-ana", "Ana"]);
    expect(repo.petBonds.get("tobi")).toMatchObject({ ownerId: "u-ana" });
    // Una segunda mascota, no.
    await tick(1600);
    ana.client.send(PET_MSG.action, { pet: "tobi", action: "adopt" });
    await tick(80);
    expect(notices.at(-1)).toEqual({ code: "hasPet", pet: "Tobi" });
    // Entra a la casa: Tobi aparece con ella en la planta baja.
    await goToArea(ana.client, room, "planta-baja");
    await tick(300);
    expect(ana.me().area).toBe("planta-baja");
    expect(tobi.area).toBe("planta-baja");
    expect(Math.hypot(tobi.x - ana.me().x, tobi.y - ana.me().y)).toBeLessThanOrEqual(6 * 32);
    // Se va: Tobi vuelve al jardín.
    await ana.client.leave(true);
    await tick(400);
    expect(tobi.area).toBe("jardin");
  });
});
