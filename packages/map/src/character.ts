// Personajes en pixel-art: 3 frames (quieto, paso A, paso B) x 4 filas (abajo, izq, der, arriba),
// más 2 frames sentado (de frente y de espaldas). Se dibujan igual en Node (los personajes fijos,
// ver scripts/generate.ts) y en el navegador (los personalizados).
import type { Accessory, HairStyle } from "@hyvento/shared";
import { Canvas, hex, shade, type RGBA } from "./pixels";

export const FRAME = 32;
export const FRAMES = 3;
export const DIRECTIONS = ["down", "left", "right", "up"] as const;
/** Frames de "sentado" en este orden. */
export const SIT_FACINGS = ["down", "up"] as const;

export interface CharacterStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  /** Color de la gorra y los audífonos. */
  accent?: string;
  hairStyle?: HairStyle;
  accessories?: readonly Accessory[];
}

/** Los seis personajes fijos (pelo corto, sin accesorios). */
export const HUMANS: Record<string, CharacterStyle> = {
  ada: { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653" },
  bruno: { skin: "#c68642", hair: "#1b1b1b", shirt: "#2a9d8f", pants: "#3d405b" },
  carla: { skin: "#ffdbac", hair: "#b5651d", shirt: "#8338ec", pants: "#22223b" },
  dario: { skin: "#8d5524", hair: "#0d0d0d", shirt: "#f4a261", pants: "#1d3557" },
  eva: { skin: "#e0ac69", hair: "#d4a017", shirt: "#06d6a0", pants: "#3a3a4a" },
  fede: { skin: "#f1c27d", hair: "#6b4423", shirt: "#118ab2", pants: "#4a4e69" },
};

const OUT = hex("#1b1b24");
const SHOE = hex("#2a2a33");
const LENS_FRAME = hex("#1f2a44");

type View = "front" | "back" | "side";

/** Estilo con los colores ya convertidos. */
interface Ink {
  skin: RGBA;
  hair: RGBA;
  shirt: RGBA;
  pants: RGBA;
  accent: RGBA;
  hairStyle: HairStyle;
  has: (a: Accessory) => boolean;
}

function ink(s: CharacterStyle): Ink {
  const accessories = new Set(s.accessories ?? []);
  return {
    skin: hex(s.skin),
    hair: hex(s.hair),
    shirt: hex(s.shirt),
    pants: hex(s.pants),
    accent: hex(s.accent ?? "#0078bf"),
    hairStyle: s.hairStyle ?? "short",
    has: (a) => accessories.has(a),
  };
}

function drawFront(c: Canvas, ox: number, oy: number, k: Ink, frame: number, back: boolean) {
  const bob = frame === 0 ? 0 : -1;

  c.ellipse(ox + 16, oy + 29, 7, 2, [0, 0, 0, 70]);

  // Piernas: en cada paso una pierna se levanta.
  const liftL = frame === 1 ? 1 : 0;
  const liftR = frame === 2 ? 1 : 0;
  c.rect(ox + 12, oy + 22 + bob, 3, 5 - liftL, k.pants);
  c.rect(ox + 17, oy + 22 + bob, 3, 5 - liftR, k.pants);
  c.rect(ox + 12, oy + 27 + bob - liftL, 3, 2, SHOE);
  c.rect(ox + 17, oy + 27 + bob - liftR, 3, 2, SHOE);

  // Torso y brazos (el brazo contrario a la pierna levantada avanza).
  c.rect(ox + 10, oy + 14 + bob, 12, 9, k.shirt);
  c.rect(ox + 10, oy + 14 + bob, 12, 1, shade(k.shirt, 0.2));
  const armL = frame === 2 ? -1 : 0;
  const armR = frame === 1 ? -1 : 0;
  c.rect(ox + 8, oy + 15 + bob + armL, 2, 6, shade(k.shirt, -0.2));
  c.rect(ox + 22, oy + 15 + bob + armR, 2, 6, shade(k.shirt, -0.2));
  c.rect(ox + 8, oy + 21 + bob + armL, 2, 2, k.skin);
  c.rect(ox + 22, oy + 21 + bob + armR, 2, 2, k.skin);

  drawHead(c, ox, oy + bob, k, back ? "back" : "front");
  c.outline(ox, oy, FRAME, FRAME, OUT);
}

function drawSide(c: Canvas, ox: number, oy: number, k: Ink, frame: number) {
  // Mirando a la izquierda. La derecha se obtiene espejando.
  const bob = frame === 0 ? 0 : -1;

  c.ellipse(ox + 16, oy + 29, 6, 2, [0, 0, 0, 70]);

  const stride = frame === 0 ? 0 : 2;
  const front = frame === 1 ? -stride : stride;
  c.rect(ox + 14 + front, oy + 22 + bob, 3, 5, shade(k.pants, -0.15));
  c.rect(ox + 14 - front, oy + 22 + bob, 3, 5, k.pants);
  c.rect(ox + 13 + front, oy + 27 + bob, 4, 2, SHOE);
  c.rect(ox + 13 - front, oy + 27 + bob, 4, 2, SHOE);

  c.rect(ox + 12, oy + 14 + bob, 8, 9, k.shirt);
  c.rect(ox + 12, oy + 14 + bob, 8, 1, shade(k.shirt, 0.2));
  const swing = frame === 0 ? 0 : frame === 1 ? 2 : -2;
  c.rect(ox + 15 + swing, oy + 15 + bob, 2, 6, shade(k.shirt, -0.2));
  c.rect(ox + 15 + swing, oy + 21 + bob, 2, 2, k.skin);

  drawHead(c, ox, oy + bob, k, "side");
  c.outline(ox, oy, FRAME, FRAME, OUT);
}

/**
 * Persona sentada, más baja que de pie. De frente (mirando hacia abajo) se ven los muslos y los
 * zapatos; de espaldas (mirando hacia arriba) la silla tapa las piernas.
 */
function drawSit(c: Canvas, ox: number, oy: number, k: Ink, back: boolean) {
  const sink = 4; // cuánto baja el cuerpo al sentarse

  if (!back) {
    c.rect(ox + 11, oy + 24 + sink, 10, 2, k.pants); // muslos hacia adelante
    c.rect(ox + 12, oy + 26 + sink, 3, 2, SHOE);
    c.rect(ox + 17, oy + 26 + sink, 3, 2, SHOE);
  }
  c.rect(ox + 10, oy + 14 + sink, 12, 10, k.shirt);
  c.rect(ox + 10, oy + 14 + sink, 12, 1, shade(k.shirt, 0.2));
  c.rect(ox + 8, oy + 15 + sink, 2, 6, shade(k.shirt, -0.2));
  c.rect(ox + 22, oy + 15 + sink, 2, 6, shade(k.shirt, -0.2));
  // Manos sobre las piernas (de frente) o a los lados (de espaldas).
  if (back) {
    c.rect(ox + 8, oy + 21 + sink, 2, 2, k.skin);
    c.rect(ox + 22, oy + 21 + sink, 2, 2, k.skin);
  } else {
    c.rect(ox + 10, oy + 22 + sink, 3, 2, k.skin);
    c.rect(ox + 19, oy + 22 + sink, 3, 2, k.skin);
  }
  drawHead(c, ox, oy + sink, k, back ? "back" : "front");
  c.outline(ox, oy, FRAME, FRAME, OUT);
}

/** Cabeza completa: piel, pelo, cara y accesorios. `oy` ya incluye el desplazamiento vertical. */
function drawHead(c: Canvas, ox: number, oy: number, k: Ink, view: View) {
  const at = (x: number, y: number, w: number, h: number, color: RGBA) => c.rect(ox + x, oy + y, w, h, color);

  at(11, 4, 10, 10, k.skin);
  drawHair(c, ox, oy, k, view);
  if (view === "front") {
    at(13, 9, 1, 2, OUT);
    at(18, 9, 1, 2, OUT);
    at(15, 12, 2, 1, shade(k.skin, -0.25));
  } else if (view === "side") {
    at(13, 9, 1, 2, OUT);
    at(10, 10, 1, 2, k.skin); // nariz
  }

  if (k.has("beard") && view !== "back") {
    if (view === "front") {
      at(11, 10, 1, 3, k.hair);
      at(20, 10, 1, 3, k.hair);
      at(12, 11, 8, 3, k.hair);
      at(15, 12, 2, 1, shade(k.hair, -0.35)); // boca
    } else {
      at(11, 11, 6, 3, k.hair);
      at(10, 12, 1, 1, k.hair);
    }
  }

  if (k.has("glasses") && view !== "back") {
    const lens = (x: number) => {
      at(x, 8, 3, 1, LENS_FRAME);
      at(x, 11, 3, 1, LENS_FRAME);
      at(x, 9, 1, 2, LENS_FRAME);
      at(x + 2, 9, 1, 2, LENS_FRAME);
    };
    if (view === "front") {
      lens(12);
      lens(17);
      at(15, 9, 2, 1, LENS_FRAME); // puente
    } else {
      lens(12);
      at(15, 9, 5, 1, LENS_FRAME); // patilla
    }
  }

  if (k.has("headphones")) {
    const band = shade(k.accent, -0.25);
    if (view === "side") {
      at(12, 2, 8, 1, band);
      at(15, 7, 4, 5, k.accent);
      at(16, 8, 2, 3, shade(k.accent, -0.35));
    } else {
      at(11, 2, 10, 1, band);
      at(10, 3, 1, 4, band);
      at(21, 3, 1, 4, band);
      at(9, 7, 3, 5, k.accent);
      at(20, 7, 3, 5, k.accent);
    }
  }

  if (k.has("cap")) {
    const brim = shade(k.accent, -0.22);
    at(11, 2, 10, view === "back" ? 5 : 4, k.accent);
    at(12, 2, 8, 1, shade(k.accent, 0.2));
    if (view === "front") at(10, 5, 12, 2, brim);
    else if (view === "side") at(7, 5, 6, 2, brim);
    else at(14, 6, 4, 1, shade(k.accent, -0.35)); // correa de atrás
  }
}

function drawHair(c: Canvas, ox: number, oy: number, k: Ink, view: View) {
  // El pelo rizado lleva textura: algunos píxeles más claros.
  const hair = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const light = k.hairStyle === "curly" && (i + 2 * j) % 4 === 0;
        c.set(ox + i, oy + j, light ? shade(k.hair, 0.22) : k.hair);
      }
  };

  switch (k.hairStyle) {
    case "short":
    case "bun":
      if (view === "front") {
        hair(11, 3, 10, 3);
        hair(11, 6, 1, 4);
        hair(20, 6, 1, 4);
      } else if (view === "back") {
        hair(11, 3, 10, 10);
      } else {
        hair(11, 3, 10, 3);
        hair(16, 6, 5, 6);
      }
      if (k.hairStyle === "bun") c.ellipse(ox + (view === "side" ? 18 : 16), oy + 2, 3, 2, k.hair);
      break;
    case "long":
      if (view === "front") {
        hair(11, 3, 10, 3);
        hair(10, 4, 2, 12);
        hair(20, 4, 2, 12);
      } else if (view === "back") {
        hair(10, 3, 12, 14);
      } else {
        hair(11, 3, 10, 3);
        hair(15, 5, 6, 11);
      }
      break;
    case "curly":
      if (view === "front") {
        hair(10, 2, 12, 4);
        hair(10, 6, 2, 4);
        hair(20, 6, 2, 4);
      } else if (view === "back") {
        hair(10, 2, 12, 11);
      } else {
        hair(10, 2, 12, 4);
        hair(15, 6, 7, 6);
      }
      break;
    case "buzz":
      if (view === "front") {
        hair(11, 3, 10, 2);
      } else if (view === "back") {
        hair(11, 3, 10, 8);
      } else {
        hair(11, 3, 10, 2);
        hair(17, 5, 4, 5);
      }
      break;
  }
}

