import { describe, expect, it } from "vitest";
import { currentStage, ENTRY_SLOW_MS, ENTRY_STAGES, ENTRY_TIPS, entryDone, entryMood, entryPercent, nextShown, skyArc, stageSlowMs, tipOrder, type EntryState } from "./entry";

const T0 = 1_000_000;
const allDone = (): EntryState => Object.fromEntries(ENTRY_STAGES.map((s) => [s.id, { startedAt: T0, doneAt: T0 + 10 }]));

describe("barra de carga por etapas", () => {
  it("empieza en cero y llega a 100 solo con todo terminado", () => {
    expect(entryPercent({}, T0)).toBe(0);
    expect(entryDone({})).toBe(false);
    expect(entryPercent(allDone(), T0 + 20)).toBe(100);
    expect(entryDone(allDone())).toBe(true);
  });

  it("sin la última etapa no pasa de 99, aunque pase mucho rato", () => {
    const st = allDone();
    st.cuadro = { startedAt: T0 };
    expect(entryPercent(st, T0 + 10 * 60_000)).toBeLessThanOrEqual(99);
    expect(entryPercent(st, T0 + 10 * 60_000)).toBeGreaterThanOrEqual(95);
  });

  it("una etapa sin medida avanza sola, pero nunca se da por hecha", () => {
    const st: EntryState = { sesion: { startedAt: T0 } };
    const a = entryPercent(st, T0 + 200);
    const b = entryPercent(st, T0 + 2_000);
    const c = entryPercent(st, T0 + 600_000);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(entryPercent({ sesion: { startedAt: T0, doneAt: T0 + 1 } }, T0 + 600_000));
  });

  it("el avance medido cuenta (el arte, por archivos)", () => {
    const base: EntryState = { sesion: { startedAt: T0, doneAt: T0 }, conexion: { startedAt: T0, doneAt: T0 }, motor: { startedAt: T0, doneAt: T0 } };
    const low = entryPercent({ ...base, arte: { startedAt: T0, fraction: 0.1 } }, T0);
    const high = entryPercent({ ...base, arte: { startedAt: T0, fraction: 0.9 } }, T0);
    expect(high).toBeGreaterThan(low);
  });

  it("nombra la primera etapa que falta, aunque otras ya hayan terminado", () => {
    expect(currentStage({})?.id).toBe("sesion");
    // El motor se bajó antes que la conexión: la barra sigue en "conexión".
    const st: EntryState = { sesion: { doneAt: T0 }, despertar: { doneAt: T0 }, motor: { doneAt: T0 }, conexion: { startedAt: T0 } };
    expect(currentStage(st)?.id).toBe("conexion");
    expect(currentStage(allDone())).toBeNull();
  });

  it("despertar al servidor dormido tiene más plazo antes de ofrecer Reintentar", () => {
    const despertar = ENTRY_STAGES.find((s) => s.id === "despertar")!;
    const sesion = ENTRY_STAGES.find((s) => s.id === "sesion")!;
    expect(despertar.label).toContain("1 min");
    expect(stageSlowMs(despertar)).toBeGreaterThan(60_000);
    expect(stageSlowMs(sesion)).toBe(ENTRY_SLOW_MS);
    expect(stageSlowMs(null)).toBe(ENTRY_SLOW_MS);
    // Va antes de conectar: con el token listo y el servidor dormido, la barra dice que lo está despertando.
    expect(currentStage({ sesion: { doneAt: T0 }, despertar: { startedAt: T0 } })?.id).toBe("despertar");
  });

  it("lo que se muestra nunca vuelve atrás", () => {
    expect(nextShown(40, 30)).toBe(40);
    expect(nextShown(40, 55.4)).toBe(55);
    expect(nextShown(99, 140)).toBe(100);
    expect(nextShown(0, -5)).toBe(0);
  });

  it("cada etapa tiene nombre cálido y peso", () => {
    for (const s of ENTRY_STAGES) {
      expect(s.label.length).toBeGreaterThan(5);
      expect(s.weight).toBeGreaterThan(0);
    }
    expect(new Set(ENTRY_STAGES.map((s) => s.id)).size).toBe(ENTRY_STAGES.length);
  });
});

describe("consejos de la carga", () => {
  it("son cortos y no se repiten", () => {
    expect(ENTRY_TIPS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ENTRY_TIPS).size).toBe(ENTRY_TIPS.length);
    for (const t of ENTRY_TIPS) expect(t.length).toBeLessThanOrEqual(115);
  });

  it("el orden baraja todos una vez y es el mismo con la misma semilla", () => {
    for (const seed of [0, 1, 42, Date.UTC(2026, 8, 28)]) {
      const order = tipOrder(seed);
      expect([...order].sort((a, b) => a - b)).toEqual(ENTRY_TIPS.map((_, i) => i));
      expect(tipOrder(seed)).toEqual(order);
    }
    expect(tipOrder(1)).not.toEqual(tipOrder(2));
  });
});

describe("la escena de la carga", () => {
  it("usa el reloj del juego si llegó y si no la hora local", () => {
    expect(entryMood("otono", 22 * 60, 12 * 60).phase).toBe("noche");
    expect(entryMood("otono", null, 12 * 60).phase).toBe("dia");
    expect(entryMood("otono", null, 18 * 60).phase).toBe("atardecer");
    expect(entryMood("otono", null, 12 * 60).season).toBe("otono");
    expect(entryMood("invierno", null, 12 * 60).season).toBe("invierno");
  });

  it("el sol cruza de día y la luna de noche, de izquierda a derecha", () => {
    expect(skyArc(12 * 60)).toEqual({ kind: "sun", t: 0.5 });
    expect(skyArc(6 * 60).t).toBeLessThan(skyArc(16 * 60).t);
    expect(skyArc(23 * 60).kind).toBe("moon");
    expect(skyArc(20 * 60).t).toBeLessThan(skyArc(3 * 60).t);
    expect(skyArc(0).t).toBeGreaterThan(0);
    expect(skyArc(0).t).toBeLessThan(1);
  });
});
