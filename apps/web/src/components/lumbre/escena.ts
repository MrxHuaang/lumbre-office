// La escena de la portada de Lumbre: la casa nueva del jardín en una isla de pasto, con el sendero,
// la fogata y los faroles. Se dibuja con el mismo motor del juego (sin Phaser) y encima caminan
// personajes. Aquí solo hay datos y cuentas (nada del DOM), para poder probarla aparte.
import { catalogItem, type AreaDef, type FloorKind, type Placement } from "@hyvento/map";
import { L, toScreen } from "@hyvento/map/art";

const place = (type: string, x: number, y: number, facing: Placement["facing"] = "right"): Placement => ({ type, x, y, facing });

export const ESCENA_W = 34;
export const ESCENA_H = 31;

/** La casa (22x14): la puerta queda en x = CASA.x + 10 y el porche da a la fila CASA.y + 14. */
const CASA = { x: 6, y: 2 };
export const PUERTA = { x: CASA.x + 10.5, y: CASA.y + 14.6 };
/** La fogata (2x2), a un costado del sendero. */
export const FOGATA = { x: 24, y: 22 };

/** Centro del sendero: sale del porche y baja con una curva suave. */
const sendero = (y: number) => PUERTA.x + 0.5 + Math.sin((y - 16) / 3.2) * 1.3;

function piso(x: number, y: number): FloorKind {
  if (y >= CASA.y + 14 && y < CASA.y + 16.4 && x > PUERTA.x - 3.2 && x < PUERTA.x + 4.2) return "path";
  if (y >= CASA.y + 14 && Math.abs(x - sendero(y)) < 1.25) return "path";
  // Un claro de tierra pisada alrededor de la fogata, unido al sendero.
  if (Math.hypot(x - (FOGATA.x + 1), (y - (FOGATA.y + 1)) * 1.1) < 3.1) return "path";
  if (y > FOGATA.y + 0.4 && y < FOGATA.y + 1.6 && x > sendero(y) && x < FOGATA.x) return "path";
  return "grass";
}

export const ESCENA: AreaDef = {
  id: "portada-lumbre",
  name: "Lumbre",
  width: ESCENA_W,
  height: ESCENA_H,
  outdoor: true,
  ground: (x, y) => piso(x + 0.5, y + 0.5),
  groundFine: piso,
  rooms: [],
  doors: [],
  zones: [],
  features: [],
  portals: [],
  points: [],
  furniture: [
    place("house", CASA.x, CASA.y),
    // Canteros y faroles frente al porche.
    ...[
      [11, 17],
      [12, 17],
      [21, 17],
      [22, 17],
    ].map(([x, y]) => place("flower-patch", x!, y!)),
    place("bush-rose", 10, 18),
    place("bush-hydrangea", 23, 18),
    place("lamp-post", 13, 20),
    place("lamp-post", 20, 20),
    place("lamp-post", 13, 26),
    place("mailbox", 15, 23, "down"),
    // La fogata con troncos para sentarse.
    place("fire-pit", FOGATA.x, FOGATA.y),
    place("log-seat", FOGATA.x + 3, FOGATA.y, "left"),
    place("log-seat", FOGATA.x - 1, FOGATA.y + 3, "down"),
    place("woodpile", 31, 17),
    place("garden-lantern", 28, 26),
    // Bosque alrededor.
    place("oak-big", 1, 17),
    place("pine-1", 2, 3),
    place("pine-2", 0, 9),
    place("birch-1", 4, 14),
    place("oak-1", 30, 4),
    place("pine-3", 32, 9),
    place("birch-2", 29, 12),
    place("cherry-tree", 6, 22),
    place("apple-tree", 2, 26),
    place("oak-2", 31, 28),
    place("pine-1", 26, 29),
    place("bush-berry", 8, 27),
    place("bush-round", 4, 20),
    place("rock-mossy", 27, 19),
    place("stump", 9, 24),
    place("fern", 7, 19),
    place("mushrooms", 3, 23),
    place("wildflowers", 10, 22),
    place("wildflowers", 27, 24),
    place("tall-grass", 22, 28),
    place("tall-grass", 5, 29),
    place("oak-3", 13, 29),
    place("pine-2", 19, 30),
    place("birch-1", 30, 23),
    place("bush-round", 24, 30),
    place("pine-3", 1, 22),
    place("oak-1", 7, 30),
    place("birch-2", 10, 27),
    place("rock-small", 23, 26),
    place("flower-patch", 21, 27),
  ],
};

/** Una oficina propia en chiquito (para la sección de oficinas): escritorio con PC, sofá y plantas. */
export const OFICINA: AreaDef = {
  id: "portada-oficina",
  name: "Tu oficina",
  width: 7,
  height: 6,
  rooms: [{ id: "oficina", rect: { x: 0, y: 0, w: 7, h: 6 }, floor: "wood", wallpaper: "sage" }],
  doors: [{ edge: "h", x: 3, y: 6 }],
  zones: [],
  features: [
    { kind: "window", edge: "h", x: 2, y: 0, width: 2 },
    { kind: "clock", edge: "h", x: 4, y: 0 },
    { kind: "picture", edge: "v", x: 0, y: 2 },
  ],
  portals: [],
  points: [],
  furniture: [
    place("plant", 0, 0),
    place("desk-pc", 2, 0, "down"),
    place("chair", 2, 1, "up"),
    place("bookcase-tall", 5, 0, "down"),
    place("rug-3x3", 2, 3),
    place("sofa", 0, 3, "right"),
    place("coffee-table", 2, 4),
    place("armchair", 4, 4, "left"),
    place("monstera", 6, 3),
    place("lamp", 6, 5),
    place("reading-lamp", 0, 5),
  ],
};