function mirrorFrame(c: Canvas, sx: number, sy: number, dx: number, dy: number) {
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const px = c.get(sx + x, sy + y);
      if (px[3] > 0) c.set(dx + (FRAME - 1 - x), dy + y, px as RGBA);
    }
}

/** Hoja de caminata: 3 frames x 4 direcciones (abajo, izquierda, derecha, arriba). */
export function drawCharacter(style: CharacterStyle): Canvas {
  const k = ink(style);
  const c = new Canvas(FRAMES * FRAME, DIRECTIONS.length * FRAME);
  for (let f = 0; f < FRAMES; f++) {
    drawFront(c, f * FRAME, 0, k, f, false);
    drawSide(c, f * FRAME, FRAME, k, f);
    mirrorFrame(c, f * FRAME, FRAME, f * FRAME, 2 * FRAME);
    drawFront(c, f * FRAME, 3 * FRAME, k, f, true);
  }
  return c;
}

/** Hoja de sentado: frames en el orden de `SIT_FACINGS`. */
export function drawSitting(style: CharacterStyle): Canvas {
  const k = ink(style);
  const c = new Canvas(SIT_FACINGS.length * FRAME, FRAME);
  SIT_FACINGS.forEach((facing, i) => drawSit(c, i * FRAME, 0, k, facing === "up"));
  return c;
}
