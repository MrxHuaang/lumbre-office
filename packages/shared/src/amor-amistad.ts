// Amor y amistad jugable (VIR-162, docs/plan-festivales.md): el festival del día 7 de la primavera.
// - El amigo secreto: quien quiera se anota en el cofre del jardín; a las 10:00 del juego la sala sortea a
//   los anotados (una ronda: nadie se saca a sí mismo) y a los que llegan tarde los vuelve a sortear entre
//   ellos, o los mete sin deshacer ninguna pareja ya hecha (`sortearAmigos`). Durante el día se le dejan
//   al amigo detalles de la mochila con una notita (moderada, sin enlaces) y al cierre una cinemática
//   revela quién era el amigo de quién, de uno en uno.
// - Las cartas anónimas: se escriben en el buzón y el cartero Cupido las lleva en persona.
// - La serenata: el trío de cuerdas va a tocarle a quien uno elija, con propina en puntos (una a la vez).
// - El puesto de chocolates y flores, y la banca de los enamorados con su marco de foto.
// Aquí las reglas puras y los datos; lo decide la sala (apps/server/src/rooms/amorAmistad.ts) y la
// decoración está en packages/map (world/festivales/amor-amistad.ts). Todo vive en la memoria de la sala;
// las marcas de una vez van en `UserStat` (sin migración).
import { z } from "zod";
import type { BagObject } from "./bolsa";
import type { CineDef, CineStep } from "./cinematicas";
import type { ConsumeAction } from "./consumables";
import { CUPIDO, TRIO_SERENATA } from "./gente-fiesta/amor-amistad";

export { CUPIDO, TRIO_SERENATA, TRIO_TILES } from "./gente-fiesta/amor-amistad";

export const AMOR = {
  id: "amor-amistad",
  /** Pausa entre dos acciones de la misma persona (anotarse, regalar, escribir, comprar). */
  pausaMs: 1200,
  /** Minuto del día del juego del sorteo grande: los que se anotan antes entran juntos en una ronda. */
  sorteoMinuto: 10 * 60,
  /** Un anotado tardío espera esto (ms reales) por si llega otro con quien hacer ronda aparte. */
  tardioEsperaMs: 15_000,
  /** Letras de la notita de un regalo y de una carta. */
  notaMax: 60,
  cartaMax: 200,
  /** Por persona y por festival. */
  regalosMax: 8,
  cartasMax: 5,
  /** Cartas que esperan a una misma persona, como mucho. */
  cartasEnEsperaMax: 10,
  /** Entre dos cartas que Cupido le lleva a la misma persona. */
  cupidoPausaMs: 12_000,
  /** Lo que gana quien le dio al menos un detalle a su amigo (una vez por festival; ocio, con el tope del día). */
  premio: 15,
  /** La revelación sale un rato después del cierre, para no pisar la cinemática de cierre. */
  revelacionDelayMs: 18_000,
  /** Parejas que se revelan de una en una (las demás salen juntas al final). */
  revelacionMax: 10,
} as const;

export const SERENATA = {
  /** Lo que dura la serenata (la música y la cinemática). */
  duracionMs: 36_000,
  /** Después de una, el trío descansa esto antes de la siguiente. */
  pausaMs: 60_000,
  /** Las propinas que se pueden dar (puntos). */
  propinas: [10, 20, 40] as const,
} as const;

/** ¿Está abierta la fiesta? (de las 9:00 a las 22:00 del juego). */
export const amorActivo = (festival: string, fase: string) => festival === AMOR.id && fase === "fiesta";

// ---------- El sorteo ----------

export interface Pareja {
  /** Quien regala… */
  de: string;
  /** …a quien. */
  para: string;
}

