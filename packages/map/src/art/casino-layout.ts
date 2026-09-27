// Geometría de las mesas del casino, compartida por el dibujo del mueble (art/casino.ts) y el modo mesa
// (art/casino-mesa.ts, que dibuja encima en alta resolución y recibe los clics). Todo en unidades de
// arte locales del mueble mirando hacia "right": u a lo largo de x, v a lo largo de y, z hacia arriba.
import { colorOf, type RouletteBetSpec } from "@hyvento/shared";

// ---------- Paño de la ruleta (3x4 tiles = 48x64) ----------

/** Altura del paño (la cara de arriba de la mesa). */
export const ROULETTE_TOP_Z = 14;
/** Rectángulo del paño, dentro del borde acolchado. */
export const ROULETTE_FELT = { u0: 3.5, v0: 3.5, u1: 44.5, v1: 60.5 } as const;

/** Columnas de números (u), docenas y apuestas sencillas; filas (v): el cero, 12 filas y los 2:1. */
const NUM_U0 = 5;
const COL_W = 8;
const DOZEN_U: [number, number] = [NUM_U0 + COL_W * 3, NUM_U0 + COL_W * 3 + 7];
const EVEN_U: [number, number] = [DOZEN_U[1], DOZEN_U[1] + 7];
const ZERO_V: [number, number] = [4.5, 9];
const ROW_V0 = ZERO_V[1];
export const ROULETTE_ROW_H = 3.875;
const COLS_V: [number, number] = [ROW_V0 + ROULETTE_ROW_H * 12, ROW_V0 + ROULETTE_ROW_H * 12 + 4];

export type CellFill = "red" | "black" | "green" | "felt";

export interface RouletteCell {
  spec: RouletteBetSpec;
  /** Clave única de la apuesta (igual para todas las fichas del mismo lugar). */
  key: string;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  fill: CellFill;
  /** Lo que va escrito (vacío en el rojo y el negro, que llevan un rombo). */
  label: string;
  /** Dónde va el texto y dónde las fichas (para que la ficha no tape el número). */
  text: { u: number; v: number };
  chip: { u: number; v: number };
  /** Forma especial: el cero termina en punta y el rojo y el negro llevan un rombo. */
  shape?: "zero" | "diamond";
}

/** Clave de una apuesta (la misma que arma el cliente con lo que sincroniza el servidor). */
export function betKey(kind: string, param: number): string {
  return `${kind}:${param}`;
}

export function specKey(s: RouletteBetSpec): string {
  return betKey(s.kind, s.kind === "number" ? s.n : s.kind === "dozen" ? s.d : s.kind === "column" ? s.c : -1);
}

/**
 * Columna (0 = la de atrás, junto al borde de -u) del número `n`. Como en las mesas de verdad, la
 * columna del 1, 4, 7… queda junto a las docenas, del lado de quien apuesta.
 */
const colOf = (n: number) => 2 - ((n - 1) % 3);
const rowOf = (n: number) => Math.ceil(n / 3) - 1;

function cell(spec: RouletteBetSpec, u0: number, v0: number, u1: number, v1: number, fill: CellFill, label: string, shape?: RouletteCell["shape"]): RouletteCell {
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  // En los números y los 2:1 la ficha va hacia +u y el texto hacia -u (la celda es larga a lo ancho de
  // u); en las docenas, a lo largo de v. En las sencillas la ficha tapa el rótulo, como en la mesa real.
  const wide = (spec.kind === "number" && spec.n > 0) || spec.kind === "column";
  const place = (du: number, dv: number) => ({ u: cu + du, v: cv + dv });
  return {
    spec,
    key: specKey(spec),
    u0,
    v0,
    u1,
    v1,
    fill,
    label,
    text: wide ? place(-1.9, 0) : spec.kind === "dozen" ? place(0, -3) : place(0, 0),
    chip: wide ? place(2, 0) : spec.kind === "dozen" ? place(0, 4) : spec.kind === "number" ? place(5.5, 0.4) : place(0, 0),
    shape,
  };
}

