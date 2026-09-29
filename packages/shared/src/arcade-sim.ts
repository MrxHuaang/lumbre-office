// La lógica de los minijuegos del arcade, sin dibujo: la usan el navegador (que los dibuja) y el servidor
// (que repite la partida con su semilla y las teclas que mandó el cliente para validar el puntaje). Todo
// es determinista: pasos fijos de 1000/60 ms, azar con la semilla y solo sumas, productos y raíces (nada
// de seno ni coseno, que pueden dar distinto en cada motor de JavaScript).
import type { ArcadeGame } from "./arcade";
// El pinball (mundo lleno) está en su archivo: es el más largo.
import { PinballSim } from "./pinball-sim";

/** Paso fijo de la simulación (ms). */
export const ARCADE_STEP_MS = 1000 / 60;

export const SCREEN_W = 160;
export const SCREEN_H = 144;

export const ARCADE_KEYS = ["left", "right", "up", "down", "action"] as const;
export type ArcadeKey = (typeof ARCADE_KEYS)[number];
export type HeldKeys = Record<ArcadeKey, boolean>;

/** Un minijuego: se le pasan las teclas y avanza de a un paso fijo. */
export interface ArcadeSim {
  readonly score: number;
  readonly over: boolean;
  /** Tecla recién apretada. */
  press(k: ArcadeKey): void;
  /** Avanza un paso (ARCADE_STEP_MS). */
  step(held: HeldKeys): void;
}

