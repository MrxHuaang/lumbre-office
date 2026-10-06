// Capítulo 3 de la historia en la sala (ver rooms/capitulo3.ts): cada paso solo cuenta con ese paso abierto
// (Celeste, Evelio que se hace el loco, la carnada en la estufa, la llavecita en el lago y Aurora), la
// carnada de E. solo se cocina con su paso, la llave pica solo con el agua brillando y no rompe la pesca de
// siempre, y el capítulo entero se juega con las entregas de cada quien y deja la carta 3.
import { getWorld, pointsOfType, questGiverSpot } from "@hyvento/map";
import {
  CAPITULOS,
  FISHING,
  HISTORIA_LAGO,
  HISTORIA_MSG,
  LAGO_CINE,
  LAGO_PASOS,
  OBJETOS_LAGO,
  STAT_KEYS,
  STORY_PERIOD,
  autoplay,
  celesteAhora,
  dailyPeriod,
  objItemId,
  questById,
  type ActiveQuest,
  type Capitulo,
  type FishingEvent,
  type FishingGear,
  type HistoriaLetter,
} from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Capitulo3 } from "../src/rooms/capitulo3";
import { Cocina } from "../src/rooms/cocina";
import { Encargos } from "../src/rooms/encargos";
import { Fishery } from "../src/rooms/fishing";

const BAIT = objItemId(OBJETOS_LAGO.carnada);
const KEY = objItemId(OBJETOS_LAGO.llave);

function setup(open: string | null, opts: { near?: boolean; glowing?: boolean; full?: boolean; items?: Record<string, number> } = {}) {
  const bag = new Map<string, number>(Object.entries(opts.items ?? {}));
  const stats = new Map<string, number>();
  const sent: { type: string; msg: { id?: string; text?: string; vars?: Record<string, unknown> } }[] = [];
  const steps = new Map<string, "open" | "done">();
  if (open) steps.set(open, "open");
  let now = 1_000_000;
  let glowing = opts.glowing ?? true;
  const cap = new Capitulo3({
    step: (_u, q) => steps.get(q) ?? null,
    bump: (_u, k) => stats.set(k, (stats.get(k) ?? 0) + 1),
    bag: {
      count: (_u, id) => bag.get(id) ?? 0,
      add: async (_u, id, n = 1) => {
        // Llena: la llave no entra (lo demás vuelve a su casilla).
        if (opts.full && id === KEY) return "full";
        bag.set(id, (bag.get(id) ?? 0) + n);
        return "ok";
      },
      take: async (_u, id, n = 1) => {
        if ((bag.get(id) ?? 0) < n) return false;
        const left = bag.get(id)! - n;
        if (left) bag.set(id, left);
        else bag.delete(id);
        return true;
      },
    },
    near: () => opts.near ?? true,
    glowing: () => glowing,
    now: () => now,
    send: (_s, type, msg) => sent.push({ type, msg: msg as never }),
  });
  const later = (ms = 2000) => void (now += ms);
  return { cap, bag, stats, sent, steps, later, setGlowing: (v: boolean) => void (glowing = v) };
}

