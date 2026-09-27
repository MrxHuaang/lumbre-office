// Los interiores rediseñados de la planta baja y los pisos 2 y 3: biblioteca, salas, cocina, cafetería,
// recibidor, baños, oficinas, balcón y terraza. Mismo estilo que furniture.ts: cajas con shaders por
// cara, contorno café y la luz desde arriba a la izquierda; mirando hacia +x ("front") y, si el catálogo
// dice hasBack, de espaldas ("back").
//
// Recordatorio de las caras: en `right` (la cara +x, el frente) `u` corre de izquierda a derecha en
// pantalla y `v` de abajo hacia arriba; en `left` (la cara +y) igual. En `top`, (u, v) = (x, y) locales.
import { BOOKS, C, OUT, mix } from "./palette";
import { alpha, at, bayer, flat, hex, noise, ramp, renderSprite, solidBox, type Box, type PixelCanvas, type Project, type Ramp, type RGBA, type Shader, type Sprite } from "./pixel";
import { blob, cushion, leg, roundShadow, roundTone, shadowSpace, shadowUnder, slant, volume, type Variant } from "./kit";

const LEATHER: Ramp = ramp("#2a150e", "#472414", "#6a3820", "#8c512f", "#ab6c43", "#c78b5c");
const MINT: Ramp = ramp("#2a4741", "#3d675d", "#578d80", "#7cb09f", "#a6d0bf", "#d4eee2");
const PORCELAIN: Ramp = ramp("#8d8f9d", "#b5b8c4", "#d6d9e1", "#eceef3", "#fbfcfe");
const PLAID = [C.rug, C.cream, C.green, C.mustard];

const mod = (n: number, m: number) => ((n % m) + m) % m;
const edgeOf = (u: number, v: number, fw: number, fh: number) => Math.min(u, v, fw - u, fh - v);

// ---------- Piezas comunes ----------

/** Tapa de madera con veta y el borde más claro. */
const woodTop =
  (r: Ramp, grain = 6, along: "u" | "v" = "v"): Shader =>
  (u, v, fw, fh) => {
    if (u < 0.8 || v < 0.8 || u >= fw - 0.8 || v >= fh - 0.8) return at(r, 4);
    const k = Math.floor((along === "v" ? v : u) / grain);
    return at(r, noise(k, 3, 11) < 0.5 ? 4 : 5);
  };

/** Frente de puertas con moldura y tirador de bronce (aparadores, muebles de cocina). */
function doorsFace(r: Ramp, every: number, opts: { base?: number; top?: number; knob?: "center" | "top"; drawers?: number } = {}): Shader {
  const base = opts.base ?? 1.5;
  const top = opts.top ?? 1;
  return (u, v, fw, fh) => {
    if (v < base) return at(C.woodDark, v < base - 0.7 ? 0 : 2);
    if (v >= fh - top) return at(r, 4);
    const n = Math.max(1, Math.round(fw / every));
    const pw = fw / n;
    const pu = mod(u, pw);
    const inner = fh - base - top;
    const drawers = opts.drawers ?? 0;
    const dh = drawers ? Math.min(4.5, inner / (drawers + 1)) : 0;
    const pv = v - base;
    // Cajones arriba (si hay), con su tirador en el medio.
    if (drawers && pv >= inner - dh * drawers) {
      const dv = mod(inner - pv, dh);
      if (dv < 0.7) return at(r, 1);
      if (Math.abs(pu - pw / 2) < 1 && Math.abs(dv - dh / 2) < 0.7) return at(C.gold, 4);
      return at(r, dv < 1.4 ? 4 : 3);
    }
    const ih = inner - dh * drawers;
    if (pu < 0.8 || pu >= pw - 0.8 || pv < 0.8 || pv >= ih - 0.8) return at(r, 1);
    if (pu < 1.7 || pv >= ih - 1.7) return at(r, 4);
    if (pu >= pw - 1.7 || pv < 1.7) return at(r, 2);
    const ky = opts.knob === "top" ? ih - 3 : ih / 2;
    const kx = mod(Math.floor(u / pw), 2) === 0 ? pw - 2.6 : 2.6;
    if (Math.abs(pu - kx) < 0.7 && Math.abs(pv - ky) < 0.8) return at(C.gold, 5);
    return at(r, 3);
  };
}

/**
 * Lomo de libros para un estante: ancho, alto y color salen de `seed`; algunos llevan bandas doradas y
 * de vez en cuando hay un hueco, un libro inclinado o una pila acostada. `u` es la posición a lo largo del
 * estante y `y` la altura sobre la tabla; devuelve null donde se ve el fondo.
 */
function bookAt(u: number, y: number, room: number, seed: number): RGBA | null {
  let x = 0;
  let i = 0;
  while (x <= u) {
    const n = noise(i, seed, 19);
    const w = 1.6 + Math.floor(noise(i, seed, 7) * 3) * 0.6;
    if (u < x + w) {
      const h = Math.min(room - 0.6, room * (0.55 + noise(i, seed, 3) * 0.4));
      if (n < 0.07) return null; // hueco
      if (n > 0.93) {
        // Pila de libros acostados.
        const layer = Math.floor(y / 1.3);
        if (layer > 2) return null;
        const col = BOOKS[(i + layer * 3) % BOOKS.length]!;
        return mod(y, 1.3) < 0.35 ? at(C.cream, 4) : col;
      }
      if (y >= h) return null;
      const base = BOOKS[Math.floor(n * 97) % BOOKS.length]!;
      const lu = u - x;
      if (lu < 0.4) return mix(base, OUT, 0.35);
      if (lu > w - 0.5) return mix(base, hex("#ffffff"), 0.18);
      if (n > 0.55 && (Math.abs(y - h + 1.6) < 0.4 || Math.abs(y - 1.4) < 0.4)) return at(C.gold, 4);
      if (n < 0.3 && Math.abs(y - h * 0.6) < 0.8 && lu > 0.6 && lu < w - 0.6) return at(C.cream, 4);
      return base;
    }
    x += w;
    i++;
  }
  return null;
}

// ---------- Biblioteca ----------

/** Estantería alta de biblioteca: zócalo, cinco estantes llenos y cornisa; casi llega al techo. */
function bookcaseTall(): Sprite {
  const wd = C.woodDark;
  const H = 54;
  const face: Shader = (u, v, fw, fh) => {
    if (u < 1.8 || u >= fw - 1.8) return at(wd, u < 0.8 ? 5 : u >= fw - 0.8 ? 2 : 4);
    if (v < 4) return at(wd, v >= 3 ? 4 : Math.floor(u) % 8 === 0 ? 1 : 2);
    if (v >= fh - 2.5) return at(wd, v >= fh - 1 ? 5 : 3);
    const sh = (fh - 6.5) / 5;
    const s = Math.floor((v - 4) / sh);
    const lv = v - 4 - s * sh;
    if (lv < 1.2) return at(wd, lv >= 0.6 ? 5 : 3);
    // Parante del medio.
    if (Math.abs(u - fw / 2) < 0.7) return at(wd, 3);
    const room = sh - 1.2;
    const side = u < fw / 2 ? 0 : 1;
    const su = side ? u - fw / 2 - 0.7 : u - 1.8;
    const seed = s * 2 + side + 11;
    // Un adorno por aquí y por allá: jarrón, reloj de arena o planta.
    const orn = noise(s, side, 71);
    if (orn > 0.8 && su > 7 && su < 11.5) {
      const cx = 9.2;
      const y = lv - 1.2;
      if (orn > 0.9) {
        if (Math.hypot(su - cx, (y - 3) * 1.1) < 2.4) return at(C.blue, su < cx ? 4 : 2);
        if (Math.abs(su - cx) < 0.9 && y < 6.5) return at(C.blue, 3);
      } else {
        if (y < 2.5 && Math.abs(su - cx) < 1.8) return at(C.terracotta, su < cx ? 4 : 2);
        if (y >= 2.5 && y < room - 0.5 && Math.hypot(su - cx, y - 5) < 2.8) return at(C.leaf, noise(Math.floor(su * 2), Math.floor(y * 2), 3) < 0.5 ? 3 : 4);
      }
    }
    const b = bookAt(su, lv - 1.2, room, seed);
    if (b) return b;
    return at(wd, lv > room - 1 ? 0 : 1);
  };
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 11, d: 32, h: H, top: flat(at(wd, 4)), left: (u, v) => at(wd, u >= 10 ? 3 : v < 4 ? 1 : 2), right: face },
      // Cornisa que sobresale.
      { x: -0.5, y: -0.5, z: H, w: 12.5, d: 33, h: 2.5, top: flat(at(wd, 5)), left: flat(at(wd, 3)), right: (_u, v) => at(wd, v >= 1.5 ? 5 : 3) },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 12, 32) },
  );
}

/** Vitrina: mueble de madera con puertas de vidrio; adentro, platos, una tetera y un trofeo. */
function curioCabinet(): Sprite {
  const wd = C.woodDark;
  const H = 46;
  const glass: Shader = (u, v, fw, fh) => {
    if (u < 1.6 || u >= fw - 1.6) return at(wd, u < 0.8 ? 5 : 3);
    if (v < 5) return doorsFace(wd, 15, { base: 1.5, top: 0.6 })(u, v, fw, 5);
    if (v >= fh - 2) return at(wd, 4);
    if (Math.abs(u - fw / 2) < 0.8) return at(wd, 4);
    if (Math.abs(v - 5.5) < 0.6) return at(wd, 2);
    const s = Math.floor((v - 6) / 12);
    const lv = v - 6 - s * 12;
    if (lv < 0.8) return at(C.white, 3);
    let c: RGBA | null = null;
    const pu = mod(u - 1.6, (fw - 3.2) / 2);
    const y = lv - 0.8;
    if (s === 0) {
      // Platos parados y tazas.
      if (Math.hypot(pu - 4, y - 4) < 3.5) c = Math.hypot(pu - 4, y - 4) < 2 ? at(C.blue, 3) : at(PORCELAIN, 4);
      else if (pu > 9 && pu < 12 && y < 3) c = at(PORCELAIN, pu < 10 ? 4 : 3);
    } else if (s === 1) {
      // Tetera y trofeo.
      if (u < fw / 2 && Math.hypot(pu - 6, (y - 3) * 1.2) < 3.4) c = at(C.rose, pu < 6 ? 4 : 3);
      else if (u < fw / 2 && y >= 6 && y < 7.5 && Math.abs(pu - 6) < 1) c = at(C.rose, 2);
      else if (u >= fw / 2 && ((y < 1.5 && Math.abs(pu - 7) < 2.5) || (y < 5 && Math.abs(pu - 7) < 0.8) || (y >= 5 && y < 8.5 && Math.abs(pu - 7) < 2.6 - (8.5 - y) * 0.35)))
        c = at(C.gold, pu < 7 ? 5 : 3);
    } else if (s === 2) {
      if (bookAt(pu, y, 9, 40 + Math.floor(u / (fw / 2)))) c = bookAt(pu, y, 9, 40 + Math.floor(u / (fw / 2)));
    }
    const back = at(C.rug, 1);
    const base = c ?? back;
    // Vidrio: un velo celeste y reflejos en diagonal.
    if (mod(u - v * 0.7, 13) < 1.2) return mix(base, at(C.white, 4), 0.55);
    return mix(base, at(C.sky, 4), 0.18);
  };
  return renderSprite(
    [
      solidBox({ x: 1, y: 1, z: 0, w: 2, d: 2, h: 2 }, wd, 3),
      solidBox({ x: 1, y: 29, z: 0, w: 2, d: 2, h: 2 }, wd, 3),
      solidBox({ x: 9, y: 1, z: 0, w: 2, d: 2, h: 2 }, wd, 3),
      solidBox({ x: 9, y: 29, z: 0, w: 2, d: 2, h: 2 }, wd, 3),
      { x: 0, y: 0, z: 2, w: 11, d: 32, h: H, top: flat(at(wd, 4)), left: (u, v, fw) => (u > 1.5 && u < fw - 1.5 && v > 7 && v < H - 3 ? mix(at(C.rug, 1), at(C.sky, 4), 0.2) : at(wd, 2)), right: glass },
      { x: -0.5, y: -0.5, z: H + 2, w: 12, d: 33, h: 2, top: flat(at(wd, 5)), left: flat(at(wd, 3)), right: flat(at(wd, 4)) },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 12, 32) },
  );
}

/** Escalerita de biblioteca apoyada hacia atrás (contra la estantería del tile de atrás). */
function libraryLadder(): Sprite {
  const w = C.wood;
  const rails = [...slant([13, 3, 0], [-1, 3, 50], 1.6, w, 3), ...slant([13, 13, 0], [-1, 13, 50], 1.6, w, 3)];
  const rungs: Box[] = [];
  for (let z = 6; z < 48; z += 7) {
    const x = 13 - (z / 50) * 14;
    rungs.push({ x: x - 0.7, y: 3.8, z, w: 1.4, d: 8.4, h: 1.2, top: flat(at(w, 5)), left: flat(at(w, 3)), right: flat(at(w, 4)) });
  }
  return renderSprite([...rails.filter((_, i) => i % 2 === 0), ...rungs, ...rails.filter((_, i) => i % 2 === 1), shadowSpace(0, 1, 15, 14)], {
    outline: OUT,
    under: (c, p) => {
      shadowUnder(9, 2, 6, 12, 0.25)(c, p);
      // Rueditas de bronce al pie.
      for (const y of [3.8, 13.8]) {
        const q = p(13.5, y, 0);
        c.rect(q.x - 1, q.y - 1, 2, 2, at(C.gold, 3));
      }
    },
  });
}

/** Mesa larga de lectura: cuero verde incrustado, dos lámparas de banquero, libros abiertos y un tintero. */
function readingTable(): Sprite {
  const wd = C.woodDark;
  const lamp = (y: number): Box[] => [
    solidBox({ x: 12, y: y - 2.5, z: 14, w: 5, d: 5, h: 1.2 }, C.gold, 3),
    solidBox({ x: 14, y: y - 0.5, z: 15.2, w: 1, d: 1, h: 6 }, C.gold, 4),
    {
      x: 11.5,
      y: y - 5,
      z: 20.5,
      w: 6,
      d: 10,
      h: 3,
      top: (u, _v, fw) => at(C.green, u < fw / 2 ? 5 : 4),
      left: (_u, v) => (v < 0.8 ? at(C.gold, 4) : at(C.green, 3)),
      right: (_u, v) => (v < 0.8 ? at(C.gold, 3) : at(C.green, 2)),
    },
  ];
  const book = (x: number, y: number, r: Ramp): Box[] => [
    { x, y, z: 14, w: 6, d: 9, h: 0.8, top: flat(at(r, 2)), left: flat(at(r, 1)), right: flat(at(r, 2)) },
    {
      x: x + 0.5,
      y: y + 0.5,
      z: 14.8,
      w: 5,
      d: 8,
      h: 0.6,
      top: (u, v, _fw, fh) => (Math.abs(v - fh / 2) < 0.4 ? at(C.cream, 2) : Math.floor(u) % 2 === 1 && Math.abs(v - fh / 2) > 1 ? at(C.cream, 3) : at(C.cream, 5)),
      left: flat(at(C.cream, 3)),
      right: flat(at(C.cream, 4)),
    },
  ];
  const leather: Shader = (u, v, fw, fh) => {
    const e = edgeOf(u, v, fw, fh);
    if (e < 1) return at(wd, 4);
    if (e < 3.5) return at(wd, noise(Math.floor(u / 7), Math.floor(v / 9), 2) < 0.5 ? 3 : 4);
    if (e < 4.2) return at(C.gold, 3);
    return at(C.green, bayer(Math.floor(u), Math.floor(v)) < 0.1 ? 1 : 2);
  };
  return renderSprite(
    [
      ...[3, 58].flatMap((y) => [leg(3, y, 12, wd), leg(26, y, 12, wd)]),
      solidBox({ x: 4, y: 5, z: 3, w: 1.5, d: 54, h: 1.5 }, wd, 2),
      solidBox({ x: 26.5, y: 5, z: 3, w: 1.5, d: 54, h: 1.5 }, wd, 2),
      { x: 2, y: 2, z: 10, w: 28, d: 60, h: 2.5, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: (u) => (Math.floor(u) % 15 === 7 ? at(C.gold, 4) : at(wd, 2)) },
      { x: 1, y: 1, z: 12.5, w: 30, d: 62, h: 1.5, top: leather, left: flat(at(wd, 3)), right: flat(at(wd, 4)) },
      ...lamp(17),
      ...lamp(47),
      ...book(4, 25, C.rug),
      ...book(20, 36, C.fabric),
      // Pila de libros, tintero y pluma.
      solidBox({ x: 21, y: 6, z: 14, w: 6, d: 8, h: 2 }, C.sage, 3),
      solidBox({ x: 21.5, y: 6.5, z: 16, w: 5, d: 7, h: 1.8 }, C.mustard, 3),
      solidBox({ x: 22, y: 7, z: 17.8, w: 4.5, d: 6, h: 1.6 }, C.rug, 3),
      solidBox({ x: 6, y: 54, z: 14, w: 2.5, d: 2.5, h: 2 }, C.metal, 1),
      volume(0, 0, 14, 32, 64, 12),
      shadowSpace(1, 1, 30, 62),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 30, 62),
      extra: (c, p) => {
        const q = p(7, 55, 16);
        c.line(q.x, q.y, q.x + 3, q.y - 5, at(C.cream, 5));
        c.set(q.x + 3, q.y - 6, at(C.cream, 4));
        // Cadenita de las lámparas.
        for (const y of [17, 47]) {
          const k = p(17.5, y + 3, 20.5);
          c.set(k.x, k.y + 1, at(C.gold, 4));
          c.set(k.x, k.y + 2, at(C.gold, 3));
        }
      },
    },
  );
}

