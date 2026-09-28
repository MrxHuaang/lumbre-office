import { noise, smoothNoise } from "./ruido";
import { catalogItem, footprint } from "../catalog";
import { GRADAS, GRADAS_ROWS } from "../catalog-escenario";
import type { AreaDef, FloorKind, Placement, PointDef } from "../types";
import { place } from "./place";
import { CONEXIONES, hacia } from "./conexiones";
import { BUS_DOOR_X, PARADA_M, ROAD, STATION, TURNSTILES } from "./parada";
import { POOL_BASIN, POOL_SIZE, POOL_STEPS } from "../catalog-agua";
import { SPA } from "../catalog-tina";
import { PESCA_NPC } from "@hyvento/shared";
import { PUESTO_PESCA, PUESTO_PESCA_MUEBLES, PUESTO_PESCA_PUNTO } from "./puesto-pesca";

// ---------- Jardín ----------
// Una zona jugable de 132x122 con un margen de bosque de 10 tiles alrededor que se dibuja pero no se
// pisa (ver docs/plan-rediseno.md). Todo lo de abajo está en coordenadas de la zona jugable (0..131,
// 0..121) y se corre en M al ubicarlo en el nivel. Se lee de adentro hacia afuera: lo de la casa junto
// (la cabaña, el garaje, el huerto, el gallinero, el patio, la parrilla y la piscina), el ocio al aire
// libre más allá (la fogata, la glorieta, la casa del árbol, el lago grande con su muelle) y lo de
// excursión lejos (el observatorio con su placita, el escenario, el molino), con pasto y senderos entre
// todo. El terreno es plano (las lomas con talud se sacaron: en el isométrico no daban la ilusión). La
// cerca va en y = 100: afuera queda la pradera de la entrada, con el sendero largo que sube
// desde la vereda (donde se aparece) hasta el portón, y más al este la parada del bus
// (world/areas/parada.ts); la calle pasa por el margen.
//
//   norte: la casa al centro, el huerto con el cobertizo y el invernadero al oeste, el patio, la
//          parrilla y la piscina al este;
//   centro: el camino de piedra del porche al portón, bifurcado hacia el huerto, la fogata, la glorieta
//           y el lago; la casa del árbol en los frutales del oeste;
//   lejos: el observatorio al este (con su placita, la fogata, el jardín de piedras y las bancas para
//          mirar estrellas), el escenario al suroeste, el molino en el arroyo del sureste y el mirador, un
//          rincón con banca al sur del lago.

/** Margen de bosque alrededor de la zona jugable. */
const M = 10;
const PW = 132;
const PH = 122;
/** La cerca del sur (con el portón): lo de más abajo es la vereda de la parada del bus. */
const FENCE_Y = 100;
if (PARADA_M !== M) throw new Error("parada.ts tiene otro margen que el jardín");
if (ROAD.y0 !== PH + M) throw new Error("la calle de parada.ts no empieza donde termina la zona jugable del jardín");
const W = PW + M * 2;
const H = PH + M * 2;

/** La casa (22x14) y su puerta: el porche da a la fila y = 18. */
const HOUSE = { x: 42, y: 4 };
const DOOR_X = HOUSE.x + 10;
const PORCH_Y = HOUSE.y + 14;
/**
 * El garaje (5x5), pegado al oeste de la torre de la casa (donde antes había bosquecito): la puerta chica
 * da a la fila y = 18, como el porche, y de su frente baja la entrada de gravilla hasta el sendero del
 * huerto.
 */
const GARAGE = { x: 37, y: 13 };
const GARAGE_DOOR_X = GARAGE.x + 3;
const DRIVEWAY = { x0: 37.1, x1: 41.4, y0: 16, y1: 26.6 };
const inGarage = (x: number, y: number) => x >= GARAGE.x && x < GARAGE.x + 5 && y >= GARAGE.y && y < GARAGE.y + 5;
/** El portón de la cerca, al sur, donde llega el camino. */
const GATE_X = 52;

/**
 * Invernadero (5x4) y sus seis bancales, en L contra los vidrios del fondo (en este orden: el índice es su
 * id). Van detrás del centro del invernadero: así el vidrio del frente no les queda por detrás.
 */
const GREENHOUSE = { x: 2, y: 22 };
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
const PATIO = { x0: 71, y0: 7, x1: 82, y1: 18.6, r: 2.2 };

/** Lago al sureste: una elipse deformada con ruido, con un islote y el muelle desde la orilla oeste. */
const LAKE = { cx: 80, cy: 66, rx: 13, ry: 14 };
const ISLET = { cx: 84.5, cy: 70, r: 2.4 };
const DOCK = { x0: 66, x1: 75, y0: 65, y1: 67 };

/**
 * La piscina, "atrás" de la cabaña pero a la vista: al este del patio (x 91..105), donde no la tapa nada de
 * la casa. Un deck de tablas de 15x13 con la pileta de piedra en el medio (ver catalog-agua.ts).
 */
const POOL = { x: 91, y: 1 };
const POOL_BOX = { x0: POOL.x, y0: POOL.y, x1: POOL.x + POOL_SIZE[0], y1: POOL.y + POOL_SIZE[1] };
/** El trampolín, en el borde oeste de la pileta mirando hacia el agua. */
const BOARD = { x: POOL.x + POOL_BASIN.x - 1, y: POOL.y + POOL_BASIN.y + Math.floor(POOL_BASIN.d / 2) };
/**
 * La granja (docs/plan-estructuras.md, 4, 5 y 9). La parrilla con el horno de barro va en el rincón de
 * rocas al sur del patio (con su propio sendero), sobre un piso de piedra; el gallinero, al oeste, contra
 * la cerca (detrás no queda nadie), con su patio de tierra y el corral de la cabra al lado, y el molino,
 * lejos, sobre un arroyo angosto que entra del bosque por el este y baja al lago.
 */
const GRILL_PAD = { cx: 76.8, cy: 30.2, rx: 5.6, ry: 3.3 };
const OVEN = { x: 73, y: 28 };
const BRICK_GRILL = { x: 77, y: 28 };
/** El patio de las gallinas (adentro de la cerca) y el corral de la cabra, al lado. */
const HEN_YARD = { x: 0, y: 33, w: 8, h: 7 };
const CORRAL = { x: 9, y: 33, w: 3, h: 7 };
const COOP = { x: 0, y: 33 };
/** Los huecos de la cerca por donde se entra al patio y al corral (fila de abajo). */
const YARD_GATE_X = 4;
const CORRAL_GATE_X = 10;
/** El molino (3x3) en la orilla norte del arroyo, con la rueda en el agua; el puentecito, más al este. */
const MILL = { x: 108, y: 90 };
const WHEEL = { x: 109, y: 93 };
const BRIDGE = { x: 114, y: 93, w: 2, d: 3 };
/** El arroyo: tramos desde el bosque del este hasta la orilla sur del lago (angosto, con su ancho). */
const STREAM: Seg[] = [
  { a: [137, 96.6], b: [128, 96.2], w: 1.7 },
  { a: [128, 96.2], b: [122, 95.6], w: 1.7 },
  { a: [122, 95.6], b: [117, 95.1], w: 1.7 },
  { a: [117, 95.1], b: [112.5, 94.1], w: 1.7 },
  { a: [112.5, 94.1], b: [108.5, 93.4], w: 1.6 },
  { a: [108.5, 93.4], b: [105.2, 91.8], w: 1.6 },
  { a: [105.2, 91.8], b: [101, 88], w: 1.7 },
  { a: [101, 88], b: [96, 83.5], w: 1.7 },
  { a: [96, 83.5], b: [92, 79.5], w: 1.8 },
  { a: [92, 79.5], b: [88.4, 75.4], w: 2 },
];
/** Rectángulos que la naturaleza suelta no toca (el patio de la parrilla, el gallinero, el molino, el observatorio). */
const KEEP_CLEAR = [
  { x0: 70, y0: 26, x1: 83, y1: 35 },
  { x0: 0, y0: 31, x1: 12, y1: 42 },
  { x0: 105, y0: 88, x1: 119, y1: 98 },
  // El observatorio y lo de alrededor (se decora a mano, abajo).
  { x0: 101, y0: 20, x1: 131, y1: 47 },
];

