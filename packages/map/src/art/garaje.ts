// Lo de adentro del garaje: el taller (banco de trabajo, estantes, llantas, la caja de herramientas, el
// compresor, el tambor, cajas, latas, la escoba, el carro tapado y el reflector) y la oficina descuidada (el
// escritorio con el computador viejo, la silla rota, el archivador abollado, la planta seca, el
// ventilador y el tapete). Casi todo se arma con la Escena (z-buffer): hay muchas cosas encimadas.
// Coordenadas locales de arte (tile = 16), mirando hacia +x. Nada está limpio ni ordenado, a propósito.
import { Escena, type Tinte } from "./exterior-escena";
import { shadowUnder, type Variant } from "./kit";
import { C, OUT, mix } from "./palette";
import { alpha, at, bayer, flat, noise, ramp, renderSprite, smoothNoise, solidBox, type Box, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { RUST, ZINC } from "./garaje-room";

const scene = (w: number, d: number, h: number, pad = 4) => new Escena({ x0: -pad, y0: -pad, z0: -2, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const T = (c: RGBA): Tinte => () => c;

/** Caucho de las llantas. */
export const RUBBER: Ramp = ramp("#121216", "#1c1c22", "#28282f", "#35353e", "#44444e", "#575762");
/** Cartón de las cajas. */
export const CARDBOARD: Ramp = ramp("#4a3220", "#6b4a2e", "#8c663f", "#a9804f", "#c49c66", "#dcbb86");
/** Verde oliva de oficina pública (el escritorio y el archivador de lata). */
const OLIVE: Ramp = ramp("#2a2f27", "#3d4538", "#535d4b", "#6b7661", "#86907a", "#a3ac95");
/** Plástico beige amarillento de computador de los noventa. */
const BEIGE: Ramp = ramp("#5b5140", "#7c6f58", "#9c8e73", "#b8aa8c", "#cfc3a5", "#e3d9bf");
/** Cuerina café de la silla rota. */
const VINYL: Ramp = ramp("#2e1b12", "#4a2c1b", "#673f27", "#835434", "#9c6a44", "#b58558");
/** Espuma amarilla que asoma por las rajas. */
const FOAM: Ramp = ramp("#8a6a22", "#b8923a", "#dcbd5e", "#efdc8c");
/** Cinta gris (la de arreglar todo). */
const TAPE: Ramp = ramp("#5d636e", "#878d98", "#aeb3bb", "#d0d4d9");
/** Lona verde militar descolorida. */
const TARP: Ramp = ramp("#222b1d", "#303d28", "#435237", "#586a48", "#71845d", "#8fa077");
/** Azul petróleo del tambor, desteñido. */
const DRUM: Ramp = ramp("#131c2b", "#1b2a40", "#253a55", "#314d6b", "#42637f", "#5e7d96");
/** Rojo de herramienta (la caja, el compresor, el bidón), ya rayado. */
const TOOLRED: Ramp = ramp("#3b1112", "#611a19", "#8a2620", "#b0372a", "#cc5a42", "#e1856a");

// ---------- Piezas ----------

/** Llanta acostada: el costado con la banda y la tapa con el hueco del rin. */
function tire(s: Escena, cx: number, cy: number, z: number, r = 6.5, h = 4.4, seed = 0) {
  s.cylinder(cx, cy, z, r, h, (a, v, luz) => {
    const tread = Math.floor((a * r) / 1.4 + seed) % 2 === 0 && v > 0.9 && v < h - 0.9;
    const k = luz > 0.35 ? 3 : luz > -0.3 ? 2 : 1;
    return at(RUBBER, k - (tread ? 1 : 0) + (v > h - 0.7 ? 1 : 0));
  });
  s.disc(cx, cy, z + h, r, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < r * 0.42) return at(RUBBER, 0);
    if (d < r * 0.5) return at(RUBBER, 1);
    // Letras gastadas del costado (rayitas claras en un arco).
    if (d > r * 0.7 && d < r * 0.8 && Math.floor((Math.atan2(dy, dx) + seed) * 9) % 5 === 0) return at(RUBBER, 5);
    return at(RUBBER, d > r - 0.9 ? 2 : 3 + (bayer(Math.floor(dx * 2 + 8), Math.floor(dy * 2 + 8)) < 0.1 ? 1 : 0));
  });
}

/**
 * Llanta parada, apoyada: un anillo en el plano x = x0 (se ve de canto desde +x), de radio `r` y ancho
 * `w` hacia -x, con el centro a la altura del radio.
 */
function standingTire(s: Escena, x0: number, cy: number, r = 7, w = 4.4) {
  const ri = r * 0.48;
  for (let t = 0; t < w; t += 0.35)
    for (let a = 0; a < Math.PI * 2; a += 0.045) {
      const y = cy + Math.cos(a) * r;
      const z = r + Math.sin(a) * r;
      const luz = Math.sin(a) * 0.7 + Math.cos(a) * 0.3;
      const tread = Math.floor(a * 9) % 2 === 0 && t > 0.8 && t < w - 0.8;
      s.plot(x0 - t, y, z, at(RUBBER, (luz > 0.3 ? 3 : luz > -0.3 ? 2 : 1) - (tread ? 1 : 0)));
    }
  for (let rr = ri; rr < r; rr += 0.3)
    for (let a = 0; a < Math.PI * 2; a += 0.3 / Math.max(rr, 1)) {
      const k = rr < ri + 1 ? 1 : rr > r - 0.8 ? 2 : 3;
      s.plot(x0, cy + Math.cos(a) * rr, r + Math.sin(a) * rr, at(RUBBER, k));
    }
  // Adentro del hueco, oscuro.
  for (let rr = 0; rr < ri; rr += 0.4) for (let a = 0; a < Math.PI * 2; a += 0.3 / Math.max(rr, 1)) s.plot(x0 - w + 0.5, cy + Math.cos(a) * rr, r + Math.sin(a) * rr, at(RUBBER, 0));
}

/** Lata cilíndrica con su etiqueta, tapa y un chorreado del color de adentro. */
function can(s: Escena, cx: number, cy: number, z: number, r: number, h: number, body: Ramp, paint: Ramp, seed: number) {
  s.cylinder(cx, cy, z, r, h, (a, v, luz) => {
    const k = luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2;
    if (v > h - 1) return at(C.metal, k);
    if (v < 0.8) return at(C.metal, k - 1);
    // Chorreado que baja desde la tapa.
    const drip = Math.abs(a - (0.4 + noise(seed, 1, 3))) * r < 0.8 && v > h - 1 - (2 + noise(seed, 2, 3) * (h - 2));
    if (drip) return at(paint, k - 1);
    if (v > h * 0.3 && v < h * 0.75) return at(body, k);
    return at(C.metal, k - 1);
  });
  s.disc(cx, cy, z + h, r, (dx, dy) => (Math.hypot(dx, dy) > r - 0.7 ? at(C.metal, 4) : Math.hypot(dx - 0.6, dy) < r * 0.5 ? at(paint, 3) : at(C.metal, 3)));
}

/** Caja de cartón con cinta, las solapas y el rótulo garabateado. */
function box(s: Escena, x: number, y: number, z: number, w: number, d: number, h: number, seed: number, open = false) {
  const tone = noise(seed, 0, 9) < 0.5 ? 0 : 1;
  const side = (base: number): Tinte => (u, v) => {
    if (Math.abs(v - h + 0.6) < 0.6 && Math.abs(u - (u > w ? d : w) / 2) < 1.2) return at(TAPE, 2);
    // Rótulo a mano (una raya de plumón).
    if (Math.abs(v - h * 0.55) < 0.45 && u > 2 && u < 7 && seed % 2 === 0) return at(C.night, 2);
    // Mancha de humedad abajo.
    if (v < 2 && smoothNoise(u, v, 3, seed) > 0.55) return at(CARDBOARD, base - 1);
    return at(CARDBOARD, base + tone - (Math.floor(u) % 7 === 0 ? 0.6 : 0));
  };
  s.box(
    x,
    y,
    z,
    w,
    d,
    h,
    (u, v) => {
      if (open && u > 1.2 && u < w - 1.2 && v > 1.2 && v < d - 1.2) return at(CARDBOARD, 0);
      if (!open && Math.abs(v - d / 2) < 0.8) return at(TAPE, 3);
      return at(CARDBOARD, 4 + tone - (u < 0.6 || v < 0.6 ? 1 : 0));
    },
    side(3),
    side(2),
  );
  if (open) {
    // Solapas abiertas, torcidas hacia afuera.
    s.quad([x, y + d, z + h], [1, 0, 0], [0, 0.55, 0.8], w, 4, (u) => at(CARDBOARD, 3 + (u < 0.6 ? -1 : 0)));
    s.quad([x + w, y, z + h], [0, 1, 0], [0.55, 0, 0.8], d, 4, (u) => at(CARDBOARD, 2 + (u < 0.6 ? -1 : 0)));
  }
}

/** Trapo tirado: una mancha de tela con arrugas (en el piso o encima de algo). */
function rag(s: Escena, cx: number, cy: number, z: number, r: number, cloth: Ramp, seed: number) {
  for (let dy = -r; dy <= r; dy += 0.4)
    for (let dx = -r; dx <= r; dx += 0.4) {
      const d = Math.hypot(dx, dy * 1.2) + (smoothNoise(dx + 10, dy + 10, 2, seed) - 0.5) * 2;
      if (d > r) continue;
      const fold = Math.sin(dx * 1.3 + dy * 0.8 + seed) > 0.6;
      s.plot(cx + dx, cy + dy, z + (fold ? 0.9 : 0.3) + (r - d) * 0.15, at(cloth, fold ? 4 : 3 - (smoothNoise(dx, dy, 3, seed + 1) > 0.65 ? 2 : 0)));
    }
}

/** Palo recto entre dos puntos (mangos, cables, patas inclinadas). */
function stick(s: Escena, a: [number, number, number], b: [number, number, number], c: RGBA, t = 0.8) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let k = 0; k <= len; k += 0.3) {
    const f = k / len;
    const x = a[0] + (b[0] - a[0]) * f;
    const y = a[1] + (b[1] - a[1]) * f;
    const z = a[2] + (b[2] - a[2]) * f;
    for (let o = -t / 2; o <= t / 2; o += 0.35) s.plot(x + o * 0.5, y - o * 0.5, z, c);
  }
}

