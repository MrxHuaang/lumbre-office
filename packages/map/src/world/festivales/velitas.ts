// La decoración de la Noche de velitas (ver festival-decor.ts): faroles de colores en estaca a los lados del
// camino del porche al portón, grupitos de velitas en vasitos en la explanada y a la orilla del camino,
// faroles cubito en el camino al lago, velitas en el muelle y faroles en el patio. Todo en tiles del nivel.
// Las velitas que prende la gente no van aquí: las lleva la sala (rooms/velitas.ts) en el estado.
import type { FestivalDecorDef } from "../../festival-decor";
import type { Placement } from "../types";

const put = (type: string, x: number, y: number): Placement => ({ type, x, y, facing: "right" });

/** Lo del jardín (el camino del porche al portón va por x 61..63). */
export const VELITAS_JARDIN: readonly Placement[] = [
  // La explanada frente al porche: un grupito de velitas a cada lado.
  put("velitas-vasos", 58, 30),
  put("velitas-vasos", 67, 30),
  // El camino del porche al portón: faroles de colores en estaca a los dos lados, cada tanto.
  ...[34, 50, 58, 66].flatMap((y) => [put("farol-velitas", 59, y), put("farol-velitas", 65, y)]),
  // Entre farol y farol, velitas en vasitos a la orilla del camino.
  ...[38, 54, 62].flatMap((y) => [put("velitas-vasos", 60, y), put("velitas-vasos", 64, y)]),
  // El camino al lago: faroles cubito a la orilla.
  ...[
    [70, 50],
    [73, 54],
    [77, 62],
    [77, 68],
  ].map(([x, y]) => put("farol-cubo", x!, y!)),
  // El muelle: velitas sueltas a la orilla de las tablas (no bloquean: se pasa al lado).
  ...[77, 79, 81].map((x) => put("velita", x, 75)),
  // El patio: un farol a cada punta del sendero de piedra.
  put("farol-velitas", 80, 21),
  put("farol-velitas", 92, 21),
];

export const VELITAS_DECOR: FestivalDecorDef = {
  areas: ["jardin"],
  build: (def) => (def.id === "jardin" ? { furniture: [...VELITAS_JARDIN] } : null),
};
