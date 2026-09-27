// Casino (fase 4): apostar y leer los ajustes. Los premios se pagan con `awardPointsTx` (motivo CASINO,
// sin tope). No hay límite diario: solo hace falta que alcancen los puntos.
import { dayStart, summarizeCasino, type CasinoSettingsDTO, type CasinoSummary } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { spendPointsTx } from "./points";

type Db = Prisma.TransactionClient;

/** Suma de los movimientos del casino de hoy (negativo = va perdiendo; las apuestas abiertas cuentan). */
export async function casinoTodayNetTx(tx: Db, userId: string, now = Date.now()): Promise<number> {
  const agg = await tx.pointTransaction.aggregate({
    where: {
      userId,
      reason: "CASINO",
      createdAt: { gte: new Date(dayStart(now)) },
    },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export type CasinoBetOutcome = { ok: true; balance: number } | { ok: false; error: "funds"; balance: number };

/**
 * Descuenta una apuesta si alcanzan los puntos. Bloquea la fila de la persona durante la transacción:
 * dos apuestas al mismo tiempo no pueden dejar el saldo en negativo.
 */
export async function casinoBetTx(
  tx: Db,
  input: { userId: string; amount: number; refId: string; now?: number },
): Promise<CasinoBetOutcome> {
  const { userId, amount, refId } = input;
  await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const spent = await spendPointsTx(tx, {
    userId,
    amount,
    reason: "CASINO",
    refId,
    now: input.now,
  });
  return spent.ok ? { ok: true, balance: spent.balance } : { ok: false, error: "funds", balance: spent.balance };
}

/**
 * Estadísticas del casino desde `since` (o desde siempre): la base suma los movimientos por persona y por
 * juego (el juego sale del `refId`, "ruleta:12"), y `summarizeCasino` arma los totales.
 */
export async function casinoStats(client: Db, since: Date | null): Promise<CasinoSummary> {
  const rows = await client.$queryRaw<
    {
      userId: string;
      game: string;
      staked: number;
      paid: number;
      bets: number;
      best: number;
    }[]
  >`
    SELECT "userId",
      split_part(COALESCE("refId", ''), ':', 1) AS game,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::int AS staked,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::int AS paid,
      (COUNT(*) FILTER (WHERE amount < 0))::int AS bets,
      GREATEST(COALESCE(MAX(amount), 0), 0)::int AS best
    FROM "PointTransaction"
    WHERE reason = 'CASINO' AND "createdAt" >= ${since ?? new Date(0)}
    GROUP BY 1, 2`;
  return summarizeCasino(rows);
}

export function casinoBet(client: PrismaClient, input: Parameters<typeof casinoBetTx>[1]): Promise<CasinoBetOutcome> {
  return client.$transaction((tx) => casinoBetTx(tx, input));
}

/** Ajustes del casino (si nadie los tocó todavía, los de por defecto). */
export async function getCasinoSettings(client: Db): Promise<CasinoSettingsDTO> {
  const row = await client.casinoSettings.findUnique({ where: { id: 1 } });
  return { enabled: row?.enabled ?? true };
}

export async function saveCasinoSettings(client: Db, settings: CasinoSettingsDTO): Promise<void> {
  await client.casinoSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...settings },
    update: settings,
  });
}
