import { noise, smoothNoise } from "./ruido";
import { catalogItem, footprint } from "../catalog";
import type { AreaDef, FloorKind, Placement, PointDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";

// ---------- Jardín ----------
// Una zona jugable de 80x64 con un margen de bosque de 10 tiles alrededor que se dibuja pero no se
// pisa (ver docs/plan-rediseno.md). Todo lo de abajo está en coordenadas de la zona jugable (0..79,
// 0..63) y se corre en M al ubicarlo en el nivel. Las franjas nuevas (x 64..79 al este, y 56..63 al sur)
// son para las estructuras de docs/plan-estructuras.md.
//
//   norte: la casa al centro, el huerto con el cobertizo y el invernadero al oeste, el patio al este;
//   centro: el camino de piedra del porche al portón, bifurcado hacia el huerto y hacia el lago;
//   sur: la fogata, la glorieta y el huerto de frutales al oeste; el lago con el muelle al sureste.

/** Margen de bosque alrededor de la zona jugable. */
const M = 10;
const PW = 80;
const PH = 64;
const W = PW + M * 2;
const H = PH + M * 2;

/** La casa (22x14) y su puerta: el porche da a la fila y = 17. */
const HOUSE = { x: 28, y: 3 };
const DOOR_X = HOUSE.x + 10;
const PORCH_Y = HOUSE.y + 14;
/**
 * El garaje (5x5), pegado al oeste de la torre de la casa (donde antes había bosquecito): la puerta chica
 * da a la fila y = 17, como el porche, y de su frente baja la entrada de concreto hasta el sendero del
 * huerto.
 */
const GARAGE = { x: 23, y: 12 };
const GARAGE_DOOR_X = GARAGE.x + 3;
const DRIVEWAY = { x0: 22.9, x1: 27.7, y0: 15, y1: 25.6 };
const inGarage = (x: number, y: number) => x >= GARAGE.x && x < GARAGE.x + 5 && y >= GARAGE.y && y < GARAGE.y + 5;
/** El portón de la cerca, al sur, donde llega el camino. */
const GATE_X = 38;

/**
 * Invernadero (5x4) y sus seis bancales, en L contra los vidrios del fondo (en este orden: el índice es su
 * id). Van detrás del centro del invernadero: así el vidrio del frente no les queda por detrás.
 */
const GREENHOUSE = { x: 2, y: 17 };
const BEDS = [
  ...[0, 1, 2, 3].map((dx) => ({ x: GREENHOUSE.x + dx, y: GREENHOUSE.y })),
  ...[1, 2].map((dy) => ({ x: GREENHOUSE.x, y: GREENHOUSE.y + dy })),
];

/** Huerto: 20 parcelas en 4 filas de 5, con pasillos de tierra entre ellas. */
const PLOTS = [6, 8, 10, 12].flatMap((y) => [8, 10, 12, 14, 16].map((x) => ({ x, y })));
const SOIL = { x0: 6.6, y0: 4.6, x1: 18.4, y1: 13.4 };

/**
 * Patio de piedra al este de la casa, con la pérgola y las mesas. La terraza es una sola: la cubierta
 * del ala este (dibujada con la casa, bajo el balcón del piso 2); por eso el patio no es de tablas.
 */
const PATIO = { x0: 51, y0: 5, x1: 62, y1: 16.6, r: 2.2 };

/** Lago al sureste: una elipse deformada con ruido, con un islote y el muelle desde la orilla oeste. */
const LAKE = { cx: 52.8, cy: 42.3, rx: 8.6, ry: 10.8 };
const ISLET = { cx: 56.2, cy: 45.8, r: 1.9 };
const DOCK = { x0: 43, x1: 50, y0: 40, y1: 42 };

/** Fogata con troncos alrededor y la glorieta. */
const FIRE = { x: 14, y: 36 };
const GAZEBO = { x: 24, y: 44 };
/**
 * La casa del árbol (4x4) en el huerto de frutales, contra la cerca oeste: lo que su copa tapa queda del
 * lado del bosque. La escalera de cuerda cuelga frente al segundo tile del frente (+y) y su pie es el portal.
 */
const TREEHOUSE = { x: 1, y: 44 };
const TREEHOUSE_FOOT = { x: TREEHOUSE.x + 1, y: TREEHOUSE.y + 4 };
/** Zona de charla de la fogata (en coordenadas del nivel): los troncos quedan adentro con un tile de aire. */
const FIRE_ZONE = { x: FIRE.x - 3 + M, y: FIRE.y - 3 + M, w: 8, h: 8 };

// ---------- Formas del terreno (continuas, en tiles de la zona jugable) ----------

interface Seg {
  a: [number, number];
  b: [number, number];
  w: number;
}

/** Senderos de piedra: tramos con su ancho. */
const PATHS: Seg[] = [
  // Explanada frente al porche y el camino al portón (con una leve curva).
  { a: [36.2, 18.6], b: [41.8, 18.6], w: 3.2 },
  { a: [39, 18], b: [39, 27], w: 2.6 },
  { a: [39, 27], b: [38.4, 37], w: 2.6 },
  { a: [38.4, 37], b: [39, 47], w: 2.6 },
  { a: [39, 47], b: [39, PH + 2], w: 2.6 },
  // Hacia el huerto (oeste): bordea el jardín de flores y sube por el lado del pozo.
  { a: [38, 27.8], b: [31, 29.2], w: 2 },
  { a: [31, 29.2], b: [24, 27.6], w: 2 },
  { a: [24, 27.6], b: [20.4, 22.5], w: 2 },
  { a: [20.4, 22.5], b: [19.6, 14.5], w: 2 },
  { a: [19.6, 14.5], b: [17.6, 13.8], w: 1.6 },
  // Hacia el lago (este) hasta la raíz del muelle.
  { a: [40, 28], b: [43.6, 31.5], w: 2 },
  { a: [43.6, 31.5], b: [43.4, 39.2], w: 2 },
  // Senderito de la casa del árbol a la fogata, entre los frutales.
  { a: [TREEHOUSE_FOOT.x + 0.5, TREEHOUSE_FOOT.y + 1.2], b: [9.5, 46.2], w: 1.3 },
  { a: [9.5, 46.2], b: [13.2, 39.6], w: 1.3 },
  // Senderitos a la fogata, a la glorieta y al patio.
  { a: [29, 28.9], b: [16.8, 34.8], w: 1.5 },
  { a: [38.8, 43.5], b: [30.2, 45.8], w: 1.5 },
  { a: [41.5, 18.6], b: [52.6, 16.4], w: 2 },
];

function segDist(px: number, py: number, s: Seg): number {
  const [ax, ay] = s.a;
  const [bx, by] = s.b;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Borde que ondula un poco (para que nada tenga el canto recto). */
const wobble = (x: number, y: number, seed: number, amp = 0.18) => (smoothNoise(x, y, 1.7, seed) - 0.5) * 2 * amp;

/** Caja de cada tramo (con su ancho): el piso fino se pide por píxel y así se descartan casi todos rápido. */
const PATH_BOXES = PATHS.map((s) => {
  const r = s.w / 2 + 0.2;
  return { x0: Math.min(s.a[0], s.b[0]) - r, x1: Math.max(s.a[0], s.b[0]) + r, y0: Math.min(s.a[1], s.b[1]) - r, y1: Math.max(s.a[1], s.b[1]) + r };
});
function onPath(x: number, y: number): boolean {
  let wb: number | null = null;
  for (let i = 0; i < PATHS.length; i++) {
    const b = PATH_BOXES[i]!;
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue;
    wb ??= wobble(x, y, 3, 0.12);
    if (segDist(x, y, PATHS[i]!) < PATHS[i]!.w / 2 + wb) return true;
  }
  return false;
}

function inLake(x: number, y: number): boolean {
  const dx = (x - LAKE.cx) / LAKE.rx;
  const dy = (y - LAKE.cy) / LAKE.ry;
  // El borde ondula a lo más un 22 % hacia afuera: lejos de eso ni se calcula.
  if (dx * dx + dy * dy > 1.5) return false;
  const a = Math.atan2(dy, dx);
  const r = 1 + 0.1 * Math.sin(3 * a + 1) + 0.06 * Math.sin(5 * a + 2.2) + wobble(x, y, 7, 0.05);
  return Math.hypot(dx, dy) < r;
}
const onIslet = (x: number, y: number) => Math.hypot(x - ISLET.cx, (y - ISLET.cy) * 1.15) < ISLET.r + wobble(x, y, 11, 0.2);
const onDock = (x: number, y: number) => x >= DOCK.x0 && x < DOCK.x1 && y >= DOCK.y0 && y < DOCK.y1;
/** Patio: rectángulo de esquinas redondeadas con el borde que ondula (como la tierra del huerto). */
function onPatio(x: number, y: number): boolean {
  const { x0, y0, x1, y1, r } = PATIO;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) < r + wobble(x, y, 29, 0.15);
}
/** Arena: la playita donde nace el muelle y el círculo de la fogata. */
const onSand = (x: number, y: number) =>
  Math.hypot(x - 43.4, (y - 41) * 0.8) < 2.9 + wobble(x, y, 13, 0.3) || Math.hypot(x - (FIRE.x + 1), y - (FIRE.y + 1)) < 3.3 + wobble(x, y, 17, 0.2);
/** Entrada de concreto del garaje: el borde de adelante, gastado, se come el pasto a mordiscos. */
const onDriveway = (x: number, y: number) =>
  x > DRIVEWAY.x0 + wobble(x, y, 31, 0.2) && x < DRIVEWAY.x1 + wobble(x, y, 32, 0.2) && y > DRIVEWAY.y0 && y < DRIVEWAY.y1 + wobble(x, y, 33, 0.5);
/** Tierra del huerto (rectángulo de esquinas redondeadas) y la base de la glorieta. */
function onSoil(x: number, y: number): boolean {
  const r = 1;
  const cx = Math.max(SOIL.x0 + r, Math.min(SOIL.x1 - r, x));
  const cy = Math.max(SOIL.y0 + r, Math.min(SOIL.y1 - r, y));
  return Math.hypot(x - cx, y - cy) < r + wobble(x, y, 19, 0.12);
}
/** Explanada de la glorieta: corrida hacia adelante (atrás va el macizo de flores). */
const onGazeboBase = (x: number, y: number) => Math.hypot(x - (GAZEBO.x + 2.6), y - (GAZEBO.y + 2.6)) < 3;

/** Piso con decimales (tiles de la zona jugable). */
function localGround(x: number, y: number): FloorKind {
  const outside = x < 0 || y < 0 || x >= PW || y >= PH;
  if (outside) {
    // El camino sigue más allá del portón y se pierde entre los árboles.
    if (y >= PH && y < PH + 6 && Math.abs(x - (GATE_X + 1)) < 1.3 - (y - PH) * 0.12 + wobble(x, y, 23, 0.2)) return "path";
    return "forest";
  }
  if (onDock(x, y)) return "dock";
  if (inLake(x, y) && !onIslet(x, y)) return "water";
  if (onPatio(x, y)) return "path";
  if (onGazeboBase(x, y)) return "path";
  if (onSand(x, y)) return "sand";
  if (onPath(x, y)) return "path";
  if (onDriveway(x, y)) return "concrete";
  if (onSoil(x, y)) return "soil";
  return "grass";
}

const fine = (x: number, y: number) => localGround(x - M, y - M);

// La puerta del porche tiene que coincidir con CONEXIONES.jardin.casa (tiles frente a la puerta).
if (CONEXIONES.jardin.casa.tiles[0]!.x !== DOOR_X + M || CONEXIONES.jardin.casa.tiles[0]!.y !== PORCH_Y + M)
  throw new Error("CONEXIONES.jardin.casa no coincide con la puerta de la casa");
if (CONEXIONES.jardin.casaArbol.tiles[0]!.x !== TREEHOUSE_FOOT.x + M || CONEXIONES.jardin.casaArbol.tiles[0]!.y !== TREEHOUSE_FOOT.y + M)
  throw new Error("CONEXIONES.jardin.casaArbol no coincide con la escalera de la casa del árbol");
if (CONEXIONES.jardin.garaje.tiles[0]!.x !== GARAGE_DOOR_X + M || CONEXIONES.jardin.garaje.tiles[0]!.y !== GARAGE.y + 5 + M)
  throw new Error("CONEXIONES.jardin.garaje no coincide con la puerta del garaje");

// ---------- Muebles ----------

const items: Placement[] = [];
/** Ubica en coordenadas de la zona jugable. */
const put = (type: string, x: number, y: number, facing: Placement["facing"] = "right") => items.push(place(type, x + M, y + M, facing));
const ground = (x: number, y: number) => localGround(x + 0.5, y + 0.5);
const isWater = (x: number, y: number) => ground(x, y) === "water";

// La casa y, al lado de la torre, el garaje.
put("house", HOUSE.x, HOUSE.y);
put("garage", GARAGE.x, GARAGE.y);
// Detrás del garaje (al noroeste) su dibujo tapa a quien se pare ahí: matorral y cachivaches tirados, sin
// lugar donde pararse (como el bosquecito detrás de la torre).
for (const [x, y, t] of [
  [21, 10, "oak-1"],
  [22, 10, "pine-2"],
  [23, 10, "bush-round"],
  [21, 11, "birch-1"],
  [22, 11, "oak-3"],
  [23, 11, "bush-berry"],
  [24, 11, "crates"],
  [21, 12, "bush-round"],
  [22, 12, "tire-stack"],
  [21, 13, "bush-berry"],
  [22, 13, "oil-drum"],
  [21, 14, "bush-round"],
  [22, 14, "barrel"],
  [21, 15, "bush-hydrangea"],
  [22, 15, "tire-stack"],
] as const)
  put(t, x, y, "down");

// Huerto: parcelas, cobertizo, invernadero, pozo, barriles, compost, colmenas y espantapájaros.
for (const p of PLOTS) put("garden-plot", p.x, p.y);
// El cobertizo en la esquina, contra la cerca: detrás no queda lugar donde alguien quede tapado.
put("tool-shed", 0, 0);
put("crates", 3, 1);
put("barrel", 5, 4);
put("wheelbarrow", 6, 15, "down");
put("compost", 2, 7, "right");
// El invernadero se entra por la puerta del frente: la base plana, el vidrio encima y los bancales en
// L (el fondo y el costado oeste), mirando al pasillo del medio.
put("greenhouse", GREENHOUSE.x, GREENHOUSE.y);
put("greenhouse-roof", GREENHOUSE.x, GREENHOUSE.y);
for (const b of BEDS) put("greenhouse-bed", b.x, b.y);
// El pozo junto al sendero del huerto, a la vista (no detrás de la torre ni del garaje).
put("well", 21, 16);
put("water-barrel", 18, 8);
put("water-barrel", 18, 11);
put("scarecrow", 13, 9, "down");
// Las colmenas al oeste del huerto, entre flores.
for (const [x, y] of [
  [3, 10],
  [3, 12],
  [4, 14],
])
  put("beehive", x!, y!, "down");
for (const [x, y] of [
  [4, 11],
  [2, 13],
  [4, 9],
  [5, 13],
])
  put("wildflowers", x!, y!);
put("signpost", 21, 21, "down");

// Jardín de flores entre el garaje y el camino, y canteros junto a la casa.
for (const [x, y, t] of [
  [28, 22, "bush-hydrangea"],
  [29, 24, "flower-patch"],
  [30, 26, "bush-rose"],
  [30, 21, "flower-patch"],
  [31, 23, "bush-rose"],
  [33, 21, "flower-patch"],
  [34, 23, "flower-patch"],
  [44, 21, "flower-patch"],
  [46, 22, "bush-hydrangea"],
  [48, 21, "flower-patch"],
] as const)
  put(t, x, y);

// Buzón y tablón junto al camino, frente al porche; farolas a lo largo del camino.
put("mailbox", 36, 21, "down");
put("notice-board", 42, 21, "down");
for (const [x, y] of [
  [36, 25],
  [44, 29],
  [36, 34],
  [41, 40],
  [36, 47],
  [42, 52],
  [22, 30],
])
  put("lamp-post", x!, y!);

// La casita de Tobi, el perro, camino al lago, con su cama delante: así la casita no lo tapa al dormir
// (ver PETS en @hyvento/shared).
put("dog-house", 48, 28, "down");
put("pet-bed", 48, 29);

// Patio este: mesas con sillas, la pérgola, farolitos y la leñera.
put("pergola", 57, 5);
for (const [tx, ty] of [
  [53, 8],
  [54, 13],
])
  // Tres sillas por mesa (la de adelante queda libre: se ve la mesa y se pasa).
  for (const [dx, dy, f] of [
    [-1, 0, "right"],
    [1, 0, "left"],
    [0, -1, "down"],
  ] as const)
    put("patio-chair", tx! + dx, ty! + dy, f);
put("patio-table", 53, 8);
put("patio-table", 54, 13);
put("woodpile", 61, 10);
put("bench", 59, 12, "left");
// Jardineras al borde norte del patio y un seto detrás: la pérgola tapa esos tiles.
for (const [x, y] of [
  [51, 7],
  [51, 11],
  [55, 16],
  [58, 16],
  [61, 14],
  [54, 4],
  [55, 4],
  [56, 4],
  [57, 4],
])
  put("planter", x!, y!);
for (const [x, y, t] of [
  [55, 3, "bush-hydrangea"],
  [56, 3, "bush-round"],
  [57, 3, "bush-rose"],
] as const)
  put(t, x, y);
for (const [x, y] of [
  [51, 4],
  [61, 4],
  [61, 16],
  [51, 16],
])
  put("garden-lantern", x!, y!);

// Fogata con cuatro troncos para sentarse alrededor (un punto de charla).
put("fire-pit", FIRE.x, FIRE.y);
put("log-seat", FIRE.x - 2, FIRE.y, "right");
put("log-seat", FIRE.x + 3, FIRE.y, "left");
put("log-seat", FIRE.x, FIRE.y - 2, "down");
put("log-seat", FIRE.x, FIRE.y + 3, "up");
put("woodpile", 9, 35);
put("stump", 19, 39);

// Glorieta: se entra por el frente (+x, desde el sendero) y adentro hay una banca en herradura. La base
// va plana y el techo es otra pieza en el mismo lugar (ver el catálogo). Afuera, bancas mirando al camino.
put("gazebo", GAZEBO.x, GAZEBO.y);
put("gazebo-roof", GAZEBO.x, GAZEBO.y);
put("bench", 29, 43, "down");
put("bench", 29, 48, "up");
// Alrededor de la glorieta (detrás, lo que tapa su techo, y pegado a la baranda) va un macizo de rosales
// y hortensias: ahí nadie se para, y quien se levanta de la banca queda adentro y no del otro lado.
for (const [x, y, t] of [
  [22, 42, "bush-rose"],
  [23, 42, "flower-patch"],
  [24, 42, "bush-hydrangea"],
  [22, 43, "bush-hydrangea"],
  [23, 43, "bush-rose"],
  [24, 43, "flower-patch"],
  [25, 43, "bush-rose"],
  [26, 43, "bush-hydrangea"],
  [27, 43, "flower-patch"],
  [22, 44, "flower-patch"],
  [23, 44, "bush-hydrangea"],
  [23, 45, "bush-rose"],
  [23, 46, "flower-patch"],
  [23, 47, "bush-hydrangea"],
  [22, 48, "bush-rose"],
  [24, 48, "flower-patch"],
  [25, 48, "bush-rose"],
  [26, 48, "flower-patch"],
  [27, 48, "bush-hydrangea"],
  [28, 42, "flower-patch"],
  [28, 49, "flower-patch"],
] as const)
  put(t, x, y);

// Huerto de frutales al suroeste, con la casa del árbol contra la cerca (se sacaron los dos frutales que
// quedaban encima de ella y de su senderito).
const FRUIT = ["apple-tree", "peach-tree", "cherry-tree"];
for (let i = 0; i < 3; i++)
  for (let j = 0; j < 4; j++) {
    const x = 4 + j * 4 + (i % 2) * 2;
    const y = 44 + i * 4;
    if ((x === 4 && y === 44) || (x === 6 && y === 48)) continue;
    put(FRUIT[(i + j * 2) % 3]!, x, y);
  }
put("treehouse", TREEHOUSE.x, TREEHOUSE.y);
// Detrás de la casa del árbol (contra la cerca) su copa tapa a quien se pare ahí: matas, sin lugar libre.
for (const [x, y, t] of [
  [0, 41, "bush-round"],
  [0, 42, "bush-berry"],
  [1, 42, "bush-rose"],
  [0, 43, "bush-hydrangea"],
  [1, 43, "bush-round"],
  [0, 44, "bush-berry"],
] as const)
  put(t, x, y, "down");
put("treehouse-ladder", TREEHOUSE_FOOT.x, TREEHOUSE_FOOT.y - 1);

// Lago: muelle con farol y bote, juncos, nenúfares, islote con un árbol, piedras, banca y picnic.
// El farol sobre las tablas, junto a la punta (la punta queda libre para pescar).
put("dock-lamp", DOCK.x1 - 2, DOCK.y0);
put("rowboat", DOCK.x1 - 3, DOCK.y1, "down");
// El islote: el roble y, alrededor, matas y piedras que lo cubren entero (no se llega caminando, así que
// no quedan tiles libres a los que un clic no encontraría ruta).
put("oak-2", Math.floor(ISLET.cx), Math.floor(ISLET.cy));
{
  const DECOR = ["bush-round", "rock-mossy", "bush-hydrangea", "rock-small", "bush-berry", "bush-rose"];
  let k = 0;
  for (let y = Math.floor(ISLET.cy) - 3; y <= Math.floor(ISLET.cy) + 3; y++)
    for (let x = Math.floor(ISLET.cx) - 3; x <= Math.floor(ISLET.cx) + 3; x++) {
      if (Math.hypot(x + 0.5 - ISLET.cx, y + 0.5 - ISLET.cy) > ISLET.r + 1.2 || isWater(x, y)) continue;
      if (x === Math.floor(ISLET.cx) && y === Math.floor(ISLET.cy)) continue;
      put(DECOR[k++ % DECOR.length]!, x, y, noise(x, y, 45) < 0.5 ? "right" : "down");
    }
}
put("picnic-table", 42, 48);
put("picnic-bench", 41, 48, "right");
put("picnic-bench", 43, 48, "left");
put("bench", 50, 29, "down");
// Juncos en el agua junto a la orilla y nenúfares más adentro (elegidos con ruido, siempre en el agua).
const nearLand = (x: number, y: number) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => !isWater(x + dx, y + dy) && ground(x + dx, y + dy) !== "dock"));
const farFromLand = (x: number, y: number, r: number) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!isWater(x + dx, y + dy)) return false;
  return true;
};
for (let y = 28; y < PH; y++)
  for (let x = 42; x < PW; x++) {
    if (!isWater(x, y) || (y >= DOCK.y0 - 1 && y <= DOCK.y1 && x < DOCK.x1 + 1)) continue;
    if (nearLand(x, y) && noise(x, y, 41) < 0.14) put("reeds", x, y, noise(x, y, 42) < 0.5 ? "right" : "down");
    else if (farFromLand(x, y, 1) && noise(x, y, 43) < 0.07) put("lily-pad", x, y, noise(x, y, 44) < 0.5 ? "right" : "down");
  }
