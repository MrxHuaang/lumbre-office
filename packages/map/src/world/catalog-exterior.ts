// El exterior rediseñado: la casa nueva, naturaleza, lago, huerto e invernadero (dibujos en art/exterior.ts).
import type { CatalogItem } from "./catalog";

/** Farolitos y faroles: luz cálida de noche. */
const LANTERN_LIGHT = { color: "#ffd98a", radius: 44 };

export const EXTERIOR_CATALOG = {
  // La casa: 22x14, con el porche (y la puerta) hacia +y. La luz es el farol colgado del porche.
  house: { name: "Casa", size: [22, 14], fixed: true, hasNight: true, light: { at: [180, 226, 34], color: "#ffd98a", radius: 64 } },
  // El invernadero se entra por la puerta del frente (+y, tile x = 2): la base va plana, las paredes y el
  // techo de vidrio son otra pieza encima (se transparenta con alguien adentro) y los bancales, muebles
  // aparte. Bloquean los rincones del frente, a los lados de la puerta, y la columna este (macetas).
  greenhouse: {
    name: "Invernadero",
    size: [5, 4],
    fixed: true,
    flat: true,
    blocks: [
      [0, 3],
      [1, 3],
      [3, 3],
      [4, 3],
      [4, 0],
      [4, 1],
      [4, 2],
    ],
  },
  "greenhouse-roof": { name: "Vidrio del invernadero", size: [5, 4], fixed: true, solid: false, seeThrough: true },
  "greenhouse-bed": { name: "Bancal del invernadero", size: [1, 1] },
  "tool-shed": { name: "Cobertizo", size: [3, 3], fixed: true },
  // La glorieta se entra por el frente (+x): la base (piso y bancas) va plana y el techo con los postes
  // es otra pieza encima, en el mismo lugar. Bloquean los rincones (fuera de la baranda) y la banca en
  // herradura, cuyos asientos miran al centro.
  gazebo: {
    name: "Glorieta",
    size: [4, 4],
    fixed: true,
    flat: true,
    blocks: [
      [0, 0],
      [3, 0],
      [0, 3],
      [3, 3],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
      [1, 3],
      [2, 3],
    ],
    seats: [
      [0, 1, "right"],
      [0, 2, "right"],
      [1, 0, "down"],
      [2, 0, "down"],
      [1, 3, "up"],
      [2, 3, "up"],
    ],
  },
  "gazebo-roof": { name: "Techo de la glorieta", size: [4, 4], fixed: true, solid: false, seeThrough: true, hasNight: true, light: { at: [32, 32, 30], ...LANTERN_LIGHT } },
  pergola: { name: "Pérgola", size: [3, 3], fixed: true, light: { at: [24, 24, 40], ...LANTERN_LIGHT } },
  "garden-gate": { name: "Portón", size: [2, 1], fixed: true, light: { at: [16, 7, 28], ...LANTERN_LIGHT } },
  "fence-post": { name: "Poste de la cerca", size: [1, 1] },
  // Huerto.
  well: { name: "Pozo", size: [2, 2] },
  beehive: { name: "Colmena", size: [1, 1] },
  compost: { name: "Compostera", size: [1, 2] },
  barrel: { name: "Barril", size: [1, 1] },
  crates: { name: "Cajones", size: [1, 1] },
  wheelbarrow: { name: "Carretilla", size: [1, 1] },
  // Terraza, fogata y lago.
  woodpile: { name: "Leñera", size: [1, 3] },
  "fire-pit": { name: "Fogata", size: [2, 2], light: { at: [16, 16, 10], color: "#ff9a4a", radius: 70 } },
  "log-seat": { name: "Tronco", size: [1, 2], seats: [[0, 0], [0, 1]] },
  "picnic-table": { name: "Mesa de picnic", size: [1, 2] },
  "picnic-bench": { name: "Banca de picnic", size: [1, 2], seats: [[0, 0], [0, 1]] },
  "patio-table": { name: "Mesa de terraza", size: [1, 1] },
  "patio-chair": { name: "Silla de terraza", size: [1, 1], seats: [[0, 0]], hasBack: true },
  "garden-lantern": { name: "Farolito", size: [1, 1], light: { at: [8, 8, 26], ...LANTERN_LIGHT } },
  "dock-lamp": { name: "Farol del muelle", size: [1, 1], light: { at: [13, 8, 20], ...LANTERN_LIGHT } },
  signpost: { name: "Letrero", size: [1, 1] },
  rowboat: { name: "Bote", size: [1, 2] },
  reeds: { name: "Juncos", size: [1, 1] },
  // Planos: se pisan (los nenúfares flotan en el agua, la piedra plana es para pescar).
  "lily-pad": { name: "Nenúfares", size: [1, 1], solid: false, flat: true },
  "flat-rock": { name: "Piedra plana", size: [1, 1], solid: false, flat: true },
  // Naturaleza: varias versiones de cada cosa para que nada se vea repetido.
  "oak-1": { name: "Roble", size: [1, 1] },
  "oak-2": { name: "Roble", size: [1, 1] },
  "oak-3": { name: "Roble", size: [1, 1] },
  "oak-big": { name: "Roble viejo", size: [2, 2] },
  "pine-1": { name: "Pino", size: [1, 1] },
  "pine-2": { name: "Pino", size: [1, 1] },
  "pine-3": { name: "Pino", size: [1, 1] },
  "birch-1": { name: "Abedul", size: [1, 1] },
  "birch-2": { name: "Abedul", size: [1, 1] },
  "apple-tree": { name: "Manzano", size: [1, 1] },
  "peach-tree": { name: "Duraznero", size: [1, 1] },
  "cherry-tree": { name: "Cerezo", size: [1, 1] },
  "bush-rose": { name: "Rosal", size: [1, 1] },
  "bush-hydrangea": { name: "Hortensia", size: [1, 1] },
  "bush-berry": { name: "Arbusto de moras", size: [1, 1] },
  "bush-round": { name: "Arbusto", size: [1, 1] },
  "flower-patch": { name: "Macizo de flores", size: [1, 1] },
  wildflowers: { name: "Flores silvestres", size: [1, 1], solid: false },
  fern: { name: "Helecho", size: [1, 1], solid: false },
  "tall-grass": { name: "Pasto alto", size: [1, 1], solid: false },
  planter: { name: "Jardinera", size: [1, 1] },
  mushrooms: { name: "Hongos", size: [1, 1], solid: false },
  "rock-small": { name: "Piedra", size: [1, 1] },
  "rock-medium": { name: "Roca", size: [1, 1] },
  "rock-mossy": { name: "Roca con musgo", size: [1, 1] },
  boulder: { name: "Peñasco", size: [2, 2] },
  "fallen-log": { name: "Tronco caído", size: [1, 3] },
  stump: { name: "Tocón", size: [1, 1] },
} satisfies Record<string, CatalogItem>;