/**
 * La tina caliente y la sauna de barril, en la orilla noreste del lago: un deck de tablas
 * de 10x9 que se mete un poco sobre el agua, con la tina junto al lago y la sauna al fondo (ver
 * catalog-tina.ts: SPA). El reflejo de las luces lo dibuja el deck, en el agua de al lado.
 */
const SPA_DECK = { x: 85, y: 51 };
const SPA_BOX = { x0: SPA_DECK.x, y0: SPA_DECK.y, x1: SPA_DECK.x + SPA.deck[0], y1: SPA_DECK.y + SPA.deck[1] };
const spaAt = ([dx, dy]: readonly [number, number]) => ({ x: SPA_DECK.x + dx, y: SPA_DECK.y + dy });

/** Fogata con troncos alrededor y la glorieta. */
const FIRE = { x: 24, y: 56 };
const GAZEBO = { x: 36, y: 66 };
/**
 * La casa del árbol (4x4) en el huerto de frutales, contra la cerca oeste: lo que su copa tapa queda del
 * lado del bosque. La escalera de cuerda cuelga frente al segundo tile del frente (+y) y su pie es el portal.
 */
const TREEHOUSE = { x: 1, y: 70 };
const TREEHOUSE_FOOT = { x: TREEHOUSE.x + 1, y: TREEHOUSE.y + 4 };
/** Primer torniquete de la estación (en coordenadas de la zona jugable): ahí llega el sendero del portón. */
const TURNSTILE_X = TURNSTILES[0] - M;
/** El mirador: un rincón con una banca mirando al lago, al sur de la orilla. */
const MIRADOR = { cx: 64, cy: 88 };
/** El bosquecito de la pradera de la entrada, que el sendero rodea (un óvalo de árboles y matas). */
const ENTRY_COPSE = { cx: 59, cy: FENCE_Y + 11, rx: 5, ry: 3.6 };
/**
 * Escenario (franja sur, ver catalog-escenario.ts): la concha al oeste, la tarima delante (mirando al este)
 * y las gradas en semicírculo hacia el camino. Al lado, un prado de flores bajas (el estudio de grabación
 * está adentro de la casa, al final del pasillo del piso 3).
 */
const STAGE = { x: 14, y: 88 };
const DECK = { x: STAGE.x + 3, y: STAGE.y, w: 3, h: 7 };
/** Donde estaba la cabina de grabación (ahora es el estudio del piso 3): un prado de flores junto al escenario. */
const MEADOW = { x: 40, y: 86 };
/** Zona de charla de la fogata (en coordenadas del nivel): los troncos quedan adentro con un tile de aire. */
const FIRE_ZONE = { x: FIRE.x - 3 + M, y: FIRE.y - 3 + M, w: 8, h: 8 };

/**
 * El observatorio (8x8) al este, lejos de la casa: la puerta de la torre da a la fila y = 36 (ver
 * CONEXIONES.jardin.observatorio). Delante, la placita de piedra; al oeste, la fogata de malvaviscos en su
 * círculo de arena; al este, el jardín de piedras en su gravilla, y al sur, el prado con las bancas y los
 * telescopios chicos para mirar estrellas.
 */
const OBS = { x: 117, y: 28 };
const OBS_DOOR_X = OBS.x + 3;
const OBS_FIRE = { x: 110, y: 37 };
/** La placita de piedra frente a la puerta (óvalo que ondula). */
const OBS_PLAZA = { cx: OBS_DOOR_X + 1, cy: OBS.y + 10.4, rx: 3.9, ry: 2.9 };
/** El jardín de piedras: gravilla rastrillada al costado este de la torre. */
const OBS_GARDEN = { cx: 127.6, cy: 32.5, rx: 3.1, ry: 4.6 };
/** Zona de charla de la fogata del observatorio (coordenadas del nivel), como la de la fogata grande. */
const OBS_FIRE_ZONE = { x: OBS_FIRE.x - 3 + M, y: OBS_FIRE.y - 3 + M, w: 8, h: 7 };

// ---------- Formas del terreno (continuas, en tiles de la zona jugable) ----------

interface Seg {
  a: [number, number];
  b: [number, number];
  w: number;
}

