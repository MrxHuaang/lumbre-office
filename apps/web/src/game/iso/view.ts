// Proyección isométrica y render de un nivel de la cabaña en Phaser.
// El juego usa píxeles de mundo (tile de 32); el arte usa unidades de arte (tile de 16): arte = mundo / 2.
import {
  catalogItem,
  footprint,
  wallAbove,
  wallLeftOf,
  type Facing,
  type OfficeMap,
  type PlacedFurniture,
  type WallFeatureKind,
} from "@hyvento/map";
import {
  PixelCanvas,
  WORLD_TO_ART,
  drawAreaBase,
  drawFurniture,
  drawLowWall,
  drawSurroundings,
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
/** Cuánto se extiende el bosque de afuera más allá del dibujo del nivel (px de pantalla). */
const SURROUND_PAD = 3000;
export const DEPTH_FLAT = -1e6;
export const DEPTH_OVERLAY = 1e7;

function spriteTexture(scene: Phaser.Scene, key: string, make: () => Sprite): Sprite {
  const s = make();
  ensureTexture(scene, key, () => s.canvas);
  return s;
}

function furnitureKey(type: string, variant: "front" | "back", night: boolean) {
  return catalogItem(type).hasNight ? `mueble-${type}-${variant}-${night ? "noche" : "dia"}` : `mueble-${type}-${variant}`;
}

/** Mueble ubicado en (x, y) (su esquina, en tiles) mirando hacia `facing`. */
export interface FurniturePose {
  type: string;
  x: number;
  y: number;
  facing: Facing;
}

/** Colores del fantasma del editor: verde si se puede poner, rojo si no. */
const GHOST_TINT = { ok: [111, 207, 95], bad: [224, 90, 74] } as const;
const ghostSprites = new Map<string, Sprite>();

/**
 * Copia teñida de un dibujo (el renderer es Canvas 2D, donde Phaser no aplica `setTint`): cada píxel
 * se mezcla con el color, así se nota de lejos.
 */
function tinted(s: Sprite, rgb: readonly [number, number, number], t = 0.5): Sprite {
  const out = new PixelCanvas(s.canvas.width, s.canvas.height);
  const src = s.canvas.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    if (!src[i + 3]) continue;
    dst[i] = src[i]! + (rgb[0] - src[i]!) * t;
    dst[i + 1] = src[i + 1]! + (rgb[1] - src[i + 1]!) * t;
    dst[i + 2] = src[i + 2]! + (rgb[2] - src[i + 2]!) * t;
    dst[i + 3] = src[i + 3]!;
  }
  return { canvas: out, ox: s.ox, oy: s.oy };
}

/**
 * Imagen de un mueble en su lugar y con su profundidad. La usan el nivel y el fantasma del editor de
 * oficina (`ghost`: teñido de verde o rojo), así el fantasma cae exactamente donde quedará el mueble.
 */
export function furnitureImage(scene: Phaser.Scene, f: FurniturePose, night: boolean, ts: number, ghost?: "ok" | "bad") {
  const item = catalogItem(f.type);
  const back = (f.facing === "left" || f.facing === "up") && item.hasBack;
  const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
  const variant: "front" | "back" = back ? "back" : "front";
  const base = furnitureKey(f.type, variant, night);
  const key = ghost ? `${base}-fantasma-${ghost}` : base;
  const draw = () => drawFurniture(f.type, variant, night);
  const make = ghost
    ? () => {
        let t = ghostSprites.get(key);
        if (!t) ghostSprites.set(key, (t = tinted(draw(), GHOST_TINT[ghost])));
        return t;
      }
    : draw;
  const s = spriteTexture(scene, key, make);
  const [w, d] = footprint(item, f.facing);
  const anchor = worldToScreen(f.x * ts, f.y * ts);
  const img = scene.add
    .image(anchor.x - (flip ? s.canvas.width - s.ox : s.ox), anchor.y - s.oy, key)
    .setOrigin(0, 0)
    .setFlipX(flip)
    .setDepth(item.flat ? DEPTH_FLAT : depthOf((f.x + w / 2) * ts, (f.y + d / 2) * ts));
  return { img, variant, flip, anchor };
}

/** Rombo de un tile en pantalla (para la grilla y la huella del editor). */
export function tileDiamond(tx: number, ty: number, ts: number): Phaser.Geom.Point[] {
  return [
    worldToScreen(tx * ts, ty * ts),
    worldToScreen((tx + 1) * ts, ty * ts),
    worldToScreen((tx + 1) * ts, (ty + 1) * ts),
    worldToScreen(tx * ts, (ty + 1) * ts),
  ].map((p) => new Phaser.Geom.Point(p.x, p.y));
}

/**
 * Fondo del nivel según el piso y papel tapiz de cada habitación: con la decoración de las oficinas
 * cambia, así que va en la clave de la textura (una letra de cada uno alcanza: no se repiten).
 */
