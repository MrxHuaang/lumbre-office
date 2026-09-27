// Sonidos del clima: la lluvia de fondo (fuerte afuera, apagada adentro) y los truenos. Se engancha a los
// eventos de weatherEvents.ts; los efectos están en sfx.ts.
import type { Weather } from "@hyvento/shared";
import { setRainLevel, sfx } from "./sfx";
import { onThunder, onWeatherAmbience } from "./weatherEvents";

const RAIN: Partial<Record<Weather, number>> = { lluvia: 0.6, tormenta: 1 };

export function bindWeatherSounds(): () => void {
  const offAmbience = onWeatherAmbience(({ weather, outdoor }) => setRainLevel((RAIN[weather] ?? 0) * (outdoor ? 1 : 0.3)));
  const offThunder = onThunder(({ strength, indoor }) => sfx.thunder(strength, indoor));
  return () => {
    offAmbience();
    offThunder();
    setRainLevel(0);
  };
}
