// Los atajos de teclado y los gestos de la cabaña, en un solo lugar: los muestran el "?" de la barra, la
// ayuda de atajos (menú y paleta) y la paleta de comandos al lado de cada comando. Antes de sumar una
// tecla nueva, mirar que no esté aquí (Tab ya es de la barra de la mochila y Enter del chat).
import { isEditableFocus, type FocusLike } from "./keyboardFocus";

/** ¿Mac? (ahí la paleta es ⌘K; en el resto, Ctrl K). */
export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const paletteKey = () => (isMac() ? "⌘ K" : "Ctrl K");

/** Teclas del juego: se muestran en la lista de controles. */
export function gameControls(): [string, string][] {
  return [
    [paletteKey(), "buscar: personas, lugares, ajustes…"],
    ["WASD", "caminar (o clic en el piso)"],
    ["E", "sentarte o usar"],
    ["F", "usar lo de la mano"],
    ["T", "emotes"],
    ["P", "foto"],
    ["C", "el celular (Enter: Mensajes)"],
    ["N", "nombres: completos, cortos u ocultos"],
    ["Enter", "chatear (abre Mensajes)"],
    ["Tab", "cambiar la fila de la barra"],
    ["1-9 0 - =", "elegir la casilla (la mano)"],
    ["I", "mochila, estadísticas y personaje"],
    ["Rueda", "acercar o alejar"],
    ["?", "esta ayuda"],
    ["/hora", "la hora del juego (/ muestra los comandos)"],
  ];
}

export const DECOR_CONTROLS: [string, string][] = [
  ["Clic", "poner o elegir"],
  ["R", "girar"],
  ["Supr", "guardar"],
  ["Esc", "soltar o terminar"],
];

/** En pantallas táctiles (celular, tablet). */
export const TOUCH_CONTROLS: [string, string][] = [
  ["Tocar", "caminar hasta ahí, o usar lo que tocas"],
  ["Arrastrar", "caminar: el dedo en la mitad izquierda, o el joystick de abajo"],
  ["E · F", "usar lo de al lado · lo de la mano"],
  ["2 dedos", "pellizcar para acercar o alejar"],
  ["Lupa", "buscar: personas, lugares, ajustes…"],
];

/** ¿Es un campo donde se escribe? (ahí las teclas son del texto, no del juego). */
export const isTypingTarget = (el: EventTarget | null) =>
  typeof Element !== "undefined" && el instanceof Element && isEditableFocus(el as unknown as FocusLike);
