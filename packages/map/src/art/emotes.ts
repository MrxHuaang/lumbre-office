// Dibujos de los emotes: van dentro de un globo sobre la cabeza y se animan con 2 a 4 frames. Cada
// frame es una figura de hasta 9x9 que recibe el contorno café; los "efectos" (brillos, gotas, humo,
// confeti) se pintan después, sin contorno. El lienzo mide 11x12: 1 px de margen y uno más abajo para
// los frames que se hunden (`dy: 1`, el saltito del dibujo).
import { C, OUT } from "./palette";
import { PixelCanvas, type RGBA } from "./pixel";

export const EMOTE_W = 11;
export const EMOTE_H = 12;

interface Frame {
  rows: string[];
  /** Se hunde 1 px (saltito). */
  dy?: number;
  /** Efectos sin contorno: [x, y, color] en coordenadas de la figura (pueden caer en el margen). */
  fx?: [number, number, string][];
}

interface EmoteArt {
  colors: Record<string, RGBA>;
  frames: Frame[];
  /** Cuánto dura cada frame. */
  ms: number;
}

// Colores comunes (todos de la paleta).
const SKIN = { s: C.wood[5]!, S: C.wood[4]!, b: C.fabric[3]! };
const FACE = { y: C.gold[3]!, Y: C.gold[4]!, d: C.gold[2]!, k: OUT };
const SPARK = C.gold[5]!;

const face = (rows: string[]) => rows;

const LAUGH = face([
  "..yyyyy..",
  ".yYYyyyd.",
  "yYkyyykyd",
  "ykykykykd",
  "yyyyyyyyd",
  "ykkkkkkkd",
  "ydkrrrkdd",
  ".ydkkkdd.",
  "..ddddd..",
]);

const CRY = (tears: number) =>
  face([
    "..yyyyy..",
    ".yYYyyyd.",
    "yYkkykkyd",
    tears >= 1 ? "yybyyybyd" : "yyyyyyyyd",
    tears >= 2 ? "yybyyybyd" : "yyyyyyyyd",
    tears >= 3 ? "yybkkkbyd" : "yyykkkyyd",
    "yykyyykyd",
    ".yddddyd.",
    "..ddddd..",
  ]);

const ANGRY = [
  "..aaaaa..",
  ".kaaaaak.",
  "aakkakkaA",
  "aakaaakaA",
  "aaaaaaaaA",
  "aaakkkaaA",
  "aakaaakaA",
  ".aAAAAAA.",
  "..AAAAA..",
];

const HEART_BIG = [
  ".rr...rr.",
  "rprr.rrrR",
  "rprrrrrrR",
  "rrrrrrrrR",
  "rrrrrrrRR",
  ".rrrrrRR.",
  "..rrrRR..",
  "...rRR...",
  "....R....",
];
const HEART_SMALL = [
  ".........",
  "..rr.rr..",
  ".rprrrrR.",
  ".rprrrrR.",
  ".rrrrrRR.",
  "..rrrRR..",
  "...rRR...",
  "....R....",
  ".........",
];

const HAND_UP = [
  "...s.s...",
  ".s.s.s.s.",
  ".s.s.s.s.",
  ".sssssss.",
  "ssssssss.",
  "ssssssSS.",
  "..sssSS..",
  "..SSSSS..",
  "...bbb...",
];
const HAND_TILT = [
  "....s.s..",
  "..s.s.s.s",
  ".s.s.s.s.",
  ".sssssss.",
  "ssssssss.",
  "ssssssSS.",
  "..sssSS..",
  "..SSSSS..",
  "...bbb...",
];

const BULB = (c: string, C2: string) => [
  `..${c}${c}${c}${c}${c}..`,
  `.${c}${C2}${C2}${c}${c}${c}${c}.`,
  `${c}${C2}${C2}${c}${c}${c}${c}${c}d`,
  `${c}${C2}${c}${c}${c}${c}${c}${c}d`,
  `${c}${c}${c}${c}${c}${c}${c}dd`,
  `.${c}${c}${c}${c}${c}dd.`,
  "..gggGG..",
  "..GgGgG..",
  "...GGG...",
];

