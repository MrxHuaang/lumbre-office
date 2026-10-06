// La decoración de la Feria de la cosecha (ver festival-decor.ts): el mercado campesino en el pasto al este
// del camino de piedra, entre la parrilla y el lago (la fila de cinco puestos con sus toldos de colores, la
// báscula y el tablero del concurso de la ahuyama, la tómbola de la junta, bultos de papa, canastos,
// postes con guirnaldas de mazorcas y faroles), la olla del sancocho sobre su fogón en el patio de la casa
// (donde se baila al atardecer) y dos arcos de mazorcas sobre el camino; en el recibidor, canastos. Los
// sitios salen de cosecha.ts de @hyvento/shared (los mismos que usan la gente y la sala). Tiles del nivel.
import { COSECHA_PUESTOS, COSECHA_SITIOS, OLLA_PUNTO, delante, puestoPunto } from "@hyvento/shared";
import type { FestivalDecorDef } from "../../festival-decor";
import { PUESTO_COSECHA_TIPO } from "../catalog-cosecha";
import type { AreaDef, Facing, Placement, PointDef } from "../types";

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

/** Los arcos de mazorcas sobre el camino de piedra (el camino pasa por los tres tiles del medio). */
const ARCOS = [
  { x: 60, y: 53 },
  { x: 60, y: 58 },
];

function jardin(): { furniture: Placement[]; points: PointDef[] } {
  const { olla, bascula, tablero, tombola } = COSECHA_SITIOS;
  const furniture: Placement[] = [
    ...COSECHA_PUESTOS.map((p) => put(PUESTO_COSECHA_TIPO[p.toldo], p.tile.x, p.tile.y)),
    // Entre los puestos, bultos de papa y canastos llenos.
    put("bulto-papa", 79, 50),
    put("canasto-lleno", 83, 50),
    put("bulto-papa", 87, 50),
    put("canasto-lleno", 91, 50),
    put("bulto-papa", 95, 50),
    // El concurso y la tómbola.
    put("bascula", bascula.x, bascula.y),
    put("tablero-cosecha", tablero.x, tablero.y),
    put("tombola", tombola.x, tombola.y),
    put("canasto-lleno", tombola.x - 1, tombola.y),
    // Postes con guirnaldas de mazorcas y faroles en las esquinas del mercado.
    put("poste-mazorcas", 79, 57),
    put("poste-mazorcas", 91, 57),
    put("poste-mazorcas", 100, 53),
    put("feria-lantern", 75, 48),
    put("feria-lantern", 97, 48),
    put("feria-lantern", 75, 56),
    // El patio: la olla con su fogón, bultos y canastos alrededor, y un farol.
    put("olla-sancocho", olla.x, olla.y),
    put("bulto-papa", olla.x + 3, olla.y),
    put("canasto-lleno", olla.x - 2, olla.y + 1),
    // El camino de piedra: los arcos y, al pie de cada uno, ahuyamas y canastos.
    ...ARCOS.map((a) => put("arco-mazorcas", a.x, a.y)),
    ...ARCOS.flatMap((a) => [put("canasto-lleno", a.x - 1, a.y), put("bulto-papa", a.x + 5, a.y)]),
    // El porche.
    put("canasto-lleno", 58, 30),
    put("bulto-papa", 67, 30),
  ];
  const points: PointDef[] = [
    ...COSECHA_PUESTOS.map((p): PointDef => ({ type: "cosecha_puesto", name: p.nombre, ...puestoPunto(p) })),
    { type: "cosecha_olla", name: "Olla del sancocho", ...OLLA_PUNTO },
    { type: "cosecha_bascula", name: "Báscula del concurso", ...delante(bascula) },
    { type: "cosecha_tablero", name: "Tablero del concurso", ...delante(tablero) },
    { type: "cosecha_tombola", name: "Tómbola de la junta", ...delante(tombola) },
  ];
  return { furniture, points };
}

export const COSECHA_DECOR: FestivalDecorDef = {
  areas: ["jardin", "planta-baja"],
  build(def: AreaDef) {
    if (def.id === "jardin") return jardin();
    // El recibidor huele a cosecha: canastos y un bulto contra la pared (sin tapar el paso).
    if (def.id === "planta-baja") return { furniture: [put("canasto-lleno", 18, 18), put("bulto-papa", 18, 19), put("canasto-lleno", 18, 20)] };
    return null;
  },
};

/** El punto de un puesto del mercado → su id (por la posición: van en el orden de `COSECHA_PUESTOS`). */
export function puestoDePunto(p: { tileX: number; tileY: number }): string | null {
  return COSECHA_PUESTOS.find((q) => puestoPunto(q).x === p.tileX && puestoPunto(q).y === p.tileY)?.id ?? null;
}
