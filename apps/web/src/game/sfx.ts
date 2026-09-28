// Efectos de sonido del juego, sintetizados con WebAudio (sin archivos): bleeps suaves y ruidos filtrados
// cortos, estilo pixel. Usan el mismo AudioContext que los muebles (sound.ts) pero pasan por su propio
// volumen, que se elige en el HUD y se guarda en el navegador. Lo que hace otra persona se oye solo si
// está en tu nivel (los avatares de otros niveles están ocultos) y más bajo cuanto más lejos.
import { surfaceAt, type OfficeMap, type StepSurface } from "@hyvento/map";
import { SoundGate } from "@hyvento/shared";
import { sharedAudio, volumeAt } from "./sound";

// ---------- Ajustes (volumen y silencio) ----------

export interface SfxSettings {
  /** 0 a 1. */
  volume: number;
  muted: boolean;
}

const STORAGE_KEY = "hyvento:sfx";
const DEFAULTS: SfxSettings = { volume: 0.7, muted: false };

function loadSettings(): SfxSettings {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<SfxSettings>;
    const volume = typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.min(1, Math.max(0, v.volume)) : DEFAULTS.volume;
    return { volume, muted: v.muted === true };
  } catch {
    return { ...DEFAULTS };
  }
}

let settings: SfxSettings | null = null;
const settingsListeners = new Set<(s: SfxSettings) => void>();

export function getSfxSettings(): SfxSettings {
  settings ??= loadSettings();
  return settings;
}

export function setSfxSettings(patch: Partial<SfxSettings>) {
  settings = { ...getSfxSettings(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento (incógnito, bloqueado): vale solo por esta visita.
  }
  if (bus) bus.gain.value = busGain();
  for (const fn of settingsListeners) fn(settings);
}

export function subscribeSfx(fn: (s: SfxSettings) => void): () => void {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}

// ---------- Salida ----------

/** Volumen general de los efectos (por debajo de la música de los muebles: que acompañen, no tapen). */
const BASE_GAIN = 0.55;
let bus: GainNode | null = null;
let busCtx: AudioContext | null = null;

/** El volumen elegido se aplica al cuadrado: la mitad del control suena a "la mitad". */
const busGain = () => BASE_GAIN * getSfxSettings().volume ** 2;

type Out = { ctx: AudioContext; out: GainNode };

/**
 * La salida de los efectos, o null si no deben sonar: pestaña oculta, en silencio, o antes de que la
 * persona haya tocado algo (el navegador no deja arrancar el audio sin un gesto, y lo que se programara
 * con el contexto suspendido sonaría todo junto al reanudarlo).
 */
export function sfxOut(): Out | null {
  if (typeof window === "undefined" || document.hidden) return null;
  const s = getSfxSettings();
  if (s.muted || s.volume <= 0) return null;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return null;
  const a = sharedAudio();
  if (!a || a.ctx.state !== "running") return null;
  if (!bus || busCtx !== a.ctx) {
    busCtx = a.ctx;
    bus = a.ctx.createGain();
    bus.connect(a.ctx.destination);
  }
  bus.gain.value = busGain();
  return { ctx: a.ctx, out: bus };
}

const gate = new SoundGate(12);

/**
 * Hace sonar `fn` si el limitador lo deja: `key` no se repite antes de `gapMs` y la voz cuenta como
 * sonando `durMs`. `vol` (0 a 1) es la atenuación por distancia.
 */
function play(key: string, gapMs: number, durMs: number, vol: number, fn: (a: Out, t: number, vol: number) => void) {
  if (vol <= 0.02) return;
  const a = sfxOut();
  if (!a) return;
  if (!gate.allow(key, performance.now(), gapMs, durMs)) return;
  fn(a, a.ctx.currentTime + 0.01, Math.min(1, vol));
}

// ---------- Primitivas ----------

const noiseCache = new WeakMap<AudioContext, AudioBuffer>();

/** Dos segundos de ruido blanco (uno por contexto): cada sonido lee un tramo al azar. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

interface NoiseOpts {
  type?: BiquadFilterType;
  freq: number;
  /** Frecuencia del filtro al final (barrido). */
  to?: number;
  q?: number;
  vol: number;
  attack?: number;
}

