// Tablero de ajedrez y de damas para el panel de la mesa (sala de juegos): el tablero visto desde arriba
// con su marco, las coordenadas, las piezas en pixel art y las marcas (la pieza elegida, las casillas a
// las que puede ir, la última jugada y el rey en jaque). Todo por código y sin Phaser: el navegador lo
// pasa a un <canvas> ampliado y también se puede dibujar a PNG para revisarlo.
import { drawTextCentered } from "./digits";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, hex, type RGBA, type Ramp } from "./pixel";

/** Lado de una casilla y ancho del marco (con las letras y los números), en puntos. */
export const BOARD_SQ = 16;
export const BOARD_FRAME = 10;
export const BOARD_PX = BOARD_SQ * 8 + BOARD_FRAME * 2;

export type BoardArtGame = "ajedrez" | "damas";

/**
 * Casilla (0..63) en la columna y fila de la pantalla (0..7, fila 0 arriba). Ajedrez: índice = fila
 * del tablero * 8 + columna con la fila "1" abajo; damas: fila 0 arriba. `flipped` = mira desde las negras.
 */
export function squareAtCell(game: BoardArtGame, col: number, row: number, flipped: boolean): number {
  const c = flipped ? 7 - col : col;
  const r = flipped ? 7 - row : row;
  return game === "ajedrez" ? (7 - r) * 8 + c : r * 8 + c;
}

export function cellOfSquare(game: BoardArtGame, sq: number, flipped: boolean): { col: number; row: number } {
  const c = sq & 7;
  const r = game === "ajedrez" ? 7 - (sq >> 3) : sq >> 3;
  return flipped ? { col: 7 - c, row: 7 - r } : { col: c, row: r };
}

/** Casilla bajo el punto (x, y) del dibujo (en puntos), o -1 si cae en el marco. */
export function squareAtPoint(game: BoardArtGame, x: number, y: number, flipped: boolean): number {
  const col = Math.floor((x - BOARD_FRAME) / BOARD_SQ);
  const row = Math.floor((y - BOARD_FRAME) / BOARD_SQ);
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  return squareAtCell(game, col, row, flipped);
}

// ---------- Piezas ----------

/** Siluetas de 10 de ancho, de arriba abajo (la base en la última fila). */
const CHESS_MASKS: Record<string, readonly string[]> = {
  p: ["....##....", "...####...", "...####...", "....##....", "...####...", "....##....", "...####...", "..######..", ".########.", ".########."],
  r: [".##.##.##.", ".########.", ".########.", "..######..", "..######..", "..######..", "..######..", "..######..", ".########.", "##########", "##########"],
  n: ["...##.....", "..#####...", ".#######..", "########..", "###.####..", ".#..#####.", "...######.", "..#######.", "..######..", ".########.", "##########", "##########"],
  b: ["....##....", "...####...", "..###.##..", "..##.###..", "..######..", "...####...", "....##....", "...####...", "..######..", ".########.", "##########"],
  q: ["....##....", ".#..##..#.", ".##.##.##.", ".########.", "..######..", "...####...", "...####...", "...####...", "..######..", ".########.", "##########", "##########"],
  k: ["....##....", "..######..", "....##....", "..######..", ".########.", ".########.", "..######..", "...####...", "...####...", "..######..", ".########.", "##########", "##########"],
};

const WHITE_PIECE: Ramp = [hex("#a8896a"), hex("#cdb08a"), hex("#e6d0a6"), hex("#f7ebc8"), hex("#fffaf0")];
const BLACK_PIECE: Ramp = [hex("#15101f"), hex("#241a33"), hex("#34294a"), hex("#4b3f66"), hex("#6d6190")];

/** Contorno de un punto alrededor de lo pintado (lo que tiene alfa), en el color de `OUT`. */
function outline(c: PixelCanvas, x0: number, y0: number, w: number, h: number) {
  const fill: [number, number][] = [];
  for (let y = y0 - 1; y <= y0 + h; y++)
    for (let x = x0 - 1; x <= x0 + w; x++) {
      if (c.alphaAt(x, y)) continue;
      if (c.alphaAt(x - 1, y) || c.alphaAt(x + 1, y) || c.alphaAt(x, y - 1) || c.alphaAt(x, y + 1)) fill.push([x, y]);
    }
  for (const [x, y] of fill) c.set(x, y, OUT);
}

