// Peinados del chibi, de frente y de espaldas (el color es el del pelo; las cintas son fijas). Lo que va
// en la cabeza tapa el pelo que quedaría por encima (ver maskHair) y se apoya en la fila que da restRow.
import type { HairStyle, HeadItem } from "@hyvento/shared";
import { alpha, noise, type PixelCanvas, type RGBA } from "../pixel";
import type { Ctx, Row, Three, Tones, View } from "./kit";

/** Pelo según la vista: de frente enmarca la cara; de espaldas tapa la nuca. */
export function drawHair({ c, t, look, view, y, sway }: Ctx) {
  const canvas = maskHair(c, look.head, look.hairStyle, y);
  if (view === "front") drawHairFront(canvas, look.hairStyle, t, y, sway);
  else drawHairBack(canvas, look.hairStyle, t, y, sway);
}

/**
 * Fila más alta del pelo en el centro de la cabeza (sin contar colitas ni trenzas). Sirve para que la
 * corona, el moño o los audífonos se apoyen en el pelo y no queden flotando sobre una cabeza rapada.
 */
export function hairTop(style: HairStyle): number {
  switch (style) {
    case "afro":
    case "mohawk":
    case "spiky":
      return -1;
    case "curly":
    case "undercut":
      return 0;
    case "buzz":
    case "bald":
      return 2;
    default:
      return 1;
  }
}

/** Fila donde se apoya lo que va encima de la cabeza (más arriba no cabe: el frame empieza en -2). */
export const restRow = (style: HairStyle) => Math.max(1, hairTop(style));

/** Peinados con un moño encima de la cabeza. */
const KNOTS: ReadonlySet<HairStyle> = new Set(["bun", "top-knot"]);

/**
 * Fila donde se apoya la corona. Es abierta arriba: con moño baja una fila y el moño asoma entero entre
 * las puntas (si no, la banda lo taparía y se vería como pelo corto).
 */
export const crownRest = (style: HairStyle) => restRow(style) + (KNOTS.has(style) ? 1 : 0);

/** Primera columna y ancho de la corona. */
export const CROWN_X = 4;
export const CROWN_W = 7;

/**
 * Lo que va en la cabeza aplasta el pelo: la gorra, el gorro, la pañoleta y el sombrero esconden lo que
 * sobresaldría por encima (la cresta, el moño, las puntas) y la corona aparta el pelo donde se sienta.
 */
/**
 * Sombreros que tapan la coronilla: el pelo por encima de esta fila no se ve (la copa lo esconde). El casco
 * de astronauta encierra la cabeza entera.
 */
export const HAT_HIDES: Partial<Record<HeadItem, number>> = {
  cap: 1,
  beanie: 1,
  bandana: 1,
  "straw-hat": 3,
  "chef-hat": 1,
  "top-hat": 2,
  "fire-helmet": 3,
  "hard-hat": 2,
  "rain-hat": 3,
  "sailor-hat": 2,
  "bee-hat": 2,
  "space-helmet": 99,
  beret: 1,
  "bucket-hat": 3,
  vueltiao: 3,
  nightcap: 1,
  "pompom-beanie": 1,
  "pirate-hat": 2,
  "wizard-hat": 3,
};

function maskHair(c: PixelCanvas, head: HeadItem, style: HairStyle, y: Row): PixelCanvas {
  let hide: ((x: number, r: number) => boolean) | null = null;
  const hat = HAT_HIDES[head];
  if (hat !== undefined) hide = (_x, r) => r < hat;
  else if (head === "crown" && !KNOTS.has(style)) {
    // Arriba de la banda se ve el fondo entre las puntas (con una columna de margen a la sombra). Con moño
    // no se esconde nada: el moño es lo único que pasa por encima de la banda y tiene que asomar.
    const band = crownRest(style) - 1;
    hide = (x, r) => x >= CROWN_X && x <= CROWN_X + CROWN_W && r < band;
  }
  if (!hide) return c;
  const test = hide;
  const masked = Object.create(c) as PixelCanvas;
  masked.set = (x: number, cy: number, col: RGBA) => {
    if (!test(Math.floor(x), Math.floor(cy) - y(0))) c.set(x, cy, col);
  };
  return masked;
}

