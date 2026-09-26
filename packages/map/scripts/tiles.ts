// Tileset 32x32 dibujado por código: estilo plano y claro, basado en el diseño de la oficina del equipo.
// Los muebles grandes (mesa, sofás, alfombra, escritorios) se dibujan enteros y se cortan en tiles.
import { Canvas, hex, type RGBA } from "./pixels";

export const TILE = 32;
export const COLUMNS = 8;
export const ROWS = 7;

/** Índices del tileset (gid en Tiled = índice + 1). */
export const T = {
  FLOOR_WOOD: 0,
  FLOOR_CARPET: 1,
  FLOOR_MEETING: 2,
  FLOOR_COWORK: 3,
  DOOR: 4,
  DOOR_V: 5,
  WALL_TOP: 6,
  WALL_FACE: 7,
  WINDOW: 8,
  WHITEBOARD_L: 9,
  WHITEBOARD_R: 10,
  GLASS: 11,
  DESK_PC: 12,
  DESK: 13,
  COWORK_DESK_L: 14,
  COWORK_DESK_R: 15,
  CHAIR: 16,
  CHAIR_DOWN: 17,
  PLANT: 18,
  BOOKSHELF: 19,
  TABLE_TL: 20,
  TABLE_T: 21,
  TABLE_PHONE: 22,
  TABLE_TR: 23,
  TABLE_BL: 24,
  TABLE_B: 25,
  TABLE_BR: 26,
  SOFA_TOP_L: 27,
  SOFA_TOP_M: 28,
  SOFA_TOP_R: 29,
  SOFA_BOTTOM_L: 30,
  SOFA_BOTTOM_M: 31,
  SOFA_BOTTOM_R: 32,
  COFFEE_TABLE_TL: 33,
  COFFEE_TABLE_TR: 34,
  COFFEE_TABLE_BL: 35,
  COFFEE_TABLE_BR: 36,
  COFFEE: 37,
  TASKBOARD: 38,
  RUG_TL: 39,
  RUG_T: 40,
  RUG_TR: 41,
  RUG_L: 42,
  RUG_C: 43,
  RUG_R: 44,
  RUG_BL: 45,
  RUG_B: 46,
  RUG_BR: 47,
  FLOOR_WOOD_JOINT: 48,
} as const;

/** Tiles que bloquean el paso (propiedad `collides` en Tiled). */
export const COLLIDES: number[] = [
  T.WALL_TOP,
  T.WALL_FACE,
  T.WINDOW,
  T.WHITEBOARD_L,
  T.WHITEBOARD_R,
  T.GLASS,
  T.DESK_PC,
  T.DESK,
  T.COWORK_DESK_L,
  T.COWORK_DESK_R,
  T.PLANT,
  T.BOOKSHELF,
  T.TABLE_TL,
  T.TABLE_T,
  T.TABLE_PHONE,
  T.TABLE_TR,
  T.TABLE_BL,
  T.TABLE_B,
  T.TABLE_BR,
  T.SOFA_TOP_L,
  T.SOFA_TOP_M,
  T.SOFA_TOP_R,
  T.SOFA_BOTTOM_L,
  T.SOFA_BOTTOM_M,
  T.SOFA_BOTTOM_R,
  T.COFFEE_TABLE_TL,
  T.COFFEE_TABLE_TR,
  T.COFFEE_TABLE_BL,
  T.COFFEE_TABLE_BR,
  T.COFFEE,
  T.TASKBOARD,
];

