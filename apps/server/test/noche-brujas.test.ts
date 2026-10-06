// La Noche de brujas en la sala (ver rooms/nocheBrujas.ts): la canasta al entrar, la decoración con el
// laberinto, la calabaza dorada (una por persona por festival), el dulce o truco a los NPC y por las puertas
// y el puesto del caldero, que solo vende con el festival abierto.
import type { ColyseusTestServer } from "@colyseus/testing";
import { festivalDecorNow, getWorld, pointsOfType, pumpkinSpotOf, type OfficeMap } from "@hyvento/map";
import {
  BRUJAS,
  BRUJAS_CINE,
  BRUJAS_MSG,
  CALABAZA_DORADA,
  CANASTA_DULCES,
  DIAS_POR_ESTACION,
  DULCES,
  FESTIVAL_MSG,
  MSG,
  PESCA_NPC,
  ROOM_NAME,
  SEASONS,
  STAT_KEYS,
  brujasShopItem,
  objItemId,
  pumpkinStatKey,
  type BrujasBuyResult,
  type FestivalCineEvent,
  type PumpkinResult,
  type TrickResult,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, toOfficeDoor, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;
/** Lo que sale del azar: el truco o dulce (`roll`, sobre 100) y cuál (`pick`). */
let roll = 99;
let pick = 0;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
/** El día del juego de (estación, día) en el año 1: la Noche de brujas es el 21 del otoño. */
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const BRUJAS_DAY = dayOf("otono", 21);

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
  roll = 99;
  pick = 0;
  OfficeRoom.brujasNow = () => now;
  OfficeRoom.brujasCanasta = true;
  OfficeRoom.brujasRandom = (n) => (n === 100 ? roll : pick);
  OfficeRoom.gameClockNow = () => NOON;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.brujasNow = () => Date.now();
  OfficeRoom.brujasCanasta = false;
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

/** Una sala a las 12:00 del juego del día `day` (por defecto, la Noche de brujas) con Alice adentro. */
async function setup(opts: { day?: number; points?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? BRUJAS_DAY) * 1440 + 12 * 60 };
  if (opts.points) await repo.awardPoints({ userId: "u-alice", amount: opts.points, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  return { room, alice, ...listen(alice), me: () => room.state.players.get(alice.sessionId)! };
}

function listen(client: ClientRoom) {
  const tricks: TrickResult[] = [];
  const pumpkins: PumpkinResult[] = [];
  const buys: BrujasBuyResult[] = [];
  const cines: string[] = [];
  client.onMessage(BRUJAS_MSG.trickResult, (r: TrickResult) => tricks.push(r));
  client.onMessage(BRUJAS_MSG.pumpkinResult, (r: PumpkinResult) => pumpkins.push(r));
  client.onMessage(BRUJAS_MSG.buyResult, (r: BrujasBuyResult) => buys.push(r));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => cines.push(e.id));
  const ask = async <T>(list: T[], type: string, msg: unknown = {}) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    now += BRUJAS.cooldownMs + 1;
    return r;
  };
  return {
    tricks,
    cines,
    trick: (npc: string) => ask(tricks, BRUJAS_MSG.trick, { npc }),
    pumpkin: () => ask(pumpkins, BRUJAS_MSG.pumpkin),
    buy: (item: string) => ask(buys, BRUJAS_MSG.buy, { item }),
  };
}

const count = (room: ServerRoom, itemId: string) => bagOf(room).count("u-alice", itemId);