/** Gorro de fiesta con rayas y pompón (el confeti va aparte, en los efectos). */
const PARTY_HAT = ["....y....", "...yYy...", "....c....", "...ccC...", "...cCc...", "..ccCcc..", "..cCccC..", ".cccCccc.", "bbbbbbbbb"];

// Bola de disco grande, con espejitos de colores que giran (cada frame corre los colores uno) y la sombra
// a la derecha: chica y gris no se distinguía en el globo.
const DISCO = (step: number) => {
  const facets = ["w", "n", "c"];
  return [
    "....k....",
    "..ABCAB..",
    ".BCABCAd.",
    "ABCABCAdd",
    "BCABCABCd",
    "CABCABCdd",
    ".ABCABdd.",
    "..dddddd.",
    ".........",
  ].map((row) => row.replace(/[ABC]/g, (ch) => facets[("ABC".indexOf(ch) + step) % 3]!));
};

const ART: Record<string, EmoteArt> = {
  wave: {
    colors: SKIN,
    ms: 180,
    frames: [
      { rows: HAND_UP, fx: [[-1, 2, "l"], [-1, 3, "l"]] },
      { rows: HAND_TILT, fx: [[9, 4, "l"], [9, 5, "l"]] },
    ],
  },
  laugh: {
    colors: { ...FACE, r: C.rug[3]! },
    ms: 160,
    frames: [{ rows: LAUGH }, { rows: LAUGH, dy: 1, fx: [[-1, 1, "b"], [9, 1, "b"]] }],
  },
  heart: {
    colors: { r: C.rug[3]!, R: C.rug[2]!, p: C.rose[5]! },
    ms: 260,
    frames: [{ rows: HEART_BIG, fx: [[8, -1, "w"]] }, { rows: HEART_SMALL }],
  },
  // Manos anchas con puño de manga (finas se confundían): separadas y juntas, con el chasquido.
  clap: {
    colors: { ...SKIN, k: OUT },
    ms: 150,
    frames: [
      {
        rows: ["ss.....ss", "sss...sss", "sss...sss", "sss...sss", "SsS...SsS", "SSS...SSS", ".SS...SS.", ".bb...bb.", ".bb...bb."],
      },
      {
        rows: ["...sks...", "..sskss..", "..sskss..", "..sskss..", "..SskSS..", "..SSkSS..", "...SkS...", "..bb.bb..", "..bb.bb.."],
        fx: [[0, 0, "w"], [8, 0, "w"], [0, 3, "w"], [8, 3, "w"], [1, -1, "w"], [7, -1, "w"]],
      },
    ],
  },
  ok: {
    colors: SKIN,
    ms: 280,
    frames: [
      { rows: ["...ss....", "..sss....", "..sss....", "bssssssS.", "bsSSSSSS.", "bssssssS.", "bsSSSSSS.", "bssssssS.", "..SSSSS.."] },
      {
        rows: ["...ss....", "..sss....", "..sss....", "bssssssS.", "bsSSSSSS.", "bssssssS.", "bsSSSSSS.", "bssssssS.", "..SSSSS.."],
        dy: 1,
        fx: [[7, 0, "w"], [8, 1, "w"], [6, -1, "w"]],
      },
    ],
  },
  idea: {
    colors: { m: C.mustard[3]!, M: C.mustard[4]!, y: C.gold[4]!, Y: C.gold[5]!, d: C.mustard[2]!, g: C.stone[3]!, G: C.stone[2]! },
    ms: 240,
    frames: [
      { rows: BULB("m", "M") },
      { rows: BULB("y", "Y"), fx: [[-1, 0, "Y"], [9, 0, "Y"], [-1, 4, "Y"], [9, 4, "Y"], [4, -1, "Y"]] },
    ],
  },
  question: {
    colors: { q: C.violet[4]!, Q: C.violet[3]! },
    ms: 220,
    frames: [
      { rows: ["..qqqq...", ".qqqqqq..", ".qq..qqQ.", ".....qqQ.", "....qqQ..", "...qqQ...", "...qQ....", ".........", "...qQ...."] },
      { rows: ["..qqqq...", ".qqqqqq..", ".qq..qqQ.", ".....qqQ.", "....qqQ..", "...qqQ...", "...qQ....", ".........", "...qQ...."], dy: 1 },
    ],
  },
  party: {
    colors: { c: C.rug[3]!, C: C.mustard[4]!, r: C.rug[3]!, b: C.fabric[3]!, g: C.leaf[3]!, y: C.gold[4]!, n: C.neon[3]! },
    ms: 170,
    frames: [
      {
        rows: PARTY_HAT,
        fx: [[1, 1, "r"], [8, 2, "b"], [7, -1, "g"], [0, 5, "y"], [9, 5, "n"]],
      },
      {
        rows: PARTY_HAT,
        dy: 1,
        fx: [[1, -1, "b"], [7, 1, "r"], [9, 3, "y"], [0, 3, "n"], [8, -1, "g"]],
      },
      {
        rows: PARTY_HAT,
        fx: [[2, 1, "g"], [6, 0, "n"], [9, 1, "b"], [-1, 4, "r"], [0, 0, "y"]],
      },
    ],
  },
  dance: {
    colors: { w: C.white[4]!, d: C.metal[3]!, k: OUT, n: C.neon[3]!, c: C.cyan[4]!, y: C.gold[5]! },
    ms: 200,
    frames: [
      { rows: DISCO(0), fx: [[9, 1, "y"], [-1, 7, "c"], [9, 8, "n"]] },
      { rows: DISCO(1), fx: [[-1, 1, "n"], [9, 6, "y"], [0, 8, "c"]] },
      { rows: DISCO(2), fx: [[8, -1, "c"], [-1, 4, "y"], [9, 8, "n"]] },
    ],
  },
  surprise: {
    colors: { r: C.rug[3]!, R: C.rug[2]!, l: C.rug[3]! },
    ms: 160,
    frames: [
      { rows: ["...rrr...", "...rrr...", "...rrR...", "...rrR...", "....R....", ".........", "...rrR...", "...rRR...", "........."] },
      {
        rows: ["...rrr...", "...rrr...", "...rrR...", "...rrR...", "....R....", ".........", "...rrR...", "...rRR...", "........."],
        dy: 1,
        fx: [[0, 0, "l"], [1, 1, "l"], [8, 0, "l"], [7, 1, "l"], [0, 4, "l"], [8, 4, "l"]],
      },
    ],
  },
  cry: {
    colors: { ...FACE, b: C.sky[2]! },
    ms: 240,
    frames: [{ rows: CRY(1) }, { rows: CRY(2) }, { rows: CRY(3), fx: [[2, 9, "b"], [6, 9, "b"]] }],
  },
  angry: {
    colors: { a: C.rug[4]!, A: C.rug[3]!, k: OUT, w: C.stone[4]! },
    ms: 200,
    frames: [
      { rows: ANGRY, fx: [[-1, 0, "w"], [0, -1, "w"], [9, 0, "w"], [8, -1, "w"]] },
      { rows: ANGRY, dy: 1, fx: [[-1, -1, "w"], [9, -1, "w"]] },
    ],
  },
  sleep: {
    colors: { z: C.blue[3]!, Z: C.blue[4]! },
    ms: 420,
    frames: [
      { rows: [".....zzz.", "......z..", ".....zzz.", ".........", "zzzzz....", "...z.....", "..z......", ".z.......", "zzzzz...."] },
      { rows: ["......ZZZ", ".......Z.", "......ZZZ", ".zzzzz...", "....z....", "...z.....", "..z......", ".zzzzz...", "........."] },
    ],
  },
  music: {
    colors: { n: C.fabric[3]!, N: C.fabric[2]!, m: C.neon[3]! },
    ms: 260,
    frames: [
      { rows: ["....nn...", "....nnN..", "....n.nN.", "....n..N.", "....n....", "..nnn....", ".nnnN....", ".nnN.....", "........."], fx: [[8, 4, "m"], [8, 5, "m"], [7, 5, "m"]] },
      { rows: ["....nn...", "....nnN..", "....n.nN.", "....n..N.", "....n....", "..nnn....", ".nnnN....", ".nnN.....", "........."], dy: 1, fx: [[0, 1, "m"], [0, 2, "m"], [-1, 2, "m"]] },
    ],
  },
  coffee: {
    colors: { m: C.rug[3]!, M: C.rug[2]!, c: C.logs[2]!, w: C.stone[4]! },
    ms: 300,
    frames: [
      { rows: [".........", ".........", ".........", ".cccccc..", ".mmmmmmmm", ".mmmmmm.m", ".mmmmmmmm", ".mmmmmM..", "..MMMM..."], fx: [[2, 1, "w"], [3, 0, "w"], [5, 1, "w"], [4, -1, "w"]] },
      { rows: [".........", ".........", ".........", ".cccccc..", ".mmmmmmmm", ".mmmmmm.m", ".mmmmmmmm", ".mmmmmM..", "..MMMM..."], fx: [[3, 1, "w"], [2, 0, "w"], [5, 0, "w"], [6, -1, "w"]] },
      { rows: [".........", ".........", ".........", ".cccccc..", ".mmmmmmmm", ".mmmmmm.m", ".mmmmmmmm", ".mmmmmM..", "..MMMM..."], fx: [[2, 1, "w"], [4, 1, "w"], [3, -1, "w"], [5, 0, "w"]] },
    ],
  },
  star: {
    colors: { y: C.gold[4]!, Y: C.gold[5]!, d: C.gold[3]!, w: SPARK },
    ms: 220,
    frames: [
      { rows: ["....y....", "...yYy...", "...yYy...", "yyyyYyyyd", ".yyyyyyd.", "..yyyyd..", "..yyddd..", ".yy...dd.", ".y.....d."], fx: [[-1, -1, "w"], [9, 7, "w"]] },
      { rows: ["....y....", "...yYy...", "...yYy...", "yyyyYyyyd", ".yyyyyyd.", "..yyyyd..", "..yyddd..", ".yy...dd.", ".y.....d."], dy: 1, fx: [[9, -1, "w"], [-1, 6, "w"], [8, 0, "w"]] },
    ],
  },
};

