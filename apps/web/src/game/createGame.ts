import Phaser from "phaser";
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
    banner: false,
    scene: [OfficeScene],
  });
}
