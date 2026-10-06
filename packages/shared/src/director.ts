// El panel del director (VIR-175): quien tiene el permiso `director` (los admins siempre) cambia lo que se ve
// en la cabaña sin esperar el calendario: prende un festival, fija el clima, mueve la hora o salta a un día
// del calendario del juego, y dispara momentos (el desfile del Carnaval, repetir la apertura…). Aquí solo
// los mensajes, las reglas puras del reloj y el registro de momentos; la sala valida y hace cada cosa
// (apps/server/src/rooms/director.ts) y cada cambio sale en el chat global para que todos entiendan qué pasó.
import { z } from "zod";
import { DIAS_POR_AÑO, DIAS_POR_ESTACION, fechaCorta, fechaDelJuego } from "./calendario";
import { formatGameTime, gameMinutes, gameTime, GAME_MINUTES_PER_DAY, type GameClockState } from "./clock";
import { SEASONS, SEASON_TEXT, type Season } from "./estaciones";
import { FESTIVAL_HORAS, FESTIVAL_IDS, festivalById, type FestivalId } from "./festivales";
import { WEATHERS, WEATHER_TEXT, type Weather } from "./weather";
import { PIEZAS, type PiezaId } from "./carnaval-musica";

export const DIRECTOR_MSG = {
  /** Cliente → servidor: `DirectorAction`. */
  action: "director:action",
  /** Servidor → quien lo pidió: `DirectorResult`. */
  result: "director:result",
  /** Servidor → todos: `DirectorMusica` (la pieza que puso el director para todos, o null para pararla). */
  musica: "director:musica",
} as const;

/** Cuánto puede durar un clima fijado (minutos reales); sin duración, hasta "Volver al clima natural". */
export const DIRECTOR_CLIMA_MINUTOS = [10, 30, 60] as const;
export const DIRECTOR_CLIMA_MAX_MIN = 240;

/** Atajos de hora (minuto del día del juego). */
export const DIRECTOR_HORAS = [
  { id: "amanecer", nombre: "Amanecer", minuto: 6 * 60 },
  { id: "mediodia", nombre: "Mediodía", minuto: 12 * 60 },
  { id: "atardecer", nombre: "Atardecer", minuto: 18 * 60 },
  { id: "noche", nombre: "Noche", minuto: 20 * 60 },
  { id: "medianoche", nombre: "Medianoche", minuto: 0 },
] as const;

/** A qué hora se llega al día de un festival: una hora después de que abre, con la fiesta andando. */
export const DIRECTOR_HORA_FIESTA = (FESTIVAL_HORAS.apertura + 1) * 60;

export const DirectorAction = z.discriminatedUnion("kind", [
  /** Prender un festival ya (`id`) o volver al calendario (`null`). */
  z.object({ kind: z.literal("festival"), id: z.enum(FESTIVAL_IDS).nullable() }),
  /** Fijar un clima (`minutes` reales, o hasta volver al natural) o volver al natural (`null`). */
  z.object({ kind: z.literal("clima"), weather: z.enum(WEATHERS).nullable(), minutes: z.number().int().min(1).max(DIRECTOR_CLIMA_MAX_MIN).optional() }),
  /** Poner la hora (siempre hacia adelante: si ya pasó hoy, la de mañana). */
  z.object({ kind: z.literal("hora"), minuteOfDay: z.number().int().min(0).max(GAME_MINUTES_PER_DAY - 1) }),
  /** Adelantar el reloj. */
  z.object({ kind: z.literal("adelantar"), minutes: z.number().int().min(1).max(GAME_MINUTES_PER_DAY) }),
  /** Saltar a un día del calendario (el próximo con esa fecha). */
  z.object({ kind: z.literal("dia"), estacion: z.enum(SEASONS), dia: z.number().int().min(1).max(DIAS_POR_ESTACION) }),
  /** Saltar al primer día de una estación. */
  z.object({ kind: z.literal("estacion"), estacion: z.enum(SEASONS) }),
  /** Saltar al día de un festival, con la fiesta abierta. */
  z.object({ kind: z.literal("irFestival"), id: z.enum(FESTIVAL_IDS) }),
  /** Disparar un momento del registro (`DIRECTOR_ACCIONES`). */
  z.object({ kind: z.literal("momento"), id: z.string().min(1).max(64) }),
  /** Poner a sonar una pieza de la música del Carnaval para todos (`null` la para). */
  z.object({ kind: z.literal("musica"), pieza: z.enum(PIEZAS).nullable(), nombre: z.string().max(60).optional() }),
]);
export type DirectorAction = z.infer<typeof DirectorAction>;

/** La música que puso el director para todos (null = que pare). */
export interface DirectorMusica {
  pieza: PiezaId | null;
}

