// La marca Lumbre: la llamita pixel (isotipo) dibujada por código. Lo usan el logotipo, el favicon y
// las pantallas de marca. Se define solo el relleno y el contorno se calcula (así cada cuadro queda
// con el mismo borde de 1 píxel, como el resto del arte del juego).

export const MARCA = "Lumbre";
export const ESLOGAN = "La oficina virtual donde tu equipo se siente en casa";
export const DESCRIPCION =
  "Lumbre es una oficina virtual cozy en pixel-art: tu equipo camina por una cabaña, conversa con audio y video por proximidad, tiene oficinas propias y se junta como alrededor del fuego.";

/** Colores de la llamita (tinta café de contorno, como el marco cozy). */
export const LLAMA_COLORES: Record<string, string> = {
  o: "#3a1f16",
  r: "#d93a2b",
  a: "#f08a2c",
  y: "#ffcf4a",
  w: "#fff4c8",
  b: "#b3571a",
  c: "#e0923e",
  d: "#6e3514",
};

// Dos cuadros: en el segundo la punta y la lengüita se mecen un píxel (la llama titila).
const CUADRO_A = [
  "....r.........",
  "....rr........",
  "...rrr....r...",
  "...rarr...rr..",
  "..rraar..rrr..",
  "..raaarr.rar..",
  ".rraayarrrar..",
  ".raayyaaraar..",
  "rraayyyaaaarr.",
  "raayywyyyaaar.",
  "raayywwyyyaar.",
  "raayywwwyyaar.",
  ".raayywwyyar..",
  ".rraayyyyaar..",
  "..rraaaaarr...",
  "dbbbcrrrrcbbbd",
  ".dbbbc..cbbbd.",
];

const CUADRO_B = [
  ".....r........",
  "....rr........",
  "....rrr..r....",
  "...rrarr.rr...",
  "..rraar..rar..",
  "..raaarr.rar..",
  ".rraayarrrar..",
  ".raayyaaraar..",
  "rraayyyaaaarr.",
  "raayywyyyaaar.",
  "raayywwyyyaar.",
  "raayywwwyyaar.",
  ".raayywwyyar..",
  ".rraayyyyaar..",
  "..rraaaaarr...",
  "dbbbcrrrrcbbbd",
  ".dbbbc..cbbbd.",
];

export interface Pixel {
  x: number;
  y: number;
  color: string;
}

/** Los píxeles de un cuadro de la llama, con contorno y un margen de 1 alrededor. */
export function llamaPixeles(cuadro: 0 | 1 = 0): { w: number; h: number; pixeles: Pixel[] } {
  const filas = cuadro === 0 ? CUADRO_A : CUADRO_B;
  const h = filas.length + 2;
  const w = Math.max(...filas.map((f) => f.length)) + 2;
  const lleno = (x: number, y: number) => {
    const ch = filas[y - 1]?.[x - 1];
    return ch !== undefined && ch !== ".";
  };
  const pixeles: Pixel[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (lleno(x, y)) pixeles.push({ x, y, color: LLAMA_COLORES[filas[y - 1]![x - 1]!]! });
      else if (lleno(x - 1, y) || lleno(x + 1, y) || lleno(x, y - 1) || lleno(x, y + 1)) pixeles.push({ x, y, color: LLAMA_COLORES.o! });
    }
  return { w, h, pixeles };
}

/** La llamita como SVG (texto), para el favicon: centrada sobre un cuadro de la noche cozy. */
export function llamaSvg({ fondo = "#2a2033" }: { fondo?: string | null } = {}): string {
  const { w, h, pixeles } = llamaPixeles(0);
  const lado = Math.max(w, h) + 2;
  const ox = Math.floor((lado - w) / 2);
  const oy = Math.floor((lado - h) / 2);
  const rects = pixeles.map((p) => `<rect x="${p.x + ox}" y="${p.y + oy}" width="1" height="1" fill="${p.color}"/>`).join("");
  const bg = fondo ? `<rect width="${lado}" height="${lado}" fill="${fondo}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">${bg}${rects}</svg>`;
}
