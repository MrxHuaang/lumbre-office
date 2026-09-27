// Dibujos de los muebles que se usan: lo que se pone encima del mueble según su estado (la pantalla de la
// tele apagada o con su brillo, la pantalla de la lámpara encendida, el disco girando) y lo que sale al
// usarlos (notas musicales, un corazón). Las capas tienen el mismo tamaño y origen que el dibujo del
// mueble (se calculan desde ese dibujo), así caen justo encima en el juego.
import { drawFurniture } from "./furniture";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, alpha, at, hex, type RGBA, type Sprite } from "./pixel";

/** Lienzo vacío del mismo tamaño y origen que el dibujo del mueble. */
function layerOf(type: string): { base: Sprite; out: Sprite } {
  const base = drawFurniture(type, "front");
  return { base, out: { canvas: new PixelCanvas(base.canvas.width, base.canvas.height), ox: base.ox, oy: base.oy } };
}

/**
 * Pinta una cara +x (la de la derecha) de una caja del mueble: `x1` es su plano, `y0..y1` a lo ancho y
 * `z0..z1` a lo alto. `shade(u, v)` recibe u desde el borde +y y v desde abajo (como los shaders de decor.ts).
 * Solo pinta donde el mueble tiene color.
 */
function paintRightFace(
  base: Sprite,
  out: Sprite,
  face: { x1: number; y0: number; y1: number; z0: number; z1: number },
  shade: (u: number, v: number, px: number, py: number) => RGBA | null,
) {
  const { canvas } = out;
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      if (!base.canvas.alphaAt(px, py)) continue;
      const sx = px + 0.5 - out.ox;
      const sy = py + 0.5 - out.oy;
      const Y = face.x1 - sx;
      const Z = (face.x1 + Y) / 2 - sy;
      if (Y < face.y0 || Y >= face.y1 || Z < face.z0 || Z >= face.z1) continue;
      const col = shade(face.y1 - Y, Z - face.z0, px, py);
      if (col) canvas.set(px, py, col);
    }
}

// ---------- Tele retro ----------

/** Pantalla de la tele (cara +x de la caja de la tele en decor.ts: x 3..12, y 1.5..14.5, z 6..19). */
const TV_FACE = { x1: 12, y0: 1.5, y1: 14.5, z0: 6, z1: 19 };
const TV_SCREEN = { u0: 1.3, v0: 1.8, w: 8.4, h: 9.6 };
const inScreen = (u: number, v: number) => {
  const su = u - TV_SCREEN.u0;
  const sv = v - TV_SCREEN.v0;
  const corner = (su < 0.7 || su > TV_SCREEN.w - 0.7) && (sv < 0.7 || sv > TV_SCREEN.h - 0.7);
  return su >= 0 && su < TV_SCREEN.w && sv >= 0 && sv < TV_SCREEN.h && !corner ? { su, sv } : null;
};

/** La tele apagada: vidrio oscuro con el reflejo de la sala en diagonal. */
export function tvScreenOff(): Sprite {
  const { base, out } = layerOf("tv-retro");
  paintRightFace(base, out, TV_FACE, (u, v) => {
    const s = inScreen(u, v);
    if (!s) return null;
    // Reflejo: una franja clara en diagonal y el borde del vidrio curvo un poco más claro.
    const band = Math.abs(s.su - s.sv * 0.7 - 1.8) < 0.55 || Math.abs(s.su - s.sv * 0.7 - 3.2) < 0.3;
    const rim = s.su < 1 || s.sv > TV_SCREEN.h - 1;
    return band ? at(C.metal, 3) : rim ? at(C.metal, 1) : mix(at(C.night, 1), at(C.screen, 0), 0.4);
  });
  return out;
}

/** Brillo de la tele prendida: una franja de barrido que baja por la pantalla (4 cuadros). */
export function tvScreenOn(frame: number): Sprite {
  const { base, out } = layerOf("tv-retro");
  const y = TV_SCREEN.h - ((frame % 4) + 0.5) * (TV_SCREEN.h / 4);
  paintRightFace(base, out, TV_FACE, (u, v) => {
    const s = inScreen(u, v);
    if (!s) return null;
    if (Math.abs(s.sv - y) < 0.6) return alpha(at(C.white, 4), 0.28);
    if (s.su < 0.9 || s.sv > TV_SCREEN.h - 0.9) return alpha(at(C.screen, 5), 0.18);
    return null;
  });
  return out;
}

// ---------- Lámpara de pie ----------

/**
 * La pantalla de la lámpara encendida (caja de la pantalla en furniture.ts: x 3..13, y 3..13, z 30..39):
 * cálida y más clara abajo, donde sale la luz, con el borde de abajo casi blanco.
 */
