// La decoración del Carnaval de Negros y Blancos (VIR-176, catálogo en world/catalog-carnaval.ts): lo que el
// festival pone en la vereda de la calle del Megabús, el portón y la pradera. El carnaval de Pasto es de
// colores intensos y de día: banderines en cuerdas que se cruzan, faroles de papel, la tarima del concurso,
// los puestos (máscaras, maicena y serpentinas, y la comida pastusa: frito, empanadas de añejo, hervido y
// helado de paila) con su vendedora, los arcos con el letrero pintado a mano, graderías, vallas, la tarima
// de la murga, muñecos de papel maché, globos, guirnaldas y confeti. Las carrozas no están aquí
// (art/carnaval.ts).
//
// Pixel art pintado a mano (docs/estandar-arte.md): las piezas chicas (máscaras, banderines, faroles,
// globos, comida, el muñeco y el cuy) son grillas de letras que reciben la luz de arriba a la izquierda y un
// contorno cálido del material de al lado; lo grande (mostradores, tarimas, arcos, toldos) son caras
// isométricas pintadas píxel a píxel (tablas con veta, telas plisadas, franjas, festones), con la luz arriba,
// la cara de la izquierda a media luz y la de la derecha en sombra; los postes, columnas de tres o cuatro
// píxeles con su lado claro y su lado oscuro. Lo que se mueve tiene cuadros (`CARNAVAL_DECOR_FRAMES`) que el
// navegador pasa en bucle con `carnavalDecorSprite`. Coordenadas locales de arte (tile = 16).
import { TEJIDO, type LookInput } from "@hyvento/shared";
import { drawCharacter, FEET_Y, FRAME, SHEET_DIRECTIONS, type SheetDirection } from "./chibi";
import { glyph } from "./digits";
import { C, OUT, SHADOW, mix } from "./palette";
import { PixelCanvas, alpha, at, hex, noise, type Ramp, type RGBA, type Sprite } from "./pixel";

// ---------- Colores ----------

/** Rampa de seis tonos alrededor de un color (0 = contorno, 1 = sombra honda, 3 = base, 5 = brillo). */
const hexRamp = (h: string): Ramp => {
  const c = hex(h);
  const k = (t: number): RGBA => (t < 0 ? mix(c, [46, 18, 34, 255], -t) : mix(c, [255, 250, 222, 255], t));
  return [k(-0.66), k(-0.42), k(-0.2), c, k(0.3), k(0.6)];
};

const ROJO = hexRamp("#e5303a");
const AMARILLO = hexRamp("#ffc31a");
const VERDE = hexRamp("#27ad48");
const AZUL = hexRamp("#2a6ce6");
const MAGENTA = hexRamp("#e2329a");
const NARANJA = hexRamp("#ff7618");
const CIAN = hexRamp("#17bfd4");
const MORADO = hexRamp("#8b3bd6");
const BLANCO = hexRamp("#f1ebdc");
const NEGRO = hexRamp("#3a3047");
const PIEL = hexRamp("#e2a874");
const ROSA = hexRamp("#f08aa8");
const CAFE = hexRamp("#a8682e");
const PAJA = hexRamp("#e2c06a");
const BARRO = C.terracotta;
const METAL = C.metal;
const ORO = C.gold;
const MADERA = C.wood;
const OSCURA = C.woodDark;
/** Los colores de la fiesta, en el orden en que se reparten. */
const FIESTA: Ramp[] = [ROJO, AMARILLO, VERDE, AZUL, MAGENTA, NARANJA, CIAN, MORADO];
const TEJ = TEJIDO.map(hexRamp);

type Pinta = (u: number, v: number) => RGBA | null;
type V3 = [number, number, number];
/** Un material de grilla: su rampa y el tono (con luz automática), o un color fijo. */
type Mat = [Ramp, number] | RGBA;
type Ley = Record<string, Mat>;
const esRampa = (m: Mat): m is [Ramp, number] => Array.isArray(m[0]);

/** Cuadros de lo que se mueve. */
const CUADROS = 4;

// ---------- El lienzo ----------

/**
 * Un lienzo de pixel art con la proyección isométrica del juego: `p` lleva un punto del mundo (arte) a la
 * pantalla, `plano` pinta una cara píxel a píxel (cada píxel sabe dónde cae en la cara), `estampa` pinta
 * una grilla de letras y `poste` una columna redonda de pocos píxeles. Se pinta de atrás hacia adelante.
 */
class Lienzo {
  readonly c: PixelCanvas;
  readonly ox: number;
  readonly oy: number;

  constructor(w: number, d: number, h: number, pad = 28) {
    this.c = new PixelCanvas((w + d) * 16 + pad * 2, (w + d) * 8 + h + pad * 2);
    this.ox = d * 16 + pad;
    this.oy = h + pad;
  }

  p(x: number, y: number, z = 0) {
    return { x: this.ox + x - y, y: this.oy + (x + y) / 2 - z };
  }

  set(x: number, y: number, col: RGBA | null) {
    if (col) this.c.set(Math.floor(x), Math.floor(y), col);
  }

  /** Una cara plana: desde `o`, `ulen` a lo largo de `du` y `vlen` a lo largo de `dv`; `pinta(u, v)` da cada píxel. */
  plano(o: V3, du: V3, dv: V3, ulen: number, vlen: number, pinta: Pinta) {
    const s0 = this.p(o[0], o[1], o[2]);
    const su = { x: du[0] - du[1], y: (du[0] + du[1]) / 2 - du[2] };
    const sv = { x: dv[0] - dv[1], y: (dv[0] + dv[1]) / 2 - dv[2] };
    const det = su.x * sv.y - su.y * sv.x;
    if (Math.abs(det) < 1e-6) return;
    const xs = [0, su.x * ulen, sv.x * vlen, su.x * ulen + sv.x * vlen].map((k) => s0.x + k);
    const ys = [0, su.y * ulen, sv.y * vlen, su.y * ulen + sv.y * vlen].map((k) => s0.y + k);
    for (let py = Math.floor(Math.min(...ys)); py <= Math.ceil(Math.max(...ys)); py++)
      for (let px = Math.floor(Math.min(...xs)); px <= Math.ceil(Math.max(...xs)); px++) {
        const cx = px + 0.5 - s0.x;
        const cy = py + 0.5 - s0.y;
        const u = (cx * sv.y - cy * sv.x) / det;
        const v = (su.x * cy - su.y * cx) / det;
        if (u < 0 || u >= ulen || v < 0 || v >= vlen) continue;
        this.set(px, py, pinta(u, v));
      }
  }

  /** Caja: la cara de la derecha (+x), la de la izquierda (+y) y la de arriba, en ese orden. */
  caja(x: number, y: number, z: number, w: number, d: number, h: number, arriba: Pinta | null, izq: Pinta | null, der: Pinta | null) {
    if (der) this.plano([x + w, y, z], [0, 1, 0], [0, 0, 1], d, h, der);
    if (izq) this.plano([x, y + d, z], [1, 0, 0], [0, 0, 1], w, h, izq);
    if (arriba) this.plano([x, y, z + h], [1, 0, 0], [0, 1, 0], w, d, arriba);
  }

  /** Caja de un material: arriba a plena luz con el filo claro, la izquierda a media luz y la derecha en sombra. */
  bloque(x: number, y: number, z: number, w: number, d: number, h: number, R: Ramp, luz = 0) {
    this.caja(
      x,
      y,
      z,
      w,
      d,
      h,
      (u, v) => at(R, (v > d - 0.9 || u > w - 0.9 ? 4.8 : 4.1) + luz),
      (u, v) => at(R, (v > h - 0.9 ? 3.6 : u < 0.9 ? 3.4 : 3) + luz),
      (_u, v) => at(R, (v > h - 0.9 ? 2.6 : 2) + luz),
    );
  }

  /** Sombra en el piso (un rombo translúcido), antes que todo. */
  sombra(x: number, y: number, w: number, d: number, a = 0.28) {
    this.plano([x, y, 0], [1, 0, 0], [0, 1, 0], w, d, () => alpha(SHADOW, a));
  }

  /**
   * Una grilla de letras con la esquina de arriba a la izquierda en (sx, sy): "." vacío, "o" contorno (el
   * tono más oscuro del material vecino) y el resto, materiales de `ley`. Con `luz`, cada material se
   * aclara en su borde de arriba y de la izquierda y se oscurece en el de abajo y la derecha.
   */
  estampa(sx: number, sy: number, rows: readonly string[], ley: Ley, o: { luz?: boolean; espejo?: boolean; corre?: (fila: number) => number } = {}) {
    const luz = o.luz ?? true;
    const w = Math.max(...rows.map((r) => r.length));
    const ch = (i: number, j: number) => {
      const r = rows[j];
      if (!r) return ".";
      return r[o.espejo ? w - 1 - i : i] ?? ".";
    };
    const mat = (i: number, j: number) => {
      const k = ch(i, j);
      return k === "." || k === "o" ? undefined : ley[k];
    };
    const igual = (m: Mat, i: number, j: number) => {
      const n = mat(i, j);
      return n !== undefined && esRampa(n) && esRampa(m) && n[0] === m[0];
    };
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < w; i++) {
        const k = ch(i, j);
        if (k === ".") continue;
        const x = Math.round(sx) + i + (o.corre?.(j) ?? 0);
        const y = Math.round(sy) + j;
        if (k === "o") {
          const vec = [mat(i, j + 1), mat(i + 1, j), mat(i - 1, j), mat(i, j - 1)].find(Boolean);
          this.set(x, y, vec ? (esRampa(vec) ? mix(at(vec[0], 0), OUT, 0.35) : mix(vec, OUT, 0.7)) : OUT);
          continue;
        }
        const m = ley[k];
        if (!m) continue;
        if (!esRampa(m)) {
          this.set(x, y, m);
          continue;
        }
        let t = m[1];
        if (luz) {
          if (!igual(m, i, j - 1) || !igual(m, i - 1, j)) t += 0.6;
          if (!igual(m, i, j + 1) || !igual(m, i + 1, j)) t -= 0.6;
        }
        this.set(x, y, at(m[0], t));
      }
  }

  /**
   * Un poste redondo de `ancho` píxeles (lado claro a la izquierda, oscuro a la derecha) desde (x, y, z0),
   * pintado en franjas en espiral de `cols`.
   */
  poste(x: number, y: number, z0: number, h: number, cols: Ramp[], ancho = 3, paso = 3) {
    const b = this.p(x, y, z0);
    const tonos = ancho === 2 ? [4.2, 2.4] : ancho === 3 ? [4.3, 3.1, 2] : [4.5, 3.6, 2.8, 1.9];
    const x0 = Math.round(b.x) - Math.floor(ancho / 2);
    const y0 = Math.round(b.y);
    for (let k = 0; k < h; k++)
      for (let i = 0; i < ancho; i++) {
        const banda = Math.floor((k + i) / paso) % cols.length;
        this.set(x0 + i, y0 - 1 - k, at(cols[banda]!, tonos[i]!));
      }
    for (let i = 0; i < ancho; i++) this.set(x0 + i, y0 - h - 1, at(cols[0]!, i === 0 ? 5 : 4.4));
    return { x: x0, top: y0 - h - 1 };
  }

  /** Una línea de píxeles entre dos puntos de pantalla. */
  linea(x0: number, y0: number, x1: number, y1: number, col: RGBA) {
    this.c.line(x0, y0, x1, y1, col);
  }

  /** Una persona (un chibi, igual que los del juego) con los pies en (x, y, z): la vendedora de cada puesto. */
  persona(look: LookInput, x: number, y: number, z: number, dir: SheetDirection = "down") {
    const key = JSON.stringify(look);
    let hoja = hojas.get(key);
    if (!hoja) hojas.set(key, (hoja = drawCharacter(look)));
    const row = SHEET_DIRECTIONS.indexOf(dir);
    const b = this.p(x, y, z);
    const x0 = Math.round(b.x) - FRAME / 2;
    const y0 = Math.round(b.y) - FEET_Y;
    for (let j = 0; j <= FEET_Y; j++)
      for (let i = 0; i < FRAME; i++) {
        const k = ((row * FRAME + j) * hoja.width + i) * 4;
        if (hoja.data[k + 3]) this.set(x0 + i, y0 + j, [hoja.data[k]!, hoja.data[k + 1]!, hoja.data[k + 2]!, hoja.data[k + 3]!]);
      }
  }

  /**
   * Letras pintadas a mano (de 5x7) desde (sx, sy), cada una derecha y de su color, con su sombrita; la
   * siguiente baja (`pend` = 0,5, sobre una cara a lo largo de x) o sube (-0,5, a lo largo de -y), en escalera.
   */
  letras(sx: number, sy: number, text: string, cols: RGBA[], sombra: RGBA | null, pend: number, sube: (x: number) => number = () => 0) {
    let x = 0;
    let n = 0;
    for (const ch of text) {
      const g = glyph(ch);
      const w = g?.[0]?.length ?? 3;
      const left = Math.round(sx + x);
      const top = Math.round(sy + (x + w / 2) * pend - sube(x + w / 2));
      const col = cols[n % cols.length]!;
      if (g && ch !== " ") {
        if (sombra) for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < w; gx++) if (g[gy]?.[gx] === "#") this.set(left + gx + 1, top + gy + 1, sombra);
        for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < w; gx++) if (g[gy]?.[gx] === "#") this.set(left + gx, top + gy, gy < 2 ? mix(col, [255, 255, 240, 255], 0.3) : col);
        n++;
      }
      x += w + 1;
    }
  }

  /** Cierra el dibujo: el contorno cálido de afuera (el tono más oscuro de lo que bordea) y recorta. */
  sprite(contorno = true): Sprite {
    const { c } = this;
    if (contorno) {
      const marks: [number, number, RGBA][] = [];
      const op = (x: number, y: number) => c.alphaAt(x, y) >= 200;
      const col = (x: number, y: number): RGBA => {
        const i = (y * c.width + x) * 4;
        return [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, 255];
      };
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          if (c.alphaAt(x, y) !== 0) continue;
          const n = ([
            [x, y + 1],
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
          ] as const).find(([a, b]) => op(a, b));
          if (n) marks.push([x, y, mix(mix(col(n[0], n[1]), OUT, 0.72), [40, 20, 30, 255], 0.1)]);
        }
      for (const [x, y, k] of marks) c.set(x, y, k);
    }
    let x0 = c.width;
    let y0 = c.height;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (c.alphaAt(x, y)) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return { canvas: c, ox: this.ox, oy: this.oy };
    const out = new PixelCanvas(x1 - x0 + 1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) out.data.set(c.data.subarray((y * c.width + x0) * 4, (y * c.width + x1 + 1) * 4), (y - y0) * out.width * 4);
    return { canvas: out, ox: this.ox - x0, oy: this.oy - y0 };
  }
}

