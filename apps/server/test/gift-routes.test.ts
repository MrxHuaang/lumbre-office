// Las rutas de regalos de la web (/api/gifts y /api/gifts/[id]/open) contra la base de mentira: lo que
// hacen está en apps/web/src/lib/gift-service.ts, sin Next ni la sesión, justamente para probarlo aquí.
import { GIFT, type GiftSentNotice } from "@hyvento/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postGift, postOpenGift, type GiftDb, type GiftNotify } from "../../web/src/lib/gift-service";
import { FakeDb } from "./fake-db";

let db: FakeDb;
let base: GiftDb;
let notify: GiftNotify & { points: string[]; gifts: GiftSentNotice[] };

beforeEach(() => {
  db = new FakeDb();
  db.addUser("ana", 300, { name: "Ana" });
  db.addUser("beto", 50, { name: "Beto" });
  db.addUser("nuevo", 0, { name: "Nuevo", onboarded: false });
  base = { $transaction: db.transaction.bind(db), user: db.outside.user } as unknown as GiftDb;
  const points: string[] = [];
  const gifts: GiftSentNotice[] = [];
  notify = {
    points,
    gifts,
    pointsChanged: async (userId) => void points.push(userId),
    giftSent: async (notice) => void gifts.push(notice),
  };
});

const ana = { id: "ana", name: "Ana" };
const errorOf = (reply: { body: unknown }) => (reply.body as { error?: string }).error;

describe("POST /api/gifts", () => {
  it("manda el regalo, cobra y avisa al servidor de juego", async () => {
    const reply = await postGift(base, ana, { toId: "beto", points: 40, note: "¡gracias!" }, notify);
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ balance: 260, gift: { from: { id: "ana", name: "Ana" }, to: { id: "beto", name: "Beto" }, points: 40, note: "¡gracias!", openedAt: null } });
    expect(db.points("ana")).toBe(260);
    expect(notify.points).toEqual(["ana"]);
    expect(notify.gifts).toEqual([{ toId: "beto", fromName: "Ana", points: 40, itemId: null, quantity: 0 }]);
  });

  it("no a uno mismo, ni a quien no entró nunca, ni a quien no existe; y el pedido tiene que ser válido", async () => {
    expect(await postGift(base, ana, { toId: "ana", points: 10 }, notify)).toEqual({ status: 400, body: { error: "No puedes regalarte a ti." } });
    expect((await postGift(base, ana, { toId: "nuevo", points: 10 }, notify)).status).toBe(404);
    expect((await postGift(base, ana, { toId: "nadie", points: 10 }, notify)).status).toBe(404);
    expect((await postGift(base, ana, { toId: "beto" }, notify)).status).toBe(400);
    expect((await postGift(base, ana, null, notify)).status).toBe(400);
    expect((await postGift(base, ana, { toId: "beto", points: GIFT.maxPoints + 1 }, notify)).status).toBe(400);
    expect(db.t.gifts).toEqual([]);
    expect(db.points("ana")).toBe(300);
    expect(notify.gifts).toEqual([]);
  });

  it("cada motivo de la transacción sale con su código HTTP (y no queda nada)", async () => {
    const funds = await postGift(base, ana, { toId: "beto", points: 400 }, notify);
    expect(funds.status).toBe(402);
    const items = await postGift(base, ana, { toId: "beto", itemId: "plant", quantity: 1 }, notify);
    expect(items.status).toBe(409);
    expect(errorOf(items)).toMatch(/mochila/);

    db.addUser("rica", 5000, { name: "Rica" });
    const rica = { id: "rica", name: "Rica" };
    expect((await postGift(base, rica, { toId: "beto", points: GIFT.maxPoints }, notify)).status).toBe(200);
    expect((await postGift(base, rica, { toId: "beto", points: GIFT.maxPoints }, notify)).status).toBe(200);
    const limit = await postGift(base, rica, { toId: "beto", points: 1 }, notify);
    expect(limit.status).toBe(429);
    expect(errorOf(limit)).toMatch(String(GIFT.dailyPoints));

    db.give("rica", "plant", GIFT.dailyGifts);
    for (let i = 2; i < GIFT.dailyGifts; i++) expect((await postGift(base, rica, { toId: "beto", itemId: "plant", quantity: 1 }, notify)).status).toBe(200);
    const gifts = await postGift(base, rica, { toId: "beto", itemId: "plant", quantity: 1 }, notify);
    expect(gifts.status).toBe(429);
    expect(errorOf(gifts)).toMatch(String(GIFT.dailyGifts));
    expect(db.t.gifts.filter((g) => g.fromId === "rica")).toHaveLength(GIFT.dailyGifts);
  });

  it("dos regalos a la vez no se pasan del tope del día", async () => {
    db.addUser("rica", 5000, { name: "Rica" });
    const rica = { id: "rica", name: "Rica" };
    await postGift(base, rica, { toId: "beto", points: 400 }, notify);
    const replies = await Promise.all([
      postGift(base, rica, { toId: "beto", points: 400 }, notify),
      postGift(base, rica, { toId: "beto", points: 400 }, notify),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 429]);
    expect(db.points("rica")).toBe(4200);
  });

  it("si el aviso al servidor de juego falla, el regalo igual quedó y la respuesta es un éxito", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken: GiftNotify = {
      pointsChanged: () => Promise.reject(new Error("dormido")),
      giftSent: () => Promise.reject(new Error("dormido")),
    };
    const reply = await postGift(base, ana, { toId: "beto", points: 10 }, broken);
    expect(reply.status).toBe(200);
    expect(db.t.gifts).toHaveLength(1);
    expect(db.points("ana")).toBe(290);
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("un error que no es de las reglas sube (la ruta responde 500)", async () => {
    const failing = { ...base, $transaction: () => Promise.reject(new Error("se cayó la base")) } as GiftDb;
    await expect(postGift(failing, ana, { toId: "beto", points: 10 }, notify)).rejects.toThrow("se cayó la base");
  });
});

