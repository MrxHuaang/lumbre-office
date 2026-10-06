// La parada del bus del jardín (world/areas/parada.ts): la plataforma y la estación de la "Estación
// Hyvento" (dibujadas a mano en art/estacion-bus.ts), las capas que van encima de la estación (las puertas
// de vidrio, que se abren cuando llega el bus, y el renglón de la pantalla de "Próximo") y el bus articulado
// como los del Megabús de Pereira: verde lima de punta a punta, vidrios casi negros, fuelle gris, faldón y
// parachoques negros, "MEGABUS" en blanco al costado y el letrero de ruta en la frente. El bus no es un
// mueble: lo arma el cliente con `busCarSprite` y `busJointSprite` (ver apps/web/src/game/bus.ts).
// Unidades de arte (tile = 16). Las capas y el bus, con la escena de z-buffer de los dibujos grandes de afuera.
import { BUS } from "@hyvento/shared";
import { BUS_STOP } from "../world/areas/parada";
import { BLACK, GREY, LED, LIME, TINT } from "./bus-colores";
import { textMask } from "./digits";
import { busPlatform, DOOR_W, GLASS_TOP, PX, PY, ROOF, SCREEN, SD, SOUTH_Y, STATION_DOORS, SW, VIGA, vidrioPuerta } from "./estacion-bus";
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { at, bayer, type RGBA, type Sprite } from "./pixel";

const L = 16;

// ---------- La estación ----------

// La estación y la plataforma se dibujan a mano en art/estacion-bus.ts; acá quedan las capas que el cliente
// pone encima en el mismo marco (las puertas y el renglón de la pantalla).
export { drawBusStation } from "./estacion-bus";

/** Letras de 5x7 sobre una cara: ¿está prendido el punto (u, v) (v hacia arriba) del texto que empieza en u0, con la base en v0? */
function letterOn(text: string, u: number, v: number, u0: number, v0: number): boolean {
  const m = textMask(text, 1);
  return m.on(Math.floor(u - u0), Math.floor(v0 + m.h - v));
}

/** Color marcador de lo que tapa una capa (se vuelve transparente). */
const HIDE: RGBA = [1, 2, 3, 255];
/** Tapa lo de una capa que queda detrás del techo de la estación o de la pantalla colgada. */
function occludeWithRoof(s: Escena) {
  s.borde = false;
  s.box(PX + SCREEN.x0, PY + SCREEN.y - 2, SCREEN.z0, SCREEN.x1 - SCREEN.x0, 2, SCREEN.z1 - SCREEN.z0, () => HIDE, () => HIDE, () => HIDE);
  // Desde la viga de madera del alero (más baja que la cenefa) hasta el techo.
  s.box(PX - 6, PY - 6, VIGA.z0, SW + 12, SD + 12, ROOF.z1 - VIGA.z0, () => HIDE, () => HIDE, () => HIDE);
  const d = s.canvas.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] === 1 && d[i + 1] === 2 && d[i + 2] === 3) d[i + 3] = 0;
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
        return vidrioPuerta(night, u + x0, v);
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
  const winLit = night ? at(C.gold, 4) : null;

  /**
   * Costado visible (+y, el de la calle): faldón negro, franja lima con "MEGABUS" y ventanas casi negras de
   * piso a techo. Las puertas van del otro lado, el de la plataforma: se abren hacia la estación, junto con
   * las de vidrio de la estación (de este lado se ven solo sus luces del techo).
   */
  const side: Tinte = (u, v) => {
    const z = v + Z.skirt0;
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
