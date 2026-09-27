// Sonidos de los muebles que se usan, generados con WebAudio (sin archivos de audio): el piano, la
// guitarra (cuerdas pulsadas con Karplus-Strong), el ronroneo del gato y un lofi para el tocadiscos.
// El navegador solo deja sonar después de que la persona tocó algo: el contexto se crea recién al usarlo.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Si el navegador lo dejó suspendido, se reanuda con la próxima tecla o clic.
    const resume = () => void ctx?.resume().catch(() => undefined);
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return { ctx, out: master! };
}

/** El contexto de audio compartido (lo usan los efectos de sfx.ts, la pesca y la música del club). */
export const sharedAudio = audio;

/** Generador pseudoaleatorio con semilla: todos oyen la misma melodía. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
/** Pentatónica de do (suena bien en cualquier orden). */
const PENTA = [0, 2, 4, 7, 9];

// ---------- Piano ----------

function pianoNote(a: { ctx: AudioContext; out: GainNode }, note: number, at: number, vol: number, len = 1.4) {
  const { ctx } = a;
  const f = midi(note);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(vol, at + 0.008);
  env.gain.exponentialRampToValueAtTime(vol * 0.35, at + 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, at + len);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = Math.min(6000, f * 6);
  env.connect(tone).connect(a.out);
  // Fundamental más dos armónicos suaves: un piano de juguete, cálido.
  for (const [mult, gain, type] of [
    [1, 1, "triangle"],
    [2, 0.35, "sine"],
    [3, 0.12, "sine"],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f * mult;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g).connect(env);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }
}

/** Una frase corta de piano (unos 2,4 s) con la semilla del servidor. `vol` según la distancia. */
export function playPiano(seed: number, vol: number) {
  const a = audio();
  if (!a || vol <= 0.01) return;
  const r = rng(seed);
  const t0 = a.ctx.currentTime + 0.03;
  const root = 60 + [0, 5, 7, -3][Math.floor(r() * 4)]!;
  // Acorde de base y la melodía encima, con ritmo de corcheas y alguna negra.
  for (const k of [0, 4, 7]) pianoNote(a, root - 12 + k, t0, 0.12 * vol, 2.2);
  let t = t0;
  let step = Math.floor(r() * 5);
  for (let i = 0; i < 8; i++) {
    step = Math.max(0, Math.min(9, step + Math.floor(r() * 5) - 2));
    const note = root + 12 * Math.floor(step / 5) + PENTA[step % 5]!;
    pianoNote(a, note, t, (0.22 + r() * 0.08) * vol);
    t += r() < 0.3 ? 0.4 : 0.22;
  }
}

// ---------- Guitarra ----------

const pluckCache = new Map<string, AudioBuffer>();

/** Cuerda pulsada (Karplus-Strong): ruido que pasa por un retardo con un filtro que lo apaga de a poco. */
function pluck(ctx: AudioContext, freq: number): AudioBuffer {
  const key = `${ctx.sampleRate}:${freq.toFixed(2)}`;
  const cached = pluckCache.get(key);
  if (cached) return cached;
  const len = Math.floor(ctx.sampleRate * 1.6);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const period = Math.max(2, Math.round(ctx.sampleRate / freq));
  const line = new Float32Array(period);
  const r = rng(Math.round(freq * 100));
  for (let i = 0; i < period; i++) line[i] = r() * 2 - 1;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const k = i % period;
    const v = line[k]!;
    line[k] = 0.996 * 0.5 * (v + prev);
    prev = v;
    d[i] = v;
  }
  pluckCache.set(key, buf);
  return buf;
}

const CHORDS: number[][] = [
  [43, 47, 50, 55, 59, 67], // sol
  [48, 52, 55, 60, 64], // do
  [50, 57, 62, 66], // re
  [40, 47, 52, 55, 59, 64], // mi menor
];

function strum(a: { ctx: AudioContext; out: GainNode }, chord: number[], at: number, vol: number, up: boolean) {
  const notes = up ? [...chord].reverse().slice(0, 4) : chord;
  notes.forEach((n, i) => {
    const src = a.ctx.createBufferSource();
    src.buffer = pluck(a.ctx, midi(n));
    const g = a.ctx.createGain();
    g.gain.value = vol * (up ? 0.6 : 1) * 0.35;
    src.connect(g).connect(a.out);
    src.start(at + i * 0.014);
  });
}

/** Rasgueo de guitarra: dos acordes con ritmo abajo-abajo-arriba (unos 2,4 s). */
export function playGuitar(seed: number, vol: number) {
  const a = audio();
  if (!a || vol <= 0.01) return;
  const r = rng(seed);
  const t0 = a.ctx.currentTime + 0.03;
  const first = Math.floor(r() * CHORDS.length);
  const pattern: [number, boolean][] = [
    [0, false],
    [0.3, false],
    [0.45, true],
    [0.6, false],
  ];
  [first, (first + 1 + Math.floor(r() * 3)) % CHORDS.length].forEach((c, bar) => {
    for (const [dt, up] of pattern) strum(a, CHORDS[c]!, t0 + bar * 1.2 + dt, vol, up);
  });
}

// ---------- Gato ----------

