// El Carnaval de Negros y Blancos jugable (VIR-160, docs/plan-carnaval.md): el festival del día 18 del
// verano, a la manera del de Pasto. Aquí las reglas puras: cuándo sale el desfile por la calle del Megabús,
// las carrozas y sus comparsas (con la coreografía que repiten en cada parada), la maicena y las
// serpentinas (con F sobre alguien de al lado), el concurso de disfraces, la tienda y las cinemáticas.
// Dónde va cada carroza en la calle lo calcula packages/map (carnaval.ts); lo decide la sala
// (apps/server/src/rooms/carnaval.ts).
//
// "Negros y Blancos" es el nombre de los días del carnaval (el 5 y el 6 de enero), no el color de las
// carrozas: en Pasto las carrozas y las comparsas son explosiones de color. Respeto cultural (decisión del
// plan): nunca se oscurece la piel de nadie. La maicena es el talco del Día de Blancos: cara empolvada un
// rato, y nunca a quien está en "No molestar" o pidió no recibirla. Los grupos son ficticios. El carnaval
// es de día: el Desfile Magno sale a las 10:00 y el concurso se premia antes de que oscurezca.
import { z } from "zod";
import { CARNAVAL_LANZABLES, type Lanzable } from "./carnaval-objetos";
import type { PiezaId } from "./carnaval-musica";
import type { CineAction, CineDef } from "./cinematicas";
import type { Look } from "./look";

export const CARNAVAL = {
  id: "carnaval",
  /**
   * Hora del juego en que sale el Desfile Magno: una sola vez por Carnaval (el festival dura un día del
   * juego), de día. No vuelve a salir hasta el Carnaval del año siguiente del calendario.
   */
  desfileHoras: [10],
  /** Minutos del juego después de la hora en que todavía puede salir (si el bus estaba en la calle, se espera). */
  ventanaMin: 30,
  /**
   * Velocidad del desfile (tiles por segundo real): despacio, como el Desfile Magno. La fila es larga (las
   * carrozas con sus comparsas grandes, las murgas y los disfraces) y va pasando por la calle: el desfile
   * entero dura unos 17 minutos reales (ver `desfileDuracionMs` en packages/map).
   */
  velocidad: 0.34,
  /** Lo que dura cada parada (ms reales): las comparsas repiten su frase. */
  paradaMs: 45_000,
  /** Un tiempo de la música (ms): una frase son 8. */
  beatMs: 500,
  /** Distancia (tiles, a lo largo de la calle) a la comparsa de la cabaña para sumarse desde la vereda. */
  joinReachTiles: 5,
  /** Desde qué fila (tile y del jardín) se está en la vereda o la plataforma, a la orilla de la calle. */
  veredaDesdeY: 126,
  /** Distancia (tiles) para echarle maicena o serpentinas a alguien, y la pausa entre dos. */
  lanzarReachTiles: 3,
  lanzarPausaMs: 2000,
  /** Lo que dura la cara empolvada. */
  talcoMs: 45_000,
  /** Cuánto hay que bailar (tiles de calle) para los puntos al bajarse. */
  tramoConPuntos: 30,
  /** Puntos (LEISURE) por bailar un buen trecho del desfile, y en cuántos desfiles por festival se pagan. */
  puntosDesfile: 15,
  desfilesConPuntos: 2,
  /** Hora del juego en que cierra y se premia el concurso de disfraces: de día, antes del cierre del festival. */
  concursoCierre: 18,
  /** Hora del juego en que cierra el Carnaval (con su cinemática): antes de que oscurezca. */
  cierre: 18.5,
  /** El premio chico de quien gana el concurso (LEISURE). */
  premioPuntos: 25,
  maxCandidatos: 40,
  /** Pausa entre dos compras de la misma persona. */
  compraPausaMs: 1200,
} as const;

/** ¿Se puede jugar ya? Solo con el festival abierto (de las 9:00 a las 22:00 del juego). */
export const carnavalActivo = (festival: string, fase: string) => festival === CARNAVAL.id && fase === "fiesta";

/** La hora del desfile que toca a ese minuto del día del juego (o null). */
export function desfileDeLaHora(minuteOfDay: number): number | null {
  for (const h of CARNAVAL.desfileHoras) if (minuteOfDay >= h * 60 && minuteOfDay < h * 60 + CARNAVAL.ventanaMin) return h;
  return null;
}

export const CARNAVAL_MSG = {
  /** Cliente → servidor: sumarse a la comparsa de la cabaña (desde la vereda, junto al Megabús de la alegría). */
  join: "carnaval:sumarse",
  /** Cliente → servidor: salirse de la comparsa (queda en la vereda). */
  leave: "carnaval:salirse",
  /** Servidor → quien pidió: si se pudo (`JoinResult`). */
  joinResult: "carnaval:sumarse:resultado",
  /** Cliente → servidor: echarle lo de la mano (maicena o serpentinas) a alguien (`{ to: sessionId }`). */
  lanzar: "carnaval:lanzar",
  lanzarResult: "carnaval:lanzar:resultado",
  /** Servidor → los del nivel: alguien le echó algo a otro (para el polvo o el confeti). */
  lanzado: "carnaval:lanzado",
  /** Cliente → servidor: no quiero recibir maicena ni serpentinas (`{ off: boolean }`). */
  talcoPref: "carnaval:talco:pref",
  /** Cliente → servidor: postular mi pinta de ahora al concurso de disfraces. */
  postular: "carnaval:postular",
  /** Cliente → servidor: votar por alguien (`{ userId }`), una vez por festival. */
  votar: "carnaval:votar",
  concursoResult: "carnaval:concurso:resultado",
  /** Cliente → servidor: comprar en el puesto del carnaval (`{ item }`). */
  buy: "carnaval:comprar",
  buyResult: "carnaval:comprar:resultado",
} as const;

// ---------- Las carrozas y sus comparsas ----------

/** Las carrozas, en el orden del desfile (el Megabús siempre al final). */
export const CARROZA_IDS = ["castaneda", "condor", "galeras", "tablero", "reloj", "luna", "paramo", "minga", "tinto", "juglar", "megabus"] as const;
export type CarrozaId = (typeof CARROZA_IDS)[number];

