// La Feria de la cosecha jugable (VIR-169, docs/plan-festivales.md): el festival del día 10 del otoño, un
// mercado campesino en la pradera del jardín y el patio de la casa. Aquí las reglas puras; la decoración
// está en packages/map (festivales/cosecha.ts), la gente en gente-fiesta/cosecha.ts y lo decide la sala
// (apps/server/src/rooms/cosecha.ts).
// - El mercado: cinco puestos de campesinos que compran lo cosechado con el precio del día (con semilla del
//   día del juego) y uno que paga más, que rota cada dos horas del juego; con tope de ventas por persona por
//   festival. Venden semillas raras, canastos, arepas de choclo y lo del sancocho para quien no lo sembró.
// - El sancocho comunitario: la olla grande de Doña Rubiela se llena entre todos con lo de la mochila; al
//   llenarla hierve un rato y cada quien que esté cerca recibe un plato (energía), hasta tres ollas.
// - El concurso de la ahuyama más grande: la báscula pesa la ahuyama de la mano (el peso va en su id, ver
//   ahuyama.ts) y al cierre se premia la más pesada.
// - La tómbola de la junta de acción comunal: pocas boletas por persona y el sorteo al cierre de un mueble
//   que no se consigue en otro lado.
// - El baile de la cosecha al atardecer, con tiple, guitarra y bandola: quien baila en el patio (el emote
//   "Bailar") suma pasos, en pareja valen doble, y el baile completo da unos puntos una vez por feria.
import { z } from "zod";
import { AHUYAMA, ahuyamaDagOf } from "./ahuyama";
import type { CineDef, CineStep } from "./cinematicas";
import { CROPS, cropById, seedsOf } from "./huerto";

export const COSECHA = {
  id: "cosecha",
  /** Pausa entre dos acciones de la feria de la misma persona (vender, comprar, aportar, pesar, boleta). */
  cooldownMs: 900,
  /** Lo más que paga el mercado a una persona en toda la feria (puntos). */
  topeVentas: 60,
  /** Unidades que se venden de una vez. */
  ventaMax: 10,
  /** La tómbola: lo que vale cada boleta y cuántas puede tener cada quien. */
  boletaPrecio: 5,
  boletasMax: 3,
  /** Ollas de sancocho por feria (cuando se llena una, empieza otra). */
  ollasMax: 3,
  /** Lo que hierve la olla llena antes de servir (ms reales). */
  hervirMs: 15_000,
  /** Quiénes reciben plato: los del jardín a esta distancia de la olla (tiles). */
  platoTiles: 14,
  /** Lo que gana la ahuyama más pesada (una vez por feria; ocio, con el tope del día). */
  premioAhuyama: 40,
  /** La premiación y el sorteo salen un rato después del cierre (para no pisarse con la cinemática de cierre). */
  premiacionDelayMs: 18_000,
  tombolaDelayMs: 34_000,
  /** El baile de la cosecha: la música suena desde las 17:00 del juego y a las 17:30 sale la cinemática. */
  musicaDesde: 17 * 60,
  baileMinuto: 17 * 60 + 30,
  /** El baile dura hasta las 21:30 del juego (antes del cierre). */
  baileHasta: 21 * 60 + 30,
  /** Hasta dónde llega la pista del patio (tiles desde su medio). */
  baileTiles: 7,
  /** Los pasos que hay que bailar en el patio (emote "Bailar") para que cuente el baile. */
  bailePasos: 6,
  /** Entre dos pasos que cuentan (ms reales): el baile dura lo suyo, no se cuenta repetir el botón. */
  bailePasoMs: 3_000,
  /** Con alguien bailando al lado (en pareja), el paso vale doble. */
  parejaTiles: 2.5,
  parejaMs: 5_000,
  /** Lo que da el baile completo (una vez por feria; ocio, con el tope del día). */
  premioBaile: 12,
  /** Cada cuántas horas del juego cambia el puesto que más paga (desde la apertura). */
  rotaHoras: 2,
  /** Lo que paga de más el puesto que más paga. */
  bonoTop: 1.5,
  /** El precio del día va de `factorMin` a `factorMax` veces el precio base. */
  factorMin: 0.8,
  factorMax: 1.3,
} as const;

