import type { ColyseusTestServer } from "@colyseus/testing";
import { ESTACION_DESTINO, getWorld, travelDestinations, zoneAt } from "@hyvento/map";
import { CASA_ARBOL, casaAreaOf, PODCAST, ROOM_NAME, VIAJE, VIAJE_MSG, type MoveCorrection, type ViajeGoMessage, type ViajeNotice } from "@hyvento/shared";
import { MSG } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState, Player } from "../src/state";
import { bootServer, intoOffice, tick, TILE, token, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let clock = 1_000_000;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
  OfficeRoom.viajeNow = () => Date.now();
  OfficeRoom.viajeCooldownMs = VIAJE.cooldownMs;
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  clock = 1_000_000;
  OfficeRoom.viajeNow = () => clock;
  OfficeRoom.viajeCooldownMs = VIAJE.cooldownMs;
});

async function setup(names: string[]) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const clients: ClientRoom[] = [];
  for (const [i, name] of names.entries()) clients.push(await colyseus.connectTo(room, { token: await token(`u-${name}`, name, i % 2 ? "bruno" : "ada") }));
  await room.waitForNextPatch();
  return { room, clients };
}

const me = (room: ServerRoom, client: ClientRoom): Player => room.state.players.get(client.sessionId)!;

/** Pide el viaje y espera la respuesta: la corrección (se pudo) o el aviso (no se pudo). */
async function go(client: ClientRoom, room: ServerRoom, msg: ViajeGoMessage): Promise<{ notice: ViajeNotice | null; moved: MoveCorrection | null }> {
  let notice: ViajeNotice | null = null;
  let moved: MoveCorrection | null = null;
  const offNotice = client.onMessage(VIAJE_MSG.notice, (n: ViajeNotice) => (notice = n));
  const offMove = client.onMessage(MSG.moveCorrection, (c: MoveCorrection) => (moved = c));
  client.send(VIAJE_MSG.go, msg);
  const end = Date.now() + 2000;
  while (!notice && !moved && Date.now() < end) await tick(10);
  await room.waitForNextPatch();
  offNotice();
  offMove();
  return { notice, moved };
}

/** Pone a alguien en un punto de un nivel (como si hubiera llegado caminando). */
function place(p: Player, area: string, tx: number, ty: number) {
  const map = getWorld().areas.get(area)!;
  p.area = area;
  p.x = (tx + 0.5) * TILE;
  p.y = (ty + 0.5) * TILE;
  p.zoneId = zoneAt(map, p.x, p.y)?.id ?? "";
}

const dest = (id: string) => travelDestinations(getWorld().areas.values()).find((d) => d.id === id)!;

