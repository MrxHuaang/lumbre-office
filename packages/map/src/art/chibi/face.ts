// Cara del chibi: ojos, rubor, pecas, boca, vello facial y lo que va en la cara (gafas, parche).
// La cara mira a la derecha en 3/4: el ojo de atrás (x = 7) queda un poco escondido y el de adelante es
// el de x = 10.
import type { EyeStyle, FacialHair, FaceItem } from "@hyvento/shared";
import { OUT } from "../palette";
import { alpha, hex, type PixelCanvas, type RGBA } from "../pixel";
import type { Ctx, Row, Three, Tones } from "./kit";

const BLUSH = alpha(hex("#e5707a"), 0.55);
/** Pecas: un café translúcido, para que se vean sobre cualquier piel sin quedar como manchas negras. */
const FRECKLE = alpha(hex("#9a4a26"), 0.5);
const GLINT = hex("#fff8e8");

/** Cara (solo de frente): ojos, rubor, pecas, boca y vello facial. */
export function drawFace({ c, t, look, y }: Ctx) {
  drawEyes(c, look.eyes, t.eyes, y);
  if (look.blush) {
    c.set(6, y(9), BLUSH);
    c.set(11, y(9), BLUSH);
  }
  if (look.freckles) for (const [x, r] of FRECKLES) c.set(x, y(r), FRECKLE);
  c.set(9, y(10), t.skin[0]);
  drawFacialHair(c, look.facialHair, t, y);
}

/** Pecas en las mejillas y el puente de la nariz (sin tocar los ojos ni la boca). */
const FRECKLES = [
  [5, 9],
  [6, 10],
  [8, 9],
  [11, 10],
  [12, 9],
] as const;

/**
 * Ojos. Abierto: la pestaña oscura arriba y el iris (color de ojos) abajo, como los de siempre. Los
 * cerrados (feliz, cerrados y el ojo que guiña) son solo pestaña y no muestran el color.
 */
function drawEyes(c: PixelCanvas, style: EyeStyle, e: Three, y: Row) {
  const open = (x: number) => {
    c.set(x, y(7), OUT);
    c.set(x, y(8), e[1]);
  };
  switch (style) {
    case "normal":
      open(7);
      open(10);
      // Brillo del ojo de atrás (como antes).
      c.set(7, y(7), hex("#4a3a5a"));
      return;
    case "happy":
      // Arcos hacia arriba (^ ^); el de atrás se ve a medias.
      c.set(6, y(8), OUT);
      c.set(7, y(7), OUT);
      c.set(9, y(8), OUT);
      c.set(10, y(7), OUT);
      c.set(11, y(8), OUT);
      return;
    case "sleepy":
      // Párpado caído: una raya gruesa encima y el iris asomando abajo.
      c.rect(6, y(7), 2, 1, OUT);
      c.rect(10, y(7), 2, 1, OUT);
      c.set(7, y(8), e[1]);
      c.set(10, y(8), e[1]);
      return;
    case "big":
      bigEye(c, 6, e, y);
      bigEye(c, 10, e, y);
      return;
    case "wink":
      open(7);
      // El de adelante guiña: una rayita con la punta hacia abajo.
      c.rect(10, y(8), 2, 1, OUT);
      c.set(9, y(7), OUT);
      return;
    case "closed":
      // Rayitas curvas hacia abajo, tranquilas.
      c.set(6, y(7), OUT);
      c.set(7, y(8), OUT);
      c.set(10, y(8), OUT);
      c.set(11, y(8), OUT);
      c.set(9, y(7), OUT);
      return;
  }
}

/** Ojo grande de 2x3: pestaña, el iris con sombra arriba y un brillo del lado hacia donde mira. */
function bigEye(c: PixelCanvas, x: number, e: Three, y: Row) {
  c.rect(x, y(6), 2, 1, OUT);
  c.set(x, y(7), e[0]);
  c.set(x + 1, y(7), GLINT);
  c.rect(x, y(8), 2, 1, e[1]);
}

/** Vello facial (del color del pelo). */
function drawFacialHair(c: PixelCanvas, style: FacialHair, t: Tones, y: Row) {
  const hr = t.hair;
  switch (style) {
    case "beard":
      c.rect(4, y(9), 2, 3, hr[1]);
      c.rect(11, y(9), 2, 3, hr[0]);
      c.rect(5, y(11), 7, 1, hr[1]);
      c.rect(7, y(12), 3, 1, hr[0]);
      c.set(9, y(10), hr[0]);
      return;
    case "mustache":
      mustache(c, hr, y);
      return;
    case "goatee":
      // Candado: bigote que baja por los lados de la boca hasta la barbilla.
      mustache(c, hr, y);
      c.rect(8, y(11), 3, 1, hr[1]);
      c.set(10, y(11), hr[0]);
      c.rect(8, y(12), 2, 1, hr[0]);
      return;
    case "stubble": {
      // De tres días: el pelo apenas tiñe la mandíbula y el bigote, salpicado.
      const light = alpha(hr[0], 0.3);
      const dark = alpha(hr[0], 0.5);
      const jaw: [number, number][] = [];
      for (let x = 4; x <= 12; x++) jaw.push([x, 11]);
      for (const x of [4, 5, 11, 12]) jaw.push([x, 10], [x, 9]);
      for (const x of [8, 9, 10]) jaw.push([x, 9]);
      jaw.push([8, 10], [10, 10]);
      for (const [x, r] of jaw) c.set(x, y(r), (x + r) % 2 ? dark : light);
      return;
    }
    default:
      return;
  }
}

