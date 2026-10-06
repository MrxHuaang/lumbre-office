// La Feria de las flores en la sala (ver rooms/feriaFlores.ts): el puesto de semillas (solo con la feria),
// armar la silleta con las flores de la mochila, exhibirla (una por persona), votar (una vez, nunca por la
// propia), la premiación de la más votada al cierre, el desfile de las 16:00 y las flores de a ramito.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType, standOfPoint } from "@hyvento/map";
import {
  DIAS_POR_ESTACION,
  FERIA,
  FERIA_CINE,
  FERIA_MSG,
  FESTIVAL_MSG,
  ROOM_NAME,
  SEASONS,
  STAT_KEYS,
  feriaShopItem,
  feriaVoteKey,
  objItemId,
  seedsOf,
  silletaFlowers,
  silletaId,
  standKey,
  type BuildResult,
  type ExhibitResult,
  type FeriaBuyResult,
  type FeriaMine,
  type FestivalCineEvent,
  type VoteResult,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 10_000_000;
let clock = 0;

const NOON = Date.UTC(2026, 8, 26, 17, 0);
/** Lo que dura un minuto del juego en ms reales (1 hora del juego = 2,5 minutos). */
const GAME_MINUTE_MS = 2_500;
const dayOf = (season: (typeof SEASONS)[number], dia: number) => SEASONS.indexOf(season) * DIAS_POR_ESTACION + (dia - 1);
const FERIA_DAY = dayOf("primavera", 15);

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
  clock = NOON;
  OfficeRoom.feriaNow = () => now;
  OfficeRoom.feriaPremiacionMs = 0;
  OfficeRoom.gameClockNow = () => clock;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.feriaNow = () => Date.now();
  OfficeRoom.feriaPremiacionMs = FERIA.premiacionDelayMs;
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

type Inner = { festivales: { tick(): void }; syncFestival(): void; feria: { tick(): void }; achievements: { flushAll(): Promise<void> } };

/** Una sala del día `day` (por defecto, la feria) a la hora `hour` del juego. */
async function setup(opts: { day?: number; hour?: number } = {}) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: (opts.day ?? FERIA_DAY) * 1440 + (opts.hour ?? 12) * 60 };
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  return { room, inner: room as unknown as Inner };
}

async function join(room: ServerRoom, userId: string, name: string, opts: { points?: number; flowers?: Record<string, number> } = {}) {
  if (opts.points) await repo.awardPoints({ userId, amount: opts.points, reason: "ADMIN" });
  for (const [f, n] of Object.entries(opts.flowers ?? {})) await repo.addInventory(userId, objItemId(f), n);
  const client = await colyseus.connectTo(room, { token: await token(userId, name) });
  await room.waitForNextPatch();
  return { client, userId, ...listen(client) };
}

function listen(client: ClientRoom) {
  const builds: BuildResult[] = [];
  const exhibits: ExhibitResult[] = [];
  const votes: VoteResult[] = [];
  const buys: FeriaBuyResult[] = [];
  const mine: FeriaMine[] = [];
  const cines: FestivalCineEvent[] = [];
  const avisos: unknown[] = [];
  client.onMessage(FERIA_MSG.buildResult, (r: BuildResult) => builds.push(r));
  client.onMessage(FERIA_MSG.exhibitResult, (r: ExhibitResult) => exhibits.push(r));
  client.onMessage(FERIA_MSG.voteResult, (r: VoteResult) => votes.push(r));
  client.onMessage(FERIA_MSG.buyResult, (r: FeriaBuyResult) => buys.push(r));
  client.onMessage(FERIA_MSG.mine, (r: FeriaMine) => mine.push(r));
  client.onMessage(FERIA_MSG.desfile, (r: unknown) => avisos.push(r));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => cines.push(e));
  const ask = async <T>(list: T[], type: string, msg: unknown) => {
    const before = list.length;
    client.send(type, msg);
    const r = await waitFor(() => list[before]);
    now += FERIA.cooldownMs + 1;
    return r;
  };
  return {
    cines,
    avisos,
    mine,
    build: (code: string) => ask(builds, FERIA_MSG.build, { code }),
    exhibit: (stand: string) => ask(exhibits, FERIA_MSG.exhibit, { stand }),
    vote: (stand: string) => ask(votes, FERIA_MSG.vote, { stand }),
    buy: (item: string) => ask(buys, FERIA_MSG.buy, { item }),
  };
}

