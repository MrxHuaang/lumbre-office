// Insignias de los logros (packages/shared/src/achievements.ts): una medalla redonda con el color de la
// rareza y un dibujito en el centro. Los dibujitos son mapas de caracteres (una letra = un color) con
// contorno automático; bloqueado se ve en silueta gris y un secreto, con un signo de pregunta.
import type { AchievementRarity, BadgeIcon } from "@hyvento/shared";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, type Ramp, type RGBA } from "./pixel";

export const BADGE_SIZE = 24;

/** Colores de los dibujitos (una letra por color). */
const INK: Record<string, RGBA> = {
  w: C.wood[2]!,
  W: C.wood[4]!,
  n: C.woodDark[2]!,
  c: C.cream[4]!,
  C: C.cream[2]!,
  r: C.rug[3]!,
  R: C.curtain[2]!,
  g: C.leaf[3]!,
  G: C.leaf[1]!,
  b: C.blue[2]!,
  B: C.blue[4]!,
  y: C.gold[3]!,
  Y: C.gold[4]!,
  s: C.stone[2]!,
  S: C.stone[4]!,
  d: C.stone[0]!,
  p: C.rose[3]!,
  v: C.violet[3]!,
  V: C.violet[5]!,
  o: C.fire[2]!,
  O: C.fire[3]!,
  k: OUT,
  t: C.terracotta[2]!,
  m: C.metal[2]!,
  M: C.metal[4]!,
  x: C.white[3]!,
  e: C.sky[2]!,
};