/** Por qué no se hizo. */
export type DirectorError =
  | "permiso" // no tiene el permiso `director`
  | "nieve" // nieve fuera del invierno
  | "nada" // ya estaba así
  | "festival" // el momento pide su festival prendido (`festival` dice cuál)
  | "cerrado" // el festival está prendido pero fuera de su horario (9:00 a 22:00)
  | "ocupado" // ya está pasando (el desfile en la calle…)
  | "desconocido"; // momento que no existe

export interface DirectorResult {
  ok: boolean;
  /** Qué pasó, para el aviso del panel. */
  texto: string;
  error?: DirectorError;
  /** Con `festival`: cuál hay que prender para poder hacerlo. */
  festival?: FestivalId;
}

// ---------- El registro de momentos ----------

/**
 * Un momento que el director puede disparar. El panel los muestra todos; la sala registra el manejador de
 * cada uno (`Director.registrar` en apps/server/src/rooms/director.ts). Un festival nuevo agrega aquí los
 * suyos (con `festival`, solo se puede con ese festival prendido) y registra su manejador en la sala.
 */
export interface DirectorAccionDef {
  id: string;
  nombre: string;
  descripcion: string;
  /** Solo con este festival prendido (el panel ofrece prenderlo primero). */
  festival?: FestivalId;
  /** Pide algún festival prendido (cualquiera). */
  conFestival?: boolean;
  /** El aviso del chat global; `{nombre}` es quien lo hizo y `{festival}` el festival de ahora. */
  aviso: string;
}

export const DIRECTOR_ACCIONES: readonly DirectorAccionDef[] = [
  {
    id: "apertura",
    nombre: "Repetir la apertura",
    descripcion: "La cinemática de apertura del festival de ahora, para todos.",
    conFestival: true,
    aviso: "{nombre} repitió la apertura de {festival}.",
  },
  {
    id: "carnaval-desfile",
    nombre: "El desfile del Carnaval ya",
    descripcion: "Sale ya el desfile por la calle del Megabús, sin esperar su hora.",
    festival: "carnaval",
    aviso: "{nombre} sacó el desfile del Carnaval a la calle.",
  },
  // El Año viejo (rooms/anoViejo.ts): lo que tiene hora, sin esperarla.
  {
    id: "ano-viejo-uvas",
    nombre: "Las campanadas de las uvas ya",
    descripcion: "Suenan ya las doce campanadas del Año viejo, para comerse las uvas.",
    festival: "ano-viejo",
    aviso: "{nombre} puso a sonar las campanadas de las uvas.",
  },
  {
    id: "ano-viejo-quema",
    nombre: "La quema del muñeco ya",
    descripcion: "Se quema ya el muñeco de año viejo en el brasero, con su cinemática y las luces de colores.",
    festival: "ano-viejo",
    aviso: "{nombre} prendió el muñeco de año viejo.",
  },
  {
    id: "ano-viejo-cuenta",
    nombre: "La cuenta regresiva ya",
    descripcion: "La cuenta regresiva del año nuevo: cuentan las lentejas y la ropa amarilla, el abrazo y el resumen del año.",
    festival: "ano-viejo",
    aviso: "{nombre} arrancó la cuenta regresiva del año nuevo.",
  },
  {
    id: "cometas-primera",
    nombre: "La primera cometa del día",
    descripcion: "Los niños llegan corriendo a la loma a celebrar la primera cometa en el aire (para los del jardín).",
    festival: "cometas",
    aviso: "{nombre} repitió la celebración de la primera cometa.",
  },
  {
    id: "cometas-premiacion",
    nombre: "La premiación de las cometas ya",
    descripcion: "La premiación con la más alta y la más bonita de ahora, para todos. Los premios se pagan al cierre.",
    festival: "cometas",
    aviso: "{nombre} adelantó la premiación de las cometas.",
  },
  {
    id: "amor-sorteo",
    nombre: "El sorteo del amigo secreto ya",
    descripcion: "Sortea ya a los anotados en el cofre, sin esperar las 10:00 del juego.",
    festival: "amor-amistad",
    aviso: "{nombre} hizo ya el sorteo del amigo secreto.",
  },
  {
    id: "amor-revelacion",
    nombre: "Revelar el amigo secreto",
    descripcion: "Cupido dice quién le dio a quién, sin esperar el cierre (una vez por festival).",
    festival: "amor-amistad",
    aviso: "{nombre} reveló el amigo secreto antes del cierre.",
  },
];

export const directorAccion = (id: string) => DIRECTOR_ACCIONES.find((a) => a.id === id);

// ---------- El reloj ----------