/** Quién hace un paso de la coreografía: un bailarín (`b0`…), todos, o los pares o impares. */
export type FraseQuien = "todos" | "pares" | "impares" | `b${number}`;
/** Un lugar de la frase: corrido desde el puesto del bailarín (en tiles). */
export interface FraseLugar {
  dx: number;
  dy: number;
}
/**
 * Un paso de la coreografía: el mismo vocabulario de las cinemáticas (`act`, `walk` con `path` y `run`,
 * `wait`, `together`), pero medido en el tiempo del desfile para que todos lo vean igual aunque lleguen
 * a la mitad (ver `programarFrase`).
 */
export type FrasePaso =
  | { op: "act"; who: FraseQuien; action: CineAction }
  | { op: "walk"; who: FraseQuien; path: readonly FraseLugar[]; run?: boolean }
  | { op: "wait"; ms: number }
  | { op: "together"; steps: readonly FrasePaso[] }
  /** Uno tras otro (sirve dentro de `together` para correr a alguien en el tiempo, como en la ola). */
  | { op: "seq"; steps: readonly FrasePaso[] };

export interface Comparsa {
  id: CarrozaId;
  /** La carroza. */
  nombre: string;
  /** El grupo (ficticio) que baila con ella. */
  grupo: string;
  /** El color que distingue a la carroza (de ahí salen los colores de los trajes de su comparsa). */
  acento: string;
  /** Lo que ocupa en la calle (tiles a lo largo, la carroza y su comparsa detrás). */
  largo: number;
  /** La pinta de cada bailarín (los colores de su carroza en la ropa; la piel, la de cada quien). */
  bailarines: readonly Look[];
  /** Lo que repite en cada parada (en bucle). */
  frase: readonly FrasePaso[];
  /** La pieza con que empieza a sonar a su paso (ver `PIEZAS` en carnaval-musica.ts; luego rota). */
  pieza: PiezaId;
}


const BLANCO = "#f3f1ec";
const NEGRO = "#24212e";
/** Pieles de la gente de la cabaña: la que es, sin pintar. */
const PIELES = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#d9a066"] as const;

/**
 * Los colores de cada carroza (por su acento) para los trajes de su comparsa: las comparsas de Pasto van
 * de colores que combinan con su carroza.
 */
const PALETAS: Record<string, readonly [string, string, string]> = {
  "#9a6a40": ["#7a3ca8", "#1fa8a0", "#e0a428"],
  "#dcae3f": ["#2f6fd6", "#f2711c", "#3db842"],
  "#ee7a22": ["#3f9a3a", "#f7c518", "#e0283c"],
  "#c8343a": ["#c8243a", "#1f8a4a", "#f2c21c"],
  "#b98424": ["#1f8a8a", "#c8287a", "#e6aa2a"],
  "#3a5aa8": ["#2a5ac8", "#d0287a", "#e0a526"],
  "#6f8a3a": ["#22a07a", "#8a3cc8", "#f0702a"],
  "#7a4a2a": ["#f4ead6", "#7a2ab8", "#1fa8c0"],
  "#a6d23a": ["#a6d23a", "#c8287a", "#f2711c"],
  "#2a52d0": ["#d8283a", "#2a52d0", "#e0a526"],
};

/** Una comparsa grande: doce bailarines. */
const CUADRILLA = Array.from({ length: 12 }, (_, i) => i);

/** Un bailarín de comparsa: el traje de los colores de su carroza (la piel, la de cada quien). */
const comparsero = (i: number, acento: string, o: Partial<Look> = {}): Look => {
  const p = PALETAS[acento] ?? [acento, TEJIDO[(i + 1) % TEJIDO.length]!, TEJIDO[(i + 3) % TEJIDO.length]!];
  return {
    skin: PIELES[i % PIELES.length]!,
    hair: ["#2b1b12", "#4a2a1a", "#1d1622", "#6e4a2a"][i % 4]!,
    shirt: p[i % 3]!,
    pants: p[(i + 1) % 3]!,
    accent: acento,
    top2: p[(i + 2) % 3]!,
    hairStyle: (["bun", "short", "braids", "curly"] as const)[i % 4]!,
    accessories: [],
    top: "longsleeve",
    bottom: i % 2 ? "pants" : "long-skirt",
    shoes: "boots",
    shoeColor: NEGRO,
    face: "carnival-mask",
    ...o,
  };
};

/** Completa una comparsa hasta doce: los que faltan repiten los trajes con otra piel y otro pelo. */
const grande = (base: readonly Look[]): Look[] =>
  CUADRILLA.map((i) => (i < base.length ? base[i]! : { ...base[i % base.length]!, skin: PIELES[(i * 5) % PIELES.length]!, hair: ["#2b1b12", "#4a2a1a", "#1d1622", "#6e4a2a"][(i * 3) % 4]! }));

const todos = (action: CineAction): FrasePaso => ({ op: "act", who: "todos", action });
const juntos = (...steps: FrasePaso[]): FrasePaso => ({ op: "together", steps });
const camina = (who: FraseQuien, path: FraseLugar[], run = false): FrasePaso => ({ op: "walk", who, path, ...(run ? { run } : {}) });
const hace = (who: FraseQuien, action: CineAction): FrasePaso => ({ op: "act", who, action });
/** Los primeros `n` bailarines (`b0`…). */
const cada = (n: number): FraseQuien[] => Array.from({ length: n }, (_, i) => `b${i}` as const);

/**
 * La ola en cadena: cada bailarín hace `action` `gapMs` después del de al lado (por orden de puesto, de la
 * carroza hacia atrás, o al revés), todo dentro de un `together`.
 */
export function ola(n: number, action: CineAction, gapMs: number, reves = false): FrasePaso {
  return juntos(...cada(n).map((who, i): FrasePaso => ({ op: "seq", steps: [{ op: "wait", ms: (reves ? n - 1 - i : i) * gapMs }, hace(who, action)] })));
}

/** Los colores del tejido andino de la Minga (la carroza y las fajas de su comparsa). */
export const TEJIDO = ["#c8336e", "#e8a317", "#2f8f6a", "#3a62b8", "#d4572a"] as const;

