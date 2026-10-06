// La Feria de las flores en la escena: la silleta exhibida encima de cada exhibidor del patio de la feria
// (para todos), como los cuadros de la Pintura. Lo exhibido sale de `useFeriaStore` (feriaFlores.ts).
import { type OfficeMap } from "@hyvento/map";
import { silletaOnStand } from "@hyvento/map/art";
import { standKey } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { setFeriaMap, useFeriaStore } from "./feriaFlores";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

/** El dibujo de cada silleta sobre su exhibidor (no cambia: se arma una vez por código). */
const standSprites = new Map<string, ReturnType<typeof silletaOnStand>>();
function standSprite(code: string) {
  let s = standSprites.get(code);
  if (!s) standSprites.set(code, (s = silletaOnStand(code)));
  return s;
}

/**
 * Pone encima de cada exhibidor del nivel la silleta exhibida ahí (para todos): el exhibidor con su
 * silleta, mismo ancla y un poco más adelante que el mueble.
 */
export class SilletasVivas {
  private map?: OfficeMap;
  private images: Phaser.GameObjects.Image[] = [];
  private unsubscribe: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = useFeriaStore.subscribe((s, prev) => {
      if (s.exhibits !== prev.exhibits) this.redraw();
    });
  }

  setArea(map: OfficeMap) {
    this.map = map;
    setFeriaMap(map);
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
    const { exhibits } = useFeriaStore.getState();
    const ts = map.tileSize;
    for (const f of map.furniture) {
      if (f.type !== "silleta-stand") continue;
      const e = exhibits[standKey(f.x, f.y)];
      if (!e) continue;
      const key = `capa-silleta-${e.code}`;
      const s = standSprite(e.code);
      ensureTexture(this.scene, key, () => s.canvas);
      const a = worldToScreen(f.x * ts, f.y * ts);
      this.images.push(
        this.scene.add
          .image(a.x - s.ox, a.y - s.oy, key)
          .setOrigin(0, 0)
          .setDepth(depthOf((f.x + 0.5) * ts, (f.y + 0.5) * ts) + 0.01),
      );
    }
  }
}
