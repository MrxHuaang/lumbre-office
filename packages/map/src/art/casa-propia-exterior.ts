// Lo de afuera de la casa de cada persona (ver world/catalog-casa-propia.ts): la casona de finca paisa por
// fuera, el refugio de la parada "Casa", la mecedora del corredor y el tendedero. Es de la familia de la
// cabaña y el garaje (exterior-casa.ts): piedra, troncos, tejas de barro y madera, todo cálido. La casa y el
// refugio tienen versión de noche y se registran en outdoor.ts; la mecedora y el tendedero, en furniture.ts.
import { Escena, type Tinte } from "./exterior-escena";
import { escamas, gableX, lantern, logEnds, logWall, stones, tejas, windowAt, type Win } from "./exterior-casa";
import { LIME } from "./bus-colores";
import type { Variant } from "./kit";
import { C, OUT, mix } from "./palette";
import { alpha, at, bayer, noise, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";
import { glyphOn } from "./room";

// =====================================================================================================
// La casa de finca (14x9 tiles = 224x144). El frente (+y) tiene el corredor de baldosa con sus pilares, la
// puerta de dos hojas y, arriba, el balcón corrido con barandas torneadas; el costado este (+x) la puerta
// de atrás al patio y la chimenea de piedra por fuera. Techo de tejas a cuatro aguas.
// =====================================================================================================

/** Paredes (sin aleros ni corredor). */
const X0 = 8;
const X1 = 210;
const Y0 = 14;
const Y1 = 116;
/** Alto del primer piso (la viga) y de las paredes. */
const H1 = 44;
const H = 88;
/** Balcón: vuela sobre el corredor; el corredor (baldosa) sale un poco más. */
const BAL_D = 12;
const BAL_Z = H1;
const DECK_D = 14;
const DECK_H = 4;
/** Techo a cuatro aguas. */
const EAVE = 10;
const SLOPE = 0.5;
const ROOF = { x0: X0 - EAVE, x1: X1 + EAVE, y0: Y0 - EAVE, y1: Y1 + EAVE, z: H - EAVE * SLOPE };

/** Rojo colonial de la puerta, los postigos y la cenefa del balcón. */
const COLONIAL = C.rug;

/** Puerta del frente (u desde X0) y la de atrás (u desde Y0 en el costado este). */
const DOOR = { u0: 92, u1: 116, top: 28 };
const BACK_DOOR = { u0: 51.5, u1: 64.5, top: 28 };
/** Pilares del corredor (x). */
const PILLARS = [X0 + 2, 46, 84, 136, 176, X1 - 3];
/** Ventanas del primer piso al frente (centro en x) y aberturas del balcón (centro en x, ancho). */
const FRONT_WINDOWS = [28, 65, 157];
const BALCONY_DOORS: [number, number][] = [
  [28, 12],
  [65, 12],
  [112, 16],
  [157, 12],
  [192, 12],
];

/** Chimenea de piedra pegada por fuera al costado este. */
const CHIM = { x: X1, y0: 22, y1: 40, w: 13, shoulder: 62, top: 120 };

/** Tope de la chimenea (para el humo que anima el cliente), en coordenadas locales de arte. */
export const CASA_FINCA_CHIMNEY_TOP = { x: CHIM.x + 1.5 + (CHIM.w - 3) / 2, y: (CHIM.y0 + CHIM.y1) / 2, z: CHIM.top + 9 };
/** El farol junto a la puerta del frente (para la luz del catálogo): centro del vidrio. */
export const CASA_FINCA_LANTERN = { x: X0 + DOOR.u0 - 6, y: Y1 + 3, z: 22 };

/** Piedra de río tibia (tirando a arena): la de la cabaña sola se ve muy gris en una casa encalada. */
function piedra(u: number, v: number, seed: number, dark = 0): RGBA {
  const c = mix(stones(u, v, seed, dark), at(C.cork, 3 - dark), 0.3);
  const row = Math.floor(v / 5);
  return noise(Math.floor((u + noise(row, 3, seed) * 9) / 9), row, seed + 6) < 0.2 ? mix(c, at(C.terracotta, 3 - dark), 0.35) : c;
}
/** Losa de piedra tibia de un tono de la rampa. */
const losa = (i: number) => mix(at(C.stone, i), at(C.cork, Math.min(4, i)), 0.3);

// ---------- Paredes ----------

const inR = (u: number, v: number, u0: number, v0: number, u1: number, v1: number) => u >= u0 && u < u1 && v >= v0 && v < v1;

/** Ventanas que de noche muestran gente adentro (siluetas contra la luz: hay visita en la casa). */
interface Ventana extends Win {
  /** Ancho de cada postigo (rojo colonial). */
  sw?: number;
  /** De noche, dónde se para alguien adentro (u relativo a la ventana) o nada. */
  gente?: number[];
  /** De noche, el color de las luces de la fiesta que tiñe el vidrio. */
  fiesta?: Ramp;
}

/** Silueta de una persona contra la luz: cabeza y hombros. */
function silueta(du: number, dv: number): boolean {
  if (Math.hypot(du, (dv - 10.5) * 1.1) < 2.3) return true;
  return dv < 8.2 && Math.abs(du) < 4.2 - Math.max(0, dv - 6) * 1.1;
}

/** Ventana con postigos rojos (windowAt los pinta verdes) y, de noche, las siluetas de la fiesta. */
function ventana(u: number, v: number, w: Ventana, night: boolean): RGBA | null {
  const sw = w.sw ?? 0;
  if (sw > 0 && v >= w.v0 && v < w.v1) {
    const L = u >= w.u0 - 1 - sw && u < w.u0 - 1;
    const R = u >= w.u1 + 1 && u < w.u1 + 1 + sw;
    if (L || R) {
      const rel = L ? u - (w.u0 - 1 - sw) : u - (w.u1 + 1);
      if (rel < 0.8 || rel > sw - 0.8 || v < w.v0 + 0.8 || v >= w.v1 - 0.8) return at(COLONIAL, 1);
      // Tablero de arriba y de abajo con su moldura (los postigos de las casas de pueblo).
      const mid = (w.v0 + w.v1) / 2;
      if (Math.abs(v - mid) < 0.7) return at(COLONIAL, 1);
      if (rel > 1.8 && rel < sw - 1.8 && Math.abs(v - mid) > 1.8 && v > w.v0 + 1.8 && v < w.v1 - 1.8) return at(COLONIAL, rel < 2.6 || v > w.v1 - 2.6 ? 3 : 2);
      return at(COLONIAL, 3);
    }
  }
  const c = windowAt(u, v, { ...w, shutters: false }, night);
  if (!c || !night) return c;
  // Solo dentro del vidrio (no en marcos ni travesaños, que windowAt ya pintó oscuros/crema).
  const glass = c[0] >= 200 && c[2] < 140 && u >= w.u0 + 2 && u < w.u1 - 2 && v >= w.v0 + 2;
  if (!glass) return c;
  for (const g of w.gente ?? []) if (silueta(u - (w.u0 + g), v - w.v0)) return mix(at(C.curtain, 0), at(C.gold, 1), 0.3);
  if (w.fiesta) return mix(c, at(w.fiesta, 4), 0.25 + (v > (w.v0 + w.v1) / 2 ? 0.15 : 0));
  return c;
}

/** Bahareque encalado del segundo piso: cal crema con manchas de lluvia y, a veces, la tierra que asoma. */
function encalado(u: number, v: number, seed: number, luz: number): RGBA {
  const n = smoothNoise(u, v, 7, seed);
  const b = 4 + luz;
  if (noise(Math.floor(u / 2), Math.floor(v / 2), seed + 4) < 0.006) return at(C.dirt, 3);
  if (n > 0.74) return at(C.cream, b - 1);
  if (bayer(Math.floor(u), Math.floor(v)) < 0.06 && n > 0.55) return at(C.cream, b - 1);
  return at(C.cream, b);
}

/** Entramado de madera a la vista sobre el encalado: solera arriba, pie-derechos y riostras. */
function entramado(u: number, v: number, posts: number[], luz: number): RGBA | null {
  const w = v - H1 - 4;
  if (w < 0) return null;
  if (v >= H - 4) return at(C.woodDark, v >= H - 1 ? 4 + luz : 2 + luz);
  for (const p of posts) {
    const d = u - p;
    if (Math.abs(d) < 1.7) return at(C.woodDark, d < -0.9 ? 4 + luz : 3 + luz);
    // Riostra en diagonal al pie de cada pie-derecho (la cruz de San Andrés de las casas viejas).
    if (w < 12 && Math.abs(Math.abs(d) - (12 - w) * 0.75) < 0.9 && Math.abs(d) < 9) return at(C.woodDark, 2 + luz);
  }
  return null;
}

/** Puerta de tableros pintada de rojo colonial: una o dos hojas, con vidrios arriba que de noche se encienden. */
function puerta(du: number, v: number, w: number, top: number, hojas: 1 | 2, night: boolean): RGBA {
  const hw = w / hojas;
  const k = hojas === 2 && du >= hw ? 1 : 0;
  const lu = du - k * hw;
  if (hojas === 2 && Math.abs(du - hw) < 0.6) return at(C.woodDark, 0);
  if (lu < 1 || lu > hw - 1 || v > top - 1 || v < 0.8) return at(COLONIAL, 1);
  // Vidrio de arriba con su reja de madera.
  if (v > top - 9 && v < top - 2 && lu > 2.2 && lu < hw - 2.2) {
    if (Math.abs(lu - hw / 2) < 0.5 || Math.abs(v - (top - 5.5)) < 0.5) return at(COLONIAL, 1);
    return night ? at(C.gold, v > top - 5 ? 5 : 4) : mix(at(C.sky, 2), at(C.curtain, 3), lu < 3.5 || lu > hw - 3.5 ? 0.6 : 0.15);
  }
  // Tableros: el de abajo y el del medio, con la moldura en luz arriba-izquierda.
  for (const [a, b] of [
    [2.5, 9],
    [10.5, top - 10.5],
  ] as const)
    if (v >= a && v < b && lu > 2 && lu < hw - 2) {
      if (v >= b - 0.8 || lu < 2.8) return at(COLONIAL, 1);
      if (v < a + 0.8 || lu > hw - 2.8) return at(COLONIAL, 4);
      return at(COLONIAL, 2);
    }
  // Manija de bronce junto a la junta.
  if (Math.hypot(lu - (k === 0 ? hw - 2.2 : 2.2), v - 13) < 0.9) return at(C.gold, 5);
  return at(COLONIAL, 3);
}

/** Frente (+y): troncos sobre piedra abajo, la viga, el encalado de arriba con el entramado y las aberturas. */
function front(night: boolean): Tinte {
  const low: Ventana[] = FRONT_WINDOWS.map((cx, i) => ({ u0: cx - X0 - 6, u1: cx - X0 + 6, v0: 12, v1: 28, kind: "ventana", sw: 6, gente: i === 1 ? [5] : undefined, fiesta: i === 2 ? C.rug : undefined }));
  const high: Ventana[] = BALCONY_DOORS.map(([cx, w], i) => ({
    u0: cx - X0 - w / 2,
    u1: cx - X0 + w / 2,
    v0: H1 + 4,
    v1: 72,
    kind: "balcon",
    sw: 5,
    gente: i === 2 ? [4.5, 11.5] : i === 4 ? [6] : undefined,
    fiesta: i === 1 ? C.neon : i === 3 ? C.cyan : undefined,
  }));
  const posts = [1.6, ...high.slice(1).map((w, i) => (high[i]!.u1 + w.u0) / 2), X1 - X0 - 1.6];
  return (u, v) => {
    if (v < H1) {
      if (u >= DOOR.u0 - 2 && u < DOOR.u1 + 2 && v < DOOR.top + 2 && !(u >= DOOR.u0 && u < DOOR.u1 && v < DOOR.top)) return at(C.woodDark, v >= DOOR.top + 1 ? 4 : u < DOOR.u0 ? 3 : 2);
      if (u >= DOOR.u0 && u < DOOR.u1 && v < DOOR.top) return puerta(u - DOOR.u0, v, DOOR.u1 - DOOR.u0, DOOR.top, 2, night);
      for (const w of low) {
        const c = ventana(u, v, w, night);
        if (c) return c;
      }
      return logWall(u, v + 6, 31);
    }
    if (v < H1 + 4) return at(C.woodDark, v >= H1 + 3 ? 4 : 2);
    for (const w of high) {
      const c = ventana(u, v, w, night);
      if (c) return c;
    }
    return entramado(u, v, posts, 0) ?? encalado(u, v, 11, 0);
  };
}

/** Costado este (+x), en sombra: la puerta de atrás, ventanas en los dos pisos y el mismo entramado. */
function side(night: boolean): Tinte {
  const low: Ventana[] = [
    { u0: 33, u1: 43, v0: 13, v1: 29, kind: "ventana", sw: 5 },
    { u0: 74, u1: 86, v0: 13, v1: 29, kind: "ventana", sw: 5, gente: [4] },
  ];
  const high: Ventana[] = [
    { u0: 30, u1: 42, v0: H1 + 8, v1: 70, kind: "ventana", sw: 5 },
    { u0: 52, u1: 64, v0: H1 + 8, v1: 70, kind: "ventana", sw: 5, gente: [6] },
    { u0: 80, u1: 92, v0: H1 + 8, v1: 70, kind: "ventana", sw: 5 },
  ];
  const posts = [1.6, 47, 72, Y1 - Y0 - 1.6];
  return (u, v) => {
    if (v < H1) {
      const b = BACK_DOOR;
      if (u >= b.u0 - 2 && u < b.u1 + 2 && v < b.top + 2 && !(u >= b.u0 && u < b.u1 && v < b.top)) return at(C.woodDark, v >= b.top + 1 ? 3 : 1);
      if (u >= b.u0 && u < b.u1 && v < b.top) {
        const c = puerta(u - b.u0, v, b.u1 - b.u0, b.top, 1, night);
        return night ? c : mix(c, at(C.night, 2), 0.12);
      }
      for (const w of low) {
        const c = ventana(u, v, w, night);
        if (c) return c;
      }
      return logWall(u, v + 6, 33, -1);
    }
    if (v < H1 + 4) return at(C.woodDark, v >= H1 + 3 ? 3 : 1);
    for (const w of high) {
      const c = ventana(u, v, w, night);
      if (c) return c;
    }
    return entramado(u, v, posts, -1) ?? encalado(u, v, 12, -1);
  };
}

// ---------- Techo a cuatro aguas ----------

/**
 * Techo a cuatro aguas sobre el rectángulo (x0..x1, y0..y1) con el alero a `eaveZ`: dos faldones largos
 * (el de adelante con luz), dos limas (la del este en sombra), las limatesas y la cumbrera de tejas
 * redondas. `hole` deja sin teja lo que tapa la chimenea.
 */
function hipRoof(s: Escena, x0: number, x1: number, y0: number, y1: number, eaveZ: number, slope: number, seed: number, hole?: (x: number, y: number) => boolean) {
  const half = (y1 - y0) / 2;
  const ry = y0 + half;
  const rz = eaveZ + half * slope;
  const xr0 = x0 + half;
  const xr1 = x1 - half;
  const k = Math.hypot(1, slope);
  const e = 0.4;
  // Faldón de atrás y de adelante (trapecios).
  s.quad([x0, ry, rz], [1, 0, 0], [0, -1, -slope], x1 - x0, half, (u, v) => (u < half - v - e || u > xr1 - x0 + v + e ? null : tejas(u, v * k, -1, seed)));
  s.quad([x0, ry, rz], [1, 0, 0], [0, 1, -slope], x1 - x0, half, (u, v) => (u < half - v - e || u > xr1 - x0 + v + e || hole?.(x0 + u, ry + v) ? null : tejas(u, v * k, 1, seed + 1)));
  // Limas (triángulos de las puntas): la del este se ve en sombra.
  s.quad([xr1, y0, rz], [0, 1, 0], [1, 0, -slope], y1 - y0, half, (u, v) => (Math.abs(y0 + u - ry) > v + e || hole?.(xr1 + v, y0 + u) ? null : tejas(u, v * k, -1, seed + 2)));
  s.quad([xr0, y0, rz], [0, 1, 0], [-1, 0, -slope], y1 - y0, half, (u, v) => (Math.abs(y0 + u - ry) > v + e ? null : tejas(u, v * k, 0, seed + 3)));
  // Tapacanes del alero de adelante y del este.
  s.quad([x0, y1, eaveZ - 2.5], [1, 0, 0], [0, 0, 1], x1 - x0, 2.5, (_u, v) => at(C.woodDark, v > 1.6 ? 4 : 2));
  s.quad([x1, y0, eaveZ - 2.5], [0, 1, 0], [0, 0, 1], y1 - y0, 2.5, (u, v) => (hole?.(x1, y0 + u) ? null : at(C.woodDark, v > 1.6 ? 3 : 1)));
  // Canecillos: las puntas de los cabios asomando bajo el alero, como en las casas de bahareque.
  s.borde = false;
  for (let x = x0 + 5; x < x1 - 3; x += 9) s.solid(x, y1 - 4, eaveZ - 4.5, 2, 4, 2, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 1));
  for (let y = y0 + 5; y < y1 - 3; y += 9) if (!hole?.(x1, y)) s.solid(x1 - 4, y, eaveZ - 4.5, 4, 2, 2, at(C.woodDark, 4), at(C.woodDark, 2), at(C.woodDark, 1));
  s.borde = true;
  // Cumbrera y limatesas: tejas redondas más claras.
  const caballete = (x: number, y: number, z: number, along: "x" | "d") => {
    const lit = Math.floor(along === "x" ? x : y) % 6 === 0 ? 3 : 5;
    s.plot(x, y, z + 1.4, at(C.roof, lit));
    s.plot(x, y + 0.8, z + 0.7, at(C.roof, 4));
    s.plot(x - 0.6, y - 0.6, z + 0.7, at(C.roof, 2));
  };
  for (let x = xr0; x <= xr1; x += 0.4) caballete(x, ry, rz, "x");
  for (let t = 0; t <= half + 0.5; t += 0.35) {
    const z = rz - t * slope;
    caballete(xr1 + t, ry + t, z, "d");
    caballete(xr1 + t, ry - t, z, "d");
    caballete(xr0 - t, ry + t, z, "d");
  }
}

