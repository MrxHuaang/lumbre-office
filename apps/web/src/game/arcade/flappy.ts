// Aleteo: un pajarito que cae; con espacio (o flecha arriba) aletea. Cada tubo que se pasa es un punto y
// se pierde al tocar un tubo o el suelo. Los huecos salen de la semilla del servidor.
import { PAL, rect, SCREEN_H, SCREEN_W, seeded, sprite, type ArcadeKey, type MiniGame } from "./kit";

const GRAVITY = 430;
const FLAP = -150;
const SPEED = 60;
const PIPE_W = 16;
const GAP = 46;
/** Distancia entre tubos: sale uno cada 1,5 s. */
const SPACING = 90;
const GROUND = SCREEN_H - 12;
const BIRD_X = 40;
const BIRD = [
  ["..yyyy..", ".yyyywk.", "wwyyyyyo", "wwwyyyoo", ".yyyyyy.", "..yyyy.."],
  ["..yyyy..", ".yyyywk.", ".yyyyyyo", "wwwyyyoo", "wwyyyyy.", "..yyyy.."],
];

export class Flappy implements MiniGame {
  score = 0;
  over = false;
  private y = SCREEN_H / 2 - 10;
  private vy = 0;
  private pipes: { x: number; gap: number; passed: boolean }[] = [];
  private rand: () => number;
  /** Hasta el primer aleteo el pajarito flota y no salen tubos. */
  private waitingStart = true;
  private scroll = 0;
  private flapAt = -1000;
  private t = 0;

  constructor(seed: number) {
    this.rand = seeded(seed);
  }

  press(k: ArcadeKey) {
    if (this.over || (k !== "action" && k !== "up")) return;
    this.waitingStart = false;
    this.vy = FLAP;
    this.flapAt = this.t;
  }

  step(dt: number) {
    this.t += dt;
    if (this.over) return;
    const s = dt / 1000;
    this.scroll += SPEED * s;
    if (this.waitingStart) {
      this.y = SCREEN_H / 2 - 10 + Math.sin(this.t / 200) * 3;
      return;
    }
    this.vy = Math.min(220, this.vy + GRAVITY * s);
    this.y += this.vy * s;
    const last = this.pipes.at(-1);
    if (!last || last.x < SCREEN_W - SPACING) this.pipes.push({ x: SCREEN_W + 4, gap: 20 + Math.floor(this.rand() * (GROUND - 40 - GAP)), passed: false });
    for (const p of this.pipes) {
      p.x -= SPEED * s;
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true;
        this.score++;
      }
    }
    this.pipes = this.pipes.filter((p) => p.x > -PIPE_W - 2);
    // Choque: la caja del pajarito (un poco más chica que el dibujo, para que sea justo).
    const top = this.y + 1;
    const bottom = this.y + 5;
    if (bottom >= GROUND || top < 0) this.over = true;
    for (const p of this.pipes)
      if (BIRD_X + 7 > p.x && BIRD_X + 1 < p.x + PIPE_W && (top < p.gap || bottom > p.gap + GAP)) this.over = true;
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // Cielo del atardecer en bandas, nubes y la ciudad a lo lejos (se mueven más lento).
    const bands = [PAL.sky(1), PAL.sky(2), PAL.sky(3), PAL.cream(4), PAL.gold(4)];
    bands.forEach((c, i) => rect(g, 0, (i * GROUND) / bands.length, SCREEN_W, Math.ceil(GROUND / bands.length) + 1, c));
    for (let k = 0; k < 4; k++) {
      const x = ((k * 57 - this.scroll * 0.2) % (SCREEN_W + 30) + SCREEN_W + 30) % (SCREEN_W + 30) - 30;
      rect(g, x, 14 + k * 11, 22, 4, PAL.cream(5));
      rect(g, x + 4, 11 + k * 11, 12, 3, PAL.cream(5));
    }
    for (let k = 0; k < 12; k++) {
      const w = 12 + ((k * 7) % 9);
      const h = 14 + ((k * 13) % 22);
      const x = ((k * 19 - this.scroll * 0.4) % (SCREEN_W + 20) + SCREEN_W + 20) % (SCREEN_W + 20) - 20;
      rect(g, x, GROUND - h, w, h, PAL.violet(2));
      if (k % 2) rect(g, x + 3, GROUND - h + 4, 2, 2, PAL.gold(5));
    }
    // Tubos con borde y brillo.
    for (const p of this.pipes) {
      for (const [y0, y1] of [
        [0, p.gap],
        [p.gap + GAP, GROUND],
      ] as const) {
        rect(g, p.x, y0, PIPE_W, y1 - y0, PAL.leaf(3));
        rect(g, p.x + 2, y0, 2, y1 - y0, PAL.leaf(5));
        rect(g, p.x + PIPE_W - 3, y0, 2, y1 - y0, PAL.leaf(1));
      }
      rect(g, p.x - 2, p.gap - 5, PIPE_W + 4, 5, PAL.leaf(4));
      rect(g, p.x - 2, p.gap + GAP, PIPE_W + 4, 5, PAL.leaf(4));
    }
    // Suelo que avanza.
    rect(g, 0, GROUND, SCREEN_W, SCREEN_H - GROUND, PAL.mustard(2));
    for (let x = -((this.scroll | 0) % 8); x < SCREEN_W; x += 8) rect(g, x, GROUND, 4, 2, PAL.leaf(4));
    // El pajarito: aletea al subir y se inclina al caer.
    const flapping = t - this.flapAt < 180 || Math.floor(t / 150) % 2 === 0;
    sprite(g, BIRD[flapping ? 1 : 0]!, BIRD_X, Math.round(this.y) + (this.vy > 120 ? 1 : 0), {
      y: PAL.gold(4),
      w: PAL.cream(5),
      k: PAL.ink,
      o: PAL.rug(4),
    });
  }

  get waiting() {
    return this.waitingStart && !this.over;
  }
}
