// La música andina del Carnaval, toda sintetizada con WebAudio (sin grabaciones): quena (seno con soplo y
// vibrato), zampoña (dos voces con aire), charango (rasgueo pulsado y brillante), bombo y cascabeles. Va
// por la salida de la música del mezclador. Las piezas (docs/plan-carnaval.md):
//   - "La Guaneña": bambuco tradicional de Nariño, de dominio público (suena en la apertura y al paso del
//     Galeras). El arreglo sigue la melodía de la versión para flauta de las escuelas ("do mi la la la la,
//     do' la sol sol sol sol, la sol mi la sol mi re do" y el cierre "do mi la do' la sol..."), en Mi menor
//     para que quepa en la quena en Sol (de Sol4 a Sol5), en 3 con el ritmo del bambuco: las frases entran a
//     contratiempo y terminan en la tercera del acorde; la armonía es la de siempre (i, III, VII, VI, V, i);
//   - "Sanjuanito del lago": original, en ritmo de sanjuanito (2/4): la marcha del desfile;
//   - "Pasacalle del Megabús": original, pasacalle de banda: la comparsa de la cabaña;
//   - "Albazo de la madrugada": original, para la premiación del concurso.
// `BandaAndina` toca una pieza en bucle con el volumen que le pidan cada cuadro (sube y baja con la
// distancia, como la radio); `playPieza` toca una vez su primera frase (para las cinemáticas).
import type { PiezaId } from "@hyvento/shared";
import { sfxOut } from "../sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

const NOTE: Record<string, number> = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
/** "A4" → 440 Hz. */
export function freq(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  return 440 * 2 ** ((NOTE[m[1]!]! + (Number(m[2]) - 4) * 12) / 12);
}

/** Una nota de la melodía: nombre (o "-" silencio) y cuántos tiempos dura. */
type Nota = [string, number];
/** Un acorde del charango (notas de abajo hacia arriba). */
type Acorde = readonly string[];
/** La armonía de un compás: un acorde, o dos (el segundo entra a la mitad del compás). */
type Armonia = Acorde | readonly [Acorde, Acorde];
const partido = (a: Armonia): a is readonly [Acorde, Acorde] => typeof a[0] !== "string";

interface Pieza {
  bpm: number;
  /** Tiempos por compás (2 en el sanjuanito y el pasacalle, 3 en el bambuco y el albazo). */
  compas: number;
  melodia: readonly Nota[];
  /** Una segunda voz (la zampoña), en paralelo a la melodía; null para que no suene. */
  segunda: readonly Nota[] | null;
  acordes: readonly Armonia[];
  /** El patrón del bombo dentro del compás (en tiempos). */
  bombo: readonly number[];
}

const Am = ["A3", "C4", "E4", "A4"];
const Dm = ["D4", "F4", "A4", "D5"];
const E7 = ["E3", "G#3", "B3", "D4"];
const C = ["C4", "E4", "G4", "C5"];
const G = ["G3", "B3", "D4", "G4"];
const D = ["D4", "F#4", "A4", "D5"];
const A = ["A3", "C#4", "E4", "A4"];
const Em = ["E3", "G3", "B3", "E4"];
const B7 = ["B3", "D#4", "F#4", "A4"];

