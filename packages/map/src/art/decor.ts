// Muebles de decoración que se compran en la tienda (fase 3b). Mismo estilo que furniture.ts: cajas
// con shaders por cara, contorno café, mirando hacia +x ("front") y, si el catálogo dice hasBack,
// de espaldas ("back").
import { BOOKS, C, OUT, mix } from "./palette";
import {
  alpha,
  at,
  bayer,
  flat,
  noise,
  ramp,
  renderSprite,
  smoothNoise,
  solidBox,
  type Box,
  type PixelCanvas,
  type Ramp,
  type RGBA,
  type Shader,
  type Sprite,
} from "./pixel";
import { blob, leg, roundShadow, roundTone, shadowSpace, shadowUnder, slant, volume, type Variant } from "./kit";

/** Rampas propias de estos muebles (lo demás sale de la paleta común). */
const LILAC = ramp("#2e2140", "#4a3466", "#6a4d8c", "#8c6fb0", "#b597d0", "#dcc4ea");
const GINGER = ramp("#5a2c1a", "#8a4424", "#b8612e", "#dd8a45", "#f0b26a", "#fbd9a0");
const MOSS = ramp("#22331f", "#34502c", "#4c6e38", "#6a8f45", "#8fb05a");

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------- Plantas ----------

function cactus(): Sprite {
  const g = C.green;
  // Costillas verticales con espinas sueltas.
  const ribs =
    (base: number): Shader =>
    (u, v, _fw, fh) => {
      if (v >= fh - 1) return at(g, base + 1);
      if (Math.floor(u) % 2 === 0 && noise(Math.floor(u), Math.floor(v / 2), 5) < 0.12) return at(C.cream, 5);
      return at(g, Math.floor(u) % 2 ? base - 1 : base);
    };
  const stem = (x: number, y: number, z: number, w: number, d: number, h: number): Box => ({
    x,
    y,
    z,
    w,
    d,
    h,
    top: flat(at(g, 5)),
    left: ribs(3),
    right: ribs(2),
  });
  // Maceta esmaltada con una franja.
  const pot =
    (base: number): Shader =>
    (_u, v) =>
      at(C.mustard, Math.floor(v) === 3 ? base - 2 : base);
  return renderSprite(
    [
      { x: 4.5, y: 4.5, z: 0, w: 7, d: 7, h: 6, top: flat(at(C.dirt, 1)), left: pot(3), right: pot(2) },
      {
        x: 4,
        y: 4,
        z: 6,
        w: 8,
        d: 8,
        h: 2,
        top: (u, v, fw, fh) => (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? at(C.mustard, 4) : at(C.dirt, 1)),
        left: flat(at(C.mustard, 3)),
        right: flat(at(C.mustard, 2)),
      },
      stem(6.2, 6.2, 8, 4, 4, 19),
      stem(6.7, 6.7, 27, 3, 3, 1),
      // Brazo hacia +y (izquierda en pantalla).
      stem(7, 10, 16, 2.5, 3, 2.5),
      stem(7, 12.5, 16, 2.5, 2.5, 7),
      stem(7.4, 12.9, 23, 1.7, 1.7, 0.8),
      // Brazo hacia +x (derecha en pantalla).
      stem(10, 7, 12.5, 3, 2.5, 2.5),
      stem(12.5, 7, 12.5, 2.5, 2.5, 8),
      stem(12.9, 7.4, 20.5, 1.7, 1.7, 0.8),
    ],
    {
      outline: OUT,
      under: shadowUnder(4, 4, 8, 8),
      extra: (c, p) => {
        // Florcita rosada en la punta.
        const f = p(8.2, 8.2, 28.5);
        c.set(f.x - 1, f.y, at(C.rose, 4));
        c.set(f.x + 1, f.y, at(C.rose, 4));
        c.set(f.x, f.y - 1, at(C.rose, 5));
        c.set(f.x, f.y, at(C.gold, 5));
        c.set(f.x, f.y + 1, at(C.rose, 3));
      },
    },
  );
}

/** Hoja con forma de corazón alargado, nervadura y cortes (monstera), girada `ang` radianes. */
function splitLeaf(c: PixelCanvas, cx: number, cy: number, ang: number, ra: number, rb: number, r: Ramp, slits: boolean) {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const R = Math.ceil(Math.max(ra, rb)) + 1;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = dx * cos + dy * sin;
      const b = -dx * sin + dy * cos;
      // Base en corazón: se come un poco cerca del tallo.
      const e = (a / ra) ** 2 + (b / rb) ** 2;
      if (e > 1) continue;
      if (a < -ra * 0.65 && Math.abs(b) < rb * 0.35) continue;
      const side = Math.abs(b) / rb;
      let col: RGBA;
      if (Math.abs(b) < 0.5 && a > -ra * 0.8) col = at(r, 2);
      else if (slits && side > 0.42 && [-0.45, 0.05, 0.5].some((k) => Math.abs(a - k * ra - Math.abs(b) * 0.55) < 0.55)) col = at(r, 0);
      else if (e > 0.72) col = at(r, b < 0 ? 3 : 2);
      else col = at(r, b < 0 ? 4 : 3);
      c.set(x, y, col);
    }
}

