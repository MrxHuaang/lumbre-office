// El piso, las paredes y lo que cuelga en el garaje: concreto con manchas de aceite, bloque de cemento
// sin pintar, el tablero de herramientas, el portón enrollable por dentro, el calendario viejo, las
// telarañas y la ventana sucia. room.ts los llama. Unidades de arte (tile = 16); en las paredes `u` corre
// a lo largo del muro y `hv` es la altura.
import type { WallFeature } from "../world/types";
import { C, OUT, inRect, mix } from "./palette";
import { alpha, at, bayer, noise, ramp, smoothNoise, type Ramp, type RGBA } from "./pixel";

/** Cemento gris, un pelo cálido para que no se vea azul junto a la madera. */
export const CEMENT: Ramp = ramp("#34323a", "#4a4850", "#615e66", "#7a767c", "#938e92", "#aaa5a6", "#c4bfbd");
/** Óxido (el portón, la chapa del techo, los tambores). */
export const RUST: Ramp = ramp("#3a1b12", "#5e2c17", "#86401d", "#a95a27", "#c77a3a", "#dc9a58");
/** Chapa galvanizada, ya opaca. */
export const ZINC: Ramp = ramp("#343a46", "#4c5462", "#687180", "#88909c", "#a8afb8", "#c9ced4");
/** Aceite de motor: casi negro con un brillo tornasol. */
const OIL: Ramp = ramp("#15121a", "#211c26", "#2e2833", "#3b3440");

const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------- Piso ----------

/**
 * Concreto afinado a llana: manchas suaves de tono, polvo, juntas de dilatación cada dos tiles, alguna
 * grieta y los charcos secos de aceite (con su reflejo tornasol). Sirve adentro y en la entrada de afuera.
 */
export function concreteFloor(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  // Juntas de dilatación: rayas finas y oscuras, con el borde un poco desportillado.
  const jx = mod(X, 32);
  const jy = mod(Y, 32);
  if ((jx < 0.8 || jy < 0.8) && noise(Math.floor(X / 3), Math.floor(Y / 3), 7) > 0.08) return at(CEMENT, 2);
  // Grietas: una línea que ondula siguiendo el ruido.
  const crack = Math.abs(smoothNoise(X, Y, 9, 11) - 0.5);
  if (crack < 0.012 && smoothNoise(X, Y, 40, 12) > 0.62) return at(CEMENT, 1);
  // Manchas de aceite: bordes irregulares, el centro más oscuro y un destello tornasol.
  const oil = smoothNoise(X, Y, 12, 13) * 0.65 + smoothNoise(X, Y, 4, 14) * 0.35;
  if (oil > 0.74) {
    if (oil > 0.8 && noise(x, y, 15) > 0.99) return at(C.violet, 3);
    if (oil > 0.8 && noise(x, y, 16) > 0.99) return at(C.cyan, 2);
    return oil > 0.8 ? at(OIL, 3) : at(CEMENT, 1 + (bayer(x, y) < 0.5 ? 0 : 1));
  }
  if (oil > 0.69 && bayer(x, y) < (oil - 0.69) * 14) return at(CEMENT, 2);
  // Llana: vetas de tono y polvo claro.
  const t = smoothNoise(X, Y, 11, 17);
  const n = noise(x, y, 19);
  if (n > 0.975) return at(CEMENT, 5);
  if (n < 0.02) return at(CEMENT, 2);
  return at(CEMENT, t < 0.3 ? 3 : t > 0.75 && bayer(x, y) < 0.12 ? 5 : 4);
}

/**
 * Tablones anchos y gastados del taller: madera tibia, juntas, clavos, el claro de donde más se pisa y
 * alguna mancha vieja de aceite (pocas). También lo pueden elegir las oficinas.
 */
