// Rompeladrillos: la paleta se mueve con las flechas y la pelota sale con espacio. Cada ladrillo es un
// punto; al romper todos sale otro muro, con la pelota un poco más rápida. Tres vidas.
import { PAL, rect, SCREEN_H, SCREEN_W, seeded, type ArcadeKey, type HeldKeys, type MiniGame } from "./kit";

const COLS = 8;
const ROWS = 5;
const BRICK_W = 18;
const BRICK_H = 6;
const GAP = 2;
const TOP = 18;
const LEFT = (SCREEN_W - (COLS * BRICK_W + (COLS - 1) * GAP)) / 2;
const PADDLE_W = 26;
const PADDLE_Y = SCREEN_H - 12;
const PADDLE_SPEED = 150;
const BALL = 3;
const BALL_SPEED = 95;
const LIVES = 3;
const ROW_COLORS = [PAL.rug, PAL.mustard, PAL.leaf, PAL.cyan, PAL.violet];

export class Breakout implements MiniGame {
  score = 0;
  over = false;
  private bricks: boolean[] = [];
  private paddle = SCREEN_W / 2 - PADDLE_W / 2;
  private ball = { x: 0, y: 0, vx: 0, vy: 0 };
  /** La pelota espera sobre la paleta hasta apretar espacio. */
  private stuck = true;
  private lives = LIVES;
  private level = 0;
  private rand: () => number;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];

  constructor(seed: number) {
    this.rand = seeded(seed);
    this.wall();
  }

  private wall() {
    this.bricks = Array.from({ length: COLS * ROWS }, () => true);
    this.stuck = true;
  }

  press(k: ArcadeKey) {
    if ((k === "action" || k === "up") && this.stuck && !this.over) {
      this.stuck = false;
      const speed = BALL_SPEED * (1 + this.level * 0.12);
      // Sale hacia arriba con un ángulo al azar (de la semilla).
      const a = -Math.PI / 2 + (this.rand() - 0.5) * 1.1;
      this.ball.vx = Math.cos(a) * speed;
      this.ball.vy = Math.sin(a) * speed;
    }
  }

  step(dt: number, held: HeldKeys) {
    if (this.over) return;
    const s = dt / 1000;
    const move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.paddle = Math.max(2, Math.min(SCREEN_W - 2 - PADDLE_W, this.paddle + move * PADDLE_SPEED * s));
    this.sparks = this.sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of this.sparks) {
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vy += 120 * s;
    }
    const b = this.ball;
    if (this.stuck) {
      b.x = this.paddle + PADDLE_W / 2 - BALL / 2;
      b.y = PADDLE_Y - BALL - 1;
      return;
    }
    // En pasitos, para no atravesar ladrillos a velocidad alta.
    const n = Math.ceil((Math.hypot(b.vx, b.vy) * s) / 2);
    for (let i = 0; i < n && !this.stuck; i++) this.move(s / n);
  }

  private move(s: number) {
    const b = this.ball;
    b.x += b.vx * s;
    b.y += b.vy * s;
    if (b.x < 2) {
      b.x = 2;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > SCREEN_W - 2 - BALL) {
      b.x = SCREEN_W - 2 - BALL;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < 10) {
      b.y = 10;
      b.vy = Math.abs(b.vy);
    }
    // La paleta: el ángulo depende de dónde pega.
    if (b.vy > 0 && b.y + BALL >= PADDLE_Y && b.y + BALL <= PADDLE_Y + 4 && b.x + BALL >= this.paddle && b.x <= this.paddle + PADDLE_W) {
      const hit = (b.x + BALL / 2 - (this.paddle + PADDLE_W / 2)) / (PADDLE_W / 2);
      const speed = Math.hypot(b.vx, b.vy);
      const a = -Math.PI / 2 + Math.max(-1, Math.min(1, hit)) * 1.05;
      b.vx = Math.cos(a) * speed;
      b.vy = Math.sin(a) * speed;
      b.y = PADDLE_Y - BALL;
    }
    if (b.y > SCREEN_H) {
      this.lives--;
      if (this.lives <= 0) this.over = true;
      else this.stuck = true;
      return;
    }
    // Ladrillos.
    for (let i = 0; i < this.bricks.length; i++) {
      if (!this.bricks[i]) continue;
      const bx = LEFT + (i % COLS) * (BRICK_W + GAP);
      const by = TOP + Math.floor(i / COLS) * (BRICK_H + GAP);
      if (b.x + BALL <= bx || b.x >= bx + BRICK_W || b.y + BALL <= by || b.y >= by + BRICK_H) continue;
      this.bricks[i] = false;
      this.score++;
      this.burst(bx + BRICK_W / 2, by + BRICK_H / 2, ROW_COLORS[Math.floor(i / COLS)]!(4));
      // Rebota por el lado en el que entró menos.
      const overlapX = Math.min(b.x + BALL - bx, bx + BRICK_W - b.x);
      const overlapY = Math.min(b.y + BALL - by, by + BRICK_H - b.y);
      if (overlapX < overlapY) b.vx = -b.vx;
      else b.vy = -b.vy;
      if (this.bricks.every((x) => !x)) {
        this.level++;
        this.wall();
      }
      break;
    }
  }

  private burst(x: number, y: number, color: string) {
    for (let k = 0; k < 6; k++) this.sparks.push({ x, y, vx: (this.rand() - 0.5) * 80, vy: -this.rand() * 60, life: 350, color });
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
    this.bricks.forEach((alive, i) => {
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
    rect(g, this.paddle, PADDLE_Y, PADDLE_W, 4, PAL.metal(4));
    rect(g, this.paddle, PADDLE_Y, PADDLE_W, 1, PAL.white(4));
    rect(g, this.paddle + 2, PADDLE_Y + 1, 3, 2, PAL.neon(4));
    rect(g, this.paddle + PADDLE_W - 5, PADDLE_Y + 1, 3, 2, PAL.neon(4));
    rect(g, this.ball.x, this.ball.y, BALL, BALL, PAL.cream(5));
    rect(g, this.ball.x, this.ball.y, 1, 1, PAL.white(4));
    // Vidas arriba a la derecha.
    for (let k = 0; k < this.lives; k++) rect(g, SCREEN_W - 8 - k * 6, 2, 4, 4, PAL.rug(4));
  }

  /** Para la ayuda en pantalla. */
  get waiting() {
    return this.stuck && !this.over;
  }
}
