// Fase 5: el arte de la pesca. Cada pez del catálogo (packages/shared/src/fishing.ts) de 24x16 con su
// forma, aletas, colores y dibujo, más un brillo según la rareza; la basura; la silueta para el álbum;
// y las piezas del minijuego (la barra con el agua, el pez chiquito, el cofre, la boya).
import { C, OUT, mix } from "./palette";
import { PixelCanvas, alpha, at, bayer, noise, type Ramp, type RGBA } from "./pixel";

/** El dibujo mide 24x16 más 1 px de margen por lado (para el contorno y el brillo). */
export const FISH_W = 26;
export const FISH_H = 18;
const CY = 9;

type Shape = "torpedo" | "tall" | "eel" | "round" | "snout" | "flathead";
type Tail = "fork" | "round" | "fan" | "veil" | "shark" | "taper" | "double" | "lyre";
type Dorsal = "none" | "small" | "tall" | "spiny" | "sail" | "long" | "veil";
type Pattern =
  | "stripesV"
  | "stripeH"
  | "lateral"
  | "spots"
  | "bigSpots"
  | "patches"
  | "scales"
  | "plates"
  | "mottled"
  | "redTail"
  /** Franja oscura en la cola (dorado): la pinta drawTail. */
  | "tailBand"
  | "eyespot"
  | "gillSpot"
  | "stars";

interface FishArt {
  /** Largo y alto del cuerpo (sin la cola), en px. */
  len: number;
  h: number;
  shape: Shape;
  back: Ramp;
  /** Color de la panza (por defecto, el claro de la rampa). */
  belly?: RGBA;
  fin: RGBA;
  tail: Tail;
  tailLen?: number;
  dorsal?: Dorsal;
  pattern?: Pattern[];
  patternColor?: RGBA;
  patternColor2?: RGBA;
  whiskers?: number;
  teeth?: boolean;
  sucker?: boolean;
  lure?: boolean;
  spines?: boolean;
  /** Cuerpo transparente (se le ven las espinas). */
  ghost?: boolean;
  /** Boca hacia arriba (arawana). */
  mouthUp?: boolean;
  /** Cuánto baja la cara (0 = centrada). */
  dy?: number;
}

const SILVER: Ramp = C.stone;
const PINK = C.rose;

