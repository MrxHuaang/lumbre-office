// El acuario grande de la sala: un tanque largo con marco de madera sobre un mueble de puertas, arena,
// piedras, algas y burbujas. Los peces NO van en el dibujo: son capas que nadan encima (el cliente las
// mueve dentro de `ACUARIO_SWIM`) y salen del álbum del equipo. Cada pez es el mismo dibujo del álbum
// (`drawFish` de fish.ts) achicado a la mitad, con un toque del color del agua para que se vea adentro.
import { drawFish } from "./fish";
import { shadowUnder } from "./kit";
import { C, OUT, mix } from "./palette";
import { PixelCanvas, alpha, at, flat, noise, renderSprite, solidBox, type RGBA, type Shader, type Sprite } from "./pixel";

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** El tanque (agua) en coordenadas locales de arte, mirando hacia +x: 1 tile de ancho y 4 de largo. */
const TANK = { x0: 2, x1: 14, y0: 2, y1: 62, z0: 11.5, z1: 29 };
const SAND_H = 2.6;

/**
 * Por dónde nadan los peces (centro del pez, coordenadas locales de arte): lejos del vidrio del frente y
 * de los bordes, entre la arena y la superficie. El cliente reparte los peces en profundidades distintas.
 */
export const ACUARIO_SWIM = { x0: 9, x1: 12, y0: 9, y1: 52, z0: 13, z1: 19 } as const;

/** Agua vista por el vidrio: más clara arriba, rayos de luz inclinados y un reflejo del vidrio. */
const water =
  (glass: boolean): Shader =>
  (u, v, fw, fh) => {
    const depth = 1 - v / fh;
    if (v >= fh - 0.9) return at(C.screen, 5);
    // Reflejo del vidrio del frente (dos rayas diagonales).
    if (glass && (Math.abs(mod(u - v * 0.8, 26) - 4) < 0.55 || Math.abs(mod(u - v * 0.8, 26) - 6.2) < 0.35)) return alpha(at(C.white, 4), 0.55);
    // Rayos de luz desde la superficie.
    if (mod(u * 0.7 + v * 1.1, 11) < 1) return mix(at(C.screen, 4), at(C.screen, 3), depth);
    return at(C.screen, depth < 0.3 ? 4 : depth < 0.65 ? 3 : 2);
  };

/** Arena del fondo, teñida por el agua (más desde arriba que por el vidrio). */
const sand =
  (tint: number): Shader =>
  (u, v) => {
    const n = noise(Math.floor(u * 1.5), Math.floor(v * 1.5), 23);
    const c = n < 0.05 ? at(C.rug, 4) : n < 0.12 ? at(C.stone, 4) : at(C.cream, n < 0.5 ? 3 : 4);
    return mix(c, at(C.screen, 3), tint);
  };

/** Borde de madera de arriba: solo el marco (adentro se ve el agua). */
const rimTop: Shader = (u, v, fw, fh) => (u < 1.1 || v < 1.1 || u >= fw - 1.1 || v >= fh - 1.1 ? at(C.wood, 4) : null);

/** Puertas del mueble (cara +x): tres, con marco, tablas y tirador de bronce; una placa en la del medio. */
const doors: Shader = (u, v, fw, fh) => {
  if (u < 0.9 || u >= fw - 0.9 || v < 0.9 || v >= fh - 1.2) return at(C.woodDark, 3);
  const w = (fw - 1.8) / 3;
  const k = Math.floor((u - 0.9) / w);
  const lu = u - 0.9 - k * w;
  if (lu < 0.8 || lu > w - 0.8) return at(C.woodDark, 2);
  if (v > fh - 2.4) return at(C.woodDark, 5);
  // Tirador y la placa de bronce de la puerta del medio.
  if (Math.abs(lu - (k === 2 ? 2 : w - 2)) < 0.6 && Math.abs(v - 5.5) < 1) return at(C.gold, 4);
  if (k === 1 && Math.abs(lu - w / 2) < 3.2 && Math.abs(v - 7) < 1) return Math.abs(lu - w / 2) < 2.4 && Math.floor(lu) % 2 === 0 ? at(C.gold, 2) : at(C.gold, 3);
  return at(C.woodDark, Math.floor(v) % 3 === 0 ? 3 : 4);
};

