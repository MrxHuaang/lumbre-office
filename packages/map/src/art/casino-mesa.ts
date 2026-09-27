// Arte del modo mesa del casino: lo que se dibuja encima de las mesas cuando la cámara se acerca (el
// paño con los números, la rueda girando con la bola, las fichas y las cartas). Va en alta resolución
// (R puntos por unidad de arte) para que los números de 5x7 se lean; el cliente lo pone en el mundo
// con escala 1/R, justo sobre el mueble. Sin Phaser: también se dibuja a PNG para revisarlo.
import { cardRank, cardSuit, colorOf, HIDDEN_CARD, isRedSuit, RANK_LABEL, WHEEL_ORDER, type Card } from "@hyvento/shared";
import {
  BLACKJACK_ARC,
  BLACKJACK_DEALER,
  BLACKJACK_DISCARD,
  BLACKJACK_SHAPE,
  BLACKJACK_SHOE,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  BLACKJACK_TRAY,
  blackjackInset,
  ROULETTE_CELLS,
  ROULETTE_FELT,
  ROULETTE_TOP_Z,
  WHEEL_CENTER,
  WHEEL_R,
  WHEEL_TOP_Z,
  insideCell,
  type RouletteCell,
} from "./casino-layout";
import { INK, POCKET_RAMP, blackjackFeltColor, pocketAngle, rouletteFeltColor, wheelColor } from "./casino";
import { GLYPH_H, drawText, drawTextCentered, textWidth } from "./digits";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, noise, renderSprite, solidBox, toScreen, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";

// ---------- Marco de la mesa: local del mueble ↔ mundo ↔ pantalla ----------

/** Dónde está el mueble: esquina en unidades de arte y si su dibujo va espejado (mira a down/up). */
export interface MesaFrame {
  ax: number;
  ay: number;
  swap: boolean;
}

/** Marco de un mueble puesto en (x, y) tiles mirando a `facing` (down/up = espejo: u y v se cruzan). */
export function mesaFrame(f: { x: number; y: number; facing?: string }, tile = 16): MesaFrame {
  return { ax: f.x * tile, ay: f.y * tile, swap: f.facing === "down" || f.facing === "up" };
}

export const localToArt = (fr: MesaFrame, u: number, v: number) => (fr.swap ? { x: fr.ax + v, y: fr.ay + u } : { x: fr.ax + u, y: fr.ay + v });
export const artToLocal = (fr: MesaFrame, x: number, y: number) => (fr.swap ? { u: y - fr.ay, v: x - fr.ax } : { u: x - fr.ax, v: y - fr.ay });

/** Punto local (u, v, z) del mueble → pantalla (en unidades de arte, las mismas del juego a zoom 1). */
export function localToScreen(fr: MesaFrame, u: number, v: number, z: number) {
  const a = localToArt(fr, u, v);
  return toScreen(a.x, a.y, z);
}

/** Pantalla → punto local sobre el plano z (para saber qué casilla se tocó). */
export function screenToLocal(fr: MesaFrame, sx: number, sy: number, z: number) {
  return artToLocal(fr, sy + z + sx / 2, sy + z - sx / 2);
}

/** Un dibujo del modo mesa: `canvas` en puntos de 1/R, con la esquina de arriba en (sx, sy) de pantalla. */
export interface Overlay {
  canvas: PixelCanvas;
  sx: number;
  sy: number;
  R: number;
}

function overlayFor(points: { x: number; y: number }[], R: number, pad = 0): Overlay {
  const minX = Math.min(...points.map((p) => p.x)) - pad;
  const minY = Math.min(...points.map((p) => p.y)) - pad;
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;
  const sx = Math.floor(minX * R) / R;
  const sy = Math.floor(minY * R) / R;
  return { canvas: new PixelCanvas(Math.ceil((maxX - sx) * R) + 1, Math.ceil((maxY - sy) * R) + 1), sx, sy, R };
}

/** Punto de pantalla → punto del lienzo del dibujo. */
export const toCanvas = (ov: Overlay, s: { x: number; y: number }) => ({ x: (s.x - ov.sx) * ov.R, y: (s.y - ov.sy) * ov.R });

/** Pinta un rectángulo local del mueble, sobre el plano z, punto por punto. */
function paintLocalPlane(fr: MesaFrame, z: number, u0: number, v0: number, u1: number, v1: number, R: number, shade: (u: number, v: number) => RGBA | null): Overlay {
  const corners = [localToScreen(fr, u0, v0, z), localToScreen(fr, u1, v0, z), localToScreen(fr, u0, v1, z), localToScreen(fr, u1, v1, z)];
  const ov = overlayFor(corners, R);
  const { canvas } = ov;
  for (let j = 0; j < canvas.height; j++)
    for (let i = 0; i < canvas.width; i++) {
      const l = screenToLocal(fr, ov.sx + (i + 0.5) / R, ov.sy + (j + 0.5) / R, z);
      if (l.u < u0 || l.u >= u1 || l.v < v0 || l.v >= v1) continue;
      const col = shade(l.u, l.v);
      if (col) canvas.set(i, j, col);
    }
  return ov;
}

// ---------- Ruleta: el paño ----------

/** Color de las letras sobre cada fondo (crema con borde oscuro del mismo tono). */
function labelInk(cell: RouletteCell): { color: RGBA; outline: RGBA } {
  if (cell.fill === "red") return { color: at(C.cream, 5), outline: at(C.rug, 0) };
  if (cell.fill === "black") return { color: at(C.cream, 5), outline: at(INK, 0) };
  return { color: at(C.cream, 5), outline: at(C.green, 0) };
}

