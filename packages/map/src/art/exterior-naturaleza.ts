// Naturaleza del jardín: robles, pinos, abedules, frutales, arbustos, flores, helechos, hongos, rocas,
// troncos y lo del lago (juncos, nenúfares, la piedra plana). Coordenadas locales de arte (tile = 16).
// Los árboles, las matas, el helecho, el pasto alto y las flores silvestres ya están dibujados a mano
// (jardin-arboles.ts y jardin-matas.ts, docs/arte/estandar-arte.md); lo demás sigue armado con primitivas y
// se va pasando a grillas en las tandas de docs/arte/auditoria-arte.md. `canopy` lo usan todavía el bosque de
// alrededor y la casa del árbol.
import { Escena } from "./exterior-escena";
import { flatRockSprite, lilyPadsSprite, mediumRockSprite, mossyRockSprite, mushroomsSprite, smallRockSprite, stumpSprite } from "./jardin-detalles";
import { berryBushSprite, bushSprite, fernSprite, hydrangeaSprite, roseBushSprite, tallGrassSprite, wildflowersSprite } from "./jardin-matas";
import { flowerPatchSprite } from "./jardin-tanda3";
import { bigOakSprite, birchSprite, birchSpriteB, blossomTreeSprite, fruitTreeSprite, oakSprite, pineSprite, shortPineSprite, tallOakSprite, tallPineSprite, wideOakSprite } from "./jardin-arboles";
import { blob } from "./kit";
import { C, mix } from "./palette";
import { PixelCanvas, alpha, at, bayer, noise, smoothNoise, type Ramp, type Sprite } from "./pixel";

/** Rampa mezclada entre dos de la paleta (variantes de follaje sin inventar colores nuevos). */
export const blend = (a: Ramp, b: Ramp, t: number): Ramp => a.map((c, i) => mix(c, b[Math.min(i, b.length - 1)]!, t));

export const LEAF = C.leaf;
export const LEAF_OLIVE = blend(C.leaf, C.mustard, 0.28);
export const LEAF_DEEP = blend(C.leaf, C.green, 0.45);
export const LEAF_BIRCH = blend(C.leaf, C.gold, 0.22);
/** Rampa del cerezo en flor. */
const BLOSSOM = blend(C.rose, C.white, 0.35);

/** Escena para un objeto de w x d tiles con margen alrededor y alto `h`. */
const scene = (w: number, d: number, h: number, pad = 14) => new Escena({ x0: -pad, y0: -pad, z0: 0, x1: w * 16 + pad, y1: d * 16 + pad, z1: h }, 2);

// ---------- Follaje ----------

export interface CanopyOpts {
  /** Centro de la copa en pantalla (px del lienzo) y radios. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  ramp: Ramp;
  seed: number;
  /** Cantidad de montoncitos de hojas. */
  clumps?: number;
  /** Tamaño de cada montoncito. */
  size?: [number, number];
  /** Tono base (sube = más clara). */
  base?: number;
}

/**
 * Copa de árbol: montoncitos redondos de hojas repartidos en una elipse, pintados de atrás hacia
 * adelante; cada uno se sombrea con su propia luz y con la de la copa entera, así queda el borde
 * festoneado y el volumen. Devuelve dónde quedó cada montoncito (para poner frutas o flores).
 */
export function canopy(c: PixelCanvas, o: CanopyOpts): [number, number, number][] {
  const n = o.clumps ?? Math.round((o.rx * o.ry) / 9);
  const [s0, s1] = o.size ?? [3.5, 6];
  const base = o.base ?? 2.7;
  const clumps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = noise(i, 1, o.seed) * Math.PI * 2;
    const d = Math.sqrt(noise(i, 2, o.seed));
    const r = s0 + noise(i, 3, o.seed) * (s1 - s0);
    clumps.push([o.cx + Math.cos(a) * d * (o.rx - r * 0.6), o.cy + Math.sin(a) * d * (o.ry - r * 0.5), r]);
  }
  // Un montoncito central grande que tapa los huecos.
  clumps.push([o.cx, o.cy + o.ry * 0.1, Math.min(o.rx, o.ry) * 0.75]);
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of clumps) {
    blob(c, x, y, r, r * 0.88, (nx, ny, px, py) => {
      const gl = -(((x - o.cx) / o.rx) * 0.55 + ((y - o.cy) / o.ry) * 0.85);
      const ll = -(nx * 0.45 + ny * 0.85);
      const t = base + gl * 1.05 + ll * 1.35 + (bayer(px, py) - 0.5) * 0.35;
      // Borde de abajo del montoncito más oscuro: separa las hojas de las de atrás.
      const rim = ny > 0.72 ? -0.8 : 0;
      return at(o.ramp, t + rim);
    });
  }
  // Hojitas sueltas claras en la parte iluminada y oscuras abajo.
  for (let i = 0; i < n * 1.4; i++) {
    const a = noise(i, 5, o.seed) * Math.PI * 2;
    const d = Math.sqrt(noise(i, 6, o.seed)) * 0.95;
    const x = Math.round(o.cx + Math.cos(a) * d * o.rx);
    const y = Math.round(o.cy + Math.sin(a) * d * o.ry);
    if (c.alphaAt(x, y) === 0) continue;
    const up = Math.cos(a) * 0.5 + Math.sin(a) * 0.8 < 0;
    c.set(x, y, at(o.ramp, up ? 5 : 1));
    if (up && noise(i, 7, o.seed) < 0.5) c.set(x + 1, y, at(o.ramp, 4));
  }
  return clumps;
}