export function wornPlanksFloor(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const row = Math.floor(Y / 7);
  const v = mod(Y, 7);
  const off = Math.floor(noise(row, 3, 71) * 40);
  const seg = Math.floor((X + off) / 40);
  const along = mod(X + off, 40);
  if (v < 0.8 || along < 0.7) return at(C.woodDark, 1);
  // Clavos en las puntas.
  if ((along > 1.5 && along < 2.4) || (along > 37.6 && along < 38.5)) if ((v > 1.6 && v < 2.4) || (v > 4.6 && v < 5.4)) return at(C.woodDark, 0);
  const tone = noise(seg, row, 73);
  // Más oscuros que las tablas de la pared, para que la sala no se vuelva un solo café.
  let c = at(C.woodDark, tone < 0.3 ? 3 : tone < 0.8 ? 4 : 5);
  // Veta y algún nudo.
  const grain = Math.sin((X + off) * 0.21 + row * 1.7) * 1.3 + 3.5;
  if (Math.abs(v - grain) < 0.3 && noise(Math.floor((X + off) / 5), row, 75) < 0.5) c = at(C.woodDark, 3);
  if (noise(x, y, 77) > 0.985) c = at(C.woodDark, 2);
  // Gastado: donde más se pisa, la madera pierde el barniz y se aclara.
  if (smoothNoise(X, Y, 18, 79) > 0.68 && bayer(x, y) < 0.35) c = mix(c, at(C.wood, 4), 0.35);
  // Manchas viejas de aceite, pocas y chicas.
  const oil = smoothNoise(X, Y, 9, 81);
  if (oil > 0.86) c = mix(c, at(C.woodDark, 0), oil > 0.9 ? 0.5 : 0.3);
  return c;
}

/** Gravilla apisonada de la entrada del garaje: tierra tibia con piedritas y alguna brizna de pasto. */
export function gravelFloor(X: number, Y: number): RGBA {
  const x = Math.floor(X);
  const y = Math.floor(Y);
  const n = noise(x, y, 83);
  const pebble = noise(Math.floor(X / 1.5), Math.floor(Y / 1.5), 85);
  if (pebble > 0.86) return at(C.stone, n < 0.5 ? 3 : 4);
  if (pebble > 0.8) return at(C.stone, 2);
  if (n > 0.985) return at(C.grass, 3);
  const t = smoothNoise(X, Y, 10, 87);
  // Por donde pasan las ruedas la tierra está más apisonada y oscura.
  const worn = smoothNoise(X, Y, 6, 89) > 0.62;
  return mix(at(C.dirt, worn ? 2 : t < 0.35 ? 3 : 4), at(C.cream, 2), bayer(x, y) < 0.3 ? 0.22 : 0.1);
}

// ---------- Pared ----------

/**
 * Bloque de cemento sin pintar (16x8, en trabazón): junta de mortero, cada bloque con su tono, alguno
 * rajado, la humedad que sube desde el piso y chorreados de óxido bajo los clavos.
 */
export function cinderblockWall(u: number, hv: number): RGBA {
  if (hv < 0) return at(CEMENT, 1);
  // Arriba, una viga de madera vieja donde apoya el techo.
  if (hv >= 52) return at(C.woodDark, hv >= 55 ? 3 : hv < 53 ? 1 : 2);
  const row = Math.floor(hv / 8);
  const off = row % 2 ? 8 : 0;
  const bu = mod(u + off, 16);
  const bv = mod(hv, 8);
  const block = Math.floor((u + off) / 16);
  const damp = hv < 12 ? (12 - hv) / 12 : 0;
  // Junta de mortero, salida y con algún hueco.
  if (bu < 1 || bv < 1) {
    if (noise(Math.floor(u), row, 31) < 0.1) return at(CEMENT, 1);
    return at(CEMENT, damp > 0.3 ? 2 : 3);
  }
  const tone = noise(block, row, 33);
  let c = at(CEMENT, tone < 0.2 ? 2 : tone < 0.75 ? 3 : 4);
  // Textura porosa del bloque.
  const n = noise(Math.floor(u), Math.floor(hv), 35);
  if (n > 0.9) c = at(CEMENT, 2);
  else if (n < 0.06) c = at(CEMENT, 5);
  // Brillo en el canto de arriba de cada bloque.
  if (bv > 7) c = mix(c, at(CEMENT, 5), 0.35);
  // Un bloque rajado de vez en cuando (una diagonal quebrada).
  if (noise(block, row, 37) < 0.08 && Math.abs(bu - 3 - bv * 1.3 + (bv > 4 ? 2 : 0)) < 0.6) return at(CEMENT, 1);
  // Chorreado de óxido bajo un clavo.
  if (noise(block, row, 39) < 0.06 && Math.abs(bu - 8) < 0.9 && bv < 6) return bv > 5 ? at(C.metal, 1) : mix(c, at(RUST, 3), 0.5 - bv * 0.05);
  // Humedad que sube: un verde grisáceo tramado.
  if (damp > 0 && bayer(Math.floor(u), Math.floor(hv)) < damp * 0.9 + smoothNoise(u, hv, 6, 41) * 0.3) c = mix(c, at(C.sage, 0), 0.45);
  // Manchones de hollín y grasa a la altura de las manos.
  if (hv > 14 && hv < 34 && smoothNoise(u, hv, 10, 43) > 0.74) c = mix(c, at(CEMENT, 0), 0.3);
  return c;
}

