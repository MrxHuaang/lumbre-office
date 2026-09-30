// Las fachadas del barrio (5x4 tiles = 80x64 unidades de arte): casitas de un piso, de la misma familia
// que la cabaña (basa de piedra, techo de tejas a dos aguas, ventanas con postigos y farol en la puerta),
// cada una con otro terminado para que la calle no parezca repetida: troncos, estuco pintado, ladrillo y
// tablas. Miran a +y (la calle). Todas tienen puerta, pero solo la de `casa-fachada-tuya` se usa: es la
// que lleva a la casa de cada quien (el portal está en el tile de delante). De noche se prenden las
// ventanas y el farol. Se registran en outdoor.ts (tienen versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { escamas, gableX, lantern, stones, windowAt, type Win } from "./exterior-casa";
import { C, mix } from "./palette";
import { at, bayer, noise, ramp, smoothNoise, type RGBA, type Ramp, type Sprite } from "./pixel";

/** Paredes (sin el alero): el frente va en Y1 y la cumbrera corre a lo largo de x. */
const X0 = 3;
const X1 = 76;
const Y0 = 6;
const Y1 = 58;
const HW = 40;
const STONE_H = 9;
const RIDGE_Y = (Y0 + Y1) / 2;
const SLOPE = 0.45;
const EAVE = 2;
const RIDGE_Z = HW + (Y1 + EAVE - RIDGE_Y) * SLOPE;
const roofZ = (y: number) => RIDGE_Z - Math.abs(y - RIDGE_Y) * SLOPE;

/** La puerta, centrada en el frente (en `u` desde X0): el portal de la tuya queda en el tile de delante. */
const DOOR: Win = { u0: 30, u1: 44, v0: 0, v1: 24, kind: "puerta" };

// Pinturas de los estucos y las tablas (cálidas, nada de gris).
const OCRE = ramp("#8a5a2e", "#a86f3a", "#c48a4a", "#d9a560", "#e8bf7d");
const TERRACOTA = ramp("#6e3226", "#8a4232", "#a4553f", "#bb6a4e", "#cf8363");
const SALVIA = ramp("#3f5240", "#51684f", "#65805f", "#7c9873", "#97b08a");
const AZUL = ramp("#2f4660", "#3c5877", "#4c6d8f", "#6285a6", "#7f9fbd");

type Terminado = "troncos" | "estuco" | "ladrillo" | "tablas";

interface Fachada {
  terminado: Terminado;
  /** Color de la pared (estuco y tablas) y de los postigos. */
  pared: Ramp;
  postigos: Ramp;
  seed: number;
}

/** Estuco con manchas suaves y granito de la brocha. */
function estuco(u: number, v: number, r: Ramp, seed: number, luz: number): RGBA {
  const m = smoothNoise(u, v, 9, seed);
  const i = 3 + luz + (m > 0.68 ? 1 : m < 0.3 ? -1 : 0);
  return at(r, bayer(Math.floor(u), Math.floor(v)) < 0.08 ? i - 1 : i);
}

/** Ladrillo de barro en hileras trabadas, con la junta de mortero clara. */
function ladrillo(u: number, v: number, seed: number, luz: number): RGBA {
  const row = Math.floor(v / 3.5);
  const off = row % 2 ? 3.5 : 0;
  const k = (u + off) % 7;
  if (v % 3.5 < 0.7 || k < 0.7) return at(C.cream, 2 + luz);
  const n = noise(Math.floor((u + off) / 7), row, seed);
  return at(TERRACOTA, 2 + luz + (n > 0.75 ? 1 : n < 0.2 ? -1 : 0));
}

/** Tablas horizontales traslapadas (cada una con su sombra abajo), pintadas. */
function tablas(u: number, v: number, r: Ramp, seed: number, luz: number): RGBA {
  const k = v % 5;
  const board = Math.floor(v / 5);
  if (k < 0.8) return at(r, 0 + Math.max(0, luz + 1));
  if (k > 4.2) return at(r, 4 + luz);
  const worn = smoothNoise(u, v, 5, seed + board) > 0.8;
  return worn ? at(C.wood, 3) : at(r, 3 + luz);
}

/** Troncos horizontales como los de la cabaña (sin su basa: la de piedra es común a todas). */
function troncos(u: number, v: number, seed: number, luz: number): RGBA {
  const log = Math.floor(v / 7);
  const k = v - log * 7;
  const b = 3 + (noise(log, Math.floor(u / 30), seed) < 0.45 ? 0 : 1) + luz;
  if (k < 1) return at(C.logs, 0);
  if (k < 2) return at(C.logs, b + 1);
  if (k >= 6) return at(C.logs, Math.max(0, b - 2));
  return at(C.logs, b);
}

function pared(f: Fachada, luz: number): Tinte {
  return (u, v) => {
    if (v < STONE_H) return stones(u, v, f.seed, luz < 0 ? 1 : 0);
    if (v < STONE_H + 1.5) return at(C.woodDark, luz < 0 ? 1 : 2);
    const w = v - STONE_H - 1.5;
    switch (f.terminado) {
      case "troncos":
        return troncos(u, w, f.seed, luz);
      case "estuco":
        return estuco(u, w, f.pared, f.seed, luz);
      case "ladrillo":
        return ladrillo(u, w, f.seed, luz);
      case "tablas":
        return tablas(u, w, f.pared, f.seed, luz);
    }
  };
}

