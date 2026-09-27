import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, pointsOfType, isBlockedTile, INTERACT_REACH_TILES } from "@hyvento/map";
import { CAFE, CONSUME, MENUS, MSG, ROOM_NAME, barItem, usesOf, type CafeOrderResult, type HeldUsedEvent } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { HeldItems } from "../src/rooms/consumables";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- Lo que se tiene en la mano (sin sala) ----------

/** Reloj falso: los temporizadores se disparan a mano. */
function fakeClock() {
  const timers = new Set<{ fn: () => void; cleared: boolean }>();
  return {
    setTimeout(fn: () => void) {
      const t = { fn, cleared: false };
      timers.add(t);
      return { clear: () => void (t.cleared = true) };
    },
    fire() {
      for (const t of timers) if (!t.cleared) t.fn();
      timers.clear();
    },
  };
}

function heldItems() {
  const clock = fakeClock();
  const changes: { userId: string; item: string; left: number[] }[] = [];
  const held = new HeldItems(clock, () => 1000, (userId, item, left) => changes.push({ userId, item, left: [...left] }));
  return { held, clock, changes };
}

describe("usar lo que se tiene en la mano", () => {
  it("cada cosa tiene sus usos y al gastarlos se va de la mano", () => {
    const { held, changes } = heldItems();
    held.give("u", "tinto");
    expect(held.get("u")?.left).toEqual([usesOf("tinto")]);
    let now = 10_000;
    for (let k = usesOf("tinto") - 1; k >= 0; k--) {
      const r = held.use("u", now);
      expect(r).toMatchObject({ ok: true, part: 0, art: "tinto", action: "sip", left: k });
      now += CONSUME.cooldownMs;
    }
    expect(held.get("u")).toBeUndefined();
    expect(changes.at(-1)).toEqual({ userId: "u", item: "", left: [] });
    expect(held.use("u", now + 10_000)).toEqual({ ok: false, error: "empty" });
  });

  it("hay una pausa mínima entre usos", () => {
    const { held } = heldItems();
    held.give("u", "cigarro");
    expect(held.use("u", 5000).ok).toBe(true);
    expect(held.use("u", 5000 + CONSUME.cooldownMs - 1)).toEqual({ ok: false, error: "busy" });
    expect(held.use("u", 5000 + CONSUME.cooldownMs).ok).toBe(true);
  });

  it("en un combo se alterna entre las manos, y sigue la que tenga usos", () => {
    const { held } = heldItems();
    held.give("u", "desayuno-tinto"); // tinto (3) y cigarro (5)
    let now = 0;
    const parts: number[] = [];
    for (let k = 0; k < usesOf("tinto") + usesOf("cigarro"); k++) {
      now += CONSUME.cooldownMs;
      const r = held.use("u", now);
      if (r.ok) parts.push(r.part);
    }
    expect(parts).toEqual([0, 1, 0, 1, 0, 1, 1, 1]);
    expect(held.get("u")).toBeUndefined();
  });

  it("se puede elegir la mano; si no le quedan usos, se usa la otra", () => {
    const { held } = heldItems();
    held.give("u", "desayuno-tinto");
    expect(held.use("u", 2000, 1)).toMatchObject({ ok: true, part: 1, art: "cigarro", action: "smoke" });
  });

  it("pedir otra cosa reemplaza lo anterior con todos sus usos, y todo se acaba solo al rato", () => {
    const { held, clock } = heldItems();
    held.give("u", "torta");
    held.use("u", 2000);
    held.give("u", "padrino");
    expect(held.get("u")).toEqual({ item: "padrino", left: [usesOf("whisky"), usesOf("habano")] });
    clock.fire();
    expect(held.get("u")).toBeUndefined();
  });
});

