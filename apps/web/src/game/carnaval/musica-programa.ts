// La parte pura de la música del Carnaval (sin WebAudio, con tests): cómo se escribe una pieza, los rangos de
// cada instrumento y el programa de cada tramo (qué suena, cuándo, con qué instrumento y qué tan fuerte). El
// navegador pide el programa tramo por tramo mientras toca (musica.ts), así una pieza de tres minutos no se
// arma de una.
//
// Las notas se escriben en texto: "A4:2 D5 F5:2 E5 | ..." (la duración en corcheas, 1 si no se dice; "-" es
// silencio, "C5+E5" dos notas a la vez y "|" la barra de compás). Todo se mide en corcheas: el compás de
// 2/4 tiene 4 y los de 3/4 y 6/8 tienen 6 (lo que cambia entre esos dos es dónde caen los acentos).
import type { Conjunto, PiezaId } from "@hyvento/shared";

export type Metrica = "2/4" | "3/4" | "6/8";
export const CORCHEAS: Record<Metrica, number> = { "2/4": 4, "3/4": 6, "6/8": 6 };

export type Instrumento =
  // La murga.
  | "trompeta"
  | "saxo"
  | "trombon"
  | "tuba"
  | "acordeon"
  | "clarinete"
  | "flauta"
  // El colectivo andino.
  | "quena"
  | "zampona"
  | "rondador"
  | "requinto"
  | "bandola"
  | "violin"
  | "tiple"
  | "guitarra";
export type Golpe =
  | "bombo"
  | "redoblante"
  | "platillo"
  | "timbal"
  | "timbalBajo"
  | "guiro"
  | "guiroLargo"
  | "guasa"
  | "campana"
  | "tambora"
  | "caja"
  | "cencerro"
  | "shekere"
  | "maracas"
  | "chajchas";

/** Hasta dónde llega cada instrumento sin forzar (sonido real, en MIDI). */
export const RANGO: Record<Instrumento, readonly [number, number]> = {
  trompeta: [52, 84], // Mi3 a Do6
  saxo: [49, 80], // alto: Re bemol 3 a La bemol 5
  trombon: [40, 65], // Mi2 a Fa4
  tuba: [28, 58], // Mi1 a Si bemol 3
  acordeon: [53, 93], // la mano derecha
  clarinete: [50, 89], // en Si bemol: Re3 a Fa6 (sonido real)
  flauta: [60, 93], // traversa: Do4 a La6
  quena: [67, 88], // quena en Sol: Sol4 a Mi6
  zampona: [55, 88], // Sol3 a Mi6 (sikus grandes y chicos)
  rondador: [64, 88], // Mi4 a Mi6
  requinto: [59, 86], // el requinto colombiano: Si3 a Re6
  bandola: [55, 88], // la bandola andina: Sol3 a Mi6
  violin: [55, 93], // Sol3 a La6
  tiple: [52, 79], // los acordes del tiple (cuatro órdenes)
  guitarra: [40, 76], // Mi2 a Mi5
};

/** Lo que puede sonar en cada conjunto (los tests revisan que nadie se cuele). */
export const INSTRUMENTOS_DE: Record<Conjunto, readonly (Instrumento | Golpe)[]> = {
  murga: [
    "trompeta",
    "saxo",
    "trombon",
    "tuba",
    "acordeon",
    "clarinete",
    "flauta",
    "bombo",
    "redoblante",
    "platillo",
    "timbal",
    "timbalBajo",
    "guiro",
    "guiroLargo",
    "guasa",
    "campana",
    "tambora",
    "caja",
    "cencerro",
  ],
  colectivo: ["quena", "zampona", "rondador", "requinto", "bandola", "violin", "tiple", "guitarra", "bombo", "shekere", "maracas", "chajchas"],
};