export const COMPARSAS: readonly Comparsa[] = [
  {
    id: "castaneda",
    nombre: "La Familia Castañeda llega",
    grupo: "Comparsa Familia Castañeda",
    acento: "#9a6a40",
    largo: 7,
    pieza: "sanjuanito",
    // La abuela (b0) con sombrilla y los nietos, con ropa "de 1928".
    bailarines: grande([
      comparsero(0, "#9a6a40", { hairStyle: "bun", hair: "#d8d8de", outfit: "gown", head: "straw-hat", face: "round-glasses" }),
      comparsero(1, "#9a6a40", { head: "top-hat", neck: "bowtie", face: "none" }),
      comparsero(2, "#9a6a40", { outfit: "vest", face: "none" }),
      comparsero(3, "#9a6a40", { head: "straw-hat", face: "none" }),
    ]),
    // Paso de paseo: saludan a los dos lados, giran juntos; la abuela se desmaya y la levantan.
    frase: [
      todos("saludar"),
      { op: "together", steps: [{ op: "act", who: "pares", action: "girar" }, { op: "act", who: "impares", action: "girar" }] },
      { op: "act", who: "b0", action: "temblar" },
      { op: "together", steps: [{ op: "walk", who: "b1", path: [{ dx: 0.6, dy: -0.4 }] }, { op: "walk", who: "b2", path: [{ dx: -0.6, dy: -0.4 }] }] },
      { op: "act", who: "b0", action: "saltar" },
      { op: "together", steps: [{ op: "walk", who: "b1", path: [{ dx: 0, dy: 0 }] }, { op: "walk", who: "b2", path: [{ dx: 0, dy: 0 }] }] },
      todos("celebrar"),
    ],
  },
  {
    id: "condor",
    nombre: "El Cóndor de los Andes",
    grupo: "Colectivo coreográfico Talco y Ceniza",
    acento: "#dcae3f",
    largo: 8,
    pieza: "sanjuanito",
    bailarines: CUADRILLA.map((i) => comparsero(i, "#dcae3f", { back: "wings" })),
    // Dos filas abren los brazos al ritmo de las alas; en el tiempo 8, todos saltan.
    frase: [
      { op: "together", steps: [{ op: "act", who: "pares", action: "bailar" }, { op: "walk", who: "impares", path: [{ dx: 0, dy: 0.5 }] }] },
      { op: "together", steps: [{ op: "act", who: "impares", action: "bailar" }, { op: "walk", who: "impares", path: [{ dx: 0, dy: 0 }] }] },
      todos("bailar"),
      { op: "wait", ms: 500 },
      todos("saltar"),
    ],
  },
  {
    id: "galeras",
    nombre: "El Galeras que fuma",
    grupo: "Murga Los Tamborileros del Galeras",
    acento: "#ee7a22",
    largo: 7,
    pieza: "guanena",
    bailarines: CUADRILLA.map((i) => comparsero(i, "#ee7a22", { head: i % 2 ? "bucket-hat" : "beanie" })),
    // Un círculo alrededor del volcán; tiemblan cuando "erupciona" y celebran.
    frase: [
      {
        op: "together",
        steps: [
          { op: "walk", who: "b0", run: true, path: [{ dx: 0.8, dy: 0 }, { dx: 0.8, dy: 0.8 }, { dx: 0, dy: 0.8 }, { dx: 0, dy: 0 }] },
          { op: "walk", who: "b1", run: true, path: [{ dx: 0, dy: 0.8 }, { dx: -0.8, dy: 0.8 }, { dx: -0.8, dy: 0 }, { dx: 0, dy: 0 }] },
          { op: "walk", who: "b2", run: true, path: [{ dx: -0.8, dy: 0 }, { dx: -0.8, dy: -0.8 }, { dx: 0, dy: -0.8 }, { dx: 0, dy: 0 }] },
          { op: "walk", who: "b3", run: true, path: [{ dx: 0, dy: -0.8 }, { dx: 0.8, dy: -0.8 }, { dx: 0.8, dy: 0 }, { dx: 0, dy: 0 }] },
        ],
      },
      todos("temblar"),
      { op: "wait", ms: 500 },
      todos("celebrar"),
      todos("bailar"),
    ],
  },
  {
    id: "tablero",
    nombre: "El Tablero vivo",
    grupo: "Cuadrilla del Tablero",
    acento: "#c8343a",
    largo: 7,
    pieza: "sanjuanito",
    // Cuatro peones (blancos y negros, con el gorro de bolita) y la reina (b4) con su corona.
    bailarines: grande([
      ...CUADRILLA.slice(0, 4).map((i) => comparsero(i, "#c8343a", { head: "pompom-beanie", face: "none", outfit: "vest" })),
      comparsero(4, "#c8343a", { head: "crown", outfit: "gown", neck: "pearls", shirt: BLANCO, pants: BLANCO }),
    ]),
    // Los peones avanzan una casilla (primero la fila de adelante), giran dos veces, la reina cruza en
    // diagonal corriendo y vuelve, y todos regresan a su casilla y le hacen la venia al público.
    frase: [
      juntos(camina("b0", [{ dx: 1, dy: 0 }]), camina("b1", [{ dx: 1, dy: 0 }])),
      juntos(camina("b2", [{ dx: 1, dy: 0 }]), camina("b3", [{ dx: 1, dy: 0 }])),
      juntos(...cada(4).map((who) => hace(who, "girar")), hace("b4", "asentir")),
      juntos(...cada(4).map((who) => hace(who, "girar"))),
      camina("b4", [{ dx: 1.3, dy: 1.3 }, { dx: 2.6, dy: 0 }], true),
      hace("b4", "celebrar"),
      camina("b4", [{ dx: 1.3, dy: 1.3 }, { dx: 0, dy: 0 }], true),
      juntos(...cada(4).map((who) => camina(who, [{ dx: 0, dy: 0 }]))),
      todos("asentir"),
    ],
  },
  {
    id: "reloj",
    nombre: "El Reloj de E.",
    grupo: "Los Engranajes de la vereda",
    acento: "#b98424",
    largo: 7,
    pieza: "sanjuanito",
    bailarines: CUADRILLA.map((i) => comparsero(i, "#b98424", { head: "top-hat", neck: "bowtie" })),
    // Engranajes que giran en sentidos alternos; con la campanada, quietos y asienten.
    frase: [
      { op: "act", who: "pares", action: "girar" },
      { op: "act", who: "impares", action: "girar" },
      { op: "act", who: "pares", action: "girar" },
      { op: "act", who: "impares", action: "girar" },
      { op: "wait", ms: 500 },
      todos("asentir"),
      { op: "wait", ms: 500 },
      todos("asentir"),
    ],
  },
  {
    id: "luna",
    nombre: "La Luna en el lago",
    grupo: "Los del muelle",
    acento: "#3a5aa8",
    largo: 7,
    pieza: "sanjuanito",
    bailarines: CUADRILLA.map((i) => comparsero(i, "#3a5aa8", { head: i % 2 ? "tiara" : "flower", back: "cape", face: i % 3 ? "carnival-mask" : "none", ...(i % 2 ? {} : { outfit: "gown" as const }) })),
    // La ola en cadena: cada uno salta medio tiempo después del de al lado, ida y vuelta; luego se mecen.
    frase: [
      ola(6, "saltar", CARNAVAL.beatMs / 2),
      ola(6, "saltar", CARNAVAL.beatMs / 2, true),
      todos("bailar"),
      ola(6, "girar", CARNAVAL.beatMs / 2),
      todos("saludar"),
    ],
  },
  {
    id: "paramo",
    nombre: "El Páramo",
    grupo: "Los del Páramo",
    acento: "#6f8a3a",
    largo: 7,
    pieza: "sanjuanito",
    // Los colibríes: alas, cintillo y la ropa de los colores del páramo.
    bailarines: CUADRILLA.map((i) => comparsero(i, "#6f8a3a", { back: "wings", head: "headband", face: "none", ...(i % 2 ? {} : { outfit: "ruana" as const }) })),
    // Los colibríes corren en zigzag delante de la carroza (una fila a contratiempo de la otra), giran allá,
    // vuelven en zigzag y bailan.
    frase: [
      juntos(
        camina("pares", [{ dx: 1, dy: 0.55 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0.55 }, { dx: 4, dy: 0 }], true),
        camina("impares", [{ dx: 1, dy: -0.55 }, { dx: 2, dy: 0 }, { dx: 3, dy: -0.55 }, { dx: 4, dy: 0 }], true),
      ),
      todos("girar"),
      juntos(
        camina("pares", [{ dx: 3, dy: 0.55 }, { dx: 2, dy: 0 }, { dx: 1, dy: 0.55 }, { dx: 0, dy: 0 }], true),
        camina("impares", [{ dx: 3, dy: -0.55 }, { dx: 2, dy: 0 }, { dx: 1, dy: -0.55 }, { dx: 0, dy: 0 }], true),
      ),
      todos("bailar"),
      todos("saltar"),
    ],
  },
  {
    id: "minga",
    nombre: "La Minga de la cosecha",
    grupo: "La Minga",
    acento: TEJIDO[0],
    largo: 7,
    pieza: "sanjuanito",
    // La gente del huerto: ruana o delantal, sombrero de paja o flor, y cada uno con la faja de otro color del tejido.
    bailarines: CUADRILLA.map((i) => comparsero(i, TEJIDO[i % TEJIDO.length]!, { outfit: i % 2 ? "apron" : "ruana", head: i % 2 ? "flower" : "straw-hat", face: "none" })),
    // La ronda de la mano: los cuatro de adelante (dos columnas de la comparsa) pasan cada uno al puesto del
    // siguiente hasta dar la vuelta entera (b0 → b1 → b4 → b3 → b0); bailan, se arriman a la vereda a ofrecer la cosecha, celebran y vuelven.
    frase: [
      juntos(
        camina("b0", [{ dx: 0, dy: 0.9 }, { dx: -1.4, dy: 0.9 }, { dx: -1.4, dy: 0 }, { dx: 0, dy: 0 }]),
        camina("b1", [{ dx: -1.4, dy: 0 }, { dx: -1.4, dy: -0.9 }, { dx: 0, dy: -0.9 }, { dx: 0, dy: 0 }]),
        camina("b4", [{ dx: 0, dy: -0.9 }, { dx: 1.4, dy: -0.9 }, { dx: 1.4, dy: 0 }, { dx: 0, dy: 0 }]),
        camina("b3", [{ dx: 1.4, dy: 0 }, { dx: 1.4, dy: 0.9 }, { dx: 0, dy: 0.9 }, { dx: 0, dy: 0 }]),
      ),
      todos("bailar"),
      camina("todos", [{ dx: 0.3, dy: -0.6 }]),
      todos("saludar"),
      todos("celebrar"),
      camina("todos", [{ dx: 0, dy: 0 }]),
      todos("bailar"),
    ],
  },
  {
    id: "tinto",
    nombre: "El tinto de Doña Aurora",
    grupo: "Las meseras de la cafetería",
    acento: "#7a4a2a",
    largo: 7,
    pieza: "sanjuanito",
    bailarines: CUADRILLA.map((i) => comparsero(i, "#7a4a2a", { face: "none", neck: "neckerchief", head: i % 2 ? "straw-hat" : "flower", ...(i % 2 ? {} : { outfit: "apron" as const }) })),
    // Saludan desde la calle, reparten "tinto" y asienten (las burbujas las pone el navegador).
    frase: [
      todos("saludar"),
      { op: "together", steps: [{ op: "walk", who: "pares", path: [{ dx: 0, dy: -0.6 }] }, { op: "act", who: "impares", action: "asentir" }] },
      { op: "act", who: "pares", action: "asentir" },
      { op: "walk", who: "pares", path: [{ dx: 0, dy: 0 }] },
      todos("bailar"),
      todos("celebrar"),
    ],
  },
  {
    id: "juglar",
    nombre: "El Juglar del acordeón",
    grupo: "Banda Juglares de la Vereda",
    acento: "#2a52d0",
    largo: 7,
    pieza: "guanena-murga",
    // La banda del juglar: chaquetas rojas y azules de botones dorados; los pares de quepis y los impares
    // de gorro de juglar (el de fiesta), todos con antifaz.
    bailarines: CUADRILLA.map((i) => comparsero(i, "#2a52d0", { outfit: "vest", head: i % 2 ? "party-hat" : "sailor-hat", ...(i % 3 === 0 ? { pattern: "stripes" as const } : {}) })),
    // Marchan como banda: saludan, la ola de saltos de la carroza hacia atrás, giran por parejas y aplauden.
    frase: [todos("saludar"), ola(12, "saltar", 140), { op: "together", steps: [{ op: "act", who: "pares", action: "girar" }, { op: "act", who: "impares", action: "bailar" }] }, todos("bailar"), todos("celebrar")],
  },
  {
    id: "megabus",
    nombre: "El Megabús de la alegría",
    grupo: "Comparsa de la cabaña",
    acento: "#a6d23a",
    largo: 9,
    pieza: "son-vereda",
    // Dos de la murga van delante de la gente de la cabaña, marcando el paso.
    bailarines: CUADRILLA.slice(0, 8).map((i) => comparsero(i + 2, "#a6d23a", { head: "party-hat" })),
    frase: [todos("bailar"), todos("girar"), todos("saltar"), todos("celebrar")],
  },
];