export const PIEZAS_MUSICA: Record<PiezaId, Pieza> = {
  // La Guaneña (tradicional): bambuco en 3, en Mi menor. Nueve compases: la primera frase ("do mi la la la
  // la, do' la sol sol sol sol, la sol mi la sol mi re do") y la del cierre ("do mi la do' la sol, la sol mi
  // la sol mi re do"), que acaba en la tercera del acorde de Mi menor, como se canta. Cada frase entra a
  // contratiempo (en el tercer tiempo) y la segunda voz va una tercera o una cuarta abajo, en la zampoña.
  guanena: {
    bpm: 138,
    compas: 3,
    melodia: [
      ["-", 2], ["G4", 0.5], ["B4", 0.5],
      ["E5", 1], ["E5", 0.5], ["E5", 0.5], ["E5", 1],
      ["G5", 1.5], ["E5", 0.5], ["D5", 1],
      ["D5", 0.5], ["D5", 0.5], ["D5", 1], ["E5", 0.5], ["D5", 0.5],
      ["B4", 1], ["E5", 0.5], ["D5", 0.5], ["B4", 1],
      ["A4", 0.5], ["G4", 1.5], ["G4", 0.5], ["B4", 0.5],
      ["E5", 0.5], ["G5", 0.5], ["E5", 1], ["D5", 1],
      ["E5", 0.5], ["D5", 0.5], ["B4", 1], ["E5", 0.5], ["D5", 0.5],
      ["B4", 1], ["A4", 0.5], ["G4", 1.5],
    ],
    segunda: [
      ["-", 3],
      ["B4", 2], ["B4", 1],
      ["E5", 1.5], ["C5", 0.5], ["B4", 1],
      ["A4", 2], ["B4", 0.5], ["A4", 0.5],
      ["G4", 1], ["B4", 1], ["G4", 1],
      ["F#4", 0.5], ["E4", 1.5], ["-", 1],
      ["C5", 0.5], ["E5", 0.5], ["C5", 1], ["B4", 1],
      ["B4", 1], ["G4", 1], ["B4", 0.5], ["B4", 0.5],
      ["F#4", 1], ["D#4", 0.5], ["E4", 1.5],
    ],
    // Un acorde por compás; en el último, la dominante y la vuelta a Mi menor a la mitad.
    acordes: [Em, Em, G, D, Em, Em, C, G, [B7, Em]],
    bombo: [0, 2],
  },
  // Sanjuanito del lago (original): La menor, alegre, en 2.
  sanjuanito: {
    bpm: 124,
    compas: 2,
    melodia: [
      ["A4", 0.5], ["C5", 0.5], ["E5", 0.5], ["D5", 0.5], ["C5", 0.5], ["D5", 0.25], ["C5", 0.25], ["A4", 1],
      ["G4", 0.5], ["A4", 0.5], ["C5", 0.5], ["D5", 0.5], ["E5", 1], ["E5", 0.5], ["G5", 0.5],
      ["E5", 0.5], ["D5", 0.5], ["C5", 0.5], ["D5", 0.5], ["E5", 0.5], ["D5", 0.25], ["C5", 0.25], ["A4", 1],
      ["G4", 0.5], ["E4", 0.5], ["G4", 0.5], ["C5", 0.5], ["A4", 1.5], ["-", 0.5],
    ],
    segunda: [
      ["E4", 1], ["A4", 1], ["A4", 1], ["E4", 1],
      ["E4", 1], ["G4", 1], ["C5", 1], ["C5", 1],
      ["C5", 1], ["A4", 1], ["C5", 1], ["E4", 1],
      ["E4", 1], ["G4", 1], ["E4", 2],
    ],
    acordes: [Am, Am, C, C, Am, Dm, E7, Am],
    bombo: [0, 0.75, 1],
  },
  // Pasacalle del Megabús (original): Re mayor, de banda, en 2.
  pasacalle: {
    bpm: 112,
    compas: 2,
    melodia: [
      ["D5", 0.5], ["F#5", 0.5], ["A5", 0.5], ["F#5", 0.5], ["G5", 0.5], ["E5", 0.5], ["F#5", 1],
      ["E5", 0.5], ["D5", 0.5], ["C#5", 0.5], ["D5", 0.5], ["E5", 1], ["A4", 1],
      ["B4", 0.5], ["D5", 0.5], ["F#5", 0.5], ["E5", 0.5], ["D5", 0.5], ["C#5", 0.5], ["B4", 1],
      ["A4", 0.5], ["C#5", 0.5], ["E5", 0.5], ["C#5", 0.5], ["D5", 2],
    ],
    segunda: null,
    acordes: [D, D, A, A, G, D, A, D],
    bombo: [0, 1],
  },
  // Albazo de la madrugada (original): La menor, en 3, para premiar.
  albazo: {
    bpm: 120,
    compas: 3,
    melodia: [
      ["E5", 1], ["A5", 1], ["G5", 0.5], ["E5", 0.5], ["D5", 1], ["E5", 2],
      ["C5", 1], ["D5", 1], ["E5", 1], ["A4", 3],
    ],
    segunda: [
      ["C5", 1], ["E5", 1], ["E5", 0.5], ["C5", 0.5], ["B4", 1], ["C5", 2],
      ["A4", 1], ["B4", 1], ["C5", 1], ["E4", 3],
    ],
    acordes: [Am, Am, Dm, Am],
    bombo: [0, 1.5],
  },
};

