// Casa viva: los sonidos cortos de los muebles chicos y de las mascotas, generados con WebAudio (sin
// archivos), más dos que siguen sonando: el crepitar del fuego y la música de la radio. Salen por el
// mezclador: los cortos como efectos, el fuego como ambiente y la radio como música. `vol` según la
// distancia (0..1).
import { audioOut } from "./sound";

type Out = NonNullable<ReturnType<typeof audioOut>>;

/** Ruido filtrado con envolvente: la base de casi todo (agua, papel, tiza, puertas). */
function noise(a: Out, t: number, len: number, o: { type: BiquadFilterType; freq: number; freqEnd?: number; q?: number; vol: number; attack?: number }) {
  const { ctx } = a;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const attack = o.attack ?? 0.01;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

/** Un tono con barrido de frecuencia (clics, burbujas, maullidos). */
function tone(a: Out, t: number, len: number, o: { freq: number; freqEnd?: number; type?: OscillatorType; vol: number; attack?: number }) {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** Corre `play` si hay audio y se oye: le pasa la salida y el momento de arranque. */
function at(vol: number, play: (a: Out, t: number) => void) {
  if (vol <= 0.01) return;
  const a = audioOut("effects");
  if (!a) return;
  play(a, a.ctx.currentTime + 0.02);
}

// ---------- Muebles ----------

/** El interruptor de una lámpara o un farol. */
export const playSwitch = (vol: number) =>
  at(vol, (a, t) => {
    tone(a, t, 0.04, { freq: 2400, freqEnd: 900, type: "square", vol: 0.05 * vol });
    noise(a, t, 0.03, { type: "highpass", freq: 3000, vol: 0.08 * vol });
  });

/** La cortina corriéndose por la barra. */
export const playCurtain = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.55, { type: "bandpass", freq: 2200, freqEnd: 900, q: 0.8, vol: 0.12 * vol, attack: 0.12 });
    for (let k = 0; k < 4; k++) tone(a, t + k * 0.1, 0.03, { freq: 1800 + k * 120, type: "triangle", vol: 0.025 * vol });
  });

/** La tele al prenderse (el zumbido que sube) o al apagarse. */
export const playTv = (vol: number, on: boolean) =>
  at(vol, (a, t) => {
    if (on) {
      tone(a, t, 0.35, { freq: 7000, freqEnd: 15000, vol: 0.02 * vol });
      noise(a, t + 0.05, 0.4, { type: "bandpass", freq: 3000, q: 0.5, vol: 0.08 * vol });
    } else tone(a, t, 0.18, { freq: 900, freqEnd: 120, type: "triangle", vol: 0.08 * vol });
  });

/** Pasar la página de un libro. */
export const playPage = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.22, { type: "bandpass", freq: 3500, freqEnd: 1800, q: 0.7, vol: 0.14 * vol, attack: 0.05 });
    noise(a, t + 0.35, 0.18, { type: "bandpass", freq: 3000, freqEnd: 1600, q: 0.7, vol: 0.1 * vol, attack: 0.04 });
  });

/** El globo girando: el eje que chirría y va frenando. */
export const playGlobe = (vol: number) =>
  at(vol, (a, t) => {
    let dt = 0;
    for (let k = 0; k < 12; k++) {
      tone(a, t + dt, 0.025, { freq: 1300 - k * 30, type: "triangle", vol: 0.035 * vol });
      dt += 0.05 + k * 0.012;
    }
    noise(a, t, dt, { type: "bandpass", freq: 600, q: 2, vol: 0.05 * vol, attack: 0.05 });
  });

/** Avivar el fuego: un soplo grave que sube y un par de chasquidos. */
export const playWhoosh = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.9, { type: "lowpass", freq: 300, freqEnd: 1400, vol: 0.35 * vol, attack: 0.25 });
    for (const dt of [0.3, 0.55, 0.7]) noise(a, t + dt, 0.03, { type: "highpass", freq: 2000, vol: 0.2 * vol });
  });

