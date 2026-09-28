// El observatorio del jardín por fuera (8x8 tiles = 128x128 unidades de arte), al este del jardín. Un
// zócalo redondo de piedra con lajas encima, los escalones que bajan de la puerta a la placita, la torre
// redonda de piedra cálida con ventanitas en arco y una cornisa a media altura, la galería de tablas con
// su baranda y la cúpula de duelas de madera con aros de latón. De día la cúpula está cerrada (la compuerta de tablas se ve como una
// franja más clara); de noche se abre y asoma el telescopio de latón, con luz cálida adentro. Arte propio,
// hecho a mano en código. Se registra en outdoor.ts (tiene versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import { C, mix } from "./palette";
import { at, bayer, noise, ramp, smoothNoise, type Ramp, type RGBA, type Sprite } from "./pixel";

/** Piedra de la torre: gris cálido, casi arena, para que no se vea como cemento. */
export const WARM_STONE: Ramp = ramp("#3d3130", "#5e4c45", "#806b5c", "#a18a74", "#c0a98c", "#dcc8a8");

/** Centro de la torre y medidas (la torre va un poco hacia atrás, así caben los escalones). */
const CX = 64;
const CY = 56;
/** El zócalo de piedra: radio al pie, radio arriba y alto. */
const BASE = { r0: 55, r1: 52, h: 7 };
/** La torre (con la cornisa de piedra a media altura). */
const TW = { r: 41, z0: BASE.h, top: 146, belt: 74 };
/** La galería de tablas al pie de la cúpula. */
const GAL = { z: TW.top, r: 48 };
/** La cúpula (media esfera). */
const DOME = { r: 41, z0: TW.top + 3 };
/** La compuerta: su ángulo (casi +x, así el telescopio asoma de perfil) y su medio ancho. */
const SLIT = { az: 0.3, half: 0.24 };
/** Largo del telescopio que asoma de noche. */
const TELE_LEN = 70;
/** Puerta en arco, de frente (+y). */
const DOOR = { half: 9, h: 28 };

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
  const sy = v - 17;
  const ang = Math.atan2(sy, sx);
  const rr = Math.hypot(sx, sy);
  if (rr < 1.6 + Math.cos(ang * 5) * 0.9) return at(C.gold, night ? 5 : 4);
  // Bisagras.
  if ((Math.abs(v - 6) < 0.8 || Math.abs(v - 20) < 0.8) && u < -1) return at(C.metal, 1);
  // Tablas verticales.
  const plank = Math.floor((u + DOOR.half) / 3);
  if ((u + DOOR.half) % 3 < 0.6) return at(C.woodDark, 1);
  return at(C.wood, 2 + (noise(plank, 0, 64) < 0.4 ? 0 : 1));
}

/** Las ventanitas de la torre: (ángulo, altura del alféizar). La puerta va en π/2. */
const WINDOWS: [number, number][] = [
  [0.15, 30],
  [0.95, 84],
  [2.3, 36],
  [2.05, 94],
  [-0.35, 88],
  [1.25, 42],
  [0.5, 108],
  [1.75, 110],
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
      const c = archWindow((ang - a) * TW.r, v, v0, 16, 7, night);
      if (c) return lz > 1 ? mix(c, at(C.night, 1), 0.2) : c;
    }
    // Viga de madera arriba, donde apoya la galería.
    if (v > TW.top - TW.z0 - 5) return at(C.woodDark, 3 - lz);
    // La cornisa de piedra clara a media altura (sombra debajo).
    const belt = v - (TW.belt - TW.z0);
    if (belt >= 0 && belt < 3) return at(WARM_STONE, (belt > 1.8 ? 5 : 4) - lz);
    if (belt < 0 && belt > -1.2) return at(WARM_STONE, 1);
    return towerStone(ang * TW.r, v, lz > 1 ? 1 : 0);
  };
}

/** El zócalo: dos hiladas de sillares con mortero y algo de musgo al pie (u = vuelta, v = altura). */
function baseStone(ang: number, v: number, luz: number): RGBA {
  const u = ang * BASE.r0;
  const lz = luz > 0.3 ? 0 : luz > -0.3 ? 1 : 2;
  const row = Math.floor(v / 3.5);
  const off = noise(row, 1, 66) * 9;
  const k = (u + off) % 9;
  if (k < 0.8 || v % 3.5 < 0.7) return at(WARM_STONE, 1);
  const n = noise(Math.floor((u + off) / 9), row, 67);
  let c = at(WARM_STONE, 3 - lz + (n > 0.7 ? 1 : n < 0.2 ? -1 : 0));
  if (v < 2 && smoothNoise(u, v, 4, 65) > 0.6) c = mix(c, at(C.sage, 3 - lz), 0.55);
  return c;
}

