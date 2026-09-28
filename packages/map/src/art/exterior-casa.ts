// La casa grande de troncos del jardín (22x14 tiles = 352x224 unidades de arte). Se ve la fachada +y
// (el frente, a la izquierda en pantalla) y el costado +x (el este, a la derecha). Volúmenes:
//  - cuerpo principal de dos pisos y el tercero bajo un techo empinado con lucarnas;
//  - un frontón cruzado sobre la entrada, con el porche y su techito;
//  - la torre redonda con el mirador en la esquina oeste (a la izquierda en pantalla);
//  - el ala este, más baja, con la terraza cubierta (su techo es el balcón del piso 2), la escalera
//    exterior que sube a ese balcón y un cantero con un rosal trepador.
import { Escena, type Tinte } from "./exterior-escena";
import { C, OUT, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type RGBA, type Sprite } from "./pixel";

// ---------- Medidas (unidades de arte) ----------

/** Cuerpo principal. */
const A = { x0: 96, x1: 256, y0: 40, y1: 184, h: 92 };
const A_RIDGE_Y = 112;
const A_SLOPE = 0.9;
const A_RIDGE_Z = A.h + (A.y1 - A_RIDGE_Y) * A_SLOPE;
const A_EAVE = 12;
const roofA = (y: number) => A_RIDGE_Z - Math.abs(y - A_RIDGE_Y) * A_SLOPE;

/** Frontón de la entrada (sobresale del cuerpo principal). */
const B = { x0: 140, x1: 220, y0: 150, y1: 206, h: 92 };
const B_RIDGE_X = 180;
const B_SLOPE = 0.85;
const B_RIDGE_Z = B.h + (B_RIDGE_X - B.x0) * B_SLOPE;
const roofB = (x: number) => B_RIDGE_Z - Math.abs(x - B_RIDGE_X) * B_SLOPE;

/** Torre redonda con mirador. */
const T = { cx: 58, cy: 168, r: 38, wall: 150, deck: 122 };
const T_ROOF = { r: 50, h: 64 };

/** Ala este (un piso) con techo a dos aguas más bajo. */
const E = { x0: 256, x1: 326, y0: 62, y1: 150, h: 52 };
const E_RIDGE_Y = 106;
const E_SLOPE = 0.72;
const E_RIDGE_Z = E.h + (E.y1 - E_RIDGE_Y) * E_SLOPE;
const roofE = (y: number) => E_RIDGE_Z - Math.abs(y - E_RIDGE_Y) * E_SLOPE;

/** Terraza cubierta delante del ala este; su techo plano es el balcón del piso 2. */
const TR = { x0: 256, x1: 336, y0: 150, y1: 210, z: 50 };
/** Escalera exterior al balcón, pegada al costado este de la terraza. */
const ST = { x0: 337, x1: 350, yTop: 156, yBottom: 218 };
/** Cantero al este del ala (donde termina la casa). */
const PG = { x0: 332, x1: 350, y0: 62, y1: 146, h: 64 };

/** Porche de la entrada. */
const P = { x0: 132, x1: 228, y0: 206, y1: 240, h: 6 };
/** Techito del porche: corto y alto, para que se vea la puerta desde arriba. */
const P_ROOF = { eave: 52, slope: 0.42, x0: 128, x1: 232, y0: 200, y1: 232 };
const P_POST_Y = 224;

const CHIMNEY = { x: 116, y: 62, w: 20, top: 184 };

/** Tope de la chimenea (para el humo que anima el cliente). */
export const HOUSE_CHIMNEY_TOP = { x: CHIMNEY.x + CHIMNEY.w / 2, y: CHIMNEY.y + CHIMNEY.w / 2, z: CHIMNEY.top + 4 };

// ---------- Texturas ----------

const STONE_H = 14;

/** Piedras de río irregulares, con juntas de mortero. */
function stones(u: number, v: number, seed: number, dark = 0): RGBA {
  const row = Math.floor(v / 5);
  const off = noise(row, 3, seed) * 9;
  const col = Math.floor((u + off) / 9);
  const k = (u + off) % 9;
  const kv = v % 5;
  if (kv < 0.9 || k < 0.9) return at(C.stone, 1 - dark);
  const n = noise(col, row, seed);
  if (kv > 3.9 && k > 1.5) return at(C.stone, 2 - dark);
  if (kv < 1.9 && k < 4) return at(C.stone, 4 - dark + (n > 0.7 ? 1 : 0));
  return at(C.stone, 3 - dark + (n < 0.25 ? -1 : 0));
}

/**
 * Pared de troncos horizontales sobre basa de piedra: cada tronco con su brillo arriba, sombra abajo y
 * junta oscura; vetas y nudos sueltos. `luz` = 0 (cara al frente, iluminada) o -1 (costado en sombra).
 */
function logWall(u: number, v: number, seed: number, luz = 0): RGBA {
  if (v < STONE_H) return stones(u, v, seed, luz < 0 ? 1 : 0);
  if (v < STONE_H + 2) return at(C.woodDark, luz < 0 ? 1 : 2);
  const w = v - STONE_H - 2;
  const log = Math.floor(w / 7);
  const k = w - log * 7;
  const tone = noise(log, Math.floor(u / 36 + noise(log, 1, seed) * 3), seed) < 0.45 ? 0 : 1;
  const b = 3 + tone + luz;
  if (k < 1) return at(C.logs, 0);
  if (k < 2) return at(C.logs, b + 1);
  if (k >= 6) return at(C.logs, Math.max(0, b - 2));
  if (k >= 5) return at(C.logs, b - 1);
  // Vetas: rayitas horizontales más oscuras.
  if (noise(Math.floor(u / 5), log * 7 + Math.floor(k), seed + 2) < 0.08) return at(C.logs, b - 1);
  if (noise(Math.floor(u / 2), log, seed + 5) < 0.012 && k >= 2 && k < 5) return at(C.logs, 1);
  return at(C.logs, b);
}

/** Viga entre pisos (madera oscura). */
const beam = (v: number, at0: number, luz = 0) => v >= at0 && v < at0 + 4 && at(C.woodDark, v >= at0 + 3 ? 4 + luz : 2 + luz);

/** Tejas rojas: hileras escalonadas, borde inferior con luz, alguna teja distinta y manchas de musgo. */
function tejas(u: number, t: number, luz: number, seed: number): RGBA {
  const row = Math.floor(t / 5);
  const k = t - row * 5;
  const off = row % 2 ? 4 : 0;
  const col = Math.floor((u + off) / 8);
  const n = noise(col, row, seed);
  const b = 3 + luz;
  let c: RGBA;
  if (k < 1) c = at(C.roof, b - 2);
  else if ((u + off) % 8 < 0.9) c = at(C.roof, b - 1);
  else if (k >= 4) c = at(C.roof, b + 1);
  else c = at(C.roof, b + (n < 0.14 ? -1 : n > 0.9 ? 1 : 0));
  // Musgo: algunas tejas enteras verdosas, en manchones.
  const moss = smoothNoise(u, t, 22, seed + 9);
  if (moss > 0.78 && k >= 1 && noise(col, row, seed + 3) < (moss - 0.78) * 5) c = mix(c, at(C.sage, k >= 4 ? 3 : 2), 0.55);
  return c;
}

