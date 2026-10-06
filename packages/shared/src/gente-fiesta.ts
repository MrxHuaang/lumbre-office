// La gente de la fiesta (VIR-167): los NPC que llenan el jardín (y alguna sala) mientras corre un festival.
// Aquí los datos y las reglas puras: cómo es cada uno (`FiestaNpc`: pinta, papel, comportamiento, frases,
// pedido y acción), qué gente trae cada festival (`GENTE_FIESTA`, una función por festival con el día del
// festival y el clima) y lo que cambia con la lluvia. Dónde está cada uno en cada minuto lo calcula
// packages/map (gente-fiesta.ts) con una función pura del minuto del juego: todos los navegadores ven lo
// mismo y el servidor valida la cercanía con la misma cuenta, sin guardar nada en la sala.
import { z } from "zod";
import { NIGHT_FROM } from "./clock";
import { festivalById, FESTIVAL_HORAS, type FestivalDef, type FestivalId } from "./festivales";
import { GENTE_BRUJAS } from "./gente-fiesta/brujas";
import { GENTE_CARNAVAL } from "./gente-fiesta/carnaval";
import { GENTE_COSECHA } from "./gente-fiesta/cosecha";
import { GENTE_COMETAS } from "./gente-fiesta/cometas";
export { COMETAS_GENTE } from "./gente-fiesta/cometas";
import { GENTE_FERIA } from "./gente-fiesta/feria-flores";
import { GENTE_NOVENAS } from "./gente-fiesta/novenas";
import { GENTE_VELITAS } from "./gente-fiesta/velitas";
import { GENTE_ANO_VIEJO } from "./gente-fiesta/ano-viejo";
import { GENTE_AMOR } from "./gente-fiesta/amor-amistad";
import type { Look } from "./look";
import { lineSeed, pickLine } from "./npcs";
import type { Weather } from "./weather";

export { VECINOS, vecino, vestirVecino, type Vecino, type VecinoId } from "./gente-fiesta/vecinos";
import type { VecinoId } from "./gente-fiesta/vecinos";

/** Hacia dónde mira (+x = right, +y = down), como los demás personajes. */
export type Mira = "down" | "left" | "right" | "up";

/** Un tile del nivel. */
export interface TileXY {
  x: number;
  y: number;
}

/** Una parada de una ronda: el tile, hacia dónde mira mientras está ahí y cuánto se queda (minutos del juego). */
export interface Parada extends TileXY {
  mira?: Mira;
  pausa?: number;
}

/**
 * Cómo se mueve (todo en tiles del nivel y minutos del juego; un minuto del juego son 2,5 s reales):
 * - `quieto`: en su puesto (el vendedor); mira a quien se le arrima.
 * - `ronda`: va de parada en parada (en orden y vuelve a empezar), con su pausa en cada una.
 * - `deambula`: pasea dentro de un rectángulo por paradas sorteadas con la semilla del día.
 * - `baila`: en su sitio, bailando.
 * - `grupo`: 2 o 3 en corrillo que se miran (`centro`) y conversan por turnos (los del mismo `grupo`).
 * - `sentado`: en un asiento del catálogo (`asiento` = el tile del asiento).
 * - `sigue`: detrás de otro NPC (`a`, su id), a `distancia` tiles por el mismo camino (los niños que
 *   corren detrás, el perro).
 */
export type Comportamiento =
  | { tipo: "quieto"; mira?: Mira }
  | { tipo: "ronda"; paradas: readonly Parada[]; pausa?: number; corre?: boolean }
  | { tipo: "deambula"; zona: { x: number; y: number; w: number; h: number }; paradas?: number; pausa?: number }
  | { tipo: "baila"; mira?: Mira }
  | { tipo: "grupo"; grupo: string; centro: TileXY }
  | { tipo: "sentado"; asiento: TileXY }
  | { tipo: "sigue"; a: string; distancia?: number; corre?: boolean };

/** Lo que dice al hablarle: siempre `hola` y, si hay, lo de la hora, el clima o el día del festival. */
export interface FrasesFiesta {
  hola: readonly string[];
  /** De la apertura (9:00) a mediodía. */
  manana?: readonly string[];
  /** De mediodía a las 19:00. */
  tarde?: readonly string[];
  /** Desde las 19:00 (de noche en el juego). */
  noche?: readonly string[];
  /** Con lluvia, tormenta o nieve. */
  lluvia?: readonly string[];
  /** Por día del festival (1.. en los de varios días, como las novenas). */
  dias?: Readonly<Record<number, readonly string[]>>;
}

