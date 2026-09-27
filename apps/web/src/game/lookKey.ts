// Clave estable de un personaje, sin el motor de arte: la usan la portada (que carga las hojas
// pre-dibujadas en el build) y el script que las genera (scripts/prerender.ts).
import type { Look } from "@hyvento/shared";

/** Identificador estable de un look (mismo look → misma textura, aunque cambie el orden). */
export function lookId(look: Look): string {
  const canonical = JSON.stringify({ ...look, accessories: [...look.accessories].sort() });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) h = Math.imul(h ^ canonical.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Clave de textura de un personaje: el personaje fijo por nombre, o el look por su hash. */
export function characterKey(avatar: string, look: Look | null): string {
  return look ? `look-${lookId(look)}` : `fijo-${avatar}`;
}
