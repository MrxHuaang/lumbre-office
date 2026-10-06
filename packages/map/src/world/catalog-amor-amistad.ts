// Amor y amistad (dibujos en art/amor-amistad.ts): lo que el festival pone en el jardín el día 7 de la
// primavera. Nada de esto está puesto en un nivel: lo coloca el festival (world/festivales/amor-amistad.ts).
// Todo es fijo: lo de enfrente mira a +y, donde se para la gente.
import type { CatalogItem } from "./catalog";

export const AMOR_CATALOG = {
  // El cofre del amigo secreto (delante, el punto `amigo_secreto`).
  "amigo-cofre": { name: "Cofre del amigo secreto", size: [1, 1], fixed: true },
  // El puesto de chocolates y flores, con su toldo a rayas (delante, el punto del puesto).
  "puesto-amor": { name: "Puesto de chocolates y flores", size: [2, 1], fixed: true, seeThrough: true },
  // La banca de los enamorados: para dos, mirando a la cámara, con el arco de corazón detrás.
  "banca-enamorados": { name: "Banca de los enamorados", size: [2, 1], fixed: true, seats: [[0, 0, "down"], [1, 0, "down"]] },
  // Guirnalda de corazones entre dos postes: 3 tiles a lo largo de x; se pasa por el del medio.
  "guirnalda-corazones": { name: "Guirnalda de corazones", size: [3, 1], fixed: true, seeThrough: true, blocks: [[0, 0], [2, 0]] },
  // El arco de flores del patio: 5 tiles a lo largo de x; se pasa por los tres del medio.
  "arco-corazones": { name: "Arco de flores", size: [5, 1], fixed: true, seeThrough: true, blocks: [[0, 0], [4, 0]] },
  "globos-corazon": { name: "Globos de corazón", size: [1, 1], fixed: true },
  // Farol de papel en forma de corazón (el farol queda hacia +x), prendido de noche.
  "farol-rosado": { name: "Farol rosado", size: [1, 1], fixed: true, hasNight: true, light: { at: [12, 8, 26], color: "#ff9ec0", radius: 44 } },
} satisfies Record<string, CatalogItem>;
