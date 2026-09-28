// Modo mesa del ajedrez y las damas: la cámara se acerca a la mesa de la sala de juegos (con las dos
// sillas y quienes juegan) y el tablero se juega en la tira de abajo (components/arcade/BoardGameStrip).
// Acá no se dibuja nada encima: solo el encuadre.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import { localToScreen, mesaFrame, tableZoom, type ScreenBox } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import type { TableCamera } from "./camera";
import { furnitureDepth } from "./draw";

/** Zoom de la mesa: de cerca, pero con lugar para las sillas y los personajes sentados. */
const BOARD_MIN_ZOOM = 3;
const BOARD_MAX_ZOOM = 8;
/** Alto (en arte) de lo que se encuadra sobre el piso: el respaldo de las sillas y las cabezas. */
const TOP_Z = 34;

export class BoardTableView {
  readonly kind = "boardgame" as const;
  readonly depth: number;
  private readonly rect: ScreenBox;

  constructor(
    _scene: Phaser.Scene,
    map: OfficeMap,
    table: PlacedFurniture,
    private readonly cam: TableCamera,
  ) {
    const fr = mesaFrame(table);
    this.depth = furnitureDepth(map, table);
    // La mesa (un tile) y una silla a cada lado en x, del piso hasta arriba de las cabezas.
    const pts = [];
    for (const [u, v] of [
      [-16, 0],
      [32, 0],
      [-16, 16],
      [32, 16],
    ] as const)
      for (const z of [0, TOP_Z]) pts.push(localToScreen(fr, u, v, z));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    this.rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  start() {
    this.cam.focus(this.rect, tableZoom(this.cam.viewport, this.rect, BOARD_MIN_ZOOM, BOARD_MAX_ZOOM));
  }

  /** No se atenúa a nadie: se quiere ver a los que juegan (el tablero está en la tira). */
  get cover(): ScreenBox {
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  update() {}

  pointerDown() {}

  pointerMove() {}

  destroy() {}
}
