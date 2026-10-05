// La Noche de brujas: los dulces, la canasta de dulce o truco y la calabaza dorada (dibujos en
// packages/map/src/art/items.ts). Aquí solo cómo se llaman, cómo se comen y cuánto se lleva; quién los
// reparte y cuándo es cosa del festival.
import type { BagObject } from "./bolsa";
import type { ConsumeAction } from "./consumables";

/** Los dulces que se reciben pidiendo dulce o truco (ids de items.ts). */
export const DULCES = ["chocolatina-brujas", "chupeta", "bombon", "gomitas", "masmelo"] as const;
export type Dulce = (typeof DULCES)[number];

/** La canasta para recibir dulces: se lleva en la mano mientras se pide. */
export const CANASTA_DULCES = "canasta-dulces";
/** El premio de la Noche de brujas: no se come, se guarda. */
export const CALABAZA_DORADA = "calabaza-dorada";

export const BRUJAS_BAG_OBJECTS: Record<string, BagObject> = {
  "chocolatina-brujas": { name: "Chocolatina de brujas", blurb: "Envuelta en papel naranja con su murcielaguito. Se derrite en la mano si te demoras.", kind: "comida", max: 30 },
  chupeta: { name: "Chupeta", blurb: "Redondita y de espiral, naranja y crema. Dura más que la Noche de brujas.", kind: "comida", max: 30 },
  bombon: { name: "Bombón", blurb: "De chocolate, envuelto en papel morado con las puntas torcidas.", kind: "comida", max: 30 },
  gomitas: { name: "Gomitas", blurb: "Una bolsita de gomitas de colores. Nadie se come solo una.", kind: "comida", max: 30 },
  masmelo: { name: "Masmelo", blurb: "Rosadito y blanco, trenzado y bien suavecito.", kind: "comida", max: 30 },
  [CANASTA_DULCES]: {
    name: "Canasta de dulce o truco",
    blurb: "Una ahuyama de plástico con asa. Llévala en la mano para recibir dulces en la Noche de brujas.",
    kind: "herramienta",
    max: 1,
    durable: true,
  },
  [CALABAZA_DORADA]: { name: "Calabaza dorada", blurb: "El premio de la Noche de brujas. Brilla aunque sea de día.", kind: "objeto", max: 10 },
  // El de recuerdo, del puesto del festival (el que se pone está en el vestidor, gratis).
  "sombrero-bruja": { name: "Sombrero de bruja", blurb: "Negro, de ala ancha y con la punta doblada. Del puesto del caldero, de recuerdo.", kind: "objeto", max: 1 },
};

/** Los dulces se comen a mordiscos (se suman a CONSUMABLES). */
export const BRUJAS_CONSUMABLES: Record<Dulce, { action: ConsumeAction; uses: number }> = {
  "chocolatina-brujas": { action: "bite", uses: 2 },
  chupeta: { action: "bite", uses: 3 },
  bombon: { action: "bite", uses: 2 },
  gomitas: { action: "bite", uses: 3 },
  masmelo: { action: "bite", uses: 2 },
};
