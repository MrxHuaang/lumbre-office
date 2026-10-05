// Las vitrinas de trofeos de las oficinas en la escena: encima del dibujo de cada vitrina va una capa con
// los trofeos del dueño de esa oficina (uno por logro, según su rareza), como las fotos del tablón. Los
// datos salen de GET /api/trophies y se vuelven a pedir al entrar al nivel y al desbloquear un logro. La
// vitrina de la casa propia es de su dueño (sus logros salen de su perfil público, GET /api/profile/[id]).
import { catalogItem, footprint, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { trophyCase, trophyShelf } from "@hyvento/map/art";
import { rarityCounts, type ProfileDTO, type TrophyCaseDTO } from "@hyvento/shared";
import { casaOwnerOf } from "@/lib/casaGaleria";
import * as Phaser from "phaser";
import { create } from "zustand";
import { useAchievementStore } from "./achievements";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

const CASE = "trophy-case";

interface TrophyStore {
  /** Por zona de oficina (y `casa:<userId>` para la vitrina de una casa). */
  cases: Record<string, TrophyCaseDTO>;
  refresh: () => Promise<void>;
  /** La vitrina de la casa de esa persona. */
  refreshCasa: (ownerId: string) => Promise<void>;
}

/** La clave de la vitrina de la casa de alguien en `cases`. */
export const casaCaseKey = (ownerId: string) => `casa:${ownerId}`;

export const useTrophyStore = create<TrophyStore>((set) => ({
  cases: {},
  refreshCasa: async (ownerId) => {
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(ownerId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const p = (await res.json()) as ProfileDTO;
      const rarities = rarityCounts(p.achievements.filter((a) => a.unlockedAt).map((a) => a.id));
      const dto: TrophyCaseDTO = {
        zoneId: casaCaseKey(ownerId),
        ownerId,
        ownerName: p.name,
        count: Object.values(rarities).reduce((a, b) => a + b, 0),
        rarities,
      };
      set((s) => ({ cases: { ...s.cases, [dto.zoneId]: dto } }));
    } catch {
      // Sin datos, la vitrina se ve vacía.
    }
  },
  refresh: async () => {
    try {
      const res = await fetch("/api/trophies", { cache: "no-store" });
      if (!res.ok) return;
      const list = (await res.json()) as TrophyCaseDTO[];
      // Las de las casas se quedan (no vienen en esta lista).
      set((s) => {
        const casas = Object.entries(s.cases).filter(([k]) => k.startsWith("casa:"));
        return { cases: Object.fromEntries([...casas, ...list.map((c) => [c.zoneId, c] as const)]) };
      });
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
        if (s.version !== prev.version && this.map && TrophyCases.hasCase(this.map)) this.load(this.map);
      }),
    );
  }

  static hasCase(map: OfficeMap) {
    return map.furniture.some((f) => f.type === CASE);
  }

  setArea(map: OfficeMap) {
    this.map = map;
    if (TrophyCases.hasCase(map)) this.load(map);
    this.redraw();
  }

  /** Pide lo de las vitrinas del nivel: la de la casa (su dueño) o las de las oficinas. */
  private load(map: OfficeMap) {
    const owner = casaOwnerOf(map.id);
    const store = useTrophyStore.getState();
    void (owner ? store.refreshCasa(owner) : store.refresh());
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
      const owner = casaOwnerOf(map.id);
      const zone = owner ? undefined : zoneAt(map, (f.x + 0.5) * ts, (f.y + 0.5) * ts);
      const dto = owner ? cases[casaCaseKey(owner)] : zone && cases[zone.id];
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