/** Recolorea los postigos verdes de `windowAt` con los de la casa. */
function conPostigos(c: RGBA, f: Fachada): RGBA {
  const verdes = C.green.findIndex((g) => g[0] === c[0] && g[1] === c[1] && g[2] === c[2]);
  return verdes >= 0 ? at(f.postigos, verdes) : c;
}

function frente(f: Fachada, night: boolean): Tinte {
  const wins: Win[] = [
    { u0: 8, u1: 20, v0: 13, v1: 27, kind: "ventana", shutters: true },
    { u0: 54, u1: 66, v0: 13, v1: 27, kind: "ventana", shutters: true },
  ];
  const base = pared(f, 0);
  return (u, v) => {
    if (v >= HW) return null;
    const d = windowAt(u, v, DOOR, night);
    if (d) return d;
    for (const w of wins) {
      const c = windowAt(u, v, w, night);
      if (c) return conPostigos(c, f);
    }
    return base(u, v);
  };
}

function costado(f: Fachada, night: boolean): Tinte {
  const win: Win = { u0: 20, u1: 32, v0: 14, v1: 27, kind: "ventana" };
  const base = pared(f, -1);
  return (u, v) => {
    if (v >= HW) return null;
    return windowAt(u, v, win, night) ?? base(u, v);
  };
}

/** Matas bajas al pie del frente (menos delante de la puerta). */
function matas(s: Escena, seed: number) {
  for (let i = 0; i < 46; i++) {
    const x = X0 + noise(i, 1, seed) * (X1 - X0);
    if (x > X0 + DOOR.u0 - 3 && x < X0 + DOOR.u1 + 3) continue;
    const y = Y1 + 0.8 + noise(i, 2, seed) * 2;
    const h = 2 + noise(i, 3, seed) * 3.5;
    for (let z = 0; z < h; z += 0.5) s.plot(x, y, z, at(C.leaf, z > h * 0.6 ? 4 : 2));
    if (noise(i, 4, seed) < 0.18) s.plot(x, y, h, at(noise(i, 5, seed) < 0.5 ? C.rose : C.gold, 5));
  }
}

function drawFachada(f: Fachada, night: boolean): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 86, y1: 70, z1: 68 }, 2);
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 8, Y1 - Y0 + 6, 0.3);
  s.quad([X0, Y1, 0], [1, 0, 0], [0, 0, 1], X1 - X0, HW, frente(f, night));
  s.quad([X1, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, HW, costado(f, night));
  // El hastial del costado, con escamas de madera y un ojo de buey.
  s.quad([X1, Y0 - EAVE, HW], [0, 1, 0], [0, 0, 1], Y1 - Y0 + EAVE * 2, RIDGE_Z - HW, (u, v) => {
    const y = Y0 - EAVE + u;
    if (HW + v > roofZ(y) - 0.5 || y < Y0 || y > Y1) return null;
    const d = Math.hypot(y - RIDGE_Y, v - 6);
    if (d < 3) return d > 2.1 ? at(C.woodDark, 2) : night ? at(C.gold, 3) : at(C.night, 2);
    if (v < 2) return at(C.woodDark, v < 1 ? 1 : 3);
    return escamas(u, v, -1);
  });
  // El escalón de piedra delante de la puerta y el farol encima.
  s.box(X0 + DOOR.u0 - 2, Y1, 0, DOOR.u1 - DOOR.u0 + 4, 4, 2, (u, v) => stones(u, v, f.seed + 3), (u, v) => stones(u, v, f.seed + 4, 1), (u, v) => stones(u, v, f.seed + 5, 1));
  lantern(s, X0 + DOOR.u1 + 4, Y1 + 2, DOOR.v1 + 2, night);
  gableX(s, X0 - 4, X1 + 4, Y0 - EAVE, RIDGE_Y, Y1 + EAVE, RIDGE_Z, SLOPE, f.seed);
  matas(s, f.seed + 7);
  return s.sprite();
}

// La tuya va en troncos, como la cabaña, para que se reconozca; las demás son de los vecinos.
const TUYA: Fachada = { terminado: "troncos", pared: OCRE, postigos: C.green, seed: 61 };
const ESTUCO: Fachada = { terminado: "estuco", pared: OCRE, postigos: AZUL, seed: 62 };
const LADRILLO: Fachada = { terminado: "ladrillo", pared: TERRACOTA, postigos: SALVIA, seed: 63 };
const TABLAS: Fachada = { terminado: "tablas", pared: SALVIA, postigos: mixRamp(C.cream, C.woodDark), seed: 64 };

/** Postigos crema con sombra de madera (para la casa de tablas verdes). */
function mixRamp(a: Ramp, b: Ramp): Ramp {
  return a.map((c, i) => mix(c, at(b, i), 0.25));
}

export const CASA_PROPIA_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "casa-fachada-tuya": (n) => drawFachada(TUYA, n),
  "casa-fachada-estuco": (n) => drawFachada(ESTUCO, n),
  "casa-fachada-ladrillo": (n) => drawFachada(LADRILLO, n),
  "casa-fachada-tablas": (n) => drawFachada(TABLAS, n),
};
