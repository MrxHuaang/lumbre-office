// El repertorio del Carnaval (VIR-174): todo original salvo La Guaneña (tradicional nariñense, de dominio
// público). Cómo se escribe, en musica-programa.ts; cada pieza dura de 2 a 3 minutos: introducción, temas
// que cambian de instrumento, la percusión sola, los cortes de la murga y un final.
import type { PiezaId } from "@hyvento/shared";
import { duracionS, type Pieza, type Toque } from "./musica-programa";

// ---------- Patrones de la murga ----------

/** Son sureño (6/8): el bombo en el 1 y el 4, el guasá en cada corchea, el redoblante antes de cada tiempo. */
const SON_PERC = {
  bombo: [[0, 1], [3, 0.85]],
  redoblante: [[2, 0.45], [5, 0.75]],
  guasa: [[0, 0.8], [1, 0.4], [2, 0.55], [3, 0.8], [4, 0.4], [5, 0.55]],
  campana: [[0, 0.6], [2, 0.35], [3, 0.6], [5, 0.35]],
} as const satisfies Pieza["perc"];
/** El acordeón entre los golpes del bombo ("pum-chi-chi"); el trombón en el 1 y el 4. */
const SON_ACOMP: readonly Toque[] = [[1, 0.6], [2, 0.45], [4, 0.6], [5, 0.45]];
const SON_BAJO: readonly Toque[] = [[0, 1], [3, 0.8]];

/** Sanjuanito (2/4): el bombo "corchea con puntillo, semicorchea, negra"; el güiro largo y corto. */
const SANJUANITO_MURGA_PERC = {
  bombo: [[0, 1], [1.5, 0.6], [2, 0.85]],
  redoblante: [[1, 0.4], [3, 0.8], [3.5, 0.3]],
  guiroLargo: [[0, 0.6], [2, 0.6]],
  guiro: [[1, 0.4], [1.5, 0.4], [3, 0.4], [3.5, 0.4]],
  campana: [[0, 0.6], [1, 0.35], [2, 0.55], [3, 0.35]],
} as const satisfies Pieza["perc"];

/** Bambuco de murga (3/4): el bombo en el 1 y en el "y" del 2, el guasá acentuando de a tres corcheas. */
const BAMBUCO_MURGA_PERC = {
  bombo: [[0, 1], [4, 0.75]],
  redoblante: [[2, 0.5], [3, 0.25], [5, 0.7]],
  guasa: [[0, 0.8], [1, 0.4], [2, 0.5], [3, 0.75], [4, 0.4], [5, 0.5]],
  campana: [[0, 0.5], [3, 0.4]],
  guiroLargo: [[0, 0.5]],
} as const satisfies Pieza["perc"];

// ---------- Patrones del colectivo andino ----------

const SANJUANITO_PERC = {
  bombo: [[0, 1], [1.5, 0.6], [2, 0.8]],
  shekere: [[0, 0.4], [1, 0.7], [2, 0.4], [3, 0.7], [3.5, 0.3]],
} as const satisfies Pieza["perc"];
const BAMBUCO_PERC = {
  bombo: [[0, 1], [4, 0.7]],
  shekere: [[0, 0.5], [2, 0.4], [3, 0.65], [4, 0.4], [5, 0.5]],
} as const satisfies Pieza["perc"];

// ---------- La Guaneña (tradicional) ----------

