// El corcho de la cafetería en la escena: encima del dibujo del tablón va una capa con las miniaturas de
// las últimas fotos pinchadas. Se rearma cuando cambia la lista (alguien sacó o borró una foto). El de la
// casa propia muestra las fotos de su dueño (las que sacó y en las que sale).
import { catalogItem, footprint, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { PHOTO_BOARD_PIC, PHOTO_BOARD_SLOTS, photoBoardPhotos, type PhotoThumb } from "@hyvento/map/art";
import type { PhotoDTO } from "@hyvento/shared";
import * as Phaser from "phaser";
import { casaOwnerOf, photosOfPerson } from "@/lib/casaGaleria";
import { depthOf, ensureTexture, worldToScreen } from "../iso/view";
import { thumbnailOf } from "./capture";
import { photoImageUrl, usePhotoStore } from "./store";

const BOARD = "photo-board";

/** Carga una imagen del mismo origen (sin tocar el canvas del juego). */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No cargó ${url}`));
    img.src = url;
  });
}

export class PhotoBoards {
  private map?: OfficeMap;
  private images: Phaser.GameObjects.Image[] = [];
  private keys: string[] = [];
  /** Miniaturas ya armadas (por foto y si va espejada). */
  private thumbs = new Map<string, PhotoThumb>();
  private generation = 0;
  private unsubscribe: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = usePhotoStore.subscribe((s, prev) => {
      if (s.photos !== prev.photos) void this.redraw();
    });
  }

  /** ¿El nivel tiene un tablón de fotos? (para saber si hace falta pedir la lista). */
  static hasBoard(map: OfficeMap) {
    return map.furniture.some((f) => f.type === BOARD);
  }

  setArea(map: OfficeMap) {
    this.map = map;
    if (PhotoBoards.hasBoard(map) && !usePhotoStore.getState().loaded) void usePhotoStore.getState().refresh();
    void this.redraw();
  }

  destroy() {
    this.unsubscribe();
    this.clear();
  }

  private clear() {
    this.images.forEach((i) => i.destroy());
    this.images = [];
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.keys = [];
  }

  private async thumbOf(photo: PhotoDTO, mirror: boolean): Promise<PhotoThumb | null> {
    const key = `${photo.id}:${mirror ? 1 : 0}`;
    const cached = this.thumbs.get(key);
    if (cached) return cached;
    try {
      const img = await loadImage(photoImageUrl(photo.id));
      const data = thumbnailOf(img, PHOTO_BOARD_PIC.w, PHOTO_BOARD_PIC.h, mirror);
      const thumb: PhotoThumb = { width: data.width, height: data.height, data: data.data };
      this.thumbs.set(key, thumb);
      return thumb;
    } catch {
      return null; // una foto que no carga deja su lugar vacío
    }
  }

  private async redraw() {
    const gen = ++this.generation;
    const map = this.map;
    const boards = map?.furniture.filter((f) => f.type === BOARD) ?? [];
    if (!map || boards.length === 0) return this.clear();
    const photos = usePhotoStore.getState().photos;
    const owner = casaOwnerOf(map.id);
    const pinned = (owner ? photosOfPerson(photos, owner) : photos.filter((p) => p.pinned)).slice(0, PHOTO_BOARD_SLOTS);
    const layers: { f: PlacedFurniture; thumbs: PhotoThumb[] }[] = [];
    for (const f of boards) {
      const flip = f.facing === "down" || f.facing === "up";
      const thumbs = (await Promise.all(pinned.map((p) => this.thumbOf(p, flip)))).filter((t): t is PhotoThumb => t !== null);
      layers.push({ f, thumbs });
    }
    // Mientras cargaban las imágenes pudo cambiar el nivel o la lista: solo gana la última vuelta.
    if (gen !== this.generation || this.map !== map || !this.scene.sys.isActive()) return;
    this.clear();
    layers.forEach(({ f, thumbs }, i) => {
      if (thumbs.length === 0) return;
      const key = `capa-fotos-${gen}-${i}`;
      this.keys.push(key);
      this.images.push(this.layer(map, f, key, photoBoardPhotos(thumbs)));
    });
  }

  /** La capa en el mismo lugar, volteo y profundidad que el dibujo del tablón (ver furnitureImage). */
  private layer(map: OfficeMap, f: PlacedFurniture, key: string, s: ReturnType<typeof photoBoardPhotos>) {
    const ts = map.tileSize;
    const item = catalogItem(f.type);
    const flip = !item.fixed && (f.facing === "down" || f.facing === "up");
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
