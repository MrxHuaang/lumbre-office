// La gente de la fiesta en la sala (rooms/genteFiesta.ts): los pedidos se validan con la misma pose que ve
// el navegador (lejos no, sin los objetos no, dos veces no, con el festival cerrado no) y el vendedor de la
// fiesta deja comprar en el puesto del festival desde donde está él.
import type { ColyseusTestServer } from "@colyseus/testing";
import { genteDelNivel, getWorld, pointsOfType } from "@hyvento/map";
import {
  BRUJAS_MSG,
  DIAS_POR_ESTACION,
  GENTE_MSG,
  ROOM_NAME,
  SEASONS,
  brujasShopItem,
  pedidoStatKey,
  type BrujasBuyResult,
  type EntregarResult,
  type GenteHechos,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const BRUJAS_DAY = dayOf("otono", 21);
const VELITAS_DAY = dayOf("invierno", 7);

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
  now = 10_000_000;
  OfficeRoom.genteNow = () => now;
  OfficeRoom.brujasNow = () => now;
  OfficeRoom.gameClockNow = () => NOON;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.genteNow = () => Date.now();
  OfficeRoom.brujasNow = () => Date.now();
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.weatherInitial = null;
});

async function waitFor<T>(fn: () => T | undefined, ms = 4000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > until) throw new Error("No llegó a tiempo");
    await tick(15);
  }
}

/** Una sala el día `day` a la hora `hour` del juego, con Alice adentro. */
async function setup(opts: { day?: number; hour?: number; points?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? BRUJAS_DAY) * 1440 + (opts.hour ?? 12) * 60 };
  if (opts.points) await repo.awardPoints({ userId: "u-alice", amount: opts.points, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  return { room, alice, ...listen(alice) };
}

function listen(client: ClientRoom) {
  const results: EntregarResult[] = [];
  const buys: BrujasBuyResult[] = [];
  const hechos: GenteHechos[] = [];
  client.onMessage(GENTE_MSG.resultado, (r: EntregarResult) => results.push(r));
  client.onMessage(GENTE_MSG.hechos, (r: GenteHechos) => hechos.push(r));
  client.onMessage(BRUJAS_MSG.buyResult, (r: BrujasBuyResult) => buys.push(r));
  const ask = async <T>(list: T[], type: string, msg: unknown = {}) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    now += 5000;
    return r;
  };
  return {
    entregar: (npc: string, pedido: string) => ask(results, GENTE_MSG.entregar, { npc, pedido }),
    buy: (item: string) => ask(buys, BRUJAS_MSG.buy, { item }),
    hechos: () => ask(hechos, GENTE_MSG.hechos),
  };
}

/** El tile donde está ese NPC de la fiesta a mediodía (está quieto) y uno libre al lado. */
function besideNpc(festival: string, day: number, id: string, area = "jardin") {
  const map = getWorld().areas.get(area)!;
  const nivel = genteDelNivel(map, festival, day, "despejado")!;
  const p = nivel.pose(id, 12 * 60);
  return { x: Math.floor(p.x / map.tileSize), y: Math.floor(p.y / map.tileSize) };
}

const count = (room: ServerRoom, itemId: string) => bagOf(room).count("u-alice", itemId);

describe("los pedidos de la gente de la fiesta", () => {
  it("lejos no; junto a Don Efraín sin las mazorcas, tampoco; con ellas sí (todo o nada) y una sola vez", async () => {
    const { room, alice, entregar, hechos } = await setup();
    expect(room.state.festival).toBe("brujas");
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toEqual({ ok: false, npc: "brujas:efrain", error: "far" });
    const at = besideNpc("brujas", BRUJAS_DAY, "brujas:efrain");
    await walkToTile(alice, room, at.x + 1, at.y);
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toEqual({ ok: false, npc: "brujas:efrain", error: "faltan" });
    await bagOf(room).add("u-alice", "obj:mazorca", 1);
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toMatchObject({ ok: false, error: "faltan" });
    expect(count(room, "obj:mazorca")).toBe(1);
    await bagOf(room).add("u-alice", "obj:mazorca", 2);
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toEqual({ ok: true, npc: "brujas:efrain", pedido: "mazorcas-efrain", item: "obj:empanada", n: 2, puntos: 0, capped: false });
    expect(count(room, "obj:mazorca")).toBe(1);
    expect(count(room, "obj:empanada")).toBe(2);
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toMatchObject({ ok: false, error: "hecho" });
    expect(count(room, "obj:empanada")).toBe(2);
    expect((await hechos()).pedidos).toEqual(["mazorcas-efrain"]);
    // Un pedido que no es de ese NPC, o alguien que no está en la fiesta.
    expect(await entregar("brujas:efrain", "fresas-ramiro")).toMatchObject({ ok: false, error: "unknown" });
    expect(await entregar("brujas:nadie", "x")).toMatchObject({ ok: false, error: "unknown" });
  });

  it("los puntos van como LEISURE y la marca queda en UserStat del festival", async () => {
    const { room, alice, entregar } = await setup({ day: VELITAS_DAY });
    expect(room.state.festival).toBe("velitas");
    const at = besideNpc("velitas", VELITAS_DAY, "velitas:ramiro");
    await walkToTile(alice, room, at.x, at.y + 1);
    await bagOf(room).add("u-alice", "obj:tinto", 1);
    expect(await entregar("velitas:ramiro", "tinto-ramiro")).toMatchObject({ ok: true, puntos: 8, capped: false });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: 8, reason: "LEISURE" });
    expect(count(room, "obj:tinto")).toBe(0);
    const ach = (room as unknown as { achievements: { stat(u: string, k: string): number | undefined } }).achievements;
    expect(ach.stat("u-alice", pedidoStatKey("velitas", 1, "tinto-ramiro"))).toBe(1);
  });

  it("con el festival cerrado (o sin festival) no hay pedidos", async () => {
    const { entregar } = await setup({ hour: 23 });
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toEqual({ ok: false, npc: "brujas:efrain", error: "off" });
  });

  it("un día sin festival, tampoco", async () => {
    const { room, entregar } = await setup({ day: dayOf("otono", 3) });
    expect(room.state.festival).toBe("");
    expect(await entregar("brujas:efrain", "mazorcas-efrain")).toMatchObject({ ok: false, error: "off" });
  });
});

describe("la acción del puesto: el vendedor de la fiesta", () => {
  it("se compra en el puesto del caldero junto a la bruja aunque el punto quede lejos; lejos de los dos, no", async () => {
    const { room, alice, buy } = await setup({ points: 500 });
    expect(await buy("chupeta")).toEqual({ ok: false, item: "chupeta", error: "far" });
    const bruja = besideNpc("brujas", BRUJAS_DAY, "brujas:rubiela");
    const spot = { x: bruja.x, y: bruja.y - 1 };
    const stand = pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")[0]!;
    // Desde ahí el punto del puesto no se alcanza: es la bruja la que vende.
    expect(Math.hypot(spot.x - stand.tileX, spot.y - stand.tileY)).toBeGreaterThan(2);
    await walkToTile(alice, room, spot.x, spot.y);
    const chupeta = brujasShopItem("chupeta")!;
    expect(await buy("chupeta")).toEqual({ ok: true, item: "chupeta", balance: 500 - chupeta.price });
  });
});
