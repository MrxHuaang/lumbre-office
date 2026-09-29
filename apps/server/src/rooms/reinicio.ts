import { RESTART_CLOSE_CODE, RESTART_MSG } from "@hyvento/shared";
import type { Room } from "colyseus";

/**
 * El servidor se apaga (SIGTERM de un deploy): avisa a todos y cierra con el código de reinicio. Colyseus
 * por defecto cierra con 4000 (consentido) y el cliente lo tomaba como salida voluntaria; con este código
 * el navegador sabe que tiene que volver solo, pidiendo acceso nuevo si hace falta.
 */
export function closeForRestart(room: Room): Promise<unknown> {
  room.broadcast(RESTART_MSG, {});
  return room.disconnect(RESTART_CLOSE_CODE);
}