describe("viaje rápido", () => {
  it("lleva a una sala de otro nivel y la pausa frena el siguiente viaje", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    const res = await go(alice, room, { kind: "place", id: "zona:cafeteria" });
    expect(res.notice).toBeNull();
    expect(res.moved?.area).toBe("planta-baja");
    expect(me(room, alice).area).toBe("planta-baja");
    expect(me(room, alice).zoneId).toBe("cafeteria");

    // Enseguida otra vez: la pausa.
    const again = await go(alice, room, { kind: "place", id: "nivel:jardin" });
    expect(again.notice?.code).toBe("cooldown");
    expect(again.notice?.waitMs).toBeGreaterThan(0);
    expect(me(room, alice).area).toBe("planta-baja");

    // Pasada la pausa, sí.
    clock += VIAJE.cooldownMs;
    expect((await go(alice, room, { kind: "place", id: "nivel:jardin" })).notice).toBeNull();
    expect(me(room, alice).area).toBe("jardin");
  });

  it("ya estando en la sala, no viaja", async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    expect((await go(alice, room, { kind: "place", id: "zona:jardin-no-existe" })).notice?.code).toBe("unknown");
    await go(alice, room, { kind: "place", id: "zona:cafeteria" });
    clock += VIAJE.cooldownMs;
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("here");
  });

  it("junto a alguien de otro nivel: aparece a su lado, en un lugar libre", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob"]);
    const [alice, bob] = clients as [ClientRoom, ClientRoom];
    const d = dest("zona:biblioteca");
    place(me(room, bob), "piso-3", d.tile.x, d.tile.y);
    await room.waitForNextPatch();
    const res = await go(alice, room, { kind: "person", userId: "u-Bob" });
    expect(res.notice).toBeNull();
    const a = me(room, alice);
    const b = me(room, bob);
    expect(a.area).toBe("piso-3");
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    expect(dist).toBeGreaterThan(TILE * 0.5);
    expect(dist).toBeLessThan(TILE * (VIAJE.searchTiles + 1));
    // Pegado ya no hace falta.
    clock += VIAJE.cooldownMs;
    expect((await go(alice, room, { kind: "person", userId: "u-Bob" })).notice?.code).toBe("here");
    expect((await go(alice, room, { kind: "person", userId: "u-nadie" })).notice?.code).toBe("offline");
  });

  it("a una oficina cerrada ajena no se entra: queda afuera de la puerta", { timeout: 30000 }, async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    repo.assign("office-4", "u-Alice", "Alice");
    await OfficeRoom.reloadOfficesEverywhere();
    const alice = await colyseus.connectTo(room, { token: await token("u-Alice", "Alice") });
    const bob = await colyseus.connectTo(room, { token: await token("u-Bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    await intoOffice(alice, room, "office-4");
    alice.send(MSG.officeLock, { locked: true });
    await room.waitForNextPatch();
    expect(room.state.offices.get("office-4")!.locked).toBe(true);
    expect(me(room, alice).zoneId).toBe("office-4");

    const res = await go(bob, room, { kind: "person", userId: "u-Alice" });
    expect(res.notice).toBeNull();
    expect(me(room, bob).area).toBe("piso-2");
    expect(me(room, bob).zoneId).not.toBe("office-4");
    // Y a la oficina como lugar: también afuera (su entrada es la puerta).
    clock += VIAJE.cooldownMs;
    await go(bob, room, { kind: "place", id: "nivel:jardin" });
    clock += VIAJE.cooldownMs;
    await go(bob, room, { kind: "place", id: "zona:office-4" });
    expect(me(room, bob).zoneId).not.toBe("office-4");
  });

  it("la casa del árbol llena o con la escalera recogida, y el estudio en el aire, no dejan llegar", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob", "Carla", "Dani"]);
    const [alice, bob, carla, dani] = clients as [ClientRoom, ClientRoom, ClientRoom, ClientRoom];
    const arbol = dest(`nivel:${CASA_ARBOL.area}`);
    for (const c of [bob, carla, dani]) place(me(room, c), CASA_ARBOL.area, arbol.tile.x, arbol.tile.y);
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: `nivel:${CASA_ARBOL.area}` })).notice?.code).toBe("treeFull");
    expect((await go(alice, room, { kind: "person", userId: "u-Bob" })).notice?.code).toBe("treeFull");
    // Con uno solo arriba pero la escalera recogida, tampoco.
    place(me(room, carla), "jardin", 48, 81);
    place(me(room, dani), "jardin", 49, 81);
    room.state.treeHouse.locked = true;
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: `nivel:${CASA_ARBOL.area}` })).notice?.code).toBe("treeLocked");

    // El estudio pidiendo permiso para grabar (Bob adentro lo pidió y todavía no aceptó nadie más).
    const estudio = dest(`nivel:${PODCAST.area}`);
    place(me(room, bob), PODCAST.area, estudio.tile.x, estudio.tile.y);
    room.state.podcast.host = "u-Bob";
    room.state.podcast.consents.set("u-Bob", false);
    room.state.podcast.phase = "asking";
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: `nivel:${PODCAST.area}` })).notice?.code).toBe("onAir");
    room.state.podcast.phase = "idle";
    room.state.podcast.consents.clear();
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: `nivel:${PODCAST.area}` })).notice).toBeNull();
    expect(me(room, alice).area).toBe(PODCAST.area);
  });

  it("no se baja del Megabús en ruta ni se viaja al bus", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice", "Bob"]);
    const [alice, bob] = clients as [ClientRoom, ClientRoom];
    // Adentro con las puertas cerradas (al abrir la sala el bus no está en la estación).
    place(me(room, bob), "megabus", 5, 2);
    await room.waitForNextPatch();
    expect((await go(bob, room, { kind: "place", id: "nivel:jardin" })).notice?.code).toBe("route");
    expect((await go(alice, room, { kind: "person", userId: "u-Bob" })).notice?.code).toBe("bus");
    expect((await go(alice, room, { kind: "place", id: "nivel:megabus" })).notice?.code).toBe("unknown");
  });

  it("no viaja sentado en la tina, nadando, desmayado ni en medio de un minijuego", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    const p = me(room, alice);
    const jardin = getWorld().areas.get("jardin")!;
    const tub = [...jardin.seats.values()].find((s) => s.type === "hot-tub")!;
    const home = { x: p.x, y: p.y };
    p.x = tub.x;
    p.y = tub.y;
    p.seated = true;
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("seated");
    p.seated = false;
    p.x = home.x;
    p.y = home.y;
    p.swimming = true;
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("swimming");
    p.swimming = false;
    p.racing = true;
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("busy");
    p.racing = false;
    p.fishing = "wait";
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("busy");
    // Levantando el pez recién sacado ya no frena (y como no viajó, no corre la pausa).
    p.fishing = "show:trucha";
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice).toBeNull();
    expect(p.area).toBe("planta-baja");
    clock += VIAJE.cooldownMs;
    p.fishing = "";
    // Jugando al hockey de mesa (un lado de la mesa es suyo).
    room.state.hockey.sides[0]!.userId = p.userId;
    await room.waitForNextPatch();
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("busy");
    room.state.hockey.sides[0]!.userId = "";
    const drunk = (room as unknown as { drunk: { fainted: (id: string) => boolean } }).drunk;
    const fainted = drunk.fainted;
    drunk.fainted = () => true;
    expect((await go(alice, room, { kind: "place", id: "zona:cafeteria" })).notice?.code).toBe("fainted");
    drunk.fainted = fainted;
    // Los rechazos no cobran la pausa: ahora sí viaja.
    expect((await go(alice, room, { kind: "place", id: "nivel:jardin" })).notice).toBeNull();
    expect(p.area).toBe("jardin");
  });

  it("sentado en una silla cualquiera sí viaja (y queda de pie)", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    const piso2 = getWorld().areas.get("piso-2")!;
    const sofa = [...piso2.seats.values()].find((s) => zoneAt(piso2, s.x, s.y)?.id === "descanso")!;
    const p = me(room, alice);
    p.area = "piso-2";
    p.x = sofa.x;
    p.y = sofa.y;
    p.seated = true;
    await room.waitForNextPatch();
    const res = await go(alice, room, { kind: "place", id: "zona:cafeteria" });
    expect(res.notice).toBeNull();
    expect(p.seated).toBe(false);
    expect(p.area).toBe("planta-baja");
  });
});

