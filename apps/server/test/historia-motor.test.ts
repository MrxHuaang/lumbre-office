// El motor de la historia (VIR-150) sin Colyseus: capítulos inyectados (así se prueba sin el contenido
// real), la bandera y la carta al terminar cada uno, el primer paso del siguiente que se abre solo (al
// terminar y al cargar a quien ya cumplía lo que lo abre), "Saltar historia" que solo salta el primero y los
// pasos que piden entregar objetos (todo o nada).
import { getWorld, questGiverSpot } from "@hyvento/map";
import { STAT_KEYS, STORY_PERIOD, dailyPeriod, questById, type ActiveQuest, type Capitulo, type HistoriaLetter, type QuestDef } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Encargos } from "../src/rooms/encargos";

const MON = Date.UTC(2026, 8, 28, 15, 0);
const OLLA = questById("evelio-olla")!;
const LLAVE = "obj:llave-prueba";

const step = (id: string, extra: Partial<QuestDef> = {}): QuestDef => ({
  id,
  kind: "story",
  giver: "aurora",
  title: id,
  text: id,
  stat: `prueba:${id}`,
  goal: 1,
  reward: { points: 3, skill: "exploracion", xp: 5 },
  ...extra,
});

const letter = (id: string) => ({ id, from: "E.", title: id, body: id });

const CAP_A: Capitulo = {
  id: "a",
  n: 1,
  title: "Primero",
  summary: "Lo primero.",
  steps: [step("a-1", { next: "a-2" }), step("a-2")],
  lessons: { "a-1": "Consejo uno", "a-2": "Consejo dos" },
  flag: STAT_KEYS.storyCh1,
  letter: letter("carta-a"),
  fromStats: true,
};

const CAP_B: Capitulo = {
  id: "b",
  n: 2,
  title: "Segundo",
  summary: "Lo segundo.",
  steps: [step("b-1", { next: "b-2" }), step("b-2", { deliver: [{ itemId: LLAVE, n: 2 }] })],
  lessons: {},
  opensWith: STAT_KEYS.storyCh1,
  flag: STAT_KEYS.storyCh2,
  letter: letter("carta-b"),
};

/** Un tercero sin carta, que abre con el segundo. */
const CAP_C: Capitulo = { id: "c", n: 3, title: "Tercero", summary: "", steps: [step("c-1")], lessons: {}, opensWith: STAT_KEYS.storyCh2, flag: STAT_KEYS.storyCh3 };

const CHAPTERS = [CAP_A, CAP_B, CAP_C];

function make(opts: { stats?: Record<string, number>; items?: Record<string, number> } = {}) {
  const repo = new MemoryRepository();
  const stats = new Map(Object.entries(opts.stats ?? {}));
  const bag = new Map(Object.entries(opts.items ?? {}));
  const sent: { type: string; message: unknown }[] = [];
  const done: string[] = [];
  const recibidor = getWorld().areas.get("planta-baja")!;
  const spot = questGiverSpot(recibidor, "aurora")!;
  let now = MON;
  let q: Encargos;
  const deps = {
    repo: () => repo,
    now: () => now,
    pick: (_u: string, t: number): ActiveQuest[] => [{ def: OLLA, period: dailyPeriod(t), shared: false }],
    context: () => ({}),
    place: () => ({ area: "planta-baja", x: spot.x, y: spot.y }),
    map: (a: string) => getWorld().areas.get(a)!,
    send: (_u: string, type: string, message: unknown) => void sent.push({ type, message }),
    later: () => {},
    held: {
      count: (_u: string, itemId: string) => bag.get(itemId) ?? 0,
      fits: () => "ok" as const,
      add: async (_u: string, itemId: string, n = 1) => {
        bag.set(itemId, (bag.get(itemId) ?? 0) + n);
        return "ok" as const;
      },
      take: async (_u: string, itemId: string, n = 1) => {
        if ((bag.get(itemId) ?? 0) < n) return false;
        bag.set(itemId, bag.get(itemId)! - n);
        return true;
      },
    },
    // Como el rastreador de logros: lo pendiente llega a la base con los contadores.
    flushStats: async (u: string) => {
      await repo.saveStats(u, [], q.take(u));
    },
    paid: () => {},
    stats: {
      load: async () => {},
      stat: (_u: string, key: string) => stats.get(key),
      max: (_u: string, key: string, v: number) => void stats.set(key, Math.max(stats.get(key) ?? v, v)),
    },
    chapters: CHAPTERS,
    // Como la sala: la bandera y, la primera vez, la carta.
    chapterDone: (_u: string, chapter: Capitulo) => {
      done.push(chapter.id);
      const first = !stats.get(chapter.flag);
      stats.set(chapter.flag, 1);
      if (first && chapter.letter) sent.push({ type: "letter", message: { id: chapter.letter.id, chapter: chapter.id } satisfies HistoriaLetter });
    },
  };
  q = new Encargos(deps);
  const row = (id: string) => q.rowsOf("u").find((r) => r.questId === id && r.period === STORY_PERIOD);
  const advance = (id: string) => q.onStat("u", `prueba:${id}`, 1);
  const claim = async (id: string) => {
    const r = await q.claim("u", { questId: id, period: STORY_PERIOD });
    now += 1000;
    return r;
  };
  const letters = () => sent.filter((m) => m.type === "letter").map((m) => m.message);
  return { q, repo, stats, bag, done, row, advance, claim, letters };
}

