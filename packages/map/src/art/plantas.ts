// Plantas de interior para darle variedad a la casa (antes casi todo era la misma "plant"). Mismo estilo
// que las de decor.ts: la maceta con volumen (cajas o un cilindro pintado a mano), el follaje a mano en
// `extra` y el contorno café alrededor de todo. Unidades de arte (tile = 16), centradas en (8, 8).
import { C, OUT } from "./palette";
import { at, bayer, flat, noise, ramp, renderSprite, solidBox, type Box, type PixelCanvas, type Project, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { leg, roundShadow, shadowUnder, volume, type Variant } from "./kit";

/** Verde oscuro y brillante (ficus lira, orquídea). */
const GLOSSY: Ramp = ramp("#10261b", "#1a3b28", "#265437", "#336e45", "#4c8c57", "#79b070");
/** Verde grisáceo plateado (el olivo). */
const OLIVE: Ramp = ramp("#28332b", "#3d4c3e", "#566a52", "#728a69", "#94ab86", "#bccdaa");
/** Verde azulado de los cactus de columna. */
const CEREUS: Ramp = ramp("#1a3431", "#27504a", "#356d63", "#4a8b7c", "#6aa998", "#9ccbb8");
/** Hojas de la lengua de suegra: verde con bandas claras. */
const SNAKE: Ramp = ramp("#132b1c", "#1e4029", "#2c5a37", "#3f7648", "#5e9559", "#8cb878");
/** Pétalos de la orquídea (fucsia a blanco). */
const ORCHID: Ramp = ramp("#5a1f4f", "#8a2f75", "#b54a98", "#d77cbc", "#efb3da", "#fde8f5");
/** Concreto (macetas modernas). */
const CONCRETE: Ramp = ramp("#4a4a4f", "#66666c", "#85858a", "#a3a2a5", "#c2c0c0", "#dddad6");
/** Cerámica esmaltada verde (el pothos). */
const GLAZE: Ramp = ramp("#1f3c3a", "#2c5652", "#3d736c", "#579487", "#7fb4a3", "#b5d8c8");

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------- Piezas ----------

/**
 * Maceta redonda (cilindro) de radio `r` y alto `h`, centrada en (cx, cy) y apoyada en z0. `side` da el
 * color de la pared según la posición horizontal normalizada (-1 izquierda … 1 derecha) y la altura desde
 * abajo; la boca lleva el borde (`rim`) y la tierra.
 */
function cylinder(
  c: PixelCanvas,
  p: Project,
  cx: number,
  cy: number,
  z0: number,
  h: number,
  r: number,
  side: (nx: number, hv: number, x: number, y: number) => RGBA,
  rim: RGBA,
  soil: RGBA = at(C.dirt, 1),
) {
  const B = p(cx, cy, z0);
  const T = p(cx, cy, z0 + h);
  const rx = r * 1.42;
  const ry = r * 0.71;
  for (let y = Math.floor(T.y - ry); y <= Math.ceil(B.y + ry); y++)
    for (let x = Math.floor(B.x - rx); x <= Math.ceil(B.x + rx); x++) {
      const nx = (x + 0.5 - B.x) / rx;
      if (Math.abs(nx) > 1) continue;
      // Por debajo, el borde curvo de la base; por arriba, hasta el centro de la boca.
      const bottom = B.y + ry * Math.sqrt(1 - nx * nx);
      if (y + 0.5 > bottom || y + 0.5 < T.y) continue;
      c.set(x, y, side(nx, bottom - (y + 0.5), x, y));
    }
  c.ellipse(T.x, T.y, rx, ry, rim);
  c.ellipse(T.x, T.y + 0.3, rx - 1.3, ry - 0.8, soil);
}

/** Tono de la pared de una maceta redonda: luz a la izquierda, con tramado entre bandas. */
const potTone = (r: Ramp, nx: number, x: number, y: number, base = 3) => at(r, base + Math.round(-nx * 1.3 + (bayer(x, y) - 0.5) * 0.8));

/**
 * Hoja en punta (lanceolada) girada `ang` radianes, con la mitad de arriba más clara y la nervadura.
 * `wide` > 1 ensancha la punta (el ficus lira tiene hojas de violín).
 */
function leaf(c: PixelCanvas, cx: number, cy: number, ang: number, ra: number, rb: number, r: Ramp, wide = 1, rib = true) {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const R = Math.ceil(Math.max(ra, rb * wide)) + 1;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = (dx * cos + dy * sin) / ra;
      const b = -dx * sin + dy * cos;
      if (Math.abs(a) > 1) continue;
      // Ancho en cada punto: lente (puntas finas), más ancha hacia la punta si `wide`.
      const half = rb * (1 - a * a) * (1 + (wide - 1) * Math.max(0, a + 0.2));
      if (Math.abs(b) > half) continue;
      let col: RGBA;
      if (rib && Math.abs(b) < 0.45 && a > -0.9 && a < 0.8) col = at(r, 2);
      else if (Math.abs(b) > half - 0.8) col = at(r, b < 0 ? 3 : 1);
      else col = at(r, b < 0 ? 4 : 3);
      c.set(x, y, col);
    }
}