export const comparsaById = (id: string) => COMPARSAS.find((c) => c.id === id);

// ---------- Lo que va entre carroza y carroza ----------

/** Lo que toca cada músico de una murga (el dibujo lo pone el navegador sobre el chibi). */
export const INSTRUMENTOS = ["bombo", "trompeta", "acordeon", "redoblante", "tuba"] as const;
export type Instrumento = (typeof INSTRUMENTOS)[number];

/** Los músicos de una murga, que caminan con sus instrumentos (la música y el nombre, en `MURGAS` de carnaval-musica.ts). */
export interface MusicoMurga {
  look: Look;
  instrumento: Instrumento;
}

/** Un grupo de disfraces individuales: personajes sueltos con trajes enormes (se dibujan más grandes). */
export interface GrupoDisfraces {
  id: string;
  nombre: string;
  personajes: readonly { nombre: string; look: Look }[];
}

const murguista = (i: number, colores: readonly [string, string, string], o: Partial<Look> = {}): Look => ({
  ...comparsero(i, colores[0]),
  shirt: colores[i % 3]!,
  pants: colores[(i + 1) % 3]!,
  top2: colores[(i + 2) % 3]!,
  outfit: "vest",
  head: "straw-hat",
  face: "none",
  ...o,
});

/**
 * Los músicos de cada murga (por el id de `MURGAS` en carnaval-musica.ts), en uniforme azul y morado con
 * ribetes dorados, como las murgas de Pasto.
 */
