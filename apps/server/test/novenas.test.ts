// Las novenas en la sala: el pesebre que gana una figura por día (la pone el primero), la novena de las
// 20:00 del juego junto al pesebre, la natilla y los buñuelos solo en la novena (ver rooms/novenas.ts y
// rooms/cocina.ts) y, contra la sala de verdad, poner la figura con E.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, pointsOfType } from "@hyvento/map";
import {
  NOVENA,
  NOVENA_MSG,
  novenaCineId,
  PESEBRE_CINE,
  ROOM_NAME,
  STAT_KEYS,
  type CocinaNotice,
  type GameTime,
  type NovenaAviso,
  type NovenaCineEvent,
  type PesebreEstado,
  type PesebreGuardado,
} from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Cocina } from "../src/rooms/cocina";
import { Novenas, type NovenaPlayer } from "../src/rooms/novenas";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { Festivales } from "../src/rooms/festivales";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, token, until, walkToTile, type ServerRoom } from "./helpers";

const TS = 32;
const { x: PX, y: PY } = NOVENA.pesebre;
/** Un jugador parado en un tile del recibidor. */
const at = (userId: string, tx: number, ty: number, area = "planta-baja"): NovenaPlayer => ({ userId, name: userId.replace("u-", ""), area, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS });

function setup(opts: { dia?: number; minute?: number; saved?: unknown } = {}) {
  const time: GameTime = { day: 300, minuteOfDay: opts.minute ?? 10 * 60, hour: 0, minute: 0 };
  let dia = opts.dia ?? 1;
  const players = new Map<string, NovenaPlayer>();
  const sent: { to: string; type: string; msg: unknown }[] = [];
  const awardedOnce = new Set<string>();
  const leisure: { userId: string; amount: number }[] = [];
  const bumps: { userId: string; key: string }[] = [];
  const saved: PesebreGuardado[] = [];
  const n = new Novenas({
    dia: () => dia,
    time: () => time,
    players: () => players.entries(),
    tileSize: TS,
    broadcast: (type, msg) => sent.push({ to: "*", type, msg }),
    send: (to, type, msg) => sent.push({ to, type, msg }),
    awardOnce: async (userId, _amount, refId) => {
      const k = `${userId}:${refId}`;
      if (awardedOnce.has(k)) return false;
      awardedOnce.add(k);
      return true;
    },
    award: async (userId, amount) => (leisure.push({ userId, amount }), amount),
    bump: (userId, key) => bumps.push({ userId, key }),
    load: async () => opts.saved ?? null,
    save: async (data) => void saved.push(data),
  });
  const setMinute = (m: number) => {
    time.minuteOfDay = m;
    time.hour = Math.floor(m / 60);
  };
  return { n, time, players, sent, bumps, leisure, saved, awardedOnce, setMinute, setDia: (d: number) => void (dia = d) };
}

const ofType = <T>(sent: { type: string; msg: unknown }[], type: string) => sent.filter((s) => s.type === type).map((s) => s.msg as T);

