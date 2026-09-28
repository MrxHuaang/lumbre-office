// El camino de la pantalla de carga, dibujado por código con el motor pixel: tiras que se repiten de lado
// (nubes, colinas, árboles, sendero y cerca) para el parallax, la cabaña con su puerta y lo que cae según
// la estación. Todo con el tono del momento del día (de noche, oscuro y con los faroles y las ventanas
// prendidos). Solo en el navegador; cada pieza se dibuja una vez al montar (unos milisegundos).
import { at, C, fallingLeaf, fallingPetal, flowerTuft, hex, leafLitter, mix, noise, OUT, PixelCanvas, ramp, snowflake, snowPatch, type Ramp, type RGBA } from "@hyvento/map/art";
import type { Season, SkyPhase } from "@hyvento/shared";
import { toHtmlCanvas } from "@/game/iso/canvas";

/** Alto de la escena en píxeles de arte (todas las tiras miden esto). */
export const SCENE_H = 104;
/** Donde apoyan los árboles y la cabaña (el pasto de atrás del sendero). */
export const MEADOW_Y = 80;
/** Donde pisa el personaje (en el sendero). */
export const FEET_Y = 92;

export interface Mood {
  phase: SkyPhase;
  season: Season;
}

/** Una tira del paisaje: imagen, ancho (se repite cada tanto) y segundos por vuelta. */
export interface Strip {
  src: string;
  w: number;
  secs: number;
}

export interface Scenery {
  clouds: Strip;
  hills: Strip;
  trees: Strip;
  path: Strip;
  front: Strip;
  stars: string | null;
  sun: string;
  cabin: { src: string; w: number; h: number; door: string; doorX: number; doorY: number; doorW: number; doorH: number; chimneyX: number };
  /** Lo que cae (hojas, pétalos, nieve) o las luciérnagas de las noches de verano. */
  particles: { kind: "fall" | "firefly"; srcs: string[] };
}

// ---------- Tono del momento ----------

const TONES: Record<SkyPhase, { c: RGBA; t: number } | null> = {
  dia: null,
  amanecer: { c: hex("#8f78c4"), t: 0.2 },
  atardecer: { c: hex("#e0764e"), t: 0.2 },
  noche: { c: hex("#141a3c"), t: 0.58 },
};

/** Tiñe todo lo opaco con el tono del momento y encima pone las luces (que no se tiñen). */
function finish(c: PixelCanvas, phase: SkyPhase, lights?: PixelCanvas): PixelCanvas {
  const tone = TONES[phase];
  if (tone) {
    const d = c.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = Math.round(d[i]! + (tone.c[0] - d[i]!) * tone.t);
      d[i + 1] = Math.round(d[i + 1]! + (tone.c[1] - d[i + 1]!) * tone.t);
      d[i + 2] = Math.round(d[i + 2]! + (tone.c[2] - d[i + 2]!) * tone.t);
    }
  }
  if (lights) blit(c, lights, 0, 0);
  return c;
}

function blit(dst: PixelCanvas, src: PixelCanvas, x0: number, y0: number) {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3]!;
      if (a) dst.set(x0 + x, y0 + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, a]);
    }
}

/** Dibuja algo en `x` y también corrido un ancho a cada lado: la tira empalma sin costura. */
const wrap = (w: number, x: number, draw: (x: number) => void) => {
  draw(x);
  draw(x - w);
  draw(x + w);
};

const url = (c: PixelCanvas) => toHtmlCanvas(c).toDataURL();

// ---------- Colores de la estación ----------

const AUTUMN = ramp("#4a1f14", "#7a3319", "#a8501f", "#cf7429", "#e89a3e", "#f4c060");
const WINTER_PINE = ramp("#16302a", "#224538", "#2f5c48", "#437a5c", "#6a9a7a", "#a8c8b0");

function grassRamp(season: Season): Ramp {
  if (season === "otono") return C.grass.map((c, i) => mix(c, at(C.mustard, i), 0.3));
  if (season === "invierno") return C.grass.map((c, i) => mix(c, at(C.white, 2 + i * 0.4), 0.45));
  if (season === "primavera") return C.grass.map((c, i) => mix(c, at(C.leaf, i + 1), 0.25));
  return C.grass;
}