function monstera(): Sprite {
  // Canasto tejido: cuadros alternados que imitan el tejido.
  const weave =
    (base: number): Shader =>
    (u, v, _fw, fh) => {
      if (v >= fh - 1.5) return at(C.cork, base + 1);
      return at(C.cork, (Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2 ? base : base - 1);
    };
  return renderSprite(
    [
      { x: 3.5, y: 3.5, z: 0, w: 9, d: 9, h: 9, top: flat(at(C.dirt, 1)), left: weave(3), right: weave(2) },
      {
        x: 3,
        y: 3,
        z: 9,
        w: 10,
        d: 10,
        h: 1.5,
        top: (u, v, fw, fh) => (u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? at(C.cork, 4) : at(C.dirt, 1)),
        left: flat(at(C.cork, 3)),
        right: flat(at(C.cork, 2)),
      },
      volume(-8, -8, 10, 32, 32, 34),
    ],
    {
      outline: OUT,
      under: shadowUnder(3, 3, 10, 10),
      extra: (c, p) => {
        const b = p(8, 8, 10.5);
        const deg = Math.PI / 180;
        // [dx, dy, ángulo hacia la punta, largo, ancho]: de atrás hacia adelante.
        const leaves: [number, number, number, number, number][] = [
          [-5, -26, 235, 6.5, 4.5],
          [6, -27, 300, 6.5, 4.5],
          [-11, -17, 200, 7, 5],
          [11, -18, 335, 7, 5],
          [0, -21, 275, 6, 4.5],
          [-10, -7, 165, 6.5, 4.5],
          [10, -8, 15, 6.5, 4.5],
          [1, -11, 95, 6, 4.5],
        ];
        for (const [dx, dy, a, ra] of leaves) {
          const bx = b.x + dx - Math.cos(a * deg) * ra * 0.8;
          const by = b.y + dy - Math.sin(a * deg) * ra * 0.8;
          c.line(b.x, b.y - 1, bx, by, at(C.green, 2));
          c.line(b.x + 1, b.y - 1, bx + 1, by, at(C.green, 1));
        }
        for (const [dx, dy, a, ra, rb] of leaves) {
          splitLeaf(c, b.x + dx + 1, b.y + dy + 1, a * deg, ra, rb, [at(C.green, 0), at(C.green, 0), at(C.green, 1), at(C.green, 1)], false);
          splitLeaf(c, b.x + dx, b.y + dy, a * deg, ra, rb, C.green, true);
        }
      },
    },
  );
}

function bonsai(): Sprite {
  return renderSprite(
    [
      // Mesita baja de exhibición.
      leg(2.5, 2.5, 5),
      leg(11.5, 2.5, 5),
      leg(2.5, 11.5, 5),
      leg(11.5, 11.5, 5),
      {
        x: 2,
        y: 2,
        z: 5,
        w: 12,
        d: 12,
        h: 1.5,
        top: (u) => at(C.woodDark, noise(Math.floor(u / 4), 0, 3) < 0.5 ? 4 : 5),
        left: flat(at(C.woodDark, 2)),
        right: flat(at(C.woodDark, 3)),
      },
      // Maceta esmaltada, baja y rectangular.
      { x: 4, y: 3.5, z: 6.5, w: 8, d: 9, h: 3, top: flat(at(C.blue, 4)), left: flat(at(C.blue, 3)), right: flat(at(C.blue, 2)) },
      {
        x: 4,
        y: 3.5,
        z: 9.5,
        w: 8,
        d: 9,
        h: 1,
        top: (u, v, fw, fh) => {
          if (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(C.blue, 4);
          const n = noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 12);
          return n < 0.45 ? at(MOSS, n < 0.2 ? 4 : 3) : at(C.dirt, 1);
        },
        left: flat(at(C.blue, 4)),
        right: flat(at(C.blue, 3)),
      },
      volume(-4, -4, 10, 24, 24, 22),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 12, 12),
      extra: (c, p) => {
        const b = p(8, 8, 10.5);
        // Tronco retorcido: de abajo hacia arriba, cada tramo con luz a la izquierda.
        const trunk: [number, number][] = [
          [0, 0],
          [-1, -3],
          [0, -6],
          [2, -8],
          [3, -11],
          [2, -14],
        ];
        for (let i = 0; i < trunk.length - 1; i++) {
          const [x0, y0] = trunk[i]!;
          const [x1, y1] = trunk[i + 1]!;
          const w = i < 2 ? 1 : 0;
          c.line(b.x + x0 - 1 - w, b.y + y0, b.x + x1 - 1 - w, b.y + y1, at(C.woodDark, 4));
          c.line(b.x + x0, b.y + y0, b.x + x1, b.y + y1, at(C.woodDark, 2));
          c.line(b.x + x0 + 1, b.y + y0, b.x + x1 + 1, b.y + y1, at(C.woodDark, 1));
        }
        c.line(b.x, b.y - 6, b.x - 6, b.y - 9, at(C.woodDark, 2));
        c.line(b.x + 2, b.y - 8, b.x + 7, b.y - 11, at(C.woodDark, 2));
        // Copas en nubes planas.
        const pads: [number, number, number, number][] = [
          [-7, -10, 5, 2.6],
          [7, -12, 5, 2.6],
          [-2, -14, 3.5, 2],
          [2, -17, 6, 3],
        ];
        for (const [dx, dy, rx, ry] of pads) c.ellipse(b.x + dx + 0.5, b.y + dy + 1.2, rx, ry, at(C.leaf, 1));
        for (const [dx, dy, rx, ry] of pads) c.ellipse(b.x + dx, b.y + dy, rx, ry, at(C.leaf, 2));
        for (const [dx, dy, rx, ry] of pads) c.ellipse(b.x + dx - 0.8, b.y + dy - 0.6, rx * 0.7, ry * 0.6, at(C.leaf, 3));
        for (const [dx, dy, rx] of pads)
          for (let k = 0; k < rx; k++) {
            const a = noise(k, dx, 4) * Math.PI * 2;
            const rr = noise(k, dy, 5) * rx * 0.7;
            c.set(b.x + dx + Math.cos(a) * rr, b.y + dy + Math.sin(a) * rr * 0.5, at(C.leaf, noise(k, 3, 6) < 0.5 ? 4 : 1));
          }
        // Piedrita en la maceta.
        const s = p(10, 11, 10.5);
        c.rect(s.x - 1, s.y - 1, 2, 1, at(C.stone, 4));
        c.set(s.x - 1, s.y, at(C.stone, 2));
        c.set(s.x, s.y, at(C.stone, 3));
      },
    },
  );
}

// ---------- Mesas, estantes y percheros ----------

function sideTable(): Sprite {
  const paint = C.sage;
  // Dos cajones con tirador dorado en el frente.
  const drawers: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v < 0.8 || v >= fh - 0.8) return at(paint, 2);
    if (Math.floor(v) === 4) return at(paint, 1);
    if (Math.abs(u - fw / 2) < 1 && (Math.floor(v) === 2 || Math.floor(v) === 6)) return at(C.gold, 4);
    return at(paint, 3);
  };
  return renderSprite(
    [
      leg(3.5, 3.5, 3),
      leg(10.5, 3.5, 3),
      leg(3.5, 10.5, 3),
      leg(10.5, 10.5, 3),
      {
        x: 3,
        y: 3,
        z: 3,
        w: 10,
        d: 10,
        h: 9,
        top: flat(at(paint, 4)),
        left: (u, v, fw, fh) => at(paint, u < 1 || u >= fw - 1 || v < 0.8 || v >= fh - 0.8 ? 3 : 4),
        right: drawers,
      },
      {
        x: 2,
        y: 2,
        z: 12,
        w: 12,
        d: 12,
        h: 1.5,
        top: (u, v, fw, fh) => (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(C.wood, 3) : at(C.wood, noise(Math.floor(u / 4), 1, 2) < 0.5 ? 4 : 5)),
        left: flat(at(C.wood, 2)),
        right: flat(at(C.wood, 3)),
      },
      // Un libro y la taza de tinto.
      { x: 3.5, y: 3.5, z: 13.5, w: 5, d: 6.5, h: 1.5, top: flat(at(C.fabric, 3)), left: flat(at(C.cream, 4)), right: flat(at(C.fabric, 2)) },
      {
        x: 8.5,
        y: 9,
        z: 13.5,
        w: 3,
        d: 3,
        h: 3,
        top: (u, v) => (u > 0.6 && u < 2.4 && v > 0.6 && v < 2.4 ? at(C.woodDark, 1) : at(C.cream, 5)),
        left: flat(at(C.cream, 4)),
        right: flat(at(C.cream, 3)),
      },
      volume(8.5, 9, 16.5, 3, 3, 6),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 12, 12),
      extra: (c, p) => {
        const h = p(11.5, 10.5, 15);
        c.set(h.x + 1, h.y, at(C.cream, 3));
        c.set(h.x + 1, h.y - 1, at(C.cream, 3));
        const s = p(10, 10.5, 17);
        c.set(s.x, s.y - 1, alpha(at(C.cream, 5), 0.8));
        c.set(s.x + 1, s.y - 3, alpha(at(C.cream, 5), 0.6));
        c.set(s.x, s.y - 5, alpha(at(C.cream, 5), 0.4));
      },
    },
  );
}