describe("el pesebre de las novenas", () => {
  it("cada día suma su figura: la pone el primero que llega, con la cinemática para todos", async () => {
    const { n, sent, bumps, leisure, saved } = setup({ dia: 3 });
    expect(n.estado()).toEqual({ dia: 3, figuras: 2, por: "" });
    expect(await n.figura(at("u-ana", PX + 1, PY))).toBeNull();
    expect(n.estado()).toEqual({ dia: 3, figuras: 3, por: "ana" });
    expect(ofType<NovenaCineEvent>(sent, NOVENA_MSG.cine)).toEqual([{ id: PESEBRE_CINE, vars: { figura: "San José", nombre: "ana", dia: 3 } }]);
    expect(ofType<PesebreEstado>(sent, NOVENA_MSG.estado).at(-1)).toEqual({ dia: 3, figuras: 3, por: "ana" });
    expect(bumps).toContainEqual({ userId: "u-ana", key: STAT_KEYS.pesebreFiguras });
    expect(leisure).toEqual([{ userId: "u-ana", amount: NOVENA.puntosFigura }]);
    expect(saved).toEqual([{ day: 300, by: "u-ana", name: "ana" }]);
    // El segundo ya no: le dicen quién la puso.
    expect(await n.figura(at("u-beto", PX + 1, PY + 1))).toEqual({ code: "yaPuesta", por: "ana" });
  });

  it("al día siguiente toca la siguiente figura, y el último día llega el Niño", async () => {
    const { n, time, setDia, sent } = setup({ dia: 1 });
    await n.figura(at("u-ana", PX + 1, PY));
    time.day += 1;
    setDia(2);
    expect(n.estado()).toEqual({ dia: 2, figuras: 1, por: "" });
    expect(await n.figura(at("u-beto", PX + 1, PY))).toBeNull();
    time.day += 7;
    setDia(9);
    expect(await n.figura(at("u-ana", PX + 1, PY))).toBeNull();
    expect(n.estado().figuras).toBe(9);
    expect(ofType<NovenaCineEvent>(sent, NOVENA_MSG.cine).at(-1)?.vars?.figura).toBe("El Niño");
  });

  it("lejos del pesebre o sin novena no se pone", async () => {
    const { n, setDia } = setup({ dia: 2 });
    expect(await n.figura(at("u-ana", PX + 5, PY))).toEqual({ code: "lejos" });
    expect(await n.figura(at("u-ana", PX, PY, "jardin"))).toEqual({ code: "lejos" });
    setDia(0);
    expect(await n.figura(at("u-ana", PX + 1, PY))).toEqual({ code: "noNovena" });
    expect(n.estado()).toEqual({ dia: 0, figuras: 0, por: "" });
  });

  it("lo puesto hoy sobrevive a un reinicio (se lee de la fila guardada); lo de otro día no cuenta", async () => {
    const hoy = setup({ dia: 4, saved: { day: 300, by: "u-ana", name: "ana" } });
    await hoy.n.load();
    expect(hoy.n.estado()).toEqual({ dia: 4, figuras: 4, por: "ana" });
    const ayer = setup({ dia: 4, saved: { day: 299, by: "u-ana", name: "ana" } });
    await ayer.n.load();
    expect(ayer.n.estado()).toEqual({ dia: 4, figuras: 3, por: "" });
  });
});

