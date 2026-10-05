// La Noche de velitas en la sala (ver rooms/velitas.ts): el regalo al abrir y al entrar, prender velitas
// (solo con el festival abierto, cerquita, en tiles libres, con los topes), las metas del equipo y el farol
// de deseos desde el muelle. Primero con la clase sola (rápido, para los topes) y después en la sala.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType, velitaBlock, type OfficeMap } from "@hyvento/map";
import {
  DIAS_POR_ESTACION,
  FAROL_DESEOS,
  FAROL_ITEM,
  FESTIVAL_MSG,
  ROOM_NAME,
  SEASONS,
  VELITA_ITEM,
  VELITAS,
  VELITAS_CINE,
  VELITAS_MSG,
  type FarolEvent,
  type FestivalCineEvent,
  type VelitasNotice,
} from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { Velitas, type VelitasPlayer } from "../src/rooms/velitas";
import { VelitasState, type OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, token, until, walkToTile, type ServerRoom } from "./helpers";

const jardin = getWorld().areas.get("jardin")!;
const TS = jardin.tileSize;
const center = (t: number) => (t + 0.5) * TS;

/** Tiles libres del jardín para velitas (para poner gente al lado). */
const freeTiles: { x: number; y: number }[] = [];
for (let y = 30; y < 90 && freeTiles.length < 400; y++) for (let x = 20; x < 100; x += 2) if (!velitaBlock(jardin, x, y)) freeTiles.push({ x, y });

// ---------- La clase sola ----------

function fake(opts: { festival?: string; fase?: string } = {}) {
  const state = new VelitasState();
  const festival = { id: opts.festival ?? "velitas", fase: opts.fase ?? "fiesta" };
  const players = new Map<string, VelitasPlayer>();
  const bags = new Map<string, Map<string, number>>();
  const hands = new Map<string, string>();
  const sent: { to: string; type: string; msg: unknown }[] = [];
  const broadcast: { type: string; msg: unknown }[] = [];
  let now = 1_000_000;
  const bag = (u: string) => bags.get(u) ?? bags.set(u, new Map()).get(u)!;
  const v = new Velitas({
    state: () => state,
    festival: () => festival,
    player: (id) => players.get(id),
    players: () => players.entries(),
    mapOf: (): OfficeMap => jardin,
    held: {
      count: (u, item) => bag(u).get(item) ?? 0,
      fits: () => "ok",
      add: async (u, item, n = 1) => {
        bag(u).set(item, (bag(u).get(item) ?? 0) + n);
        return "ok";
      },
      take: async (u, item, n = 1) => {
        const have = bag(u).get(item) ?? 0;
        if (have < n) return false;
        bag(u).set(item, have - n);
        return true;
      },
      hand: (u) => (hands.get(u) ? { itemId: `obj:${hands.get(u)}`, id: hands.get(u)!, art: hands.get(u)!, left: 1 } : null),
    },
    send: (to, type, msg) => sent.push({ to, type, msg }),
    broadcast: (type, msg) => broadcast.push({ type, msg }),
    now: () => (now += VELITAS.pausaMs + 1),
  });
  /** Una persona parada en el centro de un tile libre del jardín. */
  const join = (n: number, tile = freeTiles[n]!) => {
    const p: VelitasPlayer = { userId: `u${n}`, name: `P${n}`, area: "jardin", x: center(tile.x), y: center(tile.y) };
    players.set(`s${n}`, p);
    return { sid: `s${n}`, p, tile };
  };
  const notices = (sid: string) => sent.filter((s) => s.to === sid && s.type === VELITAS_MSG.notice).map((s) => (s.msg as VelitasNotice).code);
  return { v, state, festival, players, bag, hands, sent, broadcast, join, notices };
}

