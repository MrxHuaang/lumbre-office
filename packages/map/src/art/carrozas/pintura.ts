// La pintura de las carrozas del Carnaval (VIR-173): las figuras de papel maché se pintan de frente a la
// cámara (el plano x + y constante de la vista isométrica se ve derecho, sin sesgo), así un rostro de
// cuatro avatares de alto se puede pintar con ojos, pestañas y brillos. Cada forma es una distancia con
// signo (SDF): adentro se "infla" como una almohada de papel maché y la luz (de arriba a la izquierda y
// de frente) le da el volumen con tramado entre los tonos de su rampa, el brillo del barniz y el borde
// del color oscuro de la misma rampa. Coordenadas en píxeles del lienzo de la parte.
import { OUT, SHADOW, mix } from "../palette";
import { PixelCanvas, alpha, bayer, hex, type Ramp, type RGBA } from "../pixel";

// ---------- Rampas con cambio de tono ----------

function rgbToHsl([r, g, b]: RGBA): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGBA {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), 255];
}

/** Gira el tono `h` hacia `to` (grados) una fracción `k`, por el camino corto. */
const toward = (h: number, to: number, k: number) => {
  const d = ((to - h + 540) % 360) - 180;
  return h + d * k;
};

/**
 * Rampa de seis tonos desde un color base (el del índice 3): las sombras bajan hacia el morado y las
 * luces suben hacia el amarillo, con más saturación en el medio (el estilo de la cabaña).
 */
export function rampa(base: string): Ramp {
  const [h, s, l] = rgbToHsl(hex(base));
  const pasos = [-0.36, -0.24, -0.12, 0, 0.13, 0.25];
  return pasos.map((k) => {
    const ll = Math.max(0.05, Math.min(0.96, l + k * (k < 0 ? Math.max(0.9, l * 1.5) : Math.max(0.9, (1 - l) * 1.6))));
    const hh = k < 0 ? toward(h, 262, -k * 0.55) : toward(h, 52, k * 0.45);
    const ss = Math.max(0, Math.min(1, s * (k < 0 ? 1 + k * 0.3 : 1 - k * 0.5) + (k === 0 ? 0.04 : 0)));
    return hslToRgb(hh, ss, ll);
  });
}

/** Un tono de la rampa (con índices fraccionarios redondeados). */
export const tono = (r: Ramp, i: number): RGBA => r[Math.max(0, Math.min(r.length - 1, Math.round(i)))]!;

// ---------- Formas (distancias con signo) ----------

