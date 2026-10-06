// El Festival de cometas jugable (VIR-168, docs/plan-festivales.md): la tarde de agosto en la loma del
// observatorio, el día 9 del verano. En el taller de la loma se arma la cometa (forma, dos colores de papel
// y la cola de trapitos; el código va en el id del objeto: cometa.ts) con materiales del puesto, se vuela
// con F en el voladero (el minijuego de cometa-vuelo.ts, que la sala repite para validar) y todas las que
// vuelan se ven en el cielo para todos. Hay récord de altura del día, concurso de la más bonita (un voto
// por persona) y premiación al cierre. Aquí las reglas puras; la decoración y el voladero están en
// packages/map (festivales/cometas.ts) y lo decide la sala (apps/server/src/rooms/cometas.ts).
import { z } from "zod";
import type { BagObject } from "./bolsa";
import type { CineDef, CineStep } from "./cinematicas";
import type { Look } from "./look";
import { COMETA_COLORES, COMETA_FORMAS, MATERIAL, cometaMateriales, validCometaCode, type CometaColorLetra, type CometaFormaLetra } from "./cometa";

export const COMETAS = {
  id: "cometas",
  /** Pausa entre dos acciones de la misma persona (armar, comprar, inscribir, votar, volar). */
  cooldownMs: 1200,
  /** Desde qué altura (m) la primera cometa del día se celebra con su cinemática. */
  primeraAltura: 15,
  /** Lo que gana la más alta y la más bonita (una vez por festival; ocio, con el tope del día). */
  premioAlta: 40,
  premioBonita: 30,
  /** La premiación sale un rato después del cierre, para no pisarse con la cinemática de cierre. */
  premiacionDelayMs: 18_000,
  /** Lo que se perdona por la demora de la red al validar los cuadros del vuelo. */
  holguraMs: 1500,
  /** Cada cuánto manda el navegador los botones del vuelo (la altura que ven los demás se pone al día). */
  pasoMs: 600,
} as const;

/** ¿Está abierto el festival? (de las 9:00 a las 22:00 del juego). */
export const cometasActiva = (festival: string, fase: string) => festival === COMETAS.id && fase === "fiesta";

export const COMETAS_MSG = {
  /** Cliente → servidor: armar una cometa en el taller (`{ code }`). */
  armar: "cometas:armar",
  armarResult: "cometas:armar:resultado",
  /** Cliente → servidor: comprar en el puesto (`{ item }`). */
  comprar: "cometas:comprar",
  comprarResult: "cometas:comprar:resultado",
  /** Cliente → servidor: soltar la cometa de la mano en el voladero. Servidor → uno: `VueloStart` o el error. */
  volar: "cometas:volar",
  vuelo: "cometas:vuelo",
  /** Cliente → servidor: los botones del vuelo hasta un cuadro (`{ id, toggles, frames }`), y al recoger. */
  paso: "cometas:paso",
  recoger: "cometas:recoger",
  /** Servidor → uno: cómo terminó el vuelo (`VueloEnd`). */
  fin: "cometas:fin",
  /** Cliente → servidor: inscribir la cometa de la mano en el concurso, o votar por una (`{ owner }`). */
  inscribir: "cometas:inscribir",
  votar: "cometas:votar",
  concursoResult: "cometas:concurso:resultado",
  /** Cliente → servidor: bajar la cometa que quedó en el techo del garaje (junto a la escalera). */
  techo: "cometas:techo",
  techoResult: "cometas:techo:resultado",
  /** Servidor → uno: lo mío en este festival (`CometasMine`). */
  mine: "cometas:mio",
} as const;

export const CometaArmarMessage = z.object({ code: z.string().refine(validCometaCode) });
export const CometaPasoMessage = z.object({
  id: z.number().int().nonnegative(),
  toggles: z.array(z.number().int().nonnegative()).max(4000),
  frames: z.number().int().nonnegative(),
});
export type CometaPasoMessage = z.infer<typeof CometaPasoMessage>;
export const CometaVotoMessage = z.object({ owner: z.string().min(1).max(64) });

