// Zonas de clic (y de toque) de los objetos que no tienen un mueble propio donde hacer clic: la escalera
// de la piscina y la estación del Megabús (se hace clic justo en el tile del rombito) y la astrónoma del
// observatorio (en su cuerpo). Así se usan igual que los que sí lo tienen: clic para ir y, al llegar, se
// abren (sin necesidad de la tecla E, que en el celular no hay).
import { pointsOfType, type OfficeMap } from "@hyvento/map";
import { screenToWorld } from "./iso/projection";
import type { Interactable } from "./store";

interface Spec {
  kind: Interactable;
  point: string;
  furniture: readonly string[];
}

/**
 * El objeto sin mueble bajo el puntero: el tile de su punto (mirando un poco más abajo, como los muebles:
 * el clic cae en lo alto del dibujo) o, para la astrónoma, su cuerpo (`staffUnder`, lo sabe la escena).
 */
export function pointSpotUnder(
  map: OfficeMap,
  sx: number,
  sy: number,
  specs: readonly Spec[],
  staffUnder: string | null,
): { kind: Interactable; x: number; y: number } | null {
  const ts = map.tileSize;
  if (staffUnder === "astronoma") {
    const p = pointsOfType(map, "astronomer")[0];
    if (p) return { kind: "astronomer", x: p.x, y: p.y };
  }
  const bare = specs.filter((s) => s.furniture.length === 0 && s.kind !== "astronomer");
  for (let lift = 0; lift <= 12; lift += 4) {
    const w = screenToWorld(sx, sy + lift);
    const tx = Math.floor(w.x / ts);
    const ty = Math.floor(w.y / ts);
    for (const spec of bare) {
      const p = pointsOfType(map, spec.point).find((q) => q.tileX === tx && q.tileY === ty);
      if (p) return { kind: spec.kind, x: p.x, y: p.y };
    }
  }
  return null;
}
