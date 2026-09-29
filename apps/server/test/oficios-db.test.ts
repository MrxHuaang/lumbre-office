// Los oficios contra la base (los helpers de `@hyvento/db`), con la base de mentira: la experiencia inicial
// de los veteranos se calcula una sola vez (también si dos lecturas llegan a la vez), el tope diario de
// las acciones y el nivel que queda al día.
import { addSkillXpTx, creditSkillXpTx, loadSkillsTx } from "@hyvento/db";
import { LEVEL_XP, OFICIO, STAT_KEYS } from "@hyvento/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeDb } from "./fake-db";

let db: FakeDb;
const MON = Date.UTC(2026, 8, 28, 15, 0);
beforeEach(() => {
  db = new FakeDb();
  db.addUser("ana", 0);
  db.t.stats.push({ userId: "ana", key: STAT_KEYS.fishCaught, value: 10 }, { userId: "ana", key: "bolsa:obj:tinto", value: 3 });
});

const skill = (s: string) => db.t.skills.find((r) => r.userId === "ana" && r.skill === s);

describe("oficios en la base", () => {
  it("el veterano recibe lo de sus contadores una sola vez, aunque dos lecturas lleguen a la vez", async () => {
    const [a, b] = await Promise.all([db.transaction((tx) => loadSkillsTx(tx, "ana", MON)), db.transaction((tx) => loadSkillsTx(tx, "ana", MON))]);
    expect(a.xp.pesca).toBe(80);
    expect(b.xp.pesca).toBe(80);
    const again = await db.transaction((tx) => loadSkillsTx(tx, "ana", MON));
    expect(again.xp.pesca).toBe(80);
    expect(skill("_veterano")).toMatchObject({ xp: 80, level: 0 });
    expect(skill("pesca")).toMatchObject({ xp: 80, level: 2 });
  });

  it("las acciones entran con el tope diario y el nivel queda al día", async () => {
    await db.transaction((tx) => loadSkillsTx(tx, "ana", MON));
    expect(await db.transaction((tx) => addSkillXpTx(tx, "ana", { pesca: 150, huerta: 0.5 }, MON))).toEqual({ pesca: 150 });
    expect(await db.transaction((tx) => addSkillXpTx(tx, "ana", { pesca: 150 }, MON))).toEqual({ pesca: OFICIO.dailyActionCap - 150 });
    expect(skill("pesca")).toMatchObject({ xp: 80 + OFICIO.dailyActionCap });
    expect(skill("pesca")!.level).toBe(2);
    // Los encargos suman sin tope, con el nivel al día.
    await db.transaction((tx) => creditSkillXpTx(tx, "ana", "pesca", LEVEL_XP[3]!));
    expect(skill("pesca")!.level).toBeGreaterThanOrEqual(4);
  });
});
