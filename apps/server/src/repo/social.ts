// Intercambios contra la base (el repositorio de Prisma): corre `executeTradeTx` en una transacción y
// traduce su corte (`SocialAborted`) al resultado que entiende la sala. Aparte para poder probarlo con
// una base de mentira.
import { executeTipTx, executeTradeTx, payAguinaldoTx, SocialAborted, type Prisma } from "@hyvento/db";
import type { AguinaldoPayResult, TipInput, TipResult, TradeResult, TradeSideInput } from "./types";

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
  const error =
    err.code === "funds" || err.code === "items" || err.code === "one-sided" || err.code === "limit-items"
      ? err.code
      : err.code === "limit-points"
        ? "limit"
        : null;
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

/** Una propina contra la base: lo que se puede arreglar (saldo, topes) vuelve como error; lo demás sube. */
export async function executeTip(db: TradeDb, input: TipInput): Promise<TipResult> {
  try {
    const { balances } = await db.$transaction((tx) => executeTipTx(tx, input));
    return { ok: true, balances };
  } catch (err) {
    if (err instanceof SocialAborted) {
      if (err.code === "funds" || err.code === "limit-tips") return { ok: false, error: err.code };
      if (err.code === "limit-points") return { ok: false, error: "limit" };
    }
    throw err;
  }
}

/** Un aguinaldo contra la base: lo que se puede arreglar (saldo, topes) vuelve como error; lo demás sube. */
export async function executeAguinaldo(db: TradeDb, input: TipInput): Promise<AguinaldoPayResult> {
  try {
    const { balances } = await db.$transaction((tx) => payAguinaldoTx(tx, input));
    return { ok: true, balances };
  } catch (err) {
    if (err instanceof SocialAborted && (err.code === "funds" || err.code === "limit-points")) return { ok: false, error: err.code === "funds" ? "funds" : "limit" };
    throw err;
  }
}
