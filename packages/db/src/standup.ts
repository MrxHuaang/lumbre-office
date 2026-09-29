// Standup del tablón: guardar el de hoy y pagar el bono del primero en la misma transacción (ver
// standup.ts de @hyvento/shared). Lo usa la web (/api/standup).
import type { PrismaClient } from "@prisma/client";
import { awardPointsTx } from "./points";

export interface StandupSaveInput {
  userId: string;
  day: string;
  /** Ya limpio (cleanStandup). */
  text: string;
  bonus: { amount: number; refId: string };
}

/**
 * Crea o reemplaza el standup de alguien en un día. El bono va solo con el primero y una vez por
 * `refId` (motivo DAILY, por awardPointsTx): editar, o borrar la fila y volver a escribir, no paga de nuevo.
 */
export function saveStandupRow(client: PrismaClient, input: StandupSaveInput): Promise<{ created: boolean; awarded: number }> {
  const { userId, day, text, bonus } = input;
  return client.$transaction(async (tx) => {
    // Se bloquea la fila del usuario: dos pestañas a la vez no crean dos veces ni cobran dos bonos.
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const existing = await tx.standup.findUnique({ where: { userId_day: { userId, day } }, select: { userId: true } });
    if (existing) {
      await tx.standup.update({ where: { userId_day: { userId, day } }, data: { text } });
      return { created: false, awarded: 0 };
    }
    await tx.standup.create({ data: { userId, day, text } });
    const paid = await tx.pointTransaction.findFirst({ where: { userId, refId: bonus.refId }, select: { id: true } });
    if (paid || bonus.amount <= 0) return { created: true, awarded: 0 };
    const r = await awardPointsTx(tx, { userId, amount: bonus.amount, reason: "DAILY", refId: bonus.refId });
    return { created: true, awarded: r.awarded };
  });
}

/** Los standups de un día con quien los escribió, del más viejo al más nuevo. */
export function listStandupRows(client: PrismaClient, day: string) {
  return client.standup.findMany({
    where: { day },
    orderBy: { createdAt: "asc" },
    select: { userId: true, day: true, text: true, createdAt: true, updatedAt: true, user: { select: { name: true, avatar: true, look: true } } },
  });
}