/** Agua que cae (regar, abrir la llave): ruido filtrado con un gorgoteo. */
function water(a: Out, t: number, len: number, vol: number) {
  noise(a, t, len, { type: "bandpass", freq: 1400, q: 0.6, vol: 0.12 * vol, attack: 0.12 });
  for (let k = 0; k < len * 9; k++) tone(a, t + k / 9 + Math.random() * 0.05, 0.05, { freq: 500 + Math.random() * 500, freqEnd: 900 + Math.random() * 700, vol: 0.03 * vol });
}

export const playWater = (vol: number) => at(vol, (a, t) => water(a, t, 1.6, vol));

/** Lavarse las manos: el agua y burbujas que revientan. */
export const playWash = (vol: number) =>
  at(vol, (a, t) => {
    water(a, t, 1.9, vol);
    for (let k = 0; k < 6; k++) tone(a, t + 0.5 + k * 0.22 + Math.random() * 0.08, 0.04, { freq: 1600 + Math.random() * 900, freqEnd: 2600, vol: 0.05 * vol });
  });

/** La nevera: la puerta que despega el sello, el zumbido de adentro y el vidrio. */
export const playFridge = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.12, { type: "lowpass", freq: 500, vol: 0.3 * vol });
    tone(a, t + 0.05, 0.5, { freq: 110, type: "sawtooth", vol: 0.02 * vol, attack: 0.1 });
    tone(a, t + 0.45, 0.25, { freq: 3100, vol: 0.05 * vol });
    tone(a, t + 0.48, 0.2, { freq: 4200, vol: 0.03 * vol });
  });

/** Servir un tinto de la cafetera: el chorro y el borboteo. */
export const playCoffee = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 1.1, { type: "bandpass", freq: 900, q: 1.2, vol: 0.1 * vol, attack: 0.08 });
    for (let k = 0; k < 7; k++) tone(a, t + k * 0.14, 0.06, { freq: 300 + Math.random() * 200, freqEnd: 700, vol: 0.04 * vol });
    tone(a, t + 1.15, 0.05, { freq: 1800, type: "triangle", vol: 0.04 * vol });
  });

/** Una pieza de ajedrez apoyada en el tablero. */
export const playClack = (vol: number) =>
  at(vol, (a, t) => {
    tone(a, t, 0.08, { freq: 900, freqEnd: 500, type: "triangle", vol: 0.12 * vol });
    noise(a, t, 0.04, { type: "bandpass", freq: 2500, q: 2, vol: 0.12 * vol });
  });

/** Una pieza de puzle que encaja. */
export const playSnap = (vol: number) =>
  at(vol, (a, t) => {
    noise(a, t, 0.05, { type: "highpass", freq: 1800, vol: 0.14 * vol });
    tone(a, t + 0.05, 0.12, { freq: 660, freqEnd: 990, type: "triangle", vol: 0.06 * vol });
  });

/** Tiza (o pincel) sobre la pizarra: trazos cortos de ruido agudo. */
export const playChalk = (vol: number, brush = false) =>
  at(vol, (a, t) => {
    for (let k = 0; k < 4; k++)
      noise(a, t + k * 0.16, 0.12, { type: brush ? "bandpass" : "highpass", freq: brush ? 1200 : 3800, q: 0.6, vol: (brush ? 0.08 : 0.07) * vol, attack: 0.03 });
  });

/** La puerta del cubículo: bisagra y el pestillo. */
export const playStall = (vol: number) =>
  at(vol, (a, t) => {
    tone(a, t, 0.3, { freq: 380, freqEnd: 520, type: "sawtooth", vol: 0.018 * vol, attack: 0.08 });
    noise(a, t + 0.3, 0.08, { type: "lowpass", freq: 700, vol: 0.25 * vol });
    tone(a, t + 0.42, 0.04, { freq: 1900, type: "square", vol: 0.04 * vol });
  });

