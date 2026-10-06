// La música del baile de la Feria de la cosecha, sintetizada con WebAudio (sin grabaciones): la bandola
// lleva la melodía (cuerda pulsada brillante, con trémolo en las notas largas), el tiple rasguea los acordes
// y la guitarra hace el bajo. Va por la salida de la música del mezclador. Dos piezas originales escritas
// para la cabaña:
//   - "Bambuco de la cosecha": en Re mayor y en 3, con el ritmo del bambuco: la melodía entra a
//     contratiempo (en el tercer tiempo) y el bajo marca el uno y el "y" del dos;
//   - "Torbellino del maizal": en Sol mayor, en 3 y más ligero, con el rasgueo parejo del torbellino.
// `CuerdasCosecha` toca en bucle con el volumen que le pidan cada cuadro (sube y baja con la distancia al
// patio, como la radio); `playBambuco` toca una vuelta (para la cinemática del baile).
import { freq } from "../carnaval/musica";
import { sfxOut } from "../sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;
type Nota = [string, number];
type Acorde = readonly string[];

export interface PiezaCuerdas {
  bpm: number;
  compas: number;
  melodia: readonly Nota[];
  acordes: readonly Acorde[];
  /** La nota del bajo de cada compás (la fundamental del acorde, abajo). */
  bajos: readonly string[];
  /** Dónde cae el bajo dentro del compás (en tiempos). */
  bajoEn: readonly number[];
  /** Dónde rasguea el tiple dentro del compás (en tiempos). */
  rasgueo: readonly number[];
}

const D = ["D4", "F#4", "A4", "D5"];
const A7 = ["E4", "G4", "A4", "C#5"];
const Bm = ["D4", "F#4", "B4", "D5"];
const G = ["D4", "G4", "B4", "D5"];
const Em = ["E4", "G4", "B4", "E5"];
const C = ["E4", "G4", "C5", "E5"];

export type PiezaCosecha = "bambuco" | "torbellino";

export const PIEZAS_COSECHA: Record<PiezaCosecha, PiezaCuerdas> = {
  // Bambuco de la cosecha (original): ocho compases en Re mayor.
  bambuco: {
    bpm: 132,
    compas: 3,
    melodia: [
      ["-", 2], ["A4", 0.5], ["B4", 0.5],
      ["D5", 1], ["F#5", 1], ["E5", 0.5], ["D5", 0.5],
      ["E5", 1.5], ["C#5", 0.5], ["A4", 0.5], ["B4", 0.5],
      ["C#5", 1], ["E5", 1], ["D5", 0.5], ["C#5", 0.5],
      ["D5", 2], ["F#5", 0.5], ["G5", 0.5],
      ["A5", 1], ["F#5", 1], ["D5", 0.5], ["F#5", 0.5],
      ["E5", 1.5], ["D5", 0.5], ["B4", 0.5], ["C#5", 0.5],
      ["D5", 1], ["A4", 1], ["C#5", 0.5], ["E5", 0.5],
      ["D5", 3],
    ],
    acordes: [D, D, A7, A7, D, Bm, Em, A7, D],
    bajos: ["D3", "D3", "A2", "A2", "D3", "B2", "E3", "A2", "D3"],
    // El bajo del bambuco: el uno y el "y" del dos.
    bajoEn: [0, 1.5],
    rasgueo: [0, 1, 1.5, 2],
  },
  // Torbellino del maizal (original): ocho compases en Sol mayor, más ligero.
  torbellino: {
    bpm: 150,
    compas: 3,
    melodia: [
      ["G4", 1], ["B4", 1], ["D5", 1],
      ["E5", 1], ["D5", 1], ["B4", 1],
      ["C5", 1], ["E5", 1], ["D5", 1],
      ["B4", 2], ["A4", 1],
      ["G4", 1], ["B4", 1], ["D5", 1],
      ["G5", 1], ["E5", 1], ["C5", 1],
      ["D5", 1], ["B4", 1], ["A4", 1],
      ["G4", 3],
    ],
    acordes: [G, Em, C, D, G, C, D, G],
    bajos: ["G2", "E3", "C3", "D3", "G2", "C3", "D3", "G2"],
    bajoEn: [0, 2],
    rasgueo: [0, 1, 2],
  },
};

function env(g: GainNode, t: number, peak: number, attack: number, len: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
}

/** Bandola: cuerda pulsada brillante (dos osciladores un pelito desafinados) y trémolo en las largas. */
function bandola(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number) {
  const golpes = len > 0.6 ? Math.floor(len / 0.11) : 1;
  for (let k = 0; k < golpes; k++) {
    const at = t + k * 0.11;
    const dur = golpes > 1 ? 0.16 : Math.max(0.25, len);
    for (const det of [1, 1.004]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f * det, at);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(f * 7, at);
      lp.frequency.exponentialRampToValueAtTime(f * 2, at + dur);
      const g = ctx.createGain();
      env(g, at, vol * (golpes > 1 ? 0.7 : 1), 0.004, dur);
      o.connect(lp).connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.02);
    }
  }
}