// ---------- Arbustos, flores y hongos ----------

// ---------- Rocas ----------

/**
 * Roca facetada: una elipse en pantalla dividida en caras (celdas de Voronoi) con tono según hacia
 * dónde mira cada cara; `moss` cubre de verde las caras de arriba.
 */
function rockShape(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, seed: number, moss = 0) {
  const facets: [number, number][] = [];
  for (let i = 0; i < 7; i++) facets.push([(noise(i, 1, seed) - 0.5) * 1.6, (noise(i, 2, seed) - 0.5) * 1.4]);
  facets.push([-0.35, -0.45], [0.4, 0.3], [0, 0.6]);
  blob(c, cx, cy, rx, ry, (nx, ny, px, py) => {
    // Borde irregular.
    if (nx * nx + ny * ny > 0.82 + noise(Math.floor(Math.atan2(ny, nx) * 5), 0, seed) * 0.18) return null;
    let best = 0;
    let bd = Infinity;
    facets.forEach(([fx, fy], i) => {
      const d = (nx - fx) ** 2 + (ny - fy) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    const [fx, fy] = facets[best]!;
    // Luz de la cara: arriba a la izquierda clara, abajo a la derecha oscura.
    const light = -(fx * 0.7 + fy * 1.0);
    let tone = 3 + Math.round(light * 1.6);
    if (ny > 0.62) tone = Math.min(tone, 2);
    if (moss && fy < -0.1 && noise(px >> 1, py >> 1, seed + 4) < moss + 0.3) return at(C.sage, Math.max(2, Math.min(5, tone + (bayer(px, py) < 0.3 ? 1 : 0))));
    if (noise(px, py, seed + 7) < 0.04) tone -= 1;
    return at(C.stone, Math.max(1, Math.min(5, tone)));
  });
}

function boulder(seed: number): Sprite {
  const s = scene(2, 2, 40, 6);
  s.roundShadow(17, 17, 14, 0.3);
  const q = s.p(16, 16, 0);
  rockShape(s.canvas, q.x - 5, q.y - 14, 17, 14, seed, 0.25);
  rockShape(s.canvas, q.x + 12, q.y - 6, 10, 8, seed + 3, 0.1);
  rockShape(s.canvas, q.x - 16, q.y - 2, 5, 3.5, seed + 5);
  return s.sprite();
}

// ---------- Troncos ----------

/** Tronco caído a lo largo de y, con la punta cortada mirando al frente, musgo y un hongo. */
function fallenLog(seed: number): Sprite {
  const s = scene(1, 3, 20, 4);
  s.shadow(2, 2, 13, 45, 0.25);
  const r = 5;
  const cx = 8;
  const cz = r;
  // Corteza: se recorre el ángulo de la mitad visible y el largo.
  for (let y = 3; y < 45; y += 0.4)
    for (let a = -Math.PI / 4 - 0.2; a <= (3 * Math.PI) / 4 + 0.2; a += 0.08) {
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const luz = nz * 0.7 - nx * 0.3;
      const groove = Math.floor(y / 2.5 + noise(Math.floor(a * 5), 1, seed) * 3) % 4 === 0;
      let col = at(C.logs, (luz > 0.4 ? 3 : luz > -0.2 ? 2 : 1) - (groove ? 1 : 0));
      if (nz > 0.55 && smoothNoise(y, a * 6, 5, seed) > 0.55) col = at(C.sage, luz > 0.6 ? 4 : 3);
      s.plot(cx + nx * r, y, cz + nz * r, col);
    }
  // Punta cortada con anillos (cara +y).
  s.quad([cx - r, 45, cz - r], [1, 0, 0], [0, 0, 1], r * 2, r * 2, (u, v) => {
    const d = Math.hypot(u - r, v - r);
    if (d > r) return null;
    if (d > r - 1) return at(C.logs, 1);
    return at(C.logs, Math.floor(d * 1.3) % 2 ? 4 : 5);
  });
  // Ramita y un hongo.
  s.solid(12, 18, 7, 6, 1.5, 1.5, at(C.logs, 3), at(C.logs, 2), at(C.logs, 1));
  s.cylinder(9, 30, cz + r - 1, 0.6, 2, () => at(C.cream, 4));
  s.disc(9, 30, cz + r + 1, 1.8, (dx, dy) => at(C.mustard, dx + dy < 0 ? 4 : 3));
  return s.sprite();
}

// ---------- Lago ----------

/** Juncos y totoras en el agua: hojas altas, espigas cafés y los anillos del agua en la base. */
function reeds(seed: number): Sprite {
  const s = scene(1, 1, 34, 8);
  const b = s.p(8, 8, 0);
  // En el agua (sin contorno, debajo): la sombra oscura de la mata y dos ondas claras cortadas, así los
  // juncos salen del agua y no flotan como un recorte de base recta.
  s.suelo.ellipse(b.x, b.y + 0.5, 9, 3.4, alpha(C.sky[0]!, 0.5));
  const ring = (rx: number, ry: number, from: number, to: number, a: number) => {
    for (let t = from; t <= to; t += 0.04) {
      if (noise(Math.floor(t * 9), Math.floor(rx), seed) < 0.22) continue;
      s.suelo.set(Math.round(b.x + Math.cos(t) * rx), Math.round(b.y + 0.5 + Math.sin(t) * ry), alpha(C.sky[4]!, a));
    }
  };
  ring(10.5, 3.9, -0.3, Math.PI + 0.3, 0.85);
  ring(14, 5.4, 0.35, Math.PI - 0.35, 0.55);
  const blades = 14;
  const stalks: [number, number, number, number][] = [];
  for (let i = 0; i < blades; i++) {
    const x = b.x + (noise(i, 1, seed) - 0.5) * 16;
    const y = b.y + (noise(i, 2, seed) - 0.5) * 5;
    const h = 12 + noise(i, 3, seed) * 16;
    const lean = (noise(i, 4, seed) - 0.5) * 6;
    stalks.push([x, y, h, lean]);
  }
  stalks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, h, lean] of stalks) {
    // El pie de cada hoja queda bajo el agua: translúcido y en el suelo (sin la raya del contorno).
    for (let k = 0; k < 2; k += 0.5) s.suelo.set(x, y - k, alpha(C.green[1]!, 0.55));
    for (let k = 2; k < h; k += 0.5) {
      const t = k / h;
      s.canvas.set(x + lean * t * t, y - k, at(C.green, t > 0.7 ? 4 : lean > 0 ? 2 : 3));
      if (t < 0.5) s.canvas.set(x + lean * t * t + 1, y - k, at(C.green, 2));
    }
    // Espiga de totora en algunas.
    if (h > 20 && noise(Math.floor(x), Math.floor(y), seed) < 0.6) {
      const tx = x + lean * 0.8;
      const ty = y - h * 0.85;
      for (let k = 0; k < 5; k++) {
        s.canvas.set(tx, ty - k, at(C.logs, k < 1 ? 1 : 2));
        s.canvas.set(tx + 1, ty - k, at(C.logs, k < 1 ? 0 : 1));
      }
      s.canvas.set(tx, ty - 6, at(C.logs, 3));
    }
  }
  return s.sprite();
}