/**
 * Un pedido de la fiesta: el NPC pide objetos de la mochila (ids de `BAG_OBJECTS`, sin el `obj:`) y da algo a
 * cambio (un objeto o puntos LEISURE chicos, con el tope por festival de `GENTE_REGLAS.topePuntos`). Una vez
 * por persona por festival (la marca va en `UserStat`).
 */
export interface PedidoFiesta {
  /** Único dentro del festival. */
  id: string;
  pide: readonly { item: string; n: number }[];
  da: { item?: string; n?: number; puntos?: number };
  /** Lo que dice al pedirlo y al recibirlo. */
  texto: string;
  gracias: string;
  /** La cinemática que ve quien lo entrega (el niño cuando le bajan la cometa del árbol). */
  cine?: string;
}

/**
 * Lo que hace además de hablar: `puesto` abre el puesto del festival (`festival_shop`). Si el festival tiene
 * varios puestos (el mercado de la Feria de la cosecha), `puesto` dice cuál atiende.
 */
export type AccionFiesta = { tipo: "puesto"; puesto?: string };

export interface FiestaNpc {
  /** Único dentro del festival (y no choca con los NPC fijos: van con el prefijo de la fiesta). */
  id: string;
  nombre: string;
  look: Look;
  /** Su papel en la fiesta ("vende maicena", "silletero"): sale bajo el nombre en el diálogo. */
  rol: string;
  area: string;
  /** Su sitio: donde se para (quieto, baila, grupo), o donde empieza (ronda, deambula, sigue). */
  tile: TileXY;
  comportamiento: Comportamiento;
  /** Cuándo está (minutos del día del juego). Sin esto, de la apertura al cierre del festival. */
  horario?: { desde: number; hasta: number };
  /** Si llega caminando: desde dónde (al empezar su horario) y por ahí se va al terminar. Solo para los que se quedan en su sitio. */
  llega?: TileXY;
  frases: FrasesFiesta;
  /** Lo que murmura solo, de ambiente (cortito: `GENTE_REGLAS.murmulloMax` letras como mucho). */
  murmullos: readonly string[];
  accion?: AccionFiesta;
  pedido?: PedidoFiesta;
  /** Lo que lleva en la mano de noche (un dibujo de items.ts: el farol, la velita). */
  farol?: string;
  /** Lo que lleva en la mano siempre (la velita de las familias). */
  lleva?: string;
  /**
   * La cometa que vuela sobre él (su código, ver cometa.ts): los niños de la loma. Si tiene un pedido, la
   * suya vuela recién cuando se lo entregan.
   */
  cometa?: string;
  /** Toma fotos cuando se detiene (los turistas): el destello de la cámara. */
  fotos?: boolean;
  /** Con la cara empolvada de talco (el Carnaval): un polvito encima, la piel no cambia. */
  talco?: boolean;
  /** Conversan por turnos los que tienen la misma `charla` (los de un `grupo` ya la tienen: su grupo). */
  charla?: string;
  /** Con lluvia: sigue en lo suyo (bajo techo o adentro), busca techo (lo de siempre) o se va a la casa. */
  lluvia?: "sigue" | "techo" | "se-va";
  /** Ratos (minutos del día) en que se pone a bailar y aplaudir (el público del desfile). */
  fiestero?: readonly { desde: number; hasta: number }[];
  /** Tono de la voz en el diálogo (0 grave .. 1 agudo). */
  voz?: number;
  /** Si es un animal (el perro de Mariana, la mula de Don Ramiro): el perro y el gato se dibujan como las mascotas. */
  animal?: { especie: "perro" | "gato" | "mula"; pelaje: string };
  /** De qué vecino de la vereda es este papel. */
  vecino?: VecinoId;
  /** Puesto por la lluvia bajo un techo (lo pone `conClima`; el mapa le busca el sitio). */
  refugio?: boolean;
}

/** La gente que trae un festival un día (`dia` = día del festival, 1..) con ese clima. */
export type GenteDeFestival = (dia: number, clima: Weather) => FiestaNpc[];

/** La gente de cada festival que la tiene. Un festival nuevo agrega aquí su función. */
export const GENTE_FIESTA: Partial<Record<FestivalId, GenteDeFestival>> = {
  brujas: GENTE_BRUJAS,
  velitas: GENTE_VELITAS,
  novenas: GENTE_NOVENAS,
  "feria-flores": GENTE_FERIA,
  carnaval: GENTE_CARNAVAL,
  cosecha: GENTE_COSECHA,
  "ano-viejo": GENTE_ANO_VIEJO,
  cometas: GENTE_COMETAS,
  "amor-amistad": GENTE_AMOR,
};

