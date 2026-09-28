// La parada del bus del jardín (world/areas/parada.ts): la plataforma de la "Estación Hyvento" (plana,
// debajo de todos), la estación de vidrio con postes verde lima, techo gris con el letrero y la pantalla
// de "Próximo bus", las puertas de vidrio (capa aparte: se abren cuando llega el bus) y el bus articulado
// como los del Megabús de Pereira: verde lima de punta a punta, vidrios casi negros, fuelle gris, faldón y
// parachoques negros, "MEGABUS" en blanco al costado y el letrero de ruta en la frente. El bus no es un
// mueble: lo arma el cliente con `busCarSprite` y `busJointSprite` (ver apps/web/src/game/bus.ts).
// Unidades de arte (tile = 16). Todo con la escena de z-buffer de los dibujos grandes de afuera.
import { BUS } from "@hyvento/shared";
import { BUS_DOOR_X, BUS_STOP, STATION, TURNSTILES } from "../world/areas/parada";
import { BLACK, GREY, HANDRAIL, LED, LIME, TINT } from "./bus-colores";
import { textMask } from "./digits";
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { alpha, at, bayer, noise, type RGBA, type Sprite } from "./pixel";

const L = 16;

// ---------- La estación ----------

/** La pieza de la estación empieza 3 tiles al oeste y 2 al norte de la plataforma (ver catalog-bus.ts). */
const PX = 3 * L;
const PY = 2 * L;
const SW = STATION.w * L;
const SD = STATION.d * L;
/** Vidrio del norte (en y) y del sur (pegado al cordón), las puntas (en x) y la altura hasta el techo. */
const NORTH_Y = 8;
const SOUTH_Y = SD - 2;
const END_X0 = 8;
const END_X1 = SW - 8;
const GLASS_TOP = 42;
const ROOF = { z0: 42, z1: 51 };
/** El hueco de los torniquetes en el vidrio del norte. */
const GATE = { x0: (TURNSTILES[0] - STATION.x) * L, x1: (TURNSTILES[1] + 1 - STATION.x) * L };
/** Centro (x, en la plataforma) de cada puerta de vidrio: enfrente de las del bus parado. */
export const STATION_DOORS = BUS_DOOR_X.map((x) => (x - STATION.x) * L);
const DOOR_W = 20;
/** La pantalla colgada del alero, sobre el borde de la plataforma, mirando a la calle (el bus la tapa al parar). */
const SCREEN = { x0: 113, x1: 163, y: 50, z0: 18, z1: 36 };

const glassTone = (night: boolean, u: number, v: number): RGBA => {
  if (Math.abs(((u + v * 0.9) % 46) - 23) < 1.3) return night ? alpha(at(C.gold, 5), 0.55) : alpha(at(C.white, 4), 0.55);
  return night ? alpha(mix(at(C.sky, 1), at(C.gold, 3), 0.45), 0.34) : alpha(at(C.sky, 3), 0.3);
};

/** Letras de 5x7 sobre una cara: ¿está prendido el punto (u, v) (v hacia arriba) del texto que empieza en u0, con la base en v0? */
function letterOn(text: string, u: number, v: number, u0: number, v0: number): boolean {
  const m = textMask(text, 1);
  return m.on(Math.floor(u - u0), Math.floor(v0 + m.h - v));
}