/** Ruido filtrado con envolvente: roces, pasos, crujidos, soplidos. */
function noise(a: Out, t: number, dur: number, o: NoiseOpts, dest: AudioNode = a.out): AudioBufferSourceNode {
  const { ctx } = a;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.frequency.setValueAtTime(o.freq, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const attack = o.attack ?? 0.004;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(o.vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 1.5, dur + 0.05);
  return src;
}

interface ToneOpts {
  type?: OscillatorType;
  attack?: number;
  /** Filtro pasabajos (para ablandar una sierra o una cuadrada). */
  lowpass?: number;
}

/** Un tono corto con envolvente que va de `from` a `to` Hz. */
function tone(a: Out, t: number, dur: number, from: number, to: number, vol: number, o: ToneOpts = {}, dest: AudioNode = a.out): OscillatorNode {
  const { ctx } = a;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "triangle";
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  let node: AudioNode = osc;
  if (o.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = o.lowpass;
    node = osc.connect(lp);
  }
  node.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  return osc;
}

/** Variación chica (±`k`) para que dos pasos seguidos no suenen idénticos. */
const jitter = (k = 0.08) => 1 + (Math.random() * 2 - 1) * k;

// ---------- Posición (quién oye qué) ----------

/** Hasta dónde se oyen los sonidos de otros (px de mundo: unos 7 tiles). */
const HEAR_PX = 32 * 7;
let listener: { x: number; y: number } | null = null;
let area: OfficeMap | null = null;

/** Dónde está quien escucha (el jugador local), cada cuadro. */
export function setSfxListener(x: number, y: number) {
  listener = { x, y };
}

/** El nivel que se ve (para saber de qué es el piso bajo los pies). */
export function setSfxArea(map: OfficeMap) {
  area = map;
}

/** Volumen de algo que pasa en (x, y) del nivel actual: pleno junto a ti, nada a unos 7 tiles. */
export function volAt(x: number, y: number, reach = HEAR_PX): number {
  if (!listener) return 0;
  return volumeAt(Math.hypot(x - listener.x, y - listener.y), reach);
}

// ---------- Los sonidos ----------

function footstep(a: Out, t: number, v: number, surface: StepSurface) {
  const j = jitter();
  switch (surface) {
    case "grass":
      noise(a, t, 0.07, { freq: 2600 * j, q: 0.7, vol: 0.05 * v });
      noise(a, t, 0.05, { type: "lowpass", freq: 260, vol: 0.05 * v });
      return;
    case "dirt":
      noise(a, t, 0.06, { freq: 950 * j, q: 1.3, vol: 0.08 * v });
      return;
    case "wood":
      tone(a, t, 0.07, 150 * j, 80, 0.07 * v);
      noise(a, t, 0.025, { freq: 1500 * j, q: 1.2, vol: 0.03 * v });
      return;
    case "stone":
      noise(a, t, 0.03, { freq: 3200 * j, q: 2, vol: 0.06 * v });
      tone(a, t, 0.035, 430 * j, 300, 0.02 * v, { type: "sine" });
      return;
    case "soft":
      noise(a, t, 0.06, { type: "lowpass", freq: 480 * j, vol: 0.05 * v });
      return;
  }
}

/** Arpegio corto de tonos iguales (avisos, premios). */
function arpeggio(a: Out, t: number, notes: number[], step: number, len: number, vol: number, type: OscillatorType = "triangle") {
  notes.forEach((f, i) => tone(a, t + i * step, len, f, f, vol, { type }));
}

export type NoticeTone = "info" | "success" | "warning";

/** Cuándo sonó el último abrir/cerrar: el clic del botón que lo causó no suena encima. */
let lastUiAt = -1e9;

export const sfx = {
  /**
   * Un paso en (x, y) de mundo, con el timbre del piso. `vol` baja para quien está lejos; `mine` = los
   * tuyos (no compiten con los de los demás en el limitador).
   */
  stepAt(x: number, y: number, vol = 1, mine = false) {
    const surface = area ? surfaceAt(area, x, y) : "wood";
    play(mine ? "step-me" : "step", mine ? 100 : 45, 80, vol, (a, t, v) => footstep(a, t, v, surface));
  },

  // ---- UI ----
  uiOpen() {
    lastUiAt = performance.now();
    play("ui-open", 90, 160, 1, (a, t) => {
      tone(a, t, 0.07, 620, 620, 0.06);
      tone(a, t + 0.06, 0.1, 880, 880, 0.06);
    });
  },
  uiClose() {
    lastUiAt = performance.now();
    play("ui-close", 90, 160, 1, (a, t) => {
      tone(a, t, 0.06, 760, 760, 0.05);
      tone(a, t + 0.05, 0.09, 520, 520, 0.05);
    });
  },
  /** Clic de un botón: un tic de madera, muy corto. */
  click() {
    if (performance.now() - lastUiAt < 80) return;
    play("click", 40, 40, 1, (a, t) => {
      tone(a, t, 0.03, 1250, 900, 0.04);
      noise(a, t, 0.015, { freq: 3000, q: 2, vol: 0.02 });
    });
  },
  notice(kind: NoticeTone) {
    play("notice", 250, 300, 1, (a, t) => {
      if (kind === "success") arpeggio(a, t, [660, 990], 0.08, 0.14, 0.055);
      else if (kind === "warning") arpeggio(a, t, [440, 330], 0.1, 0.16, 0.06);
      else tone(a, t, 0.14, 880, 880, 0.045, { type: "sine" });
    });
  },
  /** Mensaje nuevo en el chat. */
  chat() {
    play("chat", 400, 100, 1, (a, t) => tone(a, t, 0.06, 1046, 1175, 0.035, { type: "sine" }));
  },
  /** Ganaste puntos: la monedita. */
  coin() {
    play("coin", 600, 260, 1, (a, t) => {
      tone(a, t, 0.07, 988, 988, 0.035, { type: "square", lowpass: 3500 });
      tone(a, t + 0.07, 0.2, 1319, 1319, 0.035, { type: "square", lowpass: 3500 });
    });
  },

  // ---- Mundo ----
  /** Usar un objeto o un mueble (E o clic). */
  interact() {
    play("interact", 120, 120, 1, (a, t) => tone(a, t, 0.09, 520, 780, 0.06, { type: "sine" }));
  },
  sit(vol = 1) {
    play("sit", 120, 160, vol, (a, t, v) => {
      noise(a, t, 0.13, { type: "lowpass", freq: 420, vol: 0.12 * v, attack: 0.01 });
      tone(a, t, 0.08, 180, 120, 0.04 * v, { type: "sine" });
    });
  },
  stand(vol = 1) {
    play("stand", 120, 140, vol, (a, t, v) => noise(a, t, 0.11, { freq: 600, to: 1400, q: 0.9, vol: 0.05 * v, attack: 0.03 }));
  },
  /** Alguien levanta el vaso (invita a brindar o se suma): un roce y un tintineo suave. */
  raiseGlass(vol = 1) {
    play("raise-glass", 150, 180, vol, (a, t, v) => {
      noise(a, t, 0.08, { freq: 1800, to: 3200, q: 1, vol: 0.03 * v, attack: 0.02 });
      tone(a, t + 0.05, 0.12, 1760, 1760, 0.02 * v, { type: "sine" });
    });
  },
  /** Chocan los vasos: un "clin" por cada vaso, apenas desfasados (más gente, más tintineo). */
  clink(vol = 1, people = 2) {
    play("clink", 300, 600, vol, (a, t, v) => {
      const n = Math.min(5, Math.max(2, people));
      for (let i = 0; i < n; i++) {
        const f = 2100 * jitter(0.12);
        tone(a, t + i * 0.035, 0.35, f, f * 0.995, (0.05 / Math.sqrt(n)) * v, { type: "sine" });
        tone(a, t + i * 0.035, 0.18, f * 2.7, f * 2.7, (0.015 / Math.sqrt(n)) * v, { type: "sine" });
      }
    });
  },
  /** Silla giratoria: un soplido que sube y baja lo que dura el giro. */
  whoosh(vol = 1, durationMs = 900) {
    const dur = Math.min(2.5, Math.max(0.3, durationMs / 1000));
    play("whoosh", 300, durationMs, vol, (a, t, v) => {
      noise(a, t, dur * 0.55, { freq: 500, to: 1600, q: 0.8, vol: 0.05 * v, attack: dur * 0.3 });
      noise(a, t + dur * 0.5, dur * 0.5, { freq: 1600, to: 450, q: 0.8, vol: 0.04 * v });
      // El chirrido del eje de la silla.
      tone(a, t, 0.12, 1400, 1150, 0.012 * v, { type: "square", lowpass: 2400 });
    });
  },
  /** Mareado de tanto girar: un "uiii" que baja, como de dibujo animado. */
  dizzy(vol = 1) {
    play("dizzy", 1000, 700, vol, (a, t, v) => {
      tone(a, t, 0.6, 880, 330, 0.04 * v, { type: "sine" });
      tone(a, t + 0.05, 0.55, 1320, 495, 0.02 * v, { type: "sine" });
    });
  },
  /** Puerta de la casa: un crujido bajito y el golpe al cerrar. */
  door() {
    play("portal", 500, 500, 1, (a, t) => {
      tone(a, t, 0.22, 210, 260, 0.018, { type: "sawtooth", lowpass: 900, attack: 0.05 });
      tone(a, t + 0.24, 0.12, 110, 60, 0.12, { type: "sine" });
      noise(a, t + 0.24, 0.1, { type: "lowpass", freq: 320, vol: 0.1 });
    });
  },
  /** Escaleras: tres pasos de madera que suben (o bajan). */
  stairs(up: boolean) {
    play("portal", 500, 400, 1, (a, t) => {
      for (let i = 0; i < 3; i++) {
        const f = (up ? 130 + i * 18 : 170 - i * 18) * jitter(0.04);
        tone(a, t + i * 0.11, 0.07, f, f * 0.55, 0.07);
        noise(a, t + i * 0.11, 0.025, { freq: 1400, q: 1.2, vol: 0.03 });
      }
    });
  },
  /** Tocar la puerta de una oficina (tres golpes con los nudillos). */
  knock(vol = 1) {
    play("knock", 600, 450, vol, (a, t, v) => {
      for (let i = 0; i < 3; i++) {
        tone(a, t + i * 0.15, 0.05, 210, 140, 0.12 * v * (i === 2 ? 0.8 : 1));
        noise(a, t + i * 0.15, 0.03, { freq: 1200, q: 1.5, vol: 0.06 * v });
      }
    });
  },
  /** El globito de un emote. */
  pop(vol = 1) {
    play("pop", 80, 100, vol, (a, t, v) => {
      tone(a, t, 0.07, 380, 1000, 0.07 * v, { type: "sine" });
      noise(a, t, 0.02, { freq: 2500, q: 2, vol: 0.03 * v });
    });
  },

  // ---- Consumibles ----
  sip(vol = 1) {
    play("sip", 300, 420, vol, (a, t, v) => {
      noise(a, t, 0.24, { freq: 700, to: 1300, q: 2.5, vol: 0.05 * v, attack: 0.06 });
      tone(a, t + 0.28, 0.09, 330, 180, 0.07 * v, { type: "sine" });
    });
  },
  chomp(vol = 1) {
    play("chomp", 90, 80, vol, (a, t, v) => {
      noise(a, t, 0.05, { freq: 1700 * jitter(), q: 1.6, vol: 0.1 * v });
      noise(a, t + 0.01, 0.04, { type: "lowpass", freq: 600, vol: 0.06 * v });
    });
  },
  /** La pitada: un soplido hacia adentro y la brasa que chisporrotea. */
  puff(vol = 1) {
    play("puff", 300, 500, vol, (a, t, v) => {
      noise(a, t, 0.45, { type: "highpass", freq: 2200, vol: 0.025 * v, attack: 0.2 });
      for (let i = 0; i < 4; i++) noise(a, t + 0.08 + Math.random() * 0.3, 0.01, { freq: 4200, q: 3, vol: 0.05 * v });
    });
  },
  /** Soltar el humo. */
  exhale(vol = 1) {
    play("exhale", 300, 700, vol, (a, t, v) => noise(a, t, 0.7, { type: "lowpass", freq: 900, to: 400, vol: 0.05 * v, attack: 0.06 }));
  },
  /** El encendedor: el clic de la piedra y la llama. */
  lighter(vol = 1) {
    play("lighter", 400, 450, vol, (a, t, v) => {
      noise(a, t, 0.012, { freq: 3200, q: 2, vol: 0.14 * v });
      noise(a, t + 0.05, 0.35, { freq: 520, q: 0.8, vol: 0.05 * v, attack: 0.03 });
    });
  },

  /** La esnifada (lo del Man del Sombrero): dos soplidos cortos hacia adentro por la nariz. */
  sniff(vol = 1) {
    play("sniff", 300, 420, vol, (a, t, v) => {
      noise(a, t, 0.13, { type: "highpass", freq: 3000, to: 5200, vol: 0.05 * v, attack: 0.05 });
      noise(a, t + 0.2, 0.18, { type: "highpass", freq: 3200, to: 6000, vol: 0.06 * v, attack: 0.06 });
    });
  },
  /** Risita de trabado: "je je je", tres tonos que suben y bajan. */
  giggle(vol = 1) {
    play("giggle", 600, 420, vol, (a, t, v) => {
      for (let i = 0; i < 3; i++) tone(a, t + i * 0.11, 0.08, 520 + i * 40, 420, 0.05 * v, { type: "sine" });
    });
  },
  /** El humito del Man del Sombrero al llegar o irse. */
  poof(vol = 1) {
    play("poof", 300, 600, vol, (a, t, v) => noise(a, t, 0.55, { type: "lowpass", freq: 1400, to: 300, vol: 0.08 * v, attack: 0.02 }));
  },

  // ---- Borrachera ----
  hic(vol = 1) {
    play("hic", 300, 120, vol, (a, t, v) => {
      tone(a, t, 0.07, 280, 640, 0.09 * v, { type: "sine" });
      noise(a, t, 0.04, { type: "lowpass", freq: 1000, vol: 0.04 * v });
    });
  },
  /** Una arcada: gárgara grave y ronca. */
  retch(vol = 1) {
    play("retch", 250, 400, vol, (a, t, v) => {
      tone(a, t, 0.32, 150, 85, 0.05 * v, { type: "sawtooth", lowpass: 600, attack: 0.03 });
      noise(a, t, 0.3, { freq: 420, q: 1.5, vol: 0.08 * v, attack: 0.03 });
    });
  },
  /** El golpe sordo al caer al piso. */
  thud(vol = 1) {
    play("thud", 300, 250, vol, (a, t, v) => {
      tone(a, t, 0.22, 90, 40, 0.2 * v, { type: "sine" });
      noise(a, t, 0.15, { type: "lowpass", freq: 260, vol: 0.14 * v });
    });
  },
  /** Al despertar: un latido lento que se apaga y un zumbido finito en los oídos. */
  wake() {
    play("wake", 3000, 3000, 1, (a, t) => {
      for (let i = 0; i < 3; i++) {
        const k = 1 - i * 0.28;
        tone(a, t + i * 0.9, 0.12, 62, 45, 0.18 * k, { type: "sine" });
        tone(a, t + i * 0.9 + 0.2, 0.1, 58, 42, 0.12 * k, { type: "sine" });
      }
      tone(a, t, 2.6, 3150, 3150, 0.006, { type: "sine", attack: 0.6 });
    });
  },

  // ---- Club ----
  /**
   * Propina en el tubo: "cha-ching" de caja registradora. El "cha" es la gaveta (un golpe de ruido y un
   * clac metálico) y el "ching", la campanita (dos parciales inarmónicas que se apagan despacio).
   */
  chaChing(vol = 1) {
    // La monedita del contador no se encima con la caja.
    gate.allow("coin", performance.now(), 0, 0);
    play("cha-ching", 180, 700, vol, (a, t, v) => {
      noise(a, t, 0.07, { freq: 2400, to: 900, q: 0.9, vol: 0.09 * v });
      noise(a, t + 0.02, 0.03, { freq: 5200, q: 4, vol: 0.05 * v });
      tone(a, t + 0.01, 0.05, 330, 180, 0.04 * v, { type: "square", lowpass: 1600 });
      const bell = 2093 * jitter(0.02);
      tone(a, t + 0.13, 0.6, bell, bell, 0.05 * v, { type: "sine" });
      tone(a, t + 0.13, 0.4, bell * 2.76, bell * 2.76, 0.018 * v, { type: "sine" });
      tone(a, t + 0.13, 0.25, bell * 5.4, bell * 5.4, 0.008 * v, { type: "sine" });
    });
  },

  // ---- Casino ----
  /** Una ficha sobre el paño: dos "clac" de plástico. */
  chip() {
    play("chip", 60, 90, 1, (a, t) => {
      noise(a, t, 0.02, { freq: 3600 * jitter(), q: 3, vol: 0.09 });
      tone(a, t, 0.03, 2400, 2200, 0.02, { type: "sine" });
      noise(a, t + 0.05, 0.015, { freq: 3900, q: 3, vol: 0.05 });
    });
  },
  /** Una carta que sale del sabot. */
  card() {
    play("card", 60, 90, 1, (a, t) => noise(a, t, 0.07, { freq: 1800, to: 4200, q: 1.2, vol: 0.06, attack: 0.01 }));
  },
  win() {
    // Si además llega el premio en puntos, la monedita no se encima con la fanfarria.
    gate.allow("coin", performance.now(), 0, 0);
    play("result", 800, 500, 1, (a, t) => arpeggio(a, t, [523, 659, 784, 1047], 0.08, 0.16, 0.05));
  },
  lose() {
    play("result", 800, 400, 1, (a, t) => arpeggio(a, t, [392, 311], 0.13, 0.2, 0.045));
  },
  push() {
    play("result", 800, 200, 1, (a, t) => tone(a, t, 0.16, 587, 587, 0.045));
  },

  /**
   * La bola de la ruleta: rueda (un siseo que se apaga), va golpeando los separadores cada vez más lento
   * y al final rebota y cae. `ms` = lo que falta del giro. Devuelve cómo cortarla (si se sale de la mesa).
   */
  rouletteSpin(ms: number): () => void {
    const nodes: AudioScheduledSourceNode[] = [];
    const dur = ms / 1000;
    if (dur < 0.4) return () => undefined;
    play("roulette", 1500, ms, 1, (a, t) => {
      nodes.push(noise(a, t, dur - 0.3, { freq: 1600, to: 700, q: 0.8, vol: 0.03, attack: 0.3 }));
      // Los golpecitos: de 18 por segundo a 4 por segundo.
      let at = 0.1;
      while (at < dur - 0.7) {
        const k = at / dur;
        nodes.push(noise(a, t + at, 0.012, { freq: 3000, q: 3, vol: 0.035 * (1 - k * 0.5) }));
        at += 0.055 + 0.2 * k * k;
      }
      // Rebota tres veces y cae en la casilla.
      [0.62, 0.4, 0.22, 0.08].forEach((back, i) => {
        nodes.push(noise(a, t + dur - back, 0.02, { freq: 2400, q: 2.5, vol: 0.08 - i * 0.012 }));
        nodes.push(tone(a, t + dur - back, 0.03, 1800, 1500, 0.015, { type: "sine" }));
      });
    });
    return () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          // Ya había terminado.
        }
      }
    };
  },

  // ---- Hockey de mesa ----
  /** El mazo le pega al disco: un "toc" de plástico duro. */
  puckHit() {
    play("puck-hit", 70, 80, 1, (a, t) => {
      noise(a, t, 0.018, { freq: 2600 * jitter(), q: 2.5, vol: 0.1 });
      tone(a, t, 0.04, 900, 600, 0.04, { type: "triangle" });
    });
  },
  /** El disco contra la banda: más apagado. */
  puckWall() {
    play("puck-wall", 70, 60, 1, (a, t) => noise(a, t, 0.02, { freq: 1500 * jitter(), q: 2, vol: 0.06 }));
  },
  /** Gol: el disco cae en el arco y suena la chicharra del arcade. */
  goalHorn() {
    play("goal", 600, 500, 1, (a, t) => {
      noise(a, t, 0.05, { freq: 700, q: 1.5, vol: 0.08 });
      tone(a, t + 0.06, 0.34, 330, 330, 0.035, { type: "square", lowpass: 1600 });
      tone(a, t + 0.06, 0.34, 415, 415, 0.025, { type: "square", lowpass: 1600 });
    });
  },

  // ---- Fotos ----
  /** El obturador: un clic seco, la cortina que corre y el avance del rollo. */
  shutter() {
    play("shutter", 500, 350, 1, (a, t) => {
      noise(a, t, 0.02, { type: "highpass", freq: 3500, vol: 0.09 });
      tone(a, t, 0.025, 1900, 1200, 0.04, { type: "square", lowpass: 3000 });
      noise(a, t + 0.06, 0.05, { freq: 2400, q: 1.5, vol: 0.05 });
      noise(a, t + 0.16, 0.12, { freq: 900, to: 1500, q: 2, vol: 0.03 });
    });
  },
  /** La cuenta regresiva de la foto (3, 2, 1): un bip corto, más agudo en el último. */
  countdown(last: boolean, vol = 1) {
    play("countdown", 400, 120, vol, (a, t, v) => tone(a, t, 0.08, last ? 1320 : 880, last ? 1320 : 880, 0.035 * v, { type: "sine" }));
  },

  // ---- Clima ----
  /** Trueno: un retumbo grave que rueda; cerca, antes un chasquido. Adentro se oye apagado. */
  thunder(strength: number, indoor: boolean) {
    play("thunder", 1500, 3500, 1, (a, t) => {
      const k = Math.max(0.2, Math.min(1, strength)) * (indoor ? 0.45 : 1);
      if (strength > 0.6 && !indoor) noise(a, t, 0.25, { type: "highpass", freq: 1800, vol: 0.12 * k });
      noise(a, t + 0.05, 2.8, { type: "lowpass", freq: indoor ? 140 : 220, to: 60, vol: 0.32 * k, attack: 0.15 });
      noise(a, t + 0.6, 1.8, { type: "lowpass", freq: indoor ? 110 : 160, to: 50, vol: 0.2 * k, attack: 0.3 });
    });
  },
};

