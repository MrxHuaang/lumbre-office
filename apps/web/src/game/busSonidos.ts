// Los sonidos del Megabús, con WebAudio (sin archivos): el motor diésel que ronronea y sube de vueltas al
// arrancar, el siseo del freno de aire al parar y el "pssh" de las puertas con su campanita. Por la salida de
// los efectos (sfx.ts): respetan el volumen y el silencio. `vol` según la distancia (0..1).
import { sfxOut } from "./sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

function start(vol: number, play: (a: Out, t: number) => void) {
  if (vol <= 0.02) return;
  const a = sfxOut();
  if (a) play(a, a.ctx.currentTime + 0.02);
}

/** Ruido filtrado con envolvente (aire, frenos). */
function hiss(a: Out, t: number, len: number, o: { type: BiquadFilterType; freq: number; to?: number; q?: number; vol: number; attack?: number }) {
  const { ctx } = a;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + len);
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.02));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

function tone(a: Out, t: number, len: number, from: number, to: number, vol: number, type: OscillatorType = "sine") {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** Frenada: el freno de aire que sisea y un chillido cortito de las pastillas. */
export const playBusBrakes = (vol: number) =>
  start(vol, (a, t) => {
    tone(a, t, 0.7, 1700, 1450, 0.018 * vol, "triangle");
    hiss(a, t + 0.5, 1.1, { type: "highpass", freq: 2600, vol: 0.09 * vol, attack: 0.03 });
  });

/** Puertas: el "pssh" neumático y la campanita (dos notas que bajan al abrir, dos pitidos al cerrar). */
export const playBusDoors = (vol: number, opening: boolean) =>
  start(vol, (a, t) => {
    hiss(a, t, 0.55, { type: "bandpass", freq: 1400, to: 700, q: 0.7, vol: 0.1 * vol });
    if (opening) {
      tone(a, t + 0.05, 0.35, 880, 880, 0.04 * vol);
      tone(a, t + 0.3, 0.5, 660, 660, 0.04 * vol);
    } else {
      tone(a, t, 0.14, 740, 740, 0.035 * vol, "square");
      tone(a, t + 0.22, 0.14, 740, 740, 0.035 * vol, "square");
    }
  });

// ---------- Motor (sonido continuo) ----------

let engine: { ctx: AudioContext; gain: GainNode; osc: OscillatorNode; sub: OscillatorNode; lp: BiquadFilterNode } | null = null;

/**
 * El motor: `vol` 0..1 (0 lo apaga de a poco) y `rev` 0 en ralentí … 1 acelerando (sube el tono y se abre el
 * filtro). Se llama cada cuadro con lo que toca; arranca solo la primera vez que se oye.
 */
export function setBusEngine(vol: number, rev: number) {
  const a = sfxOut();
  if (!a) {
    if (engine) engine.gain.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.1);
    return;
  }
  if (!engine || engine.ctx !== a.ctx) {
    if (vol <= 0.02) return;
    const { ctx } = a;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const sub = ctx.createOscillator();
    sub.type = "square";
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;
    osc.connect(lp);
    sub.connect(subGain).connect(lp);
    lp.connect(gain).connect(a.out);
    osc.start();
    sub.start();
    engine = { ctx, gain, osc, sub, lp };
  }
  const t = engine.ctx.currentTime;
  const r = Math.max(0, Math.min(1, rev));
  engine.osc.frequency.setTargetAtTime(38 + r * 34, t, 0.25);
  engine.sub.frequency.setTargetAtTime(19 + r * 17, t, 0.25);
  engine.lp.frequency.setTargetAtTime(170 + r * 420, t, 0.25);
  engine.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)) * 0.07, t, 0.3);
}
