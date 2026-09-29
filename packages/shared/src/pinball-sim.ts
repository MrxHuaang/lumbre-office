// El pinball del arcade (sótano), sin dibujo: lo usan el navegador (que lo dibuja) y el servidor (que repite
// la partida con la semilla y las teclas para validar el puntaje), como los demás juegos de arcade-sim.ts.
// Todo es determinista: pasos fijos, azar con la semilla y solo sumas, productos, divisiones y raíces.
// La mesa ocupa el centro de la pantalla (160x144): paredes, tres bumpers, tres carriles arriba, las guías
// de abajo, dos flippers y el carril de lanzamiento a la derecha. Tres bolas.
import type { ArcadeKey, ArcadeSim, HeldKeys } from "./arcade-sim";
import { ARCADE_STEP_MS, seeded } from "./arcade-sim";

export const PINBALL = {
  /** Paredes de la mesa (px de la pantalla) y el carril de lanzamiento (entre `laneX` y `right`). */
  left: 42,
  right: 118,
  top: 6,
  laneX: 108,
  /** Hasta dónde baja la pared del carril (de ahí para arriba la bola entra a la mesa). */
  laneTop: 30,
  /** El piso del carril, donde espera la bola. */
  plungerY: 134,
  ballR: 2.5,
  /** Gravedad (px/s²), la fuerza del lanzamiento (px/s) y el tope de velocidad. */
  gravity: 150,
  launch: 250,
  maxSpeed: 420,
  balls: 3,
  bumpers: [
    { x: 58, y: 40, r: 6 },
    { x: 86, y: 40, r: 6 },
    { x: 72, y: 60, r: 6 },
  ],
  /** Con cuánta velocidad sale la bola de un bumper, y lo que da cada toque. */
  bumperKick: 150,
  bumperScore: 10,
  /** Los tres carriles de arriba: cada uno da `laneScore` y prenderlos todos, `laneBonus`. */
  lanes: [52, 72, 92],
  laneY: 16,
  laneHalf: 5,
  laneScore: 25,
  laneBonus: 100,
  /** Flippers: el eje, la punta en reposo y arriba (relativa al eje) y el largo. */
  flipper: { len: 15, left: { x: 57, y: 124 }, right: { x: 93, y: 124 }, restDy: 7, upDy: -7, dx: 13 },
  /** Qué tan rápido sube y baja (fracción del recorrido por segundo) y cuánto empuja. */
  flipUp: 16,
  flipDown: 9,
  flipKick: 3.2,
  /** Pasos chicos por paso fijo (para que la bola rápida no atraviese las paredes). */
  substeps: 4,
} as const;

type Seg = readonly [number, number, number, number];

/** Las paredes fijas: arriba, los costados, las esquinas de arriba, la pared del carril y las guías. */
const WALLS: readonly Seg[] = [
  [PINBALL.left, PINBALL.top, PINBALL.right, PINBALL.top],
  [PINBALL.left, PINBALL.top, PINBALL.left, 104],
  [PINBALL.right, PINBALL.top, PINBALL.right, 150],
  [PINBALL.left, 20, 56, PINBALL.top],
  [PINBALL.right, 22, 100, PINBALL.top],
  [PINBALL.laneX, PINBALL.laneTop, PINBALL.laneX, 150],
  [PINBALL.laneX, PINBALL.plungerY, PINBALL.right, PINBALL.plungerY],
  // Las guías de abajo, que llevan la bola a los flippers.
  [PINBALL.left, 104, PINBALL.flipper.left.x, PINBALL.flipper.left.y - 1],
  [PINBALL.laneX, 104, PINBALL.flipper.right.x, PINBALL.flipper.right.y - 1],
];
export const PINBALL_WALLS = WALLS;

