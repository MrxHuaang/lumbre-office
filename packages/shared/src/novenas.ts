// Las Novenas de aguinaldo (VIR-159, docs/plan-festivales.md): nueve días del juego (del 12 al 20 del
// invierno) con el pesebre del recibidor que se arma entre todos (una figura por día, la pone el primero
// que llega con E), la novena que se reza a las 20:00 del juego junto al pesebre (con su cinemática y sus
// villancicos, escritos para la cabaña) y la natilla y los buñuelos de temporada en la cocina (cocina.ts).
// Los aguinaldos (los juegos entre dos) están en aguinaldos.ts. Aquí solo los datos y las reglas puras;
// la sala está en apps/server/src/rooms/novenas.ts.
import { z } from "zod";
import type { CineDef, CineStep } from "./cinematicas";

export const NOVENAS_FESTIVAL = "novenas";

/** Las figuras del pesebre, en el orden en que llegan (una por día de la novena). */
export const PESEBRE_FIGURAS = [
  { id: "establo", name: "El establo" },
  { id: "virgen", name: "La Virgen" },
  { id: "jose", name: "San José" },
  { id: "mula", name: "La mula" },
  { id: "buey", name: "El buey" },
  { id: "pastores", name: "Los pastores" },
  { id: "estrella", name: "La estrella" },
  { id: "reyes", name: "Los Reyes Magos" },
  { id: "nino", name: "El Niño" },
] as const;
export type PesebreFigura = (typeof PESEBRE_FIGURAS)[number]["id"];

export const NOVENA = {
  /** Días que dura (los de la novena, como en FESTIVALES) y el primero, del invierno. */
  dias: PESEBRE_FIGURAS.length,
  primerDia: 12,
  area: "planta-baja",
  /**
   * El pesebre: contra la pared oeste del recibidor, entre las dos puertas, abierto hacia la alfombra. Es
   * el mueble de 2x1 mirando hacia abajo (el espejo: queda de 1x2 a lo largo de y).
   */
  pesebre: { x: 11, y: 20, w: 1, d: 2, facing: "down" },
  /** Hasta dónde llega la mano para poner la figura (tiles desde el borde del pesebre). */
  reachTiles: 1.5,
  /** La novena: se reza a las 20:00 del juego y se puede llegar hasta las 21:00 (2,5 minutos reales). */
  hora: 20,
  hasta: 21,
  /** Quiénes rezan: los del recibidor a esta distancia del pesebre (tiles). */
  rezoTiles: 6,
  /** Puntos por rezar la novena (LEISURE, con su tope), una vez por día de la novena. */
  puntos: 5,
  /** Puntos por poner la figura del día (LEISURE): el primero que llega. */
  puntosFigura: 3,
  /** Prefijo del refId de los puntos de la novena (uno por día del juego: no se cobra dos veces). */
  refPrefix: "novena:",
  /** Fila de WorldLayout donde se guarda la figura de hoy (sin migración, como `__reloj__`). */
  fila: "__pesebre__",
} as const;

/** El día de la novena (1..9) para un día de la estación, o 0 si no cae en la novena. */
export function novenaDia(diaDeEstacion: number): number {
  const d = diaDeEstacion - NOVENA.primerDia + 1;
  return d >= 1 && d <= NOVENA.dias ? d : 0;
}

/** La figura que se pone ese día de la novena (1..9). */
export const figuraDelDia = (dia: number) => PESEBRE_FIGURAS[Math.min(NOVENA.dias, Math.max(1, dia)) - 1]!;

/**
 * Cuántas figuras tiene el pesebre: las de los días que ya pasaron siempre (si nadie llegó, Doña Aurora las
 * puso al cerrar), más la de hoy si ya la pusieron.
 */
export const figurasVisibles = (dia: number, puestaHoy: boolean) => Math.max(0, Math.min(NOVENA.dias, dia - 1 + (puestaHoy ? 1 : 0)));

/** Distancia (en tiles) de un punto del mundo (px) al rectángulo del pesebre. */
function tilesToPesebre(x: number, y: number, tileSize: number): number {
  const { x: px, y: py, w, d } = NOVENA.pesebre;
  const tx = x / tileSize;
  const ty = y / tileSize;
  const dx = Math.max(px - tx, 0, tx - (px + w));
  const dy = Math.max(py - ty, 0, ty - (py + d));
  return Math.hypot(dx, dy);
}

/** ¿Alcanza el pesebre desde ahí? (para poner la figura; lo valida el servidor). */
export const nearPesebre = (p: { area: string; x: number; y: number }, tileSize: number) =>
  p.area === NOVENA.area && tilesToPesebre(p.x, p.y, tileSize) <= NOVENA.reachTiles;

/** ¿Está rezando la novena desde ahí? */
export const atNovena = (p: { area: string; x: number; y: number }, tileSize: number) =>
  p.area === NOVENA.area && tilesToPesebre(p.x, p.y, tileSize) <= NOVENA.rezoTiles;

/** ¿Es la hora de la novena (minuto del día del juego)? */
export const horaDeNovena = (minuteOfDay: number) => minuteOfDay >= NOVENA.hora * 60 && minuteOfDay < NOVENA.hasta * 60;

/** Lo que se guarda en la fila del pesebre: el día del juego y quién puso la figura de ese día. */
export const PesebreGuardado = z.object({ day: z.number().int(), by: z.string(), name: z.string() });
export type PesebreGuardado = z.infer<typeof PesebreGuardado>;

