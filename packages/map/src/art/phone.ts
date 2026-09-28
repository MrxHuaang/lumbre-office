// El teléfono de escritorio (llamadas entre oficinas, ver packages/shared/src/phone.ts): un teléfono de
// disco de baquelita con el auricular en la horquilla y el cable en espiral. No tiene mesa propia: se
// dibuja a la altura de la superficie del mueble sobre el que va (el escritorio con PC o la recepción) y
// en el rincón que ese mueble deja libre. También el auricular que se lleva en la mano y el globo que
// vibra sobre la cabeza de quien recibe una llamada.
import { C, OUT } from "./palette";
import { alpha, at, flat, PixelCanvas, renderSprite, type Box, type Ramp, type Sprite } from "./pixel";

/** Dónde va el teléfono en su tile (coordenadas locales de arte, mirando hacia +x) y su color. */
interface PhoneSpot {
  x: number;
  y: number;
  /** Altura de la superficie donde se apoya. */
  z: number;
  /** Tamaño de la base (a lo largo de x y de y). */
  w: number;
  d: number;
  body: Ramp;
}

/**
 * Teléfono de disco: la base con el frente inclinado (el disco mira hacia +x, hacia quien se sienta), el
 * auricular atravesado arriba sobre la horquilla y el cable en espiral que cae por el costado.
 */
function deskPhone(s: PhoneSpot): Sprite {
  const { x, y, z, w, d, body } = s;
  const hx = x + 0.6; // el auricular va atrás, sobre la horquilla
  const boxes: Box[] = [
    // Base: una caja baja con el canto oscuro.
    { x, y, z, w, d, h: 2, top: flat(at(body, 3)), left: flat(at(body, 2)), right: (_u, v) => at(body, v < 0.8 ? 1 : 2) },
    // El lomo de atrás, donde está la horquilla (más alto que el frente: el frente cae hacia el disco).
    { x: x + 0.4, y: y + 0.6, z: z + 2, w: w * 0.45, d: d - 1.2, h: 1.6, top: flat(at(body, 4)), left: flat(at(body, 3)), right: flat(at(body, 2)) },
    // Auricular: la barra y las dos cazoletas (oreja y boca) en las puntas, un poco más anchas.
    { x: hx, y: y - 0.4, z: z + 3.6, w: 2.4, d: 2.4, h: 1.8, top: flat(at(body, 4)), left: flat(at(body, 2)), right: flat(at(body, 3)) },
    { x: hx + 0.4, y: y + 1.6, z: z + 4.2, w: 1.6, d: d - 2.4, h: 1.2, top: flat(at(body, 5)), left: flat(at(body, 3)), right: flat(at(body, 3)) },
    { x: hx, y: y + d - 2, z: z + 3.6, w: 2.4, d: 2.4, h: 1.8, top: flat(at(body, 4)), left: flat(at(body, 2)), right: flat(at(body, 3)) },
  ];
  return renderSprite(boxes, {
    outline: OUT,
    pad: 3,
    extra: (c, p) => {
      // El disco en el frente de la tapa: aro claro, los agujeros alrededor y el tope metálico.
      const dc = p(x + w * 0.72, y + d / 2, z + 2);
      c.ellipse(dc.x, dc.y, 2.6, 1.4, at(C.cream, 4));
      c.set(Math.round(dc.x), Math.round(dc.y), at(body, 1));
      for (const [ox, oy] of [
        [-2, 0],
        [-1, -1],
        [1, -1],
        [2, 0],
        [1, 1],
      ] as const)
        c.set(Math.round(dc.x) + ox, Math.round(dc.y) + oy, at(C.cream, 2));
      c.set(Math.round(dc.x) - 1, Math.round(dc.y) + 1, at(C.metal, 4));
      // Brillo de la baquelita sobre el auricular.
      const sh = p(hx + 1.2, y + d / 2, z + 5.4);
      c.set(Math.round(sh.x), Math.round(sh.y), alpha(at(C.white, 4), 0.85));
      // El cable en espiral: sale de la cazoleta de adelante (lado +y) y cae en rulos hasta la base.
      const a = p(hx + 1.2, y + d + 0.4, z + 3.6);
      const b = p(x + w * 0.55, y + d + 0.6, z);
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Math.round(a.x + (b.x - a.x) * t + (i % 2 ? 1 : -1));
        const py = Math.round(a.y + (b.y - a.y) * t);
        c.set(px, py, at(body, i % 2 ? 1 : 3));
      }
    },
  });
}