describe("la Noche de brujas: el festival en la cabaña", () => {
  it("en plena fiesta: la canasta en la mano al entrar y el jardín con el laberinto, el puesto y la calabaza del día", async () => {
    const { room, me } = await setup();
    expect([room.state.festival, room.state.festivalFase, room.state.festivalDia]).toEqual(["brujas", "fiesta", BRUJAS_DAY]);
    expect(count(room, objItemId(CANASTA_DULCES))).toBe(1);
    expect(me().held).toBe(CANASTA_DULCES);
    expect(festivalDecorNow()).toEqual({ id: "brujas", day: BRUJAS_DAY });
    const jardin = getWorld().areas.get("jardin")!;
    expect(pointsOfType(jardin, "festival_shop")).toHaveLength(1);
    const spot = pumpkinSpotOf(BRUJAS_DAY);
    expect(pointsOfType(jardin, "golden_pumpkin")[0]).toMatchObject({ tileX: spot.point.x, tileY: spot.point.y });
    expect(jardin.furniture.some((f) => f.type === "golden-pumpkin" && f.x === spot.pumpkin.x && f.y === spot.pumpkin.y)).toBe(true);
  });

  it("un día sin festival no hay decoración, ni canasta, ni calabaza, ni puesto", async () => {
    const { room, pumpkin, buy, trick } = await setup({ day: BRUJAS_DAY - 1, points: 500 });
    expect(room.state.festival).toBe("");
    expect(festivalDecorNow()).toBeNull();
    expect(count(room, objItemId(CANASTA_DULCES))).toBe(0);
    expect(pointsOfType(getWorld().areas.get("jardin")!, "golden_pumpkin")).toHaveLength(0);
    expect(await pumpkin()).toEqual({ ok: false, error: "off" });
    expect(await buy("chupeta")).toEqual({ ok: false, item: "chupeta", error: "off" });
    expect(await trick("evelio")).toMatchObject({ ok: false, error: "off" });
    expect(await repo.getPoints("u-alice")).toBe(500);
  });
});

