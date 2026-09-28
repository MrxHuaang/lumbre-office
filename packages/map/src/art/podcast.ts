// Los muebles del estudio de grabación (el nivel `podcast`): la mesa grande de madera con un micrófono de
// brazo y unos audífonos por puesto, la consola de mezcla (ahí va "E · Grabar"), el escritorio con el
// monitor de código verde y el teclado mecánico, la repisa baja con planetas de juguete, el cohete de
// madera a escala, el cristal que brilla sobre su pedestal, la alfombra de estrellas y los cables. Todo
// original y dibujado aquí. Coordenadas locales de arte (tile = 16), mirando hacia +x. Lo que cuelga en
// las paredes está en art/podcast-room.ts.
import { Escena, type Tinte } from "./exterior-escena";
import type { Variant } from "./kit";
import { BOOKS, C, mix } from "./palette";
import { at, bayer, noise, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 5) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const T = (c: RGBA): Tinte => () => c;

/** Vetas de una tabla: tono por tabla (a lo largo de x) y alguna línea oscura. */
const planks = (u: number, v: number, seed: number, base = 4): RGBA => {
  if (v % 8 < 0.5) return at(C.wood, base - 2);
  const k = Math.floor(v / 8);
  const tone = noise(k, Math.floor((u + k * 13) / 22), seed);
  return at(C.wood, base - (tone < 0.3 ? 1 : 0) + (tone > 0.85 ? 1 : 0));
};

// ---------- La mesa grande ----------

/** Micrófono de brazo en (bx, by) sobre la mesa (a la altura `z`), con la cápsula hacia `dir` (±1 en y). */
function mic(s: Escena, bx: number, by: number, z: number, dir: number) {
  // Pie con su abrazadera, el brazo que sube en dos tramos y la cápsula con el filtro redondo.
  s.solid(bx - 1.2, by - 1.2, z, 2.4, 2.4, 1.4, at(C.woodDark, 2), at(C.woodDark, 1), at(C.woodDark, 1));
  const tip = { y: by + dir * 7, z: z + 9 };
  for (let k = 0; k <= 1; k += 0.025) {
    const y = by + dir * k * 7;
    const hz = z + 1.4 + Math.sin(k * Math.PI * 0.85) * 12 + k * 2;
    s.plot(bx, y, hz, at(C.woodDark, k < 0.5 ? 3 : 2));
    if (k > 0.3 && k < 0.34) s.plot(bx + 0.5, y, hz, at(C.gold, 3));
  }
  // Cápsula chica de madera oscura con la rejilla dorada arriba.
  s.cylinder(bx, tip.y, tip.z - 3, 1, 3.4, (_a, v, luz) => (v > 2.2 ? at(C.gold, luz > 0 ? 4 : 3) : at(C.woodDark, luz > 0.3 ? 2 : 1)));
  // El filtro: un aro fino delante de la cápsula, con la tela apenas visible.
  s.borde = false;
  for (let a = 0; a < Math.PI * 2; a += 0.2) s.plot(bx + Math.cos(a) * 1.8, tip.y + dir * 2.2, tip.z - 1.4 + Math.sin(a) * 1.8, at(C.woodDark, 2));
  for (let a = 0; a < Math.PI * 2; a += 0.6) for (let r = 0.4; r < 1.4; r += 0.5) s.plot(bx + Math.cos(a) * r, tip.y + dir * 2.2, tip.z - 1.4 + Math.sin(a) * r, [60, 40, 36, 110]);
  s.borde = true;
}

/** Audífonos acostados sobre la mesa: la vincha en arco (del color del puesto) y las dos almohadillas. */
function headphones(s: Escena, cx: number, cy: number, z: number, color: RGBA) {
  for (let a = 0; a <= Math.PI; a += 0.05) for (const r of [2.3, 2.7]) s.plot(cx + Math.cos(a) * r, cy - Math.sin(a) * r * 0.8, z + 0.4, color);
  for (const dx of [-2.5, 2.5]) s.cylinder(cx + dx, cy, z, 1.1, 1.2, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 2 : 1));
}

/**
 * La mesa de grabación (4x2): tablero grueso de tablas con el canto redondeado, patas torneadas y, por
 * cada uno de los ocho puestos (cuatro al norte, cuatro al sur), su micrófono de brazo y sus audífonos.
 * Al medio, el camino de fieltro con los cables, tazas, libretas y un vasito con lápices.
 */
