// La decoración del Carnaval de Negros y Blancos (ver festival-decor.ts, VIR-176): la vereda de la calle del
// Megabús, el portón y la pradera se vuelven un carnaval de Pasto. Sobre la vereda, de punta a punta, la
// guirnalda de banderines y de papel crepé colgada de postes pintados; confeti en el pasto de la orilla. Al
// oeste del sendero, la plazoleta de la comida pastusa (frito, empanadas de añejo, hervido y helado de
// paila) con muñecos de papel maché entre puesto y puesto, el puesto de máscaras, una gradería con su valla
// y el puesto de maicena donde el sendero llega a la vereda. Arcos con el letrero "CARNAVAL" sobre el portón
// y sobre el camino de piedra que lleva a la estación, mascarones a los lados del portón, faroles de papel
// por el sendero y globos. Al este de la Estación Hyvento, la tarima del concurso (el palco del jurado), dos
// graderías de frente a la calle con su valla y la tarima de la murga. Todo en tiles del nivel y sin tapar
// caminos, portales, puntos ni la vereda (por donde se mira el desfile y se suma uno a la comparsa).
import { lineSeed } from "@hyvento/shared";
import type { AreaDef, Placement, PointDef } from "../types";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";
import { STATION } from "../areas/parada";

/** La vereda (la guirnalda va encima) y la fila de pasto de la orilla (postes, vallas y confeti). */
const VEREDA_Y = 131;
const ORILLA_Y = 130;
/** Cada cuántos tiles va un poste de la guirnalda. */
const CADA_POSTE = 6;
/** El puesto de maicena (donde el sendero del portón llega a la vereda) y la tarima del concurso. */
export const CARNAVAL_PUESTO = { x: 50, y: 129, punto: { x: 50, y: 130 } } as const;
export const CARNAVAL_TARIMA = { x: STATION.x + STATION.w + 1, y: 127, punto: { x: STATION.x + STATION.w + 2, y: 129 } } as const;
/** Los puestos de comida de la plazoleta del oeste (3x1 cada uno, de frente a la vereda). */
export const CARNAVAL_COMIDA = [
  { type: "puesto-frito", x: 13 },
  { type: "puesto-empanadas", x: 18 },
  { type: "puesto-hervido", x: 23 },
  { type: "puesto-helado", x: 28 },
].map((p) => ({ ...p, y: 127 }));
/**
 * Las graderías: la fila de atrás (banca alta y pasillo) en `y` y la de adelante en `y + 2`, con la valla
 * en la orilla. Al pasillo se sube por las puntas (`x - 1` y `x + 6` en `y + 1` quedan libres).
 */
export const CARNAVAL_GRADERIAS = [
  { x: 35, y: 126 },
  { x: 108, y: 126 },
  { x: 116, y: 126 },
] as const;

const put = (type: string, x: number, y: number): Placement => ({ type, x, y, facing: "right" });

