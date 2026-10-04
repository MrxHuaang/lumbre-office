import type { AreaDef, Rect } from "../types";
import { place } from "./place";
import { CONEXIONES } from "./conexiones";
import { BUS_DOOR_X, STATION } from "./parada";

// ---------- El Megabús por dentro ----------
// El bus articulado de la parada del jardín (ver parada.ts y @hyvento/shared/bus): el cuerpo de atrás, el
// fuelle y el de adelante con la cabina del conductor. Mira hacia +x (el frente al este, como el bus de la
// calle). Asientos de pasajero mirando hacia adelante (los preferenciales en azul), barras amarillas con
// timbre junto a las puertas, ventanas oscuras de piso a techo en la pared del norte con la pantalla de
// ruta, el plato del fuelle y piso antideslizante. Se sube con E en la estación y se baja por las puertas,
// solo con el bus parado y las puertas abiertas (lo valida el servidor). Las puertas van en la pared del
// norte, entre las ventanas: es el lado de la plataforma (afuera el bus para con ese costado pegado a la
// estación), así se sale hacia donde está la estación. Los asientos van contra la pared baja del sur.

const W = 22;
const H = 6;
/** La fila del norte (y = 0) es el umbral de las puertas: los cuerpos empiezan en y = 1. */
const TRASERO: Rect = { x: 0, y: 1, w: 8, h: 5 };
const FUELLE: Rect = { x: 8, y: 1, w: 2, h: 5 };
const DELANTERO: Rect = { x: 10, y: 1, w: 12, h: 5 };
const PUERTAS = CONEXIONES.megabus.puertas.tiles;
/** Adónde lleva cada puerta: a la plataforma, frente a la puerta del bus de afuera que le toca. */
const BAJADA = [BUS_DOOR_X[3]!, BUS_DOOR_X[1]!, BUS_DOOR_X[0]!].map((x) => ({ x: Math.floor(x), y: STATION.y + STATION.d - 1 }));

/** Asiento de pasajero mirando hacia adelante (o el azul, preferencial). */
const seat = (x: number, y: number, blue = false) => place(blue ? "bus-seat-blue" : "bus-seat", x, y, "right");

export const megabus: AreaDef = {
  id: "megabus",
  name: "Megabús",
  width: W,
  height: H,
  rooms: [
    { id: "megabus-trasero", rect: TRASERO, floor: "rubber", wallpaper: "megabus" },
    { id: "megabus-fuelle", rect: FUELLE, floor: "rubber", wallpaper: "fuelle" },
    { id: "megabus-delantero", rect: DELANTERO, floor: "rubber", wallpaper: "megabus" },
  ],
  doors: [
    // Entre los cuerpos y el fuelle no hay pared: es un solo pasillo.
    { edge: "v", x: FUELLE.x, y: FUELLE.y, width: 5 },
    { edge: "v", x: DELANTERO.x, y: DELANTERO.y, width: 5 },
    // El hueco de cada puerta, en la pared del norte (entre el umbral y el cuerpo).
    ...PUERTAS.map((t) => ({ edge: "h" as const, x: t.x, y: t.y + 1 })),
  ],
  thresholds: PUERTAS,
  zones: [{ id: "megabus", name: "Megabús", type: "common", rect: { x: 0, y: 0, w: W, h: H }, isolated: false }],
  features: [
    // Ventanas oscuras de piso a techo entre las puertas; una de adelante lleva arriba la pantalla de ruta.
    { kind: "bus-window", edge: "h", x: 0, y: 1, width: 4 },
    { kind: "bus-window", edge: "h", x: 5, y: 1, width: 3 },
    { kind: "bus-window", edge: "h", x: DELANTERO.x, y: 1, width: 3 },
    { kind: "bus-window", edge: "h", x: 14, y: 1, width: 4, text: "HYVENTO" },
    { kind: "bus-window", edge: "h", x: 19, y: 1 },
    // La luneta de atrás.
    { kind: "bus-window", edge: "v", x: 0, y: TRASERO.y, width: TRASERO.h },
  ],
  furniture: [
    // Cada asiento deja al lado un tile libre (el pasillo o el espacio entre filas): ahí se para quien se sienta.
    // ----- Cuerpo de atrás: tres pares contra la pared del sur y dos junto a las ventanas, lejos de la puerta.
    ...[1, 4, 6].flatMap((x) => [seat(x, 5), seat(x, 4)]),
    seat(0, 2),
    seat(0, 1),
    seat(6, 2, true),
    seat(6, 1, true),
    place("bus-pole", 3, 2),
    place("bus-pole", 5, 2),
    // ----- El fuelle: el plato giratorio en el piso (los pliegues son la pared).
    place("bus-turntable", FUELLE.x, FUELLE.y),
    // ----- Cuerpo de adelante: asientos, las barras de las dos puertas y la cabina del conductor.
    ...[11, 13, 15].flatMap((x) => [seat(x, 5), seat(x, 4)]),
    seat(17, 5, true),
    seat(17, 4, true),
    seat(10, 2),
    seat(10, 1),
    seat(15, 2),
    seat(15, 1),
    place("bus-pole", 12, 2),
    place("bus-pole", 14, 2),
    place("bus-pole", 17, 2),
    place("bus-pole", 19, 2),
    place("bus-cabin", 20, DELANTERO.y),
  ],
  portals: PUERTAS.map((t, i) => ({
    id: `megabus-bajar-${i + 1}`,
    label: "Bajar del Megabús",
    tiles: [t],
    to: { area: "jardin", x: BAJADA[i]!.x, y: BAJADA[i]!.y, facing: "up" },
  })),
  points: [],
};
