// Arte de las mesas de rondas compartidas del casino: el baccarat, los dados y la carrera de caballitos
// (caoba, cuero burdeos, paño verde y bronce, como la ruleta y el blackjack; los caballitos corren
// sobre una pista de pasto). Cada mesa tiene su mueble (a la escala del nivel) y lo del
// modo mesa, en alta resolución (R puntos por unidad de arte): el paño con los rótulos, las marcas, los
// dados, el cubilete y los caballitos. La geometría está en mesas-layout.ts. Sin Phaser.
import { HORSES, type MesaId } from "@hyvento/shared";
import { apron, felt, INK, turnedLeg } from "./casino";
import { cardSize, hiResPiece, localToScreen, overlayFor, paintLocalPlane, toCanvas, type MesaFrame, type Overlay, type PieceSprite, type ScreenBox } from "./casino-mesa";
import { GLYPH_H, drawTextCentered, textWidth } from "./digits";
import { shadowUnder, volume } from "./kit";
import {
  BACCARAT_CELLS,
  BACCARAT_DISCARD,
  BACCARAT_HANDS,
  BACCARAT_SHAPE,
  BACCARAT_SHOE,
  BACCARAT_TOP_Z,
  DADOS_CELLS,
  DADOS_DOME,
  DADOS_FELT,
  DADOS_TOP_Z,
  MESA_CELLS,
  MESA_TOP_Z,
  RACE_CELLS,
  RACE_FINISH_U,
  RACE_LANE_W,
  RACE_START_U,
  RACE_TOP_Z,
  RACE_TRACK,
  baccaratInset,
  horseU,
  insideMesaCell,
  laneV,
  mesaCellAt,
  type MesaCell,
} from "./mesas-layout";
import { C, OUT, mix } from "./palette";
import { alpha, at, flat, hex, noise, renderSprite, solidBox, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";

const RED = C.rug;

/** Rampa de un color suelto (la chaqueta de un jinete): de oscuro a claro, como las de la paleta. */
export function rampOf(color: string): Ramp {
  const c = hex(color);
  const black = hex("#140f18");
  const white = hex("#fffaf0");
  return [mix(c, black, 0.62), mix(c, black, 0.42), mix(c, black, 0.2), c, mix(c, white, 0.35), mix(c, white, 0.62)];
}
export const HORSE_RAMPS: readonly Ramp[] = HORSES.map((h) => rampOf(h.color));

/** Color de fondo de una casilla. */
function fillColor(c: MesaCell, u: number, v: number): RGBA {
  switch (c.fill) {
    case "felt":
      return felt(u, v);
    case "red":
      return at(RED, 2);
    case "blue":
      return at(C.blue, 1);
    case "gold":
      return at(C.green, 1);
    case "dark":
      return at(INK, 2);
    default:
      return at(HORSE_RAMPS[c.fill]!, 2);
  }
}

/** Borde oscuro de las letras sobre cada fondo. */
function inkOutline(c: MesaCell): RGBA {
  if (c.fill === "red") return at(RED, 0);
  if (c.fill === "blue") return at(C.blue, 0);
  if (c.fill === "dark") return at(INK, 0);
  if (typeof c.fill === "number") return at(HORSE_RAMPS[c.fill]!, 0);
  return at(C.green, 0);
}

/** Puntos de un dado de `n` en un cuadrado unitario (x, y de 0 a 1). */
export const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.22],
    [0.75, 0.22],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.78],
    [0.75, 0.78],
  ],
};

/** ¿Cae (x, y) de un cuadrado de lado `size` sobre un punto del dado `n`? */
function onPip(n: number, x: number, y: number, size: number, r = 0.11): boolean {
  return (PIPS[n] ?? []).some(([px, py]) => Math.hypot(x / size - px, y / size - py) < r);
}

