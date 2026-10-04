import type { ColyseusTestServer } from "@colyseus/testing";
import { buildCasaPropia, CASA_CONEXIONES, getWorld, pointsOfType } from "@hyvento/map";
import { BUS, BUS_MSG, BUS_TIMINGS, casaAreaOf, MSG, ROOM_NAME, type BusNotice } from "@hyvento/shared";
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

  it("no se baja en ruta: el bus va a la parada Casa y la deja en la suya", async () => {
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
    // Llega a la parada "Casa": aparece en la vereda de la suya.
    await until(() => ana.me().area === casaAreaOf("u-Ana"));
    const llegada = CASA_CONEXIONES.afuera.parada.llegada;
    const casa = buildCasaPropia(casaAreaOf("u-Ana"))!;
    expect(Math.abs(Math.floor(ana.me().x / casa.tileSize) - llegada.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.floor(ana.me().y / casa.tileSize) - llegada.y)).toBeLessThanOrEqual(1);
    // Ya sin nadie a bordo, el bus se pierde hasta el próximo.
    await until(() => bus.phase === "away");
  });

  it("los que suben juntos se bajan en la misma parada, cada uno en su casa", async () => {
    const { room, bus, connect, arrive } = await setup();
    const ana = await connect("Ana");
    const beto = await connect("Beto");
    await walkToTile(ana.client, room, stop.tileX, stop.tileY);
    await walkToTile(beto.client, room, stop.tileX + 1, stop.tileY);
    await arrive();
    ana.client.send(BUS_MSG.board, {});
    beto.client.send(BUS_MSG.board, {});
    await tick(60);
    expect([ana.me().area, beto.me().area]).toEqual([BUS.area, BUS.area]);
    await until(() => bus.phase === "route");
    expect(room.state.bus.to).toBe("casa");
    await until(() => ana.me().area !== BUS.area && beto.me().area !== BUS.area);
    expect(ana.me().area).toBe(casaAreaOf("u-Ana"));
    expect(beto.me().area).toBe(casaAreaOf("u-Beto"));
  });

  it("\"Esperar el bus\" en la parada de la casa lleva de vuelta a la estación", async () => {
    const { room, bus, connect, arrive } = await setup();
    OfficeRoom.busSchedule = { firstInMs: 10_000_000, maxWaitMs: 0 };
    const ana = await connect("Ana");
    // Lejos de su parada: no.
    ana.client.send(BUS_MSG.call, {});
    await tick(60);
    expect(ana.notices).toEqual(["home"]);
    // A su casa (en el bus) y a la parada.
    await walkToTile(ana.client, room, stop.tileX, stop.tileY);
    await arrive();
    ana.client.send(BUS_MSG.board, {});
    await until(() => ana.me().area === casaAreaOf("u-Ana"));
    await until(() => bus.phase === "away");
    const casa = buildCasaPropia(casaAreaOf("u-Ana"))!;
    const parada = pointsOfType(casa, "home_bus_stop")[0]!;
    await walkToTile(ana.client, room, parada.tileX, parada.tileY);
    ana.client.send(BUS_MSG.call, {});
    await until(() => ana.me().area === BUS.area, BUS.homeWaitMs + 2000);
    expect(ana.notices).toContain("coming");
    // Sale uno de refuerzo que la trae a la estación y abre: ahí se baja.
    await until(() => bus.doorsOpen(), 4000);
    const door = inside.portals[1]!;
    await walkToTile(ana.client, room, door.tiles[0]!.x, door.tiles[0]!.y);
    ana.client.send(MSG.travel, { portal: door.id });
    await until(() => ana.me().area === "jardin");
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
