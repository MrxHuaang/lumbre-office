// Las estaciones en el jardín: copos de nieve, hojas y pétalos que caen, y lo que queda en el pasto
// (hojarasca en otoño, florcitas en primavera y manchas de nieve en invierno). Todo chico y sin
// degradados, como el resto del pixel-art: el juego los mueve y los agranda con la cámara.
import { C } from "./palette";
import { PixelCanvas, alpha, at, bayer, hex, noise, smoothNoise, type RGBA } from "./pixel";

/** Colores de las hojas de otoño (naranja, rojo, dorado y café). */
const LEAF_COLORS: readonly [RGBA, RGBA][] = [
  [hex("#e8822a"), hex("#b0521a")],
  [hex("#c8402a"), hex("#8a2a1e")],
  [hex("#e8b83a"), hex("#b0841e")],
  [hex("#a8683a"), hex("#6e4226")],
];
/** Pétalos de primavera (rosado, blanco y lila). */
const PETAL_COLORS: readonly [RGBA, RGBA][] = [
  [hex("#f6b8c8"), hex("#e088a4")],
  [hex("#fff4f0"), hex("#e8d8dc")],
  [hex("#d8b8f0"), hex("#b08ad0")],
];

/** Copo de nieve: `size` 0 un punto, 1 una crucecita (los cercanos), con el centro más blanco. */
export function snowflake(size: 0 | 1): PixelCanvas {
  const white = at(C.white, 4);
  const soft = at(C.blue, 5);
  if (size === 0) {
    const c = new PixelCanvas(1, 1);
    c.set(0, 0, alpha(white, 0.9));
    return c;
  }
  const c = new PixelCanvas(3, 3);
  c.set(1, 1, white);
  for (const [x, y] of [
    [1, 0],
    [0, 1],
    [2, 1],
    [1, 2],
  ] as const)
    c.set(x, y, alpha(soft, 0.75));
  return c;
}

/**
 * Hoja que cae (5x4): una elipse inclinada con la nervadura oscura. `variant` elige el color; `frame` 1
 * es la hoja de canto (más angosta), para que al caer parezca que da vueltas.
 */
export function fallingLeaf(variant: number, frame: 0 | 1 = 0): PixelCanvas {
  const [body, vein] = LEAF_COLORS[Math.abs(variant) % LEAF_COLORS.length]!;
  if (frame === 1) {
    const c = new PixelCanvas(5, 2);
    for (let x = 0; x < 5; x++) c.set(x, x < 2 ? 0 : 1, x === 2 ? vein : body);
    return c;
  }
  const rows = [".bb..", "bvbb.", ".bvbb", "..bb."];
  const c = new PixelCanvas(5, 4);
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && c.set(x, y, ch === "v" ? vein : body)));
  return c;
}

/** Pétalo de primavera (3x2), en dos cuadros como la hoja. */
export function fallingPetal(variant: number, frame: 0 | 1 = 0): PixelCanvas {
  const [body, shade] = PETAL_COLORS[Math.abs(variant) % PETAL_COLORS.length]!;
  const c = new PixelCanvas(3, 2);
  if (frame === 1) {
    c.set(0, 1, body);
    c.set(1, 1, shade);
    c.set(2, 0, body);
    return c;
  }
  c.set(0, 0, body);
  c.set(1, 0, body);
  c.set(1, 1, shade);
  c.set(2, 1, body);
  return c;
}

/** Hojarasca en el pasto (otoño): un puñado de hojitas de colores, aplastado como el piso isométrico. */
export function leafLitter(seed: number): PixelCanvas {
  const c = new PixelCanvas(14, 7);
  const n = 8 + Math.floor(noise(seed, 1, 71) * 6);
  for (let i = 0; i < n; i++) {
    const [body, vein] = LEAF_COLORS[Math.floor(noise(seed, i, 72) * LEAF_COLORS.length)]!;
    const x = 1 + Math.floor(noise(seed, i, 73) * 11);
    const y = 1 + Math.floor(noise(seed, i, 74) * 5);
    c.set(x, y, body);
    c.set(x + 1, y, noise(seed, i, 75) < 0.5 ? vein : body);
    if (noise(seed, i, 76) < 0.6) c.set(x, y - 1, alpha(body, 0.85));
  }
  return c;
}

/** Florcitas en el pasto (primavera): tres a cinco puntitos de color con su hojita verde. */
export function flowerTuft(seed: number): PixelCanvas {
  const c = new PixelCanvas(11, 6);
  const petals = [hex("#fff4f0"), hex("#f6d04a"), hex("#f6a8c0"), hex("#c8a8f0")];
  const green = at(C.grass, 4);
  const n = 3 + Math.floor(noise(seed, 1, 81) * 3);
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(noise(seed, i, 82) * 9);
    const y = 1 + Math.floor(noise(seed, i, 83) * 3);
    const col = petals[Math.floor(noise(seed, i, 84) * petals.length)]!;
    c.set(x, y + 1, green);
    c.set(x, y, col);
    if (noise(seed, i, 85) < 0.5) c.set(x + 1, y, alpha(col, 0.8));
  }
  return c;
}

/**
 * Mancha de nieve en el piso (invierno): un óvalo aplastado blanco azulado, con la orilla tramada y la
 * sombra azul abajo. Aparece de a poco mientras nieva (el juego le sube la opacidad).
 */
export function snowPatch(rx: number, seed: number): PixelCanvas {
  const ry = Math.max(2, Math.round(rx / 2));
  const c = new PixelCanvas(rx * 2 + 2, ry * 2 + 2);
  const snow = at(C.white, 4);
  const shade = at(C.blue, 5);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const nx = (x + 0.5 - rx - 1) / rx;
      const ny = (y + 0.5 - ry - 1) / ry;
      const wobble = 0.78 + smoothNoise(x, y, 3, seed) * 0.35;
      const d = Math.hypot(nx, ny) / wobble;
      if (d > 1) continue;
      if (d > 0.7 && bayer(x, y) > (1 - d) * 4) continue;
      c.set(x, y, alpha(ny > 0.35 && d > 0.5 ? shade : snow, 0.85));
    }
  return c;
}