/** Quién lleva la melodía en un tramo (y quién lo acompaña). */
export type Lider =
  // De la murga.
  | "trompeta" // la trompeta, con el saxo de segunda si hay segunda
  | "saxo" // el saxo, una octava abajo
  | "acordeon"
  | "bronces" // trompeta y saxo en terceras, con el acordeón doblando
  | "clarinete" // el clarinete, con el saxo de segunda
  | "flauta" // la flauta traversa, con el clarinete de segunda
  | "maderas" // flauta y clarinete a dos voces
  | "tutti" // bronces y maderas: la melodía arriba, la segunda abajo y el acordeón
  // Del colectivo.
  | "quena" // la quena, con la zampoña de segunda
  | "quenas" // dos quenas a dos voces (en cuartas o terceras, según `voces`)
  | "zampona"
  | "rondador" // el rondador: la melodía con su tercera, como suena de verdad
  | "todos" // quena, zampoña y rondador
  | "requinto" // el requinto punteado, con la bandola de segunda
  | "bandola" // la bandola (con trémolo en las notas largas), con el requinto de segunda
  | "violin"
  | "cuerdas"; // bandola y requinto a dos voces

/** Cuánta percusión: la de siempre, solo lo de fondo (bombo y sacudidores), la percusión sola o nada. */
export type Perc = "plena" | "liviana" | "sola" | "nada";

/** Dónde va la segunda voz: una tercera abajo (la de siempre), una sexta o una cuarta (como las quenas). */
export type Voces = "terceras" | "sextas" | "cuartas";

export interface Tema {
  notas: string;
  /** Un acorde por compás ("B7/Em": dos, el segundo a la mitad). */
  acordes: string;
}

export interface Tramo {
  /** El tema que suena, o null para el acompañamiento solo (con `compases` y `acorde`). */
  tema: string | null;
  compases?: number;
  acorde?: string;
  /** Un pedazo del tema (compases desde, hasta sin contar). */
  desde?: number;
  hasta?: number;
  lleva?: Lider;
  /** La segunda voz, armada sola con el acorde. */
  segunda?: boolean;
  /** Dónde va la segunda voz (terceras si no se dice). */
  voces?: Voces;
  /** Un contracanto: una línea lenta, abajo, que se mueve por las notas del acorde. */
  contra?: Instrumento;
  /** El colchón: el acorde sostenido, bajito, todo el compás. */
  colchon?: Instrumento;
  /** Lo que se calla en este tramo (para que las cuerdas entren de a una, por ejemplo). */
  sin?: readonly Instrumento[];
  /** Dinámica: el volumen al empezar y al terminar el tramo (crescendo o diminuendo). */
  din?: readonly [number, number];
  perc: Perc;
  /** Compases (del tramo) con corte: golpe de toda la banda, silencio y el repique que la vuelve a meter. */
  cortes?: readonly number[];
  /** El último compás es el final: un golpe largo de todos. */
  final?: boolean;
}

/** Un toque de percusión o de acompañamiento: dónde cae (corcheas) y qué tan fuerte. */
export type Toque = readonly [number, number];
/** Un golpe del rasgueo: dónde cae, qué tan fuerte y si la mano baja ("b") o sube ("s"). */
export type Rasgo = readonly [number, number, "b" | "s"];

/** De dónde sale una melodía tradicional (para el PR y la página de escucha). */
export interface Fuente {
  titulo: string;
  url: string;
  /** Qué dice la fuente (sin letra: solo de dónde viene y por qué es tradicional). */
  dice: string;
}

