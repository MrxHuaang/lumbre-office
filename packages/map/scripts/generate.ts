/**
 * Genera los assets iniciales: tileset, mapa Tiled (office.json) y spritesheets de personajes.
 *
 * Es un bootstrap: una vez generado, `assets/office.json` se puede abrir y editar en Tiled
 * (https://www.mapeditor.org). Volver a correr este script SOBRESCRIBE el mapa.
 *
 *   pnpm map:generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TiledMap, TiledObject, TiledProperty } from "../src/tiled";
import { AGENTS, DIRECTIONS, drawCharacter, FRAME, FRAMES, HUMANS } from "./avatars";
import { COLLIDES, COLUMNS, drawTileset, ROWS, T, TILE } from "./tiles";

const W = 40;
const H = 28;
const assetsDir = fileURLToPath(new URL("../assets/", import.meta.url));
mkdirSync(`${assetsDir}characters`, { recursive: true });

// ---------- Capas de tiles ----------
const floor = new Array<number>(W * H).fill(0);
const walls = new Array<number>(W * H).fill(0);
const furniture = new Array<number>(W * H).fill(0);
const gid = (t: number) => t + 1;
const put = (layer: number[], x: number, y: number, t: number) => {
  layer[y * W + x] = gid(t);
};
const fill = (layer: number[], x0: number, y0: number, x1: number, y1: number, t: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(layer, x, y, t);
};
const clear = (layer: number[], x: number, y: number) => {
  layer[y * W + x] = 0;
};

// Suelos
fill(floor, 1, 1, W - 2, H - 2, T.FLOOR_WOOD);
const OFFICES = [0, 1, 2, 3].map((i) => 1 + 7 * i); // x0 de cada oficina (interior de 6 tiles)
for (const x0 of OFFICES) fill(floor, x0, 2, x0 + 5, 7, T.FLOOR_CARPET);
fill(floor, 29, 2, 38, 10, T.FLOOR_MEETING);
fill(floor, 1, 16, 16, 26, T.FLOOR_LAB);
fill(floor, 22, 18, 27, 21, T.RUG);

// Muros perimetrales
fill(walls, 0, 0, W - 1, 0, T.WALL_TOP);
fill(walls, 0, H - 1, W - 1, H - 1, T.WALL_TOP);
fill(walls, 0, 0, 0, H - 1, T.WALL_TOP);
fill(walls, W - 1, 0, W - 1, H - 1, T.WALL_TOP);
// Cara del muro norte (oficinas y sala de reuniones)
fill(walls, 1, 1, 38, 1, T.WALL_FACE);
for (const x0 of OFFICES) {
  put(walls, x0 + 2, 1, T.WINDOW);
  put(walls, x0 + 3, 1, T.WINDOW);
}
put(walls, 33, 1, T.WHITEBOARD);
put(walls, 34, 1, T.WHITEBOARD);
put(walls, 31, 1, T.WINDOW);
put(walls, 36, 1, T.WINDOW);

// Oficinas: tabiques verticales y muro sur con puerta de 2 tiles
for (const x0 of OFFICES) fill(walls, x0 + 6, 1, x0 + 6, 8, T.WALL_TOP);
fill(walls, 1, 8, 27, 8, T.WALL_TOP);
for (const x0 of OFFICES) {
  for (const dx of [2, 3]) {
    clear(walls, x0 + dx, 8);
    put(floor, x0 + dx, 8, T.DOOR);
  }
}

// Sala de reuniones: tabique x=28 y muro sur con puerta
fill(walls, 28, 1, 28, 11, T.WALL_TOP);
fill(walls, 29, 11, 38, 11, T.WALL_TOP);
for (const x of [33, 34]) {
  clear(walls, x, 11);
  put(floor, x, 11, T.DOOR);
}

// Laboratorio de agentes: muro norte (puerta x=8..9) y muro este (puerta y=20..21)
fill(walls, 1, 15, 17, 15, T.WALL_TOP);
fill(walls, 17, 15, 17, 26, T.WALL_TOP);
for (const x of [8, 9]) {
  clear(walls, x, 15);
  put(floor, x, 15, T.DOOR);
}
for (const y of [20, 21]) {
  clear(walls, 17, y);
  put(floor, 17, y, T.DOOR);
}

// ---------- Mobiliario ----------
for (const x0 of OFFICES) {
  put(furniture, x0 + 1, 3, T.DESK_PC);
  put(furniture, x0 + 2, 3, T.DESK);
  put(furniture, x0 + 1, 4, T.CHAIR);
  put(furniture, x0 + 5, 2, T.BOOKSHELF);
  put(furniture, x0, 7, T.PLANT);
  put(furniture, x0 + 4, 5, T.CHAIR);
}

// Sala de reuniones: mesa de 5x2 y 6 sillas
fill(furniture, 32, 5, 36, 6, T.TABLE);
const MEETING_SEATS: [number, number][] = [
  [32, 4],
  [34, 4],
  [36, 4],
  [32, 7],
  [34, 7],
  [36, 7],
];
for (const [x, y] of MEETING_SEATS) put(furniture, x, y, T.CHAIR);
for (const [x, y] of [
  [29, 2],
  [38, 2],
  [29, 10],
  [38, 10],
] as const)
  put(furniture, x, y, T.PLANT);

// Laboratorio: 6 escritorios de agentes (2 filas x 3) + tablero de tareas
const AGENT_DESKS: [number, number][] = [
  [3, 18],
  [8, 18],
  [13, 18],
  [3, 23],
  [8, 23],
  [13, 23],
];
for (const [x, y] of AGENT_DESKS) {
  put(furniture, x, y, T.LAB_DESK);
  put(furniture, x + 1, y, T.LAB_DESK);
  put(furniture, x, y + 1, T.LAB_CHAIR);
}
fill(furniture, 12, 16, 14, 16, T.TASKBOARD);
for (const [x, y] of [
  [1, 16],
  [1, 26],
  [16, 26],
] as const)
  put(furniture, x, y, T.PLANT);

// Zona común: sofás, café, hot desks, plantas
fill(furniture, 23, 17, 26, 17, T.SOFA);
fill(furniture, 23, 22, 26, 22, T.SOFA);
fill(furniture, 35, 12, 37, 12, T.COFFEE); // deja libre la puerta de la sala (x=33..34)
for (const x of [31, 35]) {
  put(furniture, x, 18, T.DESK_PC);
  put(furniture, x + 1, 18, T.DESK);
  put(furniture, x, 19, T.CHAIR);
}
for (const [x, y] of [
  [18, 26],
  [38, 26],
  [38, 12],
  [27, 9],
] as const)
  put(furniture, x, y, T.PLANT);

// ---------- Capas de objetos ----------
let nextId = 1;
const p = (name: string, type: string, value: unknown): TiledProperty => ({
  name,
  type: typeof value === "boolean" ? "bool" : typeof value === "number" ? "int" : "string",
  value,
});
const rectObj = (name: string, type: string, tx: number, ty: number, tw: number, th: number, props: TiledProperty[]) =>
  ({
    id: nextId++,
    name,
    type,
    x: tx * TILE,
    y: ty * TILE,
    width: tw * TILE,
    height: th * TILE,
    rotation: 0,
    visible: true,
    properties: props,
  }) satisfies TiledObject;
const pointObj = (name: string, type: string, tx: number, ty: number, props: TiledProperty[] = []) =>
  ({
    id: nextId++,
    name,
    type,
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    point: true,
    properties: props,
  }) satisfies TiledObject;

const zones: TiledObject[] = [
  ...OFFICES.map((x0, i) =>
    rectObj(`Oficina ${i + 1}`, "office", x0, 2, 6, 6, [
      p("zoneId", "string", `office-${i + 1}`),
      p("slot", "int", i + 1),
      p("isolated", "bool", true),
    ]),
  ),
  rectObj("Sala de reuniones", "meeting", 29, 2, 10, 9, [
    p("zoneId", "string", "meeting-main"),
    p("isolated", "bool", true),
  ]),
  rectObj("Laboratorio IA", "lab", 1, 16, 16, 11, [p("zoneId", "string", "lab"), p("isolated", "bool", false)]),
  rectObj("Zona común", "lounge", 1, 9, 38, 18, [p("zoneId", "string", "lounge"), p("isolated", "bool", false)]),
];

const points: TiledObject[] = [
  pointObj("spawn", "spawn", 24, 13),
  ...MEETING_SEATS.map(([x, y], i) =>
    pointObj(`Silla ${i + 1}`, "seat", x, y, [p("zone", "string", "meeting-main"), p("index", "int", i)]),
  ),
  ...AGENT_DESKS.flatMap(([x, y], i) => [
    pointObj(`desk-${i + 1}`, "agent_desk", x, y + 1, [p("ref", "string", `desk-${i + 1}`), p("index", "int", i)]),
    pointObj(`visitante desk-${i + 1}`, "visitor_spot", x + 2, y + 1, [p("ref", "string", `desk-${i + 1}`)]),
  ]),
  pointObj("Tablero de tareas", "task_board", 13, 17),
  // Pantalla de presentaciones: la pizarra de la pared norte de la sala (x=33..34, y=1).
  pointObj("Pantalla de la sala", "screen", 33, 1, [p("zone", "string", "meeting-main")]),
];

const tileLayer = (id: number, name: string, data: number[]) => ({
  id,
  name,
  type: "tilelayer" as const,
  width: W,
  height: H,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  data,
});
const objectLayer = (id: number, name: string, objects: TiledObject[]) => ({
  id,
  name,
  type: "objectgroup" as const,
  draworder: "topdown" as const,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  objects,
});

const map: TiledMap = {
  type: "map",
  version: "1.10",
  tiledversion: "1.11.2",
  orientation: "orthogonal",
  renderorder: "right-down",
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE,
  tileheight: TILE,
  compressionlevel: -1,
  nextlayerid: 6,
  nextobjectid: nextId,
  layers: [
    tileLayer(1, "floor", floor),
    tileLayer(2, "walls", walls),
    tileLayer(3, "furniture", furniture),
    objectLayer(4, "zones", zones),
    objectLayer(5, "points", points),
  ],
  tilesets: [
    {
      firstgid: 1,
      name: "office",
      image: "tileset.png",
      imagewidth: COLUMNS * TILE,
      imageheight: ROWS * TILE,
      tilewidth: TILE,
      tileheight: TILE,
      tilecount: COLUMNS * ROWS,
      columns: COLUMNS,
      margin: 0,
      spacing: 0,
      tiles: COLLIDES.map((id) => ({ id, properties: [{ name: "collides", type: "bool", value: true }] })),
    },
  ],
};

writeFileSync(`${assetsDir}office.json`, JSON.stringify(map, null, 1));
drawTileset().save(`${assetsDir}tileset.png`);

for (const [id, style] of Object.entries({ ...HUMANS, ...AGENTS })) {
  drawCharacter(style).save(`${assetsDir}characters/${id}.png`);
}
writeFileSync(
  `${assetsDir}characters.json`,
  JSON.stringify(
    { frameSize: FRAME, frames: FRAMES, directions: DIRECTIONS, humans: Object.keys(HUMANS), agents: Object.keys(AGENTS) },
    null,
    2,
  ),
);

console.log(`Assets generados en ${assetsDir}`);