/** Todas las casillas del paño, en el orden en que se dibujan. */
export const ROULETTE_CELLS: readonly RouletteCell[] = (() => {
  const cells: RouletteCell[] = [];
  cells.push(cell({ kind: "number", n: 0 }, NUM_U0, ZERO_V[0], NUM_U0 + COL_W * 3, ZERO_V[1], "green", "0", "zero"));
  for (let n = 1; n <= 36; n++) {
    const u0 = NUM_U0 + colOf(n) * COL_W;
    const v0 = ROW_V0 + rowOf(n) * ROULETTE_ROW_H;
    cells.push(cell({ kind: "number", n }, u0, v0, u0 + COL_W, v0 + ROULETTE_ROW_H, colorOf(n) as CellFill, String(n)));
  }
  for (let c = 1 as 1 | 2 | 3; c <= 3; c = (c + 1) as 1 | 2 | 3) {
    // La columna del 1 (c = 1) es la de colOf(1) = 2.
    const u0 = NUM_U0 + (3 - c) * COL_W;
    cells.push(cell({ kind: "column", c }, u0, COLS_V[0], u0 + COL_W, COLS_V[1], "felt", "2:1"));
  }
  const dozenH = ROULETTE_ROW_H * 4;
  for (let d = 1 as 1 | 2 | 3; d <= 3; d = (d + 1) as 1 | 2 | 3) {
    const v0 = ROW_V0 + (d - 1) * dozenH;
    cells.push(cell({ kind: "dozen", d }, DOZEN_U[0], v0, DOZEN_U[1], v0 + dozenH, "felt", `${(d - 1) * 12 + 1}-${d * 12}`));
  }
  const evens: [RouletteBetSpec, string, CellFill, RouletteCell["shape"]?][] = [
    [{ kind: "low" }, "1-18", "felt"],
    [{ kind: "even" }, "PAR", "felt"],
    [{ kind: "red" }, "", "red", "diamond"],
    [{ kind: "black" }, "", "black", "diamond"],
    [{ kind: "odd" }, "IMPAR", "felt"],
    [{ kind: "high" }, "19-36", "felt"],
  ];
  const evenH = ROULETTE_ROW_H * 2;
  evens.forEach(([spec, label, fill, shape], i) => {
    const v0 = ROW_V0 + i * evenH;
    cells.push(cell(spec, EVEN_U[0], v0, EVEN_U[1], v0 + evenH, fill, label, shape));
  });
  return cells;
})();

/** ¿Está (u, v) dentro de la casilla? (El cero, sin sus puntas cortadas.) */
export function insideCell(c: RouletteCell, u: number, v: number): boolean {
  if (u < c.u0 || u >= c.u1 || v < c.v0 || v >= c.v1) return false;
  if (c.shape === "zero") {
    // Punta hacia -v: se cortan en diagonal las dos esquinas del lado del borde.
    const k = (c.v1 - c.v0) * 0.9;
    const du = Math.min(u - c.u0, c.u1 - u);
    return du / (k * 2.2) + (v - c.v0) / k >= 1;
  }
  return true;
}

/** Casilla del paño bajo (u, v), o null (borde, fieltro sin apuesta). */
export function rouletteCellAt(u: number, v: number): RouletteCell | null {
  for (const c of ROULETTE_CELLS) if (insideCell(c, u, v)) return c;
  return null;
}

export function rouletteCellOf(key: string): RouletteCell | undefined {
  return ROULETTE_CELLS.find((c) => c.key === key);
}

// ---------- Rueda (2x2 tiles = 32x32) ----------

/** Centro y alto de la cara de arriba de la rueda (el plato gira sobre el pedestal). */
export const WHEEL_CENTER = { u: 16, v: 16 } as const;
export const WHEEL_TOP_Z = 14;
/** Radios del plato, de afuera hacia adentro (unidades de arte sobre el piso). */
export const WHEEL_R = {
  /** Borde de madera del cuenco, con el labio de bronce. */
  rim: 14.5,
  lip: 13.9,
  /** Pista por donde corre la bola. */
  track: 13.0,
  /** Aro de bronce donde empieza la parte que gira. */
  head: 12.3,
  /** Aro de los números (rojo, negro y el cero verde). */
  numbers: 12.0,
  /** Casilleros donde cae la bola, separados por trastes de bronce. */
  pockets: 9.3,
  /** Cono de madera con los brazos de la torreta. */
  cone: 7.0,
  turret: 1.5,
} as const;

// ---------- Blackjack (2x3 tiles = 32x48) ----------

export const BLACKJACK_TOP_Z = 14;
/**
 * Mesa en forma de D: el lado recto (u chico) es del crupier, con la bandeja de fichas y el sabot; el
 * lado curvo mira a las banquetas. `edge(v)` = hasta qué u llega el paño a esa altura.
 */
export const BLACKJACK_SHAPE = { u0: 1, straight: 12, u1: 31, v0: 1, v1: 47 } as const;
export function blackjackEdge(v: number): number {
  const { straight, u1, v0, v1 } = BLACKJACK_SHAPE;
  const cv = (v0 + v1) / 2;
  const t = (v - cv) / ((v1 - v0) / 2);
  if (Math.abs(t) >= 1) return straight;
  return straight + (u1 - straight) * Math.sqrt(1 - t * t);
}
/** Círculos de apuesta, en el orden de los asientos 1 a 5 (de -v a +v, siguiendo la curva). */
export const BLACKJACK_SPOTS: readonly { u: number; v: number }[] = [8.5, 16.2, 24, 31.8, 39.5].map((v) => ({
  u: blackjackEdge(v) - 5.2,
  v,
}));
/** Dónde van las cartas del crupier (junto al lado recto) y el sabot. */
export const BLACKJACK_DEALER = { u: 9, v: 24 } as const;
export const BLACKJACK_SHOE = { u: 5, v: 36 } as const;
/** Arco del texto ("BLACKJACK PAGA 3 A 2"): centro y radio, alrededor del crupier. */
export const BLACKJACK_ARC = { u: 4, v: 24, r: 10.5 } as const;
