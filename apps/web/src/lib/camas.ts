// Dónde va acostado quien duerme en una cama (VIR-144): lo usan la escena y el test, sin Phaser.
import type { OfficeMap } from "@hyvento/map";

/**
 * Dónde va acostado quien duerme en esa cama (`Player.sleeping` = "nivel|tipo@x,y"): el medio de la cama,
 * en px de mundo (el pie del cuerpo, corrido hacia los pies de la cama), y hacia qué lado cae (el de la cabecera). null si la cama no es de este nivel.
 */
export function sitioDeCama(map: OfficeMap, sleeping: string | undefined): { x: number; y: number; side: 1 | -1 } | null {
  if (!sleeping) return null;
  const m = /^(.+)\|([\w-]+)@(-?\d+),(-?\d+)$/.exec(sleeping);
  if (!m || m[1] !== map.id) return null;
  const [, , type, sx, sy] = m;
  const f = map.furniture.find((p) => p.type === type && p.x === Number(sx) && p.y === Number(sy));
  if (!f) return null;
  const ts = map.tileSize;
  // El cuerpo gira desde los pies: van hacia los pies de la cama y la cabeza cae hacia la cabecera, que
  // queda atrás (al -x mirando a la derecha, al -y mirando abajo; de espaldas, al revés).
  const cx = (f.x + f.w / 2) * ts;
  const cy = (f.y + f.d / 2) * ts;
  const lejos = 0.12;
  switch (f.facing) {
    case "left":
      return { x: cx - f.w * ts * lejos, y: cy, side: 1 };
    case "up":
      return { x: cx, y: cy - f.d * ts * lejos, side: 1 };
    case "down":
      return { x: cx, y: cy + f.d * ts * lejos, side: -1 };
    default:
      return { x: cx + f.w * ts * lejos, y: cy, side: -1 };
  }
}