const jardin = () => getWorld().areas.get("jardin")!;
const point = (type: "silletero_table" | "feria_shop") => pointsOfType(jardin(), type)[0]!;
/** El punto de un exhibidor (`i`, de 0 a 5) y su clave. */
const stand = (i: number) => {
  const p = pointsOfType(jardin(), "silleta_stand")[i]!;
  const s = standOfPoint(p);
  return { x: p.tileX, y: p.tileY, key: standKey(s.x, s.y) };
};
const count = (room: ServerRoom, userId: string, itemId: string) => bagOf(room).count(userId, itemId);

describe("el puesto de las semillas de flores", () => {
  it("solo vende con la feria abierta; junto al puesto cobra (PURCHASE, festival:feria-flores:<id>) y da a la mochila", async () => {
    const { room } = await setup({ day: FERIA_DAY - 1 });
    const alice = await join(room, "u-alice", "Alice", { points: 200 });
    expect(room.state.festival).toBe("");
    expect(await alice.buy(seedsOf("clavel"))).toEqual({ ok: false, item: seedsOf("clavel"), error: "off" });
    expect(await repo.getPoints("u-alice")).toBe(200);
  });

  it("en la feria: lejos no, junto al puesto sí", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { points: 200 });
    expect([room.state.festival, room.state.festivalFase]).toEqual([FERIA.id, "fiesta"]);
    const item = seedsOf("hortensia");
    expect(await alice.buy(item)).toEqual({ ok: false, item, error: "far" });
    const shop = point("feria_shop");
    await walkToTile(alice.client, room, shop.tileX, shop.tileY);
    const price = feriaShopItem(item)!.price;
    expect(await alice.buy(item)).toEqual({ ok: true, item, balance: 200 - price });
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -price, reason: "PURCHASE", refId: `festival:feria-flores:${item}` });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId(item))).toBe(1);
    // Lo que no es de la feria no se vende ahí.
    const before = repo.ledger.length;
    alice.client.send(FERIA_MSG.buy, { item: seedsOf("tomate") });
    await tick(80);
    expect(repo.ledger.length).toBe(before);
  });
});

describe("armar la silleta en la mesa del silletero", () => {
  it("gasta las flores elegidas y la silleta queda en la mano, con su código", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice", { flowers: { clavel: 6, girasol: 2 } });
    const code = "cccccc-gg---";
    expect(await alice.build(code)).toEqual({ ok: false, error: "far" });
    const table = point("silletero_table");
    await walkToTile(alice.client, room, table.tileX, table.tileY);
    // Con muy pocas flores no es silleta, y con flores que no tiene dice cuáles faltan.
    expect(await alice.build("cc----------")).toEqual({ ok: false, error: "code" });
    expect(await alice.build("cccccchhh---")).toEqual({ ok: false, error: "flowers", missing: { hortensia: 3 } });
    expect(await alice.build(code)).toEqual({ ok: true, code });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId("clavel"))).toBe(0);
    expect(count(room, "u-alice", objItemId("girasol"))).toBe(0);
    expect(count(room, "u-alice", objItemId(silletaId(code)))).toBe(1);
    await room.waitForNextPatch();
    expect(room.state.players.get(alice.client.sessionId)!.held).toBe(silletaId(code));
    await waitFor(() => (alice.cines.some((c) => c.id === FERIA_CINE.armada) ? true : undefined));
    // Sin más flores, otra igual no sale.
    expect(await alice.build(code)).toMatchObject({ ok: false, error: "flowers" });
    await (room as unknown as Inner).achievements.flushAll();
    expect((await repo.loadAchievements("u-alice")).stats[STAT_KEYS.silletasBuilt]).toBe(1);
  });
});

