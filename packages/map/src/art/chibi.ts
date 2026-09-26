// Personajes chibi en pixel-art (estilo Stardew), vista isométrica 3/4. Se dibujan en el navegador a
// partir del Look (colores, peinado, accesorios y conjunto). Los seis personajes fijos son presets de Look.
import type { Accessory, HairStyle, HumanAvatar, Look, Outfit } from "@hyvento/shared";
import { OUT } from "./palette";
import { PixelCanvas, alpha, hex, noise, type RGBA } from "./pixel";

/** Cada frame mide 32x32; el personaje va centrado abajo con los pies en FEET_Y. */
export const FRAME = 32;
export const FEET_Y = 29;
/** Margen arriba del cuerpo para el moño y los audífonos; los pies quedan en la fila 24 + TOP. */
const TOP = 2;
const BODY_H = 26 + TOP;
/** Columnas de la hoja de caminata: quieto, paso A, paso B. */
export const FRAMES = 3;
/** Filas de la hoja (direcciones del mundo) y frames de la hoja de sentado, en este orden. */
export const SHEET_DIRECTIONS = ["down", "left", "right", "up"] as const;
export type SheetDirection = (typeof SHEET_DIRECTIONS)[number];

export interface CharacterStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** Color de la gorra, los audífonos, el gorro de lana, la bufanda y la chaqueta. */
  accent?: string;
  hairStyle?: HairStyle;
  accessories?: readonly Accessory[];
  /** Conjunto encima de la camisa y el pantalón (sin él, camisa y pantalón como siempre). */
  outfit?: Outfit;
}

