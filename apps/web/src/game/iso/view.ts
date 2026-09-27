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
  drawRoomWalls,
  drawSurroundings,
  WALL_H,
  glowSprite,
  SURROUND_PAD,
  toScreen,
  toWorld,
  type Sprite,
} from "@hyvento/map/art";
import * as Phaser from "phaser";
import { ensureTexture } from "./canvas";
import { prerenderedBase, prerenderedFurniture, prerenderedSurroundings } from "./prerender";
import { furnitureKey } from "./prerender-keys";

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
/**
 * La noche: color y fuerza de la penumbra (MULTIPLY) y cuánto más lejos que su brillo llega cada luz.
 * Adentro es suave (las luces de la casa están prendidas); afuera, azul de noche.
 */
const NIGHT = {
  // Adentro la casa tiene su luz general prendida: apenas un toque de noche; las lámparas suman encima.
  indoor: { color: 0xa597d6, alpha: 0.2, reach: 2.2 },
  outdoor: { color: 0x2c3570, alpha: 0.7, reach: 2.2 },
} as const;
/** La textura de la noche va a media resolución (es un degradado). */
const NIGHT_SCALE = 2;
export const DEPTH_FLAT = -1e6;
export const DEPTH_OVERLAY = 1e7;

function spriteTexture(scene: Phaser.Scene, key: string, make: () => Sprite): Sprite {
  const s = make();
  ensureTexture(scene, key, () => s.canvas);
  return s;
}