/** La piedra plana de la orilla (norte del lago), donde también se pesca. */
const FLAT_ROCK = (() => {
  for (let x = 54; x < 60; x++)
    for (let y = 29; y < 36; y++) if (!isWater(x, y) && isWater(x, y + 1) && ground(x, y) === "grass") return { x, y };
  throw new Error("No hay orilla para la piedra plana");
})();
put("flat-rock", FLAT_ROCK.x, FLAT_ROCK.y);
for (const [x, y, t] of [
  [FLAT_ROCK.x + 1, FLAT_ROCK.y - 1, "rock-small"],
  [FLAT_ROCK.x - 2, FLAT_ROCK.y - 1, "rock-mossy"],
  [61, 36, "rock-medium"],
  [47, 53, "rock-small"],
  [60, 52, "boulder"],
  [42, 44, "rock-small"],
] as const)
  if (!isWater(x, y)) put(t, x, y);

// Rincón de rocas al noreste y naturaleza suelta (tipos y posiciones fijos: nada se repite en fila).
for (const [x, y, t, f] of [
  [55, 20, "boulder", "right"],
  [58, 22, "rock-medium", "down"],
  [53, 23, "rock-mossy", "right"],
  [60, 19, "rock-small", "right"],
  [57, 25, "fallen-log", "down"],
  [54, 25, "mushrooms", "right"],
  [61, 24, "fern", "right"],
  [52, 19, "fern", "down"],
  [60, 27, "pine-2", "right"],
  [62, 21, "oak-1", "down"],
  [48, 25, "birch-1", "right"],
  [46, 27, "fern", "right"],
  // Detrás del ala este y al borde del huerto.
  [52, 1, "pine-1", "down"],
  [56, 2, "birch-2", "right"],
  [8, 1, "pine-3", "right"],
  [13, 1, "oak-1", "down"],
  [1, 12, "pine-2", "right"],
  [1, 25, "oak-big", "right"],
  [4, 30, "birch-2", "right"],
  [2, 38, "pine-1", "down"],
  [9, 25, "bush-berry", "right"],
  [11, 27, "oak-2", "down"],
  [6, 33, "mushrooms", "down"],
  [8, 40, "fern", "right"],
  [26, 34, "birch-1", "down"],
  [31, 37, "oak-3", "right"],
  [33, 31, "bush-round", "down"],
  [24, 38, "fern", "down"],
  [18, 30, "bush-berry", "down"],
  [32, 52, "oak-1", "right"],
  [26, 53, "pine-2", "down"],
  [20, 52, "bush-round", "right"],
  [35, 54, "fern", "right"],
  [44, 54, "birch-2", "down"],
  [41, 24, "bush-round", "right"],
  [34, 17, "bush-round", "down"],
  [11, 20, "fallen-log", "right"],
  [16, 23, "rock-medium", "down"],
  [6, 22, "stump", "right"],
  [13, 42, "mushrooms", "right"],
  [36, 39, "wildflowers", "right"],
  [33, 44, "wildflowers", "down"],
  [45, 35, "wildflowers", "right"],
  [16, 50, "wildflowers", "down"],
  [49, 34, "fern", "down"],
  [62, 42, "pine-3", "right"],
  [62, 30, "oak-3", "down"],
  [50, 55, "oak-1", "right"],
] as const)
  // Lo que cae en el agua (la orilla ondula con ruido) se omite: nada de helechos flotando.
  if (!isWater(x, y)) put(t, x, y, f);