/**
 * El paño completo en alta resolución: las casillas y todos los rótulos con la tipografía de 5x7 (los
 * números a escala `scale`). Tapa el paño del mueble.
 */
export function rouletteFeltOverlay(fr: MesaFrame, R: number, scale = 1): Overlay {
  const { u0, v0, u1, v1 } = ROULETTE_FELT;
  const ov = paintLocalPlane(fr, ROULETTE_TOP_Z, u0, v0, u1, v1, R, rouletteFeltColor);
  for (const cell of ROULETTE_CELLS) {
    if (!cell.label) continue;
    const p = toCanvas(ov, localToScreen(fr, cell.text.u, cell.text.v, ROULETTE_TOP_Z));
    const ink = labelInk(cell);
    drawTextCentered(ov.canvas, cell.label, p.x, p.y, ink.color, { scale, outline: ink.outline });
  }
  return ov;
}

/** Marca sobre una casilla: `hover` (luz suave donde apuntas) o `win` (el número que salió, dorado). */
export function rouletteCellMark(fr: MesaFrame, R: number, cell: RouletteCell, style: "hover" | "win"): Overlay {
  const pad = 0.6;
  const b = 0.55;
  return paintLocalPlane(fr, ROULETTE_TOP_Z, cell.u0 - pad, cell.v0 - pad, cell.u1 + pad, cell.v1 + pad, R, (u, v) => {
    const inside = insideCell(cell, u, v);
    const edge = !insideCell(cell, u - b, v) || !insideCell(cell, u + b, v) || !insideCell(cell, u, v - b) || !insideCell(cell, u, v + b);
    if (style === "hover") {
      if (!inside) return null;
      return edge ? alpha(at(C.cream, 5), 0.9) : alpha(at(C.cream, 5), 0.18);
    }
    const ring = !inside && (insideCell(cell, u - pad, v) || insideCell(cell, u + pad, v) || insideCell(cell, u, v - pad) || insideCell(cell, u, v + pad));
    if (ring) return at(C.gold, 5);
    if (inside && edge) return at(C.gold, 4);
    return inside ? alpha(at(C.gold, 5), 0.28) : null;
  });
}

// ---------- Fichas ----------

export const CHIP_VALUES = [1, 5, 10, 25, 50] as const;

/** Colores de cada ficha: el cuerpo, las rayas del canto y el número. */
export const CHIP_COLORS: Record<number, { body: Ramp; stripe: RGBA; text: RGBA }> = {
  1: { body: C.cream, stripe: at(C.blue, 3), text: at(C.blue, 1) },
  5: { body: C.rug, stripe: at(C.cream, 5), text: at(C.cream, 5) },
  10: { body: C.blue, stripe: at(C.cream, 5), text: at(C.cream, 5) },
  25: { body: C.green, stripe: at(C.cream, 5), text: at(C.cream, 5) },
  50: { body: INK, stripe: at(C.gold, 4), text: at(C.gold, 5) },
};

/** La ficha más grande que no pasa de `amount` (para el color de una pila). */
export const chipFor = (amount: number) => [...CHIP_VALUES].reverse().find((c) => c <= amount) ?? 1;

export interface ChipSprite {
  canvas: PixelCanvas;
  /** Punto del lienzo que va sobre el paño (el centro de la base de la pila). */
  ax: number;
  ay: number;
}

/** Radio de la ficha en el piso (unidades de arte). */
const CHIP_R = 2;

/**
 * Pila de `count` fichas de `value`, la de arriba con el número (o con `face`, el monto de la apuesta).
 * `mine` = borde dorado (las tuyas se distinguen de las de los demás).
 */