// ---------- Nubes ----------

function drawClouds(phase: SkyPhase): Strip {
  const W = 384;
  const c = new PixelCanvas(W, SCENE_H);
  const body = phase === "noche" ? hex("#6b6f9a") : phase === "dia" ? at(C.white, 4) : hex("#fbe3d2");
  const shade = phase === "noche" ? hex("#4d5180") : phase === "dia" ? at(C.blue, 5) : hex("#e9b8b0");
  const puffs: [number, number, number][] = [
    [30, 16, 1],
    [150, 26, 0.7],
    [262, 12, 1.2],
    [340, 30, 0.6],
  ];
  for (const [x0, y0, s] of puffs)
    wrap(W, x0, (x) => {
      const w = Math.round(22 * s);
      c.ellipse(x, y0 + 2, w, 4 * s + 1, shade);
      c.ellipse(x - w * 0.35, y0, w * 0.5, 4 * s + 1, body);
      c.ellipse(x + w * 0.2, y0 - 2 * s, w * 0.55, 5 * s + 1, body);
      c.rect(Math.round(x - w), Math.round(y0 + 2 + 4 * s), w * 2, 1, shade);
    });
  return { src: url(c), w: W, secs: 140 };
}

// ---------- Colinas ----------

function drawHills({ phase, season }: Mood): Strip {
  const W = 320;
  const c = new PixelCanvas(W, SCENE_H);
  const tau = Math.PI * 2;
  let far = hex("#8fb88a");
  let near = hex("#6ea456");
  if (season === "otono") {
    far = mix(far, hex("#c0a060"), 0.35);
    near = mix(near, hex("#b0803a"), 0.35);
  } else if (season === "invierno") {
    far = mix(far, hex("#eef2f6"), 0.6);
    near = mix(near, hex("#dfe8ee"), 0.5);
  } else if (season === "primavera") near = mix(near, hex("#8cc653"), 0.25);
  for (let x = 0; x < W; x++) {
    // Sumas de senos con período W: la tira empalma sola.
    const f = 50 + Math.sin((x / W) * tau * 2 + 0.6) * 6 + Math.sin((x / W) * tau * 5) * 2.5;
    const n = 62 + Math.sin((x / W) * tau * 3 + 2) * 5 + Math.sin((x / W) * tau * 7 + 1) * 1.5;
    for (let y = Math.round(f); y < MEADOW_Y; y++) c.set(x, y, y === Math.round(f) ? mix(far, at(C.white, 4), 0.25) : far);
    for (let y = Math.round(n); y < MEADOW_Y; y++) {
      const dither = (x + y) % 4 === 0 && y > n + 3;
      c.set(x, y, y === Math.round(n) ? mix(near, at(C.white, 4), 0.2) : dither ? mix(near, OUT, 0.12) : near);
    }
  }
  return { src: url(finish(c, phase)), w: W, secs: 70 };
}

// ---------- Árboles ----------

function roundTree(c: PixelCanvas, x: number, base: number, size: number, season: Season, seed: number) {
  const trunk = C.woodDark;
  c.rect(x - 2, base - 12, 4, 12, at(trunk, 3));
  c.rect(x - 2, base - 12, 1, 12, at(trunk, 4));
  const r = size;
  const cy = base - 12 - r * 0.7;
  if (season === "invierno") {
    // Pelado, con nieve en las ramas.
    c.line(x, base - 12, x - r * 0.8, cy - r * 0.4, at(trunk, 3));
    c.line(x, base - 14, x + r * 0.7, cy - r * 0.6, at(trunk, 3));
    c.line(x, base - 12, x, cy - r, at(trunk, 3));
    c.line(x - r * 0.4, cy, x - r * 0.9, cy - r * 0.9, at(trunk, 2));
    for (const [dx, dy] of [[-r * 0.8, -r * 0.4], [r * 0.7, -r * 0.6], [0, -r], [-r * 0.9, -r * 0.9]] as const) c.rect(Math.round(x + dx) - 1, Math.round(cy + dy) - 1, 3, 1, at(C.white, 4));
    return;
  }
  const leaves = season === "otono" ? AUTUMN : C.leaf;
  c.ellipse(x, cy + 1, r, r * 0.85, at(leaves, 1));
  c.ellipse(x - r * 0.25, cy - 1, r * 0.8, r * 0.7, at(leaves, 2));
  c.ellipse(x - r * 0.35, cy - r * 0.3, r * 0.5, r * 0.45, at(leaves, 3));
  for (let i = 0; i < r * 3; i++) {
    const px = x - r + noise(i, seed, 3) * r * 2;
    const py = cy - r * 0.8 + noise(seed, i, 5) * r * 1.4;
    if (c.alphaAt(Math.floor(px), Math.floor(py))) c.set(px, py, at(leaves, noise(i, i, seed) > 0.5 ? 4 : 3));
  }
  if (season === "primavera")
    for (let i = 0; i < r * 1.6; i++) {
      const px = x - r + noise(i, seed, 9) * r * 2;
      const py = cy - r * 0.8 + noise(seed, i, 11) * r * 1.5;
      if (c.alphaAt(Math.floor(px), Math.floor(py))) c.set(px, py, at(C.rose, noise(i, 2, seed) > 0.5 ? 5 : 4));
    }
}