/** Senderos de piedra: tramos con su ancho. */
const PATHS: Seg[] = [
  // Explanada frente al porche y el camino al portón (con una leve curva).
  { a: [50.2, 19.6], b: [55.8, 19.6], w: 3.2 },
  { a: [53, 19], b: [53, 36], w: 2.6 },
  { a: [53, 36], b: [52.4, 55], w: 2.6 },
  { a: [52.4, 55], b: [53, 75], w: 2.6 },
  { a: [53, 75], b: [53, FENCE_Y + 3.5], w: 2.6 },
  // Afuera: el sendero largo de la entrada baja por la pradera, rodea el bosquecito y llega a la vereda (ahí
  // se aparece); por la vereda sigue al este hasta los torniquetes de la estación.
  { a: [53, FENCE_Y + 3.5], b: [47.5, FENCE_Y + 7.5], w: 2.4 },
  { a: [47.5, FENCE_Y + 7.5], b: [46, FENCE_Y + 12], w: 2.4 },
  { a: [46, FENCE_Y + 12], b: [48.5, FENCE_Y + 16], w: 2.4 },
  { a: [48.5, FENCE_Y + 16], b: [48.5, FENCE_Y + 18.5], w: 2.4 },
  { a: [48.5, FENCE_Y + 18.5], b: [TURNSTILE_X + 1, FENCE_Y + 18.5], w: 2 },
  { a: [TURNSTILE_X + 1, FENCE_Y + 18.5], b: [TURNSTILE_X + 1, FENCE_Y + 19.5], w: 2 },
  // Hacia el huerto (oeste): bordea el jardín de flores, sube por el lado del pozo y cruza al huerto.
  { a: [52, 31], b: [45, 33.2], w: 2 },
  { a: [45, 33.2], b: [38, 31.6], w: 2 },
  { a: [38, 31.6], b: [34.4, 23.5], w: 2 },
  { a: [34.4, 23.5], b: [33.6, 15.5], w: 2 },
  { a: [33.6, 15.5], b: [18.2, 14.2], w: 1.8 },
  // Hacia el lago (este) hasta la raíz del muelle, y de la orilla norte al molino, por el este del lago.
  { a: [54, 33], b: [DOCK.x0 + 0.4, 52], w: 2 },
  { a: [DOCK.x0 + 0.4, 52], b: [DOCK.x0 + 0.4, DOCK.y0 - 0.8], w: 2 },
  // Senderito de la playita del muelle al mostrador del puesto de pesca (ver puesto-pesca.ts).
  { a: [PUESTO_PESCA.punto.x - M + 2.6, PUESTO_PESCA.punto.y - M + 0.5], b: [PUESTO_PESCA.punto.x - M + 0.6, PUESTO_PESCA.punto.y - M + 0.5], w: 1.4 },
  { a: [DOCK.x0 + 1, 50.5], b: [76, 46.5], w: 1.6 },
  { a: [76, 46.5], b: [88, 46.5], w: 1.6 },
  // Por detrás de la sauna (sin rozar su seto ni el deck) y bajando por la orilla este.
  { a: [88, 46.5], b: [96.5, 47.8], w: 1.6 },
  { a: [96.5, 47.8], b: [100, 54], w: 1.6 },
  { a: [100, 54], b: [104.5, 70], w: 1.6 },
  { a: [104.5, 70], b: [112.5, 89.5], w: 1.6 },
  // Senderito de la casa del árbol a la fogata, entre los frutales.
  { a: [TREEHOUSE_FOOT.x + 0.5, TREEHOUSE_FOOT.y + 1.2], b: [9.5, TREEHOUSE.y + 2.2], w: 1.3 },
  { a: [9.5, TREEHOUSE.y + 2.2], b: [10.5, TREEHOUSE.y - 2.5], w: 1.3 },
  { a: [10.5, TREEHOUSE.y - 2.5], b: [FIRE.x - 0.8, FIRE.y + 3.6], w: 1.3 },
  // Senderitos a la fogata, a la glorieta, al patio y a la parrilla.
  { a: [38.5, 32.2], b: [FIRE.x + 2.8, FIRE.y - 1.2], w: 1.5 },
  { a: [52.6, 64], b: [GAZEBO.x + 6.2, GAZEBO.y + 1.8], w: 1.5 },
  { a: [55.5, 19.6], b: [72.6, 18.4], w: 2 },
  { a: [76.5, 18], b: [76.5, 27.2], w: 1.6 },
  // Del patio al deck de la piscina.
  { a: [82, 10.5], b: [91.4, 10.5], w: 1.8 },
  // Al mirador, el rincón con banca al sur del lago.
  { a: [53.5, 86.5], b: [MIRADOR.cx - 1, MIRADOR.cy - 0.5], w: 2.2 },
  // Senderito del camino al escenario: bordea el prado de flores y entra por el pasillo del
  // medio de las gradas hasta la escalerita de la tarima.
  { a: [52.6, MEADOW.y + 6.8], b: [MEADOW.x + 3.5, MEADOW.y + 6.2], w: 1.5 },
  { a: [MEADOW.x + 3.5, MEADOW.y + 6.2], b: [STAGE.x + 23.5, STAGE.y + 3.6], w: 1.4 },
  { a: [STAGE.x + 23.5, STAGE.y + 3.6], b: [STAGE.x + 15.5, STAGE.y + 3.6], w: 1.2 },
  { a: [STAGE.x + 15.5, STAGE.y + 3.6], b: [STAGE.x + 6.4, STAGE.y + 3.5], w: 1.1 },
  // El sendero de la excursión al observatorio: sale de la esquina del patio, cruza el pasto, pasa junto
  // al letrero y a la fogata y llega a la placita de la torre; un ramal corto une la placita con la arena
  // de la fogata.
  { a: [81.5, 18.2], b: [92, 20.5], w: 1.6 },
  { a: [92, 20.5], b: [100, 24.5], w: 1.8 },
  { a: [100, 24.5], b: [106, 29], w: 2 },
  { a: [106, 29], b: [112, 33.6], w: 2 },
  { a: [112, 33.6], b: [OBS_PLAZA.cx - 3, OBS_PLAZA.cy - 1.2], w: 2 },
  { a: [OBS_FIRE.x + 3.8, OBS_FIRE.y + 2.4], b: [OBS_PLAZA.cx - 3.4, OBS_PLAZA.cy + 1], w: 1.4 },
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
/** El deck de la tina: tablas sobre la orilla (se pisa aunque abajo sea agua). */
const onSpaDeck = (x: number, y: number) => x >= SPA_BOX.x0 && x < SPA_BOX.x1 && y >= SPA_BOX.y0 && y < SPA_BOX.y1;
/** Patio: rectángulo de esquinas redondeadas con el borde que ondula (como la tierra del huerto). */
function onPatio(x: number, y: number): boolean {
  const { x0, y0, x1, y1, r } = PATIO;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x));
  const cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) < r + wobble(x, y, 29, 0.15);
}
/** El arroyo del molino (también se asoma en el bosque del este, de donde viene). */
function inStream(x: number, y: number): boolean {
  if (x < 86 || y < 72) return false;
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

/** Arena: la playita donde nace el muelle, el círculo de la fogata y el de la fogata del observatorio. */
const onSand = (x: number, y: number) =>
  Math.hypot(x - (DOCK.x0 + 0.4), (y - (DOCK.y0 + 1)) * 0.8) < 2.9 + wobble(x, y, 13, 0.3) ||
  Math.hypot(x - (FIRE.x + 1), y - (FIRE.y + 1)) < 3.3 + wobble(x, y, 17, 0.2) ||
  Math.hypot(x - (OBS_FIRE.x + 1), y - (OBS_FIRE.y + 1)) < 3 + wobble(x, y, 51, 0.2);
/** La placita de piedra frente a la puerta del observatorio. */
const onObsPlaza = (x: number, y: number) => Math.hypot((x - OBS_PLAZA.cx) / OBS_PLAZA.rx, (y - OBS_PLAZA.cy) / OBS_PLAZA.ry) < 1 + wobble(x, y, 53, 0.06);
/** La gravilla del jardín de piedras, al este de la torre. */
const onObsGarden = (x: number, y: number) => Math.hypot((x - OBS_GARDEN.cx) / OBS_GARDEN.rx, (y - OBS_GARDEN.cy) / OBS_GARDEN.ry) < 1 + wobble(x, y, 59, 0.08);
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
  if (onDock(x, y) || onPoolDeck(x, y) || onSpaDeck(x, y)) return "dock";
  if (inStream(x, y)) return onBridge(x, y) ? "dock" : "water";
  if (inLake(x, y) && !onIslet(x, y)) return "water";
  if (onGrillPad(x, y)) return "path";
  if (onHenYard(x, y)) return "sand";
  if (onPatio(x, y)) return "path";
  if (onObsPlaza(x, y)) return "path";
  if (onObsGarden(x, y)) return "gravel";
  if (onGazeboBase(x, y)) return "path";
  if (onSand(x, y)) return "sand";
  if (onPath(x, y)) return "path";
  if (onDriveway(x, y)) return "gravel";
  if (onSoil(x, y)) return "soil";
  return "grass";
}

const fine = (x: number, y: number) => localGround(x - M, y - M);

/**
 * ¿El centro del tile (del nivel) cae sobre un sendero? Solo los tramos de `PATHS`, no las plazas ni el
 * patio: lo usa el test que revisa que ninguna decoración quede en medio del camino.
 */
export const onGardenPath = (x: number, y: number) => onPath(x + 0.5 - M, y + 0.5 - M);

// La puerta del porche tiene que coincidir con CONEXIONES.jardin.casa (tiles frente a la puerta).
if (CONEXIONES.jardin.casa.tiles[0]!.x !== DOOR_X + M || CONEXIONES.jardin.casa.tiles[0]!.y !== PORCH_Y + M)
  throw new Error("CONEXIONES.jardin.casa no coincide con la puerta de la casa");
if (CONEXIONES.jardin.casaArbol.tiles[0]!.x !== TREEHOUSE_FOOT.x + M || CONEXIONES.jardin.casaArbol.tiles[0]!.y !== TREEHOUSE_FOOT.y + M)
  throw new Error("CONEXIONES.jardin.casaArbol no coincide con la escalera de la casa del árbol");
