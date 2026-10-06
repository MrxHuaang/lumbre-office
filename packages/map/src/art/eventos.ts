// Arte de los eventos del calendario y del modo foco (ver events.ts y focus.ts de @hyvento/shared): lo que
// va sobre la cabeza (gorrito de cumpleaños, tomatito del foco, micrófono de quien canta), el pastel de la
// cafetería, el micrófono del escenario y el neón KARAOKE del club. No son muebles del plano: el juego los
// pone encima del nivel solo mientras dura el evento.
import { NOVENA } from "@hyvento/shared";
import { pesebreSprite } from "./novenas";
import { C, OUT } from "./palette";
import { at, flat, L, PixelCanvas, renderSprite, solidBox, type Box, type RGBA, type Shader, type Sprite } from "./pixel";
import { neonAt, WALL_H } from "./room";

/** Dibujito de mapa de caracteres (una letra = un color, "." vacío) con contorno. */
function glyph(rows: readonly string[], ink: Record<string, RGBA>): PixelCanvas {
  const w = Math.max(...rows.map((r) => r.length));
  const c = new PixelCanvas(w + 2, rows.length + 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => ink[ch] && c.set(x + 1, y + 1, ink[ch]!)));
  c.outline(OUT);
  return c;
}

/** Gorrito de fiesta a rayas con pompón (sobre la cabeza de quien cumple). */
export function partyHat(): PixelCanvas {
  return glyph(
    ["...w...", "..wWw..", "...r...", "..rgr..", "..ggg..", ".rrrrr.", ".ggggg.", "rrrrrrr", "yyyyyyy"],
    { w: C.white[4]!, W: C.white[2]!, r: C.neon[3]!, g: C.gold[4]!, y: C.gold[2]! },
  );
}

/** Tomatito del modo foco (sobre la cabeza mientras dura el bloque). */
export function focusTomato(): PixelCanvas {
  return glyph(
    ["..g.g..", "...G...", ".rrrrr.", "rrRrrrr", "rRrrrrr", "rrrrrrr", "rrrrrrd", ".rrrdd."],
    { g: C.leaf[4]!, G: C.leaf[2]!, r: C.rug[3]!, R: C.rug[5]!, d: C.rug[1]! },
  );
}

/** Micrófono de mano (sobre la cabeza de quien canta en el karaoke). */
export function singerMic(): PixelCanvas {
  return glyph(
    [".mmm.", "mMmMm", "mmMmm", ".mmm.", "..k..", "..n..", "..n..", "..n..", "..k.."],
    { m: C.metal[4]!, M: C.metal[5]!, k: C.metal[1]!, n: C.neon[3]! },
  );
}

/**
 * Pastel de cumpleaños de dos pisos con velitas, para poner sobre una mesa de la cafetería (coordenadas de
 * arte del tile de la mesa; `z` es la altura de su tapa).
 */
export function birthdayCake(z = 13): Sprite {
  const frosting: Shader = (u) => at(C.rose, Math.floor(u) % 4 === 0 ? 5 : 4);
  const sponge: Shader = (u, v) => (Math.floor(v) === 2 ? at(C.cream, 5) : at(C.cream, (Math.floor(u) + Math.floor(v)) % 5 === 0 ? 2 : 3));
  const boxes: Box[] = [
    // Plato.
    solidBox({ x: 2, y: 2, z, w: 12, d: 12, h: 1 }, C.white, 3),
    // Piso de abajo y su glaseado.
    { x: 3, y: 3, z: z + 1, w: 10, d: 10, h: 4, top: flat(at(C.rose, 5)), left: sponge, right: sponge },
    { x: 3, y: 3, z: z + 5, w: 10, d: 10, h: 1, top: flat(at(C.rose, 5)), left: frosting, right: frosting },
    // Piso de arriba.
    { x: 5, y: 5, z: z + 6, w: 6, d: 6, h: 3, top: flat(at(C.rose, 5)), left: sponge, right: sponge },
    { x: 5, y: 5, z: z + 9, w: 6, d: 6, h: 1, top: flat(at(C.cream, 5)), left: frosting, right: frosting },
  ];
  // Velitas de colores, cada una con su llama.
  for (const [x, y, ramp] of [
    [6, 6, C.sky],
    [9, 6, C.gold],
    [6, 9, C.leaf],
    [9, 9, C.neon],
  ] as const) {
    boxes.push(solidBox({ x, y, z: z + 10, w: 1, d: 1, h: 3 }, ramp, 3));
    boxes.push({ x, y, z: z + 13, w: 1, d: 1, h: 2, top: flat(at(C.fire, 4)), left: flat(at(C.fire, 3)), right: flat(at(C.fire, 2)) });
  }
  return renderSprite(boxes, { outline: OUT });
}