describe("exhibir y votar", () => {
  async function conSilleta(room: ServerRoom, userId: string, name: string, code: string) {
    const p = await join(room, userId, name, { flowers: silletaFlowers(code) });
    const table = point("silletero_table");
    await walkToTile(p.client, room, table.tileX, table.tileY);
    expect(await p.build(code)).toMatchObject({ ok: true });
    await bagOf(room).flush(userId);
    await holdItem(p.client, room, objItemId(silletaId(code)));
    return p;
  }

  it("se exhibe la de la mano en un exhibidor libre (una por persona); los demás votan una vez y nunca por la propia", async () => {
    const { room } = await setup();
    const alice = await conSilleta(room, "u-alice", "Alice", "hhhhcccc----");
    const s0 = stand(0);
    expect(await alice.exhibit(s0.key)).toEqual({ ok: false, error: "far" });
    await walkToTile(alice.client, room, s0.x, s0.y);
    expect(await alice.exhibit(s0.key)).toEqual({ ok: true, stand: s0.key });
    expect(room.state.feria.exhibits.get(s0.key)).toMatchObject({ ownerId: "u-alice", ownerName: "Alice", code: "hhhhcccc----", votes: 0 });
    // Una por persona por feria.
    const s1 = stand(1);
    await walkToTile(alice.client, room, s1.x, s1.y);
    expect(await alice.exhibit(s1.key)).toEqual({ ok: false, error: "already" });

    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(bob.client, room, s0.x, s0.y);
    // Sin silleta en la mano no se exhibe; el exhibidor ocupado tampoco.
    expect(await bob.exhibit(s0.key)).toEqual({ ok: false, error: "taken" });
    await walkToTile(bob.client, room, s1.x, s1.y);
    expect(await bob.exhibit(s1.key)).toEqual({ ok: false, error: "none" });
    expect(await bob.vote(s1.key)).toEqual({ ok: false, error: "empty" });
    await walkToTile(bob.client, room, s0.x, s0.y);
    await waitFor(() => (room.state.players.size === 2 ? true : undefined));
    expect(await bob.vote(s0.key)).toEqual({ ok: true, stand: s0.key });
    expect(await bob.vote(s0.key)).toEqual({ ok: false, error: "voted" });
    expect(bob.mine.at(-1)).toEqual({ voted: true, stand: s0.key });
    expect(room.state.feria.exhibits.get(s0.key)!.votes).toBe(1);
    // Por la propia no se vale.
    await walkToTile(alice.client, room, s0.x, s0.y);
    expect(await alice.vote(s0.key)).toEqual({ ok: false, error: "own" });
    // El voto queda guardado (un voto por persona por feria, aunque se reconecte).
    await (room as unknown as Inner).achievements.flushAll();
    expect((await repo.loadAchievements("u-bob")).stats[feriaVoteKey(1)]).toBe(1);
  });

  it("al cierre gana la más votada: su cinemática para todos, el logro y el premio", async () => {
    const { room, inner } = await setup();
    const alice = await conSilleta(room, "u-alice", "Alice", "gggggaaa----");
    const s0 = stand(0);
    await walkToTile(alice.client, room, s0.x, s0.y);
    expect(await alice.exhibit(s0.key)).toMatchObject({ ok: true });
    const bob = await join(room, "u-bob", "Bob");
    await walkToTile(bob.client, room, s0.x, s0.y);
    expect(await bob.vote(s0.key)).toMatchObject({ ok: true });
    // Las 22:00 del juego: cierra la feria y, sin la espera de los tests, se premia.
    clock = NOON + 10 * 60 * GAME_MINUTE_MS + 1;
    inner.festivales.tick();
    inner.feria.tick();
    inner.feria.tick();
    expect(room.state.festivalFase).toBe("fin");
    const cine = await waitFor(() => bob.cines.find((c) => c.id === FERIA_CINE.premiacion));
    expect(cine.vars).toMatchObject({ ganador: "Alice", votos: 1, silleta: "gggggaaa----" });
    expect(alice.cines.some((c) => c.id === FERIA_CINE.premiacion)).toBe(true);
    await room.waitForNextPatch();
    expect([room.state.feria.winnerId, room.state.feria.winnerName, room.state.feria.winnerVotes]).toEqual(["u-alice", "Alice", 1]);
    await waitFor(() => (repo.ledger.some((m) => m.userId === "u-alice" && m.reason === "LEISURE") ? true : undefined));
    expect(repo.ledger.find((m) => m.userId === "u-alice" && m.reason === "LEISURE")).toMatchObject({ amount: FERIA.premio });
    await inner.achievements.flushAll();
    const a = await repo.loadAchievements("u-alice");
    expect(a.stats[STAT_KEYS.silleteroOro]).toBe(1);
    expect(a.unlocked).toContain("silletero-de-oro");
    // Una sola premiación por feria.
    inner.feria.tick();
    await tick(60);
    expect(bob.cines.filter((c) => c.id === FERIA_CINE.premiacion)).toHaveLength(1);
    // Ya cerrada, no se vota ni se exhibe.
    expect(await bob.vote(s0.key)).toEqual({ ok: false, error: "off" });
  });

  it("sin votos no hay premiación", async () => {
    const { room, inner } = await setup();
    const alice = await conSilleta(room, "u-alice", "Alice", "cccc--------");
    const s0 = stand(0);
    await walkToTile(alice.client, room, s0.x, s0.y);
    expect(await alice.exhibit(s0.key)).toMatchObject({ ok: true });
    clock = NOON + 10 * 60 * GAME_MINUTE_MS + 1;
    inner.festivales.tick();
    inner.feria.tick();
    await tick(80);
    expect(alice.cines.some((c) => c.id === FERIA_CINE.premiacion)).toBe(false);
    expect(room.state.feria.winnerId).toBe("");
  });
});

