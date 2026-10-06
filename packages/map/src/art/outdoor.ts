// Arte del jardín: la cabaña, árboles y objetos de afuera. Coordenadas locales de arte (tile = 16).
import { drawHouse, HOUSE_CHIMNEY_TOP } from "./exterior-casa";
import { gazeboRoof } from "./exterior-patio";
import { drawGarage } from "./garaje-exterior";
import { drawTreeHouse } from "./casa-arbol-exterior";
import { drawBusStation } from "./bus";
import { drawPool } from "./agua";
import { SAUNA_CHIMNEY_TOP, TINA_NIGHT, TUB_CHIMNEY_TOP } from "./tina";
import { stageShell } from "./escenario";
import { drawObservatory } from "./observatorio-exterior";
import { CASA_FINCA_CHIMNEY_TOP, CASA_PROPIA_NIGHT } from "./casa-propia-exterior";
import { BRUJAS_NIGHT } from "./brujas";
import { VELITAS_NIGHT } from "./velitas";
import { FERIA_NIGHT } from "./feria-flores";
import { ANO_VIEJO_NIGHT } from "./ano-viejo";
import { NOVENAS_NIGHT } from "./novenas";
import { C, OUT, SHADOW, inRect, mix } from "./palette";
import { edgeOf, gridSprite, groundShadow, rampLegend } from "./grilla";
import {
  alpha,
  at,
  bayer,
  flat,
  floorDiamond,
  noise,
  renderSprite,
  solidBox,
  splat,
  type Box,
  type PixelCanvas,
  type Project,
  type RGBA,
  type Shader,
  type Sprite,
} from "./pixel";

const shadowUnder =
  (x: number, y: number, w: number, d: number, a = 0.3) =>
  (c: PixelCanvas, p: Project) =>
    floorDiamond(c, p, x - 1, y - 1, w + 3, d + 3, alpha(SHADOW, a));

const volume = (x: number, y: number, z: number, w: number, d: number, h: number): Box => ({ x, y, z, w, d, h });

// ---------- Cabaña ----------
// Dos plantas, 16x10 tiles = 256x160 unidades. Se ve la fachada +y (puerta, porche con balcón y
// ventanas) y el hastial +x.

const CW = 256;
const CD = 160;
/** Altura de las paredes (dos pisos) y de la viga entre plantas. */
const WALL = 88;
const FLOOR_BEAM = 44;
const RIDGE_Y = CD / 2;
const RIDGE_Z = WALL + 52;
const EAVE = 10;
const SLOPE = (RIDGE_Z - WALL) / (RIDGE_Y + EAVE);
const DOOR = { u0: 116, u1: 140, h: 36 };
const GROUND = { v0: 14, v1: 36 };
const UPPER = { v0: 56, v1: 78 };
const FRONT_GROUND_WINDOWS = [
  { u0: 22, u1: 50 },
  { u0: 64, u1: 92 },
  { u0: 164, u1: 192 },
  { u0: 206, u1: 234 },
];
const FRONT_UPPER_WINDOWS = [
  { u0: 28, u1: 54 },
  { u0: 108, u1: 148 },
  { u0: 202, u1: 228 },
];
const SIDE_WINDOWS = [
  { u0: 30, u1: 56 },
  { u0: 104, u1: 130 },
];
const CHIMNEY = { x: 40, y: 34, w: 20, top: RIDGE_Z + 24 };

/** Tope de la chimenea en coordenadas locales de arte (para el humo que anima el cliente). */
export const CABIN_CHIMNEY_TOP = { x: CHIMNEY.x + CHIMNEY.w / 2, y: CHIMNEY.y + CHIMNEY.w / 2, z: CHIMNEY.top + 3 };

/** Chimeneas con humo por tipo de mueble: la cabaña vieja (vitrina del login) y la casa del jardín. */
export const CHIMNEY_TOPS: Record<string, { x: number; y: number; z: number }> = {
  cabin: CABIN_CHIMNEY_TOP,
  house: HOUSE_CHIMNEY_TOP,
  // La tina y la sauna del lago: sus estufas de leña.
  "hot-tub": TUB_CHIMNEY_TOP,
  "sauna-shell": SAUNA_CHIMNEY_TOP,
  // La casona de cada persona.
  "casa-finca": CASA_FINCA_CHIMNEY_TOP,
};