// ---------- Taller ----------

/**
 * Banco de trabajo de tablones, largo a lo largo de y: la morsa en la punta, herramientas tiradas, un
 * tarro de tornillos, un trapo, aserrín, manchas de aceite, y abajo una repisa con cachivaches.
 */
function workbench(): Sprite {
  const s = scene(1, 3, 44);
  s.shadow(0, 0, 16, 48, 0.3);
  const wd = C.woodDark;
  // Patas gruesas y el travesaño de abajo con la repisa.
  for (const [x, y] of [
    [1, 1],
    [11, 1],
    [1, 43],
    [11, 43],
  ] as const)
    s.solid(x, y, 0, 3, 3, 16, at(wd, 4), at(wd, 3), at(wd, 2));
  s.box(1, 2, 4, 13, 44, 1.5, (u, v) => at(C.wood, noise(Math.floor(u / 4), Math.floor(v / 12), 3) < 0.4 ? 2 : 3), T(at(C.wood, 2)), T(at(C.wood, 1)));
  // Abajo: una caja de cartón, un galón de aceite y una lata tirada.
  box(s, 2.5, 4, 5.5, 9, 10, 7, 3, true);
  s.box(4, 20, 5.5, 5, 5, 8, T(at(C.mustard, 4)), T(at(C.mustard, 3)), T(at(C.mustard, 2)));
  s.solid(5.5, 21.5, 13.5, 2, 2, 1.5, at(C.rug, 4), at(C.rug, 3), at(C.rug, 2));
  can(s, 8, 36, 5.5, 2.6, 5, C.blue, C.cream, 4);
  // Tablero: tablones con juntas, marcas de sierra, manchas de aceite y quemadura.
  const top: Tinte = (u, v) => {
    const plank = Math.floor(u / 4);
    if (u % 4 < 0.6) return at(wd, 2);
    const stain = smoothNoise(u, v, 5, 21) > 0.7;
    if (stain) return at(wd, 2 + (bayer(Math.floor(u), Math.floor(v)) < 0.4 ? 0 : 1));
    if (noise(Math.floor(u), Math.floor(v), 23) > 0.97) return at(C.wood, 1);
    return at(C.wood, noise(plank, Math.floor(v / 16), 25) < 0.4 ? 3 : 4);
  };
  s.box(0, 0, 16, 16, 48, 3, top, (u) => at(C.wood, u % 16 < 0.7 ? 1 : 3), (u, v) => at(C.wood, v > 2.2 ? 3 : 2 + (Math.floor(u) % 11 === 0 ? -1 : 0)));
  // Tabla del fondo contra la pared, con clavos y un par de herramientas colgadas.
  s.box(0, 0, 19, 1.5, 48, 14, T(at(wd, 3)), T(at(wd, 2)), (u, v) => (Math.floor(u) % 12 === 3 && Math.floor(v) === 10 ? at(C.metal, 4) : at(wd, 3 - (Math.floor(u) % 8 === 0 ? 1 : 0))));
  // Morsa en la punta de adelante: base, mandíbulas y la palanca.
  s.solid(8, 38, 19, 6, 6, 2, at(C.fabric, 3), at(C.fabric, 2), at(C.fabric, 1));
  s.solid(9, 39, 21, 4, 2, 5, at(C.fabric, 4), at(C.fabric, 3), at(C.fabric, 2));
  s.solid(9, 42, 21, 4, 2, 5, at(C.fabric, 4), at(C.fabric, 3), at(C.fabric, 2));
  s.solid(9.5, 41, 25.5, 3, 1, 0.8, at(C.metal, 5), at(C.metal, 4), at(C.metal, 3));
  stick(s, [15, 43, 22], [15, 47, 22], at(C.metal, 4), 0.8);
  // Martillo tirado en diagonal y un destornillador.
  stick(s, [4, 8, 19.6], [11, 16, 19.6], at(C.wood, 4), 1.2);
  s.solid(10, 14.5, 19.3, 3, 4, 2, at(C.metal, 4), at(C.metal, 3), at(C.metal, 2));
  stick(s, [5, 28, 19.4], [9, 31, 19.4], at(C.rug, 3), 1.1);
  stick(s, [9, 31, 19.4], [12, 33.2, 19.4], at(C.metal, 4), 0.5);
  // Tarro de café lleno de tornillos y un trapo rojo arrugado.
  can(s, 4.5, 22, 19, 2.4, 4.5, C.rug, C.metal, 7);
  rag(s, 10.5, 25, 19, 3.2, C.rug, 5);
  // Aserrín y virutas.
  for (let i = 0; i < 30; i++) s.plot(2 + noise(i, 1, 27) * 12, 30 + noise(i, 2, 27) * 8, 19.3, at(C.cream, noise(i, 3, 27) < 0.5 ? 3 : 4));
  return s.sprite();
}

