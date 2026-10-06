// La Feria de la cosecha por código (VIR-169): los puestos del mercado campesino con su toldo de color, la
// olla del sancocho sobre el fogón de piedras (de noche el fuego prendido), la báscula y el tablero del
// concurso de la ahuyama, la tómbola de la junta con su ruleta, bultos de papa, canastos, el poste y el arco
// de mazorcas, el canasto de mimbre, la carreta del premio y la Pinta, la mula de Don Ramiro. Coordenadas
// locales de arte (tile = 16). Lo de enfrente mira a +y. Cálido y de otoño: madera, fique, mimbre, maíz y
// ahuyamas; nada gris.
import { Escena, type Tinte } from "./exterior-escena";
import { C, OUT } from "./palette";
import { PixelCanvas, alpha, at, hex, noise, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

const WOOD = C.wood;
const DARK = C.woodDark;
/** La ahuyama: de la sombra al brillo. */
const AHUYAMA = ramp("#5a2a0a", "#9a4a12", "#c8661a", "#e8862a", "#f5a84a", "#ffd090");
/** El maíz y su capacho. */
const MAIZ = ramp("#6b4a12", "#a0741f", "#cfa033", "#e9c65a", "#f6de8c", "#fff2c0");
const CAPACHO = ramp("#4a4a1a", "#6a6a2a", "#8a8a3a", "#b0a85a", "#d4c88a", "#ece4b0");
/** La papa criolla y el fique de los bultos. */
const PAPA = ramp("#5a3a12", "#8a5a1a", "#b8862a", "#d8aa42", "#ecc868", "#f7e08a");
const FIQUE = ramp("#5a4428", "#7d6440", "#a8895a", "#c8aa78", "#e0c898", "#f2e2bc");
/** El mimbre de los canastos. */
const MIMBRE = C.cork;
/** El toldo de cada puesto: de la sombra al brillo, con su raya clara. */
const TOLDOS: Record<string, Ramp> = {
  rojo: ramp("#5a1414", "#8a2020", "#b83a2a", "#d8503a", "#ef7a5a", "#ffb09a"),
  amarillo: ramp("#6a4a0a", "#a0741a", "#d8a62a", "#f2c83a", "#ffe070", "#fff4c0"),
  verde: ramp("#1f3a1c", "#2e5a2a", "#437a3a", "#5f9a4a", "#8abd6a", "#bfe0a0"),
  naranja: ramp("#6a2a0a", "#a04a12", "#d06a1a", "#ec8a2a", "#ffb060", "#ffe0b0"),
  azul: ramp("#14284a", "#1f3f73", "#2f5aa0", "#4a7ac4", "#7aa4e0", "#c0d8f4"),
};
const RAYA = C.cream;

/** Bolita con luz arriba a la izquierda (fruta, papa, piedra del fogón). */
function ball(s: Escena, x: number, y: number, z: number, r: number, col: Ramp, rz = r, base = 2.4) {
  for (let dz = -rz; dz <= rz; dz += 0.45)
    for (let dy = -r; dy <= r; dy += 0.45)
      for (let dx = -r; dx <= r; dx += 0.45) {
        if ((dx * dx + dy * dy) / (r * r) + (dz * dz) / (rz * rz) > 1) continue;
        const luz = (-dx - dy * 0.4 + dz * 1.2) / Math.max(r, rz);
        s.plot(x + dx, y + dy, z + dz, at(col, base + luz * 1.4));
      }
}

/** Ahuyama: gajos marcados (los surcos más oscuros), achatada, con su tallito verde. */
function ahuyama(s: Escena, x: number, y: number, z: number, r: number) {
  const rz = r * 0.72;
  for (let dz = -rz; dz <= rz; dz += 0.4)
    for (let dy = -r; dy <= r; dy += 0.4)
      for (let dx = -r; dx <= r; dx += 0.4) {
        if ((dx * dx + dy * dy) / (r * r) + (dz * dz) / (rz * rz) > 1) continue;
        const a = Math.atan2(dy, dx);
        const surco = Math.abs(Math.sin(a * 4)) < 0.22 && dx * dx + dy * dy > r * r * 0.25;
        const luz = (-dx - dy * 0.4 + dz * 1.3) / r;
        s.plot(x + dx, y + dy, z + rz + dz, at(AHUYAMA, 2.5 + luz * 1.3 - (surco ? 1 : 0)));
      }
  for (let k = 0; k < 2; k += 0.4) s.plot(x + k * 0.3, y, z + rz * 2 + k, at(C.leaf, 2));
}

/** Mazorca acostada a lo largo de `ang` (radianes en el piso): granos amarillos y el capacho abierto atrás. */
function mazorca(s: Escena, x: number, y: number, z: number, ang: number, len = 5) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  for (let t = 0; t < len; t += 0.35) {
    const r = 1.05 - Math.abs(t / len - 0.45) * 0.6;
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const ox = -uy * Math.cos(a) * r;
      const oy = ux * Math.cos(a) * r;
      const oz = Math.sin(a) * r;
      const grano = Math.round(t * 2 + a * 2) % 2;
      s.plot(x + ux * t + ox, y + uy * t + oy, z + r + oz, at(MAIZ, 2.4 + Math.sin(a) * 1.1 + grano * 0.4));
    }
  }
  // El capacho: dos hojas que se abren desde la base.
  for (const side of [-1, 1])
    for (let t = 0; t < 3.2; t += 0.3) s.plot(x - ux * t * 0.6 - uy * side * t * 0.45, y - uy * t * 0.6 + ux * side * t * 0.45, z + 1 + t * 0.15, at(CAPACHO, 3 - t * 0.3));
}

