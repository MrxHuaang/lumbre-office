// El observatorio del jardín por fuera (6x6 tiles = 96x96 unidades de arte), en la lomita de piedra del
// noreste. Una lomita de rocas con pasto y musgo, los escalones de piedra que suben a la puerta, la torre
// redonda de piedra cálida con ventanitas en arco, la galería de tablas con su baranda y la cúpula de
// duelas de madera con aros de latón. De día la cúpula está cerrada (la compuerta de tablas se ve como una
// franja más clara); de noche se abre y asoma el telescopio de latón, con luz cálida adentro. Arte propio,
// hecho a mano en código. Se registra en outdoor.ts (tiene versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { at, bayer, noise, ramp, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";

/** Piedra de la torre: gris cálido, casi arena, para que no se vea como cemento. */
export const WARM_STONE: Ramp = ramp("#3b3033", "#5a4b4a", "#7a6a63", "#9b8a7d", "#bba996", "#d9cab2");

/** Centro de la torre y medidas (la torre va un poco hacia atrás, así caben los escalones). */
const CX = 48;
const CY = 45;
/** La lomita: radio al pie, radio arriba y alto. */
const HILL = { r0: 46, r1: 29, h: 9 };
/** La torre. */
const TW = { r: 25, z0: HILL.h - 1, top: 78 };
/** La galería de tablas al pie de la cúpula. */
const GAL = { z: TW.top, r: 31 };
/** La cúpula (media esfera). */
const DOME = { r: 25, z0: TW.top + 3 };
/** La compuerta: su ángulo (casi +x, así el telescopio asoma de perfil) y su medio ancho. */
const SLIT = { az: 0.2, half: 0.2 };
/** Puerta en arco, de frente (+y). */
const DOOR = { half: 7.5, h: 22 };

/** Piedras de la torre: hiladas irregulares con mortero, alguna piedra más clara y manchas de musgo. */
function towerStone(u: number, v: number, dark: number): RGBA {
  const row = Math.floor(v / 5.5);
  const off = noise(row, 5, 61) * 11;
  const col = Math.floor((u + off) / 10);
  const k = (u + off) % 10;
  const kv = v % 5.5;
  const n = noise(col, row, 62);
  if (kv < 0.9 || k < 0.9) return at(WARM_STONE, 1 - dark);
  let c = at(WARM_STONE, 3 - dark + (n < 0.2 ? -1 : n > 0.85 ? 1 : 0));
  if (kv > 4.4 && k > 1.4) c = at(WARM_STONE, 2 - dark);
  else if (kv < 1.9 && k < 5) c = at(WARM_STONE, 4 - dark);
  // Musgo que sube desde abajo y se junta en las juntas.
  const moss = smoothNoise(u, v, 7, 63) + (v < 14 ? 0.25 : 0) - v / 160;
  if (moss > 0.72 && bayer(Math.floor(u), Math.floor(v)) < (moss - 0.72) * 4) c = mix(c, at(C.sage, 3 - dark), 0.6);
  return c;
}

/** Ventanita en arco (u centrado en 0): marco de madera, vidrio con luz cálida de noche. */
function archWindow(u: number, v: number, v0: number, h: number, w: number, night: boolean): RGBA | null {
  const top = v0 + h - w / 2;
  const inside = Math.abs(u) < w / 2 && v >= v0 && (v < top || Math.hypot(u, v - top) < w / 2);
  const frame = Math.abs(u) < w / 2 + 1.2 && v >= v0 - 1.2 && (v < top || Math.hypot(u, v - top) < w / 2 + 1.2);
  if (!frame) return null;
  if (!inside) return at(C.woodDark, 2);
  if (Math.abs(u) < 0.45 || Math.abs(v - (v0 + h * 0.45)) < 0.45) return at(C.woodDark, 3);
  if (night) return at(C.gold, v > v0 + h * 0.6 ? 5 : 4);
  return at(C.sky, v > v0 + h * 0.55 ? 2 : 1);
}