/**
 * Estante de ángulo metálico con cuatro repisas: cajas, latas, un galón de aceite, una llanta chica y un
 * rollo de manguera. La repisa de arriba está vencida hacia adelante y hay una telaraña en la esquina.
 */
function metalShelf(): Sprite {
  const s = scene(1, 2, 52);
  s.shadow(0, 0, 14, 32, 0.28);
  const H = 44;
  const post = (x: number, y: number) => s.solid(x, y, 0, 1.4, 1.4, H, at(C.sage, 2), at(C.sage, 1), at(C.sage, 0));
  post(0.5, 0.5);
  post(12, 0.5);
  post(0.5, 30);
  // Repisas: la de arriba (la cuarta) se vence hacia +x.
  const shelves = [2, 14, 26, 38];
  for (const [i, z] of shelves.entries()) {
    if (i === 3) {
      for (let x = 0.5; x < 13.4; x += 0.35)
        for (let y = 0.5; y < 31.4; y += 0.35) s.plot(x, y, z + 1 - (x / 13.4) * 2.2 * Math.sin((y / 31) * Math.PI), at(C.sage, x > 12.8 ? 1 : 3));
    } else s.box(0.5, 0.5, z, 13, 31, 1, (u, v) => at(C.sage, noise(Math.floor(u / 3), Math.floor(v / 3), i) < 0.12 ? 1 : 3), T(at(C.sage, 2)), T(at(C.sage, 1)));
  }
  // Abajo: una llanta de bicicleta vieja acostada y un bidón.
  tire(s, 6.5, 8, 3, 5, 2.4, 2);
  s.box(3, 18, 3, 7, 9, 9, (u, v) => (inRectLocal(u, v, 2, 3, 4, 5) ? at(C.metal, 2) : at(TOOLRED, 4)), (u, v) => at(TOOLRED, v > 7.5 ? 4 : 3 - (smoothNoise(u, v, 3, 5) > 0.7 ? 2 : 0)), T(at(TOOLRED, 2)));
  // Segunda: cajas.
  box(s, 1.5, 1.5, 15, 10, 13, 9, 1);
  box(s, 2, 16, 15, 9, 13, 8, 2, true);
  // Tercera: latas de pintura y un galón de aceite.
  can(s, 4, 4, 27, 3, 6, C.blue, C.cream, 1);
  can(s, 9, 7, 27, 2.6, 5, C.cream, C.rug, 2);
  can(s, 4.5, 12, 27, 3, 6, C.rose, C.rose, 3);
  s.box(3, 18, 27, 7, 6, 9, T(at(C.gold, 4)), (u, v) => (v > 3 && v < 6 && u > 1 && u < 6 ? at(C.night, 2) : at(C.gold, 3)), T(at(C.gold, 2)));
  s.solid(4, 19.5, 36, 2, 2, 1.5, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  // Rollo de manguera verde.
  for (let a = 0; a < Math.PI * 2 * 3; a += 0.08) {
    const r = 4 - a * 0.08;
    s.plot(7 + Math.cos(a) * 1.2, 27 + Math.cos(a / 3) * r, 30 + Math.sin(a / 3) * r * 0.9, at(C.leaf, 2 + (Math.floor(a * 2) % 2)));
  }
  // Arriba (la vencida): una caja torcida y tarros.
  box(s, 2, 3, 38.5, 9, 11, 7, 4);
  can(s, 6, 22, 38.5, 2.4, 4, C.leaf, C.leaf, 5);
  can(s, 7.5, 27.5, 38, 2, 3.5, C.mustard, C.mustard, 6);
  // Telaraña entre el poste de adelante y la repisa de arriba.
  s.borde = false;
  for (let a = 0; a < 1.4; a += 0.02)
    for (const rr of [2, 3.5, 5]) s.plot(13.2, 31.2 - Math.cos(a) * rr, H - Math.sin(a) * rr, alpha(at(C.white, 4), 0.6));
  for (const k of [0.2, 0.7, 1.2]) for (let rr = 0; rr < 5.5; rr += 0.3) s.plot(13.2, 31.2 - Math.cos(k) * rr, H - Math.sin(k) * rr, alpha(at(C.white, 4), 0.6));
  s.borde = true;
  return s.sprite();
}

const inRectLocal = (u: number, v: number, u0: number, v0: number, u1: number, v1: number) => u >= u0 && u < u1 && v >= v0 && v < v1;

/** Pila de llantas viejas, torcida, con una apoyada al lado. */
function tireStack(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8, 8, 7.5, 0.32);
  tire(s, 7.5, 7.5, 0, 6.5, 4.4, 0);
  tire(s, 8.3, 7, 4.4, 6.4, 4.4, 3);
  tire(s, 7.2, 8.2, 8.8, 6.3, 4.2, 5);
  tire(s, 8, 7.6, 13, 6.2, 4.2, 1);
  return s.sprite();
}

/** Caja de herramientas roja con ruedas: cajones (uno medio abierto), el cofre de arriba y los rayones. */
function toolChest(): Sprite {
  const s = scene(1, 1, 34);
  s.shadow(1, 1, 14, 14, 0.3);
  for (const [x, y] of [
    [2, 2],
    [11, 2],
    [2, 11],
    [11, 11],
  ] as const)
    s.solid(x, y, 0, 2, 2, 2, at(RUBBER, 3), at(RUBBER, 2), at(RUBBER, 1));
  const drawers: Tinte = (u, v) => {
    // Cara +x: cajones horizontales con manija; rayones claros y la pintura saltada.
    if (smoothNoise(u, v, 3, 31) > 0.78) return at(C.metal, 3);
    if (Math.floor(v) % 4 === 0) return at(TOOLRED, 1);
    if (Math.floor(v) % 4 === 2 && u > 4 && u < 9) return at(C.metal, 4);
    if (noise(Math.floor(u * 2), Math.floor(v * 2), 33) > 0.97) return at(TOOLRED, 5);
    return at(TOOLRED, 2);
  };
  s.box(1.5, 1.5, 2, 12, 12, 17, T(at(TOOLRED, 4)), (u, v) => at(TOOLRED, smoothNoise(u, v, 3, 35) > 0.8 ? 1 : 3), drawers);
  // Un cajón abierto, con llaves adentro.
  s.box(13.5, 3, 11.5, 3, 9, 3, (u, v) => (Math.floor(v) % 2 === 0 && u > 0.6 ? at(C.metal, 4) : at(C.night, 1)), T(at(TOOLRED, 3)), T(at(TOOLRED, 2)));
  // Cofre de arriba con la tapa entreabierta y un trapo colgando.
  s.box(2, 2, 19, 11, 11, 6, T(at(TOOLRED, 4)), T(at(TOOLRED, 3)), (u, v) => (v > 3 && v < 4 && u > 3 && u < 8 ? at(C.metal, 4) : at(TOOLRED, 2)));
  s.quad([2, 2, 25], [1, 0, 0], [0, 0.8, 0.6], 11, 12, (u, v) => at(TOOLRED, v > 11 ? 5 : 4 - (smoothNoise(u, v, 2, 37) > 0.75 ? 2 : 0)));
  rag(s, 14, 8, 17, 2.2, C.cream, 9);
  for (let z = 10; z < 17; z += 0.4) s.plot(15.3, 8 + Math.sin(z) * 0.5, z, at(C.cream, 3));
  // Calcomanía vieja en el costado.
  s.quad([4, 13.6, 8], [1, 0, 0], [0, 0, 1], 5, 4, (u, v) => (Math.hypot(u - 2.5, v - 2) < 1.8 ? at(C.gold, 4) : null));
  return s.sprite();
}

