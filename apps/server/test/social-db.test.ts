// Regalos e intercambios contra la base (los helpers de `@hyvento/db` que usan la web y el repositorio de
// Prisma del servidor), con una base de mentira que deshace la transacción si algo lanza.
import { executeTradeTx, givenToday, openGiftTx, sendGiftTx, SocialAborted, type SocialAbortCode } from "@hyvento/db";
import { GIFT } from "@hyvento/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { executeTrade, tradeAbortResult } from "../src/repo/social";
import { FakeDb } from "./fake-db";

let db: FakeDb;
beforeEach(() => {
  db = new FakeDb();
  db.addUser("ana", 300);
  db.addUser("beto", 50);
});

const gift = (over: Partial<Parameters<typeof sendGiftTx>[2]> = {}) => ({ toId: "beto", points: 0, itemId: null, quantity: 0, note: "", ...over });

/** Espera que la promesa falle con ese motivo. */
async function aborted(p: Promise<unknown>, code: SocialAbortCode) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(SocialAborted);
  expect((err as SocialAborted).code).toBe(code);
}

describe("regalos en la base", () => {
  it("mandar cobra los puntos y el objeto en la misma transacción, con el id del regalo", async () => {
    db.give("ana", "plant", 2);
    const { giftId, balance } = await db.transaction((tx) => sendGiftTx(tx, "ana", gift({ points: 40, itemId: "plant", quantity: 1, note: "¡gracias!" })));
    expect(balance).toBe(260);
    expect(db.points("ana")).toBe(260);
    expect(db.held("ana", "plant")).toBe(1);
    expect(db.t.gifts).toHaveLength(1);
    expect(db.t.gifts[0]).toMatchObject({ id: giftId, fromId: "ana", toId: "beto", points: 40, itemId: "plant", quantity: 1, openedAt: null });
    expect(db.t.moves.at(-1)).toMatchObject({ userId: "ana", amount: -40, reason: "GIFT", refId: `gift:${giftId}` });
    // Beto no recibe nada hasta abrirlo.
    expect(db.points("beto")).toBe(50);
  });

  it("sin saldo o sin el objeto no queda nada (ni el regalo ni el cobro)", async () => {
    await aborted(db.transaction((tx) => sendGiftTx(tx, "ana", gift({ points: 500 }))), "funds");
    db.give("ana", "plant", 1);
    await aborted(db.transaction((tx) => sendGiftTx(tx, "ana", gift({ points: 20, itemId: "plant", quantity: 3 }))), "items");
    expect(db.t.gifts).toEqual([]);
    expect(db.points("ana")).toBe(300);
    expect(db.held("ana", "plant")).toBe(1);
  });

  it("el tope del día se revisa dentro de la transacción: dos a la vez no lo pasan", async () => {
    db.addUser("rica", 5000);
    const results = await Promise.allSettled([
      db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 600 }))),
      db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 600 }))),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as SocialAborted).code).toBe("limit-points");
    expect(db.points("rica")).toBe(4400);
    // Se cruzaron de verdad: la segunda esperó el bloqueo de la fila de Rica.
    expect(db.waits).toBeGreaterThan(0);
  });

  it("tope de regalos por día (aunque sean solo objetos)", async () => {
    db.give("ana", "plant", GIFT.dailyGifts + 1);
    for (let i = 0; i < GIFT.dailyGifts; i++) await db.transaction((tx) => sendGiftTx(tx, "ana", gift({ itemId: "plant", quantity: 1 })));
    await aborted(db.transaction((tx) => sendGiftTx(tx, "ana", gift({ itemId: "plant", quantity: 1 }))), "limit-gifts");
    expect(db.held("ana", "plant")).toBe(1);
  });

  it("los puntos dados en intercambios cuentan para el tope de los regalos", async () => {
    db.addUser("rica", 5000);
    db.give("beto", "plant", 1);
    await db.transaction((tx) =>
      executeTradeTx(tx, { refId: "trade:1", a: { userId: "rica", points: 900, items: [] }, b: { userId: "beto", points: 0, items: [{ itemId: "plant", quantity: 1 }] } }),
    );
    expect(await givenToday(db.outside, "rica")).toEqual({ gifts: 0, points: 900 });
    await aborted(db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 200 }))), "limit-points");
    await db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 100 })));
    expect(db.points("rica")).toBe(4000);
  });

  it("abrir: solo quien lo recibe y una sola vez, aunque sean dos clics a la vez", async () => {
    db.give("ana", "sofa", 1);
    const { giftId } = await db.transaction((tx) => sendGiftTx(tx, "ana", gift({ points: 30, itemId: "sofa", quantity: 1 })));
    // Alguien que no es el destinatario: para esa persona el regalo no existe.
    await aborted(db.transaction((tx) => openGiftTx(tx, "ana", giftId)), "missing");
    await aborted(db.transaction((tx) => openGiftTx(tx, "beto", "no-existe")), "missing");

    const results = await Promise.allSettled([db.transaction((tx) => openGiftTx(tx, "beto", giftId)), db.transaction((tx) => openGiftTx(tx, "beto", giftId))]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as SocialAborted).code).toBe("opened");
    expect(db.waits).toBeGreaterThan(0);
    expect(db.points("beto")).toBe(80);
    expect(db.held("beto", "sofa")).toBe(1);
    expect(db.t.gifts[0]!.openedAt).toBeInstanceOf(Date);
    const moves = db.t.moves.filter((m) => m.refId === `gift:${giftId}`);
    expect(moves.map((m) => m.amount).sort((x, y) => x - y)).toEqual([-30, 30]);
  });
});

