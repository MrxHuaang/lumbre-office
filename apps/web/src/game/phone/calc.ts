// La calculadora del celular: como las de antes, de a una operación (sin paréntesis ni prioridad).
// El * del teclado va cambiando la operación y el # pone la coma. Lógica pura.

export type CalcOp = "+" | "-" | "×" | "÷";
export const CALC_OPS: CalcOp[] = ["+", "-", "×", "÷"];

export interface CalcState {
  /** Lo que se está escribiendo (texto, para no perder ceros ni la coma). */
  entry: string;
  /** Lo que ya se guardó antes de la operación. */
  acc: number | null;
  op: CalcOp | null;
  /** Se acaba de apretar "=" o una operación: el próximo número empieza de cero. */
  fresh: boolean;
  error: boolean;
}

export const emptyCalc = (): CalcState => ({ entry: "0", acc: null, op: null, fresh: false, error: false });

const MAX_DIGITS = 10;

export function calcDigit(s: CalcState, d: string): CalcState {
  if (s.error) s = emptyCalc();
  const entry = s.fresh || s.entry === "0" ? d : s.entry.length >= MAX_DIGITS ? s.entry : s.entry + d;
  return { ...s, entry, fresh: false };
}

export function calcDot(s: CalcState): CalcState {
  if (s.error) s = emptyCalc();
  if (s.fresh) return { ...s, entry: "0.", fresh: false };
  return s.entry.includes(".") ? s : { ...s, entry: s.entry + "." };
}

function apply(a: number, op: CalcOp, b: number): number | null {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? null : a / b;
}

/** Elige la operación (si ya había una con número escrito, primero la resuelve). */
export function calcOp(s: CalcState, op: CalcOp): CalcState {
  if (s.error) return s;
  if (s.fresh && s.op) return { ...s, op }; // cambiar de operación sin número nuevo
  const solved = s.op && s.acc !== null ? calcEquals(s) : s;
  if (solved.error) return solved;
  return { ...solved, acc: Number(solved.entry), op, fresh: true };
}

/** Siguiente operación de la lista (el * del teclado). */
export function calcNextOp(s: CalcState): CalcState {
  const next = s.fresh && s.op ? CALC_OPS[(CALC_OPS.indexOf(s.op) + 1) % CALC_OPS.length]! : "+";
  return calcOp(s, next);
}

export function calcEquals(s: CalcState): CalcState {
  if (s.error || !s.op || s.acc === null) return s;
  const r = apply(s.acc, s.op, Number(s.entry));
  if (r === null || !Number.isFinite(r)) return { ...emptyCalc(), error: true };
  return { entry: formatCalc(r), acc: null, op: null, fresh: true, error: false };
}

export function calcBack(s: CalcState): CalcState {
  if (s.error || s.fresh) return emptyCalc();
  return { ...s, entry: s.entry.length > 1 ? s.entry.slice(0, -1) : "0" };
}

/** Número para la pantalla (a lo más 10 cifras, sin ceros de sobra). */
export function formatCalc(n: number): string {
  if (Math.abs(n) >= 1e10) return n.toExponential(3);
  const s = Number(n.toPrecision(10)).toString();
  return s.length > 12 ? n.toExponential(3) : s;
}