const hojas = new Map<string, PixelCanvas>();

/** Una grilla en tonos (dígitos 0..5) de una rampa, sin la luz automática: ya va pintada a mano. */
const tonos = (R: Ramp, extra: Ley = {}): Ley => ({ ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((t) => [String(t), [R, t] as Mat])), ...extra });

// ---------- Texturas pintadas ----------

/** Tablas de madera con veta a lo largo de `u`, juntas cada `ancho` en `v` y el filo claro del frente. */
const tablas =
  (R: Ramp, ancho: number, base = 3.8, seed = 1, filo = -1): Pinta =>
  (u, v) => {
    if (filo > 0 && v > filo - 0.9) return at(R, base + 1);
    const fila = Math.floor(v / ancho);
    if (v - fila * ancho < 0.7) return at(R, base - 1.7);
    // La veta: rayitas cortas más oscuras y algún nudo claro, siempre en los mismos sitios.
    const veta = noise(Math.floor(u / 4) + fila * 13, fila, seed);
    if (veta < 0.18 && Math.floor(u) % 4 !== 0) return at(R, base - 0.8);
    if (veta > 0.9) return at(R, base + 0.6);
    return at(R, base);
  };

/** El tejido andino (el de las ruanas y las mochilas): franjas con rombos de colores e hilos oscuros. */
function tejido(u: number, v: number, luz = 0): RGBA {
  const banda = Math.floor(v / 4);
  const vv = v - banda * 4;
  if (vv < 0.7) return at(NEGRO, 2 + luz);
  const base = TEJ[banda % TEJ.length]!;
  const uu = ((Math.floor(u) % 6) + 6) % 6;
  const rombo = Math.abs(uu - 2.5) + Math.abs(vv - 2.3) * 1.5 < 1.9;
  if (rombo) return at(banda % 2 ? AMARILLO : BLANCO, 4 + luz);
  return at(base, 3 + luz);
}

/** Faldón de tela: el fleco dorado arriba, festones de colores y la tela plisada en pliegues de dos píxeles. */
const faldon =
  (alto: number, cols: Ramp[], ancho = 8, luz = 0): Pinta =>
  (u, v) => {
    const top = alto - v;
    if (top < 1) return at(ORO, 4.4 + luz);
    if (top < 1.8) return Math.floor(u) % 2 ? at(ORO, 3 + luz) : at(ORO, 2 + luz);
    const k = Math.floor(u / ancho);
    const uu = (u % ancho) / ancho;
    const fondo = 1.8 + 3.4 * Math.sin(Math.PI * uu);
    // La rosa dorada donde se juntan los festones.
    if (uu < 0.14 || uu > 0.93) if (top < 4) return at(ORO, top < 2.8 ? 4.6 : 3.2);
    if (top < fondo) return top > fondo - 0.9 ? at(ORO, 3.6 + luz) : at(cols[(k + 1) % cols.length]!, 3.4 + luz + (uu < 0.5 ? 0.3 : -0.2));
    const pliegue = Math.floor(u * 1.2) % 3;
    return at(cols[k % cols.length]!, 3 + luz + (pliegue === 0 ? 0.6 : pliegue === 2 ? -0.5 : 0));
  };

// ---------- Grillas a mano ----------

/** Banderín triangular que cuelga de una cuerda que corre a lo largo de x (el filo de arriba baja con ella). */
const BANDERIN = [
  "oo....", //
  "o4oo..",
  "o443oo",
  "o4433o",
  ".o433o",
  ".o432o",
  "..o32o",
  "..o3o.",
  "...o..",
];
/** El mismo, ondeado hacia el otro lado (los pliegues cambian de luz). */
const BANDERIN_B = [
  "oo....", //
  "o3oo..",
  "o344oo",
  "o3443o",
  ".o243o",
  ".o233o",
  "..o42o",
  "..o3o.",
  "...o..",
];

/** Pompón de papel seda. */
const POMPON = [".ooo.", "o554o", "o443o", "o332o", ".ooo."];
/** Pompón grande (las columnas de los arcos). */
const POMPON_G = ["..ooo..", ".o554o.", "o544433", "o443322", "o433222", ".o3222o", "..ooo.."].map((r) => r.replace(/3$|2$/, "o"));
/** La perilla dorada de los postes. */
const PERILLA = [".ooo.", "o554o", "o543o", "o432o", ".o2o.", "..o.."];
/** Globo con su brillo y su nudito. */
const GLOBO = ["..ooooo..", ".o55443o.", "o5544333o", "o5443332o", "o4433322o", "o4333222o", ".o33222o.", "..o322o..", "...o2o...", "....o....", "...o2o..."];

/**
 * El mascarón: la cara de una máscara de carnaval pintada como el barniz de Pasto. La franja roja de la
 * frente con triángulos amarillos, el ceño dorado, los ojos grandes con párpados cian, los cachetes
 * rosados, la nariz y la sonrisa roja.
 */
const MASCARA = [
  "....ooooooooo....",
  "..ooRRRRRRRRRoo..",
  ".oYYYRYYYRYYYRYYo",
  ".oRYRRRYRRRYRRRYo",
  "oDDDDDDDDDDDDDDDo",
  "oggCCCCgggCCCCggo",
  "oggWKWWgggWWKWggo",
  "ogggWWgggggWWgggo",
  "ogMMggggNggggMMgo",
  "ogMMgggNNNgggMMgo",
  "ogggrgggggggrgggo",
  ".oggrrrrrrrrrggo.",
  ".ogggrBBBBBrgggo.",
  "..ogggggggggggo..",
  "...oogggggggoo...",
  ".....ooooooo.....",
];
const mascaraLey = (cara: Ramp, frente: Ramp, parpado: Ramp): Ley => ({
  R: [frente, 3],
  Y: [AMARILLO, 4.2],
  D: [cara, 2],
  g: [cara, 3.6],
  C: [parpado, 3.2],
  W: at(BLANCO, 5),
  K: at(NEGRO, 0),
  M: [MAGENTA, 3.4],
  N: [cara, 2.4],
  r: [ROJO, 2.2],
  B: [ROJO, 1.2],
});

/** Mascarita de 7x7 (las de los puestos), con la franja de la frente de otro color. */
const MASCARITA = [".ooooo.", "oAAAAAo", "o4K3K2o", "o44332o", "oM3r3Mo", ".o332o.", "..ooo.."];
/** La de diablito lleva cuernos dorados. */
const MASCARITA_CUERNOS = ["Yo...oY", "oY...Yo", ".ooooo.", "oAAAAAo", "o4K3K2o", "o44332o", "oM3r3Mo", ".o332o.", "..ooo.."];
const mascaritaLey = (base: Ramp, franja: Ramp): Ley =>
  tonos(base, { A: [franja, 3.4], K: at(NEGRO, 0), M: [MAGENTA, 3.6], r: [ROJO, 2], Y: [AMARILLO, 4] });

/** El danzante de papel maché: sombrero de paja con cinta, la cara pintada, la ruana de franjas y los pañuelos. */
const DANZANTE = [
  "......ooooo......",
  ".....ohhhhho.....",
  ".....ohhhhho.....",
  "....obbbbbbbo....",
  ".oohhhhhhhhhhhoo.",
  "..ooosssssssooo..",
  "...osssssssssso..",
  "...ossKsssKssso..".slice(0, 17),
  "...osmsssssmso...",
  "...osssrrrssso...".slice(0, 17),
  "....osssssssso...".slice(0, 17),
  ".....ooooooo.....",
  "....oRRRRRRRo....",
  ".oooRYYYYYYYRooo.",
  "osssRGGGGGGGRssso",
  ".oooRBBBBBBBRooo.",
  "...oRRRRRRRRRo...",
  "..oYYYYYYYYYYYo..",
  "..oGGGGGGGGGGGo..",
  "..oRRRRRRRRRRRo..",
  "..oYoYoYoYoYoYo..",
  "......owowo......",
  "......owowo......",
  ".....okkokko.....",
  ".....ooo.ooo.....",
];
const DANZANTE_LEY: Ley = {
  h: [PAJA, 3.4],
  b: [ROJO, 3],
  s: [PIEL, 3.4],
  K: at(NEGRO, 0),
  m: [MAGENTA, 3.6],
  r: [ROJO, 2],
  R: [ROJO, 3],
  Y: [AMARILLO, 3.6],
  G: [VERDE, 3.2],
  B: [AZUL, 3.2],
  w: [BLANCO, 4],
  k: [NEGRO, 2],
};

/** El cuy gigante de papel maché, mirando a la izquierda: café con manchas blancas, la nariz y las patas rosadas. */
const CUY = [
  "....oo............",
  "...oppo..ooooo....",
  "..occccoocccwwoo..",
  ".occKccccccwwwwwo.",
  "occccccccwwwwccwwo",
  "ocpcccccwwwccccwwo",
  "occccccwwwcccccwwo",
  ".occcccwwccccccwo.",
  "..oocccccccccccoo.",
  "...oCo.....oCo....",
  "...ooo.....ooo....",
];
const CUY_LEY: Ley = { c: [CAFE, 3.2], w: [BLANCO, 3.8], K: at(NEGRO, 0), p: [ROSA, 3.4], C: [ROSA, 3] };
/** La ruanita del cuy, sobre el lomo. */
const RUANITA = ["..oooooo..", ".oRRYYGGo.", "oRYYGGBBRo", "oBBRRYYGGo", ".ooYoYoYo."];
const RUANITA_LEY: Ley = { R: [ROJO, 3.2], Y: [AMARILLO, 3.8], G: [VERDE, 3.2], B: [AZUL, 3.2] };
/** Un sombrerito de paja (el del cuy y los de los puestos). */
const SOMBRERITO = ["..ooo..", ".ohhho.", ".obbbo.", "ohhhhho", ".ooooo."];

/** Un pocillo de hervido con su bebida caliente. */
const POCILLO = ["oooo", "oNNo", "o54o", "o43o", ".oo."];
/** Bolsita de maicena con su etiqueta de color. */
const BOLSA = [".ooo.", "o554o", "o4R3o", "o4R3o", "o433o", ".ooo."];
/** Rollo de serpentina visto de arriba y de lado. */
const ROLLO = [".oo.", "o5Ko", "o43o", ".oo."];
/** El trofeo del jurado. */
const TROFEO = ["ooooooo", "o55443o", "oo5442o", ".o4432o", "..o32o.", "..o3o..", "..o432o", ".ooooo."];
/** Un cono de parlante (sin marca): el borde, el cono y la tapa del centro. */
const CONO = ["..ooo..", ".o343o.", "o31113o", "o41512o", "o31112o", ".o322o.", "..ooo.."];
/** Llamitas del fogón (cuatro cuadros). */
const LLAMAS = [
  ["..y...", ".yay.y", "yaRayR", "RRRRRR"],
  ["...y..", "y.yay.", "yRayay", "RRRRRR"],
  [".y....", ".yay..", "yaRyay", "RRRRRR"],
  ["....y.", "y..yay", "yayaRy", "RRRRRR"],
];
const LLAMA_LEY: Ley = { y: at(C.fire, 4), a: at(C.fire, 3), R: at(C.fire, 1) };
/** Humo y vapor: nubecitas pintadas que suben y se abren. */
const NUBES = [
  [".oo.", "o54o", ".oo."],
  ["..ooo.", ".o554o", "o5443o", ".oooo."],
  [".oooo..", "o55443o", "o54433o", ".o433o.", "..ooo.."],
];

// ---------- Piezas pintadas comunes ----------

/** Cuerda entre dos puntos de pantalla, con la caída que diga `caida` (0..1 → píxeles hacia abajo). */
function cuerdaPx(L: Lienzo, a: { x: number; y: number }, b: { x: number; y: number }, caida: (t: number) => number, col: RGBA) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
  let prev: [number, number] | null = null;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t + caida(t));
    if (prev) L.linea(prev[0], prev[1], x, y, alpha(col, 0.76));
    prev = [x, y];
  }
}