function pine(c: PixelCanvas, x: number, base: number, h: number, season: Season) {
  const g = season === "invierno" ? WINTER_PINE : C.green;
  c.rect(x - 1, base - 5, 3, 5, at(C.woodDark, 3));
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const top = base - 5 - h + (t * h) / tiers;
    const bottom = top + h / tiers + 5;
    const half = 3 + (t + 1) * (h / 10);
    for (let y = Math.round(top); y < bottom; y++) {
      const w = ((y - top) / (bottom - top)) * half;
      for (let dx = -Math.round(w); dx <= Math.round(w); dx++) c.set(x + dx, y, at(g, dx < -w / 3 ? 3 : dx > w / 3 ? 1 : 2));
    }
    if (season === "invierno") for (let dx = -Math.round(half * 0.6); dx <= 0; dx++) c.set(x + dx, Math.round(bottom) - 1, at(C.white, 4));
  }
  if (season === "invierno") c.rect(x - 1, Math.round(base - 5 - h), 2, 2, at(C.white, 4));
}

function drawTrees({ phase, season }: Mood): Strip {
  const W = 256;
  const c = new PixelCanvas(W, SCENE_H);
  const grass = grassRamp(season);
  // El pasto de atrás del sendero, donde paran los árboles y la cabaña.
  for (let y = 70; y < MEADOW_Y + 2; y++) for (let x = 0; x < W; x++) c.set(x, y, at(grass, y < 72 ? 4 : noise(x, y, 4) > 0.85 ? 2 : 3));
  const items: [kind: "round" | "pine" | "bush", x: number, base: number, size: number][] = [
    ["pine", 14, 79, 34],
    ["round", 44, 80, 11],
    ["bush", 70, 81, 5],
    ["pine", 96, 78, 26],
    ["round", 128, 79, 13],
    ["pine", 160, 80, 38],
    ["bush", 184, 81, 6],
    ["round", 214, 80, 10],
    ["pine", 240, 79, 28],
  ];
  const leaves = season === "otono" ? AUTUMN : C.leaf;
  for (const [kind, x0, base, size] of items)
    wrap(W, x0, (x) => {
      if (kind === "pine") pine(c, x, base, size, season);
      else if (kind === "round") roundTree(c, x, base, size, season, x0);
      else {
        c.ellipse(x, base - size * 0.6, size * 1.4, size * 0.8, at(season === "invierno" ? WINTER_PINE : leaves, 2));
        c.ellipse(x - 2, base - size * 0.8, size * 0.8, size * 0.5, at(season === "invierno" ? C.white : leaves, 3));
      }
    });
  return { src: url(finish(c, phase)), w: W, secs: 26 };
}

// ---------- Sendero ----------

