import type { AreaDef, Placement } from "../types";
import { place } from "./place";

// ---------- Jardín ----------

const GARDEN_W = 32;
const GARDEN_H = 28;
/** La cabaña de dos plantas ocupa x 8..23, y 2..11; su puerta da al sendero. */
const CABIN = { x: 8, y: 2, w: 16, d: 10 };
const PATH_X = [15, 16];
const PORCH_Y = CABIN.y + CABIN.d;
const FENCE_FROM = 15;
/** Huerto (fase 5): dos filas de cuatro parcelas al oeste del sendero, con un pasillo al medio. */
const PLOTS = [16, 18].flatMap((y) => [6, 7, 8, 9].map((x) => ({ x, y })));
/**
 * Estanque (fase 5) al este del sendero: agua que no se camina (una elipse con el borde ondulado) y un
 * muelle de dos tablas que entra desde la orilla sur.
 */
const POND = { cx: 25, cy: 16.5, rx: 4.3, ry: 2.9 };
const DOCK = { x: 24, y: 16, w: 2, h: 3 };
const isDock = (x: number, y: number) => x >= DOCK.x && x < DOCK.x + DOCK.w && y >= DOCK.y && y < DOCK.y + DOCK.h;
function isPond(x: number, y: number): boolean {
  const dx = (x + 0.5 - POND.cx) / POND.rx;
  const dy = (y + 0.5 - POND.cy) / POND.ry;
  return Math.hypot(dx, dy) <= 1 + 0.14 * Math.sin(3 * Math.atan2(dy, dx) + 1);
}

const gardenFurniture: Placement[] = [
  place("cabin", CABIN.x, CABIN.y),
  ...[9, 10, 11, 12, 19, 20, 21, 22].map((x) => place("flowerbed", x, PORCH_Y, "down")),
  place("mailbox", 13, PORCH_Y + 2, "down"),
  place("notice-board", 18, PORCH_Y + 2, "down"),
  place("lamp-post", 14, 18),
  place("lamp-post", 17, 18),
  place("bench", 20, 16, "down"),
  ...PLOTS.map((p) => place("garden-plot", p.x, p.y)),
  place("scarecrow", 10, 16, "down"),
  place("water-barrel", 10, 18),
  place("tree", 2, 2),
  place("tree", 4, 8),
  place("tree", 2, 13),
  place("tree", 4, 20),
  place("tree", 27, 3),
  place("tree", 29, 9),
  place("tree", 29, 20),
  place("tree", 8, 24),
  place("tree", 23, 24),
  place("pine", 26, 1),
  place("pine", 5, 1),
  place("pine", 2, 24),
  place("pine", 29, 15),
  place("pine", 28, 23),
  place("bush", 7, 4),
  place("bush", 24, 4),
  place("bush", 7, 10),
  place("bush", 24, 10),
  place("bush", 11, 22),
  place("bush", 20, 22),
  ...Array.from({ length: GARDEN_W }, (_, x) => x)
    .filter((x) => !PATH_X.includes(x))
    .map((x) => place("fence", x, GARDEN_H - 1, "down")),
  ...Array.from({ length: GARDEN_H - 1 - FENCE_FROM }, (_, i) => place("fence", 0, FENCE_FROM + i)),
  ...Array.from({ length: GARDEN_H - 1 - FENCE_FROM }, (_, i) => place("fence", GARDEN_W - 1, FENCE_FROM + i)),
];

export const jardin: AreaDef = {
  id: "jardin",
  name: "Jardín",
  width: GARDEN_W,
  height: GARDEN_H,
  outdoor: true,
  ground: (x, y) => {
    if (isDock(x, y)) return "dock";
    if (isPond(x, y)) return "water";
    return (PATH_X.includes(x) && y >= PORCH_Y) || (y === PORCH_Y && x >= 14 && x <= 17) ? "path" : "grass";
  },
  rooms: [],
  doors: [],
  zones: [{ id: "jardin", name: "Jardín", type: "common", rect: { x: 0, y: 0, w: GARDEN_W, h: GARDEN_H }, isolated: false }],
  features: [],
  furniture: gardenFurniture,
  portals: [
    {
      id: "jardin-casa",
      label: "Entrar a la cabaña",
      tiles: PATH_X.map((x) => ({ x, y: PORCH_Y })),
      to: { area: "planta-baja", x: 4, y: 15, facing: "up" },
    },
  ],
  points: [
    { type: "spawn", name: "Entrada del jardín", x: 15, y: 24 },
    { type: "task_board", name: "Tablón", x: 18, y: PORCH_Y + 3 },
    { type: "mailbox", name: "Buzón", x: 13, y: PORCH_Y + 3 },
    // Una por parcela, en el mismo orden que PLOTS (el índice es el id de la parcela).
    ...PLOTS.map((p, i) => ({ type: "garden_plot" as const, name: `Parcela ${i + 1}`, x: p.x, y: p.y })),
    // La punta del muelle, mirando al agua.
    { type: "fishing_spot", name: "Muelle", x: DOCK.x, y: DOCK.y },
    { type: "fishing_spot", name: "Muelle", x: DOCK.x + 1, y: DOCK.y },
  ],
};