/** Una forma: negativa adentro, positiva afuera, con su caja (para no recorrer el lienzo entero). */
export interface Forma {
  d(x: number, y: number): number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const circulo = (cx: number, cy: number, r: number): Forma => ({
  d: (x, y) => Math.hypot(x - cx, y - cy) - r,
  x0: cx - r,
  y0: cy - r,
  x1: cx + r,
  y1: cy + r,
});

/** Elipse (girada `ang` radianes). La distancia es aproximada, de sobra para el volumen. */
export function elipse(cx: number, cy: number, rx: number, ry: number, ang = 0): Forma {
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  const r = Math.max(rx, ry);
  return {
    d: (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * co + dy * si;
      const ly = -dx * si + dy * co;
      return (Math.hypot(lx / rx, ly / ry) - 1) * Math.min(rx, ry);
    },
    x0: cx - r,
    y0: cy - r,
    x1: cx + r,
    y1: cy + r,
  };
}

/** Cápsula de `a` a `b` que pasa del radio `ra` al `rb` (brazos, dedos, plumas, cuellos). */
export function capsula(ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Forma {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy || 1;
  const r = Math.max(ra, rb);
  return {
    d: (x, y) => {
      const h = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
      return Math.hypot(x - ax - vx * h, y - ay - vy * h) - (ra + (rb - ra) * h);
    },
    x0: Math.min(ax, bx) - r,
    y0: Math.min(ay, by) - r,
    x1: Math.max(ax, bx) + r,
    y1: Math.max(ay, by) + r,
  };
}

/** Rectángulo con las esquinas redondeadas `r`. */
export function caja(x0: number, y0: number, x1: number, y1: number, r = 0): Forma {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r;
  const hy = (y1 - y0) / 2 - r;
  return {
    d: (x, y) => {
      const qx = Math.abs(x - cx) - hx;
      const qy = Math.abs(y - cy) - hy;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    },
    x0,
    y0,
    x1,
    y1,
  };
}

/** Polígono (puntos en orden). Distancia exacta. */
export function poligono(pts: readonly (readonly [number, number])[]): Forma {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    d: (x, y) => {
      let d = Infinity;
      let s = 1;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[j]!;
        const ex = bx - ax;
        const ey = by - ay;
        const wx = x - ax;
        const wy = y - ay;
        const h = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
        d = Math.min(d, Math.hypot(wx - ex * h, wy - ey * h));
        const c1 = y >= ay;
        const c2 = y < by;
        const c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
      }
      return s * d;
    },
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

export function union(...fs: Forma[]): Forma {
  return {
    d: (x, y) => {
      let d = Infinity;
      for (const f of fs) d = Math.min(d, f.d(x, y));
      return d;
    },
    x0: Math.min(...fs.map((f) => f.x0)),
    y0: Math.min(...fs.map((f) => f.y0)),
    x1: Math.max(...fs.map((f) => f.x1)),
    y1: Math.max(...fs.map((f) => f.y1)),
  };
}

/** Unión suave (las formas se funden como papel maché, sin costura). */
export function fundir(a: Forma, b: Forma, k = 4): Forma {
  return {
    d: (x, y) => {
      const da = a.d(x, y);
      const db = b.d(x, y);
      const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (db - da)) / k));
      return db + (da - db) * h - k * h * (1 - h);
    },
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

export const resta = (a: Forma, b: Forma): Forma => ({ ...a, d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)) });
export const corte = (a: Forma, b: Forma): Forma => ({
  d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
});

/** La forma más gorda (o más flaca con k < 0): para los labios alrededor de la boca, ribetes. */
export const engordar = (f: Forma, k: number): Forma => ({ d: (x, y) => f.d(x, y) - k, x0: f.x0 - k, y0: f.y0 - k, x1: f.x1 + k, y1: f.y1 + k });

/** La forma girada `ang` radianes alrededor de (cx, cy). */
export function girada(f: Forma, cx: number, cy: number, ang: number): Forma {
  const co = Math.cos(-ang);
  const si = Math.sin(-ang);
  const r = Math.max(Math.hypot(f.x0 - cx, f.y0 - cy), Math.hypot(f.x1 - cx, f.y1 - cy), Math.hypot(f.x0 - cx, f.y1 - cy), Math.hypot(f.x1 - cx, f.y0 - cy));
  return {
    d: (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return f.d(cx + dx * co - dy * si, cy + dx * si + dy * co);
    },
    x0: cx - r,
    y0: cy - r,
    x1: cx + r,
    y1: cy + r,
  };
}

/** Espejo horizontal alrededor de x = cx. */
export const espejo = (f: Forma, cx: number): Forma => ({ d: (x, y) => f.d(2 * cx - x, y), x0: 2 * cx - f.x1, y0: f.y0, x1: 2 * cx - f.x0, y1: f.y1 });

// ---------- El pintor ----------

/** La luz: de arriba a la izquierda y de frente (normalizada). */
const LUZ: [number, number, number] = (() => {
  const v = [-0.5, -0.65, 0.58];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return [v[0]! / n, v[1]! / n, v[2]! / n];
})();
/** Medio camino entre la luz y la cámara (para el brillo del barniz). */
const MEDIO: [number, number, number] = (() => {
  const [a, b, c] = [LUZ[0], LUZ[1], LUZ[2] + 1];
  const n = Math.hypot(a, b, c);
  return [a / n, b / n, c / n];
})();