/** Troncos horizontales: bandas con luz arriba y sombra abajo, y basa de piedra. */
function logs(u: number, v: number, seed: number): RGBA {
  if (v < 6) {
    const row = Math.floor(v / 3);
    if (Math.floor(v) % 3 === 0 || (Math.floor(u) + row * 4) % 8 === 0) return at(C.stone, 1);
    return at(C.stone, 2 + Math.floor(noise(Math.floor(u / 8), row, seed) * 2));
  }
  // Viga entre plantas.
  if (v >= FLOOR_BEAM && v < FLOOR_BEAM + 4) return at(C.woodDark, v >= FLOOR_BEAM + 3 ? 4 : 2);
  const k = (v - 6) % 6;
  const log = Math.floor((v - 6) / 6);
  const tone = noise(log, Math.floor(u / 40), seed) < 0.5 ? 0 : 1;
  if (k < 1) return at(C.logs, 0);
  if (k < 2) return at(C.logs, 2 + tone);
  if (k >= 5) return at(C.logs, 1);
  // Algún nudo suelto en la madera (de 2 px, sin que parezcan agujeros).
  if (k >= 2 && k < 4 && noise(Math.floor(u / 2), log, seed + 1) < 0.015) return at(C.logs, 2);
  return at(C.logs, 3 + tone);
}

type Pane = { u0: number; u1: number };
type Row = { v0: number; v1: number };
const SHUTTER = 5;

/** Vidrio: de día refleja el cielo (con destellos diagonales); de noche, luz cálida de adentro. */
function glass(u: number, v: number, w: Pane, row: Row, night: boolean): RGBA {
  const t = (v - row.v0) / (row.v1 - row.v0);
  // Cortinas recogidas a los lados y una cenefa arriba.
  const edge = Math.min(u - w.u0, w.u1 - u);
  if (v >= row.v1 - 4 || edge < 4 - t * 2) {
    const fold = Math.floor(u) % 2 === 0;
    return night ? mix(at(C.curtain, fold ? 3 : 4), at(C.gold, 4), 0.35) : at(C.curtain, fold ? 2 : 3);
  }
  if (night) return at(C.gold, t > 0.6 ? 5 : t > 0.25 ? 4 : 3);
  const d = (u - w.u0) - (v - row.v0) * 0.9;
  if (Math.abs(d - 6) < 0.8 || Math.abs(d - 9) < 0.5) return at(C.sky, 4);
  return at(C.sky, t > 0.55 ? 3 : 2);
}

const FLOWERS = [at(C.rug, 4), at(C.gold, 5), at(C.rose, 5), at(C.white, 4), at(C.blue, 4)];

/**
 * Ventana de cabaña: postigos verdes, marco de madera oscura con moldura crema, dintel, alféizar
 * con sombra y, en la planta baja, jardinera con flores.
 */