/** Plataforma (plana): baldosas de barro, la franja amarilla de alerta junto al borde y los torniquetes. */
function busPlatform(): Sprite {
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: SW + 4, y1: SD + 4, z1: 20 }, 2);
  s.borde = false;
  s.quad([0, 2, 0.1], [1, 0, 0], [0, 1, 0], SW, SD - 2, (u, v) => {
    const x = Math.floor(u);
    const y = Math.floor(v + 2);
    if (y >= SD - 7 && y < SD - 3) return (x + y) % 3 === 0 ? at(C.mustard, 2) : at(C.mustard, 3);
    if (y >= SD - 2) return at(C.cream, 3);
    if (x % 16 === 0 || y % 16 === 0) return at(C.terracotta, 1);
    const n = noise(Math.floor(x / 16), Math.floor(y / 16), 71);
    return at(C.terracotta, n < 0.3 ? 2 : n < 0.85 ? 3 : 4);
  });
  s.borde = true;
  // Torniquetes: tres gabinetes con el validador (pantallita verde) y los brazos de acero entre ellos.
  for (const gx of [GATE.x0 - 1, (GATE.x0 + GATE.x1) / 2 - 1.5, GATE.x1 - 2]) {
    s.solid(gx, 2, 0, 3, 12, 13, at(LIME, 4), at(LIME, 2), at(LIME, 3));
    s.solid(gx, 3, 13, 3, 5, 2, at(GREY, 4), at(GREY, 2), at(GREY, 3));
    s.quad([gx, 8, 13.5], [1, 0, 0], [0, 1, 0], 3, 3, () => at(C.sage, 5));
  }
  for (const ax of [GATE.x0 + 2, (GATE.x0 + GATE.x1) / 2 + 1.5])
    for (const [dy, dz] of [
      [0, 0],
      [-2.5, 2.5],
      [2.5, 2.5],
    ] as const)
      s.solid(ax, 7.5 + dy, 9 + dz, 10, 1, 1, at(GREY, 5), at(GREY, 3), at(GREY, 4));
  s.shadow(GATE.x0, 2, GATE.x1 - GATE.x0, 12, 0.18);
  return s.sprite();
}

/** Postes de la estación (en x): los del sur esquivan las puertas y los del norte enmarcan los torniquetes. */
const SOUTH_POSTS = [END_X0, 76, 138, 206, 262, END_X1];
const NORTH_POSTS = [END_X0, 76, GATE.x0 - 3, GATE.x1, 206, 262, END_X1];

/**
 * La estación: vidrio a los cuatro lados (con el hueco de los torniquetes al norte y las puertas al sur),
 * postes y marcos verde lima, el techo gris de lámina con el letrero "ESTACION HYVENTO" en el alero, la
 * pantalla de "PROXIMO BUS" y el mapa de la ruta. De noche, el vidrio y los letreros se encienden.
 */