/**
 * Hoja compuesta (fronda de palma o de helecho) a lo largo de una curva: la nervadura y, a los dos lados,
 * hojuelas que se inclinan hacia la punta y caen un poco. `width(t)` da el largo de las hojuelas (t = 0
 * en la base, 1 en la punta); `r` es la rampa y `step` cada cuánto sale una hojuela.
 */
function frond(c: PixelCanvas, pts: [number, number][], width: (t: number) => number, r: Ramp, step = 1, droop = 0.6) {
  const n = pts.length - 1;
  for (let i = 1; i <= n; i++) {
    const [x, y] = pts[i]!;
    const [px, py] = pts[i - 1]!;
    const tl = Math.hypot(x - px, y - py) || 1;
    const tx = (x - px) / tl;
    const ty = (y - py) / tl;
    const t = i / n;
    const w = width(t);
    if (i % step === 0 && w > 0.3) {
      // Normales a los dos lados; la de abajo cae más (peso de la hoja).
      for (const s of [-1, 1]) {
        const nx = -ty * s;
        const ny = tx * s;
        const ex = x + (nx + tx * 0.7) * w;
        const ey = y + (ny + ty * 0.7) * w + droop * w;
        c.line(x, y, ex, ey, at(r, ny < 0 ? 3 : 2));
        c.set(ex, ey, at(r, ny < 0 ? 4 : 1));
      }
    }
  }
  // La nervadura encima, clara arriba y oscura abajo.
  for (let i = 0; i <= n; i++) {
    const [x, y] = pts[i]!;
    c.set(x, y + 1, at(r, 1));
    c.set(x, y, at(r, 4));
  }
}

/** Curva de una fronda en pantalla: sale de (x0, y0) hacia (dx, dy), subiendo `lift` y cayendo al final. */
function arc(x0: number, y0: number, dx: number, dy: number, lift: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + dx * t, y0 + dy * t - lift * Math.sin(t * Math.PI * 0.75) + lift * 0.4 * t * t]);
  }
  return pts;
}

// ---------- Lengua de suegra (sansevieria) ----------

function snakePlant(): Sprite {
  return renderSprite([volume(0, 0, 0, 16, 16, 40)], {
    outline: OUT,
    under: roundShadow(8.5, 8.5, 6),
    extra: (c, p) => {
      // Maceta cilíndrica de cerámica crema con una franja mostaza.
      cylinder(c, p, 8, 8, 0, 10, 4.6, (nx, hv, x, y) => (hv > 6 && hv < 7.6 ? potTone(C.mustard, nx, x, y, 3) : potTone(C.cream, nx, x, y, 4)), at(C.cream, 5));
      const b = p(8, 8, 10);
      // Hojas de espada: [dx en la base, alto, ancho, inclinación]; de atrás hacia adelante.
      const blades: [number, number, number, number][] = [
        [-2, 25, 2.2, -0.12],
        [2, 28, 2.3, 0.1],
        [0, 33, 2.6, 0.02],
        [-4, 19, 2, -0.3],
        [4, 21, 2.1, 0.28],
        [-1, 23, 2.4, -0.06],
        [2, 17, 2.2, 0.16],
      ];
      blades.forEach(([dx, hgt, w, lean], k) => {
        for (let i = 0; i <= hgt; i++) {
          const t = i / hgt;
          const x = b.x + dx + lean * i + Math.sin(t * 2.4 + k) * 0.6;
          const y = b.y - i + 1;
          const half = w * (1 - Math.pow(t, 2.2)) + 0.4;
          for (let s = -Math.ceil(half); s <= Math.ceil(half); s++) {
            if (Math.abs(s) > half) continue;
            const edge = Math.abs(s) >= half - 0.9 && half > 1;
            // Filo amarillo a la derecha, oscuro a la izquierda (separa la hoja de la de atrás) y bandas
            // claras irregulares a lo alto.
            const band = mod(i + Math.floor(noise(k, Math.floor(s + 3), 5) * 3), 5) === 0;
            const col = edge ? (s > 0 ? at(C.mustard, 3) : at(SNAKE, 0)) : band ? at(SNAKE, 4) : at(SNAKE, s < 0 ? 3 : 2);
            c.set(x + s, y, col);
          }
        }
      });
    },
  });
}

