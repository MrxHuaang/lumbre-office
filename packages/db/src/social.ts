// Regalos e intercambios (fase 5): lo que mueve puntos y objetos entre dos personas. Vive aquí (y no en la
// web o en el servidor de juego) para que el tope diario de "dar" sea uno solo y para poder probarlo.
import { dayStart, giftAllowedToday, giftRefId, stackUnits, tradeGap, type GivenToday, type ItemStack } from "@hyvento/shared";
import type { Prisma } from "@prisma/client";
import { addInventoryTx, takeInventoryTx } from "./inventory";
import { awardPointsTx, spendPointsTx } from "./points";

type Db = Prisma.TransactionClient;

/**
 * Por qué no se pudo (la transacción se deshace entera):
 * `funds`/`items`: no alcanzan los puntos o el objeto; `limit-gifts`/`limit-points`/`limit-items`: tope del día;
 * `missing`: el regalo o la persona no existen; `opened`: el regalo ya se abrió; `one-sided`: en un
 * intercambio, uno de los dos lados no pone nada (eso es un regalo, ver `tradeGap`).
 */
export type SocialAbortCode = "funds" | "items" | "limit-gifts" | "limit-points" | "limit-items" | "missing" | "opened" | "one-sided";

const LIMIT_CODE = { gifts: "limit-gifts", points: "limit-points", items: "limit-items" } as const;

export class SocialAborted extends Error {
  constructor(
    readonly code: SocialAbortCode,
    /** A quién le faltó (en un intercambio, para decir quién). */
    readonly userId?: string,
  ) {
    super(code);
  }
}

/**
 * Bloquea la fila de la persona hasta el final de la transacción (SELECT … FOR UPDATE, como el casino).
 * Así dos regalos o intercambios al mismo tiempo leen "lo que ya dio hoy" de a uno y no se pasan del tope.
 * Es una lectura: no toca `updatedAt`.
 */
export async function lockUser(tx: Db, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Lo que alguien ya dio hoy (día de Bogotá): cuántos regalos mandó, cuántos puntos salieron con motivo
 * GIFT y cuántas unidades de muebles (las de sus regalos y las de sus intercambios, en ItemTransfer).
 * Regalos e intercambios cuentan para los mismos topes.
 */
export async function givenToday(tx: Db, userId: string, now = Date.now()): Promise<GivenToday> {
  const since = new Date(dayStart(now));
  const [gifts, out, giftItems, traded] = await Promise.all([
    tx.gift.count({ where: { fromId: userId, createdAt: { gte: since } } }),
    tx.pointTransaction.aggregate({ where: { userId, reason: "GIFT", amount: { lt: 0 }, createdAt: { gte: since } }, _sum: { amount: true } }),
    tx.gift.aggregate({ where: { fromId: userId, createdAt: { gte: since } }, _sum: { quantity: true } }),
    tx.itemTransfer.aggregate({ where: { fromId: userId, createdAt: { gte: since } }, _sum: { quantity: true } }),
  ]);
  return { gifts, points: -(out._sum.amount ?? 0), items: (giftItems._sum.quantity ?? 0) + (traded._sum.quantity ?? 0) };
}

export interface SendGiftInput {
  toId: string;
  points: number;
  itemId: string | null;
  quantity: number;
  note: string;
  now?: number;
}

/**
 * Crea el regalo y cobra lo que lleva, en la transacción `tx`. Primero bloquea a quien regala y revisa el
 * tope del día; el Gift se crea antes de cobrar para que el movimiento lleve su id (`gift:<id>`).
 */
export async function sendGiftTx(tx: Db, fromId: string, input: SendGiftInput): Promise<{ giftId: string; balance: number | null }> {
  const now = input.now ?? Date.now();
  if (!(await lockUser(tx, fromId))) throw new SocialAborted("missing", fromId);
  const allowed = giftAllowedToday(await givenToday(tx, fromId, now), input.points, input.itemId ? input.quantity : 0);
  if (allowed !== "ok") throw new SocialAborted(LIMIT_CODE[allowed], fromId);
  const gift = await tx.gift.create({
    data: {
      fromId,
      toId: input.toId,
      points: input.points,
      itemId: input.itemId,
      quantity: input.itemId ? input.quantity : 0,
      note: input.note,
      createdAt: new Date(now),
    },
    select: { id: true },
  });
  let balance: number | null = null;
  if (input.points > 0) {
    const spent = await spendPointsTx(tx, { userId: fromId, amount: input.points, reason: "GIFT", refId: giftRefId(gift.id), now });
    if (!spent.ok) throw new SocialAborted("funds", fromId);
    balance = spent.balance;
  }
  if (input.itemId && !(await takeInventoryTx(tx, fromId, input.itemId, input.quantity))) throw new SocialAborted("items", fromId);
  return { giftId: gift.id, balance };
}

/**
 * Abre un regalo: solo quien lo recibe y una sola vez (update condicional sobre `openedAt`: dos clics a la
 * vez no lo cobran dos veces). Suma los puntos (GIFT no tiene tope) y el objeto a la mochila.
 */
export async function openGiftTx(tx: Db, userId: string, giftId: string, now = Date.now()): Promise<{ balance: number | null }> {
  const opened = await tx.gift.updateMany({ where: { id: giftId, toId: userId, openedAt: null }, data: { openedAt: new Date(now) } });
  if (opened.count === 0) {
    const exists = await tx.gift.findFirst({ where: { id: giftId, toId: userId }, select: { id: true } });
    throw new SocialAborted(exists ? "opened" : "missing", userId);
  }
  const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId }, select: { id: true, points: true, itemId: true, quantity: true } });
  let balance: number | null = null;
  if (gift.points > 0) balance = (await awardPointsTx(tx, { userId, amount: gift.points, reason: "GIFT", refId: giftRefId(gift.id), now })).balance;
  if (gift.itemId && gift.quantity > 0) await addInventoryTx(tx, userId, gift.itemId, gift.quantity);
  return { balance };
}

