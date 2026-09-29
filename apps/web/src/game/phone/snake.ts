// La culebrita del celular (pantalla verde de una sola tinta). Lógica pura, avanza de a un paso: la
// pantalla decide cada cuánto. Cada comida alarga y acelera; cada cinco aparece un bicho que vale más
// y se va si no lo alcanzas. Se pierde al chocar con el borde o con la cola. El récord es solo local:
// no da puntos de la cabaña (eso tendría que validarlo el servidor).

export type SnakeDir = "up" | "down" | "left" | "right";
export interface Cell {
  x: number;
  y: number;
}

const DELTA: Record<SnakeDir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<SnakeDir, SnakeDir> = { up: "down", down: "up", left: "right", right: "left" };

export const PHONE_SNAKE = {
  cols: 22,
  rows: 15,
  /** Pasos por comida: cuánto dura el bicho en pantalla. */
  bugSteps: 28,
  /** Cada cuántas comidas aparece un bicho. */
  bugEvery: 5,
  food: 1,
  bug: 5,
  /** Milisegundos por paso: arranca tranquila y se acelera hasta un tope. */
  startMs: 170,
  minMs: 75,
  fasterMs: 5,
} as const;

export type SnakeEvent = "eat" | "bug" | "die" | null;

export class PhoneSnake {
  body: Cell[] = [];
  dir: SnakeDir = "right";
  /** Giros pedidos entre paso y paso (hasta dos, para doblar en U rápido). */
  private turns: SnakeDir[] = [];
  food: Cell = { x: 0, y: 0 };
  bug: (Cell & { left: number }) | null = null;
  score = 0;
  eaten = 0;
  over = false;

  constructor(
    readonly cols: number = PHONE_SNAKE.cols,
    readonly rows: number = PHONE_SNAKE.rows,
    private rand: () => number = Math.random,
  ) {
    const y = Math.floor(rows / 2);
    for (let i = 0; i < 4; i++) this.body.push({ x: 5 - i, y });
    this.food = this.freeCell();
  }

  /** Milisegundos hasta el próximo paso. */
  get stepMs() {
    return Math.max(PHONE_SNAKE.minMs, PHONE_SNAKE.startMs - this.eaten * PHONE_SNAKE.fasterMs);
  }

  turn(d: SnakeDir) {
    const last = this.turns.at(-1) ?? this.dir;
    if (d === last || d === OPPOSITE[last]) return; // no se da media vuelta sobre sí misma
    if (this.turns.length < 2) this.turns.push(d);
  }

  step(): SnakeEvent {
    if (this.over) return null;
    this.dir = this.turns.shift() ?? this.dir;
    const head = this.body[0]!;
    const next = { x: head.x + DELTA[this.dir].x, y: head.y + DELTA[this.dir].y };
    const eats = same(next, this.food);
    const catches = this.bug !== null && same(next, this.bug);
    const grows = eats || catches;
    // La cola se corre en el mismo paso: se puede ir pegado detrás de ella.
    const rest = grows ? this.body : this.body.slice(0, -1);
    if (next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows || rest.some((c) => same(c, next))) {
      this.over = true;
      return "die";
    }
    this.body = [next, ...rest];
    if (this.bug && --this.bug.left <= 0) this.bug = null;
    if (catches) {
      this.score += PHONE_SNAKE.bug;
      this.bug = null;
      return "bug";
    }
    if (eats) {
      this.score += PHONE_SNAKE.food;
      this.eaten++;
      this.food = this.freeCell();
      if (this.eaten % PHONE_SNAKE.bugEvery === 0) this.bug = { ...this.freeCell(), left: PHONE_SNAKE.bugSteps };
      return "eat";
    }
    return null;
  }

  private freeCell(): Cell {
    for (let k = 0; k < 400; k++) {
      const c = { x: Math.floor(this.rand() * this.cols), y: Math.floor(this.rand() * this.rows) };
      if (!this.body.some((b) => same(b, c)) && !same(c, this.food)) return c;
    }
    // Pantalla casi llena: la primera libre, recorriendo en orden.
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) if (!this.body.some((b) => b.x === x && b.y === y)) return { x, y };
    return { x: 0, y: 0 };
  }
}

const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