/** Faldón trasero (casi de canto): hileras sin la sombra fuerte, para que no se vea una franja negra. */
function tejasAtras(u: number, t: number, seed: number): RGBA {
  const row = Math.floor(t / 5);
  const off = row % 2 ? 4 : 0;
  const n = noise(Math.floor((u + off) / 8), row, seed);
  return at(C.roof, t % 5 < 1 ? 1 : n < 0.2 ? 1 : 2);
}

/** Tejuelas de madera en escama (para los hastiales). */
function escamas(u: number, v: number, luz: number): RGBA {
  const row = Math.floor(v / 4);
  const off = row % 2 ? 3 : 0;
  const cu = ((u + off) % 6) - 3;
  const kv = v - row * 4;
  // Borde redondeado abajo de cada escama.
  if (kv < 1.2 - Math.abs(cu) * 0.35 + 0.8 || Math.abs(cu) > 2.6) return at(C.wood, 1 + luz);
  return at(C.wood, (kv > 3 ? 4 : 3) + luz);
}

// ---------- Ventanas ----------

type Kind = "ventana" | "puerta" | "balcon" | "arco";
interface Win {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  kind: Kind;
  /** Postigos verdes a los lados. */
  shutters?: boolean;
}

const WALLPAPER_IN = [C.cream, C.rose, C.sage];

/** Vidrio: de día refleja el cielo con destellos; de noche, luz cálida y la silueta de las cortinas. */
function glass(u: number, v: number, w: Win, night: boolean): RGBA {
  const t = (v - w.v0) / (w.v1 - w.v0);
  const e = Math.min(u - w.u0, w.u1 - u);
  if (night) {
    if (e < 3 + t * 2) return mix(at(C.curtain, 3), at(C.gold, 4), 0.35);
    return at(C.gold, t > 0.7 ? 5 : t > 0.3 ? 4 : 3);
  }
  if (e < 2.5 + t * 1.5) return at(C.curtain, Math.floor(u) % 2 ? 2 : 3);
  const d = u - w.u0 - (w.v1 - v) * 0.8;
  if (Math.abs(d - 5) < 0.9 || Math.abs(d - 8.5) < 0.5) return at(C.sky, 4);
  // Adentro se adivina el papel mural (de día el vidrio es oscuro abajo).
  if (t < 0.25) return mix(at(WALLPAPER_IN[Math.floor(w.u0) % 3]!, 1), at(C.sky, 1), 0.5);
  return at(C.sky, t > 0.6 ? 3 : 2);
}

/** Color de una ventana o puerta en la pared (o null si (u, v) no cae en ella). */
function windowAt(u: number, v: number, w: Win, night: boolean): RGBA | null {
  const { u0, u1, v0, v1, kind } = w;
  const mid = (u0 + u1) / 2;
  const arch = kind === "arco" || kind === "puerta";
  const top = (uu: number) => (arch ? v1 + Math.sqrt(Math.max(0, 1 - ((uu - mid) / ((u1 - u0) / 2)) ** 2)) * 5 : v1);
  // Dintel.
  if (!arch && inR(u, v, u0 - 3, v1, u1 + 3, v1 + 3)) return at(C.woodDark, v >= v1 + 2 ? 4 : 2);
  if (arch && u >= u0 - 2 && u < u1 + 2 && v >= top(Math.min(Math.max(u, u0), u1)) && v < top(Math.min(Math.max(u, u0), u1)) + 2.5)
    return at(C.stone, v - top(u) > 1.5 ? 4 : 2);
  // Alféizar.
  if (kind !== "puerta" && kind !== "balcon" && inR(u, v, u0 - 3, v0 - 2, u1 + 3, v0)) return at(C.cream, v >= v0 - 1 ? 5 : 2);
  // Postigos con tablas y travesaño.
  if (w.shutters) {
    const sw = Math.min(7, (u1 - u0) / 2);
    const L = inR(u, v, u0 - 1 - sw, v0, u0 - 1, v1);
    const R = inR(u, v, u1 + 1, v0, u1 + 1 + sw, v1);
    if (L || R) {
      const rel = L ? u - (u0 - 1 - sw) : u - (u1 + 1);
      if (rel < 0.8 || rel > sw - 0.8 || Math.floor(v) === v0 || Math.floor(v) === Math.floor(v1) - 1) return at(C.green, 1);
      if (Math.abs(v - (v0 + v1) / 2) < 0.7) return at(C.green, 2);
      return at(C.green, Math.floor(rel) % 2 ? 3 : 4);
    }
  }
  if (u < u0 - 1 || u >= u1 + 1 || v < v0 || v >= top(Math.min(Math.max(u, u0), u1)) + 0.01) return null;
  // Marco oscuro y moldura crema.
  if (u < u0 || u >= u1) return at(C.woodDark, 1);
  const inner = 2;
  if (u < u0 + inner || u >= u1 - inner || v < v0 + inner || v >= top(u) - inner + 0.5) return at(C.cream, u < u0 + 1 || v >= top(u) - 1 ? 5 : 3);
  if (kind === "puerta") {
    // Puerta doble de tablas con ventanitas arriba y tiradores de bronce.
    const half = Math.abs(u - mid) < 0.8;
    if (half) return at(C.woodDark, 1);
    if (v > v0 + (v1 - v0) * 0.62 && Math.abs(u - mid) > 2.5 && Math.min(u - u0, u1 - u) > 4) return glass(u, v, w, night);
    if (inR(u, v, mid - 3.5, v0 + 16, mid - 1.5, v0 + 18) || inR(u, v, mid + 1.5, v0 + 16, mid + 3.5, v0 + 18)) return at(C.gold, 4);
    const plank = Math.floor((u - u0) / 4);
    if ((u - u0) % 4 < 0.8) return at(C.woodDark, 2);
    return at(C.wood, 1 + (plank % 2) + (v > v0 + 12 && v < v0 + 14 ? -1 : 0));
  }
  // Travesaños.
  if (Math.abs(u - mid) < 0.9) return at(C.cream, 3);
  const bars = kind === "balcon" ? [v0 + (v1 - v0) * 0.35, v0 + (v1 - v0) * 0.68] : [(v0 + v1) / 2];
  if (bars.some((b) => Math.abs(v - b) < 0.7)) return at(C.cream, 3);
  if (kind === "balcon" && v < v0 + 6) return at(C.woodDark, 2 + (Math.floor(u) % 3 === 0 ? 1 : 0));
  return glass(u, v, w, night);
}

const inR = (u: number, v: number, u0: number, v0: number, u1: number, v1: number) => u >= u0 && u < u1 && v >= v0 && v < v1;

/** Pared plana con ventanas: la primera ventana que cubra el punto gana; si no, la textura. */
function wall(wins: Win[], night: boolean, base: Tinte): Tinte {
  return (u, v) => {
    for (const w of wins) {
      const c = windowAt(u, v, w, night);
      if (c) return c;
    }
    return base(u, v);
  };
}

const FLOWERS: RGBA[] = [at(C.rug, 4), at(C.gold, 5), at(C.rose, 5), at(C.white, 4), at(C.blue, 4), at(C.neon, 4)];

