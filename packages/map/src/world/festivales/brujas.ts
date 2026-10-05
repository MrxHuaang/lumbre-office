// La decoración de la Noche de brujas (ver festival-decor.ts): el laberinto de maíz en la pradera de la
// entrada (al oeste del sendero que sube de la vereda), con su arco, el puesto del caldero y el cementerio
// de cartón; calabazas y faroles a lo largo del camino de piedra hasta el porche; telarañas y calabazas en
// el recibidor y telarañas en el sótano. Todo en tiles del nivel. La calabaza dorada cambia de rincón del
// laberinto cada día del juego (sorteado con la semilla del día: igual para todos).
import { lineSeed } from "@hyvento/shared";
import type { AreaDef, Facing, Placement, PointDef } from "../types";
import type { FestivalDecor, FestivalDecorDef } from "../../festival-decor";

/**
 * El laberinto: `cols` x `rows` celdas de un tile con paredes de maíz de un tile entre ellas (ocupa
 * 2·cols+1 x 2·rows+1 tiles desde x, y). Se entra por el este, por el arco, en la fila de celdas `door`.
 */
export const LABERINTO = { x: 30, y: 113, cols: 8, rows: 6, door: 3, seed: 1031 } as const;
const GW = LABERINTO.cols * 2 + 1;
const GH = LABERINTO.rows * 2 + 1;
/** El tile del pasillo de la entrada, justo afuera del arco. */
export const LABERINTO_ENTRADA = { x: LABERINTO.x + GW, y: LABERINTO.y + LABERINTO.door * 2 + 1 };

/** El puesto del festival: el caldero, sus fardos y el punto donde se compra (delante del caldero). */
const PUESTO = { x: 50, y: 117 };

/** Azar con semilla (mulberry32): el laberinto es siempre el mismo. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Qué tiles de la grilla del laberinto quedan abiertos (pasillos), con un recorrido en profundidad. */
function carveMaze(): boolean[][] {
  const open = Array.from({ length: GH }, () => Array<boolean>(GW).fill(false));
  const rand = rng(LABERINTO.seed);
  const seen = new Set<string>();
  const start: { i: number; j: number } = { i: LABERINTO.cols - 1, j: LABERINTO.door };
  const stack = [start];
  seen.add(`${start.i},${start.j}`);
  open[start.j * 2 + 1]![start.i * 2 + 1] = true;
  while (stack.length) {
    const c = stack.at(-1)!;
    const next = [
      { i: c.i + 1, j: c.j },
      { i: c.i - 1, j: c.j },
      { i: c.i, j: c.j + 1 },
      { i: c.i, j: c.j - 1 },
    ].filter((n) => n.i >= 0 && n.j >= 0 && n.i < LABERINTO.cols && n.j < LABERINTO.rows && !seen.has(`${n.i},${n.j}`));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(rand() * next.length)]!;
    seen.add(`${n.i},${n.j}`);
    open[n.j * 2 + 1]![n.i * 2 + 1] = true;
    open[c.j + n.j + 1]![c.i + n.i + 1] = true;
    stack.push(n);
  }
  // La entrada del este (donde va el paso del arco).
  open[LABERINTO.door * 2 + 1]![GW - 1] = true;
  return open;
}

const OPEN = carveMaze();

/** Un rincón donde puede esconderse la calabaza: la celda sin salida y el pasillo desde donde se toma. */
export interface PumpkinSpot {
  pumpkin: { x: number; y: number };
  point: { x: number; y: number };
}

/** Los callejones sin salida del laberinto (sin contar la celda de la entrada), en tiles del nivel. */
export const PUMPKIN_SPOTS: readonly PumpkinSpot[] = (() => {
  const out: PumpkinSpot[] = [];
  for (let j = 0; j < LABERINTO.rows; j++)
    for (let i = 0; i < LABERINTO.cols; i++) {
      const gx = i * 2 + 1;
      const gy = j * 2 + 1;
      const exits = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([dx, dy]) => OPEN[gy + dy!]?.[gx + dx!]);
      if (exits.length !== 1 || (i === LABERINTO.cols - 1 && j === LABERINTO.door)) continue;
      const [dx, dy] = exits[0]!;
      out.push({
        pumpkin: { x: LABERINTO.x + gx, y: LABERINTO.y + gy },
        point: { x: LABERINTO.x + gx + dx!, y: LABERINTO.y + gy + dy! },
      });
    }
  return out;
})();

/** Dónde está la calabaza dorada un día del juego (el mismo para todos). */
export const pumpkinSpotOf = (day: number): PumpkinSpot => PUMPKIN_SPOTS[lineSeed(`brujas:calabaza:${day}`) % PUMPKIN_SPOTS.length]!;

