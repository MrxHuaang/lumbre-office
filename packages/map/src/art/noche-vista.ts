// La noche del juego sobre un nivel ya armado (composeArea), para revisar el arte en PNG sin abrir el juego
// (scripts/render-area.ts): la misma penumbra que pone AreaView (color y alfa de NIGHT en
// apps/web/src/game/iso/view.ts), con los huecos de luz de los muebles que alumbran y de las ventanas
// prendidas (luces-ventanas.ts), y encima, sumado, el resplandor de cada luz.
import { catalogItem } from "../world/catalog";
import type { OfficeMap } from "../world/build";
import { drawFurniture } from "./furniture";
import { glowSprite } from "./index";
import { capasDeLuz, lucesDeEdificio, luzPrendida, semillaDeLuz } from "./luces-ventanas";
import { hex, toScreen, WORLD_TO_ART, type PixelCanvas, type Sprite } from "./pixel";

/** Como NIGHT de view.ts: el color de la penumbra, su alfa y cuánto alcanza cada luz. */
const PENUMBRA = {
  indoor: { color: "#c8905e", alpha: 0.34, reach: 2.8 },
  outdoor: { color: "#2c3570", alpha: 0.7, reach: 2.2 },
} as const;

/**
 * Oscurece `canvas` como la noche del juego. `origen`: dónde cae el (0, 0, 0) del nivel en el lienzo.
 * `hora`: el día y el minuto del juego (para saber qué ventanas están prendidas).
 */
export function pintarNoche(canvas: PixelCanvas, map: OfficeMap, origen: { x: number; y: number }, hora: { dia: number; minuto: number }) {
  const n = PENUMBRA[map.outdoor ? "outdoor" : "indoor"];
  const W = canvas.width;
  const H = canvas.height;
  const ts = map.tileSize;
  const mask = new Float32Array(W * H).fill(n.alpha);
  const sumas: { s: Sprite; x: number; y: number }[] = [];
  const huecos: { s: Sprite; x: number; y: number }[] = [];
  const oscuros: { s: Sprite; x: number; y: number }[] = [];
  const radiales: { x: number; y: number; rx: number; ry: number }[] = [];

  for (const f of map.furniture) {
    const item = catalogItem(f.type);
    const a = toScreen(f.x * ts * WORLD_TO_ART, f.y * ts * WORLD_TO_ART);
    const ax = origen.x + a.x;
    const ay = origen.y + a.y;
    if (item.light) {
      const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
      const [lx, ly, lz] = item.light.at;
      const p = toScreen(f.x * ts * WORLD_TO_ART + (flip ? ly : lx), f.y * ts * WORLD_TO_ART + (flip ? lx : ly), lz);
      const r = item.light.radius;
      const g = glowSprite(r, Math.round(r * 0.6), item.light.color, 0.55);
      const cx = origen.x + p.x;
      const cy = origen.y + p.y + 6;
      sumas.push({ s: { canvas: g, ox: g.width / 2, oy: g.height / 2 }, x: cx, y: cy });
      const rx = (g.width / 2) * n.reach;
      radiales.push({ x: cx, y: cy, rx, ry: rx * (g.height / g.width) });
    }
    const luces = lucesDeEdificio(f.type);
    const dibujos = luces && { noche: drawFurniture(f.type, "front", true), dia: drawFurniture(f.type, "front", false) };
    luces?.forEach((v, i) => {
      const c = dibujos && capasDeLuz(f.type, i, dibujos);
      if (!c) return;
      if (luzPrendida(v, semillaDeLuz(f.type, f.x, f.y, i), hora.dia, hora.minuto)) {
        huecos.push({ s: c.hueco, x: ax, y: ay });
        sumas.push({ s: c.brillo, x: ax, y: ay });
      } else oscuros.push({ s: c.oscuro, x: ax, y: ay });
    });
  }

  // La penumbra: más oscura en los vidrios apagados, con los huecos de cada luz.
  const cada = (l: { s: Sprite; x: number; y: number }, fn: (i: number, a: number) => void) => {
    const { canvas: c, ox, oy } = l.s;
    const x0 = Math.round(l.x - ox);
    const y0 = Math.round(l.y - oy);
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const a = c.data[(y * c.width + x) * 4 + 3]! / 255;
        const X = x0 + x;
        const Y = y0 + y;
        if (a > 0 && X >= 0 && Y >= 0 && X < W && Y < H) fn(Y * W + X, a);
      }
  };
  for (const o of oscuros) cada(o, (i, a) => (mask[i] = mask[i]! + a * (1 - mask[i]!)));
  for (const r of radiales)
    for (let y = Math.max(0, Math.floor(r.y - r.ry)); y < Math.min(H, Math.ceil(r.y + r.ry)); y++)
      for (let x = Math.max(0, Math.floor(r.x - r.rx)); x < Math.min(W, Math.ceil(r.x + r.rx)); x++) {
        const d = Math.hypot((x + 0.5 - r.x) / r.rx, (y + 0.5 - r.y) / r.ry);
        if (d >= 1) continue;
        const g = d < 0.45 ? 1 - (d / 0.45) * 0.15 : 0.85 * (1 - (d - 0.45) / 0.55);
        mask[y * W + x] = mask[y * W + x]! * (1 - g);
      }
  for (const h of huecos) cada(h, (i, a) => (mask[i] = mask[i]! * (1 - a)));

  const col = hex(n.color);
  const d = canvas.data;
  for (let i = 0; i < W * H; i++) {
    const m = mask[i]!;
    if (!d[i * 4 + 3] || m <= 0) continue;
    for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(d[i * 4 + k]! * (1 - m + (m * col[k]!) / 255));
  }
  // Lo que alumbra se suma encima (ADD), como los resplandores del juego.
  for (const l of sumas) {
    const { canvas: c, ox, oy } = l.s;
    const x0 = Math.round(l.x - ox);
    const y0 = Math.round(l.y - oy);
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const j = (y * c.width + x) * 4;
        const a = c.data[j + 3]! / 255;
        const X = x0 + x;
        const Y = y0 + y;
        if (!a || X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const i = (Y * W + X) * 4;
        for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, d[i + k]! + c.data[j + k]! * a);
      }
  }
}