/** Azar repetible con la semilla (mulberry32): el servidor da la semilla al empezar. */
export function seeded(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const noKeys = (): HeldKeys => ({ left: false, right: false, up: false, down: false, action: false });

// ---------- Culebrita ----------

export const SNAKE = {
  cell: 8,
  cols: SCREEN_W / 8,
  rows: SCREEN_H / 8,
  /** Cada cuánto avanza (ms): arranca tranquila y se acelera con cada manzana hasta un tope. */
  startMs: 140,
  minMs: 70,
  fasterMs: 3,
} as const;

type Dir = { x: number; y: number };
const DIRS: Record<Exclude<ArcadeKey, "action">, Dir> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export class SnakeSim implements ArcadeSim {
  score = 0;
  over = false;
  body: { x: number; y: number }[] = [];
  dir: Dir = DIRS.right;
  /** Giros pendientes (hasta dos: así se puede doblar rápido en U). */
  private turns: Dir[] = [];
  apple = { x: 0, y: 0 };
  private acc = 0;
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
    for (let i = 0; i < 4; i++) this.body.push({ x: 6 - i, y: Math.floor(SNAKE.rows / 2) });
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

  step() {
    if (this.over) return;
    this.acc += ARCADE_STEP_MS;
    const every = Math.max(SNAKE.minMs, SNAKE.startMs - this.score * SNAKE.fasterMs);
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
    if (next.x < 0 || next.y < 0 || next.x >= SNAKE.cols || next.y >= SNAKE.rows || body.some((b) => b.x === next.x && b.y === next.y)) {
      this.over = true;
      return;
    }
    this.body = [next, ...body];
    if (eats) {
      this.score++;
      this.placeApple();
    }
  }

  private placeApple() {
    for (let k = 0; k < 200; k++) {
      const x = Math.floor(this.rand() * SNAKE.cols);
      const y = Math.floor(this.rand() * SNAKE.rows);
      if (!this.body.some((b) => b.x === x && b.y === y)) {
        this.apple = { x, y };
        return;
      }
    }
  }
}

// ---------- Rompeladrillos ----------

export const BREAKOUT = {
  cols: 8,
  rows: 5,
  brickW: 18,
  brickH: 6,
  gap: 2,
  top: 18,
  left: (SCREEN_W - (8 * 18 + 7 * 2)) / 2,
  paddleW: 26,
  paddleY: SCREEN_H - 12,
  paddleSpeed: 150,
  ball: 3,
  ballSpeed: 95,
  /** Cuánto más rápida sale la pelota en cada muro nuevo. */
  levelBoost: 0.12,
  lives: 3,
} as const;

/** Vector de largo `speed` en la dirección (dx, dy). */
function aim(dx: number, dy: number, speed: number) {
  const len = Math.sqrt(dx * dx + dy * dy);
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}

export class BreakoutSim implements ArcadeSim {
  score = 0;
  over = false;
  bricks: boolean[] = [];
  paddle = SCREEN_W / 2 - BREAKOUT.paddleW / 2;
  ball = { x: 0, y: 0, vx: 0, vy: 0 };
  /** La pelota espera sobre la paleta hasta apretar espacio. */
  stuck = true;
  lives: number = BREAKOUT.lives;
  level = 0;
  /** Ladrillos rotos desde la última vez que se miró (el dibujo los usa para las chispas). */
  hits: { x: number; y: number; row: number }[] = [];
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
    this.wall();
    this.stickBall();
  }

  private wall() {
    this.bricks = Array.from({ length: BREAKOUT.cols * BREAKOUT.rows }, () => true);
    this.stuck = true;
  }

  private stickBall() {
    this.ball.x = this.paddle + BREAKOUT.paddleW / 2 - BREAKOUT.ball / 2;
    this.ball.y = BREAKOUT.paddleY - BREAKOUT.ball - 1;
  }

  press(k: ArcadeKey) {
    if ((k === "action" || k === "up") && this.stuck && !this.over) {
      this.stuck = false;
      const speed = BREAKOUT.ballSpeed * (1 + this.level * BREAKOUT.levelBoost);
      // Sale hacia arriba, inclinada al azar (de la semilla).
      const v = aim((this.rand() - 0.5) * 1.2, -1, speed);
      this.ball.vx = v.vx;
      this.ball.vy = v.vy;
    }
  }

  step(held: HeldKeys) {
    if (this.over) return;
    const s = ARCADE_STEP_MS / 1000;
    const move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.paddle = Math.max(2, Math.min(SCREEN_W - 2 - BREAKOUT.paddleW, this.paddle + move * BREAKOUT.paddleSpeed * s));
    if (this.stuck) {
      this.stickBall();
      return;
    }
    const b = this.ball;
    // En pasitos, para no atravesar ladrillos a velocidad alta.
    const n = Math.ceil((Math.sqrt(b.vx * b.vx + b.vy * b.vy) * s) / 2);
    for (let i = 0; i < n && !this.stuck && !this.over; i++) this.move(s / n);
  }

  private move(s: number) {
    const b = this.ball;
    const { ball: BALL, paddleY, paddleW } = BREAKOUT;
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
    if (b.vy > 0 && b.y + BALL >= paddleY && b.y + BALL <= paddleY + 4 && b.x + BALL >= this.paddle && b.x <= this.paddle + paddleW) {
      const hit = (b.x + BALL / 2 - (this.paddle + paddleW / 2)) / (paddleW / 2);
      const v = aim(Math.max(-1, Math.min(1, hit)) * 1.7, -1, Math.sqrt(b.vx * b.vx + b.vy * b.vy));
      b.vx = v.vx;
      b.vy = v.vy;
      b.y = paddleY - BALL;
    }
    if (b.y > SCREEN_H) {
      this.lives--;
      if (this.lives <= 0) this.over = true;
      else this.stuck = true;
      return;
    }
    const { cols, brickW, brickH, gap, left, top } = BREAKOUT;
    for (let i = 0; i < this.bricks.length; i++) {
      if (!this.bricks[i]) continue;
      const bx = left + (i % cols) * (brickW + gap);
      const by = top + Math.floor(i / cols) * (brickH + gap);
      if (b.x + BALL <= bx || b.x >= bx + brickW || b.y + BALL <= by || b.y >= by + brickH) continue;
      this.bricks[i] = false;
      this.score++;
      this.hits.push({ x: bx + brickW / 2, y: by + brickH / 2, row: Math.floor(i / cols) });
      // Rebota por el lado en el que entró menos.
      const overlapX = Math.min(b.x + BALL - bx, bx + brickW - b.x);
      const overlapY = Math.min(b.y + BALL - by, by + brickH - b.y);
      if (overlapX < overlapY) b.vx = -b.vx;
      else b.vy = -b.vy;
      if (this.bricks.every((x) => !x)) {
        this.level++;
        this.wall();
      }
      break;
    }
  }

  /** Para la ayuda en pantalla. */
  get waiting() {
    return this.stuck && !this.over;
  }
}

// ---------- Aleteo ----------

export const FLAPPY = {
  gravity: 430,
  flap: -150,
  maxFall: 220,
  speed: 60,
  pipeW: 16,
  gap: 46,
  /** Distancia entre tubos: sale uno cada 1,5 s. */
  spacing: 90,
  ground: SCREEN_H - 12,
  birdX: 40,
  /** Dónde flota el pajarito antes del primer aleteo. */
  startY: SCREEN_H / 2 - 10,
  /** Dónde nace cada tubo (a la derecha, fuera de la pantalla). */
  spawnX: SCREEN_W + 4,
} as const;