// ---------- Chimenea ----------

const stoneShader: Shader = (u, v) => {
  const row = Math.floor(v / 4);
  const off = (row % 2) * 3.5;
  const col = Math.floor((u + off) / 7);
  const su = mod(u + off, 7);
  const sv = mod(v, 4);
  const n = noise(col, row, 5);
  if (sv < 0.8 || su < 0.8) return at(C.stone, 1);
  if (sv > 3.2 || su > 6.2) return at(C.stone, 2);
  const c = at(C.stone, n < 0.3 ? 2 : n < 0.8 ? 3 : 4);
  // Musgo o tizne entre algunas piedras.
  return n > 0.93 ? mix(c, at(C.dirt, 2), 0.4) : c;
};

/** Chimenea grande de piedra: hogar con leños y fuego, repisa de madera con adornos y el tiro hasta el techo. */
function fireplaceStone(): Sprite {
  const D = 48;
  const box: Shader = (u, v, fw, fh) => {
    const cu = u - fw / 2;
    const archTop = 18 - Math.max(0, Math.abs(cu) - 6) ** 2 * 0.25;
    const inside = Math.abs(cu) < 10 && v >= 1 && v < archTop;
    if (Math.abs(cu) < 11.5 && v < archTop + 1.8 && !inside) {
      // Dovelas del arco.
      if (v >= archTop - 0.2) return at(C.stone, Math.floor(u / 2.5) % 2 ? 4 : 3);
      if (Math.abs(cu) >= 10) return at(C.stone, 4);
    }
    if (!inside) return stoneShader(u, v, fw, fh);
    // Dentro del hogar: ladrillo tiznado, leños y llamas.
    const flame = 13 - Math.abs(cu) * 1.05 + Math.sin(u * 1.7) * 1.6 + noise(Math.floor(u), 0, 7) * 2;
    if (v < 3.2 && Math.abs(cu) < 7) return at(C.logs, v < 1.6 ? 2 : Math.floor(u) % 5 === 0 ? 1 : 3);
    if (v < flame * 0.3 + 2) return at(C.fire, 4);
    if (v < flame * 0.6 + 2) return at(C.fire, 3);
    if (v < flame + 2) return at(C.fire, 2);
    return at(C.woodDark, mod(v, 3) < 0.6 ? 1 : 0);
  };
  const mantelTop: Shader = woodTop(C.wood, 8);
  return renderSprite(
    [
      // Hogar de piedra al ras del piso.
      { x: 0, y: 0, z: 0, w: 15, d: D, h: 2, top: (u, v) => stoneShader(u * 1.3, v, 0, 0), left: stoneShader, right: stoneShader },
      { x: 0, y: 5, z: 2, w: 9, d: D - 10, h: 26, top: stoneShader, left: stoneShader, right: box },
      // Repisa.
      { x: 0, y: 3, z: 28, w: 12, d: D - 6, h: 2.5, top: mantelTop, left: flat(at(C.wood, 2)), right: (_u, v) => at(C.wood, v >= 1.5 ? 4 : 2) },
      solidBox({ x: 8, y: 6, z: 25, w: 3, d: 2, h: 3 }, C.wood, 3),
      solidBox({ x: 8, y: D - 8, z: 25, w: 3, d: 2, h: 3 }, C.wood, 3),
      // Tiro de la chimenea.
      { x: 0, y: 10, z: 30.5, w: 7, d: D - 20, h: 28, top: stoneShader, left: stoneShader, right: stoneShader },
      // Adornos: velas, reloj, planta y un cuadrito.
      solidBox({ x: 7.5, y: 6, z: 30.5, w: 2, d: 2, h: 5 }, C.cream, 4),
      solidBox({ x: 7.5, y: 9, z: 30.5, w: 2, d: 2, h: 3.5 }, C.cream, 4),
      { x: 7, y: 20, z: 30.5, w: 3, d: 8, h: 6, top: flat(at(C.woodDark, 4)), left: flat(at(C.woodDark, 2)), right: (u, v, fw, fh) => (Math.hypot(u - fw / 2, v - fh / 2) < 2.4 ? at(C.cream, 5) : at(C.woodDark, 3)) },
      solidBox({ x: 7, y: 36, z: 30.5, w: 3.5, d: 3.5, h: 3 }, C.terracotta, 3),
      volume(6, 35, 33.5, 5, 6, 6),
      // Juego de atizadores al costado.
      solidBox({ x: 11, y: D - 3.5, z: 0, w: 3, d: 3, h: 1 }, C.metal, 2),
      solidBox({ x: 12, y: D - 2.5, z: 1, w: 1, d: 1, h: 14 }, C.metal, 3),
      volume(0, 0, 0, 16, D, 0),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 15, D, 0.25),
      extra: (c, p) => {
        // Llamitas de las velas.
        for (const [y, z] of [
          [7, 36],
          [10, 34.5],
        ] as const) {
          const q = p(8.5, y, z);
          c.set(q.x, q.y - 1, at(C.fire, 4));
          c.set(q.x, q.y - 2, at(C.fire, 3));
        }
        // Hojas de la planta de la repisa.
        const pl = p(8.7, 37.7, 34);
        c.ellipse(pl.x, pl.y - 2, 3.5, 2.2, at(C.leaf, 2));
        c.ellipse(pl.x - 1, pl.y - 3, 2.2, 1.5, at(C.leaf, 4));
        c.set(pl.x + 2, pl.y - 1, at(C.leaf, 3));
        c.line(pl.x + 2, pl.y, pl.x + 3, pl.y + 3, at(C.leaf, 2));
        // Atizador y pala colgando del soporte.
        const t = p(12.5, D - 2, 15);
        c.rect(t.x - 2, t.y, 4, 1, at(C.metal, 3));
        c.line(t.x - 2, t.y + 1, t.x - 2, t.y + 9, at(C.metal, 1));
        c.line(t.x + 2, t.y + 1, t.x + 2, t.y + 8, at(C.metal, 2));
        c.rect(t.x + 1, t.y + 8, 3, 2, at(C.metal, 2));
        // Chispas sobre el fuego.
        const f = p(9, D / 2, 18);
        c.set(f.x - 3, f.y - 1, at(C.fire, 4));
        c.set(f.x + 2, f.y - 3, at(C.gold, 5));
      },
    },
  );
}

// ---------- Asientos ----------

/** Sofá Chesterfield de cuero, de tres cuerpos: respaldo capitoné y brazos enrollados. */
function sofaLeather(variant: Variant): Sprite {
  const back = variant === "back";
  const f = LEATHER;
  const D = 48;
  // Capitoné: botones hundidos en rombos grandes, con el cuero levemente abollonado entre ellos.
  const tufted: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.5) return at(f, 4);
    if (v < 1) return at(f, 1);
    const row = Math.floor(v / 5);
    const bu = mod(u + (row % 2) * 4, 8);
    const bv = mod(v, 5);
    if (Math.abs(bu - 4) < 0.7 && Math.abs(bv - 2.5) < 0.7) return at(f, 0);
    if (Math.abs(Math.abs(bu - 4) * 0.62 - Math.abs(bv - 2.5)) < 0.35) return at(f, 2);
    return at(f, bv > 3.8 ? 4 : 3);
  };
  const armRoll = (y: number): Box => ({
    x: 0,
    y,
    z: 2,
    w: 16,
    d: 5,
    h: 14,
    top: (u, v, fw, fh) => at(f, u < 1 || u >= fw - 1 || v < 1 || v >= fh - 1 ? 3 : 5),
    left: (u, v, fw, fh) => (v >= fh - 2.5 ? at(f, 4) : u < 1 || u >= fw - 1 ? at(f, 1) : Math.floor(u) % 4 === 0 && v > 4 ? at(C.gold, 3) : at(f, 2)),
    right: (u, v, fw, fh) => (Math.hypot(u - fw / 2, v - fh + 3.5) < 2.5 ? at(f, Math.hypot(u - fw / 2 + 0.6, v - fh + 3) < 1.2 ? 4 : 2) : at(f, v >= fh - 1.5 ? 3 : 1)),
  });
  // De espaldas se ve el dorso del respaldo: cuero liso con costuras verticales.
  const plainBack: Shader = (u, v, _fw, fh) => (v >= fh - 1.5 ? at(f, 3) : mod(u, 10) < 0.7 ? at(f, 1) : at(f, 2));
  const rest: Box = { x: back ? 11 : 0, y: 4, z: 2, w: 5, d: D - 8, h: 18, top: flat(at(f, 4)), left: flat(at(f, 1)), right: back ? plainBack : tufted };
  const base: Box = { x: back ? 0 : 4, y: 4, z: 2, w: 12, d: D - 8, h: 6, top: flat(at(f, 2)), left: flat(at(f, 1)), right: flat(at(f, 2)) };
  const seats = [0, 1, 2].map((i) => cushion(back ? 1 : 5, 5 + i * 12.7, 8, 10, 12.2, 3, f));
  const legs = [leg(1, 1, 2, C.woodDark), leg(13, 1, 2, C.woodDark), leg(1, D - 3, 2, C.woodDark), leg(13, D - 3, 2, C.woodDark)];
  const pillow = cushion(back ? 2 : 6, D - 13, 11, 4, 7, 6, C.mustard);
  const middle = back ? [base, ...seats, pillow, rest] : [rest, base, ...seats, pillow];
  return renderSprite([legs[0]!, legs[1]!, armRoll(0), ...middle, legs[2]!, armRoll(D - 5), legs[3]!], {
    outline: OUT,
    under: shadowUnder(0, 0, 16, D),
  });
}

/** Sillón orejero de terciopelo vino con tachas doradas. */
function armchairWing(variant: Variant): Sprite {
  const back = variant === "back";
  const r = C.rug;
  const bx = back ? 11 : 1;
  const tall: Box = {
    x: bx,
    y: 1,
    z: 6,
    w: 4,
    d: 14,
    h: 22,
    top: (u, v, fw, fh) => at(r, u < 1 || v < 1 || u >= fw - 1 || v >= fh - 1 ? 3 : 4),
    left: flat(at(r, 1)),
    right: (u, v, fw, fh) => {
      if (back) return at(r, v >= fh - 1.5 ? 2 : 1);
      if (v >= fh - 1.5) return at(r, 3);
      // Capitoné suave en el respaldo.
      if (Math.abs(mod(u, 4.5) - 2.2) < 0.5 && Math.abs(mod(v, 5) - 2.5) < 0.5 && v > 4) return at(r, 1);
      return at(r, u < 1.5 || u > fw - 1.5 ? 2 : 3);
    },
  };
  const wing = (y: number): Box => ({
    x: back ? 7 : 1,
    y,
    z: 11,
    w: 8,
    d: 2.5,
    h: 14,
    top: flat(at(r, 4)),
    left: (u, v, fw, fh) => (v >= fh - 1 || u >= fw - 1 ? at(r, 3) : at(r, 2)),
    right: flat(at(r, 2)),
  });
  const arm = (y: number): Box => ({
    x: 1,
    y,
    z: 3,
    w: 14,
    d: 3,
    h: 9,
    top: flat(at(r, 4)),
    left: (u, v, _fw, fh) => (v < fh - 1 && Math.abs(v - 1.5) < 0.5 && Math.floor(u) % 2 === 0 ? at(C.gold, 4) : at(r, v >= fh - 1 ? 3 : 2)),
    right: flat(at(r, 2)),
  });
  const body: Box = { x: 1, y: 1, z: 2, w: 14, d: 14, h: 5, top: flat(at(r, 2)), left: flat(at(r, 1)), right: flat(at(r, 2)) };
  const seat = cushion(back ? 2 : 5, 4, 7, 9, 8, 2.5, r);
  const legs = [leg(2, 2, 2), leg(12, 2, 2), leg(2, 12, 2), leg(12, 12, 2)];
  const parts = back ? [...legs, arm(1), wing(1), body, seat, tall, wing(12.5), arm(12)] : [...legs, arm(1), wing(1), tall, body, seat, wing(12.5), arm(12)];
  return renderSprite(parts, { outline: OUT, under: shadowUnder(1, 1, 14, 14) });
}

/** Hamaca de tela a rayas colgada de un soporte de madera curvo, con un cojín y un libro. */
function hammock(): Sprite {
  const w = C.wood;
  const D = 32;
  const stripes: Shader = (u) => {
    const k = Math.floor(u / 2.5) % 4;
    return at([C.curtain, C.cream, C.mustard, C.cream][k]!, 3);
  };
  // Tela: tiras cortas que bajan hacia el medio (catenaria) a lo largo de y.
  const sling: Box[] = [];
  for (let y = 4; y < D - 4; y += 1.5) {
    const t = (y - D / 2) / (D / 2 - 4);
    const z = 8 + t * t * 9;
    sling.push({ x: 3, y, z, w: 10, d: 1.6, h: 1.6, top: (u) => stripes(u, 0, 10, 1), left: (u) => at([C.curtain, C.cream, C.mustard, C.cream][Math.floor(u / 2.5) % 4]!, 2), right: flat(at(C.curtain, 2)) });
  }
  const base = [solidBox({ x: 7, y: 1, z: 0, w: 2, d: D - 2, h: 2 }, w, 3), solidBox({ x: 4, y: 1, z: 0, w: 8, d: 2, h: 1.5 }, w, 3), solidBox({ x: 4, y: D - 3, z: 0, w: 8, d: 2, h: 1.5 }, w, 3)];
  // Arcos del soporte en las puntas.
  const arc = (y0: number, dir: 1 | -1): Box[] => {
    const out: Box[] = [];
    for (let i = 0; i < 10; i++) {
      const z = i * 2.4;
      const y = y0 + dir * Math.sin((i / 10) * 1.2) * 3;
      out.push(solidBox({ x: 7, y, z, w: 2, d: 2, h: 2.6 }, w, 4));
    }
    return out;
  };
  return renderSprite(
    [...base, ...arc(1, 1), ...sling, cushion(4, 22, 17, 7, 5, 3, C.sage), solidBox({ x: 5, y: 12, z: 9, w: 5, d: 4, h: 1 }, C.fabric, 3), ...arc(D - 3, -1), shadowSpace(2, 1, 12, D - 2)],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 12, D - 4, 0.22),
      extra: (c, p) => {
        // Cuerdas de las puntas de la tela al soporte.
        for (const [y0, y1] of [
          [4, 2.5],
          [D - 4, D - 2.5],
        ] as const)
          for (const x of [3.5, 12.5]) {
            const a = p(x, y0, 17);
            const b = p(8, y1, 24);
            c.line(a.x, a.y, b.x, b.y, at(C.cream, 2));
          }
      },
    },
  );
}