/** Un banderín colgado de (sx, sy) que ondea con el cuadro. */
function banderinPx(L: Lienzo, sx: number, sy: number, R: Ramp, f: number, fase: number, pintas = false) {
  const g = (f + fase) % 4;
  const corre = (fila: number) => (fila < 4 ? 0 : g === 1 ? 1 : g === 3 ? -1 : 0);
  const rows = g % 2 ? BANDERIN_B : BANDERIN;
  // Algunos llevan pintas blancas (como los de tela estampada).
  const conPintas = pintas ? rows.map((r, j) => (j === 3 ? r.slice(0, 2) + "W" + r.slice(3) : j === 5 ? r.slice(0, 3) + "W" + r.slice(4) : r)) : rows;
  L.estampa(sx - 1, sy, conPintas, tonos(R, { W: at(BLANCO, 5) }), { luz: false, corre });
}

/** Una pluma de colores trazada desde la base hacia (dx, dy): el canto claro de la izquierda y el oscuro de la derecha. */
function pluma(L: Lienzo, bx: number, by: number, dx: number, dy: number, R: Ramp, ancho = 3.4) {
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  for (let t = 0; t <= 1; t += 0.5 / len) {
    const w = ancho * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) * 0.5;
    for (let s = -w; s <= w; s += 0.4) {
      const x = bx + dx * t + nx * s;
      const y = by + dy * t + ny * s;
      const tono = Math.abs(s) < 0.35 && t > 0.15 ? 4.8 : s < 0 ? 4 : s > w - 0.6 ? 1.8 : 2.8;
      L.set(Math.round(x), Math.round(y), at(R, tono));
    }
  }
}

/** El abanico de plumas detrás de una máscara (base en el centro de arriba de la cara). */
function abanico(L: Lienzo, bx: number, by: number, largo: number, cols: Ramp[], ancho = 3.4) {
  const n = cols.length;
  cols.forEach((R, i) => {
    const a = -1.2 + (2.4 * i) / (n - 1);
    const l = largo * (1 - Math.abs(a) * 0.18);
    pluma(L, bx, by, Math.sin(a) * l, -Math.cos(a) * l, R, ancho);
  });
}

/** Cintas que caen de un punto y ondean con el cuadro. */
function cinta(L: Lienzo, sx: number, sy: number, largo: number, R: Ramp, f: number, fase: number, lado = 1) {
  const t0 = (f * Math.PI) / 2 + fase;
  for (let k = 0; k < largo; k++) {
    const x = sx + lado * (k * 0.25) + Math.sin(t0 + k * 0.5) * (k / largo) * 1.8;
    const luz = Math.cos(t0 + k * 0.5);
    L.set(Math.round(x), sy + k, at(R, luz > 0.3 ? 4.3 : luz < -0.3 ? 2.2 : 3.2));
    L.set(Math.round(x) + 1, sy + k, at(R, luz > 0.3 ? 3.2 : 1.8));
  }
}

/** Humo o vapor que sube desde (sx, sy) en pantalla: tres nubecitas que crecen y se aclaran con el cuadro. */
function humoPx(L: Lienzo, sx: number, sy: number, f: number, gris = false) {
  const R = gris ? C.stone : BLANCO;
  for (let i = 0; i < 3; i++) {
    const t = (i + f / 4) / 3;
    const nube = NUBES[Math.min(2, Math.floor(t * 3))]!;
    const y = sy - 4 - t * 22;
    const x = sx + Math.sin(t * 5 + i) * 2 + t * 4 - nube[0]!.length / 2;
    const a = 0.95 - t * 0.55;
    const tmp = new Lienzo(1, 1, 1, 6);
    tmp.estampa(0, 0, nube, tonos(R, {}), { luz: false });
    for (let j = 0; j < nube.length; j++)
      for (let k = 0; k < nube[0]!.length; k++) {
        const idx = (j * tmp.c.width + k) * 4;
        if (!tmp.c.data[idx + 3]) continue;
        const col: RGBA = [tmp.c.data[idx]!, tmp.c.data[idx + 1]!, tmp.c.data[idx + 2]!, 255];
        L.set(Math.round(x) + k, Math.round(y) + j, alpha(nube[j]![k] === "o" ? mix(at(R, 2), at(R, 3), 0.5) : col, a));
      }
  }
}

// ---------- 1. Banderines, guirnaldas y su poste ----------

/**
 * Banderines: un cable tenso a la altura de los postes y dos cuerdas que cuelgan de él en festones que se
 * cruzan (una amarrada en las orillas del tile, la otra en el medio), cada una con sus banderines de
 * colores que ondean. Puestos en fila forman la guirnalda de la vereda; no bloquean (se pasa por debajo).
 */
function banderines(f: number): Sprite {
  const L = new Lienzo(1, 1, 56);
  const zc = 45;
  const a = L.p(0, 4, zc);
  const b = L.p(16, 4, zc);
  L.linea(a.x, a.y, b.x, b.y, alpha(at(C.stone, 1.4), 0.76));
  const cord = alpha(at(OSCURA, 1.2), 0.76);
  // Dos cuerdas en festón: la de atrás se amarra en las orillas del tile y la de adelante en el medio;
  // así los festones se cruzan.
  const enA = (x: number) => {
    const p = L.p(x, 5, zc - 1);
    return { x: p.x, y: p.y + Math.sin((Math.PI * x) / 16) * 5 };
  };
  const enB = (x: number) => {
    const p = L.p(x, 8, zc - 1);
    return { x: p.x, y: p.y + Math.sin((Math.PI * ((x + 8) % 16)) / 16) * 5 };
  };
  const traza = (en: (x: number) => { x: number; y: number }) => {
    let prev = en(0);
    for (let x = 0.5; x <= 16; x += 0.5) {
      const q = en(x);
      L.linea(Math.round(prev.x), Math.round(prev.y), Math.round(q.x), Math.round(q.y), cord);
      prev = q;
    }
  };
  traza(enA);
  [3.5, 8, 12.5].forEach((x, i) => {
    const q = enA(x);
    banderinPx(L, q.x, q.y, [ROJO, AMARILLO, AZUL][i]!, f, i, i === 1);
  });
  traza(enB);
  [0.5, 4.5, 11.5, 15.5].forEach((x, i) => {
    const q = enB(x);
    banderinPx(L, q.x, q.y, [VERDE, MAGENTA, NARANJA, MORADO][i]!, f, 3 + i, i % 2 === 0);
  });
  // Los nudos donde cada cuerda se amarra al cable.
  const na = enA(0);
  const nb = enB(8);
  L.estampa(na.x - 1, na.y - 2, [".o.", "o4o", ".o."], tonos(ROJO), { luz: false });
  L.estampa(nb.x - 1, nb.y - 2, [".o.", "o4o", ".o."], tonos(AMARILLO), { luz: false });
  return L.sprite();
}

/** Las guirnaldas: papel crepé de dos colores torcido en festón, con pompones de papel seda que se mecen. */
function guirnalda(f: number): Sprite {
  const L = new Lienzo(1, 1, 56);
  const zc = 45;
  const a = L.p(0, 4, zc);
  const b = L.p(16, 4, zc);
  L.linea(a.x, a.y, b.x, b.y, at(C.stone, 1));
  const p0 = L.p(0, 5, zc - 1);
  const p1 = L.p(16, 5, zc - 1);
  const n = Math.round(p1.x - p0.x);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(p0.x + k);
    const y = Math.round(p0.y + (p1.y - p0.y) * t + Math.sin(Math.PI * t) * 5);
    // La tira torcida: cada tres píxeles cambia de color y de cara (clara arriba, oscura abajo).
    const R = Math.floor((k + f) / 3) % 2 ? MAGENTA : AMARILLO;
    const fase = (k + f) % 3;
    L.set(x, y - 1, at(R, fase === 0 ? 4.8 : 4));
    L.set(x, y, at(R, fase === 1 ? 3.6 : 3));
    L.set(x, y + 1, at(R, fase === 2 ? 2.6 : 2));
  }
  const sw = [0, 1, 0, -1][f % 4]!;
  [0.27, 0.75].forEach((t, i) => {
    const x = Math.round(p0.x + (p1.x - p0.x) * t);
    const y = Math.round(p0.y + (p1.y - p0.y) * t + Math.sin(Math.PI * t) * 5) + 1;
    L.linea(x, y, x + (i ? -sw : sw), y + 3, at(OSCURA, 1.5));
    L.estampa(x - 2 + (i ? -sw : sw), y + 3, POMPON, tonos(i ? CIAN : NARANJA), { luz: false });
  });
  return L.sprite();
}

/**
 * El poste de la guirnalda: madera pintada en espiral sobre una base de concreto, la perilla dorada con
 * cintas de colores que ondean y el brazo que sale hacia la vereda, de donde se amarra el cable.
 */
function posteBanderines(f: number): Sprite {
  const L = new Lienzo(1, 2, 70);
  L.sombra(5, 5, 7, 7, 0.26);
  L.bloque(5.2, 5.2, 0, 5.6, 5.6, 3, C.stone);
  const pt = L.poste(8, 8, 3, 43, [ROJO, AMARILLO, VERDE, AZUL], 3, 3);
  // El brazo hacia +y (la vereda), con su escuadra.
  L.bloque(7.4, 8.6, 45, 1.4, 14.4, 1.4, OSCURA, 0.3);
  const e0 = L.p(8, 9, 38);
  const e1 = L.p(8, 15, 45);
  L.linea(e0.x, e0.y, e1.x, e1.y, at(OSCURA, 2.6));
  const k = L.p(8, 22.6, 44);
  L.estampa(k.x - 2, k.y - 1, POMPON, tonos(ROJO), { luz: false });
  // Las cintas que cuelgan de la perilla, y la perilla encima.
  [ROJO, AMARILLO, AZUL, MAGENTA].forEach((R, i) => cinta(L, pt.x + (i < 2 ? -1 - i : 2 + i - 2), pt.top - 1, 11 - (i % 2) * 2, R, f, i * 1.3, i < 2 ? -1 : 1));
  L.estampa(pt.x - 1, pt.top - 6, PERILLA, tonos(ORO), { luz: false });
  return L.sprite();
}

// ---------- 2. Farol de papel ----------

/** El perfil del farol de acordeón (medio ancho por fila) y el color de cada franja. */
const FAROL_PERFIL = [2, 3, 4, 5, 5, 5, 5, 5, 4, 3, 2];
const FAROL_FRANJAS = [MAGENTA, MAGENTA, AMARILLO, AMARILLO, CIAN, CIAN, CIAN, NARANJA, NARANJA, VERDE, VERDE];

/**
 * Farol de carnaval: el poste de madera pintada con su brazo y la escuadra y, colgando, el farol de papel
 * de acordeón en franjas de colores con sus costillas, las tapas doradas y la borla; se mece con el viento.
 */
function farolCarnaval(f: number): Sprite {
  const L = new Lienzo(1, 1, 62);
  L.sombra(3, 6, 5, 5, 0.26);
  L.sombra(10, 7, 4, 3, 0.14);
  L.bloque(2.6, 5.8, 0, 4.8, 4.8, 2.4, OSCURA, 0.4);
  const pt = L.poste(5, 8, 2.4, 40, [AZUL, AMARILLO], 3, 4);
  // El brazo (a lo largo de x) y su escuadra.
  const a0 = L.p(5, 8, 43);
  const a1 = L.p(14, 8, 43);
  L.linea(a0.x, a0.y, a1.x, a1.y, at(OSCURA, 3.6));
  L.linea(a0.x, a0.y + 1, a1.x, a1.y + 1, at(OSCURA, 2));
  const e0 = L.p(5, 8, 37);
  const e1 = L.p(10, 8, 43);
  L.linea(e0.x, e0.y, e1.x, e1.y, at(OSCURA, 2.6));
  L.estampa(pt.x - 1, pt.top - 6, PERILLA, tonos(ORO), { luz: false });
  // El farol que cuelga del extremo del brazo.
  const sw = [0, 1, 0, -1][f % 4]!;
  const top = { x: Math.round(a1.x) - 1, y: Math.round(a1.y) + 2 };
  const cx = top.x + sw;
  L.linea(top.x, top.y - 1, cx, top.y + 3, at(OSCURA, 1));
  const y0 = top.y + 4;
  // Tapa de arriba.
  L.estampa(cx - 2, y0, [".ooo.", "o554o"], tonos(ORO), { luz: false });
  FAROL_PERFIL.forEach((hw, r) => {
    const R = FAROL_FRANJAS[r]!;
    const costilla = r > 0 && FAROL_FRANJAS[r - 1] !== R;
    for (let i = -hw; i < hw; i++) {
      const rel = (i + 0.5) / hw;
      let t = rel < -0.6 ? 4.4 : rel < -0.1 ? 3.7 : rel < 0.45 ? 3 : rel < 0.8 ? 2.4 : 1.7;
      if (costilla) t -= 0.9;
      if (r === 2 && i === -hw + 1) t = 5;
      L.set(cx + i, y0 + 2 + r, at(R, t));
    }
    L.set(cx - hw - 1, y0 + 2 + r, mix(at(R, 0), OUT, 0.4));
    L.set(cx + hw, y0 + 2 + r, mix(at(R, 0), OUT, 0.4));
  });
  const yb = y0 + 2 + FAROL_PERFIL.length;
  L.estampa(cx - 2, yb, ["o543o", ".ooo."], tonos(ORO), { luz: false });
  // La borla de hilos de colores.
  [ROJO, AMARILLO, VERDE, AZUL].forEach((R, i) => {
    for (let k = 0; k < 5; k++) L.set(cx - 2 + i + (k > 2 ? -sw : 0), yb + 2 + k, at(R, 3.6 - k * 0.3));
  });
  return L.sprite();
}