/** Coronilla común (como el corto): de la fila 1 a la 4. */
function dome(c: PixelCanvas, hr: Three, y: Row, shine = true) {
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  if (!shine) return;
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(4, y(2), 4, 1, hr[2]);
}

/** Nuca común de espaldas (como el corto), hasta la fila 11. */
function backDome(c: PixelCanvas, hr: Three, y: Row, shine = true) {
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 9, hr[1]);
  c.rect(4, y(10), 8, 2, hr[1]);
  c.rect(11, y(4), 2, 7, hr[0]);
  if (shine) c.rect(5, y(2), 3, 2, hr[2]);
}

/**
 * Cuero cabelludo rapado: el pelo apenas tiñe la piel, salpicado para que se lea como pelo cortito. De
 * espaldas empieza en la fila `from` (el copete del rapado a los lados tapa lo de arriba).
 */
function shaved(c: PixelCanvas, hr: Three, y: Row, view: View, from = 3) {
  const fuzz = (x: number, r: number) => c.set(x, y(r), alpha(hr[0], (x + r) % 2 ? 0.45 : 0.25));
  const row = (x0: number, x1: number, r: number) => {
    for (let x = x0; x <= x1; x++) fuzz(x, r);
  };
  if (view === "front") {
    row(4, 11, 3);
    row(3, 12, 4);
    for (let r = 5; r <= 7; r++) row(3, 4, r);
    fuzz(12, 5);
    return;
  }
  for (let r = from; r <= 10; r++) {
    if (r === 3) row(4, 11, 3);
    else if (r === 10) row(4, 11, 10);
    else row(3, 12, r);
  }
}

/** Orejas: solo se ven con la cabeza rapada. */
function ears(c: PixelCanvas, t: Tones, y: Row, view: View) {
  c.rect(2, y(7), 1, 2, t.skin[1]);
  c.set(3, y(8), t.skin[0]);
  if (view === "back") {
    c.rect(13, y(7), 1, 2, t.skin[0]);
    c.set(12, y(8), t.skin[0]);
  }
}

/** Trenza de 2px de ancho: el tejido alterna tonos fila por fila. */
function braid(c: PixelCanvas, x: number, from: number, to: number, t: Tones, y: Row) {
  const hr = t.hair;
  for (let r = from; r <= to; r++) {
    c.set(x, y(r), r % 2 ? hr[1] : hr[2]);
    c.set(x + 1, y(r), r % 2 ? hr[0] : hr[1]);
  }
  c.rect(x, y(to + 1), 2, 1, t.ribbon[1]);
  c.set(x + (to % 2), y(to + 2), hr[1]);
}

/**
 * Rasta de 2px: un cordón con nudos cada tres filas y la punta redonda (que se mece al caminar). El lado
 * derecho va siempre a la sombra para que cada cordón se lea separado del de al lado.
 * `dark` la deja a la sombra (las de atrás o del lado derecho).
 */
function loc(c: PixelCanvas, x: number, from: number, to: number, hr: Three, y: Row, sway: number, dark = false) {
  const lit = dark ? hr[1] : hr[2];
  const mid = dark ? hr[0] : hr[1];
  for (let r = from; r <= to; r++) {
    // Los nudos se escalonan según la columna para que no formen filas parejas.
    const k = (r - from + x) % 3;
    c.set(x, y(r), k === 2 ? hr[0] : k === 0 ? lit : mid);
    c.set(x + 1, y(r), hr[0]);
  }
  c.set(x + (sway > 0 ? 1 : 0), y(to + 1), mid);
}

/**
 * Colita atada con cinta arriba, a un costado de la cabeza: cae hasta debajo de la mandíbula (ahí se
 * separa del cuello y se lee como colita) y la punta se mece al caminar.
 */