// Efectos que se repiten: brillos blancos, gotas y líneas de movimiento.
const FX: Record<string, RGBA> = { w: C.white[4]!, l: C.cream[1]!, b: C.sky[2]!, Y: C.gold[5]! };

export const EMOTE_ART = Object.keys(ART);

/** Cuántos frames tiene un emote y cuánto dura cada uno (1 y 0 si no existe). */
export function emoteFrames(id: string): { count: number; ms: number } {
  const e = ART[id];
  return e ? { count: e.frames.length, ms: e.ms } : { count: 1, ms: 0 };
}

/** Un frame de un emote (11x12). Un id desconocido devuelve un lienzo vacío de 1x1. */
export function drawEmote(id: string, frame = 0): PixelCanvas {
  const e = ART[id];
  if (!e) return new PixelCanvas(1, 1);
  const f = e.frames[((frame % e.frames.length) + e.frames.length) % e.frames.length]!;
  const c = new PixelCanvas(EMOTE_W, EMOTE_H);
  const ox = 1;
  const oy = 1 + (f.dy ?? 0);
  f.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const color = ch === "." ? undefined : e.colors[ch];
      if (color) c.set(ox + x, oy + y, color);
    }),
  );
  c.outline(OUT);
  for (const [x, y, ch] of f.fx ?? []) {
    const color = e.colors[ch] ?? FX[ch];
    if (color) c.set(ox + x, oy + y, color);
  }
  return c;
}