function podcastTable(): Sprite {
  const W = 64;
  const D = 32;
  const Z = 13;
  const s = scene(4, 2, 44);
  s.shadow(1, 1, W - 1, D - 1, 0.3);
  for (const [x, y] of [
    [3, 3],
    [W - 6, 3],
    [3, D - 6],
    [W - 6, D - 6],
    [W / 2 - 1.5, 3],
    [W / 2 - 1.5, D - 6],
  ] as const)
    s.cylinder(x + 1.5, y + 1.5, 0, 1.4, Z, (_a, v, luz) => at(C.woodDark, (luz > 0.3 ? 4 : 3) - (Math.abs(v - 9) < 0.6 ? 1 : 0)));
  // Travesaño bajo las patas del largo.
  s.solid(4, D / 2 - 1, 4, W - 8, 2, 1.6, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 2));
  s.box(0, 0, Z, W, D, 2.4, (u, v) => planks(u, v, 7), (u, v) => (v > 1.8 ? at(C.wood, 4) : at(C.wood, 2)), (u, v) => (v > 1.8 ? at(C.wood, 3) : at(C.wood, 1)));
  const top = Z + 2.4;
  // Camino de fieltro verde a lo largo, con un cable que lo recorre.
  s.box(3, D / 2 - 4, top, W - 6, 8, 0.3, (u, v) => (v < 0.8 || v > 7.2 ? at(C.sage, 1) : at(C.sage, bayer(Math.floor(u), Math.floor(v)) < 0.2 ? 2 : 3)), null, null);
  s.borde = false;
  for (let u = 4; u < W - 4; u += 0.3) s.plot(u, D / 2 + Math.sin(u * 0.4) * 1.2, top + 0.45, at(C.night, 2));
  s.borde = true;
  const phones = [C.rug, C.mustard, C.sage, C.fabric];
  for (let i = 0; i < 4; i++) {
    const cx = 8 + i * 16;
    // Norte (los puestos de y = -1): el micrófono llega desde el camino hacia el borde de atrás.
    mic(s, cx - 3, D / 2 - 5, top, -1);
    headphones(s, cx + 3.5, 5.5, top, at(phones[i]!, 3));
    // Sur.
    mic(s, cx + 3, D / 2 + 5, top, 1);
    headphones(s, cx - 3.5, D - 3.5, top, at(phones[(i + 2) % 4]!, 3));
  }
  // Tazas, una libreta abierta y el vasito con lápices sobre el camino.
  for (const [x, y, c] of [
    [14, 13, C.cream],
    [40, 18, C.terracotta],
    [55, 13, C.sage],
  ] as const)
    s.cylinder(x, y, top, 1.4, 2.6, (_a, _v, luz) => at(c, luz > 0 ? 4 : 2));
  s.box(24, 13, top, 7, 5, 0.6, (u) => (Math.abs(u - 3.5) < 0.4 ? at(C.cream, 2) : at(C.cream, 5)), T(at(C.cream, 3)), T(at(C.cream, 2)));
  s.cylinder(48, 17, top, 1.1, 3, (_a, _v, luz) => at(C.wood, luz > 0 ? 3 : 2));
  for (const [dx, c] of [
    [-0.4, C.rug],
    [0.3, C.mustard],
    [0, C.sage],
  ] as const)
    for (let k = 3; k < 6; k += 0.4) s.plot(48 + dx, 17 + dx, top + k, at(c, 3));
  return s.sprite();
}

// ---------- La consola ----------

/**
 * La consola de mezcla (1x2), en la cabecera de la mesa: mueble de madera con la mezcladora inclinada
 * encima (perillas, faders, los vúmetros encendidos y una pantallita con la onda), mirando al este.
 */