/** Lajas del zócalo alrededor de la torre (dx, dy desde el centro). */
function flagstone(dx: number, dy: number): RGBA | null {
  const d = Math.hypot(dx, dy);
  if (d < TW.r - 1) return null;
  if (d > BASE.r1 - 1.2) return at(WARM_STONE, 5);
  const ring = Math.floor((d - TW.r) / 5);
  const seg = Math.floor(((Math.atan2(dy, dx) + Math.PI) * (TW.r + ring * 5)) / 9 + noise(ring, 2, 68) * 3);
  const kr = (d - TW.r) % 5;
  const ka = (((Math.atan2(dy, dx) + Math.PI) * (TW.r + ring * 5)) / 9 + noise(ring, 2, 68) * 3) % 1;
  if (kr < 0.7 || ka < 0.08) return at(WARM_STONE, 2);
  const n = noise(seg, ring, 69);
  return at(WARM_STONE, n < 0.25 ? 3 : n > 0.85 ? 5 : 4);
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
  const ref: readonly [number, number, number] = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
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
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: 132, y1: 132, z1: DOME.z0 + DOME.r + 16 }, 2);
  s.roundShadow(CX + 2, CY + 3, BASE.r0 + 1, 0.28);

  // ----- El zócalo de piedra (apenas en talud) con las lajas encima.
  for (let v = 0; v <= BASE.h; v += 0.4) {
    const r = BASE.r0 + ((BASE.r1 - BASE.r0) * v) / BASE.h;
    for (let a = -Math.PI / 4 - 0.3; a <= (3 * Math.PI) / 4 + 0.3; a += 0.45 / r) {
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      s.plot(CX + nx * r, CY + ny * r, v, baseStone(a, v, ny * 0.8 - nx * 0.3));
    }
  }
  s.disc(CX, CY, BASE.h, BASE.r1, flagstone);
  // Matas de pasto y flores al pie del zócalo.
  for (let i = 0; i < 26; i++) {
    const a = -0.6 + noise(i, 1, 72) * 3.4;
    const r = BASE.r0 + 0.5 + noise(i, 2, 72) * 2;
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    for (let k = 0; k < 5; k++) s.plot(x + (k - 2) * 0.6, y, 0.5 + (k % 2) * 1.2, at(C.grass, 3 + (k % 2)));
    if (noise(i, 3, 72) < 0.3) s.plot(x, y, 2.4, at(i % 2 ? C.rose : C.gold, 4));
  }

  // ----- Los escalones de piedra que bajan de la puerta a la placita.
  for (let k = 0; k < 3; k++) {
    const y0 = CY + BASE.r1 - 5 + k * 6;
    const top = BASE.h - k * 2.3;
    const w = 22 + k * 2.5;
    s.box(CX - w / 2, y0, 0, w, 6, top, (u) => at(WARM_STONE, u % 6 < 0.6 ? 2 : 4), (u, v) => at(WARM_STONE, v > top - 1 ? 4 : u % 7 < 0.6 ? 1 : 3), (u, v) => at(WARM_STONE, v > top - 1 ? 3 : 2));
  }
  // Maceteros de piedra con lavanda a los lados de los escalones.
  for (const side of [-1, 1]) {
    const x = CX + side * 16;
    const y = CY + BASE.r1 - 1;
    s.box(x - 3, y - 3, BASE.h, 6, 6, 5, () => at(WARM_STONE, 4), () => at(WARM_STONE, 3), () => at(WARM_STONE, 2));
    for (let k = 0; k < 18; k++) s.plot(x - 2 + noise(k, side, 73) * 4, y - 2 + noise(k, 4, 73) * 4, BASE.h + 5.5 + noise(k, 5, 73) * 3, at(k % 3 ? C.sage : C.rose, 3 + (k % 2)));
  }

  // ----- La torre.
  s.cylinder(CX, CY, TW.z0, TW.r, TW.top - TW.z0, towerWall(night));
  // Faroles a los lados de la puerta.
  for (const side of [-1, 1]) {
    const a = Math.PI / 2 + side * 0.48;
    wallLantern(s, CX + Math.cos(a) * (TW.r + 2), CY + Math.sin(a) * (TW.r + 2), TW.z0 + 20, night);
  }

  // ----- La galería: tablas en anillo, el borde y la baranda.
  s.disc(CX, CY, GAL.z, GAL.r, (dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < TW.r - 1) return null;
    return at(C.wood, d > GAL.r - 1 ? 5 : Math.floor(Math.atan2(dy, dx) * 14) % 2 ? 3 : 4);
  });
  s.cylinder(CX, CY, GAL.z - 3, GAL.r, 3, (_a, _v, luz) => at(C.woodDark, luz > 0 ? 3 : 2));
  // Ménsulas bajo la galería.
  for (let a = -Math.PI / 4; a <= (3 * Math.PI) / 4; a += 0.4)
    for (let k = 0; k < 7; k += 0.4) s.plot(CX + Math.cos(a) * (TW.r + k), CY + Math.sin(a) * (TW.r + k), GAL.z - 3 - (7 - k) * 0.9, at(C.woodDark, 2));
  for (let a = -Math.PI / 4 - 0.2; a <= (3 * Math.PI) / 4 + 0.2; a += 0.02) {
    const x = CX + Math.cos(a) * (GAL.r - 0.8);
    const y = CY + Math.sin(a) * (GAL.r - 0.8);
    s.borde = false;
    if (Math.floor(a * 60) % 3 === 0) for (let v = 0; v < 8; v += 0.5) s.plot(x, y, GAL.z + v, at(C.wood, 2));
    s.borde = true;
    s.plot(x, y, GAL.z + 8.5, at(C.wood, 5));
    s.plot(x, y, GAL.z + 8, at(C.wood, 4));
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
        // Fondo del hueco: por el hueco se ve la cara de adentro del otro lado de la cúpula (donde sale la
        // visual hacia atrás), oscura, con el resplandor de la lámpara abajo.
        const t = (2 * R * (nx + ny + nz)) / Math.sqrt(3);
        const back = -t / Math.sqrt(3);
        const qz = nz * R + back;
        const glow = 1 - Math.max(0, qz) / R;
        const c = bayer(Math.floor(az * 60), Math.floor(el * 60)) < (glow - 0.55) * 0.5 ? at(C.gold, 3) : at(C.woodDark, glow > 0.75 ? 1 : 0);
        s.plot(CX + nx * R + back, CY + ny * R + back, DOME.z0 + qz, c);
        continue;
      }
      const luz = ny * 0.6 - nx * 0.35 + nz * 0.55;
      s.plot(CX + nx * R, CY + ny * R, DOME.z0 + nz * R, domeColor(az, el, luz, night));
    }
  }
  // Remate de latón con una estrellita.
  const tip = DOME.z0 + R;
  s.solid(CX - 1, CY - 1, tip - 1, 2, 2, 8, at(C.gold, 4), at(C.gold, 3), at(C.gold, 2));
  s.disc(CX, CY, tip + 7, 2, () => at(C.gold, 5));
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5)
    for (let k = 0; k < 4.5; k += 0.5) s.plot(CX + Math.cos(a) * k * 0.55, CY - Math.cos(a) * k * 0.55, tip + 10 + Math.sin(a) * k, at(C.gold, 5));

  // ----- De noche, el telescopio de latón asomando por la compuerta.
  if (night) {
    const el = 0.72;
    const dir: [number, number, number] = [Math.cos(SLIT.az) * Math.cos(el), Math.sin(SLIT.az) * Math.cos(el), Math.sin(el)];
    const base: [number, number, number] = [CX, CY, DOME.z0 + 10];
    const end: [number, number, number] = [base[0] + dir[0] * TELE_LEN, base[1] + dir[1] * TELE_LEN, base[2] + dir[2] * TELE_LEN];
    tube(s, base, end, 5, (t, luz) => {
      const k = luz > 0.4 ? 5 : luz > -0.1 ? 4 : 3;
      if (t > 0.94) return at(C.woodDark, 2);
      if (Math.abs(t - 0.55) < 0.025 || Math.abs(t - 0.85) < 0.025) return at(C.woodDark, 3);
      return at(C.gold, k - (t < 0.3 ? 1 : 0));
    });
    // La lente, con un brillo.
    s.disc(end[0], end[1], end[2], 4, (dx, dy) => (Math.hypot(dx + 0.8, dy - 0.8) < 0.9 ? at(C.white, 4) : at(C.blue, 3)));
  }

  // ----- Hiedra que trepa por la torre al lado oeste de la puerta.
  for (let i = 0; i < 110; i++) {
    const a = 2.25 + noise(i, 1, 71) * 0.45;
    const v = TW.z0 + noise(i, 2, 71) * 52;
    const x = CX + Math.cos(a) * (TW.r + 0.4);
    const y = CY + Math.sin(a) * (TW.r + 0.4);
    s.plot(x, y, v, at(C.leaf, noise(i, 3, 71) < 0.5 ? 3 : 2));
    s.plot(x, y, v + 0.5, at(C.leaf, 4));
  }
  return s.sprite();
}

/** Dónde queda la lente del telescopio de afuera (para que el cliente le ponga un brillo de noche). */
export const OBSERVATORY_LENS = (() => {
  const el = 0.72;
  return {
    x: CX + Math.cos(SLIT.az) * Math.cos(el) * TELE_LEN,
    y: CY + Math.sin(SLIT.az) * Math.cos(el) * TELE_LEN,
    z: DOME.z0 + 10 + Math.sin(el) * TELE_LEN,
  };
})();
