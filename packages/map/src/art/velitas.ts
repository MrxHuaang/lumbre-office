// La Noche de velitas por código: la velita sola (blanca, con sus chorreones de cera), las velitas en
// vasitos de papel de colores (sueltas y en grupo), el farol de papel de colores en su estaca, el farol
// de papel del piso (un cubo con estrellas caladas) y el farolito de deseos que sube al cielo. Coordenadas
// locales de arte (tile = 16), mirando hacia +x. Todo se ve prendido (de día la llamita; de noche el papel
// brilla por dentro y la luz la pone el catálogo).
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { at, hex, noise, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (h: number, pad = 5) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: 16 + pad, y1: 16 + pad, z1: h }, 2);

/** Los colores del papel de los vasitos y los faroles (en el orden de los tipos `velita-vaso-*`). */
export const VELITA_COLORES = ["rojo", "amarillo", "verde", "azul", "morado"] as const;
export type VelitaColor = (typeof VELITA_COLORES)[number];
const PAPER: Record<VelitaColor, Ramp> = { rojo: C.rug, amarillo: C.mustard, verde: C.leaf, azul: C.blue, morado: C.violet };

/** Cera de las velas: blanco hueso, nunca gris. */
const WAX: Ramp = [hex("#a89880"), hex("#d2c3a6"), hex("#ece2cc"), hex("#faf4e6"), hex("#fffdf6")];
const WICK = hex("#3a2a20");

/** La llamita: de día chiquita; de noche un poco más alta y con el corazón blanco. */
function flame(s: Escena, cx: number, cy: number, z: number, night: boolean) {
  const h = night ? 3.2 : 2.4;
  s.plot(cx, cy, z, WICK);
  for (let t = 0.3; t < h; t += 0.3) {
    const k = t / h;
    // Ancha abajo y en punta arriba, con el centro más claro.
    const r = 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.25)) * (1 - k * 0.5);
    for (const d of [-r, 0, r]) {
      const core = d === 0 && k < 0.6;
      s.plot(cx + d * 0.7, cy - d * 0.7, z + 0.4 + t, core ? (night ? hex("#fffbe0") : at(C.fire, 4)) : at(C.fire, k > 0.7 ? 2 : 3));
    }
  }
}

/** Una vela blanca de radio `r` y alto `h` con chorreones de cera y la llamita arriba. */
function candle(s: Escena, cx: number, cy: number, z: number, r: number, h: number, night: boolean, seed = 1) {
  s.cylinder(cx, cy, z, r, h, (a, v, luz) => {
    // Chorreones: algunas franjas bajan más claras desde arriba.
    const drip = noise(Math.floor(a * 6), 0, seed) > 0.62 && v > h - 1.6 - noise(Math.floor(a * 6), 1, seed) * 2;
    return at(WAX, 2.4 + luz * 1.3 + (drip ? 0.8 : 0) + (night ? 0.4 : 0));
  });
  s.disc(cx, cy, z + h, r, () => at(WAX, night ? 4 : 3));
  flame(s, cx, cy, z + h, night);
}

/** El vasito de papel parafinado con su vela adentro: el papel plisado y, de noche, prendido por dentro. */
function cup(s: Escena, cx: number, cy: number, color: VelitaColor, night: boolean, seed = 1) {
  const p = PAPER[color];
  const r = 2.9;
  const h = 5;
  // La vela va primero (por dentro): lo que asoma sobre el borde queda a la vista.
  candle(s, cx, cy, 0, 0.9, h + 0.4, night, seed);
  // El fondo del vasito alrededor de la vela (de noche, prendido).
  s.disc(cx, cy, h - 0.9, r - 0.2, () => at(p, night ? 4 : 1));
  s.cylinder(cx, cy, 0, r, h, (a, v, luz) => {
    const pleat = Math.abs(Math.sin(a * 7)) < 0.25;
    if (night) return at(p, Math.min(5, 3.4 + (v / h) * 1.2 + (pleat ? -0.6 : 0)));
    return at(p, 2.4 + luz * 1.1 + (pleat ? -0.7 : 0));
  });
  // El borde ondulado de arriba (el papel se abre un poco).
  for (let a = -Math.PI; a < Math.PI; a += 0.18) {
    const z = h + (Math.sin(a * 7) > 0 ? 0.35 : 0);
    s.plot(cx + Math.cos(a) * (r + 0.15), cy + Math.sin(a) * (r + 0.15), z, at(p, night ? 5 : 3));
  }
}

// ---------- Los muebles del festival ----------

/** Velitas blancas sueltas (una alta y una gastada), sobre su charquito de cera. */
function velitaSola(night: boolean): Sprite {
  const s = scene(14);
  s.roundShadow(8, 8.5, 4.4, 0.22);
  for (const [x, y] of [[6.6, 7.2], [10.2, 10.4]] as const) s.disc(x, y, 0.15, 2.4, (dx, dy) => at(WAX, dx + dy < -0.5 ? 4 : 3));
  candle(s, 6.6, 7.2, 0.2, 1.3, 7, night, 3);
  candle(s, 10.2, 10.4, 0.2, 1.2, 4.4, night, 9);
  return s.sprite();
}

/** Una velita en vasito de papel de un color. */
const velitaVaso = (color: VelitaColor) => (night: boolean): Sprite => {
  const s = scene(14);
  s.roundShadow(8, 8.5, 3, 0.24);
  cup(s, 8, 8, color, night, VELITA_COLORES.indexOf(color) + 2);
  return s.sprite();
};