/** El sótano en chiquito (para la sección de juegos): arcade, ruleta, crispetas y tocadiscos. */
export const JUEGOS: AreaDef = {
  id: "portada-juegos",
  name: "Juegos",
  width: 7,
  height: 6,
  rooms: [{ id: "juegos", rect: { x: 0, y: 0, w: 7, h: 6 }, floor: "carpet", wallpaper: "wine" }],
  doors: [{ edge: "h", x: 3, y: 6 }],
  zones: [],
  features: [
    { kind: "neon", edge: "h", x: 2, y: 0, width: 4, text: "JUEGOS" },
    { kind: "poster", edge: "v", x: 0, y: 2 },
  ],
  portals: [],
  points: [],
  furniture: [
    place("arcade-cabinet", 0, 0, "down"),
    place("arcade-cabinet", 1, 0, "down"),
    place("roulette-wheel", 3, 2),
    place("popcorn-machine", 6, 0),
    place("record-player", 5, 0),
    place("cafe-table", 1, 4),
    place("armchair", 0, 4, "right"),
    place("plant", 6, 3),
    place("bench", 0, 1, "right"),
  ],
};

/** Un recorrido: tramos entre puntos en tiles (con decimales) que un personaje camina de ida y vuelta. */
export type Recorrido = { x: number; y: number }[];

/** Del porche por el sendero hasta la fogata y de vuelta. */
export const PASEO: Recorrido = [
  { x: PUERTA.x, y: PUERTA.y + 0.4 },
  { x: sendero(19), y: 19 },
  { x: sendero(22.5), y: 22.5 },
  { x: FOGATA.x - 3.1, y: FOGATA.y + 0.6 },
];

/** Del borde de abajo del sendero hacia arriba, hasta el cantero. */
export const LLEGADA: Recorrido = [
  { x: sendero(29.5), y: 29.5 },
  { x: sendero(26), y: 26 },
  { x: sendero(23.5), y: 23.5 },
];

/**
 * Posición en el dibujo compuesto (píxeles del lienzo) de un punto del piso en tiles. Sigue lo que hace
 * composeArea con un nivel de afuera sin alrededores: el origen del fondo queda en (alto * L + 2, 2)
 * más el relleno `pad`.
 */
export function aLienzo(tx: number, ty: number, pad: number, z = 0) {
  const s = toScreen(tx * L, ty * L, z);
  return { x: ESCENA_H * L + 2 + pad + s.x, y: 2 + pad + s.y };
}

/** Las luces de la escena (faroles, fogata, farol del porche), sacadas del catálogo: en tiles y alto. */
export const LUCES = ESCENA.furniture.flatMap((f) => {
  const luz = catalogItem(f.type).light;
  return luz ? [{ x: f.x + luz.at[0] / L, y: f.y + luz.at[1] / L, z: luz.at[2], color: luz.color, radio: luz.radius, fuego: f.type === "fire-pit" }] : [];
});

/** La gente quieta junto a la fogata: dónde está y hacia dónde mira. */
export const RONDA = [
  { x: FOGATA.x - 1.8, y: FOGATA.y + 1.4, dir: "right" as const },
  { x: FOGATA.x + 1.9, y: FOGATA.y - 1.1, dir: "down" as const },
];

/** Dirección del sprite según hacia dónde se mueve en el piso (igual que en el juego). */
export function mirandoA(vx: number, vy: number): "down" | "left" | "right" | "up" {
  const sx = vx - vy;
  const sy = vx + vy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

/** Largo total de un recorrido, en tiles. */
export function largo(r: Recorrido): number {
  let d = 0;
  for (let i = 1; i < r.length; i++) d += Math.hypot(r[i]!.x - r[i - 1]!.x, r[i]!.y - r[i - 1]!.y);
  return d;
}

type Dir = ReturnType<typeof mirandoA>;

/** Punto a `d` tiles del comienzo de un recorrido (sin pasarse del final), con la dirección del tramo. */
function punto(pts: Recorrido, d: number): { x: number; y: number; dir: Dir } {
  let resto = d;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const tramo = Math.hypot(b.x - a.x, b.y - a.y);
    if (resto <= tramo || i === pts.length - 1) {
      const k = tramo ? Math.min(1, resto / tramo) : 0;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dir: mirandoA(b.x - a.x, b.y - a.y) };
    }
    resto -= tramo;
  }
  const p = pts[0]!;
  return { x: p.x, y: p.y, dir: "down" };
}

/**
 * Dónde va un personaje que camina el recorrido de ida y vuelta, `d` tiles después de arrancar. En cada
 * punta se queda quieto `pausa` (medido en tiles de caminata), mirando hacia donde iba.
 */
export function enRecorrido(r: Recorrido, d: number, pausa = 0): { x: number; y: number; dir: Dir; caminando: boolean } {
  const total = largo(r);
  const vuelta = [...r].reverse();
  const t = ((d % (2 * (total + pausa))) + 2 * (total + pausa)) % (2 * (total + pausa));
  if (t < total) return { ...punto(r, t), caminando: true };
  if (t < total + pausa) return { ...punto(r, total), caminando: false };
  if (t < 2 * total + pausa) return { ...punto(vuelta, t - total - pausa), caminando: true };
  return { ...punto(vuelta, total), caminando: false };
}