/** Compresor de aire: tanque rojo con ruedas, el motor arriba, el manómetro y la manguera enrollada. */
function compressor(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8, 8, 6.5, 0.3);
  s.solid(3, 2, 0, 2.5, 2.5, 3, at(RUBBER, 3), at(RUBBER, 2), at(RUBBER, 1));
  s.solid(3, 11, 0, 2.5, 2.5, 3, at(RUBBER, 3), at(RUBBER, 2), at(RUBBER, 1));
  s.cylinder(8, 8, 2, 5.2, 13, (a, v, luz) => {
    const k = luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2;
    if (v < 1 || (v > 11.5 && v < 12.3)) return at(TOOLRED, k - 2);
    if (smoothNoise(a * 5, v, 2.5, 41) > 0.75) return at(RUST, k - 1);
    return at(TOOLRED, k);
  });
  s.disc(8, 8, 15, 5.2, () => at(TOOLRED, 4));
  // Motor con aletas y el protector de la correa.
  s.box(5, 5, 15, 7, 6, 5, T(at(C.night, 3)), (u) => at(C.night, Math.floor(u) % 2 ? 3 : 2), (u) => at(C.night, Math.floor(u) % 2 ? 2 : 1));
  s.solid(12, 4, 15, 2, 8, 4, at(C.metal, 4), at(C.metal, 3), at(C.metal, 2));
  // Manómetro (se mira hacia +x) y la manija.
  s.disc(13.6, 11, 12, 1.6, () => null);
  for (let a = 0; a < Math.PI * 2; a += 0.2)
    for (let r = 0; r < 1.8; r += 0.3) s.plot(13.6, 11 + Math.cos(a) * r, 12 + Math.sin(a) * r, r > 1.4 ? at(C.metal, 3) : Math.abs(Math.cos(a) * r - Math.sin(a) * r * 0.4) < 0.3 && Math.sin(a) > 0 ? at(C.rug, 3) : at(C.cream, 5));
  stick(s, [2, 3, 20], [2, 13, 20], at(C.metal, 4), 1);
  stick(s, [2, 3, 15], [2, 3, 20], at(C.metal, 3), 1);
  stick(s, [2, 13, 15], [2, 13, 20], at(C.metal, 3), 1);
  // Manguera amarilla enrollada en el piso, adelante.
  for (let a = 0; a < Math.PI * 6; a += 0.06) {
    const r = 3.4 - a * 0.05;
    s.plot(12 + Math.cos(a) * r, 13 + Math.sin(a) * r * 0.9, 0.6 + Math.floor(a / (Math.PI * 2)) * 0.7, at(C.mustard, 3 + (Math.floor(a * 3) % 2)));
  }
  return s.sprite();
}

/** Tambor de aceite azul petróleo: óxido, abolladura, chorreados, el embudo arriba y el charco. */
function oilDrum(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8, 8, 7, 0.32);
  // Charco de aceite (plano, oscuro, con brillo).
  s.borde = false;
  for (let dy = -7; dy <= 7; dy += 0.4)
    for (let dx = -7; dx <= 7; dx += 0.4) {
      const d = Math.hypot(dx - 2, dy - 2.5) + (smoothNoise(dx + 20, dy, 2.5, 3) - 0.5) * 3;
      if (d < 5.5) s.plot(8 + dx, 8 + dy, 0.05, noise(Math.floor(dx * 3), Math.floor(dy * 3), 1) > 0.97 ? at(C.violet, 4) : at(RUBBER, 1));
    }
  s.borde = true;
  const R = 6.4;
  const H = 20;
  s.cylinder(8, 8, 0, R, H, (a, v, luz) => {
    const dent = Math.hypot(a * R - 6, v - 9) < 2.5;
    const k = (luz > 0.35 ? 4 : luz > -0.3 ? 3 : 2) - (dent ? 1 : 0);
    if (Math.abs(v - 6.3) < 0.7 || Math.abs(v - 12.7) < 0.7 || v > H - 1) return at(DRUM, k + 1);
    // Chorreado negro desde la boca.
    if (Math.abs(a * R - 2.5) < 0.9 && v > H - 1 - (6 + Math.sin(a * 3) * 2)) return at(RUBBER, 1);
    const rust = smoothNoise(a * R, v, 3, 7) + (v < 4 ? 0.2 : 0);
    if (rust > 0.72) return at(RUST, k - 1);
    return at(DRUM, k);
  });
  s.disc(8, 8, H, R, (dx, dy) => {
    if (Math.hypot(dx + 2, dy + 1.5) < 1.2) return at(C.metal, 4);
    if (Math.hypot(dx, dy) > R - 0.8) return at(DRUM, 4);
    return smoothNoise(dx + 8, dy + 8, 3, 9) > 0.6 ? at(RUST, 3) : at(DRUM, 3);
  });
  // Embudo sucio en la boca.
  s.cylinder(10.5, 9.5, H, 1, 2.4, (_a, _v, luz) => at(C.metal, luz > 0 ? 3 : 2));
  for (let z = 0; z < 3; z += 0.3) s.cylinder(10.5, 9.5, H + 2.4 + z, 1 + z * 0.9, 0.3, (_a, _v, luz) => at(C.metal, luz > 0 ? 4 : 2));
  return s.sprite();
}

/** Cajas de cartón apiladas y torcidas, una abierta con cachivaches y otra desfondada. */
function cardboardBoxes(): Sprite {
  const s = scene(1, 1, 34);
  s.shadow(0.5, 0.5, 15, 15, 0.28);
  box(s, 1, 1, 0, 13, 13, 10, 11);
  box(s, 2.5, 3.5, 10, 10, 9, 8, 12, true);
  // Lo que asoma de la caja abierta: un tubo, un cable y una cosa verde.
  stick(s, [5, 7, 16], [5, 9, 24], at(C.metal, 3), 1.4);
  for (let a = 0; a < 5; a += 0.1) s.plot(9 + Math.cos(a * 2) * 1.5, 8 + a * 0.5, 18 + Math.sin(a * 2) * 1.5, at(RUBBER, 3));
  s.solid(7, 5, 17, 3, 3, 2, at(C.leaf, 3), at(C.leaf, 2), at(C.leaf, 1));
  // Una caja chica tirada al lado, de canto.
  box(s, 11, 11, 0, 5, 5, 4, 13);
  return s.sprite();
}

/** Latas de pintura con chorreados, un bidón rojo de gasolina, la brocha tiesa y la pintura derramada. */
function paintCans(): Sprite {
  const s = scene(1, 1, 26);
  s.shadow(0.5, 0.5, 15, 15, 0.26);
  s.borde = false;
  for (let dy = -3; dy <= 3; dy += 0.35)
    for (let dx = -4; dx <= 4; dx += 0.35)
      if (Math.hypot(dx, dy * 1.3) + (smoothNoise(dx + 5, dy + 5, 1.5, 4) - 0.5) * 2 < 3) s.plot(12 + dx, 12.5 + dy, 0.05, at(C.blue, 3));
  s.borde = true;
  // Bidón de gasolina rojo (de plástico, con la manija y el pico).
  s.box(1, 1, 0, 6, 9, 11, T(at(TOOLRED, 4)), (u, v) => at(TOOLRED, v > 5 && v < 6 ? 2 : 3), (u, v) => at(TOOLRED, u > 3 && u < 6 && v > 3 && v < 8 ? 1 : 2));
  s.box(2.5, 3, 11, 3, 5, 2, T(at(TOOLRED, 5)), T(at(TOOLRED, 4)), T(at(TOOLRED, 3)));
  stick(s, [6, 8, 10], [8, 10, 13], at(C.night, 2), 1);
  can(s, 11, 4, 0, 3.2, 7, C.cream, C.rose, 1);
  can(s, 11.5, 4.5, 7, 2.6, 5, C.mustard, C.mustard, 2);
  can(s, 4, 13, 0, 2.8, 6, C.green, C.green, 3);
  can(s, 12, 11, 0, 2.4, 3.5, C.blue, C.blue, 4);
  // Lata volcada (de lado, con la pintura saliendo).
  for (let t = 0; t < 5; t += 0.3)
    for (let a = 0; a < Math.PI * 2; a += 0.12) s.plot(7 + t, 12 + Math.cos(a) * 2, 2 + Math.sin(a) * 2, at(C.metal, Math.sin(a) > 0.3 ? 4 : 2));
  // Brocha tiesa apoyada en una lata.
  stick(s, [9, 8, 9], [14, 2, 14], at(C.wood, 4), 1.1);
  s.solid(8, 7.5, 7.5, 2, 2, 2, at(C.cream, 4), at(C.cream, 3), at(C.cream, 2));
  return s.sprite();
}

