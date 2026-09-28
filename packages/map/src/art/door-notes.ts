// Notas en la puerta: post-its pegados en la pared al lado de la puerta de una oficina (1 a 3, según
// cuántas notas tenga sin leer el dueño). Se dibujan sobre el plano de una pared a lo largo de x (las
// puertas de las oficinas están en bordes horizontales): cada paso en x baja medio píxel.
import { C, OUT, mix } from "./palette";
import { PixelCanvas, at, type Ramp, type Sprite } from "./pixel";

/** Ancho y alto de un post-it (en unidades de arte, sobre la pared). */
const NOTE = 6;
/** Colores de los post-its, en el orden en que se pegan: amarillo, rosado y verde menta. */
const COLORS: [Ramp, number][] = [
  [C.mustard, 4],
  [C.rose, 4],
  [C.green, 5],
];
/** Dónde va cada uno: corrido a lo largo de la pared (u) y un poco más arriba o abajo (z). */
const SPOTS: [number, number][] = [
  [0, 1],
  [4, 3],
  [8, 0],
];
const MAX_U = 8 + NOTE;
const MAX_Z = 3 + NOTE;

/**
 * Los post-its como sprite: el origen (ox, oy) es el punto de la pared donde se pega el primero (su
 * esquina de abajo, del lado de -x). `count` entre 1 y 3.
 */
export function doorNotesArt(count: number): Sprite {
  const n = Math.max(1, Math.min(3, Math.floor(count)));
  const ox = 2;
  const oy = MAX_Z + 2;
  const c = new PixelCanvas(MAX_U + 5, oy + Math.ceil(MAX_U / 2) + 3);
  const set = (u: number, z: number, col: Parameters<PixelCanvas["set"]>[2]) => c.set(ox + u, oy + Math.floor(u / 2) - z, col);
  for (let i = 0; i < n; i++) {
    const [ramp, base] = COLORS[i]!;
    const [u0, z0] = SPOTS[i]!;
    for (let du = 0; du < NOTE; du++)
      for (let dz = 0; dz < NOTE; dz++) {
        const u = u0 + du;
        const z = z0 + dz;
        // La tira de pegamento arriba (más oscura), la punta de abajo levantada y dos renglones escritos.
        let col = at(ramp, base);
        if (dz === NOTE - 1) col = at(ramp, base - 1);
        else if (dz === 0 && du === NOTE - 1) col = at(ramp, base + 1);
        else if ((dz === 3 || dz === 1) && du >= 1 && du <= (dz === 3 ? 4 : 3) && (du + dz) % 3 !== 0) col = mix(at(ramp, base), at(C.navy, 2), 0.6);
        set(u, z, col);
      }
  }
  c.outline(OUT);
  return { canvas: c, ox, oy };
}
