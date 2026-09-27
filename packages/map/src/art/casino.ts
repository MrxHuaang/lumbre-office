// Muebles del casino del sótano: mesa de ruleta, mesa de blackjack, caja y tragamonedas (decorativas).
// Paleta común: paño verde, madera oscura con borde acolchado y bronce.
import { C, OUT } from "./palette";
import { alpha, at, bayer, flat, noise, renderSprite, solidBox, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { leg, roundShadow, shadowUnder, volume } from "./kit";

const RED = C.rug;
const FELT = C.green;
/** Números rojos de la ruleta europea (para pintar la rueda y el paño). */
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

/** Borde acolchado de cuero alrededor del paño (lo de siempre en las mesas de casino). */
function railed(inner: Shader, rail = 2): Shader {
  return (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < rail - 1) return at(RED, 1);
    if (e < rail) return at(RED, 2);
    return inner(u - rail, v - rail, fw - rail * 2, fh - rail * 2);
  };
}

/** Paño verde con un leve tramado de fieltro. */
function felt(u: number, v: number): RGBA {
  return at(FELT, noise(Math.floor(u), Math.floor(v), 41) < 0.12 ? 2 : 3);
}

function woodSide(u: number, v: number, _fw: number, fh: number): RGBA {
  if (v >= fh - 1) return at(C.woodDark, 4);
  if (v < 1) return at(C.woodDark, 1);
  return at(C.woodDark, Math.floor(u) % 7 === 0 ? 2 : 3);
}

/**
 * Paño de la ruleta (3x4 tiles; la rueda es un mueble aparte, "roulette-wheel", en la cabecera de -y).
 * Provisorio del rediseño: el dibujo definitivo, con números legibles, lo hace el rediseño del casino.
 */
function rouletteTable(): Sprite {
  const W = 46;
  const D = 62;
  const top = railed((u, v, fw, fh) => {
    // Grilla de números: el cero arriba y 12 filas de 3.
    const gx0 = 3;
    const gy0 = 6;
    const gw = fw - 6;
    const gh = fh - gy0 - 3;
    const gu = u - gx0;
    const gv = v - gy0;
    if (gu >= 0 && gv >= -3 && gu < gw && gv < gh) {
      if (gv < 0) return gv === -3 ? at(C.cream, 5) : at(FELT, 4);
      const col = Math.min(2, Math.floor((gu / gw) * 3));
      const row = Math.min(11, Math.floor((gv / gh) * 12));
      const cu = gu - (col * gw) / 3;
      const cv = gv - (row * gh) / 12;
      if (cu < 0.6 || cv < 0.6) return at(C.cream, 5);
      const n = row * 3 + col + 1;
      return REDS.has(n) ? at(RED, 3) : at(C.metal, 0);
    }
    return felt(u, v);
  });
  return renderSprite(
    [
      leg(3, 3, 9),
      leg(W - 3, 3, 9),
      leg(3, D - 3, 9),
      leg(W - 3, D - 3, 9),
      { x: 1, y: 1, z: 9, w: W, d: D, h: 4, top: flat(at(C.woodDark, 3)), left: woodSide, right: woodSide },
      { x: 1, y: 1, z: 13, w: W, d: D, h: 1, top, left: flat(at(RED, 1)), right: flat(at(RED, 1)) },
    ],
    { outline: OUT, under: shadowUnder(1, 1, W, D) },
  );
}

