// El clima de afuera: gotas, salpicaduras, charcos, sombras de nubes y bancos de niebla. Todo chico y
// tramado (sin degradados suaves) para que combine con el resto del pixel-art. Las piezas grandes (nubes y
// niebla) van a media resolución: el juego las agranda, y siguen viéndose pixeladas.
import { C } from "./palette";
import { PixelCanvas, alpha, at, bayer, smoothNoise } from "./pixel";

/** Viento de la lluvia: cuántos px se corre a la izquierda por cada px que cae. */
export const RAIN_SLANT = 0.35;

/**
 * Gota cayendo: un trazo diagonal de `len` px (inclinado como el viento), más claro abajo. `heavy`
 * = de tormenta (más larga y opaca).
 */
export function raindrop(len = 6, heavy = false): PixelCanvas {
  const w = Math.ceil(len * RAIN_SLANT) + 1;
  const c = new PixelCanvas(w, len);
  const tip = at(C.sky, 4);
  const body = at(C.blue, 4);
  for (let i = 0; i < len; i++) {
    const x = Math.round((len - 1 - i) * RAIN_SLANT);
    const t = i / (len - 1);
    c.set(x, i, alpha(t > 0.7 ? tip : body, (heavy ? 0.5 : 0.35) + t * 0.45));
  }
  return c;
}

/** Salpicadura de una gota al tocar el piso, en 3 cuadros (0 el golpe, 2 el anillo que se abre). */
export function rainSplash(frame: 0 | 1 | 2): PixelCanvas {
  const c = new PixelCanvas(9, 5);
  const col = alpha(at(C.sky, 4), [0.85, 0.7, 0.45][frame]!);
  const dim = alpha(at(C.blue, 4), [0.6, 0.5, 0.3][frame]!);
  if (frame === 0) {
    c.set(4, 3, col);
    c.set(3, 2, col);
    c.set(5, 2, col);
    c.set(4, 4, dim);
  } else if (frame === 1) {
    c.set(2, 1, col);
    c.set(6, 1, col);
    c.set(3, 3, dim);
    c.set(4, 4, dim);
    c.set(5, 3, dim);
    c.set(1, 3, dim);
    c.set(7, 3, dim);
  } else {
    c.set(1, 0, col);
    c.set(7, 0, col);
    for (const [x, y] of [
      [0, 3],
      [1, 4],
      [7, 4],
      [8, 3],
    ] as const)
      c.set(x, y, dim);
  }
  return c;
}

/**
 * Charco en el piso: un óvalo aplastado (vista isométrica) de agua gris azulada con el borde tramado y
 * un brillo del cielo arriba a la izquierda. `seed` cambia la forma.
 */
export function puddle(rx: number, seed: number): PixelCanvas {
  const ry = Math.max(2, Math.round(rx / 2));
  const c = new PixelCanvas(rx * 2 + 2, ry * 2 + 2);
  const water = at(C.blue, 2);
  const deep = at(C.blue, 1);
  const shine = at(C.sky, 3);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const nx = (x + 0.5 - rx - 1) / rx;
      const ny = (y + 0.5 - ry - 1) / ry;
      // Borde irregular: el ruido corre el radio un poco.
      const wobble = 0.82 + smoothNoise(x, y, 3, seed) * 0.3;
      const d = Math.hypot(nx, ny) / wobble;
      if (d > 1) continue;
      if (d > 0.8 && bayer(x, y) > (1 - d) * 5) continue; // orilla tramada
      const col = nx + ny < -0.7 && d > 0.35 && d < 0.75 ? shine : d > 0.7 ? deep : water;
      c.set(x, y, alpha(col, col === shine ? 0.65 : 0.5));
    }
  return c;
}

/**
 * Sombra de una nube que pasa (media resolución): una mancha orgánica, más densa al centro y con la orilla
 * tramada. Se dibuja con MULTIPLY, así oscurece el pasto sin taparlo.
 */
export function cloudShadow(w: number, h: number, seed: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const col = at(C.night, 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w - 0.5;
      const ny = (y + 0.5) / h - 0.5;
      const fall = 1 - Math.hypot(nx * 2, ny * 2);
      const v = fall * 0.9 + (smoothNoise(x, y, 9, seed) - 0.5) * 0.9;
      if (v <= 0.05) continue;
      if (v < 0.3 && bayer(x, y) > v / 0.3) continue;
      c.set(x, y, alpha(col, 0.55));
    }
  return c;
}

/**
 * Banco de niebla (media resolución): jirones blanquecinos en bandas de transparencia (tramadas), más
 * gruesos al centro. Se mueve despacio sobre el jardín.
 */
export function fogBank(w: number, h: number, seed: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const col = at(C.cream, 5);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5) / w - 0.5;
      const ny = (y + 0.5) / h - 0.5;
      const fall = 1 - Math.hypot(nx * 2, ny * 2.2);
      if (fall <= 0) continue;
      const wisps = smoothNoise(x, y * 2.5, 14, seed) * 0.7 + smoothNoise(x, y, 5, seed + 1) * 0.3;
      const v = fall * wisps * 1.6;
      // Tres bandas de transparencia, con tramado entre una y otra.
      const band = Math.floor(v * 3 + bayer(x, y) * 0.9);
      if (band <= 0) continue;
      c.set(x, y, alpha(col, Math.min(band, 3) * 0.16));
    }
  return c;
}