/** Lo que publica la sala de cada cometa que vuela (`state.cometas.vuelos`, por sessionId de quien la sostiene). */
export interface CometaVueloView {
  userId: string;
  name: string;
  code: string;
  altura: number;
  /** El hilo cruje (la tensión está en peligro): la cometa se zarandea. */
  tenso: boolean;
}

/** Una cometa inscrita en el concurso de la más bonita (por dueño). */
export interface CometaInscritaView {
  ownerId: string;
  ownerName: string;
  code: string;
  votes: number;
}

export interface CometasMine {
  /** Por quién votó en este festival (null si no ha votado; "?" si votó pero la sala no sabe por quién). */
  voto: string | null;
  /** Ya bajó la cometa del techo del garaje. */
  techo: boolean;
}

// ---------- Armar ----------

export type ArmarError = "off" | "far" | "code" | "materiales" | "full" | "busy";
export type ArmarResult = { ok: true; code: string } | { ok: false; error: ArmarError; faltan?: Record<string, number> };

export const ARMAR_ERROR_TEXT: Record<ArmarError, string> = {
  off: "El taller de cometas abre solo en el Festival de cometas.",
  far: "Arrímate a la mesa del taller.",
  code: "Esa cometa no se puede armar.",
  materiales: "No te alcanzan los materiales: papel, palitos y cabuya se consiguen en el puesto de cometas.",
  full: "No te cabe la cometa en la mochila.",
  busy: "Un momentico...",
};

/** Lo que le falta para armar una cometa con lo que lleva en la mochila (vacío = alcanza). */
export function faltanMateriales(code: string, have: (item: string) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [item, n] of Object.entries(cometaMateriales(code))) if (have(item) < n) out[item] = n - have(item);
  return out;
}

// ---------- Volar ----------

export type VolarError = "off" | "lejos" | "sin-cometa" | "lluvia" | "ya" | "ocupado" | "busy";

export const VOLAR_ERROR_TEXT: Record<VolarError, string> = {
  off: "Las cometas se vuelan durante el Festival de cometas.",
  lejos: "Las cometas se vuelan en el voladero de la loma, junto al observatorio.",
  "sin-cometa": "Lleva una cometa en la mano para volarla (se arma en el taller de la loma).",
  lluvia: "Con este aguacero no se puede volar: espera a que escampe.",
  ya: "Ya tienes una cometa en el aire.",
  ocupado: "Ahora no puedes volarla: párate en el pasto.",
  busy: "Un momentico...",
};

/** Lo que manda la sala al soltar la cometa: con esto el navegador juega el mismo vuelo. */
export interface VueloStart {
  ok: true;
  id: number;
  seed: number;
  viento: number;
  code: string;
}
export type VolarResult = VueloStart | { ok: false; error: VolarError };

/**
 * Cómo terminó: la recogió con lo que subió (`recogida`), se acabó el tiempo (`tiempo`, también cuenta), se
 * reventó el hilo (`rota`), se vino al suelo (`caida`), se movió o se fue (`cancelada`) o los datos no
 * cuadraron (`invalida`).
 */
export type VueloMotivo = "recogida" | "tiempo" | "rota" | "caida" | "cancelada" | "invalida";
export interface VueloEnd {
  id: number;
  motivo: VueloMotivo;
  /** La altura que contó (0 si no contó). */
  altura: number;
  /** Rompió el récord del día. */
  record: boolean;
}

export const VUELO_FIN_TEXT: Record<VueloMotivo, string> = {
  recogida: "Recogiste la cometa.",
  tiempo: "Se te cansó el brazo: recogiste la cometa.",
  rota: "¡Se reventó la cabuya! La cometa se fue con el viento… y cayó en el pasto, entera.",
  caida: "La cometa se vino al suelo. Dale más tensión cuando el viento afloje.",
  cancelada: "Soltaste la cometa.",
  invalida: "La cometa se enredó. Intenta de nuevo.",
};

/** ¿Ese final cuenta para el récord? */
export const vueloCuenta = (m: VueloMotivo) => m === "recogida" || m === "tiempo";

// ---------- El concurso de la más bonita ----------

export type CometaConcursoError = "off" | "far" | "sin-cometa" | "ya-inscrita" | "nadie" | "propia" | "votaste" | "busy";
export type CometaConcursoResult = { ok: true; accion: "inscribir" | "votar" } | { ok: false; error: CometaConcursoError };

