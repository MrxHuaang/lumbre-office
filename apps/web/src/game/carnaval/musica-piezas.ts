// El repertorio del Carnaval (VIR-174, VIR-179). La protagonista es La Guaneña, la melodía tradicional de
// Nariño (anónima, de dominio público; las fuentes van en cada arreglo), en cuatro arreglos: bambuco y son
// sureño para la murga, y bambuco y son sureño para el colectivo andino. Lo demás es original. Cómo se
// escribe, en musica-programa.ts; cada pieza dura de 2 a 4 minutos: introducción, temas que cambian de
// instrumento, variaciones, la percusión sola, los cortes de la murga y un final.
//
// Solo hay música instrumental: ni una letra, aquí ni en ningún lado. Se quedaron por fuera, a propósito,
// canciones del carnaval con autor y derechos vigentes (por ejemplo el "Trompo sarandengue", de Hugo Ortega,
// canción del carnaval de 1996).
import type { PiezaId } from "@hyvento/shared";
import { duracionS, type Fuente, type Pieza, type Rasgo, type Tema, type Toque } from "./musica-programa";

// ---------- Patrones de la murga ----------

/** Son sureño (6/8): el bombo en el 1 y el 4, el guasá en cada corchea, el redoblante antes de cada tiempo. */
const SON_PERC = {
  bombo: [[0, 1], [3, 0.85]],
  tambora: [[0, 0.55], [2, 0.35], [3, 0.55], [5, 0.45]],
  redoblante: [[2, 0.45], [5, 0.75]],
  guasa: [[0, 0.8], [1, 0.4], [2, 0.55], [3, 0.8], [4, 0.4], [5, 0.55]],
  campana: [[0, 0.6], [2, 0.35], [3, 0.6], [5, 0.35]],
} as const satisfies Pieza["perc"];
/** El acordeón entre los golpes del bombo ("pum-chi-chi"); la tuba en el 1 y el 4. */
const SON_ACOMP: readonly Toque[] = [[1, 0.6], [2, 0.45], [4, 0.6], [5, 0.45]];
const SON_BAJO: readonly Toque[] = [[0, 1], [3, 0.8]];

/** Sanjuanito (2/4): el bombo "corchea con puntillo, semicorchea, negra"; el güiro largo y corto, y la caja. */
const SANJUANITO_MURGA_PERC = {
  bombo: [[0, 1], [1.5, 0.6], [2, 0.85]],
  tambora: [[0, 0.5], [2, 0.4]],
  redoblante: [[1, 0.4], [3, 0.8], [3.5, 0.3]],
  caja: [[0.5, 0.3], [1, 0.55], [2.5, 0.3], [3, 0.6]],
  guiroLargo: [[0, 0.6], [2, 0.6]],
  guiro: [[1, 0.4], [1.5, 0.4], [3, 0.4], [3.5, 0.4]],
  campana: [[0, 0.6], [1, 0.35], [2, 0.55], [3, 0.35]],
} as const satisfies Pieza["perc"];

/** Bambuco de murga (3/4): el bombo en el 1 y en el "y" del 2, el guasá acentuando de a tres corcheas. */
const BAMBUCO_MURGA_PERC = {
  bombo: [[0, 1], [4, 0.75]],
  tambora: [[0, 0.6], [3, 0.4]],
  redoblante: [[2, 0.5], [3, 0.25], [5, 0.7]],
  guasa: [[0, 0.8], [1, 0.4], [2, 0.5], [3, 0.75], [4, 0.4], [5, 0.5]],
  cencerro: [[0, 0.5], [2, 0.3], [4, 0.45]],
  guiroLargo: [[0, 0.5]],
} as const satisfies Pieza["perc"];

// ---------- Patrones del colectivo andino ----------

