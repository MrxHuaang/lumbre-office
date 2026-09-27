// Bloques: caen piezas de cuatro cuadritos; flechas para correrlas, arriba para girar, abajo para
// bajarlas rápido y espacio para soltarlas. Cada fila llena se borra y suma un punto. La lógica está en
// @hyvento/shared (BloquesSim); acá van el dibujo, la sombra de dónde cae y el destello de las filas.
import { BLOQUES, bloquesCells, BloquesSim, type ArcadeKey, type HeldKeys } from "@hyvento/shared";
import { PAL, rect, SCREEN_H, SCREEN_W, type MiniGame } from "./kit";

const { cols: COLS, rows: ROWS, cell: CELL, left: LEFT, top: TOP } = BLOQUES;
/** Color de cada pieza (en el orden de la simulación: I, O, T, S, Z, J, L): tono claro, medio y oscuro. */
const COLORS: readonly ((i: number) => string)[] = [PAL.cyan, PAL.gold, PAL.violet, PAL.leaf, PAL.rug, PAL.sky, PAL.neon];
/** Panel de la derecha: la pieza que sigue y el nivel. */
const PANEL_X = LEFT + COLS * CELL + 8;

function block(g: CanvasRenderingContext2D, x: number, y: number, kind: number, size: number = CELL) {
  const c = COLORS[kind]!;
  rect(g, x, y, size, size, c(1));
  rect(g, x, y, size - 1, size - 1, c(3));
  rect(g, x + 1, y + 1, size - 3, size - 3, c(4));
  rect(g, x + 1, y + 1, 2, 1, c(5));
}

export class Bloques implements MiniGame {
  readonly sim: BloquesSim;

  constructor(seed: number) {
    this.sim = new BloquesSim(seed);
  }

  get score() {
    return this.sim.score;
  }
  get over() {
    return this.sim.over;
  }
  get waiting() {
    return false;
  }

  press(k: ArcadeKey) {
    this.sim.press(k);
  }

  step(held: HeldKeys) {
    this.sim.step(held);
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    const s = this.sim;
    // Fondo con estrellitas que titilan y el pozo del tablero.
    rect(g, 0, 0, SCREEN_W, SCREEN_H, PAL.night(0));
    for (let i = 0; i < 24; i++) {
      const x = (i * 53) % SCREEN_W;
      const y = (i * 37) % SCREEN_H;
      if ((i + Math.floor(t / 400)) % 5 === 0) rect(g, x, y, 1, 1, PAL.violet(4));
    }
    rect(g, LEFT - 2, TOP - 1, COLS * CELL + 4, ROWS * CELL + 2, PAL.violet(2));
    rect(g, LEFT, TOP, COLS * CELL, ROWS * CELL, PAL.night(1));
    for (let x = 1; x < COLS; x++) rect(g, LEFT + x * CELL, TOP, 1, ROWS * CELL, PAL.night(0));

    // Lo que ya está fijo; las filas recién borradas destellan un momento donde estaban.
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const k = s.board[y * COLS + x]!;
        if (k) block(g, LEFT + x * CELL, TOP + y * CELL, k - 1);
      }
    if (s.cleared.length && s.clearedAge < 18) {
      g.globalAlpha = 1 - s.clearedAge / 18;
      for (const y of s.cleared) rect(g, LEFT, TOP + y * CELL, COLS * CELL, CELL, PAL.cream(5));
      g.globalAlpha = 1;
    }

    // La pieza que cae y su sombra abajo.
    const p = s.piece;
    if (p) {
      const gy = s.ghostY();
      for (const c of bloquesCells(p.kind, p.rot)) {
        const x = LEFT + (p.x + c.x) * CELL;
        const yGhost = TOP + (gy + c.y) * CELL;
        if (gy + c.y >= 0) {
          rect(g, x, yGhost, CELL, 1, COLORS[p.kind]!(2));
          rect(g, x, yGhost + CELL - 1, CELL, 1, COLORS[p.kind]!(2));
          rect(g, x, yGhost, 1, CELL, COLORS[p.kind]!(2));
          rect(g, x + CELL - 1, yGhost, 1, CELL, COLORS[p.kind]!(2));
        }
        if (p.y + c.y >= 0) block(g, x, TOP + (p.y + c.y) * CELL, p.kind);
      }
    }

    // Panel: la que sigue y el nivel (una barrita por nivel).
    rect(g, PANEL_X - 2, TOP + 12, 40, 34, PAL.violet(2));
    rect(g, PANEL_X, TOP + 14, 36, 30, PAL.night(1));
    const next = bloquesCells(s.next, 0);
    const minX = Math.min(...next.map((c) => c.x));
    const maxX = Math.max(...next.map((c) => c.x));
    const minY = Math.min(...next.map((c) => c.y));
    const maxY = Math.max(...next.map((c) => c.y));
    const ox = PANEL_X + 18 - ((maxX - minX + 1) * 6) / 2;
    const oy = TOP + 29 - ((maxY - minY + 1) * 6) / 2;
    for (const c of next) block(g, ox + (c.x - minX) * 6, oy + (c.y - minY) * 6, s.next, 6);
    for (let i = 0; i < 10; i++) rect(g, PANEL_X + i * 4, TOP + 56, 3, 6, i < s.level ? PAL.neon(4) : PAL.night(2));
    // La pila cerca del techo: el borde se pone rojo.
    const high = s.board.slice(0, COLS * 4).some(Boolean);
    if (high && Math.floor(t / 250) % 2 === 0) rect(g, LEFT - 2, TOP - 1, COLS * CELL + 4, 1, PAL.rug(4));
  }
}
