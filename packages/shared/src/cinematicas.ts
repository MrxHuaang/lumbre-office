// Las cinemáticas: secuencias de pasos que el navegador reproduce encima de la escena (franjas de cine,
// fundidos, la cámara que se mueve, actores que caminan, miran, hacen emotes y hablan en un cuadro con su
// retrato, títulos grandes, sonidos y destellos, y opciones al final). Son datos, como los encargos: aquí
// solo se describen y se validan; las reproduce `game/cinematicas` (docs/plan-historia.md, VIR-155).
//
// Hay dos tipos:
// - `historia`: toman la pantalla (franjas, no se camina) y esperan a que se lea cada línea;
// - `momento`: cortas y sin franjas, encima del juego sin quitar el control (subir de nivel, un pez
//   legendario, el jackpot…). Se pueden apagar en Ajustes, y el modo trabajo las salta.
// Los textos aceptan variables `{nombre}` que llena quien la dispara (`fillCine`).
import type { Direction } from "./protocol";
import { EMOTE_IDS, type EmoteGesture, type EmoteId } from "./emotes";
import { FESTIVAL_CINEMATICAS } from "./festivales";
import { CAPITULO2_CINEMATICAS } from "./capitulo2";

/** Quién hace algo: el jugador ("yo"), un NPC fijo (por su id) o un actor que la cinemática pone (`extra`). */
export type CineActor = string;
export const CINE_ME = "yo";

/** Los NPC que hay en el mundo (lo que dibuja `game/npcs/cast.ts`). */
export const CINE_NPCS = ["aurora", "gloria", "evelio", "astronoma", "crupier", "dealer", "cajera", "portero"] as const;

/** Sonidos que puede pedir una cinemática (los resuelve el navegador con sus efectos). */
export const CINE_SOUNDS = ["fanfarria", "campanada", "campanadas", "carta", "destello", "tambor", "aplausos", "brisa", "trueno", "magia"] as const;
export type CineSound = (typeof CINE_SOUNDS)[number];

/** Efectos sobre un actor (o la pantalla). */
export const CINE_FX = ["confeti", "chispas", "celebrar", "corazones", "estrellas"] as const;
export type CineFx = (typeof CINE_FX)[number];

export type CineStep =
  /** Franjas negras arriba y abajo (entran o salen). */
  | { op: "bars"; on: boolean }
  /** Fundido a un color o de vuelta a la escena. */
  | { op: "fade"; to: "black" | "white" | "clear"; ms?: number }
  /** Un destello de color (oro por defecto). */
  | { op: "flash"; color?: "oro" | "blanco" | "rosa"; ms?: number }
  /** La cámara se va hacia un actor o un tile del nivel (y acerca o aleja); `yo` la devuelve al jugador. */
  | { op: "camera"; to: CineActor | { x: number; y: number }; zoom?: number; ms?: number }
  /** Sacudida de la cámara. */
  | { op: "shake"; ms?: number; strength?: number }
  /** Un cuadro de diálogo con retrato. En `historia` espera a que se lea; en `momento` dura `ms`. */
  | { op: "say"; who: CineActor; text: string; name?: string; ms?: number }
  /** Una burbuja sobre la cabeza (no espera). */
  | { op: "bubble"; who: CineActor; text: string }
  /** Un título grande al centro (y un subtítulo). */
  | { op: "title"; text: string; sub?: string; ms?: number }
  /** Un actor camina hasta un tile (solo NPC o actores puestos por la cinemática: al jugador lo mueve el servidor). */
  | { op: "walk"; who: CineActor; to: { x: number; y: number }; ms?: number }
  | { op: "face"; who: CineActor; dir: Direction }
  | { op: "emote"; who: CineActor; emote: EmoteId }
  | { op: "gesture"; who: CineActor; kind: EmoteGesture }
  /** Pone un actor (con la pinta de un NPC) en un tile del nivel, y lo quita. */
  | { op: "spawn"; id: string; like: (typeof CINE_NPCS)[number]; name?: string; at: { x: number; y: number }; facing?: Direction }
  | { op: "despawn"; id: string }
  | { op: "sound"; sound: CineSound }
  | { op: "fx"; fx: CineFx; who?: CineActor }
  | { op: "wait"; ms: number }
  /** Opciones al final (solo en `historia`): cada una puede pedir una acción del navegador. */
  | { op: "choice"; prompt?: string; options: readonly CineOption[] };

