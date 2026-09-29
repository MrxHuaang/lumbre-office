// Apuestas del casino que no alcanzaron a resolverse: al cerrar la sala (o apagar el servidor) se devuelven,
// y si el servidor se cayó sin cerrar, la corrida siguiente las devuelve al arrancar.
//
// Una apuesta perdida no deja ningún pago en el libro, así que "apuesta sin premio" no alcanza para saber si
// la ronda quedó abierta. Por eso cada corrida anota en la base qué rondas tienen apuestas cobradas (antes de
// cobrar la primera) y las borra al pagarlas. Lo que hay que devolver sale del libro: lo apostado menos lo ya
// pagado o devuelto con el mismo `refId`, así que devolver dos veces la misma ronda no paga de más.
import { casinoRefId, type CasinoGame } from "@hyvento/shared";
import type { GameRepository } from "../../repo/types";
import { payoutWithRetry } from "./common";

/** Una mesa que se puede cerrar: deja de aceptar apuestas y espera lo que tenga en curso (cobros y pagos). */
export interface ClosableTable {
  close(): Promise<void>;
}

interface Deps {
  repo: () => GameRepository;
  /** Identifica esta corrida de la sala: va en el `refId` para que las rondas no se repitan entre corridas. */
  run: string;
  /** Refleja el saldo nuevo de alguien (HUD). */
  setPoints: (userId: string, balance: number) => void;
}

export class OpenRounds {
  /** Antigüedad mínima de la fila de otra corrida para darla por muerta (una ronda dura mucho menos). */
  static minAgeMs = 10 * 60_000;
  /** Cada cuánto se buscan corridas muertas (por si al arrancar la otra todavía era reciente). */
  static recoverEveryMs = 5 * 60_000;

  private readonly tables: ClosableTable[] = [];
  /** Rondas con apuestas cobradas (o por cobrar) que todavía no se pagaron. */
  private readonly open = new Set<string>();
  /** Las que ya quedaron anotadas en la base. */
  private saved = new Set<string>();
  private writes: Promise<unknown> = Promise.resolve();
  private closed = false;

  constructor(private readonly d: Deps) {}

  /** `refId` de una ronda de esta corrida (el juego sigue antes del primer ":", como lo leen las estadísticas). */
  ref(game: CasinoGame, round: number) {
    return `${casinoRefId(game, round)}:${this.d.run}`;
  }

  attach(table: ClosableTable) {
    this.tables.push(table);
  }

  /**
   * Antes de cobrar una apuesta: la ronda queda anotada en la base. false = no se pudo anotar (o la sala
   * se está cerrando) y no hay que cobrar: si el servidor se cayera, nadie sabría devolverla.
   */
  async opening(refId: string): Promise<boolean> {
    if (this.closed) return false;
    if (this.saved.has(refId)) return true;
    this.open.add(refId);
    try {
      await this.save();
      return this.saved.has(refId);
    } catch {
      this.open.delete(refId);
      return false;
    }
  }

  /** La ronda se pagó: ya no hay nada que devolver. */
  settled(refId: string) {
    if (this.open.delete(refId)) this.save().catch(() => undefined);
  }

  /** Guarda en orden la foto actual de las rondas abiertas (cada escritura ve lo último). */
  private save(): Promise<void> {
    const run = this.writes.then(async () => {
      const snapshot = [...this.open];
      await this.d.repo().saveCasinoOpenRounds(this.d.run, snapshot);
      this.saved = new Set(snapshot);
    });
    this.writes = run.catch((err) => console.error("saveCasinoOpenRounds", err));
    return run;
  }

  /**
   * Cierre de la sala: las mesas dejan de aceptar apuestas y terminan lo que tenían en curso (una ronda que
   * ya se estaba pagando se paga entera); lo que quedó abierto se devuelve. Si la base no responde, la fila
   * queda y la próxima corrida lo devuelve.
   */
  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled(this.tables.map((t) => t.close()));
    const refs = [...this.open];
    if (refs.length) {
      const pending = new Set(await this.refund(refs));
      for (const r of refs) if (!pending.has(r)) this.open.delete(r);
      await this.save().catch(() => undefined);
    }
    await this.writes;
  }

  /** Devuelve las rondas abiertas de corridas muertas (filas de otra corrida con cierta antigüedad). */
  async recover(now = Date.now()): Promise<void> {
    try {
      const rows = await this.d.repo().loadCasinoOpenRounds();
      for (const row of rows) {
        if (row.run === this.d.run || now - row.updatedAt < OpenRounds.minAgeMs) continue;
        // Primero se reclama la fila: otro servidor arrancando a la vez no la devuelve de nuevo.
        if (!(await this.d.repo().claimCasinoOpenRounds(row.run, row.updatedAt))) continue;
        console.warn(`Casino: devolviendo apuestas de rondas sin cerrar (corrida ${row.run})`, row.refIds);
        const pending = await this.refund(row.refIds);
        // Lo que no se pudo devolver vuelve a quedar anotado para el próximo intento.
        if (pending.length) await this.d.repo().saveCasinoOpenRounds(row.run, pending);
      }
    } catch (err) {
      console.error("Casino: no se pudieron revisar las rondas sin cerrar", err);
    }
  }

  /**
   * Devuelve a cada persona lo que puso en esas rondas menos lo que ya le volvió (premio o devolución, con el
   * mismo `refId`). Devuelve las rondas que quedaron pendientes.
   */
  private async refund(refIds: string[]): Promise<string[]> {
    let moves;
    try {
      moves = await this.d.repo().casinoMovements(refIds);
    } catch (err) {
      console.error("casinoMovements", err);
      return refIds;
    }
    const net = new Map<string, { refId: string; userId: string; amount: number }>();
    for (const m of moves) {
      const key = `${m.refId}\u0000${m.userId}`;
      const t = net.get(key) ?? { refId: m.refId, userId: m.userId, amount: 0 };
      t.amount += m.amount;
      net.set(key, t);
    }
    const pending = new Set<string>();
    for (const t of net.values()) {
      if (t.amount >= 0) continue;
      const paid = await payoutWithRetry(this.d.repo, { userId: t.userId, amount: -t.amount, refId: t.refId }, "devolución");
      if (paid) this.d.setPoints(t.userId, paid.balance);
      else pending.add(t.refId);
    }
    return [...pending];
  }
}