describe("intercambios en la base", () => {
  it("cada lado paga y recibe, con el mismo refId y motivo GIFT", async () => {
    db.give("ana", "plant", 2);
    db.give("beto", "piano", 1);
    const { balances } = await db.transaction((tx) =>
      executeTradeTx(tx, {
        refId: "trade:t1",
        a: { userId: "beto", points: 20, items: [{ itemId: "piano", quantity: 1 }] },
        b: { userId: "ana", points: 100, items: [{ itemId: "plant", quantity: 2 }] },
      }),
    );
    expect(balances).toEqual({ ana: 220, beto: 130 });
    expect([db.held("ana", "piano"), db.held("ana", "plant"), db.held("beto", "piano"), db.held("beto", "plant")]).toEqual([1, 0, 0, 2]);
    const moves = db.t.moves.filter((m) => m.refId === "trade:t1");
    expect(moves.every((m) => m.reason === "GIFT")).toBe(true);
    expect(moves.map((m) => m.amount).sort((x, y) => x - y)).toEqual([-100, -20, 20, 100]);
  });

  it("si a uno le falta algo, no se mueve nada (tampoco lo del otro)", async () => {
    db.give("ana", "plant", 1);
    // Beto no tiene los 80 puntos: lo de Ana (que paga primero, por orden de id) se deshace.
    await aborted(
      db.transaction((tx) => executeTradeTx(tx, { refId: "trade:t2", a: { userId: "ana", points: 10, items: [{ itemId: "plant", quantity: 1 }] }, b: { userId: "beto", points: 80, items: [] } })),
      "funds",
    );
    await aborted(
      db.transaction((tx) => executeTradeTx(tx, { refId: "trade:t3", a: { userId: "ana", points: 10, items: [] }, b: { userId: "beto", points: 0, items: [{ itemId: "sofa", quantity: 1 }] } })),
      "items",
    );
    expect(db.points("ana")).toBe(300);
    expect(db.points("beto")).toBe(50);
    expect(db.held("ana", "plant")).toBe(1);
    expect(db.held("beto", "plant")).toBe(0);
    expect(db.t.moves.filter((m) => m.reason === "GIFT")).toEqual([]);
  });

  it("respeta el tope diario de dar puntos", async () => {
    db.addUser("rica", 5000);
    db.give("beto", "plant", 2);
    await db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: GIFT.dailyPoints - 50 })));
    const err = await db
      .transaction((tx) => executeTradeTx(tx, { refId: "trade:t4", a: { userId: "rica", points: 60, items: [] }, b: { userId: "beto", points: 0, items: [{ itemId: "plant", quantity: 1 }] } }))
      .catch((e: SocialAborted) => e);
    expect(err).toMatchObject({ code: "limit-points", userId: "rica" });
    await db.transaction((tx) => executeTradeTx(tx, { refId: "trade:t5", a: { userId: "rica", points: 50, items: [] }, b: { userId: "beto", points: 0, items: [{ itemId: "plant", quantity: 1 }] } }));
    expect(db.points("beto")).toBe(100);
  });
});

