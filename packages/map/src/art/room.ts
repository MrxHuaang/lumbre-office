// Render de un nivel: pisos, paredes altas del fondo (con lo que cuelga de ellas) y las piezas de
// pared baja. Todo en unidades de arte (tile = 16).
import type { OfficeMap } from "../world/build";
import type { FloorKind, WallFeature, WallpaperKind } from "../world/types";
import { C, OUT, inRect, mix } from "./palette";
import { SURROUND_PAD, surroundingsAt } from "./surroundings";
import { bathFloor, loungeFloor, marbleFloor } from "./sotano";
import {
  L,
  at,
  bayer,
  flat,
  hex,
  noise,
  renderSprite,
  smoothNoise,
  type Box,
  type Ramp,
  type RGBA,
  type Shader,
  type Sprite,
} from "./pixel";
import { FOREST, interiorFeature, interiorFloor, interiorWall } from "./interior-room";
import { CEMENT, concreteFloor, garajeFeature } from "./garaje-room";
import { casaArbolFeature } from "./casa-arbol-room";
import { CEMENT, concreteFloor, garajeFeature, gravelFloor, wornPlanksFloor } from "./garaje-room";

export const WALL_H = 56;
export const LOW_WALL_H = 10;
const WALL_T = 4;
const SLAB = 5;

const WALLPAPER: Record<WallpaperKind, Ramp> = {
  sage: C.sage,
  cream: C.cream,
  blue: C.blue,
  rose: C.rose,
  wine: C.rug,
  navy: C.navy,
  violet: C.violet,
  paneling: C.wood,
  tile: C.cream,
  forest: FOREST,
  stripes: C.cream,
  damask: C.mustard,
  brick: C.terracotta,
  slats: C.wood,
  colonial: C.cream,
  cinderblock: CEMENT,
  treehouse: C.wood,
  boards: C.logs,
};
/** El alfombrado toma el color del papel de la sala. */
const CARPET: Record<WallpaperKind, Ramp> = {
  sage: C.green,
  cream: C.cream,
  blue: C.blue,
  rose: C.rose,
  wine: C.rug,
  navy: C.navy,
  violet: C.violet,
  paneling: C.wood,
  tile: C.cream,
  forest: C.green,
  stripes: C.blue,
  damask: C.mustard,
  brick: C.terracotta,
  slats: C.cream,
  colonial: C.green,
  cinderblock: C.stone,
  treehouse: C.cork,
  boards: C.rug,
};

// ---------- Pisos ----------

function woodFloor(X: number, Y: number): RGBA {
  const row = Math.floor(Y / 8);
  const off = Math.floor(noise(row, 0, 3) * 32);
  const seg = Math.floor((X + off) / 32);
  const tone = noise(seg, row, 7);
  let c = at(C.wood, tone < 0.25 ? 2 : tone < 0.8 ? 3 : 4);
  if (noise(Math.floor(X), Math.floor(Y), 11) < 0.05) c = at(C.wood, 2);
  if (Y % 8 < 1 || (X + off) % 32 < 1) c = at(C.wood, 1);
  return c;
}

function carpet(X: number, Y: number, r: Ramp): RGBA {
  const d = bayer(Math.floor(X), Math.floor(Y));
  if ((Math.floor(X) + Math.floor(Y)) % 12 === 0) return at(r, 2);
  return at(r, d < 0.15 ? 2 : 3);
}

function cafeTiles(X: number, Y: number): RGBA {
  const cell = (Math.floor(X / 8) + Math.floor(Y / 8)) % 2;
  if (X % 8 < 0.8 || Y % 8 < 0.8) return at(C.cream, 1);
  return cell ? at(C.cream, 4) : at(C.terracotta, 3);
}

/** Alfombra de casino: rombos con borde dorado sobre vino, con un punto dorado al centro de cada uno. */
function casinoCarpet(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const u = (((x + y) % 16) + 16) % 16;
  const v = (((x - y) % 16) + 16) % 16;
  if (u === 0 || v === 0) return at(C.gold, 2);
  if ((u === 8 || u === 7) && (v === 8 || v === 7)) return at(C.gold, 3);
  const cell = (Math.floor((x + y) / 16) + Math.floor((x - y + 1600) / 16)) % 2;
  return at(C.rug, bayer(x, y) < 0.18 ? cell : cell + 1);
}

/** Pista de baile del club: baldosas de colores (unas "encendidas") con juntas oscuras. */
function danceFloor(X: number, Y: number): RGBA {
  const cx = Math.floor(X / 8);
  const cy = Math.floor(Y / 8);
  const u = X - cx * 8;
  const v = Y - cy * 8;
  if (u < 1 || v < 1) return at(C.violet, 0);
  const ramps = [C.neon, C.violet, C.cyan, C.violet];
  const r = ramps[(((cx + cy * 3) % ramps.length) + ramps.length) % ramps.length]!;
  const lit = noise(cx, cy, 29) < 0.35;
  // Brillo en la esquina de cada baldosa, como vidrio.
  if (u < 2.5 && v < 2.5) return at(r, lit ? 5 : 3);
  return at(r, lit ? 4 : bayer(Math.floor(X), Math.floor(Y)) < 0.2 ? 1 : 2);
}

/** Alfombra de cine: azul noche con un rombito dorado y rojo repetido (distinta de la del casino). */
function cinemaCarpet(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const u = ((x % 12) + 12) % 12;
  const v = ((y % 12) + 12) % 12;
  const d = Math.abs(u - 6) + Math.abs(v - 6);
  if (d === 2) return at(C.gold, 3);
  if (d < 2) return at(C.curtain, 2);
  return at(C.navy, bayer(x, y) < 0.15 ? 1 : 2);
}

/** Alfombra del arcade: azul noche con figuritas de neón (triángulos, anillos y zigzags). */
function arcadeCarpet(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const cx = Math.floor(x / 12);
  const cy = Math.floor(y / 12);
  const u = x - cx * 12 - 6;
  const v = y - cy * 12 - 6;
  const n = noise(cx, cy, 53);
  const col = [C.neon, C.cyan, C.gold][Math.floor(noise(cx, cy, 11) * 3)]!;
  if (n < 0.33 && v >= -2 && v <= 2 && Math.abs(u) <= 2 - (v + 2) / 2) return at(col, 4);
  if (n >= 0.33 && n < 0.66 && Math.abs(Math.hypot(u, v) - 2.5) < 0.6) return at(col, 4);
  if (n >= 0.66 && Math.abs(v - (Math.abs(u % 4) < 2 ? 1 : -1)) < 0.6 && Math.abs(u) <= 3) return at(col, 3);
  return at(C.navy, bayer(x, y) < 0.2 ? 0 : 1);
}

/** Agua del estanque: azul con rizos claros sueltos y un poco de tramado. */
function water(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const r = noise(Math.floor(x / 5), y, 37);
  if (r > 0.93 && x % 5 < 3) return at(C.sky, 4);
  const deep = smoothNoise(X, Y, 20, 8);
  return at(C.sky, deep < 0.4 ? 0 : bayer(x, y) < 0.3 ? 1 : deep < 0.7 ? 1 : 2);
}