/** Matorral de flores sobre una jardinera o un cantero: hojas en montoncitos y flores de colores. */
function flowers(s: Escena, x0: number, y0: number, x1: number, y1: number, z: number, seed: number, dense = 1) {
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) {
      const n = noise(Math.floor(x), Math.floor(y), seed);
      const hgt = 2 + smoothNoise(x, y, 4, seed) * 4;
      for (let k = 0; k < hgt; k += 0.5) s.plot(x, y, z + k, at(C.leaf, k > hgt - 1.5 ? 4 : k > hgt / 2 ? 3 : 2));
      if (n < 0.28 * dense) {
        const col = FLOWERS[Math.floor(noise(Math.floor(x), Math.floor(y), seed + 1) * FLOWERS.length)]!;
        s.plot(x, y, z + hgt + 0.5, col);
        s.plot(x + 0.5, y, z + hgt, col);
        s.plot(x, y + 0.5, z + hgt, col);
        s.plot(x, y, z + hgt + 1.2, mix(col, at(C.white, 4), 0.4));
      }
    }
}

/** Jardinera colgada bajo una ventana o en una baranda, llena de flores. */
function planter(s: Escena, x0: number, y0: number, w: number, d: number, z: number, seed: number) {
  const side: Tinte = (u, v) => at(C.wood, v > 3.5 ? 4 : Math.floor(u) % 6 === 0 ? 1 : 2);
  s.box(x0, y0, z, w, d, 5, (u, v) => at(C.dirt, 1 + (noise(u, v, 3) < 0.3 ? 1 : 0)), side, (u, v) => at(C.wood, v > 3.5 ? 3 : 1));
  flowers(s, x0 + 0.5, y0 + 0.5, x0 + w - 0.5, y0 + d - 0.5, z + 5, seed, 1.4);
  // Hiedra que cuelga por el frente.
  for (let x = x0; x < x0 + w; x += 1) {
    const len = noise(Math.floor(x), 2, seed) < 0.35 ? 3 + noise(Math.floor(x), 3, seed) * 7 : 0;
    for (let k = 0; k < len; k += 0.5) s.plot(x, y0 + d + 0.6, z + 4 - k, at(C.leaf, k > len - 1 ? 4 : 3));
  }
}

