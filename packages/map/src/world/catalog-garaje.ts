// El garaje del jardín: el edificio de afuera y lo de adentro (el taller y la oficina descuidada). Dibujos
// en art/garaje.ts (el edificio, que tiene versión de noche, en art/garaje-exterior.ts).
import type { CatalogItem } from "./catalog";

/** Foco pelado: luz amarilla y corta, de bombillo viejo. */
const BULB = { color: "#ffc76a" };

export const GARAJE_CATALOG = {
  // El edificio: bloque de cemento con techo de chapa, el portón enrollable y la puerta chica al frente
  // (+y). La luz es el foco sobre la puerta chica.
  garage: { name: "Garaje", size: [5, 5], fixed: true, hasNight: true, light: { at: [54, 79, 31], ...BULB, radius: 52 } },
  // Taller.
  workbench: { name: "Banco de trabajo", size: [1, 3] },
  "metal-shelf": { name: "Estante metálico", size: [1, 2] },
  "tire-stack": { name: "Pila de llantas", size: [1, 1] },
  "tool-chest": { name: "Caja de herramientas", size: [1, 1] },
  compressor: { name: "Compresor", size: [1, 1] },
  "oil-drum": { name: "Tambor de aceite", size: [1, 1] },
  "cardboard-boxes": { name: "Cajas de cartón", size: [1, 1] },
  "paint-cans": { name: "Latas de pintura", size: [1, 1] },
  "broom-corner": { name: "Escoba y trapos", size: [1, 1] },
  "tarp-car": { name: "Carro tapado", size: [2, 3] },
  // El reflector de obra en su trípode: la luz del taller.
  "work-light": { name: "Reflector de obra", size: [1, 1], light: { at: [12, 8, 37], ...BULB, radius: 64 } },
  // Oficina: el escritorio con el computador viejo (se prende Hyvento OS; la luz es su lámpara de brazo) y
  // la silla rota, que igual gira.
  "desk-crt": { name: "Escritorio con computador viejo", size: [1, 2], computer: true, light: { at: [7, 27, 24], ...BULB, radius: 40 } },
  "office-chair-broken": { name: "Silla de oficina rota", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "filing-dented": { name: "Archivador abollado", size: [1, 1] },
  "dead-plant": { name: "Planta seca", size: [1, 1] },
  "floor-fan": { name: "Ventilador", size: [1, 1] },
  "worn-rug": { name: "Tapete gastado", size: [2, 3], solid: false, flat: true },
} satisfies Record<string, CatalogItem>;