const SANJUANITO_PERC = {
  bombo: [[0, 1], [1.5, 0.6], [2, 0.8]],
  shekere: [[0, 0.4], [1, 0.7], [2, 0.4], [3, 0.7], [3.5, 0.3]],
  maracas: [[0, 0.4], [0.5, 0.25], [1, 0.5], [1.5, 0.25], [2, 0.4], [2.5, 0.25], [3, 0.5], [3.5, 0.25]],
  chajchas: [[1, 0.5], [3, 0.6]],
} as const satisfies Pieza["perc"];
const BAMBUCO_PERC = {
  bombo: [[0, 1], [4, 0.7]],
  shekere: [[0, 0.5], [2, 0.4], [3, 0.65], [4, 0.4], [5, 0.5]],
  maracas: [[0, 0.45], [1, 0.25], [2, 0.35], [3, 0.45], [4, 0.3], [5, 0.35]],
} as const satisfies Pieza["perc"];
/** Son sureño del colectivo (6/8): bombo en el 1 y el 4 con un repique al final, sacudidores en cada corchea. */
const SON_ANDINO_PERC = {
  bombo: [[0, 1], [3, 0.85], [5, 0.35]],
  shekere: [[0, 0.5], [1, 0.3], [2, 0.45], [3, 0.5], [4, 0.3], [5, 0.45]],
  maracas: [[1, 0.4], [2, 0.3], [4, 0.4], [5, 0.3]],
  chajchas: [[2, 0.5], [5, 0.6]],
} as const satisfies Pieza["perc"];

/** El rasgueo del tiple en el sanjuanito: abajo en cada corchea y una subida en la semicorchea. */
const RASGUEO_SANJUANITO: readonly Rasgo[] = [[0, 1, "b"], [1, 0.7, "b"], [1.5, 0.5, "s"], [2, 0.9, "b"], [3, 0.7, "b"], [3.5, 0.5, "s"]];
/** El rasgueo del bambuco: los golpes fuertes en la tercera y la quinta corchea, como lo marca el tiple. */
const RASGUEO_BAMBUCO: readonly Rasgo[] = [[0, 0.6, "b"], [1, 0.5, "s"], [2, 0.95, "b"], [3, 0.5, "s"], [4, 0.95, "b"], [5, 0.5, "s"]];
/** El rasgueo del son sureño: de a tres corcheas, con el 1 y el 4 arriba. */
const RASGUEO_SON: readonly Rasgo[] = [[0, 0.8, "b"], [1, 0.5, "s"], [2, 0.6, "b"], [3, 0.9, "b"], [4, 0.5, "s"], [5, 0.6, "b"]];

// ---------- La Guaneña (tradicional) ----------

/** De dónde sale la melodía y por qué es tradicional (sin la letra). */
const GUANENA_FUENTES: readonly Fuente[] = [
  {
    titulo: "Música en la escuela, ¡una fiesta! 2: Folklore de Latinoamérica (cancionero escolar para flauta)",
    url: "https://musicaenlaescuelafiesta2.blogspot.com/2014/01/folklore-de-latinoamerica.html",
    dice: "La Guaneña, bambuco de Colombia, anónimo del siglo XVIII; trae la melodía en solfeo, de donde salen las tres frases.",
  },
  {
    titulo: "Wikipedia: La Guaneña",
    url: "https://es.wikipedia.org/wiki/La_Guane%C3%B1a",
    dice: "Su origen se pierde en la tradición oral (se la sitúa hacia 1789) y ninguna atribución está comprobada.",
  },
  {
    titulo: "Recital de música tradicional nariñense para quena y zampoña (Universidad de Nariño)",
    url: "https://sired.udenar.edu.co/9691/1/28918.pdf",
    dice: "La Guaneña (anónimo) en Mi menor y en 6/8 como son sureño, con las quenas a dos voces y las cuerdas que van entrando.",
  },
];