// ---------- Ficus lira ----------

function fiddleFig(): Sprite {
  // Maceta cuadrada de concreto, con una línea de sombra bajo el borde.
  const face =
    (base: number): Shader =>
    (_u, v, _fw, fh) =>
      at(CONCRETE, v >= fh - 1.2 ? base + 1 : noise(Math.floor(_u), Math.floor(v), 8) < 0.08 ? base - 1 : base);
  return renderSprite(
    [
      { x: 4, y: 4, z: 0, w: 8.5, d: 8.5, h: 10, top: flat(at(C.dirt, 1)), left: face(3), right: face(2) },
      {
        x: 3.5,
        y: 3.5,
        z: 10,
        w: 9.5,
        d: 9.5,
        h: 1.2,
        top: (u, v, fw, fh) => (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? at(CONCRETE, 5) : at(C.dirt, 1)),
        left: flat(at(CONCRETE, 4)),
        right: flat(at(CONCRETE, 3)),
      },
      volume(-6, -6, 11, 28, 28, 38),
    ],
    {
      outline: OUT,
      under: shadowUnder(3.5, 3.5, 9.5, 9.5),
      extra: (c, p) => {
        const b = p(8.2, 8.2, 11.2);
        // Tronco fino que sube un poco torcido.
        for (let i = 0; i < 30; i++) {
          const x = b.x + Math.round(Math.sin(i * 0.18) * 1.2);
          c.set(x, b.y - i, at(C.woodDark, 2));
          c.set(x - 1, b.y - i, at(C.woodDark, 4));
        }
        const deg = Math.PI / 180;
        // Hojas grandes de violín: [dx, dy, ángulo hacia la punta, largo, ancho]; de atrás hacia adelante.
        const leaves: [number, number, number, number, number][] = [
          [-5, -36, 250, 5, 2.8],
          [5, -37, 290, 5, 2.8],
          [0, -40, 270, 4.5, 2.6],
          [-7, -29, 205, 5.5, 3],
          [7, -30, 335, 5.5, 3],
          [-3, -31, 240, 5, 2.8],
          [4, -32, 300, 5, 2.8],
          [-7, -21, 190, 5.5, 3],
          [7, -22, 350, 5.5, 3],
          [-1, -25, 100, 4.5, 2.8],
          [-6, -13, 170, 5, 2.8],
          [6, -15, 10, 5, 2.8],
        ];
        for (const [dx, dy, a, ra] of leaves) {
          const sx = b.x + dx - Math.cos(a * deg) * ra;
          const sy = b.y + dy - Math.sin(a * deg) * ra;
          c.line(b.x, b.y + dy + 2, sx, sy, at(C.woodDark, 2));
        }
        for (const [dx, dy, a, ra, rb] of leaves) {
          leaf(c, b.x + dx + 0.6, b.y + dy + 1, a * deg, ra, rb, [GLOSSY[0]!, GLOSSY[0]!, GLOSSY[1]!, GLOSSY[1]!, GLOSSY[1]!], 1.5, false);
          leaf(c, b.x + dx, b.y + dy, a * deg, ra, rb, GLOSSY, 1.5);
          // Brillo de la hoja encerada.
          c.set(b.x + dx - 1, b.y + dy - 1, at(GLOSSY, 5));
        }
      },
    },
  );
}

// ---------- Palmera de salón (kentia) ----------