/** El arte de cada especie (mismo id que el catálogo). */
export const FISH_ART: Record<string, FishArt> = {
  mojarra: { len: 13, h: 8, shape: "tall", back: SILVER, belly: at(C.white, 3), fin: at(C.stone, 3), tail: "fork", dorsal: "spiny", pattern: ["lateral"], patternColor: at(C.stone, 2) },
  sardinata: { len: 16, h: 5, shape: "torpedo", back: C.blue, belly: at(C.white, 4), fin: at(C.stone, 4), tail: "fork", tailLen: 5, dorsal: "small", pattern: ["lateral"], patternColor: at(C.navy, 2) },
  carpa: { len: 15, h: 8, shape: "torpedo", back: C.mustard, belly: at(C.cream, 4), fin: at(C.terracotta, 3), tail: "fork", dorsal: "long", pattern: ["scales"], patternColor: at(C.mustard, 1), whiskers: 1 },
  bocachico: { len: 15, h: 7, shape: "torpedo", back: SILVER, belly: at(C.cream, 5), fin: at(C.curtain, 3), tail: "fork", dorsal: "small", sucker: true, pattern: ["scales"], patternColor: at(C.stone, 3) },
  tilapia: { len: 14, h: 9, shape: "tall", back: C.rug, belly: at(C.rose, 5), fin: at(C.rug, 4), tail: "round", dorsal: "spiny", pattern: ["stripesV"], patternColor: at(C.rug, 2) },
  guppy: { len: 8, h: 4, shape: "torpedo", back: C.sky, belly: at(C.white, 4), fin: at(C.neon, 3), tail: "fan", tailLen: 8, dorsal: "small", pattern: ["spots"], patternColor: at(C.mustard, 3), patternColor2: at(C.cyan, 3) },
  perca: { len: 14, h: 7, shape: "torpedo", back: C.leaf, belly: at(C.mustard, 4), fin: at(C.fire, 1), tail: "fork", dorsal: "spiny", pattern: ["stripesV"], patternColor: at(C.green, 0) },
  "pez-dorado": { len: 10, h: 8, shape: "round", back: C.fire, belly: at(C.mustard, 4), fin: at(C.fire, 3), tail: "double", tailLen: 6, dorsal: "small" },
  barbudo: { len: 15, h: 6, shape: "flathead", back: C.woodDark, belly: at(C.cream, 3), fin: at(C.woodDark, 3), tail: "round", dorsal: "small", whiskers: 5, pattern: ["mottled"], patternColor: at(C.woodDark, 1) },
  corroncho: { len: 14, h: 6, shape: "flathead", back: C.dirt, belly: at(C.cork, 3), fin: at(C.dirt, 3), tail: "lyre", dorsal: "tall", sucker: true, pattern: ["plates", "mottled"], patternColor: at(C.dirt, 4), patternColor2: at(C.dirt, 0) },
  trucha: { len: 16, h: 7, shape: "torpedo", back: C.sage, belly: at(C.cream, 5), fin: at(C.sage, 3), tail: "fork", dorsal: "small", pattern: ["stripeH", "spots"], patternColor: at(C.rose, 3), patternColor2: at(C.sage, 0) },
  cachama: { len: 13, h: 11, shape: "tall", back: C.metal, belly: at(C.fire, 3), fin: at(C.metal, 2), tail: "fork", dorsal: "small", pattern: ["scales"], patternColor: at(C.metal, 1) },
  "bagre-rayado": { len: 18, h: 6, shape: "flathead", back: C.stone, belly: at(C.white, 3), fin: at(C.stone, 2), tail: "fork", dorsal: "tall", whiskers: 6, pattern: ["stripesV", "spots"], patternColor: at(C.navy, 0), patternColor2: at(C.navy, 1) },
  anguila: { len: 21, h: 3, shape: "eel", back: C.green, belly: at(C.mustard, 3), fin: at(C.green, 1), tail: "taper", dorsal: "long" },
  lucio: { len: 18, h: 5, shape: "snout", back: C.leaf, belly: at(C.cream, 4), fin: at(C.leaf, 2), tail: "fork", dorsal: "small", teeth: true, pattern: ["bigSpots"], patternColor: at(C.leaf, 4) },
  "pez-luna": { len: 10, h: 10, shape: "round", back: C.mustard, belly: at(C.mustard, 5), fin: at(C.mustard, 2), tail: "round", dorsal: "spiny", pattern: ["stripesV", "gillSpot"], patternColor: at(C.mustard, 1), patternColor2: at(C.blue, 2) },
  capitan: { len: 12, h: 5, shape: "flathead", back: C.cork, belly: at(C.cream, 4), fin: at(C.cork, 3), tail: "round", dorsal: "small", whiskers: 4, pattern: ["mottled"], patternColor: at(C.woodDark, 2) },
  pirana: { len: 12, h: 10, shape: "tall", back: SILVER, belly: at(C.curtain, 3), fin: at(C.stone, 1), tail: "fork", dorsal: "small", teeth: true, pattern: ["spots"], patternColor: at(C.stone, 2) },
  arawana: { len: 19, h: 6, shape: "torpedo", back: SILVER, belly: at(C.rose, 5), fin: at(C.rose, 3), tail: "round", tailLen: 3, dorsal: "sail", mouthUp: true, whiskers: 2, pattern: ["scales"], patternColor: at(C.rose, 4) },
  pavon: { len: 15, h: 8, shape: "torpedo", back: C.leaf, belly: at(C.mustard, 4), fin: at(C.fire, 2), tail: "round", dorsal: "spiny", pattern: ["stripesV", "eyespot"], patternColor: at(C.green, 0), patternColor2: at(C.fire, 3) },
  koi: { len: 15, h: 8, shape: "torpedo", back: C.white, belly: at(C.white, 4), fin: at(C.white, 3), tail: "fan", dorsal: "long", whiskers: 1, pattern: ["patches"], patternColor: at(C.fire, 2), patternColor2: at(C.navy, 0) },
  esturion: { len: 19, h: 5, shape: "snout", back: C.metal, belly: at(C.stone, 4), fin: at(C.metal, 2), tail: "shark", tailLen: 5, dorsal: "small", whiskers: 2, pattern: ["plates"], patternColor: at(C.cream, 4) },
  "pez-globo": { len: 11, h: 11, shape: "round", back: C.mustard, belly: at(C.cream, 5), fin: at(C.mustard, 3), tail: "round", tailLen: 3, dorsal: "none", spines: true, pattern: ["bigSpots"], patternColor: at(C.woodDark, 2) },
  "pez-linterna": { len: 12, h: 7, shape: "round", back: C.navy, belly: at(C.navy, 3), fin: at(C.navy, 2), tail: "round", dorsal: "small", lure: true, teeth: true, pattern: ["spots"], patternColor: at(C.cyan, 4) },
  pirarucu: { len: 20, h: 7, shape: "torpedo", back: C.sage, belly: at(C.cream, 3), fin: at(C.curtain, 2), tail: "round", dorsal: "long", pattern: ["redTail", "scales"], patternColor: at(C.curtain, 2), patternColor2: at(C.sage, 1) },
  dorado: { len: 17, h: 7, shape: "torpedo", back: C.gold, belly: at(C.gold, 5), fin: at(C.fire, 2), tail: "fork", tailLen: 5, dorsal: "small", teeth: true, pattern: ["lateral", "tailBand"], patternColor: at(C.gold, 1), patternColor2: at(C.woodDark, 0) },
  raya: { len: 14, h: 12, shape: "round", back: C.cork, belly: at(C.cork, 4), fin: at(C.cork, 2), tail: "taper", tailLen: 8, dorsal: "none", pattern: ["bigSpots"], patternColor: at(C.mustard, 4) },
  "pez-fantasma": { len: 14, h: 7, shape: "torpedo", back: C.sky, belly: at(C.white, 4), fin: at(C.sky, 4), tail: "veil", dorsal: "veil", ghost: true },
  bigoton: { len: 20, h: 9, shape: "flathead", back: C.night, belly: at(C.stone, 3), fin: at(C.night, 3), tail: "round", tailLen: 4, dorsal: "tall", whiskers: 7, pattern: ["mottled"], patternColor: at(C.metal, 2) },
  "carpa-jade": { len: 15, h: 8, shape: "torpedo", back: C.green, belly: at(C.green, 5), fin: at(C.green, 4), tail: "veil", tailLen: 7, dorsal: "veil", whiskers: 2, pattern: ["scales"], patternColor: at(C.green, 5) },
  luminaria: { len: 14, h: 7, shape: "torpedo", back: C.cyan, belly: at(C.cyan, 5), fin: at(C.sky, 4), tail: "veil", tailLen: 7, dorsal: "veil", pattern: ["stars"], patternColor: at(C.white, 4), patternColor2: at(C.mustard, 4) },
};

// ---------- Cuerpo ----------