/** El acuario grande (mueble del catálogo `acuario`), sin peces. */
export function acuario(): Sprite {
  const { x0, x1, y0, y1, z0, z1 } = TANK;
  const post = (x: number, y: number) => solidBox({ x, y, z: z0 - 1, w: 1.3, d: 1.3, h: z1 - z0 + 2.4 }, C.wood, 3);
  return renderSprite(
    [
      // El mueble con puertas.
      { x: 1, y: 1, z: 0, w: 14, d: 62, h: 10, top: flat(at(C.woodDark, 5)), left: flat(at(C.woodDark, 3)), right: doors },
      // Base del tanque (madera) y el agua.
      solidBox({ x: 1.5, y: 1.5, z: 10, w: 13, d: 61, h: 1.5 }, C.wood, 3),
      { x: x0, y: y0, z: z0, w: x1 - x0, d: y1 - y0, h: z1 - z0, top: (u, v) => (noise(Math.floor(u / 2), Math.floor(v), 9) < 0.14 ? at(C.screen, 5) : at(C.screen, 4)), left: water(false), right: water(true) },
      { x: x0, y: y0, z: z0, w: x1 - x0, d: y1 - y0, h: SAND_H, top: sand(0.35), left: sand(0.15), right: sand(0.15) },
    ],
    {
      outline: OUT,
      under: shadowUnder(1, 1, 14, 62),
      pad: 2,
      extra: (c, p) => {
        // Algas que se mecen (de fondo a frente para que se tapen bien).
        const weeds: [number, number, number, number][] = [
          [4, 4, 11, 0],
          [4, 7, 8, 1],
          [5, 22, 12, 2],
          [4, 25, 7, 3],
          [4, 44, 13, 4],
          [6, 47, 9, 5],
          [4, 58, 10, 8],
          [11, 13, 6, 6],
          [12, 36, 5, 7],
        ];
        for (const [x, y, h, s] of weeds) {
          const b = p(x, y, z0 + SAND_H);
          for (let k = 0; k < h; k++) {
            const dx = Math.round(Math.sin(k * 0.6 + s) * 1.1);
            c.set(b.x + dx, b.y - k, at(C.leaf, k % 3 === 0 ? 4 : 3));
            if (k % 3 === 1) c.set(b.x + dx + (s % 2 ? 1 : -1), b.y - k, at(C.leaf, 2));
          }
        }
        // Burbujas del aireador (punta derecha del tanque).
        for (let k = 0; k < 6; k++) {
          const q = p(7, 55, z0 + SAND_H + 1.5 + k * 2.3);
          c.set(q.x + (k % 2), q.y, alpha(at(C.white, 4), 0.85));
        }
        // Una conchita y un caracol en la arena.
        const shell = p(12, 30, z0 + SAND_H);
        c.set(shell.x, shell.y, at(C.rose, 5));
        c.set(shell.x + 1, shell.y, at(C.rose, 4));
        const snail = p(12.5, 9, z0 + SAND_H);
        c.set(snail.x, snail.y - 1, at(C.gold, 4));
        c.set(snail.x + 1, snail.y - 1, at(C.gold, 3));
        c.set(snail.x - 1, snail.y, at(C.cream, 4));
      },
      overlay: [
        // Piedras de río y un tronquito hundido.
        solidBox({ x: 3, y: 12, z: z0 + SAND_H, w: 4, d: 5, h: 3 }, C.stone, 3),
        solidBox({ x: 4, y: 16.5, z: z0 + SAND_H, w: 2.5, d: 2.5, h: 1.8 }, C.stone, 4),
        solidBox({ x: 3, y: 33, z: z0 + SAND_H, w: 3, d: 4, h: 2.2 }, C.stone, 2),
        solidBox({ x: 3, y: 50, z: z0 + SAND_H, w: 3.5, d: 3.5, h: 2.6 }, C.stone, 3),
        { x: 8, y: 38, z: z0 + SAND_H, w: 2.2, d: 7, h: 2.2, top: flat(at(C.logs, 4)), left: (u) => (Math.floor(u) % 2 ? at(C.logs, 2) : at(C.logs, 3)), right: flat(at(C.logs, 2)) },
        // Marco de madera: postes en las esquinas que se ven y el borde de arriba.
        post(x1 - 0.6, y0 - 0.6),
        post(x0 - 0.6, y1 - 0.7),
        post(x1 - 0.6, y1 - 0.7),
        { x: 1.4, y: 1.4, z: z1, w: 13.2, d: 61.2, h: 1.6, top: rimTop, left: flat(at(C.wood, 3)), right: flat(at(C.wood, 2)) },
        // La lámpara del acuario: una regleta de bronce sobre el borde del fondo.
        solidBox({ x: 2.5, y: 8, z: z1 + 1.6, w: 1.6, d: 48, h: 1.2 }, C.gold, 3),
      ],
    },
  );
}