export interface CineOption {
  id: string;
  label: string;
  /** Lo que hace el navegador al elegirla (ver `onCineAction` de game/cinematicas). */
  action?: string;
}

export type CineKind = "historia" | "momento";

export interface CineDef {
  id: string;
  kind: CineKind;
  steps: readonly CineStep[];
}

/** Lo que dura por defecto cada paso que no espera (ms). */
export const CINE_MS = {
  fade: 600,
  flash: 350,
  camera: 900,
  shake: 400,
  title: 2200,
  sayMoment: 2400,
  walk: 1200,
  /** Velocidad del texto que se escribe (caracteres por segundo). */
  typeCps: 48,
} as const;

/** Cambia `{var}` por su valor (lo que no venga queda como estaba). */
export function fillCine(text: string, vars: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

// ---------- El catálogo ----------

const say = (who: CineActor, text: string, extra: Partial<Extract<CineStep, { op: "say" }>> = {}): CineStep => ({ op: "say", who, text, ...extra });

export const CINEMATICAS: Record<string, CineDef> = {
  // La bienvenida de Doña Aurora a quien recién llega (antes del cuadro de la historia).
  prologo: {
    id: "prologo",
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "aurora", zoom: 1.4 },
      { op: "gesture", who: "aurora", kind: "wave" },
      say("aurora", "¡Ay, bienvenido, mijo! Yo soy Aurora, la que cuida esta casa desde que el cuidador de antes se fue… sin decir ni adiós."),
      { op: "emote", who: "aurora", emote: "heart" },
      say("aurora", "La cabaña es grande y tiene sus mañas: el lago, el sótano, el observatorio… y uno que otro misterio."),
      say("aurora", "Le enseño lo básico en cinco pasitos, sin afán. ¿Le muestro la casa?"),
      {
        op: "choice",
        options: [
          { id: "si", label: "Sí, muéstreme la casa" },
          { id: "ya", label: "Ya me la conozco", action: "saltar-historia" },
        ],
      },
      { op: "camera", to: CINE_ME },
      { op: "bars", on: false },
    ],
  },
  // Llegó la carta del cuidador (capítulo terminado).
  capitulo: {
    id: "capitulo",
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "fx", fx: "estrellas", who: CINE_ME },
      { op: "sound", sound: "fanfarria" },
      { op: "title", text: "Capítulo {n} terminado", sub: "{titulo}" },
      { op: "sound", sound: "carta" },
      say("narrador", "Al buzón del jardín llegó una carta. No trae remitente: solo una inicial.", { name: "" }),
      { op: "bars", on: false },
    ],
  },
  // Subir de nivel en un oficio.
  "oficio-nivel": {
    id: "oficio-nivel",
    kind: "momento",
    steps: [
      { op: "flash", color: "oro" },
      { op: "fx", fx: "chispas", who: CINE_ME },
      { op: "emote", who: CINE_ME, emote: "star" },
      { op: "title", text: "¡{oficio} nivel {nivel}!", sub: "{premio}", ms: 2600 },
    ],
  },
  // Un pez legendario o mítico.
  "pez-legendario": {
    id: "pez-legendario",
    kind: "momento",
    steps: [
      { op: "shake", ms: 350, strength: 0.004 },
      { op: "flash", color: "oro", ms: 450 },
      { op: "sound", sound: "magia" },
      { op: "emote", who: CINE_ME, emote: "surprise" },
      { op: "fx", fx: "confeti", who: CINE_ME },
      { op: "title", text: "¡{pez}!", sub: "{rareza} · {cm} cm", ms: 3000 },
    ],
  },
  // El primero en ver la estrella fugaz.
  "estrella-fugaz": {
    id: "estrella-fugaz",
    kind: "momento",
    steps: [
      { op: "flash", color: "blanco", ms: 300 },
      { op: "fx", fx: "estrellas", who: CINE_ME },
      { op: "sound", sound: "magia" },
      { op: "title", text: "Pide un deseo", sub: "La viste primero", ms: 2600 },
    ],
  },
  // El jackpot del tragamonedas.
  jackpot: {
    id: "jackpot",
    kind: "momento",
    steps: [
      { op: "shake", ms: 500, strength: 0.006 },
      { op: "flash", color: "oro", ms: 500 },
      { op: "sound", sound: "fanfarria" },
      { op: "fx", fx: "confeti", who: CINE_ME },
      { op: "fx", fx: "celebrar", who: CINE_ME },
      { op: "title", text: "¡JACKPOT!", sub: "+{puntos} puntos", ms: 3000 },
    ],
  },
  // Adoptar una mascota.
  "mascota-adoptada": {
    id: "mascota-adoptada",
    kind: "momento",
    steps: [
      { op: "fx", fx: "corazones", who: CINE_ME },
      { op: "emote", who: CINE_ME, emote: "heart" },
      { op: "title", text: "{mascota} ahora es tuya", sub: "Te va a seguir por toda la cabaña", ms: 2600 },
    ],
  },
  // Un logro legendario.
  "logro-legendario": {
    id: "logro-legendario",
    kind: "momento",
    steps: [
      { op: "flash", color: "oro", ms: 400 },
      { op: "sound", sound: "fanfarria" },
      { op: "fx", fx: "estrellas", who: CINE_ME },
      { op: "title", text: "{logro}", sub: "Logro legendario", ms: 2800 },
    ],
  },
  // El primer huevo del día en el gallinero.
  "primer-huevo": {
    id: "primer-huevo",
    kind: "momento",
    steps: [
      { op: "fx", fx: "chispas", who: CINE_ME },
      { op: "emote", who: CINE_ME, emote: "ok" },
      { op: "title", text: "¡El primer huevo del día!", sub: "Madrugar tiene su premio", ms: 2200 },
    ],
  },
  // Cumpleaños de alguien conectado (para quien cumple).
  cumpleanos: {
    id: "cumpleanos",
    kind: "momento",
    steps: [
      { op: "flash", color: "rosa", ms: 400 },
      { op: "sound", sound: "aplausos" },
      { op: "fx", fx: "confeti", who: CINE_ME },
      { op: "emote", who: CINE_ME, emote: "party" },
      { op: "title", text: "¡Feliz cumpleaños, {nombre}!", sub: "Toda la cabaña te celebra", ms: 3200 },
    ],
  },
};