describe("ir a la estación y volver a la cabaña (VIR-143)", () => {
  const parada = () => getWorld().areas.get("jardin")!.points.find((p) => p.type === "bus_stop")!;
  const cerca = (p: Player) => Math.hypot(p.x / TILE - (parada().tileX + 0.5), p.y / TILE - (parada().tileY + 0.5));

  it("desde cualquier sala de la cabaña deja en la plataforma de la estación", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    place(me(room, alice), "planta-baja", dest("zona:cafeteria").tile.x, dest("zona:cafeteria").tile.y);
    await room.waitForNextPatch();
    const res = await go(alice, room, { kind: "place", id: ESTACION_DESTINO });
    expect(res.notice).toBeNull();
    expect(me(room, alice).area).toBe("jardin");
    expect(cerca(me(room, alice))).toBeLessThanOrEqual(VIAJE.searchTiles + 1);
  });

  it("desde la casa propia vuelve a la estación (y la pausa vale igual)", { timeout: 30000 }, async () => {
    process.env.HYVENTO_DEV_TOOLS = "1";
    try {
      const { room, clients } = await setup(["Ana"]);
      const [ana] = clients as [ClientRoom];
      ana.send(MSG.chatSend, { text: "/ir casa", scope: "proximity" });
      const end = Date.now() + 3000;
      while (me(room, ana).area !== casaAreaOf("u-Ana") && Date.now() < end) await tick(20);
      expect(me(room, ana).area).toBe(casaAreaOf("u-Ana"));
      const res = await go(ana, room, { kind: "place", id: ESTACION_DESTINO });
      expect(res.notice).toBeNull();
      expect(me(room, ana).area).toBe("jardin");
      expect(cerca(me(room, ana))).toBeLessThanOrEqual(VIAJE.searchTiles + 1);
      // Enseguida otra vez: la misma pausa del viaje rápido.
      expect((await go(ana, room, { kind: "place", id: "nivel:planta-baja" })).notice?.code).toBe("cooldown");
    } finally {
      delete process.env.HYVENTO_DEV_TOOLS;
    }
  });

  it("nadando no sale", { timeout: 20000 }, async () => {
    const { room, clients } = await setup(["Alice"]);
    const [alice] = clients as [ClientRoom];
    me(room, alice).swimming = true;
    expect((await go(alice, room, { kind: "place", id: ESTACION_DESTINO })).notice?.code).toBe("swimming");
  });
});
