// Tileset placeholder 32x32 dibujado por código. Reemplazable luego por un tileset real (p. ej. LimeZu).
import { Canvas, hex, noise, shade, type RGBA } from "./pixels";

export const TILE = 32;
export const COLUMNS = 8;
export const ROWS = 3;

/** Índices del tileset (gid en Tiled = índice + 1). */
export const T = {
  FLOOR_WOOD: 0,
  FLOOR_CARPET: 1,
  FLOOR_MEETING: 2,
  FLOOR_LAB: 3,
  WALL_TOP: 4,
  WALL_FACE: 5,
  DESK: 6,
  DESK_PC: 7,
  CHAIR: 8,
  PLANT: 9,
  SOFA: 10,
  TABLE: 11,
  TASKBOARD: 12,
  BOOKSHELF: 13,
  RUG: 14,
  DOOR: 15,
  COFFEE: 16,
  WINDOW: 17,
  LAB_DESK: 18,
  LAB_CHAIR: 19,
  WHITEBOARD: 20,
} as const;

/** Tiles que bloquean el paso (propiedad `collides` en Tiled). */
export const COLLIDES: number[] = [
  T.WALL_TOP,
  T.WALL_FACE,
  T.DESK,
  T.DESK_PC,
  T.PLANT,
  T.SOFA,
  T.TABLE,
  T.TASKBOARD,
  T.BOOKSHELF,
  T.COFFEE,
  T.WINDOW,
  T.LAB_DESK,
  T.WHITEBOARD,
];

const OUT = hex("#1b1b24");

type Draw = (c: Canvas, x: number, y: number) => void;

const floorWood: Draw = (c, ox, oy) => {
  const base = hex("#c8976a");
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const plank = Math.floor(y / 8);
      const seam = y % 8 === 7 || (x + plank * 13) % 32 === 0;
      const n = noise(ox + x, oy + y, 1) * 0.08 - 0.04;
      c.set(ox + x, oy + y, seam ? shade(base, -0.22) : shade(base, n + (plank % 2 ? -0.03 : 0)));
    }
};

const floorCarpet: Draw = (c, ox, oy) => {
  const base = hex("#5c6f9e");
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dither = (x + y) % 4 === 0 ? -0.06 : 0;
      c.set(ox + x, oy + y, shade(base, dither + noise(ox + x, oy + y, 2) * 0.05));
    }
};

const floorMeeting: Draw = (c, ox, oy) => {
  const base = hex("#d9d3c3");
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const grout = x % 16 === 0 || y % 16 === 0;
      c.set(ox + x, oy + y, grout ? shade(base, -0.15) : shade(base, noise(ox + x, oy + y, 3) * 0.05));
    }
};

const floorLab: Draw = (c, ox, oy) => {
  const base = hex("#2b3044");
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const grid = x % 16 === 0 || y % 16 === 0;
      c.set(ox + x, oy + y, grid ? hex("#34405e") : shade(base, noise(ox + x, oy + y, 4) * 0.06));
    }
  c.set(ox + 16, oy + 16, hex("#5ee1e6"));
  c.set(ox, oy, hex("#5ee1e6"));
};

const wallTop: Draw = (c, ox, oy) => {
  c.rect(ox, oy, TILE, TILE, hex("#3d3f58"));
  for (let y = 0; y < TILE; y += 8) c.rect(ox, oy + y, TILE, 1, hex("#34364c"));
  c.rect(ox, oy, TILE, 2, hex("#4c4f6c"));
};

const wallFace: Draw = (c, ox, oy) => {
  c.rect(ox, oy, TILE, TILE, hex("#e9e2d2"));
  for (let x = 0; x < TILE; x += 8) c.rect(ox + x, oy + 2, 1, TILE - 8, hex("#ddd5c3"));
  c.rect(ox, oy, TILE, 2, hex("#c9bfa9"));
  c.rect(ox, oy + TILE - 6, TILE, 6, hex("#8b6a4b")); // zócalo
  c.rect(ox, oy + TILE - 6, TILE, 1, hex("#a4815f"));
};

