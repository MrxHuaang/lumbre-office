// Lo que mandan los controles táctiles (components/facilidad/TouchControls.tsx) a la escena: el joystick
// (una dirección de pantalla, -1 a 1 en cada eje) y los toques de los botones E y F. La escena los lee en
// cada cuadro junto con el teclado (`joystickVector`, `takeTouchTaps`), así todo pasa por el mismo camino.

let stick = { x: 0, y: 0 };
let taps = { e: false, f: false };

/** El joystick: x a la derecha, y hacia abajo de la pantalla; (0, 0) suelto. */
export function setJoystick(x: number, y: number) {
  stick = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
}

/**
 * La dirección del joystick en ejes del mundo (como las teclas: arriba en la pantalla es noroeste y
 * noreste a la vez), o null si está suelto. Se usa como las flechas: velocidad de caminar pareja.
 */
export function joystickVector(): { vx: number; vy: number } | null {
  if (Math.hypot(stick.x, stick.y) < 0.25) return null;
  return { vx: stick.y + stick.x, vy: stick.y - stick.x };
}

/** Un toque del botón E o F (se consume en el próximo cuadro). */
export function tapTouch(key: "e" | "f") {
  taps = { ...taps, [key]: true };
}

export function takeTouchTaps(): { e: boolean; f: boolean } {
  const out = taps;
  taps = { e: false, f: false };
  return out;
}

/** ¿El puntero principal es un dedo? (en una laptop con pantalla táctil manda el mouse: no se muestran). */
export function isTouchScreen(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.matchMedia?.("(pointer: coarse)").matches;
}