// ---------- Lluvia de fondo ----------

let rain: { ctx: AudioContext; gain: GainNode } | null = null;
let rainLevel = 0;
let rainTimer: ReturnType<typeof setInterval> | null = null;

/** Ajusta la lluvia al nivel pedido (o la baja si ahora no se debe oír nada: pestaña oculta, silencio). */
function applyRain() {
  const a = sfxOut();
  const target = a ? 0.07 * rainLevel : 0;
  if (!rain && a && rainLevel > 0) {
    // Ruido en bucle entre un pasaaltos y un pasabajos: el "shhh" parejo de la lluvia.
    const src = a.ctx.createBufferSource();
    src.buffer = noiseBuffer(a.ctx);
    src.loop = true;
    const hp = a.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 350;
    const lp = a.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const gain = a.ctx.createGain();
    gain.gain.value = 0;
    src.connect(hp).connect(lp).connect(gain).connect(a.out);
    src.start();
    rain = { ctx: a.ctx, gain };
  }
  if (rain) rain.gain.gain.setTargetAtTime(target, rain.ctx.currentTime, 1.2);
  if (rainLevel <= 0 && rainTimer) {
    clearInterval(rainTimer);
    rainTimer = null;
  }
}

/**
 * Lluvia de fondo: 0 nada, 1 tormenta afuera. Entra y sale de a poco; mientras suene se revisa cada rato
 * (así arranca cuando el audio se habilita y se apaga si se oculta la pestaña o se silencia).
 */
export function setRainLevel(level: number) {
  rainLevel = Math.max(0, Math.min(1, level));
  if (rainLevel > 0 && !rainTimer) rainTimer = setInterval(applyRain, 1500);
  applyRain();
}