/**
 * Una pieza de ajedrez (letra FEN: mayúscula blanca) en un lienzo de BOARD_SQ, con la base abajo: luz a
 * la izquierda, sombra a la derecha y un brillo arriba.
 */
export function chessPieceArt(piece: string): PixelCanvas {
  const c = new PixelCanvas(BOARD_SQ, BOARD_SQ);
  const mask = CHESS_MASKS[piece.toLowerCase()];
  if (!mask) return c;
  const tone = piece === piece.toUpperCase() ? WHITE_PIECE : BLACK_PIECE;
  const h = mask.length;
  const x0 = 3;
  const y0 = BOARD_SQ - 2 - h;
  mask.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== "#") continue;
      const left = i === 0 || row[i - 1] !== "#";
      const right = i === row.length - 1 || row[i + 1] !== "#";
      const top = j === 0 || mask[j - 1]![i] !== "#";
      // Luz de arriba a la izquierda: el borde izquierdo y lo de arriba más claros, el derecho oscuro.
      let k = i < row.length / 2 ? 3 : 2;
      if (left || top) k = 4;
      if (right) k = 1;
      if (j >= h - 2) k = Math.max(0, k - 1);
      c.set(x0 + i, y0 + j, at(tone, k));
    }
  });
  outline(c, x0, y0, 10, h);
  return c;
}

/** Una ficha de damas vista desde arriba (la dama lleva una corona dorada). */
export function checkersPieceArt(piece: string): PixelCanvas {
  const c = new PixelCanvas(BOARD_SQ, BOARD_SQ);
  if (!piece) return c;
  const tone = piece.toLowerCase() === "w" ? WHITE_PIECE : BLACK_PIECE;
  const cx = BOARD_SQ / 2;
  const cy = BOARD_SQ / 2;
  // El canto, un poco más abajo (se ve el espesor), y la cara con un anillo.
  c.ellipse(cx, cy + 1, 6, 6, at(tone, 0));
  c.ellipse(cx, cy, 6, 6, at(tone, 2));
  c.ellipse(cx, cy, 4.2, 4.2, at(tone, 3));
  c.ellipse(cx, cy, 3.2, 3.2, at(tone, 2));
  c.set(cx - 3, cy - 3, at(tone, 4));
  c.set(cx - 2, cy - 4, at(tone, 4));
  if (piece === piece.toUpperCase()) {
    // Corona dorada con su contorno, bien visible sobre las dos fichas.
    const crown = ["#..#..#", "##.#.##", "#######", "#######"];
    const x0 = cx - 3;
    const y0 = cy - 2;
    const on = (i: number, j: number) => crown[j]?.[i] === "#";
    for (let j = -1; j <= crown.length; j++)
      for (let i = -1; i <= 7; i++) {
        if (on(i, j)) c.set(x0 + i, y0 + j, at(C.gold, j === 0 ? 5 : j === 1 ? 4 : 3));
        else if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) c.set(x0 + i, y0 + j, at(C.gold, 0));
      }
  }
  outline(c, 1, 1, BOARD_SQ - 2, BOARD_SQ - 2);
  return c;
}

// ---------- El tablero ----------

export interface BoardArtOptions {
  game: BoardArtGame;
  /** 64 casillas con la letra de la pieza ("" vacía): FEN en ajedrez, w/W/b/B en damas. */
  squares: readonly string[];
  /** Mirar desde las negras (su lado abajo). */
  flipped?: boolean;
  /** Pieza elegida. */
  selected?: number;
  /** Casillas a las que puede ir la pieza elegida. */
  targets?: readonly number[];
  /** Recorrido de la última jugada. */
  last?: readonly number[];
  /** Casilla del rey en jaque. */
  check?: number;
}

const LIGHT: Record<BoardArtGame, RGBA> = { ajedrez: at(C.cream, 4), damas: at(C.cream, 4) };
const DARK: Record<BoardArtGame, RGBA> = { ajedrez: at(C.wood, 3), damas: at(C.green, 2) };

