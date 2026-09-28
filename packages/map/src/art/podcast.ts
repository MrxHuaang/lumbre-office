// La cabina de grabación del jardín (5x5 tiles = 80x80 unidades de arte): una cabañita de troncos sobre
// piedra, con techo de tejas a dos aguas, la puerta al sur y el cartel "EN EL AIRE" encima, una ventana
// al este con postigos y, adentro, paneles de tela en las paredes, la alfombra y la mesa con los dos
// micrófonos de brazo y los audífonos. La base (piso) va plana; las paredes y el techo son otra pieza que
// se transparenta con alguien adentro. El cartel prendido lo pone el cliente encima (`podcastSign`).
import { Escena, type Tinte } from "./exterior-escena";
import { gableX, logWall, stones, windowAt, type Win } from "./exterior-casa";
import { C, mix } from "./palette";
import { at, noise, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

const T = (c: RGBA): Tinte => () => c;

/** Paredes (por fuera) y techo: la cumbrera corre a lo largo de x, al medio. */
const X0 = 3;
const X1 = 77;
const Y0 = 3;
const Y1 = 77;
const WALL = 5;
const HW = 36;
const SLOPE = 0.36;
const EAVE = 3;
const RIDGE_Y = (Y0 + Y1) / 2;
const RIDGE_Z = HW + (Y1 + EAVE - RIDGE_Y) * SLOPE;
/** La puerta en la pared sur (el tile x = 2 de la cabina), en `u` desde X0. */
const DOOR = { u0: 30, u1: 43, top: 22 };
/** El cartel sobre la puerta, en la pared sur (u desde X0, v = altura). */
export const PODCAST_SIGN = { u0: 16, u1: 58, v0: 24, v1: 31 };

/** Troncos sobre una basa baja de piedra (la cabaña es de madera: la piedra solo al pie). */
const wall = (u: number, v: number, seed: number, luz = 0) => logWall(u, v + 8, seed, luz);

const scene = () => new Escena({ x0: -6, y0: -6, z0: -2, x1: 86, y1: 86, z1: RIDGE_Z + 6 }, 2);

/** Base de la cabina (va plana): la basa de piedra, el piso de tablas y la alfombra redonda. */
export function podcastBooth(): Sprite {
  const s = scene();
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 8, Y1 - Y0 + 6, 0.3);
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, 3, (u, v) => (u % 6 < 0.6 ? at(C.wood, 2) : at(C.wood, noise(Math.floor(u / 6), Math.floor(v / 30), 71) < 0.3 ? 3 : 4)), (u, v) => stones(u, v * 3, 72), (u, v) => stones(u, v * 3, 73, 1));
  // Alfombra redonda tejida al centro (rayas de colores cálidos).
  s.disc(40, 38, 3.2, 17, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d > 16) return at(C.rug, 2);
    return [at(C.rug, 3), at(C.mustard, 3), at(C.rug, 4), at(C.sage, 3)][Math.floor(d / 3) % 4]!;
  });
  // Umbral de piedra en la puerta.
  s.box(X0 + DOOR.u0, Y1 - 1, 0, DOOR.u1 - DOOR.u0, 4, 3.4, T(at(C.stone, 4)), T(at(C.stone, 3)), null);
  return s.sprite();
}

/** Panel acústico de tela (cuadros acolchados) en la cara interior de una pared. */
const panel = (u: number, v: number): RGBA | null => {
  const cu = u % 12;
  const cv = v % 10;
  if (v < 6 || v > 27 || cu < 1 || cv < 1) return null;
  const tone = (Math.floor(u / 12) + Math.floor(v / 10)) % 2 ? C.sage : C.blue;
  return at(tone, cu < 2 || cv < 2 ? 2 : 3);
};

/** Cartel "EN EL AIRE": la placa oscura con las letras (rojas prendidas o apagadas). */
function signColor(u: number, v: number, lit: boolean): RGBA | null {
  const { u0, u1, v0, v1 } = PODCAST_SIGN;
  if (u < u0 || u >= u1 || v < v0 || v >= v1) return null;
  if (u < u0 + 0.8 || u >= u1 - 0.8 || v < v0 + 0.6 || v >= v1 - 0.6) return at(C.woodDark, 2);
  const text = "EN EL AIRE";
  // Letras de 3x5 a una unidad por punto, con una de aire entre letras.
  const x = u - u0 - 1.5;
  const y = v1 - 1 - v;
  const li = Math.floor(x / 4);
  const gx = Math.floor(x - li * 4);
  const gy = Math.floor(y);
  if (li >= 0 && li < text.length && gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && glyphOn(text[li]!, gx, gy)) return lit ? at(C.rug, 5) : at(C.rug, 1);
  return lit ? mix(at(C.night, 1), at(C.rug, 2), 0.35) : at(C.night, 1);
}

