import "server-only";
// Regalos (fase 5): mandar puntos y/o un objeto de la mochila con una nota, y abrirlos en el buzón. Lo que
// mueve puntos y objetos está en `@hyvento/db` (sendGiftTx/openGiftTx, con sus tests); aquí se arma el DTO
// y se traducen los errores.
import { givenToday, openGiftTx as openGift, sendGiftTx as sendGift, SocialAborted, type Prisma, type SocialAbortCode } from "@hyvento/db";
import { GIFT, type GiftCreateBody, type GiftDTO } from "@hyvento/shared";

export { givenToday };

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

/** Mensaje y código HTTP para cada motivo por el que no se pudo mandar o abrir un regalo. */
const ABORT_TEXT: Record<SocialAbortCode, [string, number]> = {
  funds: ["No te alcanzan los puntos.", 402],
  items: ["Ese objeto ya no está en tu mochila (o no tienes tantos).", 409],
  "limit-gifts": [`Ya mandaste ${GIFT.dailyGifts} regalos hoy. Mañana puedes seguir.`, 429],
  "limit-points": [`Hoy puedes dar hasta ${GIFT.dailyPoints} puntos en total (entre regalos e intercambios).`, 429],
  missing: ["Ese regalo no existe.", 404],
  opened: ["Ese regalo ya lo abriste.", 409],
};

/** Convierte el corte de la transacción (de `@hyvento/db`) en el error que ve la persona. */
function asGiftFailed(err: unknown): unknown {
  if (!(err instanceof SocialAborted)) return err;
  const [message, status] = ABORT_TEXT[err.code];
  return new GiftFailed(message, status);
}

/**
 * Crea el regalo y cobra lo que lleva (con el tope del día revisado dentro de la transacción, con la fila
 * de quien regala bloqueada). Si no alcanza o falta el objeto, no queda nada.
 */
export async function sendGiftTx(tx: Prisma.TransactionClient, fromId: string, body: GiftCreateBody): Promise<{ gift: GiftDTO; balance: number | null }> {
  try {
    const { giftId, balance } = await sendGift(tx, fromId, body);
    const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId }, include: GIFT_INCLUDE });
    return { gift: toGiftDTO(gift), balance };
  } catch (err) {
    throw asGiftFailed(err);
  }
}

/** Abre un regalo: solo quien lo recibe y una sola vez. Suma los puntos y el objeto a la mochila. */
export async function openGiftTx(tx: Prisma.TransactionClient, userId: string, giftId: string): Promise<{ gift: GiftDTO; balance: number | null }> {
  try {
    const { balance } = await openGift(tx, userId, giftId);
    const gift = await tx.gift.findUniqueOrThrow({ where: { id: giftId }, include: GIFT_INCLUDE });
    return { gift: toGiftDTO(gift), balance };
  } catch (err) {
    throw asGiftFailed(err);
  }
}