export function drawBusStation(night: boolean): Sprite {
  const s = new Escena({ x0: -4, y0: -8, z0: -2, x1: PX + SW + 10, y1: PY + SD + 10, z1: ROOF.z1 + 4 }, 2);
  const X = (x: number) => PX + x;
  const Y = (y: number) => PY + y;
  // Zócalo lima del vidrio (norte, sur y puntas).
  const kick = (x0: number, x1: number, y: number) => s.solid(X(x0), Y(y) - 1, 0, x1 - x0, 2, 3, at(LIME, 4), at(LIME, 2), at(LIME, 3));
  kick(END_X0, GATE.x0, NORTH_Y);
  kick(GATE.x1, END_X1, NORTH_Y);
  for (const x of [END_X0, END_X1]) s.solid(X(x) - 1, Y(NORTH_Y), 0, 2, SOUTH_Y - NORTH_Y, 3, at(LIME, 4), at(LIME, 2), at(LIME, 3));
  const doorSpans = STATION_DOORS.map((c) => [c - DOOR_W / 2, c + DOOR_W / 2] as const);
  let from = END_X0;
  for (const [a, b] of doorSpans.slice().sort((p, q) => p[0] - q[0])) {
    kick(from, a, SOUTH_Y);
    from = b;
  }
  kick(from, END_X1, SOUTH_Y);
  // Postes.
  for (const x of NORTH_POSTS) s.solid(X(x) - 1.5, Y(NORTH_Y) - 1.5, 0, 3, 3, ROOF.z0, at(LIME, 5), at(LIME, 3), at(LIME, 4));
  for (const x of SOUTH_POSTS) s.solid(X(x) - 1.5, Y(SOUTH_Y) - 1.5, 0, 3, 3, ROOF.z0, at(LIME, 5), at(LIME, 3), at(LIME, 4));
  // Marcos de las puertas (negros, como los del bus) y su luz de aviso arriba.
  for (const [a, b] of doorSpans) {
    for (const x of [a, b - 1.5]) s.solid(X(x), Y(SOUTH_Y) - 1, 0, 1.5, 2, GLASS_TOP, at(BLACK, 3), at(BLACK, 1), at(BLACK, 2));
    s.solid(X(a), Y(SOUTH_Y) - 1, GLASS_TOP - 3, b - a, 2, 3, at(BLACK, 3), at(BLACK, 1), at(BLACK, 2));
    s.quad([X((a + b) / 2 - 2), Y(SOUTH_Y) + 1.05, GLASS_TOP - 2.5], [1, 0, 0], [0, 0, 1], 4, 2, () => (night ? at(C.gold, 5) : at(C.fire, 3)));
  }
  // Dintel sobre los torniquetes.
  s.solid(X(GATE.x0) - 3, Y(NORTH_Y) - 1, GLASS_TOP - 4, GATE.x1 - GATE.x0 + 3, 2, 4, at(LIME, 5), at(LIME, 3), at(LIME, 4));

  // Mapa de la ruta en el vidrio del norte, por dentro: la línea lima con las paradas.
  s.quad([X(24), Y(NORTH_Y) + 1.2, 10], [1, 0, 0], [0, 0, 1], 42, 20, (u, v) => {
    if (u < 1 || u > 41 || v < 1 || v > 19) return at(GREY, 1);
    const line = 10 + Math.sin(u * 0.18) * 4;
    if (Math.abs(v - line) < 1) return at(LIME, 3);
    if (Math.abs(v - line) < 2.2 && Math.floor(u) % 8 === 4) return at(C.white, 4);
    return at(C.cream, 4);
  });

  // La pantalla colgada del techo: marco negro, "PROXIMO BUS" en ámbar arriba y el renglón de abajo apagado
  // (lo pinta el cliente con `busScreenText`).
  for (const x of [SCREEN.x0 + 4, SCREEN.x1 - 5]) s.solid(X(x), Y(SCREEN.y) - 1, SCREEN.z1, 1, 1, ROOF.z0 - SCREEN.z1, at(GREY, 4), at(GREY, 2), at(GREY, 3));
  s.box(X(SCREEN.x0), Y(SCREEN.y) - 2, SCREEN.z0, SCREEN.x1 - SCREEN.x0, 2, SCREEN.z1 - SCREEN.z0, () => at(BLACK, 3), (u, v) => screenFace(u, v, night, "PROXIMO"), () => at(BLACK, 2));

  // Techo: lámina gris con nervios y el alero verde lima con el letrero en blanco.
  const sign = "ESTACION HYVENTO";
  s.box(
    X(-6),
    Y(-6),
    ROOF.z0,
    SW + 12,
    SD + 12,
    ROOF.z1 - ROOF.z0,
    (u, v) => (Math.floor(u) % 10 === 0 ? at(GREY, 5) : at(GREY, bayer(Math.floor(u), Math.floor(v)) < 0.1 ? 3 : 4)),
    (u, v) => {
      if (v < 0.8 || v > ROOF.z1 - ROOF.z0 - 0.8) return at(LIME, 2);
      if (letterOn(sign, u, v, 16, 1)) return night ? at(C.cream, 5) : at(C.white, 4);
      return at(LIME, night ? 3 : 4);
    },
    (_u, v) => at(LIME, v < 0.8 ? 1 : 3),
  );
  // Luces bajo el alero (se ven por su canto).
  for (let x = 20; x < SW - 10; x += 40) s.quad([X(x), Y(SD + 5.9), ROOF.z0 - 1], [1, 0, 0], [0, 0, 1], 10, 1, () => (night ? at(C.gold, 5) : at(GREY, 3)));

  // Vidrio al final (translúcido: se mezcla una vez sobre lo de atrás).
  s.borde = false;
  const pane = (o: [number, number, number], du: [number, number, number], len: number) =>
    s.quad(o, du, [0, 0, 1], len, GLASS_TOP - 3, (u, v) => (Math.floor(u) % 24 === 12 ? alpha(at(LIME, 4), 0.85) : v > 13 && v < 14.2 ? alpha(at(GREY, 4), 0.8) : glassTone(night, u + o[0], v)));
  pane([X(END_X0), Y(NORTH_Y), 3], [1, 0, 0], GATE.x0 - END_X0);
  pane([X(GATE.x1), Y(NORTH_Y), 3], [1, 0, 0], END_X1 - GATE.x1);
  pane([X(END_X0), Y(NORTH_Y), 3], [0, 1, 0], SOUTH_Y - NORTH_Y);
  pane([X(END_X1), Y(NORTH_Y), 3], [0, 1, 0], SOUTH_Y - NORTH_Y);
  from = END_X0;
  for (const [a, b] of doorSpans.slice().sort((p, q) => p[0] - q[0])) {
    pane([X(from), Y(SOUTH_Y), 3], [1, 0, 0], a - from);
    from = b;
  }
  pane([X(from), Y(SOUTH_Y), 3], [1, 0, 0], END_X1 - from);
  return s.sprite();
}