function tail(c: PixelCanvas, x: number, hr: Three, t: Tones, y: Row, sway: number, dark: boolean) {
  const [lo, mid, hi] = dark ? [hr[0], hr[0], hr[1]] : [hr[0], hr[1], hr[2]];
  c.rect(x, y(3), 2, 2, t.ribbon[1]);
  c.set(dark ? x + 1 : x, y(4), t.ribbon[0]);
  c.rect(x, y(5), 2, 6, mid);
  c.rect(x + 1, y(6), 1, 5, lo);
  c.set(x, y(5), hi);
  c.set(x, y(6), hi);
  // Punta: de pie ocupa las dos columnas; al caminar se corre hacia donde se mece.
  const tip = sway > 0 ? x + 1 : x;
  if (sway === 0) {
    c.set(x, y(11), mid);
    c.set(x + 1, y(11), lo);
  } else c.set(tip, y(11), lo);
  c.set(tip, y(12), lo);
}

/** Afro: una nube redonda de rizos; de frente deja ver la cara. */
function drawAfro(c: PixelCanvas, hr: Three, y: Row, view: View) {
  const bottom = view === "front" ? 9 : 10;
  // De espaldas tapa toda la cabeza (la nuca queda a la sombra); los bultos del borde no dejan ver piel.
  if (view === "back") c.rect(3, y(3), 10, 9, hr[0]);
  for (let x = 1; x <= 14; x++)
    for (let r = -1; r <= bottom; r++) {
      const dx = (x + 0.5 - 8) / 6.9;
      const dy = (r + 0.5 - 4) / 5.6;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      if (view === "front" && x >= 5 && r >= 5) continue;
      // Borde con bultos para que se vea esponjado.
      if (d > 0.78 && noise(x, r, 13) < 0.4) continue;
      const shade = r < 2 && x < 8 ? hr[2] : x > 11 || r > 7 ? hr[0] : hr[1];
      c.set(x, y(r), noise(x, r, 21) < 0.12 ? hr[0] : shade);
    }
  if (view === "front") c.rect(5, y(4), 7, 1, hr[1]);
}