/**
 * Tablas de madera horizontales sobre un zócalo de piedra, con la viga de arriba: la pared del taller, de
 * la misma familia que la casa. Alguna tabla más clara (de un arreglo) y otra más oscura.
 */
export function boardsWall(u: number, hv: number): RGBA {
  if (hv < 0) return at(C.stone, 1);
  if (hv >= 52) return at(C.woodDark, hv >= 55 ? 3 : hv < 53 ? 1 : 2);
  // Zócalo de piedras.
  if (hv < 10) {
    const row = Math.floor(hv / 5);
    const o = noise(row, 3, 91) * 9;
    const k = mod(u + o, 9);
    if (mod(hv, 5) < 0.8 || k < 0.8) return at(C.stone, 1);
    return at(C.stone, 2 + (noise(Math.floor((u + o) / 9), row, 93) < 0.3 ? 0 : 1));
  }
  if (hv < 11.5) return at(C.woodDark, 2);
  const row = Math.floor((hv - 11.5) / 5);
  const k = mod(hv - 11.5, 5);
  if (k < 0.7) return at(C.woodDark, 1);
  const shift = noise(row, 1, 95) * 48;
  if (mod(u + shift, 48) < 0.7) return at(C.woodDark, 2);
  const t = noise(Math.floor((u + shift) / 48), row, 97);
  const base = t > 0.93 ? 5 : t < 0.12 ? 2 : t < 0.55 ? 3 : 4;
  if (k < 1.5) return at(C.logs, Math.min(5, base + 1));
  return at(C.logs, k > 4.2 ? base - 1 : base);
}

// ---------- Cosas colgadas ----------

/** Tablero perforado de herramientas: masonite con huecos, siluetas pintadas y las herramientas (falta alguna). */
function pegboardAt(f: WallFeature, u: number, hv: number, u1: number): RGBA | null {
  if (!inRect(u, hv, 2, 16, u1 - 2, 48)) return null;
  // Marco de listón.
  if (u < 3.5 || u >= u1 - 3.5 || hv < 17.5 || hv >= 46.5) return at(C.woodDark, hv >= 46.5 || u < 3 ? 3 : 2);
  const x = u - 3.5;
  const y = hv - 17.5;
  const seed = f.x * 5 + f.y * 3;
  // Herramientas (de izquierda a derecha): martillo, llaves de mayor a menor, serrucho, destornilladores,
  // alicate; la silueta pintada de una que falta.
  const tool = toolOn(x, y, seed);
  if (tool) return tool;
  // Huecos cada 3 unidades.
  if (mod(x, 3) > 1.2 && mod(x, 3) < 2.2 && mod(y, 3) > 1.2 && mod(y, 3) < 2.2) return at(C.logs, 0);
  // Masonite café con manchas de grasa.
  const g = smoothNoise(u, hv, 8, seed);
  return at(C.cork, g > 0.7 ? 1 : 2 + (bayer(Math.floor(u), Math.floor(hv)) < 0.15 ? 1 : 0));
}

