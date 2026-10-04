import { MOVE_SEND_HZ } from "@hyvento/shared";

/**
 * Interpolación de los otros jugadores (VIR-110). Cada posición que llega se guarda con la hora local de
 * llegada y se dibuja ~100 ms atrás, en línea recta entre las dos muestras que rodean ese momento: así
 * los 15 envíos por segundo se ven como un paso parejo y no como pulsos, aunque lleguen con jitter.
 * Sin Phaser, para poder probarla.
 */

/** Cuánto atrás se dibuja: algo más que un envío (66 ms) para tener casi siempre la muestra siguiente. */
export const INTERP_DELAY_MS = 100;
/** Saltos más largos que esto (px de mundo, 3 tiles) no se interpolan: cambio de nivel, viaje, teletransporte. */
export const INTERP_SNAP_PX = 96;
/** Lo que se espera entre dos envíos. */
export const INTERP_SEND_MS = 1000 / MOVE_SEND_HZ;
/** Tope de muestras guardadas (con el retraso de 100 ms alcanzan unas pocas). */
const MAX_SAMPLES = 32;

export interface Snapshot<T> {
  /** Hora local de llegada (ms, `performance.now()`). */
  t: number;
  x: number;
  y: number;
  /** Lo que acompaña a la posición (dirección, si camina, si está sentado): se aplica cuando se llega a ella. */
  state: T;
}

export interface Sampled<T> {
  x: number;
  y: number;
  state: T;
}

export class SnapshotBuffer<T> {
  private samples: Snapshot<T>[] = [];

  constructor(
    private readonly delayMs = INTERP_DELAY_MS,
    private readonly snapPx = INTERP_SNAP_PX,
    private readonly sendMs = INTERP_SEND_MS,
  ) {}

  /**
   * Guarda una muestra. Con `snap` (o si el salto es grande) se descarta lo anterior y la posición se
   * aplica directo. Devuelve si fue un salto.
   */
  push(t: number, x: number, y: number, state: T, snap = false): boolean {
    const last = this.samples.at(-1);
    if (!last || snap || Math.hypot(x - last.x, y - last.y) > this.snapPx) {
      this.samples = [{ t, x, y, state }];
      return true;
    }
    if (t <= last.t) {
      // Dos en el mismo instante: vale la última.
      this.samples[this.samples.length - 1] = { t: last.t, x, y, state };
      return false;
    }
    // Estaba quieto (no llegaba nada): sin esto, el primer paso se recorrería de golpe porque la muestra
    // anterior es vieja. Se repite la posición de antes un envío antes de la nueva (ya con lo nuevo: si
    // arrancó a caminar, el primer paso se ve caminando).
    if (t - last.t > this.sendMs * 2) this.samples.push({ t: t - this.sendMs, x: last.x, y: last.y, state });
    this.samples.push({ t, x, y, state });
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    return false;
  }

  /** Dónde dibujarlo a la hora `now`: entre las dos muestras que rodean `now - delay` (o la más cercana). */
  sample(now: number): Sampled<T> | null {
    const s = this.samples;
    const rt = now - this.delayMs;
    // Lo que ya quedó atrás se descarta (se guarda la última muestra anterior a `rt`).
    let drop = 0;
    while (drop + 1 < s.length && s[drop + 1]!.t <= rt) drop++;
    if (drop) s.splice(0, drop);
    const a = s[0];
    if (!a) return null;
    const b = s[1];
    // Antes de la primera o sin la siguiente todavía: se queda en la última conocida (sin adivinar).
    if (!b || rt <= a.t) return { x: a.x, y: a.y, state: a.state };
    const k = (rt - a.t) / (b.t - a.t);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, state: a.state };
  }

  /** La última posición que llegó (para lo que necesita saber dónde está "de verdad"). */
  latest(): Snapshot<T> | undefined {
    return this.samples.at(-1);
  }

  get size() {
    return this.samples.length;
  }
}
