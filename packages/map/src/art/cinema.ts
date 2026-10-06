// Muebles del cine del sótano: butacas de terciopelo, máquina de crispetas, proyector y afiche de
// cartelera. La pantalla con el telón cuelga de la pared (ver room.ts).
import { C, OUT } from "./palette";
import { projectorSprite } from "./salas-muebles";
import { PixelCanvas, alpha, at, bayer, flat, noise, renderSprite, solidBox, type Box, type Shader, type Sprite } from "./pixel";
import { glyphOn } from "./room";
import { cushion, shadowUnder, volume, type Variant } from "./kit";
import { SOTANO_CATALOG } from "../world/catalog-sotano";

/**
 * Butaca de cine: respaldo alto de terciopelo rojo, apoyabrazos negros con portavasos y asiento acolchado.
 * `lift` la sube a la altura de su grada (el `lift` del catálogo, igual al de la grada).
 */
function cinemaSeat(variant: Variant, lift = 0): Sprite {
  const back = variant === "back";
  const r = C.curtain;
  const rest: Box = {
    x: back ? 11 : 1,
    y: 2,
    z: 4,
    w: 4,
    d: 12,
    h: 20,
    top: (u, v, fw, fh) => at(r, u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? 2 : 3),
    left: (_u, v, _fw, fh) => at(r, v >= fh - 2 ? 3 : Math.floor(v) === 12 ? 1 : 2),
    right: (_u, v, _fw, fh) => at(r, v >= fh - 2 ? 2 : Math.floor(v) === 12 ? 0 : 1),
  };
  const base = solidBox({ x: 3, y: 4, z: 0, w: 10, d: 8, h: 7 }, C.metal, 2);
  const seat = cushion(back ? 2 : 5, 3, 7, 9, 10, 3, r);
  const arm = (y: number): Box => ({ x: 1, y, z: 0, w: 14, d: 2, h: 12, top: flat(at(C.metal, 2)), left: flat(at(C.metal, 1)), right: flat(at(C.metal, 1)) });
  const cup = solidBox({ x: back ? 2 : 11, y: 14.2, z: 12, w: 2.5, d: 1.6, h: 1 }, C.gold, 3);
  const parts = back ? [arm(0), base, seat, rest, arm(14), cup] : [arm(0), rest, base, seat, arm(14), cup];
  return renderSprite(
    parts.map((b) => ({ ...b, z: b.z + lift })),
    {
      outline: OUT,
      under: (c, p) => shadowUnder(1, 1, 14, 14)(c, (x, y, z = 0) => p(x, y, z + lift)),
    },
  );
}

/** Máquina de crispetas: carrito rojo, vitrina llena y techito con ribete dorado. */
function popcornMachine(): Sprite {
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v >= fh - 1) return at(C.rug, 2);
    if (v < fh * 0.6 - 1 + Math.sin(u * 0.9) * 0.8) return noise(Math.floor(u), Math.floor(v), 3) < 0.55 ? at(C.cream, 5) : at(C.gold, 5);
    return Math.abs(u - v * 0.6 - 2) < 0.8 ? alpha(at(C.white, 4), 0.8) : alpha(at(C.sky, 4), 0.35);
  };
  const cart: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5) return at(C.gold, 4);
    return at(C.rug, Math.floor(u) % 4 === 0 ? 2 : 3);
  };
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 12, d: 12, h: 10, top: flat(at(C.rug, 3)), left: cart, right: cart },
      { x: 2.5, y: 2.5, z: 10, w: 11, d: 11, h: 11, top: flat(at(C.cream, 5)), left: glass, right: glass },
      { x: 1.5, y: 1.5, z: 21, w: 13, d: 13, h: 3, top: (u, v) => at(C.rug, (Math.floor(u / 3) + Math.floor(v / 3)) % 2 ? 3 : 4), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) },
      solidBox({ x: 7, y: 7, z: 24, w: 2, d: 2, h: 2 }, C.gold, 4),
    ],
    { outline: OUT, under: shadowUnder(2, 2, 12, 12) },
  );
}