/** Puerta de tablas en arco con bisagras de fierro y una estrella de latón. */
function door(u: number, v: number, night: boolean): RGBA | null {
  const top = DOOR.h - DOOR.half;
  const inArch = (w: number) => Math.abs(u) < w && v >= 0 && (v < top || Math.hypot(u, v - top) < w);
  if (!inArch(DOOR.half + 1.5)) return null;
  if (!inArch(DOOR.half)) return at(WARM_STONE, v > top ? 4 : 2);
  // Estrella de latón a la altura de la cara (la aldaba).
  const sx = u;
  const sy = v - 14;
  const ang = Math.atan2(sy, sx);
  const rr = Math.hypot(sx, sy);
  if (rr < 1.6 + Math.cos(ang * 5) * 0.9) return at(C.gold, night ? 5 : 4);
  // Bisagras.
  if ((Math.abs(v - 5) < 0.8 || Math.abs(v - 16) < 0.8) && u < -1) return at(C.metal, 1);
  // Tablas verticales.
  const plank = Math.floor((u + DOOR.half) / 3);
  if ((u + DOOR.half) % 3 < 0.6) return at(C.woodDark, 1);
  return at(C.wood, 2 + (noise(plank, 0, 64) < 0.4 ? 0 : 1));
}

/** Las ventanitas de la torre: (ángulo, altura del alféizar). La puerta va en π/2. */
const WINDOWS: [number, number][] = [
  [0.15, 22],
  [0.95, 48],
  [2.3, 26],
  [2.05, 54],
  [-0.35, 52],
];

/** La torre: piedra, ventanas, la puerta y la viga de arriba. */
function towerWall(night: boolean) {
  return (ang: number, v: number, luz: number): RGBA | null => {
    const lz = luz > 0.35 ? 0 : luz > -0.35 ? 1 : 2;
    const u = (ang - Math.PI / 2) * TW.r;
    if (Math.abs(u) < DOOR.half + 2 && v < DOOR.h + 2) {
      const d = door(u, v, night);
      if (d) return d;
    }
    for (const [a, v0] of WINDOWS) {
      const c = archWindow((ang - a) * TW.r, v, v0, 13, 6, night);
      if (c) return lz > 1 ? mix(c, at(C.night, 1), 0.2) : c;
    }
    // Viga de madera arriba, donde apoya la galería.
    if (v > TW.top - TW.z0 - 4) return at(C.woodDark, 3 - lz);
    return towerStone(ang * TW.r, v, lz > 1 ? 1 : 0);
  };
}

/** La lomita: rocas al pie, pasto y musgo arriba (u = vuelta, t = 0 al pie a 1 arriba). */
function hillColor(ang: number, t: number, luz: number): RGBA {
  const u = ang * 40;
  const lz = luz > 0.3 ? 0 : luz > -0.3 ? 1 : 2;
  const grass = smoothNoise(u, t * 10, 4, 65) + t * 0.5;
  if (grass > 0.85) return at(C.grass, 4 - lz);
  if (grass > 0.72) return at(C.grass, 3 - lz);
  const row = Math.floor(t * 3);
  const col = Math.floor((u + noise(row, 1, 66) * 8) / 7);
  const k = (u + noise(row, 1, 66) * 8) % 7;
  if (k < 0.8) return at(WARM_STONE, 1);
  const n = noise(col, row, 67);
  return at(WARM_STONE, 3 - lz + (n > 0.7 ? 1 : n < 0.2 ? -1 : 0));
}

