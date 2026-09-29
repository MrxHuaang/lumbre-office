// Cuadros de la app Pintura (VIR-71): un marco de madera sobre un atril bajo, con el lienzo de 16x16 en la
// cara que mira hacia +x. El mueble del catálogo (`cuadro`) sale con el lienzo en blanco; los píxeles de
// cada cuadro se dibujan con `paintingSprite` (mismas cajas, mismo tamaño y origen) y la escena los pone
// encima como capa, igual que las fotos del tablón.
import { PAINTING, PAINTING_PALETTE, PAINTING_PIXELS } from "@hyvento/shared";
import { C, OUT } from "./palette";
import { at, hex, renderSprite, solidBox, type Box, type RGBA, type Shader, type Sprite } from "./pixel";
import { shadowSpace, shadowUnder, slant } from "./kit";

const PALETTE: readonly RGBA[] = PAINTING_PALETTE.map((h) => hex(h));
const N = PAINTING.size;

/** El lienzo mide lo mismo que el cuadro (16x16 unidades de arte): cada píxel del cuadro es uno del arte. */
const CANVAS = { x: 7, y: 0, z: 8, w: 1, d: N, h: N };

/**
 * Color del lienzo en (u, v) de la cara +x: `u` va de izquierda a derecha en pantalla y `v` de abajo hacia
 * arriba, así que la fila 0 (la de arriba del cuadro) es la de v más alto. `mirror` lo voltea de antemano
 * para cuando la escena espeja el mueble (mirando hacia down/up) y así se lee al derecho.
 */
function canvasShader(pixels: string | null, mirror: boolean): Shader {
  return (u, v) => {
    if (!pixels) return PALETTE[0]!;
    const col = Math.min(N - 1, Math.max(0, Math.floor(u)));
    const row = Math.min(N - 1, Math.max(0, N - 1 - Math.floor(v)));
    const i = parseInt(pixels[row * N + (mirror ? N - 1 - col : col)] ?? "0", 16);
    return PALETTE[i] ?? PALETTE[0]!;
  };
}

function framed(canvas: Shader): Sprite {
  const wood = C.wood;
  const frame = (b: Omit<Box, "top" | "left" | "right">) => solidBox(b, wood, 4);
  const { x, y, z, d, h } = CANVAS;
  return renderSprite(
    [
      // Pata trasera del atril.
      ...slant([3, 8, 0], [7, 8, 20], 1.2, wood, 3),
      // Marco: abajo, a los lados y arriba (sobresale una unidad alrededor del lienzo).
      frame({ x: x - 0.4, y: y - 1, z: z - 1, w: 1.6, d: d + 2, h: 1 }),
      frame({ x: x - 0.4, y: y - 1, z, w: 1.6, d: 1, h }),
      { x, y, z, w: 1, d, h, top: () => at(wood, 3), left: () => at(wood, 3), right: canvas },
      frame({ x: x - 0.4, y: y + d, z, w: 1.6, d: 1, h }),
      frame({ x: x - 0.4, y: y - 1, z: z + h, w: 1.6, d: d + 2, h: 1 }),
      // Repisa donde apoya el marco y las patas delanteras.
      solidBox({ x: x + 1, y: y + 1, z: z - 2, w: 1.5, d: d - 2, h: 1 }, wood, 3),
      ...slant([10, 3, 0], [8.2, 3, z - 1], 1.2, wood, 3),
      ...slant([10, 13, 0], [8.2, 13, z - 1], 1.2, wood, 3),
      shadowSpace(2, 1, 10, 14),
    ],
    { outline: OUT, under: shadowUnder(2, 1, 10, 14, 0.22) },
  );
}

/** El mueble `cuadro` del catálogo: el marco con el lienzo en blanco. */
export const cuadro = (): Sprite => framed(canvasShader(null, false));

/** El cuadro con sus píxeles (mismo tamaño y origen que `cuadro`, para ponerlo encima como capa). */
export function paintingSprite(pixels: string, mirror = false): Sprite {
  return framed(canvasShader(pixels.length === PAINTING_PIXELS ? pixels : null, mirror));
}