describe("Noche de velitas: las reglas en la sala", () => {
  it("al abrir regala velitas y un farol a quien está, completando sin duplicar", async () => {
    const f = fake({ fase: "previa" });
    const a = f.join(0);
    f.bag("u0").set(VELITA_ITEM, 5);
    f.v.festivalChanged("velitas", "previa");
    await tick(0);
    expect(f.bag("u0").get(VELITA_ITEM)).toBe(5);
    f.festival.fase = "fiesta";
    f.v.festivalChanged("velitas", "fiesta");
    await tick(0);
    expect(f.bag("u0").get(VELITA_ITEM)).toBe(VELITAS.regalo);
    expect(f.bag("u0").get(FAROL_ITEM)).toBe(1);
    expect(f.notices(a.sid)).toContain("regalo");
    // Entrar otra vez no da más.
    f.v.joined("u0");
    await tick(0);
    expect(f.bag("u0").get(VELITA_ITEM)).toBe(VELITAS.regalo);
    expect(f.bag("u0").get(FAROL_ITEM)).toBe(1);
  });

  it("se prende cerquita y en un tile libre; no dos en el mismo ni sobre un punto", async () => {
    const f = fake();
    const a = f.join(0);
    f.bag("u0").set(VELITA_ITEM, 3);
    await f.v.place(a.sid, { x: a.tile.x, y: a.tile.y });
    expect(f.state.lit).toBe(1);
    expect(f.state.placed.get(`${a.tile.x},${a.tile.y}`)?.by).toBe("u0");
    expect(f.bag("u0").get(VELITA_ITEM)).toBe(2);
    await f.v.place(a.sid, { x: a.tile.x, y: a.tile.y });
    await f.v.place(a.sid, { x: a.tile.x + 5, y: a.tile.y });
    const spawn = pointsOfType(jardin, "spawn")[0]!;
    f.players.get(a.sid)!.x = spawn.x + TS;
    f.players.get(a.sid)!.y = spawn.y;
    await f.v.place(a.sid, { x: spawn.tileX, y: spawn.tileY });
    expect(f.notices(a.sid)).toEqual(["ocupado", "lejos", "bloqueado"]);
    expect(f.state.lit).toBe(1);
    expect(f.bag("u0").get(VELITA_ITEM)).toBe(2);
  });

  it("sin el festival abierto, sin velitas o fuera del jardín no se prende", async () => {
    const f = fake({ fase: "fin" });
    const a = f.join(0);
    f.bag("u0").set(VELITA_ITEM, 3);
    await f.v.place(a.sid, { x: a.tile.x, y: a.tile.y });
    f.festival.fase = "fiesta";
    f.bag("u0").set(VELITA_ITEM, 0);
    await f.v.place(a.sid, { x: a.tile.x, y: a.tile.y });
    f.bag("u0").set(VELITA_ITEM, 3);
    f.players.get(a.sid)!.area = "planta-baja";
    await f.v.place(a.sid, { x: a.tile.x, y: a.tile.y });
    expect(f.notices(a.sid)).toEqual(["cerrado", "sinVelitas", "lejos"]);
    expect(f.state.lit).toBe(0);
  });

  it("cada quien tiene su tope de velitas prendidas", async () => {
    const f = fake();
    f.join(0);
    f.bag("u0").set(VELITA_ITEM, VELITAS.porPersona + 5);
    for (let i = 0; i <= VELITAS.porPersona; i++) {
      const t = freeTiles[i]!;
      Object.assign(f.players.get("s0")!, { x: center(t.x), y: center(t.y) });
      await f.v.place("s0", { x: t.x, y: t.y });
    }
    expect(f.state.lit).toBe(VELITAS.porPersona);
    expect(f.notices("s0")).toEqual(["tope"]);
  });

  it("al llegar a las metas del equipo sale la cinemática para todos, una vez; al terminar el festival se borra todo", async () => {
    const f = fake();
    for (let n = 0; n < 101; n++) {
      const { sid, tile } = f.join(n);
      f.bag(`u${n}`).set(VELITA_ITEM, 1);
      await f.v.place(sid, { x: tile.x, y: tile.y });
    }
    expect(f.state.lit).toBe(101);
    const cines = f.broadcast.filter((b) => b.type === FESTIVAL_MSG.cine).map((b) => (b.msg as FestivalCineEvent).id);
    expect(cines).toEqual([VELITAS_CINE.meta(50), VELITAS_CINE.meta(100)]);
    f.v.festivalChanged("velitas", "fin");
    expect(f.state.lit).toBe(101);
    f.v.festivalChanged("", "");
    expect(f.state.lit).toBe(0);
    expect(f.state.placed.size).toBe(0);
  });

  it("el farol de deseos: en la mano, desde el muelle, con un deseo limpio y uno por persona", async () => {
    const f = fake();
    const tip = pointsOfType(jardin, "fishing_spot").find((p) => p.name === "Muelle")!;
    const a = f.join(0);
    f.bag("u0").set(FAROL_ITEM, 1);
    await f.v.wish(a.sid, { text: "salud" });
    f.hands.set("u0", FAROL_DESEOS);
    await f.v.wish(a.sid, { text: "salud" });
    Object.assign(f.players.get(a.sid)!, { x: tip.x, y: tip.y });
    await f.v.wish(a.sid, { text: "entren a www.algo.com" });
    await f.v.wish(a.sid, { text: "   " });
    await f.v.wish(a.sid, { text: "  Que   estemos todos juntos  " });
    await f.v.wish(a.sid, { text: "otro" });
    expect(f.notices(a.sid)).toEqual(["sinFarol", "muelle", "enlace", "vacio", "soltado", "yaDeseo"]);
    expect(f.state.wishes.get("u0")?.text).toBe("Que estemos todos juntos");
    expect(f.bag("u0").get(FAROL_ITEM)).toBe(0);
    const farol = f.broadcast.find((b) => b.type === VELITAS_MSG.farol)!.msg as FarolEvent;
    expect(farol).toMatchObject({ sessionId: a.sid, name: "P0", text: "Que estemos todos juntos" });
    // Ya soltado, el regalo no le vuelve a dar farol.
    await f.v.gift("u0");
    expect(f.bag("u0").get(FAROL_ITEM)).toBe(0);
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
const NOON = Date.UTC(2026, 8, 26, 17, 0);
/** El día del juego de la Noche de velitas (día 7 del invierno del año 1). */
const VELITAS_DAY = SEASONS.indexOf("invierno") * DIAS_POR_ESTACION + 6;

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
  OfficeRoom.gameClockNow = () => NOON;
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
});

async function enter(day: number) {
  OfficeRoom.gameClockInitial = { anchorReal: NOON, anchorMinute: day * 1440 + 12 * 60 };
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const notices: VelitasNotice[] = [];
  const farols: FarolEvent[] = [];
  alice.onMessage(VELITAS_MSG.notice, (n: VelitasNotice) => notices.push(n));
  alice.onMessage(VELITAS_MSG.farol, (e: FarolEvent) => farols.push(e));
  alice.onMessage(FESTIVAL_MSG.cine, () => undefined);
  const me = () => room.state.players.get(alice.sessionId)!;
  return { room, alice, notices, farols, me };
}

describe("Noche de velitas en la sala", () => {
  it("el día del festival: llegan las velitas, se prende una al lado y se suelta el farol desde el muelle", async () => {
    const { room, alice, notices, farols, me } = await enter(VELITAS_DAY);
    expect(room.state.festival).toBe("velitas");
    await until(() => bagOf(room).count("u-alice", VELITA_ITEM) === VELITAS.regalo, "las velitas del regalo");
    expect(bagOf(room).count("u-alice", FAROL_ITEM)).toBe(1);
    // Una velita en el tile de al lado que esté libre.
    const tx = Math.floor(me().x / TS);
    const ty = Math.floor(me().y / TS);
    const spot = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: tx + dx!, y: ty + dy! }))
      .find((t) => !velitaBlock(jardin, t.x, t.y))!;
    alice.send(VELITAS_MSG.place, spot);
    await until(() => room.state.velitas.lit === 1, "la velita prendida");
    expect(room.state.velitas.placed.get(`${spot.x},${spot.y}`)?.by).toBe("u-alice");
    await until(() => bagOf(room).count("u-alice", VELITA_ITEM) === VELITAS.regalo - 1, "la velita gastada");
    // El farol: al muelle (al lado del farol de la punta), en la mano, y el deseo.
    const tip = pointsOfType(jardin, "fishing_spot").find((p) => p.name === "Muelle")!;
    await walkToTile(alice, room, tip.tileX - 4, tip.tileY);
    await holdItem(alice, room, FAROL_ITEM);
    alice.send(VELITAS_MSG.wish, { text: "Que la cabaña siga llena de gente bonita" });
    await until(() => farols.length === 1, "el farol que sube");
    expect(farols[0]).toMatchObject({ name: "Alice", text: "Que la cabaña siga llena de gente bonita" });
    expect(room.state.velitas.wishes.get("u-alice")?.text).toBe("Que la cabaña siga llena de gente bonita");
    expect(notices.map((n) => n.code)).toContain("soltado");
  });

  it("un día sin festival no regala ni deja prender", async () => {
    const { room, alice, notices, me } = await enter(VELITAS_DAY - 1);
    expect(room.state.festival).toBe("");
    await repo.addInventory("u-alice", VELITA_ITEM, 3);
    alice.send(VELITAS_MSG.place, { x: Math.floor(me().x / TS) + 1, y: Math.floor(me().y / TS) });
    await until(() => notices.length > 0, "el aviso");
    expect(notices[0]!.code).toBe("cerrado");
    expect(room.state.velitas.lit).toBe(0);
    expect(bagOf(room).count("u-alice", VELITA_ITEM)).toBe(0);
  });
});
