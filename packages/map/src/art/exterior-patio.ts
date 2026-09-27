// Construcciones y objetos del jardín: invernadero, cobertizo, glorieta, pérgola, portón, pozo,
// colmenas, barriles, leñera, fogata, troncos para sentarse, picnic, muebles de terraza, faroles,
// letrero y el bote. Coordenadas locales de arte (tile = 16), mirando hacia +x.
import { Escena, type Tinte } from "./exterior-escena";
import { blob } from "./kit";
import { C, OUT, mix } from "./palette";
import { alpha, at, noise, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);

/** Tablas de madera: juntas cada `pitch` a lo largo de u, con tono por tabla. */
const planks =
  (r: Ramp, pitch = 4, base = 3, seed = 1): Tinte =>
  (u) => {
    if (u % pitch < 0.7) return at(r, base - 2);
    return at(r, base + (noise(Math.floor(u / pitch), 0, seed) < 0.4 ? -1 : 0));
  };
const flatT = (c: RGBA): Tinte => () => c;

/** Piedras de río (basas, pozo, fogata). */
function stones(u: number, v: number, seed: number, dark = 0): RGBA {
  const row = Math.floor(v / 4);
  const off = noise(row, 3, seed) * 7;
  const k = (u + off) % 7;
  if (v % 4 < 0.8 || k < 0.8) return at(C.stone, 1 - dark);
  const n = noise(Math.floor((u + off) / 7), row, seed);
  if (v % 4 > 3 && k > 1.2) return at(C.stone, 2 - dark);
  return at(C.stone, 3 - dark + (n < 0.25 ? -1 : n > 0.8 ? 1 : 0));
}