/** Escoba apoyada en el rincón con el recogedor, un balde abollado y trapos sucios. */
function broomCorner(): Sprite {
  const s = scene(1, 1, 44);
  s.shadow(0, 0, 14, 14, 0.25);
  // Balde de lata con agua turbia.
  s.cylinder(9, 9, 0, 4, 7, (a, v, luz) => at(ZINC, (luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2) - (Math.hypot(a * 4 - 3, v - 3) < 1.5 ? 1 : 0)));
  s.disc(9, 9, 7, 4, (dx, dy) => (Math.hypot(dx, dy) > 3.3 ? at(ZINC, 4) : at(C.dirt, 1)));
  // Escoba: palo de madera apoyado en el rincón y las cerdas abiertas, gastadas.
  stick(s, [3, 5, 4], [1, 1, 42], at(C.wood, 4), 1.1);
  for (let i = 0; i < 70; i++) {
    const a = noise(i, 1, 51) * 2 - 1;
    const len = 2 + noise(i, 2, 51) * 3;
    for (let k = 0; k < len; k += 0.4) s.plot(3.4 + a * 2.2 + k * 0.2 * a, 5.2 + a * 1.5, 4 - k, at(C.mustard, noise(i, 3, 51) < 0.4 ? 2 : 3));
  }
  s.solid(2, 3.5, 3.5, 3, 3.5, 1.4, at(C.rug, 3), at(C.rug, 2), at(C.rug, 1));
  // Recogedor en el piso y trapos.
  s.box(4, 10, 0, 5, 5, 0.8, T(at(C.leaf, 3)), T(at(C.leaf, 2)), T(at(C.leaf, 1)));
  s.solid(1, 12, 0, 3, 1, 5, at(C.leaf, 3), at(C.leaf, 2), at(C.leaf, 1));
  rag(s, 12, 4, 0, 3, C.cream, 2);
  rag(s, 13, 12.5, 0, 2.4, C.blue, 3);
  return s.sprite();
}

/**
 * Un carro tapado con una lona verde descolorida (largo a lo largo de y): la lona sigue la forma del
 * carro con pliegues, las cuerdas cruzadas, una rueda y el parachoques oxidado asomando adelante.
 */
function tarpCar(): Sprite {
  const s = scene(2, 3, 40);
  s.shadow(1, 1, 31, 47, 0.34);
  // Rueda que asoma atrás y parachoques adelante (+y).
  for (const y of [9, 37])
    for (let a = 0; a < Math.PI * 2; a += 0.08)
      for (let r = 0; r < 5; r += 0.4) s.plot(29.5, y + Math.cos(a) * r, 5 + Math.sin(a) * r, at(RUBBER, r > 2.2 ? 2 : r > 1 ? 4 : 3));
  s.box(4, 45.5, 3, 24, 1.8, 4, T(at(C.metal, 3)), (u, v) => (smoothNoise(u, v, 2, 5) > 0.6 ? at(RUST, 3) : at(C.metal, 4)), T(at(C.metal, 2)));
  // Forma del carro: un cuerpo redondeado y la cabina, alto en cada punto.
  const body = (x: number, y: number) => {
    const ex = Math.min(x - 2, 30 - x);
    const ey = Math.min(y - 2, 45 - y);
    if (ex < 0 || ey < 0) return -1;
    const round = Math.min(1, ex / 3) * Math.min(1, ey / 4);
    let h = 5 + 9 * Math.sqrt(round);
    // Cabina: más alta al medio, con el parabrisas inclinado.
    const cy = y - 12;
    if (cy > 0 && cy < 22 && ex > 2) {
      const k = Math.min(1, cy / 6, (22 - cy) / 7) * Math.min(1, (ex - 2) / 3);
      h += 8 * Math.max(0, k);
    }
    return h;
  };
  const drape = (x: number, y: number) => smoothNoise(x, y, 3.5, 17) - 0.5 + Math.sin(y * 0.7 + x * 0.3) * 0.2;
  const tarp = (x: number, y: number, z: number, luz: number) => {
    const f = drape(x, y);
    const k = 3 + luz + (f > 0.25 ? 1 : f < -0.25 ? -1 : 0);
    // Manchas de agua y tierra en la lona.
    if (smoothNoise(x, y, 6, 21) > 0.72) return at(TARP, k - 1);
    if (noise(Math.floor(x), Math.floor(y), 23) > 0.985) return at(C.cream, 3);
    return at(TARP, k + (bayer(Math.floor(x * 2), Math.floor(y * 2 + z)) < 0.08 ? 1 : 0));
  };
  for (let x = 1; x < 31; x += 0.3)
    for (let y = 1; y < 46; y += 0.3) {
      const h = body(x, y);
      if (h < 0) continue;
      const dx = body(x + 0.6, y) - body(x - 0.6, y);
      const dy = body(x, y + 0.6) - body(x, y - 0.6);
      const luz = dx < -0.3 || dy < -0.3 ? 1 : dx > 0.8 || dy > 0.8 ? -1 : 0;
      s.plot(x, y, h + drape(x, y) * 0.6, tarp(x, y, h, luz));
    }
  // La lona cae por los costados hasta cerca del piso, con el borde deshilachado.
  for (let y = 2; y < 45; y += 0.3) {
    const h = body(29.9, y);
    const hem = 2 + noise(Math.floor(y), 1, 29) * 1.5 + Math.sin(y * 0.6) * 0.6;
    for (let z = hem; z < h; z += 0.35) if (!(y > 4 && y < 14 && z < 10) && !(y > 32 && y < 42 && z < 10)) s.plot(30 + drape(30, y + z) * 0.4, y, z, tarp(30, y, z, -1));
  }
  for (let x = 2; x < 30; x += 0.3) {
    const h = body(x, 44.9);
    const hem = 3 + noise(Math.floor(x), 2, 29) * 2 + Math.sin(x * 0.5) * 0.5;
    for (let z = hem; z < h; z += 0.35) s.plot(x, 45 + drape(x, 45 + z) * 0.4, z, tarp(x, 45, z, 0));
  }
  // Cuerdas amarradas por encima (dos, cruzando a lo ancho).
  for (const y of [16, 31])
    for (let x = 2; x < 30.2; x += 0.25) s.plot(x, y + Math.sin(x * 0.2) * 0.4, body(x, y) + 0.8, at(C.cork, 4));
  // Hojas secas y polvo sobre la lona.
  for (let i = 0; i < 18; i++) {
    const x = 5 + noise(i, 1, 31) * 22;
    const y = 5 + noise(i, 2, 31) * 36;
    s.plot(x, y, body(x, y) + 0.9, at(i % 3 ? C.dirt : C.logs, 3));
  }
  return s.sprite();
}

