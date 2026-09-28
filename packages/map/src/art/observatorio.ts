// Los muebles del observatorio (arte propio, hecho a mano en código). Afuera: la fogata de malvaviscos,
// los banderines, el cohete de madera en su plataforma, los postes con cables y el letrero. Adentro: el
// orrery (el pedestal y el aro; los brazos con los planetas los anima el cliente con `orreryArms`), el
// telescopio de latón, la escalera de caracol, las vitrinas de piedras y de fósiles, el radar de señales,
// el escritorio del diario y el globo celeste. Coordenadas locales de arte (tile = 16), mirando hacia +x.
import { Escena, type Tinte } from "./exterior-escena";
import type { Variant } from "./kit";
import { C } from "./palette";
import { alpha, at, bayer, noise, type Ramp, type RGBA, type Sprite } from "./pixel";
import { WARM_STONE } from "./observatorio-exterior";
import { glyphOn } from "./room";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const T = (c: RGBA): Tinte => () => c;
/** Tablas: juntas cada `pitch` a lo largo de u. */
const planks =
  (r: Ramp, base = 3, pitch = 4, seed = 1): Tinte =>
  (u) =>
    u % pitch < 0.6 ? at(r, base - 2) : at(r, base + (noise(Math.floor(u / pitch), 0, seed) < 0.4 ? -1 : 0));

/** Palo recto entre dos puntos, salpicado como cajitas de sección `t`. */
function stick(s: Escena, a: [number, number, number], b: [number, number, number], t: number, c: (k: number) => RGBA) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let k = 0; k <= len; k += 0.3) {
    const f = k / len;
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    const z = a[2] + (b[2] - a[2]) * f;
    for (let dx = -t / 2; dx <= t / 2; dx += 0.4) for (let dy = -t / 2; dy <= t / 2; dy += 0.4) s.plot(x + dx, y + dy, z, c(f));
  }
}

/** Esfera chica (planetas, el sol, la lente): se salpica la mitad que mira a la cámara. */
function ball(s: Escena, cx: number, cy: number, cz: number, r: number, color: (luz: number, nx: number, ny: number, nz: number) => RGBA) {
  for (let el = -Math.PI / 2; el <= Math.PI / 2; el += 0.4 / Math.max(1, r))
    for (let az = -Math.PI; az <= Math.PI; az += 0.4 / Math.max(1, r * Math.cos(el) + 0.5)) {
      const nx = Math.cos(el) * Math.cos(az);
      const ny = Math.cos(el) * Math.sin(az);
      const nz = Math.sin(el);
      if (nx + ny + nz < -0.3) continue;
      s.plot(cx + nx * r, cy + ny * r, cz + nz * r, color(ny * 0.6 - nx * 0.3 + nz * 0.55, nx, ny, nz));
    }
}

const shade = (r: Ramp, luz: number, base = 3) => at(r, base + (luz > 0.45 ? 1 : luz < -0.2 ? -1 : 0));

// ---------- Afuera ----------

