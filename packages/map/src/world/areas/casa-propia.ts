import { casaAreaOf, type CasaPiso } from "@hyvento/shared";
import { catalogItem, footprint, localToWorld } from "../catalog";
import type { AreaDef, Facing, FloorKind, Placement, PointDef } from "../types";
import { place } from "./place";
import { noise, smoothNoise } from "./ruido";
import { casaAbajo } from "./casa-propia-abajo";
import { casaArriba } from "./casa-propia-arriba";
import { CASA_CONEXIONES } from "./casa-propia-conexiones";

// ---------- La casa de cada persona: afuera ----------
// Ver docs/planes/plan-casas.md. Una sola plantilla para todos y una instancia por persona: servidor y cliente la
// arman con `casaPropiaDefs(userId)` (no va en AREAS). Afuera, de sur a norte: el camino de tierra por
// donde llega el Megabús (sale del bosque y se pierde en él, fuera de lo que se camina), la vereda con el
// refugio de la parada "Casa" y el buzón, la cerca con el portón, el antejardín con el sendero de piedra
// que se abre hacia el huertico y el patio, y la casona de finca con su corredor. Al oeste, los frutales,
// el estanquito y el huertico; al este, el patio de las fiestas: asador, mesa, tina caliente, hamaca,
// tendedero, fogata y cobertizo. Todo es un claro en el bosque: la orilla ondula, el pasto se apaga entre
// los árboles y el bosque entra un poco a lo que se camina, así no se ve el rectángulo.

/** Margen de bosque alrededor de lo que se camina (como el jardín: da para la fila de árboles y la copa). */
const M = 10;
/** Lo que se camina (en tiles locales, sin el margen). */
const PW = 40;
const PH = 23;
/** Debajo de lo que se camina: la orilla de pasto, el camino del bus y el bosque hasta el borde. */
const SOUTH = 14;
const W = PW + M * 2;
const H = M + PH + SOUTH;

// Todo lo de abajo va en tiles locales (0,0 = la esquina de lo que se camina); `put` suma el margen.
const C = { x: 13, y: 1, w: 14, d: 9 };
/** La casona (14x9) en tiles del nivel: la puerta del frente en x 6..7 de su fila de adelante. */
export const CASONA = { x: M + C.x, y: M + C.y, w: C.w, d: C.d };
/** La cerca del antejardín, con el portón frente a la puerta. */
const FENCE_Y = 20;
const GATE_X = C.x + 6;
/** El patio de atrás (deck de tablas) y el huertico (tierra, con las esquinas gastadas). */
const PATIO = { x0: 28, y0: 2, x1: 38, y1: 13 };
const HUERTICO = { x0: 2, y0: 13, x1: 8, y1: 18 };
/** El estanquito del jardín del oeste, entre los frutales y el huertico. */
const POND = { cx: 6.4, cy: 8.7, rx: 2.7, ry: 1.9 };
/** La parada: el refugio (4x2) sobre la vereda y donde se espera el bus. */
const PARADA = { x: GATE_X + 7, y: FENCE_Y + 1 };
const LLEGADA = { x: CASA_CONEXIONES.afuera.parada.llegada.x - M, y: CASA_CONEXIONES.afuera.parada.llegada.y - M };

if (CASA_CONEXIONES.afuera.puerta.tiles[0]!.x !== GATE_X + M || CASA_CONEXIONES.afuera.puerta.tiles[0]!.y !== C.y + C.d + M)
  throw new Error("CASA_CONEXIONES.afuera.puerta no coincide con la puerta de la casona");
if (CASA_CONEXIONES.afuera.atras.tiles[0]!.x !== C.x + C.w + M || CASA_CONEXIONES.afuera.atras.tiles[0]!.y !== C.y + 4 + M)
  throw new Error("CASA_CONEXIONES.afuera.atras no coincide con la puerta de atrás de la casona");

// ---------- El piso (con decimales, para el dibujo) ----------

