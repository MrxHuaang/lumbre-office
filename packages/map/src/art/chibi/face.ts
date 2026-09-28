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

/** Qué va en cada píxel del ojo: pestaña, la pestaña suave del ojo de atrás, iris (base o sombra) y brillo. */
type EyePaint = "lash" | "soft" | "iris" | "shade" | "glint";
type EyePixel = readonly [x: number, row: number, paint: EyePaint];
/** Lo que se ve del ojo abierto (ahí va el vidrio de las gafas). */
const OPEN: ReadonlySet<EyePaint> = new Set(["iris", "shade", "glint"]);

/** Ojo grande de 2x3: pestaña, el iris con sombra arriba y un brillo del lado hacia donde mira. */
const bigEye = (x: number): EyePixel[] => [
  [x, 6, "lash"],
  [x + 1, 6, "lash"],
  [x, 7, "shade"],
  [x + 1, 7, "glint"],
  [x, 8, "iris"],
  [x + 1, 8, "iris"],
];

/**
 * Píxeles de cada forma de ojos. Abierto: la pestaña oscura arriba y el iris (color de ojos) abajo, como
 * los de siempre. Los cerrados (feliz, cerrados y el ojo que guiña) son solo pestaña y no muestran el
 * color. Están como datos para que las gafas sepan dónde no pintar.
 */
const EYES: Record<EyeStyle, readonly EyePixel[]> = {
  // El ojo de atrás lleva la pestaña más suave (como antes).
  normal: [
    [7, 7, "soft"],
    [7, 8, "iris"],
    [10, 7, "lash"],
    [10, 8, "iris"],
  ],
  // Arcos hacia arriba (^ ^); el de atrás se ve a medias.
  happy: [
    [6, 8, "lash"],
    [7, 7, "lash"],
    [9, 8, "lash"],
    [10, 7, "lash"],
    [11, 8, "lash"],
  ],
  // Párpado caído: una raya gruesa encima y el iris asomando abajo.
  sleepy: [
    [6, 7, "lash"],
    [7, 7, "lash"],
    [10, 7, "lash"],
    [11, 7, "lash"],
    [7, 8, "iris"],
    [10, 8, "iris"],
  ],
  big: [...bigEye(6), ...bigEye(10)],
  // El de adelante guiña: una rayita con la punta hacia abajo.
  wink: [
    [7, 7, "lash"],
    [7, 8, "iris"],
    [10, 8, "lash"],
    [11, 8, "lash"],
    [9, 7, "lash"],
  ],
  // Rayitas curvas hacia abajo, tranquilas.
  closed: [
    [6, 7, "lash"],
    [7, 8, "lash"],
    [10, 8, "lash"],
    [11, 8, "lash"],
    [9, 7, "lash"],
  ],
};

const SOFT_LASH = hex("#4a3a5a");

function drawEyes(c: PixelCanvas, style: EyeStyle, e: Three, y: Row) {
  const paint: Record<EyePaint, RGBA> = { lash: OUT, soft: SOFT_LASH, iris: e[1], shade: e[0], glint: GLINT };
  for (const [x, r, p] of EYES[style]) c.set(x, y(r), paint[p]);
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
      // De tres días: el pelo apenas tiñe la mandíbula y el bigote, salpicado. Debajo de los ojos
      // (columnas 7 y 10 de la fila 9) queda piel, para que no se junte con el ojo.
      const light = alpha(hr[0], 0.3);
      const dark = alpha(hr[0], 0.5);
      const jaw: [number, number][] = [];
      for (let x = 4; x <= 12; x++) jaw.push([x, 11]);
      for (const x of [4, 5, 11, 12]) jaw.push([x, 10], [x, 9]);
      jaw.push([8, 9], [9, 9], [8, 10], [10, 10]);
      for (const [x, r] of jaw) c.set(x, y(r), (x + r) % 2 ? dark : light);
      return;
    }
    default:
      return;
  }
}

