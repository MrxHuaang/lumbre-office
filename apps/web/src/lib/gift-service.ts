// Regalos (fase 5): lo que hacen las rutas /api/gifts y /api/gifts/[id]/open, sin Next ni la sesión, para
// poder probarlo con una base de mentira (apps/server/test/gift-routes.test.ts). Lo que mueve puntos y
// objetos está en `@hyvento/db` (sendGiftTx/openGiftTx); aquí se valida el pedido, se arma el DTO, se
// traducen los errores a HTTP y se avisa al servidor de juego. Solo lo usan las rutas (ver `gifts.ts`).
import { givenToday, openGiftTx as openGift, sendGiftTx as sendGift, SocialAborted, type Prisma, type SocialAbortCode } from "@hyvento/db";
import { GIFT, GiftCreateBody, type GiftDTO, type GiftSentNotice } from "@hyvento/shared";

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
  // Solo lo usan los intercambios; está para que la tabla cubra todos los motivos.
  "one-sided": ["Un intercambio lleva algo de los dos lados.", 409],
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

// ---------- Lo que hacen las rutas ----------

/** Lo que las rutas necesitan de Prisma (el cliente real, o la base de mentira en los tests). */
export interface GiftDb {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  user: { findFirst(args: { where: Prisma.UserWhereInput; select: { id: true } }): Promise<{ id: string } | null> };
}

/** Avisos al servidor de juego (en las rutas, los de `lib/events`). */
export interface GiftNotify {
  pointsChanged(userId: string): Promise<void>;
  giftSent(notice: GiftSentNotice): Promise<void>;
}

/** Respuesta de una ruta: el código HTTP y el cuerpo JSON. */
export interface GiftReply {
  status: number;
  body: { gift: GiftDTO; balance: number | null } | { error: string };
}

const failure = (error: string, status = 400): GiftReply => ({ status, body: { error } });

/**
 * Los avisos salen después de guardar: si fallan, el regalo ya quedó (espera en el buzón) y la respuesta
 * es igual un éxito. Si no, quien regala vería un error y lo mandaría de nuevo.
 */
async function afterCommit(what: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`No se pudo avisar del ${what}:`, err instanceof Error ? err.message : err);
  }
}

/**
 * POST /api/gifts: mandar un regalo (puntos y/o un objeto de la mochila, con nota) a alguien del equipo,
 * esté o no conectado. Se cobra en la misma transacción en que se crea; llega a su buzón sin abrir.
 */
export async function postGift(db: GiftDb, user: { id: string; name: string | null }, raw: unknown, notify: GiftNotify): Promise<GiftReply> {
  const parsed = GiftCreateBody.safeParse(raw ?? {});
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Regalo inválido");
  const body = parsed.data;
  if (body.toId === user.id) return failure("No puedes regalarte a ti.");
  // Solo a quien ya entró alguna vez (como la lista de /recipients).
  const to = await db.user.findFirst({ where: { id: body.toId, onboardedAt: { not: null } }, select: { id: true } });
  if (!to) return failure("Esa persona no está en el equipo.", 404);

  let result;
  try {
    // El tope del día se revisa dentro de la transacción (sendGiftTx), con la fila de quien regala bloqueada.
    result = await db.$transaction((tx) => sendGiftTx(tx, user.id, body));
  } catch (err) {
    if (err instanceof GiftFailed) return failure(err.message, err.status);
    throw err;
  }
  if (body.points > 0) await afterCommit("cambio de puntos", () => notify.pointsChanged(user.id));
  await afterCommit("regalo", () =>
    notify.giftSent({ toId: body.toId, fromName: user.name || "Alguien", points: body.points, itemId: body.itemId, quantity: body.quantity }),
  );
  return { status: 200, body: result };
}

/** POST /api/gifts/[id]/open: abrir un regalo del buzón (solo quien lo recibe y una sola vez). */
export async function postOpenGift(db: GiftDb, userId: string, giftId: string, notify: GiftNotify): Promise<GiftReply> {
  let result;
  try {
    result = await db.$transaction((tx) => openGiftTx(tx, userId, giftId));
  } catch (err) {
    if (err instanceof GiftFailed) return failure(err.message, err.status);
    throw err;
  }
  if (result.gift.points > 0) await afterCommit("cambio de puntos", () => notify.pointsChanged(userId));
  return { status: 200, body: result };
}
