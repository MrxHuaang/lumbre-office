// El Año viejo (día 21 del invierno, el último del año del juego; VIR-170). Entre todos se arma el muñeco de
// año viejo en la plaza del patio (cada quien le da prendas viejas y relleno, y el muñeco crece por etapas),
// cada quien le deja su testamento en el cartel, y a las 21:30 del juego se quema en el brasero de piedra
// (simbólico y sin pólvora: luces de colores en el cielo, dibujadas por código). Los agüeros son minijuegos:
// las doce uvas con las campanadas, la vuelta al jardín con la maleta, las lentejas en el bolsillo y la ropa
// amarilla; cada uno deja un deseo en el diario del año y con los cuatro sale el logro. A las 21:59, la
// cuenta regresiva para todos, el abrazo y el resumen del año de cada quien (sacado de los contadores).
// Aquí solo los datos y las reglas puras; lo decide la sala (apps/server/src/rooms/anoViejo.ts).
import { z } from "zod";
import { STAT_KEYS } from "./achievements";
import type { BagObject } from "./bolsa";
import type { CineDef } from "./cinematicas";
import type { CostumeId } from "./costume-ids";
import type { TileXY } from "./gente-fiesta";

export const ANO_VIEJO_ID = "ano-viejo";

/** Minuto del día del juego. */
const hora = (h: number, m = 0) => h * 60 + m;

export const ANO_VIEJO = {
  /** Todo pasa en el jardín. */
  area: "jardin",
  /** La quema del muñeco y la cuenta regresiva (minutos del día del juego). */
  quemaMinuto: hora(21, 30),
  cuentaMinuto: hora(21, 59),
  /** Lo que dura el fuego en el brasero después de la quema (ms reales). */
  fuegoMs: 45_000,
  /** Desde el comienzo de la cuenta: cuándo llega el año nuevo (el abrazo y el resumen). */
  abrazoMs: 7_600,
  /** Pausa entre dos acciones de la misma persona. */
  pausaMs: 500,
  /** Relleno que se recoge en cada sitio (el aserrín del taller, la paja del gallinero), por persona y festival. */
  rellenoPorSitio: 3,
} as const;

// ---------- Los objetos ----------

export const UVA = "uva";
export const MALETA_OBJ = "maleta";
export const LENTEJAS = "lentejas";
export const ROPA_VIEJA = "ropa-vieja";
export const CARETA = "careta-muneco";
export const ASERRIN = "aserrin";
export const PAJA = "paja";
export const VARITA = "varita-luz";

export const ANO_VIEJO_BAG_OBJECTS: Record<string, BagObject> = {
  [UVA]: {
    name: "Uva del año viejo",
    blurb: "Del racimo de las doce. Cuando suenan las campanadas, con F se come una en cada una, a tiempo.",
    kind: "objeto",
    max: 12,
  },
  [MALETA_OBJ]: {
    name: "Maleta de viaje",
    blurb: "Para el agüero: con la maleta en la mano se le da la vuelta al jardín por las paradas marcadas, y el año trae viajes.",
    kind: "objeto",
    max: 1,
  },
  [LENTEJAS]: {
    name: "Puñado de lentejas",
    blurb: "En el bolsillo a la hora de la cuenta regresiva: que no falte la plata en el año nuevo.",
    kind: "objeto",
    max: 3,
  },
  [ROPA_VIEJA]: {
    name: "Ropa vieja",
    blurb: "Una camisa a cuadros y un pantalón remendado. Para vestir el muñeco de año viejo.",
    kind: "objeto",
    max: 6,
  },
  [CARETA]: {
    name: "Careta del muñeco",
    blurb: "La cara del muñeco de año viejo, pintada a mano, con bigote y sonrisa.",
    kind: "objeto",
    max: 2,
  },
  [ASERRIN]: {
    name: "Costal de aserrín",
    blurb: "Del banco del taller del garaje. Relleno para el muñeco de año viejo.",
    kind: "objeto",
    max: 6,
  },
  [PAJA]: {
    name: "Manojo de paja",
    blurb: "Del gallinero. Relleno para el muñeco de año viejo.",
    kind: "objeto",
    max: 6,
  },
  [VARITA]: {
    name: "Varita de luz",
    blurb: "Un juguete que brilla de colores. Nada de pólvora: alumbra igual y no asusta a los perros.",
    kind: "objeto",
    max: 1,
  },
};