/** Farol de pared o de poste: caja de fierro con vidrios dorados (encendidos de noche). */
function lantern(s: Escena, x: number, y: number, z: number, night: boolean) {
  const glow = (u: number, v: number) => (u < 0.8 || u > 3.2 ? at(C.metal, 1) : at(C.gold, night ? 5 : v > 3 ? 4 : 3));
  s.box(x - 2, y - 2, z, 4, 4, 5, () => at(C.metal, 2), glow, (u, v) => (u < 0.8 || u > 3.2 ? at(C.metal, 0) : at(C.gold, night ? 4 : 3)));
  s.solid(x - 2.5, y - 2.5, z + 5, 5, 5, 1.2, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
  s.solid(x - 0.5, y - 0.5, z + 6, 1, 1, 1.5, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
}

/**
 * Puntas de troncos cruzados en una esquina (cada hilera sobresale y se ve la veta en la punta).
 * `dir` = hacia dónde sobresalen: +x (a la derecha) o +y (a la izquierda).
 */
function logEnds(s: Escena, x: number, y: number, z0: number, z1: number, dir: "x" | "y", seed: number) {
  for (let z = z0; z < z1 - 3; z += 7) {
    const len = 4 + noise(Math.floor(z), 1, seed) * 2;
    const ring = (u: number, v: number) => {
      const d = Math.hypot(u - 3, v - 3.2);
      return at(C.logs, d > 2.6 ? 1 : d > 1.6 ? 4 : d > 0.8 ? 3 : 2);
    };
    if (dir === "y") s.box(x - 3, y, z, 6, len, 6.5, (u) => at(C.logs, u < 1 ? 2 : 4), ring, (_u, v) => at(C.logs, v > 5 ? 2 : 1));
    else s.box(x, y - 3, z, len, 6, 6.5, (_u, v) => at(C.logs, v < 1 ? 2 : 4), (_u, v) => at(C.logs, v > 5 ? 3 : 2), ring);
  }
}

/** Baranda de madera: postes cada `step`, pasamanos y balaustres finos (sin contorno propio). */
function railing(s: Escena, from: [number, number], to: [number, number], z: number, h: number, step = 8) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dx = (to[0] - from[0]) / len;
  const dy = (to[1] - from[1]) / len;
  s.borde = false;
  for (let k = 1.5; k <= len; k += 3) {
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    for (let v = 1; v < h; v += 0.5) s.plot(x, y, z + v, at(C.wood, v < 2 ? 1 : 3));
  }
  // Travesaño bajo.
  for (let k = 0; k <= len; k += 0.4) s.plot(from[0] + dx * k, from[1] + dy * k, z + 1.5, at(C.wood, 2));
  s.borde = true;
  for (let k = 0; k <= len + 0.01; k += step) {
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    s.solid(x - 1, y - 1, z, 2, 2, h + 1, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  }
  // Pasamanos.
  for (let k = -1; k <= len + 1; k += 0.4) {
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    s.plot(x, y, z + h + 1, at(C.wood, 5));
    s.plot(x, y, z + h, at(C.wood, 4));
    s.plot(x + dy * 0.6, y - dx * 0.6, z + h + 1, at(C.wood, 4));
  }
}

// ---------- Techos ----------

/**
 * Techo a dos aguas con la cumbrera a lo largo de x (faldones hacia -y y +y), sus tapacanes y la
 * cumbrera. `zAt(y)` da la altura de la teja; el faldón +y está iluminado y el -y en sombra.
 */
function gableX(s: Escena, x0: number, x1: number, yBack: number, ridgeY: number, yFront: number, ridgeZ: number, slope: number, seed: number) {
  const k = Math.hypot(1, slope);
  s.quad([x0, ridgeY, ridgeZ], [1, 0, 0], [0, -1, -slope], x1 - x0, ridgeY - yBack, (u, v) => tejasAtras(u, v * k, seed));
  s.quad([x0, ridgeY, ridgeZ], [1, 0, 0], [0, 1, -slope], x1 - x0, yFront - ridgeY, (u, v) => tejas(u, v * k, 1, seed + 1));
  const zF = ridgeZ - (yFront - ridgeY) * slope;
  // Tapacán del alero frontal y de los dos bordes del hastial derecho.
  s.quad([x0, yFront, zF - 3], [1, 0, 0], [0, 0, 1], x1 - x0, 3, (_u, v) => at(C.woodDark, v > 2 ? 4 : 2));
  s.quad([x1, ridgeY, ridgeZ - 3], [0, 1, -slope], [0, 0, 1], yFront - ridgeY, 3.2, (_u, v) => at(C.woodDark, v > 2.2 ? 3 : 1));
  s.quad([x1, ridgeY, ridgeZ - 3], [0, -1, -slope], [0, 0, 1], ridgeY - yBack, 3.2, (_u, v) => at(C.woodDark, v > 2.2 ? 3 : 1));
  // Cumbrera: tejas redondeadas más claras.
  for (let x = x0 - 1; x < x1 + 1; x += 0.4) {
    s.plot(x, ridgeY, ridgeZ + 1.5, at(C.roof, Math.floor(x) % 6 === 0 ? 3 : 5));
    s.plot(x, ridgeY + 1, ridgeZ + 0.8, at(C.roof, 4));
    s.plot(x, ridgeY - 1, ridgeZ + 0.8, at(C.roof, 2));
  }
}

/** Techo a dos aguas con la cumbrera a lo largo de y (faldones hacia -x y +x) y el tapacán del frente. */
function gableY(s: Escena, xLeft: number, ridgeX: number, xRight: number, y0: number, y1: number, ridgeZ: number, slope: number, seed: number) {
  const k = Math.hypot(1, slope);
  s.quad([ridgeX, y0, ridgeZ], [0, 1, 0], [-1, 0, -slope], y1 - y0, ridgeX - xLeft, (u, v) => tejas(u, v * k, 0, seed));
  s.quad([ridgeX, y0, ridgeZ], [0, 1, 0], [1, 0, -slope], y1 - y0, xRight - ridgeX, (u, v) => tejas(u, v * k, -1, seed + 1));
  // Tapacanes del hastial del frente (y = y1) y del alero derecho.
  s.quad([ridgeX, y1, ridgeZ - 3], [-1, 0, -slope], [0, 0, 1], ridgeX - xLeft, 3.2, (_u, v) => at(C.woodDark, v > 2.2 ? 4 : 2));
  s.quad([ridgeX, y1, ridgeZ - 3], [1, 0, -slope], [0, 0, 1], xRight - ridgeX, 3.2, (_u, v) => at(C.woodDark, v > 2.2 ? 4 : 2));
  const zR = ridgeZ - (xRight - ridgeX) * slope;
  s.quad([xRight, y0, zR - 3], [0, 1, 0], [0, 0, 1], y1 - y0, 3, (_u, v) => at(C.woodDark, v > 2 ? 3 : 1));
  for (let y = y0; y < y1 + 1; y += 0.4) {
    s.plot(ridgeX, y, ridgeZ + 1.5, at(C.roof, Math.floor(y) % 6 === 0 ? 3 : 5));
    s.plot(ridgeX - 1, y, ridgeZ + 0.8, at(C.roof, 4));
    s.plot(ridgeX + 1, y, ridgeZ + 0.8, at(C.roof, 2));
  }
}

// ---------- La casa ----------

export function drawHouse(night: boolean): Sprite {
  const s = new Escena({ x0: -8, y0: -8, z0: -2, x1: 360, y1: 254, z1: 232 }, 6);

  // Sombras en el piso.
  s.shadow(A.x0 - 4, A.y0 - 2, A.x1 - A.x0 + 18, A.y1 - A.y0 + 20, 0.32);
  s.shadow(E.x0, E.y0 - 2, E.x1 - E.x0 + 16, TR.y1 - E.y0 + 8, 0.28);
  s.roundShadow(T.cx + 4, T.cy + 4, T.r + 6, 0.32);

  drawMainBody(s, night);
  drawChimney(s);
  drawDormers(s, night);
  drawFrontGable(s, night);
  drawPorch(s, night);
  drawBalconies(s, night);
  drawTower(s, night);
  drawEastWing(s, night);
  drawTerrace(s, night);
  drawStair(s);
  drawEastBed(s);
  drawGardenBeds(s);
  return s.sprite();
}

function drawMainBody(s: Escena, night: boolean) {
  const W = A.x1 - A.x0;
  // Frente (y = A.y1): planta baja y piso 2 a cada lado del frontón.
  const front: Win[] = [
    { u0: 14, u1: 34, v0: 20, v1: 40, kind: "ventana", shutters: true },
    { u0: 136, u1: 152, v0: 20, v1: 40, kind: "ventana", shutters: true },
    { u0: 16, u1: 32, v0: 51, v1: 84, kind: "balcon" },
    { u0: 136, u1: 150, v0: 51, v1: 84, kind: "balcon" },
  ];
  s.quad([A.x0, A.y1, 0], [1, 0, 0], [0, 0, 1], W, A.h, wall(front, night, (u, v) => beam(v, 46) || logWall(u, v, 3)));
  // Costado este (x = A.x1): lo que asoma sobre el ala, la puerta al balcón y el hastial.
  const side: Win[] = [
    { u0: 122, u1: 138, v0: 20, v1: 40, kind: "ventana" },
    { u0: 120, u1: 138, v0: 53, v1: 86, kind: "balcon" },
  ];
  s.quad([A.x1, A.y0, 0], [0, 1, 0], [0, 0, 1], A.y1 - A.y0, A.h, wall(side, night, (u, v) => beam(v, 46, -1) || logWall(u, v, 5, -1)));
  // Hastial este con escamas de madera y dos ventanas del piso 3.
  const gw: Win[] = [
    { u0: 50, u1: 66, v0: 12, v1: 30, kind: "ventana", shutters: true },
    { u0: 78, u1: 94, v0: 12, v1: 30, kind: "ventana", shutters: true },
  ];
  s.quad([A.x1, A.y0 - A_EAVE, A.h], [0, 1, 0], [0, 0, 1], A.y1 - A.y0 + A_EAVE * 2, A_RIDGE_Z - A.h, (u, v) => {
    const y = A.y0 - A_EAVE + u;
    if (A.h + v > roofA(y) - 0.5 || y < A.y0 || y > A.y1) return null;
    const c = windowAt(u - A_EAVE, v, gw[0]!, night) ?? windowAt(u - A_EAVE, v, gw[1]!, night);
    if (c) return c;
    if (v < 3) return at(C.woodDark, v < 1 ? 1 : 3);
    return escamas(u, v, -1);
  });
  gableX(s, A.x0 - 8, A.x1 + 8, A.y0 - A_EAVE, A_RIDGE_Y, A.y1 + A_EAVE, A_RIDGE_Z, A_SLOPE, 21);
  // Puntas de los troncos en la esquina de atrás.
  logEnds(s, A.x1, A.y0, STONE_H, A.h, "x", 4);
}

function drawChimney(s: Escena) {
  const { x, y, w, top } = CHIMNEY;
  // Piedras tibias (alguna rojiza) para que no se vea como un bloque gris.
  const face = (luz: number) => (u: number, v: number) => {
    const c = stones(u, v, 17, luz);
    const row = Math.floor(v / 5);
    return noise(Math.floor((u + noise(row, 3, 17) * 9) / 9), row, 23) < 0.22 ? mix(c, at(C.terracotta, 3 - luz), 0.45) : c;
  };
  // Tramo ancho abajo, un escalón con su cornisa y el tramo angosto hasta el remate.
  const mid = A_RIDGE_Z - 6;
  s.box(x - 2, y - 2, A.h - 20, w + 4, w + 4, mid - A.h + 20, null, face(0), face(1));
  s.box(x - 3, y - 3, mid, w + 6, w + 6, 2.5, () => at(C.stone, 4), () => at(C.stone, 3), () => at(C.stone, 2));
  s.box(x, y, mid + 2.5, w, w, top - mid - 2.5, null, face(0), face(1));
  // Remate: losa, la boca negra con hollín y dos cañones de barro.
  s.box(x - 2, y - 2, top, w + 4, w + 4, 3, (u, v) => (u > 3 && u < w + 1 && v > 3 && v < w + 1 ? (u < 5 || v < 5 ? at(C.stone, 1) : OUT) : at(C.stone, 4)), () => at(C.stone, 3), () => at(C.stone, 2));
  for (const [px, py] of [
    [x + 4, y + 5],
    [x + 11, y + 10],
  ] as const) {
    s.cylinder(px + 2.5, py + 2.5, top + 3, 2.5, 5, (_a, v, luz) => at(C.terracotta, v > 4 ? 4 : luz > 0.2 ? 3 : 2));
    s.disc(px + 2.5, py + 2.5, top + 8, 2.5, (dx, dy) => (Math.hypot(dx, dy) < 1.4 ? OUT : at(C.terracotta, 4)));
  }
}

function drawDormers(s: Escena, night: boolean) {
  for (const cx of [118, 238]) {
    const x0 = cx - 15;
    const x1 = cx + 15;
    const yF = 170;
    const top = 126;
    const w: Win = { u0: 8, u1: 22, v0: 5, v1: 20, kind: "ventana" };
    // Frente con ventana y costado derecho (triángulos que nacen del faldón).
    s.quad([x0, yF, roofA(yF) - 2], [1, 0, 0], [0, 0, 1], x1 - x0, top - roofA(yF) + 2, (u, v) => {
      const c = windowAt(u, v - 2, w, night);
      if (c) return c;
      return v < 2 ? at(C.woodDark, 2) : at(C.cream, Math.floor(u) % 5 === 0 ? 2 : 3);
    });
    s.quad([x1, 130, 100], [0, 1, 0], [0, 0, 1], yF - 130, top - 100, (u, v) => {
      if (100 + v < roofA(130 + u)) return null;
      return at(C.cream, Math.floor(v) % 4 === 0 ? 1 : 2);
    });
    gableY(s, x0 - 4, cx, x1 + 4, 128, yF + 5, top + 15 * 0.9, 0.9, 30 + cx);
    // Hastialito de la lucarna con tablas verticales.
    s.quad([x0 - 1, yF + 0.5, top], [1, 0, 0], [0, 0, 1], x1 - x0 + 2, 15 * 0.9, (u, v) => {
      if (v > 15 * 0.9 - Math.abs(u - 16) * 0.9) return null;
      return at(C.wood, Math.floor(u) % 4 === 0 ? 1 : 3);
    });
  }
}

function drawFrontGable(s: Escena, night: boolean) {
  const W = B.x1 - B.x0;
  const wins: Win[] = [
    { u0: 26, u1: 54, v0: 8, v1: 44, kind: "puerta" },
    { u0: 14, u1: 22, v0: 20, v1: 40, kind: "ventana" },
    { u0: 58, u1: 66, v0: 20, v1: 40, kind: "ventana" },
    { u0: 24, u1: 56, v0: 68, v1: 86, kind: "arco" },
  ];
  s.quad([B.x0, B.y1, 0], [1, 0, 0], [0, 0, 1], W, B.h, wall(wins, night, (u, v) => beam(v, 46) || logWall(u, v, 7)));
  s.quad([B.x1, B.y0, 0], [0, 1, 0], [0, 0, 1], B.y1 - B.y0, B.h, (u, v) => beam(v, 46, -1) || logWall(u, v, 8, -1));
  // Hastial del frontón: escamas y un óculo con rayos (la ventanita redonda del piso 3).
  s.quad([B.x0, B.y1, B.h], [1, 0, 0], [0, 0, 1], W, B_RIDGE_Z - B.h, (u, v) => {
    const x = B.x0 + u;
    if (B.h + v > roofB(x) - 0.5) return null;
    const dx = x - B_RIDGE_X;
    const dz = v - 16;
    const r = Math.hypot(dx, dz * 1.05);
    if (r < 9) {
      if (r >= 7.5) return at(C.woodDark, dz > 0 ? 3 : 1);
      if (r >= 6.5) return at(C.cream, 4);
      if (Math.abs(dx) < 0.8 || Math.abs(dz) < 0.7) return at(C.cream, 3);
      return night ? at(C.gold, dz > 0 ? 5 : 4) : at(C.sky, dz > 0 ? 3 : 2);
    }
    if (v < 3) return at(C.woodDark, v < 1 ? 1 : 3);
    return escamas(u, v, 0);
  });
  gableY(s, B.x0 - 8, B_RIDGE_X, B.x1 + 8, B.y0, B.y1 + 6, B_RIDGE_Z, B_SLOPE, 41);
  // Tabla tallada en la punta del frontón.
  for (let k = 0; k < 10; k += 0.4) {
    s.plot(B_RIDGE_X - k * 0.6, B.y1 + 6.5, B_RIDGE_Z - 4 - k, at(C.cream, 4));
    s.plot(B_RIDGE_X + k * 0.6, B.y1 + 6.5, B_RIDGE_Z - 4 - k, at(C.cream, 3));
  }
  logEnds(s, B.x0, B.y1, STONE_H, B.h, "y", 11);
  logEnds(s, B.x1, B.y1, STONE_H, B.h, "y", 12);
}

function drawPorch(s: Escena, night: boolean) {
  const W = P.x1 - P.x0;
  const deck: Tinte = (u, v) => {
    if (v > P.y1 - P.y0 - 1.5) return at(C.wood, 5);
    const plank = Math.floor(u / 5);
    if (u % 5 < 0.8) return at(C.wood, 1);
    return at(C.wood, noise(plank, Math.floor(v / 18), 5) < 0.4 ? 3 : 4);
  };
  s.box(P.x0, P.y0, 0, W, P.y1 - P.y0, P.h, deck, (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 1 : 2), () => at(C.wood, 1));
  // Escalones de piedra delante: losas con juntas y el canto iluminado.
  const slab = (u: number, v: number) => (Math.floor(u) % 11 === 0 ? at(C.stone, 2) : v < 1 ? at(C.stone, 5) : at(C.stone, 4));
  s.box(156, P.y1, 0, 48, 5, 4, slab, (u, v) => (v > 3 ? at(C.stone, 4) : Math.floor(u) % 11 === 0 ? at(C.stone, 1) : at(C.stone, 3)), () => at(C.stone, 2));
  s.box(160, P.y1 + 5, 0, 40, 4, 2, slab, (_u, v) => at(C.stone, v > 1 ? 4 : 2), () => at(C.stone, 1));
  // Felpudo.
  s.box(166, 208, P.h, 28, 12, 0.5, (u, v) => (u < 1.5 || u > 26.5 || v < 1.5 || v > 10.5 ? at(C.rug, 2) : at(C.mustard, (Math.floor(u) + Math.floor(v)) % 3 ? 2 : 1)), null, null);
  // Pilares con basa de piedra, faroles y ménsulas bajo la viga.
  for (const px of [P.x0 + 3, P.x1 - 8]) {
    s.box(px - 1, P_POST_Y - 1, P.h, 7, 7, 8, () => at(C.stone, 4), (u, v) => stones(u, v, 9), (u, v) => stones(u, v, 9, 1));
    s.solid(px, P_POST_Y, P.h + 8, 5, 5, P_ROOF.eave - P.h - 8, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    lantern(s, px + 2.5, P_POST_Y + 6, 30, night);
    for (let k = 0; k < 7; k += 0.4) {
      s.plot(px + 5 + k, P_POST_Y + 2.5, P_ROOF.eave - 11 + k, at(C.woodDark, 3));
      s.plot(px - k, P_POST_Y + 2.5, P_ROOF.eave - 11 + k, at(C.woodDark, 3));
    }
  }
  s.solid(P.x0, P_POST_Y, P_ROOF.eave - 4, W, 5, 4, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Macetas con flores junto a la puerta.
  for (const mx of [150, 202]) {
    s.box(mx, 210, P.h, 8, 8, 7, () => at(C.dirt, 1), (u) => at(C.terracotta, u < 2 ? 4 : 3), () => at(C.terracotta, 2));
    flowers(s, mx + 0.5, 210.5, mx + 7.5, 217.5, P.h + 7, 51 + mx, 1.8);
  }
  // Techito del porche: dos aguas con un hastial de tablas y, al frente, el letrero "HYVENTO" sobre un
  // sol tallado (en el hastial se ve siempre: detrás, bajo el techito, quedaría tapado).
  const half = (P_ROOF.x1 - P_ROOF.x0) / 2;
  const ridgeZ = P_ROOF.eave + half * P_ROOF.slope;
  gableY(s, P_ROOF.x0, P_ROOF.x0 + half, P_ROOF.x1, P_ROOF.y0, P_ROOF.y1, ridgeZ, P_ROOF.slope, 61);
  const text = "HYVENTO";
  const textW = text.length * 4 - 1;
  s.quad([P_ROOF.x0 + 4, P_ROOF.y1 - 1, P_ROOF.eave - 4], [1, 0, 0], [0, 0, 1], (half - 4) * 2, ridgeZ - P_ROOF.eave + 4, (u, v) => {
    const du = u - (half - 4);
    const lim = ridgeZ - P_ROOF.eave + 1 - Math.abs(du) * P_ROOF.slope;
    if (v > lim) return null;
    // Letrero: tabla oscura con marco claro y las letras de 3x5 en dorado.
    if (Math.abs(du) < textW / 2 + 3 && v >= 5 && v < 14) {
      if (Math.abs(du) >= textW / 2 + 2 || v < 6 || v >= 13) return at(C.wood, 5);
      const gx = Math.floor(du + textW / 2);
      const gy = Math.floor(12 - v);
      const k = Math.floor(gx / 4);
      if (gx >= 0 && k < text.length && gx % 4 < 3 && gy >= 0 && gy < 5 && GLYPHS[text[k]!]?.[gy]?.[gx % 4] === "#") return at(C.gold, 5);
      return at(C.woodDark, 1);
    }
    // Rayos del sol que asoman alrededor del letrero.
    const r = Math.hypot(du, (v - 9) * 1.6);
    if (v > 3 && r < 26) {
      const ang = Math.atan2(v - 9, du);
      return Math.floor(ang * 6 + 20) % 2 ? at(C.cream, 4) : at(C.cream, 2);
    }
    if (v < 4) return at(C.woodDark, v < 1 ? 1 : 3);
    return at(C.wood, Math.floor(u) % 4 === 0 ? 2 : 4);
  });
  // Farol colgante al centro (la luz del porche).
  for (let z = 38; z < P_ROOF.eave - 2; z += 0.5) s.plot(180, 226, z, at(C.metal, 1));
  lantern(s, 180, 226, 32, night);
}

/** Letras de 3x5 para el letrero (filas de arriba abajo). */
const GLYPHS: Record<string, string[]> = {
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  E: ["###", "#..", "##.", "#..", "###"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
};

function drawBalconies(s: Escena, _night: boolean) {
  for (const [x0, x1] of [
    [A.x0 + 6, B.x0 - 2],
    [B.x1 + 2, A.x1 - 2],
  ] as const) {
    const y0 = A.y1;
    const y1 = A.y1 + 14;
    const z = 46;
    s.box(x0, y0, z, x1 - x0, y1 - y0, 4, (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 2 : 4), (_u, v) => at(C.woodDark, v > 3 ? 4 : 2), () => at(C.woodDark, 2));
    // Ménsulas bajo la losa.
    for (let x = x0 + 4; x < x1; x += 14)
      for (let k = 0; k < 9; k += 0.4) s.plot(x, y0 + k * 1.2, z - 9 + k, at(C.woodDark, 3));
    railing(s, [x0 + 1, y1 - 1], [x1 - 1, y1 - 1], z + 4, 11, 7);
    railing(s, [x1 - 1, y0], [x1 - 1, y1 - 1], z + 4, 11, 7);
    planter(s, x0 + 3, y1, x1 - x0 - 6, 4, z + 9, x0);
  }
  // Jardineras bajo las ventanas de la planta baja.
  planter(s, A.x0 + 11, A.y1, 26, 4, 14, 3);
  planter(s, A.x0 + 133, A.y1, 22, 4, 14, 4);
  planter(s, B.x0 + 11, B.y1, 14, 4, 14, 5);
  planter(s, B.x0 + 55, B.y1, 14, 4, 14, 6);
}

function drawTower(s: Escena, night: boolean) {
  const { cx, cy, r, wall: top, deck } = T;
  // Ventanas por ángulo (la cámara ve de -45° a 135°; 45° es el centro).
  const floors: { v0: number; v1: number; angs: number[]; kind: Kind }[] = [
    { v0: 18, v1: 38, angs: [0.15, 1.35, 2.3], kind: "arco" },
    { v0: 58, v1: 78, angs: [0.7, 1.9], kind: "ventana" },
    { v0: 92, v1: 110, angs: [0.1, 1.2, 2.25], kind: "ventana" },
  ];
  s.cylinder(cx, cy, 0, r, top, (ang, v, luz) => {
    const lz = luz > 0.35 ? 0 : luz > -0.35 ? -1 : -2;
    for (const f of floors)
      for (const a of f.angs) {
        const u = (ang - a) * r;
        const c = windowAt(u + 10, v, { u0: 0, u1: 20, v0: f.v0, v1: f.v1, kind: f.kind, shutters: f.kind === "ventana" }, night);
        if (c) return lz < -1 ? mix(c, at(C.night, 1), 0.25) : c;
      }
    // Banda de ventanas del mirador (arriba del balcón).
    if (v >= deck + 5 && v < top - 3) {
      const seg = (ang * r) % 11;
      if (seg < 2) return at(C.woodDark, 2 + lz);
      if (v < deck + 7 || v >= top - 5) return at(C.cream, 3);
      return night ? at(C.gold, v > top - 12 ? 5 : 4) : at(C.sky, v > top - 10 ? 3 : 2);
    }
    if (v >= deck && v < deck + 5) return at(C.woodDark, 3 + lz);
    if (v >= 44 && v < 48) return at(C.woodDark, 3 + lz);
    if (v < 44) return stones(ang * r, v, 13, lz < 0 ? 1 : 0);
    return logWall(ang * r, v - 34, 15, lz);
  });
  // Balcón del mirador: losa anillada y baranda.
  s.disc(cx, cy, deck, r + 7, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < r) return null;
    return at(C.wood, d > r + 6 ? 5 : Math.floor(Math.atan2(dy, dx) * 12) % 2 ? 3 : 4);
  });
  s.cylinder(cx, cy, deck - 3, r + 7, 3, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 2));
  for (let a = -Math.PI / 4; a <= (3 * Math.PI) / 4; a += 0.02) {
    const x = cx + Math.cos(a) * (r + 6);
    const y = cy + Math.sin(a) * (r + 6);
    s.borde = false;
    if (Math.floor(a * 60) % 3 === 0) for (let v = 0; v < 10; v += 0.5) s.plot(x, y, deck + v, at(C.wood, 2));
    s.borde = true;
    s.plot(x, y, deck + 10.5, at(C.wood, 5));
    s.plot(x, y, deck + 10, at(C.wood, 4));
  }
  for (let a = -Math.PI / 4; a <= (3 * Math.PI) / 4; a += 0.45) s.solid(cx + Math.cos(a) * (r + 6) - 1, cy + Math.sin(a) * (r + 6) - 1, deck, 2, 2, 11, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  // Techo cónico con tejas en escama y una veleta.
  s.cylinder(cx, cy, top - 3, T_ROOF.r, 3, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 1));
  s.cone(cx, cy, top, T_ROOF.r, T_ROOF.h, (ang, sl, luz) => {
    const row = Math.floor(sl / 5);
    const rr = T_ROOF.r * (1 - sl / Math.hypot(T_ROOF.r, T_ROOF.h));
    const u = ang * Math.max(4, rr);
    const off = row % 2 ? 3.5 : 0;
    const k = sl % 5;
    const lz = luz > 0.55 ? 1 : luz > -0.1 ? 0 : -1;
    if (k < 1) return at(C.roof, 1 + lz);
    if ((u + off) % 7 < 0.9) return at(C.roof, 2 + lz);
    return at(C.roof, (k > 4 ? 4 : 3) + lz + (noise(Math.floor((u + off) / 7), row, 5) < 0.12 ? -1 : 0));
  });
  const tip = top + T_ROOF.h;
  s.solid(cx - 1, cy - 1, tip - 2, 2, 2, 14, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.disc(cx, cy, tip + 5, 2.2, () => at(C.gold, 4));
  // Veleta: flecha y un gallito dorado.
  for (let k = -7; k < 7; k += 0.4) s.plot(cx + k * 0.7, cy - k * 0.7, tip + 12, at(C.metal, 2));
  for (let k = 0; k < 5; k += 0.5) for (let h = 0; h < 4; h += 0.5) s.plot(cx - 1 + k * 0.5, cy + 1 - k * 0.5, tip + 13 + h - (k > 3 ? h * 0.5 : 0), at(C.gold, h > 2 ? 5 : 4));
}

function drawEastWing(s: Escena, night: boolean) {
  const side: Win[] = [
    { u0: 14, u1: 34, v0: 18, v1: 38, kind: "ventana", shutters: true },
    { u0: 52, u1: 72, v0: 18, v1: 38, kind: "ventana", shutters: true },
  ];
  s.quad([E.x1, E.y0, 0], [0, 1, 0], [0, 0, 1], E.y1 - E.y0, E.h, wall(side, night, (u, v) => logWall(u, v, 19, -1)));
  const front: Win[] = [
    { u0: 12, u1: 30, v0: 18, v1: 38, kind: "ventana" },
    { u0: 44, u1: 60, v0: 8, v1: 44, kind: "puerta" },
  ];
  s.quad([E.x0, E.y1, 0], [1, 0, 0], [0, 0, 1], E.x1 - E.x0, E.h, wall(front, night, (u, v) => logWall(u, v, 20)));
  // Hastial este del ala: escamas y un ojo de buey.
  s.quad([E.x1, E.y0 - 8, E.h], [0, 1, 0], [0, 0, 1], E.y1 - E.y0 + 16, E_RIDGE_Z - E.h, (u, v) => {
    const y = E.y0 - 8 + u;
    if (E.h + v > roofE(y) - 0.5 || y < E.y0 || y > E.y1) return null;
    const r = Math.hypot(y - E_RIDGE_Y, (v - 12) * 1.05);
    if (r < 6) return r > 4.6 ? at(C.woodDark, 2) : night ? at(C.gold, 4) : at(C.sky, 2);
    if (v < 3) return at(C.woodDark, v < 1 ? 1 : 3);
    return escamas(u, v, -1);
  });
  gableX(s, E.x0 - 2, E.x1 + 7, E.y0 - 8, E_RIDGE_Y, E.y1, E_RIDGE_Z, E_SLOPE, 71);
  logEnds(s, E.x1, E.y0, STONE_H, E.h, "x", 23);
}

function drawTerrace(s: Escena, night: boolean) {
  const { x0, x1, y0, y1, z } = TR;
  // Piso de tablas de la terraza.
  s.box(x0, y0, 0, x1 - x0, y1 - y0, 5, (u, v) => {
    const plank = Math.floor(v / 5);
    if (v % 5 < 0.8) return at(C.wood, 1);
    return at(C.wood, noise(plank, Math.floor(u / 24), 7) < 0.4 ? 3 : 4);
  }, (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 1 : 2), (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 0 : 1));
  // Muebles bajo el techo: mecedora, mesita con tetera y macetas.
  s.solid(300, 162, 5, 12, 10, 8, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  s.solid(301, 163, 13, 10, 8, 1.5, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  s.solid(304, 165, 14.5, 4, 4, 3, at(C.white, 4), at(C.white, 3), at(C.white, 2));
  s.solid(276, 164, 5, 10, 9, 5, at(C.fabric, 4), at(C.fabric, 3), at(C.fabric, 2));
  s.solid(276, 164, 10, 3, 9, 10, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  s.box(318, 158, 5, 8, 8, 7, () => at(C.dirt, 1), () => at(C.terracotta, 3), () => at(C.terracotta, 2));
  flowers(s, 318.5, 158.5, 325.5, 165.5, 12, 81, 0.6);
  // Pilares.
  for (const px of [x0 + 2, 296, x1 - 5])
    s.solid(px, y1 - 5, 5, 4, 4, z - 5, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  for (const py of [y0 + 26]) s.solid(x1 - 5, py, 5, 4, 4, z - 5, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Farol colgante bajo el techo.
  for (let v = 36; v < z; v += 0.5) s.plot(316, 196, v, at(C.metal, 1));
  lantern(s, 316, 196, 31, night);
  // Techo plano = balcón del piso 2 (con su viga de borde).
  s.box(x0, y0, z, x1 - x0 + 2, y1 - y0 + 2, 4, (u, v) => {
    const plank = Math.floor(u / 5);
    if (u % 5 < 0.8) return at(C.wood, 2);
    return at(C.wood, noise(plank, Math.floor(v / 20), 9) < 0.4 ? 3 : 4);
  }, (_u, v) => at(C.woodDark, v > 2.5 ? 4 : 2), (_u, v) => at(C.woodDark, v > 2.5 ? 3 : 1));
  // Baranda del balcón (con el hueco donde llega la escalera) y jardineras.
  railing(s, [x0 + 1, y1], [x1 + 1, y1], z + 4, 11, 8);
  railing(s, [x1 + 1, y0 + 12], [x1 + 1, y1], z + 4, 11, 8);
  planter(s, x0 + 6, y1 + 2, 30, 4, z + 9, 91);
  planter(s, 300, y1 + 2, 28, 4, z + 9, 92);
  // Mesa redonda con dos sillas de jardín y una sombrilla a rayas en el balcón.
  s.solid(295, 175, z + 4, 2, 2, 9, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.disc(296, 176, z + 13, 6, (dx, dy) => at(C.cream, dx + dy < -4 ? 5 : 4));
  s.cylinder(296, 176, z + 11.5, 6, 1.5, (_a, _v, luz) => at(C.cream, luz > 0 ? 3 : 2));
  for (const [cx, cy] of [
    [283, 172],
    [304, 186],
  ] as const) {
    for (const [lx, ly] of [
      [0, 0],
      [6, 0],
      [0, 6],
      [6, 6],
    ] as const)
      s.solid(cx + lx, cy + ly, z + 4, 1.5, 1.5, 5, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
    s.solid(cx, cy, z + 9, 7.5, 7.5, 1.5, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
    s.solid(cx, cy, z + 10.5, 7.5, 1.5, 7, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  }
  s.solid(295.5, 175.5, z + 14, 1, 1, 24, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  s.cone(296, 176, z + 36, 15, 6, (ang) => (Math.floor((ang + 4) * 2.55) % 2 ? at(C.rug, 3) : at(C.cream, 5)));
  s.cylinder(296, 176, z + 34.5, 15, 1.5, (ang) => (Math.floor((ang + 4) * 2.55) % 2 ? at(C.rug, 2) : at(C.cream, 3)));
  s.box(262, 154, z + 4, 8, 8, 8, () => at(C.dirt, 1), () => at(C.terracotta, 3), () => at(C.terracotta, 2));
  for (let k = 0; k < 10; k += 0.5) s.plot(266, 158, z + 12 + k, at(C.logs, 2));
  for (let a = 0; a < 40; a++) {
    const dx = (noise(a, 1, 3) - 0.5) * 12;
    const dy = (noise(a, 2, 3) - 0.5) * 12;
    const dz = noise(a, 3, 3) * 9;
    s.plot(266 + dx, 158 + dy, z + 20 + dz, at(C.leaf, dz > 5 ? 4 : 2 + (a % 2)));
    s.plot(266 + dx + 0.5, 158 + dy, z + 20 + dz, at(C.leaf, 3));
  }
}

function drawStair(s: Escena) {
  const { x0, x1, yTop, yBottom } = ST;
  const steps = 13;
  const rise = (TR.z + 4) / steps;
  const run = (yBottom - yTop) / steps;
  // Peldaños de abajo (adelante) hacia arriba (atrás): huella clara y contrahuella con sombra abajo.
  s.borde = false;
  for (let i = 0; i < steps; i++) {
    const y = yBottom - (i + 1) * run;
    const z = i * rise;
    s.box(x0, y, 0, x1 - x0, run + 0.3, z + rise, (u, v) => at(C.wood, v < 1 ? 5 : u < 1 ? 3 : 4), (_u, v) => (v < z ? null : at(C.wood, v - z < 1 ? 1 : 3)), null);
  }
  s.borde = true;
  // Zanca exterior (tabla inclinada) con sus postes y el pasamanos.
  s.quad([x1, yBottom, -4], [0, -run, rise], [0, 0, 1], steps, 6, (_u, v) => at(C.woodDark, v > 5 ? 4 : v < 1 ? 1 : 2));
  for (let i = 0; i <= steps; i += 3) {
    const y = yBottom - i * run - 1;
    s.solid(x1 - 2, y - 1, i * rise, 2, 2, 15, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  }
  for (let k = 0; k <= steps; k += 0.05) {
    const y = yBottom - k * run - 1;
    s.plot(x1 - 1, y, k * rise + 15.5, at(C.wood, 5));
    s.plot(x1 - 1, y, k * rise + 15, at(C.wood, 3));
  }
}

/**
 * Cantero al este del ala: flores, dos arbustos redondos y un rosal que trepa por la pared. (Antes había
 * una pérgola aquí, repetida con la del patio: la pérgola del jardín es una sola.)
 */
function drawEastBed(s: Escena) {
  const { x0, x1, y0, y1 } = PG;
  s.box(x0 - 4, y0 + 2, 0, x1 - x0 + 2, y1 - y0 - 4, 3, (u, v) => at(C.dirt, 1 + (noise(u, v, 104) < 0.3 ? 1 : 0)), (u, v) => stones(u, v + 1, 104), (u, v) => stones(u, v + 1, 104, 1));
  flowers(s, x0 - 3, y0 + 3, x1 - 3, y1 - 3, 3, 105, 1.2);
  for (const [bx, by, br] of [
    [x0 + 4, y0 + 12, 6],
    [x0 + 5, y1 - 14, 7],
  ] as const) {
    for (let a = 0; a < 240; a++) {
      const th = noise(a, 1, bx + by) * Math.PI * 2;
      const ph = noise(a, 2, bx + by) * Math.PI * 0.5;
      const lit = Math.sin(th) * 0.5 - Math.cos(th) * 0.3 + Math.sin(ph);
      s.plot(bx + Math.cos(th) * Math.cos(ph) * br, by + Math.sin(th) * Math.cos(ph) * br, 3 + Math.sin(ph) * br * 1.1, at(C.leaf, lit > 1 ? 4 : lit > 0.3 ? 3 : 2));
    }
    s.disc(bx, by, 3 + br * 1.15, br * 0.7, (dx, dy) => at(C.leaf, dx + dy < -2 ? 4 : 3));
  }
  // Rosal trepador contra la pared del ala (hojas en zigzag y rosas rojas sueltas).
  for (let y = y0 + 22; y < y1 - 26; y += 0.7)
    for (let z = 3; z < 40; z += 0.7) {
      const n = smoothNoise(y, z, 5, 106);
      if (n < 0.5 - (z > 30 ? (z - 30) * 0.03 : 0)) continue;
      s.plot(E.x1 + 0.6, y, z, at(C.leaf, n > 0.75 ? 4 : n > 0.6 ? 3 : 2));
      if (noise(Math.floor(y), Math.floor(z), 107) < 0.05) s.plot(E.x1 + 1, y, z, at(C.rug, 4));
    }
}

/** Canteros con flores y arbustos pegados a la casa (entre la torre, el frente y la terraza). */
function drawGardenBeds(s: Escena) {
  const bed = (x0: number, y0: number, w: number, d: number, seed: number) => {
    s.box(x0, y0, 0, w, d, 3, (u, v) => at(C.dirt, 1 + (noise(u, v, seed) < 0.3 ? 1 : 0)), (_u, v) => stones(_u, v + 1, seed), (_u, v) => stones(_u, v + 1, seed, 1));
    flowers(s, x0 + 1, y0 + 1, x0 + w - 1, y0 + d - 1, 3, seed, 1.3);
  };
  bed(100, 196, 34, 8, 101);
  bed(222, 212, 30, 8, 102);
  bed(96, 214, 30, 8, 103);
  // Arbustos redondos en las esquinas del frente.
  for (const [bx, by, br] of [
    [130, 214, 7],
    [252, 200, 6],
  ] as const) {
    for (let a = 0; a < 260; a++) {
      const th = noise(a, 1, bx) * Math.PI * 2;
      const ph = noise(a, 2, bx) * Math.PI * 0.5;
      const x = bx + Math.cos(th) * Math.cos(ph) * br;
      const y = by + Math.sin(th) * Math.cos(ph) * br;
      const z = Math.sin(ph) * br * 1.1 + 1;
      const lit = Math.sin(th) * 0.5 - Math.cos(th) * 0.3 + Math.sin(ph);
      s.plot(x, y, z, at(C.leaf, lit > 1 ? 4 : lit > 0.3 ? 3 : 2));
    }
    s.disc(bx, by, br * 1.15, br * 0.7, (dx, dy) => at(C.leaf, dx + dy < -2 ? 4 : 3));
  }
}