const C = {
  wood: hex("#d8bd98"),
  woodSeam: hex("#caae89"),
  threshold: hex("#c7ab88"),
  thresholdEdge: hex("#b59f80"),
  carpet: hex("#aeb9cb"),
  carpetDot: hex("#bbc4d3"),
  tile: hex("#ebe7df"),
  grout: hex("#ddd9d2"),
  cowork: hex("#505a6c"),
  coworkDot: hex("#5e6778"),
  wall: hex("#4b5263"),
  cream: hex("#f1ede4"),
  creamLine: hex("#e8e5dc"),
  baseboard: hex("#b9a386"),
  baseboardEdge: hex("#a08a6c"),
  frame: hex("#aeb8c3"),
  glassFrame: hex("#7d8c9c"),
  deskTop: hex("#f7f6f3"),
  deskLine: hex("#e6e5e2"),
  deskFront: hex("#cfcac1"),
  bezel: hex("#262b34"),
  bezelDark: hex("#1f242d"),
  chair: hex("#3b4c78"),
  chairBase: hex("#26335a"),
  table: hex("#8b6647"),
  tableLine: hex("#72543a"),
  tableEdge: hex("#5f432f"),
  sofa: hex("#557397"),
  sofaDark: hex("#3f5878"),
  sofaSeam: hex("#4b6585"),
  rug: hex("#6c7fa0"),
  rugLine: hex("#798ba9"),
  rugKnot: hex("#8595b1"),
  rugBorder: hex("#5a6c8c"),
  rugInner: hex("#8999b3"),
  white: hex("#ffffff"),
  appliance: hex("#e6e8ec"),
  applianceBase: hex("#b9bec6"),
  leafDark: hex("#4f8a5d"),
  leaf: hex("#6aa877"),
  leafLight: hex("#8cc594"),
  pot: hex("#e8e3d9"),
  potShade: hex("#d6d0c4"),
  blue: hex("#0078bf"),
  red: hex("#d64545"),
};
/** Sombra suave de los muebles: se mezcla con cualquier suelo. */
const SHADOW: RGBA = [0, 0, 0, 40];

type Draw = (c: Canvas, x: number, y: number) => void;

// ---------- Suelos ----------

/** Tablas de 64x16: el suelo alterna columnas lisas y columnas con la unión de las tablas. */
const woodPlanks = (joint: boolean): Draw => (c, ox, oy) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const seam = y % 16 === 15 || (joint && x === 0);
      c.set(ox + x, oy + y, seam ? C.woodSeam : C.wood);
    }
};
const floorWood = woodPlanks(false);
const floorWoodJoint = woodPlanks(true);

const floorCarpet: Draw = (c, ox, oy) => {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dot = (x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3);
      c.set(ox + x, oy + y, dot ? C.carpetDot : C.carpet);
    }
};

const floorMeeting: Draw = (c, ox, oy) => {
  c.rect(ox, oy, TILE, TILE, C.tile);
  c.rect(ox, oy, TILE, 1, C.grout);
  c.rect(ox, oy, 1, TILE, C.grout);
};

const floorCowork: Draw = (c, ox, oy) => {
  c.rect(ox, oy, TILE, TILE, C.cowork);
  for (const [cx, cy] of [
    [2, 2],
    [6, 6],
  ] as const)
    for (let y = cy; y < TILE; y += 8)
      for (let x = cx; x < TILE; x += 8) {
        c.set(ox + x, oy + y, C.coworkDot);
        c.set(ox + x - 1, oy + y, C.coworkDot);
        c.set(ox + x + 1, oy + y, C.coworkDot);
        c.set(ox + x, oy + y - 1, C.coworkDot);
        c.set(ox + x, oy + y + 1, C.coworkDot);
      }
};

/** Umbral de una puerta en un muro horizontal (vidrio o muro). */
const door: Draw = (c, ox, oy) => {
  floorWood(c, ox, oy);
  c.rect(ox, oy + 12, TILE, 6, C.threshold);
  c.rect(ox, oy + 18, TILE, 1, C.thresholdEdge);
};

/** Umbral de una puerta en un muro vertical. */
const doorV: Draw = (c, ox, oy) => {
  floorWood(c, ox, oy);
  c.rect(ox + 12, oy, 6, TILE, C.threshold);
  c.rect(ox + 18, oy, 1, TILE, C.thresholdEdge);
};

// ---------- Muros ----------

const wallTop: Draw = (c, ox, oy) => c.rect(ox, oy, TILE, TILE, C.wall);

const wallFace: Draw = (c, ox, oy) => {
  c.rect(ox, oy, TILE, 26, C.cream);
  for (let x = 0; x < TILE; x += 16) c.rect(ox + x, oy, 1, 26, C.creamLine);
  c.rect(ox, oy + 26, TILE, 5, C.baseboard);
  c.rect(ox, oy + 31, TILE, 1, C.baseboardEdge);
};

const windowTile: Draw = (c, ox, oy) => {
  wallFace(c, ox, oy);
  c.roundRect(ox + 3, oy + 4, 26, 20, 1, C.frame);
  for (let y = 0; y < 16; y++) {
    const t = y / 15;
    const glass: RGBA = [Math.round(212 - 43 * t), Math.round(229 - 31 * t), Math.round(240 - 21 * t), 255];
    c.rect(ox + 5, oy + 6 + y, 22, 1, glass);
  }
  c.rect(ox + 15, oy + 6, 2, 16, C.frame);
};