// La melodía de siempre, en Mi menor y en 3, como la versión para flauta de las escuelas: "do mi la la la la,
// do' la sol sol sol sol, la sol mi la sol mi re do" y el cierre "do mi la do' la sol...". Las frases entran a
// contratiempo y la del cierre acaba en la tercera del acorde, con la dominante antes. El primer compás es
// la anacrusa (con un golpe en el 1, que en la murga es un corte).
const GUANENA_TEMA = {
  notas:
    "E5 -:3 G4 B4 | E5:2 E5 E5 E5:2 | G5:3 E5 D5:2 | D5 D5 D5:2 E5 D5 | B4:2 E5 D5 B4:2 | A4 G4:3 G4 B4 | E5 G5 E5:2 D5:2 | E5 D5 B4:2 E5 D5 | B4:2 A4 G4:3",
  acordes: "Em Em G D Em Em C G B7/Em",
};
/** Un interludio original (i, VII, VI, V) para los arreglos de La Guaneña. */
const GUANENA_INTERLUDIO = { notas: "B4:2 E5:2 G5:2 | F#5:2 A5:2 D5:2 | E5:2 G5:2 C5:2 | B4:2 D#5:2 F#5:2", acordes: "Em D C B7" };
const GUANENA_PUENTE = { notas: "B4 D5 G5:2 F#5 G5 | A5:2 F#5 D5 A4:2 | G4 B4 E5:2 G5 E5 | F#5:2 D#5 B4:3", acordes: "G D Em B7" };
const GUANENA_FINAL = { notas: "F#5:2 A5 F#5 D#5:2 | E5:6", acordes: "B7 Em" };