function coatRack(): Sprite {
  const wd = C.woodDark;
  const jacket = C.mustard;
  // Chaqueta colgada de frente (+x): hombros caídos, mangas a los lados, cuello, botones y bolsillos.
  const jacketFront: Shader = (u, v, fw, fh) => {
    const cu = u - fw / 2;
    if (v >= fh - 1.5 && Math.abs(cu) > 1.8) return null;
    const sleeve = Math.abs(cu) > 2.1;
    if (sleeve) {
      if (v < 3) return null;
      return v < 4 ? at(jacket, 1) : at(jacket, cu < 0 ? 3 : 2);
    }
    if (v >= fh - 3 && Math.abs(cu) < 1) return at(C.cream, 4);
    if (Math.abs(cu) < 0.4) return Math.floor(v) % 3 === 1 ? at(C.woodDark, 2) : at(jacket, 1);
    if (v < 0.8) return at(jacket, 1);
    if (v > 4 && v < 5.6 && Math.abs(Math.abs(cu) - 1.2) < 0.6) return at(jacket, 1);
    return at(jacket, cu < 0 ? 3 : 2);
  };
  return renderSprite(
    [
      // Patas en cruz.
      solidBox({ x: 7, y: 2, z: 0, w: 2, d: 12, h: 1.5 }, wd, 3),
      solidBox({ x: 2, y: 7, z: 0, w: 12, d: 2, h: 1.5 }, wd, 3),
      // Ganchos de atrás.
      solidBox({ x: 5, y: 7.5, z: 34, w: 2, d: 1, h: 1 }, C.gold, 3),
      solidBox({ x: 7.5, y: 5, z: 34, w: 1, d: 2, h: 1 }, C.gold, 3),
      solidBox({ x: 7, y: 7, z: 1.5, w: 2, d: 2, h: 39 }, wd, 4),
      // Ganchos de adelante.
      solidBox({ x: 9, y: 7.5, z: 34, w: 2, d: 1, h: 1 }, C.gold, 3),
      solidBox({ x: 7.5, y: 9, z: 34, w: 1, d: 2, h: 1 }, C.gold, 3),
      // Chaqueta colgada del gancho +x.
      {
        x: 9.5,
        y: 4.8,
        z: 18,
        w: 1.8,
        d: 6.4,
        h: 16,
        top: (_u, v) => (v >= 1.4 && v < 5 ? at(jacket, 4) : null),
        left: (_u, v) => (v < 3 ? null : at(jacket, 3)),
        right: jacketFront,
      },
      // Sombrero en la punta.
      solidBox({ x: 4.5, y: 4.5, z: 40.5, w: 7, d: 7, h: 1 }, C.woodDark, 4),
      {
        x: 6,
        y: 6,
        z: 41.5,
        w: 4,
        d: 4,
        h: 3,
        top: flat(at(C.woodDark, 5)),
        left: (_u, v) => (v < 1 ? at(C.rug, 3) : at(C.woodDark, 4)),
        right: (_u, v) => (v < 1 ? at(C.rug, 2) : at(C.woodDark, 3)),
      },
      // Paraguas cerrado apoyado del lado +y.
      ...slant([7.6, 13.6, 0], [7.8, 12.8, 4], 1, C.metal, 3),
      ...slant([7.8, 12.8, 4], [8, 10.2, 19], 2.4, C.fabric, 3),
      ...slant([8, 10.2, 19], [8, 9.8, 22], 1, C.woodDark, 4),
      shadowSpace(2, 2, 12, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 12, 12, 0.25),
      extra: (c, p) => {
        // Mango en J del paraguas.
        const m = p(8, 9.8, 22.5);
        c.set(m.x, m.y - 1, at(C.woodDark, 4));
        c.set(m.x - 1, m.y - 2, at(C.woodDark, 4));
        c.set(m.x - 2, m.y - 1, at(C.woodDark, 3));
        c.set(m.x - 2, m.y, at(C.woodDark, 3));
        // Pliegues del paraguas.
        for (let z = 6; z < 18; z += 3) {
          const q = p(7.9, 11.6 - (z - 6) * 0.1, z);
          c.set(q.x, q.y, at(C.fabric, 1));
        }
      },
    },
  );
}

function bookshelfLow(): Sprite {
  const w = C.wood;
  const books: Shader = (u, v, fw, fh) => {
    if (u < 1.5 || u >= fw - 1.5 || v >= fh - 1.5) return at(w, u < 1 || v >= fh - 0.8 ? 4 : 2);
    if (v < 1.5) return at(C.woodDark, 2);
    const s = v < 10.5 ? 0 : 1;
    const lv = s === 0 ? v - 1.5 : v - 10.5;
    if (s === 1 && lv < 1.2) return at(w, lv >= 0.6 ? 4 : 2);
    const room = s === 0 ? 9 : 8.7;
    const inner = s === 1 ? lv - 1.2 : lv;
    const col = Math.floor(u - 1.5);
    const off = Math.floor(noise(s, 2, 5) * 3);
    const id = Math.floor((col + off) / 2.5);
    const nb = noise(id, s, 21);
    const hb = 4.5 + Math.floor(noise(id, s, 14) * 3.5);
    // Un hueco con un libro caído en el estante de arriba.
    if (s === 1 && id >= 8 && id <= 9) return inner < 1.6 && id === 8 ? at(C.rug, 3) : at(C.woodDark, inner > room - 2 ? 0 : 1);
    if (nb > 0.08 && inner < hb) {
      const base = BOOKS[Math.floor(nb * BOOKS.length) % BOOKS.length]!;
      if (nb > 0.75 && Math.floor(inner) === hb - 2) return at(C.gold, 4);
      return (col + off) % 3 === 0 ? mix(base, at(C.white, 4), 0.22) : base;
    }
    return at(C.woodDark, inner > room - 2 ? 0 : 1);
  };
  return renderSprite(
    [
      {
        x: 0,
        y: 0,
        z: 0,
        w: 10,
        d: 32,
        h: 21,
        top: (u, v, fw, fh) => (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(w, 4) : at(w, noise(Math.floor(v / 6), 1, 3) < 0.5 ? 4 : 5)),
        left: (u, v, fw) => at(w, u >= fw - 1 ? 3 : v < 1.5 ? 1 : 2),
        right: books,
      },
      // Libros acostados y una matera con hiedra.
      { x: 2, y: 3, z: 21, w: 6, d: 7, h: 1.5, top: flat(at(C.fabric, 3)), left: flat(at(C.cream, 4)), right: flat(at(C.fabric, 2)) },
      { x: 2.5, y: 3.5, z: 22.5, w: 5, d: 6, h: 1.5, top: flat(at(C.rose, 4)), left: flat(at(C.cream, 5)), right: flat(at(C.rose, 3)) },
      { x: 2.5, y: 22, z: 21, w: 5, d: 5, h: 4, top: flat(at(C.dirt, 1)), left: flat(at(C.terracotta, 3)), right: flat(at(C.terracotta, 2)) },
      volume(0, 16, 24, 12, 16, 8),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 10, 32),
      extra: (c, p) => {
        const b = p(5, 24.5, 25);
        c.ellipse(b.x, b.y - 2, 4, 2.6, at(C.leaf, 2));
        c.ellipse(b.x - 1, b.y - 3, 2.6, 1.8, at(C.leaf, 3));
        c.set(b.x - 2, b.y - 4, at(C.leaf, 5));
        c.set(b.x + 1, b.y - 3, at(C.leaf, 4));
        // Hiedra que cae por el frente.
        const vines: [number, number, number][] = [
          [9.6, 22.5, 7],
          [9.6, 25.5, 10],
          [9.6, 27.5, 5],
        ];
        for (const [x, y, len] of vines) {
          const t = p(x, y, 21);
          c.line(b.x, b.y - 1, t.x, t.y, at(C.leaf, 2));
          for (let k = 0; k <= len; k++) {
            const q = { x: t.x + (k % 4 < 2 ? 0 : 1), y: t.y + k };
            c.set(q.x, q.y, at(C.leaf, 1));
            if (k % 2 === 0) {
              c.set(q.x - 1, q.y, at(C.leaf, 3));
              c.set(q.x + 1, q.y + 1, at(C.leaf, 4));
            }
          }
        }
      },
    },
  );
}

// ---------- Objetos ----------

function globe(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 4.5, y: 4.5, z: 0, w: 7, d: 7, h: 2 }, C.woodDark, 3),
      solidBox({ x: 7, y: 7, z: 2, w: 2, d: 2, h: 9 }, C.woodDark, 4),
      solidBox({ x: 6, y: 6, z: 10, w: 4, d: 4, h: 1.5 }, C.gold, 3),
      volume(-2, -2, 11, 20, 20, 22),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 5.5),
      extra: (c, p) => {
        const o = p(8, 8, 21);
        const R = 7.5;
        const tilt = 0.4;
        blob(c, o.x, o.y, R, R, (nx, ny, x, y) => {
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          // Eje inclinado: longitud y latitud del punto para las manchas de los continentes.
          const X = nx * Math.cos(tilt) + ny * Math.sin(tilt);
          const Y = -nx * Math.sin(tilt) + ny * Math.cos(tilt);
          const lon = Math.atan2(X, nz);
          const land = smoothNoise(lon * 2.2 + 20, Y * 2.4 + 20, 1, 7);
          const lit = nz * 0.7 - nx * 0.45 - ny * 0.55 + (bayer(x, y) - 0.5) * 0.35;
          const k = lit > 0.55 ? 1 : lit > 0.05 ? 0 : -1;
          if (Math.abs(Y) > 0.88) return at(C.white, 3 + k);
          if (land > 0.56) return at(land > 0.74 ? C.mustard : C.leaf, 3 + k);
          return at(C.blue, 3 + k);
        });
        c.set(o.x - 3, o.y - 4, at(C.white, 4));
        c.set(o.x - 4, o.y - 3, at(C.white, 3));
        // Meridiano: medio anillo dorado por la derecha, de polo a polo, siguiendo el eje.
        const ring = (phi: number, rr: number) => ({ x: o.x + Math.sin(tilt + phi) * rr, y: o.y - Math.cos(tilt + phi) * rr });
        for (let phi = 0; phi <= Math.PI; phi += 0.03) {
          const q = ring(phi, R + 1.6);
          c.set(q.x, q.y, at(C.gold, phi < Math.PI / 2 ? 4 : 3));
        }
        for (const phi of [0, Math.PI]) {
          const q = ring(phi, R + 0.6);
          c.set(q.x, q.y, at(C.gold, 5));
        }
        // Brazo que baja del polo sur al pie.
        const s = ring(Math.PI, R + 1.6);
        const f = p(8, 8, 11.5);
        c.line(s.x, s.y, f.x, f.y, at(C.gold, 3));
      },
    },
  );
}

