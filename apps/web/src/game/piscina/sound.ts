// Sonidos de la piscina, sintetizados como el resto (sfx.ts): el chapuzón, las brazadas y las gotas.
// Pasan por la misma salida y el mismo volumen que los efectos; lo de otros suena más bajo de lejos.
import { sfxOut } from "../sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

let noiseBuf: AudioBuffer | null = null;
function noiseOf(ctx: AudioContext) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** Ruido filtrado con envolvente (el agua es casi todo ruido). */
function wash(a: Out, t: number, dur: number, freq: number, to: number, vol: number, attack = 0.01, type: BiquadFilterType = "bandpass") {
  const src = a.ctx.createBufferSource();
  src.buffer = noiseOf(a.ctx);
  const f = a.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = 0.9;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function blip(a: Out, t: number, dur: number, from: number, to: number, vol: number) {
  const o = a.ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

const last = new Map<string, number>();
/** No repetir el mismo sonido antes de `gapMs` (varias brazadas a la vez suenan como una). */
function gated(key: string, gapMs: number) {
  const now = performance.now();
  if (now - (last.get(key) ?? -1e9) < gapMs) return false;
  last.set(key, now);
  return true;
}

export const poolSfx = {
  /** El chapuzón: un golpe grave, el agua que se abre y las gotas que caen. */
  splash(vol = 1) {
    const a = sfxOut();
    if (!a || vol <= 0.02 || !gated("splash", 250)) return;
    const t = a.ctx.currentTime + 0.01;
    blip(a, t, 0.18, 140, 55, 0.14 * vol);
    wash(a, t, 0.5, 1800, 400, 0.16 * vol, 0.01);
    wash(a, t + 0.05, 0.7, 3500, 1200, 0.06 * vol, 0.08, "highpass");
    for (let i = 0; i < 6; i++) blip(a, t + 0.25 + Math.random() * 0.5, 0.05, 900 + Math.random() * 900, 500, 0.025 * vol);
  },
  /** Una brazada: el agua que se corre, suave. */
  stroke(vol = 1) {
    const a = sfxOut();
    if (!a || vol <= 0.02 || !gated("stroke", 380)) return;
    wash(a, a.ctx.currentTime + 0.01, 0.28, 900, 500, 0.05 * vol, 0.06);
  },
  /** El agua sobre las piedras calientes de la sauna: un siseo que se apaga (al entrar). */
  hiss(vol = 1) {
    const a = sfxOut();
    if (!a || vol <= 0.02 || !gated("hiss", 800)) return;
    const t = a.ctx.currentTime + 0.05;
    wash(a, t, 1.1, 5200, 2600, 0.05 * vol, 0.04, "highpass");
    wash(a, t + 0.02, 0.5, 1600, 900, 0.03 * vol, 0.02);
  },
  /** Salir o entrar por la escalera: un chapoteo corto. */
  slosh(vol = 1) {
    const a = sfxOut();
    if (!a || vol <= 0.02 || !gated("slosh", 300)) return;
    const t = a.ctx.currentTime + 0.01;
    wash(a, t, 0.35, 1300, 600, 0.09 * vol, 0.02);
    blip(a, t + 0.12, 0.06, 700, 420, 0.03 * vol);
  },
};
