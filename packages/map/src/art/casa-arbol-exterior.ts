// La casa del árbol del jardín por fuera (4x4 tiles = 64x64 unidades de arte), en el huerto de frutales.
// Un roble viejo de tronco grueso con la copa enorme (se ve desde lejos), una plataforma de tablas con
// baranda sobre riostras, y encima la cabañita de tablas verticales con techo de tejas rojizas, la puerta,
// la ventanita (con luz de noche) y el ojo de buey del hastial. El tronco la atraviesa y sale por el techo.
// De las ramas cuelgan dos faroles y, a la derecha, la polea con el balde. La escalera de cuerda va aparte
// (`treehouse-ladder`): el cliente la cambia por la escalera recogida y el cartel "OCUPADO" cuando la
// cierran desde adentro. Se registra en outdoor.ts (tiene versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { LEAF_DEEP, blend, canopy } from "./exterior-naturaleza";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, at, bayer, noise, smoothNoise, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

// ---------- Medidas (unidades de arte, desde la esquina del mueble) ----------

/** El tronco: centro, radio al pie y arriba, y hasta dónde sube (se pierde en la copa). */
const TRUNK = { x: 24, y: 24, r0: 12, r1: 7.5, top: 150 };
/** La plataforma de tablas. */
const DECK = { x0: 7, x1: 59, y0: 7, y1: 59, z: 60, t: 4 };
/** La cabañita, corrida hacia atrás: adelante queda un corredor con la baranda. */
const HUT = { x0: 15, x1: 51, y0: 13, y1: 47, h: 30 };
const HUT_Z = DECK.z;
const ROOF = { rise: 17, over: 5 };
/** El hueco de la escalera en el borde de adelante de la plataforma (a lo largo de x). */
export const LADDER_HOLE = { x0: 20, x1: 31 };
/** La luz de la ventanita del frente (para el catálogo): centro del vidrio. */
export const TREEHOUSE_WINDOW = { x: 43, y: HUT.y1, z: HUT_Z + 16 };

const LEAF_TREE = blend(C.leaf, C.green, 0.3);

// ---------- Texturas ----------

/** Tablas verticales de la cabañita: junta oscura, canto con luz, vetas y algún nudo. */
function boards(u: number, v: number, seed: number, luz: number): RGBA {
  const w = 5;
  const b = Math.floor(u / w);
  const k = u - b * w;
  const tone = noise(b, 1, seed) < 0.3 ? -1 : noise(b, 2, seed) > 0.82 ? 1 : 0;
  const base = 3 + luz + tone;
  if (k < 0.8) return at(C.woodDark, 2 + luz);
  if (k < 1.6) return at(C.wood, base + 1);
  if (noise(Math.floor(u), Math.floor(v / 2), seed + 3) < 0.012) return at(C.woodDark, 3);
  if (noise(b * 7 + Math.floor(k), Math.floor(v / 3), seed + 5) < 0.08) return at(C.wood, base - 1);
  // Un toque de uso: la madera más oscura abajo, donde salpica la lluvia.
  if (v < 5 && bayer(Math.floor(u), Math.floor(v)) < (5 - v) / 10) return at(C.wood, base - 1);
  return at(C.wood, base);
}

/** Corteza del roble: surcos verticales que ondulan, tono por franja y manchas de musgo. */
function bark(ang: number, v: number, luz: number, r: number): RGBA {
  const u = ang * r;
  const groove = Math.abs(((u + smoothNoise(u, v, 9, 3) * 5) % 4) - 2) < 0.55;
  const t = (luz > 0.35 ? 3 : luz > -0.3 ? 2 : 1) - (groove ? 1 : 0) + (noise(Math.floor(u / 4), Math.floor(v / 6), 5) > 0.8 ? 1 : 0);
  const moss = smoothNoise(u, v, 7, 9);
  if (moss > 0.76 && luz < 0.4 && v < 45) return at(C.sage, moss > 0.82 ? 2 : 1 + (luz > 0 ? 1 : 0));
  return at(C.logs, t);
}

