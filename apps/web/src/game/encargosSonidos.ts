// Los sonidos de los encargos, por código (WebAudio, sin archivos) y por la misma salida y volumen de los
// efectos (sfx.ts): la campanita al cumplir uno, el arpegio con monedas al entregarlo y el papelito al
// abrir lo que alguien te pide.
import { sfxOut } from "./sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

function tone(a: Out, t: number, len: number, freq: number, vol: number, type: OscillatorType = "triangle") {
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function rustle(a: Out, t: number, len: number, vol: number) {
  const n = Math.max(1, Math.floor(a.ctx.sampleRate * len));
  const buf = a.ctx.createBuffer(1, n, a.ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Crujido de papel: ruido a golpecitos.
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.35 ? 1 : 0.2);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 3200;
  f.Q.value = 0.8;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
}

let lastAt = 0;
/** Que dos avisos seguidos no se pisen. */
function play(fn: (a: Out, t: number) => void) {
  const now = performance.now();
  if (now - lastAt < 150) return;
  lastAt = now;
  const a = sfxOut();
  if (a) fn(a, a.ctx.currentTime + 0.01);
}

export const questSfx = {
  /** Se cumplió un encargo: campanita de tres notas, subiendo. */
  done() {
    play((a, t) => {
      tone(a, t, 0.18, 784, 0.05);
      tone(a, t + 0.09, 0.18, 988, 0.05);
      tone(a, t + 0.18, 0.4, 1319, 0.05);
      tone(a, t + 0.18, 0.4, 2637, 0.012, "sine");
    });
  },
  /** Se entregó: arpeggio alegre y dos moneditas. */
  claim() {
    play((a, t) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(a, t + i * 0.07, 0.22, f, 0.045));
      tone(a, t + 0.32, 0.08, 988, 0.03, "square");
      tone(a, t + 0.4, 0.22, 1319, 0.03, "square");
    });
  },
  /** Alguien te muestra lo que necesita: el papelito. */
  open() {
    play((a, t) => rustle(a, t, 0.16, 0.12));
  },
};