/** Color de una casilla (con su borde crema y, en los números de los dados, los puntos). */
function cellColor(c: MesaCell, u: number, v: number): RGBA {
  const b = 0.3;
  if (!insideMesaCell(c, u - b, v) || !insideMesaCell(c, u + b, v) || !insideMesaCell(c, u, v - b) || !insideMesaCell(c, u, v + b)) {
    return typeof c.fill === "number" ? at(HORSE_RAMPS[c.fill]!, 4) : at(C.cream, 3);
  }
  if (c.pips) {
    // Un dado blanco al centro de la casilla, con sus puntos.
    const s = Math.min(c.u1 - c.u0, c.v1 - c.v0) * 0.7;
    const du = u - ((c.u0 + c.u1) / 2 - s / 2);
    const dv = v - ((c.v0 + c.v1) / 2 - s / 2);
    if (du >= 0 && du < s && dv >= 0 && dv < s) {
      if (onPip(c.pips, dv, du, s, 0.12)) return c.pips === 1 ? at(RED, 2) : at(INK, 1);
      return at(C.cream, du < 0.4 || dv < 0.4 ? 5 : 4);
    }
  }
  return fillColor(c, u, v);
}

// ---------- Baccarat ----------

/** Bandeja de fichas del crupier (hundida junto al borde de atrás). */
const BACCARAT_TRAY = { u0: 2.2, u1: 5.2, v0: 19, v1: 29 } as const;
const TRAY_CHIPS: Ramp[] = [C.cream, RED, C.blue, C.green, INK];

export function baccaratFeltColor(u: number, v: number): RGBA | null {
  const d = baccaratInset(u, v);
  if (d < 0) return null;
  // Cojín de cuero alrededor, con su costura.
  if (d < 2.4) {
    if (d < 0.5 || d > 2) return at(RED, 1);
    if (Math.abs(d - 1.25) < 0.18 && noise(Math.floor(u * 2), Math.floor(v * 2), 9) < 0.6) return at(RED, 4);
    return at(RED, d > 1.25 ? 2 : 3);
  }
  const t = BACCARAT_TRAY;
  if (u >= t.u0 && u < t.u1 && v >= t.v0 && v < t.v1) {
    if (u < t.u0 + 0.4 || u >= t.u1 - 0.4 || v < t.v0 + 0.4 || v >= t.v1 - 0.4) return at(C.wood, 2);
    const k = (v - t.v0 - 0.4) / 1.85;
    if (k - Math.floor(k) < 0.2) return at(C.wood, 1);
    return at(TRAY_CHIPS[Math.floor(k) % TRAY_CHIPS.length]!, (u - t.u0) % 0.7 < 0.18 ? 1 : 3);
  }
  for (const c of BACCARAT_CELLS) if (insideMesaCell(c, u, v)) return cellColor(c, u, v);
  // Recuadros donde se ponen las cartas de cada mano (filete dorado).
  for (const h of Object.values(BACCARAT_HANDS)) {
    const du = Math.abs(u - h.u);
    const dv = Math.abs(v - h.v);
    if (du < 3.6 && dv < 7 && (du > 3.2 || dv > 6.6)) return at(C.gold, 3);
  }
  // Filete dorado que separa el lado del crupier.
  if (u >= 12.4 && u < 12.8 && v > 4 && v < 44) return at(C.gold, 3);
  return felt(u, v);
}

