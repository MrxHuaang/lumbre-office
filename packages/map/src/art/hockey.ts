// Hockey de mesa del arcade: el mueble (una mesa de neón de 2x3 tiles) y lo que se dibuja encima en el
// modo mesa (la cancha en alta resolución, el disco, los mazos y el marcador). La cancha se pinta con la
// misma función en los dos, así el acercamiento no cambia los colores. Las medidas de la cancha salen de
// HOCKEY (@hyvento/shared), las mismas que usa la física del servidor.
import { HOCKEY, HOCKEY_GOAL_X0, HOCKEY_GOAL_X1, HOCKEY_MID } from "@hyvento/shared";
import { localToScreen, screenToLocal, toCanvas, type MesaFrame, type Overlay, type ScreenBox } from "./casino-mesa";
import { drawTextCentered, GLYPH_H, textWidth } from "./digits";
import { leg, shadowUnder } from "./kit";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, flat, renderSprite, solidBox, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";

/** La mesa: 2x3 tiles (32x48 unidades de arte), larga en y. */
export const HOCKEY_TABLE = { w: 32, d: 48 } as const;
/** Esquina de la cancha dentro del mueble (el resto son las bandas). */
export const HOCKEY_RINK = { u0: (HOCKEY_TABLE.w - HOCKEY.width) / 2, v0: (HOCKEY_TABLE.d - HOCKEY.length) / 2 } as const;
/** Alto de la superficie de juego (donde se apoyan el disco y los mazos). */
export const HOCKEY_TOP_Z = 13;
/** Dónde va el marcador: un cartel sobre un poste en la banda de atrás (lado -x), a la mitad. */
export const HOCKEY_BOARD = { u: 1, v: HOCKEY_TABLE.d / 2, z: 25 } as const;

/** Colores de cada lado (el 0 defiende el arco del norte): mazos, goles y marcador. */
export const HOCKEY_SIDE_COLOR = [C.neon, C.cyan] as const;

/** Punto de la cancha (x, y de la física) → punto local del mueble. */
export const rinkToLocal = (x: number, y: number) => ({ u: HOCKEY_RINK.u0 + x, v: HOCKEY_RINK.v0 + y });
/** Punto de la cancha → pantalla (sobre la superficie). */
export const rinkToScreen = (fr: MesaFrame, x: number, y: number, z = HOCKEY_TOP_Z) => {
  const l = rinkToLocal(x, y);
  return localToScreen(fr, l.u, l.v, z);
};
/** Pantalla → punto de la cancha (a dónde apunta el mouse sobre la superficie). */
export function screenToRink(fr: MesaFrame, sx: number, sy: number): { x: number; y: number } {
  const l = screenToLocal(fr, sx, sy, HOCKEY_TOP_Z);
  return { x: l.u - HOCKEY_RINK.u0, y: l.v - HOCKEY_RINK.v0 };
}

/**
 * Color de la cancha en (x, y) de la física: fondo azul noche con agujeritos de aire (solo con `fine`,
 * en baja resolución quedarían como ruido), la línea del medio y el círculo en magenta, y el área de
 * cada arco en celeste. null = fuera de la cancha.
 */
export function rinkColor(x: number, y: number, fine: boolean): RGBA | null {
  const { width: W, length: L } = HOCKEY;
  if (x < 0 || y < 0 || x >= W || y >= L) return null;
  const line = fine ? 0.28 : 0.55;
  const edge = Math.min(x, y, W - x, L - y);
  if (edge < (fine ? 0.35 : 0.6)) return at(C.cyan, 3);
  if (Math.abs(y - HOCKEY_MID) < line) return at(C.neon, 3);
  const center = Math.hypot(x - W / 2, y - HOCKEY_MID);
  if (Math.abs(center - 4.5) < line) return at(C.neon, 3);
  if (center < 1) return at(C.neon, 4);
  for (const gy of [0, L]) {
    const d = Math.hypot(x - W / 2, y - gy);
    if (Math.abs(d - 6.5) < line) return at(C.cyan, 3);
    if (d < 6.5) return at(C.navy, 2);
  }
  if (fine) {
    // Agujeritos cada 2 unidades, corridos una fila sí y otra no.
    const gx = x - (Math.floor(y / 2) % 2 ? 1 : 0);
    const hx = gx - Math.floor(gx / 2) * 2 - 1;
    const hy = y - Math.floor(y / 2) * 2 - 1;
    if (hx * hx + hy * hy < 0.09) return at(C.navy, 1);
  }
  // El aire sale más fuerte al medio: la cancha se aclara un poco hacia la línea central.
  return at(C.navy, Math.abs(y - HOCKEY_MID) < L / 4 ? 4 : 3);
}

