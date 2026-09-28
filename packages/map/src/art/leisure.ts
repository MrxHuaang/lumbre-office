// Fase 5: el huerto del jardín (parcelas, espantapájaros, barril de agua) y el arcade del sótano
// (máquinas de arcade, de peluches y hockey de mesa). Lo que crece en las parcelas lo dibuja el
// cliente encima, según el estado del huerto.
import { C, OUT } from "./palette";
import { alpha, at, bayer, flat, noise, renderSprite, solidBox, type Box, type Shader, type Sprite } from "./pixel";
import { airHockeyTable } from "./hockey";
import { leg, roundShadow, shadowUnder, volume } from "./kit";

/** Tablas de madera clara (costados de la parcela y del barril). */
const planks: Shader = (u, v, _fw, fh) => {
  if (v >= fh - 1) return at(C.wood, 4);
  return at(C.wood, Math.floor(u) % 5 === 0 ? 1 : 2);
};

/** Parcela: cantero bajo de tablas con tierra arada en surcos. */
function gardenPlot(): Sprite {
  const soil: Shader = (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 1.5) return at(C.wood, e < 0.8 ? 2 : 4);
    if (Math.floor(v) % 4 === 1) return at(C.dirt, 0);
    return at(C.dirt, noise(Math.floor(u), Math.floor(v), 23) < 0.15 ? 3 : bayer(Math.floor(u), Math.floor(v)) < 0.3 ? 1 : 2);
  };
  return renderSprite([{ x: 0.5, y: 0.5, z: 0, w: 15, d: 15, h: 3, top: soil, left: planks, right: planks }], {
    outline: OUT,
    under: shadowUnder(0.5, 0.5, 15, 15, 0.2),
  });
}

/** Espantapájaros: palo en cruz, camisa a cuadros, cabeza de costal y sombrero de paja. */
function scarecrow(): Sprite {
  const plaid: Shader = (u, v) => (Math.floor(u) % 3 === 0 || Math.floor(v) % 3 === 0 ? at(C.rug, 1) : at(C.rug, 3));
  const face: Shader = (u, v) => {
    if (Math.floor(v) === 2 && (Math.floor(u) === 1 || Math.floor(u) === 3)) return OUT;
    if (Math.floor(v) === 0 && u >= 1 && u < 3) return at(C.woodDark, 2);
    return at(C.cork, 3);
  };
  return renderSprite(
    [
      solidBox({ x: 7, y: 7, z: 0, w: 2, d: 2, h: 22 }, C.woodDark, 3),
      { x: 7, y: 1, z: 17, w: 2, d: 14, h: 2, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
      { x: 5.5, y: 4.5, z: 10, w: 5, d: 7, h: 9, top: flat(at(C.rug, 4)), left: plaid, right: plaid },
      { x: 6, y: 6, z: 20, w: 4, d: 4, h: 5, top: flat(at(C.cork, 4)), left: flat(at(C.cork, 2)), right: face },
      solidBox({ x: 4, y: 4, z: 25, w: 8, d: 8, h: 1 }, C.mustard, 3),
      solidBox({ x: 6, y: 6, z: 26, w: 4, d: 4, h: 2.5 }, C.mustard, 3),
      volume(0, 0, 0, 16, 16, 30),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 4),
      // Paja que asoma por las mangas.
      extra: (c, p) => {
        for (const y of [1, 15]) {
          const s = p(8, y, 18);
          c.set(s.x, s.y + 1, at(C.mustard, 4));
          c.set(s.x + (y < 8 ? -1 : 1), s.y + 2, at(C.mustard, 3));
        }
      },
    },
  );
}

/** Barril de agua para regar, con una regadera verde al lado. */
function waterBarrel(): Sprite {
  const staves: Shader = (u, v, fw, fh) => {
    const fv = Math.floor(v);
    if (fv === 2 || fv === fh - 3) return at(C.metal, 3);
    return planks(u, v, fw, fh);
  };
  const top: Shader = (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 1.2) return at(C.wood, 3);
    return Math.abs(u - v) < 0.8 ? at(C.sky, 4) : at(C.sky, 2);
  };
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 9, d: 9, h: 13, top, left: staves, right: staves },
      solidBox({ x: 11, y: 11, z: 0, w: 3, d: 3, h: 3 }, C.green, 3),
      solidBox({ x: 14, y: 12, z: 2, w: 2, d: 1, h: 1 }, C.green, 2),
    ],
    { outline: OUT, under: shadowUnder(2, 2, 12, 12) },
  );
}