describe("historia: el motor de capítulos", () => {
  it("al cargar solo está abierto el primer capítulo (el segundo espera la bandera del primero)", async () => {
    const s = make();
    await s.q.load("u", { join: true });
    expect(s.row("a-1")).toMatchObject({ status: "ACTIVE" });
    expect(s.row("b-1")).toBeUndefined();
  });

  it("al terminar un capítulo: su bandera, su carta y el primer paso del siguiente", async () => {
    const s = make();
    await s.q.load("u", { join: true });
    s.advance("a-1");
    expect(await s.claim("a-1")).toMatchObject({ ok: true, points: 3 });
    s.advance("a-2");
    expect(await s.claim("a-2")).toMatchObject({ ok: true });
    expect(s.done).toEqual(["a"]);
    expect(s.stats.get(STAT_KEYS.storyCh1)).toBe(1);
    expect(s.letters()).toEqual([{ id: "carta-a", chapter: "a" }]);
    // El segundo queda abierto en memoria y en la base; el tercero todavía no.
    expect(s.row("b-1")).toMatchObject({ status: "ACTIVE", progress: 0 });
    expect(s.repo.quest("u", "b-1", STORY_PERIOD)).toMatchObject({ status: "ACTIVE" });
    expect(s.row("c-1")).toBeUndefined();
    // Y avanza como cualquier paso (los del 2 no se marcan solos con los contadores de antes).
    expect(s.q.view("u").quests.some((v) => v.questId === "b-1")).toBe(true);
  });

  it("al cargar a quien ya cumplía lo que abre un capítulo y no tiene su primer paso, se lo abre", async () => {
    const s = make({ stats: { [STAT_KEYS.storyCh1]: 1 } });
    await s.q.load("u", { join: true });
    expect(s.row("b-1")).toMatchObject({ status: "ACTIVE" });
    expect(s.row("c-1")).toBeUndefined();
  });

  it("solo el capítulo con `fromStats` marca hechos los pasos que el contador ya cumplía", async () => {
    const s = make({ stats: { [STAT_KEYS.storyCh1]: 1, "prueba:a-1": 3, "prueba:b-1": 3 } });
    await s.q.load("u", { join: true });
    expect(s.row("a-1")).toMatchObject({ status: "DONE" });
    expect(s.row("b-1")).toMatchObject({ status: "ACTIVE", progress: 0 });
  });

  it("saltar la historia salta solo el primer capítulo, sin pagar, y abre el segundo", async () => {
    const s = make();
    await s.q.load("u", { join: true });
    expect(await s.q.skipStory("u")).toBe(true);
    expect(s.row("a-1")).toMatchObject({ status: "CLAIMED" });
    expect(s.row("a-2")).toMatchObject({ status: "CLAIMED" });
    expect(s.letters()).toEqual([{ id: "carta-a", chapter: "a" }]);
    expect(s.row("b-1")).toMatchObject({ status: "ACTIVE" });
    expect(await s.repo.getPoints("u")).toBe(0);
    // Ya saltado: no hay nada más que saltar (el segundo no se salta).
    expect(await s.q.skipStory("u")).toBe(false);
    expect(s.row("b-1")).toMatchObject({ status: "ACTIVE" });
  });

  it("un paso que pide objetos: sin todos no se entrega; con todos, salen de la mochila y termina el capítulo", async () => {
    const s = make({ stats: { [STAT_KEYS.storyCh1]: 1 }, items: { [LLAVE]: 1 } });
    await s.q.load("u", { join: true });
    s.advance("b-1");
    expect(await s.claim("b-1")).toMatchObject({ ok: true });
    s.advance("b-2");
    // Falta una llave: no se entrega y no se toca la mochila.
    expect(await s.claim("b-2")).toMatchObject({ ok: false, error: "missing" });
    expect(s.bag.get(LLAVE)).toBe(1);
    expect(s.row("b-2")).toMatchObject({ status: "DONE" });
    s.bag.set(LLAVE, 3);
    expect(await s.claim("b-2")).toMatchObject({ ok: true });
    expect(s.bag.get(LLAVE)).toBe(1);
    expect(s.stats.get(STAT_KEYS.storyCh2)).toBe(1);
    expect(s.letters()).toEqual([{ id: "carta-b", chapter: "b" }]);
    // El tercero (sin carta) se abre con la bandera del segundo.
    expect(s.row("c-1")).toMatchObject({ status: "ACTIVE" });
  });

  it("si la entrega no sale (la base dice que no estaba cumplido), los objetos vuelven a la mochila", async () => {
    const s = make({ stats: { [STAT_KEYS.storyCh1]: 1 }, items: { [LLAVE]: 2 } });
    await s.q.load("u", { join: true });
    s.advance("b-1");
    await s.claim("b-1");
    s.advance("b-2");
    s.repo.claimQuest = async () => ({ ok: false, error: "not-done" });
    expect(await s.claim("b-2")).toMatchObject({ ok: false, error: "not-done" });
    expect(s.bag.get(LLAVE)).toBe(2);
    expect(s.stats.get(STAT_KEYS.storyCh2)).toBeUndefined();
  });
});