export const COMETA_CONCURSO_ERROR_TEXT: Record<CometaConcursoError, string> = {
  off: "El concurso es durante el Festival de cometas.",
  far: "Arrímate al tablero del concurso.",
  "sin-cometa": "Lleva tu cometa en la mano para inscribirla.",
  "ya-inscrita": "Ya inscribiste una cometa en este festival.",
  nadie: "Esa cometa no está inscrita.",
  propia: "Por la tuya no se vale votar.",
  votaste: "Ya votaste en este festival. ¡Un voto por persona!",
  busy: "Un momentico...",
};

/** Clave de `UserStat` (máximo 1) del voto de un año del juego: un voto por persona por festival. */
export const cometasVoteKey = (año: number) => `festival:${COMETAS.id}:${año}:voto`;
/** Clave de `UserStat` (máximo 1): ya bajó la cometa del techo del garaje ese año. */
export const cometasTechoKey = (año: number) => `festival:${COMETAS.id}:${año}:techo`;
/** `refId` de los premios (se pagan una sola vez por festival). */
export const cometasPrizeRef = (año: number, premio: "alta" | "bonita") => `festival:${COMETAS.id}:${año}:${premio}`;

/** La más votada (con al menos un voto); en un empate, la que se inscribió primero. Null si nadie votó. */
export function cometaGanadora<T extends { votes: number; at: number }>(inscritas: readonly T[]): T | null {
  let best: T | null = null;
  for (const e of inscritas) if (e.votes > 0 && (!best || e.votes > best.votes || (e.votes === best.votes && e.at < best.at))) best = e;
  return best;
}

// ---------- El techo del garaje ----------

export type TechoError = "off" | "far" | "ya" | "full" | "busy";
export type TechoResult = { ok: true } | { ok: false; error: TechoError };

export const TECHO_ERROR_TEXT: Record<TechoError, string> = {
  off: "Eso es durante el Festival de cometas.",
  far: "Arrímate a la escalera del garaje.",
  ya: "Ya bajaste esa cometa.",
  full: "No te cabe en la mochila.",
  busy: "Un momentico...",
};

// ---------- El puesto ----------

/** Lo que se lleva en la mano del festival (dibujos en items.ts). */
export const COMETA_PERDIDA = "cometa-perdida";
export const GANCHO = "gancho-alambre";
export const RASPAO = "raspao";

export const COMETAS_BAG_OBJECTS: Record<string, BagObject> = {
  [MATERIAL.papel]: { name: "Papel de seda", blurb: "Un pliego de papel de seda de colores: con dos se forra una cometa en el taller de la loma.", kind: "objeto", max: 20 },
  [MATERIAL.palitos]: { name: "Palitos de guadua", blurb: "Varillas delgaditas de guadua para el armazón de la cometa.", kind: "objeto", max: 30 },
  [MATERIAL.hilo]: { name: "Carrete de cabuya", blurb: "Cabuya enrollada en un carrete de madera: sin hilo no hay cometa que suba.", kind: "objeto", max: 10 },
  [GANCHO]: { name: "Gancho de alambre", blurb: "Un alambre doblado en la punta de un palo: sirve para bajar cometas enredadas.", kind: "herramienta", max: 1 },
  [COMETA_PERDIDA]: { name: "Cometa de Santiago", blurb: "La bajaste del techo del garaje. Santiago la anda buscando en la loma.", kind: "objeto", max: 1 },
  [RASPAO]: { name: "Raspao", blurb: "Hielo raspado con melao de mora y leche condensada, en vasito.", kind: "comida", max: 10 },
};

export interface CometasShopItem {
  /** Id del objeto de la mochila (sin `obj:`). */
  id: string;
  name: string;
  price: number;
  /** Cuántos da una compra. */
  gives: number;
  /** La pestaña del puesto: lo de las cometas o lo del carrito del raspao. */
  tab: "cometas" | "refrescos";
}

