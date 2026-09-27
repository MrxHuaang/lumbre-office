// Rompeladrillos: la paleta se mueve con las flechas y la pelota sale con espacio. Cada ladrillo es un
// punto; al romper todos sale otro muro, con la pelota un poco más rápida. Tres vidas. La lógica está en
// @hyvento/shared (BreakoutSim); aquí van el dibujo y las chispas.
import { ARCADE_STEP_MS, BREAKOUT, BreakoutSim, type ArcadeKey, type HeldKeys } from "@hyvento/shared";
import { PAL, rect, SCREEN_H, SCREEN_W, type MiniGame } from "./kit";

const { cols: COLS, brickW: BRICK_W, brickH: BRICK_H, gap: GAP, top: TOP, left: LEFT, paddleW: PADDLE_W, paddleY: PADDLE_Y, ball: BALL } = BREAKOUT;
const ROW_COLORS = [PAL.rug, PAL.mustard, PAL.leaf, PAL.cyan, PAL.violet];

export class Breakout implements MiniGame {
  readonly sim: BreakoutSim;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

  constructor(seed: number) {
    this.sim = new BreakoutSim(seed);
  }

  get score() {
    return this.sim.score;
  }
  get over() {
    return this.sim.over;
  }
  /** Para la ayuda en pantalla. */
  get waiting() {
    return this.sim.waiting;
  }

  press(k: ArcadeKey) {
    this.sim.press(k);
  }

  step(held: HeldKeys) {
    this.sim.step(held);
    const s = ARCADE_STEP_MS / 1000;
    this.sparks = this.sparks.filter((p) => (p.life -= ARCADE_STEP_MS) > 0);
    for (const p of this.sparks) {
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vy += 120 * s;
    }
    // Chispas de los ladrillos rotos (solo dibujo: su azar no es el de la partida).
    for (const h of this.sim.hits.splice(0)) {
      const color = ROW_COLORS[h.row]!(4);
      for (let k = 0; k < 6; k++) this.sparks.push({ x: h.x, y: h.y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, life: 350, color });
    }
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // Fondo con estrellas que titilan.
    rect(g, 0, 0, SCREEN_W, SCREEN_H, PAL.navy(0));
    for (let k = 0; k < 24; k++) {
      const x = (k * 53) % SCREEN_W;
      const y = (k * 37) % SCREEN_H;
      if ((k + Math.floor(t / 400)) % 5) rect(g, x, y, 1, 1, PAL.navy(3));
    }
    rect(g, 0, 8, 2, SCREEN_H, PAL.metal(2));
    rect(g, SCREEN_W - 2, 8, 2, SCREEN_H, PAL.metal(2));
    rect(g, 0, 8, SCREEN_W, 2, PAL.metal(3));
    // Ladrillos con luz arriba y sombra abajo.
    this.sim.bricks.forEach((alive, i) => {
      if (!alive) return;
      const bx = LEFT + (i % COLS) * (BRICK_W + GAP);
      const by = TOP + Math.floor(i / COLS) * (BRICK_H + GAP);
      const c = ROW_COLORS[Math.floor(i / COLS)]!;
      rect(g, bx, by, BRICK_W, BRICK_H, c(3));
      rect(g, bx, by, BRICK_W, 1, c(5));
      rect(g, bx, by + BRICK_H - 1, BRICK_W, 1, c(1));
      rect(g, bx + 2, by + 2, 3, 1, c(5));
    });
    for (const p of this.sparks) rect(g, p.x, p.y, 1, 1, p.color);
    // Paleta y pelota.
    rect(g, this.sim.paddle, PADDLE_Y, PADDLE_W, 4, PAL.metal(4));
    rect(g, this.sim.paddle, PADDLE_Y, PADDLE_W, 1, PAL.white(4));
    rect(g, this.sim.paddle + 2, PADDLE_Y + 1, 3, 2, PAL.neon(4));
    rect(g, this.sim.paddle + PADDLE_W - 5, PADDLE_Y + 1, 3, 2, PAL.neon(4));
    rect(g, this.sim.ball.x, this.sim.ball.y, BALL, BALL, PAL.cream(5));
    rect(g, this.sim.ball.x, this.sim.ball.y, 1, 1, PAL.white(4));
    // Vidas arriba a la derecha.
    for (let k = 0; k < this.sim.lives; k++) rect(g, SCREEN_W - 8 - k * 6, 2, 4, 4, PAL.rug(4));
  }
}