/** Un lado de un intercambio: lo que da esa persona (a la otra). */
export interface TradeSide {
  userId: string;
  points: number;
  items: ItemStack[];
}

/**
 * Un intercambio en la transacción `tx`: primero pagan los dos (en orden de id, para que dos intercambios
 * cruzados no se traben) y después reciben. Los puntos y los muebles que se dan cuentan para los topes
 * diarios de dar (los mismos de los regalos); los muebles quedan anotados en ItemTransfer. Los dos lados
 * tienen que poner algo (`tradeGap`). Si algo no alcanza, lanza
 * `SocialAborted` y no queda nada movido.
 */
export async function executeTradeTx(tx: Db, input: { refId: string; a: TradeSide; b: TradeSide; now?: number }): Promise<{ balances: Record<string, number> }> {
  const { refId, a, b } = input;
  const now = input.now ?? Date.now();
  // El que no pone nada (o el primero, si ninguno pone).
  if (tradeGap(a, b) !== "ok") throw new SocialAborted("one-sided", (a.points > 0 || a.items.length > 0 ? b : a).userId);
  const sides = [
    { from: a, to: b },
    { from: b, to: a },
  ].sort((x, y) => x.from.userId.localeCompare(y.from.userId));
  for (const { from } of sides) {
    if (!(await lockUser(tx, from.userId))) throw new SocialAborted("missing", from.userId);
    const units = stackUnits(from.items);
    if (from.points > 0 || units > 0) {
      const allowed = giftAllowedToday({ ...(await givenToday(tx, from.userId, now)), gifts: 0 }, from.points, units);
      if (allowed !== "ok") throw new SocialAborted(LIMIT_CODE[allowed], from.userId);
    }
    if (from.points > 0) {
      const spent = await spendPointsTx(tx, { userId: from.userId, amount: from.points, reason: "GIFT", refId, now });
      if (!spent.ok) throw new SocialAborted("funds", from.userId);
    }
    for (const it of from.items) {
      if (!(await takeInventoryTx(tx, from.userId, it.itemId, it.quantity))) throw new SocialAborted("items", from.userId);
    }
  }
  for (const { from, to } of sides) {
    if (from.points > 0) await awardPointsTx(tx, { userId: to.userId, amount: from.points, reason: "GIFT", refId, now });
    for (const it of from.items) await addInventoryTx(tx, to.userId, it.itemId, it.quantity);
    if (from.items.length > 0)
      await tx.itemTransfer.createMany({
        data: from.items.map((it) => ({ fromId: from.userId, toId: to.userId, itemId: it.itemId, quantity: it.quantity, refId, createdAt: new Date(now) })),
      });
  }
  const users = await tx.user.findMany({ where: { id: { in: [a.userId, b.userId] } }, select: { id: true, points: true } });
  return { balances: Object.fromEntries(users.map((u) => [u.id, u.points])) };
}
