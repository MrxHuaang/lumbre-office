// Los instrumentos del Carnaval, sintetizados con WebAudio (ninguna grabación). La murga: trompeta, saxo y
// trombón (diente de sierra con un filtro que se abre al soplar y vibrato que entra tarde), acordeón
// (lengüetas: ondas de pulso desafinadas un pelito entre sí, que es el trémolo), bombo, redoblante,
// platillo, timbales, güiro, guasá y campana. El colectivo andino: quena, zampoña, rondador (dos cañas a la
// vez), bombo y shekere. Cada golpe crea sus nodos y se suelta solo al terminar.
import { hz, type Evento, type Golpe, type Instrumento } from "./musica-programa";

const RUIDOS = new WeakMap<BaseAudioContext, AudioBuffer>();
/** Dos segundos de ruido por contexto, que cada golpe lee desde un punto al azar. */
function ruido(ctx: AudioContext): AudioBuffer {
  let b = RUIDOS.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    RUIDOS.set(ctx, b);
  }
  return b;
}

function noise(ctx: AudioContext, out: AudioNode, t: number, len: number, type: BiquadFilterType, f: number, q: number, vol: number, attack = 0.002) {
  const src = ctx.createBufferSource();
  src.buffer = ruido(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = f;
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(filt).connect(g).connect(out);
  src.start(t, Math.random() * Math.max(0, 1.9 - len), len + 0.05);
  return g;
}

function env(g: GainNode, t: number, peak: number, attack: number, len: number, release = 0.06) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, len - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.02);
}

/** Vibrato que entra de a poco (solo en las notas largas). */
function vibrato(ctx: AudioContext, target: AudioParam, t: number, f: number, len: number, rate: number, depth: number, delay: number) {
  if (len < delay + 0.1) return null;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const d = ctx.createGain();
  d.gain.setValueAtTime(0, t + delay);
  d.gain.linearRampToValueAtTime(f * depth, t + delay + 0.2);
  lfo.connect(d).connect(target);
  lfo.start(t);
  lfo.stop(t + len + 0.1);
  return lfo;
}

// ---------- Bronces ----------

/** Un bronce: dos dientes de sierra, el filtro que se abre con el soplo y se cierra un poco al sostener. */
function bronce(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number, brillo: number, ataque: number, vib: number) {
  const g = ctx.createGain();
  env(g, t, vol, ataque, len);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(f * 1.2, t);
  lp.frequency.linearRampToValueAtTime(f * brillo, t + ataque + 0.03);
  lp.frequency.exponentialRampToValueAtTime(f * brillo * 0.65, t + Math.max(ataque + 0.05, len));
  lp.connect(g).connect(out);
  for (const det of [-4, 5]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.detune.value = det;
    // El bronce entra un pelito abajo y sube (el labio).
    o.frequency.setValueAtTime(f * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(f, t + ataque + 0.02);
    vibrato(ctx, o.frequency, t, f, len, 5.6, vib, 0.22);
    o.connect(lp);
    o.start(t);
    o.stop(t + len + 0.1);
  }
}

// ---------- Acordeón ----------

const PULSOS = new WeakMap<BaseAudioContext, PeriodicWave>();
/** Una onda de pulso angosta (la lengüeta), de 30%. */
function pulso(ctx: AudioContext): PeriodicWave {
  let w = PULSOS.get(ctx);
  if (!w) {
    const n = 24;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    const d = 0.3;
    for (let k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * d) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * d)) / (k * Math.PI);
    }
    w = ctx.createPeriodicWave(re, im);
    PULSOS.set(ctx, w);
  }
  return w;
}

/** El acordeón: por cada nota, tres lengüetas (una afinada, una arriba y otra abajo: el trémolo). */
function acordeon(ctx: AudioContext, out: AudioNode, t: number, fs: number[], len: number, vol: number) {
  const g = ctx.createGain();
  env(g, t, vol, 0.018, len, 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3200;
  lp.connect(g).connect(out);
  for (const f of fs) {
    for (const det of [0, 9, -8]) {
      const o = ctx.createOscillator();
      o.setPeriodicWave(pulso(ctx));
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
    }
  }
}

// ---------- Vientos andinos ----------

/** Una caña o una quena: seno con un armónico suave, vibrato (si hay) y el soplo filtrado. */
function soplo(ctx: AudioContext, out: AudioNode, t: number, f: number, len: number, vol: number, aire: number, vib: number, armonico: number) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  if (len > 0.35) {
    // Las notas largas entran un pelito abajo y suben (como sopla un quenista).
    osc.frequency.setValueAtTime(f * 0.982, t);
    osc.frequency.linearRampToValueAtTime(f, t + 0.07);
  } else osc.frequency.setValueAtTime(f, t);
  if (vib) vibrato(ctx, osc.frequency, t, f, len, 5.4, vib, 0.12);
  const over = ctx.createOscillator();
  over.type = "triangle";
  over.frequency.value = f * 2;
  const og = ctx.createGain();
  og.gain.value = armonico;
  over.connect(og);
  const g = ctx.createGain();
  env(g, t, vol, 0.04, len);
  osc.connect(g);
  og.connect(g);
  g.connect(out);
  for (const o of [osc, over]) {
    o.start(t);
    o.stop(t + len + 0.1);
  }
  noise(ctx, out, t, Math.min(len, 0.22), "bandpass", f * 1.5, 2.5, vol * aire, 0.03);
}