if (CONEXIONES.jardin.garaje.tiles[0]!.x !== GARAGE_DOOR_X + M || CONEXIONES.jardin.garaje.tiles[0]!.y !== GARAGE.y + 5 + M)
  throw new Error("CONEXIONES.jardin.garaje no coincide con la puerta del garaje");
if (CONEXIONES.jardin.observatorio.tiles[0]!.x !== OBS_DOOR_X + M || CONEXIONES.jardin.observatorio.tiles[0]!.y !== OBS.y + 8 + M)
  throw new Error("CONEXIONES.jardin.observatorio no coincide con la puerta del observatorio");

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
  [34, 13, "bush-berry"],
  [35, 11, "oak-1"],
  [36, 11, "pine-2"],
  [37, 11, "bush-round"],
  [35, 12, "birch-1"],
  [36, 12, "oak-3"],
  [37, 12, "bush-berry"],
  [38, 12, "crates"],
  [35, 13, "bush-round"],
  [36, 13, "tire-stack"],
  [35, 14, "bush-berry"],
  [36, 14, "oil-drum"],
  [35, 15, "bush-round"],
  [36, 15, "barrel"],
  [35, 16, "bush-hydrangea"],
  [36, 16, "tire-stack"],
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
put("well", 35, 17);
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
put("signpost", 41, 30, "down");

// Jardín de flores entre el garaje y el camino, y canteros junto a la casa.
for (const [x, y, t] of [
  [42, 23, "bush-hydrangea"],
  [43, 25, "flower-patch"],
  [44, 27, "bush-rose"],
  [44, 22, "flower-patch"],
  [45, 24, "bush-rose"],
  [47, 22, "flower-patch"],
  [48, 24, "flower-patch"],
  [58, 22, "flower-patch"],
  [60, 23, "bush-hydrangea"],
  [62, 22, "flower-patch"],
] as const)
  put(t, x, y);

// Buzón y tablón junto al camino, frente al porche; farolas a lo largo del camino.
put("mailbox", 50, 22, "down");
put("notice-board", 56, 22, "down");
for (const [x, y] of [
  [50, 26],
  [58, 36],
  [50, 46],
  [56, 56],
  [50, 66],
  [56, 76],
  [50, 86],
  [56, 95],
  [40, 35],
  [70, 17],
  [62, 50],
  [90, 22],
])
  put("lamp-post", x!, y!);

// La casita de Tobi, el perro, camino al lago, con su cama delante: así la casita no lo tapa al dormir
// (ver PETS en @hyvento/shared).
put("dog-house", 62, 40, "down");
put("pet-bed", 62, 41);

// Patio este: mesas con sillas, la pérgola, farolitos y la leñera.
put("pergola", 77, 7);
for (const [tx, ty] of [
  [73, 10],
  [74, 15],
])
  // Tres sillas por mesa (la de adelante queda libre: se ve la mesa y se pasa).
  for (const [dx, dy, f] of [
    [-1, 0, "right"],
    [1, 0, "left"],
    [0, -1, "down"],
  ] as const)
    put("patio-chair", tx! + dx, ty! + dy, f);
put("patio-table", 73, 10);
put("patio-table", 74, 15);
put("woodpile", 81, 12);
put("bench", 79, 14, "left");
// Jardineras al borde norte del patio y un seto detrás: la pérgola tapa esos tiles.
for (const [x, y] of [
  [71, 9],
  [71, 13],
  [75, 18],
  [78, 18],
  [81, 16],
  [74, 6],
  [75, 6],
  [76, 6],
  [77, 6],
])
  put("planter", x!, y!);
for (const [x, y, t] of [
  [75, 5, "bush-hydrangea"],
  [76, 5, "bush-round"],
  [77, 5, "bush-rose"],
] as const)
  put(t, x, y);
for (const [x, y] of [
  [71, 6],
  [81, 6],
  [80, 18],
  [70, 16],
])
  put("garden-lantern", x!, y!);

// Fogata con cuatro troncos para sentarse alrededor (un punto de charla).
put("fire-pit", FIRE.x, FIRE.y);
put("log-seat", FIRE.x - 2, FIRE.y, "right");
put("log-seat", FIRE.x + 3, FIRE.y, "left");
put("log-seat", FIRE.x, FIRE.y - 2, "down");
put("log-seat", FIRE.x, FIRE.y + 3, "up");
put("woodpile", 19, 55);
put("stump", 29, 59);