/** Color marcador de lo que tapa una capa (se vuelve transparente). */
const HIDE: RGBA = [1, 2, 3, 255];
/** Tapa lo de una capa que queda detrás del techo de la estación. */
function occludeWithRoof(s: Escena) {
  s.borde = false;
  s.box(PX - 6, PY - 6, ROOF.z0, SW + 12, SD + 12, ROOF.z1 - ROOF.z0, () => HIDE, () => HIDE, () => HIDE);
  const d = s.canvas.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] === 1 && d[i + 1] === 2 && d[i + 2] === 3) d[i + 3] = 0;
}

/** Cara de la pantalla: marco, la primera línea fija y el fondo apagado. `u` a lo largo de x, `v` hacia arriba. */
function screenFace(u: number, v: number, night: boolean, top: string): RGBA {
  const w = SCREEN.x1 - SCREEN.x0;
  const h = SCREEN.z1 - SCREEN.z0;
  if (u < 1.5 || u > w - 1.5 || v < 1 || v > h - 1) return at(BLACK, 1);
  const m = textMask(top, 1);
  const u0 = Math.floor((w - m.w) / 2);
  if (v > 9.5 && m.on(Math.floor(u - u0), Math.floor(h - 1.5 - v))) return at(LED, night ? 4 : 3);
  return at(BLACK, (Math.floor(u) + Math.floor(v)) % 2 ? 0 : 1);
}

/**
 * El renglón de abajo de la pantalla ("2 MIN", "LLEGANDO"…), en el mismo marco que `drawBusStation`: el
 * cliente lo pone encima de la estación con el mismo ancla.
 */
export function busScreenText(text: string, night: boolean): Sprite {
  const s = new Escena({ x0: -4, y0: -8, z0: -2, x1: PX + SW + 10, y1: PY + SD + 10, z1: ROOF.z1 + 4 }, 2);
  s.borde = false;
  const w = SCREEN.x1 - SCREEN.x0;
  const m = textMask(text, 1);
  const u0 = Math.floor((w - m.w) / 2);
  s.quad([PX + SCREEN.x0, PY + SCREEN.y + 0.05, SCREEN.z0 + 1.5], [1, 0, 0], [0, 0, 1], w, 7, (u, v) =>
    m.on(Math.floor(u - u0), Math.floor(7 - v)) ? at(LED, night ? 4 : 3) : null,
  );
  return s.sprite();
}

/**
 * Las puertas de vidrio de la estación (las cuatro), abiertas `k` (0 cerradas … 1 abiertas): dos hojas
 * que se corren a los lados. En el mismo marco que `drawBusStation`.
 */
export function stationDoorsSprite(k: number, night: boolean): Sprite {
  const s = new Escena({ x0: -4, y0: -8, z0: -2, x1: PX + SW + 10, y1: PY + SD + 10, z1: ROOF.z1 + 4 }, 2);
  s.borde = false;
  const leaf = DOOR_W / 2 - 1.5;
  for (const c of STATION_DOORS)
    for (const side of [-1, 1]) {
      // Cerradas, las hojas se juntan al medio; al abrirse se corren detrás del vidrio de al lado.
      const x0 = (side < 0 ? c - leaf : c) + side * leaf * k * 0.9;
      s.quad([PX + x0, PY + SOUTH_Y + 0.2, 3], [1, 0, 0], [0, 0, 1], leaf, GLASS_TOP - 6, (u, v) => {
        if (u < 0.8 || u > leaf - 0.8 || v < 1 || v > GLASS_TOP - 7) return at(BLACK, 2);
        return glassTone(night, u + x0, v);
      });
    }
  // El alero va por delante de lo alto de las puertas: se dibuja con un color marcador y se borra.
  occludeWithRoof(s);
  return s.sprite();
}

// ---------- El bus ----------

/** Alto del bus (unidades de arte): la calzada va CURB_DROP más abajo que la plataforma (z = 0 = su piso). */
const Z = { wheel: -12, skirt0: -10, skirt1: -4, band1: 5, win1: 29, roof: 33, ac: 37 };
const BW = Math.round(BUS_STOP.width * L);