/** Pared sur (+y, de frente): troncos, la puerta de tablas con su ventanita redonda y el cartel. */
function front(night: boolean): Tinte {
  return (u, v) => {
    if (v >= HW) return null;
    const sign = signColor(u, v, false);
    if (sign) return sign;
    const du = u - DOOR.u0;
    const w = DOOR.u1 - DOOR.u0;
    if (du >= -1.2 && du < w + 1.2 && v < DOOR.top + 1.2 && !(du >= 0 && du < w && v < DOOR.top)) return at(C.woodDark, 3);
    if (du >= 0 && du < w && v < DOOR.top) {
      const d = Math.hypot(du - w / 2, v - 16);
      if (d < 3) return d > 2.2 ? at(C.woodDark, 2) : night ? at(C.gold, 4) : mix(at(C.sky, 3), at(C.cream, 3), 0.3);
      if (Math.hypot(du - (w - 2.5), v - 10) < 0.9) return at(C.gold, 4);
      // Acolchado de la puerta: cuero café con botones (aísla el ruido).
      if ((Math.floor(du / 3) + Math.floor(v / 3)) % 3 === 0 && du % 3 < 0.8 && v % 3 < 0.8) return at(C.woodDark, 1);
      return at(C.cork, 2 + (du < 1 || du > w - 1 ? -1 : 0));
    }
    return wall(u + 3, v, 81);
  };
}

/** Pared este (+x, en sombra): troncos y la ventana con postigos (luz cálida de noche). */
function side(night: boolean): Tinte {
  const win: Win = { u0: 26, u1: 44, v0: 13, v1: 27, kind: "ventana", shutters: true };
  return (u, v) => {
    if (v >= HW) return null;
    return windowAt(u, v, win, night) ?? wall(u + 7, v, 83, -1);
  };
}

/**
 * Paredes, paneles, techo y el cartel apagado de la cabina. Va sobre la base, ordenada con su centro; el
 * cliente la transparenta cuando hay alguien adentro, para ver la mesa y quién está grabando.
 */
export function podcastBoothRoof(night: boolean): Sprite {
  const s = scene();
  // Por dentro: paneles de tela en la pared norte y la oeste (se ven con el techo transparente).
  s.quad([X0 + WALL, Y0 + WALL, 3], [1, 0, 0], [0, 0, 1], X1 - X0 - WALL * 2, HW - 3, (u, v) => panel(u, v) ?? at(C.logs, 3));
  s.quad([X0 + WALL, Y0 + WALL, 3], [0, 1, 0], [0, 0, 1], Y1 - Y0 - WALL * 2, HW - 3, (u, v) => panel(u + 5, v) ?? at(C.logs, 2));
  // Paredes de troncos: norte y oeste (su cara de afuera no se ve), sur y este de frente.
  s.box(X0, Y0, 0, X1 - X0, WALL, HW, T(at(C.logs, 4)), null, null);
  s.box(X0, Y0, 0, WALL, Y1 - Y0, HW, T(at(C.logs, 4)), null, null);
  s.box(X0, Y1 - WALL, 0, X1 - X0, WALL, HW, T(at(C.logs, 4)), front(night), null);
  s.box(X1 - WALL, Y0, 0, WALL, Y1 - Y0, HW, T(at(C.logs, 4)), null, side(night));
  // Hastial este de escamas con un respiradero, y el techo.
  s.quad([X1, Y0 - EAVE, HW], [0, 1, 0], [0, 0, 1], Y1 - Y0 + EAVE * 2, RIDGE_Z - HW, (u, v) => {
    const y = Y0 - EAVE + u;
    if (HW + v > RIDGE_Z - Math.abs(y - RIDGE_Y) * SLOPE - 0.5 || y < Y0 || y > Y1) return null;
    if (Math.abs(y - RIDGE_Y) < 3 && v > 3 && v < 7) return at(C.woodDark, 1);
    return at(C.wood, (Math.floor(v / 3) + (Math.floor(u / 5) % 2)) % 2 ? 3 : 2);
  });
  gableX(s, X0 - 4, X1 + 4, Y0 - EAVE, RIDGE_Y, Y1 + EAVE, RIDGE_Z, SLOPE, 85);
  // Macetas a los lados de la puerta.
  for (const [x, seed] of [
    [X0 + DOOR.u0 - 7, 3],
    [X0 + DOOR.u1 + 3, 5],
  ] as const) {
    s.box(x, Y1 + 1, 0, 5, 5, 5, T(at(C.dirt, 2)), (u) => at(C.terracotta, u < 1 ? 4 : 3), T(at(C.terracotta, 2)));
    for (let i = 0; i < 40; i++) {
      const a = noise(i, 1, seed) * Math.PI * 2;
      const d = noise(i, 2, seed) * 3;
      const hz = noise(i, 3, seed) * 6;
      s.plot(x + 2.5 + Math.cos(a) * d, Y1 + 3.5 + Math.sin(a) * d, 5 + hz, i % 6 === 0 ? at(C.violet, 4) : at(C.leaf, hz > 3 ? 4 : 2));
    }
  }
  return s.sprite();
}