function baseSignature(map: OfficeMap) {
  return map.def.rooms.map((r) => `${r.floor[0]}${r.wallpaper[0]}`).join("");
}

/** Un nivel dibujado: fondo, muebles, paredes bajas y luces. Se destruye al cambiar de nivel. */
export class AreaView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private surround?: Phaser.GameObjects.TileSprite;
  private base!: Phaser.GameObjects.Image;
  private nightLayer: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  /** Luz de cada mueble que la tiene, y las que alguien apagó (lámparas; ver usables.ts). */
  private lightOf = new Map<PlacedFurniture, Phaser.GameObjects.Image>();
  private lightsOff = new Set<Phaser.GameObjects.Image>();
  private night = false;
  /** Cada mueble con su imagen (el editor atenúa el que se está moviendo). */
  private furnitureImages: { f: PlacedFurniture; img: Phaser.GameObjects.Image }[] = [];
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
    this.drawSurroundings();
    this.drawBase(night);
    for (const f of map.furniture) this.placeFurniture(f, night);
    this.placeLowWalls();
    const b = this.base.getBounds();
    this.bounds = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
    this.surround?.setPosition(b.centerX, b.centerY).setSize(b.width + SURROUND_PAD * 2, b.height + SURROUND_PAD * 2);
    // De noche afuera está oscuro; adentro las luces están prendidas, así que solo se tiñe de azul.
    const [tint, strength] = map.outdoor ? [0x4a3f8a, 0.6] : [0xb4a6e0, 0.55];
    this.nightLayer = scene.add
      .rectangle(b.centerX, b.centerY, b.width + SURROUND_PAD * 2, b.height + SURROUND_PAD * 2, tint, strength)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(DEPTH_OVERLAY)
      .setVisible(night);
    this.objects.push(this.nightLayer);
    this.setNight(night);
  }

  /**
   * Borra los fondos guardados de este nivel con otra decoración (piso o papel tapiz que ya no se
   * usan): cada uno es un lienzo grande y no se volverían a pedir.
   */
  static dropStaleBases(scene: Phaser.Scene, map: OfficeMap) {
    const prefix = `area-${map.id}-`;
    const keep = `${prefix}${baseSignature(map)}-`;
    for (const key of scene.textures.getTextureKeys()) {
      if (!key.startsWith(prefix) || key.startsWith(keep)) continue;
      scene.textures.remove(key);
      scene.registry.remove(`${key}-origin`);
    }
  }

  /** Afuera: el bosque que se repite más allá del borde del terreno (debajo de todo). */
  private drawSurroundings() {
    const kind = this.map.def.surroundings;
    if (!kind) return;
    const key = ensureTexture(this.scene, `alrededores-${kind}`, () => drawSurroundings(kind));
    const tile = this.scene.add
      .tileSprite(0, 0, SURROUND_PAD * 2, SURROUND_PAD * 2, key)
      .setDepth(DEPTH_FLOOR - 1);
    // Centrado en el nivel; se ubica después de dibujar el fondo (ver el constructor).
    this.surround = tile;
    this.objects.push(tile);
  }

  private drawBase(night: boolean) {
    const key = `area-${this.map.id}-${baseSignature(this.map)}-${night ? "noche" : "dia"}`;
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

  private placeFurniture(f: PlacedFurniture, night: boolean) {
    const item = catalogItem(f.type);
    const ts = this.map.tileSize;
    const { img, variant, flip, anchor } = furnitureImage(this.scene, f, night, ts);
    this.objects.push(img);
    this.furnitureImages.push({ f, img });
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
      this.lightOf.set(f, glow);
      this.objects.push(glow);
    }
  }

  /** Atenúa los muebles que cumplen `match` (el que se está moviendo en el editor); null = ninguno. */
  dimFurniture(match: ((f: PlacedFurniture) => boolean) | null) {
    for (const { f, img } of this.furnitureImages) img.setAlpha(match?.(f) ? 0.3 : 1);
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

  /** Prende o apaga la luz de un mueble (se ve de noche, como todas las luces). */
  setLight(f: PlacedFurniture, on: boolean) {
    const glow = this.lightOf.get(f);
    if (!glow) return;
    if (on) this.lightsOff.delete(glow);
    else this.lightsOff.add(glow);
    glow.setVisible(this.night && on);
  }

  setNight(on: boolean) {
    this.night = on;
    this.drawBase(on);
    for (const n of this.nightly) {
      const key = furnitureKey(n.type, n.variant, on);
      const s = spriteTexture(this.scene, key, () => drawFurniture(n.type, n.variant, on));
      n.img.setTexture(key).setPosition(n.ax - (n.flip ? s.canvas.width - s.ox : s.ox), n.ay - s.oy);
    }
    this.nightLayer.setVisible(on);
    for (const g of this.glows) g.setVisible(on && !this.lightsOff.has(g));
  }

  destroy() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.glows = [];
    this.lightOf.clear();
    this.lightsOff.clear();
    this.nightly = [];
    this.furnitureImages = [];
  }
}
