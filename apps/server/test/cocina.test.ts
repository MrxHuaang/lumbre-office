import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType } from "@hyvento/map";
import { COCINA, COCINA_MSG, HONEY, MSG, ROOM_NAME, recipeById, type CocinaNotice, type CocinaState, type MoveCorrection } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Cocina } from "../src/rooms/cocina";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// La cocina: la despensa es la mochila (lo cosechado va ahí), cocinar en la estufa (valida distancia e
// ingredientes y los gasta de la mochila), los puntos con su tope y la energía de los platos.

const plantaBaja = getWorld().areas.get("planta-baja")!;
const jardin = getWorld().areas.get("jardin")!;
const stove = pointsOfType(plantaBaja, "kitchen_stove")[0]!;
const shed = pointsOfType(jardin, "tool_shed")[0]!;
const counter = pointsOfType(plantaBaja, "cafe_counter")[0]!;

/** Una cocina con una mochila y puntos de mentira (el reloj lo lleva cada test). */
function kitchen(leisureLeft = 1000) {
  const bag = new Map<string, number>();
  const picked: string[] = [];
  const buffs: string[] = [];
  const timers: { at: number; fn: () => void; dead: boolean }[] = [];
  let left = leisureLeft;
  let full = false;
  const cocina = new Cocina({
    bag: {
      count: (_userId, itemId) => bag.get(itemId) ?? 0,
      fits: (_userId, items) => (full && items.some(([id]) => !bag.has(id)) ? "full" : "ok"),
      take: async (_userId, itemId, n) => {
        const have = bag.get(itemId) ?? 0;
        if (have < n) return false;
        if (have === n) bag.delete(itemId);
        else bag.set(itemId, have - n);
        return true;
      },
      add: async (_userId, itemId, n, opts) => {
        bag.set(itemId, (bag.get(itemId) ?? 0) + n);
        if (opts.pick) picked.push(itemId);
        return "ok";
      },
    },
    award: async (_userId, amount) => {
      const n = Math.min(left, amount);
      left -= n;
      return n;
    },
    later: (ms, fn) => {
      const t = { at: ms, fn, dead: false };
      timers.push(t);
      return { clear: () => void (t.dead = true) };
    },
    onBuff: (_userId, dish) => void buffs.push(dish),
  });
  const fire = () => timers.filter((t) => !t.dead).forEach((t) => ((t.dead = true), t.fn()));
  /** Pone ingredientes en la mochila (reemplaza lo que había de cada uno). */
  const fill = (items: Readonly<Record<string, number>>) => {
    for (const [id, n] of Object.entries(items)) bag.set(`obj:${id}`, n);
  };
  const setFull = (v: boolean) => void (full = v);
  return { cocina, bag, picked, buffs, fire, fill, setFull };
}

const atStove = { userId: "u-alice", x: stove.x, y: stove.y };
const atShed = { userId: "u-alice", x: shed.x, y: shed.y };
const T0 = Date.UTC(2026, 8, 27, 15, 0);