// La melodía de siempre, en Mi menor, como la versión para flauta de las escuelas (en solfeo, con "la" como
// tónica): "do mi la la la la do' la sol sol sol sol, la sol mi la sol mi re do", luego "do mi mi re do mi
// la sol, la sol mi la sol mi re do" y el cierre "do mi la do' la sol, la sol mi la sol mi re do". Aquí "la"
// es Mi5. Las frases entran a contratiempo (el "do mi" del final del compás anterior) y la del cierre acaba
// en la tercera del acorde, con la dominante antes. El primer compás es el golpe y la anacrusa (en la murga,
// un corte).
const GUANENA_TEMA: Tema = {
  notas:
    "E5 -:3 G4 B4 | E5:2 E5 E5 E5:2 | G5:3 E5 D5:2 | D5 D5 D5:2 E5 D5 | B4:2 E5 D5 B4:2 | A4 G4:3 G4 B4 | " +
    "B4:2 A4 G4 B4:2 | E5:3 D5 E5 D5 | B4:2 E5 D5 B4:2 | A4 G4:3 G4 B4 | " +
    "E5 G5 E5:2 D5:2 | E5 D5 B4:2 E5 D5 | B4:2 A4 G4:3",
  acordes: "Em Em G D Em Em Em C Em D/Em C G B7/Em",
};
/** Una variación (la misma melodía con notas de paso y bordados, sobre la misma armonía). */
const GUANENA_VARIACION: Tema = {
  notas:
    "E5:2 D5 B4 G4 B4 | E5 F#5 E5 D5 E5 G5 | G5 A5 G5 E5 D5 E5 | D5 C5 D5 B4 E5 D5 | B4 C5 B4 E5 D5 B4 | A4 B4 G4:2 G4 B4 | " +
    "B4 C5 A4 G4 B4 D5 | E5 F#5 E5 D5 E5 D5 | B4 D5 E5 D5 B4:2 | A4 B4 G4:2 G4 B4 | " +
    "E5 G5 A5 G5 E5 D5 | E5 D5 B4 D5 E5 D5 | B4 A4 B4 G4:3",
  acordes: GUANENA_TEMA.acordes,
};
/** La primera frase al doble de lento (el preámbulo de los arreglos del colectivo). */
const GUANENA_LENTA: Tema = {
  notas: "-:2 G4:2 B4:2 | E5:4 E5:2 | E5:2 E5:4 | G5:6 | E5:2 D5:4 | D5:2 D5:2 D5:2 | D5:2 E5:2 D5:2 | B4:4 E5:2 | D5:2 B4:4 | A4:2 G4:4 | G4:6",
  acordes: "Em Em Em G G D D Em Em D/Em Em",
};
/** Un interludio original (i, VII, VI, V) para los arreglos de La Guaneña. */
const GUANENA_INTERLUDIO: Tema = { notas: "B4:2 E5:2 G5:2 | F#5:2 A5:2 D5:2 | E5:2 G5:2 C5:2 | B4:2 D#5:2 F#5:2", acordes: "Em D C B7" };
/** El interludio largo, de doce compases (original): i, III, VI y V, como se acostumbra en Nariño. */
const GUANENA_INTERLUDIO_LARGO: Tema = {
  notas:
    "B4:2 E5:2 G5:2 | D5:2 G5 A5 B5:2 | C5:2 E5 G5 E5:2 | D#5:2 F#5 A5 F#5:2 | G5:2 E5 G5 B5:2 | B5:2 A5 G5 D5:2 | " +
    "E5:2 G5 E5 C5:2 | B4:2 D#5 F#5 A5:2 | G5 F#5 E5:2 B4:2 | C5 E5 G5:2 E5:2 | F#5 E5 D#5:2 B4:2 | E5:6",
  acordes: "Em G C B7 Em G C B7 Em C B7 Em",
};
const GUANENA_PUENTE: Tema = { notas: "B4 D5 G5:2 F#5 G5 | A5:2 F#5 D5 A4:2 | G4 B4 E5:2 G5 E5 | F#5:2 D#5 B4:3", acordes: "G D Em B7" };
const GUANENA_FINAL: Tema = { notas: "F#5:2 A5 F#5 D#5:2 | E5:6", acordes: "B7 Em" };

