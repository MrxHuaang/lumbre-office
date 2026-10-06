// Plantas de interior (dibujos en art/plantas.ts): para que cada sala no tenga la misma planta de
// siempre. Todas ocupan un tile y bloquean el paso, como "plant".
import type { CatalogItem } from "./catalog";

export const PLANTAS_CATALOG = {
  "snake-plant": { name: "Lengua de suegra", size: [1, 1] },
  "fiddle-fig": { name: "Ficus lira", size: [1, 1] },
  kentia: { name: "Palma de interior", size: [1, 1] },
  "boston-fern": { name: "Helecho en pedestal", size: [1, 1] },
  pothos: { name: "Potus", size: [1, 1] },
  succulents: { name: "Suculentas", size: [1, 1] },
  orchid: { name: "Orquídea", size: [1, 1] },
  "olive-tree": { name: "Olivo", size: [1, 1] },
  "column-cactus": { name: "Cactus de columna", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