// ---------- Lámparas, relojes y cestas ----------

/** Lámpara de lectura de pie: base de bronce, brazo en arco y pantalla de campana que mira hacia +x. */
function readingLamp(): Sprite {
  return renderSprite(
    [
      solidBox({ x: 2, y: 5, z: 0, w: 6, d: 6, h: 1.5 }, C.gold, 3),
      solidBox({ x: 4, y: 7, z: 1.5, w: 2, d: 2, h: 26 }, C.gold, 3),
      ...slant([5, 8, 27], [10, 8, 34], 1.4, C.gold, 3),
      {
        x: 9,
        y: 5,
        z: 29,
        w: 6,
        d: 6,
        h: 5,
        top: flat(at(C.green, 4)),
        left: (_u, v) => (v < 0.8 ? at(C.gold, 4) : at(C.green, 3)),
        right: (_u, v) => (v < 0.8 ? at(C.gold, 3) : at(C.green, 2)),
      },
      volume(2, 5, 0, 13, 6, 36),
    ],
    {
      outline: OUT,
      under: (c, p) => {
        roundShadow(5, 8, 3.5, 0.3)(c, p);
        // Charco de luz cálida bajo la pantalla.
        const q = p(12, 8, 0);
        c.ellipse(q.x, q.y, 5, 2.5, alpha(at(C.gold, 5), 0.25));
      },
      extra: (c, p) => {
        const b = p(12, 8, 29);
        c.set(b.x, b.y, at(C.gold, 5));
        c.set(b.x - 1, b.y, at(C.cream, 5));
      },
    },
  );
}

/** Reloj de pie: pedestal, caja con la ventanita del péndulo, esfera con números y copete tallado. */
function grandfatherClock(): Sprite {
  const wd = C.woodDark;
  const trunk: Shader = (u, v, fw, fh) => {
    if (u < 1 || u >= fw - 1) return at(wd, u < 1 ? 4 : 2);
    // Ventanita con el péndulo.
    if (Math.abs(u - fw / 2) < 2.5 && v > 3 && v < fh - 3) {
      const sw = Math.sin(0.6) * (fh - 6 - v) * 0.12;
      if (Math.hypot(u - fw / 2 - sw, v - 5.5) < 1.6) return at(C.gold, 5);
      if (Math.abs(u - fw / 2 - sw) < 0.4 && v > 6) return at(C.gold, 3);
      return at(wd, 0);
    }
    return at(wd, 3);
  };
  const face: Shader = (u, v, fw, fh) => {
    const d = Math.hypot(u - fw / 2, v - fh / 2);
    if (d > 4.2) return at(wd, u < 1 ? 4 : 3);
    if (d > 3.6) return at(C.gold, 4);
    const ang = Math.atan2(v - fh / 2, u - fw / 2);
    if (d > 2.6 && mod(ang + Math.PI, Math.PI / 6) < 0.25) return OUT;
    if (d < 2.4 && (Math.abs(ang - 1.2) < 0.2 || Math.abs(ang + 0.4) < 0.2)) return OUT;
    return at(C.cream, 5);
  };
  return renderSprite(
    [
      solidBox({ x: 3, y: 3, z: 0, w: 10, d: 10, h: 7 }, wd, 3),
      { x: 4, y: 4, z: 7, w: 8, d: 8, h: 24, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: trunk },
      { x: 3, y: 3, z: 31, w: 10, d: 10, h: 12, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: face },
      { x: 2.5, y: 2.5, z: 43, w: 11, d: 11, h: 2, top: flat(at(wd, 5)), left: flat(at(wd, 3)), right: flat(at(wd, 4)) },
      solidBox({ x: 6, y: 6, z: 45, w: 4, d: 4, h: 3 }, C.gold, 3),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 10, 10) },
  );
}

/** Cesta de mimbre con mantas dobladas; una de cuadros cae por el borde. */
function blanketBasket(): Sprite {
  const wicker: Shader = (u, v) => ((Math.floor(u / 2) + Math.floor(v / 2)) % 2 ? at(C.cork, 3) : at(C.cork, 2));
  const plaid: Shader = (u, v) => {
    const a = Math.floor(u / 2) % 2;
    const b = Math.floor(v / 2) % 2;
    return a && b ? at(C.rug, 1) : a || b ? at(C.rug, 3) : at(C.cream, 4);
  };
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 12, d: 12, h: 9, top: flat(at(C.cork, 1)), left: wicker, right: wicker },
      solidBox({ x: 1.5, y: 1.5, z: 9, w: 13, d: 13, h: 1.2 }, C.cork, 3),
      { x: 3, y: 3, z: 10, w: 10, d: 10, h: 3, top: flat(at(C.sage, 4)), left: flat(at(C.sage, 3)), right: flat(at(C.sage, 2)) },
      { x: 3.5, y: 3, z: 13, w: 9, d: 10, h: 2.5, top: plaid, left: plaid, right: plaid },
      // La manta que cuelga por el frente.
      { x: 13.5, y: 5, z: 3, w: 1, d: 6, h: 10, top: plaid, left: plaid, right: (u, v) => (v < 1 ? at(C.cream, 5) : plaid(u, v, 6, 10)) },
    ],
    { outline: OUT, under: shadowUnder(2, 2, 12, 12) },
  );
}

// ---------- Juegos de mesa ----------

/** Mesa de ajedrez: tablero en la tapa con una partida a medio jugar. */
function chessTable(): Sprite {
  const board: Shader = (u, v, fw, fh) => {
    const e = edgeOf(u, v, fw, fh);
    if (e < 1.2) return at(C.woodDark, 4);
    const i = Math.floor(((u - 1.2) / (fw - 2.4)) * 8);
    const j = Math.floor(((v - 1.2) / (fh - 2.4)) * 8);
    return (i + j) % 2 ? at(C.woodDark, 2) : at(C.cream, 4);
  };
  const piece = (i: number, j: number, white: boolean, tall = 2.5): Box => {
    const x = 1.2 + (i + 0.5) * (11.6 / 8) - 0.5;
    const y = 1.2 + (j + 0.5) * (11.6 / 8) - 0.5;
    return solidBox({ x: 1 + x, y: 1 + y, z: 12.8, w: 1, d: 1, h: tall }, white ? PORCELAIN : C.metal, white ? 4 : 1);
  };
  const pieces: [number, number, boolean, number?][] = [
    [0, 1, true],
    [1, 2, true],
    [3, 1, true, 3.5],
    [4, 0, true, 4],
    [6, 1, true],
    [2, 3, true],
    [7, 6, false],
    [5, 6, false],
    [4, 7, false, 4],
    [3, 5, false, 3.5],
    [1, 6, false],
    [5, 4, false],
  ];
  return renderSprite(
    [
      solidBox({ x: 4, y: 4, z: 0, w: 8, d: 8, h: 1.5 }, C.woodDark, 3),
      solidBox({ x: 7, y: 7, z: 1.5, w: 2, d: 2, h: 9 }, C.woodDark, 4),
      { x: 1, y: 1, z: 10.5, w: 14, d: 14, h: 2.3, top: board, left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 3)) },
      ...pieces.sort((a, b) => a[0] + a[1] - (b[0] + b[1])).map(([i, j, w, t]) => piece(i, j, w, t)),
    ],
    { outline: OUT, under: shadowUnder(1, 1, 14, 14) },
  );
}

/** Mesa con un puzle a medio armar: el borde listo, parches de color y piezas sueltas; la caja al lado. */
function puzzleTable(): Sprite {
  const wd = C.wood;
  const puzzle: Shader = (u, v, fw, fh) => {
    const e = edgeOf(u, v, fw, fh);
    if (e < 1) return at(wd, 4);
    const x = u - 1;
    const y = v - 1;
    const pi = Math.floor(x / 2);
    const pj = Math.floor(y / 2);
    // Dibujo del puzle: un atardecer sobre montañas.
    const pic = y < 10 ? (y + Math.sin(x * 0.4) * 2 < 6 ? C.fire : C.gold) : y < 18 ? C.violet : C.leaf;
    const done = pi < 1 || pj < 1 || pi > 5 || (pj < 6 && pi < 4) || noise(pi, pj, 17) < 0.25;
    if (done) {
      if (mod(x, 2) < 0.3 || mod(y, 2) < 0.3) return at(pic, 1);
      return at(pic, 3 + (noise(Math.floor(x), Math.floor(y), 2) < 0.2 ? 1 : 0));
    }
    // Piezas sueltas.
    if (noise(pi, pj, 5) < 0.3 && mod(x, 2) > 0.4 && mod(y, 2) > 0.4) return at([C.fire, C.leaf, C.violet, C.gold][Math.floor(noise(pi, pj, 9) * 4)]!, 3);
    return at(C.green, 1);
  };
  return renderSprite(
    [
      leg(2, 2, 11),
      leg(12, 2, 11),
      leg(2, 28, 11),
      leg(12, 28, 11),
      { x: 1, y: 1, z: 11, w: 14, d: 30, h: 2, top: puzzle, left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      // La caja con la foto del puzle, abierta y apoyada.
      { x: 2, y: 24, z: 13, w: 8, d: 6, h: 1.5, top: (u, v) => (u > 1 && v > 1 && u < 7 && v < 5 ? at(C.fire, 3) : at(C.cream, 4)), left: flat(at(C.cream, 3)), right: flat(at(C.cream, 2)) },
      volume(0, 0, 13, 16, 32, 3),
    ],
    { outline: OUT, under: shadowUnder(1, 1, 14, 30) },
  );
}

const GAME_BOXES: Ramp[] = [C.rug, C.blue, C.mustard, C.green, C.violet, C.fire, C.cyan];

/** Estante bajo con cajas de juegos apiladas, un dado gigante y un trofeo encima. */
function gameShelf(): Sprite {
  const wd = C.wood;
  const face: Shader = (u, v, fw, fh) => {
    if (u < 1.4 || u >= fw - 1.4 || v >= fh - 1.2) return at(wd, u < 0.7 || v >= fh - 0.6 ? 4 : 2);
    if (v < 1.5) return at(C.woodDark, 2);
    const s = v < 10.5 ? 0 : 1;
    const lv = s ? v - 10.5 : v - 1.5;
    if (s && lv < 1) return at(wd, 4);
    const y = s ? lv - 1 : lv;
    const room = 8.2;
    // Cajas acostadas: cada una de un alto y un largo distintos.
    let top = 0;
    let k = 0;
    while (top < room && k < 5) {
      const h = 1.6 + noise(k, s, 31) * 1.6;
      const len = fw - 3 - noise(k, s, 13) * 8;
      const off = 1.4 + noise(k, s, 43) * (fw - 3 - len);
      if (y >= top && y < top + h) {
        if (u < off || u > off + len) return at(C.woodDark, 1);
        const r = GAME_BOXES[(k * 3 + s * 2) % GAME_BOXES.length]!;
        if (y - top < 0.4) return at(r, 1);
        if (Math.abs(u - off - len * 0.3) < 1.5 && Math.abs(y - top - h / 2) < 0.5) return at(C.cream, 5);
        return at(r, 3);
      }
      top += h + 0.1;
      k++;
    }
    return at(C.woodDark, 1);
  };
  const die: Shader = (u, v) => ((Math.hypot(u - 1.2, v - 1.2) < 0.6 || Math.hypot(u - 3.3, v - 3.3) < 0.6) ? at(C.rug, 2) : at(PORCELAIN, 4));
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 10, d: 32, h: 21, top: woodTop(wd, 6), left: (u, v, fw) => at(wd, u >= fw - 1 ? 3 : v < 1.5 ? 1 : 2), right: face },
      { x: 3, y: 4, z: 21, w: 4.5, d: 4.5, h: 4.5, top: die, left: die, right: die },
      solidBox({ x: 3.5, y: 23, z: 21, w: 4, d: 4, h: 1.5 }, C.woodDark, 3),
      solidBox({ x: 5, y: 24.5, z: 22.5, w: 1, d: 1, h: 3 }, C.gold, 4),
      { x: 3.5, y: 23, z: 25.5, w: 4, d: 4, h: 3, top: flat(at(C.gold, 5)), left: flat(at(C.gold, 4)), right: flat(at(C.gold, 3)) },
      { x: 3, y: 12, z: 21, w: 6, d: 8, h: 1.5, top: (u, v) => ((Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2 ? at(C.rug, 3) : at(C.cream, 5)), left: flat(at(C.rug, 2)), right: flat(at(C.rug, 2)) },
    ],
    { outline: OUT, under: shadowUnder(0, 0, 10, 32) },
  );
}

// ---------- Muebles de sala ----------

/** Aparador bajo con puertas y cajones; encima un florero, libros y una fuente con frutas. */
function sideboard(): Sprite {
  const wd = C.woodDark;
  return renderSprite(
    [
      leg(1, 1, 3, wd),
      leg(1, 29, 3, wd),
      leg(9, 1, 3, wd),
      leg(9, 29, 3, wd),
      { x: 0, y: 0, z: 3, w: 11, d: 32, h: 14, top: woodTop(wd, 8), left: doorsFace(wd, 11, { base: 0.8, top: 0.8 }), right: doorsFace(wd, 10.5, { base: 0.8, top: 0.8, drawers: 1 }) },
      { x: 3, y: 4, z: 17, w: 4, d: 4, h: 7, top: flat(at(C.blue, 4)), left: (_u, v) => at(C.blue, v > 5 ? 4 : 3), right: (_u, v) => at(C.blue, v > 5 ? 3 : 2) },
      volume(0, 1, 24, 10, 10, 8),
      solidBox({ x: 2, y: 14, z: 17, w: 6, d: 7, h: 1.5 }, C.fabric, 3),
      solidBox({ x: 2.5, y: 14.5, z: 18.5, w: 5, d: 6, h: 1.5 }, C.cream, 4),
      { x: 2, y: 23, z: 17, w: 7, d: 7, h: 1.5, top: flat(at(C.cream, 4)), left: flat(at(C.cream, 3)), right: flat(at(C.cream, 2)) },
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 11, 32),
      extra: (c, p) => {
        // Flores del florero.
        const f = p(5, 6, 24);
        const cols = [at(C.rug, 4), at(C.gold, 5), at(C.rose, 5), at(C.white, 4)];
        for (let i = 0; i < 7; i++) {
          const dx = Math.round(Math.cos(i * 0.9) * 3.5);
          const dy = -Math.round(Math.abs(Math.sin(i * 1.3)) * 4) - 1;
          c.line(f.x, f.y + 2, f.x + dx, f.y + dy, at(C.leaf, 2));
          c.rect(f.x + dx - 1, f.y + dy - 1, 2, 2, cols[i % 4]!);
        }
        // Frutas en la fuente.
        const fr = p(5.5, 26.5, 18.5);
        c.ellipse(fr.x - 2, fr.y - 1, 1.8, 1.6, at(C.rug, 3));
        c.ellipse(fr.x + 1, fr.y - 1, 1.8, 1.6, at(C.mustard, 4));
        c.ellipse(fr.x, fr.y - 3, 1.6, 1.4, at(C.leaf, 4));
      },
    },
  );
}

// ---------- Alfombras ----------