// ---------- 3. La valla ----------

/**
 * Valla del desfile: dos postes pintados con su perilla dorada sobre patas de metal, dos tubos grises
 * (arriba y abajo) y entre ellos cuatro paneles de tela de colores, cada uno con su luz y su sombra.
 * Corre a lo largo de x.
 */
function vallaCarnaval(): Sprite {
  const L = new Lienzo(1, 1, 30);
  L.sombra(0.5, 6, 15, 5, 0.22);
  // Las patas: un pie de metal en cada punta.
  for (const x of [0.6, 13.8]) L.bloque(x, 5.2, 0, 1.8, 6, 1.2, METAL, 0.2);
  // Los paneles de tela entre los tubos (en la cara +y), con un pliegue claro a la izquierda.
  const cols = [AMARILLO, AZUL, ROJO, VERDE];
  L.plano([2, 8.6, 2.4], [1, 0, 0], [0, 0, 1], 12, 11, (u, v) => {
    const k = Math.floor(u / 3);
    const uu = u - k * 3;
    if (uu > 2.5) return null;
    const R = cols[k % cols.length]!;
    return at(R, uu < 0.7 ? 4.4 : uu > 1.9 ? 2.6 : 3.4) ?? null;
  });
  // Los tubos de arriba y de abajo.
  for (const z of [1.8, 13.2]) L.caja(1.4, 8, z, 13.2, 1.2, 1.2, () => at(METAL, 4.8), (_u, v) => at(METAL, v > 0.6 ? 4 : 3), () => at(METAL, 2.2));
  // Los postes con su perilla.
  for (const [x, R] of [
    [1.6, MORADO],
    [14.6, VERDE],
  ] as const) {
    const pt = L.poste(x, 8.6, 1.2, 14, [R], 2, 99);
    L.estampa(pt.x - 1, pt.top - 3, [".o.", "o5o", "o3o", ".o."], tonos(ORO), { luz: false });
  }
  return L.sprite();
}

// ---------- 4. Confeti y serpentinas en el piso ----------

/** Una serpentina enroscada, a mano (dígitos = tonos). */
const RIZO = ["..44...", ".4..3..", ".3.....", "..33...", "....3..", ".2..3..", "..22..."];
const ESPIRAL = ["...4443...", ".44....33.", "4...443..2", "3..3..2..2", ".3..22..2.", "..33..22.."];

/** Confeti de muchos colores regado en el piso (plano, no bloquea), cada papelito con su sombrita. */
function confetiCalle(): Sprite {
  const L = new Lienzo(1, 1, 4, 6);
  for (let i = 0; i < 44; i++) {
    const p = L.p(1 + noise(i, 1, 31) * 14, 1 + noise(i, 2, 31) * 14, 0);
    const R = FIESTA[i % FIESTA.length]!;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    L.set(x + 1, y + 1, alpha(SHADOW, 0.35));
    L.set(x, y, at(R, 4.2));
    L.set(x + 1, y, at(R, 3));
    if (i % 2) L.set(x, y + 1, at(R, 2.4));
  }
  const q = L.p(9, 3, 0);
  L.estampa(q.x, q.y - 3, RIZO, tonos(CIAN), { luz: false });
  const r = L.p(4, 11, 0);
  L.estampa(r.x, r.y - 3, RIZO, tonos(MAGENTA), { luz: false, espejo: true });
  return L.sprite(false);
}

/** Serpentinas enroscadas de muchos colores con confeti alrededor (plano, no bloquea). */
function serpentinasSuelo(): Sprite {
  const L = new Lienzo(1, 1, 4, 6);
  const pon = (x: number, y: number, rows: string[], R: Ramp, espejo = false) => {
    const q = L.p(x, y, 0);
    const sh = new Lienzo(1, 1, 1, 6);
    sh.estampa(0, 0, rows, tonos(R), { luz: false, espejo });
    L.estampa(q.x + 1, q.y + 1, rows.map((r) => r.replace(/[0-9]/g, "s")), { s: alpha(SHADOW, 0.3) }, { luz: false, espejo });
    L.estampa(q.x, q.y, rows, tonos(R), { luz: false, espejo });
  };
  pon(2, 3, ESPIRAL, MAGENTA);
  pon(9, 9, ESPIRAL, AMARILLO, true);
  pon(3, 10, RIZO, VERDE);
  pon(11, 2, RIZO, AZUL, true);
  for (let i = 0; i < 30; i++) {
    const p = L.p(1 + noise(i, 7, 41) * 14, 1 + noise(i, 8, 41) * 14, 0);
    L.set(p.x + 1, p.y + 1, alpha(SHADOW, 0.3));
    L.set(p.x, p.y, at(FIESTA[(i + 3) % FIESTA.length]!, 4.2));
    L.set(p.x + 1, p.y, at(FIESTA[(i + 3) % FIESTA.length]!, 3));
  }
  return L.sprite(false);
}

// ---------- 5. El mascarón ----------

/** Pinta una máscara grande con su abanico de plumas, con el centro de abajo de la cara en (sx, sy). */
function mascaraGrande(L: Lienzo, sx: number, sy: number, cara: Ramp, frente: Ramp, parpado: Ramp) {
  const w = MASCARA[0]!.length;
  const h = MASCARA.length;
  abanico(L, sx, sy - h + 4, 14, [ROJO, NARANJA, AMARILLO, VERDE, CIAN, AZUL, MORADO]);
  L.estampa(sx - Math.floor(w / 2), sy - h, MASCARA, mascaraLey(cara, frente, parpado));
}

/**
 * Mascarón: una máscara de carnaval grande pintada como el barniz de Pasto, con su abanico de plumas,
 * sobre un poste pintado; de las orejas caen cintas de colores que se mecen. Mira de frente a la cámara.
 */
function mascaron(f: number): Sprite {
  const L = new Lienzo(1, 1, 84);
  L.sombra(5, 5, 6, 6, 0.26);
  L.bloque(5, 5, 0, 6, 6, 3, OSCURA, 0.4);
  const pt = L.poste(8, 8, 3, 36, [MORADO, AMARILLO], 4, 4);
  const sx = pt.x + 2;
  const sy = pt.top + 12;
  [ROJO, AMARILLO].forEach((R, i) => cinta(L, sx - 9 - i, sy - 9, 14 - i * 2, R, f, i, -1));
  mascaraGrande(L, sx, sy, ORO, ROJO, CIAN);
  [VERDE, AZUL].forEach((R, i) => cinta(L, sx + 8 + i, sy - 9, 14 - i * 2, R, f, 2 + i, 1));
  return L.sprite();
}

// ---------- 6. La tarima del concurso ----------

/** El telón pintado: el cielo, el sol con sus rayos, el Galeras con nieve y humito, y los cerros verdes. */
const telonGaleras =
  (len: number, alto: number): Pinta =>
  (u, v) => {
    if (u < 1.2 || u > len - 1.2 || v < 1 || v > alto - 1.2) return at(MADERA, v > alto - 1.2 ? 4.4 : 3);
    const ds = Math.hypot(u - 9, v - alto + 9);
    if (ds < 3.4) return at(AMARILLO, ds < 2 ? 5 : 4.2);
    if (ds < 6.4 && Math.floor((Math.atan2(v - alto + 9, u - 9) + 4) * 2.55) % 2 === 0) return at(NARANJA, 4);
    const cumbre = alto * 0.62 - Math.abs(u - len * 0.6) * 0.85;
    if (v < cumbre) {
      if (v > cumbre - 2.4) return at(BLANCO, 5);
      return at(C.leaf, (u > len * 0.6 ? 2.2 : 3) + (Math.floor(u + v) % 5 === 0 ? 0.6 : 0));
    }
    const humo = Math.hypot(u - len * 0.6 - (v - alto * 0.62) * 0.4, (v - alto * 0.62) % 4 - 2) < 1.6 && v > alto * 0.62 && v < alto * 0.62 + 9;
    if (humo) return at(BLANCO, 4.4);
    const cerro = 6 + Math.sin(u * 0.28) * 2.6;
    if (v < cerro) return at(C.leaf, 3.6 + (Math.floor(u / 3) % 2 ? 0.3 : -0.2));
    if (v < cerro + 0.9) return at(C.leaf, 4.6);
    return at(v > alto * 0.7 ? AZUL : CIAN, v > alto * 0.7 ? 4.2 : 4.6);
  };

/**
 * La tarima del concurso (el palco del jurado), 3x2: piso de tablas, el faldón de tela con festones de
 * colores y fleco dorado, los escalones al frente, el telón pintado con el Galeras, el letrero "CARNAVAL"
 * pintado a mano, dos mástiles con la bandera de Nariño y la de Colombia y la mesa del jurado con el trofeo.
 */
function tarimaComparsa(f = 0): Sprite {
  const L = new Lienzo(3, 2, 104);
  const len = 48;
  const dep = 30;
  const zt = 11;
  L.sombra(0, 0, len + 2, dep + 9, 0.28);
  L.caja(0, 0, 0, len, dep, zt, tablas(MADERA, 4, 3.8, 2, dep), faldon(zt, [ROJO, AMARILLO, AZUL, VERDE], 8, 0.2), faldon(zt, [MAGENTA, NARANJA], 8, -0.8));
  // El telón y su bastidor, y encima el letrero de borde ondulado.
  const hb = 32;
  L.caja(1, 0, zt, len - 2, 2.4, hb, (u) => at(MADERA, u < 1 ? 4 : 4.6), telonGaleras(len - 2, hb), () => at(MADERA, 2.2));
  const zl = zt + hb;
  const hl = 14;
  const onda = (u: number) => hl - 1.2 - Math.abs(Math.sin(u * 0.4)) * 1.4;
  L.plano([0, 0.6, zl - 1], [0, 1, 0], [0, 0, 1], 2, hl, () => null);
  L.plano([len, 0.6, zl - 1], [0, 1, 0], [0, 0, 1], 2, onda(len), () => at(ROJO, 1.8));
  L.plano([0, 2.6, zl - 1], [1, 0, 0], [0, 0, 1], len, hl, (u, v) => {
    const top = onda(u) - v;
    if (top < 0) return null;
    if (top < 1.4 || v < 1.4 || u < 1.4 || u > len - 1.4) return at(ROJO, top < 0.7 ? 4.2 : 3);
    if (top < 2.2 || v < 2.2) return at(ORO, 4);
    return at(AMARILLO, 4.4);
  });
  // La mesa del jurado: mantel blanco con el borde bordado de colores, el trofeo y un florero.
  L.caja(28, 7, zt, 16, 7, 7.4, (_u, v) => at(BLANCO, v > 6 ? 5 : 4.6), (u, v) => (v < 2 ? at(FIESTA[Math.floor(u / 2) % FIESTA.length]!, Math.floor(u) % 2 ? 3.4 : 4) : at(BLANCO, v > 6.6 ? 4.6 : 4)), () => at(BLANCO, 2.8));
  const tq = L.p(39, 10, zt + 7.4);
  L.estampa(tq.x - 3, tq.y - 8, TROFEO, tonos(ORO), { luz: false });
  const fq = L.p(31, 10, zt + 7.4);
  L.estampa(fq.x - 1, fq.y - 4, [".oo.", "o43o", "o32o", ".oo."], tonos(AZUL), { luz: false });
  [MAGENTA, AMARILLO, ROJO, NARANJA].forEach((R, i) => L.estampa(fq.x - 3 + i * 2, fq.y - 8 - (i % 2) * 2, [".o.", "o4o", ".o."], tonos(R), { luz: false }));
  // Los escalones del frente.
  for (let i = 0; i < 3; i++) L.caja(17, dep + i * 3, 0, 14, 3, zt - (i + 1) * 3.4, tablas(MADERA, 3, 4.2, 5, 3), (_u, v) => at(MADERA, v > zt - (i + 1) * 3.4 - 0.9 ? 3.8 : 3), () => at(MADERA, 2));
  // Los mástiles de las esquinas del frente, con la bandera de Nariño y la de Colombia.
  const t = (f * Math.PI) / 2;
  const bandera = (x: number, lado: number, franjas: Ramp[], i: number) => {
    const pt = L.poste(x, dep - 2, zt, 46, [BLANCO, AZUL], 2, 3);
    L.estampa(pt.x - 2, pt.top - 5, PERILLA, tonos(ORO), { luz: false });
    const y0 = pt.top + 2;
    for (let k = 0; k < 14; k++) {
      const ola = Math.sin(t + k * 0.55 + i) * 1.4 * (k / 14);
      const luz = Math.cos(t + k * 0.55 + i);
      const xx = pt.x + (lado > 0 ? 2 : -1) + lado * k;
      const yy = Math.round(y0 + k * 0.5 * lado + ola);
      for (let r = 0; r < 9; r++) {
        const R = franjas[Math.min(franjas.length - 1, Math.floor((r / 9) * franjas.length * (franjas.length === 3 ? 1 : 1)))]!;
        const tono = (r === 0 ? 4.6 : 3.4) + (luz > 0.4 ? 0.6 : luz < -0.4 ? -0.8 : 0);
        L.set(xx, yy + r, at(R, tono));
      }
    }
  };
  // Nariño: amarillo y verde; Colombia: amarillo (la mitad), azul y rojo.
  bandera(2, -1, [AMARILLO, VERDE], 0);
  bandera(46, 1, [AMARILLO, AMARILLO, AZUL, ROJO], 1);
  // Banderines del letrero a los mástiles.
  const izq = L.p(2, dep - 2, zt + 40);
  const der = L.p(46, dep - 2, zt + 40);
  const caida = (u: number) => Math.sin(Math.PI * u) * 6;
  cuerdaPx(L, izq, der, caida, at(OSCURA, 1.4));
  for (let k = 1; k < 10; k++) {
    const u = k / 10;
    banderinPx(L, izq.x + (der.x - izq.x) * u, izq.y + (der.y - izq.y) * u + caida(u), FIESTA[k % FIESTA.length]!, f, k);
  }
  const c0 = L.p(len / 2, 2.6, zl + hl - 4);
  const tw = 47;
  L.letras(c0.x - tw / 2 + 0.5, c0.y - 3 - tw / 4, "CARNAVAL", [ROJO, AZUL, VERDE, MAGENTA, NARANJA, MORADO, ROJO, AZUL].map((R) => at(R, 2.4)), alpha(at(OSCURA, 0), 0.75), 0.5);
  return L.sprite();
}

