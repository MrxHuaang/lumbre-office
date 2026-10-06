// La decoración de las Novenas de aguinaldo (ver festival-decor.ts): el árbol de Navidad del salón y la
// corona del recibidor adentro, y afuera dos árboles y dos arcos de luces a los lados del porche de la
// casa. Todo en tiles del nivel; lo mismo los nueve días. El pesebre no va aquí: cambia con la figura de
// cada día, así que el juego lo dibuja como capa (`NOVENA.pesebre`, ver art/eventos.ts).
import type { FestivalDecorDef } from "../../festival-decor";
import type { Facing, Placement } from "../types";

/** Un mueble de la decoración navideña: en qué nivel, qué, en qué tile y mirando a dónde. */
export interface NovenaPieza {
  area: string;
  type: string;
  x: number;
  y: number;
  facing: Facing;
}

export const NOVENAS_PIEZAS: readonly NovenaPieza[] = [
  { area: "planta-baja", type: "arbol-navidad", x: 10, y: 1, facing: "right" },
  { area: "planta-baja", type: "guirnalda", x: 16, y: 24, facing: "right" },
  { area: "jardin", type: "arbol-navidad", x: 59, y: 29, facing: "right" },
  { area: "jardin", type: "arbol-navidad", x: 66, y: 29, facing: "right" },
  { area: "jardin", type: "luces-navidad", x: 61, y: 29, facing: "down" },
  { area: "jardin", type: "luces-navidad", x: 64, y: 29, facing: "down" },
];

export const NOVENAS_DECOR: FestivalDecorDef = {
  areas: [...new Set(NOVENAS_PIEZAS.map((p) => p.area))],
  build(def) {
    const furniture: Placement[] = NOVENAS_PIEZAS.filter((p) => p.area === def.id).map(({ type, x, y, facing }) => ({ type, x, y, facing }));
    return furniture.length ? { furniture } : null;
  },
};
