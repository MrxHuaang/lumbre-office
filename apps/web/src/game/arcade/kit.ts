// Piezas comunes de los minijuegos del arcade: la pantalla (160x144, como una consola de bolsillo), los
// colores de la paleta y el dibujo en píxeles sobre un canvas 2D. La lógica de cada juego (y el azar con
// la semilla del servidor) está en @hyvento/shared (arcade-sim.ts), para que el servidor pueda repetirla.
import { C, type Ramp } from "@hyvento/map/art";
import type { ArcadeKey, HeldKeys } from "@hyvento/shared";

export { SCREEN_H, SCREEN_W, type ArcadeKey, type HeldKeys } from "@hyvento/shared";

/** Un minijuego en pantalla: la simulación compartida más su dibujo. */
export interface MiniGame {
  readonly score: number;
  readonly over: boolean;
  /** Esperando que se lance (la pelota sobre la paleta, el pajarito antes del primer aleteo). */
  readonly waiting: boolean;
  /** Tecla recién apretada. */
  press(k: ArcadeKey): void;
  /** Avanza un paso fijo (ARCADE_STEP_MS). */
  step(held: HeldKeys): void;
  /** `t` = ms desde que empezó (para animaciones). */
  draw(g: CanvasRenderingContext2D, t: number): void;
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
