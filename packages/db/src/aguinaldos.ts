// Los aguinaldos de las novenas (aguinaldos.ts de @hyvento/shared): quien pierde un juego le paga unos
// pocos puntos a quien gana. Va con el motivo de los regalos (GIFT, refId "aguinaldo:…"): cuenta para el
// tope diario de dar y tiene el suyo propio, sin columna ni motivo nuevos.
import { AGUINALDO, aguinaldoCabe, dayStart, giftAllowedToday } from "@hyvento/shared";
import type { Prisma } from "@prisma/client";
import { awardPointsTx, spendPointsTx } from "./points";
import { givenToday, lockUser, SocialAborted } from "./social";

type Db = Prisma.TransactionClient;

/** Cuánto pagó alguien hoy en aguinaldos (los movimientos GIFT que salieron con refId "aguinaldo:…"). */
export async function aguinaldosPagadosHoy(tx: Db, userId: string, now = Date.now()): Promise<number> {
  const out = await tx.pointTransaction.aggregate({
    where: { userId, reason: "GIFT", amount: { lt: 0 }, refId: { startsWith: AGUINALDO.refPrefix }, createdAt: { gte: new Date(dayStart(now)) } },
    _sum: { amount: true },
  });
  return -(out._sum.amount ?? 0);
}

/**
 * Paga un aguinaldo en la transacción `tx`: bloquea a quien paga (dos juegos a la vez leen el tope de a
 * uno), revisa su tope de aguinaldos y el de dar, cobra (solo si alcanza) y se lo suma a quien ganó. Si
 * algo no alcanza lanza `SocialAborted` ("funds", "limit-points") y no se mueve nada.
 */
export async function payAguinaldoTx(
  tx: Db,
  input: { refId: string; fromId: string; toId: string; amount: number; now?: number },
): Promise<{ balances: Record<string, number> }> {
  const { refId, fromId, toId, amount } = input;
  const now = input.now ?? Date.now();
  if (fromId === toId) throw new SocialAborted("missing", fromId);
  if (!(await lockUser(tx, fromId))) throw new SocialAborted("missing", fromId);
  const [paid, given] = await Promise.all([aguinaldosPagadosHoy(tx, fromId, now), givenToday(tx, fromId, now)]);
  if (!aguinaldoCabe(paid, amount) || giftAllowedToday({ ...given, gifts: 0 }, amount) !== "ok") throw new SocialAborted("limit-points", fromId);
  const spent = await spendPointsTx(tx, { userId: fromId, amount, reason: "GIFT", refId, now });
  if (!spent.ok) throw new SocialAborted("funds", fromId);
  const got = await awardPointsTx(tx, { userId: toId, amount, reason: "GIFT", refId, now });
  return { balances: { [fromId]: spent.balance, [toId]: got.balance } };
}
