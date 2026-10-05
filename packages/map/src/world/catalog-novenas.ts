// Las Novenas de aguinaldo (dibujos en art/novenas.ts): el pesebre y la decoración navideña que el festival
// pone en la cabaña y el jardín del 12 al 20 del invierno. Nada de esto está puesto en un nivel.
// - El pesebre no va en la decoración: se arma figura a figura, así que el juego lo dibuja como capa sobre
//   el recibidor (`NOVENA.pesebre` de @hyvento/shared, ver art/eventos.ts) y no estorba el paso.
// - La decoración son muebles comunes del catálogo que pone la decoración temporal de los festivales
//   (world/festivales/novenas.ts).
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