/** Rueda de la ruleta sobre su pedestal (2x2). Provisoria del rediseño, como el paño. */
function rouletteWheel(): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    const cx = fw / 2;
    const cy = fh / 2;
    const d = Math.hypot(u + 0.5 - cx, v + 0.5 - cy);
    const R = fw / 2;
    if (d > R) return null;
    if (d >= R - 1.5) return at(C.gold, 3);
    if (d >= R * 0.55) {
      const a = (Math.atan2(v + 0.5 - cy, u + 0.5 - cx) + Math.PI) / (Math.PI * 2);
      const n = WHEEL[Math.floor(a * WHEEL.length) % WHEEL.length]!;
      return n === 0 ? at(FELT, 4) : REDS.has(n) ? at(RED, 3) : at(C.metal, 0);
    }
    if (d >= R * 0.45) return at(C.gold, 2);
    if (d < 1.5) return at(C.gold, 5);
    return at(C.woodDark, d < R * 0.25 ? 4 : 3);
  };
  const none: Shader = () => null;
  return renderSprite(
    [
      solidBox({ x: 10, y: 10, z: 0, w: 12, d: 12, h: 12 }, C.woodDark, 3),
      { x: 2, y: 2, z: 12, w: 28, d: 28, h: 3, top, left: none, right: none },
      { x: 15, y: 15, z: 15, w: 2, d: 2, h: 3, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
    ],
    { outline: OUT, under: roundShadow(16, 16, 12) },
  );
}

/** Pila de fichas sobre el paño (z 14 = arriba de las mesas). */
function chipStack(x: number, y: number, h: number, r: Ramp): Box {
  return {
    x,
    y,
    z: 14,
    w: 2,
    d: 2,
    h,
    top: flat(at(r, 4)),
    left: (_u, v) => at(r, Math.floor(v) % 2 ? 2 : 4),
    right: (_u, v) => at(r, Math.floor(v) % 2 ? 1 : 3),
  };
}

function blackjackTable(): Sprite {
  // El crupier va del lado -x (donde está el sabot); las personas del lado +x y en las puntas, cada
  // una con su círculo de apuesta.
  const spots: [number, number][] = [
    [21, 5],
    [22, 13],
    [22, 21],
    [22, 29],
    [21, 37],
  ];
  const top = railed((u, v) => {
    for (const [su, sv] of spots) {
      const d = Math.hypot(u + 0.5 - su, v + 0.5 - sv);
      if (d < 3 && d >= 2) return at(C.gold, 4);
    }
    // Arco del texto ("el blackjack paga 3 a 2") como una línea dorada.
    const arc = Math.hypot(u + 0.5 - 2, v + 0.5 - 21);
    if (arc > 14 && arc < 15) return at(C.gold, 3);
    return felt(u, v);
  });
  const chip = chipStack;
  return renderSprite(
    [
      leg(3, 3, 9),
      leg(27, 3, 9),
      leg(3, 43, 9),
      leg(27, 43, 9),
      { x: 1, y: 1, z: 9, w: 30, d: 46, h: 4, top: flat(at(C.woodDark, 3)), left: woodSide, right: woodSide },
      { x: 1, y: 1, z: 13, w: 30, d: 46, h: 1, top, left: flat(at(RED, 1)), right: flat(at(RED, 1)) },
      // Bandeja de fichas y sabot del lado del crupier.
      chip(4, 16, 3, RED),
      chip(4, 19, 4, C.blue),
      chip(4, 22, 2, C.gold),
      chip(4, 25, 3, C.cream),
      { x: 4, y: 32, z: 14, w: 5, d: 6, h: 4, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 2)), right: (u) => at(u < 2 ? C.cream : C.woodDark, u < 2 ? 5 : 2) },
    ],
    { outline: OUT, under: shadowUnder(1, 1, 30, 46) },
  );
}