export const MUSICOS_MURGA: Record<string, readonly MusicoMurga[]> = {
  "murga-ruana": (["bombo", "trompeta", "redoblante", "acordeon", "trompeta", "bombo"] as const).map((instrumento, i) => ({ instrumento, look: murguista(i, ["#2a4ad0", "#7a2ac8", "#e6aa2a"]) })),
  "murga-cuyes": (["tuba", "trompeta", "acordeon", "bombo", "redoblante", "trompeta"] as const).map((instrumento, i) => ({ instrumento, look: murguista(i, ["#7a2ac8", "#2a4ad0", "#e6aa2a"], { head: "sailor-hat" }) })),
  "murga-tambores": (["acordeon", "bombo", "trompeta", "tuba", "redoblante", "bombo"] as const).map((instrumento, i) => ({ instrumento, look: murguista(i, ["#2a4ad0", "#e6aa2a", "#7a2ac8"], { head: "vueltiao" }) })),
};

const disfraz = (i: number, o: Partial<Look>): Look => ({ ...comparsero(i, "#c8287a"), face: "none", ...o });

export const DISFRACES: readonly GrupoDisfraces[] = [
  {
    id: "reyes-del-sol",
    nombre: "Disfraces: los reyes del sol",
    personajes: [
      { nombre: "El rey del sol", look: disfraz(0, { shirt: "#f2c21c", pants: "#e0283c", top2: "#f2711c", accent: "#f2c21c", outfit: "gown", head: "crown", back: "cape", neck: "chain" }) },
      { nombre: "La luna de plata", look: disfraz(1, { shirt: "#d8d2ee", pants: "#2a5ac8", top2: "#1fb8c8", accent: "#d8d2ee", outfit: "gown", head: "tiara", back: "cape" }) },
      { nombre: "El colibrí", look: disfraz(2, { shirt: "#0f8a8a", pants: "#2fa84a", top2: "#d0287a", accent: "#e8b81c", back: "wings", head: "headband", face: "carnival-mask" }) },
    ],
  },
  {
    id: "mascaras",
    nombre: "Disfraces: las máscaras de colores",
    personajes: [
      { nombre: "El arlequín", look: disfraz(3, { shirt: "#e0283c", pants: "#2f6fd6", top2: "#f2c21c", accent: "#3db842", pattern: "stripes", head: "party-hat", face: "carnival-mask" }) },
      { nombre: "La mariposa", look: disfraz(4, { shirt: "#f2711c", pants: "#8a3cc8", top2: "#f2c21c", accent: "#c8287a", back: "wings", head: "flower", face: "carnival-mask" }) },
      { nombre: "El mago del páramo", look: disfraz(5, { shirt: "#5a8a3a", pants: "#2a2a5a", top2: "#e8b81c", accent: "#0f8a8a", outfit: "robe", head: "wizard-hat" }) },
    ],
  },
  {
    id: "tradicion",
    nombre: "Disfraces: la tradición",
    personajes: [
      { nombre: "La cuyera", look: disfraz(6, { shirt: "#c8336e", pants: "#e8a317", top2: "#2f8f6a", accent: "#3a62b8", outfit: "ruana", head: "straw-hat" }) },
      { nombre: "El pirata del lago", look: disfraz(7, { shirt: "#2a5ac8", pants: "#f4ead6", top2: "#e0283c", accent: "#f2c21c", head: "pirate-hat", back: "cape" }) },
      { nombre: "La reina de las flores", look: disfraz(8, { shirt: "#ef6ba0", pants: "#3db842", top2: "#f7c518", accent: "#f7c518", outfit: "dress", head: "flower", neck: "pearls" }) },
    ],
  },
];

/** Lo que pasa por la calle, en orden: las carrozas con su comparsa, las murgas y los disfraces. */
export type DesfileItem = { tipo: "carroza"; id: CarrozaId } | { tipo: "murga"; id: string } | { tipo: "disfraces"; id: string };

/**
 * El orden del Desfile Magno. Para sumar una carroza basta con su comparsa en `COMPARSAS`, su dibujo en
 * packages/map (art/carrozas) y su lugar aquí.
 */
export const DESFILE_ORDEN: readonly DesfileItem[] = [
  { tipo: "carroza", id: "castaneda" },
  { tipo: "carroza", id: "condor" },
  { tipo: "murga", id: "murga-ruana" },
  { tipo: "carroza", id: "galeras" },
  { tipo: "disfraces", id: "reyes-del-sol" },
  { tipo: "carroza", id: "tablero" },
  { tipo: "carroza", id: "reloj" },
  { tipo: "murga", id: "murga-cuyes" },
  { tipo: "carroza", id: "luna" },
  { tipo: "carroza", id: "paramo" },
  { tipo: "disfraces", id: "mascaras" },
  { tipo: "carroza", id: "minga" },
  { tipo: "murga", id: "murga-tambores" },
  { tipo: "carroza", id: "tinto" },
  { tipo: "disfraces", id: "tradicion" },
  { tipo: "carroza", id: "juglar" },
  { tipo: "carroza", id: "megabus" },
];