const windowTile: Draw = (c, ox, oy) => {
  wallFace(c, ox, oy);
  c.box(ox + 4, oy + 4, 24, 18, hex("#9fd3f0"), hex("#6b5a48"));
  c.rect(ox + 15, oy + 5, 2, 16, hex("#6b5a48"));
  c.rect(ox + 6, oy + 6, 6, 2, hex("#d9f1ff"));
};

const deskTop = (c: Canvas, ox: number, oy: number, wood: RGBA) => {
  c.box(ox + 1, oy + 6, 30, 20, wood, OUT);
  c.rect(ox + 2, oy + 7, 28, 2, shade(wood, 0.2));
  c.rect(ox + 2, oy + 24, 28, 2, shade(wood, -0.25));
};

const desk: Draw = (c, ox, oy) => {
  deskTop(c, ox, oy, hex("#9a6a3f"));
  c.rect(ox + 6, oy + 13, 10, 7, hex("#f2efe6")); // papeles
  c.rect(ox + 7, oy + 15, 8, 1, hex("#b9b3a5"));
  c.rect(ox + 22, oy + 12, 4, 5, hex("#d65a4a")); // taza
};

const deskPc: Draw = (c, ox, oy) => {
  deskTop(c, ox, oy, hex("#9a6a3f"));
  c.box(ox + 7, oy + 3, 18, 13, hex("#4aa3df"), OUT); // monitor
  c.rect(ox + 9, oy + 5, 6, 2, hex("#bfe6ff"));
  c.rect(ox + 14, oy + 16, 4, 3, hex("#2a2a35"));
  c.rect(ox + 9, oy + 20, 14, 3, hex("#3a3a48")); // teclado
};

const chair: Draw = (c, ox, oy) => {
  c.ellipse(ox + 16, oy + 17, 8, 8, hex("#3b4a6b"));
  c.rect(ox + 9, oy + 6, 14, 5, hex("#2e3a55"));
  c.outline(ox, oy, TILE, TILE, OUT);
};

const labChair: Draw = (c, ox, oy) => {
  c.ellipse(ox + 16, oy + 17, 8, 8, hex("#3a3f5c"));
  c.rect(ox + 9, oy + 6, 14, 5, hex("#5ee1e6"));
  c.outline(ox, oy, TILE, TILE, OUT);
};

const plant: Draw = (c, ox, oy) => {
  c.box(ox + 10, oy + 20, 12, 10, hex("#c0643e"), OUT);
  const leaf = hex("#4c9a52");
  c.ellipse(ox + 16, oy + 13, 9, 8, leaf);
  c.ellipse(ox + 11, oy + 10, 5, 5, shade(leaf, 0.15));
  c.ellipse(ox + 21, oy + 9, 5, 5, shade(leaf, -0.1));
  c.ellipse(ox + 16, oy + 6, 4, 4, shade(leaf, 0.25));
  c.outline(ox, oy, TILE, TILE, OUT);
};

const sofa: Draw = (c, ox, oy) => {
  const f = hex("#3f8f8a");
  c.box(ox, oy + 6, 32, 22, f, OUT);
  c.rect(ox + 1, oy + 7, 30, 7, shade(f, -0.2)); // respaldo
  c.rect(ox + 15, oy + 15, 1, 12, shade(f, -0.3));
};

const table: Draw = (c, ox, oy) => {
  const w = hex("#6e4527");
  c.rect(ox, oy + 2, 32, 28, w);
  c.rect(ox, oy + 2, 32, 1, OUT);
  c.rect(ox, oy + 29, 32, 1, OUT);
  c.rect(ox, oy + 4, 32, 2, shade(w, 0.2));
  for (let x = 0; x < 32; x += 11) c.rect(ox + x, oy + 8, 1, 20, shade(w, -0.15));
};

const taskboard: Draw = (c, ox, oy) => {
  c.box(ox + 1, oy + 2, 30, 24, hex("#f7f5ef"), hex("#4a4a5a"));
  const notes = ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#ffd166", "#06d6a0"];
  notes.forEach((n, i) => c.rect(ox + 4 + (i % 3) * 9, oy + 5 + Math.floor(i / 3) * 9, 6, 6, hex(n)));
  c.rect(ox + 6, oy + 26, 2, 5, hex("#4a4a5a"));
  c.rect(ox + 24, oy + 26, 2, 5, hex("#4a4a5a"));
};