// ---------- 7. Los puestos ----------

/** Borla de lana de colores con su nudo dorado (cuelga de cada pico del festón). */
const BORLA = [".o.", "oYo", "o4o", "o3o", "o2o", ".o."];
/** La paila grande vista desde arriba (borde de metal y el aceite o el dulce adentro). */
const PAILA_G = [
  "....ooooooooo....",
  "..ooMMMMMMMMMoo..",
  ".oMMgggggggggMMo.",
  "oMMgggggggggggMMo",
  "oMgggggggggggggMo",
  ".oMMgggggggggMMo.",
  "..ooMMMMMMMMMoo..",
  "....ooooooooo....",
];
/** El frito pastuso amontonado: cerdo dorado (café) y papas amarillas. */
const FRITO = [".....ooo.....", "...ooCCYo....", "..oCCcYYYoo..", ".oYYCCCcCYYo.", "oCCYYcCCYYCCo", ".ooooooooooo."];
const FRITO_LEY: Ley = { C: [CAFE, 3.4], c: [CAFE, 2], Y: [AMARILLO, 3.8] };
/** Una empanada de añejo grande, con el repulgue. */
const EMPANADA_G = ["..ooooo..", ".o55444o.", "o4545454o", "o3333333o", ".ooooooo."];
/** La olla negra del hervido, con la bebida naranja hirviendo y sus paticas. */
const OLLA = [
  "...ooooooooooo...",
  ".ooNNNNNNNNNNNoo.",
  "oKKNNnNNNNNnNNKKo",
  "oKKKKKKKKKKKKKKKo",
  "okhKKKKKKKKKKKddo",
  "okkKKKKKKKKKKKddo",
  "okkKKKKKKKKKKKddo",
  ".okKKKKKKKKKKKdo.",
  ".okKKKKKKKKKKKdo.",
  "..okKKKKKKKKKdo..",
  "...ooKKKKKKKoo...",
  "....oo.....oo....",
];
const OLLA_LEY: Ley = { K: at(NEGRO, 2.3), k: at(NEGRO, 3.5), h: at(NEGRO, 5), d: at(NEGRO, 1.2), N: [NARANJA, 3.2], n: [AMARILLO, 4.4] };
/** La paila de cobre del helado, con el helado blanco que se bate sobre el hielo. */
const PAILA_COBRE = [
  ".....ooooooooo.....",
  "...ooBBBBBBBBBoo...",
  ".ooBBWWWwWWwWWBBoo.",
  "oBBWWwWWWWWwWWWWBBo",
  "oBBBWWWWwWWWWWWBBBo",
  ".oBBBBWWWWWWWBBBBo.",
  "..ooBBBBBBBBBBBoo..",
  "....ooooooooooo....",
];
const COBRE = hexRamp("#cf7a3c");
/** Un cajón de madera lleno (lo de `P`, con pintas `p`). */
const CAJON = ["..ooooooo..", ".oPPPPPPPo.", "oPpPPpPPpPo", "oMMMMMMMMMo", "oMmMMmMMmMo", "oMMMMMMMMMo", "oMmMMmMMmMo", ".ooooooooo."];
/** Un canasto de mimbre lleno. */
const CANASTO = ["..ooooooo..", ".oPPpPPpPo.", "oPPPPPPPPPo", "oBbBbBbBbBo", "obBbBbBbBbo", ".oBbBbBbBo.", "..ooooooo.."];
const cajonLey = (R: Ramp): Ley => ({ P: [R, 3.6], p: [R, 2.4], M: [MADERA, 3.8], m: [MADERA, 2.4], B: [C.cork, 3.8], b: [C.cork, 2.6] });
/** Un vasito de helado de color. */
const VASITO = [".oo.", "o54o", "o43o", "oWWo", "oWWo", ".oo."];
/** La flor pintada en los tableros del mostrador (u a la derecha, las filas de arriba abajo). */
const FLOR = [".p.p.", "ppcpp", ".pcp.", "..g..", ".ggg."];

/** El frente del mostrador en tableros enmarcados en madera, cada uno con su flor pintada. */
const frentePaneles =
  (R: Ramp, flor: Ramp, alto: number): Pinta =>
  (u, v) => {
    const ancho = 10;
    const k = Math.floor(u / ancho);
    const uu = u - k * ancho;
    if (v > alto - 1.4) return at(OSCURA, v > alto - 0.7 ? 4.4 : 3.4);
    if (v < 1.2) return at(OSCURA, 2.2);
    if (uu < 1.2) return at(OSCURA, uu < 0.6 ? 3.6 : 2.6);
    const i = Math.floor(uu - ancho / 2 + 3);
    const j = Math.floor(alto / 2 + 2.5 - v);
    const c = FLOR[j]?.[i];
    if (c === "p") return at(k % 2 ? AMARILLO : flor, 4.2);
    if (c === "c") return at(NARANJA, 3.6);
    if (c === "g") return at(VERDE, 3.4);
    return at(R, 3 + (v > alto - 3 ? 0.4 : 0) - (uu > ancho - 1.6 ? 0.5 : 0));
  };

interface PuestoOpts {
  /** Largo en x (tiles). */
  tiles: number;
  /** Colores de las franjas del toldo y del festón. */
  toldo: Ramp[];
  /** El letrero pintado sobre el toldo. */
  letrero: { text: string; fondo: Ramp; letras: Ramp[] };
  /** La vendedora (o el vendedor): pinta del chibi y en qué x va. */
  vende: { look: LookInput; x: number };
  /** El frente del mostrador (el de tableros con su color y el de las flores, o uno propio). */
  frente: Pinta;
  /** Lo que va en el fondo, detrás de la vendedora. */
  fondo?: (L: Lienzo, zm: number, f: number) => void;
  /** Lo que va encima del mostrador. */
  mercancia: (L: Lienzo, zm: number, f: number) => void;
  /** Los cajones y canastos del piso, en la punta del puesto. */
  piso: (L: Lienzo, x: number) => void;
}

/** Ancho del mostrador: lo que sobra en la punta de la derecha es para los cajones. */
const MOSTRADOR_HASTA = (len: number) => len - 9;

/**
 * Un puesto de feria: el mostrador de tableros pintados, cuatro parales de colores, el toldo alto de
 * franjas con su festón de picos y borlas, el letrero pintado encima, la vendedora detrás y los cajones y
 * canastos del piso. Mira a +y (la vereda).
 */
function puesto(o: PuestoOpts, f: number): Sprite {
  const len = o.tiles * 16;
  const L = new Lienzo(o.tiles, 1, 104);
  L.sombra(0, 0, len + 1, 18, 0.26);
  const zm = 12;
  const zA = 63;
  const zF = 52;
  const yF = 17.5;
  const hasta = MOSTRADOR_HASTA(len);
  // Los parales de atrás, el fondo y la vendedora.
  for (const x of [1.4, len - 1.6]) L.poste(x, 1.4, 0, zA - 1, [o.toldo[0]!, BLANCO], 2, 3);
  o.fondo?.(L, zm, f);
  L.persona(o.vende.look, o.vende.x, 4, 0);
  // El mostrador con su tablero de encima.
  L.caja(1.5, 7, 0, hasta - 1.5, 8, zm, null, o.frente, (u, v) => at(OSCURA, v > zm - 1.2 ? 3.4 : Math.floor(u / 2.6) % 2 ? 2.4 : 2));
  L.caja(0.8, 6.4, zm, hasta - 0.3, 9.2, 1.4, tablas(MADERA, 3, 4.2, 4, 9.2), (_u, v) => at(MADERA, v > 0.7 ? 4 : 3), () => at(MADERA, 2.2));
  o.mercancia(L, zm + 1.4, f);
  o.piso(L, hasta + 0.5);
  for (const x of [1.4, len - 1.6]) L.poste(x, 15.6, 0, zF - 1, [o.toldo[0]!, BLANCO], 2, 3);
  // El toldo: franjas que corren de atrás hacia adelante, cada una con su costura y sus arrugas.
  const ancho = 4;
  const franja = (u: number) => o.toldo[Math.floor(u / ancho) % o.toldo.length]!;
  const pend = (zF - zA) / (yF + 0.5);
  L.plano([-0.5, -0.5, zA], [1, 0, 0], [0, 1, pend], len + 1, yF + 0.5, (u, v) => {
    const uu = u % ancho;
    if (uu < 0.7) return at(franja(u), 2.4);
    const arruga = Math.floor(v) % 6 === 3 && uu > 1.2 && uu < 3.2;
    return at(franja(u), (v < 3 ? 4.8 : v < 10 ? 4.3 : 3.9) - (arruga ? 0.6 : 0) + (uu < 1.4 ? 0.3 : 0));
  });
  // El festón de picos del costado y del frente, con una borla en cada pico.
  const pico = (u: number) => 1.6 + 3.6 * (1 - Math.abs(((u % ancho) / ancho) * 2 - 1));
  L.plano([len + 0.5, -0.5, zA - 5.4], [0, 1, pend], [0, 0, 1], yF + 0.5, 5.4, (u, v) => {
    const bajo = 5.4 - v;
    if (bajo > pico(u)) return null;
    return bajo < 1 ? at(ORO, 3) : at(franja(u), 2.2 - (bajo > pico(u) - 0.8 ? 0.6 : 0));
  });
  L.plano([-0.5, yF, zF - 5.4], [1, 0, 0], [0, 0, 1], len + 1, 5.4, (u, v) => {
    const bajo = 5.4 - v;
    if (bajo > pico(u)) return null;
    if (bajo < 1) return at(ORO, 4.2);
    return at(franja(u), 3.6 + ((u % ancho) / ancho < 0.5 ? 0.4 : -0.3) - (bajo > pico(u) - 0.8 ? 0.9 : 0));
  });
  for (let u = ancho / 2; u < len + 1; u += ancho) {
    const q = L.p(u - 0.5, yF, zF - 5.4 - 3.4);
    L.estampa(q.x - 1, q.y, BORLA, tonos(FIESTA[Math.floor(u / ancho + 3) % FIESTA.length]!, { Y: [ORO, 4.2] }), { luz: false });
  }
  // El letrero encima del toldo: tabla con borde oscuro y letras de colores.
  const { text, fondo } = o.letrero;
  const tw = anchoTexto(text);
  const bw = tw + 6;
  const x0 = len / 2 - bw / 2;
  const zb = zA - 2;
  const hb = 11;
  L.plano([x0 + bw, 0, zb], [0, 1, 0], [0, 0, 1], 1.2, hb, () => at(OSCURA, 2));
  L.plano([x0, 1.2, zb], [1, 0, 0], [0, 0, 1], bw, hb, (u, v) => {
    if (v < 1 || v > hb - 1 || u < 1 || u > bw - 1) return at(OSCURA, v > hb - 1 ? 4 : 3);
    return at(fondo, v > hb - 2.2 ? 4.8 : 4.3);
  });
  const q = L.p(x0 + 3, 1.2, zb + hb - 2);
  L.letras(q.x, q.y, text, o.letrero.letras.map((R) => at(R, 2.4)), alpha(at(OSCURA, 0), 0.6), 0.5);
  return L.sprite();
}

/** Ancho en píxeles de un texto de 5x7. */
function anchoTexto(text: string): number {
  let w = 0;
  for (const ch of text) w += (glyph(ch)?.[0]?.length ?? 3) + 1;
  return w - 1;
}

/** Una mascarita colgada (7x7, o con cuernos). */
function mascarita(L: Lienzo, sx: number, sy: number, base: Ramp, franja: Ramp, cuernos = false) {
  L.estampa(sx, sy - (cuernos ? 2 : 0), cuernos ? MASCARITA_CUERNOS : MASCARITA, mascaritaLey(base, franja), { luz: false });
}

/** Pone una grilla con la base (abajo al centro) en el punto (x, y, z) del mundo. */
function apoya(L: Lienzo, x: number, y: number, z: number, rows: readonly string[], ley: Ley, luz = true) {
  const q = L.p(x, y, z);
  const w = Math.max(...rows.map((r) => r.length));
  L.estampa(q.x - Math.floor(w / 2), q.y - rows.length + 1, rows, ley, { luz });
}

/** Dos cajones o canastos apilados en la punta del puesto. */
const pisoDe =
  (abajo: [readonly string[], Ramp], arriba: [readonly string[], Ramp]) =>
  (L: Lienzo, x: number) => {
    apoya(L, x + 3.5, 7, 0, abajo[0], cajonLey(abajo[1]));
    apoya(L, x + 4.5, 12, 0, arriba[0], cajonLey(arriba[1]));
  };