/** Mesa de baccarat (2x3), con el lado recto del crupier y las puntas redondas del lado de la gente. */
function baccaratTable(): Sprite {
  const { u0, v0, v1 } = BACCARAT_SHAPE;
  const z = BACCARAT_TOP_Z;
  const slices: Box[] = [];
  for (let v = v0; v < v1; v++) {
    const vv = v;
    let a = 99;
    let b = -1;
    for (let u = 0; u <= 32; u += 0.25) {
      if (baccaratInset(u, v + 0.5) >= 0) {
        a = Math.min(a, u);
        b = Math.max(b, u);
      }
    }
    if (b < a) continue;
    slices.push({ x: a + 1.5, y: v + 0.2, z: 9, w: b - a - 3, d: 0.8, h: 3, left: apron, right: apron });
    slices.push({
      x: a,
      y: v,
      z: z - 2,
      w: b - a + 0.25,
      d: 1,
      h: 2,
      top: (u, dv) => baccaratFeltColor(u + a, dv + vv) ?? at(RED, 1),
      left: (_u, h, _fw, fh) => at(RED, h > fh - 0.8 ? 2 : 1),
      right: (_u, h, _fw, fh) => (h < 0.7 ? at(C.gold, 2) : at(RED, h > fh - 0.8 ? 3 : 1)),
    });
  }
  // Primero los faldones (lo de abajo) y después las tajadas del tablero.
  const aprons = slices.filter((_, i) => i % 2 === 0);
  const tops = slices.filter((_, i) => i % 2 === 1);
  const { u: su, v: sv } = BACCARAT_SHOE;
  return renderSprite(
    [
      ...turnedLeg(4, 6, 9),
      ...turnedLeg(4, 40, 9),
      ...turnedLeg(24, 8, 9),
      ...turnedLeg(24, 38, 9),
      ...aprons,
      ...tops,
      // Sabot y descarte, como en el blackjack.
      { x: su - 2, y: sv - 3, z, w: 4.5, d: 6, h: 3, top: (u, v) => (u > 1 && u < 3.5 && v > 1 && v < 5 ? at(C.cream, 5) : at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: (_u, v) => (v > 2.3 ? at(RED, 3) : at(C.woodDark, 2)) },
      { x: BACCARAT_DISCARD.u - 1.5, y: BACCARAT_DISCARD.v - 2, z, w: 3, d: 4, h: 1.5, top: flat(at(RED, 3)), left: (_u, v) => at(C.cream, Math.floor(v * 2) % 2 ? 3 : 5), right: (_u, v) => at(C.cream, Math.floor(v * 2) % 2 ? 2 : 4) },
    ],
    { outline: OUT, under: shadowUnder(u0, v0, 30, 46) },
  );
}

// ---------- Dados ----------

export function dadosFeltColor(u: number, v: number): RGBA | null {
  const { u0, v0, u1, v1 } = DADOS_FELT;
  if (u < 0 || v < 0 || u >= 32 || v >= 32) return null;
  // Cojín de cuero en el borde (esquinas un poco redondeadas).
  const e = Math.min(u, v, 32 - u, 32 - v);
  if (u < u0 || v < v0 || u >= u1 || v >= v1) return at(RED, e < 0.5 ? 1 : 2);
  const ed = Math.min(u - u0, v - v0, u1 - u, v1 - v);
  if (ed < 0.5) return at(C.gold, 3);
  // Base del cubilete: un aro de bronce en el paño.
  const rd = Math.hypot(u - DADOS_DOME.u, v - DADOS_DOME.v);
  if (rd < DADOS_DOME.r + 0.9) return rd > DADOS_DOME.r ? at(C.gold, rd > DADOS_DOME.r + 0.5 ? 2 : 4) : at(C.green, 1);
  for (const c of DADOS_CELLS) if (insideMesaCell(c, u, v)) return cellColor(c, u, v);
  return felt(u, v);
}

/** Caras de un dado que se ven: la de arriba, la que mira a +y (izquierda) y la que mira a +x. */
export function dieFaces(top: number): [number, number, number] {
  const side = [1, 2, 3, 4, 5, 6].filter((n) => n !== top && n !== 7 - top);
  const left = side[0]!;
  const right = side.find((n) => n !== left && n !== 7 - left)!;
  return [top, left, right];
}

const DIE = 2.4;

/** Cajas de un dado con la cara `top` arriba, apoyado en (x, y, z) (esquina de atrás). */
function dieBoxes(x: number, y: number, z: number, top: number, size = DIE): Box {
  const [t, l, r] = dieFaces(top);
  const face = (n: number, base: number): Shader => (a, b, fw, fh) => {
    if (onPip(n, a, b, Math.min(fw, fh), 0.13)) return n === 1 ? at(RED, 2) : at(INK, 1);
    return at(C.cream, base);
  };
  return { x, y, z, w: size, d: size, h: size, top: face(t, 5), left: face(l, 4), right: face(r, 3) };
}

/** Un dado en alta resolución (su punto de apoyo es el centro de la base). */
export function dieSprite(fr: MesaFrame, R: number, top: number): PieceSprite {
  const sp = hiResPiece(fr, [dieBoxes(-DIE / 2, -DIE / 2, 0, top)], R);
  return { canvas: sp.canvas, ax: sp.ox, ay: sp.oy };
}

/** Dónde quedan los tres dados en el cubilete (local). */
export const DICE_SPOTS: readonly { u: number; v: number }[] = [
  { u: DADOS_DOME.u - 1.6, v: DADOS_DOME.v - 1.1 },
  { u: DADOS_DOME.u + 1.7, v: DADOS_DOME.v - 0.6 },
  { u: DADOS_DOME.u - 0.2, v: DADOS_DOME.v + 1.8 },
];

/**
 * El vidrio del cubilete (va encima de los dados): una cúpula transparente con brillos y la tapa de
 * bronce. `shake` corre la cúpula unos puntos (mientras se sacude).
 */
export function domeOverlay(fr: MesaFrame, R: number, shake = 0): Overlay {
  const { u, v, r, h } = DADOS_DOME;
  const z = DADOS_TOP_Z;
  const c0 = localToScreen(fr, u, v, z);
  const rx = r * Math.SQRT2;
  const ry = r / Math.SQRT2;
  const ov = overlayFor(
    [
      { x: c0.x - rx, y: c0.y - ry - h - 2 },
      { x: c0.x + rx, y: c0.y + ry },
    ],
    R,
    1.5,
  );
  const cv = ov.canvas;
  const p = toCanvas(ov, { x: c0.x + shake, y: c0.y });
  const RX = rx * R;
  const RY = ry * R;
  const H = h * R;
  for (let j = 0; j < cv.height; j++)
    for (let i = 0; i < cv.width; i++) {
      const nx = (i + 0.5 - p.x) / RX;
      if (Math.abs(nx) > 1) continue;
      const k = Math.sqrt(1 - nx * nx);
      const top = p.y - (H + RY) * k;
      const bottom = p.y + RY * k;
      const y = j + 0.5;
      if (y < top || y > bottom) continue;
      // Qué tan cerca del borde de la silueta (el vidrio se ve más en los bordes).
      const edge = Math.min(y - top, (1 - Math.abs(nx)) * RX) / R;
      let col: RGBA = alpha(at(C.cyan, 5), 0.1);
      if (edge < 0.35) col = alpha(at(C.white, 4), 0.55);
      else if (edge < 0.9) col = alpha(at(C.cyan, 5), 0.22);
      // Brillo arriba a la izquierda.
      const hx = (i + 0.5 - (p.x - RX * 0.42)) / (RX * 0.16);
      const hy = (y - (p.y - (H + RY) * 0.62)) / ((H + RY) * 0.2);
      if (hx * hx + hy * hy < 1) col = alpha(at(C.white, 4), 0.6);
      cv.set(i, j, col);
    }
  // La perilla de bronce de arriba.
  const knobY = p.y - (H + RY);
  for (let j = Math.floor(knobY - R * 1.1); j <= Math.ceil(knobY + R * 0.2); j++)
    for (let i = Math.floor(p.x - R * 0.8); i <= Math.ceil(p.x + R * 0.8); i++) {
      const d = Math.hypot((i + 0.5 - p.x) / (R * 0.8), (j + 0.5 - (knobY - R * 0.45)) / (R * 0.6));
      if (d <= 1) cv.set(i, j, at(C.gold, (i + 0.5 - p.x) < -R * 0.2 ? 5 : d > 0.7 ? 2 : 4));
    }
  return ov;
}

function dadosTable(): Sprite {
  const z = DADOS_TOP_Z;
  const { u, v, r, h } = DADOS_DOME;
  return renderSprite(
    [
      ...turnedLeg(3, 3, 9),
      ...turnedLeg(27, 3, 9),
      ...turnedLeg(3, 27, 9),
      ...turnedLeg(27, 27, 9),
      { x: 2, y: 2, z: 9, w: 28, d: 28, h: 3, top: flat(at(C.wood, 2)), left: apron, right: apron },
      { x: 0, y: 0, z: 12, w: 32, d: 32, h: 2, top: (a, b) => dadosFeltColor(a, b) ?? at(RED, 1), left: (_a, hh, _fw, fh) => at(RED, hh > fh - 0.8 ? 2 : 1), right: (_a, hh) => (hh < 0.6 ? at(C.gold, 2) : at(RED, 1)) },
      // Los tres dados quietos en el cubilete (el vidrio se pinta encima).
      dieBoxes(DICE_SPOTS[0]!.u - 1, DICE_SPOTS[0]!.v - 1, z, 5, 2),
      dieBoxes(DICE_SPOTS[1]!.u - 1, DICE_SPOTS[1]!.v - 1, z, 3, 2),
      dieBoxes(DICE_SPOTS[2]!.u - 1, DICE_SPOTS[2]!.v - 1, z, 6, 2),
      volume(u - r, v - r, z, r * 2, r * 2, h + 2),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 30, 30),
      extra: (c, p) => {
        // El vidrio del cubilete: bordes claros y un brillo; la perilla de bronce arriba.
        const base = p(u, v, z);
        const rx = r * 1.42;
        const ry = r * 0.71;
        for (let y = Math.floor(base.y - ry - h); y <= Math.ceil(base.y + ry); y++)
          for (let x = Math.floor(base.x - rx); x <= Math.ceil(base.x + rx); x++) {
            const nx = (x + 0.5 - base.x) / rx;
            if (Math.abs(nx) > 1) continue;
            const k = Math.sqrt(1 - nx * nx);
            const top = base.y - (h + ry) * k;
            if (y + 0.5 < top || y + 0.5 > base.y + ry * k) continue;
            const edge = Math.min(y + 0.5 - top, (1 - Math.abs(nx)) * rx);
            c.set(x, y, edge < 1 ? alpha(at(C.white, 4), 0.6) : alpha(at(C.cyan, 5), 0.16));
          }
        c.set(base.x - 3, base.y - h, alpha(at(C.white, 4), 0.9));
        c.set(base.x - 3, base.y - h + 1, alpha(at(C.white, 4), 0.7));
        const knob = { x: base.x, y: base.y - h - ry - 1 };
        c.set(knob.x - 1, knob.y, at(C.gold, 4));
        c.set(knob.x, knob.y, at(C.gold, 5));
        c.set(knob.x, knob.y + 1, at(C.gold, 3));
      },
    },
  );
}