// ---------- Mensajes ----------

export const NOVENA_MSG = {
  /** Cliente → servidor: poner la figura de hoy (E junto al pesebre). */
  figura: "novena:figura",
  /** Servidor → todos: cómo está el pesebre (al entrar y cuando cambia). */
  estado: "novena:estado",
  /** Servidor → quien corresponde: una cinemática de la novena, con sus variables. */
  cine: "novena:cine",
  /** Servidor → quien lo intentó: por qué no se pudo. */
  aviso: "novena:aviso",
} as const;

/** El pesebre como lo ve el navegador: día de la novena (0 = no hay novena), figuras y quién puso la de hoy. */
export interface PesebreEstado {
  dia: number;
  figuras: number;
  /** Nombre de quien puso la figura de hoy ("" = todavía nadie). */
  por: string;
}

export interface NovenaCineEvent {
  id: string;
  vars?: Record<string, string | number>;
}

export const NovenaAvisoCode = z.enum(["noNovena", "lejos", "yaPuesta", "rezo"]);
export type NovenaAvisoCode = z.infer<typeof NovenaAvisoCode>;
export interface NovenaAviso {
  code: NovenaAvisoCode;
  /** Quien ya la puso (yaPuesta). */
  por?: string;
}

export function novenaAvisoText(a: NovenaAviso): string {
  switch (a.code) {
    case "noNovena":
      return "El pesebre se arma en las novenas, del 12 al 20 del invierno.";
    case "lejos":
      return "Acércate al pesebre del recibidor.";
    case "yaPuesta":
      return `${a.por || "Alguien"} ya puso la figura de hoy. Mañana llega otra.`;
    case "rezo":
      return "¡Empezó la novena en el recibidor! Vaya al pesebre a rezar y cantar.";
  }
}

// ---------- Las cinemáticas ----------

export const PESEBRE_CINE = "pesebre-figura";
export const novenaCineId = (dia: number) => `novena-dia-${dia}`;

/** El coro que se repite cada noche (escrito para la cabaña). */
const CORO = "Prende la vela, que llega el Niño;\ntrae la natilla con mucho cariño.";

/** Lo que dice Doña Aurora y la estrofa de cada día (letras propias, tipo villancico). */
const NOCHES: readonly { aurora: string; estrofa: string }[] = [
  { aurora: "Con tablas viejas y paja nueva se arma el establo. Lo demás llega solito, noche a noche.", estrofa: "Tablita a tablita, clavo a clavito,\nya tiene techo el ranchito bendito." },
  { aurora: "Llega la Virgen con su manto azul. Despacito, que el camino es largo.", estrofa: "Por la vereda baja María,\ntrae en los ojos la luz del día." },
  { aurora: "San José carga el farol y la paciencia. Busca posada y todo está lleno.", estrofa: "José camina con su farol,\ntoca la puerta y le abre el sol." },
  { aurora: "La mula llega rezongando, como todos los diciembres. Pero se queda.", estrofa: "La mulita dice que no está cansada,\npero se echa en la paja dorada." },
  { aurora: "El buey calienta el establo con su aliento. En el páramo eso vale oro.", estrofa: "Sopla el buey un vientico tibio,\npa' que el frío no le dé martirio." },
  { aurora: "Bajan los pastores del páramo, con ruana y quesito. Siempre traen algo.", estrofa: "Bajan pastores con su ruana,\ntraen quesito y una campana." },
  { aurora: "Se cuelga la estrella del techo. Si la ve titilar, pida algo bajito.", estrofa: "Una estrella se quedó quieta\nencima de la casita inquieta." },
  { aurora: "Los Reyes vienen de muy lejos, por la loma. Ya casi llegan, mijo.", estrofa: "Tres reyes bajan por la loma,\nuno trae oro y otro trae aroma." },
  { aurora: "Esta noche llega el Niño. Que la cabaña esté bonita, que la novena se acabó.", estrofa: "Duérmete, Niño, en tu cunita,\nque la cabaña quedó bonita." },
];

const say = (who: string, text: string, name?: string): CineStep => ({ op: "say", who, text, ...(name !== undefined ? { name } : {}) });

/** La cinemática de cada noche de la novena (de historia: se lee con calma). */
function nocheCine(dia: number): CineDef {
  const n = NOCHES[dia - 1]!;
  const { x, y } = NOVENA.pesebre;
  return {
    id: novenaCineId(dia),
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: { x: x + 1, y }, zoom: 1.5 },
      { op: "sound", sound: "campanada" },
      { op: "title", text: `Novena · Día ${dia}`, sub: figuraDelDia(dia).name },
      say("aurora", n.aurora),
      say("narrador", n.estrofa, "Todos cantan"),
      { op: "fx", fx: "estrellas", who: "yo" },
      say("narrador", CORO, "Todos cantan"),
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  };
}

export const NOVENA_CINEMATICAS: readonly CineDef[] = [
  // Alguien puso la figura del día (la ven todos: corta, sin franjas).
  {
    id: PESEBRE_CINE,
    kind: "momento",
    steps: [
      { op: "flash", color: "oro", ms: 350 },
      { op: "sound", sound: "campanada" },
      { op: "title", text: "{figura}", sub: "{nombre} la puso en el pesebre · día {dia} de la novena", ms: 2800 },
    ],
  },
  ...PESEBRE_FIGURAS.map((_f, i) => nocheCine(i + 1)),
];