/** Alfombra persa: guardas con motivos, medallón al centro y flecos en las puntas cortas. */
function rugPersian(): Sprite {
  const W = 64;
  const D = 96;
  const s: Shader = (u, v, fw, fh) => {
    // Flecos.
    if (v < 3 || v >= fh - 3) return Math.floor(u) % 2 ? at(C.cream, 4) : null;
    const y = v - 3;
    const h = fh - 6;
    const e = Math.min(u, y, fw - u, h - y);
    if (e < 1) return at(C.navy, 1);
    if (e < 2) return at(C.gold, 3);
    if (e < 6) {
      // Guarda con rombitos.
      const t = e < 4 ? (u + y) : u - y;
      return Math.abs(mod(t, 6) - 3) + Math.abs(e - 4) < 1.4 ? at(C.gold, 4) : at(C.navy, 2);
    }
    if (e < 7) return at(C.cream, 4);
    const cu = u - fw / 2;
    const cv = y - h / 2;
    const m = Math.abs(cu) / (fw * 0.38) + Math.abs(cv) / (h * 0.36);
    if (m < 0.18) return at(C.gold, 4);
    if (m < 0.36) return at(C.navy, 2);
    if (m < 0.42) return at(C.cream, 4);
    if (m < 0.8) return Math.abs(m - 0.6) < 0.04 ? at(C.cream, 4) : at(C.rug, m < 0.6 ? 4 : 3);
    if (m < 0.86) return at(C.gold, 3);
    // Campo con flores pequeñas en rejilla.
    const fu = mod(u, 8) - 4;
    const fv = mod(y, 8) - 4;
    if (Math.abs(fu) + Math.abs(fv) < 1.5) return at(C.cream, 4);
    if (Math.abs(fu) < 0.5 || Math.abs(fv) < 0.5) if (Math.abs(fu) + Math.abs(fv) < 2.6) return at(C.green, 3);
    return at(C.rug, bayer(Math.floor(u), Math.floor(y)) < 0.12 ? 3 : 2);
  };
  return renderSprite([{ x: 1, y: 0, z: 0, w: W - 2, d: D, h: 1, top: s, left: flat(at(C.navy, 1)), right: flat(at(C.navy, 1)) }], { outline: OUT });
}

/** Alfombra de pasillo tipo kilim: rombos escalonados y flecos. */
function runner(): Sprite {
  const s: Shader = (u, v, fw, fh) => {
    if (v < 2.5 || v >= fh - 2.5) return Math.floor(u) % 2 ? at(C.cream, 4) : null;
    const y = v - 2.5;
    const e = Math.min(u, fw - u);
    if (e < 1) return at(C.rug, 1);
    if (e < 2) return at(C.cream, 4);
    const cu = Math.abs(u - fw / 2);
    const k = Math.abs(mod(y, 14) - 7);
    const d = Math.floor(cu) + Math.floor(k);
    if (d === 6 || d === 3) return at(C.mustard, 4);
    if (d < 3) return at(C.navy, 2);
    return at(C.rug, bayer(Math.floor(u), Math.floor(y)) < 0.12 ? 3 : 2);
  };
  return renderSprite([{ x: 2, y: 0, z: 0, w: 12, d: 96, h: 1, top: s, left: flat(at(C.rug, 1)), right: flat(at(C.rug, 1)) }], { outline: OUT });
}

// ---------- Recibidor, guardarropa y baños ----------

/** Recepción: mostrador de madera con paneles y repisa; adentro, un monitor, el libro de visitas y un timbre. */
function receptionDesk(): Sprite {
  const wd = C.wood;
  const D = 48;
  const front: Shader = (u, v, fw, fh) => {
    if (v < 1.5) return at(C.woodDark, 1);
    if (v >= fh - 1.5) return at(wd, 4);
    // Letrero de bronce al centro con tres rayitas.
    if (Math.abs(u - fw / 2) < 9 && Math.abs(v - fh * 0.62) < 2.5) {
      if (Math.abs(u - fw / 2) > 8.2 || Math.abs(v - fh * 0.62) > 1.8) return at(C.gold, 2);
      return Math.floor(v) === Math.floor(fh * 0.62) && Math.floor(u) % 2 === 0 ? at(C.gold, 2) : at(C.gold, 4);
    }
    const pw = fw / 4;
    const pu = mod(u, pw);
    if (pu < 1 || pu >= pw - 1) return at(wd, pu < 0.5 ? 1 : 2);
    if (pu < 1.8) return at(wd, 4);
    return at(wd, Math.floor(v) % 6 === 0 ? 2 : 3);
  };
  return renderSprite(
    [
      // Escritorio de atrás (a la altura de quien atiende).
      { x: 0, y: 1, z: 0, w: 7, d: D - 2, h: 12, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: flat(at(C.woodDark, 2)) },
      // Monitor y teclado.
      solidBox({ x: 2, y: 30, z: 12, w: 3, d: 3, h: 1 }, C.metal, 3),
      { x: 2, y: 25, z: 13, w: 2, d: 13, h: 9, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: (u, v, fw, fh) => (edgeOf(u, v, fw, fh) < 1 ? at(C.metal, 1) : v > fh - 3 ? at(C.screen, 3) : at(C.screen, 1 + (Math.floor(v) % 3 === 0 ? 1 : 0))) },
      // Frente alto con la repisa.
      { x: 8, y: 0, z: 0, w: 5, d: D, h: 18, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: front },
      { x: 7.5, y: -0.5, z: 18, w: 7, d: D + 1, h: 2, top: woodTop(wd, 8), left: flat(at(wd, 2)), right: (_u, v) => at(wd, v >= 1 ? 4 : 2) },
      // Libro de visitas abierto, timbre y una matera.
      solidBox({ x: 9, y: 16, z: 20, w: 5, d: 8, h: 0.8 }, C.rug, 2),
      { x: 9.3, y: 16.4, z: 20.8, w: 4.4, d: 7.2, h: 0.5, top: (_u, v, _fw, fh) => (Math.abs(v - fh / 2) < 0.4 ? at(C.cream, 2) : at(C.cream, 5)), left: flat(at(C.cream, 3)), right: flat(at(C.cream, 4)) },
      solidBox({ x: 9, y: 38, z: 20, w: 4, d: 4, h: 3.5 }, C.terracotta, 3),
      volume(7, 35, 23, 8, 10, 8),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 15, D),
      extra: (c, p) => {
        const b = p(11.5, 9, 20);
        c.rect(b.x - 2, b.y - 1, 5, 1, at(C.woodDark, 2));
        c.rect(b.x - 1, b.y - 3, 3, 2, at(C.gold, 4));
        c.set(b.x - 1, b.y - 3, at(C.gold, 5));
        c.set(b.x, b.y - 4, at(C.metal, 3));
        // Pluma sobre el libro.
        const q = p(11.5, 21, 21.5);
        c.line(q.x - 2, q.y + 1, q.x + 2, q.y - 1, at(C.metal, 1));
        // Suculenta.
        const s = p(11, 40, 23.5);
        c.ellipse(s.x, s.y - 1, 3, 2, at(C.leaf, 3));
        c.set(s.x - 1, s.y - 2, at(C.leaf, 5));
        c.set(s.x + 1, s.y - 2, at(C.leaf, 4));
        c.set(s.x, s.y - 3, at(C.rose, 4));
      },
    },
  );
}

/** Consola del recibidor: mesa angosta con lámpara, florero y una bandeja; abajo dos canastos. */
function consoleTable(): Sprite {
  const wd = C.woodDark;
  const basket: Shader = (u, v) => ((Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2 ? at(C.cork, 3) : at(C.cork, 2));
  return renderSprite(
    [
      leg(1, 1, 16, wd),
      leg(1, 29, 16, wd),
      leg(7, 1, 16, wd),
      leg(7, 29, 16, wd),
      { x: 1, y: 2, z: 3, w: 8, d: 28, h: 1.2, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      { x: 2, y: 4, z: 4.2, w: 6, d: 10, h: 6, top: flat(at(C.cork, 1)), left: basket, right: basket },
      { x: 2, y: 17, z: 4.2, w: 6, d: 10, h: 6, top: flat(at(C.cork, 1)), left: basket, right: basket },
      { x: 0, y: 0, z: 16, w: 10, d: 32, h: 2, top: woodTop(wd, 8), left: flat(at(wd, 2)), right: (u) => (Math.abs(u - 16) < 1 ? at(C.gold, 4) : at(wd, 3)) },
      // Lámpara de cerámica con pantalla.
      { x: 2.5, y: 4, z: 18, w: 5, d: 5, h: 7, top: flat(at(C.sage, 4)), left: (_u, v) => at(C.sage, v > 4 ? 4 : 3), right: (_u, v) => at(C.sage, v > 4 ? 3 : 2) },
      solidBox({ x: 4.5, y: 6, z: 25, w: 1, d: 1, h: 2 }, C.gold, 4),
      { x: 1.5, y: 3, z: 27, w: 7, d: 7, h: 6, top: flat(at(C.cream, 5)), left: flat(at(C.cream, 4)), right: flat(at(C.cream, 3)) },
      // Bandeja con llaves y un florero con una rama.
      solidBox({ x: 3, y: 14, z: 18, w: 5, d: 6, h: 0.8 }, C.gold, 3),
      solidBox({ x: 3.5, y: 24, z: 18, w: 3, d: 3, h: 6 }, C.white, 3),
      volume(0, 20, 24, 10, 10, 9),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 10, 32),
      extra: (c, p) => {
        const k = p(5.5, 17, 19);
        c.set(k.x, k.y, at(C.metal, 4));
        c.set(k.x + 1, k.y, at(C.metal, 3));
        const v = p(5, 25.5, 24);
        c.line(v.x, v.y, v.x - 3, v.y - 7, at(C.woodDark, 2));
        c.line(v.x, v.y, v.x + 2, v.y - 6, at(C.woodDark, 2));
        for (const [dx, dy] of [
          [-3, -7],
          [-2, -5],
          [2, -6],
          [1, -4],
          [-1, -8],
        ])
          c.set(v.x + dx!, v.y + dy!, at(C.rose, 5));
      },
    },
  );
}

/** Banca del recibidor: cojín largo encima y casilleros con zapatos y canastos abajo. */
function entryBench(): Sprite {
  const wd = C.wood;
  const cubbies: Shader = (u, v, fw, fh) => {
    if (u < 1.2 || u >= fw - 1.2 || v < 1 || v >= fh - 1) return at(wd, u < 0.6 || v >= fh - 0.5 ? 4 : 2);
    const n = 3;
    const cw = (fw - 2.4) / n;
    const k = Math.floor((u - 1.2) / cw);
    const cu = u - 1.2 - k * cw;
    if (cu < 0.8) return at(wd, 2);
    const y = v - 1;
    if (k === 1) return y < 5 ? ((Math.floor(cu / 1.3) + Math.floor(y / 1.3)) % 2 ? at(C.cork, 3) : at(C.cork, 2)) : at(C.woodDark, 1);
    // Par de zapatos.
    const shoe = k === 0 ? C.rug : C.fabric;
    if (y < 2.2 && (cu > 1.3 && cu < 4.5 ? true : cu > 5 && cu < cw - 0.8)) return y > 1.5 ? at(shoe, 4) : at(shoe, 2);
    if (y < 3.8 && ((cu > 1.3 && cu < 2.6) || (cu > 5 && cu < 6.3))) return at(shoe, 3);
    return at(C.woodDark, 1);
  };
  return renderSprite(
    [
      { x: 1, y: 0, z: 0, w: 13, d: 32, h: 10, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: cubbies },
      cushion(1.5, 0.5, 10, 12, 31, 3, C.sage),
      cushion(3, 22, 13, 8, 7, 4, C.mustard),
    ],
    { outline: OUT, under: shadowUnder(1, 0, 13, 32) },
  );
}

/** Paragüero de cerámica azul con dos paraguas y un bastón. */
function umbrellaStand(): Sprite {
  const pot: Shader = (u, v, _fw, fh) => (Math.abs(v - fh * 0.6) < 0.8 ? at(C.white, 4) : Math.abs(v - fh * 0.6) < 1.6 ? at(C.blue, 4) : at(C.blue, u < 3 ? 3 : 2));
  return renderSprite(
    [
      { x: 4, y: 4, z: 0, w: 8, d: 8, h: 14, top: flat(at(C.blue, 0)), left: pot, right: pot },
      ...slant([7, 7, 12], [5, 6, 28], 2.2, C.rug, 3),
      ...slant([9, 8, 12], [11, 10, 26], 2.2, C.sage, 3),
      ...slant([8, 10, 12], [8, 11, 25], 1, C.woodDark, 4),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 5),
      extra: (c, p) => {
        for (const [x, y, z, r] of [
          [5, 6, 28, C.woodDark],
          [11, 10, 26, C.woodDark],
          [8, 11, 25, C.woodDark],
        ] as const) {
          const q = p(x, y, z);
          c.set(q.x, q.y - 1, at(r, 4));
          c.set(q.x + 1, q.y - 2, at(r, 4));
          c.set(q.x + 2, q.y - 1, at(r, 3));
        }
      },
    },
  );
}

/** Inodoro de porcelana: tanque contra la pared (-x), taza ovalada y tapa. */
function toilet(): Sprite {
  const P = PORCELAIN;
  return renderSprite(
    [
      solidBox({ x: 1, y: 3, z: 0, w: 5, d: 10, h: 20 }, P, 3),
      { x: 0.5, y: 2.5, z: 20, w: 6, d: 11, h: 1.5, top: flat(at(P, 4)), left: flat(at(P, 2)), right: flat(at(P, 3)) },
      solidBox({ x: 3, y: 10.5, z: 17, w: 2, d: 1.5, h: 1 }, C.metal, 4),
      volume(4, 3, 0, 11, 10, 11),
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 3, 13, 10),
      extra: (c, p) => {
        // Taza: pie, borde ovalado y la tapa levantada no: tapa cerrada con su bisagra.
        const b = p(10, 8, 0);
        const top = p(10, 8, 9);
        blob(c, b.x, (b.y + top.y) / 2 + 1, 4.5, (b.y - top.y) / 2 + 1, (nx, ny, x, y) => roundTone(P, nx, ny, x, y, 3));
        blob(c, top.x, top.y, 8, 4.3, (nx, ny, x, y) => (nx * nx + ny * ny > 0.72 ? at(P, 4) : roundTone(P, nx, ny, x, y, 3, 1)));
        blob(c, top.x - 0.5, top.y - 1.5, 7, 3.6, (nx, ny) => (ny < -0.6 ? at(P, 5) : at(P, 4)));
        const h = p(5.5, 8, 10.5);
        c.rect(h.x - 1, h.y - 1, 3, 2, at(P, 1));
      },
    },
  );
}

/** Lavamanos (tocador) sobre un mueble de madera: lavatorio blanco, grifo, jabón y una toalla colgando. */
function vanity(): Sprite {
  const wd = C.wood;
  return renderSprite(
    [
      { x: 0, y: 1, z: 0, w: 11, d: 14, h: 13, top: flat(at(wd, 4)), left: flat(at(wd, 2)), right: doorsFace(wd, 7, { base: 1, top: 0.6 }) },
      { x: 0, y: 0.5, z: 13, w: 12, d: 15, h: 1.5, top: (u, v, fw, fh) => (Math.hypot((u - fw * 0.6) / 3.8, (v - fh / 2) / 5.2) < 1 ? (Math.hypot((u - fw * 0.6) / 3.8, (v - fh / 2) / 5.2) < 0.75 ? at(PORCELAIN, 2) : at(PORCELAIN, 4)) : at(PORCELAIN, 3)), left: flat(at(PORCELAIN, 2)), right: flat(at(PORCELAIN, 3)) },
      solidBox({ x: 1.5, y: 7, z: 14.5, w: 1.5, d: 1.5, h: 5 }, C.metal, 4),
      solidBox({ x: 1.5, y: 7, z: 19, w: 4, d: 1.5, h: 1.2 }, C.metal, 4),
      solidBox({ x: 1.5, y: 2, z: 14.5, w: 2.5, d: 2.5, h: 3.5 }, C.rose, 4),
      // Toalla colgada del costado.
      { x: 3, y: 15.5, z: 3, w: 6, d: 1, h: 9, top: flat(at(C.sage, 4)), left: (u, v) => (v < 1.5 || Math.abs(v - 3) < 0.4 ? at(C.cream, 5) : at(C.sage, Math.floor(u) % 2 ? 3 : 4)), right: flat(at(C.sage, 2)) },
    ],
    { outline: OUT, under: shadowUnder(0, 1, 12, 14) },
  );
}

