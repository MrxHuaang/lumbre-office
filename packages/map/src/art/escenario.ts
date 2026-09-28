// El escenario al aire libre del jardín: la concha (el marco de madera con la pantalla grande, el telón
// vino a los lados, el techito de tejas a dos aguas con guirnaldas y los parlantes al pie), la tarima de
// tablas con su escalerita, el atril con micrófono, los faroles de poste y las gradas de piedra con
// tablas en semicírculo. Todo mira al este (+x): la pantalla queda de frente a la cámara, como la del
// cine. Coordenadas locales de arte (tile = 16). La concha tiene versión de noche (outdoor.ts).
import { Escena, type Tinte } from "./exterior-escena";
import { escamas, gableX, lantern, stones } from "./exterior-casa";
import { C, mix } from "./palette";
import { at, noise, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";
import { GRADAS, GRADAS_ROWS } from "../world/catalog-escenario";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const T = (c: RGBA): Tinte => () => c;

/** Altura de las tablas de la tarima (y del piso de la concha, que sigue igual). */
export const STAGE_FLOOR_Z = 4;

/**
 * La tela de la pantalla, en unidades de arte locales de la concha: el plano x = `x` (mira a +x), de
 * `y0` a `y1` y de `z0` a `z1`. El cliente monta ahí la pantalla compartida de quien está en la tarima.
 */
export const STAGE_SCREEN = { x: 12, y0: 22, y1: 90, z0: 16, z1: 54 } as const;

/** Tablas a lo largo de u (juntas cada `pitch`), con tono por tabla y alguna más gastada. */
const planks =
  (seed: number, pitch = 5, base = 4): Tinte =>
  (u, v) => {
    if (u % pitch < 0.7) return at(C.wood, base - 2);
    const n = noise(Math.floor(u / pitch), Math.floor(v / 40), seed);
    return at(C.wood, base + (n < 0.3 ? -1 : n > 0.9 ? 1 : 0));
  };

// ---------- La concha ----------

/** Marco del escenario: postes y viga de madera oscura con la veta. */
const post = (s: Escena, x: number, y: number, z: number, w: number, d: number, h: number) =>
  s.box(x, y, z, w, d, h, T(at(C.woodDark, 4)), (u, v) => at(C.woodDark, (u + v * 0.1) % 3 < 0.5 ? 2 : 3), (u) => at(C.woodDark, u % 3 < 0.5 ? 1 : 2));

/** Telón de terciopelo vino: pliegues verticales, borde dorado abajo, recogido con un cordón. */
function curtain(s: Escena, x: number, y0: number, y1: number, zTop: number, tieZ: number, tieAt: number) {
  const w = y1 - y0;
  for (let v = STAGE_FLOOR_Z; v < zTop; v += 0.5) {
    // Recogido: más angosto a la altura del cordón (se abre arriba y abajo).
    const pinch = Math.min(1, Math.abs(v - tieZ) / 18);
    const width = w * (0.55 + 0.45 * pinch);
    const from = tieAt < 0.5 ? y0 : y1 - width;
    for (let u = 0; u < width; u += 0.5) {
      const fold = Math.sin((u / width) * Math.PI * 5);
      const tone = fold > 0.5 ? 4 : fold > -0.2 ? 3 : 2;
      const hem = v < STAGE_FLOOR_Z + 2.5;
      s.plot(x + fold * 1.2, from + u, v, hem ? at(C.gold, fold > 0 ? 4 : 3) : at(C.curtain, tone));
    }
  }
  // El cordón dorado con su borla.
  for (let u = 0; u < w * 0.6; u += 0.5) s.plot(x + 1.6, (tieAt < 0.5 ? y0 : y1 - w * 0.6) + u, tieZ, at(C.gold, 4));
  s.solid(x + 1, tieAt < 0.5 ? y0 + w * 0.6 - 1 : y1 - w * 0.6, tieZ - 5, 2, 2, 5, at(C.gold, 5), at(C.gold, 3), at(C.gold, 2));
}

/** Parlante de madera: caja con dos conos y la rejilla de tela. */
function speaker(s: Escena, x: number, y: number) {
  s.box(x, y, STAGE_FLOOR_Z, 11, 12, 22, T(at(C.woodDark, 4)), T(at(C.woodDark, 2)), (u, v) => {
    if (u < 1 || u > 11 || v < 1 || v > 21) return at(C.woodDark, 3);
    const big = Math.hypot(u - 6, v - 7);
    const small = Math.hypot(u - 6, v - 16);
    if (big < 4) return big < 1.2 ? at(C.metal, 3) : big < 3 ? at(C.night, 1) : at(C.metal, 1);
    if (small < 2.2) return small < 0.8 ? at(C.metal, 3) : at(C.night, 1);
    return at(C.navy, (Math.floor(u) + Math.floor(v)) % 2 ? 1 : 2);
  });
}

/**
 * La concha (3x7 tiles = 48x112 unidades): el piso de tablas sobre piedra, la pared de tablas de atrás,
 * el marco con la pantalla (una tela clara donde el cliente proyecta la pantalla compartida), el telón,
 * el techito de tejas con el frontón de escamas y el letrero "HYVENTO", las guirnaldas y los parlantes.
 */
export function stageShell(night: boolean): Sprite {
  const s = scene(3, 7, 96, 10);
  const W = 48;
  const D = 112;
  s.shadow(-2, -2, W + 4, D + 6, 0.3);
  // Basa de piedra y piso de tablas (sigue en la tarima, a la misma altura).
  s.box(0, 0, 0, W, D, STAGE_FLOOR_Z, (u, v) => planks(21)(v, u), (u, v) => stones(u, v * 2, 5), null);
  // Pared de atrás, de tablas verticales, hasta la viga (tapa el bosque que queda detrás).
  s.box(2, 4, STAGE_FLOOR_Z, 6, D - 8, 62, T(at(C.wood, 3)), (u, v) => planks(23, 4, 3)(u, v), (u) => planks(24, 4, 2)(u, 0));
  // Postes y viga del marco.
  const { x: SX, y0, y1, z0, z1 } = STAGE_SCREEN;
  post(s, SX - 4, y0 - 6, STAGE_FLOOR_Z, 4, 6, 62);
  post(s, SX - 4, y1, STAGE_FLOOR_Z, 4, 6, 62);
  post(s, 2, y0 - 6, 66, SX + 4, y1 - y0 + 12, 4);
  // La tela de la pantalla: crema, con el borde negro de proyección y apenas una sombra de la viga.
  s.box(SX - 3, y0, z0, 3, y1 - y0, z1 - z0, T(at(C.woodDark, 3)), T(at(C.woodDark, 2)), (u, v) => {
    const e = Math.min(u, y1 - y0 - u, v, z1 - z0 - v);
    if (e < 1.5) return at(C.night, 1);
    if (z1 - z0 - v < 5) return mix(at(C.cream, 4), at(C.cream, 2), 0.5);
    return at(C.cream, v > (z1 - z0) * 0.55 ? 4 : 5);
  });
  // Faldón de madera bajo la pantalla, con una franja pintada.
  s.box(SX - 3, y0, STAGE_FLOOR_Z, 3, y1 - y0, z0 - STAGE_FLOOR_Z, null, null, (_u, v) => (Math.abs(v - 6) < 1.5 ? at(C.curtain, 3) : at(C.wood, 3)));
  // Cenefa del telón a lo ancho, arriba de la tela.
  // Lleva "HYVENTO" bordado en dorado (letras de 3x5); la cara mira a +x, así que en pantalla el sur (+y)
  // queda a la izquierda y se lee desde el sur.
  const VAL = y1 - y0 + 12;
  s.box(SX + 3, y0 - 6, 57, 3, VAL, 6.5, T(at(C.curtain, 3)), T(at(C.curtain, 2)), (u, v) => {
    if (v < 0.8) return at(C.gold, 4);
    const text = "HYVENTO";
    const tw = text.length * 4 - 1;
    const lx = Math.floor(VAL / 2 + tw / 2 - u);
    const gy = Math.floor(6 - v);
    const li = Math.floor(lx / 4);
    if (lx >= 0 && lx < tw && gy >= 0 && gy < 5 && glyphOn(text[li]!, lx - li * 4, gy)) return at(C.gold, 5);
    return at(C.curtain, Math.floor(u / 5) % 2 ? 3 : 2);
  });
  curtain(s, SX + 2, 2, y0 + 3, 58, 28, 0);
  curtain(s, SX + 2, y1 - 3, D - 2, 58, 28, 1);
  // Techito de tejas sobre el marco, con el frontón de escamas mirando al público y el letrero.
  const RIDGE_Y = D / 2;
  const SLOPE = 0.26;
  const EAVE_Z = 67;
  const RIDGE_Z = EAVE_Z + (RIDGE_Y + 6) * SLOPE;
  const X1 = SX + 6;
  s.quad([X1, -6, EAVE_Z], [0, 1, 0], [0, 0, 1], D + 12, RIDGE_Z - EAVE_Z, (u, v) => {
    const y = u - 6;
    if (EAVE_Z + v > RIDGE_Z - Math.abs(y - RIDGE_Y) * SLOPE - 0.5) return null;
    if (v < 2) return at(C.woodDark, v < 1 ? 1 : 3);
    // Un sol dorado pintado al centro del frontón.
    const d = Math.hypot(y - RIDGE_Y, v - 7);
    if (d < 3.2) return at(C.gold, d < 2 ? 5 : 4);
    if (d < 5.5 && Math.floor((Math.atan2(v - 7, y - RIDGE_Y) + 4) * 2.55) % 2 === 0) return at(C.gold, 3);
    return escamas(u, v, 0);
  });
  gableX(s, 0, X1, -6, RIDGE_Y, D + 6, RIDGE_Z, SLOPE, 61);
  // Guirnalda de bombillos en el alero y dos que bajan en diagonal hasta los faroles de los lados.
  const bulb = (x: number, y: number, z: number, i: number) => {
    s.plot(x, y, z - 1, night ? at(C.gold, 5) : [at(C.cream, 4), at(C.rose, 4), at(C.gold, 4)][i % 3]!);
    s.plot(x, y, z - 1.6, night ? at(C.white, 4) : at(C.gold, 3));
  };
  s.borde = false;
  for (let k = 0; k <= 1; k += 0.004) {
    const y = -4 + k * (D + 8);
    const z = EAVE_Z - 3 - Math.sin(k * Math.PI * 4) ** 2 * 5;
    s.plot(X1 + 1, y, z, at(C.metal, 1));
    if (Math.floor(k * 250) % 10 === 5) bulb(X1 + 1, y, z, Math.floor(k * 25));
  }
  for (const [ya, yb] of [
    [-4, -8],
    [D + 4, D + 8],
  ] as const)
    for (let k = 0; k <= 1; k += 0.006) {
      const x = X1 + k * (88 - X1);
      const y = ya + (yb - ya) * k;
      const z = EAVE_Z - 3 + (46 - EAVE_Z + 3) * k - Math.sin(k * Math.PI) * 9;
      s.plot(x, y, z, at(C.metal, 1));
      if (Math.floor(k * 166) % 12 === 6) bulb(x, y, z, Math.floor(k * 14));
    }
  s.borde = true;
  // Parlantes al pie y maceteros con flores entre ellos; candilejas en el borde.
  speaker(s, 34, 3);
  speaker(s, 34, D - 15);
  for (const [y, seed] of [
    [26, 3],
    [86, 7],
  ] as const) {
    s.box(36, y - 4, STAGE_FLOOR_Z, 8, 8, 6, T(at(C.dirt, 2)), (u) => at(C.terracotta, u < 1 ? 4 : 3), T(at(C.terracotta, 2)));
    for (let i = 0; i < 60; i++) {
      const a = noise(i, 1, seed) * Math.PI * 2;
      const d = noise(i, 2, seed) * 4;
      const hz = noise(i, 3, seed) * 7;
      s.plot(40 + Math.cos(a) * d, y + Math.sin(a) * d, STAGE_FLOOR_Z + 6 + hz, i % 7 === 0 ? at(C.rug, 4) : i % 11 === 0 ? at(C.gold, 5) : at(C.leaf, hz > 4 ? 4 : 2 + (i % 2)));
    }
  }
  for (let y = 36; y < 78; y += 7) {
    s.solid(45, y, STAGE_FLOOR_Z, 2.5, 3, 2, at(C.metal, 2), at(C.metal, 1), at(C.metal, 0));
    s.plot(46.5, y + 1.5, STAGE_FLOOR_Z + 2.4, night ? at(C.gold, 5) : at(C.gold, 3));
  }
  return s.sprite();
}

// ---------- La tarima ----------

/** La tarima (3x7): tablas sobre piedra, con la escalerita de dos peldaños al medio del frente. */
export function stageDeck(): Sprite {
  const s = scene(3, 7, 12, 12);
  const W = 48;
  const D = 112;
  s.shadow(0, 0, W + 4, D + 2, 0.22);
  s.box(0, 0, 0, W, D, STAGE_FLOOR_Z, (u, v) => planks(31)(v, u), (u, v) => stones(u, v * 2, 7), (u, v) => stones(u, v * 2, 8, 1));
  // Clavos en las tablas y una tabla más nueva.
  for (let y = 4; y < D; y += 20) s.plot(W - 3, y, STAGE_FLOOR_Z + 0.1, at(C.woodDark, 1));
  s.box(18, 20, STAGE_FLOOR_Z, 30, 4.4, 0.2, T(at(C.wood, 5)), null, null);
  // La escalerita del frente (hacia el pasillo del medio de las gradas).
  const Y0 = 49;
  s.box(W, Y0, 0, 5, 14, 2.6, (u) => at(C.wood, u < 1 ? 5 : 4), T(at(C.wood, 2)), T(at(C.wood, 3)));
  s.box(W + 5, Y0, 0, 5, 14, 1.3, (u) => at(C.wood, u < 1 ? 5 : 4), T(at(C.wood, 2)), T(at(C.wood, 3)));
  return s.sprite();
}

/** El atril: pie de madera, la tapa inclinada hacia la tarima y el micrófono de cuello de ganso. */
export function stageLectern(): Sprite {
  const s = scene(1, 1, 40);
  s.shadow(3, 3, 11, 11, 0.25);
  s.solid(3, 3, 0, 10, 10, 2, at(C.woodDark, 4), at(C.woodDark, 2), at(C.woodDark, 1));
  // Frente del atril hacia el público (+x) con una estrellita dorada.
  s.box(5, 4, 2, 6, 8, 20, T(at(C.wood, 4)), T(at(C.wood, 2)), (u, v) => (Math.hypot(u - 4, v - 14) < 1.8 ? at(C.gold, 4) : at(C.wood, u % 4 < 0.5 ? 2 : 3)));
  s.quad([3, 3, 21], [0, 1, 0], [1, 0, 0.35], 10, 9, (u, v) => (v < 1 ? at(C.woodDark, 3) : at(C.wood, u % 5 < 0.5 ? 3 : 5)));
  // Hoja de papel sobre la tapa.
  s.quad([5, 5, 22.2], [0, 1, 0], [1, 0, 0.35], 5, 4, T(at(C.white, 4)));
  // El micrófono: un cuello de metal que se curva hacia la tarima y la cápsula con su espuma.
  for (let k = 0; k <= 1; k += 0.03) s.plot(11 - k * 7, 8, 24 + Math.sin(k * Math.PI * 0.8) * 7, at(C.metal, 2));
  s.solid(2.5, 7, 28.5, 2.5, 2, 2.5, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  return s.sprite();
}

/** Farol de poste: palo de madera con un brazo y el farol colgado (se prende de noche con su luz). */
export function stageLantern(): Sprite {
  const s = scene(1, 1, 60);
  s.roundShadow(8, 8, 4, 0.25);
  s.solid(6.5, 6.5, 0, 3, 3, 48, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.solid(5.5, 5.5, 0, 5, 5, 3, at(C.stone, 4), at(C.stone, 3), at(C.stone, 2));
  s.solid(6.5, 6.5, 48, 3, 8, 2, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  lantern(s, 8, 12, 37, false);
  for (let z = 43; z < 48; z += 0.5) s.plot(8, 12, z, at(C.metal, 1));
  return s.sprite();
}

// ---------- Las gradas ----------

/**
 * Una fila de gradas: la franja de piedra con tablas encima, en arco alrededor del frente de la tarima,
 * cortada en el pasillo del medio. Cada fila es un poco más alta que la anterior.
 */
function gradasRow(k: number): Sprite {
  const row = GRADAS_ROWS[k]!;
  const deckZ = GRADAS.deckZ[k]!;
  const benchZ = deckZ + GRADAS.benchZ;
  const s = scene(row.w, row.d, benchZ + 4, 14);
  const cx = (GRADAS.center.x - row.dx) * 16;
  const cy = (GRADAS.center.y - row.dy) * 16;
  const R = GRADAS.radii[k]! * 16;
  const max = (GRADAS.maxAngle * Math.PI) / 180;
  // Fila del pasillo en coordenadas locales de la pieza (las tablas se cortan ahí, con su borde).
  const aisle0 = (GRADAS.aisle - row.dy) * 16;
  const inAisle = (y: number) => y > aisle0 - 1.5 && y < aisle0 + 17.5;
  const step = 1 / R;
  for (let a = -max; a <= max; a += step) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const y = cy + sa * R;
    if (inAisle(y)) continue;
    // Piedra de la grada: de R-7 a R+7, con la cara que da al pasillo de atrás a la vista.
    for (let r = -7; r <= 7; r += 1.6) {
      const px = cx + ca * (R + r);
      const py = cy + sa * (R + r);
      s.box(px - 0.9, py - 0.9, 0, 1.8, 1.8, deckZ, T(at(C.stone, 4 - (noise(Math.floor(a * 30), Math.floor(r), 3) < 0.3 ? 1 : 0))), (u, v) => stones(a * R + u, v * 2, 9 + k), (u, v) => stones(a * R + u, v * 2, 9 + k, 1));
    }
    // Tablas de la banca (tres a lo ancho) y las patas cada tanto.
    for (let r = -4; r <= 4; r += 1.4) {
      const px = cx + ca * (R + r);
      const py = cy + sa * (R + r);
      const seam = Math.abs(r) > 3.2 || (a * R) % 24 < 0.7;
      s.box(px - 0.8, py - 0.8, benchZ - 1.6, 1.6, 1.6, 1.6, T(at(C.wood, seam ? 3 : noise(Math.floor((a * R) / 24), Math.floor(r + 5), 5 + k) < 0.3 ? 4 : 5)), T(at(C.wood, 2)), T(at(C.wood, 3)));
    }
    if (Math.floor(a * R) % 20 === 0)
      for (const r of [-3, 3]) s.solid(cx + ca * (R + r) - 1, cy + sa * (R + r) - 1, deckZ, 2, 2, benchZ - 1.6 - deckZ, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  }
  return s.sprite();
}

export const ESCENARIO_DRAW: Record<string, () => Sprite> = {
  "stage-deck": stageDeck,
  "stage-lectern": stageLectern,
  "stage-lantern": stageLantern,
  "gradas-1": () => gradasRow(0),
  "gradas-2": () => gradasRow(1),
  "gradas-3": () => gradasRow(2),
};