function casinoCashier(): Sprite {
  // Mostrador de madera con reja de bronce y una ventanilla; una moneda pintada al frente.
  const coin = (u: number, v: number): RGBA | null => {
    const d = Math.hypot(u - 16, (v - 7) * 1.1);
    if (d < 1.3) return at(C.gold, 5);
    if (d < 2.6) return at(C.gold, 4);
    if (d < 3.2) return at(C.gold, 2);
    return null;
  };
  const front: Shader = (u, v, fw, fh) => coin(u, v) ?? woodSide(u, v, fw, fh);
  const bars: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.2 || v < 1) return at(C.gold, v < 1 ? 2 : 4);
    // Ventanilla abierta al medio.
    if (u > fw / 2 - 4 && u < fw / 2 + 4 && v < fh - 5) return alpha(at(C.woodDark, 0), 0.25);
    return Math.floor(u) % 3 === 0 ? at(C.gold, 3) : alpha(at(C.woodDark, 0), 0.15);
  };
  return renderSprite(
    [
      { x: 1, y: 0.5, z: 0, w: 12, d: 31, h: 14, top: flat(at(C.woodDark, 4)), left: woodSide, right: front },
      { x: 0, y: 0, z: 14, w: 14, d: 32, h: 2, top: flat(at(RED, 3)), left: flat(at(RED, 1)), right: flat(at(RED, 2)) },
      { x: 2, y: 1, z: 16, w: 2, d: 30, h: 14, top: flat(at(C.gold, 4)), left: bars, right: bars },
      // Campanita y una pila de fichas sobre el mostrador.
      { x: 8, y: 6, z: 16, w: 3, d: 3, h: 2, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
      { x: 8, y: 22, z: 16, w: 3, d: 3, h: 3, top: flat(at(RED, 4)), left: (_u, v) => at(RED, Math.floor(v) % 2 ? 2 : 4), right: (_u, v) => at(RED, Math.floor(v) % 2 ? 1 : 3) },
    ],
    { outline: OUT, under: shadowUnder(1, 1, 12, 30) },
  );
}

function slotMachine(): Sprite {
  // Cuerpo rojo con marco dorado, pantalla con tres símbolos (cereza, campana, siete) y la palanca.
  const screen: Shader = (u, v, fw, fh) => {
    if (v < 6 || v >= fh - 3 || u < 1.5 || u >= fw - 1.5) {
      if (v >= fh - 3 && v < fh - 1) return at(C.gold, 4);
      return at(RED, v < 3 ? 2 : 3);
    }
    const sv = v - 6;
    const sh = fh - 9;
    if (sv < 0.8 || sv >= sh - 0.8) return at(C.gold, 3);
    const k = Math.floor(((u - 1.5) / (fw - 3)) * 3);
    const cu = (u - 1.5) - (k * (fw - 3)) / 3;
    if (cu < 0.6) return at(C.gold, 3);
    const mid = Math.abs(sv - sh / 2) < 1.6 && Math.abs(cu - (fw - 3) / 6) < 1.4;
    if (!mid) return at(C.cream, 5);
    return [at(RED, 4), at(C.gold, 5), at(C.blue, 3)][k]!;
  };
  return renderSprite(
    [
      { x: 3, y: 3, z: 0, w: 10, d: 10, h: 4, top: flat(at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 3)) },
      { x: 3, y: 3, z: 4, w: 10, d: 10, h: 18, top: flat(at(C.gold, 4)), left: flat(at(RED, 2)), right: screen },
      { x: 2, y: 2, z: 22, w: 12, d: 12, h: 3, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
      // Palanca al costado con su bolita.
      { x: 8, y: 13, z: 12, w: 1, d: 1, h: 7, top: flat(at(C.metal, 4)), left: flat(at(C.metal, 3)), right: flat(at(C.metal, 2)) },
      { x: 7.5, y: 12.5, z: 19, w: 2, d: 2, h: 2, top: flat(at(RED, 5)), left: flat(at(RED, 3)), right: flat(at(RED, 4)) },
      volume(2, 2, 25, 12, 12, 1),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 10, 10) },
  );
}

/**
 * Tarima redonda del tubo (plana: se dibuja bajo todo, como una alfombra): laca negra con un anillo de
 * neón rosado y luces en el borde.
 */