/**
 * Reflector de obra en su trípode amarillo (la luz del taller): la cabeza con la reja mira hacia +x y
 * el cable naranja queda enredado en el piso.
 */
function workLight(): Sprite {
  const s = scene(1, 1, 50);
  s.roundShadow(8, 8, 5.5, 0.26);
  // Cable en el piso, en vueltas flojas.
  for (let a = 0; a < Math.PI * 4; a += 0.07) {
    const r = 2.5 + a * 0.35;
    s.plot(8 + Math.cos(a) * r, 8 + Math.sin(a) * r * 0.8, 0.4, at(C.fire, 2 + (Math.floor(a * 3) % 2)));
  }
  // Trípode y el tubo.
  for (const a of [0.3, 2.4, 4.4]) stick(s, [8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 0], [8, 8, 22], at(C.mustard, a > 2 && a < 3 ? 3 : 4), 1);
  stick(s, [8, 8, 22], [8, 8, 34], at(C.mustard, 4), 1.2);
  s.solid(7, 7, 21, 2, 2, 2, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  // Horquilla y la cabeza del reflector: carcasa amarilla, vidrio casi blanco y dos barras de reja.
  stick(s, [8, 3.5, 32], [8, 12.5, 32], at(C.night, 2), 1);
  s.box(5.5, 3, 33, 4, 10, 6, T(at(C.mustard, 4)), T(at(C.mustard, 3)), (u, v) => {
    if (u < 1 || u > 9 || v < 1 || v > 5) return at(C.mustard, 2);
    if (Math.abs(u - 5) < 0.4) return at(C.night, 2);
    return at(v > 3 ? C.white : C.gold, v > 3 ? 4 : 5);
  });
  // Aletas de la parte de atrás.
  for (const y of [4.5, 7, 9.5, 12]) s.solid(4.5, y - 0.4, 33.5, 1, 0.8, 5, at(C.mustard, 3), at(C.mustard, 2), at(C.mustard, 1));
  return s.sprite();
}

// ---------- Oficina ----------

/** Pantalla de un monitor viejo: fósforo verde con líneas de texto y un reflejo curvo. */
const crtScreen: Tinte = (u, v) => {
  // Cara +x del monitor: u a lo largo de y (desde atrás), v hacia arriba. Marco beige alrededor.
  if (u < 1.8 || u > 10.2 || v < 1.8 || v > 9.2) return at(BEIGE, u < 1 || v > 10 ? 4 : 3);
  const scan = Math.floor(v * 2) % 2 === 0;
  if (Math.abs(u - 3 - (9.2 - v) * 0.4) < 0.5 && v > 6) return at(C.screen, 5);
  const line = Math.floor(v) % 2 === 0 && v < 8.5 && u > 3 && u < 3 + 2 + noise(Math.floor(v), 1, 71) * 5;
  if (line) return at(C.cyan, 4);
  return at(C.screen, scan ? 1 : 0);
};

/**
 * Escritorio metálico abollado con el computador de los noventa: el monitor de tubo beige, el teclado
 * amarillento, la torre al lado, dos tazas con manchas de café, papeles, un post-it en el monitor y la
 * lámpara de brazo. El frente (donde se sienta uno) mira hacia +x.
 */
function deskCrt(): Sprite {
  const s = scene(1, 2, 40);
  s.shadow(0, 0, 16, 32, 0.3);
  // Pedestal de cajones (hacia +y) y la pata del otro lado; un panel al fondo.
  const drawers: Tinte = (u, v) => {
    if (Math.floor(v) % 5 === 0) return at(OLIVE, 1);
    if (Math.floor(v) % 5 === 3 && u > 5 && u < 8) return u > 7 && v < 5 ? at(OLIVE, 1) : at(C.metal, 4);
    if (Math.hypot(u - 3, v - 8) < 1.8) return at(OLIVE, 2);
    return at(OLIVE, 3);
  };
  s.box(2, 18, 0, 12, 13, 14, T(at(OLIVE, 4)), (u, v) => at(OLIVE, smoothNoise(u, v, 3, 3) > 0.75 ? 2 : 3), drawers);
  s.box(1, 1, 0, 2, 17, 14, T(at(OLIVE, 3)), T(at(OLIVE, 2)), T(at(OLIVE, 1)));
  s.solid(12, 1.5, 0, 2, 2, 14, at(OLIVE, 3), at(OLIVE, 2), at(OLIVE, 1));
  // El tablero: lámina con el borde gastado y un forro de fórmica rayado.
  s.box(0, 0, 14, 16, 32, 2, (u, v) => {
    if (u < 0.8 || v < 0.8 || u > 15.2 || v > 31.2) return at(OLIVE, 2);
    // Aros de café.
    if (Math.abs(Math.hypot(u - 12, v - 25) - 2.2) < 0.4 || Math.abs(Math.hypot(u - 10.5, v - 8) - 1.8) < 0.35) return at(C.woodDark, 3);
    if (noise(Math.floor(u * 2), Math.floor(v), 73) > 0.97) return at(C.cream, 2);
    return at(C.cream, smoothNoise(u, v, 5, 75) > 0.65 ? 2 : 3);
  }, T(at(OLIVE, 3)), T(at(OLIVE, 2)));
  // Monitor de tubo: el cuerpo de atrás y la cara con la pantalla hacia +x.
  s.box(1, 5, 16, 6, 12, 10, T(at(BEIGE, 3)), T(at(BEIGE, 2)), T(at(BEIGE, 1)));
  s.box(7, 4, 16, 3.5, 14, 12, (u, v) => at(BEIGE, 4 - (noise(Math.floor(u), Math.floor(v), 77) > 0.9 ? 1 : 0)), T(at(BEIGE, 3)), (u, v) => (u > 1 && v > 1 ? crtScreen(u - 1, v - 1) : at(BEIGE, 3)));
  // Post-it pegado en el borde del monitor (y otro caído).
  s.quad([10.6, 14.5, 25], [0, 1, 0], [0, 0, 1], 3, 3, () => at(C.mustard, 5));
  s.quad([12, 26, 16.1], [1, 0, 0], [0, 1, 0], 3, 3, () => at(C.rose, 5));
  // Teclado amarillento y la torre al lado, con el lector de disquetes.
  s.box(11, 6, 16, 4, 11, 1.2, (u, v) => (Math.floor(u * 1.5) % 2 === 0 && Math.floor(v * 1.2) % 2 === 0 ? at(BEIGE, 2) : at(BEIGE, 4)), T(at(BEIGE, 2)), T(at(BEIGE, 1)));
  s.box(1.5, 19, 16, 7, 5, 13, T(at(BEIGE, 4)), T(at(BEIGE, 3)), (u, v) => (v > 9 && v < 10 && u > 1 && u < 4 ? at(C.night, 1) : v > 5 && v < 5.8 && u > 1 && u < 2 ? at(C.leaf, 5) : at(BEIGE, 2)));
  // Tazas sucias (una con la cuchara adentro) y una pila de papeles.
  for (const [x, y, c] of [
    [12, 25, C.cream],
    [13.5, 20.5, C.rug],
  ] as const) {
    s.cylinder(x, y, 16, 1.5, 3, (_a, v, luz) => at(c, (luz > 0 ? 4 : 2) - (v < 1 ? 1 : 0)));
    s.disc(x, y, 19, 1.5, (dx, dy) => (Math.hypot(dx, dy) > 1 ? at(c, 4) : at(C.woodDark, 1)));
  }
  stick(s, [12, 25, 18.5], [13, 26.5, 21], at(C.metal, 4), 0.5);
  for (let i = 0; i < 5; i++) s.box(9 + i * 0.3, 26 - i * 0.6, 16 + i * 0.4, 5, 4, 0.4, T(at(C.cream, i % 2 ? 4 : 5)), T(at(C.cream, 3)), T(at(C.cream, 3)));
  // Lámpara de brazo al fondo, en la punta, torcida hacia los papeles.
  s.disc(2.5, 29, 16.2, 1.8, () => at(C.night, 3));
  stick(s, [2.5, 29, 16.5], [2.5, 28, 26], at(C.night, 2), 0.8);
  stick(s, [2.5, 28, 26], [6.5, 27, 27.5], at(C.night, 2), 0.8);
  s.cone(7, 27, 24.5, 2.2, 3, (_a, _s, luz) => at(C.leaf, luz > 0.3 ? 3 : 1));
  s.disc(7, 27, 24.4, 1.2, () => at(C.gold, 5));
  // El cable del monitor colgando por detrás.
  for (let z = 4; z < 16; z += 0.3) s.plot(0.3, 12 + Math.sin(z * 0.5) * 1.5, z, at(RUBBER, 2));
  return s.sprite();
}

/** Cuerina rajada con la espuma asomando y parches de cinta. */
const brokenVinyl =
  (tearAt: [number, number], tape: boolean): Shader =>
  (u, v, fw, fh) => {
    const du = u - tearAt[0];
    const dv = v - tearAt[1];
    // Raja en diagonal con la espuma amarilla adentro.
    if (Math.abs(du - dv * 0.7) < 0.9 && Math.abs(dv) < 3.2) return at(FOAM, Math.abs(du - dv * 0.7) < 0.4 ? 3 : 2);
    if (Math.abs(du - dv * 0.7) < 1.5 && Math.abs(dv) < 3.2) return at(VINYL, 0);
    // Cinta gris en cruz, tapando otra raja.
    if (tape && (Math.abs(u - v * (fw / fh)) < 1.1 || Math.abs(u - (fw - v * (fw / fh))) < 1.1)) return at(TAPE, noise(Math.floor(u), Math.floor(v), 81) < 0.3 ? 1 : 2);
    if (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(VINYL, 2);
    // Cuarteado del cuero y el brillo gastado.
    if (noise(Math.floor(u), Math.floor(v), 83) > 0.93) return at(VINYL, 1);
    return at(VINYL, bayer(Math.floor(u), Math.floor(v)) < 0.12 ? 4 : 3);
  };

/**
 * La silla fea: de oficina con ruedas, pero con la cuerina café rajada y la espuma asomando, una cruz de
 * cinta en el respaldo, un solo apoyabrazos y la rueda que falta reemplazada por un ladrillo.
 */
function brokenChair(variant: Variant): Sprite {
  const back = variant === "back";
  const bx = back ? 12 : 2;
  const wheel = (x: number, y: number): Box => solidBox({ x, y, z: 0, w: 2, d: 2, h: 1.5 }, C.night, 3);
  const base: Box[] = [
    wheel(7, 1),
    wheel(1, 7),
    solidBox({ x: 7.5, y: 2.5, z: 1.5, w: 1, d: 11, h: 1 }, C.metal, 2),
    solidBox({ x: 2.5, y: 7.5, z: 1.5, w: 11, d: 1, h: 1 }, C.metal, 2),
    wheel(13, 7),
    // La rueda de adelante se perdió: la pata apoya en medio ladrillo.
    solidBox({ x: 6, y: 12.5, z: 0, w: 4, d: 2.5, h: 1.8 }, C.terracotta, 3),
    solidBox({ x: 7, y: 7, z: 2, w: 2, d: 2, h: 6 }, C.metal, 3),
  ];
  const seat: Box[] = [
    solidBox({ x: 3, y: 3, z: 8, w: 10, d: 10, h: 1 }, C.metal, 2),
    { x: 3, y: 3, z: 9, w: 10, d: 10, h: 2, top: brokenVinyl([6, 6], false), left: flat(at(VINYL, 2)), right: flat(at(VINYL, 1)) },
  ];
  // Respaldo un poco caído hacia atrás (más bajo que el de las sillas buenas), con la cruz de cinta.
  const rest: Box[] = [
    solidBox({ x: bx, y: 7, z: 9, w: 2, d: 2, h: 4 }, C.metal, 3),
    { x: bx, y: 2, z: 12, w: 2, d: 12, h: 11, top: flat(at(VINYL, 3)), left: flat(at(VINYL, 2)), right: brokenVinyl([8, 7], true) },
  ];
  // Un solo apoyabrazos (el otro se lo llevaron).
  const arm: Box[] = [solidBox({ x: 7, y: 2, z: 11, w: 1, d: 1, h: 4 }, C.metal, 3), solidBox({ x: back ? 5 : 4, y: 2, z: 15, w: 7, d: 1, h: 1 }, C.night, 3)];
  const parts = back ? [...base, ...arm, ...seat, ...rest] : [...base, ...rest, ...arm, ...seat];
  return renderSprite(parts, {
    outline: OUT,
    under: shadowUnder(2, 2, 12, 12),
    extra: (c, p) => {
      // Espuma que se sale por el borde del asiento.
      for (const [x, y] of [
        [12.5, 5],
        [12.5, 6],
        [13, 5.5],
      ] as const) {
        const q = p(x, y, 10.5);
        c.set(q.x, q.y, at(FOAM, 3));
      }
    },
  });
}

/** Archivador de lata abollado: el cajón de arriba abierto con papeles, óxido y una caja encima. */
function filingDented(): Sprite {
  const s = scene(1, 1, 40);
  s.shadow(1, 1, 14, 14, 0.3);
  const front: Tinte = (u, v) => {
    // Tres cajones con su manija y el portaetiquetas; abolladura oscura en el de abajo.
    const k = Math.floor(v / 8);
    const dv = v % 8;
    if (dv < 0.8) return at(OLIVE, 1);
    if (Math.hypot(u - 4, v - 4) < 2.2) return at(OLIVE, 2);
    if (dv > 5 && dv < 6.4 && u > 4 && u < 8) return at(C.metal, 4);
    if (dv > 3 && dv < 4.5 && u > 4.5 && u < 7.5) return k === 1 ? at(C.cream, 5) : at(OLIVE, 1);
    if (smoothNoise(u, v, 3, 91) > 0.76) return at(RUST, 2);
    return at(OLIVE, 3);
  };
  s.box(2, 2, 0, 12, 12, 25, T(at(OLIVE, 4)), (u, v) => at(OLIVE, smoothNoise(u, v, 4, 93) > 0.7 ? 2 : 3), front);
  // Cajón de arriba abierto hacia +x, con carpetas y papeles saliendo.
  s.box(14, 3, 17, 3, 10, 7, (u, v) => (Math.floor(v) % 2 === 0 ? at(C.mustard, 4) : at(C.cream, 5)), T(at(OLIVE, 3)), T(at(OLIVE, 2)));
  s.quad([15, 4, 24], [0, 1, 0], [0.3, 0, 1], 8, 3, (u) => at(C.cream, Math.floor(u) % 3 === 0 ? 3 : 5));
  // Encima: una caja de cartón con carpetas y una taza con lápices.
  box(s, 3, 3, 25, 9, 8, 6, 21, true);
  s.cylinder(11.5, 12, 25, 1.4, 3, (_a, _v, luz) => at(C.blue, luz > 0 ? 4 : 2));
  stick(s, [11.2, 12, 27], [11, 11.5, 31], at(C.mustard, 4), 0.6);
  stick(s, [11.8, 12.4, 27], [12.8, 12.6, 30.5], at(C.rug, 4), 0.6);
  return s.sprite();
}

/** Planta seca en una matera rajada: tallos cafés caídos y hojas tiradas alrededor. */
function deadPlant(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8, 8, 5.5, 0.28);
  // Hojas secas en el piso.
  for (let i = 0; i < 9; i++) {
    const a = noise(i, 1, 61) * Math.PI * 2;
    const d = 4.5 + noise(i, 2, 61) * 2.5;
    s.solid(8 + Math.cos(a) * d, 8 + Math.sin(a) * d, 0, 1.4, 1, 0.3, at(C.cork, 2 + (i % 3)), at(C.cork, 1), at(C.cork, 1));
  }
  s.cylinder(8, 8, 0, 4, 7, (a, v, luz) => {
    if (Math.abs(a * 4 - 2 - v * 0.3) < 0.4 && v > 1) return at(C.terracotta, 0);
    return at(C.terracotta, (luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2) - (v > 6 ? 0 : v < 1 ? 1 : 0));
  });
  s.disc(8, 8, 7, 4, (dx, dy) => (Math.hypot(dx, dy) > 3.3 ? at(C.terracotta, 4) : at(C.dirt, 2)));
  // Tallos: suben un poco y se doblan hacia afuera, con alguna hoja café colgando.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const len = 9 + noise(i, 3, 63) * 6;
    let x = 8 + Math.cos(a) * 0.8;
    let y = 8 + Math.sin(a) * 0.8;
    let z = 7;
    for (let k = 0; k < len; k += 0.4) {
      const bend = Math.max(0, k - 4) * 0.25;
      x += Math.cos(a) * 0.12 * (1 + bend);
      y += Math.sin(a) * 0.12 * (1 + bend);
      z += 0.4 - bend * 0.18;
      s.plot(x, y, z, at(C.logs, 2 + (k > len * 0.7 ? 1 : 0)));
      if (Math.floor(k * 2.5) % 7 === 3) s.solid(x, y, z - 1, 1, 1, 1, at(C.cork, 3), at(C.cork, 2), at(C.cork, 1));
    }
  }
  return s.sprite();
}