/** Tiple: las cuatro cuerdas rasgueadas una tras otra (triángulo con un armónico encima). */
function tiple(ctx: AudioContext, out: AudioNode, t: number, notes: readonly string[], vol: number, up: boolean) {
  const order = up ? [...notes].reverse() : notes;
  order.forEach((name, i) => {
    const f = freq(name);
    const at = t + i * 0.014;
    for (const [mul, v] of [[1, 1], [2, 0.35]] as const) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f * mul, at);
      const g = ctx.createGain();
      env(g, at, vol * v, 0.003, 0.4);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.42);
    }
  });
}

/** Guitarra: el bajo pulsado, grave y redondo. */
function guitarra(ctx: AudioContext, out: AudioNode, t: number, f: number, vol: number) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f, t);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = f * 4;
  const g = ctx.createGain();
  env(g, t, vol, 0.005, 0.6);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.62);
}

interface Golpe {
  at: number;
  play: (ctx: AudioContext, out: AudioNode, t: number, beatS: number) => void;
}

/** Todo lo que suena en una vuelta, ordenado, y cuántos tiempos dura. */
export function programaCuerdas(p: PiezaCuerdas): { golpes: Golpe[]; largo: number } {
  const golpes: Golpe[] = [];
  let at = 0;
  for (const [name, beats] of p.melodia) {
    const f = freq(name);
    if (f) golpes.push({ at, play: (ctx, out, t, b) => bandola(ctx, out, t, f, beats * b * 0.95, 0.07) });
    at += beats;
  }
  const compases = Math.ceil(at / p.compas);
  for (let k = 0; k < compases; k++) {
    const t0 = k * p.compas;
    const acorde = p.acordes[k % p.acordes.length]!;
    const bajo = freq(p.bajos[k % p.bajos.length]!);
    for (const b of p.bajoEn) golpes.push({ at: t0 + b, play: (ctx, out, t) => guitarra(ctx, out, t, bajo, 0.16) });
    p.rasgueo.forEach((r, i) => golpes.push({ at: t0 + r, play: (ctx, out, t) => tiple(ctx, out, t, acorde, i === 0 ? 0.045 : 0.032, i % 2 === 1) }));
  }
  golpes.sort((a, b) => a.at - b.at);
  return { golpes, largo: compases * p.compas };
}

const PROGRAMAS = new Map<PiezaCosecha, ReturnType<typeof programaCuerdas>>();
const programaDe = (id: PiezaCosecha) => {
  let p = PROGRAMAS.get(id);
  if (!p) PROGRAMAS.set(id, (p = programaCuerdas(PIEZAS_COSECHA[id])));
  return p;
};

const AHEAD_S = 0.3;

/** Los músicos del patio: tocan en bucle (bambuco y torbellino, uno tras otro) al volumen que les pidan. */
export class CuerdasCosecha {
  private out: Out | null = null;
  private gain: GainNode | null = null;
  private pieza: PiezaCosecha = "bambuco";
  private i = 0;
  private inicio = 0;
  private silentSince = 0;

  update(vol: number) {
    if (vol <= 0.01) {
      if (this.gain && this.out) this.gain.gain.setTargetAtTime(0, this.out.ctx.currentTime, 0.2);
      if (!this.silentSince) this.silentSince = performance.now();
      if (performance.now() - this.silentSince > 2500) this.stop();
      return;
    }
    this.silentSince = 0;
    if (!this.out) {
      const a = sfxOut("music");
      if (!a) return;
      this.out = a;
      this.gain = a.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(a.out);
      this.pieza = "bambuco";
      this.i = 0;
      this.inicio = a.ctx.currentTime + 0.05;
    }
    const { ctx } = this.out;
    this.gain!.gain.setTargetAtTime(vol, ctx.currentTime, 0.15);
    for (let guard = 0; guard < 200; guard++) {
      const beatS = 60 / PIEZAS_COSECHA[this.pieza].bpm;
      const prog = programaDe(this.pieza);
      if (this.i >= prog.golpes.length) {
        this.inicio += prog.largo * beatS;
        this.i = 0;
        this.pieza = this.pieza === "bambuco" ? "torbellino" : "bambuco";
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
    this.silentSince = 0;
  }
}

/** Una vuelta del bambuco (la cinemática del baile). */
export function playBambuco(vol = 0.8) {
  const a = sfxOut("music");
  if (!a) return;
  const g = a.ctx.createGain();
  g.gain.value = vol;
  g.connect(a.out);
  const beatS = 60 / PIEZAS_COSECHA.bambuco.bpm;
  const prog = programaDe("bambuco");
  const t0 = a.ctx.currentTime + 0.05;
  for (const golpe of prog.golpes) golpe.play(a.ctx, g, t0 + golpe.at * beatS, beatS);
  setTimeout(() => g.disconnect(), (prog.largo * beatS + 1) * 1000);
}
