// Las Novenas de aguinaldo por código: el pesebre del recibidor (que se arma figura a figura, un día de la
// novena cada una), el árbol de Navidad, el arco de luces y la corona. Coordenadas locales de arte (tile =
// 16), mirando hacia +x. Cálido y de diciembre: musgo, paja, madera, rojo y dorado; de noche, las luces
// del árbol y del arco se prenden.
import { Escena, type Tinte } from "./exterior-escena";
import { C } from "./palette";
import { at, hex, noise, ramp, type Ramp, type RGBA, type Sprite } from "./pixel";

const scene = (w: number, d: number, h: number, pad = 6) => new Escena({ x0: -pad, y0: -pad, z0: -4, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);
const flatT = (c: RGBA): Tinte => () => c;

/** Musgo del pesebre (el piso de las figuras) y la paja del techo y del pesebrito. */
const MOSS = ramp("#1f3a1c", "#2f5a26", "#447a32", "#5e9a3e", "#84b852", "#b0d878");
const STRAW = ramp("#6a4a1a", "#9a7028", "#c49a3a", "#e0bc58", "#f2d684", "#fff0b8");
const SKIN = ramp("#6a3a24", "#9a5a38", "#c47e52", "#e0a272", "#f2c498", "#ffe2c4");
const PINE = ramp("#0f2a1c", "#173f26", "#235a32", "#327a40", "#4c9a50", "#7cc070");
/** Los colores de las luces y las bolas del árbol (rojo, dorado, azul, verde y rosado). */
const BULBS: RGBA[][] = [
  [hex("#8a1f1f"), hex("#ff5a4a")],
  [hex("#8a6a14"), hex("#ffe070")],
  [hex("#1f3f8a"), hex("#7ac0ff")],
  [hex("#1f6a2a"), hex("#8cff8a")],
  [hex("#8a2a6a"), hex("#ff9ae6")],
];

/** Bola salpicada punto a punto (cabezas, la oveja, las bolas del árbol). */
function ball(s: Escena, cx: number, cy: number, cz: number, r: number, tinte: (luz: number, e: number) => RGBA | null, rz = r) {
  const step = 0.4 / Math.max(1, r);
  for (let e = -Math.PI / 2; e <= Math.PI / 2; e += step)
    for (let a = -Math.PI; a < Math.PI; a += step) {
      const nx = Math.cos(a) * Math.cos(e);
      const ny = Math.sin(a) * Math.cos(e);
      const nz = Math.sin(e);
      const luz = ny * 0.5 - nx * 0.3 + nz * 0.7;
      s.plot(cx + nx * r, cy + ny * r, cz + nz * rz, tinte(luz, e));
    }
}

// ---------- El pesebre ----------

/** Una figurita de pie: la túnica (cilindro que se angosta) y la cabeza; `veil` le pone el manto en la cabeza. */
function figurine(s: Escena, x: number, y: number, z: number, robe: Ramp, opts: { h?: number; veil?: Ramp; crown?: boolean; staff?: boolean } = {}) {
  const h = opts.h ?? 6;
  for (let v = 0; v < h; v += 0.5) {
    const r = 1.5 - (v / h) * 0.6;
    s.cylinder(x, y, z + v, r, 0.5, (_a, _v, luz) => at(robe, 3 + luz * 1.4));
  }
  s.disc(x, y, z + h, 0.9, () => at(robe, 3));
  ball(s, x, y, z + h + 1.1, 1.1, (luz) => at(SKIN, 3 + luz));
  if (opts.veil) ball(s, x - 0.25, y - 0.25, z + h + 1.3, 1.25, (luz, e) => (e > -0.3 ? at(opts.veil!, 3 + luz) : null));
  if (opts.crown) for (const [dx, dy] of [[-0.6, 0], [0, -0.6], [0.5, 0.4], [0, 0.6]] as const) s.plot(x + dx, y + dy, z + h + 2.4, at(C.gold, 4));
  if (opts.staff) for (let v = 0; v < h + 3; v += 0.4) s.plot(x + 1.6, y + 0.4, z + v, at(C.logs, v > h + 2 ? 4 : 3));
}

/** Un animal echado (la mula y el buey): cuerpo de caja redondeada, cabeza y, si es buey, cachos. */
function animal(s: Escena, x: number, y: number, z: number, hide: Ramp, horns: boolean) {
  ball(s, x, y, z + 1.6, 2.4, (luz) => at(hide, 3 + luz * 1.3), 1.6);
  ball(s, x + 2.4, y + 0.6, z + 2.8, 1.2, (luz) => at(hide, 3 + luz * 1.3));
  // Las orejas (la mula) o los cachos (el buey).
  for (const dy of [-0.7, 0.7]) {
    if (horns) for (let k = 0; k < 1.4; k += 0.3) s.plot(x + 2.3 - k * 0.3, y + 0.6 + dy * (1 + k * 0.6), z + 3.9 + k * 0.6, at(C.cream, 5));
    else for (let k = 0; k < 1.6; k += 0.3) s.plot(x + 2.1, y + 0.6 + dy * 0.6, z + 3.8 + k, at(hide, 2));
  }
  s.plot(x + 3.5, y + 0.7, z + 2.6, at(hide, 1));
}

/**
 * El pesebre del recibidor (2x1 tiles a lo largo de x) con las primeras `figuras` figuras de la novena:
 * 1 el establo, 2 la Virgen, 3 San José, 4 la mula, 5 el buey, 6 los pastores, 7 la estrella, 8 los Reyes
 * y 9 el Niño en su pesebrito. Sin figuras queda el tablado con musgo y el laguito de espejo.
 */
export function pesebreSprite(figuras: number): Sprite {
  const n = Math.max(0, Math.min(9, Math.floor(figuras)));
  const s = scene(2, 1, 30, 6);
  s.shadow(0.5, 1.5, 31, 13.5, 0.3);
  // El tablado de madera y el musgo encima (con briznas de paja), y el laguito de espejo adelante a la izquierda.
  s.box(1, 2, 0, 30, 12, 2, null, flatT(at(C.wood, 2)), flatT(at(C.wood, 1)));
  s.box(1, 2, 2, 30, 12, 0.6, (u, v) => (noise(Math.floor(u * 2), Math.floor(v * 2), 4) > 0.82 ? at(STRAW, 4) : at(MOSS, 2.6 + noise(Math.floor(u), Math.floor(v), 9) * 1.8)), flatT(at(MOSS, 2)), flatT(at(MOSS, 1)));
  s.disc(5.5, 10.5, 2.7, 2.6, (dx, dy) => (dx * dx + dy * dy > 4.4 ? at(C.stone, 4) : at(C.sky, dx - dy > 0.6 ? 4 : 2)));
  // Unas piedritas y matas de musgo por el borde.
  for (const [x, y, k] of [[3, 3, 0], [28, 4, 1], [29, 12, 2], [2, 7, 3]] as const) ball(s, x, y, 3, 0.9, (luz) => at(k % 2 ? C.stone : MOSS, 3 + luz));

  if (n >= 1) {
    // El establo: pared de tablas atrás, dos postes y un alero de paja que baja hacia adelante (corto, para
    // que se vean las figuras desde arriba).
    s.box(8, 2, 2.6, 16, 1.2, 12, flatT(at(C.logs, 4)), (u, v) => at(C.logs, Math.floor(u) % 3 === 0 ? 2 : 3 + (v > 10 ? -1 : 0)), flatT(at(C.logs, 2)));
    for (const px of [8.2, 22.8]) s.solid(px, 6, 2.6, 1, 1, 9.5, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
    for (let k = 0; k <= 1; k += 0.1) s.box(7.5, 1.4 + k * 4.2, 14 - k * 2.6, 17, 0.7, 0.8, (u) => at(STRAW, 3 + (Math.floor(u) % 2) + (k < 0.5 ? 0.5 : -0.3)), flatT(at(STRAW, 2)), flatT(at(STRAW, 2)));
    // Paja en el piso del establo.
    for (let k = 0; k < 18; k++) s.plot(10 + noise(k, 1, 7) * 12, 3.6 + noise(k, 2, 7) * 4, 2.8, at(STRAW, 3 + noise(k, 3, 7) * 2));
  }
  // La Virgen (manto azul) y San José (café, con su bastón), a los lados del centro.
  if (n >= 2) figurine(s, 13, 8.4, 2.6, C.blue, { veil: C.sky });
  if (n >= 3) figurine(s, 19.6, 8.4, 2.6, C.logs, { staff: true, h: 6.6 });
  // La mula (gris) y el buey (café con cachos), echados atrás.
  if (n >= 4) animal(s, 10.4, 4.4, 2.6, C.stone, false);
  if (n >= 5) animal(s, 18.6, 4.2, 2.6, C.wood, true);
  if (n >= 6) {
    // Dos pastores con ruana y una ovejita, adelante a la izquierda.
    figurine(s, 3.5, 5.5, 2.6, C.rug, { h: 5, staff: true });
    figurine(s, 6, 4, 2.6, C.mustard, { h: 5 });
    ball(s, 8.5, 12.5, 4, 1.4, (luz) => at(C.white, 3 + luz), 1.1);
    s.plot(9.8, 12.8, 4.3, at(C.woodDark, 1));
  }
  if (n >= 7) {
    // La estrella, en un alambre sobre el techo.
    for (let z = 15; z < 22; z += 0.4) s.plot(16, 2.6, z, at(C.metal, 3));
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5)
      for (let r = 0; r < 2.6; r += 0.3) s.plot(16 + Math.cos(a) * r * 0.5, 2.6 - Math.cos(a) * r * 0.5, 23 + Math.sin(a) * r, at(C.gold, r < 1 ? 5 : 4));
    ball(s, 16, 2.6, 23, 0.8, () => at(C.gold, 5));
  }
  if (n >= 8) {
    // Los tres Reyes Magos llegando por la derecha: rojo, morado y verde, con coronas.
    figurine(s, 26, 7, 2.6, C.rug, { crown: true, h: 6.2 });
    figurine(s, 28.4, 9.6, 2.6, C.violet, { crown: true, h: 6.4 });
    figurine(s, 26.6, 12, 2.6, C.green, { crown: true, h: 6 });
  }
  if (n >= 9) {
    // El Niño en su pesebrito de paja, al centro entre la Virgen y San José.
    s.solid(15, 10, 2.6, 3.4, 2.2, 1.6, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
    for (let k = 0; k < 10; k++) s.plot(15.2 + noise(k, 4, 2) * 3, 10.1 + noise(k, 5, 2) * 2, 4.4, at(STRAW, 4));
    ball(s, 16.7, 11.1, 5, 0.9, (luz) => at(SKIN, 4 + luz));
    s.box(15.6, 10.5, 4.3, 1.8, 1.3, 0.7, flatT(at(C.white, 4)), flatT(at(C.white, 3)), flatT(at(C.white, 2)));
  }
  return s.sprite();
}

// ---------- El árbol, el arco de luces y la corona ----------

/** El árbol de Navidad en su matera roja: tres faldas de pino, bolas de colores y la estrella. */
function arbolNavidad(night: boolean): Sprite {
  const s = scene(1, 1, 44, 6);
  s.roundShadow(8, 8.5, 6, 0.28);
  s.cylinder(8, 8, 0, 3.4, 4, (_a, _v, luz) => at(C.rug, 3 + luz));
  s.disc(8, 8, 4, 3.4, () => at(C.dirt, 2));
  s.cylinder(8, 8, 4, 1, 3, (_a, _v, luz) => at(C.logs, 3 + luz));
  const tiers: [number, number, number][] = [
    [7, 7.2, 12],
    [15, 5.6, 11],
    [22, 4, 10],
  ];
  for (const [z, r, h] of tiers) s.cone(8, 8, z, r, h, (a, sl, luz) => at(PINE, 2.6 + luz * 1.6 + (Math.floor(a * 3 + sl) % 3 === 0 ? -0.6 : 0)));
  // Las bolas (y las lucecitas, que de noche brillan).
  let k = 0;
  for (const [z, r, h] of tiers)
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 4 + (i / 6) * Math.PI * 1.1 + z;
      const t = 0.25 + noise(i, z, 3) * 0.4;
      const rr = r * (1 - t) + 0.4;
      const bulb = BULBS[k++ % BULBS.length]!;
      const col = night ? bulb[1]! : bulb[0]!;
      ball(s, 8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr, z + h * t, 0.7, (luz) => (night ? col : at([bulb[0]!, bulb[1]!], luz > 0.2 ? 1 : 0)));
    }
  // La estrella de la punta.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) for (let r = 0; r < 2.4; r += 0.3) s.plot(8 + Math.cos(a) * r * 0.5, 8 - Math.cos(a) * r * 0.5, 33.5 + Math.sin(a) * r, at(C.gold, night ? 5 : 4));
  ball(s, 8, 8, 33.5, 0.8, () => at(C.gold, 5));
  // Regalitos al pie.
  s.solid(2.5, 10, 0, 3, 3, 2.6, at(C.blue, 4), at(C.blue, 3), at(C.blue, 2));
  s.solid(3.6, 10, 2.6, 0.8, 3, 0.2, at(C.gold, 4), at(C.gold, 3), at(C.gold, 3));
  s.solid(11, 2.5, 0, 3, 2.5, 2.2, at(C.green, 4), at(C.green, 3), at(C.green, 2));
  return s.sprite();
}

/** Arco de alambre con una guirnalda de bombillos de colores (se pasa por debajo). */
function lucesNavidad(night: boolean): Sprite {
  const s = scene(1, 1, 34, 6);
  s.roundShadow(8, 2, 1.4, 0.24);
  s.roundShadow(8, 14, 1.4, 0.24);
  // Los dos postes, cada uno con su base.
  for (const y of [2, 14]) {
    s.solid(7, y - 1, 0, 2, 2, 1.2, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
    s.solid(7.6, y - 0.4, 1.2, 0.8, 0.8, 18, at(C.logs, 4), at(C.logs, 3), at(C.logs, 2));
  }
  // El arco: medio círculo en el plano y-z, envuelto en ramas de pino.
  let k = 0;
  for (let t = 0; t <= Math.PI; t += 0.035) {
    const y = 8 - Math.cos(t) * 6;
    const z = 19 + Math.sin(t) * 9;
    s.plot(8, y, z, at(PINE, 3 + noise(Math.floor(t * 30), 1, 5) * 2));
    s.plot(8.4, y + 0.3, z + 0.4, at(PINE, 2 + noise(Math.floor(t * 30), 2, 5) * 2));
    // Un bombillo cada tanto.
    if (Math.floor(t / 0.24) !== Math.floor((t - 0.035) / 0.24)) {
      const bulb = BULBS[k++ % BULBS.length]!;
      ball(s, 8.6, y, z - 0.9, 0.55, () => (night ? bulb[1]! : bulb[0]!));
    }
  }
  // El moño rojo arriba.
  ball(s, 8.8, 8, 28.2, 1.1, (luz) => at(C.rug, 3 + luz));
  for (const dy of [-1.6, 1.6]) ball(s, 8.8, 8 + dy, 28.4, 0.8, (luz) => at(C.rug, 3 + luz));
  return s.sprite();
}

/** La corona de Navidad en su atril de madera: ramas, bayitas rojas y un moño. */
function guirnalda(): Sprite {
  const s = scene(1, 1, 32, 6);
  s.shadow(4, 4, 8, 8, 0.26);
  // El atril: dos patas adelante y una atrás.
  for (const [x, y] of [
    [5, 4],
    [5, 12],
  ] as const)
    for (let z = 0; z < 22; z += 0.4) s.plot(x + z * 0.08, y, z, at(C.logs, 3));
  for (let z = 0; z < 22; z += 0.4) s.plot(11 - z * 0.15, 8, z, at(C.logs, 2));
  // La corona: un anillo de ramas en el plano y-z, mirando a +x.
  for (let a = 0; a < Math.PI * 2; a += 0.05)
    for (let r = 4.2; r < 6.4; r += 0.5) {
      const y = 8 + Math.cos(a) * r;
      const z = 19 + Math.sin(a) * r;
      const luz = -Math.sin(a) * 0.4 + Math.cos(a) * 0.3;
      s.plot(7.4 + noise(Math.floor(a * 20), Math.floor(r * 2), 3) * 0.8, y, z, at(PINE, 2.6 + luz + noise(Math.floor(a * 9), Math.floor(r), 8) * 1.4));
    }
  // Bayitas rojas y piñitas.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    ball(s, 8.4, 8 + Math.cos(a) * 5.2, 19 + Math.sin(a) * 5.2, 0.55, () => at(C.rug, i % 3 === 0 ? 4 : 3));
  }
  // El moño rojo abajo, con sus dos colas.
  ball(s, 8.6, 8, 13.6, 1.1, (luz) => at(C.rug, 3 + luz));
  for (const dy of [-1.5, 1.5]) ball(s, 8.6, 8 + dy, 13.8, 0.9, (luz) => at(C.rug, 3 + luz));
  for (const dy of [-0.7, 0.7]) for (let z = 10; z < 13; z += 0.4) s.plot(8.6, 8 + dy * (1 + (13 - z) * 0.3), z, at(C.rug, 2));
  return s.sprite();
}

export const NOVENAS_DRAW: Record<string, () => Sprite> = {
  // El pesebre completo (el del editor y la vista previa); en el juego se arma de a una figura (pesebreSprite).
  pesebre: () => pesebreSprite(9),
  guirnalda,
};

/** Lo que de noche se prende (va en OUTDOOR de outdoor.ts, que dibuja día y noche). */
export const NOVENAS_NIGHT: Record<string, (night: boolean) => Sprite> = {
  "arbol-navidad": arbolNavidad,
  "luces-navidad": lucesNavidad,
};