/** Rueda en la cara del costado (+y): llanta negra con rin gris, centrada en `cx`. */
function wheel(s: Escena, cx: number, y: number) {
  s.quad([cx - 6, y + 0.3, Z.wheel], [1, 0, 0], [0, 0, 1], 12, 12, (u, v) => {
    const d = Math.hypot(u - 6, v - 6);
    if (d > 6) return null;
    if (d < 2) return at(GREY, 5);
    if (d < 3.4) return at(GREY, 3);
    return at(BLACK, d > 5.2 ? 1 : 2);
  });
}

export type BusCar = "front" | "rear";

/** Largo de cada cuerpo en unidades de arte. */
export const BUS_CAR_LEN: Record<BusCar, number> = { front: BUS.frontLen * L, rear: BUS.rearLen * L };

/**
 * Un cuerpo del bus, mirando a +x, con el origen en la esquina de atrás del lado de la plataforma a ras
 * del piso de la plataforma (las ruedas bajan hasta la calzada). `doors` = qué tan abiertas (0 … 1).
 */
export function busCarSprite(car: BusCar, night: boolean, doors: number): Sprite {
  const len = BUS_CAR_LEN[car];
  const s = new Escena({ x0: -3, y0: -3, z0: Z.wheel - 2, x1: len + 3, y1: BW + 3, z1: Z.ac + 3 }, 3);
  // Centros de las puertas de este cuerpo (desde su parte de atrás) y de las ruedas.
  const front = car === "front";
  const doorX = BUS.doors
    .map((d) => (front ? len - d * L : len - (d - BUS.frontLen - BUS.jointLen) * L))
    .filter((x) => x > 8 && x < len - 4);
  const axles = front ? [len - 22, 34] : [24];
  const inDoor = (u: number) => doorX.find((c) => Math.abs(u - c) < 9);
  const winLit = night ? at(C.gold, 4) : null;

  /** Costado visible (+y): faldón negro, franja lima con "MEGABUS", ventanas casi negras de piso a techo y puertas. */
  const side: Tinte = (u, v) => {
    const z = v + Z.skirt0;
    const d = inDoor(u);
    if (d !== undefined) {
      // Puerta alta de vidrio en marco negro; abierta, las hojas se corren y se ve adentro (iluminado de noche).
      const du = u - d;
      if (Math.abs(du) > 8 || z > Z.win1 + 1) return at(BLACK, 2);
      const gap = doors * 7;
      if (Math.abs(du) < gap) return night ? at(C.gold, 3) : at(BLACK, 0);
      if (Math.abs(Math.abs(du) - gap) < 1 || z < Z.skirt1) return at(BLACK, 1);
      return night ? mix(at(TINT, 3), at(C.gold, 3), 0.5) : at(TINT, z > 18 ? 3 : 2);
    }
    if (z < Z.skirt1) return at(BLACK, z < Z.skirt0 + 1 ? 1 : 2);
    if (z < Z.band1) {
      if (front && letterOn("MEGABUS", u, z, 52, Z.skirt1 + 1)) return at(C.white, 4);
      return at(LIME, z < Z.skirt1 + 1 ? 3 : 4);
    }
    if (z < Z.win1) {
      const k = ((u % 26) + 26) % 26;
      if (k < 1.5) return at(BLACK, 2);
      if (winLit) return (z > 12 && z < 26) || bayer(Math.floor(u), Math.floor(z)) < 0.4 ? winLit : at(C.gold, 3);
      if (Math.abs(((u + z) % 30) - 15) < 1) return at(TINT, 4);
      return at(TINT, 1);
    }
    return at(LIME, z > Z.roof - 1 ? 5 : 4);
  };
  s.box(0, 0, Z.skirt0, len, BW, Z.roof - Z.skirt0, (u, v) => (u < 1 || u > len - 1 || v < 1 || v > BW - 1 ? at(LIME, 5) : at(GREY, 5)), side, (u, v) => frontFace(u, v + Z.skirt0, night, front));
  // Equipos del techo (aire acondicionado) y las luces de las puertas del lado de la plataforma.
  for (const ax of front ? [30, 78] : [34]) s.solid(ax, 8, Z.roof, 26, BW - 16, Z.ac - Z.roof, at(GREY, 4), at(GREY, 2), at(GREY, 3));
  for (const c of doorX) s.solid(c - 1.5, 0.5, Z.roof, 3, 2, 1, doors > 0 ? at(C.fire, 4) : at(BLACK, 3), at(BLACK, 1), at(BLACK, 2));
  for (const ax of axles) wheel(s, ax, BW);
  s.shadow(0, 0, len, BW, 0.3);
  return s.sprite();
}

