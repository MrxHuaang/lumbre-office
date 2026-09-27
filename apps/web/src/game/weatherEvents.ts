// Ganchos del clima para los sonidos (el módulo de efectos se engancha aquí; acá no hay audio). Sin
// Phaser: se puede importar desde cualquier parte del cliente.
import type { Weather } from "@hyvento/shared";
import { useOfficeStore } from "./store";

export interface ThunderEvent {
  /** 0..1: qué tan fuerte (cerca) es el trueno. */
  strength: number;
  /** El jugador está adentro de la casa (el sonido debería oírse apagado). */
  indoor: boolean;
}

export interface WeatherAmbience {
  weather: Weather;
  /** El nivel que se ve es exterior (la lluvia se oye fuerte afuera y apagada adentro). */
  outdoor: boolean;
}

const thunderListeners = new Set<(e: ThunderEvent) => void>();
const lightningListeners = new Set<(e: ThunderEvent) => void>();
const ambienceListeners = new Set<(e: WeatherAmbience) => void>();
let ambience: WeatherAmbience = { weather: "despejado", outdoor: false };

/** Suena un trueno (llega un rato después del relámpago, como en la vida real). */
export function onThunder(cb: (e: ThunderEvent) => void) {
  thunderListeners.add(cb);
  return () => void thunderListeners.delete(cb);
}

/** Cae un relámpago (el destello; el trueno llega después por `onThunder`). */
export function onLightning(cb: (e: ThunderEvent) => void) {
  lightningListeners.add(cb);
  return () => void lightningListeners.delete(cb);
}

/**
 * Cambió el ambiente del clima (otro clima, o se pasó de afuera a adentro): para la lluvia de fondo.
 * Se llama enseguida con el actual.
 */
export function onWeatherAmbience(cb: (e: WeatherAmbience) => void) {
  ambienceListeners.add(cb);
  cb(ambience);
  return () => void ambienceListeners.delete(cb);
}

/** El clima actual (del estado de la sala). */
export const currentWeather = (): Weather => useOfficeStore.getState().weather;

// Lo llama la vista del clima (weather.ts).
export function emitLightning(e: ThunderEvent) {
  lightningListeners.forEach((cb) => cb(e));
}
export function emitThunder(e: ThunderEvent) {
  thunderListeners.forEach((cb) => cb(e));
}
export function emitAmbience(e: WeatherAmbience) {
  if (e.weather === ambience.weather && e.outdoor === ambience.outdoor) return;
  ambience = e;
  ambienceListeners.forEach((cb) => cb(e));
}
