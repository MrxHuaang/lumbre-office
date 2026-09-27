// Animalitos del jardín: pájaros (copetón, azulejo y mirla), ardillas y luciérnagas. Son chiquitos y
// van pintados a mano con una letra por color, mirando a la derecha (el juego los voltea). Contorno café
// oscuro como el resto del arte.
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, hex, type RGBA } from "./pixel";

export const BIRD_KINDS = ["copeton", "azulejo", "mirla"] as const;
export type BirdKind = (typeof BIRD_KINDS)[number];
export const BIRD_FRAMES = ["stand", "peck", "hop", "fly0", "fly1"] as const;
export type BirdFrame = (typeof BIRD_FRAMES)[number];

export const SQUIRREL_FRAMES = ["sit", "run0", "run1", "climb"] as const;
export type SquirrelFrame = (typeof SQUIRREL_FRAMES)[number];

/** Pinta una plantilla (una letra por color, "." vacío) con 1 px de margen y el contorno café. */
function paint(rows: readonly string[], colors: Record<string, RGBA>): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = new PixelCanvas(w + 2, rows.length + 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && colors[ch] && c.set(x + 1, y + 1, colors[ch]!)));
  c.outline(alpha(OUT, 0.85));
  return c;
}

// Pájaro mirando a la derecha: h cabeza, e ojo, k pico, b lomo, w pecho, t cola, g ala, l patas.
const BIRD: Record<BirdFrame, readonly string[]> = {
  stand: ["........", "....hhh.", "....hek.", "tbbbbhhk", "ttbgbww.", "..bbww..", "...l.l.."],
  peck: ["........", "........", "tbbbb...", "ttbgbhh.", "..bbwhek", "...ww.k.", "...l.l.."],
  hop: ["........", "....hhh.", "....hek.", "tbbbbhhk", "ttbgbww.", "..bbww..", "........"],
  fly0: ["..gg....", "...gg...", "....ghh.", "tbbbghek", "ttbbbwwk", "...ww...", "........"],
  fly1: ["........", "........", "....hhh.", "tbbbbhek", "ttbggwwk", "...gg...", "....g..."],
};

const BIRD_COLORS: Record<BirdKind, Record<string, RGBA>> = {
  // Copetón: el gorrión de Bogotá, café con cabeza gris y collar rojizo.
  copeton: {
    h: at(C.stone, 3),
    e: OUT,
    k: at(C.woodDark, 2),
    b: at(C.wood, 3),
    w: at(C.cream, 3),
    t: at(C.wood, 2),
    g: at(C.wood, 4),
    l: at(C.woodDark, 3),
  },
  // Azulejo: azul grisáceo claro.
  azulejo: {
    h: at(C.blue, 4),
    e: OUT,
    k: at(C.metal, 1),
    b: at(C.blue, 3),
    w: at(C.sky, 3),
    t: at(C.blue, 2),
    g: at(C.fabric, 3),
    l: at(C.metal, 2),
  },
  // Mirla: casi negra, con el pico y las patas amarillas.
  mirla: {
    h: at(C.navy, 1),
    e: at(C.gold, 4),
    k: at(C.mustard, 3),
    b: at(C.navy, 1),
    w: at(C.navy, 2),
    t: at(C.navy, 0),
    g: at(C.navy, 2),
    l: at(C.mustard, 2),
  },
};

export function drawBird(kind: BirdKind, frame: BirdFrame): PixelCanvas {
  return paint(BIRD[frame], BIRD_COLORS[kind]);
}

// Ardilla mirando a la derecha: t cola, b cuerpo, h cabeza, o ojo, n nariz, w panza, e oreja, f patas.
const SQUIRREL: Record<SquirrelFrame, readonly string[]> = {
  sit: [".tt...e...", "tttt.hhh..", "tt..hhoh..", "tt.bbhhhn.", ".ttbbbw...", "..tbbbw...", "...bbww...", "...ff.f..."],
  run0: ["..........", "tt......e.", "ttt....hhh", ".ttbbbbhoh", "..tbbbbbhn", "...bwwbb..", "..f....f..", ".........."],
  run1: ["..........", ".tt.....e.", "tttt..hhh.", "tt.bbbhoh.", "..bbbbbhn.", "..bbww....", "...ff.f...", ".........."],
  // Trepando: de espaldas, pegada al tronco con la cola colgando.
  climb: ["...ee...", "..hhhh..", "..hhhh..", ".fbbbbf.", "..bbbb..", ".fbbbbf.", "...tt...", "..ttt...", "..tt...."],
};

const SQUIRREL_COLORS: Record<string, RGBA> = {
  t: at(C.terracotta, 3),
  b: at(C.terracotta, 2),
  h: at(C.terracotta, 3),
  o: OUT,
  n: at(C.rose, 2),
  w: at(C.cream, 4),
  e: at(C.terracotta, 1),
  f: at(C.wood, 1),
};

export function drawSquirrel(frame: SquirrelFrame): PixelCanvas {
  return paint(SQUIRREL[frame], SQUIRREL_COLORS);
}

/** Luciérnaga: un punto verde amarillento con su halo en cruz (se suma con ADD de noche). */
export function drawFirefly(): PixelCanvas {
  const c = new PixelCanvas(5, 5);
  const core = hex("#f4ff9a");
  const halo = hex("#b8e86a");
  c.set(2, 2, core);
  for (const [x, y] of [
    [1, 2],
    [3, 2],
    [2, 1],
    [2, 3],
  ] as const)
    c.set(x, y, alpha(halo, 0.6));
  for (const [x, y] of [
    [0, 2],
    [4, 2],
    [2, 0],
    [2, 4],
  ] as const)
    c.set(x, y, alpha(halo, 0.2));
  return c;
}
