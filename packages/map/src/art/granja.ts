// La granja del jardín por código: la parrilla con el horno de barro, el gallinero con el corral y el
// establo chico de la cabra, y el molino de agua con su rueda y el puentecito del arroyo. Coordenadas
// locales de arte (tile = 16), mirando hacia +x, como el resto de afuera. Estética de la cabaña: madera,
// piedra de río, barro y tejas rojizas, con apenas un toque de uso.
// También los animales (gallinas y cabra, cuadros sueltos como las mascotas) y las capas que anima el
// cliente: la rueda que gira y los huevos en el nido.
import { Escena, type Tinte } from "./exterior-escena";
import { lantern, planks, stones, tejas } from "./exterior-patio";
import { C, OUT, SHADOW, mix } from "./palette";
import { PixelCanvas, alpha, at, hex, noise, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Ladrillo cocido: hiladas de 3 con juntas corridas. */
const brick: Tinte = (u, v) => {
  const row = Math.floor(v / 3);
  if (v % 3 < 0.7 || (u + (row % 2) * 3) % 6 < 0.7) return at(C.terracotta, 1);
  return at(C.terracotta, noise(Math.floor((u + (row % 2) * 3) / 6), row, 5) < 0.25 ? 2 : 3);
};

/** Barro del horno: tono de tierra cocida con manchas y alguna grieta fina. */
function clay(a: number, v: number, luz: number): RGBA {
  const n = noise(Math.floor(a * 12), Math.floor(v / 2), 7);
  const base = luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2;
  if (n > 0.93) return at(C.terracotta, base - 2);
  return mix(at(C.terracotta, base), at(C.dirt, base), n < 0.35 ? 0.55 : 0.3);
}

/** Una llama chica pintada en 2D (la boca del horno, las brasas). */
function flame(s: Escena, x: number, y: number, z: number, rx: number, h: number) {
  const q = s.p(x, y, z);
  for (let j = 0; j < h; j++) {
    const w = rx * Math.sin((1 - j / h) * Math.PI * 0.6 + 0.08);
    for (let i = -Math.ceil(w); i <= Math.ceil(w); i++) {
      if (Math.abs(i) > w) continue;
      const k = Math.abs(i) / Math.max(1, w) + j / h;
      s.canvas.set(Math.round(q.x + i), Math.round(q.y - j), at(C.fire, k < 0.5 ? 4 : k < 0.9 ? 3 : 2));
    }
  }
}

// ---------- Parrilla ----------

/** Horno de barro abovedado sobre una basa de ladrillo; la boca (+y) con el fuego y leños a un lado. */
function clayOven(): Sprite {
  const s = scene(2, 2, 44, 6);
  const cx = 16, cy = 15, R = 12, zb = 9;
  s.roundShadow(cx + 1, cy + 2, R + 3, 0.3);
  // Basa de ladrillo con una repisa de piedra arriba.
  s.box(cx - R - 2, cy - R - 2, 0, R * 2 + 4, R * 2 + 4, zb - 1, flatT(at(C.stone, 4)), brick, (u, v) => brick(u, v) && mix(brick(u, v)!, at(C.night, 1), 0.18));
  s.box(cx - R - 3, cy - R - 3, zb - 1, R * 2 + 6, R * 2 + 6, 1.2, flatT(at(C.stone, 4)), flatT(at(C.stone, 3)), flatT(at(C.stone, 2)));
  // La cúpula: rodajas cada vez más chicas. La boca en arco mira a +y (ángulo π/2).
  const mouth = (a: number, v: number) => Math.abs(a - Math.PI / 2) < 0.52 && v < 7.5 - Math.abs(a - Math.PI / 2) * 5;
  for (let z = 0; z < R; z += 0.5) {
    const r = Math.sqrt(R * R - z * z);
    s.cylinder(cx, cy, zb + z, r, 0.55, (a, _v, luz) => {
      if (mouth(a, z)) {
        // Adentro: brasas abajo, oscuro arriba; el borde del arco, más claro (barro alisado).
        if (Math.abs(a - Math.PI / 2) > 0.44 || z > 7.5 - Math.abs(a - Math.PI / 2) * 5 - 0.9) return at(C.terracotta, 4);
        return z < 2 ? at(C.fire, 2 + (noise(Math.floor(a * 40), Math.floor(z * 2), 3) < 0.5 ? 1 : 0)) : mix(at(C.night, 0), at(C.fire, 0), 0.35);
      }
      return clay(a, z, luz);
    });
  }
  s.disc(cx, cy, zb + R - 0.2, 2.8, () => at(C.terracotta, 4));
  // Chimenea corta atrás, con un poco de hollín.
  s.cylinder(cx - 3, cy - 5, zb + R - 3, 2.2, 7, (_a, v, luz) => (v > 5.5 ? at(C.stone, 1) : at(C.terracotta, luz > 0 ? 3 : 2)));
  s.disc(cx - 3, cy - 5, zb + R + 4, 1.4, () => at(C.night, 0));
  // Llamitas en la boca.
  flame(s, cx, cy + R - 1, zb + 0.6, 2.2, 5);
  flame(s, cx + 2, cy + R - 1.5, zb + 0.4, 1.4, 3);
  // Leños apilados al costado derecho y la pala de madera apoyada.
  for (const [x, y, z] of [
    [cx + R + 1, cy + 2, 0],
    [cx + R + 1, cy + 6, 0],
    [cx + R + 1, cy + 4, 3],
  ] as const)
    s.box(x - 1.5, y - 1.5, z, 3, 3, 3, (u, v) => (Math.hypot(u - 1.5, v - 1.5) < 0.8 ? at(C.logs, 4) : at(C.logs, 3)), flatT(at(C.logs, 2)), (u) => at(C.logs, u < 1 ? 5 : 4));
  for (let k = 0; k < 22; k += 0.5) s.plot(cx - R + 1 + k * 0.1, cy + R + 3, k, at(C.wood, 4));
  s.box(cx - R, cy + R + 2.5, 20, 3, 1, 5, null, flatT(at(C.wood, 4)), flatT(at(C.wood, 3)));
  return s.sprite();
}

/** Parrilla de ladrillo con brasas, la rejilla con chorizos y arepas, y una chimenea al fondo. */
function brickGrill(): Sprite {
  const s = scene(2, 1, 50, 6);
  const X0 = 2, X1 = 30, Y0 = 2, Y1 = 14, H = 14;
  s.shadow(X0, Y0, X1 - X0 + 3, Y1 - Y0 + 3, 0.3);
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, H, (u, v) => (u > 2 && u < X1 - X0 - 9 && v > 2 && v < Y1 - Y0 - 2 ? null : at(C.stone, 4)), brick, (u, v) => brick(u, v) && mix(brick(u, v)!, at(C.night, 1), 0.2));
  // El hueco con brasas y la rejilla encima.
  s.quad([X0 + 2, Y0 + 2, H - 1], [1, 0, 0], [0, 1, 0], X1 - X0 - 11, Y1 - Y0 - 4, (u, v) => {
    const n = noise(Math.floor(u), Math.floor(v), 9);
    return n < 0.35 ? at(C.fire, 3) : n < 0.6 ? at(C.fire, 1) : at(C.night, 1);
  });
  s.quad([X0 + 2, Y0 + 2, H + 0.4], [1, 0, 0], [0, 1, 0], X1 - X0 - 11, Y1 - Y0 - 4, (u) => (u % 2 < 0.55 ? at(C.stone, 1) : null));
  // Dos chorizos y una arepa sobre la rejilla.
  for (const [x, y] of [
    [X0 + 5, Y0 + 4],
    [X0 + 5, Y0 + 7],
  ] as const)
    s.box(x, y, H + 0.5, 7, 1.8, 1.6, flatT(at(C.rose, 1)), flatT(at(C.rose, 0)), flatT(at(C.terracotta, 1)));
  s.cylinder(X0 + 15, Y0 + 6, H + 0.5, 2.5, 1.2, () => at(C.cream, 3));
  s.disc(X0 + 15, Y0 + 6, H + 1.7, 2.5, (dx, dy) => (Math.abs(dx - dy) < 0.5 ? at(C.logs, 3) : at(C.cream, 4)));
  // Repisa lateral con pinzas y la chimenea de ladrillo.
  s.box(X1 - 8, Y0 + 1, H, 7, Y1 - Y0 - 2, 1.2, flatT(at(C.wood, 4)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  s.box(X1 - 6, Y0 + 4, H + 1.2, 4, 0.8, 0.6, flatT(at(C.metal, 4)), flatT(at(C.metal, 3)), flatT(at(C.metal, 2)));
  s.box(X0, Y0, H, 5, 5, 26, flatT(at(C.stone, 2)), brick, (u, v) => brick(u, v) && mix(brick(u, v)!, at(C.night, 1), 0.2));
  s.box(X0 - 0.8, Y0 - 0.8, H + 26, 6.6, 6.6, 1.5, flatT(at(C.stone, 1)), flatT(at(C.stone, 3)), flatT(at(C.stone, 2)));
  return s.sprite();
}

/** Mesa de preparación de tablas: tabla de picar con cuchillo, tomates, un tazón de masa y cebollas. */
function prepTable(): Sprite {
  const s = scene(2, 1, 26, 6);
  s.shadow(2, 2, 29, 13, 0.28);
  for (const [x, y] of [
    [3, 3],
    [28, 3],
    [3, 12],
    [28, 12],
  ] as const)
    s.solid(x, y, 0, 1.6, 1.6, 12, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(2, 2, 12, 28, 12, 2, planks(C.wood, 4, 4, 3), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  s.box(5, 7, 5, 22, 6, 0.8, flatT(at(C.wood, 3)), flatT(at(C.wood, 2)), flatT(at(C.wood, 1)));
  // Tabla de picar con el cuchillo.
  s.box(5, 4, 14, 10, 7, 0.8, flatT(at(C.logs, 5)), flatT(at(C.logs, 4)), flatT(at(C.logs, 3)));
  s.box(7, 6, 14.8, 6, 0.9, 0.3, flatT(at(C.white, 3)), flatT(at(C.white, 2)), flatT(at(C.white, 1)));
  s.box(12.5, 5.8, 14.8, 2.4, 1.2, 0.6, flatT(at(C.woodDark, 3)), flatT(at(C.woodDark, 2)), flatT(at(C.woodDark, 1)));
  // Tazón de barro con masa y dos tomates.
  s.cylinder(21, 7, 14, 3.4, 3, (_a, _v, luz) => at(C.terracotta, luz > 0 ? 3 : 2));
  s.disc(21, 7, 17, 3.4, (dx, dy) => (Math.hypot(dx, dy) > 2.8 ? at(C.terracotta, 4) : at(C.cream, 4)));
  for (const [x, y] of [
    [26, 4.5],
    [27.5, 7],
  ] as const) {
    s.cylinder(x, y, 14, 1.4, 2.2, (_a, v, luz) => (v > 1.8 ? at(C.leaf, 3) : at(C.rose, luz > 0 ? 3 : 2)));
  }
  return s.sprite();
}

/** Pizarra en caballete: "El menú de hoy" en tiza, con dibujitos de arepa y pizza. */
function menuBoard(): Sprite {
  const s = scene(1, 1, 34, 6);
  s.shadow(3, 3, 10, 10, 0.25);
  for (const [x, y] of [
    [4, 4],
    [4, 12],
  ] as const)
    for (let z = 0; z < 26; z += 0.5) s.plot(x + z * 0.08, y, z, at(C.wood, 3));
  s.quad([6.5, 3, 7], [0, 1, 0], [0.12, 0, 1], 11, 18, (u, v) => {
    if (u < 1 || u > 10 || v < 1 || v > 17) return at(C.wood, 4);
    // Letras de tiza: renglones con cortes, y dos dibujitos (arepa amarilla, pizza roja).
    const line = Math.floor((17 - v) / 3);
    if ((17 - v) % 3 < 1 && line < 5) {
      const len = [8, 5, 7, 6, 4][line]!;
      if (u > 1.5 && u < 1.5 + len && noise(Math.floor(u), line, 11) > 0.18) return line === 0 ? at(C.white, 4) : at(C.white, 2);
    }
    if (Math.hypot(u - 7.5, v - 3) < 1.6) return at(C.gold, 4);
    if (Math.hypot(u - 4, v - 3) < 1.6) return at(C.rose, 3);
    return mix(at(C.sage, 0), at(C.night, 1), 0.55);
  });
  return s.sprite();
}

// ---------- Gallinero ----------

/** Paja del nido y de las pacas: amarillo con briznas más oscuras. */
function straw(u: number, v: number, seed = 2): RGBA {
  const n = noise(Math.floor(u * 1.5), Math.floor(v), seed);
  return at(C.mustard, n < 0.2 ? 2 : n > 0.8 ? 5 : n > 0.5 ? 4 : 3);
}

/**
 * El gallinero: casita de tablas sobre patas, techo a dos aguas de tejas, la puerta con la rampa de
 * listones que baja al patio (+y) y el nido que se abre por el costado (+x), con la tapa levantada.
 * Es fijo (se dibuja tal cual en el mundo): la rampa siempre mira al patio.
 */
function chickenCoop(): Sprite {
  const s = scene(3, 3, 64, 8);
  const X0 = 4, X1 = 36, Y0 = 4, Y1 = 34, ZF = 9, H = 22;
  s.shadow(X0 - 1, Y0 - 1, X1 - X0 + 8, Y1 - Y0 + 12, 0.3);
  // Patas y el piso de tablas.
  for (const [x, y] of [
    [X0, Y0],
    [X1 - 2, Y0],
    [X0, Y1 - 2],
    [X1 - 2, Y1 - 2],
  ] as const)
    s.solid(x, y, 0, 2, 2, ZF, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(X0 - 1, Y0 - 1, ZF, X1 - X0 + 2, Y1 - Y0 + 2, 1.5, flatT(at(C.wood, 3)), flatT(at(C.woodDark, 3)), flatT(at(C.woodDark, 2)));
  // Paredes de tablas verticales: frente (+y) con la puerta y la ventanita; costado (+x) con el nido.
  const wall = (tone: number): Tinte => (u, v) => {
    if (u % 4 < 0.6) return at(C.wood, tone - 2);
    // Un poco de uso abajo (barro) y algún nudo.
    if (v < 2.5 && noise(Math.floor(u / 4), 1, 13) < 0.6) return at(C.wood, tone - 1);
    return at(C.wood, tone + (noise(Math.floor(u / 4), 0, 7) < 0.3 ? -1 : 0));
  };
  s.quad([X0, Y1, ZF + 1.5], [1, 0, 0], [0, 0, 1], X1 - X0, H, (u, v) => {
    // La puerta de las gallinas, abierta (oscuro adentro), y la ventana con malla.
    if (u > 4 && u < 11 && v < 10) return u < 5 || u > 10 || v > 9 ? at(C.woodDark, 2) : at(C.night, 1);
    if (u > 17 && u < 27 && v > 9 && v < 17) {
      if (u < 18 || u > 26 || v < 10 || v > 16) return at(C.cream, 4);
      return (Math.floor(u) + Math.floor(v)) % 2 ? at(C.stone, 3) : at(C.night, 1);
    }
    return wall(4)(u, v);
  });
  s.quad([X1, Y0, ZF + 1.5], [0, 1, 0], [0, 0, 1], Y1 - Y0, H, wall(3));
  // Remates blancos en las esquinas.
  s.solid(X1 - 1, Y1 - 1, ZF, 1.6, 1.6, H + 1.5, at(C.cream, 5), at(C.cream, 4), at(C.cream, 3));
  // Techo a dos aguas con la cumbrera a lo largo de x.
  const zE = ZF + 1.5 + H, rise = 12, mid = (Y0 + Y1) / 2, half = mid - Y0 + 4, slope = rise / half;
  const k = Math.hypot(1, slope);
  s.quad([X0 - 4, mid, zE + rise], [1, 0, 0], [0, -1, -slope], X1 - X0 + 8, half, (u, v) => tejas(u, v * k, -1));
  s.quad([X0 - 4, mid, zE + rise], [1, 0, 0], [0, 1, -slope], X1 - X0 + 8, half, (u, v) => tejas(u, v * k, 1));
  s.quad([X1, mid, zE], [0, 1, 0], [0, 0, 1], mid - Y0, rise, (u, v) => (v > rise * (1 - u / (mid - Y0)) ? null : wall(3)(u, v)));
  s.quad([X1, Y0, zE], [0, 1, 0], [0, 0, 1], mid - Y0, rise, (u, v) => (v > rise * (u / (mid - Y0)) ? null : wall(3)(u, v)));
  s.quad([X0 - 4, Y1 + 4, zE - 2], [1, 0, 0], [0, 0, 1], X1 - X0 + 8, 2, () => at(C.woodDark, 2));
  for (let x = X0 - 4.5; x < X1 + 4.5; x += 0.4) s.plot(x, mid, zE + rise + 1, at(C.roof, 5));
  // La veleta: un gallito de lata sobre la cumbrera.
  for (let z = 0; z < 7; z += 0.5) s.plot(X1 - 4, mid, zE + rise + 1 + z, at(C.woodDark, 2));
  s.box(X1 - 6, mid - 0.3, zE + rise + 6, 4, 0.6, 3, null, flatT(at(C.terracotta, 2)), flatT(at(C.terracotta, 1)));
  // Rampa de listones desde la puerta hasta el patio.
  for (let t = 0; t < 14; t += 0.5)
    s.box(X0 + 4, Y1 + t, ZF - t * (ZF / 14), 7, 0.6, 0.8, (u) => (Math.floor(t) % 3 === 0 && t % 1 < 0.5 ? at(C.wood, 2) : at(C.wood, u < 1 ? 3 : 4)), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  // El nido: un cajón pegado al costado (+x) con la tapa abierta y paja adentro.
  const NX = X1, NY0 = Y0 + 8, NY1 = Y1 - 6, NZ = ZF + 4;
  s.box(NX, NY0, NZ, 7, NY1 - NY0, 8, (u, v) => (u > 1 && u < 6 && v > 1 && v < NY1 - NY0 - 1 ? straw(u, v) : at(C.wood, 4)), wall(4), wall(3));
  s.quad([NX + 7, NY0, NZ + 8], [0, 1, 0], [0.5, 0, 0.86], NY1 - NY0, 6, planks(C.roof, 5, 3, 4));
  s.box(NX, NY0 + (NY1 - NY0) / 2 - 1, NZ + 1, 7, 0.6, 7, null, flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  return s.sprite();
}

/** Los huevos en el nido (capa del cliente: se ven mientras queden por recoger). Mismo origen que el gallinero. */
export function coopEggs(count: number): Sprite {
  const s = scene(3, 3, 64, 8);
  // Mismas coordenadas que el gallinero: el origen del sprite (ox, oy) hace que la capa caiga encima.
  const spots: [number, number][] = [
    [38.5, 17],
    [40.5, 20],
    [38.8, 23],
    [41, 26],
  ];
  for (const [x, y] of spots.slice(0, Math.max(0, Math.min(4, count)))) {
    s.cylinder(x, y, 21.5, 1.1, 1.6, (_a, v, luz) => (v > 1.2 ? at(C.cream, 5) : at(C.cream, luz > 0 ? 5 : 3)));
    s.disc(x, y, 23.1, 0.8, () => at(C.cream, 5));
  }
  return s.sprite();
}

/** Comedero de tablas en V sobre patitas, con maíz amarillo. */
function chickenFeeder(): Sprite {
  const s = scene(1, 1, 18, 6);
  s.shadow(2, 4, 13, 9, 0.28);
  for (const x of [3, 12]) s.solid(x, 7, 0, 1.4, 2, 4, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(2, 5, 4, 12, 6, 4, (u, v) => (v > 1 && v < 5 && u > 0.8 && u < 11.2 ? (noise(Math.floor(u * 2), Math.floor(v * 2), 3) < 0.7 ? at(C.gold, 4) : at(C.mustard, 3)) : at(C.wood, 4)), planks(C.wood, 3, 3, 5), flatT(at(C.wood, 2)));
  // Unos granos regados en el piso.
  for (let i = 0; i < 9; i++) s.plot(1 + noise(i, 1, 4) * 14, 2 + noise(i, 2, 4) * 13, 0.2, at(C.gold, 4));
  return s.sprite();
}

/** Bebedero: una batea de madera con agua y el borde de piedra. */
function waterTrough(): Sprite {
  const s = scene(1, 1, 16, 6);
  s.shadow(2, 3, 13, 11, 0.28);
  s.box(2.5, 4, 0, 11, 8, 5, (u, v) => (u > 1.2 && u < 9.8 && v > 1.2 && v < 6.8 ? (noise(Math.floor(u), Math.floor(v), 8) < 0.15 ? at(C.sky, 4) : at(C.sky, 2)) : at(C.wood, 4)), planks(C.wood, 3, 3, 8), flatT(at(C.wood, 2)));
  return s.sprite();
}

/** Saco de fique con maíz, abierto arriba (y unos granos regados). */
function feedSack(): Sprite {
  const s = scene(1, 1, 20, 6);
  s.roundShadow(8, 9, 6, 0.28);
  for (let z = 0; z < 11; z += 0.5) {
    const r = 5 - Math.abs(z - 5) * 0.12 - (z > 9 ? (z - 9) * 0.8 : 0);
    s.cylinder(8, 8, z, r, 0.55, (a, _v, luz) => ((Math.floor(a * 6) + Math.floor(z)) % 3 === 0 ? at(C.cork, 2) : at(C.cork, luz > 0 ? 4 : 3)));
  }
  s.disc(8, 8, 11, 3.8, (dx, dy) => (noise(Math.floor(dx * 2 + 9), Math.floor(dy * 2 + 9), 5) < 0.6 ? at(C.gold, 4) : at(C.mustard, 3)));
  for (let i = 0; i < 6; i++) s.plot(8 + noise(i, 1, 7) * 7, 12 + noise(i, 2, 7) * 3, 0.2, at(C.gold, 4));
  return s.sprite();
}

/** Paca de heno amarrada con dos cuerdas. */
function hayBale(): Sprite {
  const s = scene(1, 1, 16, 6);
  s.shadow(1, 2, 15, 13, 0.28);
  const tw = (u: number, v: number, t: (u: number, v: number) => RGBA) => (Math.abs(u - 4) < 0.6 || Math.abs(u - 10) < 0.6 ? at(C.cork, 1) : t(u, v));
  s.box(1.5, 2.5, 0, 13, 11, 8, (u, v) => tw(u, v, straw), (u, v) => tw(u, v, (a, b) => straw(a, b, 5)), (u, v) => mix(straw(u, v, 9), at(C.cork, 2), 0.3));
  return s.sprite();
}

/** Cerca de palos (a lo largo de y): dos estacas y ramas cruzadas, rústica. */
function stickFence(): Sprite {
  const s = scene(1, 1, 18, 4);
  for (const y of [0.5, 14.5]) s.box(7, y, 0, 2, 1.6, 13 + noise(Math.floor(y), 1, 3) * 2, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
  for (const [z0, z1] of [
    [4, 5],
    [9, 8],
  ] as const)
    for (let t = 0; t <= 16; t += 0.35) s.plot(8, t, z0 + ((z1 - z0) * t) / 16, at(C.logs, 3 + (Math.floor(t * 1.3) % 3 === 0 ? 1 : 0)));
  // Una rama en diagonal (sin simetría perfecta: se nota hecha a mano).
  for (let t = 1; t <= 15; t += 0.35) s.plot(8.4, t, 2 + (t / 16) * 9, at(C.logs, 2));
  return s.sprite();
}

/** Establo chico de la cabra: tres paredes de tablas, techo a un agua de tejas y paja en el piso. */
function goatShed(): Sprite {
  const s = scene(2, 2, 44, 6);
  const X0 = 3, X1 = 29, Y0 = 3, Y1 = 28, H = 20;
  s.shadow(X0 - 1, Y0 - 1, X1 - X0 + 5, Y1 - Y0 + 6, 0.28);
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, 0.6, (u, v) => straw(u, v, 4), null, null);
  // Pared del fondo y del oeste (atrás, se ven por dentro) y la del este con la ventanita.
  s.quad([X0, Y0, 0], [1, 0, 0], [0, 0, 1], X1 - X0, H, planks(C.wood, 4, 3, 6));
  s.quad([X0, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, H, planks(C.wood, 4, 2, 7));
  s.quad([X1, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, H, (u, v) => (u > 8 && u < 16 && v > 11 && v < 16 ? at(C.night, 1) : planks(C.wood, 4, 3, 9)(u, v)));
  for (const [x, y] of [
    [X0, Y1 - 1.5],
    [X1 - 1.5, Y1 - 1.5],
  ] as const)
    s.solid(x, y, 0, 1.5, 1.5, H, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Techo a un agua que baja hacia el frente.
  const zB = H + 8, slope = 8 / (Y1 - Y0 + 8);
  s.quad([X0 - 3, Y0 - 3, zB], [1, 0, 0], [0, 1, -slope], X1 - X0 + 6, Y1 - Y0 + 8, (u, v) => tejas(u, v * 1.04, 0));
  s.quad([X0 - 3, Y1 + 5, zB - (Y1 - Y0 + 8) * slope - 2], [1, 0, 0], [0, 0, 1], X1 - X0 + 6, 2, () => at(C.woodDark, 2));
  s.quad([X1, Y0, H], [0, 1, 0], [0, 0, 1], Y1 - Y0, 8, (u, v) => (v > 8 - (u / (Y1 - Y0)) * 8 ? null : planks(C.wood, 4, 2, 3)(u, v)));
  // Una paca adentro.
  s.box(X0 + 2, Y0 + 2, 0.6, 10, 7, 6, (u, v) => straw(u, v), (u, v) => straw(u, v, 6), (u, v) => straw(u, v, 8));
  return s.sprite();
}

/** Pesebre: un canasto de listones en patas, lleno de heno. */
function hayRack(): Sprite {
  const s = scene(1, 1, 22, 6);
  s.shadow(2, 3, 13, 11, 0.28);
  for (const [x, y] of [
    [3, 4],
    [12, 4],
    [3, 11],
    [12, 11],
  ] as const)
    s.solid(x, y, 0, 1.4, 1.4, 9, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(3, 4, 7, 10, 8.5, 6, (u, v) => straw(u, v, 3), (u, v) => (u % 2 < 0.7 ? at(C.wood, 3) : straw(u, v, 5)), (u, v) => (u % 2 < 0.7 ? at(C.wood, 2) : straw(u, v, 7)));
  return s.sprite();
}

/** Letrero del gallinero: tabla en un poste con una gallina pintada y renglones con los nombres. */
function farmSign(): Sprite {
  const s = scene(1, 1, 38, 6);
  s.shadow(5, 5, 6, 6, 0.25);
  s.solid(7, 7, 0, 2, 2, 22, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  s.box(4, 7, 16, 8, 2, 14, flatT(at(C.wood, 5)), (u, v) => {
    if (u < 0.8 || u > 7.2 || v < 0.8 || v > 13.2) return at(C.wood, 2);
    // La gallina roja arriba y cuatro renglones abajo.
    if (Math.hypot(u - 4, v - 10.5) < 2 || Math.hypot(u - 5.6, v - 12) < 0.9) return at(C.cream, 5);
    if (Math.hypot(u - 5.8, v - 12.9) < 0.5) return at(C.rose, 3);
    if (Math.floor(v) % 2 === 0 && v < 7.5 && v > 1.5 && u > 1.5 && u < 6.5 && noise(Math.floor(u), Math.floor(v), 4) > 0.2) return at(C.woodDark, 1);
    return at(C.wood, 4);
  }, flatT(at(C.wood, 3)));
  s.box(3.4, 6.6, 29.6, 9.2, 2.8, 1, flatT(at(C.roof, 4)), flatT(at(C.roof, 3)), flatT(at(C.roof, 2)));
  return s.sprite();
}

// ---------- Molino ----------

/**
 * El molino: planta baja de piedra de río, arriba madera con entramado, techo de tejas a dos aguas, la
 * puerta al este (+x) con un farol, una ventanita al arroyo (+y) y el eje de la rueda saliendo por ahí.
 * Fijo: la rueda (otro mueble) va en el agua, pegada a su costado +y.
 */
function waterMill(): Sprite {
  const s = scene(3, 3, 80, 8);
  const X0 = 3, X1 = 45, Y0 = 3, Y1 = 44, ZS = 18, H = 38;
  s.shadow(X0 - 1, Y0 - 1, X1 - X0 + 6, Y1 - Y0 + 4, 0.3);
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, ZS, flatT(at(C.stone, 3)), (u, v) => stones(u, v, 21), (u, v) => {
    // La puerta (arco de madera) y su escalón.
    const du = u - (Y1 - Y0) / 2;
    if (Math.abs(du) < 6 && v < 14 - Math.max(0, Math.abs(du) - 3) * 0.8) return Math.abs(du) > 5.2 || v > 13 - Math.max(0, Math.abs(du) - 3) * 0.8 ? at(C.woodDark, 1) : planks(C.woodDark, 3, 3, 5)(u, v);
    return stones(u, v, 22, 1);
  });
  s.box(X1, Y0 + (Y1 - Y0) / 2 - 7, 0, 3, 14, 1.5, flatT(at(C.stone, 4)), flatT(at(C.stone, 3)), flatT(at(C.stone, 2)));
  // Piso alto: madera con vigas oscuras en cruz.
  const timber = (tone: number, seed: number): Tinte => (u, v) => {
    if (v < 1.2 || v > H - ZS - 1.2 || u % 14 < 1.2) return at(C.woodDark, 2);
    const cell = u % 14;
    if (Math.abs(cell - 7 - (v - (H - ZS) / 2) * 0.6) < 0.7) return at(C.woodDark, 2);
    return planks(C.wood, 3, tone, seed)(v, u);
  };
  s.quad([X0, Y1, ZS], [1, 0, 0], [0, 0, 1], X1 - X0, H - ZS, (u, v) => {
    if (u > 26 && u < 36 && v > 6 && v < 15) {
      if (u < 27 || u > 35 || v < 7 || v > 14 || Math.abs(u - 31) < 0.6) return at(C.cream, 4);
      return at(C.sky, v > 10.5 ? 3 : 2);
    }
    return timber(4, 3)(u, v);
  });
  s.quad([X1, Y0, ZS], [0, 1, 0], [0, 0, 1], Y1 - Y0, H - ZS, (u, v) => {
    if (u > 14 && u < 26 && v > 6 && v < 15) {
      if (u < 15 || u > 25 || v < 7 || v > 14 || Math.abs(u - 20) < 0.6 || Math.abs(v - 10.5) < 0.5) return at(C.cream, 4);
      return at(C.sky, v > 10.5 ? 3 : 2);
    }
    return timber(3, 5)(u, v);
  });
  // Techo con la cumbrera a lo largo de y (el hastial mira al arroyo).
  const zE = H, rise = 18, mid = (X0 + X1) / 2, half = mid - X0 + 4, slope = rise / half;
  const k = Math.hypot(1, slope);
  s.quad([mid, Y0 - 4, zE + rise], [0, 1, 0], [-1, 0, -slope], Y1 - Y0 + 8, half, (u, v) => tejas(u, v * k, 1));
  s.quad([mid, Y0 - 4, zE + rise], [0, 1, 0], [1, 0, -slope], Y1 - Y0 + 8, half, (u, v) => tejas(u, v * k, -1));
  s.quad([X0, Y1, zE], [1, 0, 0], [0, 0, 1], mid - X0, rise, (u, v) => (v > rise * (u / (mid - X0)) ? null : timber(4, 7)(u, v)));
  s.quad([mid, Y1, zE], [1, 0, 0], [0, 0, 1], X1 - mid, rise, (u, v) => (v > rise * (1 - u / (X1 - mid)) ? null : timber(4, 8)(u, v)));
  s.quad([mid, Y1 + 4, zE + rise - 2], [-1, 0, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 2));
  s.quad([mid, Y1 + 4, zE + rise - 2], [1, 0, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 2));
  for (let y = Y0 - 4.5; y < Y1 + 4.5; y += 0.4) s.plot(mid, y, zE + rise + 1, at(C.roof, 5));
  // Chimenea de piedra.
  s.box(mid + 6, Y0 + 8, zE + 6, 5, 5, 18, flatT(at(C.stone, 1)), (u, v) => stones(u, v, 30), (u, v) => stones(u, v, 31, 1));
  // El eje de la rueda sale por el costado del arroyo.
  s.cylinder(24, Y1 + 1, 11, 2.2, 0.1, () => at(C.woodDark, 2));
  s.box(22.5, Y1, 9.5, 3, 3, 3, flatT(at(C.woodDark, 4)), flatT(at(C.woodDark, 3)), flatT(at(C.woodDark, 2)));
  // Farol junto a la puerta.
  lantern(s, X1 + 1.5, Y0 + (Y1 - Y0) / 2 + 9, 14, 4);
  return s.sprite();
}

/** Radio y centro de la rueda (coordenadas del mueble 2x1: a lo largo de x, en el agua). */
const WHEEL = { cx: 16, cy: 5, cz: 10, r: 13, width: 5, spokes: 8 };
/** Cuadros de la vuelta: la rueda repite su dibujo cada 1/8 de vuelta (8 rayos y 16 paletas). */
export const MILL_WHEEL_FRAMES = 6;

let wheelFrames: Sprite[] | undefined;

/**
 * La rueda del molino girada `frame` sextos de 1/8 de vuelta (el cliente la anima con esto). Todos los
 * cuadros tienen el mismo lienzo y origen que el dibujo del mueble: el cliente solo cambia la textura.
 */
export function millWheel(frame = 0): Sprite {
  wheelFrames ??= padSprites(Array.from({ length: MILL_WHEEL_FRAMES }, (_, k) => millWheelRaw(k)));
  return wheelFrames[((frame % MILL_WHEEL_FRAMES) + MILL_WHEEL_FRAMES) % MILL_WHEEL_FRAMES]!;
}

/** Pone varios sprites en un lienzo común (la unión de todos), con el mismo origen. */
function padSprites(list: Sprite[]): Sprite[] {
  const x0 = Math.min(...list.map((s) => -s.ox));
  const y0 = Math.min(...list.map((s) => -s.oy));
  const x1 = Math.max(...list.map((s) => s.canvas.width - s.ox));
  const y1 = Math.max(...list.map((s) => s.canvas.height - s.oy));
  return list.map((s) => {
    const c = new PixelCanvas(x1 - x0, y1 - y0);
    const dx = -s.ox - x0;
    const dy = -s.oy - y0;
    for (let y = 0; y < s.canvas.height; y++) c.data.set(s.canvas.data.subarray(y * s.canvas.width * 4, (y + 1) * s.canvas.width * 4), ((y + dy) * c.width + dx) * 4);
    return { canvas: c, ox: -x0, oy: -y0 };
  });
}

function millWheelRaw(frame: number): Sprite {
  const s = scene(2, 1, 30, 8);
  const { cx, cy, cz, r, width, spokes } = WHEEL;
  const turn = ((frame % MILL_WHEEL_FRAMES) / MILL_WHEEL_FRAMES) * ((Math.PI * 2) / spokes);
  const ring = (y: number, tone: number) => {
    for (let a = 0; a < Math.PI * 2; a += 0.03) {
      const z = cz + Math.sin(a) * r;
      if (z < -1.5) continue;
      s.plot(cx + Math.cos(a) * r, y, z, at(C.wood, tone));
      s.plot(cx + Math.cos(a) * (r - 1), y, cz + Math.sin(a) * (r - 1), at(C.wood, tone - 1));
    }
  };
  // Aro de atrás, rayos, paletas y aro de adelante (el z-buffer los ordena).
  ring(cy - width / 2, 2);
  for (let i = 0; i < spokes; i++) {
    const a = turn + (i / spokes) * Math.PI * 2;
    for (let d = 1.5; d < r - 1; d += 0.4)
      for (const y of [cy - width / 2, cy + width / 2]) {
        const z = cz + Math.sin(a) * d;
        if (z > -1.5) s.plot(cx + Math.cos(a) * d, y, z, at(C.woodDark, 3));
      }
  }
  for (let i = 0; i < spokes * 2; i++) {
    const a = turn + (i / (spokes * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * (r - 0.5);
    const z = cz + Math.sin(a) * (r - 0.5);
    if (z < -1) continue;
    // Paleta: una tabla a lo ancho, un poco inclinada hacia afuera.
    for (let y = cy - width / 2; y <= cy + width / 2; y += 0.4)
      for (let t = 0; t < 3; t += 0.4) s.plot(x + Math.cos(a) * t, y, z + Math.sin(a) * t, at(C.wood, 4 - (i % 2)));
  }
  ring(cy + width / 2, 4);
  // Maza del centro.
  s.cylinder(cx, cy + width / 2, cz - 1.8, 1.8, 0.1, () => at(C.woodDark, 3));
  for (let y = cy - width / 2; y <= cy + width / 2 + 0.5; y += 0.4) s.plot(cx, y, cz, at(C.woodDark, 4));
  // Espuma donde las paletas entran al agua y chorros que caen de las de arriba.
  for (let i = 0; i < 16; i++) {
    const x = cx - r + noise(i, frame, 3) * r * 2;
    s.plot(x, cy + width / 2 + 0.5 + noise(i, 2, frame + 1) * 2, 0.2, alpha(at(C.white, 4), 0.85));
  }
  for (let z = 1; z < cz + r - 2; z += 1.2) {
    const x = cx + r * 0.55 + noise(Math.floor(z), frame, 5) * 1.5;
    s.plot(x, cy + width / 2 + 0.6, z, alpha(at(C.sky, 4), 0.8));
  }
  return s.sprite();
}

/** El puentecito de tablas (plano: se camina por encima) con barandas bajas de palos a los lados. */
function footbridge(): Sprite {
  const s = scene(2, 3, 18, 6);
  const X0 = 2, X1 = 30, Y0 = 0, Y1 = 48;
  // Largueros y tablas cruzadas, con una leve joroba al centro.
  const hump = (y: number) => 2 + Math.sin(((y - Y0) / (Y1 - Y0)) * Math.PI) * 3;
  for (let y = Y0; y < Y1; y += 0.4) {
    const z = hump(y);
    const k = Math.floor(y / 4);
    for (let x = X0; x < X1; x += 0.4) s.plot(x, y, z, y % 4 < 0.6 ? at(C.wood, 2) : at(C.wood, 3 + (noise(k, 0, 6) < 0.4 ? 1 : 0) + (x < X0 + 1 || x > X1 - 1 ? -1 : 0)));
    for (const x of [X0, X1 - 0.5]) for (let t = 0; t < 1.5; t += 0.5) s.plot(x, y, z - t, at(C.woodDark, 3));
  }
  // Barandas: postes cada tanto y el pasamanos de palo.
  for (const x of [X0 + 0.5, X1 - 1]) {
    for (let y = Y0 + 2; y < Y1; y += 11) s.box(x - 0.8, y - 0.8, hump(y), 1.6, 1.6, 8, flatT(at(C.logs, 4)), flatT(at(C.logs, 3)), flatT(at(C.logs, 2)));
    for (let y = Y0 + 2; y < Y1 - 1; y += 0.35) s.plot(x, y, hump(y) + 8, at(C.logs, 4));
  }
  return s.sprite();
}

/** Tres sacos de harina (blancos, con su letra estampada) sobre una tarima. */
function flourSacks(): Sprite {
  const s = scene(1, 1, 22, 6);
  s.shadow(1, 2, 14, 13, 0.25);
  s.box(1.5, 2.5, 0, 13, 11, 1.5, planks(C.wood, 3, 3, 2), flatT(at(C.wood, 2)), flatT(at(C.wood, 1)));
  for (const [x, y, z] of [
    [5, 6, 1.5],
    [11, 9, 1.5],
    [8, 7, 7.5],
  ] as const)
    s.box(x - 3.5, y - 3, z, 7, 6, 6, flatT(at(C.cream, 5)), (u, v) => (Math.abs(u - 3.5) < 1 && Math.abs(v - 3) < 1.4 ? at(C.gold, 3) : at(C.cream, 4)), flatT(at(C.cream, 3)));
  return s.sprite();
}

/** Una piedra de moler vieja, de canto, apoyada en el pasto. */
function millstone(): Sprite {
  const s = scene(1, 1, 18, 6);
  s.roundShadow(8, 9, 6, 0.28);
  s.quad([2, 8, 0.5], [1, 0, 0], [0, 0, 1], 12, 12, (u, v) => {
    const d = Math.hypot(u - 6, v - 6);
    if (d > 6) return null;
    if (d < 1.2) return at(C.stone, 0);
    return (Math.floor(Math.atan2(v - 6, u - 6) * 3) + 12) % 2 && d > 2.5 ? at(C.stone, 3) : at(C.stone, 4);
  });
  s.quad([2, 7, 0.5], [1, 0, 0], [0, 0, 1], 12, 12, (u, v) => (Math.hypot(u - 6, v - 6) < 6 ? at(C.stone, 2) : null));
  return s.sprite();
}

export const GRANJA_DRAW: Record<string, () => Sprite> = {
  "clay-oven": clayOven,
  "brick-grill": brickGrill,
  "prep-table": prepTable,
  "menu-board": menuBoard,
  "chicken-coop": chickenCoop,
  "chicken-feeder": chickenFeeder,
  "water-trough": waterTrough,
  "feed-sack": feedSack,
  "hay-bale": hayBale,
  "stick-fence": stickFence,
  "goat-shed": goatShed,
  "hay-rack": hayRack,
  "farm-sign": farmSign,
  "water-mill": waterMill,
  "mill-wheel": () => millWheel(0),
  footbridge,
  "flour-sacks": flourSacks,
  millstone,
};

// ---------- Animales ----------

export type FarmArtPose = "stand" | "walk" | "peck" | "sleep";
/** Cuadros de cada pose (caminar alterna patas, picotear sube y baja la cabeza). */
export const FARM_POSE_FRAMES: Record<FarmArtPose, number> = { stand: 1, walk: 2, peck: 2, sleep: 1 };
/** Lienzo de cada cuadro y dónde quedan las patas (el origen en el juego). */
export const HEN_FRAME = { w: 14, h: 13, feetX: 7, feetY: 12 } as const;
export const GOAT_FRAME = { w: 22, h: 19, feetX: 11, feetY: 18 } as const;

const HEN_COATS: Record<string, { base: string; dark: string; light: string; tail: string }> = {
  colorada: { base: "#b8552e", dark: "#7e3420", light: "#d9814a", tail: "#3a2a24" },
  blanca: { base: "#efe8dc", dark: "#c4b8a4", light: "#fffaf2", tail: "#d8ccb8" },
  pinta: { base: "#8a7a6a", dark: "#5a4a3e", light: "#d8d0c4", tail: "#3a3230" },
  negra: { base: "#3a3438", dark: "#221e22", light: "#5e5460", tail: "#2a3a44" },
};

/** Mira a la izquierda de la pantalla (para "right" y "up" el cliente lo voltea). */
const HEN_ROWS: Record<string, string[]> = {
  stand: [
    "..............", //
    "...cc.........",
    "..obbo........",
    ".yobeb....tt..",
    "..obbbo..ttt..",
    "...wbbboottt..",
    "...wbbbbbbto..",
    "...owlllbbbo..",
    "....ollllbo...",
    ".....ooooo....",
    "......p.p.....",
    "......p.p.....",
    ".....pp.pp....",
  ],
  walk1: [
    "..............", //
    "...cc.........",
    "..obbo........",
    ".yobeb....tt..",
    "..obbbo..ttt..",
    "...wbbboottt..",
    "...wbbbbbbto..",
    "...owlllbbbo..",
    "....ollllbo...",
    ".....ooooo....",
    ".....p...p....",
    "....p....p....",
    "...pp....pp...",
  ],
  peck1: [
    "..............", //
    "..............",
    "..............",
    "..........tt..",
    ".........ttt..",
    "....obbboottt.",
    "..cobbbbbbbto.",
    ".obbolllbbbo..",
    "yobeollllbo...",
    ".obboooooo....",
    "......p.p.....",
    "......p.p.....",
    ".....pp.pp....",
  ],
  sleep: [
    "..............", //
    "..............",
    "..............",
    "..............",
    "...cc.........",
    "..obbo....tt..",
    ".yobdbooottt..",
    "..obbbbbbbto..",
    "..obbllllbbo..",
    "...ollllllbo..",
    "....oooooooo..",
    "..............",
    "..............",
  ],
};

function paintRows(rows: string[], colors: Record<string, RGBA>, w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const col = ch === "o" ? OUT : colors[ch];
    if (col) c.set(x, y, col);
  }));
  return c;
}

/** Una gallina (según su plumaje) en una pose; `frame` alterna los cuadros de caminar y picotear. */
export function drawHen(coat: string, pose: FarmArtPose, frame = 0): PixelCanvas {
  const k = HEN_COATS[coat] ?? HEN_COATS.colorada!;
  const rows = pose === "walk" ? (frame % 2 ? HEN_ROWS.walk1! : HEN_ROWS.stand!) : pose === "peck" ? (frame % 2 ? HEN_ROWS.peck1! : HEN_ROWS.stand!) : pose === "sleep" ? HEN_ROWS.sleep! : HEN_ROWS.stand!;
  const c = paintRows(rows, {
    b: hex(k.base),
    l: hex(k.dark),
    w: hex(k.light),
    t: hex(k.tail),
    c: hex("#e0402e"),
    y: hex("#f2b233"),
    p: hex("#e8a23a"),
    e: hex("#1c1418"),
    d: hex(k.dark),
  }, HEN_FRAME.w, HEN_FRAME.h);
  // La pinta lleva pintas claras.
  if (coat === "pinta")
    for (let y = 4; y < 10; y++)
      for (let x = 4; x < 12; x++) if (c.alphaAt(x, y) && (x + y * 2) % 4 === 0 && noise(x, y, 3) < 0.6) c.set(x, y, hex(k.light));
  const out = new PixelCanvas(HEN_FRAME.w, HEN_FRAME.h);
  out.ellipse(HEN_FRAME.feetX, HEN_FRAME.feetY, 4, 1.2, alpha(SHADOW, 0.3));
  for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3]) out.set((i / 4) % c.width, Math.floor(i / 4 / c.width), [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, c.data[i + 3]!]);
  return out;
}

const GOAT_ROWS: Record<string, string[]> = {
  stand: [
    "..h.h.................", //
    "..hh.h................",
    ".ooggo................",
    "ogegggo...............",
    "onggggo...............",
    ".oggggoooooooooo......",
    "..bgggggggggggggo.t...",
    "..ogggggggggggggott...",
    "...ogggggggggggggo....",
    "...oggwwwwwwwggggo....",
    "....ogwwwwwwwgggo.....",
    ".....oooooooooooo.....",
    ".....og.og..og.og.....",
    ".....og.og..og.og.....",
    ".....og.og..og.og.....",
    ".....ok.ok..ok.ok.....",
    "......................",
    "......................",
    "......................",
  ],
  walk1: [
    "..h.h.................", //
    "..hh.h................",
    ".ooggo................",
    "ogegggo...............",
    "onggggo...............",
    ".oggggoooooooooo......",
    "..bgggggggggggggo.t...",
    "..ogggggggggggggott...",
    "...ogggggggggggggo....",
    "...oggwwwwwwwggggo....",
    "....ogwwwwwwwgggo.....",
    ".....oooooooooooo.....",
    "....og..og...og..og...",
    "....og..og...og..og...",
    "...og...og....og.og...",
    "...ok...ok....ok.ok...",
    "......................",
    "......................",
    "......................",
  ],
  peck1: [
    "......................", //
    "......................",
    "......................",
    "......................",
    "..h.h.................",
    "..hhoooooooooooo......",
    ".ooggggggggggggggo.t..",
    "ogeggggggggggggggott..",
    "onggggggggggggggggo...",
    ".ogggowwwwwwwggggo....",
    "..oo.ogwwwwwwgggo.....",
    ".....oooooooooooo.....",
    ".....og.og..og.og.....",
    ".....og.og..og.og.....",
    ".....og.og..og.og.....",
    ".....ok.ok..ok.ok.....",
    "......................",
    "......................",
    "......................",
  ],
  sleep: [
    "......................", //
    "......................",
    "......................",
    "......................",
    "......................",
    "..h.h.................",
    "..hh.h................",
    ".ooggo................",
    "ogdgggo...............",
    "onggggooooooooooo.....",
    "..ogggggggggggggott...",
    "..ogggwwwwwwwggggo....",
    "...oggwwwwwwwgggggo...",
    "....ooooooooooooooo...",
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
  ],
};

/** La cabra del corral (café con la panza clara, cuernitos y barba). */
export function drawGoat(pose: FarmArtPose, frame = 0): PixelCanvas {
  const rows = pose === "walk" ? (frame % 2 ? GOAT_ROWS.walk1! : GOAT_ROWS.stand!) : pose === "peck" ? (frame % 2 ? GOAT_ROWS.peck1! : GOAT_ROWS.stand!) : pose === "sleep" ? GOAT_ROWS.sleep! : GOAT_ROWS.stand!;
  const c = paintRows(rows, {
    g: hex("#9a6a40"),
    w: hex("#efd6ab"),
    h: hex("#c8b89a"),
    e: hex("#1c1418"),
    d: hex("#65422a"),
    n: hex("#e58a9a"),
    b: hex("#efe4cc"),
    t: hex("#65422a"),
    k: hex("#3a2a20"),
  }, GOAT_FRAME.w, GOAT_FRAME.h);
  const out = new PixelCanvas(GOAT_FRAME.w, GOAT_FRAME.h);
  out.ellipse(GOAT_FRAME.feetX, GOAT_FRAME.feetY - 1, 7, 1.6, alpha(SHADOW, 0.3));
  for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3]) out.set((i / 4) % c.width, Math.floor(i / 4 / c.width), [c.data[i]!, c.data[i + 1]!, c.data[i + 2]!, c.data[i + 3]!]);
  return out;
}

/** Granos de maíz que se tiran al dar de comer (un puñadito). */
export function cornGrain(): PixelCanvas {
  const c = new PixelCanvas(2, 2);
  c.set(0, 0, at(C.gold, 4));
  c.set(1, 0, at(C.gold, 3));
  c.set(0, 1, at(C.mustard, 3));
  return c;
}

/** Nube de harina (al moler) y humo del horno: una bolita clara que se desvanece. */
export function puffBall(r: number, color: "flour" | "smoke"): PixelCanvas {
  const c = new PixelCanvas(r * 2 + 1, r * 2 + 1);
  const col = color === "flour" ? at(C.cream, 5) : at(C.stone, 4);
  c.ellipse(r, r, r, r, alpha(col, 0.85));
  c.ellipse(r - r * 0.3, r - r * 0.3, r * 0.45, r * 0.45, alpha(color === "flour" ? at(C.white, 4) : at(C.stone, 5), 0.9));
  return c;
}