/** Tejas rojizas en hileras, con alguna distinta y musgo en manchones. */
function tejas(u: number, t: number, luz: number): RGBA {
  const row = Math.floor(t / 4);
  const off = row % 2 ? 3 : 0;
  const k = t - row * 4;
  const b = 3 + luz;
  let c: RGBA;
  if (k < 0.9) c = at(C.roof, b - 2);
  else if ((u + off) % 6 < 0.8) c = at(C.roof, b - 1);
  else c = at(C.roof, k > 3 ? b + 1 : b + (noise(Math.floor((u + off) / 6), row, 7) < 0.15 ? -1 : 0));
  const moss = smoothNoise(u, t, 10, 13);
  if (moss > 0.74 && k >= 1 && noise(Math.floor((u + off) / 6), row, 17) < (moss - 0.74) * 5) c = mix(c, at(C.sage, k > 3 ? 3 : 2), 0.55);
  return c;
}

/** Ventana de marco oscuro con cruz: de día refleja el cielo, de noche la luz cálida de adentro. */
function windowAt(u: number, v: number, u0: number, u1: number, v0: number, v1: number, night: boolean): RGBA | null {
  if (u < u0 - 1 || u >= u1 + 1 || v < v0 - 1.5 || v >= v1 + 1.5) return null;
  // Alféizar y dintel.
  if (v < v0) return at(C.woodDark, v < v0 - 0.8 ? 2 : 4);
  if (v >= v1) return at(C.woodDark, v >= v1 + 0.8 ? 4 : 2);
  if (u < u0 || u >= u1) return at(C.woodDark, 1);
  const mu = (u0 + u1) / 2;
  const mv = (v0 + v1) / 2;
  if (Math.abs(u - mu) < 0.6 || Math.abs(v - mv) < 0.6) return at(C.woodDark, 3);
  const t = (v - v0) / (v1 - v0);
  if (night) {
    // Cortinita a los lados y la luz, más fuerte arriba.
    if (Math.min(u - u0, u1 - u) < 1.6) return mix(at(C.curtain, 3), at(C.gold, 4), 0.4);
    return at(C.gold, t > 0.6 ? 5 : 4);
  }
  if (Math.min(u - u0, u1 - u) < 1.4) return at(C.curtain, 3);
  const d = u - u0 - (v1 - v) * 0.8;
  if (Math.abs(d - 3) < 0.6) return at(C.sky, 4);
  return at(C.sky, t > 0.55 ? 3 : 2);
}

// ---------- Piezas ----------

/** Rama: cilindro que se afina de `r0` a `r1` entre dos puntos (cajitas pegadas, con la luz de arriba). */
function limb(s: Escena, a: [number, number, number], b: [number, number, number], r0: number, r1: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let k = 0; k <= len; k += 0.6) {
    const t = k / len;
    const r = r0 + (r1 - r0) * t;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    const n = noise(Math.floor(k), 3, 21) < 0.2 ? -1 : 0;
    s.solid(x - r, y - r, z - r, r * 2, r * 2, r * 2, at(C.logs, 3 + n), at(C.logs, 2 + n), at(C.logs, 1 + n));
  }
}

