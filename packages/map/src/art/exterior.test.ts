import { describe, expect, it } from "vitest";
import { catalogItem } from "../world/catalog";
import { getWorld, isBlockedTile, spawnPoint, type OfficeMap } from "../index";
import { drawFurniture } from "./furniture";
import { toScreen, WORLD_TO_ART } from "./pixel";
import { drawAreaBase } from "./room";
import { SURROUND_PAD, surroundingsAt } from "./surroundings";

const jardin = getWorld().areas.get("jardin") as OfficeMap;
const ts = jardin.tileSize;

/** Tiles a los que se llega caminando desde la aparición. */
function reachable(map: OfficeMap): Set<number> {
  const sp = spawnPoint(map);
  const seen = new Set([sp.tileY * map.width + sp.tileX]);
  const stack = [[sp.tileX, sp.tileY] as const];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const k = (y + dy) * map.width + x + dx;
      if (seen.has(k) || isBlockedTile(map, x + dx, y + dy)) continue;
      seen.add(k);
      stack.push([x + dx, y + dy]);
    }
  }
  return seen;
}

describe("arte del jardín", () => {
  // El cliente no transparenta los dibujos fijos cuando alguien pasa detrás: una persona tapada por la
  // casa (o la glorieta, el invernadero…) desaparece. Se mide proyectando el dibujo como lo pone el
  // cliente: qué parte del cuerpo de un personaje parado en el tile queda bajo píxeles opacos.
  it("nadie queda tapado por los dibujos grandes donde se puede caminar, ni los puntos ni el huerto", { timeout: 30000 }, () => {
    const tiles = reachable(jardin);
    const important = new Set(["well", "beehive", "compost", "scarecrow", "mailbox", "notice-board", "fire-pit", "log-seat", "bench", "dock-lamp", "rowboat"]);
    const problems: string[] = [];
    const px = jardin.def.playable!.x;
    const py = jardin.def.playable!.y;
    for (const f of jardin.furniture) {
      const item = catalogItem(f.type);
      if (!item.fixed || f.w * f.d < 9) continue;
      const s = drawFurniture(f.type, "front", false);
      const a = toScreen(f.x * ts * WORLD_TO_ART, f.y * ts * WORLD_TO_ART);
      const left = a.x - s.ox;
      const top = a.y - s.oy;
      const depth = (f.x + f.w / 2 + f.y + f.d / 2) * ts;
      // Fracción del cuerpo (12x24 px sobre los pies) tapada si el personaje se dibuja detrás.
      const covered = (x: number, y: number) => {
        const wx = (x + 0.5) * ts;
        const wy = (y + 0.5) * ts;
        if (wx + wy >= depth) return 0;
        const p = toScreen(wx * WORLD_TO_ART, wy * WORLD_TO_ART);
        let n = 0;
        let hit = 0;
        for (let sy = p.y - 24; sy <= p.y; sy += 2)
          for (let sx = p.x - 5; sx <= p.x + 5; sx += 2) {
            n++;
            const cx = Math.floor(sx - left);
            const cy = Math.floor(sy - top);
            if (cx < 0 || cy < 0 || cx >= s.canvas.width || cy >= s.canvas.height) continue;
            if (s.canvas.data[(cy * s.canvas.width + cx) * 4 + 3]! >= 200) hit++;
          }
        return hit / n;
      };
      for (const k of tiles) {
        const x = k % jardin.width;
        const y = Math.floor(k / jardin.width);
        const c = covered(x, y);
        if (c > 0.8) problems.push(`${f.type} tapa el tile (${x - px}, ${y - py}) ${Math.round(c * 100)}%`);
      }
      for (const p of jardin.points) if (covered(p.tileX, p.tileY) > 0.3) problems.push(`${f.type} tapa el punto ${p.name}`);
      for (const g of jardin.furniture)
        if (g !== f && important.has(g.type) && covered(g.x + (g.w - 1) / 2, g.y + (g.d - 1) / 2) > 0.5)
          problems.push(`${f.type} tapa ${g.type} en (${g.x - px}, ${g.y - py})`);
    }
    expect(problems).toEqual([]);
  });

  // El margen del nivel termina en la misma copa de bosque que el cliente repite alrededor (desde la
  // esquina del fondo menos SURROUND_PAD, ver iso/view.ts): lo de afuera tiene que calzar píxel a píxel.
  it("el margen del jardín empalma con el bosque de alrededor", { timeout: 30000 }, () => {
    const base = drawAreaBase(jardin, true).base;
    const L = 16;
    let total = 0;
    let same = 0;
    // Los tiles de las orillas del nivel ya son copa del bosque (más de 5 tiles fuera de lo jugable).
    for (let ty = 0; ty < jardin.height; ty += 3)
      for (const tx of [0, 1, 2, jardin.width - 3, jardin.width - 2, jardin.width - 1]) {
        for (const [u, v] of [
          [4, 4],
          [8, 8],
          [12, 5],
          [5, 11],
        ] as const) {
          const X = tx * L + u;
          const Y = ty * L + v;
          const cx = Math.floor(X - Y + base.ox);
          const cy = Math.floor((X + Y) / 2 + base.oy);
          const i = (cy * base.canvas.width + cx) * 4;
          const want = surroundingsAt(cx + SURROUND_PAD, cy + SURROUND_PAD);
          total++;
          if (base.canvas.data[i] === want[0] && base.canvas.data[i + 1] === want[1] && base.canvas.data[i + 2] === want[2]) same++;
        }
      }
    expect(same / total).toBeGreaterThan(0.97);
  });
});
