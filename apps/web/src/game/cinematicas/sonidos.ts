// Los sonidos de las cinemáticas, por código (WebAudio, sin archivos), por la salida de los efectos
// (sfx.ts): campanadas del reloj, la carta que llega, el destello, la magia, la brisa, el tambor y el
// trueno lejano. La fanfarria y los aplausos son los de siempre.
import { playPieza } from "../carnaval/musica";
import type { CineSound } from "@hyvento/shared";
import { oficioSfx } from "../oficiosSonidos";
import { sfx, sfxOut } from "../sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

function tone(a: Out, t: number, len: number, freq: number, vol: number, type: OscillatorType = "sine", toFreq?: number) {
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + len);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function noise(a: Out, t: number, len: number, freq: number, vol: number, sweepTo?: number) {
  const buf = a.ctx.createBuffer(1, Math.max(1, Math.floor(a.ctx.sampleRate * len)), a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const f = a.ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
}

/** Una campanada de reloj de pie: la nota con sus parciales (como una campana) que se apaga despacio. */
function bell(a: Out, t: number, base = 392) {
  tone(a, t, 2.4, base, 0.05);
  tone(a, t, 1.8, base * 2.01, 0.022);
  tone(a, t, 1.2, base * 2.76, 0.012);
  tone(a, t, 0.5, base * 5.4, 0.006);
}

export function playCineSound(sound: CineSound) {
  if (sound === "fanfarria") return oficioSfx.fanfare(8);
  // La música andina del Carnaval (sintetizada): La Guaneña en la apertura y el albazo en la premiación.
  if (sound === "guanena" || sound === "albazo") return playPieza(sound);
  if (sound === "aplausos") return sfx.applause(1, 5);
  if (sound === "trueno") return sfx.thunder(0.5, true);
  const a = sfxOut();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  switch (sound) {
    case "campanada":
      return bell(a, t);
    case "campanadas":
      // Trece, como en el libro del reloj de pie (la última más grave).
      for (let i = 0; i < 13; i++) bell(a, t + i * 0.55, i === 12 ? 330 : 392);
      return;
    case "carta":
      // El papel que se desliza y el golpecito del buzón.
      noise(a, t, 0.35, 2400, 0.03, 900);
      tone(a, t + 0.32, 0.12, 180, 0.05, "triangle");
      return;
    case "destello":
      tone(a, t, 0.5, 1568, 0.02, "triangle", 2637);
      return;
    case "magia":
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(a, t + i * 0.06, 0.6, f, 0.016, "triangle"));
      return;
    case "brisa":
      noise(a, t, 2.2, 500, 0.025, 1400);
      return;
    case "chapuzon":
      // Algo que sale del agua: el chapoteo y las gotas que caen después.
      noise(a, t, 0.45, 900, 0.05, 300);
      [1760, 1397, 2093, 1568].forEach((f, i) => tone(a, t + 0.35 + i * 0.11, 0.09, f, 0.014, "sine", f * 0.7));
      return;
    case "tambor":
      for (let i = 0; i < 6; i++) tone(a, t + i * 0.09, 0.12, 110, 0.06, "triangle", 60);
      tone(a, t + 0.6, 0.4, 90, 0.08, "triangle", 45);
      return;
  }
}