export const GENTE_REGLAS = {
  /** Distancia (tiles) para hablar con alguien de la fiesta o entregarle el pedido (la valida el servidor). */
  alcanceTiles: 1.8,
  /** Lo que el servidor perdona por la demora de la red (tiles de más). */
  holguraTiles: 1.2,
  /** Puntos LEISURE que dan los pedidos, como mucho, por persona por festival. */
  topePuntos: 20,
  /** Pausa entre dos entregas de la misma persona. */
  pausaMs: 1200,
  /** Letras como mucho de un murmullo. */
  murmulloMax: 28,
  /** Velocidad al caminar y al correr (tiles por minuto del juego: 4 son 1,6 tiles por segundo real). */
  pasoTiles: 4,
  corridaTiles: 7,
} as const;

/** Tiles bajo techo de cada nivel, por si llueve (el mapa busca el libre más cercano a cada uno). */
export const REFUGIOS: Readonly<Record<string, readonly TileXY[]>> = {
  // El porche de la casa y el alero del garaje, la glorieta y la Estación Hyvento.
  jardin: [
    { x: 56, y: 30 },
    { x: 58, y: 30 },
    { x: 60, y: 30 },
    { x: 65, y: 30 },
    { x: 67, y: 30 },
    { x: 69, y: 30 },
    { x: 48, y: 30 },
    { x: 52, y: 30 },
    { x: 47, y: 77 },
    { x: 48, y: 78 },
    { x: 86, y: 130 },
    { x: 89, y: 130 },
    { x: 92, y: 130 },
    { x: 96, y: 130 },
    { x: 100, y: 130 },
  ],
};

const MOJADO: readonly Weather[] = ["lluvia", "tormenta", "nieve"];
/** ¿Con este clima la gente busca techo? */
export const climaMojado = (clima: Weather) => MOJADO.includes(clima);

/**
 * Lo que hace la lluvia: los que se van, se van; de los que buscan techo, uno de cada tres se va a la casa y
 * los demás se quedan quietos bajo un techo (`refugio`). Los que siguen a otro corren su suerte.
 */
export function conClima(npcs: readonly FiestaNpc[], clima: Weather): FiestaNpc[] {
  if (!climaMojado(clima)) return [...npcs];
  const fate = new Map<string, "sigue" | "techo" | "se-va">();
  for (const n of npcs) {
    const p = n.lluvia ?? "techo";
    fate.set(n.id, p === "techo" && lineSeed(`lluvia:${n.id}`) % 3 === 0 ? "se-va" : p);
  }
  // Los que siguen a otro: con él.
  for (const n of npcs) if (n.comportamiento.tipo === "sigue") fate.set(n.id, fate.get(n.comportamiento.a) ?? "se-va");
  const out: FiestaNpc[] = [];
  for (const n of npcs) {
    const f = fate.get(n.id);
    if (f === "se-va") continue;
    if (f === "sigue") out.push(n);
    else out.push({ ...n, comportamiento: { tipo: "quieto" }, llega: undefined, refugio: true });
  }
  return out;
}

/** El día del festival (1..dias) para un día del juego; fuera de fecha (prendido a mano), el 1. */
export function diaDelFestival(f: FestivalDef, diaDeEstacion: number): number {
  const d = diaDeEstacion - f.dia + 1;
  return d >= 1 && d <= f.dias ? d : 1;
}

/**
 * La gente de un festival ese día (del festival) con ese clima, ya con lo que hace la lluvia. Nadie se queda
 * después del cierre del festival: quien no trae horario va de la apertura a su `cierre` (el Carnaval cierra
 * a las 18:30) y un horario que pase del cierre se corta ahí.
 */
export function genteDelFestival(festivalId: string | null | undefined, dia: number, clima: Weather): FiestaNpc[] {
  const gente = festivalId ? GENTE_FIESTA[festivalId as FestivalId] : undefined;
  if (!gente) return [];
  const f = festivalById(festivalId!);
  return conClima(gente(dia, clima), clima).map((n) => ({ ...n, horario: horarioDe(n, f) }));
}

/** Hasta qué minuto del día del juego dura la fiesta (su `cierre`, o las 22:00 de siempre). */
export const cierreDeFiesta = (f?: Pick<FestivalDef, "cierre"> | null) => Math.round((f?.cierre ?? FESTIVAL_HORAS.cierre) * 60);

/** El horario de un NPC (minutos del día del juego): sin el suyo, de la apertura al cierre del festival, y nunca después del cierre. */
export function horarioDe(n: FiestaNpc, f?: Pick<FestivalDef, "cierre"> | null): { desde: number; hasta: number } {
  const cierre = cierreDeFiesta(f);
  const h = n.horario ?? { desde: FESTIVAL_HORAS.apertura * 60, hasta: cierre };
  return h.hasta > cierre ? { desde: Math.min(h.desde, cierre), hasta: cierre } : h;
}