/** Mazorca colgada (para las guirnaldas): vertical, con el capacho hacia arriba. */
function mazorcaColgada(s: Escena, x: number, y: number, z: number) {
  for (let t = 0; t < 3.6; t += 0.4)
    for (let a = 0; a < Math.PI * 2; a += 0.6) {
      const r = 0.85 - Math.abs(t / 3.6 - 0.4) * 0.45;
      s.plot(x + Math.cos(a) * r, y + Math.sin(a) * r, z - t, at(MAIZ, 2.4 + Math.sin(a + 0.8) * 1.2));
    }
  for (const d of [-0.8, 0.8]) for (let t = 0; t < 1.6; t += 0.3) s.plot(x + d * t * 0.7, y, z + t * 0.5, at(CAPACHO, 3));
}

/** Papas criollas regadas sobre una superficie (z). */
function papitas(s: Escena, x: number, y: number, z: number, w: number, d: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) ball(s, x + noise(i, 1, seed) * w, y + noise(i, 2, seed) * d, z + 0.8 + noise(i, 3, seed) * 0.6, 0.9 + noise(i, 4, seed) * 0.35, PAPA, 0.8);
}

/** Canasto de mimbre (el tejido en rombos) lleno de `contenido`. */
function canasto(s: Escena, x: number, y: number, r: number, h: number, contenido: "mazorcas" | "papas" | "ahuyamas" | "frutas", seed: number) {
  s.roundShadow(x, y + 0.5, r + 0.6, 0.24);
  s.cylinder(x, y, 0, r, h, (a, v, luz) => at(MIMBRE, 2.2 + luz + ((Math.round(a * 6 + v) + Math.round(a * 6 - v)) % 2 ? 0.5 : -0.3)));
  s.disc(x, y, h, r, (dx, dy) => (dx * dx + dy * dy > (r - 0.7) * (r - 0.7) ? at(MIMBRE, 4) : at(MIMBRE, 0)));
  if (contenido === "mazorcas") for (let k = 0; k < 4; k++) mazorca(s, x - r * 0.6 + k * 0.4, y - r * 0.5 + k * 0.5, h - 0.8 + k * 0.5, 0.6 + k * 0.5, r * 1.3);
  else if (contenido === "papas") papitas(s, x - r * 0.7, y - r * 0.7, h - 1, r * 1.4, r * 1.4, 9, seed);
  else if (contenido === "ahuyamas") {
    ahuyama(s, x - 0.8, y - 0.4, h - 1.2, r * 0.55);
    ahuyama(s, x + 1, y + 0.8, h - 1.2, r * 0.45);
  } else
    for (let i = 0; i < 9; i++) {
      const col = [C.rug, AHUYAMA, TOLDOS.amarillo!, C.curtain][i % 4]!;
      ball(s, x + (noise(i, 1, seed) - 0.5) * r * 1.3, y + (noise(i, 2, seed) - 0.5) * r * 1.3, h + 0.5 + noise(i, 3, seed), 0.9, col);
    }
}

