// El Carnaval de Negros y Blancos (dibujos en art/carnaval-decor.ts): la decoración que el festival pone en
// la vereda de la calle del Megabús, el portón y la pradera. Nada de esto está puesto en un nivel: lo coloca
// el festival (world/festivales/carnaval.ts). Las carrozas no son muebles (las mueve el desfile, ver
// packages/map/src/carnaval.ts). El carnaval de Pasto es de día: nada de esto tiene dibujo de noche.
import type { CatalogItem } from "./catalog";
import type { Facing } from "./types";

/** Seis puestos a lo largo de una banca de gradería, todos mirando a la calle (+y). */
const SEIS: [number, number, Facing][] = [0, 1, 2, 3, 4, 5].map((x) => [x, 0, "down"]);

export const CARNAVAL_CATALOG = {
  // Banderines en dos cuerdas que se cruzan, colgados de un cable alto: puestos en fila forman la guirnalda
  // sobre la vereda. Se pasa por debajo.
  "banderines-carnaval": { name: "Banderines de carnaval", size: [1, 1], solid: false },
  // Guirnalda de papel crepé torcido con pompones (la misma altura que los banderines).
  "guirnalda-carnaval": { name: "Guirnalda de carnaval", size: [1, 1], solid: false },
  // El poste pintado en espiral de donde se amarra el cable de la guirnalda (el brazo sale hacia +y).
  "poste-banderines": { name: "Poste de la guirnalda", size: [1, 1] },
  // Farol de papel de acordeón colgado de su poste.
  "farol-carnaval": { name: "Farol de carnaval", size: [1, 1] },
  // Valla de colores para el público.
  "valla-carnaval": { name: "Valla del desfile", size: [1, 1] },
  // Confeti y serpentinas regados en el piso.
  "confeti-calle": { name: "Confeti", size: [1, 1], solid: false, flat: true },
  "serpentinas-suelo": { name: "Serpentinas", size: [1, 1], solid: false, flat: true },
  // La máscara grande con plumas sobre su poste (a los lados del portón).
  mascaron: { name: "Mascarón", size: [1, 1] },
  // El palco del jurado: la tarima con el telón del Galeras y el letrero (el concurso de disfraces se ve ahí).
  "tarima-comparsa": { name: "Tarima del concurso", size: [3, 2], fixed: true },
  // La tarima de la murga, con los parlantes y el bombo.
  "tarima-musica": { name: "Tarima de la murga", size: [3, 2], fixed: true },
  // Los puestos: el de maicena y serpentinas (el del festival), el de máscaras y los de comida pastusa.
  "puesto-carnaval": { name: "Puesto de maicena", size: [2, 1], fixed: true },
  "puesto-mascaras": { name: "Puesto de máscaras", size: [2, 1], fixed: true },
  "puesto-frito": { name: "Puesto de frito pastuso", size: [3, 1], fixed: true },
  "puesto-empanadas": { name: "Puesto de empanadas de añejo", size: [3, 1], fixed: true },
  "puesto-hervido": { name: "Puesto de hervido", size: [3, 1], fixed: true },
  "puesto-helado": { name: "Puesto de helado de paila", size: [3, 1], fixed: true },
  // Las graderías de frente a la calle: la fila de atrás (la banca alta y el pasillo de adelante, que se
  // camina) y la de adelante, dos tiles más al sur. Son planas, como las gradas del escenario: la gente
  // sentada va encima, a la altura de cada banca (11 + `lift`).
  "tribuna-carnaval-alta": { name: "Gradería", size: [6, 2], fixed: true, flat: true, blocks: SEIS.map(([x, y]) => [x, y]), seats: SEIS, lift: 7 },
  "tribuna-carnaval": { name: "Gradería", size: [6, 1], fixed: true, flat: true, blocks: SEIS.map(([x, y]) => [x, y]), seats: SEIS, lift: -2 },
  // Los arcos con el letrero "CARNAVAL": solo bloquean las columnas; se pasa por debajo.
  "arco-carnaval": { name: "Arco del carnaval", size: [4, 1], fixed: true, blocks: [[0, 0], [3, 0]] },
  "arco-carnaval-y": { name: "Arco del carnaval", size: [1, 5], fixed: true, blocks: [[0, 0], [0, 4]] },
  // Figuras de papel maché en poste: el danzante y el cuy.
  "muneco-carnaval": { name: "Danzante de papel maché", size: [1, 1] },
  "cuy-carnaval": { name: "Cuy de papel maché", size: [1, 1] },
  // Un racimo de globos amarrado a su saquito.
  "globos-carnaval": { name: "Globos", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