/**
 * Las parejas nuevas del amigo secreto. Los anotados que todavía no están en ninguna pareja (los libres):
 * - si son dos o más, hacen una ronda entre ellos (cada uno le regala al siguiente; nadie a sí mismo);
 * - si queda uno solo y ya hay parejas, con `solo` entra sin romper ninguna: le regala a quien tiene menos
 *   amigos secretos y le regala quien tiene menos amigos a quien darle (alguien queda con dos).
 * Nunca toca las parejas que ya hay. `rand` da un número en [0, 1).
 */
export function sortearAmigos(anotados: readonly string[], parejas: readonly Pareja[], rand: () => number, opts: { solo?: boolean } = {}): Pareja[] {
  const enPareja = new Set(parejas.flatMap((p) => [p.de, p.para]));
  const libres = [...new Set(anotados)].filter((u) => !enPareja.has(u));
  if (libres.length >= 2) {
    // Fisher-Yates y la ronda: el i le regala al i+1 (y el último al primero).
    for (let i = libres.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [libres[i], libres[j]] = [libres[j]!, libres[i]!];
    }
    return libres.map((de, i) => ({ de, para: libres[(i + 1) % libres.length]! }));
  }
  if (libres.length !== 1 || !opts.solo) return [];
  const x = libres[0]!;
  const otros = [...new Set(anotados)].filter((u) => u !== x && enPareja.has(u));
  if (!otros.length) return [];
  const cuenta = (key: "de" | "para", u: string) => parejas.filter((p) => p[key] === u).length;
  const elegir = (key: "de" | "para") => {
    const min = Math.min(...otros.map((u) => cuenta(key, u)));
    const empate = otros.filter((u) => cuenta(key, u) === min);
    return empate[Math.floor(rand() * empate.length)]!;
  };
  // A quién le regala: el que menos amigos secretos tiene; quién le regala: el que menos amigos tiene.
  return [
    { de: x, para: elegir("para") },
    { de: elegir("de"), para: x },
  ];
}

/** A quiénes le regala alguien. */
export const amigosDe = (parejas: readonly Pareja[], userId: string) => parejas.filter((p) => p.de === userId).map((p) => p.para);

// ---------- Lo que se escribe: notitas y cartas ----------

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|app|dev|me|ly|gg|tv|xyz|info|biz|link|site|online|store|shop|es|us)\b)/i;

/**
 * Lo que no pasa en una notita ni en una carta anónima (las groserías más comunes del país, sin tildes).
 * Anónimo no quiere decir sin respeto.
 */
const GROSERIAS = [
  "hijueputa",
  "hijuepucha",
  "hp",
  "malparido",
  "malparida",
  "gonorrea",
  "puta",
  "puto",
  "mierda",
  "pendejo",
  "pendeja",
  "imbecil",
  "idiota",
  "estupido",
  "estupida",
  "careverga",
  "carechimba",
  "verga",
  "perra",
  "zorra",
  "marica",
  "maricon",
  "culo",
  "huevon",
  "guevon",
  "lambon",
];

/** El texto sin tildes, en minúscula y con las letras estiradas juntadas ("puuuta" → "puta"; "perra" queda igual). */
const normal = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/(.)\1{2,}/g, "$1");

const GROSERIA_RE = new RegExp(`(^|[^a-zñ])(${GROSERIAS.join("|")})(?=$|[^a-zñ])`);

/** ¿Tiene alguna grosería? */
export const esGrosero = (texto: string) => GROSERIA_RE.test(normal(texto));

export type TextoError = "vacio" | "largo" | "enlace" | "grosero";
export type TextoCheck = { ok: true; text: string } | { ok: false; error: TextoError };

/** Limpia una notita o una carta: sin caracteres de control ni espacios de más, con tope, sin enlaces ni groserías. */
export function limpiarTexto(raw: string, max: number, opts: { vacio?: boolean } = {}): TextoCheck {
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return opts.vacio ? { ok: true, text: "" } : { ok: false, error: "vacio" };
  if ([...text].length > max) return { ok: false, error: "largo" };
  if (LINK_RE.test(text)) return { ok: false, error: "enlace" };
  if (esGrosero(text)) return { ok: false, error: "grosero" };
  return { ok: true, text };
}