function toolOn(x: number, y: number, seed: number): RGBA | null {
  const steel = (k: number) => at(C.metal, k);
  // Martillo: mango de madera y cabeza de fierro.
  if (inRect(x, y, 3, 4, 5, 20)) return at(C.wood, x < 4 ? 4 : 3);
  if (inRect(x, y, 0.5, 19, 7.5, 23)) return steel(y > 22 ? 4 : 2);
  // Llaves: cuatro, del largo a la corta, con su boca abierta arriba.
  for (let i = 0; i < 4; i++) {
    const cx = 10 + i * 3;
    const top = 23 - i * 1.5;
    const bottom = 9 + i * 1.5;
    if (Math.abs(x - cx) < 0.7 && y > bottom && y < top) return steel(x < cx ? 4 : 3);
    const d = Math.hypot(x - cx, y - top);
    if (d < 1.6 && !(Math.abs(x - cx) < 0.6 && y > top)) return steel(4);
  }
  // Serrucho: hoja triangular con dientes y el mango de madera arriba.
  const sx = x - 22;
  const sy = y - 4;
  if (sx >= 0 && sx < 7 && sy >= 0 && sy < 16 && sx < 2 + sy * 0.3) {
    if (sx < 0.8 && Math.floor(sy) % 2 === 0) return steel(1);
    return steel(sy > 12 ? 5 : 4);
  }
  if (inRect(sx, sy, 0, 16, 6, 21)) return inRect(sx, sy, 2, 17.5, 4, 19.5) ? at(C.cork, 2) : at(C.rug, 2);
  // Destornilladores: mango de color y la punta de metal abajo.
  for (let i = 0; i < 3; i++) {
    const cx = 32 + i * 2.5;
    if (Math.abs(x - cx) < 0.9 && y > 15 && y < 21) return at([C.mustard, C.rug, C.blue][(i + seed) % 3]!, x < cx ? 4 : 3);
    if (Math.abs(x - cx) < 0.4 && y > 9 && y <= 15) return steel(4);
  }
  // Silueta pintada de la herramienta que falta (nadie la devolvió).
  if (inRect(x, y, 32, 2, 40, 7) && !inRect(x, y, 33, 3, 39, 6)) return at(C.white, 2);
  // Alicate colgado torcido.
  if (Math.abs(x - 38 - (y - 18) * 0.3) < 0.7 && y > 12 && y < 25) return at(C.rug, 3);
  if (Math.abs(x - 39.5 + (y - 18) * 0.3) < 0.7 && y > 12 && y < 25) return at(C.rug, 2);
  // Rollo de alargador naranja colgado de un gancho.
  const r = Math.hypot(x - 18, (y - 3.5) * 1.3);
  if (r > 2 && r < 3.6 && x < 40) return at(C.fire, mod(Math.atan2(y - 3.5, x - 18) * 3, 2) < 1 ? 3 : 2);
  return null;
}

/**
 * El portón de tablas visto desde adentro: dos hojas con la cruz en Z, la tranca atravesada y la luz que
 * entra por la rendija de abajo y entre las hojas.
 */
function barnDoorAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  if (u < 1 || u >= u1 - 1 || hv >= 46) return null;
  const mid = u1 / 2;
  // Marco.
  if (u < 3 || u >= u1 - 3 || hv >= 43) return at(C.woodDark, hv >= 45 || u < 2 ? 3 : 2);
  // Rendijas: de día entra un hilo de sol; de noche, oscuro.
  if (hv < 1.5 || Math.abs(u - mid) < 0.5) return day ? at(C.gold, 5) : at(C.night, 1);
  // Tranca de madera atravesada en sus soportes de fierro.
  if (hv >= 22 && hv < 25) return at(C.woodDark, hv >= 24 ? 4 : 2);
  if ((Math.abs(u - 8) < 1.5 || Math.abs(u - (u1 - 8)) < 1.5) && hv >= 20 && hv < 27) return at(C.night, 2);
  const lu = u < mid ? u - 3 : u - mid;
  const half = mid - 3;
  // Travesaños y la diagonal de cada hoja.
  if (Math.abs(hv - 6) < 1.2 || Math.abs(hv - 38) < 1.2) return at(C.wood, 2);
  const diag = 6 + (lu / half) * 32;
  if (hv > 6 && hv < 38 && Math.abs(hv - diag) < 1.4) return at(C.wood, 2);
  // Tablas verticales con su veta.
  const k = mod(lu, 4);
  if (k < 0.6) return at(C.woodDark, 2);
  const plank = Math.floor(lu / 4) + (u < mid ? 0 : 20);
  // Pintado de rojo como por fuera, gastado hasta la madera abajo.
  if (smoothNoise(u, hv, 4, 53) + (hv < 8 ? 0.25 : 0) > 0.72) return at(C.wood, 3);
  return at(C.curtain, noise(plank, Math.floor(hv / 12), 51) < 0.35 ? 1 : 2);
}

/**
 * Calendario viejo de una marca de repuestos: la foto de un carro arriba, la grilla del mes abajo con
 * días tachados, la hoja doblada en la esquina y la tachuela.
 */
