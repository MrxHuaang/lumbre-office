// Las ventanas con el clima y la luz del juego: capas que van sobre el vidrio de las ventanas de la pared
// (el tipo "window" de room.ts, que ya se dibuja de día o de noche). Gotas que bajan con lluvia o
// tormenta, nieve que se junta en las esquinas y un tinte cálido al amanecer y al atardecer. Tienen la
// misma caja que la cortina cerrada (casa-fx.ts): el origen es la esquina de la ventana en la pared.
import { C } from "./palette";
import { at, noise, renderSprite, type RGBA, type Shader, type Sprite } from "./pixel";

/** Lo que se ve en el vidrio según el clima. */
export type WindowWeather = "rain" | "storm" | "snow";
/** El tinte del vidrio según la hora. */
export type WindowTone = "dawn" | "dusk";
/** Cuadros de la animación de las gotas (la nieve no se mueve). */
export const WINDOW_RAIN_FRAMES = 4;

/** Lo que mide el vidrio (como `windowAt` de room.ts): de dónde a dónde va, el parteluz y el travesaño. */
const GLASS = { u0: 6, v0: 24, v1: 44 };

/** ¿(u, hv) cae sobre el vidrio de una ventana de `len` px (sin el marco, el parteluz ni el travesaño)? */
function onGlass(u: number, hv: number, len: number): boolean {
  if (u < GLASS.u0 || u >= len - GLASS.u0 || hv < GLASS.v0 || hv >= GLASS.v1) return false;
  return Math.abs(u - len / 2) >= 1 && !(hv >= 33 && hv < 35);
}

/** La caja delgada sobre el vidrio, del lado de adentro de la pared (como la cortina, un poco más atrás). */
function glassSprite(edge: "h" | "v", width: number, pixel: (u: number, hv: number) => RGBA | null): Sprite {
  const len = width * 16;
  const shade: Shader = (u, v) => {
    // La caja empieza a 1 px de la esquina y a la altura del vidrio.
    const wu = u + 1;
    const hv = GLASS.v0 + v;
    return onGlass(wu, hv, len) ? pixel(wu, hv) : null;
  };
  const h = GLASS.v1 - GLASS.v0;
  const box =
    edge === "h"
      ? { x: 1, y: -0.5, z: GLASS.v0, w: len - 2, d: 0.5, h, left: shade }
      : { x: -0.5, y: 1, z: GLASS.v0, w: 0.5, d: len - 2, h, right: shade };
  return renderSprite([box]);
}

/**
 * Gotas en el vidrio: cada columna tiene la suya (sorteada con la semilla de la columna), que baja en
 * `WINDOW_RAIN_FRAMES` cuadros dejando una estela. Con tormenta hay más y caen de lado.
 */
export function windowRain(edge: "h" | "v", width: number, kind: WindowWeather, frame: number): Sprite {
  const len = width * 16;
  const f = frame % WINDOW_RAIN_FRAMES;
  if (kind === "snow") {
    return glassSprite(edge, width, (u, hv) => {
      // Nieve en el borde de abajo de cada hoja (la de abajo y la de arriba del travesaño), dispareja, y
      // algún copo pegado al vidrio. En el arte, hv crece hacia arriba.
      const pane = hv < 33 ? GLASS.v0 : 35;
      const pile = 1.5 + noise(Math.floor(u), 0, 61) * 1.6;
      if (hv - pane < pile) return at(C.white, hv - pane < pile - 1 ? 4 : 3);
      return noise(Math.floor(u), Math.floor(hv), 47) < 0.025 ? at(C.white, 4) : null;
    });
  }
  const storm = kind === "storm";
  const span = GLASS.v1 - GLASS.v0;
  return glassSprite(edge, width, (u, hv) => {
    const col = Math.floor(u);
    // Una de cada tantas columnas lleva gota (más con tormenta); con tormenta caen de lado.
    const lean = storm ? Math.floor((hv - GLASS.v0) * 0.35) : 0;
    const c = col - lean;
    if (noise(c, 0, 53) > (storm ? 0.7 : 0.5)) return null;
    // Dos gotas por columna, a media vuelta una de otra, cada columna con su desfase: bajan (hv crece
    // hacia arriba) y dejan la estela encima.
    const speed = storm ? 1.5 : 1;
    const trail = storm ? 5 : 4;
    for (const k of [0, 0.5]) {
      const head = GLASS.v1 - (((noise(c, 1, 53) + k) * span + (f * span * speed) / WINDOW_RAIN_FRAMES) % span);
      const d = hv - head;
      if (d >= 0 && d < 1) return at(C.white, 4);
      if (d >= 1 && d < trail) return at(C.sky, d < 2.5 ? 4 : 3);
    }
    return null;
  });
}

/** El vidrio teñido por la luz del amanecer (rosado) o del atardecer (naranja), más fuerte abajo. */
export function windowTone(edge: "h" | "v", width: number, tone: WindowTone): Sprite {
  return glassSprite(edge, width, (u, hv) => {
    const t = (hv - GLASS.v0) / (GLASS.v1 - GLASS.v0);
    // Puntitos en trama (no hay transparencia parcial en el arte): más tupidos cerca del horizonte.
    if (noise(Math.floor(u), Math.floor(hv), 59) > 0.75 - t * 0.5) return null;
    return tone === "dusk" ? at(C.fire, t < 0.5 ? 3 : 4) : at(C.rug, t < 0.5 ? 5 : 4);
  });
}
