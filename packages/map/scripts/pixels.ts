// Mini "canvas" de píxeles sobre pngjs para generar assets placeholder sin dependencias nativas.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";

export type RGBA = [number, number, number, number];

export function hex(h: string, a = 255): RGBA {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function shade([r, g, b, a]: RGBA, f: number): RGBA {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return [c(r), c(g), c(b), a];
}

/** Hash determinista para "ruido" reproducible. */
export function noise(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export class Canvas {
  readonly png: PNG;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.png = new PNG({ width, height });
    this.png.data.fill(0);
  }

  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    const d = this.png.data;
    const a = c[3] / 255;
    if (a >= 1 || d[i + 3] === 0) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = c[3];
      return;
    }
    // Mezcla alfa simple sobre lo existente.
    d[i] = Math.round(c[0] * a + d[i]! * (1 - a));
    d[i + 1] = Math.round(c[1] * a + d[i + 1]! * (1 - a));
    d[i + 2] = Math.round(c[2] * a + d[i + 2]! * (1 - a));
    d[i + 3] = Math.max(d[i + 3]!, c[3]);
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.width + x) * 4;
    const d = this.png.data;
    return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  /** Rectángulo con borde (1px) y relleno. */
  box(x: number, y: number, w: number, h: number, fill: RGBA, border: RGBA) {
    this.rect(x, y, w, h, border);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  /** Rectángulo relleno con esquinas redondeadas de radio `r`. */
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGBA) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const cx = i < x + r ? x + r : i >= x + w - r ? x + w - r - 1 : i;
        const cy = j < y + r ? y + r : j >= y + h - r ? y + h - r - 1 : j;
        if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r) this.set(i, j, c);
      }
  }

  /** Copia (sin mezclar) una región de otro canvas. */
  blit(src: Canvas, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
    const s = src.png.data;
    const d = this.png.data;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const si = ((sy + j) * src.width + sx + i) * 4;
        const di = ((dy + j) * this.width + dx + i) * 4;
        for (let k = 0; k < 4; k++) d[di + k] = s[si + k]!;
      }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGBA) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }

  /** Contorno de 1px alrededor de los píxeles opacos de una región (estilo pixel-art). */
  outline(x0: number, y0: number, w: number, h: number, c: RGBA, minAlpha = 200) {
    const marks: [number, number][] = [];
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (this.get(x, y)[3] !== 0) continue;
        const near = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].some(
          ([nx, ny]) => nx! >= x0 && ny! >= y0 && nx! < x0 + w && ny! < y0 + h && this.get(nx!, ny!)[3] >= minAlpha,
        );
        if (near) marks.push([x, y]);
      }
    for (const [x, y] of marks) this.set(x, y, c);
  }

  save(path: string) {
    writeFileSync(path, PNG.sync.write(this.png));
  }
}