function beanbag(variant: Variant): Sprite {
  const back = variant === "back";
  const r = LILAC;
  // El respaldo va del lado contrario a donde mira quien se sienta.
  const bx = back ? 10.5 : 5;
  const sx = back ? 6 : 10;
  return renderSprite([volume(0, 0, 0, 16, 16, 18)], {
    outline: OUT,
    under: roundShadow(8, 8, 7.5, 0.35),
    extra: (c, p) => {
      const body = p(8, 8, 3.5);
      blob(c, body.x, body.y, 10.5, 6.5, (nx, ny, x, y) => roundTone(r, nx, ny, x, y, 3, 1.3));
      // El respaldo sale del mismo saco: sin sombra abajo, para que no parezca otra bola.
      const rest = () => {
        const q = p(bx, 8, 8.5);
        blob(c, q.x, q.y, 7.5, 6.5, (nx, ny, x, y) => roundTone(r, nx, Math.min(ny, 0.15), x, y, 3, 1.4));
        for (let t = -0.9; t <= 0.9; t += 0.06) c.set(q.x + Math.sin(t) * 6, q.y - 2.5 + (1 - Math.cos(t)) * 3, at(r, 2));
      };
      // Hundido del asiento: sombra arriba y borde con luz abajo.
      const seat = () => {
        const s = p(sx, 8, 7);
        blob(c, s.x, s.y, 5.5, 2.8, (_nx, ny) => (ny < -0.2 ? at(r, 2) : ny > 0.55 ? at(r, 4) : at(r, 3)));
      };
      if (back) {
        seat();
        rest();
      } else {
        rest();
        seat();
      }
      // Brillo de la tela.
      const hl = p(back ? 3 : 12, 5, 5);
      c.set(hl.x, hl.y, at(r, 5));
      c.set(hl.x + 1, hl.y, at(r, 5));
      c.set(hl.x - 1, hl.y + 1, at(r, 4));
    },
  });
}

function lampMushroom(): Sprite {
  return renderSprite(
    [
      // Rodaja de tronco como base.
      {
        x: 4,
        y: 4,
        z: 0,
        w: 8,
        d: 8,
        h: 2,
        top: (u, v) => {
          const d = Math.hypot(u - 4, v - 4);
          return at(C.wood, d > 3.4 ? 2 : Math.floor(d) % 2 ? 4 : 5);
        },
        left: flat(at(C.logs, 2)),
        right: flat(at(C.logs, 1)),
      },
      {
        x: 6.5,
        y: 6.5,
        z: 2,
        w: 3,
        d: 3,
        h: 9,
        top: flat(at(C.cream, 5)),
        left: (_u, v) => at(C.cream, v > 7 ? 5 : 4),
        right: (_u, v) => at(C.cream, v > 7 ? 4 : 3),
      },
      volume(-2, -2, 9, 20, 20, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(4, 4, 8, 8),
      extra: (c, p) => {
        // Musgo y un hongo chiquito en la base.
        for (let k = 0; k < 7; k++) {
          const q = p(4.5 + noise(k, 1, 3) * 7, 4.5 + noise(k, 2, 3) * 7, 2);
          c.set(q.x, q.y, at(MOSS, 3 + (k % 2)));
        }
        const m = p(10.5, 11.5, 2);
        c.set(m.x, m.y - 1, at(C.cream, 4));
        c.set(m.x, m.y - 2, at(C.cream, 4));
        c.rect(m.x - 1, m.y - 3, 3, 1, at(C.rose, 3));
        c.set(m.x, m.y - 4, at(C.rose, 4));
        // Laminillas bajo el sombrero, encendidas.
        const g = p(8, 8, 11);
        c.ellipse(g.x, g.y, 8.5, 4, at(C.cream, 4));
        c.ellipse(g.x, g.y - 0.5, 6.5, 2.8, at(C.gold, 5));
        // Sombrero: domo arriba y el borde elíptico abajo.
        const o = p(8, 8, 12.5);
        const rx = 9;
        for (let y = Math.floor(o.y - 8); y <= Math.ceil(o.y + 4); y++)
          for (let x = Math.floor(o.x - rx); x <= Math.ceil(o.x + rx); x++) {
            const nx = (x + 0.5 - o.x) / rx;
            const dy = y + 0.5 - o.y;
            const ny = dy < 0 ? dy / 8 : dy / 4;
            if (nx * nx + ny * ny > 1) continue;
            const lit = -(nx * 0.5 + ny * 0.7) + (bayer(x, y) - 0.5) * 0.5;
            c.set(x, y, at(C.rose, lit > 0.45 ? 5 : lit > -0.1 ? 4 : 3));
          }
        // Pintas crema.
        for (const [dx, dy, s] of [
          [-4, -4, 1.4],
          [2, -6, 1.2],
          [5, -2, 1.3],
          [-1, -1, 1],
          [-6, 0, 0.9],
        ] as const)
          c.ellipse(o.x + dx, o.y + dy, s + 0.4, s, at(C.cream, 5));
        c.set(o.x - 3, o.y - 6, at(C.white, 4));
      },
    },
  );
}

function easel(): Sprite {
  // Paisaje a medio pintar: la mitad izquierda con color y la derecha con el boceto a lápiz.
  const painting: Shader = (u, v, fw, fh) => {
    if (u < 0.7 || u >= fw - 0.7 || v < 0.7 || v >= fh - 0.7) return at(C.cream, 2);
    const edge = 7.5 + Math.sin(v * 1.3) * 0.8 + noise(0, Math.floor(v), 4) * 0.8;
    const hill = 4.5 + Math.sin(u * 0.55 + 0.6) * 1.6;
    const sun = Math.hypot(u - 3, v - 10.5);
    if (u < edge) {
      if (sun < 1.8) return at(C.gold, 5);
      if (v < hill - 1.5) return at(C.leaf, 3);
      if (v < hill) return at(C.leaf, 4);
      if (Math.hypot(u - 6, (v - 8) * 2) < 1.4) return at(C.white, 4);
      return at(C.sky, v > 9 ? 2 : 3);
    }
    if (Math.abs(v - hill) < 0.5 || Math.abs(sun - 1.8) < 0.4) return at(C.cream, 1);
    return at(C.cream, 5);
  };
  return renderSprite(
    [
      // Pata trasera.
      ...slant([2.5, 8, 0], [7, 8, 31], 1.2, C.wood, 3),
      // Patas delanteras (detrás del lienzo, abiertas abajo).
      ...slant([10, 2.5, 0], [7.2, 6, 33], 1.2, C.wood, 3),
      ...slant([10, 13.5, 0], [7.2, 10, 33], 1.2, C.wood, 3),
      // Lienzo.
      { x: 8.4, y: 1.5, z: 13, w: 1, d: 13, h: 15, top: flat(at(C.cream, 3)), left: flat(at(C.cream, 3)), right: painting },
      // Repisa con pinceles y el sujetador de arriba.
      solidBox({ x: 8.4, y: 1, z: 11.5, w: 3, d: 14, h: 1.5 }, C.wood, 3),
      solidBox({ x: 7, y: 7, z: 27.5, w: 2.5, d: 2, h: 2 }, C.wood, 3),
      shadowSpace(2, 2, 11, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 11, 12, 0.22),
      extra: (c, p) => {
        // Paleta con manchas de pintura y un pincel en la repisa.
        const q = p(10.4, 3.5, 13);
        c.ellipse(q.x, q.y, 2.5, 1.2, at(C.wood, 5));
        c.set(q.x - 1, q.y, at(C.rug, 3));
        c.set(q.x, q.y - 1, at(C.sky, 1));
        c.set(q.x + 1, q.y, at(C.gold, 4));
        const a = p(10.5, 9, 13);
        const b = p(10.5, 12.5, 13);
        c.line(a.x, a.y, b.x, b.y, at(C.woodDark, 2));
        c.set(a.x, a.y, at(C.leaf, 3));
      },
    },
  );
}

function recordPlayer(): Sprite {
  // Mueble con vinilos en un lado y la rejilla del parlante en el otro.
  const front: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.wood, 3);
    if (Math.abs(u - 6.5) < 0.5) return at(C.wood, 2);
    if (u < 6) {
      const k = Math.floor(u - 0.8);
      const hb = 6.5 + noise(k, 0, 9) * 1.8;
      if (v < hb && k % 3 !== 2) return mix(BOOKS[k % BOOKS.length]!, at(C.cream, 4), k % 2 ? 0.2 : 0);
      return at(C.woodDark, 1);
    }
    return (Math.floor(u * 1.5) + Math.floor(v * 1.5)) % 2 ? at(C.cork, 1) : at(C.cork, 2);
  };
  const lid: Shader = (u, v) => (Math.abs(u - v * 0.9 - 2) < 0.6 ? alpha(at(C.white, 4), 0.55) : alpha(at(C.metal, 4), 0.3));
  return renderSprite(
    [
      leg(2.5, 2, 3),
      leg(11.5, 2, 3),
      leg(2.5, 12.5, 3),
      leg(11.5, 12.5, 3),
      { x: 2, y: 1.5, z: 3, w: 12, d: 13, h: 10, top: flat(at(C.wood, 4)), left: (u, _v, fw) => at(C.wood, u < 0.8 || u >= fw - 0.8 ? 3 : 2), right: front },
      { x: 3, y: 2.5, z: 13, w: 10, d: 11, h: 1.5, top: flat(at(C.cream, 4)), left: flat(at(C.cream, 3)), right: flat(at(C.cream, 2)) },
      // Tapa acrílica abierta.
      { x: 3, y: 2.5, z: 14.5, w: 0.8, d: 11, h: 9, top: lid, left: lid, right: lid },
      volume(0, 0, 14, 16, 16, 18),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 1.5, 12, 13),
      extra: (c, p) => {
        const o = p(8.2, 7.6, 14.5);
        c.ellipse(o.x, o.y, 6.2, 3.1, at(C.metal, 0));
        c.ellipse(o.x, o.y, 4.6, 2.3, at(C.metal, 1));
        c.ellipse(o.x, o.y, 3.6, 1.8, at(C.metal, 0));
        c.ellipse(o.x, o.y, 1.8, 0.9, at(C.rug, 3));
        c.set(o.x, o.y, at(C.cream, 5));
        c.set(o.x - 3, o.y - 1, at(C.metal, 3));
        // Brazo del tocadiscos.
        const pivot = p(11.8, 3.6, 14.5);
        const head = p(9.5, 5, 15);
        c.rect(pivot.x - 1, pivot.y - 1, 2, 2, at(C.white, 3));
        c.line(pivot.x, pivot.y - 1, head.x, head.y, at(C.white, 4));
        c.set(head.x, head.y + 1, at(C.metal, 2));
        c.set(head.x - 1, head.y, at(C.white, 2));
        // Notas musicales flotando.
        const n1 = p(12, 4, 24);
        c.rect(n1.x, n1.y, 2, 2, at(C.cream, 5));
        c.line(n1.x + 1, n1.y, n1.x + 1, n1.y - 4, at(C.cream, 5));
        c.set(n1.x + 2, n1.y - 4, at(C.cream, 5));
        c.set(n1.x + 3, n1.y - 3, at(C.cream, 5));
        const n2 = p(9, 1, 28);
        c.rect(n2.x, n2.y, 2, 2, at(C.gold, 5));
        c.line(n2.x + 1, n2.y, n2.x + 1, n2.y - 3, at(C.gold, 5));
        c.set(n2.x + 2, n2.y - 3, at(C.gold, 5));
      },
    },
  );
}