// ---------- Los puestos del mercado ----------

/** Lo que cada puesto tiene en el mostrador. */
type Mercancia = "tuberculos" | "frutas" | "granos" | "arepas" | "ahuyamas";
const PUESTO_DE: Record<string, Mercancia> = { rojo: "tuberculos", amarillo: "frutas", verde: "granos", naranja: "arepas", azul: "ahuyamas" };

/** El puesto: cuatro parales, mostrador de tablas, lo que se vende encima y el toldo a rayas de su color. */
function puesto(color: string): Sprite {
  const toldo = TOLDOS[color]!;
  const lo = PUESTO_DE[color]!;
  const s = scene(2, 1, 50);
  s.shadow(1, 1, 30, 15, 0.22);
  for (const [x, y, h] of [[2, 2, 36], [29, 2, 36], [2, 14, 31], [29, 14, 31]] as const) s.solid(x, y, 0, 1.4, 1.4, h, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  // El mostrador de tablas (con un costal colgando del frente).
  s.box(3, 8, 0, 26, 6, 12, flatT(at(WOOD, 4)), (u, v) => at(WOOD, 3 - (Math.floor(u / 2.6) % 2) * 0.7 - (v > 10.5 ? -1 : 0)), flatT(at(WOOD, 1)));
  s.box(5, 14.1, 4, 7, 0.3, 6, null, (u, v) => at(FIQUE, 3 - ((Math.round(u * 2) + Math.round(v * 2)) % 2) * 0.4), null);
  // La mercancía.
  if (lo === "tuberculos") {
    papitas(s, 5, 9, 12, 9, 4, 14, 3);
    for (let k = 0; k < 3; k++) ball(s, 18 + k * 3, 10.5 + (k % 2), 13, 1.1, FIQUE, 0.9, 3);
    // Cebollas largas: el tallo verde parado.
    for (let k = 0; k < 4; k++) {
      ball(s, 26 + (k % 2), 9.5 + k * 0.9, 12.8, 0.8, C.cream, 0.7, 3);
      for (let z = 13.4; z < 19; z += 0.4) s.plot(26 + (k % 2) + (z - 13) * 0.08, 9.5 + k * 0.9, z, at(C.leaf, 3));
    }
  } else if (lo === "frutas") {
    const cols = [C.rug, TOLDOS.amarillo!, AHUYAMA, C.curtain];
    cols.forEach((col, i) => {
      const x = 6.5 + i * 6.2;
      s.box(x - 2.6, 9, 12, 5.2, 4, 1.4, flatT(at(MIMBRE, 4)), flatT(at(MIMBRE, 2)), flatT(at(MIMBRE, 1)));
      for (let k = 0; k < 5; k++) ball(s, x - 1.5 + (k % 3) * 1.5, 10 + Math.floor(k / 3) * 1.6, 14.3, 0.85, col);
    });
  } else if (lo === "granos") {
    // Costales abiertos de fríjol, maíz y semillas, y mazorcas arrumadas.
    [PAPA, MAIZ, C.rug].forEach((col, i) => {
      const x = 7 + i * 6.5;
      s.cylinder(x, 11, 12, 2.4, 3.4, (_a, _v, luz) => at(FIQUE, 2.6 + luz));
      s.disc(x, 11, 15.4, 2.2, (dx, dy) => at(col, 2.6 + noise(Math.round(dx * 3), Math.round(dy * 3), i) * 1.4));
    });
    for (let k = 0; k < 3; k++) mazorca(s, 23, 9 + k * 1.6, 12.2 + (k % 2) * 0.6, 0.15, 5);
    // Los sobres de semillas colgados del travesaño.
    s.box(2, 14.2, 26, 28.4, 1, 1.2, flatT(at(DARK, 4)), flatT(at(DARK, 3)), null);
    for (let i = 0; i < 4; i++) s.box(6 + i * 6, 14.6, 21.6, 3, 0.4, 4, null, (u, v) => (v > 1.2 && v < 2.8 && u > 0.8 && u < 2.2 ? at(i % 2 ? PAPA : C.leaf, 3) : at(C.cream, v > 3.4 ? 2 : 4)), null);
  } else if (lo === "arepas") {
    // El budare negro con las arepas de choclo doraditas y un platón con más.
    s.cylinder(10, 11, 12, 4.4, 1.2, (_a, _v, luz) => at(C.navy, 1.5 + luz));
    s.disc(10, 11, 13.2, 4.4, () => at(C.navy, 1));
    for (const [dx, dy] of [[-2, -1], [1.6, -1.4], [0, 1.6], [-2.4, 1.8]] as const) s.disc(10 + dx, 11 + dy, 13.6, 1.5, (x, y) => at(MAIZ, 3.4 - (x + y) * 0.3 + (x * x + y * y < 0.5 ? 0.8 : 0)));
    s.cylinder(22, 11, 12, 3.6, 1, (_a, _v, luz) => at(C.cream, 3 + luz));
    for (let k = 0; k < 4; k++) s.disc(22, 11, 13.2 + k * 0.6, 2.4, (x, y) => at(MAIZ, 3 - (x + y) * 0.25));
    // El humito del budare.
    for (let z = 15; z < 22; z += 0.8) s.plot(10 + Math.sin(z) * 0.6, 11, z, at(C.white, 4));
  } else {
    ahuyama(s, 7, 10.5, 12, 2.6);
    ahuyama(s, 12.5, 11, 12, 2);
    canasto(s, 20, 11, 2.6, 3, "papas", 7);
    canasto(s, 26, 11, 2.2, 2.6, "mazorcas", 8);
  }
  // El toldo a rayas, de atrás (alto) hacia adelante (más bajo), con el borde de ondas.
  const banda = (u: number) => (Math.floor(u / 3.8) % 2 ? RAYA : toldo);
  s.quad([1, 1, 37.4], [1, 0, 0], [0, 1, -0.38], 30.4, 15.4, (u) => at(banda(u), 3));
  for (let x = 1; x < 31.4; x += 0.4) {
    const drop = 1.2 + Math.abs(Math.sin((x / 3.8) * Math.PI)) * 1.4;
    for (let z = 0; z < drop; z += 0.4) s.plot(x, 16.4, 31.6 - z, at(banda(x - 1), 2));
  }
  return s.sprite();
}

// ---------- La olla del sancocho ----------

/** El fuego del fogón: lenguas que suben entre los leños (de noche más vivas). */
function fuego(s: Escena, cx: number, cy: number, z: number, night: boolean) {
  for (let i = 0; i < (night ? 70 : 40); i++) {
    const a = noise(i, 1, 4) * Math.PI * 2;
    const r = noise(i, 2, 4) * 5;
    const h = (1 - r / 5) * (night ? 5 : 3.4) * noise(i, 3, 4);
    s.plot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + h, at(C.fire, 1 + (h / 5) * 3 + (night ? 0.6 : 0)));
  }
}

