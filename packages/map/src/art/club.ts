// Muebles del club del sótano (la sala del pole dance): barra con estante de botellas, cabina de DJ,
// parlantes y mesas de cóctel. Madera oscura, bronce y neón rosado y turquesa.
import { C, OUT } from "./palette";
import { alpha, at, flat, noise, renderSprite, solidBox, type Box, type Ramp, type Shader, type Sprite } from "./pixel";
import { roundShadow, shadowUnder, volume } from "./kit";

/** Frente de la barra: paneles acolchados, pasamanos dorado arriba y una tira de neón abajo. */
const barFront: Shader = (u, v, _fw, fh) => {
  if (v >= fh - 2) return at(C.gold, v >= fh - 1 ? 4 : 2);
  if (v < 2) return at(C.neon, v < 1 ? 3 : 4);
  if (Math.floor(u) % 5 === 0) return at(C.woodDark, 1);
  return at(C.woodDark, Math.floor(v) % 6 === 3 && Math.floor(u) % 5 === 2 ? 3 : 2);
};

/** Mármol negro con vetas. */
const blackMarble: Shader = (u, v) => {
  const vein = Math.abs(Math.sin(u * 0.4 + v * 0.25) + Math.sin(v * 0.15)) < 0.08;
  return vein ? at(C.metal, 3) : at(C.metal, noise(Math.floor(u), Math.floor(v), 17) < 0.1 ? 1 : 0);
};

/** Copa de cóctel: pie, tallo y copa con un trago de color. */
function cocktail(x: number, y: number, z: number, drink: Ramp): Box[] {
  return [
    solidBox({ x: x - 0.5, y: y - 0.5, z, w: 2, d: 2, h: 0.5 }, C.white, 3),
    solidBox({ x, y, z: z + 0.5, w: 1, d: 1, h: 2.5 }, C.white, 3),
    { x: x - 1, y: y - 1, z: z + 3, w: 3, d: 3, h: 2, top: flat(at(drink, 4)), left: flat(alpha(at(drink, 3), 0.85)), right: flat(alpha(at(drink, 2), 0.85)) },
  ];
}