function podcastConsole(): Sprite {
  const s = scene(1, 2, 36);
  s.shadow(1, 1, 15, 31, 0.3);
  s.box(3, 1, 0, 12, 30, 13, (u, v) => planks(v, u, 11, 3), (u, v) => (v < 1 ? at(C.woodDark, 2) : at(C.wood, 3)), (u, v) => {
    // Frente del mueble: dos puertitas con perilla.
    if (v < 1 || v > 12) return at(C.woodDark, 2);
    if (Math.abs(u - 15) < 0.5) return at(C.woodDark, 2);
    if (Math.hypot(u - 13, v - 7) < 0.7 || Math.hypot(u - 17, v - 7) < 0.7) return at(C.gold, 4);
    return at(C.wood, u < 1.5 || u > 28.5 || v < 2 || v > 11 ? 2 : 3);
  });
  // La mezcladora: un plano inclinado hacia el este (hacia quien la usa, parado al lado), bajo en x = 13.
  const panel = (u: number, v: number): RGBA => {
    // u: a lo largo (y), v: hacia arriba del plano.
    if (u < 1 || u > 27 || v < 0.8 || v > 9.2) return at(C.wood, 4);
    // Pantallita con la onda verde, a la derecha.
    if (u > 19 && u < 26.5 && v > 3.2 && v < 8.8) {
      if (u < 19.8 || u > 25.7 || v < 4 || v > 8) return at(C.woodDark, 2);
      const wave = 6 + Math.sin(u * 2.2) * 1.2 * Math.sin(u * 0.7);
      return Math.abs(v - wave) < 0.45 ? at(C.leaf, 5) : at(C.screen, 0);
    }
    // Por canal (seis): la perilla arriba, la lucecita y el fader con su tapa crema.
    const ch = Math.floor((u - 1) / 3);
    const cu = mod3(u - 1);
    if (u < 19) {
      if (Math.abs(cu - 1.5) < 1 && Math.abs(v - 7.8) < 0.9) return at(ch % 2 ? C.cream : C.mustard, 4);
      if (Math.abs(cu - 1.5) < 0.5 && Math.abs(v - 6) < 0.4) return ch === 2 ? at(C.rug, 4) : at(C.leaf, 5);
      const knob = 2 + noise(ch, 1, 5) * 2.2;
      if (Math.abs(cu - 1.5) < 1 && Math.abs(v - knob) < 0.6) return at(C.cream, 5);
      if (Math.abs(cu - 1.5) < 0.3 && v > 1.4 && v < 5) return at(C.woodDark, 0);
    }
    return at(C.woodDark, 1);
  };
  s.quad([13, 1.5, 13], [0, 1, 0], [-0.9, 0, 0.45], 28, 10, panel);
  // Lados del plano inclinado (cuñas de madera).
  for (const y of [1.5, 29.5])
    for (let x = 4; x < 13; x += 0.4) for (let z = 13; z < 13 + (13 - x) * 0.45; z += 0.4) s.plot(x, y, z, at(C.wood, 2));
  return s.sprite();
}

const mod3 = (n: number) => ((n % 3) + 3) % 3;

// ---------- El escritorio del código ----------

/**
 * Escritorio (1x2) contra la pared con el monitor de código verde, el teclado mecánico de teclas de
 * colores, una taza, el pato de goma de depurar y una plantita.
 */