/**
 * La olla grande de aluminio tiznado sobre tres piedras y los leños, con el cucharón de palo y el vapor;
 * el sancocho se ve adentro (papa, mazorca, yuca, cilantro). De noche el fuego alumbra.
 */
function olla(night: boolean): Sprite {
  const s = scene(2, 2, 46, 8);
  const cx = 16;
  const cy = 16;
  s.roundShadow(cx, cy + 1, 13, 0.28);
  // Las piedras del fogón (de tierra quemada) y los leños que salen hacia afuera, con el fuego en la boca.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.2;
    ball(s, cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5, 2.2, 2.6, C.terracotta, 2.2, 1.8);
  }
  for (const ang of [0.6, 1.5, 2.4]) for (let t = 5; t < 15; t += 0.4) for (const w of [-0.6, 0, 0.6]) s.plot(cx + Math.cos(ang) * t - Math.sin(ang) * w, cy + Math.sin(ang) * t + Math.cos(ang) * w, 1.2 + w * 0.3, at(C.logs, 2.4 + (t > 13 ? 1.2 : 0) + w));
  fuego(s, cx + 3, cy + 6, 1.5, night);
  fuego(s, cx + 6, cy + 2, 1.5, night);
  // La olla: negra de hollín abajo, aluminio arriba, con el borde y las dos asas.
  const r = 7.6;
  s.cylinder(cx, cy, 5, r, 14, (_a, v, luz) => (v < 4 ? at(C.navy, 1 + luz * 0.6) : at(C.metal, 3 + luz * 1.2 + (v > 13 ? 1 : 0))));
  s.disc(cx, cy, 19, r, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d > r - 0.8) return at(C.metal, 5);
    // El caldo dorado con lo que flota.
    const k = noise(Math.round(dx * 1.5), Math.round(dy * 1.5), 11);
    return k < 0.12 ? at(C.leaf, 3) : k < 0.24 ? at(MAIZ, 4) : k < 0.34 ? at(C.cream, 4) : k < 0.42 ? at(PAPA, 4) : at(MAIZ, 2.4 + (dx + dy) * -0.05);
  });
  for (const side of [-1, 1]) for (let t = -1.5; t <= 1.5; t += 0.3) s.plot(cx + side * (r + 0.8), cy + t, 17 + Math.cos(t) * 1.2, at(C.metal, 2));
  // El cucharón de palo recostado.
  for (let t = 0; t < 16; t += 0.4) s.plot(cx + 3 + t * 0.35, cy - 2 - t * 0.15, 18.5 + t * 0.9, at(WOOD, 3));
  // El vapor: tres volutas que suben y se abren.
  for (let k = 0; k < 3; k++)
    for (let z = 0; z < 12; z += 0.5) {
      const w = 0.6 + z * 0.12;
      for (let d = -w; d <= w; d += 0.5) s.plot(cx - 3 + k * 3 + Math.sin(z * 0.6 + k) * 1.2 + d, cy - 1, 21 + z + k, alpha(at(C.white, 4), 0.55 - z * 0.035));
    }
  return s.sprite();
}

