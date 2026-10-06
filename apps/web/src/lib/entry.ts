// La pantalla de carga al entrar a la cabaña (EntryLoader): las etapas de verdad de la carga y cuánto
// pesa cada una en la barra, los consejos que van rotando y el momento del día y la estación de la escena.
// Todo puro (sin DOM ni reloj propio) para probarlo; el estado vive en game/entryStore.ts.
import { skyPhase, type Season, type SkyPhase } from "@hyvento/shared";

// ---------- Etapas ----------

/**
 * Lo que pasa al entrar, en orden. Varias corren a la par (el motor y el arte se bajan mientras se pide
 * el token y se conecta), pero la barra nombra la primera que falta. `weight` es cuánto de la barra le
 * toca y `tau` (ms) lo que suele tardar: sin avance medible, la etapa se arrima sola a su final.
 */
export const ENTRY_STAGES = [
  { id: "sesion", weight: 8, tau: 1200, label: "Buscando tu llave" },
  // El servidor de juego dormido (Render free) tarda hasta un minuto en arrancar: se consulta /health antes
  // de conectar. Despierto contesta enseguida y la etapa ni se nombra; dormida, no cuenta como "lenta".
  { id: "despertar", weight: 5, tau: 20_000, label: "Despertando el servidor (hasta ~1 min)", slowMs: 75_000 },
  { id: "conexion", weight: 17, tau: 2200, label: "Tocando la puerta" },
  { id: "motor", weight: 25, tau: 3500, label: "Encendiendo la chimenea" },
  { id: "arte", weight: 30, tau: 3000, label: "Colgando los cuadros" },
  { id: "mundo", weight: 15, tau: 1500, label: "Acomodando los muebles" },
  { id: "cuadro", weight: 5, tau: 600, label: "Abriendo la puerta" },
] as const;

export type EntryStageId = (typeof ENTRY_STAGES)[number]["id"];

export interface StageState {
  /** Cuándo empezó (ms). */
  startedAt?: number;
  /** Avance medido (0..1), si se sabe (el cargador de Phaser lo cuenta por archivo). */
  fraction?: number;
  /** Cuándo terminó (ms). */
  doneAt?: number;
}

export type EntryState = Partial<Record<EntryStageId, StageState>>;

/** Lo que llega a arrimarse una etapa sin terminar: la barra nunca da una etapa por hecha antes de tiempo. */
const STAGE_CAP = 0.95;
/** Hasta dónde llega el avance "a ojo" de una etapa que no se puede medir. */
const CREEP_CAP = 0.85;
/** Lo que se tarda la etapa actual para avisar que va lenta (con "Reintentar"). */
export const ENTRY_SLOW_MS = 12_000;

/** Lo que puede tardar una etapa antes de ofrecer "Reintentar" (despertar al servidor tiene su propio plazo). */
export function stageSlowMs(stage: (typeof ENTRY_STAGES)[number] | null): number {
  return stage && "slowMs" in stage ? stage.slowMs : ENTRY_SLOW_MS;
}

const TOTAL = ENTRY_STAGES.reduce((s, st) => s + st.weight, 0);

/** Cuánto de una etapa va (0..1) a la hora `now`. */
export function stageFraction(stage: (typeof ENTRY_STAGES)[number], st: StageState | undefined, now: number): number {
  if (!st?.startedAt && !st?.doneAt) return 0;
  if (st.doneAt) return 1;
  const elapsed = Math.max(0, now - (st.startedAt ?? now));
  const creep = CREEP_CAP * (1 - Math.exp(-elapsed / stage.tau));
  return Math.min(STAGE_CAP, Math.max(st.fraction ?? 0, creep));
}

/** Avance total de 0 a 100 (100 solo con todas las etapas terminadas). */
export function entryPercent(state: EntryState, now: number): number {
  if (entryDone(state)) return 100;
  let sum = 0;
  for (const stage of ENTRY_STAGES) sum += stage.weight * stageFraction(stage, state[stage.id], now);
  return Math.min(99, Math.floor((sum * 100) / TOTAL));
}

