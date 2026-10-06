// El Festival de cometas por código (VIR-168): las cometas que vuelan (salen del código, ver cometa.ts de
// @hyvento/shared: forma, dos colores de papel y la cola de trapitos), la mesa del taller, el puesto de
// cometas, el carrito del raspao, el tablero del concurso, la manga de viento (con sus variantes, que la
// escena elige según el viento), los banderines, las cometas amarradas, el mantel del picnic, el árbol con
// la cometa enredada y la escalera del garaje. Coordenadas locales de arte (tile = 16); lo de enfrente
// mira a +y. Cálido y de verano: papel de seda, guadua y cabuya; nada gris.
import { COMETA_COLORES, COMETAS_GENTE, cometaPartes, type CometaColorLetra, type CometaForma } from "@hyvento/shared";
import { Escena, type Tinte } from "./exterior-escena";
import { NATURE_DRAW } from "./exterior-naturaleza";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, at, hex, noise, ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;
const WOOD = C.wood;
/** La guadua de los palitos y la cabuya del hilo. */
const GUADUA = ramp("#5a4214", "#8a6a24", "#b8933a", "#d8b85a", "#efd890");
const CABUYA = hex("#e8d6a8");
const CABUYA_OSCURA = hex("#a8875a");

const papel = (l: CometaColorLetra): RGBA => hex(COMETA_COLORES[l].hex);
const aclarar = (c: RGBA, t: number): RGBA => mix(c, hex("#ffffff"), t);
const oscurecer = (c: RGBA, t: number): RGBA => mix(c, OUT, t);

// ---------- La cometa (de frente, como se ve en el cielo) ----------

/** Cuadros de la cola que se mece (la escena los alterna). */
export const COMETA_FRAMES = 4;

interface Forma {
  w: number;
  h: number;
  /** El punto del frenillo (donde se amarra el hilo) y el de la cola. */
  centro: [number, number];
  cola: [number, number];
  /** 0 = afuera, 1 = papel del color 1, 2 = papel del color 2, 3 = palito, 4 = ojo. */
  pinta(u: number, v: number): number;
}

const FORMAS: Record<CometaForma, Forma> = {
  rombo: {
    w: 15,
    h: 17,
    centro: [7, 6],
    cola: [7, 16],
    pinta(u, v) {
      const d = Math.abs(u - 7);
      const hw = v <= 6 ? (7 * v) / 6 : (7 * (16 - v)) / 10;
      if (d > hw + 0.3) return 0;
      if (u === 7 || v === 6) return 3;
      return (u < 7) === (v < 6) ? 1 : 2;
    },
  },
  hexagonal: {
    w: 15,
    h: 17,
    centro: [7, 8],
    cola: [7, 16],
    pinta(u, v) {
      const d = Math.abs(u - 7);
      const hw = v < 4 ? (7 * v) / 4 : v <= 12 ? 7 : (7 * (16 - v)) / 4;
      if (d > hw + 0.3) return 0;
      const dx = u - 7;
      const dy = (v - 8) * 0.9;
      if (u === 7 || Math.abs(dy - dx * 0.55) < 0.5 || Math.abs(dy + dx * 0.55) < 0.5) return 3;
      // Un hexágono adentro del otro y los gajos alternados.
      const inner = Math.abs(dx) + Math.abs(dy) * 0.6 < 3.2;
      const sector = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 6) % 2;
      return inner ? 2 : sector ? 1 : 2;
    },
  },
  pajaro: {
    w: 21,
    h: 14,
    centro: [10, 4],
    cola: [10, 13],
    pinta(u, v) {
      const d = Math.abs(u - 10);
      // Las alas abiertas (con la punta levantada) y el cuerpo angosto que sigue hacia abajo.
      const ala = v <= 3 ? 2 + (8 * v) / 3 : v <= 8 ? 10 - (v - 3) * 1.7 : 0;
      const cuerpo = v <= 13 ? 1.6 - Math.max(0, v - 9) * 0.3 : 0;
      if (d > Math.max(ala, cuerpo) + 0.3) return 0;
      if (v === 2 && d <= 9) return 3;
      if (d <= 1.6) return v === 1 && d >= 1 ? 4 : 2;
      return d > 6 ? 2 : 1;
    },
  },
  pez: {
    w: 13,
    h: 18,
    centro: [6, 6],
    cola: [6, 17],
    pinta(u, v) {
      const dx = u - 6;
      const dy = v - 6;
      if ((dx * dx) / 30 + (dy * dy) / 40 <= 1) {
        if (u === 4 && v === 3) return 4;
        if (u === 6 && v <= 11) return 3;
        // Las escamas: arcos del otro color cada tres filas.
        return (v + Math.abs(dx) * 0.5) % 3 < 1 && v > 4 ? 2 : 1;
      }
      // La aleta de la cola en V.
      if (v >= 12 && v <= 17) {
        const d = Math.abs(dx);
        if (d <= (v - 11) * 1.1 && d >= (v - 12) * 0.45) return 2;
      }
      return 0;
    },
  },
};

