// El Año viejo por código (VIR-170): el brasero de piedra (y su fuego, que la escena pone encima en la
// quema), la silla del muñeco y el muñeco de año viejo en sus cinco etapas (la capa que la escena pone sobre
// la silla), el cartel de los testamentos, el puesto de uvas y maletas, las guirnaldas doradas, el farol de
// papel amarillo, el letrerito de las paradas de la maleta y el costal de aserrín. Coordenadas locales de
// arte (tile = 16); lo de enfrente mira a +y. Cálido y de fin de año: madera, piedra, amarillo y dorado.
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { PixelCanvas, at, hex, noise, ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;
const WOOD = C.wood;
const DARK = C.woodDark;
/** El amarillo del año nuevo (toldo, faroles, guirnaldas). */
const AMARILLO = ramp("#6a4a0a", "#b8861a", "#e0aa22", "#f7c830", "#ffe070", "#fff6c0");
const BURLAP = ramp("#5a4428", "#7a5e38", "#9a7a48", "#b8945a", "#d0ae72", "#e4c890");
const JEAN = ramp("#1a2440", "#26365e", "#34507a", "#4a6a98", "#6a8ab8");
const CUADROS = ramp("#3a1410", "#6a2018", "#a0302a", "#c0473a", "#e0704e");
const CARA = ramp("#8a5a3a", "#b8805a", "#d8a47a", "#f2d6b0", "#fff0d8");
const UVA = ramp("#2a0a32", "#4a1a5a", "#6a2a7a", "#8a4a9a", "#b07ac8", "#d8b0e8");

// ---------- El brasero ----------

/** Brasero redondo de piedras con su cama de ceniza y brasas (de noche, las brasas brillan más). */
function brasero(night: boolean): Sprite {
  const s = scene(2, 2, 26);
  s.roundShadow(16, 16, 13, 0.26);
  s.cylinder(16, 16, 0, 12, 7, (a, v, luz) => {
    const row = Math.floor(v / 2.4);
    const seg = (a + 4) * 3.2 + (row % 2) * 0.5;
    const mortar = v % 2.4 < 0.45 || seg % 1 < 0.1;
    return at(C.stone, 2.8 + luz * 1.1 + (noise(Math.floor(seg), row, 9) - 0.5) * 1.3 - (mortar ? 1.4 : 0));
  });
  s.disc(16, 16, 7, 12, (dx, dy) => {
    const r = Math.hypot(dx, dy);
    if (r > 9.6) return at(C.stone, 3.6 + (noise(Math.floor(dx), Math.floor(dy), 4) - 0.5) * 1.2);
    const n = noise(Math.floor(dx * 1.4), Math.floor(dy * 1.4), 7);
    if (n > (night ? 0.62 : 0.78)) return at(C.fire, night ? 3 + (n > 0.85 ? 1 : 0) : 1.5);
    return at(C.stone, n < 0.3 ? 0 : 1);
  });
  return s.sprite();
}

/**
 * El fuego del brasero (la capa de la quema), cuadro `frame` (0..3): lenguas de fuego que salen del centro,
 * amarillas abajo y rojas en la punta, que cambian de alto en cada cuadro. Con el muñeco, más altas y con su
 * silueta oscura adentro. Se pinta de frente (2D) sobre el lienzo de una escena del tamaño del brasero, así
 * el origen es el mismo y cae justo encima.
 */
export function fuegoBrasero(frame: number, conMuneco: boolean): Sprite {
  const s = scene(2, 2, 80);
  const c = s.canvas;
  const base = s.p(16, 16, 7.5);
  const bx = Math.round(base.x);
  const by = Math.round(base.y);
  const alto = conMuneco ? 40 : 20;
  if (conMuneco) {
    // La silueta del muñeco que se quema: piernas, cuerpo, brazos abiertos y la cabeza con el sombrero.
    const SIL = hex("#2a1a14");
    const rect = (x: number, y: number, w: number, h: number) => {
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) c.set(bx + x + xx, by - y - yy, SIL);
    };
    rect(-4, 0, 3, 10);
    rect(1, 0, 3, 10);
    rect(-5, 10, 10, 11);
    rect(-9, 15, 4, 3);
    rect(5, 15, 4, 3);
    rect(-3, 21, 6, 5);
    rect(-5, 26, 10, 1);
    rect(-2, 27, 4, 2);
  }
  const lenguas = conMuneco ? 9 : 6;
  for (let j = 0; j < lenguas; j++) {
    const dx = Math.round((j - (lenguas - 1) / 2) * (conMuneco ? 2.3 : 2.1));
    const h = alto * (0.55 + 0.45 * noise(j, frame, 13)) * (1 - Math.abs(dx) / (lenguas * 2.2));
    const w = 2.2 + noise(j, frame, 17) * 1.6;
    const lean = (noise(j, frame, 19) - 0.5) * 3;
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const half = w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.7) * (1 - t * 0.5);
      const cx = bx + dx + lean * t * t;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const edge = Math.abs(x - cx) / Math.max(0.6, half);
        const k = t * 0.75 + edge * 0.35;
        const col = k < 0.3 ? at(C.fire, 4) : k < 0.55 ? at(C.fire, 3) : k < 0.8 ? at(C.fire, 2) : at(C.fire, 1);
        // Lo de adelante tapa la silueta abajo; arriba, la silueta se ve entre las lenguas.
        if (conMuneco && t > 0.45 && edge < 0.5 && (x + y + frame) % 3 === 0) continue;
        c.set(x, by - y, col);
      }
    }
  }
  // Chispitas que suben.
  for (let i = 0; i < 8; i++) c.set(bx + Math.round((noise(i, 5, frame) - 0.5) * 18), by - alto - 2 - Math.round(noise(i, 6, frame) * 14), at(C.fire, 4));
  return s.sprite();
}

