// Mundo lleno: los muebles que antes eran de adorno. Las reglas de cada uno con dependencias falsas (la
// impresora, la ducha, la casita del perro, el tragamonedas, la garra y la rueda) y lo que tocan de lo que
// ya existía: el vaso de agua baja la borrachera, en el bote se pesca sentado y la casita hace descansar a
// la mascota.
import { buildArea, getWorld, type AreaDef, type OfficeMap } from "@hyvento/map";
import {
  bogotaDay,
  clawGrip,
  clawLayout,
  DRUNK,
  FORTUNE,
  FORTUNE_SECTORS,
  GARRA,
  MSG,
  MUNDO,
  MUNDO_MSG,
  PET_BOND,
  SLOTS,
  STAT_KEYS,
  WATER_CUP,
  type FurnitureEvent,
  type MundoNotice,
  type PetBondRecord,
} from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { SlotMachines } from "../src/rooms/casino/slots";
import { Drunkenness } from "../src/rooms/drunk";
import { Fishery } from "../src/rooms/fishing";
import { FortuneWheel } from "../src/rooms/fortuna";
import { ClawMachines } from "../src/rooms/garra";
import { Pets, type PetView } from "../src/rooms/mascotas";
import { MundoVivo, nearUsable } from "../src/rooms/mundo";
import { FurnitureUses } from "../src/rooms/usables";
import { c } from "./helpers";

/** Una sala de 12x8 con el dispensador, la impresora, la ducha, la casita del perro, el reloj de sol y un tragamonedas. */
const TEST_AREA: AreaDef = {
  id: "prueba-mundo",
  name: "Prueba",
  width: 12,
  height: 8,
  rooms: [{ id: "sala", rect: { x: 0, y: 0, w: 12, h: 8 }, floor: "wood", wallpaper: "cream" }],
  doors: [],
  zones: [],
  features: [],
  furniture: [
    { type: "water-cooler", x: 0, y: 0 },
    { type: "printer", x: 2, y: 0 },
    { type: "garden-shower", x: 4, y: 0 },
    { type: "dog-house", x: 6, y: 0 },
    { type: "sundial", x: 8, y: 0 },
    { type: "slot-machine", x: 10, y: 0 },
  ],
  portals: [],
  points: [{ type: "spawn", name: "Inicio", x: 5, y: 6 }],
};

const at = (tx: number, ty: number, userId = "u") => ({ userId, x: c(tx), y: c(ty) });

describe("mundo lleno: los muebles se usan como el resto", () => {
  it("el dispensador da un vaso de agua (gratis, como la cafetera) y los demás son un evento", () => {
    const map = buildArea(TEST_AREA);
    const uses = new FurnitureUses(new Map(), { bagFits: () => true });
    expect(uses.use(map, at(0, 1), { type: "water-cooler", x: 0, y: 0 }, 0)).toMatchObject({ ok: true, gives: { item: WATER_CUP, afterMs: 0 } });
    expect(uses.use(map, at(2, 1, "v"), { type: "printer", x: 2, y: 0 }, 0)).toMatchObject({ ok: true, event: { action: "print" } });
    expect(uses.use(map, at(8, 1, "w"), { type: "sundial", x: 8, y: 0 }, 0)).toMatchObject({ ok: true, event: { action: "sundial" } });
    expect(uses.use(map, at(10, 1, "x"), { type: "slot-machine", x: 10, y: 0 }, 0)).toMatchObject({ ok: true, event: { action: "panel" } });
    // Lejos, no.
    expect(uses.use(map, at(0, 7, "y"), { type: "printer", x: 2, y: 0 }, 0)).toEqual({ ok: false, error: "far" });
    expect(nearUsable(map, "slot-machine", c(10), c(1))).toBeDefined();
    expect(nearUsable(map, "slot-machine", c(2), c(6))).toBeUndefined();
  });

  it("un sorbo de agua baja la borrachera (sin pasar de sobrio)", () => {
    let now = 0;
    const stages: number[] = [];
    const drunk = new Drunkenness({ setTimeout: () => ({ clear() {} }) }, () => now, { onChange: (_u, s) => stages.push(s), onBlackout() {}, onWake() {} });
    for (let i = 0; i < 4; i++) drunk.consumed("u", "whisky");
    expect(drunk.stage("u")).toBe(2);
    for (let i = 0; i < 3; i++) drunk.consumed("u", WATER_CUP);
    expect(drunk.stage("u")).toBe(1);
    for (let i = 0; i < 20; i++) drunk.consumed("u", WATER_CUP);
    expect(drunk.stage("u")).toBe(0);
    // Sobrio, el agua no hace nada raro.
    drunk.consumed("v", WATER_CUP);
    expect(drunk.stage("v")).toBe(0);
    expect(DRUNK.stages[0]).toBeGreaterThan(MUNDO.waterSoberPerSip);
  });
});

