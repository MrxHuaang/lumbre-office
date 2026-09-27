// Sonidos de la pesca con WebAudio (sin archivos): el plop de la boya, el "¡pica!", el tic del carrete,
// la fanfarria al sacarlo y el cofre. Suenan por la salida de efectos de sfx.ts.
import { sfxOut } from "../sfx";

/** Salida de los efectos (mismo contexto y volumen que el resto: se silencia con el control del HUD). */
const audio = sfxOut;

/** Un tono corto con envolvente (`type` del oscilador, frecuencia de inicio y de fin). */
function tone(at: number, dur: number, from: number, to: number, vol: number, type: OscillatorType = "square") {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + at;
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Salpicadura: ruido filtrado que se apaga rápido. */
function splash(at: number, dur: number, vol: number, freq = 900) {
  const a = audio();
  if (!a) return;
  const t0 = a.ctx.currentTime + at;
  const len = Math.ceil(a.ctx.sampleRate * dur);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(a.out);
  src.start(t0);
}

export type FishSound = "cast" | "bite" | "reel" | "catch" | "record" | "escape" | "treasure" | "trash";

export function playFishSound(kind: FishSound) {
  switch (kind) {
    case "cast":
      // El sedal que silba y el plop de la boya.
      tone(0, 0.28, 1400, 500, 0.05, "sine");
      splash(0.32, 0.18, 0.5, 700);
      tone(0.32, 0.12, 320, 140, 0.12, "sine");
      return;
    case "bite":
      splash(0, 0.12, 0.6, 1200);
      tone(0, 0.09, 880, 880, 0.12);
      tone(0.11, 0.12, 1175, 1175, 0.12);
      return;
    case "reel":
      tone(0, 0.025, 2400, 1800, 0.03);
      return;
    case "catch":
      [523, 659, 784, 1047].forEach((f, i) => tone(i * 0.08, 0.16, f, f, 0.08));
      splash(0, 0.2, 0.35, 900);
      return;
    case "record":
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(i * 0.07, 0.18, f, f, 0.08));
      return;
    case "treasure":
      [1568, 2093, 2637].forEach((f, i) => tone(i * 0.06, 0.2, f, f, 0.05, "triangle"));
      return;
    case "trash":
      tone(0, 0.2, 300, 180, 0.08, "triangle");
      tone(0.18, 0.25, 220, 110, 0.08, "triangle");
      return;
    case "escape":
      tone(0, 0.3, 660, 220, 0.07, "triangle");
      splash(0.05, 0.2, 0.3, 600);
      return;
  }
}