// ---------- Lo que se regala ----------

/**
 * ¿Se le puede dejar esto al amigo secreto? Solo lo que se agarra (`obj:`): nada de muebles, ni el celular,
 * ni hojas impresas (son notas privadas), ni objetos de la historia, ni herramientas que no se gastan.
 */
export function regalable(itemId: string, info: { story: boolean; durable: boolean }): boolean {
  if (!itemId.startsWith("obj:")) return false;
  const id = itemId.slice(4);
  if (id === "celular" || id.startsWith("hoja:") || id.startsWith("silleta:")) return false;
  return !info.story && !info.durable;
}

// ---------- El puesto de chocolates y flores ----------

export const AMOR_OBJ = {
  chocolatina: "chocolatina-corazon",
  rosa: "rosa-roja",
  tarjeta: "tarjeta-amistad",
  bombones: "caja-bombones",
} as const;

export const AMOR_BAG_OBJECTS: Record<string, BagObject> = {
  [AMOR_OBJ.chocolatina]: { name: "Chocolatina de corazón", blurb: "En forma de corazón y envuelta en papel rojo. Ideal para el amigo secreto.", kind: "comida", max: 30 },
  [AMOR_OBJ.rosa]: { name: "Rosa roja", blurb: "Una rosa de tallo largo con su lacito. Se da con las dos manos.", kind: "objeto", max: 20 },
  [AMOR_OBJ.tarjeta]: { name: "Tarjeta de amor y amistad", blurb: "Con un corazón en la portada y espacio para escribir bonito.", kind: "objeto", max: 20 },
  [AMOR_OBJ.bombones]: { name: "Caja de bombones", blurb: "Una cajita roja con seis bombones. Compartirla es opcional.", kind: "comida", max: 10 },
};

/** Lo dulce se come a mordiscos (se suma a CONSUMABLES). */
export const AMOR_CONSUMABLES: Record<string, { action: ConsumeAction; uses: number }> = {
  [AMOR_OBJ.chocolatina]: { action: "bite", uses: 2 },
  [AMOR_OBJ.bombones]: { action: "bite", uses: 6 },
};

export interface AmorShopItem {
  /** Id del objeto de la mochila (sin `obj:`). */
  id: string;
  name: string;
  price: number;
}

export const AMOR_SHOP: readonly AmorShopItem[] = [
  { id: AMOR_OBJ.chocolatina, name: "Chocolatina de corazón", price: 8 },
  { id: AMOR_OBJ.rosa, name: "Rosa roja", price: 10 },
  { id: AMOR_OBJ.tarjeta, name: "Tarjeta de amor y amistad", price: 5 },
  { id: AMOR_OBJ.bombones, name: "Caja de bombones", price: 18 },
];

export const amorShopItem = (id: string): AmorShopItem | undefined => AMOR_SHOP.find((i) => i.id === id);
/** El `refId` de la compra (`PURCHASE`). */
export const amorRefId = (id: string) => `festival:${AMOR.id}:${id}`;
/** El `refId` de la propina de una serenata (`PURCHASE`). */
export const serenataRefId = () => `festival:${AMOR.id}:serenata`;
/** El premio del amigo secreto (una vez por festival): `refId` y prefijo. */
export const amigoPremioRef = (año: number) => `festival:${AMOR.id}:${año}:amigo-secreto`;
/** Marca de `UserStat` (máximo 1): se anotó al amigo secreto de ese año (si la sala se reinicia, vuelve a entrar). */
export const anotadoKey = (año: number) => `festival:${AMOR.id}:${año}:anotado`;

// ---------- Mensajes ----------