// ---------- El muñeco de año viejo ----------

/** Lo que sirve para vestirlo (prendas) y para llenarlo (relleno): ids de la mochila sin el `obj:`. */
export const PRENDAS_MUNECO = [ROPA_VIEJA, CARETA, "sombrero-bruja", "antifaz-carnaval", "mascara-condor", "mascara-sol"] as const;
export const RELLENOS_MUNECO = [ASERRIN, PAJA] as const;
export type Aporte = "prenda" | "relleno";

export function aporteDe(item: string): Aporte | null {
  if ((PRENDAS_MUNECO as readonly string[]).includes(item)) return "prenda";
  if ((RELLENOS_MUNECO as readonly string[]).includes(item)) return "relleno";
  return null;
}

export const MUNECO = {
  /** Lo que da cada persona como mucho (entre prendas y relleno): así lo arman entre varios. */
  porPersona: 6,
  /** Lo que pide cada etapa (de la 1 a la 4): prendas y relleno juntos. */
  etapas: [
    { prendas: 1, rellenos: 1 },
    { prendas: 2, rellenos: 3 },
    { prendas: 4, rellenos: 5 },
    { prendas: 6, rellenos: 7 },
  ],
  /** Cómo va, de la 0 (la silla con un costal) a la 4 (listo para la quema). */
  nombres: ["Un costal en la silla", "Ya tiene pantalón", "Ya tiene camisa", "Ya tiene cara y sombrero", "Listo para la quema"],
} as const;

/** La etapa del muñeco (0..4) con lo que le han dado. */
export function etapaMuneco(prendas: number, rellenos: number): number {
  let e = 0;
  for (const req of MUNECO.etapas) if (prendas >= req.prendas && rellenos >= req.rellenos) e++;
  return e;
}

/** Lo que le falta para la etapa siguiente (null si ya está listo). */
export function faltaMuneco(prendas: number, rellenos: number): { prendas: number; rellenos: number } | null {
  const req = MUNECO.etapas[etapaMuneco(prendas, rellenos)];
  return req ? { prendas: Math.max(0, req.prendas - prendas), rellenos: Math.max(0, req.rellenos - rellenos) } : null;
}

// ---------- El testamento ----------

export const TESTAMENTO = {
  /** Letras como mucho. */
  max: 90,
  /** Los que se ven en el cartel (los últimos). */
  mostrar: 40,
} as const;

/** Un enlace o algo que lo parece. */
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|app|dev|me|ly|gg|tv|xyz|info|biz|link|site|online|store|shop|es|us)\b)/i;

/**
 * Palabras que no van en el cartel (sin tildes y en minúscula; se buscan como palabra o como comienzo de
 * palabra). El cartel lo ve todo el equipo: groserías e insultos, no.
 */