/** Las paredes de maíz (alternando las cuatro matas), el arco y la calabaza dorada del día. */
function laberinto(day: number): Placement[] {
  const out: Placement[] = [];
  const archTop = LABERINTO.door * 2;
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      if (OPEN[gy]![gx]) continue;
      // Los dos pilares del arco van en la pared del este, arriba y abajo del paso.
      if (gx === GW - 1 && gy >= archTop && gy <= archTop + 2) continue;
      const x = LABERINTO.x + gx;
      const y = LABERINTO.y + gy;
      out.push({ type: `corn-maze-${(lineSeed(`maiz:${x},${y}`) % 4) + 1}`, x, y, facing: "right" });
    }
  out.push({ type: "maze-arch", x: LABERINTO.x + GW - 1, y: LABERINTO.y + archTop, facing: "right" });
  out.push({ type: "golden-pumpkin", ...pumpkinSpotOf(day).pumpkin, facing: "right" });
  return out;
}

const put = (type: string, x: number, y: number, facing: Facing = "right"): Placement => ({ type, x, y, facing });

/**
 * A lo largo del camino de piedra del portón al porche: en cada fila, del lado izquierdo y del derecho, el
 * primer tile de pasto (el camino tiene ancho variable). Calabazas talladas de un lado y faroles del otro,
 * turnándose.
 */
function caminoDecorado(def: AreaDef): Placement[] {
  const out: Placement[] = [];
  const ground = (x: number, y: number) => def.ground?.(x, y) ?? "grass";
  [104, 96, 88, 80, 72, 64, 56, 48, 40].forEach((y, k) => {
    let l = 62;
    while (ground(l, y) === "path" && l > 55) l--;
    let r = 62;
    while (ground(r, y) === "path" && r < 70) r++;
    const [a, b] = k % 2 ? ["paper-lantern", "carved-pumpkin"] : ["carved-pumpkin", "paper-lantern"];
    if (ground(l, y) === "grass") out.push(put(a, l, y));
    if (ground(r, y) === "grass") out.push(put(b, r, y));
  });
  return out;
}

function jardin(def: AreaDef, day: number): FestivalDecor {
  const furniture: Placement[] = [
    ...laberinto(day),
    // El arco con sus calabazas grandes a los lados.
    put("carved-pumpkin-big", LABERINTO_ENTRADA.x + 1, LABERINTO_ENTRADA.y - 2),
    put("carved-pumpkin", LABERINTO_ENTRADA.x + 1, LABERINTO_ENTRADA.y + 2),
    // El puesto del caldero, entre faroles y fardos.
    put("cauldron", PUESTO.x, PUESTO.y),
    put("straw-bale", PUESTO.x - 1, PUESTO.y),
    put("straw-bale", PUESTO.x + 1, PUESTO.y),
    put("paper-lantern", PUESTO.x - 2, PUESTO.y - 1),
    put("paper-lantern", PUESTO.x + 2, PUESTO.y - 1),
    put("pumpkin-pile", PUESTO.x + 2, PUESTO.y + 1),
    put("witch-scarecrow", PUESTO.x - 2, PUESTO.y + 6),
    // El cementerio de cartón al sur del laberinto.
    put("cardboard-tombstone", 35, 127),
    put("cardboard-tombstone", 38, 127),
    put("cardboard-tombstone", 41, 127),
    put("carved-pumpkin", 37, 128),
    put("carved-pumpkin", 40, 128),
    // El camino al porche y el porche.
    ...caminoDecorado(def),
    put("carved-pumpkin-big", 58, 30),
    put("pumpkin-pile", 58, 31),
    put("carved-pumpkin", 67, 30),
    put("straw-bale", 68, 30),
    // El espantapájaros de brujas cuida el huerto.
    put("witch-scarecrow", 31, 20),
  ];
  const spot = pumpkinSpotOf(day);
  const points: PointDef[] = [
    { type: "festival_shop", name: "Puesto del caldero", x: PUESTO.x, y: PUESTO.y + 1 },
    { type: "golden_pumpkin", name: "Calabaza dorada", x: spot.point.x, y: spot.point.y },
  ];
  return { furniture, points };
}

export const BRUJAS_DECOR: FestivalDecorDef = {
  areas: ["jardin", "planta-baja", "sotano"],
  build(def, day) {
    if (def.id === "jardin") return jardin(def, day);
    // El recibidor: calabazas contra las paredes (sin tapar el paso) y una telaraña en el rincón de la cocina.
    if (def.id === "planta-baja")
      return { furniture: [put("carved-pumpkin-big", 18, 18), put("pumpkin-pile", 18, 19), put("carved-pumpkin", 18, 20), put("cobweb", 29, 0)] };
    // La leyenda del sótano: telarañas en los rincones del casino, el cine y el arcade.
    if (def.id === "sotano") return { furniture: [put("cobweb", 0, 18), put("cobweb", 0, 21), put("cobweb", 16, 21)] };
    return null;
  },
};
