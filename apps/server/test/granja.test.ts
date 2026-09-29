import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, GRANJA_LAYOUT, isBlockedTile, pointsOfType } from "@hyvento/map";
import {
  bogotaDay,
  FARM_ANIMALS,
  GALLINERO,
  GAME_DAY_REAL_MS,
  GRANJA_MSG,
  GRANJA_STATS,
  grillRate,
  grillRecipe,
  MSG,
  MOLINO,
  PARRILLA,
  PARRILLA_MSG,
  portionOf,
  ROOM_NAME,
  type CoopState,
  type FurnitureEvent,
  type GameClockState,
  type GranjaNotice,
  type GrillNotice,
  type GrillState,
  type PortionShared,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Granja, type FarmAnimalView } from "../src/rooms/granja";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { Parrilla, type GrillJobView, type GrillWho } from "../src/rooms/parrilla";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, holdItem, tick, token, walkToTile, type ServerRoom } from "./helpers";

// La granja: el gallinero (dar de comer una vez al día con racha, los huevos del día del juego, los
// nombres que se votan y los animales que corren al comedero), el molino (mazorca → harina, más rápido con
// lluvia) y la parrilla (ingredientes de la mochila, tiempo compartido, porciones y lo que se trae de la
// cafetería).

const jardin = getWorld().areas.get("jardin")!;
const T0 = Date.UTC(2026, 8, 28, 15, 0);
const CLOCK: GameClockState = { anchorReal: T0, anchorMinute: 8 * 60 };

/** Una mochila de mentira (una por persona). */
function fakeBag() {
  const items = new Map<string, Map<string, number>>();
  const hands = new Map<string, { item: string; left: number }>();
  let full = false;
  const of = (u: string) => items.get(u) ?? (items.set(u, new Map()), items.get(u)!);
  return {
    items,
    hands,
    setFull: (v: boolean) => void (full = v),
    put: (u: string, id: string, n: number) => void of(u).set(`obj:${id}`, n),
    n: (u: string, id: string) => of(u).get(`obj:${id}`) ?? 0,
    bag: {
      count: (u: string, itemId: string) => of(u).get(itemId) ?? 0,
      fits: (u: string, list: readonly (readonly [string, number])[]) => (full && list.some(([id]) => !of(u).has(id)) ? ("full" as const) : ("ok" as const)),
      take: async (u: string, itemId: string, q: number) => {
        const have = of(u).get(itemId) ?? 0;
        if (have < q) return false;
        if (have === q) of(u).delete(itemId);
        else of(u).set(itemId, have - q);
        return true;
      },
      add: async (u: string, itemId: string, q: number) => {
        of(u).set(itemId, (of(u).get(itemId) ?? 0) + q);
        return "ok" as const;
      },
      get: (u: string) => {
        const h = hands.get(u);
        return h ? { item: h.item, left: [h.left] } : undefined;
      },
      use: (u: string) => {
        const h = hands.get(u);
        if (!h || h.left < 1) return { ok: false };
        h.left -= 1;
        return { ok: true };
      },
    },
  };
}

/** Contadores de mentira (como el rastreador de logros). */
function fakeStats() {
  const stats = new Map<string, Map<string, number>>();
  const of = (u: string) => stats.get(u) ?? (stats.set(u, new Map()), stats.get(u)!);
  return {
    stats,
    isLoaded: () => true,
    stat: (u: string, k: string) => of(u).get(k),
    max: (u: string, k: string, v: number) => void of(u).set(k, Math.max(of(u).get(k) ?? -Infinity, v)),
    bump: (u: string, k: string, by = 1) => void of(u).set(k, (of(u).get(k) ?? 0) + by),
  };
}