function kentia(): Sprite {
  // Maceta de talavera: blanca con rombos y cenefa azul.
  const talavera =
    (shift: number): Shader =>
    (u, v, _fw, fh) => {
      if (v >= fh - 1.5 || v < 1.2) return at(C.blue, 2 + shift);
      const x = mod(u, 4.5) - 2.25;
      const y = mod(v - 1.2, 4.5) - 2.25;
      const d = Math.abs(x) + Math.abs(y);
      if (d < 0.9) return at(C.mustard, 3 + shift);
      if (Math.abs(d - 1.8) < 0.45) return at(C.blue, 3 + shift);
      return at(C.white, 3 + shift);
    };
  return renderSprite(
    [
      { x: 4, y: 4, z: 0, w: 8.5, d: 8.5, h: 9, top: flat(at(C.dirt, 1)), left: talavera(0), right: talavera(-1) },
      solidBox({ x: 3.5, y: 3.5, z: 9, w: 9.5, d: 9.5, h: 1.5 }, C.blue, 3),
      volume(-12, -12, 10, 40, 40, 34),
    ],
    {
      outline: OUT,
      under: shadowUnder(3.5, 3.5, 9.5, 9.5),
      extra: (c, p) => {
        const b = p(8.2, 8.2, 10.5);
        // Tallos finos que suben del centro de la maceta.
        for (const dx of [-3, -1, 1, 3]) c.line(b.x, b.y, b.x + dx, b.y - 10, at(C.woodDark, 3));
        // Frondas: [dx y dy de la punta, cuánto suben]; las de atrás primero, las que caen al frente al final.
        const fronds: [number, number, number][] = [
          [-5, -24, 4],
          [6, -25, 4],
          [-13, -14, 8],
          [14, -15, 8],
          [0, -26, 2],
          [-17, -4, 9],
          [17, -5, 9],
          [-10, 2, 7],
          [11, 1, 7],
        ];
        fronds.forEach(([dx, dy, lift], k) => {
          const pts = arc(b.x + dx * 0.15, b.y - 10, dx, dy + 10, lift, 18);
          frond(c, pts, (t) => (t < 0.12 ? 0 : 1.2 + 3 * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.35)), k % 2 ? C.leaf : GLOSSY, 1, 0.8);
        });
      },
    },
  );
}

// ---------- Helecho de Boston en pedestal ----------

function bostonFern(): Sprite {
  const grain =
    (base: number): Shader =>
    (u, v) =>
      at(C.woodDark, mod(Math.floor(u), 3) === 0 ? base - 1 : noise(0, Math.floor(v / 3), 3) < 0.2 ? base + 1 : base);
  return renderSprite(
    [
      // Pedestal torneado de madera: base, columna y bandeja.
      solidBox({ x: 3.5, y: 3.5, z: 0, w: 9, d: 9, h: 2 }, C.woodDark, 3),
      { x: 6, y: 6, z: 2, w: 4, d: 4, h: 15, top: flat(at(C.woodDark, 4)), left: grain(3), right: grain(2) },
      solidBox({ x: 5, y: 5, z: 8, w: 6, d: 6, h: 1.5 }, C.woodDark, 4),
      solidBox({ x: 3, y: 3, z: 17, w: 10, d: 10, h: 1.5 }, C.woodDark, 4),
      // Maceta de barro encima.
      { x: 4.5, y: 4.5, z: 18.5, w: 7, d: 7, h: 5, top: flat(at(C.dirt, 1)), left: (_u, v) => at(C.terracotta, Math.floor(v) === 3 ? 2 : 3), right: (_u, v) => at(C.terracotta, Math.floor(v) === 3 ? 1 : 2) },
      volume(-10, -10, 4, 36, 36, 34),
    ],
    {
      outline: OUT,
      under: shadowUnder(3.5, 3.5, 9, 9),
      extra: (c, p) => {
        const b = p(8, 8, 23.5);
        // Frondas finas que salen del centro y caen por todo el borde, como una fuente: primero las de
        // atrás (suben más y caen poco), después las del frente, que cuelgan por delante del pedestal.
        const fronds: [number, number, number][] = [
          [-5, -9, 5],
          [5, -10, 5],
          [0, -12, 3],
          [-12, -2, 6],
          [12, -3, 6],
          [-15, 8, 6],
          [15, 7, 6],
          [-10, 9, 4],
          [10, 8, 4],
          [-5, 7, 3],
          [5, 6, 3],
        ];
        for (const [dx, dy, lift] of fronds) {
          const pts: [number, number][] = [];
          const n = 16;
          for (let i = 0; i <= n; i++) {
            const t = i / n;
            // Sale hacia afuera casi horizontal y cae con peso al final.
            pts.push([b.x + dx * Math.sin(t * Math.PI * 0.5), b.y - 2 - lift * Math.sin(t * Math.PI * 0.6) + (dy + lift) * t * t]);
          }
          frond(c, pts, (t) => (t < 0.08 ? 0 : 2.2 * (1 - t * 0.6)), C.grass, 1, 0.3);
        }
        c.ellipse(b.x, b.y - 2, 3, 1.6, at(C.grass, 3));
        c.ellipse(b.x - 1, b.y - 3, 1.6, 0.9, at(C.grass, 5));
      },
    },
  );
}