function drawHairFront(c: PixelCanvas, style: HairStyle, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  switch (style) {
    case "afro":
      return drawAfro(c, hr, y, "front");
    case "buzz":
      c.rect(4, y(2), 8, 2, hr[1]);
      c.rect(3, y(3), 1, 2, hr[0]);
      c.rect(12, y(3), 1, 2, hr[0]);
      c.rect(5, y(2), 3, 1, hr[2]);
      return;
    case "curly":
      for (let x = 2; x <= 13; x++)
        for (let r = 0; r <= 5; r++) {
          const edge = r === 0 || x === 2 || x === 13;
          if (edge && noise(x, r, 5) < 0.45) continue;
          c.set(x, y(r), r < 2 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
        }
      c.rect(2, y(6), 2, 4, hr[1]);
      c.rect(12, y(6), 2, 3, hr[0]);
      for (const [x, r] of [
        [3, 1],
        [6, 0],
        [9, 1],
        [12, 2],
        [4, 4],
      ] as const)
        c.set(x, y(r), hr[0]);
      return;
    case "bald":
      return drawBald(c, t, y, "front");
    case "mohawk":
      return drawMohawkFront(c, t, y);
    case "undercut":
      return drawUndercutFront(c, t, y);
    case "bangs":
      return drawBangsFront(c, hr, y);
    case "side-part":
      return drawSidePartFront(c, hr, y);
    case "wavy":
      return drawWavyFront(c, hr, y, sway);
    case "spiky":
      return drawSpikyFront(c, hr, y);
    case "bob":
      return drawBobFront(c, hr, y);
    case "dreads":
      return drawDreadsFront(c, hr, y, sway);
    case "top-knot":
      return drawTopKnotFront(c, t, y);
    case "mullet":
      return drawMulletFront(c, hr, y, sway);
    case "pigtails":
      drawShortFront(c, hr, y, false);
      tail(c, 1, hr, t, y, sway, false);
      tail(c, 13, hr, t, y, sway, true);
      return;
  }
  drawShortFront(c, hr, y, true);
  if (style === "long") {
    c.rect(2, y(5), 2, 9, hr[1]);
    c.rect(12, y(6), 2, 7, hr[0]);
  }
  if (style === "bun") {
    c.rect(6, y(-1), 4, 2, hr[1]);
    c.set(7, y(-1), hr[2]);
  }
  if (style === "ponytail") {
    // Atada atrás de la cabeza (a la izquierda de frente); la punta se mece al caminar. No pasa de x = 1:
    // en la columna 0 no cabría el contorno.
    c.rect(1, y(3), 2, 6, hr[1]);
    c.rect(2, y(4), 1, 5, hr[0]);
    c.set(1, y(3), hr[2]);
    c.rect(3, y(3), 1, 2, t.ribbon[1]);
    if (sway <= 0) c.set(1, y(9), hr[1]);
    if (sway >= 0) c.set(2, y(9), hr[0]);
  }
  if (style === "braids") {
    braid(c, 2, 5, 12, t, y);
    braid(c, 12, 6, 11, t, y);
  }
}

/** El corto de frente (la base de varios peinados). `sides` alarga el pelo del lado de atrás. */
function drawShortFront(c: PixelCanvas, hr: Three, y: Row, sides: boolean) {
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(3, y(5), 2, sides ? 4 : 2, hr[1]);
  c.rect(5, y(5), 3, 1, hr[1]);
  c.set(8, y(5), hr[0]);
  c.rect(12, y(5), 1, 2, hr[0]);
  c.rect(4, y(2), 4, 1, hr[2]);
}

function drawHairBack(c: PixelCanvas, style: HairStyle, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  switch (style) {
    case "afro":
      return drawAfro(c, hr, y, "back");
    case "buzz":
      c.rect(4, y(2), 8, 7, hr[1]);
      c.rect(3, y(4), 10, 4, hr[1]);
      c.rect(11, y(3), 2, 5, hr[0]);
      c.rect(5, y(2), 3, 1, hr[2]);
      return;
    case "curly":
      for (let x = 2; x <= 13; x++)
        for (let r = 0; r <= 11; r++) {
          const edge = r === 0 || x === 2 || x === 13 || r === 11;
          if (edge && noise(x, r, 9) < 0.45) continue;
          c.set(x, y(r), r < 3 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
        }
      return;
    case "bald":
      return drawBald(c, t, y, "back");
    case "mohawk":
      return drawMohawkBack(c, t, y);
    case "undercut":
      return drawUndercutBack(c, t, y);
    case "bangs":
      return drawBangsBack(c, hr, y);
    case "side-part":
      return drawSidePartBack(c, hr, y);
    case "wavy":
      return drawWavyBack(c, hr, y, sway);
    case "spiky":
      return drawSpikyBack(c, hr, y);
    case "bob":
      return drawBobBack(c, hr, y);
    case "dreads":
      return drawDreadsBack(c, hr, y, sway);
    case "top-knot":
      return drawTopKnotBack(c, t, y);
    case "mullet":
      return drawMulletBack(c, hr, y, sway);
    case "pigtails":
      return drawPigtailsBack(c, t, y, sway);
  }
  backDome(c, hr, y);
  if (style === "long") c.rect(3, y(11), 10, 4, hr[1]);
  if (style === "bun") {
    c.rect(6, y(0), 4, 3, hr[1]);
    c.set(7, y(0), hr[2]);
    c.rect(6, y(3), 4, 1, hr[0]);
  }
  if (style === "ponytail") {
    // Cinta en la nuca y la cola cayendo por la espalda (con sombra a los lados para que se lea).
    c.rect(7, y(6), 2, 1, t.ribbon[1]);
    c.rect(6, y(7), 4, 4, hr[1]);
    c.rect(6, y(7), 1, 4, hr[0]);
    c.rect(9, y(7), 1, 4, hr[0]);
    c.rect(7, y(7), 1, 2, hr[2]);
    c.rect(7, y(11), 2, 3, hr[1]);
    c.rect(8, y(11), 1, 3, hr[0]);
    c.set(sway > 0 ? 8 : 7, y(14), hr[1]);
  }
  if (style === "braids") {
    braid(c, 4, 10, 14, t, y);
    braid(c, 10, 10, 14, t, y);
  }
}

// ---------------------------------------------------------------------------------------------------
// Peinados del creador de personajes.

/** Calvo: la cabeza redonda con un brillo de luz arriba y las orejas a la vista. */
function drawBald(c: PixelCanvas, t: Tones, y: Row, view: View) {
  const [s0, s1, s2] = t.skin;
  c.rect(5, y(2), 6, 1, s1);
  c.set(10, y(2), s0);
  c.set(11, y(3), s0);
  // Brillo: una luz grande y un punto casi blanco.
  c.rect(5, y(2), 3, 1, s2);
  c.set(5, y(3), s2);
  c.set(6, y(2), SHINE);
  ears(c, t, y, view);
  // De espaldas, la nuca a la sombra.
  if (view === "back") c.rect(4, y(10), 8, 1, s0);
}

const SHINE = alpha([255, 250, 235, 255], 0.7);

/** Cresta: lados rapados y una aleta de puntas que va de la frente a la nuca. */
function drawMohawkFront(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  shaved(c, hr, y, "front");
  ears(c, t, y, "front");
  // La aleta, vista de lado: tres puntas inclinadas hacia atrás y la base a la sombra.
  for (const x of [4, 6, 8]) c.set(x, y(-1), hr[x < 8 ? 2 : 1]);
  c.rect(4, y(0), 6, 1, hr[1]);
  c.rect(4, y(0), 2, 1, hr[2]);
  c.rect(5, y(1), 6, 1, hr[1]);
  c.set(5, y(1), hr[2]);
  c.rect(6, y(2), 5, 1, hr[1]);
  c.rect(7, y(3), 4, 1, hr[0]);
  c.set(9, y(0), hr[0]);
  c.set(10, y(1), hr[0]);
  c.set(10, y(2), hr[0]);
  c.set(7, y(1), hr[2]);
  c.set(8, y(2), hr[2]);
}

function drawMohawkBack(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  shaved(c, hr, y, "back");
  ears(c, t, y, "back");
  // La cresta baja por el medio de la nuca; arriba se abre en puntas.
  c.rect(7, y(1), 2, 10, hr[1]);
  c.rect(8, y(1), 1, 10, hr[0]);
  c.set(7, y(1), hr[2]);
  c.set(7, y(2), hr[2]);
  c.rect(6, y(0), 4, 2, hr[1]);
  c.set(6, y(0), hr[2]);
  c.set(9, y(1), hr[0]);
  c.set(6, y(-1), hr[2]);
  c.set(9, y(-1), hr[1]);
}

/** Rapado a los lados: arriba un copete largo peinado hacia adelante. */
function drawUndercutFront(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  shaved(c, hr, y, "front");
  ears(c, t, y, "front");
  c.rect(5, y(0), 6, 1, hr[1]);
  c.rect(4, y(1), 9, 1, hr[1]);
  c.rect(4, y(2), 10, 1, hr[1]);
  c.rect(6, y(3), 8, 1, hr[1]);
  c.rect(6, y(0), 3, 1, hr[2]);
  c.rect(5, y(1), 3, 1, hr[2]);
  // El copete cae hacia la frente (a la derecha) y por debajo queda a la sombra.
  c.rect(10, y(4), 3, 1, hr[0]);
  c.rect(12, y(1), 1, 3, hr[0]);
  c.set(13, y(3), hr[0]);
  c.set(9, y(2), hr[2]);
  c.set(10, y(3), hr[2]);
}

function drawUndercutBack(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  shaved(c, hr, y, "back", 5);
  ears(c, t, y, "back");
  c.rect(5, y(0), 6, 1, hr[1]);
  c.rect(4, y(1), 8, 1, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(3, y(4), 10, 1, hr[0]);
  c.rect(11, y(2), 2, 2, hr[0]);
  c.rect(5, y(1), 4, 1, hr[2]);
  c.rect(6, y(0), 2, 1, hr[2]);
}

/** Flequillo recto hasta las cejas, con la punta de algunos mechones más oscura. */
function drawBangsFront(c: PixelCanvas, hr: Three, y: Row) {
  dome(c, hr, y);
  c.rect(3, y(5), 10, 1, hr[1]);
  c.rect(4, y(6), 8, 1, hr[1]);
  for (const x of [6, 9]) c.set(x, y(6), hr[0]);
  c.rect(3, y(5), 2, 5, hr[1]);
  c.set(4, y(9), hr[0]);
  c.rect(12, y(5), 1, 3, hr[0]);
}

function drawBangsBack(c: PixelCanvas, hr: Three, y: Row) {
  backDome(c, hr, y);
  // Corte recto en la nuca.
  c.rect(4, y(12), 8, 1, hr[0]);
  c.rect(4, y(11), 7, 1, hr[1]);
}

/** De lado: raya a la izquierda y el pelo barrido hacia la frente, con volumen del lado barrido. */
function drawSidePartFront(c: PixelCanvas, hr: Three, y: Row) {
  dome(c, hr, y, false);
  c.rect(7, y(0), 4, 1, hr[1]);
  c.set(12, y(1), hr[0]);
  // Raya y barrido: la luz sigue la dirección del peinado.
  c.rect(4, y(1), 1, 2, hr[0]);
  c.rect(5, y(1), 2, 1, hr[2]);
  c.rect(7, y(0), 2, 1, hr[2]);
  c.rect(6, y(2), 4, 1, hr[2]);
  c.rect(8, y(3), 3, 1, hr[2]);
  c.rect(3, y(5), 2, 3, hr[1]);
  c.rect(7, y(5), 6, 1, hr[1]);
  c.rect(9, y(6), 4, 1, hr[1]);
  c.set(12, y(7), hr[0]);
  c.set(9, y(6), hr[0]);
  c.set(12, y(6), hr[0]);
}

function drawSidePartBack(c: PixelCanvas, hr: Three, y: Row) {
  backDome(c, hr, y, false);
  c.rect(7, y(0), 4, 1, hr[1]);
  c.set(10, y(0), hr[0]);
  // La raya corre de adelante hacia atrás por el lado izquierdo; el pelo se va hacia la derecha.
  c.rect(5, y(1), 1, 4, hr[0]);
  c.rect(6, y(1), 3, 1, hr[2]);
  c.rect(7, y(0), 2, 1, hr[2]);
  c.rect(7, y(2), 3, 1, hr[2]);
  c.set(4, y(3), hr[2]);
}

/** Ondulado hasta los hombros: el borde de afuera va y viene. */
function drawWavyFront(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  drawShortFront(c, hr, y, true);
  for (let r = 5; r <= 13; r++) {
    const out = Math.floor((r - 5) / 2) % 2 === 0 ? 2 : 1;
    const inner = r <= 9 ? 4 : 3;
    c.rect(out, y(r), inner - out + 1, 1, hr[1]);
    if (out === 1 && r % 2 === 0) c.set(1, y(r), hr[2]);
  }
  for (let r = 6; r <= 12; r++) {
    const out = Math.floor((r - 6) / 2) % 2 === 0 ? 13 : 14;
    c.rect(12, y(r), out - 11, 1, hr[0]);
  }
  c.set(sway > 0 ? 3 : 2, y(14), hr[1]);
}

function drawWavyBack(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  backDome(c, hr, y);
  c.rect(3, y(11), 10, 3, hr[1]);
  for (let r = 4; r <= 13; r++) {
    const wave = Math.floor((r - 4) / 2) % 2 === 0;
    c.set(wave ? 2 : 3, y(r), hr[1]);
    c.set(wave ? 13 : 12, y(r), hr[0]);
  }
  c.rect(11, y(11), 2, 3, hr[0]);
  // Ondas: líneas de luz alternadas y el borde de abajo festoneado (se mece al caminar).
  c.rect(4, y(6), 2, 1, hr[2]);
  c.rect(8, y(7), 2, 1, hr[2]);
  c.rect(5, y(10), 2, 1, hr[2]);
  c.rect(9, y(11), 1, 1, hr[2]);
  const s = sway > 0 ? 1 : 0;
  for (const x of [3, 6, 9]) c.rect(x + s, y(14), 2, 1, x === 9 ? hr[0] : hr[1]);
}

/** En punta: púas arriba y un flequillo de picos. */
function drawSpikyFront(c: PixelCanvas, hr: Three, y: Row) {
  dome(c, hr, y);
  // Púas hacia arriba, inclinadas hacia atrás.
  for (const x of [4, 7, 10]) {
    c.set(x, y(-1), x < 9 ? hr[2] : hr[1]);
    c.rect(x, y(0), 2, 1, x < 9 ? hr[1] : hr[0]);
  }
  c.set(2, y(2), hr[1]);
  c.set(13, y(3), hr[0]);
  // Flequillo de picos que apuntan hacia abajo.
  c.rect(3, y(5), 2, 3, hr[1]);
  c.set(3, y(8), hr[1]);
  c.rect(5, y(5), 2, 1, hr[1]);
  c.set(5, y(6), hr[1]);
  c.rect(8, y(5), 2, 1, hr[1]);
  c.set(8, y(6), hr[0]);
  c.rect(11, y(5), 2, 1, hr[0]);
  c.set(12, y(6), hr[0]);
}

function drawSpikyBack(c: PixelCanvas, hr: Three, y: Row) {
  backDome(c, hr, y);
  for (const x of [4, 7, 10]) {
    c.set(x, y(-1), x < 9 ? hr[2] : hr[1]);
    c.rect(x, y(0), 2, 1, x < 9 ? hr[1] : hr[0]);
  }
  c.set(2, y(4), hr[1]);
  c.set(2, y(7), hr[1]);
  c.set(13, y(5), hr[0]);
  c.set(13, y(8), hr[0]);
  // Picos en la nuca.
  for (const x of [5, 8, 10]) c.set(x, y(12), x > 9 ? hr[0] : hr[1]);
}

/** Bob: melena redonda hasta la mandíbula con las puntas hacia adentro. */
function drawBobFront(c: PixelCanvas, hr: Three, y: Row) {
  c.rect(4, y(1), 8, 1, hr[1]);
  c.rect(3, y(2), 10, 1, hr[1]);
  c.rect(2, y(3), 12, 2, hr[1]);
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(3, y(2), 4, 1, hr[2]);
  c.set(3, y(3), hr[2]);
  // Flequillo de lado y los dos costados.
  c.rect(4, y(5), 6, 1, hr[1]);
  c.set(10, y(5), hr[0]);
  c.rect(2, y(5), 3, 6, hr[1]);
  c.rect(4, y(6), 1, 4, hr[0]);
  c.rect(3, y(11), 3, 1, hr[1]);
  c.set(5, y(11), hr[0]);
  c.set(2, y(10), hr[0]);
  c.rect(12, y(5), 2, 5, hr[0]);
  c.rect(11, y(10), 2, 1, hr[0]);
  c.rect(13, y(3), 1, 2, hr[0]);
}

function drawBobBack(c: PixelCanvas, hr: Three, y: Row) {
  c.rect(4, y(1), 8, 1, hr[1]);
  c.rect(3, y(2), 10, 1, hr[1]);
  c.rect(2, y(3), 12, 8, hr[1]);
  c.rect(3, y(11), 10, 1, hr[1]);
  c.rect(12, y(3), 2, 8, hr[0]);
  c.rect(11, y(11), 2, 1, hr[0]);
  c.rect(4, y(2), 4, 2, hr[2]);
  // Las puntas se meten hacia adentro: sombra abajo.
  c.rect(4, y(12), 8, 1, hr[0]);
  c.rect(3, y(10), 1, 1, hr[1]);
}

/** Rastas: cordones con nudos que cuelgan a los lados. */
function drawDreadsFront(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  dome(c, hr, y);
  // Raíces: cada rasta sale de un puntito.
  for (const [x, r] of [
    [6, 3],
    [9, 2],
    [11, 4],
    [4, 4],
  ] as const)
    c.set(x, y(r), hr[0]);
  // Algunas caen sobre la frente.
  loc(c, 5, 5, 5, hr, y, 0);
  c.set(8, y(5), hr[0]);
  loc(c, 1, 5, 12, hr, y, sway);
  loc(c, 3, 5, 9, hr, y, 0);
  loc(c, 12, 5, 11, hr, y, sway, true);
}

function drawDreadsBack(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(5, y(2), 3, 1, hr[2]);
  c.rect(11, y(3), 2, 2, hr[0]);
  // Cinco cordones de largos distintos (los del lado derecho a la sombra).
  loc(c, 3, 5, 12, hr, y, sway);
  loc(c, 5, 5, 13, hr, y, sway);
  loc(c, 7, 5, 13, hr, y, -sway);
  loc(c, 9, 5, 12, hr, y, sway, true);
  loc(c, 11, 5, 11, hr, y, -sway, true);
}

/** Moño alto: el pelo tirante hacia arriba (sin flequillo) y un moño grande con su amarre. */
function drawTopKnotFront(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(3, y(4), 1, 3, hr[0]);
  c.set(12, y(4), hr[0]);
  // Líneas del peinado que suben hacia el moño (atrás, a la izquierda).
  c.set(11, y(4), hr[0]);
  c.set(10, y(3), hr[0]);
  c.set(9, y(2), hr[0]);
  c.set(8, y(4), hr[2]);
  c.set(7, y(3), hr[2]);
  c.set(6, y(2), hr[2]);
  knot(c, 4, hr, t, y);
}

/** El moño (5 x 3) con el amarre de cinta abajo. */
function knot(c: PixelCanvas, x: number, hr: Three, t: Tones, y: Row) {
  c.rect(x + 1, y(-1), 3, 1, hr[1]);
  c.rect(x, y(0), 5, 1, hr[1]);
  c.set(x + 1, y(-1), hr[2]);
  c.rect(x, y(0), 2, 1, hr[2]);
  c.set(x + 4, y(0), hr[0]);
  c.set(x + 3, y(-1), hr[0]);
  c.rect(x + 1, y(1), 3, 1, t.ribbon[1]);
  c.set(x + 3, y(1), t.ribbon[0]);
}

function drawTopKnotBack(c: PixelCanvas, t: Tones, y: Row) {
  const hr = t.hair;
  backDome(c, hr, y, false);
  // Líneas que suben de la nuca hacia el moño.
  for (const [x, r] of [
    [4, 9],
    [4, 8],
    [5, 7],
    [5, 6],
    [6, 5],
    [6, 4],
    [7, 3],
  ] as const)
    c.set(x, y(r), hr[2]);
  for (const [x, r] of [
    [10, 7],
    [10, 6],
    [9, 5],
    [9, 4],
    [8, 3],
  ] as const)
    c.set(x, y(r), hr[0]);
  knot(c, 5, hr, t, y);
}

/** Mullet: corto adelante y largo atrás (se asoma detrás del cuello). */
function drawMulletFront(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  drawShortFront(c, hr, y, false);
  c.set(6, y(0), hr[1]);
  c.set(9, y(0), hr[0]);
  c.rect(2, y(7), 2, 5, hr[1]);
  c.rect(3, y(9), 1, 3, hr[0]);
  c.set(2, y(7), hr[2]);
  // La punta se abre hacia afuera y se mece al caminar.
  const s = sway > 0 ? 1 : 0;
  c.rect(1 + s, y(12), 2, 1, hr[1]);
  c.set(2 + s, y(12), hr[0]);
  c.set(1 + s, y(13), hr[1]);
}

function drawMulletBack(c: PixelCanvas, hr: Three, y: Row, sway: number) {
  backDome(c, hr, y);
  // Largo atrás, más angosto que el pelo largo, con mechones y las puntas hacia afuera.
  c.rect(4, y(11), 8, 3, hr[1]);
  c.rect(10, y(11), 2, 3, hr[0]);
  for (const x of [6, 9]) c.rect(x, y(12), 1, 2, hr[0]);
  const s = sway > 0 ? 1 : 0;
  c.set(3 + s, y(14), hr[1]);
  c.set(11 + s, y(14), hr[0]);
  c.rect(5, y(14), 2, 1, hr[1]);
  c.rect(8, y(14), 2, 1, hr[1]);
}

/** Dos colitas: raya al medio y una colita a cada lado. */
function drawPigtailsBack(c: PixelCanvas, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 8, hr[1]);
  c.rect(4, y(10), 8, 1, hr[1]);
  c.rect(11, y(4), 2, 6, hr[0]);
  c.rect(4, y(2), 3, 2, hr[2]);
  c.rect(7, y(1), 1, 9, hr[0]);
  tail(c, 1, hr, t, y, sway, false);
  tail(c, 13, hr, t, y, sway, true);
}