function granja(opts: { votes?: { userId: string; key: string; value: number }[]; night?: boolean } = {}) {
  const b = fakeBag();
  const st = fakeStats();
  const animals = new Map<string, FarmAnimalView>();
  const notices: [string, GranjaNotice][] = [];
  const timers: { fn: () => void; dead: boolean; ms: number }[] = [];
  let eggs = -1;
  let clock = { ...CLOCK };
  let night = opts.night ?? false;
  const awarded: number[] = [];
  const g = new Granja({
    animals,
    create: () => ({ id: "", kind: "", coat: "", name: "", x: 0, y: 0, dir: "down", pose: "stand" }),
    setEggs: (n) => void (eggs = n),
    map: () => jardin,
    rng: () => 0.5,
    bag: b.bag,
    stats: st,
    award: async (_u, amount) => (awarded.push(amount), amount),
    loadVotes: async () => opts.votes ?? [],
    gameClock: () => clock,
    gameNight: () => night,
    later: (ms, fn) => {
      const t = { fn, dead: false, ms };
      timers.push(t);
      return { clear: () => void (t.dead = true) };
    },
    notify: (u, n) => void notices.push([u, n]),
  });
  const fire = () => timers.filter((t) => !t.dead).forEach((t) => ((t.dead = true), t.fn()));
  return {
    g,
    ...b,
    st,
    animals,
    notices,
    timers,
    fire,
    awarded,
    eggs: () => eggs,
    setClock: (c: GameClockState) => void (clock = c),
    setNight: (v: boolean) => void (night = v),
  };
}

const alice = { userId: "u-alice", name: "Alice" };
const bob = { userId: "u-bob", name: "Bob" };