/** Pie de micrófono para el escenario del club (un tile). */
export function micStand(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 5, y: 5, z: 0, w: 6, d: 6, h: 1 }, C.metal, 2),
      solidBox({ x: 7.5, y: 7.5, z: 1, w: 1, d: 1, h: 22 }, C.metal, 3),
      solidBox({ x: 7.5, y: 6.5, z: 23, w: 1, d: 2, h: 1 }, C.metal, 3),
      { x: 7, y: 5.5, z: 23, w: 2, d: 2, h: 3, top: flat(at(C.metal, 5)), left: flat(at(C.metal, 4)), right: flat(at(C.metal, 3)) },
    ],
    { outline: OUT },
  );
}

/** Dónde cuelga el neón KARAOKE: la pared norte del club, sobre los estantes de botellas. */
export const KARAOKE_SIGN = { x: 33, y: 4, width: 4, text: "KARAOKE", top: 51 } as const;

/**
 * El neón KARAOKE como sprite aparte, dibujado con la misma pared inclinada que el fondo (coordenadas de
 * arte absolutas del nivel: se pone donde se pondría el fondo, en su origen).
 */
export function karaokeSign(): Sprite {
  const { x, y, width, text, top } = KARAOKE_SIGN;
  const u1 = width * L;
  return renderSprite([{ x: x * L, y: y * L - 4, z: 0, w: u1, d: 4, h: WALL_H, left: (u, hv) => neonAt(text, u, hv, u1, top) }]);
}

/** Dónde va lo de cada evento: el pastel sobre la mesa 3 de la cafetería y el micrófono en la tarima del tubo. */
export const EVENT_SPOTS = {
  cake: { area: "planta-baja", x: 22, y: 5 },
  mic: { area: "sotano", x: 40, y: 8 },
} as const;

/** Algo que un evento pone encima del nivel: en un tile (como un mueble) o, sin tile, en coordenadas del nivel. */
export interface EventOverlay {
  key: string;
  sprite: Sprite;
  tile: { x: number; y: number } | null;
  /** Tiles que ocupa (por defecto 1x1): se ordena con el centro de todo eso, como un mueble. */
  size?: { w: number; d: number };
  /** Se dibuja al espejo (como un mueble mirando hacia abajo o arriba). */
  flip?: boolean;
}

/** Lo que se ve en un nivel según los eventos de hoy (lo usan el juego y la vista previa del arte). */
export function eventOverlays(areaId: string, on: { birthday: boolean; karaoke: boolean; pesebre?: number | null }): EventOverlay[] {
  const out: EventOverlay[] = [];
  // Las novenas: el pesebre del recibidor con las figuras que lleva (null = no hay novena).
  if (on.pesebre != null && areaId === NOVENA.area) {
    const { x, y, w, d, facing } = NOVENA.pesebre;
    out.push({ key: `novena-pesebre-${on.pesebre}`, sprite: pesebreSprite(on.pesebre), tile: { x, y }, size: { w, d }, flip: facing === "down" });
  }
  if (on.birthday && areaId === EVENT_SPOTS.cake.area) out.push({ key: "evento-pastel", sprite: birthdayCake(), tile: EVENT_SPOTS.cake });
  if (on.karaoke && areaId === EVENT_SPOTS.mic.area) {
    out.push({ key: "evento-neon-karaoke", sprite: karaokeSign(), tile: null });
    out.push({ key: "evento-microfono", sprite: micStand(), tile: EVENT_SPOTS.mic });
  }
  return out;
}

/** Colores del confeti. */
export const CONFETTI_COLORS = [C.neon[3]!, C.gold[4]!, C.sky[2]!, C.leaf[4]!, C.violet[4]!, C.rug[4]!];