// Detrás de la casa y de la torre no se vería a nadie (el dibujo de la casa lo tapa entero): el pasillo
// del fondo y el rincón entre el huerto y la torre son un bosquecito cerrado, sin lugar donde pararse.
/** Primer x tapado por la torre en cada fila y = 3..13 (medido proyectando el dibujo de la casa). */
const TOWER_SHADOW = [19, 19, 20, 20, 21, 22, 23, 24, 25, 26, 27];
const behindHouse = (x: number, y: number) =>
  (y >= 0 && y <= 2 && x >= 18 && x <= 42) || (y >= 3 && y <= 13 && x >= TOWER_SHADOW[y - 3]! && x < HOUSE.x);
{
  const THICKET = ["oak-1", "pine-2", "birch-1", "oak-3", "pine-1", "bush-round", "oak-2", "pine-3", "birch-2", "bush-berry"];
  const used = new Set<string>();
  const free = (x: number, y: number) => behindHouse(x, y) && !inGarage(x, y) && !used.has(`${x},${y}`);
  for (let y = 0; y <= 13; y++)
    for (let x = 18; x < HOUSE.x + 15; x++) {
      if (!free(x, y)) continue;
      // Robles viejos donde entran (menos dibujos) y árboles sueltos en el resto: todo tile queda ocupado.
      if (free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1) && noise(x, y, 81) < 0.45) {
        put("oak-big", x, y);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) used.add(`${x + dx},${y + dy}`);
        continue;
      }
      put(THICKET[Math.floor(noise(x, y, 82) * THICKET.length)]!, x, y, noise(x, y, 83) < 0.5 ? "right" : "down");
      used.add(`${x},${y}`);
    }
}