describe("gallinero (reglas del servidor)", () => {
  it("los animales aparecen dentro de su patio y del corral, y no salen al pasear", () => {
    const f = granja();
    f.g.start(T0);
    expect([...f.animals.keys()].sort()).toEqual(FARM_ANIMALS.map((a) => a.id).sort());
    const inside = (a: FarmAnimalView) => {
      const r = a.kind === "cabra" ? GRANJA_LAYOUT.corral : GRANJA_LAYOUT.henYard;
      const tx = Math.floor(a.x / 32);
      const ty = Math.floor(a.y / 32);
      return tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h && !isBlockedTile(jardin, tx, ty);
    };
    for (let t = 0; t < 400; t++) {
      f.g.tick(T0 + t * GALLINERO.tickMs, GALLINERO.tickMs);
      for (const a of f.animals.values()) expect(inside(a), `${a.id} en ${a.x},${a.y}`).toBe(true);
    }
  });

  it("dar de comer: una vez al día de Bogotá por persona, con puntos y la racha que sube de a un día", async () => {
    const f = granja();
    f.g.start(T0);
    const today = bogotaDay(T0);
    expect(await f.g.feed(alice, T0)).toEqual({ code: "fed", points: GALLINERO.feedPoints, streak: 1 });
    expect(await f.g.feed(alice, T0 + 60_000)).toEqual({ code: "alreadyFed" });
    // Todos corren al comedero (y la cabra al pesebre).
    for (const a of FARM_ANIMALS) expect(["walk", "eat"]).toContain(f.g.modeOf(a.id));
    // Otro día seguido: racha de 2, un punto más.
    const tomorrow = T0 + 86_400_000;
    expect(await f.g.feed(alice, tomorrow)).toMatchObject({ code: "fed", streak: 2, points: GALLINERO.feedPoints + 1 });
    // Se salta un día: la racha vuelve a 1.
    expect(await f.g.feed(alice, tomorrow + 2 * 86_400_000)).toMatchObject({ code: "fed", streak: 1, points: GALLINERO.feedPoints });
    expect(f.st.stat("u-alice", GRANJA_STATS.best)).toBe(2);
    expect(f.st.stat("u-alice", GRANJA_STATS.lastDay)).toBe(today + 3);
    // La de Bob es aparte.
    expect(await f.g.feed(bob, T0)).toMatchObject({ code: "fed", streak: 1 });
    const state = await f.g.coopState(bob, T0);
    expect(state.fedToday).toBe(true);
    expect(state.feeders).toEqual(["Bob"]);
  });

  it("la racha sale de los contadores guardados (sobrevive a reiniciar el servidor) y tiene tope", async () => {
    const f = granja();
    const today = bogotaDay(T0);
    f.st.max("u-alice", GRANJA_STATS.lastDay, today - 1);
    f.st.max("u-alice", GRANJA_STATS.since, today - 20);
    const n = await f.g.feed(alice, T0);
    expect(n).toEqual({ code: "fed", streak: 21, points: GALLINERO.feedPoints + GALLINERO.streakBonusMax });
  });

  it("los huevos: el primero del día del juego se los lleva todos a la mochila; al amanecer hay más", async () => {
    const f = granja();
    f.g.start(T0);
    expect(f.eggs()).toBe(GALLINERO.eggsPerDay);
    expect(await f.g.collectEggs(alice, T0)).toEqual({ code: "eggs", count: GALLINERO.eggsPerDay });
    expect(f.n("u-alice", "huevo")).toBe(GALLINERO.eggsPerDay);
    expect(f.eggs()).toBe(0);
    expect(await f.g.collectEggs(bob, T0)).toEqual({ code: "noEggs", name: "Alice" });
    // Con la mochila llena no se sacan del nido.
    f.setClock({ anchorReal: T0, anchorMinute: CLOCK.anchorMinute + 24 * 60 });
    f.setFull(true);
    expect(await f.g.collectEggs(bob, T0)).toEqual({ code: "bagFull" });
    expect(f.eggs()).toBe(GALLINERO.eggsPerDay);
    f.setFull(false);
    expect(await f.g.collectEggs(bob, T0)).toEqual({ code: "eggs", count: GALLINERO.eggsPerDay });
  });

  it("los huevos cambian con el amanecer del juego (06:00), no a la medianoche", async () => {
    const f = granja();
    f.setClock({ anchorReal: T0, anchorMinute: 5 * 60 });
    f.g.start(T0);
    await f.g.collectEggs(alice, T0);
    // 05:59 → todavía el mismo día de huevos.
    const minute = GAME_DAY_REAL_MS / (24 * 60);
    expect((await f.g.collectEggs(bob, T0 + 59 * minute)).code).toBe("noEggs");
    // 06:00 → ya pusieron.
    expect((await f.g.collectEggs(bob, T0 + 60 * minute + 1)).code).toBe("eggs");
  });

  it("de noche del juego se van a dormir y de día vuelven a pasear", () => {
    const f = granja();
    f.g.start(T0);
    f.setNight(true);
    for (let t = 0; t < 300; t++) f.g.tick(T0 + t * GALLINERO.tickMs, GALLINERO.tickMs);
    for (const a of FARM_ANIMALS) expect(f.g.modeOf(a.id), a.id).toBe("sleep");
    f.setNight(false);
    f.g.tick(T0 + 301 * GALLINERO.tickMs, GALLINERO.tickMs);
    for (const a of FARM_ANIMALS) expect(f.g.modeOf(a.id), a.id).not.toBe("sleep");
  });

  it("los nombres se votan: gana el más votado, vale el último voto de cada uno y se leen los guardados", async () => {
    const hen = FARM_ANIMALS[0]!;
    const f = granja({ votes: [{ userId: "u-carla", key: `${GRANJA_STATS.votePrefix}${hen.id}`, value: 8 * 1000 + 2 }] });
    f.g.start(T0);
    await f.g.loadNames();
    expect(f.animals.get(hen.id)!.name).toBe(hen.names[2]);
    expect(await f.g.vote(alice, { animal: hen.id, option: 1 }, T0)).toEqual({ code: "voted" });
    expect(await f.g.vote(bob, { animal: hen.id, option: 1 }, T0)).toEqual({ code: "voted" });
    expect(f.animals.get(hen.id)!.name).toBe(hen.names[1]);
    // Alice cambia de idea (en el mismo minuto): su voto nuevo reemplaza al de antes.
    expect(await f.g.vote(alice, { animal: hen.id, option: 0 }, T0 + GALLINERO.voteCooldownMs)).toEqual({ code: "voted" });
    const s: CoopState = await f.g.coopState(alice, T0);
    const view = s.animals.find((a) => a.id === hen.id)!;
    expect(view.votes).toEqual([1, 1, 1, 0]);
    expect(view.mine).toBe(0);
    // Lo inválido se ignora.
    expect(await f.g.vote(alice, { animal: "dragón", option: 0 }, T0 + 5000)).toBeNull();
    expect(await f.g.vote(alice, { animal: hen.id, option: 7 }, T0 + 6000)).toBeNull();
  });
});