/** Silueta de guitarra en el plano de la cara +x (u a lo ancho, v hacia arriba); null = afuera. */
function guitarShape(u: number, v: number): "body" | "edge" | "hole" | "rosette" | "bridge" | "neck" | "fret" | "head" | "peg" | "string" | null {
  const uc = 5.4 + v * 0.07;
  const du = u - uc;
  const lower = Math.hypot(du, v - 6.5);
  const upper = Math.hypot(du, (v - 13.2) * 1.1);
  const waist = v > 6.5 && v < 13.2 ? 2.8 - Math.abs(du) : -1;
  // Qué tan adentro de la silueta está el punto (unión de las dos curvas y la cintura).
  const inside = Math.max(5 - lower, 3.9 - upper, waist);
  if (inside > 0) {
    const hole = Math.hypot(du, v - 10.8);
    if (hole < 1.4) return "hole";
    if (hole < 1.9) return "rosette";
    if (Math.abs(du) < 0.35 && v > 4.5) return "string";
    if (v > 4 && v < 5.2 && Math.abs(du) < 1.8) return "bridge";
    if (inside < 0.7) return "edge";
    return "body";
  }
  if (v >= 16 && v < 27 && Math.abs(du) < 1) return Math.abs(du) < 0.3 ? "string" : Math.floor(v) % 2 === 0 ? "fret" : "neck";
  if (v >= 27 && v < 31) {
    if (Math.abs(du) < 1.4) return "head";
    if (Math.abs(du) < 2 && Math.floor(v) % 2 === 1) return "peg";
  }
  return null;
}

function guitar(): Sprite {
  const face: Shader = (u, v) => {
    const s = guitarShape(u, v);
    if (!s) return null;
    const burst = Math.hypot(u - 5.4 - v * 0.07, v - 7.5);
    switch (s) {
      case "hole":
        return at(C.woodDark, 0);
      case "rosette":
        return at(C.cream, 3);
      case "string":
        return at(C.cream, 5);
      case "bridge":
        return at(C.woodDark, 1);
      case "edge":
        return at(C.woodDark, 1);
      case "body":
        // Acabado "sunburst": claro al centro y oscuro hacia el borde.
        return burst < 2.2 ? at(C.gold, 4) : burst < 3.4 ? at(C.wood, 4) : burst < 4.4 ? at(C.wood, 3) : at(C.wood, 2);
      case "neck":
        return at(C.woodDark, 3);
      case "fret":
        return at(C.metal, 4);
      case "head":
        return at(C.woodDark, 2);
      case "peg":
        return at(C.metal, 4);
    }
  };
  const rim: Shader = (u, v) => (guitarShape(u, v) ? at(C.woodDark, 2) : null);
  const stand = C.metal;
  return renderSprite(
    [
      solidBox({ x: 3, y: 3.5, z: 0, w: 8, d: 0.8, h: 0.8 }, stand, 2),
      solidBox({ x: 3, y: 11.7, z: 0, w: 8, d: 0.8, h: 0.8 }, stand, 2),
      solidBox({ x: 3.5, y: 4.3, z: 0, w: 0.8, d: 7.4, h: 0.8 }, stand, 2),
      solidBox({ x: 4, y: 7.6, z: 0.8, w: 0.8, d: 0.8, h: 22.5 }, stand, 1),
      solidBox({ x: 4, y: 6.5, z: 23, w: 3, d: 3, h: 0.8 }, stand, 2),
      // Guitarra: canto oscuro detrás y la tapa adelante.
      { x: 6, y: 1.5, z: 1, w: 1.5, d: 12, h: 31, right: rim },
      { x: 7.5, y: 1.5, z: 1, w: 1.5, d: 12, h: 31, right: face },
      // Brazos del soporte que sostienen la caja.
      solidBox({ x: 8.8, y: 3.5, z: 0.8, w: 1.5, d: 0.8, h: 2.5 }, stand, 2),
      solidBox({ x: 8.8, y: 11.7, z: 0.8, w: 1.5, d: 0.8, h: 2.5 }, stand, 2),
      shadowSpace(3, 3, 9, 10),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 9, 10, 0.25) },
  );
}

