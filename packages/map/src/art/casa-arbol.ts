// Lo de adentro de la casa del árbol (el nivel `casa-arbol`): el tronco que atraviesa el cuarto, la
// trampilla con la escalera que baja, los cojines, la mesita de tocón con la tetera y el temporizador de
// tomate, los cajones con libros, el farol de frasco y el tapete trenzado. Coordenadas locales de arte
// (tile = 16), mirando hacia +x. La casa por fuera y la escalera de cuerda están en
// art/casa-arbol-exterior.ts (el árbol se registra en outdoor.ts porque tiene versión de noche).
import { drawTreeLadder } from "./casa-arbol-exterior";
import { Escena, type Tinte } from "./exterior-escena";
import type { Variant } from "./kit";
import { BOOKS, C, mix } from "./palette";
import { at, bayer, noise, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 4) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const T = (c: RGBA): Tinte => () => c;

/** Tela de los cojines: mostaza tostada y verde salvia. */
const CUSHIONS: Record<string, Ramp> = { rust: C.curtain, sage: C.sage };

// ---------- El tronco ----------

/** Corteza con surcos y musgo (como la de afuera, un poco más clara: la luz de la ventana). */
function barkAt(ang: number, v: number, luz: number, r: number): RGBA {
  const u = ang * r;
  const groove = Math.abs(((u + smoothNoise(u, v, 8, 3) * 5) % 4) - 2) < 0.55;
  const t = (luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2) - (groove ? 1 : 0);
  if (smoothNoise(u, v, 6, 9) > 0.86 && luz < 0.3) return at(C.sage, 2);
  return at(C.logs, t);
}

/**
 * El tronco que atraviesa el cuarto (2x2): raíces que se abren sobre las tablas, una repisita clavada con
 * un frasco y una vela, y un corazón tallado con una "H".
 */