// ---------- El mueble ----------

/** Costados de la mesa: violeta con una franja de neón abajo. */
const sideShade: Shader = (u, v, _fw, fh) => {
  if (v >= fh - 1) return at(C.neon, 3);
  if (v < 1.2) return at(C.cyan, 3);
  // Estrellitas de neón sueltas sobre el violeta, como el piso del arcade.
  const cell = Math.floor(u / 5);
  if (Math.floor(u) === cell * 5 + 2 && Math.floor(v) === 2 + (cell % 2)) return at(cell % 3 ? C.cyan : C.gold, 4);
  return at(C.violet, Math.floor(u) % 10 === 0 ? 1 : 2);
};

/** Tapa del mueble: la cancha (sin agujeritos), las bocas de los arcos en negro y la banda de metal. */
function tableTop(z: number) {
  const top: Shader = (u, v) => {
    const x = u + 1 - HOCKEY_RINK.u0;
    const y = v + 1 - HOCKEY_RINK.v0;
    const rink = rinkColor(x, y, false);
    if (rink) return rink;
    if ((y < 0 || y >= HOCKEY.length) && x > HOCKEY_GOAL_X0 && x < HOCKEY_GOAL_X1) return x < HOCKEY_GOAL_X0 + 0.8 || x > HOCKEY_GOAL_X1 - 0.8 ? at(C.gold, 4) : at(C.night, 0);
    return at(C.metal, 4);
  };
  return { x: 1, y: 1, z, w: HOCKEY_TABLE.w - 2, d: HOCKEY_TABLE.d - 2, h: 1, top, left: flat(at(C.metal, 3)), right: flat(at(C.metal, 2)) };
}

/** Hockey de mesa: patas de metal, cuerpo violeta con neón, la cancha y el marcador en su poste. */
export function airHockeyTable(): Sprite {
  const { w: TW, d: TD } = HOCKEY_TABLE;
  const z = HOCKEY_TOP_Z - 1;
  const rail = at(C.metal, 5);
  // Bandas de las puntas, cortadas en la boca del arco.
  const gx0 = HOCKEY_RINK.u0 + HOCKEY_GOAL_X0;
  const gx1 = HOCKEY_RINK.u0 + HOCKEY_GOAL_X1;
  const endRail = (y: number) => [
    { x: 1, y, z: z + 1, w: gx0 - 1, d: 1.5, h: 1, top: flat(rail), left: flat(at(C.metal, 3)), right: flat(at(C.metal, 2)) },
    { x: gx1, y, z: z + 1, w: TW - 1 - gx1, d: 1.5, h: 1, top: flat(rail), left: flat(at(C.metal, 3)), right: flat(at(C.metal, 2)) },
  ];
  const sideRail = (x: number) => ({ x, y: 1, z: z + 1, w: 1.5, d: TD - 2, h: 1, top: flat(rail), left: flat(at(C.metal, 3)), right: flat(at(C.metal, 2)) });
  const screen: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(C.neon, 3);
    return at(C.night, 1);
  };
  const b = HOCKEY_BOARD;
  return renderSprite(
    [
      leg(3, 3, z, C.metal),
      leg(TW - 5, 3, z, C.metal),
      leg(3, TD - 5, z, C.metal),
      leg(TW - 5, TD - 5, z, C.metal),
      { x: 1, y: 1, z: z - 5, w: TW - 2, d: TD - 2, h: 5, top: flat(at(C.violet, 2)), left: sideShade, right: sideShade },
      tableTop(z),
      // Atrás: la banda del oeste, la del norte y el marcador sobre su poste.
      sideRail(1),
      ...endRail(1),
      solidBox({ x: b.u, y: b.v - 0.75, z: z + 2, w: 1.5, d: 1.5, h: b.z - 6 - (z + 2) }, C.metal, 3),
      { x: b.u - 0.5, y: b.v - 8, z: b.z - 6, w: 2, d: 16, h: 7, top: flat(at(C.violet, 3)), left: flat(at(C.violet, 2)), right: screen },
      // Adelante: la banda del este y la del sur.
      sideRail(TW - 2.5),
      ...endRail(TD - 2.5),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, TW - 2, TD - 2),
      // Los dos mazos esperando en su lugar y el disco al medio.
      extra: (c, p) => {
        for (const side of [0, 1] as const) {
          const l = rinkToLocal(HOCKEY.width / 2, side === 0 ? 6 : HOCKEY.length - 6);
          const s = p(l.u, l.v, HOCKEY_TOP_Z);
          const r = HOCKEY_SIDE_COLOR[side];
          c.ellipse(s.x, s.y - 0.5, 3.4, 1.8, at(r, 2));
          c.ellipse(s.x, s.y - 1.5, 2.6, 1.3, at(r, 3));
          c.ellipse(s.x, s.y - 2.5, 1.2, 0.8, at(r, 4));
        }
        const m = rinkToLocal(HOCKEY.width / 2, HOCKEY_MID);
        const q = p(m.u, m.v, HOCKEY_TOP_Z);
        c.ellipse(q.x, q.y - 0.3, 2, 1, at(C.gold, 4));
      },
    },
  );
}