function catBed(): Sprite {
  const bed = C.fabric;
  return renderSprite([volume(0, 0, 0, 16, 16, 20)], {
    outline: OUT,
    under: roundShadow(8, 8, 7.2, 0.35),
    extra: (c, p) => {
      const o = p(8, 8, 0);
      const RX = 10;
      const RY = 5;
      // Costado del cojín redondo, y el borde de arriba con luz.
      for (let z = 0; z <= 4; z++) c.ellipse(o.x, o.y - z, RX, RY, at(bed, z < 2 ? 1 : 2));
      blob(c, o.x, o.y - 5, RX, RY, (nx, ny) => at(bed, ny < -0.3 ? 4 : nx < -0.5 ? 4 : 3));
      c.ellipse(o.x, o.y - 5, RX - 2.5, RY - 1.4, at(bed, 2));
      c.ellipse(o.x + 0.3, o.y - 4.3, RX - 3.2, RY - 1.9, at(C.cream, 3));
      // Gato enroscado durmiendo.
      const g = GINGER;
      const bx = o.x + 1;
      const by = o.y - 6.5;
      blob(c, bx, by + 1, 6, 3.4, () => at(g, 1));
      blob(c, bx, by, 6, 3.5, (nx, ny, x, y) => {
        const stripe = mod(Math.floor(nx * 6 - ny * 1.5), 3) === 0 && ny < 0.5;
        return stripe ? at(g, 2) : roundTone(g, nx, ny, x, y, 3, 1.4);
      });
      // Cola que da la vuelta por delante.
      const tail: [number, number][] = [
        [5, 1],
        [4, 2.5],
        [2, 3.2],
        [-1, 3.3],
        [-3, 2.8],
      ];
      for (let i = 0; i < tail.length - 1; i++) {
        const [x0, y0] = tail[i]!;
        const [x1, y1] = tail[i + 1]!;
        c.line(bx + x0, by + y0, bx + x1, by + y1, at(g, 3));
        c.line(bx + x0, by + y0 + 1, bx + x1, by + y1 + 1, at(g, 2));
      }
      c.set(bx - 3, by + 2.8, at(g, 5));
      c.set(bx - 4, by + 2.8, at(g, 5));
      // Cabeza apoyada con orejas, ojos cerrados y naricita.
      const hx = bx - 4.5;
      const hy = by - 0.5;
      blob(c, hx, hy, 3.2, 2.8, (nx, ny, x, y) => roundTone(g, nx, ny, x, y, 3, 1.2));
      for (const s of [-1, 1]) {
        const ex = hx + s * 1.8;
        c.set(ex, hy - 3, at(g, 3));
        c.set(ex, hy - 4, at(g, 4));
        c.set(ex - s, hy - 3, at(g, 4));
        c.set(ex, hy - 2.5, at(C.rose, 4));
      }
      c.set(hx - 2, hy, at(g, 0));
      c.set(hx - 1, hy + 0.5, at(g, 0));
      c.set(hx + 1, hy + 0.5, at(g, 0));
      c.set(hx + 2, hy, at(g, 0));
      c.set(hx, hy + 1.5, at(C.rose, 3));
      c.set(hx - 1, hy + 1.8, at(g, 5));
      c.set(hx + 1, hy + 1.8, at(g, 5));
      // Burbuja de sueño en la nariz (simétrica: el dibujo se voltea para "down"/"up", unas "zzz" quedarían al revés).
      const sx = Math.round(hx - 4);
      const sy = Math.round(hy - 3.5);
      for (const [dx, dy] of [
        [0, -1],
        [1, -1],
        [-1, 0],
        [2, 0],
        [-1, 1],
        [2, 1],
        [0, 2],
        [1, 2],
      ] as const)
        c.set(sx + dx, sy + dy, alpha(at(C.sky, 4), 0.9));
      c.set(sx, sy, alpha(at(C.white, 4), 0.95));
      c.set(sx + 1, sy + 1, alpha(at(C.sky, 3), 0.5));
      c.set(sx, sy + 1, alpha(at(C.sky, 4), 0.4));
      c.set(sx + 1, sy, alpha(at(C.sky, 4), 0.4));
    },
  });
}

// ---------- Tele, pecera y piano ----------

/** Pantalla de la tele: un jueguito de plataformas con líneas de barrido y reflejo. */
const gameScreen = (u: number, v: number, fw: number, fh: number): RGBA => {
  const scan = Math.floor(v * 2) % 2 === 0;
  let c: RGBA;
  if (Math.abs(u - (fw - 2.2) - (v - fh + 1.5) * 0.6) < 0.4 && v > fh - 4) c = at(C.white, 4);
  else if (v < 1.6) c = (Math.floor(u) + (v < 0.8 ? 1 : 0)) % 2 ? at(C.terracotta, 3) : at(C.terracotta, 4);
  else if (v < 2.4) c = at(C.grass, 4);
  else if (u >= 2 && u < 3.2 && v < 4.6) c = v > 3.8 ? at(C.rose, 5) : at(C.rug, 3);
  else if (Math.hypot(u - 5.8, v - 5.5) < 0.9) c = at(C.gold, 5);
  else if (u >= 5 && u < 8 && v >= 2.4 && v < 3.6 && Math.floor(u) % 3 !== 2) c = at(C.leaf, 3);
  else if (Math.hypot((u - 2.6) * 0.55, v - fh + 1.8) < 0.8) c = at(C.white, 4);
  else c = at(C.sky, 1 + (v > fh * 0.6 ? 1 : 0));
  return scan ? c : mix(c, at(C.screen, 0), 0.18);
};

function tvRetro(variant: Variant): Sprite {
  const back = variant === "back";
  const grain =
    (base: number): Shader =>
    (u, v) =>
      at(C.wood, Math.floor(v) % 3 === 0 && noise(Math.floor(u / 3), Math.floor(v), 6) < 0.6 ? base - 1 : base);
  // Frente: pantalla a la izquierda y perillas a la derecha. Atrás: tapa con rejillas.
  const frontFace: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.wood, 3);
    const su = u - 1.3;
    const sv = v - 1.8;
    const sw = 8.4;
    const sh = fh - 3.4;
    const corner = (su < 0.7 || su > sw - 0.7) && (sv < 0.7 || sv > sh - 0.7);
    if (su >= 0 && su < sw && sv >= 0 && sv < sh && !corner) return gameScreen(su, sv, sw, sh);
    if (u >= 10.2) {
      if (Math.hypot(u - 11.3, v - 9.5) < 0.9 || Math.hypot(u - 11.3, v - 7) < 0.9) return at(C.metal, 4);
      if (v < 5 && v > 1.5 && Math.floor(v) % 2 === 1) return at(C.woodDark, 1);
      return at(C.cream, 3);
    }
    return at(C.metal, 1);
  };
  const backFace: Shader = (u, v, fw, fh) => {
    if (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8) return at(C.wood, 2);
    if (v > fh - 4 && v < fh - 1.5 && u > 3 && u < fw - 3 && Math.floor(u) % 2 === 0) return at(C.woodDark, 0);
    if (u > 1.8 && u < 4.2 && v > 1.8 && v < 3.4) return at(C.cream, 4);
    return at(C.woodDark, 2);
  };
  const standFront: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v < 0.8 || v >= fh - 1) return at(C.woodDark, 3);
    if (!back && u > 3 && u < fw - 3) {
      const k = Math.floor(u - 3);
      if (v < 4.5 && k % 2 === 0) return [at(C.rug, 3), at(C.sky, 2), at(C.mustard, 3), at(C.leaf, 3), at(C.rose, 4)][(k / 2) % 5]!;
      return at(C.woodDark, 0);
    }
    return at(C.woodDark, Math.abs(u - fw / 2) < 0.5 ? 2 : 4);
  };
  const tvX = back ? 4 : 3;
  const tv: Box = { x: tvX, y: 1.5, z: 6, w: 9, d: 13, h: 13, top: grain(5), left: grain(4), right: back ? backFace : frontFace };
  // Joroba del tubo de rayos catódicos (atrás de la tele).
  const hump: Box = back
    ? { x: 13, y: 4, z: 8, w: 2, d: 8, h: 9, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: (_u, v) => at(C.metal, Math.floor(v) % 2 ? 1 : 2) }
    : solidBox({ x: 1, y: 4, z: 8, w: 2, d: 8, h: 9 }, C.metal, 2);
  const console: Box = {
    x: back ? 1 : 12.3,
    y: 1.3,
    z: 6,
    w: 2.6,
    d: 4,
    h: 1.6,
    top: (u, v) => (u > 0.8 && u < 1.8 && v > 2.4 && v < 3.4 ? at(C.rug, 3) : at(C.stone, 4)),
    left: flat(at(C.stone, 3)),
    right: (_u, v) => (Math.floor(v) === 1 ? at(C.stone, 1) : at(C.stone, 2)),
  };
  const pad: Box = { x: 12.6, y: 6, z: 6, w: 2, d: 2.8, h: 0.8, top: (u, v) => (u < 1 && v > 1.6 ? at(C.rug, 4) : at(C.metal, 2)), left: flat(at(C.metal, 1)), right: flat(at(C.metal, 1)) };
  const stand: Box = { x: 1, y: 1, z: 0, w: 14.5, d: 14, h: 6, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 3)), right: standFront };
  const boxes = back ? [stand, console, tv, hump] : [stand, hump, tv, console, pad];
  return renderSprite([...boxes, volume(2, 2, 19, 12, 12, 10)], {
    outline: OUT,
    under: shadowUnder(1, 1, 14, 14),
    extra: (c, p) => {
      // Antena de conejo.
      const base = p(tvX + 4.5, 8, 19);
      c.set(base.x, base.y, at(C.metal, 2));
      c.set(base.x + 1, base.y, at(C.metal, 2));
      c.line(base.x, base.y - 1, base.x - 5, base.y - 9, at(C.metal, 4));
      c.line(base.x + 1, base.y - 1, base.x + 6, base.y - 8, at(C.metal, 4));
      c.set(base.x - 5, base.y - 10, at(C.rug, 4));
      c.set(base.x + 6, base.y - 9, at(C.rug, 4));
      if (!back) {
        // Cable del control a la consola.
        const a = p(13.6, 6, 6.4);
        const b = p(13.6, 5.3, 6.4);
        c.line(a.x, a.y, b.x, b.y, at(C.metal, 0));
      }
    },
  });
}