function barCounter(): Sprite {
  return renderSprite(
    [
      { x: 1, y: 0, z: 0, w: 14, d: 16, h: 16, top: flat(at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: barFront },
      { x: 0, y: 0, z: 16, w: 16, d: 16, h: 2, top: blackMarble, left: flat(at(C.gold, 2)), right: flat(at(C.gold, 3)) },
      ...cocktail(9, 6, 18, C.neon),
    ],
    { outline: OUT },
  );
}

/**
 * Tramo de barra con los grifos de cerveza: una torre de bronce del lado del barman con tres grifos de
 * manijas de colores, la bandeja de goteo y un chop recién servido del lado de la clientela.
 */
function barTaps(): Sprite {
  const handle = (y: number, r: Ramp): Box[] => [
    solidBox({ x: 5, y: y + 0.4, z: 22, w: 2, d: 1.2, h: 1.2 }, C.gold, 4),
    solidBox({ x: 6.4, y: y + 0.4, z: 20.5, w: 1, d: 1.2, h: 1.5 }, C.gold, 3),
    { x: 3.6, y, z: 24.5, w: 1.6, d: 2, h: 5, top: flat(at(r, 5)), left: flat(at(r, 3)), right: flat(at(r, 4)) },
  ];
  const mug: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5) return at(C.cream, 5);
    if (u < 0.6 || u >= fw - 0.6) return alpha(at(C.white, 4), 0.9);
    return at(C.mustard, v > fh * 0.5 ? 4 : 3);
  };
  return renderSprite(
    [
      { x: 1, y: 0, z: 0, w: 14, d: 16, h: 16, top: flat(at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: barFront },
      { x: 0, y: 0, z: 16, w: 16, d: 16, h: 2, top: blackMarble, left: flat(at(C.gold, 2)), right: flat(at(C.gold, 3)) },
      // Bandeja de goteo con rejilla.
      { x: 5, y: 2, z: 18, w: 4, d: 12, h: 0.6, top: (_u, v) => (Math.floor(v) % 2 ? at(C.metal, 4) : at(C.metal, 2)), left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      // Torre de los grifos.
      solidBox({ x: 2.5, y: 7, z: 18, w: 2, d: 2, h: 5 }, C.gold, 3),
      solidBox({ x: 2.5, y: 2, z: 22, w: 2.5, d: 12, h: 2.5 }, C.gold, 3),
      ...handle(2.5, C.rug),
      ...handle(7, C.gold),
      ...handle(11.5, C.green),
      // Chop de cerveza con espuma.
      { x: 10, y: 9, z: 18, w: 3, d: 3, h: 5, top: flat(at(C.cream, 5)), left: mug, right: mug },
      solidBox({ x: 13, y: 10, z: 19, w: 1, d: 1, h: 3 }, C.white, 3),
    ],
    { outline: OUT },
  );
}

const BOTTLES: Ramp[] = [C.green, C.gold, C.rug, C.cyan, C.cream, C.violet, C.fire];

/** Estante alto detrás de la barra: mueble abajo, espejo al fondo y tres repisas con botellas. */
function barShelf(): Sprite {
  const mirror: Shader = (u, v) => (Math.abs(u - v * 0.8 - 6) < 1.2 ? at(C.metal, 4) : at(C.metal, 2));
  const doors: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1 || v < 1) return at(C.gold, 3);
    if (Math.floor(u) % 8 === 0) return at(C.woodDark, 1);
    return at(C.woodDark, Math.floor(u) % 8 === 6 && Math.floor(v) === 6 ? 5 : 2);
  };
  const bottles: Box[] = [];
  for (const [z, seed] of [
    [12, 1],
    [21, 2],
    [29, 3],
  ] as const)
    for (let k = 0; k < 8; k++) {
      if (noise(k, seed, 9) < 0.2) continue;
      const r = BOTTLES[Math.floor(noise(k, seed, 4) * BOTTLES.length)]!;
      const y = 2 + k * 3.6;
      const h = 4 + Math.floor(noise(k, seed, 6) * 3);
      bottles.push(
        { x: 5.5, y, z, w: 2, d: 2, h, top: flat(at(r, 4)), left: flat(alpha(at(r, 3), 0.9)), right: flat(alpha(at(r, 2), 0.9)) },
        solidBox({ x: 6, y: y + 0.5, z: z + h, w: 1, d: 1, h: 2 }, r, 2),
      );
    }
  const shelf = (z: number): Box => ({ x: 3, y: 0.5, z, w: 6, d: 31, h: 1, top: flat(at(C.woodDark, 4)), left: flat(at(C.neon, 4)), right: flat(at(C.neon, 3)) });
  return renderSprite(
    [
      { x: 1, y: 0, z: 0, w: 2, d: 32, h: 36, top: flat(at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: mirror },
      { x: 1, y: 0, z: 0, w: 9, d: 32, h: 12, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 2)), right: doors },
      shelf(20),
      shelf(28),
      solidBox({ x: 1, y: 0, z: 36, w: 9, d: 32, h: 2 }, C.woodDark, 3),
      ...bottles,
    ],
    { outline: OUT },
  );
}