// ---------- Pothos en maceta alta ----------

function pothos(): Sprite {
  return renderSprite([volume(-2, -2, 0, 20, 20, 30)], {
    outline: OUT,
    under: roundShadow(8.5, 8.5, 6),
    extra: (c, p) => {
      // Maceta alta y redonda esmaltada en verde agua, con dos anillos.
      cylinder(c, p, 8, 8, 0, 16, 4.4, (nx, hv, x, y) => (Math.abs(hv - 4) < 0.7 || Math.abs(hv - 12) < 0.7 ? potTone(GLAZE, nx, x, y, 2) : potTone(GLAZE, nx, x, y, 3)), at(GLAZE, 5));
      const b = p(8, 8, 16);
      // Hojita de corazón con la mancha amarilla del pothos dorado.
      const heart = (x: number, y: number, k: number) => {
        const s = k % 2 ? 1 : -1;
        c.set(x, y, at(C.leaf, 2));
        c.set(x + s, y, at(C.leaf, 3));
        c.set(x, y - 1, at(C.leaf, 4));
        c.set(x + s, y - 1, at(C.leaf, 3));
        c.set(x + s * 2, y - 1, at(C.leaf, 2));
        c.set(x + s, y + 1, at(C.leaf, 2));
        if (noise(k, x, 9) < 0.5) c.set(x + s, y - 1, at(C.mustard, 4));
      };
      // Mata sobre la boca de la maceta.
      const mound: [number, number][] = [
        [-4, -3],
        [4, -4],
        [-1, -6],
        [2, -8],
        [0, -3],
        [-5, 0],
        [5, -1],
        [-2, -1],
        [2, 0],
      ];
      mound.forEach(([dx, dy], k) => {
        c.ellipse(b.x + dx, b.y + dy, 2.4, 1.8, at(C.leaf, 1));
        c.ellipse(b.x + dx - 0.4, b.y + dy - 0.4, 2, 1.4, at(C.leaf, k % 3 ? 3 : 2));
        c.set(b.x + dx - 1, b.y + dy - 1, at(C.leaf, 5));
        if (k % 2) c.set(b.x + dx + 1, b.y + dy, at(C.mustard, 4));
      });
      // Guías que cuelgan por delante de la maceta hasta casi el piso.
      // Pocas y a los lados, para que se vea la maceta.
      const vines: [number, number, number][] = [
        [-6, 17, 0.4],
        [6, 11, -0.4],
        [-1.5, 8, 0.3],
      ];
      vines.forEach(([dx, len, sway], k) => {
        for (let i = 0; i <= len; i++) {
          const x = b.x + dx + Math.sin(i * 0.35 + k) * sway * 2;
          const y = b.y + 1 + i;
          c.set(x, y, at(C.leaf, 1));
          if (i % 4 === 1) heart(x + (i % 6 === 1 ? 1 : -1), y, k * 7 + i);
        }
      });
    },
  });
}

// ---------- Suculentas en maceta baja ----------

