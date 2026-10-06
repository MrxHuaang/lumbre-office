// Cómo se mezcla la música del desfile (la parte pura, con tests). Antes la banda de cada conjunto cambiaba
// de grupo apenas otro sonaba un pelito más fuerte: con las carrozas pasando, la pieza se cortaba a cada
// rato y entraba otra a la mitad. Ahora se queda con el grupo que suena un buen rato (o hasta que su pieza
// acaba), solo cambia si el otro se oye claramente más, y el cambio es un fundido cruzado.

export const MEZCLA = {
  /** Para quitarle la banda al grupo de ahora, el otro tiene que oírse esto más fuerte. */
  ratio: 1.8,
  /** Lo mínimo que se queda con un grupo antes de cambiar por volumen (ms). */
  quedarseMs: 25_000,
  /** Por debajo de esto el grupo de ahora ya casi no se oye: se cambia sin esperar. */
  piso: 0.08,
  /** El fundido cruzado al cambiar de grupo (constante de tiempo, s: a los ~3 s ya se fue). */
  fundidoS: 1,
  /** Cuánto queda la banda del desfile mientras suena la música de una cinemática. */
  bajoCine: 0.18,
  /** La banda que se oye menos, al lado de la otra. */
  segunda: 0.25,
  /** La ganancia después del compresor de cada banda (lo que el compresor le quita a los picos, devuelto). */
  ganancia: 1.6,
};

export interface Candidato {
  clave: string;
  vol: number;
  /** Si el grupo está en la pausa entre dos piezas: ahí se puede cambiar sin cortar nada. */
  enPausa?: boolean;
}

/** Elige qué grupo toca una banda, sin saltar de uno a otro a cada rato. */
export class Selector {
  actual: string | null = null;
  private desde = 0;

  elegir(cands: readonly Candidato[], now: number): string | null {
    let mejor: Candidato | null = null;
    for (const c of cands) if (c.vol > 0.01 && (!mejor || c.vol > mejor.vol)) mejor = c;
    const yo = this.actual ? cands.find((c) => c.clave === this.actual) : undefined;
    if (!mejor) return this.poner(null, now);
    if (!yo || yo.vol < MEZCLA.piso) return this.poner(mejor.clave, now);
    if (mejor.clave === yo.clave) return yo.clave;
    // En la pausa entre piezas se pasa al que más se oye sin cortar nada.
    if (yo.enPausa && mejor.vol > yo.vol) return this.poner(mejor.clave, now);
    if (now - this.desde >= MEZCLA.quedarseMs && mejor.vol > yo.vol * MEZCLA.ratio) return this.poner(mejor.clave, now);
    return yo.clave;
  }

  private poner(clave: string | null, now: number) {
    if (clave !== this.actual) {
      this.actual = clave;
      this.desde = now;
    }
    return clave;
  }
}

/**
 * Lo fuerte que suena una banda a partir de lo que llega con la distancia: la raíz levanta lo lejano (una
 * murga se oye desde lejos) sin pasarse de 1.
 */
export const realce = (vol: number) => (vol <= 0.01 ? 0 : Math.min(1, Math.sqrt(vol) * 1.1));