export const entryDone = (state: EntryState) => ENTRY_STAGES.every((s) => state[s.id]?.doneAt);

/** La etapa que se nombra: la primera que falta (null si ya está todo). */
export function currentStage(state: EntryState): (typeof ENTRY_STAGES)[number] | null {
  return ENTRY_STAGES.find((s) => !state[s.id]?.doneAt) ?? null;
}

/** Lo que muestra la barra: nunca vuelve atrás, aunque una etapa medida se reajuste. */
export const nextShown = (prev: number, target: number) => Math.max(prev, Math.min(100, Math.max(0, Math.round(target))));

// ---------- Consejos ----------

/** Consejos cortos de lo que hay en la cabaña (van rotando mientras carga). */
export const ENTRY_TIPS: readonly string[] = [
  "Acércate a algo con un rombito dorado y oprime E.",
  "Tab cambia la fila de la mochila y los números eligen lo que llevas en la mano.",
  "I abre la mochila: ahí se reordena, se tira y están tus logros.",
  "Con F usas lo de la mano: un tinto, un trago, la regadera…",
  "Escribe /hora en el chat para saber la hora del juego: un día dura una hora real.",
  "Dicen que el Man del Sombrero sale solo a ciertas horas, o con tormenta. Cada día se esconde en otro lado.",
  "El Megabús para afuera del portón cada ratico. Súbete y da una vuelta.",
  "La piscina está al este del patio. Con lluvia la tapan con la lona.",
  "La tina caliente y la sauna esperan en la orilla del lago, para cerrar el día.",
  "En el observatorio de la lomita, de noche, a veces pasa una estrella fugaz.",
  "En la granja las gallinas ponen al amanecer, y el molino muele más rápido con lluvia.",
  "Al final del pasillo del piso 3 está el estudio de grabación. Se graba solo si todos aceptan.",
  "El casino, el club, el cine y el arcade están en el sótano.",
  "En el muelle del lago se pesca. Algunos peces solo pican con lluvia o de madrugada.",
  "Tu oficina está en el piso 2. Puedes cerrarla con llave y decorarla a tu gusto.",
  "Todos los días hay una recompensa en el buzón del jardín.",
  "En las estufas de la planta baja se cocina con lo del huerto y la miel.",
  "Sube la escalera de cuerda del huerto: la casa del árbol tiene un pomodoro compartido.",
  "T abre los emotes, Enter el chat y P saca una foto.",
];

/** Orden de los consejos a partir de una semilla (barajados, sin repetir hasta dar la vuelta). */
export function tipOrder(seed: number, count = ENTRY_TIPS.length): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let h = (Math.floor(seed) | 0) || 1;
  for (let i = count - 1; i > 0; i--) {
    // xorshift: suficiente para barajar consejos.
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = (h >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** Cada cuánto cambia el consejo. */
export const TIP_MS = 4_000;

// ---------- La escena ----------

export interface EntryMood {
  phase: SkyPhase;
  season: Season;
  /** Minuto del día (0..1439) para poner el sol o la luna. */
  minuteOfDay: number;
}

/**
 * Cómo se ve el camino: el momento del día del reloj del juego si ya llegó (si no, la hora local del
 * navegador) y la estación del calendario del juego (ver `currentSeason`).
 */
export function entryMood(season: Season, gameMinute: number | null, localMinute: number): EntryMood {
  const minuteOfDay = ((Math.floor(gameMinute ?? localMinute) % 1440) + 1440) % 1440;
  return { phase: skyPhase(minuteOfDay), season, minuteOfDay };
}

/**
 * El sol (de 5:00 a 19:00) o la luna (de 19:00 a 5:00) en su arco, como en el reloj del HUD: `t` va de 0
 * (sale por la izquierda) a 1 (se pone por la derecha).
 */
export function skyArc(minuteOfDay: number): { kind: "sun" | "moon"; t: number } {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  if (m >= 5 * 60 && m < 19 * 60) return { kind: "sun", t: (m - 5 * 60) / (14 * 60) };
  return { kind: "moon", t: (((m - 19 * 60) % 1440) + 1440) % 1440 / (10 * 60) };
}
