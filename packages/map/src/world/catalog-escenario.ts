// El escenario al aire libre (anfiteatro) del jardín. Dibujos en art/escenario.ts. Las reglas (quién habla
// para quién, la fila de turnos, las manos) están en @hyvento/shared (escenario.ts) y las valida el
// servidor. El estudio de grabación está en catalog-podcast.ts.
//
// La cámara mira desde el sureste: un escenario de espaldas a ella (mirando al norte) mostraría el revés
// de la pantalla y su techo taparía a las gradas. Por eso mira al este (como la pantalla del cine, en la
// pared oeste): la concha con la pantalla queda al fondo, al oeste, y las gradas se abren hacia la cámara.
import type { CatalogItem } from "./catalog";
import type { Facing } from "./types";

const WARM = { color: "#ffd98a" };

/**
 * Las gradas: tres filas de tablas en semicírculo alrededor del frente de la tarima, con un pasillo al
 * medio. En tiles, relativo a la esquina noroeste del anfiteatro (`GRADAS.origin` en el jardín): cada
 * fila es la franja de un tile de ancho a `radius` del centro, hasta `maxAngle` a cada lado.
 */
export const GRADAS = {
  /** Esquina del anfiteatro en el jardín (coordenadas de la zona jugable) y su tamaño. */
  origin: { x: 20, y: 85 },
  size: { w: 9, h: 11 },
  /** Centro del semicírculo (el frente de la tarima), relativo al origen. */
  center: { x: -2, y: 6.5 },
  radii: [4.6, 6.6, 8.6],
  maxAngle: 62,
  /** Fila del pasillo del medio (relativa al origen): llega derecho a la escalerita de la tarima. */
  aisle: 6,
  /** Altura de las tablas de cada fila sobre su tarimita (px de arte) y la de la tarimita de cada fila. */
  benchZ: 9,
  deckZ: [2, 4, 6],
} as const;

export interface GradasRow {
  /** Esquina de la pieza, relativa al origen del anfiteatro. */
  dx: number;
  dy: number;
  w: number;
  d: number;
  /** Tiles de asiento (relativos a la pieza) y hacia dónde mira quien se sienta (al centro). */
  seats: [number, number, Facing][];
}

/**
 * Las tres filas, calculadas del semicírculo (así el arte, el catálogo y el jardín coinciden): en cada
 * fila del anfiteatro (salvo la primera y la última, que quedan de pasillo a los lados, y el pasillo del
 * medio) la tabla cae en el tile por donde pasa el arco. Entre dos filas queda siempre el pasillo.
 */
export const GRADAS_ROWS: GradasRow[] = GRADAS.radii.map((r) => {
  const tiles: [number, number, Facing][] = [];
  for (let j = 1; j < GRADAS.size.h - 1; j++) {
    if (j === GRADAS.aisle) continue;
    const dy = j + 0.5 - GRADAS.center.y;
    if (Math.abs(dy) > r - 0.3) continue;
    const dx = Math.sqrt(r * r - dy * dy);
    if ((Math.abs(Math.atan2(dy, dx)) * 180) / Math.PI >= GRADAS.maxAngle) continue;
    const i = Math.floor(GRADAS.center.x + dx);
    if (i < 0 || i >= GRADAS.size.w) continue;
    // Se mira al centro del semicírculo: al oeste, o al norte/sur en las puntas.
    tiles.push([i, j, Math.abs(dy) > dx ? (dy > 0 ? "up" : "down") : "left"]);
  }
  const x0 = Math.min(...tiles.map((t) => t[0]));
  const y0 = Math.min(...tiles.map((t) => t[1]));
  return {
    dx: x0,
    dy: y0,
    w: Math.max(...tiles.map((t) => t[0])) - x0 + 1,
    d: Math.max(...tiles.map((t) => t[1])) - y0 + 1,
    seats: tiles.map(([i, j, f]) => [i - x0, j - y0, f]),
  };
});

/** Cada fila es plana (se dibuja debajo de todo) y sus tablas bloquean el paso; se sienta mirando a la tarima. */
const gradasRow = (k: number): CatalogItem => {
  const row = GRADAS_ROWS[k]!;
  return {
    name: "Gradas",
    size: [row.w, row.d],
    fixed: true,
    flat: true,
    blocks: row.seats.map(([x, y]) => [x, y]),
    seats: row.seats,
    // La altura del asiento es la de una silla (11) más esto: la tarimita de la fila y la tabla.
    lift: GRADAS.deckZ[k]! + GRADAS.benchZ - 11,
  };
};

export const ESCENARIO_CATALOG = {
  // La concha del escenario (al fondo, al oeste de la tarima): el marco de madera con la pantalla grande,
  // el telón a los lados, el techito a dos aguas con guirnaldas y los parlantes al pie. Sólida entera.
  "stage-shell": { name: "Concha del escenario", size: [3, 7], fixed: true, hasNight: true, light: { at: [30, 56, 64], ...WARM, radius: 90 } },
  // La tarima de tablas (se pisa): hasta dos personas hablan desde aquí para todo el anfiteatro.
  "stage-deck": { name: "Tarima", size: [3, 7], fixed: true, flat: true, solid: false, lift: 4 },
  // El atril con micrófono, al frente de la tarima (junto a la escalerita).
  "stage-lectern": { name: "Atril", size: [1, 1], fixed: true },
  // Farol de poste a los lados de la tarima.
  "stage-lantern": { name: "Farol del escenario", size: [1, 1], light: { at: [8, 8, 44], ...WARM, radius: 60 } },
  "gradas-1": gradasRow(0),
  "gradas-2": gradasRow(1),
  "gradas-3": gradasRow(2),
} satisfies Record<string, CatalogItem>;