/**
 * El cartel "EN EL AIRE" encima del de la pared (mismas coordenadas que la cabina: se pone en su origen).
 * Prendido, las letras rojas con su brillo; `frame` alterna un poco el brillo.
 */
export function podcastSign(lit: boolean, frame = 0): Sprite {
  const s = scene();
  const { u0, u1, v0, v1 } = PODCAST_SIGN;
  s.borde = false;
  s.quad([X0 + u0, Y1 + 0.2, v0], [1, 0, 0], [0, 0, 1], u1 - u0, v1 - v0, (u, v) => signColor(u + u0, v + v0, lit));
  if (lit)
    for (let u = u0 - 2; u < u1 + 2; u += 0.5)
      for (let v = v0 - 2; v < v1 + 2; v += 0.5) {
        if (u >= u0 && u < u1 && v >= v0 && v < v1) continue;
        const d = Math.min(Math.abs(u - Math.max(u0, Math.min(u1, u))), 2) + Math.min(Math.abs(v - Math.max(v0, Math.min(v1, v))), 2);
        if (d < 1.6 + frame * 0.4) s.plot(X0 + u, Y1 + 0.4, v, [255, 90, 70, Math.round((0.5 - d * 0.22) * 255)]);
      }
  return s.sprite();
}

/** La mesa de grabación (1x1): dos micrófonos de brazo, los audífonos, la consolita y una taza. */
export function podcastDesk(): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 22, y1: 22, z1: 40 }, 2);
  s.shadow(1, 1, 16, 16, 0.25);
  for (const [x, y] of [
    [2, 2],
    [12, 2],
    [2, 12],
    [12, 12],
  ] as const)
    s.solid(x, y, 0, 2, 2, 12, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.box(1, 1, 12, 14, 14, 2, (u) => at(C.wood, u % 4 < 0.5 ? 3 : 5), T(at(C.wood, 3)), T(at(C.wood, 2)));
  // Consolita con perillas y lucecitas.
  s.box(5, 6, 14, 6, 5, 1.6, (u, v) => (Math.floor(u) % 2 === 0 && Math.floor(v) % 2 === 0 ? (v < 1.5 ? at(C.leaf, 4) : at(C.cream, 4)) : at(C.night, 2)), T(at(C.night, 1)), T(at(C.night, 0)));
  // Micrófonos: pie, brazo que sube en diagonal y la cápsula con su filtro redondo.
  for (const [bx, by, dir] of [
    [3, 3, 1],
    [13, 13, -1],
  ] as const) {
    s.solid(bx - 1, by - 1, 14, 2, 2, 1.5, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
    for (let k = 0; k <= 1; k += 0.03) s.plot(bx + dir * k * 3, by + dir * k * 3, 15.5 + Math.sin(k * Math.PI * 0.7) * 12, at(C.metal, 2));
    s.solid(bx + dir * 3 - 1.2, by + dir * 3 - 1.2, 21, 2.4, 2.4, 4, at(C.night, 3), at(C.night, 2), at(C.night, 1));
    s.disc(bx + dir * 4.5, by + dir * 4.5, 23, 2, () => at(C.night, 3));
  }
  // Audífonos sobre la mesa y una taza.
  for (let a = 0; a < Math.PI; a += 0.1) s.plot(10 + Math.cos(a) * 2.5, 12.5, 14 + Math.sin(a) * 2.5, at(C.rug, 3));
  s.solid(7, 12, 14, 1.5, 1.5, 1.5, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  s.solid(12, 12, 14, 1.5, 1.5, 1.5, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  s.cylinder(12.5, 5, 14, 1.3, 2.4, (_a, _v, luz) => at(C.cream, luz > 0 ? 4 : 2));
  return s.sprite();
}