/** Mitad del alto (arriba, abajo) en `t` (0 = donde empieza la cola, 1 = la punta de la cara). */
function profile(a: FishArt, t: number): [number, number] {
  const hh = a.h / 2;
  switch (a.shape) {
    case "eel": {
      const end = Math.min(1, t / 0.12, (1 - t) / 0.1);
      const v = hh * Math.max(0.35, Math.sqrt(Math.max(0, end)));
      return [v, v];
    }
    case "round": {
      const u = (t - 0.5) / 0.5;
      const v = hh * Math.sqrt(Math.max(0, 1 - u * u)) + (t < 0.2 ? 0.6 : 0);
      return [v, v];
    }
    case "flathead": {
      // Cabeza ancha y aplastada, lomo recto y panza redonda.
      const m = 0.7;
      const u = t < m ? (m - t) / m : (t - m) / (1 - m);
      const v = hh * Math.sqrt(Math.max(0, 1 - u * u * (t < m ? 1 : 0.6)));
      return [Math.max(0.8, v * 0.85), Math.max(0.8, v)];
    }
    case "snout": {
      // Hocico largo y fino: el cuerpo termina en punta antes de la cara.
      if (t > 0.78) {
        const s = hh * 0.45 * (1 - (t - 0.78) / 0.28);
        return [Math.max(0.5, s), Math.max(0.5, s * 0.8)];
      }
      const u = (t - 0.5) / 0.5;
      const v = hh * Math.sqrt(Math.max(0, 1 - u * u));
      return [Math.max(0.9, v), Math.max(0.9, v)];
    }
    default: {
      const m = a.shape === "tall" ? 0.55 : 0.6;
      const u = t < m ? (m - t) / m : (t - m) / (1 - m);
      const v = hh * Math.sqrt(Math.max(0, 1 - u * u));
      const min = t < 0.25 ? hh * 0.32 : 0.5;
      return [Math.max(min, v), Math.max(min, v * (a.shape === "tall" ? 1 : 0.95))];
    }
  }
}

interface Body {
  x0: number;
  len: number;
  /** Por columna del cuerpo: arriba y abajo (px). */
  cols: { top: number; bot: number }[];
}

function drawBody(c: PixelCanvas, a: FishArt, x0: number): Body {
  const cols: Body["cols"] = [];
  const cy = CY + (a.dy ?? 0);
  const bellyC = a.belly ?? at(a.back, a.back.length - 1);
  for (let i = 0; i < a.len; i++) {
    const t = (i + 0.5) / a.len;
    const [up, down] = profile(a, t);
    const top = Math.round(cy - up);
    const bot = Math.round(cy + down) - 1;
    cols.push({ top, bot });
    for (let y = top; y <= bot; y++) {
      const v = (y + 0.5 - top) / Math.max(1, bot + 1 - top);
      let col: RGBA;
      if (v < 0.22) col = at(a.back, 1);
      else if (v < 0.45) col = at(a.back, 2);
      else if (v < 0.62) col = at(a.back, 3);
      else col = v < 0.78 ? mix(at(a.back, 3), bellyC, 0.55) : bellyC;
      // Brillo sobre el lomo cerca de la cabeza.
      if (v >= 0.22 && v < 0.34 && t > 0.45 && t < 0.8 && bayer(x0 + i, y) < 0.5) col = at(a.back, 4);
      c.set(x0 + i, y, a.ghost ? alpha(col, 0.66) : col);
    }
  }
  return { x0, len: a.len, cols };
}

const colAt = (b: Body, x: number) => b.cols[Math.max(0, Math.min(b.len - 1, x - b.x0))]!;

function drawPattern(c: PixelCanvas, a: FishArt, b: Body, seed: number) {
  const p1 = a.patternColor ?? at(a.back, 0);
  const p2 = a.patternColor2 ?? p1;
  const inside = (x: number, y: number) => {
    const k = x - b.x0;
    if (k < 0 || k >= b.len) return false;
    const col = b.cols[k]!;
    return y >= col.top && y <= col.bot;
  };
  const headStart = b.x0 + Math.round(b.len * 0.8); // la cara no lleva dibujo
  for (const pat of a.pattern ?? []) {
    for (let x = b.x0; x < headStart; x++) {
      const col = colAt(b, x);
      const hgt = col.bot - col.top + 1;
      for (let y = col.top; y <= col.bot; y++) {
        const k = x - b.x0;
        const v = (y - col.top) / Math.max(1, hgt - 1);
        switch (pat) {
          case "stripesV":
            if ((k + 1) % 3 === 0 && v < 0.8 && k > 1) c.set(x, y, p1);
            break;
          case "stripeH":
            if (Math.abs(v - 0.5) < 0.15) c.set(x, y, p1);
            break;
          case "lateral":
            if (y === Math.round((col.top + col.bot) / 2) && k % 2 === 0) c.set(x, y, p1);
            break;
          case "spots":
            if (noise(x, y, seed) < 0.16 && v < 0.75) c.set(x, y, noise(x, y, seed + 1) < 0.5 ? p1 : p2);
            break;
          case "bigSpots":
            if (noise(Math.floor(x / 2), Math.floor(y / 2), seed + 7) < 0.28 && (x + y) % 2 === 0 && v < 0.8) c.set(x, y, p1);
            break;
          case "patches": {
            const n = noise(Math.floor(x / 3), Math.floor(y / 3), seed + 3);
            if (n < 0.4) c.set(x, y, p1);
            else if (n > 0.86) c.set(x, y, p2);
            break;
          }
          case "scales":
            if ((x + (y % 2)) % 2 === 0 && y % 2 === 0 && v > 0.15 && v < 0.7) c.set(x, y, p1);
            break;
          case "plates":
            if (y === col.top + 1 && k % 3 === 1) c.set(x, y, p1);
            if (a.pattern?.includes("mottled") ? false : y === col.bot - 1 && k % 3 === 2) c.set(x, y, p1);
            break;
          case "mottled":
            if (noise(x, y, seed + 9) < 0.22 && v < 0.6) c.set(x, y, a.pattern?.includes("plates") ? p2 : p1);
            break;
          case "redTail":
            if (k < b.len * 0.45 && v > 0.25) c.set(x, y, bayer(x, y) < 0.3 + (1 - k / (b.len * 0.45)) * 0.7 ? p1 : at(a.back, 3));
            break;
          case "stars":
            if (noise(x, y, seed + 5) < 0.08) c.set(x, y, noise(x, y, seed + 6) < 0.5 ? p1 : p2);
            break;
          default:
            break;
        }
      }
    }
    if (pat === "eyespot") {
      // Un ojo pintado cerca de la cola (pavón).
      const x = b.x0 + 1;
      const col = colAt(b, x);
      const y = Math.round((col.top + col.bot) / 2);
      c.set(x, y, OUT);
      c.set(x + 1, y, p2);
      c.set(x, y - 1, p2);
      c.set(x, y + 1, p2);
    }
    if (pat === "gillSpot") {
      const x = b.x0 + Math.round(b.len * 0.68);
      const col = colAt(b, x);
      const y = Math.round(col.top + (col.bot - col.top) * 0.4);
      c.rect(x, y, 2, 2, p2);
    }
  }
}