export const COMETAS_SHOP: readonly CometasShopItem[] = [
  { id: MATERIAL.papel, name: "Papel de seda (2 pliegos)", price: 3, gives: 2, tab: "cometas" },
  { id: MATERIAL.palitos, name: "Palitos de guadua (3)", price: 3, gives: 3, tab: "cometas" },
  { id: MATERIAL.hilo, name: "Carrete de cabuya", price: 4, gives: 1, tab: "cometas" },
  { id: GANCHO, name: "Gancho de alambre", price: 3, gives: 1, tab: "cometas" },
  { id: RASPAO, name: "Raspao de mora", price: 5, gives: 1, tab: "refrescos" },
  { id: "salpicon", name: "Salpicón", price: 6, gives: 1, tab: "refrescos" },
];

export const cometasShopItem = (id: string): CometasShopItem | undefined => COMETAS_SHOP.find((i) => i.id === id);
/** El `refId` de la compra (`PURCHASE`). */
export const cometasRefId = (id: string) => `festival:${COMETAS.id}:${id}`;

export const CometasBuyMessage = z.object({ item: z.string().refine((v) => Boolean(cometasShopItem(v))) });

export type CometasBuyError = "off" | "far" | "funds" | "full" | "stack" | "busy" | "failed";
export type CometasBuyResult = { ok: true; item: string; balance: number } | { ok: false; item: string; error: CometasBuyError };

export const COMETAS_BUY_ERROR_TEXT: Record<CometasBuyError, string> = {
  off: "El puesto de cometas abre solo en el Festival de cometas.",
  far: "Arrímate al puesto de cometas o al carrito del raspao.",
  funds: "No te alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya llevas muchos de esos.",
  busy: "Un momentico...",
  failed: "No se pudo comprar. Intenta de nuevo.",
};

// ---------- Las opciones del taller (para el panel) ----------

export const FORMA_LETRAS = Object.keys(COMETA_FORMAS) as CometaFormaLetra[];
export const COLOR_LETRAS = Object.keys(COMETA_COLORES) as CometaColorLetra[];

// ---------- Las cinemáticas ----------

export const COMETAS_CINE = {
  primera: "cometas-primera",
  premiacion: "cometas-premiacion",
  premiacionAlta: "cometas-premiacion-alta",
  premiacionBonita: "cometas-premiacion-bonita",
  rescate: "cometas-rescate",
  armada: "cometas-armada",
} as const;

/** Donde se para la cámara en la loma (tiles del jardín: el medio del voladero). */
export const LOMA_CENTRO = { x: 123, y: 62 } as const;

/** Los niños de la loma (sus ids son los de la gente de la fiesta: el doble de la cinemática esconde al de verdad). */
export const MATEO = "cometas:mateo";
export const SOFI = "cometas:sofi";

/** Pintas de los niños de las cinemáticas (no son NPC fijos: van con `look`). */
const NINO_MATEO: Look = {
  accessories: [],
  skin: "#c68642",
  hair: "#2a1a10",
  shirt: "#3a8ad0",
  pants: "#3a4a6a",
  accent: "#f2c84a",
  hairStyle: "short",
  eyes: "big",
  top: "tshirt",
  bottom: "shorts",
  head: "cap",
  shoes: "sneakers",
  shoeColor: "#e8e4dc",
};
const NINA_SOFI: Look = { ...NINO_MATEO, skin: "#ffdbac", hair: "#7a4a1a", shirt: "#ee7aa8", hairStyle: "ponytail", head: undefined };

/**
 * La premiación al cierre: Aurora (con la cometa más bonita en la mano, si hay), Gloria con el récord del
 * día y Evelio que llega corriendo. Sale con los dos premios, o con el que haya (`alta` o `bonita`).
 */
