// Personajes chibi en pixel-art (estilo Stardew), vista isométrica 3/4. Se dibujan en el navegador a
// partir del Look (ver packages/shared/src/look.ts). Cada parte vive en su módulo de ./chibi: ropa
// (clothes), cuello y espalda (gear), cara (face), pelo (hair) y cabeza (head). Aquí solo se decide el
// orden de las capas. Los seis personajes fijos son presets de Look.
import { normalizeLook, wornLook, type FullLook, type HumanAvatar, type Look, type LookInput, type Pattern, type WornLook } from "@hyvento/shared";
import { drawArms, drawLegs, drawTorso, HIDES_TOP, OWN_SLEEVES } from "./chibi/clothes";
import { drawCostumeDetails } from "./chibi/costumes";
import { drawCollar } from "./chibi/outfits";
import { drawFace, drawFaceGear } from "./chibi/face";
import { drawBackGear, drawNeckGear } from "./chibi/gear";
import { drawHair } from "./chibi/hair";
import { drawHeadwear } from "./chibi/head";
import { BODY_H, SIT_DROP, SOLE, TOP, tones, type Ctx, type View } from "./chibi/kit";
import { OUT } from "./palette";
import { PixelCanvas } from "./pixel";

export { HIDES_BOTTOM, HIDES_TOP, OWN_SLEEVES, TOPS_WITH_TOP2 } from "./chibi/clothes";
export { ACCENT_BACK_ITEMS, ACCENT_NECK_ITEMS } from "./chibi/gear";

/** Cada frame mide 40x40; el personaje va centrado abajo con los pies en FEET_Y. */
export const FRAME = 40;
export const FEET_Y = 37;
/** Columna de la celda donde empieza el cuerpo (mide 16 de ancho) y fila donde cae su fila 0, de pie. */
export const BODY_X = (FRAME - 16) / 2;
export const BODY_Y = FEET_Y - 1 - SOLE;
export { SIT_DROP };
/**
 * Alturas sobre los pies (px) de partes del cuerpo de pie: la coronilla, la boca, el hombro y la mano
 * (Avatar.ts pone ahí el nombre, lo que se come, el brazo que saluda y lo que se lleva en la mano).
 * Sentado, todo baja SIT_DROP.
 */
export const BODY_UP = {
  crown: FEET_Y - (BODY_Y + 1),
  mouth: FEET_Y - (BODY_Y + 10),
  shoulder: FEET_Y - (BODY_Y + 14),
  hand: FEET_Y - (BODY_Y + 20),
} as const;
/** Columnas de la hoja de caminata: quieto, paso A, paso B. */
export const FRAMES = 3;
/** Filas de la hoja (direcciones del mundo) y frames de la hoja de sentado, en este orden. */
export const SHEET_DIRECTIONS = ["down", "left", "right", "up"] as const;
export type SheetDirection = (typeof SHEET_DIRECTIONS)[number];

/** Lo que se le pasa al dibujo: un Look (aunque sea viejo o incompleto); lo que falte se completa. */
export type CharacterStyle = LookInput;

/** Los seis personajes fijos. */
export const HUMANS: Record<HumanAvatar, CharacterStyle> = {
  ada: { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", hairStyle: "long" },
  bruno: { skin: "#c68642", hair: "#1b1b1b", shirt: "#2a9d8f", pants: "#3d405b", hairStyle: "short" },
  carla: { skin: "#ffdbac", hair: "#b5651d", shirt: "#8338ec", pants: "#22223b", hairStyle: "bun" },
  dario: { skin: "#8d5524", hair: "#0d0d0d", shirt: "#f4a261", pants: "#1d3557", hairStyle: "curly" },
  eva: { skin: "#e0ac69", hair: "#d4a017", shirt: "#06d6a0", pants: "#3a3a4a", hairStyle: "long" },
  fede: { skin: "#f1c27d", hair: "#6b4423", shirt: "#118ab2", pants: "#4a4e69", hairStyle: "buzz" },
};

/** Un frame del cuerpo (16 x BODY_H). Las capas van de atrás hacia adelante. */
function drawBody(look: WornLook, view: View, frame: 0 | 1 | 2, sit: boolean): PixelCanvas {
  const c = new PixelCanvas(16, BODY_H);
  // Sentado: el cuerpo baja y las piernas se doblan hacia adelante.
  const drop = sit ? SIT_DROP : 0;
  const bob = sit ? 0 : frame === 0 ? 0 : 1;
  const ctx: Ctx = {
    c,
    look,
    t: tones(look),
    view,
    frame,
    sit,
    y: (row) => row + bob + drop + TOP,
    Y: (row) => row + TOP,
    swing: sit ? 0 : frame === 1 ? 1 : frame === 2 ? -1 : 0,
    sway: sit ? 0 : frame === 1 ? -1 : frame === 2 ? 1 : 0,
  };
  drawBackGear(ctx, "behind");
  drawLegs(ctx);
  drawArms(ctx);
  drawTorso(ctx);
  drawCostumeDetails(ctx, "body");
  drawHeadBase(ctx);
  if (view === "front") {
    drawFace(ctx);
    // El cuello va antes que el pelo: el pelo largo cae por encima.
    drawNeckGear(ctx);
    drawCollar(ctx);
    drawHair(ctx);
  } else {
    drawHair(ctx);
    // De espaldas lo del cuello va encima del pelo, para que se vea.
    drawNeckGear(ctx);
    drawCollar(ctx);
  }
  drawFaceGear(ctx);
  drawHeadwear(ctx);
  drawBackGear(ctx, "over");
  drawCostumeDetails(ctx, "head");
  c.outline(OUT);
  return c;
}

/** Cuello y cabeza (piel). */
function drawHeadBase({ c, t, y }: Ctx) {
  c.rect(7, y(12), 2, 1, t.skin[0]);
  c.rect(4, y(3), 8, 9, t.skin[1]);
  c.rect(3, y(4), 10, 7, t.skin[1]);
  c.rect(12, y(4), 1, 7, t.skin[0]);
  c.rect(4, y(11), 8, 1, t.skin[0]);
}

/** Copia un frame del cuerpo dentro de la celda (col, row) de una hoja, espejado si hace falta. */
function blitFrame(sheet: PixelCanvas, f: PixelCanvas, col: number, row: number, flip: boolean) {
  const ox = col * FRAME + BODY_X;
  const oy = row * FRAME + BODY_Y - TOP;
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      if (!f.data[i + 3]) continue;
      sheet.set(ox + (flip ? f.width - 1 - x : x), oy + y, [f.data[i]!, f.data[i + 1]!, f.data[i + 2]!, f.data[i + 3]!]);
    }
}

