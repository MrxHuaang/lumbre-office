// Casa viva: los muebles nuevos para que la casa se sienta habitada (la escalera del balcón, la radio,
// las camas de las mascotas…). Dibujos en art/casa-viva.ts; qué se hace con cada uno, en
// packages/shared/src/casa.ts.
import type { CatalogItem } from "./catalog";

export const CASA_CATALOG = {
  // La salida del balcón del piso 2 a la escalera exterior del jardín: se pisa (es el portal) y el
  // dibujo baja hacia +x, fuera del balcón.
  "balcony-stair": { name: "Escalera al jardín", size: [1, 1], solid: false, fixed: true },
  // Radio de mesa (música para la cocina y la zona de descanso).
  radio: { name: "Radio", size: [1, 1] },
  // Camas de las mascotas (se pisan: la mascota duerme encima).
  "pet-bed": { name: "Cama de mascota", size: [1, 1], solid: false },
  "dog-house": { name: "Casita del perro", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
