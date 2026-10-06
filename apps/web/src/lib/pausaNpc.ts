// La gente de la fiesta se queda quieta mientras se habla con ella. Su pose es una función pura del minuto
// del juego (igual para todos), así que la pausa es solo de este navegador: cada uno lleva su propio
// minuto, que se queda quieto con la tira abierta y después se pone al día caminando un poco más rápido
// (sin saltos). El atraso tiene tope (`GENTE_REGLAS.pausaMaxMin`), y el servidor acepta la pose de hasta
// ese rato atrás al entregar un pedido.
import { GENTE_REGLAS } from "@hyvento/shared";

export const PAUSA_NPC = {
  /** Cuánto más rápido va mientras se pone al día (0,5 = a 1,5 veces su paso). */
  recupera: 0.5,
  /** El atraso máximo (minutos del juego). */
  max: GENTE_REGLAS.pausaMaxMin,
};

/** El minuto en que va un NPC en este navegador. */
export class RelojNpc {
  private local: number | null = null;
  private ultimo: number | null = null;

  /** El minuto para su pose, con el minuto del juego `m` y si se está hablando con él. */
  minuto(m: number, hablando: boolean): number {
    // Primera vez, o empezó otro día (el minuto del día volvió a empezar): va con todos.
    if (this.local === null || this.ultimo === null || m < this.ultimo) {
      this.ultimo = m;
      return (this.local = m);
    }
    const dt = m - this.ultimo;
    this.ultimo = m;
    if (!hablando) this.local = Math.min(m, this.local + dt * (1 + PAUSA_NPC.recupera));
    // Con la tira abierta no avanza, pero nunca se queda más atrás que el tope.
    this.local = Math.max(this.local, m - PAUSA_NPC.max);
    return this.local;
  }

  /** Cuánto va atrasado (minutos del juego). */
  atraso(): number {
    return this.ultimo === null || this.local === null ? 0 : this.ultimo - this.local;
  }
}
