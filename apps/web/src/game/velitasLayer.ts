// La Noche de velitas en Phaser (el estado está en velitas.ts): las velitas que prende la gente en el
// jardín (con su dibujo de día o de noche y su luz, que se suma a la penumbra) y los faroles de deseos que
// suben desde el muelle con el deseo escrito debajo; en la suelta de las 21:00, todos juntos sobre el lago.
import { catalogItem, farolesOrigin, velitaTypeAt, type OfficeMap } from "@hyvento/map";
import { drawFarolVolador, VELITA_COLORES, WORLD_TO_ART } from "@hyvento/map/art";
import { VELITAS, type FarolEvent } from "@hyvento/shared";
import * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { DEPTH_OVERLAY, ensureTexture, furnitureImage, worldToScreen, type AreaView } from "./iso/view";
import { useOfficeStore } from "./store";
import { onFarol, onSuelta, useVelitasStore, type DeseoView } from "./velitas";

interface Flight {
  img: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Text;
  /** Desde dónde sube (px de pantalla del nivel). */
  x: number;
  y: number;
  start: number;
  ms: number;
  sway: number;
  rise: number;
}

/** Lo que dura un farol subiendo (y la suelta, un poco más). */
const FLIGHT_MS = 9_000;
const SUELTA_MS = 13_000;

export class VelitasLayer {
  private map?: OfficeMap;
  private view?: AreaView;
  private images = new Map<string, Phaser.GameObjects.Image>();
  private night = false;
  private flights: Flight[] = [];
  private cleanups: (() => void)[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.cleanups.push(
      useVelitasStore.subscribe((s, prev) => s.placed !== prev.placed && this.sync()),
      useOfficeStore.subscribe((s, prev) => {
        if (s.night === prev.night) return;
        // Con la noche cambia el dibujo (el papel prendido): se vuelven a poner todas.
        this.clearImages();
        this.sync();
      }),
      onFarol((e) => this.launch(e)),
      onSuelta((wishes) => this.suelta(wishes)),
    );
  }

  setArea(map: OfficeMap, view: AreaView | undefined) {
    this.clearImages();
    this.map = map;
    this.view = view;
    this.sync();
  }

  /** Pone las velitas que faltan, quita las que ya no están y le pasa las luces a la vista. */
  private sync() {
    const map = this.map;
    const view = this.view;
    if (!map || !view) return;
    if (map.id !== VELITAS.area) return this.clearImages();
    const night = useOfficeStore.getState().night;
    if (night !== this.night) this.clearImages();
    this.night = night;
    const placed = useVelitasStore.getState().placed;
    const keep = new Set(placed.map((p) => p.key));
    for (const [key, img] of this.images)
      if (!keep.has(key)) {
        img.destroy();
        this.images.delete(key);
      }
    const ts = map.tileSize;
    const lights: { x: number; y: number; z: number; color: string; radius: number }[] = [];
    for (const p of placed) {
      const type = velitaTypeAt(p.x, p.y);
      if (!this.images.has(p.key)) this.images.set(p.key, furnitureImage(this.scene, { type, x: p.x, y: p.y, facing: "right" }, night, ts).img);
      const light = catalogItem(type).light;
      if (light) lights.push({ x: p.x * ts + light.at[0] / WORLD_TO_ART, y: p.y * ts + light.at[1] / WORLD_TO_ART, z: light.at[2], color: light.color, radius: light.radius });
    }
    view.setExtraLights(lights);
  }

  private clearImages() {
    for (const img of this.images.values()) img.destroy();
    this.images.clear();
  }

  /** Un farol que sube desde (x, y) (px de mundo del jardín), con el deseo debajo mientras se lee. */
  private fly(x: number, y: number, text: string, delay: number, ms: number) {
    if (this.map?.id !== VELITAS.area) return;
    const color = VELITA_COLORES[Math.abs(Math.floor(x + y * 7)) % VELITA_COLORES.length]!;
    const s = drawFarolVolador(color);
    const key = ensureTexture(this.scene, `farol-volador-${color}`, () => s.canvas);
    const p = worldToScreen(x, y, 30);
    const img = this.scene.add.image(p.x, p.y, key).setOrigin(s.ox / s.canvas.width, s.oy / s.canvas.height).setDepth(DEPTH_OVERLAY + 3).setAlpha(0);
    const label = text
      ? this.scene.add
          .text(p.x, p.y + 10, text, { fontFamily: "Pixelify Sans, monospace", fontSize: "11px", color: "#fff4c8", stroke: "#3a2a20", strokeThickness: 3, align: "center", wordWrap: { width: 150 } })
          .setOrigin(0.5, 0)
          .setDepth(DEPTH_OVERLAY + 3)
          .setAlpha(0)
      : undefined;
    this.flights.push({ img, label, x: p.x, y: p.y, start: this.scene.time.now + delay, ms, sway: Math.random() * Math.PI * 2, rise: 260 + Math.random() * 120 });
  }

  private launch(e: FarolEvent) {
    this.fly(e.x, e.y, e.text, 0, FLIGHT_MS);
  }

  /** La suelta: un farol por deseo, repartidos sobre el agua frente al muelle y de a poquitos. */
  private suelta(wishes: readonly DeseoView[]) {
    const map = this.map;
    const at = map ? farolesOrigin(map) : null;
    if (!map || !at) return;
    const ts = map.tileSize;
    // Aunque nadie haya soltado el suyo, suben unos cuantos (los de la casa).
    const list = wishes.length ? wishes : Array.from({ length: 6 }, () => null);
    list.forEach((w, i) => {
      const a = (i * 2.399) % (Math.PI * 2);
      const r = (1 + (i % 4)) * ts * 1.2;
      this.fly(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * 0.8, w ? `${w.text} — ${w.name}` : "", i * 260, SUELTA_MS);
    });
  }

  /** Cada cuadro: los faroles suben meciéndose, se achican con la distancia y se apagan arriba. */
  update(time: number) {
    if (!this.flights.length) return;
    const still = lessMotion();
    this.flights = this.flights.filter((f) => {
      const k = (time - f.start) / f.ms;
      if (k < 0) return true;
      if (k >= 1) {
        f.img.destroy();
        f.label?.destroy();
        return false;
      }
      const fade = Math.min(1, k / 0.08) * Math.min(1, (1 - k) / 0.3);
      // Con "menos movimiento" no se mecen: suben derechito.
      const x = f.x + (still ? 0 : Math.sin(time / 650 + f.sway) * 6 * (0.4 + k));
      const y = f.y - f.rise * (k * (0.6 + k * 0.4));
      f.img.setPosition(x, y).setAlpha(fade).setScale(1.6 - k * 0.8);
      f.label?.setPosition(f.x, f.y + 12).setAlpha(Math.min(1, k / 0.06) * Math.max(0, 1 - k / 0.45));
      return true;
    });
  }

  destroy() {
    for (const c of this.cleanups) c();
    this.clearImages();
    for (const f of this.flights) {
      f.img.destroy();
      f.label?.destroy();
    }
    this.flights = [];
  }
}