function drawTail(c: PixelCanvas, a: FishArt, b: Body) {
  const len = a.tailLen ?? 4;
  const x1 = b.x0 - 1; // la cola termina junto al cuerpo
  const base = colAt(b, b.x0);
  const cy = Math.round((base.top + base.bot) / 2);
  const baseHalf = Math.max(1, (base.bot - base.top) / 2);
  const fin = a.fin;
  const dark = mix(fin, OUT, 0.35);
  const band = a.pattern?.includes("tailBand") ? (a.patternColor2 ?? dark) : null;
  const set = (x: number, y: number, col: RGBA) => c.set(x, y, a.ghost ? alpha(col, 0.62) : col);
  for (let d = 0; d < len; d++) {
    const x = x1 - d;
    const f = (d + 1) / len;
    switch (a.tail) {
      case "fork": {
        const spread = baseHalf + f * (a.h * 0.55);
        for (let y = Math.floor(cy - spread); y <= Math.ceil(cy + spread); y++) {
          const off = Math.abs(y - cy);
          if (off < f * spread * 0.55 && d > 0) continue; // la horquilla
          set(x, y, band && off > spread * 0.4 && d === len - 2 ? band : off > spread - 1 ? dark : fin);
        }
        break;
      }
      case "round":
      case "fan": {
        // Abanico: se abre desde el cuerpo y termina redondeado.
        const max = Math.max(baseHalf + 1, a.h * (a.tail === "fan" ? 0.62 : 0.42), a.tail === "fan" ? 3.5 : 0);
        const open = Math.min(1, f / 0.75);
        let spread = baseHalf * 0.7 + (max - baseHalf * 0.7) * Math.sqrt(open);
        if (d === len - 1) spread *= 0.72;
        const y0 = Math.round(cy - spread);
        const y1 = Math.round(cy + spread);
        for (let y = y0; y <= y1; y++) {
          const edge = y === y0 || y === y1 || d === len - 1;
          const ray = a.tail === "fan" && (y - cy) % 2 === 0 && d > 1;
          set(x, y, edge ? dark : ray && a.pattern?.includes("spots") ? (a.patternColor2 ?? fin) : fin);
        }
        break;
      }
      case "double": {
        // Cola doble del pececito dorado: dos abanicos que se abren.
        const spread = baseHalf + f * a.h * 0.6;
        for (let y = Math.floor(cy - spread); y <= Math.ceil(cy + spread); y++) {
          const off = Math.abs(y - cy);
          if (d > 1 && off < 1) continue;
          set(x, y, off > spread - 1.2 ? dark : bayer(x, y) < 0.3 ? at(C.mustard, 4) : fin);
        }
        break;
      }
      case "veil": {
        // Velo largo que cae ondulado y se deshilacha en la punta.
        const up = baseHalf + f * a.h * 0.28;
        const down = baseHalf + f * a.h * 0.62;
        const drop = Math.round(f * 2.2);
        const y0 = Math.round(cy - up) + drop;
        const y1 = Math.round(cy + down) + drop;
        for (let y = y0; y <= y1; y++) {
          const ragged = d === len - 1 && (y - y0) % 3 !== 1;
          if (ragged) continue;
          const edge = y === y0 || y === y1;
          const ray = (y - y0) % 3 === 1 && d > 0;
          c.set(x, y, alpha(edge ? mix(fin, C.white[4]!, 0.45) : ray ? mix(fin, OUT, 0.15) : fin, 0.95 - f * 0.15));
        }
        break;
      }
      case "shark": {
        // Lóbulo de arriba más largo (esturión).
        const up = baseHalf + f * a.h * 0.9;
        const down = baseHalf * (1 - f) + (f < 0.5 ? f * 2 : 0);
        for (let y = Math.floor(cy - up); y <= Math.ceil(cy + down); y++) {
          if (y < cy - up + f * a.h * 0.5 && d < len - 1 && y < cy - baseHalf) {
            if (y > cy - up + 1) set(x, y, fin);
            continue;
          }
          set(x, y, fin);
        }
        set(x, Math.floor(cy - up), dark);
        break;
      }
      case "lyre": {
        // Dos puntas largas (corroncho).
        const spread = baseHalf + f * a.h * 0.7;
        set(x, Math.round(cy - spread), dark);
        set(x, Math.round(cy + spread), dark);
        if (d < 2) for (let y = Math.round(cy - baseHalf); y <= Math.round(cy + baseHalf); y++) set(x, y, fin);
        else {
          set(x, Math.round(cy - spread) + 1, fin);
          set(x, Math.round(cy + spread) - 1, fin);
        }
        break;
      }
      case "taper": {
        // Sin aleta: la cola se afina (anguila) o es un látigo (raya).
        if (a.shape === "eel") {
          const half = Math.max(0, baseHalf * (1 - f));
          for (let y = Math.round(cy - half); y <= Math.round(cy + half); y++) set(x, y, at(a.back, 2));
        } else {
          set(x, cy + (d > len / 2 ? 1 : 0), at(a.back, 1));
        }
        break;
      }
    }
  }
}