// ---------- Los instrumentos ----------

function env(g: GainNode, t: number, peak: number, attack: number, len: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, len - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
}

function noiseBuffer(ctx: AudioContext, len: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Quena: un seno con vibrato que entra de a poco, un armónico suave y el soplo (ruido filtrado). */
function quena(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  // Las notas largas entran un pelito abajo y suben (como sopla un quenista); las cortas, derechas.
  if (len > 0.35) {
    osc.frequency.setValueAtTime(f * 0.982, t);
    osc.frequency.linearRampToValueAtTime(f, t + 0.07);
  } else osc.frequency.setValueAtTime(f, t);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.4;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.25, len));
  lfo.connect(depth).connect(osc.frequency);
  const over = ctx.createOscillator();
  over.type = "triangle";
  over.frequency.setValueAtTime(f * 2, t);
  const og = ctx.createGain();
  og.gain.value = 0.12;
  over.connect(og);
  const g = ctx.createGain();
  env(g, t, vol, 0.045, len);
  osc.connect(g);
  og.connect(g);
  g.connect(out);
  // El soplo.
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, len);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f * 1.5;
  bp.Q.value = 2.5;
  const ng = ctx.createGain();
  env(ng, t, vol * 0.18, 0.03, Math.min(len, 0.18));
  n.connect(bp).connect(ng).connect(out);
  for (const o of [osc, lfo, over]) {
    o.start(t);
    o.stop(t + len + 0.05);
  }
  n.start(t);
  n.stop(t + len + 0.05);
}

/** Charango: cada cuerda pulsada (diente de sierra que se apaga rápido, filtrado), rasgueadas una tras otra. */
function charango(ctx: AudioContext, out: AudioNode, t: number, notes: readonly string[], vol: number, up: boolean) {
  const order = up ? [...notes].reverse() : notes;
  order.forEach((name, i) => {
    const f = freq(name) * 2;
    const at = t + i * 0.012;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f, at);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(f * 6, at);
    lp.frequency.exponentialRampToValueAtTime(f * 1.4, at + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    osc.connect(lp).connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 0.35);
  });
}

/** Bombo: un golpe grave que baja de tono y el parche (ruido corto). */
function bombo(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(48, t + 0.22);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.32);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const ng = ctx.createGain();
  env(ng, t, vol * 0.4, 0.002, 0.05);
  n.connect(lp).connect(ng).connect(out);
  n.start(t);
  n.stop(t + 0.06);
}

/** Cascabeles: un ruidito agudo y corto. */
function cascabel(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6500;
  const g = ctx.createGain();
  env(g, t, vol, 0.002, 0.06);
  n.connect(hp).connect(g).connect(out);
  n.start(t);
  n.stop(t + 0.07);
}

// ---------- El programa de una pieza ----------

interface Golpe {
  /** En tiempos desde el comienzo de la vuelta. */
  at: number;
  play: (ctx: AudioContext, out: AudioNode, t: number, beatS: number) => void;
}

/** Todo lo que suena en una vuelta de la pieza, ordenado, y cuántos tiempos dura la vuelta. */
function programa(p: Pieza): { golpes: Golpe[]; largo: number } {
  const golpes: Golpe[] = [];
  const voz = (notas: readonly Nota[], vol: number) => {
    let at = 0;
    for (const [name, beats] of notas) {
      const f = freq(name);
      if (f) golpes.push({ at, play: (ctx, out, t, b) => quena(ctx, out, t, f, beats * b * 0.95, vol) });
      at += beats;
    }
    return at;
  };
  const largo = Math.max(voz(p.melodia, 0.16), p.segunda ? voz(p.segunda, 0.07) : 0);
  const compases = Math.ceil(largo / p.compas);
  for (let k = 0; k < compases; k++) {
    const armonia = p.acordes[k % p.acordes.length]!;
    const t0 = k * p.compas;
    for (const b of p.bombo) golpes.push({ at: t0 + b, play: (ctx, out, t) => bombo(ctx, out, t, b === 0 ? 0.5 : 0.32) });
    // El charango rasguea en cada medio tiempo (abajo en el tiempo, arriba en el contratiempo).
    for (let h = 0; h < p.compas * 2; h++) {
      const acorde = partido(armonia) ? armonia[h < p.compas ? 0 : 1] : armonia;
      golpes.push({ at: t0 + h / 2, play: (ctx, out, t) => charango(ctx, out, t, acorde, h % 2 ? 0.035 : 0.05, h % 2 === 1) });
    }
    for (let h = 0; h < p.compas * 2; h++) if (h % 2 === 1) golpes.push({ at: t0 + h / 2, play: (ctx, out, t) => cascabel(ctx, out, t, 0.05) });
  }
  golpes.sort((a, b) => a.at - b.at);
  return { golpes, largo: compases * p.compas };
}

