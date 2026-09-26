// Render de un nivel: pisos, paredes altas del fondo (con lo que cuelga de ellas) y las piezas de
// pared baja. Todo en unidades de arte (tile = 16).
import type { OfficeMap } from "../world/build";
import type { FloorKind, WallFeature, WallpaperKind } from "../world/types";
import { C, OUT, inRect, mix } from "./palette";
import {
  L,
  at,
  bayer,
  flat,
  hex,
  noise,
  renderSprite,
  smoothNoise,
  type Box,
  type Ramp,
  type RGBA,
  type Shader,
  type Sprite,
} from "./pixel";

export const WALL_H = 56;
export const LOW_WALL_H = 10;
const WALL_T = 4;
const SLAB = 5;

const WALLPAPER: Record<WallpaperKind, Ramp> = { sage: C.sage, cream: C.cream, blue: C.blue, rose: C.rose };
const CARPET: Record<WallpaperKind, Ramp> = { sage: C.green, cream: C.cream, blue: C.blue, rose: C.rose };

// ---------- Pisos ----------

function woodFloor(X: number, Y: number): RGBA {
  const row = Math.floor(Y / 8);
  const off = Math.floor(noise(row, 0, 3) * 32);
  const seg = Math.floor((X + off) / 32);
  const tone = noise(seg, row, 7);
  let c = at(C.wood, tone < 0.25 ? 2 : tone < 0.8 ? 3 : 4);
  if (noise(Math.floor(X), Math.floor(Y), 11) < 0.05) c = at(C.wood, 2);
  if (Y % 8 < 1 || (X + off) % 32 < 1) c = at(C.wood, 1);
  return c;
}

function carpet(X: number, Y: number, r: Ramp): RGBA {
  const d = bayer(Math.floor(X), Math.floor(Y));
  if ((Math.floor(X) + Math.floor(Y)) % 12 === 0) return at(r, 2);
  return at(r, d < 0.15 ? 2 : 3);
}

function cafeTiles(X: number, Y: number): RGBA {
  const cell = (Math.floor(X / 8) + Math.floor(Y / 8)) % 2;
  if (X % 8 < 0.8 || Y % 8 < 0.8) return at(C.cream, 1);
  return cell ? at(C.cream, 4) : at(C.terracotta, 3);
}

function grass(X: number, Y: number): RGBA {
  const n = noise(Math.floor(X), Math.floor(Y), 13);
  // Dos octavas de ruido suave y un poco de tramado en los bordes: manchas de pasto orgánicas.
  const patch = smoothNoise(X, Y, 28, 2) * 0.7 + smoothNoise(X, Y, 9, 5) * 0.3 + (bayer(Math.floor(X), Math.floor(Y)) - 0.5) * 0.08;
  let c = at(C.grass, patch < 0.36 ? 2 : patch < 0.64 ? 3 : 4);
  if (n < 0.07) c = at(C.grass, 1);
  else if (n > 0.95) c = at(C.grass, 5);
  // Florcitas sueltas.
  const f = noise(Math.floor(X / 2), Math.floor(Y / 2), 17);
  if (f > 0.996) return [at(C.white, 4), at(C.gold, 5), at(C.rose, 5)][Math.floor(noise(X, Y, 3) * 3)]!;
  return c;
}

/** Adoquines redondeados sobre tierra. */
function stonePath(X: number, Y: number): RGBA {
  const cy = Math.floor(Y / 6);
  const ox = (cy % 2) * 4;
  const u = (X + ox) % 8;
  const v = Y % 6;
  const edge = Math.min(u, 8 - u, v * 1.3, (6 - v) * 1.3);
  if (edge < 0.9) return at(C.dirt, 2);
  const tone = noise(Math.floor((X + ox) / 8), cy, 4);
  const c = at(C.stone, tone < 0.3 ? 2 : tone < 0.8 ? 3 : 4);
  return edge < 1.8 && v < 3 ? mix(c, at(C.stone, 5), 0.3) : c;
}