describe("la novena de las 20:00", () => {
  it("a esa hora avisa a todos y los de junto al pesebre la rezan una sola vez: cinemática, puntos y contador", async () => {
    const { n, players, sent, bumps, setMinute } = setup({ dia: 5, minute: 19 * 60 + 50 });
    players.set("s-ana", at("u-ana", PX + 2, PY));
    players.set("s-beto", at("u-beto", PX, PY, "jardin"));
    n.tick();
    expect(ofType(sent, NOVENA_MSG.aviso)).toEqual([]);
    setMinute(20 * 60);
    n.tick();
    await Promise.resolve();
    expect(ofType<NovenaAviso>(sent, NOVENA_MSG.aviso)).toEqual([{ code: "rezo" }]);
    expect(sent.filter((s) => s.type === NOVENA_MSG.cine)).toEqual([{ to: "s-ana", type: NOVENA_MSG.cine, msg: { id: novenaCineId(5) } }]);
    // Quien llega a mitad de la novena también reza; quien ya rezó no repite.
    players.set("s-beto", at("u-beto", PX + 3, PY - 2));
    setMinute(20 * 60 + 30);
    n.tick();
    n.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(sent.filter((s) => s.type === NOVENA_MSG.cine).map((s) => s.to)).toEqual(["s-ana", "s-beto"]);
    expect(bumps.filter((b) => b.key === STAT_KEYS.novenasRezadas).map((b) => b.userId)).toEqual(["u-ana", "u-beto"]);
    expect(ofType(sent, NOVENA_MSG.aviso)).toHaveLength(1);
  });

  it("después de las 21:00 o sin novena no se reza", () => {
    const late = setup({ dia: 5, minute: 21 * 60 });
    late.players.set("s-ana", at("u-ana", PX + 1, PY));
    late.n.tick();
    expect(late.sent.filter((s) => s.type === NOVENA_MSG.cine)).toEqual([]);
    const none = setup({ dia: 0, minute: 20 * 60 + 5 });
    none.players.set("s-ana", at("u-ana", PX + 1, PY));
    none.n.tick();
    expect(none.sent.filter((s) => s.type === NOVENA_MSG.cine || s.type === NOVENA_MSG.aviso)).toEqual([]);
  });

  it("si la sala se reinicia en plena novena, los puntos no se pagan dos veces", async () => {
    const a = setup({ dia: 2, minute: 20 * 60 + 10 });
    a.players.set("s-ana", at("u-ana", PX + 1, PY));
    a.n.tick();
    await new Promise((r) => setTimeout(r, 0));
    const b = setup({ dia: 2, minute: 20 * 60 + 20 });
    for (const k of a.awardedOnce) b.awardedOnce.add(k);
    b.players.set("s-ana", at("u-ana", PX + 1, PY));
    b.n.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(b.bumps.filter((x) => x.key === STAT_KEYS.novenasRezadas)).toEqual([]);
  });

  it("el director la adelanta: es la misma del día, así que de noche no se reza ni se paga otra vez", async () => {
    const { n, players, sent, bumps, awardedOnce, setMinute } = setup({ dia: 4, minute: 15 * 60 });
    players.set("s-ana", at("u-ana", PX + 1, PY));
    expect(n.rezarYa()).toBe("ok");
    await new Promise((r) => setTimeout(r, 0));
    expect(ofType<NovenaAviso>(sent, NOVENA_MSG.aviso)).toEqual([{ code: "rezo" }]);
    expect(sent.filter((s) => s.type === NOVENA_MSG.cine).map((s) => s.to)).toEqual(["s-ana"]);
    expect([...awardedOnce]).toEqual([`u-ana:${NOVENA.refPrefix}300`]);
    // Otra vez el mismo día: no.
    expect(n.rezarYa()).toBe("hecha");
    // A las 20:00 no se avisa de nuevo ni reza quien ya rezó; quien llega, sí (con los puntos del día).
    players.set("s-beto", at("u-beto", PX + 2, PY));
    setMinute(20 * 60 + 5);
    n.tick();
    await new Promise((r) => setTimeout(r, 0));
    expect(ofType(sent, NOVENA_MSG.aviso)).toHaveLength(1);
    expect(sent.filter((s) => s.type === NOVENA_MSG.cine).map((s) => s.to)).toEqual(["s-ana", "s-beto"]);
    expect(bumps.filter((b) => b.key === STAT_KEYS.novenasRezadas).map((b) => b.userId)).toEqual(["u-ana", "u-beto"]);
    // Sin novena, nada.
    expect(setup({ dia: 0 }).n.rezarYa()).toBe("off");
  });
});