const COLA_LARGO: Record<1 | 2 | 3, number> = { 1: 10, 2: 17, 3: 25 };
const PAD = 4;

/** El color de un píxel de la cometa (con la luz de arriba a la izquierda). */
function pixelDe(f: Forma, kind: number, u: number, v: number, c1: RGBA, c2: RGBA): RGBA | null {
  if (!kind) return null;
  if (kind === 3) return at(GUADUA, 2 + ((u + v) % 2));
  if (kind === 4) return hex("#2b1b17");
  const base = kind === 1 ? c1 : c2;
  const luz = (f.w - u + (f.h - v)) / (f.w + f.h);
  return luz > 0.72 ? aclarar(base, 0.18) : luz < 0.3 ? oscurecer(base, 0.18) : base;
}

/**
 * La cometa en el cielo: el papel con sus palitos y la cola de trapitos que se mece (`frame`). El origen del
 * sprite es el frenillo, donde llega el hilo. Sirve para las de la gente y las de los NPC.
 */
export function cometaCielo(code: string, frame = 0): Sprite {
  const p = cometaPartes(code) ?? { forma: "rombo" as const, color1: "r" as const, color2: "a" as const, cola: 2 as const };
  const f = FORMAS[p.forma];
  const c1 = papel(p.color1);
  const c2 = papel(p.color2);
  const largo = COLA_LARGO[p.cola];
  const canvas = new PixelCanvas(f.w + PAD * 2 + 6, f.h + largo + PAD * 2);
  const kite = new PixelCanvas(canvas.width, canvas.height);
  for (let v = 0; v < f.h; v++) for (let u = 0; u < f.w; u++) {
    const c = pixelDe(f, f.pinta(u, v), u, v, c1, c2);
    if (c) kite.set(u + PAD + 3, v + PAD, c);
  }
  kite.outline(OUT);
  // La cola: la cabuya que cuelga meciéndose y un trapito cada cuatro puntos, de los dos colores.
  const fase = (frame / COMETA_FRAMES) * Math.PI * 2;
  const ax = f.cola[0] + PAD + 3;
  const ay = f.cola[1] + PAD + 1;
  for (let i = 0; i < largo; i++) {
    const x = ax + Math.sin(i * 0.38 - fase) * Math.min(3, i * 0.22);
    const y = ay + i;
    canvas.set(x, y, CABUYA_OSCURA);
    if (i % 4 === 2) {
      const c = (i >> 2) % 2 ? c1 : c2;
      canvas.set(x - 1, y, c);
      canvas.set(x + 1, y, c);
      canvas.set(x - 2, y - 1, oscurecer(c, 0.2));
      canvas.set(x + 2, y + 1, oscurecer(c, 0.2));
    }
  }
  for (let i = 0; i < kite.data.length; i += 4) if (kite.data[i + 3]) canvas.set((i / 4) % kite.width, Math.floor(i / 4 / kite.width), [kite.data[i]!, kite.data[i + 1]!, kite.data[i + 2]!, kite.data[i + 3]!]);
  return { canvas, ox: f.centro[0] + PAD + 3, oy: f.centro[1] + PAD };
}