function windowPane(u: number, v: number, w: Pane, row: Row, box: boolean, night: boolean): RGBA | null {
  const { v0, v1 } = row;
  if (box) {
    // Flores asomando sobre la jardinera: tallos y hojas verdes, flores de colores.
    if (inRect(u, v, w.u0 - 2, v0 - 6, w.u1 + 2, v0 - 2)) {
      const col = Math.floor(u);
      const n = noise(col, 0, 8);
      const height = v0 - 6 + 2 + n * 2;
      if (v > height) return null;
      if (v > height - 1.2 && col % 3 === 0) return FLOWERS[Math.floor(noise(col, 1, 9) * FLOWERS.length)]!;
      return at(C.leaf, col % 2 ? 3 : 2);
    }
    if (inRect(u, v, w.u0 - 3, v0 - 10, w.u1 + 3, v0 - 6)) {
      if (v >= v0 - 7) return at(C.wood, 4);
      return at(C.wood, Math.floor(u) % 6 === 0 ? 1 : 2);
    }
  }
  // Alféizar con su sombra debajo.
  if (inRect(u, v, w.u0 - 3, v0 - 2, w.u1 + 3, v0)) return at(C.cream, v >= v0 - 1 ? 5 : 2);
  if (!box && inRect(u, v, w.u0 - 2, v0 - 3, w.u1 + 2, v0 - 2)) return at(C.logs, 0);
  // Dintel.
  if (inRect(u, v, w.u0 - 2, v1, w.u1 + 2, v1 + 3)) return at(C.woodDark, v >= v1 + 2 ? 4 : 2);
  // Postigos.
  const inLeft = inRect(u, v, w.u0 - 1 - SHUTTER, v0, w.u0 - 1, v1);
  const inRight = inRect(u, v, w.u1 + 1, v0, w.u1 + 1 + SHUTTER, v1);
  if (inLeft || inRight) {
    const outer = inLeft ? u < w.u0 - SHUTTER : u >= w.u1 + SHUTTER;
    if (outer || Math.floor(v) === v0 || Math.floor(v) === v1 - 1) return at(C.green, 1);
    return at(C.green, Math.floor(v - v0) % 3 === 0 ? 2 : 3);
  }
  if (!inRect(u, v, w.u0 - 1, v0, w.u1 + 1, v1)) return null;
  // Marco: borde oscuro y moldura crema.
  if (u < w.u0 || u >= w.u1) return at(C.woodDark, 1);
  if (u < w.u0 + 2 || u >= w.u1 - 2 || v < v0 + 2 || v >= v1 - 2) return at(C.cream, u < w.u0 + 1 || v >= v1 - 1 ? 4 : 3);
  const mid = (w.u0 + w.u1) / 2;
  if (Math.abs(u - mid) < 1 || Math.abs(v - (v0 + v1) / 2) < 0.8) return at(C.cream, 3);
  return glass(u, v, w, row, night);
}

function frontFacade(night: boolean): Shader {
  return (u, v) => {
    // Puerta con marco, pomo y ventanita.
    if (inRect(u, v, DOOR.u0 - 3, 0, DOOR.u1 + 3, DOOR.h + 3)) {
      if (u < DOOR.u0 || u >= DOOR.u1 || v >= DOOR.h) return at(C.woodDark, v >= DOOR.h + 2 ? 4 : 3);
      if (inRect(u, v, DOOR.u1 - 6, 16, DOOR.u1 - 4, 18)) return at(C.gold, 4);
      const plank = Math.floor((u - DOOR.u0) / 6);
      if ((u - DOOR.u0) % 6 < 1) return at(C.woodDark, 1);
      if (inRect(u, v, DOOR.u0 + 6, 24, DOOR.u1 - 6, 32)) return night ? at(C.gold, 4) : at(C.sky, v > 28 ? 3 : 2);
      return at(C.woodDark, 2 + (plank % 2));
    }
    for (const w of FRONT_GROUND_WINDOWS) {
      const c = windowPane(u, v, w, GROUND, true, night);
      if (c) return c;
    }
    for (const w of FRONT_UPPER_WINDOWS) {
      const c = windowPane(u, v, w, UPPER, false, night);
      if (c) return c;
    }
    return logs(u, v, 3);
  };
}

function gableSide(night: boolean): Shader {
  return (u, v) => {
    for (const w of SIDE_WINDOWS) {
      const c = windowPane(u, v, w, GROUND, true, night) ?? windowPane(u, v, w, UPPER, false, night);
      if (c) return c;
    }
    return logs(u, v, 9);
  };
}

/** Ventanita redonda del ático: aro de madera, cruz y vidrio (cielo de día, luz de noche). */
function atticWindow(dy: number, dz: number, night: boolean): RGBA | null {
  const d = Math.hypot(dy, dz * 1.1);
  if (d >= 8) return null;
  if (d >= 6.5) return at(C.woodDark, dz > 0 ? 3 : 1);
  if (d >= 5.5) return at(C.cream, 3);
  if (Math.abs(dy) < 0.8 || Math.abs(dz) < 0.7) return at(C.cream, 3);
  return night ? at(C.gold, dz > 0 ? 5 : 4) : at(C.sky, dz > 0 ? 3 : 2);
}