describe("la natilla y los buñuelos", () => {
  const stove = pointsOfType(getWorld().areas.get("planta-baja")!, "kitchen_stove")[0]!;
  function kitchen(festival: string) {
    const bag = new Map<string, number>([
      ["obj:mazorca", 2],
      ["obj:harina", 3],
      ["obj:miel", 2],
      ["obj:queso", 3],
      ["obj:huevo", 2],
    ]);
    const cocina = new Cocina({
      bag: {
        count: (_u, id) => bag.get(id) ?? 0,
        fits: () => "ok",
        take: async (_u, id, n) => ((bag.get(id) ?? 0) >= n ? (bag.set(id, bag.get(id)! - n), true) : false),
        add: async (_u, id, n) => (bag.set(id, (bag.get(id) ?? 0) + n), "ok"),
      },
      award: async (_u, amount) => amount,
      later: () => ({ clear: () => undefined }),
      onBuff: () => undefined,
      festival: () => festival,
    });
    return { cocina, bag };
  }
  const plantaBaja = getWorld().areas.get("planta-baja")!;
  const who = { userId: "u-ana", x: stove.x, y: stove.y };

  it("se cocinan en la novena con lo de la granja que hay en la mochila", async () => {
    const { cocina, bag } = kitchen("novenas");
    expect(cocina.state("u-ana", 0).pantry).toMatchObject({ harina: 3, queso: 3, huevo: 2 });
    const natilla = await cocina.cook(plantaBaja, who, { recipe: "natilla-casera" }, 10_000);
    expect(natilla?.notice).toMatchObject({ code: "cooked", item: "natilla-casera" });
    const bunuelos = await cocina.cook(plantaBaja, who, { recipe: "bunuelos-novena" }, 20_000);
    expect(bunuelos?.notice).toMatchObject({ code: "cooked", item: "bunuelos-novena" });
    expect(bag.get("obj:natilla-casera")).toBe(1);
    expect(bag.get("obj:bunuelos-novena")).toBe(1);
    expect(bag.get("obj:harina")).toBe(1);
  });

  it("fuera de la novena (u otro festival) no salen, y no se gasta nada", async () => {
    for (const festival of ["", "brujas"]) {
      const { cocina, bag } = kitchen(festival);
      const r = await cocina.cook(plantaBaja, who, { recipe: "natilla-casera" }, 10_000);
      expect(r?.notice).toEqual({ code: "season", item: "natilla-casera" } satisfies CocinaNotice);
      expect(bag.get("obj:harina")).toBe(3);
      // Lo de siempre sí se cocina.
      bag.set("obj:fresa", 2);
      expect((await cocina.cook(plantaBaja, who, { recipe: "fresas-miel" }, 20_000))?.notice?.code).toBe("cooked");
    }
  });
});

describe("el pesebre en la sala", () => {
  let colyseus: ColyseusTestServer;
  beforeAll(async () => {
    colyseus = await bootServer(new MemoryRepository());
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
    OfficeRoom.repo = new MemoryRepository();
  });

  it("con la novena prendida, E junto al pesebre pone la figura y se guarda en su fila", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    const estados: PesebreEstado[] = [];
    const cines: NovenaCineEvent[] = [];
    const avisos: NovenaAviso[] = [];
    ana.onMessage(NOVENA_MSG.estado, (e: PesebreEstado) => estados.push(e));
    ana.onMessage(NOVENA_MSG.cine, (e: NovenaCineEvent) => cines.push(e));
    ana.onMessage(NOVENA_MSG.aviso, (a: NovenaAviso) => avisos.push(a));
    await room.waitForNextPatch();
    // Sin novena, el pesebre no está.
    ana.send(NOVENA_MSG.figura);
    await until(() => avisos.length, "el aviso de que no hay novena");
    expect(avisos[0]).toEqual({ code: "noNovena" });

    (room as unknown as { festivales: Festivales }).festivales.force("novenas");
    await goToArea(ana, room, "planta-baja");
    await walkToTile(ana, room, PX + 1, PY);
    ana.send(NOVENA_MSG.figura);
    await until(() => cines.some((c) => c.id === PESEBRE_CINE), "la cinemática de la figura");
    expect(estados.at(-1)?.figuras).toBeGreaterThanOrEqual(1);
    expect(estados.at(-1)?.por).toBe("Ana");
    const rows = await (OfficeRoom.repo as MemoryRepository).loadWorldEdits();
    expect(rows[NOVENA.fila]).toMatchObject({ by: "u-ana", name: "Ana" });
  });
});