// ---------- Cafetería y cocina ----------

/** Mueble bajo de cocina: cajones, puertas y la cubierta. `extra` pone lo que va encima. */
function baseCabinet(top: Shader, face = doorsFace(C.sage, 7, { base: 1.5, top: 0.8, drawers: 1 })): Box[] {
  return [
    { x: 0, y: 0, z: 0, w: 12, d: 16, h: 14, top: flat(at(C.sage, 3)), left: flat(at(C.sage, 2)), right: face },
    { x: 0, y: 0, z: 14, w: 13.5, d: 16, h: 2, top, left: flat(at(C.wood, 2)), right: (_u, v) => at(C.wood, v >= 1.2 ? 4 : 2) },
  ];
}
const butcher: Shader = (u, v) => at(C.wood, (Math.floor(v / 2.5) + (Math.floor(u / 7) % 2)) % 2 ? 4 : 5);

/** Estante del bar de la cafetería: mueble bajo con molino, tazas apiladas, sifones de jarabe y galletas. */
function backbar(): Sprite {
  const wd = C.woodDark;
  const syrup = (y: number, r: Ramp): Box[] => [
    { x: 3, y, z: 16, w: 2.4, d: 2.4, h: 6, top: flat(at(r, 2)), left: (_u, v) => (Math.abs(v - 3) < 1 ? at(C.cream, 5) : at(r, 3)), right: (_u, v) => (Math.abs(v - 3) < 1 ? at(C.cream, 4) : at(r, 2)) },
    solidBox({ x: 3.7, y: y + 0.7, z: 22, w: 1, d: 1, h: 2 }, C.metal, 1),
  ];
  const cups = (x: number, y: number, n: number): Box[] =>
    Array.from({ length: n }, (_, i) => ({ x, y, z: 16 + i * 2, w: 3, d: 3, h: 2, top: flat(at(C.cream, 5)), left: (_u: number, v: number) => (v < 0.5 ? at(C.cream, 2) : at(C.cream, 4)), right: flat(at(C.cream, 3)) }));
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 11, d: 32, h: 14, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: doorsFace(wd, 10.5, { base: 1.2, top: 0.6, drawers: 1 }) },
      { x: 0, y: 0, z: 14, w: 12, d: 32, h: 2, top: (u, v) => at(C.stone, noise(Math.floor(u / 3), Math.floor(v / 3), 6) < 0.2 ? 3 : 4), left: flat(at(C.stone, 2)), right: flat(at(C.stone, 3)) },
      // Molino de café con su tolva de granos.
      solidBox({ x: 2, y: 3, z: 16, w: 5, d: 5, h: 7 }, C.metal, 2),
      { x: 2.5, y: 3.5, z: 23, w: 4, d: 4, h: 5, top: flat(at(C.woodDark, 2)), left: (u, v) => (v < 4 && u > 0.5 ? at(C.woodDark, 1 + (Math.floor(u + v) % 2)) : at(C.white, 4)), right: (u, v) => (v < 4 && u > 0.5 ? at(C.woodDark, 2) : at(C.white, 3)) },
      ...cups(3, 10, 4),
      ...cups(6.5, 11, 2),
      ...syrup(15, C.rug),
      ...syrup(18, C.mustard),
      ...syrup(21, C.green),
      // Frasco de galletas.
      { x: 2.5, y: 25, z: 16, w: 5, d: 5, h: 6, top: flat(alpha(at(C.sky, 4), 0.5)), left: (u, v) => (v < 4 && noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 3) < 0.6 ? at(C.wood, 4) : alpha(at(C.sky, 4), 0.5)), right: (u, v) => (v < 4 && noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 8) < 0.6 ? at(C.wood, 3) : alpha(at(C.sky, 4), 0.4)) },
      solidBox({ x: 3, y: 25.5, z: 22, w: 4, d: 4, h: 1.2 }, C.wood, 3),
    ],
    { outline: OUT, under: shadowUnder(0, 0, 12, 32) },
  );
}

/** Mesón de cocina: tabla de picar con verduras, un tazón y un frasco con cucharas de palo. */
function kitchenCounter(): Sprite {
  return renderSprite(
    [
      ...baseCabinet(butcher),
      solidBox({ x: 3, y: 2, z: 16, w: 7, d: 9, h: 1 }, C.wood, 5),
      solidBox({ x: 4.5, y: 11, z: 16, w: 4, d: 4, h: 3.5 }, C.cream, 4),
      solidBox({ x: 1.5, y: 12, z: 16, w: 2.5, d: 2.5, h: 4 }, C.terracotta, 3),
      volume(0, 0, 16, 13, 16, 10),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, 16),
      extra: (c, p) => {
        // Zanahoria, tomates y un cuchillo sobre la tabla.
        const t = p(6.5, 6, 17);
        c.line(t.x - 3, t.y, t.x + 1, t.y - 2, at(C.fire, 3));
        c.set(t.x + 2, t.y - 3, at(C.leaf, 4));
        c.ellipse(t.x + 3, t.y + 1, 1.6, 1.3, at(C.rug, 3));
        c.set(t.x + 2, t.y, at(C.rug, 5));
        c.line(t.x - 4, t.y + 2, t.x - 1, t.y + 4, at(C.metal, 4));
        // Cucharas de palo en el frasco.
        const f = p(2.7, 13.2, 20);
        c.line(f.x, f.y, f.x - 1, f.y - 5, at(C.wood, 4));
        c.line(f.x + 1, f.y, f.x + 2, f.y - 4, at(C.wood, 3));
        c.set(f.x - 1, f.y - 6, at(C.wood, 4));
        // Masa en el tazón.
        const m = p(6.5, 13, 19.5);
        c.ellipse(m.x, m.y, 2.5, 1.2, at(C.cream, 5));
      },
    },
  );
}

/** Lavaplatos: poceta de metal empotrada, grifo de cuello de cisne y un escurridor con platos. */
function kitchenSink(): Sprite {
  const top: Shader = (u, v, fw, fh) => {
    if (u > 2.5 && u < fw - 3 && v > 2 && v < fh - 5) {
      if (u < 3.5 || v < 3) return at(C.metal, 1);
      return at(C.metal, u > fw - 5 ? 4 : 3);
    }
    return butcher(u, v, fw, fh);
  };
  return renderSprite(
    [
      ...baseCabinet(top, doorsFace(C.sage, 8, { base: 1.5, top: 0.8 })),
      solidBox({ x: 1, y: 6, z: 16, w: 1.5, d: 1.5, h: 7 }, C.metal, 4),
      solidBox({ x: 1, y: 6, z: 22, w: 5, d: 1.5, h: 1.3 }, C.metal, 4),
      solidBox({ x: 5, y: 6, z: 20.5, w: 1, d: 1.5, h: 1.5 }, C.metal, 3),
      // Escurridor con platos parados.
      solidBox({ x: 3, y: 11.5, z: 16, w: 8, d: 4, h: 1 }, C.metal, 3),
      ...[4, 6, 8].map((x) => ({ x, y: 12, z: 17, w: 1, d: 3.5, h: 5, top: flat(at(PORCELAIN, 4)), left: flat(at(PORCELAIN, 3)), right: (u: number, v: number, fw: number, fh: number) => (Math.hypot(u - fw / 2, v - fh / 2) < 1 ? at(C.blue, 3) : at(PORCELAIN, 4)) })),
    ],
    { outline: OUT, under: shadowUnder(0, 0, 13, 16) },
  );
}

/** Estufa con horno: puerta con ventana, perillas, hornillas, una olla que humea y la campana arriba. */
function stove(): Sprite {
  const m = C.metal;
  const ovenFace: Shader = (u, v, fw, fh) => {
    if (v < 1.5) return at(m, 0);
    if (v >= fh - 3.5) {
      // Tablero de perillas.
      if (Math.floor(v) === Math.floor(fh - 2) && mod(u, 3.2) > 1.2 && mod(u, 3.2) < 2.4) return at(C.cream, 5);
      return at(m, 4);
    }
    if (Math.abs(v - (fh - 5.2)) < 0.6 && u > 2 && u < fw - 2) return at(C.gold, 4);
    if (u > 2.5 && u < fw - 2.5 && v > 3.5 && v < fh - 7) return v > fh - 9.5 ? at(C.fire, 1) : at(m, 0);
    return at(m, u < 1 ? 5 : 3);
  };
  const burners: Shader = (u, v, fw, fh) => {
    for (const [cu, cv] of [
      [4, 4],
      [4, 12],
      [9.5, 4],
      [9.5, 12],
    ])
      if (Math.hypot(u - cu!, v - cv!) < 2.2) return Math.hypot(u - cu!, v - cv!) < 1 ? at(C.fire, 3) : at(m, 0);
    return edgeOf(u, v, fw, fh) < 0.8 ? at(m, 3) : at(m, 1);
  };
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 13, d: 16, h: 16, top: burners, left: flat(at(m, 2)), right: ovenFace },
      solidBox({ x: 0, y: 0, z: 16, w: 2.5, d: 16, h: 4 }, m, 3),
      // Olla de cobre y sartén.
      { x: 2, y: 9, z: 16, w: 5, d: 5, h: 4.5, top: flat(at(C.metal, 1)), left: flat(at(C.terracotta, 4)), right: flat(at(C.terracotta, 3)) },
      solidBox({ x: 7.5, y: 2, z: 16, w: 4, d: 4, h: 1 }, C.metal, 1),
      solidBox({ x: 11.5, y: 3.5, z: 16.3, w: 3, d: 1, h: 0.7 }, C.woodDark, 3),
      // Campana extractora y su tubo hasta el techo.
      { x: 0, y: 0, z: 34, w: 11, d: 16, h: 5, top: flat(at(m, 3)), left: flat(at(m, 2)), right: (u, v, fw) => (v < 1 ? at(m, 1) : u < 1 || u > fw - 1 ? at(m, 2) : at(m, 4)) },
      { x: 0, y: 4, z: 39, w: 5, d: 8, h: 15, top: flat(at(m, 3)), left: flat(at(m, 2)), right: flat(at(m, 3)) },
      volume(2, 9, 20, 5, 5, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, 16),
      extra: (c, p) => {
        const s = p(4.5, 11.5, 21);
        for (let i = 0; i < 4; i++) c.set(s.x + (i % 2 ? 1 : -1), s.y - 2 - i * 2, alpha(at(C.white, 4), 0.7 - i * 0.14));
        // Luz bajo la campana.
        const l = p(8, 8, 34);
        c.rect(l.x - 2, l.y, 4, 1, at(C.gold, 5));
      },
    },
  );
}

/** Nevera retro color menta: esquinas redondeadas, manija cromada, imanes y una nota. */
function fridge(): Sprite {
  const f = MINT;
  const H = 40;
  const face: Shader = (u, v, fw, fh) => {
    const round = (u < 1 && (v < 1 || v > fh - 1)) || (u > fw - 1 && (v < 1 || v > fh - 1));
    if (round) return null;
    if (Math.abs(v - fh * 0.66) < 0.5) return at(f, 1);
    if (Math.abs(u - 2.5) < 0.8 && ((v > fh * 0.72 && v < fh * 0.9) || (v > fh * 0.4 && v < fh * 0.6))) return at(C.white, 4);
    // Nota pegada con un imán.
    if (u > fw - 8 && u < fw - 3 && v > fh * 0.35 && v < fh * 0.5) return Math.floor(v) % 2 === 0 && u > fw - 7.4 && u < fw - 3.6 ? at(C.cream, 2) : at(C.cream, 5);
    if (Math.hypot(u - (fw - 5.5), v - fh * 0.51) < 0.9) return at(C.rug, 3);
    if (Math.hypot(u - (fw - 4), v - fh * 0.8) < 0.9) return at(C.gold, 4);
    if (Math.hypot(u - (fw - 7), v - fh * 0.76) < 0.9) return at(C.blue, 3);
    if (v < 2) return at(f, 1);
    return at(f, u < 1.5 ? 4 : 3);
  };
  return renderSprite(
    [
      solidBox({ x: 1, y: 1, z: 0, w: 11, d: 14, h: 1.5 }, C.metal, 1),
      { x: 0.5, y: 0.5, z: 1.5, w: 12, d: 15, h: H, top: (u, v, fw, fh) => (edgeOf(u, v, fw, fh) < 1 ? at(f, 4) : at(f, 5)), left: (u, v, fw, fh) => (v > fh - 1 && u > fw - 1 ? null : at(f, 2)), right: face },
      // Frutero encima.
      solidBox({ x: 3, y: 4, z: H + 1.5, w: 6, d: 7, h: 2 }, C.cork, 3),
      volume(2, 3, H + 3.5, 8, 9, 4),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, 16),
      extra: (c, p) => {
        const q = p(6, 7.5, H + 4);
        c.ellipse(q.x - 2, q.y, 1.8, 1.5, at(C.rug, 3));
        c.ellipse(q.x + 1, q.y - 1, 1.8, 1.5, at(C.gold, 4));
        c.line(q.x - 1, q.y - 2, q.x + 3, q.y - 3, at(C.mustard, 4));
      },
    },
  );
}

/** Isla de cocina: mesón grande de madera con cajones, pan, frutas y una olla; ollas colgando al costado. */
function kitchenIsland(): Sprite {
  const W = 32;
  const D = 48;
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: W - 4, d: D - 4, h: 14, top: flat(at(C.sage, 3)), left: doorsFace(C.sage, 9, { base: 1.5, top: 0.8, drawers: 1 }), right: doorsFace(C.sage, 11, { base: 1.5, top: 0.8, drawers: 1 }) },
      { x: 0, y: 0, z: 14, w: W, d: D, h: 2.5, top: butcher, left: flat(at(C.wood, 2)), right: (_u, v) => at(C.wood, v >= 1.5 ? 4 : 2) },
      // Tabla con pan, frutero, olla y un rollo de cocina.
      solidBox({ x: 5, y: 6, z: 16.5, w: 10, d: 12, h: 1 }, C.wood, 5),
      { x: 7, y: 8, z: 17.5, w: 5, d: 8, h: 3.5, top: (u, v) => (Math.floor(u + v) % 4 === 0 ? at(C.cork, 2) : at(C.cork, 4)), left: flat(at(C.cork, 3)), right: flat(at(C.cork, 2)) },
      solidBox({ x: 17, y: 30, z: 16.5, w: 8, d: 8, h: 2 }, C.cream, 4),
      { x: 18, y: 8, z: 16.5, w: 7, d: 7, h: 6, top: flat(at(C.metal, 1)), left: flat(at(C.metal, 4)), right: flat(at(C.metal, 3)) },
      solidBox({ x: 17, y: 11, z: 20, w: 1, d: 1.2, h: 1 }, C.metal, 2),
      solidBox({ x: 6, y: 36, z: 16.5, w: 3, d: 3, h: 5 }, C.white, 4),
      volume(16, 29, 18.5, 10, 10, 4),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, W, D),
      extra: (c, p) => {
        const f = p(21, 34, 19);
        for (const [dx, dy, r] of [
          [-2, 0, C.rug],
          [1, 0, C.mustard],
          [0, -2, C.leaf],
          [3, -1, C.rug],
          [-1, -3, C.fire],
        ] as const)
          c.ellipse(f.x + dx, f.y + dy, 1.8, 1.5, at(r, 3));
      },
    },
  );
}