/** Tejas: hileras escalonadas siguiendo la pendiente. */
function shingle(u: number, t: number, front: boolean): RGBA {
  const row = Math.floor(t / 5);
  const k = t % 5;
  const off = row % 2 ? 4 : 0;
  if (k < 1) return at(C.roof, front ? 1 : 0);
  if ((Math.floor(u) + off) % 8 === 0) return at(C.roof, front ? 2 : 1);
  const n = noise(Math.floor((u + off) / 8), row, 4);
  return at(C.roof, (front ? 3 : 2) + (n < 0.2 ? -1 : n > 0.85 ? 1 : 0));
}

const stoneWall: Shader = (u, v) =>
  at(C.stone, Math.floor(v) % 5 === 0 || (Math.floor(u) + (Math.floor(v / 5) % 2) * 3) % 6 === 0 ? 1 : 3);
const stoneWallDark: Shader = (u, v) =>
  at(C.stone, Math.floor(v) % 5 === 0 || (Math.floor(u) + (Math.floor(v / 5) % 2) * 3) % 6 === 0 ? 0 : 2);

function cabin(night: boolean): Sprite {
  const walls: Box[] = [
    { x: 0, y: 0, z: 0, w: CW, d: CD, h: WALL, top: flat(at(C.logs, 1)), left: frontFacade(night), right: gableSide(night) },
    // Esquina con las puntas de los troncos.
    solidBox({ x: CW - 4, y: CD - 4, z: 0, w: 6, d: 6, h: WALL }, C.logs, 4),
  ];
  // Porche con balcón encima: piso, pilares, losa del balcón y baranda.
  const px0 = DOOR.u0 - 20;
  const px1 = DOOR.u1 + 20;
  const railPosts: Box[] = [];
  for (let x = px0 + 2; x < px1 - 2; x += 10) railPosts.push(solidBox({ x, y: CD + 12, z: 49, w: 2, d: 2, h: 9 }, C.wood, 4));
  const porch: Box[] = [
    { x: px0, y: CD, z: 0, w: px1 - px0, d: 14, h: 3, top: (u) => at(C.wood, Math.floor(u) % 6 === 0 ? 2 : 4), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
    solidBox({ x: px0 + 2, y: CD + 11, z: 3, w: 3, d: 3, h: 43 }, C.woodDark, 4),
    solidBox({ x: px1 - 5, y: CD + 11, z: 3, w: 3, d: 3, h: 43 }, C.woodDark, 4),
    { x: px0 - 2, y: CD, z: 46, w: px1 - px0 + 4, d: 15, h: 3, top: (u) => at(C.wood, Math.floor(u) % 6 === 0 ? 2 : 4), left: flat(at(C.woodDark, 3)), right: flat(at(C.woodDark, 2)) },
    ...railPosts,
    { x: px0, y: CD + 12, z: 57, w: px1 - px0, d: 2, h: 2, top: flat(at(C.wood, 5)), left: flat(at(C.wood, 3)), right: flat(at(C.wood, 4)) },
    solidBox({ x: px0, y: CD, z: 49, w: 2, d: 14, h: 10 }, C.wood, 4),
    solidBox({ x: px1 - 2, y: CD, z: 49, w: 2, d: 14, h: 10 }, C.wood, 4),
  ];
  const chimney: Box[] = [
    { x: CHIMNEY.x, y: CHIMNEY.y, z: WALL - 10, w: CHIMNEY.w, d: CHIMNEY.w, h: CHIMNEY.top - WALL + 10, top: flat(at(C.stone, 0)), left: stoneWall, right: stoneWallDark },
    solidBox({ x: CHIMNEY.x - 2, y: CHIMNEY.y - 2, z: CHIMNEY.top, w: CHIMNEY.w + 4, d: CHIMNEY.w + 4, h: 3 }, C.stone, 4),
  ];
  const roofZ = (y: number) => WALL + (y + EAVE) * SLOPE;
  return renderSprite([...walls, ...chimney, volume(-EAVE, -EAVE, 0, CW + EAVE * 2, CD + EAVE * 2 + 14, CHIMNEY.top + 4)], {
    outline: OUT,
    overlay: porch,
    under: shadowUnder(0, 0, CW + 6, CD + 14, 0.35),
    extra: (c, p) => {
      // Techo a dos aguas: faldón trasero, hastial derecho y faldón delantero (de atrás hacia adelante).
      splat(c, p, CW + EAVE * 2, RIDGE_Y + EAVE, (u, v) => {
        const y = -EAVE + v;
        return { x: -EAVE + u, y, z: roofZ(y), c: shingle(u, (RIDGE_Y - y) * 0.9, false) };
      });
      // Hastial: triángulo de troncos en x = CW bajo el techo, con ventanita redonda del ático.
      splat(c, p, CD, RIDGE_Z - WALL, (u, v) => {
        const y = u;
        const z = WALL + v;
        if (z > WALL + (RIDGE_Y - Math.abs(y - RIDGE_Y)) * SLOPE) return null;
        const col = atticWindow(y - RIDGE_Y, z - (WALL + 20), night) ?? mix(logs(y, z - WALL + 12, 11), at(C.logs, 0), 0.12);
        return { x: CW, y, z, c: col };
      });
      // Chimenea: el tramo que asoma sobre el faldón trasero (el techo la tapó más abajo).
      const cx1 = CHIMNEY.x + CHIMNEY.w;
      const cy1 = CHIMNEY.y + CHIMNEY.w;
      for (let z = WALL; z < CHIMNEY.top; z += 0.5)
        for (let u = 0; u < CHIMNEY.w; u += 0.5) {
          const brick = Math.floor(z) % 5 === 0 || (Math.floor(u) + (Math.floor(z / 5) % 2) * 3) % 6 === 0;
          if (z > roofZ(CHIMNEY.y + u)) {
            const q = p(cx1, CHIMNEY.y + u, z);
            c.set(q.x, q.y, at(C.stone, brick ? 0 : 2));
          }
          if (z > roofZ(cy1)) {
            const q = p(CHIMNEY.x + u, cy1, z);
            c.set(q.x, q.y, at(C.stone, brick ? 1 : 3));
          }
        }
      splat(c, p, CW + EAVE * 2, RIDGE_Y + EAVE, (u, v) => {
        const y = RIDGE_Y + v;
        return { x: -EAVE + u, y, z: RIDGE_Z - v * SLOPE, c: shingle(u, v * 0.9, true) };
      });
      // Cumbrera.
      for (let u = -EAVE; u < CW + EAVE; u += 0.5) {
        const q = p(u, RIDGE_Y, RIDGE_Z + 1);
        c.set(q.x, q.y, at(C.roof, 5));
        c.set(q.x, q.y + 1, at(C.roof, 4));
      }
      // Tapa de la chimenea (queda por delante de la cumbrera en pantalla).
      for (let u = -2; u < CHIMNEY.w + 2; u += 0.5)
        for (let w = -2; w < CHIMNEY.w + 2; w += 0.5) {
          const q = p(CHIMNEY.x + u, CHIMNEY.y + w, CHIMNEY.top + 3);
          c.set(q.x, q.y, at(C.stone, 4));
        }
    },
  });
}

// ---------- Vegetación ----------

function canopy(c: PixelCanvas, cx: number, cy: number, blobs: [number, number, number][], r = C.leaf, seed = 1) {
  for (const [dx, dy, rad] of blobs) c.ellipse(cx + dx + 1, cy + dy + 2, rad, rad * 0.85, at(r, 1));
  for (const [dx, dy, rad] of blobs) c.ellipse(cx + dx, cy + dy, rad, rad * 0.85, at(r, 3));
  for (const [dx, dy, rad] of blobs) c.ellipse(cx + dx - rad * 0.3, cy + dy - rad * 0.3, rad * 0.55, rad * 0.45, at(r, 4));
  // Motas de luz y sombra para que no se vea plano.
  for (const [dx, dy, rad] of blobs)
    for (let k = 0; k < rad * 2; k++) {
      const a = noise(k, dx, seed) * Math.PI * 2;
      const rr = noise(k, dy, seed + 1) * rad * 0.8;
      c.set(cx + dx + Math.cos(a) * rr, cy + dy + Math.sin(a) * rr * 0.85, at(r, noise(k, 7, seed) < 0.5 ? 2 : 5));
    }
}

function tree(): Sprite {
  return renderSprite(
    [
      {
        x: 6,
        y: 6,
        z: 0,
        w: 4,
        d: 4,
        h: 18,
        top: flat(at(C.logs, 2)),
        left: (u) => at(C.logs, Math.floor(u) % 2 ? 2 : 3),
        right: (u) => at(C.logs, Math.floor(u) % 2 ? 1 : 2),
      },
      volume(-12, -12, 10, 40, 40, 44),
    ],
    {
      outline: OUT,
      under: (c, p) => {
        const b = p(8, 8, 0);
        c.ellipse(b.x, b.y, 16, 8, alpha(SHADOW, 0.3));
      },
      extra: (c, p) => {
        const b = p(8, 8, 32);
        canopy(c, b.x, b.y, [
          [-9, 4, 8],
          [9, 4, 8],
          [0, 6, 9],
          [-6, -5, 9],
          [7, -6, 9],
          [0, -13, 8],
        ]);
        // Unas manzanas.
        for (const [dx, dy] of [
          [-6, 2],
          [5, -3],
          [1, 7],
          [-2, -10],
        ] as const) {
          c.set(b.x + dx, b.y + dy, at(C.rug, 3));
          c.set(b.x + dx, b.y + dy - 1, at(C.rug, 5));
        }
      },
    },
  );
}

function pine(): Sprite {
  return renderSprite(
    [solidBox({ x: 6, y: 6, z: 0, w: 4, d: 4, h: 10 }, C.logs, 3), volume(-8, -8, 8, 32, 32, 58)],
    {
      outline: OUT,
      under: (c, p) => {
        const b = p(8, 8, 0);
        c.ellipse(b.x, b.y, 12, 6, alpha(SHADOW, 0.3));
      },
      extra: (c, p) => {
        const b = p(8, 8, 8);
        const tiers: [number, number][] = [
          [0, 14],
          [-12, 12],
          [-23, 10],
          [-33, 7],
          [-42, 4],
        ];
        for (const [dy, half] of tiers) {
          for (let row = 0; row < 12; row++) {
            const w = half * (row / 12);
            for (let x = -w; x <= w; x++) {
              const shade = x < -w * 0.3 ? 4 : x > w * 0.4 ? 1 : 2;
              c.set(b.x + x, b.y + dy - 12 + row, at(C.green, row > 9 ? 1 : shade));
            }
          }
        }
        c.set(b.x, b.y - 46, at(C.green, 5));
      },
    },
  );
}

function bush(): Sprite {
  return renderSprite([volume(0, 0, 0, 16, 16, 18)], {
    outline: OUT,
    under: shadowUnder(1, 1, 14, 14),
    extra: (c, p) => {
      const b = p(8, 8, 6);
      canopy(c, b.x, b.y, [
        [-5, 1, 6],
        [5, 1, 6],
        [0, -3, 6.5],
      ], C.leaf, 3);
      for (const [dx, dy] of [
        [-4, -2],
        [3, -4],
        [5, 2],
      ] as const)
        c.set(b.x + dx, b.y + dy, at(C.rose, 4));
    },
  });
}

function flowerbed(): Sprite {
  const colors = [at(C.rug, 4), at(C.gold, 4), at(C.rose, 5), at(C.blue, 4), at(C.white, 4)];
  return renderSprite(
    [
      {
        x: 1,
        y: 1,
        z: 0,
        w: 14,
        d: 14,
        h: 5,
        top: (u, v) => at(C.dirt, noise(Math.floor(u), Math.floor(v), 2) < 0.3 ? 1 : 2),
        left: (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 1 : 3),
        right: (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 0 : 2),
      },
      volume(0, 0, 5, 16, 16, 8),
    ],
    {
      outline: OUT,
      extra: (c, p) => {
        for (let i = 0; i < 9; i++) {
          const q = p(3 + (i % 3) * 5, 3 + Math.floor(i / 3) * 5, 5);
          c.line(q.x, q.y, q.x, q.y - 3, at(C.leaf, 2));
          c.set(q.x - 1, q.y - 1, at(C.leaf, 3));
          const col = colors[Math.floor(noise(i, 1, 6) * colors.length)]!;
          c.set(q.x, q.y - 4, col);
          c.set(q.x - 1, q.y - 4, col);
          c.set(q.x + 1, q.y - 4, col);
          c.set(q.x, q.y - 5, col);
          c.set(q.x, q.y - 3, col);
          c.set(q.x, q.y - 4, at(C.gold, 5));
        }
      },
    },
  );
}

// ---------- Objetos ----------

function mailbox(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 7, y: 7, z: 0, w: 2, d: 2, h: 14 }, C.woodDark, 3),
      {
        x: 3,
        y: 5,
        z: 14,
        w: 10,
        d: 6,
        h: 7,
        top: flat(at(C.rug, 4)),
        left: (u, v) => (inRect(u, v, 2, 2, 8, 4) ? at(C.rug, 1) : at(C.rug, 3)),
        right: (u, v, fw, fh) => (Math.hypot(u - fw / 2, v - 3) < 2 ? at(C.gold, 4) : at(C.rug, 2)),
      },
      solidBox({ x: 12, y: 9, z: 18, w: 1, d: 1, h: 8 }, C.metal, 3),
      solidBox({ x: 12, y: 6, z: 24, w: 1, d: 4, h: 2 }, C.gold, 4),
    ],
    { outline: OUT, under: shadowUnder(3, 5, 10, 6) },
  );
}

