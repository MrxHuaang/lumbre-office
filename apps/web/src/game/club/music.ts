// La música del club, generada con WebAudio (sin archivos): cinco estilos con batería, bajo y acordes
// hechos con osciladores y ruido. Todos cuentan el compás desde el `startedAt` del servidor, así en cada
// navegador suena el mismo golpe al mismo tiempo. Se programa con un poco de anticipación (un
// setInterval no es preciso) y se oye solo dentro del club, con un fundido al entrar y salir.
import { clubTrack, type ClubTrack, type ClubTrackId } from "@hyvento/shared";
import { sharedAudio } from "../sound";

type Audio = { ctx: AudioContext; out: GainNode };

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
/** Volumen de la música con todo al máximo: moderado, por debajo de las voces. */
const TRACK_VOL = 0.32;
/** Cuánto se programa por adelantado (s) y cada cuánto se revisa (ms). */
const LOOKAHEAD = 0.25;
const TICK_MS = 60;
/** En silencio este tiempo (fuera del club), se deja de programar notas. */
const IDLE_STOP_MS = 3000;

/** Acordes de cada estilo (uno por compás, en loop) y la nota del bajo de cada uno. */
interface Style {
  chords: number[][];
  roots: number[];
  /** Swing de las semicorcheas impares (0 = derecho, 0.33 = tresillo). */
  swing: number;
  play: (m: ClubMusic, step: Step) => void;
}

/** Un paso de semicorchea: dónde cae en el compás, qué acorde suena y cuándo (tiempo del AudioContext). */
interface Step {
  /** Semicorchea dentro del compás (0 a 15) y compás dentro del loop. */
  pos: number;
  bar: number;
  chord: number[];
  root: number;
  t: number;
  /** Duración de una semicorchea (s). */
  sx: number;
}

// ---------- Estilos ----------

const STYLES: Record<ClubTrackId, Style> = {
  // House: bombo en cada tiempo, palmas en 2 y 4, platillo abierto a contratiempo, bajo que empuja en el
  // "y" y acordes cortos sincopados.
  house: {
    chords: [
      [57, 60, 64, 67, 71],
      [53, 57, 60, 64],
      [50, 57, 60, 65],
      [52, 55, 59, 62],
    ],
    roots: [45, 41, 38, 40],
    swing: 0,
    play(m, s) {
      const { pos, t, sx, chord, root, bar } = s;
      if (pos % 4 === 0) m.kick(t, 1);
      if (pos === 4 || pos === 12) m.clap(t, 0.5);
      if (pos % 4 === 2) m.hat(t, 0.16, true);
      else if (pos % 2 === 1) m.hat(t, 0.07, false);
      if (pos % 4 === 2) m.bass(t, root, sx * 1.6, 0.34, "sawtooth", 600);
      if (pos === 14) m.bass(t, root + 12, sx, 0.22, "sawtooth", 800);
      if ([3, 6, 10, 13].includes(pos)) m.stab(t, chord, sx * 1.4, 0.07, "sawtooth", 1900);
      // Cada cuatro compases, un redoble de palmas para cerrar la frase.
      if (bar % 4 === 3 && pos >= 13) m.clap(t, 0.25 + (pos - 13) * 0.08);
    },
  },
  // Reggaetón suave: el dembow (bombo en cada tiempo y el golpe en 3-6-11-14), sub bajo y una marimba.
  reggaeton: {
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 60, 64],
      [55, 59, 62],
    ],
    roots: [45, 41, 48, 43],
    swing: 0,
    play(m, s) {
      const { pos, t, sx, chord, root } = s;
      if (pos % 4 === 0) m.kick(t, 0.85);
      if ([3, 6, 11, 14].includes(pos)) m.snare(t, 0.3, 2400);
      if (pos % 2 === 0) m.hat(t, pos % 4 === 2 ? 0.08 : 0.05, false);
      if (pos === 0 || pos === 8) m.bass(t, root, sx * 3, 0.42, "sine", 300);
      if (pos === 6 || pos === 14) m.bass(t, root, sx * 2, 0.32, "sine", 300);
      // La marimba sube y baja por el acorde.
      const arp = [0, 2, 1, 2, 0, 1, 2, 1];
      if ([0, 2, 3, 5, 8, 10, 11, 13].includes(pos)) m.marimba(t, chord[arp[[0, 2, 3, 5, 8, 10, 11, 13].indexOf(pos)]!]! + 12, 0.14);
      if (pos === 0) m.pad(t, chord, sx * 16, 0.035, 1200);
    },
  },
  // Lofi: batería con swing y apagada, teclado eléctrico cálido y el crujido del vinilo.
  lofi: {
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    roots: [41, 40, 38, 36],
    swing: 0.28,
    play(m, s) {
      const { pos, t, sx, chord, root } = s;
      if (pos === 0 || pos === 7 || pos === 10) m.kick(t, pos === 0 ? 0.8 : 0.55, 0.8);
      if (pos === 4 || pos === 12) m.snare(t, 0.22, 1400);
      if (pos % 2 === 0) m.hat(t, pos % 4 === 0 ? 0.05 : 0.035, false, 5500);
      if (pos === 0) m.keys(t, chord, sx * 15, 0.07);
      if (pos === 10) m.keys(t, chord.slice(1), sx * 5, 0.035);
      if (pos === 0 || pos === 6 || pos === 10) m.bass(t, root, sx * 3, 0.3, "triangle", 500);
      if (pos === 0) m.crackle(t, sx * 16);
    },
  },
  // Disco: bombo en cada tiempo, platillo abierto a contratiempo, bajo en octavas y cuerdas.
  disco: {
    chords: [
      [62, 65, 69, 72],
      [55, 59, 62, 65],
      [60, 64, 67, 71],
      [57, 60, 64, 67],
    ],
    roots: [38, 43, 36, 45],
    swing: 0,
    play(m, s) {
      const { pos, t, sx, chord, root } = s;
      if (pos % 4 === 0) m.kick(t, 0.9);
      if (pos === 4 || pos === 12) m.clap(t, 0.42);
      if (pos % 4 === 2) m.hat(t, 0.15, true);
      else m.hat(t, 0.045, false);
      if (pos % 2 === 0) m.bass(t, root + (pos % 4 === 2 ? 12 : 0), sx * 1.5, 0.3, "square", 900);
      if (pos === 0) m.pad(t, chord, sx * 16, 0.05, 2600);
      if ([2, 6, 10, 14].includes(pos)) m.stab(t, chord.slice(1), sx * 0.8, 0.05, "square", 2400);
    },
  },
  // Synthwave: bombo en 1 y 3, caja grande con reverberación, bajo en corcheas y arpegios de los ochenta.
  synthwave: {
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    roots: [45, 41, 48, 43],
    swing: 0,
    play(m, s) {
      const { pos, t, sx, chord, root } = s;
      if (pos === 0 || pos === 8 || pos === 10) m.kick(t, pos === 10 ? 0.6 : 0.95);
      if (pos === 4 || pos === 12) m.snare(t, 0.4, 1800, true);
      if (pos % 2 === 0) m.hat(t, 0.05, false);
      if (pos % 2 === 0) m.bass(t, root, sx * 1.7, 0.3, "sawtooth", 700);
      const tones = [...chord, chord[0]! + 12];
      m.lead(t, tones[pos % tones.length]! + 12, sx * 0.9, 0.05);
      if (pos === 0) m.pad(t, chord, sx * 16, 0.045, 1500);
    },
  },
};