/** El grupito: cuatro vasitos de colores juntos. */
function velitasVasos(night: boolean): Sprite {
  const s = scene(14);
  s.roundShadow(8, 8.5, 7, 0.24);
  const spots: [number, number, VelitaColor][] = [
    [4.2, 4.4, "azul"],
    [11.8, 4.2, "verde"],
    [11.8, 11.8, "rojo"],
    [4.2, 11.8, "amarillo"],
  ];
  spots.forEach(([x, y, c], i) => cup(s, x, y, c, night, i + 5));
  return s.sprite();
}

/**
 * Farol de papel de colores en su estaca: el acordeón de papel de seda con franjas (rojo, amarillo,
 * verde, azul), las tapas de cartón y la borla. De noche las franjas brillan.
 */
function farolEstaca(night: boolean): Sprite {
  const s = scene(36);
  s.roundShadow(8, 8.5, 3.2, 0.24);
  s.solid(7.3, 7.3, 0, 1.4, 1.4, 16, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  const bands: Ramp[] = [C.rug, C.mustard, C.leaf, C.blue, C.rug, C.mustard, C.leaf, C.blue];
  const z0 = 15;
  const h = 9;
  s.cylinder(8, 8, z0, 3.4, h, (_a, v, luz) => {
    // Pliegues del acordeón: cada medio tile un surco más oscuro y el papel se abomba en el medio.
    const fold = v % 1.15 < 0.3;
    const r = bands[Math.min(bands.length - 1, Math.floor((v / h) * bands.length))]!;
    if (night) return at(r, fold ? 3 : 4 + (Math.abs(v - h / 2) < h / 4 ? 1 : 0));
    return at(r, (fold ? 1.5 : 2.6) + luz * 1.1);
  });
  for (const z of [z0 - 0.4, z0 + h]) {
    s.cylinder(8, 8, z, 3.5, 0.6, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 4 : 2));
  }
  // La boca de arriba: el aro de cartón y el papel de adentro, que de noche brilla.
  s.disc(8, 8, z0 + h + 0.6, 3.5, (dx, dy) => (Math.hypot(dx, dy) > 2.7 ? at(C.woodDark, 3) : at(C.fire, night ? 4 : 2)));
  // La borla de flecos debajo.
  for (let z = z0 - 3.4; z < z0 - 0.4; z += 0.4) for (const d of [-0.5, 0, 0.5]) s.plot(8 + d, 8 - d, z, at(C.gold, z < z0 - 2.4 ? 3 : 4));
  return s.sprite();
}

/** Farol de papel del piso: un cubito de papel de colores con una estrella calada por cara y la vela adentro. */
function farolCubo(night: boolean): Sprite {
  const s = scene(18);
  s.roundShadow(8, 8.5, 5, 0.24);
  const x = 4.5;
  const y = 4.5;
  const w = 7;
  const h = 8;
  /** La estrella calada: más clara (de noche, casi blanca) donde se ve la luz. */
  const star = (u: number, v: number) => {
    const du = u - w / 2;
    const dv = v - h / 2 + 0.3;
    const ang = Math.atan2(dv, du);
    const rad = Math.hypot(du, dv);
    return rad < 1.4 + 0.9 * Math.cos(ang * 5);
  };
  const face =
    (r: Ramp, base: number): Tinte =>
    (u, v) => {
      if (u < 0.5 || u > w - 0.5 || v < 0.5 || v > h - 0.5) return at(C.woodDark, 2);
      if (star(u, v)) return night ? hex("#fff4c8") : at(r, 5);
      return at(r, night ? base + 1.6 : base);
    };
  s.box(x, y, 0, w, w, h, (u, v) => (u < 0.5 || u > w - 0.5 || v < 0.5 || v > w - 0.5 ? at(C.woodDark, 3) : at(C.fire, night ? 4 : 3)), face(C.rug, 2.6), face(C.mustard, 2.2));
  flame(s, x + w / 2, y + w / 2, h - 0.5, night);
  return s.sprite();
}

// ---------- El farolito de deseos que vuela ----------

/**
 * El farol de deseos en el aire (lo anima el navegador al soltarlo): papel de seda que brilla, más ancho
 * arriba, con la boca abierta abajo donde va la llamita. Siempre prendido.
 */
export function drawFarolVolador(color: VelitaColor): Sprite {
  const s = new Escena({ x0: -6, y0: -6, z0: -2, x1: 6, y1: 6, z1: 14 }, 2);
  const p = PAPER[color];
  for (let v = 0; v < 9; v += 0.4) {
    const r = 2.4 + (v / 9) * 1.4;
    s.cylinder(0, 0, v, r, 0.45, (_a, vv, luz) => at(p, Math.min(5, 3.6 + ((v + vv) / 9) * 1.2 + luz * 0.3)));
  }
  s.disc(0, 0, 9, 3.8, () => at(p, 5));
  // La boca y la llamita.
  for (let a = 0; a < Math.PI * 2; a += 0.3) s.plot(Math.cos(a) * 2.4, Math.sin(a) * 2.4, -0.2, at(C.woodDark, 2));
  s.plot(0, 0, 0.6, hex("#fff4c8"));
  s.plot(0, 0, 1.1, at(C.fire, 3));
  return s.sprite();
}

// ---------- Registro ----------

/** Todo se dibuja de día y de noche (va en OUTDOOR de outdoor.ts). */
export const VELITAS_NIGHT: Record<string, (night: boolean) => Sprite> = {
  velita: velitaSola,
  ...Object.fromEntries(VELITA_COLORES.map((c) => [`velita-vaso-${c}`, velitaVaso(c)])),
  "velitas-vasos": velitasVasos,
  "farol-velitas": farolEstaca,
  "farol-cubo": farolCubo,
};