const vendedora = (shirt: string, pants: string, extra: Partial<LookInput> = {}): LookInput => ({ skin: "#c68642", hair: "#2a1810", shirt, pants, hairStyle: "braids", outfit: "apron", ...extra });

/** El puesto del carnaval: máscaras, maicena y serpentinas, con la vendedora y el toldo de colores. */
function puestoCarnaval(f = 0): Sprite {
  return puesto(
    {
      tiles: 2,
      toldo: [ROJO, AMARILLO, VERDE, AZUL],
      letrero: { text: "MAICENA", fondo: BLANCO, letras: [ROJO, AZUL, VERDE, MAGENTA] },
      vende: { look: vendedora("#e2329a", "#2f3f73", { head: "straw-hat" }), x: 9 },
      frente: frentePaneles(MORADO, MAGENTA, 12),
      fondo: (L, zm) => {
        // Un tablero con máscaras colgadas detrás de la vendedora.
        L.caja(15, 1.6, 0, 9, 1, zm + 26, null, (u, v) => (Math.floor(u) % 3 === 1 && Math.floor(v) % 3 === 1 ? at(OSCURA, 1.6) : at(C.cork, 3.5)), () => at(C.cork, 2));
        const q = L.p(15, 2.6, zm + 26);
        mascarita(L, q.x + 1, q.y + 2, ROJO, AMARILLO, true);
        mascarita(L, q.x + 1, q.y + 11, AMARILLO, CIAN);
        mascarita(L, q.x + 1, q.y + 20, AZUL, MAGENTA);
      },
      mercancia: (L, zm) => {
        // Bolsitas de maicena apiladas, rollos de serpentina y un antifaz.
        [ROJO, AZUL, VERDE].forEach((R, i) => apoya(L, 4 + i * 3.4, 10 + (i % 2), zm, BOLSA, tonos(BLANCO, { R: [R, 3.4] }), false));
        apoya(L, 5.7, 10.5, zm + 5, BOLSA, tonos(BLANCO, { R: [MAGENTA, 3.4] }), false);
        apoya(L, 16, 11, zm, ["..oooooooo..", ".o35353535o.", "o3535353535o", "o5353535353o", ".o35353535o.", "..oooooooo.."], tonos(C.cork), false);
        [ROJO, AMARILLO, VERDE, CIAN, MAGENTA].forEach((R, i) => apoya(L, 13.5 + i * 1.3, 10 + i * 0.7, zm + 3.5, ROLLO, tonos(R, { K: at(OSCURA, 1) }), false));
      },
      piso: pisoDe([CAJON, BLANCO], [CANASTO, MAGENTA]),
    },
    f,
  );
}

/** El puesto de máscaras y sombreros: un tablero de corcho lleno de máscaras y los sombreros arriba. */
function puestoMascaras(f = 0): Sprite {
  return puesto(
    {
      tiles: 2,
      toldo: [MORADO, AMARILLO],
      letrero: { text: "MASCARAS", fondo: BLANCO, letras: [MORADO, ROJO, AZUL, VERDE] },
      vende: { look: { skin: "#8d5524", hair: "#151010", shirt: "#ff7618", pants: "#3a3047", hairStyle: "short", head: "vueltiao" }, x: 6 },
      frente: frentePaneles(AZUL, AMARILLO, 12),
      fondo: (L, zm) => {
        L.caja(11, 1.4, 0, 14, 1.2, zm + 30, null, (u, v) => (Math.floor(u) % 3 === 1 && Math.floor(v) % 3 === 1 ? at(OSCURA, 1.6) : at(C.cork, 3.5)), () => at(C.cork, 2));
        const q = L.p(11, 2.6, zm + 30);
        const M: [Ramp, Ramp, boolean][] = [
          [ROJO, AMARILLO, true],
          [AMARILLO, AZUL, false],
          [VERDE, MAGENTA, false],
          [MAGENTA, CIAN, true],
          [CIAN, NARANJA, false],
          [NARANJA, VERDE, false],
        ];
        M.forEach(([b, fr, c], i) => mascarita(L, q.x + 1 + (i % 2) * 7, q.y + 3 + (i % 2) * 3.5 + Math.floor(i / 2) * 9, b, fr, c));
      },
      mercancia: (L, zm) => {
        // Máscaras y sombreros de colores sobre el mostrador.
        apoya(L, 4, 11, zm, MASCARITA, mascaritaLey(AMARILLO, ROJO), false);
        apoya(L, 9, 12, zm, SOMBRERITO, { h: [PAJA, 3.6], b: [MAGENTA, 3] });
        apoya(L, 13.5, 11, zm, MASCARITA_CUERNOS, mascaritaLey(ROJO, AMARILLO), false);
        apoya(L, 18, 12, zm, SOMBRERITO, { h: [PAJA, 3.6], b: [VERDE, 3] });
        apoya(L, 18, 11, zm + 4, SOMBRERITO, { h: [PAJA, 3.6], b: [AZUL, 3] });
      },
      piso: pisoDe([CANASTO, AMARILLO], [CAJON, ROJO]),
    },
    f,
  );
}

/** El fogón de ladrillo con la candela adelante (cuadros). */
function fogon(L: Lienzo, x: number, y: number, zm: number, f: number) {
  L.caja(
    x - 6,
    y - 4,
    zm,
    12,
    8,
    4,
    (u, v) => at(BARRO, u < 1 || v < 1 ? 3.2 : 4),
    (u, v) => (Math.floor(v) % 2 === 1 || (Math.floor(u / 2.5) + Math.floor(v / 2)) % 2 === 0 ? (Math.floor(v) % 2 ? at(BARRO, 2) : at(BARRO, 3.2)) : at(BARRO, 2.8)),
    (_u, v) => at(BARRO, Math.floor(v) % 2 ? 1.6 : 2.2),
  );
  const q = L.p(x - 3, y + 4, zm);
  L.estampa(q.x - 1, q.y - 5, LLAMAS[f % 4]!, LLAMA_LEY, { luz: false });
}

/** Un puesto de comida pastusa: el puesto con su paila u olla, lo que vende y el humo que sube. */
function puestoComida(tipo: "frito" | "empanadas" | "hervido" | "helado", f = 0): Sprite {
  const COMIDA = {
    frito: { toldo: [ROJO, BLANCO, AZUL, BLANCO, AMARILLO, BLANCO], letrero: "FRITO", fondo: AMARILLO, letras: [ROJO, VERDE], look: vendedora("#27ad48", "#3a3047", { head: "bandana" }), frente: frentePaneles(MORADO, NARANJA, 12), piso: pisoDe([CANASTO, AMARILLO], [CAJON, AMARILLO]) },
    empanadas: { toldo: [VERDE, BLANCO, NARANJA, BLANCO], letrero: "EMPANADAS", fondo: BLANCO, letras: [NARANJA, ROJO, AZUL], look: vendedora("#ff7618", "#2a3a6e", { hairStyle: "bun", head: "flower" }), frente: frentePaneles(VERDE, NARANJA, 12), piso: pisoDe([CANASTO, VERDE], [CANASTO, CAFE]) },
    hervido: { toldo: [AZUL, BLANCO, AMARILLO, BLANCO], letrero: "HERVIDO", fondo: AMARILLO, letras: [AZUL, ROJO], look: vendedora("#e5303a", "#3a3047", { head: "straw-hat", hairStyle: "long" }), frente: frentePaneles(AZUL, AMARILLO, 12), piso: pisoDe([CAJON, NARANJA], [CANASTO, AMARILLO]) },
    helado: { toldo: [MAGENTA, BLANCO, MORADO, BLANCO], letrero: "HELADO", fondo: BLANCO, letras: [MAGENTA, AZUL, VERDE], look: vendedora("#f4efe2", "#8b3bd6", { head: "headband", hairStyle: "curly" }), frente: frentePaneles(MAGENTA, CIAN, 12), piso: pisoDe([CANASTO, ROJO], [CANASTO, VERDE]) },
  }[tipo];
  return puesto(
    {
      tiles: 3,
      toldo: COMIDA.toldo,
      letrero: { text: COMIDA.letrero, fondo: COMIDA.fondo, letras: COMIDA.letras },
      vende: { look: COMIDA.look, x: 15 },
      frente: COMIDA.frente,
      piso: COMIDA.piso,
      mercancia: (L, zm, fr) => {
        if (tipo === "frito") {
          // La paila grande con el frito pastuso (cerdo dorado y papas amarillas) en el aceite hirviendo.
          fogon(L, 31, 10.5, zm, fr);
          apoya(L, 31, 10.5, zm + 4, PAILA_G, { M: [METAL, 3.6], g: [ORO, 3.4] });
          apoya(L, 31, 10.5, zm + 6, FRITO, FRITO_LEY);
          // El canasto de papas y la bandeja de lo ya frito, y la totuma de ají.
          apoya(L, 5.5, 11, zm, CANASTO, cajonLey(AMARILLO));
          apoya(L, 13, 12, zm, FRITO, FRITO_LEY);
          apoya(L, 20, 12.5, zm, [".ooo.", "oGGGo", "o543o", ".ooo."], tonos(C.cork, { G: [VERDE, 3.6] }), false);
          const p = L.p(31, 10.5, zm + 8);
          humoPx(L, p.x, p.y - 4, fr, true);
        } else if (tipo === "empanadas") {
          fogon(L, 31, 10.5, zm, fr);
          apoya(L, 31, 10.5, zm + 4, PAILA_G, { M: [METAL, 3.6], g: [ORO, 2.8] });
          apoya(L, 29.5, 10, zm + 5.5, EMPANADA_G, tonos(ORO), false);
          apoya(L, 33, 12, zm + 5.5, EMPANADA_G, tonos(ORO), false);
          // La bandeja de madera llena de empanadas y el ají de maní.
          L.bloque(3, 8.4, zm, 16, 6.4, 1.2, MADERA, 0.2);
          for (let i = 0; i < 5; i++) apoya(L, 6 + (i % 3) * 5, 10.5 + Math.floor(i / 3) * 3, zm + 1.2 + Math.floor(i / 3) * 0, EMPANADA_G, tonos(ORO), false);
          apoya(L, 9, 11.5, zm + 4, EMPANADA_G, tonos(ORO), false);
          apoya(L, 21.5, 12.5, zm, [".ooo.", "oGGGo", "o554o", ".ooo."], tonos(BLANCO, { G: [NARANJA, 3.4] }), false);
          const p = L.p(31, 10.5, zm + 8);
          humoPx(L, p.x, p.y - 4, fr);
        } else if (tipo === "hervido") {
          // La olla negra en el fogón con el hervido, el cucharón, los pocillos y los lulos.
          fogon(L, 31, 10.5, zm, fr);
          apoya(L, 31, 10.5, zm + 4, OLLA, OLLA_LEY, false);
          const p = L.p(31, 10.5, zm + 4);
          L.linea(p.x + 2, p.y - 11, p.x + 7, p.y - 19, at(MADERA, 4));
          L.linea(p.x + 3, p.y - 11, p.x + 8, p.y - 19, at(MADERA, 2.4));
          for (let i = 0; i < 4; i++) apoya(L, 4 + i * 3.2, 11 + (i % 2) * 2, zm, POCILLO, tonos(i % 2 ? BLANCO : BARRO, { N: [NARANJA, 2.4] }), false);
          apoya(L, 19.5, 12, zm, CANASTO, cajonLey(NARANJA));
          humoPx(L, p.x - 1, p.y - 12, fr);
        } else {
          // El helado de paila: la paila de cobre con el helado blanco y la paleta de madera.
          apoya(L, 30, 10.5, zm, PAILA_COBRE, { B: [COBRE, 3.4], W: [BLANCO, 4.6], w: [CIAN, 4.2] });
          const p = L.p(30, 10.5, zm);
          L.linea(p.x + 1, p.y - 4, p.x + 7, p.y - 15, at(MADERA, 4));
          L.linea(p.x + 2, p.y - 4, p.x + 8, p.y - 15, at(MADERA, 2.4));
          L.estampa(p.x + 6, p.y - 18, [".oo.", "oMMo", "oMMo", ".oo."], { M: [MADERA, 3.8] });
          // El brillo del cobre corre con el giro.
          L.set(p.x - 6 + (fr % 4) * 3, p.y - 6, at(COBRE, 5));
          [MAGENTA, AMARILLO, VERDE, MORADO, NARANJA].forEach((R, i) => apoya(L, 4 + i * 3, 11 + (i % 2) * 2, zm, VASITO, tonos(R, { W: [BLANCO, 4] }), false));
          humoPx(L, p.x - 2, p.y - 8, fr);
        }
      },
    },
    f,
  );
}

// ---------- 8. Las graderías ----------

/** Largo de las graderías (tiles). */
export const TRIBUNA_TILES = 6;
/** Altura de las bancas (arte) de la fila de adelante y la de atrás, y del pasillo de atrás. */
export const TRIBUNA_Z = { adelante: 9, atras: 18, pasillo: 4 } as const;