function codeDesk(): Sprite {
  const s = scene(1, 2, 44);
  s.shadow(0, 0, 16, 32, 0.3);
  for (const [x, y] of [
    [1, 1],
    [13, 1],
    [1, 29],
    [13, 29],
  ] as const)
    s.solid(x, y, 0, 2, 2, 12, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.solid(1, 3, 3, 1.5, 26, 1.5, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 2));
  s.box(0, 0, 12, 16, 32, 2, (u, v) => planks(v, u, 17, 4), T(at(C.wood, 3)), T(at(C.wood, 2)));
  const top = 14;
  // Monitor: pie, marco de madera clara y la pantalla hacia +x con líneas de código verde.
  s.solid(3, 14, top, 3, 4, 1, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 2));
  s.solid(3.8, 15.2, top + 1, 1.4, 1.6, 4, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 2));
  s.box(2.5, 7, top + 5, 2, 18, 13, T(at(C.woodDark, 3)), T(at(C.woodDark, 2)), (u, v) => {
    if (u < 1 || u > 17 || v < 1 || v > 12) return at(C.wood, 4);
    // Renglones con sangría (llaves que abren y cierran) y el cursor.
    const row = Math.floor((12 - v) / 1.5);
    const indent = [0, 1, 2, 2, 1, 2, 0][row % 7]! * 1.5;
    const len = 4 + noise(row, 2, 19) * 9;
    const x = u - 1.5 - indent;
    if ((12 - v) % 1.5 < 0.7 && x > 0 && x < len) return at(row % 3 === 1 ? C.gold : C.leaf, x < 1.5 ? 3 : 5);
    if (row === 6 && x > len + 0.5 && x < len + 1.5) return at(C.leaf, 5);
    return at(C.green, 0);
  });
  // Teclado mecánico: base de madera y teclas en filas (algunas de color).
  s.solid(8, 8, top, 5, 14, 1.2, at(C.wood, 2), at(C.wood, 1), at(C.wood, 1));
  for (let r = 0; r < 4; r++)
    for (let k = 0; k < 11; k++) {
      const special = (r === 3 && k > 2 && k < 8) || (r + k) % 9 === 0;
      const c = special ? (r === 3 ? at(C.cream, 3) : at(C.rug, 3)) : (k + r) % 5 === 0 ? at(C.mustard, 3) : at(C.cream, 4);
      s.solid(8.4 + r * 1.15, 8.5 + k * 1.2, top + 1.2, 0.9, 1, 0.8, c, mix(c, at(C.woodDark, 2), 0.4), mix(c, at(C.woodDark, 2), 0.5));
    }
  // Taza, el pato de goma y una suculenta en su maceta.
  s.cylinder(11, 25, top, 1.5, 2.8, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 4 : 3));
  s.cylinder(6.5, 27, top, 2, 2.2, (_a, _v, luz) => at(C.mustard, luz > 0 ? 4 : 3));
  s.disc(6.5, 27, top + 2.2, 2, () => at(C.mustard, 4));
  s.cylinder(7.8, 27.8, top + 2.2, 1.1, 1.8, (_a, _v, luz) => at(C.mustard, luz > 0 ? 4 : 3));
  s.plot(9, 28.8, top + 3.2, at(C.fire, 3));
  s.plot(8.3, 28.6, top + 3.6, at(C.night, 1));
  s.cylinder(4, 3.5, top, 1.8, 2.5, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 4 : 2));
  for (let i = 0; i < 20; i++) {
    const a = noise(i, 1, 23) * Math.PI * 2;
    const d = noise(i, 2, 23) * 1.6;
    s.plot(4 + Math.cos(a) * d, 3.5 + Math.sin(a) * d, top + 2.6 + noise(i, 3, 23) * 2.2, at(C.sage, 3 + (i % 2)));
  }
  return s.sprite();
}

// ---------- La repisa ----------

/**
 * Repisa baja (1x3) contra la pared: dos niveles con libros, discos y, encima, planetas de juguete en
 * sus soportes, un cristalito y una matita.
 */
function spaceShelf(): Sprite {
  const s = scene(1, 3, 34);
  s.shadow(0, 0, 13, 48, 0.3);
  s.box(0, 0, 0, 11, 48, 14, (u, v) => planks(v, u, 29, 4), T(at(C.wood, 3)), (u, v) => {
    if (u < 1 || u > 47 || v < 1 || v > 13 || (v > 6.5 && v < 7.5)) return at(C.wood, 2);
    // Adentro: libros abajo, discos arriba (se ven los lomos).
    if (v < 6.5) {
      const k = Math.floor((u - 1) / 2.3);
      if (u > 30 && u < 36) return at(C.woodDark, 1);
      const tall = 3.5 + noise(k, 1, 31) * 2;
      return v < 1 + tall ? mix(BOOKS[k % BOOKS.length]!, at(C.woodDark, 2), mod3(u) < 0.4 ? 0.4 : 0) : at(C.woodDark, 1);
    }
    const k = Math.floor((u - 1) / 1.2);
    if (u > 20) return at(C.woodDark, 1);
    return [at(C.night, 2), at(C.rug, 2), at(C.night, 3), at(C.mustard, 2)][k % 4]!;
  });
  const top = 14;
  // Planetas en soportes: uno con anillo, uno verde, uno rojo; el cristalito y la matita.
  const ball = (cx: number, cy: number, r: number, c: typeof C.mustard) => {
    s.solid(cx - 0.4, cy - 0.4, top, 0.8, 0.8, 3, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 2));
    for (let a = 0; a < Math.PI * 2; a += 0.12)
      for (let b = -Math.PI / 2; b <= Math.PI / 2; b += 0.15) {
        const nx = Math.cos(a) * Math.cos(b);
        const ny = Math.sin(a) * Math.cos(b);
        const nz = Math.sin(b);
        const luz = nz * 0.6 + ny * 0.5 - nx * 0.2;
        s.plot(cx + nx * r, cy + ny * r, top + 3 + r + nz * r, at(c, luz > 0.4 ? 4 : luz > -0.2 ? 3 : 2));
      }
  };
  ball(5.5, 7, 3, C.mustard);
  for (let a = 0; a < Math.PI * 2; a += 0.05) s.plot(5.5 + Math.cos(a) * 5, 7 + Math.sin(a) * 5, top + 6 + Math.cos(a) * 0.8, at(C.cream, 4));
  ball(5.5, 20, 2.3, C.sage);
  ball(5.5, 40, 1.8, C.rug);
  // El cristalito: un rombo cian.
  for (let z = 0; z < 7; z += 0.3) {
    const r = z < 3 ? z * 0.6 : (7 - z) * 0.45;
    for (let a = 0; a < Math.PI * 2; a += 0.4) s.plot(5.5 + Math.cos(a) * r, 29 + Math.sin(a) * r, top + 0.5 + z, at(C.cyan, a > 1 && a < 2.5 ? 5 : z > 3 ? 4 : 3));
  }
  s.cylinder(5.5, 45, top, 1.8, 2.4, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 4 : 2));
  for (let i = 0; i < 26; i++) {
    const a = noise(i, 1, 37) * Math.PI * 2;
    const d = noise(i, 2, 37) * 2;
    s.plot(5.5 + Math.cos(a) * d, 45 + Math.sin(a) * d, top + 2.6 + noise(i, 3, 37) * 3.5, at(C.leaf, 2 + (i % 3)));
  }
  return s.sprite();
}