// ---------- Puntos ----------

const pt = (type: PointDef["type"], name: string, x: number, y: number): PointDef => ({ type, name, x: x + M, y: y + M });

const POINTS: PointDef[] = [
  pt("spawn", "Portón del jardín", GATE_X, PH - 3),
  pt("mailbox", "Buzón", 36, 22),
  pt("task_board", "Tablón", 42, 22),
  // Una por parcela, en el mismo orden que PLOTS (el índice es el id de la parcela): sobre la parcela.
  ...PLOTS.map((p, i) => pt("garden_plot", `Parcela ${i + 1}`, p.x, p.y)),
  // Frente a la puerta del cobertizo: la regadera y las semillas.
  pt("tool_shed", "Cobertizo", 1, 3),
  // Uno por bancal del invernadero, en el orden de BEDS (el índice es el id del bancal).
  ...BEDS.map((b, i) => pt("greenhouse_plot", `Bancal ${i + 1}`, b.x, b.y)),
  // La punta del muelle y la piedra plana de la orilla norte.
  pt("fishing_spot", "Muelle", DOCK.x1 - 1, DOCK.y0),
  pt("fishing_spot", "Muelle", DOCK.x1 - 1, DOCK.y0 + 1),
  pt("fishing_spot", "Piedra de la orilla", FLAT_ROCK.x, FLAT_ROCK.y),
];

