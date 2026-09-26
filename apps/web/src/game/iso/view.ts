// Proyección isométrica y render de un nivel de la cabaña en Phaser.
// El juego usa píxeles de mundo (tile de 32); el arte usa unidades de arte (tile de 16): arte = mundo / 2.
import {
  catalogItem,
  wallAbove,
  wallLeftOf,
  type OfficeMap,
  type PlacedFurniture,
  type WallFeatureKind,
} from "@hyvento/map";
import {
  WORLD_TO_ART,
  drawAreaBase,
  drawFurniture,
  drawLowWall,
  glowSprite,
  toScreen,
  toWorld,
  type Sprite,
} from "@hyvento/map/art";
import * as Phaser from "phaser";
import { ensureTexture } from "./canvas";

export { ensureTexture, toHtmlCanvas } from "./canvas";

/** Punto del mundo (px de juego, z en px de pantalla) → coordenadas de pantalla del juego. */
export function worldToScreen(x: number, y: number, z = 0) {
  return toScreen(x * WORLD_TO_ART, y * WORLD_TO_ART, z);
}

/** Pantalla → mundo sobre el piso (z = 0). */
export function screenToWorld(sx: number, sy: number) {
  const a = toWorld(sx, sy);
  return { x: a.x / WORLD_TO_ART, y: a.y / WORLD_TO_ART };
}

/** Profundidad isométrica: lo que está más abajo-adelante (mayor x + y) se dibuja encima. */
export const depthOf = (x: number, y: number) => x + y;
const DEPTH_FLOOR = -1e7;
const DEPTH_FLAT = -1e6;
export const DEPTH_OVERLAY = 1e7;

function spriteTexture(scene: Phaser.Scene, key: string, make: () => Sprite): Sprite {
  const s = make();
  ensureTexture(scene, key, () => s.canvas);
  return s;
}