/** Ronroneo: ruido grave que late unas 25 veces por segundo, durante un segundo y medio. */
export function playPurr(vol: number) {
  const a = audio();
  if (!a || vol <= 0.01) return;
  const { ctx } = a;
  const t0 = ctx.currentTime + 0.02;
  const len = 1.5;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < d.length; i++) {
    brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    const t = i / ctx.sampleRate;
    const beat = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 24);
    const fade = Math.min(1, t * 6, (len - t) * 3);
    d[i] = brown * 3.5 * beat * fade;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.value = 0.9 * vol;
  src.connect(lp).connect(g).connect(a.out);
  src.start(t0);
}

// ---------- Tocadiscos: lofi ----------

/** Progresión de séptimas (fa, mi menor, re menor, do) a 72 bpm, con bombo, caja y el crujido del vinilo. */
const LOFI = {
  bpm: 72,
  chords: [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ],
};

class Lofi {
  private gain: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private crackle: AudioBufferSourceNode | null = null;

  constructor(private readonly a: { ctx: AudioContext; out: GainNode }) {
    this.gain = a.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(a.out);
  }

  start() {
    if (this.timer) return;
    const { ctx } = this.a;
    this.nextBeat = ctx.currentTime + 0.1;
    this.beat = 0;
    // Programa los golpes con un poco de anticipación (un setInterval no es preciso).
    this.timer = setInterval(() => this.schedule(), 100);
    this.startCrackle();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.crackle?.stop();
    this.crackle = null;
  }

  setVolume(v: number) {
    this.gain.gain.setTargetAtTime(v, this.a.ctx.currentTime, 0.25);
  }

  private schedule() {
    const { ctx } = this.a;
    const spb = 60 / LOFI.bpm;
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat;
      const b = this.beat;
      const chord = LOFI.chords[Math.floor(b / 4) % LOFI.chords.length]!;
      if (b % 4 === 0) chord.forEach((n) => this.keys(n, t, spb * 3.8));
      // Bombo en 1 y el "y" del 3, caja en 2 y 4, y un bajo suave.
      if (b % 4 === 0 || b % 4 === 2) this.kick(t + (b % 4 === 2 ? spb / 2 : 0));
      if (b % 2 === 1) this.snare(t);
      this.hat(t + spb * 0.55);
      if (b % 2 === 0) this.bass(chord[0]! - 12, t, spb * 1.6);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  private keys(n: number, t: number, len: number) {
    const { ctx } = this.a;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midi(n);
    osc.detune.value = (Math.random() - 0.5) * 12; // un poco desafinado, como una cinta vieja
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  private bass(n: number, t: number, len: number) {
    const { ctx } = this.a;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = midi(n);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + len);
  }

  private kick(t: number) {
    const { ctx } = this.a;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g).connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private noise(t: number, len: number, freq: number, vol: number, type: BiquadFilterType) {
    const { ctx } = this.a;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.gain);
    src.start(t);
  }

  private snare(t: number) {
    this.noise(t, 0.18, 1800, 0.12, "bandpass");
  }

  private hat(t: number) {
    this.noise(t, 0.05, 7000, 0.035, "highpass");
  }

  /** El crujido del vinilo: chasquidos sueltos sobre un siseo muy bajo, en un bucle de 4 s. */
  private startCrackle() {
    const { ctx } = this.a;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.5 : 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4500;
    src.connect(lp).connect(this.gain);
    src.start();
    this.crackle = src;
  }
}

let lofi: Lofi | null = null;

/** Umbrales del tocadiscos: arranca por encima de uno y se calla por debajo del otro (histéresis). */
const LOFI_START = 0.03;
const LOFI_QUIET = 0.01;
/** Cuánto sigue viva la música en silencio antes de pararla: caminar por el borde no la corta y la arranca. */
const LOFI_GRACE_MS = 4000;
let lofiQuietSince = 0;

/**
 * Música del tocadiscos al volumen dado (0 = apagada). La escena la llama seguido con el volumen del
 * tocadiscos prendido que mejor se oye desde tu lugar.
 */
export function setRecordMusic(vol: number) {
  if (!lofi) {
    if (vol <= LOFI_START) return;
    const a = audio();
    if (!a) return;
    lofi = new Lofi(a);
    lofi.start();
  }
  if (vol > LOFI_QUIET) {
    lofiQuietSince = 0;
    lofi.setVolume(vol * 0.8);
    return;
  }
  lofi.setVolume(0);
  const now = performance.now();
  if (!lofiQuietSince) lofiQuietSince = now;
  else if (now - lofiQuietSince > LOFI_GRACE_MS) stopRecordMusic();
}

/** Para la música del tocadiscos ya (al salir de la cabaña). */
export function stopRecordMusic() {
  lofiQuietSince = 0;
  if (!lofi) return;
  lofi.setVolume(0);
  const current = lofi;
  lofi = null;
  // Espera a que baje el volumen para no cortar en seco.
  setTimeout(() => current.stop(), 800);
}

/** Volumen según la distancia (px de mundo): pleno cerca, nada a partir de `reach`. */
export function volumeAt(dist: number, reach: number) {
  const t = Math.max(0, 1 - dist / reach);
  return t * t;
}

/** El contexto de audio compartido (casa viva: casaSonidos.ts suma sus sonidos a la misma salida). */
export const audioOut = audio;
