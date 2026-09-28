// La parada del bus del jardín (docs/plan-estructuras.md, estructura 8), en tiles del NIVEL (la zona
// jugable del jardín empieza en el margen M = 10). Afuera del portón de la cerca baja un sendero corto a
// la "Estación Hyvento" (una plataforma de vidrio estilo Megabús) y detrás pasa la calle de este a oeste,
// con el carril exclusivo pintado pegado a la plataforma y un carril mixto del otro lado. La calle va más
// baja que la plataforma (el cordón se dibuja como un escalón): así el piso del bus queda al nivel de la
// plataforma, como en el Megabús. Lo usan jardin.ts (terreno y muebles), el arte (art/bus.ts), el
// servidor (dónde esperan los pasajeros) y el cliente (por dónde va el bus).
import { BUS, BUS_LENGTH } from "@hyvento/shared";

/** Margen de bosque del jardín (el mismo `M` de jardin.ts, que lo comprueba). */
export const PARADA_M = 10;

/** Plataforma de la estación: 18x3 tiles; la fila del norte es el vidrio con los torniquetes. */
export const STATION = { x: 40, y: 77, w: 18, d: 3 } as const;
/** Columnas de los torniquetes (en la fila del norte), frente al sendero del portón. */
export const TURNSTILES = [48, 49] as const;

/**
 * La calle (y en tiles del nivel): el cordón de la plataforma en `y0`, el carril exclusivo hasta
 * `laneY`, el carril mixto hasta `y1` y el cordón de enfrente hasta `curbY`. A lo largo de x va de
 * `x0` a `x1` (en las puntas se pierde en el bosque).
 */
export const ROAD = { y0: 80, laneY: 84, y1: 87, curbY: 87.6, x0: 3.5, x1: 96.5 } as const;

/** Cuánto más abajo va la calzada que la plataforma (unidades de arte): el alto del cordón. */
export const CURB_DROP = 12;

/** El bus parado: el frente en `stopX` y el costado de las puertas en `sideY` (pegado a la plataforma). */
export const BUS_STOP = {
  stopX: STATION.x + STATION.w / 2 + BUS_LENGTH / 2,
  sideY: ROAD.y0 + 0.15,
  /** Ancho del bus (tiles). */
  width: 2.6,
  /** Cuánto se corre hacia afuera cuando viene o se va por el carril (tiles; ver `busLane`). */
  laneShift: 1.3,
} as const;

/** x (tiles del nivel) del centro de cada puerta del bus parado (las de la plataforma quedan enfrente). */
export const BUS_DOOR_X = BUS.doors.map((d) => BUS_STOP.stopX - d);

/** De dónde sale el frente del bus (oeste) y hasta dónde llega al irse (hasta que la cola se pierde). */
export const BUS_ROUTE = {
  startX: ROAD.x0 - 2,
  endX: ROAD.x1 + 2 + BUS_LENGTH,
} as const;