/** Farol de fierro con vidrios dorados, colgado de un cordel. */
function hangingLantern(s: Escena, x: number, y: number, zTop: number, zLamp: number, night: boolean) {
  s.borde = false;
  for (let z = zLamp + 6; z < zTop; z += 0.4) s.plot(x, y, z, at(C.metal, 1));
  s.borde = true;
  const glass = (u: number, v: number) => (u < 0.8 || u > 3.2 || v < 0.6 ? at(C.metal, 1) : at(C.gold, night ? 5 : v > 2.5 ? 4 : 3));
  s.box(x - 2, y - 2, zLamp, 4, 4, 4.5, () => at(C.metal, 2), glass, (u, v) => (u < 0.8 || u > 3.2 || v < 0.6 ? at(C.metal, 0) : at(C.gold, night ? 4 : 3)));
  s.solid(x - 2.6, y - 2.6, zLamp + 4.5, 5.2, 5.2, 1.2, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
  s.solid(x - 0.6, y - 0.6, zLamp + 5.7, 1.2, 1.2, 1.2, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
}

/** Cuerda entre dos puntos (sin contorno: es fina). */
function rope(s: Escena, a: [number, number, number], b: [number, number, number], sag = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  s.borde = false;
  for (let k = 0; k <= len; k += 0.35) {
    const t = k / len;
    const z = a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag;
    s.plot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z, at(C.cork, Math.floor(k * 1.5) % 3 === 0 ? 1 : 3));
  }
  s.borde = true;
}

/** Baranda de palos: postes cada `step`, pasamanos y un travesaño bajo (salta el tramo [skip0, skip1)). */
function railing(s: Escena, from: [number, number], to: [number, number], z: number, skip?: [number, number]) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dx = (to[0] - from[0]) / len;
  const dy = (to[1] - from[1]) / len;
  const cut = (k: number) => skip && k > skip[0] && k < skip[1];
  for (let k = 0; k <= len + 0.01; k += 0.4) {
    if (cut(k)) continue;
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    s.plot(x, y, z + 9, at(C.wood, 4));
    s.plot(x, y, z + 9.6, at(C.wood, 5));
    s.plot(x, y, z + 4, at(C.wood, 2));
  }
  const posts = [0, ...(skip ? [skip[0], skip[1]] : []), len];
  for (let k = 8; k < len - 4; k += 8) if (!cut(k) && !posts.some((p) => Math.abs(p - k) < 4)) posts.push(k);
  for (const k of posts) {
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    s.solid(x - 1, y - 1, z, 2, 2, 10.5, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  }
}

// ---------- Paredes ----------

/** Frente (+y): la puerta de tablas con su ventanita redonda, la ventana y un farolito junto a la puerta. */
function front(night: boolean): Tinte {
  const DOOR = { u0: 5, u1: 15, top: 21 };
  return (u, v) => {
    if (v >= HUT.h) return null;
    // Solera y viga de arriba.
    if (v < 1.6) return at(C.woodDark, v < 0.8 ? 1 : 3);
    if (v >= HUT.h - 1.8) return at(C.woodDark, v >= HUT.h - 0.8 ? 4 : 2);
    // Puerta con arco: tablas, bisagras, tirador y el ojo redondo (con luz de noche).
    const mid = (DOOR.u0 + DOOR.u1) / 2;
    const top = DOOR.top + Math.sqrt(Math.max(0, 1 - ((u - mid) / ((DOOR.u1 - DOOR.u0) / 2)) ** 2)) * 3;
    if (u >= DOOR.u0 - 1 && u < DOOR.u1 + 1 && v < top + 1) {
      if (u < DOOR.u0 || u >= DOOR.u1 || v >= top) return at(C.woodDark, 1);
      if (Math.hypot(u - mid, v - 15) < 2.2) return Math.hypot(u - mid, v - 15) > 1.5 ? at(C.woodDark, 2) : night ? at(C.gold, 5) : at(C.sky, 3);
      if ((Math.abs(v - 5) < 0.7 || Math.abs(v - 18) < 0.7) && u < DOOR.u0 + 4) return at(C.metal, 1);
      if (Math.abs(u - (DOOR.u1 - 2)) < 0.8 && Math.abs(v - 10) < 0.9) return at(C.gold, 4);
      const k = (u - DOOR.u0) % 3.3;
      return at(C.woodDark, k < 0.6 ? 2 : 4 + (Math.floor((u - DOOR.u0) / 3.3) % 2 ? 0 : 1));
    }
    const w = windowAt(u, v, 22, 32, 10, 20, night);
    if (w) return w;
    return boards(u, v, 3, 0);
  };
}

/** Costado este (+x), en sombra: la ventana con su jardinera. */
function side(night: boolean): Tinte {
  return (u, v) => {
    if (v >= HUT.h) return null;
    if (v < 1.6) return at(C.woodDark, v < 0.8 ? 0 : 2);
    if (v >= HUT.h - 1.8) return at(C.woodDark, v >= HUT.h - 0.8 ? 3 : 1);
    const w = windowAt(u, v, 12, 22, 11, 21, night);
    if (w) return night ? w : mix(w, at(C.night, 1), 0.15);
    return boards(u + 2, v, 5, -1);
  };
}

/** El hastial del costado este (triángulo bajo el techo): tejuelas en escama y el ojo de buey. */
function gable(night: boolean): Tinte {
  const half = (HUT.y1 - HUT.y0) / 2;
  return (u, v) => {
    const h = ROOF.rise * (1 - Math.abs(u - half) / half);
    if (v >= h) return null;
    const r = Math.hypot(u - half, v - ROOF.rise * 0.42);
    if (r < 4.2) {
      if (r > 3.1) return at(C.woodDark, 2);
      if (Math.abs(u - half) < 0.5 || Math.abs(v - ROOF.rise * 0.42) < 0.5) return at(C.woodDark, 3);
      return night ? at(C.gold, 5) : at(C.sky, 2);
    }
    const row = Math.floor(v / 3);
    const off = row % 2 ? 2 : 0;
    const cu = ((u + off) % 4) - 2;
    const kv = v - row * 3;
    if (kv < 1.4 - Math.abs(cu) * 0.4 || Math.abs(cu) > 1.7) return at(C.wood, 0);
    return at(C.wood, kv > 2.2 ? 3 : 2);
  };
}

// ---------- El dibujo ----------

export function drawTreeHouse(night: boolean): Sprite {
  const s = new Escena({ x0: -40, y0: -40, z0: -2, x1: 110, y1: 110, z1: 200 }, 2);
  s.roundShadow(36, 36, 42, 0.28);

  // La copa de atrás (en 2D, debajo de todo lo demás): la masa grande que se ve desde lejos.
  const crown = s.p(TRUNK.x + 4, TRUNK.y + 4, 140);
  canopy(s.canvas, { cx: crown.x, cy: crown.y, rx: 74, ry: 52, ramp: LEAF_DEEP, seed: 611, size: [7, 11], clumps: 150, base: 2.4 });
  canopy(s.canvas, { cx: crown.x - 40, cy: crown.y + 22, rx: 32, ry: 24, ramp: LEAF_DEEP, seed: 612, size: [5, 8] });
  canopy(s.canvas, { cx: crown.x + 42, cy: crown.y + 20, rx: 32, ry: 24, ramp: LEAF_DEEP, seed: 613, size: [5, 8] });

  // El tronco: se afina hacia arriba, con raíces que se abren en el pasto y hiedra trepando.
  for (let z = 0; z < TRUNK.top; z += 6) {
    const t = Math.min(1, z / 110);
    const r = TRUNK.r0 + (TRUNK.r1 - TRUNK.r0) * Math.sqrt(t) + (z < 8 ? (8 - z) * 0.5 : 0);
    s.cylinder(TRUNK.x, TRUNK.y, z, r, 6.2, (ang, v, luz) => bark(ang, z + v, luz, r));
  }
  for (const a of [0.2, 0.9, 1.7, 2.5, -0.5]) {
    const len = TRUNK.r0 + 5 + noise(Math.floor(a * 10), 1, 23) * 5;
    for (let k = TRUNK.r0 - 1; k < len; k += 0.5) {
      const hh = Math.max(0.6, 4 * (1 - (k - TRUNK.r0) / (len - TRUNK.r0)));
      for (let z = 0; z < hh; z += 0.5) s.plot(TRUNK.x + Math.cos(a) * k, TRUNK.y + Math.sin(a) * k, z, at(C.logs, z > hh - 0.7 ? 3 : 2));
    }
  }
  for (let z = 2; z < 52; z += 0.5) {
    const a = 1.1 + Math.sin(z * 0.18) * 0.35;
    s.plot(TRUNK.x + Math.cos(a) * (TRUNK.r0 - z * 0.05 + 0.4), TRUNK.y + Math.sin(a) * (TRUNK.r0 - z * 0.05 + 0.4), z, at(C.leaf, 2 + (Math.floor(z) % 3 === 0 ? 2 : 0)));
    if (noise(Math.floor(z), 1, 29) < 0.3) s.plot(TRUNK.x + Math.cos(a + 0.12) * (TRUNK.r0 - z * 0.05 + 0.6), TRUNK.y + Math.sin(a + 0.12) * (TRUNK.r0 - z * 0.05 + 0.6), z, at(C.leaf, 4));
  }

  // Riostras del tronco a la plataforma y dos postes en las esquinas de adelante.
  limb(s, [TRUNK.x + 7, TRUNK.y + 7, 30], [DECK.x1 - 6, DECK.y1 - 6, DECK.z - 3], 1.8, 1.4);
  limb(s, [TRUNK.x - 2, TRUNK.y + 9, 32], [DECK.x0 + 3, DECK.y1 - 4, DECK.z - 3], 1.8, 1.4);
  limb(s, [TRUNK.x + 9, TRUNK.y - 2, 32], [DECK.x1 - 4, DECK.y0 + 3, DECK.z - 3], 1.8, 1.4);
  for (const [x, y] of [
    [DECK.x0 + 1, DECK.y1 - 3],
    [DECK.x1 - 3, DECK.y1 - 3],
    [DECK.x1 - 3, DECK.y0 + 1],
  ] as const) {
    s.solid(x - 0.5, y - 0.5, 0, 3, 3, 1.5, at(C.stone, 4), at(C.stone, 3), at(C.stone, 2));
    s.box(x, y, 1.5, 2, 2, DECK.z - DECK.t - 1.5, () => at(C.wood, 4), (_u, v) => at(C.wood, noise(0, Math.floor(v / 5), 41) < 0.2 ? 2 : 3), () => at(C.wood, 2));
  }

  // La plataforma: tablas a lo largo de x, el canto y el hueco de la escalera en el borde de adelante.
  const zTop = DECK.z;
  s.box(
    DECK.x0,
    DECK.y0,
    zTop - DECK.t,
    DECK.x1 - DECK.x0,
    DECK.y1 - DECK.y0,
    DECK.t,
    (u, v) => {
      const x = DECK.x0 + u;
      const y = DECK.y0 + v;
      if (x >= LADDER_HOLE.x0 && x < LADDER_HOLE.x1 && y > DECK.y1 - 8) return y > DECK.y1 - 7.2 && x > LADDER_HOLE.x0 + 0.8 && x < LADDER_HOLE.x1 - 0.8 ? at(C.night, 1) : at(C.woodDark, 2);
      const row = Math.floor(v / 4);
      const off = noise(row, 1, 43) * 20;
      if (v % 4 < 0.7 || (u + off) % 20 < 0.6) return at(C.wood, 2);
      return at(C.wood, 4 + (noise(Math.floor((u + off) / 20), row, 45) < 0.3 ? -1 : 0));
    },
    (u, v) => (v > DECK.t - 1 ? at(C.wood, 4) : at(C.woodDark, u % 10 < 0.7 ? 1 : 3)),
    (u, v) => (v > DECK.t - 1 ? at(C.wood, 3) : at(C.woodDark, u % 10 < 0.7 ? 0 : 2)),
  );

  // La cabañita.
  s.quad([HUT.x0, HUT.y1, zTop], [1, 0, 0], [0, 0, 1], HUT.x1 - HUT.x0, HUT.h, front(night));
  s.quad([HUT.x1, HUT.y0, zTop], [0, 1, 0], [0, 0, 1], HUT.y1 - HUT.y0, HUT.h, side(night));
  s.quad([HUT.x1, HUT.y0, zTop + HUT.h], [0, 1, 0], [0, 0, 1], HUT.y1 - HUT.y0, ROOF.rise, gable(night));
  // Esquineros.
  s.solid(HUT.x1 - 1, HUT.y1 - 1, zTop, 2.2, 2.2, HUT.h, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Jardinera bajo la ventana del costado: una caja que sobresale en +x.
  s.box(HUT.x1, HUT.y0 + 11, zTop + 7, 3.5, 12, 3.5, () => at(C.dirt, 1), (_u, v) => at(C.wood, v > 2.8 ? 4 : 2), (u) => at(C.wood, u % 4 < 0.6 ? 1 : 3));
  for (let i = 0; i < 40; i++) {
    const y = HUT.y0 + 11.5 + noise(i, 1, 51) * 11;
    const x = HUT.x1 + 0.5 + noise(i, 2, 51) * 2.5;
    const h = 1.5 + noise(i, 3, 51) * 3;
    for (let k = 0; k < h; k += 0.5) s.plot(x, y, zTop + 10.5 + k, at(C.leaf, k > h - 1 ? 4 : 2));
    if (noise(i, 4, 51) < 0.4) s.plot(x, y, zTop + 11 + h, [at(C.rug, 4), at(C.gold, 5), at(C.rose, 5)][i % 3]!);
    if (noise(i, 5, 51) < 0.25) for (let k = 0; k < 4; k += 0.5) s.plot(HUT.x1 + 3.8, y, zTop + 9 - k, at(C.leaf, 3));
  }

  // Techo a dos aguas (la cumbrera a lo largo de x) con su alero.
  {
    const x0 = HUT.x0 - ROOF.over;
    const x1 = HUT.x1 + ROOF.over;
    const y0 = HUT.y0 - ROOF.over;
    const y1 = HUT.y1 + ROOF.over;
    const mid = (HUT.y0 + HUT.y1) / 2;
    const half = mid - y0;
    const slope = (ROOF.rise + (ROOF.over * ROOF.rise) / ((HUT.y1 - HUT.y0) / 2)) / half;
    const zEave = zTop + HUT.h - ROOF.over * (ROOF.rise / ((HUT.y1 - HUT.y0) / 2));
    const ridge = zEave + slope * half;
    const k = Math.hypot(1, slope);
    s.quad([x0, mid, ridge], [1, 0, 0], [0, -1, -slope], x1 - x0, half, (u, v) => tejas(u, v * k, -1));
    s.quad([x0, mid, ridge], [1, 0, 0], [0, 1, -slope], x1 - x0, half, (u, v) => tejas(u, v * k, 1));
    s.quad([x0, y1, zEave - 2], [1, 0, 0], [0, 0, 1], x1 - x0, 2, (u) => at(C.woodDark, u % 8 < 0.7 ? 1 : 3));
    s.quad([x1, mid, ridge - 2], [0, 1, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 2));
    s.quad([x1, mid, ridge - 2], [0, -1, -slope], [0, 0, 1], half, 2.2, () => at(C.woodDark, 2));
    for (let x = x0 - 0.5; x < x1 + 0.5; x += 0.4) s.plot(x, mid, ridge + 1, at(C.roof, 5));
  }

  // Baranda del corredor (con el hueco de la escalera) y de los costados.
  railing(s, [DECK.x0 + 1, DECK.y1 - 1], [DECK.x1 - 1, DECK.y1 - 1], zTop, [LADDER_HOLE.x0 - DECK.x0 - 1, LADDER_HOLE.x1 - DECK.x0 - 1]);
  railing(s, [DECK.x1 - 1, DECK.y0 + 1], [DECK.x1 - 1, DECK.y1 - 1], zTop);
  railing(s, [DECK.x0 + 1, DECK.y0 + 1], [DECK.x0 + 1, DECK.y1 - 1], zTop);

  // Las ramas: una a cada lado y dos hacia atrás, que se meten en la copa.
  const right: [number, number, number] = [74, 38, 104];
  const left: [number, number, number] = [16, 76, 108];
  limb(s, [TRUNK.x + 3, TRUNK.y + 2, 112], right, 4, 2);
  limb(s, [TRUNK.x + 1, TRUNK.y + 4, 116], left, 4, 2);
  limb(s, [TRUNK.x, TRUNK.y, 124], [TRUNK.x + 40, TRUNK.y - 22, 140], 3.5, 2);
  limb(s, [TRUNK.x, TRUNK.y, 126], [TRUNK.x - 24, TRUNK.y + 30, 146], 3.5, 2);

  // La polea en la punta de la rama derecha y el balde colgando; la cuerda baja a la baranda.
  const pulley = { x: right[0] - 3, y: right[1], z: right[2] - 5 };
  s.solid(pulley.x - 0.6, pulley.y - 0.6, pulley.z, 1.2, 1.2, 4, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.borde = false;
  for (let a = 0; a < Math.PI * 2; a += 0.15) s.plot(pulley.x + Math.cos(a) * 2.4, pulley.y, pulley.z + Math.sin(a) * 2.4, at(C.woodDark, a < Math.PI ? 4 : 2));
  s.borde = true;
  s.disc(pulley.x, pulley.y, pulley.z, 0.9, () => at(C.metal, 4));
  const bucket = { x: pulley.x + 2.4, y: pulley.y, z: 34 };
  rope(s, [pulley.x + 2.4, pulley.y, pulley.z], [bucket.x, bucket.y, bucket.z + 9]);
  rope(s, [pulley.x - 2.4, pulley.y, pulley.z], [DECK.x1 - 1, pulley.y - 4, zTop + 9.6], 1.5);
  s.cylinder(bucket.x, bucket.y, bucket.z, 3.6, 6, (_a, v, luz) => (Math.abs(v - 1.2) < 0.6 || Math.abs(v - 4.8) < 0.6 ? at(C.metal, luz > 0 ? 3 : 1) : at(C.wood, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(bucket.x, bucket.y, bucket.z + 6, 3.6, (dx, dy) => (Math.hypot(dx, dy) > 2.8 ? at(C.wood, 4) : at(C.woodDark, 1)));
  s.borde = false;
  for (let a = 0; a <= Math.PI; a += 0.12) s.plot(bucket.x, bucket.y + Math.cos(a) * 3.4, bucket.z + 6 + Math.sin(a) * 3, at(C.metal, 2));
  s.borde = true;

  // Faroles colgados: de la rama izquierda y de la de atrás a la derecha.
  hangingLantern(s, left[0] + 2, left[1] - 4, left[2] - 2, left[2] - 20, night);
  hangingLantern(s, TRUNK.x + 34, TRUNK.y - 18, 136, 112, night);

  // Hojas de adelante (encima de todo, en 2D): la copa tapa el tronco de arriba y cae sobre las puntas de
  // las ramas, sin tapar el techo.
  const fg = new PixelCanvas(s.canvas.width, s.canvas.height);
  const high = s.p(TRUNK.x + 2, TRUNK.y + 2, 162);
  canopy(fg, { cx: high.x, cy: high.y, rx: 56, ry: 30, ramp: LEAF_TREE, seed: 620, size: [6, 10], clumps: 80, base: 2.9 });
  for (const [p, rx, ry, seed] of [
    [s.p(left[0], left[1], left[2] + 8), 24, 15, 621],
    [s.p(right[0] - 2, right[1], right[2] + 9), 24, 15, 622],
    [s.p(TRUNK.x + 30, TRUNK.y - 20, 150), 26, 16, 623],
    [s.p(TRUNK.x - 22, TRUNK.y + 28, 154), 26, 16, 624],
  ] as const) canopy(fg, { cx: p.x, cy: p.y, rx, ry, ramp: LEAF_TREE, seed, size: [4, 7], base: 3 });
  fg.outline(OUT);
  s.encima(fg);
  return s.sprite();
}

// ---------- La escalera de cuerda ----------

/**
 * La escalera de cuerda, que va en el tile de adelante al medio de la casa del árbol (1, 3): cuelga del
 * hueco de la plataforma hasta el pasto del tile de más adelante (el portal). Recogida (`rolled`), queda
 * enrollada en el borde de la plataforma y cuelga el cartel "OCUPADO". Las dos versiones tienen el mismo
 * lienzo y origen: el cliente cambia una por otra sin mover nada.
 */
export function drawTreeLadder(rolled: boolean): Sprite {
  const s = new Escena({ x0: -8, y0: -6, z0: -2, x1: 36, y1: 30, z1: 76 }, 2);
  // Coordenadas locales: el mueble está en (16, 48) de la casa del árbol.
  const top = { y: DECK.y1 - 48 + 0.5, z: DECK.z - 0.5 };
  const x0 = LADDER_HOLE.x0 - 16 + 1.5;
  const x1 = LADDER_HOLE.x1 - 16 - 1.5;
  if (!rolled) {
    // Dos cuerdas con peldaños de palo cada 6, un poco inclinada hacia adelante al llegar al pasto.
    const foot = { y: top.y + 9, z: 0 };
    const yAt = (z: number) => foot.y + (top.y - foot.y) * (z / top.z) ** 0.8;
    for (const x of [x0, x1]) {
      s.borde = false;
      for (let z = 0; z < top.z; z += 0.35) s.plot(x, yAt(z), z, at(C.cork, Math.floor(z * 1.4) % 3 === 0 ? 1 : 3));
      s.borde = true;
    }
    for (let z = 3; z < top.z - 2; z += 6) s.box(x0 - 0.5, yAt(z) - 0.8, z, x1 - x0 + 1, 1.6, 1.4, () => at(C.wood, 5), () => at(C.wood, 3), () => at(C.wood, 2));
    // Nudos donde se amarra al hueco.
    for (const x of [x0, x1]) s.solid(x - 0.9, top.y - 0.9, top.z - 1.6, 1.8, 1.8, 1.8, at(C.cork, 4), at(C.cork, 2), at(C.cork, 1));
    return s.sprite();
  }
  // Recogida: el rollo de cuerda y palos sobre el borde de la plataforma, amarrado con una cuerda.
  const cy = top.y - 3;
  const cz = top.z + 2.6;
  for (let x = x0 - 1; x <= x1 + 1; x += 0.35)
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const r = 2.6;
      const band = Math.abs(x - (x0 + x1) / 2) < 0.6;
      const rung = Math.floor((a * 3) / Math.PI) % 2 === 0 && Math.floor(x) % 4 === 0;
      const luz = Math.sin(a) * 0.6 + Math.cos(a) * 0.4;
      s.plot(x, cy + Math.cos(a) * r, cz + Math.sin(a) * r, band ? at(C.curtain, 2) : rung ? at(C.wood, 4) : at(C.cork, luz > 0.2 ? 4 : luz > -0.3 ? 3 : 1));
    }
  for (const x of [x0 - 1, x1 + 1]) s.disc(x, cy, cz, 2.4, () => at(C.cork, 2));
  // El cartel "OCUPADO": una tabla colgada de dos cordeles bajo el hueco, de frente a la cámara.
  const hook = s.p((x0 + x1) / 2, top.y + 0.6, top.z - DECK.t - 0.5);
  const text = "OCUPADO";
  const tw = text.length * 4 - 1;
  const bw = tw + 6;
  const bh = 11;
  const bx = Math.round(hook.x - bw / 2);
  const by = Math.round(hook.y + 6);
  for (let k = 0; k < 7; k++) {
    s.canvas.set(bx + 4, by - 6 + k, at(C.cork, 2));
    s.canvas.set(bx + bw - 5, by - 6 + k, at(C.cork, 2));
  }
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const edge = x === 0 || y === 0 || x === bw - 1 || y === bh - 1;
      const plank = y === Math.floor(bh / 2);
      let c = edge ? OUT : at(C.wood, plank ? 2 : y < 2 ? 5 : 4);
      if (!edge && noise(x, y, 71) < 0.06) c = at(C.wood, 3);
      const gx = x - 3;
      const gy = y - 3;
      const li = Math.floor(gx / 4);
      if (gx >= 0 && gy >= 0 && gy < 5 && li < text.length && gx % 4 < 3 && glyphOn(text[li]!, gx % 4, gy)) c = at(C.curtain, 1);
      s.canvas.set(bx + x, by + y, c);
    }
  // Clavitos en las esquinas del cartel.
  s.canvas.set(bx + 4, by + 1, at(C.metal, 4));
  s.canvas.set(bx + bw - 5, by + 1, at(C.metal, 4));
  return s.sprite();
}
