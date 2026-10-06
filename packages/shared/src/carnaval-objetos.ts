// El Carnaval de Negros y Blancos: lo que se lleva en la mano (dibujos en packages/map/src/art/items.ts).
// La maicena (el "talco" del Día de Blancos) y las serpentinas se le echan a alguien con F; las máscaras
// son de recuerdo. Aquí solo cómo se llaman y cuánto se lleva; las reglas están en carnaval.ts.
import type { BagObject } from "./bolsa";

/** Lo que se le echa a otro con F (una unidad por vez). */
export const MAICENA = "maicena";
export const SERPENTINAS = "serpentinas";
export const CARNAVAL_LANZABLES = [MAICENA, SERPENTINAS] as const;
export type Lanzable = (typeof CARNAVAL_LANZABLES)[number];
export const isLanzable = (id: string): id is Lanzable => (CARNAVAL_LANZABLES as readonly string[]).includes(id);

export const CARNAVAL_BAG_OBJECTS: Record<string, BagObject> = {
  [MAICENA]: {
    name: "Bolsita de maicena",
    blurb: "El talco del Día de Blancos: con F se le echa a alguien de al lado y le queda la cara empolvada un rato.",
    kind: "objeto",
    max: 30,
  },
  [SERPENTINAS]: {
    name: "Serpentinas",
    blurb: "Un rollito blanco y negro: con F se le tira a alguien de al lado y suelta confeti.",
    kind: "objeto",
    max: 30,
  },
  "antifaz-carnaval": {
    name: "Antifaz de carnaval",
    blurb: "Mitad blanco, mitad negro, con ribete dorado y una pluma. De recuerdo del Carnaval.",
    kind: "objeto",
    max: 1,
  },
  "mascara-condor": {
    name: "Máscara de cóndor",
    blurb: "De papel maché, con el collar blanco del cóndor de los Andes. Hecha a mano en la cabaña.",
    kind: "objeto",
    max: 1,
  },
  "mascara-sol": {
    name: "Máscara del sol",
    blurb: "Un sol de papel maché con rayos blancos y negros y la cara dorada.",
    kind: "objeto",
    max: 1,
  },
};