/** Muro de vidrio: transparente salvo la franja, deja ver el suelo. */
const glass: Draw = (c, ox, oy) => {
  c.rect(ox, oy + 11, TILE, 1, C.glassFrame);
  c.rect(ox, oy + 12, TILE, 1, hex("#c9dae2"));
  c.rect(ox, oy + 13, TILE, 1, hex("#b7cdd8"));
  c.rect(ox, oy + 14, TILE, 2, hex("#a6c1cf"));
  c.rect(ox, oy + 16, TILE, 3, C.glassFrame);
  c.rect(ox, oy + 11, 1, 8, C.glassFrame);
};

// ---------- Muebles de un tile ----------

const chairBody = (c: Canvas, ox: number, oy: number, bodyY: number) => {
  c.roundRect(ox + 7, oy + bodyY + 2, 21, 16, 5, SHADOW);
  c.roundRect(ox + 6, oy + bodyY, 21, 16, 5, C.chair);
};

/** Silla mirando hacia arriba (respaldo abajo). */
const chair: Draw = (c, ox, oy) => {
  chairBody(c, ox, oy, 5);
  c.roundRect(ox + 5, oy + 19, 23, 8, 3, C.chairBase);
};

/** Silla mirando hacia abajo (respaldo arriba). */
const chairDown: Draw = (c, ox, oy) => {
  chairBody(c, ox, oy, 8);
  c.roundRect(ox + 5, oy + 2, 23, 8, 3, C.chairBase);
};

const plant: Draw = (c, ox, oy) => {
  c.ellipse(ox + 16, oy + 28, 12, 3, SHADOW);
  c.roundRect(ox + 10, oy + 16, 13, 13, 2, C.pot);
  c.rect(ox + 20, oy + 18, 2, 10, C.potShade);
  c.ellipse(ox + 16, oy + 11, 8, 7, C.leafDark);
  c.ellipse(ox + 12, oy + 8, 5, 5, C.leaf);
  c.ellipse(ox + 20, oy + 8, 5, 5, C.leaf);
  c.ellipse(ox + 16, oy + 13, 5, 4, C.leafDark);
  c.ellipse(ox + 11, oy + 6, 3, 3, C.leafLight);
  c.ellipse(ox + 17, oy + 5, 3, 3, C.leafLight);
};

const bookshelf: Draw = (c, ox, oy) => {
  c.roundRect(ox + 4, oy + 3, 28, 29, 1, SHADOW);
  c.roundRect(ox + 2, oy, 28, 29, 1, hex("#8a6649"));
  const books = ["#48729c", "#56866a", "#c9983f", "#9d4f45", "#e8e3d9", "#48729c", "#56866a"];
  for (let row = 0; row < 3; row++) {
    const y = oy + 2 + row * 9;
    c.rect(ox + 4, y, 24, 7, hex("#6e4f37"));
    for (let b = 0; b < 6; b++) {
      const short = b % 3 === 1 ? 1 : 0; // libros de distinta altura
      c.rect(ox + 4 + b * 4, y + short, 3, 7 - short, hex(books[(b + row * 3) % books.length]!));
    }
  }
};

const coffee: Draw = (c, ox, oy) => {
  c.roundRect(ox + 4, oy + 5, 28, 26, 2, SHADOW);
  c.roundRect(ox + 2, oy + 2, 28, 26, 2, C.applianceBase);
  c.roundRect(ox + 2, oy + 2, 28, 20, 2, C.appliance);
  c.rect(ox + 4, oy + 2, 24, 1, hex("#f4f5f7"));
  c.roundRect(ox + 6, oy + 5, 15, 6, 2, hex("#2a2f38"));
  c.rect(ox + 25, oy + 6, 2, 2, hex("#2fbf71"));
  c.rect(ox + 5, oy + 13, 22, 6, hex("#cfd3d9"));
  c.rect(ox + 6, oy + 14, 20, 4, C.white);
};

const taskboard: Draw = (c, ox, oy) => {
  c.rect(ox + 14, oy + 22, 4, 8, hex("#939caa"));
  c.roundRect(ox + 2, oy + 1, 28, 22, 1, C.frame);
  c.rect(ox + 4, oy + 3, 24, 18, C.white);
  c.rect(ox + 6, oy + 5, 9, 6, hex("#f2d479"));
  c.rect(ox + 17, oy + 5, 9, 6, hex("#9cc3e6"));
  c.rect(ox + 6, oy + 13, 9, 6, hex("#f0a8b8"));
  c.rect(ox + 17, oy + 13, 9, 6, hex("#a8d8b0"));
};

