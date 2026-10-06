// La música del Carnaval de Negros y Blancos (VIR-174, docs/plan-carnaval.md): qué piezas hay, qué conjunto
// las toca y qué repertorio rota cada grupo del desfile. Lo que suena (las notas y los instrumentos
// sintetizados) vive en el navegador (apps/web/src/game/carnaval/musica*.ts); aquí, solo los nombres.
//
// Dos conjuntos, como en Pasto:
//   - la murga: bronces (trompeta, saxo, trombón), acordeón y la percusión al frente (bombo, redoblante,
//     platillos, timbales, güiro, guasá, campana), con los cortes que levantan a la gente;
//   - el colectivo andino: quena, zampoña, rondador, bombo y shekere.
// Todo es original salvo La Guaneña (tradicional nariñense, de dominio público).
import type { CarrozaId } from "./carnaval";

export const PIEZAS = [
  // De la murga.
  "son-vereda",
  "son-cuy",
  "sanjuanito-plaza",
  "guanena-murga",
  // Del colectivo andino.
  "sanjuanito",
  "guanena",
  "bambuco",
] as const;
export type PiezaId = (typeof PIEZAS)[number];

export type Conjunto = "murga" | "colectivo";

export const CONJUNTO_DE: Record<PiezaId, Conjunto> = {
  "son-vereda": "murga",
  "son-cuy": "murga",
  "sanjuanito-plaza": "murga",
  "guanena-murga": "murga",
  sanjuanito: "colectivo",
  guanena: "colectivo",
  bambuco: "colectivo",
};

/** El orden en que rota cada conjunto (cada grupo empieza en un punto distinto: `repertorioDe`). */
export const REPERTORIO: Record<Conjunto, readonly PiezaId[]> = {
  murga: ["son-vereda", "sanjuanito-plaza", "son-cuy", "guanena-murga"],
  colectivo: ["sanjuanito", "bambuco", "guanena"],
};

/**
 * El repertorio de un grupo: el de su conjunto, empezando por `pieza` y corrido `k` lugares (el puesto del
 * grupo en el desfile), para que dos grupos seguidos no toquen lo mismo a la vez.
 */
export function repertorioDe(pieza: PiezaId, k = 0): PiezaId[] {
  const lista = REPERTORIO[CONJUNTO_DE[pieza]];
  const i0 = lista.indexOf(pieza) + k;
  return lista.map((_, i) => lista[(((i0 + i) % lista.length) + lista.length) % lista.length]!);
}

/** Una murga del desfile (ficticia): va detrás de una carroza y rota el repertorio de la murga. */
export interface Murga {
  id: string;
  nombre: string;
  /** La carroza detrás de la cual va. */
  tras: CarrozaId;
  repertorio: readonly PiezaId[];
}

export const MURGAS: readonly Murga[] = [
  { id: "murga-ruana", nombre: "Murga La Ruana Sonora", tras: "condor", repertorio: repertorioDe("son-vereda") },
  { id: "murga-cuyes", nombre: "Murga Los Cuyes del Barrio", tras: "reloj", repertorio: repertorioDe("sanjuanito-plaza") },
  { id: "murga-tambores", nombre: "Murga Tambores del Volcán", tras: "minga", repertorio: repertorioDe("guanena-murga") },
];

/** Los sonidos de cinemática que son música del Carnaval y la pieza que tocan (un trozo). */
export const CINE_MUSICA = { guanena: "guanena", murga: "son-vereda" } as const satisfies Record<string, PiezaId>;
