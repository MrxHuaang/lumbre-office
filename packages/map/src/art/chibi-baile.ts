// Bailes del club, dibujados desde el Look con las mismas capas del chibi (ropa, cara, pelo…) pero con
// brazos en otras poses, el cuerpo corrido, inclinado o enganchado, y el pelo al viento. No toca las
// hojas de caminata ni de sentado: son hojas aparte (la rutina del tubo y los pasos de la pista).
import { DANCE_MOVE_IDS, isSwimwear, normalizeLook, type DanceMoveId, type FullLook, type Top } from "@hyvento/shared";
import type { CharacterStyle } from "./chibi";
import { drawLegs, drawTorso } from "./chibi/clothes";
import { drawFace, drawFaceGear } from "./chibi/face";
import { drawBackGear, drawNeckGear } from "./chibi/gear";
import { drawHair } from "./chibi/hair";
import { drawHeadwear } from "./chibi/head";
import { BODY_H, TOP, tones, type Ctx, type Tones, type View } from "./chibi/kit";
import { OUT } from "./palette";
import { PixelCanvas, type RGBA } from "./pixel";

/** Poses del brazo: colgando, junto a la cabeza, en diagonal arriba, estirado, en la cadera, hacia adelante y doblado. */
export type ArmPose = "down" | "up" | "high" | "out" | "hip" | "forward" | "bent";

/** Un frame del baile. Los brazos van en el orden del dibujo que mira a la derecha: [el de atrás, el de adelante]. */
export interface DancePose {
  view: View;
  /** Espejo (mira hacia el otro lado). */
  flip: boolean;
  /** Paso de las piernas (0 quieto, 1 y 2 como al caminar). */
  frame?: 0 | 1 | 2;
  /** Piernas dobladas: enganchada al tubo o en cuclillas. */
  sit?: boolean;
  /** Cuánto baja el torso (rodillas flexionadas). */
  bob?: number;
  arms: [ArmPose, ArmPose];
  /** Pelo al viento hacia la izquierda (-1) o la derecha (1) de la pantalla. */
  hair?: -1 | 0 | 1;
  /** Inclinación del cuerpo: cuántos px se corre la cabeza (+ = a la derecha de la pantalla). */
  lean?: number;
  /** Corrimiento en pantalla respecto del tubo o de los pies (+x = derecha, +y = abajo). */
  dx?: number;
  dy?: number;
  /** Cuánto sube (enganchada al tubo). */
  lift?: number;
}

/** Frame de la rutina del tubo: además, si queda detrás del tubo (se dibuja por debajo de él). */
export interface PoleFrame extends DancePose {
  behind?: boolean;
}

/** Largo de manga de cada parte de arriba (igual que en la ropa del chibi). */
const SLEEVE: Record<Top, "none" | "short" | "long"> = {
  tshirt: "short",
  longsleeve: "long",
  hoodie: "long",
  sweater: "long",
  "shirt-tie": "long",
  tank: "none",
  polo: "short",
};

/** Recorrido de cada pose del brazo de atrás (x = 3), del hombro a la mano (el último píxel). */
const ARM: Record<ArmPose, [number, number][]> = {
  down: [[3, 14], [3, 15], [3, 16], [3, 17], [3, 18]],
  up: [[3, 13], [2, 12], [2, 11], [2, 10], [2, 9], [2, 8], [2, 7], [2, 6]],
  high: [[3, 13], [2, 12], [1, 11], [1, 10], [0, 9], [0, 8]],
  out: [[3, 14], [2, 14], [1, 13], [0, 13]],
  hip: [[3, 14], [2, 15], [2, 16], [3, 17]],
  forward: [[4, 14], [5, 15], [6, 15], [7, 15]],
  bent: [[3, 14], [3, 15], [2, 14], [2, 13]],
};

/** Mechones que vuelan al costado de la cabeza (del lado izquierdo del dibujo), según el largo del pelo. */
const STREAK: Record<"long" | "mid" | "short", [number, number, 0 | 1 | 2][]> = {
  long: [
    [2, 4, 2], [1, 4, 1], [2, 5, 1], [1, 5, 1], [0, 5, 1], [2, 6, 1], [1, 6, 0], [0, 6, 0], [2, 7, 0], [1, 7, 0], [2, 8, 0],
  ],
  mid: [[2, 4, 2], [1, 5, 1], [2, 5, 1], [2, 6, 0]],
  short: [[2, 4, 1]],
};
const LONG_HAIR = new Set(["long", "ponytail", "braids", "pigtails", "wavy", "dreads", "mullet"]);
const NO_HAIR = new Set(["bald", "buzz"]);

