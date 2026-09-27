// Culebrita: con las flechas se gira; cada manzana suma un punto, alarga la culebra y la acelera un poco.
// Se pierde al chocar con el borde o con la propia cola.
import { PAL, rect, SCREEN_H, SCREEN_W, seeded, sprite, type ArcadeKey, type MiniGame } from "./kit";

const CELL = 8;
const COLS = SCREEN_W / CELL;
const ROWS = SCREEN_H / CELL;
/** Cada cuánto avanza (ms): arranca tranquila y se acelera con cada manzana hasta un tope. */
const START_MS = 140;
const MIN_MS = 70;
const FASTER_MS = 3;

type Dir = { x: number; y: number };
const DIRS: Record<Exclude<ArcadeKey, "action">, Dir> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const APPLE = [".gG.", "rrRr", "rrrr", ".rr."];

export class Snake implements MiniGame {
  score = 0;
  over = false;
  private body: { x: number; y: number }[] = [];
  private dir: Dir = DIRS.right;
  /** Giros pendientes (hasta dos: así se puede doblar rápido en U). */
  private turns: Dir[] = [];
  private apple = { x: 0, y: 0 };
  private acc = 0;
  private rand: () => number;
  private flash = 0;

  constructor(seed: number) {
    this.rand = seeded(seed);
    for (let i = 0; i < 4; i++) this.body.push({ x: 6 - i, y: Math.floor(ROWS / 2) });
    this.placeApple();
  }

  press(k: ArcadeKey) {
    if (k === "action") return;
    const d = DIRS[k];
    const last = this.turns.at(-1) ?? this.dir;
    // No se puede dar media vuelta sobre sí misma.
    if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return;
    if (this.turns.length < 2) this.turns.push(d);
  }

  step(dt: number) {
    if (this.over) return;
    this.flash = Math.max(0, this.flash - dt);
    this.acc += dt;
    const every = Math.max(MIN_MS, START_MS - this.score * FASTER_MS);
    while (this.acc >= every && !this.over) {
      this.acc -= every;
      this.advance();
    }
  }

  private advance() {
    this.dir = this.turns.shift() ?? this.dir;
    const head = this.body[0]!;
    const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };
    const eats = next.x === this.apple.x && next.y === this.apple.y;
    // La cola se corre en el mismo paso: se puede ir justo detrás de ella.
    const body = eats ? this.body : this.body.slice(0, -1);
    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS || body.some((b) => b.x === next.x && b.y === next.y)) {
      this.over = true;
      return;
    }
    this.body = [next, ...body];
    if (eats) {
      this.score++;
      this.flash = 180;
      this.placeApple();
    }
  }

  private placeApple() {
    for (let k = 0; k < 200; k++) {
      const x = Math.floor(this.rand() * COLS);
      const y = Math.floor(this.rand() * ROWS);
      if (!this.body.some((b) => b.x === x && b.y === y)) {
        this.apple = { x, y };
        return;
      }
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // Pasto en damero.
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) rect(g, x * CELL, y * CELL, CELL, CELL, (x + y) % 2 ? PAL.green(1) : PAL.green(0));
    // Manzana que late.
    const a = this.apple;
    const bob = Math.floor(t / 300) % 2;
    sprite(g, APPLE, a.x * CELL + 2, a.y * CELL + 2 - bob, { r: PAL.rug(3), R: PAL.rug(5), g: PAL.leaf(4), G: PAL.leaf(2) });
    rect(g, a.x * CELL + 2, a.y * CELL + 7, 4, 1, PAL.green(0));
    // La culebra: el cuerpo en franjas y la cabeza con ojos que miran hacia donde va.
    this.body.forEach((b, i) => {
      const x = b.x * CELL;
      const y = b.y * CELL;
      const light = i % 2 === 0;
      rect(g, x + 1, y + 1, CELL - 2, CELL - 2, i === 0 ? PAL.leaf(5) : light ? PAL.leaf(4) : PAL.leaf(3));
      rect(g, x + 2, y + 2, 2, 2, PAL.leaf(5));
      if (i === 0) {
        const d = this.dir;
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
