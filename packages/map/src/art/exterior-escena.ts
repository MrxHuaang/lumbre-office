// Escena con z-buffer para los dibujos grandes de afuera (la casa, el invernadero, la glorieta).
// Con cajas pintadas "de atrás hacia adelante" una casa con torre, lucarnas y techos cruzados se vuelve
// imposible de ordenar; aquí cada superficie se salpica punto a punto y gana la más cercana a la cámara
// (profundidad = x + y + z: la vista isométrica mira a lo largo de (1, 1, 1)). Coordenadas de arte.
import { OUT, SHADOW } from "./palette";
import { PixelCanvas, alpha, toScreen, type RGBA, type Sprite } from "./pixel";

export type V3 = [number, number, number];
/** Color de una superficie en (u, v): u y v en unidades de arte desde la esquina de la superficie. */
export type Tinte = (u: number, v: number) => RGBA | null;

export interface Limites {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

/** Largo en pantalla de un vector del mundo (para elegir el paso del salpicado sin dejar huecos). */
const screenLen = (v: V3) => Math.hypot(v[0] - v[1], (v[0] + v[1]) / 2 - v[2]);

export class Escena {
  readonly canvas: PixelCanvas;
  /** Sombras en el piso (sin contorno, debajo de todo). */
  readonly suelo: PixelCanvas;
  private readonly depth: Float32Array;
  /** 1 = el píxel pide contorno donde otra superficie queda muy por delante. */
  private readonly bordes: Uint8Array;
  /** Última superficie translúcida que mezcló cada píxel (cada una mezcla una sola vez). */
  private readonly capa: Uint32Array;
  private capaActual = 1;
  readonly ox: number;
  readonly oy: number;
  /** Si lo que se pinta ahora deja contorno en los saltos de profundidad. */
  borde = true;

