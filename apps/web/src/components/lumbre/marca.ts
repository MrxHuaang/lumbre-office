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

// ---------- Letras pixel de la marca ----------
// Mayúsculas de 5x7 (la I de 3), solo las que usan el logotipo y el eslogan. Con ellas se escriben
// el banner del README y la imagen para compartir, que no pueden cargar la fuente Pixelify.
const LETRAS: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
};

/** Un texto en letras pixel (mayúsculas; lo que no tiene letra queda como espacio): 1 de separación. */
export function textoPixeles(texto: string): { w: number; h: number; pixeles: { x: number; y: number }[] } {
  const pixeles: { x: number; y: number }[] = [];
  let x = 0;
  for (const ch of texto.toUpperCase()) {
    const g = LETRAS[ch];
    if (!g) {
      x += 3;
      continue;
    }
    g.forEach((fila, y) => [...fila].forEach((c, gx) => c === "#" && pixeles.push({ x: x + gx, y })));
    x += g[0]!.length + 1;
  }
  return { w: Math.max(0, x - 1), h: 7, pixeles };
}

/** Número pseudoaleatorio fijo (las estrellas del banner quedan siempre en el mismo lugar). */
function azar(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * El banner de Lumbre como SVG pixel (texto): noche cozy con estrellas, el resplandor de la fogata,
 * la llamita, "LUMBRE" con sombra de madera y el eslogan. Lo usan el README (`docs/img`) y la imagen
 * para compartir el enlace. `ancho` y `alto` en píxeles de arte; `escala` los agranda al dibujarlo.
 */
export function bannerSvg({ ancho = 400, alto = 120, escala = 3 }: { ancho?: number; alto?: number; escala?: number } = {}): string {
  // Un <path> por color y opacidad (en el orden en que aparece cada uno): pesa mucho menos que un
  // <rect> por píxel. Lo que se pinta encima nunca comparte color con lo de abajo.
  const trazos = new Map<string, string[]>();
  const rect = (x: number, y: number, w: number, h: number, fill: string, op?: number) => {
    const clave = `${fill}|${op ?? ""}`;
    if (!trazos.has(clave)) trazos.set(clave, []);
    trazos.get(clave)!.push(`M${x} ${y}h${w}v${h}h${-w}z`);
  };
  // Una capa de píxeles a escala `s`, juntando en un solo rect los tramos seguidos del mismo color
  // (así el SVG pesa bastante menos).
  const capa = (pixeles: { x: number; y: number; color?: string }[], ox: number, oy: number, s: number, color?: string) => {
    const orden = [...pixeles].sort((a, b) => a.y - b.y || a.x - b.x);
    for (let i = 0; i < orden.length; ) {
      const p = orden[i]!;
      const c = color ?? p.color ?? "#fff";
      let j = i + 1;
      while (j < orden.length && orden[j]!.y === p.y && orden[j]!.x === p.x + (j - i) && (color ?? orden[j]!.color) === c) j++;
      rect(ox + p.x * s, oy + p.y * s, (j - i) * s, s, c);
      i = j;
    }
  };
  rect(0, 0, ancho, alto, "#2a2033");
  // Estrellas, más en la parte de arriba.
  const rnd = azar(7);
  for (let i = 0; i < Math.round((ancho * alto) / 260); i++) {
    const x = Math.floor(rnd() * ancho);
    const y = Math.floor(rnd() * rnd() * alto * 0.8);
    rect(x, y, 1, 1, rnd() < 0.2 ? "#ffcf4a" : "#fdf0c8", 0.25 + Math.round(rnd() * 5) / 10);
  }
  // Cómo queda todo: la llama a la izquierda del nombre y el eslogan abajo, centrados.
  const llama = llamaPixeles(0);
  const sl = 3;
  const nombre = textoPixeles(MARCA);
  const sn = 5;
  const lema = textoPixeles(ESLOGAN);
  const grupoW = llama.w * sl + 10 + nombre.w * sn;
  const grupoH = llama.h * sl + 12 + lema.h;
  const gx = Math.round((ancho - grupoW) / 2);
  const gy = Math.round((alto - grupoH) / 2);
  const llamaX = gx;
  const base = gy + llama.h * sl; // pie de la llama y del nombre
  // El resplandor: elipses en escalones, del más grande y tenue al más chico.
  const cx = llamaX + (llama.w * sl) / 2;
  const cy = base - 6;
  [
    [120, 0.05],
    [86, 0.07],
    [56, 0.09],
    [32, 0.12],
  ].forEach(([rx, op]) => {
    const ry = rx! * 0.62;
    for (let y = -Math.floor(ry); y <= ry; y += 2) {
      const w = Math.round(rx! * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
      if (w > 0) rect(Math.round(cx - w), Math.round(cy + y), w * 2, 2, "#f08a2c", op);
    }
  });
  // El suelo: una franja más oscura al pie.
  rect(0, alto - 8, ancho, 8, "#221a2a");
  rect(0, alto - 8, ancho, 1, "#3a2d44");
  capa(llama.pixeles, llamaX, gy, sl);
  const nx = llamaX + llama.w * sl + 10;
  const ny = base - nombre.h * sn - sl;
  // Sombra sólida en dos capas (madera y marco), como CozyTitle.
  for (const [dx, color] of [
    [2, "#5b2b0e"],
    [1, "#b3571a"],
  ] as const)
    capa(nombre.pixeles, nx + dx * 2, ny + dx * 2, sn, color);
  capa(nombre.pixeles, nx, ny, sn, "#fdf0c8");
  const lx = Math.round((ancho - lema.w) / 2);
  const ly = base + 12;
  capa(lema.pixeles, lx, ly, 1, "#f5cf85");
  const titulo = `${MARCA} — ${ESLOGAN.toLowerCase()}`;
  const r = [...trazos].map(([clave, d]) => {
    const [fill, op] = clave.split("|");
    return `<path fill="${fill}"${op ? ` opacity="${op}"` : ""} d="${d.join("")}"/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho * escala}" height="${alto * escala}" viewBox="0 0 ${ancho} ${alto}" shape-rendering="crispEdges" role="img" aria-label="${titulo}">` +
    `<title>${titulo}</title>${r.join("")}</svg>`
  );
}