function drawPath({ phase, season }: Mood): Strip {
  const W = 256;
  const c = new PixelCanvas(W, SCENE_H);
  const lights = new PixelCanvas(W, SCENE_H);
  const grass = grassRamp(season);
  const night = phase === "noche";
  for (let y = MEADOW_Y; y < SCENE_H; y++)
    for (let x = 0; x < W; x++) {
      if (y < 83 || y >= 96) {
        c.set(x, y, at(grass, y === 83 - 1 || y === 96 ? 2 : noise(x, y, 7) > 0.88 ? 4 : 3));
        continue;
      }
      // Tierra apisonada con piedritas.
      const n = noise(x >> 1, y, 13);
      c.set(x, y, at(C.dirt, y === 83 || y === 95 ? 2 : n > 0.9 ? 2 : n < 0.12 ? 4 : 3));
    }
  // Piedras planas del sendero.
  for (let i = 0; i < 9; i++) {
    const x0 = Math.round((i * W) / 9 + noise(i, 1, 17) * 12);
    const y0 = 86 + Math.round(noise(i, 2, 17) * 5);
    wrap(W, x0, (x) => {
      c.ellipse(x, y0, 4, 1.6, at(C.stone, 3));
      c.rect(x - 3, y0 - 1, 4, 1, at(C.stone, 4));
    });
  }
  if (season === "otono") for (let i = 0; i < 6; i++) wrap(W, (i * W) / 6 + 10, (x) => blit(c, leafLitter(i + 3), Math.round(x), 84 + (i % 3) * 3));
  if (season === "invierno")
    for (let i = 0; i < 7; i++) wrap(W, (i * W) / 7 + 5, (x) => blit(c, snowPatch(4 + (i % 3) * 2, i), Math.round(x), i % 2 ? 94 : 80));
  if (season === "primavera" || season === "verano") for (let i = 0; i < 5; i++) wrap(W, (i * W) / 5 + 22, (x) => blit(c, flowerTuft(i + 7), Math.round(x), 97 + (i % 2) * 2));
  // Faroles del borde de atrás: poste de madera y farol de vidrio dorado (prendido de noche o al atardecer).
  const lit = night || phase === "atardecer";
  for (const x0 of [60, 188])
    wrap(W, x0, (x) => {
      c.rect(x - 1, 54, 3, 28, at(C.woodDark, 2));
      c.rect(x - 1, 54, 1, 28, at(C.woodDark, 4));
      c.rect(x - 2, 80, 5, 2, at(C.stone, 2));
      c.rect(x - 3, 46, 7, 1, at(C.woodDark, 1));
      c.rect(x - 2, 47, 5, 7, at(C.woodDark, 1));
      c.rect(x - 1, 48, 3, 5, lit ? at(C.gold, 5) : at(C.gold, 2));
      c.rect(x - 3, 45, 7, 1, at(C.roof, 2));
      if (lit) {
        lights.glow(x + 0.5, 50, 16, 14, at(C.gold, 4), night ? 110 : 60, 3);
        lights.glow(x + 0.5, 88, 18, 5, at(C.gold, 4), night ? 70 : 35, 2);
        lights.rect(x - 1, 48, 3, 5, at(C.gold, 5));
      }
    });
  return { src: url(finish(c, phase, lights)), w: W, secs: 8 };
}

// ---------- Cerca de adelante ----------

function drawFront({ phase, season }: Mood): Strip {
  const W = 320;
  const c = new PixelCanvas(W, SCENE_H);
  const wood = C.wood;
  const grass = grassRamp(season);
  // Rieles.
  for (let x = 0; x < W; x++) {
    c.set(x, 96, at(wood, 2));
    c.set(x, 97, at(wood, 3));
    c.set(x, 101, at(wood, 2));
  }
  for (let i = 0; i < 10; i++)
    wrap(W, i * 32 + 6, (x) => {
      c.rect(x, 92, 3, 12, at(wood, 3));
      c.rect(x, 92, 1, 12, at(wood, 4));
      c.rect(x + 2, 92, 1, 12, at(wood, 1));
      c.rect(x, 91, 3, 1, season === "invierno" ? at(C.white, 4) : at(wood, 4));
    });
  // Matas de pasto alto delante de la cerca.
  for (let i = 0; i < 16; i++)
    wrap(W, i * 20 + noise(i, 3, 21) * 10, (x) => {
      const h = 3 + Math.round(noise(i, 4, 21) * 4);
      for (let k = -2; k <= 2; k++) c.line(x, 104, x + k, 104 - h + Math.abs(k), at(grass, 2 + (k & 1) * 2));
    });
  return { src: url(finish(c, phase)), w: W, secs: 8 };
}

// ---------- Cielo ----------

