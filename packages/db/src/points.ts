// Movimientos de puntos: la única forma de cambiar un saldo. La usan el servidor de juego (presencia,
// reuniones) y la web (buzón, misiones), así el tope diario y el libro quedan iguales en todos lados.
import { DAILY_CAPS, dayStart, type PointReason } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface AwardInput {
  userId: string;
  amount: number;
  reason: PointReason;
  refId?: string;
  now?: number;
}

export interface AwardResult {
  /** Lo que realmente se sumó (menos que `amount` si se llegó al tope diario; 0 si ya estaba lleno). */
  awarded: number;
  balance: number;
}

/** Igual que `awardPoints`, pero dentro de una transacción ya abierta (p. ej. al aprobar una misión). */
export async function awardPointsTx(tx: Prisma.TransactionClient, input: AwardInput): Promise<AwardResult> {
  const { userId, reason, refId } = input;
  const now = input.now ?? Date.now();
  let amount = input.amount;
  const cap = DAILY_CAPS[reason];
  if (cap !== null && amount > 0) {
    const today = await tx.pointTransaction.aggregate({
      where: { userId, reason, createdAt: { gte: new Date(dayStart(now)) } },
      _sum: { amount: true },
    });
    amount = Math.min(amount, cap - (today._sum.amount ?? 0));
  }
  if (amount <= 0) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
    return { awarded: 0, balance: user.points };
  }
  await tx.pointTransaction.create({ data: { userId, amount, reason, refId, createdAt: new Date(now) } });
  const user = await tx.user.update({ where: { id: userId }, data: { points: { increment: amount } }, select: { points: true } });
  return { awarded: amount, balance: user.points };
}

/** Suma (o resta, con monto negativo) puntos a alguien respetando el tope diario de su motivo. */
export function awardPoints(client: PrismaClient, input: AwardInput): Promise<AwardResult> {
  return client.$transaction((tx) => awardPointsTx(tx, input));
}