/** Los músicos de una murga del desfile (o ninguno). */
export const musicosDe = (id: string): readonly MusicoMurga[] => MUSICOS_MURGA[id] ?? [];
export const disfracesById = (id: string) => DISFRACES.find((d) => d.id === id);

/** Lo que la gente de la cabaña repite en las paradas (los emotes que la sala manda, en bucle). */
export const COMPARSA_CABANA_EMOTES = ["dance", "party", "star", "clap"] as const;

/** Lo que dice Don Evelio, el abanderado, al llegar a cada parada (la primera, el portón; la segunda, el palco). */
export const EVELIO_PARADAS = [
  "¡Ananay, qué carrozas! Súmense a la comparsa, que aquí se baila con todo y ruana.",
  "¡Llegamos al palco! Que el jurado mire bien, que esto se hizo con papel maché y cariño.",
] as const;

/** Lo que va diciendo de cada carroza al pasar (burbujas). */
export const EVELIO_CARROZAS: Record<CarrozaId, string> = {
  castaneda: "¡Ahí llega la Familia Castañeda, con baúles y todo, como cada año!",
  condor: "¡Miren ese cóndor! Con las alas de todos los colores, como el de Pasto.",
  galeras: "¡El Galeras fumando! Tranquilos, que es humo de algodón.",
  tablero: "¡El Tablero vivo! La Cuadrilla del piso 3 se toma muy en serio lo de ser peones.",
  reloj: "¡El reloj de E.! Trece campanadas… ¿sí las oyen?",
  luna: "La Luna en el lago… ¿vieron la llavecita que le cuelga? Dicen que es de la casa.",
  paramo: "El Páramo, de donde nace el agua. ¡Cuidadito con pisar los frailejones!",
  minga: "¡La Minga! Papa, maíz, quinua y guaguas de pan: lo que da la tierra se comparte.",
  tinto: "Un tinto de Doña Aurora pa'l frío. ¡Achichay!",
  juglar: "¡El Juglar del acordeón! Ese perro sabe más de música que yo.",
  megabus: "¡Y cierra el Megabús de la alegría! Detrás va la gente de la casa.",
};

// ---------- La coreografía en el tiempo ----------

/** Lo que dura cada acción en una frase (ms). */
export const FRASE_ACT_MS: Record<CineAction, number> = { bailar: 1000, girar: 600, celebrar: 600, saltar: 500, asentir: 500, temblar: 500, saludar: 500 };
/** Lo que se tarda en cruzar un tile caminando y corriendo en una frase. */
export const FRASE_TILE_MS = { walk: 300, run: 150 } as const;

export type FraseEvento =
  | { kind: "act"; who: number; at: number; dur: number; action: CineAction }
  | { kind: "walk"; who: number; at: number; dur: number; from: FraseLugar; to: FraseLugar; run: boolean };

export interface FraseProgramada {
  /** Lo que dura la frase completa (se repite en bucle). */
  ms: number;
  eventos: readonly FraseEvento[];
  bailarines: number;
}

/** A quiénes toca un paso. */
export function quienes(who: FraseQuien, n: number): number[] {
  const all = Array.from({ length: n }, (_, i) => i);
  if (who === "todos") return all;
  if (who === "pares") return all.filter((i) => i % 2 === 0);
  if (who === "impares") return all.filter((i) => i % 2 === 1);
  const i = Number(who.slice(1));
  return Number.isInteger(i) && i >= 0 && i < n ? [i] : [];
}

/**
 * Pone la frase en el tiempo: cada paso empieza cuando termina el anterior (los de `together`, a la vez,
 * y siguen cuando termina el más largo). Así un bailarín que se suma a la mitad está donde tiene que estar.
 */
export function programarFrase(pasos: readonly FrasePaso[], n: number): FraseProgramada {
  const eventos: FraseEvento[] = [];
  const at: FraseLugar[] = Array.from({ length: n }, () => ({ dx: 0, dy: 0 }));
  const run = (p: FrasePaso, t0: number): number => {
    switch (p.op) {
      case "wait":
        return p.ms;
      case "act": {
        const dur = FRASE_ACT_MS[p.action];
        for (const who of quienes(p.who, n)) eventos.push({ kind: "act", who, at: t0, dur, action: p.action });
        return dur;
      }
      case "walk": {
        let longest = 0;
        const per = p.run ? FRASE_TILE_MS.run : FRASE_TILE_MS.walk;
        for (const who of quienes(p.who, n)) {
          let t = t0;
          for (const to of p.path) {
            const from = at[who]!;
            const dur = Math.max(60, Math.round(Math.hypot(to.dx - from.dx, to.dy - from.dy) * per));
            eventos.push({ kind: "walk", who, at: t, dur, from, to, run: Boolean(p.run) });
            at[who] = to;
            t += dur;
          }
          longest = Math.max(longest, t - t0);
        }
        return longest;
      }
      case "together":
        return Math.max(0, ...p.steps.map((s) => run(s, t0)));
      case "seq": {
        let t = t0;
        for (const s of p.steps) t += run(s, t);
        return t - t0;
      }
    }
  };
  let t = 0;
  for (const p of pasos) t += run(p, t);
  return { ms: Math.max(1, t), eventos, bailarines: n };
}

/** Dónde está un bailarín (corrido desde su puesto) a `t` ms de empezada la frase, y si va caminando. */
export function frasePose(prog: FraseProgramada, who: number, t: number): { dx: number; dy: number; walking: boolean; run: boolean; toward: FraseLugar | null } {
  let pos: FraseLugar = { dx: 0, dy: 0 };
  for (const e of prog.eventos) {
    if (e.kind !== "walk" || e.who !== who || e.at > t) continue;
    if (t < e.at + e.dur) {
      const k = (t - e.at) / e.dur;
      return { dx: e.from.dx + (e.to.dx - e.from.dx) * k, dy: e.from.dy + (e.to.dy - e.from.dy) * k, walking: true, run: e.run, toward: e.to };
    }
    pos = e.to;
  }
  return { ...pos, walking: false, run: false, toward: null };
}

/** Las acciones que empiezan entre `from` (sin contar) y `to` (contando), para dispararlas una vez. */
export function fraseAcciones(prog: FraseProgramada, from: number, to: number): Extract<FraseEvento, { kind: "act" }>[] {
  return prog.eventos.filter((e): e is Extract<FraseEvento, { kind: "act" }> => e.kind === "act" && e.at > from && e.at <= to);
}

