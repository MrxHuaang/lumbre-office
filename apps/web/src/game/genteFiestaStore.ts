// El estado de la gente de la fiesta que ve el HUD (sin Phaser: lo importan los componentes): con quién se
// puede hablar ahora, los pedidos ya entregados en este festival y con quiénes ya se habló.
import { create } from "zustand";

interface GenteStore {
  /** Con quién se puede hablar ahora (la "E"). */
  cerca: { id: string; nombre: string } | null;
  /** Los pedidos de este festival que ya entregué. */
  hechos: ReadonlySet<string>;
  /** Con quiénes ya hablé en este festival (para la chispa de "algo nuevo"). */
  hablados: ReadonlySet<string>;
  /** El pedido que se está entregando (para no mandarlo dos veces). */
  entregando: string | null;
}

export const useGenteFiesta = create<GenteStore>(() => ({ cerca: null, hechos: new Set(), hablados: new Set(), entregando: null }));

/** ¿Hay alguien de la fiesta al alcance para hablarle? (la "E" de la escena). */
export const genteAlAlcance = () => useGenteFiesta.getState().cerca;
