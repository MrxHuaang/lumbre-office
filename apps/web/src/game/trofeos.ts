// Las vitrinas de trofeos de las oficinas en la escena: encima del dibujo de cada vitrina va una capa con
// los trofeos del dueño de esa oficina (uno por logro, según su rareza), como las fotos del tablón. Los
// datos salen de GET /api/trophies y se vuelven a pedir al entrar al nivel y al desbloquear un logro.
import { catalogItem, footprint, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { trophyCase, trophyShelf } from "@hyvento/map/art";
import type { TrophyCaseDTO } from "@hyvento/shared";
import * as Phaser from "phaser";
import { create } from "zustand";
import { useAchievementStore } from "./achievements";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

const CASE = "trophy-case";

interface TrophyStore {
  /** Por zona de oficina. */
  cases: Record<string, TrophyCaseDTO>;
  refresh: () => Promise<void>;
}

export const useTrophyStore = create<TrophyStore>((set) => ({
  cases: {},
  refresh: async () => {
    try {
      const res = await fetch("/api/trophies", { cache: "no-store" });
      if (!res.ok) return;
      const list = (await res.json()) as TrophyCaseDTO[];
      set({ cases: Object.fromEntries(list.map((c) => [c.zoneId, c])) });
    } catch {
      // Sin datos, las vitrinas se ven vacías (el mueble del catálogo).
    }
  },
}));

export class TrophyCases {
  private map?: OfficeMap;
  private images: Phaser.GameObjects.Image[] = [];
  private unsubscribe: (() => void)[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe.push(
      useTrophyStore.subscribe((s, prev) => {
        if (s.cases !== prev.cases) this.redraw();
      }),
      // Un logro nuevo (propio): mi vitrina suma un trofeo.
      useAchievementStore.subscribe((s, prev) => {
        if (s.version !== prev.version && this.map && TrophyCases.hasCase(this.map)) void useTrophyStore.getState().refresh();
      }),
    );
  }

  static hasCase(map: OfficeMap) {
    return map.furniture.some((f) => f.type === CASE);
  }

  setArea(map: OfficeMap) {
    this.map = map;
    if (TrophyCases.hasCase(map)) void useTrophyStore.getState().refresh();
    this.redraw();
  }

  destroy() {
    this.unsubscribe.forEach((u) => u());
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
    const ts = map.tileSize;
    const cases = useTrophyStore.getState().cases;
    for (const f of map.furniture) {
      if (f.type !== CASE) continue;
      const zone = zoneAt(map, (f.x + 0.5) * ts, (f.y + 0.5) * ts);
      const dto = zone && cases[zone.id];
      const shelf = dto ? trophyShelf(dto.rarities) : [];
      if (shelf.length === 0) continue;
      this.images.push(this.layer(map, f, shelf));
    }
  }

  /** La capa en el mismo lugar, volteo y profundidad que el dibujo de la vitrina (ver furnitureImage). */
  private layer(map: OfficeMap, f: PlacedFurniture, shelf: ReturnType<typeof trophyShelf>) {
    const ts = map.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const [w, d] = footprint(item, f.facing);
    const key = `vitrina-${shelf.map((r) => r[0]).join("")}`;
    const s = trophyCase(shelf);
    ensureTexture(this.scene, key, () => s.canvas);
    const a = worldToScreen(f.x * ts, f.y * ts);
    return this.scene.add
      .image(a.x - (flip ? s.canvas.width - s.ox : s.ox), a.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts) + 0.01);
  }
}