// ---------- La silla y el muñeco ----------

/** La silla de madera rústica (mira a +y: el espaldar va atrás, hacia -y). */
function silla(s: Escena) {
  s.roundShadow(8, 9, 6, 0.24);
  for (const [x, y] of [[3, 4], [11.4, 4], [3, 12.4], [11.4, 12.4]] as const) s.solid(x, y, 0, 1.6, 1.6, 8, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
  s.box(2.6, 3.6, 8, 11, 10.5, 1.6, (u, v) => at(WOOD, 4 - (Math.floor(v / 2.6) % 2) * 0.6), flatT(at(WOOD, 2)), flatT(at(WOOD, 1)));
  for (const x of [3, 11.4]) s.solid(x, 3.4, 9.6, 1.6, 1.4, 16, at(WOOD, 3), at(WOOD, 2), at(WOOD, 1));
  for (const z of [17, 22]) s.box(3, 3.5, z, 10, 1.2, 2.4, flatT(at(WOOD, 4)), flatT(at(WOOD, 3)), flatT(at(WOOD, 2)));
}

function sillaMuneco(): Sprite {
  const s = scene(1, 1, 40);
  silla(s);
  return s.sprite();
}

/** Cuántas etapas tiene el muñeco (0: un costal en la silla; 4: listo para la quema). */
export const MUNECO_ETAPAS = 5;

/**
 * El muñeco de año viejo sentado en su silla, en la etapa `etapa` (0..4): el costal; el pantalón relleno con
 * las piernas colgando; la camisa a cuadros con los brazos; la cara con bigote y el sombrero; y la bufanda
 * amarilla con la flor en el sombrero. Mismo origen que la silla (se pone encima de ella).
 */
export function munecoEnSilla(etapa: number): Sprite {
  const e = Math.max(0, Math.min(MUNECO_ETAPAS - 1, Math.round(etapa)));
  const s = scene(1, 1, 44);
  silla(s);
  const burlap: Tinte = (u, v) => at(BURLAP, 3 + (noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 3) - 0.5) * 1.4);
  if (e === 0) {
    s.box(4.4, 5, 9.6, 7.6, 6.4, 7, burlap, burlap, (u, v) => at(BURLAP, 2 + (noise(Math.floor(u), Math.floor(v), 5) - 0.5)));
    for (let k = 0; k < 6; k++) s.plot(7 + k * 0.4, 8, 17 + (k % 2), at(BURLAP, 1));
    return s.sprite();
  }
  // El pantalón: los muslos sobre el asiento, las piernas que cuelgan y los zapatos.
  const jean: Tinte = (u, v) => at(JEAN, 3 + (noise(Math.floor(u), Math.floor(v), 8) < 0.12 ? -1 : 0));
  s.box(4.2, 5, 9.6, 7.6, 7.6, 3.2, jean, jean, flatT(at(JEAN, 2)));
  for (const x of [4.4, 8.6]) {
    s.box(x, 12.4, 1.6, 3, 3, 9, jean, jean, flatT(at(JEAN, 2)));
    s.solid(x - 0.2, 12.6, 0, 3.4, 4.2, 1.8, at(DARK, 2), at(DARK, 1), at(DARK, 0));
    // La paja que se sale por el ruedo.
    for (let k = 0; k < 4; k++) s.plot(x + 0.4 + k * 0.7, 15.6, 1.8 + (k % 2) * 0.4, at(AMARILLO, 3));
  }
  if (e === 1) {
    s.box(4.6, 5.4, 12.8, 7, 5.6, 6.4, burlap, burlap, flatT(at(BURLAP, 2)));
    return s.sprite();
  }
  // La camisa a cuadros y los brazos.
  const cuadros: Tinte = (u, v) => (Math.floor(u / 1.6) % 2 === 0 || Math.floor(v / 1.6) % 2 === 0 ? at(CUADROS, Math.floor(u / 1.6) % 2 === 0 && Math.floor(v / 1.6) % 2 === 0 ? 1 : 3) : at(C.cream, 3));
  s.box(4.4, 5.4, 12.8, 7.4, 5.8, 9, cuadros, cuadros, cuadros);
  for (const x of [2.6, 11.8]) {
    s.box(x, 7, 13.6, 1.8, 2.6, 7.6, cuadros, cuadros, cuadros);
    s.solid(x, 7.6, 12.6, 1.8, 3.6, 1.4, at(CARA, 3), at(CARA, 2), at(CARA, 1));
  }
  // Un parche en el codo.
  s.box(11.8, 8.4, 16, 0.2, 1.4, 1.6, null, null, flatT(at(JEAN, 3)));
  if (e === 2) {
    s.box(5.6, 6.4, 21.8, 5, 4, 4.4, burlap, burlap, flatT(at(BURLAP, 2)));
    return s.sprite();
  }
  // La cara de cartón (mira a +y) con ojos, bigote y cachetes, y el sombrero.
  s.box(5.4, 6.2, 21.8, 5.4, 4.6, 5.6, flatT(at(CARA, 4)), (u, v) => {
    if ((Math.abs(u - 1.6) < 0.5 || Math.abs(u - 3.8) < 0.5) && Math.abs(v - 3.6) < 0.5) return hex("#2a2232");
    if (v > 1.4 && v < 2.2 && u > 1.2 && u < 4.2) return hex("#3a2418");
    if (v > 2.2 && v < 3 && (u < 1.2 || u > 4.2)) return hex("#e0807a");
    return at(CARA, 3);
  }, flatT(at(CARA, 2)));
  const ala = e >= 4 ? AMARILLO : WOOD;
  s.disc(8.1, 8.5, 27.6, 5, (dx, dy) => at(ala, 3 + (dx + dy < 0 ? 1 : 0) - (Math.hypot(dx, dy) > 4.3 ? 1 : 0)));
  s.cylinder(8.1, 8.5, 27.6, 2.8, 3.6, (_a, _v, luz) => at(ala, 2.6 + luz));
  s.disc(8.1, 8.5, 31.2, 2.8, () => at(ala, 4));
  s.cylinder(8.1, 8.5, 27.8, 2.9, 0.8, () => at(CUADROS, 2));
  if (e >= 4) {
    // La bufanda amarilla, la flor del sombrero y las gafas.
    s.box(5, 6, 21, 6.2, 5.2, 1.4, flatT(at(AMARILLO, 4)), flatT(at(AMARILLO, 3)), flatT(at(AMARILLO, 2)));
    s.box(9.4, 10.8, 15.6, 1.6, 0.6, 5.4, null, flatT(at(AMARILLO, 3)), null);
    for (let a = 0; a < Math.PI * 2; a += 0.5) s.plot(10.6 + Math.cos(a) * 0.9, 9.6, 29.4 + Math.sin(a) * 0.9, hex("#e8457a"));
    s.plot(10.6, 9.8, 29.4, at(AMARILLO, 5));
  }
  return s.sprite();
}