// ---------- El concurso de la ahuyama ----------

/** La báscula de plataforma: el plato de tablas, la columna y el reloj del peso; encima, una ahuyama. */
function bascula(): Sprite {
  const s = scene(2, 1, 44);
  s.shadow(2, 3, 28, 11, 0.24);
  s.box(3, 3, 0, 20, 10, 3, (u, v) => at(WOOD, 4 - (Math.floor(u / 3) % 2) * 0.6 - (noise(Math.floor(u), Math.floor(v), 2) < 0.12 ? 1 : 0)), flatT(at(WOOD, 2)), flatT(at(WOOD, 1)));
  ahuyama(s, 12, 8, 3, 4.2);
  // La columna con el reloj (la aguja marca harto peso).
  s.solid(25, 6, 0, 2.4, 2.4, 26, at(C.terracotta, 4), at(C.terracotta, 3), at(C.terracotta, 2));
  s.box(23.6, 8.5, 26, 5.2, 0.6, 5.2, null, (u, v) => {
    const dx = u - 2.6;
    const dz = v - 2.6;
    const d = Math.hypot(dx, dz);
    if (d > 2.6) return null;
    if (d > 2.1) return at(C.gold, 3);
    // La aguja: del centro hacia arriba a la derecha.
    if (Math.abs(dx * 0.8 - dz * 0.6) < 0.35 && dx > 0) return at(C.rug, 2);
    return at(C.cream, 5);
  }, null);
  // La cinta azul del concurso amarrada a la columna.
  for (let z = 16; z < 20; z += 0.4) s.plot(25 + (z - 16) * 0.2, 8.6, z, at(C.blue, 3));
  for (let t = 0; t < 3; t += 0.4) {
    s.plot(25.5 - t * 0.3, 8.7, 16 - t, at(C.blue, 2));
    s.plot(26.2 + t * 0.2, 8.7, 16 - t, at(C.blue, 2));
  }
  return s.sprite();
}