describe("mundo lleno: la impresora, la ducha y la casita (MundoVivo)", () => {
  function setup(opts: { notes?: string[]; full?: boolean; pet?: "noPet" | "far" | "ok" } = {}) {
    const map = buildArea(TEST_AREA);
    const sent: { type: string; msg: unknown; to: string }[] = [];
    const timers: (() => void)[] = [];
    const added: string[] = [];
    let dried = 0;
    let now = 1_000;
    const mundo = new MundoVivo({
      now: () => now,
      player: () => ({ userId: "u", area: map.id, x: c(2), y: c(1) }),
      map: () => map,
      toArea: (_a, type, msg) => sent.push({ type, msg, to: "area" }),
      toSession: (_s, type, msg) => sent.push({ type, msg, to: "me" }),
      later: (_ms, fn) => (timers.push(fn), { clear() {} }),
      noteTitle: async () => opts.notes?.at(-1) ?? null,
      bag: { fits: () => (opts.full ? "full" : "ok"), add: async (_u, itemId) => (added.push(itemId), "ok") },
      dry: () => (dried++, true),
      restPet: () => (opts.pet === "ok" ? { ok: true, name: "Canela", gained: true } : { ok: false, error: opts.pet === "far" ? "far" : "noPet" }),
      bump: () => {},
    });
    const notices = () => sent.filter((s) => s.type === MUNDO_MSG.notice).map((s) => s.msg as MundoNotice);
    const events = () => sent.filter((s) => s.type === MSG.furnitureEvent).map((s) => s.msg as FurnitureEvent);
    return { mundo, sent, timers, added, notices, events, dried: () => dried, tick: (ms: number) => (now += ms) };
  }
  const ev = (type: string, x: number, action: FurnitureEvent["action"]) => ({ type, x, y: 0, action, seed: 7 });

  it("la impresora saca tu nota más reciente como una hoja, y hay que esperar para imprimir otra", async () => {
    const t = setup({ notes: ["Vieja", "Plan del viernes"] });
    await t.mundo.use("s", ev("printer", 2, "print"));
    expect(t.added).toEqual(["obj:hoja"]);
    expect(t.notices()).toEqual([{ code: "printed", text: "Plan del viernes" }]);
    expect(t.events()).toHaveLength(1);
    await t.mundo.use("s", ev("printer", 2, "print"));
    expect(t.notices().at(-1)).toEqual({ code: "printBusy" });
    t.tick(MUNDO.printCooldownMs + 1);
    await t.mundo.use("s", ev("printer", 2, "print"));
    expect(t.added).toHaveLength(2);
  });

  it("sin notas no imprime nada; con la mochila llena, tampoco", async () => {
    const empty = setup();
    await empty.mundo.use("s", ev("printer", 2, "print"));
    expect(empty.notices()).toEqual([{ code: "noNote" }]);
    expect(empty.added).toEqual([]);
    const full = setup({ notes: ["Algo"], full: true });
    await full.mundo.use("s", ev("printer", 2, "print"));
    expect(full.notices()).toEqual([{ code: "full" }]);
  });

  it("la ducha: gotas para todos y, al terminar, seco", async () => {
    const t = setup();
    await t.mundo.use("s", ev("garden-shower", 4, "shower"));
    expect(t.events()).toHaveLength(1);
    expect(t.dried()).toBe(0);
    t.timers.forEach((fn) => fn());
    expect(t.dried()).toBe(1);
    expect(t.notices()).toEqual([{ code: "dry" }]);
  });

  it("la casita del perro: sin mascota (o lejos) un aviso tierno; con ella, descansa", async () => {
    const none = setup({ pet: "noPet" });
    await none.mundo.use("s", ev("dog-house", 6, "doghouse"));
    expect(none.notices()).toEqual([{ code: "noPet" }]);
    expect(none.events()).toHaveLength(0);
    const far = setup({ pet: "far" });
    await far.mundo.use("s", ev("dog-house", 6, "doghouse"));
    expect(far.notices()).toEqual([{ code: "petFar" }]);
    const ok = setup({ pet: "ok" });
    await ok.mundo.use("s", ev("dog-house", 6, "doghouse"));
    expect(ok.notices()).toEqual([{ code: "petRest", text: "Canela" }]);
    expect(ok.events()).toHaveLength(1);
  });

  it("el reloj de sol y los paneles solo avisan a los del nivel", async () => {
    const t = setup();
    await t.mundo.use("s", ev("sundial", 8, "sundial"));
    await t.mundo.use("s", ev("slot-machine", 10, "panel"));
    expect(t.events().map((e) => e.action)).toEqual(["sundial", "panel"]);
    expect(t.notices()).toEqual([]);
  });
});

