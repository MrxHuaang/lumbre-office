// Capítulo 2 de la historia en la sala (ver rooms/capitulo2.ts): cada paso solo cuenta con ese paso abierto,
// las piezas van a la mochila y el reloj se arregla con las tres.
import { HISTORIA_MSG, HISTORIA_RELOJ, PENDULO_PRECIO, PIEZAS_RELOJ, RELOJ_CINE, RELOJ_PASOS, objItemId } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { Capitulo2 } from "../src/rooms/capitulo2";

function setup(open: string | null, opts: { full?: boolean; points?: number } = {}) {
  const bag = new Map<string, number>();
  const stats = new Map<string, number>();
  const sent: { type: string; msg: { id?: string; text?: string; vars?: Record<string, unknown> } }[] = [];
  let points = opts.points ?? 100;
  const steps = new Map<string, "open" | "done">();
  if (open) steps.set(open, "open");
  const cap = new Capitulo2({
    step: (_u, q) => steps.get(q) ?? null,
    bump: (_u, k) => stats.set(k, (stats.get(k) ?? 0) + 1),
    bag: {
      count: (_u, id) => bag.get(id) ?? 0,
      fits: () => (opts.full ? "full" : "ok"),
      add: async (_u, id, n = 1) => (bag.set(id, (bag.get(id) ?? 0) + n), "ok"),
      take: async (_u, id, n = 1) => {
        if ((bag.get(id) ?? 0) < n) return false;
        bag.set(id, bag.get(id)! - n);
        return true;
      },
    },
    spend: async (_u, amount) => {
      if (points < amount) return { ok: false, balance: points };
      points -= amount;
      return { ok: true, balance: points };
    },
    send: (_s, type, msg) => sent.push({ type, msg: msg as never }),
  });
  return { cap, bag, stats, sent, steps, points: () => points };
}

describe("capítulo 2: el reloj de pie", () => {
  it("mirar el reloj del recibidor cuenta solo con el paso abierto y muestra la escena", async () => {
    const { cap, stats, sent } = setup(RELOJ_PASOS.mirar);
    await cap.clock("s", "u", "piso-2");
    expect(stats.get(HISTORIA_RELOJ.mirado)).toBeUndefined();
    expect(sent.at(-1)?.type).toBe(HISTORIA_MSG.aviso);
    await cap.clock("s", "u", "planta-baja");
    expect(stats.get(HISTORIA_RELOJ.mirado)).toBe(1);
    expect(sent.at(-1)).toEqual({ type: HISTORIA_MSG.cine, msg: { id: RELOJ_CINE.callado } });
  });

  it("sin el paso, el reloj solo dice que está parado", async () => {
    const { cap, stats, sent } = setup(null);
    await cap.clock("s", "u", "planta-baja");
    expect(stats.size).toBe(0);
    expect(sent.at(-1)?.msg.text).toContain("parado");
  });

  it("el molino da el engranaje con su paso abierto (una vez), y nada sin él", async () => {
    const off = setup(RELOJ_PASOS.mirar);
    await off.cap.flour("s", "u");
    expect(off.bag.size).toBe(0);
    const { cap, bag, stats, sent } = setup(RELOJ_PASOS.engranaje);
    await cap.flour("s", "u");
    expect(bag.get(objItemId(PIEZAS_RELOJ.engranaje))).toBe(1);
    expect(stats.get(HISTORIA_RELOJ.engranaje)).toBe(1);
    expect(sent.at(-1)?.msg.id).toBe(RELOJ_CINE.pieza);
    await cap.flour("s", "u");
    expect(bag.get(objItemId(PIEZAS_RELOJ.engranaje))).toBe(1);
  });

  it("el banco del taller (solo en el garaje) templa el resorte", async () => {
    const { cap, bag } = setup(RELOJ_PASOS.resorte);
    await cap.furniture("s", "u", "garaje", "chair");
    await cap.furniture("s", "u", "jardin", "workbench");
    expect(bag.size).toBe(0);
    await cap.furniture("s", "u", "garaje", "workbench");
    expect(bag.get(objItemId(PIEZAS_RELOJ.resorte))).toBe(1);
  });

  it("si la pieza no cabe en la mochila, avisa y no cuenta", async () => {
    const { cap, bag, stats, sent } = setup(RELOJ_PASOS.resorte, { full: true });
    await cap.furniture("s", "u", "garaje", "workbench");
    expect(bag.size).toBe(0);
    expect(stats.size).toBe(0);
    expect(sent.at(-1)?.msg.text).toContain("mochila");
  });

  it("el Man del Sombrero vende el péndulo solo a quien lo busca, y lo cobra", async () => {
    const no = setup(RELOJ_PASOS.resorte);
    expect((await no.cap.buyPendulum("s", "u")).result).toBe("notNow");
    const poor = setup(RELOJ_PASOS.pendulo, { points: PENDULO_PRECIO - 1 });
    expect((await poor.cap.buyPendulum("s", "u")).result).toBe("funds");
    const { cap, bag, stats, points } = setup(RELOJ_PASOS.pendulo);
    expect(await cap.buyPendulum("s", "u")).toEqual({ result: "ok", balance: 100 - PENDULO_PRECIO });
    expect(points()).toBe(100 - PENDULO_PRECIO);
    expect(bag.get(objItemId(PIEZAS_RELOJ.pendulo))).toBe(1);
    expect(stats.get(HISTORIA_RELOJ.pendulo)).toBe(1);
    expect((await cap.buyPendulum("s", "u")).result).toBe("have");
    expect(points()).toBe(100 - PENDULO_PRECIO);
  });

  it("con las tres piezas el reloj se arregla (se las lleva) y dan las campanadas; si falta una, avisa", async () => {
    const { cap, bag, stats, sent, steps } = setup(RELOJ_PASOS.arreglar);
    bag.set(objItemId(PIEZAS_RELOJ.engranaje), 1);
    bag.set(objItemId(PIEZAS_RELOJ.resorte), 1);
    await cap.clock("s", "u", "planta-baja");
    expect(sent.at(-1)?.msg.text).toContain("falta");
    expect(stats.get(HISTORIA_RELOJ.arreglado)).toBeUndefined();
    bag.set(objItemId(PIEZAS_RELOJ.pendulo), 1);
    await cap.clock("s", "u", "planta-baja");
    expect(stats.get(HISTORIA_RELOJ.arreglado)).toBe(1);
    expect(sent.at(-1)).toEqual({ type: HISTORIA_MSG.cine, msg: { id: RELOJ_CINE.campanadas } });
    for (const p of Object.values(PIEZAS_RELOJ)) expect(bag.get(objItemId(p))).toBe(0);
    steps.set(RELOJ_PASOS.arreglar, "done");
    await cap.clock("s", "u", "planta-baja");
    expect(sent.at(-1)?.msg.text).toContain("anda como nuevo");
  });
});