function streakOf(look: FullLook) {
  if (NO_HAIR.has(look.hairStyle)) return [];
  if (LONG_HAIR.has(look.hairStyle)) return STREAK.long;
  return look.hairStyle === "short" || look.hairStyle === "spiky" || look.hairStyle === "undercut" ? STREAK.short : STREAK.mid;
}

/** Un brazo en su pose: manga según la parte de arriba (o la chaqueta) y la mano de piel. */
function drawArm(ctx: Ctx, side: 0 | 1, pose: ArmPose) {
  const { c, t, look, y } = ctx;
  const path = ARM[pose].map(([x, r]) => [side === 0 ? x : 15 - x, r] as const);
  const skin = t.skin[side === 0 ? 1 : 0];
  const sleeveLen =
    look.outfit === "jacket" ? path.length - 1 : isSwimwear(look.outfit) ? 0 : { long: path.length - 1, short: 2, none: 0 }[SLEEVE[look.top]];
  const sleeve = look.outfit === "jacket" ? t.accent[0] : t.shirt[side === 0 ? 1 : 0];
  path.forEach(([x, r], i) => c.set(x, y(r), i < sleeveLen && i < path.length - 1 ? sleeve : skin));
}

/** Cuello y cabeza (piel), igual que en el chibi. */
function drawHeadBase({ c, t, y }: Ctx) {
  c.rect(7, y(12), 2, 1, t.skin[0]);
  c.rect(4, y(3), 8, 9, t.skin[1]);
  c.rect(3, y(4), 10, 7, t.skin[1]);
  c.rect(12, y(4), 1, 7, t.skin[0]);
  c.rect(4, y(11), 8, 1, t.skin[0]);
}

function drawStreak(ctx: Ctx, side: -1 | 1) {
  const { c, t, look, y } = ctx;
  for (const [x, r, k] of streakOf(look)) c.set(side < 0 ? x : 15 - x, y(r), t.hair[k] as RGBA);
}

/** El cuerpo de un frame del baile (16 x BODY_H, sin contorno: el contorno va sobre el frame armado). */
function danceBody(look: FullLook, p: DancePose, t: Tones): PixelCanvas {
  const c = new PixelCanvas(16, BODY_H);
  const sit = p.sit ?? false;
  const frame = p.frame ?? 0;
  const drop = sit ? 3 : 0;
  const bob = (p.bob ?? 0) + (sit || frame === 0 ? 0 : 1);
  // El viento viene en coordenadas de pantalla: con espejo, en el dibujo va al revés.
  const wind = ((p.hair ?? 0) * (p.flip ? -1 : 1)) as -1 | 0 | 1;
  const ctx: Ctx = {
    c,
    look,
    t,
    view: p.view,
    frame,
    sit,
    y: (row) => row + bob + drop + TOP,
    Y: (row) => row + TOP,
    swing: 0,
    sway: -wind,
  };
  drawBackGear(ctx, "behind");
  drawLegs(ctx);
  drawTorso(ctx);
  // Los brazos que suben junto a la cabeza van después del pelo (si no, el pelo largo los tapa).
  const raised = (a: ArmPose) => a === "up" || a === "high";
  for (const side of [0, 1] as const) if (!raised(p.arms[side])) drawArm(ctx, side, p.arms[side]);
  drawHeadBase(ctx);
  if (wind) drawStreak(ctx, wind);
  if (p.view === "front") {
    drawFace(ctx);
    drawNeckGear(ctx);
    drawHair(ctx);
  } else {
    drawHair(ctx);
    drawNeckGear(ctx);
  }
  drawFaceGear(ctx);
  drawHeadwear(ctx);
  drawBackGear(ctx, "over");
  for (const side of [0, 1] as const) if (raised(p.arms[side])) drawArm(ctx, side, p.arms[side]);
  return c;
}

/** Fila de las suelas dentro del cuerpo (la inclinación se mide desde ahí). */
const SOLE = 23 + TOP;