// Las de los festivales (apertura, cierre y llegada tarde) viven con los festivales.
for (const def of FESTIVAL_CINEMATICAS) CINEMATICAS[def.id] = def;
// Las de los capítulos de la historia, con su contenido.
for (const def of CAPITULO2_CINEMATICAS) CINEMATICAS[def.id] = def;

export const cineById = (id: string): CineDef | undefined => CINEMATICAS[id];

/**
 * Lo que está mal en una cinemática (vacío = bien): opciones solo al final y solo en `historia`, actores que
 * existen (NPC, "yo", "narrador" o puestos antes con `spawn`), emotes conocidos y franjas cerradas.
 */
export function cineProblems(def: CineDef): string[] {
  const out: string[] = [];
  const known = new Set<string>([CINE_ME, "narrador", ...CINE_NPCS]);
  let bars = false;
  def.steps.forEach((s, i) => {
    const at = `${def.id}#${i}`;
    const actor = (who: string | undefined) => {
      if (who !== undefined && !known.has(who)) out.push(`${at}: actor desconocido "${who}"`);
    };
    switch (s.op) {
      case "bars":
        bars = s.on;
        if (s.on && def.kind === "momento") out.push(`${at}: un momento no lleva franjas`);
        break;
      case "say":
      case "bubble":
      case "emote":
      case "gesture":
      case "face":
        actor(s.who);
        if (s.op === "emote" && !(EMOTE_IDS as readonly string[]).includes(s.emote)) out.push(`${at}: emote "${s.emote}"`);
        break;
      case "walk":
        actor(s.who);
        if (s.who === CINE_ME) out.push(`${at}: al jugador no se le camina (lo mueve el servidor)`);
        break;
      case "fx":
        actor(s.who);
        break;
      case "camera":
        if (typeof s.to === "string") actor(s.to);
        break;
      case "spawn":
        known.add(s.id);
        break;
      case "despawn":
        known.delete(s.id);
        break;
      case "choice":
        if (def.kind !== "historia") out.push(`${at}: un momento no lleva opciones`);
        if (s.options.length < 2) out.push(`${at}: una opción sola no es elegir`);
        if (new Set(s.options.map((o) => o.id)).size !== s.options.length) out.push(`${at}: opciones repetidas`);
        break;
    }
  });
  if (bars) out.push(`${def.id}: las franjas quedan puestas al final`);
  return out;
}
