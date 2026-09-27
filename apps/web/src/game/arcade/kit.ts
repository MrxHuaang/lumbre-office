// Piezas comunes de los minijuegos del arcade: la pantalla (160x144, como una consola de bolsillo), el
// azar con la semilla del servidor, los colores de la paleta y el dibujo en píxeles sobre un canvas 2D.
import { C, type Ramp } from "@hyvento/map/art";

export const SCREEN_W = 160;
export const SCREEN_H = 144;

export type ArcadeKey = "left" | "right" | "up" | "down" | "action";
export type HeldKeys = Record<ArcadeKey, boolean>;

/** Un minijuego: se le pasan las teclas, avanza en pasos fijos y se dibuja en la pantalla. */
export interface MiniGame {
  readonly score: number;
  readonly over: boolean;
  /** Tecla recién apretada. */
  press(k: ArcadeKey): void;
  /** Avanza `dt` ms (pasos fijos de 1000/60). */
  step(dt: number, held: HeldKeys): void;
  /** `t` = ms desde que empezó (para animaciones). */
  draw(g: CanvasRenderingContext2D, t: number): void;
}

/** Azar repetible con la semilla (mulberry32): el servidor da la semilla al empezar. */
export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Color CSS de un tono de la paleta. */
export function col(r: Ramp, i: number): string {
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(i)))]!;
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const PAL = {
  ink: col(C.night, 0),
  night: (i: number) => col(C.night, i),
  leaf: (i: number) => col(C.leaf, i),
  rug: (i: number) => col(C.rug, i),
  gold: (i: number) => col(C.gold, i),
  cyan: (i: number) => col(C.cyan, i),
  neon: (i: number) => col(C.neon, i),
  violet: (i: number) => col(C.violet, i),
  sky: (i: number) => col(C.sky, i),
  cream: (i: number) => col(C.cream, i),
  metal: (i: number) => col(C.metal, i),
  stone: (i: number) => col(C.stone, i),
  mustard: (i: number) => col(C.mustard, i),
  green: (i: number) => col(C.green, i),
  navy: (i: number) => col(C.navy, i),
  white: (i: number) => col(C.white, i),
};

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Dibuja un mapa de píxeles ("." = vacío; cada letra, un color de `colors`). */
export function sprite(g: CanvasRenderingContext2D, rows: readonly string[], x: number, y: number, colors: Record<string, string>) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = colors[row[i]!];
      if (c) rect(g, x + i, y + j, 1, 1, c);
    }
  });
}