function drawFins(c: PixelCanvas, a: FishArt, b: Body) {
  const fin = a.fin;
  const dark = mix(fin, OUT, 0.35);
  const set = (x: number, y: number, col: RGBA) => c.set(x, y, a.ghost ? alpha(col, 0.62) : col);
  const topAt = (t: number) => {
    const x = b.x0 + Math.round(b.len * t);
    return { x, y: colAt(b, x).top };
  };
  switch (a.dorsal ?? "small") {
    case "small": {
      const p = topAt(0.45);
      set(p.x, p.y - 1, fin);
      set(p.x + 1, p.y - 1, fin);
      set(p.x - 1, p.y - 1, dark);
      set(p.x, p.y - 2, dark);
      break;
    }
    case "tall": {
      const p = topAt(0.55);
      for (let k = 0; k < 3; k++) for (let j = 0; j <= 3 - k; j++) set(p.x - j + 1, p.y - 1 - k, k === 2 || j === 3 - k ? dark : fin);
      break;
    }
    case "spiny": {
      for (let t = 0.3; t <= 0.7; t += 0.08) {
        const p = topAt(t);
        const h = Math.round(t * 20) % 2 === 0 ? 2 : 1;
        for (let k = 1; k <= h; k++) set(p.x, p.y - k, k === h ? dark : fin);
        set(p.x + 1, p.y - 1, fin);
      }
      break;
    }
    case "long": {
      for (let t = 0.2; t <= 0.68; t += 1 / b.len) {
        const p = topAt(t);
        set(p.x, p.y - 1, fin);
      }
      break;
    }
    case "sail": {
      // Aleta larga y baja hacia la cola, arriba y abajo (arawana).
      for (let t = 0.02; t <= 0.35; t += 1 / b.len) {
        const p = topAt(t);
        set(p.x, p.y - 1, fin);
        const bot = colAt(b, p.x).bot;
        set(p.x, bot + 1, fin);
      }
      break;
    }
    case "veil": {
      for (let t = 0.25; t <= 0.7; t += 1 / b.len) {
        const p = topAt(t);
        const h = 1 + Math.round(Math.sin((t - 0.25) / 0.45 * Math.PI) * 2.5);
        for (let k = 1; k <= h; k++) c.set(p.x - Math.floor(k / 2), p.y - k, alpha(k === h ? mix(fin, C.white[4]!, 0.4) : fin, 0.8));
      }
      break;
    }
    case "none":
      break;
  }
  // Aleta de abajo y la del costado (casi todos).
  if (a.shape !== "eel" && a.tail !== "taper") {
    const x = b.x0 + Math.round(b.len * 0.4);
    const bot = colAt(b, x).bot;
    set(x, bot + 1, fin);
    set(x - 1, bot + 1, dark);
    const px = b.x0 + Math.round(b.len * 0.68);
    const col = colAt(b, px);
    const py = Math.round(col.top + (col.bot - col.top) * 0.62);
    set(px, py, dark);
    set(px - 1, py + 1, fin);
  }
  if (a.shape === "round" && a.tail === "taper") {
    // Raya: las alas se ven como un borde más oscuro.
    for (let k = 0; k < b.len; k++) {
      const col = b.cols[k]!;
      c.set(b.x0 + k, col.top, at(a.back, 1));
      c.set(b.x0 + k, col.bot, at(a.back, 1));
    }
  }
}

function drawFace(c: PixelCanvas, a: FishArt, b: Body) {
  const head = b.x0 + b.len - 1;
  const hc = colAt(b, head);
  const mid = Math.round((hc.top + hc.bot) / 2);
  // Ojo: más adentro en los de hocico largo.
  const ex = b.x0 + Math.round(b.len * (a.shape === "snout" ? 0.74 : a.shape === "round" ? 0.8 : 0.84));
  const ec = colAt(b, ex);
  const ey = Math.round(ec.top + (ec.bot - ec.top) * (a.shape === "flathead" ? 0.25 : 0.32));
  if (a.shape === "round" && a.tail === "taper") {
    // Raya (vista desde arriba): dos ojitos.
    c.set(ex, ey + 1, OUT);
    c.set(ex, ec.bot - 2, OUT);
    return;
  }
  c.set(ex, ey, OUT);
  if (a.back !== C.night && ec.bot - ec.top >= 4) c.set(ex - 1, ey, at(C.white, 4));
  // Opérculo: una rayita oscura detrás del ojo.
  if (a.shape !== "eel" && ec.bot - ec.top >= 4) {
    const gx = ex - 2;
    const g = colAt(b, gx);
    for (let y = g.top + 2; y <= g.bot - 1; y++) if ((y + gx) % 2 === 0) c.set(gx, y, mix(at(a.back, 2), OUT, 0.35));
  }
  // Boca.
  const my = a.mouthUp ? hc.top : a.sucker ? hc.bot : mid + (a.shape === "flathead" ? 1 : 0);
  c.set(head, my, mix(at(a.back, 1), OUT, 0.5));
  if (a.sucker) c.set(head, my + 1, at(C.rose, 3));
  if (a.teeth) {
    c.set(head, my + 1, at(C.white, 4));
    c.set(head - 1, my + 1, at(C.white, 3));
  }
  if (a.whiskers) {
    // Bigotes: salen de la boca hacia adelante y caen; los largos se curvan hacia atrás.
    const w = a.whiskers;
    const col = mix(at(a.back, 1), OUT, 0.35);
    const reach = Math.min(3, w);
    for (let k = 1; k <= reach; k++) c.set(head + k, my + Math.floor((k + 1) / 2), col);
    for (let k = reach + 1; k <= w; k++) c.set(head + reach - Math.floor((k - reach) / 2), my + Math.floor((reach + 1) / 2) + (k - reach), col);
    if (w >= 4) {
      const col2 = mix(at(a.back, 2), OUT, 0.2);
      for (let k = 1; k <= Math.min(3, w - 2); k++) c.set(head + k - 1, my + k + 1, col2);
    }
  }
  if (a.lure) {
    // Una varita desde la frente con una luz colgando.
    const lx = ex;
    const ly = ec.top - 1;
    c.set(lx, ly, at(C.navy, 2));
    c.set(lx + 1, ly - 1, at(C.navy, 2));
    c.set(lx + 2, ly - 2, at(C.navy, 2));
    c.set(lx + 3, ly - 2, at(C.navy, 3));
    c.set(lx + 4, ly - 1, at(C.mustard, 4));
    c.set(lx + 4, ly, at(C.gold, 5));
  }
}