/** Ruido suave centrado en 0 (para que ningún borde quede recto). */
const wob = (x: number, y: number, seed: number, cell: number, amp: number) => (smoothNoise(x, y, cell, seed) - 0.5) * 2 * amp;

/** Distancia a la orilla del claro (negativa adentro): un rectángulo de esquinas muy redondeadas que ondula. */
function clearingDist(x: number, y: number): number {
  const R = 6;
  const qx = Math.abs(x - PW / 2) - (PW / 2 - R);
  const qy = Math.abs(y - PH / 2) - (PH / 2 - R);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
  return d + wob(x, y, 81, 5, 1.25) + wob(x, y, 82, 1.7, 0.3);
}

/** El camino del bus: tierra con gravilla que sale del bosque del oeste y se pierde en el del este. */
const ROAD = { x0: -3, x1: PW + 3, half: 1.6 };
const roadY = (x: number) => PH + 3.6 + 0.45 * Math.sin(x / 6.5 + 0.8);
function onRoad(x: number, y: number): boolean {
  if (x < ROAD.x0 + wob(x, y, 83, 3, 0.9) || x > ROAD.x1 + wob(x, y, 84, 3, 0.9)) return false;
  // En las puntas se angosta: ahí lo cubren los árboles.
  const end = Math.min(x - ROAD.x0, ROAD.x1 - x);
  const half = ROAD.half * Math.max(0, Math.min(1, 0.45 + end / 4));
  return Math.abs(y - roadY(x)) < half + wob(x, y, 85, 1.7, 0.25);
}
/** El lomo de pasto entre las dos huellas de las llantas. */
const onRidge = (x: number, y: number) => Math.abs(y - roadY(x)) < 0.3 + wob(x, y, 106, 1.3, 0.14);
/** Distancia a la franja de pasto del camino (el bosque se abre a lo largo de él). */
const roadDist = (x: number, y: number) => Math.max(Math.abs(y - roadY(x)) - 3, ROAD.x0 - 0.6 - x, x - ROAD.x1 - 0.6) + wob(x, y, 86, 4, 0.6);

/**
 * Distancia al claro o al camino (negativa en el pasto). En el borde del nivel siempre pasa de 5: ahí ya
 * es la copa del bosque, que empalma con el que el cliente repite alrededor.
 */
function forestDist(x: number, y: number): number {
  const edge = Math.min(x + M, y + M, PW + M - x, PH + SOUTH - y);
  return Math.max(Math.min(clearingDist(x, y), roadDist(x, y)), 6 - edge);
}