function premiacion(cuales: "ambas" | "alta" | "bonita"): CineDef {
  const alta = cuales !== "bonita";
  const bonita = cuales !== "alta";
  const id = cuales === "ambas" ? COMETAS_CINE.premiacion : cuales === "alta" ? COMETAS_CINE.premiacionAlta : COMETAS_CINE.premiacionBonita;
  const steps: CineStep[] = [
    { op: "spawn", id: "aurora", like: "aurora", at: { dx: 5, dy: 2 }, facing: "left", ...(bonita ? { holds: "cometa:{codigo}" } : {}) },
    { op: "spawn", id: "gloria", like: "gloria", at: { dx: 6, dy: 3 }, facing: "left" },
    { op: "spawn", id: "evelio", like: "evelio", at: { dx: -5, dy: 3 }, facing: "right" },
    {
      op: "together",
      steps: [
        { op: "walk", who: "aurora", to: { dx: 2, dy: 1 } },
        { op: "walk", who: "gloria", to: { dx: 2, dy: 2 } },
        { op: "walk", who: "evelio", run: true, to: { dx: -2, dy: 1 } },
      ],
    },
    { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "gloria", toward: "yo" }, { op: "face", who: "evelio", toward: "yo" }] },
    { op: "sound", sound: "fanfarria" },
  ];
  if (alta)
    steps.push(
      {
        op: "together",
        steps: [
          { op: "flash", color: "oro", ms: 400 },
          { op: "title", text: "La cometa más alta", sub: "{alta} · {altura} metros", ms: 3000 },
          { op: "fx", fx: "confeti" },
          { op: "act", who: "gloria", action: "celebrar" },
        ],
      },
      { op: "say", who: "gloria", text: "La de {alta} llegó a {altura} metros. ¡Casi toca las nubes!", ms: 3200 },
    );
  if (bonita)
    steps.push(
      {
        op: "together",
        steps: [
          { op: "title", text: "La cometa más bonita", sub: "{bonita} · {votos} votos", ms: 3000 },
          { op: "act", who: "aurora", action: "girar" },
          { op: "fx", fx: "chispas", who: "aurora" },
        ],
      },
      { op: "say", who: "aurora", text: "Y la más bonita, por votación de todos, es la de {bonita}. Qué colores tan bien escogidos.", ms: 3400 },
    );
  steps.push(
    { op: "together", steps: [{ op: "sound", sound: "aplausos" }, { op: "emote", who: "yo", emote: "clap" }, { op: "act", who: "evelio", action: "saltar" }] },
    { op: "bubble", who: "evelio", text: "¡El año que viene gano yo con la de bagre!" },
    {
      op: "together",
      steps: [
        { op: "walk", who: "aurora", to: { dx: -3, dy: 5 } },
        { op: "walk", who: "gloria", to: { dx: -2, dy: 6 } },
        { op: "walk", who: "evelio", to: { dx: -6, dy: 4 } },
      ],
    },
    { op: "despawn", id: "aurora" },
    { op: "despawn", id: "gloria" },
    { op: "despawn", id: "evelio" },
  );
  return { id, kind: "momento", steps };
}