// ---------- Carrera de caballitos ----------

/** Pista: pasto con los carriles, la largada, la meta a cuadros y la botonera con los seis caballitos. */
export function raceFeltColor(u: number, v: number): RGBA | null {
  if (u < 0 || v < 0 || u >= 48 || v >= 32) return null;
  const { u0, u1, v0, v1 } = RACE_TRACK;
  // Cojín de cuero con filete de bronce, como las otras mesas.
  const e = Math.min(u, v, 48 - u, 32 - v);
  if (e < 1.2) return at(RED, e < 0.5 ? 1 : 2);
  if (e < 1.6) return at(C.gold, 3);
  for (const c of RACE_CELLS) if (insideMesaCell(c, u, v)) return cellColor(c, u, v);
  if (u >= u0 && u < u1 && v >= v0 && v < v1) {
    // La meta, a cuadros.
    if (u >= RACE_FINISH_U && u < RACE_FINISH_U + 1.2) return (Math.floor((u - RACE_FINISH_U) / 0.6) + Math.floor(v / 0.6)) % 2 ? at(C.white, 4) : at(INK, 1);
    // La línea de largada.
    if (u >= RACE_START_U - 2.9 && u < RACE_START_U - 2.5) return at(C.cream, 5);
    const lane = (v - v0) / RACE_LANE_W;
    const f = lane - Math.floor(lane);
    if ((f < 0.06 || f > 0.94) && lane > 0.5 && lane < HORSES.length - 0.5) return at(C.cream, 4);
    // El cajón de largada, de tierra.
    if (u < RACE_START_U - 2.9) return at(C.dirt, noise(Math.floor(u * 2), Math.floor(v * 2), 4) < 0.2 ? 2 : 3);
    // Pasto con franjas de corte.
    return at(C.grass, (Math.floor(u / 3) % 2 ? 3 : 2) + (noise(Math.floor(u), Math.floor(v), 13) < 0.06 ? 1 : 0));
  }
  // Entre la pista y la botonera: madera oscura.
  return at(C.woodDark, 2);
}