// ---------- El cohete de madera ----------

/** Cohete de madera a escala (1x1) en su trípode: cuerpo de duelas, ventanilla, punta roja y aletas. */
function woodRocket(): Sprite {
  const s = scene(1, 1, 52);
  const cx = 8;
  const cy = 8;
  s.roundShadow(cx + 1, cy + 1, 6, 0.28);
  // Trípode.
  for (const a of [0.3, 2.4, 4.4]) for (let k = 0; k <= 1; k += 0.05) s.plot(cx + Math.cos(a) * 5.5 * (1 - k), cy + Math.sin(a) * 5.5 * (1 - k), k * 10, at(C.woodDark, 3));
  s.disc(cx, cy, 10, 2.6, () => at(C.woodDark, 4));
  // Aletas (tres tablitas).
  for (const a of [Math.PI / 4, (Math.PI * 11) / 12, (Math.PI * 19) / 12])
    for (let k = 0; k < 4.5; k += 0.3) for (let z = 0; z < 7 - k * 0.8; z += 0.3) s.plot(cx + Math.cos(a) * (3 + k), cy + Math.sin(a) * (3 + k), 11 + z, at(C.rug, a < 1 ? 4 : 3));
  // Cuerpo de duelas con dos aros de bronce y la ventanilla.
  s.cylinder(cx, cy, 11, 3.2, 22, (ang, v, luz) => {
    if (Math.abs(v - 2) < 0.6 || Math.abs(v - 17) < 0.6) return at(C.gold, luz > 0.2 ? 4 : 3);
    const du = (ang - Math.PI / 4) * 3.2;
    const dw = Math.hypot(du, v - 12);
    if (dw < 2.2) return dw > 1.6 ? at(C.gold, 4) : at(C.sky, luz > 0.5 ? 4 : 3);
    const stave = Math.floor(ang * 3.2 / 1.6) % 2;
    return at(C.wood, (luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2) - stave);
  });
  s.cone(cx, cy, 33, 3.2, 9, (_a, _s, luz) => at(C.rug, luz > 0.5 ? 4 : luz > 0 ? 3 : 2));
  return s.sprite();
}

// ---------- El cristal ----------

