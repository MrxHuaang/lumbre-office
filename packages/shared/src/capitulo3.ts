// Capítulo 3 de la historia, "La llavecita del lago" (docs/plan-historia.md, VIR-152). La carta 2 dijo que la
// llave estaba "donde todo lo que se pierde termina llegando" (el lago), que le preguntaran a Celeste por "el
// agua que brilla" y a Evelio por "la carnada que yo usaba". Los pasos se reparten entre los tres: la Profe
// Celeste cuenta cuándo brilla el agua, Don Evelio se hace el loco y al final da la receta de la carnada,
// que se cocina en la estufa; con el agua brillando y la carnada en la mochila sale la llavecita oxidada
// del lago, y Doña Aurora la reconoce. La llave no se entrega: es de quien la sacó (abre el capítulo 4).
//
// Cada paso sigue un contador propio (`HISTORIA_LAGO`) que suma la sala del capítulo
// (apps/server/src/rooms/capitulo3.ts), solo con ese paso abierto.
import type { StoryLetter, Capitulo, StoryTarget } from "./historia";
import type { BagObject } from "./bolsa";
import type { Recipe } from "./cocina";
import type { QuestDef, QuestGiverId, QuestSkill } from "./encargos";
import type { CineDef } from "./cinematicas";
import { HONEY } from "./huerto";
import type { Weather } from "./weather";

/** Los contadores de los pasos (UserStat; los suma la sala solo con el paso abierto). */
export const HISTORIA_LAGO = {
  celeste: "historia:agua-celeste",
  receta: "historia:receta-evelio",
  carnada: "historia:carnada-e",
  llave: "historia:llave",
  mostrada: "historia:llave-mostrada",
} as const;

/** Los objetos del capítulo (de historia: no se tiran, regalan ni intercambian). */
export const OBJETOS_LAGO = {
  carnada: "carnada-e",
  llave: "llave-oxidada",
} as const;

export const OBJETOS_LAGO_BOLSA: Readonly<Record<string, BagObject>> = {
  [OBJETOS_LAGO.carnada]: { name: "Carnada de E.", blurb: "Masa de mazorca con miel y fresa machacada, la receta que Don Evelio no quería soltar.", kind: "objeto", max: 1, story: true },
  [OBJETOS_LAGO.llave]: { name: "Llavecita oxidada", blurb: "Salió del lago una noche que el agua brillaba. Tiene grabada una E y abre algo en el sótano.", kind: "objeto", max: 1, story: true },
};

/** Las paradas del capítulo. */
export const LAGO_PASOS = {
  celeste: "llave-1",
  evelio: "llave-2",
  carnada: "llave-3",
  pescar: "llave-4",
  aurora: "llave-5",
} as const;

// ---------- El agua que brilla ----------

/**
 * Cuándo brilla el lago (lo que cuenta la Profe Celeste): de noche del juego con la luna alta, de las 9 de
 * la noche a las 3 de la mañana, y con el cielo limpio (con lluvia, tormenta o niebla la luna no llega al agua).
 */
export const AGUA_BRILLA = {
  /** Minuto del día (reloj del juego) en que empieza. */
  from: 21 * 60,
  /** Minuto del día en que se apaga (ya de madrugada). */
  until: 3 * 60,
  /** Con estos climas no brilla. */
  sinBrillo: ["lluvia", "tormenta", "niebla"] as readonly Weather[],
} as const;

/** ¿Brilla el agua del lago? (minuto del día del reloj del juego y el clima de afuera). */
export function aguaBrilla(minuteOfDay: number, weather: Weather): boolean {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  const hora = m >= AGUA_BRILLA.from || m < AGUA_BRILLA.until;
  return hora && !AGUA_BRILLA.sinBrillo.includes(weather);
}

/** Dónde se pesca la llave: el lago del jardín. */
export const LAGO_AREA = "jardin";

// ---------- La carnada de E. ----------

/**
 * La receta de Don Evelio (va en la estufa con los platos): no se come y solo se cocina con el paso de
 * cocinarla (o el de pescar) abierto. Una sola en la mochila.
 */
export const CARNADA_E_RECIPE: Recipe = {
  id: OBJETOS_LAGO.carnada,
  name: "Carnada de E.",
  blurb: "Masa de mazorca, un chorrito de miel y fresa machacada. A los peces de noche les encanta (dizque).",
  needs: { mazorca: 1, [HONEY]: 1, fresa: 1 },
  effect: { kind: "story" },
  // No se come (no está en CONSUMABLES): esto solo llena el tipo.
  action: "bite",
  uses: 1,
  story: [LAGO_PASOS.carnada, LAGO_PASOS.pescar],
};