function calendarAt(u: number, hv: number, u1: number): RGBA | null {
  const x0 = u1 / 2 - 6;
  const x1 = u1 / 2 + 6;
  if (!inRect(u, hv, x0, 20, x1, 44)) {
    if (inRect(u, hv, u1 / 2 - 0.8, 44, u1 / 2 + 0.8, 45.5)) return at(C.rug, 4);
    return null;
  }
  const x = u - x0;
  const y = hv - 20;
  // Esquina de abajo doblada hacia afuera.
  if (x > 9 && y < 3 && x - 9 > y) return x - 9 > y + 0.8 ? null : at(C.cream, 2);
  if (y >= 12) {
    // Foto: cielo, un carro rojo y la carretera.
    if (y >= 22.5) return at(C.cream, 3);
    if (y < 14) return at(C.stone, 2);
    const car = inRect(x, y, 2, 14.5, 10, 17) || inRect(x, y, 4, 17, 8.5, 19);
    if (car) return inRect(x, y, 5, 17.3, 8, 18.7) ? at(C.sky, 4) : at(C.rug, y > 16 ? 4 : 3);
    if (y < 14.8 && (Math.abs(x - 3.5) < 1 || Math.abs(x - 8.5) < 1)) return OUT;
    return at(C.sky, y > 19 ? 3 : 2);
  }
  // Grilla de los días (hoja amarillenta), con los días tachados en rojo.
  if (y >= 10.5) return at(C.rug, 3);
  const cx = Math.floor(x / 1.8);
  const cy = Math.floor(y / 2);
  if (mod(x, 1.8) < 0.5 || mod(y, 2) < 0.5) return at(C.cream, 2);
  if (cy >= 2 && cy <= 3 && (cx + cy) % 2 === 0) return at(C.rug, 3);
  return at(C.cream, noise(cx, cy, 53) < 0.2 ? 3 : 4);
}

/** Telaraña de rincón: radios desde la esquina de arriba y los hilos en arco (translúcidos). */
function cobwebAt(f: WallFeature, u: number, hv: number, u1: number): RGBA | null {
  // Arriba contra la viga, en la esquina del lado que toque (alterna según dónde esté).
  const right = (f.x + f.y) % 2 === 1;
  const x = right ? u1 - u : u;
  const y = 52 - hv;
  if (x < 0 || y < 0 || x > 14 || y > 14) return null;
  const r = Math.hypot(x, y);
  if (r > 14) return null;
  const a = Math.atan2(y, x);
  const radial = [0.15, 0.55, 0.95, 1.35].some((k) => Math.abs(a - k) * r < 0.5);
  const ring = [4, 7.5, 11].some((k) => Math.abs(r - k - Math.sin(a * 6) * 0.4) < 0.35);
  if (radial || ring) return alpha(at(C.white, 4), 0.55);
  return null;
}

/** Ventana de marco de madera, con el vidrio un poco empolvado abajo (se limpia de vez en cuando). */
function dustyWindowAt(u: number, hv: number, u1: number, day: boolean): RGBA | null {
  const x0 = 3;
  const x1 = u1 - 3;
  if (!inRect(u, hv, x0 - 2, 23, x1 + 2, 46)) return null;
  // Alféizar de tabla y el marco.
  if (hv < 25) return at(C.wood, hv < 24 ? 2 : 4);
  if (u < x0 || u >= x1 || hv >= 44) return at(C.woodDark, hv >= 45 || u < x0 - 1 ? 4 : 2);
  const mid = (x0 + x1) / 2;
  if (Math.abs(u - mid) < 0.7 || Math.abs(hv - 34.5) < 0.6) return at(C.woodDark, 3);
  const glass = day ? at(C.sky, hv > 38 ? 3 : 2) : at(C.night, 1);
  // Reflejo en diagonal.
  if (day && Math.abs(u - x0 - 2 - (hv - 26) * 0.6) < 0.8) return at(C.sky, 4);
  const dust = (36 - hv) / 20 + smoothNoise(u, hv, 4, 63) * 0.3;
  if (bayer(Math.floor(u), Math.floor(hv)) < dust * 0.45) return mix(glass, at(C.cream, 2), 0.45);
  return glass;
}

/** Lo que cuelga de una pared del garaje (o null si el tipo no es de los de aquí). */
export function garajeFeature(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u1 = (f.width ?? 1) * 16;
  switch (f.kind) {
    case "pegboard":
      return pegboardAt(f, u, hv, u1);
    case "barn-door":
      return barnDoorAt(u, hv, u1, day);
    case "calendar":
      return calendarAt(u, hv, u1);
    case "cobweb":
      return cobwebAt(f, u, hv, u1);
    case "dusty-window":
      return dustyWindowAt(u, hv, u1, day);
    default:
      return null;
  }
}