describe("POST /api/gifts/[id]/open", () => {
  async function sent(over: object = {}) {
    const reply = await postGift(base, ana, { toId: "beto", points: 30, ...over }, notify);
    expect(reply.status).toBe(200);
    notify.points.length = 0;
    return (reply.body as { gift: { id: string } }).gift.id;
  }

  it("quien lo recibe lo abre: suma los puntos y el objeto, y avisa", async () => {
    db.give("ana", "sofa", 1);
    const id = await sent({ itemId: "sofa", quantity: 1 });
    const reply = await postOpenGift(base, "beto", id, notify);
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ balance: 80, gift: { id, openedAt: expect.any(String) } });
    expect(db.held("beto", "sofa")).toBe(1);
    expect(notify.points).toEqual(["beto"]);
  });

  it("un regalo ajeno o que no existe es 404; abrirlo otra vez, 409", async () => {
    const id = await sent();
    expect((await postOpenGift(base, "ana", id, notify)).status).toBe(404);
    expect((await postOpenGift(base, "beto", "no-existe", notify)).status).toBe(404);
    expect((await postOpenGift(base, "beto", id, notify)).status).toBe(200);
    const again = await postOpenGift(base, "beto", id, notify);
    expect(again.status).toBe(409);
    expect(db.points("beto")).toBe(80);
  });

  it("dos clics a la vez: se abre una sola vez", async () => {
    const id = await sent();
    const replies = await Promise.all([postOpenGift(base, "beto", id, notify), postOpenGift(base, "beto", id, notify)]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(db.points("beto")).toBe(80);
    expect(db.t.moves.filter((m) => m.userId === "beto" && m.reason === "GIFT")).toHaveLength(1);
    expect(notify.points).toEqual(["beto"]);
  });

  it("un regalo solo de objetos también avisa (la cabaña relee la mochila de quien lo abre)", async () => {
    db.give("ana", "plant", 1);
    const id = await sent({ points: 0, itemId: "plant", quantity: 1 });
    notify.points.length = 0;
    expect((await postOpenGift(base, "beto", id, notify)).status).toBe(200);
    expect(notify.points).toEqual(["beto"]);
  });
});