export class FlappySim implements ArcadeSim {
  score = 0;
  over = false;
  y: number = FLAPPY.startY;
  vy = 0;
  pipes: { x: number; gap: number; passed: boolean }[] = [];
  /** Cuánto se corrió el fondo (px). */
  scroll = 0;
  /** ms de partida y del último aleteo (para la animación). */
  t = 0;
  flapAt = -1000;
  /** Hasta el primer aleteo el pajarito flota y no salen tubos. */
  private waitingStart = true;
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
  }

  press(k: ArcadeKey) {
    if (this.over || (k !== "action" && k !== "up")) return;
    this.waitingStart = false;
    this.vy = FLAPPY.flap;
    this.flapAt = this.t;
  }

  step() {
    this.t += ARCADE_STEP_MS;
    if (this.over) return;
    const s = ARCADE_STEP_MS / 1000;
    const { gravity, maxFall, speed, spacing, pipeW, gap, ground, birdX, spawnX } = FLAPPY;
    this.scroll += speed * s;
    if (this.waitingStart) return;
    this.vy = Math.min(maxFall, this.vy + gravity * s);
    this.y += this.vy * s;
    const last = this.pipes.at(-1);
    if (!last || last.x < SCREEN_W - spacing) this.pipes.push({ x: spawnX, gap: 20 + Math.floor(this.rand() * (ground - 40 - gap)), passed: false });
    for (const p of this.pipes) {
      p.x -= speed * s;
      if (!p.passed && p.x + pipeW < birdX) {
        p.passed = true;
        this.score++;
      }
    }
    this.pipes = this.pipes.filter((p) => p.x > -pipeW - 2);
    // Choque: la caja del pajarito (un poco más chica que el dibujo, para que sea justo).
    const topY = this.y + 1;
    const bottom = this.y + 5;
    if (bottom >= ground || topY < 0) this.over = true;
    for (const p of this.pipes) if (birdX + 7 > p.x && birdX + 1 < p.x + pipeW && (topY < p.gap || bottom > p.gap + gap)) this.over = true;
  }

  get waiting() {
    return this.waitingStart && !this.over;
  }
}

// ---------- Bloques ----------

/**
 * Bloques (como el Tetris de bolsillo): caen piezas de cuatro cuadritos; se mueven con las flechas, se
 * giran con arriba, abajo las baja más rápido y espacio las deja caer de golpe. Cada fila llena se borra
 * y suma un punto (el puntaje son las filas). Todo en pasos enteros: el servidor la repite igual.
 */
export const BLOQUES = {
  cols: 10,
  rows: 20,
  /** Tamaño de cada cuadrito en la pantalla y dónde va el tablero. */
  cell: 7,
  left: 10,
  top: 2,
  /** Pasos por fila al caer: arranca en `gravityStart` y baja `faster` por nivel, hasta `gravityMin`. */
  gravityStart: 40,
  gravityMin: 5,
  faster: 3,
  linesPerLevel: 5,
  /** Con abajo apretado cae una fila cada tantos pasos. */
  softDrop: 2,
  /** Mantener izquierda o derecha: empieza a repetir a los `das` pasos, una vez cada `arr`. */
  das: 10,
  arr: 3,
  /** Pasos que una pieza apoyada espera antes de quedar fija (para acomodarla). */
  lockDelay: 20,
  /** Pasos sin pieza después de fijar una (y más si borró filas): acota cuántas filas caben por minuto. */
  spawnDelay: 12,
  clearDelay: 18,
} as const;

/** Las siete piezas en su caja (N x N), con el color de cada una (índice 1..7). */
const PIECES: readonly (readonly string[])[] = [
  ["....", "####", "....", "...."], // I
  ["##", "##"], // O
  [".#.", "###", "..."], // T
  [".##", "##.", "..."], // S
  ["##.", ".##", "..."], // Z
  ["#..", "###", "..."], // J
  ["..#", "###", "..."], // L
];

/** Celdas de la pieza `kind` con `rot` giros a la derecha, relativas a la esquina de su caja. */
export function bloquesCells(kind: number, rot: number): { x: number; y: number }[] {
  const shape = PIECES[kind]!;
  const n = shape.length;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (shape[y]![x] === "#") cells.push({ x, y });
  let out = cells;
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) out = out.map((c) => ({ x: n - 1 - c.y, y: c.x }));
  return out;
}

export interface BloquesPiece {
  kind: number;
  rot: number;
  x: number;
  y: number;
}