const FEAS = ["hijueputa", "hp", "malparid", "gonorrea", "puta", "puto", "mierda", "marica", "pendej", "imbecil", "idiota", "estupid", "verga", "culo", "carechimba", "huevon", "guevon", "perra", "zorra", "cabron"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sinRepetidas = (s: string) => s.replace(/(.)\1+/g, "$1");
/** Las que no tienen letras dobles se buscan también con las repetidas quitadas ("miieerda"). */
const FEAS_SIMPLES = FEAS.filter((f) => f === sinRepetidas(f));

/** ¿Tiene una grosería? (palabra entera o comienzo de palabra; ni las tildes, ni los números, ni las letras repetidas la esconden). */
export function tieneGroseria(text: string): boolean {
  const t = sinTildes(text).replace(/[0-9]/g, (d) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s" })[d] ?? d);
  const hay = (palabras: string[], feas: readonly string[]) => feas.some((f) => palabras.some((p) => p === f || (f.length > 3 && p.startsWith(f))));
  const palabras = t.split(/[^a-zñ]+/).filter(Boolean);
  // "perrrra" → "perra"; y del todo sin repetidas solo para las que no llevan dobles ("pera" no es "perra").
  return hay(palabras.map((p) => p.replace(/(.)\1{2,}/g, "$1$1")), FEAS) || hay(palabras.map(sinRepetidas), FEAS_SIMPLES);
}

export type TestamentoCheck = { ok: true; text: string } | { ok: false; error: "vacio" | "largo" | "enlace" | "grosero" };

/** El testamento como queda en el cartel: un renglón, sin enlaces ni groserías, hasta `TESTAMENTO.max` letras. */
export function cleanTestamento(raw: string): TestamentoCheck {
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "vacio" };
  if ([...text].length > TESTAMENTO.max) return { ok: false, error: "largo" };
  if (LINK_RE.test(text)) return { ok: false, error: "enlace" };
  if (tieneGroseria(text)) return { ok: false, error: "grosero" };
  return { ok: true, text };
}

// ---------- Las doce uvas ----------

export const UVAS = {
  n: 12,
  /** Entre campanada y campanada (ms reales). */
  intervaloMs: 2200,
  /** El aviso antes de la primera campanada. */
  avisoMs: 5000,
  /** Cuánto antes y cuánto después de cada campanada vale la uva (con la demora de la red). */
  antesMs: 400,
  despuesMs: 1500,
} as const;

/** Las veces que suenan las campanadas de las uvas (minuto del día del juego): dos ensayos y la de verdad. */
export const UVAS_VENTANAS = [hora(18), hora(20), hora(21, 45)] as const;

/** Las campanadas que están sonando (o por sonar): la primera en `inicio` (ms del servidor). */
export interface Campanadas {
  inicio: number;
  intervalo: number;
  n: number;
}

/** Cuándo terminan (pasada la última campanada y su margen). */
export const finCampanadas = (c: Campanadas) => c.inicio + (c.n - 1) * c.intervalo + UVAS.despuesMs;

export type UvaJuicio =
  | { ok: true; k: number }
  /** `espera`: todavía no suena la que sigue (no cuenta ni se gasta la uva); `tarde`: se pasó una campanada. */
  | { ok: false; error: "espera" | "tarde" | "fin" };

/**
 * ¿Vale la uva que se come en `t`? Cada campanada pide su uva, en orden: la que sigue (la número `comidas`)
 * vale de `antesMs` antes a `despuesMs` después de su campanada. Antes es esperar (no se pierde nada);
 * después, se le pasó: las doce ya no salen en esta tanda.
 */
export function juzgarUva(c: Campanadas, comidas: number, t: number): UvaJuicio {
  if (comidas >= c.n) return { ok: false, error: "fin" };
  const bell = c.inicio + comidas * c.intervalo;
  if (t < bell - UVAS.antesMs) return { ok: false, error: "espera" };
  if (t > bell + UVAS.despuesMs) return { ok: false, error: comidas === 0 && t > finCampanadas(c) ? "fin" : "tarde" };
  return { ok: true, k: comidas };
}

// ---------- La maleta ----------

/**
 * La vuelta al jardín con la maleta (tiles del jardín): sale de la plaza del año viejo (la parada 0, junto
 * al puesto), pasa por las paradas en orden (marcadas con su letrerito) y vuelve a la plaza. La familia de
 * las maletas hace la misma ronda.
 */
export const MALETA_RUTA: readonly TileXY[] = [
  { x: 80, y: 35 },
  { x: 86, y: 42 },
  { x: 92, y: 56 },
  { x: 62, y: 58 },
  { x: 44, y: 48 },
  { x: 45, y: 31 },
];

export const MALETA = {
  /** Qué tan cerca de la parada cuenta (tiles, de los pies al centro del tile). */
  reachTiles: 2.2,
  /** Lo menos y lo más que puede durar la vuelta (ms reales): ni volando ni de paseo toda la noche. */
  minMs: 20_000,
  maxMs: 5 * 60_000,
} as const;

/** La parada de la maleta donde está (pies en tiles, con decimales), o -1. */
export function paradaMaletaEn(xTiles: number, yTiles: number): number {
  return MALETA_RUTA.findIndex((p) => Math.hypot(p.x + 0.5 - xTiles, p.y + 0.5 - yTiles) <= MALETA.reachTiles);
}

/** Una vuelta andando: cuándo salió y cuál es la parada que sigue (la vuelta termina al volver a la 0). */
export interface MaletaVuelta {
  inicio: number;
  siguiente: number;
}

export type MaletaEvento = "salida" | "parada" | "llegada" | "tarde" | "rapido";

/**
 * Lo que pasa al estar en la parada `parada` en `t`: sin vuelta, en la salida empieza una; con vuelta, la que
 * sigue avanza (las otras no cuentan: hay que ir en orden), y volver a la salida después de la última la
 * termina. Pasado `maxMs` la vuelta se pierde; terminar antes de `minMs` no cuenta.
 */
export function avanzarMaleta(v: MaletaVuelta | null, parada: number, t: number): { v: MaletaVuelta | null; evento: MaletaEvento | null } {
  if (v && t - v.inicio > MALETA.maxMs) return { v: null, evento: "tarde" };
  if (parada < 0) return { v, evento: null };
  if (!v) return parada === 0 ? { v: { inicio: t, siguiente: 1 }, evento: "salida" } : { v: null, evento: null };
  if (parada !== v.siguiente) return { v, evento: null };
  if (v.siguiente === 0) return t - v.inicio < MALETA.minMs ? { v: null, evento: "rapido" } : { v: null, evento: "llegada" };
  return { v: { inicio: v.inicio, siguiente: (v.siguiente + 1) % MALETA_RUTA.length }, evento: "parada" };
}

// ---------- Los agüeros ----------

export const AGUEROS = ["uvas", "maleta", "lentejas", "amarillo"] as const;
export type AgueroId = (typeof AGUEROS)[number];

export const AGUERO_INFO: Record<AgueroId, { nombre: string; deseo: string; como: string }> = {
  uvas: { nombre: "Las doce uvas", deseo: "Doce meses dulces, uno por cada uva.", como: "Coma una uva con F en cada una de las doce campanadas (suenan a las 18:00, a las 20:00 y a las 21:45)." },
  maleta: { nombre: "La maleta", deseo: "Un año de viajes y caminos nuevos.", como: "Con la maleta en la mano, dele la vuelta al jardín por las paradas marcadas, en orden." },
  lentejas: { nombre: "Las lentejas", deseo: "Que no falte la plata en el bolsillo.", como: "Tenga un puñado de lentejas en la mochila a la hora de la cuenta regresiva." },
  amarillo: { nombre: "La ropa amarilla", deseo: "Buena suerte y alegría todo el año.", como: "Póngase la pinta amarilla de año nuevo (en Mi personaje) para la cuenta regresiva." },
};

/** La marca de un agüero cumplido ese año (contador de máximo en `UserStat`, sin migración). */
export const agueroStatKey = (año: number, id: AgueroId) => `festival:${ANO_VIEJO_ID}:${año}:aguero:${id}`;

/** El traje de la ropa amarilla (grupo "De año viejo" del editor). */
export const TRAJE_AMARILLO: CostumeId = "ano-nuevo-amarillo";

// ---------- El diario y el resumen del año ----------

/** Marca de que alguien estuvo en un festival ese año (contador de máximo, sin migración). */
export const festivalFueKey = (festivalId: string, año: number) => `festival:${festivalId}:${año}:fue`;
/** Lo que llevaba cada contador en el último año viejo (para contar solo lo del año). */
export const resumenBaseKey = (id: string) => `${ANO_VIEJO_ID}:base:${id}`;

/** Lo que entra al resumen: el nombre y de qué contadores sale (los de la historia se suman). */
export const RESUMEN_DATOS: readonly { id: string; label: string; stats: readonly string[] }[] = [
  { id: "peces", label: "Peces sacados", stats: [STAT_KEYS.fishCaught] },
  { id: "cosechas", label: "Cosechas", stats: [STAT_KEYS.harvests] },
  { id: "platos", label: "Platos cocinados", stats: [STAT_KEYS.dishesCooked] },
  { id: "historia", label: "Capítulos de la historia", stats: [STAT_KEYS.storyCh1, STAT_KEYS.storyCh2, STAT_KEYS.storyCh3, STAT_KEYS.storyCh4, STAT_KEYS.storyCh5] },
  { id: "logros", label: "Logros", stats: [STAT_KEYS.achievementsUnlocked] },
];

export interface ResumenFila {
  id: string;
  label: string;
  n: number;
}

export interface ResumenAno {
  año: number;
  /** Sin año viejo anterior, lo de los contadores es "desde que llegó" (no se inventa lo del año). */
  desdeQueLlego: boolean;
  filas: ResumenFila[];
  /** Los festivales a los que fue este año (los que quedaron marcados). */
  festivales: number;
  agueros: AgueroId[];
}

/**
 * El resumen del año con los contadores (`get` da undefined si nunca se contó: esa fila no sale). Lo del año
 * es lo de ahora menos lo que había en el último año viejo; sin eso, todo lo de siempre y `desdeQueLlego`.
 * Devuelve también las bases nuevas para guardar (lo de ahora).
 */
export function resumenDelAno(get: (key: string) => number | undefined, año: number, festivalIds: readonly string[]): { resumen: ResumenAno; bases: Record<string, number> } {
  const filas: ResumenFila[] = [];
  const bases: Record<string, number> = {};
  let desdeQueLlego = false;
  for (const d of RESUMEN_DATOS) {
    const vals = d.stats.map(get);
    if (vals.every((v) => v === undefined)) continue;
    const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0);
    const base = get(resumenBaseKey(d.id));
    if (base === undefined) desdeQueLlego = true;
    filas.push({ id: d.id, label: d.label, n: Math.max(0, total - (base ?? 0)) });
    bases[resumenBaseKey(d.id)] = total;
  }
  const festivales = festivalIds.filter((id) => (get(festivalFueKey(id, año)) ?? 0) >= 1).length;
  const agueros = AGUEROS.filter((id) => (get(agueroStatKey(año, id)) ?? 0) >= 1);
  return { resumen: { año, desdeQueLlego, filas, festivales, agueros }, bases };
}

