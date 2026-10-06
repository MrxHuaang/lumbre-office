// El desfile del Carnaval por la calle del Megabús (docs/plan-carnaval.md): dónde va cada carroza, cada
// bailarín y la gente de la cabaña que se sumó, a tantos ms de empezado. Va de oeste a este por el carril
// exclusivo (world/areas/parada.ts), sale del bosque, para frente al portón (ahí se suma la gente de la
// vereda) y frente a la Estación Hyvento (el palco), y se pierde en el bosque del este. Es una sola fila:
// la cabeza (Don Evelio de abanderado) marca el paso y el resto va detrás a su distancia; en las paradas
// para toda la fila. Puro (en tiles del nivel `jardin`): lo usan la sala (para mover a quien baila) y el
// navegador (para dibujarlo con la hora del servidor), así todos lo ven igual.
import { CARNAVAL, COMPARSAS, type CarrozaId } from "@hyvento/shared";
import { ROAD } from "./world/areas/parada";

/** Lo que va en la fila, en orden: el abanderado, las carrozas con su comparsa y la gente de la cabaña. */
export type DesfileUnidad = { id: "abanderado"; largo: number } | { id: CarrozaId; largo: number } | { id: "cabana"; largo: number };

export const DESFILE_UNIDADES: readonly DesfileUnidad[] = [{ id: "abanderado", largo: 3 }, ...COMPARSAS.map((c) => ({ id: c.id, largo: c.largo })), { id: "cabana", largo: 6 }];

/** Cuánto va detrás de la cabeza cada unidad (tiles). */
export const DESFILE_ATRAS: readonly number[] = DESFILE_UNIDADES.map((_, k) => DESFILE_UNIDADES.slice(0, k).reduce((s, u) => s + u.largo, 0));
const CABANA = DESFILE_UNIDADES.length - 1;
const ATRAS_CABANA = DESFILE_ATRAS[CABANA]!;
const LARGO = ATRAS_CABANA + DESFILE_UNIDADES[CABANA]!.largo;

/** Las filas de la calle (y en tiles): las carrozas van por el carril exclusivo; los bailarines, por el mixto. */
export const DESFILE_Y = {
  /** El costado norte de las carrozas (pegado al cordón de la plataforma). */
  carroza: ROAD.y0 + 0.35,
  /** El abanderado, por la mitad del carril exclusivo. */
  abanderado: ROAD.y0 + 2,
  /** Los bailarines de las comparsas: dos filas en el carril mixto. */
  bailarines: [ROAD.laneY + 0.9, ROAD.laneY + 2.2],
  /** La gente de la cabaña: tres filas en el carril exclusivo, detrás del Megabús de la alegría. */
  cabana: [ROAD.y0 + 1.0, ROAD.y0 + 2.3, ROAD.y0 + 3.6],
} as const;

/** Dónde entra la cabeza (en el bosque del oeste). */
export const DESFILE_INICIO_X = ROAD.x0 - 3;
/** El portón: ahí llega el sendero del jardín a la vereda (la comparsa de la cabaña para enfrente). */
export const DESFILE_PORTON_X = 59;
/** El palco: frente a la Estación Hyvento. */
export const DESFILE_PALCO_X = 93;
/** La gente de la cabaña se baja a la vereda aquí (antes de que la calle se pierda en el bosque). */
export const DESFILE_BAJADA_X = 136;
/** Hasta dónde va la cabeza: la cola ya se perdió en el bosque del este. */
const FIN_X = ROAD.x1 + 2 + LARGO;

/** En las paradas, la comparsa de la cabaña queda frente al portón y luego frente al palco. */
export const DESFILE_PARADAS_X: readonly number[] = [DESFILE_PORTON_X + ATRAS_CABANA, DESFILE_PALCO_X + ATRAS_CABANA];

export interface DesfileTiming {
  /** Tiles por segundo. */
  velocidad: number;
  paradaMs: number;
}
export const DESFILE_TIMING: DesfileTiming = { velocidad: CARNAVAL.velocidad, paradaMs: CARNAVAL.paradaMs };