/** Muelle: tablas a lo largo de y con juntas oscuras y clavos. */
function dock(X: number, Y: number): RGBA {
  const u = ((X % 16) + 16) % 16;
  const plank = Math.floor(u / 4);
  if (u % 4 < 0.8) return at(C.woodDark, 1);
  const v = ((Y % 16) + 16) % 16;
  if ((v < 1 || v >= 15) && u % 4 >= 1.5 && u % 4 < 2.5) return at(C.metal, 3);
  return at(C.wood, noise(plank, Math.floor(Y / 16), 19) < 0.5 ? 3 : 2);
}

/**
 * Pasto. `calm`: la versión del exterior grande (con piso fino), con menos briznas claras y florcitas
 * porque ahí ya hay macizos y flores de verdad; el resto de los niveles (y la vitrina del login) sigue
 * con el pasto de siempre.
 */
function grass(X: number, Y: number, calm = false): RGBA {
  const n = noise(Math.floor(X), Math.floor(Y), 13);
  // Dos octavas de ruido suave y un poco de tramado en los bordes: manchas de pasto orgánicas.
  const patch = smoothNoise(X, Y, 28, 2) * 0.7 + smoothNoise(X, Y, 9, 5) * 0.3 + (bayer(Math.floor(X), Math.floor(Y)) - 0.5) * 0.08;
  let c = at(C.grass, patch < 0.36 ? 2 : patch < 0.64 ? 3 : 4);
  if (n < 0.07) c = at(C.grass, 1);
  else if (n > (calm ? 0.985 : 0.95)) c = at(C.grass, 5);
  // Florcitas sueltas.
  const f = noise(Math.floor(X / 2), Math.floor(Y / 2), 17);
  if (f > (calm ? 0.9985 : 0.996)) return [at(C.white, 4), at(C.gold, 5), at(C.rose, 5)][Math.floor(noise(X, Y, 3) * 3)]!;
  return c;
}

/** Adoquines redondeados sobre tierra. */
function stonePath(X: number, Y: number): RGBA {
  const cy = Math.floor(Y / 6);
  const ox = (cy % 2) * 4;
  const u = (X + ox) % 8;
  const v = Y % 6;
  const edge = Math.min(u, 8 - u, v * 1.3, (6 - v) * 1.3);
  if (edge < 0.9) return at(C.dirt, 2);
  const tone = noise(Math.floor((X + ox) / 8), cy, 4);
  const c = at(C.stone, tone < 0.3 ? 2 : tone < 0.8 ? 3 : 4);
  return edge < 1.8 && v < 3 ? mix(c, at(C.stone, 5), 0.3) : c;
}

function doormat(X: number, Y: number): RGBA {
  const u = X % L;
  const v = Y % L;
  if (u < 2 || u >= 14 || v < 3 || v >= 13) return at(C.woodDark, 2);
  if (u < 3 || u >= 13 || v < 4 || v >= 12) return at(C.rug, 1);
  return at(C.mustard, (Math.floor(u) + Math.floor(v)) % 3 === 0 ? 1 : 2);
}

function floorColor(kind: FloorKind, X: number, Y: number, wallpaper: WallpaperKind | null): RGBA {
  switch (kind) {
    case "wood":
      return woodFloor(X, Y);
    case "carpet":
      return carpet(X, Y, CARPET[wallpaper ?? "cream"]);
    case "tiles":
      return cafeTiles(X, Y);
    case "stone":
      return stonePath(X, Y);
    case "grass":
      return grass(X, Y);
    case "path":
      return stonePath(X, Y);
    case "doormat":
      return doormat(X, Y);
    case "casino":
      return casinoCarpet(X, Y);
    case "dance":
      return danceFloor(X, Y);
    case "cinema":
      return cinemaCarpet(X, Y);
    case "arcade":
      return arcadeCarpet(X, Y);
    case "water":
      return water(X, Y);
    case "dock":
      return dock(X, Y);
    case "forest":
      return forestFloor(X, Y, 1);
    case "deck":
      return deck(X, Y);
    case "soil":
      return soil(X, Y);
    case "sand":
      return sand(X, Y);
    // Interiores del rediseño (art/interior-room.ts).
    case "parquet":
    case "kitchen":
    case "mosaic":
    case "terrace":
    case "hydraulic":
    case "checker":
    case "terrazzo":
    case "brick":
    case "moquette":
    case "planks":
      return interiorFloor(kind, X, Y);
    case "marble":
      return marbleFloor(X, Y);
    case "bath":
      return bathFloor(X, Y, WALLPAPER[wallpaper ?? "blue"]);
    case "lounge":
      return loungeFloor(X, Y);
    case "concrete":
      return concreteFloor(X, Y);
    case "planks-worn":
      return wornPlanksFloor(X, Y);
    case "gravel":
      return gravelFloor(X, Y);
  }
}

// ---------- Pisos de afuera (exterior rediseñado) ----------

/**
 * Suelo del bosque: sombra del sotobosque con matas, agujas y hojas caídas. `t` = 0 junto a la zona
 * jugable (casi pasto) … 1 lejos (igual al fondo de art/surroundings.ts, para que empalme sin corte).
 */
function forestFloor(X: number, Y: number, t: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  // Transición tramada con manchas: el pasto se va apagando hacia el bosque.
  const patch = smoothNoise(X, Y, 22, 31) * 0.6 + smoothNoise(X, Y, 7, 32) * 0.4;
  if (patch + bayer(x, y) * 0.25 > 0.35 + t * 0.95) {
    const g = grass(X, Y, true);
    return t > 0.35 ? mix(g, at(C.leaf, 1), 0.35) : g;
  }
  const n = noise(x, y, 33);
  const tuft = noise(Math.floor(X / 3), Math.floor(Y / 2), 34);
  if (tuft > 0.93 && (y % 2 === 0 || n < 0.5)) return at(C.grass, n < 0.5 ? 2 : 1);
  if (n > 0.985) return at(C.logs, 1);
  if (n > 0.975) return at(C.dirt, 1);
  return at(C.leaf, bayer(x, y) < 0.25 ? 0 : 1);
}

/** Terraza de tablas a lo largo de x, con juntas oscuras y clavos. */
function deck(X: number, Y: number): RGBA {
  const v = ((Y % 5) + 5) % 5;
  const row = Math.floor(Y / 5);
  const off = noise(row, 1, 5) * 40;
  const seg = Math.floor((X + off) / 40);
  const along = (X + off) % 40;
  if (v < 0.9) return at(C.woodDark, 2);
  if (along < 0.8) return at(C.woodDark, 3);
  if ((along < 2.5 || along > 38) && v > 2 && v < 3) return at(C.woodDark, 3);
  const tone = noise(seg, row, 9);
  if (noise(Math.floor(X / 3), Math.floor(Y), 10) < 0.06) return at(C.wood, 2);
  return at(C.wood, v < 1.8 ? 4 : tone < 0.3 ? 2 : 3);
}

/** Tierra del huerto: oscura, con terrones claros y alguna piedrita. */
function soil(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const n = noise(x, y, 41);
  const clod = noise(Math.floor(X / 2), Math.floor(Y / 2), 42);
  if (n > 0.985) return at(C.stone, 3);
  if (clod > 0.86) return at(C.dirt, n < 0.5 ? 3 : 2);
  return at(C.dirt, smoothNoise(X, Y, 10, 43) < 0.45 ? 1 : bayer(x, y) < 0.3 ? 1 : 2);
}