export function lampLit(): Sprite {
  const { base, out } = layerOf("lamp");
  const warm = hex("#ffc85a");
  const hot = hex("#fff6d8");
  const tint = (px: number, py: number, v: number) => {
    const i = (py * base.canvas.width + px) * 4;
    const d = base.canvas.data;
    const own: RGBA = [d[i]!, d[i + 1]!, d[i + 2]!, 255];
    if (own[0] === OUT[0] && own[1] === OUT[1] && own[2] === OUT[2]) return null;
    // Abajo, por donde sale la luz, casi blanca; hacia arriba se entibia.
    return v < 1.2 ? hot : mix(own, warm, 0.75 - v * 0.05);
  };
  // Las dos caras que se ven (+x y +y) de la pantalla.
  paintRightFace(base, out, { x1: 13, y0: 3, y1: 13, z0: 30, z1: 39 }, (_u, v, px, py) => tint(px, py, v));
  for (let py = 0; py < out.canvas.height; py++)
    for (let px = 0; px < out.canvas.width; px++) {
      if (!base.canvas.alphaAt(px, py) || out.canvas.alphaAt(px, py)) continue;
      // Cara +y: X = sx + y1, Z = (X + y1) / 2 - sy.
      const sx = px + 0.5 - out.ox;
      const sy = py + 0.5 - out.oy;
      const X = sx + 13;
      const Z = (X + 13) / 2 - sy;
      if (X < 3 || X >= 13 || Z < 30 || Z >= 39) continue;
      const col = tint(px, py, Z - 30);
      if (col) out.canvas.set(px, py, col);
    }
  return out;
}

// ---------- Tocadiscos ----------

/** El disco girando: un brillo que da la vuelta por los surcos y la etiqueta que gira (4 cuadros). */
export function vinylSpin(frame: number): Sprite {
  const { out } = layerOf("record-player");
  const c = out.canvas;
  // Centro del disco (decor.ts: p(8.2, 7.6, 14.5)) en el lienzo.
  const ox = out.ox + (8.2 - 7.6);
  const oy = out.oy + (8.2 + 7.6) / 2 - 14.5;
  const a = (frame % 4) * (Math.PI / 2) + 0.4;
  for (const k of [0, Math.PI]) {
    for (const [rx, ry, tone] of [
      [5.4, 2.7, 3],
      [4.1, 2.05, 2],
    ] as const) {
      for (const da of [-0.25, 0, 0.25]) {
        const x = ox + Math.cos(a + k + da) * rx;
        const y = oy + Math.sin(a + k + da) * ry;
        c.set(x, y, alpha(at(C.metal, tone), 0.9));
      }
    }
  }
  // La etiqueta (roja) con su punto claro, que gira.
  c.set(ox + Math.round(Math.cos(a) * 1.4), oy + Math.round(Math.sin(a) * 0.7), at(C.rug, 5));
  return out;
}

// ---------- Lo que sale al usarlos ----------

/** Nota musical (0 = corchea, 1 = dos corcheas unidas) del color dado, con contorno. */
export function musicNote(kind: 0 | 1, color: RGBA): PixelCanvas {
  const rows =
    kind === 0
      ? [
          "..oo..", //
          "..oxo.",
          "..oxxo",
          "..ox.o",
          ".oox..",
          "oxxx..",
          "oxxo..",
          ".oo...",
        ]
      : [
          "..oooooo", //
          "..oxxxxo",
          "..oxooxo",
          "..ox..xo",
          ".oox.oxo",
          "oxxxoxxo",
          "oxxoxxxo",
          ".oo.oxo.",
          ".....o..",
        ];
  const light = mix(color, hex("#ffffff"), 0.45);
  const c = new PixelCanvas(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === "o") c.set(x, y, OUT);
      else if (ch === "x") c.set(x, y, y < 2 ? light : color);
    }),
  );
  return c;
}

/** Corazón chico (al acariciar al gato). */
export function heartSmall(): PixelCanvas {
  const rows = [
    ".oo.oo.", //
    "orrorro",
    "owrrrro",
    "orrrrRo",
    ".orrRo.",
    "..oRo..",
    "...o...",
  ];
  const colors: Record<string, RGBA> = { r: hex("#e5484d"), R: hex("#a8262a"), w: hex("#ffd0d0") };
  const c = new PixelCanvas(7, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && c.set(x, y, ch === "o" ? OUT : colors[ch]!)));
  return c;
}

/** Colores de las notas (cada una sale de un color). */
export const NOTE_COLORS: RGBA[] = [at(C.gold, 4), at(C.cyan, 4), at(C.neon, 4), at(C.leaf, 4), at(C.sky, 3)];