// Naturaleza suelta en el pasto libre: manchones de árboles junto a la cerca y en algunos bosquecitos,
// claros abiertos en el medio y matas, flores y piedritas sueltas. Nunca junto a un sendero, un punto,
// la puerta o un mueble (así no se tapa ningún paso).
{
  const reserved = new Set<string>();
  const mark = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) reserved.add(`${x + dx},${y + dy}`);
  };
  for (const f of items) {
    const item = catalogItem(f.type);
    const [w, d] = footprint(item, f.facing ?? "right");
    for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) mark(f.x - M + x, f.y - M + y, item.flat ? 0 : 1);
  }
  for (const p of POINTS) mark(p.x - M, p.y - M, p.type === "spawn" ? 3 : 1);
  mark(DOOR_X, PORCH_Y + 2, 2);
  // El pie de la escalera de la casa del árbol, despejado (que ningún árbol la tape).
  mark(TREEHOUSE_FOOT.x, TREEHOUSE_FOOT.y + 1, 2);
  const soft = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground(x + dx, y + dy) !== "grass") return true;
    return false;
  };
  const TREES = ["oak-1", "oak-2", "oak-3", "birch-1", "birch-2", "pine-1", "pine-2", "pine-3", "oak-1", "birch-1"];
  const SMALL = ["tall-grass", "wildflowers", "tall-grass", "fern", "rock-small", "tall-grass", "bush-round", "wildflowers", "fern", "bush-berry", "tall-grass", "mushrooms"];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (reserved.has(`${x},${y}`) || ground(x, y) !== "grass" || soft(x, y)) continue;
      const edge = Math.min(x, y, PW - 1 - x, PH - 1 - y);
      const grove = smoothNoise(x, y, 7, 71);
      const pTree = edge < 2 ? 0.3 : edge < 4 ? 0.12 : grove > 0.72 ? 0.34 : 0.004;
      const n = noise(x, y, 72);
      const facing = noise(x, y, 73) < 0.5 ? "right" : "down";
      if (n < pTree) {
        put(TREES[Math.floor(noise(x, y, 74) * TREES.length)]!, x, y, facing);
        mark(x, y, 1);
      } else if (n < pTree + 0.09) {
        const t = SMALL[Math.floor(noise(x, y, 75) * SMALL.length)]!;
        put(t, x, y, facing);
        mark(x, y, catalogItem(t).solid === false ? 0 : 1);
      }
    }
}