/** Arena de la orilla: clara, con granitos y alguna piedrita o concha. */
function sand(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const n = noise(x, y, 51);
  if (n > 0.992) return at(C.white, 4);
  if (n > 0.982) return at(C.stone, 3);
  const r = smoothNoise(X, Y, 12, 52);
  return mix(at(C.cream, r < 0.4 ? 2 : 3), at(C.mustard, 3), 0.25 + (bayer(x, y) < 0.2 ? 0.15 : 0));
}

/** El piso de un exterior con piso fino (el pasto, en su versión tranquila). */
const outdoorFloor = (k: FloorKind, X: number, Y: number) => (k === "grass" ? grass(X, Y, true) : floorColor(k, X, Y, null));

/**
 * Todos los pisos, para guardar el piso fino de cada píxel como un número. Es un Record para que el
 * compilador pida agregar aquí cualquier piso nuevo (si faltara, ese piso se dibujaría como pasto).
 */
const KIND_SET: Record<FloorKind, true> = {
  wood: true,
  carpet: true,
  tiles: true,
  stone: true,
  grass: true,
  path: true,
  doormat: true,
  casino: true,
  dance: true,
  cinema: true,
  arcade: true,
  water: true,
  dock: true,
  forest: true,
  deck: true,
  soil: true,
  sand: true,
  parquet: true,
  kitchen: true,
  mosaic: true,
  terrace: true,
  marble: true,
  bath: true,
  lounge: true,
  hydraulic: true,
  checker: true,
  terrazzo: true,
  brick: true,
  moquette: true,
  planks: true,
  concrete: true,
  "planks-worn": true,
  gravel: true,
};
const KINDS = Object.keys(KIND_SET) as FloorKind[];

/** Datos del dibujo de un exterior con `groundFine`, calculados una vez por nivel. */
interface OutdoorArt {
  /** Piso en un punto (unidades de arte). */
  kindAt(X: number, Y: number): FloorKind;
  /** El tile y sus ocho vecinos tienen el mismo piso (no hay bordes que dibujar). */
  uniform(tx: number, ty: number): boolean;
  /** Distancia en tiles de cada tile de agua a la tierra (para lo hondo del lago). */
  waterDepth: Float32Array;
}

const outdoorCache = new WeakMap<OfficeMap, OutdoorArt>();

function outdoorArt(map: OfficeMap): OutdoorArt {
  const cached = outdoorCache.get(map);
  if (cached) return cached;
  const W = map.width;
  const H = map.height;
  const fine = map.def.groundFine!;
  const tileKind = (x: number, y: number): FloorKind => map.floors[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))]!;
  // Un tile es "mezclado" si algún vecino tiene otro piso: solo ahí se pide el piso fino por píxel.
  const isMixed = (tx: number, ty: number) => {
    const k = tileKind(tx, ty);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileKind(tx + dx, ty + dy) !== k) return true;
    return false;
  };
  const mixed = new Map<number, Uint8Array>();
  const mixedFlag = new Int8Array(W * H).fill(-1);
  const kindAt = (X: number, Y: number): FloorKind => {
    const tx = Math.floor(X / L);
    const ty = Math.floor(Y / L);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return tileKind(tx, ty);
    const i = ty * W + tx;
    if (mixedFlag[i] === -1) mixedFlag[i] = isMixed(tx, ty) ? 1 : 0;
    if (!mixedFlag[i]) return tileKind(tx, ty);
    let cells = mixed.get(i);
    if (!cells) {
      cells = new Uint8Array(L * L);
      for (let v = 0; v < L; v++) for (let u = 0; u < L; u++) cells[v * L + u] = KINDS.indexOf(fine(tx + (u + 0.5) / L, ty + (v + 0.5) / L));
      mixed.set(i, cells);
    }
    const u = Math.floor(X - tx * L);
    const v = Math.floor(Y - ty * L);
    return KINDS[cells[v * L + u]!]!;
  };
  // Profundidad del agua: BFS desde los tiles que no son agua.
  const waterDepth = new Float32Array(W * H).fill(0);
  const queue: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (map.floors[i] !== "water") queue.push(i);
    else waterDepth[i] = Infinity;
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!;
    const x = i % W;
    const y = Math.floor(i / W);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (waterDepth[j]! > waterDepth[i]! + 1) {
        waterDepth[j] = waterDepth[i]! + 1;
        queue.push(j);
      }
    }
  }
  const uniform = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    const i = ty * W + tx;
    if (mixedFlag[i] === -1) mixedFlag[i] = isMixed(tx, ty) ? 1 : 0;
    return mixedFlag[i] === 0;
  };
  const art = { kindAt, uniform, waterDepth };
  outdoorCache.set(map, art);
  return art;
}

const DIRS8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];

/** Pisos "blandos" que llevan borde contra el pasto. */
const EDGED = new Set<FloorKind>(["path", "soil", "sand", "deck"]);

/**
 * Color de un píxel de un exterior con piso fino: el piso del punto, bordes entre pisos (un filo de
 * tierra en los senderos, sombra en el pasto de al lado), la orilla del lago con arena, espuma y lo
 * hondo más oscuro, y el bosque del margen que se oscurece hacia afuera.
 */
function outdoorColor(map: OfficeMap, X: number, Y: number): RGBA {
  const art = outdoorArt(map);
  const k = art.kindAt(X, Y);
  // Tile parejo (sin bordes cerca): el piso tal cual, sin buscar vecinos.
  const flatTile = art.uniform(Math.floor(X / L), Math.floor(Y / L));
  if (flatTile && k !== "forest" && k !== "water") return outdoorFloor(k, X, Y);
  if (k === "forest") {
    const p = map.def.playable;
    const d = p ? Math.max(p.x * L - X, X - (p.x + p.w) * L, p.y * L - Y, Y - (p.y + p.h) * L) / L : 9;
    // Más afuera de la fila de árboles, el suelo se vuelve la copa del bosque de alrededor, alineada con
    // la baldosa que el cliente repite más allá del nivel (empieza en la esquina del fondo menos el
    // relleno): así el borde del nivel no se ve.
    const canopyMix = d > 4.8 ? 2 : (d - 3) / 1.6 + (smoothNoise(X, Y, 14, 35) - 0.5) * 0.8;
    if (canopyMix > bayer(Math.floor(X), Math.floor(Y))) {
      const o = baseOrigin(map);
      return surroundingsAt(X - Y + o.ox + SURROUND_PAD, (X + Y) / 2 + o.oy + SURROUND_PAD);
    }
    return forestFloor(X, Y, Math.max(0, Math.min(1, (d - 0.5) / 2.5)));
  }
  if (k === "water") return lakeWater(map, art, X, Y, flatTile);
  let c = outdoorFloor(k, X, Y);
  const near = (r: number, test: (n: FloorKind) => boolean) => DIRS8.some(([dx, dy]) => test(art.kindAt(X + dx * r, Y + dy * r)));
  if (EDGED.has(k) && near(1.2, (n) => n === "grass" || n === "forest")) {
    if (k === "path") return at(C.dirt, 2);
    if (k === "soil") return at(C.woodDark, 2);
    if (k === "deck") return at(C.woodDark, 1);
    return mix(c, at(C.grass, 3), 0.5);
  }
  if (k === "grass") {
    if (near(1.3, (n) => n === "path" || n === "soil" || n === "deck")) return at(C.grass, 1);
    // Matitas de pasto que se asoman sobre el borde de la arena.
    if (near(1.8, (n) => n === "sand") && bayer(Math.floor(X), Math.floor(Y)) < 0.5) return at(C.grass, 4);
  }
  if (k === "path" && near(2.4, (n) => n === "grass")) c = mix(c, at(C.dirt, 3), 0.25);
  // La tierra del huerto lleva un marco de tablones contra el pasto.
  if (k === "soil" && near(2.6, (n) => n === "grass" || n === "path")) return at(C.wood, near(1.9, (n) => n === "grass" || n === "path") ? 3 : 4);
  return c;
}