/** Con quiénes conversa por turnos (o null). */
export const corrilloDe = (n: FiestaNpc): string | null => n.charla ?? (n.comportamiento.tipo === "grupo" ? n.comportamiento.grupo : null);

/** ¿Está de fiesta (bailando y aplaudiendo) a ese minuto? */
export const estaDeFiesta = (n: FiestaNpc, minuto: number) => Boolean(n.fiestero?.some((r) => minuto >= r.desde && minuto < r.hasta));

/** Lo que tiene para decir según la hora, el clima y el día (para elegir con la semilla). */
export function frasesDeAhora(n: FiestaNpc, ctx: { minuto: number; clima: Weather; dia: number }): readonly string[] {
  const f = n.frases;
  const out: string[] = [];
  if (climaMojado(ctx.clima) && f.lluvia) out.push(...f.lluvia);
  const delDia = f.dias?.[ctx.dia];
  if (delDia) out.push(...delDia);
  const parte = ctx.minuto >= NIGHT_FROM ? f.noche : ctx.minuto >= 12 * 60 ? f.tarde : f.manana;
  if (parte) out.push(...parte);
  return out;
}

/**
 * Lo que dice al hablarle: el saludo y una línea de la hora, el clima o el día (si hay). Todos ven lo mismo
 * con la misma semilla.
 */
export function charlaDe(n: FiestaNpc, ctx: { minuto: number; clima: Weather; dia: number }, seed: number): string[] {
  const lines = [pickLine(n.frases.hola, seed)];
  const ahora = frasesDeAhora(n, ctx);
  if (ahora.length) lines.push(pickLine(ahora, seed >>> 3));
  return lines;
}

/** El murmullo de ahora (o null): la misma frase para todos en ese rato. */
export function murmulloDe(n: FiestaNpc, slot: number): string | null {
  return n.murmullos.length ? pickLine(n.murmullos, lineSeed(`${n.id}:${slot}`)) : null;
}

/** La gente de un festival que tiene pedidos, con su pedido. */
export function pedidosDe(npcs: readonly FiestaNpc[]): { npc: FiestaNpc; pedido: PedidoFiesta }[] {
  return npcs.flatMap((npc) => (npc.pedido ? [{ npc, pedido: npc.pedido }] : []));
}

/** La marca de un pedido ya entregado (contador de máximo en `UserStat`, sin migración). */
export const pedidoStatKey = (festivalId: string, año: number, pedidoId: string) => `festival:${festivalId}:${año}:pedido:${pedidoId}`;
/** Los puntos que ya dieron los pedidos de ese festival a esa persona (para el tope). */
export const puntosPedidosKey = (festivalId: string, año: number) => `festival:${festivalId}:${año}:pedidos-puntos`;

/** El nombre del festival para los textos (o "la fiesta"). */
export const nombreFiesta = (festivalId: string) => festivalById(festivalId)?.nombre ?? "la fiesta";

// ---------- Mensajes ----------

export const GENTE_MSG = {
  /** Cliente → servidor: entregar el pedido de alguien de la fiesta (junto a él). */
  entregar: "gente:entregar",
  /** Servidor → cliente: cómo salió la entrega. */
  resultado: "gente:resultado",
  /** Cliente → servidor: qué pedidos de este festival ya entregué. Servidor → cliente: la lista (`GenteHechos`). */
  hechos: "gente:hechos",
} as const;

export const EntregarMessage = z.object({ npc: z.string().min(1).max(64), pedido: z.string().min(1).max(64) });
export type EntregarMessage = z.infer<typeof EntregarMessage>;

export type EntregarError = "off" | "unknown" | "far" | "faltan" | "hecho" | "full" | "busy";
export type EntregarResult =
  | { ok: true; npc: string; pedido: string; item?: string; n?: number; puntos: number; capped: boolean }
  | { ok: false; npc: string; error: EntregarError };

export const ENTREGAR_ERROR_TEXT: Record<EntregarError, string> = {
  off: "La fiesta ya terminó.",
  unknown: "Esa persona no está en la fiesta.",
  far: "Acércate un poco más para entregárselo.",
  faltan: "Todavía no tienes todo lo que te pidió.",
  hecho: "Eso ya se lo entregaste en esta fiesta.",
  full: "No te cabe lo que te da: haz espacio en la mochila.",
  busy: "Un momentico…",
};

/** Los pedidos que ya entregó cada quien en el festival de ahora. */
export interface GenteHechos {
  festival: string;
  pedidos: string[];
}
