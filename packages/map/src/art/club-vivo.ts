// Capas del club y del arcade que se dibujan encima de los muebles cuando pasa algo: las luces de la
// pista al ritmo, la tarima encendida con alguien en el tubo, el ecualizador de la cabina, el woofer de
// los parlantes y las pantallas de las máquinas. Cada capa repite las cajas del mueble (con caras vacías
// donde no pinta), así queda con el mismo origen y cae justo encima del dibujo.
import { C } from "./palette";
import { at, noise, renderSprite, type Box, type Ramp, type Shader, type Sprite } from "./pixel";

const mod = (n: number, m: number) => ((n % m) + m) % m;
const none: Shader = () => null;
/** Caja de un mueble sin nada pintado (solo para que la capa mida lo mismo). */
const ghost = (b: Omit<Box, "top" | "left" | "right">): Box => ({ ...b, top: none, left: none, right: none });

// ---------- Pista de baile ----------

/** Cuántos dibujos de luces tiene la pista (cambia uno por tiempo de la música). */
export const FLOOR_LIGHT_PATTERNS = 8;
const FLOOR_COLORS: Ramp[] = [C.neon, C.cyan, C.violet, C.gold];

/** ¿Se prende la baldosa (cx, cy) en el dibujo `p`? Y de qué color. */
function floorCell(p: number, cx: number, cy: number): Ramp | null {
  const k = Math.floor(p / 4);
  const color = (n: number) => FLOOR_COLORS[mod(n + p, FLOOR_COLORS.length)]!;
  switch (p % 4) {
    case 0:
      // Damero.
      return mod(cx + cy + k, 2) === 0 ? color(Math.floor((cx + cy) / 2)) : null;
    case 1:
      // Diagonales que corren.
      return mod(cx - cy + k, 3) === 0 ? color(cx) : null;
    case 2: {
      // Anillos desde el centro.
      const r = Math.max(Math.abs(cx - 4.5), Math.abs(cy - 4.5));
      return mod(Math.floor(r) + k, 2) === 0 ? color(Math.floor(r)) : null;
    }
    default:
      // Chispazos sueltos.
      return noise(cx, cy, 31 + p) < 0.42 ? color(cx + cy) : null;
  }
}

/**
 * Luces de la pista (5x5 tiles, como `danceFloor` de sotano.ts): las baldosas prendidas del dibujo `p`
 * brillan con su color, con el reflejo en la esquina; las apagadas quedan transparentes (se ve la pista oscura).
 */
export function danceFloorLights(p: number): Sprite {
  const S = 80;
  const top: Shader = (u, v, fw, fh) => {
    const e = Math.min(u, v, fw - 1 - u, fh - 1 - v);
    if (e < 2) {
      // El borde: bombillos que corren alrededor.
      return e >= 1 && mod(Math.floor(u + v) + p, 4) === 0 ? at(C.gold, 5) : null;
    }
    const x = u - 2;
    const y = v - 2;
    const lu = mod(x, 8);
    const lv = mod(y, 8);
    if (lu < 1 || lv < 1) return null;
    const r = floorCell(p, Math.floor(x / 8), Math.floor(y / 8));
    if (!r) return null;
    if (lu < 2.5 && lv < 2.5) return at(r, 5);
    return at(r, lu + lv > 11 ? 3 : 4);
  };
  return renderSprite([{ x: 0, y: 0, z: 0, w: S, d: S, h: 1, top, left: none, right: none }]);
}

// ---------- Tarima del tubo ----------

/** Tarima encendida (como `poleStage` de casino.ts): los bombillos del borde corren y el aro de neón brilla. */
export function poleStageLights(phase: number): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    const d = Math.hypot(u + 0.5 - fw / 2, v + 0.5 - fh / 2) / (fw / 2);
    if (d > 0.93 || d <= 0.72) return null;
    if (d > 0.84) {
      const a = Math.atan2(v + 0.5 - fh / 2, u + 0.5 - fw / 2);
      const bulb = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 28);
      if (bulb % 2) return mod(bulb + phase * 2, 6) < 2 ? at(C.cream, 5) : at(C.gold, 5);
      return null;
    }
    return d > 0.76 ? at(C.neon, phase % 2 ? 5 : 4) : at(C.neon, 3);
  };
  return renderSprite([{ x: 0.5, y: 0.5, z: 0, w: 47, d: 47, h: 1, top, left: none, right: none }]);
}

// ---------- Cabina de DJ ----------

/** Ecualizador de la cabina (como `djBooth` de club.ts) con las barras a la altura de `levels` (0 a 1). */
export function djBoothEq(levels: readonly number[]): Sprite {
  const eq: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5 || v < 1 || u < 1 || u >= fw - 1) return null;
    const k = Math.floor((u - 1) / 3);
    if ((u - 1) % 3 >= 2) return null;
    const h = Math.round((levels[k % levels.length] ?? 0) * (fh - 3));
    if (v < 2 || v >= 2 + h) return null;
    const t = (v - 2) / (fh - 5);
    return t < 0.45 ? at(C.cyan, 5) : t < 0.8 ? at(C.neon, 5) : at(C.gold, 5);
  };
  // Los platos giran: una marca clara que da la vuelta.
  const disc = (turn: number): Shader => (u, v, fw, fh) => {
    const dx = u + 0.5 - fw / 2;
    const dy = v + 0.5 - fh / 2;
    const r = Math.hypot(dx, dy);
    if (r < 1.2) return at(C.neon, 5);
    const a = Math.atan2(dy, dx);
    return r < 3.8 && Math.abs(mod(a - turn, Math.PI * 2) - Math.PI) > Math.PI - 0.5 ? at(C.cream, 5) : null;
  };
  const turn = (levels[0] ?? 0) * Math.PI * 2;
  return renderSprite([
    { x: 2, y: 0, z: 0, w: 12, d: 32, h: 15, top: none, left: none, right: eq },
    { x: 3, y: 2, z: 15, w: 9, d: 10, h: 1.5, top: disc(turn), left: none, right: none },
    { x: 3, y: 20, z: 15, w: 9, d: 10, h: 1.5, top: disc(-turn * 1.3), left: none, right: none },
    ghost({ x: 4, y: 13, z: 15, w: 7, d: 6, h: 2.5 }),
    ghost({ x: 5, y: 26, z: 16.5, w: 3, d: 2, h: 1.5 }),
  ]);
}

