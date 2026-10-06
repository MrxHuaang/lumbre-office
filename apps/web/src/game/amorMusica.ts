// La música de la serenata de Amor y amistad, sintetizada con WebAudio (sin grabaciones): un trío de cuerdas
// colombiano. El requinto lleva la melodía (pulsado brillante y, en las notas largas, el trémolo de púa), el
// tiple rasguea los acordes en el dos y el tres del compás y la guitarra marca el bajo en el uno, como en un
// pasillo. La pieza es original ("Pasillo del cofre", en Mi menor y en 3/4): una introducción de dos compases
// y dieciséis de melodía con la armonía de siempre (i, iv, VII, III, V). Va por la salida de la música.
import { sfxOut } from "./sfx";

const NOTE: Record<string, number> = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
/** "A4" → 440 Hz. */
function freq(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 0;
  return 440 * 2 ** ((NOTE[m[1]!]! + (Number(m[2]) - 4) * 12) / 12);
}

type Nota = [string, number];

const BPM = 112;
/** Los acordes de cada compás (tiple) con su bajo (guitarra). */
const Em = { tiple: ["E4", "G4", "B4", "E5"], bajo: "E2" };
const Am = { tiple: ["A4", "C5", "E5", "A5"], bajo: "A2" };
const D7 = { tiple: ["D4", "F#4", "C5", "D5"], bajo: "D3" };
const G = { tiple: ["G4", "B4", "D5", "G5"], bajo: "G2" };
const B7 = { tiple: ["B3", "D#4", "A4", "B4"], bajo: "B2" };
const ACORDES = [Em, Em, Em, Em, Am, Am, D7, D7, G, B7, Em, Em, Am, Am, B7, B7, Em, Em];
/** La melodía del requinto (empieza en el tercer compás, después de la introducción). */
const MELODIA: Nota[] = [
  ["-", 6],
  ["B4", 1], ["E5", 1], ["G5", 1],
  ["F#5", 2], ["E5", 1],
  ["E5", 1], ["A5", 1], ["C6", 1],
  ["B5", 2], ["A5", 1],
  ["A5", 1], ["F#5", 1], ["D5", 1],
  ["C5", 2], ["A4", 1],
  ["B4", 1], ["D5", 1], ["G5", 1],
  ["F#5", 3],
  ["G5", 1], ["F#5", 1], ["E5", 1],
  ["B5", 2], ["G5", 1],
  ["A5", 1], ["G5", 1], ["F#5", 1],
  ["E5", 2], ["C5", 1],
  ["B4", 1], ["D#5", 1], ["F#5", 1],
  ["A5", 2], ["F#5", 1],
  ["E5", 1], ["G5", 1], ["B4", 1],
  ["E5", 3],
];

/** Una cuerda pulsada: diente de sierra filtrado que se apaga, con un armónico suave. */
function cuerda(ctx: AudioContext, out: AudioNode, t: number, f: number, vol: number, largo = 0.6, brillo = 5) {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(f, t);
  const tri = ctx.createOscillator();
  tri.type = "triangle";
  tri.frequency.setValueAtTime(f, t);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(f * brillo, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t + largo);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + largo);
  osc.connect(lp);
  tri.connect(lp);
  lp.connect(g).connect(out);
  for (const o of [osc, tri]) {
    o.start(t);
    o.stop(t + largo + 0.05);
  }
}

/** Programa la pieza entera desde `t0` (segundos del contexto). Devuelve cuánto dura. */
function programar(ctx: AudioContext, out: AudioNode, t0: number): number {
  const beat = 60 / BPM;
  ACORDES.forEach((a, c) => {
    const t = t0 + c * 3 * beat;
    // La guitarra: el bajo en el uno y la quinta de paso en el tres.
    cuerda(ctx, out, t, freq(a.bajo), 0.22, 0.9, 3);
    cuerda(ctx, out, t + 2 * beat, freq(a.bajo) * 1.5, 0.12, 0.5, 3);
    // El tiple: rasgueo en el dos y en el tres (con la síncopa del pasillo, un pelito antes del tres).
    for (const [k, vol] of [[1, 0.06], [1.75, 0.05], [2.5, 0.055]] as const)
      a.tiple.forEach((n, i) => {
        cuerda(ctx, out, t + k * beat + i * 0.011, freq(n), vol, 0.32, 7);
        // El tiple lleva las cuerdas dobladas (la octava, más bajito).
        cuerda(ctx, out, t + k * beat + i * 0.011 + 0.004, freq(n) * 2, vol * 0.35, 0.22, 6);
      });
  });
  // El requinto: cada nota pulsada; las largas con trémolo.
  let at = 0;
  for (const [n, len] of MELODIA) {
    if (n !== "-") {
      const t = t0 + at * beat;
      const f = freq(n);
      if (len >= 2) for (let k = 0; k < len * 4; k++) cuerda(ctx, out, t + (k * beat) / 4, f, k === 0 ? 0.16 : 0.09, 0.2, 6);
      else cuerda(ctx, out, t, f, 0.16, 0.5, 6);
    }
    at += len;
  }
  return ACORDES.length * 3 * beat;
}

/** La serenata que suena ahora (una a la vez). */
let actual: { g: GainNode; stop: number } | null = null;

/** Toca la serenata con ese volumen (0..1); la anterior, si sonaba, se corta. */
export function tocarSerenata(vol: number) {
  pararSerenata();
  const a = sfxOut("music");
  if (!a || vol <= 0.01) return;
  const { ctx } = a;
  const g = ctx.createGain();
  g.gain.value = vol;
  g.connect(a.out);
  const largo = programar(ctx, g, ctx.currentTime + 0.1);
  const stop = window.setTimeout(() => g.disconnect(), (largo + 1.5) * 1000);
  actual = { g, stop };
}

/** Baja el volumen de la que suena (al alejarse) o la apaga (al cambiar de nivel). */
export function volumenSerenata(vol: number) {
  if (!actual) return;
  const ctx = actual.g.context;
  actual.g.gain.setTargetAtTime(Math.max(0, vol), ctx.currentTime, 0.3);
}

export function pararSerenata() {
  if (!actual) return;
  window.clearTimeout(actual.stop);
  actual.g.disconnect();
  actual = null;
}