// ---------- Los pasos ----------

const step = (n: number, giver: QuestGiverId, stat: string, skill: QuestSkill, title: string, text: string): QuestDef => ({
  id: `llave-${n}`,
  kind: "story",
  giver,
  title,
  text,
  stat,
  goal: 1,
  reward: { points: 6, skill, xp: 20 },
  ...(n < 5 ? { next: `llave-${n + 1}` } : {}),
});

const STEPS: readonly QuestDef[] = [
  step(1, "celeste", HISTORIA_LAGO.celeste, "exploracion", "El agua que brilla", "E. mandó a preguntarle a la Profe Celeste por el agua que brilla. Búsquela en el observatorio."),
  step(2, "evelio", HISTORIA_LAGO.receta, "social", "La carnada de E.", "Pregúntele a Don Evelio por la carnada que usaba E. Él se va a hacer el loco: insista."),
  step(3, "evelio", HISTORIA_LAGO.carnada, "cocina", "Masa, miel y fresa", "Cocine la carnada de E. en la estufa de la planta baja: una mazorca, miel y una fresa."),
  step(4, "evelio", HISTORIA_LAGO.llave, "pesca", "Lo que el lago guarda", "Con la carnada de E. en la mochila, pesque en el lago cuando el agua brille: de 9 p. m. a 3 a. m., sin lluvia ni niebla."),
  step(5, "aurora", HISTORIA_LAGO.mostrada, "exploracion", "La llave de E.", "Llévele la llavecita oxidada a Doña Aurora, en el recibidor de la planta baja."),
];

const LESSONS: Readonly<Record<string, string>> = {
  "llave-1": "La Profe Celeste se la pasa en el observatorio, en la lomita del noreste. Háblele con E y pregúntele.",
  "llave-2": "Ese señor sabe más de lo que dice, mijo. Si se hace el loco, muéstrele la carta de E.",
  "llave-3": "Mazorca de la huerta, miel de las colmenas y una fresa. En la estufa de la cocina, detrás de la cafetería.",
  "llave-4": "Con la carnada en la mochila, láncela en el lago cuando brille: de nueve de la noche a tres de la mañana del juego, con el cielo limpio.",
  "llave-5": "Doña Aurora está en el recibidor. Muéstrele la llave: ella conoció a E. más que nadie.",
};

const TARGETS: Readonly<Record<string, StoryTarget>> = {
  "llave-1": { area: "observatorio", point: "astronomer" },
  "llave-2": { area: "jardin", point: "fishing_shop" },
  "llave-3": { area: "planta-baja", point: "kitchen_stove" },
  "llave-4": { area: "jardin", point: "fishing_spot" },
  "llave-5": { area: "planta-baja" },
};

/** Lo que se le pregunta (o se le muestra) a quien da cada paso: el botón de su cuadro (`HISTORIA_MSG.ask`). */
const ASKS: Readonly<Record<string, string>> = {
  "llave-1": "Preguntarle por el agua que brilla",
  "llave-2": "Preguntarle por la carnada de E.",
  "llave-5": "Mostrarle la llavecita",
};

/** La tercera carta: la llave abre el taller de E., detrás de los baños del sótano. */
export const LETTER_CH3: StoryLetter = {
  id: "carta-3",
  from: "E.",
  title: "Si la llave salió del agua",
  body: [
    "Si tiene esta llave en la mano es porque Celeste le contó lo del agua y Evelio, a regañadientes, le soltó mi carnada. Dígale que gracias: él no se lo va a decir.",
    "La llave abre la puerta del fondo del sótano, la que queda detrás de los baños. Ahí era mi taller. Lo dejé tal cual: los planos, el corcho con los recortes, mis cuadernos.",
    "No se asuste si la cerradura chilla, ni si adentro encuentra cosas a medias: me fui antes de terminarlas.",
    "Allá le explico lo demás. Mejor dicho: allá se lo explican mis cuadernos.",
  ].join("\n\n"),
};

export function capitulo3(flags: { opensWith: string; flag: string }): Capitulo {
  return {
    id: "llave",
    n: 3,
    title: "La llavecita del lago",
    summary: "Celeste contó cuándo brilla el agua, Evelio soltó la receta de la carnada de E. y del lago salió una llavecita oxidada.",
    steps: STEPS,
    lessons: LESSONS,
    targets: TARGETS,
    asks: ASKS,
    opensWith: flags.opensWith,
    flag: flags.flag,
    achievement: "pescador-de-secretos",
    letter: LETTER_CH3,
    items: OBJETOS_LAGO_BOLSA,
  };
}

