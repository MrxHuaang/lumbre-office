// El puesto de pesca de la orilla oeste del lago (dibujos en art/pesca.ts; dónde va cada pieza en
// world/areas/puesto-pesca.ts). Todo es fijo y mira al lago (+x): la caseta atrás, Don Evelio en el medio
// (su tile lo bloquea el nivel) con las cañas a un lado y la nevera al otro, y el mostrador adelante, que
// es donde se compra.
import type { CatalogItem } from "./catalog";

export const PESCA_CATALOG = {
  // Caseta de tablas con techito de lona a rayas que sale hacia el frente, cañas colgadas en la pared y
  // el letrero "PESCA" encima.
  "pesca-caseta": { name: "Caseta de pesca", size: [2, 3], fixed: true, light: { at: [30, 24, 30], color: "#ffc77a", radius: 46 } },
  // Mostrador de tablas con el balde de lombrices, el frasco de la carnada buena y una pesita.
  "pesca-mostrador": { name: "Mostrador de pesca", size: [1, 3], fixed: true },
  // Cañas paradas en su soporte (bambú, fibra y carbono) y la nasa.
  "pesca-canas": { name: "Cañas de pesca", size: [1, 1], fixed: true },
  // La nevera de icopor con hielo (y la cola de un pescado que se asoma).
  "pesca-nevera": { name: "Nevera de icopor", size: [1, 1], fixed: true },
} satisfies Record<string, CatalogItem>;
