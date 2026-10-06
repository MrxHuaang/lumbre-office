// La Feria de la cosecha (dibujos en art/cosecha.ts): el mercado campesino que el festival pone en el
// jardín el día 10 del otoño (world/festivales/cosecha.ts). Lo de los puestos es fijo y mira a +y, donde
// se para la gente; el canasto de mimbre y la carreta de la tómbola se llevan a la oficina con Decorar.
import type { CatalogItem } from "./catalog";

/** El fogón de leña de la olla: de noche alumbra el patio. */
const FOGON = { color: "#ff9a4a", radius: 58 };

export const COSECHA_CATALOG = {
  // Los cinco puestos del mercado: el mostrador de tablas con lo de cada uno y el toldo de su color.
  "puesto-cosecha-rojo": { name: "Puesto de los tubérculos", size: [2, 1], fixed: true, seeThrough: true },
  "puesto-cosecha-amarillo": { name: "Puesto de las frutas", size: [2, 1], fixed: true, seeThrough: true },
  "puesto-cosecha-verde": { name: "Puesto de granos y semillas", size: [2, 1], fixed: true, seeThrough: true },
  "puesto-cosecha-naranja": { name: "Puesto de las arepas de choclo", size: [2, 1], fixed: true, seeThrough: true },
  "puesto-cosecha-azul": { name: "Puesto de ahuyamas y canastos", size: [2, 1], fixed: true, seeThrough: true },
  // La olla grande del sancocho sobre su fogón de piedras (de noche el fuego alumbra).
  "olla-sancocho": { name: "Olla del sancocho", size: [2, 2], fixed: true, hasNight: true, light: { at: [16, 16, 4], ...FOGON } },
  // La báscula de plataforma del concurso y el tablero con las más pesadas.
  bascula: { name: "Báscula del concurso", size: [2, 1], fixed: true },
  "tablero-cosecha": { name: "Tablero del concurso", size: [1, 1], fixed: true },
  // La tómbola de la junta: la mesa con la ruleta de colores.
  tombola: { name: "Tómbola de la junta", size: [2, 1], fixed: true },
  // Adornos: bultos de papa, canastos llenos, el poste con la guirnalda de mazorcas y el arco de mazorcas
  // sobre el camino (5 tiles a lo largo de x; se pasa por los tres del medio).
  "bulto-papa": { name: "Bulto de papa", size: [1, 1], fixed: true },
  "canasto-lleno": { name: "Canasto de la cosecha", size: [1, 1], fixed: true },
  "poste-mazorcas": { name: "Poste de mazorcas", size: [1, 1], fixed: true },
  "arco-mazorcas": { name: "Arco de mazorcas", size: [5, 1], fixed: true, seeThrough: true, blocks: [[0, 0], [4, 0]] },
  // Lo que se lleva a la oficina: el canasto de mimbre del puesto de Valentina y el premio de la tómbola.
  "canasto-mimbre": { name: "Canasto de mimbre", size: [1, 1] },
  "carreta-cosecha": { name: "Carreta de la cosecha", size: [2, 1] },
} satisfies Record<string, CatalogItem>;

/** El mueble de cada puesto según el color de su toldo (cosecha.ts de @hyvento/shared). */
export const PUESTO_COSECHA_TIPO = {
  rojo: "puesto-cosecha-rojo",
  amarillo: "puesto-cosecha-amarillo",
  verde: "puesto-cosecha-verde",
  naranja: "puesto-cosecha-naranja",
  azul: "puesto-cosecha-azul",
} as const;