type Seg = { a: [number, number]; b: [number, number]; w: number };
/** El sendero de piedra: del portón a la puerta con una curva suave, y sus ramas al huertico y al patio. */
const PATHS: Seg[] = [
  { a: [20, 21.2], b: [20.6, 17.6], w: 2 },
  { a: [20.6, 17.6], b: [19.6, 14.8], w: 2 },
  { a: [19.6, 14.8], b: [20, 11.8], w: 2 },
  // Al oeste, hacia el huertico.
  { a: [19.4, 16.4], b: [15.6, 17.1], w: 1.5 },
  { a: [15.6, 17.1], b: [11.6, 16.3], w: 1.5 },
  { a: [11.6, 16.3], b: [8.4, 15.6], w: 1.4 },
  // Al este, hacia la fogata y el patio.
  { a: [20.8, 15.6], b: [24.4, 15], w: 1.5 },
  { a: [24.4, 15], b: [28.2, 13.2], w: 1.5 },
];
function segDist(px: number, py: number, s: Seg): number {
  const [ax, ay] = s.a;
  const [bx, by] = s.b;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
const onPath = (x: number, y: number) => PATHS.some((s) => segDist(x, y, s) < s.w / 2 + wob(x, y, 87, 1.7, 0.12));

/** La vereda de piedra a lo largo del camino: en las puntas se deshace en el pasto. */
const onVereda = (x: number, y: number) =>
  y > FENCE_Y + 0.92 + wob(x, y, 88, 1.7, 0.1) && y < PH + 0.2 + wob(x, y, 89, 2.5, 0.3) && x > 3.5 + wob(x, y, 90, 3, 1.2) && x < PW - 3.5 + wob(x, y, 91, 3, 1.2);
/** Delante del refugio la vereda baja hasta el camino (ahí para el bus). */
const onApron = (x: number, y: number) => x > PARADA.x - 0.4 + wob(x, y, 92, 1.7, 0.2) && x < PARADA.x + 4.4 + wob(x, y, 93, 1.7, 0.2) && y > FENCE_Y + 1 && y < roadY(x) - 1.6;

const inRect = (x: number, y: number, r: { x0: number; y0: number; x1: number; y1: number }) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const onCorredor = (x: number, y: number) => x >= C.x && x < C.x + C.w && y >= C.y + C.d && y < C.y + C.d + 2;
/** Las lajas frente a la puerta de atrás, entre la casona y el deck. */
const onBackPad = (x: number, y: number) => x >= C.x + C.w && x < PATIO.x0 && y > C.y + 3.7 && y < C.y + 5.3;
function inPond(x: number, y: number): boolean {
  const a = Math.atan2(y - POND.cy, x - POND.cx);
  return Math.hypot((x - POND.cx) / POND.rx, (y - POND.cy) / POND.ry) < 1 + 0.08 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2) + wob(x, y, 94, 1.7, 0.05);
}
/** El huertico: un rectángulo con las esquinas redondeadas y el canto un poco gastado. */
function onHuertico(x: number, y: number): boolean {
  const r = 1.1;
  const qx = Math.abs(x - (HUERTICO.x0 + HUERTICO.x1) / 2) - ((HUERTICO.x1 - HUERTICO.x0) / 2 + 0.35 - r);
  const qy = Math.abs(y - (HUERTICO.y0 + HUERTICO.y1) / 2) - ((HUERTICO.y1 - HUERTICO.y0) / 2 + 0.35 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r < wob(x, y, 95, 1.7, 0.1);
}

/** Piso en tiles locales con decimales. */
function local(x: number, y: number): FloorKind {
  if (onRoad(x, y)) return onRidge(x, y) ? "grass" : "gravel";
  const wild = forestDist(x, y) > 0 ? "forest" : "grass";
  if (y >= FENCE_Y) return onApron(x, y) || onVereda(x, y) || onPath(x, y) ? "path" : wild;
  if (onCorredor(x, y) || inRect(x, y, PATIO)) return "deck";
  if (onBackPad(x, y)) return "path";
  if (inPond(x, y)) return "water";
  if (onPath(x, y)) return "path";
  if (onHuertico(x, y)) return "soil";
  return wild;
}
const fine = (x: number, y: number) => local(x - M, y - M);
/** Piso de un tile local (el de su centro). */
const tileGround = (x: number, y: number) => local(x + 0.5, y + 0.5);

// ---------- Muebles ----------

const items: Placement[] = [];
const put = (type: string, x: number, y: number, facing: Facing = "right") => items.push(place(type, x + M, y + M, facing));

put("casa-finca", C.x, C.y);
// ----- Detrás de la casona su dibujo tapa a quien se pare ahí: matorral y árboles, sin lugar libre.
[0, 2, 4, 6, 8, 10, 12].forEach((dx, i) => put(i % 2 ? "bush-round" : "bush-berry", C.x + dx, 0));
[1, 3, 5, 7, 9, 11, 13].forEach((dx, i) => put(i % 3 ? "pine-1" : "oak-1", C.x + dx, 0));
// Al noroeste el techo tapa hasta cuatro tiles (lo mide el test del arte): ahí, un bosquecito pegado a la
// casona, con matas contra la pared.
for (let y = 0; y <= 7; y++)
  for (let x = C.x - 4; x < C.x; x++) {
    if (y > 4 && x < C.x - 2 + (y > 5 ? 1 : 0)) continue;
    const wall = x === C.x - 1;
    const n = noise(x, y, 107);
    put(wall || n < 0.35 ? (["bush-round", "bush-berry", "bush-hydrangea"] as const)[Math.floor(n * 30) % 3]! : (["oak-1", "pine-2", "birch-1", "oak-3", "pine-1"] as const)[Math.floor(n * 50) % 5]!, x, y);
  }
// ----- El corredor: mecedoras mirando al antejardín, matas en tarros y helechos junto a la puerta.
const PORCH = C.y + C.d;
put("planter", C.x, PORCH);
put("mecedora", C.x + 2, PORCH, "down");
put("side-table", C.x + 3, PORCH);
put("mecedora", C.x + 4, PORCH, "down");
put("boston-fern", C.x + 5, PORCH);
put("boston-fern", C.x + 8, PORCH);
put("mecedora", C.x + 9, PORCH, "down");
put("mecedora", C.x + 11, PORCH, "down");
put("planter", C.x + 13, PORCH);
// ----- Antejardín: el pozo y el reloj de sol a un lado del sendero, la casita del perro al otro, faroles
// a lo largo del sendero y macizos de flores contra el corredor y la cerca.
put("flower-patch", C.x, PORCH + 2);
put("bush-hydrangea", C.x + 1, PORCH + 2);
put("bush-rose", C.x + 12, PORCH + 2);
put("flower-patch", C.x + 13, PORCH + 2);
put("well", C.x + 1, PORCH + 3);
put("birch-2", C.x - 1, PORCH + 4);
put("sundial", C.x + 4, PORCH + 5);
put("garden-lantern", GATE_X - 1, PORCH + 3);
put("garden-lantern", GATE_X + 2, PORCH + 3);
put("garden-lantern", GATE_X - 1, FENCE_Y - 2);
put("garden-lantern", GATE_X + 3, FENCE_Y - 2);
put("dog-house", C.x + 11, PORCH + 7, "down");
put("bush-round", C.x + 12, PORCH + 7);
put("wildflowers", C.x + 9, PORCH + 3);
[-6, -5, -4, -3, 4, 5, 6, 7].forEach((dx, i) => put(["bush-hydrangea", "flower-patch", "bush-rose", "flower-patch"][i % 4]!, GATE_X + dx, FENCE_Y - 1));
// ----- La cerca de madera con el portón frente a la puerta; en las puntas se mete entre los árboles.
put("garden-gate", GATE_X, FENCE_Y);
for (let x = 1; x < PW - 1; x++) if (x !== GATE_X && x !== GATE_X + 1) put(x === 1 || x === PW - 2 ? "fence-post" : "fence", x, FENCE_Y, "down");
// ----- La vereda: el buzón junto al portón, el refugio de la parada "Casa" y los faroles.
put("mailbox", GATE_X + 3, FENCE_Y + 1);
put("parada-casa", PARADA.x, PARADA.y);
put("garden-lantern", GATE_X + 12, FENCE_Y + 1);
put("garden-lantern", GATE_X - 8, FENCE_Y + 1);
// ----- Jardín del oeste: los frutales al fondo, el estanquito con su banca y el huertico.
put("apple-tree", 2, 2);
put("peach-tree", 5, 1);
put("cherry-tree", 8, 2);
put("peach-tree", 3, 5);
put("cherry-tree", 11, 10);
put("bench", 10, 7, "left");
put("oak-2", 11, 6);
put("flat-rock", 5, 11);
put("flat-rock", 7, 11);
put("tall-grass", 2, 9);
// ----- El huertico: jardineras en dos filas, el espantapájaros, el barril de agua y la carretilla.
[0, 2, 4].forEach((dx) => {
  put("planter", HUERTICO.x0 + dx, HUERTICO.y0 + 1);
  put("planter", HUERTICO.x0 + dx, HUERTICO.y0 + 3);
});
put("scarecrow", HUERTICO.x0 + 5, HUERTICO.y0 + 2);
put("water-barrel", HUERTICO.x1, HUERTICO.y0);
put("wheelbarrow", HUERTICO.x1, HUERTICO.y1 - 1);
// ----- El patio de atrás (el de las fiestas): el asador, la mesa con sillas, la tina caliente, la hamaca
// entre dos robles a la orilla del bosque, el tendedero, la fogata con sus troncos y el cobertizo.
put("brick-grill", PATIO.x0 + 1, PATIO.y0);
put("prep-table", PATIO.x0 + 3, PATIO.y0);
put("patio-table", PATIO.x0 + 2, PATIO.y0 + 4);
put("patio-chair", PATIO.x0 + 1, PATIO.y0 + 4, "right");
put("patio-chair", PATIO.x0 + 3, PATIO.y0 + 4, "left");
put("patio-chair", PATIO.x0 + 2, PATIO.y0 + 3, "down");
put("patio-chair", PATIO.x0 + 2, PATIO.y0 + 5, "up");
put("parasol", PATIO.x0 + 4, PATIO.y0 + 3);
put("hot-tub", PATIO.x0 + 6, PATIO.y0 + 1);
put("towel-rack", PATIO.x0 + 9, PATIO.y0 + 1);
put("planter", PATIO.x0, PATIO.y0 + 8);
put("planter", PATIO.x0 + 9, PATIO.y0 + 8);
put("garden-lantern", PATIO.x0 + 5, PATIO.y0 + 6);
put("garden-lantern", PATIO.x1 - 1, PATIO.y1 - 1);
put("oak-2", PW - 1, 1);
put("hammock", PW - 1, 2);
put("oak-3", PW - 1, 4);
put("tendedero", PW - 1, 6);
put("fire-pit", PATIO.x0 + 3, PATIO.y1 + 1);
put("log-seat", PATIO.x0 + 1, PATIO.y1 + 1, "right");
put("log-seat", PATIO.x0 + 6, PATIO.y1 + 1, "left");
put("woodpile", PATIO.x0 + 8, PATIO.y1);
// La banca de mirar el fuego, a la sombra de un roble.
put("oak-1", PATIO.x0 + 1, PATIO.y1 + 5);
put("bench", PATIO.x0 + 2, PATIO.y1 + 5, "up");
put("flower-patch", PATIO.x0 + 5, PATIO.y1 + 5);
put("tool-shed", PW - 4, 17);
// Detrás del cobertizo (su techo tapa): el barril, los cajones y matas.
put("barrel", PW - 5, 16);
put("crates", PW - 5, 17);
put("water-barrel", PW - 5, 18);
put("bush-berry", PW - 4, 16);
put("bush-round", PW - 3, 16);

// Al pie de la parada se sienta a esperar el bus; frente al refugio: "Esperar el bus" (vuelve a la estación).
const POINTS_LOCAL = [{ type: "home_bus_stop" as const, name: "Parada Casa", x: PARADA.x + 1, y: PARADA.y + 1 }];

// ----- El estanquito: juncos en la orilla y nenúfares en el agua.
for (let y = Math.floor(POND.cy - POND.ry) - 1; y <= POND.cy + POND.ry + 1; y++)
  for (let x = Math.floor(POND.cx - POND.rx) - 1; x <= POND.cx + POND.rx + 1; x++) {
    const water = tileGround(x, y) === "water";
    const shore = !water && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileGround(x + dx!, y + dy!) === "water");
    // Los juncos van atrás (al norte y al oeste): adelante se ve el agua y se camina la orilla.
    if (shore && y < POND.cy && noise(x, y, 96) < 0.6 && tileGround(x, y) === "grass") put("reeds", x, y);
    else if (water && noise(x, y, 97) < 0.3) put("lily-pad", x, y);
  }