// ---------- Percusión ----------

function bombo(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(105, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.24);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.37);
  noise(ctx, out, t, 0.05, "lowpass", 900, 0.7, vol * 0.4);
}

function redoblante(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  // El cuero y la bordona.
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * 0.6, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.12);
  noise(ctx, out, t, 0.16, "highpass", 1800, 0.7, vol);
}

/** El platillo: seis cuadradas desafinadas (como un platillo de verdad) y un ruido agudo que se apaga lento. */
function platillo(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  bp.connect(g).connect(out);
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f * 1.7;
    o.connect(bp);
    o.start(t);
    o.stop(t + 1.15);
  }
  noise(ctx, out, t, 1.2, "highpass", 5000, 0.5, vol);
}

function timbal(ctx: AudioContext, out: AudioNode, t: number, vol: number, f: number) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(f * 1.15, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  const o2 = ctx.createOscillator();
  o2.frequency.value = f * 1.52;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(g);
  o2.connect(g);
  g.connect(out);
  for (const x of [o, o2]) {
    x.start(t);
    x.stop(t + 0.3);
  }
  // El golpe del palo en el borde metálico.
  noise(ctx, out, t, 0.03, "bandpass", 3500, 1.2, vol * 0.5);
}

/** El güiro: el raspado son muchos golpecitos de ruido seguidos (un LFO que abre y cierra el ruido). */
function guiro(ctx: AudioContext, out: AudioNode, t: number, len: number, vol: number) {
  const g = noise(ctx, out, t, len, "bandpass", 3200, 1.5, vol, 0.01);
  const lfo = ctx.createOscillator();
  lfo.type = "sawtooth";
  lfo.frequency.value = 42;
  const d = ctx.createGain();
  d.gain.value = vol * 0.8;
  lfo.connect(d).connect(g.gain);
  lfo.start(t);
  lfo.stop(t + len + 0.05);
}

function campana(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 800;
  bp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  bp.connect(g).connect(out);
  for (const f of [562, 845]) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    o.connect(bp);
    o.start(t);
    o.stop(t + 0.32);
  }
}

/** Toca un evento del programa en el momento `t` (s del contexto); `corchea` es lo que dura una corchea (s). */
export function tocar(ctx: AudioContext, out: AudioNode, e: Evento, t: number, corchea: number) {
  const len = Math.max(0.06, e.dur * corchea * 0.95);
  const fs = (e.ms ?? []).map(hz);
  switch (e.inst as Instrumento | Golpe) {
    case "trompeta":
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 7, 0.03, 0.006);
      return;
    case "saxo":
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 5, 0.04, 0.009);
      return;
    case "trombon":
      for (const f of fs) bronce(ctx, out, t, f, len, e.vol, 5.5, 0.05, 0.004);
      return;
    case "acordeon":
      return acordeon(ctx, out, t, fs, len, e.vol);
    case "quena":
      for (const f of fs) soplo(ctx, out, t, f, len, e.vol, 0.18, 0.008, 0.12);
      return;
    case "zampona":
      for (const f of fs) soplo(ctx, out, t, f, len, e.vol, 0.35, 0.002, 0.2);
      return;
    case "rondador":
      // Las dos cañas vecinas suenan juntas, cada una con su soplo (y una pizca desafinadas: baten).
      fs.forEach((f, i) => soplo(ctx, out, t, f * (i ? 1.003 : 1), len, e.vol, 0.45, 0, 0.08));
      return;
    case "bombo":
      return bombo(ctx, out, t, e.vol);
    case "redoblante":
      return redoblante(ctx, out, t, e.vol);
    case "platillo":
      return platillo(ctx, out, t, e.vol);
    case "timbal":
      return timbal(ctx, out, t, e.vol, 420);
    case "timbalBajo":
      return timbal(ctx, out, t, e.vol, 300);
    case "guiro":
      return guiro(ctx, out, t, Math.min(0.09, len), e.vol);
    case "guiroLargo":
      return guiro(ctx, out, t, corchea * 1.4, e.vol);
    case "guasa":
      return void noise(ctx, out, t, 0.08, "bandpass", 5500, 1.1, e.vol, 0.015);
    case "shekere":
      noise(ctx, out, t, 0.1, "highpass", 4200, 0.8, e.vol, 0.01);
      return void noise(ctx, out, t + 0.012, 0.05, "bandpass", 9000, 2, e.vol * 0.5);
    case "campana":
      return campana(ctx, out, t, e.vol);
  }
}