// ---------- El puesto de uvas y maletas ----------

export interface AnoViejoShopItem {
  id: string;
  name: string;
  /** 0 = se regala (una vez mientras no se tenga). */
  price: number;
  /** Cuántos da. */
  n: number;
}

export const ANO_VIEJO_SHOP: readonly AnoViejoShopItem[] = [
  { id: UVA, name: "Racimo de doce uvas", price: 0, n: 12 },
  { id: MALETA_OBJ, name: "Maleta de viaje", price: 0, n: 1 },
  { id: LENTEJAS, name: "Puñado de lentejas", price: 0, n: 1 },
  { id: ROPA_VIEJA, name: "Ropa vieja", price: 4, n: 1 },
  { id: CARETA, name: "Careta del muñeco", price: 10, n: 1 },
  { id: VARITA, name: "Varita de luz", price: 6, n: 1 },
];

export const anoViejoShopItem = (id: string) => ANO_VIEJO_SHOP.find((i) => i.id === id);
export const anoViejoRefId = (id: string) => `festival:${ANO_VIEJO_ID}:${id}`;

// ---------- Mensajes ----------

export const ANO_VIEJO_MSG = {
  /** Cliente → servidor: pedir o comprar algo en el puesto (`AnoViejoBuyMessage`). */
  buy: "anoviejo:buy",
  buyResult: "anoviejo:buy-result",
  /** Cliente → servidor: darle algo al muñeco (`AporteMessage`), junto a él. */
  aportar: "anoviejo:aportar",
  aporteResult: "anoviejo:aporte-result",
  /** Cliente → servidor: dejar el testamento en el cartel (`TestamentoMessage`). */
  testamento: "anoviejo:testamento",
  testamentoResult: "anoviejo:testamento-result",
  /** Cliente → servidor: recoger relleno junto al costal de aserrín o la paca de paja. */
  recoger: "anoviejo:recoger",
  /** Cliente → servidor: comer una uva (con F, con las campanadas sonando). */
  uva: "anoviejo:uva",
  /** Servidor → quien lo pidió: un aviso (`AnoViejoNotice`). */
  notice: "anoviejo:notice",
  /** Servidor → cada uno: lo suyo del festival (`AnoViejoMine`), al entrar y cuando cambia. */
  mine: "anoviejo:mine",
  /** Servidor → cada uno: el resumen de su año (`ResumenAno`), al llegar el año nuevo. */
  resumen: "anoviejo:resumen",
} as const;