export class PinballSim implements ArcadeSim {
  score = 0;
  over = false;
  balls: number = PINBALL.balls;
  ball = { x: 0, y: 0, vx: 0, vy: 0 };
  /** La bola espera en el carril de lanzamiento. */
  waiting = true;
  /** Qué tan arriba está cada flipper (0 reposo, 1 arriba). */
  flip = { left: 0, right: 0 };
  lanes: boolean[] = [false, false, false];
  /** Toques desde la última vez que se miró (el dibujo los usa para los destellos). */
  hits: { x: number; y: number; kind: "bumper" | "lane" }[] = [];
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
    this.resetBall();
  }

  private resetBall() {
    this.ball = { x: (PINBALL.laneX + PINBALL.right) / 2, y: PINBALL.plungerY - PINBALL.ballR, vx: 0, vy: 0 };
    this.waiting = true;
  }

  press(k: ArcadeKey) {
    if ((k === "action" || k === "down" || k === "up") && this.waiting && !this.over) {
      this.waiting = false;
      this.ball.vy = -(PINBALL.launch + this.rand() * 25);
      this.ball.vx = 0;
    }
  }

  /** La punta del flipper con esa subida (0..1), del largo de siempre. */
  static tip(side: "left" | "right", t: number): { x: number; y: number } {
    const f = PINBALL.flipper;
    const p = f[side];
    const dx = side === "left" ? f.dx : -f.dx;
    const dy = f.restDy + (f.upDy - f.restDy) * t;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: p.x + (dx / len) * f.len, y: p.y + (dy / len) * f.len };
  }

  step(held: HeldKeys) {
    if (this.over) return;
    const dt = ARCADE_STEP_MS / 1000;
    const moving = { left: 0, right: 0 };
    for (const side of ["left", "right"] as const) {
      const up = held[side];
      const before = this.flip[side];
      this.flip[side] = up ? Math.min(1, before + PINBALL.flipUp * dt) : Math.max(0, before - PINBALL.flipDown * dt);
      moving[side] = this.flip[side] - before;
    }
    if (this.waiting) return;
    const n = PINBALL.substeps;
    const h = dt / n;
    for (let s = 0; s < n && !this.waiting && !this.over; s++) this.substep(h, moving);
  }

  private substep(h: number, moving: { left: number; right: number }) {
    const b = this.ball;
    const prevY = b.y;
    b.vy += PINBALL.gravity * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    const r = PINBALL.ballR;
    for (const w of WALLS) this.collideSegment(w[0], w[1], w[2], w[3], 0.6, 0);
    for (const side of ["left", "right"] as const) {
      const p = PINBALL.flipper[side];
      const tip = PinballSim.tip(side, this.flip[side]);
      this.collideSegment(p.x, p.y, tip.x, tip.y, 0.4, moving[side] > 0 ? moving[side] : 0, p);
    }
    for (const bu of PINBALL.bumpers) {
      const dx = b.x - bu.x;
      const dy = b.y - bu.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= bu.r + r || d === 0) continue;
      const nx = dx / d;
      const ny = dy / d;
      b.x = bu.x + nx * (bu.r + r);
      b.y = bu.y + ny * (bu.r + r);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 2 * vn * nx;
        b.vy -= 2 * vn * ny;
      }
      const out = b.vx * nx + b.vy * ny;
      if (out < PINBALL.bumperKick) {
        b.vx += nx * (PINBALL.bumperKick - out);
        b.vy += ny * (PINBALL.bumperKick - out);
      }
      this.score += PINBALL.bumperScore;
      this.hits.push({ x: bu.x, y: bu.y, kind: "bumper" });
    }
    // Los carriles de arriba: cuentan al cruzarlos subiendo.
    if (prevY > PINBALL.laneY && b.y <= PINBALL.laneY) {
      PINBALL.lanes.forEach((lx, i) => {
        if (Math.abs(b.x - lx) > PINBALL.laneHalf || this.lanes[i]) return;
        this.lanes[i] = true;
        this.score += PINBALL.laneScore;
        this.hits.push({ x: lx, y: PINBALL.laneY, kind: "lane" });
      });
      if (this.lanes.every(Boolean)) {
        this.score += PINBALL.laneBonus;
        this.lanes = [false, false, false];
      }
    }
    // Tope de velocidad.
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > PINBALL.maxSpeed) {
      b.vx = (b.vx / sp) * PINBALL.maxSpeed;
      b.vy = (b.vy / sp) * PINBALL.maxSpeed;
    }
    // Se volvió a quedar quieta en el carril: espera otro lanzamiento (no se pierde la bola).
    if (b.x > PINBALL.laneX && b.y >= PINBALL.plungerY - r - 0.5 && Math.abs(b.vy) < 20) this.resetBall();
    // Se fue por abajo.
    if (b.y > 150) {
      this.balls -= 1;
      if (this.balls <= 0) this.over = true;
      else this.resetBall();
    }
  }

  /**
   * Choque con un segmento (una pared o un flipper): se saca la bola y se refleja con la restitución `e`.
   * Un flipper que está subiendo (`push` > 0) además la empuja, más fuerte cuanto más lejos del eje.
   */
  private collideSegment(ax: number, ay: number, bx: number, by: number, e: number, push: number, pivot?: { x: number; y: number }) {
    const b = this.ball;
    const r = PINBALL.ballR;
    const ex = bx - ax;
    const ey = by - ay;
    const len2 = ex * ex + ey * ey;
    let t = len2 > 0 ? ((b.x - ax) * ex + (b.y - ay) * ey) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + ex * t;
    const qy = ay + ey * t;
    const dx = b.x - qx;
    const dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    const d = Math.sqrt(d2);
    // Justo encima de la línea: la normal sale hacia arriba del segmento.
    const nx = d > 0 ? dx / d : -ey / Math.sqrt(len2);
    const ny = d > 0 ? dy / d : ex / Math.sqrt(len2);
    b.x = qx + nx * r;
    b.y = qy + ny * r;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
    }
    if (push > 0 && pivot) {
      const lx = qx - pivot.x;
      const ly = qy - pivot.y;
      const lever = Math.sqrt(lx * lx + ly * ly);
      const kick = push * lever * PINBALL.flipKick * 60;
      b.vx += nx * kick;
      b.vy += ny * kick;
    }
  }
}