// ---------- El motor ----------

export class ClubMusic {
  private bus: GainNode;
  private drums: GainNode;
  private reverbSend: GainNode;
  private delaySend: GainNode;
  private delay: DelayNode;
  private noiseBuf: AudioBuffer;
  private crackleBuf: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: ClubTrack | null = null;
  private style: Style | null = null;
  private startedAt = 0;
  private nextStep = 0;
  private level = 0;
  private quietSince = 0;

  constructor(
    private readonly a: Audio,
    /** Hora del servidor ahora (ms). */
    private readonly now: () => number,
  ) {
    const { ctx } = a;
    // Todo pasa por un compresor suave: los golpes no saltan por encima de lo demás.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(comp).connect(a.out);
    this.drums = ctx.createGain();
    this.drums.gain.value = 0.9;
    this.drums.connect(this.bus);
    // Reverberación con una respuesta de ruido que se apaga, y un eco para los arpegios.
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(verb).connect(this.bus);
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2400;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.3;
    this.delaySend.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(this.bus);
    this.delay = delay;
    this.noiseBuf = this.makeNoise(1);
    this.crackleBuf = this.makeCrackle(4);
  }

  /** Qué suena (o nada) y desde cuándo, según el servidor. */
  setSong(id: string, startedAt: number, playing: boolean) {
    const track = playing ? (clubTrack(id) ?? null) : null;
    if (track?.id === this.track?.id && startedAt === this.startedAt) return;
    this.track = track;
    this.style = track ? STYLES[track.id] : null;
    this.startedAt = startedAt;
    this.nextStep = -1;
    if (track) this.delay.delayTime.value = (60 / track.bpm) * 0.75;
    if (!track) this.bus.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.08);
    else this.applyLevel();
  }

  /** Volumen de 0 a 1 (dentro del club por el volumen propio); se funde hacia él. */
  setLevel(v: number) {
    if (Math.abs(v - this.level) < 0.001) return;
    this.level = v;
    this.applyLevel();
  }

  private applyLevel() {
    if (!this.track) return;
    this.bus.gain.setTargetAtTime(this.level * TRACK_VOL, this.a.ctx.currentTime, 0.6);
    if (this.level > 0.001) {
      this.quietSince = 0;
      this.start();
    }
  }

  /** Cada tanto, desde la escena: para de programar si hace rato que no se oye. */
  update() {
    if (!this.timer) return;
    if (this.level > 0.001 && this.track) return;
    const now = performance.now();
    if (!this.quietSince) this.quietSince = now;
    else if (now - this.quietSince > IDLE_STOP_MS) this.stop();
  }

  private start() {
    if (this.timer) return;
    this.nextStep = -1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.quietSince = 0;
  }

  dispose() {
    this.stop();
    this.bus.gain.setTargetAtTime(0, this.a.ctx.currentTime, 0.05);
    const bus = this.bus;
    setTimeout(() => bus.disconnect(), 400);
  }

  private schedule() {
    const track = this.track;
    const style = this.style;
    if (!track || !style) return;
    const { ctx } = this.a;
    const stepMs = 60_000 / track.bpm / 4;
    const serverNow = this.now();
    const ctxNow = ctx.currentTime;
    const at = (n: number) => ctxNow + (this.startedAt + n * stepMs - serverNow) / 1000;
    // Al arrancar (o volver a entrar) se sigue desde la semicorchea que viene.
    if (this.nextStep < 0) this.nextStep = Math.max(0, Math.ceil((serverNow - this.startedAt) / stepMs));
    const loop = track.bars * 16;
    while (at(this.nextStep) < ctxNow + LOOKAHEAD) {
      const n = this.nextStep++;
      let t = at(n);
      if (t < ctxNow - 0.05) continue; // atrasado (la pestaña estuvo en segundo plano): se salta
      t = Math.max(t, ctxNow + 0.005);
      const s = n % loop;
      const pos = s % 16;
      const bar = Math.floor(s / 16);
      const k = bar % style.chords.length;
      if (style.swing && pos % 2 === 1) t += (stepMs / 1000) * style.swing;
      style.play(this, { pos, bar, chord: style.chords[k]!, root: style.roots[k]!, t, sx: stepMs / 1000 });
    }
  }

  // ---------- Instrumentos ----------

  private env(t: number, peak: number, attack: number, decay: number, dest: AudioNode = this.bus) {
    const g = this.a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, len: number, dest: AudioNode, detune = 0) {
    const o = this.a.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  private noise(t: number, len: number, dest: AudioNode) {
    const src = this.a.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.connect(dest);
    // Cada golpe arranca en otro punto del ruido, para que no suenen todos iguales.
    src.start(t, Math.random() * 0.5, len + 0.05);
  }

  private filter(type: BiquadFilterType, freq: number, dest: AudioNode, q = 0.8) {
    const f = this.a.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  /** Bombo: seno que baja de golpe, con un clic de ataque. */
  kick(t: number, vol: number, tone = 1) {
    const g = this.env(t, vol * 0.9, 0.003, 0.32, this.drums);
    const o = this.osc("sine", 150 * tone, t, 0.35, g);
    o.frequency.setValueAtTime(150 * tone, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    const click = this.env(t, vol * 0.12, 0.001, 0.02, this.drums);
    this.noise(t, 0.03, this.filter("highpass", 3000, click));
  }

  /** Caja: ruido con un cuerpo de triángulo; `big` la manda a la reverberación. */
  snare(t: number, vol: number, freq: number, big = false) {
    const g = this.env(t, vol, 0.002, big ? 0.28 : 0.16, this.drums);
    this.noise(t, 0.3, this.filter("bandpass", freq, g, 0.9));
    const body = this.env(t, vol * 0.5, 0.002, 0.08, this.drums);
    this.osc("triangle", 190, t, 0.1, body);
    if (big) {
      const send = this.env(t, vol * 0.7, 0.002, 0.3, this.reverbSend);
      this.noise(t, 0.3, this.filter("bandpass", freq, send));
    }
  }

  /** Palmas: tres ráfagas de ruido muy seguidas y una cola a la reverberación. */
  clap(t: number, vol: number) {
    for (const [k, dt] of [0, 0.011, 0.023].entries()) {
      const g = this.env(t + dt, vol * (k === 2 ? 1 : 0.6), 0.001, k === 2 ? 0.16 : 0.02, this.drums);
      this.noise(t + dt, 0.2, this.filter("bandpass", 1300, g, 1.2));
    }
    const send = this.env(t, vol * 0.4, 0.002, 0.2, this.reverbSend);
    this.noise(t, 0.22, this.filter("bandpass", 1300, send));
  }

  /** Platillo cerrado o abierto. */
  hat(t: number, vol: number, open: boolean, freq = 7500) {
    const g = this.env(t, vol, 0.001, open ? 0.22 : 0.04, this.drums);
    this.noise(t, open ? 0.25 : 0.06, this.filter("highpass", freq, g));
  }

  /** Bajo: un oscilador con el filtro que se abre al golpe y se cierra. */
  bass(t: number, note: number, len: number, vol: number, type: OscillatorType, cutoff: number) {
    const g = this.env(t, vol, 0.005, len, this.bus);
    const f = this.filter("lowpass", cutoff, g, 2);
    f.frequency.setValueAtTime(cutoff * 2.2, t);
    f.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(0.15, len));
    this.osc(type, midi(note), t, len, f);
  }

  /** Acorde corto (house, disco): dos osciladores desafinados por nota. */
  stab(t: number, notes: number[], len: number, vol: number, type: OscillatorType, cutoff: number) {
    const g = this.env(t, vol, 0.004, len, this.bus);
    const f = this.filter("lowpass", cutoff, g);
    for (const n of notes) {
      this.osc(type, midi(n), t, len, f, -7);
      this.osc(type, midi(n), t, len, f, 7);
    }
    const send = this.env(t, vol * 0.4, 0.004, len, this.reverbSend);
    for (const n of notes) this.osc("triangle", midi(n), t, len, send);
  }

  /** Colchón de acordes: entra despacio y dura el compás. */
  pad(t: number, notes: number[], len: number, vol: number, cutoff: number) {
    const g = this.a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.3);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + len * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    g.connect(this.bus);
    const f = this.filter("lowpass", cutoff, g);
    for (const n of notes) {
      this.osc("sawtooth", midi(n), t, len, f, -9);
      this.osc("sawtooth", midi(n), t, len, f, 9);
    }
  }

  /** Marimba: seno con un parcial agudo que se apaga enseguida. */
  marimba(t: number, note: number, vol: number) {
    const g = this.env(t, vol, 0.002, 0.35, this.bus);
    this.osc("sine", midi(note), t, 0.4, g);
    const hi = this.env(t, vol * 0.35, 0.001, 0.06, this.bus);
    this.osc("sine", midi(note) * 4, t, 0.08, hi);
    const send = this.env(t, vol * 0.3, 0.002, 0.3, this.reverbSend);
    this.osc("sine", midi(note), t, 0.35, send);
  }

  /** Teclado eléctrico del lofi: seno y triángulo con un vibrato leve, algo desafinado como una cinta. */
  keys(t: number, notes: number[], len: number, vol: number) {
    const g = this.env(t, vol, 0.02, len, this.bus);
    const f = this.filter("lowpass", 2200, g);
    const lfo = this.a.ctx.createOscillator();
    lfo.frequency.value = 4.5;
    const depth = this.a.ctx.createGain();
    depth.gain.value = 5;
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(t + len + 0.05);
    for (const n of notes) {
      const drift = (Math.random() - 0.5) * 10;
      depth.connect(this.osc("sine", midi(n), t, len, f, drift).detune);
      this.osc("triangle", midi(n), t, len, f, drift + 3);
    }
  }

  /** Arpegio del synthwave: diente de sierra filtrado con eco. */
  lead(t: number, note: number, len: number, vol: number) {
    const g = this.env(t, vol, 0.004, len, this.bus);
    const f = this.filter("lowpass", 2600, g, 3);
    this.osc("sawtooth", midi(note), t, len, f);
    const send = this.env(t, vol * 0.8, 0.004, len, this.delaySend);
    this.osc("sawtooth", midi(note), t, len, this.filter("lowpass", 2000, send));
  }

  /** Crujido del vinilo durante `len` segundos. */
  crackle(t: number, len: number) {
    const src = this.a.ctx.createBufferSource();
    src.buffer = this.crackleBuf;
    const g = this.a.ctx.createGain();
    g.gain.value = 0.9;
    src.connect(this.filter("lowpass", 4500, g));
    g.connect(this.bus);
    src.start(t, 0, Math.min(len, this.crackleBuf.duration));
  }

  // ---------- Buffers ----------

  private makeNoise(seconds: number) {
    const { ctx } = this.a;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeCrackle(seconds: number) {
    const { ctx } = this.a;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.01 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.4 : 0);
    return buf;
  }

  private impulse(seconds: number) {
    const { ctx } = this.a;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }
}

let music: ClubMusic | null = null;

/**
 * La música del club con el volumen dado (0 = no se oye). Se crea recién cuando hace falta que suene:
 * el navegador solo deja sonar después de que la persona tocó algo.
 */
export function clubMusic(now: () => number, create: boolean): ClubMusic | null {
  if (music || !create) return music;
  const a = sharedAudio();
  if (!a) return null;
  music = new ClubMusic(a, now);
  return music;
}

/** Al salir de la cabaña: se apaga y se suelta. */
export function disposeClubMusic() {
  music?.dispose();
  music = null;
}