/**
 * Dónde queda el origen del mundo en el lienzo del fondo: lo mismo que calcula renderSprite (relleno de
 * 2 px; el tile (0, alto) es lo de más a la izquierda y la cara de arriba de los tiles está en z = 0). El
 * margen del bosque se alinea con esto y drawAreaBase comprueba que coincida con lo que salió.
 */
function baseOrigin(map: OfficeMap) {
  return { ox: map.height * L + 2, oy: 2 };
}

/** Agua del lago: arena mojada y espuma en la orilla, bajío claro y lo hondo oscuro, con rizos. */
function lakeWater(map: OfficeMap, art: OutdoorArt, X: number, Y: number, open: boolean): RGBA {
  // Distancia a la tierra (sin contar el muelle) en píxeles, buscando hasta 7 en ocho direcciones
  // (en un tile rodeado de agua la tierra queda más lejos que eso).
  let d = 8;
  for (let r = 1; r <= 7 && d === 8 && !open; r++)
    for (const [dx, dy] of DIRS8) {
      const n = art.kindAt(X + dx * r, Y + dy * r);
      if (n !== "water" && n !== "dock") {
        d = r;
        break;
      }
    }
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const wob = smoothNoise(X, Y, 5, 61) * 1.4;
  if (d + wob < 1.8) return at(C.dirt, 3);
  if (d + wob < 2.6) return at(C.cream, 4);
  if (d + wob < 3.6) return at(C.sky, 4);
  if (d + wob < 5.5 && bayer(x, y) < 0.5) return at(C.sky, 3);
  // Sombra del muelle en el agua (las tablas quedan un poco más arriba).
  if (art.kindAt(X - 2, Y - 3) === "dock" || art.kindAt(X - 3, Y - 2) === "dock") return at(C.sky, 0);
  // Profundidad interpolada entre los centros de los tiles (sin escalones de tile en tile).
  const gx = X / L - 0.5;
  const gy = Y / L - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const dAt = (tx: number, ty: number) => (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height ? 0 : art.waterDepth[ty * map.width + tx]!);
  const depth =
    dAt(x0, y0) * (1 - fx) * (1 - fy) + dAt(x0 + 1, y0) * fx * (1 - fy) + dAt(x0, y0 + 1) * (1 - fx) * fy + dAt(x0 + 1, y0 + 1) * fx * fy;
  // Rizos: rayitas claras sueltas, más en lo hondo.
  const r = noise(Math.floor(x / 7), y, 37);
  if (r > 0.975 && x % 7 < 4) return at(C.sky, depth > 2 ? 3 : 4);
  const deep = depth + smoothNoise(X, Y, 18, 8) * 1.4 + (bayer(x, y) - 0.5) * 0.6;
  if (deep > 4.4) return mix(at(C.sky, 0), at(C.navy, 3), 0.45);
  if (deep > 3.1) return at(C.sky, 0);
  if (deep > 1.9) return at(C.sky, 1);
  return at(C.sky, 2);
}


/**
 * Orilla del estanque: una franja de arena y espuma donde el agua toca tierra, con las esquinas
 * redondeadas (lo que queda fuera de la curva es pasto). El muelle cuenta como agua: no lleva arena.
 */
function shore(map: OfficeMap, tx: number, ty: number, u: number, v: number, c: RGBA): RGBA {
  const W = map.width;
  const dry = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= map.height) return true;
    const f = map.floors[y * W + x];
    return f !== "water" && f !== "dock";
  };
  const n = dry(tx, ty - 1);
  const s = dry(tx, ty + 1);
  const w = dry(tx - 1, ty);
  const e = dry(tx + 1, ty);
  const R = 7;
  const u1 = L - u;
  const v1 = L - v;
  let d = 99;
  if (w) d = Math.min(d, u);
  if (e) d = Math.min(d, u1);
  if (n) d = Math.min(d, v);
  if (s) d = Math.min(d, v1);
  // Esquinas convexas (dos lados secos): se redondean.
  if (n && w && u < R && v < R) d = Math.min(d, R - Math.hypot(R - u, R - v));
  if (n && e && u1 < R && v < R) d = Math.min(d, R - Math.hypot(R - u1, R - v));
  if (s && w && u < R && v1 < R) d = Math.min(d, R - Math.hypot(R - u, R - v1));
  if (s && e && u1 < R && v1 < R) d = Math.min(d, R - Math.hypot(R - u1, R - v1));
  // Esquinas cóncavas (solo la diagonal seca): un cuarto de círculo de arena.
  if (!n && !w && dry(tx - 1, ty - 1)) d = Math.min(d, Math.hypot(u, v));
  if (!n && !e && dry(tx + 1, ty - 1)) d = Math.min(d, Math.hypot(u1, v));
  if (!s && !w && dry(tx - 1, ty + 1)) d = Math.min(d, Math.hypot(u, v1));
  if (!s && !e && dry(tx + 1, ty + 1)) d = Math.min(d, Math.hypot(u1, v1));
  if (d < 0) return grass(tx * L + u, ty * L + v);
  if (d < 1) return at(C.dirt, 3);
  if (d < 2) return at(C.dirt, 4);
  if (d < 3.5) return at(C.sky, 4);
  if (d < 5 && bayer(Math.floor(u), Math.floor(v)) < 0.4) return at(C.sky, 3);
  return c;
}

// ---------- Paredes ----------

/** Papel mural con franjas, zócalo de madera y moldura; `hv` = altura sobre el piso. */
function wallpaper(u: number, hv: number, r: Ramp, shift: number): RGBA {
  if (hv < 0) return at(C.woodDark, 1);
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  if (hv < 18) {
    if (hv >= 16) return at(C.wood, 4);
    if (hv >= 15) return at(C.wood, 1);
    if (u % 12 < 1) return at(C.wood, 1);
    if (u % 12 < 2) return at(C.wood, 4);
    return at(C.wood, noise(Math.floor(u / 12), 0, 5) < 0.5 ? 2 : 3);
  }
  if (hv >= WALL_H - 4) return at(C.cream, hv >= WALL_H - 1 ? 4 : hv < WALL_H - 3 ? 1 : 3);
  const stripe = u % 10 < 2;
  let c = at(r, (stripe ? 2 : 3) + shift);
  if (u % 10 === 6 && Math.floor(hv) % 8 === 4) c = at(r, 4 + shift);
  if (hv < 20) c = at(r, 1 + shift);
  return c;
}