/** Púas del pez globo, alrededor del cuerpo inflado. */
function drawSpines(c: PixelCanvas, b: Body) {
  for (let k = 1; k < b.len - 1; k += 2) {
    const col = b.cols[k]!;
    c.set(b.x0 + k, col.top - 1, at(C.woodDark, 3));
    c.set(b.x0 + k, col.bot + 1, at(C.woodDark, 3));
  }
}

function drawGhostBones(c: PixelCanvas, b: Body) {
  const spine = at(C.white, 4);
  for (let k = 1; k < b.len - 2; k++) {
    const col = b.cols[k]!;
    const mid = Math.round((col.top + col.bot) / 2);
    c.set(b.x0 + k, mid, spine);
    if (k % 2 === 0 && k < b.len - 4) {
      c.set(b.x0 + k, mid - 1, alpha(spine, 0.7));
      c.set(b.x0 + k, mid + 1, alpha(spine, 0.7));
      c.set(b.x0 + k, mid - 2, alpha(spine, 0.45));
      c.set(b.x0 + k, mid + 2, alpha(spine, 0.45));
    }
  }
}

// ---------- Basura ----------

function drawTrash(c: PixelCanvas, id: string) {
  if (id === "bota") {
    const leather = C.woodDark;
    // Caña de la bota y el pie, con suela y agujetas.
    c.rect(6, 2, 7, 10, at(leather, 3));
    c.rect(6, 2, 7, 1, at(leather, 4));
    c.rect(6, 10, 14, 4, at(leather, 3));
    c.rect(15, 10, 5, 1, at(leather, 4));
    c.rect(5, 14, 16, 2, at(C.stone, 1));
    c.rect(6, 14, 14, 1, at(C.stone, 2));
    for (let y = 4; y <= 10; y += 2) {
      c.set(8, y, at(C.cream, 3));
      c.set(10, y, at(C.cream, 3));
      c.set(9, y + 1, at(C.cream, 2));
    }
    c.set(12, 5, at(leather, 1));
    c.set(17, 12, at(leather, 1));
    c.rect(7, 12, 3, 1, at(C.green, 2)); // lodo
    c.set(4, 1, at(C.sky, 3));
    c.set(3, 3, at(C.sky, 2));
    return;
  }
  if (id === "alga") {
    // Hebras verdes enredadas.
    for (let s = 0; s < 5; s++) {
      const x0 = 5 + s * 3;
      for (let y = 2; y < 16; y++) {
        const x = x0 + Math.round(Math.sin(y * 0.7 + s * 1.3) * 1.5);
        c.set(x, y, at(C.leaf, 1 + ((s + y) % 3)));
        if (y % 4 === s % 4) c.set(x + 1, y, at(C.leaf, 4));
      }
    }
    c.set(12, 5, at(C.sage, 5));
    c.set(9, 11, at(C.sage, 5));
    return;
  }
  // Lata oxidada con etiqueta.
  c.rect(8, 3, 9, 12, at(C.metal, 3));
  c.rect(8, 3, 9, 1, at(C.metal, 5));
  c.rect(8, 14, 9, 1, at(C.metal, 1));
  c.rect(8, 6, 9, 5, at(C.curtain, 3));
  c.rect(8, 7, 9, 1, at(C.cream, 4));
  c.rect(8, 9, 9, 1, at(C.curtain, 1));
  c.rect(9, 3, 1, 12, at(C.metal, 4));
  for (const [x, y] of [[15, 4], [16, 12], [9, 12], [14, 13], [16, 5]] as const) c.set(x, y, at(C.terracotta, 2));
  c.rect(11, 2, 3, 1, at(C.metal, 2));
}

// ---------- Brillo por rareza ----------

const RARITY_GLOW: Record<string, { color: RGBA; halo: number; sparkles: number } | undefined> = {
  raro: { color: at(C.sky, 4), halo: 0, sparkles: 2 },
  epico: { color: at(C.violet, 5), halo: 0.5, sparkles: 2 },
  legendario: { color: at(C.gold, 4), halo: 0.75, sparkles: 3 },
};

function sparkle(c: PixelCanvas, x: number, y: number, col: RGBA) {
  c.set(x, y, at(C.white, 4));
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx, y + dy, col);
}

function applyGlow(c: PixelCanvas, rarity: string) {
  const g = RARITY_GLOW[rarity];
  if (!g) return;
  if (g.halo > 0) {
    const marks: number[] = [];
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (c.alphaAt(x, y) === 0 && (c.alphaAt(x + 1, y) > 200 || c.alphaAt(x - 1, y) > 200 || c.alphaAt(x, y + 1) > 200 || c.alphaAt(x, y - 1) > 200))
          marks.push(x, y);
    for (let k = 0; k < marks.length; k += 2) if (bayer(marks[k]!, marks[k + 1]!) < 0.75) c.set(marks[k]!, marks[k + 1]!, alpha(g.color, g.halo));
  }
  const spots: [number, number][] = [
    [3, 2],
    [22, 3],
    [20, 15],
  ];
  for (const [x, y] of spots.slice(0, g.sparkles)) if (c.alphaAt(x, y) === 0) sparkle(c, x, y, alpha(g.color, 0.9));
}

// ---------- Lo público ----------