/** Cajas de un caballito con su jinete, mirando a +u, con el centro de las patas en (0, 0, 0). `frame` = paso del galope (0 a 3). */
export function horseBoxes(horse: number, frame: number): Box[] {
  const coat = [C.woodDark, C.wood, C.cream, C.woodDark, C.white, C.wood][horse] ?? C.wood;
  const jacket = HORSE_RAMPS[horse]!;
  const s = 0.62;
  const w = 1.5 * s;
  const y0 = -w / 2;
  // Las patas se abren y cierran con el galope (adelante y atrás, alternadas).
  const swing = [0.7, 0.2, -0.5, 0.2][frame % 4]! * s;
  const lift = frame % 2 === 1 ? 0.4 * s : 0;
  const legW = 0.55 * s;
  const legH = 2.6 * s;
  const legs: Box[] = [
    solidBox({ x: 1.8 * s + swing, y: y0, z: lift, w: legW, d: legW, h: legH - lift }, coat, 2),
    solidBox({ x: 1.8 * s - swing, y: y0 + w - legW, z: 0, w: legW, d: legW, h: legH }, coat, 3),
    solidBox({ x: -2.2 * s - swing, y: y0, z: 0, w: legW, d: legW, h: legH }, coat, 2),
    solidBox({ x: -2.2 * s + swing, y: y0 + w - legW, z: lift, w: legW, d: legW, h: legH - lift }, coat, 3),
  ];
  return [
    ...legs,
    // La cola, el cuerpo, el cuello y la cabeza.
    solidBox({ x: -3.2 * s, y: y0 + w * 0.3, z: legH + 0.4 * s, w: 0.8 * s, d: w * 0.4, h: 1.6 * s }, C.woodDark, 2),
    solidBox({ x: -2.6 * s, y: y0, z: legH, w: 5.2 * s, d: w, h: 1.9 * s }, coat, 3),
    solidBox({ x: 2.2 * s, y: y0 + w * 0.1, z: legH + 1.2 * s, w: 1.2 * s, d: w * 0.8, h: 1.8 * s }, coat, 3),
    solidBox({ x: 2.6 * s, y: y0 + w * 0.1, z: legH + 2.6 * s, w: 1.9 * s, d: w * 0.8, h: 0.9 * s }, coat, 4),
    // La crin.
    solidBox({ x: 2 * s, y: y0 + w * 0.3, z: legH + 2.4 * s, w: 0.6 * s, d: w * 0.4, h: 1.2 * s }, C.woodDark, 1),
    // El jinete: chaqueta, cabeza y gorra del mismo color.
    solidBox({ x: -0.8 * s, y: y0 + w * 0.05, z: legH + 1.9 * s, w: 1.6 * s, d: w * 0.9, h: 2 * s }, jacket, 3),
    solidBox({ x: -0.5 * s, y: y0 + w * 0.15, z: legH + 3.9 * s, w: 1.1 * s, d: w * 0.7, h: 1 * s }, C.cream, 4),
    solidBox({ x: -0.6 * s, y: y0 + w * 0.1, z: legH + 4.8 * s, w: 1.4 * s, d: w * 0.8, h: 0.45 * s }, jacket, 4),
  ];
}