export const AMOR_MSG = {
  /** Cliente → servidor: anotarse al amigo secreto (junto al cofre). */
  anotar: "amor:anotar",
  /** Cliente → servidor: dejarle un detalle al amigo (`{ para, item, nota }`, junto al cofre). */
  regalo: "amor:regalo",
  /** Cliente → servidor: una carta anónima (`{ para, texto }`, junto al buzón). */
  carta: "amor:carta",
  /** Cliente → servidor: pedir una serenata (`{ para, propina, anonima }`, junto al trío). */
  serenata: "amor:serenata",
  /** Cliente → servidor: comprar en el puesto (`{ item }`). */
  comprar: "amor:comprar",
  /** Cliente → servidor: lo mío (el servidor contesta con `estado`). */
  pedirEstado: "amor:pedir-estado",
  /** Servidor → uno: cómo va lo suyo (`AmorEstado`). */
  estado: "amor:estado",
  /** Servidor → uno: cómo salió lo que pidió (`AmorResultado`). */
  resultado: "amor:resultado",
  /** Servidor → quien recibe: un detalle de su amigo secreto (`RegaloLlego`). */
  regaloLlego: "amor:regalo-llego",
  /** Servidor → quien recibe: Cupido le trae una carta (`CartaLlega`). */
  cupido: "amor:cupido",
  /** Servidor → todos: una serenata empieza (`SerenataEvento`; la ven los del nivel de quien la recibe). */
  serenataEvento: "amor:serenata-evento",
  /** Servidor → todos: la revelación del amigo secreto al cierre (`Revelacion`). */
  revelacion: "amor:revelacion",
} as const;

const UserId = z.string().min(1).max(64);
export const RegaloMessage = z.object({ para: UserId, item: z.string().min(5).max(80), nota: z.string().max(AMOR.notaMax * 4).default("") });
export const CartaMessage = z.object({ para: UserId, texto: z.string().max(AMOR.cartaMax * 4) });
export const SerenataMessage = z.object({
  para: UserId,
  propina: z.number().refine((n) => (SERENATA.propinas as readonly number[]).includes(n)),
  anonima: z.boolean().default(false),
});
export const AmorBuyMessage = z.object({ item: z.string().refine((v) => Boolean(amorShopItem(v))) });

export interface AmigoView {
  userId: string;
  name: string;
  /** ¿Está en la cabaña ahora? (los detalles solo se dejan con el amigo conectado). */
  online: boolean;
}

export interface AmorEstado {
  festival: boolean;
  anotado: boolean;
  /** Ya pasó el sorteo grande de hoy. */
  sorteado: boolean;
  anotados: number;
  /** A quién(es) le regalo (vacío hasta el sorteo). */
  amigos: AmigoView[];
  regalosDados: number;
  cartasEnviadas: number;
  /** Lo que me han dejado (sin decir quién). */
  recibidos: { item: string; nota: string }[];
  /** Hasta cuándo (reloj del servidor, ms) el trío está ocupado o descansando; 0 = libre. */
  serenataHasta: number;
}

export type AmorAccion = "anotar" | "regalo" | "carta" | "serenata" | "comprar";
export type AmorError =
  | "off"
  | "lejos"
  | "busy"
  | "anotado"
  | "noAnotado"
  | "sinSorteo"
  | "noAmigo"
  | "item"
  | "tope"
  | "ausente"
  | "llena"
  | "self"
  | "nadie"
  | "dnd"
  | "ocupada"
  | "fondos"
  | "full"
  | "stack"
  | "failed"
  | TextoError;

export type AmorResultado = { accion: AmorAccion; ok: true; item?: string; balance?: number } | { accion: AmorAccion; ok: false; error: AmorError };

