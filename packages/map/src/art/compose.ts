// Arma un nivel completo en un solo lienzo (fondo, muebles y paredes bajas ordenados por
// profundidad), igual que el juego pero sin Phaser: para vistas previas, el login y revisar el arte.
import { catalogItem } from "../world/catalog";
import type { OfficeMap } from "../world/build";
import { drawFurniture } from "./furniture";
import { PixelCanvas, toScreen, WORLD_TO_ART, type Sprite } from "./pixel";
import type { EventOverlay } from "./eventos";
import { drawAreaBase, drawLowWall } from "./room";

/** `extras`: lo que ponen los eventos encima (ver `eventOverlays`), para verlo en la vista previa. */
export function composeArea(map: OfficeMap, day = true, pad = 80, extras: EventOverlay[] = []): PixelCanvas {
  const ts = map.tileSize;
  const base = drawAreaBase(map, day).base;
  const canvas = new PixelCanvas(base.canvas.width + pad * 2, base.canvas.height + pad * 2);
  const ox = base.ox + pad;
  const oy = base.oy + pad;

  const blit = (s: Sprite, ax: number, ay: number, flip: boolean) => {
    const src = s.canvas;
    for (let y = 0; y < src.height; y++)
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4;
        if (!src.data[i + 3]) continue;
        canvas.set(ax + (flip ? src.width - 1 - x : x), ay + y, [src.data[i]!, src.data[i + 1]!, src.data[i + 2]!, src.data[i + 3]!]);
      }
  };
  blit(base, pad, pad, false);

  const items: { depth: number; draw: () => void }[] = [];
  for (const f of map.furniture) {
    const item = catalogItem(f.type);
    const back = (f.facing === "left" || f.facing === "up") && item.hasBack;
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const s = drawFurniture(f.type, back ? "back" : "front", !day);
    const a = toScreen(f.x * ts * WORLD_TO_ART, f.y * ts * WORLD_TO_ART);
    items.push({
      depth: item.flat ? -1e9 : (f.x + f.w / 2) * ts + (f.y + f.d / 2) * ts,
      draw: () => blit(s, Math.round(ox + a.x - (flip ? s.canvas.width - s.ox : s.ox)), Math.round(oy + a.y - s.oy), flip),
    });
  }
  for (const e of extras) {
    const s = e.sprite;
    if (!e.tile) {
      items.push({ depth: -1e9 + 1, draw: () => blit(s, ox - s.ox, oy - s.oy, false) });
      continue;
    }
    const a = toScreen(e.tile.x * ts * WORLD_TO_ART, e.tile.y * ts * WORLD_TO_ART);
    const { w, d } = e.size ?? { w: 1, d: 1 };
    items.push({ depth: (e.tile.x + w / 2) * ts + (e.tile.y + d / 2) * ts + 0.01, draw: () => blit(s, Math.round(ox + a.x - (e.flip ? s.canvas.width - s.ox : s.ox)), Math.round(oy + a.y - s.oy), Boolean(e.flip)) });
  }
  const low = { h: drawLowWall("h"), v: drawLowWall("v") };
  for (let ty = 0; ty <= map.height; ty++)
    for (let tx = 0; tx <= map.width; tx++) {
      if (tx < map.width && map.wallH[ty * map.width + tx] === 1) {
        const a = toScreen(tx * ts * WORLD_TO_ART, ty * ts * WORLD_TO_ART);
        items.push({ depth: (tx + 0.5) * ts + ty * ts, draw: () => blit(low.h, Math.round(ox + a.x - low.h.ox), Math.round(oy + a.y - low.h.oy), false) });
      }
      if (ty < map.height && map.wallV[ty * (map.width + 1) + tx] === 1) {
        const a = toScreen(tx * ts * WORLD_TO_ART, ty * ts * WORLD_TO_ART);
        items.push({ depth: tx * ts + (ty + 0.5) * ts, draw: () => blit(low.v, Math.round(ox + a.x - low.v.ox), Math.round(oy + a.y - low.v.oy), false) });
      }
    }
  items.sort((a, b) => a.depth - b.depth).forEach((i) => i.draw());
  return canvas;
}