/** Fogata con anillo de piedras, leños y llama (el cliente anima encima), la bolsa de malvaviscos y los palitos. */
function marshmallowFire(): Sprite {
  const s = scene(2, 2, 40);
  const cx = 16;
  const cy = 16;
  s.disc(cx, cy, 0.2, 13, (dx, dy) => alpha(at(C.dirt, 1), Math.hypot(dx, dy) > 12 ? 0.5 : 0.9));
  for (let a = 0; a < Math.PI * 2; a += 0.45) {
    const x = cx + Math.cos(a) * 10;
    const y = cy + Math.sin(a) * 10;
    const r = 2.3 + noise(Math.floor(a * 10), 1, 91) * 0.9;
    s.box(x - r, y - r, 0, r * 2, r * 2, 3 + noise(Math.floor(a * 10), 2, 91) * 1.8, T(at(WARM_STONE, 4)), T(at(WARM_STONE, 3)), T(at(WARM_STONE, 2)));
  }
  s.disc(cx, cy, 0.5, 8, (dx, dy) => {
    const n = noise(Math.floor(dx * 2), Math.floor(dy * 2), 92);
    return n < 0.25 ? at(C.fire, 2) : n < 0.4 ? at(C.fire, 1) : at(C.woodDark, 0);
  });
  // Leños cruzados (en cabaña).
  for (const [a, z] of [
    [0.3, 1.5],
    [1.9, 3.5],
    [0.3 + Math.PI, 1.5],
    [1.9 + Math.PI, 3.5],
  ] as const) {
    const x0 = cx + Math.cos(a) * 7;
    const y0 = cy + Math.sin(a) * 7;
    stick(s, [x0, y0, z], [cx + Math.cos(a) * 1.5, cy + Math.sin(a) * 1.5, z + 1.5], 2.2, (k) => at(C.logs, k > 0.8 ? 1 : 3));
  }
  // Llama quieta (para el dibujo del nivel; en el juego el cliente pone la animada encima).
  const q = s.p(cx, cy, 3);
  const flame = (rx: number, h: number, col: RGBA) => {
    for (let y = 0; y < h; y++) {
      const w = rx * Math.sin((1 - y / h) * Math.PI * 0.55 + 0.05);
      for (let x = -w; x <= w; x++) s.canvas.set(Math.round(q.x + x + Math.sin(y * 0.7) * (y / h) * 1.5), Math.round(q.y - y), col);
    }
  };
  flame(6, 15, at(C.fire, 1));
  flame(4.5, 12, at(C.fire, 2));
  flame(3, 9, at(C.fire, 3));
  flame(1.5, 5, at(C.fire, 4));
  // La bolsa de malvaviscos (papel con franja rosada) y dos palitos apoyados en una piedra.
  s.box(25, 26, 0, 5, 4, 6, (u, v) => (Math.hypot(u - 2.5, v - 2) < 1.4 ? at(C.white, 4) : at(C.cream, 4)), (u, v) => (v > 2 && v < 3.6 ? at(C.rose, 3) : at(C.cream, 4)), (u, v) => (v > 2 && v < 3.6 ? at(C.rose, 2) : at(C.cream, 3)));
  s.box(24.5, 27, 5.5, 3, 2, 1.8, T(at(C.white, 4)), T(at(C.white, 3)), T(at(C.white, 2)));
  for (const dy of [0, 2.5]) stick(s, [3 + dy, 27, 0.5], [9 + dy, 30, 7], 0.8, () => at(C.wood, 4));
  return s.sprite();
}

/** Palo de madera clavado (banderines, postes). */
function post(s: Escena, x: number, y: number, h: number, r = 1.3) {
  s.cylinder(x, y, 0, r, h, (a, v, luz) => at(C.logs, (luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2) - (Math.floor(v / 5) % 3 === 0 && noise(Math.floor(a * 3), Math.floor(v), 93) < 0.3 ? 1 : 0)));
  s.disc(x, y, h, r, () => at(C.cork, 4));
}

/** Banderines: dos palos y un cordel que cuelga con triángulos de tela de colores cálidos. */
function bunting(): Sprite {
  const s = scene(1, 4, 40);
  const x = 8;
  const y0 = 8;
  const y1 = 56;
  const top = 30;
  post(s, x, y0, top + 2);
  post(s, x, y1, top + 2);
  const sag = (y: number) => top - 7 * Math.sin((Math.PI * (y - y0)) / (y1 - y0));
  for (let y = y0; y <= y1; y += 0.3) s.plot(x, y, sag(y), at(C.cream, 2));
  const COLORS: Ramp[] = [C.rug, C.mustard, C.sage, C.blue, C.cream, C.rose];
  let i = 0;
  for (let y = y0 + 4; y < y1 - 4; y += 5.2, i++) {
    const col = COLORS[i % COLORS.length]!;
    s.quad([x, y, sag(y + 2)], [0, 1, 0], [0, 0, -1], 4.2, 5.5, (u, v) => (Math.abs(u - 2.1) < 2.1 * (1 - v / 5.5) ? at(col, v < 1 ? 4 : 3) : null));
  }
  return s.sprite();
}