/** La cometa puesta de pie sobre un plano (mirando a +y) en una escena: `k` = tamaño de cada punto. */
function cometaEnPlano(s: Escena, code: string, x: number, y: number, z: number, k = 0.5, cola = true) {
  const p = cometaPartes(code)!;
  const f = FORMAS[p.forma];
  const c1 = papel(p.color1);
  const c2 = papel(p.color2);
  for (let v = 0; v < f.h; v += 0.5)
    for (let u = 0; u < f.w; u += 0.5) {
      const c = pixelDe(f, f.pinta(Math.round(u), Math.round(v)), Math.round(u), Math.round(v), c1, c2);
      if (c) s.plot(x + (u - f.centro[0]) * k, y, z - (v - f.centro[1]) * k, c);
    }
  if (!cola) return;
  const largo = COLA_LARGO[p.cola] * k;
  for (let i = 0; i < largo; i += 0.4) {
    const xx = x + (f.cola[0] - f.centro[0]) * k + Math.sin(i * 0.7) * Math.min(1.6, i * 0.2);
    const zz = z - (f.cola[1] - f.centro[1]) * k - i;
    s.plot(xx, y, zz, CABUYA_OSCURA);
    if (Math.round(i / 0.4) % 5 === 2) for (const d of [-0.6, 0.6]) s.plot(xx + d, y, zz, Math.round(i) % 2 ? c1 : c2);
  }
}

/** La cometa acostada (sobre una mesa): el plano horizontal a la altura z. */
function cometaAcostada(s: Escena, code: string, x: number, y: number, z: number, k = 0.5) {
  const p = cometaPartes(code)!;
  const f = FORMAS[p.forma];
  const c1 = papel(p.color1);
  const c2 = papel(p.color2);
  for (let v = 0; v < f.h; v += 0.5)
    for (let u = 0; u < f.w; u += 0.5) {
      const c = pixelDe(f, f.pinta(Math.round(u), Math.round(v)), Math.round(u), Math.round(v), c1, c2);
      if (c) s.plot(x + (u - f.centro[0]) * k, y + (v - f.centro[1]) * k, z, c);
    }
}

// ---------- La mesa del taller ----------

