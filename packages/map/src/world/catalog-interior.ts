// Los interiores rediseñados de la planta baja y los pisos 2 y 3 (dibujos en art/interior.ts).
// Mismo convenio que catalog.ts: el tamaño es mirando hacia "right" (el frente hacia +x), así que
// `size[1]` es el ancho del mueble; contra la pared norte van con "down" y contra la oeste con "right".
import type { CatalogItem } from "./catalog";

export const INTERIOR_CATALOG = {
  // Biblioteca y salas.
  "bookcase-tall": { name: "Estantería alta", size: [1, 2] },
  "curio-cabinet": { name: "Vitrina", size: [1, 2] },
  // La vitrina de trofeos de cada oficina (los trofeos del dueño se pintan encima, en el cliente).
  "trophy-case": { name: "Vitrina de trofeos", size: [1, 2] },
  "library-ladder": { name: "Escalerita", size: [1, 1] },
  "reading-table": { name: "Mesa de lectura", size: [2, 4], light: { at: [16, 32, 22], color: "#b8f08a", radius: 54 } },
  "fireplace-stone": { name: "Chimenea de piedra", size: [1, 3], light: { at: [8, 24, 8], color: "#ff9a4a", radius: 70 } },
  "sofa-leather": { name: "Sofá de cuero", size: [1, 3], seats: [[0, 0], [0, 1], [0, 2]], hasBack: true },
  "armchair-wing": { name: "Sillón orejero", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "reading-lamp": { name: "Lámpara de lectura", size: [1, 1], light: { at: [12, 8, 34], color: "#ffd98a", radius: 40 } },
  "blanket-basket": { name: "Cesta con mantas", size: [1, 1] },
  "grandfather-clock": { name: "Reloj de pie", size: [1, 1] },
  hammock: { name: "Hamaca", size: [1, 2], seats: [[0, 0], [0, 1]] },
  "chess-table": { name: "Mesa de ajedrez", size: [1, 1] },
  "puzzle-table": { name: "Mesa con puzle", size: [1, 2] },
  "game-shelf": { name: "Estante de juegos", size: [1, 2] },
  sideboard: { name: "Aparador", size: [1, 2] },
  "rug-persian": { name: "Alfombra persa", size: [4, 6], solid: false, flat: true },
  runner: { name: "Alfombra de pasillo", size: [1, 6], solid: false, flat: true },
  // Recibidor, guardarropa y baños.
  "reception-desk": { name: "Recepción", size: [1, 3] },
  "console-table": { name: "Consola", size: [1, 2] },
  "entry-bench": { name: "Banca con zapatera", size: [1, 2], seats: [[0, 0], [0, 1]] },
  "umbrella-stand": { name: "Paragüero", size: [1, 1] },
  "entry-table": { name: "Mesa del recibidor", size: [1, 1] },
  toilet: { name: "Inodoro", size: [1, 1] },
  vanity: { name: "Lavamanos", size: [1, 1] },
  // Cubículo con puerta: el inodoro queda adentro y no a la vista.
  "toilet-stall": { name: "Cubículo del baño", size: [2, 1] },
  "floor-mirror": { name: "Espejo de pie", size: [1, 1] },
  // Cafetería, cocina y la zona de descanso.
  backbar: { name: "Estante del bar", size: [1, 2] },
  "kitchen-counter": { name: "Mesón", size: [1, 1] },
  "kitchen-sink": { name: "Lavaplatos", size: [1, 1] },
  stove: { name: "Estufa", size: [1, 1], light: { at: [8, 8, 30], color: "#ffcf80", radius: 30 } },
  fridge: { name: "Nevera", size: [1, 1] },
  "kitchen-island": { name: "Isla de cocina", size: [2, 3] },
  "pantry-shelf": { name: "Despensa", size: [1, 2] },
  "coffee-station": { name: "Cafetera de oficina", size: [1, 1] },
  "high-table": { name: "Mesa alta", size: [1, 1] },
  "water-cooler": { name: "Dispensador de agua", size: [1, 1] },
  "cafe-sign": { name: "Pizarra de pie", size: [1, 1] },
  // El corcho de las fotos (dibujo en art/photos.ts; las fotos se pinchan encima en el cliente).
  "photo-board": { name: "Tablón de fotos", size: [1, 3] },
  "coffee-sacks": { name: "Sacos de café", size: [1, 1] },
  "prep-table": { name: "Mesa de preparación", size: [1, 2] },
  "dish-hutch": { name: "Alacena", size: [1, 2] },
  // Trabajo.
  "conference-table": { name: "Mesa de juntas", size: [2, 5] },
  "filing-cabinet": { name: "Archivador", size: [1, 1] },
  printer: { name: "Impresora", size: [1, 1] },
  // Afuera (balcón y terraza).
  railing: { name: "Baranda", size: [1, 1], hasBack: true },
  // Esquina del balcón y la terraza: los dos lados en un mueble (de frente la sureste, de espaldas la suroeste).
  "railing-corner": { name: "Baranda de esquina", size: [1, 1], hasBack: true },
  "deck-chair": { name: "Tumbona", size: [2, 1], seats: [[0, 0]], hasBack: true },
  telescope: { name: "Telescopio", size: [1, 1] },
  "balcony-planter": { name: "Jardinera del balcón", size: [1, 2] },
} satisfies Record<string, CatalogItem>;