/** Vista y espejo de cada dirección del mundo (+x = sureste, +y = suroeste en pantalla). */
const ORIENT: Record<SheetDirection, { view: View; flip: boolean }> = {
  down: { view: "front", flip: true },
  left: { view: "back", flip: true },
  right: { view: "front", flip: false },
  up: { view: "back", flip: false },
};

/** Hoja de caminata: 3 columnas (quieto, paso A, paso B) x 4 filas (down, left, right, up). */
export function drawCharacter(s: CharacterStyle): PixelCanvas {
  const look = wornLook(normalizeLook(s));
  const sheet = new PixelCanvas(FRAME * FRAMES, FRAME * SHEET_DIRECTIONS.length);
  SHEET_DIRECTIONS.forEach((dir, row) => {
    const { view, flip } = ORIENT[dir];
    ([0, 1, 2] as const).forEach((frame) => blitFrame(sheet, drawBody(look, view, frame, false), frame, row, flip));
  });
  return sheet;
}

/** Hoja de sentado: 4 frames (down, left, right, up). */
export function drawSitting(s: CharacterStyle): PixelCanvas {
  const look = wornLook(normalizeLook(s));
  const sheet = new PixelCanvas(FRAME * SHEET_DIRECTIONS.length, FRAME);
  SHEET_DIRECTIONS.forEach((dir, col) => {
    const { view, flip } = ORIENT[dir];
    blitFrame(sheet, drawBody(look, view, 0, true), col, 0, flip);
  });
  return sheet;
}

/** Estilo de dibujo para un Look personalizado o uno de los personajes fijos. */
export function styleFor(avatar: string, look: Look | null): CharacterStyle {
  if (look) return look;
  return HUMANS[avatar as HumanAvatar] ?? HUMANS.ada;
}

/**
 * Dónde se ve el color secundario (top2): el patrón, la capucha, la corbata, el cuello, los puños, los
 * estampados o los ribetes. El editor lo usa para nombrar su selector (o decir que no se ve).
 */
export type Top2Part = Exclude<Pattern, "solid"> | "hood" | "collar" | "tie" | "cuffs" | "plaid" | "flowers" | "print" | "number" | "inner" | "trim" | "details";

/** Lo de cada parte de arriba que va con top2 (además del patrón). */
const TOP2_OF_TOP: Partial<Record<FullLook["top"], Top2Part[]>> = {
  hoodie: ["hood"],
  "shirt-tie": ["tie"],
  sweater: ["collar", "cuffs"],
  polo: ["collar", "cuffs"],
  flannel: ["plaid"],
  jersey: ["collar", "number", "cuffs"],
  hawaiian: ["flowers"],
  sailor: ["collar", "cuffs"],
  cardigan: ["inner"],
  "graphic-tee": ["print"],
};

/**
 * Lo que se pinta con top2 en este look. Qué partes son sale de la ropa; si se ve o no, de dibujarlo:
 * se dibuja con dos colores secundarios distintos y se compara (con tantos conjuntos que tapan una parte
 * u otra, así el editor nunca dice que se ve algo que quedó tapado).
 */
export function top2Parts(full: FullLook): Top2Part[] {
  // Basta con los cuatro cuerpos quietos (de frente y de espaldas, de pie y sentado).
  const probe = (top2: string) => {
    const look = wornLook({ ...full, top2 });
    return (["front", "back"] as const).flatMap((view) => [drawBody(look, view, 0, false), drawBody(look, view, 0, true)]);
  };
  const [a, b] = [probe("#ff00ff"), probe("#00ff00")];
  const visible = a.some((body, k) => body.data.some((v, i) => v !== b[k]!.data[i]));
  if (!visible) return [];
  const look = wornLook(full);
  const parts: Top2Part[] = look.pattern === "solid" ? [] : [look.pattern];
  const o = look.outfit;
  if (o === "pajamas" || o === "robe" || o === "ruana") parts.push("trim");
  // Los puños se ven si las mangas son las de la parte de arriba (el vestido las deja); lo demás, si no la tapa un conjunto.
  const sleeves = !o || !OWN_SLEEVES.has(o);
  const top = !o || !HIDES_TOP.has(o);
  for (const p of TOP2_OF_TOP[look.top] ?? []) if (p === "cuffs" ? sleeves : top) parts.push(p);
  return parts.length ? parts : ["details"];
}
