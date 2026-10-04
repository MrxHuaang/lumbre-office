// El taller del garaje: los sonidos por código (WebAudio, sin archivos). El compresor sisea a pulsos,
// el carro arranca, ronronea y pita, la lija raspa y la caja de herramientas tintinea. Usan la misma
// salida que sound.ts. `vol` según la distancia (0..1).
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

function noise(a: Out, t: number, len: number, o: { freq: number; freqEnd?: number; q?: number; vol: number; type?: BiquadFilterType }) {
  const buf = a.ctx.createBuffer(1, Math.max(1, Math.floor(a.ctx.sampleRate * len)), a.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + Math.min(0.04, len / 4));
  g.gain.setValueAtTime(o.vol, t + len * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

/** Compresor: el motorcito que traquetea y el aire que sale a pulsos ("pssst, pssst, pssssst"). */
export const playCompressor = (vol: number, seconds: number) =>
  at(vol, (a, t) => {
    tone(a, t, seconds, { freq: 58, type: "sawtooth", vol: 0.03 * vol });
    const pulses = Math.max(2, Math.floor(seconds / 0.55));
    for (let i = 0; i < pulses; i++) noise(a, t + 0.15 + i * 0.55, i === pulses - 1 ? 0.6 : 0.35, { freq: 5200, q: 0.8, vol: 0.05 * vol, type: "highpass" });
  });

/** Carro: la llave, el motor que arranca, el ronroneo en neutro (con acelerones) y un pito al final. */
export const playCarDrive = (vol: number, seconds: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.06, { freq: 3000, vol: 0.05 * vol });
    // Burro de arranque: tres vueltas que suben.
    for (let i = 0; i < 3; i++) tone(a, t + 0.12 + i * 0.16, 0.13, { freq: 70 + i * 12, freqEnd: 95 + i * 12, type: "square", vol: 0.035 * vol });
    const run = Math.max(1, seconds - 1.2);
    tone(a, t + 0.6, run, { freq: 48, type: "sawtooth", vol: 0.045 * vol });
    tone(a, t + 0.6, run, { freq: 96, type: "triangle", vol: 0.02 * vol });
    // Dos acelerones.
    for (const k of [0.3, 0.6]) tone(a, t + 0.6 + run * k, 0.7, { freq: 60, freqEnd: 130, type: "sawtooth", vol: 0.04 * vol });
    // Pi, pi.
    for (let i = 0; i < 2; i++) tone(a, t + 0.6 + run * 0.85 + i * 0.22, 0.14, { freq: 440, type: "square", vol: 0.03 * vol });
  });

/** Lija: raspones de ida y vuelta, más agudos al volver. */
export const playSanding = (vol: number, seconds: number) =>
  at(vol, (a, t) => {
    const strokes = Math.max(2, Math.floor(seconds / 0.3));
    for (let i = 0; i < strokes; i++) noise(a, t + i * 0.3, 0.24, { freq: i % 2 ? 2600 : 1700, freqEnd: i % 2 ? 1900 : 2400, q: 1.4, vol: 0.05 * vol });
  });

/** La rana: tres argollas de bronce que vuelan y caen tintineando (la última, al hueco con un "clonc"). */
export const playFrogRings = (vol: number) =>
  at(vol, (a, t) => {
    for (let i = 0; i < 3; i++) {
      const f = 2200 + Math.random() * 900;
      tone(a, t + 0.35 + i * 0.45, 0.25, { freq: f, freqEnd: f * 0.94, type: "triangle", vol: 0.035 * vol });
      noise(a, t + 0.36 + i * 0.45, 0.06, { freq: 700, q: 3, vol: 0.03 * vol });
    }
    tone(a, t + 1.4, 0.3, { freq: 180, freqEnd: 120, type: "sine", vol: 0.06 * vol });
  });

/** El billar: el taco que pega, las bolas que chocan y una que cae a la buchaca. */
export const playPoolShot = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t + 0.2, 0.04, { freq: 1500, q: 4, vol: 0.08 * vol });
    tone(a, t + 0.55, 0.08, { freq: 1300, freqEnd: 1100, type: "sine", vol: 0.06 * vol });
    tone(a, t + 0.7, 0.07, { freq: 1500, freqEnd: 1250, type: "sine", vol: 0.04 * vol });
    noise(a, t + 1.0, 0.18, { freq: 300, freqEnd: 160, q: 1, vol: 0.05 * vol, type: "lowpass" });
  });

/** Caja de herramientas: la tapa que se abre y el metal que tintinea al esculcar. */
export const playToolRattle = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.08, { freq: 900, q: 2, vol: 0.06 * vol });
    for (let i = 0; i < 6; i++) {
      const f = 1800 + Math.random() * 2400;
      tone(a, t + 0.12 + i * 0.1 + Math.random() * 0.04, 0.18, { freq: f, freqEnd: f * 0.97, type: "triangle", vol: 0.025 * vol });
    }
  });