export interface Pieza {
  nombre: string;
  conjunto: Conjunto;
  /** false para las melodías tradicionales (las de dominio público). */
  original: boolean;
  /** Las fuentes de la melodía tradicional. */
  fuentes?: readonly Fuente[];
  /** Para la página de escucha: cómo suena. */
  nota: string;
  metrica: Metrica;
  /** Negras por minuto (en 6/8, negras con puntillo). */
  bpm: number;
  temas: Record<string, Tema>;
  forma: readonly Tramo[];
  /** La percusión de un compás (la "plena"). */
  perc: Partial<Record<Golpe, readonly Toque[]>>;
  /** Los acordes del acompañamiento (el acordeón o el rondador). */
  acomp: readonly Toque[];
  /** El bajo: la tuba en la murga y los bordones de la guitarra en el colectivo. */
  bajo?: readonly Toque[];
  /** El rasgueo del tiple (y de la guitarra, más suave) en el colectivo. */
  rasgueo?: readonly Rasgo[];
  /** El tramo desde el que tocan las cinemáticas. */
  extracto?: number;
}

/** Cuánto dura una corchea (s). */
export const corcheaS = (p: Pieza) => (p.metrica === "6/8" ? 20 : 30) / p.bpm;

// ---------- Notas y acordes ----------

const CLASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "A4" → 69 (MIDI); "Bb3", "C#5" también. */
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`nota rara: ${name}`);
  return CLASE[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Un acorde por su nombre ("Dm", "A7", "Bb"): sus notas, con la fundamental entre Mi3 y Re#4. */
export function acorde(nombre: string): number[] {
  const m = /^([A-G])(#|b)?(m|7)?$/.exec(nombre);
  if (!m) throw new Error(`acorde raro: ${nombre}`);
  let root = CLASE[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 48;
  while (root < 52) root += 12;
  while (root > 63) root -= 12;
  const iv = m[3] === "m" ? [0, 3, 7, 12] : m[3] === "7" ? [0, 4, 7, 10] : [0, 4, 7, 12];
  return iv.map((i) => root + i);
}

export interface NotaEscrita {
  /** En corcheas desde el comienzo del tema. */
  at: number;
  dur: number;
  /** Las notas (MIDI); vacío es silencio. */
  ms: number[];
}

/** Lee las notas de un tema y revisa que cada compás cierre. */
export function leerNotas(texto: string, compas: number): { notas: NotaEscrita[]; compases: number } {
  const notas: NotaEscrita[] = [];
  const barras = texto.split("|").map((b) => b.trim());
  let at = 0;
  barras.forEach((barra, k) => {
    const inicio = at;
    for (const tok of barra.split(/\s+/).filter(Boolean)) {
      const [n, d] = tok.split(":");
      const dur = d ? Number(d) : 1;
      notas.push({ at, dur, ms: n === "-" ? [] : n!.split("+").map(midi) });
      at += dur;
    }
    if (Math.abs(at - inicio - compas) > 1e-6) throw new Error(`el compás ${k + 1} no cierra (${at - inicio} de ${compas}): ${barra}`);
  });
  return { notas, compases: barras.length };
}

/** Los acordes de un tema, uno por compás (o dos). */
export const leerAcordes = (texto: string) => texto.split(/\s+/).filter(Boolean).map((a) => a.split("/").map(acorde));

/** Las distancias que se prueban para la segunda voz, en orden de preferencia. */
const PREFIERE: Record<Voces, readonly number[]> = {
  terceras: [3, 4, 5, 8, 9],
  sextas: [8, 9, 3, 4, 5],
  cuartas: [5, 3, 4, 8, 9],
};

/** La segunda voz: la nota del acorde que queda una tercera (o una sexta, o una cuarta) abajo. */
export function segundaDe(m: number, acordeNotas: readonly number[], voces: Voces = "terceras"): number | null {
  const clases = new Set(acordeNotas.map((n) => n % 12));
  for (const d of PREFIERE[voces]) if (clases.has((((m - d) % 12) + 12) % 12)) return m - d;
  return null;
}

/** Dos notas vecinas del acorde para el rondador, entre Sol4 y Sol5. */
export function parRondador(acordeNotas: readonly number[]): number[] {
  const t = [...new Set(acordeNotas.map((n) => (n % 12) + 60 + ((n % 12) + 60 < 67 ? 12 : 0)))].sort((a, b) => a - b);
  return t.slice(0, 2);
}

/** Las `n` notas más graves del acorde desde `lo` (la posición de un rasgueo o de un colchón). */
export function posicion(acordeNotas: readonly number[], lo: number, n: number): number[] {
  const clases = new Set(acordeNotas.map((x) => x % 12));
  const out: number[] = [];
  for (let m = lo; out.length < n && m < lo + 36; m++) if (clases.has(m % 12)) out.push(m);
  return out;
}

/**
 * Corre toda la frase por octavas para que quepa en el instrumento (y dobla lo que todavía se salga). Con
 * `fija`, no busca otra octava: solo dobla lo que se sale (la segunda voz, que tiene que quedar pegada a la
 * melodía).
 */
export function acomodar(ms: number[], inst: Instrumento, preferida = 0, fija = false): (m: number) => number {
  const [lo, hi] = RANGO[inst];
  const min = Math.min(...ms);
  const max = Math.max(...ms);
  let shift = preferida;
  if (!fija && (max + shift > hi || min + shift < lo)) shift = [0, -12, 12, -24, 24].find((s) => max + s <= hi && min + s >= lo) ?? 0;
  return (m) => {
    let x = m + shift;
    while (x > hi) x -= 12;
    while (x < lo) x += 12;
    return x;
  };
}

/** El acento de cada corchea según la métrica: el 1 manda, y en 6/8 también el 4. */
export function acento(metrica: Metrica, x: number): number {
  const r = x % CORCHEAS[metrica];
  if (r === 0) return 1.12;
  if (metrica === "6/8") return r === 3 ? 1.05 : 0.92;
  if (metrica === "3/4") return r === 2 || r === 4 ? 0.98 : 0.92;
  return r === 2 ? 1.04 : 0.93;
}

/**
 * La humanización (como toca una persona): un corrimiento chiquito de tiempo (s) y de volumen (factor) para
 * cada evento, siempre el mismo para la misma semilla (así dos navegadores oyen lo mismo).
 */
export function humano(semilla: number): { dt: number; dv: number } {
  let h = Math.imul(semilla ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  const a = (h & 0xffff) / 0xffff;
  const b = ((h >>> 16) & 0xffff) / 0xffff;
  return { dt: (a - 0.5) * 0.018, dv: 1 + (b - 0.5) * 0.14 };
}

// ---------- El programa ----------

export interface Evento {
  /** En corcheas desde el comienzo del tramo. */
  at: number;
  dur: number;
  inst: Instrumento | Golpe;
  /** Las notas (MIDI) de un instrumento con altura. */
  ms?: number[];
  vol: number;
  /** Un rasgueo: la mano baja (1) o sube (-1). */
  rasgo?: 1 | -1;
}

/** Dónde queda el silencio de un corte dentro del compás (corcheas): después del golpe y antes del repique. */
export function ventanaCorte(compas: number): { golpe: number; repique: number } {
  return { golpe: 1, repique: compas - (compas === 6 ? 2 : 1) };
}

export interface TramoListo {
  compases: number;
  /** Corcheas del tramo. */
  largo: number;
  /** Corcheas desde el comienzo de la pieza. */
  inicio: number;
}

/** Los tramos de la pieza con su largo y dónde empieza cada uno. */
export function tramosDe(p: Pieza): TramoListo[] {
  const compas = CORCHEAS[p.metrica];
  let inicio = 0;
  return p.forma.map((t) => {
    let compases = t.compases ?? 0;
    if (t.tema) {
      const total = leerNotas(p.temas[t.tema]!.notas, compas).compases;
      compases = (t.hasta ?? total) - (t.desde ?? 0);
    }
    const largo = compases * compas;
    const r = { compases, largo, inicio };
    inicio += largo;
    return r;
  });
}

/** Cuánto dura la pieza (s). */
export function duracionS(p: Pieza): number {
  const ts = tramosDe(p);
  const last = ts.at(-1)!;
  return (last.inicio + last.largo) * corcheaS(p);
}

const VOL: Record<Instrumento | Golpe, number> = {
  trompeta: 0.1,
  saxo: 0.07,
  trombon: 0.08,
  tuba: 0.13,
  acordeon: 0.05,
  clarinete: 0.08,
  flauta: 0.11,
  quena: 0.16,
  zampona: 0.09,
  rondador: 0.06,
  requinto: 0.2,
  bandola: 0.18,
  violin: 0.06,
  tiple: 0.07,
  guitarra: 0.12,
  bombo: 0.5,
  redoblante: 0.2,
  platillo: 0.08,
  timbal: 0.17,
  timbalBajo: 0.17,
  guiro: 0.06,
  guiroLargo: 0.06,
  guasa: 0.08,
  campana: 0.05,
  tambora: 0.32,
  caja: 0.16,
  cencerro: 0.04,
  shekere: 0.08,
  maracas: 0.07,
  chajchas: 0.07,
};

/** Lo que sigue sonando con la percusión liviana: el bombo y lo que se sacude o se raspa. */
const SACUDIDORES: readonly Golpe[] = ["guasa", "guiro", "guiroLargo", "shekere", "maracas", "chajchas"];

/** Todo lo que suena en el tramo `i` de la pieza, ordenado. */
export function programaTramo(p: Pieza, i: number): Evento[] {
  const t = p.forma[i]!;
  const compas = CORCHEAS[p.metrica];
  const { compases, largo } = tramosDe(p)[i]!;
  const murga = p.conjunto === "murga";
  const ev: Evento[] = [];
  const cortes = new Set(t.cortes ?? []);
  const { golpe, repique } = ventanaCorte(compas);
  const finalK = t.final ? compases - 1 : -1;
  const callado = new Set(t.sin ?? []);
  const [din0, din1] = t.din ?? [1, 1];
  /** El volumen de la dinámica del tramo en la corchea `at`. */
  const din = (at: number) => din0 + ((din1 - din0) * at) / Math.max(1, largo);
  const push = (e: Evento) => {
    if (e.ms && callado.has(e.inst as Instrumento)) return;
    ev.push({ ...e, vol: e.vol * din(e.at) });
  };

  // Los acordes de cada compás del tramo.
  const tema = t.tema ? p.temas[t.tema]! : null;
  const desde = t.desde ?? 0;
  const acordesTema = tema ? leerAcordes(tema.acordes) : [];
  const acordeEn = (k: number, x = 0): number[] => {
    if (!tema) return acorde(t.acorde ?? "C");
    const a = acordesTema[(desde + k) % acordesTema.length]!;
    return a.length > 1 && x >= compas / 2 ? a[1]! : a[0]!;
  };

  /** Lo que pasa en un compás de corte o del final: nada suena entre el golpe y el repique (o hasta el final). */
  const recortar = (at: number, dur: number): number | null => {
    const k = Math.floor(at / compas);
    const x = at - k * compas;
    if (cortes.has(k) || k === finalK) {
      const fin = k === finalK ? compas : repique;
      if (x >= golpe && x < fin) return null;
      if (x < golpe) return k === finalK ? Math.max(dur, 3) : Math.min(dur, golpe - x);
    }
    // Una nota larga que se mete en el corte siguiente se corta en el golpe.
    const kFin = Math.floor((at + dur - 1e-6) / compas);
    for (let kk = k + 1; kk <= kFin; kk++) if (cortes.has(kk) || kk === finalK) return Math.min(dur, kk * compas + golpe - at);
    return dur;
  };

  // La melodía y sus voces.
  const melodia = !!tema && t.perc !== "sola";
  if (tema && melodia) {
    const { notas } = leerNotas(tema.notas, compas);
    const from = desde * compas;
    const to = from + largo;
    const enTramo = notas.filter((n) => n.at >= from && n.at < to && n.ms.length).map((n) => ({ ...n, at: n.at - from }));
    const todas = enTramo.flatMap((n) => n.ms);
    const lleva = t.lleva ?? (murga ? "trompeta" : "quena");
    const voces = t.voces ?? "terceras";
    const voz = (inst: Instrumento, vol: number, dos: boolean, preferida = 0) => {
      const fit = acomodar(todas, inst, preferida);
      for (const n of enTramo) {
        const dur = recortar(n.at, n.dur);
        if (dur === null) continue;
        const ms = n.ms.map(fit);
        if (dos) {
          const s = segundaDe(n.ms[0]!, acordeEn(Math.floor(n.at / compas), n.at % compas));
          if (s !== null) ms.push(fit(s));
        }
        push({ at: n.at, dur, inst, ms, vol: VOL[inst] * vol * acento(p.metrica, n.at) });
      }
    };
    const segunda = (inst: Instrumento, vol: number, preferida = 0) => {
      const segs = enTramo.map((n) => segundaDe(n.ms[0]!, acordeEn(Math.floor(n.at / compas), n.at % compas), voces));
      const fit = acomodar(
        segs.filter((s): s is number => s !== null),
        inst,
        preferida,
        true,
      );
      enTramo.forEach((n, j) => {
        const dur = recortar(n.at, n.dur);
        const s = segs[j];
        if (dur !== null && s != null) push({ at: n.at, dur, inst, ms: [fit(s)], vol: VOL[inst] * vol * acento(p.metrica, n.at) });
      });
    };
    switch (lleva) {
      case "trompeta":
        voz("trompeta", 1, false);
        if (t.segunda) segunda("saxo", 1);
        break;
      case "saxo":
        voz("saxo", 1.3, false, -12);
        break;
      case "acordeon":
        voz("acordeon", 1.6, false);
        break;
      case "bronces":
        voz("trompeta", 1.1, false);
        segunda("saxo", 1.1);
        voz("acordeon", 0.7, false);
        break;
      case "clarinete":
        voz("clarinete", 1.2, false);
        if (t.segunda) segunda("saxo", 0.9);
        break;
      case "flauta":
        voz("flauta", 1, false);
        if (t.segunda) segunda("clarinete", 1);
        break;
      case "maderas":
        voz("flauta", 1, false);
        segunda("clarinete", 1.1);
        break;
      case "tutti":
        voz("trompeta", 1.05, false);
        segunda("saxo", 1);
        voz("flauta", 0.55, false, 12);
        segunda("clarinete", 0.7);
        voz("acordeon", 0.5, false);
        break;
      case "quena":
        voz("quena", 1, false);
        if (t.segunda) segunda("zampona", 0.8);
        break;
      case "quenas":
        voz("quena", 1, false);
        segunda("quena", 0.75);
        break;
      case "zampona":
        voz("zampona", 1.4, false);
        break;
      case "rondador":
        voz("rondador", 1.4, true);
        break;
      case "todos":
        voz("quena", 1, false);
        segunda("zampona", 0.8);
        voz("rondador", 0.6, true);
        break;
      case "requinto":
        voz("requinto", 1, false);
        if (t.segunda) segunda("bandola", 0.75);
        break;
      case "bandola":
        voz("bandola", 1, false);
        if (t.segunda) segunda("requinto", 0.75);
        break;
      case "violin":
        voz("violin", 1.2, false);
        if (t.segunda) segunda("violin", 0.8);
        break;
      case "cuerdas":
        voz("bandola", 1, false);
        segunda("requinto", 0.8);
        break;
    }

    // El contracanto: dos notas por compás (una por mitad), de las del acorde, cerca de la anterior y como una
    // sexta debajo de la melodía: se mueve poco y por grados, como lo haría un trombón o un violín.
    if (t.contra) {
      const centro = todas.reduce((s, m) => s + m, 0) / Math.max(1, todas.length) - 9;
      const linea: { at: number; m: number }[] = [];
      let prev = Math.round(centro);
      const mitad = compas / 2;
      for (let k = 0; k < compases; k++) {
        for (const x of [0, mitad]) {
          const a = acordeEn(k, x);
          const clases = new Set(a.map((n) => n % 12));
          const cand: number[] = [];
          for (let m = Math.round(centro) - 7; m <= Math.round(centro) + 7; m++) if (clases.has(m % 12)) cand.push(m);
          const otras = cand.filter((m) => m !== prev);
          const lista = otras.length ? otras : cand;
          const m = lista.reduce((best, c) => (Math.abs(c - prev) < Math.abs(best - prev) ? c : best), lista[0]!);
          linea.push({ at: k * compas + x, m });
          prev = m;
        }
      }
      const fit = acomodar(
        linea.map((l) => l.m),
        t.contra,
      );
      for (const l of linea) {
        const dur = recortar(l.at, mitad);
        if (dur !== null) push({ at: l.at, dur, inst: t.contra, ms: [fit(l.m)], vol: VOL[t.contra] * 0.75 * acento(p.metrica, l.at) });
      }
    }
  }

  // El acompañamiento compás por compás: los acordes (acordeón o rondador), el bajo, el colchón y las cuerdas.
  const conAcomp = t.perc !== "sola";
  const lleva = t.lleva ?? (murga ? "trompeta" : "quena");
  const rondadorAcomp = !murga && lleva !== "rondador" && lleva !== "todos" && t.perc !== "nada";
  for (let k = 0; k < compases && conAcomp; k++) {
    const t0 = k * compas;
    const corte = cortes.has(k) || k === finalK;
    const durCorte = k === finalK ? 4 : golpe;

    // Los acordes: el acordeón en la murga (y el trombón en las partes plenas) o el rondador en el colectivo.
    if (t.perc !== "nada" && (murga || rondadorAcomp)) {
      for (const [x, v] of corte ? ([[0, 1]] as const) : p.acomp) {
        const a = acordeEn(k, x);
        const dur = corte ? durCorte : 0.8;
        if (murga) {
          push({ at: t0 + x, dur, inst: "acordeon", ms: a.slice(1), vol: VOL.acordeon * v * 0.8 });
          if (t.perc === "plena") {
            const fit = acomodar(a.slice(0, 2), "trombon", -12);
            push({ at: t0 + x, dur, inst: "trombon", ms: a.slice(0, 2).map(fit), vol: VOL.trombon * v * 0.55 });
          }
        } else push({ at: t0 + x, dur, inst: "rondador", ms: parRondador(a), vol: VOL.rondador * v * 0.8 });
      }
    }

    // El bajo: la tuba en la murga y los bordones de la guitarra en el colectivo (la fundamental y la quinta).
    if (p.bajo && t.perc !== "nada") {
      const inst: Instrumento = murga ? "tuba" : "guitarra";
      const toques = corte ? ([[0, 1]] as const) : p.bajo;
      toques.forEach(([x, v], j) => {
        const a = acordeEn(k, x);
        const nota = j % 2 === 0 ? a[0]! : a[2]!;
        const fit = acomodar([nota], inst, murga ? -24 : -12);
        push({ at: t0 + x, dur: corte ? durCorte : murga ? 1.6 : 1.2, inst, ms: [fit(nota)], vol: VOL[inst] * v });
      });
    }

    // El rasgueo del tiple y, más suave, de la guitarra.
    if (p.rasgueo && !murga) {
      if (t.perc === "nada") {
        // Sin percusión, la guitarra arpegia el acorde de a una nota por corchea (las introducciones).
        const notas = posicion(acordeEn(k, 0), 52, 4);
        for (let x = 0; x < compas; x++) {
          const a = x >= compas / 2 ? posicion(acordeEn(k, x), 52, 4) : notas;
          const m = a[[0, 2, 1, 3, 2, 1][x % 6]!]!;
          const dur = recortar(t0 + x, 2);
          if (dur !== null) push({ at: t0 + x, dur, inst: "guitarra", ms: [m], vol: VOL.guitarra * (x === 0 ? 0.7 : 0.5) });
        }
      } else {
        for (const [x, v, dir] of corte ? ([[0, 1, "b"]] as const) : p.rasgueo) {
          const a = acordeEn(k, x);
          const dur = corte ? durCorte : 1;
          push({ at: t0 + x, dur, inst: "tiple", ms: posicion(a, 59, 4), vol: VOL.tiple * v, rasgo: dir === "b" ? 1 : -1 });
          if (t.perc === "plena" && v >= 0.75)
            push({ at: t0 + x, dur, inst: "guitarra", ms: posicion(a, 52, 4), vol: VOL.guitarra * v * 0.35, rasgo: dir === "b" ? 1 : -1 });
        }
      }
    }

    // El colchón: el acorde sostenido (sin la fundamental), bajito, mitad por mitad si cambia.
    if (t.colchon && !corte) {
      const inst = t.colchon;
      const mitades = acordeEn(k, 0).join() === acordeEn(k, compas / 2).join() ? [[0, compas]] : [[0, compas / 2], [compas / 2, compas / 2]];
      for (const [x, d] of mitades) {
        const a = acordeEn(k, x!);
        const ms = posicion(a, RANGO[inst][0] + 5, 3).slice(1);
        const dur = recortar(t0 + x!, d!);
        if (dur !== null) push({ at: t0 + x!, dur, inst, ms, vol: VOL[inst] * 0.45 });
      }
    }
  }

  // La percusión.
  if (t.perc !== "nada") {
    for (let k = 0; k < compases; k++) {
      const t0 = k * compas;
      const golpea = (inst: Golpe, x: number, v: number) => push({ at: t0 + x, dur: 1, inst, vol: VOL[inst] * v });
      if (cortes.has(k) || k === finalK) {
        // El golpe de toda la banda.
        golpea("bombo", 0, 1.1);
        if (murga) {
          golpea("platillo", 0, 1.3);
          golpea("redoblante", 0, 1);
          golpea("timbal", 0, 1);
          golpea("tambora", 0, 1);
        } else {
          golpea("shekere", 0, 1);
          golpea("chajchas", 0, 1);
        }
        if (k === finalK) continue;
        // El repique: semicorcheas que crecen hasta volver a entrar.
        for (let x = repique, j = 0; x < compas - 1e-6; x += 0.5, j++) {
          const v = 0.5 + (0.5 * (x - repique)) / (compas - repique);
          if (murga) golpea(j % 2 ? "timbalBajo" : "timbal", x, v);
          golpea(murga ? "redoblante" : "bombo", x, v * (murga ? 0.6 : 0.7));
        }
        continue;
      }
      const liviana = t.perc === "liviana";
      for (const [g, toques] of Object.entries(p.perc) as [Golpe, readonly Toque[]][]) {
        if (liviana && g !== "bombo" && !SACUDIDORES.includes(g)) continue;
        for (const [x, v] of toques) golpea(g, x, v * (liviana ? 0.75 : 1));
      }
      // El platillo al empezar el tramo y al volver de un corte.
      if (murga && !liviana && (k === 0 || cortes.has(k - 1))) golpea("platillo", 0, 1);
      // Cada cuatro compases, un remate de timbales (o de bombo en el colectivo) antes de seguir.
      const remate = t.perc === "sola" || (k % 4 === 3 && !cortes.has(k + 1));
      if (remate && !liviana) {
        const desdeX = compas === 6 ? 3 : 2;
        for (let x = desdeX, j = 0; x < compas - 1e-6; x += 0.5, j++) {
          if (murga) golpea(j % 3 === 2 ? "timbalBajo" : "timbal", x, 0.55 + 0.1 * j);
          else if (j % 2 === 0) golpea("bombo", x, 0.45);
        }
      }
    }
  }
  return ev.sort((a, b) => a.at - b.at);
}