describe("la casita del perro con las mascotas de verdad", () => {
  it("la mascota que te sigue camina hasta la casita, se echa y suma cariño con el tope diario", () => {
    const world = getWorld();
    const mapOf = (area: string): OfficeMap => world.areas.get(area)!;
    const jardin = mapOf("jardin");
    const house = jardin.furniture.find((f) => f.type === "dog-house")!;
    const pets = new Map<string, PetView>();
    const blank = (): PetView => ({ id: "", name: "", kind: "", coat: "", area: "", x: 0, y: 0, dir: "down", pose: "stand", ownerId: "", ownerName: "", love: 0 });
    const owner = { userId: "a", name: "Ana", area: "jardin", x: (house.x + 0.5) * 32, y: (house.y + 2.5) * 32 };
    const saved: PetBondRecord[] = [];
    const sim = new Pets({ pets, create: blank, map: mapOf, rng: () => 0.5, owner: (id) => (id === "a" ? owner : undefined), save: (b) => saved.push(b) });
    let now = Date.UTC(2026, 8, 27, 17);
    sim.start(now);
    // Sin mascota: nada.
    expect(sim.restAt("a", { ...house, area: "jardin" }, now, { love: MUNDO.doghouseLove, reachTiles: MUNDO.doghouseReachTiles })).toEqual({ ok: false, error: "noPet" });
    const id = [...pets.keys()][0]!;
    const pet = pets.get(id)!;
    Object.assign(pet, { area: "jardin", x: owner.x + 32, y: owner.y });
    expect(sim.act({ ...owner }, { pet: id, action: "adopt" }, now)).toMatchObject({ ok: true });
    // Aparece junto al dueño y lo sigue.
    for (let i = 0; i < 5; i++) sim.tick((now += 200), 200);
    const before = pet.love;
    const r = sim.restAt("a", { ...house, area: "jardin" }, now, { love: MUNDO.doghouseLove, reachTiles: MUNDO.doghouseReachTiles });
    expect(r).toMatchObject({ ok: true, gained: true });
    expect(pet.love).toBeGreaterThan(before);
    // Camina hasta la casita (aunque el dueño esté quieto al lado) y se echa ahí.
    for (let i = 0; i < 40; i++) sim.tick((now += 200), 200);
    expect(pet.pose).toBe("sleep");
    const dist = Math.hypot(pet.x - (house.x + 0.5) * 32, pet.y - (house.y + 0.5) * 32);
    expect(dist).toBeLessThanOrEqual(1.5 * 32);
    // El cariño no pasa el tope diario por persona.
    for (let i = 0; i < 20; i++) sim.restAt("a", { ...house, area: "jardin" }, now, { love: MUNDO.doghouseLove, reachTiles: MUNDO.doghouseReachTiles });
    expect(pet.love - before).toBeLessThanOrEqual(PET_BOND.dailyGainPerUser);
  });
});

