// Capítulo 2 de la historia, "El reloj de pie" (docs/plan-historia.md, VIR-151). La carta de E. dijo: "Cuide
// el reloj de pie del recibidor. Cuando vuelva a dar la hora, sabrá que va por buen camino". El reloj está
// parado y le faltan tres piezas, repartidas por la cabaña: un engranaje trabado en el molino del arroyo, un
// resorte que se templa en el banco del taller del garaje y un péndulo que tiene (cómo no) el Man del
// Sombrero. Con las tres, el reloj vuelve a andar y da trece campanadas. Lo da Doña Aurora, como el 1.
//
// Cada paso sigue un contador propio de la historia (`HISTORIA_RELOJ`): los suma la sala del capítulo
// (apps/server/src/rooms/capitulo2.ts) cuando pasa lo que pide el paso, y solo con ese paso abierto.
import type { StoryLetter, Capitulo, StoryTarget } from "./historia";
import type { BagObject } from "./bolsa";
import type { QuestDef, QuestSkill } from "./encargos";
import type { CineDef } from "./cinematicas";

/** Los contadores de los pasos (UserStat; los suma la sala solo con el paso abierto). */
export const HISTORIA_RELOJ = {
  mirado: "historia:reloj-mirado",
  engranaje: "historia:engranaje",
  resorte: "historia:resorte",
  pendulo: "historia:pendulo",
  arreglado: "historia:reloj-arreglado",
} as const;

/** Las tres piezas (objetos de historia: no se tiran, regalan ni intercambian). */
export const PIEZAS_RELOJ = {
  engranaje: "pieza-engranaje",
  resorte: "pieza-resorte",
  pendulo: "pieza-pendulo",
} as const;

export const PIEZAS_RELOJ_OBJETOS: Readonly<Record<string, BagObject>> = {
  [PIEZAS_RELOJ.engranaje]: { name: "Engranaje de bronce", blurb: "Estaba trabado entre las aspas del molino. Tiene grabada una E chiquita.", kind: "objeto", max: 1, story: true },
  [PIEZAS_RELOJ.resorte]: { name: "Resorte templado", blurb: "Templado en el banco del taller, como dejó anotado E. en la pared.", kind: "objeto", max: 1, story: true },
  [PIEZAS_RELOJ.pendulo]: { name: "Péndulo de dudosa procedencia", blurb: "El Man del Sombrero jura que lo encontró. Pesa lo que pesa un secreto.", kind: "objeto", max: 1, story: true },
};

/** Lo que cobra el Man del Sombrero por el péndulo (solo a quien lo anda buscando). */
export const PENDULO_PRECIO = 40;

/** Las paradas del capítulo: los pasos que se cumplen en cada mueble o lugar. */
export const RELOJ_PASOS = {
  mirar: "reloj-1",
  engranaje: "reloj-2",
  resorte: "reloj-3",
  pendulo: "reloj-4",
  arreglar: "reloj-5",
} as const;

const step = (n: number, stat: string, skill: QuestSkill, title: string, text: string): QuestDef => ({
  id: `reloj-${n}`,
  kind: "story",
  giver: "aurora",
  title,
  text,
  stat,
  goal: 1,
  reward: { points: 6, skill, xp: 20 },
  ...(n < 5 ? { next: `reloj-${n + 1}` } : {}),
});

const STEPS: readonly QuestDef[] = [
  step(1, HISTORIA_RELOJ.mirado, "exploracion", "El reloj callado", "Mire de cerca el reloj de pie del recibidor de la planta baja (E). Lleva años parado."),
  step(2, HISTORIA_RELOJ.engranaje, "huerta", "Un engranaje de bronce", "En el molino del arroyo algo traquea al moler. Muela una mazorca y fíjese qué sale."),
  step(3, HISTORIA_RELOJ.resorte, "exploracion", "Un resorte templado", "E. dejó anotado en la pared del taller cómo templar un resorte. Use el banco del garaje."),
  step(4, HISTORIA_RELOJ.pendulo, "social", "El péndulo", "El péndulo no aparece por ningún lado… pero el Man del Sombrero siempre tiene de todo. Búsquelo."),
  step(5, HISTORIA_RELOJ.arreglado, "exploracion", "Que vuelva a dar la hora", "Con el engranaje, el resorte y el péndulo, vaya al reloj de pie y arréglelo (E)."),
];

const LESSONS: Readonly<Record<string, string>> = {
  "reloj-1": "Él lo tenía siempre andando. Decía que el reloj sabe cosas. Mírelo bien, a ver qué le falta.",
  "reloj-2": "El molino lo armó él también. Si algo está trabado allá, seguro es suyo. Lleve una mazorca de la huerta.",
  "reloj-3": "En el taller hay una nota en la pared, con la letra de él. Dele al banco con E, sin miedo.",
  "reloj-4": "Ese señor del sombrero sale a ciertas horas, o con tormenta. Pregúntele por el péndulo, que algo sabe.",
  "reloj-5": "Ya tiene todo, mijo. Vaya al recibidor y póngale las piezas. Yo me tapo los oídos.",
};