/** ¿Está abierta la feria? (de las 9:00 a las 22:00 del juego). */
export const cosechaActiva = (festival: string, fase: string) => festival === COSECHA.id && fase === "fiesta";

export const COSECHA_MSG = {
  /** Cliente → servidor: venderle algo de la mochila a un puesto (`{ puesto, item, n }`). */
  vender: "cosecha:vender",
  venderResult: "cosecha:vender:resultado",
  /** Cliente → servidor: comprarle algo a un puesto (`{ puesto, item }`). */
  comprar: "cosecha:comprar",
  comprarResult: "cosecha:comprar:resultado",
  /** Cliente → servidor: echar ingredientes a la olla (`{ item, n }`). */
  aportar: "cosecha:aportar",
  aportarResult: "cosecha:aportar:resultado",
  /** Cliente → servidor: pesar la ahuyama de la mano en la báscula. */
  pesar: "cosecha:pesar",
  pesarResult: "cosecha:pesar:resultado",
  /** Cliente → servidor: comprar una boleta de la tómbola. */
  boleta: "cosecha:boleta",
  boletaResult: "cosecha:boleta:resultado",
  /** Servidor → uno: lo suyo en esta feria (`CosechaMine`). Cliente → servidor: pedirlo. */
  mine: "cosecha:mio",
  /** Servidor → los que estaban cerca de la olla: el plato que les tocó (`SancochoServido`). */
  servido: "cosecha:servido",
  /** Servidor → quien baila en el patio: cómo va su baile (`BaileProgreso`). */
  baile: "cosecha:baile",
} as const;

// ---------- Dónde está cada cosa (tiles del jardín; la decoración y la gente usan lo mismo) ----------

type TileXY = { x: number; y: number };

/**
 * Lo fijo de la feria en el jardín: la olla en el patio (2x2), la báscula y el tablero del concurso, y la
 * tómbola (2x1). El punto de cada cosa va un tile al sur (delante, donde se para la gente).
 */
export const COSECHA_SITIOS = {
  olla: { x: 86, y: 21 },
  bascula: { x: 98, y: 50 },
  tablero: { x: 101, y: 50 },
  tombola: { x: 83, y: 55 },
  /** El medio del patio, donde se baila. */
  patio: { x: 84, y: 23 },
} as const;

/** Delante de una cosa (su punto). */
export const delante = (t: TileXY, dy = 1): TileXY => ({ x: t.x, y: t.y + dy });
/** Delante de la olla (es de 2x2). */
export const OLLA_PUNTO: TileXY = delante(COSECHA_SITIOS.olla, 2);

// ---------- El mercado ----------

/** Lo que paga el mercado por cada cosa (antes del precio del día). */
export const PRECIO_BASE: Readonly<Record<string, number>> = {
  cilantro: 1,
  cebolla: 2,
  fresa: 2,
  tomate: 2,
  papa: 2,
  uchuva: 2,
  huevo: 2,
  mazorca: 3,
  yuca: 3,
  platano: 3,
  miel: 3,
  lulo: 4,
  pitahaya: 4,
  frijol: 4,
  arracacha: 4,
  ahuyama: 5,
};

/** Lo que vende un puesto: un objeto de la mochila (`obj:<id>`) o un mueble (su tipo del catálogo). */
export interface CosechaVenta {
  id: string;
  name: string;
  price: number;
  mueble?: true;
}

export interface PuestoCosecha {
  id: string;
  nombre: string;
  /** El vecino que lo atiende (gente-fiesta/cosecha.ts). */
  vecino: string;
  /** El mueble del puesto (2x1, mirando al sur): el vendedor se para detrás (al norte) y la gente, delante. */
  tile: TileXY;
  /** El color del toldo (cada puesto es un mueble distinto). */
  toldo: "rojo" | "amarillo" | "verde" | "azul" | "naranja";
  /** Lo que compra (ids de lo cosechado, sin `obj:`). */
  compra: readonly string[];
  vende: readonly CosechaVenta[];
}

/**
 * Lo que vende un puesto de lo que también se compra: siempre por encima de lo más que paga cualquier puesto
 * (el día más caro y con el bono), así nunca sale a cuenta comprar para revender.
 */
