// Lo que se ve más allá del borde del terreno: la copa de un bosque tupido que se repite sin fin, así
// la propiedad parece parte de un mapa mucho mayor y no una isla flotante. Las copas se pintan con el
// mismo pincel que los árboles del jardín, y el margen del nivel termina en este mismo dibujo (ver
// `surroundingsAt` y el suelo del bosque en room.ts), así no se nota dónde acaba el nivel.
import { canopy, blend, LEAF, LEAF_DEEP, LEAF_OLIVE } from "./exterior-naturaleza";
import { C } from "./palette";
import { PixelCanvas, at, bayer, noise, type RGBA } from "./pixel";

/** Lado de la baldosa que se repite (px de pantalla). */
export const SURROUND_TILE = 192;
/**
 * Relleno alrededor del nivel en el cliente (SURROUND_PAD de apps/web/src/game/iso/view.ts): la baldosa
 * empieza en la esquina del fondo del nivel menos este relleno. Si no coincide, el dibujo igual empalma
 * (es el mismo bosque), solo se corre la costura.
 */
export const SURROUND_PAD = 3000;

const PINE = blend(C.green, C.navy, 0.18);
// Un poco más oscuro y frío que los árboles del jardín: se lee como bosque lejano, detrás.
const FAR = [blend(LEAF, C.green, 0.3), blend(LEAF_DEEP, C.navy, 0.12), blend(LEAF_OLIVE, C.green, 0.35), blend(LEAF_DEEP, C.green, 0.2)];

let tile: PixelCanvas | null = null;

/** Copas de árbol en una baldosa de 192x192 que empalma consigo misma por los cuatro lados. */
export function drawSurroundings(_kind: "forest"): PixelCanvas {
  if (tile) return tile;
  const S = SURROUND_TILE;
  const c = new PixelCanvas(S, S);
  // Fondo: la sombra del sotobosque entre las copas.
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.set(x, y, at(C.leaf, bayer(x, y) < 0.3 ? 0 : 1));
  // Copas: cada una se pinta en las nueve copias desplazadas, todas ordenadas por altura en pantalla
  // (las de más abajo tapan a las de arriba, también a través de la costura).
  interface Crown {
    x: number;
    y: number;
    r: number;
    kind: number;
    seed: number;
  }
  const crowns: Crown[] = [];
  for (let i = 0; i < 118; i++)
    crowns.push({
      x: noise(i, 1, 71) * S,
      y: noise(i, 2, 71) * S,
      r: 9 + noise(i, 3, 71) * 10,
      kind: Math.floor(noise(i, 4, 71) * 5.6),
      seed: 900 + i,
    });
  const copies: Crown[] = [];
  for (const cr of crowns) for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) copies.push({ ...cr, x: cr.x + dx, y: cr.y + dy });
  copies.sort((a, b) => a.y - b.y);
  for (const cr of copies) {
    if (cr.x + cr.r * 1.6 < 0 || cr.y + cr.r * 1.6 < 0 || cr.x - cr.r * 1.6 > S || cr.y - cr.r * 1.6 > S) continue;
    // Pinos: copas más chicas, oscuras y frías, de montoncitos finos.
    if (cr.kind >= 4) {
      canopy(c, { cx: cr.x, cy: cr.y, rx: cr.r * 0.7, ry: cr.r * 0.62, ramp: PINE, seed: cr.seed, size: [2, 3.2], base: 2.2 });
      continue;
    }
    canopy(c, { cx: cr.x, cy: cr.y, rx: cr.r, ry: cr.r * 0.82, ramp: FAR[cr.kind]!, seed: cr.seed, size: [3, 5.5], base: 2.1 });
  }
  tile = c;
  return c;
}

/** Color de la baldosa en un punto de su espacio (se repite en los dos ejes). */
export function surroundingsAt(sx: number, sy: number): RGBA {
  const t = drawSurroundings("forest");
  const S = SURROUND_TILE;
  const x = ((Math.floor(sx) % S) + S) % S;
  const y = ((Math.floor(sy) % S) + S) % S;
  const i = (y * S + x) * 4;
  return [t.data[i]!, t.data[i + 1]!, t.data[i + 2]!, 255];
}