describe("molino (reglas del servidor)", () => {
  it("muele una mazorca de la mochila en harina al rato; con lluvia tarda menos; sin mazorca, no", async () => {
    const f = granja();
    expect((await f.g.grind(alice, false, T0)).notice.code).toBe("noCorn");
    f.put("u-alice", "mazorca", 2);
    const r = await f.g.grind(alice, false, T0);
    expect(r).toEqual({ notice: { code: "grinding" }, ms: MOLINO.grindMs });
    expect(f.n("u-alice", "mazorca")).toBe(1);
    expect((await f.g.grind(alice, false, T0 + 100)).notice.code).toBe("busy");
    f.fire();
    await tick(0);
    expect(f.n("u-alice", "harina")).toBe(MOLINO.flourPerCorn);
    expect(f.notices.at(-1)).toEqual(["u-alice", { code: "flour", count: MOLINO.flourPerCorn }]);
    expect((await f.g.grind(alice, true, T0 + MOLINO.grindMs + 1)).ms).toBe(MOLINO.grindWetMs);
  });

  it("al cerrar la sala, la mazorca de la molienda sin terminar vuelve a la mochila y no sale harina", async () => {
    const f = granja();
    f.put("u-alice", "mazorca", 1);
    await f.g.grind(alice, false, T0);
    expect(f.n("u-alice", "mazorca")).toBe(0);
    const restored: [string, string, number][] = [];
    await f.g.close(async (u, itemId, n) => void restored.push([u, itemId, n]));
    expect(restored).toEqual([["u-alice", "obj:mazorca", 1]]);
    // El temporizador que quedó (si el reloj no se hubiera cancelado) ya no entrega nada.
    f.fire();
    await tick(0);
    expect(f.n("u-alice", "harina")).toBe(0);
  });
});

// ---------- Parrilla ----------

function parrilla() {
  const b = fakeBag();
  const jobs = new Map<string, GrillJobView>();
  const notices: [string, GrillNotice][] = [];
  const awarded: [string, number][] = [];
  let balance = 100;
  const spots = new Map<string, GrillWho>();
  const p = new Parrilla({
    jobs,
    create: () => ({ name: "", recipe: "", station: "", progress: 0, rate: 1, at: 0, cookMs: 0 }),
    map: () => jardin,
    bag: b.bag,
    award: async (u, amount) => (awarded.push([u, amount]), amount),
    spend: async (_u, amount) => {
      if (balance < amount) return { ok: false, balance };
      balance -= amount;
      return { ok: true, balance };
    },
    where: (u) => spots.get(u),
    bump: () => undefined,
    notify: (u, n) => void notices.push([u, n]),
    timeScale: () => 1,
  });
  return { p, ...b, jobs, notices, awarded, spots, balance: () => balance };
}

const grill = pointsOfType(jardin, "grill")[0]!;
const at = (userId: string, name: string, x = grill.x, y = grill.y, sessionId = `s-${name}`): GrillWho => ({ userId, sessionId, name, area: "jardin", x, y });

