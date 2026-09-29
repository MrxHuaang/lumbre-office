// Motor pixel-art propio: canvas RGBA, rampas de color con cambio de tono y un renderizador
// isométrico 2:1 de cajas con "shaders" por cara. Todo se dibuja por código, igual en Node y en el navegador.
//
// Unidades de arte: un tile mide L x L en el piso (L = 16) y se ve como un rombo de 32x16 píxeles.
// El juego usa tiles de 32 px de mundo: la conversión es `arte = mundo / 2` (ver WORLD_TO_ART).

export type RGBA = [number, number, number, number];

export function hex(h: string, a = 255): RGBA {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** Rampa de color de oscuro a claro. Las sombras tiran a morado y las luces a amarillo (estilo Stardew). */
export type Ramp = RGBA[];
export const ramp = (...hs: string[]): Ramp => hs.map((h) => hex(h));
export const at = (r: Ramp, i: number): RGBA => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))]!;
export const alpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], Math.round(a * 255)];

/** Hash determinista para ruido reproducible. */
export function noise(x: number, y: number, seed = 0): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Ruido suave (interpolado entre puntos de una grilla de `cell`): manchas orgánicas, sin cuadrados. */
export function smoothNoise(x: number, y: number, cell: number, seed = 0): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = noise(x0, y0, seed);
  const b = noise(x0 + 1, y0, seed);
  const c = noise(x0, y0 + 1, seed);
  const d = noise(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Umbral de tramado ordenado 4x4 (0..1): da degradados "a mano" sin mezclar colores. */
export const bayer = (x: number, y: number) => (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

export class PixelCanvas {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  set(x: number, y: number, c: RGBA) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || c[3] === 0) return;
    const i = (y * this.width + x) * 4;
    const d = this.data;
    const a = c[3] / 255;
    if (a >= 1 || d[i + 3] === 0) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = c[3];
      return;
    }
    d[i] = Math.round(c[0] * a + d[i]! * (1 - a));
    d[i + 1] = Math.round(c[1] * a + d[i + 1]! * (1 - a));
    d[i + 2] = Math.round(c[2] * a + d[i + 2]! * (1 - a));
    d[i + 3] = Math.max(d[i + 3]!, c[3]);
  }

  alphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.data[(y * this.width + x) * 4 + 3]!;
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGBA) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Contorno de 1px alrededor de todo lo opaco (el borde café oscuro típico del pixel-art cozy). */
  outline(c: RGBA, minAlpha = 160) {
    const marks: number[] = [];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (this.alphaAt(x, y) !== 0) continue;
        if (
          this.alphaAt(x + 1, y) >= minAlpha ||
          this.alphaAt(x - 1, y) >= minAlpha ||
          this.alphaAt(x, y + 1) >= minAlpha ||
          this.alphaAt(x, y - 1) >= minAlpha
        )
          marks.push(x, y);
      }
    for (let k = 0; k < marks.length; k += 2) this.set(marks[k]!, marks[k + 1]!, c);
  }

  /** Luz en bandas tramadas (sin degradados suaves): se ve pintada a mano. */
  glow(cx: number, cy: number, rx: number, ry: number, c: RGBA, maxAlpha: number, bands = 3) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d >= 1) continue;
        const t = 1 - d;
        const band = Math.floor(t * bands + bayer(x, y) * 0.9);
        if (band <= 0) continue;
        this.set(x, y, alpha(c, (maxAlpha * Math.min(band, bands)) / bands));
      }
  }
}

// ---------- Proyección isométrica 2:1 ----------
// Mundo en unidades de píxel: un tile mide L x L en el piso y se ve como un rombo de 32x16.

export const L = 16;
/** Píxeles de mundo del juego (tile de 32) → unidades de arte (tile de 16). */
export const WORLD_TO_ART = 0.5;

export const toScreen = (x: number, y: number, z = 0) => ({ x: x - y, y: (x + y) / 2 - z });
/** Inverso sobre el piso (z = 0). */
export const toWorld = (sx: number, sy: number) => ({ x: sy + sx / 2, y: sy - sx / 2 });