/** Bigote sobre la boca, con las puntas cayendo a los lados. */
function mustache(c: PixelCanvas, hr: Three, y: Row) {
  c.rect(8, y(9), 3, 1, hr[1]);
  c.set(8, y(9), hr[2]);
  c.set(8, y(10), hr[1]);
  c.set(10, y(10), hr[0]);
}

/** Lo que va en la cara, por encima del pelo. De espaldas solo se ven las patillas o la cinta. */
export function drawFaceGear({ c, look, view, y }: Ctx) {
  if (look.face === "none") return;
  if (view === "back") return drawFaceGearBack(c, look.face, y);
  switch (look.face) {
    case "glasses":
      for (const x of [6, 8, 9, 11]) c.set(x, y(7), GLASSES);
      c.set(7, y(6), GLASSES);
      c.set(10, y(6), GLASSES);
      c.set(7, y(8), LENS);
      c.set(10, y(8), LENS);
      return;
    case "round-glasses":
      // Aros redondos dorados alrededor de cada ojo (el ojo se ve adentro).
      for (const x of [7, 10]) ring(c, x, y);
      c.set(5, y(7), ROUND_FRAME[0]);
      return;
    case "sunglasses":
      // Lentes oscuros de 2x2 unidos por el puente, con un reflejo arriba en cada uno.
      c.rect(6, y(7), 2, 2, SUN_LENS);
      c.rect(10, y(7), 2, 2, SUN_LENS);
      c.rect(8, y(7), 2, 1, SUN_FRAME);
      c.set(5, y(7), SUN_FRAME);
      c.set(6, y(7), SUN_GLINT);
      c.set(10, y(7), SUN_GLINT);
      return;
    case "eyepatch":
      // Parche en el ojo de adelante y la cinta que cruza la frente hacia atrás.
      c.rect(9, y(7), 3, 2, PATCH[1]);
      c.set(10, y(9), PATCH[1]);
      c.set(9, y(7), PATCH[2]);
      c.set(11, y(8), PATCH[0]);
      for (const [x, r] of [
        [8, 6],
        [7, 5],
        [6, 5],
        [5, 4],
        [4, 4],
        [3, 4],
        [12, 7],
      ] as const)
        c.set(x, y(r), PATCH[0]);
      return;
  }
}

const GLASSES = hex("#1f2a44");
const LENS = alpha(hex("#bfe3ff"), 0.5);
const ROUND_FRAME: [RGBA, RGBA] = [hex("#6e4a16"), hex("#b98424")];
const SUN_FRAME = hex("#1d1a26");
const SUN_LENS = hex("#232638");
const SUN_GLINT = hex("#6d7396");
const PATCH: Three = [hex("#1d1622"), hex("#2e2433"), hex("#4a3d52")];

/** Aro redondo alrededor del ojo de x: arriba y a los lados (abajo queda abierto, sobre la mejilla). */
function ring(c: PixelCanvas, x: number, y: Row) {
  c.set(x, y(6), ROUND_FRAME[1]);
  c.set(x - 1, y(7), ROUND_FRAME[1]);
  c.set(x - 1, y(8), ROUND_FRAME[0]);
  c.set(x + 1, y(7), ROUND_FRAME[1]);
  c.set(x + 1, y(8), ROUND_FRAME[0]);
}

function drawFaceGearBack(c: PixelCanvas, face: Exclude<FaceItem, "none">, y: Row) {
  if (face === "eyepatch") {
    // La cinta cruza la nuca en diagonal.
    for (const [x, r] of [
      [3, 7],
      [4, 7],
      [5, 6],
      [6, 6],
      [7, 5],
      [8, 5],
      [9, 4],
      [10, 4],
      [11, 3],
      [12, 3],
    ] as const)
      c.set(x, y(r), PATCH[0]);
    return;
  }
  // Patillas de las gafas a los dos lados de la cabeza.
  const frameC = face === "glasses" ? GLASSES : face === "round-glasses" ? ROUND_FRAME[0] : SUN_FRAME;
  c.set(3, y(7), frameC);
  c.set(12, y(7), frameC);
}