// La cerca rodea la zona jugable (en la primera fila del margen) con el portón al sur.
const FENCE_Y0 = -1;
const FENCE_Y1 = PH;
put("garden-gate", GATE_X, FENCE_Y1);
for (let x = -1; x <= PW; x++) {
  const corner = x === -1 || x === PW;
  put(corner ? "fence-post" : "fence", x, FENCE_Y0, "down");
  if (x !== GATE_X && x !== GATE_X + 1) put(corner ? "fence-post" : "fence", x, FENCE_Y1, "down");
}
for (let y = 0; y < PH; y++) {
  put("fence", -1, y);
  put("fence", PW, y);
}

// Bosque del margen: tupido junto a la cerca y con árboles grandes más afuera. Un árbol por celda, en
// una posición y de un tipo elegidos con ruido; el sendero que sale del portón queda despejado.
const MARGIN_TREES = ["pine-1", "pine-2", "pine-3", "oak-1", "oak-2", "oak-3", "birch-1", "pine-1", "pine-2", "oak-1"];
const MARGIN_SMALL = ["bush-round", "fern", "rock-mossy", "bush-berry", "fern", "rock-small", "stump", "bush-round", "fern", "tall-grass"];
{
  const taken = new Set<string>();
  const free = (x: number, y: number, w = 1, d = 1) => {
    for (let j = 0; j < d; j++)
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < -M || ty < -M || tx >= PW + M || ty >= PH + M) return false;
        // Fuera de la cerca y lejos del sendero que se pierde en el bosque.
        if (tx >= -1 && tx <= PW && ty >= -1 && ty <= PH) return false;
        // Junto al portón, más ancho: que ningún árbol tape sus pilares ni su farol.
        if (ty > PH && Math.abs(tx - GATE_X - 0.5) < (ty <= PH + 2 ? 3.5 : 2.5) && ty < PH + 7) return false;
        if (taken.has(`${tx},${ty}`)) return false;
      }
    return true;
  };
  const take = (x: number, y: number, w = 1, d = 1) => {
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) taken.add(`${x + i},${y + j}`);
  };
  const dist = (x: number, y: number) => Math.max(-1 - x, x - PW, -1 - y, y - PH);
  /** Delante del portón en pantalla (abajo a la derecha): solo cosas bajas, que no tapen sus pilares. */
  const lowOnly = (x: number, y: number, w = 1) =>
    y > PH && y <= PH + 6 && Math.abs(x + (w - 1) / 2 - GATE_X - 0.5 - (y - PH)) < 2.6;
  for (let cy = -M; cy < PH + M; cy += 2)
    for (let cx = -M; cx < PW + M; cx += 2) {
      const n = noise(cx, cy, 61);
      const x = cx + Math.floor(noise(cx, cy, 62) * 2) + (((cy / 2) & 1) === 0 ? 0 : 1);
      const y = cy + Math.floor(noise(cx, cy, 63) * 2);
      const d = dist(x, y);
      // Solo una fila de árboles de unos 4 tiles: más afuera el suelo ya es la copa del bosque.
      if (d < 1 || d > 4) continue;
      // Robles viejos más afuera; cerca de la cerca, árboles chicos y matas.
      if (d > 2 && n < 0.34 && free(x, y, 2, 2) && !lowOnly(x, y, 2) && !lowOnly(x, y + 1, 2)) {
        put("oak-big", x, y);
        take(x, y, 2, 2);
        continue;
      }
      if (!free(x, y)) continue;
      if ((n < 0.86 || d > 2) && !lowOnly(x, y)) {
        put(MARGIN_TREES[Math.floor(noise(cx, cy, 64) * MARGIN_TREES.length)]!, x, y, noise(cx, cy, 65) < 0.5 ? "right" : "down");
        take(x, y);
      } else {
        put(MARGIN_SMALL[Math.floor(noise(cx, cy, 66) * MARGIN_SMALL.length)]!, x, y, noise(cx, cy, 65) < 0.5 ? "right" : "down");
        take(x, y);
      }
    }
  // Sotobosque: matas, helechos y piedras en algunos huecos entre los árboles (pocos: cada uno es un
  // dibujo más en la escena y casi no se ven entre las copas).
  for (let y = -M; y < PH + M; y++)
    for (let x = -M; x < PW + M; x++) {
      if (dist(x, y) < 2 || dist(x, y) > 4 || !free(x, y) || noise(x, y, 67) > 0.18) continue;
      put(MARGIN_SMALL[Math.floor(noise(x, y, 68) * MARGIN_SMALL.length)]!, x, y, noise(x, y, 69) < 0.5 ? "right" : "down");
      take(x, y);
    }
}