describe("parrilla (reglas del servidor)", () => {
  it("cocina solo junto al horno, con lo de la mochila; tarda lo de la receta y el plato va a la mochila con puntos", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    f.spots.set("u-alice", a);
    expect((await f.p.cook({ ...a, x: 0, y: 0 }, { recipe: "mazorca-asada" }, T0))?.notice.code).toBe("far");
    expect((await f.p.cook(a, { recipe: "mazorca-asada" }, T0))?.notice.code).toBe("missing");
    expect(await f.p.cook(a, { recipe: "pan-miel" }, T0)).toBeNull();
    f.put("u-alice", "mazorca", 1);
    const r = await f.p.cook(a, { recipe: "mazorca-asada" }, T0 + 1000);
    expect(r?.notice).toEqual({ code: "cooking", item: "mazorca-asada" });
    expect(f.n("u-alice", "mazorca")).toBe(0);
    expect(f.jobs.get("u-alice")).toMatchObject({ recipe: "mazorca-asada", station: "parrilla", rate: 1 });
    const recipe = grillRecipe("mazorca-asada")!;
    f.p.tick(T0 + 1000 + recipe.cookMs - 1);
    expect(f.jobs.has("u-alice")).toBe(true);
    f.p.tick(T0 + 1000 + recipe.cookMs);
    await tick(0);
    expect(f.jobs.has("u-alice")).toBe(false);
    expect(f.n("u-alice", "mazorca-asada")).toBe(1);
    expect(f.awarded).toEqual([["u-alice", recipe.points]]);
    expect(f.notices.at(-1)).toEqual(["u-alice", { code: "done", item: "mazorca-asada", points: recipe.points }]);
  });

  it("con dos cocinando sale más rápido para los dos, y dan bono por cocinar juntos", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    const b = at("u-bob", "Bob");
    f.spots.set("u-alice", a);
    f.spots.set("u-bob", b);
    f.put("u-alice", "mazorca", 1);
    f.put("u-bob", "mazorca", 1);
    const recipe = grillRecipe("mazorca-asada")!;
    await f.p.cook(a, { recipe: recipe.id }, T0);
    await f.p.cook(b, { recipe: recipe.id }, T0);
    expect(f.jobs.get("u-alice")!.rate).toBe(grillRate(2));
    expect(grillRate(2)).toBeGreaterThan(1);
    // A los dos les falta menos que a uno solo.
    const t = T0 + Math.ceil(recipe.cookMs / grillRate(2));
    f.p.tick(t);
    await tick(0);
    expect(f.n("u-alice", "mazorca-asada")).toBe(1);
    expect(f.n("u-bob", "mazorca-asada")).toBe(1);
    expect(f.awarded).toContainEqual(["u-alice", recipe.points + PARRILLA.togetherBonus]);
    // Mientras cocina no se pone otra cosa.
    f.put("u-alice", "mazorca", 2);
    await f.p.cook(a, { recipe: recipe.id }, t + 1000);
    expect((await f.p.cook(a, { recipe: recipe.id }, t + 3000))?.notice.code).toBe("busy");
  });

  it("si se fue lejos el plato queda en la mochila (sin la mano); si no cabe, espera y avisa", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    f.put("u-alice", "mazorca", 1);
    await f.p.cook(a, { recipe: "mazorca-asada" }, T0);
    f.spots.set("u-alice", { ...a, x: 10, y: 10 });
    f.p.tick(T0 + grillRecipe("mazorca-asada")!.cookMs);
    await tick(0);
    expect(f.notices.at(-1)?.[1].code).toBe("doneBag");
  });

  it("queso y chorizo se traen de la cafetería con puntos", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    expect((await f.p.buy(a, { item: "queso", quantity: 2 }, T0))?.notice).toEqual({ code: "bought", item: "queso", count: 2 });
    expect(f.n("u-alice", "queso")).toBe(2);
    expect(f.balance()).toBe(100 - 2 * 3);
    expect((await f.p.buy(a, { item: "chorizo", quantity: 5 }, T0 + 1000))?.notice.code).toBe("bought");
    expect(await f.p.buy(a, { item: "whisky", quantity: 1 }, T0 + 2000)).toBeNull();
    expect((await f.p.buy({ ...a, x: 0 }, { item: "queso", quantity: 1 }, T0 + 3000))?.notice.code).toBe("far");
  });

  it("se pide una porción del plato que otro lleva en la mano: de cerca, dejándole al menos una", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    const b = at("u-bob", "Bob", grill.x + 20, grill.y);
    f.hands.set("u-alice", { item: "pizza-horno", left: 2 });
    const r = await f.p.portion(b, a, { sessionId: a.sessionId }, T0);
    expect(r?.notice).toEqual({ code: "gotPortion", item: "pizza-horno", name: "Alice" });
    expect(r?.shared).toEqual({ from: a.sessionId, to: b.sessionId, dish: "pizza-horno" });
    expect(f.n("u-bob", portionOf("pizza-horno"))).toBe(1);
    expect(f.hands.get("u-alice")!.left).toBe(1);
    expect(f.awarded).toEqual([["u-alice", PARRILLA.sharePoints]]);
    // La última porción es de quien cocinó.
    expect((await f.p.portion(b, a, { sessionId: a.sessionId }, T0 + PARRILLA.shareCooldownMs))?.notice.code).toBe("noPortion");
    // De lejos, no; lo que no es de la parrilla, tampoco.
    f.hands.set("u-alice", { item: "pizza-horno", left: 4 });
    expect((await f.p.portion({ ...b, x: grill.x + 200 }, a, { sessionId: a.sessionId }, T0 + 9000))?.notice.code).toBe("far");
    f.hands.set("u-alice", { item: "tinto", left: 3 });
    expect((await f.p.portion(b, a, { sessionId: a.sessionId }, T0 + 12000))?.notice.code).toBe("noPortion");
  });

  it("al cerrar la sala, los ingredientes de lo que está en el fuego vuelven a la mochila", async () => {
    const f = parrilla();
    const a = at("u-alice", "Alice");
    const b = at("u-bob", "Bob");
    f.spots.set("u-alice", a);
    f.spots.set("u-bob", b);
    f.put("u-alice", "harina", 2);
    f.put("u-alice", "queso", 1);
    f.put("u-bob", "mazorca", 1);
    expect((await f.p.cook(a, { recipe: "arepa-asada" }, T0))?.notice.code).toBe("cooking");
    expect((await f.p.cook(b, { recipe: "mazorca-asada" }, T0))?.notice.code).toBe("cooking");
    expect(f.n("u-alice", "harina")).toBe(0);
    const restored: [string, string, number][] = [];
    await f.p.close(async (u, itemId, n) => void restored.push([u, itemId, n]));
    expect(restored).toEqual(
      expect.arrayContaining([
        ["u-alice", "obj:harina", 2],
        ["u-alice", "obj:queso", 1],
        ["u-bob", "obj:mazorca", 1],
      ]),
    );
    expect(restored).toHaveLength(3);
    expect(f.jobs.size).toBe(0);
    // Ya no sale ningún plato (ni se dan puntos) aunque pase el tiempo.
    f.p.tick(T0 + 10 * 60_000);
    await tick(0);
    expect(f.awarded).toEqual([]);
  });
});

