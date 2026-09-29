// La fanfarria de subir de nivel en un oficio, por código (WebAudio, sin archivos), por la salida y el
// volumen de los efectos (sfx.ts). Más niveles, fanfarria un poquito más larga.
import { sfxOut } from "./sfx";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

function tone(a: Out, t: number, len: number, freq: number, vol: number, type: OscillatorType = "square") {
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const f = a.ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 3200;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(f).connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

export const oficioSfx = {
  /** Ta-ta-ta-táaa, con el acorde al final (y una nota más cada dos niveles). */
  fanfare(level: number) {
    const a = sfxOut();
    if (!a) return;
    const t = a.ctx.currentTime + 0.02;
    const notes = [523, 659, 784, ...(level >= 4 ? [880] : []), ...(level >= 8 ? [988] : [])];
    notes.forEach((f, i) => tone(a, t + i * 0.11, 0.14, f, 0.035));
    const end = t + notes.length * 0.11;
    for (const f of [1047, 1319, 1568]) tone(a, end, 0.7, f, 0.025, "triangle");
  },
};