const GLYPHS: Record<BadgeIcon | "secret", readonly string[]> = {
  cup: ["..S..S....", ".S..S.....", "..S..S....", "..........", "CccccccC..", "CnnnnnnCCC", "CccccccC.C", "CccccccCCC", ".CccccC...", "..CCCC....", "SSSSSSSSS."],
  bread: ["...WWWW...", ".WWyYYWW..", "WWyYYYyWW.", "WyYYyYYyW.", "WyyYYYyyW.", ".WwyyywW..", "..wwwww..."],
  cigar: [".........S.", "........S..", ".........S.", "nnnnnnrrnnO", "wwwwwwyywwo", "nnnnnnrrnnO"],
  smoke: ["..SSS.....", ".SSSSS.S..", "..SSS.SSS.", "......SS..", ".....S....", "....S.....", "cccccccWo."],
  bottle: ["...gg...", "...gg...", "...GG...", "..gggg..", ".gggggg.", ".gcccgg.", ".gcrcgg.", ".gcccgg.", ".gggggg.", ".GGGGGG."],
  sofa: ["......B.B.", ".......B..", ".RRRRRRRR.", ".RrrrrrrR.", "RRRRRRRRRR", "RrrrrrrrrR", "RRRRRRRRRR", "n........n"],
  fish: ["...bbb.....", "..bBBBb..b.", ".bBBkBBbbb.", "bBBBBBBBbb.", ".bBBBBBbbb.", "..bbbbb..b."],
  boot: ["..nnnn..B", "..nwwn...", "..nwwn.B.", "..nwwn...", "..nwwwnn.", ".nwwwwwwn", "nwwwwwwwn", "nnnnnnnnn"],
  can: [".ssss.", "sSSSSs", "toOoot", "tooOot", "sSSSSs", "toooot", ".ssss."],
  chest: [".wwwwwwww.", "wWWWWWWWWw", "wwwwyywwww", "nnnnyynnnn", "wWWWWWWWWw", "wWWWWWWWWw", "nnnnnnnnnn"],
  crown: ["Y...Y...Y", "yY.yYy.Yy", "yyYyyyYyy", "yyyyyyyyy", "yrryBByry", "yyyyyyyyy"],
  chip: ["..rrrr..", ".rxrrxr.", "rrrxxrrr", "rxxrrxxr", "rxxrrxxr", "rrrxxrrr", ".rxrrxr.", "..rrrr.."],
  wheel: ["..yyyyyy..", ".yrkrkrky.", "ykrkrkrkry", "yrkrYYkrky", "ykrkYYrkry", "yrkrkrkrky", ".ykrkrkry.", "..yyyyyy.."],
  cards: ["xxxxxx....", "xrxxxx....", "xxrrxxxxxx", "xxrrxxkxxx", "xxxxxkkkxx", "xxxxxxkxxx", "xxxxxkkkxx", "....xxxxxx"],
  sunrise: ["....y....", ".y..y..y.", "..yYYYy..", ".yYYYYYy.", "yyYYYYYyy", "eeeeeeeee", "eBeeBeeBe"],
  owl: ["w.......w", "ww.....ww", "wwwwwwwww", "wxxwwwxxw", "wxkwywkxw", "wwwwywwww", ".wWWWWWw.", ".wWwWwWw.", "..wwwww..", "..y...y.."],
  flame: ["....o....", "...oo....", "...ooo.o.", "..oOOo.o.", ".ooOYOoo.", ".oOYYYOo.", "oOYYYYYOo", "oOYYxYYOo", ".oOYYYOo.", "..ooooo.."],
  map: ["CCccCCcc", "CccCccCc", "CcrcCcgc", "CccrCcgc", "CcCcrrgc", "CcgCcCrc", "CggcCcCr", "CCccCCcc"],
  clock: ["..ssss..", ".sxxxxs.", "sxxkxxxs", "sxxkxxxs", "sxxkkkxs", "sxxxxxxs", ".sxxxxs.", "..ssss.."],
  shoe: ["....rrr...", "...rRRRr..", "..rRRRRRrr", "rrRRRRRRRr", "rRRRRRRRRr", "cccccccccc"],
  piano: ["nnnnnnnnnn", "nxkxkxxkxn", "nxkxkxxkxn", "nxxxxxxxxn", "nxxxxxxxxn", "nnnnnnnnnn", ".n......n."],
  cat: ["O.....O...", "OO...OO...", "OOOOOOO...", "OgOOOgO...", "OOOpOOO..O", ".OOOOO...O", "OOOOOOOOOO", "OOOOOOOOO."],
  record: ["..dddd..", ".dsddsd.", "dsdrrdsd", "ddrYYrdd", "ddrYYrdd", "dsdrrdsd", ".dsddsd.", "..dddd.."],
  coin: ["..yyyy..", ".yYYYYy.", "yYYyyYYy", "yYyYYYYy", "yYYyyYYy", "yYYYYyYy", "yYYyyYYy", ".yYYYYy.", "..yyyy.."],
  brush: [".......nn", "......nn.", ".....nn..", "....nn...", "...ss....", "..rrs....", ".rrr.....", "rrr......", "rr......."],
  note: ["...vvvvv", "...vVVVv", "...v...v", "...v...v", ".vvv.vvv", "vvvvvvvv", ".vv..vv."],
  camera: [".sss......", "ssssssssss", "smmmMMmmms", "smmMkkMmms", "smmMkBMmms", "smmmMMmmms", "ssssssssss"],
  glass: ["xxxxxx..", "xYYYYx..", "xyyyyxxx", "xyyyyx.x", "xyyyyx.x", "xyyyyxxx", "xyyyyx..", "xxxxxx.."],
  chair: ["..bbbb..", "..bBBb..", "..bBBb..", "..bbbb..", "bbbbbbbb", "...ss...", "...ss...", ".ssssss.", "s..s..s."],
  scroll: ["nWWWWWWn", ".cccccc.", ".cCCCCc.", ".cccccc.", ".cCCCcc.", ".cccccc.", "nWWWWWWn"],
  paw: ["..w...w...", ".www.www..", ".www.www..", "..w...w...", "w...ww...w", "ww.wwww.ww", "...wwwww..", "..wwwwww..", "..wwwwww..", "...wwww..."],
  sprout: ["..g....g..", ".ggg..ggg.", "ggGg..gGgg", ".ggGggGgg.", "...gGGg...", "....GG....", "....GG....", "tttttttttt", "tnntnntnnt"],
  pan: ["...cc.....", "..c.c.....", "...cc.....", "ssssssss..", "sOOYYOOsnn", "sOYxxYOsnn", ".ssssss..."],
  pawn: ["...kk...", "..kxxk..", "..kxxk..", "...kk...", "..kxxk..", "..kxxk..", ".kxxxxk.", "kxxxxxxk", "kkkkkkkk"],
  joystick: ["....rr....", "...rRRr...", "....rr....", "....ss....", "....ss....", ".vvvvvvvv.", "vVVVVVVVVv", "vVyVVVrVVv", "vvvvvvvvvv"],
  tomato: ["....g.....", "..gggg....", ".rrggrr...", "rrRrrrrr..", "rRrrrrrrr.", "rrrrrrrrr.", "rrrrrrrrr.", ".rrrrrrr..", "..rrrrr..."],
  phone: ["rrrrrrrrrr", "rRRRRRRRRr", "rr......rr", "..rrrrrr..", ".rrxxxxrr.", ".rrxkkxrr.", ".rrxxxxrr.", ".rrrrrrrr."],
  trophy: ["yyyyyyyyy", "yYYYYYYYy", "yYyYYYYYy", ".yYYYYYy.", "..yYYYy..", "...yYy...", "....y....", "..nnnnn..", "..nWWWn..", ".nnnnnnn."],
  guitar: [".......nn", "......nn.", ".....nn..", "....nn...", ".oOon....", "oOOOo....", "OOkOO....", "oOOOo....", ".ooo....."],
  bulb: ["..yyyy..", ".yYYYYy.", "yYYxYYYy", "yYYYYYYy", ".yYYYYy.", "..yYYy..", "..ssss..", "..SSSS..", "...ss..."],
  star: ["....y....", "....y....", "...yYy...", "yyyYYYyyy", ".yYYYYYy.", "..yYYYy..", "..yYyYy..", ".yY...Yy.", ".y.....y."],
  // La tina con vapor: tres volutas sobre el agua y las duelas con sus aros.
  tub: [".x..x..x..", "x..x..x...", ".x..x..x..", "..........", "WeeeeeeeeW", "WWWWWWWWWW", "wwwwwwwwww", "yyyyyyyyyy", "wwwwwwwwww", ".wwwwwwww."],
  // Observatorio: el telescopio de latón en su trípode y el malvavisco en el palito.
  telescope: ["......yy.", ".....yYy.", "....yYy..", "...yYy...", "..yYy....", ".nyy.....", ".n.n.....", "n...n....", "n...n...."],
  marshmallow: [".cccc....", "cCccCc...", "cccccc...", "cCcccC...", ".cccc....", "....ww...", ".....ww..", "......ww.", ".......ww"],
  // El antifaz del Carnaval: mitad blanco, mitad negro, con ribete dorado y la pluma.
  mask: [".......rr", "......rr.", "yyyyyyyy.", "yxxxyddy.", "yxkxydky.", "yxxxyddy.", ".yxxydy..", "..yyyy..."],
  pumpkin: ["....nn...", "...ng....", ".yYyYyYy.", "yYyYyYyYy", "yYkYyYkYy", "yYyYyYyYy", "yYkkkkkYy", ".yYyYyYy."],
  // Feria de las flores: la silleta, el marco de madera cuajado de flores con su copete.
  silleta: [".g.r.y.v.", "nnnnnnnnn", "nrryyvvbn", "nrryyvvbn", "nopprrygn", "nopprrygn", "nnnnnnnnn", ".n.....n.", ".n.....n."],
  // Festival de cometas: la cometa de rombo con su cruz de guadua y la cola de trapitos.
  cometa: ["....r....", "...ryr...", "..rryrr..", ".nnnnnnn.", "..bbybb..", "...byb...", "....n....", ".....r...", "....y....", ".....b..."],
  secret: [".xxxx.", "xx..xx", "....xx", "...xx.", "..xx..", "..xx..", "......", "..xx.."],
};