export class BloquesSim implements ArcadeSim {
  score = 0;
  over = false;
  /** El tablero por filas: 0 = vacío, 1..7 = el color de la pieza que quedó ahí. */
  board: number[] = Array.from({ length: BLOQUES.cols * BLOQUES.rows }, () => 0);
  piece: BloquesPiece | null = null;
  next = 0;
  /** Filas que se acaban de borrar y cuántos pasos lleva el destello (para el dibujo). */
  cleared: number[] = [];
  clearedAge = 0;
  private bag: number[] = [];
  private wait = 0;
  private fall = 0;
  private lock = 0;
  private repeat = 0;
  private rand: () => number;

  constructor(seed: number) {
    this.rand = seeded(seed);
    this.next = this.draw();
    this.spawn();
  }

  get lines() {
    return this.score;
  }
  get level() {
    return Math.floor(this.score / BLOQUES.linesPerLevel);
  }
  get waiting() {
    return false;
  }

  /** La siguiente pieza de la bolsa (salen las siete, mezcladas, antes de repetir). */
  private draw(): number {
    if (!this.bag.length) {
      const bag = [0, 1, 2, 3, 4, 5, 6];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j]!, bag[i]!];
      }
      this.bag = bag;
    }
    return this.bag.shift()!;
  }

  private spawn() {
    const kind = this.next;
    this.next = this.draw();
    const n = PIECES[kind]!.length;
    const piece = { kind, rot: 0, x: Math.floor((BLOQUES.cols - n) / 2), y: kind === 0 ? -1 : 0 };
    this.fall = 0;
    this.lock = 0;
    if (!this.fits(piece)) {
      this.over = true;
      this.piece = null;
      return;
    }
    this.piece = piece;
  }

  /** ¿Entra la pieza ahí? (dentro del tablero, sin pisar nada; arriba del borde vale). */
  fits(p: BloquesPiece): boolean {
    for (const c of bloquesCells(p.kind, p.rot)) {
      const x = p.x + c.x;
      const y = p.y + c.y;
      if (x < 0 || x >= BLOQUES.cols || y >= BLOQUES.rows) return false;
      if (y >= 0 && this.board[y * BLOQUES.cols + x]) return false;
    }
    return true;
  }

  private shift(dx: number, dy: number): boolean {
    const p = this.piece;
    if (!p) return false;
    const moved = { ...p, x: p.x + dx, y: p.y + dy };
    if (!this.fits(moved)) return false;
    this.piece = moved;
    return true;
  }

  /** Gira a la derecha; si choca, prueba corrida uno o dos cuadritos a cada lado. */
  private rotate() {
    const p = this.piece;
    if (!p) return;
    for (const dx of [0, -1, 1, -2, 2]) {
      const r = { ...p, rot: (p.rot + 1) % 4, x: p.x + dx };
      if (this.fits(r)) {
        this.piece = r;
        this.lock = 0;
        return;
      }
    }
  }

  /** Dónde caería la pieza si se soltara ahora (la sombra que se dibuja abajo). */
  ghostY(): number {
    const p = this.piece;
    if (!p) return 0;
    let y = p.y;
    while (this.fits({ ...p, y: y + 1 })) y++;
    return y;
  }

  press(k: ArcadeKey) {
    if (this.over || !this.piece) return;
    if (k === "left" || k === "right") {
      if (this.shift(k === "left" ? -1 : 1, 0)) this.lock = 0;
      this.repeat = 0;
    } else if (k === "up") this.rotate();
    else if (k === "action") {
      this.piece = { ...this.piece, y: this.ghostY() };
      this.settle();
    }
  }

  step(held: HeldKeys) {
    if (this.over) return;
    if (this.cleared.length) this.clearedAge++;
    if (!this.piece) {
      if (--this.wait <= 0) this.spawn();
      return;
    }
    // Mantener izquierda o derecha repite el paso.
    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (dir) {
      this.repeat++;
      if (this.repeat >= BLOQUES.das && (this.repeat - BLOQUES.das) % BLOQUES.arr === 0 && this.shift(dir, 0)) this.lock = 0;
    } else this.repeat = 0;
    const every = held.down ? BLOQUES.softDrop : Math.max(BLOQUES.gravityMin, BLOQUES.gravityStart - this.level * BLOQUES.faster);
    if (++this.fall >= every) {
      this.fall = 0;
      if (this.shift(0, 1)) this.lock = 0;
    }
    // Apoyada: después de un rato queda fija.
    if (this.piece && !this.fits({ ...this.piece, y: this.piece.y + 1 })) {
      if (++this.lock >= BLOQUES.lockDelay) this.settle();
    }
  }

  /** La pieza queda fija: se borran las filas llenas y hay una pausa antes de la siguiente. */
  private settle() {
    const p = this.piece;
    if (!p) return;
    for (const c of bloquesCells(p.kind, p.rot)) {
      const y = p.y + c.y;
      if (y < 0) {
        // Quedó asomada por arriba: se llenó el tablero.
        this.over = true;
        this.piece = null;
        return;
      }
      this.board[y * BLOQUES.cols + p.x + c.x] = p.kind + 1;
    }
    this.piece = null;
    const full: number[] = [];
    for (let y = 0; y < BLOQUES.rows; y++) {
      let n = 0;
      for (let x = 0; x < BLOQUES.cols; x++) if (this.board[y * BLOQUES.cols + x]) n++;
      if (n === BLOQUES.cols) full.push(y);
    }
    if (full.length) {
      const keep = this.board.filter((_, i) => !full.includes(Math.floor(i / BLOQUES.cols)));
      this.board = [...Array.from({ length: full.length * BLOQUES.cols }, () => 0), ...keep];
      this.score += full.length;
      this.cleared = full;
      this.clearedAge = 0;
    }
    this.wait = BLOQUES.spawnDelay + (full.length ? BLOQUES.clearDelay : 0);
  }
}

