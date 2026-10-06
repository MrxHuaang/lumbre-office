// El Desfile Magno del Carnaval por la calle del Megabús (docs/plan-carnaval.md): dónde va cada carroza,
// cada bailarín de su comparsa grande, cada músico de las murgas, cada disfraz y la gente de la cabaña que
// se sumó, a tantos ms de empezado. Sale una sola vez por Carnaval y va despacio (unos 17 minutos reales):
// la fila es más larga que la calle y va pasando, de oeste a este por el carril exclusivo
// (world/areas/parada.ts); sale del bosque, para dos veces frente al palco de la Estación Hyvento y se
// pierde en el bosque del este. La cabeza (Don Evelio de abanderado) marca el paso y el resto va detrás a
// su distancia; en las paradas para toda la fila. Puro (en tiles del nivel `jardin`): lo usan la sala (para
// mover a quien baila) y el navegador (para dibujarlo con la hora del servidor), así todos lo ven igual.
import { CARNAVAL, COMPARSAS, DESFILE_ORDEN, disfracesById, musicosDe, type CarrozaId } from "@hyvento/shared";
import { ROAD } from "./world/areas/parada";

/** Lo largo de cada carroza en la calle (tiles; el dibujo cabe ahí, un test lo revisa). */
export const CARROZA_TILES: Record<CarrozaId, number> = { castaneda: 6.6, condor: 7.2, galeras: 6.6, tablero: 6.6, reloj: 8.2, luna: 6.6, paramo: 6.6, minga: 6.6, tinto: 6.6, megabus: 8.4, jaguar: 7, leon: 7, amaru: 7.0, oso: 7.0, mariposa: 7.0, rana: 7.0 };

/** Los bailarines de una comparsa grande van en columnas de a tres por el carril mixto. */
const COMPARSA_FILAS = 3;
const COMPARSA_PASO = 1.4;
/** Detrás de cada carroza queda un hueco en el carril exclusivo: ahí baila la gente de la cabaña que se suma. */
const HUECO = 3.2;

/** Lo que va en la fila, en orden: el abanderado, las carrozas con su comparsa, las murgas, los disfraces y la cabaña. */
export type DesfileUnidad =
  | { id: "abanderado"; tipo: "abanderado"; largo: number }
  | { id: CarrozaId; tipo: "carroza"; largo: number }
  | { id: string; tipo: "murga" | "disfraces"; largo: number; cuantos: number }
  | { id: "cabana"; tipo: "cabana"; largo: number };

function largoCarroza(id: CarrozaId) {
  const c = COMPARSAS.find((x) => x.id === id);
  const cols = Math.ceil((c?.bailarines.length ?? 0) / COMPARSA_FILAS);
  return Math.max(CARROZA_TILES[id], 0.8 + cols * COMPARSA_PASO) + HUECO;
}

export const DESFILE_UNIDADES: readonly DesfileUnidad[] = [
  { id: "abanderado", tipo: "abanderado", largo: 3 },
  ...DESFILE_ORDEN.map((it): DesfileUnidad => {
    if (it.tipo === "carroza") return { id: it.id, tipo: "carroza", largo: largoCarroza(it.id) };
    if (it.tipo === "murga") {
      const n = musicosDe(it.id).length;
      return { id: it.id, tipo: "murga", largo: 1.2 + Math.ceil(n / 2) * 1.6, cuantos: n };
    }
    const n = disfracesById(it.id)?.personajes.length ?? 0;
    return { id: it.id, tipo: "disfraces", largo: 1.6 + n * 2.3, cuantos: n };
  }),
  { id: "cabana", tipo: "cabana", largo: 6 },
];

/** Cuánto va detrás de la cabeza cada unidad (tiles). */
export const DESFILE_ATRAS: readonly number[] = DESFILE_UNIDADES.map((_, k) => DESFILE_UNIDADES.slice(0, k).reduce((s, u) => s + u.largo, 0));
const CABANA = DESFILE_UNIDADES.length - 1;
const ATRAS_CABANA = DESFILE_ATRAS[CABANA]!;
/** Lo largo de la fila entera (tiles). */
export const DESFILE_LARGO = ATRAS_CABANA + DESFILE_UNIDADES[CABANA]!.largo;

/** Las filas de la calle (y en tiles): las carrozas y la gente van por el carril exclusivo; las comparsas, por el mixto. */
export const DESFILE_Y = {
  /** El costado norte de las carrozas (pegado al cordón de la plataforma). */
  carroza: ROAD.y0 + 0.35,
  /** El abanderado, por la mitad del carril exclusivo. */
  abanderado: ROAD.y0 + 2,
  /** Los bailarines de las comparsas: tres filas en el carril mixto. */
  bailarines: [ROAD.laneY + 0.7, ROAD.laneY + 1.6, ROAD.laneY + 2.5],
  /** Las murgas, en dos filas por el carril exclusivo. */
  murga: [ROAD.y0 + 1.2, ROAD.y0 + 2.7],
  /** Los disfraces individuales, de lado a lado de la calle. */
  disfraces: [ROAD.y0 + 1.9, ROAD.laneY + 1.5, ROAD.y0 + 3.2],
  /** La gente de la cabaña: tres filas en el carril exclusivo. */
  cabana: [ROAD.y0 + 1.0, ROAD.y0 + 2.3, ROAD.y0 + 3.6],
} as const;

