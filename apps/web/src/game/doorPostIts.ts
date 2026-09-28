// Los post-its de las puertas de las oficinas: 1 a 3 pegados en la pared, al lado de la puerta, según
// cuántas notas tenga sin leer el dueño (`OfficeInfo.notes`). Solo muestran la cuenta: el texto lo lee el
// dueño en su panel.
import { wallAbove, type OfficeMap } from "@hyvento/map";
import { doorNotesArt, toScreen, WORLD_TO_ART } from "@hyvento/map/art";
import { doorPostIts } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { depthOf, ensureTexture } from "./iso/view";
import type { OfficeView } from "./store";

/** Cuánto se corren de la puerta (unidades de arte a lo largo de la pared: el hueco mide 16 y el marco 2). */
const BESIDE_DOOR = 10;
/** Ancho que ocupan los tres juntos (para pegarlos a la izquierda si a la derecha no hay pared). */
const SPAN = 14;
/** Altura sobre el piso (la pared baja mide 10). */
const LIFT = 1;

interface Placed {
  img: Phaser.GameObjects.Image;
  count: number;
  /** Borde de la puerta en tiles (para esconderlos en el modo privado si no son de la pared del frente). */
  tx: number;
  ty: number;
}

export class DoorPostIts {
  private map?: OfficeMap;
  private placed = new Map<string, Placed>();
  private veil: { x: number; y: number; w: number; h: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
  }

  /** Cambiaron las oficinas (o se dibujó el nivel): post-its según las notas sin leer de cada dueño. */
  update(offices: Record<string, OfficeView>) {
    const map = this.map;
    if (!map) return;
    for (const zone of map.zones) {
      if (zone.type !== "office" || !zone.doorEdge || !zone.door) continue;
      const office = offices[zone.id];
      const count = office?.ownerId ? doorPostIts(office.notes) : 0;
      const current = this.placed.get(zone.id);
      if (current?.count === count) continue;
      current?.img.destroy();
      this.placed.delete(zone.id);
      if (count === 0) continue;
      this.placed.set(zone.id, this.create(map, zone.doorEdge, zone.door, count));
    }
    this.applyVeil();
  }

  /** Modo privado (rect en tiles): solo quedan los de la pared del frente de la sala (la baja que se ve). */
  setVeil(rect: { x: number; y: number; w: number; h: number } | null) {
    this.veil = rect;
    this.applyVeil();
  }

  destroy() {
    this.clear();
  }

  private clear() {
    for (const p of this.placed.values()) p.img.destroy();
    this.placed.clear();
  }

  private applyVeil() {
    const r = this.veil;
    for (const p of this.placed.values()) p.img.setVisible(!r || (p.ty === r.y + r.h && p.tx >= r.x && p.tx < r.x + r.w));
  }

  private create(map: OfficeMap, edge: { x: number; y: number }, door: { x: number; y: number }, count: number): Placed {
    const ts = map.tileSize;
    const tx = Math.floor(edge.x / ts);
    const ty = Math.round(edge.y / ts);
    // A la derecha de la puerta si ahí sigue la pared; si no, a la izquierda.
    const right = wallAbove(map, tx + 1, ty) === 1 || wallAbove(map, tx - 1, ty) !== 1;
    const ax = edge.x * WORLD_TO_ART + (right ? BESIDE_DOOR : -BESIDE_DOOR - SPAN);
    // Del lado del pasillo (donde queda el tile de afuera de la puerta).
    const ay = edge.y * WORLD_TO_ART + Math.sign(door.y - edge.y) * 2.3;
    const s = doorNotesArt(count);
    const key = ensureTexture(this.scene, `post-its-${count}`, () => s.canvas);
    const p = toScreen(ax, ay, LIFT);
    const img = this.scene.add
      .image(p.x - s.ox, p.y - s.oy, key)
      .setOrigin(0, 0)
      // Delante del tramo de pared en el que van pegados (y detrás de quien pase por el pasillo).
      .setDepth(depthOf((ax + SPAN) / WORLD_TO_ART, edge.y) + 0.03);
    return { img, count, tx, ty };
  }
}