/** Textura (y cuadro, si viene del atlas) de un dibujo, con su tamaño y su origen. */
interface SpriteTex {
  texture: string;
  frame?: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

const texOf = (key: string, s: Sprite): SpriteTex => ({ texture: key, w: s.canvas.width, h: s.canvas.height, ox: s.ox, oy: s.oy });

/** Un mueble: su cuadro en el atlas del build o, si no está (desarrollo sin generar), su dibujo aquí. */
function furnitureTexture(scene: Phaser.Scene, type: string, variant: "front" | "back", night: boolean): SpriteTex {
  const key = furnitureKey(type, variant, night);
  const pre = prerenderedFurniture(scene, key);
  if (pre) return pre;
  return texOf(key, spriteTexture(scene, key, () => drawFurniture(type, variant, night)));
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
  let tex: SpriteTex;
  if (ghost) {
    // El fantasma del editor necesita los píxeles para teñirlos: se dibuja aquí (es uno solo).
    const key = `${furnitureKey(f.type, variant, night)}-fantasma-${ghost}`;
    tex = texOf(
      key,
      spriteTexture(scene, key, () => {
        let t = ghostSprites.get(key);
        if (!t) ghostSprites.set(key, (t = tinted(drawFurniture(f.type, variant, night), GHOST_TINT[ghost])));
        return t;
      }),
    );
  } else tex = furnitureTexture(scene, f.type, variant, night);
  const [w, d] = footprint(item, f.facing);
  const anchor = worldToScreen(f.x * ts, f.y * ts);
  const img = scene.add
    .image(anchor.x - (flip ? tex.w - tex.ox : tex.ox), anchor.y - tex.oy, tex.texture, tex.frame)
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
  /** Esquina (px de pantalla del nivel) desde la que se repite el bosque: el margen del fondo empalma ahí. */
  private surroundOrigin = { x: 0, y: 0 };
  private base!: Phaser.GameObjects.Image;
  private nightLayer: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  /** Luz de cada mueble que la tiene, y las que alguien apagó (lámparas; ver usables.ts). */
  private lightOf = new Map<PlacedFurniture, Phaser.GameObjects.Image>();
  private lightsOff = new Set<Phaser.GameObjects.Image>();
  private nightTex?: Phaser.Textures.CanvasTexture;
  private nightMask?: Phaser.GameObjects.Image;
  private nightOutside?: Phaser.GameObjects.Rectangle[];
  private night = false;
  /** Cada mueble con su imagen (el editor atenúa el que se está moviendo). */
  private furnitureImages: { f: PlacedFurniture; img: Phaser.GameObjects.Image }[] = [];
  /** Muebles con versión nocturna (la cabaña): se les cambia la textura con la noche. */
  private nightly: { img: Phaser.GameObjects.Image; type: string; variant: "front" | "back"; flip: boolean; ax: number; ay: number }[] = [];
  /** Posición en pantalla de lo colgado en las paredes (p. ej. la pantalla de la sala). */
  readonly features: { kind: WallFeatureKind; x: number; y: number; tileX: number; tileY: number }[] = [];
  /** Rectángulo de pantalla que ocupa el nivel (para la cámara). */
  readonly bounds: Phaser.Geom.Rectangle;
  /**
   * Capas de otros módulos pegadas a un mueble (la luz de un cubículo, la pantalla de una máquina, la tele
   * prendida): en el modo privado se esconden con su mueble. Se sacan de la lista de dibujo (a una capa
   * invisible) en vez de apagarlas, así el módulo que las anima no las vuelve a prender.
   */
  private attached: { f: PlacedFurniture; obj: Phaser.GameObjects.GameObject }[] = [];
  private stash?: Phaser.GameObjects.Layer;
  private privateRect: { x: number; y: number; w: number; h: number } | null = null;

  attach(f: PlacedFurniture, obj: Phaser.GameObjects.GameObject) {
    this.attached.push({ f, obj });
    obj.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.attached = this.attached.filter((a) => a.obj !== obj);
    });
    this.veilAttached(f, obj);
  }

  private outsidePrivate(f: PlacedFurniture) {
    const r = this.privateRect;
    return Boolean(r && (f.x < r.x || f.y < r.y || f.x >= r.x + r.w || f.y >= r.y + r.h));
  }

  private veilAttached(f: PlacedFurniture, obj: Phaser.GameObjects.GameObject) {
    if (this.outsidePrivate(f)) {
      this.stash ??= this.scene.add.layer().setVisible(false);
      if (obj.displayList !== this.stash) this.stash.add(obj);
    } else if (this.stash && obj.displayList === this.stash) {
      this.stash.remove(obj);
      this.scene.sys.displayList.add(obj);
    }
  }

  /** Cada tramo de pared baja por su borde ("h:x,y" / "v:x,y"): el modo privado esconde los que levanta. */
  private lowWalls = new Map<string, Phaser.GameObjects.Image>();
  /** Modo privado: la sala donde estoy con paredes altas y lo de afuera a oscuras (ver setPrivateRoom). */
  private privateRoom: { key: string; objects: Phaser.GameObjects.GameObject[] } | null = null;

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
    this.surroundOrigin = { x: b.x - SURROUND_PAD, y: b.y - SURROUND_PAD };
    // De noche: penumbra azulada (más oscura afuera) con huecos de luz donde hay lámparas, faroles,
    // ventanas y fuego (ver drawNightMask). Este rectángulo parejo queda de respaldo.
    const n = NIGHT[map.outdoor ? "outdoor" : "indoor"];
    this.nightLayer = scene.add
      .rectangle(b.centerX, b.centerY, b.width + SURROUND_PAD * 2, b.height + SURROUND_PAD * 2, n.color, n.alpha)
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

  /**
   * Afuera: el bosque que se repite más allá del borde del terreno (debajo de todo). Es una baldosa del
   * tamaño de lo que ve la cámara que la sigue (followCamera): una del tamaño del nivel pasaba los
   * 60 Mpx en el jardín, más de lo que deja iOS para un canvas.
   */
  private drawSurroundings() {
    const kind = this.map.def.surroundings;
    if (!kind) return;
    const key = prerenderedSurroundings(this.scene, kind) ?? ensureTexture(this.scene, `alrededores-${kind}`, () => drawSurroundings(kind));
    this.surround = this.scene.add.tileSprite(0, 0, 1, 1, key).setOrigin(0, 0).setDepth(DEPTH_FLOOR - 1);
    this.objects.push(this.surround);
    this.scene.cameras.main.on(Phaser.Cameras.Scene2D.Events.PRE_RENDER, this.followCamera, this);
  }

  /**
   * Antes de cada cuadro la baldosa cubre la vista de la cámara (con un margen, por el zoom y el
   * seguimiento suave) y corre su dibujo según dónde quedó: la baldosa arranca en la esquina del fondo
   * menos SURROUND_PAD, igual que el margen del nivel (room.ts), así no se ve la costura. Todo en píxeles
   * enteros: con roundPixels, un medio píxel corría el bosque respecto del fondo.
   */
  private followCamera(cam: Phaser.Cameras.Scene2D.Camera) {
    const tile = this.surround;
    if (!tile) return;
    const m = 64;
    const v = cam.worldView;
    const x = Math.floor(v.x) - m;
    const y = Math.floor(v.y) - m;
    const w = Math.ceil(v.width) + m * 2;
    const h = Math.ceil(v.height) + m * 2;
    if (tile.width !== w || tile.height !== h) tile.setSize(w, h);
    if (tile.x !== x || tile.y !== y) tile.setPosition(x, y);
    tile.setTilePosition(x - this.surroundOrigin.x, y - this.surroundOrigin.y);
  }

  private drawBase(night: boolean) {
    // El del build si coincide con la decoración; si no (una oficina con otro piso), se dibuja aquí.
    const pre = prerenderedBase(this.scene, this.map, night);
    const key = pre?.key ?? `area-${this.map.id}-${baseSignature(this.map)}-${night ? "noche" : "dia"}`;
    if (!pre && !this.scene.textures.exists(key)) {
      const art = drawAreaBase(this.map, !night);
      ensureTexture(this.scene, key, () => art.base.canvas);
      this.scene.registry.set(`${key}-origin`, { ox: art.base.ox, oy: art.base.oy });
    }
    const { ox, oy } = pre ?? (this.scene.registry.get(`${key}-origin`) as { ox: number; oy: number });
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

  /** Punto de pantalla justo arriba del dibujo de un mueble (para los indicadores de interacción). */
  furnitureTop(f: PlacedFurniture): { x: number; y: number; depth: number } | null {
    const hit = this.furnitureImages.find((e) => e.f === f);
    if (!hit) return null;
    const b = hit.img.getBounds();
    return { x: b.centerX, y: b.y, depth: hit.img.depth };
  }

  /** Atenúa los muebles que cumplen `match` (el que se está moviendo en el editor); null = ninguno. */
  dimFurniture(match: ((f: PlacedFurniture) => boolean) | null) {
    for (const { f, img } of this.furnitureImages) img.setAlpha(match?.(f) ? 0.3 : 1);
  }

  /**
   * Paredes bajas: una pieza por borde, con su propia profundidad para tapar a quien pase detrás. Un
   * mueble pegado a la pared por dentro (la baldosa de abajo de un borde norte, la de la derecha de uno
   * oeste) siempre queda delante de ese tramo: con la profundidad del centro, un mueble largo (la pecera,
   * una estantería) empataba con los tramos de su costado y la pared lo tapaba.
   */
  private placeLowWalls() {
    const { width, height, tileSize: ts } = this.map;
    const h = spriteTexture(this.scene, "pared-baja-h", () => drawLowWall("h"));
    const v = spriteTexture(this.scene, "pared-baja-v", () => drawLowWall("v"));
    // Profundidad del mueble (no plano) que ocupa cada baldosa.
    const occupant = new Map<number, number>();
    for (const { f, img } of this.furnitureImages) {
      if (catalogItem(f.type).flat) continue;
      for (let y = f.y; y < f.y + f.d; y++)
        for (let x = f.x; x < f.x + f.w; x++) {
          const k = y * width + x;
          occupant.set(k, Math.min(occupant.get(k) ?? Infinity, img.depth));
        }
    }
    const behind = (depth: number, tx: number, ty: number) => Math.min(depth, (occupant.get(ty * width + tx) ?? Infinity) - 0.05);
    for (let ty = 0; ty <= height; ty++)
      for (let tx = 0; tx < width; tx++) {
        if (wallAbove(this.map, tx, ty) !== 1) continue;
        const a = worldToScreen(tx * ts, ty * ts);
        const img = this.scene.add
          .image(a.x - h.ox, a.y - h.oy, "pared-baja-h")
          .setOrigin(0, 0)
          .setDepth(behind(depthOf((tx + 0.5) * ts, ty * ts), tx, ty));
        this.objects.push(img);
        this.lowWalls.set(`h:${tx},${ty}`, img);
      }
    for (let ty = 0; ty < height; ty++)
      for (let tx = 0; tx <= width; tx++) {
        if (wallLeftOf(this.map, tx, ty) !== 1) continue;
        const a = worldToScreen(tx * ts, ty * ts);
        const img = this.scene.add
          .image(a.x - v.ox, a.y - v.oy, "pared-baja-v")
          .setOrigin(0, 0)
          .setDepth(behind(depthOf(tx * ts, (ty + 0.5) * ts), tx, ty));
        this.objects.push(img);
        this.lowWalls.set(`v:${tx},${ty}`, img);
      }
  }

  /** Prende o apaga la luz de un mueble (se ve de noche, como todas las luces). */
  setLight(f: PlacedFurniture, on: boolean) {
    const glow = this.lightOf.get(f);
    if (!glow) return;
    if (on) this.lightsOff.delete(glow);
    else this.lightsOff.add(glow);
    glow.setVisible(this.night && on);
    if (this.night) this.drawNightMask();
  }

  /**
   * La penumbra de la noche como textura: el color de la noche con huecos degradados alrededor de cada
   * luz prendida, así las lámparas iluminan de verdad (sin el filtro gris parejo de antes). Va a media
   * resolución (es un degradado suave) y con MULTIPLY encima de todo; afuera del nivel, franjas parejas.
   */
  private drawNightMask() {
    const b = this.bounds;
    const w = Math.ceil(b.width / NIGHT_SCALE);
    const h = Math.ceil(b.height / NIGHT_SCALE);
    const key = `noche-${this.map.id}`;
    if (!this.nightTex || this.nightTex.width !== w || this.nightTex.height !== h) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      this.nightTex = this.scene.textures.createCanvas(key, w, h)!;
    }
    const n = NIGHT[this.map.outdoor ? "outdoor" : "indoor"];
    const ctx = this.nightTex.getContext();
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(${(n.color >> 16) & 255}, ${(n.color >> 8) & 255}, ${n.color & 255}, ${n.alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "destination-out";
    for (const g of this.glows) {
      if (this.lightsOff.has(g)) continue;
      const rx = ((g.width / 2) * n.reach) / NIGHT_SCALE;
      const ry = ((g.height / 2) * n.reach) / NIGHT_SCALE;
      ctx.save();
      ctx.translate((g.x - b.x) / NIGHT_SCALE, (g.y - b.y) / NIGHT_SCALE);
      ctx.scale(1, ry / rx);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.45, "rgba(0,0,0,0.85)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.nightTex.refresh();
    if (!this.nightMask) {
      this.nightMask = this.scene.add
        .image(b.x, b.y, key)
        .setOrigin(0, 0)
        .setScale(NIGHT_SCALE)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
        .setDepth(DEPTH_OVERLAY);
      this.objects.push(this.nightMask);
    }
    this.nightOutside ??= this.outsideFrame(n);
  }

  /** Cuatro franjas de penumbra alrededor del nivel (lo que queda afuera de la textura de la noche). */
  private outsideFrame(n: { color: number; alpha: number }) {
    const b = this.bounds;
    const P = SURROUND_PAD;
    const rects = [
      [b.x - P, b.y - P, b.width + 2 * P, P],
      [b.x - P, b.bottom, b.width + 2 * P, P],
      [b.x - P, b.y, P, b.height],
      [b.right, b.y, P, b.height],
    ].map(([x, y, w, h]) =>
      this.scene.add.rectangle(x!, y!, w!, h!, n.color, n.alpha).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(DEPTH_OVERLAY),
    );
    this.objects.push(...rects);
    return rects;
  }

  setNight(on: boolean) {
    this.night = on;
    this.drawBase(on);
    for (const n of this.nightly) {
      const t = furnitureTexture(this.scene, n.type, n.variant, on);
      n.img.setTexture(t.texture, t.frame).setPosition(n.ax - (n.flip ? t.w - t.ox : t.ox), n.ay - t.oy);
    }
    // El rectángulo parejo ya no se usa: la noche es la textura con las luces (drawNightMask).
    this.nightLayer.setVisible(false);
    for (const g of this.glows) g.setVisible(on && !this.lightsOff.has(g));
    if (on) this.drawNightMask();
    this.nightMask?.setVisible(on);
    for (const r of this.nightOutside ?? []) r.setVisible(on);
  }

  /**
   * Modo privado de una sala (oficinas y sala de reuniones): sus paredes del fondo se levantan altas y lo
   * que queda afuera se oscurece, para sentirse adentro de una habitación. `null` lo quita.
   */
  setPrivateRoom(rect: { x: number; y: number; w: number; h: number } | null) {
    const key = rect ? `${rect.x},${rect.y},${rect.w},${rect.h}` : "";
    if ((this.privateRoom?.key ?? "") === key) return;
    for (const o of this.privateRoom?.objects ?? []) o.destroy();
    this.privateRoom = null;
    this.privateRect = rect;
    for (const { f, obj } of this.attached) this.veilAttached(f, obj);
    // Los muebles de afuera se esconden: los altos del pasillo (un reloj, una planta) asomarían por el hueco.
    const inside = (f: PlacedFurniture) => !rect || (f.x >= rect.x && f.y >= rect.y && f.x < rect.x + rect.w && f.y < rect.y + rect.h);
    for (const { f, img } of this.furnitureImages) img.setVisible(inside(f));
    // De las paredes bajas quedan solo las del frente de la sala (sur y este). Las del fondo quedan dentro
    // de la pared alta nueva y las de las salas vecinas, detrás del muro: si no, se ven encima de él.
    for (const [key, img] of this.lowWalls) {
      const [edge, pos] = key.split(":") as ["h" | "v", string];
      const [x, y] = pos.split(",").map(Number) as [number, number];
      const front = rect
        ? edge === "h"
          ? y === rect.y + rect.h && x >= rect.x && x < rect.x + rect.w
          : x === rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
        : true;
      img.setVisible(front);
    }
    if (!rect) return;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const ts = this.map.tileSize;
    const walls = drawRoomWalls(this.map, rect);
    if (walls) {
      const tex = `paredes-altas-${this.map.id}-${key}-${baseSignature(this.map)}`;
      ensureTexture(this.scene, tex, () => walls.canvas);
      objects.push(this.scene.add.image(-walls.ox, -walls.oy, tex).setOrigin(0, 0).setDepth(DEPTH_FLOOR + 1));
    }
    // Lo de afuera, a oscuras: un rectángulo enorme con el hueco de la sala (piso y paredes del fondo).
    const pad = 8;
    const x0 = rect.x * ts;
    const y0 = rect.y * ts;
    const x1 = (rect.x + rect.w) * ts;
    const y1 = (rect.y + rect.h) * ts;
    const hole = [
      worldToScreen(x0 - pad, y1),
      worldToScreen(x0 - pad, y1, WALL_H + 2),
      worldToScreen(x0 - pad, y0 - pad, WALL_H + 2),
      worldToScreen(x1, y0 - pad, WALL_H + 2),
      worldToScreen(x1, y0 - pad),
      worldToScreen(x1 + 2, y1 + 2),
    ].map((p) => new Phaser.Math.Vector2(p.x, p.y));
    // Una textura oscura del tamaño del nivel (y un margen) con el hueco borrado: la máscara invertida no
    // anda igual en todos los renderizadores.
    const b = this.bounds;
    // Margen: lo que se ve más allá del nivel con la cámara en un borde (más, y la textura sería enorme).
    const m = 800;
    const shade = this.scene.add
      .renderTexture(b.x - m, b.y - m, Math.ceil(b.width + m * 2), Math.ceil(b.height + m * 2))
      .setOrigin(0, 0)
      // Encima de los nombres de los de afuera (5e7 y 6e7 en Avatar), debajo del HUD de Phaser.
      .setDepth(7e7);
    shade.fill(0x0c0814, 0.93);
    const shape = this.scene.make.graphics({}, false);
    shape.fillStyle(0xffffff).fillPoints(
      hole.map((p) => new Phaser.Math.Vector2(p.x - (b.x - m), p.y - (b.y - m))),
      true,
    );
    shade.erase(shape);
    shape.destroy();
    objects.push(shade);
    this.privateRoom = { key, objects };
  }

  destroy() {
    this.scene.cameras.main?.off(Phaser.Cameras.Scene2D.Events.PRE_RENDER, this.followCamera, this);
    this.surround = undefined;
    this.setPrivateRoom(null);
    this.stash?.destroy();
    this.stash = undefined;
    this.attached = [];
    for (const o of this.objects) o.destroy();
    this.nightMask = undefined;
    this.nightOutside = undefined;
    if (this.nightTex) this.scene.textures.remove(this.nightTex.key);
    this.nightTex = undefined;
    this.objects = [];
    this.glows = [];
    this.lightOf.clear();
    this.lightsOff.clear();
    this.nightly = [];
    this.furnitureImages = [];
    this.lowWalls.clear();
  }
}