/** Copia `src` sobre `dst` en (x, y), respetando la transparencia. */
function blit(dst: PixelCanvas, src: PixelCanvas, x: number, y: number) {
  for (let j = 0; j < src.height; j++)
    for (let i = 0; i < src.width; i++) {
      const k = (j * src.width + i) * 4;
      const a = src.data[k + 3]!;
      if (a) dst.set(x + i, y + j, [src.data[k]!, src.data[k + 1]!, src.data[k + 2]!, a]);
    }
}

const pieceCache = new Map<string, PixelCanvas>();
function pieceArt(game: BoardArtGame, p: string): PixelCanvas {
  const key = `${game}:${p}`;
  let art = pieceCache.get(key);
  if (!art) {
    art = game === "ajedrez" ? chessPieceArt(p) : checkersPieceArt(p);
    pieceCache.set(key, art);
  }
  return art;
}

/** El tablero completo, de BOARD_PX de lado. */
export function boardArt(o: BoardArtOptions): PixelCanvas {
  const c = new PixelCanvas(BOARD_PX, BOARD_PX);
  const flipped = o.flipped ?? false;
  // Marco de madera oscura con un filo claro por dentro.
  c.rect(0, 0, BOARD_PX, BOARD_PX, at(C.woodDark, 2));
  c.rect(1, 1, BOARD_PX - 2, BOARD_PX - 2, at(C.woodDark, 3));
  c.rect(BOARD_FRAME - 1, BOARD_FRAME - 1, BOARD_SQ * 8 + 2, BOARD_SQ * 8 + 2, at(C.woodDark, 1));
  const ink = at(C.cream, 4);
  for (let i = 0; i < 8; i++) {
    const file = flipped ? 7 - i : i;
    const rank = flipped ? i + 1 : 8 - i;
    const mid = BOARD_FRAME + i * BOARD_SQ + BOARD_SQ / 2;
    drawTextCentered(c, "ABCDEFGH"[file]!, mid, BOARD_PX - BOARD_FRAME / 2, ink);
    drawTextCentered(c, String(rank), BOARD_FRAME / 2, mid, ink);
  }
  const lastSet = new Set(o.last ?? []);
  const targets = new Set(o.targets ?? []);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++) {
      const sq = squareAtCell(o.game, col, row, flipped);
      const x = BOARD_FRAME + col * BOARD_SQ;
      const y = BOARD_FRAME + row * BOARD_SQ;
      c.rect(x, y, BOARD_SQ, BOARD_SQ, (col + row) % 2 ? DARK[o.game] : LIGHT[o.game]);
      if (lastSet.has(sq)) c.rect(x, y, BOARD_SQ, BOARD_SQ, alpha(at(C.gold, 4), 0.5));
      if (o.check === sq) {
        c.ellipse(x + BOARD_SQ / 2, y + BOARD_SQ / 2, 8, 8, alpha(at(C.rug, 3), 0.8));
        c.ellipse(x + BOARD_SQ / 2, y + BOARD_SQ / 2, 5, 5, alpha(at(C.rug, 4), 0.6));
      }
      if (o.selected === sq) c.rect(x, y, BOARD_SQ, BOARD_SQ, alpha(at(C.sage, 4), 0.7));
      const p = o.squares[sq] ?? "";
      if (p) blit(c, pieceArt(o.game, p), x, y);
      if (targets.has(sq)) {
        const mark = alpha(at(C.sage, 1), 0.75);
        if (p) {
          // Captura: las cuatro esquinas marcadas en L.
          const e = BOARD_SQ - 1;
          for (const [cx0, cy0, sx, sy] of [
            [x, y, 1, 1],
            [x + e, y, -1, 1],
            [x, y + e, 1, -1],
            [x + e, y + e, -1, -1],
          ] as const)
            for (let k = 0; k < 4; k++) {
              c.set(cx0 + sx * k, cy0, mark);
              c.set(cx0, cy0 + sy * k, mark);
            }
        } else c.ellipse(x + BOARD_SQ / 2, y + BOARD_SQ / 2, 2.6, 2.6, mark);
      }
    }
  return c;
}
