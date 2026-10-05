// La sala de los encargos sin Colyseus: la pausa creciente cuando la base falla y el `forget` de una
// sesión vieja, que no borra lo que cargó la nueva.
import { dailyPeriod, questById, type ActiveQuest } from "@hyvento/shared";
import { getWorld } from "@hyvento/map";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Encargos, retryDelayMs } from "../src/rooms/encargos";

const MON = Date.UTC(2026, 8, 28, 15, 0);
const OLLA = questById("evelio-olla")!;

function make(repo: MemoryRepository, clock: { now: number }) {
  const pick = (_u: string, t: number): ActiveQuest[] => [{ def: OLLA, period: dailyPeriod(t), shared: false }];
  return new Encargos({
    repo: () => repo,
    now: () => clock.now,
    pick,
    context: () => ({}),
    place: () => null,
    map: (a) => getWorld().areas.get(a)!,
    send: () => {},
    later: () => {},
    held: { fits: () => "ok", add: async () => "ok", take: async () => true, count: () => 0 },
    flushStats: async () => {},
    paid: () => {},
  });
}

describe("encargos: la sala por dentro", () => {
  it("si la base falla, no reintenta en cada suma: espera cada vez más (2 s, 4 s, 8 s… hasta un minuto)", async () => {
    const repo = new MemoryRepository();
    const clock = { now: MON };
    let calls = 0;
    repo.loadQuests = async () => {
      calls++;
      throw new Error("se cayó la base");
    };
    const q = make(repo, clock);
    await q.load("u");
    expect(calls).toBe(1);
    for (let i = 0; i < 50; i++) q.onStat("u", OLLA.stat, 1);
    await Promise.resolve();
    expect(calls).toBe(1);
    clock.now += retryDelayMs(1) + 1;
    q.onStat("u", OLLA.stat, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(calls).toBe(2);
    // La segunda falla espera el doble.
    clock.now += retryDelayMs(1) + 1;
    q.onStat("u", OLLA.stat, 1);
    await Promise.resolve();
    expect(calls).toBe(2);
    expect(retryDelayMs(2)).toBe(2 * retryDelayMs(1));
    expect(retryDelayMs(30)).toBe(60_000);
    // Al entrar (o si la web lo pide) se intenta ya.
    await q.load("u", { join: true });
    expect(calls).toBe(3);
  });

  it("el forget de una sesión que se fue no borra lo que cargó quien volvió a entrar", async () => {
    const repo = new MemoryRepository();
    const q = make(repo, { now: MON });
    await q.load("u", { join: true });
    const old = q.generation("u");
    // Vuelve a entrar antes de que termine de guardarse lo de la sesión vieja.
    await q.load("u", { join: true });
    q.forget("u", old);
    // Lo del día y el primer paso de la historia.
    expect(q.rowsOf("u")).toHaveLength(2);
    // El de la sesión de ahora sí la olvida.
    q.forget("u", q.generation("u"));
    expect(q.rowsOf("u")).toHaveLength(0);
  });
});