function doormat(X: number, Y: number): RGBA {
  const u = X % L;
  const v = Y % L;
  if (u < 2 || u >= 14 || v < 3 || v >= 13) return at(C.woodDark, 2);
  if (u < 3 || u >= 13 || v < 4 || v >= 12) return at(C.rug, 1);
  return at(C.mustard, (Math.floor(u) + Math.floor(v)) % 3 === 0 ? 1 : 2);
}

function floorColor(kind: FloorKind, X: number, Y: number, wallpaper: WallpaperKind | null): RGBA {
  switch (kind) {
    case "wood":
      return woodFloor(X, Y);
    case "carpet":
      return carpet(X, Y, CARPET[wallpaper ?? "cream"]);
    case "tiles":
      return cafeTiles(X, Y);
    case "stone":
      return stonePath(X, Y);
    case "grass":
      return grass(X, Y);
    case "path":
      return stonePath(X, Y);
    case "doormat":
      return doormat(X, Y);
  }
}

// ---------- Paredes ----------

/** Papel mural con franjas, zócalo de madera y moldura; `hv` = altura sobre el piso. */
function wallpaper(u: number, hv: number, r: Ramp, shift: number): RGBA {
  if (hv < 0) return at(C.woodDark, 1);
  if (hv < 3) return at(C.woodDark, hv >= 2 ? 3 : 2);
  if (hv < 18) {
    if (hv >= 16) return at(C.wood, 4);
    if (hv >= 15) return at(C.wood, 1);
    if (u % 12 < 1) return at(C.wood, 1);
    if (u % 12 < 2) return at(C.wood, 4);
    return at(C.wood, noise(Math.floor(u / 12), 0, 5) < 0.5 ? 2 : 3);
  }
  if (hv >= WALL_H - 4) return at(C.cream, hv >= WALL_H - 1 ? 4 : hv < WALL_H - 3 ? 1 : 3);
  const stripe = u % 10 < 2;
  let c = at(r, (stripe ? 2 : 3) + shift);
  if (u % 10 === 6 && Math.floor(hv) % 8 === 4) c = at(r, 4 + shift);
  if (hv < 20) c = at(r, 1 + shift);
  return c;
}

function windowAt(u: number, hv: number, u0: number, u1: number, day: boolean): RGBA | null {
  // Cortinas a los lados.
  if (inRect(u, hv, u0 - 7, 20, u0, 49) || inRect(u, hv, u1, 20, u1 + 7, 49)) {
    const f = Math.floor(u) % 3;
    return at(C.curtain, hv >= 47 ? 1 : f === 0 ? 1 : f === 1 ? 3 : 2);
  }
  if (inRect(u, hv, u0 - 9, 48, u1 + 9, 50)) return at(C.gold, hv >= 49 ? 4 : 2);
  if (inRect(u, hv, u0 - 3, 19, u1 + 3, 22)) return at(C.cream, hv >= 21 ? 5 : 2);
  if (!inRect(u, hv, u0, 22, u1, 46)) return null;
  if (u < u0 + 2 || u >= u1 - 2 || hv < 24 || hv >= 44) return at(C.cream, u < u0 + 1 || hv >= 45 ? 4 : 3);
  const mid = (u0 + u1) / 2;
  if (Math.abs(u - mid) < 1 || (hv >= 33 && hv < 35)) return at(C.cream, 3);
  if (!day) return noise(Math.floor(u), Math.floor(hv), 21) < 0.03 ? at(C.gold, 5) : at(C.night, hv > 38 ? 1 : 2);
  const t = (hv - 24) / 20;
  if (Math.abs(u - u0 - 6 - (hv - 24) * 0.6) < 1.2 || Math.abs(u - mid - 5 - (hv - 24) * 0.6) < 0.8) return at(C.sky, 4);
  return at(C.sky, 1 + t * 3 + (bayer(Math.floor(u), Math.floor(hv)) - 0.5));
}

