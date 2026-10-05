// Capítulo 2 de la historia en la sala: "El reloj de pie" (ver capitulo2.ts de @hyvento/shared). Cada paso
// se cumple en un lugar de la cabaña y solo cuenta con ese paso abierto: mirar el reloj de pie de la planta
// baja, moler una mazorca en el molino (sale el engranaje), usar el banco del taller del garaje (el
// resorte), comprarle el péndulo al Man del Sombrero y llevar las tres piezas al reloj. Este módulo suma el
// contador del paso, da y quita las piezas (objetos de historia) y manda la cinemática; la entrega de cada
// paso es la de siempre, con Doña Aurora (encargos.ts).
import {
  HISTORIA_MSG,
  HISTORIA_RELOJ,
  PENDULO_PRECIO,
  PIEZAS_RELOJ,
  PIEZAS_RELOJ_OBJETOS,
  RELOJ_CINE,
  RELOJ_PASOS,
  objItemId,
  type HistoriaCine,
} from "@hyvento/shared";

/** Dónde está el reloj de E. (el del recibidor) y el banco que lo templa. */
const RELOJ_AREA = "planta-baja";
const TALLER_AREA = "garaje";

export interface Capitulo2Deps {
  /** En qué va un paso de historia (ver `Encargos.storyStep`). */
  step(userId: string, questId: string): "open" | "done" | null;
  bump(userId: string, key: string): void;
  bag: {
    count(userId: string, itemId: string): number;
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    add(userId: string, itemId: string, quantity?: number): Promise<"ok" | "full" | "stack">;
    take(userId: string, itemId: string, quantity?: number): Promise<boolean>;
  };
  spend(userId: string, amount: number, refId: string): Promise<{ ok: boolean; balance: number }>;
  send(sessionId: string, type: string, msg: unknown): void;
}

export type PenduloResult = "ok" | "notNow" | "have" | "full" | "funds" | "failed";

const pieceName = (id: string) => PIEZAS_RELOJ_OBJETOS[id]?.name ?? id;

export class Capitulo2 {
  constructor(private readonly deps: Capitulo2Deps) {}

  private cine(sessionId: string, id: string, vars?: Record<string, string | number>) {
    this.deps.send(sessionId, HISTORIA_MSG.cine, { id, ...(vars ? { vars } : {}) } satisfies HistoriaCine);
  }

  private aviso(sessionId: string, text: string) {
    this.deps.send(sessionId, HISTORIA_MSG.aviso, { text });
  }

  /** Le da una pieza a quien tiene abierto el paso (si no la tiene ya) y suma su contador. */
  private async givePiece(sessionId: string, userId: string, piece: string, stat: string): Promise<boolean> {
    const item = objItemId(piece);
    if (this.deps.bag.count(userId, item) > 0) {
      // Ya la tenía (se cayó la sala justo antes de sumar): cuenta igual.
      this.deps.bump(userId, stat);
      return true;
    }
    if (this.deps.bag.fits(userId, [[item, 1]]) !== "ok") {
      this.aviso(sessionId, `Encontró ${pieceName(piece).toLowerCase()}, pero no le cabe en la mochila. Haga espacio y vuelva.`);
      return false;
    }
    if ((await this.deps.bag.add(userId, item, 1)) !== "ok") return false;
    this.deps.bump(userId, stat);
    this.cine(sessionId, RELOJ_CINE.pieza, { pieza: pieceName(piece) });
    return true;
  }

  /** El reloj de pie (E): mirarlo, arreglarlo con las tres piezas o, si ya anda, oírlo. */
  async clock(sessionId: string, userId: string, area: string) {
    if (area !== RELOJ_AREA) return this.aviso(sessionId, "Tic… tac… Este reloj anda bien. El que está parado es el del recibidor.");
    const d = this.deps;
    if (d.step(userId, RELOJ_PASOS.mirar) === "open") {
      d.bump(userId, HISTORIA_RELOJ.mirado);
      return this.cine(sessionId, RELOJ_CINE.callado);
    }
    if (d.step(userId, RELOJ_PASOS.arreglar) === "open") {
      const pieces = Object.values(PIEZAS_RELOJ);
      const missing = pieces.filter((p) => d.bag.count(userId, objItemId(p)) === 0);
      if (missing.length) return this.aviso(sessionId, `Todavía le falta: ${missing.map((p) => pieceName(p).toLowerCase()).join(", ")}.`);
      for (const p of pieces) if (!(await d.bag.take(userId, objItemId(p), 1))) return;
      d.bump(userId, HISTORIA_RELOJ.arreglado);
      return this.cine(sessionId, RELOJ_CINE.campanadas);
    }
    if (d.step(userId, RELOJ_PASOS.arreglar) === "done") return this.aviso(sessionId, "Tic… tac… El reloj de E. anda como nuevo. A cada hora da su campanada.");
    return this.aviso(sessionId, "Está parado en las 3:15. Lleva años así.");
  }

  /** Salió la harina del molino: con el paso abierto, también sale el engranaje que estaba trabado. */
  async flour(sessionId: string, userId: string) {
    if (this.deps.step(userId, RELOJ_PASOS.engranaje) !== "open") return;
    await this.givePiece(sessionId, userId, PIEZAS_RELOJ.engranaje, HISTORIA_RELOJ.engranaje);
  }

  /** Se usó un mueble (ya validado el alcance): el banco del taller templa el resorte. */
  async furniture(sessionId: string, userId: string, area: string, type: string) {
    if (type !== "workbench" || area !== TALLER_AREA) return;
    if (this.deps.step(userId, RELOJ_PASOS.resorte) !== "open") return;
    await this.givePiece(sessionId, userId, PIEZAS_RELOJ.resorte, HISTORIA_RELOJ.resorte);
  }

  /** Comprarle el péndulo al Man del Sombrero (la sala ya revisó que esté y que esté cerca). */
  async buyPendulum(sessionId: string, userId: string): Promise<{ result: PenduloResult; balance?: number }> {
    const d = this.deps;
    if (d.step(userId, RELOJ_PASOS.pendulo) !== "open") return { result: "notNow" };
    const item = objItemId(PIEZAS_RELOJ.pendulo);
    if (d.bag.count(userId, item) > 0) {
      d.bump(userId, HISTORIA_RELOJ.pendulo);
      return { result: "have" };
    }
    if (d.bag.fits(userId, [[item, 1]]) !== "ok") return { result: "full" };
    let paid: { ok: boolean; balance: number };
    try {
      paid = await d.spend(userId, PENDULO_PRECIO, "historia:pendulo");
    } catch (err) {
      console.error("pendulo", err);
      return { result: "failed" };
    }
    if (!paid.ok) return { result: "funds", balance: paid.balance };
    if (!(await this.givePiece(sessionId, userId, PIEZAS_RELOJ.pendulo, HISTORIA_RELOJ.pendulo))) return { result: "full", balance: paid.balance };
    return { result: "ok", balance: paid.balance };
  }
}