export const precioDeVenta = (item: string) => Math.ceil((PRECIO_BASE[item] ?? 1) * COSECHA.factorMax * COSECHA.bonoTop) + 1;

const semillas = (crop: string, price: number): CosechaVenta => ({ id: seedsOf(crop), name: `Semillas de ${cropById(crop)?.name.toLowerCase() ?? crop}`, price });
const deLaHuerta = (item: string): CosechaVenta => ({ id: item, name: CROPS.find((c) => c.product === item)?.productName ?? item, price: precioDeVenta(item) });

/** El canasto de mimbre (mueble para la oficina) y el premio de la tómbola (mueble que solo sale de ahí). */
export const CANASTO = "canasto-mimbre";
export const TOMBOLA_PREMIO = "carreta-cosecha";
/** Los nombres de los muebles de la feria en la mochila (no están en la tienda). */
export const COSECHA_MUEBLES: Readonly<Record<string, { name: string; blurb: string }>> = {
  [CANASTO]: { name: "Canasto de mimbre", blurb: "Tejido a mano en la vereda, con mazorcas y papas. Ponlo en tu oficina con Decorar." },
  [TOMBOLA_PREMIO]: { name: "Carreta de la cosecha", blurb: "El premio de la tómbola de la junta: una carreta de madera cargada de ahuyamas. No se consigue en otro lado." },
};

export const COSECHA_PUESTOS: readonly PuestoCosecha[] = [
  {
    id: "tuberculos",
    nombre: "Los tubérculos de Chepe",
    vecino: "chepe",
    tile: { x: 77, y: 50 },
    toldo: "rojo",
    compra: ["papa", "yuca", "arracacha", "cebolla"],
    // Lo del sancocho, para quien no lo sembró (más caro de lo que paga cualquiera).
    vende: [deLaHuerta("yuca"), deLaHuerta("cebolla"), deLaHuerta("platano")],
  },
  {
    id: "frutas",
    nombre: "Las frutas de Luz Dary",
    vecino: "luzdary",
    tile: { x: 81, y: 50 },
    toldo: "amarillo",
    compra: ["fresa", "tomate", "lulo", "uchuva", "pitahaya"],
    vende: [],
  },
  {
    id: "granos",
    nombre: "Granos y semillas de Doña Carmenza",
    vecino: "carmenza",
    tile: { x: 85, y: 50 },
    toldo: "verde",
    compra: ["mazorca", "frijol", "cilantro"],
    // Las semillas raras de la temporada (no salen del cobertizo).
    vende: [semillas("frijol", 12), semillas("arracacha", 14)],
  },
  {
    id: "arepas",
    nombre: "Arepas de choclo de la Profe Marina",
    vecino: "marina",
    tile: { x: 89, y: 50 },
    toldo: "naranja",
    compra: ["mazorca", "huevo", "miel"],
    vende: [{ id: "arepa-choclo", name: "Arepa de choclo", price: 6 }],
  },
  {
    id: "ahuyamas",
    nombre: "Ahuyamas y canastos de Valentina",
    vecino: "valentina",
    tile: { x: 93, y: 50 },
    toldo: "azul",
    compra: ["ahuyama", "platano", "papa"],
    vende: [{ id: CANASTO, name: "Canasto de mimbre", price: 30, mueble: true }],
  },
];

export const puestoById = (id: string): PuestoCosecha | undefined => COSECHA_PUESTOS.find((p) => p.id === id);
/** Delante del puesto (donde se para quien compra o vende). */
export const puestoPunto = (p: PuestoCosecha): TileXY => delante(p.tile);
/** Donde se para quien lo atiende: detrás del mostrador. */
export const puestoVendedor = (p: PuestoCosecha): TileXY => ({ x: p.tile.x, y: p.tile.y - 1 });

/** Un número de 0 a 1 que sale siempre igual de un texto (los precios del día son iguales para todos). */
function semilla(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100_000) / 100_000;
}

/** Lo cosechado que se vende como la cosa base (una ahuyama pesada se paga como ahuyama). */
export const baseDeVenta = (item: string) => (ahuyamaDagOf(item) !== null ? AHUYAMA.crop : item);

/** El tramo del día (cada `rotaHoras` horas desde la apertura): cambia el puesto que más paga. */
export const tramoDelDia = (minuto: number) => Math.max(0, Math.floor((minuto - 9 * 60) / (COSECHA.rotaHoras * 60)));