// ---------- En la sala: el bar del club y usar con F ----------

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

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
  OfficeRoom.consumeCooldownMs = 150;
});
afterEach(() => {
  OfficeRoom.heldMs = CAFE.heldMs;
  OfficeRoom.consumeCooldownMs = CONSUME.cooldownMs;
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

/** Un tile libre, alcanzable y junto a un punto del mapa de ese tipo (la barra del club, la de la cafetería). */
function tileNextTo(area: string, type: string, from: { x: number; y: number }) {
  const map = getWorld().areas.get(area)!;
  for (const p of pointsOfType(map, type as never)) {
    const around = [
      [0, 0],
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ].map(([dx, dy]) => ({ x: p.tileX + dx!, y: p.tileY + dy! }));
    for (const t of around) if (!isBlockedTile(map, t.x, t.y) && findPath(map, from, t)) return t;
  }
  throw new Error(`No hay dónde pararse junto a ${type} en ${area}`);
}

async function walkNextTo(client: ClientRoom, room: ServerRoom, area: string, type: string) {
  await goToArea(client, room, area);
  const p = me(client, room);
  const t = tileNextTo(area, type, { x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) });
  await walkToTile(client, room, t.x, t.y);
}

async function setup(points: number) {
  if (points > 0) await repo.awardPoints({ userId: "u-alice", amount: points, reason: "ADMIN" });
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const results: CafeOrderResult[] = [];
  alice.onMessage(MSG.cafeResult, (r: CafeOrderResult) => results.push(r));
  const used = { alice: [] as HeldUsedEvent[], bob: [] as HeldUsedEvent[] };
  alice.onMessage(MSG.heldUsed, (e: HeldUsedEvent) => used.alice.push(e));
  bob.onMessage(MSG.heldUsed, (e: HeldUsedEvent) => used.bob.push(e));
  const order = async (item: string, type: string = MSG.barOrder) => {
    alice.send(type, { item });
    await tick(80);
    await room.waitForNextPatch();
    return results.at(-1);
  };
  const use = async () => {
    alice.send(MSG.useHeld);
    await tick(40);
    await room.waitForNextPatch();
  };
  return { room, alice, bob, order, use, used };
}

describe("bar del club", () => {
  it("cada barra tiene al lado un mueble en el que se hace clic, y cada uno de esos muebles tiene su barra", () => {
    // El clic en un mueble de la barra (MENUS.bar.furniture, que usa la escena) camina al punto más cercano.
    for (const [id, menu] of Object.entries(MENUS)) {
      const clickable = new Set<string>(menu.furniture);
      for (const map of getWorld().areas.values()) {
        const ts = map.tileSize;
        const points = pointsOfType(map, menu.point as never);
        const pieces = map.furniture.filter((f) => clickable.has(f.type));
        for (const p of points) {
          const beside = pieces.some((f) => {
            const dx = Math.max(f.x * ts - p.x, 0, p.x - (f.x + f.w) * ts);
            const dy = Math.max(f.y * ts - p.y, 0, p.y - (f.y + f.d) * ts);
            return Math.hypot(dx, dy) <= INTERACT_REACH_TILES * ts;
          });
          expect(beside, `${id}: ${map.id} (${p.tileX}, ${p.tileY})`).toBe(true);
        }
        if (pieces.length > 0) expect(points.length, `${id}: ${map.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("junto a la barra del club se pide, se cobra y queda en la mano con sus usos", async () => {
    const { room, alice, order } = await setup(50);
    await walkNextTo(alice, room, "sotano", "club_bar");
    const price = barItem("whisky")!.price;
    expect(await order("whisky")).toEqual({ ok: true, item: "whisky", balance: 50 - price });
    expect(me(alice, room).held).toBe("whisky");
    expect(me(alice, room).heldLeft).toBe(String(usesOf("whisky")));
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -price, reason: "PURCHASE", refId: "bar:whisky" });
  });

  it("lejos de la barra del club (o en la de la cafetería) no se puede pedir ni se cobra", async () => {
    const { room, alice, order } = await setup(50);
    await walkNextTo(alice, room, "planta-baja", "cafe_counter");
    expect(await order("cerveza")).toEqual({ ok: false, item: "cerveza", error: "far" });
    expect(me(alice, room).held).toBe("");
    expect(await repo.getPoints("u-alice")).toBe(50);
  });

  it("la carta de cada barra va por su mensaje: un trago no se pide en la cafetería", async () => {
    const { room, alice, order } = await setup(50);
    await walkNextTo(alice, room, "sotano", "club_bar");
    expect(await order("whisky", MSG.cafeOrder)).toBeUndefined();
    expect(await order("tinto")).toBeUndefined();
    expect(await repo.getPoints("u-alice")).toBe(50);
  });

  it("sin saldo suficiente no se cobra", async () => {
    const { room, alice, order } = await setup(barItem("habano")!.price - 1);
    await walkNextTo(alice, room, "sotano", "club_bar");
    expect(await order("habano")).toMatchObject({ ok: false, error: "funds" });
    expect(me(alice, room).held).toBe("");
  });
});

describe("usar con F", () => {
  it("sin nada en la mano no pasa nada", async () => {
    const { use, used } = await setup(0);
    await use();
    expect(used.alice).toEqual([]);
  });

  it("cada uso lo ven los del mismo nivel; al gastar todo se va de la mano", async () => {
    const { room, alice, bob, order, use, used } = await setup(50);
    await walkNextTo(alice, room, "sotano", "club_bar");
    await goToArea(bob, room, "sotano");
    await order("cerveza");
    const uses = usesOf("cerveza");
    await use();
    expect(used.bob).toEqual([{ sessionId: alice.sessionId, part: 0, art: "cerveza", action: "sip", left: uses - 1 }]);
    expect(used.alice).toHaveLength(1);
    expect(me(alice, room).heldLeft).toBe(String(uses - 1));
    for (let k = 1; k < uses; k++) {
      await tick(OfficeRoom.consumeCooldownMs);
      await use();
    }
    expect(used.alice.map((e) => e.left)).toEqual([...Array(uses).keys()].reverse());
    expect(me(alice, room).held).toBe("");
    expect(me(alice, room).heldLeft).toBe("");
  });

  it("no se puede usar en ráfaga, y quien está en otro nivel no lo ve", async () => {
    const { room, alice, order, used } = await setup(50);
    await walkNextTo(alice, room, "sotano", "club_bar");
    await order("habano");
    alice.send(MSG.useHeld);
    alice.send(MSG.useHeld);
    alice.send(MSG.useHeld);
    await tick(60);
    await room.waitForNextPatch();
    expect(used.alice).toHaveLength(1);
    expect(used.bob).toEqual([]); // Bob sigue en el jardín
    expect(me(alice, room).heldLeft).toBe(String(usesOf("habano") - 1));
  });
});
