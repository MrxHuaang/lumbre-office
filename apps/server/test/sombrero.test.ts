import type { ColyseusTestServer } from "@colyseus/testing";
import {
  CONSUME,
  GAME_DAY_REAL_MS,
  GAME_MINUTES_PER_DAY,
  MSG,
  ROOM_NAME,
  SOMBRERO_HIDEOUTS,
  TRIP,
  nextHideout,
  sombreroItem,
  usesOf,
  type SombreroBuyResult,
  type Weather,
} from "@hyvento/shared";
import { canStandAt, canWalkBetween, getWorld } from "@hyvento/map";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, walkToTile, holdItem } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 5_000_000;

/** El escondite del junto al camino del lago: queda cerca de donde se aparece en el jardín. */
const LAGO = SOMBRERO_HIDEOUTS.findIndex((h) => h.id === "lago");

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
  now = 5_000_000;
  OfficeRoom.gameClockNow = () => now;
  OfficeRoom.sombreroRandom = () => LAGO;
  OfficeRoom.sombreroTickMs = 40;
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.sombreroRandom = (n) => Math.floor(Math.random() * n);
  OfficeRoom.sombreroTickMs = 1000;
  OfficeRoom.weatherInitial = null;
  OfficeRoom.tripTimings = { scale: 1, maxMs: TRIP.maxMs };
  OfficeRoom.consumeCooldownMs = CONSUME.cooldownMs;
});

/** Sala con el reloj del juego en el día 2 a la hora `hour` (y el clima dado), y Alice adentro con `points`. */
async function setup(hour: number, points = 100, weather: Weather = "despejado") {
  OfficeRoom.weatherInitial = weather;
  OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 2 * 1440 + hour * 60 };
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const results: SombreroBuyResult[] = [];
  alice.onMessage(MSG.sombreroResult, (r: SombreroBuyResult) => results.push(r));
  const buy = async (item: string) => {
    alice.send(MSG.sombreroBuy, { item });
    await tick(80);
    await room.waitForNextPatch();
    return results.at(-1);
  };
  const me = () => room.state.players.get(alice.sessionId)!;
  /** Hasta el escondite del lago (no estorba: se le puede parar encima). */
  const goToHim = async () => {
    const h = SOMBRERO_HIDEOUTS[LAGO]!;
    await walkToTile(alice, room, h.x, h.y + 1);
  };
  return { room, alice, buy, me, goToHim };
}

describe("el Man del Sombrero: cuándo y dónde", () => {
  it("en una de sus horas del reloj del juego está en el escondite del día", async () => {
    const { room } = await setup(22);
    const s = room.state.sombrero;
    const h = SOMBRERO_HIDEOUTS[LAGO]!;
    expect(s.present).toBe(true);
    expect([s.hideout, s.area, s.x, s.y]).toEqual([LAGO, h.area, h.x, h.y]);
  });

  it("fuera de sus horas no está; con tormenta sí", async () => {
    const calm = await setup(10);
    expect(calm.room.state.sombrero.present).toBe(false);
    await colyseus.cleanup();
    const storm = await setup(10, 0, "tormenta");
    expect(storm.room.state.sombrero.present).toBe(true);
  });

  it("se va cuando termina su hora y vuelve en la siguiente franja", async () => {
    const { room } = await setup(3);
    expect(room.state.sombrero.present).toBe(true);
    // Una hora y media del juego después ya son las 4:30.
    now += (90 * GAME_DAY_REAL_MS) / GAME_MINUTES_PER_DAY;
    await tick(120);
    await room.waitForNextPatch();
    expect(room.state.sombrero.present).toBe(false);
  });

  it("cada día del juego cambia de escondite (distinto al de ayer)", async () => {
    const { room } = await setup(22);
    expect(room.state.sombrero.hideout).toBe(LAGO);
    // Un día entero del juego después.
    now += GAME_DAY_REAL_MS;
    await tick(120);
    await room.waitForNextPatch();
    const expected = nextHideout(LAGO, () => LAGO);
    expect(expected).not.toBe(LAGO);
    expect(room.state.sombrero.hideout).toBe(expected);
    expect(room.state.sombrero.area).toBe(SOMBRERO_HIDEOUTS[expected]!.area);
  });
});