function trunk(): Sprite {
  const s = scene(3, 2, 70);
  const cx = 15;
  const cy = 15;
  s.roundShadow(cx + 1, cy + 1, 13, 0.3);
  for (let z = 0; z < 60; z += 5) {
    const r = 9.5 + (z < 6 ? (6 - z) * 0.5 : 0) - z * 0.012;
    s.cylinder(cx, cy, z, r, 5.2, (ang, v, luz) => {
      const c = barkAt(ang, z + v, luz, r);
      // El corazón tallado, mirando al cuarto (hacia +x+y).
      const du = (ang - Math.PI / 4) * r;
      const dv = z + v - 30;
      const inHeart = (grow: number) =>
        Math.hypot(Math.abs(du) - 1.3, dv) < 1.5 + grow || (dv <= 0.3 && dv > -3.4 - grow && Math.abs(du) < (dv + 3.4 + grow) * 0.82);
      if (inHeart(0.6)) {
        if (!inHeart(0)) return at(C.logs, 1);
        // La "H" tallada adentro.
        if ((Math.abs(Math.abs(du) - 1) < 0.35 && dv > -1.6 && dv < 1) || (Math.abs(dv + 0.3) < 0.3 && Math.abs(du) < 1)) return at(C.logs, 1);
        return at(C.cork, 4);
      }
      return c;
    });
  }
  // Raíces sobre el piso.
  for (const a of [0.1, 0.8, 1.5, 2.3, -0.6, 3.6]) {
    const len = 13 + noise(Math.floor(a * 10), 1, 7) * 3;
    for (let k = 9; k < len; k += 0.5) {
      const hh = Math.max(0.5, 3 * (1 - (k - 9) / (len - 9)));
      for (let z = 0; z < hh; z += 0.5) s.plot(cx + Math.cos(a) * k, cy + Math.sin(a) * k, z, at(C.logs, z > hh - 0.6 ? 4 : 3));
    }
  }
  // Repisita clavada al tronco con un frasco de hojas secas y una vela.
  const sy = cy + 9.5;
  s.box(cx - 5, sy, 38, 10, 3.5, 1.2, T(at(C.wood, 5)), T(at(C.wood, 3)), T(at(C.wood, 2)));
  s.solid(cx + 2, sy + 0.8, 39.2, 2, 2, 3.5, at(C.cream, 5), at(C.cream, 4), at(C.cream, 3));
  s.plot(cx + 3, sy + 1.8, 43.2, at(C.fire, 3));
  s.plot(cx + 3, sy + 1.8, 43.8, at(C.gold, 5));
  s.cylinder(cx - 2, sy + 1.7, 39.2, 1.7, 4, (_a, v, luz) => (v > 3.2 ? at(C.cork, 3) : luz > 0.3 ? at(C.white, 4) : mix(at(C.sky, 3), at(C.mustard, 3), v / 4)));
  // Una rama que sale arriba y corre a lo largo de la pared del fondo, con un farolito colgado.
  for (let k = 0; k < 26; k += 0.6) {
    const r = 3.2 - k * 0.07;
    s.solid(cx + k - r, cy - k * 0.45 - r, 52 + k * 0.1 - r, r * 2, r * 2, r * 2, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  }
  s.borde = false;
  for (let z = 44; z < 52; z += 0.4) s.plot(cx + 20, cy - 9, z, at(C.metal, 1));
  s.borde = true;
  s.solid(cx + 18.5, cy - 10.5, 40, 3, 3, 4, at(C.metal, 2), at(C.gold, 5), at(C.gold, 4));
  s.solid(cx + 18, cy - 11, 44, 4, 4, 1, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
  return s.sprite();
}

// ---------- La trampilla ----------

/**
 * La trampilla abierta en el piso (va plana, se pisa: es el portal que baja): el hueco con el marco, los
 * primeros palos de la escalera de cuerda y la tapa abierta, acostada al lado.
 */
function trapdoor(): Sprite {
  const s = scene(1, 1, 6);
  // Marco y hueco.
  s.box(1.5, 1.5, 0, 13, 13, 0.6, (u, v) => {
    if (u < 1.5 || v < 1.5 || u > 11.5 || v > 11.5) return at(C.woodDark, u < 1.5 || v < 1.5 ? 2 : 4);
    // Adentro, oscuro, con el pasto de abajo apenas visible y la escalera.
    const rung = Math.abs(((v - 1.5) % 4) - 2) < 0.7 && u > 3 && u < 10;
    const rope = Math.abs(u - 3.5) < 0.6 || Math.abs(u - 9.5) < 0.6;
    if (rung) return at(C.wood, 3 - Math.floor(v / 5));
    if (rope) return at(C.cork, 3 - Math.floor(v / 6));
    if (v > 9 && bayer(Math.floor(u), Math.floor(v)) < 0.3) return at(C.grass, 1);
    return at(C.night, 1);
  }, null, null);
  // La tapa abierta, acostada hacia +y al lado del hueco (baja, para no tapar a nadie).
  s.box(1.5, 14.5, 0, 12, 1.2, 1.2, T(at(C.wood, 4)), T(at(C.wood, 3)), T(at(C.wood, 2)));
  s.solid(12, 6, 0.6, 1.6, 3, 0.8, at(C.metal, 4), at(C.metal, 3), at(C.metal, 2));
  return s.sprite();
}

// ---------- Cojines ----------

/** Cojín de piso gordo, con botón al centro y la costura del borde. */
function cushion(r: Ramp): Sprite {
  const s = scene(1, 1, 14);
  s.roundShadow(8.5, 8.5, 7, 0.3);
  const H = 6;
  for (let z = 0; z < H; z += 0.5) {
    const k = z / H;
    const bulge = Math.sin(k * Math.PI) * 1.2;
    const rr = 6.4 + bulge;
    s.cylinder(8, 8, z, rr, 0.6, (a, _v, luz) => {
      if (Math.abs(z - H / 2) < 0.4) return at(r, 2);
      const t = luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2;
      return at(r, t - (Math.floor(a * 6) % 2 === 0 && k > 0.2 && k < 0.8 ? 0 : 0));
    });
  }
  s.disc(8, 8, H, 7, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < 0.9) return at(r, 1);
    // Pliegues hacia el botón.
    const a = Math.atan2(dy, dx);
    if (d < 5 && Math.abs(Math.sin(a * 3)) < 0.12) return at(r, 2);
    return at(r, d > 5.8 ? 3 : dx + dy < -2 ? 5 : 4);
  });
  return s.sprite();
}

// ---------- Mesita de tocón ----------