/** Duelas de la cúpula con aros de latón (az, el en radianes; luz de -1 a 1). */
function domeColor(az: number, el: number, luz: number, night: boolean): RGBA {
  const lz = luz > 0.45 ? 1 : luz > -0.05 ? 0 : -1;
  // Aros de latón.
  if (Math.abs(el - 0.12) < 0.05 || Math.abs(el - 0.72) < 0.04) return at(C.gold, 3 + lz);
  const slit = Math.abs(az - SLIT.az);
  // De día, la compuerta cerrada: tablas más claras con un riel de latón a cada lado.
  if (!night && slit < SLIT.half + 0.05) {
    if (slit > SLIT.half - 0.02) return at(C.gold, 2 + lz);
    return at(C.wood, 4 + lz + (Math.floor(el * 30) % 3 === 0 ? -1 : 0));
  }
  // De noche, la compuerta abierta queda corrida a un costado (una franja de tablas encima de las otras).
  if (night && slit >= SLIT.half && slit < SLIT.half + 0.3 && az > SLIT.az) return at(C.wood, 4 + lz + (Math.floor(el * 30) % 3 === 0 ? -1 : 0));
  const stave = Math.floor((az + 4) / 0.21);
  const k = ((az + 4) / 0.21) % 1;
  if (k < 0.1) return at(C.woodDark, 2 + lz);
  const tone = noise(stave, 0, 68) < 0.35 ? -1 : 0;
  return at(C.wood, 3 + lz + tone);
}

/** Tubo recto entre dos puntos (el telescopio): se salpica entero y el z-buffer deja lo que se ve. */
function tube(s: Escena, p0: [number, number, number], p1: [number, number, number], r: number, tinte: (t: number, luz: number) => RGBA | null) {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]] as const;
  const len = Math.hypot(d[0], d[1], d[2]);
  const ax = [d[0] / len, d[1] / len, d[2] / len] as const;
  // Dos vectores perpendiculares al eje.
  const ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const a = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]];
  const al = Math.hypot(a[0]!, a[1]!, a[2]!);
  const e1 = [a[0]! / al, a[1]! / al, a[2]! / al];
  const e2 = [ax[1] * e1[2]! - ax[2] * e1[1]!, ax[2] * e1[0]! - ax[0] * e1[2]!, ax[0] * e1[1]! - ax[1] * e1[0]!];
  for (let t = 0; t < len; t += 0.35)
    for (let q = 0; q < Math.PI * 2; q += 0.4 / Math.max(1, r)) {
      const nx = Math.cos(q) * e1[0]! + Math.sin(q) * e2[0]!;
      const ny = Math.cos(q) * e1[1]! + Math.sin(q) * e2[1]!;
      const nz = Math.cos(q) * e1[2]! + Math.sin(q) * e2[2]!;
      const luz = ny * 0.6 - nx * 0.35 + nz * 0.5;
      s.plot(p0[0] + ax[0] * t + nx * r, p0[1] + ax[1] * t + ny * r, p0[2] + ax[2] * t + nz * r, tinte(t / len, luz));
    }
}

/** Farol de pared con vidrios dorados (encendido de noche). */
function wallLantern(s: Escena, x: number, y: number, z: number, night: boolean) {
  s.solid(x - 0.5, y - 2.5, z + 5, 1, 3, 1, at(C.metal, 3), at(C.metal, 2), at(C.metal, 1));
  const glass: Tinte = (u, v) => (u < 0.7 || u > 3.3 || v < 0.6 ? at(C.metal, 1) : at(C.gold, night ? 5 : v > 2 ? 4 : 3));
  s.box(x - 2, y - 2, z, 4, 4, 5, () => at(C.metal, 2), glass, glass);
  s.solid(x - 2.6, y - 2.6, z + 5, 5.2, 5.2, 1.2, at(C.metal, 3), at(C.metal, 1), at(C.metal, 0));
}

