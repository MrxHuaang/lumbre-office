// Jardín vivo: los sonidos del huerto, de las abejas y de la campanita de la glorieta, con WebAudio (sin
// archivos), por la misma salida que sound.ts. `vol` según la distancia (0..1).
import { audioOut } from "./sound";

type Out = NonNullable<ReturnType<typeof audioOut>>;

function start(vol: number, play: (a: Out, t: number) => void) {
  if (vol <= 0.01) return;
  const a = audioOut();
  if (a) play(a, a.ctx.currentTime + 0.02);
}

/** Un tono con envolvente (y, si se pide, un vibrato: el zumbido). */
function tone(a: Out, t: number, len: number, o: { freq: number; freqEnd?: number; type?: OscillatorType; vol: number; attack?: number; wobble?: number }) {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  if (o.wobble) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = o.wobble;
    depth.gain.value = o.freq * 0.06;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + len + 0.02);
  }
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** Ruido filtrado corto (la tierra que se remueve, el agua del barril). */
function hiss(a: Out, t: number, len: number, o: { type: BiquadFilterType; freq: number; vol: number }) {
  const { ctx } = a;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.value = o.freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

/** Campanita de bronce: tres golpes con parciales inarmónicos que se apagan despacio. */
export const playBell = (vol: number) =>
  start(vol, (a, t) => {
    const notes = [1318.5, 1568, 1318.5];
    notes.forEach((f, i) => {
      const at = t + i * 0.42;
      for (const [k, v] of [
        [1, 0.16],
        [2.76, 0.06],
        [5.4, 0.03],
      ] as const)
        tone(a, at, 1.8 / k + 0.3, { freq: f * k, vol: v * vol, attack: 0.002 });
    });
  });

/** Zumbido de abejas (más fuerte y agudo si se alborotan). */
export const playBuzz = (vol: number, angry = false) =>
  start(vol, (a, t) => {
    const len = angry ? 2.6 : 1.2;
    for (const f of angry ? [220, 247, 262, 294] : [196, 233]) tone(a, t + Math.random() * 0.2, len, { freq: f, type: "sawtooth", vol: (angry ? 0.02 : 0.012) * vol, attack: 0.25, wobble: 11 + Math.random() * 6 });
  });

/** La tierra que se abre para sembrar: dos rasguños. */
export const playDig = (vol: number) =>
  start(vol, (a, t) => {
    hiss(a, t, 0.18, { type: "bandpass", freq: 900, vol: 0.12 * vol });
    hiss(a, t + 0.26, 0.2, { type: "bandpass", freq: 700, vol: 0.1 * vol });
    tone(a, t + 0.5, 0.12, { freq: 520, freqEnd: 780, vol: 0.05 * vol });
  });

/** La regadera que se llena en el barril: glu-glu y agua. */
export const playFill = (vol: number) =>
  start(vol, (a, t) => {
    hiss(a, t, 0.9, { type: "lowpass", freq: 1200, vol: 0.08 * vol });
    for (let k = 0; k < 5; k++) tone(a, t + k * 0.16, 0.08, { freq: 300 + k * 60, freqEnd: 600 + k * 80, vol: 0.05 * vol });
  });

/** Cosechar: un tirón y un "pop" alegre. */
export const playPluck = (vol: number) =>
  start(vol, (a, t) => {
    hiss(a, t, 0.12, { type: "highpass", freq: 1800, vol: 0.08 * vol });
    tone(a, t + 0.1, 0.16, { freq: 660, freqEnd: 990, type: "triangle", vol: 0.09 * vol });
    tone(a, t + 0.24, 0.22, { freq: 990, freqEnd: 1320, type: "triangle", vol: 0.07 * vol });
  });
