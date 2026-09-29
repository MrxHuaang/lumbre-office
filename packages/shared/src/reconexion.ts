// Reinicios del servidor de juego (cada deploy de Render le manda SIGTERM) y la ventana de reconexión.
// Lo comparten el servidor, que avisa y cierra, y el navegador, que reintenta.

/**
 * Código de cierre con el que el servidor saca a todos cuando se apaga para reiniciarse. No es 4000
 * (consentido, lo que Colyseus usa por defecto): el cliente tiene que distinguirlo para volver solo.
 */
export const RESTART_CLOSE_CODE = 4005;

/** Aviso a la sala justo antes de cerrar por reinicio (sin datos). */
export const RESTART_MSG = "server:restarting";

/** Cuántos segundos guarda el servidor el lugar de quien se cayó (su personaje queda quieto esperándolo). */
export const RECONNECT_WINDOW_SECONDS = 30;
