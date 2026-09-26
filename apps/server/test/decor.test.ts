import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, type MoveCorrection, type OfficeEditMessage, type OfficeEditResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, intoOffice, tick, token, walkTo, walkToTile, type ServerRoom } from "./helpers";

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

// Oficina 2 (x 11..18, y 0..8): puerta afuera en (10, 6) y adentro en (11, 6). Muebles del mapa que se
// pueden mover: map-0 planta (11,0) … map-6 sofá (17,3) … (ver packages/map/src/decor.test.ts). Fijos:
// fijo-0 escritorio con PC (16,0) y fijo-1 su silla (16,1).
const ZONE = "office-2";

/** Sala con la oficina 2 de Alice; Alice ya está adentro, en (12, 6). */
async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  repo.assign(ZONE, "u-alice", "Alice");
  await OfficeRoom.reloadOfficesEverywhere();
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  await intoOffice(alice, room, ZONE);
  return { room, alice, office: () => room.state.offices.get(ZONE)! };
}

/** Manda un cambio y espera la respuesta del servidor. */
function edit(client: ClientRoom, msg: OfficeEditMessage): Promise<OfficeEditResult> {
  return new Promise((resolve) => {
    const off = client.onMessage(MSG.officeEditResult, (r: OfficeEditResult) => {
      off();
      resolve(r);
    });
    client.send(MSG.officeEdit, msg);
  });
}

const place = (type: string, x: number, y: number, facing: "right" | "down" | "left" | "up" = "right"): OfficeEditMessage => ({
  action: "place",
  zoneId: ZONE,
  type,
  x,
  y,
  facing,
});

const me = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!;

describe("editor de oficina", () => {
  it("poner un mueble de la mochila: la oficina pasa a decorada, la mochila resta 1 y el mueble choca", async () => {
    const { room, alice, office } = await setup();
    repo.give("u-alice", "plant", 2);
    expect(office().customized).toBe(false);

    expect(await edit(alice, place("plant", 14, 7))).toEqual({ ok: true });
    expect(office().customized).toBe(true);
    // Los 9 muebles del mapa se copiaron (con ids propios) y se sumó la planta.
    expect(office().items).toHaveLength(10);
    expect(office().items.some((i) => i.id.startsWith("map-"))).toBe(false);
    expect(office().items.filter((i) => i.type === "plant" && i.x === 14 && i.y === 7)).toHaveLength(1);
    expect(repo.held("u-alice", "plant")).toBe(1);
    expect(repo.offices.get(ZONE)!.items).toHaveLength(10);

    // El servidor rearmó el piso 2: no se puede caminar hasta la planta.
    await walkTo(alice, room, c(14), c(7));
    expect([me(room, alice).x, me(room, alice).y]).not.toEqual([c(14), c(7)]);
  });

  it("mover y girar un mueble del mapa", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: "map-6", x: 13, y: 2, facing: "down" })).toEqual({ ok: true });
    const sofas = office().items.filter((i) => i.type === "sofa");
    expect(sofas.map((s) => [s.x, s.y, s.facing])).toEqual([[13, 2, "down"]]);
    expect(office().items).toHaveLength(9);
    // Ya con ids propios: se mueve por su id.
    const id = sofas[0]!.id;
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: id, x: 13, y: 2, facing: "right" })).toEqual({ ok: true });
    expect(office().items.find((i) => i.id === id)?.facing).toBe("right");
  });

  it("quitar un mueble lo devuelve a la mochila", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "map-0" })).toEqual({ ok: true });
    expect(office().items).toHaveLength(8);
    expect(office().items.some((i) => i.x === 11 && i.y === 0)).toBe(false);
    expect(repo.held("u-alice", "plant")).toBe(1);
  });

  it("piso y papel tapiz", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "style", zoneId: ZONE, floor: "wood" })).toEqual({ ok: true });
    expect(await edit(alice, { action: "style", zoneId: ZONE, wallpaper: "rose" })).toEqual({ ok: true });
    expect([office().floor, office().wallpaper]).toEqual(["wood", "rose"]);
    expect(repo.offices.get(ZONE)).toMatchObject({ floor: "wood", wallpaper: "rose", customized: false });
  });

  it("solo la dueña o dueño de esa oficina puede decorarla", async () => {
    const { room, alice, office } = await setup();
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    repo.give("u-bob", "plant");
    expect(await edit(bob, place("plant", 14, 7))).toEqual({ ok: false, error: "not-owner" });
    expect(await edit(bob, { action: "style", zoneId: ZONE, floor: "stone" })).toEqual({ ok: false, error: "not-owner" });
    expect(await edit(alice, { ...place("plant", 3, 6), zoneId: "office-1" })).toEqual({ ok: false, error: "not-owner" });
    expect(office().customized).toBe(false);
    expect(office().floor).toBe("");
    expect(repo.held("u-bob", "plant")).toBe(1);
  });

  it("sin el mueble en la mochila no se pone nada (ni se copia el mapa)", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, place("plant", 14, 7))).toEqual({ ok: false, error: "not-owned" });
    expect(office().customized).toBe(false);
    expect(repo.offices.get(ZONE)).toMatchObject({ customized: false, items: [] });
  });

  it("no se tapa la puerta", async () => {
    const { alice, office } = await setup();
    repo.give("u-alice", "plant");
    expect(await edit(alice, place("plant", 11, 6))).toEqual({ ok: false, error: "door" });
    expect(await edit(alice, place("plant", 10, 6))).toEqual({ ok: false, error: "outside" });
    expect(await edit(alice, place("plant", 16, 0))).toEqual({ ok: false, error: "blocked" });
    expect(office().customized).toBe(false);
    expect(repo.held("u-alice", "plant")).toBe(1);
  });

  it("no se pone nada donde hay alguien parado", async () => {
    const { room, alice } = await setup();
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    await intoOffice(bob, room, ZONE);
    await walkToTile(bob, room, 14, 7);
    repo.give("u-alice", "plant");
    expect(await edit(alice, place("plant", 14, 7))).toEqual({ ok: false, error: "occupied" });
    expect(await edit(alice, place("plant", 12, 6))).toEqual({ ok: false, error: "occupied" }); // ella misma
    expect(repo.held("u-alice", "plant")).toBe(1);
  });

  it("el escritorio con PC y su silla no se mueven ni se quitan", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: "fijo-0", x: 13, y: 3, facing: "right" })).toEqual({ ok: false, error: "fixed" });
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "fijo-1" })).toEqual({ ok: false, error: "fixed" });
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "no-existe" })).toEqual({ ok: false, error: "unknown" });
    expect(office().customized).toBe(false);
  });

  it("la decoración se carga de la base, y quien quede dentro de un mueble nuevo se corre", async () => {
    const { room, alice, office } = await setup();
    await walkToTile(alice, room, 14, 7);
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    // Otra instancia guardó una decoración con una planta justo donde está Alice.
    repo.decorate(ZONE, [{ id: "p1", type: "plant", x: 14, y: 7, facing: "right" }]);
    await repo.setOfficeStyle(ZONE, { floor: "tiles" });
    await OfficeRoom.reloadOfficesEverywhere();
    await room.waitForNextPatch();
    await tick(30);
    expect(office().customized).toBe(true);
    expect(office().items.map((i) => i.id)).toEqual(["p1"]);
    expect(office().floor).toBe("tiles");
    const p = me(room, alice);
    expect(Math.floor(p.x / 32) === 14 && Math.floor(p.y / 32) === 7).toBe(false);
    expect(corrections.at(-1)).toEqual({ x: p.x, y: p.y });
  });
});
