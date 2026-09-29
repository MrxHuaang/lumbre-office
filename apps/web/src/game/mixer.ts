// El mezclador: todo lo que suena en la cabaña pasa por una de cuatro salidas, cada una con su volumen
// (Ajustes → Sonido), y todas por el volumen general y el silencio. Los sonidos se generan con WebAudio
// (sound.ts, sfx.ts y los de cada lugar) y los videos de YouTube (radios, cine) toman el volumen de la
// música. Se guarda en este navegador.
//   - música: el tocadiscos, la radio de la casa, el club y las radios y videos de YouTube;
//   - ambiente: la lluvia, los truenos, el fuego, el arroyo;
//   - efectos: pasos, muebles, instrumentos (piano, guitarra), mascotas, juegos, la interfaz;
//   - avisos: mensajes, avisos, logros, el teléfono, la campanita del foco.

export type SoundCategory = "music" | "ambient" | "effects" | "notify";

export const SOUND_CATEGORIES: readonly { id: SoundCategory; label: string; hint: string }[] = [
  { id: "music", label: "Música y radios", hint: "Tocadiscos, radio, club, videos" },
  { id: "ambient", label: "Ambiente", hint: "Lluvia, truenos, fuego, arroyo" },
  { id: "effects", label: "Efectos", hint: "Pasos, muebles, instrumentos, juegos" },
  { id: "notify", label: "Avisos", hint: "Mensajes, logros, teléfono, foco" },
];

export interface MixerSettings extends Record<SoundCategory, number> {
  /** Volumen general, 0 a 1. */
  master: number;
  muted: boolean;
}

const KEY = "hyvento:mezclador";
/** Lo de antes: un solo volumen para los efectos (se toma como el de efectos la primera vez). */
const OLD_KEY = "hyvento:sfx";
export const MIXER_DEFAULTS: MixerSettings = { master: 1, muted: false, music: 0.7, ambient: 0.7, effects: 0.7, notify: 0.7 };

const clamp01 = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

function load(): MixerSettings {
  try {
    if (typeof window === "undefined") return { ...MIXER_DEFAULTS };
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<MixerSettings>;
      return {
        master: clamp01(v.master, MIXER_DEFAULTS.master),
        muted: v.muted === true,
        music: clamp01(v.music, MIXER_DEFAULTS.music),
        ambient: clamp01(v.ambient, MIXER_DEFAULTS.ambient),
        effects: clamp01(v.effects, MIXER_DEFAULTS.effects),
        notify: clamp01(v.notify, MIXER_DEFAULTS.notify),
      };
    }
    const old = window.localStorage.getItem(OLD_KEY);
    if (old) {
      const v = JSON.parse(old) as { volume?: number; muted?: boolean };
      const vol = clamp01(v.volume, MIXER_DEFAULTS.effects);
      return { ...MIXER_DEFAULTS, muted: v.muted === true, effects: vol, notify: vol, ambient: vol };
    }
  } catch {
    // sin almacenamiento o dañado: lo de siempre
  }
  return { ...MIXER_DEFAULTS };
}

let settings: MixerSettings | null = null;
const listeners = new Set<(s: MixerSettings) => void>();

export function getMixer(): MixerSettings {
  settings ??= load();
  return settings;
}

export function setMixer(patch: Partial<MixerSettings>) {
  settings = { ...getMixer(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento (incógnito, bloqueado): vale solo por esta visita.
  }
  for (const [ctx, buses] of busesByCtx) for (const [cat, bus] of buses) bus.gain.setTargetAtTime(categoryGain(cat), ctx.currentTime, 0.05);
  for (const fn of listeners) fn(settings);
}

export function subscribeMixer(fn: (s: MixerSettings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Volumen de una salida, 0 a 1, como se ve en el control (general × el de la salida; 0 en silencio). */
export function categoryVolume(cat: SoundCategory): number {
  const s = getMixer();
  return s.muted ? 0 : s.master * s[cat];
}

/** Ganancia de la salida: el volumen al cuadrado (la mitad del control suena a "la mitad"). */
export function categoryGain(cat: SoundCategory): number {
  return categoryVolume(cat) ** 2;
}

/**
 * Cuánto bajarle a un video de YouTube (0 a 1): con el control donde viene de fábrica suena como antes
 * (su volumen propio manda), y bajarlo lo baja. YouTube no deja pasar de 100, así que subirlo no suma.
 */
export function mediaScale(cat: SoundCategory = "music"): number {
  return Math.min(1, categoryVolume(cat) / MIXER_DEFAULTS[cat]);
}

/**
 * Volumen (0 a 1) de un `<audio>` que no pasa por WebAudio (la prueba de parlantes, que tiene que salir por
 * la salida elegida con `setSinkId`): la misma curva que las salidas del mezclador, con el control donde
 * viene de fábrica al 100 % como antes, y sin pasar de 1.
 */
export function elementVolume(cat: SoundCategory): number {
  return Math.min(1, categoryGain(cat) / MIXER_DEFAULTS[cat] ** 2);
}

/** ¿Se oye algo de esa salida? (si no, ni se arma el sonido). */
export const audible = (cat: SoundCategory) => categoryVolume(cat) > 0;

const busesByCtx = new Map<AudioContext, Map<SoundCategory, GainNode>>();

/** La salida de una categoría en ese contexto de audio (una por contexto, conectada a los parlantes). */
export function mixerBus(ctx: AudioContext, cat: SoundCategory): GainNode {
  let buses = busesByCtx.get(ctx);
  if (!buses) {
    buses = new Map();
    busesByCtx.set(ctx, buses);
  }
  let bus = buses.get(cat);
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = categoryGain(cat);
    bus.connect(ctx.destination);
    buses.set(cat, bus);
  }
  return bus;
}