function featureAt(f: WallFeature, u: number, hv: number, day: boolean): RGBA | null {
  const u0 = 0;
  const u1 = (f.width ?? 1) * L;
  const mid = u1 / 2;
  switch (f.kind) {
    case "window":
      return windowAt(u, hv, u0 + 4, u1 - 4, day);
    case "screen": {
      if (!inRect(u, hv, 2, 22, u1 - 2, 48)) return inRect(u, hv, mid - 2, 18, mid + 2, 22) ? at(C.metal, 2) : null;
      if (u < 4 || u >= u1 - 4 || hv < 24 || hv >= 46) return at(C.metal, u < 3 || hv >= 47 ? 3 : 1);
      // Pantalla apagada con un reflejo diagonal (el video se monta encima desde el cliente).
      if (Math.abs(u - 10 - (hv - 24) * 0.7) < 1.5) return at(C.metal, 2);
      return at(C.screen, 0);
    }
    case "whiteboard": {
      if (!inRect(u, hv, 3, 22, u1 - 3, 46)) return null;
      if (u < 5 || u >= u1 - 5 || hv < 24 || hv >= 44) return at(C.metal, hv < 24 ? 2 : 4);
      const line = (y: number, from: number, to: number) => Math.floor(hv) === y && u >= from && u < to;
      if (line(40, 8, 30) || line(37, 8, 22) || line(34, 12, 36)) return at(C.blue, 2);
      if (line(30, 8, 18) || (Math.hypot(u - 34, hv - 30) < 4 && Math.hypot(u - 34, hv - 30) > 3)) return at(C.rug, 3);
      return at(C.white, 4);
    }
    case "menu": {
      // Pizarra del menú con precios en puntos.
      if (!inRect(u, hv, 2, 24, u1 - 2, 48)) return null;
      if (u < 4 || u >= u1 - 4 || hv < 26 || hv >= 46) return at(C.wood, hv >= 47 ? 5 : 3);
      const row = Math.floor((45 - hv) / 4);
      const inRow = (45 - hv) % 4 < 1;
      if (row < 5 && inRow && u > 7 && u < 7 + 10 + noise(row, 0, 3) * 12) return at(C.cream, 5);
      if (row < 5 && inRow && u > u1 - 12 && u < u1 - 7) return at(C.gold, 4);
      return at(C.green, 0);
    }
    case "board": {
      if (!inRect(u, hv, 3, 24, u1 - 3, 42)) return null;
      if (u < 5 || u >= u1 - 5 || hv < 26 || hv >= 40) return at(C.wood, hv >= 40 ? 5 : 3);
      const notes: [number, number, RGBA][] = [
        [7, 33, at(C.gold, 4)],
        [14, 29, hex("#f4a5b5")],
        [20, 34, at(C.sage, 5)],
        [11, 35, at(C.sky, 3)],
      ];
      for (const [nu, nv, col] of notes)
        if (inRect(u, hv, nu, nv, nu + 5, nv + 4)) return hv >= nv + 3 && u >= nu + 2 && u < nu + 3 ? at(C.rug, 3) : col;
      return at(C.cork, 1 + Math.floor(noise(Math.floor(u), Math.floor(hv), 8) * 3));
    }
    case "picture": {
      if (!inRect(u, hv, 2, 26, u1 - 2, 44)) return null;
      if (u < 4 || u >= u1 - 4 || hv < 28 || hv >= 42) return at(C.gold, hv >= 42 || u >= u1 - 3 ? 4 : 2);
      if (Math.hypot(u - (u1 - 7), hv - 38) < 2.2) return at(C.gold, 5);
      if (hv < 31 + 2 * Math.sin(u * 0.5)) return at(C.leaf, 4);
      if (hv < 34 + 3 * Math.sin(u * 0.3 + 1)) return at(C.leaf, 2);
      return at(C.sky, 2 + (hv > 38 ? 1 : 0) + (bayer(Math.floor(u), Math.floor(hv)) < 0.3 ? 1 : 0));
    }
    case "clock": {
      const dx = u - mid;
      const dy = hv - 40;
      const r = Math.hypot(dx, dy * 1.1);
      if (r >= 6) return null;
      if (r >= 4.8) return at(C.woodDark, dy > 0 ? 4 : 2);
      if ((Math.abs(dx) < 0.8 && dy > 0 && dy < 3.5) || (Math.abs(dy) < 0.6 && dx > 0 && dx < 2.8)) return OUT;
      return at(C.cream, 4);
    }
  }
}

