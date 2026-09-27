import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, type MoveCorrection, type OfficeEditMessage, type OfficeEditResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, intoOffice, tick, token, walkTo, walkToTile, type ServerRoom } from "./helpers";

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

// Oficina 2 (x 30..39, y 0..10): puerta afuera en (34, 11) y adentro en (34, 10). Muebles del mapa que se
// pueden mover: map-0 planta (39,0) … map-6 sofá (39,5) … (ver packages/map/src/decor.test.ts). Fijos:
// fijo-0 escritorio con PC (34,0) y fijo-1 su silla (35,1).
const ZONE = "office-2";

/** Sala con la oficina 2 de Alice; Alice ya está adentro, en (34, 9). */
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

    expect(await edit(alice, place("plant", 32, 7))).toEqual({ ok: true });
    expect(office().customized).toBe(true);
    // Los 14 muebles del mapa se copiaron (con ids propios) y se sumó la planta.
    expect(office().items).toHaveLength(15);
    expect(office().items.some((i) => i.id.startsWith("map-"))).toBe(false);
    // Se guarda relativo a la oficina (la 2 empieza en x = 30).
    expect(office().items.filter((i) => i.type === "plant" && i.x === 2 && i.y === 7)).toHaveLength(1);
    expect(repo.held("u-alice", "plant")).toBe(1);
    expect(repo.offices.get(ZONE)!.items).toHaveLength(15);

    // El servidor rearmó el piso 2: no se puede caminar hasta la planta.
    await walkTo(alice, room, c(32), c(7));
    expect([me(room, alice).x, me(room, alice).y]).not.toEqual([c(32), c(7)]);
  });

  it("mover y girar un mueble del mapa", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: "map-6", x: 38, y: 3, facing: "down" })).toEqual({ ok: true });
    const sofas = office().items.filter((i) => i.type === "sofa");
    expect(sofas.map((s) => [s.x, s.y, s.facing])).toEqual([[8, 3, "down"]]);
    expect(office().items).toHaveLength(14);
    // Ya con ids propios: se mueve por su id.
    const id = sofas[0]!.id;
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: id, x: 38, y: 2, facing: "right" })).toEqual({ ok: true });
    expect(office().items.find((i) => i.id === id)?.facing).toBe("right");
  });

  it("quitar un mueble lo devuelve a la mochila", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "map-0" })).toEqual({ ok: true });
    expect(office().items).toHaveLength(13);
    expect(office().items.some((i) => i.x === 9 && i.y === 0)).toBe(false);
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
    expect(await edit(bob, place("plant", 32, 7))).toEqual({ ok: false, error: "not-owner" });
    expect(await edit(bob, { action: "style", zoneId: ZONE, floor: "stone" })).toEqual({ ok: false, error: "not-owner" });
    expect(await edit(alice, { ...place("plant", 3, 6), zoneId: "office-1" })).toEqual({ ok: false, error: "not-owner" });
    expect(office().customized).toBe(false);
    expect(office().floor).toBe("");
    expect(repo.held("u-bob", "plant")).toBe(1);
  });

  it("sin el mueble en la mochila no se pone nada (ni se copia el mapa)", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, place("plant", 32, 7))).toEqual({ ok: false, error: "not-owned" });
    expect(office().customized).toBe(false);
    expect(repo.offices.get(ZONE)).toMatchObject({ customized: false, items: [] });
  });

  it("no se tapa la puerta", async () => {
    const { alice, office } = await setup();
    repo.give("u-alice", "plant");
    expect(await edit(alice, place("plant", 34, 10))).toEqual({ ok: false, error: "door" });
    expect(await edit(alice, place("plant", 34, 11))).toEqual({ ok: false, error: "outside" });
    expect(await edit(alice, place("plant", 34, 0))).toEqual({ ok: false, error: "blocked" });
    expect(office().customized).toBe(false);
    expect(repo.held("u-alice", "plant")).toBe(1);
  });

  it("no se pone nada donde hay alguien parado", async () => {
    const { room, alice } = await setup();
    const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    await intoOffice(bob, room, ZONE);
    await walkToTile(bob, room, 32, 7);
    repo.give("u-alice", "plant");
    expect(await edit(alice, place("plant", 32, 7))).toEqual({ ok: false, error: "occupied" });
    expect(await edit(alice, place("plant", 34, 9))).toEqual({ ok: false, error: "occupied" }); // ella misma
    expect(repo.held("u-alice", "plant")).toBe(1);
  });

  it("el escritorio con PC y su silla no se mueven ni se quitan", async () => {
    const { alice, office } = await setup();
    expect(await edit(alice, { action: "move", zoneId: ZONE, itemId: "fijo-0", x: 32, y: 3, facing: "right" })).toEqual({ ok: false, error: "fixed" });
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "fijo-1" })).toEqual({ ok: false, error: "fixed" });
    expect(await edit(alice, { action: "remove", zoneId: ZONE, itemId: "no-existe" })).toEqual({ ok: false, error: "unknown" });
    // Claves del prototipo del catálogo: se rechazan (antes el servidor lanzaba y no respondía).
    repo.give("u-alice", "constructor");
    expect(await edit(alice, place("constructor", 32, 7))).toEqual({ ok: false, error: "unknown" });
    expect(office().customized).toBe(false);
  });

  it("la decoración se carga de la base, y quien quede dentro de un mueble nuevo se corre", async () => {
    const { room, alice, office } = await setup();
    await walkToTile(alice, room, 32, 7);
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    // Otra instancia guardó una decoración con una planta justo donde está Alice.
    // Lo guardado es relativo a la oficina (la 2 empieza en x = 30): (2, 7) es el tile (32, 7).
    repo.decorate(ZONE, [{ id: "p1", type: "plant", x: 2, y: 7, facing: "right" }]);
    await repo.setOfficeStyle(ZONE, { floor: "tiles" });
    await OfficeRoom.reloadOfficesEverywhere();
    await room.waitForNextPatch();
    await tick(30);
    expect(office().customized).toBe(true);
    expect(office().items.map((i) => i.id)).toEqual(["p1"]);
    expect(office().floor).toBe("tiles");
    const p = me(room, alice);
    expect(Math.floor(p.x / 32) === 32 && Math.floor(p.y / 32) === 7).toBe(false);
    expect(corrections.at(-1)).toEqual({ x: p.x, y: p.y });
  });

  it("quien queda dentro de un mueble no cruza la pared hacia la sala vecina", async () => {
    const { room, alice } = await setup();
    // La oficina 2 comparte con la sala de reuniones la pared entre x = 29 y x = 30; en (29, 5) hay piso libre.
    await walkToTile(alice, room, 30, 5);
    // Plantas encima, arriba, abajo y a su derecha: el único vecino libre sin mirar paredes sería (29, 5),
    // del otro lado. Tiene que quedar en la oficina: el primer tile libre sin cruzar paredes es (32, 5).
    const tiles = [
      [30, 4],
      [30, 5],
      [30, 6],
      [31, 5],
    ];
    repo.decorate(ZONE, tiles.map(([x, y]) => ({ id: `p${x}-${y}`, type: "plant", x: x! - 30, y: y!, facing: "right" as const })));
    await OfficeRoom.reloadOfficesEverywhere();
    await room.waitForNextPatch();
    await tick(30);
    const p = me(room, alice);
    expect([Math.floor(p.x / 32), Math.floor(p.y / 32)]).toEqual([32, 5]);
    expect(p.zoneId).toBe(ZONE);
  });

  it("a quien quedó dentro de un mueble en una oficina cerrada que no le toca se le saca a la puerta", async () => {
    const { room } = await setup();
    // La oficina 4 es de Bob (x 30..39, y 14..23; puerta afuera en (34, 13)). Su decoración tiene una planta
    // en (34, 15), relativa (4, 1). Carol quedó parada ahí (entró justo antes de que se guardara).
    repo.assign("office-4", "u-bob", "Bob");
    repo.decorate("office-4", [{ id: "p1", type: "plant", x: 4, y: 1, facing: "right" }]);
    const carol = await colyseus.connectTo(room, { token: await token("u-carol", "Carol", "bruno") });
    await room.waitForNextPatch();
    await goToArea(carol, room, "piso-2");
    const stuck = async () => {
      const p = me(room, carol);
      p.x = c(34);
      p.y = c(15);
      await OfficeRoom.reloadOfficesEverywhere();
      await room.waitForNextPatch();
      await tick(30);
      return me(room, carol);
    };
    // Abierta: se queda adentro, en el tile libre más cercano.
    let p = await stuck();
    expect([Math.floor(p.x / 32), Math.floor(p.y / 32), p.zoneId]).toEqual([35, 15, "office-4"]);
    // Cerrada: no se queda ni se busca lugar adentro; sale al pasillo, frente a la puerta.
    await repo.setOfficeLocked("office-4", true);
    p = await stuck();
    expect([Math.floor(p.x / 32), Math.floor(p.y / 32), p.zoneId]).toEqual([34, 13, "pasillo"]);
  });
});
