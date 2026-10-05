// Las Novenas de aguinaldo (dibujos en art/novenas.ts): el pesebre y la decoración navideña que el festival
// pone en la cabaña y el jardín del 12 al 20 del invierno. Nada de esto está puesto en un nivel.
// - El pesebre no va en la decoración: se arma figura a figura, así que el juego lo dibuja como capa sobre
//   el recibidor (`NOVENA.pesebre` de @hyvento/shared, ver art/eventos.ts) y no estorba el paso.
// - La decoración (`NOVENAS_DECOR`) son muebles comunes del catálogo con su lugar en cada nivel, en la forma
//   que usa la decoración temporal de los festivales ({ area, type, x, y, facing }).
import type { Facing } from "./types";
import type { CatalogItem } from "./catalog";

/** La luz cálida de los bombillos. */
const WARM = { color: "#ffd27a" };

export const NOVENAS_CATALOG = {
  // 2x1 a lo largo de x: el tablado con musgo, el establo y las nueve figuras (en el juego, de a una por día).
  pesebre: { name: "Pesebre", size: [2, 1] },
  // De noche se prenden las bolas y la estrella.
  "arbol-navidad": { name: "Árbol de Navidad", size: [1, 1], hasNight: true, light: { at: [8, 8, 26], ...WARM, radius: 48 } },
  // El arco de bombillos: se pasa por debajo.
  "luces-navidad": { name: "Arco de luces", size: [1, 1], solid: false, hasNight: true, light: { at: [8, 8, 26], ...WARM, radius: 40 } },
  guirnalda: { name: "Corona navideña", size: [1, 1] },
} satisfies Record<string, CatalogItem>;

/** Un mueble de la decoración de un festival: en qué nivel, qué, en qué tile y mirando a dónde. */
export interface FestivalDecorItem {
  area: string;
  type: string;
  x: number;
  y: number;
  facing: Facing;
}

/**
 * La decoración navideña de las novenas: el árbol del salón y la corona del recibidor adentro, y afuera
 * dos árboles y dos arcos de luces a los lados del porche de la casa. Todo en tiles libres (un test revisa
 * que no tape muebles, portales ni puntos y que no corte el paso).
 */
export const NOVENAS_DECOR: readonly FestivalDecorItem[] = [
  { area: "planta-baja", type: "arbol-navidad", x: 10, y: 1, facing: "right" },
  { area: "planta-baja", type: "guirnalda", x: 16, y: 24, facing: "right" },
  { area: "jardin", type: "arbol-navidad", x: 59, y: 29, facing: "right" },
  { area: "jardin", type: "arbol-navidad", x: 66, y: 29, facing: "right" },
  { area: "jardin", type: "luces-navidad", x: 61, y: 29, facing: "down" },
  { area: "jardin", type: "luces-navidad", x: 64, y: 29, facing: "down" },
];