/** El cohete de madera pintado en su plataforma de tablas, con la torre de lanzamiento y un farolito. */
function toyRocket(): Sprite {
  const s = scene(2, 2, 60);
  s.shadow(2, 2, 28, 28, 0.25);
  // Plataforma de tablas sobre patas.
  for (const [x, y] of [
    [3, 3],
    [26, 3],
    [3, 26],
    [26, 26],
  ] as const)
    s.solid(x, y, 0, 3, 3, 4, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(2, 2, 4, 28, 28, 2, planks(C.wood, 4, 4, 94), planks(C.wood, 2, 4, 95), planks(C.wood, 1, 4, 96));
  // Torre de lanzamiento: dos palos con travesaños.
  for (const y of [6, 12]) s.solid(6, y, 6, 2, 2, 42, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  for (let z = 12; z < 48; z += 8) s.solid(6, 6, z, 2, 8, 1.5, at(C.logs, 5), at(C.logs, 3), at(C.logs, 2));
  s.solid(7, 8, 30, 8, 2, 1.5, at(C.logs, 5), at(C.logs, 3), at(C.logs, 2));
  // El cohete.
  const cx = 19;
  const cy = 17;
  const r = 5;
  s.cylinder(cx, cy, 8, r, 26, (a, v, luz) => {
    const k = luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2;
    const u = (a - Math.PI / 4) * r;
    if (Math.hypot(u, v - 17) < 2.4) return Math.hypot(u, v - 17) < 1.6 ? at(C.sky, 3) : at(C.gold, 4);
    if (v < 3 || (v > 9 && v < 11.5)) return at(C.rug, k);
    return at(C.cream, k + (Math.floor(a * 10) % 4 === 0 ? -1 : 0));
  });
  s.cone(cx, cy, 34, r, 11, (_a, sl, luz) => at(C.rug, (luz > 0.4 ? 4 : luz > -0.1 ? 3 : 2) - (sl > 9 ? 1 : 0)));
  // Aletas.
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4]) {
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    s.quad([cx + nx * r, cy + ny * r, 6], [nx, ny, 0], [0, 0, 1], 4, 9, (u, v) => (v < 9 - u * 1.4 ? at(C.rug, 3) : null));
  }
  // Farolito en la esquina.
  s.solid(3, 26, 6, 1, 1, 7, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.solid(1.8, 24.8, 13, 3.4, 3.4, 3.6, at(C.metal, 2), at(C.gold, 4), at(C.gold, 3));
  return s.sprite();
}

/** Poste de madera con travesaño y aisladores; con `cable`, los dos cables que bajan y suben al siguiente. */
function cablePole(cable: boolean): () => Sprite {
  return () => {
    const s = cable ? scene(1, 5, 52) : scene(1, 1, 52);
    const h = 46;
    s.roundShadow(8, 8, 3, 0.25);
    post(s, 8, 8, h, 1.6);
    s.solid(7, 1, h - 5, 2, 14, 2, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
    for (const y of [2.5, 13.5]) s.solid(7.3, y - 0.7, h - 3, 1.4, 1.4, 2.2, at(C.cream, 5), at(C.cream, 4), at(C.cream, 3));
    if (cable)
      for (const y of [2.5, 13.5])
        for (let t = 0; t <= 64; t += 0.35) s.plot(8, y + t, h - 1 - 6 * Math.sin((Math.PI * t) / 64), at(C.woodDark, 1));
    return s.sprite();
  };
}

/** Letrero de tabla en su palo: la estrella y la luna pintadas sobre azul noche. */
function observatorySign(): Sprite {
  const s = scene(1, 1, 34);
  post(s, 8, 8, 24, 1.1);
  const face: Tinte = (u, v) => {
    if (u < 0.8 || u > 13.2 || v < 0.8 || v > 9.2) return at(C.wood, 2);
    const star = Math.hypot(u - 4.5, v - 5) < 1.4 + Math.cos(Math.atan2(v - 5, u - 4.5) * 5) * 0.8;
    if (star) return at(C.gold, 5);
    if (Math.hypot(u - 9.5, v - 5.2) < 2.5 && Math.hypot(u - 10.5, v - 5.8) > 2) return at(C.cream, 5);
    return at(C.navy, 3);
  };
  // La tabla va de canto a lo largo de y: la cara pintada mira a +x (y la de atrás, igual).
  s.box(6, 1, 16, 2, 14, 10, planks(C.wood, 4, 5, 97), T(at(C.wood, 2)), face);
  return s.sprite();
}

/** Lo que dice el cartel grande de la entrada. */
const BOARD_TEXT = "OBSERVATORIO";

/**
 * El cartel grande de la entrada: una tabla larga de azul noche con marco de madera en dos palos, las
 * letras claras ("OBSERVATORIO", de 3x5) entre dos estrellitas de latón y un farolito colgado arriba.
 */
function observatoryBoard(): Sprite {
  const s = scene(1, 4, 48);
  s.shadow(5, 2, 6, 60, 0.22);
  post(s, 8, 6, 30, 1.4);
  post(s, 8, 58, 30, 1.4);
  const len = 60;
  const tw = BOARD_TEXT.length * 4 - 1;
  const margin = (len - tw) / 2;
  const face: Tinte = (u, v) => {
    if (u < 1.2 || u > len - 1.2 || v < 1.2 || v > 12.8) return at(C.wood, v > 12.8 ? 4 : 2);
    // u crece hacia atrás en pantalla: el texto se lee con u al revés.
    const tx = len - u - margin;
    const gy = Math.floor(9.6 - v);
    if (gy >= 0 && gy < 5 && tx >= 0 && tx < tw) {
      const k = Math.floor(tx / 4);
      const gx = Math.floor(tx) % 4;
      if (gx < 3 && glyphOn(BOARD_TEXT[k]!, gx, gy)) return at(C.cream, 5);
    }
    // Estrellitas a los costados del texto.
    for (const sx of [-3.2, tw + 2.2]) {
      const dx = tx - sx;
      const dy = v - 7;
      if (Math.abs(dx) + Math.abs(dy) < 1.6 || (Math.abs(dx) < 0.5 && Math.abs(dy) < 2.3) || (Math.abs(dy) < 0.5 && Math.abs(dx) < 2.3)) return at(C.gold, 5);
    }
    if (noise(Math.floor(u), Math.floor(v), 98) < 0.02) return at(C.cream, 3);
    return at(C.navy, 2);
  };
  s.box(7, 2, 15, 2, len, 14, planks(C.wood, 4, 5, 97), T(at(C.wood, 2)), face);
  // Techito de tabla encima y el farolito colgado en la mitad.
  s.box(6, 1, 29, 4, len + 2, 1.5, planks(C.woodDark, 4, 6, 99), T(at(C.woodDark, 2)), T(at(C.woodDark, 3)));
  s.solid(7.5, 31.5, 30.5, 1, 1, 3, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  s.box(6.3, 30.3, 33.5, 3.4, 3.4, 4, () => at(C.metal, 2), (_u, v) => at(C.gold, v > 1 ? 5 : 4), (_u, v) => at(C.gold, v > 1 ? 4 : 3));
  s.solid(5.8, 29.8, 37.5, 4.4, 4.4, 1.2, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
  return s.sprite();
}

/** Reloj de sol: pedestal de piedra, la esfera con las horas y la aguja de latón. */
function sundial(): Sprite {
  const s = scene(1, 1, 24);
  s.roundShadow(8, 8, 6, 0.25);
  s.box(2.5, 2.5, 0, 11, 11, 2, () => at(WARM_STONE, 4), () => at(WARM_STONE, 3), () => at(WARM_STONE, 2));
  s.cylinder(8, 8, 2, 3, 9, (_a, v, luz) => shade(WARM_STONE, luz, v > 7 ? 4 : 3));
  s.cylinder(8, 8, 11, 5.8, 1.6, (_a, _v, luz) => shade(WARM_STONE, luz, 4));
  s.disc(8, 8, 12.6, 5.8, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d > 5) return at(C.gold, 4);
    const a = Math.atan2(dy, dx);
    if (d > 3.6 && Math.abs(((a * 12) / Math.PI + 12.5) % 1 - 0.5) > 0.38) return at(C.woodDark, 2);
    return at(WARM_STONE, 5);
  });
  // La aguja: un triángulo de latón parado sobre la esfera, apuntando al norte.
  s.quad([8, 3.2, 12.7], [0, 1, 0], [0, 0, 1], 5, 5, (u, v) => (v < u ? at(C.gold, v > u - 0.8 ? 5 : 3) : null));
  return s.sprite();
}

/** Telescopio chico en su trípode de madera, para mirar estrellas desde el prado (apunta hacia +x). */
function stargazerScope(): Sprite {
  const s = scene(1, 1, 36);
  s.roundShadow(8, 8, 5, 0.22);
  const head: [number, number, number] = [8, 8, 17];
  for (const foot of [
    [2.5, 4, 0],
    [3.5, 13.5, 0],
    [13.5, 8.5, 0],
  ] as [number, number, number][])
    stick(s, foot, head, 1.1, (k) => at(C.wood, k > 0.8 ? 4 : 3));
  s.solid(6.8, 6.8, 16.5, 2.4, 2.4, 2, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  // El tubo de latón con su anillo oscuro, la lente brillante y el ocular atrás.
  stick(s, [3.5, 8, 14.5], [15, 8, 27], 2.6, (k) => (Math.abs(k - 0.62) < 0.05 ? at(C.woodDark, 2) : at(C.gold, k > 0.5 ? 4 : 3)));
  ball(s, 15.3, 8, 27.3, 1.5, (luz) => (luz > 0.5 ? at(C.white, 4) : at(C.blue, 3)));
  stick(s, [2.2, 8, 13], [3.6, 8, 14.6], 1.2, () => at(C.woodDark, 1));
  return s.sprite();
}

// ---------- Adentro ----------

/** Orrery: pedestal de madera tallada, el aro de latón de la eclíptica y el sol en la columna. */
const ORRERY = { cx: 16, cy: 16, ring: 14, z: 18 };
function orreryBase(): Sprite {
  const s = scene(2, 2, 40);
  const { cx, cy } = ORRERY;
  s.roundShadow(cx, cy, 13, 0.3);
  s.cylinder(cx, cy, 0, 9, 3, (_a, _v, luz) => shade(C.woodDark, luz, 3));
  s.disc(cx, cy, 3, 9, (dx, dy) => at(C.woodDark, Math.hypot(dx, dy) > 8 ? 4 : 3));
  s.cylinder(cx, cy, 3, 3.5, 9, (_a, v, luz) => shade(C.wood, luz, v > 7 ? 4 : 3));
  s.cylinder(cx, cy, 12, 7.5, 3, (_a, _v, luz) => shade(C.wood, luz, 3));
  s.disc(cx, cy, 15, 7.5, (dx, dy) => (Math.hypot(dx, dy) > 6.6 ? at(C.gold, 4) : at(C.wood, Math.floor(Math.atan2(dy, dx) * 5) % 2 ? 3 : 4)));
  // Tres patitas de latón que sostienen el aro.
  for (const a of [0.4, 2.5, 4.6]) stick(s, [cx + Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5, 15], [cx + Math.cos(a) * ORRERY.ring, cy + Math.sin(a) * ORRERY.ring, ORRERY.z], 0.8, () => at(C.gold, 3));
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    const x = cx + Math.cos(a) * ORRERY.ring;
    const y = cy + Math.sin(a) * ORRERY.ring;
    s.plot(x, y, ORRERY.z, at(C.gold, Math.sin(a) > 0 ? 4 : 3));
    s.plot(x, y, ORRERY.z - 0.5, at(C.gold, 2));
  }
  // La columna y el sol.
  stick(s, [cx, cy, 15], [cx, cy, 27], 1.2, () => at(C.gold, 3));
  ball(s, cx, cy, 29, 3.2, (luz) => at(C.fire, luz > 0.4 ? 4 : luz > -0.1 ? 3 : 2));
  return s.sprite();
}

/** Los planetas del orrery: radio del brazo, alto, tamaño, color, vueltas por vuelta del más lento. */
const PLANETS: { r: number; z: number; size: number; color: Ramp; speed: number; ring?: boolean }[] = [
  { r: 5, z: 25, size: 1.2, color: C.stone, speed: 4.2 },
  { r: 8, z: 23.5, size: 1.8, color: C.sage, speed: 2.4 },
  { r: 11, z: 22, size: 1.6, color: C.rug, speed: 1.5 },
  { r: 13.5, z: 20.5, size: 2.4, color: C.mustard, speed: 1, ring: true },
];

/**
 * Los brazos con los planetas en el momento `t` (0 a 1 = una vuelta del más lento). Mismo lienzo y origen
 * que el orrery, así el cliente lo pone encima como capa.
 */
export function orreryArms(t: number): Sprite {
  const s = scene(2, 2, 40);
  const { cx, cy } = ORRERY;
  PLANETS.forEach((p, i) => {
    const a = (t * p.speed + i * 0.27) * Math.PI * 2;
    const x = cx + Math.cos(a) * p.r;
    const y = cy + Math.sin(a) * p.r;
    stick(s, [cx, cy, 26 - i * 0.6], [x, y, p.z + 0.5], 0.5, () => at(C.gold, 4));
    stick(s, [x, y, p.z + 0.5], [x, y, p.z + p.size], 0.4, () => at(C.gold, 3));
    ball(s, x, y, p.z + p.size + 0.6, p.size, (luz) => shade(p.color, luz, 3));
    if (p.ring) for (let k = 0; k < Math.PI * 2; k += 0.1) s.plot(x + Math.cos(k) * p.size * 1.8, y + Math.sin(k) * p.size * 1.8, p.z + p.size + 0.6 + Math.cos(k) * 0.6, at(C.gold, 5));
  });
  return s.sprite();
}
export const ORRERY_FRAMES = 48;

/** Telescopio de latón en su trípode de madera, apuntando arriba hacia la cúpula. */
function brassTelescope(): Sprite {
  const s = scene(2, 2, 60);
  s.roundShadow(16, 16, 12, 0.3);
  const head: [number, number, number] = [16, 16, 24];
  for (const a of [0.6, 2.7, 4.6]) stick(s, [16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 0], head, 1.4, (k) => at(C.wood, k > 0.9 ? 4 : 3));
  s.solid(14.5, 14.5, 22, 3, 3, 3, at(C.gold, 4), at(C.gold, 3), at(C.gold, 2));
  // El tubo: de la ocular (abajo, hacia la sala) a la boca (arriba, hacia el fondo).
  const p0: [number, number, number] = [23, 21, 20];
  const p1: [number, number, number] = [5, 7, 48];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const ax = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len, (p1[2] - p0[2]) / len];
  for (let k = 0; k < len; k += 0.35) {
    const f = k / len;
    const r = 2 + f * 2;
    for (let q = 0; q < Math.PI * 2; q += 0.3 / r) {
      // Dos vectores perpendiculares al eje (aproximados).
      const e1 = [ax[1]!, -ax[0]!, 0];
      const n1 = Math.hypot(e1[0]!, e1[1]!);
      const e1n = [e1[0]! / n1, e1[1]! / n1, 0];
      const e2 = [ax[1]! * e1n[2]! - ax[2]! * e1n[1]!, ax[2]! * e1n[0]! - ax[0]! * e1n[2]!, ax[0]! * e1n[1]! - ax[1]! * e1n[0]!];
      const nx = Math.cos(q) * e1n[0]! + Math.sin(q) * e2[0]!;
      const ny = Math.cos(q) * e1n[1]! + Math.sin(q) * e2[1]!;
      const nz = Math.cos(q) * e1n[2]! + Math.sin(q) * e2[2]!;
      const luz = ny * 0.6 - nx * 0.35 + nz * 0.5;
      const band = Math.abs(f - 0.35) < 0.02 || Math.abs(f - 0.75) < 0.02 || f > 0.97;
      s.plot(p0[0] + ax[0]! * k + nx * r, p0[1] + ax[1]! * k + ny * r, p0[2] + ax[2]! * k + nz * r, band ? at(C.woodDark, 3) : shade(C.gold, luz, f < 0.1 ? 2 : 3));
    }
  }
  // La ocular.
  stick(s, p0, [25, 22.5, 17.5], 1.4, () => at(C.woodDark, 2));
  return s.sprite();
}

/** Escalera de caracol de madera alrededor de un poste, que sube hasta la cúpula (queda fuera de cuadro). */
function spiralStairs(): Sprite {
  const s = scene(2, 2, 72);
  const cx = 16;
  const cy = 16;
  s.roundShadow(cx, cy, 13, 0.25);
  s.cylinder(cx, cy, 0, 2.2, 64, (_a, v, luz) => shade(C.woodDark, luz, Math.floor(v / 10) % 2 ? 3 : 4));
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 3.2 + 0.8;
    const z = 3 + i * 3.7;
    for (let a = a0; a < a0 + 0.5; a += 0.03)
      for (let r = 2.2; r < 13; r += 0.4) {
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        s.plot(x, y, z, at(C.wood, r > 12.3 ? 5 : Math.floor(r / 3) % 2 ? 3 : 4));
        if (a > a0 + 0.44) s.plot(x, y, z - 1, at(C.wood, 1));
      }
    // Balaustre en la punta de cada escalón y el pasamanos.
    const px = cx + Math.cos(a0 + 0.25) * 12.4;
    const py = cy + Math.sin(a0 + 0.25) * 12.4;
    for (let v = 0; v < 12; v += 0.4) s.plot(px, py, z + v, at(C.woodDark, 3));
  }
  for (let k = 0; k < steps * 0.5; k += 0.01) {
    const a = (k / steps) * Math.PI * 3.2 * 2 + 1.05;
    s.plot(cx + Math.cos(a) * 12.4, cy + Math.sin(a) * 12.4, 3 + (k * 2) * 3.7 + 12, at(C.wood, 4));
  }
  return s.sprite();
}

