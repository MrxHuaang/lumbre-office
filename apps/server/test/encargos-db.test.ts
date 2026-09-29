// Los encargos contra la base (los helpers de `@hyvento/db` que usan el repositorio de Prisma y la web),
// con la base de mentira: avanzar sin pasarse de la meta, entregar una sola vez con el tope de QUEST, la
// experiencia del oficio y el paso siguiente de una historia.
import { advanceQuestsTx, bumpStatWithQuestsTx, claimQuestTx, loadQuests } from "@hyvento/db";
import { STAT_KEYS, STORY_PERIOD, currentQuests, dailyPeriod } from "@hyvento/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeDb } from "./fake-db";

let db: FakeDb;
const MON = Date.UTC(2026, 8, 28, 15, 0);
const DAY = dailyPeriod(MON);
beforeEach(() => {
  db = new FakeDb();
  db.addUser("ana", 0);
});

const row = (questId: string, period = DAY) => db.t.quests.find((q) => q.userId === "ana" && q.questId === questId && q.period === period);
const olla = (delta: number) => ({ questId: "evelio-olla", period: DAY, delta, goal: 3 });

describe("encargos en la base", () => {
  it("avanzar crea la fila, suma, se cumple en la meta sin pasarse, y lo cumplido ya no se toca", async () => {
    expect(await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(1)], MON))).toEqual([]);
    expect(row("evelio-olla")).toMatchObject({ progress: 1, goal: 3, status: "ACTIVE" });
    expect(await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(5)], MON))).toEqual([olla(5)]);
    expect(row("evelio-olla")).toMatchObject({ progress: 3, status: "DONE" });
    expect(row("evelio-olla")!.doneAt).toEqual(new Date(MON));
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(2)], MON));
    expect(row("evelio-olla")).toMatchObject({ progress: 3, status: "DONE" });
    // De una vez hasta la meta: nace cumplido.
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [{ questId: "tablon-foto", period: DAY, delta: 1, goal: 1 }], MON));
    expect(row("tablon-foto")).toMatchObject({ progress: 1, status: "DONE" });
  });

  it("cargar asigna lo que falta (sin pisar lo que había) y trae también las historias", async () => {
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(2)], MON));
    db.t.quests.push({ userId: "ana", questId: "cap1-llegada", period: STORY_PERIOD, progress: 0, goal: 1, status: "ACTIVE", createdAt: new Date(), doneAt: null, claimedAt: null });
    const got = await loadQuests(db.outside, "ana", [DAY], [
      { questId: "evelio-olla", period: DAY, goal: 3 },
      { questId: "tablon-foto", period: DAY, goal: 1 },
    ]);
    expect(got.map((q) => [q.questId, q.progress]).sort()).toEqual([
      ["cap1-llegada", 0],
      ["evelio-olla", 2],
      ["tablon-foto", 0],
    ]);
  });

  it("entregar paga una sola vez (QUEST, con el tope de 100 por día) y suma la experiencia del oficio", async () => {
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(3)], MON));
    const claim = (points: number, questId = "evelio-olla") =>
      db.transaction((tx) => claimQuestTx(tx, { userId: "ana", questId, period: DAY, points, skill: "pesca", xp: 25, now: MON }));
    expect(await claim(18)).toEqual({ ok: true, awarded: 18, balance: 18 });
    expect(db.t.moves.at(-1)).toMatchObject({ userId: "ana", amount: 18, reason: "QUEST", refId: `encargo:evelio-olla:${DAY}` });
    expect(await claim(18)).toEqual({ ok: false, error: "claimed" });
    expect(db.t.skills).toMatchObject([{ userId: "ana", skill: "pesca", xp: 25, level: 1 }]);
    expect(await claim(18, "tablon-foto")).toEqual({ ok: false, error: "not-done" });
    expect(db.t.skills[0]!.xp).toBe(25);
  });

  it("si no cabe entero bajo el tope de 100 no se entrega: queda cumplido (para mañana) y no se paga nada", async () => {
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(3), { questId: "semana-lago", period: DAY, delta: 20, goal: 20 }], MON));
    const claim = (questId: string, points: number, now = MON) =>
      db.transaction((tx) => claimQuestTx(tx, { userId: "ana", questId, period: DAY, points, skill: "pesca", xp: 25, now }));
    expect(await claim("evelio-olla", 18)).toMatchObject({ ok: true, awarded: 18 });
    // 18 + 90 pasa de 100: se rechaza antes de marcarlo.
    expect(await claim("semana-lago", 90)).toEqual({ ok: false, error: "capped" });
    expect(row("semana-lago")).toMatchObject({ status: "DONE", claimedAt: null });
    expect(db.points("ana")).toBe(18);
    expect(db.t.skills[0]!.xp).toBe(25);
    // Al otro día (dentro de la gracia) sí cabe.
    expect(await claim("semana-lago", 90, MON + 86_400_000)).toEqual({ ok: true, awarded: 90, balance: 108 });
  });

  it("dos creaciones de la misma fila a la vez (la web y el servidor) no chocan: la segunda solo suma", async () => {
    const [a, b] = await Promise.all([
      db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(1)], MON)),
      db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(1)], MON)),
    ]);
    expect([a, b]).toEqual([[], []]);
    expect(db.t.quests.filter((q) => q.questId === "evelio-olla")).toHaveLength(1);
    expect(row("evelio-olla")).toMatchObject({ progress: 2, status: "ACTIVE" });
  });

  it("dos entregas a la vez pagan una sola", async () => {
    await db.transaction((tx) => advanceQuestsTx(tx, "ana", [olla(3)], MON));
    const claim = () => db.transaction((tx) => claimQuestTx(tx, { userId: "ana", questId: "evelio-olla", period: DAY, points: 18, skill: "pesca", xp: 25, now: MON }));
    const results = await Promise.all([claim(), claim()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(db.points("ana")).toBe(18);
  });

  it("una historia: al entregar un paso se abre el siguiente", async () => {
    db.t.quests.push({ userId: "ana", questId: "paso-1", period: STORY_PERIOD, progress: 1, goal: 1, status: "DONE", createdAt: new Date(), doneAt: new Date(), claimedAt: null });
    const r = await db.transaction((tx) =>
      claimQuestTx(tx, { userId: "ana", questId: "paso-1", period: STORY_PERIOD, points: 10, skill: "exploracion", xp: 10, next: { questId: "paso-2", goal: 3 }, now: MON }),
    );
    expect(r).toMatchObject({ ok: true });
    expect(row("paso-2", STORY_PERIOD)).toMatchObject({ progress: 0, goal: 3, status: "ACTIVE" });
  });

  it("la web suma el contador y avanza lo de hoy que lo sigue (lo de noche no: no sabe la hora del juego)", async () => {
    const today = currentQuests("ana", MON);
    const first = today.find((q) => !q.def.when?.night && !q.def.when?.weather)!.def;
    await db.transaction((tx) => bumpStatWithQuestsTx(tx, "ana", first.stat, 1, MON));
    expect(db.t.stats).toEqual([{ userId: "ana", key: first.stat, value: 1 }]);
    const moved = db.t.quests.filter((q) => q.progress > 0).map((q) => q.questId);
    expect(moved).toContain(first.id);
    await db.transaction((tx) => bumpStatWithQuestsTx(tx, "ana", STAT_KEYS.missionsDone, 1, MON));
    expect(db.t.stats.find((s) => s.key === STAT_KEYS.missionsDone)?.value).toBe(1);
  });
});
