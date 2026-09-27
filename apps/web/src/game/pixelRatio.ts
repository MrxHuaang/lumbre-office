// Píxeles de pantalla por px CSS (pantallas al 125 %, retina…). El canvas del juego se dibuja a esa
// resolución y se muestra al tamaño CSS: así el navegador no lo estira (lo que dejaba todo borroso) y la
// cámara trabaja en píxeles de pantalla. Se toma una vez, al arrancar el juego.
export const PIXEL_RATIO = typeof window === "undefined" ? 1 : Math.min(3, Math.max(1, window.devicePixelRatio || 1));

/**
 * Zoom de cámara para un zoom "de siempre" (px CSS por px de mundo): redondeado a píxeles de pantalla
 * enteros, así cada píxel del arte ocupa lo mismo (el pixel-art queda parejo y nítido).
 */
export const cameraZoom = (cssZoom: number) => Math.max(1, Math.round(cssZoom * PIXEL_RATIO));

/** El zoom "de siempre" que corresponde a un zoom de cámara. */
export const cssZoomOf = (camZoom: number) => camZoom / PIXEL_RATIO;
