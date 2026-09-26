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

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
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
