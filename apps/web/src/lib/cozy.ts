import type { PresenceStatus } from "@hyvento/shared";

/** Colores del estilo cozy (mismos valores que `--color-cozy-*` en globals.css). */
export const COZY = {
  /** Texto principal: café oscuro, nunca negro. */
  ink: "#4a2a1c",
  inkSoft: "#8a4b1c",
  /** Marco de madera de los paneles. */
  frame: "#5b2b0e",
  wood: "#b3571a",
  woodLight: "#e0923e",
  /** Papel de los paneles. */
  paper: "#fbe1a4",
  paperLight: "#fdf0c8",
  paperDark: "#f5cf85",
  red: "#d93a2b",
  green: "#4f8a3c",
  gold: "#c9851c",
  sky: "#5d93cf",
  /** Fondo alrededor de los niveles (la "noche" de afuera). */
  void: "#2a2033",
} as const;

/** Color de cada estado de presencia (punto junto al nombre). */
export const STATUS_HEX: Record<PresenceStatus, string> = {
  available: "#5ea247",
  busy: "#e0923e",
  dnd: "#d93a2b",
  away: "#a8977f",
  /** "En reunión" (automático): el azul cielo de la paleta (COZY.sky). */
  meeting: "#5d93cf",
};

/** Tintas legibles sobre papel para los nombres en el chat. */
const NAME_INKS = ["#a8463d", "#34507a", "#7a5a10", "#2e5a40", "#8a3a30", "#6b3f7a"];
export const nameInk = (id: string) => NAME_INKS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_INKS.length]!;

export const hexToInt = (hex: string) => parseInt(hex.slice(1), 16);

/**
 * Familia de Pixelify Sans que cargó next/font (para los textos que dibuja Phaser), con los dígitos de
 * Tiny5 delante (solo trae 0-9: lo demás cae en Pixelify).
 */
export function cozyFontFamily(): string {
  const loaded = getComputedStyle(document.documentElement).getPropertyValue("--font-cozy").trim();
  return loaded ? `"Tiny5", ${loaded}, ui-monospace, monospace` : "ui-monospace, monospace";
}

/** Espera a que la fuente esté lista: Phaser pinta cada texto una sola vez al crearlo. */
export async function waitForCozyFont(timeoutMs = 2000): Promise<void> {
  const family = cozyFontFamily();
  const sample = "Aa0123456789";
  const loads = Promise.all([document.fonts.load(`400 11px ${family}`, sample), document.fonts.load(`600 11px ${family}`, sample)]);
  await Promise.race([loads.catch(() => undefined), new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** El atardecer del juego va de las 17:00 a las 19:00, cuando llega la noche (NIGHT_FROM del reloj). */
const DUSK_FROM = 17;
const DUSK_TO = 19;

/**
 * Cuánto atardeció (0..1) a esa hora del juego, como en Stardew: desde las 17:00 la luz se va dorando de
 * a poco hasta la noche. Suave al empezar y al terminar (smoothstep); fuera del tramo, 0 (de noche manda
 * la noche).
 */
export function duskAt(hour: number, minute = 0): number {
  const h = hour + minute / 60;
  if (h >= DUSK_TO) return 0;
  const t = Math.min(1, Math.max(0, (h - DUSK_FROM) / (DUSK_TO - DUSK_FROM)));
  return t * t * (3 - 2 * t);
}

/** ¿Es de noche según la hora local? (de 19:00 a 6:59). Solo fuera del juego (la portada): adentro manda el reloj del juego. */
export function isNightNow(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 19 || h < 7;
}