/** Pedestal de madera con aros dorados y un cristal que flota encima, cian con el corazón claro. */
function crystal(): Sprite {
  const s = scene(1, 1, 50);
  const cx = 8;
  const cy = 8;
  s.roundShadow(cx + 1, cy + 1, 5, 0.3);
  s.cylinder(cx, cy, 0, 4.5, 3, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 4 : 3));
  s.disc(cx, cy, 3, 4.5, () => at(C.woodDark, 4));
  s.cylinder(cx, cy, 3, 2.6, 12, (_a, v, luz) => (Math.abs(v - 10) < 0.7 ? at(C.gold, 4) : at(C.wood, luz > 0.3 ? 4 : luz > -0.2 ? 3 : 2)));
  s.cylinder(cx, cy, 15, 4, 2, (_a, _v, luz) => at(C.gold, luz > 0 ? 4 : 3));
  s.disc(cx, cy, 17, 4, (dx, dy) => (Math.hypot(dx, dy) > 3 ? at(C.gold, 4) : at(C.woodDark, 2)));
  // El cristal: dos pirámides de base cuadrada (la de arriba más alta), con una arista hacia la cámara:
  // la cara de la izquierda con luz, la de la derecha en sombra y el filo claro al medio.
  const z0 = 21;
  for (let z = 0; z < 20; z += 0.25) {
    const r = z < 6 ? z * 0.6 : (20 - z) * 0.26;
    const low = z < 6;
    for (let t = -1; t <= 1; t += 0.06) {
      // Cara izquierda (y = +r) y cara derecha (x = +r); el filo de adelante en t = 1.
      s.plot(cx + r * t, cy + r, z0 + z, t > 0.85 ? at(C.white, 4) : at(C.cyan, low ? 4 : 5));
      s.plot(cx + r, cy + r * t, z0 + z, t > 0.85 ? at(C.white, 4) : at(low ? C.violet : C.cyan, low ? 4 : 3));
    }
  }
  // Destellos alrededor.
  s.borde = false;
  for (const [dx, dy, dz] of [
    [-5, 1, 30],
    [4, -4, 36],
    [3, 5, 26],
  ] as const)
    s.plot(cx + dx, cy + dy, dz, at(C.cyan, 5));
  s.borde = true;
  return s.sprite();
}

// ---------- Alfombra y cables ----------

/**
 * La alfombra grande bajo la mesa (6x4): borde tejido terracota y mostaza con rombos y, al centro,
 * azul noche con estrellitas doradas, una luna y dos planetitas bordados.
 */
function starRug(): Sprite {
  const s = scene(6, 4, 2, 2);
  const W = 96;
  const D = 64;
  s.box(1, 1, 0, W - 2, D - 2, 0.4, (u, v) => {
    const e = Math.min(u, v, W - 2 - u, D - 2 - v);
    if (e < 1) return at(C.terracotta, 2);
    if (e < 5) {
      // Franja de rombos mostaza sobre terracota.
      const k = Math.abs(((u + v) % 6) - 3) + Math.abs(((u - v + 600) % 6) - 3);
      return k < 1.6 ? at(C.mustard, 4) : at(C.terracotta, e < 2 ? 3 : 2);
    }
    if (e < 6) return at(C.mustard, 3);
    const x = u - W / 2;
    const y = v - D / 2;
    if (Math.hypot(x + 30, y + 16) < 3.5 && Math.hypot(x + 28.5, y + 17) > 3) return at(C.cream, 4);
    if (Math.hypot(x - 32, y - 14) < 2.8) return at(C.sage, 3);
    if (Math.hypot(x - 29, y + 17) < 2) return at(C.rug, 3);
    const st = noise(Math.floor(u / 2), Math.floor(v / 2), 43);
    if (st > 0.94) return at(C.gold, (Math.floor(u) + Math.floor(v)) % 2 ? 4 : 5);
    return at(C.navy, bayer(Math.floor(u), Math.floor(v)) < 0.2 ? 3 : 2);
  }, null, null);
  return s.sprite();
}

/** Cables en el piso (2x1): de la consola a la pared, enroscados, con un alargue de madera. */
function cables(): Sprite {
  const s = scene(2, 1, 4, 2);
  s.borde = false;
  const lines: [number, number, number, RGBA][] = [
    [8, 1.2, 0.2, at(C.night, 2)],
    [5, 1.6, 1.3, at(C.rug, 2)],
    [11, 0.9, 2.1, at(C.mustard, 2)],
  ];
  for (const [y0, amp, ph, c] of lines)
    for (let u = 0; u < 30; u += 0.2) {
      const y = y0 + Math.sin(u * 0.35 + ph) * amp + Math.sin(u * 0.9 + ph) * 0.5;
      s.plot(u, y, 0.4, c);
      s.plot(u, y + 0.4, 0.4, c);
    }
  s.borde = true;
  s.solid(24, 5, 0, 6, 3, 1.4, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  for (const x of [25.5, 27.5]) s.plot(x, 6.5, 1.5, at(C.woodDark, 1));
  return s.sprite();
}

export const PODCAST_DRAW: Record<string, (v: Variant) => Sprite> = {
  "podcast-table": podcastTable,
  "podcast-console": podcastConsole,
  "podcast-code-desk": codeDesk,
  "podcast-shelf": spaceShelf,
  "podcast-rocket": woodRocket,
  "podcast-crystal": crystal,
  "podcast-rug": starRug,
  "podcast-cables": cables,
};