const TARGETS: Readonly<Record<string, StoryTarget>> = {
  "reloj-1": { area: "planta-baja" },
  "reloj-2": { area: "jardin" },
  "reloj-3": { area: "garaje" },
  "reloj-4": { area: "jardin" },
  "reloj-5": { area: "planta-baja" },
};

/** La segunda carta: el reloj anda y E. manda al lago. */
export const LETTER_CH2: StoryLetter = {
  id: "carta-2",
  from: "E.",
  title: "Si oyó trece campanadas",
  body: [
    "Si está leyendo esto es porque el reloj volvió a andar. Trece campanadas, ¿cierto? No se asuste: siempre fue así de exagerado.",
    "La llave del cuarto del fondo no la escondí en la casa. La puse donde todo lo que se pierde termina llegando. Usted ya sabe pescar, ¿no?",
    "Pero no cualquier noche. Pregúntele a Celeste por el agua que brilla. Y a Evelio, por la carnada que yo usaba (él se va a hacer el loco).",
    "Gracias por cuidar el reloj. Era de mi papá.",
  ].join("\n\n"),
};

export function capitulo2(flags: { opensWith: string; flag: string }): Capitulo {
  return {
    id: "reloj",
    n: 2,
    title: "El reloj de pie",
    summary: "El reloj del recibidor volvió a andar con un engranaje del molino, un resorte del taller y un péndulo del Man del Sombrero. Dio trece campanadas.",
    steps: STEPS,
    lessons: LESSONS,
    targets: TARGETS,
    opensWith: flags.opensWith,
    flag: flags.flag,
    achievement: "relojero",
    letter: LETTER_CH2,
    items: PIEZAS_RELOJ_OBJETOS,
  };
}

// ---------- Las cinemáticas del capítulo ----------

/** Lo que se ve al mirar el reloj parado, al conseguir cada pieza y al arreglarlo. */
export const RELOJ_CINE = { callado: "reloj-callado", pieza: "reloj-pieza", campanadas: "reloj-campanadas" } as const;

export const CAPITULO2_CINEMATICAS: readonly CineDef[] = [
  {
    id: RELOJ_CINE.callado,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "yo", zoom: 1.5 },
      { op: "sound", sound: "brisa" },
      { op: "act", who: "yo", action: "asentir" },
      { op: "say", who: "narrador", text: "El reloj de pie está parado en las 3:15. Tiene polvo en el vidrio, menos en una esquina: alguien lo limpiaba con el dedo." },
      { op: "emote", who: "yo", emote: "question" },
      { op: "say", who: "narrador", text: "Adentro falta el péndulo. Y se ven dos huecos: uno donde iba un engranaje y otro donde iba un resorte." },
      { op: "walk", who: "aurora", path: [{ near: "yo", dx: 2, dy: 2 }, { near: "yo", dx: 1, dy: 1 }] },
      { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "face", who: "yo", toward: "aurora" }] },
      { op: "say", who: "aurora", text: "Él lo tenía siempre andando. Decía que el reloj sabe cosas. Si le consigue las tres piezas, yo le hago una aguapanela." },
      { op: "act", who: "aurora", action: "asentir" },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
  {
    id: RELOJ_CINE.pieza,
    kind: "momento",
    steps: [
      { op: "sound", sound: "magia" },
      { op: "together", steps: [{ op: "fx", fx: "chispas" }, { op: "act", who: "yo", action: "saltar" }] },
      { op: "title", text: "{pieza}", sub: "Pieza del reloj de pie", ms: 2600 },
    ],
  },
  {
    id: RELOJ_CINE.campanadas,
    kind: "historia",
    steps: [
      { op: "bars", on: true },
      { op: "camera", to: "yo", zoom: 1.6, ms: 1200 },
      { op: "act", who: "yo", action: "asentir" },
      { op: "say", who: "narrador", text: "El engranaje encaja con un clic. El resorte, con un quejido. El péndulo se queda quieto… y de pronto se mueve solo." },
      { op: "fade", to: "black", ms: 700 },
      { op: "sound", sound: "campanadas" },
      { op: "title", text: "Tan… tan… tan…", sub: "Trece campanadas", ms: 4200 },
      { op: "fade", to: "clear", ms: 900 },
      {
        op: "together",
        steps: [
          { op: "shake", ms: 300, strength: 0.002 },
          { op: "flash", color: "oro", ms: 500 },
          { op: "fx", fx: "estrellas" },
          { op: "act", who: "yo", action: "saltar" },
          { op: "walk", who: "aurora", run: true, to: { near: "yo", dx: 1, dy: 1 } },
        ],
      },
      { op: "together", steps: [{ op: "face", who: "aurora", toward: "yo" }, { op: "emote", who: "aurora", emote: "surprise" }, { op: "act", who: "aurora", action: "temblar" }] },
      { op: "say", who: "aurora", text: "¡Virgen santísima! Trece… igualito a como sonaba cuando él estaba aquí." },
      { op: "together", steps: [{ op: "act", who: "aurora", action: "bailar" }, { op: "act", who: "yo", action: "bailar" }] },
      { op: "say", who: "aurora", text: "Venga y me cuenta, que yo me quedé sin palabras. Y sin aguapanela: se me regó del susto." },
      { op: "camera", to: "yo" },
      { op: "bars", on: false },
    ],
  },
];
