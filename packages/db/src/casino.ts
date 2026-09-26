// Casino (fase 4): apostar respetando el límite diario de pérdidas y leer los ajustes. Los premios se
// pagan con `awardPointsTx` (motivo CASINO, sin tope).
import { CASINO, dayStart, remainingToday, type CasinoSettingsDTO } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { spendPointsTx } from "./points";

type Db = Prisma.TransactionClient;

/** Suma de los movimientos del casino de hoy (negativo = va perdiendo; las apuestas abiertas cuentan). */
export async function casinoTodayNetTx(tx: Db, userId: string, now = Date.now()): Promise<number> {
  const agg = await tx.pointTransaction.aggregate({
    where: { userId, reason: "CASINO", createdAt: { gte: new Date(dayStart(now)) } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export type CasinoBetOutcome = { ok: true; balance: number } | { ok: false; error: "limit" | "funds"; balance: number };

/**
 * Descuenta una apuesta si no pasa el límite de pérdidas de hoy y si alcanzan los puntos. Bloquea la
 * fila de la persona durante la transacción: dos apuestas al mismo tiempo no pueden saltarse el límite.
 */
export async function casinoBetTx(
  tx: Db,
  input: { userId: string; amount: number; refId: string; limit: number; now?: number },
): Promise<CasinoBetOutcome> {
  const { userId, amount, refId, limit } = input;
  await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const net = await casinoTodayNetTx(tx, userId, input.now);
  if (amount > remainingToday(limit, net)) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } });
    return { ok: false, error: "limit", balance: user?.points ?? 0 };
  }
  const spent = await spendPointsTx(tx, { userId, amount, reason: "CASINO", refId, now: input.now });
  return spent.ok ? { ok: true, balance: spent.balance } : { ok: false, error: "funds", balance: spent.balance };
}

export function casinoBet(client: PrismaClient, input: Parameters<typeof casinoBetTx>[1]): Promise<CasinoBetOutcome> {
  return client.$transaction((tx) => casinoBetTx(tx, input));
}

/** Ajustes del casino (si nadie los tocó todavía, los de por defecto). */
export async function getCasinoSettings(client: Db): Promise<CasinoSettingsDTO> {
  const row = await client.casinoSettings.findUnique({ where: { id: 1 } });
  return { enabled: row?.enabled ?? true, dailyLossLimit: row?.dailyLossLimit ?? CASINO.defaultDailyLossLimit };
}

export async function saveCasinoSettings(client: Db, settings: CasinoSettingsDTO): Promise<void> {
  await client.casinoSettings.upsert({ where: { id: 1 }, create: { id: 1, ...settings }, update: settings });
}
