import * as Phaser from "phaser";
import { OfficeScene } from "./OfficeScene";
import { guardDepthSort } from "./iso/depthGuard";
import { PIXEL_RATIO } from "./pixelRatio";

/**
 * Espera a que el contenedor tenga tamaño real. Si Phaser arranca con 0x0 (pestaña en segundo plano
 * o aún sin layout), WebGL falla al crear su framebuffer y el juego queda muerto.
 */
export function waitForSize(el: HTMLElement): Promise<void> {
  if (el.clientWidth > 0 && el.clientHeight > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
  });
}

/** Espera a que la pestaña esté visible (arrancar el juego en segundo plano puede fallar). */
export function waitForVisible(): Promise<void> {
  if (document.visibilityState === "visible") return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

export function createGame(parent: HTMLElement) {
  guardDepthSort();
  const game = new Phaser.Game({
    // Canvas 2D en vez de WebGL: más compatible (GPUs integradas, Brave, pestañas en segundo plano)
    // y de sobra para un mapa pixel-art de este tamaño.
    type: Phaser.CANVAS,
    parent,
    pixelArt: true,
    roundPixels: true,
    // Transparente: alrededor del mapa se ve el papel con semitono del contenedor.
    transparent: true,
    // A la resolución real de la pantalla (ver pixelRatio.ts): el canvas mide PIXEL_RATIO veces el
    // contenedor y se muestra achicado a su tamaño (zoom), así no lo estira el navegador.
    scale: { mode: Phaser.Scale.NONE, width: parent.clientWidth * PIXEL_RATIO, height: parent.clientHeight * PIXEL_RATIO, zoom: 1 / PIXEL_RATIO },
    input: { keyboard: true, mouse: { preventDefaultWheel: false } },
    disableContextMenu: true,
    // Contenedor DOM: burbujas de cámara y pantallas de la sala (siguen la cámara y el zoom del juego).
    dom: { createContainer: true },
    banner: false,
    // Tope de cuadros: en pantallas de 120/144 Hz se dibujaba al doble (o más) sin que se note, y el
    // pixel-art se mueve por píxeles enteros. 75 y no 60: con 60 exacto el temblor del reloj salta cuadros
    // en pantallas de 60 Hz; así quedan 60 en 60/120/240 Hz y 72 en 144 Hz (el movimiento usa el delta).
    fps: { limit: 75 },
    scene: [OfficeScene],
  });
  // Sin el modo RESIZE, el tamaño sigue al contenedor a mano.
  const ro = new ResizeObserver(() => {
    if (parent.clientWidth > 0 && parent.clientHeight > 0) game.scale.resize(parent.clientWidth * PIXEL_RATIO, parent.clientHeight * PIXEL_RATIO);
  });
  ro.observe(parent);
  game.events.once(Phaser.Core.Events.DESTROY, () => ro.disconnect());
  // Solo en desarrollo: el juego queda a mano en la consola para depurar (window.__hyventoGame).
  if (process.env.NODE_ENV !== "production") (window as unknown as { __hyventoGame?: Phaser.Game }).__hyventoGame = game;
  return game;
}
