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
import { BRUJAS_CINEMATICAS } from "./noche-brujas";
import { CARNAVAL_CINEMATICAS } from "./carnaval";
import { CAPITULO2_CINEMATICAS } from "./capitulo2";
import { CAPITULO3_CINEMATICAS } from "./capitulo3";
import { FERIA_CINEMATICAS } from "./feria-flores";
import { NOVENA_CINEMATICAS } from "./novenas";
import { ANO_VIEJO_CINEMATICAS } from "./ano-viejo";
import { AMOR_CINEMATICAS } from "./amor-amistad";
import type { Look } from "./look";

/** Quién hace algo: el jugador ("yo"), un NPC fijo (por su id) o un actor que la cinemática pone (`extra`). */
export type CineActor = string;
export const CINE_ME = "yo";

/** Los NPC que hay en el mundo (lo que dibuja `game/npcs/cast.ts`). */
export const CINE_NPCS = ["aurora", "gloria", "evelio", "astronoma", "crupier", "dealer", "cajera", "portero"] as const;

/** Sonidos que puede pedir una cinemática (los resuelve el navegador con sus efectos). */
export const CINE_SOUNDS = ["fanfarria", "campanada", "campanadas", "carta", "destello", "tambor", "aplausos", "brisa", "trueno", "magia", "chapuzon", "guanena", "murga"] as const;
export type CineSound = (typeof CINE_SOUNDS)[number];

/** Efectos sobre un actor (o la pantalla). */
export const CINE_FX = ["confeti", "chispas", "celebrar", "corazones", "estrellas"] as const;
export type CineFx = (typeof CINE_FX)[number];

/**
 * Un lugar de la escena: un tile del nivel (`x`, `y`), relativo a donde estaba el jugador al empezar la
 * cinemática (`dx`, `dy` en tiles: así funciona en cualquier nivel y en cualquier punto) o junto a un actor
 * (`near`, más `dx`/`dy`; si el actor no está, cuenta desde el jugador).
 */
export type CinePos = { x: number; y: number } | { dx: number; dy: number } | { near: CineActor; dx?: number; dy?: number };

/** Lo que un actor hace en el sitio. */
export const CINE_ACTIONS = ["girar", "saltar", "bailar", "celebrar", "asentir", "temblar", "saludar"] as const;
export type CineAction = (typeof CINE_ACTIONS)[number];