describe("el desfile de silleteros", () => {
  it("a las 16:00 del juego sale para los del jardín, una sola vez", async () => {
    const { room, inner } = await setup({ hour: 15 });
    const alice = await join(room, "u-alice", "Alice");
    clock = NOON + 59 * GAME_MINUTE_MS;
    inner.feria.tick();
    expect(alice.cines.some((c) => c.id === FERIA_CINE.desfile)).toBe(false);
    clock = NOON + 61 * GAME_MINUTE_MS;
    inner.feria.tick();
    await waitFor(() => (alice.cines.some((c) => c.id === FERIA_CINE.desfile) ? true : undefined));
    clock = NOON + 70 * GAME_MINUTE_MS;
    inner.feria.tick();
    await tick(60);
    expect(alice.cines.filter((c) => c.id === FERIA_CINE.desfile)).toHaveLength(1);
    // Alice está en el jardín: a ella no le llega el aviso de "pasa por el jardín".
    expect(alice.avisos).toHaveLength(0);
  });
});

describe("las flores en el huerto", () => {
  it("se cosechan de a ramito (sembradas con las semillas de la feria)", async () => {
    const { room } = await setup();
    const alice = await join(room, "u-alice", "Alice");
    await repo.addInventory("u-alice", objItemId(seedsOf("clavel")), 1);
    await bagOf(room).load("u-alice");
    await holdItem(alice.client, room, objItemId(seedsOf("clavel")));
    const plot = pointsOfType(jardin(), "garden_plot")[0]!;
    // La parcela: se usa con E desde al lado (ver huerto.test.ts).
    const huerto = (room as unknown as { huerto: { use(map: unknown, who: unknown, e: unknown, now: number): Promise<unknown>; plot(id: number): unknown } }).huerto;
    const who = { userId: "u-alice", name: "Alice", x: (plot.tileX + 0.5) * 32, y: (plot.tileY + 0.5) * 32 };
    const plotFurniture = jardin().furniture.find((f) => f.type === "garden-plot" && f.x === plot.tileX && f.y === plot.tileY)!;
    const e = { type: "garden-plot", x: plotFurniture.x, y: plotFurniture.y, action: "plot", seed: 1 };
    const t0 = Date.now();
    expect(await huerto.use(jardin(), who, e, t0)).toMatchObject({ ok: true, event: { garden: "plant", item: "clavel" } });
    expect(await huerto.use(jardin(), who, e, t0 + 60 * 60_000)).toMatchObject({ ok: true, event: { garden: "harvest", item: "clavel" } });
    await bagOf(room).flush("u-alice");
    expect(count(room, "u-alice", objItemId("clavel"))).toBe(3);
  });
});