/**
 * El puesto que más paga en ese momento del día: cambia con cada tramo y nunca repite el del tramo de antes
 * (2 y 5 no tienen divisores comunes: en cinco tramos pasan los cinco puestos).
 */
export function puestoQueMasPaga(day: number, minuto: number): string {
  const n = COSECHA_PUESTOS.length;
  const k = (Math.floor(semilla(`top:${day}`) * n) + 2 * tramoDelDia(minuto)) % n;
  return COSECHA_PUESTOS[k]!.id;
}

/** El factor del día de un puesto para una cosa (de `factorMin` a `factorMax`, igual para todos). */
export const factorDelDia = (puesto: string, item: string, day: number) => COSECHA.factorMin + (COSECHA.factorMax - COSECHA.factorMin) * semilla(`${day}:${puesto}:${item}`);

/** Lo que paga ese puesto por una unidad en ese momento (null si no lo compra). */
export function precioDeCompra(puesto: string, item: string, day: number, minuto: number): number | null {
  const p = puestoById(puesto);
  const base = baseDeVenta(item);
  if (!p || !p.compra.includes(base) || PRECIO_BASE[base] === undefined) return null;
  const top = puestoQueMasPaga(day, minuto) === p.id ? COSECHA.bonoTop : 1;
  return Math.max(1, Math.round(PRECIO_BASE[base]! * factorDelDia(p.id, base, day) * top));
}

/** El puesto que mejor paga una cosa ahora (para el aviso "Valentina paga más por la ahuyama"). */
export function mejorPuestoPara(item: string, day: number, minuto: number): { puesto: string; precio: number } | null {
  let best: { puesto: string; precio: number } | null = null;
  for (const p of COSECHA_PUESTOS) {
    const precio = precioDeCompra(p.id, item, day, minuto);
    if (precio !== null && (!best || precio > best.precio)) best = { puesto: p.id, precio };
  }
  return best;
}

const ItemIdSchema = z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,40}$/);
export const VenderMessage = z.object({ puesto: z.string().refine((v) => Boolean(puestoById(v))), item: ItemIdSchema, n: z.number().int().min(1).max(COSECHA.ventaMax) });
export const ComprarMessage = z.object({ puesto: z.string().refine((v) => Boolean(puestoById(v))), item: ItemIdSchema });

/** Clave de `UserStat` (máximo) de lo que ya pagó el mercado a alguien en la feria de ese año. */
export const ventasKey = (año: number) => `festival:${COSECHA.id}:${año}:ventas`;
/** El `refId` de una compra en un puesto (`PURCHASE`). */
export const cosechaRefId = (puesto: string, item: string) => `festival:${COSECHA.id}:${puesto}:${item}`;

/**
 * Cuántas unidades se pueden vender sin pasarse del tope (lo que ya se vendió en la feria cuenta): las que
 * pide, o menos si no cabe; 0 si ya no paga nada más.
 */
export function unidadesQueCaben(precio: number, n: number, yaVendido: number): number {
  const queda = Math.max(0, COSECHA.topeVentas - yaVendido);
  return Math.max(0, Math.min(n, Math.floor(queda / precio)));
}

export type VenderError = "off" | "far" | "nocompra" | "faltan" | "tope" | "busy" | "failed";
export type VenderResult =
  | { ok: true; puesto: string; item: string; n: number; puntos: number; vendido: number; balance: number }
  | { ok: false; puesto: string; item: string; error: VenderError };

export const VENDER_ERROR_TEXT: Record<VenderError, string> = {
  off: "El mercado campesino abre solo en la Feria de la cosecha.",
  far: "Arrímate al puesto para venderle.",
  nocompra: "En este puesto no compran eso: mira en los otros.",
  faltan: "No llevas tantos en la mochila.",
  tope: `Ya vendiste lo que el mercado paga en esta feria (${COSECHA.topeVentas} puntos).`,
  busy: "Un momentico…",
  failed: "No se pudo vender. Intenta de nuevo.",
};

export type ComprarError = "off" | "far" | "nada" | "funds" | "full" | "stack" | "busy" | "failed";
export type ComprarResult = { ok: true; puesto: string; item: string; balance: number } | { ok: false; puesto: string; item: string; error: ComprarError };