// ---------- El cartel de los testamentos ----------

/** Tablero de madera en dos postes con papelitos clavados y un techito (los testamentos los lee el panel). */
function cartel(): Sprite {
  const s = scene(2, 1, 46);
  s.shadow(2, 6, 28, 5, 0.22);
  for (const x of [3, 27.4]) s.solid(x, 7, 0, 1.6, 1.6, 34, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  s.box(2, 7.2, 12, 28, 1.4, 20, flatT(at(WOOD, 4)), (u, v) => at(WOOD, 3 - (Math.floor(v / 2.8) % 2) * 0.5 - (noise(Math.floor(u / 3), Math.floor(v), 2) < 0.12 ? 1 : 0)), flatT(at(WOOD, 2)));
  // El techito de tablas.
  s.box(1, 5.6, 33.4, 30, 4.4, 1.2, flatT(at(C.roof, 3)), flatT(at(C.roof, 2)), flatT(at(C.roof, 1)));
  // Los papelitos (cada uno un testamento), con rayitas de letra y su tachuela roja.
  const papeles = [
    [3.6, 23, 6, 7],
    [10.6, 24.6, 5.4, 6],
    [17, 23.4, 6, 7],
    [24, 24, 4.8, 6.4],
    [4.6, 14, 5.4, 7],
    [11.4, 15.2, 6.2, 6.4],
    [18.6, 14.4, 5, 7],
    [24.6, 14.8, 4.6, 6],
  ] as const;
  papeles.forEach(([x, z, w, h], i) => {
    s.quad([x, 8.75, z], [1, 0, 0], [0, 0, 1], w, h, (u, v) => {
      if (v > h - 1.2 && Math.abs(u - w / 2) < 0.5) return hex("#c0392b");
      if (u > 0.8 && u < w - 0.8 && v > 1 && v < h - 1.6 && v % 1.4 < 0.45) return at(C.stone, 2);
      return at(C.cream, i % 3 === 0 ? 4 : 5);
    });
  });
  return s.sprite();
}

// ---------- El puesto de uvas y maletas ----------

/** Un racimo de uvas sobre el mostrador. */
function racimo(s: Escena, x: number, y: number, z: number, seed: number) {
  for (let k = 0; k < 14; k++) {
    const row = Math.floor(k / 4);
    const a = noise(k, 1, seed) * Math.PI * 2;
    const r = (1.8 - row * 0.4) * Math.sqrt(noise(k, 2, seed));
    const cx = x + Math.cos(a) * r;
    const cy = y + Math.sin(a) * r;
    const cz = z + 3 - row * 1;
    for (let dz = -0.6; dz <= 0.6; dz += 0.3) for (let d = -0.6; d <= 0.6; d += 0.3) if (d * d + dz * dz < 0.4) s.plot(cx + d, cy + 0.6, cz + dz, at(UVA, 2.5 + (d < 0 && dz > 0 ? 2 : 0)));
  }
  for (let z2 = 0; z2 < 1.6; z2 += 0.4) s.plot(x, y, z + 4 + z2, at(DARK, 2));
}

/** Una maleta de cuero con sus correas (de pie, mirando a +y). */
function maleta(s: Escena, x: number, y: number, z: number, w: number, h: number) {
  s.box(x, y, z, w, 2.6, h, flatT(at(WOOD, 2)), (u) => (Math.abs(u - w * 0.3) < 0.4 || Math.abs(u - w * 0.7) < 0.4 ? at(AMARILLO, 3) : at(WOOD, 2)), flatT(at(WOOD, 1)));
  for (let u = w * 0.35; u < w * 0.65; u += 0.3) s.plot(x + u, y + 1.3, z + h + 1, at(DARK, 1));
}

function puestoUvas(): Sprite {
  const s = scene(2, 1, 50);
  s.shadow(1, 1, 30, 15, 0.22);
  for (const [x, y, h] of [[2, 2, 36], [29, 2, 36], [2, 14, 31], [29, 14, 31]] as const) s.solid(x, y, 0, 1.4, 1.4, h, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  s.box(3, 8, 0, 26, 6, 12, flatT(at(WOOD, 4)), (u, v) => at(WOOD, 3 - (Math.floor(u / 2.6) % 2) * 0.7 - (v > 10.5 ? -1 : 0)), flatT(at(WOOD, 1)));
  // Los racimos de uvas en una cesta y las bolsitas de lentejas.
  s.box(5, 9.2, 12, 10, 4, 1.6, flatT(at(BURLAP, 3)), flatT(at(BURLAP, 2)), flatT(at(BURLAP, 1)));
  [6.8, 10, 13.2].forEach((x, i) => racimo(s, x, 11.2, 12.2, 3 + i));
  for (const x of [17.4, 20.4]) {
    s.box(x, 10, 12, 2.4, 2.4, 2.6, flatT(at(C.cream, 4)), flatT(at(C.cream, 3)), flatT(at(C.cream, 2)));
    for (let k = 0; k < 4; k++) s.plot(x + 0.4 + k * 0.5, 11, 14.8, at(C.terracotta, 2 + (k % 2)));
  }
  // Las maletas apiladas al lado del mostrador.
  maleta(s, 23.6, 9.6, 12, 4.6, 4);
  maleta(s, 24.2, 9.8, 16, 3.6, 3.2);
  // El toldo amarillo a rayas, con el borde de ondas.
  s.quad([1, 1, 37.4], [1, 0, 0], [0, 1, -0.38], 30.4, 15.4, (u) => at(Math.floor(u / 3.8) % 2 ? C.cream : AMARILLO, 3));
  for (let x = 1; x < 31.4; x += 0.4) {
    const drop = 1.2 + Math.abs(Math.sin((x / 3.8) * Math.PI)) * 1.4;
    for (let z = 0; z < drop; z += 0.4) s.plot(x, 16.4, 31.6 - z, at(Math.floor((x - 1) / 3.8) % 2 ? C.cream : AMARILLO, 2));
  }
  return s.sprite();
}

// ---------- Guirnaldas, farol, parada de la maleta y costal ----------

/** Poste alto con guirnaldas de escarcha dorada y amarilla que caen en arcos y campanitas de papel. */
function guirnalda(): Sprite {
  const s = scene(1, 1, 56, 14);
  s.roundShadow(8, 8.5, 3, 0.26);
  s.solid(7.2, 7.2, 0, 1.6, 1.6, 50, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  // La estrella dorada de la punta.
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const r = 1 + (Math.round(a / 0.2) % 2 ? 0.8 : 2);
    s.plot(8 + Math.cos(a) * r * 0.7, 9.2, 52.5 + Math.sin(a) * r, at(C.gold, 4));
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    for (let t = 0; t <= 1; t += 0.015) {
      const x = 8 + Math.cos(a) * 12 * t;
      const y = 8 + Math.sin(a) * 12 * t;
      const z = 49 - t * 9 - Math.sin(t * Math.PI) * 3;
      // La escarcha: puntos dorados y amarillos que se alternan alrededor del cordel.
      const i = Math.round(t * 70);
      s.plot(x, y, z, at(i % 3 === 0 ? C.gold : AMARILLO, 3 + (i % 2)));
      s.plot(x + (noise(i, k, 2) - 0.5), y, z - 0.6, at(C.gold, 2 + (i % 3)));
      if (i % 14 === 7) for (let d = 0; d < 2.6; d += 0.4) for (let w = -0.4 - d * 0.4; w <= 0.4 + d * 0.4; w += 0.4) s.plot(x + w, y, z - 0.8 - d, at(AMARILLO, d > 2 ? 2 : 4));
    }
  }
  return s.sprite();
}

/** Farol de papel amarillo colgado de su poste (el farol hacia +x), prendido de noche. */
function farolAno(night: boolean): Sprite {
  const s = scene(1, 1, 46);
  s.roundShadow(4, 8.5, 2.6, 0.26);
  s.solid(3, 7.2, 0, 1.8, 1.8, 36, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  s.box(3, 7.4, 34.5, 10, 1.4, 1.4, flatT(at(DARK, 4)), flatT(at(DARK, 3)), flatT(at(DARK, 2)));
  for (let z = 30.6; z < 34.6; z += 0.4) s.plot(11.5, 8.1, z, at(DARK, 1));
  const glow = [hex("#ff9a2a"), hex("#ffc94a"), hex("#fff0a0")];
  for (let e = -Math.PI / 2; e <= Math.PI / 2; e += 0.09)
    for (let a = -Math.PI; a < Math.PI; a += 0.09) {
      const nx = Math.cos(a) * Math.cos(e);
      const ny = Math.sin(a) * Math.cos(e);
      const luz = ny * 0.5 - nx * 0.3 + Math.sin(e) * 0.7;
      const ring = Math.abs(((Math.sin(e) * 5 + 10) % 2) - 1) > 0.8;
      const c = night ? glow[ring ? 0 : luz > 0 ? 2 : 1]! : ring ? at(C.gold, 2) : at(AMARILLO, 3 + Math.round(luz));
      s.plot(11.5 + nx * 4, 8.1 + ny * 4, 25.4 + Math.sin(e) * 4.6, c);
    }
  for (let z = 17; z < 21; z += 0.5) s.plot(11.5, 8.6, z, at(C.gold, 3));
  return s.sprite();
}

/** El letrerito de una parada de la maleta: un poste con una tabla pintada con la maleta amarilla. */
function paradaMaleta(): Sprite {
  const s = scene(1, 1, 30);
  s.roundShadow(8, 9, 3, 0.24);
  s.solid(7.2, 7.6, 0, 1.6, 1.6, 22, at(DARK, 4), at(DARK, 3), at(DARK, 2));
  s.box(3, 9.2, 14, 10, 1, 8, flatT(at(WOOD, 4)), (u, v) => {
    // La maleta pintada: el cuerpo, la manija y una franja.
    if (u > 2.4 && u < 7.6 && v > 1.4 && v < 5) return Math.abs(u - 5) < 0.4 ? at(WOOD, 1) : at(AMARILLO, 3);
    if (u > 4 && u < 6 && v >= 5 && v < 6.2 && !(u > 4.5 && u < 5.5 && v < 5.8)) return at(AMARILLO, 3);
    return at(WOOD, 3);
  }, flatT(at(WOOD, 2)));
  // La cinta amarilla amarrada al poste.
  for (let z = 10; z < 13; z += 0.4) s.plot(8.6, 9.3, z, at(AMARILLO, 4));
  return s.sprite();
}

/** El costal de aserrín del taller, amarrado arriba, con un montoncito de aserrín al lado. */
function costalAserrin(): Sprite {
  const s = scene(1, 1, 22);
  s.roundShadow(7, 8, 5, 0.24);
  s.cylinder(7, 8, 0, 4.2, 9, (a, v, luz) => at(BURLAP, 2.6 + luz + (noise(Math.floor(a * 4), Math.floor(v), 3) - 0.5)));
  s.disc(7, 8, 9, 4.2, () => at(BURLAP, 4));
  s.cylinder(7, 8, 9, 1.8, 2.4, (_a, _v, luz) => at(BURLAP, 2 + luz));
  for (let k = 0; k < 40; k++) {
    const a = noise(k, 1, 6) * Math.PI * 2;
    const r = Math.sqrt(noise(k, 2, 6)) * 3;
    s.plot(12 + Math.cos(a) * r, 11 + Math.sin(a) * r, (3 - r) * 0.6, at(BURLAP, 4 + (k % 2)));
  }
  return s.sprite();
}

// ---------- Las luces de colores del cielo (sin pólvora) ----------

/** Los colores de las luces que suben en la quema y en el año nuevo. */
export const LUCES_COLORES = ["#ffd24a", "#ff7aa8", "#8ad0ff", "#9af07a", "#ffffff", "#c8a0ff"] as const;

/** Una lucecita redonda y suave (de 7x7) de un color: la escena las sube y las apaga despacio. */
export function luzDeColor(color: string): PixelCanvas {
  const c = new PixelCanvas(7, 7);
  const base = hex(color);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      const d = Math.hypot(x - 3, y - 3);
      if (d > 3.4) continue;
      const k = 1 - d / 3.4;
      const mix = (v: number) => Math.round(v + (255 - v) * Math.max(0, k - 0.5) * 1.6);
      c.set(x, y, [mix(base[0]), mix(base[1]), mix(base[2]), Math.round(255 * Math.min(1, k * 1.6))]);
    }
  return c;
}

/** Lo que no cambia de noche (va en DRAW de furniture.ts). */
export const ANO_VIEJO_DRAW: Record<string, () => Sprite> = {
  "silla-muneco": sillaMuneco,
  "cartel-testamentos": cartel,
  "puesto-uvas": puestoUvas,
  "guirnalda-ano": guirnalda,
  "parada-maleta": paradaMaleta,
  "costal-aserrin": costalAserrin,
};

/** Lo que se prende de noche (va en OUTDOOR de outdoor.ts). */
export const ANO_VIEJO_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "brasero-piedra": brasero,
  "farol-ano": farolAno,
};
