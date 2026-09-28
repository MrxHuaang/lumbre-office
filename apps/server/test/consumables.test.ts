import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, pointsOfType, isBlockedTile, INTERACT_REACH_TILES } from "@hyvento/map";
import {
  BAG,
  BAG_MSG,
  CONSUME,
  EMPTY_CAN,
  HUERTO,
  MENUS,
  MSG,
  ROOM_NAME,
  WATERING_CAN,
  barItem,
  menuItem,
  seedsOf,
  usesOf,
  type BagNotice,
  type BagView,
  type CafeOrderResult,
  type HeldUsedEvent,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Bag } from "../src/rooms/bag";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, goToArea, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

// ---------- La mochila y lo de la mano (sin sala) ----------

function bagFor(repo = new MemoryRepository()) {
  const held: { userId: string; item: string; left: number[] }[] = [];
  const views: BagView[] = [];
  const bag = new Bag({
    repo: () => repo,
    onHeld: (userId, item, left) => held.push({ userId, item, left: [...left] }),
    onBag: (_userId, view) => views.push(view),
    cooldownMs: () => 1000,
  });
  return { bag, repo, held, views, hand: () => bag.get("u") };
}

describe("mochila: lo que se lleva en la mano", () => {
  it("la casilla elegida es lo de la mano: usar gasta usos y al acabar una unidad sale de la mochila", async () => {
    const { bag, repo, hand } = bagFor();
    await bag.load("u");
    expect(await bag.add("u", "obj:tinto", 2, { pick: true })).toBe("ok");
    expect(repo.held("u", "obj:tinto")).toBe(2);
    expect(hand()).toEqual({ item: "tinto", left: [usesOf("tinto")] });
    let now = 10_000;
    for (let k = usesOf("tinto") - 1; k >= 0; k--) {
      expect(bag.use("u", now)).toMatchObject({ ok: true, part: 0, art: "tinto", action: "sip", left: k });
      now += 1000;
    }
    await bag.flush("u");
    // Se acabó uno: queda el otro, entero, en la misma casilla (y en la mano).
    expect(repo.held("u", "obj:tinto")).toBe(1);
    expect(hand()).toEqual({ item: "tinto", left: [usesOf("tinto")] });
    for (let k = 0; k < usesOf("tinto"); k++, now += 1000) bag.use("u", now);
    await bag.flush("u");
    expect(repo.held("u", "obj:tinto")).toBe(0);
    expect(hand()).toBeUndefined();
    expect(bag.use("u", now + 10_000)).toEqual({ ok: false, error: "empty" });
  });

  it("hay una pausa mínima entre usos", async () => {
    const { bag } = bagFor();
    await bag.add("u", "obj:cigarro", 1, { pick: true });
    expect(bag.use("u", 5000).ok).toBe(true);
    expect(bag.use("u", 5999)).toEqual({ ok: false, error: "busy" });
    expect(bag.use("u", 6000).ok).toBe(true);
  });

  it("una casilla vacía o un mueble dejan las manos libres; lo que no se come solo se lleva", async () => {
    const { bag, repo, hand } = bagFor();
    repo.give("u", "plant");
    repo.give("u", "obj:huevo");
    await bag.load("u");
    const slotOf = (itemId: string) => bag.view("u").slots.findIndex((s) => s?.itemId === itemId);
    bag.select("u", slotOf("plant"));
    expect(hand()).toBeUndefined();
    bag.select("u", slotOf("obj:huevo"));
    expect(hand()).toEqual({ item: "huevo", left: [1] });
    expect(bag.use("u", 50_000)).toEqual({ ok: false, error: "empty" });
    bag.select("u", 20);
    expect(hand()).toBeUndefined();
    expect(repo.held("u", "obj:huevo")).toBe(1);
  });

  it("lo empezado se recuerda al cambiar de casilla", async () => {
    const { bag, hand } = bagFor();
    await bag.add("u", "obj:cerveza", 1, { pick: true });
    const slot = bag.view("u").selected;
    bag.use("u", 10_000);
    bag.select("u", slot + 1);
    bag.select("u", slot);
    expect(hand()).toEqual({ item: "cerveza", left: [usesOf("cerveza") - 1] });
  });

  it("lo nuevo va a la primera casilla libre y queda en la mano solo si estaban libres", async () => {
    const { bag, hand, views } = bagFor();
    await bag.add("u", "obj:tinto", 1, { pick: true });
    expect(views.at(-1)).toMatchObject({ selected: 0, pick: true });
    await bag.add("u", "obj:pandebono", 1, { pick: true });
    expect(hand()?.item).toBe("tinto");
    expect(bag.view("u").slots[1]).toEqual({ itemId: "obj:pandebono", quantity: 1 });
    expect(views.at(-1)?.pick).toBeUndefined();
  });

  it("el orden de las casillas se guarda y se respeta al volver a leer", async () => {
    const repo = new MemoryRepository();
    const first = bagFor(repo);
    await first.bag.add("u", "obj:tinto");
    await first.bag.add("u", "obj:fresa");
    expect(first.bag.move("u", "obj:fresa", 20)).toBe(true);
    // A una casilla ocupada: se intercambian.
    expect(first.bag.move("u", "obj:tinto", 20)).toBe(true);
    await first.bag.flush("u");
    expect(Object.fromEntries(repo.bagSlots.get("u")!)).toEqual({ "obj:tinto": 20, "obj:fresa": 0 });
    const second = bagFor(repo);
    await second.bag.load("u");
    expect(second.bag.view("u").slots[20]?.itemId).toBe("obj:tinto");
    expect(second.bag.view("u").slots[0]?.itemId).toBe("obj:fresa");
    // Lo que se acaba libera su casilla.
    expect(await second.bag.take("u", "obj:fresa", 1)).toBe(true);
    await second.bag.flush("u");
    expect(repo.bagSlots.get("u")!.has("obj:fresa")).toBe(false);
  });

  it("no caben más de 36 cosas distintas ni se pasa el tope de una pila", async () => {
    const { bag, repo } = bagFor();
    for (let i = 0; i < BAG.slots - 1; i++) repo.give("u", `obj:cosa-${i}`);
    repo.give("u", "obj:regadera");
    await bag.load("u");
    expect(bag.fits("u", [["obj:tinto", 1]])).toBe("full");
    expect(await bag.add("u", "obj:tinto")).toBe("full");
    // Lo que ya está suma a su pila, hasta su tope.
    expect(bag.fits("u", [["obj:cosa-1", BAG.stackMax - 1]])).toBe("ok");
    expect(bag.fits("u", [["obj:cosa-1", BAG.stackMax]])).toBe("stack");
    expect(bag.fits("u", [["obj:regadera", 1]])).toBe("stack");
    expect(repo.held("u", "obj:tinto")).toBe(0);
  });

  it("la regadera no se gasta: se llena, se vacía regando y sigue en la mochila", async () => {
    const { bag, repo, hand } = bagFor();
    await bag.add("u", "obj:regadera", 1, { pick: true });
    expect(hand()).toEqual({ item: EMPTY_CAN, left: [1] });
    expect(bag.use("u", 0, { tool: true, skipCooldown: true })).toEqual({ ok: false, error: "empty" });
    expect(bag.fill("u")).toBe(true);
    expect(hand()).toEqual({ item: WATERING_CAN, left: [HUERTO.canUses] });
    // Con F no se toma el agua.
    expect(bag.use("u", 0)).toEqual({ ok: false, error: "empty" });
    for (let k = HUERTO.canUses - 1; k >= 0; k--) expect(bag.use("u", 0, { tool: true, skipCooldown: true })).toMatchObject({ ok: true, left: k, done: k === 0 });
    expect(hand()).toEqual({ item: EMPTY_CAN, left: [1] });
    await bag.flush("u");
    expect(repo.held("u", "obj:regadera")).toBe(1);
  });

  it("give (lo de antes de la mochila) suma un combo por partes o un objeto nuevo, y avisa si no cabe", async () => {
    const { bag, repo, hand } = bagFor();
    expect(await bag.give("u", "onces")).toBe("ok");
    expect(repo.held("u", "obj:tinto")).toBe(1);
    expect(repo.held("u", "obj:pandebono")).toBe(1);
    expect(hand()?.item).toBe("tinto");
    expect(await bag.give("u", "llavero-casino")).toBe("ok");
    expect(repo.held("u", "obj:llavero-casino")).toBe(1);
    for (let i = 0; i < BAG.slots; i++) await bag.add("u", `obj:cosa-${i}`);
    expect(await bag.give("u", "whisky")).toBe("full");
  });

  it("cada bolsa de semillas siembra unas pocas veces y después sale de la mochila", async () => {
    const { bag, repo, hand } = bagFor();
    await bag.add("u", `obj:${seedsOf("papa")}`, 1, { pick: true });
    for (let k = 0; k < HUERTO.seedUses; k++) expect(bag.use("u", 0, { tool: true, skipCooldown: true }).ok).toBe(true);
    await bag.flush("u");
    expect(repo.held("u", `obj:${seedsOf("papa")}`)).toBe(0);
    expect(hand()).toBeUndefined();
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

describe("confitería del cine", () => {
  it("junto a la máquina de crispetas se pide el combo: las crispetas en la mano y la gaseosa en la mochila", async () => {
    const { room, alice, order } = await setup(30);
    await walkNextTo(alice, room, "sotano", "cinema_snacks");
    const price = menuItem("combo-cine")!.price;
    expect(await order("combo-cine", MSG.cinemaOrder)).toEqual({ ok: true, item: "combo-cine", balance: 30 - price });
    expect(me(alice, room).held).toBe("crispetas");
    expect(me(alice, room).heldLeft).toBe(String(usesOf("crispetas")));
    expect(repo.held("u-alice", "obj:coca-cola")).toBe(1);
    expect(repo.ledger.at(-1)).toMatchObject({ amount: -price, reason: "PURCHASE", refId: "cine:combo-cine" });
  });

  it("en la barra del club no se piden crispetas, ni un trago en la confitería", async () => {
    const { room, alice, order } = await setup(30);
    await walkNextTo(alice, room, "sotano", "club_bar");
    expect(await order("crispetas", MSG.cinemaOrder)).toEqual({ ok: false, item: "crispetas", error: "far" });
    await walkNextTo(alice, room, "sotano", "cinema_snacks");
    // Un trago no es de esta carta: el mensaje ni se acepta (la última respuesta sigue siendo la de antes).
    expect(await order("whisky", MSG.cinemaOrder)).toEqual({ ok: false, item: "crispetas", error: "far" });
    expect(await repo.getPoints("u-alice")).toBe(30);
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

describe("mochila en la sala", () => {
  const views = (client: ClientRoom) => {
    const got: BagView[] = [];
    client.onMessage(BAG_MSG.state, (v: BagView) => got.push(v));
    return got;
  };

  it("al entrar llega la mochila con lo que hay en la base, y la primera casilla queda en la mano", async () => {
    repo.give("u-alice", "obj:whisky", 2);
    repo.give("u-alice", "sofa");
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const got = views(alice);
    await room.waitForNextPatch();
    await tick(40);
    expect(got.at(-1)).toMatchObject({ selected: 0, pick: true });
    const slots = got.at(-1)!.slots;
    expect(slots.filter(Boolean)).toHaveLength(2);
    expect(slots[0]).toEqual({ itemId: "obj:whisky", quantity: 2 });
    expect(me(alice, room).held).toBe("whisky");
  });

  it("la mano sale de la casilla elegida: sin nada ahí (o con un mueble) no hay nada que usar", async () => {
    repo.give("u-alice", "obj:cerveza");
    repo.give("u-alice", "sofa");
    const { room, alice, use, used } = await setup(0);
    const bag = bagOf(room).view("u-alice");
    const slotOf = (itemId: string) => bag.slots.findIndex((s) => s?.itemId === itemId);
    alice.send(BAG_MSG.select, { slot: slotOf("sofa") });
    await tick(30);
    await room.waitForNextPatch();
    expect(me(alice, room).held).toBe("");
    // Una casilla vacía: nada en la mano, aunque el cliente diga otra cosa.
    alice.send(BAG_MSG.select, { slot: 30 });
    alice.send(BAG_MSG.select, { slot: 99 });
    await tick(30);
    await use();
    expect(used.alice).toEqual([]);
    await holdItem(alice, room, "obj:cerveza");
    expect(me(alice, room).held).toBe("cerveza");
    await use();
    expect(used.alice).toHaveLength(1);
  });

  it("usar hasta el final gasta la unidad de la mochila", async () => {
    const { room, alice, order, use } = await setup(50);
    await walkNextTo(alice, room, "sotano", "club_bar");
    await order("cerveza");
    expect(repo.held("u-alice", "obj:cerveza")).toBe(1);
    for (let k = 0; k < usesOf("cerveza"); k++) {
      await use();
      await tick(OfficeRoom.consumeCooldownMs);
    }
    await bagOf(room).flush("u-alice");
    expect(repo.held("u-alice", "obj:cerveza")).toBe(0);
    expect(me(alice, room).held).toBe("");
  });

  it("se reordena y se tira (los muebles no), y se guarda en la base", async () => {
    repo.give("u-alice", "obj:tinto", 3);
    repo.give("u-alice", "sofa");
    const { room, alice } = await setup(0);
    const notices: BagNotice[] = [];
    alice.onMessage(BAG_MSG.notice, (n: BagNotice) => notices.push(n));
    alice.send(BAG_MSG.move, { itemId: "obj:tinto", to: 13 });
    await tick(40);
    await bagOf(room).flush("u-alice");
    expect(repo.bagSlots.get("u-alice")?.get("obj:tinto")).toBe(13);
    alice.send(BAG_MSG.drop, { itemId: "obj:tinto", quantity: 2 });
    alice.send(BAG_MSG.drop, { itemId: "sofa", quantity: 1 });
    await tick(60);
    await bagOf(room).flush("u-alice");
    expect(repo.held("u-alice", "obj:tinto")).toBe(1);
    expect(repo.held("u-alice", "sofa")).toBe(1);
    expect(notices).toEqual([{ code: "furniture" }]);
  });

  it("si la web cambió la mochila (la tienda, un regalo), el aviso de puntos la hace releer", async () => {
    const { room, alice } = await setup(0);
    const got = views(alice);
    repo.give("u-alice", "obj:fresa", 4);
    await OfficeRoom.reloadPointsEverywhere("u-alice");
    await tick(40);
    expect(got.at(-1)?.slots.some((s) => s?.itemId === "obj:fresa" && s.quantity === 4)).toBe(true);
    // Cae en la primera casilla libre, que es la elegida: queda en la mano (como en Stardew).
    expect(me(alice, room).held).toBe("fresa");
  });
});