/** El tablero del concurso: la pizarra de madera en su caballete, con tres renglones de colores y la cinta. */
function tablero(): Sprite {
  const s = scene(1, 1, 40);
  s.roundShadow(8, 9, 5, 0.24);
  for (const x of [3, 12]) s.solid(x, 9, 0, 1.2, 1.2, 30, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  s.box(1.5, 10.2, 12, 13, 1, 17, flatT(at(WOOD, 4)), (u, v) => {
    if (u < 1 || u > 12 || v < 1 || v > 16) return at(WOOD, 2);
    // Tres renglones: el oro, la plata y el bronce, cada uno con su ahuyamita y su peso de tiza.
    const fila = Math.floor((16 - v) / 4.6);
    const yv = (16 - v) % 4.6;
    if (fila > 2 || yv < 1 || yv > 3.6) return at(C.green, 1);
    if (u < 3.6) return at([C.gold, C.white, C.terracotta][fila]!, 3);
    if (u > 5 && u < 7) return at(AHUYAMA, 3);
    return u > 8 && Math.round(u * 2) % 2 ? at(C.cream, 4) : at(C.green, 1);
  }, null);
  // El copete de la cinta azul.
  for (let a = 0; a < Math.PI * 2; a += 0.3) s.plot(8 + Math.cos(a) * 1.6, 11.4, 31 + Math.sin(a) * 1.6, at(C.blue, 3 + Math.sin(a)));
  return s.sprite();
}

// ---------- La tómbola de la junta ----------

/** La mesa con el mantel, la ruleta de colores parada en su soporte y la urna de boletas. */
function tombola(): Sprite {
  const s = scene(2, 1, 46);
  s.shadow(1, 2, 30, 12, 0.24);
  for (const [x, y] of [[3, 4], [28, 4], [3, 12], [28, 12]] as const) s.solid(x, y, 0, 1.4, 1.4, 11, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
  // El mantel verde de la junta con el fleco.
  s.box(2, 3, 11, 28, 11, 1.4, flatT(at(C.green, 3)), (u, v) => at(C.green, v < 0.8 && Math.round(u * 2) % 2 ? 1 : 2), flatT(at(C.green, 1)));
  // La ruleta: el disco de gajos de colores mirando a +y, con el clavito y la flecha arriba.
  const cx = 10;
  const cz = 23;
  const R = 7;
  s.solid(cx - 0.6, 8, 12.4, 1.2, 1.2, 4, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  const gajos = [TOLDOS.rojo!, TOLDOS.amarillo!, TOLDOS.verde!, TOLDOS.azul!, TOLDOS.naranja!, C.cream];
  s.quad([cx - R, 8.6, cz - R], [1, 0, 0], [0, 0, 1], R * 2, R * 2, (u, v) => {
    const dx = u - R;
    const dz = v - R;
    const d = Math.hypot(dx, dz);
    if (d > R) return null;
    if (d > R - 0.8) return at(C.gold, 3);
    if (d < 0.9) return at(C.gold, 4);
    const k = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 12) % gajos.length;
    return at(gajos[k]!, 3 + (dz > 0 ? 0.4 : -0.2));
  });
  for (let t = 0; t < 2.4; t += 0.3) s.plot(cx, 8.8, cz + R + 1.6 - t, at(C.rug, 2));
  // La urna de vidrio con las boletas.
  s.box(19, 6, 12.4, 7, 6, 7, (u, v) => at(C.sky, 4), (u, v) => (noise(Math.round(u * 2), Math.round(v * 2), 3) < 0.35 ? at(C.cream, 4) : at(C.sky, 3)), (u, v) => (noise(Math.round(u * 2), Math.round(v * 2), 4) < 0.3 ? at(TOLDOS.rojo!, 4) : at(C.sky, 2)));
  return s.sprite();
}

// ---------- Adornos ----------

/** Bulto de fique lleno de papa, con la boca abierta y unas papitas encima. */
function bultoPapa(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(8, 9, 5, 0.26);
  for (let z = 0; z < 12; z += 0.4) {
    const r = 4.6 - Math.abs(z - 5) * 0.15 - (z > 10 ? (z - 10) * 0.8 : 0);
    for (let a = -Math.PI / 4 - 0.3; a < (3 * Math.PI) / 4 + 0.3; a += 0.12) {
      const luz = Math.sin(a) * 0.85 - Math.cos(a) * 0.35;
      s.plot(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, z, at(FIQUE, 2.5 + luz + ((Math.round(a * 8) + Math.round(z * 2)) % 2 ? 0.3 : -0.2)));
    }
  }
  papitas(s, 5.5, 5.5, 10.6, 5, 5, 7, 5);
  return s.sprite();
}

/** Canasto de la cosecha: mimbre con mazorcas y ahuyamas. */
function canastoLleno(): Sprite {
  const s = scene(1, 1, 22);
  canasto(s, 8, 8, 5, 6, "ahuyamas", 2);
  mazorca(s, 4, 9, 6, 0.4, 4);
  return s.sprite();
}

/** El canasto de mimbre que se lleva a la oficina (con su asa) lleno de papas y mazorcas. */
function canastoMimbre(): Sprite {
  const s = scene(1, 1, 24);
  canasto(s, 8, 8, 4.6, 5.4, "papas", 9);
  mazorca(s, 6, 8, 5.4, 0.9, 4);
  for (let a = 0; a <= Math.PI; a += 0.06) s.plot(8 + Math.cos(a) * 4.4, 8, 6 + Math.sin(a) * 6, at(MIMBRE, 3 + Math.sin(a)));
  return s.sprite();
}

/** Poste alto con guirnaldas de mazorcas que caen en arcos hacia los lados. */
function posteMazorcas(): Sprite {
  const s = scene(1, 1, 56, 10);
  s.roundShadow(8, 8.5, 3, 0.26);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 50, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  ahuyama(s, 8, 8, 50, 1.8);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    for (let t = 0; t <= 1; t += 0.025) {
      const x = 8 + Math.cos(a) * 9 * t;
      const y = 8 + Math.sin(a) * 9 * t;
      const z = 48 - t * 15 - Math.sin(t * Math.PI) * 3;
      s.plot(x, y, z, at(FIQUE, 2));
      if (t > 0.2 && Math.round(t * 40) % 10 === 5) mazorcaColgada(s, x, y, z - 0.3);
    }
  }
  return s.sprite();
}

/** Arco de mazorcas sobre el camino (5 tiles a lo largo de x; se pasa por los tres del medio). */
function arcoMazorcas(): Sprite {
  const s = scene(5, 1, 70, 8);
  const yc = 8;
  for (const xc of [8, 72]) {
    s.roundShadow(xc, yc + 1, 4, 0.26);
    s.solid(xc - 1.6, yc - 1.6, 0, 3.2, 3.2, 40, at(DARK, 4), at(DARK, 3), at(DARK, 2));
    // Al pie, ahuyamas y un bulto.
    ahuyama(s, xc + (xc < 40 ? 3 : -3), yc + 3, 0, 2.4);
    // Las mazorcas amarradas por el paral.
    for (let z = 4; z < 38; z += 4.5) mazorcaColgada(s, xc + 1.8, yc + 1.8, z + 3);
  }
  for (let t = 0; t <= 1; t += 0.008) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 16;
    for (let k = 0; k < 4; k++) {
      const a = noise(Math.round(t * 999), k, 3) * Math.PI * 2;
      const r = 2.2 * Math.sqrt(noise(Math.round(t * 999), k, 4));
      s.plot(x, yc + Math.cos(a) * r, z + Math.sin(a) * r, at(CAPACHO, 2 + (Math.sin(a) > 0 ? 2 : 1)));
    }
  }
  for (let t = 0.04; t <= 0.96; t += 0.055) {
    const x = 8 + t * 64;
    const z = 39 + Math.sin(t * Math.PI) * 16;
    mazorcaColgada(s, x, yc + 2.2, z - 0.5);
  }
  return s.sprite();
}

