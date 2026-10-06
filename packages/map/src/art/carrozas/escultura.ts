// Las carrozas como esculturas de papel maché (VIR-173): cada figura se arma en 3D con elipsoides,
// cápsulas, conos, cajas y láminas, en las mismas coordenadas de la plataforma (vista isométrica 2:1),
// y se pinta punto a punto con la luz de la cabaña (de arriba a la izquierda): el lado iluminado, el lado
// en sombra, la sombra que cada pieza tira sobre las demás (un mapa de sombras desde la luz: bajo el
// mentón, la nariz, los brazos y cada pluma), la oclusión donde se tocan las piezas, el brillo del barniz
// y un brillo en los bordes. Los rasgos pintados (ojos, bocas, patrones) son calcomanías 2D que se pegan
// sobre la superficie y reciben la misma luz.
//
// Cada parte que se mueve (cabeza, alas, manos…) se pinta en su propio lienzo, con su pivote, para que el
// navegador la gire y la corra; el mapa de sombras se arma con todas juntas, en la pose de reposo.
import { OUT, SHADOW, mix } from "../palette";
import { PixelCanvas, alpha, bayer, toScreen, type Ramp, type RGBA } from "../pixel";
import type { Movimiento, Parte } from "./partes";

export type V3 = readonly [number, number, number];

