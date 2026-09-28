// Movimientos de puntos: la única forma de cambiar un saldo. La usan el servidor de juego (presencia,
// reuniones, cafetería) y la web (buzón, misiones), así el tope diario y el libro quedan iguales en todos lados.
import { DAILY_CAPS, dayStart, POINTS, WELCOME_REF, type PointReason } from "@hyvento/shared";
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
    // Se bloquea la fila: dos premios con tope al mismo tiempo leerían la misma suma y juntos lo pasarían.
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
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

/** Suma puntos a alguien respetando el tope diario de su motivo (para gastar: `spendPoints`). */
export function awardPoints(client: PrismaClient, input: AwardInput): Promise<AwardResult> {
  return client.$transaction((tx) => awardPointsTx(tx, input));
}

export interface SpendInput {
  userId: string;
  /** Cuánto cuesta (positivo); en el libro queda como monto negativo. */
  amount: number;
  reason: PointReason;
  refId?: string;
  now?: number;
}

/**
 * Gasta puntos solo si alcanzan: el descuento es un update condicional (`points >= amount`), así dos
 * compras al mismo tiempo nunca dejan el saldo en negativo. `ok: false` = no alcanzó (no se cobra nada).
 */
export async function spendPointsTx(tx: Prisma.TransactionClient, input: SpendInput): Promise<{ ok: boolean; balance: number }> {
  const { userId, amount, reason, refId } = input;
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Monto inválido: ${amount}`);
  const charged = await tx.user.updateMany({ where: { id: userId, points: { gte: amount } }, data: { points: { decrement: amount } } });
  const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
  if (charged.count === 0) return { ok: false, balance: user?.points ?? 0 };
  await tx.pointTransaction.create({ data: { userId, amount: -amount, reason, refId, createdAt: new Date(input.now ?? Date.now()) } });
  return { ok: true, balance: user!.points };
}

export function spendPoints(client: PrismaClient, input: SpendInput): Promise<{ ok: boolean; balance: number }> {
  return client.$transaction((tx) => spendPointsTx(tx, input));
}

/**
 * Da el bono de bienvenida si esa persona todavía no lo recibió (una sola vez). Bloquea la fila del
 * usuario para que dos entradas a la vez no lo den dos veces.
 */
export async function grantWelcomeBonus(db: PrismaClient, userId: string, amount: number = POINTS.welcomeBonus): Promise<AwardResult & { granted: boolean }> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const done = await tx.pointTransaction.findFirst({ where: { userId, reason: "ADMIN", refId: WELCOME_REF }, select: { id: true } });
    if (done || amount <= 0) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } });
      return { granted: false, awarded: 0, balance: user.points };
    }
    const r = await awardPointsTx(tx, { userId, amount, reason: "ADMIN", refId: WELCOME_REF });
    return { ...r, granted: true };
  });
}

export interface AwardOnceInput extends AwardInput {
  refId: string;
  /** Movimientos de hoy (día de Bogotá) cuyo `refId` empieza así: con `maxPerDay` de ellos ya no se da más. */
  refPrefix: string;
  maxPerDay: number;
}

/** "duplicate" = ese `refId` ya se pagó; "limit" = ya se dieron los `maxPerDay` de hoy. */
export type AwardOnceResult = AwardResult & { status: "ok" | "duplicate" | "limit" };

/**
 * Premio que se da una sola vez por `refId` y hasta `maxPerDay` veces por día (felicitaciones de
 * cumpleaños, bloques del modo foco). Bloquea la fila del usuario: dos premios a la vez no se saltan el tope.
 */
export function awardPointsOnce(db: PrismaClient, input: AwardOnceInput): Promise<AwardOnceResult> {
  const now = input.now ?? Date.now();
  const { userId, refId, refPrefix, maxPerDay } = input;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const balance = async () => (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } })).points;
    const done = await tx.pointTransaction.findFirst({ where: { userId, refId }, select: { id: true } });
    if (done) return { status: "duplicate" as const, awarded: 0, balance: await balance() };
    const today = await tx.pointTransaction.count({ where: { userId, refId: { startsWith: refPrefix }, createdAt: { gte: new Date(dayStart(now)) } } });
    if (today >= maxPerDay) return { status: "limit" as const, awarded: 0, balance: await balance() };
    const r = await awardPointsTx(tx, { userId, amount: input.amount, reason: input.reason, refId, now });
    return { status: "ok" as const, ...r };
  });
}