/** Una banca larga de tablas, con sus patas y el canto pintado de un color por puesto. */
function banca(L: Lienzo, len: number, y: number, z: number, prof: number) {
  for (let x = 1; x < len; x += 16) L.bloque(Math.min(x, len - 2.6), y + 1, 0, 1.6, prof - 2, z - 2, OSCURA, 0.4);
  L.caja(0, y, z - 2, len, prof, 2, tablas(MADERA, 3.6, 4, 7, prof), (u, v) => at(FIESTA[Math.floor(u / 16) % FIESTA.length]!, v > 1.2 ? 4.2 : 3.2), () => at(MADERA, 2.2));
}

/** El armazón pintado de la gradería: un paral de color con su perilla dorada. */
function paral(L: Lienzo, x: number, y: number, h: number) {
  const pt = L.poste(x, y, 0, h, [MORADO], 3, 99);
  L.estampa(pt.x - 1, pt.top - 4, PERILLA, tonos(ORO), { luz: false });
}

/** Banderines colgados de un borde que corre a lo largo de x, desde (0, y, z) hasta (len, y, z). */
function filaBanderines(L: Lienzo, len: number, y: number, z: number, f: number, cada = 5) {
  for (let x = 2; x < len - 2; x += cada) {
    const q = L.p(x, y, z);
    banderinPx(L, q.x, q.y, FIESTA[Math.floor(x / cada) % FIESTA.length]!, f, Math.floor(x / cada), Math.floor(x / cada) % 3 === 0);
  }
}

/** La cruz de los costados del armazón (en la cara +x): dos travesaños amarillos. */
function cruz(L: Lienzo, x: number, y0: number, y1: number, z0: number, z1: number) {
  const a = L.p(x, y0, z0);
  const b = L.p(x, y1, z1);
  const c = L.p(x, y0, z1);
  const d = L.p(x, y1, z0);
  for (const [p, q] of [
    [a, b],
    [c, d],
  ] as const) {
    L.linea(p.x, p.y, q.x, q.y, at(AMARILLO, 3.6));
    L.linea(p.x, p.y + 1, q.x, q.y + 1, at(AMARILLO, 2.2));
  }
}

/** La fila de adelante de la gradería: una banca larga y baja con banderines, de frente a la calle (plana). */
function tribunaAdelante(f = 0): Sprite {
  const len = TRIBUNA_TILES * 16;
  const L = new Lienzo(TRIBUNA_TILES, 1, 34);
  L.sombra(0, 2, len, 13, 0.24);
  paral(L, 0.8, 3, 14);
  // El faldón de tela tejida por debajo de la banca, y la banca.
  L.plano([0, 13.4, 0], [1, 0, 0], [0, 0, 1], len, TRIBUNA_Z.adelante - 2, (u, v) => tejido(u, TRIBUNA_Z.adelante - 2 - v, -0.3));
  banca(L, len, 3, TRIBUNA_Z.adelante, 11);
  paral(L, len - 0.8, 3, 14);
  paral(L, 0.8, 13.6, 12);
  paral(L, len - 0.8, 13.6, 12);
  cruz(L, len, 3, 13.6, 1, 9);
  return L.sprite();
}

/**
 * La fila de atrás: el armazón morado con perillas doradas y cruces amarillas, el espaldar, la banca alta,
 * el frente blanco con una fila de banderines y el pasillo de tablas delante (por ahí se llega a las dos
 * bancas, subiendo por la escalerita de cada punta).
 */
function tribunaAtras(f = 0): Sprite {
  const len = TRIBUNA_TILES * 16;
  const L = new Lienzo(TRIBUNA_TILES, 2, 64);
  L.sombra(-4, 0, len + 8, 32, 0.24);
  const zp = TRIBUNA_Z.pasillo;
  const za = TRIBUNA_Z.atras;
  // El espaldar: parales, el pasamanos blanco.
  for (let x = 16; x < len; x += 16) L.bloque(x, 1, 0, 1.6, 1.6, za + 12, OSCURA, 0.4);
  paral(L, 0.8, 1.6, za + 16);
  L.bloque(0, 1, za + 11, len, 1.6, 2, BLANCO, 0);
  banca(L, len, 3, za, 12);
  // El frente entre el pasillo y la banca alta: tablas blancas con una fila de banderines colgando.
  L.plano([0, 15, zp], [1, 0, 0], [0, 0, 1], len, za - zp - 2, (u, v) => at(BLANCO, Math.floor(u) % 8 === 0 ? 3 : v > za - zp - 3 ? 4.8 : 4.2));
  filaBanderines(L, len, 15.2, za - 2.4, f);
  paral(L, len - 0.8, 1.6, za + 16);
  // El pasillo con sus escaleritas a los lados.
  L.caja(0, 16, 0, len, 16, zp, tablas(MADERA, 3.2, 4, 3, 16), (u, v) => at(MADERA, v > zp - 0.9 ? 3.8 : Math.floor(u / 8) % 2 ? 3 : 2.7), () => at(MADERA, 2.2));
  for (const x of [-5, len]) L.caja(x, 19, 0, 5, 10, zp / 2, tablas(MADERA, 2.5, 4.2, 9, 10), () => at(MADERA, 3), () => at(MADERA, 2));
  paral(L, 0.8, 15.6, za + 2);
  paral(L, len - 0.8, 15.6, za + 2);
  cruz(L, len, 1.6, 15.6, 1, za - 1);
  return L.sprite();
}

// ---------- 9. Los arcos ----------

/** La cara del sol (ojos, nariz y sonrisa), pintada encima del disco. */
const CARA_SOL = [".K...K.", ".......", "...N...", "r.....r", ".rrrrr."];

/**
 * El sol de los Pastos: un disco dorado con su cara y rayos largos y cortos que se alternan en naranja y
 * amarillo, con la luz de arriba a la izquierda. Centro en (cx, cy) de pantalla.
 */
function sol(L: Lienzo, cx: number, cy: number, r = 6) {
  for (let y = -r - 6; y <= r + 6; y++)
    for (let x = -r - 6; x <= r + 6; x++) {
      const d = Math.hypot(x + 0.5, y + 0.5);
      const a = Math.atan2(y + 0.5, x + 0.5);
      if (d <= r) {
        const luz = -(x + y) / (2 * r);
        L.set(cx + x, cy + y, at(d > r - 1 ? ORO : AMARILLO, d > r - 1 ? 2.4 : 3.6 + luz * 1.2));
        continue;
      }
      // Dieciséis rayos: los largos en naranja, los cortos en amarillo, más angostos hacia la punta.
      const k = Math.round(a / (Math.PI / 8));
      const da = Math.abs(a - (k * Math.PI) / 8);
      const largo = k % 2 === 0;
      const hasta = r + (largo ? 6 : 4);
      if (d > hasta) continue;
      const ancho = 0.32 * (1 - (d - r) / (hasta - r)) + 0.05;
      if (da > ancho) continue;
      const R = largo ? NARANJA : AMARILLO;
      L.set(cx + x, cy + y, at(R, (x + y < 0 ? 4 : 3) - (da > ancho * 0.6 ? 0.8 : 0)));
    }
  L.estampa(cx - 3, cy - 2, CARA_SOL, { K: at(OSCURA, 1), N: [ORO, 2.4], r: [ROJO, 2.4] }, { luz: false });
}

/**
 * Un arco de carnaval: dos columnas de azulejos morados con rombos dorados, anillos de oro, una franja de
 * cuadros blancos y negros y el capitel dorado con su pompón; el arco de tabla con su grosor, el fleco
 * dorado, la franja de cuadros y el letrero "CARNAVAL" pintado a mano en letras de colores sobre amarillo;
 * arriba, el sol de los Pastos con un penacho de plumas grandes, y por dentro una sarta de pompones de
 * colores. `largo` en unidades de arte; con `alongY` corre a lo largo de y (el letrero se lee en la cara +x).
 */
function arcoCarnaval(largo: number, alongY: boolean): Sprite {
  const L = alongY ? new Lienzo(1, largo / 16, 130) : new Lienzo(largo / 16, 1, 130);
  // a: a lo largo del arco (desde la punta que queda a la izquierda en pantalla); b: de través (la cara que se ve, b grande).
  const P = (a: number, b: number): [number, number] => (alongY ? [b, largo - a] : [a, b]);
  const caja = (a: number, b: number, z: number, la: number, lb: number, h: number, frente: Pinta, arriba: Pinta, lado: Pinta) => {
    if (alongY) L.caja(b, largo - a - la, z, lb, la, h, arriba, lado, (u, v) => frente(la - u, v));
    else L.caja(a, b, z, la, lb, h, arriba, frente, lado);
  };
  const colH = 54;
  const azulejo =
    (luz: number): Pinta =>
    (u, v) => {
      // Los anillos dorados y la franja de cuadros de abajo.
      if (Math.abs(v - 13) < 1 || Math.abs(v - 33) < 1 || v > colH - 6) return at(ORO, (v > colH - 6 ? 3.8 : 4.4) + luz);
      if (v < 8) return Math.floor(u / 2) % 2 === Math.floor(v / 2) % 2 ? at(BLANCO, 4.4 + luz) : at(NEGRO, 1.6 + luz);
      const uu = u % 4;
      const vv = v % 4;
      if (uu < 0.6 || vv < 0.6) return at(BLANCO, 3.6 + luz);
      if (Math.abs(uu - 2.3) + Math.abs(vv - 2.3) < 1) return at(ORO, 4.4 + luz);
      return at(MORADO, 3.2 + luz + (uu < 1.4 ? 0.4 : 0));
    };
  for (const a0 of [3.5, largo - 12.5]) {
    const [sx, sy] = P(a0, 3);
    L.sombra(sx - 1, sy - 1, 12, 12, 0.28);
    caja(a0 - 1, 3, 0, 11, 10, 3, (_u, v) => at(OSCURA, v > 2 ? 3.4 : 2.6), (_u, v) => at(OSCURA, v > 9 ? 4.4 : 4), () => at(OSCURA, 2));
    caja(a0, 4, 3, 9, 8, colH - 3, azulejo(0), () => at(ORO, 4.4), azulejo(-1));
    caja(a0 - 1.2, 2.8, colH, 11.4, 10.4, 3, (_u, v) => at(ORO, v > 2 ? 4.4 : 3.4), (_u, v) => at(ORO, v > 9.4 ? 5 : 4.6), () => at(ORO, 2.4));
  }
  // El arco: una banda curva con su grosor (la cara de arriba asoma un poco detrás del frente).
  const a0 = 3.5;
  const a1 = largo - 3.5;
  const curva = (a: number) => colH + 1 + Math.sin((Math.PI * (a - a0)) / (a1 - a0)) * 9;
  const alto = 17;
  const banda = (b: number, pinta: Pinta) => {
    const [ox, oy] = P(a0, b);
    const du: V3 = alongY ? [0, -1, 0] : [1, 0, 0];
    L.plano([ox, oy, colH - 2], du, [0, 0, 1], a1 - a0, alto + 14, (u, v) => {
      const zz = colH - 2 + v;
      const base = curva(a0 + u);
      if (zz < base || zz > base + alto) return null;
      return pinta(u, zz - base);
    });
  };
  banda(5, (_u, v) => at(MORADO, v > alto - 1.4 ? 4.4 : 1.8));
  // La sarta de pompones de colores que cuelga por dentro del arco.
  for (let a = a0 + 9; a < a1 - 8; a += 3.4) {
    const [x, y] = P(a, 9);
    const caida = Math.sin((Math.PI * (a - a0 - 9)) / (a1 - a0 - 17)) * 4;
    const q = L.p(x, y, curva(a) - 3 - caida);
    L.estampa(q.x - 2, q.y - 2, POMPON, tonos(FIESTA[Math.floor(a / 3.4) % FIESTA.length]!), { luz: false });
  }
  banda(12, (u, v) => {
    const top = alto - v;
    if (top < 1.2 || v < 1.2) return at(ORO, top < 0.6 || v < 0.6 ? 2.8 : 4.4);
    // La franja de cuadros de abajo y la morada de arriba con sus puntitos dorados.
    if (v < 4) return Math.floor(u / 2) % 2 === Math.floor(v / 1.4) % 2 ? at(BLANCO, 4.6) : at(NEGRO, 1.4);
    if (top < 4) return Math.floor(u) % 5 === 2 && Math.floor(top) === 2 ? at(ORO, 4.6) : at(MORADO, 3.4);
    if (v < 4.8 || top < 4.8) return at(ORO, 3.8);
    if (u < 1.4 || u > a1 - a0 - 1.4) return at(MORADO, 3);
    return at(AMARILLO, 4.4);
  });
  // Los pompones de las columnas.
  for (const ac of [8, largo - 8]) {
    const [x, y] = P(ac, 8);
    const q = L.p(x, y, colH + 3);
    L.estampa(q.x - 3, q.y - 7, POMPON_G, tonos(ac < largo / 2 ? MAGENTA : NARANJA), { luz: false });
  }
  // Arriba: el penacho de plumas y el sol.
  const [mx, my] = P(largo / 2, 12);
  const mq = L.p(mx, my, curva(largo / 2) + alto + 12);
  abanico(L, mq.x, mq.y + 4, 34, [MORADO, NARANJA, AMARILLO, BLANCO, MORADO, AMARILLO, NARANJA, BLANCO, MORADO], 5.5);
  sol(L, mq.x, mq.y - 2, 7);
  // El letrero.
  const text = "CARNAVAL";
  const tw = anchoTexto(text);
  const cols = [ROJO, AZUL, VERDE, MAGENTA, NARANJA, MORADO, ROJO, AZUL].map((R) => at(R, 2.4));
  const ac = largo / 2 - tw / 2;
  const [tx, ty] = P(ac, 12);
  const q = L.p(tx, ty, curva(largo / 2) + alto - 5);
  L.letras(q.x, q.y, text, cols, alpha(at(OSCURA, 0), 0.75), alongY ? -0.5 : 0.5, (k) => curva(ac + k) - curva(largo / 2));
  return L.sprite();
}