// ---------- En la sala ----------

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
  OfficeRoom.parrillaTimeScale = 0.002;
  OfficeRoom.molinoTimeScale = 0.01;
});
afterEach(() => {
  OfficeRoom.parrillaTimeScale = 1;
  OfficeRoom.molinoTimeScale = 1;
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

async function join(room: ServerRoom | null, name: string) {
  const r = room ?? ((await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom);
  const client = await colyseus.connectTo(r, { token: await token(`u-${name.toLowerCase()}`, name) });
  await r.waitForNextPatch();
  const notices: GranjaNotice[] = [];
  const grillNotices: GrillNotice[] = [];
  const grillStates: GrillState[] = [];
  const coop: CoopState[] = [];
  const shared: PortionShared[] = [];
  const events: FurnitureEvent[] = [];
  client.onMessage(GRANJA_MSG.notice, (n: GranjaNotice) => notices.push(n));
  client.onMessage(GRANJA_MSG.coopState, (s: CoopState) => coop.push(s));
  client.onMessage(PARRILLA_MSG.notice, (n: GrillNotice) => grillNotices.push(n));
  client.onMessage(PARRILLA_MSG.state, (s: GrillState) => grillStates.push(s));
  client.onMessage(PARRILLA_MSG.shared, (s: PortionShared) => shared.push(s));
  client.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.push(e));
  return { room: r, client, notices, grillNotices, grillStates, coop, shared, events };
}

async function send(client: ClientRoom, room: ServerRoom, type: string, raw?: unknown, wait = 80) {
  client.send(type, raw);
  await tick(wait);
  await room.waitForNextPatch();
}

/** Un tile libre al lado del mueble, al que se llega desde donde se está. */
function beside(type: string, from: { x: number; y: number }) {
  const f = jardin.furniture.find((f) => f.type === type)!;
  for (let y = f.y - 1; y <= f.y + f.d; y++)
    for (let x = f.x - 1; x <= f.x + f.w; x++) {
      const inside = x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d;
      if (!inside && !isBlockedTile(jardin, x, y) && findPath(jardin, from, { x, y })) return { f, spot: { x, y } };
    }
  throw new Error(`Sin lugar junto a ${type}`);
}
const tileOf = (client: ClientRoom, room: ServerRoom) => ({ x: Math.floor(me(client, room).x / 32), y: Math.floor(me(client, room).y / 32) });

describe("granja (en la sala)", () => {
  it("los animales están en el estado; dar de comer da puntos una vez y los huevos van a la mochila", { timeout: 30_000 }, async () => {
    const { room, client, notices, events, coop } = await join(null, "Alice");
    expect(room.state.granja.animals.size).toBe(FARM_ANIMALS.length);
    expect(room.state.granja.eggs).toBe(GALLINERO.eggsPerDay);
    const feeder = beside("chicken-feeder", tileOf(client, room));
    await walkToTile(client, room, feeder.spot.x, feeder.spot.y);
    await send(client, room, MSG.furnitureUse, { type: "chicken-feeder", x: feeder.f.x, y: feeder.f.y });
    expect(notices.at(-1)).toMatchObject({ code: "fed", streak: 1 });
    expect(events.at(-1)?.action).toBe("feed");
    expect(me(client, room).points).toBe(GALLINERO.feedPoints);
    await tick(1600);
    await send(client, room, MSG.furnitureUse, { type: "chicken-feeder", x: feeder.f.x, y: feeder.f.y });
    expect(notices.at(-1)?.code).toBe("alreadyFed");

    const coopF = beside("chicken-coop", tileOf(client, room));
    await walkToTile(client, room, coopF.spot.x, coopF.spot.y);
    // La pausa entre dos muebles de la misma persona.
    await tick(1600);
    await send(client, room, MSG.furnitureUse, { type: "chicken-coop", x: coopF.f.x, y: coopF.f.y });
    expect(notices.at(-1)).toEqual({ code: "eggs", count: GALLINERO.eggsPerDay });
    await bagOf(room).flush("u-alice");
    expect(bagOf(room).count("u-alice", "obj:huevo")).toBe(GALLINERO.eggsPerDay);
    expect(room.state.granja.eggs).toBe(0);

    // El letrero: el panel del día y los votos.
    const sign = pointsOfType(jardin, "farm_sign")[0]!;
    await walkToTile(client, room, sign.tileX, sign.tileY);
    await send(client, room, GRANJA_MSG.coopOpen);
    expect(coop.at(-1)).toMatchObject({ fedToday: true, streak: 1, eggsLeft: 0, eggsBy: "Alice", feeders: ["Alice"] });
    const goat = FARM_ANIMALS.find((a) => a.kind === "cabra")!;
    await send(client, room, GRANJA_MSG.vote, { animal: goat.id, option: 3 });
    expect(room.state.granja.animals.get(goat.id)!.name).toBe(goat.names[3]);
  });

  it("el molino muele la mazorca de la mochila en harina", { timeout: 30_000 }, async () => {
    const { room, client, notices, events } = await join(null, "Alice");
    await bagOf(room).add("u-alice", "obj:mazorca", 1);
    const mill = beside("water-mill", tileOf(client, room));
    await walkToTile(client, room, mill.spot.x, mill.spot.y);
    await send(client, room, MSG.furnitureUse, { type: "water-mill", x: mill.f.x, y: mill.f.y });
    expect(notices.map((n) => n.code)).toContain("grinding");
    expect(events.at(-1)).toMatchObject({ action: "grind" });
    await tick(MOLINO.grindMs * 0.01 + 200);
    await bagOf(room).flush("u-alice");
    expect(bagOf(room).count("u-alice", "obj:harina")).toBe(MOLINO.flourPerCorn);
    expect(bagOf(room).count("u-alice", "obj:mazorca")).toBe(0);
    expect(notices.at(-1)).toEqual({ code: "flour", count: MOLINO.flourPerCorn });
  });

  it("la parrilla: la barra en el estado, el plato en la mano y una porción para quien la pide", { timeout: 40_000 }, async () => {
    const A = await join(null, "Alice");
    const B = await join(A.room, "Bob");
    const { room } = A;
    await bagOf(room).add("u-alice", "obj:harina", 2);
    await bagOf(room).add("u-alice", "obj:huevo", 1);
    await bagOf(room).add("u-alice", "obj:tomate", 1);
    await bagOf(room).add("u-alice", "obj:queso", 1);
    const point = pointsOfType(jardin, "grill")[0]!;
    await send(A.client, room, PARRILLA_MSG.cook, { recipe: "pizza-horno" });
    expect(A.grillNotices.at(-1)?.code).toBe("far");
    await walkToTile(A.client, room, point.tileX, point.tileY);
    await send(A.client, room, PARRILLA_MSG.open);
    expect(A.grillStates.at(-1)?.pantry).toMatchObject({ harina: 2, huevo: 1, tomate: 1, queso: 1 });
    // Con la mano libre, el plato queda en la mano al salir.
    await bagOf(room).flush("u-alice");
    const free = bagOf(room).view("u-alice").slots.findIndex((s) => !s);
    A.client.send("bag:select", { slot: free });
    await send(A.client, room, PARRILLA_MSG.cook, { recipe: "pizza-horno" }, 20);
    expect(room.state.granja.grill.get("u-alice")).toMatchObject({ recipe: "pizza-horno", station: "horno" });
    await tick(grillRecipe("pizza-horno")!.cookMs * 0.002 + 400);
    await room.waitForNextPatch();
    expect(room.state.granja.grill.has("u-alice")).toBe(false);
    expect(A.grillNotices.at(-1)).toMatchObject({ code: "done", item: "pizza-horno" });
    await holdItem(A.client, room, "obj:pizza-horno");
    expect(me(A.client, room).held).toBe("pizza-horno");

    // Bob se acerca y pide una porción.
    await walkToTile(B.client, room, point.tileX + 1, point.tileY);
    await send(B.client, room, PARRILLA_MSG.portion, { sessionId: A.client.sessionId });
    expect(B.grillNotices.at(-1)).toMatchObject({ code: "gotPortion", item: "pizza-horno", name: "Alice" });
    expect(A.shared.at(-1)).toEqual({ from: A.client.sessionId, to: B.client.sessionId, dish: "pizza-horno" });
    expect(me(B.client, room).held).toBe(portionOf("pizza-horno"));
    expect(me(A.client, room).heldLeft).toBe(String(grillRecipe("pizza-horno")!.portions - 1));
  });
});