/** Dónde entra la cabeza (en el bosque del oeste). */
export const DESFILE_INICIO_X = ROAD.x0 - 3;
/** El portón: ahí llega el sendero del jardín a la vereda. */
export const DESFILE_PORTON_X = 59;
/** El palco: frente a la Estación Hyvento. */
export const DESFILE_PALCO_X = 93;
/** La gente de la cabaña se baja a la vereda aquí (antes de que la calle se pierda en el bosque). */
export const DESFILE_BAJADA_X = 136;
/** Hasta dónde va la cabeza: la cola ya se perdió en el bosque del este. */
const FIN_X = ROAD.x1 + 2 + DESFILE_LARGO;

/**
 * Las dos paradas: cuando el primer tercio de la fila y luego el último pasan frente al palco, toda la fila
 * para y cada comparsa repite su frase donde va.
 */
export const DESFILE_PARADAS_X: readonly number[] = [DESFILE_PALCO_X + DESFILE_LARGO * 0.3, DESFILE_PALCO_X + DESFILE_LARGO * 0.75];

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
  /** En qué parada va (0 o 1) o null caminando. */
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
    // Con un margen de un microsegundo: restar los tramos uno a uno no da exacto lo que suma
    // `desfileDuracionMs`, y al final del recorrido la fila tiene que quedar terminada.
    if (left < tr.ms - 1e-3) {
      const k = tr.ms > 0 ? left / tr.ms : 1;
      return { cabeza: tr.desde + (tr.hasta - tr.desde) * k, parada: tr.parada, paradaMs: tr.parada === null ? 0 : left, fin: false };
    }
    left -= tr.ms;
  }
  return { cabeza: FIN_X, parada: null, paradaMs: 0, fin: true };
}

/** x (tiles) del frente de la unidad `k` con la cabeza en `cabeza`. */
export const unidadX = (k: number, cabeza: number) => cabeza - (DESFILE_ATRAS[k] ?? 0);

/** x del frente de la comparsa de la cabaña (al final de la fila, detrás del Megabús de la alegría). */
export const cabanaX = (cabeza: number) => unidadX(CABANA, cabeza);

/** Índice de una unidad en la fila. */
export const unidadDe = (id: string) => DESFILE_UNIDADES.findIndex((u) => u.id === id);

/**
 * El puesto de la persona `i` de la unidad `k`: los bailarines de una comparsa en columnas de a tres por el
 * carril mixto, junto a su carroza; los músicos de una murga en dos filas; los disfraces en diagonal.
 */
export function bailarinPuesto(k: number, i: number, cabeza: number): { x: number; y: number } {
  const u = DESFILE_UNIDADES[k];
  const x0 = unidadX(k, cabeza);
  if (u?.tipo === "murga") return { x: x0 - 0.8 - Math.floor(i / 2) * 1.6, y: DESFILE_Y.murga[i % 2]! };
  if (u?.tipo === "disfraces") return { x: x0 - 1.2 - i * 2.3, y: DESFILE_Y.disfraces[i % 3]! };
  return { x: x0 - 0.8 - Math.floor(i / COMPARSA_FILAS) * COMPARSA_PASO, y: DESFILE_Y.bailarines[i % COMPARSA_FILAS]! };
}

/** El puesto de la persona `i` de la comparsa de la cabaña (la del final): de a tres por fila. */
export function cabanaPuesto(i: number, cabeza: number): { x: number; y: number } {
  const fila = Math.floor(i / 3);
  return { x: cabanaX(cabeza) - 0.6 - fila * 1.3, y: DESFILE_Y.cabana[i % 3]! };
}

/** ¿Pasa el desfile por esa x (tiles) ahora? (entre la cabeza y la cola, antes de la bajada). */
export const filaEn = (x: number, cabeza: number) => x <= cabeza + 1 && x >= cabeza - DESFILE_LARGO && x < DESFILE_BAJADA_X - 2;

/**
 * Dónde baila quien se suma desde la vereda en `x`: en el hueco del carril exclusivo detrás de la carroza
 * que pasa por ahí (o al final de la murga o de los disfraces). Devuelve cuánto va detrás de la cabeza.
 */
export function atrasParaSumarse(x: number, cabeza: number): number {
  const a = Math.max(DESFILE_ATRAS[1]!, Math.min(DESFILE_LARGO - 0.5, cabeza - x));
  let k = DESFILE_ATRAS.findIndex((at, j) => a >= at && a < at + DESFILE_UNIDADES[j]!.largo);
  if (k < 0) k = CABANA;
  const u = DESFILE_UNIDADES[k]!;
  const at = DESFILE_ATRAS[k]!;
  if (u.tipo === "carroza") return Math.min(at + u.largo - 0.4, Math.max(a, at + CARROZA_TILES[u.id] + 0.6));
  if (u.tipo === "cabana") return Math.max(a, at + 0.6);
  return at + u.largo - 0.3;
}

/** El puesto de alguien de la cabaña que va `atras` de la cabeza, en su fila (0..2). */
export const sumadoPuesto = (atras: number, fila: number, cabeza: number) => ({ x: cabeza - atras, y: DESFILE_Y.cabana[((fila % 3) + 3) % 3]! });

/** Cuándo (ms de desfile) la comparsa de la cabaña llega a la bajada. */
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