export type CineStep =
  /** Franjas negras arriba y abajo (entran o salen). */
  | { op: "bars"; on: boolean }
  /** Fundido a un color o de vuelta a la escena. */
  | { op: "fade"; to: "black" | "white" | "clear"; ms?: number }
  /** Un destello de color (oro por defecto). */
  | { op: "flash"; color?: "oro" | "blanco" | "rosa"; ms?: number }
  /**
   * La cámara se va hacia un actor o un lugar (y acerca o aleja); `yo` la devuelve al jugador. Con `follow`,
   * se queda pegada al actor mientras camina (hasta la próxima cámara).
   */
  | { op: "camera"; to: CineActor | CinePos; zoom?: number; ms?: number; follow?: boolean }
  /** Sacudida de la cámara. */
  | { op: "shake"; ms?: number; strength?: number }
  /** Una línea en la tira de conversación, con retrato y voz. En `historia` espera a que se lea; en `momento` dura `ms`. */
  | { op: "say"; who: CineActor; text: string; name?: string; ms?: number }
  /** Un murmullo sobre la cabeza, sin caja (no espera). */
  | { op: "bubble"; who: CineActor; text: string }
  /** Un título grande al centro (y un subtítulo). */
  | { op: "title"; text: string; sub?: string; ms?: number }
  /**
   * Un actor camina (o corre) hasta un lugar, o por varios en orden (`path`). Al jugador solo se lo mueve en
   * las de historia y solo en pantalla: al terminar vuelve a donde estaba (lo que cuenta lo lleva el servidor).
   */
  | { op: "walk"; who: CineActor; to?: CinePos; path?: readonly CinePos[]; run?: boolean; ms?: number }
  /** Mira hacia un lado o hacia otro actor. */
  | { op: "face"; who: CineActor; dir?: Direction; toward?: CineActor }
  | { op: "emote"; who: CineActor; emote: EmoteId }
  | { op: "gesture"; who: CineActor; kind: EmoteGesture }
  /** Algo que el actor hace en el sitio: girar, saltar, bailar, celebrar… */
  | { op: "act"; who: CineActor; action: CineAction }
  /**
   * Pone un actor (con la pinta de un NPC) en un lugar, y lo quita. `holds`: lo que lleva en la mano (un
   * id de los dibujos de la mano, como la silleta de los silleteros; acepta `{variables}`). `look`: otra pinta
   * (la gente de la fiesta, como Cupido o el trío de la serenata); sin esto, la del NPC de `like`.
   */
  | { op: "spawn"; id: string; like: (typeof CINE_NPCS)[number]; name?: string; at: CinePos; facing?: Direction; holds?: string; look?: Look }
  | { op: "despawn"; id: string }
  | { op: "sound"; sound: CineSound }
  | { op: "fx"; fx: CineFx; who?: CineActor }
  | { op: "wait"; ms: number }
  /** Varios pasos a la vez (dos que caminan juntos, alguien que habla mientras otro baila); espera a todos. */
  | { op: "together"; steps: readonly CineStep[] }
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
  /** Lo que tarda en cruzar un tile caminando y corriendo (si el paso no dice cuánto). */
  walkTile: 300,
  runTile: 150,
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
  // La bienvenida de Doña Aurora a quien recién llega (antes del cuadro de la historia): llega caminando,
  // saluda, cuenta lo de la casa y se va hacia la cabaña.
  prologo: {
    id: "prologo",
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 6, dy: 2 }, facing: "left" },
      { op: "camera", to: "aurora", zoom: 1.35, follow: true },
      { op: "walk", who: "aurora", path: [{ dx: 4, dy: 2 }, { dx: 2, dy: 1 }, { dx: 1, dy: 0 }] },
      { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "yo", toward: "aurora" }] },
      { op: "act", who: "aurora", action: "saludar" },
      say("aurora", "¡Ay, qué bueno que llegó! Yo soy Aurora, la que cuida esta casa desde que el cuidador de antes se fue… sin decir ni adiós."),
      { op: "emote", who: "yo", emote: "wave" },
      { op: "emote", who: "aurora", emote: "heart" },
      { op: "walk", who: "aurora", path: [{ dx: 1, dy: -2 }, { dx: 3, dy: -2 }] },
      { op: "face", who: "aurora", toward: "yo" },
      say("aurora", "Mire todo esto: el lago, el sótano, el observatorio allá arriba… La cabaña es grande y tiene sus mañas. Y uno que otro misterio."),
      { op: "walk", who: "aurora", to: { dx: 1, dy: 0 } },
      { op: "face", who: "aurora", toward: "yo" },
      say("aurora", "Le enseño lo básico en cinco pasitos, sin afán. ¿Le muestro la casa?"),
      {
        op: "choice",
        options: [
          { id: "si", label: "Sí, muéstreme la casa" },
          { id: "ya", label: "Ya me la conozco", action: "saltar-historia" },
        ],
      },
      { op: "act", who: "aurora", action: "asentir" },
      { op: "together", steps: [{ op: "walk", who: "aurora", path: [{ dx: 3, dy: 1 }, { dx: 7, dy: 2 }] }, { op: "camera", to: "yo" }] },
      { op: "despawn", id: "aurora" },
      { op: "bars", on: false },
    ],
  },
  // Terminó un capítulo: Doña Gloria llega corriendo con la carta.
  capitulo: {
    id: "capitulo",
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "yo", zoom: 1.3 },
      { op: "together", steps: [{ op: "sound", sound: "fanfarria" }, { op: "act", who: "yo", action: "celebrar" }, { op: "fx", fx: "estrellas", who: "yo" }] },
      { op: "title", text: "Capítulo {n} terminado", sub: "{titulo}" },
      { op: "spawn", id: "gloria", like: "gloria", at: { dx: -6, dy: 3 }, facing: "right" },
      { op: "walk", who: "gloria", run: true, path: [{ dx: -3, dy: 2 }, { dx: -1, dy: 0 }] },
      { op: "together", steps: [{ op: "face", who: "gloria", toward: "yo" }, { op: "face", who: "yo", toward: "gloria" }] },
      { op: "bubble", who: "gloria", text: "¡Correo! ¡Correo!" },
      { op: "sound", sound: "carta" },
      { op: "act", who: "gloria", action: "saltar" },
      say("gloria", "Llegó esto al buzón del jardín. No trae remitente: solo una E. Yo no la abrí… bueno, la miré contra la luz."),
      { op: "emote", who: "yo", emote: "surprise" },
      { op: "act", who: "gloria", action: "saludar" },
      { op: "walk", who: "gloria", path: [{ dx: -3, dy: 2 }, { dx: -7, dy: 3 }] },
      { op: "despawn", id: "gloria" },
      { op: "bars", on: false },
    ],
  },
  // Subir de nivel en un oficio.
  "oficio-nivel": {
    id: "oficio-nivel",
    kind: "momento",
    steps: [
      { op: "flash", color: "oro" },
      { op: "together", steps: [{ op: "act", who: "yo", action: "saltar" }, { op: "fx", fx: "chispas", who: "yo" }] },
      { op: "emote", who: "yo", emote: "star" },
      { op: "title", text: "¡{oficio} nivel {nivel}!", sub: "{premio}", ms: 2600 },
      { op: "act", who: "yo", action: "celebrar" },
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
      { op: "together", steps: [{ op: "emote", who: "yo", emote: "surprise" }, { op: "act", who: "yo", action: "saltar" }] },
      { op: "fx", fx: "confeti", who: "yo" },
      { op: "title", text: "¡{pez}!", sub: "{rareza} · {cm} cm", ms: 3000 },
      { op: "act", who: "yo", action: "girar" },
    ],
  },
  // El primero en ver la estrella fugaz.
  "estrella-fugaz": {
    id: "estrella-fugaz",
    kind: "momento",
    steps: [
      { op: "face", who: "yo", dir: "up" },
      { op: "flash", color: "blanco", ms: 300 },
      { op: "fx", fx: "estrellas", who: "yo" },
      { op: "sound", sound: "magia" },
      { op: "act", who: "yo", action: "saltar" },
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
      { op: "together", steps: [{ op: "fx", fx: "confeti", who: "yo" }, { op: "act", who: "yo", action: "bailar" }] },
      { op: "title", text: "¡JACKPOT!", sub: "+{puntos} puntos", ms: 3000 },
      { op: "act", who: "yo", action: "girar" },
      { op: "act", who: "yo", action: "celebrar" },
    ],
  },
  // Adoptar una mascota.
  "mascota-adoptada": {
    id: "mascota-adoptada",
    kind: "momento",
    steps: [
      { op: "together", steps: [{ op: "fx", fx: "corazones", who: "yo" }, { op: "act", who: "yo", action: "saltar" }] },
      { op: "emote", who: "yo", emote: "heart" },
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
      { op: "together", steps: [{ op: "fx", fx: "estrellas", who: "yo" }, { op: "act", who: "yo", action: "girar" }] },
      { op: "title", text: "{logro}", sub: "Logro legendario", ms: 2800 },
      { op: "act", who: "yo", action: "celebrar" },
    ],
  },
  // El primer huevo del día en el gallinero.
  "primer-huevo": {
    id: "primer-huevo",
    kind: "momento",
    steps: [
      { op: "together", steps: [{ op: "fx", fx: "chispas", who: "yo" }, { op: "act", who: "yo", action: "saltar" }] },
      { op: "emote", who: "yo", emote: "ok" },
      { op: "title", text: "¡El primer huevo del día!", sub: "Madrugar tiene su premio", ms: 2200 },
    ],
  },
  // Cumpleaños de quien entra: Aurora y Gloria llegan a cantarle.
  cumpleanos: {
    id: "cumpleanos",
    kind: "momento",
    steps: [
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 4, dy: 1 }, facing: "left" },
      { op: "spawn", id: "gloria", like: "gloria", at: { dx: -4, dy: 1 }, facing: "right" },
      {
        op: "together",
        steps: [
          { op: "walk", who: "aurora", run: true, to: { dx: 1, dy: 1 } },
          { op: "walk", who: "gloria", run: true, to: { dx: -1, dy: 1 } },
        ],
      },
      { op: "flash", color: "rosa", ms: 400 },
      { op: "sound", sound: "aplausos" },
      { op: "fx", fx: "confeti", who: "yo" },
      {
        op: "together",
        steps: [
          { op: "act", who: "aurora", action: "bailar" },
          { op: "act", who: "gloria", action: "bailar" },
          { op: "emote", who: "yo", emote: "party" },
          { op: "title", text: "¡Feliz cumpleaños, {nombre}!", sub: "Toda la cabaña te celebra", ms: 3200 },
        ],
      },
      { op: "bubble", who: "aurora", text: "¡Que los cumpla feliz!" },
      {
        op: "together",
        steps: [
          { op: "walk", who: "aurora", to: { dx: 5, dy: 1 } },
          { op: "walk", who: "gloria", to: { dx: -5, dy: 1 } },
        ],
      },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "gloria" },
    ],
  },
};

