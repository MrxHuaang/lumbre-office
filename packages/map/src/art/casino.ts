// Muebles del casino del sótano: mesa de ruleta, mesa de blackjack, caja y tragamonedas (decorativas).
// Paleta común: paño verde, madera oscura con borde acolchado y bronce.
import { C, OUT } from "./palette";
import { alpha, at, flat, noise, renderSprite, type Box, type RGBA, type Shader, type Sprite } from "./pixel";
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

function rouletteTable(): Sprite {
  // Arriba: la rueda (en el extremo de -y) y el paño con la grilla de números (3 columnas x 12 filas).
  const top = railed((u, v, fw, fh) => {
    const cx = fw / 2;
    const cy = 8;
    const d = Math.hypot(u + 0.5 - cx, v + 0.5 - cy);
    if (d < 7.5) {
      if (d >= 6.6) return at(C.gold, 3);
      if (d >= 4.4) {
        const a = (Math.atan2(v + 0.5 - cy, u + 0.5 - cx) + Math.PI) / (Math.PI * 2);
        const n = WHEEL[Math.floor(a * WHEEL.length) % WHEEL.length]!;
        return n === 0 ? at(FELT, 4) : REDS.has(n) ? at(RED, 3) : at(C.metal, 0);
      }
      if (d >= 3.6) return at(C.gold, 2);
      if (d < 1.2) return at(C.gold, 5);
      return at(C.woodDark, d < 2.4 ? 4 : 3);
    }
    // Grilla de números: el cero arriba y 12 filas de 3.
    const gx0 = 3;
    const gy0 = 18;
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
      leg(27, 3, 9),
      leg(3, 43, 9),
      leg(27, 43, 9),
      { x: 1, y: 1, z: 9, w: 30, d: 46, h: 4, top: flat(at(C.woodDark, 3)), left: woodSide, right: woodSide },
      { x: 1, y: 1, z: 13, w: 30, d: 46, h: 1, top, left: flat(at(RED, 1)), right: flat(at(RED, 1)) },
      // La torreta dorada al centro de la rueda.
      { x: 15, y: 8, z: 14, w: 2, d: 2, h: 3, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
    ],
    { outline: OUT, under: shadowUnder(1, 1, 30, 46) },
  );
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
  const chip = (x: number, y: number, h: number, r: typeof RED): Box => ({
    x,
    y,
    z: 14,
    w: 2,
    d: 2,
    h,
    top: flat(at(r, 4)),
    left: (_u, v) => at(r, Math.floor(v) % 2 ? 2 : 4),
    right: (_u, v) => at(r, Math.floor(v) % 2 ? 1 : 3),
  });
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

/** Dibujos del casino, para registrar en DRAW de furniture.ts. */
export const CASINO_DRAW: Record<string, () => Sprite> = {
  "roulette-table": rouletteTable,
  "blackjack-table": blackjackTable,
  "casino-cashier": casinoCashier,
  "slot-machine": slotMachine,
  "pole-stage": poleStage,
  "dance-pole": dancePole,
};