// ---------- Piezas ----------

/** Baranda de balaustres torneados (con su panza y el cuello), pasamanos y travesaño, a lo largo de un tramo. */
function torneada(s: Escena, from: [number, number], to: [number, number], z: number, h: number, posts: number[] = []) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dx = (to[0] - from[0]) / len;
  const dy = (to[1] - from[1]) / len;
  s.borde = false;
  for (let k = 1.8; k < len - 0.5; k += 3.6) {
    const x = from[0] + dx * k;
    const y = from[1] + dy * k;
    for (let v = 1.5; v < h - 1; v += 0.4) {
      const t = (v - 1.5) / (h - 2.5);
      // Perfil de jarrón: base, panza abajo, cuello fino y capitel.
      const r = t < 0.1 ? 0.7 : t < 0.55 ? 0.3 + Math.sin(((t - 0.1) / 0.45) * Math.PI) * 0.5 : t < 0.85 ? 0.25 : 0.6;
      for (let a = -r; a <= r + 0.01; a += 0.35) s.plot(x + dx * a, y + dy * a, z + v, at(C.wood, a < -r * 0.3 ? 5 : a > r * 0.4 ? 2 : 3));
    }
  }
  s.borde = true;
  // Travesaño bajo y pasamanos (con su canto en luz).
  const rail = (zz: number, t: number, top: number, side: number) => {
    for (let k = -0.5; k <= len + 0.5; k += 0.35)
      for (let q = 0; q < t; q += 0.5) {
        s.plot(from[0] + dx * k, from[1] + dy * k, zz + q, at(C.wood, q > t - 0.6 ? top : side));
        s.plot(from[0] + dx * k + dy * 0.7, from[1] + dy * k - dx * 0.7, zz + t, at(C.wood, top));
      }
  };
  rail(z, 1.5, 4, 2);
  rail(z + h - 1, 1.8, 5, 3);
  for (const p of posts) {
    const x = from[0] + dx * p;
    const y = from[1] + dy * p;
    s.solid(x - 1.1, y - 1.1, z, 2.2, 2.2, h + 1.6, at(C.wood, 5), at(C.wood, 3), at(C.wood, 2));
  }
}

