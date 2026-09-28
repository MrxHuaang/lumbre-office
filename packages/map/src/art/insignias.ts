// La insignia destacada junto al nombre del personaje: una medallita de 9x9 con el aro del color de la
// rareza y un dibujito de 5x5 por ícono (una letra = un color). Es la versión chica de badges.ts: a ese
// tamaño el dibujo grande no se lee, así que cada ícono tiene el suyo.
import type { AchievementRarity, BadgeIcon } from "@hyvento/shared";
import { C, OUT } from "./palette";
import { PixelCanvas, type Ramp, type RGBA } from "./pixel";

export const MINI_BADGE_SIZE = 9;

const INK: Record<string, RGBA> = {
  W: C.wood[2]!,
  n: C.woodDark[1]!,
  c: C.cream[1]!,
  r: C.rug[3]!,
  g: C.leaf[3]!,
  b: C.blue[2]!,
  y: C.gold[3]!,
  Y: C.gold[1]!,
  s: C.stone[2]!,
  k: OUT,
  v: C.violet[3]!,
  O: C.fire[2]!,
  o: C.fire[3]!,
  p: C.rose[3]!,
  x: C.white[3]!,
  m: C.metal[3]!,
  e: C.sky[1]!,
  t: C.terracotta[2]!,
};

/** Un dibujito de 5x5 por ícono (el tipo exige que estén todos). */
const MINI: Record<BadgeIcon, readonly string[]> = {
  cup: [".s.s.", "rrrr.", "rrrrr", "rrrr.", ".rr.."],
  bread: [".WWW.", "WyyyW", "WyYyW", "WWWWW", "....."],
  cigar: ["....s", "...s.", "nnnyo", "nnnyo", "....."],
  smoke: [".sss.", "ss.ss", ".sss.", "..s..", ".s..."],
  bottle: ["..g..", "..g..", ".ggg.", ".gxg.", ".ggg."],
  sofa: [".....", ".rrr.", "rrrrr", "rrrrr", "n...n"],
  fish: [".bb.b", "bkbbb", "bbbbb", ".bb.b", "....."],
  boot: ["..WW.", "..WW.", "..WW.", "WWWW.", "nnnnn"],
  can: [".sss.", ".tot.", ".tot.", ".tot.", ".sss."],
  chest: [".WWW.", "WWyWW", "nnynn", "WWWWW", "nnnnn"],
  crown: ["y.y.y", "yyyyy", "yryby", "yyyyy", "....."],
  chip: [".rrr.", "rxrxr", "rrxrr", "rxrxr", ".rrr."],
  wheel: [".yyy.", "yrkry", "ykYky", "yrkry", ".yyy."],
  cards: ["xxx..", "xrx..", "xxxxx", "..xkx", "..xxx"],
  sunrise: [".....", "..y..", ".yyy.", "yyyyy", "eeeee"],
  owl: ["W...W", "WWWWW", "WkWkW", "WWyWW", ".WWW."],
  flame: ["..o..", ".oo..", ".oOo.", "oOyOo", ".ooo."],
  map: ["ccccc", "cgcrc", "ccrcc", "crcgc", "ccccc"],
  clock: [".sss.", "sxkxs", "sxkks", "sxxxs", ".sss."],
  shoe: [".....", "..rr.", ".rrrr", "rrrrr", "ccccc"],
  piano: ["nnnnn", "xkxkx", "xkxkx", "xxxxx", "nnnnn"],
  cat: ["O...O", "OOOOO", "OkOkO", "OOpOO", ".OOO."],
  record: [".kkk.", "kkrkk", "kryrk", "kkrkk", ".kkk."],
  coin: [".yyy.", "yYYYy", "yYyYy", "yYYYy", ".yyy."],
  brush: ["....n", "...n.", "..s..", ".rr..", "rr..."],
  note: ["..vvv", "..v.v", "..v.v", "vv.vv", "vv.vv"],
  camera: [".ss..", "sssss", "smkms", "sssss", "....."],
  glass: ["xxxx.", "yyyyx", "yyyyx", "yyyy.", "....."],
  chair: [".bbb.", ".bbb.", "bbbbb", "..s..", ".s.s."],
  scroll: ["nWWWn", ".ccc.", ".ccc.", ".ccc.", "nWWWn"],
  paw: ["W.W.W", ".....", ".WWW.", "WWWWW", ".WWW."],
  sprout: ["g...g", "gg.gg", ".ggg.", "..g..", "ttttt"],
  pan: [".....", "sssss", "syYys", ".sssn", "....n"],
  pawn: ["..k..", ".kxk.", "..k..", ".kxk.", "kkkkk"],
  joystick: ["..r..", "..s..", "..s..", "vvvvv", "vyvrv"],
  tomato: ["..g..", ".rgr.", "rrrrr", "rrrrr", ".rrr."],
  phone: ["rrrrr", "r...r", ".rrr.", "rrxrr", "rrrrr"],
  trophy: ["yyyyy", ".yYy.", "..y..", ".nnn.", "nnnnn"],
  guitar: ["....n", "...n.", ".on..", "oOo..", ".o..."],
  bulb: [".yyy.", "yyxyy", ".yyy.", ".sss.", "..s.."],
  star: ["..y..", "yyyyy", ".yyy.", ".y.y.", "y...y"],
};

const RING: Record<AchievementRarity, Ramp> = { comun: C.wood, raro: C.blue, epico: C.violet, legendario: C.gold };

/** Contorno (k), aro (R) y centro (.) de la medallita. */
const DISC = ["..kkkkk..", ".kRRRRRk.", "kRR...RRk", "kR.....Rk", "kR.....Rk", "kR.....Rk", "kRR...RRk", ".kRRRRRk.", "..kkkkk.."];

export const hasMiniBadge = (icon: string): boolean => Object.hasOwn(MINI, icon);

/** La insignia chica de un ícono y una rareza (la que se ve junto al nombre). */
export function drawMiniBadge(icon: BadgeIcon, rarity: AchievementRarity): PixelCanvas {
  const c = new PixelCanvas(MINI_BADGE_SIZE, MINI_BADGE_SIZE);
  const ring = RING[rarity];
  DISC.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "k") c.set(x, y, OUT);
      // El aro con luz arriba a la izquierda y sombra abajo a la derecha, como una moneda.
      else if (ch === "R") c.set(x, y, x + y < 8 ? ring[4]! : x + y > 8 ? ring[2]! : ring[3]!);
      else c.set(x, y, C.cream[4]!);
    }),
  );
  (MINI[icon] ?? []).forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = INK[ch];
      if (col) c.set(x + 2, y + 2, col);
    }),
  );
  return c;
}