/** Copia el cuerpo al frame con la esquina en (ox, oy), espejado e inclinado si hace falta. */
function blitBody(dst: PixelCanvas, body: PixelCanvas, ox: number, oy: number, flip: boolean, lean: number) {
  for (let y = 0; y < body.height; y++) {
    const shift = Math.round((lean * Math.max(0, SOLE - y)) / 22);
    for (let x = 0; x < body.width; x++) {
      const i = (y * body.width + x) * 4;
      if (!body.data[i + 3]) continue;
      const px = ox + (flip ? body.width - 1 - x : x) + shift;
      dst.set(px, oy + y, [body.data[i]!, body.data[i + 1]!, body.data[i + 2]!, body.data[i + 3]!]);
    }
  }
}

/** Arma un frame de w x h con los pies en `feetY` y el centro en x = w / 2, y le pone el contorno. */
function danceFrame(look: FullLook, t: Tones, p: DancePose, w: number, h: number, feetY: number): PixelCanvas {
  const f = new PixelCanvas(w, h);
  const body = danceBody(look, p, t);
  const ox = Math.round(w / 2 - 8 + (p.dx ?? 0));
  const oy = Math.round(feetY - (SOLE + 1) + (p.dy ?? 0) - (p.lift ?? 0));
  blitBody(f, body, ox, oy, p.flip, p.lean ?? 0);
  f.outline(OUT);
  return f;
}

function paste(sheet: PixelCanvas, f: PixelCanvas, col: number, row: number) {
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      if (!f.data[i + 3]) continue;
      sheet.set(col * f.width + x, row * f.height + y, [f.data[i]!, f.data[i + 1]!, f.data[i + 2]!, f.data[i + 3]!]);
    }
}

// ---------- El tubo ----------

/** Frames de la rutina del tubo: más altos que los de caminar, para subir por el tubo. */
export const POLE_FRAME_W = 32;
export const POLE_FRAME_H = 48;
/** Fila de los pies (la base del tubo) dentro del frame. */
export const POLE_FEET_Y = 45;

const F = "front" as const;
const B = "back" as const;

/**
 * La rutina, dos frames por tiempo de la música: ondas junto al tubo, una vuelta completa alrededor (por
 * delante y por detrás, con el pelo al viento), subir enganchada con las piernas, arriba una pose
 * inclinada hacia atrás, bajar despacio, y una pose de pie colgada de una mano.
 */
export const POLE_ROUTINE: readonly PoleFrame[] = [
  // Ondas junto al tubo (mira hacia él, con la mano de adelante arriba).
  { view: F, flip: false, dx: -6, arms: ["hip", "up"] },
  { view: F, flip: false, dx: -6, arms: ["hip", "up"], bob: 1, lean: 1 },
  { view: F, flip: false, dx: -6, arms: ["hip", "up"], sit: true },
  { view: F, flip: false, dx: -6, arms: ["hip", "up"], bob: 1, lean: -1 },
  // La vuelta: por delante del tubo hacia la derecha, y por detrás de vuelta.
  { view: F, flip: false, dx: -5, arms: ["out", "high"], frame: 1 },
  { view: F, flip: false, dx: -3, dy: 2, arms: ["out", "high"], sit: true, lift: 4, hair: -1 },
  { view: F, flip: false, dx: 0, dy: 3, arms: ["high", "high"], sit: true, lift: 5, hair: -1 },
  { view: F, flip: true, dx: 3, dy: 2, arms: ["out", "high"], sit: true, lift: 4, hair: -1 },
  { view: F, flip: true, dx: 5, arms: ["out", "high"], frame: 2 },
  { view: B, flip: true, dx: 3, dy: -2, arms: ["out", "high"], hair: 1, behind: true },
  { view: B, flip: true, dx: 0, dy: -3, arms: ["high", "high"], hair: 1, behind: true, frame: 1 },
  { view: B, flip: false, dx: -3, dy: -2, arms: ["high", "out"], hair: 1, behind: true },
  // Sube enganchada con las piernas, abraza el tubo y arriba se inclina hacia atrás.
  { view: F, flip: false, dx: -5, arms: ["forward", "up"], sit: true, lift: 3 },
  { view: F, flip: false, dx: -5, arms: ["forward", "up"], sit: true, lift: 7 },
  { view: F, flip: false, dx: -5, arms: ["out", "up"], sit: true, lift: 11 },
  { view: F, flip: false, dx: -5, arms: ["high", "up"], sit: true, lift: 13, lean: -2, hair: -1 },
  { view: F, flip: false, dx: -4, arms: ["high", "up"], sit: true, lift: 13, lean: -3, hair: -1 },
  { view: F, flip: false, dx: -5, arms: ["out", "up"], sit: true, lift: 10, lean: -1 },
  { view: F, flip: false, dx: -5, arms: ["forward", "up"], sit: true, lift: 6 },
  { view: F, flip: false, dx: -5, arms: ["forward", "up"], sit: true, lift: 2 },
  // Colgada de una mano, inclinada lejos del tubo, y de vuelta.
  { view: F, flip: false, dx: -5, arms: ["up", "out"], lean: -3, hair: -1 },
  { view: F, flip: false, dx: -5, arms: ["up", "out"], lean: -3, bob: 1, hair: -1 },
  { view: F, flip: false, dx: -5, arms: ["up", "out"], lean: -2, frame: 1 },
  { view: F, flip: false, dx: -6, arms: ["hip", "up"], lean: 0 },
];