function poleStage(): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    const d = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2) / (fw / 2);
    if (d > 1) return [0, 0, 0, 0];
    if (d > 0.93) return at(C.woodDark, 0);
    if (d > 0.84) {
      // Bombillos en el borde, uno sí y uno no.
      const a = Math.atan2(v + 0.5 - fh / 2, u + 0.5 - fw / 2);
      return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 28) % 2 ? at(C.gold, 5) : at(C.woodDark, 1);
    }
    if (d > 0.76) return at(C.rose, 5);
    if (d > 0.72) return at(C.rose, 3);
    return at(C.metal, noise(Math.floor(u), Math.floor(v), 7) < 0.08 ? 1 : 0);
  };
  // Sin costados: la tarima es redonda y los lados de la caja dejarían un borde cuadrado.
  const none: Shader = () => [0, 0, 0, 0];
  return renderSprite([{ x: 0.5, y: 0.5, z: 0, w: 47, d: 47, h: 1, top, left: none, right: none }], { outline: OUT });
}

/** El tubo: plateado, con base y tapa, y un brillo de luz a lo largo. */
function dancePole(): Sprite {
  const chrome: Shader = (u, v, fw) => at(C.white, u < fw / 2 ? (Math.floor(v / 6) % 2 ? 3 : 4) : 2);
  return renderSprite(
    [
      { x: 5, y: 5, z: 0, w: 6, d: 6, h: 1, top: flat(at(C.white, 3)), left: flat(at(C.white, 1)), right: flat(at(C.white, 2)) },
      { x: 7, y: 7, z: 1, w: 2, d: 2, h: 52, top: flat(at(C.white, 4)), left: chrome, right: chrome },
      { x: 6, y: 6, z: 53, w: 4, d: 4, h: 1, top: flat(at(C.white, 4)), left: flat(at(C.white, 2)), right: flat(at(C.white, 1)) },
    ],
    { outline: OUT, under: roundShadow(8, 8, 4) },
  );
}

/** Mesa de póker (de adorno): pista dorada ovalada, cinco cartas al centro, cartas tapadas en cada puesto y fichas. */
function pokerTable(): Sprite {
  const cards: [number, number, boolean][] = [
    // Comunitarias boca arriba al centro.
    ...[0, 1, 2, 3, 4].map((k): [number, number, boolean] => [11.5, 11 + k * 4.2, true]),
    // Tapadas frente a los puestos de cada lado.
    [4, 8, false],
    [4, 28, false],
    [19.5, 8, false],
    [19.5, 28, false],
  ];
  const top = railed((u, v, fw, fh) => {
    for (const [cu, cv, up] of cards) {
      if (u >= cu && u < cu + 3 && v >= cv && v < cv + 3.4) {
        if (!up) return at(RED, (Math.floor(u) + Math.floor(v)) % 2 ? 2 : 3);
        return u < cu + 1 && v < cv + 1.2 ? at(RED, 3) : at(C.cream, 5);
      }
    }
    const r = Math.hypot((u + 0.5 - fw / 2) / (fw / 2 - 2), (v + 0.5 - fh / 2) / (fh / 2 - 2));
    if (r > 0.9 && r < 0.98) return at(C.gold, 3);
    return felt(u, v);
  });
  return renderSprite(
    [
      leg(3, 3, 9),
      leg(27, 3, 9),
      leg(3, 43, 9),
      leg(27, 43, 9),
      { x: 1, y: 1, z: 9, w: 30, d: 46, h: 4, top: flat(at(C.woodDark, 3)), left: woodSide, right: woodSide },
      { x: 1, y: 1, z: 13, w: 30, d: 46, h: 1, top, left: flat(at(RED, 1)), right: flat(at(RED, 1)) },
      chipStack(7, 5, 3, C.blue),
      chipStack(7, 40, 4, RED),
      chipStack(22, 20, 2, C.gold),
      chipStack(24, 23, 3, C.cream),
      chipStack(15, 36, 5, C.gold),
    ],
    { outline: OUT, under: shadowUnder(1, 1, 30, 46) },
  );
}

