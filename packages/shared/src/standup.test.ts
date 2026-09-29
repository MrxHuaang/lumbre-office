import { beforeEach, describe, expect, it } from "vitest";
import { POINTS } from "./points";
import { cleanStandup, saveStandup, STANDUP, standupBoardFor, standupDay, standupRef, type StandupRecord, type StandupStore } from "./standup";

const NOON = Date.UTC(2026, 8, 28, 17); // 12 m. en Bogotá
const ana = { id: "u-ana" };
const bruno = { id: "u-bruno" };
const NAMES: Record<string, string> = { "u-ana": "Ana", "u-bruno": "Bruno" };

/** El mismo contrato que el almacén de Prisma (packages/db/src/standup.ts), en memoria. */
class MemoryStandupStore implements StandupStore {
  rows: StandupRecord[] = [];
  /** refIds de bonos ya pagados, por persona (como PointTransaction). */
  paid = new Set<string>();
  points: Record<string, number> = {};
  clock = NOON;

  async save({ userId, day, text, bonus }: Parameters<StandupStore["save"]>[0]) {
    const row = this.rows.find((r) => r.userId === userId && r.day === day);
    if (row) {
      row.text = text;
      row.updatedAt = new Date(this.clock);
      return { created: false, awarded: 0 };
    }
    this.rows.push({ userId, name: NAMES[userId] ?? "?", avatar: "ada", look: null, day, text, createdAt: new Date(this.clock), updatedAt: new Date(this.clock) });
    const key = `${userId}|${bonus.refId}`;
    if (this.paid.has(key)) return { created: true, awarded: 0 };
    this.paid.add(key);
    this.points[userId] = (this.points[userId] ?? 0) + bonus.amount;
    return { created: true, awarded: bonus.amount };
  }
  async listDay(day: string) {
    return this.rows.filter((r) => r.day === day).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

describe("standupDay", () => {
  it("cambia a la medianoche de Bogotá, no a la de UTC", () => {
    expect(standupDay(NOON)).toBe("2026-09-28");
    expect(standupDay(Date.UTC(2026, 8, 29, 4, 59))).toBe("2026-09-28"); // 11:59 p. m. en Bogotá
    expect(standupDay(Date.UTC(2026, 8, 29, 5, 0))).toBe("2026-09-29"); // medianoche en Bogotá
  });
});

describe("cleanStandup", () => {
  it("quita espacios de sobra y renglones vacíos repetidos", () => {
    expect(cleanStandup("  Terminar   el login \r\n\n\n\n  revisar PRs  ")).toBe("Terminar el login\n\nrevisar PRs");
  });
  it("corta al largo máximo", () => {
    expect(cleanStandup("a".repeat(STANDUP.maxLength + 50))).toHaveLength(STANDUP.maxLength);
  });
  it("sin texto queda vacío", () => {
    expect(cleanStandup(" \n\t ")).toBe("");
  });
});

describe("API del standup", () => {
  let store: MemoryStandupStore;
  beforeEach(() => {
    store = new MemoryStandupStore();
  });

  it("pide sesión", async () => {
    expect(await saveStandup(store, null, { text: "hola" }, NOON)).toEqual({ ok: false, error: "auth" });
    expect(await standupBoardFor(store, null, NOON)).toEqual({ ok: false, error: "auth" });
  });

  it("rechaza cuerpos inválidos o vacíos", async () => {
    expect(await saveStandup(store, ana, null, NOON)).toEqual({ ok: false, error: "invalid" });
    expect(await saveStandup(store, ana, { text: 42 }, NOON)).toEqual({ ok: false, error: "invalid" });
    expect(await saveStandup(store, ana, { text: "x".repeat(STANDUP.maxLength * 2 + 1) }, NOON)).toEqual({ ok: false, error: "invalid" });
    expect(await saveStandup(store, ana, { text: "   " }, NOON)).toEqual({ ok: false, error: "empty" });
    expect(store.rows).toHaveLength(0);
  });

  it("el primero del día da el bono y editarlo no vuelve a dar", async () => {
    const first = await saveStandup(store, ana, { text: "Terminar el login" }, NOON);
    expect(first).toEqual({ ok: true, value: { day: "2026-09-28", text: "Terminar el login", created: true, awarded: POINTS.standupBonus } });
    store.clock = NOON + 60 * 60_000;
    const edit = await saveStandup(store, ana, { text: "Terminar el login y el registro" }, store.clock);
    expect(edit).toMatchObject({ ok: true, value: { created: false, awarded: 0 } });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]!.text).toBe("Terminar el login y el registro");
    expect(store.points["u-ana"]).toBe(POINTS.standupBonus);
  });

  it("paga con el refId del día, así otro día vuelve a dar", async () => {
    await saveStandup(store, ana, { text: "Hoy" }, NOON);
    const tomorrow = NOON + 86_400_000;
    const next = await saveStandup(store, ana, { text: "Mañana" }, tomorrow);
    expect(next).toMatchObject({ ok: true, value: { day: "2026-09-29", created: true, awarded: POINTS.standupBonus } });
    expect(store.paid).toEqual(new Set([`u-ana|${standupRef("2026-09-28")}`, `u-ana|${standupRef("2026-09-29")}`]));
  });

  it("todos ven los de hoy, el propio primero y marcado como editado", async () => {
    await saveStandup(store, bruno, { text: "Diseño del tablón" }, NOON);
    store.clock = NOON + 60_000;
    await saveStandup(store, ana, { text: "Login" }, store.clock);
    store.clock = NOON + 10 * 60_000;
    await saveStandup(store, ana, { text: "Login y registro" }, store.clock);
    // Uno de ayer no aparece.
    store.rows.push({ ...store.rows[0]!, userId: "u-viejo", day: "2026-09-27" });

    const res = await standupBoardFor(store, ana, NOON + 20 * 60_000);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.day).toBe("2026-09-28");
    expect(res.value.bonus).toBe(POINTS.standupBonus);
    expect(res.value.standups.map((s) => [s.name, s.text, s.mine, s.edited])).toEqual([
      ["Ana", "Login y registro", true, true],
      ["Bruno", "Diseño del tablón", false, false],
    ]);

    const seenByBruno = await standupBoardFor(store, bruno, NOON + 20 * 60_000);
    expect(seenByBruno.ok && seenByBruno.value.standups.map((s) => [s.name, s.mine])).toEqual([
      ["Bruno", true],
      ["Ana", false],
    ]);
  });
});