/** Mata frondosa (helecho o cinta): hojas que salen de un punto y se doblan hacia abajo. */
function helecho(s: Escena, cx: number, cy: number, z: number, n: number, len: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const a = noise(i, 1, seed) * Math.PI * 2;
    const L = len * (0.6 + noise(i, 2, seed) * 0.4);
    const up = 0.9 + noise(i, 3, seed) * 0.8;
    for (let t = 0; t < L; t += 0.35) {
      const x = cx + Math.cos(a) * t;
      const y = cy + Math.sin(a) * t;
      const zz = z + up * t - (t * t) / (L * 0.55);
      s.plot(x, y, zz, at(C.leaf, t > L * 0.75 ? 4 : t > L * 0.35 ? 3 : 2));
      if (Math.floor(t * 3) % 2 === 0) s.plot(x - Math.sin(a) * 0.6, y + Math.cos(a) * 0.6, zz - 0.3, at(C.leaf, 2));
    }
  }
}

/** Matera de barro (cilindro) con la tierra arriba. */
function matera(s: Escena, cx: number, cy: number, z: number, r: number, h: number, ramp: Ramp = C.terracotta, banda?: Ramp) {
  s.cylinder(cx, cy, z, r, h, (_a, v, luz) => {
    if (banda && v > h * 0.45 && v < h * 0.7) return at(banda, luz > 0.2 ? 3 : 2);
    return at(ramp, v > h - 1 ? 4 : luz > 0.3 ? 3 : luz > -0.3 ? 2 : 1);
  });
  s.disc(cx, cy, z + h, r, (dx, dy) => (Math.hypot(dx, dy) > r - 0.7 ? at(ramp, 4) : at(C.dirt, 1)));
}

/** Matera colgada de tres cadenitas con un helecho que se derrama. */
function materaColgada(s: Escena, cx: number, cy: number, z: number, hook: number) {
  s.borde = false;
  for (const [ox, oy] of [
    [-1.6, 0],
    [1, 1.2],
    [0.8, -1.2],
  ] as const)
    for (let t = 0; t < 1; t += 0.05) s.plot(cx + ox * (1 - t), cy + oy * (1 - t), z + 3 + (hook - z - 3) * t, at(C.metal, 1));
  s.borde = true;
  matera(s, cx, cy, z, 2.2, 3);
  helecho(s, cx, cy, z + 3, 18, 6, Math.floor(cx * 7 + cy));
}

const BUGAMBILIA: RGBA[] = [at(C.neon, 2), at(C.neon, 3), at(C.rose, 4), at(C.neon, 2)];

/** Bugambilia: un manchón de hojas con brácteas fucsia (más flores donde da el sol). */
function bugambilia(s: Escena, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, seed: number, dens = 1) {
  for (let i = 0; i < (x1 - x0 + y1 - y0) * (z1 - z0) * 0.9 * dens; i++) {
    const x = x0 + noise(i, 1, seed) * (x1 - x0);
    const y = y0 + noise(i, 2, seed) * (y1 - y0);
    const z = z0 + noise(i, 3, seed) * (z1 - z0);
    if (smoothNoise(x + y, z, 4, seed) < 0.35) continue;
    const f = noise(i, 4, seed);
    const c = f < 0.42 ? BUGAMBILIA[i % BUGAMBILIA.length]! : at(C.leaf, f < 0.7 ? 2 : 3);
    s.plot(x, y, z, c);
    s.plot(x + 0.5, y, z + 0.4, c);
  }
}

