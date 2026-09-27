// Modo mesa del casino: al usar la ruleta o sentarse al blackjack, la cámara se acerca a la mesa y el
// juego se dibuja sobre ella (en vez de abrir una ventana). OfficeScene solo lo prende, lo apaga y le
// pasa los clics; la tira de abajo (components/casino/TableStrip.tsx) tiene fichas, saldo y botones.
import type { OfficeMap, PlacedFurniture } from "@hyvento/map";
import type * as Phaser from "phaser";
import { BlackjackTableView } from "./blackjackTable";
import { TableCamera } from "./camera";
import { RouletteTableView } from "./rouletteTable";

export type TableKind = "roulette" | "blackjack";

/** Mueble de ese tipo más cercano a (x, y) (px de mundo). */
function nearest(map: OfficeMap, type: string, x: number, y: number): PlacedFurniture | undefined {
  const ts = map.tileSize;
  const dist = (f: PlacedFurniture) => Math.hypot((f.x + f.w / 2) * ts - x, (f.y + f.d / 2) * ts - y);
  return map.furniture.filter((f) => f.type === type).sort((a, b) => dist(a) - dist(b))[0];
}

export class TableMode {
  private view: RouletteTableView | BlackjackTableView | null = null;
  private readonly cam: TableCamera;
  /** Personajes atenuados porque tapaban la mesa. */
  private faded = new Set<Phaser.GameObjects.Sprite>();

  constructor(private readonly scene: Phaser.Scene) {
    this.cam = new TableCamera(scene);
  }

  /** Mesa que se está jugando (o null). */
  get kind(): TableKind | null {
    return this.view?.kind ?? null;
  }

  /**
   * Entra a la mesa más cercana a `at` (el jugador). `mySeat` = banqueta del blackjack donde está
   * sentado. Devuelve false si en este nivel no hay esa mesa.
   */
  enter(kind: TableKind, map: OfficeMap, at: { x: number; y: number }, mySeat: () => number | null): boolean {
    if (this.view?.kind === kind) return true;
    this.view?.destroy();
    this.view = null;
    if (kind === "roulette") {
      const table = nearest(map, "roulette-table", at.x, at.y);
      if (!table) return false;
      const ts = map.tileSize;
      const wheel = nearest(map, "roulette-wheel", (table.x + table.w / 2) * ts, (table.y + table.d / 2) * ts);
      this.view = new RouletteTableView(this.scene, map, table, wheel, this.cam);
    } else {
      const table = nearest(map, "blackjack-table", at.x, at.y);
      if (!table) return false;
      this.view = new BlackjackTableView(this.scene, map, table, this.cam, mySeat);
    }
    this.view.start();
    return true;
  }

  /** Sale de la mesa: se borra lo dibujado y la cámara vuelve a seguir a `follow`. */
  exit(follow?: Phaser.GameObjects.Components.Transform) {
    if (!this.view) return;
    this.view.destroy();
    this.view = null;
    this.cam.release(follow);
  }

  /** Al destruir la escena: sin transiciones. */
  dispose() {
    this.view?.destroy();
    this.view = null;
    this.cam.stop();
  }

  update() {
    this.view?.update();
  }

  /**
   * Atenúa a quien esté parado delante de la mesa (con la cámara tan cerca, un personaje tapa medio
   * paño); al salir, todos vuelven a verse.
   */
  fadeAvatars(sprites: Iterable<Phaser.GameObjects.Sprite>) {
    const view = this.view;
    if (!view) {
      if (this.faded.size) for (const s of this.faded) if (s.active) s.setAlpha(1);
      this.faded.clear();
      return;
    }
    const c = view.cover;
    for (const s of sprites) {
      if (!s.active) continue;
      const b = s.getBounds();
      const covers = s.depth > view.depth && b.right > c.x && b.x < c.x + c.w && b.bottom > c.y && b.y < c.y + c.h;
      if (covers === this.faded.has(s)) continue;
      s.setAlpha(covers ? 0.3 : 1);
      if (covers) this.faded.add(s);
      else this.faded.delete(s);
    }
  }

  /** Clic en el modo mesa (lo consume siempre: en la mesa no se camina con el clic). */
  pointerDown(x: number, y: number): boolean {
    if (!this.view) return false;
    this.view.pointerDown(x, y);
    return true;
  }

  pointerMove(x: number, y: number): boolean {
    if (!this.view) return false;
    this.view.pointerMove(x, y);
    return true;
  }
}