// ---------- Las cinemáticas del capítulo ----------

export const LAGO_CINE = {
  celeste: "llave-celeste",
  evelioLoco: "llave-evelio-loco",
  evelioReceta: "llave-evelio-receta",
  carnada: "llave-carnada",
  pesca: "llave-pesca",
  aurora: "llave-aurora",
} as const;

/** La opción del cuadro de Evelio que insiste (mostrarle la carta): el navegador vuelve a preguntarle. */
export const EVELIO_INSISTE = "carta";

/** Lo que dice Celeste al final, según brille o no el agua en ese momento (variable `{ahora}`). */
export const celesteAhora = (brilla: boolean) =>
  brilla ? "Y mire qué suerte: esta noche brilla. Corra pa'l lago antes de que se nuble." : "Esta noche no, fíjese. Pero ya sabe la hora: vuelva al lago cuando la luna esté arriba.";

export const CAPITULO3_CINEMATICAS: readonly CineDef[] = [
  {
    id: LAGO_CINE.celeste,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "astronoma", zoom: 1.5 },
      { op: "walk", who: "yo", to: { near: "astronoma", dx: 1, dy: 1 } },
      { op: "face", who: "astronoma", dir: "up" },
      { op: "bubble", who: "astronoma", text: "Mmm… Júpiter, Saturno, la Osa…" },
      { op: "act", who: "astronoma", action: "girar" },
      { op: "face", who: "astronoma", toward: "yo" },
      { op: "together", steps: [{ op: "emote", who: "astronoma", emote: "surprise" }, { op: "act", who: "astronoma", action: "saltar" }] },
      { op: "say", who: "astronoma", text: "¿El agua que brilla? ¡Ay, E.! Él venía todas las noches a preguntarme lo mismo, con su libreta." },
      { op: "walk", who: "astronoma", path: [{ near: "yo", dx: -1, dy: 1 }, { near: "yo", dx: -1, dy: -1 }] },
      { op: "face", who: "astronoma", dir: "up" },
      { op: "say", who: "astronoma", text: "No es magia, es la luna. Cuando está alta y el cielo limpio, el lago se la devuelve y brilla como si tuviera escamas." },
      { op: "fx", fx: "estrellas", who: "astronoma" },
      { op: "face", who: "astronoma", toward: "yo" },
      { op: "say", who: "astronoma", text: "De las nueve de la noche a las tres de la mañana. Con lluvia, tormenta o niebla, nada: la luna no llega al agua." },
      { op: "say", who: "astronoma", text: "Él decía que lo que se pierde en el lago, esas noches, sube a mirar la luna. Yo le decía que eso no era ciencia." },
      { op: "together", steps: [{ op: "emote", who: "astronoma", emote: "idea" }, { op: "act", who: "yo", action: "asentir" }] },
      { op: "say", who: "astronoma", text: "{ahora}" },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
  {
    id: LAGO_CINE.evelioLoco,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "evelio", zoom: 1.5 },
      { op: "walk", who: "yo", to: { near: "evelio", dx: 1, dy: 1 } },
      { op: "together", steps: [{ op: "face", who: "yo", toward: "evelio" }, { op: "face", who: "evelio", toward: "yo" }] },
      { op: "say", who: "evelio", text: "¿Carnada? Claro, mijo: tengo de la común y de la buena. Ahí está la lista, escoja." },
      { op: "say", who: "yo", text: "No, Don Evelio. La que usaba E." },
      { op: "camera", to: "evelio", follow: true },
      { op: "walk", who: "evelio", path: [{ near: "yo", dx: -2, dy: 0 }, { near: "yo", dx: -3, dy: -2 }] },
      { op: "face", who: "evelio", dir: "left" },
      { op: "bubble", who: "evelio", text: "Fiu, fiu…" },
      { op: "wait", ms: 1200 },
      { op: "say", who: "evelio", text: "¿E.? ¿Cuál E.? Por aquí pasa mucha gente, mijo. Uno no se acuerda de todos." },
      { op: "walk", who: "yo", to: { near: "evelio", dx: 1, dy: 1 } },
      { op: "together", steps: [{ op: "emote", who: "evelio", emote: "question" }, { op: "face", who: "evelio", dir: "up" }] },
      { op: "say", who: "evelio", text: "Ve, ¿y ese pato de allá? Qué pato tan bonito. ¿Usted lo había visto?" },
      { op: "together", steps: [{ op: "face", who: "yo", dir: "up" }, { op: "emote", who: "yo", emote: "angry" }] },
      { op: "face", who: "evelio", toward: "yo" },
      {
        op: "choice",
        prompt: "Don Evelio se hace el loco.",
        options: [
          { id: EVELIO_INSISTE, label: "Mostrarle la carta de E." },
          { id: "dejar", label: "Dejarlo así por ahora" },
        ],
      },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
  {
    id: LAGO_CINE.evelioReceta,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "evelio", zoom: 1.6 },
      { op: "walk", who: "yo", to: { near: "evelio", dx: 1, dy: 1 } },
      { op: "together", steps: [{ op: "face", who: "yo", toward: "evelio" }, { op: "face", who: "evelio", toward: "yo" }] },
      { op: "together", steps: [{ op: "emote", who: "evelio", emote: "surprise" }, { op: "act", who: "evelio", action: "temblar" }] },
      { op: "say", who: "evelio", text: "…Bueno, bueno. Esa letra no la confundo: ese man escribía como médico." },
      { op: "act", who: "evelio", action: "asentir" },
      { op: "say", who: "evelio", text: "La carnada de E. era secreto entre los dos. Masa de mazorca, un chorrito de miel y una fresa machacada. Dizque el olor les gusta a los de noche." },
      { op: "say", who: "evelio", text: "Se cocina en la estufa de la casa. Y no me pregunte pa' qué la quería, que yo nunca lo vi sacar un pescado con ella." },
      { op: "face", who: "evelio", dir: "up" },
      { op: "emote", who: "evelio", emote: "cry" },
      { op: "say", who: "evelio", text: "Si lo ve por ahí… dígale que el compadre de Pasto le guarda la silla del muelle." },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
  {
    id: LAGO_CINE.carnada,
    kind: "momento",
    steps: [
      { op: "sound", sound: "magia" },
      { op: "together", steps: [{ op: "fx", fx: "chispas" }, { op: "act", who: "yo", action: "asentir" }] },
      { op: "title", text: "Carnada de E.", sub: "Huele a mazorca, miel y fresa", ms: 2600 },
    ],
  },
  {
    id: LAGO_CINE.pesca,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "yo", zoom: 1.7, ms: 1200 },
      { op: "sound", sound: "brisa" },
      { op: "say", who: "narrador", text: "La boya se hunde despacio, sin tirones, como si algo allá abajo la estuviera esperando." },
      { op: "together", steps: [{ op: "flash", color: "blanco", ms: 500 }, { op: "fx", fx: "estrellas" }, { op: "act", who: "yo", action: "temblar" }] },
      { op: "say", who: "narrador", text: "El agua se pone a brillar alrededor del sedal: destellos de luna que suben y se apagan." },
      { op: "sound", sound: "chapuzon" },
      { op: "together", steps: [{ op: "shake", ms: 300, strength: 0.002 }, { op: "flash", color: "oro", ms: 450 }, { op: "act", who: "yo", action: "saltar" }] },
      { op: "emote", who: "yo", emote: "surprise" },
      { op: "title", text: "Una llavecita oxidada", sub: "Tiene grabada una E", ms: 3200 },
      { op: "act", who: "yo", action: "girar" },
      { op: "say", who: "narrador", text: "De la argolla cuelga un hilo de pescar viejo, amarrado con un nudo que solo hace alguien que sabe." },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
  {
    id: LAGO_CINE.aurora,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "aurora", zoom: 1.5 },
      { op: "walk", who: "yo", to: { near: "aurora", dx: 1, dy: 1 } },
      { op: "together", steps: [{ op: "face", who: "yo", toward: "aurora" }, { op: "face", who: "aurora", toward: "yo" }] },
      { op: "together", steps: [{ op: "emote", who: "aurora", emote: "surprise" }, { op: "act", who: "aurora", action: "saltar" }] },
      { op: "say", who: "aurora", text: "¡Esa llave! Yo se la vi mil veces colgada del cuello… y nunca supe qué abría." },
      { op: "act", who: "aurora", action: "temblar" },
      { op: "say", who: "aurora", text: "No, no, no me la dé. Guárdela usted, mijo: si él la dejó en el lago, era pa' que la sacara alguien como usted." },
      { op: "together", steps: [{ op: "emote", who: "aurora", emote: "heart" }, { op: "act", who: "yo", action: "asentir" }] },
      { op: "say", who: "aurora", text: "Y ya verá que trae carta. Él nunca dejaba nada sin su cartica." },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
];