/** Color de una cara según coordenadas locales: u a lo ancho, v a lo alto/profundo; fw/fh = tamaño de la cara. */
export type Shader = (u: number, v: number, fw: number, fh: number) => RGBA | null;
export const flat =
  (c: RGBA): Shader =>
  () =>
    c;

export interface Box {
  x: number;
  y: number;
  z: number;
  /** Tamaño en x (derecha-abajo en pantalla), y (izquierda-abajo) y z (alto). */
  w: number;
  d: number;
  h: number;
  top?: Shader;
  /** Cara que mira hacia +y (se ve a la izquierda). */
  left?: Shader;
  /** Cara que mira hacia +x (se ve a la derecha). */
  right?: Shader;
}

/** Caja con las tres caras sombreadas desde una rampa (luz desde arriba a la izquierda). */
export function solidBox(b: Omit<Box, "top" | "left" | "right">, r: Ramp, base = r.length - 2): Box {
  return { ...b, top: flat(at(r, base + 1)), left: flat(at(r, base)), right: flat(at(r, base - 1)) };
}

/** Punto del mundo → píxel del canvas de un sprite. */
export type Project = (x: number, y: number, z?: number) => { x: number; y: number };

export interface Sprite {
  canvas: PixelCanvas;
  /** Posición del origen del mundo (0,0,0) dentro del canvas. */
  ox: number;
  oy: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boxBounds(b: Box): Bounds {
  return {
    minX: b.x - (b.y + b.d),
    maxX: b.x + b.w - b.y,
    minY: (b.x + b.y) / 2 - (b.z + b.h),
    maxY: (b.x + b.w + b.y + b.d) / 2 - b.z,
  };
}

/** Rasteriza una caja: por cada píxel se resuelve qué cara lo cubre invirtiendo la proyección. */
function drawBox(c: PixelCanvas, b: Box, ox: number, oy: number) {
  const bb = boxBounds(b);
  const x0 = b.x,
    x1 = b.x + b.w,
    y0 = b.y,
    y1 = b.y + b.d,
    z0 = b.z,
    z1 = b.z + b.h;
  for (let py = Math.floor(bb.minY + oy) - 1; py <= Math.ceil(bb.maxY + oy) + 1; py++)
    for (let px = Math.floor(bb.minX + ox) - 1; px <= Math.ceil(bb.maxX + ox) + 1; px++) {
      const sx = px + 0.5 - ox;
      const sy = py + 0.5 - oy;
      // Tapa (z = z1).
      if (b.top && b.h >= 0) {
        const X = sy + z1 + sx / 2;
        const Y = sy + z1 - sx / 2;
        if (X >= x0 && X < x1 && Y >= y0 && Y < y1) {
          const col = b.top(X - x0, Y - y0, b.w, b.d);
          if (col) c.set(px, py, col);
          continue;
        }
      }
      // Cara +x (derecha).
      if (b.right) {
        const Y = x1 - sx;
        const Z = (x1 + Y) / 2 - sy;
        if (Y >= y0 && Y < y1 && Z >= z0 && Z < z1) {
          const col = b.right(y1 - Y, Z - z0, b.d, b.h);
          if (col) c.set(px, py, col);
          continue;
        }
      }
      // Cara +y (izquierda).
      if (b.left) {
        const X = sx + y1;
        const Z = (X + y1) / 2 - sy;
        if (X >= x0 && X < x1 && Z >= z0 && Z < z1) {
          const col = b.left(X - x0, Z - z0, b.w, b.h);
          if (col) c.set(px, py, col);
        }
      }
    }
}

/**
 * Superficie paramétrica (techos inclinados, hastiales): se "salpica" desde el mundo hacia la
 * pantalla con paso fino. `at(u, v)` devuelve el punto del mundo y su color, o null para no pintar.
 * Se pinta en el orden dado: llamar de atrás hacia adelante.
 */
export function splat(
  c: PixelCanvas,
  p: Project,
  uMax: number,
  vMax: number,
  at: (u: number, v: number) => { x: number; y: number; z: number; c: RGBA } | null,
  step = 0.34,
) {
  for (let v = 0; v < vMax; v += step)
    for (let u = 0; u < uMax; u += step) {
      const s = at(u, v);
      if (!s) continue;
      const q = p(s.x, s.y, s.z);
      c.set(q.x, q.y, s.c);
    }
}

export interface SpriteOptions {
  outline?: RGBA;
  /** Detalles a mano después de las cajas (hojas, pantallas, ojos...). */
  extra?: (c: PixelCanvas, p: Project) => void;
  /** Detalles antes de las cajas (sombras en el piso). */
  under?: (c: PixelCanvas, p: Project) => void;
  /** Margen extra alrededor, para lo que dibujan `extra`/`under` fuera de las cajas. */
  pad?: number;
  /** Cajas que van delante de lo que pinta `extra` (p. ej. el porche delante del techo). */
  overlay?: Box[];
  /** Solo quedan los píxeles que cubren estas cajas (sus caras, pinten o no): un recorte del dibujo. */
  clip?: Box[];
}

/** Arma un sprite con cajas en coordenadas absolutas del mundo, dibujadas en el orden dado (de atrás hacia adelante). */
export function renderSprite(boxes: Box[], opts: SpriteOptions = {}): Sprite {
  const pad = (opts.pad ?? 0) + 2;
  const all = [...boxes, ...(opts.overlay ?? [])].map(boxBounds);
  const bb = all.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
  const ox = Math.ceil(-bb.minX) + pad;
  const oy = Math.ceil(-bb.minY) + pad;
  const canvas = new PixelCanvas(Math.ceil(bb.maxX - bb.minX) + pad * 2 + 1, Math.ceil(bb.maxY - bb.minY) + pad * 2 + 1);
  const project: Project = (x, y, z = 0) => {
    const s = toScreen(x, y, z);
    return { x: s.x + ox, y: s.y + oy };
  };
  opts.under?.(canvas, project);
  // Sombra bajo "under" no debe llevar contorno: se dibuja en otro canvas y se compone al final.
  const body = new PixelCanvas(canvas.width, canvas.height);
  for (const b of boxes) drawBox(body, b, ox, oy);
  opts.extra?.(body, project);
  for (const b of opts.overlay ?? []) drawBox(body, b, ox, oy);
  if (opts.clip) {
    const mask = new PixelCanvas(canvas.width, canvas.height);
    const on: Shader = () => [0, 0, 0, 255];
    for (const b of opts.clip) drawBox(mask, { ...b, top: b.top && on, left: b.left && on, right: b.right && on }, ox, oy);
    for (let i = 3; i < body.data.length; i += 4) if (mask.data[i] === 0) body.data[i - 3] = body.data[i - 2] = body.data[i - 1] = body.data[i] = 0;
  }
  if (opts.outline) body.outline(opts.outline);
  for (let i = 0; i < body.data.length; i += 4) {
    if (body.data[i + 3] === 0) continue;
    canvas.set(((i / 4) % canvas.width) | 0, (i / 4 / canvas.width) | 0, [
      body.data[i]!,
      body.data[i + 1]!,
      body.data[i + 2]!,
      body.data[i + 3]!,
    ]);
  }
  return { canvas, ox, oy };
}

/** Rombo relleno sobre el piso (sombras, marcas de tile). */
export function floorDiamond(c: PixelCanvas, p: Project, x: number, y: number, w: number, d: number, col: RGBA) {
  const a = p(x, y);
  const b = p(x + w, y + d);
  const l = p(x, y + d);
  const r = p(x + w, y);
  for (let py = Math.floor(a.y); py <= Math.ceil(b.y); py++)
    for (let px = Math.floor(l.x); px <= Math.ceil(r.x); px++) {
      const sx = px + 0.5 - (a.x - (x - y));
      const sy = py + 0.5 - (a.y - (x + y) / 2);
      const X = sy + sx / 2;
      const Y = sy - sx / 2;
      if (X >= x && X < x + w && Y >= y && Y < y + d) c.set(px, py, col);
    }
}
