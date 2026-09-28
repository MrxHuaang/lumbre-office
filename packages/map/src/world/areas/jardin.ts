import { noise, smoothNoise } from "./ruido";
import { catalogItem, footprint } from "../catalog";
import { GRADAS, GRADAS_ROWS } from "../catalog-escenario";
import type { AreaDef, FloorKind, Placement, PointDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";
import { BUS_DOOR_X, PARADA_M, ROAD, STATION } from "./parada";
import { POOL_BASIN, POOL_SIZE, POOL_STEPS } from "../catalog-agua";

// ---------- Jardín ----------
// Una zona jugable de 80x70 con un margen de bosque de 10 tiles alrededor que se dibuja pero no se
// pisa (ver docs/plan-rediseno.md). Todo lo de abajo está en coordenadas de la zona jugable (0..79,
// 0..69) y se corre en M al ubicarlo en el nivel. Las franjas nuevas (x 64..79 al este, y 56..63 al sur)
// son para las estructuras de docs/plan-estructuras.md. La cerca va en y = 64: afuera del portón quedan
// el sendero, la vereda y la parada del bus (world/areas/parada.ts), y la calle pasa por el margen.
//
//   norte: la casa al centro, el huerto con el cobertizo y el invernadero al oeste, el patio al este;
//   centro: el camino de piedra del porche al portón, bifurcado hacia el huerto y hacia el lago;
//   sur: la fogata, la glorieta y el huerto de frutales al oeste; el lago con el muelle al sureste.

/** Margen de bosque alrededor de la zona jugable. */
const M = 10;
const PW = 80;
const PH = 70;
/** La cerca del sur (con el portón): lo de más abajo es la vereda de la parada del bus. */
const FENCE_Y = 64;
if (PARADA_M !== M) throw new Error("parada.ts tiene otro margen que el jardín");
const W = PW + M * 2;
const H = PH + M * 2;

/** La casa (22x14) y su puerta: el porche da a la fila y = 17. */
const HOUSE = { x: 28, y: 3 };
const DOOR_X = HOUSE.x + 10;
const PORCH_Y = HOUSE.y + 14;
/**
 * El garaje (5x5), pegado al oeste de la torre de la casa (donde antes había bosquecito): la puerta chica
 * da a la fila y = 17, como el porche, y de su frente baja la entrada de gravilla hasta el sendero del
 * huerto.
 */
const GARAGE = { x: 23, y: 12 };
const GARAGE_DOOR_X = GARAGE.x + 3;
const DRIVEWAY = { x0: 23.1, x1: 27.4, y0: 15, y1: 25.6 };
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

/**
 * La piscina, "atrás" de la cabaña pero a la vista: al este del patio (x 64..78), donde no la tapa nada de
 * la casa. Un deck de tablas de 15x13 con la pileta de piedra en el medio (ver catalog-agua.ts).
 */
const POOL = { x: 64, y: 1 };
const POOL_BOX = { x0: POOL.x, y0: POOL.y, x1: POOL.x + POOL_SIZE[0], y1: POOL.y + POOL_SIZE[1] };
/** El trampolín, en el borde oeste de la pileta mirando hacia el agua. */
const BOARD = { x: POOL.x + POOL_BASIN.x - 1, y: POOL.y + POOL_BASIN.y + Math.floor(POOL_BASIN.d / 2) };
/**
 * La granja (docs/plan-estructuras.md, 4, 5 y 9). La parrilla con el horno de barro va en el rincón de
 * rocas al sur del patio, sobre un piso de piedra; el gallinero, al oeste, contra la cerca (detrás no
 * queda nadie), con su patio de tierra y el corral de la cabra al lado, y el molino, sobre un arroyo
 * angosto que entra del bosque por el este y baja al lago por el sur.
 */
const GRILL_PAD = { cx: 56.8, cy: 21.2, rx: 5.6, ry: 3.3 };
const OVEN = { x: 53, y: 19 };
const BRICK_GRILL = { x: 57, y: 19 };
/** El patio de las gallinas (adentro de la cerca) y el corral de la cabra, al lado. */
const HEN_YARD = { x: 0, y: 24, w: 8, h: 7 };
const CORRAL = { x: 9, y: 24, w: 3, h: 7 };
const COOP = { x: 0, y: 24 };
/** Los huecos de la cerca por donde se entra al patio y al corral (fila de abajo). */
const YARD_GATE_X = 4;
const CORRAL_GATE_X = 10;
/** El molino (3x3) en la orilla norte del arroyo, con la rueda en el agua; el puentecito, más al este. */
const MILL = { x: 65, y: 55 };
const WHEEL = { x: 66, y: 58 };
const BRIDGE = { x: 71, y: 58, w: 2, d: 3 };
/** El arroyo: tramos desde el bosque del este hasta la orilla sur del lago (angosto, con su ancho). */
const STREAM: Seg[] = [
  { a: [85, 61.2], b: [79, 60.6], w: 1.7 },
  { a: [79, 60.6], b: [74, 60.1], w: 1.7 },
  { a: [74, 60.1], b: [69.5, 59.1], w: 1.7 },
  { a: [69.5, 59.1], b: [65.5, 58.4], w: 1.6 },
  { a: [65.5, 58.4], b: [62.2, 56.8], w: 1.6 },
  { a: [62.2, 56.8], b: [59.6, 54.4], w: 1.7 },
  { a: [59.6, 54.4], b: [57.4, 52], w: 1.8 },
  { a: [57.4, 52], b: [55.6, 49.8], w: 2 },
];
/** Rectángulos que la naturaleza suelta no toca (el patio de la parrilla, el gallinero, el molino). */
const KEEP_CLEAR = [
  { x0: 50, y0: 17, x1: 63, y1: 26 },
  { x0: 0, y0: 22, x1: 12, y1: 33 },
  { x0: 62, y0: 53, x1: 76, y1: 63 },
];

/** Fogata con troncos alrededor y la glorieta. */
const FIRE = { x: 14, y: 36 };
const GAZEBO = { x: 24, y: 44 };
/**
 * La casa del árbol (4x4) en el huerto de frutales, contra la cerca oeste: lo que su copa tapa queda del
 * lado del bosque. La escalera de cuerda cuelga frente al segundo tile del frente (+y) y su pie es el portal.
 */
const TREEHOUSE = { x: 1, y: 44 };
const TREEHOUSE_FOOT = { x: TREEHOUSE.x + 1, y: TREEHOUSE.y + 4 };
/**
 * Escenario (franja sur, ver catalog-escenario.ts): la concha al oeste, la tarima delante (mirando al este)
 * y las gradas en semicírculo hacia el camino. Al lado, un prado de flores bajas (el estudio de grabación
 * está adentro de la casa, al final del pasillo del piso 3).
 */
const STAGE = { x: 12, y: 56 };
const DECK = { x: STAGE.x + 3, y: STAGE.y, w: 3, h: 7 };
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
  { a: [39, 47], b: [39, FENCE_Y + 3], w: 2.6 },
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
  // Del patio al deck de la piscina.
  { a: [62, 8.5], b: [64.4, 8.5], w: 1.8 },
  // Senderito del camino al escenario: bordea el prado de flores y entra por el pasillo del medio de las
  // gradas hasta la escalerita de la tarima.
  { a: [38.6, 60.8], b: [33.5, 60.2], w: 1.5 },
  { a: [33.5, 60.2], b: [27.5, 59.6], w: 1.4 },
  { a: [27.5, 59.6], b: [18.4, 59.5], w: 1.1 },
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
/** El deck de la piscina: tablas como las del muelle (se pisa y suena a madera). */
const onPoolDeck = (x: number, y: number) => x >= POOL_BOX.x0 && x < POOL_BOX.x1 && y >= POOL_BOX.y0 && y < POOL_BOX.y1;
/** Patio: rectángulo de esquinas redondeadas con el borde que ondula (como la tierra del huerto). */
function onPatio(x: number, y: number): boolean {
  const { x0, y0, x1, y1, r } = PATIO;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) < r + wobble(x, y, 29, 0.15);
}
/** El arroyo del molino (también se asoma en el bosque del este, de donde viene). */
function inStream(x: number, y: number): boolean {
  if (x < 54 || y < 48) return false;
  const wb = wobble(x, y, 51, 0.12);
  return STREAM.some((s) => segDist(x, y, s) < s.w / 2 + wb);
}
/** El puentecito: sus tablas sobre el agua se caminan. */
const onBridge = (x: number, y: number) => x >= BRIDGE.x && x < BRIDGE.x + BRIDGE.w && y >= BRIDGE.y && y < BRIDGE.y + BRIDGE.d;
/** Piso de piedra de la parrilla: un óvalo que ondula, pegado al patio. */
const onGrillPad = (x: number, y: number) => Math.hypot((x - GRILL_PAD.cx) / GRILL_PAD.rx, (y - GRILL_PAD.cy) / GRILL_PAD.ry) < 1 + wobble(x, y, 53, 0.08);
/** Tierra apisonada del patio de las gallinas (las gallinas escarban el pasto). */
const onHenYard = (x: number, y: number) =>
  x > HEN_YARD.x - 0.4 + wobble(x, y, 55, 0.2) && x < HEN_YARD.x + HEN_YARD.w - 0.6 + wobble(x, y, 56, 0.25) && y > HEN_YARD.y + 0.2 + wobble(x, y, 57, 0.2) && y < HEN_YARD.y + HEN_YARD.h - 0.3 + wobble(x, y, 58, 0.25);