// Las de los festivales (apertura, cierre y llegada tarde) viven con los festivales; las de la Noche de
// brujas (la calabaza dorada y los trucos), las de la Feria de las flores (el desfile, la premiación) y
// las del Carnaval, con sus reglas.
for (const def of [...FESTIVAL_CINEMATICAS, ...BRUJAS_CINEMATICAS, ...FERIA_CINEMATICAS, ...CARNAVAL_CINEMATICAS]) CINEMATICAS[def.id] = def;
// Las de los capítulos de la historia, con su contenido.
for (const def of [...CAPITULO2_CINEMATICAS, ...CAPITULO3_CINEMATICAS]) CINEMATICAS[def.id] = def;
// Las de las novenas (la figura del pesebre y cada noche de la novena).
for (const def of NOVENA_CINEMATICAS) CINEMATICAS[def.id] = def;
// Las del Año viejo (la quema del muñeco, la cuenta regresiva y los agüeros).
for (const def of ANO_VIEJO_CINEMATICAS) CINEMATICAS[def.id] = def;
// Las de Amor y amistad (Cupido con la carta; la revelación y la serenata se arman con sus datos).
for (const def of AMOR_CINEMATICAS) CINEMATICAS[def.id] = def;

export const cineById = (id: string): CineDef | undefined => CINEMATICAS[id];