export function chipStack(value: number, count: number, R: number, opts: { mine?: boolean; face?: string } = {}): ChipSprite {
  const col = CHIP_COLORS[value] ?? CHIP_COLORS[1]!;
  const rx = CHIP_R * Math.SQRT2 * R;
  const ry = (CHIP_R / Math.SQRT2) * R;
  const th = Math.max(2, Math.round(0.5 * R));
  const n = Math.max(1, Math.min(8, count));
  const W = Math.ceil(rx * 2 + 2);
  const H = Math.ceil(ry * 2 + th * n + 4);
  const c = new PixelCanvas(W, H);
  const cx = W / 2;
  const baseY = H - ry - 2;
  // Canto de cada ficha (de abajo hacia arriba), con las rayas blancas del borde.
  for (let k = 0; k < n; k++) {
    const y0 = baseY - k * th;
    for (let y = Math.floor(y0 - th); y <= Math.ceil(y0 + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        if (Math.abs(nx) > 1) continue;
        const low = y0 + ry * Math.sqrt(1 - nx * nx);
        const high = y0 - th + ry * Math.sqrt(1 - nx * nx);
        if (y + 0.5 > low || y + 0.5 < high) continue;
        const stripe = Math.floor((nx + 1) * 3.5) % 2 === 1;
        const shade = nx < -0.2 ? 3 : nx > 0.5 ? 1 : 2;
        c.set(x, y, stripe ? col.stripe : at(col.body, y + 0.5 > low - 1 ? shade - 1 : shade));
      }
  }
  // Cara de arriba: el color, un anillo de rayas y el número al centro.
  const topY = baseY - (n - 1) * th - th;
  for (let y = Math.floor(topY - ry); y <= Math.ceil(topY + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - topY) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const ang = Math.atan2(ny, nx);
      // Con R chico el anillo de rayas es más fino, así el número no se monta sobre las rayas.
      const ringZone = d > (R < 4 ? 0.86 : 0.62);
      const stripe = ringZone && Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0;
      c.set(x, y, stripe ? col.stripe : at(col.body, ringZone ? 3 : 4));
    }
  drawTextCentered(c, opts.face ?? String(value), cx, topY, col.text, { outline: value === 1 ? undefined : at(col.body, 1) });
  c.outline(opts.mine ? at(C.gold, 5) : OUT);
  return { canvas: c, ax: cx, ay: baseY };
}

/**
 * Fichas de una apuesta: una pila corta del color de la ficha más grande que entra, con el monto escrito
 * en la de arriba. Sin placa encima: una pila alta taparía los números de la fila de atrás del paño.
 * `extra` = fichas de más (el blackjack doblado se ve más alto, sin ocupar más ancho).
 */
export function betChips(amount: number, R: number, mine: boolean, extra = 0): ChipSprite {
  const value = chipFor(amount);
  return chipStack(value, (amount > value ? 2 : 1) + extra, R, { mine, face: String(amount) });
}

// ---------- Ruleta: la rueda ----------

/** Cómo va la bola: ángulo (vista de arriba), radio desde el centro y cuánto rebota hacia arriba. */
export interface BallPose {
  a: number;
  r: number;
  lift: number;
}

/**
 * Pinta la rueda cuadro a cuadro: guarda para cada punto del lienzo su radio y ángulo sobre el plato,
 * así cada cuadro solo busca colores. Los números se escriben derechos (no giran con la rueda) donde
 * caben; si el zoom no alcanza, la rueda va sin números.
 */
export class WheelPainter {
  readonly overlay: Overlay;
  private readonly polar: Float32Array;
  private readonly px: number;
  /** Lo que no gira (el cuenco, la pista, los deflectores), pintado una vez. */
  private base?: Uint8ClampedArray;
  /** Puntos de la parte que gira (índices del lienzo): son los únicos que se recalculan. */
  private spinning?: Int32Array;
  /** ¿Caben los números a esta resolución? */
  readonly numbers: boolean;

  constructor(
    private readonly fr: MesaFrame,
    readonly R: number,
  ) {
    const { u: cu, v: cv } = WHEEL_CENTER;
    const r = WHEEL_R.rim;
    const z = WHEEL_TOP_Z;
    const pts = [localToScreen(fr, cu - r, cv - r, z), localToScreen(fr, cu + r, cv - r, z), localToScreen(fr, cu - r, cv + r, z), localToScreen(fr, cu + r, cv + r, z), localToScreen(fr, cu, cv, z + 4)];
    this.overlay = overlayFor(pts, R, 0.5);
    const { canvas } = this.overlay;
    this.polar = new Float32Array(canvas.width * canvas.height * 2);
    for (let j = 0; j < canvas.height; j++)
      for (let i = 0; i < canvas.width; i++) {
        const l = screenToLocal(fr, this.overlay.sx + (i + 0.5) / R, this.overlay.sy + (j + 0.5) / R, z);
        const k = (j * canvas.width + i) * 2;
        // El ángulo va en el marco del mueble: con el espejo, el giro se ve al revés, como debe.
        this.polar[k] = Math.hypot(l.u - cu, l.v - cv);
        this.polar[k + 1] = Math.atan2(l.v - cv, l.u - cu);
      }
    this.px = 1 / R;
    this.numbers = numbersFit(R);
  }

  /** Dibuja la rueda girada `spin` (y la bola, si está). */
  paint(spin: number, ball: BallPose | null, highlight = -1): PixelCanvas {
    const { canvas } = this.overlay;
    const data = canvas.data;
    if (!this.base || !this.spinning) this.prepare();
    data.set(this.base!);
    for (const k of this.spinning!) {
      const col = wheelColor(this.polar[k * 2]!, this.polar[k * 2 + 1]!, spin, this.px);
      if (!col) continue;
      const o = k * 4;
      data[o] = col[0];
      data[o + 1] = col[1];
      data[o + 2] = col[2];
      data[o + 3] = 255;
    }
    if (this.numbers) this.paintNumbers(spin, highlight);
    this.paintTurret();
    if (ball) this.paintBall(ball);
    return canvas;
  }

  /** Separa lo fijo de lo que gira: el cuenco se pinta una sola vez. */
  private prepare() {
    const { canvas } = this.overlay;
    const n = canvas.width * canvas.height;
    const base = new Uint8ClampedArray(n * 4);
    const moving: number[] = [];
    for (let k = 0; k < n; k++) {
      const r = this.polar[k * 2]!;
      if (r > WHEEL_R.rim) continue;
      if (r <= WHEEL_R.head) {
        moving.push(k);
        continue;
      }
      const col = wheelColor(r, this.polar[k * 2 + 1]!, 0, this.px)!;
      base.set([col[0], col[1], col[2], 255], k * 4);
    }
    this.base = base;
    this.spinning = Int32Array.from(moving);
  }

  /** Punto del lienzo de un punto polar del plato (a la altura del plato + `lift`). */
  private at(r: number, a: number, lift = 0) {
    const { u: cu, v: cv } = WHEEL_CENTER;
    return toCanvas(this.overlay, localToScreen(this.fr, cu + Math.cos(a) * r, cv + Math.sin(a) * r, WHEEL_TOP_Z + lift));
  }

  private paintNumbers(spin: number, highlight: number) {
    const r = (WHEEL_R.numbers + WHEEL_R.pockets) / 2;
    for (const n of WHEEL_ORDER) {
      const p = this.at(r, pocketAngle(n) + spin);
      const win = n === highlight;
      drawTextCentered(this.overlay.canvas, String(n), p.x, p.y, win ? at(C.gold, 5) : at(C.cream, 5), {
        outline: win ? at(C.gold, 0) : n === 0 ? at(C.green, 0) : at(POCKET_RAMP[colorOf(n) === "red" ? "red" : "black"], 0),
      });
    }
  }

  private paintTurret() {
    const c = this.overlay.canvas;
    const base = this.at(0, 0, 0);
    const top = this.at(0, 0, 2.2);
    const rx = 1.1 * Math.SQRT2 * this.R;
    const ry = (1.1 / Math.SQRT2) * this.R;
    for (let y = Math.floor(top.y - ry); y <= Math.ceil(base.y + ry); y++)
      for (let x = Math.floor(base.x - rx); x <= Math.ceil(base.x + rx); x++) {
        const nx = (x + 0.5 - base.x) / rx;
        if (Math.abs(nx) > 1) continue;
        const h = ry * Math.sqrt(1 - nx * nx);
        if (y + 0.5 > base.y + h || y + 0.5 < top.y - h) continue;
        const onTop = (x + 0.5 - top.x) ** 2 / rx ** 2 + (y + 0.5 - top.y) ** 2 / ry ** 2 <= 1;
        c.set(x, y, onTop ? at(C.gold, nx < -0.3 ? 5 : 4) : at(C.gold, nx < -0.3 ? 3 : nx > 0.4 ? 1 : 2));
      }
    c.set(top.x - rx * 0.35, top.y - ry * 0.3, at(C.gold, 5));
  }

  private paintBall(b: BallPose) {
    const c = this.overlay.canvas;
    const r = Math.max(1.5, 0.55 * this.R);
    // Sombra en el plato y la bola encima, con brillo arriba a la izquierda.
    const floor = this.at(b.r, b.a, 0);
    c.ellipse(floor.x + r * 0.3, floor.y + r * 0.2, r * 1.1, r * 0.55, alpha(at(INK, 0), 0.45));
    const p = this.at(b.r, b.a, 0.6 + b.lift);
    for (let y = Math.floor(p.y - r); y <= Math.ceil(p.y + r); y++)
      for (let x = Math.floor(p.x - r); x <= Math.ceil(p.x + r); x++) {
        const dx = (x + 0.5 - p.x) / r;
        const dy = (y + 0.5 - p.y) / r;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const light = -(dx * 0.6 + dy * 0.8);
        c.set(x, y, light > 0.55 ? at(C.white, 4) : light > -0.2 ? at(C.white, 3) : light > -0.6 ? at(C.white, 2) : at(C.white, 1));
      }
    for (let y = Math.floor(p.y - r - 1); y <= Math.ceil(p.y + r + 1); y++)
      for (let x = Math.floor(p.x - r - 1); x <= Math.ceil(p.x + r + 1); x++) {
        const d = Math.hypot((x + 0.5 - p.x) / r, (y + 0.5 - p.y) / r);
        if (d > 1 && d <= 1 + 1.2 / r) c.set(x, y, OUT);
      }
  }
}

/**
 * ¿Caben los 37 números de 5x7 derechos alrededor del aro a resolución R? Cada número mide 11x7 puntos
 * y los vecinos no se pueden tocar (en los costados de la elipse quedan uno encima del otro).
 */
export function numbersFit(R: number): boolean {
  const r = (WHEEL_R.numbers + WHEEL_R.pockets) / 2;
  const step = (Math.PI * 2) / WHEEL_ORDER.length;
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const p = toScreen(Math.cos(a) * r, Math.sin(a) * r);
    const q = toScreen(Math.cos(a + step) * r, Math.sin(a + step) * r);
    // Se pueden tocar en diagonal, no montarse (11x7 puntos cada uno).
    if (Math.abs(q.x - p.x) * R < 11 && Math.abs(q.y - p.y) * R < 7) return false;
  }
  // Y el aro tiene que tener alto para los 7 puntos arriba y abajo de la elipse.
  return ((WHEEL_R.numbers - WHEEL_R.pockets) / Math.SQRT2) * R >= 8;
}

