// Qué se ve en el vidrio de las ventanas (puro, con tests): el clima del servidor y la hora del juego.
// Lo dibuja game/ventanas.ts.
import type { WindowTone, WindowWeather } from "@hyvento/map/art";
import type { Weather } from "@hyvento/shared";

/** Lo que se ve en el vidrio con ese clima (nada si está despejado, nublado o con niebla). */
export function windowWeatherOf(w: Weather): WindowWeather | null {
  if (w === "lluvia") return "rain";
  if (w === "tormenta") return "storm";
  if (w === "nieve") return "snow";
  return null;
}

/** El tinte del vidrio a esa hora del juego: el amanecer (7:00–7:59) y el atardecer (17:30–18:59). */
export function windowToneAt(minuteOfDay: number): WindowTone | null {
  if (minuteOfDay >= 7 * 60 && minuteOfDay < 8 * 60) return "dawn";
  if (minuteOfDay >= 17 * 60 + 30 && minuteOfDay < 19 * 60) return "dusk";
  return null;
}