/** Lo que sabe un píxel de la forma al pintarlo (para los patrones). */
export interface Punto {
  x: number;
  y: number;
  /** Profundidad adentro de la forma (px desde el borde). */
  hondo: number;
  /** La luz que recibe (-1..1). */
  luz: number;
  nx: number;
  ny: number;
}

export interface VolumenOpts {
  /** Qué tan "inflada" (px hasta la parte más alta); por defecto, según el tamaño. */
  alto?: number;
  /** Corre los tonos (más claro con +). */
  base?: number;
  /** Contraste de la luz (cuántos tonos entre la sombra y la luz). */
  contraste?: number;
  /** Brillo del barniz (0 = mate). */
  brillo?: number;
  /** El borde: del tono oscuro de su rampa (`propio`), café oscuro (`oscuro`) o ninguno. */
  borde?: "propio" | "oscuro" | false;
  /** La sombrita que la forma tira sobre lo que ya está pintado (abajo a la derecha). */
  sombra?: number;
  /** Rampa por píxel (rayas, rombos, escamas): todo sale con la misma luz. */
  patron?: (p: Punto) => Ramp | null;
  /** Por planos nítidos (por defecto) o con el degradado tramado. */
  planos?: boolean;
  /** Un color encima del tono (pintura plana: ojos pintados, vetas). */
  pinta?: (p: Punto, c: RGBA) => RGBA | null;
}

export const OSCURO_CALIDO = hex("#3a1f22");

