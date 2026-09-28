// Mundo lleno: los sonidos de los muebles nuevos, generados con WebAudio (sin archivos): la impresora, la
// ducha, los rodillos y la campana del tragamonedas, el motorcito de la garra y el tic-tic de la rueda de
// la fortuna. Usan la misma salida que sound.ts. `vol` según la distancia (0..1).
import { audioOut } from "./sound";

type Out = NonNullable<ReturnType<typeof audioOut>>;

function noise(a: Out, t: number, len: number, o: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number; vol: number; attack?: number }) {
  const { ctx } = a;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

function tone(a: Out, t: number, len: number, o: { freq: number; freqEnd?: number; type?: OscillatorType; vol: number; attack?: number }) {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function at(vol: number, play: (a: Out, t: number) => void) {
  if (vol <= 0.01) return;
  const a = audioOut();
  if (!a) return;
  play(a, a.ctx.currentTime + 0.02);
}

/** La impresora: el rodillo que arranca, las pasadas del cabezal (ris-ras) y la hoja que sale. */
export const playPrinter = (vol: number) =>
  at(vol, (a, t) => {
    tone(a, t, 0.25, { freq: 90, freqEnd: 140, type: "sawtooth", vol: 0.02 * vol, attack: 0.05 });
    for (let k = 0; k < 6; k++) {
      noise(a, t + 0.2 + k * 0.22, 0.16, { type: "bandpass", freq: 1800 + (k % 2) * 500, q: 3, vol: 0.07 * vol });
      tone(a, t + 0.2 + k * 0.22, 0.14, { freq: 420 + (k % 2) * 90, type: "square", vol: 0.012 * vol });
    }
    noise(a, t + 1.6, 0.3, { type: "highpass", freq: 2500, freqEnd: 5000, vol: 0.06 * vol, attack: 0.05 });
  });

/** La ducha del jardín: el chorro y las gotas en las tablas. */
export const playShower = (vol: number, ms: number) =>
  at(vol, (a, t) => {
    const len = ms / 1000;
    noise(a, t, len, { type: "highpass", freq: 3200, vol: 0.09 * vol, attack: 0.15 });
    noise(a, t, len, { type: "bandpass", freq: 900, q: 0.5, vol: 0.05 * vol, attack: 0.2 });
    for (let k = 0; k < len * 7; k++) tone(a, t + k / 7 + Math.random() * 0.1, 0.04, { freq: 900 + Math.random() * 900, freqEnd: 1800, vol: 0.02 * vol });
  });

/** El tragamonedas: la palanca, el girar de los rodillos y el tac de cada uno al frenar. */
export const playReels = (spinMs: number) =>
  at(1, (a, t) => {
    noise(a, t, 0.12, { type: "lowpass", freq: 700, vol: 0.2 });
    const len = spinMs / 1000;
    for (let k = 0; k < len * 16; k++) tone(a, t + 0.1 + k / 16, 0.03, { freq: 1300 + (k % 3) * 120, type: "square", vol: 0.012 });
    for (let r = 0; r < 3; r++) tone(a, t + len * (0.55 + r * 0.2), 0.08, { freq: 300, freqEnd: 160, type: "triangle", vol: 0.12 });
  });

/** Premio del tragamonedas: la campanita (con tres sietes, larga y con monedas cayendo). */
export const playSlotWin = (big: boolean) =>
  at(1, (a, t) => {
    const notes = big ? [784, 988, 1175, 1568, 1175, 1568, 2093] : [988, 1319];
    notes.forEach((n, i) => tone(a, t + i * 0.09, 0.3, { freq: n, type: "square", vol: 0.03 }));
    if (big) for (let k = 0; k < 18; k++) tone(a, t + 0.6 + k * 0.07 + Math.random() * 0.03, 0.08, { freq: 2600 + Math.random() * 1200, vol: 0.025 });
  });

/** La garra: el motorcito (sube y baja de tono mientras se mueve) y el clac al cerrarse. */
export const playClawMotor = (ms: number) =>
  at(1, (a, t) => {
    tone(a, t, ms / 1000, { freq: 160, freqEnd: 120, type: "sawtooth", vol: 0.018, attack: 0.05 });
  });
export const playClawGrab = () =>
  at(1, (a, t) => {
    tone(a, t, 0.1, { freq: 700, freqEnd: 300, type: "triangle", vol: 0.1 });
    noise(a, t, 0.06, { type: "bandpass", freq: 2000, q: 4, vol: 0.08 });
  });

/** La rueda de la fortuna: el tic de cada clavija al pasar por la lengüeta. */
export const playWheelTick = () =>
  at(1, (a, t) => {
    tone(a, t, 0.03, { freq: 2200, freqEnd: 1600, type: "triangle", vol: 0.06 });
  });
