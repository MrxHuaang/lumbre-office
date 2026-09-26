import type { PresenceStatus } from "@hyvento/shared";

/** Tintas del estilo RISO (mismos valores que `--color-riso-*` en globals.css). */
export const RISO = {
  paper: "#f3eee3",
  cream: "#fffdf7",
  navy: "#1f2a44",
  muted: "#5b6480",
  pink: "#ff48b0",
  blue: "#0078bf",
  yellow: "#ffe800",
  green: "#00a95c",
  orange: "#ff6c2f",
  violet: "#765ba7",
} as const;

/** Color de cada estado de presencia (punto junto al nombre). */
export const STATUS_HEX: Record<PresenceStatus, string> = {
  available: RISO.green,
  busy: RISO.orange,
  dnd: RISO.pink,
  away: "#b3b0a6",
};

/** Versiones legibles sobre papel de las tintas, para nombres en el chat. */
const NAME_INKS = ["#c21f78", "#0078bf", "#8a7a00", "#00824a", "#c24d14", "#765ba7"];
export const nameInk = (id: string) => NAME_INKS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_INKS.length]!;

export const hexToInt = (hex: string) => parseInt(hex.slice(1), 16);

/** Familia de IBM Plex Mono que cargó next/font (para los textos que dibuja Phaser). */
export function risoFontFamily(): string {
  const loaded = getComputedStyle(document.documentElement).getPropertyValue("--riso-plex").trim();
  return loaded ? `${loaded}, ui-monospace, monospace` : "ui-monospace, monospace";
}

/** Espera a que la fuente esté lista: Phaser pinta cada texto una sola vez al crearlo. */
export async function waitForRisoFont(timeoutMs = 2000): Promise<void> {
  const family = risoFontFamily();
  const loads = Promise.all([document.fonts.load(`400 11px ${family}`), document.fonts.load(`600 11px ${family}`)]);
  await Promise.race([loads.catch(() => undefined), new Promise((r) => setTimeout(r, timeoutMs))]);
}