/** Los tramos del recorrido (caminando o parados), con su duración. */
function tramos(t: DesfileTiming) {
  const out: { desde: number; hasta: number; ms: number; parada: number | null }[] = [];
  let x = DESFILE_INICIO_X;
  DESFILE_PARADAS_X.forEach((px, i) => {
    out.push({ desde: x, hasta: px, ms: ((px - x) / t.velocidad) * 1000, parada: null });
    out.push({ desde: px, hasta: px, ms: t.paradaMs, parada: i });
    x = px;
  });
  out.push({ desde: x, hasta: FIN_X, ms: ((FIN_X - x) / t.velocidad) * 1000, parada: null });
  return out;
}

/** Lo que dura el desfile entero (ms). */
export const desfileDuracionMs = (t: DesfileTiming = DESFILE_TIMING) => tramos(t).reduce((s, x) => s + x.ms, 0);

export interface DesfileEstado {
  /** x (tiles) de la cabeza de la fila. */
  cabeza: number;
  /** En qué parada va (0 portón, 1 palco) o null caminando. */
  parada: number | null;
  /** Cuánto lleva en la parada (ms). */
  paradaMs: number;
  /** Ya pasó del todo. */
  fin: boolean;
}

/** Dónde va la fila a `ms` de empezado el desfile. */
export function desfileEstado(ms: number, t: DesfileTiming = DESFILE_TIMING): DesfileEstado {
  let left = Math.max(0, ms);
  for (const tr of tramos(t)) {
    if (left < tr.ms) {
      const k = tr.ms > 0 ? left / tr.ms : 1;
      return { cabeza: tr.desde + (tr.hasta - tr.desde) * k, parada: tr.parada, paradaMs: tr.parada === null ? 0 : left, fin: false };
    }
    left -= tr.ms;
  }
  return { cabeza: FIN_X, parada: null, paradaMs: 0, fin: true };
}

/** x (tiles) del frente de la unidad `k` con la cabeza en `cabeza`. */
export const unidadX = (k: number, cabeza: number) => cabeza - (DESFILE_ATRAS[k] ?? 0);

/** x del frente de la comparsa de la cabaña (justo detrás del Megabús de la alegría). */
export const cabanaX = (cabeza: number) => unidadX(CABANA, cabeza);

/** Índice de una carroza en la fila. */
export const unidadDe = (id: string) => DESFILE_UNIDADES.findIndex((u) => u.id === id);

/** El puesto de un bailarín de una comparsa (en el carril mixto, a la altura de su carroza). */
export function bailarinPuesto(k: number, i: number, cabeza: number): { x: number; y: number } {
  const x = unidadX(k, cabeza) - 0.8 - Math.floor(i / 2) * 1.5;
  return { x, y: DESFILE_Y.bailarines[i % 2]! };
}

/** El puesto de la persona `i` de la comparsa de la cabaña: de a tres por fila, detrás del Megabús. */
export function cabanaPuesto(i: number, cabeza: number): { x: number; y: number } {
  const fila = Math.floor(i / 3);
  return { x: cabanaX(cabeza) - 0.6 - fila * 1.3, y: DESFILE_Y.cabana[i % 3]! };
}

/** Cuándo (ms de desfile) la comparsa de la cabaña llega a la bajada: ahí se baja cada uno a la vereda. */
export function bajadaMs(t: DesfileTiming = DESFILE_TIMING): number {
  const cabeza = DESFILE_BAJADA_X + ATRAS_CABANA;
  let ms = 0;
  for (const tr of tramos(t)) {
    if (tr.parada === null && cabeza >= tr.desde && cabeza <= tr.hasta) return ms + ((cabeza - tr.desde) / t.velocidad) * 1000;
    ms += tr.ms;
  }
  return ms;
}

/** ¿Está en la calle (donde solo se va bailando en la comparsa)? */
export const enLaCalle = (y: number) => y >= ROAD.y0;
