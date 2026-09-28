// La granja: los sonidos por código (WebAudio, sin archivos). El arroyo del molino suena mientras uno
// está cerca (un ruido café filtrado con gorgoteos), y los cortos: el cacareo, la cabra, el maíz que cae y
// las piedras del molino. Usan la misma salida que sound.ts. `vol` según la distancia (0..1).
import { audioOut } from "./sound";

type Out = NonNullable<ReturnType<typeof audioOut>>;

function at(vol: number, play: (a: Out, t: number) => void) {
  if (vol <= 0.01) return;
  const a = audioOut();
  if (!a) return;
  play(a, a.ctx.currentTime + 0.02);
}

function tone(a: Out, t: number, len: number, o: { freq: number; freqEnd?: number; type?: OscillatorType; vol: number }) {
  const osc = a.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function noiseBurst(a: Out, t: number, len: number, freq: number, vol: number, type: BiquadFilterType = "bandpass") {
  const buf = a.ctx.createBuffer(1, Math.max(1, Math.floor(a.ctx.sampleRate * len)), a.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

/** Cacareo: tres "co" cortos que suben, y el último largo. */
export const playCluck = (vol: number) =>
  at(vol, (a, t) => {
    const base = 520 + Math.random() * 140;
    for (let i = 0; i < 3; i++) tone(a, t + i * 0.11, 0.07, { freq: base * (1 + i * 0.06), freqEnd: base * 0.8, type: "square", vol: 0.035 * vol });
    tone(a, t + 0.36, 0.22, { freq: base * 1.3, freqEnd: base * 0.9, type: "sawtooth", vol: 0.03 * vol });
  });

/** La cabra: "meee" temblado. */
export const playBleat = (vol: number) =>
  at(vol, (a, t) => {
    const osc = a.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.linearRampToValueAtTime(330, t + 0.6);
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 11;
    const depth = a.ctx.createGain();
    depth.gain.value = 22;
    lfo.connect(depth).connect(osc.frequency);
    const f = a.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    osc.connect(f).connect(g).connect(a.out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.7);
    lfo.stop(t + 0.7);
  });

/** Un puñado de maíz que cae sobre la tierra: granitos. */
export const playScatter = (vol: number) =>
  at(vol, (a, t) => {
    for (let i = 0; i < 12; i++) noiseBurst(a, t + i * 0.035 + Math.random() * 0.02, 0.03, 3000 + Math.random() * 2500, 0.05 * vol, "highpass");
  });

/** Las piedras del molino: un retumbo grave que dura lo que muele. */
export const playGrind = (vol: number, ms: number) =>
  at(vol, (a, t) => {
    const len = Math.min(8, ms / 1000);
    const buf = a.ctx.createBuffer(1, Math.floor(a.ctx.sampleRate * len), a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < d.length; i++) {
      brown = (brown + 0.03 * (Math.random() * 2 - 1)) / 1.03;
      // Un golpe por vuelta de la piedra.
      d[i] = brown * 3 * (0.7 + 0.3 * Math.sin((i / a.ctx.sampleRate) * Math.PI * 2 * 1.4));
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const f = a.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 380;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.3);
    g.gain.setValueAtTime(0.5 * vol, t + Math.max(0.3, len - 0.4));
    g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(a.out);
    src.start(t);
    src.stop(t + len + 0.05);
  });

/** El arroyo: agua corriendo que sigue sonando (más fuerte con lluvia) mientras uno está cerca. */
class Stream {
  private gain: GainNode;
  private src: AudioBufferSourceNode;

  constructor(a: Out) {
    const { ctx } = a;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let brown = 0;
    let bubble = 0;
    let phase = 0;
    for (let i = 0; i < len; i++) {
      brown = (brown + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      // Gorgoteos: burbujas que suben de tono y se apagan.
      if (Math.random() < 0.0006) bubble = 0.4 + Math.random() * 0.4;
      bubble *= 0.9993;
      phase += (500 + (1 - bubble) * 900) / ctx.sampleRate;
      d[i] = brown * 2.4 + Math.sin(phase * Math.PI * 2) * bubble * 0.12 + (Math.random() * 2 - 1) * 0.05;
    }
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 0.5;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(f).connect(this.gain).connect(a.out);
    this.src.start();
  }

  setVolume(v: number, ctx: AudioContext) {
    this.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
  }

  stop() {
    this.src.stop();
  }
}

let stream: Stream | null = null;

/** El arroyo al volumen dado (0 = no se oye): la granja lo llama seguido según la distancia. */
export function setStreamSound(vol: number) {
  const a = stream || vol > 0.02 ? audioOut() : null;
  if (!a) return;
  if (!stream) stream = new Stream(a);
  stream.setVolume(vol * 0.35, a.ctx);
}

export function stopStreamSound() {
  const s = stream;
  stream = null;
  const a = audioOut();
  if (s && a) {
    s.setVolume(0, a.ctx);
    setTimeout(() => s.stop(), 900);
  }
}