// ---------- 10. La tarima de la murga ----------

/** Un parlante de torre (sin marca): el cajón oscuro, la rejilla y dos conos. */
function parlante(L: Lienzo, x: number, y: number, z: number, w: number, d: number, h: number) {
  const caja = hexRamp("#3a3442");
  L.caja(x, y, z, w, d, h, (_u, v) => at(caja, v > d - 1 ? 4.6 : 4), (u, v) => at(caja, v > h - 1 ? 3.8 : (Math.floor(u) + Math.floor(v)) % 2 ? 2.6 : 2.3), () => at(caja, 1.4));
  for (const k of [0.27, 0.68]) {
    const q = L.p(x + w / 2, y + d, z + h * k);
    L.estampa(q.x - 3, q.y - 3, CONO, tonos(METAL), { luz: false });
  }
}

/**
 * La tarima de la murga, 3x2: la plataforma con faldón de festones morados y amarillos, dos parlantes de
 * torre, el bombo pintado con un sol, el platillo, el atril con el micrófono, el charango y el telón "MURGA".
 */
function tarimaMusica(f = 0): Sprite {
  const L = new Lienzo(3, 2, 96);
  const len = 48;
  const dep = 30;
  const zt = 8;
  L.sombra(0, 0, len + 2, dep + 6, 0.28);
  L.caja(0, 0, 0, len, dep, zt, tablas(OSCURA, 4, 4, 2, dep), faldon(zt, [MORADO, AMARILLO], 6, 0.2), faldon(zt, [MORADO, AMARILLO], 6, -0.8));
  for (const x of [6, len - 7]) L.poste(x, 2, zt, 44, [MORADO, AMARILLO], 2, 3);
  // El telón con "MURGA", que ondea abajo.
  const ht = 18;
  L.plano([6, 2.6, zt + 24], [1, 0, 0], [0, 0, 1], len - 13, ht, (u, v) => {
    const ola = (Math.sin(u * 0.6 + f * 1.5) + 1) * 0.8;
    if (v < ola) return null;
    if (v > ht - 1.6) return at(ORO, v > ht - 0.8 ? 4.6 : 3.4);
    if (v < ola + 1) return at(AMARILLO, 3.6);
    const pliegue = Math.floor(u * 1.2) % 4;
    return at(MORADO, 3.2 + (pliegue === 0 ? 0.5 : pliegue === 2 ? -0.5 : 0));
  });
  parlante(L, 1.5, 3, zt, 9, 8, 26);
  parlante(L, len - 10.5, 3, zt, 9, 8, 26);
  // El platillo en su pie y el bombo con el parche pintado.
  const pc = L.p(33, 12, zt);
  L.linea(pc.x, pc.y, pc.x, pc.y - 16, at(METAL, 3.4));
  L.estampa(pc.x - 4, pc.y - 19, ["..ooooo..", "oo54443oo", "o4433322o", ".ooooooo."], tonos(ORO), { luz: false });
  const bc = L.p(22, 20, zt);
  L.estampa(bc.x - 7, bc.y - 15, [
    "....ooooooo....",
    "..ooWWWWWWWoo..",
    ".oWWWWYYYWWWWoR",
    ".oWWWYYYYYWWWoR",
    "oWWWYYNNNYYWWWoR",
    "oWWYYNNNNNYYWWoR",
    "oWWYYNNNNNYYWWoR",
    "oWWWYYNNNYYWWWoR",
    ".oWWWYYYYYWWWoRR",
    ".oWWWWYYYWWWWoRR",
    "..ooWWWWWWWooRR.",
    "....oooooooRRR..",
    ".....oRRRRRRo...",
  ], { W: [BLANCO, 4.2], Y: [AMARILLO, 4], N: [NARANJA, 3.6], R: [ROJO, 2.8] });
  // El atril con el micrófono y el charango recostado en el parlante.
  const mc = L.p(39, 25, zt);
  L.linea(mc.x, mc.y, mc.x, mc.y - 15, at(METAL, 3));
  L.estampa(mc.x - 1, mc.y - 18, [".o.", "oKo", "oKo", ".o."], { K: [NEGRO, 2.4] });
  const ch = L.p(len - 10, 12, zt);
  L.estampa(ch.x - 5, ch.y - 16, ["....oo", "...oKo", "..oKo.", ".oKo..", "oMMo..", "oMMMo.", "oMMMo.", ".ooo.."], { K: [OSCURA, 2.6], M: [MADERA, 3.6] });
  const q = L.p(len / 2 - 15, 2.6, zt + 24 + ht - 3);
  L.letras(q.x, q.y, "MURGA", [AMARILLO, BLANCO].map((R) => at(R, 4.4)), alpha(at(NEGRO, 0), 0.8), 0.5);
  return L.sprite();
}

// ---------- 11. Muñecos de papel maché ----------

/** Un muñeco de papel maché sobre su poste: el danzante con sombrero, ruana de franjas y pañuelos que se mecen. */
function munecoCarnaval(f = 0): Sprite {
  const L = new Lienzo(1, 1, 84);
  L.sombra(5, 5, 6, 6, 0.26);
  L.bloque(5.4, 5.4, 0, 5.2, 5.2, 3, OSCURA, 0.4);
  const pt = L.poste(8, 8, 3, 24, [AZUL, BLANCO], 3, 3);
  L.bloque(4.5, 4.5, 27, 7, 7, 1.4, MADERA, 0.3);
  const base = L.p(8, 8, 28.4);
  const w = DANZANTE[0]!.length;
  const h = DANZANTE.length;
  const x0 = Math.round(base.x) - Math.floor(w / 2);
  const y0 = Math.round(base.y) - h + 1;
  L.estampa(x0, y0, DANZANTE, DANZANTE_LEY);
  // Los pañuelos en las manos.
  cinta(L, x0, y0 + 15, 6, MAGENTA, f, 0, -1);
  cinta(L, x0 + w - 2, y0 + 15, 6, CIAN, f, 1.6, 1);
  void pt;
  return L.sprite();
}

/** El cuy gigante de papel maché (el de las fiestas de Nariño), con su ruanita y su sombrero, en su poste. */
function cuyCarnaval(): Sprite {
  const L = new Lienzo(1, 1, 70);
  L.sombra(5, 5, 6, 6, 0.26);
  L.bloque(5.4, 5.4, 0, 5.2, 5.2, 3, OSCURA, 0.4);
  L.poste(8, 8, 3, 22, [VERDE, AMARILLO], 3, 3);
  L.bloque(3.5, 3.5, 25, 9, 9, 1.4, MADERA, 0.3);
  const base = L.p(8, 8, 26.4);
  const w = CUY[0]!.length;
  const x0 = Math.round(base.x) - Math.floor(w / 2);
  const y0 = Math.round(base.y) - CUY.length + 1;
  L.estampa(x0, y0, CUY, CUY_LEY);
  L.estampa(x0 + 7, y0 - 1, RUANITA, RUANITA_LEY);
  L.estampa(x0 + 1, y0 - 4, SOMBRERITO, { h: [PAJA, 3.6], b: [ROJO, 3] });
  return L.sprite();
}

// ---------- 12. Globos ----------

/** Un racimo de globos amarrados a una estaca con su saquito de peso: se mecen con el viento. */
function globosCarnaval(f = 0): Sprite {
  const L = new Lienzo(1, 1, 96);
  L.sombra(6, 6, 4, 4, 0.22);
  L.bloque(6.4, 6.4, 0, 3.2, 3.2, 2.6, C.cork, 0.2);
  const ancla = L.p(8, 8, 2.6);
  const nudo = { x: Math.round(ancla.x), y: Math.round(ancla.y) - 26 };
  // Las cintas: una sola desde el saquito hasta el nudo, y de ahí una a cada globo.
  const cinta = alpha(at(BLANCO, 3), 0.76);
  L.linea(nudo.x, Math.round(ancla.y) - 2, nudo.x, nudo.y, cinta);
  const G: [number, number, Ramp][] = [
    [-9, -62, MORADO],
    [1, -66, AMARILLO],
    [10, -61, NEGRO],
    [-12, -52, AMARILLO],
    [-4, -55, BLANCO],
    [6, -53, NARANJA],
    [-7, -45, MORADO],
    [3, -46, AZUL],
    [11, -48, NARANJA],
  ];
  const pos = G.map(([dx, dy], i) => {
    const sw = [0, 1, 0, -1][(f + i) % 4]!;
    return { x: Math.round(ancla.x) + dx + sw, y: Math.round(ancla.y) + dy };
  });
  pos.forEach((p) => L.linea(nudo.x, nudo.y, p.x, p.y + 10, cinta));
  // De atrás (arriba) hacia adelante (abajo), cada globo con su brillo.
  G.forEach(([, , R], i) => L.estampa(pos[i]!.x - 4, pos[i]!.y, GLOBO, tonos(R), { luz: false }));
  return L.sprite();
}

// ---------- Registro ----------

/** Cuántos cuadros tiene cada mueble que se mueve (el navegador los pasa en bucle). */
export const CARNAVAL_DECOR_FRAMES: Record<string, number> = {
  "banderines-carnaval": CUADROS,
  "guirnalda-carnaval": CUADROS,
  "poste-banderines": CUADROS,
  "farol-carnaval": CUADROS,
  mascaron: CUADROS,
  "puesto-frito": CUADROS,
  "puesto-empanadas": CUADROS,
  "puesto-hervido": CUADROS,
  "puesto-helado": CUADROS,
  "globos-carnaval": CUADROS,
  "muneco-carnaval": CUADROS,
  "tribuna-carnaval-alta": CUADROS,
  "tribuna-carnaval": CUADROS,
  "tarima-comparsa": CUADROS,
  "tarima-musica": CUADROS,
};

const DIBUJO: Record<string, (f: number) => Sprite> = {
  "banderines-carnaval": banderines,
  "guirnalda-carnaval": guirnalda,
  "poste-banderines": posteBanderines,
  "farol-carnaval": farolCarnaval,
  "valla-carnaval": vallaCarnaval,
  "confeti-calle": confetiCalle,
  "serpentinas-suelo": serpentinasSuelo,
  mascaron,
  "tarima-comparsa": tarimaComparsa,
  "tarima-musica": tarimaMusica,
  "puesto-carnaval": puestoCarnaval,
  "puesto-mascaras": puestoMascaras,
  "puesto-frito": (f) => puestoComida("frito", f),
  "puesto-empanadas": (f) => puestoComida("empanadas", f),
  "puesto-hervido": (f) => puestoComida("hervido", f),
  "puesto-helado": (f) => puestoComida("helado", f),
  "tribuna-carnaval": tribunaAdelante,
  "tribuna-carnaval-alta": tribunaAtras,
  "arco-carnaval": () => arcoCarnaval(64, false),
  "arco-carnaval-y": () => arcoCarnaval(80, true),
  "muneco-carnaval": munecoCarnaval,
  "cuy-carnaval": cuyCarnaval,
  "globos-carnaval": globosCarnaval,
};

/** Los tipos con dibujo (para el catálogo y los tests). */
export const CARNAVAL_DECOR_TYPES = Object.keys(DIBUJO);

/** Pone varios cuadros en un lienzo común (la unión de todos), con el mismo origen: el navegador solo cambia la textura. */
function mismoLienzo(list: Sprite[]): Sprite[] {
  const x0 = Math.min(...list.map((s) => -s.ox));
  const y0 = Math.min(...list.map((s) => -s.oy));
  const x1 = Math.max(...list.map((s) => s.canvas.width - s.ox));
  const y1 = Math.max(...list.map((s) => s.canvas.height - s.oy));
  return list.map((s) => {
    const c = new PixelCanvas(x1 - x0, y1 - y0);
    const dx = -s.ox - x0;
    const dy = -s.oy - y0;
    for (let y = 0; y < s.canvas.height; y++) c.data.set(s.canvas.data.subarray(y * s.canvas.width * 4, (y + 1) * s.canvas.width * 4), ((y + dy) * c.width + dx) * 4);
    return { canvas: c, ox: -x0, oy: -y0 };
  });
}

const cuadros = new Map<string, Sprite[]>();

/**
 * El cuadro `f` de un mueble de la decoración. Todos los cuadros de un mueble tienen el mismo lienzo y el
 * mismo origen que el dibujo del catálogo (el cuadro 0): el navegador solo le cambia la textura.
 */
export function carnavalDecorSprite(type: string, f = 0): Sprite {
  let list = cuadros.get(type);
  if (!list) {
    const draw = DIBUJO[type];
    if (!draw) throw new Error(`Sin dibujo de carnaval: ${type}`);
    const n = CARNAVAL_DECOR_FRAMES[type] ?? 1;
    list = n > 1 ? mismoLienzo(Array.from({ length: n }, (_, k) => draw(k))) : [draw(0)];
    cuadros.set(type, list);
  }
  return list[((f % list.length) + list.length) % list.length]!;
}

/** Los dibujos del catálogo (van en DRAW de furniture.ts): el cuadro 0 de cada uno. */
export const CARNAVAL_DRAW: Record<string, () => Sprite> = Object.fromEntries(CARNAVAL_DECOR_TYPES.map((t) => [t, () => carnavalDecorSprite(t, 0)]));
