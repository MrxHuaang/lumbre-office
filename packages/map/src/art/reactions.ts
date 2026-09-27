// Reacciones del club (fuego, corazón, risa, aplauso, fiesta y bola disco), dibujadas a mano en píxeles
// como los emotes: una figura de hasta 10x10 que recibe el contorno café, en un lienzo de 12x12. Se usan
// en los botones de reaccionar (DOM) y flotando sobre quien reacciona (Phaser).
import { C, OUT } from "./palette";
import { PixelCanvas, type RGBA } from "./pixel";

export const REACTION_SIZE = 12;

const RED = { r: C.rug[3]!, R: C.rug[5]!, d: C.rug[1]! };
const FLAME = { r: C.fire[1]!, o: C.fire[2]!, y: C.fire[3]!, w: C.fire[4]! };
const FACE = { y: C.gold[3]!, Y: C.gold[4]!, d: C.gold[2]!, k: OUT, m: C.rug[2]!, b: C.sky[2]! };
const HAND = { s: C.wood[5]!, S: C.wood[4]!, d: C.wood[3]!, w: C.gold[5]! };
const PARTY = { p: C.neon[3]!, P: C.neon[4]!, g: C.gold[3]!, c: C.cyan[3]!, v: C.violet[4]!, y: C.gold[5]!, r: C.rug[3]! };
const DISCO = { a: C.metal[3]!, c: C.white[3]!, w: C.white[4]!, n: C.cyan[4]!, p: C.neon[4]!, k: C.metal[1]! };

interface ReactionArt {
  colors: Record<string, RGBA>;
  rows: string[];
}

export const REACTION_ART: Record<string, ReactionArt> = {
  fuego: {
    colors: FLAME,
    rows: [
      "....r.....",
      "...rr..r..",
      "...rrr.rr.",
      "..rrorrrr.",
      "..roorrorr",
      ".rrooyoorr",
      ".royyyyyor",
      ".roywwyyor",
      "..royyyor.",
      "...rrrrr..",
    ],
  },
  corazon: {
    colors: RED,
    rows: [
      "..........",
      ".rrr..rrr.",
      "rRRrrrrrrr",
      "rRrrrrrrrr",
      "rrrrrrrrrd",
      ".rrrrrrrd.",
      "..rrrrrd..",
      "...rrrd...",
      "....rd....",
      "..........",
    ],
  },
  risa: {
    colors: FACE,
    rows: [
      "...yyyy...",
      ".yyYYyyyy.",
      "byYkyyykyb",
      "bykykykykb",
      "yyyyyyyyyd",
      "ykkkkkkkkd",
      "ykmmmmmmkd",
      ".ykmmmmkd.",
      "..ykkkkd..",
      "...dddd...",
    ],
  },
  aplauso: {
    colors: HAND,
    rows: [
      "w.s.s.s..w",
      "..s.s.s.s.",
      "..s.s.s.s.",
      "..sssssss.",
      "s.sSsSsss.",
      "ssSsssssd.",
      ".sssssssd.",
      "..sssssd.w",
      "w..sssd...",
      "...sssd...",
    ],
  },
  fiesta: {
    colors: PARTY,
    rows: [
      ".c..y..r..",
      "...v...c.y",
      "..r..gy...",
      "c....yg.v.",
      "....pPg...",
      "...pPpg.r.",
      "..pPpp....",
      ".pPpp.....",
      "pPpp......",
      "ppp.......",
    ],
  },
  baile: {
    colors: DISCO,
    rows: [
      "p...kk...n",
      "...acac...",
      "..cwawca..",
      ".acwcacwa.",
      ".cacacaca.",
      ".acacacwa.",
      ".cacacaca.",
      "..acacac..",
      "n..caca..p",
      "..........",
    ],
  },
};

/** Dibujo de una reacción (12x12) con contorno; las celdas "." quedan transparentes. */
export function drawReaction(id: string): PixelCanvas {
  const art = REACTION_ART[id];
  const c = new PixelCanvas(REACTION_SIZE, REACTION_SIZE);
  if (!art) return c;
  const on = (x: number, y: number) => {
    const ch = art.rows[y]?.[x];
    return ch !== undefined && ch !== "." && Boolean(art.colors[ch]);
  };
  // El contorno: los vecinos vacíos de cada píxel pintado (en cruz), como el resto del arte.
  for (let y = -1; y <= 10; y++)
    for (let x = -1; x <= 10; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) c.set(x + 1, y + 1, OUT);
    }
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const col = art.colors[art.rows[y]![x]!];
      if (col) c.set(x + 1, y + 1, col);
    }
  return c;
}