export function createArcadeSim(game: ArcadeGame, seed: number): SnakeSim | BreakoutSim | FlappySim | BloquesSim | PinballSim {
  if (game === "pinball") return new PinballSim(seed);
  if (game === "snake") return new SnakeSim(seed);
  if (game === "breakout") return new BreakoutSim(seed);
  if (game === "bloques") return new BloquesSim(seed);
  return new FlappySim(seed);
}

// ---------- Grabación y repetición ----------

/**
 * Cada tecla de la partida va como un número: `paso * 16 + tipo * 5 + tecla`, con tipo 0 = recién apretada
 * (`press`), 1 = se mantiene apretada y 2 = se soltó, y la tecla en el orden de ARCADE_KEYS. El evento del
 * paso `n` se aplica antes de dar ese paso.
 */
export type ArcadeInputKind = 0 | 1 | 2;
export const encodeInput = (step: number, kind: ArcadeInputKind, key: ArcadeKey) => step * 16 + kind * 5 + ARCADE_KEYS.indexOf(key);

export function decodeInput(n: number): { step: number; kind: ArcadeInputKind; key: ArcadeKey } | null {
  if (!Number.isInteger(n) || n < 0) return null;
  const code = n % 16;
  if (code >= 15) return null;
  return { step: Math.floor(n / 16), kind: Math.floor(code / 5) as ArcadeInputKind, key: ARCADE_KEYS[code % 5]! };
}

/** Graba lo que se aprieta durante la partida (en el navegador), para mandarlo al terminar. */
export class ArcadeRecorder {
  readonly inputs: number[] = [];
  steps = 0;

  hold(key: ArcadeKey) {
    this.inputs.push(encodeInput(this.steps, 1, key));
  }
  release(key: ArcadeKey) {
    this.inputs.push(encodeInput(this.steps, 2, key));
  }
  press(key: ArcadeKey) {
    this.inputs.push(encodeInput(this.steps, 0, key));
  }
}

export interface ArcadeReplay {
  /** Las teclas venían en orden y dentro de la partida. */
  valid: boolean;
  score: number;
  over: boolean;
}

/**
 * Repite una partida con la semilla y las teclas grabadas, `steps` pasos (o hasta que se pierda). Es lo
 * que hace el servidor para comprobar el puntaje que manda el cliente.
 */
export function replayArcade(game: ArcadeGame, seed: number, inputs: readonly number[], steps: number): ArcadeReplay {
  const events = inputs.map(decodeInput);
  // Las teclas tienen que venir en orden y no pasarse de la partida.
  for (let k = 0; k < events.length; k++) {
    const e = events[k];
    if (!e || e.step > steps || (k > 0 && e.step < events[k - 1]!.step)) return { valid: false, score: 0, over: false };
  }
  const sim = createArcadeSim(game, seed);
  const held = noKeys();
  let i = 0;
  for (let n = 0; n < steps && !sim.over; n++) {
    while (i < events.length && events[i]!.step === n) {
      const e = events[i++]!;
      if (e.kind === 0) sim.press(e.key);
      else held[e.key] = e.kind === 1;
    }
    sim.step(held);
  }
  return { valid: true, score: sim.score, over: sim.over };
}