export class Pintura {
  readonly c: PixelCanvas;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new PixelCanvas(w, h);
  }

  private caja(f: Forma, m = 1) {
    return {
      x0: Math.max(0, Math.floor(f.x0) - m),
      y0: Math.max(0, Math.floor(f.y0) - m),
      x1: Math.min(this.w - 1, Math.ceil(f.x1) + m),
      y1: Math.min(this.h - 1, Math.ceil(f.y1) + m),
    };
  }

  /** La sombra que tira una forma sobre lo pintado (corrida dx, dy), antes de pintarla. */
  sombra(f: Forma, dx = 1, dy = 2, k = 0.38) {
    const b = this.caja(f, 3);
    const col = SHADOW;
    for (let y = b.y0; y <= b.y1 + dy; y++)
      for (let x = b.x0; x <= b.x1 + dx; x++) {
        if (x >= this.w || y >= this.h) continue;
        if (f.d(x + 0.5, y + 0.5) <= 0 || f.d(x + 0.5 - dx, y + 0.5 - dy) > 0) continue;
        const i = (y * this.w + x) * 4;
        if (!this.c.data[i + 3]) continue;
        const old: RGBA = [this.c.data[i]!, this.c.data[i + 1]!, this.c.data[i + 2]!, 255];
        const m = mix(old, col, k);
        this.c.data[i] = m[0];
        this.c.data[i + 1] = m[1];
        this.c.data[i + 2] = m[2];
      }
  }

  /** Rellena una forma con volumen de papel maché. */
  volumen(f: Forma, r: Ramp, o: VolumenOpts = {}) {
    if (o.sombra) this.sombra(f, 1, 2, o.sombra);
    const alto = o.alto ?? Math.max(2, Math.min(f.x1 - f.x0, f.y1 - f.y0) / 2.4);
    const base = (r.length - 1) * 0.55 + (o.base ?? 0);
    const contraste = o.contraste ?? 3.4;
    const brillo = o.brillo ?? 0.55;
    const borde = o.borde ?? "propio";
    const altura = (d: number) => {
      if (d >= 0) return 0;
      const k = Math.min(1, -d / alto);
      return alto * Math.sqrt(1 - (1 - k) * (1 - k));
    };
    const b = this.caja(f);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        const d = f.d(cx, cy);
        if (d > 0) continue;
        const dl = f.d(cx - 1, cy);
        const dr = f.d(cx + 1, cy);
        const du = f.d(cx, cy - 1);
        const dd = f.d(cx, cy + 1);
        let nx = (altura(dl) - altura(dr)) / 2;
        let ny = (altura(du) - altura(dd)) / 2;
        let nz = 1;
        const n = Math.hypot(nx, ny, nz);
        nx /= n;
        ny /= n;
        nz /= n;
        const luz = nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2];
        const p: Punto = { x, y, hondo: -d, luz, nx, ny };
        const rr = o.patron?.(p) ?? r;
        const top = rr.length - 1;
        // Por planos (como pintado a mano): bandas nítidas de luz y sombra, con un tramado solo en la orilla
        // entre una banda y otra; o el degradado tramado de antes.
        let t: number;
        if (o.planos !== false) {
          const k = (luz - 0.5) * contraste * 0.42 + (bayer(x, y) - 0.5) * 0.18;
          t = base + (k > 0.55 ? 1.4 : k > 0.15 ? 0.6 : k > -0.25 ? -0.3 : k > -0.7 ? -1.3 : -2.3);
        } else t = base + (luz - 0.55) * contraste + (bayer(x, y) - 0.5) * 0.85;
        // Luz rebotada en el borde de la sombra: el papel brillante no se ve plano.
        if (-d < 1.6 && luz < 0.15) t += 0.8;
        const spec = Math.pow(Math.max(0, nx * MEDIO[0] + ny * MEDIO[1] + nz * MEDIO[2]), 24);
        if (brillo > 0 && spec > 1 - brillo * 0.5) t = top + 0.4;
        const edge = dl > 0 || dr > 0 || du > 0 || dd > 0;
        let col: RGBA;
        if (edge && borde === "oscuro") col = mix(rr[0]!, OSCURO_CALIDO, 0.55);
        else if (edge && borde === "propio") col = tono(rr, Math.min(t, top) - (luz > 0.55 ? 1 : 2));
        else col = t > top ? mix(rr[top]!, [255, 253, 240, 255], Math.min(0.6, (t - top) * 1.2)) : tono(rr, t);
        const pc = o.pinta?.(p, col);
        this.c.set(x, y, pc ?? col);
      }
  }

  /** Pintura plana (sin volumen): rayas pintadas a mano, pupilas, bocas. */
  plano(f: Forma, col: RGBA | ((x: number, y: number) => RGBA | null)) {
    const b = this.caja(f);
    for (let y = b.y0; y <= b.y1; y++)
      for (let x = b.x0; x <= b.x1; x++) {
        if (f.d(x + 0.5, y + 0.5) > 0) continue;
        const c = typeof col === "function" ? col(x, y) : col;
        if (c) this.c.set(x, y, c);
      }
  }

  punto(x: number, y: number, c: RGBA) {
    this.c.set(x, y, c);
  }

  /** Trazo de grosor `g` (pestañas, cejas, vetas de plumas). */
  trazo(x0: number, y0: number, x1: number, y1: number, c: RGBA, g = 1) {
    if (g <= 1) return this.c.line(x0, y0, x1, y1, c);
    this.plano(capsula(x0, y0, x1, y1, g / 2), c);
  }

  /** Curva cuadrática (cejas, sonrisas, pestañas curvas). */
  curva(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: RGBA, g = 1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 2;
    let px = x0;
    let py = y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const qx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
      const qy = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
      this.trazo(px, py, qx, qy, c, g);
      px = qx;
      py = qy;
    }
  }

  /** Luz de noche (bandas tramadas, como los faroles de la cabaña). */
  foco(cx: number, cy: number, r: number, col: RGBA, a = 0.5) {
    this.c.glow(cx, cy, r, r, col, a, 3);
  }

  /** Contorno exterior café oscuro (el del pixel art de la cabaña). */
  contorno(col: RGBA = OUT) {
    this.c.outline(col);
  }
}

/** Mezcla con transparencia (para tintes de noche y velos). */
export const velo = (c: RGBA, a: number): RGBA => alpha(c, a);
