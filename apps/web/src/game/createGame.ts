import * as Phaser from "phaser";
import { OfficeScene } from "./OfficeScene";

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
