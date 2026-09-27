// Piezas comunes de las mesas del casino: la cola de mensajes y los pagos con reintento.
import type { GameRepository } from "../../repo/types";

/**
 * Cola de una mesa: cada jugada corre cuando terminó la anterior. La sala no procesa los mensajes de a
 * uno (los `await` a la base se intercalan), y sin esto dos "doblar" o varias apuestas simultáneas
 * pasarían los chequeos antes de cobrarse.
 */
export class TableQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

const RETRY_DELAYS_MS = [200, 1_000, 5_000];

/**
 * Paga (premio o devolución) reintentando si la base falla. Si no se pudo, lo deja registrado con todo
 * lo necesario para conciliar a mano: la persona ya fue cobrada.
 */
export async function payoutWithRetry(
  repo: () => GameRepository,
  input: { userId: string; amount: number; refId: string },
  kind: "premio" | "devolución",
): Promise<{ balance: number } | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await repo().casinoPayout(input);
    } catch (err) {
      const wait = RETRY_DELAYS_MS[attempt];
      if (wait === undefined) {
        console.error(`CASINO PAGO PENDIENTE (conciliar): ${kind}`, JSON.stringify(input), err);
        return null;
      }
      console.warn(`casinoPayout falló (${kind}), reintento en ${wait} ms`, err);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** Tope de mensajes del casino por persona: 8 por segundo alcanza para jugar y frena las ráfagas. */
export const CASINO_BURST = { windowMs: 1_000, max: 8 };

/** Acepta un mensaje del casino si no pasa el tope de la ventana (guarda las horas en `times`). */
export function acceptCasinoMessage(times: number[], now: number): boolean {
  while (times.length > 0 && now - times[0]! >= CASINO_BURST.windowMs) times.shift();
  if (times.length >= CASINO_BURST.max) return false;
  times.push(now);
  return true;
}