/** Las cinemáticas del Festival de cometas (se suman al catálogo). */
export const COMETAS_CINEMATICAS: readonly CineDef[] = [
  {
    // La primera cometa del día en el aire: los niños llegan corriendo a verla y Aurora la celebra.
    id: COMETAS_CINE.primera,
    kind: "momento",
    steps: [
      { op: "camera", to: { x: LOMA_CENTRO.x, y: LOMA_CENTRO.y - 2 }, zoom: 0.9, ms: 1200 },
      { op: "sound", sound: "brisa" },
      { op: "title", text: "¡La primera cometa del día!", sub: "{nombre} la puso a volar", ms: 2800 },
      { op: "spawn", id: MATEO, like: "evelio", look: NINO_MATEO, name: "Mateo", at: { x: LOMA_CENTRO.x - 6, y: LOMA_CENTRO.y + 4 }, facing: "right" },
      { op: "spawn", id: SOFI, like: "gloria", look: NINA_SOFI, name: "Sofi", at: { x: LOMA_CENTRO.x + 6, y: LOMA_CENTRO.y + 4 }, facing: "left" },
      { op: "spawn", id: "aurora", like: "aurora", at: { x: LOMA_CENTRO.x - 1, y: LOMA_CENTRO.y + 6 }, facing: "up" },
      {
        op: "together",
        steps: [
          { op: "walk", who: MATEO, run: true, path: [{ x: LOMA_CENTRO.x - 3, y: LOMA_CENTRO.y + 2 }, { x: LOMA_CENTRO.x - 1, y: LOMA_CENTRO.y + 1 }] },
          { op: "walk", who: SOFI, run: true, path: [{ x: LOMA_CENTRO.x + 3, y: LOMA_CENTRO.y + 2 }, { x: LOMA_CENTRO.x + 1, y: LOMA_CENTRO.y + 1 }] },
          { op: "walk", who: "aurora", to: { x: LOMA_CENTRO.x, y: LOMA_CENTRO.y + 3 } },
        ],
      },
      { op: "together", steps: [{ op: "face", who: MATEO, dir: "up" }, { op: "face", who: SOFI, dir: "up" }, { op: "face", who: "aurora", dir: "up" }] },
      {
        op: "together",
        steps: [
          { op: "act", who: MATEO, action: "saltar" },
          { op: "act", who: SOFI, action: "saltar" },
          { op: "bubble", who: MATEO, text: "¡Miren, miren cómo sube!" },
          { op: "emote", who: "yo", emote: "clap" },
        ],
      },
      { op: "say", who: "aurora", text: "Así se empieza un festival: con la primera cometa allá arriba. ¡A soltar las suyas!", ms: 3400 },
      { op: "together", steps: [{ op: "act", who: MATEO, action: "girar" }, { op: "act", who: SOFI, action: "bailar" }, { op: "fx", fx: "chispas", who: "aurora" }] },
      { op: "camera", to: "yo" },
      {
        op: "together",
        steps: [
          { op: "walk", who: MATEO, run: true, to: { x: LOMA_CENTRO.x - 7, y: LOMA_CENTRO.y + 5 } },
          { op: "walk", who: SOFI, run: true, to: { x: LOMA_CENTRO.x + 7, y: LOMA_CENTRO.y + 5 } },
          { op: "walk", who: "aurora", to: { x: LOMA_CENTRO.x - 2, y: LOMA_CENTRO.y + 8 } },
        ],
      },
      { op: "despawn", id: MATEO },
      { op: "despawn", id: SOFI },
      { op: "despawn", id: "aurora" },
    ],
  },
  premiacion("ambas"),
  premiacion("alta"),
  premiacion("bonita"),
  {
    // Mateo, cuando le bajan la cometa del árbol: sale corriendo con ella, la suelta y celebra.
    id: COMETAS_CINE.rescate,
    kind: "momento",
    steps: [
      { op: "spawn", id: MATEO, like: "evelio", look: NINO_MATEO, name: "Mateo", at: { dx: 1, dy: 1 }, facing: "up", holds: "cometa:{codigo}" },
      { op: "sound", sound: "destello" },
      { op: "together", steps: [{ op: "act", who: MATEO, action: "saltar" }, { op: "fx", fx: "chispas", who: MATEO }, { op: "title", text: "¡Cometa rescatada!", ms: 2200 }] },
      { op: "face", who: MATEO, toward: "yo" },
      { op: "say", who: MATEO, name: "Mateo", text: "¡Gracias, gracias! Ya creía que se iba a quedar a vivir en ese árbol.", ms: 3000 },
      { op: "walk", who: MATEO, run: true, path: [{ dx: 3, dy: 2 }, { dx: 5, dy: 0 }, { dx: 3, dy: -2 }] },
      { op: "together", steps: [{ op: "act", who: MATEO, action: "girar" }, { op: "bubble", who: MATEO, text: "¡Vuela, vuela!" }, { op: "emote", who: "yo", emote: "clap" }] },
      { op: "act", who: MATEO, action: "celebrar" },
      { op: "despawn", id: MATEO },
    ],
  },
  {
    id: COMETAS_CINE.armada,
    kind: "momento",
    steps: [
      { op: "flash", color: "blanco", ms: 300 },
      { op: "sound", sound: "destello" },
      { op: "fx", fx: "chispas", who: "yo" },
      { op: "title", text: "¡Cometa lista!", sub: "{nombre}: vuélala con F en el voladero", ms: 2600 },
    ],
  },
];

/** Los pasos de la cinemática que mencionan una cometa (para los tests: todas llevan su código). */
export const cineConCometa = (steps: readonly CineStep[]) => steps.some((s) => s.op === "spawn" && s.holds?.startsWith("cometa:"));