/** Los seis personajes fijos. */
export const HUMANS: Record<HumanAvatar, CharacterStyle> = {
  ada: { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", hairStyle: "long" },
  bruno: { skin: "#c68642", hair: "#1b1b1b", shirt: "#2a9d8f", pants: "#3d405b", hairStyle: "short" },
  carla: { skin: "#ffdbac", hair: "#b5651d", shirt: "#8338ec", pants: "#22223b", hairStyle: "bun" },
  dario: { skin: "#8d5524", hair: "#0d0d0d", shirt: "#f4a261", pants: "#1d3557", hairStyle: "curly" },
  eva: { skin: "#e0ac69", hair: "#d4a017", shirt: "#06d6a0", pants: "#3a3a4a", hairStyle: "long" },
  fede: { skin: "#f1c27d", hair: "#6b4423", shirt: "#118ab2", pants: "#4a4e69", hairStyle: "buzz" },
};

const DARK = hex("#2b1b3a");
const LIGHT = hex("#fff2c0");
/** Colores fijos de la ropa que no sigue al Look: paja, delantal crema, cinta y flor. */
const STRAW = "#e2b95e";
const CREAM = "#f3e6c4";
const RIBBON = "#c05a4a";
const PETAL = hex("#f28fad");
const PETAL_DARK = hex("#d9607f");
const POLLEN = hex("#f4d35e");
const LEAF = hex("#5ea247");

/** Tono de un color: negativo oscurece hacia morado, positivo aclara hacia amarillo. */
function tone(base: string, k: number): RGBA {
  const c = hex(base);
  const t = Math.abs(k);
  const to = k < 0 ? DARK : LIGHT;
  return [
    Math.round(c[0] + (to[0] - c[0]) * t),
    Math.round(c[1] + (to[1] - c[1]) * t),
    Math.round(c[2] + (to[2] - c[2]) * t),
    255,
  ];
}

type Three = [RGBA, RGBA, RGBA];

interface Tones {
  skin: Three;
  hair: Three;
  shirt: Three;
  pants: [RGBA, RGBA];
  accent: Three;
  straw: Three;
  cream: Three;
  ribbon: Three;
}

const three = (h: string): Three => [tone(h, -0.3), tone(h, 0), tone(h, 0.25)];

function tones(s: CharacterStyle): Tones {
  return {
    skin: three(s.skin),
    hair: three(s.hair),
    shirt: three(s.shirt),
    pants: [tone(s.pants, -0.25), tone(s.pants, 0.1)],
    accent: three(s.accent ?? "#e0923e"),
    straw: three(STRAW),
    cream: three(CREAM),
    ribbon: three(RIBBON),
  };
}

type View = "front" | "back";
/** Fila del cuerpo → fila del canvas (con el balanceo del paso o la bajada al sentarse). */
type Row = (row: number) => number;

/**
 * Un frame de 16x28 mirando en 3/4 hacia la derecha: de frente mira al sureste (+x) y de espaldas al
 * noreste (-y). Las otras dos diagonales son estos mismos espejados.
 */
function drawBody(s: CharacterStyle, view: View, frame: 0 | 1 | 2, sit: boolean): PixelCanvas {
  const c = new PixelCanvas(16, BODY_H);
  const t = tones(s);
  const has = (a: Accessory) => s.accessories?.includes(a) ?? false;
  const style: HairStyle = s.hairStyle ?? "short";
  const outfit = s.outfit;
  // Sentado: el cuerpo baja 3 píxeles y las piernas se doblan hacia adelante.
  const drop = sit ? 3 : 0;
  const bob = sit ? 0 : frame === 0 ? 0 : 1;
  const Y = (row: number) => row + TOP;
  const y = (row: number) => row + bob + drop + TOP;
  const shoe = hex("#3a2418");
  // Con vestido se ven las piernas (piel) y, sentado, la falda sobre las rodillas.
  const legs: [RGBA, RGBA] = outfit === "dress" ? [t.skin[0], t.skin[1]] : t.pants;
  const lap: [RGBA, RGBA] = outfit === "dress" ? [t.shirt[0], t.shirt[1]] : t.pants;

  // Piernas.
  if (sit) {
    if (view === "front") {
      c.rect(5, Y(20), 7, 2, lap[1]);
      c.rect(5, Y(22), 7, 1, lap[0]);
      c.rect(10, Y(22), 3, 2, legs[0]);
      c.rect(10, Y(24), 4, 1, shoe);
    } else {
      c.rect(4, Y(20), 8, 2, lap[0]);
    }
  } else {
    const lift = (leg: 0 | 1) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1);
    for (const leg of [0, 1] as const) {
      const x = leg === 0 ? 5 : 8;
      const up = lift(leg) ? 1 : 0;
      c.rect(x, Y(19), 3, 4 - up, legs[leg === 0 ? 1 : 0]);
      c.rect(x - (leg === 0 ? 1 : 0), Y(23 - up), 4, 1, shoe);
      c.rect(x - (leg === 0 ? 1 : 0), Y(22 - up), 4, 1, leg === 0 ? hex("#5a3826") : shoe);
    }
  }

  // Brazos (se balancean al caminar). Con chaqueta, las mangas son de la chaqueta.
  const sleeve = outfit === "jacket" ? t.accent[0] : t.shirt[0];
  const swing = sit ? 0 : frame === 1 ? 1 : frame === 2 ? -1 : 0;
  c.rect(3, y(14), 1, 4 + swing, sleeve);
  c.set(3, y(18 + swing), t.skin[1]);
  c.rect(12, y(14), 1, 4 - swing, sleeve);
  c.set(12, y(18 - swing), t.skin[0]);

  // Torso.
  c.rect(4, y(13), 8, 6, t.shirt[1]);
  c.rect(11, y(13), 1, 6, t.shirt[0]);
  c.rect(5, y(13), 1, 3, t.shirt[2]);
  c.rect(4, y(18), 8, 1, t.pants[0]);
  if (view === "front") c.rect(7, y(13), 3, 1, t.shirt[2]);
  if (outfit) drawOutfit(c, outfit, t, view, sit, y, Y);

  // Cuello y cabeza.
  c.rect(7, y(12), 2, 1, t.skin[0]);
  c.rect(4, y(3), 8, 9, t.skin[1]);
  c.rect(3, y(4), 10, 7, t.skin[1]);
  c.rect(12, y(4), 1, 7, t.skin[0]);
  c.rect(4, y(11), 8, 1, t.skin[0]);

  const hr = t.hair;
  const sway = sit ? 0 : frame === 1 ? -1 : frame === 2 ? 1 : 0;
  if (view === "front") {
    // Cara: ojos de 2px, rubor y boca.
    c.rect(7, y(7), 1, 2, OUT);
    c.rect(10, y(7), 1, 2, OUT);
    c.set(7, y(7), hex("#4a3a5a"));
    c.set(6, y(9), alpha(hex("#e5707a"), 0.55));
    c.set(11, y(9), alpha(hex("#e5707a"), 0.55));
    c.set(9, y(10), t.skin[0]);
    if (has("beard")) {
      c.rect(4, y(9), 2, 3, hr[1]);
      c.rect(11, y(9), 2, 3, hr[0]);
      c.rect(5, y(11), 7, 1, hr[1]);
      c.rect(7, y(12), 3, 1, hr[0]);
      c.set(9, y(10), hr[0]);
    }
    // La bufanda va antes que el pelo: el pelo largo cae por encima.
    if (has("scarf")) drawScarf(c, t.accent, view, y);
    drawHairFront(c, style, t, y, sway);
    if (has("glasses")) {
      const frameC = hex("#1f2a44");
      for (const x of [6, 8, 9, 11]) c.set(x, y(7), frameC);
      c.set(7, y(6), frameC);
      c.set(10, y(6), frameC);
      c.set(7, y(8), alpha(hex("#bfe3ff"), 0.5));
      c.set(10, y(8), alpha(hex("#bfe3ff"), 0.5));
    }
  } else {
    drawHairBack(c, style, t, y, sway);
    // De espaldas la bufanda va encima del pelo, para que se vea.
    if (has("scarf")) drawScarf(c, t.accent, view, y);
    if (has("glasses")) {
      c.set(3, y(7), hex("#1f2a44"));
      c.set(12, y(7), hex("#1f2a44"));
    }
  }

  if (has("cap")) {
    const a = t.accent;
    c.rect(4, y(1), 8, 1, a[1]);
    c.rect(3, y(2), 10, 3, a[1]);
    c.rect(5, y(1), 3, 1, a[2]);
    c.rect(11, y(2), 2, 3, a[0]);
    if (view === "front") c.rect(8, y(5), 7, 1, a[0]);
    else c.rect(7, y(4), 2, 1, a[2]);
  }
  if (has("straw-hat")) drawStrawHat(c, t, view, y);
  if (has("beanie")) drawBeanie(c, t.accent, y);
  if (has("headphones")) {
    const a = t.accent;
    c.rect(4, y(0), 8, 1, a[0]);
    c.set(3, y(1), a[0]);
    c.set(12, y(1), a[0]);
    c.rect(2, y(5), 2, 4, a[1]);
    c.rect(12, y(5), 2, 4, a[0]);
  }
  // La flor va al final: queda sobre el pelo o prendida al sombrero.
  if (has("flower")) drawFlower(c, view === "front" ? 4 : 11, y(2));

  c.outline(OUT);
  return c;
}

