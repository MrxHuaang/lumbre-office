// Muebles del casino del sótano: la ruleta (paño de 3x4 y la rueda aparte, de 2x2), el blackjack, la
// caja, tragamonedas y decoración. Paleta común: paño verde, caoba, cuero burdeos y bronce. La
// geometría de las mesas está en casino-layout.ts: el modo mesa (casino-mesa.ts) dibuja encima.
import { colorOf, WHEEL_ORDER } from "@hyvento/shared";
import {
  BLACKJACK_ARC,
  BLACKJACK_DISCARD,
  BLACKJACK_SHAPE,
  BLACKJACK_SHOE,
  BLACKJACK_SPOTS,
  BLACKJACK_TOP_Z,
  BLACKJACK_TRAY,
  ROULETTE_FELT,
  ROULETTE_TOP_Z,
  WHEEL_CENTER,
  WHEEL_R,
  WHEEL_TOP_Z,
  blackjackEdge,
  blackjackInset,
  insideCell,
  rouletteCellAt,
  type CellFill,
} from "./casino-layout";
import { C, OUT } from "./palette";
import { alpha, at, bayer, flat, noise, ramp, renderSprite, solidBox, type Box, type PixelCanvas, type Project, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { leg, roundShadow, shadowUnder, volume } from "./kit";

const RED = C.rug;
const FELT = C.green;
/** Negro de las casillas y los casilleros: casi negro, tirando a ciruela como las sombras de la paleta. */
export const INK: Ramp = ramp("#140f18", "#1f1824", "#2b2331", "#3d3445", "#554a5e", "#776b80");
/** Rampa de cada color de la ruleta. */
export const POCKET_RAMP: Record<Exclude<CellFill, "felt">, Ramp> = { red: RED, black: INK, green: FELT };

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
export function felt(u: number, v: number): RGBA {
  return at(FELT, noise(Math.floor(u), Math.floor(v), 41) < 0.035 ? 2 : 3);
}

function woodSide(u: number, v: number, _fw: number, fh: number): RGBA {
  if (v >= fh - 1) return at(C.woodDark, 4);
  if (v < 1) return at(C.woodDark, 1);
  return at(C.woodDark, Math.floor(u) % 7 === 0 ? 2 : 3);
}

// ---------- Formas redondas (se pintan píxel a píxel invirtiendo la proyección) ----------

/**
 * Pinta un plano horizontal a la altura `z` entre (x0, y0) y (x1, y1): cada píxel toma el color del
 * punto del mundo que cae ahí (`shade` puede devolver null para dejarlo como está).
 */
export function paintPlane(c: PixelCanvas, p: Project, z: number, x0: number, y0: number, x1: number, y1: number, shade: (x: number, y: number) => RGBA | null) {
  const o = p(0, 0, 0);
  const pts = [p(x0, y0, z), p(x1, y0, z), p(x0, y1, z), p(x1, y1, z)];
  const minX = Math.floor(Math.min(...pts.map((q) => q.x)));
  const maxX = Math.ceil(Math.max(...pts.map((q) => q.x)));
  const minY = Math.floor(Math.min(...pts.map((q) => q.y)));
  const maxY = Math.ceil(Math.max(...pts.map((q) => q.y)));
  for (let py = minY; py <= maxY; py++)
    for (let px = minX; px <= maxX; px++) {
      const sx = px + 0.5 - o.x;
      const sy = py + 0.5 - o.y;
      const X = sy + z + sx / 2;
      const Y = sy + z - sx / 2;
      if (X < x0 || X >= x1 || Y < y0 || Y >= y1) continue;
      const col = shade(X, Y);
      if (col) c.set(px, py, col);
    }
}

/**
 * Pinta el costado visible de un cilindro vertical de radio `r` centrado en (cx, cy), de z0 a z1.
 * `shade` recibe el ángulo del punto (0 = +x, π/2 = +y) y la altura desde z0.
 */
export function paintCylinder(c: PixelCanvas, p: Project, cx: number, cy: number, r: number, z0: number, z1: number, shade: (a: number, h: number) => RGBA | null) {
  const o = p(0, 0, 0);
  const top = p(cx, cy, z1);
  const bottom = p(cx, cy, z0);
  for (let py = Math.floor(top.y - r) - 1; py <= Math.ceil(bottom.y + r) + 1; py++)
    for (let px = Math.floor(top.x - r * 1.42) - 1; px <= Math.ceil(top.x + r * 1.42) + 1; px++) {
      const k = (px + 0.5 - o.x - (cx - cy)) / r;
      if (Math.abs(k) >= Math.SQRT2) continue;
      const s = Math.sqrt(2 - k * k);
      const z = (cx + cy) / 2 + (r * s) / 2 - (py + 0.5 - o.y);
      if (z < z0 || z >= z1) continue;
      const col = shade(Math.atan2((s - k) / 2, (k + s) / 2), z - z0);
      if (col) c.set(px, py, col);
    }
}

/** Tono de un costado redondo con la luz de la paleta: lo que mira a +y es más claro que lo que mira a +x. */
const sideTone = (a: number, base: number) => base + (Math.sin(a) - Math.cos(a)) * 0.6;

// ---------- Ruleta: el paño ----------

/** Fieltro del paño con la grilla de apuestas: casillas rojas y negras, el cero verde y líneas crema. */
export function rouletteFeltColor(u: number, v: number): RGBA {
  const { u0, v0, u1, v1 } = ROULETTE_FELT;
  // Filete dorado alrededor de toda la grilla.
  const e = Math.min(u - u0, v - v0, u1 - u, v1 - v);
  if (e >= 0.4 && e < 0.9) return at(C.gold, 3);
  const cell = rouletteCellAt(u, v);
  if (cell) {
    // Borde de la casilla (en el cero, también la diagonal de las puntas).
    const b = 0.3;
    if (!insideCell(cell, u - b, v) || !insideCell(cell, u + b, v) || !insideCell(cell, u, v - b) || !insideCell(cell, u, v + b)) return at(C.cream, 3);
    if (cell.shape === "diamond") {
      const cu = (cell.u0 + cell.u1) / 2;
      const cv = (cell.v0 + cell.v1) / 2;
      const d = Math.abs(u - cu) / ((cell.u1 - cell.u0) * 0.24) + Math.abs(v - cv) / ((cell.v1 - cell.v0) * 0.44);
      if (d <= 1) return at(POCKET_RAMP[cell.fill as "red" | "black"], d > 0.8 ? 1 : 3);
      return felt(u, v);
    }
    if (cell.fill === "felt") return felt(u, v);
    // El cero, verde más hondo que el paño para que se distinga.
    const r = POCKET_RAMP[cell.fill];
    return at(r, cell.fill === "red" ? 2 : 1);
  }
  return felt(u, v);
}

/** Cojín de cuero del borde: redondeado (oscuro en las orillas, brillo al centro) y con costura. */
function railShader(along: "u" | "v"): Shader {
  return (u, v, fw, fh) => {
    const t = along === "u" ? v / fh : u / fw;
    if (t < 0.16 || t > 0.84) return at(RED, 1);
    return at(RED, t < 0.42 ? 3 : 2);
  };
}

/** Faldón de caoba con paneles tallados y un filete de bronce arriba. */
const apron: Shader = (u, v, fw, fh) => {
  if (v >= fh - 1) return at(C.gold, 3);
  if (v < 0.8) return at(C.wood, 1);
  const k = u % 12;
  if (k < 1 || u < 1.5 || u > fw - 1.5) return at(C.wood, 2);
  if (k < 1.8 || v < 1.6 || v > fh - 2) return at(C.wood, 4);
  return at(C.wood, 3);
};

/** Pata torneada: bulbo al medio y pie de bronce. */
function turnedLeg(x: number, y: number, h: number): Box[] {
  return [
    solidBox({ x: x - 0.5, y: y - 0.5, z: 0, w: 3, d: 3, h: 1 }, C.gold, 3),
    solidBox({ x, y, z: 1, w: 2, d: 2, h: h - 1 }, C.wood, 3),
    solidBox({ x: x - 0.4, y: y - 0.4, z: h * 0.45, w: 2.8, d: 2.8, h: 2 }, C.wood, 4),
  ];
}

/** Paño de la ruleta (3x4 tiles; la rueda es un mueble aparte, "roulette-wheel"). */
function rouletteTable(): Sprite {
  const W = 48;
  const D = 64;
  const z = ROULETTE_TOP_Z;
  const { u0, v0, u1, v1 } = ROULETTE_FELT;
  const slab: Shader = (_u, v, _fw, fh) => (v >= fh - 1 ? at(C.gold, 4) : at(C.wood, 2));
  const railTop = (x: number, y: number, w: number, d: number, along: "u" | "v"): Box => ({
    x,
    y,
    z: z - 1,
    w,
    d,
    h: 2.2,
    top: railShader(along),
    left: (_u, v, _fw, fh) => at(RED, v > fh - 0.8 ? 3 : 1),
    right: (_u, v, _fw, fh) => at(RED, v > fh - 0.8 ? 2 : 1),
  });
  return renderSprite(
    [
      ...turnedLeg(4, 4, 9),
      ...turnedLeg(W - 6, 4, 9),
      ...turnedLeg(4, D - 6, 9),
      ...turnedLeg(W - 6, D - 6, 9),
      { x: 2.5, y: 2.5, z: 9, w: W - 5, d: D - 5, h: 3, top: flat(at(C.wood, 2)), left: apron, right: apron },
      { x: 1, y: 1, z: 12, w: W - 2, d: D - 2, h: 1.2, top: flat(at(C.wood, 3)), left: slab, right: slab },
      // Cojines de atrás, el paño y los de adelante (en ese orden, para que se tapen bien).
      railTop(1, 1, W - 2, v0 - 1, "u"),
      railTop(1, v0, u0 - 1, v1 - v0, "v"),
      { x: u0, y: v0, z: z - 1, w: u1 - u0, d: v1 - v0, h: 1, top: (u, v) => rouletteFeltColor(u + u0, v + v0) },
      railTop(u1, v0, W - 1 - u1, v1 - v0, "v"),
      railTop(1, v1, W - 2, D - 1 - v1, "u"),
    ],
    { outline: OUT, under: shadowUnder(1, 1, W - 2, D - 2) },
  );
}

// ---------- Ruleta: la rueda ----------

const SECTOR = (Math.PI * 2) / WHEEL_ORDER.length;
/** Deflectores de bronce en la pista (fijos, no giran). */
const DEFLECTORS = 8;

/** Ángulo (0..2π) normalizado. */
const wrap = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

/** Número del casillero en el ángulo `a` (vista de arriba) con la rueda girada `spin`. */
export function pocketAt(a: number, spin: number): { n: number; f: number } {
  const x = wrap(a - spin) / SECTOR;
  const i = Math.floor(x) % WHEEL_ORDER.length;
  return { n: WHEEL_ORDER[i]!, f: x - Math.floor(x) };
}

/** Ángulo del centro del casillero de `n` (con la rueda sin girar). */
export const pocketAngle = (n: number) => (WHEEL_ORDER.indexOf(n) + 0.5) * SECTOR;

const pocketColor = (n: number): Exclude<CellFill, "felt"> => colorOf(n);

/**
 * Color del plato de la rueda en el punto (r, a) de la vista de arriba (a = ángulo, 0 = +x), con la
 * parte que gira rotada `spin`. Lo usan el mueble y el modo mesa (que además escribe los números).
 * `px` = tamaño de un píxel en unidades de arte (los detalles finos se ajustan a la resolución).
 */
export function wheelColor(r: number, a: number, spin: number, px = 1): RGBA | null {
  const R = WHEEL_R;
  // A la escala del mueble los aros finos se juntan (si no, quedan puntos sueltos); en el modo mesa,
  // con píxeles más chicos, aparecen los deflectores, los trastes y los brillos.
  const fine = px < 0.6;
  if (r > R.rim) return null;
  if (r > R.rim - Math.max(0.5, px * 0.9)) return at(C.gold, 3 + Math.round(Math.cos(a - 2.36) * 0.8));
  if (r > R.lip) return at(C.woodDark, 3 + Math.round(Math.cos(a - 2.36) * 0.7));
  if (r > R.track) {
    // Pista de la bola: madera oscura pulida, con un brillo del lado de la luz.
    if (fine && r > R.lip - 0.3) return at(C.gold, 2);
    const shine = fine && Math.cos(a + 0.78) > 0.8 && Math.abs(r - (R.track + R.lip) / 2) < 0.2;
    return at(C.woodDark, shine ? 4 : 2);
  }
  if (r > R.head) {
    // Zona de los deflectores (rombos de bronce fijos).
    if (fine) {
      const step = (Math.PI * 2) / DEFLECTORS;
      const f = wrap(a + step / 2) % step;
      const d = (Math.abs(f - step / 2) * r) / 0.9 + Math.abs(r - (R.track + R.head) / 2) / ((R.track - R.head) / 2);
      if (d < 1) return at(C.gold, d < 0.45 ? 5 : 3);
    }
    return at(C.woodDark, 1);
  }
  if (r > R.numbers) return fine ? at(C.gold, r > R.head - 0.15 ? 2 : 4) : at(C.woodDark, 1);
  const { n, f } = pocketAt(a, spin);
  const color = pocketColor(n);
  const fret = Math.min(0.24, (0.3 * px) / (r * SECTOR));
  const onFret = fine && (f < fret / 2 || f > 1 - fret / 2);
  if (r > R.pockets) {
    // Aro de los números: color del número, con separadores de bronce finos.
    if (onFret) return at(C.gold, 3);
    return at(POCKET_RAMP[color], color === "black" ? 2 : color === "red" ? 2 : 3);
  }
  if (r > R.cone) {
    // Casilleros: el mismo color más oscuro (están hundidos) y trastes de bronce.
    if (fine && r > R.pockets - 0.3) return at(C.gold, 2);
    if (onFret) return at(C.gold, 4);
    const deep = (R.pockets - r) / (R.pockets - R.cone);
    return at(POCKET_RAMP[color], (color === "black" ? 1 : color === "red" ? 1 : 2) - (deep > 0.6 ? 1 : 0));
  }
  if (r > R.turret) {
    // Cono de madera clara con los cuatro brazos de la torreta (giran con la rueda).
    if (fine && r > R.cone - 0.3) return at(C.gold, 2);
    const arm = wrap(a - spin) % (Math.PI / 2);
    const armW = 0.45 / r;
    if (arm < armW || arm > Math.PI / 2 - armW) return at(C.gold, 4);
    const grain = fine && noise(Math.floor(r * 3), Math.floor(wrap(a - spin) * 40), 13) < 0.12 ? -1 : 0;
    // Más oscuro hacia afuera (baja hacia los casilleros) y con brillo del lado de la luz.
    return at(fine ? C.wood : C.woodDark, (fine ? 2.5 : 3) + (1 - (r - R.turret) / (R.cone - R.turret)) + Math.round(Math.cos(a - 2.36) * 0.8) + grain);
  }
  return at(C.gold, r < R.turret * 0.55 ? 5 : 3);
}

/** Rueda de la ruleta sobre su pedestal (2x2): cuenco de caoba, plato con los 37 casilleros y torreta. */
function rouletteWheel(): Sprite {
  const { u: cx, v: cy } = WHEEL_CENTER;
  const z = WHEEL_TOP_Z;
  const fluted: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.gold, 3);
    if (v < 1) return at(C.gold, 2);
    return at(C.wood, Math.floor(u) % 3 === 0 ? 2 : 3);
  };
  return renderSprite(
    [
      { x: 6, y: 6, z: 0, w: 20, d: 20, h: 2, top: flat(at(C.woodDark, 3)), left: (_u, v, _f, fh) => at(v > fh - 0.8 ? C.gold : C.woodDark, v > fh - 0.8 ? 3 : 2), right: (_u, v, _f, fh) => at(v > fh - 0.8 ? C.gold : C.woodDark, v > fh - 0.8 ? 2 : 1) },
      { x: 10, y: 10, z: 2, w: 12, d: 12, h: z - 6, left: fluted, right: fluted, top: flat(at(C.wood, 3)) },
      volume(cx - WHEEL_R.rim, cy - WHEEL_R.rim, 0, WHEEL_R.rim * 2, WHEEL_R.rim * 2, z + 4),
    ],
    {
      outline: OUT,
      under: roundShadow(cx, cy, 13),
      extra: (c, p) => {
        // Cuenco: costado de caoba con un aro de bronce arriba y otro abajo.
        paintCylinder(c, p, cx, cy, WHEEL_R.rim, z - 4, z, (a, h) => {
          if (h > 3.3) return at(C.gold, sideTone(a, 3));
          if (h < 0.6) return at(C.gold, sideTone(a, 2));
          const grain = noise(Math.floor(a * 18), Math.floor(h), 5) < 0.12 ? -1 : 0;
          return at(C.wood, sideTone(a, 2.6) + grain);
        });
        paintPlane(c, p, z, cx - WHEEL_R.rim, cy - WHEEL_R.rim, cx + WHEEL_R.rim, cy + WHEEL_R.rim, (x, y) => wheelColor(Math.hypot(x - cx, y - cy), Math.atan2(y - cy, x - cx), 0.3));
        // Torreta al centro: columnita y perilla de bronce.
        paintCylinder(c, p, cx, cy, 0.9, z, z + 2, (a) => at(C.gold, sideTone(a, 3)));
        const knob = p(cx, cy, z + 2);
        c.set(knob.x - 1, knob.y - 1, at(C.gold, 4));
        c.set(knob.x, knob.y - 1, at(C.gold, 5));
      },
    },
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

// ---------- Blackjack ----------

/**
 * Bandeja de fichas del crupier, hundida junto al lado recto: marco de caoba y siete canales con fichas
 * paradas de canto (las rayas son los cantos).
 */
function trayColor(u: number, v: number): RGBA | null {
  const { u0, u1, v0, v1 } = BLACKJACK_TRAY;
  if (u < u0 || u >= u1 || v < v0 || v >= v1) return null;
  if (u < u0 + 0.5 || u >= u1 - 0.5 || v < v0 + 0.5 || v >= v1 - 0.5) return at(C.wood, u < u0 + 0.5 || v < v0 + 0.5 ? 2 : 4);
  const k = (v - v0 - 0.5) / 2;
  if (k - Math.floor(k) < 0.18) return at(C.wood, 1);
  const chip = TRAY_CHIPS[Math.floor(k) % TRAY_CHIPS.length]!;
  const edge = (u - u0) % 0.7 < 0.18;
  return at(chip, edge ? 1 : u > u1 - 1.6 ? 4 : 3);
}
const TRAY_CHIPS: Ramp[] = [C.cream, RED, C.blue, FELT, INK, RED, C.blue];

/** Fieltro del blackjack con el cojín del borde, los círculos de apuesta y el arco del texto. */
export function blackjackFeltColor(u: number, v: number, text = true): RGBA | null {
  const d = blackjackInset(u, v);
  if (d < 0) return null;
  const tray = trayColor(u, v);
  if (tray) return tray;
  // Lado del crupier: canto de caoba con filete de bronce.
  if (u < BLACKJACK_SHAPE.u0 + 1.6) return u < BLACKJACK_SHAPE.u0 + 0.5 ? at(C.gold, 3) : at(C.wood, 3);
  if (d < 2.8 && u > BLACKJACK_SHAPE.u0 + 1.6) {
    if (d < 0.5) return at(RED, 1);
    if (d > 2.3) return at(RED, 1);
    if (Math.abs(d - 1.4) < 0.2 && noise(Math.floor(u * 2), Math.floor(v * 2), 3) < 0.6) return at(RED, 4);
    return at(RED, d > 1.4 ? 2 : 3);
  }
  for (const s of BLACKJACK_SPOTS) {
    const r = Math.hypot(u - s.u, v - s.v);
    if (r < 2.9 && r >= 2.25) return at(C.gold, 4);
    if (r < 2.25) return at(FELT, 2);
  }
  const { u: au, v: av, r0, r1 } = BLACKJACK_ARC;
  const ra = Math.hypot(u - au, v - av);
  if (Math.abs(ra - r0) < 0.3 || Math.abs(ra - r1) < 0.3) return at(C.gold, 3);
  // Entre las dos líneas va el texto; a la escala del mueble, un punteado crema que lo sugiere.
  const ang0 = Math.atan2(v - av, u - au) - Math.PI / 4;
  if (text && ra > r0 + 1.4 && ra < r1 - 1.4 && Math.abs(ang0) < 0.55) {
    const ang = Math.atan2(v - av, u - au);
    const k = Math.floor((ang + Math.PI) * 26);
    if (k % 4 !== 3 && noise(k, Math.floor(ra * 2), 21) < 0.55) return at(C.cream, 4);
  }
  return felt(u, v);
}

function blackjackTable(): Sprite {
  const { u0, v0, v1 } = BLACKJACK_SHAPE;
  const z = BLACKJACK_TOP_Z;
  // La mesa en D se arma con tajadas de 1 de ancho a lo largo de v: sus caras +x dibujan la curva.
  const slices: Box[] = [];
  for (let v = v0; v < v1; v++) {
    const edge = Math.min(blackjackEdge(v), blackjackEdge(v + 1));
    slices.push({ x: u0 + 1.5, y: v + 0.2, z: 9, w: edge - u0 - 3, d: 0.8, h: 3, left: apron, right: apron });
  }
  for (let v = v0; v < v1; v++) {
    const edge = Math.min(blackjackEdge(v + 0.5), 99);
    const vv = v;
    slices.push({
      x: u0,
      y: v,
      z: z - 2,
      w: edge - u0,
      d: 1,
      h: 2,
      top: (u, dv) => blackjackFeltColor(u + u0, dv + vv) ?? at(RED, 1),
      left: (_u, h, _fw, fh) => at(RED, h > fh - 0.8 ? 2 : 1),
      right: (_u, h, _fw, fh) => (h < 0.7 ? at(C.gold, 2) : at(RED, h > fh - 0.8 ? 3 : 1)),
    });
  }
  const { u: su, v: sv } = BLACKJACK_SHOE;
  return renderSprite(
    [
      ...turnedLeg(4, 6, 9),
      ...turnedLeg(4, 40, 9),
      ...turnedLeg(20, 11, 9),
      ...turnedLeg(20, 35, 9),
      ...slices,
      // Sabot: caja de madera con frente de acrílico rojo y la carta asomada.
      { x: su - 2, y: sv - 3, z, w: 4.5, d: 6, h: 3, top: (u, v) => (u > 1 && u < 3.5 && v > 1 && v < 5 ? at(C.cream, 5) : at(C.woodDark, 3)), left: flat(at(C.woodDark, 2)), right: (u, v) => (v > 2.3 ? at(RED, 3) : at(C.woodDark, 2)) },
      solidBox({ x: su + 2.3, y: sv - 1.2, z, w: 1, d: 2.4, h: 1.8 }, C.cream, 4),
      // Descarte: un mazo de cartas usadas de dorso rojo.
      { x: BLACKJACK_DISCARD.u - 1.5, y: BLACKJACK_DISCARD.v - 2, z, w: 3, d: 4, h: 1.5, top: flat(at(RED, 3)), left: (_u, v) => at(C.cream, Math.floor(v * 2) % 2 ? 3 : 5), right: (_u, v) => at(C.cream, Math.floor(v * 2) % 2 ? 2 : 4) },
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
      // Bombillos en el borde, uno sí y uno no: apagados (se prenden cuando alguien baila, club-vivo.ts).
      const a = Math.atan2(v + 0.5 - fh / 2, u + 0.5 - fw / 2);
      return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 28) % 2 ? at(C.gold, 2) : at(C.woodDark, 1);
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
