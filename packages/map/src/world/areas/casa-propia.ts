import { casaAreaOf, type CasaPiso } from "@hyvento/shared";
import type { AreaDef, FloorKind, Placement, PointDef } from "../types";
import { place } from "./place";
import { casaAbajo } from "./casa-propia-abajo";
import { casaArriba } from "./casa-propia-arriba";
import { CASA_CONEXIONES } from "./casa-propia-conexiones";

// ---------- La casa de cada persona: afuera ----------
// Ver docs/plan-casas.md. Una sola plantilla para todos y una instancia por persona: servidor y cliente la
// arman con `casaPropiaDefs(userId)` (no va en AREAS). Afuera, de sur a norte: la calle por donde llega el
// Megabús (fuera de lo que se camina), la vereda con el refugio de la parada "Casa" y el buzón, la cerca
// con el portón, el antejardín con el sendero de piedra y los faroles, y la casona de finca de dos pisos
// con su corredor. Al oeste, el jardín con los frutales y el huertico; al este (a la vista, por la puerta
// de atrás), el patio de las fiestas: asador, mesa, tina caliente, hamaca, tendedero, fogata y cobertizo.
// Alrededor sigue el bosque (`surroundings`), así no se ve el fin del mapa.

/** Margen de bosque alrededor de lo que se camina. */
const M = 8;
/** Lo que se camina (en tiles locales, sin el margen). */
const PW = 40;
const PH = 23;
/** La calle: 8 filas debajo de lo que se camina (el bus la usa en VIR-142), y bosque más allá. */
const ROAD_H = 8;
const W = PW + M * 2;
const H = M + PH + ROAD_H + 4;

/** La casona (14x9) y su puerta: la del frente en x 6..7 de su fila de adelante, la de atrás al este. */
export const CASONA = { x: M + 13, y: M + 1, w: 14, d: 9 };
/** La cerca del antejardín, con el portón frente a la puerta. */
const FENCE_Y = M + 20;
const GATE_X = CASONA.x + 6;
/** El patio de atrás (deck de tablas) y el huertico del jardín (tierra). */
const PATIO = { x0: M + 28, y0: M + 2, x1: M + 38, y1: M + 13 };
const HUERTICO = { x0: M + 2, y0: M + 13, x1: M + 8, y1: M + 18 };

if (CASA_CONEXIONES.afuera.puerta.tiles[0]!.x !== GATE_X || CASA_CONEXIONES.afuera.puerta.tiles[0]!.y !== CASONA.y + CASONA.d)
  throw new Error("CASA_CONEXIONES.afuera.puerta no coincide con la puerta de la casona");
if (CASA_CONEXIONES.afuera.atras.tiles[0]!.x !== CASONA.x + CASONA.w || CASA_CONEXIONES.afuera.atras.tiles[0]!.y !== CASONA.y + 4)
  throw new Error("CASA_CONEXIONES.afuera.atras no coincide con la puerta de atrás de la casona");

const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;

function ground(x: number, y: number): FloorKind {
  const ly = y - M;
  const lx = x - M;
  if (lx < 0 || lx >= PW || ly < 0) return "forest";
  // La calle (gravilla por ahora; la calle del bus llega con VIR-142) y, más allá, el bosque.
  if (ly >= PH) return ly < PH + ROAD_H ? "gravel" : "forest";
  // La vereda de piedra a lo largo de la calle.
  if (y > FENCE_Y) return "path";
  // El corredor de tablas delante de la casona y el sendero de piedra hasta el portón.
  if (y >= CASONA.y + CASONA.d && y < CASONA.y + CASONA.d + 2 && x >= CASONA.x && x < CASONA.x + CASONA.w) return "deck";
  if ((x === GATE_X || x === GATE_X + 1) && y >= CASONA.y + CASONA.d && y <= FENCE_Y) return "path";
  // De la puerta de atrás al patio, y el patio.
  if (y === CASONA.y + 4 && x >= CASONA.x + CASONA.w && x < PATIO.x0) return "path";
  if (inRect(x, y, PATIO)) return "deck";
  if (inRect(x, y, HUERTICO)) return "soil";
  return "grass";
}