/** Ventilador de pie viejo: base redonda, el tubo, la reja abollada con las aspas (mira hacia +x) y polvo. */
function floorFan(): Sprite {
  const s = scene(1, 1, 44);
  s.roundShadow(8, 8, 5, 0.28);
  s.cylinder(8, 8, 0, 4.2, 1.5, (_a, _v, luz) => at(C.metal, luz > 0 ? 3 : 2));
  s.disc(8, 8, 1.5, 4.2, (dx, dy) => (Math.hypot(dx, dy) < 1 ? at(C.metal, 2) : at(C.metal, 4)));
  s.cylinder(8, 8, 1.5, 0.8, 24, (_a, _v, luz) => at(C.metal, luz > 0 ? 4 : 2));
  // Motor atrás de la reja.
  s.box(5, 6, 25, 4, 4, 5, T(at(C.cream, 3)), T(at(C.cream, 3)), T(at(C.cream, 2)));
  // Aspas (tres, color crema amarillento) y la reja de alambre alrededor, abollada de un lado.
  const cx = 11;
  const cy = 8;
  const cz = 30;
  for (let a = 0; a < Math.PI * 2; a += 0.03)
    for (let r = 0; r < 6.2; r += 0.35) {
      const blade = Math.cos(3 * a) > 0.35 && r > 1;
      if (blade) s.plot(cx - 0.8, cy + Math.cos(a) * r, cz + Math.sin(a) * r, at(C.cream, r > 4 ? 4 : 3));
    }
  s.borde = false;
  for (let a = 0; a < Math.PI * 2; a += 0.025) {
    const dent = Math.cos(a - 2.4) > 0.8 ? 0.9 : 0;
    const R = 7 - dent;
    s.plot(cx, cy + Math.cos(a) * R, cz + Math.sin(a) * R, at(C.metal, 4));
    for (const rr of [2.5, 4.8]) s.plot(cx + 0.2, cy + Math.cos(a) * rr, cz + Math.sin(a) * rr, at(C.metal, 3));
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (let r = 1; r < 7; r += 0.3) s.plot(cx + 0.1, cy + Math.cos(a) * r, cz + Math.sin(a) * r, at(C.metal, 3));
  }
  s.borde = true;
  s.disc(cx + 0.3, cy, cz, 1, () => null);
  for (let a = 0; a < Math.PI * 2; a += 0.2) for (let r = 0; r < 1.2; r += 0.3) s.plot(cx + 0.3, cy + Math.cos(a) * r, cz + Math.sin(a) * r, at(C.rug, 3));
  return s.sprite();
}