/**
 * Mesita baja hecha de un tocón con una tabla redonda encima: la tetera de barro, dos tazas y el
 * temporizador de tomate (el del modo foco).
 */
function stumpTable(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8.5, 8.5, 7.5, 0.3);
  s.cylinder(8, 8, 0, 4.6, 9, (a, v, luz) => barkAt(a, v, luz, 4.6));
  s.cylinder(8, 8, 9, 7.2, 2, (_a, v, luz) => at(C.wood, v > 1.2 ? 5 : luz > 0 ? 4 : 3));
  s.disc(8, 8, 11, 7.2, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    // Anillos de la madera.
    if (Math.abs((d % 1.8) - 0.9) < 0.18) return at(C.wood, 3);
    return at(C.wood, d > 6.5 ? 4 : 5);
  });
  // La tetera de barro con su tapa y el pico.
  s.cylinder(6, 7, 11, 2.6, 3.4, (_a, v, luz) => at(C.terracotta, v > 2.8 ? 4 : luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2));
  s.disc(6, 7, 14.4, 1.8, () => at(C.terracotta, 4));
  s.solid(5.6, 6.6, 14.4, 0.8, 0.8, 1, at(C.terracotta, 4), at(C.terracotta, 3), at(C.terracotta, 2));
  for (let k = 0; k < 2.6; k += 0.3) s.plot(8.5 + k * 0.6, 7.2 + k * 0.4, 12.5 + k * 0.6, at(C.terracotta, 3));
  // Dos tazas.
  for (const [x, y, col] of [
    [10.5, 10, C.cream],
    [5, 11, C.sage],
  ] as const) {
    s.cylinder(x, y, 11, 1.2, 1.8, (_a, _v, luz) => at(col, luz > 0 ? 4 : 3));
    s.disc(x, y, 12.8, 1, () => at(C.dirt, 1));
  }
  // El temporizador de tomate: rojo con la hojita verde y la raya del dial.
  s.cylinder(11, 5, 11, 1.8, 2.4, (a, v, luz) => (Math.abs(a - Math.PI / 4) < 0.18 && v > 0.8 ? at(C.cream, 5) : at(C.rug, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(11, 5, 13.4, 1.6, (dx, dy) => (Math.hypot(dx, dy) < 0.9 ? at(C.leaf, 4) : at(C.rug, 4)));
  s.plot(11, 5, 14, at(C.leaf, 3));
  return s.sprite();
}

// ---------- Cajones con libros ----------

/** Dos cajones de fruta apilados de costado (1x2): libros, un frasco con luciérnagas y una matita. */
function crates(): Sprite {
  const s = scene(1, 2, 40);
  s.shadow(1, 1, 14, 30, 0.3);
  const slats: Tinte = (u, v) => (v % 5 < 0.8 ? at(C.wood, 1) : at(C.wood, 3 + (noise(Math.floor(u / 8), Math.floor(v / 5), 3) < 0.3 ? -1 : 0)));
  for (const [y0, z0] of [
    [1, 0],
    [16, 0],
    [2, 14],
  ] as const) {
    const d = 13;
    const h = 14;
    // Fondo y costados (el frente, hacia +x, abierto).
    s.box(1, y0, z0, 3, d, h, T(at(C.wood, 4)), slats, slats);
    s.box(1, y0, z0, 12, 1.2, h, T(at(C.wood, 4)), slats, T(at(C.wood, 2)));
    s.box(1, y0 + d - 1.2, z0, 12, 1.2, h, T(at(C.wood, 4)), slats, T(at(C.wood, 2)));
    s.box(1, y0, z0, 12, d, 1.2, T(at(C.wood, 3)), null, T(at(C.wood, 2)));
    s.box(1, y0, z0 + h - 1.2, 12, d, 1.2, T(at(C.wood, 4)), slats, T(at(C.wood, 3)));
  }
  // Libros en el de abajo a la izquierda.
  let y = 2.5;
  for (let i = 0; i < 5; i++) {
    const w = 1.6 + noise(i, 1, 7) * 1.2;
    const h = 7 + noise(i, 2, 7) * 3.5;
    const col = BOOKS[(i * 3) % BOOKS.length]!;
    s.box(4.5, y, 1.2, 7, w, h, T(mix(col, at(C.cream, 5), 0.3)), T(col), (_u, v) => (Math.abs(v - h * 0.7) < 0.6 ? at(C.gold, 4) : mix(col, at(C.night, 0), 0.15)));
    y += w + 0.2;
  }
  // Frasco con luciérnagas en el de abajo a la derecha.
  s.cylinder(8, 22.5, 1.2, 2.8, 7, (_a, v, luz) => (v > 6 ? at(C.cork, 3) : mix(at(C.sky, luz > 0 ? 4 : 3), at(C.leaf, 2), 0.3)));
  for (let i = 0; i < 5; i++) s.plot(8 + (noise(i, 1, 9) - 0.5) * 3, 22.5 + (noise(i, 2, 9) - 0.5) * 3, 3 + noise(i, 3, 9) * 3.5, at(C.gold, 5));
  // Arriba, una matita en maceta y un libro abierto.
  s.cylinder(7, 7, 15.2, 2.4, 3, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 4 : 3));
  for (let i = 0; i < 30; i++) {
    const a = noise(i, 1, 13) * Math.PI * 2;
    const d = noise(i, 2, 13) * 2.8;
    s.plot(7 + Math.cos(a) * d, 7 + Math.sin(a) * d, 18.2 + noise(i, 3, 13) * 4, at(C.leaf, 2 + (i % 3)));
  }
  s.box(6, 11, 15.2, 6, 3, 0.8, (u) => (Math.abs(u - 3) < 0.4 ? at(C.cream, 2) : at(C.cream, 5)), T(at(C.cream, 3)), T(at(C.rug, 2)));
  return s.sprite();
}

// ---------- Farol de frasco ----------

/** Un frasco grande con una vela adentro y un asa de alambre, en el piso. */
function jarLantern(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(8.5, 8.5, 4.5, 0.25);
  s.cylinder(8, 8, 0, 3.6, 9, (_a, v, luz) => {
    if (v > 8) return at(C.metal, 3);
    // Vidrio: de la luz de la vela (dorado abajo) al reflejo claro del borde.
    if (luz > 0.55) return at(C.white, 4);
    return mix(at(C.gold, v < 5 ? 5 : 4), at(C.sky, 3), 0.25);
  });
  s.disc(8, 8, 9, 3.6, (dx, dy) => (Math.hypot(dx, dy) > 2.8 ? at(C.metal, 4) : at(C.gold, 4)));
  s.borde = false;
  for (let a = 0; a <= Math.PI; a += 0.1) s.plot(8 + Math.cos(a) * 3.2, 8, 9 + Math.sin(a) * 5, at(C.metal, 2));
  s.borde = true;
  return s.sprite();
}

// ---------- Tapete trenzado ----------

/** Tapete ovalado de trapos trenzados (3x3), en anillos de colores cálidos. */
function braidedRug(): Sprite {
  const s = scene(3, 3, 2);
  const RINGS = [C.curtain, C.mustard, C.sage, C.cream, C.rug, C.cork];
  s.box(0, 0, 0, 48, 48, 0.4, (u, v) => {
    const dx = (u - 24) / 22;
    const dy = (v - 24) / 20;
    const d = Math.hypot(dx, dy);
    if (d > 1) return null;
    const ring = Math.floor(d * 11);
    const r = RINGS[ring % RINGS.length]!;
    // La trenza: rayitas diagonales dentro de cada anillo.
    const braid = (Math.floor(Math.atan2(dy, dx) * 22 + ring * 0.5) + ring) % 2 === 0;
    return at(r, d > 0.93 ? 2 : braid ? 3 : 4);
  }, null, null);
  return s.sprite();
}

export const CASA_ARBOL_DRAW: Record<string, (v: Variant) => Sprite> = {
  "treehouse-ladder": () => drawTreeLadder(false),
  "treehouse-trunk": trunk,
  "treehouse-trapdoor": trapdoor,
  "treehouse-cushion": () => cushion(CUSHIONS.rust!),
  "treehouse-cushion-sage": () => cushion(CUSHIONS.sage!),
  "treehouse-table": stumpTable,
  "treehouse-crates": crates,
  "treehouse-lantern": jarLantern,
  "treehouse-rug": braidedRug,
};