const whiteboard: Draw = (c, ox, oy) => {
  wallFace(c, ox, oy);
  c.box(ox + 2, oy + 3, 28, 18, hex("#fbfbf8"), hex("#8a8f9c"));
  c.rect(ox + 5, oy + 7, 14, 1, hex("#3a86ff"));
  c.rect(ox + 5, oy + 11, 18, 1, hex("#ef476f"));
  c.rect(ox + 5, oy + 15, 10, 1, hex("#3a86ff"));
};

const bookshelf: Draw = (c, ox, oy) => {
  c.box(ox + 1, oy + 1, 30, 30, hex("#7a4e2d"), OUT);
  const books = ["#ef476f", "#118ab2", "#ffd166", "#06d6a0", "#8338ec", "#fb8500"];
  for (let row = 0; row < 3; row++) {
    c.rect(ox + 2, oy + 10 + row * 9, 28, 1, hex("#5a3820"));
    for (let b = 0; b < 6; b++) {
      const col = hex(books[(b + row * 2) % books.length]!);
      c.rect(ox + 3 + b * 4 + (row % 2), oy + 3 + row * 9, 3, 7, col);
    }
  }
};

const rug: Draw = (c, ox, oy) => {
  const base = hex("#a34d5f");
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const diamond = (Math.abs(x - 16) + Math.abs(y - 16)) % 8 < 2;
      c.set(ox + x, oy + y, diamond ? shade(base, 0.25) : shade(base, noise(ox + x, oy + y, 5) * 0.05));
    }
};

const door: Draw = (c, ox, oy) => {
  floorWood(c, ox, oy);
  c.rect(ox, oy + 4, TILE, 24, hex("#8f6440"));
  for (let x = 2; x < TILE; x += 6) c.rect(ox + x, oy + 4, 1, 24, hex("#7a5334"));
};

const coffee: Draw = (c, ox, oy) => {
  c.box(ox, oy + 8, 32, 22, hex("#b8b3a8"), OUT); // mesón
  c.box(ox + 6, oy + 1, 14, 18, hex("#2f2f38"), OUT); // cafetera
  c.rect(ox + 9, oy + 4, 8, 3, hex("#ef476f"));
  c.rect(ox + 23, oy + 12, 5, 6, hex("#f2efe6"));
};

const labDesk: Draw = (c, ox, oy) => {
  c.box(ox + 1, oy + 6, 30, 20, hex("#454a68"), OUT);
  c.rect(ox + 2, oy + 24, 28, 1, hex("#5ee1e6")); // luz
  c.box(ox + 6, oy + 2, 20, 13, hex("#0f1b2d"), OUT);
  c.rect(ox + 8, oy + 5, 10, 1, hex("#5ee1e6"));
  c.rect(ox + 8, oy + 8, 14, 1, hex("#8be38b"));
  c.rect(ox + 8, oy + 11, 7, 1, hex("#5ee1e6"));
};

const DRAW: Record<number, Draw> = {
  [T.FLOOR_WOOD]: floorWood,
  [T.FLOOR_CARPET]: floorCarpet,
  [T.FLOOR_MEETING]: floorMeeting,
  [T.FLOOR_LAB]: floorLab,
  [T.WALL_TOP]: wallTop,
  [T.WALL_FACE]: wallFace,
  [T.DESK]: desk,
  [T.DESK_PC]: deskPc,
  [T.CHAIR]: chair,
  [T.PLANT]: plant,
  [T.SOFA]: sofa,
  [T.TABLE]: table,
  [T.TASKBOARD]: taskboard,
  [T.BOOKSHELF]: bookshelf,
  [T.RUG]: rug,
  [T.DOOR]: door,
  [T.COFFEE]: coffee,
  [T.WINDOW]: windowTile,
  [T.LAB_DESK]: labDesk,
  [T.LAB_CHAIR]: labChair,
  [T.WHITEBOARD]: whiteboard,
};

export function drawTileset(): Canvas {
  const c = new Canvas(COLUMNS * TILE, ROWS * TILE);
  for (const [idx, draw] of Object.entries(DRAW)) {
    const i = Number(idx);
    draw(c, (i % COLUMNS) * TILE, Math.floor(i / COLUMNS) * TILE);
  }
  return c;
}