// Glorieta: se entra por el frente (+x, desde el sendero) y adentro hay una banca en herradura. La base
// va plana y el techo es otra pieza en el mismo lugar (ver el catálogo). Afuera, bancas mirando al camino.
put("gazebo", GAZEBO.x, GAZEBO.y);
put("gazebo-roof", GAZEBO.x, GAZEBO.y);
put("bench", 41, 65, "down");
put("bench", 41, 70, "up");
// Alrededor de la glorieta (detrás, lo que tapa su techo, y pegado a la baranda) va un macizo de rosales
// y hortensias: ahí nadie se para, y quien se levanta de la banca queda adentro y no del otro lado.
for (const [x, y, t] of [
  [34, 64, "bush-rose"],
  [35, 64, "flower-patch"],
  [36, 64, "bush-hydrangea"],
  [34, 65, "bush-hydrangea"],
  [35, 65, "bush-rose"],
  [36, 65, "flower-patch"],
  [37, 65, "bush-rose"],
  [38, 65, "bush-hydrangea"],
  [39, 65, "flower-patch"],
  [34, 66, "flower-patch"],
  [35, 66, "bush-hydrangea"],
  [35, 67, "bush-rose"],
  [35, 68, "flower-patch"],
  [35, 69, "bush-hydrangea"],
  [34, 70, "bush-rose"],
  [36, 70, "flower-patch"],
  [37, 70, "bush-rose"],
  [38, 70, "flower-patch"],
  [39, 70, "bush-hydrangea"],
  [40, 64, "flower-patch"],
  [40, 71, "flower-patch"],
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
for (let y = STAGE.y - 3; y < STAGE.y + 8; y++)
  for (let x = STAGE.x - 4; x < DECK.x + 2; x++) {
    if (x >= STAGE.x && y >= STAGE.y) continue;
    // Delante de la tarima en pantalla (al suroeste) solo matas: un árbol taparía la esquina del escenario.
    const back = (x < STAGE.x - 2 && y < STAGE.y + 4) || y < STAGE.y - 2;
    const t = back ? ["pine-1", "oak-1", "pine-3", "birch-1", "oak-3"][(x * 7 + y * 3) % 5]! : ["bush-round", "bush-hydrangea", "bush-berry", "bush-rose", "bush-round"][(x * 5 + y) % 5]!;
    put(t, x, y, (x + y) % 2 ? "right" : "down");
  }
// Entre las gradas y el camino, un prado de flores silvestres: todo bajo (nada tapa las gradas ni a quien
// pasea por ahí), con matas en el borde del bosque y alguna piedra con hongos.
for (const [x, y, t] of [
  [38, 85, "bush-rose"],
  [39, 85, "bush-hydrangea"],
  [40, 85, "flower-patch"],
  [41, 85, "bush-round"],
  [42, 85, "bush-rose"],
  [43, 85, "flower-patch"],
  [44, 85, "bush-hydrangea"],
  [45, 85, "bush-round"],
  [38, 86, "bush-hydrangea"],
  [39, 86, "bush-rose"],
  [38, 87, "flower-patch"],
  [39, 87, "bush-round"],
  [38, 88, "bush-rose"],
  [39, 88, "bush-hydrangea"],
  [38, 89, "bush-round"],
  [39, 89, "flower-patch"],
  [39, 90, "bush-rose"],
] as const)
  put(t, x, y);
// El prado donde estaba la cabina: flores y pasto alto, bajitos, en damero (se camina entre ellos).
{
  const MEADOW_FLOWERS = ["wildflowers", "flower-patch", "tall-grass", "wildflowers", "flower-patch"];
  for (let y = MEADOW.y; y < MEADOW.y + 5; y++)
    for (let x = MEADOW.x; x < MEADOW.x + 5; x++) if ((x + y) % 2 === 0) put(MEADOW_FLOWERS[(x * 3 + y) % MEADOW_FLOWERS.length]!, x, y);
}
// Flores sueltas junto al senderito (cosas bajas: nada tapa las gradas).
for (const [x, y, t] of [
  [45, 87, "wildflowers"],
  [46, 88, "flower-patch"],
  [38, 94, "wildflowers"],
  [41, 94, "flower-patch"],
  [45, 94, "wildflowers"],
  [36, 94, "rock-small"],
] as const)
  put(t, x, y);

// Huerto de frutales al suroeste, con la casa del árbol contra la cerca (se sacaron los dos frutales que
// quedaban encima de ella y de su senderito).
const FRUIT = ["apple-tree", "peach-tree", "cherry-tree"];
for (let i = 0; i < 3; i++)
  for (let j = 0; j < 4; j++) {
    const x = 4 + j * 4 + (i % 2) * 2;
    const y = TREEHOUSE.y + i * 4;
    if ((x === 4 && y === TREEHOUSE.y) || (x === 6 && y === TREEHOUSE.y + 4)) continue;
    put(FRUIT[(i + j * 2) % 3]!, x, y);
  }
put("treehouse", TREEHOUSE.x, TREEHOUSE.y);
// Detrás de la casa del árbol (contra la cerca) su copa tapa a quien se pare ahí: matas, sin lugar libre.
for (const [x, y, t] of [
  [0, 67, "bush-round"],
  [0, 68, "bush-berry"],
  [1, 68, "bush-rose"],
  [0, 69, "bush-hydrangea"],
  [1, 69, "bush-round"],
  [0, 70, "bush-berry"],
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
put("picnic-table", 60, 74);
put("picnic-bench", 59, 74, "right");
put("picnic-bench", 61, 74, "left");
put("bench", 74, 48, "down");
// El puesto de pesca de Don Evelio, en la orilla oeste junto a la playita (ya en tiles del nivel).
items.push(...PUESTO_PESCA_MUEBLES);
// Juncos en el agua junto a la orilla y nenúfares más adentro (elegidos con ruido, siempre en el agua).
const nearLand = (x: number, y: number) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => !isWater(x + dx, y + dy) && ground(x + dx, y + dy) !== "dock"));
const farFromLand = (x: number, y: number, r: number) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!isWater(x + dx, y + dy)) return false;
  return true;
};
for (let y = 48; y < PH; y++)
  for (let x = 64; x < PW; x++) {
    // El arroyo lleva sus propios juncos (ver la granja, más abajo).
    if (!isWater(x, y) || inStream(x + 0.5, y + 0.5) || (y >= DOCK.y0 - 1 && y <= DOCK.y1 && x < DOCK.x1 + 1)) continue;
    if (nearLand(x, y) && noise(x, y, 41) < 0.14) put("reeds", x, y, noise(x, y, 42) < 0.5 ? "right" : "down");
    else if (farFromLand(x, y, 1) && noise(x, y, 43) < 0.07) put("lily-pad", x, y, noise(x, y, 44) < 0.5 ? "right" : "down");
  }
/**
 * Las piedras planas de la orilla, donde también se pesca: el primer pasto del recuadro que tiene agua
 * del lado (dx, dy). Una por orilla, así hay dónde pescar sin hacer fila en el muelle.
 */
function shoreRock(x0: number, x1: number, y0: number, y1: number, dx: number, dy: number) {
  for (let x = x0; x < x1; x++)
    for (let y = y0; y < y1; y++) if (!isWater(x, y) && isWater(x + dx, y + dy) && ground(x, y) === "grass") return { x, y };
  throw new Error(`No hay orilla para la piedra plana en (${x0}, ${y0})`);
}
const FLAT_ROCKS = [
  { name: "Piedra de la orilla norte", ...shoreRock(76, 84, 48, 56, 0, 1) },
  { name: "Piedra de la orilla este", ...shoreRock(88, 98, 60, 68, -1, 0) },
  { name: "Piedra de la orilla sur", ...shoreRock(74, 84, 76, 84, 0, -1) },
  { name: "Piedra de la orilla oeste", ...shoreRock(64, 72, 71, 79, 1, 0) },
];
const FLAT_ROCK = FLAT_ROCKS[0]!;
for (const r of FLAT_ROCKS) put("flat-rock", r.x, r.y);
for (const [x, y, t] of [
  [FLAT_ROCK.x + 1, FLAT_ROCK.y - 1, "rock-small"],
  [FLAT_ROCK.x - 2, FLAT_ROCK.y - 1, "rock-mossy"],
  [96, 57, "rock-medium"],
  [72, 83, "rock-small"],
  [95, 74, "boulder"],
  [63, 61, "rock-small"],
  [99, 66, "rock-mossy"],
] as const)
  if (!isWater(x, y)) put(t, x, y);

// El mirador, al sur del lago: una banca mirando al agua, un farol y flores.
put("bench", MIRADOR.cx, MIRADOR.cy - 2, "up");
put("lamp-post", MIRADOR.cx + 2, MIRADOR.cy - 1);
put("wildflowers", MIRADOR.cx - 2, MIRADOR.cy + 1);
put("flower-patch", MIRADOR.cx + 1, MIRADOR.cy + 2);

// ---------- La piscina ----------

// La piscina: el deck con la pileta (plano, se camina alrededor), el trampolín en el borde oeste,
// reposeras mirando al agua (las del fondo, con sombrillas entre medio: atrás no tapan a nadie, y con un
// pasillo entre ellas y el agua), la ducha
// y los toalleros en el costado este. Delante (al sur) solo reposeras: son bajas y no tapan a quien nada.
put("pool", POOL.x, POOL.y);
put("diving-board", BOARD.x, BOARD.y, "right");
for (const x of [4, 6, 8, 10].map((dx) => POOL.x + dx)) put("sun-lounger", x, POOL.y, "down");
for (const x of [5, 9].map((dx) => POOL.x + dx)) put("parasol", x, POOL.y);
for (const x of [5, 7, 9].map((dx) => POOL.x + dx)) put("sun-lounger", x, POOL.y + POOL_SIZE[1] - 3, "up");
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

// ---------- La tina caliente y la sauna ----------

// La tina junto al agua y la sauna al fondo del deck, con la leñera pegada a su costado oeste y un seto
// detrás (lo que queda detrás del barril se taparía: ahí no se para nadie). Farolitos en el borde del lago
// (se reflejan en el agua), el toallero junto a la sauna y una banca mirando a la tina.
{
  put("spa-deck", SPA_DECK.x, SPA_DECK.y);
  const tub = spaAt(SPA.tub);
  const sauna = spaAt(SPA.sauna);
  put("hot-tub", tub.x, tub.y);
  put("sauna", sauna.x, sauna.y);
  put("sauna-shell", sauna.x, sauna.y + 2);
  put("woodpile", sauna.x - 1, sauna.y);
  for (const [dx, t] of [
    [-1, "bush-round"],
    [0, "bush-hydrangea"],
    [1, "bush-berry"],
    [2, "bush-round"],
  ] as const)
    put(t, sauna.x + dx, sauna.y - 1, dx % 2 ? "down" : "right");
  put("towel-rack", sauna.x + 2, sauna.y);
  put("bench", sauna.x + 1, SPA_DECK.y + 5, "left");
  for (const l of [...SPA.shoreLanterns, ...SPA.deckLanterns]) put("garden-lantern", spaAt(l).x, spaAt(l).y);
  put("planter", SPA_BOX.x1 - 1, SPA_DECK.y + 3);
  put("planter", SPA_DECK.x + 3, SPA_BOX.y1 - 1);
}

