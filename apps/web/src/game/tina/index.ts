// La tina caliente y la sauna del lago en el navegador: el agua de la tina que se mueve, el vapor que sube
// (de la tina siempre; de la sauna, de quien está adentro, lo pone el avatar) y los destellos del reflejo
// de las luces en el lago. La tina, la sauna y el deck (con el reflejo quieto) son muebles del nivel; esto
// va encima, en el mismo lugar. El humo de las estufas es el de las chimeneas (CHIMNEY_TOPS).
import { TUB_WATER_Z, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { spaGlints, SPA_GLINT_FRAMES, steamPuff, TUB_RIPPLE_FRAMES, tubRipples, type Sprite } from "@hyvento/map/art";
import * as Phaser from "phaser";
import { DEPTH_FLAT, depthOf, ensureTexture, worldToScreen } from "../iso/view";

/** Cada cuánto cambia el cuadro del agua y de los destellos. */
const FRAME_MS = 300;
/** Cada cuánto sale una bocanada de vapor de la tina. */
const STEAM_MS = 260;
/** Radio del agua de la tina (px de mundo) donde nace el vapor. */
const STEAM_R = 30;

type Frames = (frame: number, night: boolean) => Sprite;

/** Dónde queda el origen de cada cuadro dentro de su textura (el recorte cambia por cuadro; las texturas duran entre niveles). */
const offsets = new Map<string, { ox: number; oy: number }>();

/** Una capa que cicla cuadros sobre un mueble (mismo origen que su dibujo). */
class Layer {
  img: Phaser.GameObjects.Image;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly name: string,
    private readonly draw: Frames,
    private readonly at: { x: number; y: number },
    depth: number,
  ) {
    this.img = scene.add.image(0, 0, this.key(0, false)).setOrigin(0, 0).setDepth(depth);
  }

  private key(frame: number, night: boolean) {
    const key = `${this.name}-${frame}-${night ? "noche" : "dia"}`;
    return ensureTexture(this.scene, key, () => {
      const s = this.draw(frame, night);
      offsets.set(key, { ox: s.ox, oy: s.oy });
      return s.canvas;
    });
  }

  show(frame: number, night: boolean) {
    const key = this.key(frame, night);
    const o = offsets.get(key);
    this.img.setTexture(key).setPosition(this.at.x - (o?.ox ?? 0), this.at.y - (o?.oy ?? 0));
  }

  destroy() {
    this.img.destroy();
  }
}

export class TinaView {
  private map?: OfficeMap;
  private tub?: PlacedFurniture;
  private ripples?: Layer;
  private glints?: Layer;
  private frame = 0;
  private nextFrameAt = 0;
  private nextSteamAt = 0;
  private night = false;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap, night: boolean) {
    this.clear();
    this.map = map;
    this.night = night;
    const ts = map.tileSize;
    const anchor = (f: PlacedFurniture) => worldToScreen(f.x * ts, f.y * ts);
    this.tub = map.furniture.find((f) => f.type === "hot-tub");
    const deck = map.furniture.find((f) => f.type === "spa-deck");
    // Las ondas van sobre el agua de la tina y debajo de quien está adentro (que se ordena con la tina).
    if (this.tub) this.ripples = new Layer(this.scene, "tina-agua", tubRipples, anchor(this.tub), depthOf((this.tub.x + this.tub.w / 2) * ts, (this.tub.y + this.tub.d / 2) * ts) + 0.2);
    if (deck) this.glints = new Layer(this.scene, "tina-reflejo", spaGlints, anchor(deck), DEPTH_FLAT + 1);
    this.show();
  }

  setNight(night: boolean) {
    if (night === this.night) return;
    this.night = night;
    this.show();
  }

  private show() {
    this.ripples?.show(this.frame % TUB_RIPPLE_FRAMES, this.night);
    this.glints?.show(this.frame % SPA_GLINT_FRAMES, this.night);
  }

  update(time: number) {
    if (!this.map || !this.tub) return;
    if (time >= this.nextFrameAt) {
      this.nextFrameAt = time + FRAME_MS;
      this.frame++;
      this.show();
    }
    if (time >= this.nextSteamAt) {
      this.nextSteamAt = time + STEAM_MS * (0.7 + Math.random() * 0.6);
      this.steam();
    }
  }

  /** Una bocanada de vapor que nace sobre el agua de la tina, sube ladeada y se deshace. */
  private steam() {
    const tub = this.tub!;
    const ts = this.map!.tileSize;
    const cx = (tub.x + tub.w / 2) * ts;
    const cy = (tub.y + tub.d / 2) * ts;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * STEAM_R;
    const s = worldToScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r, TUB_WATER_Z + 1);
    const key = ensureTexture(this.scene, "tina-vapor", () => steamPuff());
    // Encima de quien está adentro (el vapor lo envuelve) y debajo de quien pasa por delante.
    const puff = this.scene.add
      .image(Math.round(s.x), Math.round(s.y), key)
      .setDepth(depthOf(cx, cy) + 1)
      .setAlpha(this.night ? 0.55 : 0.7)
      .setScale(0.6);
    this.scene.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-6, 10),
      y: puff.y - Phaser.Math.Between(22, 34),
      scale: 1.6,
      alpha: 0,
      duration: Phaser.Math.Between(1800, 2600),
      ease: "Sine.out",
      onComplete: () => puff.destroy(),
    });
  }

  private clear() {
    this.ripples?.destroy();
    this.glints?.destroy();
    this.ripples = undefined;
    this.glints = undefined;
    this.tub = undefined;
  }

  destroy() {
    this.clear();
    this.map = undefined;
  }
}