/** Despensa: estantería alta abierta con frascos, sacos de harina, botellas y latas. */
function pantryShelf(): Sprite {
  const wd = C.wood;
  const H = 48;
  const face: Shader = (u, v, fw, fh) => {
    if (u < 1.4 || u >= fw - 1.4) return at(wd, u < 0.7 ? 4 : 2);
    if (v < 1.5) return at(wd, 1);
    if (v >= fh - 1.5) return at(wd, 4);
    const sh = (fh - 3) / 4;
    const s = Math.floor((v - 1.5) / sh);
    const lv = v - 1.5 - s * sh;
    if (lv < 1) return at(wd, 4);
    const y = lv - 1;
    const slot = Math.floor((u - 1.4) / 4.8);
    const su = mod(u - 1.4, 4.8);
    const kind = Math.floor(noise(slot, s, 57) * 4);
    if (s === 0) {
      // Sacos de harina y papas abajo.
      if (Math.hypot(su - 2.4, (y - 3.5) * 0.7) < 2.6) return at(slot % 2 ? C.cream : C.cork, su < 2.4 ? 4 : 3);
      return at(C.woodDark, 1);
    }
    if (kind === 0 && su > 0.6 && su < 4.2 && y < 6.5) return y > 5.5 ? at(C.woodDark, 3) : su < 1.2 ? at(C.white, 4) : at([C.rug, C.mustard, C.leaf, C.cork, C.fire][(slot + s) % 5]!, y < 3 ? 2 : 3);
    if (kind === 1 && su > 1.4 && su < 3.4 && y < 8) return y > 6 ? at(C.cork, 3) : at(slot % 2 ? C.green : C.rug, su < 2 ? 4 : 2);
    if (kind === 2 && su > 0.5 && su < 4.3 && y < 4) return Math.floor(y) === 2 ? at(C.cream, 5) : at(C.metal, su < 1.2 ? 5 : 3);
    return at(C.woodDark, y > sh - 3 ? 0 : 1);
  };
  return renderSprite(
    [{ x: 0, y: 0, z: 0, w: 10, d: 32, h: H, top: flat(at(wd, 4)), left: (u, _v, fw) => at(wd, u >= fw - 1 ? 3 : 2), right: face }],
    { outline: OUT, under: shadowUnder(0, 0, 10, 32) },
  );
}

/** Cafetera de oficina sobre un mueblecito: máquina de granos, tazas y el azucarero. */
function coffeeStation(): Sprite {
  const m = C.metal;
  const machine: Shader = (u, v, fw, fh) => {
    if (v > fh - 4 && v < fh - 1 && u > 1.5 && u < fw - 1.5) return v > fh - 2.2 ? at(C.screen, 4) : at(C.screen, 2);
    if (Math.abs(u - fw / 2) < 2 && v > 2 && v < 7) return at(m, 0);
    if (Math.abs(u - fw / 2) < 0.6 && v >= 7 && v < 8.5) return at(m, 4);
    return at(m, u < 1 ? 2 : 1);
  };
  return renderSprite(
    [
      ...baseCabinet(butcher, doorsFace(C.wood, 7, { base: 1.5, top: 0.8, drawers: 1 })),
      { x: 1, y: 3, z: 16, w: 8, d: 9, h: 13, top: flat(at(m, 2)), left: flat(at(m, 1)), right: machine },
      solidBox({ x: 7, y: 6, z: 16.5, w: 2.4, d: 2.4, h: 2.5 }, C.cream, 4),
      solidBox({ x: 2, y: 12.5, z: 16, w: 3, d: 3, h: 3 }, C.rug, 3),
      solidBox({ x: 6, y: 12.5, z: 16, w: 3, d: 3, h: 3 }, C.blue, 3),
      solidBox({ x: 10, y: 3, z: 16, w: 3, d: 3, h: 3.5 }, PORCELAIN, 3),
      volume(1, 3, 29, 8, 9, 5),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, 16),
      extra: (c, p) => {
        const s = p(8, 7, 20);
        c.set(s.x, s.y - 1, alpha(at(C.white, 4), 0.6));
        c.set(s.x + 1, s.y - 3, alpha(at(C.white, 4), 0.4));
      },
    },
  );
}

/** Mesa alta redonda de pie central y aro para los pies. */
function highTable(): Sprite {
  const top: Shader = (u, v, fw, fh) => (Math.hypot(u - fw / 2, v - fh / 2) > fw / 2 - 1.2 ? at(C.wood, 3) : at(C.wood, noise(Math.floor(u / 4), 1, 2) < 0.5 ? 4 : 5));
  return renderSprite(
    [
      solidBox({ x: 4, y: 4, z: 0, w: 8, d: 8, h: 1.5 }, C.metal, 1),
      solidBox({ x: 7, y: 7, z: 1.5, w: 2, d: 2, h: 19 }, C.metal, 2),
      solidBox({ x: 5, y: 5, z: 7, w: 6, d: 6, h: 0.8 }, C.gold, 3),
      { x: 2, y: 2, z: 20.5, w: 12, d: 12, h: 2, top, left: flat(at(C.wood, 2)), right: flat(at(C.wood, 3)) },
      solidBox({ x: 5, y: 8, z: 22.5, w: 3, d: 3, h: 3 }, C.cream, 4),
      shadowSpace(2, 2, 12, 12),
    ],
    { outline: OUT, under: roundShadow(8, 8, 6) },
  );
}

/** Dispensador de agua: botellón azul sobre el mueble blanco, con dos grifos y vasitos. */
function waterCooler(): Sprite {
  const body: Shader = (u, v, fw, fh) => {
    if (v > fh - 7 && v < fh - 3 && Math.abs(u - fw / 2) < 3.5) {
      if (Math.abs(v - (fh - 5)) < 1 && (Math.abs(u - fw / 2 - 1.6) < 0.8 || Math.abs(u - fw / 2 + 1.6) < 0.8)) return Math.abs(u - fw / 2 - 1.6) < 0.8 ? at(C.rug, 3) : at(C.blue, 3);
      return at(PORCELAIN, 1);
    }
    return at(PORCELAIN, u < 1 ? 4 : 3);
  };
  return renderSprite(
    [
      { x: 3, y: 3, z: 0, w: 10, d: 10, h: 22, top: flat(at(PORCELAIN, 4)), left: flat(at(PORCELAIN, 2)), right: body },
      solidBox({ x: 13, y: 11, z: 10, w: 2, d: 2, h: 5 }, PORCELAIN, 3),
      volume(2, 2, 22, 12, 12, 16),
    ],
    {
      outline: OUT,
      under: shadowUnder(3, 3, 10, 10),
      extra: (c, p) => {
        const b = p(8, 8, 22);
        const t = p(8, 8, 36);
        blob(c, b.x, (b.y + t.y) / 2, 5.5, (b.y - t.y) / 2, (nx, ny, x, y) => {
          const col = roundTone(C.sky, nx, ny, x, y, 2);
          if (Math.abs(ny + 0.1) < 0.12 || Math.abs(ny - 0.4) < 0.08) return at(C.sky, 1);
          return alpha(col, 0.92);
        });
        c.set(t.x - 2, t.y + 3, at(C.white, 4));
        c.set(t.x - 3, t.y + 5, at(C.white, 4));
        c.rect(b.x - 2, b.y - 1, 4, 2, at(C.blue, 2));
      },
    },
  );
}

/** Pizarra de pie en A con el dibujo de una taza y los precios escritos con tiza. */
function cafeSign(): Sprite {
  const board: Shader = (u, v, fw, fh) => {
    if (edgeOf(u, v, fw, fh) < 1.2) return at(C.wood, u < 1 ? 4 : 3);
    const x = u - fw / 2;
    const y = v;
    // Taza con vapor.
    if (y > fh - 9 && y < fh - 4 && Math.abs(x) < 2.6 && !(y > fh - 5 && Math.abs(x) < 1.8)) return at(C.cream, 5);
    if (y > fh - 8 && y < fh - 6 && x > 2.6 && x < 3.6) return at(C.cream, 5);
    if (y >= fh - 4 && y < fh - 2 && (Math.abs(x + 0.8 - Math.sin(y) * 0.6) < 0.4 || Math.abs(x - 1 - Math.sin(y) * 0.6) < 0.4)) return at(C.cream, 4);
    // Renglones de precios.
    for (const [ry, len] of [
      [8, 7],
      [5.5, 5],
      [3, 6],
    ] as const)
      if (Math.abs(y - ry) < 0.5 && x > -4 && x < -4 + len && Math.floor(u) % 3 !== 0) return at(C.cream, 4);
    if (Math.abs(y - 8) < 0.5 && x > 3.5 && x < 5) return at(C.mustard, 4);
    return at(C.green, 0);
  };
  return renderSprite(
    [
      ...slant([4, 5, 0], [7, 5, 24], 1.2, C.wood, 3),
      ...slant([4, 11, 0], [7, 11, 24], 1.2, C.wood, 3),
      { x: 8, y: 3, z: 1, w: 1.2, d: 10, h: 22, top: flat(at(C.wood, 4)), left: flat(at(C.wood, 3)), right: board },
    ],
    { outline: OUT, under: shadowUnder(3, 3, 8, 10, 0.22) },
  );
}

// ---------- Trabajo ----------