/** Afiche de cartelera en un atril: marco dorado y un afiche de estreno (estrella, título y bombillos). */
function posterStand(): Sprite {
  const poster: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1) {
      // Bombillos en el marco, uno sí y uno no.
      return Math.floor(u + v) % 3 === 0 ? at(C.gold, 5) : at(C.gold, 2);
    }
    if (v < 5) return v >= 2 && v < 3.5 && u > 2.5 && u < fw - 2.5 && Math.floor(u) % 3 !== 0 ? at(C.cream, 5) : at(C.navy, 0);
    const cx = fw / 2;
    const cy = fh * 0.62;
    // Estrella de cinco puntas.
    const a = Math.atan2(v - cy, u - cx);
    const rr = 4.2 * (0.55 + 0.45 * Math.cos(a * 5 - Math.PI / 2));
    if (Math.hypot(u - cx, v - cy) < rr) return at(C.gold, 5);
    return at(C.navy, 2 + (bayer(Math.floor(u), Math.floor(v)) < 0.2 ? 1 : 0));
  };
  return renderSprite(
    [
      solidBox({ x: 5, y: 2, z: 0, w: 6, d: 12, h: 1 }, C.gold, 3),
      solidBox({ x: 7, y: 3, z: 1, w: 2, d: 2, h: 5 }, C.gold, 3),
      solidBox({ x: 7, y: 11, z: 1, w: 2, d: 2, h: 5 }, C.gold, 3),
      { x: 7, y: 1, z: 5, w: 1.5, d: 14, h: 20, top: flat(at(C.gold, 4)), left: flat(at(C.gold, 2)), right: poster },
      volume(7, 1, 25, 2, 14, 1),
    ],
    { outline: OUT, under: shadowUnder(5, 2, 6, 12) },
  );
}

/** Dibujos del cine, para registrar en DRAW de furniture.ts. */
export const CINEMA_DRAW: Record<string, (v: Variant) => Sprite> = {
  "cinema-seat": (v) => cinemaSeat(v),
  // Las butacas de las gradas, cada una a la altura de su grada.
  "cinema-seat-1": (v) => cinemaSeat(v, SOTANO_CATALOG["cinema-seat-1"].lift),
  "cinema-seat-2": (v) => cinemaSeat(v, SOTANO_CATALOG["cinema-seat-2"].lift),
  "cinema-seat-3": (v) => cinemaSeat(v, SOTANO_CATALOG["cinema-seat-3"].lift),
  "popcorn-machine": popcornMachine,
  projector: projectorSprite,
  "poster-stand": posterStand,
};

// ---------- Marquesina ----------

/** Separación de los postes de la marquesina (px de arte a lo largo de la pared: una puerta de 2 tiles). */
export const MARQUEE_POSTS = 32;
/** Largo de los postes, desde lo alto de la pared baja hasta el letrero. */
export const MARQUEE_POST_H = 18;

/**
 * Marquesina sobre la puerta del cine: un tablero con bombillos alrededor y el texto en letras de 3x5
 * ("EN FUNCION", "EN PAUSA", "SALA LIBRE"). Va inclinado como la pared norte (baja medio píxel por cada
 * uno a la derecha) y con dos postes que bajan hasta la pared. Con `lit` las letras brillan y los
 * bombillos corren según `frame` (0 o 1); apagada, todo queda a media luz.
 *
 * El origen (`ox`, `oy`) es el punto de la pared entre los dos postes, abajo.
 */
export function cinemaMarquee(text: string, frame: number, lit: boolean): Sprite {
  const tw = text.length * 4 - 1;
  const W = Math.max(tw + 10, MARQUEE_POSTS + 6);
  const H = 13;
  const flatC = new PixelCanvas(W, H);
  const tx = Math.floor((W - tw) / 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        flatC.set(x, y, OUT);
        continue;
      }
      if (x === 1 || y === 1 || x === W - 2 || y === H - 2) {
        // El marco dorado con un bombillo cada dos píxeles, que se prenden salteados.
        const bulb = (x + y) % 2 === 0;
        const on = lit && ((x + y) / 2 + frame) % 2 === 0;
        flatC.set(x, y, bulb ? at(C.gold, on ? 5 : lit ? 3 : 2) : at(C.gold, 1));
        continue;
      }
      const gx = x - tx;
      const k = Math.floor(gx / 4);
      const on = gx >= 0 && k < text.length && gx % 4 < 3 && y >= 4 && y < 9 && glyphOn(text[k]!, gx % 4, y - 4);
      flatC.set(x, y, on ? (lit ? at(C.cream, 5) : at(C.cream, 2)) : at(C.night, 0));
    }
  // Inclinado como la pared norte, con los postes debajo.
  const out = new PixelCanvas(W, H + Math.ceil(W / 2) + MARQUEE_POST_H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (flatC.data[i + 3]) out.set(x, y + Math.floor(x / 2), [flatC.data[i]!, flatC.data[i + 1]!, flatC.data[i + 2]!, flatC.data[i + 3]!]);
    }
  const mid = Math.floor(W / 2);
  for (const px of [mid - MARQUEE_POSTS / 2, mid + MARQUEE_POSTS / 2 - 1])
    for (let y = 0; y < MARQUEE_POST_H; y++) {
      const top = H + Math.floor(px / 2);
      out.set(px, top + y, OUT);
      out.set(px + 1, top + y, at(C.metal, 1));
    }
  return { canvas: out, ox: mid, oy: H + Math.floor(mid / 2) + MARQUEE_POST_H };
}
