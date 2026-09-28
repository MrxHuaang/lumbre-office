// La piscina en el navegador: lo que se mueve sobre el agua (los reflejos que ondulan y los flotadores
// que se mecen), la lona que la tapa cuando llueve y la salpicadura del chapuzón. El agua y el deck son
// el mueble `pool` (dibujado una vez); esto va encima, en el mismo lugar.
import { catalogItem, isSwimTile, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { poolCover, poolFloat, poolShimmer, POOL_SHIMMER_FRAMES, waterDroplet, waterRing, type PoolFloatKind } from "@hyvento/map/art";
import { poolCovered, type Weather } from "@hyvento/shared";
import type * as Phaser from "phaser";
import { DEPTH_FLAT, DEPTH_OVERLAY, depthOf, ensureTexture, worldToScreen, type AreaView } from "../iso/view";

/** Cada cuánto cambia el cuadro de los reflejos. */
const SHIMMER_MS = 320;
const FLOATS: { kind: PoolFloatKind; phase: number; speed: number }[] = [
  { kind: "dona", phase: 0.3, speed: 1 },
  { kind: "flamenco", phase: 2.1, speed: 0.8 },
];

interface Float {
  img: Phaser.GameObjects.Image;
  phase: number;
  speed: number;
}

export class PoolView {
  private map?: OfficeMap;
  private view?: AreaView;
  private pool?: PlacedFurniture;
  /** Esquina del dibujo de la piscina en pantalla (todas las capas van ahí). */
  private at = { x: 0, y: 0 };
  /** El agua de la pileta (px de mundo), para que los flotadores no se salgan. */
  private basin = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private shimmer?: Phaser.GameObjects.Image;
  private cover?: Phaser.GameObjects.Image;
  private floats: Float[] = [];
  private frame = 0;
  private nextFrameAt = 0;
  private covered = false;
  private night = false;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap, view: AreaView | undefined, weather: Weather, night: boolean) {
    this.clear();
    this.map = map;
    this.view = view;
    this.night = night;
    this.covered = poolCovered(weather);
    this.pool = map.furniture.find((f) => catalogItem(f.type).swim);
    if (!this.pool) return;
    const ts = map.tileSize;
    const f = this.pool;
    const a = worldToScreen(f.x * ts, f.y * ts);
    this.at = { x: a.x, y: a.y };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let y = f.y; y < f.y + f.d; y++)
      for (let x = f.x; x < f.x + f.w; x++)
        if (isSwimTile(map, x, y)) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x + 1);
          y1 = Math.max(y1, y + 1);
        }
    this.basin = { x0: x0 * ts, y0: y0 * ts, x1: x1 * ts, y1: y1 * ts };
    this.shimmer = this.scene.add.image(0, 0, this.shimmerKey(0)).setOrigin(0, 0).setDepth(DEPTH_FLAT + 1);
    this.placeShimmer();
    const cover = poolCover();
    const coverKey = ensureTexture(this.scene, "piscina-lona", () => cover.canvas);
    this.cover = this.scene.add.image(a.x - cover.ox, a.y - cover.oy, coverKey).setOrigin(0, 0).setDepth(DEPTH_FLAT + 3);
    for (const spec of FLOATS) {
      const key = ensureTexture(this.scene, `flotador-${spec.kind}`, () => poolFloat(spec.kind));
      this.floats.push({ img: this.scene.add.image(0, 0, key).setOrigin(0.5, 0.7).setDepth(DEPTH_FLAT + 2), phase: spec.phase, speed: spec.speed });
    }
    this.applyCover();
  }

  /** El cuadro de reflejos de ahora, con su origen sobre la esquina de la piscina. */
  private placeShimmer() {
    if (!this.shimmer) return;
    const key = this.shimmerKey(this.frame);
    const o = shimmerOffsets.get(`${this.frame}-${this.night}`);
    this.shimmer.setTexture(key).setPosition(this.at.x - (o?.ox ?? 0), this.at.y - (o?.oy ?? 0));
  }

  private shimmerKey(frame: number) {
    const night = this.night;
    return ensureTexture(this.scene, `piscina-brillo-${frame}-${night ? "noche" : "dia"}`, () => {
      const s = poolShimmer(frame, night);
      // Mismo origen que la piscina: el recorte de cada cuadro puede ser distinto, se corrige al ponerlo.
      shimmerOffsets.set(`${frame}-${night}`, { ox: s.ox, oy: s.oy });
      return s.canvas;
    });
  }

  setWeather(w: Weather) {
    const covered = poolCovered(w);
    if (covered === this.covered) return;
    this.covered = covered;
    this.applyCover();
  }

  setNight(night: boolean) {
    if (night === this.night || !this.map) return;
    this.night = night;
    this.nextFrameAt = 0;
  }

  /** Con lona: sin reflejos ni flotadores (quedan guardados) y con las luces del agua apagadas. */
  private applyCover() {
    if (this.pool) this.view?.setLight(this.pool, !this.covered);
    this.cover?.setVisible(this.covered);
    this.shimmer?.setVisible(!this.covered);
    for (const f of this.floats) f.img.setVisible(!this.covered);
  }

  update(time: number) {
    if (!this.pool || !this.map || this.covered) return;
    if (time >= this.nextFrameAt && this.shimmer) {
      this.nextFrameAt = time + SHIMMER_MS;
      this.frame = (this.frame + 1) % POOL_SHIMMER_FRAMES;
      this.placeShimmer();
    }
    // Los flotadores se mecen despacio de un lado al otro (con la hora de la pared: todos los ven igual).
    const t = Date.now() / 1000;
    const { x0, y0, x1, y1 } = this.basin;
    const pad = 12;
    for (const f of this.floats) {
      const u = 0.5 + 0.42 * Math.sin(t * 0.05 * f.speed + f.phase);
      const v = 0.5 + 0.38 * Math.sin(t * 0.083 * f.speed + f.phase * 1.7);
      const wx = x0 + pad + (x1 - x0 - pad * 2) * u;
      const wy = y0 + pad + (y1 - y0 - pad * 2) * v;
      const s = worldToScreen(wx, wy);
      f.img.setPosition(Math.round(s.x), Math.round(s.y + Math.sin(t * 2 + f.phase)));
    }
  }

  /** Salpicadura donde alguien cae al agua: gotas que saltan y dos ondas que se abren. */
  splash(x: number, y: number) {
    const s = worldToScreen(x, y);
    const drop = ensureTexture(this.scene, "gota-piscina", () => waterDroplet());
    for (let i = 0; i < 12; i++) {
      const img = this.scene.add.image(Math.round(s.x), Math.round(s.y) - 2, drop).setDepth(DEPTH_OVERLAY - 2);
      const dx = (Math.random() - 0.5) * 26;
      const up = 10 + Math.random() * 16;
      this.scene.tweens.add({ targets: img, x: img.x + dx, duration: 520, ease: "Linear" });
      this.scene.tweens.add({ targets: img, y: img.y - up, duration: 240, ease: "Quad.out", yoyo: true, onComplete: () => img.destroy() });
    }
    const ring = ensureTexture(this.scene, "onda-grande-piscina", () => waterRing(12, 5));
    for (let k = 0; k < 2; k++) {
      const img = this.scene.add.image(Math.round(s.x), Math.round(s.y) + 2, ring).setDepth(depthOf(x, y) - 0.2).setScale(0.5).setAlpha(0.95);
      this.scene.tweens.add({ targets: img, scaleX: 2.4, scaleY: 2.4, alpha: 0, delay: k * 220, duration: 1200, ease: "Sine.out", onComplete: () => img.destroy() });
    }
  }

  private clear() {
    this.shimmer?.destroy();
    this.cover?.destroy();
    for (const f of this.floats) f.img.destroy();
    this.shimmer = undefined;
    this.cover = undefined;
    this.floats = [];
    this.pool = undefined;
  }

  destroy() {
    this.clear();
  }
}

/** Dónde queda el origen de cada cuadro de reflejos dentro de su textura (el recorte cambia por cuadro). */
const shimmerOffsets = new Map<string, { ox: number; oy: number }>();
