// El Carnaval de Negros y Blancos (dibujos en art/carnaval.ts): la decoración que el festival pone en la
// vereda de la calle del Megabús. Nada de esto está puesto en un nivel: lo coloca el festival. Las
// carrozas no son muebles (las mueve el desfile, ver packages/map/src/carnaval.ts).
import type { CatalogItem } from "./catalog";

export const CARNAVAL_CATALOG = {
  // Una guirnalda de banderines entre dos postes: puestos en fila se juntan. Se pasa por debajo.
  "banderines-carnaval": { name: "Banderines de carnaval", size: [1, 1], solid: false },
  // Farol de papel blanco con rayas negras; de noche, prendido.
  "farol-carnaval": { name: "Farol de carnaval", size: [1, 1], hasNight: true, light: { at: [8, 8, 34], color: "#ffd27a", radius: 44 } },
  // El palco del jurado: la tarima con su arco y el atril (el concurso de disfraces se ve ahí).
  "tarima-comparsa": { name: "Tarima de la comparsa", size: [3, 2], fixed: true },
  // El puesto de máscaras, maicena y serpentinas.
  "puesto-carnaval": { name: "Puesto del carnaval", size: [2, 1], fixed: true },
  // Mascarón de papel maché en su poste (a los lados del portón).
  mascaron: { name: "Mascarón", size: [1, 1] },
  // Serpentinas y confeti en el pasto.
  "serpentinas-suelo": { name: "Serpentinas", size: [1, 1], solid: false },
} satisfies Record<string, CatalogItem>;
