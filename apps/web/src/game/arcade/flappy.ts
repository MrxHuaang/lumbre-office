// Aleteo: un pajarito que cae; con espacio (o flecha arriba) aletea. Cada tubo que se pasa es un punto y
// se pierde al tocar un tubo o el suelo. Los huecos salen de la semilla del servidor. La lógica está en
// @hyvento/shared (FlappySim).
import { FLAPPY, FlappySim, type ArcadeKey } from "@hyvento/shared";
import { PAL, rect, SCREEN_H, SCREEN_W, sprite, type MiniGame } from "./kit";

const { pipeW: PIPE_W, gap: GAP, ground: GROUND, birdX: BIRD_X } = FLAPPY;
const BIRD = [
  ["..yyyy..", ".yyyywk.", "wwyyyyyo", "wwwyyyoo", ".yyyyyy.", "..yyyy.."],
  ["..yyyy..", ".yyyywk.", ".yyyyyyo", "wwwyyyoo", "wwyyyyy.", "..yyyy.."],
];

export class Flappy implements MiniGame {
  readonly sim: FlappySim;

  constructor(seed: number) {
    this.sim = new FlappySim(seed);
  }

  get score() {
    return this.sim.score;
  }
  get over() {
    return this.sim.over;
  }
  get waiting() {
    return this.sim.waiting;
  }

  press(k: ArcadeKey) {
    this.sim.press(k);
  }

  step() {
    this.sim.step();
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // Cielo del atardecer en bandas, nubes y la ciudad a lo lejos (se mueven más lento).
    const bands = [PAL.sky(1), PAL.sky(2), PAL.sky(3), PAL.cream(4), PAL.gold(4)];
    bands.forEach((c, i) => rect(g, 0, (i * GROUND) / bands.length, SCREEN_W, Math.ceil(GROUND / bands.length) + 1, c));
    for (let k = 0; k < 4; k++) {
      const x = ((k * 57 - this.sim.scroll * 0.2) % (SCREEN_W + 30) + SCREEN_W + 30) % (SCREEN_W + 30) - 30;
      rect(g, x, 14 + k * 11, 22, 4, PAL.cream(5));
      rect(g, x + 4, 11 + k * 11, 12, 3, PAL.cream(5));
    }
    for (let k = 0; k < 12; k++) {
      const w = 12 + ((k * 7) % 9);
      const h = 14 + ((k * 13) % 22);
      const x = ((k * 19 - this.sim.scroll * 0.4) % (SCREEN_W + 20) + SCREEN_W + 20) % (SCREEN_W + 20) - 20;
      rect(g, x, GROUND - h, w, h, PAL.violet(2));
      if (k % 2) rect(g, x + 3, GROUND - h + 4, 2, 2, PAL.gold(5));
    }
    // Tubos con borde y brillo.
    for (const p of this.sim.pipes) {
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
    for (let x = -((this.sim.scroll | 0) % 8); x < SCREEN_W; x += 8) rect(g, x, GROUND, 4, 2, PAL.leaf(4));
    // El pajarito: aletea al subir y se inclina al caer.
    const flapping = t - this.sim.flapAt < 180 || Math.floor(t / 150) % 2 === 0;
    // Antes del primer aleteo flota arriba y abajo.
    const bob = this.sim.waiting ? Math.sin(t / 200) * 3 : 0;
    sprite(g, BIRD[flapping ? 1 : 0]!, BIRD_X, Math.round(this.sim.y + bob) + (this.sim.vy > 120 ? 1 : 0), {
      y: PAL.gold(4),
      w: PAL.cream(5),
      k: PAL.ink,
      o: PAL.rug(4),
    });
  }
}