/**
 * Lo que está mal en una cinemática (vacío = bien): opciones solo al final y solo en `historia`, actores que
 * existen (NPC, "yo", "narrador" o puestos antes con `spawn`), emotes conocidos y franjas cerradas.
 */
export function cineProblems(def: CineDef): string[] {
  const out: string[] = [];
  const known = new Set<string>([CINE_ME, "narrador", ...CINE_NPCS]);
  let bars = false;
  const check = (s: CineStep, at: string, nested: boolean) => {
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
      case "act":
        actor(s.who);
        if (s.op === "emote" && !(EMOTE_IDS as readonly string[]).includes(s.emote)) out.push(`${at}: emote "${s.emote}"`);
        if (s.op === "act" && !(CINE_ACTIONS as readonly string[]).includes(s.action)) out.push(`${at}: acción "${s.action}"`);
        if (s.op === "say" && nested && def.kind === "historia") out.push(`${at}: un diálogo que espera no va dentro de together`);
        break;
      case "face":
        actor(s.who);
        actor(s.toward);
        if (!s.dir && !s.toward) out.push(`${at}: face sin dir ni toward`);
        break;
      case "walk":
        actor(s.who);
        for (const p of [...(s.to ? [s.to] : []), ...(s.path ?? [])]) if ("near" in p) actor(p.near);
        if (!s.to && !s.path?.length) out.push(`${at}: walk sin destino`);
        if (s.who === CINE_ME && def.kind === "momento") out.push(`${at}: en un momento el jugador no camina (no toma la pantalla)`);
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
      case "together":
        s.steps.forEach((t, j) => check(t, `${at}.${j}`, true));
        break;
      case "choice":
        if (nested) out.push(`${at}: las opciones no van dentro de together`);
        if (def.kind !== "historia") out.push(`${at}: un momento no lleva opciones`);
        if (s.options.length < 2) out.push(`${at}: una opción sola no es elegir`);
        if (new Set(s.options.map((o) => o.id)).size !== s.options.length) out.push(`${at}: opciones repetidas`);
        break;
    }
  };
  def.steps.forEach((s, i) => check(s, `${def.id}#${i}`, false));
  if (bars) out.push(`${def.id}: las franjas quedan puestas al final`);
  return out;
}