function aquarium(): Sprite {
  const water: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(C.screen, 5);
    if (mod(u * 0.8 + v, 9) < 1.1) return at(C.screen, 4);
    return at(C.screen, v < fh * 0.35 ? 2 : 3);
  };
  // Arena vista a través del agua: más teñida desde arriba que por el vidrio del frente.
  const sand =
    (tint: number): Shader =>
    (u, v) => {
      const n = noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 17);
      const c = n < 0.06 ? at(C.rug, 4) : n < 0.12 ? at(C.stone, 4) : at(C.cream, n < 0.5 ? 3 : 4);
      return mix(c, at(C.screen, 3), tint);
    };
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 0.7 || u >= fw - 0.7 || v < 0.7 || v >= fh - 0.7) return at(C.metal, 1);
    if (Math.abs(u - v * 0.9 - 3) < 0.5 || Math.abs(u - v * 0.9 - 5) < 0.3) return alpha(at(C.white, 4), 0.5);
    return alpha(at(C.sky, 4), 0.12);
  };
  const rim: Shader = (u, v, fw, fh) => (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8 ? at(C.metal, 2) : null);
  const doors: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1 || v < 0.8 || v >= fh - 0.8) return at(C.woodDark, 3);
    if (Math.abs(u - fw / 2) < 0.5) return at(C.woodDark, 2);
    if (Math.abs(Math.abs(u - fw / 2) - 1.5) < 0.6 && Math.abs(v - 5) < 0.6) return at(C.gold, 4);
    return at(C.woodDark, u < fw / 2 ? 4 : 3);
  };
  return renderSprite(
    [
      { x: 1, y: 1, z: 0, w: 14, d: 30, h: 10, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 3)), right: doors },
      { x: 2, y: 2, z: 10, w: 12, d: 28, h: 13.5, top: (u, v) => (noise(Math.floor(u / 2), Math.floor(v), 8) < 0.12 ? at(C.screen, 5) : at(C.screen, 4)), left: water, right: water },
      { x: 2, y: 2, z: 10, w: 12, d: 28, h: 2.5, top: sand(0.4), left: sand(0.18), right: sand(0.18) },
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 14, 30),
      extra: (c, p) => {
        // Algas que se mecen.
        const weeds: [number, number, number, number][] = [
          [4, 5, 9, 0],
          [4, 9, 7, 1],
          [4, 24, 10, 2],
          [5, 27, 6, 3],
          [11, 3.5, 5, 4],
        ];
        for (const [x, y, h, s] of weeds) {
          const b = p(x, y, 12.5);
          for (let k = 0; k < h; k++) {
            const dx = Math.round(Math.sin(k * 0.7 + s) * 0.9);
            c.set(b.x + dx, b.y - k, at(C.leaf, k % 3 === 0 ? 4 : 3));
            if (k % 3 === 1) c.set(b.x + dx + (s % 2 ? 1 : -1), b.y - k, at(C.leaf, 2));
          }
        }
        // Peces de colores: [x, y, z, hacia la derecha, color].
        const fish: [number, number, number, boolean, Ramp][] = [
          [9, 8, 18, true, C.fire],
          [8, 19, 20.5, false, C.gold],
          [10, 25, 16.5, true, C.rug],
          [7, 13, 15.5, false, C.fabric],
          [9, 29, 19.5, true, C.fire],
        ];
        for (const [x, y, z, right, r] of fish) {
          const q = p(x, y, z);
          const s = right ? 1 : -1;
          c.rect(q.x - 1, q.y - 1, 3, 2, at(r, 3));
          c.set(q.x - s * 2, q.y - 1, at(r, 3));
          c.set(q.x - s * 2, q.y, at(r, 2));
          c.set(q.x - s * 3, q.y - 2, at(r, 4));
          c.set(q.x - s * 3, q.y + 1, at(r, 4));
          c.set(q.x + s, q.y - 1, at(C.metal, 0));
          c.set(q.x, q.y - 2, at(r, 4));
        }
        // Burbujas.
        for (let k = 0; k < 5; k++) {
          const q = p(4, 4, 13 + k * 2.2);
          c.set(q.x + (k % 2), q.y, alpha(at(C.white, 4), 0.8));
        }
      },
      overlay: [
        // Piedras y un cofre en el fondo.
        solidBox({ x: 9.5, y: 5, z: 12.5, w: 3, d: 4, h: 2.5 }, C.stone, 3),
        solidBox({ x: 10, y: 21, z: 12.5, w: 2.5, d: 3, h: 1.5 }, C.stone, 4),
        {
          x: 10,
          y: 14,
          z: 12.5,
          w: 2.5,
          d: 3.5,
          h: 2.2,
          top: flat(at(C.wood, 4)),
          left: flat(at(C.wood, 3)),
          right: (u, v, fw) => (Math.abs(u - fw / 2) < 0.5 && v < 1.4 ? at(C.gold, 5) : Math.floor(v) === 1 ? at(C.gold, 3) : at(C.wood, 2)),
        },
        { x: 2, y: 2, z: 10, w: 12, d: 28, h: 15, top: rim, left: glass, right: glass },
      ],
    },
  );
}