export const COMPRAR_ERROR_TEXT: Record<ComprarError, string> = {
  off: "El mercado campesino abre solo en la Feria de la cosecha.",
  far: "Arrímate al puesto para comprar.",
  nada: "Eso no lo venden en este puesto.",
  funds: "No te alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya llevas muchos de esos.",
  busy: "Un momentico…",
  failed: "No se pudo comprar. Intenta de nuevo.",
};

// ---------- El sancocho comunitario ----------

/** Lo que lleva cada olla (ids de la mochila sin `obj:`): la gallina se cambia por huevo criollo de la granja. */
export const OLLA_RECETA: Readonly<Record<string, number>> = {
  papa: 6,
  yuca: 3,
  mazorca: 4,
  platano: 3,
  cilantro: 3,
  cebolla: 3,
  huevo: 3,
};
export const OLLA_INGREDIENTES = Object.keys(OLLA_RECETA);
/** El plato que sirve la olla (una receta de cocina.ts con `olla`). */
export const SANCOCHO_PLATO = "sancocho-olla";

export const OLLA_TOTAL = Object.values(OLLA_RECETA).reduce((a, b) => a + b, 0);

/** Lo que le falta a la olla (ingrediente → cuántos). Vacío = está llena. */
export function ollaFaltan(aportado: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [item, n] of Object.entries(OLLA_RECETA)) {
    const falta = n - (aportado[item] ?? 0);
    if (falta > 0) out[item] = falta;
  }
  return out;
}

export const ollaLlena = (aportado: Readonly<Record<string, number>>) => Object.keys(ollaFaltan(aportado)).length === 0;

/** Qué tan llena va (0 a 1). */
export function ollaProgreso(aportado: Readonly<Record<string, number>>): number {
  let n = 0;
  for (const [item, max] of Object.entries(OLLA_RECETA)) n += Math.min(max, aportado[item] ?? 0);
  return n / OLLA_TOTAL;
}

/** En qué va la olla: juntando lo que lleva, hirviendo, o ya se sirvieron todas las de la feria. */
export type OllaFase = "llenando" | "hirviendo" | "acabada";

export const AportarMessage = z.object({ item: z.string().refine((v) => OLLA_INGREDIENTES.includes(v)), n: z.number().int().min(1).max(20) });

export type AportarError = "off" | "far" | "nofalta" | "faltan" | "hirviendo" | "acabada" | "busy";
export type AportarResult = { ok: true; item: string; n: number; llena: boolean } | { ok: false; item: string; error: AportarError };

export const APORTAR_ERROR_TEXT: Record<AportarError, string> = {
  off: "La olla del sancocho se prende solo en la Feria de la cosecha.",
  far: "Arrímate a la olla.",
  nofalta: "De eso ya hay suficiente en la olla: mira lo que falta.",
  faltan: "No llevas de eso en la mochila.",
  hirviendo: "La olla ya está hirviendo: espera el plato.",
  acabada: "Ya se sirvieron todas las ollas de la feria. ¡Hasta el otro año!",
  busy: "Un momentico…",
};

/** Servidor → los que estaban cerca: el plato que les tocó (o que no les cupo). */
export interface SancochoServido {
  olla: number;
  plato: boolean;
}

// ---------- El concurso de la ahuyama más grande ----------

export interface AhuyamaEntry {
  userId: string;
  name: string;
  dag: number;
  /** Cuándo se pesó (en un empate gana la primera). */
  at: number;
}

/** El tablero: de la más pesada a la más liviana; en un empate, la que se pesó primero. */
export function rankingAhuyamas<T extends AhuyamaEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.dag - a.dag || a.at - b.at);
}

export const ganadorAhuyama = <T extends AhuyamaEntry>(entries: readonly T[]): T | null => rankingAhuyamas(entries)[0] ?? null;

export type PesarError = "off" | "far" | "none" | "menos" | "full" | "busy";
export type PesarResult = { ok: true; dag: number; puesto: number; devuelta: number | null } | { ok: false; error: PesarError; dag?: number };

