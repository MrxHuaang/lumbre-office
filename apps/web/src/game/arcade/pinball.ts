// Pinball: la bola se lanza con espacio y los flippers se mueven con las flechas izquierda y derecha. Los
// bumpers dan puntos y los tres carriles de arriba, prendidos todos, un bono. Tres bolas. La lógica está en
// @hyvento/shared (PinballSim); aquí van el dibujo (madera, luces de neón) y los destellos.
import { ARCADE_STEP_MS, PINBALL, PINBALL_WALLS, PinballSim, type ArcadeKey, type HeldKeys } from "@hyvento/shared";
import { PAL, rect, SCREEN_H, SCREEN_W, type MiniGame } from "./kit";

/** Una línea de píxeles de (x0, y0) a (x1, y1) con un grosor `w`. */
function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) rect(g, x0 + ((x1 - x0) * i) / n - (w - 1) / 2, y0 + ((y1 - y0) * i) / n - (w - 1) / 2, w, w, color);
}

/** Un círculo relleno de píxeles. */
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) rect(g, cx + x, cy + y, 1, 1, color);
}

export class Pinball implements MiniGame {
  readonly sim: PinballSim;
  /** Cuándo destelló cada bumper y cada carril (ms de la partida). */
  private flashAt = new Map<string, number>();
  private t = 0;

  constructor(seed: number) {
    this.sim = new PinballSim(seed);
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

  step(held: HeldKeys) {
    this.sim.step(held);
    this.t += ARCADE_STEP_MS;
    for (const h of this.sim.hits.splice(0)) this.flashAt.set(`${h.kind}:${h.x}`, this.t);
  }

  private lit(key: string, ms = 160) {
    const at = this.flashAt.get(key);
    return at !== undefined && this.t - at < ms;
  }

  draw(g: CanvasRenderingContext2D, t: number) {
    // El gabinete a los lados (madera oscura) y la mesa (violeta con estrellitas).
    rect(g, 0, 0, SCREEN_W, SCREEN_H, PAL.night(0));
    rect(g, PINBALL.left, PINBALL.top, PINBALL.right - PINBALL.left, SCREEN_H - PINBALL.top, PAL.violet(1));
    for (let k = 0; k < 18; k++) {
      const x = PINBALL.left + 3 + ((k * 37) % (PINBALL.laneX - PINBALL.left - 6));
      const y = 20 + ((k * 53) % 100);
      if ((k + Math.floor(t / 500)) % 4) rect(g, x, y, 1, 1, PAL.violet(3));
    }
    // El carril de lanzamiento, un poco más oscuro, con el resorte.
    rect(g, PINBALL.laneX, PINBALL.laneTop, PINBALL.right - PINBALL.laneX, SCREEN_H - PINBALL.laneTop, PAL.violet(0));
    const spring = this.sim.waiting ? 4 + Math.round(Math.sin(t / 150) * 1) : 6;
    for (let y = 0; y < spring; y += 2) rect(g, PINBALL.laneX + 2, PINBALL.plungerY + 1 + y, PINBALL.right - PINBALL.laneX - 4, 1, PAL.metal(3));
    // Los carriles de arriba: prendidos si ya pasó la bola.
    PINBALL.lanes.forEach((lx, i) => {
      const on = this.sim.lanes[i] || this.lit(`lane:${lx}`, 300);
      rect(g, lx - 5, PINBALL.laneY - 5, 1, 9, PAL.cream(3));
      rect(g, lx + 5, PINBALL.laneY - 5, 1, 9, PAL.cream(3));
      rect(g, lx - 2, PINBALL.laneY + 6, 5, 2, on ? PAL.gold(5) : PAL.gold(1));
    });
    // Las paredes y las guías.
    for (const [x0, y0, x1, y1] of PINBALL_WALLS) line(g, x0, y0, x1, y1, PAL.cream(4), 2);
    // Los bumpers: aro, centro y el destello al tocarlos.
    for (const b of PINBALL.bumpers) {
      const on = this.lit(`bumper:${b.x}`);
      disc(g, b.x, b.y, b.r, on ? PAL.white(4) : PAL.neon(3));
      disc(g, b.x, b.y, b.r - 2, on ? PAL.neon(5) : PAL.rug(4));
      rect(g, b.x - 1, b.y - 1, 2, 2, PAL.cream(5));
    }
    // Los flippers (dorados) con su eje.
    for (const side of ["left", "right"] as const) {
      const p = PINBALL.flipper[side];
      const tip = PinballSim.tip(side, this.sim.flip[side]);
      line(g, p.x, p.y, tip.x, tip.y, PAL.gold(4), 3);
      line(g, p.x, p.y - 1, tip.x, tip.y - 1, PAL.gold(5), 1);
      rect(g, p.x - 1, p.y - 1, 2, 2, PAL.metal(4));
    }
    // La bola, plateada con brillo.
    const b = this.sim.ball;
    disc(g, b.x, b.y, 2, PAL.metal(4));
    rect(g, b.x - 1, b.y - 1, 1, 1, PAL.white(4));
    // A la izquierda, las bolas que quedan; a la derecha del gabinete, la ayuda para lanzar.
    for (let k = 0; k < this.sim.balls; k++) disc(g, 12, 30 + k * 8, 2, PAL.metal(4));
    rect(g, 6, 20, 14, 1, PAL.cream(3));
    if (this.sim.waiting && Math.floor(t / 400) % 2 === 0) {
      rect(g, 126, 118, 26, 9, PAL.gold(4));
      rect(g, 127, 119, 24, 7, PAL.night(1));
      rect(g, 130, 122, 18, 1, PAL.gold(5));
    }
  }
}