function noticeBoard(): Sprite {
  const board: Shader = (u, v, fw, fh) => {
    if (u < 1.5 || u >= fw - 1.5 || v < 1.5 || v >= fh - 1.5) return at(C.wood, 4);
    const notes: [number, number, RGBA][] = [
      [3, 8, at(C.cream, 5)],
      [9, 9, at(C.gold, 5)],
      [5, 3, at(C.sky, 4)],
      [11, 3, at(C.rose, 5)],
    ];
    for (const [nu, nv, col] of notes) {
      if (inRect(u, v, nu, nv, nu + 4, nv + 4)) return v >= nv + 3 && u >= nu + 1.5 && u < nu + 2.5 ? at(C.rug, 3) : col;
    }
    return at(C.cork, 1 + Math.floor(noise(Math.floor(u), Math.floor(v), 8) * 3));
  };
  return renderSprite(
    [
      solidBox({ x: 6, y: 1, z: 0, w: 2, d: 2, h: 26 }, C.woodDark, 3),
      solidBox({ x: 6, y: 13, z: 0, w: 2, d: 2, h: 26 }, C.woodDark, 3),
      { x: 7, y: 0, z: 10, w: 2, d: 16, h: 16, top: flat(at(C.wood, 3)), left: flat(at(C.wood, 2)), right: board },
      { x: 4, y: -2, z: 26, w: 8, d: 20, h: 2, top: (u, v) => at(C.roof, Math.floor(v) % 4 === 0 ? 2 : 4), left: flat(at(C.roof, 1)), right: flat(at(C.roof, 2)) },
    ],
    { outline: OUT, under: shadowUnder(5, 0, 5, 16) },
  );
}