function windowAt(u: number, hv: number, u0: number, u1: number, day: boolean): RGBA | null {
  // Cortinas a los lados.
  if (inRect(u, hv, u0 - 7, 20, u0, 49) || inRect(u, hv, u1, 20, u1 + 7, 49)) {
    const f = Math.floor(u) % 3;
    return at(C.curtain, hv >= 47 ? 1 : f === 0 ? 1 : f === 1 ? 3 : 2);
  }
  if (inRect(u, hv, u0 - 9, 48, u1 + 9, 50)) return at(C.gold, hv >= 49 ? 4 : 2);
  if (inRect(u, hv, u0 - 3, 19, u1 + 3, 22)) return at(C.cream, hv >= 21 ? 5 : 2);
  if (!inRect(u, hv, u0, 22, u1, 46)) return null;
  if (u < u0 + 2 || u >= u1 - 2 || hv < 24 || hv >= 44) return at(C.cream, u < u0 + 1 || hv >= 45 ? 4 : 3);
  const mid = (u0 + u1) / 2;
  if (Math.abs(u - mid) < 1 || (hv >= 33 && hv < 35)) return at(C.cream, 3);
  if (!day) return noise(Math.floor(u), Math.floor(hv), 21) < 0.03 ? at(C.gold, 5) : at(C.night, hv > 38 ? 1 : 2);
  const t = (hv - 24) / 20;
  if (Math.abs(u - u0 - 6 - (hv - 24) * 0.6) < 1.2 || Math.abs(u - mid - 5 - (hv - 24) * 0.6) < 0.8) return at(C.sky, 4);
  return at(C.sky, 1 + t * 3 + (bayer(Math.floor(u), Math.floor(hv)) - 0.5));
}

// Letras de 3x5 para los letreros de neón: cinco filas de arriba abajo.
const GLYPHS: Record<string, string> = {
  A: ".#. #.# ### #.# #.#",
  B: "##. #.# ##. #.# ##.",
  C: ".## #.. #.. #.. .##",
  D: "##. #.# #.# #.# ##.",
  E: "### #.. ##. #.. ###",
  F: "### #.. ##. #.. #..",
  G: ".## #.. #.# #.# .##",
  H: "#.# #.# ### #.# #.#",
  I: "### .#. .#. .#. ###",
  J: "..# ..# ..# #.# .#.",
  K: "#.# #.# ##. #.# #.#",
  L: "#.. #.. #.. #.. ###",
  M: "#.# ### ### #.# #.#",
  N: "##. #.# #.# #.# #.#",
  O: ".#. #.# #.# #.# .#.",
  P: "##. #.# ##. #.. #..",
  R: "##. #.# ##. #.# #.#",
  S: ".## #.. .#. ..# ##.",
  T: "### .#. .#. .#. .#.",
  U: "#.# #.# #.# #.# ###",
  V: "#.# #.# #.# #.# .#.",
  X: "#.# #.# .#. #.# #.#",
  Y: "#.# #.# .#. .#. .#.",
  "7": "### ..# .#. .#. .#.",
};

/** ¿La letra `ch` tiene prendido el píxel (gx, gy)? (gx 0..2, gy 0..4 de arriba abajo). */
export function glyphOn(ch: string, gx: number, gy: number): boolean {
  return GLYPHS[ch]?.split(" ")[gy]?.[gx] === "#";
}

/**
 * Letrero de neón: tablero oscuro con letras de tubo rosado (3x5 a escala 2) y su halo, centradas. `top`
 * es la altura de arriba de las letras (el del karaoke va más alto, sobre los estantes del bar).
 */
export function neonAt(text: string, u: number, hv: number, u1: number, top = 46): RGBA | null {
  const s = 2;
  const tw = text.length * 4 * s - s;
  const x0 = Math.floor((u1 - tw) / 2);
  const bottom = top - 5 * s;
  if (!inRect(u, hv, 2, bottom - 5, u1 - 2, top + 4)) return null;
  const lit = (x: number, y: number) => {
    // (x, y) en píxeles del letrero; y crece hacia abajo desde `top`.
    const k = Math.floor((x - x0) / (4 * s));
    if (x < x0 || k >= text.length || y < 0 || y >= 5 * s) return false;
    const gx = Math.floor((x - x0 - k * 4 * s) / s);
    return gx < 3 && glyphOn(text[k]!, gx, Math.floor(y / s));
  };
  const x = Math.floor(u);
  const y = Math.floor(top - hv);
  if (lit(x, y)) return at(C.neon, (x + y) % 5 === 0 ? 5 : 4);
  if (lit(x - 1, y) || lit(x + 1, y) || lit(x, y - 1) || lit(x, y + 1)) return at(C.neon, 1);
  if (u < 3 || u >= u1 - 3 || hv < bottom - 4 || hv >= top + 3) return at(C.metal, 1);
  return at(C.violet, 0);
}

/**
 * Recuadro de la imagen de la pantalla del club (`video-wall`), en unidades de arte relativas al rasgo:
 * `u` a lo largo de la pared desde su borde izquierdo y `hv` de altura. Ahí monta el navegador el video.
 */
export const VIDEO_WALL_SCREEN = { u0: 3, uPad: 3, hv0: 28, hv1: 53 } as const;

/** Recuadro de la imagen de la tele de la sala de reuniones (`screen`), igual que VIDEO_WALL_SCREEN. */
export const SCREEN_INSET = { u0: 4, uPad: 4, hv0: 24, hv1: 46 } as const;

/** Pantalla LED del club (sobre la cabina): marco negro con filo de neón y, apagada, "DJ" en neón. */
function videoWallAt(u: number, hv: number, u1: number): RGBA | null {
  const { u0, uPad, hv0, hv1 } = VIDEO_WALL_SCREEN;
  if (!inRect(u, hv, u0 - 2, hv0 - 2, u1 - uPad + 2, hv1 + 2)) return null;
  if (!inRect(u, hv, u0, hv0, u1 - uPad, hv1)) {
    const edge = inRect(u, hv, u0 - 1, hv0 - 1, u1 - uPad + 1, hv1 + 1);
    return edge ? at(C.neon, 3) : at(C.metal, 0);
  }
  // Letras de 3x5 a escala 3, centradas: se ven cuando no hay video encima.
  const s = 3;
  const text = "DJ";
  const tw = text.length * 4 * s - s;
  const x0 = Math.floor((u1 - tw) / 2);
  const top = Math.floor((hv0 + hv1 + 5 * s) / 2);
  const x = Math.floor(u) - x0;
  const y = top - Math.floor(hv);
  const k = Math.floor(x / (4 * s));
  const gx = Math.floor((x - k * 4 * s) / s);
  if (x >= 0 && k < text.length && y >= 0 && y < 5 * s && gx < 3 && glyphOn(text[k]!, gx, Math.floor(y / s)))
    return at(C.neon, (x + y) % 4 === 0 ? 5 : 4);
  // Rejilla de leds apagados.
  return Math.floor(u) % 2 === 0 && Math.floor(hv) % 2 === 0 ? at(C.violet, 1) : at(C.night, 0);
}