/** Rareza de cada especie para el brillo (se pasa desde el catálogo, que vive en @hyvento/shared). */
export function drawFish(id: string, rarity: string, opts: { silhouette?: boolean } = {}): PixelCanvas {
  const c = new PixelCanvas(FISH_W, FISH_H);
  const a = FISH_ART[id];
  if (!a) {
    drawTrash(c, id);
  } else {
    const tail = a.tailLen ?? 4;
    // Lo que sobresale delante de la cara (bigotes, la lucecita) también tiene que caber.
    const front = a.lure ? 4 : a.whiskers ? Math.min(3, a.whiskers) : 0;
    const total = a.len + tail + front;
    const x0 = Math.max(1 + tail, Math.round((FISH_W - total) / 2) + tail);
    const b = drawBody(c, a, x0);
    if (a.ghost) drawGhostBones(c, b);
    drawPattern(c, a, b, id.length * 31 + id.charCodeAt(0));
    drawTail(c, a, b);
    drawFins(c, a, b);
    if (a.spines) drawSpines(c, b);
    drawFace(c, a, b);
  }
  c.outline(OUT, 120);
  if (opts.silhouette) {
    // Silueta para el álbum: la forma en un solo tono, sin detalles ni brillo.
    const d = c.data;
    const s = at(C.navy, 1);
    for (let i = 0; i < d.length; i += 4)
      if (d[i + 3]! > 0) {
        d[i] = s[0];
        d[i + 1] = s[1];
        d[i + 2] = s[2];
        d[i + 3] = 230;
      }
    return c;
  }
  applyGlow(c, rarity);
  return c;
}

/** ¿Tiene dibujo propio? (la basura también: bota, alga, lata). */
export const hasFishArt = (id: string) => Boolean(FISH_ART[id]) || id === "bota" || id === "alga" || id === "lata";

// ---------- Minijuego ----------

/** Medidas del minijuego en px del juego. */
export const BAR = {
  w: 34,
  h: 128,
  /** El agua: x, y, ancho y alto. */
  trackX: 6,
  trackY: 6,
  trackW: 12,
  trackH: 104,
  /** El medidor de captura. */
  meterX: 22,
  meterW: 5,
} as const;

/** Colores del medidor según cuánto lleva: rojo, naranja, amarillo, verde. */
function meterColor(v: number): RGBA {
  if (v < 0.25) return at(C.rug, 3);
  if (v < 0.5) return at(C.fire, 2);
  if (v < 0.75) return at(C.mustard, 3);
  return at(C.leaf, 4);
}

let frameCache: PixelCanvas | null = null;

/** El marco de madera del minijuego (sin lo que se mueve). */
export function fishingFrame(): PixelCanvas {
  if (frameCache) return frameCache;
  const c = new PixelCanvas(BAR.w, BAR.h);
  const wood = C.wood;
  // Cuerpo de madera con veta.
  for (let y = 1; y < BAR.h - 16; y++)
    for (let x = 1; x < 30; x++) {
      const edge = x === 1 || x === 29 || y === 1 || y === BAR.h - 17;
      c.set(x, y, edge ? at(wood, 1) : at(wood, noise(x, Math.floor(y / 3), 5) < 0.15 ? 2 : (y + Math.floor(x / 7)) % 9 === 0 ? 2 : 3));
    }
  c.rect(2, 2, 27, 1, at(wood, 4));
  // Hueco del agua y del medidor.
  c.rect(BAR.trackX - 1, BAR.trackY - 1, BAR.trackW + 2, BAR.trackH + 2, at(C.woodDark, 1));
  c.rect(BAR.meterX - 1, BAR.trackY - 1, BAR.meterW + 2, BAR.trackH + 2, at(C.woodDark, 1));
  for (let y = 0; y < BAR.trackH; y++)
    for (let x = 0; x < BAR.trackW; x++) {
      const deep = y / BAR.trackH;
      const band = deep + (bayer(x, y) - 0.5) * 0.12;
      c.set(BAR.trackX + x, BAR.trackY + y, at(C.blue, band < 0.3 ? 4 : band < 0.65 ? 3 : 2));
    }
  c.rect(BAR.meterX, BAR.trackY, BAR.meterW, BAR.trackH, at(C.woodDark, 2));
  // Carrete y manija abajo.
  const ry = BAR.h - 10;
  c.ellipse(12, ry, 8, 7, at(C.metal, 2));
  c.ellipse(12, ry, 6, 5, at(C.metal, 3));
  c.ellipse(12, ry, 3, 3, at(C.metal, 4));
  c.rect(11, BAR.h - 18, 3, 3, at(C.metal, 2));
  // Clavitos en las esquinas.
  for (const [x, y] of [[3, 3], [27, 3], [3, BAR.h - 20], [27, BAR.h - 20]] as const) c.set(x, y, at(C.gold, 4));
  c.outline(OUT);
  frameCache = c;
  return c;
}

/** El pez chiquito del minijuego (9x7), del color de su rareza. */
export function fishIcon(rarity: string): PixelCanvas {
  const c = new PixelCanvas(11, 9);
  const body: Record<string, Ramp> = { comun: C.stone, "poco-comun": C.green, raro: C.blue, epico: C.violet, legendario: C.gold, basura: C.stone };
  const r = body[rarity] ?? C.stone;
  const rows = ["...bb....", "..bbbb..t", ".bbbbbbtt", "bebbbbbtt", ".bbbbbbtt", "..bbbb..t", "...bb...."];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "b") c.set(9 - x, y + 1, at(r, y < 3 ? 3 : 4));
      if (ch === "t") c.set(9 - x, y + 1, at(r, 2));
      if (ch === "e") c.set(9 - x, y + 1, OUT);
    }),
  );
  c.outline(OUT);
  return c;
}

/** Cofre de tesoro (9x8). */
export function treasureChest(open = false): PixelCanvas {
  const c = new PixelCanvas(11, 10);
  c.rect(1, open ? 2 : 3, 9, open ? 2 : 3, at(C.wood, 4));
  c.rect(1, 5, 9, 4, at(C.wood, 3));
  c.rect(1, 5, 9, 1, at(C.gold, 3));
  c.rect(1, 8, 9, 1, at(C.wood, 1));
  c.rect(5, 5, 1, 3, at(C.gold, 4));
  if (open) c.rect(3, 4, 5, 1, at(C.gold, 5));
  c.outline(OUT);
  return c;
}