export const PESAR_ERROR_TEXT: Record<PesarError, string> = {
  off: "La báscula del concurso pesa solo en la Feria de la cosecha.",
  far: "Arrímate a la báscula.",
  none: "Lleva en la mano una ahuyama cosechada del huerto.",
  menos: "La que ya inscribiste pesa más: esta no la mejora.",
  full: "No te cabe en la mochila la ahuyama que tenías inscrita.",
  busy: "Un momentico…",
};

/** `refId` del premio de la ahuyama más grande (se paga una sola vez por feria). */
export const ahuyamaPrizeRef = (año: number) => `festival:${COSECHA.id}:${año}:ahuyama-de-oro`;

// ---------- La tómbola de la junta de acción comunal ----------

/** Clave de `UserStat` (máximo) de las boletas compradas en la feria de ese año. */
export const boletasKey = (año: number) => `festival:${COSECHA.id}:${año}:boletas`;
export const boletaRefId = (año: number, n: number) => `festival:${COSECHA.id}:${año}:boleta:${n}`;

export interface BoletasDe {
  userId: string;
  name: string;
  n: number;
}

/**
 * El sorteo: cada boleta es una oportunidad. `rand(max)` da un entero de 0 a max - 1 (el servidor usa
 * `crypto.randomInt`; los tests lo fijan). Null si nadie compró.
 */
export function sorteoTombola<T extends BoletasDe>(boletas: readonly T[], rand: (max: number) => number): T | null {
  const total = boletas.reduce((s, b) => s + Math.max(0, b.n), 0);
  if (total <= 0) return null;
  let k = rand(total);
  for (const b of boletas) {
    if (b.n <= 0) continue;
    if (k < b.n) return b;
    k -= b.n;
  }
  return null;
}

export type BoletaError = "off" | "far" | "max" | "funds" | "busy" | "failed";
export type BoletaResult = { ok: true; n: number; balance: number } | { ok: false; error: BoletaError };

export const BOLETA_ERROR_TEXT: Record<BoletaError, string> = {
  off: "La tómbola de la junta juega solo en la Feria de la cosecha.",
  far: "Arrímate a la tómbola.",
  max: `Ya tienes tus ${COSECHA.boletasMax} boletas: ¡suerte en el sorteo!`,
  funds: "No te alcanzan los puntos para la boleta.",
  busy: "Un momentico…",
  failed: "No se pudo comprar la boleta. Intenta de nuevo.",
};

// ---------- El baile de la cosecha ----------

/** ¿Va el baile a esa hora del juego? (de las 17:30 a las 21:30). */
export const baileAbierto = (minuto: number) => minuto >= COSECHA.baileMinuto && minuto < COSECHA.baileHasta;

/** ¿Está en la pista del patio? (tiles del jardín, con decimales). */
export const enLaPista = (xTiles: number, yTiles: number) => Math.hypot(xTiles - (COSECHA_SITIOS.patio.x + 0.5), yTiles - (COSECHA_SITIOS.patio.y + 0.5)) <= COSECHA.baileTiles;

/** Clave de `UserStat` (máximo) de que ya bailó el baile de la feria de ese año (1 = sí). */
export const baileKey = (año: number) => `festival:${COSECHA.id}:${año}:baile`;
/** `refId` del premio del baile (una vez por feria). */
export const baileRef = (año: number) => `festival:${COSECHA.id}:${año}:baile`;

/**
 * Lo que vale un paso: nada si fue muy seguido del anterior (`bailePasoMs`), dos en pareja y uno si baila
 * solo.
 */
export function valorDelPaso(ahora: number, anterior: number | null, enPareja: boolean): number {
  if (anterior !== null && ahora - anterior < COSECHA.bailePasoMs) return 0;
  return enPareja ? 2 : 1;
}

/** Servidor → quien baila: cuántos pasos lleva de cuántos, si fue en pareja y, al completarlo, el premio. */
export interface BaileProgreso {
  pasos: number;
  meta: number;
  pareja: boolean;
  /** Recién completó el baile: los puntos que le dio (0 si ya los tenía del día o no cupieron). */
  premio?: number;
}

