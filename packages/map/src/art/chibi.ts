// Personajes chibi en pixel-art (estilo Stardew), vista isométrica 3/4. Se dibujan en el navegador a
// partir del Look (colores, peinado y accesorios). Los seis personajes fijos son presets de Look.
import type { Accessory, HairStyle, HumanAvatar, Look } from "@hyvento/shared";
import { OUT } from "./palette";
import { PixelCanvas, alpha, hex, noise, type RGBA } from "./pixel";

/** Cada frame mide 32x32; el personaje va centrado abajo con los pies en FEET_Y. */
export const FRAME = 32;
export const FEET_Y = 29;
/** Margen arriba del cuerpo para el moño y los audífonos; los pies quedan en la fila 24 + TOP. */
const TOP = 2;
const BODY_H = 26 + TOP;
/** Columnas de la hoja de caminata: quieto, paso A, paso B. */
export const FRAMES = 3;
/** Filas de la hoja (direcciones del mundo) y frames de la hoja de sentado, en este orden. */
export const SHEET_DIRECTIONS = ["down", "left", "right", "up"] as const;
export type SheetDirection = (typeof SHEET_DIRECTIONS)[number];

export interface CharacterStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** Color de la gorra y los audífonos. */
  accent?: string;
  hairStyle?: HairStyle;
  accessories?: readonly Accessory[];
}