function succulents(): Sprite {
  const face =
    (base: number): Shader =>
    (u, v, _fw, fh) =>
      v >= fh - 1 ? at(C.terracotta, base + 1) : at(C.terracotta, mod(Math.floor(u), 4) === 0 && v < 2 ? base - 1 : base);
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 12, d: 12, h: 5, top: flat(at(C.dirt, 1)), left: face(3), right: face(2) },
      {
        x: 1.5,
        y: 1.5,
        z: 5,
        w: 13,
        d: 13,
        h: 1.2,
        top: (u, v, fw, fh) => {
          if (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1) return at(C.terracotta, 4);
          // Gravilla clara entre las plantas.
          const n = noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 21);
          return n < 0.35 ? at(C.stone, n < 0.15 ? 5 : 4) : at(C.dirt, n > 0.8 ? 2 : 1);
        },
        left: flat(at(C.terracotta, 3)),
        right: flat(at(C.terracotta, 2)),
      },
      volume(0, 0, 6, 16, 16, 10),
    ],
    {
      outline: OUT,
      under: shadowUnder(1.5, 1.5, 13, 13),
      extra: (c, p) => {
        // Roseta de hojas carnosas: anillos de pétalos de afuera hacia adentro, cada uno más claro.
        const rosette = (x: number, y: number, z: number, r: number, rp: Ramp, tip?: RGBA) => {
          const q = p(x, y, z);
          for (let ring = 0; ring < 3; ring++) {
            const rr = r * (1 - ring * 0.3);
            const petals = 7 - ring;
            for (let k = 0; k < petals; k++) {
              const a = (k / petals) * Math.PI * 2 + ring * 0.5;
              const px = q.x + Math.cos(a) * rr;
              const py = q.y + Math.sin(a) * rr * 0.55 - ring * 1.2;
              c.ellipse(px, py, 1.6, 1.1, at(rp, 1 + ring));
              c.set(px - 0.5, py - 0.5, at(rp, 2 + ring));
              if (tip && ring === 0) c.set(px + Math.cos(a) * 1.2, py + Math.sin(a) * 0.6, tip);
            }
          }
          c.ellipse(q.x, q.y - 3.2, 1.3, 0.9, at(rp, 4));
        };
        // Echeveria azulada, una rosada, una verde con puntas rojas y una bolita de cactus.
        rosette(5.5, 5.5, 6.2, 3.2, C.sage);
        rosette(10.5, 5, 6.2, 2.6, C.rose, at(C.rug, 2));
        rosette(5, 10.5, 6.2, 2.6, C.leaf, at(C.rug, 3));
        const q = p(10.5, 10.5, 6.2);
        c.ellipse(q.x, q.y - 2, 2.8, 2.6, at(C.green, 2));
        c.ellipse(q.x - 0.6, q.y - 2.6, 1.8, 1.6, at(C.green, 3));
        for (let k = 0; k < 6; k++) c.set(q.x - 2 + k * 0.8, q.y - 3.8 + (k % 2) * 2, at(C.cream, 5));
        c.set(q.x, q.y - 4.8, at(C.rose, 4));
        c.set(q.x + 1, q.y - 4.8, at(C.gold, 5));
        // Una haworthia de hojas en punta y rayitas blancas, al medio.
        const h = p(8, 8, 6.2);
        for (const [dx, hh] of [
          [-2, 4],
          [2, 4],
          [-1, 6],
          [1, 6],
          [0, 7],
        ] as const) {
          c.line(h.x + dx, h.y, h.x + dx * 1.8, h.y - hh, at(C.green, 2));
          c.line(h.x + dx - 1, h.y, h.x + dx * 1.8 - 1, h.y - hh + 1, at(C.green, 3));
          c.set(h.x + dx * 1.4, h.y - hh * 0.5, at(C.white, 4));
        }
      },
    },
  );
}

// ---------- Orquídea ----------

