// El observatorio del jardín: la torre por fuera (en su zócalo de piedra, con la cúpula que se abre de
// noche) y lo de afuera (la fogata de malvaviscos, los banderines, el cohete de madera, los postes con
// cables, el cartel, el reloj de sol y los telescopios chicos del prado), y lo de adentro del nivel `observatorio` (el orrery, el telescopio de latón, la escalera de
// caracol, las vitrinas, el radar de señales y el escritorio del diario). Dibujos en art/observatorio.ts
// (la torre, que tiene versión de noche, en art/observatorio-exterior.ts).
import type { CatalogItem } from "./catalog";

/** Luz cálida de farol y de lámpara de aceite. */
const WARM = { color: "#ffc76a" };

export const OBSERVATORIO_CATALOG = {
  // La torre: el zócalo de piedra, la torre redonda y la cúpula de tablas. La luz son los faroles de la puerta.
  observatory: { name: "Observatorio", size: [8, 8], fixed: true, hasNight: true, light: { at: [64, 100, 34], ...WARM, radius: 72 } },
  // Afuera: la fogata con su anillo de piedras (el fuego lo anima el cliente, como el de la fogata grande).
  "marshmallow-fire": { name: "Fogata de malvaviscos", size: [2, 2], light: { at: [16, 16, 10], color: "#ff9a4a", radius: 64 } },
  // Banderines colgados entre dos palos (solo los palos estorban: por debajo se pasa).
  bunting: { name: "Banderines", size: [1, 4], blocks: [[0, 0], [0, 3]] },
  // El cohete de madera en su plataforma de lanzamiento (con un farolito de noche).
  "toy-rocket": { name: "Cohete de madera", size: [2, 2], light: { at: [4, 28, 10], ...WARM, radius: 30 } },
  // Poste de madera con el cable que va al siguiente (cuatro tiles más allá); el último no lleva cable.
  "cable-pole": { name: "Poste con cables", size: [1, 4], blocks: [[0, 0]] },
  "cable-pole-end": { name: "Poste", size: [1, 1] },
  // Letrero de tabla del sendero.
  "observatory-sign": { name: "Letrero del observatorio", size: [1, 1] },
  // El cartel grande de la entrada ("OBSERVATORIO" sobre azul noche), en dos palos, con un farolito arriba.
  "observatory-board": { name: "Cartel del observatorio", size: [1, 4], fixed: true, light: { at: [8, 32, 40], ...WARM, radius: 40 } },
  // Reloj de sol de piedra y latón, y el telescopio chico en su trípode para mirar estrellas en el prado.
  sundial: { name: "Reloj de sol", size: [1, 1] },
  "stargazer-scope": { name: "Telescopio de trípode", size: [1, 1] },
  // Adentro.
  orrery: { name: "Orrery", size: [2, 2], light: { at: [16, 16, 22], ...WARM, radius: 34 } },
  "brass-telescope": { name: "Telescopio de latón", size: [2, 2] },
  "spiral-stairs": { name: "Escalera de caracol", size: [2, 2], fixed: true },
  "rock-case": { name: "Vitrina de piedras", size: [1, 2], light: { at: [8, 16, 24], color: "#ffe2a0", radius: 26 } },
  "fossil-case": { name: "Vitrina de fósiles", size: [1, 2], light: { at: [8, 16, 24], color: "#ffe2a0", radius: 26 } },
  "signal-radar": { name: "Radar de señales", size: [1, 2], light: { at: [8, 20, 22], color: "#9fe8c0", radius: 30 } },
  "log-desk": { name: "Escritorio del diario", size: [1, 2], light: { at: [8, 6, 26], ...WARM, radius: 38 } },
  "celestial-globe": { name: "Globo celeste", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