/** Arena: la playita donde nace el muelle y el círculo de la fogata. */
const onSand = (x: number, y: number) =>
  Math.hypot(x - 43.4, (y - 41) * 0.8) < 2.9 + wobble(x, y, 13, 0.3) || Math.hypot(x - (FIRE.x + 1), y - (FIRE.y + 1)) < 3.3 + wobble(x, y, 17, 0.2);
/** Entrada de gravilla del garaje: el borde de adelante se come el pasto a mordiscos. */
const onDriveway = (x: number, y: number) =>
  x > DRIVEWAY.x0 + wobble(x, y, 31, 0.45) && x < DRIVEWAY.x1 + wobble(x, y, 32, 0.45) && y > DRIVEWAY.y0 && y < DRIVEWAY.y1 + wobble(x, y, 33, 0.5);
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
    // La calle de la parada cruza todo el margen del sur y en las puntas se pierde en el bosque.
    const ry = y + M;
    const rx = x + M;
    if (ry >= ROAD.y0 && ry < ROAD.curbY && rx > ROAD.x0 + wobble(x, y, 23, 0.6) && rx < ROAD.x1 + wobble(x, y, 24, 0.6)) return "road";
    // El arroyo del molino viene del bosque del este.
    if (x >= PW && x < PW + 6 && inStream(x, y)) return "water";
    return "forest";
  }
  // Afuera de la cerca: la vereda de piedra a lo largo de la calle y el sendero del portón.
  if (y >= FENCE_Y) {
    if (onPath(x, y)) return "path";
    if (y > ROAD.y0 - M - 1.15 + wobble(x, y, 25, 0.08)) return "path";
    return "grass";
  }
  if (onDock(x, y) || onPoolDeck(x, y)) return "dock";
  if (inStream(x, y)) return onBridge(x, y) ? "dock" : "water";
  if (inLake(x, y) && !onIslet(x, y)) return "water";
  if (onGrillPad(x, y)) return "path";
  if (onHenYard(x, y)) return "sand";
  if (onPatio(x, y)) return "path";
  if (onGazeboBase(x, y)) return "path";
  if (onSand(x, y)) return "sand";
  if (onPath(x, y)) return "path";
  if (onDriveway(x, y)) return "gravel";
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
  [20, 12, "bush-berry"],
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