describe("cocina (reglas del servidor)", () => {
  it("la despensa es la mochila: se ven sus ingredientes, y guardar ya no hace falta", () => {
    const { cocina, fill, bag } = kitchen();
    fill({ [HONEY]: 2, tomate: 1 });
    bag.set("obj:tinto", 3);
    expect(cocina.state("u-alice", T0).pantry).toEqual({ miel: 2, tomate: 1 });
    expect(cocina.store(plantaBaja, { userId: "u-alice", x: counter.x, y: counter.y }, T0)?.notice?.code).toBe("far");
    const r = cocina.store(jardin, atShed, T0)!;
    expect(r.notice).toEqual({ code: "inBag" });
    expect(r.state?.pantry).toEqual({ miel: 2, tomate: 1 });
  });

  it("cocina solo junto a la estufa, con los ingredientes de la mochila, y los gasta", async () => {
    const { cocina, fill, bag, picked } = kitchen();
    fill({ tomate: 1, papa: 1 });
    expect((await cocina.cook(jardin, atShed, { recipe: "sopa-verduras" }, T0))?.notice?.code).toBe("far");
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "sopa-verduras" }, T0))?.notice?.code).toBe("missing");
    expect(await cocina.cook(plantaBaja, atStove, { recipe: "no-existe" }, T0)).toBeNull();
    fill({ cilantro: 1 });
    const r = await cocina.cook(plantaBaja, atStove, { recipe: "sopa-verduras" }, T0);
    expect(r?.notice).toMatchObject({ code: "cooked", item: "sopa-verduras", points: 8 });
    expect(r?.state?.pantry).toEqual({});
    // El plato va a la mochila (y a la mano, si estaban libres).
    expect(bag.get("obj:sopa-verduras")).toBe(1);
    expect(picked).toEqual(["obj:sopa-verduras"]);
  });

  it("si el plato no cabe no se cocina (salvo que se libere una casilla), y la estufa tiene su pausa", async () => {
    const { cocina, fill, setFull, bag } = kitchen();
    fill({ mazorca: 2, miel: 2 });
    setFull(true);
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "pan-miel" }, T0))?.notice?.code).toBe("bagFull");
    expect(bag.get("obj:mazorca")).toBe(2);
    setFull(false);
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "pan-miel" }, T0))?.notice?.code).toBe("cooked");
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "pan-miel" }, T0 + 100))?.notice?.code).toBe("busy");
    // Con la mochila llena pero gastando lo último de un ingrediente, sí cabe.
    setFull(true);
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "pan-miel" }, T0 + COCINA.cookCooldownMs))?.notice?.code).toBe("cooked");
  });

  it("los puntos de la cocina tienen tope diario (el día de Bogotá)", async () => {
    const { cocina, fill } = kitchen();
    const ajiaco = recipeById("ajiaco")!;
    let t = T0;
    let total = 0;
    for (let i = 0; i < 4; i++) {
      fill(ajiaco.needs);
      const r = await cocina.cook(plantaBaja, atStove, { recipe: "ajiaco" }, (t += COCINA.cookCooldownMs));
      total += r?.notice?.points ?? 0;
    }
    expect(total).toBe(COCINA.pointsDailyCap);
    fill(ajiaco.needs);
    expect((await cocina.cook(plantaBaja, atStove, { recipe: "ajiaco" }, (t += COCINA.cookCooldownMs)))?.notice?.code).toBe("capped");
    // Al otro día vuelve a dar.
    fill(ajiaco.needs);
    const tomorrow = await cocina.cook(plantaBaja, atStove, { recipe: "ajiaco" }, t + 24 * 3_600_000);
    expect(tomorrow?.notice).toMatchObject({ code: "cooked", points: 12 });
  });

  it("si el tope del ocio ya se llenó, el plato sale igual pero sin puntos", async () => {
    const { cocina, fill, bag } = kitchen(0);
    fill(recipeById("sopa-verduras")!.needs);
    const r = await cocina.cook(plantaBaja, atStove, { recipe: "sopa-verduras" }, T0);
    expect(r?.notice?.code).toBe("capped");
    expect(bag.get("obj:sopa-verduras")).toBe(1);
  });

  it("el primer bocado de un plato con energía la prende; dura un rato y deja caminar más rápido", () => {
    const { cocina, buffs, fire } = kitchen();
    const pan = recipeById("pan-miel")!;
    if (pan.effect.kind !== "speed") throw new Error("el pan de miel da energía");
    expect(cocina.speedMul("u-alice", T0)).toBe(1);
    expect(cocina.ate("u-alice", "pan-miel", pan.uses - 1, T0)).toEqual({ code: "energy", item: "pan-miel" });
    expect(buffs).toEqual(["pan-miel"]);
    expect(cocina.speedMul("u-alice", T0 + 1000)).toBe(pan.effect.mul);
    // Los demás bocados no la alargan.
    expect(cocina.ate("u-alice", "pan-miel", pan.uses - 2, T0 + 5000)).toBeNull();
    // Lo que no da energía no hace nada.
    expect(cocina.ate("u-alice", "sopa-verduras", 3, T0)).toBeNull();
    expect(cocina.ate("u-alice", "tinto", 2, T0)).toBeNull();
    // Se acaba (con un margen para la última posición que llega tarde).
    expect(cocina.speedMul("u-alice", T0 + pan.effect.ms + COCINA.speedGraceMs)).toBe(pan.effect.mul);
    expect(cocina.speedMul("u-alice", T0 + pan.effect.ms + COCINA.speedGraceMs + 1)).toBe(1);
    fire();
    expect(buffs).toEqual(["pan-miel", ""]);
    expect(cocina.buffOf("u-alice", T0 + pan.effect.ms + 1)).toBe("");
  });
});

// ---------- En la sala ----------