function drawStars(): string {
  const c = new PixelCanvas(160, 60);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(noise(i, 1, 31) * 160);
    const y = Math.floor(noise(i, 2, 31) * 58);
    const bright = noise(i, 3, 31) > 0.7;
    c.set(x, y, bright ? at(C.cream, 5) : hex("#b8c0ea", 200));
    if (bright && i % 3 === 0) {
      c.set(x - 1, y, hex("#b8c0ea", 140));
      c.set(x + 1, y, hex("#b8c0ea", 140));
      c.set(x, y - 1, hex("#b8c0ea", 140));
      c.set(x, y + 1, hex("#b8c0ea", 140));
    }
  }
  return url(c);
}

function drawSun(phase: SkyPhase): string {
  const c = new PixelCanvas(14, 14);
  if (phase === "noche") {
    c.ellipse(7, 7, 5.5, 5.5, at(C.cream, 5));
    // La mordida: se borra un círculo corrido (media luna mirando a la izquierda).
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 14; x++) if (Math.hypot(x + 0.5 - 9.5, y + 0.5 - 5.5) < 4.5) c.data[(y * 14 + x) * 4 + 3] = 0;
    return url(c);
  }
  c.glow(7, 7, 7, 7, at(C.gold, 5), 90, 2);
  c.ellipse(7, 7, 4.5, 4.5, at(C.gold, 4));
  c.ellipse(6, 6, 2.5, 2.5, at(C.gold, 5));
  return url(c);
}

// ---------- La cabaña ----------

function drawCabin({ phase, season }: Mood) {
  const W = 80;
  const H = 66;
  const c = new PixelCanvas(W, H);
  const lights = new PixelCanvas(W, H);
  const night = phase === "noche";
  const lit = night || phase === "atardecer" || phase === "amanecer";
  // Paredes de troncos.
  for (let y = 30; y < 58; y++)
    for (let x = 5; x < 75; x++) {
      const row = (y - 30) % 4;
      c.set(x, y, at(C.logs, row === 0 ? 1 : row === 1 ? 4 : row === 3 ? 2 : 3));
    }
  // Puntas de los troncos a los lados.
  for (let y = 30; y < 58; y += 4)
    for (const x of [4, 74]) {
      c.rect(x, y, 2, 4, at(C.logs, 3));
      c.set(x, y + 1, at(C.logs, 5));
    }
  // Techo de tejas rojizas (trapecio con alero).
  for (let y = 6; y < 31; y++) {
    const t = (y - 6) / 24;
    const x0 = Math.round(14 - t * 14);
    const x1 = Math.round(66 + t * 13);
    for (let x = x0; x <= x1; x++) {
      const band = (y - 6) % 5;
      const scallop = band === 4 && (x + Math.floor((y - 6) / 5) * 2) % 4 === 0;
      c.set(x, y, at(C.roof, y === 6 ? 5 : band === 4 ? (scallop ? 1 : 2) : band === 0 ? 4 : 3));
    }
  }
  if (season === "invierno") {
    for (let x = 14; x <= 66; x++) {
      c.set(x, 5, at(C.white, 4));
      c.set(x, 6, at(C.white, 3));
    }
    for (let x = 0; x < 80; x++) if (noise(x, 1, 41) > 0.4) c.set(x, 30, at(C.white, 4));
  }
  // Chimenea de piedra (delante del techo).
  c.rect(56, 0, 8, 16, at(C.stone, 3));
  for (let y = 0; y < 16; y += 3) for (let x = 56 + ((y / 3) % 2) * 2; x < 64; x += 4) c.set(x, y, at(C.stone, 2));
  c.rect(55, 0, 10, 2, at(C.stone, 4));
  // Base de piedra y escalón.
  for (let y = 58; y < 66; y++) for (let x = 3; x < 77; x++) c.set(x, y, at(C.stone, (x + (y >> 1) * 3) % 6 === 0 ? 1 : y === 58 ? 4 : 3));
  c.rect(30, 58, 20, 3, at(C.stone, 4));
  c.rect(30, 60, 20, 1, at(C.stone, 2));
  // El hueco de la puerta: adentro, la luz tibia de la chimenea (se ve al abrirse).
  const doorX = 34;
  const doorY = 36;
  const doorW = 12;
  const doorH = 22;
  c.rect(doorX - 2, doorY - 2, doorW + 4, doorH + 2, at(C.woodDark, 2));
  lights.rect(doorX, doorY, doorW, doorH, at(C.fire, 3));
  lights.rect(doorX, doorY + doorH - 6, doorW, 6, at(C.fire, 4));
  lights.rect(doorX + 2, doorY + 2, 3, doorH - 8, at(C.fire, 4));
  // Ventanas con marco, cruz y jardinera (flores en primavera y verano).
  for (const wx of [12, 55]) {
    c.rect(wx - 1, 37, 14, 12, at(C.wood, 4));
    c.rect(wx, 38, 12, 10, lit ? at(C.gold, 4) : at(C.blue, 3));
    if (!lit) c.rect(wx + 1, 39, 3, 2, at(C.blue, 5));
    c.rect(wx + 5, 38, 2, 10, at(C.wood, 2));
    c.rect(wx, 42, 12, 2, at(C.wood, 2));
    c.rect(wx - 2, 49, 16, 3, at(C.wood, 2));
    if (season === "primavera" || season === "verano")
      for (let k = 0; k < 6; k++) c.set(wx - 1 + k * 3, 48, k % 2 ? at(C.rose, 4) : at(C.gold, 5));
    if (season === "invierno") c.rect(wx - 2, 48, 16, 1, at(C.white, 4));
    if (lit) {
      lights.rect(wx, 38, 5, 4, at(C.gold, 5));
      lights.rect(wx + 7, 38, 5, 4, at(C.gold, 5));
      lights.rect(wx, 44, 5, 4, at(C.gold, 4));
      lights.rect(wx + 7, 44, 5, 4, at(C.gold, 4));
      lights.glow(wx + 6, 43, 11, 9, at(C.gold, 4), night ? 70 : 35, 2);
    }
  }
  c.outline(OUT);
  finish(c, phase, lights);

  // La puerta (aparte, para abrirla): tablones con herrajes y la manija.
  const d = new PixelCanvas(doorW, doorH);
  for (let y = 0; y < doorH; y++) for (let x = 0; x < doorW; x++) d.set(x, y, at(C.wood, x % 4 === 0 ? 1 : x % 4 === 1 ? 4 : 3));
  d.rect(0, 4, doorW, 2, at(C.woodDark, 1));
  d.rect(0, doorH - 6, doorW, 2, at(C.woodDark, 1));
  d.rect(doorW - 3, 11, 2, 2, at(C.gold, 4));
  finish(d, phase);
  return { src: url(c), w: W, h: H, door: url(d), doorX, doorY, doorW, doorH, chimneyX: 60 };
}