const T0 = Date.UTC(2026, 8, 27, 15, 0);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("capítulo 3: preguntar", () => {
  it("la Profe Celeste cuenta lo del agua solo con el paso abierto y junto a ella, y dice si brilla esa noche", () => {
    const off = setup(LAGO_PASOS.evelio);
    off.cap.ask("s", "u", LAGO_PASOS.celeste);
    expect(off.stats.size).toBe(0);
    expect(off.sent).toEqual([]);

    const far = setup(LAGO_PASOS.celeste, { near: false });
    far.cap.ask("s", "u", LAGO_PASOS.celeste);
    expect(far.stats.size).toBe(0);
    expect(far.sent.at(-1)?.type).toBe(HISTORIA_MSG.aviso);

    const s = setup(LAGO_PASOS.celeste, { glowing: false });
    s.cap.ask("s", "u", LAGO_PASOS.celeste);
    expect(s.stats.get(HISTORIA_LAGO.celeste)).toBe(1);
    expect(s.sent.at(-1)).toEqual({ type: HISTORIA_MSG.cine, msg: { id: LAGO_CINE.celeste, vars: { ahora: celesteAhora(false) } } });
  });

  it("Don Evelio se hace el loco la primera vez y suelta la receta cuando se le insiste", () => {
    const s = setup(LAGO_PASOS.evelio);
    s.cap.ask("s", "u", LAGO_PASOS.evelio);
    expect(s.stats.get(HISTORIA_LAGO.receta)).toBeUndefined();
    expect(s.sent.at(-1)?.msg.id).toBe(LAGO_CINE.evelioLoco);
    // Muy seguido no cuenta (la pausa entre preguntas).
    s.cap.ask("s", "u", LAGO_PASOS.evelio);
    expect(s.sent).toHaveLength(1);
    s.later();
    s.cap.ask("s", "u", LAGO_PASOS.evelio);
    expect(s.stats.get(HISTORIA_LAGO.receta)).toBe(1);
    expect(s.sent.at(-1)?.msg.id).toBe(LAGO_CINE.evelioReceta);
  });

  it("si se va de la sala, Evelio se vuelve a hacer el loco", () => {
    const s = setup(LAGO_PASOS.evelio);
    s.cap.ask("s", "u", LAGO_PASOS.evelio);
    s.cap.forget("u");
    s.cap.ask("s", "u", LAGO_PASOS.evelio);
    expect(s.sent.map((m) => m.msg.id)).toEqual([LAGO_CINE.evelioLoco, LAGO_CINE.evelioLoco]);
  });

  it("a Doña Aurora se le muestra la llave solo teniéndola; la llave no sale de la mochila", () => {
    const s = setup(LAGO_PASOS.aurora);
    s.cap.ask("s", "u", LAGO_PASOS.aurora);
    expect(s.stats.size).toBe(0);
    expect(s.sent.at(-1)?.type).toBe(HISTORIA_MSG.aviso);
    s.bag.set(KEY, 1);
    s.later();
    s.cap.ask("s", "u", LAGO_PASOS.aurora);
    expect(s.stats.get(HISTORIA_LAGO.mostrada)).toBe(1);
    expect(s.sent.at(-1)?.msg.id).toBe(LAGO_CINE.aurora);
    expect(s.bag.get(KEY)).toBe(1);
  });

  it("los pasos que no se preguntan (cocinar, pescar) no responden a una pregunta", () => {
    const s = setup(LAGO_PASOS.carnada);
    s.cap.ask("s", "u", LAGO_PASOS.carnada);
    s.cap.ask("s", "u", "reloj-1");
    expect(s.stats.size).toBe(0);
    expect(s.sent).toEqual([]);
    expect(Capitulo3.asks(LAGO_PASOS.celeste)).toBe(true);
    expect(Capitulo3.asks(LAGO_PASOS.pescar)).toBe(false);
  });
});

describe("capítulo 3: la carnada y la llave", () => {
  it("cocinar la carnada cumple su paso solo con él abierto (otro plato no)", () => {
    const off = setup(LAGO_PASOS.pescar);
    off.cap.cooked("s", "u", OBJETOS_LAGO.carnada);
    expect(off.stats.size).toBe(0);
    const s = setup(LAGO_PASOS.carnada);
    s.cap.cooked("s", "u", "ajiaco");
    expect(s.stats.size).toBe(0);
    s.cap.cooked("s", "u", OBJETOS_LAGO.carnada);
    expect(s.stats.get(HISTORIA_LAGO.carnada)).toBe(1);
    expect(s.sent.at(-1)?.msg.id).toBe(LAGO_CINE.carnada);
  });

  it("la llave pica solo en el lago, con el paso abierto, el agua brillando y la carnada en la mochila", async () => {
    const none = setup(LAGO_PASOS.pescar);
    expect(none.cap.hookKey("s", "u", "jardin")).toBe(false); // sin carnada
    const closed = setup(LAGO_PASOS.carnada, { items: { [BAIT]: 1 } });
    expect(closed.cap.hookKey("s", "u", "jardin")).toBe(false); // otro paso
    const dark = setup(LAGO_PASOS.pescar, { glowing: false, items: { [BAIT]: 1 } });
    expect(dark.cap.hookKey("s", "u", "jardin")).toBe(false); // no brilla
    const elsewhere = setup(LAGO_PASOS.pescar, { items: { [BAIT]: 1 } });
    expect(elsewhere.cap.hookKey("s", "u", "casa:u")).toBe(false);

    const s = setup(LAGO_PASOS.pescar, { items: { [BAIT]: 1 } });
    expect(s.cap.hookKey("s", "u", "jardin")).toBe(true);
    await flush();
    expect(s.bag.get(BAIT)).toBeUndefined();
    expect(s.bag.get(KEY)).toBe(1);
    expect(s.stats.get(HISTORIA_LAGO.llave)).toBe(1);
    expect(s.sent.at(-1)?.msg.id).toBe(LAGO_CINE.pesca);
  });

  it("si la llave no cabe, la carnada vuelve y el paso sigue abierto", async () => {
    const s = setup(LAGO_PASOS.pescar, { full: true, items: { [BAIT]: 1 } });
    expect(s.cap.hookKey("s", "u", "jardin")).toBe(true);
    await flush();
    expect(s.bag.get(KEY)).toBeUndefined();
    expect(s.bag.get(BAIT)).toBe(1);
    expect(s.stats.size).toBe(0);
    expect(s.sent.at(-1)?.type).toBe(HISTORIA_MSG.aviso);
  });
});

