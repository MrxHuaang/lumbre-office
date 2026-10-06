// La decoración del Año viejo (ver festival-decor.ts): la plaza del año viejo en el pasto entre el porche y
// el patio (x 66..85, y 30..37 del jardín): el brasero de piedra con la silla del muñeco al lado, el cartel
// de los testamentos, el puesto de uvas y maletas, postes de guirnaldas doradas y faroles amarillos; un
// letrerito junto a cada parada de la vuelta de la maleta; el punto de la paja junto a las pacas del
// gallinero y, en el taller del garaje, el costal de aserrín junto al banco. Todo en tiles del nivel.
import { ANO_VIEJO_PLAZA, MALETA_RUTA } from "@hyvento/shared";
import { furnitureTiles } from "../../decor";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";
import type { AreaDef, Facing, Placement, PointDef } from "../types";

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });
const { brasero: BRASERO, silla: SILLA, cartel: CARTEL, puesto: PUESTO } = ANO_VIEJO_PLAZA;

/** Las pacas de paja del gallinero: el punto para sacar paja va al lado. */
export const PAJA_PUNTO = { x: 12, y: 41 };
/** El costal de aserrín del taller (junto al banco) y su punto, delante. */
export const COSTAL_ASERRIN = { x: 2, y: 1 };

/** Dónde se busca el letrerito, de lo más pegado a lo más lejos (sin pasar de dos tiles). */
const CERCA: readonly (readonly [number, number])[] = [
  [1, -1], [-1, -1], [1, 1], [-1, 1], [2, 0], [-2, 0], [0, -2], [0, 2],
  [2, -1], [-2, -1], [2, 1], [-2, 1], [1, -2], [-1, -2], [1, 2], [-1, 2], [2, -2], [-2, -2], [2, 2], [-2, 2],
];

/**
 * El letrerito de cada parada de la maleta: el primer tile de pasto libre pegado a la parada (sin tapar la
 * parada misma, que se camina).
 */
function letreros(def: AreaDef, otros: readonly Placement[]): Placement[] {
  const taken = new Set([...def.furniture, ...otros].flatMap((f) => furnitureTiles(f).map((t) => `${t.x},${t.y}`)));
  const ocupado = new Set([...def.points.map((p) => `${p.x},${p.y}`), ...MALETA_RUTA.map((p) => `${p.x},${p.y}`)]);
  const out: Placement[] = [];
  for (const p of MALETA_RUTA) {
    for (const [dx, dy] of CERCA) {
      const x = p.x + dx;
      const y = p.y + dy;
      const k = `${x},${y}`;
      if (taken.has(k) || ocupado.has(k) || (def.ground?.(x, y) ?? "grass") !== "grass") continue;
      out.push(put("parada-maleta", x, y));
      taken.add(k);
      break;
    }
  }
  return out;
}

function jardin(def: AreaDef): FestivalDecor {
  const plaza: Placement[] = [
    put("brasero-piedra", BRASERO.x, BRASERO.y),
    put("silla-muneco", SILLA.x, SILLA.y),
    put("cartel-testamentos", CARTEL.x, CARTEL.y),
    put("puesto-uvas", PUESTO.x, PUESTO.y),
    // Las guirnaldas en las cuatro esquinas de la plaza y faroles entre ellas.
    put("guirnalda-ano", 67, 30),
    put("guirnalda-ano", 85, 30),
    put("guirnalda-ano", 67, 37),
    put("guirnalda-ano", 85, 36),
    put("farol-ano", 73, 30),
    put("farol-ano", 66, 34),
    put("farol-ano", 76, 37),
    put("farol-ano", 83, 34),
  ];
  const points: PointDef[] = [
    { type: "ano_viejo_muneco", name: "El muñeco de año viejo", x: SILLA.x, y: SILLA.y + 1 },
    { type: "ano_viejo_cartel", name: "Cartel de los testamentos", x: CARTEL.x, y: CARTEL.y + 1 },
    { type: "festival_shop", name: "Puesto de uvas y maletas", x: PUESTO.x, y: PUESTO.y + 1 },
    { type: "ano_viejo_relleno", name: "Paja del gallinero", x: PAJA_PUNTO.x, y: PAJA_PUNTO.y },
  ];
  return { furniture: [...plaza, ...letreros(def, plaza)], points };
}

export const ANO_VIEJO_DECOR: FestivalDecorDef = {
  areas: ["jardin", "garaje"],
  build(def) {
    if (def.id === "jardin") return jardin(def);
    if (def.id === "garaje")
      return {
        furniture: [put("costal-aserrin", COSTAL_ASERRIN.x, COSTAL_ASERRIN.y)],
        points: [{ type: "ano_viejo_relleno", name: "Aserrín del taller", x: COSTAL_ASERRIN.x, y: COSTAL_ASERRIN.y + 1 }],
      };
    return null;
  },
};