export const AMOR_ERROR_TEXT: Record<AmorError, string> = {
  off: "Eso es solo en Amor y amistad, de las 9:00 a las 22:00 del reloj de la cabaña.",
  lejos: "Acérquese un poco más.",
  busy: "Un momentico...",
  anotado: "Ya está anotado al amigo secreto.",
  noAnotado: "Primero anótese al amigo secreto en el cofre.",
  sinSorteo: "Todavía no hay sorteo: a las 10:00 se reparte el amigo secreto.",
  noAmigo: "Esa persona no es su amigo secreto.",
  item: "Eso no se puede regalar (o ya no lo tiene).",
  tope: "Ya llegó al tope por hoy.",
  ausente: "Esa persona no está en la cabaña ahora. Guárdele el detalle para cuando llegue.",
  llena: "La mochila de su amigo está llena. Inténtelo más tarde.",
  self: "A usted mismo no, pues.",
  nadie: "Esa persona no está en la cabaña.",
  dnd: "Esa persona está en No molestar.",
  ocupada: "El trío está tocando o descansando. Espere un ratico.",
  fondos: "No le alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya lleva muchos de esos.",
  failed: "No se pudo. Intente de nuevo.",
  vacio: "Escriba algo, aunque sea cortico.",
  largo: "Muy largo: más cortico, por favor.",
  enlace: "Sin enlaces, por favor.",
  grosero: "Eso no se manda así. Con cariño, que es amor y amistad.",
};

export interface RegaloLlego {
  item: string;
  nota: string;
}

export interface CartaLlega {
  id: string;
  texto: string;
}

export interface SerenataEvento {
  /** Nivel y tile de quien la recibe (ahí llega el trío). */
  area: string;
  x: number;
  y: number;
  paraId: string;
  para: string;
  /** Quien la pidió, o vacío si fue anónima. */
  de: string;
  /** Cuándo empezó (reloj del servidor) y cuánto dura. */
  at: number;
  ms: number;
}

export interface Revelacion {
  pares: { de: string; para: string; deId: string; paraId: string }[];
}

// ---------- Las cinemáticas ----------

export const AMOR_CINE = {
  cupido: "amor-cupido",
  revelacion: "amor-revelacion",
  serenata: "amor-serenata",
} as const;

/** El trío llega por el este de quien recibe la serenata y se para en fila frente a él. */
const TRIO_LLEGA = [
  { dx: 7, dy: 0 },
  { dx: 8, dy: 1 },
  { dx: 7, dy: 2 },
];
const TRIO_TOCA = [
  { dx: 2, dy: -1 },
  { dx: 2, dy: 0 },
  { dx: 2, dy: 1 },
];

/**
 * La serenata (para todos los del nivel): el trío entra caminando, se acomoda frente a quien la recibe y
 * toca un pasillo (la música la pone el navegador aparte); al final hace la venia y se va. Los lugares van
 * en tiles del nivel, relativos a quien la recibe (`at`), así todos los ven en el mismo sitio. `paraMi`:
 * quien mira es quien la recibe (sus corazones).
 */