const items: Placement[] = [
  place("casa-finca", CASONA.x, CASONA.y),
  // ----- Detrás de la casona su dibujo tapa a quien se pare ahí: matorral y árboles, sin lugar libre.
  ...[0, 2, 4, 6, 8, 10, 12].map((dx, i) => place(i % 2 ? "bush-round" : "bush-berry", CASONA.x + dx, M)),
  ...[1, 3, 5, 7, 9, 11, 13].map((dx, i) => place(i % 3 ? "pine-1" : "oak-1", CASONA.x + dx, M)),
  // ----- El corredor: mecedoras mirando al antejardín, matas en tarros y el farol de la puerta.
  place("planter", CASONA.x, CASONA.y + CASONA.d),
  place("mecedora", CASONA.x + 2, CASONA.y + CASONA.d, "down"),
  place("mecedora", CASONA.x + 4, CASONA.y + CASONA.d, "down"),
  place("side-table", CASONA.x + 3, CASONA.y + CASONA.d),
  place("mecedora", CASONA.x + 9, CASONA.y + CASONA.d, "down"),
  place("mecedora", CASONA.x + 11, CASONA.y + CASONA.d, "down"),
  place("planter", CASONA.x + 13, CASONA.y + CASONA.d),
  place("boston-fern", CASONA.x + 5, CASONA.y + CASONA.d),
  place("boston-fern", CASONA.x + 8, CASONA.y + CASONA.d),
  // ----- Antejardín: faroles a los lados del sendero y flores contra la cerca y el corredor.
  place("garden-lantern", GATE_X - 1, CASONA.y + CASONA.d + 3),
  place("garden-lantern", GATE_X + 2, CASONA.y + CASONA.d + 3),
  place("garden-lantern", GATE_X - 1, FENCE_Y - 2),
  place("garden-lantern", GATE_X + 2, FENCE_Y - 2),
  ...[-6, -5, -4, -3, 4, 5, 6, 7].map((dx, i) => place(i % 3 === 0 ? "bush-hydrangea" : i % 3 === 1 ? "flower-patch" : "bush-rose", GATE_X + dx, FENCE_Y - 1)),
  place("flower-patch", CASONA.x + 1, CASONA.y + CASONA.d + 2),
  place("wildflowers", CASONA.x + 3, CASONA.y + CASONA.d + 4),
  place("bush-round", CASONA.x + 10, CASONA.y + CASONA.d + 3),
  place("wildflowers", CASONA.x + 12, CASONA.y + CASONA.d + 5),
  place("birch-1", CASONA.x + 1, CASONA.y + CASONA.d + 6),
  // El pozo de la finca y la casita del perro (la mascota descansa ahí, como en el jardín).
  place("well", CASONA.x + 3, CASONA.y + CASONA.d + 6),
  place("dog-house", CASONA.x + 10, CASONA.y + CASONA.d + 7, "down"),
  // ----- La cerca de madera con el portón frente a la puerta.
  place("garden-gate", GATE_X, FENCE_Y),
  ...Array.from({ length: PW - 2 }, (_, i) => M + 1 + i)
    .filter((x) => x !== GATE_X && x !== GATE_X + 1)
    .map((x) => place(x === M + 1 || x === M + PW - 2 ? "fence-post" : "fence", x, FENCE_Y, "down")),
  // ----- La vereda: el buzón junto al portón y el refugio de la parada "Casa".
  place("mailbox", GATE_X + 3, FENCE_Y + 1),
  place("parada-casa", GATE_X + 7, FENCE_Y + 1),
  place("garden-lantern", GATE_X + 12, FENCE_Y + 1),
  // ----- Jardín del oeste: frutales, la banca a la sombra y el huertico con su espantapájaros.
  place("apple-tree", M + 2, M + 3),
  place("peach-tree", M + 5, M + 2),
  place("cherry-tree", M + 8, M + 4),
  place("apple-tree", M + 3, M + 7),
  place("peach-tree", M + 9, M + 9),
  place("oak-big", M + 0, M + 10),
  place("bench", M + 6, M + 6, "down"),
  place("bush-berry", M + 11, M + 3),
  place("fern", M + 11, M + 13),
  ...[0, 2, 4].flatMap((dx) => [place("planter", HUERTICO.x0 + dx, HUERTICO.y0 + 1), place("planter", HUERTICO.x0 + dx, HUERTICO.y0 + 3)]),
  place("scarecrow", HUERTICO.x0 + 5, HUERTICO.y0 + 2),
  place("water-barrel", HUERTICO.x1, HUERTICO.y0),
  place("wheelbarrow", HUERTICO.x1, HUERTICO.y1 - 1),
  // ----- El patio de atrás (el de las fiestas): el asador, la mesa con sillas, la tina caliente, la hamaca
  // entre dos robles, el tendedero, la fogata con sus troncos y el cobertizo.
  place("brick-grill", PATIO.x0 + 1, PATIO.y0),
  place("prep-table", PATIO.x0 + 3, PATIO.y0),
  place("patio-table", PATIO.x0 + 2, PATIO.y0 + 4),
  place("patio-chair", PATIO.x0 + 1, PATIO.y0 + 4, "right"),
  place("patio-chair", PATIO.x0 + 3, PATIO.y0 + 4, "left"),
  place("patio-chair", PATIO.x0 + 2, PATIO.y0 + 3, "down"),
  place("patio-chair", PATIO.x0 + 2, PATIO.y0 + 5, "up"),
  place("parasol", PATIO.x0 + 4, PATIO.y0 + 3),
  place("hot-tub", PATIO.x0 + 6, PATIO.y0 + 1),
  place("towel-rack", PATIO.x0 + 9, PATIO.y0 + 1),
  place("garden-lantern", PATIO.x0 + 5, PATIO.y0 + 6),
  place("garden-lantern", PATIO.x1 - 1, PATIO.y1 - 1),
  place("oak-2", M + 39, M + 1),
  place("hammock", M + 39, M + 2),
  place("oak-3", M + 39, M + 4),
  place("tendedero", M + 39, M + 6),
  place("fire-pit", PATIO.x0 + 3, PATIO.y1 + 2),
  place("log-seat", PATIO.x0 + 1, PATIO.y1 + 2, "right"),
  place("log-seat", PATIO.x0 + 6, PATIO.y1 + 2, "left"),
  place("woodpile", PATIO.x0 + 8, PATIO.y1 + 1),
  place("tool-shed", M + 36, M + 17),
  place("barrel", M + 35, M + 19),
  place("oak-1", M + 29, M + 18),
  place("pine-2", M + 39, M + 12),
];