/** Vitrina: mueble de madera con puertitas y la caja de vidrio con lo que hay adentro. */
function displayCase(contents: (s: Escena) => void): () => Sprite {
  return () => {
    const s = scene(1, 2, 34);
    s.shadow(1, 1, 14, 30, 0.28);
    s.box(1, 1, 0, 14, 30, 13, planks(C.wood, 4, 5, 99), (u, v) => {
      if (u % 15 < 0.8 || v < 1 || v > 12) return at(C.woodDark, 2);
      if (Math.abs(u % 15 - 12) < 0.8 && Math.abs(v - 7) < 0.8) return at(C.gold, 4);
      return at(C.wood, 3);
    }, (_u, v) => (v < 1 || v > 12 ? at(C.woodDark, 1) : at(C.wood, 2)));
    contents(s);
    // El vidrio (translúcido) y sus cantos de madera.
    const glass = (u: number, v: number) => (bayer(Math.floor(u), Math.floor(v)) < 0.08 || Math.abs(u - v - 4) < 0.5 ? alpha(at(C.white, 4), 0.6) : alpha(at(C.sky, 3), 0.18));
    s.box(2, 2, 13, 12, 28, 12, glass, glass, glass);
    for (const [x, y] of [
      [2, 2],
      [13, 2],
      [2, 29],
      [13, 29],
    ] as const)
      s.solid(x, y, 13, 1, 1, 12, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    s.box(1.5, 1.5, 25, 13, 29, 1.5, T(at(C.wood, 4)), T(at(C.wood, 3)), T(at(C.wood, 2)));
    return s.sprite();
  };
}

/** Piedras: una geoda de amatista abierta, un meteorito oscuro, un cristal y un canto rodado, en cojines. */
function rockContents(s: Escena) {
  s.box(3, 4, 13, 10, 24, 1, T(at(C.rug, 3)), T(at(C.rug, 2)), T(at(C.rug, 1)));
  ball(s, 8, 8, 16, 2.6, (luz, nx) => (nx > 0.3 ? at(C.violet, luz > 0 ? 5 : 4) : shade(WARM_STONE, luz, 2)));
  ball(s, 8, 15.5, 15.8, 2.4, (luz) => shade(C.metal, luz, 1));
  for (let z = 14; z < 21; z += 0.4) s.plot(8, 22, z, at(C.cyan, z > 19 ? 5 : 4));
  for (let z = 14; z < 18; z += 0.4) s.plot(9.2, 22.8, z, at(C.cyan, 3));
  ball(s, 8, 27, 15.6, 2, (luz) => shade(C.cork, luz, 3));
}

/** "Fósiles de planetas": un caracol en espiral, un planeta de piedra con su anillo y un trozo de luna. */
function fossilContents(s: Escena) {
  s.box(3, 4, 13, 10, 24, 1, T(at(C.navy, 3)), T(at(C.navy, 2)), T(at(C.navy, 1)));
  for (let a = 0; a < Math.PI * 5; a += 0.08) {
    const r = 0.4 + a * 0.18;
    s.plot(8 + Math.cos(a) * r * 0.3, 8 + Math.sin(a) * r, 16 + Math.cos(a) * r * 0.9, at(C.cream, 3 + (Math.floor(a * 3) % 2)));
  }
  ball(s, 8, 17, 16.5, 2.4, (luz) => shade(WARM_STONE, luz, 3));
  for (let k = 0; k < Math.PI * 2; k += 0.08) s.plot(8 + Math.cos(k) * 4, 17 + Math.sin(k) * 4, 16.5 + Math.cos(k + 0.7) * 1, at(C.gold, 4));
  ball(s, 8, 25, 15.6, 2.1, (luz, nx, ny) => (Math.hypot(nx - 0.2, ny - 0.4) < 0.35 ? at(C.stone, 2) : shade(C.cream, luz, 3)));
}

/** Radar de señales: el escritorio con la pantalla redonda, perillas, audífonos y la antena de plato. */
function signalRadar(): Sprite {
  const s = scene(1, 2, 44);
  s.shadow(1, 1, 14, 30, 0.28);
  for (const [x, y] of [
    [2, 2],
    [12, 2],
    [2, 28],
    [12, 28],
  ] as const)
    s.solid(x, y, 0, 2, 2, 12, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(1, 1, 12, 14, 30, 2, planks(C.wood, 4, 5, 100), T(at(C.wood, 2)), T(at(C.wood, 3)));
  // La caja del aparato: madera con el frente de latón y la pantalla verde redonda.
  s.box(3, 4, 14, 8, 16, 10, T(at(C.wood, 4)), T(at(C.wood, 2)), (u, v) => {
    const d = Math.hypot(u - 6, v - 5.5);
    if (d < 3.6) {
      if (d > 3) return at(C.gold, 3);
      const sweep = Math.atan2(v - 5.5, u - 6);
      if (Math.abs(sweep - 0.8) < 0.25 && d < 2.9) return at(C.cyan, 5);
      return at(C.screen, d < 1.2 ? 3 : 2);
    }
    if (Math.hypot(u - 12.5, v - 7) < 1 || Math.hypot(u - 12.5, v - 3.5) < 1) return at(C.woodDark, 1);
    return at(C.gold, 3 + (u < 0.7 || v < 0.7 ? -1 : 0));
  });
  // Audífonos sobre la mesa.
  for (let a = 0; a < Math.PI; a += 0.06) s.plot(8, 25 + Math.cos(a) * 3.5, 15 + Math.sin(a) * 3.5, at(C.woodDark, 2));
  ball(s, 8, 21.5, 15, 1.3, (luz) => shade(C.rug, luz, 2));
  ball(s, 8, 28.5, 15, 1.3, (luz) => shade(C.rug, luz, 2));
  // Antena de plato arriba del aparato, mirando a la sala.
  stick(s, [7, 12, 24], [7, 12, 31], 0.8, () => at(C.metal, 3));
  for (let r = 0; r < 6; r += 0.3)
    for (let a = 0; a < Math.PI * 2; a += 0.3 / Math.max(1, r)) {
      const depth = r * r * 0.07;
      s.plot(7 + 2 - depth + Math.cos(a) * 0.1, 12 + Math.cos(a) * r, 34 + Math.sin(a) * r, at(C.gold, r > 5.5 ? 5 : 3 + (Math.cos(a) > 0 ? 1 : 0)));
    }
  stick(s, [9, 12, 34], [13, 12, 34], 0.5, () => at(C.metal, 4));
  return s.sprite();
}

/** Escritorio del diario: el libro de bitácora abierto en un atril, tintero con pluma, lámpara y rollos. */
function logDesk(): Sprite {
  const s = scene(1, 2, 44);
  s.shadow(1, 1, 14, 30, 0.28);
  s.box(1, 1, 0, 14, 30, 14, planks(C.wood, 4, 5, 101), (u, v) => {
    if (v < 1 || v > 13) return at(C.woodDark, 2);
    if (Math.abs(v - 7) < 0.6) return at(C.woodDark, 2);
    if (Math.abs(u - 8) < 0.9 && (Math.abs(v - 4) < 0.7 || Math.abs(v - 10) < 0.7)) return at(C.gold, 4);
    return at(C.wood, 3);
  }, (_u, v) => (v < 1 ? at(C.woodDark, 1) : at(C.wood, 2)));
  // Atril inclinado con el libro abierto (páginas crema con renglones y un dibujito del cielo).
  s.quad([4, 9, 14], [0, 1, 0], [0.55, 0, 0.83], 13, 9, (u, v) => {
    if (u < 0.6 || u > 12.4 || v < 0.5) return at(C.curtain, 2);
    if (Math.abs(u - 6.5) < 0.5) return at(C.cream, 2);
    if (u > 7.5 && Math.hypot(u - 10, v - 5) < 1.4) return at(C.navy, 2);
    if (Math.floor(v * 1.4) % 2 === 0 && v > 1.5 && v < 8) return at(C.cream, 3);
    return at(C.cream, 5);
  });
  // Tintero con pluma.
  s.cylinder(12, 5, 14, 1.4, 2.4, (_a, _v, luz) => shade(C.navy, luz, 2));
  stick(s, [12, 5, 16], [11, 3, 23], 0.5, (k) => (k > 0.6 ? at(C.white, 4) : at(C.cream, 3)));
  // Lámpara de aceite de latón.
  s.cylinder(5, 4.5, 14, 2, 2, (_a, _v, luz) => shade(C.gold, luz, 3));
  stick(s, [5, 4.5, 16], [5, 4.5, 20], 0.7, () => at(C.gold, 3));
  ball(s, 5, 4.5, 23, 2.4, (luz) => alpha(at(C.gold, luz > 0 ? 5 : 4), 0.9));
  // Rollos de mapas.
  for (const [y, c] of [
    [24, C.cream],
    [27, C.cork],
  ] as const)
    stick(s, [3, y, 15.2], [12, y + 1, 15.2], 2, () => at(c, 4));
  return s.sprite();
}

/** Globo celeste: esfera azul noche con estrellas doradas, meridiano de latón y pie de madera. */
function celestialGlobe(): Sprite {
  const s = scene(1, 1, 32);
  s.roundShadow(8, 8, 5, 0.3);
  s.cylinder(8, 8, 0, 4, 2, (_a, _v, luz) => shade(C.woodDark, luz, 3));
  stick(s, [8, 8, 2], [8, 8, 12], 1.2, () => at(C.wood, 3));
  ball(s, 8, 8, 18, 5.5, (luz, nx, ny, nz) => {
    if (noise(Math.floor(nx * 12), Math.floor(ny * 12 + nz * 7), 102) < 0.1) return at(C.gold, 5);
    if (Math.abs(nz - nx * 0.4) < 0.05) return at(C.gold, 3);
    return shade(C.navy, luz, 3);
  });
  for (let a = 0; a < Math.PI * 2; a += 0.04) s.plot(8 + Math.cos(a) * 6.4 * 0.7, 8 - Math.cos(a) * 6.4 * 0.7, 18 + Math.sin(a) * 6.4, at(C.gold, 4));
  return s.sprite();
}

/** Dibujos para registrar en DRAW de furniture.ts. */
export const OBSERVATORIO_DRAW: Record<string, (v: Variant) => Sprite> = {
  "marshmallow-fire": marshmallowFire,
  bunting,
  "toy-rocket": toyRocket,
  "cable-pole": cablePole(true),
  "cable-pole-end": cablePole(false),
  "observatory-sign": observatorySign,
  "observatory-board": observatoryBoard,
  sundial,
  "stargazer-scope": stargazerScope,
  orrery: orreryBase,
  "brass-telescope": brassTelescope,
  "spiral-stairs": spiralStairs,
  "rock-case": displayCase(rockContents),
  "fossil-case": displayCase(fossilContents),
  "signal-radar": signalRadar,
  "log-desk": logDesk,
  "celestial-globe": celestialGlobe,
};