describe("capítulo 3: la estufa", () => {
  const plantaBaja = getWorld().areas.get("planta-baja")!;
  const stove = pointsOfType(plantaBaja, "kitchen_stove")[0]!;
  const atStove = { userId: "u", x: stove.x, y: stove.y };

  function kitchen(open: string | null) {
    const bag = new Map<string, number>([
      ["obj:mazorca", 1],
      ["obj:miel", 1],
      ["obj:fresa", 1],
    ]);
    const cocina = new Cocina({
      bag: {
        count: (_u, id) => bag.get(id) ?? 0,
        fits: () => "ok",
        take: async (_u, id, n) => {
          if ((bag.get(id) ?? 0) < n) return false;
          const left = bag.get(id)! - n;
          if (left) bag.set(id, left);
          else bag.delete(id);
          return true;
        },
        add: async (_u, id, n) => (bag.set(id, (bag.get(id) ?? 0) + n), "ok"),
      },
      award: async () => 99,
      later: () => ({ clear: () => {} }),
      onBuff: () => {},
      storyOpen: (_u, q) => q === open,
    });
    return { cocina, bag };
  }

  it("sin el paso, la carnada de E. no se cocina ni se gastan los ingredientes", async () => {
    const { cocina, bag } = kitchen(LAGO_PASOS.celeste);
    const r = await cocina.cook(plantaBaja, atStove, { recipe: OBJETOS_LAGO.carnada }, T0);
    expect(r?.notice?.code).toBe("story");
    expect(bag.get("obj:mazorca")).toBe(1);
    expect(bag.get(BAIT)).toBeUndefined();
  });

  it("con el paso se cocina una (sin puntos) y una segunda no, porque ya la tiene", async () => {
    const { cocina, bag } = kitchen(LAGO_PASOS.carnada);
    const r = await cocina.cook(plantaBaja, atStove, { recipe: OBJETOS_LAGO.carnada }, T0);
    expect(r?.notice).toEqual({ code: "cooked", item: OBJETOS_LAGO.carnada, points: undefined });
    expect(bag.get(BAIT)).toBe(1);
    expect(bag.has("obj:mazorca")).toBe(false);
    bag.set("obj:mazorca", 1).set("obj:miel", 1).set("obj:fresa", 1);
    const again = await cocina.cook(plantaBaja, atStove, { recipe: OBJETOS_LAGO.carnada }, T0 + 10_000);
    expect(again?.notice?.code).toBe("have");
    expect(bag.get(BAIT)).toBe(1);
    expect(bag.get("obj:mazorca")).toBe(1);
  });
});

describe("capítulo 3: la pesca", () => {
  /** Una pesca con relojes a mano: `fire` dispara lo programado (la picada). */
  function fishery(storyCatch: (userId: string, area: string) => boolean) {
    const timers: { fn: () => void; dead: boolean }[] = [];
    const events: FishingEvent[] = [];
    let saved = 0;
    const f = new Fishery({
      later: (_ms, fn) => {
        const t = { fn, dead: false };
        timers.push(t);
        return { clear: () => void (t.dead = true) };
      },
      now: () => 0,
      random: (n) => (n === 2 ** 31 ? 777 : n === 1000 ? 999 : 0),
      timings: () => ({ ...FISHING, slackMs: 60_000 }),
      hour: () => 23,
      weather: () => "despejado",
      repo: () => ({
        saveFishCatch: async () => {
          saved++;
          return { previousBest: null, awarded: 3, balance: 3 };
        },
      }),
      newId: () => `cast-${timers.length}`,
      setPhase: () => {},
      send: (_u, e) => void events.push(e),
      points: () => {},
      storyCatch,
    });
    // La picada (los mordisqueos de antes no hacen nada si no se responde).
    const bite = () => timers.filter((t) => !t.dead).forEach((t) => ((t.dead = true), t.fn()));
    const castId = () => [...events].reverse().find((e): e is Extract<FishingEvent, { type: "cast" }> => e.type === "cast")!.castId;
    return { f, events, bite, castId, saved: () => saved };
  }
  const who = { userId: "u", x: 0, y: 0, seated: false, area: "jardin" };
  const gear: FishingGear = { rod: "bambu", bait: null };

  it("si lo que picó es la llave, el lance termina con `story`, sin minijuego ni pez guardado", () => {
    const s = fishery(() => true);
    expect(s.f.cast(who, true, gear)).toBe(true);
    s.bite();
    s.f.hook("u", { castId: s.castId() });
    expect(s.events.at(-1)).toEqual({ type: "end", castId: s.castId(), outcome: "story" });
    expect(s.events.some((e) => e.type === "start")).toBe(false);
    expect(s.f.phaseOf("u")).toBeNull();
    expect(s.saved()).toBe(0);
  });

  it("sin la llave la pesca sigue igual: minijuego, validación y pez guardado", async () => {
    let asked = 0;
    const s = fishery(() => (asked++, false));
    s.f.cast(who, true, gear);
    s.bite();
    s.f.hook("u", { castId: s.castId() });
    expect(asked).toBe(1);
    const start = s.events.find((e): e is Extract<FishingEvent, { type: "start" }> => e.type === "start")!;
    expect(start).toBeTruthy();
    const run = autoplay(start.challenge);
    await s.f.finish("u", { castId: s.castId(), frames: run.frames, inputs: run.inputs });
    expect(s.events.at(-1)).toMatchObject({ type: "end", outcome: "caught" });
    expect(s.saved()).toBe(1);
  });

  it("responder antes de la picada no le pregunta a la historia (el pez se asusta como siempre)", () => {
    let asked = 0;
    const s = fishery(() => (asked++, true));
    s.f.cast(who, true, gear);
    s.f.hook("u", { castId: s.castId() });
    expect(asked).toBe(0);
    expect(s.events.at(-1)).toMatchObject({ type: "end", outcome: "early" });
  });
});