// Escenario: la concha, la tarima con el atril (al lado de la escalerita), los faroles y las gradas.
put("stage-shell", STAGE.x, STAGE.y);
put("stage-deck", DECK.x, DECK.y);
put("stage-lectern", DECK.x + 2, DECK.y + 2);
put("stage-lantern", DECK.x + 2, DECK.y - 1);
put("stage-lantern", DECK.x + 2, DECK.y + DECK.h);
GRADAS_ROWS.forEach((r, k) => put(`gradas-${k + 1}`, GRADAS.origin.x + r.dx, GRADAS.origin.y + r.dy));
// Detrás de la concha (al oeste y al norte) su dibujo tapa a quien se pare: matorral cerrado, sin lugar
// donde pararse (árboles al fondo, matas más cerca).
for (let y = 53; y < 64; y++)
  for (let x = 8; x < DECK.x + 2; x++) {
    if (x >= STAGE.x && y >= STAGE.y) continue;
    // Delante de la tarima en pantalla (al suroeste) solo matas: un árbol taparía la esquina del escenario.
    const back = (x < 10 && y < 60) || y < 54;
    const t = back ? ["pine-1", "oak-1", "pine-3", "birch-1", "oak-3"][(x * 7 + y * 3) % 5]! : ["bush-round", "bush-hydrangea", "bush-berry", "bush-rose", "bush-round"][(x * 5 + y) % 5]!;
    put(t, x, y, (x + y) % 2 ? "right" : "down");
  }