// ---------- Los peces chicos ----------

/** Tamaño de un pez del acuario (el del álbum a la mitad, más el contorno). */
export const MINI_FISH_W = 15;
export const MINI_FISH_H = 11;

const same = (d: Uint8ClampedArray, i: number, c: RGBA) => d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2];

/**
 * El pez del álbum achicado a la mitad: por cada bloque de 2x2 gana el color más repetido del cuerpo (el
 * contorno no cuenta, salvo los píxeles oscuros de adentro: el ojo); el brillo de la rareza se deja
 * afuera, y al final se le vuelve a poner el contorno. `frame` 1 mueve la cola (el aleteo).
 */
export function miniFish(id: string, rarity: string, frame = 0): PixelCanvas {
  const src = drawFish(id, rarity);
  const d = src.data;
  const opaque = (x: number, y: number) => src.alphaAt(x, y) >= 200;
  const out = new PixelCanvas(MINI_FISH_W, MINI_FISH_H);
  const tw = Math.ceil(src.width / 2);
  const th = Math.ceil(src.height / 2);
  // Columna donde está la cola (la mitad izquierda del cuerpo: los peces miran a la derecha).
  let minX = tw;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (opaque(x, y)) minX = Math.min(minX, Math.floor(x / 2));
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++) {
      const votes = new Map<string, { c: RGBA; n: number; eye: boolean }>();
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const x = tx * 2 + dx;
          const y = ty * 2 + dy;
          if (!opaque(x, y)) continue;
          const i = (y * src.width + x) * 4;
          const inner = opaque(x + 1, y) && opaque(x - 1, y) && opaque(x, y + 1) && opaque(x, y - 1);
          if (same(d, i, OUT) && !inner) continue;
          const c: RGBA = [d[i]!, d[i + 1]!, d[i + 2]!, 255];
          const key = c.join(",");
          const v = votes.get(key) ?? { c, n: 0, eye: same(d, i, OUT) };
          v.n++;
          votes.set(key, v);
        }
      if (votes.size === 0) continue;
      const pick = [...votes.values()].sort((a, b) => Number(b.eye) - Number(a.eye) || b.n - a.n)[0]!;
      // El aleteo: la cola (las dos primeras columnas) sube un píxel.
      const lift = frame === 1 && tx - minX < 2 ? -1 : 0;
      out.set(tx + 1, ty + lift + 1,pick.eye ? pick.c : mix(pick.c, at(C.screen, 3), 0.18));
    }
  out.outline(mix(OUT, at(C.screen, 1), 0.3), 120);
  return out;
}

/** Una burbuja que sube (2x2). */
export function aquariumBubble(): PixelCanvas {
  const c = new PixelCanvas(3, 3);
  c.set(1, 0, alpha(at(C.white, 4), 0.9));
  c.set(0, 1, alpha(at(C.white, 4), 0.7));
  c.set(2, 1, alpha(at(C.screen, 5), 0.8));
  c.set(1, 2, alpha(at(C.screen, 5), 0.8));
  return c;
}
