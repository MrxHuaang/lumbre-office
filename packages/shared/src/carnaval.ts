// El Carnaval de Negros y Blancos jugable (VIR-160, docs/plan-carnaval.md): el festival del día 18 del
// verano, a la manera del de Pasto. Aquí las reglas puras: cuándo sale el desfile por la calle del Megabús,
// las carrozas y sus comparsas (con la coreografía que repiten en cada parada), la maicena y las
// serpentinas (con F sobre alguien de al lado), el concurso de disfraces, la tienda y las cinemáticas.
// Dónde va cada carroza en la calle lo calcula packages/map (carnaval.ts); lo decide la sala
// (apps/server/src/rooms/carnaval.ts).
//
// Respeto cultural (decisión del plan): el blanco y negro va en trajes, máscaras, banderines, confeti y
// carrozas; nunca se oscurece la piel de nadie. La maicena es el talco del Día de Blancos: cara empolvada un
// rato, y nunca a quien está en "No molestar" o pidió no recibirla. Los grupos son ficticios.
import { z } from "zod";
import { CARNAVAL_LANZABLES, type Lanzable } from "./carnaval-objetos";
import type { CineAction, CineDef } from "./cinematicas";
import type { Look } from "./look";

export const CARNAVAL = {
  id: "carnaval",
  /** Horas del juego en que sale el desfile. */
  desfileHoras: [11, 15, 19],
  /** Minutos del juego después de la hora en que todavía puede salir (si el bus estaba en la calle, se espera). */
  ventanaMin: 30,
  /** Velocidad del desfile (tiles por segundo real). */
  velocidad: 2.2,
  /** Lo que dura cada parada (ms reales): las comparsas repiten su frase. */
  paradaMs: 16_000,
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
  /** Puntos (LEISURE) por bailar un desfile entero, y en cuántos desfiles por festival se pagan. */
  puntosDesfile: 15,
  desfilesConPuntos: 2,
  /** Hora del juego en que cierra el concurso de disfraces (antes del cierre del festival, a las 22). */
  concursoCierre: 21,
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

export const CARROZA_IDS = ["castaneda", "condor", "galeras", "reloj", "tinto", "megabus"] as const;
export type CarrozaId = (typeof CARROZA_IDS)[number];

/** Lo que dice el plan y todavía no está dibujado (queda anotado para otra entrega). */
export const CARROZAS_PENDIENTES = ["El Tablero vivo", "La Luna en el lago", "El Páramo", "La Minga de la cosecha"] as const;

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
  | { op: "together"; steps: readonly FrasePaso[] };

export interface Comparsa {
  id: CarrozaId;
  /** La carroza. */
  nombre: string;
  /** El grupo (ficticio) que baila con ella. */
  grupo: string;
  /** El color de acento de la carroza (todo lo demás es blanco y negro). */
  acento: string;
  /** Lo que ocupa en la calle (tiles a lo largo, la carroza y su comparsa detrás). */
  largo: number;
  /** La pinta de cada bailarín (blanco y negro en la ropa; la piel, la de cada quien). */
  bailarines: readonly Look[];
  /** Lo que repite en cada parada (en bucle). */
  frase: readonly FrasePaso[];
  /** La pieza que suena a su paso (ver `PIEZAS`). */
  pieza: PiezaId;
}

/** Las piezas de la música andina (sintetizadas en el navegador; ninguna grabación). */
export const PIEZAS = ["guanena", "sanjuanito", "pasacalle", "albazo"] as const;
export type PiezaId = (typeof PIEZAS)[number];

const BLANCO = "#f3f1ec";
const NEGRO = "#24212e";
/** Pieles de la gente de la cabaña: la que es, sin pintar. */
const PIELES = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#d9a066"] as const;

/** Un bailarín de comparsa: ropa blanca y negra con el color de acento de su carroza. */
const comparsero = (i: number, acento: string, o: Partial<Look> = {}): Look => ({
  skin: PIELES[i % PIELES.length]!,
  hair: ["#2b1b12", "#4a2a1a", "#1d1622", "#6e4a2a"][i % 4]!,
  shirt: i % 2 ? NEGRO : BLANCO,
  pants: i % 2 ? BLANCO : NEGRO,
  accent: acento,
  top2: acento,
  hairStyle: (["bun", "short", "braids", "curly"] as const)[i % 4]!,
  accessories: [],
  top: "longsleeve",
  bottom: i % 2 ? "pants" : "long-skirt",
  shoes: "boots",
  shoeColor: NEGRO,
  face: "carnival-mask",
  ...o,
});

const todos = (action: CineAction): FrasePaso => ({ op: "act", who: "todos", action });

export const COMPARSAS: readonly Comparsa[] = [
  {
    id: "castaneda",
    nombre: "La Familia Castañeda llega",
    grupo: "Comparsa Familia Castañeda",
    acento: "#9a6a40",
    largo: 7,
    pieza: "sanjuanito",
    // La abuela (b0) con sombrilla y los nietos, con ropa "de 1928".
    bailarines: [
      comparsero(0, "#9a6a40", { hairStyle: "bun", hair: "#d8d8de", outfit: "gown", head: "straw-hat", face: "round-glasses" }),
      comparsero(1, "#9a6a40", { head: "top-hat", neck: "bowtie", face: "none" }),
      comparsero(2, "#9a6a40", { outfit: "vest", face: "none" }),
      comparsero(3, "#9a6a40", { head: "straw-hat", face: "none" }),
    ],
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
    bailarines: [0, 1, 2, 3].map((i) => comparsero(i, "#dcae3f", { back: "wings" })),
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
    bailarines: [0, 1, 2, 3].map((i) => comparsero(i, "#ee7a22", { head: i % 2 ? "bucket-hat" : "beanie" })),
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
    id: "reloj",
    nombre: "El Reloj de E.",
    grupo: "Los Engranajes de la vereda",
    acento: "#b98424",
    largo: 7,
    pieza: "sanjuanito",
    bailarines: [0, 1, 2, 3].map((i) => comparsero(i, "#b98424", { head: "top-hat", neck: "bowtie" })),
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
    id: "tinto",
    nombre: "El tinto de Doña Aurora",
    grupo: "Las meseras de la cafetería",
    acento: "#7a4a2a",
    largo: 7,
    pieza: "sanjuanito",
    bailarines: [0, 1, 2, 3].map((i) => comparsero(i, "#7a4a2a", { outfit: "apron", face: "none", head: "bandana" })),
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
    id: "megabus",
    nombre: "El Megabús de la alegría",
    grupo: "Comparsa de la cabaña",
    acento: "#a6d23a",
    largo: 9,
    pieza: "pasacalle",
    // Dos de la murga van delante de la gente de la cabaña, marcando el paso.
    bailarines: [0, 1].map((i) => comparsero(i + 2, "#a6d23a", { head: "party-hat" })),
    frase: [todos("bailar"), todos("girar"), todos("saltar"), todos("celebrar")],
  },
];

export const comparsaById = (id: string) => COMPARSAS.find((c) => c.id === id);

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
  condor: "Miren ese cóndor: ya nació blanco y negro, no hubo que pintarlo.",
  galeras: "¡El Galeras fumando! Tranquilos, que es humo de algodón.",
  reloj: "El reloj de E. … trece campanadas, ¿sí las oyen?",
  tinto: "Un tinto de Doña Aurora pa'l frío. ¡Achichay!",
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
  noDesfile: "Ahora no pasa el desfile. Sale a las 11:00, 15:00 y 19:00 del reloj de la cabaña.",
  far: "Arrímate al Megabús de la alegría, en la vereda, para sumarte.",
  already: "Ya vas en la comparsa.",
  busy: "Ahora no puedes sumarte (suéltate de lo que estás haciendo).",
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
  closed: "El concurso ya cerró: a las 21:00 se premia.",
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
      { op: "bubble", who: "gloria", text: "¡Eso, mijo! Quien lo vive es quien lo goza." },
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
      { op: "sound", sound: "albazo" },
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