function piano(variant: Variant): Sprite {
  const back = variant === "back";
  // En la variante de espaldas todo se refleja en x: el teclado queda del lado -x.
  const X = (x: number, w: number) => (back ? 16 - x - w : x);
  const wd = C.woodDark;
  const frontPanel: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1) return at(wd, 4);
    if (v < 1) return at(wd, 1);
    // Pedales dorados.
    if (v < 2.5 && Math.abs(u - fw / 2) < 3 && Math.floor(u) % 2 === 0) return at(C.gold, 4);
    const inset = (u0: number, u1: number, v0: number, v1: number) => {
      if (u < u0 || u >= u1 || v < v0 || v >= v1) return null;
      if (u < u0 + 0.8 || v >= v1 - 0.8) return at(wd, 1);
      if (u >= u1 - 0.8 || v < v0 + 0.8) return at(wd, 4);
      return at(wd, 3);
    };
    const panel = inset(2.5, 13.5, 3.5, 12) ?? inset(16.5, 27.5, 3.5, 12) ?? inset(3, 27, 19, 28);
    if (panel) return panel;
    if (Math.abs(v - 23.5) < 0.6 && (Math.abs(u - 1.8) < 0.6 || Math.abs(u - fw + 1.8) < 0.6)) return at(C.gold, 5);
    return at(wd, 2);
  };
  // Atrás: tablas con travesaños.
  const backPanel: Shader = (u, v, _fw, fh) => {
    if (v >= fh - 1) return at(wd, 4);
    if ([2, 10, 20, 28].some((k) => Math.abs(u - k) < 1)) return at(wd, 3);
    if (Math.abs(v - 15) < 0.8) return at(wd, 3);
    return at(wd, Math.floor(u) % 4 === 0 ? 1 : 2);
  };
  const keys: Shader = (u, v, fw) => {
    const blackSide = back ? u > fw - 2.8 : u < 2.8;
    const front = back ? u < 0.6 : u > fw - 0.6;
    if (front) return at(C.cream, 3);
    const k = Math.floor(v / 2);
    const kv = v - k * 2;
    if (blackSide && kv > 1.3 && [0, 1, 3, 4, 5].includes(mod(k, 7))) return at(C.metal, 0);
    if (blackSide && kv < 0.7 && k > 0 && [0, 1, 3, 4, 5].includes(mod(k - 1, 7))) return at(C.metal, 0);
    return kv < 0.35 ? at(C.cream, 2) : at(C.cream, 5);
  };
  const sheet: Shader = (u, v, fw) => {
    if (Math.abs(u - fw / 2) < 0.4) return at(C.cream, 2);
    if (v > 1.5 && v < 6 && Math.floor(v * 2) % 2 === 0 && u > 1 && u < fw - 1 && Math.abs(u - fw / 2) > 1) return at(C.cream, 2);
    if (noise(Math.floor(u), Math.floor(v * 2), 31) < 0.12 && v > 1.5 && v < 6) return at(C.metal, 1);
    return at(C.cream, 5);
  };
  const body: Box = { x: X(1, 8), y: 1, z: 0, w: 8, d: 30, h: 30, top: flat(at(wd, 4)), left: (_u, v) => at(wd, v >= 29 ? 4 : 2), right: back ? backPanel : frontPanel };
  const keyboard: Box = { x: X(9, 5), y: 2, z: 14, w: 5, d: 28, h: 2.5, top: keys, left: flat(at(wd, 2)), right: flat(at(wd, 2)) };
  const cheek = (y: number) => solidBox({ x: X(9, 5), y, z: 13, w: 5, d: 1.2, h: 4.5 }, wd, 3);
  const post = (y: number) => solidBox({ x: X(11, 2), y, z: 0, w: 2, d: 2, h: 13 }, wd, 4);
  const stand: Box = { x: X(8.2, 1), y: 9, z: 21, w: 1, d: 14, h: 7, top: flat(at(C.cream, 4)), left: flat(at(C.cream, 3)), right: sheet };
  // Metrónomo y un retrato encima.
  const top: Box[] = [
    solidBox({ x: X(3, 4), y: 4, z: 30, w: 4, d: 4, h: 2 }, C.wood, 3),
    solidBox({ x: X(3.5, 3), y: 4.5, z: 32, w: 3, d: 3, h: 2 }, C.wood, 3),
    solidBox({ x: X(4, 2), y: 5, z: 34, w: 2, d: 2, h: 2 }, C.wood, 4),
    {
      x: X(3.5, 1),
      y: 22,
      z: 30,
      w: 1,
      d: 5,
      h: 5,
      top: flat(at(C.gold, 4)),
      left: flat(at(C.gold, 3)),
      right: (u, v, fw, fh) => (u < 0.8 || u >= fw - 0.8 || v < 0.8 || v >= fh - 0.8 ? at(C.gold, 4) : v < 2 ? at(C.leaf, 3) : at(C.sky, 3)),
    },
  ];
  const keysSide = [cheek(1), post(2.5), keyboard, post(27.5), cheek(29.8)];
  const parts = back ? [...keysSide, stand, body, ...top] : [body, stand, ...keysSide, ...top];
  return renderSprite([...parts, shadowSpace(1, 1, 14, 30)], {
    outline: OUT,
    under: shadowUnder(1, 1, 14, 30),
    extra: (c, p) => {
      // Péndulo del metrónomo.
      const m = p(X(4, 2) + 2.1, 6, 31);
      c.line(m.x, m.y, m.x + 1, m.y - 5, at(C.gold, 5));
    },
  });
}

// ---------- Alfombras ----------

/** Alfombra trenzada redonda: anillos de colores con puntadas en diagonal. */
function rugRound(): Sprite {
  const RINGS = [C.rug, C.cream, C.sage, C.mustard, C.rose, C.cream, C.fabric];
  const R = 15.5;
  const disc =
    (under: boolean): Shader =>
    (u, v) => {
      const du = u - 15.5;
      const dv = v - 15.5;
      const r = Math.hypot(du, dv);
      if (r > R) return null;
      if (under) return at(C.rug, 0);
      if (r > R - 1) return at(C.rug, 1);
      if (r < 2.2) return at(C.gold, (Math.floor(u) + Math.floor(v)) % 2 ? 4 : 5);
      const depth = R - 1 - r;
      const band = Math.floor(depth / 2.2);
      const inBand = depth - band * 2.2;
      const ring = RINGS[band % RINGS.length]!;
      const s = Math.floor((Math.atan2(dv, du) * r) / 1.4);
      const stitch = mod(s + (inBand < 1.1 ? 0 : 1), 2) === 0;
      return at(ring, stitch ? 3 : 4);
    };
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 31, d: 31, h: 0, top: disc(true) },
      { x: 0, y: 0, z: 1, w: 31, d: 31, h: 0, top: disc(false) },
    ],
    { outline: OUT },
  );
}

/** Alfombra de rayas de feria: franjas simétricas desde las puntas, zigzag en las anchas y flecos. */
function rugStripes(): Sprite {
  // [rampa, ancho, con zigzag], desde la punta hacia el centro.
  const STRIPES: [Ramp, number, boolean][] = [
    [C.rug, 4, false],
    [C.cream, 1, false],
    [C.mustard, 2, false],
    [C.sage, 4, true],
    [C.cream, 1, false],
    [C.fabric, 2, false],
    [C.rose, 3, false],
    [C.mustard, 5, true],
  ];
  const woven: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1) return at(C.rug, u < 0.5 || u >= fw - 0.5 ? 1 : 2);
    const m = Math.min(v, fh - v);
    let acc = 0;
    for (const [r, w, zig] of STRIPES) {
      if (m < acc + w || acc + w >= fh / 2) {
        const t = m - acc;
        if (zig) {
          const z = Math.abs(mod(u, 4) - 2) * 0.6;
          if (Math.abs(t - w / 2 - z + 0.6) < 0.55) return at(C.cream, 5);
        }
        return at(r, bayer(Math.floor(u), Math.floor(v)) < 0.18 ? 2 : 3);
      }
      acc += w;
    }
    return at(C.mustard, 3);
  };
  const fringe: Shader = (u, _v, fw) => (u > 1 && u < fw - 1 && Math.floor(u) % 2 === 0 ? at(C.cream, 4) : null);
  return renderSprite(
    [
      { x: 0.5, y: 0.2, z: 0, w: 31, d: 2, h: 0, top: fringe },
      { x: 0.5, y: 2, z: 0, w: 31, d: 44, h: 1, top: woven, left: flat(at(C.rug, 0)), right: flat(at(C.rug, 0)) },
      { x: 0.5, y: 46, z: 0, w: 31, d: 1.8, h: 0, top: fringe },
    ],
    { outline: OUT },
  );
}

/** Dibujos de los muebles de decoración, por tipo del catálogo. */
export const DECOR: Record<string, (v: Variant) => Sprite> = {
  cactus,
  "side-table": sideTable,
  "coat-rack": coatRack,
  monstera,
  "rug-round": rugRound,
  "rug-stripes": rugStripes,
  "bookshelf-low": bookshelfLow,
  globe,
  beanbag,
  "lamp-mushroom": lampMushroom,
  easel,
  bonsai,
  "record-player": recordPlayer,
  guitar,
  "cat-bed": catBed,
  "tv-retro": tvRetro,
  aquarium,
  piano,
};