// Bajo el refugio de la parada: "Esperar el bus" (vuelve a la estación).
const points: PointDef[] = [{ type: "home_bus_stop", name: "Parada Casa", x: GATE_X + 8, y: FENCE_Y + 2 }];

/** Afuera de la casa de `userId` (`casa:<userId>`). */
function casaAfuera(userId: string): AreaDef {
  const id = casaAreaOf(userId);
  return {
    id,
    name: "Tu casa",
    width: W,
    height: H,
    outdoor: true,
    playable: { x: M, y: M, w: PW, h: PH },
    surroundings: "forest",
    ground,
    rooms: [],
    doors: [],
    zones: [],
    features: [],
    furniture: items,
    portals: [
      {
        id: "casa-entrar",
        label: "Entrar a la casa",
        tiles: CASA_CONEXIONES.afuera.puerta.tiles,
        to: { area: casaAreaOf(userId, "abajo"), ...CASA_CONEXIONES.abajo.puerta.llegada },
      },
      {
        id: "casa-entrar-atras",
        label: "Entrar por atrás",
        tiles: CASA_CONEXIONES.afuera.atras.tiles,
        to: { area: casaAreaOf(userId, "abajo"), ...CASA_CONEXIONES.abajo.atras.llegada },
      },
    ],
    points,
  };
}

/** Los tres niveles de la casa de `userId`, armados desde la plantilla con sus ids propios. */
export function casaPropiaDefs(userId: string): Record<CasaPiso, AreaDef> {
  return { afuera: casaAfuera(userId), abajo: casaAbajo(userId), arriba: casaArriba(userId) };
}