/** Sombra suave del piso junto a las paredes altas (tramada, sin degradados). */
function occlusion(map: OfficeMap, tx: number, ty: number, u: number, v: number): number {
  const wallN = map.wallH[ty * map.width + tx] === 2;
  const wallW = map.wallV[ty * (map.width + 1) + tx] === 2;
  const d = Math.min(wallN ? v : 99, wallW ? u : 99);
  if (d < 2.5) return 0.45;
  if (d < 7 && bayer(Math.floor(u), Math.floor(v)) < (7 - d) / 7) return 0.35;
  return 0;
}

export interface AreaArt {
  /** Pisos y paredes altas (siempre al fondo). */
  base: Sprite;
  /** Dónde cae cada rasgo colgado de la pared (p. ej. para montar el video sobre la pantalla). */
  features: { feature: WallFeature; x: number; y: number; z: number }[];
}

/** Arma el fondo de un nivel: pisos, losa y paredes altas con lo que cuelga de ellas. */
export function drawAreaBase(map: OfficeMap, day: boolean): AreaArt {
  const W = map.width;
  const H = map.height;
  const roomWallpaper = (tx: number, ty: number): WallpaperKind | null => {
    const r = map.def.rooms.find((r) => tx >= r.rect.x && tx < r.rect.x + r.rect.w && ty >= r.rect.y && ty < r.rect.y + r.rect.h);
    return r?.wallpaper ?? null;
  };

  const boxes: Box[] = [];
  const slabH = map.outdoor ? 9 : SLAB;
  const sideRamp = map.outdoor ? C.dirt : C.woodDark;
  // Un bloque de losa por tile, de atrás hacia adelante: solo quedan a la vista los bordes expuestos.
  const order: [number, number][] = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (map.floors[ty * W + tx]) order.push([tx, ty]);
  order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [tx, ty] of order) {
    const kind = map.floors[ty * W + tx]!;
    const wp = roomWallpaper(tx, ty);
    const x0 = tx * L;
    const y0 = ty * L;
    const side: Shader = (_u, v, _fw, fh) => {
      if (map.outdoor && v >= fh - 2) return at(C.grass, v >= fh - 1 ? 3 : 1);
      return at(sideRamp, v < 1 ? 0 : v < fh / 2 ? 1 : 2);
    };
    boxes.push({
      x: x0,
      y: y0,
      z: -slabH,
      w: L,
      d: L,
      h: slabH,
      top: (u, v) => {
        const c = floorColor(kind, x0 + u, y0 + v, wp);
        const o = map.outdoor ? 0 : occlusion(map, tx, ty, u, v);
        return o ? mix(c, at(C.woodDark, 0), o) : c;
      },
      left: side,
      right: side,
    });
  }

  // Paredes altas: tramos de un tile hacia afuera del edificio, con la cara interior pintada.
  const features: AreaArt["features"] = [];
  const featureOn = (edge: "h" | "v", tx: number, ty: number) =>
    map.def.features.find((f) =>
      f.edge === edge && (edge === "h" ? f.y === ty && tx >= f.x && tx < f.x + (f.width ?? 1) : f.x === tx && ty >= f.y && ty < f.y + (f.width ?? 1)),
    );
  for (const f of map.def.features) {
    const len = (f.width ?? 1) * L;
    features.push(
      f.edge === "h"
        ? { feature: f, x: f.x * L + len / 2, y: f.y * L, z: 35 }
        : { feature: f, x: f.x * L, y: f.y * L + len / 2, z: 35 },
    );
  }
  const walls: Box[] = [];
  for (let ty = 0; ty <= H; ty++)
    for (let tx = 0; tx < W; tx++) {
      if (map.wallH[ty * W + tx] !== 2) continue;
      const r = WALLPAPER[roomWallpaper(tx, ty) ?? "sage"];
      const f = featureOn("h", tx, ty);
      walls.push({
        x: tx * L,
        y: ty * L - WALL_T,
        z: -SLAB,
        w: L,
        d: WALL_T,
        h: WALL_H + SLAB,
        top: flat(at(C.cream, 1)),
        right: flat(at(C.woodDark, 2)),
        left: (u, v) => {
          const X = tx * L + u;
          const hv = v - SLAB;
          const fc = f && featureAt(f, X - f.x * L, hv, day);
          return fc ?? wallpaper(X, hv, r, 0);
        },
      });
    }
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx <= W; tx++) {
      if (map.wallV[ty * (W + 1) + tx] !== 2) continue;
      const r = WALLPAPER[roomWallpaper(tx, ty) ?? "sage"];
      const f = featureOn("v", tx, ty);
      walls.push({
        x: tx * L - WALL_T,
        y: ty * L,
        z: -SLAB,
        w: WALL_T,
        d: L,
        h: WALL_H + SLAB,
        top: flat(at(C.cream, 1)),
        left: flat(at(C.woodDark, 2)),
        // En las paredes oeste `u` crece hacia la izquierda de la pantalla: se invierte para el dibujo.
        right: (u, v) => {
          const Y = ty * L + (L - u);
          const hv = v - SLAB;
          const fc = f && featureAt(f, (f.y + (f.width ?? 1)) * L - Y, hv, day);
          return fc ?? wallpaper(Y, hv, r, -1);
        },
      });
    }
  // Esquina noroeste del edificio (donde se juntan las dos paredes altas).
  for (let ty = 0; ty < H; ty++)
    for (let tx = 0; tx < W; tx++) {
      if (map.wallH[ty * W + tx] === 2 && map.wallV[ty * (W + 1) + tx] === 2) {
        walls.push({ x: tx * L - WALL_T, y: ty * L - WALL_T, z: -SLAB, w: WALL_T, d: WALL_T, h: WALL_H + SLAB, top: flat(at(C.cream, 1)), left: flat(at(C.woodDark, 2)), right: flat(at(C.woodDark, 2)) });
      }
    }
  walls.sort((a, b) => a.x + a.y - (b.x + b.y));

  return { base: renderSprite([...boxes, ...walls], { outline: OUT }), features };
}