/** Un caballito en alta resolución (su punto de apoyo es el centro de las patas). */
export function horseSprite(fr: MesaFrame, R: number, horse: number, frame: number): PieceSprite {
  const sp = hiResPiece(fr, horseBoxes(horse, frame), R);
  return { canvas: sp.canvas, ax: sp.ox, ay: sp.oy };
}

function horseRaceTable(): Sprite {
  const z = RACE_TOP_Z;

  const horses: Box[] = HORSES.flatMap((_, i) => horseBoxes(i, i % 4).map((b) => ({ ...b, x: b.x + RACE_START_U, y: b.y + laneV(i), z: b.z + z })));
  const posts: Box[] = [
    solidBox({ x: RACE_FINISH_U + 0.2, y: 1.2, z, w: 0.8, d: 0.8, h: 7 }, C.cream, 4),
    solidBox({ x: RACE_FINISH_U + 0.2, y: RACE_TRACK.v1 + 0.2, z, w: 0.8, d: 0.8, h: 7 }, C.cream, 4),
    { x: RACE_FINISH_U, y: 1, z: z + 7, w: 1.2, d: 2.5, h: 1.6, top: flat(at(C.white, 4)), left: (a, b) => ((Math.floor(a / 0.6) + Math.floor(b / 0.6)) % 2 ? at(INK, 1) : at(C.white, 4)), right: flat(at(INK, 2)) },
  ];
  return renderSprite(
    [
      ...turnedLeg(3, 3, 7),
      ...turnedLeg(43, 3, 7),
      ...turnedLeg(3, 27, 7),
      ...turnedLeg(43, 27, 7),
      { x: 1.5, y: 1.5, z: 7, w: 45, d: 29, h: 3, top: flat(at(C.wood, 2)), left: apron, right: apron },
      { x: 0, y: 0, z: 10, w: 48, d: 32, h: 2, top: (a, b) => raceFeltColor(a, b) ?? at(RED, 1), left: (_a, hh, _fw, fh) => at(RED, hh > fh - 0.8 ? 2 : 1), right: (_a, hh) => (hh < 0.6 ? at(C.gold, 2) : at(RED, 1)) },
      ...posts.slice(0, 1),
      ...horses,
      ...posts.slice(1),
    ],
    { outline: OUT, under: shadowUnder(0, 0, 46, 30) },
  );
}