/** Hoja de la rutina del tubo: una fila con un frame por paso de POLE_ROUTINE. */
export function drawPoleDance(s: CharacterStyle): PixelCanvas {
  const look = normalizeLook(s);
  const t = tones(look);
  const sheet = new PixelCanvas(POLE_FRAME_W * POLE_ROUTINE.length, POLE_FRAME_H);
  POLE_ROUTINE.forEach((p, i) => paste(sheet, danceFrame(look, t, p, POLE_FRAME_W, POLE_FRAME_H, POLE_FEET_Y), i, 0));
  return sheet;
}

// ---------- La pista ----------

/** Frames de cada paso de la pista (dos por tiempo). Miden como los de caminar: 32x32, pies en la fila 29. */
export const DANCE_FRAMES = 4;
const DANCE_FEET_Y = 29;

export const FLOOR_MOVES: Record<DanceMoveId, readonly DancePose[]> = {
  // De un lado al otro, con las manos en la cadera.
  vaiven: [
    { view: F, flip: false, frame: 1, arms: ["hip", "hip"], lean: -1, dx: -1 },
    { view: F, flip: false, bob: 1, arms: ["down", "down"] },
    { view: F, flip: true, frame: 2, arms: ["hip", "hip"], lean: 1, dx: 1 },
    { view: F, flip: true, bob: 1, arms: ["down", "down"] },
  ],
  // Los dos brazos arriba, abajo, y uno y otro.
  brazos: [
    { view: F, flip: false, arms: ["up", "up"] },
    { view: F, flip: false, bob: 1, arms: ["down", "down"] },
    { view: F, flip: false, frame: 1, arms: ["high", "down"], hair: -1 },
    { view: F, flip: true, frame: 2, arms: ["high", "down"], hair: 1 },
  ],
  // Una vuelta completa con los brazos abiertos.
  giro: [
    { view: F, flip: false, arms: ["out", "out"], hair: -1 },
    { view: F, flip: true, arms: ["out", "out"], hair: -1, frame: 1 },
    { view: B, flip: true, arms: ["out", "out"], hair: 1 },
    { view: B, flip: false, arms: ["out", "out"], hair: 1, frame: 2 },
  ],
  // Brazos rectos que cambian de golpe.
  robot: [
    { view: F, flip: false, arms: ["bent", "out"] },
    { view: F, flip: false, bob: 1, arms: ["out", "bent"] },
    { view: F, flip: true, arms: ["bent", "out"] },
    { view: F, flip: true, bob: 1, arms: ["out", "bent"] },
  ],
};

/** Hoja de los pasos de la pista: una fila por paso (en el orden de DANCE_MOVES) y DANCE_FRAMES columnas. */
export function drawFloorDance(s: CharacterStyle): PixelCanvas {
  const look = normalizeLook(s);
  const t = tones(look);
  const sheet = new PixelCanvas(32 * DANCE_FRAMES, 32 * DANCE_MOVE_IDS.length);
  DANCE_MOVE_IDS.forEach((id, row) => FLOOR_MOVES[id].forEach((p, col) => paste(sheet, danceFrame(look, t, p, 32, 32, DANCE_FEET_Y), col, row)));
  return sheet;
}