// Entre las gradas y el camino, un prado de flores silvestres: todo bajo (nada tapa las gradas ni a quien
// pasea por ahí), con matas en el borde del bosque y alguna piedra con hongos.
for (const [x, y, t] of [
  [28, 53, "bush-rose"],
  [30, 53, "bush-hydrangea"],
  [32, 53, "flower-patch"],
  [34, 53, "bush-round"],
  [29, 54, "wildflowers"],
  [31, 55, "flower-patch"],
  [33, 54, "tall-grass"],
  [35, 55, "wildflowers"],
  [28, 56, "flower-patch"],
  [30, 57, "wildflowers"],
  [32, 56, "rock-small"],
  [33, 56, "mushrooms"],
  [34, 57, "flower-patch"],
  [29, 58, "tall-grass"],
  [31, 58, "flower-patch"],
  [36, 56, "wildflowers"],
  [28, 62, "wildflowers"],
  [31, 62, "flower-patch"],
  [35, 62, "wildflowers"],
  [26, 62, "rock-small"],
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
    // El arroyo lleva sus propios juncos (ver la granja, más abajo).
    if (!isWater(x, y) || inStream(x + 0.5, y + 0.5) || (y >= DOCK.y0 - 1 && y <= DOCK.y1 && x < DOCK.x1 + 1)) continue;
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

// ---------- La piscina ----------

// La piscina: el deck con la pileta (plano, se camina alrededor), el trampolín en el borde oeste,
// reposeras mirando al agua (las del fondo, con sombrillas entre medio: atrás no tapan a nadie, y con un
// pasillo entre ellas y el agua), la ducha
// y los toalleros en el costado este. Delante (al sur) solo reposeras: son bajas y no tapan a quien nada.
put("pool", POOL.x, POOL.y);
put("diving-board", BOARD.x, BOARD.y, "right");
for (const x of [68, 70, 72, 74]) put("sun-lounger", x, POOL.y, "down");
for (const x of [69, 73]) put("parasol", x, POOL.y);
for (const x of [69, 71, 73]) put("sun-lounger", x, POOL.y + POOL_SIZE[1] - 3, "up");
put("towel-rack", POOL.x + POOL_SIZE[0] - 1, POOL.y + 2);
put("garden-shower", POOL.x + POOL_SIZE[0] - 1, POOL.y + POOL_SIZE[1] - 2);
put("planter", POOL.x + POOL_SIZE[0] - 1, POOL.y + 7);
put("planter", POOL.x, POOL.y);
// Farolitos en las esquinas del lado del patio (de noche, luz cálida junto al agua turquesa).
put("garden-lantern", POOL.x, POOL.y + POOL_SIZE[1] - 1);
put("garden-lantern", POOL.x + POOL_SIZE[0] - 1, POOL.y);
// Un seto bajo entre el deck y la cerca del fondo (así nadie se levanta de una reposera hacia afuera).
{
  const HEDGE = ["bush-hydrangea", "bush-round", "bush-rose", "bush-round", "bush-berry"];
  for (let x = POOL.x; x < POOL.x + POOL_SIZE[0]; x++) put(HEDGE[x % HEDGE.length]!, x, POOL.y - 1, x % 2 ? "down" : "right");
}

// ---------- La granja ----------

// La parrilla: el horno de barro (la boca con el fuego mira al patio de piedra), la parrilla de ladrillo,
// la mesa de preparación, la pizarra con el menú, leña y dos mesas de picnic para comer juntos.
put("clay-oven", OVEN.x, OVEN.y);
put("brick-grill", BRICK_GRILL.x, BRICK_GRILL.y);
put("prep-table", 60, 19);
put("menu-board", 51, 20, "down");
put("woodpile", 62, 18);
put("garden-lantern", 52, 18);
put("garden-lantern", 61, 22);
for (const [tx, ty] of [
  [55, 24],
  [59, 24],
] as const) {
  put("picnic-table", tx, ty);
  put("picnic-bench", tx - 1, ty, "right");
  put("picnic-bench", tx + 1, ty, "left");
}

// El gallinero, contra la cerca del oeste: detrás, pacas de heno (ahí nadie se para). El nido se abre
// por el costado del patio y la rampa baja al patio de tierra, donde están el comedero, el bebedero y el
// saco de maíz. La cerca de palos rodea el patio y el corral de la cabra, cada uno con su hueco abajo.
put("chicken-coop", COOP.x, COOP.y);
for (const [x, y] of [
  [0, 23],
  [1, 23],
  [2, 23],
  [0, 22],
  [1, 22],
] as const)
  put("hay-bale", x, y, noise(x, y, 91) < 0.5 ? "right" : "down");
put("chicken-feeder", 4, 28);
put("water-trough", 6, 26);
put("feed-sack", 7, 24);
put("goat-shed", CORRAL.x + 1, CORRAL.y);
put("hay-rack", CORRAL.x, CORRAL.y + CORRAL.h - 1);
put("water-trough", CORRAL.x + 2, CORRAL.y + 4);
{
  const top = HEN_YARD.y - 1;
  const bottom = HEN_YARD.y + HEN_YARD.h;
  const east = CORRAL.x + CORRAL.w;
  // Arriba (detrás del gallinero van las pacas) y abajo, con los dos huecos.
  for (let x = COOP.x + 3; x <= east; x++) put("stick-fence", x, top, "down");
  for (let x = HEN_YARD.x; x <= east; x++) if (x !== YARD_GATE_X && x !== CORRAL_GATE_X) put("stick-fence", x, bottom, "down");
  // La del medio (entre el patio y el corral) y la del este.
  for (let y = HEN_YARD.y; y < bottom; y++) {
    put("stick-fence", HEN_YARD.x + HEN_YARD.w, y);
    put("stick-fence", east, y);
  }
}
put("farm-sign", YARD_GATE_X + 1, HEN_YARD.y + HEN_YARD.h + 1, "down");
put("garden-lantern", YARD_GATE_X - 2, HEN_YARD.y + HEN_YARD.h + 1);

// El molino: en la orilla norte del arroyo, con la rueda en el agua y la puerta al este (hacia el
// puentecito). Detrás, un bosquecito que no deja lugar donde alguien quede tapado; juncos en las orillas.
put("water-mill", MILL.x, MILL.y);
put("mill-wheel", WHEEL.x, WHEEL.y);
put("footbridge", BRIDGE.x, BRIDGE.y);
put("flour-sacks", MILL.x + 3, MILL.y - 1);
put("millstone", MILL.x + 5, MILL.y + 1);
put("garden-lantern", BRIDGE.x - 1, BRIDGE.y - 1);
put("bench", 75, 62, "up");
for (const [x, y, t] of [
  [63, 54, "oak-2"],
  [64, 54, "pine-2"],
  [64, 53, "birch-1"],
  [65, 53, "bush-round"],
  [66, 53, "pine-3"],
  [63, 55, "bush-berry"],
  [62, 54, "fern"],
  [67, 54, "bush-hydrangea"],
  [64, 55, "bush-rose"],
  [65, 54, "bush-berry"],
  [66, 54, "bush-round"],
  [63, 56, "bush-hydrangea"],
  [64, 56, "bush-round"],
] as const)
  put(t, x, y, noise(x, y, 93) < 0.5 ? "right" : "down");
for (let y = 48; y < PH; y++)
  for (let x = 54; x < PW; x++) {
    if (!isWater(x, y) || !inStream(x + 0.5, y + 0.5)) continue;
    if (x >= WHEEL.x - 1 && x <= WHEEL.x + 2 && y >= WHEEL.y && y <= WHEEL.y + 1) continue;
    if (onBridge(x, y) || x === BRIDGE.x - 1 || x === BRIDGE.x + BRIDGE.w) continue;
    if (nearLand(x, y) && noise(x, y, 95) < 0.32) put("reeds", x, y, noise(x, y, 96) < 0.5 ? "right" : "down");
  }

// Rincón de rocas al noreste (lo que dejó la parrilla) y naturaleza suelta (tipos y posiciones fijos:
// nada se repite en fila).
// Rincón de rocas al noreste y naturaleza suelta (tipos y posiciones fijos: nada se repite en fila).
for (const [x, y, t, f] of [
  [51, 24, "rock-mossy", "right"],
  [52, 26, "fallen-log", "down"],
  [54, 26, "mushrooms", "right"],
  [60, 27, "pine-2", "right"],
  [63, 24, "oak-1", "down"],
  [48, 25, "birch-1", "right"],
  [46, 27, "fern", "right"],
  // Detrás del ala este y al borde del huerto.
  [52, 1, "pine-1", "down"],
  [56, 2, "birch-2", "right"],
  [8, 1, "pine-3", "right"],
  [13, 1, "oak-1", "down"],
  [1, 12, "pine-2", "right"],
  [2, 38, "pine-1", "down"],
  [6, 33, "mushrooms", "down"],
  [8, 40, "fern", "right"],
  [26, 34, "birch-1", "down"],
  [31, 37, "oak-3", "right"],
  [33, 31, "bush-round", "down"],
  [24, 38, "fern", "down"],
  [18, 30, "bush-berry", "down"],
  [32, 52, "oak-1", "right"],
  [20, 52, "bush-round", "right"],
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

// Parada del bus, afuera del portón: la plataforma (plana: el piso, los torniquetes y el vidrio del
// fondo) y encima la estación de vidrio con su techo, que se transparenta con alguien adentro. El techo
// cubre también el sendero que llega del portón (su dibujo lo tapa desde atrás). La vereda lleva faroles,
// una banca y matas bajas contra la cerca (nada alto: el portón y la estación se ven desde el jardín).
put("bus-platform", STATION.x - M, STATION.y - M);
put("bus-station", STATION.x - M - 3, STATION.y - M - 2);
for (const [x, y, t, f] of [
  [16, 68, "lamp-post", "right"],
  [64, 68, "lamp-post", "right"],
  [56, 66, "bench", "down"],
  [6, 65, "bush-hydrangea", "right"],
  [11, 65, "flower-patch", "right"],
  [22, 65, "bush-rose", "down"],
  [24, 65, "flower-patch", "down"],
  [60, 65, "flower-patch", "right"],
  [68, 65, "bush-hydrangea", "down"],
  [73, 65, "flower-patch", "down"],
  [2, 66, "bush-round", "right"],
  [77, 66, "bush-round", "down"],
] as const)
  put(t, x, y, f);

// ---------- Puntos ----------

const pt = (type: PointDef["type"], name: string, x: number, y: number): PointDef => ({ type, name, x: x + M, y: y + M });

const POINTS: PointDef[] = [
  pt("spawn", "Portón del jardín", GATE_X, FENCE_Y - 3),
  // La granja: frente a la boca del horno y a la parrilla, y junto al letrero del gallinero.
  pt("grill", "Horno de barro", OVEN.x + 1, OVEN.y + 2),
  pt("grill", "Parrilla", BRICK_GRILL.x + 1, BRICK_GRILL.y + 1),
  pt("farm_sign", "Letrero del gallinero", YARD_GATE_X, HEN_YARD.y + HEN_YARD.h + 1),
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
  // Uno frente a cada puerta de la estación, en la fila de la plataforma pegada al bus.
  ...BUS_DOOR_X.map((dx) => pt("bus_stop", "Estación Hyvento", Math.floor(dx) - M, STATION.y + STATION.d - 1 - M)),
  // La piscina: junto a cada escalerita (al sur de la del suroeste y al este de la del noreste) y detrás
  // del trampolín.
  pt("pool_steps", "Escalera de la piscina", POOL.x + POOL_STEPS[0]![0], POOL.y + POOL_STEPS[0]![1] + 1),
  pt("pool_steps", "Escalera de la piscina", POOL.x + POOL_STEPS[1]![0] + 1, POOL.y + POOL_STEPS[1]![1]),
  pt("diving_board", "Trampolín", BOARD.x - 1, BOARD.y),
  // Frente a la escalerita de la tarima.
  pt("stage", "Escenario", DECK.x + DECK.w, DECK.y + 3),
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
  for (const r of KEEP_CLEAR) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) reserved.add(`${x},${y}`);
  mark(DOOR_X, PORCH_Y + 2, 2);
  // El pie de la escalera de la casa del árbol, despejado (que ningún árbol la tape).
  mark(TREEHOUSE_FOOT.x + 1, TREEHOUSE_FOOT.y + 1, 3);
  // El anfiteatro y el prado se decoran a mano (arriba): que no crezcan árboles en los pasillos.
  for (let y = 53; y < PH; y++) for (let x = 8; x <= 36; x++) reserved.add(`${x},${y}`);
  const soft = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground(x + dx, y + dy) !== "grass") return true;
    return false;
  };
  const TREES = ["oak-1", "oak-2", "oak-3", "birch-1", "birch-2", "pine-1", "pine-2", "pine-3", "oak-1", "birch-1"];
  const SMALL = ["tall-grass", "wildflowers", "tall-grass", "fern", "rock-small", "tall-grass", "bush-round", "wildflowers", "fern", "bush-berry", "tall-grass", "mushrooms"];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (reserved.has(`${x},${y}`) || ground(x, y) !== "grass" || soft(x, y)) continue;
      // Afuera de la cerca (la vereda de la parada) no crece nada suelto: ahí va lo que se ubica a mano.
      if (y >= FENCE_Y) continue;
      const edge = Math.min(x, y, PW - 1 - x, FENCE_Y - 1 - y);
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
const FENCE_Y1 = FENCE_Y;
put("garden-gate", GATE_X, FENCE_Y1);
for (let x = -1; x <= PW; x++) {
  const corner = x === -1 || x === PW;
  put(corner ? "fence-post" : "fence", x, FENCE_Y0, "down");
  if (x !== GATE_X && x !== GATE_X + 1) put(corner ? "fence-post" : "fence", x, FENCE_Y1, "down");
}
for (let y = 0; y < FENCE_Y; y++) {
  put("fence", -1, y);
  // Por donde entra el arroyo del molino no va cerca (el agua ya no deja pasar).
  if (ground(PW, y) !== "water") put("fence", PW, y);
}

// Bosque del margen: tupido junto a la cerca y con árboles grandes más afuera. Un árbol por celda, en
// una posición y de un tipo elegidos con ruido; la calle de la parada (al sur) queda despejada.
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
        // Fuera de la cerca y de la vereda de la parada.
        if (tx >= -1 && tx <= PW && ty >= -1 && ty <= PH) return false;
        // Ni sobre la calle ni pegado a su cordón (el bus pasa por delante).
        if (ty >= ROAD.y0 - M - 1) return false;
        if (taken.has(`${tx},${ty}`)) return false;
      }
    return true;
  };
  const take = (x: number, y: number, w = 1, d = 1) => {
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) taken.add(`${x + i},${y + j}`);
  };
  const dist = (x: number, y: number) => Math.max(-1 - x, x - PW, -1 - y, y - PH);
  for (let cy = -M; cy < PH + M; cy += 2)
    for (let cx = -M; cx < PW + M; cx += 2) {
      const n = noise(cx, cy, 61);
      const x = cx + Math.floor(noise(cx, cy, 62) * 2) + (((cy / 2) & 1) === 0 ? 0 : 1);
      const y = cy + Math.floor(noise(cx, cy, 63) * 2);
      const d = dist(x, y);
      // Solo una fila de árboles de unos 4 tiles: más afuera el suelo ya es la copa del bosque.
      if (d < 1 || d > 4) continue;
      // Robles viejos más afuera; cerca de la cerca, árboles chicos y matas.
      if (d > 2 && n < 0.34 && free(x, y, 2, 2)) {
        put("oak-big", x, y);
        take(x, y, 2, 2);
        continue;
      }
      if (!free(x, y)) continue;
      if (n < 0.86 || d > 2) {
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

/**
 * Dónde queda la granja, en tiles del nivel (con el margen): el servidor encierra a las gallinas y a la
 * cabra en su patio y su corral y las manda al comedero; el cliente anima la rueda y el agua del molino.
 */
const lvl = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + M, y: r.y + M, w: r.w, h: r.h });
export const GRANJA_LAYOUT = {
  henYard: lvl(HEN_YARD),
  /** El corral sin el establo (2x2 en su esquina de arriba a la derecha). */
  corral: lvl(CORRAL),
  goatShed: { x: CORRAL.x + 1 + M, y: CORRAL.y + M, w: 2, h: 2 },
  /** Al pie de la rampa del gallinero (ahí duermen de noche) y delante del establo. */
  coopDoor: { x: COOP.x + 1 + M, y: COOP.y + 3 + M },
  shedDoor: { x: CORRAL.x + 1 + M, y: CORRAL.y + 2 + M },
  feeder: { x: 4 + M, y: 28 + M },
  hayRack: { x: CORRAL.x + M, y: CORRAL.y + CORRAL.h - 1 + M },
  mill: { x: MILL.x + M, y: MILL.y + M },
  wheel: { x: WHEEL.x + M, y: WHEEL.y + M },
  bridge: { x: BRIDGE.x + M, y: BRIDGE.y + M, w: BRIDGE.w, h: BRIDGE.d },
} as const;

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
    // La piscina: se oye como el resto del jardín (es para estar en grupo), pero tiene su nombre.
    { id: "piscina", name: "Piscina", type: "common", rect: { x: POOL_BOX.x0 + M, y: POOL_BOX.y0 + M, w: POOL_SIZE[0], h: POOL_SIZE[1] }, isolated: false },
    // El escenario: quien está en la tarima se oye en todo el anfiteatro y en las gradas se oye además a
    // los vecinos (ver `hearing` en @hyvento/shared). De afuera no se oye nada, como en la fogata.
    { id: "escenario", name: "Escenario", type: "table", rect: { x: DECK.x + M, y: DECK.y + M, w: DECK.w, h: DECK.h }, isolated: true },
    { id: "gradas", name: "Gradas", type: "table", rect: { x: GRADAS.origin.x + M, y: GRADAS.origin.y + M, w: GRADAS.size.w + 1, h: GRADAS.size.h }, isolated: true },
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