/** Frente del bus (+x): el parabrisas grande, el letrero de ruta, los faros y el parachoques negro. Atrás, lima liso. */
function frontFace(uy: number, z: number, night: boolean, front: boolean): RGBA {
  if (!front) return at(LIME, 3);
  // En la cara +x el u corre hacia +y (a la izquierda en pantalla): se da vuelta para que el texto se lea.
  const u = BW - uy;
  if (z < Z.skirt1) return at(BLACK, z < Z.skirt0 + 1.5 ? 1 : 2);
  // Faros en las esquinas.
  if (z < 1.5 && (u < 7 || u > BW - 7) && (u > 2 && u < BW - 2)) return night ? at(C.gold, 5) : at(C.cream, 4);
  if (z < 2) return at(LIME, 3);
  if (z > 25 && z < Z.roof - 0.5) {
    // Letrero de ruta: LED ámbar sobre negro.
    const m = textMask("HYVENTO", 1);
    const u0 = Math.floor((BW - m.w) / 2);
    if (m.on(Math.floor(u - u0), Math.floor(Z.roof - 0.5 - z))) return at(LED, night ? 4 : 3);
    return at(BLACK, 1);
  }
  if (z >= Z.roof - 0.5) return at(LIME, 4);
  if (u < 1.5 || u > BW - 1.5) return at(BLACK, 2);
  // Parabrisas con su reflejo.
  if (Math.abs(u - (z - 2) * 0.9 - 6) < 1.4) return at(TINT, 4);
  return night ? mix(at(TINT, 2), at(C.gold, 3), 0.25) : at(TINT, 2);
}

/**
 * El fuelle gris entre los dos cuerpos: un acordeón de `BUS.jointLen` de largo, del mismo ancho y alto que
 * los cuerpos (el faldón negro abajo, el techo a ras del de ellos), con el origen como el de `busCarSprite`
 * (así, con el bus recto, queda en línea con los dos). Su lado de atrás está corrido `dy` (unidades de
 * arte, hacia +y) respecto del de adelante: así se dobla cuando un cuerpo va por el carril y el otro no.
 */
export function busJointSprite(dy: number): Sprite {
  const len = BUS.jointLen * L;
  const s = new Escena({ x0: -3, y0: Math.min(0, dy) - 3, z0: Z.wheel - 2, x1: len + 3, y1: BW + Math.max(0, dy) + 3, z1: Z.ac + 3 }, 3);
  // A lo largo del fuelle se pasa del corrimiento de atrás (u = 0) al de adelante (u = len): caras torcidas.
  const du: [number, number, number] = [1, -dy / len, 0];
  const pleat = (u: number) => Math.floor(u / 2) % 2;
  // Costado visible (+y): faldón negro como el de los cuerpos y el acordeón gris con sus pliegues.
  s.quad([0, BW + dy, Z.skirt0], du, [0, 0, 1], len, Z.roof - Z.skirt0, (u, v) => {
    const z = v + Z.skirt0;
    if (z < Z.skirt1) return at(BLACK, z < Z.skirt0 + 1 ? 1 : 2);
    if (z > Z.roof - 1.5) return at(GREY, 1);
    if (u < 0.8 || u > len - 0.8) return at(BLACK, 2);
    return at(GREY, pleat(u) ? 2 : 4);
  });
  // Techo del acordeón, a la altura del de los cuerpos.
  s.quad([0, dy, Z.roof], du, [0, 1, 0], len, BW, (u, v) => (v < 1 || v > BW - 1 ? at(GREY, 2) : at(GREY, pleat(u) ? 3 : 4)));
  s.shadow(0, Math.min(0, dy), len, BW + Math.abs(dy), 0.3);
  return s.sprite();
}

export const BUS_DRAW: Record<string, () => Sprite> = {
  "bus-platform": busPlatform,
};
