// Culebrita: con las flechas se gira; cada manzana suma un punto, alarga la culebra y la acelera un poco.
// Se pierde al chocar con el borde o con la propia cola. La lógica está en @hyvento/shared (SnakeSim).
import { SNAKE, SnakeSim, type ArcadeKey } from "@hyvento/shared";
import { PAL, rect, SCREEN_H, SCREEN_W, sprite, type MiniGame } from "./kit";

const CELL = SNAKE.cell;
const COLS = SNAKE.cols;
const ROWS = SNAKE.rows;

const APPLE = [".gG.", "rrRr", "rrrr", ".rr."];

export class Snake implements MiniGame {
  readonly sim: SnakeSim;
  /** Destello al comer (solo dibujo). */
  private flash = 0;

  constructor(seed: number) {
    this.sim = new SnakeSim(seed);
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

  step() {
    const before = this.sim.score;
    this.sim.step();
    this.flash = this.sim.score > before ? 180 : Math.max(0, this.flash - 1000 / 60);
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // Pasto en damero.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) rect(g, x * CELL, y * CELL, CELL, CELL, (x + y) % 2 ? PAL.green(1) : PAL.green(0));
    // Manzana que late.
    const a = this.sim.apple;
    const bob = Math.floor(t / 300) % 2;
    sprite(g, APPLE, a.x * CELL + 2, a.y * CELL + 2 - bob, { r: PAL.rug(3), R: PAL.rug(5), g: PAL.leaf(4), G: PAL.leaf(2) });
    rect(g, a.x * CELL + 2, a.y * CELL + 7, 4, 1, PAL.green(0));
    // La culebra: el cuerpo en franjas y la cabeza con ojos que miran hacia donde va.
    this.sim.body.forEach((b, i) => {
      const x = b.x * CELL;
      const y = b.y * CELL;
      const light = i % 2 === 0;
      rect(g, x + 1, y + 1, CELL - 2, CELL - 2, i === 0 ? PAL.leaf(5) : light ? PAL.leaf(4) : PAL.leaf(3));
      rect(g, x + 2, y + 2, 2, 2, PAL.leaf(5));
      if (i === 0) {
        const d = this.sim.dir;
        const ex = d.x === 0 ? [2, 5] : d.x > 0 ? [5, 5] : [2, 2];
        const ey = d.y === 0 ? [2, 5] : d.y > 0 ? [5, 5] : [2, 2];
        rect(g, x + ex[0]!, y + ey[0]!, 1, 1, PAL.ink);
        rect(g, x + ex[1]!, y + ey[1]!, 1, 1, PAL.ink);
        if (Math.floor(t / 250) % 4 === 0) rect(g, x + 3 + d.x * 4, y + 3 + d.y * 4, 2, 1, PAL.rug(4));
      }
    });
    if (this.flash > 0) {
      g.globalAlpha = this.flash / 360;
      rect(g, 0, 0, SCREEN_W, SCREEN_H, PAL.gold(5));
      g.globalAlpha = 1;
    }
  }
}