/**
 * Cómo se mueve la rueda y la bola en un giro, todo en función del tiempo: así cada cliente ve lo
 * mismo aunque entre a la mitad. `t` = ms desde que empezó a girar; `spinMs` lo que dura el giro.
 * La rueda frena de a poco y la bola va al revés, baja de la pista, rebota entre los trastes y cae en
 * el casillero de `result`. `from` = el casillero donde estaba la bola (el resultado anterior).
 */
export function spinPose(t: number, spinMs: number, round: number, result: number, from: number): { spin: number; ball: BallPose } {
  const T = spinMs;
  const k = Math.min(1, Math.max(0, t / T));
  const startSpin = restSpin(round - 1);
  const endSpin = restSpin(round);
  // La rueda da una vuelta y media más de lo que le falta, frenando (ease-out cuadrático).
  let travel = endSpin - startSpin;
  while (travel < Math.PI * 3) travel += Math.PI * 2;
  const spin = startSpin + travel * (1 - (1 - k) ** 2);
  // La bola, relativa a la rueda: parte de su casillero y termina en el nuevo tras muchas vueltas al revés.
  const settle = 0.84;
  const s = Math.min(1, k / settle);
  const phiStart = from >= 0 ? pocketAngle(from) : 0;
  const phiEnd = pocketAngle(result);
  let delta = phiStart - phiEnd;
  delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const turns = 9;
  // g(s) va de 1 a 0 frenando; el término del rebote se apaga antes de caer.
  const g = (1 - s) ** 2.4;
  const bounce = s > 0.62 && s < 1 ? Math.sin((s - 0.62) * 38) * 0.13 * (1 - s) / 0.38 : 0;
  const phi = phiEnd + (delta + Math.PI * 2 * turns) * g + bounce;
  // Radio: sale del casillero a la pista, corre ahí y al perder velocidad baja a los casilleros.
  const R = WHEEL_R;
  const trackR = (R.track + R.lip) / 2;
  const pocketR = (R.pockets + R.cone) / 2 + 0.3;
  let r: number;
  let lift = 0;
  if (s < 0.06) r = pocketR + (trackR - pocketR) * (s / 0.06);
  else if (s < 0.55) r = trackR;
  else if (s < 0.68) {
    const q = (s - 0.55) / 0.13;
    r = trackR + (pocketR - trackR) * q * q;
    lift = Math.sin(q * Math.PI) * 0.8;
  } else {
    r = pocketR + (1 - s) * 0.6 * Math.abs(Math.sin((s - 0.68) * 30));
    lift = Math.abs(Math.sin((s - 0.68) * 24)) * 1.4 * (1 - (s - 0.68) / 0.32) ** 2;
  }
  // phi relativo: la bola en absoluto va al revés que la rueda (phi baja más rápido de lo que sube el giro).
  return { spin, ball: { a: spin + phi, r, lift } };
}