/**
 * Recuadro de la tela de la pantalla del cine (`cinema-screen`, en la pared oeste), como VIDEO_WALL_SCREEN:
 * ahí proyecta el navegador la función. Entre los telones (9) y el marco negro (2).
 */
export const CINEMA_SCREEN = { u0: 11, uPad: 11, hv0: 12, hv1: 45 } as const;

/** Pantalla de cine con telón rojo a los lados y arriba; sin función muestra un atardecer. */
function cinemaScreenAt(u: number, hv: number, u1: number): RGBA | null {
  const cur = CINEMA_SCREEN.u0 - 2;
  if (!inRect(u, hv, 0, 8, u1, WALL_H - 3)) return null;
  // Cenefa arriba, festoneada y con un ribete dorado.
  const scallop = 2 * Math.abs(Math.sin((u / 8) * Math.PI));
  if (hv >= 47 - scallop) {
    if (hv < 48 - scallop) return at(C.gold, 4);
    const f = Math.floor(u) % 4;
    return at(C.curtain, f === 0 ? 1 : f === 3 ? 3 : 2);
  }
  // Telones laterales con pliegues y el borde de abajo dorado.
  const side = u < cur ? u : u >= u1 - cur ? u1 - 1 - u : -1;
  if (side >= 0) {
    if (hv < 10) return at(C.gold, 3);
    const f = Math.floor(u) % 3;
    return at(C.curtain, side > cur - 2 ? 1 : f === 0 ? 1 : f === 1 ? 3 : 2);
  }
  // Marco negro alrededor de la tela.
  if (hv < CINEMA_SCREEN.hv0 || hv >= CINEMA_SCREEN.hv1 || u < CINEMA_SCREEN.u0 || u >= u1 - CINEMA_SCREEN.uPad) return at(C.metal, 0);
  const x = u - cur - 2;
  const w = u1 - (cur + 2) * 2;
  // y crece hacia abajo desde el borde de arriba de la tela.
  const y = 44 - hv;
  const horizon = 20;
  const ridge = horizon - 4 - 4 * Math.sin(x * 0.09) - 3 * Math.sin(x * 0.23 + 1);
  const sun = Math.hypot(x - w * 0.62, y - horizon + 1);
  if (y >= horizon) {
    // Lago: reflejo del sol en rayas.
    const ref = Math.abs(x - w * 0.62) < 6 - (y - horizon) * 0.4 && Math.floor(y) % 2 === 0;
    return ref ? at(C.gold, 4) : at(C.navy, y > horizon + 5 ? 2 : 3);
  }
  if (y >= ridge) return at(C.violet, y < ridge + 2 ? 2 : 1);
  if (sun < 5) return at(C.gold, sun < 3 ? 5 : 4);
  const band = y / horizon + (bayer(Math.floor(x), Math.floor(y)) - 0.5) * 0.12;
  return band < 0.3 ? at(C.navy, 4) : band < 0.55 ? at(C.violet, 4) : band < 0.75 ? at(C.neon, 3) : at(C.fire, 3);
}

const POSTER_BG = [C.rug, C.navy, C.green, C.violet];

/** Afiche de película enmarcado: fondo de color, una figura y el título en una franja. */
function posterAt(f: WallFeature, u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 2, 18, u1 - 2, 50)) return null;
  if (u < 3 || u >= u1 - 3 || hv < 19 || hv >= 49) return at(C.gold, hv >= 49 || u >= u1 - 3 ? 4 : 2);
  const seed = f.x * 7 + f.y * 13;
  const bg = POSTER_BG[seed % POSTER_BG.length]!;
  const mid = u1 / 2;
  // Título abajo (rayitas claras) y estrellitas arriba.
  if (hv < 25) return hv >= 21 && hv < 23 && u > 5 && u < u1 - 5 && Math.floor(u) % 3 !== 0 ? at(C.cream, 5) : at(bg, 0);
  if (hv >= 45 && Math.floor(u) % 3 === 1) return at(C.gold, 5);
  const shape = seed % 3;
  if (shape === 0 && Math.hypot(u - mid, hv - 35) < 6) return at(C.gold, Math.hypot(u - mid - 1.5, hv - 36.5) < 3 ? 5 : 4);
  if (shape === 1 && Math.abs(u - mid) < (44 - hv) * 0.5 && hv > 28) return at(C.cream, hv > 40 ? 5 : 4);
  if (shape === 2 && (Math.hypot(u - mid, hv - 39) < 3 || (Math.abs(u - mid) < 3.5 - (hv - 28) * 0.1 && hv >= 28 && hv < 36))) return at(C.fire, 3);
  return at(bg, 2 + (bayer(Math.floor(u), Math.floor(hv)) < 0.2 ? 1 : 0));
}