/** Un nivel dibujado: fondo, muebles, paredes bajas y luces. Se destruye al cambiar de nivel. */
export class AreaView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private base!: Phaser.GameObjects.Image;
  private nightLayer: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  /** Muebles con versión nocturna (la cabaña): se les cambia la textura con la noche. */
  private nightly: { img: Phaser.GameObjects.Image; type: string; variant: "front" | "back"; flip: boolean; ax: number; ay: number }[] = [];
  /** Posición en pantalla de lo colgado en las paredes (p. ej. la pantalla de la sala). */
  readonly features: { kind: WallFeatureKind; x: number; y: number; tileX: number; tileY: number }[] = [];
  /** Rectángulo de pantalla que ocupa el nivel (para la cámara). */
  readonly bounds: Phaser.Geom.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly map: OfficeMap,
    night: boolean,
  ) {
    this.drawBase(night);
    for (const f of map.furniture) this.placeFurniture(f, night);
    this.placeLowWalls();
    const b = this.base.getBounds();
    this.bounds = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
    // De noche afuera está oscuro; adentro las luces están prendidas, así que solo se tiñe de azul.
    const [tint, strength] = map.outdoor ? [0x4a3f8a, 0.6] : [0xb4a6e0, 0.55];
    this.nightLayer = scene.add
      .rectangle(b.centerX, b.centerY, b.width + 800, b.height + 800, tint, strength)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH_OVERLAY)
      .setVisible(night);
    this.objects.push(this.nightLayer);
    this.setNight(night);
  }

  private drawBase(night: boolean) {
    const key = `area-${this.map.id}-${night ? "noche" : "dia"}`;
    let art: ReturnType<typeof drawAreaBase> | null = null;
    if (!this.scene.textures.exists(key)) {
      art = drawAreaBase(this.map, !night);
      ensureTexture(this.scene, key, () => art!.base.canvas);
      this.scene.registry.set(`${key}-origin`, { ox: art.base.ox, oy: art.base.oy });
    }
    const { ox, oy } = this.scene.registry.get(`${key}-origin`) as { ox: number; oy: number };
    if (this.base) {
      this.base.setTexture(key).setPosition(-ox, -oy);
    } else {
      this.base = this.scene.add.image(-ox, -oy, key).setOrigin(0, 0).setDepth(DEPTH_FLOOR);
      this.objects.push(this.base);
    }
    if (this.features.length === 0) {
      for (const f of this.map.def.features) {
        const len = (f.width ?? 1) * this.map.tileSize;
        const wx = f.edge === "h" ? f.x * this.map.tileSize + len / 2 : f.x * this.map.tileSize;
        const wy = f.edge === "h" ? f.y * this.map.tileSize : f.y * this.map.tileSize + len / 2;
        const s = worldToScreen(wx, wy, 35);
        this.features.push({ kind: f.kind, x: s.x, y: s.y, tileX: f.x, tileY: f.y });
      }
    }
  }

  private furnitureKey(type: string, variant: "front" | "back", night: boolean) {
    return catalogItem(type).hasNight ? `mueble-${type}-${variant}-${night ? "noche" : "dia"}` : `mueble-${type}-${variant}`;
  }

  private placeFurniture(f: PlacedFurniture, night: boolean) {
    const item = catalogItem(f.type);
    const back = (f.facing === "left" || f.facing === "up") && item.hasBack;
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
    const variant = back ? "back" : "front";
    const key = this.furnitureKey(f.type, variant, night);
    const s = spriteTexture(this.scene, key, () => drawFurniture(f.type, variant, night));
    const ts = this.map.tileSize;
    const anchor = worldToScreen(f.x * ts, f.y * ts);
    const img = this.scene.add
      .image(anchor.x - (flip ? s.canvas.width - s.ox : s.ox), anchor.y - s.oy, key)
      .setOrigin(0, 0)
      .setFlipX(flip)
      .setDepth(item.flat ? DEPTH_FLAT : depthOf((f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts));
    this.objects.push(img);
    if (item.hasNight) this.nightly.push({ img, type: f.type, variant, flip, ax: anchor.x, ay: anchor.y });

    if (item.light) {
      const [lx, ly, lz] = item.light.at;
      // La luz está en coordenadas locales de arte del dibujo "right": se lleva al mundo según el volteo.
      const local = flip ? { x: ly, y: lx } : { x: lx, y: ly };
      const p = worldToScreen(f.x * ts + local.x / WORLD_TO_ART, f.y * ts + local.y / WORLD_TO_ART, lz);
      const r = item.light.radius;
      const gkey = ensureTexture(this.scene, `luz-${item.light.color}-${r}`, () => glowSprite(r, Math.round(r * 0.6), item.light!.color, 0.55));
      const glow = this.scene.add.image(p.x, p.y + 6, gkey).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_OVERLAY + 1);
      this.glows.push(glow);
      this.objects.push(glow);
    }
  }

  /** Paredes bajas: una pieza por borde, con su propia profundidad para tapar a quien pase detrás. */
  private placeLowWalls() {
    const { width, height, tileSize: ts } = this.map;
    const h = spriteTexture(this.scene, "pared-baja-h", () => drawLowWall("h"));
    const v = spriteTexture(this.scene, "pared-baja-v", () => drawLowWall("v"));
    for (let ty = 0; ty <= height; ty++)
      for (let tx = 0; tx < width; tx++) {
        if (wallAbove(this.map, tx, ty) !== 1) continue;
        const a = worldToScreen(tx * ts, ty * ts);
        this.objects.push(
          this.scene.add.image(a.x - h.ox, a.y - h.oy, "pared-baja-h").setOrigin(0, 0).setDepth(depthOf((tx + 0.5) * ts, ty * ts)),
        );
      }
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx <= width; tx++) {
        if (wallLeftOf(this.map, tx, ty) !== 1) continue;
        const a = worldToScreen(tx * ts, ty * ts);
        this.objects.push(
          this.scene.add.image(a.x - v.ox, a.y - v.oy, "pared-baja-v").setOrigin(0, 0).setDepth(depthOf(tx * ts, (ty + 0.5) * ts)),
        );
      }
  }

  setNight(on: boolean) {
    this.drawBase(on);
    for (const n of this.nightly) {
      const key = this.furnitureKey(n.type, n.variant, on);
      const s = spriteTexture(this.scene, key, () => drawFurniture(n.type, n.variant, on));
      n.img.setTexture(key).setPosition(n.ax - (n.flip ? s.canvas.width - s.ox : s.ox), n.ay - s.oy);
    }
    this.nightLayer.setVisible(on);
    for (const g of this.glows) g.setVisible(on);
  }

  destroy() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.glows = [];
    this.nightly = [];
  }
}
