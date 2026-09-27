// Lógica pura del Buscaminas (sin React): cada jugada devuelve un tablero nuevo, así se puede testear
// y la interfaz solo dibuja. Las casillas van en arreglos planos: índice = y * ancho + x.

export type DifficultyId = "facil" | "medio";

export const DIFFICULTIES: Record<DifficultyId, { label: string; w: number; h: number; mines: number }> = {
  facil: { label: "Principiante", w: 9, h: 9, mines: 10 },
  medio: { label: "Intermedio", w: 16, h: 16, mines: 40 },
};

export type CellState = "hidden" | "flag" | "open";
export type GameStatus = "ready" | "playing" | "won" | "lost";

export interface Board {
  w: number;
  h: number;
  mines: number;
  /** Dónde hay minas (se ponen en la primera jugada, para que el primer clic nunca sea mina). */
  mine: boolean[];
  /** Minas vecinas de cada casilla. */
  adj: number[];
  state: CellState[];
  status: GameStatus;
  /** La mina que se pisó al perder. */
  exploded: number | null;
}

export function newBoard(w: number, h: number, mines: number): Board {
  const n = w * h;
  return {
    w,
    h,
    mines: Math.min(mines, n - 1),
    mine: Array<boolean>(n).fill(false),
    adj: Array<number>(n).fill(0),
    state: Array<CellState>(n).fill("hidden"),
    status: "ready",
    exploded: null,
  };
}

export function neighbors(w: number, h: number, i: number): number[] {
  const x = i % w;
  const y = Math.floor(i / w);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
}

/** Pone las minas lejos de la primera casilla (y de sus vecinas si caben), así el primer clic abre un claro. */
export function placeMines(b: Board, safe: number, rng: () => number = Math.random): Board {
  const n = b.w * b.h;
  const around = new Set([safe, ...neighbors(b.w, b.h, safe)]);
  const excluded = n - around.size >= b.mines ? around : new Set([safe]);
  const pool: number[] = [];
  for (let i = 0; i < n; i++) if (!excluded.has(i)) pool.push(i);
  // Fisher-Yates parcial: solo hace falta barajar las primeras `mines` posiciones.
  for (let k = 0; k < b.mines; k++) {
    const j = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j]!, pool[k]!];
  }
  const mine = Array<boolean>(n).fill(false);
  for (let k = 0; k < b.mines; k++) mine[pool[k]!] = true;
  const adj = mine.map((_, i) => neighbors(b.w, b.h, i).filter((j) => mine[j]).length);
  return { ...b, mine, adj, status: "playing" };
}

export const flagsPlaced = (b: Board) => b.state.filter((s) => s === "flag").length;
/** Contador de minas: puede quedar negativo si se ponen banderas de más (como en el clásico). */
export const minesLeft = (b: Board) => b.mines - flagsPlaced(b);
const isOver = (b: Board) => b.status === "won" || b.status === "lost";

/** Abre casillas desde `starts` (sobre la copia `state`); las que no tienen minas vecinas se expanden solas. */
function flood(b: Board, state: CellState[], starts: number[]): void {
  const stack = [...starts];
  while (stack.length) {
    const i = stack.pop()!;
    if (state[i] !== "hidden" || b.mine[i]) continue;
    state[i] = "open";
    if (b.adj[i] === 0) for (const j of neighbors(b.w, b.h, i)) if (state[j] === "hidden") stack.push(j);
  }
}

/** Revisa si se ganó (todas las casillas sin mina abiertas): entonces se marcan las minas con bandera. */
function finish(b: Board, state: CellState[]): Board {
  const safeCells = b.w * b.h - b.mines;
  const opened = state.filter((s) => s === "open").length;
  if (opened < safeCells) return { ...b, state };
  return { ...b, state: state.map((s, i) => (b.mine[i] ? "flag" : s)), status: "won" };
}

function explode(b: Board, state: CellState[], at: number): Board {
  return { ...b, state, status: "lost", exploded: at };
}

/** Clic en una casilla tapada. La primera jugada pone las minas. */
export function reveal(board: Board, i: number, rng: () => number = Math.random): Board {
  if (isOver(board) || board.state[i] !== "hidden") return board;
  const b = board.status === "ready" ? placeMines(board, i, rng) : board;
  const state = [...b.state];
  if (b.mine[i]) return explode(b, state, i);
  flood(b, state, [i]);
  return finish(b, state);
}

/** Clic derecho: poner o quitar bandera en una casilla tapada. */
export function toggleFlag(b: Board, i: number): Board {
  if (isOver(b) || b.state[i] === "open") return b;
  const state = [...b.state];
  state[i] = state[i] === "flag" ? "hidden" : "flag";
  return { ...b, state };
}

/**
 * "Chord": clic en un número que ya tiene alrededor tantas banderas como minas. Abre el resto de las
 * vecinas de una vez (y si alguna bandera estaba mal, se pisa la mina).
 */
export function chord(b: Board, i: number): Board {
  if (b.status !== "playing" || b.state[i] !== "open" || b.adj[i] === 0) return b;
  const around = neighbors(b.w, b.h, i);
  const flags = around.filter((j) => b.state[j] === "flag").length;
  if (flags !== b.adj[i]) return b;
  const toOpen = around.filter((j) => b.state[j] === "hidden");
  if (toOpen.length === 0) return b;
  const state = [...b.state];
  const boom = toOpen.find((j) => b.mine[j]);
  if (boom !== undefined) {
    for (const j of toOpen) if (!b.mine[j]) flood(b, state, [j]);
    return explode(b, state, boom);
  }
  flood(b, state, toOpen);
  return finish(b, state);
}