function featureAt(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u0 = 0;
  const u1 = (f.width ?? 1) * L;
  const mid = u1 / 2;
  switch (f.kind) {
    case "window":
      return windowAt(u, hv, u0 + 4, u1 - 4, day);
    case "screen": {
      // La imagen es el recuadro de SCREEN_INSET (ahí monta el navegador una pantalla compartida).
      if (!inRect(u, hv, 2, 22, u1 - 2, 48)) return inRect(u, hv, mid - 2, 18, mid + 2, 22) ? at(C.metal, 2) : null;
      if (u < 4 || u >= u1 - 4 || hv < 24 || hv >= 46) return at(C.metal, u < 3 || hv >= 47 ? 3 : 1);
      // Pantalla apagada con un reflejo diagonal (el video se monta encima desde el cliente).
      if (Math.abs(u - 10 - (hv - 24) * 0.7) < 1.5) return at(C.metal, 2);
      return at(C.screen, 0);
    }
    case "whiteboard": {
      if (!inRect(u, hv, 3, 22, u1 - 3, 46)) return null;
      if (u < 5 || u >= u1 - 5 || hv < 24 || hv >= 44) return at(C.metal, hv < 24 ? 2 : 4);
      const line = (y: number, from: number, to: number) => Math.floor(hv) === y && u >= from && u < to;
      if (line(40, 8, 30) || line(37, 8, 22) || line(34, 12, 36)) return at(C.blue, 2);
      if (line(30, 8, 18) || (Math.hypot(u - 34, hv - 30) < 4 && Math.hypot(u - 34, hv - 30) > 3)) return at(C.rug, 3);
      return at(C.white, 4);
    }
    case "menu": {
      // Pizarra del menú con precios en puntos.
      if (!inRect(u, hv, 2, 24, u1 - 2, 48)) return null;
      if (u < 4 || u >= u1 - 4 || hv < 26 || hv >= 46) return at(C.wood, hv >= 47 ? 5 : 3);
      const row = Math.floor((45 - hv) / 4);
      const inRow = (45 - hv) % 4 < 1;
      if (row < 5 && inRow && u > 7 && u < 7 + 10 + noise(row, 0, 3) * 12) return at(C.cream, 5);
      if (row < 5 && inRow && u > u1 - 12 && u < u1 - 7) return at(C.gold, 4);
      return at(C.green, 0);
    }
    case "board": {
      if (!inRect(u, hv, 3, 24, u1 - 3, 42)) return null;
      if (u < 5 || u >= u1 - 5 || hv < 26 || hv >= 40) return at(C.wood, hv >= 40 ? 5 : 3);
      const notes: [number, number, RGBA][] = [
        [7, 33, at(C.gold, 4)],
        [14, 29, hex("#f4a5b5")],
        [20, 34, at(C.sage, 5)],
        [11, 35, at(C.sky, 3)],
      ];
      for (const [nu, nv, col] of notes)
        if (inRect(u, hv, nu, nv, nu + 5, nv + 4)) return hv >= nv + 3 && u >= nu + 2 && u < nu + 3 ? at(C.rug, 3) : col;
      return at(C.cork, 1 + Math.floor(noise(Math.floor(u), Math.floor(hv), 8) * 3));
    }
    case "picture": {
      if (!inRect(u, hv, 2, 26, u1 - 2, 44)) return null;
      if (u < 4 || u >= u1 - 4 || hv < 28 || hv >= 42) return at(C.gold, hv >= 42 || u >= u1 - 3 ? 4 : 2);
      if (Math.hypot(u - (u1 - 7), hv - 38) < 2.2) return at(C.gold, 5);
      if (hv < 31 + 2 * Math.sin(u * 0.5)) return at(C.leaf, 4);
      if (hv < 34 + 3 * Math.sin(u * 0.3 + 1)) return at(C.leaf, 2);
      return at(C.sky, 2 + (hv > 38 ? 1 : 0) + (bayer(Math.floor(u), Math.floor(hv)) < 0.3 ? 1 : 0));
    }
    case "clock": {
      const dx = u - mid;
      const dy = hv - 40;
      const r = Math.hypot(dx, dy * 1.1);
      if (r >= 6) return null;
      if (r >= 4.8) return at(C.woodDark, dy > 0 ? 4 : 2);
      if ((Math.abs(dx) < 0.8 && dy > 0 && dy < 3.5) || (Math.abs(dy) < 0.6 && dx > 0 && dx < 2.8)) return OUT;
      return at(C.cream, 4);
    }
    case "neon":
      return neonAt(f.text ?? "", u, hv, u1);
    case "cinema-screen":
      return cinemaScreenAt(u, hv, u1);
    case "video-wall":
      return videoWallAt(u, hv, u1);
    case "poster":
      return posterAt(f, u, hv, u1);
    // Interiores del rediseño (art/interior-room.ts).
    case "mirror":
    case "acoustic":
    case "ventanal":
    case "shelf":
    case "map":
    case "portrait":
      return interiorFeature(f, u, hv, day);
    // El garaje (art/garaje-room.ts).
    case "pegboard":
    case "barn-door":
    case "calendar":
    case "cobweb":
    case "dusty-window":
      return garajeFeature(f, u, hv, day);
    // La casa del árbol (art/casa-arbol-room.ts).
    case "treehouse-window":
    case "bunting":
      return casaArbolFeature(f, u, hv, day);
  }
}

/** Lo colgado sobre el muro: si es translúcido (una telaraña) se mezcla con la pared de atrás. */
function over(fc: RGBA | null | undefined, wall: () => RGBA): RGBA {
  if (!fc) return wall();
  return fc[3] >= 255 ? fc : mix(wall(), fc, fc[3] / 255);
}

/** Sombra suave del piso junto a las paredes altas (tramada, sin degradados). */
function occlusion(map: OfficeMap, tx: number, ty: number, u: number, v: number): number {
  const wallN = map.wallH[ty * map.width + tx] === 2;
  const wallW = map.wallV[ty * (map.width + 1) + tx] === 2;
  const d = Math.min(wallN ? v : 99, wallW ? u : 99);
  if (d < 2.5) return 0.45;
  if (d < 7 && bayer(Math.floor(u), Math.floor(v)) < (7 - d) / 7) return 0.35;
  return 0;
}

export interface AreaArt {
  /** Pisos y paredes altas (siempre al fondo). */
  base: Sprite;
  /** Dónde cae cada rasgo colgado de la pared (p. ej. para montar el video sobre la pantalla). */
  features: { feature: WallFeature; x: number; y: number; z: number }[];
}