export const jardin: AreaDef = {
  id: "jardin",
  name: "Jardín",
  width: W,
  height: H,
  outdoor: true,
  playable: { x: M, y: M, w: PW, h: PH },
  surroundings: "forest",
  ground: (x, y) => fine(x + 0.5, y + 0.5),
  groundFine: fine,
  rooms: [],
  doors: [],
  zones: [
    { id: "jardin", name: "Jardín", type: "common", rect: { x: 0, y: 0, w: W, h: H }, isolated: false },
    // Alrededor de la fogata (los cuatro troncos y un tile más) se charla aparte, como en las mesas de la
    // cafetería: lo que se dice junto al fuego queda junto al fuego.
    { id: "fogata", name: "Fogata", type: "table", rect: FIRE_ZONE, isolated: true },
    // Adentro de la glorieta, igual: una burbuja de charla bajo el techo.
    { id: "glorieta", name: "Glorieta", type: "table", rect: { x: GAZEBO.x + M, y: GAZEBO.y + M, w: 4, h: 4 }, isolated: true },
  ],
  features: [],
  furniture: items,
  portals: [
    {
      id: "jardin-casa",
      label: "Entrar a la casa",
      tiles: CONEXIONES.jardin.casa.tiles,
      to: hacia("planta-baja", CONEXIONES.plantaBaja.entrada),
    },
    {
      id: "jardin-escalera-terraza",
      label: "Subir al balcón del piso 2",
      tiles: CONEXIONES.jardin.escaleraTerraza.tiles,
      to: hacia("piso-2", CONEXIONES.piso2.terraza),
    },
    {
      id: "jardin-casa-arbol",
      label: "Subir a la casa del árbol",
      tiles: CONEXIONES.jardin.casaArbol.tiles,
      to: hacia("casa-arbol", CONEXIONES.casaArbol.trampilla),
    },
    {
      id: "jardin-garaje",
      label: "Entrar al garaje",
      tiles: CONEXIONES.jardin.garaje.tiles,
      to: hacia("garaje", CONEXIONES.garaje.entrada),
    },
  ],
  points: POINTS,
};