// ---------- Modo mesa: paño en alta resolución, marcas y encuadre ----------

const FELT_COLOR: Record<MesaId, (u: number, v: number) => RGBA | null> = {
  baccarat: baccaratFeltColor,
  dados: dadosFeltColor,
  caballos: raceFeltColor,
};

/** Rectángulo local que se pinta en el modo mesa (todo el tablero). */
export const MESA_PLANE: Record<MesaId, { u0: number; v0: number; u1: number; v1: number }> = {
  baccarat: { u0: 1, v0: 1, u1: 31, v1: 47 },
  dados: { u0: 0, v0: 0, u1: 32, v1: 32 },
  caballos: { u0: 0, v0: 0, u1: 48, v1: 32 },
};

/** El tablero completo en alta resolución, con los rótulos de las casillas y de las manos. */
export function mesaFeltOverlay(table: MesaId, fr: MesaFrame, R: number): Overlay {
  const { u0, v0, u1, v1 } = MESA_PLANE[table];
  const z = MESA_TOP_Z[table];
  const ov = paintLocalPlane(fr, z, u0, v0, u1, v1, R, FELT_COLOR[table]);
  for (const cell of MESA_CELLS[table]) {
    if (!cell.label) continue;
    const p = toCanvas(ov, localToScreen(fr, cell.text.u, cell.text.v, z));
    const outline = inkOutline(cell);
    const two = cell.label2 !== undefined;
    const dy = two ? (GLYPH_H + 2) / 2 : 0;
    drawTextCentered(ov.canvas, cell.label, p.x, p.y - dy, at(C.cream, 5), { outline });
    if (two) drawTextCentered(ov.canvas, cell.label2!, p.x, p.y + dy, typeof cell.fill === "number" ? at(C.cream, 5) : at(C.gold, 5), { outline });
  }
  if (table === "baccarat") {
    // Los nombres de las manos, delante de donde van las cartas.
    for (const [name, h] of [
      ["JUGADOR", BACCARAT_HANDS.player],
      ["BANCA", BACCARAT_HANDS.banker],
    ] as const) {
      const p = toCanvas(ov, localToScreen(fr, h.u + 4.6, h.v, z));
      drawTextCentered(ov.canvas, name, p.x, p.y, alpha(at(C.gold, 4), 0.85));
    }
  }
  if (table === "caballos") {
    // El número de cada carril en el cajón de largada.
    HORSES.forEach((_, i) => {
      const p = toCanvas(ov, localToScreen(fr, RACE_TRACK.u0 + 1.2, laneV(i), z));
      drawTextCentered(ov.canvas, String(i + 1), p.x, p.y, at(C.cream, 5), { outline: at(HORSE_RAMPS[i]!, 0) });
    });
  }
  return ov;
}

