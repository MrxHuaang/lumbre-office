// Reglas de pantalla del Año viejo (puras, con tests): qué campanada va sonando y qué parada de la maleta se
// señala. Lo que vale lo decide el servidor (rooms/anoViejo.ts); esto solo dice qué mostrar.
import { finCampanadas, type Campanadas } from "@hyvento/shared";

/** La campanada que va (1..12) o 0 si todavía no suena la primera; null si no hay campanadas o ya pasaron. */
export function campanadaActual(c: Campanadas | null, now: number): number | null {
  if (!c || now > finCampanadas(c)) return null;
  if (now < c.inicio) return 0;
  return Math.min(c.n, Math.floor((now - c.inicio) / c.intervalo) + 1);
}

/**
 * La parada de la maleta que se señala: la que sigue de la vuelta que voy dando o, con la maleta en la mano
 * y sin vuelta, la salida (la plaza). Null si no hay nada que señalar.
 */
export function paradaSenalada(siguiente: number | null, conMaleta: boolean): number | null {
  if (siguiente !== null) return siguiente;
  return conMaleta ? 0 : null;
}