function tallerCometas(): Sprite {
  const s = scene(2, 1, 34);
  s.shadow(2, 4, 28, 10, 0.24);
  for (const [x, y] of [[3, 5], [28, 5], [3, 12], [28, 12]] as const) s.solid(x, y, 0, 1.4, 1.4, 11, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
  s.box(2, 4, 11, 28, 10, 1.6, (u, v) => at(WOOD, 4 - (Math.floor(v / 2.5) % 2) * 0.5 - (noise(Math.floor(u / 2), Math.floor(v), 1) < 0.12 ? 1 : 0)), flatT(at(WOOD, 2)), flatT(at(WOOD, 2)));
  // Los pliegos de papel de seda, de varios colores, uno encima del otro.
  (["r", "a", "z", "v", "s"] as const).forEach((l, i) => s.box(4 + i * 0.4, 5 + i * 0.3, 12.6 + i * 0.35, 8, 6, 0.35, flatT(papel(l)), flatT(oscurecer(papel(l), 0.2)), flatT(oscurecer(papel(l), 0.3))));
  // La cometa a medio armar, acostada: la cruz de guadua y el papel a medio pegar.
  cometaAcostada(s, "rzn2", 18, 8.5, 12.7, 0.55);
  // Los palitos de guadua sueltos y el tarro del engrudo.
  for (let k = 0; k < 4; k++) s.solid(12.6, 11 + k * 0.8, 12.7, 9, 0.5, 0.5, at(GUADUA, 3), at(GUADUA, 2), at(GUADUA, 1));
  s.cylinder(27, 7, 12.6, 1.6, 3, (_a, _v, luz) => at(C.cream, 3 + luz));
  s.disc(27, 7, 15.6, 1.6, () => at(C.cream, 5));
  // Un carrete de cabuya.
  s.cylinder(26.5, 11.6, 12.6, 1.4, 2.4, (_a, v) => (v < 0.4 || v > 2 ? at(WOOD, 2) : Math.floor(v * 3) % 2 ? CABUYA : CABUYA_OSCURA));
  return s.sprite();
}

// ---------- El puesto de cometas ----------

const TOLDO = { a: ramp("#1f4a8a", "#2f63a8", "#3a8ad0", "#6aaee6"), b: ramp("#b8963a", "#e0c04a", "#f2d65a", "#fff0a0") };
/** Las cometas que cuelgan del puesto, del tablero y las de adorno (códigos de cometa.ts). */
const COLGADAS = ["rra2", "hzb1", "pva2", "zmn3"] as const;

function puestoCometas(): Sprite {
  const s = scene(2, 1, 52);
  s.shadow(1, 1, 30, 15, 0.22);
  for (const [x, y, h] of [[2, 2, 38], [29, 2, 38], [2, 14, 33], [29, 14, 33]] as const) s.solid(x, y, 0, 1.4, 1.4, h, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.box(3, 8, 0, 26, 6, 12, flatT(at(WOOD, 4)), (u, v) => at(WOOD, 3 - (Math.floor(u / 2.6) % 2) * 0.7 - (v > 10.5 ? -1 : 0)), flatT(at(WOOD, 1)));
  // Los carretes de cabuya sobre el mostrador y un rollo de papel.
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 4.2;
    s.cylinder(x, 11, 12, 1.5, 2.6, (_a, v) => (v < 0.4 || v > 2.2 ? at(WOOD, 2) : Math.floor(v * 3) % 2 ? CABUYA : CABUYA_OSCURA));
    s.disc(x, 11, 14.6, 1.5, () => at(WOOD, 3));
  }
  s.box(22, 9.5, 12, 5, 3, 1.4, flatT(papel("s")), flatT(papel("a")), flatT(papel("z")));
  // El travesaño de adelante con las cometas colgadas.
  s.box(2, 14.2, 28, 28.4, 1, 1.2, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), null);
  COLGADAS.forEach((code, i) => {
    const x = 6 + i * 7;
    for (let z = 24.5; z < 28; z += 0.4) s.plot(x, 14.8, z, CABUYA_OSCURA);
    cometaEnPlano(s, code, x, 15, 21, 0.42, false);
  });
  // El toldo a rayas azules y amarillas.
  s.quad([1, 1, 39.4], [1, 0, 0], [0, 1, -0.38], 30.4, 15.4, (u) => at(Math.floor(u / 3.8) % 2 ? TOLDO.b : TOLDO.a, 2));
  for (let x = 1; x < 31.4; x += 0.4) {
    const drop = 1.2 + Math.abs(Math.sin((x / 3.8) * Math.PI)) * 1.4;
    for (let z = 0; z < drop; z += 0.4) s.plot(x, 16.4, 33.6 - z, at(Math.floor((x - 1) / 3.8) % 2 ? TOLDO.b : TOLDO.a, 1));
  }
  return s.sprite();
}

// ---------- El carrito del raspao ----------

