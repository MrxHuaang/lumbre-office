// El estudio de grabación (el nivel `podcast`, se entra por la puerta del final del pasillo del piso 3).
// Dibujos en art/podcast.ts (muebles) y art/podcast-room.ts (lo que cuelga en las paredes). Las reglas
// (grabar con el permiso de todos, el cupo, la puerta cerrada mientras tanto) están en @hyvento/shared
// (podcast.ts) y las valida el servidor.
import type { CatalogItem } from "./catalog";

export const PODCAST_CATALOG = {
  // La mesa grande con un micrófono de brazo y unos audífonos por puesto (ocho sillas alrededor). Fija:
  // los micrófonos están dibujados mirando a cada silla.
  "podcast-table": { name: "Mesa de grabación", size: [4, 2], fixed: true },
  // La consola de mezcla en la cabecera de la mesa: "E · Grabar" (el punto `podcast` está a su lado).
  "podcast-console": { name: "Consola de mezcla", size: [1, 2], fixed: true, light: { at: [8, 16, 18], color: "#ffb45a", radius: 30 } },
  // El escritorio con el monitor de código verde, el teclado mecánico y el pato de goma.
  "podcast-code-desk": { name: "Escritorio del código", size: [1, 2], light: { at: [6, 16, 24], color: "#9be08a", radius: 30 } },
  "podcast-shelf": { name: "Repisa de los planetas", size: [1, 3] },
  "podcast-rocket": { name: "Cohete de madera", size: [1, 1] },
  // El cristal que brilla sobre su pedestal (de noche ilumina el rincón).
  "podcast-crystal": { name: "Cristal brillante", size: [1, 1], light: { at: [8, 8, 30], color: "#8fe6ff", radius: 44 } },
  "podcast-rug": { name: "Alfombra de estrellas", size: [6, 4], solid: false, flat: true },
  "podcast-cables": { name: "Cables", size: [2, 1], solid: false, flat: true },
} satisfies Record<string, CatalogItem>;