export function serenataCine(at: { x: number; y: number }, opts: { para: string; de: string; paraMi: boolean }): CineDef {
  const pos = (d: { dx: number; dy: number }) => ({ x: at.x + d.dx, y: at.y + d.dy });
  const ids = TRIO_SERENATA.map((m) => m.id);
  const turno = (k: number): CineStep => ({
    op: "together",
    steps: [...ids.map((id, i): CineStep => ({ op: "act", who: id, action: (i + k) % 3 === 0 ? "asentir" : "bailar" })), { op: "wait", ms: 2600 }],
  });
  const mios: CineStep[] = opts.paraMi ? [{ op: "emote", who: "yo", emote: "heart" }, { op: "fx", fx: "corazones", who: "yo" }] : [];
  return {
    id: AMOR_CINE.serenata,
    kind: "momento",
    steps: [
      ...TRIO_SERENATA.map((m, i): CineStep => ({ op: "spawn", id: m.id, like: "gloria", look: m.look, name: m.nombre, at: pos(TRIO_LLEGA[i]!), facing: "left", holds: m.instrumento })),
      { op: "together", steps: ids.map((id, i): CineStep => ({ op: "walk", who: id, to: pos(TRIO_TOCA[i]!) })) },
      { op: "together", steps: ids.map((id): CineStep => ({ op: "face", who: id, dir: "left" })) },
      { op: "bubble", who: ids[0]!, text: opts.de ? `De parte de ${opts.de}, con todo el corazón.` : "De parte de alguien que lo quiere bien." },
      { op: "together", steps: [{ op: "title", text: `Serenata para ${opts.para}`, sub: "Los Trovadores de la Vereda", ms: 3000 }, ...mios] },
      turno(0),
      turno(1),
      turno(2),
      { op: "together", steps: [turno(0), ...(opts.paraMi ? [{ op: "emote", who: "yo", emote: "heart" } as CineStep] : [])] },
      turno(1),
      turno(2),
      turno(0),
      turno(1),
      { op: "together", steps: [{ op: "sound", sound: "aplausos" }, ...ids.map((id): CineStep => ({ op: "act", who: id, action: "saludar" })), ...(opts.paraMi ? [{ op: "emote", who: "yo", emote: "clap" } as CineStep] : [])] },
      { op: "bubble", who: ids[1]!, text: "¡Que viva el amor y la amistad!" },
      { op: "together", steps: ids.map((id, i): CineStep => ({ op: "walk", who: id, to: pos({ dx: 8 + i, dy: 3 }) })) },
      ...ids.map((id): CineStep => ({ op: "despawn", id })),
    ],
  };
}

/** Cuántas parejas salen de una en una en la revelación (las demás, juntas al final). */
const enUna = (n: number) => Math.min(n, AMOR.revelacionMax);

/**
 * La revelación del amigo secreto al cierre (para todos): llegan Aurora, Gloria y Cupido, se abre el cofre
 * y salen las parejas de una en una, cada una con su baile; al final, lo de uno (si estaba anotado) y el
 * confeti. `yo`: el userId de quien mira (para decirle quién era el suyo).
 */
export function revelacionCine(pares: Revelacion["pares"], yo: string | null): CineDef {
  const cupido = CUPIDO.id;
  const shown = pares.slice(0, enUna(pares.length));
  const rest = pares.length - shown.length;
  const mio = yo ? pares.filter((p) => p.paraId === yo).map((p) => p.de) : [];
  const bailan = ["aurora", "gloria", cupido];
  const steps: CineStep[] = [
    { op: "spawn", id: "aurora", like: "aurora", at: { dx: 4, dy: 1 }, facing: "left" },
    { op: "spawn", id: "gloria", like: "gloria", at: { dx: -4, dy: 1 }, facing: "right" },
    { op: "spawn", id: cupido, like: "gloria", look: CUPIDO.look, name: CUPIDO.nombre, at: { dx: 0, dy: 5 }, facing: "up" },
    {
      op: "together",
      steps: [
        { op: "walk", who: "aurora", to: { dx: 2, dy: 1 } },
        { op: "walk", who: "gloria", to: { dx: -2, dy: 1 } },
        { op: "walk", who: cupido, run: true, to: { dx: 0, dy: 2 } },
      ],
    },
    { op: "together", steps: bailan.map((who): CineStep => ({ op: "face", who, toward: "yo" })) },
    { op: "sound", sound: "fanfarria" },
    { op: "together", steps: [{ op: "flash", color: "rosa", ms: 400 }, { op: "title", text: "La revelación", sub: "Del amigo secreto", ms: 2600 }, { op: "act", who: cupido, action: "girar" }] },
    { op: "say", who: "aurora", text: "Bueno, se acabó el misterio. Vamos a ver quién le regaló a quién.", ms: 3000 },
  ];
  shown.forEach((p, i) => {
    const who = bailan[i % bailan.length]!;
    steps.push({
      op: "together",
      steps: [
        { op: "sound", sound: i % 2 ? "destello" : "carta" },
        { op: "title", text: p.de, sub: `era el amigo secreto de ${p.para}`, ms: 2300 },
        { op: "act", who, action: i % 3 === 2 ? "saltar" : "bailar" },
        { op: "fx", fx: "corazones", who: cupido },
      ],
    });
  });
  if (rest > 0) steps.push({ op: "title", text: `Y ${rest} ${rest === 1 ? "pareja" : "parejas"} más`, sub: "Todas en el cofre del jardín", ms: 2400 });
  if (mio.length) steps.push({ op: "together", steps: [{ op: "say", who: "gloria", text: `¿Y el suyo? Su amigo secreto era ${mio.join(" y ")}. ¡Quién lo iba a creer!`, ms: 3400 }, { op: "emote", who: "yo", emote: "surprise" }] });
  steps.push(
    { op: "sound", sound: "aplausos" },
    { op: "together", steps: [{ op: "fx", fx: "confeti" }, ...bailan.map((who): CineStep => ({ op: "act", who, action: "celebrar" })), { op: "emote", who: "yo", emote: "heart" }] },
    { op: "say", who: "aurora", text: "Que el cariño dure todo el año, no solo hoy. Feliz amor y amistad.", ms: 3000 },
    { op: "together", steps: [{ op: "walk", who: "aurora", to: { dx: 6, dy: 2 } }, { op: "walk", who: "gloria", to: { dx: -6, dy: 2 } }, { op: "walk", who: cupido, run: true, to: { dx: 0, dy: 7 } }] },
    { op: "despawn", id: "aurora" },
    { op: "despawn", id: "gloria" },
    { op: "despawn", id: cupido },
  );
  return { id: AMOR_CINE.revelacion, kind: "momento", steps };
}