export const AnoViejoBuyMessage = z.object({ item: z.string().refine((v) => Boolean(anoViejoShopItem(v))) });
export const AporteMessage = z.object({ item: z.string().refine((v) => aporteDe(v) !== null) });
/** El testamento viaja sin limpiar (lo revisa `cleanTestamento`): el tope aquí es solo de tamaño. */
export const TestamentoMessage = z.object({ text: z.string().max(TESTAMENTO.max * 4) });

export type AnoViejoBuyError = "off" | "far" | "funds" | "full" | "stack" | "tiene" | "busy" | "failed";
export type AnoViejoBuyResult = { ok: true; item: string; balance: number | null } | { ok: false; item: string; error: AnoViejoBuyError };

export const ANO_VIEJO_BUY_ERROR_TEXT: Record<AnoViejoBuyError, string> = {
  off: "El puesto abre solo el día del Año viejo, de 9:00 a 22:00.",
  far: "Arrímese al puesto de uvas y maletas.",
  funds: "No le alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya lleva muchos de esos.",
  tiene: "Eso ya lo tiene en la mochila.",
  busy: "Un momentico...",
  failed: "No se pudo. Intente otra vez.",
};

export type AnoViejoNoticeCode =
  | "cerrado"
  | "lejos"
  | "noSirve"
  | "noTiene"
  | "tope"
  | "quemado"
  | "aporte"
  | "listo"
  | "testamento"
  | "vacio"
  | "largo"
  | "enlace"
  | "grosero"
  | "relleno"
  | "rellenoTope"
  | "llena"
  | "uvasNo"
  | "uvaEspera"
  | "uvaTarde"
  | "uva"
  | "uvasListas"
  | "maletaSalida"
  | "maletaParada"
  | "maletaLlegada"
  | "maletaTarde"
  | "maletaRapido"
  | "aguero";