// ---------- La granja ----------

// La parrilla: el horno de barro (la boca con el fuego mira al patio de piedra), la parrilla de ladrillo,
// la mesa de preparación, la pizarra con el menú, leña y dos mesas de picnic para comer juntos.
put("clay-oven", OVEN.x, OVEN.y);
put("brick-grill", BRICK_GRILL.x, BRICK_GRILL.y);
put("prep-table", 80, 28);
put("menu-board", 71, 29, "down");
put("woodpile", 82, 27);
put("garden-lantern", 72, 27);
put("garden-lantern", 83, 31);
for (const [tx, ty] of [
  [75, 33],
  [79, 33],
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
  [0, 32],
  [1, 32],
  [2, 32],
  [0, 31],
  [1, 31],
] as const)
  put("hay-bale", x, y, noise(x, y, 91) < 0.5 ? "right" : "down");
put("chicken-feeder", 4, 37);
put("water-trough", 6, 35);
put("feed-sack", 7, 33);
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
put("bench", 118, 97, "up");
for (const [x, y, t] of [
  [106, 89, "oak-2"],
  [107, 89, "pine-2"],
  [107, 88, "birch-1"],
  [108, 88, "bush-round"],
  [109, 88, "pine-3"],
  [106, 90, "bush-berry"],
  [105, 89, "fern"],
  [110, 89, "bush-hydrangea"],
  [107, 90, "bush-rose"],
  [108, 89, "bush-berry"],
  [109, 89, "bush-round"],
  [106, 91, "bush-hydrangea"],
  [107, 91, "bush-round"],
] as const)
  put(t, x, y, noise(x, y, 93) < 0.5 ? "right" : "down");
for (let y = 72; y < PH; y++)
  for (let x = 86; x < PW; x++) {
    if (!isWater(x, y) || !inStream(x + 0.5, y + 0.5)) continue;
    if (x >= WHEEL.x - 1 && x <= WHEEL.x + 2 && y >= WHEEL.y && y <= WHEEL.y + 1) continue;
    if (onBridge(x, y) || x === BRIDGE.x - 1 || x === BRIDGE.x + BRIDGE.w) continue;
    if (nearLand(x, y) && noise(x, y, 95) < 0.32) put("reeds", x, y, noise(x, y, 96) < 0.5 ? "right" : "down");
  }

// Rincón de rocas junto a la parrilla y naturaleza suelta (tipos y posiciones fijos: nada se repite en fila).
for (const [x, y, t, f] of [
  [70, 33, "rock-mossy", "right"],
  [72, 36, "fallen-log", "down"],
  [74, 36, "mushrooms", "right"],
  [83, 37, "pine-2", "right"],
  [87, 33, "oak-1", "down"],
  [66, 34, "birch-1", "right"],
  [63, 37, "fern", "right"],
  // Detrás del ala este y al borde del huerto.
  [72, 1, "pine-1", "down"],
  [77, 3, "birch-2", "right"],
  [11, 1, "pine-3", "right"],
  [18, 1, "oak-1", "down"],
  [1, 17, "pine-2", "right"],
  [3, 52, "pine-1", "down"],
  [8, 45, "mushrooms", "down"],
  [11, 55, "fern", "right"],
  [36, 47, "birch-1", "down"],
  [43, 51, "oak-3", "right"],
  [45, 43, "bush-round", "down"],
  [33, 52, "fern", "down"],
  [25, 41, "bush-berry", "down"],
  [44, 72, "oak-1", "right"],
  [28, 72, "bush-round", "right"],
  [56, 33, "bush-round", "right"],
  [47, 23, "bush-round", "down"],
  [15, 28, "fallen-log", "right"],
  [22, 32, "rock-medium", "down"],
  [8, 30, "stump", "right"],
  [18, 58, "mushrooms", "right"],
  [50, 54, "wildflowers", "right"],
  [45, 61, "wildflowers", "down"],
  [62, 48, "wildflowers", "right"],
  [22, 69, "wildflowers", "down"],
  [67, 47, "fern", "down"],
  [85, 41, "oak-3", "down"],
  [69, 76, "oak-1", "right"],
] as const)
  // Lo que cae en el agua (la orilla ondula con ruido) se omite: nada de helechos flotando.
  if (!isWater(x, y)) put(t, x, y, f);

// Detrás de la casa y de la torre no se vería a nadie (el dibujo de la casa lo tapa entero): el pasillo
// del fondo y el rincón entre el huerto y la torre son un bosquecito cerrado, sin lugar donde pararse.
/**
 * Primer x tapado por la torre en cada fila desde la del fondo de la casa (medido proyectando el dibujo
 * de la casa, relativo a su esquina).
 */