describe("el tragamonedas", () => {
  function setup(opts: { balance?: number; enabled?: boolean; rolls?: number[] } = {}) {
    const repo = new MemoryRepository();
    repo.ledger.push({ userId: "u", amount: opts.balance ?? 100, reason: "ADMIN", at: 0 });
    const rolls = [...(opts.rolls ?? [])];
    const settled: [number, number, boolean][] = [];
    let now = 0;
    const slots = new SlotMachines({
      repo: () => repo,
      settings: () => ({ enabled: opts.enabled ?? true }),
      random: () => rolls.shift() ?? 0,
      now: () => now,
      setPoints: () => {},
      settled: (_u, staked, won, jackpot) => settled.push([staked, won, jackpot]),
    });
    return { repo, slots, settled, tick: (ms: number) => (now += ms) };
  }
  // Números en [0, 100) que caen en cada símbolo (pesos: tinto 30, arepa 26, mango 22, campana 12, estrella 7, siete 3).
  const SIETE = 99;
  const TINTO = 0;
  const AREPA = 40;

  it("cobra la apuesta y paga tres sietes (con el logro)", async () => {
    const t = setup({ rolls: [SIETE, SIETE, SIETE] });
    const r = await t.slots.spin({ userId: "u" }, { bet: 2 }, true);
    expect(r).toMatchObject({ ok: true, reels: ["siete", "siete", "siete"], won: 2 * SLOTS.three.siete, line: "three" });
    expect(await t.repo.getPoints("u")).toBe(100 - 2 + 2 * SLOTS.three.siete);
    expect(t.settled).toEqual([[2, 500, true]]);
    // El movimiento es del casino, con el juego en el refId (sale en las estadísticas de la caja).
    expect(t.repo.ledger.filter((m) => m.reason === "CASINO").every((m) => m.refId?.startsWith("tragamonedas:"))).toBe(true);
  });

  it("un par devuelve la apuesta; nada, la pierde", async () => {
    const t = setup({ rolls: [TINTO, TINTO, AREPA, TINTO, AREPA, SIETE] });
    expect(await t.slots.spin({ userId: "u" }, { bet: 5 }, true)).toMatchObject({ ok: true, line: "pair", won: 5 });
    t.tick(SLOTS.cooldownMs);
    expect(await t.slots.spin({ userId: "u" }, { bet: 5 }, true)).toMatchObject({ ok: true, line: "none", won: 0 });
    expect(await t.repo.getPoints("u")).toBe(95);
  });

  it("lejos, sin saldo, con el casino cerrado o muy seguido, no se juega (y no cobra)", async () => {
    const t = setup({ balance: 3 });
    expect(await t.slots.spin({ userId: "u" }, { bet: 5 }, true)).toEqual({ ok: false, error: "funds" });
    t.tick(SLOTS.cooldownMs);
    expect(await t.slots.spin({ userId: "u" }, { bet: 1 }, false)).toEqual({ ok: false, error: "far" });
    expect(await t.slots.spin({ userId: "u" }, { bet: 3 }, true)).toBeNull(); // apuesta que no se ofrece
    expect(await t.slots.spin({ userId: "u" }, { bet: 1 }, true)).toMatchObject({ ok: true });
    expect(await t.slots.spin({ userId: "u" }, { bet: 1 }, true)).toEqual({ ok: false, error: "busy" });
    const closed = setup({ enabled: false });
    expect(await closed.slots.spin({ userId: "u" }, { bet: 1 }, true)).toEqual({ ok: false, error: "disabled" });
    expect(await closed.repo.getPoints("u")).toBe(100);
  });
});

describe("la máquina de peluches", () => {
  function setup(opts: { balance?: number; roll?: number; full?: boolean } = {}) {
    const repo = new MemoryRepository();
    repo.ledger.push({ userId: "u", amount: opts.balance ?? 50, reason: "ADMIN", at: 0 });
    const bag: string[] = [];
    const stats: string[] = [];
    let now = 0;
    const claw = new ClawMachines({
      repo: () => repo,
      now: () => now,
      random: (n) => (n === 1000 ? (opts.roll ?? 0) : 12345),
      token: () => "t1",
      setPoints: () => {},
      bag: { fits: () => (opts.full ? "full" : "ok"), add: async (_u, id) => (bag.push(id), "ok") },
      bump: (_u, k) => stats.push(k),
    });
    return { repo, claw, bag, stats, tick: (ms: number) => (now += ms) };
  }
  const layout = clawLayout(12345);
  /** Justo encima del peluche del medio. */
  const center = 0.5;

  it("cobra el intento; soltando centrado y con buena suerte, el peluche va a la mochila", async () => {
    const t = setup({ roll: 0 });
    expect(await t.claw.start("u", true)).toEqual({ kind: "started", token: "t1", seed: 12345, balance: 50 - GARRA.price });
    t.tick(GARRA.minMs + 100);
    const r = await t.claw.drop("u", { token: "t1", x: center });
    expect(r).toEqual({ kind: "result", token: "t1", slot: 2, plush: layout[2], won: true, x: center });
    expect(t.bag).toEqual([`obj:${layout[2]}`]);
    expect(t.stats).toEqual([STAT_KEYS.clawPlays, STAT_KEYS.clawWins]);
    // El intento se cerró: el mismo token no vale dos veces.
    expect(await t.claw.drop("u", { token: "t1", x: center })).toEqual({ kind: "error", error: "expired" });
  });

  it("el servidor decide con su azar: con mala suerte se resbala (y en el borde casi nunca agarra)", async () => {
    const t = setup({ roll: 999 });
    await t.claw.start("u", true);
    t.tick(GARRA.minMs + 100);
    expect(await t.claw.drop("u", { token: "t1", x: center })).toMatchObject({ won: false });
    expect(t.bag).toEqual([]);
    expect(clawGrip(layout, 0.5).perMil).toBeGreaterThan(clawGrip(layout, 0.59).perMil);
  });

  it("soltar antes de que baje la garra no vale; lejos, sin puntos o sin espacio no empieza", async () => {
    const t = setup({ roll: 0 });
    await t.claw.start("u", true);
    t.tick(200);
    expect(await t.claw.drop("u", { token: "t1", x: center })).toEqual({ kind: "error", error: "expired" });
    expect(t.bag).toEqual([]);
    expect(await setup().claw.start("u", false)).toEqual({ kind: "error", error: "far" });
    expect(await setup({ balance: 3 }).claw.start("u", true)).toEqual({ kind: "error", error: "funds" });
    const full = setup({ full: true });
    expect(await full.claw.start("u", true)).toEqual({ kind: "error", error: "full" });
    expect(await full.repo.getPoints("u")).toBe(50);
  });
});