// ---------- Parlantes ----------

/** Woofer del parlante (como `speaker` de club.ts) empujado hacia afuera en el golpe (`push` 0, 1 o 2). */
export function speakerPulse(push: number): Sprite {
  const front: Shader = (u, v, fw) => {
    const w = Math.hypot(u + 0.5 - fw / 2, v - 8);
    const r = 3.4 + push * 0.5;
    if (w < 1.2 + push * 0.3) return at(C.cyan, push > 1 ? 5 : 4);
    if (w > r - 0.8 && w < r + 0.2) return at(C.metal, 4);
    if (w < r && push > 0) return at(C.metal, Math.floor(w * 2) % 2 ? 2 : 3);
    const t = Math.hypot(u + 0.5 - fw / 2, v - 19);
    if (t < 0.9) return at(C.cyan, 5);
    return null;
  };
  return renderSprite([
    { x: 3, y: 3, z: 0, w: 10, d: 10, h: 26, top: none, left: none, right: front },
    ghost({ x: 2.5, y: 2.5, z: 0, w: 11, d: 11, h: 1 }),
  ]);
}

// ---------- Pantallas del arcade ----------

export type ArcadeScreenKind = "snake" | "breakout" | "flappy" | "bloques" | "off";

/**
 * Pantalla de una máquina del arcade (como `arcadeCabinet` de leisure.ts), en modo demostración: la
 * culebrita que avanza, los ladrillos con la pelota, el pajarito entre tubos, una pieza de Bloques que
 * cae sobre la pila, o "fuera de servicio"
 * (estática y una franja roja). `frame` anima la demo.
 */
export function arcadeScreen(kind: ArcadeScreenKind, frame: number): Sprite {
  const front: Shader = (u, v, fw, fh) => {
    if (!(v >= 14 && v < fh - 7 && u >= 1.5 && u < fw - 1.5)) return null;
    const x = Math.floor(u - 1.5);
    const y = Math.floor(fh - 7 - v);
    const W = Math.floor(fw - 3);
    switch (kind) {
      case "snake": {
        // Culebrita en zigzag que avanza y una manzana.
        const path = [0, 1, 2, 3, 4, 5, 6].map((k) => mod(k + frame, 7));
        if (y === 6 && x === 1) return at(C.rug, 4);
        if (y >= 1 && y <= 3 && path.includes(x) && (y === 2 || (y === 1 && x === path[6]) || (y === 3 && x === path[0])))
          return at(C.leaf, x === mod(frame + 6, 7) ? 5 : 4);
        return at(C.night, y % 2 ? 1 : 0);
      }
      case "breakout": {
        if (y <= 2 && x % 2 === 0) return at([C.rug, C.gold, C.cyan][y]!, (x + frame) % 4 === 0 && y === 1 ? 2 : 4);
        const bx = mod(frame * 2, W);
        const by = 4 + (frame % 2);
        if (x === bx && y === by) return at(C.cream, 5);
        if (y === 7 && x >= 2 && x < 5) return at(C.metal, 4);
        return at(C.navy, 0);
      }
      case "flappy": {
        const gap = 2 + (frame % 2);
        const tube = mod(5 - frame, W);
        if ((x === tube || x === tube + 1) && (y < gap || y > gap + 3)) return at(C.leaf, x === tube ? 4 : 3);
        if (x === 1 && y === 3 + (frame % 2)) return at(C.gold, 5);
        return at(C.blue, y > 6 ? 2 : 3);
      }
      case "bloques": {
        // La pila de abajo (dos filas con huecos) y una "T" que baja por el medio.
        const H = 8;
        if (y >= H - 2) return (x + y) % 3 === 0 ? at(C.night, 0) : at([C.cyan, C.neon, C.gold][(x + y) % 3]!, 4);
        const py = mod(frame, H - 3);
        const cx = Math.floor(W / 2);
        if ((y === py && x >= cx - 1 && x <= cx + 1) || (y === py + 1 && x === cx)) return at(C.violet, 5);
        return at(C.night, 1);
      }
      default: {
        // Estática con una franja roja y el cartel apagado.
        if (y === 3 || y === 4) return at(C.rug, y === 3 ? 3 : 2);
        return at(C.stone, noise(x + frame * 7, y, 91) < 0.5 ? 1 : 3);
      }
    }
  };
  return renderSprite([
    { x: 3, y: 2, z: 0, w: 10, d: 12, h: 30, top: none, left: none, right: front },
    ghost({ x: 12, y: 2, z: 11, w: 3, d: 12, h: 2 }),
    ghost({ x: 13, y: 5, z: 13, w: 1, d: 1, h: 2 }),
    ghost({ x: 12.5, y: 4.5, z: 15, w: 2, d: 2, h: 1.5 }),
  ]);
}