// ---------- Lo que cae ----------

function drawParticles({ phase, season }: Mood): Scenery["particles"] {
  const night = phase === "noche";
  if (season === "otono") return { kind: "fall", srcs: [0, 1, 2, 3].map((v) => url(finish(fallingLeaf(v), phase))) };
  if (season === "primavera") return { kind: "fall", srcs: [0, 1, 2].map((v) => url(finish(fallingPetal(v), phase))) };
  if (season === "invierno") return { kind: "fall", srcs: [url(snowflake(0)), url(snowflake(1))] };
  if (night) {
    const f = new PixelCanvas(3, 3);
    f.set(1, 1, at(C.gold, 5));
    f.set(0, 1, hex("#fff0b0", 120));
    f.set(2, 1, hex("#fff0b0", 120));
    f.set(1, 0, hex("#fff0b0", 120));
    f.set(1, 2, hex("#fff0b0", 120));
    return { kind: "firefly", srcs: [url(f)] };
  }
  return { kind: "fall", srcs: [] };
}

/** Todo el paisaje de un momento y una estación. */
export function drawScenery(mood: Mood): Scenery {
  return {
    clouds: drawClouds(mood.phase),
    hills: drawHills(mood),
    trees: drawTrees(mood),
    path: drawPath(mood),
    front: drawFront(mood),
    stars: mood.phase === "noche" || mood.phase === "amanecer" ? drawStars() : null,
    sun: drawSun(mood.phase),
    cabin: drawCabin(mood),
    particles: drawParticles(mood),
  };
}
