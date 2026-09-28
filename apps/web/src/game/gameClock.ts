import { gameTime, isNightMinute, type GameTime } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { serverNow } from "./club/store";
import { useOfficeStore } from "./store";

// Hora del juego en el navegador: el ancla llega del servidor y se proyecta con la hora del servidor
// (`serverNow`, corregida por el desfase medido), así todos ven la misma hora.

/** Hora del juego ahora, o null si todavía no llegó el reloj. */
export function currentGameTime(): GameTime | null {
  const clock = useOfficeStore.getState().gameClock;
  return clock ? gameTime(clock, serverNow()) : null;
}

/** ¿Es de noche en el juego? (sin reloj todavía, no). */
export function isGameNightNow(): boolean {
  const t = currentGameTime();
  return t ? isNightMinute(t.minuteOfDay) : false;
}

/** Hora del juego para React: se refresca cada segundo real (un minuto del juego). */
export function useGameTime(): GameTime | null {
  const clock = useOfficeStore((s) => s.gameClock);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return clock ? gameTime(clock, serverNow()) : null;
}
