// Cuadros de la Pintura colgados en las oficinas: el mueble `cuadro:<id>` se dibuja con el lienzo en
// blanco y encima va una capa con sus píxeles, que se piden a /api/paintings/<id> (no cambian nunca, así
// que se guardan en memoria, ver paintingStore.ts). Mismo truco que las fotos del tablón (photos/board.ts).
import { catalogItem, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { paintingSprite } from "@hyvento/map/art";
import { paintingIdOf, type PaintingDTO } from "@hyvento/shared";
import * as Phaser from "phaser";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";
import { usePaintingStore } from "./paintingStore";

export class PaintingLayers {
  private map?: OfficeMap;
  private images: Phaser.GameObjects.Image[] = [];
  private unsubscribe: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = usePaintingStore.subscribe((s, prev) => {
      if (s.byId !== prev.byId) this.redraw();
    });
  }

  setArea(map: OfficeMap) {
    this.map = map;
    this.redraw();
  }

  destroy() {
    this.unsubscribe();
    this.clear();
  }

  private clear() {
    this.images.forEach((i) => i.destroy());
    this.images = [];
  }

  private redraw() {
    this.clear();
    const map = this.map;
    if (!map || !this.scene.sys.isActive()) return;
    const { byId, request } = usePaintingStore.getState();
    for (const f of map.furniture) {
      const id = paintingIdOf(f.type);
      if (!id) continue;
      const painting = byId[id];
      if (painting === undefined) request(id);
      if (painting) this.images.push(this.layer(map, f, painting));
    }
  }

  /** La capa en el mismo lugar, volteo y profundidad que el marco (ver furnitureImage en iso/view.ts). */
  private layer(map: OfficeMap, f: PlacedFurniture, painting: PaintingDTO) {
    const ts = map.tileSize;
    const item = catalogItem(f.type);
    const flip = f.facing === "down" || f.facing === "up";
    // Espejado de antemano: la escena voltea el mueble y así el dibujo se lee al derecho.
    const key = `capa-cuadro-${painting.id}-${flip ? 1 : 0}`;
    const s = paintingSprite(painting.pixels, flip);
    const [w, d] = footprint(item, f.facing);
    const a = worldToScreen(f.x * ts, f.y * ts);
    ensureTexture(this.scene, key, () => s.canvas);
    return this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + 0.01);
  }
}
