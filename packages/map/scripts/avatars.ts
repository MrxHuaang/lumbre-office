// Spritesheets placeholder de personajes: 3 frames (quieto, paso A, paso B) x 4 filas (abajo, izq, der, arriba).
import { Canvas, hex, shade, type RGBA } from "./pixels";

export const FRAME = 32;
export const FRAMES = 3;
export const DIRECTIONS = ["down", "left", "right", "up"] as const;

export interface CharacterStyle {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
}

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

function drawFront(c: Canvas, ox: number, oy: number, s: CharacterStyle, frame: number, back: boolean) {
  const skin = hex(s.skin);
  const hair = hex(s.hair);
  const shirt = hex(s.shirt);
  const pants = hex(s.pants);
  const bob = frame === 0 ? 0 : -1;

  c.ellipse(ox + 16, oy + 29, 7, 2, [0, 0, 0, 70]);

  // Piernas: en cada paso una pierna se levanta.
  const liftL = frame === 1 ? 1 : 0;
  const liftR = frame === 2 ? 1 : 0;
  c.rect(ox + 12, oy + 22 + bob, 3, 5 - liftL, pants);
  c.rect(ox + 17, oy + 22 + bob, 3, 5 - liftR, pants);
  c.rect(ox + 12, oy + 27 + bob - liftL, 3, 2, SHOE);
  c.rect(ox + 17, oy + 27 + bob - liftR, 3, 2, SHOE);

  // Torso y brazos (el brazo contrario a la pierna levantada avanza).
  c.rect(ox + 10, oy + 14 + bob, 12, 9, shirt);
  c.rect(ox + 10, oy + 14 + bob, 12, 1, shade(shirt, 0.2));
  const armL = frame === 2 ? -1 : 0;
  const armR = frame === 1 ? -1 : 0;
  c.rect(ox + 8, oy + 15 + bob + armL, 2, 6, shade(shirt, -0.2));
  c.rect(ox + 22, oy + 15 + bob + armR, 2, 6, shade(shirt, -0.2));
  c.rect(ox + 8, oy + 21 + bob + armL, 2, 2, skin);
  c.rect(ox + 22, oy + 21 + bob + armR, 2, 2, skin);

  // Cabeza
  c.rect(ox + 11, oy + 4 + bob, 10, 10, skin);
  if (back) {
    c.rect(ox + 11, oy + 3 + bob, 10, 10, hair);
  } else {
    c.rect(ox + 11, oy + 3 + bob, 10, 3, hair);
    c.rect(ox + 11, oy + 6 + bob, 1, 4, hair);
    c.rect(ox + 20, oy + 6 + bob, 1, 4, hair);
    c.rect(ox + 13, oy + 9 + bob, 1, 2, OUT);
    c.rect(ox + 18, oy + 9 + bob, 1, 2, OUT);
    c.rect(ox + 15, oy + 12 + bob, 2, 1, shade(skin, -0.25));
  }
  c.outline(ox, oy, FRAME, FRAME, OUT);
}

function drawSide(c: Canvas, ox: number, oy: number, s: CharacterStyle, frame: number) {
  // Mirando a la izquierda. La derecha se obtiene espejando.
  const skin = hex(s.skin);
  const hair = hex(s.hair);
  const shirt = hex(s.shirt);
  const pants = hex(s.pants);
  const bob = frame === 0 ? 0 : -1;

  c.ellipse(ox + 16, oy + 29, 6, 2, [0, 0, 0, 70]);

  const stride = frame === 0 ? 0 : 2;
  const front = frame === 1 ? -stride : stride;
  c.rect(ox + 14 + front, oy + 22 + bob, 3, 5, shade(pants, -0.15));
  c.rect(ox + 14 - front, oy + 22 + bob, 3, 5, pants);
  c.rect(ox + 13 + front, oy + 27 + bob, 4, 2, SHOE);
  c.rect(ox + 13 - front, oy + 27 + bob, 4, 2, SHOE);

  c.rect(ox + 12, oy + 14 + bob, 8, 9, shirt);
  c.rect(ox + 12, oy + 14 + bob, 8, 1, shade(shirt, 0.2));
  const swing = frame === 0 ? 0 : frame === 1 ? 2 : -2;
  c.rect(ox + 15 + swing, oy + 15 + bob, 2, 6, shade(shirt, -0.2));
  c.rect(ox + 15 + swing, oy + 21 + bob, 2, 2, skin);

  c.rect(ox + 11, oy + 4 + bob, 10, 10, skin);
  c.rect(ox + 11, oy + 3 + bob, 10, 3, hair);
  c.rect(ox + 16, oy + 6 + bob, 5, 6, hair);
  c.rect(ox + 13, oy + 9 + bob, 1, 2, OUT);
  c.rect(ox + 10, oy + 10 + bob, 1, 2, skin); // nariz
  c.outline(ox, oy, FRAME, FRAME, OUT);
}

function mirrorFrame(c: Canvas, sx: number, sy: number, dx: number, dy: number) {
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const px = c.get(sx + x, sy + y);
      if (px[3] > 0) c.set(dx + (FRAME - 1 - x), dy + y, px as RGBA);
    }
}

export function drawCharacter(style: CharacterStyle): Canvas {
  const c = new Canvas(FRAMES * FRAME, DIRECTIONS.length * FRAME);
  for (let f = 0; f < FRAMES; f++) {
    drawFront(c, f * FRAME, 0, style, f, false);
    drawSide(c, f * FRAME, FRAME, style, f);
    mirrorFrame(c, f * FRAME, FRAME, f * FRAME, 2 * FRAME);
    drawFront(c, f * FRAME, 3 * FRAME, style, f, true);
  }
  return c;
}
