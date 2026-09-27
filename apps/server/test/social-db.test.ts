// Regalos e intercambios contra la base (los helpers de `@hyvento/db` que usan la web y el repositorio de
// Prisma del servidor), con una base de mentira que deshace la transacción si algo lanza.
import { executeTradeTx, givenToday, openGiftTx, sendGiftTx, SocialAborted, type SocialAbortCode } from "@hyvento/db";
import { GIFT } from "@hyvento/shared";
import { beforeEach, describe, expect, it } from "vitest";
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
  });

  it("tope de regalos por día (aunque sean solo objetos)", async () => {
    db.give("ana", "plant", GIFT.dailyGifts + 1);
    for (let i = 0; i < GIFT.dailyGifts; i++) await db.transaction((tx) => sendGiftTx(tx, "ana", gift({ itemId: "plant", quantity: 1 })));
    await aborted(db.transaction((tx) => sendGiftTx(tx, "ana", gift({ itemId: "plant", quantity: 1 }))), "limit-gifts");
    expect(db.held("ana", "plant")).toBe(1);
  });

  it("los puntos dados en intercambios cuentan para el tope de los regalos", async () => {
    db.addUser("rica", 5000);
    await db.transaction((tx) => executeTradeTx(tx, { refId: "trade:1", a: { userId: "rica", points: 900, items: [] }, b: { userId: "beto", points: 0, items: [] } }));
    expect(await givenToday(db["client"](), "rica")).toEqual({ gifts: 0, points: 900 });
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
      db.transaction((tx) => executeTradeTx(tx, { refId: "trade:t3", a: { userId: "ana", points: 0, items: [] }, b: { userId: "beto", points: 0, items: [{ itemId: "sofa", quantity: 1 }] } })),
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
    await db.transaction((tx) => sendGiftTx(tx, "rica", gift({ points: GIFT.dailyPoints - 50 })));
    const err = await db
      .transaction((tx) => executeTradeTx(tx, { refId: "trade:t4", a: { userId: "rica", points: 60, items: [] }, b: { userId: "beto", points: 0, items: [] } }))
      .catch((e: SocialAborted) => e);
    expect(err).toMatchObject({ code: "limit-points", userId: "rica" });
    await db.transaction((tx) => executeTradeTx(tx, { refId: "trade:t5", a: { userId: "rica", points: 50, items: [] }, b: { userId: "beto", points: 0, items: [] } }));
    expect(db.points("beto")).toBe(100);
  });
});