/** Conjuntos encima de la camisa (el torso ya está dibujado con la camisa y el cinturón). */
function drawOutfit(c: PixelCanvas, outfit: Outfit, t: Tones, view: View, sit: boolean, y: Row, Y: Row) {
  const front = view === "front";
  if (outfit === "overalls") {
    // Overol del color del pantalón: tirantes con botones, peto y la camisa asomando arriba.
    const [p0, p1] = t.pants;
    const button = hex("#f4d35e");
    c.set(5, y(13), p1);
    c.set(10, y(13), p1);
    if (front) {
      c.rect(5, y(14), 6, 2, p1);
      c.rect(7, y(15), 2, 1, p0);
      c.set(5, y(14), button);
      c.set(10, y(14), button);
    } else {
      c.rect(5, y(14), 1, 2, p1);
      c.rect(10, y(14), 1, 2, p1);
    }
    c.rect(4, y(16), 8, 3, p1);
    c.rect(11, y(16), 1, 3, p0);
    c.rect(4, y(16), 1, 1, p0);
    return;
  }
  if (outfit === "dress") {
    // Vestido del color de la camisa: lazo en la cintura y falda con vuelo que tapa el pantalón.
    const [s0, s1, s2] = t.shirt;
    if (front) c.rect(7, y(13), 3, 1, t.skin[1]);
    c.rect(4, y(17), 8, 1, s0);
    c.rect(4, y(18), 8, 1, s1);
    c.rect(11, y(18), 1, 1, s0);
    if (sit) return;
    // La falda se abre abajo; en la fila de las manos queda angosta para no taparlas.
    c.rect(4, y(19), 8, 1, s1);
    c.rect(3, y(20), 10, 1, s1);
    c.set(11, y(19), s0);
    c.rect(11, y(20), 2, 1, s0);
    c.rect(4, y(18), 1, 2, s2);
    c.set(3, y(20), s2);
    for (const x of [6, 9]) c.set(x, y(20), s0);
    return;
  }
  if (outfit === "jacket") {
    // Chaqueta abierta del color de acento: de frente se ve la camisa en el medio.
    const [a0, a1, a2] = t.accent;
    if (front) {
      c.rect(4, y(13), 3, 6, a1);
      c.rect(10, y(13), 2, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.set(6, y(13), a2);
      c.set(10, y(13), a2);
      c.set(6, y(16), a0);
      c.set(5, y(17), a0);
    } else {
      c.rect(4, y(13), 8, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.rect(5, y(13), 6, 1, a2);
      c.rect(8, y(16), 1, 3, a0);
    }
    return;
  }
  // Delantal crema, como el de la cafetería.
  const [c0, c1, c2] = t.cream;
  if (front) {
    c.set(6, y(13), c1);
    c.set(9, y(13), c1);
    c.rect(6, y(14), 4, 2, c1);
    c.rect(6, y(14), 4, 1, c2);
    c.rect(5, y(16), 6, 3, c1);
    c.rect(10, y(16), 1, 3, c0);
    c.set(4, y(16), c0);
    c.set(11, y(16), c0);
    c.rect(7, y(17), 2, 1, c0);
    if (sit) c.rect(6, Y(20), 5, 1, c1);
    else {
      c.rect(5, y(19), 6, 2, c1);
      c.rect(10, y(19), 1, 2, c0);
      c.rect(5, y(20), 6, 1, c0);
    }
  } else {
    // De espaldas solo se ven la tira de la cintura y el lazo.
    c.rect(4, y(16), 8, 1, c1);
    c.rect(7, y(16), 2, 1, c2);
    c.set(6, y(15), c1);
    c.set(9, y(15), c1);
    c.set(7, y(17), c0);
    c.set(8, y(17), c0);
  }
}

function drawScarf(c: PixelCanvas, a: Three, view: View, y: Row) {
  c.rect(4, y(12), 8, 2, a[1]);
  c.rect(11, y(12), 1, 2, a[0]);
  c.rect(5, y(12), 2, 1, a[2]);
  c.rect(4, y(13), 8, 1, a[0]);
  if (view === "front") {
    // La punta cuelga por delante, con flecos.
    c.rect(9, y(14), 2, 2, a[1]);
    c.rect(10, y(14), 1, 2, a[0]);
    c.set(9, y(16), a[0]);
    c.set(10, y(16), a[1]);
  } else {
    c.rect(5, y(14), 2, 1, a[1]);
    c.set(5, y(15), a[0]);
  }
}

function drawStrawHat(c: PixelCanvas, t: Tones, view: View, y: Row) {
  const [s0, s1, s2] = t.straw;
  // Copa con cinta roja y un ala ancha (más larga hacia donde mira).
  c.rect(5, y(-1), 6, 1, s1);
  c.rect(4, y(0), 8, 2, s1);
  c.rect(11, y(-1), 1, 3, s0);
  c.rect(5, y(-1), 2, 2, s2);
  c.rect(4, y(2), 8, 1, t.ribbon[1]);
  c.rect(11, y(2), 1, 1, t.ribbon[0]);
  const far = view === "front" ? 14 : 13;
  c.rect(1, y(3), far, 1, s1);
  c.rect(2, y(4), far - 1, 1, s0);
  // Trenzado de la paja.
  for (let x = 2; x <= far; x += 2) c.set(x, y(3), s2);
  for (const x of [6, 9]) c.set(x, y(0), s0);
}

function drawBeanie(c: PixelCanvas, a: Three, y: Row) {
  c.rect(6, y(-1), 3, 1, a[2]);
  c.rect(5, y(0), 6, 1, a[1]);
  c.rect(4, y(1), 8, 1, a[1]);
  c.rect(3, y(2), 10, 2, a[1]);
  c.rect(11, y(1), 2, 3, a[0]);
  c.rect(5, y(1), 2, 2, a[2]);
  // Borde doblado con el tejido en canalé.
  for (let x = 3; x <= 12; x++) {
    c.set(x, y(4), x % 2 ? a[0] : a[1]);
    c.set(x, y(5), x % 2 ? a[0] : a[1]);
  }
}

function drawFlower(c: PixelCanvas, x: number, row: number) {
  c.set(x, row - 1, PETAL);
  c.set(x - 1, row, PETAL);
  c.set(x + 1, row, PETAL_DARK);
  c.set(x, row + 1, PETAL_DARK);
  c.set(x, row, POLLEN);
  c.set(x + 1, row + 1, LEAF);
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
  if (style === "afro") return drawAfro(c, hr, y, "front");
  if (style === "buzz") {
    c.rect(4, y(2), 8, 2, hr[1]);
    c.rect(3, y(3), 1, 2, hr[0]);
    c.rect(12, y(3), 1, 2, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
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
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 3, hr[1]);
  c.rect(5, y(1), 3, 1, hr[2]);
  c.rect(3, y(5), 2, 4, hr[1]);
  c.rect(5, y(5), 3, 1, hr[1]);
  c.set(8, y(5), hr[0]);
  c.rect(12, y(5), 1, 2, hr[0]);
  c.rect(4, y(2), 4, 1, hr[2]);
  if (style === "long") {
    c.rect(2, y(5), 2, 9, hr[1]);
    c.rect(12, y(6), 2, 7, hr[0]);
  }
  if (style === "bun") {
    c.rect(6, y(-1), 4, 2, hr[1]);
    c.set(7, y(-1), hr[2]);
  }
  if (style === "ponytail") {
    // Atada atrás de la cabeza (a la izquierda de frente); la punta se mece al caminar.
    c.rect(1, y(3), 2, 6, hr[1]);
    c.rect(2, y(4), 1, 5, hr[0]);
    c.set(1, y(3), hr[2]);
    c.rect(3, y(3), 1, 2, t.ribbon[1]);
    c.set(sway > 0 ? 2 : 1, y(9), hr[1]);
    if (sway < 0) c.set(0, y(9), hr[1]);
  }
  if (style === "braids") {
    braid(c, 2, 5, 12, t, y);
    braid(c, 12, 6, 11, t, y);
  }
}

function drawHairBack(c: PixelCanvas, style: HairStyle, t: Tones, y: Row, sway: number) {
  const hr = t.hair;
  if (style === "afro") return drawAfro(c, hr, y, "back");
  if (style === "buzz") {
    c.rect(4, y(2), 8, 7, hr[1]);
    c.rect(3, y(4), 10, 4, hr[1]);
    c.rect(11, y(3), 2, 5, hr[0]);
    c.rect(5, y(2), 3, 1, hr[2]);
    return;
  }
  if (style === "curly") {
    for (let x = 2; x <= 13; x++)
      for (let r = 0; r <= 11; r++) {
        const edge = r === 0 || x === 2 || x === 13 || r === 11;
        if (edge && noise(x, r, 9) < 0.45) continue;
        c.set(x, y(r), r < 3 && x < 9 ? hr[2] : x > 10 ? hr[0] : hr[1]);
      }
    return;
  }
  c.rect(4, y(1), 8, 2, hr[1]);
  c.rect(3, y(2), 10, 9, hr[1]);
  c.rect(4, y(10), 8, 2, hr[1]);
  c.rect(11, y(4), 2, 7, hr[0]);
  c.rect(5, y(2), 3, 2, hr[2]);
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

/** Copia un frame del cuerpo dentro de la celda (col, row) de una hoja, espejado si hace falta. */
function blitFrame(sheet: PixelCanvas, f: PixelCanvas, col: number, row: number, flip: boolean) {
  const ox = col * FRAME + 8;
  const oy = row * FRAME + (FEET_Y - 24 - TOP);
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
  const sheet = new PixelCanvas(FRAME * FRAMES, FRAME * SHEET_DIRECTIONS.length);
  SHEET_DIRECTIONS.forEach((dir, row) => {
    const { view, flip } = ORIENT[dir];
    ([0, 1, 2] as const).forEach((frame) => blitFrame(sheet, drawBody(s, view, frame, false), frame, row, flip));
  });
  return sheet;
}

/** Hoja de sentado: 4 frames (down, left, right, up). */
export function drawSitting(s: CharacterStyle): PixelCanvas {
  const sheet = new PixelCanvas(FRAME * SHEET_DIRECTIONS.length, FRAME);
  SHEET_DIRECTIONS.forEach((dir, col) => {
    const { view, flip } = ORIENT[dir];
    blitFrame(sheet, drawBody(s, view, 0, true), col, 0, flip);
  });
  return sheet;
}

/** Estilo de dibujo para un Look personalizado o uno de los personajes fijos. */
export function styleFor(avatar: string, look: Look | null): CharacterStyle {
  if (look) return look;
  return HUMANS[avatar as HumanAvatar] ?? HUMANS.ada;
}