const norm = (v: V3): [number, number, number] => {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
export const cruz = (a: V3, b: V3): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const suma = (a: V3, ...bs: V3[]): [number, number, number] => {
  const r: [number, number, number] = [a[0], a[1], a[2]];
  for (const b of bs) {
    r[0] += b[0];
    r[1] += b[1];
    r[2] += b[2];
  }
  return r;
};
export const por = (a: V3, k: number): [number, number, number] => [a[0] * k, a[1] * k, a[2] * k];

/** La luz de la cabaña: de arriba a la izquierda (las caras +y más claras que las +x), como en la Escena. */
export const LUZ = norm([-0.33, 0.55, 0.77]);
/** Hacia la cámara (lo más cercano tiene x + y + z más grande). */
const VISTA = norm([1, 1, 1]);
const MEDIO = norm([LUZ[0] + VISTA[0], LUZ[1] + VISTA[1], LUZ[2] + VISTA[2]]);

/**
 * Un marco local: `der` (la derecha de la figura), `arr` (arriba) y `fre` (hacia donde mira). Las
 * coordenadas locales que reciben los tintes van de -1 a 1 en cada eje del elipsoide.
 */
export interface Marco {
  der: V3;
  arr: V3;
  fre: V3;
}

/** El marco de una figura que mira hacia el ángulo `ang` (0 = +x, el sentido del desfile; π/2 = +y). */
export function mirando(ang: number, inclina = 0): Marco {
  const fre = norm([Math.cos(ang) * Math.cos(inclina), Math.sin(ang) * Math.cos(inclina), Math.sin(inclina)]);
  const der = norm(cruz(fre, [0, 0, 1]));
  const arr = norm(cruz(der, fre));
  return { der, arr, fre };
}

/** Un marco girado: `fre` hacia la dirección dada, con `arr` lo más cerca posible de `arriba`. */
export function hacia(dir: V3, arriba: V3 = [0, 0, 1]): Marco {
  const fre = norm(dir);
  let der = cruz(fre, arriba);
  if (Math.hypot(der[0], der[1], der[2]) < 1e-3) der = cruz(fre, [1, 0, 0]);
  der = norm(der);
  const arr = norm(cruz(der, fre));
  return { der, arr, fre };
}

/** En un punto del marco: c + der·a + arr·b + fre·f. */
export const en = (c: V3, m: Marco, a: number, b: number, f: number): [number, number, number] => suma(c, por(m.der, a), por(m.arr, b), por(m.fre, f));

/** Lo que recibe un tinte. `l` = coordenadas locales (-1..1) del primitivo; `u`, `v` = coordenadas de la cara. */
export interface Toque {
  p: V3;
  n: V3;
  l: V3;
  u: number;
  v: number;
}

/** Un material: una rampa (con su corrimiento de tono) o un color pintado (calcomanía), con su brillo. */
export type Mat = { r: Ramp; t?: number; brillo?: number } | { c: RGBA; brillo?: number };
export type Tinte = (q: Toque) => Mat | null;

/** Un material liso de una rampa. */
export const liso =
  (r: Ramp, t = 0, brillo = 0.5): Tinte =>
  () => ({ r, t, brillo });

interface ParteDef {
  id: string;
  pivote: V3;
  mov?: Movimiento;
  padre?: string;
  /** Sombras planas en el suelo (debajo de todo, sin contorno). */
  suelo: { x: number; y: number; z: number; w: number; d: number; a: number }[];
  /** Si recibe el contorno café. */
  contorno: boolean;
}

/** Una calcomanía 2D (ojos, bocas, patrones) para pegar sobre un elipsoide: se lee con las coordenadas locales. */
export interface Calco {
  canvas: PixelCanvas;
}

/** El color de una calcomanía en las coordenadas locales (a = -der … der, b = arr): el lienzo va de -1 a 1. */
export function leerCalco(c: PixelCanvas, a: number, b: number): RGBA | null {
  const x = Math.floor(((-a + 1) / 2) * c.width);
  const y = Math.floor(((-b + 1) / 2) * c.height);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null;
  const i = (y * c.width + x) * 4;
  if (c.data[i + 3]! < 128) return null;
  return [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, 255];
}

/**
 * El escultor: junta los puntos de la superficie de cada parte y al final los pinta con la luz y las
 * sombras. Paso de muestreo ~0,45 unidades de arte (no quedan huecos en pantalla).
 */
export class Escultor {
  private readonly partes: ParteDef[] = [];
  private actual = -1;
  // Las muestras: posición, normal, parte, material.
  private px: number[] = [];
  private nx: number[] = [];
  private parteDe: number[] = [];
  private mats: Mat[] = [];
  paso = 0.45;

  /** Empieza (o retoma) una parte. Lo que se agregue después va en ella. */
  parte(id: string, pivote: V3, o: { mov?: Movimiento; padre?: string; contorno?: boolean } = {}) {
    const i = this.partes.findIndex((p) => p.id === id);
    if (i >= 0) {
      this.actual = i;
      return this;
    }
    this.partes.push({ id, pivote, suelo: [], contorno: o.contorno ?? true, ...(o.mov ? { mov: o.mov } : {}), ...(o.padre ? { padre: o.padre } : {}) });
    this.actual = this.partes.length - 1;
    return this;
  }

  /** Sombra plana en el suelo de la parte actual (debajo de la plataforma). */
  sombraSuelo(x: number, y: number, z: number, w: number, d: number, a = 0.32) {
    this.partes[this.actual]!.suelo.push({ x, y, z, w, d, a });
  }

  private poner(p: V3, n: V3, m: Mat | null) {
    if (!m) return;
    // Lo que mira para atrás no se ve (salvo los bordes).
    if (punto(n, VISTA) < -0.25) return;
    this.px.push(p[0], p[1], p[2]);
    this.nx.push(n[0], n[1], n[2]);
    this.parteDe.push(this.actual);
    this.mats.push(m);
  }

  /** Elipsoide con su marco (radios a lo largo de der, arr y fre). */
  elipsoide(c: V3, ra: number, rb: number, rf: number, m: Marco, tinte: Tinte, corte?: (l: V3) => boolean) {
    const r = Math.max(ra, rb, rf);
    const de = this.paso / r;
    for (let e = -Math.PI / 2 + de / 2; e < Math.PI / 2; e += de) {
      const ce = Math.cos(e);
      const se = Math.sin(e);
      const da = this.paso / Math.max(0.3, r * ce);
      for (let a = -Math.PI; a < Math.PI; a += da) {
        const la = Math.cos(a) * ce;
        const lf = Math.sin(a) * ce;
        const l: V3 = [la, se, lf];
        if (corte && !corte(l)) continue;
        const p = en(c, m, la * ra, se * rb, lf * rf);
        const n = norm(en([0, 0, 0], m, la / ra, se / rb, lf / rf));
        this.poner(p, n, tinte({ p, n, l, u: a, v: e }));
      }
    }
  }

  /** Esfera. */
  esfera(c: V3, r: number, tinte: Tinte) {
    this.elipsoide(c, r, r, r, { der: [1, 0, 0], arr: [0, 0, 1], fre: [0, 1, 0] }, tinte);
  }

  /** Cápsula de `a` a `b` que pasa del radio `ra` al `rb` (brazos, cuellos, dedos, palos). l = [ángulo, t, 0]. */
  capsula(a: V3, b: V3, ra: number, rb: number, tinte: Tinte, tapas = true) {
    const eje = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const len = Math.hypot(eje[0], eje[1], eje[2]) || 1;
    const m = hacia(eje, Math.abs(eje[2]) / len > 0.9 ? [1, 0, 0] : [0, 0, 1]);
    const r = Math.max(ra, rb);
    for (let t = 0; t <= len; t += this.paso) {
      const k = t / len;
      const rr = ra + (rb - ra) * k;
      const da = this.paso / Math.max(0.3, rr);
      for (let ang = -Math.PI; ang < Math.PI; ang += da) {
        const n: V3 = suma(por(m.der, Math.cos(ang)), por(m.arr, Math.sin(ang)));
        const p = suma(a, por(m.fre, t), por(n, rr));
        this.poner(p, n, tinte({ p, n, l: [ang, k, 0], u: ang, v: t }));
      }
    }
    if (tapas)
      for (const [c, rr, s] of [
        [a, ra, -1],
        [b, rb, 1],
      ] as const) {
        const de = this.paso / Math.max(0.3, rr);
        for (let e = 0; e < Math.PI / 2; e += de) {
          const ce = Math.cos(e);
          const da = this.paso / Math.max(0.3, rr * ce);
          for (let ang = -Math.PI; ang < Math.PI; ang += da) {
            const n: V3 = suma(por(m.der, Math.cos(ang) * ce), por(m.arr, Math.sin(ang) * ce), por(m.fre, Math.sin(e) * s));
            const p = suma(c, por(n, rr));
            this.poner(p, n, tinte({ p, n, l: [ang, s > 0 ? 1 : 0, Math.sin(e) * s], u: ang, v: s > 0 ? len : 0 }));
          }
        }
      }
    void r;
  }

  /** Cono vertical (volcanes, sombreros): de radio r en z0 a la punta en z0 + h. l = [ángulo, k de la altura, 0]. */
  cono(cx: number, cy: number, z0: number, r: number, h: number, tinte: Tinte, r1 = 0) {
    const sl = Math.hypot(r - r1, h);
    for (let s = 0; s < sl; s += this.paso) {
      const k = s / sl;
      const rr = r + (r1 - r) * k;
      const da = this.paso / Math.max(0.3, rr);
      for (let a = -Math.PI; a < Math.PI; a += da) {
        const n = norm([Math.cos(a) * h, Math.sin(a) * h, r - r1]);
        const p: V3 = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z0 + h * k];
        this.poner(p, n, tinte({ p, n, l: [a, k, 0], u: a, v: s }));
      }
    }
  }

  /** Disco (tapa) horizontal. */
  disco(cx: number, cy: number, z: number, r: number, tinte: Tinte) {
    for (let y = -r; y <= r; y += this.paso)
      for (let x = -r; x <= r; x += this.paso)
        if (x * x + y * y <= r * r) {
          const p: V3 = [cx + x, cy + y, z];
          this.poner(p, [0, 0, 1], tinte({ p, n: [0, 0, 1], l: [x / r, y / r, 0], u: x, v: y }));
        }
  }

  /**
   * Lámina plana (banderas, letreros, pétalos): desde `o`, `ul` a lo largo de `du` y `vl` a lo largo de
   * `dv`. Se ve por las dos caras. `forma(u, v)` recorta (true = va).
   */
  lamina(o: V3, du: V3, dv: V3, ul: number, vl: number, tinte: Tinte, forma?: (u: number, v: number) => boolean) {
    const a = norm(du);
    const b = norm(dv);
    let n = norm(cruz(a, b));
    if (punto(n, VISTA) < 0) n = [-n[0], -n[1], -n[2]];
    for (let v = this.paso / 2; v < vl; v += this.paso)
      for (let u = this.paso / 2; u < ul; u += this.paso) {
        if (forma && !forma(u, v)) continue;
        const p = suma(o, por(a, u), por(b, v));
        this.poner(p, n, tinte({ p, n, l: [u / ul, v / vl, 0], u, v }));
      }
  }

  /** Caja con sus tres caras visibles (arriba; +y, a la izquierda; +x, a la derecha), como en la Escena. */
  caja(x: number, y: number, z: number, w: number, d: number, h: number, top: Tinte | null, left: Tinte | null, right: Tinte | null) {
    const s = this.paso;
    if (top)
      for (let v = s / 2; v < d; v += s)
        for (let u = s / 2; u < w; u += s) {
          const p: V3 = [x + u, y + v, z + h];
          this.poner(p, [0, 0, 1], top({ p, n: [0, 0, 1], l: [u / w, v / d, 1], u, v }));
        }
    if (left)
      for (let v = s / 2; v < h; v += s)
        for (let u = s / 2; u < w; u += s) {
          const p: V3 = [x + u, y + d, z + v];
          this.poner(p, [0, 1, 0], left({ p, n: [0, 1, 0], l: [u / w, v / h, 0], u, v }));
        }
    if (right)
      for (let v = s / 2; v < h; v += s)
        for (let u = s / 2; u < d; u += s) {
          const p: V3 = [x + w, y + u, z + v];
          this.poner(p, [1, 0, 0], right({ p, n: [1, 0, 0], l: [u / d, v / h, 0], u, v }));
        }
  }

  /** Cilindro horizontal a lo largo de x (ruedas vistas de lado, rollos): solo lo que mira a la cámara. */
  rueda(cx: number, cy: number, cz: number, r: number, ancho: number, tinte: Tinte) {
    // La cara de afuera (+y) como disco vertical y el canto.
    for (let v = -r; v <= r; v += this.paso)
      for (let u = -r; u <= r; u += this.paso)
        if (u * u + v * v <= r * r) {
          const p: V3 = [cx + u, cy + ancho, cz + v];
          this.poner(p, [0, 1, 0], tinte({ p, n: [0, 1, 0], l: [u / r, v / r, 1], u, v }));
        }
    for (let t = 0; t < ancho; t += this.paso)
      for (let a = -Math.PI; a < Math.PI; a += this.paso / r) {
        const n: V3 = [Math.cos(a), 0, Math.sin(a)];
        const p: V3 = [cx + n[0] * r, cy + t, cz + n[2] * r];
        this.poner(p, n, tinte({ p, n, l: [Math.cos(a), Math.sin(a), 0], u: a, v: t }));
      }
  }

  /**
   * Pinta todo: proyecta cada muestra, se queda con la más cercana a la cámara por parte, calcula el mapa
   * de sombras desde la luz con todas las partes juntas, y sombrea (luz, sombra, oclusión, brillos).
   */
  render(): Parte[] {
    const n = this.parteDe.length;
    // Lo que cubre en pantalla.
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = toScreen(this.px[i * 3]!, this.px[i * 3 + 1]!, this.px[i * 3 + 2]!);
      sx[i] = s.x;
      sy[i] = s.y;
      if (s.x < x0) x0 = s.x;
      if (s.y < y0) y0 = s.y;
      if (s.x > x1) x1 = s.x;
      if (s.y > y1) y1 = s.y;
    }
    for (const pd of this.partes)
      for (const g of pd.suelo)
        for (const [gx, gy] of [
          [g.x, g.y],
          [g.x + g.w, g.y + g.d],
          [g.x, g.y + g.d],
          [g.x + g.w, g.y],
        ] as const) {
          const s = toScreen(gx, gy, g.z);
          x0 = Math.min(x0, s.x);
          x1 = Math.max(x1, s.x);
          y0 = Math.min(y0, s.y);
          y1 = Math.max(y1, s.y);
        }
    const pad = 3;
    const ox = Math.ceil(-x0) + pad;
    const oy = Math.ceil(-y0) + pad;
    const W = Math.ceil(x1 - x0) + pad * 2 + 1;
    const H = Math.ceil(y1 - y0) + pad * 2 + 1;
    const P = this.partes.length;

    // El mapa de sombras: cada muestra en el plano perpendicular a la luz, con su altura hacia la luz.
    const e1 = norm(cruz(LUZ, [0, 0, 1]));
    const e2 = norm(cruz(LUZ, e1));
    let a0 = Infinity;
    let b0 = Infinity;
    let a1 = -Infinity;
    let b1 = -Infinity;
    const la = new Float32Array(n);
    const lb = new Float32Array(n);
    const ld = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p: V3 = [this.px[i * 3]!, this.px[i * 3 + 1]!, this.px[i * 3 + 2]!];
      la[i] = punto(p, e1);
      lb[i] = punto(p, e2);
      ld[i] = punto(p, LUZ);
      a0 = Math.min(a0, la[i]!);
      b0 = Math.min(b0, lb[i]!);
      a1 = Math.max(a1, la[i]!);
      b1 = Math.max(b1, lb[i]!);
    }
    const CEL = 0.9;
    const MW = Math.ceil((a1 - a0) / CEL) + 2;
    const MH = Math.ceil((b1 - b0) / CEL) + 2;
    const mapa = new Float32Array(MW * MH).fill(-Infinity);
    const celda = (i: number) => Math.floor((la[i]! - a0) / CEL) + Math.floor((lb[i]! - b0) / CEL) * MW;
    for (let i = 0; i < n; i++) {
      const c = celda(i);
      if (ld[i]! > mapa[c]!) mapa[c] = ld[i]!;
    }

    // La profundidad de todas las partes juntas (para la oclusión) y la de cada parte.
    const todo = new Float32Array(W * H).fill(-Infinity);
    const depth = Array.from({ length: P }, () => new Float32Array(W * H).fill(-Infinity));
    const quien = Array.from({ length: P }, () => new Int32Array(W * H).fill(-1));
    for (let i = 0; i < n; i++) {
      const x = Math.floor(sx[i]! + ox);
      const y = Math.floor(sy[i]! + oy);
      const k = y * W + x;
      const d = this.px[i * 3]! + this.px[i * 3 + 1]! + this.px[i * 3 + 2]!;
      const pi = this.parteDe[i]!;
      if (d > depth[pi]![k]!) {
        depth[pi]![k] = d;
        quien[pi]![k] = i;
      }
      if (d > todo[k]!) todo[k] = d;
    }

    const out: Parte[] = [];
    this.partes.forEach((pd, pi) => {
      const canvas = new PixelCanvas(W, H);
      for (const g of pd.suelo) {
        const col = alpha(SHADOW, g.a);
        const tmp = new PixelCanvas(W, H);
        for (let yy = g.y; yy < g.y + g.d; yy += 0.5)
          for (let xx = g.x; xx < g.x + g.w; xx += 0.5) {
            const s = toScreen(xx, yy, g.z);
            tmp.set(s.x + ox, s.y + oy, [col[0], col[1], col[2], 255]);
          }
        for (let i = 3; i < tmp.data.length; i += 4) if (tmp.data[i]) canvas.set(((i - 3) / 4) % W, Math.floor((i - 3) / 4 / W), col);
      }
      const body = new PixelCanvas(W, H);
      const dp = depth[pi]!;
      const qp = quien[pi]!;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const k = y * W + x;
          const i = qp[k]!;
          if (i < 0) continue;
          body.set(x, y, this.sombrear(i, x, y, k, W, H, todo, mapa, celda(i), ld[i]!));
        }
      // El contorno café donde una superficie de la parte queda muy por delante de otra, y el de afuera.
      if (pd.contorno) {
        const marks: number[] = [];
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const k = y * W + x;
            const d = dp[k]!;
            if (d === -Infinity) continue;
            const cerca = (j: number) => dp[j]! - d > 4.5;
            if ((x > 0 && cerca(k - 1)) || (x < W - 1 && cerca(k + 1)) || (y > 0 && cerca(k - W)) || (y < H - 1 && cerca(k + W))) marks.push(x, y);
          }
        for (let k = 0; k < marks.length; k += 2) body.set(marks[k]!, marks[k + 1]!, mix(OUT, body_at(body, marks[k]!, marks[k + 1]!), 0.25));
        body.outline(OUT);
      }
      for (let i = 0; i < body.data.length; i += 4) if (body.data[i + 3]) canvas.set((i / 4) % W, Math.floor(i / 4 / W), [body.data[i]!, body.data[i + 1]!, body.data[i + 2]!, body.data[i + 3]!]);
      const piv = toScreen(pd.pivote[0], pd.pivote[1], pd.pivote[2]);
      const rec = recorte(canvas, piv.x + ox, piv.y + oy);
      out.push({ id: pd.id, canvas: rec.canvas, px: rec.px, py: rec.py, x: piv.x, y: piv.y, ...(pd.mov ? { mov: pd.mov } : {}), ...(pd.padre ? { padre: pd.padre } : {}) });
    });
    return out;
  }

  private sombrear(i: number, x: number, y: number, k: number, W: number, H: number, todo: Float32Array, mapa: Float32Array, c: number, dl: number): RGBA {
    const n: V3 = [this.nx[i * 3]!, this.nx[i * 3 + 1]!, this.nx[i * 3 + 2]!];
    const m = this.mats[i]!;
    const lam = punto(n, LUZ);
    const enSombra = mapa[c]! - dl > 1.6;
    const d = this.px[i * 3]! + this.px[i * 3 + 1]! + this.px[i * 3 + 2]!;
    // Oclusión: lo que está apenas por delante alrededor (donde se tocan las piezas).
    let oc = 0;
    for (const [dx, dy] of OCLUSION) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const dd = todo[yy * W + xx]! - d;
      if (dd > 1.2 && dd < 14) oc++;
    }
    const ao = Math.min(1, oc / 5);
    const luz = enSombra ? Math.min(lam * 0.4, 0.05) - 0.22 : lam;
    const brillo = m.brillo ?? 0.5;
    const spec = !enSombra && brillo > 0 ? Math.pow(Math.max(0, punto(n, MEDIO)), 22) : 0;
    const borde = punto(n, VISTA) < 0.3 && lam > 0.1 && !enSombra;
    const tr = (bayer(x, y) - 0.5) * 0.5;
    void k;
    if ("r" in m) {
      const top = m.r.length - 1;
      let t = top * 0.6 + (m.t ?? 0) + (luz - 0.38) * 3.3 + tr - ao * 1.3;
      if (borde) t += 0.8;
      if (spec > 1 - brillo * 0.45) return mix(m.r[top]!, [255, 252, 238, 255], 0.35);
      return m.r[Math.max(0, Math.min(top, Math.round(t)))]!;
    }
    let f = 0.96 + (luz - 0.42) * 0.34 - ao * 0.14 + tr * 0.06 + (borde ? 0.08 : 0);
    if (spec > 1 - brillo * 0.45) f += 0.25;
    return [Math.min(255, Math.round(m.c[0] * f)), Math.min(255, Math.round(m.c[1] * f)), Math.min(255, Math.round(m.c[2] * f)), 255];
  }
}

const OCLUSION = [
  [-2, 0],
  [2, 0],
  [0, -2],
  [0, 2],
  [-2, -2],
  [2, -2],
  [-2, 2],
  [2, 2],
  [-3, 0],
  [3, 0],
] as const;

function body_at(c: PixelCanvas, x: number, y: number): RGBA {
  const i = (y * c.width + x) * 4;
  return [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, 255];
}

function recorte(c: PixelCanvas, px: number, py: number): { canvas: PixelCanvas; px: number; py: number } {
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (c.data[(y * c.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { canvas: new PixelCanvas(1, 1), px: 0, py: 0 };
  const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.data.set(c.data.subarray((y * c.width + x0) * 4, (y * c.width + x1 + 1) * 4), (y - y0) * out.width * 4);
  return { canvas: out, px: px - x0, py: py - y0 };
}
