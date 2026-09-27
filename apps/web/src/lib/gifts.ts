import "server-only";
// Regalos (fase 5): mandar puntos y/o un objeto de la mochila con una nota, y abrirlos en el buzón. Todo
// en una transacción: lo que sale se cobra con spendPointsTx/takeInventoryTx y lo que llega se suma con
// awardPointsTx/addInventoryTx (motivo GIFT).
import { addInventoryTx, awardPointsTx, spendPointsTx, takeInventoryTx, type Prisma } from "@hyvento/db";
import { dayStart, giftRefId, type GiftCreateBody, type GiftDTO } from "@hyvento/shared";

/** No se pudo (se deshace todo): el mensaje va tal cual a quien regala o abre. */
export class GiftFailed extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const GIFT_INCLUDE = {
  from: { select: { id: true, name: true } },
  to: { select: { id: true, name: true } },
} satisfies Prisma.GiftInclude;

type GiftRow = Prisma.GiftGetPayload<{ include: typeof GIFT_INCLUDE }>;

export function toGiftDTO(g: GiftRow): GiftDTO {
  return {
    id: g.id,
    from: { id: g.from.id, name: g.from.name || "Alguien" },
    to: { id: g.to.id, name: g.to.name || "Alguien" },
    points: g.points,
    itemId: g.itemId,
    quantity: g.quantity,
    note: g.note,
    createdAt: g.createdAt.toISOString(),
    openedAt: g.openedAt?.toISOString() ?? null,
  };
}

/** Lo que alguien ya regaló hoy (día de Bogotá): cuántos regalos y cuántos puntos. */
export async function sentToday(tx: Prisma.TransactionClient, userId: string, now = Date.now()) {
  const agg = await tx.gift.aggregate({
    where: { fromId: userId, createdAt: { gte: new Date(dayStart(now)) } },
    _count: { _all: true },
    _sum: { points: true },
  });
  return { gifts: agg._count._all, points: agg._sum.points ?? 0 };
}

/**
 * Crea el regalo y cobra lo que lleva. El Gift se crea primero para que el movimiento de puntos lleve su
 * id (`gift:<id>`); si no alcanza el saldo o falta el objeto, se lanza y la transacción no deja nada.
 */
export async function sendGiftTx(tx: Prisma.TransactionClient, fromId: string, body: GiftCreateBody): Promise<{ gift: GiftDTO; balance: number | null }> {
  const gift = await tx.gift.create({
    data: { fromId, toId: body.toId, points: body.points, itemId: body.itemId, quantity: body.itemId ? body.quantity : 0, note: body.note },
    include: GIFT_INCLUDE,
  });
  let balance: number | null = null;
  if (body.points > 0) {
    const spent = await spendPointsTx(tx, { userId: fromId, amount: body.points, reason: "GIFT", refId: giftRefId(gift.id) });
    if (!spent.ok) throw new GiftFailed("No te alcanzan los puntos.", 402);
    balance = spent.balance;
  }
  if (body.itemId && !(await takeInventoryTx(tx, fromId, body.itemId, body.quantity))) {
    throw new GiftFailed("Ese objeto ya no está en tu mochila (o no tienes tantos).", 409);
  }
  return { gift: toGiftDTO(gift), balance };
}

/**
 * Abre un regalo: solo quien lo recibe y una sola vez (update condicional sobre `openedAt`, así dos
 * clics no lo cobran dos veces). Suma los puntos (sin tope) y el objeto a la mochila.
 */
export async function openGiftTx(tx: Prisma.TransactionClient, userId: string, giftId: string): Promise<{ gift: GiftDTO; balance: number | null }> {
  const now = new Date();
  const opened = await tx.gift.updateMany({ where: { id: giftId, toId: userId, openedAt: null }, data: { openedAt: now } });
  if (opened.count === 0) {
    const exists = await tx.gift.findFirst({ where: { id: giftId, toId: userId }, select: { id: true } });
    throw exists ? new GiftFailed("Ese regalo ya lo abriste.", 409) : new GiftFailed("Ese regalo no existe.", 404);
  }
  const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId }, include: GIFT_INCLUDE });
  let balance: number | null = null;
  if (gift.points > 0) balance = (await awardPointsTx(tx, { userId, amount: gift.points, reason: "GIFT", refId: giftRefId(gift.id) })).balance;
  if (gift.itemId && gift.quantity > 0) await addInventoryTx(tx, userId, gift.itemId, gift.quantity);
  return { gift: toGiftDTO(gift), balance };
}