// ---------- El bosque y la naturaleza suelta ----------
// Sembrado con ruido determinista: en el claro, matas y flores sueltas; hacia la orilla, árboles cada vez
// más juntos; más allá de lo que se camina, la fila de árboles y robles viejos que tapa la copa. Nunca
// junto a un sendero, un punto, una puerta, la parada o un mueble (así no se tapa ningún paso).
{
  const key = (x: number, y: number) => `${x},${y}`;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < PW && y < PH;
  const inLevel = (x: number, y: number) => x >= -M && y >= -M && x < PW + M && y < PH + SOUTH;
  const taken = new Set<string>();
  const reserved = new Set<string>();
  // Un árbol dibujado delante (al sur o al este) de un mueble lo tapa: ahí solo crece lo bajito.
  const shade = new Set<string>();
  // Un roble viejo tiene la copa ancha: lo tapa desde más lejos.
  const shadeFar = new Set<string>();
  const mark = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) reserved.add(key(x + dx, y + dy));
  };
  for (const f of items) {
    const item = catalogItem(f.type);
    const [w, d] = footprint(item, f.facing ?? "right");
    for (let y = 0; y < d; y++)
      for (let x = 0; x < w; x++) {
        taken.add(key(f.x - M + x, f.y - M + y));
        mark(f.x - M + x, f.y - M + y, item.flat || item.solid === false ? 0 : 1);
        for (let j = 0; j <= 4; j++)
          for (let i = 0; i <= 4; i++) (i <= 2 && j <= 2 ? shade : shadeFar).add(key(f.x - M + x + i, f.y - M + y + j));
      }
  }
  for (const p of POINTS_LOCAL) mark(p.x, p.y, 2);
  mark(LLEGADA.x, LLEGADA.y, 2);
  for (const t of [...CASA_CONEXIONES.afuera.puerta.tiles, ...CASA_CONEXIONES.afuera.atras.tiles]) mark(t.x - M, t.y - M, 2);
  // La franja de la cerca y la vereda queda despejada (ahí se espera el bus y se ve la casa desde la calle).
  for (let y = FENCE_Y - 2; y < PH; y++) for (let x = 3; x < PW - 3; x++) reserved.add(key(x, y));
  const open = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const g = tileGround(x + dx, y + dy);
        if (g !== "grass" && g !== "forest") return false;
      }
    return true;
  };
  const free = (x: number, y: number, w = 1, d = 1) => {
    for (let j = 0; j < d; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (!inLevel(tx, ty) || taken.has(key(tx, ty)) || !open(tx, ty)) return false;
        if (inside(tx, ty) && reserved.has(key(tx, ty))) return false;
        // Entre la vereda y el camino solo crece pasto (el bus para ahí).
        if (!inside(tx, ty) && ty >= PH - 1 && forestDist(tx + 0.5, ty + 0.5) < 0.4) return false;
      }
    return true;
  };
  const sow = (type: string, x: number, y: number, facing: Facing) => {
    const [w, d] = footprint(catalogItem(type), facing);
    put(type, x, y, facing);
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) taken.add(key(x + i, y + j));
  };
  const pick = <T,>(list: readonly T[], x: number, y: number, seed: number) => list[Math.floor(noise(x, y, seed) * list.length)]!;
  const facingAt = (x: number, y: number): Facing => (noise(x, y, 98) < 0.5 ? "right" : "down");
  const TREES = ["oak-1", "oak-2", "oak-3", "pine-1", "pine-2", "pine-3", "birch-1", "birch-2", "pine-1", "oak-1"];
  const EDGE_SMALL = ["fern", "bush-round", "tall-grass", "bush-berry", "fern", "rock-mossy", "wildflowers", "stump", "fern", "tall-grass", "bush-round", "mushrooms", "fern"];
  const MEADOW = ["tall-grass", "wildflowers", "tall-grass", "fern", "wildflowers", "rock-small", "mushrooms", "tall-grass"];
  const UNDER = ["fern", "rock-mossy", "bush-round", "fern", "stump", "bush-berry", "rock-medium", "fern", "bush-round", "mushrooms"];

  // Robles viejos, peñascos y troncos caídos en la franja de afuera (antes que lo chico, para que quepan).
  for (let cy = -M; cy < PH + SOUTH; cy += 3)
    for (let cx = -M; cx < PW + M; cx += 3) {
      const x = cx + Math.floor(noise(cx, cy, 99) * 2);
      const y = cy + Math.floor(noise(cx, cy, 100) * 2);
      const d = forestDist(x + 1, y + 1);
      if (inside(x, y) || inside(x + 1, y + 1) || d < 1.6 || d > 4.6 || [0, 1].some((i) => [0, 1].some((j) => shade.has(key(x + i, y + j)) || shadeFar.has(key(x + i, y + j))))) continue;
      const n = noise(cx, cy, 101);
      if (n < 0.42 && free(x, y, 2, 2)) sow("oak-big", x, y, "right");
      else if (n < 0.48 && free(x, y, 2, 2)) sow("boulder", x, y, "right");
      else if (n < 0.53 && free(x, y, 1, 3)) sow("fallen-log", x, y, "right");
    }
  for (let y = -M; y < PH + SOUTH; y++)
    for (let x = -M; x < PW + M; x++) {
      const d = forestDist(x + 0.5, y + 0.5);
      if (d > 4.6 || !free(x, y)) continue;
      const n = noise(x, y, 102);
      // Más adentro del claro casi no hay árboles: solo pasto alto, flores y alguna piedra.
      const pTree = d < -1.8 ? 0 : d < -0.6 ? 0.1 : d < 0.4 ? 0.34 : d < 1.6 ? 0.52 : 0.4;
      const pSmall = d < -1.8 ? 0.05 : d < 0.4 ? 0.16 : 0.22;
      if (n < pTree && !shade.has(key(x, y))) sow(pick(TREES, x, y, 103), x, y, facingAt(x, y));
      else if (n < pTree + pSmall) sow(pick(d < -1.8 ? MEADOW : d < 1.6 ? EDGE_SMALL : UNDER, x, y, 104), x, y, facingAt(x, y));
    }

  // Ningún tile libre queda encerrado: si el bosque cerró un hueco al que no se llega, va una mata.
  const blocked = new Set<string>();
  for (const f of items) {
    const item = catalogItem(f.type);
    if (item.solid === false) continue;
    const facing = f.facing ?? "right";
    const [w, d] = footprint(item, facing);
    const cells: [number, number][] = item.blocks
      ? item.blocks.map(([lx, ly]) => localToWorld(item, facing, lx, ly))
      : Array.from({ length: w * d }, (_, i) => [i % w, Math.floor(i / w)] as [number, number]);
    for (const [dx, dy] of cells) blocked.add(key(f.x - M + dx, f.y - M + dy));
  }
  const walk = (x: number, y: number) => inside(x, y) && !blocked.has(key(x, y)) && tileGround(x, y) !== "water";
  const seen = new Set([key(LLEGADA.x, LLEGADA.y)]);
  const stack: [number, number][] = [[LLEGADA.x, LLEGADA.y]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      if (walk(x + dx, y + dy) && !seen.has(key(x + dx, y + dy))) {
        seen.add(key(x + dx, y + dy));
        stack.push([x + dx, y + dy]);
      }
  }
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (!walk(x, y) || seen.has(key(x, y))) continue;
      const g = tileGround(x, y);
      if (g !== "grass" && g !== "forest") throw new Error(`casa: el tile (${x}, ${y}) quedó encerrado`);
      // Si ahí había algo que no bloquea (un helecho, flores), lo reemplaza la mata.
      const i = items.findIndex((f) => f.x - M === x && f.y - M === y);
      if (i >= 0) items.splice(i, 1);
      sow(pick(["bush-round", "bush-berry", "rock-mossy"], x, y, 105), x, y, "right");
    }
}

const points: PointDef[] = POINTS_LOCAL.map((p) => ({ ...p, x: p.x + M, y: p.y + M }));

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
    ground: (x, y) => fine(x + 0.5, y + 0.5),
    groundFine: fine,
    forestDistance: (x, y) => forestDist(x - M, y - M),
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
