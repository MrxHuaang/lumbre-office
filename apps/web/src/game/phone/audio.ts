// Lo que suena en el celular, sintetizado con WebAudio (sin archivos): los tonos DTMF de las teclas,
// el "clac" de la tapa, los tonos polifónicos y los bips de la culebrita. Pasa por la salida de los
// efectos (`sfxOut`), así respeta el volumen y el silencio del HUD.
import { sfxOut } from "../sfx";
import { useOfficeStore } from "../store";
import { selectChatMuted, usePhoneStore } from "./state";
import { CLASSIC_TONE, parseVoice, ringtoneById, type Ringtone } from "./tonos";

type Out = NonNullable<ReturnType<typeof sfxOut>>;

function beep(a: Out, t: number, dur: number, freq: number, vol: number, type: OscillatorType = "square", to = freq, lowpass = 3200) {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = lowpass;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.setValueAtTime(vol, t + Math.max(0.005, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp).connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return osc;
}

/** Un chasquido corto de ruido (plástico que choca). */
function click(a: Out, t: number, freq: number, vol: number, dur = 0.03) {
  const { ctx } = a;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
}

// Frecuencias DTMF (fila, columna) de cada tecla, como las de un teléfono de verdad.
const DTMF: Record<string, [number, number]> = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
};

export const phoneSounds = {
  /** El tono de cada tecla del teclado numérico. */
  key(k: string) {
    const a = sfxOut();
    const pair = DTMF[k];
    if (!a || !pair) return;
    const t = a.ctx.currentTime + 0.005;
    beep(a, t, 0.09, pair[0], 0.03, "sine");
    beep(a, t, 0.09, pair[1], 0.03, "sine");
  },
  /** Flechas, OK y teclas de función: un bip seco. */
  nav() {
    const a = sfxOut();
    if (a) beep(a, a.ctx.currentTime + 0.005, 0.045, 1760, 0.018, "square");
  },
  /** Abrir la tapa: el clac de la bisagra y el saludo de dos notas. */
  flipOpen() {
    const a = sfxOut();
    if (!a) return;
    const t = a.ctx.currentTime + 0.01;
    click(a, t, 2400, 0.25);
    click(a, t + 0.09, 1500, 0.35, 0.04);
    beep(a, t + 0.18, 0.09, 1319, 0.025, "square");
    beep(a, t + 0.27, 0.14, 1976, 0.025, "square");
  },
  /** Cerrar la tapa: un clac más grave. */
  flipClose() {
    const a = sfxOut();
    if (!a) return;
    const t = a.ctx.currentTime + 0.01;
    click(a, t, 1800, 0.2);
    click(a, t + 0.05, 700, 0.45, 0.05);
  },
  snakeEat() {
    const a = sfxOut();
    if (a) beep(a, a.ctx.currentTime + 0.005, 0.05, 1568, 0.022, "square");
  },
  snakeBug() {
    const a = sfxOut();
    if (!a) return;
    const t = a.ctx.currentTime + 0.005;
    [1319, 1568, 2093].forEach((f, i) => beep(a, t + i * 0.05, 0.05, f, 0.022, "square"));
  },
  snakeDie() {
    const a = sfxOut();
    if (a) beep(a, a.ctx.currentTime + 0.005, 0.5, 440, 0.03, "square", 110, 1600);
  },
  /** Mensaje enviado: el "fiu" de la cartita que sale volando. */
  sent() {
    const a = sfxOut();
    if (a) beep(a, a.ctx.currentTime + 0.005, 0.22, 900, 0.025, "sine", 2400);
  },
};

// ---------- Tonos ----------

let playing: { stop: () => void } | null = null;

/** Deja de sonar el tono que esté sonando (vista previa, alarma). */
export function stopRingtone() {
  playing?.stop();
  playing = null;
}

/**
 * Hace sonar un tono: melodía y bajo a la vez. `maxSeconds` lo corta (el aviso de un mensaje es solo el
 * comienzo) y `repeat` lo repite (la alarma). Devuelve cuánto dura, o 0 si no sonó.
 */
export function playRingtone(r: Ringtone, { maxSeconds = Infinity, repeat = 1 }: { maxSeconds?: number; repeat?: number } = {}): number {
  stopRingtone();
  const a = sfxOut();
  if (!a) return 0;
  const voices = [
    { notes: parseVoice(r.melody, r.bpm), type: r.wave, vol: r.wave === "sine" ? 0.05 : 0.03, lowpass: 2600 },
    { notes: r.bass ? parseVoice(r.bass, r.bpm) : [], type: "triangle" as OscillatorType, vol: 0.06, lowpass: 1200 },
  ];
  const length = Math.max(...voices.map((v) => v.notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)));
  const total = Math.min(maxSeconds, length * repeat);
  const t0 = a.ctx.currentTime + 0.03;
  const oscs: OscillatorNode[] = [];
  for (let k = 0; k < repeat; k++)
    for (const v of voices)
      for (const n of v.notes) {
        const start = k * length + n.start;
        if (n.freq <= 0 || start >= total) continue;
        // Cada nota se corta un poquito antes de la siguiente: así se oyen separadas, como en los de antes.
        const dur = Math.min(n.dur * 0.9, total - start);
        oscs.push(beep(a, t0 + start, Math.max(0.02, dur), n.freq, v.vol, v.type, n.freq, v.lowpass));
      }
  const stop = () => {
    for (const o of oscs) {
      try {
        o.stop();
      } catch {
        // ya había terminado
      }
    }
  };
  const handle = { stop };
  playing = handle;
  setTimeout(() => {
    if (playing === handle) playing = null;
  }, total * 1000 + 100);
  return total;
}

/**
 * El aviso de un mensaje nuevo con el tono elegido en el celular (el comienzo). Devuelve false si se
 * eligió el bip clásico, para que suene el de siempre.
 */
export function playMessageTone(): boolean {
  const tone = usePhoneStore.getState().tone;
  if (selectChatMuted(useOfficeStore.getState())) return true; // callado: ni el tono ni el bip de siempre
  if (tone === CLASSIC_TONE) return false;
  const r = ringtoneById(tone);
  if (!r) return false;
  playRingtone(r, { maxSeconds: 1.6 });
  return true;
}
