// El contorno de la penumbra del cine (puntos de mundo con su altura), aparte de la escena para poder
// revisarlo sin Phaser. Es un solo polígono encima de todo, así que se recorta donde taparía lo de las
// salas vecinas: el alto de la pared baja del norte (menos donde hay algo parado al otro lado, en el
// pasillo) y, en el borde este, se sube sobre lo alto del arcade que se asoma por encima de la sala.
import { catalogItem, type OfficeMap, type Zone } from "@hyvento/map";
import { LOW_WALL_H, WALL_H } from "@hyvento/map/art";

/** Lo alto que se asoma de la sala vecina del este (máquinas de arcade), en px de arte. */
const NEIGHBOR_H = 30;

export interface OutlinePoint {
  x: number;
  y: number;
  /** Altura sobre el piso, en px de arte (como `worldToScreen`). */
  z: number;
}

/** ¿Hay un mueble que no es plano en el tile (tx, ty)? */
function tallAt(map: OfficeMap, tx: number, ty: number) {
  return map.furniture.some((f) => tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.d && !catalogItem(f.type).flat);
}

/**
 * Contorno de la penumbra: el piso de la sala, la pared oeste entera (la de la pantalla; el video va encima
 * del canvas, así que nunca queda tapado) y la pared baja del norte.
 */
export function penumbraOutline(map: OfficeMap, zone: Zone): OutlinePoint[] {
  const ts = map.tileSize;
  const x0 = zone.x;
  const y0 = zone.y;
  const x1 = zone.x + zone.width;
  const y1 = zone.y + zone.height;
  const pts: OutlinePoint[] = [
    { x: x0, y: y1, z: 0 },
    { x: x0, y: y1, z: WALL_H },
    { x: x0, y: y0, z: WALL_H },
  ];
  for (let tx = x0 / ts; tx < x1 / ts; tx++) {
    const z = tallAt(map, tx, y0 / ts - 1) ? 0 : LOW_WALL_H;
    pts.push({ x: tx * ts, y: y0, z }, { x: (tx + 1) * ts, y: y0, z });
  }
  for (let ty = y0 / ts; ty < y1 / ts; ty++) {
    // Lo alto se asoma también sobre la fila de antes (se dibuja hacia arriba en la pantalla).
    const z = tallAt(map, x1 / ts, ty) || tallAt(map, x1 / ts, ty + 1) ? NEIGHBOR_H : 0;
    pts.push({ x: x1, y: ty * ts, z }, { x: x1, y: (ty + 1) * ts, z });
  }
  pts.push({ x: x1, y: y1, z: 0 });
  return pts;
}
