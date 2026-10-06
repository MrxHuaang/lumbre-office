// El Megabús de noche (VIR-178): capas que el cliente pone sobre cada cuerpo del bus (apps/web/src/game/bus.ts).
// El bus se mueve, así que su luz no puede ser un hueco en la penumbra (habría que redibujarla en cada
// cuadro): las ventanas prendidas van encima de la noche, ya con su luz, y el haz de los faros y el rojo de
// las luces de atrás se suman (ADD) sobre la calle. Mismo origen que `busCarSprite` (la esquina de atrás del
// lado de la plataforma, a ras de la plataforma) y las mismas medidas.
import { BUS_STOP } from "../world/areas/parada";
import { BUS_CAR_LEN, type BusCar } from "./bus";
import { BLACK, HANDRAIL } from "./bus-colores";
import { mix } from "./palette";
import { PixelCanvas, at, bayer, hex, noise, toScreen, type RGBA, type Sprite } from "./pixel";

/** Alturas del bus (como Z de bus.ts): faldón, franja lima, ventanas y techo; la calzada va en z = -12. */
const Z = { road: -12, skirt1: -4, band1: 5, win1: 29, roof: 33 };
const BW = Math.round(BUS_STOP.width * 16);
/** Cada cuánto va un parante entre ventana y ventana (como el dibujo del bus). */
const VANO = 26;

/** Lienzo con el origen del cuerpo del bus en (ox, oy), del tamaño de lo que se pinta. */
function lienzo(puntos: [number, number, number][]): { c: PixelCanvas; ox: number; oy: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y, z] of puntos) {
    const s = toScreen(x, y, z);
    x0 = Math.min(x0, s.x);
    y0 = Math.min(y0, s.y);
    x1 = Math.max(x1, s.x);
    y1 = Math.max(y1, s.y);
  }
  const pad = 8;
  const ox = Math.ceil(-x0) + pad;
  const oy = Math.ceil(-y0) + pad;
  return { c: new PixelCanvas(Math.ceil(x1 - x0) + pad * 2 + 1, Math.ceil(y1 - y0) + pad * 2 + 1), ox, oy };
}

const LUZ_TECHO = hex("#fff3cf");
const LUZ = hex("#ffd98c");
const LUZ_BAJA = hex("#eeb468");
const SILUETA = hex("#3a2733");
const ASIENTO = hex("#5a3a46");

/** ¿Hay alguien sentado en el puesto `k` de este cuerpo? (fijo por puesto: el bus siempre lleva gente). */
const ocupado = (car: BusCar, k: number) => noise(k, car === "front" ? 3 : 5, 177) < 0.5;

/** Las ventanas del costado prendidas por dentro: la luz del techo, los espaldares y la gente sentada. */
function ventanaDeNoche(car: BusCar, u: number, z: number): RGBA | null {
  if (z < Z.band1 || z >= Z.win1) return null;
  const k = ((u % VANO) + VANO) % VANO;
  if (k < 1.5) return at(BLACK, 2);
  // Puestos de a 13: espaldar redondeado abajo y, si va alguien, cabeza y hombros contra la luz.
  const puesto = Math.floor(u / 13);
  const cu = u - puesto * 13 - 6.5;
  if (ocupado(car, puesto)) {
    if (Math.hypot(cu, (z - 18.2) * 1.1) < 2.5) return SILUETA;
    if (z < 15.2 && Math.abs(cu) < 4.6 - Math.max(0, z - 13) * 1.2) return SILUETA;
  }
  if (z < 12.5 && Math.abs(cu) < 3.6 - Math.max(0, z - 10.5) * 0.9) return ASIENTO;
  // La barra de agarrarse, amarilla, a lo largo.
  if (Math.abs(z - 24.3) < 0.45) return at(HANDRAIL, 1);
  // La luz: la franja del techo más clara y abajo más tibia, tramada.
  if (z > 26.5) return LUZ_TECHO;
  const t = (z - Z.band1) / (26.5 - Z.band1);
  return bayer(Math.floor(u), Math.floor(z)) < t ? LUZ : LUZ_BAJA;
}

/**
 * Lo que se ve encima de un cuerpo del bus de noche (va sobre la penumbra, ya con su luz): las ventanas
 * del costado prendidas con la gente adentro; en el de adelante, el parabrisas con la luz de la cabina y los
 * faros encendidos; en el de atrás, las luces rojas en la esquina de atrás.
 */
