// Muebles del cine del sótano: butacas de terciopelo, máquina de crispetas, proyector y afiche de
// cartelera. La pantalla con el telón cuelga de la pared (ver room.ts).
import { C, OUT } from "./palette";
import { alpha, at, bayer, flat, noise, renderSprite, solidBox, type Box, type Shader, type Sprite } from "./pixel";
import { cushion, shadowUnder, volume, type Variant } from "./kit";
import { TIER_STEP } from "./sotano";

/**
 * Butaca de cine: respaldo alto de terciopelo rojo, apoyabrazos negros con portavasos y asiento acolchado.
 * `lift` la sube a la altura de una grada (ver cinemaTier en sotano.ts).
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

/**
 * Proyector de cine sobre un pedestal: cuerpo metálico, lente al frente y dos rollos de película arriba.
 * De espaldas no se ve el lente (queda del otro lado, apuntando a la pantalla).
 */
function projector(variant: Variant): Sprite {
  const lensFace: Shader = (u, v, fw, fh) => {
    const r = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2);
    if (r < 1.3) return at(C.sky, 4);
    if (r < 2.4) return at(C.gold, 3);
    return at(C.metal, 2);
  };
  const reel: Shader = (u, v, fw, fh) => {
    const r = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2);
    if (r > fw / 2) return null;
    if (r < 0.8) return at(C.metal, 4);
    if (r > fw / 2 - 1) return at(C.metal, 3);
    return Math.floor(Math.atan2(v - fh / 2, u - fw / 2) * 1.9) % 2 ? at(C.metal, 1) : at(C.metal, 2);
  };
  return renderSprite(
    [
      solidBox({ x: 4, y: 4, z: 0, w: 8, d: 8, h: 12 }, C.woodDark, 3),
      { x: 3, y: 4, z: 12, w: 10, d: 8, h: 6, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 1)), right: (u, v) => at(C.metal, bayer(Math.floor(u), Math.floor(v)) < 0.2 ? 1 : 2) },
      ...(variant === "back" ? [] : [{ x: 13, y: 6, z: 13, w: 2, d: 4, h: 4, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 1)), right: lensFace }]),
      { x: 4, y: 7.5, z: 18, w: 5, d: 1, h: 5, left: reel },
      { x: 8, y: 7.5, z: 18, w: 5, d: 1, h: 5, left: reel },
    ],
    { outline: OUT, under: shadowUnder(3, 4, 12, 8) },
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
  "cinema-seat-1": (v) => cinemaSeat(v, TIER_STEP),
  "cinema-seat-2": (v) => cinemaSeat(v, TIER_STEP * 2),
  "cinema-seat-3": (v) => cinemaSeat(v, TIER_STEP * 3),
  "popcorn-machine": popcornMachine,
  projector,
  "poster-stand": posterStand,
};
