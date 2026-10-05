// El calendario del juego, como el de Stardew Valley pero nuestro: cada estación dura 21 días del juego
// (3 semanas de 7) y el año, 84. El día sale del reloj del juego (`gameTime(clock, now).day`, ver clock.ts),
// así que la estación la ven todos igual y, como el reloj solo corre con gente adentro, no se pasan las
// estaciones sin nadie. Los días de puntos, las rachas y los cumpleaños siguen siendo los reales (Bogotá).
import { gameTime, type GameClockState } from "./clock";
import { SEASONS, SEASON_TEXT, type Season } from "./estaciones";
import { festivalesDe } from "./festivales";

export const DIAS_POR_SEMANA = 7;
export const SEMANAS_POR_ESTACION = 3;
export const DIAS_POR_ESTACION = DIAS_POR_SEMANA * SEMANAS_POR_ESTACION;
export const DIAS_POR_AÑO = DIAS_POR_ESTACION * SEASONS.length;

export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;
export type DiaSemana = (typeof DIAS_SEMANA)[number];
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export interface FechaDelJuego {
  /** Año del juego, desde 1. */
  año: number;
  estacion: Season;
  /** Día de la estación, 1..21. */
  diaDeEstacion: number;
  /** Semana de la estación, 1..3. */
  semana: number;
  /** 0 = lunes … 6 = domingo (cada estación empieza en lunes). */
  diaSemana: number;
  nombreDia: DiaSemana;
  /** Día del año, 0..83. */
  diaDelAño: number;
}

/** La fecha del día `dia` del juego (0, 1, 2…, el de `gameTime`). */
export function fechaDelJuego(dia: number): FechaDelJuego {
  const d = Math.max(0, Math.floor(dia));
  const diaDelAño = d % DIAS_POR_AÑO;
  const i = Math.floor(diaDelAño / DIAS_POR_ESTACION);
  const enEstacion = diaDelAño - i * DIAS_POR_ESTACION;
  const diaSemana = enEstacion % DIAS_POR_SEMANA;
  return {
    año: Math.floor(d / DIAS_POR_AÑO) + 1,
    estacion: SEASONS[i]!,
    diaDeEstacion: enEstacion + 1,
    semana: Math.floor(enEstacion / DIAS_POR_SEMANA) + 1,
    diaSemana,
    nombreDia: DIAS_SEMANA[diaSemana]!,
    diaDelAño,
  };
}

/** La estación del día `dia` del juego. */
export const estacionDelDia = (dia: number): Season => fechaDelJuego(dia).estacion;

/** La estación del reloj del juego en `now`. */
export const estacionDelJuego = (clock: GameClockState, now: number): Season => estacionDelDia(gameTime(clock, now).day);

/** "Lun 3 de Otoño". */
export function fechaCorta(f: FechaDelJuego): string {
  return `${DIAS_CORTOS[f.diaSemana]} ${f.diaDeEstacion} de ${SEASON_TEXT[f.estacion]}`;
}

/** "Lun 3 · Otoño" (la placa del reloj, donde cabe poco). */
export function fechaPlaca(f: FechaDelJuego): string {
  return `${DIAS_CORTOS[f.diaSemana]} ${f.diaDeEstacion} · ${SEASON_TEXT[f.estacion]}`;
}

/** "año 2". */
export const añoTexto = (f: FechaDelJuego) => `año ${f.año}`;

/** Nombre corto de un día de la semana (0 = lunes): "Lun". */
export const diaCorto = (diaSemana: number) => DIAS_CORTOS[((diaSemana % 7) + 7) % 7]!;

// ---------- Lo que se marca en el calendario ----------

/** Algo marcado en un día de la estación: un festival o el cumpleaños de alguien. */
export interface MarcaCalendario {
  /** Día de la estación, 1..21. */
  dia: number;
  tipo: "festival" | "cumpleaños";
  texto: string;
}

/** Las marcas fijas (festivales) de una estación: cada día que dura (las novenas, sus nueve noches). */
export function calendarMarks(estacion: Season): MarcaCalendario[] {
  return festivalesDe(estacion).flatMap((f) =>
    Array.from({ length: f.dias }, (_, i) => ({ dia: f.dia + i, tipo: "festival" as const, texto: f.dias > 1 ? `${f.nombre} (${i + 1}/${f.dias})` : f.nombre })),
  );
}

// El año real (365 días, sin el 29 de febrero) cae entero en el año del juego (84 días), corrido para que
// las estaciones coincidan con las del hemisferio norte: el 1 de marzo es el 1 de primavera, el 1 de junio
// cae a comienzos del verano, septiembre en otoño y diciembre en invierno.
const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const INICIO_MES = DIAS_MES.map((_, m) => DIAS_MES.slice(0, m).reduce((a, b) => a + b, 0));
const PRIMERO_MARZO = INICIO_MES[2]!;

/**
 * Día del año del juego (0..83) en que cae una fecha real ("MM-DD", como los cumpleaños), o null si no es
 * una fecha. Varios días reales caen en el mismo del juego (son ~4,3 por cada uno).
 */
export function diaDelJuegoDeFecha(mmdd: string): number | null {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!m) return null;
  const mes = Number(m[1]) - 1;
  const dia = Number(m[2]);
  if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return null;
  // El 29 de febrero cae con el 28.
  const doy = INICIO_MES[mes]! + Math.min(dia, DIAS_MES[mes]!) - 1;
  const desdeMarzo = (doy - PRIMERO_MARZO + 365) % 365;
  return Math.floor((desdeMarzo * DIAS_POR_AÑO) / 365);
}

/** Los cumpleaños ("MM-DD") que caen en una estación del juego, como marcas del calendario. */
export function cumpleañosEnEstacion(people: readonly { name: string; birthday: string }[], estacion: Season): MarcaCalendario[] {
  const inicio = SEASONS.indexOf(estacion) * DIAS_POR_ESTACION;
  const out: MarcaCalendario[] = [];
  for (const p of people) {
    const d = diaDelJuegoDeFecha(p.birthday);
    if (d === null || d < inicio || d >= inicio + DIAS_POR_ESTACION) continue;
    out.push({ dia: d - inicio + 1, tipo: "cumpleaños", texto: `Cumpleaños de ${p.name}` });
  }
  return out.sort((a, b) => a.dia - b.dia);
}