// ---------- Registro ----------


export const NATURE_DRAW: Record<string, () => Sprite> = {
  "oak-1": () => oakSprite(LEAF),
  "oak-2": () => wideOakSprite(LEAF_DEEP),
  "oak-3": () => tallOakSprite(LEAF_OLIVE),
  "oak-big": () => bigOakSprite(LEAF_DEEP),
  "pine-1": () => pineSprite(C.green),
  "pine-2": () => shortPineSprite(blend(C.green, C.leaf, 0.3)),
  "pine-3": () => tallPineSprite(blend(C.green, C.navy, 0.15)),
  "birch-1": () => birchSprite(LEAF_BIRCH),
  "birch-2": () => birchSpriteB(LEAF_BIRCH),
  "apple-tree": () => fruitTreeSprite(LEAF, at(C.rug, 3)),
  "peach-tree": () => fruitTreeSprite(LEAF_OLIVE, at(C.fire, 3)),
  "cherry-tree": () => blossomTreeSprite(BLOSSOM),
  "bush-rose": () => roseBushSprite(LEAF_DEEP, at(C.rug, 4)),
  "bush-hydrangea": () => hydrangeaSprite(LEAF, at(C.blue, 3)),
  "bush-berry": () => berryBushSprite(LEAF_DEEP, at(C.violet, 3)),
  "bush-round": () => bushSprite(LEAF),
  "flower-patch": flowerPatchSprite,
  wildflowers: wildflowersSprite,
  fern: () => fernSprite(LEAF),
  "tall-grass": tallGrassSprite,
  mushrooms: mushroomsSprite,
  "rock-small": smallRockSprite,
  "rock-medium": mediumRockSprite,
  "rock-mossy": mossyRockSprite,
  boulder: () => boulder(124),
  "flat-rock": flatRockSprite,
  "fallen-log": () => fallenLog(131),
  stump: stumpSprite,
  reeds: () => reeds(141),
  "lily-pad": lilyPadsSprite,
};