// ---------- Modo mesa ----------

/** Lo que encuadra la cámara: la cancha con las bandas y, arriba, el marcador. */
export function hockeyRinkRect(fr: MesaFrame): ScreenBox {
  const pts = [
    localToScreen(fr, 0, 0, HOCKEY_TOP_Z),
    localToScreen(fr, HOCKEY_TABLE.w, 0, HOCKEY_TOP_Z),
    localToScreen(fr, 0, HOCKEY_TABLE.d, HOCKEY_TOP_Z),
    localToScreen(fr, HOCKEY_TABLE.w, HOCKEY_TABLE.d, HOCKEY_TOP_Z),
    localToScreen(fr, HOCKEY_BOARD.u, HOCKEY_BOARD.v, HOCKEY_BOARD.z + 4),
  ];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs) - 1;
  const y = Math.min(...ys) - 1;
  return { x, y, w: Math.max(...xs) + 1 - x, h: Math.max(...ys) + 1 - y };
}

/** La cancha en alta resolución (con los agujeritos de aire): tapa la del mueble. */
export function hockeyRinkOverlay(fr: MesaFrame, R: number): Overlay {
  const { width: W, length: L } = HOCKEY;
  const corners = [rinkToScreen(fr, 0, 0), rinkToScreen(fr, W, 0), rinkToScreen(fr, 0, L), rinkToScreen(fr, W, L)];
  const minX = Math.min(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxX = Math.max(...corners.map((p) => p.x));
  const maxY = Math.max(...corners.map((p) => p.y));
  const sx = Math.floor(minX * R) / R;
  const sy = Math.floor(minY * R) / R;
  const canvas = new PixelCanvas(Math.ceil((maxX - sx) * R) + 1, Math.ceil((maxY - sy) * R) + 1);
  for (let j = 0; j < canvas.height; j++)
    for (let i = 0; i < canvas.width; i++) {
      const p = screenToRink(fr, sx + (i + 0.5) / R, sy + (j + 0.5) / R);
      const col = rinkColor(p.x, p.y, true);
      if (col) canvas.set(i, j, col);
    }
  return { canvas, sx, sy, R };
}

/** Una pieza suelta del modo mesa: el lienzo y el punto (ax, ay) que va sobre su lugar de la cancha. */
export interface HockeyPiece {
  canvas: PixelCanvas;
  ax: number;
  ay: number;
}

/**
 * Cilindro visto en isométrico (radio `r` y alto `h` en unidades de arte) con R puntos por unidad:
 * `top` para la tapa, `side` para el costado y `rim` para el borde de la tapa.
 */
function cylinder(c: PixelCanvas, cx: number, base: number, r: number, h: number, R: number, top: RGBA, side: RGBA, rim: RGBA) {
  const rx = r * Math.SQRT2 * R;
  const ry = (r / Math.SQRT2) * R;
  const lift = h * R;
  // El costado: la elipse de abajo barrida hasta la de arriba.
  for (let k = 0; k <= lift; k++) c.ellipse(cx, base - k, rx, ry, side);
  c.ellipse(cx, base - lift, rx, ry, rim);
  c.ellipse(cx, base - lift, Math.max(0.5, rx - R * 0.5), Math.max(0.5, ry - R * 0.3), top);
}

/** El disco: amarillo neón, chato, con su sombrita. */
export function puckPiece(R: number): HockeyPiece {
  const r = HOCKEY.puckR;
  const w = Math.ceil(r * Math.SQRT2 * R * 2) + 4;
  const h = Math.ceil((r / Math.SQRT2) * R * 2 + 1 * R) + 5;
  const c = new PixelCanvas(w, h);
  const cx = w / 2;
  const base = h - (r / Math.SQRT2) * R - 2;
  cylinder(c, cx, base, r, 0.8, R, at(C.gold, 5), at(C.gold, 2), at(C.gold, 4));
  c.outline(OUT);
  return { canvas: c, ax: cx, ay: base };
}

/**
 * Un mazo: la base ancha y la perilla de arriba, del color de su lado. `mine` = el del jugador local
 * (lleva un anillo claro alrededor, para no perderlo de vista).
 */
export function malletPiece(R: number, side: 0 | 1, mine: boolean): HockeyPiece {
  const r = HOCKEY.malletR;
  const col = HOCKEY_SIDE_COLOR[side];
  const w = Math.ceil(r * Math.SQRT2 * R * 2) + 6;
  const h = Math.ceil((r / Math.SQRT2) * R * 2 + 3.4 * R) + 6;
  const c = new PixelCanvas(w, h);
  const cx = w / 2;
  const base = h - (r / Math.SQRT2) * R - 3;
  if (mine) c.ellipse(cx, base, r * Math.SQRT2 * R + R * 0.6, (r / Math.SQRT2) * R + R * 0.35, alpha(at(C.cream, 5), 0.55));
  cylinder(c, cx, base, r, 1.1, R, at(col, 3), at(col, 1), at(col, 4));
  cylinder(c, cx, base - 1.1 * R, r * 0.42, 2.2, R, at(col, 5), at(col, 2), at(col, 4));
  c.outline(OUT);
  return { canvas: c, ax: cx, ay: base };
}

/**
 * El marcador: un cartel de neón con los goles de cada lado en su color ("3 : 5"). Va derecho en la
 * pantalla (no se inclina con la mesa) para leerse bien, sobre el cartel del mueble.
 */
export function scoreboardPiece(R: number, score: readonly [number, number], blink = -1): HockeyPiece {
  const s = Math.max(1, Math.round(R / 2));
  const a = String(score[0]);
  const b = String(score[1]);
  const gap = 4 * s;
  const colon = textWidth(":", { scale: s });
  const wa = textWidth(a, { scale: s });
  const wb = textWidth(b, { scale: s });
  const w = wa + wb + colon + gap * 2 + 8 * s;
  const h = GLYPH_H * s + 6 * s;
  const c = new PixelCanvas(w + 2, h + 2);
  c.rect(1, 1, w, h, at(C.night, 0));
  for (let x = 1; x <= w; x++) for (let k = 0; k < s; k++) {
    c.set(x, 1 + k, at(C.neon, 3));
    c.set(x, h - k, at(C.neon, 2));
  }
  for (let y = 1; y <= h; y++) for (let k = 0; k < s; k++) {
    c.set(1 + k, y, at(C.neon, 3));
    c.set(w - k, y, at(C.neon, 2));
  }
  const cy = 1 + h / 2;
  const x0 = 1 + 4 * s;
  const color = (side: 0 | 1) => (blink === side ? at(C.cream, 5) : at(HOCKEY_SIDE_COLOR[side], 4));
  drawTextCentered(c, a, x0 + wa / 2, cy, color(0), { scale: s });
  drawTextCentered(c, ":", x0 + wa + gap + colon / 2, cy, at(C.cream, 4), { scale: s });
  drawTextCentered(c, b, x0 + wa + gap * 2 + colon + wb / 2, cy, color(1), { scale: s });
  c.outline(OUT);
  // El punto de apoyo es el medio de abajo del cartel.
  return { canvas: c, ax: (w + 2) / 2, ay: h + 2 };
}

/** Un cartel grande sobre la cancha ("3", "GOL!", "GANASTE"), con borde del color que se pida. */
export function hockeyBanner(text: string, R: number, ramp: Ramp = C.gold): HockeyPiece {
  const s = Math.max(2, Math.round(R * 0.75));
  const w = textWidth(text, { scale: s }) + 6 * s;
  const h = GLYPH_H * s + 4 * s;
  const c = new PixelCanvas(w + 2, h + 2);
  c.rect(1, 1, w, h, alpha(at(C.night, 0), 0.85));
  drawTextCentered(c, text, 1 + w / 2, 1 + h / 2, at(ramp, 4), { scale: s, outline: at(ramp, 1) });
  c.outline(OUT);
  return { canvas: c, ax: (w + 2) / 2, ay: (h + 2) / 2 };
}

/** Punto del lienzo de un dibujo del modo mesa (para pruebas y para pegar piezas en un PNG). */
export const rinkCanvasPoint = (ov: Overlay, fr: MesaFrame, x: number, y: number) => toCanvas(ov, rinkToScreen(fr, x, y));