/** Tarro pintado (de los de leche o de pintura) con una mata: lo que se ve en todo corredor paisa. */
function tarro(s: Escena, cx: number, cy: number, z: number, ramp: Ramp, seed: number) {
  s.cylinder(cx, cy, z, 2.4, 5, (_a, v, luz) => (v > 4.2 || v < 0.6 ? at(C.metal, 3) : at(ramp, luz > 0.3 ? 4 : luz > -0.3 ? 3 : 2)));
  s.disc(cx, cy, z + 5, 2.4, () => at(C.dirt, 1));
  if (seed % 3 === 0) {
    // Novios (geranios) rojos.
    for (let i = 0; i < 40; i++) {
      const a = noise(i, 1, seed) * Math.PI * 2;
      const r = noise(i, 2, seed) * 3.2;
      const zz = z + 5 + noise(i, 3, seed) * 4;
      s.plot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, zz, noise(i, 4, seed) < 0.3 ? at(C.rug, 3 + (i % 2)) : at(C.leaf, zz > z + 7.5 ? 4 : 3));
    }
  } else helecho(s, cx, cy, z + 5, 14, 5 + (seed % 2), seed);
}

/** Ruana colgada de un clavo: lana cruda con franjas cafés y rojas, y los flecos abajo. */
function ruana(u: number, v: number, w: number, h: number): RGBA | null {
  const du = u - w / 2;
  // Cae en pico desde el clavo y se abre abajo.
  if (Math.abs(du) > w / 2 - (v / h) * 2.5 || v < 0) return null;
  if (v < 1.6) return Math.floor(u) % 2 ? at(C.cream, 2) : null;
  const stripe = Math.floor((u + 0.5) % 6);
  if (stripe === 0) return at(C.woodDark, 3);
  if (stripe === 3 && v > h * 0.2) return at(COLONIAL, 2);
  return at(C.cream, v > h - 2 ? 5 : 4 - (Math.floor(v) % 3 === 0 ? 1 : 0));
}

/** Guirnalda de bombillitos de colores (la de las fiestas): de noche se prenden. */
const BOMBILLOS: Ramp[] = [C.rug, C.gold, C.green, C.fabric, C.neon];
function guirnalda(s: Escena, a: [number, number, number], b: [number, number, number], sag: number, night: boolean, seed: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  s.borde = false;
  for (let k = 0; k <= len; k += 0.4) {
    const t = k / len;
    const z = a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag;
    s.plot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z, at(C.night, 2));
  }
  s.borde = true;
  for (let k = 3, i = seed; k < len - 1; k += 6, i++) {
    const t = k / len;
    const z = a[2] + (b[2] - a[2]) * t - Math.sin(t * Math.PI) * sag;
    const r = BOMBILLOS[i % BOMBILLOS.length]!;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    s.plot(x, y, z - 0.8, night ? at(r, 5) : at(r, 3));
    s.plot(x, y, z - 1.6, night ? at(r, 4) : at(r, 2));
    s.plot(x + 0.5, y, z - 1.2, night ? mix(at(r, 5), at(C.white, 4), 0.5) : at(r, 3));
  }
}

// ---------- La casa ----------

export function drawCasaFinca(night: boolean): Sprite {
  const s = new Escena({ x0: -14, y0: -8, z0: -2, x1: 232, y1: 150, z1: 140 }, 2);
  s.shadow(X0 - 4, Y0 - 4, X1 - X0 + 24, Y1 - Y0 + DECK_D + 14, 0.3);

  // Paredes.
  s.quad([X0, Y1, 0], [1, 0, 0], [0, 0, 1], X1 - X0, H, front(night));
  s.quad([X1, Y0, 0], [0, 1, 0], [0, 0, 1], Y1 - Y0, H, side(night));
  logEnds(s, X1, Y0, 8, H1, "x", 9);

  drawCorredor(s, night);
  drawBalcon(s, night);
  drawChimenea(s);
  hipRoof(s, ROOF.x0, ROOF.x1, ROOF.y0, ROOF.y1, ROOF.z, SLOPE, 61, (x, y) => x > CHIM.x - 1 && y > CHIM.y0 + 1 && y < CHIM.y1 - 1);
  drawMatasColgadas(s);
  drawEste(s, night);
  drawPasto(s);
  return s.sprite();
}