const TOWER_SHADOW = [-9, -9, -8, -8, -7, -6, -5, -4, -3, -2, -1];
const behindHouse = (x: number, y: number) =>
  (y >= 0 && y < HOUSE.y && x >= HOUSE.x - 10 && x <= HOUSE.x + 14) ||
  (y >= HOUSE.y && y < HOUSE.y + TOWER_SHADOW.length && x >= HOUSE.x + TOWER_SHADOW[y - HOUSE.y]! && x < HOUSE.x);
{
  const THICKET = ["oak-1", "pine-2", "birch-1", "oak-3", "pine-1", "bush-round", "oak-2", "pine-3", "birch-2", "bush-berry"];
  const used = new Set<string>();
  const free = (x: number, y: number) => behindHouse(x, y) && !inGarage(x, y) && !used.has(`${x},${y}`);
  for (let y = 0; y < HOUSE.y + TOWER_SHADOW.length; y++)
    for (let x = HOUSE.x - 10; x < HOUSE.x + 15; x++) {
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

// Parada del bus, afuera del portón y más al este (se llega por el sendero de la vereda): la plataforma
// (plana: el piso, los torniquetes y el vidrio del fondo) y encima la estación de vidrio con su techo, que
// se transparenta con alguien adentro. El techo cubre también el tramo del sendero que llega a los
// torniquetes (su dibujo lo tapa desde atrás). La vereda lleva faroles, una banca y matas bajas contra la
// cerca (nada alto: el portón y la estación se ven desde el jardín).
put("bus-platform", STATION.x - M, STATION.y - M);
put("bus-station", STATION.x - M - 3, STATION.y - M - 2);
for (const [x, y, t, f] of [
  // La vereda, junto a la calle.
  [18, 120, "lamp-post", "right"],
  [36, 120, "lamp-post", "right"],
  [62, 120, "lamp-post", "right"],
  [100, 120, "lamp-post", "right"],
  [118, 120, "lamp-post", "right"],
  [44, 117, "bench", "right"],
  // El sendero de la entrada: faroles, el letrero de bienvenida y canteros.
  [51, 116, "signpost", "down"],
  [51, 108, "lamp-post", "right"],
  [43, 111, "lamp-post", "right"],
  [51, 114, "lamp-post", "right"],
  [44, 106, "flower-patch", "right"],
  [50, 110, "wildflowers", "down"],
  [43, 114, "bush-rose", "down"],
  [44, 115, "flower-patch", "right"],
  [56, 104, "flower-patch", "down"],
  [49, 104, "bush-hydrangea", "right"],
  // Matas bajas contra la cerca (nada alto: el portón se ve desde la vereda).
  [6, 101, "bush-hydrangea", "right"],
  [11, 101, "flower-patch", "right"],
  [22, 101, "bush-rose", "down"],
  [24, 101, "flower-patch", "down"],
  [34, 101, "bush-round", "down"],
  [44, 101, "flower-patch", "right"],
  [60, 101, "flower-patch", "right"],
  [70, 101, "bush-hydrangea", "down"],
  [78, 101, "flower-patch", "down"],
  [88, 101, "bush-rose", "right"],
  [95, 101, "flower-patch", "down"],
  [108, 101, "bush-hydrangea", "down"],
  [2, 102, "bush-round", "right"],
  [128, 102, "bush-round", "down"],
] as const)
  put(t, x, y, f);
// El bosquecito de la pradera de la entrada (el sendero lo rodea): árboles y matas apretados.
{
  const COPSE = ["oak-1", "bush-round", "pine-2", "bush-berry", "birch-1", "bush-rose", "oak-3", "bush-hydrangea"];
  const c = ENTRY_COPSE;
  for (let y = Math.floor(c.cy - c.ry); y <= c.cy + c.ry; y++)
    for (let x = Math.floor(c.cx - c.rx); x <= c.cx + c.rx; x++)
      if (ground(x, y) === "grass" && Math.hypot((x + 0.5 - c.cx) / c.rx, (y + 0.5 - c.cy) / c.ry) < 1 + wobble(x, y, 64, 0.12))
        put(COPSE[Math.floor(noise(x, y, 57) * COPSE.length)]!, x, y, noise(x, y, 58) < 0.5 ? "right" : "down");
}

// ---------- El observatorio ----------

/** La placita en tiles enteros (para ubicar lo de alrededor). */
const PZ = { x: OBS_PLAZA.cx, y: Math.floor(OBS_PLAZA.cy) };

// La torre y, al oeste de la placita, la fogata de malvaviscos con sus cuatro troncos en su círculo de arena.
put("observatory", OBS.x, OBS.y);
put("marshmallow-fire", OBS_FIRE.x, OBS_FIRE.y);
put("log-seat", OBS_FIRE.x - 2, OBS_FIRE.y, "right");
put("log-seat", OBS_FIRE.x + 3, OBS_FIRE.y, "left");
put("log-seat", OBS_FIRE.x, OBS_FIRE.y - 2, "down");
put("log-seat", OBS_FIRE.x, OBS_FIRE.y + 3, "up");
put("woodpile", OBS_FIRE.x - 3, OBS_FIRE.y - 2);
put("bunting", OBS_FIRE.x - 3, OBS_FIRE.y + 4, "down");
// Unas matas y un abedul junto al sendero, el letrero chico de la salida del patio y el
// cartel grande de la entrada, junto al sendero, antes de la fogata.
put("birch-1", 95, 24, "down");
put("bush-berry", 94, 27);
put("wildflowers", 96, 29);
put("fern", 95, 31);
put("observatory-sign", 98, 27, "down");
put("observatory-board", OBS_FIRE.x - 5, OBS_FIRE.y - 6);
// Faroles a lo largo del sendero y farolitos en el borde de la placita.
put("lamp-post", 102, 28);
put("lamp-post", 111, 30);
put("garden-lantern", PZ.x + 4, PZ.y - 1);
put("garden-lantern", PZ.x - 5, PZ.y + 2);
// El borde de la placita: macizos de flores y rosales (el frente queda abierto hacia el prado).
for (const [dx, dy, t] of [
  [4, 1, "flower-patch"],
  [4, 2, "bush-rose"],
  [-2, 3, "flower-patch"],
  [2, 3, "flower-patch"],
] as const)
  put(t, PZ.x + dx, PZ.y + dy);
// El prado de mirar estrellas, al sur de la placita: el reloj de sol al medio, bancas que miran al cielo
// (hacia la torre) y dos telescopios chicos en su trípode, con farolitos bajos en las puntas.
put("sundial", PZ.x, PZ.y + 4);
put("bench", PZ.x - 4, PZ.y + 6, "up");
put("bench", PZ.x + 2, PZ.y + 6, "up");
put("stargazer-scope", PZ.x - 6, PZ.y + 5);
put("stargazer-scope", PZ.x + 5, PZ.y + 5, "down");
put("garden-lantern", PZ.x - 7, PZ.y + 7);
put("garden-lantern", PZ.x + 6, PZ.y + 7);
put("toy-rocket", PZ.x + 7, PZ.y + 2);
for (const [dx, dy, t] of [
  [-1, 7, "wildflowers"],
  [1, 8, "wildflowers"],
  [-3, 8, "tall-grass"],
  [4, 8, "wildflowers"],
  [-6, 8, "bush-hydrangea"],
  [7, 5, "bush-round"],
  [-8, 4, "flower-patch"],
] as const)
  put(t, PZ.x + dx, PZ.y + dy);
// El jardín de piedras, al este de la torre: la gravilla rastrillada con peñascos, rocas con musgo,
// helechos y un farolito (se camina entre ellas).
for (const [x, y, t] of [
  [126, 29, "boulder"],
  [129, 31, "rock-mossy"],
  [126, 32, "rock-small"],
  [128, 34, "rock-medium"],
  [130, 33, "fern"],
  [127, 36, "fern"],
  [129, 36, "garden-lantern"],
  [125, 34, "wildflowers"],
  [130, 29, "rock-small"],
] as const)
  put(t, x, y, noise(x, y, 97) < 0.5 ? "right" : "down");
// Contra la cerca del este, unos árboles enmarcan el rincón.
for (const [x, y, t] of [
  [131, 27, "pine-2"],
  [131, 30, "birch-1"],
  [131, 35, "pine-3"],
  [131, 38, "pine-1"],
  [131, 42, "oak-1"],
  [131, 45, "pine-2"],
] as const)
  put(t, x, y, noise(x, y, 98) < 0.5 ? "right" : "down");
// Detrás de la torre (lo que su dibujo tapa, medido con el test de oclusión) crece un bosquecito cerrado de
// pinos, robles y matas: ahí nadie se para y nadie queda escondido. Unos árboles más en el borde le dan forma.
{
  const BEHIND_OBS: [number, number[]][] = [
    [19, [111, 112]],
    [20, [109, 110, 111, 112, 113, 114]],
    [21, [108, 109, 110, 111, 112, 113, 114]],
    [22, [108, 109, 110, 111, 112, 113, 114, 115, 116]],
    [23, [109, 110, 111, 112, 113, 114, 115, 116]],
    [24, [110, 111, 112, 113, 114, 115, 116, 117]],
    [25, [111, 112, 113, 114, 115, 116, 117, 118]],
    [26, [112, 113, 114, 115, 116, 117, 118]],
    [27, [113, 114, 115, 116, 117, 118, 119]],
    [28, [114, 115, 116]],
    [29, [115, 116]],
    [30, [116]],
  ];
  const KINDS = ["pine-2", "bush-round", "oak-1", "bush-berry", "pine-3", "birch-1", "bush-hydrangea", "pine-1", "rock-mossy", "oak-3"];
  for (const [y, xs] of BEHIND_OBS) for (const x of xs) put(KINDS[Math.floor(noise(x, y, 55) * KINDS.length)]!, x, y, noise(x, y, 56) < 0.5 ? "right" : "down");
}
// Flores y matas sueltas junto al sendero de la excursión (nunca encima).
for (const [x, y, t] of [
  [100, 27, "bush-rose"],
  [104, 31, "flower-patch"],
  [99, 22, "wildflowers"],
  [108, 28, "wildflowers"],
  [113, 31, "bush-hydrangea"],
  [105, 26, "tall-grass"],
] as const)
  put(t, x, y, noise(x, y, 99) < 0.5 ? "right" : "down");

// ---------- Puntos ----------

const pt = (type: PointDef["type"], name: string, x: number, y: number): PointDef => ({ type, name, x: x + M, y: y + M });

const POINTS: PointDef[] = [
  // Se aparece al pie del sendero de la entrada, junto a la vereda: de ahí se sube al portón.
  pt("spawn", "Entrada del jardín", 48, FENCE_Y + 17),
  // La granja: frente a la boca del horno y a la parrilla, y junto al letrero del gallinero.
  pt("grill", "Horno de barro", OVEN.x + 1, OVEN.y + 2),
  pt("grill", "Parrilla", BRICK_GRILL.x + 1, BRICK_GRILL.y + 1),
  pt("farm_sign", "Letrero del gallinero", YARD_GATE_X, HEN_YARD.y + HEN_YARD.h + 1),
  pt("mailbox", "Buzón", 50, 23),
  pt("task_board", "Tablón", 56, 23),
  // Una por parcela, en el mismo orden que PLOTS (el índice es el id de la parcela): sobre la parcela.
  ...PLOTS.map((p, i) => pt("garden_plot", `Parcela ${i + 1}`, p.x, p.y)),
  // Frente a la puerta del cobertizo: la regadera y las semillas.
  pt("tool_shed", "Cobertizo", 1, 3),
  // Uno por bancal del invernadero, en el orden de BEDS (el índice es el id del bancal).
  ...BEDS.map((b, i) => pt("greenhouse_plot", `Bancal ${i + 1}`, b.x, b.y)),
  // La punta del muelle y la piedra plana de la orilla norte.
  pt("fishing_spot", "Muelle", DOCK.x1 - 1, DOCK.y0),
  pt("fishing_spot", "Muelle", DOCK.x1 - 1, DOCK.y0 + 1),
  ...FLAT_ROCKS.map((r) => pt("fishing_spot", r.name, r.x, r.y)),
  // El mostrador del puesto de pesca (ya en tiles del nivel).
  PUESTO_PESCA_PUNTO,
  // Uno frente a cada puerta de la estación, en la fila de la plataforma pegada al bus.
  ...BUS_DOOR_X.map((dx) => pt("bus_stop", "Estación Hyvento", Math.floor(dx) - M, STATION.y + STATION.d - 1 - M)),
  // La piscina: junto a cada escalerita (al sur de la del suroeste y al este de la del noreste) y detrás
  // del trampolín.
  pt("pool_steps", "Escalera de la piscina", POOL.x + POOL_STEPS[0]![0], POOL.y + POOL_STEPS[0]![1] + 1),
  pt("pool_steps", "Escalera de la piscina", POOL.x + POOL_STEPS[1]![0] + 1, POOL.y + POOL_STEPS[1]![1]),
  pt("diving_board", "Trampolín", BOARD.x - 1, BOARD.y),
  // Frente a la escalerita de la tarima.
  pt("stage", "Escenario", DECK.x + DECK.w, DECK.y + 3),
  // Alrededor de la fogata del observatorio (entre los troncos): meter el malvavisco y sacarlo.
  pt("marshmallow_fire", "Fogata de malvaviscos", OBS_FIRE.x - 1, OBS_FIRE.y - 1),
  pt("marshmallow_fire", "Fogata de malvaviscos", OBS_FIRE.x + 2, OBS_FIRE.y - 1),
  pt("marshmallow_fire", "Fogata de malvaviscos", OBS_FIRE.x - 1, OBS_FIRE.y + 2),
  pt("marshmallow_fire", "Fogata de malvaviscos", OBS_FIRE.x + 2, OBS_FIRE.y + 2),
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
  // Alrededor del deck de la tina, pasto abierto: que ningún árbol quede pegado a las tablas (sin salirse
  // de la orilla este del lago, x 60..72, y 34..50).
  for (let y = Math.max(34, SPA_BOX.y0 - 2); y < Math.min(51, SPA_BOX.y1 + 2); y++)
    for (let x = Math.max(60, SPA_BOX.x0 - 2); x < Math.min(73, SPA_BOX.x1 + 2); x++) reserved.add(`${x},${y}`);
  for (const r of KEEP_CLEAR) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) reserved.add(`${x},${y}`);
  mark(DOOR_X, PORCH_Y + 2, 2);
  // El pie de la escalera de la casa del árbol, despejado (que ningún árbol la tape).
  mark(TREEHOUSE_FOOT.x + 1, TREEHOUSE_FOOT.y + 1, 3);
  // El anfiteatro y el prado se decoran a mano (arriba): que no crezcan árboles en los pasillos.
  for (let y = STAGE.y - 3; y < PH; y++) for (let x = STAGE.x - 4; x <= MEADOW.x + 6; x++) reserved.add(`${x},${y}`);
  const soft = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground(x + dx, y + dy) !== "grass") return true;
    return false;
  };
  const TREES = ["oak-1", "oak-2", "oak-3", "birch-1", "birch-2", "pine-1", "pine-2", "pine-3", "oak-1", "birch-1"];
  const SMALL = ["tall-grass", "wildflowers", "tall-grass", "fern", "rock-small", "tall-grass", "bush-round", "wildflowers", "fern", "bush-berry", "tall-grass", "mushrooms"];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      if (reserved.has(`${x},${y}`) || ground(x, y) !== "grass" || soft(x, y)) continue;
      // Afuera de la cerca crece la pradera de la entrada, salvo junto a la cerca y cerca de la vereda (ahí
      // va lo que se ubica a mano y no se tapa la estación).
      if (y >= FENCE_Y && (y < FENCE_Y + 3 || y > PH - 7)) continue;
      const edge = y >= FENCE_Y ? Math.min(x, PW - 1 - x, 9) : Math.min(x, y, PW - 1 - x, FENCE_Y - 1 - y);
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
  feeder: { x: 4 + M, y: HEN_YARD.y + 4 + M },
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
    // La tina y la sauna: como la fogata, lo que se dice en el deck queda en el deck.
    { id: "tina", name: "Tina y sauna", type: "table", rect: { x: SPA_BOX.x0 + M, y: SPA_BOX.y0 + M, w: SPA.deck[0], h: SPA.deck[1] }, isolated: true },
    // El escenario: quien está en la tarima se oye en todo el anfiteatro y en las gradas se oye además a
    // los vecinos (ver `hearing` en @hyvento/shared). De afuera no se oye nada, como en la fogata.
    { id: "escenario", name: "Escenario", type: "table", rect: { x: DECK.x + M, y: DECK.y + M, w: DECK.w, h: DECK.h }, isolated: true },
    { id: "gradas", name: "Gradas", type: "table", rect: { x: GRADAS.origin.x + M, y: GRADAS.origin.y + M, w: GRADAS.size.w + 1, h: GRADAS.size.h }, isolated: true },
    // La fogata del observatorio también es una burbuja de charla.
    { id: "fogata-observatorio", name: "Fogata del observatorio", type: "table", rect: OBS_FIRE_ZONE, isolated: true },
  ],
  features: [],
  furniture: items,
  // Don Evelio, detrás del mostrador del puesto de pesca.
  npcTiles: [PESCA_NPC.tile],
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
    {
      id: "jardin-observatorio",
      label: "Entrar al observatorio",
      tiles: CONEXIONES.jardin.observatorio.tiles,
      to: hacia("observatorio", CONEXIONES.observatorio.entrada),
    },
  ],
  points: POINTS,
};