/** El malvavisco chisporroteando sobre el fuego. */
export const playSizzle = (vol: number, len = 3.4) =>
  at(vol, (a, t) => {
    noise(a, t, len, { type: "highpass", freq: 4000, vol: 0.05 * vol, attack: 0.4 });
    for (let k = 0; k < len * 5; k++) noise(a, t + Math.random() * len, 0.02, { type: "highpass", freq: 2500, vol: 0.08 * vol });
  });

/** Algo gratis a la mano (la manzana, el malvavisco listo): un "tin" alegre. */
export const playGot = (vol: number) =>
  at(vol, (a, t) => {
    tone(a, t, 0.12, { freq: 880, type: "triangle", vol: 0.06 * vol });
    tone(a, t + 0.09, 0.2, { freq: 1320, type: "triangle", vol: 0.05 * vol });
  });

// ---------- Mascotas ----------

/** Maullido: un tono que sube y baja con un filtro que se abre (la "a" de miau). */
export const playMeow = (vol: number, happy = false) =>
  at(vol, (a, t) => {
    const { ctx } = a;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const base = happy ? 620 : 520;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.45, t + 0.18);
    osc.frequency.linearRampToValueAtTime(base * 0.9, t + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1600, t + 0.2);
    f.frequency.linearRampToValueAtTime(900, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 * vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    osc.connect(f).connect(g).connect(a.out);
    osc.start(t);
    osc.stop(t + 0.6);
  });

/** Ladrido: un golpe grave con ruido, dos veces si está contento. */
export const playWoof = (vol: number, twice = false) =>
  at(vol, (a, t) => {
    for (const dt of twice ? [0, 0.22] : [0]) {
      tone(a, t + dt, 0.16, { freq: 320, freqEnd: 150, type: "sawtooth", vol: 0.12 * vol });
      noise(a, t + dt, 0.12, { type: "bandpass", freq: 900, freqEnd: 400, q: 1.5, vol: 0.18 * vol });
    }
  });

/** Comiendo el premio: mordiscos chiquitos. */
export const playMunch = (vol: number) =>
  at(vol, (a, t) => {
    for (let k = 0; k < 6; k++) noise(a, t + k * 0.28, 0.06, { type: "bandpass", freq: 1500 + Math.random() * 800, q: 1.2, vol: 0.14 * vol });
  });

// ---------- Lo que sigue sonando ----------

/** Crepitar del fuego: un rumor grave en bucle con chasquidos sueltos. */
class Crackle {
  private gain: GainNode;
  private src: AudioBufferSourceNode;

  constructor(a: Out) {
    const { ctx } = a;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let brown = 0;
    let pop = 0;
    for (let i = 0; i < len; i++) {
      brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      if (Math.random() < 0.0009) pop = 0.5 + Math.random() * 0.5;
      pop *= 0.992;
      d[i] = brown * 1.6 + (Math.random() * 2 - 1) * pop * 0.6;
    }
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 3200;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(f).connect(this.gain).connect(a.out);
    this.src.start();
  }

  setVolume(v: number, ctx: AudioContext) {
    this.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  }

  stop() {
    this.src.stop();
  }
}

let crackle: Crackle | null = null;

/** El fuego al volumen dado (0 = no se oye): la escena lo llama seguido con la fogata o chimenea más cercana. */
export function setFireCrackle(vol: number) {
  const a = crackle || vol > 0.02 ? audioOut("ambient") : null;
  if (!a) return;
  if (!crackle) crackle = new Crackle(a);
  crackle.setVolume(vol * 0.5, a.ctx);
}

export function stopFireCrackle() {
  const c = crackle;
  crackle = null;
  const a = audioOut("ambient");
  if (c && a) {
    c.setVolume(0, a.ctx);
    setTimeout(() => c.stop(), 700);
  }
}