/** El corredor: plataforma de piedra con baldosa de barro, pilares, escalas, farol, banquito y ruana. */
function drawCorredor(s: Escena, night: boolean) {
  const x0 = X0 - 3;
  const x1 = X1 + 3;
  const y0 = Y1;
  const y1 = Y1 + DECK_D;
  // Baldosa roja cuadrada, con una que otra más oscura y el filo de piedra.
  const baldosa: Tinte = (u, v) => {
    if (v > DECK_D - 1.2) return losa(4);
    const ku = u % 6;
    const kv = v % 6;
    if (ku < 0.6 || kv < 0.6) return at(C.terracotta, 1);
    const n = noise(Math.floor(u / 6), Math.floor(v / 6), 77);
    return at(C.terracotta, (n < 0.18 ? 2 : 3) + (ku < 1.5 && kv < 1.5 ? 1 : 0));
  };
  s.box(x0, y0, 0, x1 - x0, y1 - y0, DECK_H, baldosa, (u, v) => piedra(u, v + 1, 81), (u, v) => piedra(u, v + 1, 81, 1));
  // Escalas de piedra frente a la puerta, hasta el borde del mueble.
  const slab: Tinte = (u, v) => (Math.floor(u) % 10 === 0 ? losa(2) : v < 1 ? losa(5) : losa(4));
  const dx0 = X0 + DOOR.u0 - 4;
  const dx1 = X0 + DOOR.u1 + 4;
  s.box(dx0, y1, 0, dx1 - dx0, 5, 2.6, slab, (u, v) => (v > 1.8 ? losa(4) : Math.floor(u) % 10 === 0 ? losa(1) : losa(3)), () => losa(2));
  s.box(dx0 + 3, y1 + 5, 0, dx1 - dx0 - 6, 5, 1.2, slab, (_u, v) => losa(v > 0.6 ? 4 : 2), () => losa(1));
  // Tapete de fique en la entrada.
  s.box(X0 + DOOR.u0 + 1, y0 + 1, DECK_H, DOOR.u1 - DOOR.u0 - 2, 7, 0.4, (u, v) => (u < 1 || v < 1 || u > DOOR.u1 - DOOR.u0 - 3 || v > 6 ? at(C.mustard, 1) : at(C.mustard, (Math.floor(u) + Math.floor(v)) % 2 ? 3 : 2)), null, null);

  // Pilares con su basa de piedra y la zapata que recibe la viga del balcón.
  const py = Y1 + BAL_D - 3;
  for (const px of PILLARS) {
    s.box(px - 1, py - 1, DECK_H, 5, 5, 3, () => losa(4), (u, v) => piedra(u, v + 2, 91), (u, v) => piedra(u, v + 2, 91, 1));
    s.solid(px, py, DECK_H + 3, 3, 3, BAL_Z - DECK_H - 3, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    s.solid(px - 3, py, BAL_Z - 2.5, 9, 3, 2.5, at(C.woodDark, 5), at(C.woodDark, 4), at(C.woodDark, 2));
  }

  // Farol de pared al lado de la puerta, con su brazo de fierro.
  const L = CASA_FINCA_LANTERN;
  s.solid(L.x - 0.5, Y1, L.z + 6, 1, L.y - Y1, 1, at(C.night, 3), at(C.night, 2), at(C.night, 1));
  lantern(s, L.x, L.y, L.z - 2.5, night);

  // Banquito de tablas contra la pared y la ruana colgada encima.
  const bx = PILLARS[4]! + 6;
  const bw = PILLARS[5]! - PILLARS[4]! - 10;
  for (const lx of [bx + 1, bx + bw - 3]) s.solid(lx, Y1 + 1.5, DECK_H, 2, 4, 6, at(C.wood, 3), at(C.wood, 2), at(C.wood, 1));
  s.box(bx, Y1 + 1, DECK_H + 6, bw, 5.5, 1.6, (u) => at(C.wood, Math.floor(u) % 5 === 0 ? 3 : 5), (_u, v) => at(C.wood, v > 1 ? 4 : 2), () => at(C.wood, 2));
  s.quad([bx + 2, Y1 + 0.4, 30], [1, 0, 0], [0, 0, -1], 13, 16, (u, v) => ruana(u, v, 13, 16));
  s.solid(bx + 8, Y1, 30, 1, 1, 1, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  // Sombrero aguadeño colgado al lado.
  s.quad([bx + bw - 7, Y1 + 0.5, 22], [1, 0, 0], [0, 0, 1], 7, 6, (u, v) => {
    const d = Math.hypot(u - 3.5, (v - 3) * 1.15);
    if (d > 3.5) return null;
    if (d > 2.2) return at(C.cream, d > 3 ? 2 : 4);
    return Math.abs(v - 2.2) < 0.6 ? at(C.night, 2) : at(C.cream, 3);
  });

  // Tarros con matas a lo largo del corredor (fuera de la puerta y de los pilares).
  const tarros: [number, Ramp][] = [
    [16, C.fabric],
    [37, C.mustard],
    [55, C.green],
    [74, C.rug],
    [129, C.fabric],
    [148, C.rug],
    [166, C.mustard],
  ];
  tarros.forEach(([x, r], i) => tarro(s, x, y1 - 3.5, DECK_H, r, i * 4 + 3));
  // Dos materas grandes con novios a lado y lado de las escalas.
  for (const mx of [dx0 - 4, dx1 + 4]) {
    matera(s, mx, y1 + 2, 0, 3.2, 6, C.terracotta, C.cream);
    tarro(s, mx, y1 + 2, 1.5, C.terracotta, 0);
  }
}

/** El balcón corrido: losa de tablas, cenefa calada roja, barandas torneadas, guirnalda y matas. */
function drawBalcon(s: Escena, night: boolean) {
  const x0 = X0 - 2;
  const x1 = X1 + 2;
  const y0 = Y1;
  const y1 = Y1 + BAL_D;
  // El piso del balcón va oscuro: se ve entre los balaustres y así la baranda se lee calada.
  s.box(x0, y0, BAL_Z, x1 - x0, y1 - y0, 4, (u) => at(C.woodDark, Math.floor(u) % 5 === 0 ? 1 : 2), (_u, v) => at(C.woodDark, v > 3 ? 4 : 2), () => at(C.woodDark, 2));
  // Cenefa calada bajo el borde: lenguas redondeadas pintadas de rojo colonial con el filo crema.
  const cenefa: Tinte = (u, v) => {
    const k = (u % 6) - 3;
    const hang = 3.2 - Math.sqrt(Math.max(0, 1 - (k / 3) ** 2)) * 2.4;
    if (v < hang) return null;
    if (v < hang + 0.7) return at(C.cream, 4);
    return at(COLONIAL, v > 2.6 ? 3 : 2);
  };
  s.quad([x0, y1 + 0.05, BAL_Z - 3.2], [1, 0, 0], [0, 0, 1], x1 - x0, 3.2, cenefa);
  s.quad([x1 + 0.05, y0, BAL_Z - 3.2], [0, 1, 0], [0, 0, 1], y1 - y0, 3.2, (u, v) => {
    const c = cenefa(u, v);
    return c && mix(c, at(C.night, 1), 0.2);
  });
  // Guirnalda de bombillitos colgada de la cenefa, de pilar a pilar.
  for (let i = 0; i < PILLARS.length - 1; i++) guirnalda(s, [PILLARS[i]! + 1.5, y1 + 0.4, BAL_Z - 3.5], [PILLARS[i + 1]! + 1.5, y1 + 0.4, BAL_Z - 3.5], 2.6, night, i * 2);

  // Materas con novios sobre el piso del balcón (asoman entre los balaustres) y la baranda.
  for (let x = x0 + 14; x < x1 - 6; x += 23) tarro(s, x, y1 - 3, BAL_Z + 4, noise(x, 1, 5) < 0.5 ? C.terracotta : C.rug, 3 * Math.floor(x));
  const posts = [0, ...PILLARS.slice(1, -1).map((p) => p + 1.5 - x0 - 1), x1 - x0 - 2];
  torneada(s, [x0 + 1, y1 - 1], [x1 - 1, y1 - 1], BAL_Z + 4, 12, posts);
  torneada(s, [x1 - 1, y0 + 0.5], [x1 - 1, y1 - 1], BAL_Z + 4, 12, [0]);
  // La bugambilia sube por el pilar de la esquina y se derrama por la baranda.
  const px = PILLARS[5]!;
  for (let z = DECK_H; z < BAL_Z; z += 0.5) {
    const off = Math.sin(z * 0.4) * 1.2;
    s.plot(px + 3.4, Y1 + BAL_D - 1.5 + off, z, at(C.logs, 1));
    if (noise(Math.floor(z * 2), 1, 13) < 0.5) s.plot(px + 3.8, Y1 + BAL_D - 1.5 + off, z, BUGAMBILIA[Math.floor(z) % 4]!);
    if (noise(Math.floor(z * 2), 2, 13) < 0.6) s.plot(px + 3.6, Y1 + BAL_D - 0.5 + off, z + 0.3, at(C.leaf, 3));
  }
  bugambilia(s, px - 26, px + 6, y1 - 1, y1 + 2, BAL_Z - 6, BAL_Z + 17, 21);
  bugambilia(s, x1 - 1, x1 + 2, y0 + 1, y1, BAL_Z - 4, BAL_Z + 15, 23, 0.8);
  bugambilia(s, x0 - 2, x0 + 14, y1 - 1, y1 + 2, BAL_Z - 4, BAL_Z + 10, 25, 0.7);
}

/** Matas colgadas del alero sobre el balcón (entre las puertas) y del balcón sobre el corredor. */
function drawMatasColgadas(s: Escena) {
  for (let i = 0; i < BALCONY_DOORS.length - 1; i++) {
    const [a, wa] = BALCONY_DOORS[i]!;
    const [b, wb] = BALCONY_DOORS[i + 1]!;
    const x = (a + wa / 2 + b - wb / 2) / 2;
    materaColgada(s, x, Y1 + 7, 66, ROOF.z - 3);
  }
  for (const x of [PILLARS[1]! + 8, PILLARS[2]! - 6, PILLARS[3]! + 9, PILLARS[4]! - 7]) materaColgada(s, x, Y1 + 7, 32, BAL_Z);
}

/** La chimenea de piedra por fuera del costado este, con el hombro y el sombrerete de tejas. */
function drawChimenea(s: Escena) {
  const { x, y0, y1, w, shoulder, top } = CHIM;
  // Piedras tibias (alguna rojiza), como la chimenea de la cabaña.
  const face = (luz: number) => (u: number, v: number) => piedra(u, v, 17, luz);
  s.box(x, y0, 0, w, y1 - y0, shoulder, null, face(0), face(1));
  // Hombro en talud: losas que se recogen hacia el cañón.
  for (let k = 0; k < 3; k++) s.box(x + k * 0.8, y0 + k, shoulder + k * 2.5, w - k * 1.6, y1 - y0 - k * 2, 2.5, () => losa(4), () => losa(3 - (k % 2)), () => losa(2));
  const cx0 = x + 1.5;
  const cw = w - 3;
  const cy0 = y0 + 3;
  const cd = y1 - y0 - 6;
  s.box(cx0, cy0, shoulder + 7.5, cw, cd, top - shoulder - 7.5, null, face(0), face(1));
  // Remate: cornisa, la boca con hollín y el sombrerete (cuatro pilarcitos con un techito de tejas).
  s.box(cx0 - 1, cy0 - 1, top, cw + 2, cd + 2, 2, (u, v) => (u > 2.5 && u < cw - 0.5 && v > 2.5 && v < cd - 0.5 ? OUT : losa(4)), () => losa(3), () => losa(2));
  for (const [px, py] of [
    [cx0, cy0],
    [cx0 + cw - 1.5, cy0],
    [cx0, cy0 + cd - 1.5],
    [cx0 + cw - 1.5, cy0 + cd - 1.5],
  ] as const)
    s.solid(px, py, top + 2, 1.5, 1.5, 4.5, losa(4), losa(3), losa(2));
  gableX(s, cx0 - 2.5, cx0 + cw + 2.5, cy0 - 2.5, cy0 + cd / 2, cy0 + cd + 2.5, top + 6.5 + (cd / 2 + 2.5) * 0.5, 0.5, 47);
}

/** El costado este: la puerta de atrás con su umbral y tejadillo, la leña y una jardinera. */
function drawEste(s: Escena, night: boolean) {
  const b = BACK_DOOR;
  const y0 = Y0 + b.u0 - 3;
  const y1 = Y0 + b.u1 + 3;
  // Umbral y escaloncito de piedra que bajan al patio.
  s.box(X1, y0, 0, 6, y1 - y0, 3, (u, v) => (Math.floor(v) % 9 === 0 ? losa(2) : u > 5 ? losa(5) : losa(4)), () => losa(3), (u, v) => (v > 2.2 ? losa(4) : Math.floor(u) % 9 === 0 ? losa(1) : losa(2)));
  s.box(X1 + 6, y0 + 2, 0, 5, y1 - y0 - 4, 1.4, () => losa(4), () => losa(2), (_u, v) => losa(v > 0.8 ? 3 : 1));
  // Tejadillo sobre la puerta, con dos canes de madera.
  for (const yy of [y0 + 1, y1 - 2]) for (let k = 0; k < 6; k += 0.4) s.plot(X1 + k, yy, b.top + 3 + k * 0.5, at(C.woodDark, 3));
  const ty0 = y0 - 2;
  const ty1 = y1 + 2;
  s.quad([X1, ty0, b.top + 10], [0, 1, 0], [1, 0, -0.5], ty1 - ty0, 9, (u, v) => tejas(u, v * 1.12, -1, 53));
  s.quad([X1 + 9, ty0, b.top + 5.5 - 2], [0, 1, 0], [0, 0, 1], ty1 - ty0, 2, () => at(C.woodDark, 2));
  // Un farolito sobre la puerta de atrás y la escoba recostada.
  lantern(s, X1 + 2.5, y1 + 1, b.top - 4, night);
  for (let z = 0; z < 20; z += 0.4) s.plot(X1 + 1 + z * 0.08, y0 - 2, z + 3, at(C.wood, 4));
  for (let z = 0; z < 5; z += 0.4) for (let k = -1.5; k <= 1.5; k += 0.4) s.plot(X1 + 1 + k * 0.2, y0 - 2 + k, z, at(C.mustard, z > 3 ? 4 : 3));

  // Leña apilada contra la pared, al frente de la esquina: las puntas de los troncos con sus anillos.
  const wy0 = 92;
  const wy1 = 112;
  for (let row = 0; row < 3; row++)
    for (let y = wy0 + (row % 2) * 2; y < wy1 - 3; y += 4.2) {
      const z = row * 3.6;
      s.box(X1, y, z, 9 + noise(y, row, 3) * 2, 4, 3.8, (u) => at(C.logs, u < 1 ? 2 : 4), (_u, v) => at(C.logs, v > 3 ? 3 : 2), (u, v) => {
        const d = Math.hypot(u - 2, v - 1.9);
        return d > 1.7 ? at(C.logs, 1) : at(C.cork, d > 1 ? 3 : 4);
      });
    }
  s.solid(X1, wy0 - 1, 0, 11, 1, 13, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.solid(X1, wy1 - 2, 0, 11, 1, 13, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Jardinera con novios bajo la ventana de atrás.
  s.box(X1, Y0 + 32, 12, 4, 12, 4, () => at(C.dirt, 1), () => at(C.wood, 2), (_u, v) => at(C.wood, v > 3 ? 4 : 2));
  for (let i = 0; i < 50; i++) {
    const y = Y0 + 32.5 + noise(i, 1, 9) * 11;
    const x = X1 + 0.5 + noise(i, 2, 9) * 3;
    const z = 16 + noise(i, 3, 9) * 3.5;
    s.plot(x, y, z, noise(i, 4, 9) < 0.35 ? at(C.rug, 4) : at(C.leaf, z > 18 ? 4 : 3));
  }
}

/** Pasto alto al pie de las paredes (menos frente a las puertas) y unas matas de flores. */
function drawPasto(s: Escena) {
  for (let i = 0; i < 90; i++) {
    const onFront = i < 50;
    const x = onFront ? X0 - 6 + noise(i, 1, 47) * (X1 - X0 + 12) : X1 + 11 + noise(i, 6, 47) * 2;
    const y = onFront ? Y1 + DECK_D + 0.6 : Y0 + noise(i, 2, 47) * (Y1 - Y0 + 10);
    if (onFront && x > X0 + DOOR.u0 - 10 && x < X0 + DOOR.u1 + 10) continue;
    if (!onFront && y > Y0 + BACK_DOOR.u0 - 6 && y < Y0 + BACK_DOOR.u1 + 6) continue;
    const h = 2 + noise(i, 3, 47) * 4;
    for (let z = 0; z < h; z += 0.4) s.plot(x + (z / h) * (noise(i, 4, 47) - 0.5) * 2, y, z, at(C.grass, z > h * 0.6 ? 4 : 2));
    if (noise(i, 5, 47) < 0.18) s.plot(x, y, h, noise(i, 7, 47) < 0.5 ? at(C.gold, 5) : at(C.white, 4));
  }
}

// =====================================================================================================
// El refugio de la parada "Casa" (4x2 tiles = 64x32). Postes de madera, techo de tejas a dos aguas, el
// tablado de atrás con vidrio arriba, la banca contra el tablado y, al frente, el letrero lima "CASA" del
// Megabús. La fila de adelante se camina bajo el techo (el cliente lo transparenta con alguien adentro).
// =====================================================================================================

const PARADA = { x0: 1, x1: 63, back: 1.5, front: 30, eave: 42, slope: 0.42 };
/** El bombillo bajo la cumbrera (la luz del catálogo está en [32, 16, 44]). */
export const PARADA_CASA_BULB = { x: 32, y: 16, z: 43 };

export function drawParadaCasa(night: boolean): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 70, y1: 38, z1: 66 }, 2);
  const { x0, x1, back, front, eave, slope } = PARADA;
  s.shadow(x0 - 1, back - 3, x1 - x0 + 6, front - back + 8, 0.28);
  // Piso de lajas.
  s.box(0, 0, 0, 64, 32, 1, (u, v) => {
    const k = noise(Math.floor((u + (Math.floor(v / 8) % 2) * 5) / 10), Math.floor(v / 8), 31);
    if (v % 8 < 0.6 || (u + (Math.floor(v / 8) % 2) * 5) % 10 < 0.6) return losa(2);
    return losa(k < 0.3 ? 3 : 4);
  }, (_u, v) => losa(v > 0.5 ? 3 : 2), () => losa(2));

  // Tablado de atrás (y = back): tablas abajo, vidrio arriba con su marco, y el horario pegado.
  const tablas = (u: number, v: number, luz: number) => {
    const k = u % 5;
    if (k < 0.6) return at(C.woodDark, 2 + luz);
    return at(C.wood, 3 + luz + (noise(Math.floor(u / 5), 1, 37) < 0.3 ? -1 : 0) + (v > 17 ? 1 : 0));
  };
  s.quad([x0 + 1, back, 1], [1, 0, 0], [0, 0, 1], x1 - x0 - 2, 19, (u, v) => {
    // El mapa de la ruta: solo dos paradas, la Estación Hyvento y la Casa, unidas por la línea lima.
    if (u > 38 && u < 54 && v > 12.5 && v < 18.5) {
      if (u < 38.8 || u > 53.2 || v < 13.3 || v > 17.7) return at(LIME, 2);
      if (Math.abs(v - 15.5) < 0.6 && u > 41 && u < 51) return at(LIME, 4);
      if (Math.hypot(u - 41, v - 15.5) < 1.3 || Math.hypot(u - 51, v - 15.5) < 1.3) return at(C.cream, 1);
      return at(C.cream, 5);
    }
    return tablas(u, v, 0);
  });
  // Travesaño y marco del vidrio.
  s.solid(x0 + 1, back - 0.5, 20, x1 - x0 - 2, 1.5, 2, at(C.woodDark, 5), at(C.woodDark, 3), at(C.woodDark, 2));
  for (const x of [x0 + 21, x0 + 41]) s.solid(x, back - 0.5, 22, 1.2, 1.2, eave - 24, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  // Costado este: tablas hasta la banca y vidrio arriba (cubre solo la fila de atrás).
  s.quad([x1 - 1.5, back, 1], [0, 1, 0], [0, 0, 1], 13, 19, (u, v) => tablas(u, v, -1));
  s.solid(x1 - 2, back, 20, 1.5, 13, 2, at(C.woodDark, 5), at(C.woodDark, 3), at(C.woodDark, 2));

  // La banca contra el tablado: patas, asiento de tablas y espaldar (se sienta mirando a la calle).
  for (const lx of [x0 + 4, x0 + 30, x1 - 7]) {
    s.solid(lx, 4, 1, 2, 2, 8, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
    s.solid(lx, 10, 1, 2, 2, 8, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  }
  s.box(x0 + 3, 3, 9, x1 - x0 - 8, 10, 2, (_u, v) => at(C.wood, v % 3.4 < 0.6 ? 2 : 5), (_u, v) => at(C.wood, v > 1 ? 4 : 2), () => at(C.wood, 2));
  s.solid(x0 + 3, back + 0.3, 13, x1 - x0 - 8, 1.5, 3, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  s.solid(x0 + 3, back + 0.3, 17.5, x1 - x0 - 8, 1.5, 2.5, at(C.wood, 5), at(C.wood, 4), at(C.wood, 3));
  // Un canasto olvidado en la banca con unas mazorcas.
  s.box(x0 + 9, 5, 11, 7, 5, 4, (u, v) => (u < 0.8 || v < 0.8 || u > 6.2 || v > 4.2 ? at(C.cork, 3) : at(C.mustard, (Math.floor(u) + Math.floor(v)) % 2 ? 4 : 3)), (u, v) => at(C.cork, (Math.floor(u) + Math.floor(v * 1.5)) % 2 ? 3 : 2), (u, v) => at(C.cork, (Math.floor(u) + Math.floor(v * 1.5)) % 2 ? 2 : 1));
  for (let k = 0; k <= 7; k += 0.3) s.plot(x0 + 9 + k, 7.5, 15 + Math.sin((k / 7) * Math.PI) * 4, at(C.cork, 2));

  // Postes con la franja lima del Megabús.
  for (const [px, py] of [
    [x0, back - 1],
    [x1 - 3, back - 1],
    [x0, front - 2],
    [x1 - 3, front - 2],
  ] as const) {
    s.box(px, py, 1, 3, 3, eave - 1, () => at(C.woodDark, 4), (_u, v) => (v > 3 && v < 6 ? at(LIME, 4) : at(C.woodDark, 3)), (_u, v) => (v > 3 && v < 6 ? at(LIME, 2) : at(C.woodDark, 2)));
    // Basa de piedra.
    s.box(px - 0.8, py - 0.8, 0, 4.6, 4.6, 2.5, () => losa(4), () => losa(3), () => losa(2));
  }
  // Vigas de amarre a lo largo y a lo ancho, bajo el techo.
  s.solid(x0, front - 2, eave - 3, x1 - x0, 3, 3, at(C.woodDark, 5), at(C.woodDark, 4), at(C.woodDark, 2));
  s.solid(x1 - 3, back - 1, eave - 3, 3, front - back + 1, 3, at(C.woodDark, 5), at(C.woodDark, 3), at(C.woodDark, 2));

  // Bombillo colgado de la cumbrera con su platico de lata.
  const B = PARADA_CASA_BULB;
  const ridgeZ = eave + (16 - (back - 3)) * slope;
  s.borde = false;
  for (let z = B.z + 3; z < ridgeZ; z += 0.4) s.plot(B.x, B.y, z, at(C.night, 2));
  s.borde = true;
  s.solid(B.x - 2, B.y - 2, B.z + 2, 4, 4, 1, at(LIME, 5), at(LIME, 3), at(LIME, 2));
  s.solid(B.x - 1, B.y - 1, B.z, 2, 2, 2, night ? at(C.gold, 5) : at(C.cream, 5), night ? at(C.gold, 5) : at(C.cream, 4), night ? at(C.gold, 4) : at(C.cream, 3));

  // Techo de tejas a dos aguas y el hastial este de escamas.
  gableX(s, -3, 67, back - 3, 16, front + 3, ridgeZ, slope, 71);
  s.quad([x1, back - 3, eave], [0, 1, 0], [0, 0, 1], front - back + 6, ridgeZ - eave, (u, v) => {
    const y = back - 3 + u;
    if (eave + v > ridgeZ - Math.abs(y - 16) * slope - 0.5) return null;
    if (v < 1.5) return at(C.woodDark, 2);
    return escamas(u, v, -1);
  });

  // El letrero lima "CASA" parado sobre el alero del frente, con dos patas.
  const SIGN = { x0: 15, x1: 49, z0: eave - 1, z1: eave + 13 };
  const sy = front + 3.5;
  for (const lx of [SIGN.x0 + 4, SIGN.x1 - 6]) s.solid(lx, sy - 2, SIGN.z0 - 2, 1.5, 2, 4, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  s.box(SIGN.x0, sy, SIGN.z0, SIGN.x1 - SIGN.x0, 1.4, SIGN.z1 - SIGN.z0, () => at(LIME, 5), (u, v) => {
    const w = SIGN.x1 - SIGN.x0;
    const h = SIGN.z1 - SIGN.z0;
    if (u < 1 || u > w - 1 || v < 1 || v > h - 1) return at(LIME, 1);
    const text = "CASA";
    const tw = text.length * 8 - 2;
    const gx = u - (w - tw) / 2;
    const gy = h - 2 - v;
    const li = Math.floor(gx / 8);
    const px = Math.floor((gx - li * 8) / 2);
    const py = Math.floor(gy / 2);
    if (gx >= 0 && li < text.length && px < 3 && py >= 0 && py < 5 && glyphOn(text[li]!, px, py)) return night ? at(C.cream, 5) : at(C.white, 4);
    return at(LIME, night ? 3 : v > h - 3 ? 5 : 4);
  }, (_u, v) => at(LIME, v > 1 ? 2 : 1));

  // Vidrio del tablado y del costado (translúcido: va de último).
  s.borde = false;
  const glass = (u: number, v: number) => {
    const d = u - v * 0.8;
    if (!night && (Math.abs(((d % 18) + 18) % 18 - 6) < 0.8)) return alpha(at(C.white, 4), 0.55);
    return night ? alpha(at(C.night, 3), 0.55) : alpha(mix(at(C.sky, 2), at(LIME, 5), 0.1), 0.45);
  };
  s.quad([x0 + 1, back, 22], [1, 0, 0], [0, 0, 1], x1 - x0 - 2, eave - 24, glass);
  s.quad([x1 - 1.5, back, 22], [0, 1, 0], [0, 0, 1], 13, eave - 24, glass);
  s.borde = true;
  return s.sprite();
}

// =====================================================================================================
// Mecedora (1x1, mira a +x): balancines curvos, patas torneadas, asiento y espaldar de esterilla en su
// marco de madera y los brazos. De espaldas ("back") es la misma, mirando a -x.
// =====================================================================================================

/** Esterilla: tejido de caña en diagonal, crema y dorado. */
function esterilla(u: number, v: number, edge: number, w: number, h: number): RGBA {
  if (u < edge || v < edge || u > w - edge || v > h - edge) return at(C.wood, 3);
  const a = Math.floor((u + v) / 1.2) % 2;
  const b = Math.floor((u - v + 40) / 1.2) % 2;
  return at(C.cork, a === b ? 4 : a ? 3 : 2);
}

/** Dibuja una mecedora en la escena con la esquina del tile en (ox, oy, oz); `back` = mira a -x. */
function rockerIn(s: Escena, ox: number, oy: number, oz: number, back: boolean) {
  const fx = (x: number, w = 0) => ox + (back ? 16 - x - w : x);
  const dirX = back ? -1 : 1;
  const wood = (x: number, y: number, z: number, w: number, d: number, h: number, base = 3) =>
    s.solid(fx(x, w), oy + y, oz + z, w, d, h, at(C.wood, base + 1), at(C.wood, base), at(C.wood, base - 1));
  // Balancines: arcos que tocan el piso al medio.
  for (const y of [2.6, 12]) for (let x = 1; x < 15; x += 0.6) wood(x, y, 0.045 * (x - 8.5) ** 2, 0.8, 1.4, 1.3, 2);
  // Patas y travesaños.
  for (const y of [2.8, 12.2]) {
    wood(4.5, y, 1.2, 1.2, 1.2, 8, 3);
    wood(11.5, y, 1.2, 1.2, 1.2, 8, 3);
    wood(5, y, 4, 6.5, 1, 1, 2);
  }
  // Asiento: marco y esterilla.
  s.box(fx(4, 8.8), oy + 2.6, oz + 9, 8.8, 10.8, 1.4, (u, v) => esterilla(back ? 8.8 - u : u, v, 1, 8.8, 10.8), () => at(C.wood, 3), () => at(C.wood, 2));
  // Espaldar inclinado hacia atrás: dos parales, el copete y la esterilla.
  const lean = -0.14 * dirX;
  const bx = fx(4.4);
  for (const y of [2.8, 12.2])
    for (let z = 9; z < 27; z += 0.4) {
      const x = bx + lean * (z - 9);
      s.solid(x - 0.6, oy + y, oz + z, 1.2, 1.2, 0.5, at(C.wood, 4), at(C.wood, 3), at(C.wood, 2));
    }
  s.quad([bx + lean * 3, oy + 3.6, oz + 12], [0, 1, 0], [lean, 0, 1], 8.6, 12, (u, v) => esterilla(u, v, 0.6, 8.6, 12));
  // Copete curvo arriba.
  for (let y = 2.8; y <= 13.4; y += 0.3) {
    const z = 26 + Math.sin(((y - 2.8) / 10.6) * Math.PI) * 1.6;
    for (let q = 0; q < 2; q += 0.4) s.plot(bx + lean * (z - 9) - 0.2 * dirX, oy + y, oz + z - q, at(C.wood, q < 0.5 ? 5 : 3));
  }
  // Brazos con su apoyo adelante.
  for (const y of [2.4, 12.4]) {
    wood(11.2, y + 0.2, 10.4, 1, 1, 5, 3);
    wood(4, y, 15.2, 9.6, 1.6, 1, 4);
  }
}

function mecedora(variant: Variant): Sprite {
  const s = new Escena({ x0: -2, y0: -2, z0: -1, x1: 18, y1: 18, z1: 30 }, 2);
  s.roundShadow(8.5, 8, 6.5, 0.25);
  rockerIn(s, 0, 0, 0, variant === "back");
  return s.sprite(4);
}

// =====================================================================================================
// Tendedero (1x3, a lo largo de y): dos horcones con la cuerda combada y la ropa al sol (la sábana, una
// camisa a cuadros, un pantalón, medias y una toalla) con sus ganchos, y el platón de ropa al pie.
// =====================================================================================================

const LINE = { x: 8, y0: 3, y1: 45, z: 33, sag: 3 };
const lineZ = (y: number) => LINE.z - LINE.sag * (1 - ((y - (LINE.y0 + LINE.y1) / 2) / ((LINE.y1 - LINE.y0) / 2)) ** 2);

function tendedero(_v: Variant): Sprite {
  const s = new Escena({ x0: -2, y0: -2, z0: -1, x1: 18, y1: 50, z1: 42 }, 2);
  s.shadow(5, 1, 6, 46, 0.2);
  // Horcones (con la horqueta arriba) clavados en el pasto.
  for (const y of [LINE.y0, LINE.y1]) {
    s.solid(LINE.x - 1, y - 1, 0, 2, 2, LINE.z + 1, at(C.woodDark, 5), at(C.woodDark, 3), at(C.woodDark, 2));
    for (let k = 0; k < 3; k += 0.4) {
      s.plot(LINE.x - 0.4, y - 0.8 - k * 0.5, LINE.z + 1 + k, at(C.woodDark, 4));
      s.plot(LINE.x - 0.4, y + 0.8 + k * 0.5, LINE.z + 1 + k, at(C.woodDark, 3));
    }
  }
  // La cuerda.
  s.borde = false;
  for (let y = LINE.y0; y <= LINE.y1; y += 0.3) s.plot(LINE.x, y, lineZ(y), at(C.cream, 2));
  s.borde = true;

  // Una prenda en el plano de la cuerda: `shape` dice si (u, v) es tela (v baja desde la cuerda).
  const prenda = (y0: number, w: number, h: number, tinte: (u: number, v: number) => RGBA | null, ganchos: number[]) => {
    s.quad([LINE.x + 0.2, y0, 0], [0, 1, 0], [0, 0, 1], w, LINE.z + 1, (u, v) => {
      const top = lineZ(y0 + u) + 0.3;
      const dv = top - v;
      if (dv < 0 || dv > h + 4) return null;
      return tinte(u, dv);
    });
    // Ganchos de ropa de colores, chiquitos, mordiendo la cuerda.
    s.borde = false;
    for (const g of ganchos) {
      const y = y0 + g;
      const z = lineZ(y);
      const r = BOMBILLOS[Math.floor(y) % BOMBILLOS.length]!;
      for (let k = -1.6; k < 1; k += 0.35) s.plot(LINE.x + 0.5, y, z + k, at(r, k > 0 ? 4 : 3));
    }
    s.borde = true;
  };
  // Sábana blanca con la franja azul del ruedo, doblada sobre la cuerda.
  prenda(5.5, 15, 20, (u, v) => {
    if (v > 20 - Math.sin(u * 0.7) * 0.6) return null;
    if (v < 1.2) return at(C.white, 2);
    if (v > 16 && v < 17.5) return at(C.fabric, 4);
    const fold = Math.sin(u * 0.9) > 0.6;
    return at(C.white, fold ? 3 : 4);
  }, [0.6, 7.5, 14.4]);
  // Camisa a cuadros rojos (de manga larga, colgada de las puntas).
  prenda(22, 9, 13, (u, v) => {
    const body = u > 1.8 && u < 7.2 && v < 13;
    const sleeve = (u <= 1.8 || u >= 7.2) && v > 1 && v < 11 - Math.abs(u - 4.5) * 0.2;
    if (!body && !sleeve) return null;
    if (body && Math.abs(u - 4.5) < 0.4 && v < 9) return at(C.white, 3);
    if (v < 1.4 && body) return at(C.rug, 1);
    const plaid = (Math.floor(u / 1.5) + Math.floor(v / 1.5)) % 2;
    return at(C.rug, plaid ? 3 : Math.floor(v / 1.5) % 2 ? 1 : 2);
  }, [2.2, 6.8]);
  // Pantalón de dril azul.
  prenda(32, 6, 14, (u, v) => {
    if (v < 3) return at(C.fabric, v < 0.8 ? 1 : 2);
    if (Math.abs(u - 3) < 0.5) return null;
    return at(C.fabric, u < 3 ? 3 : 2);
  }, [0.6, 5.4]);
  // Dos medias de colores.
  for (const [y, r] of [
    [39, C.mustard],
    [41.4, C.green],
  ] as const)
    prenda(y, 2, 6, (u, v) => (v < 5 ? at(r, v < 1 ? 2 : 3 + (Math.floor(v) % 2)) : u < 2 && v < 6.2 ? at(r, 2) : null), [1]);
  // El platón con ropa al pie.
  s.cylinder(12, 37, 0, 3, 3.2, (_a, v, luz) => at(C.fabric, v > 2.5 ? 4 : luz > 0 ? 3 : 2));
  s.disc(12, 37, 3.2, 3, (dx, dy) => (Math.hypot(dx, dy) > 2.4 ? at(C.fabric, 4) : noise(Math.floor(dx + 9), Math.floor(dy + 9), 4) < 0.5 ? at(C.white, 4) : at(C.rose, 4)));
  return s.sprite(4);
}

/** Sin versión de noche: las mecedoras y el tendedero. */
export const CASA_PROPIA_EXTERIOR_DRAW: Record<string, (v: Variant) => Sprite> = {
  mecedora,
  tendedero,
};

/** Con versión de noche (se registran en outdoor.ts): la casa y el refugio de la parada. */
export const CASA_PROPIA_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "casa-finca": drawCasaFinca,
  "parada-casa": drawParadaCasa,
};