describe("la rueda de la fortuna", () => {
  function setup(opts: { loaded?: boolean; roll?: number } = {}) {
    const stats = new Map<string, number>();
    const given: string[] = [];
    const awarded: number[] = [];
    let now = Date.UTC(2026, 8, 27, 17);
    const wheel = new FortuneWheel({
      now: () => now,
      random: () => opts.roll ?? 0,
      stats: {
        isLoaded: () => opts.loaded ?? true,
        stat: (_u, k) => stats.get(k),
        max: (_u, k, v) => stats.set(k, Math.max(stats.get(k) ?? -Infinity, v)),
        bump: (_u, k) => stats.set(k, (stats.get(k) ?? 0) + 1),
      },
      award: async (_u, n) => (awarded.push(n), n),
      give: async (_u, id) => (given.push(id), "ok"),
    });
    return { wheel, stats, given, awarded, nextDay: () => (now += 86_400_000), today: () => bogotaDay(now) };
  }

  it("una vuelta gratis al día (día de Bogotá, guardado en UserStat)", async () => {
    const t = setup({ roll: 0 });
    expect(t.wheel.status("u")).toEqual({ kind: "status", spun: false });
    const r = await t.wheel.spin("u", true);
    expect(r).toMatchObject({ kind: "spin", sector: 0, points: FORTUNE_SECTORS[0]!.points });
    expect(t.stats.get(FORTUNE.statKey)).toBe(t.today());
    expect(t.stats.get(STAT_KEYS.fortuneSpins)).toBe(1);
    expect(await t.wheel.spin("u", true)).toEqual({ kind: "error", error: "spun" });
    expect(t.wheel.status("u")).toEqual({ kind: "status", spun: true });
    t.nextDay();
    expect(await t.wheel.spin("u", true)).toMatchObject({ kind: "spin" });
  });

  it("un premio de la cafetería va a la mochila", async () => {
    // El sector del tinto (el segundo): la suma de los pesos antes que él.
    const t = setup({ roll: FORTUNE_SECTORS[0]!.weight });
    expect(await t.wheel.spin("u", true)).toMatchObject({ kind: "spin", sector: 1, item: "tinto", kept: true, points: 0 });
    expect(t.given).toEqual(["tinto"]);
  });

  it("lejos o sin saber todavía si ya giró, no gira", async () => {
    expect(await setup().wheel.spin("u", false)).toEqual({ kind: "error", error: "far" });
    expect(await setup({ loaded: false }).wheel.spin("u", true)).toEqual({ kind: "error", error: "loading" });
  });
});

describe("pescar desde el bote", () => {
  it("sentado solo se lanza en el bote, y quedarse sentado no recoge el sedal", () => {
    const sent: { type: string }[] = [];
    const fishery = new Fishery({
      later: () => ({ clear() {} }),
      now: () => 0,
      random: () => 0,
      timings: () => ({ biteMinMs: 1000, biteMaxMs: 2000, biteWindowMs: 1000, reelMaxMs: 30_000, slackMs: 1000, showMs: 1000 }),
      hour: () => 12,
      repo: () => ({ saveFishCatch: async () => ({ previousBest: null, awarded: 0, balance: 0 }) }),
      newId: () => "c1",
      setPhase: () => {},
      send: (_u, e) => sent.push(e),
      points: () => {},
    });
    const who = { userId: "u", x: 100, y: 100, seated: true };
    expect(fishery.cast(who, true)).toBe(false);
    expect(sent.at(-1)).toMatchObject({ type: "refused", error: "seated" });
    expect(fishery.cast(who, true, { rod: "bambu", bait: null, boat: true })).toBe(true);
    fishery.moved("u", 100, 100, true);
    expect(fishery.phaseOf("u")).toBe("wait");
    // Pararse del bote recoge el sedal.
    fishery.moved("u", 100, 100, false);
    expect(fishery.phaseOf("u")).toBeNull();
  });
});