/** Mesa de juntas larga de nogal con una franja incrustada, laptops, cuadernos, vasos y una jarra. */
function conferenceTable(): Sprite {
  const wd = C.woodDark;
  const W = 32;
  const D = 80;
  const top: Shader = (u, v, fw, fh) => {
    if (edgeOf(u, v, fw, fh) < 1) return at(wd, 4);
    if (Math.abs(u - fw / 2) < 1.2) return at(C.gold, 3);
    return at(wd, noise(Math.floor(v / 9), Math.floor(u / 14), 4) < 0.5 ? 4 : 5);
  };
  const laptop = (x: number, y: number, screenAt: "x" | "hi"): Box[] => [
    solidBox({ x, y, z: 15, w: 6, d: 8, h: 0.8 }, C.metal, 3),
    screenAt === "x"
      ? { x: x + 0.5, y, z: 15.8, w: 1.2, d: 8, h: 6, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: (u: number, v: number, fw: number, fh: number) => (edgeOf(u, v, fw, fh) < 0.8 ? at(C.metal, 1) : at(C.screen, v > fh - 2 ? 4 : 2)) }
      : { x: x + 4.5, y, z: 15.8, w: 1.2, d: 8, h: 6, top: flat(at(C.metal, 3)), left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
  ];
  const glass = (x: number, y: number): Box => ({ x, y, z: 15, w: 2, d: 2, h: 3, top: flat(at(C.sky, 4)), left: flat(alpha(at(C.sky, 4), 0.7)), right: flat(alpha(at(C.sky, 3), 0.7)) });
  return renderSprite(
    [
      // Dos pies en forma de placa.
      { x: 12, y: 8, z: 0, w: 8, d: 4, h: 12, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      { x: 12, y: D - 12, z: 0, w: 8, d: 4, h: 12, top: flat(at(wd, 3)), left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      { x: 1, y: 1, z: 12, w: W - 2, d: D - 2, h: 3, top, left: flat(at(wd, 2)), right: (_u, v) => at(wd, v >= 2 ? 4 : 2) },
      ...laptop(3, 12, "hi"),
      ...laptop(23, 40, "x"),
      ...laptop(3, 54, "hi"),
      solidBox({ x: 22, y: 16, z: 15, w: 6, d: 8, h: 0.8 }, C.cream, 4),
      solidBox({ x: 4, y: 32, z: 15, w: 5, d: 7, h: 0.8 }, C.rug, 3),
      glass(11, 20),
      glass(20, 30),
      glass(11, 62),
      glass(20, 66),
      { x: 14.5, y: 42, z: 15, w: 3, d: 3, h: 6, top: flat(at(C.sky, 4)), left: flat(alpha(at(C.sky, 4), 0.7)), right: flat(alpha(at(C.sky, 3), 0.7)) },
      volume(0, 0, 15, W, D, 7),
    ],
    { outline: OUT, under: shadowUnder(1, 1, W - 2, D - 2) },
  );
}

/** Archivador de tres cajones con etiquetas y una planta encima. */
function filingCabinet(): Sprite {
  const wd = C.wood;
  const face: Shader = (u, v, fw, fh) => {
    if (v < 1) return at(C.woodDark, 1);
    const dh = (fh - 1) / 3;
    const dv = mod(v - 1, dh);
    if (dv < 0.7) return at(wd, 1);
    if (Math.abs(u - fw / 2) < 2 && Math.abs(dv - dh * 0.7) < 1) return at(C.cream, 5);
    if (Math.abs(u - fw / 2) < 1.5 && Math.abs(dv - dh * 0.35) < 0.5) return at(C.gold, 4);
    return at(wd, u < 1 ? 4 : 3);
  };
  return renderSprite(
    [
      { x: 2, y: 2, z: 0, w: 11, d: 12, h: 22, top: woodTop(wd, 5), left: flat(at(wd, 2)), right: face },
      solidBox({ x: 5, y: 5, z: 22, w: 5, d: 5, h: 4 }, C.terracotta, 3),
      volume(0, 0, 26, 16, 16, 10),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 2, 11, 12),
      extra: (c, p) => {
        const b = p(7.5, 7.5, 26);
        for (const [dx, dy] of [
          [-4, -3],
          [3, -4],
          [0, -7],
          [-2, -6],
          [4, -1],
          [-4, 0],
        ]) {
          c.line(b.x, b.y, b.x + dx!, b.y + dy!, at(C.leaf, 2));
          c.ellipse(b.x + dx!, b.y + dy!, 1.8, 1.2, at(C.leaf, dy! < -4 ? 4 : 3));
        }
      },
    },
  );
}

/** Fotocopiadora sobre ruedas: tapa, bandeja de papel y el tablerito con luces. */
function printer(): Sprite {
  const m = C.cream;
  const face: Shader = (u, v, fw, fh) => {
    if (v < 1.5) return at(C.metal, 1);
    if (Math.abs(v - fh * 0.45) < 0.5 || Math.abs(v - fh * 0.2) < 0.5) return at(m, 1);
    if (Math.abs(u - fw / 2) < 2 && Math.abs(v - fh * 0.32) < 0.5) return at(C.metal, 2);
    return at(m, u < 1 ? 5 : 3);
  };
  return renderSprite(
    [
      { x: 1, y: 1, z: 1, w: 13, d: 14, h: 18, top: flat(at(m, 4)), left: flat(at(m, 2)), right: face },
      { x: 1, y: 1, z: 19, w: 13, d: 14, h: 2, top: flat(at(C.metal, 2)), left: flat(at(C.metal, 1)), right: flat(at(C.metal, 2)) },
      { x: 9, y: 3, z: 21, w: 5, d: 10, h: 1.5, top: (u, v) => (u > 2 && Math.floor(v) % 3 === 1 ? at(C.gold, 4) : at(C.metal, 3)), left: flat(at(C.metal, 2)), right: flat(at(C.metal, 3)) },
      // Bandeja de salida con hojas.
      { x: 14, y: 3, z: 12, w: 3, d: 10, h: 1, top: flat(at(C.white, 4)), left: flat(at(C.white, 3)), right: flat(at(C.white, 3)) },
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 16, 14),
      extra: (c, p) => {
        for (const y of [3, 12]) {
          const q = p(12, y, 0);
          c.rect(q.x - 1, q.y - 1, 2, 2, at(C.metal, 1));
        }
        const l = p(12, 5, 22.5);
        c.set(l.x, l.y, at(C.leaf, 5));
      },
    },
  );
}

// ---------- Afuera: balcón y terraza ----------

/**
 * Baranda de madera en el borde del tile: la de frente va sobre el borde +x (con "down", el sur), la de
 * espaldas sobre el borde -x (con "up", el norte). Postes en las puntas, balaustres y pasamanos.
 */
function railing(variant: Variant): Sprite {
  const w = C.wood;
  const x = variant === "back" ? 0.5 : 13;
  const post = (y: number): Box[] => [
    solidBox({ x, y, z: 0, w: 2.2, d: 2.2, h: 17 }, C.woodDark, 4),
    solidBox({ x: x - 0.3, y: y - 0.3, z: 17, w: 2.8, d: 2.8, h: 1.2 }, w, 5),
  ];
  const balusters: Box[] = [5, 10].map((y) => solidBox({ x: x + 0.8, y, z: 2.5, w: 1, d: 1, h: 12 }, w, 3));
  return renderSprite(
    [
      ...post(0),
      solidBox({ x: x + 0.4, y: 0, z: 1.5, w: 1.6, d: 16, h: 1 }, C.woodDark, 3),
      ...balusters,
      { x: x - 0.1, y: 0, z: 14.5, w: 2.4, d: 16, h: 1.6, top: flat(at(w, 5)), left: flat(at(w, 3)), right: flat(at(w, 4)) },
      ...post(13.8),
    ],
    { outline: OUT },
  );
}

/** Tumbona de madera: respaldo levantado, colchoneta a rayas y una toalla doblada. */
function deckChair(variant: Variant): Sprite {
  const back = variant === "back";
  const w = C.wood;
  const L = 32;
  const X = (x: number, len: number) => (back ? L - x - len : x);
  const stripe: Shader = (u, v) => (Math.floor((back ? u : u) / 3) % 2 ? at(C.cream, 5) : at(C.blue, 3));
  const stripeV: Shader = (_u, v) => (Math.floor(v / 3) % 2 ? at(C.cream, 5) : at(C.blue, 3));
  // Respaldo inclinado armado en escalones.
  const rest: Box[] = [];
  for (let i = 0; i < 7; i++) {
    const rx = back ? L - 4 - i * 1.3 : 2 + i * 1.3;
    rest.push({ x: rx, y: 2, z: 7 + (6 - i) * 2, w: 2.4, d: 12, h: 2.4, top: stripeV, left: flat(at(C.blue, 2)), right: flat(at(C.blue, 2)) });
  }
  const frame: Box[] = [leg(X(2, 2), 2, 6, w), leg(X(2, 2), 12, 6, w), leg(X(27, 2), 2, 5, w), leg(X(27, 2), 12, 5, w)];
  return renderSprite(
    [
      ...frame.slice(0, 2),
      { x: X(1, 30), y: 1, z: 5, w: 30, d: 14, h: 2, top: flat(at(w, 4)), left: (u) => (Math.floor(u) % 4 === 0 ? at(w, 1) : at(w, 3)), right: flat(at(w, 3)) },
      { x: X(10, 20), y: 2, z: 7, w: 20, d: 12, h: 2.5, top: stripe, left: flat(at(C.blue, 2)), right: flat(at(C.cream, 3)) },
      ...(back ? rest.reverse() : rest),
      ...frame.slice(2),
      solidBox({ x: X(20, 6), y: 5, z: 9.5, w: 6, d: 6, h: 1.5 }, C.rose, 4),
      shadowSpace(1, 1, 30, 14),
    ],
    { outline: OUT, under: shadowUnder(1, 1, 30, 14, 0.25) },
  );
}

/** Telescopio de bronce en su trípode de madera, apuntando al cielo hacia +x. */
function telescope(): Sprite {
  const tube: Box[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const r = 2.2 + t * 0.8;
    tube.push({ x: 3 + t * 11 - r / 2, y: 8 - r / 2, z: 20 + t * 9 - r / 2, w: r + 0.6, d: r, h: r, top: flat(at(C.gold, i > 5 ? 5 : 4)), left: flat(at(C.gold, 3)), right: flat(at(C.gold, 2)) });
  }
  return renderSprite(
    [
      ...slant([2, 4, 0], [8, 8, 19], 1.3, C.woodDark, 3),
      ...slant([2, 13, 0], [8, 8, 19], 1.3, C.woodDark, 3),
      ...tube,
      ...slant([13, 8, 0], [8, 8, 19], 1.3, C.woodDark, 4),
      solidBox({ x: 7, y: 7, z: 19, w: 2.5, d: 2.5, h: 2 }, C.metal, 2),
      shadowSpace(1, 2, 13, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 3, 11, 10, 0.22),
      extra: (c, p) => {
        const e = p(14.5, 8, 30);
        c.set(e.x, e.y, at(C.sky, 5));
        c.set(e.x + 1, e.y, at(C.white, 4));
      },
    },
  );
}

/** Jardinera de madera con lavanda, flores rojas y hierbas. */
function balconyPlanter(): Sprite {
  const w = C.wood;
  const slats: Shader = (u, v, _fw, fh) => (v >= fh - 1.5 ? at(w, 4) : mod(v, 3.5) < 0.6 ? at(w, 1) : at(w, 3));
  return renderSprite(
    [
      { x: 2, y: 1, z: 0, w: 12, d: 30, h: 10, top: flat(at(C.dirt, 1)), left: slats, right: slats },
      volume(0, 0, 10, 16, 32, 12),
    ],
    {
      outline: OUT,
      under: shadowUnder(2, 1, 12, 30),
      extra: (c: PixelCanvas, p: Project) => {
        // Matas de abajo hacia arriba (de atrás hacia adelante).
        for (let y = 4; y < 29; y += 3.2) {
          const kind = Math.floor(noise(Math.floor(y), 1, 33) * 3);
          const b = p(8, y, 10);
          if (kind === 0) {
            // Lavanda: tallos con espigas moradas.
            for (let k = -2; k <= 2; k++) {
              c.line(b.x + k, b.y, b.x + k * 1.5, b.y - 7, at(C.leaf, 2));
              c.set(b.x + k * 1.5, b.y - 7, at(C.violet, 4));
              c.set(b.x + k * 1.5, b.y - 6, at(C.violet, 3));
              c.set(b.x + k * 1.4, b.y - 5, at(C.violet, 4));
            }
          } else if (kind === 1) {
            c.ellipse(b.x, b.y - 3, 4, 3, at(C.leaf, 2));
            c.ellipse(b.x - 1, b.y - 4, 2.5, 2, at(C.leaf, 3));
            for (const [dx, dy] of [
              [-2, -5],
              [2, -4],
              [0, -2],
            ])
              c.rect(b.x + dx! - 1, b.y + dy! - 1, 2, 2, at(C.rug, 4));
          } else {
            c.ellipse(b.x, b.y - 2, 4, 2.4, at(C.green, 3));
            c.ellipse(b.x + 1, b.y - 3, 2, 1.6, at(C.green, 5));
          }
        }
      },
    },
  );
}

// ---------- Baños, probadores y cocina (segunda tanda) ----------

/**
 * Cubículo del baño: tabiques de laminado menta levantados del piso, puerta con pestillo verde y el
 * monito del baño, y el inodoro adentro (se asoma por arriba). Mira hacia +x (la puerta).
 */
function toiletStall(): Sprite {
  const P = PORCELAIN;
  const H = 34;
  const lam = MINT;
  // Tabique por fuera: laminado con un filo más claro arriba.
  const partition: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.2) return at(lam, 5);
    if (u < 0.8 || u >= fw - 0.8) return at(lam, 2);
    return at(lam, noise(Math.floor(u / 3), 1, 5) < 0.15 ? 4 : 3);
  };
  const door: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1.2) return at(lam, 5);
    if (u < 1 || u >= fw - 1) return at(lam, 2);
    // Bisagras a la izquierda, pestillo verde y tirador a la derecha.
    if (u < 2.2 && (Math.abs(v - 6) < 1 || Math.abs(v - fh + 6) < 1)) return at(C.metal, 4);
    if (u > fw - 4 && u < fw - 2 && Math.abs(v - fh * 0.55) < 1) return at(C.leaf, 5);
    if (u > fw - 4.2 && u < fw - 1.6 && Math.abs(v - fh * 0.45) < 0.6) return at(C.metal, 5);
    // El monito: cabeza redonda y cuerpo en trapecio, en una placa blanca.
    const cu = u - fw / 2;
    const pv = v - fh * 0.68;
    if (Math.abs(cu) < 3 && Math.abs(pv) < 4.4) {
      if (Math.hypot(cu, pv - 2.4) < 1.2) return at(C.blue, 2);
      if (pv < 1 && pv > -3.2 && Math.abs(cu) < 1.2 + (1 - pv) * 0.25) return at(C.blue, 2);
      return at(C.white, 4);
    }
    return at(lam, 3);
  };
  return renderSprite(
    [
      // Pared del fondo (azulejo) y el tabique de atrás, que se ve por dentro.
      { x: 0, y: 0, z: 0, w: 1.5, d: 16, h: H, top: flat(at(lam, 4)), left: flat(at(lam, 2)), right: (u, v) => (Math.floor(u / 4) % 2 === Math.floor(v / 4) % 2 ? at(C.cream, 5) : at(C.cream, 4)) },
      { x: 1.5, y: 0, z: 2, w: 28.5, d: 1, h: H - 2, top: flat(at(lam, 4)), left: (u, v) => at(lam, v >= H - 3.2 ? 5 : noise(Math.floor(u / 3), 2, 5) < 0.2 ? 3 : 2), right: flat(at(lam, 2)) },
      // El inodoro: tanque contra el fondo con su tapa y la palanca.
      solidBox({ x: 1.5, y: 4, z: 0, w: 5, d: 8, h: 19 }, P, 3),
      { x: 1.2, y: 3.6, z: 19, w: 5.8, d: 8.8, h: 1.5, top: flat(at(P, 4)), left: flat(at(P, 2)), right: flat(at(P, 3)) },
      solidBox({ x: 6.5, y: 5, z: 16, w: 1, d: 2, h: 1 }, C.metal, 4),
      // Portarrollos en el tabique de atrás.
      solidBox({ x: 11, y: 1, z: 12, w: 3, d: 2.5, h: 3 }, C.white, 3),
      volume(4, 3, 0, 12, 10, 11),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 32, 16, 0.22),
      extra: (c, p) => {
        const b = p(11, 8, 0);
        const top = p(11, 8, 9);
        blob(c, b.x, (b.y + top.y) / 2 + 1, 4, (b.y - top.y) / 2 + 1, (nx, ny, x, y) => roundTone(P, nx, ny, x, y, 3));
        blob(c, top.x, top.y, 7.5, 4, (nx, ny, x, y) => (nx * nx + ny * ny > 0.72 ? at(P, 4) : roundTone(P, nx, ny, x, y, 3, 1)));
        blob(c, top.x - 0.5, top.y - 1.3, 6.5, 3.3, (_nx, ny) => (ny < -0.6 ? at(P, 5) : at(P, 4)));
      },
      // Lo de adelante tapa la taza: el tabique del costado, los postes y la puerta.
      overlay: [
        { x: 1.5, y: 15, z: 2, w: 28.5, d: 1, h: H - 2, top: flat(at(lam, 5)), left: partition, right: flat(at(lam, 2)) },
        solidBox({ x: 30, y: 0, z: 0, w: 2, d: 1.5, h: H + 2 }, C.metal, 3),
        { x: 30.3, y: 1.5, z: 2, w: 1, d: 13, h: H - 3, top: flat(at(lam, 5)), left: flat(at(lam, 2)), right: door },
        solidBox({ x: 30, y: 14.5, z: 0, w: 2, d: 1.5, h: H + 2 }, C.metal, 4),
        // Barra de arriba que amarra los postes.
        solidBox({ x: 30, y: 0, z: H + 2, w: 2, d: 16, h: 1.2 }, C.metal, 4),
      ],
    },
  );
}

/** Espejo de pie para los probadores: óvalo en un marco dorado, con patas y el reflejo del cuarto. */
function floorMirror(): Sprite {
  const g = C.gold;
  const glass: Shader = (u, v, fw, fh) => {
    const nx = (u - fw / 2) / (fw / 2);
    const ny = (v - fh / 2) / (fh / 2);
    const d = nx * nx + ny * ny;
    if (d > 1) return null;
    if (d > 0.8) return at(g, noise(Math.floor(u), Math.floor(v), 3) < 0.3 ? 5 : d > 0.92 ? 2 : 4);
    // Reflejo: piso de madera abajo, pared clara arriba y dos brillos en diagonal.
    if (Math.abs(u - fw * 0.35 - (v - fh / 2) * 0.35) < 0.6 || Math.abs(u - fw * 0.55 - (v - fh / 2) * 0.35) < 0.35) return at(C.white, 4);
    if (v < fh * 0.3) return at(C.wood, v < fh * 0.18 ? 3 : 4);
    return at(C.sky, v > fh * 0.75 ? 4 : 3);
  };
  return renderSprite(
    [
      // Patas y el puntal de atrás.
      solidBox({ x: 3, y: 3, z: 0, w: 9, d: 2, h: 1.5 }, C.woodDark, 3),
      solidBox({ x: 3, y: 11, z: 0, w: 9, d: 2, h: 1.5 }, C.woodDark, 3),
      ...slant([2, 8, 0], [6, 8, 26], 1.2, C.woodDark, 3),
      { x: 7, y: 2.5, z: 3, w: 1.5, d: 11, h: 36, top: flat(at(g, 4)), left: flat(at(g, 2)), right: glass },
      // Remate dorado arriba.
      solidBox({ x: 7, y: 7, z: 39, w: 1.5, d: 2, h: 2 }, g, 4),
      shadowSpace(3, 3, 9, 10),
    ],
    { outline: OUT, under: shadowUnder(3, 3, 9, 10, 0.22) },
  );
}

/** Sacos de café de fique apilados (dos abajo y uno encima), con el grano estampado y granos regados. */
function coffeeSacks(): Sprite {
  const S = C.cork;
  const knit = (u: number, v: number) => at(S, (Math.floor(u) + Math.floor(v)) % 2 ? 3 : 4);
  const weave: Shader = (u, v, fw, fh) => {
    if (v >= fh - 1 || u < 0.6 || u >= fw - 0.6) return at(S, 2);
    // Estampa: un grano de café en un óvalo.
    const nx = (u - fw / 2) / 2.6;
    const ny = (v - fh * 0.5) / 2.4;
    const d = nx * nx + ny * ny;
    if (d < 1) return Math.abs(u - fw / 2 - (v - fh * 0.5) * 0.4) < 0.5 ? at(C.cream, 4) : at(C.woodDark, 2);
    if (Math.abs(d - 1.5) < 0.25) return at(C.woodDark, 3);
    return knit(u, v);
  };
  const sack = (x: number, y: number, z: number, h: number): Box[] => [
    { x, y, z, w: 6, d: 7, h, top: (u, v) => knit(u, v), left: (u, v, _fw, fh) => (v >= fh - 1 ? at(S, 3) : at(S, (Math.floor(u) + Math.floor(v)) % 2 ? 2 : 3)), right: weave },
    // El amarre de arriba: la boca fruncida y el cordel.
    solidBox({ x: x + 1.5, y: y + 2, z: z + h, w: 3, d: 3, h: 2 }, S, 3),
    solidBox({ x: x + 1.2, y: y + 1.7, z: z + h, w: 3.6, d: 3.6, h: 0.7 }, C.rug, 3),
  ];
  return renderSprite([...sack(2, 1, 0, 9), ...sack(2, 8.5, 0, 9), ...sack(2.5, 4.5, 9, 8), shadowSpace(2, 1, 8, 15)], {
    outline: OUT,
    under: shadowUnder(2, 1, 7, 14),
    extra: (c, p) => {
      // Granos regados en el piso, adelante.
      for (const [x, y] of [
        [11, 4],
        [12.5, 6],
        [11.5, 9],
        [13, 12],
      ] as const) {
        const q = p(x, y, 0);
        c.set(q.x, q.y, at(C.woodDark, 2));
        c.set(q.x + 1, q.y, at(C.woodDark, 4));
      }
    },
  });
}