function jardin(def: AreaDef): FestivalDecor {
  const points: PointDef[] = [
    { type: "festival_shop", name: "Puesto del carnaval", x: CARNAVAL_PUESTO.punto.x, y: CARNAVAL_PUESTO.punto.y },
    { type: "carnaval_contest", name: "Palco del carnaval", x: CARNAVAL_TARIMA.punto.x, y: CARNAVAL_TARIMA.punto.y },
  ];
  const camino = (x: number, y: number) => def.ground?.(x, y) === "path";
  const puntos = new Set([...def.points, ...points].map((p) => `${p.x},${p.y}`));
  /** ¿Se puede poner algo que bloquea aquí? Nunca sobre el camino de piedra ni sobre un punto. */
  const libre = (x: number, y: number) => !camino(x, y) && !puntos.has(`${x},${y}`);
  const furniture: Placement[] = [];
  // Nada encima de un punto, ni siquiera lo que no bloquea (el punto se quedaría sin su tile).
  const pon = (type: string, x: number, y: number) => {
    if (!puntos.has(`${x},${y}`)) furniture.push(put(type, x, y));
  };
  const ponSiLibre = (type: string, x: number, y: number) => {
    if (libre(x, y)) pon(type, x, y);
  };

  // Lo grande primero (lo que quede encima de otra cosa no se pone: gana lo que va antes).
  pon("tarima-comparsa", CARNAVAL_TARIMA.x, CARNAVAL_TARIMA.y);
  pon("puesto-carnaval", CARNAVAL_PUESTO.x, CARNAVAL_PUESTO.y);
  pon("tarima-musica", 125, 127);
  pon("puesto-mascaras", 32, 127);
  pon("puesto-mascaras", 133, 127);
  for (const p of CARNAVAL_COMIDA) pon(p.type, p.x, p.y);
  for (const g of CARNAVAL_GRADERIAS) {
    pon("tribuna-carnaval-alta", g.x, g.y);
    pon("tribuna-carnaval", g.x, g.y + 2);
  }
  // Los arcos: sobre el portón (afuera de la cerca) y sobre el camino de piedra que va a la estación.
  pon("arco-carnaval", 61, 111);
  pon("arco-carnaval-y", 63, 126);
  // Los mascarones a los lados del portón.
  pon("mascaron", 59, 112);
  pon("mascaron", 66, 112);
  // Muñecos de papel maché entre los puestos de comida y a la entrada de la vereda.
  [
    [17, 127, "muneco-carnaval"],
    [22, 127, "cuy-carnaval"],
    [27, 127, "muneco-carnaval"],
    [31, 129, "cuy-carnaval"],
    [123, 128, "muneco-carnaval"],
    [129, 128, "cuy-carnaval"],
    [137, 128, "muneco-carnaval"],
    [55, 126, "muneco-carnaval"],
  ].forEach(([x, y, t]) => ponSiLibre(t as string, x as number, y as number));
  // Globos.
  [
    [12, 128],
    [44, 128],
    [114, 124],
    [131, 127],
    [66, 113],
  ].forEach(([x, y]) => ponSiLibre("globos-carnaval", x!, y!));
  // Faroles de papel a los dos lados del sendero que baja del portón.
  for (let y = 114; y <= 123; y += 3) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 50; x <= 70; x++)
      if (camino(x, y)) {
        if (x0 < 0) x0 = x;
        x1 = x;
      }
    if (x0 < 0) continue;
    ponSiLibre("farol-carnaval", x0 - 2, y);
    ponSiLibre("farol-carnaval", x1 + 2, y);
  }
  // La orilla: los postes de la guirnalda, las vallas frente a las graderías y faroles cada tanto.
  const p = def.playable;
  const x0 = (p?.x ?? 0) + 2;
  const x1 = (p ? p.x + p.w : def.width) - 3;
  const enEstacion = (x: number) => x >= STATION.x - 3 && x <= STATION.x + STATION.w;
  for (let x = x0; x <= x1; x++) if ((x - x0) % CADA_POSTE === 0 && !enEstacion(x)) ponSiLibre("poste-banderines", x, ORILLA_Y);
  for (const g of CARNAVAL_GRADERIAS) for (let x = g.x - 1; x <= g.x + 6; x++) ponSiLibre("valla-carnaval", x, ORILLA_Y);
  for (let x = x0 + 3; x <= x1; x += 12) if (!enEstacion(x)) ponSiLibre("farol-carnaval", x, ORILLA_Y);
  // La guirnalda sobre la vereda: un tramo de banderines y uno de papel crepé, de poste a poste.
  for (let x = x0; x <= x1; x++) {
    if (enEstacion(x)) continue;
    const tramo = Math.floor((x - x0) / CADA_POSTE);
    pon(tramo % 3 === 2 ? "guirnalda-carnaval" : "banderines-carnaval", x, VEREDA_Y);
  }
  // Confeti en la orilla (lo que quedó libre) y serpentinas regadas en la pradera.
  for (let x = x0; x <= x1; x++) if (!enEstacion(x) && (x * 7) % 3 !== 0) pon("confeti-calle", x, ORILLA_Y);
  for (let i = 0; i < 40; i++) {
    const x = x0 + (lineSeed(`serpentina:x:${i}`) % (x1 - x0));
    const y = 120 + (lineSeed(`serpentina:y:${i}`) % 10);
    pon(i % 3 ? "serpentinas-suelo" : "confeti-calle", x, y);
  }
  return { furniture, points };
}

export const CARNAVAL_DECOR: FestivalDecorDef = {
  areas: ["jardin"],
  build(def) {
    return def.id === "jardin" ? jardin(def) : null;
  },
};