// ---------- Paredes bajas ----------

const lowWallShader: Shader = (u, v, _fw, fh) => {
  if (v >= fh - 2) return at(C.cream, v >= fh - 1 ? 4 : 2);
  if (v < 2) return at(C.woodDark, 2);
  return at(C.wood, Math.floor(u) % 8 === 0 ? 1 : 3);
};

/** Pieza de pared baja de un tile: `h` corre a lo largo de x y `v` a lo largo de y. */
export function drawLowWall(edge: "h" | "v"): Sprite {
  const b: Box =
    edge === "h"
      ? { x: 0, y: -1.5, z: 0, w: L, d: 3, h: LOW_WALL_H, top: flat(at(C.cream, 4)), left: lowWallShader, right: flat(at(C.wood, 2)) }
      : { x: -1.5, y: 0, z: 0, w: 3, d: L, h: LOW_WALL_H, top: flat(at(C.cream, 4)), left: flat(at(C.wood, 2)), right: lowWallShader };
  return renderSprite([b], { outline: OUT });
}

/** Poste de marco de puerta en paredes bajas. */
export function drawDoorPost(): Sprite {
  return renderSprite([{ x: -2, y: -2, z: 0, w: 4, d: 4, h: LOW_WALL_H + 4, top: flat(at(C.cream, 4)), left: flat(at(C.woodDark, 3)), right: flat(at(C.woodDark, 2)) }], {
    outline: OUT,
  });
}