function orchid(): Sprite {
  return renderSprite(
    [
      // Mesita de noche de madera clara (con su cajón) donde luce la orquídea.
      {
        x: 3.5,
        y: 3.5,
        z: 0,
        w: 9,
        d: 9,
        h: 11,
        top: flat(at(C.wood, 4)),
        left: (u, v, fw) => (v < 1.2 ? at(C.woodDark, 2) : v > 7 && v < 7.8 ? at(C.wood, 1) : at(C.wood, u < 0.8 || u >= fw - 0.8 ? 2 : 3)),
        right: (u, v, fw) => {
          if (v < 1.2) return at(C.woodDark, 2);
          if (v > 7 && v < 7.8) return at(C.wood, 1);
          // Tirador dorado del cajón.
          if (v >= 8.6 && v < 9.8 && Math.abs(u - fw / 2) < 1) return at(C.gold, 4);
          return at(C.wood, u < 0.8 || u >= fw - 0.8 ? 1 : 2);
        },
      },
      {
        x: 3,
        y: 3,
        z: 11,
        w: 10,
        d: 10,
        h: 1.5,
        top: (u, v, fw, fh) => (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(C.wood, 5) : at(C.wood, mod(Math.floor(v), 4) === 0 ? 3 : 4)),
        left: flat(at(C.wood, 2)),
        right: flat(at(C.wood, 3)),
      },
      volume(-4, -4, 12, 24, 24, 26),
    ],
    {
      outline: OUT,
      under: shadowUnder(3, 3, 10, 10),
      extra: (c, p) => {
        // Maceta blanca de porcelana.
        cylinder(c, p, 8, 8, 12.5, 6, 3, (nx, _hv, x, y) => potTone(C.white, nx, x, y, 3), at(C.white, 4), at(C.cork, 2));
        const b = p(8, 8, 18.5);
        // Hojas anchas y planas que caen a los lados.
        leaf(c, b.x - 4, b.y + 0.5, Math.PI * 1.05, 4.5, 1.8, GLOSSY, 1, true);
        leaf(c, b.x + 4, b.y + 0.5, -0.1, 4.5, 1.8, GLOSSY, 1, true);
        leaf(c, b.x - 1, b.y + 1.5, Math.PI * 0.8, 3.5, 1.5, GLOSSY, 1, true);
        // Tutor de bambú y la vara florida que se arquea hacia la derecha.
        c.line(b.x, b.y - 1, b.x, b.y - 13, at(C.cork, 3));
        c.set(b.x, b.y - 14, at(C.cork, 4));
        // La vara sube junto al tutor y después se arquea hacia la derecha, casi horizontal.
        const knots: [number, number][] = [
          [1, -2],
          [1, -13],
          [3, -16],
          [7, -17],
          [11, -15],
          [13, -12],
        ];
        const stem: [number, number][] = [];
        for (let k = 0; k < knots.length - 1; k++)
          for (let s = 0; s < 4; s++) {
            const [x0, y0] = knots[k]!;
            const [x1, y1] = knots[k + 1]!;
            stem.push([b.x + x0 + ((x1 - x0) * s) / 4, b.y + y0 + ((y1 - y0) * s) / 4]);
          }
        stem.push([b.x + 13, b.y - 12]);
        for (const [x, y] of stem) c.set(x, y, at(C.leaf, 1));
        // Flores de cinco pétalos a lo largo de la vara, las de la punta más chicas (botones).
        const flower = (x: number, y: number, big: boolean) => {
          if (!big) {
            c.set(x, y, at(ORCHID, 3));
            c.set(x + 1, y, at(ORCHID, 2));
            return;
          }
          c.ellipse(x - 1.4, y - 0.8, 1.4, 1.2, at(ORCHID, 4));
          c.ellipse(x + 1.4, y - 0.8, 1.4, 1.2, at(ORCHID, 3));
          c.ellipse(x, y - 2, 1.1, 1, at(ORCHID, 5));
          c.ellipse(x, y + 0.6, 1.2, 1, at(ORCHID, 3));
          c.set(x, y - 0.5, at(C.gold, 4));
          c.set(x, y, at(ORCHID, 1));
        };
        // Las flores cuelgan de la parte horizontal; en la punta, dos botones.
        for (const i of [9, 12, 15, 18]) flower(stem[i]![0], stem[i]![1] + 2.5, true);
        flower(stem[19]![0] + 1, stem[19]![1] + 1.5, false);
        flower(stem[20]![0], stem[20]![1] + 1.5, false);
      },
    },
  );
}

// ---------- Olivo pequeño ----------

function oliveTree(): Sprite {
  return renderSprite([volume(-6, -6, 0, 28, 28, 42)], {
    outline: OUT,
    under: roundShadow(8.5, 8.5, 6.5),
    extra: (c, p) => {
      // Maceta grande de barro, redonda y con un reborde grueso.
      cylinder(c, p, 8, 8, 0, 11, 5, (nx, hv, x, y) => (hv > 8.5 ? potTone(C.terracotta, nx, x, y, 4) : hv < 1 ? at(C.terracotta, 1) : potTone(C.terracotta, nx, x, y, 3)), at(C.terracotta, 4));
      const b = p(8, 8, 11);
      // Tronco retorcido y gris que se abre en tres ramas.
      const trunk: [number, number][] = [
        [0, 0],
        [1, -4],
        [-1, -8],
        [0, -12],
        [2, -15],
      ];
      for (let i = 0; i < trunk.length - 1; i++) {
        const [x0, y0] = trunk[i]!;
        const [x1, y1] = trunk[i + 1]!;
        c.line(b.x + x0 - 1, b.y + y0, b.x + x1 - 1, b.y + y1, at(C.stone, 3));
        c.line(b.x + x0, b.y + y0, b.x + x1, b.y + y1, at(C.woodDark, 3));
        c.line(b.x + x0 + 1, b.y + y0, b.x + x1 + 1, b.y + y1, at(C.woodDark, 2));
      }
      c.line(b.x - 1, b.y - 10, b.x - 7, b.y - 18, at(C.woodDark, 3));
      c.line(b.x + 2, b.y - 15, b.x + 7, b.y - 22, at(C.woodDark, 3));
      c.line(b.x + 1, b.y - 14, b.x - 1, b.y - 26, at(C.woodDark, 3));
      // Copa aireada: nubes de hojitas finas y plateadas, con huecos por donde se ve el tronco.
      const clumps: [number, number, number, number][] = [
        [-8, -21, 6, 4],
        [8, -25, 6, 4],
        [-1, -30, 6.5, 4.5],
        [-3, -21, 4, 3],
        [4, -19, 4.5, 3],
      ];
      for (const [dx, dy, rx, ry] of clumps) {
        const cx = b.x + dx;
        const cy = b.y + dy;
        for (let k = 0; k < rx * ry * 2.2; k++) {
          const a = noise(k, dx, 31) * Math.PI * 2;
          const rr = Math.sqrt(noise(k, dy, 32));
          const x = cx + Math.cos(a) * rr * rx;
          const y = cy + Math.sin(a) * rr * ry;
          // Hojita alargada en diagonal: el haz verde gris y el envés plateado.
          const up = noise(k, 5, 33) < 0.5;
          const light = y < cy - ry * 0.2;
          c.set(x, y, at(OLIVE, light ? 4 : 2));
          c.set(x + (up ? 1 : -1), y - 1, at(OLIVE, light ? 5 : 3));
          c.set(x - (up ? 1 : -1), y + 1, at(OLIVE, 1));
        }
      }
      // Unas aceitunas negras.
      for (const [dx, dy] of [
        [-7, -19],
        [6, -23],
        [1, -28],
      ] as const)
        c.set(b.x + dx, b.y + dy, at(C.violet, 1));
    },
  });
}