export interface AnoViejoNotice {
  code: AnoViejoNoticeCode;
  /** Cuántas uvas van, la parada, la etapa o el aporte. */
  n?: number;
  /** El agüero cumplido (con `aguero`). */
  aguero?: AgueroId;
  /** Qué relleno (con `relleno`). */
  item?: string;
}

export function anoViejoNoticeText(n: AnoViejoNotice): string {
  switch (n.code) {
    case "cerrado":
      return "Eso es solo el día del Año viejo, de 9:00 a 22:00.";
    case "lejos":
      return "Arrímese un poquito más.";
    case "noSirve":
      return "Eso no le sirve al muñeco: necesita prendas viejas o relleno.";
    case "noTiene":
      return "No tiene eso en la mochila.";
    case "tope":
      return `Ya le dio ${MUNECO.porPersona} cosas al muñeco. Deje que los demás también le pongan.`;
    case "quemado":
      return "El muñeco ya se quemó. Feliz año nuevo.";
    case "aporte":
      return "Listo, el muñeco se lo agradece.";
    case "listo":
      return `El muñeco creció: ${MUNECO.nombres[n.n ?? 0] ?? ""}.`;
    case "testamento":
      return "Su testamento quedó en el cartel, junto al muñeco.";
    case "vacio":
      return "Escriba algo cortico: lo que deja de este año.";
    case "largo":
      return `El testamento es de ${TESTAMENTO.max} letras como mucho.`;
    case "enlace":
      return "Nada de enlaces en el testamento: solo palabras.";
    case "grosero":
      return "El cartel lo lee todo el equipo: escríbalo sin groserías.";
    case "relleno":
      return `${n.item === PAJA ? "Un manojo de paja" : "Un costal de aserrín"} a la mochila, para el muñeco.`;
    case "rellenoTope":
      return "De aquí ya sacó suficiente relleno.";
    case "llena":
      return "La mochila está llena.";
    case "uvasNo":
      return "Las uvas se comen con las campanadas: suenan a las 18:00, a las 20:00 y a las 21:45.";
    case "uvaEspera":
      return "Espere la campanada.";
    case "uvaTarde":
      return "Se le pasó una campanada. En la próxima tanda vuelve a intentarlo.";
    case "uva":
      return `Uva ${n.n ?? 0} de ${UVAS.n}.`;
    case "uvasListas":
      return "¡Las doce uvas, una por campanada! Doce meses dulces.";
    case "maletaSalida":
      return `Salió con la maleta: ${MALETA_RUTA.length - 1} paradas por el jardín y de vuelta a la plaza.`;
    case "maletaParada":
      return `Parada ${n.n ?? 0} de ${MALETA_RUTA.length - 1}. Siga a la que viene.`;
    case "maletaLlegada":
      return "¡Le dio la vuelta al jardín con la maleta! El año trae viajes.";
    case "maletaTarde":
      return "La vuelta con la maleta se demoró mucho: empiece otra vez en la plaza.";
    case "maletaRapido":
      return "Muy rápido: la vuelta se da caminando por todas las paradas.";
    case "aguero":
      return n.aguero ? `Agüero cumplido: ${AGUERO_INFO[n.aguero].nombre}. ${AGUERO_INFO[n.aguero].deseo}` : "Agüero cumplido.";
  }
}