/** Tapete gastado: el dibujo casi borrado, los flecos deshilachados, una mancha de café y un quemón. */
function wornRug(): Sprite {
  const r = C.rug;
  const top: Shader = (u, v, fw, fh) => {
    // Flecos en las puntas (a lo largo de y).
    if (v < 2 || v >= fh - 2) return (Math.floor(u) % 2 === 0 && noise(Math.floor(u), v < 2 ? 0 : 1, 3) > 0.2) ? at(C.cream, 2) : null;
    const e = Math.min(u, v - 2, fw - 1 - u, fh - 3 - v);
    const wear = smoothNoise(u, v, 6, 11);
    if (Math.hypot(u - fw * 0.65, v - fh * 0.35) < 3.2) return at(C.woodDark, Math.hypot(u - fw * 0.65, v - fh * 0.35) < 2.6 ? 3 : 2);
    if (Math.hypot(u - fw * 0.3, v - fh * 0.7) < 1.2) return OUT;
    if (Math.hypot(u - fw * 0.3, v - fh * 0.7) < 1.8) return at(C.woodDark, 1);
    const pattern = e < 1 ? 0 : e < 3 ? 1 : e < 4.5 ? (Math.floor(u) + Math.floor(v)) % 4 < 2 ? 3 : 4 : Math.floor(u + v) % 9 === 0 || Math.floor(u - v + 480) % 9 === 0 ? 3 : 2;
    // Donde se pisa más, el dibujo se borra hacia el tono de la trama.
    if (wear > 0.55 && bayer(Math.floor(u), Math.floor(v)) < (wear - 0.55) * 3) return mix(at(r, 2), at(C.cream, 2), 0.35);
    return at(r, pattern);
  };
  return renderSprite([{ x: 0.5, y: 0.5, z: 0, w: 31, d: 47, h: 1, top, left: flat(at(r, 0)), right: flat(at(r, 0)) }], { outline: OUT });
}

/** Dibujos para registrar en DRAW de furniture.ts. */
export const GARAJE_DRAW: Record<string, (v: Variant) => Sprite> = {
  workbench,
  "metal-shelf": metalShelf,
  "tire-stack": tireStack,
  "tool-chest": toolChest,
  compressor,
  "oil-drum": oilDrum,
  "cardboard-boxes": cardboardBoxes,
  "paint-cans": paintCans,
  "broom-corner": broomCorner,
  "tarp-car": tarpCar,
  "work-light": workLight,
  "desk-crt": deskCrt,
  "office-chair-broken": brokenChair,
  "filing-dented": filingDented,
  "dead-plant": deadPlant,
  "floor-fan": floorFan,
  "worn-rug": wornRug,
};

export { standingTire, tire, can, box as cardboardBox, rag, stick, TOOLRED };