/** Los seis personajes fijos. */
export const HUMANS: Record<HumanAvatar, CharacterStyle> = {
  ada: { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", hairStyle: "long" },
  bruno: { skin: "#c68642", hair: "#1b1b1b", shirt: "#2a9d8f", pants: "#3d405b", hairStyle: "short" },
  carla: { skin: "#ffdbac", hair: "#b5651d", shirt: "#8338ec", pants: "#22223b", hairStyle: "bun" },
  dario: { skin: "#8d5524", hair: "#0d0d0d", shirt: "#f4a261", pants: "#1d3557", hairStyle: "curly" },
  eva: { skin: "#e0ac69", hair: "#d4a017", shirt: "#06d6a0", pants: "#3a3a4a", hairStyle: "long" },
  fede: { skin: "#f1c27d", hair: "#6b4423", shirt: "#118ab2", pants: "#4a4e69", hairStyle: "buzz" },
};

const DARK = hex("#2b1b3a");
const LIGHT = hex("#fff2c0");

/** Tono de un color: negativo oscurece hacia morado, positivo aclara hacia amarillo. */
function tone(base: string, k: number): RGBA {
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

interface Tones {
  skin: [RGBA, RGBA, RGBA];
  hair: [RGBA, RGBA, RGBA];
  shirt: [RGBA, RGBA, RGBA];
  pants: [RGBA, RGBA];
  accent: [RGBA, RGBA, RGBA];
}

function tones(s: CharacterStyle): Tones {
  const three = (h: string): [RGBA, RGBA, RGBA] => [tone(h, -0.3), tone(h, 0), tone(h, 0.25)];
  return {
    skin: three(s.skin),
    hair: three(s.hair),
    shirt: three(s.shirt),
    pants: [tone(s.pants, -0.25), tone(s.pants, 0.1)],
    accent: three(s.accent ?? "#e0923e"),
  };
}

type View = "front" | "back";

/**
 * Un frame de 16x28 mirando en 3/4 hacia la derecha: de frente mira al sureste (+x) y de espaldas al
 * noreste (-y). Las otras dos diagonales son estos mismos espejados.
 */
function drawBody(s: CharacterStyle, view: View, frame: 0 | 1 | 2, sit: boolean): PixelCanvas {
  const c = new PixelCanvas(16, BODY_H);
  const t = tones(s);
  const has = (a: Accessory) => s.accessories?.includes(a) ?? false;
  const style: HairStyle = s.hairStyle ?? "short";
  // Sentado: el cuerpo baja 3 píxeles y las piernas se doblan hacia adelante.
  const drop = sit ? 3 : 0;
  const bob = sit ? 0 : frame === 0 ? 0 : 1;
  const Y = (row: number) => row + TOP;
  const y = (row: number) => row + bob + drop + TOP;
  const shoe = hex("#3a2418");

  // Piernas.
  if (sit) {
    if (view === "front") {
      c.rect(5, Y(20), 7, 2, t.pants[1]);
      c.rect(5, Y(22), 7, 1, t.pants[0]);
      c.rect(10, Y(22), 3, 2, t.pants[0]);
      c.rect(10, Y(24), 4, 1, shoe);
    } else {
      c.rect(4, Y(20), 8, 2, t.pants[0]);
    }
  } else {
    const lift = (leg: 0 | 1) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1);
    for (const leg of [0, 1] as const) {
      const x = leg === 0 ? 5 : 8;
      const up = lift(leg) ? 1 : 0;
      c.rect(x, Y(19), 3, 4 - up, t.pants[leg === 0 ? 1 : 0]);
      c.rect(x - (leg === 0 ? 1 : 0), Y(23 - up), 4, 1, shoe);
      c.rect(x - (leg === 0 ? 1 : 0), Y(22 - up), 4, 1, leg === 0 ? hex("#5a3826") : shoe);
    }
  }

  // Brazos (se balancean al caminar).
  const swing = sit ? 0 : frame === 1 ? 1 : frame === 2 ? -1 : 0;
  c.rect(3, y(14), 1, 4 + swing, t.shirt[0]);
  c.set(3, y(18 + swing), t.skin[1]);
  c.rect(12, y(14), 1, 4 - swing, t.shirt[0]);
  c.set(12, y(18 - swing), t.skin[0]);

  // Torso.
  c.rect(4, y(13), 8, 6, t.shirt[1]);
  c.rect(11, y(13), 1, 6, t.shirt[0]);
  c.rect(5, y(13), 1, 3, t.shirt[2]);
  c.rect(4, y(18), 8, 1, t.pants[0]);
  if (view === "front") c.rect(7, y(13), 3, 1, t.shirt[2]);

  // Cuello y cabeza.
  c.rect(7, y(12), 2, 1, t.skin[0]);
  c.rect(4, y(3), 8, 9, t.skin[1]);
  c.rect(3, y(4), 10, 7, t.skin[1]);
  c.rect(12, y(4), 1, 7, t.skin[0]);
  c.rect(4, y(11), 8, 1, t.skin[0]);

  const hr = t.hair;
  if (view === "front") {
    // Cara: ojos de 2px, rubor y boca.
    c.rect(7, y(7), 1, 2, OUT);
    c.rect(10, y(7), 1, 2, OUT);
    c.set(7, y(7), hex("#4a3a5a"));
    c.set(6, y(9), alpha(hex("#e5707a"), 0.55));
    c.set(11, y(9), alpha(hex("#e5707a"), 0.55));
    c.set(9, y(10), t.skin[0]);
    if (has("beard")) {
      c.rect(4, y(9), 2, 3, hr[1]);
      c.rect(11, y(9), 2, 3, hr[0]);
      c.rect(5, y(11), 7, 1, hr[1]);
      c.rect(7, y(12), 3, 1, hr[0]);
      c.set(9, y(10), hr[0]);
    }
    drawHairFront(c, style, hr, y);
    if (has("glasses")) {
      const frameC = hex("#1f2a44");
      for (const x of [6, 8, 9, 11]) c.set(x, y(7), frameC);
      c.set(7, y(6), frameC);
      c.set(10, y(6), frameC);
      c.set(7, y(8), alpha(hex("#bfe3ff"), 0.5));
      c.set(10, y(8), alpha(hex("#bfe3ff"), 0.5));
    }
  } else {
    drawHairBack(c, style, hr, y);
    if (has("glasses")) {
      c.set(3, y(7), hex("#1f2a44"));
      c.set(12, y(7), hex("#1f2a44"));
    }
  }

  if (has("cap")) {
    const a = t.accent;
    c.rect(4, y(1), 8, 1, a[1]);
    c.rect(3, y(2), 10, 3, a[1]);
    c.rect(5, y(1), 3, 1, a[2]);
    c.rect(11, y(2), 2, 3, a[0]);
    if (view === "front") c.rect(8, y(5), 7, 1, a[0]);
    else c.rect(7, y(4), 2, 1, a[2]);
  }
  if (has("headphones")) {
    const a = t.accent;
    c.rect(4, y(0), 8, 1, a[0]);
    c.set(3, y(1), a[0]);
    c.set(12, y(1), a[0]);
    c.rect(2, y(5), 2, 4, a[1]);
    c.rect(12, y(5), 2, 4, a[0]);
  }

  c.outline(OUT);
  return c;
}

function drawHairFront(c: PixelCanvas, style: HairStyle, hr: [RGBA, RGBA, RGBA], y: (r: number) => number) {
  if (style === "buzz") {
    c.rect(4, y(2), 8, 2, hr[1]);
    c.rect(3, y(3), 1, 2, hr[0]);
    c.rect(12, y(3), 1, 2, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
    for (let x = 2; x <= 13; x++)
      for (let r = 0; r <= 5; r++) {
        const edge = r === 0 || x === 2 || x === 13;
        if (edge && noise(x, r, 5) < 0.45) continue;
        c.set(x, y(r), r < 2 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
      }
    c.rect(2, y(6), 2, 4, hr[1]);
    c.rect(12, y(6), 2, 3, hr[0]);
    for (const [x, r] of [
      [3, 1],
      [6, 0],
      [9, 1],
      [12, 2],
      [4, 4],
    ] as const)
      c.set(x, y(r), hr[0]);
    return;
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(3, y(5), 2, 4, hr[1]);
  c.rect(5, y(5), 3, 1, hr[1]);
  c.set(8, y(5), hr[0]);
  c.rect(12, y(5), 1, 2, hr[0]);
  c.rect(4, y(2), 4, 1, hr[2]);
  if (style === "long") {
    c.rect(2, y(5), 2, 9, hr[1]);
    c.rect(12, y(6), 2, 7, hr[0]);
  }
  if (style === "bun") {
    c.rect(6, y(-1), 4, 2, hr[1]);
    c.set(7, y(-1), hr[2]);
  }
}

function drawHairBack(c: PixelCanvas, style: HairStyle, hr: [RGBA, RGBA, RGBA], y: (r: number) => number) {
  if (style === "buzz") {
    c.rect(4, y(2), 8, 7, hr[1]);
    c.rect(3, y(4), 10, 4, hr[1]);
    c.rect(11, y(3), 2, 5, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
    for (let x = 2; x <= 13; x++)
      for (let r = 0; r <= 11; r++) {
        const edge = r === 0 || x === 2 || x === 13 || r === 11;
        if (edge && noise(x, r, 9) < 0.45) continue;
        c.set(x, y(r), r < 3 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
      }
    return;
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 9, hr[1]);
  c.rect(4, y(10), 8, 2, hr[1]);
  c.rect(11, y(4), 2, 7, hr[0]);
  c.rect(5, y(2), 3, 2, hr[2]);
  if (style === "long") c.rect(3, y(11), 10, 4, hr[1]);
  if (style === "bun") {
    c.rect(6, y(0), 4, 3, hr[1]);
    c.set(7, y(0), hr[2]);
    c.rect(6, y(3), 4, 1, hr[0]);
  }
}

/** Copia un frame del cuerpo dentro de la celda (col, row) de una hoja, espejado si hace falta. */
function blitFrame(sheet: PixelCanvas, f: PixelCanvas, col: number, row: number, flip: boolean) {
  const ox = col * FRAME + 8;
  const oy = row * FRAME + (FEET_Y - 24 - TOP);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      if (!f.data[i + 3]) continue;
      sheet.set(ox + (flip ? f.width - 1 - x : x), oy + y, [f.data[i]!, f.data[i + 1]!, f.data[i + 2]!, f.data[i + 3]!]);
    }
}

/** Vista y espejo de cada dirección del mundo (+x = sureste, +y = suroeste en pantalla). */
const ORIENT: Record<SheetDirection, { view: View; flip: boolean }> = {
  down: { view: "front", flip: true },
  left: { view: "back", flip: true },
  right: { view: "front", flip: false },
  up: { view: "back", flip: false },
};

/** Hoja de caminata: 3 columnas (quieto, paso A, paso B) x 4 filas (down, left, right, up). */
export function drawCharacter(s: CharacterStyle): PixelCanvas {
  const sheet = new PixelCanvas(FRAME * FRAMES, FRAME * SHEET_DIRECTIONS.length);
  SHEET_DIRECTIONS.forEach((dir, row) => {
    const { view, flip } = ORIENT[dir];
    ([0, 1, 2] as const).forEach((frame) => blitFrame(sheet, drawBody(s, view, frame, false), frame, row, flip));
  });
  return sheet;
}

/** Hoja de sentado: 4 frames (down, left, right, up). */
export function drawSitting(s: CharacterStyle): PixelCanvas {
  const sheet = new PixelCanvas(FRAME * SHEET_DIRECTIONS.length, FRAME);
  SHEET_DIRECTIONS.forEach((dir, col) => {
    const { view, flip } = ORIENT[dir];
    blitFrame(sheet, drawBody(s, view, 0, true), col, 0, flip);
  });
  return sheet;
}

/** Estilo de dibujo para un Look personalizado o uno de los personajes fijos. */
export function styleFor(avatar: string, look: Look | null): CharacterStyle {
  if (look) return look;
  return HUMANS[avatar as HumanAvatar] ?? HUMANS.ada;
}