const RING: Record<AchievementRarity, Ramp> = { comun: C.wood, raro: C.blue, epico: C.violet, legendario: C.gold };

export const hasBadgeArt = (icon: string): boolean => icon in GLYPHS;

/** El dibujito solo, con su contorno (en silueta: un solo tono). */
function glyph(icon: BadgeIcon | "secret", silhouette: RGBA | null): PixelCanvas {
  const rows = GLYPHS[icon];
  const w = Math.max(...rows.map((r) => r.length));
  const g = new PixelCanvas(w + 2, rows.length + 2);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = INK[ch];
      if (c) g.set(x + 1, y + 1, silhouette ?? c);
    }),
  );
  g.outline(silhouette ? C.stone[0]! : OUT);
  return g;
}

/**
 * La medalla de un logro. `locked`: gris, con el dibujo en silueta; `secret` además (bloqueado) cambia el
 * dibujo por un signo de pregunta.
 */
export function drawBadge(icon: BadgeIcon, rarity: AchievementRarity, opts: { locked?: boolean; secret?: boolean } = {}): PixelCanvas {
  const locked = Boolean(opts.locked);
  const S = BADGE_SIZE;
  const c = new PixelCanvas(S, S);
  const ring = locked ? C.stone : RING[rarity];
  const mid = S / 2;
  // Aro: sombra abajo a la derecha, luz arriba a la izquierda (se ve como una moneda gruesa).
  c.ellipse(mid + 0.5, mid + 0.5, 11, 11, ring[1]!);
  c.ellipse(mid, mid, 11, 11, ring[2]!);
  c.ellipse(mid - 0.5, mid - 0.5, 9.5, 9.5, ring[locked ? 3 : 4]!);
  c.ellipse(mid, mid, 9.5, 9.5, ring[3]!);
  // Centro: papel crema (gris oscuro si está bloqueado).
  c.ellipse(mid, mid, 8.2, 8.2, locked ? C.stone[1]! : C.cream[4]!);
  c.ellipse(mid + 0.6, mid + 0.6, 7.6, 7.6, locked ? C.stone[1]! : C.cream[3]!);
  c.ellipse(mid, mid, 7.4, 7.4, locked ? C.stone[1]! : C.cream[4]!);
  const g = glyph(locked && opts.secret ? "secret" : icon, locked ? C.stone[2]! : null);
  const ox = Math.round(mid - g.width / 2);
  const oy = Math.round(mid - g.height / 2);
  for (let y = 0; y < g.height; y++)
    for (let x = 0; x < g.width; x++) {
      const i = (y * g.width + x) * 4;
      if (g.data[i + 3]) c.set(ox + x, oy + y, [g.data[i]!, g.data[i + 1]!, g.data[i + 2]!, g.data[i + 3]!]);
    }
  c.outline(OUT);
  if (!locked && rarity === "legendario") {
    // Dos destellos: el legendario brilla.
    for (const [x, y] of [
      [3, 3],
      [20, 19],
    ] as const) {
      c.set(x, y, C.gold[5]!);
      c.set(x - 1, y, alpha(C.gold[5]!, 0.6));
      c.set(x + 1, y, alpha(C.gold[5]!, 0.6));
      c.set(x, y - 1, alpha(C.gold[5]!, 0.6));
      c.set(x, y + 1, alpha(C.gold[5]!, 0.6));
    }
  }
  return c;
}

/** Solo el dibujito de un ícono, sin la medalla (para los datos del perfil). */
export function drawBadgeGlyph(icon: BadgeIcon): PixelCanvas {
  return glyph(icon, null);
}

/** Estrellita dorada de 5x5 (el destello sobre el avatar al desbloquear un logro). */
export function sparkleSprite(): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  const gold = C.gold[5]!;
  c.set(3, 1, gold);
  c.set(3, 5, gold);
  c.set(1, 3, gold);
  c.set(5, 3, gold);
  c.rect(2, 2, 3, 3, C.gold[4]!);
  c.set(3, 3, C.white[4]!);
  c.outline(OUT);
  return c;
}