export interface BarState {
  /** Valores del minijuego (unidades de Stardew: el agua mide 568). */
  track: number;
  fishSize: number;
  barPos: number;
  barHeight: number;
  fishPos: number;
  fishInBar: boolean;
  meter: number;
  rarity: string;
  treasure?: { pos: number; size: number; meter: number; inBar: boolean } | null;
  /** Reloj en frames (burbujas, parpadeos) y si se está apretando (el carrete gira). */
  t: number;
  holding: boolean;
  /** Terminó: la barra se congela en verde (atrapado) o rojo (se escapó). */
  result?: "caught" | "escaped" | null;
}

/** Dibuja el minijuego completo en un lienzo de BAR.w x BAR.h (el cliente lo llama cada frame). */
export function drawFishingBar(s: BarState, into?: PixelCanvas): PixelCanvas {
  const c = into ?? new PixelCanvas(BAR.w, BAR.h);
  c.data.set(fishingFrame().data);
  const k = BAR.trackH / s.track;
  // Burbujas que suben.
  for (let i = 0; i < 4; i++) {
    const by = BAR.trackH - 1 - ((s.t * (0.35 + i * 0.1) + i * 31) % BAR.trackH);
    const bx = BAR.trackX + 2 + ((i * 5 + Math.floor(s.t / 40)) % (BAR.trackW - 4));
    c.set(bx, BAR.trackY + Math.floor(by), alpha(at(C.sky, 4), 0.7));
  }
  // La barra verde: brillante con el pez adentro, apagada si no.
  const y0 = BAR.trackY + Math.round(s.barPos * k);
  const bh = Math.max(3, Math.round(s.barHeight * k));
  const on = s.fishInBar;
  const green = s.result === "escaped" ? C.rug : C.leaf;
  for (let y = 0; y < bh; y++)
    for (let x = 1; x < BAR.trackW - 1; x++) {
      const edge = y === 0 || y === bh - 1;
      const col = edge ? at(green, on ? 5 : 3) : x === 1 ? at(green, on ? 4 : 2) : x === BAR.trackW - 2 ? at(green, on ? 2 : 1) : at(green, on ? 3 : 2);
      c.set(BAR.trackX + x, y0 + y, on || s.result ? col : alpha(col, 0.72));
    }
  // Cofre y su medidorcito.
  if (s.treasure) {
    const ty = BAR.trackY + Math.round((s.treasure.pos + s.treasure.size / 2) * k) - 5;
    const chest = treasureChest(s.treasure.meter >= 1);
    blit(c, chest, BAR.trackX + 1, ty);
    if (s.treasure.meter > 0) {
      const w = Math.round(s.treasure.meter * 9);
      c.rect(BAR.trackX + 1, ty + 10, 9, 1, at(C.woodDark, 1));
      c.rect(BAR.trackX + 1, ty + 10, w, 1, at(C.gold, 4));
    }
  }
  // El pez: tiembla un poco cuando está fuera de la barra.
  const fy = BAR.trackY + Math.round((s.fishPos + s.fishSize / 2) * k) - 4;
  const shake = !on && !s.result && s.t % 6 < 3 ? 1 : 0;
  blit(c, fishIcon(s.rarity), BAR.trackX + shake, fy);
  // Medidor de captura, de abajo hacia arriba.
  const mh = Math.round(s.meter * BAR.trackH);
  const mc = meterColor(s.meter);
  c.rect(BAR.meterX, BAR.trackY + BAR.trackH - mh, BAR.meterW, mh, mc);
  if (mh > 1) c.rect(BAR.meterX, BAR.trackY + BAR.trackH - mh, BAR.meterW, 1, mix(mc, C.white[4]!, 0.45));
  // La manija del carrete gira mientras se aprieta.
  const angle = (s.t * (s.holding ? 0.35 : 0.05)) % (Math.PI * 2);
  const hx = 12 + Math.round(Math.cos(angle) * 4);
  const hy = BAR.h - 10 + Math.round(Math.sin(angle) * 4);
  c.line(12, BAR.h - 10, hx, hy, at(C.metal, 5));
  c.rect(hx - 1, hy - 1, 2, 2, at(C.cream, 4));
  // Gema de la rareza arriba del medidor.
  const gem: Record<string, RGBA> = { comun: at(C.stone, 4), "poco-comun": at(C.leaf, 4), raro: at(C.sky, 3), epico: at(C.violet, 4), legendario: at(C.gold, 4) };
  c.rect(BAR.meterX, BAR.trackY + BAR.trackH + 3, BAR.meterW, 3, gem[s.rarity] ?? at(C.stone, 4));
  return c;
}

function blit(dst: PixelCanvas, src: PixelCanvas, x0: number, y0: number) {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3]!;
      if (a) dst.set(x0 + x, y0 + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, a]);
    }
}

// ---------- La caña (piezas chicas) ----------

/** Boya de 5x7: roja arriba y blanca abajo. `sunk` = hundida (solo asoma la punta). */
export function bobber(sunk = false): PixelCanvas {
  const c = new PixelCanvas(7, 9);
  if (sunk) {
    c.rect(2, 5, 3, 2, at(C.rug, 3));
    c.set(3, 4, at(C.cream, 4));
  } else {
    c.set(3, 1, at(C.cream, 5));
    c.rect(2, 2, 3, 2, at(C.rug, 3));
    c.set(2, 2, at(C.rug, 4));
    c.rect(2, 4, 3, 2, at(C.white, 4));
    c.set(4, 5, at(C.white, 2));
  }
  c.outline(OUT);
  return c;
}

/** "!" de la picada, sobre la cabeza. */
export function biteMark(): PixelCanvas {
  const c = new PixelCanvas(7, 12);
  c.rect(2, 1, 3, 6, at(C.mustard, 4));
  c.rect(2, 1, 3, 1, at(C.gold, 5));
  c.rect(2, 8, 3, 3, at(C.mustard, 4));
  c.outline(OUT);
  return c;
}

/** Colores del sedal y de la caña (el cliente los dibuja píxel a píxel). */
export const ROD_COLORS = { rod: at(C.woodDark, 3), rodLight: at(C.wood, 4), grip: at(C.rug, 2), line: alpha(at(C.cream, 5), 0.85), ripple: alpha(at(C.sky, 4), 0.85) };