function lampPost(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 3 }, C.metal, 2),
      solidBox({ x: 7, y: 7, z: 3, w: 2, d: 2, h: 34 }, C.metal, 2),
      {
        x: 4,
        y: 4,
        z: 36,
        w: 8,
        d: 8,
        h: 8,
        top: flat(at(C.metal, 2)),
        left: (u, v, fw) => (u < 1 || u >= fw - 1 ? at(C.metal, 1) : at(C.gold, 4 + (v > 4 ? 1 : 0))),
        right: (u, v, fw) => (u < 1 || u >= fw - 1 ? at(C.metal, 0) : at(C.gold, 3 + (v > 4 ? 1 : 0))),
      },
      solidBox({ x: 3, y: 3, z: 44, w: 10, d: 10, h: 2 }, C.metal, 3),
      solidBox({ x: 7, y: 7, z: 46, w: 2, d: 2, h: 2 }, C.metal, 3),
    ],
    { outline: OUT, under: shadowUnder(4, 4, 8, 8) },
  );
}

/**
 * Tramo de cerca rústica (dibujado a mano), con los travesaños a lo largo de y: el poste de madera curtida
 * con la cabeza en rombo, su grieta y algo de musgo; dos travesaños partidos con la cara de arriba clara,
 * la de abajo en sombra, vetas y los clavos en el poste. Las puntas de los travesaños empalman con las del
 * tramo vecino (las cintas bajan una fila cada dos columnas y se repiten cada 16).
 */