// ---------- Cactus de columna ----------

function columnCactus(): Sprite {
  const g = CEREUS;
  const ribs =
    (base: number): Shader =>
    (u, v, _fw, fh) => {
      if (v >= fh - 0.8) return at(g, base + 1);
      if (Math.floor(u) % 2 === 0 && noise(Math.floor(u), Math.floor(v / 2), 15) < 0.14) return at(C.cream, 5);
      return at(g, Math.floor(u) % 2 ? base - 1 : base);
    };
  const column = (x: number, y: number, w: number, h: number): Box[] => [
    { x, y, z: 9, w, d: w, h, top: flat(at(g, 5)), left: ribs(3), right: ribs(2) },
    // Punta redondeada.
    { x: x + 0.5, y: y + 0.5, z: 9 + h, w: w - 1, d: w - 1, h: 1, top: flat(at(g, 5)), left: flat(at(g, 4)), right: flat(at(g, 3)) },
  ];
  const face =
    (base: number): Shader =>
    (u, v, _fw, fh) =>
      v >= fh - 1 ? at(CONCRETE, base + 1) : at(CONCRETE, noise(Math.floor(u / 2), Math.floor(v / 2), 4) < 0.12 ? base - 1 : base);
  return renderSprite(
    [
      { x: 3, y: 3, z: 0, w: 10, d: 10, h: 8, top: flat(at(C.dirt, 1)), left: face(3), right: face(2) },
      {
        x: 3,
        y: 3,
        z: 8,
        w: 10,
        d: 10,
        h: 1,
        top: (u, v, fw, fh) => (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? at(CONCRETE, 5) : at(C.cream, 2)),
        left: flat(at(CONCRETE, 4)),
        right: flat(at(CONCRETE, 3)),
      },
      // Tres columnas: la alta atrás, las otras adelante (orden de atrás hacia adelante).
      ...column(4.5, 4.5, 3.5, 25),
      ...column(8.5, 5, 3, 17),
      ...column(5, 8.8, 3, 12),
      ...column(9, 9.2, 2.6, 7),
    ],
    {
      outline: OUT,
      under: shadowUnder(3, 3, 10, 10),
      extra: (c, p) => {
        // Una flor blanca en la punta de la columna del medio.
        const f = p(10, 6.5, 27);
        c.set(f.x - 1, f.y, at(C.white, 4));
        c.set(f.x + 1, f.y, at(C.white, 4));
        c.set(f.x, f.y - 1, at(C.white, 4));
        c.set(f.x, f.y, at(C.gold, 4));
      },
    },
  );
}

export const PLANTAS_DRAW: Record<string, (v: Variant) => Sprite> = {
  "snake-plant": snakePlant,
  "fiddle-fig": fiddleFig,
  kentia,
  "boston-fern": bostonFern,
  pothos,
  succulents,
  orchid,
  "olive-tree": oliveTree,
  "column-cactus": columnCactus,
};
