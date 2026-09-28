// El letrero de la cabaña con el nombre de un equipo, para la portada: las mismas letras de 3x5 del
// letrero del porche (art/exterior-casa.ts), pero con todo el abecedario. Solo datos y cuentas: la
// vista (Letrero.tsx) dibuja los píxeles. Nada de esto se guarda en ningún lado.

/** Letras de 3x5 (filas de arriba abajo). La Ñ lleva la virgulilla en la fila de arriba. */
const GLIFOS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  Ñ: ["###", "...", "##.", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["##.", "..#", ".#.", "#..", "###"],
  "3": ["##.", "..#", ".#.", "..#", "##."],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "##.", "..#", "##."],
  "6": [".##", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "##."],
  "&": [".#.", "#.#", ".#.", "#.#", ".##"],
  "-": ["...", "...", "###", "...", "..."],
  ".": ["...", "...", "...", "...", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
};

/** Lo más largo que cabe en el letrero (como el alero del porche). */
export const LETRERO_MAX = 16;
/** El nombre que se ve antes de que alguien escriba el suyo. */
export const NOMBRE_EJEMPLO = "Los del Fogon";

/**
 * El nombre como va en el letrero: en mayúsculas, sin tildes (salvo la Ñ), solo lo que tiene letra y
 * sin espacios repetidos. Vacío si no queda nada.
 */
export function nombreDeLetrero(texto: string): string {
  const limpio = [...texto.toUpperCase()]
    .map((ch) => (ch === "Ñ" ? ch : ch.normalize("NFD").replace(/[̀-ͯ]/g, "")))
    .join("")
    .replace(/[^A-Z0-9Ñ&.!\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpio.slice(0, LETRERO_MAX).trim();
}

/** Los píxeles encendidos de un texto en letras de 3x5, con 1 de separación (el espacio mide 2). */
export function pixelesDeLetrero(texto: string): { w: number; h: number; pixeles: { x: number; y: number }[] } {
  const pixeles: { x: number; y: number }[] = [];
  let x = 0;
  for (const ch of texto) {
    const g = GLIFOS[ch];
    if (!g) {
      x += 2;
      continue;
    }
    g.forEach((fila, y) => [...fila].forEach((c, gx) => c === "#" && pixeles.push({ x: x + gx, y })));
    x += 4;
  }
  return { w: Math.max(0, x - 1), h: 5, pixeles };
}
