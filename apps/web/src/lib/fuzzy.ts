// Búsqueda difusa de la paleta de comandos: las letras de lo que se escribe tienen que aparecer en orden
// (no necesariamente juntas) y puntúa mejor lo que empieza una palabra, lo seguido y lo corto. Sin tildes
// ni mayúsculas: "cafe" encuentra "Cafetería" y "ofi ju" encuentra "Oficina de Juan".

/** Minúsculas y sin tildes (la ñ queda como n: se escribe rápido sin ella). */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Puntaje de `query` en `text` (mayor es mejor) o null si no están todas las letras en orden. Cada
 * palabra de la búsqueda se busca por su lado (en cualquier orden) y se suman.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const hay = fold(text);
  let total = 0;
  for (const w of words) {
    const s = wordScore(w, hay);
    if (s === null) return null;
    total += s;
  }
  // Lo corto gana a lo largo con el mismo puntaje ("Mochila" antes que "Mochila y estadísticas").
  return total - hay.length * 0.01;
}

function wordScore(w: string, hay: string): number | null {
  // Tal cual al principio de una palabra: lo mejor.
  const at = hay.indexOf(w);
  if (at >= 0) return 10 + w.length * 2 + (at === 0 ? 6 : isStart(hay, at) ? 4 : 0);
  // Si no, las letras en orden, premiando las que empiezan palabra y las seguidas. Desde cada lugar donde
  // aparece la primera letra, y sin estirarse de más: "cafe" no puede salir de letras sueltas de tres frases.
  let best: number | null = null;
  for (let start = hay.indexOf(w[0]!); start >= 0; start = hay.indexOf(w[0]!, start + 1)) {
    let score = 1 + (isStart(hay, start) ? 2 : 0);
    let prev = start;
    let ok = true;
    for (const ch of w.slice(1)) {
      const i = hay.indexOf(ch, prev + 1);
      if (i < 0) {
        ok = false;
        break;
      }
      score += 1 + (isStart(hay, i) ? 2 : 0) + (i === prev + 1 ? 1.5 : 0);
      prev = i;
    }
    if (!ok) break;
    if (prev - start + 1 <= Math.max(6, w.length * 3) && (best === null || score > best)) best = score;
  }
  return best;
}

const isStart = (hay: string, i: number) => i === 0 || /[\s\-·:(/]/.test(hay[i - 1]!);

/** Ordena `items` por puntaje (los que no coinciden quedan afuera); con la búsqueda vacía, igual que venían. */
export function fuzzyRank<T>(query: string, items: readonly T[], textOf: (item: T) => string): T[] {
  if (!query.trim()) return [...items];
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const score = fuzzyScore(query, textOf(item));
    if (score !== null) scored.push({ item, score, i });
  });
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.item);
}