/** Cabina de DJ: dos tornamesas y la consola arriba, y un ecualizador de luces al frente. */
function djBooth(): Sprite {
  const eq: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5 || v < 1 || u < 1 || u >= fw - 1) return at(C.metal, 2);
    const k = Math.floor((u - 1) / 3);
    const inBar = (u - 1) % 3 < 2;
    const h = 2 + Math.floor(noise(k, 0, 5) * (fh - 5));
    if (inBar && v >= 2 && v < 2 + h) {
      const t = (v - 2) / (fh - 5);
      return t < 0.45 ? at(C.cyan, 4) : t < 0.8 ? at(C.neon, 4) : at(C.gold, 5);
    }
    return at(C.violet, 0);
  };
  const disc: Shader = (u, v, fw, fh) => {
    const r = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2);
    if (r < 1.2) return at(C.neon, 4);
    if (r < 3.8) return at(C.metal, Math.floor(r * 2) % 2 ? 0 : 1);
    return at(C.metal, 3);
  };
  const knobs: Shader = (u, v) => ((Math.floor(u) % 2 === 1 && Math.floor(v) % 2 === 1) ? [at(C.cyan, 4), at(C.neon, 4), at(C.gold, 5)][Math.floor(v) % 3]! : at(C.metal, 1));
  return renderSprite(
    [
      { x: 2, y: 0, z: 0, w: 12, d: 32, h: 15, top: flat(at(C.metal, 1)), left: flat(at(C.metal, 1)), right: eq },
      { x: 3, y: 2, z: 15, w: 9, d: 10, h: 1.5, top: disc, left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      { x: 3, y: 20, z: 15, w: 9, d: 10, h: 1.5, top: disc, left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      { x: 4, y: 13, z: 15, w: 7, d: 6, h: 2.5, top: knobs, left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      // Audífonos sobre la consola.
      solidBox({ x: 5, y: 26, z: 16.5, w: 3, d: 2, h: 1.5 }, C.neon, 3),
    ],
    { outline: OUT, under: shadowUnder(2, 0, 12, 32) },
  );
}

/** Parlante alto: caja negra con un woofer grande abajo y un tweeter arriba. */
function speaker(): Sprite {
  const front: Shader = (u, v, fw, fh) => {
    const cx = fw / 2;
    const w = Math.hypot(u + 0.5 - cx, v - 8);
    if (w < 4.2) return w < 1.2 ? at(C.metal, 3) : w > 3.4 ? at(C.metal, 2) : at(C.metal, Math.floor(w * 2) % 2 ? 0 : 1);
    const t = Math.hypot(u + 0.5 - cx, v - 19);
    if (t < 2.2) return t < 0.9 ? at(C.cyan, 4) : at(C.metal, 2);
    if (v < 1 || v >= fh - 1) return at(C.metal, 2);
    return at(C.metal, 0);
  };
  return renderSprite(
    [
      { x: 3, y: 3, z: 0, w: 10, d: 10, h: 26, top: flat(at(C.metal, 2)), left: flat(at(C.metal, 1)), right: front },
      solidBox({ x: 2.5, y: 2.5, z: 0, w: 11, d: 11, h: 1 }, C.metal, 1),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 10, 10) },
  );
}

/** Mesa alta de cóctel: base y pie dorados, cubierta redonda de mármol negro con una vela y un trago. */
function cocktailTable(): Sprite {
  const round: Shader = (u, v, fw, fh) => {
    const r = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2);
    if (r > fw / 2) return null;
    if (r > fw / 2 - 1) return at(C.gold, 4);
    return blackMarble(u, v, fw, fh);
  };
  const none: Shader = () => null;
  return renderSprite(
    [
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 1 }, C.gold, 3),
      solidBox({ x: 7, y: 7, z: 1, w: 2, d: 2, h: 16 }, C.gold, 3),
      { x: 2, y: 2, z: 17, w: 12, d: 12, h: 1.5, top: round, left: none, right: none },
      solidBox({ x: 5, y: 7, z: 18.5, w: 1.5, d: 1.5, h: 2 }, C.cream, 4),
      ...cocktail(10, 9, 18.5, C.cyan),
      volume(5, 7, 20.5, 2, 2, 3),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 5),
      extra: (c, p) => {
        const f = p(5.7, 7.7, 21);
        c.set(f.x, f.y, at(C.fire, 4));
        c.set(f.x, f.y - 1, at(C.gold, 5));
      },
    },
  );
}

/** Dibujos del club, para registrar en DRAW de furniture.ts. */
export const CLUB_DRAW: Record<string, () => Sprite> = {
  "bar-counter": barCounter,
  "bar-taps": barTaps,
  "bar-shelf": barShelf,
  "dj-booth": djBooth,
  speaker,
  "cocktail-table": cocktailTable,
};
