import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import { BUS, BUS_MSG, BUS_TIMINGS, MSG, ROOM_NAME, type BusNotice } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

/** Tiempos cortos: el bus llega, abre, cierra y da la vuelta en fracciones de segundo. */
const T = { approachMs: 60, openMs: 700, closingMs: 60, departMs: 60, tripMs: 400, doorsMs: 20 };

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
  OfficeRoom.busTimings = T;
  // El bus solo sale cuando el test lo manda (ni por horario ni de refuerzo).
  OfficeRoom.busSchedule = { firstInMs: 10_000_000, maxWaitMs: 10_000_000 };
});
afterEach(() => {
  OfficeRoom.busTimings = { ...BUS_TIMINGS };
  OfficeRoom.busSchedule = { firstInMs: BUS.firstInMs, maxWaitMs: BUS.maxWaitMs };
});

const jardin = getWorld().areas.get("jardin")!;
const inside = getWorld().areas.get(BUS.area)!;
const stop = pointsOfType(jardin, "bus_stop")[1]!;

/** Espera (con el reloj real de la sala) hasta que se cumpla la condición. */
async function until(cond: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("no pasó a tiempo");
    await tick(10);
  }
}

async function setup() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const bus = (room as unknown as OfficeRoom).bus;
  const connect = async (name: string, opts: Record<string, unknown> = {}) => {
    const client = await colyseus.connectTo(room, { token: await token(`u-${name}`, name), ...opts });
    const notices: BusNotice["code"][] = [];
    client.onMessage(BUS_MSG.notice, (n: BusNotice) => notices.push(n.code));
    await room.waitForNextPatch();
    return { client, notices, me: () => room.state.players.get(client.sessionId)! };
  };
  /** Hace llegar el bus y espera a que abra del todo las puertas. */
  const arrive = async () => {
    bus.dispatch();
    await until(() => bus.doorsOpen());
  };
  return { room, bus, connect, arrive };
}

describe("Megabús", () => {
  it("solo se sube estando en la estación y con las puertas abiertas", async () => {
    const { room, bus, connect, arrive } = await setup();
    const ana = await connect("Ana");
    await walkToTile(ana.client, room, stop.tileX, stop.tileY);
    expect(ana.me().area).toBe("jardin");
    // Sin bus: no.
    ana.client.send(BUS_MSG.board, {});
    await tick(60);
    expect(ana.notices).toEqual(["noBus"]);
    expect(ana.me().area).toBe("jardin");
    // Desde lejos: tampoco.
    const beto = await connect("Beto");
    await arrive();
    beto.client.send(BUS_MSG.board, {});
    await tick(60);
    expect(beto.notices).toEqual(["far"]);
    expect(beto.me().area).toBe("jardin");
    // En la estación con las puertas abiertas: se entra al bus.
    ana.client.send(BUS_MSG.board, {});
    await tick(60);
    expect(ana.me().area).toBe(BUS.area);
    expect(bus.phase).toBe("open");
  });

  it("no se baja en ruta: el bus da la vuelta y al volver a la estación sí se baja", async () => {
    const { room, bus, connect, arrive } = await setup();
    const ana = await connect("Ana");
    await walkToTile(ana.client, room, stop.tileX, stop.tileY);
    await arrive();
    ana.client.send(BUS_MSG.board, {});
    await tick(60);
    expect(ana.me().area).toBe(BUS.area);
    const door = inside.portals[1]!;
    await walkToTile(ana.client, room, door.tiles[0]!.x, door.tiles[0]!.y);
    // Cierra con ella adentro: se va de ruta.
    await until(() => bus.phase === "route");
    ana.client.send(MSG.travel, { portal: door.id });
    await tick(60);
    expect(ana.notices).toContain("route");
    expect(ana.me().area).toBe(BUS.area);
    // Vuelve a la estación y abre: ahora sí.
    await until(() => bus.doorsOpen());
    ana.client.send(MSG.travel, { portal: door.id });
    await tick(60);
    expect(ana.me().area).toBe("jardin");
    expect(Math.floor(ana.me().x / jardin.tileSize)).toBe(door.to.x);
    expect(Math.floor(ana.me().y / jardin.tileSize)).toBe(door.to.y);
    // Ya sin nadie a bordo, el bus sigue de largo.
    await until(() => bus.phase === "leaving" || bus.phase === "away");
  });

  it("quien se va de la cabaña a bordo no deja al bus dando vueltas", async () => {
    const { room, bus, connect, arrive } = await setup();
    // Alguien se queda en el jardín (sin nadie, la sala se cierra).
    await connect("Beto");
    const ana = await connect("Ana");
    await walkToTile(ana.client, room, stop.tileX, stop.tileY);
    await arrive();
    ana.client.send(BUS_MSG.board, {});
    await tick(60);
    expect(ana.me().area).toBe(BUS.area);
    await ana.client.leave(true);
    const seen = new Set<string>();
    await until(() => {
      seen.add(bus.phase);
      return bus.phase === "leaving" || bus.phase === "away";
    });
    expect(seen.has("route")).toBe(false);
  });

  it("con \"Llegar en bus\" se aparece adentro y el bus trae a la gente a la estación", async () => {
    const { bus, connect } = await setup();
    OfficeRoom.busSchedule = { firstInMs: 10_000_000, maxWaitMs: 0 };
    const ana = await connect("Ana", { arriveByBus: true });
    expect(ana.me().area).toBe(BUS.area);
    // Salió un bus de refuerzo: llega y abre las puertas.
    expect(bus.run).toBe(1);
    await until(() => bus.doorsOpen());
  });
});