/** Fuente de mármol con agua turquesa, monedas en el fondo y una copa dorada al centro. */
function coinFountain(): Sprite {
  const marble: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.white, 4);
    if (v < 1) return at(C.white, 1);
    if (Math.floor(v) === 3) return at(C.gold, 3);
    return at(C.white, noise(Math.floor(u), Math.floor(v), 5) < 0.12 ? 2 : 3);
  };
  const water =
    (rim: number): Shader =>
    (u, v, fw, fh) => {
      const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
      if (e < rim) return at(C.white, e < rim - 1 ? 3 : 4);
      if (noise(Math.floor(u / 2), Math.floor(v / 2), 71) < 0.07) return at(C.gold, 4);
      const ring = Math.floor(Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2)) % 5 === 0;
      return at(C.cyan, ring ? 4 : bayer(Math.floor(u), Math.floor(v)) < 0.25 ? 2 : 3);
    };
  return renderSprite(
    [
      { x: 1, y: 1, z: 0, w: 30, d: 30, h: 7, top: water(3), left: marble, right: marble },
      solidBox({ x: 13, y: 13, z: 7, w: 6, d: 6, h: 12 }, C.white, 3),
      { x: 10, y: 10, z: 19, w: 12, d: 12, h: 2, top: water(2), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
      // Una moneda gigante parada sobre la copa.
      { x: 15, y: 13, z: 21, w: 2, d: 6, h: 6, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 4)) },
      volume(0, 0, 27, 32, 32, 4),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 30, 30),
      // Chorritos que caen de la copa al estanque.
      extra: (c, p) => {
        for (const [x, y] of [
          [10, 16],
          [22, 16],
          [16, 10],
          [16, 22],
        ] as const) {
          const a = p(x, y, 20);
          const b = p(x + (x - 16) * 0.3, y + (y - 16) * 0.3, 7);
          for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            c.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, alpha(at(C.cyan, 5), 0.85));
          }
        }
      },
    },
  );
}

/** Dos postes dorados con un cordón de terciopelo rojo colgando entre ellos. */
function velvetRope(): Sprite {
  const post = (y: number): Box[] => [
    solidBox({ x: 6, y: y - 1, z: 0, w: 4, d: 4, h: 1 }, C.gold, 3),
    solidBox({ x: 7, y, z: 1, w: 2, d: 2, h: 14 }, C.gold, 3),
    solidBox({ x: 6.5, y: y - 0.5, z: 15, w: 3, d: 3, h: 2 }, C.gold, 4),
  ];
  return renderSprite([...post(2), ...post(12)], {
    outline: OUT,
    under: shadowUnder(6, 1, 4, 14, 0.2),
    extra: (c, p) => {
      const a = p(8, 3, 14);
      const b = p(8, 13, 14);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 4;
        c.set(x, y, at(C.curtain, 3));
        c.set(x, y + 1, at(C.curtain, 1));
      }
    },
  });
}