/** Marca sobre una casilla: `hover` (luz suave donde apuntas) o `win` (lo que salió, dorado). */
export function mesaCellMark(table: MesaId, fr: MesaFrame, R: number, cell: MesaCell, style: "hover" | "win"): Overlay {
  const pad = 0.6;
  const b = 0.55;
  const z = MESA_TOP_Z[table];
  return paintLocalPlane(fr, z, cell.u0 - pad, cell.v0 - pad, cell.u1 + pad, cell.v1 + pad, R, (u, v) => {
    const inside = insideMesaCell(cell, u, v);
    const edge = !insideMesaCell(cell, u - b, v) || !insideMesaCell(cell, u + b, v) || !insideMesaCell(cell, u, v - b) || !insideMesaCell(cell, u, v + b);
    if (style === "hover") {
      if (!inside) return null;
      return edge ? alpha(at(C.cream, 5), 0.9) : alpha(at(C.cream, 5), 0.18);
    }
    if (!inside) return at(C.gold, 5);
    if (edge) return at(C.gold, 4);
    return alpha(at(C.gold, 5), 0.28);
  });
}

/** Casilla bajo un punto de pantalla (en el plano del paño), o null. */
export function mesaCellAtScreen(table: MesaId, fr: MesaFrame, sx: number, sy: number, toLocal: (fr: MesaFrame, x: number, y: number, z: number) => { u: number; v: number }) {
  const l = toLocal(fr, sx, sy, MESA_TOP_Z[table]);
  return mesaCellAt(table, l.u, l.v);
}

/** Lo que encuadra la cámara: el tablero, con lugar arriba para las cartas, el cubilete o los caballitos. */
export function mesaRect(table: MesaId, fr: MesaFrame): ScreenBox {
  const { u0, v0, u1, v1 } = MESA_PLANE[table];
  const z = MESA_TOP_Z[table];
  const pts = [localToScreen(fr, u0, v0, z), localToScreen(fr, u1, v0, z), localToScreen(fr, u0, v1, z), localToScreen(fr, u1, v1, z)];
  const top = table === "dados" ? DADOS_DOME.h + 4 : table === "caballos" ? 8 : 6;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - 1;
  const y = Math.min(...ys) - top;
  return { x, y, w: Math.max(...xs) + 1 - x, h: Math.max(...ys) + 1 - y };
}

/**
 * Dónde va cada carta de una mano del baccarat (pantalla, el centro de la base), en abanico desde el
 * recuadro de la mano, y dónde va la placa del total (a la izquierda de las cartas).
 */
export function baccaratCardPlan(fr: MesaFrame, R: number, hand: "player" | "banker", n: number) {
  const h = BACCARAT_HANDS[hand];
  const base = localToScreen(fr, h.u, h.v, BACCARAT_TOP_Z);
  const { w, fan } = cardSize(R);
  const step = (fan + 2) / R;
  const cards = Array.from({ length: n }, (_, k) => ({ x: base.x + (k - (n - 1) / 2) * step, y: base.y }));
  const left = base.x - ((n - 1) / 2) * step - (w + 2) / 2 / R;
  return { cards, tag: { x: left - 1 / R, y: base.y } };
}

/** Ancho en pantalla de una placa (para ponerla a la izquierda de algo). */
export const tagWidth = (text: string, R: number) => (textWidth(text) + 8) / R;

/** Dibujos de las mesas nuevas, para registrar en DRAW de furniture.ts. */
export const MESAS_DRAW: Record<string, () => Sprite> = {
  "baccarat-table": baccaratTable,
  "sicbo-table": dadosTable,
  "horse-race-table": horseRaceTable,
};