describe("el Man del Sombrero: comprarle", () => {
  it("junto a él y con saldo, cobra y deja la mercancía en la mano", async () => {
    const { buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    const bareta = sombreroItem("bareta")!;
    expect(await buy("bareta")).toEqual({ ok: true, item: "bareta", balance: 100 - bareta.price });
    expect(me().held).toBe("bareta");
    expect(me().heldLeft).toBe(String(usesOf("bareta")));
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -bareta.price, reason: "PURCHASE", refId: "sombrero:bareta" });
  });

  it("si no está, no le vende (aunque uno esté en el escondite)", async () => {
    const { buy, me, goToHim } = await setup(10, 100);
    await goToHim();
    expect(await buy("bareta")).toEqual({ ok: false, item: "bareta", error: "gone" });
    expect(me().held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(100);
  });

  it("lejos de él no se puede comprar ni se cobra", async () => {
    const { buy, me } = await setup(22, 100);
    expect(await buy("bareta")).toEqual({ ok: false, item: "bareta", error: "far" });
    expect(me().held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(100);
  });

  it("sin saldo suficiente no cobra nada", async () => {
    const yage = sombreroItem("yage")!;
    const { buy, me, goToHim } = await setup(22, yage.price - 1);
    await goToHim();
    expect(await buy("yage")).toEqual({ ok: false, item: "yage", error: "funds" });
    expect(me().held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(yage.price - 1);
  });

  it("lo que no es de su carta se ignora", async () => {
    const { buy, goToHim } = await setup(22, 100);
    await goToHim();
    expect(await buy("tinto")).toBeUndefined();
    expect(await repo.getPoints("u-alice")).toBe(100);
  });
});

describe("el Man del Sombrero: los efectos", () => {
  it("una pitada de bareta deja trabado un rato y después se pasa", async () => {
    // Cada uso suma el 1 %: una pitada de bareta son 600 ms.
    OfficeRoom.tripTimings = { scale: 0.01, maxMs: 5000 };
    const { alice, room, buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    await buy("bareta");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("trabado");
    expect(me().tripUntil).toBeGreaterThan(Date.now());
    await tick(700);
    await room.waitForNextPatch();
    expect(me().trip).toBe("");
    expect(me().tripUntil).toBe(0);
  });

  it("el perico acelera y el yagé, que viene después, lo reemplaza", async () => {
    OfficeRoom.tripTimings = { scale: 0.05, maxMs: 20_000 };
    OfficeRoom.consumeCooldownMs = 0;
    const { alice, room, buy, me, goToHim } = await setup(22, 200);
    await goToHim();
    await buy("perico-bolsa");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("acelere");
    await tick(1600);
    await buy("yage");
    // Con el perico todavía en la mano, el yagé va a la mochila: se elige en la barra.
    await holdItem(alice, room, "obj:yage");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("yage");
  });

  it("el tusi pone rosado (efecto propio) y se pasa solo", async () => {
    OfficeRoom.tripTimings = { scale: 0.01, maxMs: 5000 };
    const { alice, room, buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    expect(await buy("tusi")).toMatchObject({ ok: true, item: "tusi" });
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("tusi");
    expect(me().heldLeft).toBe(String(usesOf("tusi") - 1));
    // 80 s al 1 %: menos de un segundo.
    await tick(900);
    await room.waitForNextPatch();
    expect(me().trip).toBe("");
  });

  it("con la keta se camina en cámara lenta: el servidor no deja el paso de siempre", async () => {
    OfficeRoom.tripTimings = { scale: 0.01, maxMs: 5000 };
    const { alice, room, buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    expect(await buy("keta")).toMatchObject({ ok: true, item: "keta" });
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("keta");
    // Un tramo que a paso normal se hace en ~0,3 s (más de lo que se tolera a media velocidad).
    const map = getWorld().areas.get(me().area)!;
    const from = { x: me().x, y: me().y };
    const hop = 56;
    const to = [
      [hop, 0],
      [-hop, 0],
      [0, hop],
      [0, -hop],
    ]
      .map(([dx, dy]) => ({ x: from.x + dx!, y: from.y + dy! }))
      .find((p) => canStandAt(map, p.x, p.y) && canWalkBetween(map, from.x, from.y, p.x, p.y))!;
    expect(to).toBeDefined();
    // El servidor mide el tiempo desde el último paso: uno en el lugar arranca el reloj.
    const hopAfter = async (ms: number) => {
      alice.send(MSG.move, { x: from.x, y: from.y, dir: "down", moving: false });
      await tick(ms);
      alice.send(MSG.move, { x: to.x, y: to.y, dir: "down", moving: true });
    };
    await hopAfter(300);
    await tick(60);
    await room.waitForNextPatch();
    expect([me().x, me().y]).toEqual([from.x, from.y]);
    // Cuando se le pasa, el mismo tramo sí vale.
    await tick(700);
    await room.waitForNextPatch();
    expect(me().trip).toBe("");
    await hopAfter(300);
    await tick(60);
    await room.waitForNextPatch();
    expect([me().x, me().y]).toEqual([to.x, to.y]);
  });

  it("el chicle de mambe acelera y la galleta de la abuela traba", async () => {
    OfficeRoom.tripTimings = { scale: 0.05, maxMs: 20_000 };
    OfficeRoom.consumeCooldownMs = 0;
    const { alice, room, buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    await buy("chicle-mambe");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("acelere");
    await tick(1600);
    await buy("galleta-abuela");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().trip).toBe("trabado");
  });

  it("el chirrinchi emborracha más rápido que lo del bar: un sorbo y ya está alegre", async () => {
    const { alice, room, buy, me, goToHim } = await setup(22, 100);
    await goToHim();
    await buy("chirrinchi");
    alice.send(MSG.useHeld);
    await tick(80);
    await room.waitForNextPatch();
    expect(me().drunk).toBeGreaterThanOrEqual(1);
    // No es mercancía "rara": no deja efecto aparte de la borrachera.
    expect(me().trip).toBe("");
  });
});

describe("el Man del Sombrero: /sombrero (solo desarrollo)", () => {
  afterEach(() => {
    delete process.env.HYVENTO_DEV_TOOLS;
  });

  it("lo hace salir fuera de sus horas, en el escondite pedido, y lleva ahí a quien lo pidió", async () => {
    process.env.HYVENTO_DEV_TOOLS = "1";
    const { room, alice, me } = await setup(10);
    expect(room.state.sombrero.present).toBe(false);
    alice.send(MSG.chatSend, { text: "/sombrero garaje", scope: "proximity" });
    await tick(120);
    await room.waitForNextPatch();
    const garaje = SOMBRERO_HIDEOUTS.findIndex((h) => h.id === "garaje");
    expect(room.state.sombrero.present).toBe(true);
    expect(room.state.sombrero.hideout).toBe(garaje);
    expect(me().area).toBe("garaje");
    // Y se queda aunque sigan pasando los ticks fuera de sus horas.
    await tick(120);
    expect(room.state.sombrero.present).toBe(true);
  });

  it("sin herramientas de desarrollo es solo un mensaje del chat", async () => {
    const { room, alice } = await setup(10);
    alice.send(MSG.chatSend, { text: "/sombrero", scope: "proximity" });
    await tick(120);
    expect(room.state.sombrero.present).toBe(false);
  });
});