// ---------- Muebles de varios tiles ----------

/** Un mueble dibujado entero en un canvas de `w`x`h` tiles y cortado en piezas. */
interface Piece {
  w: number;
  h: number;
  draw: (c: Canvas) => void;
  /** tile del tileset → posición (en tiles) de la pieza dentro del mueble. */
  pieces: [tile: number, col: number, row: number][];
}

const deskBase = (c: Canvas) => {
  c.roundRect(4, 4, 60, 27, 2, SHADOW);
  c.roundRect(1, 1, 60, 27, 2, C.deskFront);
  c.roundRect(1, 1, 60, 23, 2, C.deskTop);
  c.rect(3, 23, 56, 1, C.deskLine);
};

const officeDesk: Piece = {
  w: 2,
  h: 1,
  draw: (c) => {
    deskBase(c);
    c.roundRect(3, 4, 20, 13, 1, C.bezel);
    for (let y = 0; y < 9; y++) {
      const t = y / 8;
      c.rect(5, 6 + y, 16, 1, [Math.round(58 + 34 * t), Math.round(90 + 37 * t), Math.round(138 + 38 * t), 255]);
    }
    c.rect(10, 17, 6, 2, C.bezel);
    c.rect(36, 6, 14, 12, C.deskFront);
    c.rect(37, 7, 12, 10, C.white);
    c.rect(54, 6, 2, 2, hex("#e04848"));
  },
  pieces: [
    [T.DESK_PC, 0, 0],
    [T.DESK, 1, 0],
  ],
};

const coworkDesk: Piece = {
  w: 2,
  h: 1,
  draw: (c) => {
    deskBase(c);
    for (const x of [3, 35]) {
      c.roundRect(x, 4, 20, 14, 2, C.bezelDark);
      c.rect(x + 2, 6, 16, 9, C.bezel);
      c.rect(x + 6, 10, 8, 2, hex("#5ad1dc"));
      c.rect(x + 6, 18, 8, 1, C.bezel);
    }
  },
  pieces: [
    [T.COWORK_DESK_L, 0, 0],
    [T.COWORK_DESK_R, 1, 0],
  ],
};

const whiteboard: Piece = {
  w: 2,
  h: 1,
  draw: (c) => {
    wallFace(c, 0, 0);
    wallFace(c, TILE, 0);
    c.roundRect(3, 3, 58, 21, 1, C.frame);
    c.rect(5, 5, 54, 17, C.white);
    c.rect(8, 8, 28, 2, C.blue);
    c.rect(8, 13, 20, 2, C.red);
    c.rect(8, 18, 34, 1, C.blue);
  },
  pieces: [
    [T.WHITEBOARD_L, 0, 0],
    [T.WHITEBOARD_R, 1, 0],
  ],
};

const meetingTable: Piece = {
  w: 5,
  h: 2,
  draw: (c) => {
    c.roundRect(3, 3, 157, 61, 4, SHADOW);
    c.roundRect(0, 0, 157, 61, 4, C.tableEdge);
    c.roundRect(0, 0, 157, 55, 4, C.table);
    c.rect(5, 30, 147, 1, C.tableLine);
    c.roundRect(70, 15, 20, 11, 2, hex("#2a2f38"));
  },
  pieces: [
    [T.TABLE_TL, 0, 0],
    [T.TABLE_T, 1, 0],
    [T.TABLE_PHONE, 2, 0],
    [T.TABLE_TR, 4, 0],
    [T.TABLE_BL, 0, 1],
    [T.TABLE_B, 1, 1],
    [T.TABLE_BR, 4, 1],
  ],
};

const sofaSeams = (c: Canvas, y: number, h: number) => {
  for (const x of [32, 64, 96]) c.rect(x, y, 1, h, C.sofaSeam);
};

/** Sofá de 4 tiles con respaldo arriba (mira hacia abajo). */
const sofaTop: Piece = {
  w: 4,
  h: 1,
  draw: (c) => {
    c.roundRect(2, 5, 126, 26, 3, SHADOW);
    c.roundRect(0, 2, 126, 26, 3, C.sofaDark);
    c.rect(7, 10, 112, 17, C.sofa);
    sofaSeams(c, 10, 17);
  },
  pieces: [
    [T.SOFA_TOP_L, 0, 0],
    [T.SOFA_TOP_M, 1, 0],
    [T.SOFA_TOP_R, 3, 0],
  ],
};