export const PIEZAS_MUSICA: Record<PiezaId, Pieza> = {
  // ---------------- Murga ----------------
  "son-vereda": {
    nombre: "Son de la vereda",
    conjunto: "murga",
    original: true,
    nota: "Son sureño original en 6/8, Re menor. Abre la percusión sola, los bronces entran con dos cortes y el tema pasa de la trompeta al saxo (con el trombón de contracanto), a las maderas y a la flauta; el final encadena cuatro cortes con toda la murga.",
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
      { tema: "A", lleva: "saxo", contra: "trombon", perc: "plena", cortes: [7] },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: "B", lleva: "maderas", colchon: "acordeon", perc: "liviana" },
      { tema: null, compases: 4, acorde: "Dm", perc: "sola" },
      { tema: "C", lleva: "trompeta", segunda: true, voces: "sextas", perc: "plena" },
      { tema: "C", lleva: "bronces", perc: "plena", cortes: [3, 7], din: [0.9, 1.15] },
      { tema: "A", lleva: "flauta", segunda: true, perc: "liviana" },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: null, compases: 2, acorde: "Dm", perc: "sola" },
      { tema: "B", lleva: "clarinete", segunda: true, contra: "trombon", perc: "plena" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "C", lleva: "tutti", perc: "plena", cortes: [7] },
      { tema: "A", lleva: "tutti", perc: "plena", cortes: [1, 3, 5, 7], din: [1, 1.15] },
      { tema: "F", lleva: "tutti", perc: "plena", final: true },
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
    nota: "Son sureño original en 6/8, La menor, con hemiolas (tres negras en el compás de seis corcheas) y un tema de pregunta y respuesta lleno de cortes; el güiro largo y el cencerro se suman al guasá, y el clarinete y la flauta se pasan la melodía.",
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
      { tema: "A", lleva: "saxo", contra: "trombon", perc: "plena" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7] },
      { tema: "C", lleva: "trompeta", perc: "plena", cortes: [1, 3, 5, 7] },
      { tema: null, compases: 4, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "clarinete", segunda: true, colchon: "acordeon", perc: "liviana" },
      { tema: "B", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "B", lleva: "saxo", perc: "plena", cortes: [3, 7] },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3] },
      { tema: "C", lleva: "maderas", perc: "plena" },
      { tema: "C", lleva: "bronces", perc: "plena", cortes: [1, 3, 5, 7] },
      { tema: null, compases: 2, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "flauta", segunda: true, perc: "plena" },
      { tema: "A", lleva: "tutti", perc: "plena", cortes: [7], din: [1, 1.15] },
      { tema: "F", lleva: "tutti", perc: "plena", final: true },
    ],
    perc: { ...SON_PERC, bombo: [[0, 1], [3, 0.85], [5, 0.4]], guiroLargo: [[0, 0.5], [3, 0.5]], cencerro: [[0, 0.6], [1, 0.3], [3, 0.6], [4, 0.3]] },
    acomp: SON_ACOMP,
    bajo: SON_BAJO,
  },
  "sanjuanito-plaza": {
    nombre: "Sanjuanito de la plaza",
    conjunto: "murga",
    original: true,
    nota: "Sanjuanito original de murga en 2/4, Mi menor: el bombo con su golpe cojo, güiro, caja, campana y redoblante; los bronces, la flauta y el acordeón se pasan el tema, y en la segunda vuelta los cortes caen cada cuatro compases.",
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
      { tema: "B", lleva: "flauta", segunda: true, perc: "liviana" },
      { tema: "A", lleva: "saxo", contra: "trombon", perc: "plena" },
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "B", lleva: "bronces", perc: "plena", cortes: [7, 15] },
      { tema: "A", lleva: "bronces", perc: "plena", cortes: [3, 7, 11, 15], din: [0.9, 1.1] },
      { tema: "B", lleva: "trompeta", segunda: true, perc: "plena" },
      { tema: "B", lleva: "acordeon", colchon: "clarinete", perc: "liviana" },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "A", lleva: "tutti", perc: "plena", cortes: [7, 11, 15] },
      { tema: "F", lleva: "tutti", perc: "plena", final: true },
    ],
    perc: SANJUANITO_MURGA_PERC,
    acomp: [[1, 0.6], [2, 0.35], [3, 0.6]],
    bajo: [[0, 1], [2, 0.8]],
  },
  "guanena-murga": {
    nombre: "La Guaneña (bambuco de murga)",
    conjunto: "murga",
    original: false,
    fuentes: GUANENA_FUENTES,
    nota: "La Guaneña (tradicional, anónima) arreglada para murga, en 3 como bambuco: la trompeta canta las tres frases con el saxo en terceras, cada vuelta arranca con un corte y la anacrusa, hay una variación para las maderas, contracantos del trombón y un interludio original con remates de timbal.",
    metrica: "3/4",
    bpm: 144,
    temas: { G: GUANENA_TEMA, V: GUANENA_VARIACION, R: GUANENA_INTERLUDIO, F: GUANENA_FINAL },
    forma: [
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "R", lleva: "bronces", perc: "plena", cortes: [3] },
      { tema: "G", lleva: "trompeta", segunda: true, perc: "plena", cortes: [0] },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0] },
      { tema: "R", lleva: "acordeon", perc: "liviana" },
      { tema: "V", lleva: "maderas", perc: "plena", cortes: [0] },
      { tema: "G", lleva: "saxo", contra: "trombon", perc: "plena", cortes: [0] },
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "tutti", perc: "plena", cortes: [0, 5, 9] },
      { tema: "R", lleva: "trompeta", perc: "plena", cortes: [1, 3] },
      { tema: "G", lleva: "flauta", segunda: true, colchon: "acordeon", perc: "liviana" },
      { tema: "V", lleva: "bronces", contra: "trombon", perc: "plena", cortes: [0, 8] },
      { tema: "G", lleva: "clarinete", segunda: true, perc: "liviana", cortes: [0] },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "tutti", perc: "plena", cortes: [0], din: [1, 1.2] },
      { tema: "F", lleva: "tutti", perc: "plena", final: true },
    ],
    perc: BAMBUCO_MURGA_PERC,
    acomp: [[2, 0.6], [3, 0.4], [4, 0.6]],
    bajo: [[0, 1], [4, 0.8]],
    extracto: 2,
  },
  "guanena-carnaval": {
    nombre: "La Guaneña (son sureño de murga)",
    conjunto: "murga",
    original: false,
    fuentes: GUANENA_FUENTES,
    nota: "La Guaneña (tradicional, anónima) como la tocan las murgas por la calle: son sureño en 6/8, más rápida, con la tambora y la caja, cortes al final de cada frase, el interludio largo de doce compases (original) y una variación de toda la murga que crece hasta el final.",
    metrica: "6/8",
    bpm: 112,
    temas: { G: GUANENA_TEMA, V: GUANENA_VARIACION, R: GUANENA_INTERLUDIO_LARGO, F: GUANENA_FINAL },
    forma: [
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "R", lleva: "bronces", perc: "plena", cortes: [3, 7] },
      { tema: "G", lleva: "trompeta", segunda: true, perc: "plena", cortes: [0] },
      { tema: "G", lleva: "tutti", perc: "plena", cortes: [0] },
      { tema: "V", lleva: "clarinete", contra: "trombon", perc: "plena" },
      { tema: "V", lleva: "maderas", colchon: "acordeon", perc: "liviana" },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "saxo", perc: "plena", cortes: [0, 5, 9] },
      { tema: "R", lleva: "tutti", perc: "plena", cortes: [3, 7, 11] },
      { tema: "G", lleva: "bronces", perc: "plena", cortes: [0] },
      { tema: "V", lleva: "tutti", perc: "plena", din: [0.95, 1.15] },
      { tema: "G", lleva: "tutti", perc: "plena", cortes: [0, 5, 9], din: [1.1, 1.2] },
      { tema: "F", lleva: "tutti", perc: "plena", final: true },
    ],
    perc: { ...SON_PERC, caja: [[1, 0.35], [2, 0.5], [4, 0.35], [5, 0.6]] },
    acomp: SON_ACOMP,
    bajo: SON_BAJO,
  },

  // ---------------- Colectivo andino ----------------
  sanjuanito: {
    nombre: "Sanjuanito del lago",
    conjunto: "colectivo",
    original: true,
    nota: "Sanjuanito original en 2/4, La menor: empieza la quena sola con la guitarra, entran el bombo, las maracas, las chajchas y el rasgueo del tiple; la zampoña hace la segunda voz, el rondador suena en terceras, el requinto y la bandola puntean un tema y el violín canta otro.",
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
      { tema: "C", lleva: "zampona", contra: "violin", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: null, compases: 4, acorde: "Am", perc: "sola" },
      { tema: "A", lleva: "requinto", segunda: true, perc: "plena" },
      { tema: "A", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "B", lleva: "todos", perc: "plena", din: [0.9, 1.1] },
      { tema: "C", lleva: "bandola", segunda: true, perc: "plena" },
      { tema: null, compases: 2, acorde: "Am", perc: "sola" },
      { tema: "B", lleva: "zampona", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: "A", lleva: "violin", colchon: "zampona", perc: "liviana" },
      { tema: "A", lleva: "todos", perc: "plena", din: [1, 1.15] },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: SANJUANITO_PERC,
    acomp: [[1, 0.6], [3, 0.6]],
    bajo: [[0, 1], [2, 0.8]],
    rasgueo: RASGUEO_SANJUANITO,
    extracto: 1,
  },
  guanena: {
    nombre: "La Guaneña (bambuco del colectivo)",
    conjunto: "colectivo",
    original: false,
    fuentes: GUANENA_FUENTES,
    nota: "La Guaneña (tradicional, anónima) para el colectivo, bambuco en Mi menor: dos quenas en cuartas abren sobre la guitarra, la primera frase suena lenta con el violín de colchón y luego la melodía completa pasa por la quena, todo el colectivo, la bandola y el requinto (en una variación), la zampoña y el violín, con contracantos y un puente original.",
    metrica: "3/4",
    bpm: 138,
    temas: { G: GUANENA_TEMA, V: GUANENA_VARIACION, L: GUANENA_LENTA, R: GUANENA_INTERLUDIO, P: GUANENA_PUENTE, F: GUANENA_FINAL },
    forma: [
      { tema: "R", lleva: "quenas", voces: "cuartas", perc: "nada" },
      { tema: "L", lleva: "quena", colchon: "violin", perc: "nada" },
      { tema: "G", lleva: "quena", perc: "liviana" },
      { tema: "G", lleva: "todos", perc: "plena", din: [0.9, 1.1] },
      { tema: "V", lleva: "cuerdas", colchon: "zampona", perc: "plena" },
      { tema: "P", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "R", lleva: "rondador", perc: "plena" },
      { tema: "G", lleva: "zampona", contra: "violin", perc: "plena" },
      { tema: "G", lleva: "quena", segunda: true, voces: "sextas", perc: "plena" },
      { tema: null, compases: 2, acorde: "Em", perc: "sola" },
      { tema: "V", lleva: "quena", contra: "bandola", perc: "plena" },
      { tema: "P", lleva: "todos", perc: "plena" },
      { tema: "G", lleva: "violin", colchon: "zampona", perc: "liviana" },
      { tema: "G", lleva: "todos", perc: "plena", din: [1, 1.2] },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: BAMBUCO_PERC,
    acomp: [[2, 0.6], [4, 0.6]],
    bajo: [[0, 1], [4, 0.75]],
    rasgueo: RASGUEO_BAMBUCO,
    extracto: 2,
  },
  "guanena-son": {
    nombre: "La Guaneña (son sureño del colectivo)",
    conjunto: "colectivo",
    original: false,
    fuentes: GUANENA_FUENTES,
    nota: "La Guaneña (tradicional, anónima) como son sureño en 6/8, como la tocan los grupos andinos de Pasto: el interludio largo (original) en dos quenas a la cuarta, las cuerdas que entran solas, la melodía con la segunda en terceras, el requinto con el violín de colchón, una variación de todos y el final con el mismo interludio.",
    metrica: "6/8",
    bpm: 100,
    temas: { G: GUANENA_TEMA, V: GUANENA_VARIACION, R: GUANENA_INTERLUDIO_LARGO, F: GUANENA_FINAL },
    forma: [
      { tema: "R", lleva: "quenas", voces: "cuartas", perc: "nada" },
      { tema: null, compases: 2, acorde: "Em", perc: "liviana", sin: ["rondador"] },
      { tema: "G", lleva: "quena", segunda: true, perc: "plena" },
      { tema: "G", lleva: "cuerdas", contra: "zampona", perc: "plena" },
      { tema: "R", lleva: "quena", perc: "plena" },
      { tema: "G", lleva: "requinto", colchon: "violin", perc: "liviana" },
      { tema: "V", lleva: "todos", perc: "plena" },
      { tema: null, compases: 4, acorde: "Em", perc: "sola" },
      { tema: "G", lleva: "quenas", perc: "plena" },
      { tema: "V", lleva: "violin", contra: "bandola", perc: "plena" },
      { tema: "G", lleva: "todos", perc: "plena", din: [1, 1.2] },
      { tema: "R", lleva: "quenas", voces: "cuartas", perc: "liviana" },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: SON_ANDINO_PERC,
    acomp: [[1, 0.5], [4, 0.5]],
    bajo: [[0, 1], [3, 0.8]],
    rasgueo: RASGUEO_SON,
    extracto: 2,
  },
  bambuco: {
    nombre: "Bambuco del Galeras",
    conjunto: "colectivo",
    original: true,
    nota: "Bambuco original en 3, Sol mayor con un tema en Mi menor: las frases entran después del primer tiempo, como se canta el bambuco; abre la quena sola con la guitarra, el tiple marca el rasgueo, las cuerdas y el violín se turnan, y cierra todo el colectivo.",
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
      { tema: "B", lleva: "zampona", contra: "violin", perc: "plena" },
      { tema: "C", lleva: "rondador", perc: "plena" },
      { tema: "C", lleva: "todos", perc: "plena" },
      { tema: null, compases: 2, acorde: "G", perc: "sola" },
      { tema: "A", lleva: "cuerdas", perc: "plena" },
      { tema: "B", lleva: "todos", perc: "plena" },
      { tema: "C", lleva: "violin", segunda: true, contra: "bandola", perc: "plena" },
      { tema: "A", lleva: "todos", perc: "plena", din: [1, 1.15] },
      { tema: "F", lleva: "todos", perc: "plena", final: true },
    ],
    perc: BAMBUCO_PERC,
    acomp: [[2, 0.6], [4, 0.6]],
    bajo: [[0, 1], [4, 0.75]],
    rasgueo: RASGUEO_BAMBUCO,
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