const FENCE = [
  "........................",
  "................ooo.....",
  "..............oo554oo...",
  ".............o554344oo..",
  ".............o4543oo5o..",
  ".............o44ooN54o..",
  ".............ooo55n42o..",
  "............ooM54322oo..",
  "..........oo554422oo1o..",
  "........oo554422oo221o..",
  "......oo554322oo3422oo..",
  "....oo5M4422oo44m4oo5o..",
  "...o553422oo.o4mooN54o..",
  "...54422oo...ooo55n32o..",
  "...422oo....ooM54422oo..",
  "...2oo....oo553422oo1o..",
  "...o....oo554422oo221o..",
  "......oo554422oo24221o..",
  "....oo5M4322oo4434211o..",
  "...o554422oo.o3333211o..",
  "...54322oo....o33221os..",
  "...422oo.......oooooss..",
  "...2oo..........sssss...",
  "...o....................",
];

function fence(): Sprite {
  return gridSprite(FENCE, { ...rampLegend(C.logs), o: edgeOf(C.logs, 0.55), m: at(C.sage, 3), M: at(C.sage, 4), n: at(C.metal, 1), N: at(C.metal, 4), s: groundShadow(0.25) }, 11, 14);
}

const OUTDOOR: Record<string, (night: boolean) => Sprite> = {
  cabin,
  house: drawHouse,
  tree,
  pine,
  bush,
  flowerbed,
  mailbox,
  "notice-board": noticeBoard,
  "lamp-post": lampPost,
  fence,
  "gazebo-roof": gazeboRoof,
  garage: drawGarage,
  treehouse: drawTreeHouse,
  "bus-station": drawBusStation,
  // La piscina: de noche, con las luces de adentro del agua.
  pool: drawPool,
  // La tina y la sauna del lago (de noche, las estufas y la ventanita prendidas).
  ...TINA_NIGHT,
  "stage-shell": stageShell,
  observatory: drawObservatory,
  // La casa de cada persona por fuera y el refugio de su parada (de noche, las ventanas y el farol).
  ...CASA_PROPIA_NIGHT,
  // La Noche de brujas: las ahuyamas, el espantapájaros y el farol de papel, prendidos de noche.
  ...BRUJAS_NIGHT,
  // La Noche de velitas: las velitas y los faroles de papel (de noche, el papel prendido).
  ...VELITAS_NIGHT,
  // La Feria de las flores: el farol de papel de colores, prendido de noche.
  ...FERIA_NIGHT,
  // El Año viejo: el brasero (las brasas) y el farol de papel amarillo, prendidos de noche.
  ...ANO_VIEJO_NIGHT,
  // Las novenas: el árbol de Navidad y el arco de luces, prendidos de noche.
  ...NOVENAS_NIGHT,
};

export function hasOutdoor(type: string): boolean {
  return type in OUTDOOR;
}

export function drawOutdoor(type: string, night = false): Sprite {
  const draw = OUTDOOR[type];
  if (!draw) throw new Error(`Sin dibujo para "${type}"`);
  return draw(night);
}