/** Sofá de 4 tiles con respaldo abajo (mira hacia arriba). */
const sofaBottom: Piece = {
  w: 4,
  h: 1,
  draw: (c) => {
    c.roundRect(2, 6, 126, 26, 3, SHADOW);
    c.roundRect(0, 3, 126, 26, 3, C.sofaDark);
    c.rect(7, 3, 112, 17, C.sofa);
    sofaSeams(c, 3, 17);
  },
  pieces: [
    [T.SOFA_BOTTOM_L, 0, 0],
    [T.SOFA_BOTTOM_M, 1, 0],
    [T.SOFA_BOTTOM_R, 3, 0],
  ],
};

const coffeeTable: Piece = {
  w: 2,
  h: 2,
  draw: (c) => {
    c.roundRect(6, 13, 58, 42, 4, SHADOW);
    c.roundRect(3, 10, 58, 42, 4, C.tableEdge);
    c.roundRect(3, 10, 58, 37, 4, C.table);
  },
  pieces: [
    [T.COFFEE_TABLE_TL, 0, 0],
    [T.COFFEE_TABLE_TR, 1, 0],
    [T.COFFEE_TABLE_BL, 0, 1],
    [T.COFFEE_TABLE_BR, 1, 1],
  ],
};

/** Alfombra con borde (capa de suelo): se corta en 9 piezas y el centro se repite. */
const rug: Piece = {
  w: 6,
  h: 4,
  draw: (c) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) (x % 2 ? floorWood : floorWoodJoint)(c, x * TILE, y * TILE);
    const w = 6 * TILE;
    const h = 4 * TILE;
    c.roundRect(0, 0, w, h, 3, C.rugBorder);
    c.rect(4, 4, w - 8, h - 8, C.rugInner);
    for (let y = 5; y < h - 5; y++)
      for (let x = 5; x < w - 5; x++) {
        const a = (x + y) % 16 < 2;
        const b = (((x - y) % 16) + 16) % 16 < 2;
        c.set(x, y, a && b ? C.rugKnot : a || b ? C.rugLine : C.rug);
      }
  },
  pieces: [
    [T.RUG_TL, 0, 0],
    [T.RUG_T, 1, 0],
    [T.RUG_TR, 5, 0],
    [T.RUG_L, 0, 1],
    [T.RUG_C, 1, 1],
    [T.RUG_R, 5, 1],
    [T.RUG_BL, 0, 3],
    [T.RUG_B, 1, 3],
    [T.RUG_BR, 5, 3],
  ],
};

const DRAW: Record<number, Draw> = {
  [T.FLOOR_WOOD]: floorWood,
  [T.FLOOR_WOOD_JOINT]: floorWoodJoint,
  [T.FLOOR_CARPET]: floorCarpet,
  [T.FLOOR_MEETING]: floorMeeting,
  [T.FLOOR_COWORK]: floorCowork,
  [T.DOOR]: door,
  [T.DOOR_V]: doorV,
  [T.WALL_TOP]: wallTop,
  [T.WALL_FACE]: wallFace,
  [T.WINDOW]: windowTile,
  [T.GLASS]: glass,
  [T.CHAIR]: chair,
  [T.CHAIR_DOWN]: chairDown,
  [T.PLANT]: plant,
  [T.BOOKSHELF]: bookshelf,
  [T.COFFEE]: coffee,
  [T.TASKBOARD]: taskboard,
};

const PIECES: Piece[] = [officeDesk, coworkDesk, whiteboard, meetingTable, sofaTop, sofaBottom, coffeeTable, rug];

const slot = (i: number) => [(i % COLUMNS) * TILE, Math.floor(i / COLUMNS) * TILE] as const;

export function drawTileset(): Canvas {
  const c = new Canvas(COLUMNS * TILE, ROWS * TILE);
  for (const [idx, draw] of Object.entries(DRAW)) {
    const [x, y] = slot(Number(idx));
    draw(c, x, y);
  }
  for (const piece of PIECES) {
    const full = new Canvas(piece.w * TILE, piece.h * TILE);
    piece.draw(full);
    for (const [tile, col, row] of piece.pieces) {
      const [x, y] = slot(tile);
      c.blit(full, col * TILE, row * TILE, TILE, TILE, x, y);
    }
  }
  return c;
}
