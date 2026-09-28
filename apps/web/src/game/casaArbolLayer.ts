// La escalera de la casa del árbol en el jardín: con la escalera recogida, la que cuelga se esconde y va el
// rollo con el cartel "OCUPADO" (el estado viene de casaArbol.ts).
import { catalogItem, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { drawTreeLadder } from "@hyvento/map/art";
import type * as Phaser from "phaser";
import { useCasaArbolStore } from "./casaArbol";
import { depthOf, ensureTexture, worldToScreen, type AreaView } from "./iso/view";

const LADDER = "treehouse-ladder";
const ROLLED_KEY = "casa-arbol-escalera-recogida";

/**
 * En el jardín: con la escalera recogida, la que cuelga se esconde y en su lugar va el rollo con el cartel
 * "OCUPADO" (mismo lienzo y origen, así calza exacto).
 */
export class TreeLadderLayer {
  private view?: AreaView;
  private ladder?: PlacedFurniture;
  private rolled?: Phaser.GameObjects.Image;
  private unsubscribe: () => void;
  private map?: OfficeMap;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = useCasaArbolStore.subscribe((s, prev) => {
      if (s.locked !== prev.locked) this.refresh();
    });
  }

  setArea(map: OfficeMap, view: AreaView) {
    this.rolled?.destroy();
    this.rolled = undefined;
    this.map = map;
    this.view = view;
    this.ladder = map.furniture.find((f) => f.type === LADDER);
    this.refresh();
  }

  private refresh() {
    const f = this.ladder;
    const map = this.map;
    if (!f || !map || !this.view) return;
    const locked = useCasaArbolStore.getState().locked;
    this.view.setFurnitureVisible(f, !locked);
    if (!locked) {
      this.rolled?.setVisible(false);
      return;
    }
    if (!this.rolled) {
      const s = drawTreeLadder(true);
      const key = ensureTexture(this.scene, ROLLED_KEY, () => s.canvas);
      const ts = map.tileSize;
      const a = worldToScreen(f.x * ts, f.y * ts);
      const depth = catalogItem(f.type).flat ? -1e6 : depthOf((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
      this.rolled = this.scene.add.image(a.x - s.ox, a.y - s.oy, key).setOrigin(0, 0).setDepth(depth);
      this.view.attach(f, this.rolled);
    }
    this.rolled.setVisible(true);
  }

  destroy() {
    this.unsubscribe();
    this.rolled?.destroy();
  }
}