describe("intercambios en la base: reglas y concurrencia", () => {
  it("un intercambio de un solo lado no se hace (eso es un regalo, con sus topes)", async () => {
    db.give("ana", "sofa", 10);
    const err = await db
      .transaction((tx) => executeTradeTx(tx, { refId: "trade:s1", a: { userId: "ana", points: 200, items: [{ itemId: "sofa", quantity: 10 }] }, b: { userId: "beto", points: 0, items: [] } }))
      .catch((e: SocialAborted) => e);
    expect(err).toMatchObject({ code: "one-sided", userId: "beto" });
    expect(db.points("ana")).toBe(300);
    expect(db.held("ana", "sofa")).toBe(10);
    expect(db.held("beto", "sofa")).toBe(0);
  });

  it("dos intercambios cruzados a la vez no se traban (bloquean en orden de id) y los saldos cuadran", async () => {
    db.give("ana", "plant", 2);
    db.give("beto", "piano", 2);
    const t = (refId: string, first: "ana" | "beto") => {
      const ana = { userId: "ana", points: 10, items: [{ itemId: "plant", quantity: 1 }] };
      const beto = { userId: "beto", points: 5, items: [{ itemId: "piano", quantity: 1 }] };
      return db.transaction((tx) => executeTradeTx(tx, first === "ana" ? { refId, a: ana, b: beto } : { refId, a: beto, b: ana }));
    };
    const [one, two] = await Promise.all([t("trade:c1", "ana"), t("trade:c2", "beto")]);
    expect(db.waits).toBeGreaterThan(0);
    expect(one.balances).toEqual({ ana: 295, beto: 55 });
    expect(two.balances).toEqual({ ana: 290, beto: 60 });
    expect([db.held("ana", "piano"), db.held("beto", "plant")]).toEqual([2, 2]);
    // Cada intercambio dejó sus cuatro movimientos, y el libro cuadra con el saldo.
    for (const refId of ["trade:c1", "trade:c2"]) expect(db.t.moves.filter((m) => m.refId === refId)).toHaveLength(4);
    for (const id of ["ana", "beto"]) expect(db.t.moves.filter((m) => m.userId === id).reduce((sum, m) => sum + m.amount, 0)).toBe(db.points(id));
  });

  it("paga primero quien tiene el id menor: si a ese le falta, no se cobra a nadie", async () => {
    // Ana (id menor) no tiene el objeto: ni siquiera se llega a cobrarle a Beto.
    const err = await db
      .transaction((tx) => executeTradeTx(tx, { refId: "trade:o1", a: { userId: "beto", points: 20, items: [] }, b: { userId: "ana", points: 0, items: [{ itemId: "sofa", quantity: 1 }] } }))
      .catch((e: SocialAborted) => e);
    expect(err).toMatchObject({ code: "items", userId: "ana" });
    expect(db.t.moves.filter((m) => m.refId === "trade:o1")).toEqual([]);
    expect(db.points("beto")).toBe(50);
  });
});

describe("repositorio de Prisma: intercambios", () => {
  const side = (userId: string, points: number, items: { itemId: string; quantity: number }[] = []) => ({ userId, points, items });

  it("devuelve los saldos nuevos de los dos", async () => {
    db.give("beto", "piano", 1);
    const result = await executeTrade(db, { refId: "trade:r1", a: side("ana", 100), b: side("beto", 0, [{ itemId: "piano", quantity: 1 }]) });
    expect(result).toEqual({ ok: true, balances: { ana: 200, beto: 150 } });
  });

  it("traduce el corte de la transacción al error que muestra la sala", async () => {
    db.give("beto", "piano", 1);
    expect(await executeTrade(db, { refId: "trade:r2", a: side("ana", 400), b: side("beto", 0, [{ itemId: "piano", quantity: 1 }]) })).toEqual({
      ok: false,
      error: "funds",
      userId: "ana",
    });
    expect(await executeTrade(db, { refId: "trade:r3", a: side("ana", 10), b: side("beto", 0, [{ itemId: "sofa", quantity: 1 }]) })).toEqual({
      ok: false,
      error: "items",
      userId: "beto",
    });
    expect(await executeTrade(db, { refId: "trade:r4", a: side("ana", 10), b: side("beto", 0) })).toEqual({ ok: false, error: "one-sided", userId: "beto" });
    db.addUser("rica", 5000);
    await db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 500 })));
    await db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: 450 })));
    expect(await executeTrade(db, { refId: "trade:r5", a: side("rica", 60), b: side("beto", 0, [{ itemId: "piano", quantity: 1 }]) })).toEqual({
      ok: false,
      error: "limit",
      userId: "rica",
    });
    // Nada de eso movió puntos ni objetos.
    expect(db.t.moves.filter((m) => m.refId?.startsWith("trade:"))).toEqual([]);
    expect(db.held("beto", "piano")).toBe(1);
  });

  it("lo que la persona no puede arreglar (alguien que no existe, un error de la base) sube como error", async () => {
    db.give("beto", "piano", 1);
    await expect(executeTrade(db, { refId: "trade:r6", a: side("nadie", 10), b: side("beto", 0, [{ itemId: "piano", quantity: 1 }]) })).rejects.toMatchObject({
      code: "missing",
    });
    expect(tradeAbortResult(new SocialAborted("missing", "x"))).toBeNull();
    expect(tradeAbortResult(new SocialAborted("opened", "x"))).toBeNull();
    expect(tradeAbortResult(new Error("se cayó la base"))).toBeNull();
    expect(tradeAbortResult(new SocialAborted("limit-points", "x"))).toEqual({ ok: false, error: "limit", userId: "x" });
  });
});
