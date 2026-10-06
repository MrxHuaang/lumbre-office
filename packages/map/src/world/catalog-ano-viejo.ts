// El Año viejo (dibujos en art/ano-viejo.ts): lo que el festival pone el día 21 del invierno en la plaza del
// patio (el brasero de piedra, la silla del muñeco, el cartel de los testamentos, el puesto de uvas y
// maletas, guirnaldas y faroles), los letreritos de las paradas de la maleta y el costal de aserrín del
// taller. Nada de esto está en un nivel: lo coloca el festival (world/festivales/ano-viejo.ts). Todo es fijo;
// lo de enfrente mira a +y, donde se para la gente.
import type { CatalogItem } from "./catalog";

export const ANO_VIEJO_CATALOG = {
  // Brasero redondo de piedra, seguro: ahí se quema el muñeco (el fuego lo pone la escena).
  "brasero-piedra": { name: "Brasero de piedra", size: [2, 2], fixed: true, hasNight: true, light: { at: [16, 16, 10], color: "#ff9a4a", radius: 36 } },
  // La silla del muñeco (el muñeco, que crece por etapas, lo pone la escena encima).
  "silla-muneco": { name: "Silla del muñeco", size: [1, 1], fixed: true },
  // El cartel de los testamentos, con papelitos clavados.
  "cartel-testamentos": { name: "Cartel de los testamentos", size: [2, 1], fixed: true },
  // El puesto de uvas y maletas, con el toldo amarillo.
  "puesto-uvas": { name: "Puesto de uvas y maletas", size: [2, 1], fixed: true, seeThrough: true },
  // Poste con guirnaldas doradas y amarillas.
  "guirnalda-ano": { name: "Guirnaldas de año viejo", size: [1, 1], fixed: true },
  // Farol de papel amarillo en su poste (el farol hacia +x), prendido de noche.
  "farol-ano": { name: "Farol de año viejo", size: [1, 1], fixed: true, hasNight: true, light: { at: [12, 8, 25], color: "#ffd24a", radius: 44 } },
  // El letrerito de una parada de la vuelta de la maleta.
  "parada-maleta": { name: "Parada de la maleta", size: [1, 1], fixed: true },
  // El costal de aserrín del taller (relleno para el muñeco).
  "costal-aserrin": { name: "Costal de aserrín", size: [1, 1], fixed: true },
} satisfies Record<string, CatalogItem>;
