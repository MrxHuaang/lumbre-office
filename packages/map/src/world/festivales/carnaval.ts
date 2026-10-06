// La decoración del Carnaval de Negros y Blancos (ver festival-decor.ts): todo en la vereda de la calle del
// Megabús, por donde pasa el desfile. Una guirnalda de banderines a lo largo de la vereda, faroles cada
// tanto, los mascarones a los lados del portón, el puesto de máscaras donde el sendero llega a la vereda
// y, al este de la Estación Hyvento, la tarima del palco (el jurado del desfile y el concurso de
// disfraces). Serpentinas regadas en el pasto. Todo en tiles del nivel.
import { lineSeed } from "@hyvento/shared";
import type { AreaDef, Facing, Placement, PointDef } from "../types";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";
import { STATION } from "../areas/parada";

/** La fila de la guirnalda (el pasto pegado a la vereda) y la de los faroles. */
const GUIRNALDA_Y = 130;
const FAROLES_Y = 129;
/** El puesto del carnaval (donde el sendero del portón llega a la vereda) y la tarima del palco. */
export const CARNAVAL_PUESTO = { x: 50, y: 129, punto: { x: 50, y: 130 } } as const;
export const CARNAVAL_TARIMA = { x: STATION.x + STATION.w + 1, y: 127, punto: { x: STATION.x + STATION.w + 2, y: 129 } } as const;

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

/** Donde no van faroles (sólidos): el sendero que baja del portón y la estación. */
const sinFarol = (x: number) => (x >= 53 && x <= 66) || (x >= STATION.x - 2 && x <= STATION.x + STATION.w + 5);

function jardin(def: AreaDef): FestivalDecor {
  const points: PointDef[] = [
    { type: "festival_shop", name: "Puesto del carnaval", x: CARNAVAL_PUESTO.punto.x, y: CARNAVAL_PUESTO.punto.y },
    { type: "carnaval_contest", name: "Palco del carnaval", x: CARNAVAL_TARIMA.punto.x, y: CARNAVAL_TARIMA.punto.y },
  ];
  const libre = (x: number, y: number) => !points.some((p) => p.x === x && p.y === y);
  const furniture: Placement[] = [put("tarima-comparsa", CARNAVAL_TARIMA.x, CARNAVAL_TARIMA.y), put("puesto-carnaval", CARNAVAL_PUESTO.x, CARNAVAL_PUESTO.y)];
  // Los mascarones a los lados del portón, del lado de afuera.
  furniture.push(put("mascaron", 60, 112), put("mascaron", 65, 112));
  // Los faroles a lo largo de la vereda.
  const p = def.playable;
  const x0 = (p?.x ?? 0) + 2;
  const x1 = (p ? p.x + p.w : def.width) - 3;
  for (let x = x0 + 2; x <= x1; x += 8) if (!sinFarol(x) && libre(x, FAROLES_Y)) furniture.push(put("farol-carnaval", x, FAROLES_Y));
  // La guirnalda: un tramo por tile (lo que caiga sobre un árbol o la estación no se pone).
  for (let x = x0; x <= x1; x++) if (libre(x, GUIRNALDA_Y)) furniture.push(put("banderines-carnaval", x, GUIRNALDA_Y));
  // Serpentinas regadas en el pasto de la pradera, siempre en los mismos sitios.
  for (let i = 0; i < 28; i++) {
    const x = x0 + (lineSeed(`serpentina:x:${i}`) % (x1 - x0));
    const y = 124 + (lineSeed(`serpentina:y:${i}`) % 5);
    if (libre(x, y)) furniture.push(put("serpentinas-suelo", x, y));
  }
  return { furniture, points };
}

export const CARNAVAL_DECOR: FestivalDecorDef = {
  areas: ["jardin"],
  build(def) {
    return def.id === "jardin" ? jardin(def) : null;
  },
};
