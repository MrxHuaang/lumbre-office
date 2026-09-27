// Piezas comunes del dibujo del chibi: tonos de color, filas y el contexto que reciben las capas.
import type { FullLook } from "@hyvento/shared";
import { hex, type PixelCanvas, type RGBA } from "../pixel";

/**
 * Filas del cuerpo (de pie): cabeza 3-11, cuello 12, torso 13-19, cintura 20, piernas 21-24 y zapatos
 * 25-26 (las suelas en SOLE). Sentado, el torso baja SIT_DROP y las piernas se doblan hacia adelante.
 * Arriba queda un margen de TOP filas para lo que va sobre la cabeza (el gorro de chef, la chistera…).
 */
export const TOP = 8;
/** Fila de las suelas. */
export const SOLE = 26;
/** Cuánto baja el torso al sentarse (la cadera queda a la altura del asiento). */
export const SIT_DROP = 4;
/** Alto del lienzo de un frame del cuerpo: dos filas más que las suelas para los pies de sentado. */
export const BODY_H = SOLE + 3 + TOP;

const DARK = hex("#2b1b3a");
const LIGHT = hex("#fff2c0");
/** Colores fijos de lo que no sigue al Look: paja, delantal crema, cinta y flor. */
export const STRAW = "#e2b95e";
export const CREAM = "#f3e6c4";
export const RIBBON = "#c05a4a";
export const PETAL = hex("#f28fad");
export const PETAL_DARK = hex("#d9607f");
export const POLLEN = hex("#f4d35e");
export const LEAF = hex("#5ea247");

/** Tono de un color: negativo oscurece hacia morado, positivo aclara hacia amarillo. */
export function tone(base: string, k: number): RGBA {
  const c = hex(base);
  const t = Math.abs(k);
  const to = k < 0 ? DARK : LIGHT;
  return [
    Math.round(c[0] + (to[0] - c[0]) * t),
    Math.round(c[1] + (to[1] - c[1]) * t),
    Math.round(c[2] + (to[2] - c[2]) * t),
    255,
  ];
}

/** Sombra, base y luz de un color. */
export type Three = [RGBA, RGBA, RGBA];
export const three = (h: string): Three => [tone(h, -0.3), tone(h, 0), tone(h, 0.25)];

export interface Tones {
  skin: Three;
  hair: Three;
  shirt: Three;
  /** Color secundario de la parte de arriba (rayas, puntos, capucha, corbata…). */
  top2: Three;
  pants: [RGBA, RGBA];
  accent: Three;
  eyes: Three;
  shoes: Three;
  straw: Three;
  cream: Three;
  ribbon: Three;
}

export function tones(l: FullLook): Tones {
  return {
    skin: three(l.skin),
    hair: three(l.hair),
    shirt: three(l.shirt),
    top2: three(l.top2),
    pants: [tone(l.pants, -0.25), tone(l.pants, 0.1)],
    accent: three(l.accent),
    eyes: three(l.eyeColor),
    shoes: three(l.shoeColor),
    straw: three(STRAW),
    cream: three(CREAM),
    ribbon: three(RIBBON),
  };
}

export type View = "front" | "back";
/** Fila del cuerpo → fila del canvas. */
export type Row = (row: number) => number;

/**
 * Lo que recibe cada capa del dibujo. El frame mide 16 x BODY_H y mira en 3/4 hacia la derecha: de
 * frente al sureste (+x), de espaldas al noreste (-y). Las otras dos diagonales son el espejo.
 */
export interface Ctx {
  c: PixelCanvas;
  look: FullLook;
  t: Tones;
  view: View;
  /** 0 = quieto, 1 y 2 = pasos. */
  frame: 0 | 1 | 2;
  sit: boolean;
  /** Fila de torso y cabeza: sube y baja con el paso, y baja SIT_DROP al sentarse. */
  y: Row;
  /** Fila de las piernas (sin balanceo). */
  Y: Row;
  /** Balanceo de los brazos al caminar (-1, 0 o 1). */
  swing: number;
  /** Vaivén del pelo al caminar (-1, 0 o 1). */
  sway: number;
}