export function busNightWindows(car: BusCar): Sprite {
  const len = BUS_CAR_LEN[car];
  const { c, ox, oy } = lienzo([
    [0, BW, Z.road],
    [len, 0, Z.roof],
    [len, BW, Z.road],
    [0, BW, Z.roof],
  ]);
  const plot = (x: number, y: number, z: number, col: RGBA | null) => {
    if (!col) return;
    const s = toScreen(x, y, z);
    c.set(s.x + ox, s.y + oy, col);
  };
  for (let z = Z.band1; z < Z.win1; z += 0.4) for (let u = 0; u < len; u += 0.4) plot(u, BW, z, ventanaDeNoche(car, u, z));
  if (car === "front") {
    // El parabrisas (cara +x): la cabina iluminada con el tablero oscuro abajo y el conductor.
    for (let z = 2; z < 25; z += 0.4)
      for (let uy = 1.6; uy < BW - 1.6; uy += 0.4) {
        const u = BW - uy;
        let col: RGBA;
        if (Math.abs(u - (z - 2) * 0.9 - 6) < 1.4) continue; // el reflejo del dibujo queda
        if (z < 6) col = mix(SILUETA, LUZ_BAJA, 0.25);
        else if (Math.hypot(u - (BW - 11), (z - 14) * 1.1) < 2.6 || (z < 11 && Math.abs(u - (BW - 11)) < 5 - Math.max(0, z - 9))) col = SILUETA;
        else col = z > 21 ? LUZ_TECHO : bayer(Math.floor(u), Math.floor(z)) < (z - 6) / 15 ? LUZ : LUZ_BAJA;
        plot(len, uy, z, col);
      }
    // Los faros, en las esquinas de abajo.
    for (let z = Z.skirt1 + 0.5; z < 1.5; z += 0.4)
      for (let uy = 2; uy < BW - 2; uy += 0.4) {
        const u = BW - uy;
        if (u < 7 || u > BW - 7) plot(len, uy, z, z > 0 ? hex("#fffbe8") : hex("#fff0b8"));
      }
  } else {
    // Las luces rojas de atrás, en la esquina del costado que se ve.
    for (let z = -3; z < 4; z += 0.4) for (let u = 0.4; u < 3.2; u += 0.4) plot(u, BW, z, z > 0.5 ? hex("#ff5a40") : hex("#e0281c"));
  }
  return { canvas: c, ox, oy };
}

/** Suma en bandas tramadas de un color (para lo que va en ADD). */
function sumar(c: PixelCanvas, x: number, y: number, col: RGBA, a: number, bandas = 4) {
  const band = Math.floor(a * bandas + bayer(Math.floor(x), Math.floor(y)) * 0.9);
  if (band <= 0) return;
  const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
  const prev = c.data[i + 3]! / 255;
  const na = Math.min(band, bandas) / bandas;
  if (na <= prev) return;
  c.set(x, y, [col[0], col[1], col[2], Math.round(na * 255)]);
}

/** El haz de los faros sobre la calle, delante del bus (ADD; mismo origen que el cuerpo de adelante). */
export function busHeadlightBeam(): Sprite {
  const len = BUS_CAR_LEN.front;
  const largo = 120;
  const { c, ox, oy } = lienzo([
    [len, -30, Z.road],
    [len + largo, BW + 30, Z.road],
    [len, BW + 30, Z.road],
    [len + largo, -30, Z.road],
    [len, 0, 4],
  ]);
  const col = hex("#ffeec4");
  const faros = [4.5, BW - 4.5];
  for (let t = 0; t < largo; t += 0.4)
    for (let y = -30; y < BW + 30; y += 0.4) {
      let f = 0;
      for (const fy of faros) {
        const ancho = 3 + t * 0.32;
        const d = Math.abs(y - fy) / ancho;
        if (d < 1) f = Math.max(f, (1 - d * d) * (1 - t / largo) ** 1.4);
      }
      if (f <= 0) continue;
      const s = toScreen(len + t, y, Z.road);
      sumar(c, s.x + ox, s.y + oy, col, f * 0.55);
    }
  // El resplandor de cada faro.
  for (const fy of faros) {
    const p = toScreen(len, fy, -1.5);
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -9; dx <= 9; dx++) {
        const d = Math.hypot(dx / 9, dy / 7);
        if (d < 1) sumar(c, p.x + ox + dx, p.y + oy + dy, col, (1 - d) * 0.7, 3);
      }
  }
  return { canvas: c, ox, oy };
}

/** El rojo de las luces de atrás en la calle y alrededor de la luz (ADD; mismo origen que el cuerpo de atrás). */
export function busTailGlow(): Sprite {
  const largo = 34;
  const { c, ox, oy } = lienzo([
    [-largo, BW - 14, Z.road],
    [4, BW + 12, Z.road],
    [0, BW, 8],
  ]);
  const col = hex("#ff3a24");
  for (let t = 0; t < largo; t += 0.4)
    for (let y = BW - 14; y < BW + 12; y += 0.4) {
      const d = Math.abs(y - (BW - 1)) / (4 + t * 0.35);
      if (d >= 1) continue;
      const s = toScreen(-t, y, Z.road);
      sumar(c, s.x + ox, s.y + oy, col, (1 - d * d) * (1 - t / largo) * 0.5);
    }
  const p = toScreen(1.6, BW, 0.5);
  for (let dy = -6; dy <= 6; dy++)
    for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx, dy) / 6;
      if (d < 1) sumar(c, p.x + ox + dx, p.y + oy + dy, col, (1 - d) * 0.6, 3);
    }
  return { canvas: c, ox, oy };
}
