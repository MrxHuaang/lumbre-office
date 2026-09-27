// Lo que se ve más allá del borde del terreno: un bosque visto desde arriba que se repite sin fin, así
// la propiedad parece parte de un mapa mucho mayor y no una isla flotante. El borde del nivel (el
// margen que se dibuja pero no se pisa) debería terminar en árboles tupidos para que empalme.
import { C } from "./palette";
import { PixelCanvas, at, bayer, noise } from "./pixel";

const SIZE = 96;

/** Copas de árbol en una baldosa de 96x96 que empalma consigo misma por los cuatro lados. */
export function drawSurroundings(_kind: "forest"): PixelCanvas {
  const c = new PixelCanvas(SIZE, SIZE);
  // Fondo: sombra del sotobosque.
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) c.set(x, y, at(C.leaf, bayer(x, y) < 0.25 ? 0 : 1));
  // Copas: círculos repartidos con ruido, dibujados también desplazados para que empalmen.
  const crowns: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(noise(i, 1, 71) * SIZE);
    const y = Math.floor(noise(i, 2, 71) * SIZE);
    const r = 7 + Math.floor(noise(i, 3, 71) * 7);
    crowns.push([x, y, r]);
  }
  crowns.sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, r] of crowns)
    for (const dx of [-SIZE, 0, SIZE])
      for (const dy of [-SIZE, 0, SIZE]) {
        const x = cx + dx;
        const y = cy + dy;
        if (x + r < -2 || y + r < -2 || x - r > SIZE + 2 || y - r > SIZE + 2) continue;
        c.ellipse(x + 1, y + 2, r, r * 0.8, at(C.leaf, 0));
        c.ellipse(x, y, r, r * 0.8, at(C.leaf, 2));
        c.ellipse(x - r * 0.25, y - r * 0.25, r * 0.6, r * 0.45, at(C.leaf, 3));
        c.ellipse(x - r * 0.35, y - r * 0.35, r * 0.25, r * 0.2, at(C.leaf, 4));
      }
  // Algún pino oscuro entre las copas.
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(noise(i, 5, 13) * SIZE);
    const y = Math.floor(noise(i, 6, 13) * SIZE);
    for (let k = 0; k < 4; k++) {
      const w = 2 + k * 1.5;
      const yy = y + k * 3;
      for (let xx = Math.floor(x - w); xx <= x + w; xx++) c.set(((xx % SIZE) + SIZE) % SIZE, ((yy % SIZE) + SIZE) % SIZE, at(C.grass, k === 0 ? 3 : 1));
    }
  }
  return c;
}