export const PIEZAS_MUSICA: Record<PiezaId, Pieza> = {
  // ---------------- Murga ----------------
  "son-vereda": {
    nombre: "Son de la vereda",
    conjunto: "murga",
    original: true,
    nota: "Son sureño en 6/8, Re menor. Abre la percusión sola, los bronces entran con dos cortes y el tema pasa de la trompeta al saxo y al acordeón; el final encadena cuatro cortes.",
    metrica: "6/8",
    bpm: 104,
    temas: {
      I: { notas: "D5 -:5 | A4 C#5 E5 A5:3 | D5 -:5 | C#5:2 E5:2 G5:2", acordes: "Dm A7 Dm A7" },
      A: {
        notas: "A4:2 D5 F5:2 E5 | D5 E5 F5 A5:2 F5 | G5:2 F5 D5:2 Bb4 | C#5:2 E5:2 G5:2 | F5:3 A5:2 F5 | G5 F5 D5 Bb4:2 D5 | C#5:2 E5 A4:2 C#5 | D5:4 -:2",
        acordes: "Dm Dm Gm A7 Dm Gm A7 Dm",
      },
      B: {
        notas: "A4 C5 F5 A5:2 G5 | G5:2 E5 C5:2 E5 | G5:2 F5 E5:2 C#5 | D5:2 F5 A5:3 | A5:2 G5 F5:2 C5 | E5 F5 G5 E5:2 C5 | A4:2 C#5:2 E5:2 | D5:4 -:2",
        acordes: "F C A7 Dm F C A7 Dm",
      },
      C: {
        notas: "F5:2 D5:2 Bb4:2 | C5:2 F5:2 A5:2 | G5:2 E5:2 C5:2 | F5:3 A5:3 | Bb5:2 A5 G5:2 D5 | F5:2 E5 D5:2 A4 | E5 F5 G5 A5:2 C#5 | D5:6",
        acordes: "Bb F C F Gm Dm A7 Dm",
      },
      F: { notas: "A4:2 C#5:2 E5:2 | D5:6", acordes: "A7 Dm" },
    },
    forma: [
      { tema: null, compases: 2, acorde: "Dm", perc: "sola" },
      { tema: "I", lleva: "bronces", perc: "plena", cortes: [0, 2] },
      { tema: "A", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "A", lleva: "saxo", perc: "plena", cortes: [7] },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: "B", lleva: "acordeon", perc: "liviana" },
      { tema: null, compases: 4, acorde: "Dm", perc: "sola" },
      { tema: "C", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "C", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: "A", lleva: "acordeon", perc: "liviana" },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: null, compases: 2, acorde: "Dm", perc: "sola" },
      { tema: "B", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "C", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [1, 3, 5, 7] },
      { tema: "F", lleva: "bronces", perc: "plena", final: true },
    ],
    perc: SON_PERC,
    acomp: SON_ACOMP,
    bajo: SON_BAJO,
    extracto: 0,
  },
  "son-cuy": {
    nombre: "Son del cuy alegre",
    conjunto: "murga",
    original: true,
    nota: "Son sureño en 6/8, La menor, con hemiolas (tres negras en el compás de seis corcheas) y un tema de pregunta y respuesta lleno de cortes; el güiro largo se suma al guasá.",
    metrica: "6/8",
    bpm: 108,
    temas: {
      I: { notas: "A5 -:5 | E5 -:5 | A4:2 C5:2 E5:2 | G#5:2 B5:2 E5:2", acordes: "Am E7 Am E7" },
      A: {
        notas: "E5:2 A5 E5:2 C5 | B4 C5 D5 E5:3 | F5:2 D5 A4:2 D5 | E5:2 D5:2 B4:2 | C5:2 E5 A5:2 G5 | G5 F5 E5 D5:2 B4 | G#4:2 B4:2 D5:2 | A4:4 -:2",
        acordes: "Am Am Dm E7 Am G E7 Am",
      },
      B: {
        notas: "G5:2 E5 C5:2 E5 | D5:2 B4 G4:2 B4 | C5 D5 E5 G5:2 E5 | A5:3 F5:3 | E5:2 G5 C6:2 G5 | B5:2 A5 G5:2 D5 | E5 F5 G#5 B5:2 G#5 | A5:4 -:2",
        acordes: "C G C F C G E7 Am",
      },
      C: {
        notas: "A4 C5 E5 A5:2 - | G#5 E5 B4 G#4:2 - | A4 C5 E5 A5:2 - | B5:2 G#5:2 E5:2 | D5 F5 A5 D5:2 - | C5 E5 A5 E5:2 - | B4:2 D5:2 G#5:2 | A5:3 E5:3",
        acordes: "Am E7 Am E7 Dm Am E7 Am",
      },
      F: { notas: "B4:2 D5:2 G#5:2 | A5:6", acordes: "E7 Am" },
    },
    forma: [
      { tema: null, compases: 2, acorde: "Am", perc: "sola" },
      { tema: "I", lleva: "bronces", perc: "plena", cortes: [0, 1] },
      { tema: "A", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "A", lleva: "saxo", perc: "plena" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "C", lleva: "trompeta", perc: "plena", cortes: [1, 3, 5, 7] },
      { tema: null, compases: 4, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "acordeon", perc: "liviana" },
      { tema: "B", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "B", lleva: "saxo", perc: "plena", cortes: [3, 7] },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3] },
      { tema: "C", lleva: "acordeon", perc: "plena" },
      { tema: "C", lleva: "bronces", perc: "plena", cortes: [1, 3, 5, 7] },
      { tema: null, compases: 2, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "F", lleva: "bronces", perc: "plena", final: true },
    ],
    perc: { ...SON_PERC, bombo: [[0, 1], [3, 0.85], [5, 0.4]], guiroLargo: [[0, 0.5], [3, 0.5]] },
    acomp: SON_ACOMP,
    bajo: SON_BAJO,
  },
  "sanjuanito-plaza": {
    nombre: "Sanjuanito de la plaza",
    conjunto: "murga",
    original: true,
    nota: "Sanjuanito de murga en 2/4, Mi menor: el bombo con su golpe cojo, güiro, campana y redoblante; los bronces y el acordeón se pasan el tema, y en la segunda vuelta los cortes caen cada cuatro compases.",
    metrica: "2/4",
    bpm: 132,
    temas: {
      I: { notas: "E5 -:3 | B4 D#5 F#5 A5 | G5 -:3 | F#5:0.5 G5:0.5 A5 B5:2", acordes: "Em B7 Em B7" },
      A: {
        notas:
          "E5 G5:0.5 F#5:0.5 E5 B4 | E5 F#5 G5:2 | F#5 A5:0.5 G5:0.5 F#5 D5 | B4 D5 G5:2 | E5 G5:0.5 E5:0.5 C5 E5 | A4 C5 E5 C5 | B4 D#5 F#5 A5 | G5:2 E5:2 | " +
          "D5 G5:0.5 A5:0.5 B5:2 | A5 F#5 D5 F#5 | G5 E5:0.5 F#5:0.5 G5 B4 | F#5:2 D#5:2 | E5 G5:0.5 E5:0.5 C5 G4 | F#4 A4 D5 F#5 | A5 F#5:0.5 D#5:0.5 B4 D#5 | E5:4",
        acordes: "Em Em D G C Am B7 Em G D Em B7 C D B7 Em",
      },
      B: {
        notas:
          "D5 G5:0.5 A5:0.5 B5 G5 | A5 G5:0.5 F#5:0.5 G5:2 | F#5 A5:0.5 F#5:0.5 D5 F#5 | A5:2 F#5 D5 | E5 G5:0.5 E5:0.5 C5 E5 | D5 B4:0.5 D5:0.5 G5:2 | F#5 E5 D5 C5 | B4:2 G4:2 | " +
          "G5 B5:0.5 A5:0.5 G5 D5 | E5 D5:0.5 B4:0.5 G4:2 | G5 E5:0.5 F#5:0.5 G5 B5 | A5 G5 F#5 E5 | E5 G5:0.5 E5:0.5 C5 E5 | F#5 A5:0.5 F#5:0.5 D5 F#5 | D#5 F#5 B5 A5 | G5:2 E5:2",
        acordes: "G G D D C G D7 G G G Em Em C D B7 Em",
      },
      F: { notas: "B4 D#5 F#5 A5 | E5:4", acordes: "B7 Em" },
    },
    forma: [
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "I", lleva: "bronces", perc: "plena", cortes: [0, 2] },
      { tema: "A", lleva: "trompeta", segunda: true, perc: "plena", cortes: [7, 15] },
      { tema: "B", lleva: "acordeon", perc: "liviana" },
      { tema: "A", lleva: "saxo", perc: "plena" },
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7, 15] },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3, 7, 11, 15] },
      { tema: "B", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "B", lleva: "saxo", perc: "liviana" },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [7, 11, 15] },
      { tema: "F", lleva: "bronces", perc: "plena", final: true },
    ],
    perc: SANJUANITO_MURGA_PERC,
    acomp: [[1, 0.6], [2, 0.35], [3, 0.6]],
    bajo: [[0, 1], [2, 0.8]],
  },
  "guanena-murga": {
    nombre: "La Guaneña (murga)",
    conjunto: "murga",
    original: false,
    nota: "La Guaneña (tradicional) arreglada para murga, en 3 como bambuco: los bronces llevan la melodía, cada vuelta arranca con un corte y la anacrusa, y un interludio original con remates de timbal.",
    metrica: "3/4",
    bpm: 144,
    temas: { G: GUANENA_TEMA, R: GUANENA_INTERLUDIO, F: GUANENA_FINAL },
    forma: [
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "R", lleva: "bronces", perc: "plena", cortes: [3] },
      { tema: "G", lleva: "trompeta", segunda: true, perc: "plena", cortes: [0] },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0] },
      { tema: "R", lleva: "acordeon", perc: "liviana" },
      { tema: "G", lleva: "saxo", perc: "plena", cortes: [0] },
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "acordeon", perc: "plena", cortes: [0] },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0, 4] },
      { tema: "R", lleva: "trompeta", perc: "plena", cortes: [1, 3] },
      { tema: "G", lleva: "trompeta", segunda: true, perc: "plena", cortes: [0] },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0, 8] },
      { tema: "R", lleva: "saxo", perc: "liviana" },
      { tema: "G", lleva: "acordeon", perc: "liviana", cortes: [0] },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0] },
      { tema: "F", lleva: "bronces", perc: "plena", final: true },
    ],
    perc: BAMBUCO_MURGA_PERC,
    acomp: [[2, 0.6], [3, 0.4], [4, 0.6]],
    bajo: [[0, 1], [4, 0.8]],
  },

  // ---------------- Colectivo andino ----------------
  sanjuanito: {
    nombre: "Sanjuanito del lago",
    conjunto: "colectivo",
    original: true,
    nota: "Sanjuanito en 2/4, La menor: empieza la quena sola, entra el bombo y el shekere; la zampoña hace la segunda voz y el rondador suena en terceras, de a dos cañas.",
    metrica: "2/4",
    bpm: 124,
    temas: {
      A: {
        notas: "A4 C5 E5 D5 | C5 D5:0.5 C5:0.5 A4:2 | G4 A4 C5 D5 | E5:2 E5 G5 | E5 D5 C5 D5 | E5 D5:0.5 C5:0.5 A4:2 | G#4 B4 D5 B4 | A4:3 -",
        acordes: "Am Am C C Am Dm E7 Am",
      },
      B: {
        notas: "G5 E5:0.5 G5:0.5 C6 G5 | B5:0.5 A5:0.5 G5 D5:2 | C5 E5 A5:2 | G5 E5:0.5 D5:0.5 B4:2 | A4 C5 F5 A5 | G5 E5:0.5 D5:0.5 C5:2 | B4 D5 G#5 B5 | A5:3 -",
        acordes: "C G Am Em F C E7 Am",
      },
      C: {
        notas: "E5 A5:0.5 G5:0.5 E5 C5 | D5 G5:0.5 F5:0.5 D5 B4 | C5 E5:0.5 D5:0.5 C5 G4 | G#4:2 B4:2 | A4 C5:0.5 E5:0.5 A5 E5 | G5 D5:0.5 B4:0.5 G4 B4 | A4 C5 F5 A5 | G#5:2 E5:2",
        acordes: "Am G C E7 Am G F E7",
      },
      F: { notas: "G#4 B4 E5 B4 | A4:4", acordes: "E7 Am" },
    },
    forma: [
      { tema: "A", hasta: 4, lleva: "quena", perc: "nada" },
      { tema: "A", lleva: "quena", perc: "liviana" },
      { tema: "A", lleva: "todos", perc: "plena" },
      { tema: "B", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "B", lleva: "rondador", perc: "plena" },
      { tema: "C", lleva: "zampona", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: null, compases: 4, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "rondador", perc: "plena" },
      { tema: "A", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "B", lleva: "todos", perc: "plena" },
      { tema: "C", lleva: "quena", perc: "plena" },
      { tema: null, compases: 2, acorde: "Am", perc: "sola" },
      { tema: "B", lleva: "zampona", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: "A", lleva: "zampona", perc: "liviana" },
      { tema: "A", lleva: "todos", perc: "plena" },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: SANJUANITO_PERC,
    acomp: [[1, 0.6], [3, 0.6]],
    extracto: 1,
  },
  guanena: {
    nombre: "La Guaneña (colectivo)",
    conjunto: "colectivo",
    original: false,
    nota: "La Guaneña (tradicional) para quena y zampoña, bambuco en Mi menor: la quena canta la melodía de siempre y la zampoña y el rondador se la pasan, con un puente y un interludio originales.",
    metrica: "3/4",
    bpm: 138,
    temas: { G: GUANENA_TEMA, R: GUANENA_INTERLUDIO, P: GUANENA_PUENTE, F: GUANENA_FINAL },
    forma: [
      { tema: "R", lleva: "zampona", perc: "nada" },
      { tema: "G", lleva: "quena", perc: "liviana" },
      { tema: "G", lleva: "todos", perc: "plena" },
      { tema: "P", lleva: "quena", perc: "plena" },
      { tema: "R", lleva: "rondador", perc: "plena" },
      { tema: "G", lleva: "zampona", perc: "plena" },
      { tema: "G", lleva: "quena", segunda: true, perc: "plena" },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "P", lleva: "todos", perc: "plena" },
      { tema: "R", lleva: "todos", perc: "plena" },
      { tema: "G", lleva: "rondador", perc: "plena" },
      { tema: "G", lleva: "quena", perc: "plena" },
      { tema: "P", lleva: "zampona", perc: "liviana" },
      { tema: "R", lleva: "quena", perc: "plena" },
      { tema: "G", lleva: "todos", perc: "plena" },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: BAMBUCO_PERC,
    acomp: [[2, 0.6], [4, 0.6]],
    extracto: 1,
  },
  bambuco: {
    nombre: "Bambuco del Galeras",
    conjunto: "colectivo",
    original: true,
    nota: "Bambuco en 3, Sol mayor con un tema en Mi menor: las frases entran después del primer tiempo, como se canta el bambuco; abre la quena sola y cierra todo el colectivo.",
    metrica: "3/4",
    bpm: 126,
    temas: {
      A: {
        notas: "-:2 B4 D5 G5:2 | F#5 G5 A5:2 G5 D5 | - C5 A4 C5 F#5:2 | E5 D5 C5 A4:3 | - E5 G5 E5 C5:2 | D5 B4 G4:2 B4 D5 | F#5:2 E5 C5 A4 C5 | B4:3 G4:3",
        acordes: "G G D7 D7 C G D7 G",
      },
      B: {
        notas: "- B4 E5 G5 B5:2 | A5 G5 F#5:2 E5 B4 | - D#5 F#5 A5 B5:2 | A5 F#5 D#5 B4:3 | - C5 E5 A5 G5 E5 | G5:2 F#5 E5 B4:2 | D#5:2 F#5 A5 F#5 D#5 | E5:6",
        acordes: "Em Em B7 B7 Am Em B7 Em",
      },
      C: {
        notas: "E5 G5 C6:2 B5 A5 | G5:2 D5 B4 G4:2 | A4 C5 F#5:2 E5 D5 | G5:3 - B4 D5 | E5:2 G5 E5 C5 E5 | D5 B4 G4:2 B4 D5 | C5 E5 D5 C5 A4:2 | G4:6",
        acordes: "C G D7 G C G D7 G",
      },
      F: { notas: "F#5:2 E5 C5 A4:2 | G4:6", acordes: "D7 G" },
    },
    forma: [
      { tema: "A", hasta: 4, lleva: "quena", perc: "nada" },
      { tema: "A", lleva: "quena", perc: "liviana" },
      { tema: "A", lleva: "todos", perc: "plena" },
      { tema: "B", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "B", lleva: "zampona", perc: "plena" },
      { tema: "C", lleva: "rondador", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: null, compases: 2, acorde: "G", perc: "sola" },
      { tema: "A", lleva: "zampona", perc: "plena" },
      { tema: "B", lleva: "todos", perc: "plena" },
      { tema: "C", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "A", lleva: "todos", perc: "plena" },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: BAMBUCO_PERC,
    acomp: [[2, 0.6], [4, 0.6]],
  },
};

// ---------- El repertorio en el tiempo ----------

/** La pausa entre una pieza y la siguiente del repertorio (s). */
export const PAUSA_S = 4;

/** Lo que dura cada pieza (s), calculado una vez. */
const DURACION = new Map<PiezaId, number>();
export const duracionDe = (id: PiezaId) => {
  let d = DURACION.get(id);
  if (d === undefined) DURACION.set(id, (d = duracionS(PIEZAS_MUSICA[id])));
  return d;
};

/**
 * Qué está sonando de un repertorio a los `ms` de empezado (en bucle, con la pausa entre piezas): la pieza,
 * en qué segundo va y cuántas piezas lleva (para saber cuándo empieza otra). null en la pausa.
 */
export function sonandoEn(repertorio: readonly PiezaId[], ms: number): { pieza: PiezaId; enS: number; n: number } | null {
  if (!repertorio.length) return null;
  const ciclo = repertorio.reduce((s, p) => s + duracionDe(p) + PAUSA_S, 0);
  const vueltas = Math.floor(Math.max(0, ms) / 1000 / ciclo);
  let t = Math.max(0, ms) / 1000 - vueltas * ciclo;
  for (let i = 0; i < repertorio.length; i++) {
    const p = repertorio[i]!;
    const d = duracionDe(p);
    if (t < d) return { pieza: p, enS: t, n: vueltas * repertorio.length + i };
    t -= d + PAUSA_S;
    if (t < 0) return null;
  }
  return null;
}