export function drawObservatory(night: boolean): Sprite {
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: 100, y1: 100, z1: DOME.z0 + DOME.r + 16 }, 2);
  s.roundShadow(CX + 2, CY + 3, HILL.r0 + 1, 0.28);

  // ----- La lomita (tronco de cono de rocas y pasto) y su tapa.
  for (let t = 0; t <= 1; t += 0.035) {
    const r = HILL.r0 + (HILL.r1 - HILL.r0) * t;
    const z = HILL.h * Math.sin((t * Math.PI) / 2);
    for (let a = -Math.PI / 4 - 0.3; a <= (3 * Math.PI) / 4 + 0.3; a += 0.45 / r) {
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      // El borde ondula un poco: no es un plato.
      const wob = 1 + (noise(Math.floor(a * 12), 3, 69) - 0.5) * 0.08 * (1 - t);
      s.plot(CX + nx * r * wob, CY + ny * r * wob, z, hillColor(a, t, ny * 0.8 - nx * 0.3 + t * 0.3));
    }
  }
  s.disc(CX, CY, HILL.h, HILL.r1, (dx, dy) => at(C.grass, 3 + (noise(Math.floor(dx), Math.floor(dy), 70) < 0.2 ? 1 : 0)));
  // Rocas grandes sueltas en la ladera.
  for (const [a, r, sz] of [
    [-0.2, 40, 5],
    [0.55, 42, 4],
    [1.05, 41, 3.5],
    [2.2, 40, 5],
    [2.65, 38, 3.5],
    [-0.55, 37, 3],
  ] as const) {
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    s.box(x - sz, y - sz * 0.8, 0, sz * 2, sz * 1.6, sz * 1.1, () => at(WARM_STONE, 4), () => at(WARM_STONE, 3), () => at(WARM_STONE, 2));
    s.box(x - sz * 0.6, y - sz * 0.5, sz * 1.1, sz * 1.2, sz, sz * 0.5, () => at(C.sage, 3), () => at(WARM_STONE, 3), () => at(WARM_STONE, 2));
  }

  // ----- Los escalones de piedra que suben a la puerta.
  for (let k = 0; k < 4; k++) {
    const y0 = CY + TW.r - 1 + k * 5.2;
    const top = HILL.h - k * 2.2;
    const w = 16 + k * 1.5;
    s.box(CX - w / 2, y0, 0, w, 5.2, top, (u) => at(WARM_STONE, u % 5 < 0.6 ? 2 : 4), (u, v) => at(WARM_STONE, v > top - 1 ? 4 : u % 6 < 0.6 ? 1 : 3), (u, v) => at(WARM_STONE, v > top - 1 ? 3 : 2));
  }

  // ----- La torre.
  s.cylinder(CX, CY, TW.z0, TW.r, TW.top - TW.z0, towerWall(night));
  // Faroles a los lados de la puerta.
  for (const side of [-1, 1]) {
    const a = Math.PI / 2 + side * 0.48;
    wallLantern(s, CX + Math.cos(a) * (TW.r + 2), CY + Math.sin(a) * (TW.r + 2), TW.z0 + 16, night);
  }

  // ----- La galería: tablas en anillo, el borde y la baranda.
  s.disc(CX, CY, GAL.z, GAL.r, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < TW.r - 1) return null;
    return at(C.wood, d > GAL.r - 1 ? 5 : Math.floor(Math.atan2(dy, dx) * 14) % 2 ? 3 : 4);
  });
  s.cylinder(CX, CY, GAL.z - 3, GAL.r, 3, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 2));
  // Ménsulas bajo la galería.
  for (let a = -Math.PI / 4; a <= (3 * Math.PI) / 4; a += 0.5)
    for (let k = 0; k < 6; k += 0.4) s.plot(CX + Math.cos(a) * (TW.r + k), CY + Math.sin(a) * (TW.r + k), GAL.z - 3 - (6 - k) * 0.9, at(C.woodDark, 2));
  for (let a = -Math.PI / 4 - 0.2; a <= (3 * Math.PI) / 4 + 0.2; a += 0.02) {
    const x = CX + Math.cos(a) * (GAL.r - 0.8);
    const y = CY + Math.sin(a) * (GAL.r - 0.8);
    s.borde = false;
    if (Math.floor(a * 50) % 3 === 0) for (let v = 0; v < 7; v += 0.5) s.plot(x, y, GAL.z + v, at(C.wood, 2));
    s.borde = true;
    s.plot(x, y, GAL.z + 7.5, at(C.wood, 5));
    s.plot(x, y, GAL.z + 7, at(C.wood, 4));
  }

  // ----- La cúpula: media esfera de duelas. De noche la compuerta abierta deja ver el hueco (más adentro,
  // así el telescopio queda delante) con luz cálida.
  const R = DOME.r;
  for (let el = 0; el <= Math.PI / 2; el += 0.45 / R) {
    const ce = Math.cos(el);
    const step = 0.45 / Math.max(2, R * ce);
    for (let az = -Math.PI / 4 - 0.35; az <= (3 * Math.PI) / 4 + 0.35; az += step) {
      const nx = ce * Math.cos(az);
      const ny = ce * Math.sin(az);
      const nz = Math.sin(el);
      const open = night && Math.abs(az - SLIT.az) < SLIT.half && el < 1.35;
      if (open) {
        // Fondo del hueco: la cara de adentro de la cúpula, oscura, con el resplandor de la lámpara.
        const k = 0.45;
        const glow = 1 - el / 1.35;
        const c = bayer(Math.floor(az * 60), Math.floor(el * 60)) < glow * 0.55 ? at(C.fire, 3) : at(C.woodDark, glow > 0.5 ? 2 : 1);
        s.plot(CX + nx * R * k, CY + ny * R * k, DOME.z0 + nz * R * k, c);
        continue;
      }
      const luz = ny * 0.6 - nx * 0.35 + nz * 0.55;
      s.plot(CX + nx * R, CY + ny * R, DOME.z0 + nz * R, domeColor(az, el, luz, night));
    }
  }
  // Remate de latón con una estrellita.
  const tip = DOME.z0 + R;
  s.solid(CX - 1, CY - 1, tip - 1, 2, 2, 7, at(C.gold, 4), at(C.gold, 3), at(C.gold, 2));
  s.disc(CX, CY, tip + 6, 1.8, () => at(C.gold, 5));
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5)
    for (let k = 0; k < 4; k += 0.5) s.plot(CX + Math.cos(a) * k * 0.55, CY - Math.cos(a) * k * 0.55, tip + 9 + Math.sin(a) * k, at(C.gold, 5));

  // ----- De noche, el telescopio de latón asomando por la compuerta.
  if (night) {
    const el = 0.62;
    const dir: [number, number, number] = [Math.cos(SLIT.az) * Math.cos(el), Math.sin(SLIT.az) * Math.cos(el), Math.sin(el)];
    const base: [number, number, number] = [CX, CY, DOME.z0 + 6];
    const end: [number, number, number] = [base[0] + dir[0] * 40, base[1] + dir[1] * 40, base[2] + dir[2] * 40];
    tube(s, base, end, 3.3, (t, luz) => {
      const k = luz > 0.4 ? 5 : luz > -0.1 ? 4 : 3;
      if (t > 0.94) return at(C.woodDark, 2);
      if (Math.abs(t - 0.55) < 0.025 || Math.abs(t - 0.85) < 0.025) return at(C.woodDark, 3);
      return at(C.gold, k - (t < 0.3 ? 1 : 0));
    });
    // La lente, con un brillo.
    s.disc(end[0], end[1], end[2], 2.4, (dx, dy) => (Math.hypot(dx + 0.8, dy - 0.8) < 0.9 ? at(C.white, 4) : at(C.blue, 3)));
  }

  // ----- Hiedra que trepa por la torre al lado oeste de la puerta.
  for (let i = 0; i < 70; i++) {
    const a = 2.25 + noise(i, 1, 71) * 0.45;
    const v = TW.z0 + noise(i, 2, 71) * 40;
    const x = CX + Math.cos(a) * (TW.r + 0.4);
    const y = CY + Math.sin(a) * (TW.r + 0.4);
    s.plot(x, y, v, at(C.leaf, noise(i, 3, 71) < 0.5 ? 3 : 2));
    s.plot(x, y, v + 0.5, at(C.leaf, 4));
  }
  return s.sprite();
}

/** Dónde queda la lente del telescopio de afuera (para que el cliente le ponga un brillo de noche). */
export const OBSERVATORY_LENS = (() => {
  const el = 0.62;
  return {
    x: CX + Math.cos(SLIT.az) * Math.cos(el) * 40,
    y: CY + Math.sin(SLIT.az) * Math.cos(el) * 40,
    z: DOME.z0 + 6 + Math.sin(el) * 40,
  };
})();