/** Lo de cada quien en esta feria (se manda al entrar y después de cada cosa). */
export interface CosechaMine {
  /** Lo que ya le pagó el mercado (puntos). */
  vendido: number;
  boletas: number;
  /** El peso de su ahuyama inscrita (o 0). */
  dag: number;
  /** Los pasos que lleva en el baile y si ya lo completó. */
  pasos: number;
  bailado: boolean;
}

// ---------- Las cinemáticas ----------

export const COSECHA_CINE = {
  sancocho: "cosecha-sancocho",
  premiacion: "cosecha-premiacion",
  tombola: "cosecha-tombola",
  baile: "cosecha-baile",
} as const;

const O = COSECHA_SITIOS.olla;

/** Las cinemáticas de la Feria de la cosecha (se suman al catálogo). */
export const COSECHA_CINEMATICAS: readonly CineDef[] = [
  {
    // La olla llena: Doña Rubiela revuelve, la gente se arrima y ella sirve (la ven los de cerca de la olla).
    id: COSECHA_CINE.sancocho,
    kind: "momento",
    steps: [
      { op: "spawn", id: "rubiela", like: "aurora", vecino: "rubiela", name: "Doña Rubiela", at: { x: O.x + 2, y: O.y + 1 }, facing: "left", holds: "cucharon" },
      { op: "spawn", id: "aurora", like: "aurora", at: { x: O.x - 4, y: O.y + 4 }, facing: "up" },
      { op: "spawn", id: "evelio", like: "evelio", at: { x: O.x + 4, y: O.y + 5 }, facing: "up" },
      { op: "spawn", id: "gloria", like: "gloria", at: { x: O.x - 2, y: O.y + 6 }, facing: "up" },
      { op: "camera", to: { x: O.x + 1, y: O.y + 2 }, zoom: 1.2 },
      { op: "sound", sound: "tambor" },
      { op: "title", text: "¡Está listo el sancocho!", sub: "La olla de la feria, entre todos", ms: 2400 },
      {
        op: "together",
        steps: [
          { op: "walk", who: "aurora", to: { x: O.x - 1, y: O.y + 2 } },
          { op: "walk", who: "evelio", to: { x: O.x + 2, y: O.y + 3 } },
          { op: "walk", who: "gloria", to: { x: O.x, y: O.y + 3 } },
          { op: "act", who: "rubiela", action: "girar" },
        ],
      },
      { op: "say", who: "rubiela", name: "Doña Rubiela", text: "Papa, yuca, mazorca, plátano, cilantro… ¡y la mano de todos! Hagan fila, que alcanza.", ms: 3200 },
      {
        op: "together",
        steps: [
          { op: "act", who: "rubiela", action: "celebrar" },
          { op: "fx", fx: "chispas", who: "rubiela" },
          { op: "emote", who: "aurora", emote: "heart" },
          { op: "act", who: "evelio", action: "saltar" },
          { op: "sound", sound: "aplausos" },
        ],
      },
      { op: "bubble", who: "evelio", text: "¡Eso huele a domingo!" },
      { op: "say", who: "aurora", text: "Un sancocho así no se hacía en esta casa desde los tiempos de E.", ms: 2800 },
      { op: "camera", to: "yo" },
      { op: "together", steps: [{ op: "walk", who: "aurora", to: { x: O.x - 5, y: O.y + 6 } }, { op: "walk", who: "evelio", to: { x: O.x + 5, y: O.y + 6 } }, { op: "walk", who: "gloria", to: { x: O.x - 3, y: O.y + 8 } }] },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "evelio" },
      { op: "despawn", id: "gloria" },
      { op: "despawn", id: "rubiela" },
    ],
  },
  {
    id: COSECHA_CINE.premiacion,
    kind: "momento",
    steps: [
      { op: "spawn", id: "efrain", like: "evelio", vecino: "efrain", name: "Don Efraín", at: { dx: 5, dy: 2 }, facing: "left", holds: "{ahuyama}" },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 6, dy: 3 }, facing: "left" },
      { op: "together", steps: [{ op: "walk", who: "efrain", to: { dx: 2, dy: 1 } }, { op: "walk", who: "aurora", to: { dx: 2, dy: 2 } }] },
      { op: "together", steps: [{ op: "face", who: "efrain", toward: "yo" }, { op: "face", who: "aurora", toward: "yo" }] },
      { op: "sound", sound: "fanfarria" },
      {
        op: "together",
        steps: [
          { op: "flash", color: "oro", ms: 400 },
          { op: "title", text: "¡La ahuyama más grande!", sub: "{ganador} · {peso}", ms: 3000 },
          { op: "fx", fx: "confeti" },
          { op: "act", who: "efrain", action: "celebrar" },
          { op: "act", who: "aurora", action: "saltar" },
        ],
      },
      { op: "say", who: "efrain", name: "Don Efraín", text: "La báscula no miente: la de {ganador} pesó {peso}. ¡Cinta azul para esa ahuyama!", ms: 3200 },
      { op: "together", steps: [{ op: "sound", sound: "aplausos" }, { op: "emote", who: "yo", emote: "clap" }, { op: "act", who: "aurora", action: "saludar" }] },
      { op: "together", steps: [{ op: "walk", who: "efrain", to: { dx: -3, dy: 5 } }, { op: "walk", who: "aurora", to: { dx: -2, dy: 6 } }] },
      { op: "despawn", id: "efrain" },
      { op: "despawn", id: "aurora" },
    ],
  },
  {
    id: COSECHA_CINE.tombola,
    kind: "momento",
    steps: [
      { op: "spawn", id: "aurelio", like: "evelio", vecino: "aurelio", name: "Don Aurelio", at: { dx: 4, dy: 2 }, facing: "left", holds: "megafono" },
      { op: "walk", who: "aurelio", to: { dx: 2, dy: 1 } },
      { op: "face", who: "aurelio", toward: "yo" },
      { op: "sound", sound: "tambor" },
      { op: "say", who: "aurelio", name: "Don Aurelio", text: "¡Atención, vecinos! La junta de acción comunal va a sacar la boleta ganadora de la tómbola…", ms: 3000 },
      { op: "act", who: "aurelio", action: "girar" },
      { op: "sound", sound: "fanfarria" },
      {
        op: "together",
        steps: [
          { op: "flash", color: "oro", ms: 400 },
          { op: "title", text: "¡La boleta ganadora!", sub: "{ganador} se lleva la carreta de la cosecha", ms: 3000 },
          { op: "fx", fx: "confeti" },
          { op: "act", who: "aurelio", action: "celebrar" },
        ],
      },
      { op: "say", who: "aurelio", name: "Don Aurelio", text: "Gracias a todos por colaborar: lo de las boletas es para arreglar el camino de la vereda.", ms: 3000 },
      { op: "together", steps: [{ op: "sound", sound: "aplausos" }, { op: "emote", who: "yo", emote: "clap" }] },
      { op: "walk", who: "aurelio", to: { dx: -3, dy: 5 } },
      { op: "despawn", id: "aurelio" },
    ],
  },
  {
    // El baile de la cosecha: al atardecer arrancan el tiple, la guitarra y la bandola en el patio.
    id: COSECHA_CINE.baile,
    kind: "momento",
    steps: [
      { op: "sound", sound: "bambuco" },
      { op: "title", text: "¡El baile de la cosecha!", sub: "Tiple, guitarra y bandola en el patio de la casa", ms: 2800 },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 3, dy: 1 }, facing: "left" },
      { op: "spawn", id: "evelio", like: "evelio", at: { dx: 4, dy: 2 }, facing: "left" },
      {
        op: "together",
        steps: [{ op: "act", who: "aurora", action: "bailar" }, { op: "act", who: "evelio", action: "bailar" }, { op: "emote", who: "yo", emote: "clap" }],
      },
      { op: "bubble", who: "aurora", text: "¡Al patio, que ya empezó el bambuco!" },
      { op: "together", steps: [{ op: "act", who: "aurora", action: "girar" }, { op: "act", who: "evelio", action: "saltar" }] },
      { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: -2, dy: 5 } }, { op: "walk", who: "evelio", to: { dx: -1, dy: 6 } }] },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "evelio" },
    ],
  },
];

/** Los pasos de una cinemática de la feria que ponen a alguien (para revisar que exista la pinta). */
export const cosechaSpawns = (): Extract<CineStep, { op: "spawn" }>[] =>
  COSECHA_CINEMATICAS.flatMap((d) => d.steps.filter((s): s is Extract<CineStep, { op: "spawn" }> => s.op === "spawn"));