/** Dónde queda quieta la rueda al terminar la ronda `round` (igual en todos los clientes). */
export function restSpin(round: number): number {
  const x = Math.sin(round * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * Math.PI * 2;
}

/** La bola quieta en su casillero, con la rueda en reposo tras la ronda `round`. */
export function restPose(round: number, n: number): { spin: number; ball: BallPose | null } {
  const spin = restSpin(round);
  if (n < 0) return { spin, ball: null };
  return { spin, ball: { a: spin + pocketAngle(n), r: (WHEEL_R.pockets + WHEEL_R.cone) / 2 + 0.3, lift: 0 } };
}

// ---------- Blackjack ----------

/** Caja en pantalla (unidades de arte, como el juego a zoom 1). */
export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** ¿Se tocan dos cajas? (`pad` = aire que tiene que quedar entre las dos). */
export const boxesTouch = (a: ScreenBox, b: ScreenBox, pad = 0) =>
  a.w > 0 && b.w > 0 && a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** ¿Tapa algo el punto local (u, v)? La bandeja, un círculo de apuesta, el sabot o el descarte. */
function blackjackBusy(u: number, v: number): boolean {
  const t = BLACKJACK_TRAY;
  if (u >= t.u0 - 0.5 && u < t.u1 + 0.5 && v >= t.v0 - 0.5 && v < t.v1 + 0.5) return true;
  if (BLACKJACK_SPOTS.some((s) => Math.hypot(u - s.u, v - s.v) < 3.4)) return true;
  for (const b of [BLACKJACK_SHOE, BLACKJACK_DISCARD]) if (Math.abs(u - b.u) < 3.2 && Math.abs(v - b.v) < 4) return true;
  return false;
}

/** Una letra del texto del paño: el carácter y el punto local donde va su centro. */
export interface ArcGlyph {
  ch: string;
  u: number;
  v: number;
}

/** Textos del arco, del más largo al más corto: se usa el primero que entra a esa resolución. */
const ARC_TEXTS: readonly (readonly string[])[] = [
  ["BLACKJACK PAGA 3 A 2", "BLACKJACK 3 A 2", "PAGA 3 A 2"],
  ["SE PLANTA EN 17", "PLANTA EN 17"],
];

/** Caja en pantalla (desde el marco de la mesa en el origen) de una letra centrada en (u, v). */
function glyphBox(ch: string, u: number, v: number, R: number): ScreenBox {
  const p = toScreen(u, v, BLACKJACK_TOP_Z);
  const w = (textWidth(ch) + 2) / R;
  const h = (GLYPH_H + 2) / R;
  return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

/**
 * Letras de un texto a lo largo del arco de radio `r`, centrado en el ángulo π/4 (donde el arco se ve
 * horizontal en pantalla). Null si alguna letra se sale del paño o cae sobre la bandeja, un círculo, el
 * sabot o el descarte: mejor otro texto que letras sueltas.
 */
function arcLine(text: string, r: number, R: number): ArcGlyph[] | null {
  const { u: cu, v: cv } = BLACKJACK_ARC;
  const pos = (a: number) => toScreen(cu + Math.cos(a) * r, cv + Math.sin(a) * r);
  // Largo del arco en pantalla, muestreado fino; bajando el ángulo, el texto va de izquierda a derecha.
  const a0 = Math.PI / 4;
  const samples: { a: number; d: number }[] = [];
  let d = 0;
  let prev = pos(a0 + 1.6);
  for (let a = a0 + 1.6; a >= a0 - 1.6; a -= 0.002) {
    const p = pos(a);
    d += Math.hypot(p.x - prev.x, p.y - prev.y);
    samples.push({ a, d });
    prev = p;
  }
  const mid = samples.find((s) => s.a <= a0)!.d;
  const w = textWidth(text) / R;
  const out: ArcGlyph[] = [];
  let x = mid - w / 2;
  for (const ch of text) {
    const cw = textWidth(ch) / R;
    const s = samples.find((q) => q.d >= x + cw / 2);
    // Más allá de ±0,8 rad el arco se empina y las letras quedarían en escalera.
    if (!s || Math.abs(s.a - a0) > 0.8) return null;
    if (ch !== " ") {
      const g = { ch, u: cu + Math.cos(s.a) * r, v: cv + Math.sin(s.a) * r };
      const b = glyphBox(ch, g.u, g.v, R);
      for (const [px, py] of [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h],
      ] as const) {
        const l = { u: py + BLACKJACK_TOP_Z + px / 2, v: py + BLACKJACK_TOP_Z - px / 2 };
        if (blackjackInset(l.u, l.v) < 0.4 || blackjackBusy(l.u, l.v)) return null;
      }
      out.push(g);
    }
    x += cw + 1 / R;
  }
  return out;
}

/**
 * El texto del paño entre los dos filetes dorados del arco, a resolución R: las dos líneas si entran
 * (separadas por al menos una letra y dos puntos en pantalla), si no una sola, y más corta si hace falta.
 */
export function blackjackArcGlyphs(R: number): ArcGlyph[] {
  const { r0, r1 } = BLACKJACK_ARC;
  // En π/4 el radio se ve vertical y achicado por √2: cuánto radio ocupa una letra con su borde.
  const perPoint = Math.SQRT2 / R;
  const half = ((GLYPH_H + 2) / 2) * perPoint;
  const step = (GLYPH_H + 3) * perPoint;
  const two = r1 - r0 >= half * 2 + step + 0.4;
  const radii = two ? [(r0 + r1) / 2 + step / 2, (r0 + r1) / 2 - step / 2] : [(r0 + r1) / 2];
  const out: ArcGlyph[] = [];
  radii.forEach((r, i) => {
    for (const text of ARC_TEXTS[i]!) {
      const line = arcLine(text, r, R);
      if (line) {
        out.push(...line);
        break;
      }
    }
  });
  return out;
}

/** Cajas en pantalla de las letras del paño (para que las cartas y placas no las tapen). */
export function blackjackArcBoxes(R: number): ScreenBox[] {
  return blackjackArcGlyphs(R).map((g) => glyphBox(g.ch, g.u, g.v, R));
}

/** Paño del blackjack en alta resolución, con el texto del arco y el número de cada asiento. */
export function blackjackFeltOverlay(fr: MesaFrame, R: number): Overlay {
  const { u0, v0, u1, v1 } = BLACKJACK_SHAPE;
  const ov = paintLocalPlane(fr, BLACKJACK_TOP_Z, u0, v0, u1, v1, R, (u, v) => blackjackFeltColor(u, v, false));
  for (const g of blackjackArcGlyphs(R)) {
    const p = toCanvas(ov, localToScreen(fr, g.u, g.v, BLACKJACK_TOP_Z));
    drawTextCentered(ov.canvas, g.ch, p.x, p.y, at(C.gold, 5), { outline: at(C.green, 0) });
  }
  BLACKJACK_SPOTS.forEach((s, i) => {
    const p = toCanvas(ov, localToScreen(fr, s.u, s.v, BLACKJACK_TOP_Z));
    drawTextCentered(ov.canvas, String(i + 1), p.x, p.y, alpha(at(C.gold, 4), 0.75));
  });
  return ov;
}

/** Anillo dorado alrededor del círculo de apuesta de un asiento (a quién le toca jugar). */
export function blackjackSpotMark(fr: MesaFrame, R: number, spot: { u: number; v: number }): Overlay {
  const r0 = 3.1;
  const r1 = 3.9;
  return paintLocalPlane(fr, BLACKJACK_TOP_Z, spot.u - r1, spot.v - r1, spot.u + r1, spot.v + r1, R, (u, v) => {
    const d = Math.hypot(u - spot.u, v - spot.v);
    if (d < r0 || d > r1) return null;
    return d < r0 + 0.25 || d > r1 - 0.25 ? at(C.gold, 3) : at(C.gold, 5);
  });
}

/**
 * Cajas locales → sprite en alta resolución (R puntos por unidad), con el origen del sprite en el punto
 * local (0, 0, 0). Con el mueble espejado se cruzan u y v (y las caras izquierda y derecha).
 */
function hiResPiece(fr: MesaFrame, boxes: Box[], R: number): Sprite {
  // Los sombreadores siguen recibiendo unidades de arte (se dividen por R).
  const unscale = (f: Shader | undefined): Shader | undefined => f && ((u, v, fw, fh) => f(u / R, v / R, fw / R, fh / R));
  const scaled = boxes.map((b): Box => {
    const s = { ...b, x: b.x * R, y: b.y * R, z: b.z * R, w: b.w * R, d: b.d * R, h: b.h * R, top: unscale(b.top), left: unscale(b.left), right: unscale(b.right) };
    return fr.swap ? { ...s, x: s.y, y: s.x, w: s.d, d: s.w, left: s.right, right: s.left } : s;
  });
  return renderSprite(scaled, { outline: OUT });
}

/** Una pieza suelta sobre el paño: el lienzo y el punto del lienzo que va sobre su lugar. */
export interface PieceSprite {
  canvas: PixelCanvas;
  ax: number;
  ay: number;
}

/**
 * El sabot (la caja de madera con frente de acrílico rojo y la carta asomada) en alta resolución, para
 * dibujarlo encima del paño del modo mesa. Su punto de apoyo es BLACKJACK_SHOE.
 */
export function shoeSprite(fr: MesaFrame, R: number): PieceSprite {
  const px = 1 / R;
  const wood = (u: number, v: number, fw: number, fh: number) => {
    const edge = u < px * 1.5 || v < px * 1.5 || u > fw - px * 1.5 || v > fh - px * 1.5;
    return at(C.woodDark, edge ? 4 : noise(Math.floor(u * 3), Math.floor(v * 6), 7) < 0.25 ? 2 : 3);
  };
  const sp = hiResPiece(
    fr,
    [
      // Filete de bronce de abajo (primero: lo de atrás se dibuja antes).
      solidBox({ x: -2.2, y: -3.2, z: 0, w: 4.9, d: 6.4, h: 0.4 }, C.gold, 3),
      // La caja: tapa de madera con la ranura de las cartas.
      {
        x: -2,
        y: -3,
        z: 0.4,
        w: 4.5,
        d: 6,
        h: 2.6,
        // La ranura: una franja angosta con el canto de las cartas (no un rectángulo crema entero).
        top: (u, v, fw, fh) => (u > 2.6 && u < 3.6 && v > 1 && v < 5 ? at(C.cream, u > 3.3 ? 3 : 5) : wood(u, v, fw, fh)),
        left: (u, h) => at(C.woodDark, h > 2.6 ? 3 : 2),
        right: (u, h) => (u > 0.6 && u < 5.4 && h > 0.5 && h < 2.6 ? at(C.rug, h > 2 ? 4 : 3) : at(C.woodDark, 2)),
      },
      // La carta asomada por la boca del sabot.
      solidBox({ x: 2.3, y: -1.2, z: 0.4, w: 1, d: 2.4, h: 1.4 }, C.cream, 4),
    ],
    R,
  );
  return { canvas: sp.canvas, ax: sp.ox, ay: sp.oy };
}

/** El descarte: un mazo de cartas usadas de dorso rojo, con los cantos crema. */
export function discardSprite(fr: MesaFrame, R: number): PieceSprite {
  const sp = hiResPiece(
    fr,
    [
      {
        x: -1.5,
        y: -2,
        z: 0,
        w: 3,
        d: 4,
        h: 1.5,
        top: (u, v) => ((Math.floor(u * R * 0.5) + Math.floor(v * R * 0.5)) % 2 ? at(C.rug, 4) : at(C.rug, 3)),
        left: (_u, h) => at(C.cream, Math.floor(h * R * 0.5) % 2 ? 3 : 5),
        right: (_u, h) => at(C.cream, Math.floor(h * R * 0.5) % 2 ? 2 : 4),
      },
    ],
    R,
  );
  return { canvas: sp.canvas, ax: sp.ox, ay: sp.oy };
}

// ---------- Cartas ----------

// Palos de 5x5 (picas, corazones, diamantes, tréboles) y en grande de 7x7 para la carta grande.
const SUITS: readonly (readonly string[])[] = [
  ["..#..", ".###.", "#####", "..#..", ".###."],
  [".#.#.", "#####", "#####", ".###.", "..#.."],
  ["..#..", ".###.", "#####", ".###.", "..#.."],
  [".###.", ".###.", "#.#.#", "#####", "..#.."],
];
const BIG_SUITS: readonly (readonly string[])[] = [
  ["...#...", "..###..", ".#####.", "#######", "#######", "..#.#..", ".#####."],
  [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."],
  ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."],
  ["..###..", "..###..", "##.#.##", "#######", "##.#.##", "...#...", "..###.."],
];
/** El 10 de las cartas en 5 de ancho (un 1 de un trazo y un 0 angosto), como las demás figuras. */
const TEN = ["#..#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#.#.#", "#..#."];

function stamp(c: PixelCanvas, g: readonly string[], x: number, y: number, col: RGBA) {
  g.forEach((row, j) => [...row].forEach((ch, i) => ch === "#" && c.set(x + i, y + j, col)));
}

/**
 * Tamaño de las cartas (sin el contorno) y cuánto se corre cada carta de una mano: con R chico la carta
 * es más chica, así las cinco manos entran en la mesa. El corrimiento deja ver el valor de todas.
 */
export function cardSize(R: number): { w: number; h: number; fan: number } {
  // El abanico deja a la vista más de media carta: se leen el valor y el palo de todas.
  return R < 5 ? { w: 11, h: 15, fan: 7 } : { w: 16, h: 21, fan: 9 };
}

/**
 * Carta derecha: valor y palo arriba a la izquierda (lo que queda a la vista en el abanico) y, en la
 * grande, el palo grande abajo a la derecha, separado del chico. O el dorso.
 */
export function cardSprite(card: Card, R = 5): PixelCanvas {
  const { w, h } = cardSize(R);
  const small = w < 16;
  const c = new PixelCanvas(w + 2, h + 2);
  const x0 = 1;
  const y0 = 1;
  if (card === HIDDEN_CARD) {
    // Dorso: rojo con rombos crema y borde blanco.
    c.rect(x0, y0, w, h, at(C.cream, 5));
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        const diamond = (x + y) % 4 === 0 || (x - y + 64) % 4 === 0;
        c.set(x0 + x, y0 + y, diamond ? at(C.rug, 4) : at(C.rug, 2));
      }
  } else {
    const ink = isRedSuit(card) ? at(C.rug, 2) : at(INK, 1);
    c.rect(x0, y0, w, h, at(C.cream, 5));
    // Sombrita del canto de abajo y la derecha: se ve apoyada.
    for (let x = 1; x < w; x++) c.set(x0 + x, y0 + h - 1, at(C.cream, 3));
    for (let y = 1; y < h; y++) c.set(x0 + w - 1, y0 + y, at(C.cream, 3));
    const m = small ? 1 : 2;
    const rank = cardRank(card);
    if (rank === 10) stamp(c, TEN, x0 + m, y0 + m, ink);
    else drawText(c, RANK_LABEL[rank]!, x0 + m, y0 + m, ink);
    stamp(c, SUITS[cardSuit(card)]!, x0 + m, y0 + m + GLYPH_H + 1, ink);
    // Abajo a la derecha, con un punto de aire respecto del palo chico (si no, se ven como una mancha).
    if (!small) stamp(c, BIG_SUITS[cardSuit(card)]!, x0 + w - 8, y0 + h - 8, ink);
  }
  c.outline(OUT);
  return c;
}

/** Placa chica con texto (totales de las manos, resultados): fondo oscuro con borde de bronce. */
export function tagSprite(text: string, tone: "plain" | "good" | "bad" | "gold" = "plain"): PixelCanvas {
  const w = textWidth(text) + 6;
  const h = GLYPH_H + 5;
  const c = new PixelCanvas(w + 2, h + 2);
  const bg = tone === "good" ? C.green : tone === "bad" ? C.rug : INK;
  c.rect(1, 1, w, h, at(bg, 1));
  c.rect(2, 2, w - 2, h - 2, at(bg, 2));
  for (let x = 1; x <= w; x++) {
    c.set(x, 1, at(C.gold, 3));
    c.set(x, h, at(C.gold, 2));
  }
  for (let y = 1; y <= h; y++) {
    c.set(1, y, at(C.gold, 3));
    c.set(w, y, at(C.gold, 2));
  }
  drawText(c, text, 4, 4, tone === "gold" ? at(C.gold, 5) : at(C.cream, 5));
  c.outline(OUT);
  return c;
}

// ---------- Blackjack: dónde va cada cosa de una mano ----------

type Side = "left" | "right" | "above";

/**
 * Dónde van las cartas de cada asiento (punto local del paño: la base de la mano) y de qué lado de las
 * cartas va la placa del total. Se eligieron asiento por asiento, cerca de la línea entre la ficha y
 * el crupier, para que ninguna mano toque a otra, ni a las fichas, ni a las cartas del crupier, desde R3
 * (lo verifica un test con manos de tres cartas).
 */
export interface HandSpot {
  u: number;
  v: number;
  tag: Side;
}
export const BLACKJACK_HANDS: readonly HandSpot[] = [
  { u: 9.5, v: 11.3, tag: "left" },
  { u: 18, v: 16.5, tag: "left" },
  { u: 19.6, v: 25, tag: "left" },
  { u: 21.5, v: 40, tag: "above" },
  { u: 9, v: 36.2, tag: "left" },
];
/** Las cartas del crupier y su placa. */
export const BLACKJACK_DEALER_HAND: HandSpot = { u: BLACKJACK_DEALER.u, v: BLACKJACK_DEALER.v, tag: "left" };

/** Dónde va cada pieza de una mano (pantalla, con el marco de la mesa). */
export interface HandPlan {
  /** Base de la pila de fichas (el centro del círculo de apuesta). */
  chip: { x: number; y: number };
  chipBox: ScreenBox;
  /** Centro de la base de cada carta, en el orden en que se reparten (cada una delante de la anterior). */
  cards: { x: number; y: number }[];
  cardsBox: ScreenBox;
  /** La placa (total o resultado). */
  tag: ScreenBox;
}

/** Aire entre piezas, en puntos de pantalla. */
const GAP_PTS = 2;

/** Las cartas de una mano con la base centrada en `at` (pantalla) y la placa al lado. */
function placeHand(at: { x: number; y: number }, n: number, R: number, tag: { width: number; height: number } | null, side: Side) {
  const { w, h, fan } = cardSize(R);
  const cw = (w + 2) / R;
  const gw = cw + (Math.max(n, 1) - 1) * (fan / R);
  const cardsBox = n > 0 ? { x: at.x - gw / 2, y: at.y - (h + 2) / R, w: gw, h: (h + 2) / R } : { x: at.x, y: at.y, w: 0, h: 0 };
  const cards = Array.from({ length: n }, (_, k) => ({ x: cardsBox.x + cw / 2 + (k * fan) / R, y: at.y }));
  let tagBox: ScreenBox = { x: at.x, y: at.y, w: 0, h: 0 };
  if (tag && n > 0) {
    const tw = tag.width / R;
    const th = tag.height / R;
    const g = GAP_PTS / R;
    if (side === "left") tagBox = { x: cardsBox.x - g - tw, y: at.y - th, w: tw, h: th };
    else if (side === "right") tagBox = { x: cardsBox.x + gw + g, y: at.y - th, w: tw, h: th };
    else tagBox = { x: at.x - tw / 2, y: cardsBox.y - g - th, w: tw, h: th };
  }
  return { cards, cardsBox, tag: tagBox };
}

/**
 * La mano del asiento `seat` con `n` cartas: la ficha en su círculo, las cartas y la placa. `chip` y
 * `tag` son los dibujos que se van a usar (sus tamaños deciden las cajas); todo en pantalla, con el
 * marco de la mesa `fr`.
 */
export function blackjackHandPlan(
  fr: MesaFrame,
  R: number,
  seat: number,
  n: number,
  chip: { canvas: { width: number; height: number }; ax: number; ay: number } | null,
  tag: { width: number; height: number } | null,
  hand: HandSpot = BLACKJACK_HANDS[seat]!,
): HandPlan {
  const spot = BLACKJACK_SPOTS[seat]!;
  const p = localToScreen(fr, spot.u, spot.v, BLACKJACK_TOP_Z);
  const chipBox: ScreenBox = chip ? { x: p.x - chip.ax / R, y: p.y - chip.ay / R, w: chip.canvas.width / R, h: chip.canvas.height / R } : { x: p.x, y: p.y, w: 0, h: 0 };
  return { chip: p, chipBox, ...placeHand(localToScreen(fr, hand.u, hand.v, BLACKJACK_TOP_Z), n, R, tag, hand.tag) };
}

/** Las cartas del crupier, en fila junto al lado recto, con su placa. */
export function blackjackDealerPlan(fr: MesaFrame, R: number, n: number, tag: { width: number; height: number } | null, hand: HandSpot = BLACKJACK_DEALER_HAND) {
  return placeHand(localToScreen(fr, hand.u, hand.v, BLACKJACK_TOP_Z), n, R, tag, hand.tag);
}