/** Palmera en maceta dorada: tronco a gajos y hojas largas que caen. */
function palm(): Sprite {
  const trunk: Box[] = [0, 1, 2, 3, 4, 5].map((k) =>
    solidBox({ x: 7 + (k > 3 ? 0.5 : 0), y: 7 - (k > 3 ? 0.5 : 0), z: 10 + k * 4, w: 2.5, d: 2.5, h: 4 }, k % 2 ? C.cork : C.dirt, 3),
  );
  return renderSprite(
    [
      { x: 4, y: 4, z: 0, w: 8, d: 8, h: 9, top: flat(at(C.dirt, 1)), left: (_u, v) => at(C.gold, Math.floor(v) === 6 ? 4 : 2), right: (_u, v) => at(C.gold, Math.floor(v) === 6 ? 3 : 1) },
      solidBox({ x: 3.5, y: 3.5, z: 9, w: 9, d: 9, h: 1.5 }, C.gold, 4),
      ...trunk,
      volume(-10, -10, 20, 36, 36, 26),
    ],
    {
      outline: OUT,
      under: shadowUnder(4, 4, 8, 8),
      extra: (c, p) => {
        const top = p(8.5, 6.5, 34);
        // Hojas: dirección en pantalla (dx, dy) y largo; suben un poco y caen.
        const fronds: [number, number, number][] = [
          [-1, 0.1, 13],
          [1, 0.05, 13],
          [-0.7, -0.6, 10],
          [0.7, -0.7, 10],
          [-0.35, 0.6, 9],
          [0.4, 0.55, 9],
          [0, -1, 7],
        ];
        for (const [dx, dy, len] of fronds) {
          for (let i = 0; i <= len; i++) {
            const t = i / len;
            const x = top.x + dx * len * t;
            const y = top.y + dy * len * 0.5 * t - 5 * t + 9 * t * t;
            c.set(x, y, at(C.leaf, 1));
            // Hojuelas a los dos lados de la nervadura.
            if (i > 1 && i % 2 === 0) {
              c.line(x, y, x - dy * 2.5, y + 2.5 - t, at(C.leaf, 3));
              c.line(x, y, x + dy * 2.5 + dx, y + 3 - t, at(C.leaf, 2));
            }
            c.set(x, y - 1, at(C.leaf, 4));
          }
        }
        c.ellipse(top.x, top.y, 2, 1.5, at(C.leaf, 2));
      },
    },
  );
}

const WHEEL_COLORS: Ramp[] = [RED, C.gold, C.blue, C.green, C.cream, C.violet];

/** Rueda de la fortuna de pie (de adorno): disco de colores con eje dorado y la flecha arriba. */
function fortuneWheel(): Sprite {
  // Cara que mira hacia +x (el lado "right" de la caja): u a lo largo de y, v hacia arriba.
  const face: Shader = (u, v, fw, fh) => {
    const dx = u + 0.5 - fw / 2;
    const dy = v + 0.5 - fh / 2;
    const r = Math.hypot(dx, dy);
    const R = fw / 2;
    if (r > R) return null;
    if (r > R - 1.3) return Math.floor(Math.atan2(dy, dx) * 4) % 2 ? at(C.gold, 5) : at(C.gold, 3);
    if (r < 1.8) return at(C.gold, r < 1 ? 5 : 3);
    const k = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 12) % 12;
    const col = WHEEL_COLORS[k % WHEEL_COLORS.length]!;
    return at(col, r < R - 3 ? 3 : 4);
  };
  return renderSprite(
    [
      solidBox({ x: 4, y: 2, z: 0, w: 8, d: 12, h: 2 }, C.woodDark, 3),
      solidBox({ x: 7, y: 4, z: 2, w: 2, d: 2, h: 14 }, C.woodDark, 3),
      solidBox({ x: 7, y: 10, z: 2, w: 2, d: 2, h: 14 }, C.woodDark, 3),
      { x: 9, y: 0, z: 9, w: 1.5, d: 16, h: 16, right: face },
      // Flecha dorada arriba del disco.
      solidBox({ x: 9, y: 7, z: 25, w: 2, d: 2, h: 3 }, C.gold, 4),
    ],
    { outline: OUT, under: shadowUnder(4, 2, 8, 12) },
  );
}

/** Dibujos del casino, para registrar en DRAW de furniture.ts. */
export const CASINO_DRAW: Record<string, () => Sprite> = {
  "roulette-table": rouletteTable,
  "roulette-wheel": rouletteWheel,
  "blackjack-table": blackjackTable,
  "casino-cashier": casinoCashier,
  "slot-machine": slotMachine,
  "pole-stage": poleStage,
  "dance-pole": dancePole,
  "poker-table": pokerTable,
  "coin-fountain": coinFountain,
  "velvet-rope": velvetRope,
  palm,
  "fortune-wheel": fortuneWheel,
};