/** La carreta del premio: cajón de tablas sobre dos ruedas de radios, cargada de ahuyamas y mazorcas. */
function carreta(): Sprite {
  const s = scene(2, 1, 30);
  s.shadow(1, 2, 30, 12, 0.24);
  // Las varas de tiro hacia +x y el cajón.
  for (const y of [4, 11]) s.solid(26, y, 5, 6, 1, 1, at(WOOD, 4), at(WOOD, 3), at(WOOD, 2));
  s.box(3, 3, 5, 23, 10, 6, flatT(at(WOOD, 2)), (u, v) => at(WOOD, 3.4 - (Math.floor(v / 2) % 2) * 0.6), (u, v) => at(WOOD, 2.6 - (Math.floor(v / 2) % 2) * 0.5));
  // Las ruedas (al frente, una sola se ve entera).
  s.quad([10, 13.4, 0], [1, 0, 0], [0, 0, 1], 9, 9, (u, v) => {
    const d = Math.hypot(u - 4.5, v - 4.5);
    if (d > 4.5) return null;
    if (d > 3.7) return at(DARK, 2);
    const a = Math.atan2(v - 4.5, u - 4.5);
    return Math.abs(Math.sin(a * 3)) < 0.18 || d < 1 ? at(DARK, 3) : null;
  });
  ahuyama(s, 8, 8, 11, 3.2);
  ahuyama(s, 15, 7, 11, 2.6);
  ahuyama(s, 20.5, 9, 11, 2.2);
  mazorca(s, 11, 10, 11.5, 0.2, 5);
  mazorca(s, 17, 11, 11.2, -0.3, 5);
  return s.sprite();
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const COSECHA_DRAW: Record<string, () => Sprite> = {
  "puesto-cosecha-rojo": () => puesto("rojo"),
  "puesto-cosecha-amarillo": () => puesto("amarillo"),
  "puesto-cosecha-verde": () => puesto("verde"),
  "puesto-cosecha-naranja": () => puesto("naranja"),
  "puesto-cosecha-azul": () => puesto("azul"),
  bascula,
  "tablero-cosecha": tablero,
  tombola,
  "bulto-papa": bultoPapa,
  "canasto-lleno": canastoLleno,
  "poste-mazorcas": posteMazorcas,
  "arco-mazorcas": arcoMazorcas,
  "canasto-mimbre": canastoMimbre,
  "carreta-cosecha": carreta,
};

/** Lo que se prende de noche (va en OUTDOOR de outdoor.ts): el fogón de la olla. */
export const COSECHA_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "olla-sancocho": olla,
};