/** Mesa de preparación de acero: tabla, cuenco y cuchillo encima, ollas en la repisa de abajo y un riel con cucharones. */
function prepTable(): Sprite {
  const m = C.metal;
  const D = 32;
  const steel: Shader = (u, v, fw, fh) => (edgeOf(u, v, fw, fh) < 0.8 ? at(m, 5) : noise(Math.floor(u / 2), Math.floor(v / 2), 9) < 0.12 ? at(m, 5) : at(m, 4));
  const legs = [2, D - 4].flatMap((y) => [solidBox({ x: 1, y, z: 0, w: 1.5, d: 1.5, h: 14 }, m, 3), solidBox({ x: 11, y, z: 0, w: 1.5, d: 1.5, h: 14 }, m, 3)]);
  return renderSprite(
    [
      ...legs.slice(0, 2),
      // Repisa de abajo con dos ollas y una pila de platos.
      { x: 1, y: 2, z: 3, w: 11.5, d: D - 4, h: 1, top: steel, left: flat(at(m, 3)), right: flat(at(m, 3)) },
      { x: 3, y: 5, z: 4, w: 7, d: 7, h: 5, top: flat(at(m, 1)), left: flat(at(C.terracotta, 3)), right: flat(at(C.terracotta, 2)) },
      { x: 3, y: 15, z: 4, w: 7, d: 6, h: 6, top: flat(at(m, 1)), left: flat(at(m, 4)), right: flat(at(m, 3)) },
      ...[0, 1, 2, 3].map((i) => solidBox({ x: 4, y: 23.5, z: 4 + i * 1.1, w: 6, d: 5, h: 1 }, PORCELAIN, i % 2 ? 3 : 4)),
      ...legs.slice(2),
      { x: 0, y: 0, z: 14, w: 13.5, d: D, h: 2, top: steel, left: flat(at(m, 3)), right: (_u, v) => at(m, v >= 1.2 ? 4 : 2) },
      // Encima: tabla con cebolla y tomate, cuenco de masa y un frasco.
      { x: 2.5, y: 3, z: 16, w: 8, d: 10, h: 1, top: butcher, left: flat(at(C.wood, 3)), right: flat(at(C.wood, 2)) },
      solidBox({ x: 3.5, y: 18, z: 16, w: 6, d: 6, h: 3 }, C.cream, 4),
      solidBox({ x: 4, y: 26, z: 16, w: 3, d: 3, h: 4 }, C.white, 4),
      // Riel con cucharones colgando, sobre dos parales al fondo.
      solidBox({ x: 0.2, y: 1, z: 16, w: 1.2, d: 1.2, h: 20 }, m, 3),
      solidBox({ x: 0.2, y: D - 2.2, z: 16, w: 1.2, d: 1.2, h: 20 }, m, 3),
      solidBox({ x: 0, y: 1, z: 35, w: 1.6, d: D - 2, h: 1.2 }, m, 4),
      volume(0, 0, 16, 14, D, 22),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, D),
      extra: (c, p) => {
        const onion = p(6.5, 6, 17.5);
        c.ellipse(onion.x, onion.y, 1.8, 1.5, at(C.violet, 4));
        c.set(onion.x - 1, onion.y - 1, at(C.rose, 5));
        const tom = p(6, 10, 17.5);
        c.ellipse(tom.x, tom.y, 1.5, 1.3, at(C.rug, 3));
        c.set(tom.x, tom.y - 1, at(C.leaf, 4));
        const dough = p(6.5, 21, 19);
        c.ellipse(dough.x, dough.y, 2.2, 1.1, at(C.cream, 5));
        const k = p(9, 14, 17);
        c.line(k.x - 3, k.y - 1, k.x, k.y + 1, at(m, 5));
        c.line(k.x + 1, k.y + 1, k.x + 2, k.y + 2, at(C.woodDark, 2));
        // Cucharones, espátulas y una sartencita colgando del riel.
        for (const [y, kind] of [
          [6, 0],
          [11, 1],
          [16, 0],
          [21, 2],
          [26, 1],
        ] as const) {
          const t = p(0.8, y, 35);
          c.line(t.x, t.y, t.x, t.y + 6, at(m, 4));
          if (kind === 0) c.ellipse(t.x, t.y + 7, 1.4, 1, at(m, 5));
          else if (kind === 1) c.rect(t.x - 1, t.y + 6, 3, 2, at(C.wood, 4));
          else {
            c.ellipse(t.x, t.y + 8, 2.6, 1.6, at(C.metal, 1));
            c.ellipse(t.x, t.y + 7.6, 2, 1, at(C.metal, 3));
          }
        }
      },
    },
  );
}

/** Alacena con vajilla: puertas abajo, repisas abiertas con platos parados, tazas colgadas y una tetera. */
function dishHutch(): Sprite {
  const r = C.sage;
  const H = 46;
  const upper: Shader = (u, v, fw, fh) => {
    if (u < 1.4 || u >= fw - 1.4) return at(C.wood, u < 0.7 ? 4 : 2);
    if (v >= fh - 2) return at(C.wood, v >= fh - 1 ? 5 : 3);
    const sh = (fh - 2) / 3;
    const s = Math.floor(v / sh);
    const lv = v - s * sh;
    if (lv < 1) return at(C.wood, 4);
    const y = lv - 1;
    if (s === 2) {
      // Arriba: platos parados, uno junto a otro, con su borde azul.
      const pc = mod(u - 1.4, 4.2) - 2.1;
      const d = Math.hypot(pc / 2, (y - 3.6) / 3.6);
      if (d < 1) return d > 0.8 ? at(C.blue, 3) : d < 0.35 ? at(C.blue, 4) : at(PORCELAIN, 4);
      return at(C.wood, 1);
    }
    if (s === 1) {
      // Tazas colgadas de ganchos.
      const pu = mod(u - 1.4, 5);
      if (y > sh - 3 && Math.abs(pu - 2.5) < 0.4) return at(C.gold, 4);
      if (y > 1 && y < 4.5 && pu > 1 && pu < 4) return at([C.rug, C.mustard, C.blue, C.green][Math.floor((u - 1.4) / 5) % 4]!, pu < 1.8 ? 4 : 3);
      return at(C.wood, 1);
    }
    // Abajo: frascos de especias.
    const pu = mod(u - 1.4, 3.4);
    if (y < 4.5 && pu > 0.6 && pu < 2.8) return y > 3.6 ? at(C.woodDark, 3) : at([C.fire, C.mustard, C.leaf, C.cork][Math.floor((u - 1.4) / 3.4) % 4]!, pu < 1.2 ? 4 : 3);
    return at(C.wood, 1);
  };
  return renderSprite(
    [
      { x: 0, y: 0, z: 0, w: 12, d: 32, h: 16, top: flat(at(r, 3)), left: flat(at(r, 2)), right: doorsFace(r, 8, { base: 1.5, top: 0.8, drawers: 1 }) },
      { x: 0, y: 0, z: 16, w: 13, d: 32, h: 1.5, top: butcher, left: flat(at(C.wood, 2)), right: (_u, v) => at(C.wood, v >= 1 ? 4 : 2) },
      { x: 0, y: 0, z: 17.5, w: 7, d: 32, h: H - 17.5, top: flat(at(C.wood, 4)), left: (u) => at(C.wood, u >= 6 ? 3 : 2), right: upper },
      { x: -0.5, y: -0.5, z: H, w: 8.5, d: 33, h: 2, top: flat(at(C.wood, 5)), left: flat(at(C.wood, 3)), right: (_u, v) => at(C.wood, v >= 1 ? 5 : 3) },
      // Un frasco de galletas sobre el mesón (la tetera va a mano).
      solidBox({ x: 8, y: 22, z: 17.5, w: 4, d: 4, h: 5 }, C.cream, 4),
      volume(7, 4, 17.5, 6, 8, 8),
    ],
    {
      outline: OUT,
      under: shadowUnder(0, 0, 13, 32),
      extra: (c, p) => {
        const t = p(10, 8, 17.5);
        blob(c, t.x, t.y - 3, 3.2, 2.8, (nx, ny, x, y) => roundTone(C.blue, nx, ny, x, y, 3));
        c.rect(t.x - 1, t.y - 7, 2, 1, at(C.blue, 4));
        c.line(t.x + 3, t.y - 3, t.x + 5, t.y - 5, at(C.blue, 3));
        c.set(t.x - 4, t.y - 4, at(C.blue, 2));
        c.set(t.x - 4, t.y - 3, at(C.blue, 2));
      },
    },
  );
}

/**
 * Tramo de baranda a lo largo de `along`, en la coordenada `pos` del otro eje, de `from` a `to`: postes en
 * las puntas, zócalo, balaustres y pasamanos (como `railing`).
 */
function railRun(along: "x" | "y", pos: number, from = 0, to = 16): Box[] {
  const w = C.wood;
  const len = to - from;
  const B = (a: number, b: number, z: number, la: number, lb: number, h: number) => (along === "y" ? { x: b, y: a, z, w: lb, d: la, h } : { x: a, y: b, z, w: la, d: lb, h });
  const post = (a: number): Box[] => [solidBox(B(a, pos, 0, 2.2, 2.2, 17), C.woodDark, 4), solidBox(B(a - 0.3, pos - 0.3, 17, 2.8, 2.8, 1.2), w, 5)];
  return [
    ...post(from),
    solidBox(B(from, pos + 0.4, 1.5, len, 1.6, 1), C.woodDark, 3),
    ...[5, 10].map((a) => solidBox(B(from + a, pos + 0.8, 2.5, 1, 1, 12), w, 3)),
    { ...B(from, pos - 0.1, 14.5, len, 2.4, 1.6), top: flat(at(w, 5)), left: flat(at(w, 3)), right: flat(at(w, 4)) },
    ...post(to - 2.2),
  ];
}

/**
 * Esquina de baranda: los dos lados del tile en un solo mueble (así no se enciman dos sprites). De frente
 * cierra el lado +x y el +y (la esquina sureste); de espaldas, el -x y el +y (la suroeste).
 */
function railingCorner(variant: Variant): Sprite {
  const boxes = [...railRun("y", variant === "back" ? 0.5 : 13), ...railRun("x", 13)];
  // De atrás hacia adelante según el centro de cada caja.
  boxes.sort((a, b) => a.x + a.w / 2 + a.y + a.d / 2 - (b.x + b.w / 2 + b.y + b.d / 2));
  return renderSprite(boxes, { outline: OUT });
}

/** Mesa redonda del recibidor: pedestal torneado, un jarrón grande con un ramo, libros y el platito de las llaves. */
function entryTable(): Sprite {
  const wd = C.woodDark;
  const top: Shader = (u, v) => at(wd, (Math.floor(u / 3) + Math.floor(v / 5)) % 3 === 0 ? 4 : 5);
  return renderSprite(
    [
      // Tres patas en cruz y la columna torneada.
      solidBox({ x: 2.5, y: 7, z: 0, w: 11, d: 2, h: 1.5 }, wd, 2),
      solidBox({ x: 7, y: 2.5, z: 0, w: 2, d: 11, h: 1.5 }, wd, 2),
      solidBox({ x: 6.5, y: 6.5, z: 1.5, w: 3, d: 3, h: 3 }, wd, 3),
      solidBox({ x: 7, y: 7, z: 4.5, w: 2, d: 2, h: 6 }, wd, 4),
      solidBox({ x: 6.5, y: 6.5, z: 10.5, w: 3, d: 3, h: 1.5 }, wd, 3),
      // Tapa octogonal (dos tablas cruzadas) con el canto más oscuro.
      { x: 0.5, y: 4, z: 12, w: 15, d: 8, h: 2, top, left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      { x: 4, y: 0.5, z: 12, w: 8, d: 15, h: 2, top, left: flat(at(wd, 2)), right: flat(at(wd, 3)) },
      // Libros apilados y el platito de las llaves.
      solidBox({ x: 9, y: 2.5, z: 14, w: 4.5, d: 5, h: 1.2 }, C.rug, 3),
      solidBox({ x: 9.3, y: 2.8, z: 15.2, w: 4, d: 4.4, h: 1.2 }, C.green, 3),
      solidBox({ x: 10, y: 10, z: 14, w: 3.5, d: 3.5, h: 0.8 }, C.gold, 4),
      volume(2, 3, 14, 11, 10, 22),
    ],
    {
      outline: OUT,
      under: roundShadow(8, 8, 7),
      extra: (c, p) => {
        // Jarrón de cerámica azul con un ramo de girasoles, flores rosadas y ramas de eucalipto.
        const b = p(6, 7.5, 14);
        blob(c, b.x, b.y - 4, 3.4, 4.2, (nx, ny, x, y) => (Math.abs(ny + 0.1) < 0.12 ? at(C.cream, 5) : roundTone(C.blue, nx, ny, x, y, 3)));
        c.rect(b.x - 1, b.y - 9, 3, 2, at(C.blue, 2));
        const t = { x: b.x, y: b.y - 10 };
        for (const [dx, dy] of [
          [-5, -4],
          [5, -3],
          [-3, -7],
          [3, -8],
          [0, -10],
        ] as const)
          c.line(t.x, t.y, t.x + dx, t.y + dy, at(C.sage, 2));
        for (const [dx, dy] of [
          [-6, -4],
          [6, -3],
          [-4, -8],
        ] as const)
          c.ellipse(t.x + dx, t.y + dy, 1.4, 1, at(C.sage, 4));
        for (const [dx, dy, col] of [
          [-2, -6, C.mustard],
          [3, -7, C.mustard],
          [0, -10, C.rose],
          [-4, -2, C.rose],
          [4, -2, C.rug],
        ] as const) {
          c.ellipse(t.x + dx, t.y + dy, 1.8, 1.6, at(col, 4));
          c.set(t.x + dx, t.y + dy, col === C.mustard ? at(C.woodDark, 2) : at(col, 5));
        }
      },
    },
  );
}

/** Dibujos para registrar en DRAW de furniture.ts. */
export const INTERIOR_DRAW: Record<string, (v: Variant) => Sprite> = {
  "bookcase-tall": bookcaseTall,
  "curio-cabinet": curioCabinet,
  "library-ladder": libraryLadder,
  "reading-table": readingTable,
  "fireplace-stone": fireplaceStone,
  "sofa-leather": sofaLeather,
  "armchair-wing": armchairWing,
  "reading-lamp": readingLamp,
  "blanket-basket": blanketBasket,
  "grandfather-clock": grandfatherClock,
  hammock,
  "chess-table": chessTable,
  "puzzle-table": puzzleTable,
  "game-shelf": gameShelf,
  sideboard,
  "rug-persian": rugPersian,
  runner,
  "reception-desk": receptionDesk,
  "console-table": consoleTable,
  "entry-bench": entryBench,
  "umbrella-stand": umbrellaStand,
  toilet,
  vanity,
  "toilet-stall": toiletStall,
  "floor-mirror": floorMirror,
  backbar,
  "kitchen-counter": kitchenCounter,
  "kitchen-sink": kitchenSink,
  stove,
  fridge,
  "kitchen-island": kitchenIsland,
  "pantry-shelf": pantryShelf,
  "coffee-station": coffeeStation,
  "high-table": highTable,
  "water-cooler": waterCooler,
  "cafe-sign": cafeSign,
  "conference-table": conferenceTable,
  "filing-cabinet": filingCabinet,
  printer,
  railing,
  "deck-chair": deckChair,
  telescope,
  "balcony-planter": balconyPlanter,
  "railing-corner": railingCorner,
  "coffee-sacks": coffeeSacks,
  "prep-table": prepTable,
  "dish-hutch": dishHutch,
  "entry-table": entryTable,
};