/**
 * Bigote en arco sobre la boca, con las puntas cayendo a los lados. No toca la fila 9 debajo de los ojos
 * (columnas 7 y 10): con pelo oscuro se juntaría con el ojo en una raya que baja hasta la barbilla.
 */
function mustache(c: PixelCanvas, hr: Three, y: Row) {
  c.rect(8, y(9), 2, 1, hr[1]);
  c.set(8, y(9), hr[2]);
  c.set(7, y(10), hr[1]);
  c.set(10, y(10), hr[0]);
}

/** Lo que va en la cara, por encima del pelo. De espaldas solo se ven las patillas o la cinta. */
export function drawFaceGear({ c, look, view, y }: Ctx) {
  if (look.face === "none") return;
  if (view === "back") return drawFaceGearBack(c, look.face, y);
  switch (look.face) {
    case "glasses":
    case "round-glasses":
      return drawGlasses(c, look.face, look.eyes, y);
    case "sunglasses":
      // Lentes oscuros de 2x2 unidos por el puente, con un reflejo arriba en cada uno.
      c.rect(6, y(7), 2, 2, SUN_LENS);
      c.rect(10, y(7), 2, 2, SUN_LENS);
      c.rect(8, y(7), 2, 1, SUN_FRAME);
      c.set(5, y(7), SUN_FRAME);
      c.set(6, y(7), SUN_GLINT);
      c.set(10, y(7), SUN_GLINT);
      return;
    case "3d-glasses":
      // Gafas 3D del cine: marco de cartón claro, un lente rojo y uno celeste.
      c.rect(5, y(6), 8, 1, CARD[1]);
      c.rect(6, y(7), 2, 2, LENS_RED);
      c.rect(10, y(7), 2, 2, LENS_CYAN);
      c.set(5, y(7), CARD[1]);
      c.rect(8, y(7), 2, 1, CARD[1]);
      c.set(12, y(7), CARD[0]);
      c.set(12, y(8), CARD[0]);
      c.set(5, y(8), CARD[0]);
      return;
    case "hero-mask": {
      // Antifaz: una banda oscura sobre los ojos, con los ojos a la vista, y las puntas del nudo atrás.
      const eye = new Set(EYES[look.eyes].map(([x, r]) => `${x},${r}`));
      for (let r = 6; r <= 8; r++)
        for (let x = 4; x <= 12; x++) {
          if (eye.has(`${x},${r}`)) continue;
          c.set(x, y(r), r === 6 || x === 12 ? MASK[0] : MASK[1]);
        }
      c.set(3, y(7), MASK[1]);
      c.set(2, y(8), MASK[0]);
      c.set(2, y(9), MASK[1]);
      return;
    }
    case "star-glasses":
      // Gafas de fiesta: dos estrellas doradas alrededor de los ojos, con lentes rosados.
      for (const x0 of [6, 10]) {
        c.rect(x0, y(7), 2, 2, STAR_LENS);
        c.set(x0, y(6), GOLD[2]);
        c.set(x0 + 1, y(6), GOLD[1]);
        c.set(x0 - 1, y(7), GOLD[2]);
        c.set(x0 + 2, y(7), GOLD[1]);
        c.set(x0 - 1, y(9), GOLD[1]);
        c.set(x0 + 2, y(9), GOLD[0]);
        c.set(x0, y(5), GOLD[2]);
      }
      return;
    case "monocle":
      // Monóculo dorado en el ojo de adelante, con la cadenita que baja al cuello.
      for (const [x, r] of [[10, 6], [11, 6], [9, 7], [12, 7], [9, 8], [12, 8], [10, 9], [11, 9]] as const) c.set(x, y(r), GOLD[1]);
      c.set(10, y(6), GOLD[2]);
      for (const [x, r, paint] of EYES[look.eyes]) if (x >= 10 && x <= 11 && OPEN.has(paint)) c.set(x, y(r), LENS);
      c.set(12, y(10), GOLD[0]);
      c.set(12, y(11), GOLD[1]);
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
const CARD: [RGBA, RGBA] = [hex("#c9b89a"), hex("#f3ead6")];
const LENS_RED = alpha(hex("#e0413a"), 0.8);
const LENS_CYAN = alpha(hex("#3fc6dd"), 0.8);
const MASK: [RGBA, RGBA] = [hex("#15121c"), hex("#2a2536")];
const STAR_LENS = alpha(hex("#ff8fc8"), 0.6);
const GOLD: Three = [hex("#b98424"), hex("#dcae3f"), hex("#f3d672")];

/**
 * Gafas de marco fino o redondas. El marco rodea cada ojo (los grandes son más anchos y altos) y nunca
 * pisa un píxel del ojo, así la forma (feliz, guiño, cerrados…) se sigue leyendo; el vidrio va solo
 * sobre la parte abierta del ojo, no sobre la piel.
 */
function drawGlasses(c: PixelCanvas, face: "glasses" | "round-glasses", style: EyeStyle, y: Row) {
  const eye = EYES[style];
  const taken = new Set(eye.map(([x, r]) => `${x},${r}`));
  const frame = (x: number, r: number, col: RGBA) => {
    if (!taken.has(`${x},${r}`)) c.set(x, y(r), col);
  };
  // Columnas de cada ojo (el de atrás y el de adelante) y su primera fila.
  const big = style === "big";
  const top = big ? 6 : 7;
  const boxes: [number, number][] = big
    ? [
        [6, 7],
        [10, 11],
      ]
    : [
        [7, 7],
        [10, 10],
      ];
  for (const [x0, x1] of boxes) {
    if (face === "glasses") {
      // Marco fino: la ceja encima del ojo y las esquinas a la altura de la pestaña.
      for (let x = x0; x <= x1; x++) frame(x, top - 1, GLASSES);
      frame(x0 - 1, top, GLASSES);
      frame(x1 + 1, top, GLASSES);
      continue;
    }
    // Aro dorado: arriba y a los lados (abajo queda abierto, sobre la mejilla), con la luz arriba.
    for (let x = x0; x <= x1; x++) frame(x, top - 1, ROUND_FRAME[1]);
    for (let r = top; r <= 8; r++) {
      const col = r === 8 ? ROUND_FRAME[0] : ROUND_FRAME[1];
      frame(x0 - 1, r, col);
      frame(x1 + 1, r, col);
    }
  }
  // La patilla sale del aro de atrás hacia la oreja.
  if (face === "round-glasses") frame(boxes[0]![0] - 2, top, ROUND_FRAME[0]);
  else for (const [x, r, p] of eye) if (OPEN.has(p)) c.set(x, y(r), LENS);
}

function drawFaceGearBack(c: PixelCanvas, face: Exclude<FaceItem, "none">, y: Row) {
  if (face === "hero-mask") {
    // La banda rodea la cabeza y el nudo queda en la nuca con sus dos puntas.
    c.rect(3, y(6), 10, 2, MASK[1]);
    c.rect(3, y(6), 10, 1, MASK[0]);
    c.set(7, y(8), MASK[1]);
    c.set(8, y(8), MASK[0]);
    c.set(7, y(9), MASK[0]);
    c.set(9, y(9), MASK[1]);
    return;
  }
  if (face === "monocle") {
    // De espaldas solo se ve la cadenita que cuelga del costado.
    c.set(12, y(10), GOLD[0]);
    c.set(12, y(11), GOLD[1]);
    return;
  }
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
  // Patillas de las gafas a los dos lados de la cabeza. Las redondas van en el dorado claro: el oscuro
  // se pierde sobre el pelo castaño.
  const frameC =
    face === "glasses" ? GLASSES : face === "round-glasses" ? ROUND_FRAME[1] : face === "3d-glasses" ? CARD[1] : face === "star-glasses" ? GOLD[2] : SUN_FRAME;
  c.set(3, y(7), frameC);
  c.set(12, y(7), frameC);
}