/** Máquina de arcade: mueble violeta con marquesina de neón, pantalla con marcianitos y botones. */
function arcadeCabinet(): Sprite {
  const front: Shader = (u, v, fw, fh) => {
    // Marquesina arriba.
    if (v >= fh - 5) {
      if (v >= fh - 1 || u < 1 || u >= fw - 1) return at(C.metal, 1);
      return Math.floor(u) % 3 === 0 ? at(C.neon, 5) : at(C.neon, 3);
    }
    // Pantalla.
    if (v >= 14 && v < fh - 7 && u >= 1.5 && u < fw - 1.5) {
      const x = Math.floor(u - 1.5);
      const y = Math.floor(fh - 7 - v);
      if ((x + 1) % 3 === 0 && y % 3 === 1 && y < 5) return at(C.green, 5);
      if (y === 7 && x > 3 && x < 6) return at(C.gold, 5);
      return at(C.screen, y % 2 ? 0 : 1);
    }
    if (v >= fh - 7) return at(C.metal, 0);
    // Puerta de las monedas.
    if (v >= 3 && v < 8 && u >= fw / 2 - 2 && u < fw / 2 + 2) return Math.floor(v) === 5 ? at(C.gold, 5) : at(C.metal, 2);
    return at(C.violet, 2);
  };
  const side: Shader = (u, v, _fw, fh) => {
    if (Math.abs(v - fh * 0.55 - u * 0.4) < 1.2) return at(C.cyan, 4);
    return at(C.violet, v >= fh - 1 ? 3 : 1);
  };
  const panel: Shader = (u, v) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    if (y === 3 && x === 1) return at(C.rug, 4);
    if (y === 7 && x === 1) return at(C.cyan, 4);
    if (y === 9 && x === 1) return at(C.gold, 5);
    return at(C.metal, 1);
  };
  return renderSprite(
    [
      { x: 3, y: 2, z: 0, w: 10, d: 12, h: 30, top: flat(at(C.metal, 0)), left: side, right: front },
      { x: 12, y: 2, z: 11, w: 3, d: 12, h: 2, top: panel, left: flat(at(C.metal, 1)), right: flat(at(C.violet, 3)) },
      // Palanca.
      solidBox({ x: 13, y: 5, z: 13, w: 1, d: 1, h: 2 }, C.metal, 3),
      solidBox({ x: 12.5, y: 4.5, z: 15, w: 2, d: 2, h: 1.5 }, C.rug, 4),
    ],
    { outline: OUT, under: shadowUnder(3, 2, 12, 12) },
  );
}

const PLUSH = [C.rose, C.gold, C.cyan, C.leaf, C.cream, C.violet];

/** Máquina de peluches: base roja, vitrina llena de peluches con la garra arriba y marquesina. */
function clawMachine(): Sprite {
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(C.gold, 3);
    if (v < 5 + Math.sin(u * 1.3) * 1.2) {
      const k = Math.floor(noise(Math.floor(u / 2.5), Math.floor(v / 2.5), 13) * PLUSH.length);
      return at(PLUSH[k]!, (Math.floor(u) + Math.floor(v)) % 3 === 0 ? 5 : 4);
    }
    return Math.abs(u - v * 0.7 - 1) < 0.8 ? alpha(at(C.white, 4), 0.8) : alpha(at(C.sky, 4), 0.3);
  };
  const base: Shader = (u, v, _fw, fh) => (v >= fh - 1.5 ? at(C.gold, 4) : at(C.rug, Math.floor(u) % 4 === 0 ? 2 : 3));
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 12, d: 12, h: 11, top: flat(at(C.rug, 3)), left: base, right: base },
      { x: 2.5, y: 2.5, z: 11, w: 11, d: 11, h: 14, top: flat(alpha(at(C.sky, 5), 0.4)), left: glass, right: glass },
      { x: 2, y: 2, z: 25, w: 12, d: 12, h: 3, top: flat(at(C.rug, 4)), left: flat(at(C.neon, 4)), right: flat(at(C.neon, 3)) },
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 12, 12),
      // La garra colgando de su cable.
      extra: (c, p) => {
        const a = p(8, 8, 25);
        const b = p(8, 8, 18);
        c.line(a.x, a.y, b.x, b.y, at(C.metal, 4));
        c.set(b.x - 1, b.y + 1, at(C.metal, 4));
        c.set(b.x + 1, b.y + 1, at(C.metal, 4));
        c.set(b.x - 1, b.y + 2, at(C.metal, 3));
        c.set(b.x + 1, b.y + 2, at(C.metal, 3));
      },
    },
  );
}

/** Dibujos de la fase 5, para registrar en DRAW de furniture.ts. */
export const LEISURE_DRAW: Record<string, () => Sprite> = {
  "garden-plot": gardenPlot,
  scarecrow,
  "water-barrel": waterBarrel,
  "arcade-cabinet": arcadeCabinet,
  "claw-machine": clawMachine,
  // El hockey de mesa se juega (modo mesa): su dibujo está con el resto de su arte.
  "air-hockey": airHockeyTable,
};