  constructor(lim: Limites, pad = 4) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const x of [lim.x0, lim.x1])
      for (const y of [lim.y0, lim.y1])
        for (const z of [lim.z0, lim.z1]) {
          const s = toScreen(x, y, z);
          xs.push(s.x);
          ys.push(s.y);
        }
    this.ox = Math.ceil(-Math.min(...xs)) + pad;
    this.oy = Math.ceil(-Math.min(...ys)) + pad;
    const w = Math.ceil(Math.max(...xs) - Math.min(...xs)) + pad * 2 + 1;
    const h = Math.ceil(Math.max(...ys) - Math.min(...ys)) + pad * 2 + 1;
    this.canvas = new PixelCanvas(w, h);
    this.suelo = new PixelCanvas(w, h);
    this.depth = new Float32Array(w * h).fill(-Infinity);
    this.bordes = new Uint8Array(w * h);
    this.capa = new Uint32Array(w * h);
  }

  /** Empieza otra superficie: lo translúcido (vidrio) se mezcla una vez por píxel y por superficie. */
  private nuevaCapa() {
    this.capaActual++;
  }

  /** Punto del mundo → píxel del lienzo. */
  p(x: number, y: number, z = 0) {
    const s = toScreen(x, y, z);
    return { x: s.x + this.ox, y: s.y + this.oy };
  }

  /** Pinta un punto si queda por delante de lo ya pintado (con `alpha` < 1, mezcla encima). */
  plot(x: number, y: number, z: number, c: RGBA | null) {
    if (!c || c[3] === 0) return;
    const s = toScreen(x, y, z);
    const px = Math.floor(s.x + this.ox);
    const py = Math.floor(s.y + this.oy);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) return;
    const i = py * this.canvas.width + px;
    const d = x + y + z;
    if (d < this.depth[i]! - 0.01) return;
    if (c[3] >= 255) {
      this.depth[i] = d;
      this.bordes[i] = this.borde ? 1 : 0;
    } else {
      if (this.capa[i] === this.capaActual) return;
      this.capa[i] = this.capaActual;
    }
    this.canvas.set(px, py, c);
  }

  /**
   * Superficie plana: desde `o`, `ulen` unidades a lo largo de `du` y `vlen` a lo largo de `dv`
   * (vectores unitarios o no: el tinte recibe la distancia recorrida en cada uno).
   */
  quad(o: V3, du: V3, dv: V3, ulen: number, vlen: number, tinte: Tinte) {
    this.nuevaCapa();
    const su = 0.55 / Math.max(0.2, screenLen(du));
    const sv = 0.55 / Math.max(0.2, screenLen(dv));
    for (let v = sv / 2; v < vlen; v += sv)
      for (let u = su / 2; u < ulen; u += su) {
        const c = tinte(u, v);
        if (c) this.plot(o[0] + du[0] * u + dv[0] * v, o[1] + du[1] * u + dv[1] * v, o[2] + du[2] * u + dv[2] * v, c);
      }
  }

  /**
   * Caja con sus tres caras visibles (arriba, +y a la izquierda y +x a la derecha). Cada tinte recibe
   * (u, v) de la cara: arriba u = x, v = y; en +y u = x, v = z; en +x u = y (de atrás hacia adelante), v = z.
   */
  box(x: number, y: number, z: number, w: number, d: number, h: number, top: Tinte | null, left: Tinte | null, right: Tinte | null) {
    if (top) this.quad([x, y, z + h], [1, 0, 0], [0, 1, 0], w, d, top);
    if (left) this.quad([x, y + d, z], [1, 0, 0], [0, 0, 1], w, h, left);
    if (right) this.quad([x + w, y, z], [0, 1, 0], [0, 0, 1], d, h, right);
  }

  /** Caja de un color por cara (luz desde arriba a la izquierda). */
  solid(x: number, y: number, z: number, w: number, d: number, h: number, top: RGBA, left: RGBA, right: RGBA) {
    this.box(x, y, z, w, d, h, () => top, () => left, () => right);
  }

  /**
   * Cilindro vertical (solo la mitad que mira a la cámara). El tinte recibe el ángulo (0 = +x, π/2 = +y)
   * y la altura sobre la base; `luz` va de -1 (sombra) a 1 (luz), según hacia dónde mira ese punto.
   */
  cylinder(cx: number, cy: number, z0: number, r: number, h: number, tinte: (ang: number, v: number, luz: number) => RGBA | null) {
    this.nuevaCapa();
    const da = 0.5 / Math.max(1, r * 1.3);
    const sv = 0.5;
    for (let a = -Math.PI / 4 - 0.25; a <= (3 * Math.PI) / 4 + 0.25; a += da) {
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      const luz = ny * 0.85 - nx * 0.35;
      for (let v = sv / 2; v < h; v += sv) this.plot(cx + nx * r, cy + ny * r, z0 + v, tinte(a, v, luz));
    }
  }

  /** Tapa circular (disco horizontal) de radio r a la altura z. */
  disc(cx: number, cy: number, z: number, r: number, tinte: (dx: number, dy: number) => RGBA | null) {
    this.nuevaCapa();
    for (let dy = -r; dy <= r; dy += 0.4)
      for (let dx = -r; dx <= r; dx += 0.4) if (dx * dx + dy * dy <= r * r) this.plot(cx + dx, cy + dy, z, tinte(dx, dy));
  }

  /** Cono (techo de la torre): de radio r en z0 a la punta en z0 + h. Tinte: ángulo, distancia por la falda y luz. */
  cone(cx: number, cy: number, z0: number, r: number, h: number, tinte: (ang: number, s: number, luz: number) => RGBA | null) {
    const slant = Math.hypot(r, h);
    for (let s = 0.2; s < slant; s += 0.4) {
      const k = s / slant;
      const rr = r * (1 - k);
      const da = 0.45 / Math.max(1, rr * 1.3);
      for (let a = -Math.PI / 2; a <= Math.PI; a += da) {
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        const luz = ny * 0.8 - nx * 0.3 + 0.25;
        this.plot(cx + nx * rr, cy + ny * rr, z0 + h * k, tinte(a, s, luz));
      }
    }
  }

  /** Sombra en el piso (rombo tramado), debajo de todo y sin contorno. */
  shadow(x: number, y: number, w: number, d: number, a = 0.3) {
    const col = alpha(SHADOW, a);
    for (let yy = y; yy < y + d; yy += 0.5)
      for (let xx = x; xx < x + w; xx += 0.5) {
        const q = this.p(xx, yy, 0);
        this.suelo.set(q.x, q.y, col);
      }
    // Evita la doble mezcla de los puntos repetidos: se normaliza el alfa al final.
    for (let i = 3; i < this.suelo.data.length; i += 4) if (this.suelo.data[i]! > 0) this.suelo.data[i] = col[3];
  }

  /** Sombra redonda en el piso. */
  roundShadow(cx: number, cy: number, r: number, a = 0.3) {
    const q = this.p(cx, cy, 0);
    const col = alpha(SHADOW, a);
    const tmp = new PixelCanvas(this.suelo.width, this.suelo.height);
    tmp.ellipse(q.x, q.y, r * 1.42, r * 0.71, [col[0], col[1], col[2], 255]);
    for (let i = 3; i < tmp.data.length; i += 4) if (tmp.data[i]) this.suelo.set(((i - 3) / 4) % tmp.width, Math.floor((i - 3) / 4 / tmp.width), col);
  }

  /**
   * Cierra el dibujo: contorno café donde una superficie queda delante de otra (salto de profundidad),
   * contorno exterior y las sombras del piso debajo.
   */
  sprite(salto = 7): Sprite {
    const { width: w, height: h } = this.canvas;
    const marks: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const d = this.depth[i]!;
        if (d === -Infinity) continue;
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (j < 0 || j >= w * h || !this.bordes[j]) continue;
          if (this.depth[j]! - d > salto) {
            marks.push(x, y);
            break;
          }
        }
      }
    for (let k = 0; k < marks.length; k += 2) this.canvas.set(marks[k]!, marks[k + 1]!, OUT);
    this.canvas.outline(OUT);
    const full = new PixelCanvas(w, h);
    full.data.set(this.suelo.data);
    for (let i = 0; i < this.canvas.data.length; i += 4) {
      if (!this.canvas.data[i + 3]) continue;
      full.set((i / 4) % w, Math.floor(i / 4 / w), [this.canvas.data[i]!, this.canvas.data[i + 1]!, this.canvas.data[i + 2]!, this.canvas.data[i + 3]!]);
    }
    // Se recorta al contenido (el lienzo se armó con margen de sobra): texturas más chicas.
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (full.data[(y * w + x) * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return { canvas: full, ox: this.ox, oy: this.oy };
    const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) out.data.set(full.data.subarray((y * w + x0) * 4, (y * w + x1 + 1) * 4), (y - y0) * out.width * 4);
    return { canvas: out, ox: this.ox - x0, oy: this.oy - y0 };
  }
}