const conPausa = (c: GameClockState, anchorReal: number, anchorMinute: number): GameClockState =>
  c.paused ? { anchorReal, anchorMinute, paused: true } : { anchorReal, anchorMinute };

/** Día del año (0..83) de una fecha del calendario. */
export const diaDelAñoDe = (estacion: Season, dia: number) => SEASONS.indexOf(estacion) * DIAS_POR_ESTACION + (dia - 1);

/**
 * Salta al próximo día con esa fecha (nunca para atrás), a la misma hora del día. Null si hoy ya es ese día.
 */
export function irAlDia(c: GameClockState, now: number, estacion: Season, dia: number): GameClockState | null {
  const t = gameTime(c, now);
  const delta = (diaDelAñoDe(estacion, dia) - (t.day % DIAS_POR_AÑO) + DIAS_POR_AÑO) % DIAS_POR_AÑO;
  if (delta === 0) return null;
  const actual = gameMinutes(c, now);
  return conPausa(c, now, actual + delta * GAME_MINUTES_PER_DAY);
}

/** Salta al primer día de la estación (null si ya es esa estación). */
export function irAEstacion(c: GameClockState, now: number, estacion: Season): GameClockState | null {
  if (fechaDelJuego(gameTime(c, now).day).estacion === estacion) return null;
  return irAlDia(c, now, estacion, 1);
}

/**
 * Salta al día del festival con la fiesta abierta (a las 10:00). Si hoy es uno de sus días y todavía no
 * abre, solo adelanta la hora; si ya está abierto, null; si ya cerró, el día siguiente del festival (o el
 * del año que viene).
 */
export function irAlFestival(c: GameClockState, now: number, id: FestivalId): GameClockState | null {
  const f = festivalById(id)!;
  const t = gameTime(c, now);
  for (let delta = 0; delta <= DIAS_POR_AÑO; delta++) {
    const fecha = fechaDelJuego(t.day + delta);
    if (fecha.estacion !== f.estacion || fecha.diaDeEstacion < f.dia || fecha.diaDeEstacion >= f.dia + f.dias) continue;
    if (delta === 0) {
      if (t.minuteOfDay >= FESTIVAL_HORAS.cierre * 60) continue;
      if (t.minuteOfDay >= FESTIVAL_HORAS.apertura * 60) return null;
    }
    return conPausa(c, now, (t.day + delta) * GAME_MINUTES_PER_DAY + DIRECTOR_HORA_FIESTA);
  }
  return null;
}

// ---------- Los avisos ----------

/** "Lun 3 de Otoño, 10:00": cómo quedó el reloj (para el aviso). */
export function relojTexto(c: GameClockState, now: number): string {
  const t = gameTime(c, now);
  return `${fechaCorta(fechaDelJuego(t.day))}, ${formatGameTime(t.minuteOfDay)}`;
}

const llenar = (plantilla: string, vars: Record<string, string>) => plantilla.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

/**
 * El aviso del chat global de lo que hizo el director (`reloj`: cómo quedó el reloj, para lo que lo mueve;
 * `festival`: el nombre del festival de ahora, para los momentos).
 */
export function directorAviso(nombre: string, a: DirectorAction, extra: { reloj?: string; festival?: string } = {}): string {
  switch (a.kind) {
    case "festival":
      return a.id ? `${nombre} prendió ${festivalById(a.id)!.nombre}.` : `${nombre} devolvió los festivales al calendario.`;
    case "clima":
      if (!a.weather) return `${nombre} devolvió el clima a lo natural.`;
      return `${nombre} cambió el clima a ${WEATHER_TEXT[a.weather].toLowerCase()}${a.minutes ? ` por ${a.minutes} minutos` : ""}.`;
    case "hora":
    case "adelantar":
    case "dia":
      return `${nombre} movió el reloj de la cabaña: ${extra.reloj ?? ""}.`;
    case "estacion":
      return `${nombre} adelantó el calendario hasta ${SEASON_TEXT[a.estacion].toLowerCase()}: ${extra.reloj ?? ""}.`;
    case "irFestival":
      return `${nombre} adelantó el calendario hasta ${festivalById(a.id)!.nombre}: ${extra.reloj ?? ""}.`;
    case "musica":
      return a.pieza ? `${nombre} puso a sonar ${a.nombre ?? "música del Carnaval"} para todos.` : `${nombre} paró la música.`;
    case "momento": {
      const def = directorAccion(a.id);
      return def ? llenar(def.aviso, { nombre, festival: extra.festival ?? "el festival" }) : `${nombre} hizo algo en la cabaña.`;
    }
  }
}

/** ¿Se puede fijar ese clima en esa estación? (solo nieva en invierno). */
export const climaPermitido = (w: Weather, estacion: Season) => w !== "nieve" || estacion === "invierno";