const PROGRAMAS = new Map<PiezaId, ReturnType<typeof programa>>();
const programaDe = (id: PiezaId) => {
  let p = PROGRAMAS.get(id);
  if (!p) PROGRAMAS.set(id, (p = programa(PIEZAS_MUSICA[id])));
  return p;
};

/** Cuánto se programa por adelantado (s): lo justo para que no se corte si un cuadro se demora. */
const AHEAD_S = 0.3;

/**
 * Una banda que toca una pieza en bucle. Cada cuadro se le dice qué pieza y a qué volumen (0 = no se oye):
 * cambia de pieza al empezar la vuelta siguiente y el volumen sigue suave.
 */
export class BandaAndina {
  private out: Out | null = null;
  private gain: GainNode | null = null;
  private pieza: PiezaId | null = null;
  private quiere: PiezaId | null = null;
  private vuelta = 0;
  private i = 0;
  private inicio = 0;
  private silentSince = 0;

  update(pieza: PiezaId | null, vol: number) {
    if (!pieza || vol <= 0.01) {
      if (this.gain && this.out) this.gain.gain.setTargetAtTime(0, this.out.ctx.currentTime, 0.2);
      if (!this.silentSince) this.silentSince = performance.now();
      // Un rato callada: se suelta (la próxima vez empieza la pieza desde el comienzo).
      if (performance.now() - this.silentSince > 2500) this.stop();
      return;
    }
    this.silentSince = 0;
    this.quiere = pieza;
    if (!this.out) {
      const a = sfxOut("music");
      if (!a) return;
      this.out = a;
      this.gain = a.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(a.out);
      this.pieza = pieza;
      this.vuelta = 0;
      this.i = 0;
      this.inicio = a.ctx.currentTime + 0.05;
    }
    const { ctx } = this.out;
    this.gain!.gain.setTargetAtTime(vol, ctx.currentTime, 0.15);
    this.schedule(ctx);
  }

  private schedule(ctx: AudioContext) {
    for (let guard = 0; guard < 200; guard++) {
      const pieza = this.pieza!;
      const beatS = 60 / PIEZAS_MUSICA[pieza].bpm;
      const prog = programaDe(pieza);
      if (this.i >= prog.golpes.length) {
        // Termina la vuelta: la siguiente empieza donde acabó esta (y puede ser otra pieza).
        this.inicio += prog.largo * beatS;
        this.vuelta++;
        this.i = 0;
        this.pieza = this.quiere ?? pieza;
        continue;
      }
      const g = prog.golpes[this.i]!;
      const t = this.inicio + g.at * beatS;
      if (t > ctx.currentTime + AHEAD_S) return;
      if (t >= ctx.currentTime - 0.05) g.play(ctx, this.gain!, t, beatS);
      this.i++;
    }
  }

  stop() {
    this.gain?.disconnect();
    this.gain = null;
    this.out = null;
    this.pieza = null;
    this.silentSince = 0;
  }
}

/** Toca una vez la pieza (una vuelta), para las cinemáticas: la apertura y la premiación. */
export function playPieza(id: PiezaId, vol = 0.8) {
  const a = sfxOut("music");
  if (!a) return;
  const { ctx } = a;
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(a.out);
  const beatS = 60 / PIEZAS_MUSICA[id].bpm;
  const prog = programaDe(id);
  const t0 = ctx.currentTime + 0.05;
  for (const golpe of prog.golpes) golpe.play(ctx, g, t0 + golpe.at * beatS, beatS);
  setTimeout(() => g.disconnect(), (prog.largo * beatS + 1) * 1000);
}
