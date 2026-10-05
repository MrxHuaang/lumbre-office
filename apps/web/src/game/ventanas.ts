// Las ventanas con el clima y la luz del juego (VIR-90): sobre el vidrio de cada ventana de la pared van
// gotas que bajan con lluvia o tormenta, nieve en las esquinas cuando nieva y un tinte cálido al amanecer
// y al atardecer del reloj del juego. El día y la noche ya los dibuja la pared (AreaView se rearma al
// cruzar las 19:00 y las 7:00). Una imagen por ventana, que cambia de textura: el recorte de cámara
// (iso/culling.ts) las saca de la lista si no se ven. Con "menos movimiento", las gotas quedan quietas.
import { type OfficeMap, type WallFeature } from "@hyvento/map";
import { WINDOW_RAIN_FRAMES, windowRain, windowTone, type WindowTone, type WindowWeather } from "@hyvento/map/art";
import type { Weather } from "@hyvento/shared";
import * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { windowToneAt, windowWeatherOf } from "@/lib/ventanas";
import { currentGameTime } from "./gameClock";
import { depthOf, ensureTexture, worldToScreen } from "./iso/view";

/** Cada cuánto baja un cuadro de las gotas (ms). */
const FRAME_MS = 170;
/** Cada cuánto se mira la hora del juego para el tinte (ms reales; 1 s = 1 minuto del juego). */
const TONE_CHECK_MS = 1000;

interface Pane {
  f: WallFeature;
  weather?: Phaser.GameObjects.Image;
  tone?: Phaser.GameObjects.Image;
}

export class WindowView {
  private panes: Pane[] = [];
  private map: OfficeMap | null = null;
  private weather: WindowWeather | null = null;
  private tone: WindowTone | null = null;
  private frame = 0;
  private nextFrameAt = 0;
  private nextToneAt = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  setArea(map: OfficeMap) {
    this.clear();
    this.map = map;
    // Afuera no hay ventanas de pared; adentro, cada una con su capa.
    this.panes = map.def.features.filter((f) => f.kind === "window").map((f) => ({ f }));
    this.tone = this.currentTone();
    this.redraw();
  }

  setWeather(w: Weather) {
    const next = windowWeatherOf(w);
    if (next === this.weather) return;
    this.weather = next;
    this.redraw();
  }

  update(time: number) {
    if (!this.panes.length) return;
    if (time >= this.nextToneAt) {
      this.nextToneAt = time + TONE_CHECK_MS;
      const tone = this.currentTone();
      if (tone !== this.tone) {
        this.tone = tone;
        this.redraw();
      }
    }
    if (this.weather && this.weather !== "snow" && !lessMotion() && time >= this.nextFrameAt) {
      this.nextFrameAt = time + FRAME_MS;
      this.frame = (this.frame + 1) % WINDOW_RAIN_FRAMES;
      for (const p of this.panes) if (p.weather) p.weather.setTexture(this.weatherKey(p.f));
    }
  }

  destroy() {
    this.clear();
    this.map = null;
  }

  /** De noche no hay tinte (la pared ya dibuja el vidrio oscuro). */
  private currentTone(): WindowTone | null {
    const t = currentGameTime();
    return t ? windowToneAt(t.minuteOfDay) : null;
  }

  /** El origen de la capa de gotas (el mismo en todos los cuadros y climas): se calcula una vez por tamaño. */
  private origins = new Map<string, { ox: number; oy: number }>();
  private rainOrigin(edge: "h" | "v", width: number) {
    const k = `${edge}-${width}`;
    let o = this.origins.get(k);
    if (!o) {
      const s = windowRain(edge, width, "rain", 0);
      o = { ox: s.ox, oy: s.oy };
      this.origins.set(k, o);
    }
    return o;
  }

  private weatherKey(f: WallFeature): string {
    const width = f.width ?? 1;
    const kind = this.weather!;
    const frame = kind === "snow" ? 0 : this.frame;
    return ensureTexture(this.scene, `ventana-${kind}-${f.edge}-${width}-${frame}`, () => windowRain(f.edge, width, kind, frame).canvas);
  }

  /** Pone (o quita) las capas de cada ventana según el clima y la hora de ahora. */
  private redraw() {
    const map = this.map;
    if (!map) return;
    const ts = map.tileSize;
    for (const p of this.panes) {
      const { f } = p;
      const width = f.width ?? 1;
      const a = worldToScreen(f.x * ts, f.y * ts);
      // Un poco antes que la cortina cerrada (casaViva, +0.5): si está cerrada, la tapa.
      const depth = depthOf(f.x * ts, f.y * ts) + 0.4;
      p.weather?.destroy();
      p.weather = undefined;
      if (this.weather) {
        const s = this.rainOrigin(f.edge, width);
        p.weather = this.scene.add.image(a.x - s.ox, a.y - s.oy, this.weatherKey(f)).setOrigin(0, 0).setDepth(depth);
      }
      p.tone?.destroy();
      p.tone = undefined;
      if (this.tone) {
        const tone = this.tone;
        const s = windowTone(f.edge, width, tone);
        const key = ensureTexture(this.scene, `ventana-${tone}-${f.edge}-${width}`, () => s.canvas);
        p.tone = this.scene.add.image(a.x - s.ox, a.y - s.oy, key).setOrigin(0, 0).setDepth(depth - 0.05).setAlpha(0.55);
      }
    }
  }

  private clear() {
    for (const p of this.panes) {
      p.weather?.destroy();
      p.tone?.destroy();
    }
    this.panes = [];
  }
}
