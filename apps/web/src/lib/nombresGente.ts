// Qué nombres de la gente de la fiesta se muestran. En el Carnaval hay muchos juntos en la vereda: con
// todos los nombres prendidos, las placas se montaban unas sobre otras y no se leía ninguno. Se muestran
// los de los más cercanos, pocos y sin que dos placas se toquen.

export interface PlacaCandidata {
  id: string;
  /** Dónde queda la placa en la pantalla del mundo (px, ya proyectado). */
  sx: number;
  sy: number;
  /** A cuántos tiles está de mí. */
  d: number;
  /** Lo ancho de la placa (px). */
  ancho: number;
}

export const NOMBRES = {
  /** Hasta dónde se ven los nombres (tiles). */
  tiles: 5,
  /** Cuántos a la vez como mucho. */
  max: 4,
  /** El alto de una placa (px) más un respiro: dos más juntas que esto se tocan. */
  alto: 13,
  /** El respiro a lo ancho entre dos placas (px). */
  aire: 4,
};

/** Con el desfile pasando (las carrozas tapan la vereda y una placa quedaría flotando sobre ellas). */
export const NOMBRES_DESFILE = { ...NOMBRES, tiles: 2.2, max: 2 };

/** El ancho aproximado de una placa con ese nombre (fuente pixel de 8 px). */
export const anchoPlaca = (nombre: string) => nombre.length * 5 + 8;

/** Los nombres que se muestran: los más cercanos primero, y uno que se montaría sobre otro ya puesto, no. */
export function elegirNombres(cands: readonly PlacaCandidata[], opts = NOMBRES, ocupadas: readonly PlacaCandidata[] = []): Set<string> {
  // Las placas que ya están (la mía): ninguna se monta encima, pero no cuentan en el tope.
  const puestas: PlacaCandidata[] = [...ocupadas];
  for (const c of [...cands].filter((c) => c.d <= opts.tiles).sort((a, b) => a.d - b.d)) {
    if (puestas.length - ocupadas.length >= opts.max) break;
    const choca = puestas.some((p) => Math.abs(p.sx - c.sx) < (p.ancho + c.ancho) / 2 + opts.aire && Math.abs(p.sy - c.sy) < opts.alto);
    if (!choca) puestas.push(c);
  }
  return new Set(puestas.slice(ocupadas.length).map((p) => p.id));
}
