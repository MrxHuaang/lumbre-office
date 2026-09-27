// Intercambios contra la base (el repositorio de Prisma): corre `executeTradeTx` en una transacción y
// traduce su corte (`SocialAborted`) al resultado que entiende la sala. Aparte para poder probarlo con
// una base de mentira.
import { executeTradeTx, SocialAborted, type Prisma } from "@hyvento/db";
import type { TradeResult, TradeSideInput } from "./types";

/** Lo que hace falta del cliente de Prisma: abrir una transacción. */
export interface TradeDb {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/**
 * El motivo de la transacción, como error del intercambio. `null`: no es algo que la persona pueda
 * arreglar (la persona no existe, o un error de la base): la sala responde "no se pudo".
 */
export function tradeAbortResult(err: unknown): Extract<TradeResult, { ok: false }> | null {
  if (!(err instanceof SocialAborted)) return null;
  const error = err.code === "funds" || err.code === "items" || err.code === "one-sided" ? err.code : err.code === "limit-points" ? "limit" : null;
  if (!error) return null;
  return { ok: false, error, userId: err.userId ?? "" };
}

export async function executeTrade(db: TradeDb, input: { refId: string; a: TradeSideInput; b: TradeSideInput }): Promise<TradeResult> {
  try {
    const { balances } = await db.$transaction((tx) => executeTradeTx(tx, input));
    return { ok: true, balances };
  } catch (err) {
    const result = tradeAbortResult(err);
    if (!result) throw err;
    return result;
  }
}
