import * as Phaser from "phaser";
import { OfficeScene } from "./OfficeScene";

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
  return new Phaser.Game({
    // Canvas 2D en vez de WebGL: más compatible (GPUs integradas, Brave, pestañas en segundo plano)
    // y de sobra para un mapa pixel-art de este tamaño.
    type: Phaser.CANVAS,
    parent,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#161824",
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    input: { keyboard: true, mouse: { preventDefaultWheel: false } },
    disableContextMenu: true,
    // Contenedor DOM: burbujas de cámara y pantallas de la sala (siguen la cámara y el zoom del juego).
    dom: { createContainer: true },
    banner: false,
    scene: [OfficeScene],
  });
}