/** Lo de cada quien en el festival: lo que le ha dado al muñeco, sus agüeros, su testamento y la maleta. */
export interface AnoViejoMine {
  aportes: number;
  agueros: AgueroId[];
  testamento: string | null;
  /** La parada que sigue en la vuelta de la maleta (o null sin vuelta). */
  maleta: number | null;
  /** Las uvas comidas en las campanadas de ahora. */
  uvas: number;
}

// ---------- Las cinemáticas ----------

export const ANO_VIEJO_CINE = {
  quema: "ano-viejo-quema",
  cuenta: "ano-viejo-cuenta",
  uvas: "ano-viejo-uvas",
  maleta: "ano-viejo-maleta",
} as const;

/** El brasero y la silla del muñeco (tiles del jardín): las cinemáticas miran hacia allá. */
export const ANO_VIEJO_PLAZA = { brasero: { x: 77, y: 31 }, silla: { x: 75, y: 31 }, cartel: { x: 70, y: 30 }, puesto: { x: 82, y: 31 } } as const;

const B = ANO_VIEJO_PLAZA.brasero;
const numeros = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export const ANO_VIEJO_CINEMATICAS: readonly CineDef[] = [
  {
    // La quema: la cámara va al brasero, Aurora, Gloria y Evelio se arriman, dan un paso atrás, chispas y
    // aplausos. El fuego y el humo los pone la escena (el muñeco ardiendo en el brasero).
    id: ANO_VIEJO_CINE.quema,
    kind: "momento",
    steps: [
      { op: "camera", to: { x: B.x + 1, y: B.y + 2 }, zoom: 1.15, ms: 1200 },
      { op: "spawn", id: "aurora", like: "aurora", at: { x: B.x - 1, y: B.y + 3 }, facing: "up" },
      { op: "spawn", id: "gloria", like: "gloria", at: { x: B.x + 2, y: B.y + 3 }, facing: "up" },
      { op: "spawn", id: "evelio", like: "evelio", at: { x: B.x + 3, y: B.y + 1 }, facing: "left" },
      { op: "sound", sound: "tambor" },
      { op: "title", text: "¡Se quema el año viejo!", sub: "Que se lleve lo malo y nos deje lo bueno", ms: 2800 },
      { op: "flash", color: "oro", ms: 500 },
      {
        op: "together",
        steps: [
          { op: "walk", who: "aurora", to: { x: B.x - 1, y: B.y + 4 } },
          { op: "walk", who: "gloria", to: { x: B.x + 2, y: B.y + 4 } },
          { op: "walk", who: "evelio", to: { x: B.x + 4, y: B.y + 1 } },
          { op: "fx", fx: "chispas", who: "gloria" },
        ],
      },
      { op: "together", steps: [{ op: "face", who: "aurora", dir: "up" }, { op: "face", who: "gloria", dir: "up" }, { op: "face", who: "evelio", dir: "left" }] },
      { op: "sound", sound: "aplausos" },
      {
        op: "together",
        steps: [
          { op: "emote", who: "aurora", emote: "clap" },
          { op: "emote", who: "gloria", emote: "clap" },
          { op: "emote", who: "evelio", emote: "clap" },
          { op: "emote", who: "yo", emote: "clap" },
          { op: "fx", fx: "estrellas" },
        ],
      },
      { op: "say", who: "aurora", text: "Ahí va el año viejo, con todo lo que le dejaron en el testamento.", ms: 3400 },
      { op: "say", who: "evelio", text: "Y sin un solo volador, que los perros también tienen derecho a la fiesta.", ms: 3400 },
      { op: "camera", to: "yo", ms: 900 },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "gloria" },
      { op: "despawn", id: "evelio" },
    ],
  },
  {
    // La cuenta regresiva: los números grandes, el año nuevo, el abrazo (el corazón) y las campanas.
    id: ANO_VIEJO_CINE.cuenta,
    kind: "momento",
    steps: [
      { op: "sound", sound: "tambor" },
      ...numeros.map((n) => ({ op: "title" as const, text: String(n), sub: n === 10 ? "La cuenta regresiva" : undefined, ms: 640 })),
      { op: "flash", color: "oro", ms: 600 },
      { op: "sound", sound: "campanadas" },
      {
        op: "together",
        steps: [
          { op: "title", text: "¡Feliz año nuevo!", sub: "Un abrazo para todos", ms: 3200 },
          { op: "fx", fx: "confeti" },
          { op: "emote", who: "yo", emote: "heart" },
          { op: "act", who: "yo", action: "celebrar" },
        ],
      },
      { op: "fx", fx: "corazones", who: "yo" },
    ],
  },
  {
    id: ANO_VIEJO_CINE.uvas,
    kind: "momento",
    steps: [
      { op: "flash", color: "rosa", ms: 300 },
      { op: "title", text: "¡Las doce uvas!", sub: "Doce meses dulces", ms: 2200 },
      { op: "act", who: "yo", action: "celebrar" },
    ],
  },
  {
    id: ANO_VIEJO_CINE.maleta,
    kind: "momento",
    steps: [
      { op: "flash", color: "oro", ms: 300 },
      { op: "title", text: "¡La vuelta con la maleta!", sub: "El año trae viajes", ms: 2200 },
      { op: "act", who: "yo", action: "saltar" },
    ],
  },
];