/**
 * La radio: una cumbia chiquita (acordes de guitarra, bajo, güiro y una melodía) por un parlante chico
 * (filtro de banda: suena "de radio"). A 96 bpm, con la progresión la menor, sol, fa, mi.
 */
class Radio {
  private gain: GainNode;
  private bus: BiquadFilterNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private static CHORDS = [
    [57, 60, 64],
    [55, 59, 62],
    [53, 57, 60],
    [52, 56, 59],
  ];

  constructor(private readonly a: Out) {
    const { ctx } = a;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.bus = ctx.createBiquadFilter();
    this.bus.type = "bandpass";
    this.bus.frequency.value = 1300;
    this.bus.Q.value = 0.5;
    this.bus.connect(this.gain).connect(a.out);
  }

  start() {
    if (this.timer) return;
    this.next = this.a.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(v: number) {
    this.gain.gain.setTargetAtTime(v, this.a.ctx.currentTime, 0.25);
  }

  private note(n: number, t: number, len: number, type: OscillatorType, vol: number) {
    const { ctx } = this.a;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((n - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + len + 0.02);
  }

  private scrape(t: number) {
    const { ctx } = this.a;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.floor(i / 180) % 2 ? 1 : 0.3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(g).connect(this.bus);
    src.start(t);
  }

  private schedule() {
    const eighth = 60 / 96 / 2;
    // Con la pestaña en segundo plano el intervalo se frena: al volver no se agenda lo atrasado (sería
    // una ráfaga de notas a la vez), se sigue desde ahora.
    if (this.next < this.a.ctx.currentTime) this.next = this.a.ctx.currentTime + 0.05;
    while (this.next < this.a.ctx.currentTime + 0.4) {
      const t = this.next;
      const s = this.step;
      const chord = Radio.CHORDS[Math.floor(s / 8) % 4]!;
      // Bajo en 1 y 3 (tónica y quinta), güiro en cada corchea, acorde en los contratiempos.
      if (s % 4 === 0) this.note(chord[0]! - 12, t, eighth * 1.8, "triangle", 0.18);
      if (s % 4 === 2) this.note(chord[2]! - 24, t, eighth * 1.5, "triangle", 0.14);
      if (s % 2 === 1) for (const n of chord) this.note(n, t, eighth * 0.8, "square", 0.025);
      this.scrape(t);
      // Una melodía que se repite cada dos compases.
      const melody = [76, 0, 74, 72, 0, 72, 74, 0, 72, 0, 71, 69, 0, 71, 72, 0];
      const m = melody[s % 16]!;
      if (m) this.note(m, t, eighth * 1.4, "square", 0.035);
      this.next += eighth;
      this.step++;
    }
  }
}

let radio: Radio | null = null;
let radioQuietSince = 0;

/** La radio prendida que mejor se oye, al volumen dado (0 = apagada o lejos). */
export function setRadioMusic(vol: number) {
  if (!radio) {
    if (vol <= 0.03) return;
    const a = audioOut("music");
    if (!a) return;
    radio = new Radio(a);
    radio.start();
  }
  if (vol > 0.01) {
    radioQuietSince = 0;
    radio.setVolume(vol * 0.7);
    return;
  }
  radio.setVolume(0);
  const now = performance.now();
  if (!radioQuietSince) radioQuietSince = now;
  else if (now - radioQuietSince > 4000) stopRadioMusic();
}

export function stopRadioMusic() {
  radioQuietSince = 0;
  const r = radio;
  radio = null;
  if (!r) return;
  r.setVolume(0);
  setTimeout(() => r.stop(), 800);
}

// Con la pestaña oculta la escena deja de actualizar los volúmenes: la radio y el fuego se callan (y
// al volver la escena los sube otra vez al volumen que toque).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    stopRadioMusic();
    const a = crackle ? audioOut("ambient") : null;
    if (a) crackle!.setVolume(0, a.ctx);
  });
}