// ---------- Sumarse a la comparsa ----------

export type JoinError = "off" | "noDesfile" | "far" | "already" | "busy";
export type JoinResult = { ok: true; joined: boolean } | { ok: false; error: JoinError };

export const JOIN_ERROR_TEXT: Record<JoinError, string> = {
  off: "La comparsa sale solo en el Carnaval.",
  noDesfile: "Ahora no pasa el desfile. El Desfile Magno sale una vez por Carnaval, a las 10:00 del reloj de la cabaña.",
  far: "Arrímate a la vereda, donde va pasando el desfile, para sumarte.",
  already: "Ya vas en la comparsa.",
  busy: "Ahora no puedes sumarte: termina primero lo que estás haciendo.",
};

// ---------- Maicena y serpentinas ----------

export const LanzarMessage = z.object({ to: z.string().min(1).max(64) });
export const TalcoPrefMessage = z.object({ off: z.boolean() });

export type LanzarError = "off" | "nothing" | "far" | "self" | "dnd" | "noTalco" | "busy";
export type LanzarResult = { ok: true; kind: Lanzable; to: string; name: string } | { ok: false; error: LanzarError; name?: string };

export const LANZAR_ERROR_TEXT: Record<LanzarError, string> = {
  off: "La maicena y las serpentinas son del Carnaval.",
  nothing: "Lleva la maicena o las serpentinas en la mano.",
  far: "Arrímate a alguien para echarle.",
  self: "A ti mismo no.",
  dnd: "Está en «No molestar»: a esa persona no se le echa nada.",
  noTalco: "Esa persona prefiere no recibir maicena ni serpentinas.",
  busy: "Un momentico…",
};

/** Servidor → los del nivel: `from` le echó `kind` a `to` (sessionIds). */
export interface LanzadoEvent {
  from: string;
  to: string;
  kind: Lanzable;
}

export { CARNAVAL_LANZABLES };

// ---------- El concurso de disfraces ----------

export const VotarMessage = z.object({ userId: z.string().min(1).max(64) });

export type ConcursoError = "off" | "closed" | "full" | "self" | "voted" | "unknown" | "busy";
export type ConcursoResult = { ok: true; kind: "postulado" | "votado"; name?: string } | { ok: false; error: ConcursoError };

export const CONCURSO_ERROR_TEXT: Record<ConcursoError, string> = {
  off: "El concurso es solo en el Carnaval.",
  closed: "El concurso ya cerró: a las 18:00 se premia.",
  full: "Ya no caben más postulados.",
  self: "No puedes votar por ti.",
  voted: "Ya votaste en este carnaval.",
  unknown: "Esa persona no está postulada.",
  busy: "Un momentico…",
};

export interface Candidato {
  userId: string;
  votos: number;
  /** Cuándo se postuló (el empate lo gana quien se postuló primero). */
  at: number;
}

/** Quien gana el concurso: el más votado (con al menos un voto); si empatan, quien se postuló primero. */
export function ganadorDelConcurso(cands: readonly Candidato[]): Candidato | null {
  let best: Candidato | null = null;
  for (const c of cands) if (c.votos > 0 && (!best || c.votos > best.votos || (c.votos === best.votos && c.at < best.at))) best = c;
  return best;
}

/** ¿Sigue abierto el concurso a ese minuto del día del juego? */
export const concursoAbierto = (minuteOfDay: number) => minuteOfDay < CARNAVAL.concursoCierre * 60;

/** Clave de `UserStat` de los desfiles bailados en un año del juego (los que pagan puntos). */
export const desfilesStatKey = (año: number) => `festival:${CARNAVAL.id}:${año}:desfiles`;

// ---------- La tienda ----------

export interface CarnavalShopItem {
  id: string;
  name: string;
  price: number;
  gives: number;
}

export const CARNAVAL_SHOP = [
  { id: "maicena", name: "Bolsita de maicena", price: 6, gives: 3 },
  { id: "serpentinas", name: "Serpentinas", price: 6, gives: 3 },
  { id: "antifaz-carnaval", name: "Antifaz de carnaval", price: 30, gives: 1 },
  { id: "mascara-condor", name: "Máscara de cóndor", price: 45, gives: 1 },
  { id: "mascara-sol", name: "Máscara del sol", price: 45, gives: 1 },
] as const satisfies readonly CarnavalShopItem[];

export type CarnavalShopId = (typeof CARNAVAL_SHOP)[number]["id"];
export const carnavalShopItem = (id: string): CarnavalShopItem | undefined => CARNAVAL_SHOP.find((i) => i.id === id);
/** Las máscaras son de a una (de recuerdo). */
export const isCarnavalSouvenir = (id: string) => !(CARNAVAL_LANZABLES as readonly string[]).includes(id);
export const carnavalRefId = (id: string) => `festival:${CARNAVAL.id}:${id}`;

export const CarnavalBuyMessage = z.object({ item: z.enum(CARNAVAL_SHOP.map((i) => i.id) as [CarnavalShopId, ...CarnavalShopId[]]) });

export type CarnavalBuyError = "off" | "far" | "funds" | "full" | "stack" | "owned" | "busy" | "failed";
export type CarnavalBuyResult = { ok: true; item: string; balance: number } | { ok: false; item: string; error: CarnavalBuyError };

export const CARNAVAL_BUY_ERROR_TEXT: Record<CarnavalBuyError, string> = {
  off: "El puesto abre solo en el Carnaval.",
  far: "Arrímate al puesto del carnaval.",
  funds: "No te alcanzan los puntos.",
  full: "La mochila está llena.",
  stack: "Ya llevas muchos de esos.",
  owned: "Esa máscara ya es tuya.",
  busy: "Un momentico…",
  failed: "No se pudo comprar. Intenta de nuevo.",
};

// ---------- Las cinemáticas ----------

export const CARNAVAL_CINE = {
  salida: "carnaval-desfile-salida",
  sumarse: "carnaval-sumarse",
  final: "carnaval-final",
  premiacion: "carnaval-premiacion",
} as const;