/** Las cinemáticas fijas de Amor y amistad (se suman al catálogo). Cupido llega corriendo con una carta. */
export const AMOR_CINEMATICAS: readonly CineDef[] = [
  {
    id: AMOR_CINE.cupido,
    kind: "momento",
    steps: [
      { op: "spawn", id: CUPIDO.id, like: "gloria", look: CUPIDO.look, name: CUPIDO.nombre, at: { dx: -7, dy: 2 }, facing: "right" },
      { op: "walk", who: CUPIDO.id, run: true, path: [{ dx: -4, dy: 2 }, { dx: -1, dy: 1 }] },
      { op: "face", who: CUPIDO.id, toward: "yo" },
      { op: "together", steps: [{ op: "act", who: CUPIDO.id, action: "saltar" }, { op: "sound", sound: "carta" }, { op: "bubble", who: CUPIDO.id, text: "¡Correo del corazón!" }] },
      { op: "fx", fx: "corazones", who: "yo" },
    ],
  },
  // Para el catálogo (y para probarla con `__cine`): la revelación con parejas de ejemplo.
  { ...revelacionCine([{ de: "Alguien", para: "Otra persona", deId: "", paraId: "" }], null), id: `${AMOR_CINE.revelacion}-ejemplo` },
  { ...serenataCine({ x: 64, y: 50 }, { para: "Alguien", de: "", paraMi: false }), id: `${AMOR_CINE.serenata}-ejemplo` },
];

/** Cupido se va después de entregar la carta (lo pide el navegador al cerrar la tira). */
export const cupidoSeVa = (): CineDef => ({
  id: `${AMOR_CINE.cupido}-adios`,
  kind: "momento",
  steps: [
    { op: "spawn", id: CUPIDO.id, like: "gloria", look: CUPIDO.look, name: CUPIDO.nombre, at: { dx: -1, dy: 1 }, facing: "right" },
    { op: "act", who: CUPIDO.id, action: "saludar" },
    { op: "walk", who: CUPIDO.id, run: true, path: [{ dx: -4, dy: 3 }, { dx: -8, dy: 3 }] },
    { op: "despawn", id: CUPIDO.id },
  ],
});