/** En el escritorio con PC: en el tile de adelante (el del lado de la silla), entre el monitor y la taza. */
const DESK_SPOT: PhoneSpot = { x: 4.2, y: 6.5, z: 15, w: 5.6, d: 7, body: C.curtain };
/** En la recepción: sobre la repisa alta del frente, antes de la suculenta. */
const COUNTER_SPOT: PhoneSpot = { x: 8.4, y: 0.4, z: 20, w: 5.2, d: 5.4, body: C.mustard };

export const PHONE_DRAW: Record<string, () => Sprite> = {
  "desk-phone": () => deskPhone(DESK_SPOT),
  "desk-phone-counter": () => deskPhone(COUNTER_SPOT),
};

/** El auricular en la mano de quien habla (se dibuja pegado a la cabeza). */
export function handsetSprite(): PixelCanvas {
  const c = new PixelCanvas(9, 5);
  const body = C.curtain;
  // Cazoletas en las puntas y la barra en arco entre ellas.
  c.rect(1, 2, 2, 2, at(body, 3));
  c.rect(6, 2, 2, 2, at(body, 3));
  c.rect(2, 1, 5, 1, at(body, 4));
  c.set(3, 1, at(body, 5));
  c.set(1, 3, at(body, 2));
  c.set(7, 3, at(body, 2));
  c.outline(OUT);
  return c;
}

/** Globo crema con el piquito abajo (el mismo de los globos de chat, sin importar index.ts: sería circular). */
function talkBubble(w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w + 2, h + 5);
  c.rect(2, 1, w - 2, h, at(C.cream, 4));
  c.rect(1, 2, w, h - 2, at(C.cream, 4));
  c.rect(2, h - 1, w - 2, 1, at(C.cream, 2));
  const tx = Math.floor(w / 2);
  c.rect(tx - 1, h + 1, 3, 1, at(C.cream, 4));
  c.set(tx, h + 2, at(C.cream, 4));
  c.outline(OUT);
  return c;
}

/**
 * Globo sobre la cabeza: el teléfono sonando (con `frame` 0 o 1 las rayitas de la vibración cambian de
 * lado) o, con `talking`, el auricular y dos ondas de voz.
 */
export function phoneBubble(frame: 0 | 1, talking = false): PixelCanvas {
  const W = 15;
  const H = 11;
  const c = talkBubble(W, H);
  const body = C.curtain;
  const cx = Math.floor((W + 2) / 2);
  if (talking) {
    // El auricular inclinado y las ondas que salen de la boca.
    c.rect(cx - 5, 5, 2, 2, at(body, 3));
    c.rect(cx - 4, 3, 1, 2, at(body, 4));
    c.rect(cx - 3, 2, 2, 1, at(body, 4));
    c.rect(cx - 1, 2, 2, 2, at(body, 3));
    c.set(cx + 2, 4 + frame, at(C.sage, 2));
    c.set(cx + 2, 5 + frame, at(C.sage, 2));
    c.set(cx + 4, 3 + frame, at(C.sage, 2));
    c.set(cx + 4, 4 + frame, at(C.sage, 2));
    c.set(cx + 4, 5 + frame, at(C.sage, 2));
    return c;
  }
  // Un teléfono de disco chiquito: el auricular arriba, la base y el disco claro.
  c.rect(cx - 3, 3, 7, 1, at(body, 4));
  c.set(cx - 4, 4, at(body, 3));
  c.set(cx + 4, 4, at(body, 3));
  c.rect(cx - 3, 5, 7, 4, at(body, 3));
  c.rect(cx - 1, 6, 3, 2, at(C.cream, 4));
  c.set(cx, 6, at(body, 1));
  // Las rayitas del timbre, a un lado y al otro según el cuadro.
  const side = frame ? 1 : -1;
  c.set(cx + side * 6, 3, at(C.rug, 3));
  c.set(cx + side * 6, 5, at(C.rug, 3));
  c.set(cx - side * 6, 4, at(C.rug, 3));
  return c;
}