/** Farol: caja de fierro con vidrios dorados. */
function lantern(s: Escena, x: number, y: number, z: number, size = 4) {
  const h = size / 2;
  const glass = (u: number, v: number) => (u < 0.8 || u > size - 0.8 || v < 0.6 ? at(C.metal, 1) : at(C.gold, v > size * 0.6 ? 5 : 4));
  s.box(x - h, y - h, z, size, size, size + 1, () => at(C.metal, 2), glass, (u, v) => (u < 0.8 || u > size - 0.8 ? at(C.metal, 0) : at(C.gold, v > size * 0.6 ? 4 : 3)));
  s.solid(x - h - 0.8, y - h - 0.8, z + size + 1, size + 1.6, size + 1.6, 1.2, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
  s.solid(x - 0.5, y - 0.5, z + size + 2.2, 1, 1, 1.5, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
}

/** Tejas rojas para los techitos. */
function tejas(u: number, t: number, luz: number): RGBA {
  const row = Math.floor(t / 4);
  const off = row % 2 ? 3 : 0;
  const k = t - row * 4;
  const b = 3 + luz;
  if (k < 0.9) return at(C.roof, b - 2);
  if ((u + off) % 6 < 0.8) return at(C.roof, b - 1);
  return at(C.roof, k > 3 ? b + 1 : b + (noise(Math.floor((u + off) / 6), row, 3) < 0.15 ? -1 : 0));
}

/** Techo a dos aguas con la cumbrera a lo largo de x. */
function roofX(s: Escena, x0: number, x1: number, y0: number, y1: number, zEave: number, rise: number, shingle = tejas) {
  const mid = (y0 + y1) / 2;
  const half = mid - y0;
  const slope = rise / half;
  const k = Math.hypot(1, slope);
  s.quad([x0, mid, zEave + rise], [1, 0, 0], [0, -1, -slope], x1 - x0, half, (u, v) => shingle(u, v * k, -1));
  s.quad([x0, mid, zEave + rise], [1, 0, 0], [0, 1, -slope], x1 - x0, half, (u, v) => shingle(u, v * k, 1));
  s.quad([x0, y1, zEave - 2], [1, 0, 0], [0, 0, 1], x1 - x0, 2, () => at(C.woodDark, 2));
  s.quad([x1, mid, zEave + rise - 2], [0, 1, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 1));
  s.quad([x1, mid, zEave + rise - 2], [0, -1, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 1));
  for (let x = x0 - 0.5; x < x1 + 0.5; x += 0.4) s.plot(x, mid, zEave + rise + 1, at(C.roof, 5));
}

const FLOWERS: RGBA[] = [at(C.rug, 4), at(C.gold, 5), at(C.rose, 5), at(C.white, 4), at(C.blue, 4), at(C.violet, 4)];

/** Plantita en maceta (hojas en montoncito y alguna flor). */
function pottedPlant(s: Escena, x: number, y: number, z: number, r: number, seed: number, flower = true) {
  s.box(x - r * 0.6, y - r * 0.6, z, r * 1.2, r * 1.2, r * 0.9, () => at(C.dirt, 1), (u) => at(C.terracotta, u < 1 ? 4 : 3), () => at(C.terracotta, 2));
  for (let i = 0; i < r * 14; i++) {
    const a = noise(i, 1, seed) * Math.PI * 2;
    const d = noise(i, 2, seed) * r * 0.8;
    const hz = noise(i, 3, seed) * r * 1.2;
    s.plot(x + Math.cos(a) * d, y + Math.sin(a) * d, z + r * 0.9 + hz, at(C.leaf, hz > r * 0.7 ? 4 : 2 + (i % 2)));
  }
  if (flower) for (let i = 0; i < 3; i++) s.plot(x + (noise(i, 4, seed) - 0.5) * r, y + (noise(i, 5, seed) - 0.5) * r, z + r * 2, FLOWERS[(seed + i) % FLOWERS.length]!);
}

// ---------- Invernadero ----------

/** Casita de vidrio de 5x4 con marcos blancos, mesas con macetas y plantas trepando adentro. */
function greenhouse(): Sprite {
  const s = scene(5, 4, 72);
  const X0 = 4, X1 = 76, Y0 = 6, Y1 = 58, WALL = 34, RISE = 20;
  const mid = (Y0 + Y1) / 2;
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 8, Y1 - Y0 + 8, 0.28);
  // Basa de ladrillo y piso de baldosas.
  const brick: Tinte = (u, v) => (v % 3 < 0.7 || (u + (Math.floor(v / 3) % 2) * 3) % 6 < 0.7 ? at(C.terracotta, 1) : at(C.terracotta, 3));
  s.box(X0, Y0, 0, X1 - X0, Y1 - Y0, 5, (u, v) => ((Math.floor(u / 6) + Math.floor(v / 6)) % 2 ? at(C.stone, 4) : at(C.terracotta, 3)), brick, (u, v) => brick(u, v) && mix(brick(u, v)!, at(C.night, 1), 0.2));
  // Mesas con macetas y plantas.
  for (const ty of [Y0 + 4, Y1 - 14]) {
    // Mesón de listones sobre patas, con macetas y plantas grandes.
    for (const lx of [X0 + 7, X1 - 9]) for (const ly of [ty, ty + 8]) s.solid(lx, ly, 5, 2, 2, 9, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
    s.box(X0 + 6, ty, 14, X1 - X0 - 12, 10, 1.5, (u) => at(C.wood, u % 4 < 0.8 ? 2 : 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
    for (let x = X0 + 10; x < X1 - 8; x += 7) pottedPlant(s, x, ty + 5, 15.5, 3.8 + noise(x, ty, 2) * 2, x + ty);
  }
  // Tomateras altas al fondo y una palmera en maceta.
  for (let x = X0 + 8; x < X1 - 6; x += 12)
    for (let z = 5; z < 30; z += 0.5) {
      s.plot(x + Math.sin(z * 0.6) * 1.5, Y0 + 2, z, at(C.leaf, 2 + (Math.floor(z) % 3 === 0 ? 2 : 0)));
      if (Math.floor(z) % 5 === 2) s.plot(x + 1 + Math.sin(z * 0.6) * 1.5, Y0 + 2.5, z, at(C.rug, 4));
    }
  // Vidrio: marcos blancos opacos y paños celestes translúcidos (se ve lo de adentro).
  const pane = (pitch: number, zlim?: (u: number) => number): Tinte => (u, v) => {
    if (zlim && v > zlim(u)) return null;
    if (u % pitch < 1 || v < 1.2 || Math.abs(v - 14) < 0.6) return at(C.white, 4);
    const d = (u - v * 0.7) % 23;
    if (d > 0 && d < 1.5) return alpha(at(C.white, 4), 0.55);
    return alpha(at(C.sky, v > 18 ? 4 : 3), 0.3);
  };
  // Paredes del fondo (se ven a través del vidrio) y las del frente.
  s.borde = false;
  s.quad([X0, Y0, 5], [1, 0, 0], [0, 0, 1], X1 - X0, WALL - 5, pane(12));
  s.quad([X0, Y0, 5], [0, 1, 0], [0, 0, 1], Y1 - Y0, WALL - 5, pane(12));
  s.borde = true;
  s.quad([X0, Y1, 5], [1, 0, 0], [0, 0, 1], X1 - X0, WALL - 5, (u, v) => {
    // Puerta al centro con su manilla.
    const door = Math.abs(u - (X1 - X0) / 2) < 7;
    if (door && (Math.abs(Math.abs(u - (X1 - X0) / 2) - 7) < 1 || v > 22 && v < 23.5)) return at(C.white, 4);
    if (door && Math.abs(u - (X1 - X0) / 2 - 4) < 0.8 && v > 12 && v < 14) return at(C.gold, 4);
    return pane(12)(u, v);
  });
  s.quad([X1, Y0, 5], [0, 1, 0], [0, 0, 1], Y1 - Y0, WALL - 5, pane(12));
  // Hastial del frente (x = X1) y techo de vidrio.
  s.quad([X1, Y0, WALL], [0, 1, 0], [0, 0, 1], Y1 - Y0, RISE, pane(8, (u) => RISE - (Math.abs(u - (mid - Y0)) / (mid - Y0)) * RISE));
  const slope = RISE / (mid - Y0);
  s.quad([X0, mid, WALL + RISE], [1, 0, 0], [0, 1, -slope], X1 - X0, mid - Y0, (u, v) => (u % 12 < 1 || v < 1 || v > mid - Y0 - 1.2 ? at(C.white, 4) : (u - v) % 29 < 1.5 ? alpha(at(C.white, 4), 0.5) : alpha(at(C.sky, 4), 0.26)));
  s.quad([X0, mid, WALL + RISE], [1, 0, 0], [0, -1, -slope], X1 - X0, mid - Y0, (u, v) => (u % 12 < 1 || v < 1 ? at(C.white, 3) : alpha(at(C.sky, 3), 0.26)));
  // Cumbrera con una veleta chica y ventilación abierta.
  for (let x = X0; x < X1; x += 0.4) {
    s.plot(x, mid, WALL + RISE + 1, at(C.white, 4));
    s.plot(x, mid, WALL + RISE + 1.6, at(C.white, 3));
  }
  s.solid(X1 - 8, mid - 0.5, WALL + RISE, 1, 1, 8, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.disc(X1 - 7.5, mid, WALL + RISE + 8, 1.5, () => at(C.gold, 4));
  // Macetas y una regadera afuera, junto a la puerta.
  pottedPlant(s, 30, Y1 + 4, 0, 3, 7);
  pottedPlant(s, 50, Y1 + 4, 0, 3.5, 9);
  return s.sprite();
}

// ---------- Cobertizo ----------

function toolShed(): Sprite {
  const s = scene(3, 3, 60);
  const X0 = 5, X1 = 42, Y0 = 6, Y1 = 40, H = 30;
  s.shadow(X0 - 2, Y0 - 2, X1 - X0 + 6, Y1 - Y0 + 6, 0.3);
  s.box(X0 - 1, Y0 - 1, 0, X1 - X0 + 2, Y1 - Y0 + 2, 3, flatT(at(C.stone, 4)), (u, v) => stones(u, v, 3), (u, v) => stones(u, v, 3, 1));
  // Frente con puerta doble en diagonal (tablas verticales) y costado con ventanita.
  s.quad([X0, Y1, 3], [1, 0, 0], [0, 0, 1], X1 - X0, H - 3, (u, v) => {
    const du = u - (X1 - X0) / 2;
    if (Math.abs(du) < 10 && v < 22) {
      if (Math.abs(du) < 0.8 || Math.abs(Math.abs(du) - 10) < 1 || v > 21) return at(C.woodDark, 1);
      if (Math.abs(v - 3 - Math.abs(du) * 1.6) < 1 || Math.abs(v - 11) < 0.9 || v < 1.2) return at(C.woodDark, 3);
      if (Math.abs(du - 2.5) < 0.8 && v > 10 && v < 12) return at(C.metal, 4);
      return planks(C.rug, 3, 3)(u, v);
    }
    return planks(C.rug, 4, 3)(u, v);
  });
  s.quad([X1, Y0, 3], [0, 1, 0], [0, 0, 1], Y1 - Y0, H - 3, (u, v) => {
    if (u > 10 && u < 24 && v > 12 && v < 22) {
      if (u < 11 || u > 23 || v < 13 || v > 21 || Math.abs(u - 17) < 0.7 || Math.abs(v - 17) < 0.7) return at(C.cream, 4);
      return at(C.sky, v > 17 ? 3 : 2);
    }
    return planks(C.rug, 4, 2)(u, v);
  });
  // Techo a un agua, bajando hacia el frente.
  const zB = H + 12;
  const slope = 12 / (Y1 - Y0 + 8);
  s.quad([X0 - 4, Y0 - 4, zB], [1, 0, 0], [0, 1, -slope], X1 - X0 + 8, Y1 - Y0 + 8, (u, v) => tejas(u, v * 1.05, 0));
  s.quad([X0 - 4, Y1 + 4, zB - (Y1 - Y0 + 8) * slope - 2], [1, 0, 0], [0, 0, 1], X1 - X0 + 8, 2, () => at(C.woodDark, 2));
  // Triángulo del costado bajo el techo a un agua.
  s.quad([X1, Y0, H], [0, 1, 0], [0, 0, 1], Y1 - Y0, 12, (u, v) => (v > 12 - (u / (Y1 - Y0)) * 12 ? null : planks(C.rug, 4, 2)(u, v)));
  s.quad([X1 + 4, Y0 - 4, zB - 2], [0, 1, -slope], [0, 0, 1], Y1 - Y0 + 8, 2.2, () => at(C.woodDark, 1));
  // Herramientas apoyadas en el frente: rastrillo, pala y una regadera verde.
  for (const [x, head] of [
    [X0 + 3, "rake"],
    [X0 + 6, "shovel"],
  ] as const) {
    for (let z = 0; z < 24; z += 0.5) s.plot(x + z * 0.12, Y1 + 3 - z * 0.06, z, at(C.wood, 4));
    if (head === "rake") for (let k = -3; k <= 3; k += 0.5) s.plot(x + 3 + k * 0.2, Y1 + 1.5, 23 + (Math.floor(k * 2) % 2 ? 0 : -1.5), at(C.metal, 3));
    else s.box(x - 1.5, Y1 + 2, 0, 3, 1, 5, null, flatT(at(C.metal, 3)), null);
  }
  s.solid(X1 - 10, Y1 + 3, 0, 6, 4, 5, at(C.green, 4), at(C.green, 3), at(C.green, 2));
  for (let k = 0; k < 5; k += 0.4) s.plot(X1 - 4 + k, Y1 + 5, 3 + k * 0.6, at(C.green, 3));
  // Sacos de tierra.
  s.solid(X1 + 1, Y0 + 4, 0, 5, 8, 5, at(C.cork, 4), at(C.cork, 3), at(C.cork, 2));
  return s.sprite();
}

// ---------- Glorieta ----------

const GZ = { cx: 32, cy: 32, R: 27, ROOF: 46, posts: 8 };

/** Ángulo del poste i (el octógono queda con la entrada, entre dos postes, hacia +x). */
const gazeboPost = (i: number) => (i / GZ.posts) * Math.PI * 2 + Math.PI / 8;

/**
 * Base de la glorieta (va plana, debajo de todo: se camina por dentro): plataforma de piedra, piso de
 * madera en abanico, el escalón de la entrada (+x) y la banca corrida en herradura mirando al centro.
 */
function gazebo(): Sprite {
  const s = scene(4, 4, 30, 10);
  const { cx, cy, R } = GZ;
  s.roundShadow(cx + 2, cy + 2, R + 4, 0.3);
  s.cylinder(cx, cy, 0, R + 2, 5, (a, v, luz) => stones(a * (R + 2), v, 4, luz < 0 ? 1 : 0));
  s.disc(cx, cy, 5, R + 2, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d > R) return at(C.stone, 4);
    // Tablas en abanico con un rosetón al centro.
    if (d < 4) return at(C.woodDark, d < 2 ? 4 : 3);
    return at(C.wood, Math.floor((Math.atan2(dy, dx) + 4) * 4) % 2 ? 3 : 4);
  });
  s.box(cx + R, cy - 8, 0, 5, 16, 3, flatT(at(C.stone, 4)), flatT(at(C.stone, 3)), flatT(at(C.stone, 2)));
  // Banca en herradura: de un poste de la entrada al otro, por detrás.
  for (let a = Math.PI * 0.3; a < Math.PI * 1.7; a += 0.05) {
    const x = cx + Math.cos(a) * (R - 5);
    const y = cy + Math.sin(a) * (R - 5);
    s.solid(x - 1.8, y - 1.8, 5, 3.6, 3.6, 7, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  }
  // Patas de la banca.
  for (let a = Math.PI * 0.35; a < Math.PI * 1.7; a += Math.PI / 5) s.solid(cx + Math.cos(a) * (R - 5) - 1, cy + Math.sin(a) * (R - 5) - 1, 5, 2, 2, 5, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  return s.sprite();
}

/**
 * La parte de arriba de la glorieta: los postes blancos, la baranda, los arcos calados, el techo
 * octogonal, el farol y la campanita que cuelgan del centro, y la guirnalda de bombillos entre los postes
 * (de noche encendida). Va sobre la base, ordenada con su centro; el cliente la transparenta cuando hay
 * alguien adentro, para que se vea quién está.
 */
function gazeboRoof(night: boolean): Sprite {
  const s = scene(4, 4, 104, 10);
  const { cx, cy, R, ROOF, posts } = GZ;
  for (let i = 0; i < posts; i++) {
    const a = gazeboPost(i);
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    s.solid(x - 1.5, y - 1.5, 5, 3, 3, ROOF - 5, at(C.white, 4), at(C.white, 3), at(C.white, 1));
    const b = gazeboPost(i + 1);
    const entrance = Math.abs(Math.cos((a + b) / 2) - 1) < 0.1;
    for (let k = 0; k <= 1; k += 0.03) {
      const x1 = cx + Math.cos(a) * R * (1 - k) + Math.cos(b) * R * k;
      const y1 = cy + Math.sin(a) * R * (1 - k) + Math.sin(b) * R * k;
      if (!entrance) {
        s.plot(x1, y1, 16, at(C.white, 4));
        s.borde = false;
        if (Math.floor(k * 30) % 3 === 0) for (let z = 6; z < 16; z += 0.5) s.plot(x1, y1, z, at(C.white, 2));
        s.borde = true;
      }
      s.plot(x1, y1, ROOF - 3 - Math.sin(k * Math.PI) * 4, at(C.white, 4));
      // Guirnalda: cae un poco más que el arco, con un bombillo cada tanto.
      const zg = ROOF - 6 - Math.sin(k * Math.PI) * 6;
      s.plot(x1, y1, zg, at(C.metal, 1));
      if (Math.floor(k * 100) % 20 === 10) {
        const bulb = night ? at(C.gold, 5) : at(C.cream, 4);
        s.plot(x1, y1, zg - 1, bulb);
        s.plot(x1 + 0.5, y1, zg - 1.5, night ? at(C.white, 4) : at(C.gold, 3));
      }
    }
  }
  // Enredadera de rosas en dos postes.
  for (const i of [2, 5]) {
    const a = gazeboPost(i);
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    for (let z = 5; z < ROOF; z += 0.5) {
      const t = z * 0.7;
      s.plot(x + Math.cos(t) * 2.2, y + Math.sin(t) * 2.2, z, at(C.leaf, 2 + (Math.floor(z) % 2)));
      if (noise(Math.floor(z), i, 3) < 0.2) s.plot(x + Math.cos(t) * 2.6, y + Math.sin(t) * 2.6, z, at(C.rug, 4));
    }
  }
  // Techo octogonal: cono con caras planas (tono por cara) y remate.
  s.cylinder(cx, cy, ROOF - 2, R + 7, 2.5, (_a, _v, luz) => at(C.white, luz > 0 ? 4 : 2));
  s.cone(cx, cy, ROOF, R + 7, 24, (a, sl) => {
    const face = Math.floor(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4) + 0.5);
    const fa = face * (Math.PI / 4);
    const luz = Math.sin(fa) * 0.8 - Math.cos(fa) * 0.3;
    const edge = Math.abs(((a + Math.PI * 2) % (Math.PI / 4)) - Math.PI / 8) > Math.PI / 8 - 0.04;
    if (edge) return at(C.white, 3);
    return tejas(a * 20, sl, luz > 0.4 ? 1 : luz > -0.2 ? 0 : -1);
  });
  s.solid(cx - 1, cy - 1, ROOF + 24, 2, 2, 6, at(C.white, 4), at(C.white, 3), at(C.white, 2));
  s.disc(cx, cy, ROOF + 31, 2, () => at(C.gold, 4));
  // Del centro cuelgan el farol y, un poco al lado, la campanita de bronce con su cordón.
  for (let z = 34; z < ROOF + 6; z += 0.5) s.plot(cx, cy, z, at(C.metal, 1));
  lantern(s, cx, cy, 29);
  for (let z = 30; z < ROOF + 4; z += 0.5) s.plot(cx + 5, cy - 3, z, at(C.metal, 1));
  s.cylinder(cx + 5, cy - 3, 26, 2.2, 4, (_a, v, luz) => at(C.gold, v < 1 ? 2 : luz > 0 ? 4 : 3));
  s.disc(cx + 5, cy - 3, 30, 1.2, () => at(C.gold, 5));
  for (let z = 22; z < 26; z += 0.5) s.plot(cx + 5, cy - 3, z, at(C.cork, 3));
  return s.sprite();
}

// ---------- Pérgola de la terraza ----------

function pergola(): Sprite {
  const s = scene(3, 3, 80, 8);
  const H = 44;
  s.shadow(2, 2, 46, 46, 0.22);
  // Mesa larga con dos bancas y un florero.
  for (const [lx, ly] of [
    [19, 11],
    [28, 11],
    [19, 35],
    [28, 35],
  ] as const)
    s.solid(lx, ly, 0, 2, 2, 12, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.box(17, 9, 12, 14, 30, 1.5, planks(C.wood, 4, 5), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  for (const bx of [10, 34]) {
    for (const ly of [12, 34]) s.solid(bx + 1.5, ly, 0, 2, 2, 6, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    s.box(bx, 11, 6, 5, 26, 1.5, planks(C.wood, 5, 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  }
  // Mantel y dos tazas.
  s.box(20, 16, 13.5, 8, 16, 0.3, (u, v) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? at(C.fabric, 4) : at(C.white, 4)), null, null);
  s.cylinder(22, 30, 13.8, 1.1, 1.8, (_a, _v, luz) => at(C.white, luz > 0 ? 4 : 2));
  s.cylinder(26, 13, 13.8, 1.1, 1.8, (_a, _v, luz) => at(C.white, luz > 0 ? 4 : 2));
  pottedPlant(s, 24, 24, 13.5, 2.2, 11);
  // Postes, vigas y listones.
  for (const px of [3, 42]) for (const py of [3, 42]) s.solid(px, py, 0, 3, 3, H, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  for (const px of [3, 42]) s.solid(px, -1, H, 3, 50, 3, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  for (let y = 1; y < 48; y += 6) s.solid(-2, y, H + 3, 52, 2, 2, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  // Enredadera con hojas y flores moradas encima; guirnalda de luces colgando.
  for (let y = -2; y < 50; y += 0.8)
    for (let x = -2; x < 50; x += 0.8) {
      const n = noise(Math.floor(x / 3), Math.floor(y / 3), 7);
      const m = noise(Math.floor(x), Math.floor(y), 9);
      if (n < 0.45 || (x > 10 && x < 38 && y > 10 && y < 38 && n < 0.7)) continue;
      s.plot(x, y, H + 5 + m * 2, at(C.leaf, m > 0.7 ? 4 : m > 0.35 ? 3 : 2));
      if (m < 0.06) for (let k = 0; k < 6; k += 0.5) s.plot(x, y, H + 4 - k, at(C.violet, k > 4.5 ? 3 : 4));
    }
  for (const [a, b] of [
    [[4.5, 4.5], [43.5, 43.5]],
    [[43.5, 4.5], [4.5, 43.5]],
  ] as const)
    for (let k = 0; k <= 1; k += 0.01) {
      const x = a[0] + (b[0] - a[0]) * k;
      const y = a[1] + (b[1] - a[1]) * k;
      const z = H - 1 - Math.sin(k * Math.PI) * 7;
      s.plot(x, y, z, at(C.metal, 1));
      if (Math.floor(k * 100) % 12 === 0) {
        s.plot(x, y, z - 1, at(C.gold, 5));
        s.plot(x + 0.5, y, z - 1.5, at(C.gold, 4));
      }
    }
  for (const [px, py] of [
    [4.5, 4.5],
    [43.5, 43.5],
  ] as const)
    for (let z = 0; z < H; z += 0.5) s.plot(px + Math.cos(z * 0.5) * 2.2, py + Math.sin(z * 0.5) * 2.2, z, at(C.leaf, 2 + (Math.floor(z) % 3 === 0 ? 2 : 0)));
  return s.sprite();
}

// ---------- Portón y cerca ----------

/** Portón de dos hojas entre pilares de piedra, con un arco de rosas y un farol. Mide 2x1 (a lo largo de x). */
function gardenGate(): Sprite {
  const s = scene(2, 1, 70, 8);
  const y = 7;
  for (const px of [-2, 28]) {
    s.box(px, y - 3, 0, 6, 6, 22, flatT(at(C.stone, 4)), (u, v) => stones(u, v, px + 3), (u, v) => stones(u, v, px + 3, 1));
    s.solid(px - 1, y - 4, 22, 8, 8, 2, at(C.stone, 5), at(C.stone, 3), at(C.stone, 2));
  }
  // Hojas del portón: tablas verticales con travesaños y el borde de arriba en curva.
  s.quad([4, y, 1], [1, 0, 0], [0, 0, 1], 24, 18, (u, v) => {
    const du = Math.abs(u - 12);
    if (v > 14 + (du / 12) ** 2 * 3) return null;
    if (du < 0.7) return at(C.woodDark, 1);
    if (Math.abs(v - 4) < 0.9 || Math.abs(v - 11) < 0.9) return at(C.woodDark, 3);
    if (u % 3 < 0.7) return null;
    if (Math.abs(u - 10.5) < 0.8 && v > 7 && v < 9) return at(C.metal, 4);
    return at(C.wood, noise(Math.floor(u / 3), 1, 4) < 0.4 ? 3 : 4);
  });
  // Arco de madera sobre los pilares con rosas trepando y un farol colgado.
  for (let k = 0; k <= 1; k += 0.004) {
    const x = 1 + k * 30;
    const z = 24 + Math.sin(k * Math.PI) * 16;
    for (let t = 0; t < 2.5; t += 0.5) s.plot(x, y, z + t, at(C.wood, t > 1.8 ? 5 : 3));
    if (noise(Math.floor(k * 70), 1, 5) < 0.55)
      for (let j = 0; j < 3; j++) s.plot(x + (noise(Math.floor(k * 200), j, 3) - 0.5) * 3, y + (j - 1) * 1.2, z + 2.5 + noise(Math.floor(k * 90), j, 8) * 2, at(C.leaf, 2 + j));
    if (noise(Math.floor(k * 60), 2, 6) < 0.18) {
      s.plot(x, y + 1.2, z + 3.5, at(C.rug, 4));
      s.plot(x + 0.5, y + 1.2, z + 4, at(C.rug, 3));
    }
  }
  for (let z = 30; z < 40; z += 0.5) s.plot(16, y, z, at(C.metal, 1));
  lantern(s, 16, y, 25);
  return s.sprite();
}

function fencePost(): Sprite {
  const s = scene(1, 1, 24);
  s.solid(5.5, 5.5, 0, 5, 5, 18, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  s.solid(5, 5, 18, 6, 6, 2, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  s.solid(7, 7, 20, 2, 2, 2, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  return s.sprite();
}

// ---------- Huerto ----------

function well(): Sprite {
  const s = scene(2, 2, 60, 6);
  const cx = 16, cy = 16, r = 11;
  s.roundShadow(cx + 1, cy + 1, r + 2, 0.3);
  s.cylinder(cx, cy, 0, r, 12, (a, v, luz) => (v > 10.5 ? at(C.stone, 5) : stones(a * r, v, 6, luz < 0 ? 1 : 0)));
  s.disc(cx, cy, 12, r, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d > r - 2) return at(C.stone, 4);
    return d < r - 5 && (dx - dy) % 5 < 0.6 ? at(C.sky, 3) : at(C.sky, 1);
  });
  // Postes y techito a dos aguas con la cumbrera a lo largo de y, manivela, soga y balde.
  for (const px of [cx - r - 1, cx + r - 2]) s.solid(px, cy - 1.5, 0, 3, 3, 34, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.solid(cx - r, cy - 1, 28, r * 2, 2, 2, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
  for (let z = 14; z < 28; z += 0.5) s.plot(cx, cy, z, at(C.cork, 3));
  s.cylinder(cx, cy, 14, 2.5, 4, (_a, v, luz) => (v > 3 || v < 1 ? at(C.metal, 3) : at(C.wood, luz > 0 ? 4 : 2)));
  s.solid(cx + r + 1, cy - 1, 28, 2, 2, 2, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.solid(cx + r + 2.5, cy - 1, 23, 1.5, 1.5, 6, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  const zE = 32;
  const half = 12;
  const slope = 0.8;
  s.quad([cx, cy - half - 1, zE + half * slope], [0, 1, 0], [-1, 0, -slope], half * 2 + 2, half + 3, (u, v) => tejas(u, v * 1.3, 0));
  s.quad([cx, cy - half - 1, zE + half * slope], [0, 1, 0], [1, 0, -slope], half * 2 + 2, half + 3, (u, v) => tejas(u, v * 1.3, -1));
  s.quad([cx, cy + half + 1, zE + half * slope - 2], [-1, 0, -slope], [0, 0, 1], half + 3, 2.2, () => at(C.woodDark, 2));
  s.quad([cx, cy + half + 1, zE + half * slope - 2], [1, 0, -slope], [0, 0, 1], half + 3, 2.2, () => at(C.woodDark, 2));
  for (let y = cy - half - 1; y < cy + half + 1; y += 0.4) s.plot(cx, y, zE + half * slope + 1, at(C.roof, 5));
  return s.sprite();
}

/** Colmena de cajones apilados sobre un soporte, con techito y abejas alrededor. */
function beehive(): Sprite {
  const s = scene(1, 1, 36, 6);
  s.shadow(3, 3, 11, 11, 0.28);
  for (const [px, py] of [
    [4, 4],
    [11, 4],
    [4, 11],
    [11, 11],
  ] as const)
    s.solid(px, py, 0, 1.5, 1.5, 5, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  const boxes: [number, Ramp][] = [
    [5, C.cream],
    [11, C.mustard],
    [17, C.cream],
  ];
  for (const [z, r] of boxes)
    s.box(3.5, 3.5, z, 9, 9, 5.6, flatT(at(r, 4)), (u, v) => (v < 0.8 ? at(r, 1) : z === 5 && u > 3 && u < 6 && v < 2 ? OUT : at(r, 3)), (_u, v) => at(r, v < 0.8 ? 0 : 2));
  s.box(2.5, 2.5, 22.6, 11, 11, 2, flatT(at(C.roof, 4)), flatT(at(C.roof, 3)), flatT(at(C.roof, 2)));
  const q = s.p(8, 8, 26);
  for (let i = 0; i < 7; i++) {
    const x = Math.round(q.x + (noise(i, 1, 4) - 0.5) * 22);
    const y = Math.round(q.y + (noise(i, 2, 4) - 0.5) * 12);
    s.canvas.set(x, y, at(C.gold, 4));
    s.canvas.set(x + 1, y, OUT);
    s.canvas.set(x, y - 1, alpha(at(C.white, 4), 0.8));
  }
  return s.sprite();
}

/** Compostera: dos cajones de listones con tierra, cáscaras y hojas. */
function compost(): Sprite {
  const s = scene(1, 2, 20);
  s.shadow(2, 2, 13, 29, 0.28);
  for (const y0 of [2, 17]) {
    const slats: Tinte = (_u, v) => (v % 3.5 < 1.2 ? null : at(C.wood, 3));
    s.box(2, y0, 0, 12, 13, 10, (u, v) => {
      const n = noise(Math.floor(u), Math.floor(v), y0);
      if (n < 0.12) return at(C.leaf, 3);
      if (n < 0.18) return at(C.fire, 3);
      if (n < 0.22) return at(C.mustard, 4);
      return at(C.dirt, n < 0.5 ? 1 : 2);
    }, slats, slats);
    for (const [px, py] of [
      [2, y0 + 12],
      [13, y0 + 12],
      [13, y0],
    ] as const)
      s.solid(px - 0.5, py - 0.5, 0, 1.5, 1.5, 11, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  }
  // Pala enterrada.
  for (let z = 6; z < 22; z += 0.5) s.plot(7 + (z - 6) * 0.15, 24, z, at(C.wood, 4));
  return s.sprite();
}

/** Barril de madera con zunchos (con tapa, o con agua si `water`). */
function barrel(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(8.5, 8.5, 6, 0.3);
  s.cylinder(8, 8, 0, 5.5, 14, (a, v, luz) => {
    if (Math.abs(v - 2.5) < 0.8 || Math.abs(v - 11.5) < 0.8) return at(C.metal, luz > 0 ? 3 : 1);
    if (Math.floor(a * 5.5 / 2.2) % 2 === 0 && (a * 5.5) % 2.2 < 0.4) return at(C.woodDark, 2);
    return at(C.wood, luz > 0.4 ? 4 : luz > -0.3 ? 3 : 2);
  });
  s.disc(8, 8, 14, 5.5, (dx, dy) => (Math.hypot(dx, dy) > 4.6 ? at(C.wood, 2) : at(C.wood, Math.floor(dx + 10) % 3 === 0 ? 3 : 4)));
  s.solid(6, 6, 14, 5, 5, 3, at(C.fire, 3), at(C.fire, 2), at(C.fire, 1));
  s.solid(8, 8, 17, 1, 1, 1.5, at(C.leaf, 3), at(C.leaf, 2), at(C.leaf, 1));
  return s.sprite();
}

/** Cajones de madera apilados con zapallos y zanahorias. */
function crates(): Sprite {
  const s = scene(1, 1, 30);
  s.shadow(1, 1, 15, 15, 0.28);
  const crate = (x: number, y: number, z: number, w: number) =>
    s.box(x, y, z, w, w, w * 0.7, (u, v) => (u < 1 || v < 1 || u > w - 1 || v > w - 1 ? at(C.wood, 3) : at(C.dirt, 1)), planks(C.wood, 3, 4, 3), planks(C.wood, 3, 3, 5));
  crate(1, 1, 0, 14);
  crate(3, 3, 9.8, 9);
  // Zapallos en el cajón de abajo y zanahorias arriba.
  for (const [x, y] of [
    [12, 11],
    [9, 13],
  ] as const) {
    const q = s.p(x, y, 9.8);
    blob(s.canvas, q.x, q.y - 2, 3.2, 2.4, (nx, ny) => at(C.fire, 3 - Math.round(nx * 0.6 + ny * 0.9)));
    s.canvas.set(q.x, q.y - 5, at(C.leaf, 2));
  }
  const q = s.p(7.5, 7.5, 16);
  for (let i = 0; i < 5; i++) {
    const x = q.x - 4 + i * 2;
    s.canvas.set(x, q.y - 1, at(C.fire, 3));
    s.canvas.set(x, q.y - 2, at(C.leaf, 4));
    s.canvas.set(x, q.y - 3, at(C.leaf, 3));
  }
  return s.sprite();
}

function wheelbarrow(): Sprite {
  const s = scene(1, 1, 20);
  s.shadow(2, 3, 12, 10, 0.25);
  // Rueda delante (+x), batea verde con tierra y un zapallo, mangos hacia atrás.
  s.quad([13, 6, 0], [0, 1, 0], [0, 0, 1], 4, 6, (u, v) => {
    const d = Math.hypot(u - 2, v - 3);
    return d > 3 ? null : d > 2 ? at(C.metal, 1) : at(C.metal, 3);
  });
  s.box(3, 4, 5, 10, 8, 6, (u, v) => (u < 1 || v < 1 || u > 9 || v > 7 ? at(C.green, 3) : at(C.dirt, 2)), (_u, v) => at(C.green, v > 5 ? 4 : 3), (_u, v) => at(C.green, v > 5 ? 3 : 2));
  for (const y of [5, 11]) {
    for (let k = 0; k < 7; k += 0.4) s.plot(3 - k, y, 7 - k * 0.3, at(C.wood, 3));
    s.solid(4, y - 0.5, 0, 1, 1, 5, at(C.metal, 2), at(C.metal, 1), at(C.metal, 0));
  }
  const q = s.p(8, 8, 11);
  blob(s.canvas, q.x, q.y - 2, 3, 2.2, (nx, ny) => at(C.fire, 3 - Math.round(nx * 0.6 + ny * 0.9)));
  return s.sprite();
}

// ---------- Terraza, fogata y lago ----------

/** Leñera: troncos apilados a lo largo de y bajo un techito, con el tajo y el hacha al costado. */
function woodpile(): Sprite {
  const s = scene(1, 3, 44);
  s.shadow(1, 1, 14, 46, 0.3);
  // Troncos: se ven las puntas en la cara +x (anillos).
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7 - (row === 3 ? 2 : 0); col++) {
      const y = 4 + col * 5.4 + (row % 2) * 2.7 + (row === 3 ? 5 : 0);
      const z = row * 4.6;
      const r = 2.5 + noise(col, row, 2) * 0.5;
      s.box(2, y - r, z, 11, r * 2, r * 2 - 0.4, (u) => at(C.logs, u % 5 < 0.7 ? 1 : 3), flatT(at(C.logs, 2)), (u, v) => {
        const d = Math.hypot(u - r, v - r);
        if (d > r) return null;
        return d > r - 0.8 ? at(C.logs, 2) : at(C.cork, Math.floor(d * 1.6) % 2 ? 3 : 4);
      });
    }
  // Techito a un agua sobre postes.
  for (const py of [1, 44]) s.solid(0.5, py, 0, 2, 2, 26, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.quad([-2, -1, 28], [0, 1, 0], [1, 0, -0.35], 50, 18, (u, v) => tejas(u, v * 1.06, 0));
  s.quad([-2 + 18, 49, 28 - 18 * 0.35], [0, -1, 0], [0, 0, -1], 50, 1.8, () => at(C.woodDark, 2));
  return s.sprite();
}

/** Fogata: anillo de piedras, leños en tipi, llamas y brasas. */
function firePit(): Sprite {
  const s = scene(2, 2, 44, 6);
  const cx = 16, cy = 16;
  s.disc(cx, cy, 0.2, 13, (dx, dy) => alpha(at(C.dirt, 1), Math.hypot(dx, dy) > 12 ? 0.5 : 0.9));
  // Piedras del anillo.
  for (let a = 0; a < Math.PI * 2; a += 0.42) {
    const x = cx + Math.cos(a) * 10;
    const y = cy + Math.sin(a) * 10;
    const r = 2.4 + noise(Math.floor(a * 10), 1, 3) * 0.8;
    s.box(x - r, y - r, 0, r * 2, r * 2, 3.5 + noise(Math.floor(a * 10), 2, 3) * 1.5, flatT(at(C.stone, 4)), flatT(at(C.stone, 3)), flatT(at(C.stone, 2)));
  }
  s.disc(cx, cy, 0.5, 8, (dx, dy) => {
    const n = noise(Math.floor(dx * 2), Math.floor(dy * 2), 5);
    return n < 0.25 ? at(C.fire, 2) : n < 0.4 ? at(C.fire, 1) : at(C.stone, 0);
  });
  // Leños en tipi.
  for (const a of [0.2, 1.8, 3.4, 5]) {
    const x0 = cx + Math.cos(a) * 7;
    const y0 = cy + Math.sin(a) * 7;
    for (let k = 0; k <= 1; k += 0.03) {
      const x = x0 + (cx - x0) * k;
      const y = y0 + (cy - y0) * k;
      const z = 1 + k * 11;
      for (let t = -1; t <= 1; t += 0.5) s.plot(x + t * Math.sin(a), y - t * Math.cos(a), z, at(C.logs, t < 0 ? 3 : 1));
    }
  }
  // Llamas (2D, en capas) y chispas.
  const q = s.p(cx, cy, 3);
  const flame = (rx: number, h: number, col: RGBA, dx = 0) => {
    for (let y = 0; y < h; y++) {
      const w = rx * Math.sin((1 - y / h) * Math.PI * 0.55 + 0.05) * (1 - y / h * 0.2);
      for (let x = -w; x <= w; x++) s.canvas.set(Math.round(q.x + dx + x + Math.sin(y * 0.8) * (y / h) * 2), Math.round(q.y - y), col);
    }
  };
  flame(7, 18, at(C.fire, 1));
  flame(5.5, 15, at(C.fire, 2));
  flame(4, 12, at(C.fire, 3), 1);
  flame(2.5, 8, at(C.fire, 4));
  flame(1.2, 4, at(C.white, 4));
  for (const [dx, dy] of [
    [-5, -22],
    [4, -26],
    [1, -30],
  ] as const) s.canvas.set(q.x + dx, q.y + dy, at(C.fire, 4));
  return s.sprite();
}

/** Tronco para sentarse: a lo largo de y, con la cara de arriba aplanada y las puntas cortadas. */
function logSeat(): Sprite {
  const s = scene(1, 2, 16);
  s.shadow(3, 1, 11, 31, 0.28);
  const r = 4.5;
  const cx = 8;
  for (let y = 1.5; y < 30.5; y += 0.4)
    for (let a = -Math.PI / 4 - 0.2; a <= (3 * Math.PI) / 4 + 0.2; a += 0.08) {
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      if (nz > 0.75) continue;
      const luz = nz * 0.7 - nx * 0.3;
      const groove = Math.floor(y / 2.2 + noise(Math.floor(a * 5), 1, 7) * 3) % 4 === 0;
      s.plot(cx + nx * r, y, r + nz * r, at(C.logs, (luz > 0.4 ? 3 : luz > -0.2 ? 2 : 1) - (groove ? 1 : 0)));
    }
  // Asiento aplanado (madera clara) y la punta con anillos.
  s.quad([cx - r * 0.66, 1.5, r + r * 0.75], [1, 0, 0], [0, 1, 0], r * 1.32, 29, (u, v) => at(C.cork, Math.floor(v / 3) % 2 && u > 1 ? 4 : 3));
  s.quad([cx - r, 30.5, 0], [1, 0, 0], [0, 0, 1], r * 2, r * 1.75, (u, v) => {
    const d = Math.hypot(u - r, v - r);
    if (d > r) return null;
    return d > r - 0.9 ? at(C.logs, 1) : at(C.cork, Math.floor(d * 1.4) % 2 ? 3 : 4);
  });
  return s.sprite();
}

function picnicTable(): Sprite {
  const s = scene(1, 2, 24);
  s.shadow(1, 1, 15, 31, 0.28);
  for (const y of [5, 26])
    for (const k of [-1, 1])
      for (let z = 0; z < 13; z += 0.5) s.solid(8 + k * (4 - z * 0.25) - 0.8, y, z, 1.6, 1.6, 0.6, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  s.box(1.5, 1, 13, 13, 30, 2, (u) => at(C.wood, u % 3.2 < 0.7 ? 2 : 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  // Mantel a cuadros y una canasta.
  s.box(4, 8, 15, 8, 14, 0.4, (u, v) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? at(C.rug, 3) : at(C.white, 4)), null, null);
  s.solid(6, 13, 15.4, 5, 5, 3.5, at(C.cork, 4), at(C.cork, 3), at(C.cork, 2));
  for (let k = 0; k < 5; k += 0.3) s.plot(6 + k, 15.5, 19 + Math.sin((k / 5) * Math.PI) * 2.5, at(C.cork, 2));
  s.solid(8, 23, 15.4, 1.5, 1.5, 4, at(C.rose, 4), at(C.rose, 3), at(C.rose, 2));
  return s.sprite();
}

function picnicBench(): Sprite {
  const s = scene(1, 2, 14);
  s.shadow(3, 1, 11, 31, 0.25);
  for (const y of [4, 26]) s.solid(7, y, 0, 2, 2, 7, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  s.box(4, 1.5, 7, 8, 29, 1.8, (u) => at(C.wood, u % 4 < 0.7 ? 2 : 4), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  return s.sprite();
}

function patioTable(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(8.5, 8.5, 6, 0.28);
  s.solid(7, 7, 0, 2, 2, 12, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.solid(5, 5, 0, 6, 6, 1, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.cylinder(8, 8, 11, 6.5, 1.5, (_a, _v, luz) => at(C.wood, luz > 0 ? 3 : 2));
  s.disc(8, 8, 12.5, 6.5, (dx) => at(C.wood, Math.floor(dx + 10) % 3 === 0 ? 3 : 5));
  // Velita en un frasco y una taza.
  s.cylinder(8, 8, 12.5, 1.5, 3, () => alpha(at(C.gold, 5), 0.9));
  s.cylinder(11, 6, 12.5, 1.2, 2, (_a, _v, luz) => at(C.white, luz > 0 ? 4 : 3));
  return s.sprite();
}

/** Silla de jardín de listones: mira hacia +x (de espaldas: el respaldo queda hacia la cámara). */
function patioChair(v: "front" | "back"): Sprite {
  const s = scene(1, 1, 26);
  s.shadow(3, 3, 10, 10, 0.25);
  const back = v === "back";
  for (const [px, py] of [
    [4, 4],
    [11, 4],
    [4, 11],
    [11, 11],
  ] as const)
    s.solid(px, py, 0, 1.5, 1.5, 7, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  s.box(3.5, 3.5, 7, 9, 9, 1.5, (u) => at(C.wood, u % 3 < 0.6 ? 2 : 5), flatT(at(C.wood, 3)), flatT(at(C.wood, 2)));
  s.solid(5, 5, 8.5, 6, 6, 1.2, at(C.green, 4), at(C.green, 3), at(C.green, 2));
  const bx = back ? 11 : 3.5;
  s.box(bx, 3.5, 8.5, 1.5, 9, 10, flatT(at(C.wood, 5)), (u) => at(C.wood, u % 3 < 0.6 ? 2 : 4), (u, vv) => (vv > 8.5 ? at(C.wood, 5) : u % 3 < 0.8 ? at(C.wood, 1) : at(C.wood, 3)));
  return s.sprite();
}

function gardenLantern(): Sprite {
  const s = scene(1, 1, 36);
  s.roundShadow(8.5, 8.5, 4, 0.28);
  s.box(5, 5, 0, 6, 6, 4, flatT(at(C.stone, 4)), (u, v) => stones(u, v, 2), (u, v) => stones(u, v, 2, 1));
  s.solid(7, 7, 4, 2, 2, 18, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  lantern(s, 8, 8, 22, 5);
  // Enredadera en el poste.
  for (let z = 4; z < 18; z += 0.5) s.plot(8 + Math.cos(z) * 1.4, 8 + Math.sin(z) * 1.4, z, at(C.leaf, 3));
  return s.sprite();
}

/** Farol del muelle: pilote de madera que sale del agua, soga enrollada y farol arriba. */
function dockLamp(): Sprite {
  const s = scene(1, 1, 50, 8);
  const b = s.p(8, 8, 0);
  s.suelo.ellipse(b.x, b.y, 8, 3.5, alpha(at(C.sky, 4), 0.4));
  s.cylinder(8, 8, -2, 2.4, 36, (a, v, luz) => (v > 2 && v < 4 ? at(C.sage, 2) : at(C.logs, (luz > 0.3 ? 3 : 2) - (Math.floor(a * 6) % 3 === 0 ? 1 : 0))));
  s.disc(8, 8, 34, 2.4, () => at(C.logs, 4));
  s.cylinder(8, 8, 18, 3, 3, (a, v) => at(C.cork, Math.floor(v * 2 + a * 3) % 2 ? 3 : 4));
  for (let k = 0; k < 6; k += 0.4) s.plot(8 + k, 8, 30 - k * 0.2, at(C.metal, 1));
  for (let z = 22; z < 29; z += 0.5) s.plot(13.5, 8, z, at(C.metal, 1));
  lantern(s, 13.5, 8, 17, 4);
  return s.sprite();
}

/** Letrero de camino: poste con tablas en flecha (con rayitas de texto). */
function signpost(): Sprite {
  const s = scene(1, 1, 36, 10);
  s.roundShadow(8.5, 8.5, 3, 0.25);
  s.solid(7, 7, 0, 2, 2, 30, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  const board = (z: number, dir: 1 | -1, r: Ramp) =>
    s.quad([dir > 0 ? 8 : -6, 9.2, z], [1, 0, 0], [0, 0, 1], 14, 5, (u, v) => {
      const tip = dir > 0 ? 14 - u : u;
      if (tip < 3 && Math.abs(v - 2.5) > tip * 0.85) return null;
      if (v < 0.8 || v > 4.2) return at(r, 2);
      if (Math.abs(v - 2.5) < 0.5 && u > 3 && u < 11 && Math.floor(u) % 3 !== 0) return at(C.cream, 5);
      return at(r, 4);
    });
  board(22, 1, C.wood);
  board(15, -1, C.wood);
  return s.sprite();
}

/** Bote de remos amarrado: casco de tablas a lo largo de y, bancos y remos, con ondas en el agua. */
function rowboat(): Sprite {
  const s = scene(1, 2, 18, 8);
  const b = s.p(8, 16, 0);
  s.suelo.ellipse(b.x, b.y, 22, 9, alpha(at(C.sky, 4), 0.3));
  s.suelo.ellipse(b.x, b.y, 18, 7, alpha(at(C.sky, 0), 0.35));
  const halfW = (y: number) => 6 * Math.sin(Math.PI * Math.min(1, Math.max(0, (y - 1) / 30))) ** 0.6;
  // Casco: por cada y, el costado +x y el +y, con tablas horizontales y la franja blanca.
  for (let y = 1; y < 31; y += 0.35) {
    const w = halfW(y);
    for (let z = -1; z < 6; z += 0.4) {
      const k = (z + 1) / 7;
      const ww = w * (0.55 + 0.45 * k);
      const col = z > 4.5 ? at(C.white, 4) : z > 3.6 ? at(C.rug, 3) : at(C.fabric, Math.floor(z) % 2 ? 3 : 2);
      s.plot(8 + ww, y, z, col);
      s.plot(8 - ww, y, z, mix(col, at(C.night, 1), 0.2));
    }
  }
  // Interior: fondo de tablas y bancos.
  for (let y = 2; y < 30; y += 0.4) {
    const w = halfW(y) * 0.95;
    for (let x = -w; x <= w; x += 0.4) s.plot(8 + x, y, 2, at(C.wood, Math.floor(x + 10) % 3 === 0 ? 2 : 3));
    s.plot(8 + halfW(y), y, 6.2, at(C.wood, 5));
    s.plot(8 - halfW(y), y, 6.2, at(C.wood, 4));
  }
  for (const y of [10, 20]) s.solid(8 - halfW(y) * 0.95, y, 4, halfW(y) * 1.9, 3, 1.2, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  // Remos cruzados.
  for (let k = 0; k < 22; k += 0.3) {
    s.plot(3 + k * 0.45, 6 + k, 6.8, at(C.wood, 4));
    s.plot(13 - k * 0.45, 6 + k, 7, at(C.wood, 5));
  }
  // Soga hacia el muelle.
  for (let k = 0; k < 8; k += 0.3) s.plot(8 - k * 0.6, 2 - k * 0.7, 5 - Math.sin((k / 8) * Math.PI) * 2, at(C.cork, 3));
  return s.sprite();
}

/** Jardinera de madera con flores y una matita que cuelga. */
function planter(): Sprite {
  const s = scene(1, 1, 22);
  s.shadow(2, 2, 13, 13, 0.25);
  s.box(2.5, 2.5, 0, 11, 11, 7, (u, v) => at(C.dirt, 1 + (noise(u, v, 3) < 0.3 ? 1 : 0)), planks(C.wood, 3.5, 4, 2), planks(C.wood, 3.5, 3, 4));
  s.solid(2, 2, 7, 12, 12, 1, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  for (let i = 0; i < 90; i++) {
    const x = 4 + noise(i, 1, 7) * 8;
    const y = 4 + noise(i, 2, 7) * 8;
    const z = 8 + noise(i, 3, 7) * 5;
    s.plot(x, y, z, at(C.leaf, z > 11 ? 4 : 2 + (i % 2)));
    if (noise(i, 4, 7) < 0.4) {
      const col = FLOWERS[i % FLOWERS.length]!;
      s.plot(x, y, z + 0.8, col);
      s.plot(x + 0.5, y, z + 0.8, col);
      s.plot(x, y + 0.5, z + 1.2, col);
    }
  }
  for (let k = 0; k < 6; k += 0.5) s.plot(6, 14, 7 - k, at(C.leaf, 3));
  return s.sprite();
}

// ---------- Registro ----------

/** La parte de arriba de la glorieta tiene versión de noche (la guirnalda encendida): va en outdoor.ts. */
export { gazeboRoof };

export const YARD_DRAW: Record<string, (v: "front" | "back") => Sprite> = {
  greenhouse,
  "tool-shed": toolShed,
  gazebo,
  pergola,
  "garden-gate": gardenGate,
  "fence-post": fencePost,
  well,
  beehive,
  compost,
  barrel,
  crates,
  wheelbarrow,
  woodpile,
  "fire-pit": firePit,
  "log-seat": logSeat,
  "picnic-table": picnicTable,
  "picnic-bench": picnicBench,
  "patio-table": patioTable,
  "patio-chair": patioChair,
  "garden-lantern": gardenLantern,
  "dock-lamp": dockLamp,
  signpost,
  rowboat,
  planter,
};

