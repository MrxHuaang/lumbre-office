// Sonidos de la comunicación rápida, sintetizados con WebAudio (como el timbre del teléfono): el toque en
// el hombro (dos golpecitos de nudillo sobre madera y una notica) y el "din-don" de megafonía del anuncio.
// Suenan solo con la pestaña a la vista (`sfxOut`); en segundo plano ya avisa el navegador con su campanita.
import { sfxOut } from "./sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

/** Un golpecito seco: ruido corto filtrado (el nudillo) con un cuerpo grave que se apaga rápido. */
function knock(a: Out, at: number, vol: number) {
  const { ctx } = a;
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 900;
  band.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(band).connect(g).connect(a.out);
  src.start(at);
  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(220, at);
  body.frequency.exponentialRampToValueAtTime(140, at + 0.08);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(vol * 0.6, at);
  bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
  body.connect(bg).connect(a.out);
  body.start(at);
  body.stop(at + 0.12);
}

/** Una nota suave con ataque corto y cola larga (campanita de marimba). */
function note(a: Out, at: number, freq: number, vol: number, dur = 0.5, type: OscillatorType = "sine") {
  const { ctx } = a;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(a.out);
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Te saludan: toc-toc bajito y una notica arriba, sin nada de timbre. */
export function shoulderTap() {
  const a = sfxOut();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  knock(a, t, 0.5);
  knock(a, t + 0.14, 0.4);
  note(a, t + 0.3, 1046.5, 0.12, 0.45, "triangle");
}

/** Aviso a toda la cabaña: el "din-don-dan" de megafonía (sol, mi, do), cálido y sin prisa. */
export function announceChime() {
  const a = sfxOut();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  [784, 659.3, 523.3].forEach((f, i) => {
    note(a, t + i * 0.32, f, 0.2, 1.1);
    // Una octava arriba, bajito: le da el brillo de campana.
    note(a, t + i * 0.32, f * 2, 0.04, 0.6);
  });
}