// ---------- La Pinta, la mula de Don Ramiro ----------

/** Vista de la mula: de lado (mirando a la derecha; a la izquierda se voltea), de frente o de espaldas. */
export type MulaView = "side" | "front" | "back";

const MULA: Record<string, RGBA> = {
  p: hex("#8a5a3a"),
  P: hex("#6a4028"),
  q: hex("#a87a52"),
  m: hex("#3a2414"),
  h: hex("#2a1a10"),
  c: hex("#c8a060"),
  C: hex("#8a6a38"),
  n: hex("#e8c24a"),
  a: hex("#e8862a"),
  r: hex("#c03a3a"),
  w: hex("#f7ebc8"),
};

/**
 * La Pinta con sus dos canastos (uno a cada lado, con papas y una ahuyama), de 24x20. `frame` 0 o 1: el
 * paso (las patas se cruzan). Pixel a mano: no es una mascota de la casa.
 */
export function drawMula(view: MulaView, frame = 0): PixelCanvas {
  const rows =
    view === "side"
      ? [
          "..................hh....",
          ".................hpph...",
          "................hpppph..",
          ".....n.a.......mpppqwph.",
          "....cnnaac.....mpppppph.",
          "...cCnnaaCc...mppppppmh.",
          "...cCccccCc.mmpppppm....",
          "..mmcCccCcmmpppppppm....",
          ".mpppcccccppppppppm.....",
          "mpqppprrrpppppppppm.....",
          "mpppppprppppppppppm.....",
          "mppppppppppppppPPm......",
          ".mpPPpppppppPPPPm.......",
          "..mPPmmmmmmmmPPm........",
          "..mPm.......mPm.........",
          "..mPm.......mPm.........",
          "..mPm.......mPm.........",
          "..mhm.......mhm.........",
        ]
      : view === "front"
        ? [
            "......hh....hh..........",
            ".....hpph..hpph.........",
            "......hppmmpph..........",
            "......mppppppm..........",
            ".cc..mpwppppwpm..cc.....",
            "cnaccmppppppppmccnac....",
            "cCnaCcmppqqppmcCnaCc....",
            "cCccCc.mpqqpm.cCccCc....",
            ".cCCc.mppppppm.cCCc.....",
            "......mprrrrpm..........",
            "......mppppppm..........",
            "......mPpppPPm..........",
            "......mPm..mPm..........",
            "......mPm..mPm..........",
            "......mhm..mhm..........",
          ]
        : [
            "......hh....hh..........",
            ".....hpph..hpph.........",
            "......hppppph...........",
            ".cc...mppppppm...cc.....",
            "cnaccmppppppppmccnac....",
            "cCnaCcmprrrrpmcCnaCc....",
            "cCccCc.mppppm.cCccCc....",
            ".cCCc.mppppppm.cCCc.....",
            "......mppppppm..........",
            "......mpphhppm..........",
            "......mPpppPPm..........",
            "......mPm..mPm..........",
            "......mPm..mPm..........",
            "......mhm..mhm..........",
          ];
  const w = 24;
  const h = rows.length;
  const c = new PixelCanvas(w, h + 1);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === ".") continue;
      // El paso: en el cuadro 1 las patas de atrás y de adelante se corren un píxel.
      const legs = view === "side" && y >= 14 && frame === 1;
      const xx = legs ? x + (x < 8 ? 1 : -1) : x;
      c.set(xx, y, ch === "m" || ch === "h" ? OUT : MULA[ch]!);
    }
  });
  return c;
}
