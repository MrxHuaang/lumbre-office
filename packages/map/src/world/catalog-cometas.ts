// El Festival de cometas (dibujos en art/cometas.ts): lo que el festival pone en la loma del observatorio el
// día 9 del verano (world/festivales/cometas.ts) y la escalera con la cometa en el techo del garaje. Nada de
// esto está en un nivel: lo coloca el festival. Todo es fijo: lo de enfrente mira a +y, donde se para la
// gente.
import type { CatalogItem } from "./catalog";

export const COMETAS_CATALOG = {
  // La mesa del taller: papel de seda, palitos de guadua, engrudo y una cometa a medio armar.
  "taller-cometas": { name: "Taller de cometas", size: [2, 1], fixed: true },
  // El puesto de Chepe: cometas colgadas del techo y carretes de cabuya en el mostrador.
  "puesto-cometas": { name: "Puesto de cometas", size: [2, 1], fixed: true, seeThrough: true },
  // El carrito del raspao de Don Efraín, con su sombrilla.
  "carrito-raspao": { name: "Carrito del raspao", size: [1, 1], fixed: true },
  // El tablero del concurso de la cometa más bonita.
  "tablero-cometas": { name: "Tablero del concurso", size: [1, 1], fixed: true },
  // La manga de viento en su poste (la escena le cambia la manga según hacia dónde y qué tan fuerte sopla).
  "manga-viento": { name: "Manga de viento", size: [1, 1], fixed: true },
  // Un poste con banderines de papel que caen hacia los lados.
  "banderines-cometas": { name: "Banderines", size: [1, 1], fixed: true },
  // Una cometa de adorno amarrada a una estaca, volando bajito.
  "cometa-amarrada": { name: "Cometa amarrada", size: [1, 1], fixed: true },
  "cometa-amarrada-2": { name: "Cometa amarrada", size: [1, 1], fixed: true },
  "cometa-amarrada-3": { name: "Cometa amarrada", size: [1, 1], fixed: true },
  // El mantel de cuadros del picnic: se sientan en él (tres puestos alrededor de la canasta).
  "mantel-picnic": {
    name: "Mantel de picnic",
    size: [3, 2],
    fixed: true,
    flat: true,
    solid: false,
    seats: [
      [0, 0, "right"],
      [2, 0, "left"],
      [1, 1, "up"],
    ],
  },
  // El árbol con la cometa de Mateo enredada en las ramas (la escena la quita cuando se la bajan).
  "arbol-cometa": { name: "Árbol con una cometa enredada", size: [1, 1], fixed: true },
  // La escalera recostada al garaje, con la cometa de Santiago en el alero (la escena la quita al bajarla).
  "escalera-garaje": { name: "Escalera del garaje", size: [1, 1], fixed: true },
} satisfies Record<string, CatalogItem>;