describe("capítulo 3 entero, con las entregas de cada quien", () => {
  it("se abre con la bandera del 2, cada paso se entrega con quien lo da y al final llegan la bandera y la carta 3", async () => {
    const repo = new MemoryRepository();
    const stats = new Map<string, number>([
      [STAT_KEYS.storyCh1, 1],
      [STAT_KEYS.storyCh2, 1],
    ]);
    const letters: HistoriaLetter[] = [];
    const world = getWorld();
    const spotOf = (area: string, giver: string) => questGiverSpot(world.areas.get(area)!, giver) ?? pointsOfType(world.areas.get(area)!, "fishing_shop")[0]!;
    let place = { area: "observatorio", ...spotOf("observatorio", "celeste") };
    let now = Date.UTC(2026, 8, 28, 15, 0);
    let q: Encargos;
    q = new Encargos({
      repo: () => repo,
      now: () => now,
      pick: (_u: string, t: number): ActiveQuest[] => [{ def: questById("evelio-olla")!, period: dailyPeriod(t), shared: false }],
      context: () => ({}),
      place: () => place,
      map: (a: string) => world.areas.get(a)!,
      send: () => {},
      later: () => {},
      held: { count: () => 1, fits: () => "ok" as const, add: async () => "ok" as const, take: async () => true },
      flushStats: async (u: string) => {
        await repo.saveStats(u, [], q.take(u));
      },
      paid: () => {},
      stats: {
        load: async () => {},
        stat: (_u: string, key: string) => stats.get(key),
        max: (_u: string, key: string, v: number) => void stats.set(key, Math.max(stats.get(key) ?? v, v)),
      },
      chapters: CAPITULOS,
      chapterDone: (_u: string, chapter: Capitulo) => {
        stats.set(chapter.flag, 1);
        if (chapter.letter) letters.push({ id: chapter.letter.id, chapter: chapter.id });
      },
    });
    await q.load("u", { join: true });
    expect(q.storyStep("u", LAGO_PASOS.celeste)).toBe("open");

    const play = async (questId: string, stat: string, at: { area: string; x: number; y: number }) => {
      q.onStat("u", stat, 1);
      expect(q.storyStep("u", questId)).toBe("done");
      place = at;
      now += 5000;
      expect(await q.claim("u", { questId, period: STORY_PERIOD })).toMatchObject({ ok: true });
    };
    const evelio = { area: "jardin", ...spotOf("jardin", "evelio") };
    const aurora = { area: "planta-baja", ...spotOf("planta-baja", "aurora") };
    // Lejos de Celeste no se entrega.
    q.onStat("u", HISTORIA_LAGO.celeste, 1);
    place = evelio;
    expect(await q.claim("u", { questId: LAGO_PASOS.celeste, period: STORY_PERIOD })).toMatchObject({ ok: false, error: "far" });
    place = { area: "observatorio", ...spotOf("observatorio", "celeste") };
    now += 5000;
    expect(await q.claim("u", { questId: LAGO_PASOS.celeste, period: STORY_PERIOD })).toMatchObject({ ok: true });
    await play(LAGO_PASOS.evelio, HISTORIA_LAGO.receta, evelio);
    await play(LAGO_PASOS.carnada, HISTORIA_LAGO.carnada, evelio);
    await play(LAGO_PASOS.pescar, HISTORIA_LAGO.llave, evelio);
    await play(LAGO_PASOS.aurora, HISTORIA_LAGO.mostrada, aurora);
    expect(stats.get(STAT_KEYS.storyCh3)).toBe(1);
    expect(letters).toEqual([{ id: "carta-3", chapter: "llave" }]);
  });
});