function carritoRaspao(): Sprite {
  const s = scene(1, 1, 48, 8);
  s.roundShadow(8, 9, 7, 0.24);
  // Las dos ruedas y la caja del carrito, pintada de verde con su franja.
  for (const y of [3, 13]) for (let a = 0; a < Math.PI * 2; a += 0.08) s.plot(13.5, y + Math.cos(a) * 3, 3 + Math.sin(a) * 3, at(C.woodDark, 2));
  s.box(2, 3, 3, 11, 10, 11, flatT(at(C.cream, 4)), (u, v) => (v > 4 && v < 6 ? papel("r") : at(C.green, 3)), (u, v) => (v > 4 && v < 6 ? papel("r") : at(C.green, 2)));
  // El bloque de hielo y las botellas del melao (mora, mango, maracuyá).
  s.box(3.5, 4.5, 14, 4, 4, 3.4, flatT(hex("#e8f4fa")), flatT(hex("#b8d8ea")), flatT(hex("#a0c8de")));
  ["#7a1f4a", "#f2a23a", "#e8c83a"].forEach((col, i) => {
    s.cylinder(9.5 + (i % 2) * 1.5, 6 + i * 2.3, 14, 0.9, 4.6, (_a, v, luz) => (v > 3.8 ? at(C.white, 3) : mix(hex(col), hex("#ffffff"), Math.max(0, luz) * 0.25)));
  });
  // La sombrilla a gajos en su palo.
  s.solid(7.4, 7.4, 14, 1, 1, 22, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.cone(8, 8, 33, 11, 7, (a, _s, luz) => {
    const gajo = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2;
    const c = gajo ? hex("#f4f0e4") : papel("n");
    return luz > 0.5 ? aclarar(c, 0.1) : luz < 0 ? oscurecer(c, 0.15) : c;
  });
  return s.sprite();
}

// ---------- El tablero del concurso ----------

function tableroCometas(): Sprite {
  const s = scene(1, 1, 40);
  s.roundShadow(8, 9, 6, 0.24);
  for (const x of [2, 13]) s.solid(x, 8, 0, 1.4, 1.4, 30, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // El tablero de corcho con su marco.
  s.box(1.4, 9.4, 12, 13.2, 1, 17, null, (u, v) => (u < 1 || u > 12.2 || v < 1 || v > 16 ? at(WOOD, 3) : at(C.cork, 3 - (noise(Math.floor(u), Math.floor(v), 7) < 0.2 ? 1 : 0))), null);
  // Tres cometas chiquitas pinchadas y la cinta azul del premio.
  cometaEnPlano(s, COLGADAS[0], 5, 10.6, 25, 0.28, false);
  cometaEnPlano(s, COLGADAS[1], 11, 10.6, 25, 0.28, false);
  cometaEnPlano(s, COLGADAS[2], 8, 10.6, 18, 0.28, false);
  for (let a = 0; a < Math.PI * 2; a += 0.2) for (let r = 0; r < 1.4; r += 0.4) s.plot(12 + Math.cos(a) * r, 10.7, 16 + Math.sin(a) * r, papel("z"));
  for (let z = 12.6; z < 15; z += 0.4) s.plot(11.6, 10.7, z, papel("z")), s.plot(12.4, 10.7, z - 0.4, papel("z"));
  // El copete: una tablilla de colores arriba.
  s.box(1, 9.2, 29, 14, 1.4, 2.4, flatT(at(WOOD, 4)), (u) => papel((["r", "a", "z", "v", "s", "n"] as const)[Math.floor(u / 2.4) % 6]!), flatT(at(WOOD, 2)));
  return s.sprite();
}

// ---------- La manga de viento ----------

/**
 * La manga de viento en su poste: la manga a rayas naranja y blanco sale hacia `dir` (0 = +x, 1 = +y,
 * 2 = -x, 3 = -y) y se estira según el viento (`nivel` 0 = caída, 1 = a media asta, 2 = estirada); `frame`
 * la hace ondear. Todas las variantes tienen el mismo lienzo y el mismo origen (la escena las cambia).
 */
export function mangaViento(dir = 0, nivel = 1, frame = 0): Sprite {
  const s = new Escena({ x0: -14, y0: -14, z0: -4, x1: 30, y1: 30, z1: 56 }, 2);
  s.roundShadow(8, 8.5, 2.6, 0.26);
  s.solid(7.3, 7.3, 0, 1.4, 1.4, 44, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // El aro de alambre arriba.
  const ux = [1, 0, -1, 0][dir]!;
  const uy = [0, 1, 0, -1][dir]!;
  const caida = [1.4, 0.55, 0.08][nivel]!;
  const largo = [7, 11, 13][nivel]!;
  for (let t = 0; t <= largo; t += 0.3) {
    const r = 2.4 - (t / largo) * 1.3;
    const onda = Math.sin(t * 0.9 - frame * Math.PI) * (nivel === 2 ? 0.3 : 0.6);
    const cx = 8 + ux * t * (1 - caida * 0.35) - uy * onda;
    const cy = 8 + uy * t * (1 - caida * 0.35) + ux * onda;
    const cz = 42 - t * caida;
    const raya = Math.floor(t / 2.2) % 2;
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const luz = nz * 0.6 - nx * 0.2;
      const base = raya ? hex("#f4f0e4") : hex("#ee6a2a");
      s.plot(cx + (uy ? nx * r : 0), cy + (ux ? nx * r : 0), cz + nz * r, luz > 0.3 ? aclarar(base, 0.12) : luz < -0.3 ? oscurecer(base, 0.2) : base);
    }
  }
  return s.sprite();
}

// ---------- Banderines ----------

function banderines(): Sprite {
  const s = scene(1, 1, 50, 14);
  s.roundShadow(8, 8.5, 3, 0.26);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 44, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Un cometín de adorno en la punta.
  cometaEnPlano(s, "rva1", 8, 8.4, 48, 0.3, false);
  const colores = ["r", "a", "z", "v", "s", "n", "m"] as const;
  for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    const L = 12;
    for (let t = 0; t <= 1; t += 0.02) {
      const x = 8 + ax * L * t;
      const y = 8 + ay * L * t;
      const z = 43 - t * 14 - Math.sin(t * Math.PI) * 3;
      s.plot(x, y, z, CABUYA);
      if (Math.round(t * 50) % 6 === 3) for (let d = 0; d < 2.6; d += 0.4) for (let w = -1 + d * 0.38; w <= 1 - d * 0.38; w += 0.4) s.plot(x - ay * w, y + ax * w, z - d - 0.3, papel(colores[Math.round(t * 50 + ax * 3 + ay * 5 + 7) % colores.length]!));
    }
  }
  return s.sprite();
}

// ---------- Las cometas amarradas ----------

/** Una estaca en el pasto con su cometa volando bajito, el hilo templado en diagonal. */
function cometaAmarrada(code: string, lado: 1 | -1): () => Sprite {
  return () => {
    const s = new Escena({ x0: -28, y0: -6, z0: -4, x1: 44, y1: 22, z1: 80 }, 2);
    s.roundShadow(8, 8.5, 2, 0.24);
    s.solid(7.3, 7.3, 0, 1.4, 1.4, 6, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
    const kx = 8 + lado * 18;
    const kz = 62;
    for (let t = 0; t <= 1; t += 0.004) s.plot(8 + (kx - 8) * t, 8, 5 + (kz - 5) * t - Math.sin(t * Math.PI) * 6, CABUYA);
    cometaEnPlano(s, code, kx, 8, kz, 0.9);
    return s.sprite();
  };
}

// ---------- El mantel del picnic ----------

/** El mantel de cuadros rojos y blancos (plano), con la canasta, los platos y la jarra de limonada. */
function mantelPicnic(): Sprite {
  const s = scene(3, 2, 14);
  s.quad([1, 1, 0.2], [1, 0, 0], [0, 1, 0], 46, 30, (u, v) => ((Math.floor(u / 4) + Math.floor(v / 4)) % 2 ? hex("#f4ece0") : hex("#c8383a")));
  // La canasta de mimbre en el medio de atrás.
  s.box(19, 3, 0.2, 10, 7, 6, (u, v) => at(C.cork, 3 + ((Math.floor(u) + Math.floor(v)) % 2)), (u, v) => at(C.cork, 2 + ((Math.floor(u) + Math.floor(v * 1.5)) % 2)), (u, v) => at(C.cork, 1 + ((Math.floor(u) + Math.floor(v * 1.5)) % 2)));
  for (let a = 0; a <= Math.PI; a += 0.08) s.plot(19.5 + 9 * (a / Math.PI), 6.5, 6.4 + Math.sin(a) * 4, at(C.cork, 2));
  // Los platos y la jarra.
  for (const [x, y] of [[10, 12], [36, 12], [24, 24]] as const) s.disc(x, y, 0.4, 2.6, (dx, dy) => (dx * dx + dy * dy > 4 ? at(C.white, 2) : at(C.white, 4)));
  s.cylinder(31, 6, 0.3, 1.6, 4.4, (_a, v, luz) => (v > 3.4 ? aclarar(hex("#e8f0a0"), 0.3) : mix(hex("#d8e87a"), hex("#ffffff"), Math.max(0, luz) * 0.4)));
  return s.sprite();
}

// ---------- El árbol con la cometa y la escalera del garaje ----------

/** Copia un sprite y pinta encima, con el mismo origen. */
function encima(base: Sprite, pintar: (c: PixelCanvas, ox: number, oy: number) => void): Sprite {
  const canvas = new PixelCanvas(base.canvas.width + 16, base.canvas.height + 8);
  for (let i = 0; i < base.canvas.data.length; i += 4) {
    const a = base.canvas.data[i + 3]!;
    if (a) canvas.set(((i / 4) % base.canvas.width) + 8, Math.floor(i / 4 / base.canvas.width) + 8, [base.canvas.data[i]!, base.canvas.data[i + 1]!, base.canvas.data[i + 2]!, a]);
  }
  const ox = base.ox + 8;
  const oy = base.oy + 8;
  pintar(canvas, ox, oy);
  return { canvas, ox, oy };
}

/** La cometa del árbol de Mateo y la de Santiago, que quedó en el techo del garaje. */
const COMETA_MATEO = COMETAS_GENTE.mateo;
const COMETA_SANTIAGO = COMETAS_GENTE.santiago;

/** Pega una cometa (de frente) en un lienzo, inclinada un poquito, con su origen en (x, y). */
function pegarCometa(c: PixelCanvas, code: string, x: number, y: number) {
  const k = cometaCielo(code, 1);
  for (let i = 0; i < k.canvas.data.length; i += 4) {
    const a = k.canvas.data[i + 3]!;
    if (!a) continue;
    const u = (i / 4) % k.canvas.width;
    const v = Math.floor(i / 4 / k.canvas.width);
    c.set(x + u - k.ox + Math.floor((v - k.oy) * 0.25), y + v - k.oy, [k.canvas.data[i]!, k.canvas.data[i + 1]!, k.canvas.data[i + 2]!, a]);
  }
}

/** El roble con (o sin) la cometa de Mateo enredada en la copa. */
export function arbolCometa(conCometa = true): Sprite {
  const base = NATURE_DRAW["oak-1"]!();
  return encima(base, (c, ox, oy) => {
    if (!conCometa) return;
    pegarCometa(c, COMETA_MATEO, ox + 5, oy - 34);
    // El pedazo de cabuya que cuelga hasta abajo.
    for (let y = oy - 22; y < oy - 6; y++) c.set(ox + 7 + Math.round(Math.sin(y * 0.4)), y, CABUYA_OSCURA);
  });
}

/** La escalera de madera recostada al alero del garaje, con (o sin) la cometa de Santiago arriba. */
export function escaleraGaraje(conCometa = true): Sprite {
  const s = new Escena({ x0: -6, y0: -10, z0: -4, x1: 22, y1: 22, z1: 64 }, 2);
  s.shadow(5, 4, 6, 10, 0.2);
  // Los dos largueros, del pie (adelante) al alero (atrás y arriba), y los peldaños.
  const pie = { y: 13, z: 0 };
  const tope = { y: -4, z: 48 };
  for (const x of [5, 10]) for (let t = 0; t <= 1; t += 0.006) s.plot(x, pie.y + (tope.y - pie.y) * t, pie.z + (tope.z - pie.z) * t, at(WOOD, 2 + (x === 5 ? 1 : 0)));
  for (let k = 1; k < 10; k++) {
    const t = k / 10;
    for (let x = 5; x <= 10; x += 0.3) s.plot(x, pie.y + (tope.y - pie.y) * t, pie.z + (tope.z - pie.z) * t, at(WOOD, 4));
  }
  if (conCometa) cometaEnPlano(s, COMETA_SANTIAGO, 9, -5, 56, 0.75);
  return s.sprite();
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const COMETAS_DRAW: Record<string, () => Sprite> = {
  "taller-cometas": tallerCometas,
  "puesto-cometas": puestoCometas,
  "carrito-raspao": carritoRaspao,
  "tablero-cometas": tableroCometas,
  "manga-viento": () => mangaViento(0, 1, 0),
  "banderines-cometas": banderines,
  "cometa-amarrada": cometaAmarrada("hzb1", 1),
  "cometa-amarrada-2": cometaAmarrada("pva2", -1),
  "cometa-amarrada-3": cometaAmarrada("zmn3", 1),
  "mantel-picnic": mantelPicnic,
  "arbol-cometa": () => arbolCometa(true),
  "escalera-garaje": () => escaleraGaraje(true),
};
