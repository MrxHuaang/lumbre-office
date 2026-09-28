// La piscina del jardín: el deck de tablas con la pileta de piedra (de día y de noche, con las luces de
// adentro del agua), el trampolín, las reposeras, las sombrillas, la ducha y el toallero. Y lo que el
// cliente anima encima: los reflejos que se mueven en el agua, la lona para la lluvia, los flotadores y
// la salpicadura del chapuzón. Coordenadas locales de arte (tile = 16), mirando hacia +x.
import { POOL_BASIN, POOL_SIZE, POOL_STEPS } from "../world/catalog-agua";
import { Escena, type Tinte } from "./exterior-escena";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, alpha, at, bayer, noise, smoothNoise, toScreen, type RGBA, type Ramp, type Sprite } from "./pixel";

const L = 16;
const scene = (w: number, d: number, h: number, pad = 6, z0 = -2) => new Escena({ x0: -pad, y0: -pad, z0, x1: w * L + pad, y1: d * L + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Turquesa del agua de la piscina, de lo hondo a los brillos. */
export const POOL_WATER: Ramp = [
  [22, 86, 112, 255],
  [30, 118, 140, 255],
  [48, 156, 170, 255],
  [84, 192, 196, 255],
  [150, 226, 220, 255],
  [218, 250, 244, 255],
];
/** Piedra clara y tibia del borde (nada de gris frío). */
const COPING: Ramp = [mix(C.stone[1]!, C.cream[1]!, 0.5), mix(C.stone[2]!, C.cream[2]!, 0.55), mix(C.stone[3]!, C.cream[3]!, 0.6), mix(C.stone[4]!, C.cream[4]!, 0.6), C.cream[5]!];

/** La pileta en unidades de arte (relativa al deck). */
const B = { x0: POOL_BASIN.x * L, y0: POOL_BASIN.y * L, x1: (POOL_BASIN.x + POOL_BASIN.w) * L, y1: (POOL_BASIN.y + POOL_BASIN.d) * L };
/** Ancho del borde de piedra (dentro del tile de la pileta) y a qué altura queda el agua. */
const LIP = 3;
const WATER_Z = -4;
const DECK_Z = 1;

/** Agua de la pileta en (x, y) (arte, relativo al deck): lo hondo al oeste (el trampolín), las baldosas del fondo y la franja de nado. */
function poolWater(x: number, y: number, night: boolean): RGBA {
  const u = x - B.x0 - LIP;
  const v = y - B.y0 - LIP;
  const W = B.x1 - B.x0 - LIP * 2;
  const D = B.y1 - B.y0 - LIP * 2;
  // Contra las paredes del fondo (norte y oeste) el agua queda en sombra.
  if (u < 2.5 || v < 2.5) return at(POOL_WATER, night ? 2 : 1);
  const deep = 1 - u / W;
  // Baldosas del fondo vistas a través del agua y la franja oscura del medio.
  const grid = u % 8 < 0.7 || v % 8 < 0.7;
  const lane = Math.abs(v - D / 2) < 1.6 && u > 8 && u < W - 8;
  const n = smoothNoise(x, y, 9, 71) * 0.8 + (bayer(Math.floor(x), Math.floor(y)) - 0.5) * 0.35;
  let k = 3 - deep * 1.6 + n * 0.8 + (night ? 0.8 : 0);
  if (grid) k += 0.5;
  if (lane) k -= 1.2;
  return at(POOL_WATER, Math.max(0, Math.min(4, Math.round(k))));
}

/** Tablas del deck a lo largo de x, con juntas y clavos. */
function deckPlank(x: number, y: number): RGBA {
  const row = Math.floor(y / 4);
  const off = noise(row, 1, 5) * 30;
  if (y % 4 < 0.7) return at(C.woodDark, 2);
  const seg = Math.floor((x + off) / 30);
  if ((x + off) % 30 < 0.6) return at(C.woodDark, 3);
  if ((x + off) % 30 > 28.5 && y % 4 > 1.4 && y % 4 < 2.4) return at(C.woodDark, 2);
  const t = noise(seg, row, 9);
  return at(C.wood, t < 0.2 ? 3 : t > 0.75 ? 5 : 4);
}

/** Losa del borde de piedra, con juntas cada tanto. */
function copingStone(u: number, seed: number): RGBA {
  if (u % 10 < 0.6) return at(COPING, 1);
  return at(COPING, noise(Math.floor(u / 10), seed, 13) < 0.3 ? 2 : 3);
}

/** Piedra de las paredes de adentro de la pileta, con la línea del agua. */
function wallStone(u: number, v: number, depth: number): RGBA {
  const row = Math.floor(v / 2.5);
  if ((u + (row % 2) * 5) % 10 < 0.6 || v % 2.5 < 0.5) return at(COPING, 0);
  return mix(at(COPING, 2), at(POOL_WATER, 1), depth);
}

/**
 * La piscina entera (15x13 tiles, plana): el deck de tablas con su borde, la pileta de piedra con las
 * escaleritas en dos rincones y el agua turquesa. De noche, las luces de adentro prendidas.
 */
export function drawPool(night: boolean): Sprite {
  const [w, d] = POOL_SIZE;
  const s = scene(w, d, 14, 4, -10);
  const W = w * L;
  const D = d * L;
  // El deck: tablas con un listón de borde y el canto que se ve al frente.
  const inBasin = (x: number, y: number) => x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1;
  s.box(0, 0, 0, W, D, DECK_Z, (x, y) => (inBasin(x, y) ? null : x < 2 || y < 2 || x > W - 2 || y > D - 2 ? at(C.woodDark, 4) : deckPlank(x, y)), (u) => at(C.woodDark, Math.floor(u) % 16 === 0 ? 1 : 3), (u) => at(C.woodDark, Math.floor(u) % 16 === 0 ? 0 : 2));
  // Hueco de la pileta: paredes de piedra por dentro (se ven las del fondo) y el agua.
  s.borde = false;
  const ix0 = B.x0 + LIP;
  const iy0 = B.y0 + LIP;
  const ix1 = B.x1 - LIP;
  const iy1 = B.y1 - LIP;
  // Pared norte (mira a +y) y pared oeste (mira a +x): de la línea del agua hasta el borde.
  s.quad([ix0, iy0, WATER_Z], [1, 0, 0], [0, 0, 1], ix1 - ix0, DECK_Z - WATER_Z + 1, (u, v) => wallStone(u, v, v < 1.2 ? 0.6 : 0));
  s.quad([ix0, iy0, WATER_Z], [0, 1, 0], [0, 0, 1], iy1 - iy0, DECK_Z - WATER_Z + 1, (u, v) => wallStone(u + 3, v, v < 1.2 ? 0.6 : 0.2));
  s.quad([ix0, iy0, WATER_Z], [1, 0, 0], [0, 1, 0], ix1 - ix0, iy1 - iy0, (u, v) => poolWater(ix0 + u, iy0 + v, night));
  s.borde = true;
  // Luces de adentro del agua (en la pared del fondo): de noche, un halo en el agua.
  for (const lx of [0.2, 0.5, 0.8]) {
    const x = ix0 + (ix1 - ix0) * lx;
    s.quad([x - 2, iy0 + 0.1, WATER_Z - 0.5], [1, 0, 0], [0, 0, 1], 4, 2, (u, v) => (night ? at(C.cyan, u > 1 && u < 3 && v > 0.5 ? 5 : 4) : at(COPING, u > 1 && u < 3 ? 4 : 3)));
    if (night)
      for (let r = 0; r < 9; r += 0.5)
        for (let a = 0; a < Math.PI; a += 0.25) {
          const px = x + Math.cos(a) * r * 1.4;
          const py = iy0 + 1 + Math.sin(a) * r;
          if (py < iy1 && bayer(Math.floor(px * 2), Math.floor(py * 2)) < 1 - r / 9) s.plot(px, py, WATER_Z + 0.05, alpha(at(C.cyan, 5), 0.35));
        }
  }
  // Las escaleritas de piedra: tres escalones que bajan al agua desde el borde.
  for (const [tx, ty] of POOL_STEPS) {
    const sx = tx * L + 1;
    const southWall = ty === POOL_BASIN.y + POOL_BASIN.d - 1;
    for (let k = 0; k < 3; k++) {
      const z = DECK_Z - 1.5 - k * 1.6;
      if (southWall) s.box(sx + LIP - 1, iy1 - 4 - k * 4, z - 1.6, L - LIP, 4, 1.6, flatT(at(COPING, 4 - (k === 2 ? 1 : 0))), flatT(at(COPING, 2)), flatT(at(COPING, 1)));
      else s.box(sx, iy0, z - 1.6, L - LIP - 1, 4 + k * 4, 1.6, flatT(at(COPING, 4 - (k === 2 ? 1 : 0))), flatT(at(COPING, 2)), flatT(at(COPING, 1)));
    }
    // Pasamanos de bronce a cada lado de la escalera.
    for (const side of [2, L - LIP - 2]) {
      const x = sx + side;
      const y0 = southWall ? iy1 : iy0;
      const dir = southWall ? -1 : 1;
      for (let t = 0; t <= 1; t += 0.04) {
        const yy = y0 + dir * (t * 7);
        const zz = DECK_Z + 9 * Math.sin(Math.min(1, t * 1.6) * (Math.PI / 2)) - (t > 0.62 ? (t - 0.62) * 22 : 0);
        s.plot(x, yy, zz, at(C.gold, t < 0.5 ? 4 : 3));
      }
    }
  }
  // Borde de piedra alrededor de la pileta (encima del deck, un poquito más alto).
  s.box(B.x0, B.y0, 0, B.x1 - B.x0, LIP, DECK_Z + 1, (u) => copingStone(u, 1), null, null);
  s.box(B.x0, B.y1 - LIP, 0, B.x1 - B.x0, LIP, DECK_Z + 1, (u) => copingStone(u, 2), (u) => at(COPING, Math.floor(u) % 10 === 0 ? 0 : 2), null);
  s.box(B.x0, B.y0 + LIP, 0, LIP, B.y1 - B.y0 - LIP * 2, DECK_Z + 1, (_u, v) => copingStone(v, 3), null, null);
  s.box(B.x1 - LIP, B.y0 + LIP, 0, LIP, B.y1 - B.y0 - LIP * 2, DECK_Z + 1, (_u, v) => copingStone(v, 4), null, (u) => at(COPING, Math.floor(u) % 10 === 0 ? 0 : 1));
  // Un par de toallas tiradas y unas chanclas en el deck, para que se vea usado.
  s.box(W - 30, 26, DECK_Z, 12, 7, 0.6, (u) => at(u % 4 < 2 ? C.rose : C.cream, 4), null, null);
  s.box(20, D - 22, DECK_Z, 3, 6, 0.5, flatT(at(C.fabric, 3)), null, null);
  s.box(25, D - 21, DECK_Z, 3, 6, 0.5, flatT(at(C.fabric, 3)), null, null);
  return s.sprite();
}

/**
 * Lo que brilla y se mueve sobre el agua (el cliente cicla los cuadros): rayitas de luz que ondulan. Tiene
 * el mismo origen que la piscina, así que va en el mismo lugar.
 */
export const POOL_SHIMMER_FRAMES = 4;
export function poolShimmer(frame: number, night = false): Sprite {
  // Sin contorno (son brillos sobre el agua, no un objeto): se pinta directo en un lienzo propio.
  const ix0 = B.x0 + LIP;
  const iy0 = B.y0 + LIP;
  const ix1 = B.x1 - LIP;
  const iy1 = B.y1 - LIP;
  const corners = [toScreen(ix0, iy0, WATER_Z), toScreen(ix1, iy0, WATER_Z), toScreen(ix0, iy1, WATER_Z), toScreen(ix1, iy1, WATER_Z)];
  const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
  const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;
  const canvas = new PixelCanvas(maxX - minX + 1, maxY - minY + 1);
  const ox = -minX;
  const oy = -minY;
  const ph = (frame / POOL_SHIMMER_FRAMES) * Math.PI * 2;
  const bright = alpha(at(POOL_WATER, 5), night ? 0.8 : 0.65);
  const soft = alpha(at(POOL_WATER, 4), night ? 0.6 : 0.45);
  for (let py = 0; py < canvas.height; py++)
    for (let px = 0; px < canvas.width; px++) {
      // Del píxel al punto del agua (z = WATER_Z) que se ve ahí.
      const sx = px + 0.5 - ox;
      const sy = py + 0.5 - oy + WATER_Z;
      const x = sy + sx / 2;
      const y = sy - sx / 2;
      if (x < ix0 + 3 || x > ix1 - 1 || y < iy0 + 3 || y > iy1 - 1) continue;
      // Cáusticas: dos ondas cruzadas que se corren con el cuadro.
      const a = Math.sin(x * 0.45 + ph + Math.sin(y * 0.3 + ph) * 1.6);
      const b = Math.sin(y * 0.55 - ph * 0.7 + Math.sin(x * 0.25 - ph) * 1.4);
      const v = a * b;
      if (v > 0.84) canvas.set(px, py, bright);
      else if (v > 0.72 && bayer(px, py) < 0.35) canvas.set(px, py, soft);
    }
  return { canvas, ox, oy };
}

/** La lona de la lluvia sobre la pileta: tela verde oliva atada al borde, con charcos y la tela que se hunde. */
export function poolCover(): Sprite {
  const [w, d] = POOL_SIZE;
  const s = scene(w, d, 14, 4, -10);
  const x0 = B.x0 + 1;
  const y0 = B.y0 + 1;
  const x1 = B.x1 - 1;
  const y1 = B.y1 - 1;
  const canvas: Ramp = C.sage;
  s.plot(0, 0, 0, alpha(at(canvas, 3), 0.01));
  s.plot(w * L, d * L, DECK_Z, alpha(at(canvas, 3), 0.01));
  for (let y = y0; y < y1; y += 0.4)
    for (let x = x0; x < x1; x += 0.4) {
      const u = (x - x0) / (x1 - x0);
      const v = (y - y0) / (y1 - y0);
      // Se hunde en el medio (el agua de la lluvia la estira).
      const sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
      const z = DECK_Z + 1.5 - sag * 3;
      const seam = Math.abs(((x - x0) % 36) - 18) < 0.4;
      // Tela gruesa: tramado leve y pliegues que bajan hacia el medio.
      const fold = Math.abs(Math.sin(u * 23 + v * 3) * Math.sin(v * 11)) > 0.93;
      let c = at(canvas, (sag > 0.85 ? 1 : sag > 0.5 ? 2 : 3) + (bayer(Math.floor(x * 2), Math.floor(y * 2)) < 0.12 ? 1 : 0));
      if (fold) c = at(canvas, sag > 0.5 ? 1 : 2);
      if (seam) c = at(canvas, 1);
      // Charco en lo hundido, con un brillo.
      if (sag > 0.9) c = mix(at(C.sky, 2), at(canvas, 2), 0.35);
      if (sag > 0.9 && noise(Math.floor(x), Math.floor(y), 4) < 0.08) c = at(C.sky, 4);
      s.plot(x, y, z, c);
    }
  // Ojales de bronce con una cuerda que va a una estaca en el deck.
  const tie = (x: number, y: number, dx: number, dy: number) => {
    s.plot(x, y, DECK_Z + 1.6, at(C.gold, 4));
    for (let k = 0; k < 5; k += 0.4) s.plot(x + dx * k, y + dy * k, DECK_Z + 1.5 - k * 0.2, at(C.cork, 3));
    s.plot(x + dx * 5, y + dy * 5, DECK_Z + 0.6, at(C.woodDark, 2));
  };
  for (let x = x0 + 9; x < x1 - 4; x += 18) {
    tie(x, y1, 0, 1);
    tie(x, y0, 0, -1);
  }
  for (let y = y0 + 9; y < y1 - 4; y += 18) {
    tie(x0, y, -1, 0);
    tie(x1, y, 1, 0);
  }
  return s.sprite();
}

// ---------- Trampolín, reposeras, sombrilla, ducha y toallero ----------

/** Trampolín: pedestal de piedra con una tabla de madera que sale sobre el agua hacia +x. */
function divingBoard(): Sprite {
  const s = scene(3, 1, 26, 6);
  s.shadow(2, 3, 12, 10, 0.25);
  s.box(2, 3, 0, 11, 10, 7, flatT(at(COPING, 4)), (u, v) => (v % 3 < 0.5 ? at(COPING, 1) : at(COPING, u % 5 < 0.5 ? 1 : 3)), (u, v) => (v % 3 < 0.5 ? at(COPING, 0) : at(COPING, u % 5 < 0.5 ? 0 : 2)));
  // La tabla: se curva apenas hacia la punta, con una franja de lija clara.
  for (let x = 4; x < 44; x += 0.4) {
    const k = Math.max(0, (x - 12) / 32);
    const z = 8 + k * k * 1.5;
    for (let y = 5.5; y < 10.5; y += 0.4) s.plot(x, y, z + 1, at(C.wood, Math.abs(y - 8) < 1.2 && x > 14 ? 5 : 4));
    s.plot(x, 10.5, z, at(C.wood, 2));
    s.plot(x, 10.5, z + 0.5, at(C.wood, 3));
  }
  // Soporte de madera bajo la tabla.
  s.solid(12, 6, 0, 2, 4, 8, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  return s.sprite();
}

/** Reposera de listones: el respaldo en el tile del asiento (x 0) y la cama hacia +x, con cojín a rayas. */
function sunLounger(v: "front" | "back"): Sprite {
  const s = scene(2, 1, 22, 4);
  const back = v === "back";
  // De espaldas, el respaldo queda en el otro extremo (+x).
  const X = (x: number) => (back ? 32 - x : x);
  const bx0 = Math.min(X(3), X(29));
  s.shadow(bx0, 3, 26, 10, 0.25);
  for (const lx of [4, 27]) for (const ly of [3.5, 11]) s.solid(X(lx) - 0.75, ly, 0, 1.5, 1.5, 4, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  s.box(bx0, 3, 4, 26, 10, 1.5, (u) => at(C.wood, u % 3 < 0.6 ? 2 : 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  // Cojín a rayas (turquesa y crema) sobre la cama.
  s.box(Math.min(X(11), X(29)), 4, 5.5, 18, 8, 1.2, (u) => at(Math.floor((back ? 18 - u : u) / 3) % 2 ? C.cream : C.cyan, 4), flatT(at(C.cyan, 3)), flatT(at(C.cyan, 2)));
  // Respaldo reclinado: sube desde la cama hacia la cabecera, con su marco y el apoyo de atrás.
  for (let t = 0; t < 1; t += 0.025) {
    const x = X(11 - t * 8);
    const z = 5.5 + t * 10;
    for (let y = 4; y < 12; y += 0.4) s.plot(x, y, z + 0.8, at(Math.floor(t * 9) % 3 === 0 ? C.cream : C.cyan, t > 0.9 ? 5 : 4));
    s.plot(x, 3.4, z, at(C.wood, 3));
    s.plot(x, 12.2, z, at(C.wood, 2));
  }
  for (const ly of [4, 11]) for (let t = 0; t < 1; t += 0.05) s.plot(X(4 + t * 2), ly, 4 + t * 9, at(C.wood, 2));
  // Toalla doblada al pie.
  s.box(Math.min(X(24), X(29)), 5, 6.7, 5, 6, 1.4, flatT(at(C.rose, 4)), flatT(at(C.rose, 3)), flatT(at(C.rose, 2)));
  return s.sprite();
}

/** Sombrilla a rayas de terracota y crema, con su base de piedra. */
function parasol(): Sprite {
  const s = scene(1, 1, 50, 18);
  s.roundShadow(8, 8, 12, 0.18);
  s.cylinder(8, 8, 0, 3.5, 2.5, (_a, _v, luz) => at(COPING, luz > 0 ? 3 : 2));
  s.disc(8, 8, 2.5, 3.5, () => at(COPING, 4));
  s.solid(7.5, 7.5, 2.5, 1, 1, 36, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  const stripe = (ang: number) => Math.floor((ang + 4) * 2.55) % 2;
  s.cone(8, 8, 36, 17, 7, (ang, _sl, luz) => (stripe(ang) ? at(C.terracotta, luz > 0 ? 4 : 3) : at(C.cream, luz > 0 ? 5 : 4)));
  s.cylinder(8, 8, 34.5, 17, 1.5, (ang) => (stripe(ang) ? at(C.terracotta, 2) : at(C.cream, 3)));
  s.disc(8, 8, 43.5, 1.2, () => at(C.wood, 5));
  return s.sprite();
}

/** Ducha de jardín: poste de madera con el caño de bronce, la regadera y una tarima de listones. */
function gardenShower(): Sprite {
  const s = scene(1, 1, 46, 8);
  s.box(2, 2, 0, 12, 12, 1.5, (u) => at(C.wood, u % 3 < 0.7 ? 2 : 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  s.solid(3, 3, 1.5, 2.5, 2.5, 38, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Caño de bronce que sube por el poste y sale hacia adelante.
  for (let z = 4; z < 38; z += 0.5) s.plot(5.8, 4.2, z, at(C.gold, z % 6 < 0.6 ? 2 : 3));
  for (let x = 5.8; x < 11; x += 0.4) s.plot(x, 4.2 + (x - 5.8) * 0.8, 38, at(C.gold, 3));
  s.cylinder(11, 8.5, 35, 2.4, 2, (_a, _v, luz) => at(C.gold, luz > 0 ? 4 : 2));
  s.disc(11, 8.5, 35, 2.4, (dx, dy) => (Math.abs(dx) + Math.abs(dy) < 1.5 ? at(C.gold, 1) : at(C.gold, 2)));
  // Biombo de listones detrás, para que no se vea tan pelado.
  for (let y = 3; y < 14; y += 2.2) s.solid(1.5, y, 1.5, 1.2, 1.6, 30, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  // La llave y unas piedritas del desagüe.
  s.solid(5.5, 4.5, 16, 2, 1.2, 1.2, at(C.gold, 4), at(C.gold, 3), at(C.gold, 2));
  for (let i = 0; i < 10; i++) s.plot(6 + noise(i, 1, 3) * 7, 7 + noise(i, 2, 3) * 6, 1.6, at(COPING, 2 + (i % 2)));
  return s.sprite();
}

/** Toallero de madera: dos patas y dos barras, con una toalla a rayas en cada una. */
function towelRack(): Sprite {
  const s = scene(1, 1, 30, 6);
  s.shadow(3, 5, 11, 7, 0.22);
  for (const x of [3, 12.5]) {
    s.solid(x, 7.5, 0, 1.5, 1.5, 22, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
    s.solid(x - 1, 6, 0, 3.5, 4.5, 1.2, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  }
  s.solid(3, 7.5, 21, 11, 1.5, 1.2, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  s.solid(3, 7.5, 13, 11, 1.5, 1.2, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  // Toallas dobladas sobre las barras: cuelgan a los dos lados, delgadas.
  const towel = (z: number, x0: number, w: number, r: Ramp, r2: Ramp) => {
    for (const [y, dark] of [
      [6.6, 1],
      [9.4, 0],
    ] as const)
      s.quad([x0, y, z - 8], [1, 0, 0], [0, 0, 1], w, 8.6, (u, v) => at(Math.floor(u / 2) % 3 === 0 ? r2 : r, (v > 7.5 ? 5 : 4) - dark));
    s.quad([x0, 6.6, z + 0.6], [1, 0, 0], [0, 1, 0], w, 2.8, (u) => at(Math.floor(u / 2) % 3 === 0 ? r2 : r, 5));
  };
  towel(21, 4.5, 8, C.cream, C.rug);
  towel(13, 5.5, 6, C.cyan, C.cream);
  return s.sprite();
}

// ---------- Lo que anima el cliente ----------

/** Flotadores que se mecen en el agua: la dona a rayas y el flamenco. */
export type PoolFloatKind = "dona" | "flamenco";
export function poolFloat(kind: PoolFloatKind): PixelCanvas {
  const c = new PixelCanvas(18, 14);
  if (kind === "dona") {
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 18; x++) {
        const nx = (x + 0.5 - 9) / 8;
        const ny = (y + 0.5 - 7) / 4.2;
        const r = Math.hypot(nx, ny);
        if (r > 1 || r < 0.45) continue;
        const ang = Math.atan2(ny, nx);
        const band = Math.floor((ang + 4) * 1.6) % 2;
        const shade = ny < -0.2 ? 5 : ny > 0.4 ? 3 : 4;
        c.set(x, y, band ? at(C.rose, shade) : at(C.cream, shade));
      }
  } else {
    // Flamenco: cuerpo redondo rosado, cuello en curva y la cabecita con el pico.
    c.ellipse(8, 9, 7, 3.6, at(C.rose, 4));
    c.ellipse(7, 8, 5, 2, at(C.rose, 5));
    for (let k = 0; k < 7; k++) c.set(13 + Math.round(Math.sin(k * 0.5)), 8 - k, at(C.rose, 3));
    c.rect(13, 1, 3, 2, at(C.rose, 4));
    c.set(16, 2, at(C.woodDark, 2));
    c.set(14, 1, OUT);
  }
  c.outline(OUT);
  return c;
}

/** Gotita de agua (salpicadura y gotas de quien sale mojado). */
export function waterDroplet(): PixelCanvas {
  const c = new PixelCanvas(2, 3);
  c.set(0, 0, at(C.sky, 4));
  c.set(0, 1, at(C.sky, 3));
  c.set(1, 1, at(C.sky, 4));
  c.set(0, 2, at(C.sky, 2));
  c.set(1, 2, at(C.sky, 3));
  return c;
}

/** Anillo de onda en el agua (el cliente lo agranda y lo desvanece). */
export function waterRing(rx: number, ry: number): PixelCanvas {
  const c = new PixelCanvas(rx * 2 + 2, ry * 2 + 2);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x + 0.5 - c.width / 2) / rx, (y + 0.5 - c.height / 2) / ry);
      if (Math.abs(d - 0.9) < 0.12) c.set(x, y, alpha(at(POOL_WATER, 5), y < c.height / 2 ? 0.55 : 0.9));
    }
  return c;
}

export const AGUA_DRAW: Record<string, (v: "front" | "back") => Sprite> = {
  "diving-board": divingBoard,
  "sun-lounger": sunLounger,
  parasol,
  "garden-shower": gardenShower,
  "towel-rack": towelRack,
};
