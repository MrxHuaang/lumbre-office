// El radar de señales del observatorio oye todo el mapa, pero cada nivel tiene sus propias coordenadas:
// aquí se proyecta un punto de cualquier nivel sobre el jardín (en tiles del jardín), sobre el edificio
// donde queda (la casa, el garaje o la torre del observatorio). Lo usan el panel del radar y sus tests.
import type { World } from "./index";

/** Qué edificio del jardín contiene cada nivel (los que no están aquí, la casa). */
const BUILDING: Record<string, string> = {
  "planta-baja": "house",
  "piso-2": "house",
  "piso-3": "house",
  sotano: "house",
  garaje: "garage",
  observatorio: "observatory",
};

/** Punto (x, y en píxeles de mundo del nivel `area`) → tiles del jardín. */
export function radarPosition(world: World, area: string, x: number, y: number): { x: number; y: number } | null {
  const garden = world.areas.get("jardin");
  const map = world.areas.get(area);
  if (!garden || !map) return null;
  const tx = x / map.tileSize;
  const ty = y / map.tileSize;
  if (area === "jardin") return { x: tx, y: ty };
  const type = BUILDING[area] ?? "house";
  const b = garden.furniture.find((f) => f.type === type);
  if (!b) return null;
  // Proporcional: el nivel entero cabe en el dibujo del edificio.
  return { x: b.x + (tx / map.width) * b.w, y: b.y + (ty / map.height) * b.d };
}