describe("al abrir y al cerrar el festival", () => {
  it("al prenderse en plena tarde: la canasta a los que ya estaban y la decoración; al apagarse, se quita", async () => {
    const { room, me } = await setup({ day: BRUJAS_DAY - 1 });
    expect(count(room, objItemId(CANASTA_DULCES))).toBe(0);
    const inner = room as unknown as { festivales: { force(id: string | null): void }; syncFestival(): void };
    inner.festivales.force("brujas");
    inner.syncFestival();
    await waitFor(() => (count(room, objItemId(CANASTA_DULCES)) === 1 ? true : undefined));
    await room.waitForNextPatch();
    expect(me().held).toBe(CANASTA_DULCES);
    expect(pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")).toHaveLength(1);
    // El mapa de la sala (con el que valida) también lo tiene.
    const own = (room as unknown as { mapOf(a: string): OfficeMap }).mapOf("jardin");
    expect(pointsOfType(own, "festival_shop")).toHaveLength(1);
    inner.festivales.force(null);
    inner.syncFestival();
    expect(festivalDecorNow()).toBeNull();
    expect(pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")).toHaveLength(0);
  });
});

describe("la calabaza dorada del laberinto", () => {
  it("lejos no se toma; junto a ella va a la mochila con su cinemática, una sola vez por festival", async () => {
    const { room, alice, pumpkin, cines } = await setup();
    expect(await pumpkin()).toEqual({ ok: false, error: "far" });
    const spot = pumpkinSpotOf(BRUJAS_DAY).point;
    await walkToTile(alice, room, spot.x, spot.y);
    expect(await pumpkin()).toEqual({ ok: true });
    await bagOf(room).flush("u-alice");
    expect(count(room, objItemId(CALABAZA_DORADA))).toBe(1);
    await waitFor(() => (cines.includes(BRUJAS_CINE.calabaza) ? true : undefined));
    expect(await pumpkin()).toEqual({ ok: false, error: "done" });
    expect(count(room, objItemId(CALABAZA_DORADA))).toBe(1);
    // Queda guardado (contador del logro y la marca del año), así no se repite al volver a entrar.
    await (room as unknown as { achievements: { flushAll(): Promise<void> } }).achievements.flushAll();
    const { stats } = await repo.loadAchievements("u-alice");
    expect(stats[STAT_KEYS.goldenPumpkins]).toBe(1);
    expect(stats[pumpkinStatKey(1)]).toBe(1);
    const unlocked = (await repo.loadAchievements("u-alice")).unlocked;
    expect(unlocked).toContain("calabaza-dorada");
  });
});

describe("dulce o truco", () => {
  it("a un NPC con la canasta en la mano: un dulce a la mochila, una vez por NPC; lejos no", async () => {
    const { room, alice, trick } = await setup();
    expect(await trick("evelio")).toMatchObject({ ok: false, error: "far" });
    const shop = pointsOfType(getWorld().areas.get("jardin")!, "fishing_shop")[0]!;
    await walkToTile(alice, room, shop.tileX, shop.tileY);
    const r = await trick("evelio");
    expect(r).toMatchObject({ ok: true, from: PESCA_NPC.name, npc: "evelio", outcome: { kind: "dulce", dulce: DULCES[0] } });
    expect(r.ok && r.line).toBeTruthy();
    await bagOf(room).flush("u-alice");
    expect(count(room, objItemId(DULCES[0]))).toBe(1);
    expect(await trick("evelio")).toMatchObject({ ok: false, error: "done" });
    // Doña Aurora está en la planta baja: desde el lago no se le pide.
    expect(await trick("aurora")).toMatchObject({ ok: false, error: "far" });
  });

  it("sin la canasta en la mano no se pide; el truco manda su cinemática y no da dulce", async () => {
    const { room, alice, trick, cines } = await setup();
    await repo.addInventory("u-alice", "obj:tinto", 1);
    await bagOf(room).load("u-alice");
    const shop = pointsOfType(getWorld().areas.get("jardin")!, "fishing_shop")[0]!;
    await walkToTile(alice, room, shop.tileX, shop.tileY);
    await holdItem(alice, room, "obj:tinto");
    expect(await trick("evelio")).toMatchObject({ ok: false, error: "basket" });
    await holdItem(alice, room, objItemId(CANASTA_DULCES));
    roll = 0;
    pick = 1;
    expect(await trick("evelio")).toMatchObject({ ok: true, outcome: { kind: "truco", truco: "trueno" } });
    await waitFor(() => (cines.includes(BRUJAS_CINE.truco("trueno")) ? true : undefined));
    for (const d of DULCES) expect(count(room, objItemId(d))).toBe(0);
  });

  it("tocando la puerta de una oficina abierta: dulce sin el aviso de 'está abierta', una vez por puerta", async () => {
    const { room, alice, tricks } = await setup();
    repo.assign("office-4", "u-bob", "Bob");
    await OfficeRoom.reloadOfficesEverywhere();
    const notices: unknown[] = [];
    alice.onMessage(MSG.knockResult, (r: unknown) => notices.push(r));
    await toOfficeDoor(alice, room, "office-4");
    alice.send(MSG.knock, { zoneId: "office-4" });
    const r = await waitFor(() => tricks[0]);
    expect(r).toMatchObject({ ok: true, from: "Bob", outcome: { kind: "dulce" } });
    now += BRUJAS.cooldownMs + 1;
    alice.send(MSG.knock, { zoneId: "office-4" });
    expect(await waitFor(() => tricks[1])).toMatchObject({ ok: false, error: "done" });
    await tick(60);
    expect(notices).toEqual([]);
  });
});

describe("el puesto del caldero", () => {
  it("junto al puesto cobra (PURCHASE, festival:brujas:<id>) y da a la mochila; el sombrero, uno solo; lejos no", async () => {
    const { room, alice, buy, me } = await setup({ points: 500 });
    expect(await buy("chupeta")).toEqual({ ok: false, item: "chupeta", error: "far" });
    const stand = pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")[0]!;
    await walkToTile(alice, room, stand.tileX, stand.tileY);
    const chupeta = brujasShopItem("chupeta")!;
    expect(await buy("chupeta")).toEqual({ ok: true, item: "chupeta", balance: 500 - chupeta.price });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -chupeta.price, reason: "PURCHASE", refId: "festival:brujas:chupeta" });
    await room.waitForNextPatch();
    expect(me().points).toBe(500 - chupeta.price);
    expect(await buy("sombrero-bruja")).toMatchObject({ ok: true });
    expect(await buy("sombrero-bruja")).toEqual({ ok: false, item: "sombrero-bruja", error: "owned" });
    await bagOf(room).flush("u-alice");
    expect(count(room, "obj:chupeta")).toBe(1);
    expect(count(room, "obj:sombrero-bruja")).toBe(1);
  });

  it("sin saldo no vende", async () => {
    const { room, alice, buy } = await setup({ points: 5 });
    const stand = pointsOfType(getWorld().areas.get("jardin")!, "festival_shop")[0]!;
    await walkToTile(alice, room, stand.tileX, stand.tileY);
    expect(await buy("gomitas")).toEqual({ ok: false, item: "gomitas", error: "funds" });
    expect(await repo.getPoints("u-alice")).toBe(5);
  });
});