/** Arma el fondo de un nivel: pisos, losa y paredes altas con lo que cuelga de ellas. */
export function drawAreaBase(map: OfficeMap, day: boolean): AreaArt {
  const W = map.width;
  const H = map.height;
  const roomWallpaper = (tx: number, ty: number): WallpaperKind | null => {
    const r = map.def.rooms.find((r) => tx >= r.rect.x && tx < r.rect.x + r.rect.w && ty >= r.rect.y && ty < r.rect.y + r.rect.h);
    return r?.wallpaper ?? null;
  };

  const boxes: Box[] = [];
  // Con alrededores no se ve la losa: sin alto, el dibujo del fondo sale más rápido.
  const slabH = map.def.surroundings ? 0.5 : map.outdoor ? 9 : SLAB;
  const sideRamp = map.outdoor ? C.dirt : C.woodDark;
  // Un bloque de losa por tile, de atrás hacia adelante: solo quedan a la vista los bordes expuestos.
  const order: [number, number][] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (map.floors[ty * W + tx]) order.push([tx, ty]);
  order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [tx, ty] of order) {
    const kind = map.floors[ty * W + tx]!;
    const wp = roomWallpaper(tx, ty);
    const x0 = tx * L;
    const y0 = ty * L;
    const side: Shader = (_u, v, _fw, fh) => {
      // Con alrededores (bosque sin fin) el terreno no tiene borde: no se dibuja la losa.
      if (map.def.surroundings) return null;
      if (map.outdoor && v >= fh - 2) return at(C.grass, v >= fh - 1 ? 3 : 1);
      return at(sideRamp, v < 1 ? 0 : v < fh / 2 ? 1 : 2);
    };
    boxes.push({
      x: x0,
      y: y0,
      z: -slabH,
      w: L,
      d: L,
      h: slabH,
      top: (u, v) => {
        if (map.def.groundFine) return outdoorColor(map, x0 + u, y0 + v);
        let c = floorColor(kind, x0 + u, y0 + v, wp);
        if (kind === "water") c = shore(map, tx, ty, u, v, c);
        const o = map.outdoor ? 0 : occlusion(map, tx, ty, u, v);
        return o ? mix(c, at(C.woodDark, 0), o) : c;
      },
      left: side,
      right: side,
    });
  }

  // Paredes altas: tramos de un tile hacia afuera del edificio, con la cara interior pintada.
  const features: AreaArt["features"] = [];
  const featureOn = (edge: "h" | "v", tx: number, ty: number) =>
    map.def.features.find((f) =>
      f.edge === edge && (edge === "h" ? f.y === ty && tx >= f.x && tx < f.x + (f.width ?? 1) : f.x === tx && ty >= f.y && ty < f.y + (f.width ?? 1)),
    );
  for (const f of map.def.features) {
    const len = (f.width ?? 1) * L;
    features.push(
      f.edge === "h"
        ? { feature: f, x: f.x * L + len / 2, y: f.y * L, z: 35 }
        : { feature: f, x: f.x * L, y: f.y * L + len / 2, z: 35 },
    );
  }
  const walls: Box[] = [];
  for (let ty = 0; ty <= H; ty++)
    for (let tx = 0; tx < W; tx++) {
      if (map.wallH[ty * W + tx] !== 2) continue;
      const r = WALLPAPER[roomWallpaper(tx, ty) ?? "sage"];
      const f = featureOn("h", tx, ty);
      walls.push({
        x: tx * L,
        y: ty * L - WALL_T,
        z: -SLAB,
        w: L,
        d: WALL_T,
        h: WALL_H + SLAB,
        top: flat(at(C.cream, 1)),
        right: flat(at(C.woodDark, 2)),
        left: (u, v) => {
          const X = tx * L + u;
          const hv = v - SLAB;
          const fc = f && featureAt(f, X - f.x * L, hv, day);
          return over(fc, () => interiorWall(roomWallpaper(tx, ty), X, hv) ?? wallpaper(X, hv, r, 0));
        },
      });
    }
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx <= W; tx++) {
      if (map.wallV[ty * (W + 1) + tx] !== 2) continue;
      const r = WALLPAPER[roomWallpaper(tx, ty) ?? "sage"];
      const f = featureOn("v", tx, ty);
      walls.push({
        x: tx * L - WALL_T,
        y: ty * L,
        z: -SLAB,
        w: WALL_T,
        d: L,
        h: WALL_H + SLAB,
        top: flat(at(C.cream, 1)),
        left: flat(at(C.woodDark, 2)),
        // En las paredes oeste `u` crece hacia la izquierda de la pantalla: se invierte para el dibujo.
        right: (u, v) => {
          const Y = ty * L + (L - u);
          const hv = v - SLAB;
          const fc = f && featureAt(f, (f.y + (f.width ?? 1)) * L - Y, hv, day);
          return over(fc, () => interiorWall(roomWallpaper(tx, ty), Y, hv) ?? wallpaper(Y, hv, r, -1));
        },
      });
    }
  // Esquina noroeste del edificio (donde se juntan las dos paredes altas).
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      if (map.wallH[ty * W + tx] === 2 && map.wallV[ty * (W + 1) + tx] === 2) {
        walls.push({ x: tx * L - WALL_T, y: ty * L - WALL_T, z: -SLAB, w: WALL_T, d: WALL_T, h: WALL_H + SLAB, top: flat(at(C.cream, 1)), left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 2)) });
      }
    }
  walls.sort((a, b) => a.x + a.y - (b.x + b.y));

  // Con alrededores el terreno sigue en el bosque de afuera: sin contorno, que marcaría el borde.
  const base = renderSprite([...boxes, ...walls], { outline: map.def.surroundings ? undefined : OUT });
  // Si renderSprite cambiara su relleno (o el fondo su forma), el margen quedaría corrido respecto del
  // bosque que el cliente repite alrededor y se vería la costura: mejor fallar aquí.
  const o = baseOrigin(map);
  if (map.def.surroundings && (base.ox !== o.ox || base.oy !== o.oy))
    throw new Error(`El fondo de ${map.id} no tiene el origen esperado (${base.ox}, ${base.oy}) ≠ (${o.ox}, ${o.oy})`);
  return { base, features };
}

/**
 * Paredes del fondo (norte y oeste) de una sala, altas como las del edificio y con su papel mural: el
 * "modo privado" de las oficinas. Donde ya hay pared alta o una puerta no se dibuja nada. Las de adelante
 * siguen bajas (si no, taparían la sala). El sprite va en coordenadas de arte del nivel, como el fondo.
 */
export function drawRoomWalls(map: OfficeMap, rect: { x: number; y: number; w: number; h: number }): Sprite | null {
  const W = map.width;
  const wp = map.def.rooms.find((r) => rect.x >= r.rect.x && rect.x < r.rect.x + r.rect.w && rect.y >= r.rect.y && rect.y < r.rect.y + r.rect.h)?.wallpaper ?? "sage";
  const r = WALLPAPER[wp];
  const walls: Box[] = [];
  const north = (tx: number) => map.wallH[rect.y * W + tx] ?? 0;
  const west = (ty: number) => map.wallV[ty * (W + 1) + rect.x] ?? 0;
  for (let tx = rect.x; tx < rect.x + rect.w; tx++) {
    if (north(tx) !== 1) continue;
    walls.push({
      x: tx * L,
      y: rect.y * L - WALL_T,
      z: 0,
      w: L,
      d: WALL_T,
      h: WALL_H,
      top: flat(at(C.cream, 1)),
      right: flat(at(C.woodDark, 2)),
      left: (u, v) => interiorWall(wp, tx * L + u, v) ?? wallpaper(tx * L + u, v, r, 0),
    });
  }
  for (let ty = rect.y; ty < rect.y + rect.h; ty++) {
    if (west(ty) !== 1) continue;
    walls.push({
      x: rect.x * L - WALL_T,
      y: ty * L,
      z: 0,
      w: WALL_T,
      d: L,
      h: WALL_H,
      top: flat(at(C.cream, 1)),
      left: flat(at(C.woodDark, 2)),
      right: (u, v) => {
        const Y = ty * L + (L - u);
        return interiorWall(wp, Y, v) ?? wallpaper(Y, v, r, -1);
      },
    });
  }
  if (walls.length === 0) return null;
  // La esquina donde se juntan, si alguna de las dos se levantó.
  if (north(rect.x) === 1 || west(rect.y) === 1)
    walls.push({ x: rect.x * L - WALL_T, y: rect.y * L - WALL_T, z: 0, w: WALL_T, d: WALL_T, h: WALL_H, top: flat(at(C.cream, 1)), left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 2)) });
  walls.sort((a, b) => a.x + a.y - (b.x + b.y));
  return renderSprite(walls, { outline: OUT });
}

// ---------- Paredes bajas ----------

const lowWallShader: Shader = (u, v, _fw, fh) => {
  if (v >= fh - 2) return at(C.cream, v >= fh - 1 ? 4 : 2);
  if (v < 2) return at(C.woodDark, 2);
  return at(C.wood, Math.floor(u) % 8 === 0 ? 1 : 3);
};

/** Pieza de pared baja de un tile: `h` corre a lo largo de x y `v` a lo largo de y. */
export function drawLowWall(edge: "h" | "v"): Sprite {
  const b: Box =
    edge === "h"
      ? { x: 0, y: -1.5, z: 0, w: L, d: 3, h: LOW_WALL_H, top: flat(at(C.cream, 4)), left: lowWallShader, right: flat(at(C.wood, 2)) }
      : { x: -1.5, y: 0, z: 0, w: 3, d: L, h: LOW_WALL_H, top: flat(at(C.cream, 4)), left: flat(at(C.wood, 2)), right: lowWallShader };
  return renderSprite([b], { outline: OUT });
}

/** Poste de marco de puerta en paredes bajas. */
export function drawDoorPost(): Sprite {
  return renderSprite([{ x: -2, y: -2, z: 0, w: 4, d: 4, h: LOW_WALL_H + 4, top: flat(at(C.cream, 4)), left: flat(at(C.woodDark, 3)), right: flat(at(C.woodDark, 2)) }], {
    outline: OUT,
  });
}
