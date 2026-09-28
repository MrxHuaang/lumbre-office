// Noche automática y botón manual. La noche la manda el reloj del juego (`autoNight`); el botón del HUD
// la fuerza al revés (`nightOverride`) y otro clic vuelve al reloj. El forzado se suelta solo cuando el
// reloj lo alcanza (forzaste la noche a las 15:00: a las 19:00 ya es automática otra vez).

export interface NightState {
  /** Lo que se ve. */
  night: boolean;
  /** Lo que dice el reloj del juego. */
  autoNight: boolean;
  /** Forzado a mano (null = sigue al reloj). */
  nightOverride: boolean | null;
}

/** El reloj dice `auto`: si alcanzó al forzado, este se suelta. */
export function withAutoNight(s: NightState, auto: boolean): NightState {
  const nightOverride = s.nightOverride === auto ? null : s.nightOverride;
  return { autoNight: auto, nightOverride, night: nightOverride ?? auto };
}

/** Clic en el botón: se ve lo contrario; si eso coincide con el reloj, vuelve a automático. */
export function toggledNight(s: NightState): NightState {
  const night = !s.night;
  return { autoNight: s.autoNight, nightOverride: night === s.autoNight ? null : night, night };
}