/** Las cinemáticas del Carnaval (se suman al catálogo). */
export const CARNAVAL_CINEMATICAS: readonly CineDef[] = [
  {
    // Sale el desfile: Gloria y Aurora llegan corriendo a avisar, bailan y señalan la calle.
    id: CARNAVAL_CINE.salida,
    kind: "momento",
    steps: [
      { op: "spawn", id: "gloria", like: "gloria", at: { dx: -5, dy: -1 }, facing: "right" },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 5, dy: -1 }, facing: "left" },
      { op: "sound", sound: "tambor" },
      { op: "together", steps: [{ op: "walk", who: "gloria", run: true, path: [{ dx: -3, dy: 0 }, { dx: -1, dy: 1 }] }, { op: "walk", who: "aurora", run: true, path: [{ dx: 3, dy: 0 }, { dx: 1, dy: 1 }] }] },
      { op: "together", steps: [{ op: "face", who: "gloria", toward: "yo" }, { op: "face", who: "aurora", toward: "yo" }] },
      {
        op: "together",
        steps: [
          { op: "title", text: "¡Sale el desfile!", sub: "Por la calle del Megabús, de oeste a este", ms: 2600 },
          { op: "act", who: "gloria", action: "bailar" },
          { op: "act", who: "aurora", action: "girar" },
          { op: "fx", fx: "confeti", who: "yo" },
        ],
      },
      { op: "say", who: "gloria", text: "¡A la vereda, que ya vienen las carrozas! Don Evelio va de abanderado.", ms: 3000 },
      { op: "together", steps: [{ op: "act", who: "gloria", action: "saludar" }, { op: "act", who: "aurora", action: "saludar" }] },
      { op: "together", steps: [{ op: "walk", who: "gloria", path: [{ dx: -2, dy: 3 }, { dx: -6, dy: 4 }] }, { op: "walk", who: "aurora", path: [{ dx: 2, dy: 3 }, { dx: 6, dy: 4 }] }] },
      { op: "despawn", id: "gloria" },
      { op: "despawn", id: "aurora" },
    ],
  },
  {
    // Quien se suma: Gloria le da la bienvenida a la comparsa, bailan juntos y confeti.
    id: CARNAVAL_CINE.sumarse,
    kind: "momento",
    steps: [
      { op: "spawn", id: "gloria", like: "gloria", at: { near: "yo", dx: -2, dy: -2 }, facing: "right" },
      { op: "walk", who: "gloria", run: true, to: { near: "yo", dx: -1, dy: -1 } },
      { op: "face", who: "gloria", toward: "yo" },
      { op: "sound", sound: "tambor" },
      {
        op: "together",
        steps: [
          { op: "title", text: "¡A la comparsa!", sub: "Baila detrás del Megabús de la alegría", ms: 2400 },
          { op: "act", who: "gloria", action: "bailar" },
          { op: "act", who: "yo", action: "bailar" },
          { op: "fx", fx: "confeti", who: "yo" },
        ],
      },
      { op: "together", steps: [{ op: "act", who: "gloria", action: "girar" }, { op: "act", who: "yo", action: "girar" }] },
      { op: "bubble", who: "gloria", text: "¡Eso es! Así se goza el carnaval." },
      { op: "walk", who: "gloria", to: { near: "yo", dx: -5, dy: -3 } },
      { op: "despawn", id: "gloria" },
    ],
  },
  {
    // Al final del recorrido, para los que bailaron: Evelio y Aurora celebran con ellos.
    id: CARNAVAL_CINE.final,
    kind: "momento",
    steps: [
      { op: "spawn", id: "evelio", like: "evelio", at: { dx: -4, dy: -1 }, facing: "right" },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 4, dy: -1 }, facing: "left" },
      { op: "together", steps: [{ op: "walk", who: "evelio", run: true, to: { dx: -1, dy: -1 } }, { op: "walk", who: "aurora", run: true, to: { dx: 1, dy: -1 } }] },
      { op: "sound", sound: "aplausos" },
      {
        op: "together",
        steps: [
          { op: "title", text: "¡Qué comparsa!", sub: "{puntos}", ms: 2600 },
          { op: "fx", fx: "confeti", who: "yo" },
          { op: "act", who: "evelio", action: "saltar" },
          { op: "act", who: "aurora", action: "celebrar" },
          { op: "act", who: "yo", action: "celebrar" },
        ],
      },
      { op: "together", steps: [{ op: "act", who: "evelio", action: "bailar" }, { op: "act", who: "aurora", action: "bailar" }, { op: "act", who: "yo", action: "bailar" }] },
      { op: "say", who: "evelio", text: "¡Ananay! Así se baila en Pasto. El año que viene, usted carga la bandera.", ms: 3000 },
      { op: "together", steps: [{ op: "walk", who: "evelio", to: { dx: -6, dy: -3 } }, { op: "walk", who: "aurora", to: { dx: 6, dy: -3 } }] },
      { op: "despawn", id: "evelio" },
      { op: "despawn", id: "aurora" },
    ],
  },
  {
    // La premiación del concurso de disfraces: para todos, con el nombre de quien ganó.
    id: CARNAVAL_CINE.premiacion,
    kind: "momento",
    steps: [
      { op: "spawn", id: "gloria", like: "gloria", at: { dx: -2, dy: -2 }, facing: "down" },
      { op: "spawn", id: "aurora", like: "aurora", at: { dx: 2, dy: -2 }, facing: "down" },
      { op: "spawn", id: "evelio", like: "evelio", at: { dx: 0, dy: -3 }, facing: "down" },
      { op: "sound", sound: "murga" },
      { op: "together", steps: [{ op: "act", who: "gloria", action: "saludar" }, { op: "act", who: "aurora", action: "saludar" }, { op: "act", who: "evelio", action: "asentir" }] },
      { op: "flash", color: "oro", ms: 400 },
      {
        op: "together",
        steps: [
          { op: "title", text: "{nombre}", sub: "¡Rey o reina del Carnaval!", ms: 3200 },
          { op: "fx", fx: "confeti", who: "evelio" },
          { op: "act", who: "gloria", action: "celebrar" },
          { op: "act", who: "aurora", action: "celebrar" },
          { op: "act", who: "evelio", action: "saltar" },
        ],
      },
      { op: "sound", sound: "aplausos" },
      { op: "say", who: "gloria", text: "Ganó la pinta de {nombre}, con {votos}. ¡Un aplauso para la comparsa!", ms: 3200 },
      { op: "together", steps: [{ op: "act", who: "gloria", action: "bailar" }, { op: "act", who: "aurora", action: "girar" }, { op: "act", who: "evelio", action: "bailar" }] },
      { op: "despawn", id: "gloria" },
      { op: "despawn", id: "aurora" },
      { op: "despawn", id: "evelio" },
    ],
  },
];
