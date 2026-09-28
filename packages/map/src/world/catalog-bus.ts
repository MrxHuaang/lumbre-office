// La parada del bus del jardín (world/areas/parada.ts) y el bus por dentro. Dibujos en art/bus.ts; el bus no es un mueble:
// lo mueve el servidor y lo dibuja el cliente (apps/web/src/game/bus.ts).
import type { CatalogItem } from "./catalog";

/** La fila del norte es vidrio salvo los dos torniquetes (x 8 y 9); las puntas de la plataforma, también vidrio. */
const PLATFORM_BLOCKS: [number, number][] = [
  ...Array.from({ length: 18 }, (_, x) => [x, 0] as [number, number]).filter(([x]) => x !== 8 && x !== 9),
  [0, 1],
  [0, 2],
  [17, 1],
  [17, 2],
];

export const BUS_CATALOG = {
  // Plana (debajo de todos): el piso de la plataforma, la base del vidrio del fondo, los torniquetes y el
  // cordón que baja a la calle. Se camina por dentro (ver `blocks`).
  "bus-platform": { name: "Plataforma de la estación", size: [18, 3], fixed: true, flat: true, blocks: PLATFORM_BLOCKS },
  // El vidrio, las puertas, los postes y el techo con el letrero y la pantalla. Empieza 3 tiles al oeste y 2
  // al norte de la plataforma: cubre lo que su dibujo tapa desde atrás, y se transparenta si hay alguien.
  "bus-station": {
    name: "Estación Hyvento",
    size: [21, 5],
    fixed: true,
    solid: false,
    seeThrough: true,
    hasNight: true,
    light: { at: [(3 + 9) * 16, (2 + 1.6) * 16, 34], color: "#ffd98a", radius: 150 },
  },
  // El Megabús por dentro (nivel megabus; dibujos en art/bus-adentro.ts).
  "bus-seat": { name: "Asiento del bus", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "bus-seat-blue": { name: "Asiento preferencial", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "bus-pole": { name: "Barra con timbre", size: [1, 1] },
  "bus-turntable": { name: "Plato del fuelle", size: [2, 5], fixed: true, flat: true, solid: false },
  "bus-cabin": { name: "Cabina del conductor", size: [2, 5], fixed: true },
} satisfies Record<string, CatalogItem>;