let colyseus: ColyseusTestServer;
let clock = Date.now();

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
  clock = Date.now();
  OfficeRoom.cocinaNow = () => clock;
  OfficeRoom.huertoNow = () => clock;
});
afterEach(() => {
  OfficeRoom.cocinaNow = () => Date.now();
  OfficeRoom.huertoNow = () => Date.now();
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;
const inside = (room: ServerRoom) => (room as unknown as { cocina: Cocina }).cocina;
/** Pone ingredientes en la mochila de Alice (sin tocar la mano). */
async function fillBag(room: ServerRoom, items: Readonly<Record<string, number>>) {
  for (const [id, n] of Object.entries(items)) await bagOf(room).add("u-alice", `obj:${id}`, n);
}

async function join() {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const client = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  await room.waitForNextPatch();
  const notices: CocinaNotice[] = [];
  const states: CocinaState[] = [];
  const corrections: MoveCorrection[] = [];
  client.onMessage(COCINA_MSG.notice, (n: CocinaNotice) => notices.push(n));
  client.onMessage(COCINA_MSG.state, (s: CocinaState) => states.push(s));
  client.onMessage(MSG.moveCorrection, (c: MoveCorrection) => corrections.push(c));
  return { room, client, notices, states, corrections };
}

async function send(client: ClientRoom, room: ServerRoom, type: string, raw?: unknown) {
  client.send(type, raw);
  await tick(80);
  await room.waitForNextPatch();
}

/** Un tile libre junto a la colmena, al que se llega caminando desde donde se está. */
function besideHive(from: { x: number; y: number }) {
  const hive = jardin.furniture.find((f) => f.type === "beehive")!;
  for (let y = hive.y - 1; y <= hive.y + hive.d; y++)
    for (let x = hive.x - 1; x <= hive.x + hive.w; x++) {
      const inHive = x >= hive.x && x < hive.x + hive.w && y >= hive.y && y < hive.y + hive.d;
      if (!inHive && !isBlockedTile(jardin, x, y) && findPath(jardin, from, { x, y })) return { hive, spot: { x, y } };
    }
  throw new Error("Sin lugar junto a la colmena");
}

describe("cocina (en la sala)", () => {
  it("la miel va a la mochila, se cocina en la estufa con ella y el pan da energía al primer bocado", async () => {
    const { room, client, notices, states } = await join();
    const start = { x: Math.floor(me(client, room).x / 32), y: Math.floor(me(client, room).y / 32) };
    const { hive, spot } = besideHive(start);
    await walkToTile(client, room, spot.x, spot.y);
    await send(client, room, MSG.furnitureUse, { type: "beehive", x: hive.x, y: hive.y });
    expect(me(client, room).held).toBe(HONEY);

    // Guardar ya no hace falta: junto al cobertizo solo avisa que está en la mochila.
    await send(client, room, COCINA_MSG.store);
    expect(notices.at(-1)?.code).toBe("far");
    await walkToTile(client, room, shed.tileX, shed.tileY);
    await send(client, room, COCINA_MSG.store);
    expect(notices.at(-1)).toEqual({ code: "inBag" });
    expect(states.at(-1)?.pantry).toEqual({ miel: 1 });
    expect(me(client, room).held).toBe(HONEY);

    // Desde el jardín no se cocina (la estufa está en la cocina de la casa).
    await fillBag(room, { mazorca: 1 });
    await send(client, room, COCINA_MSG.cook, { recipe: "pan-miel" });
    expect(notices.at(-1)?.code).toBe("far");
    expect(me(client, room).held).toBe(HONEY);

    await goToArea(client, room, "planta-baja");
    await walkToTile(client, room, stove.tileX, stove.tileY);
    await send(client, room, COCINA_MSG.open);
    expect(states.at(-1)?.pantry).toEqual({ miel: 1, mazorca: 1 });
    await send(client, room, COCINA_MSG.cook, { recipe: "pan-miel" });
    expect(notices.at(-1)).toMatchObject({ code: "cooked", item: "pan-miel" });
    expect(me(client, room).held).toBe("pan-miel");
    expect(states.at(-1)?.pantry).toEqual({});
    // Sin ingredientes ya no alcanza.
    clock += COCINA.cookCooldownMs;
    await send(client, room, COCINA_MSG.cook, { recipe: "pan-miel" });
    expect(notices.at(-1)?.code).toBe("missing");

    // El primer bocado (F) prende la energía, que ven todos en el estado.
    await send(client, room, MSG.useHeld);
    expect(notices.at(-1)).toEqual({ code: "energy", item: "pan-miel" });
    expect(me(client, room).buff).toBe("pan-miel");
    expect(inside(room).speedMul("u-alice", clock)).toBeGreaterThan(1);
  });

  it("con energía el servidor acepta pasos más largos; sin ella, los corrige", async () => {
    const { room, client, corrections } = await join();
    await goToArea(client, room, "planta-baja");
    await walkToTile(client, room, stove.tileX, stove.tileY);
    const pan = recipeById("pan-miel")!;
    if (pan.effect.kind !== "speed") throw new Error("el pan de miel da energía");
    await fillBag(room, pan.needs);
    await send(client, room, COCINA_MSG.cook, { recipe: "pan-miel" });
    await send(client, room, MSG.useHeld);
    expect(me(client, room).buff).toBe("pan-miel");

    // Un paso de 0.4 s justo en el borde de la tolerancia con energía (1.6 × la velocidad × el plato):
    // sin ella se pasa por un 20 %, más de lo que mueve el vaivén de la red.
    const WAIT_MS = 400;
    const step = (WAIT_MS / 1000) * 150 * 1.6 * pan.effect.mul * 0.99;
    const burst = async () => {
      const p = me(client, room);
      client.send(MSG.move, { x: p.x, y: p.y, dir: "right", moving: true });
      await tick(WAIT_MS);
      const before = { x: p.x, y: p.y };
      client.send(MSG.move, { x: p.x + step, y: p.y, dir: "right", moving: true });
      await tick(60);
      await room.waitForNextPatch();
      return before;
    };
    const n = corrections.length;
    const a = await burst();
    expect(corrections.length).toBe(n);
    expect(me(client, room).x).toBeGreaterThan(a.x);

    // Se acabó la energía: el mismo paso se corrige.
    clock += pan.effect.ms + COCINA.speedGraceMs + 1;
    const b = await burst();
    expect(corrections.length).toBeGreaterThan(n);
    expect(me(client, room).x).toBe(b.x);
  });
});
