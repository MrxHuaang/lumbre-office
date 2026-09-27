// Cámara del modo mesa: se acerca a la mesa con una transición suave y, al salir, vuelve a seguir al
// personaje con el zoom de antes. Coordenadas de pantalla del juego (las del arte a zoom 1).
import * as Phaser from "phaser";

/**
 * Alto (px reales) que ocupan abajo la tira del modo mesa y los controles de micrófono y cámara: la
 * mesa se centra en lo que queda arriba.
 */
export const STRIP_PX = 170;
const MOVE_MS = 700;

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectOf(points: { x: number; y: number }[], pad = 0): ScreenRect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

export class TableCamera {
  private tween?: Phaser.Tweens.Tween;
  /** Zoom que había antes de entrar a la mesa (para volver). */
  private savedZoom: number | null = null;
  /** A dónde apunta ahora (para no repetir la misma transición). */
  private goal = "";

  constructor(private readonly scene: Phaser.Scene) {}

  private get cam() {
    return this.scene.cameras.main;
  }

  /**
   * Zoom entero (par si `even`) con el que `rect` entra en la pantalla con aire alrededor, sin la tira
   * de abajo. Los dibujos del modo mesa van a R = zoom / 2 (puntos de 2 píxeles).
   */
  fitZoom(rect: ScreenRect, min: number, max: number, even = true, fill = 0.8): number {
    const w = this.cam.width * fill;
    const h = (this.cam.height - STRIP_PX) * fill;
    let z = Math.floor(Math.min(w / rect.w, h / rect.h));
    if (even) z -= z % 2;
    return Phaser.Math.Clamp(z, min, max);
  }

  /** Lleva la cámara a mostrar `rect` con `zoom` (deja de seguir al personaje). */
  focus(rect: ScreenRect, zoom: number, ms = MOVE_MS) {
    const cam = this.cam;
    // El centro baja media tira: la mesa queda centrada en el espacio libre de arriba.
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2 + STRIP_PX / 2 / zoom;
    const key = `${cx.toFixed(1)},${cy.toFixed(1)},${zoom}`;
    if (key === this.goal) return;
    this.goal = key;
    if (this.savedZoom === null) this.savedZoom = cam.zoom;
    cam.stopFollow();
    this.animate(cx, cy, zoom, ms);
  }

  /** Vuelve a seguir a `target` con el zoom de antes. */
  release(target: Phaser.GameObjects.Components.Transform | undefined, ms = MOVE_MS) {
    if (this.savedZoom === null) return;
    const zoom = this.savedZoom;
    this.savedZoom = null;
    this.goal = "";
    if (!target) {
      this.tween?.stop();
      this.cam.setZoom(zoom);
      return;
    }
    this.animate(target.x, target.y, zoom, ms, () => {
      this.cam.startFollow(target as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform, true, 0.15, 0.15);
    });
  }

  /** Corta la transición en curso (al destruir la escena o cambiar de nivel). */
  stop() {
    this.tween?.stop();
    this.tween = undefined;
  }

  get active() {
    return this.savedZoom !== null;
  }

  private animate(x: number, y: number, zoom: number, ms: number, done?: () => void) {
    const cam = this.cam;
    this.tween?.stop();
    const from = { x: cam.midPoint.x, y: cam.midPoint.y, z: cam.zoom };
    this.tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      ease: "Sine.inOut",
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        // El zoom se interpola en escala logarítmica: el acercamiento se siente parejo.
        const z = Math.exp(Math.log(from.z) + (Math.log(zoom) - Math.log(from.z)) * t);
        cam.setZoom(z);
        cam.centerOn(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
      },
      onComplete: () => {
        cam.setZoom(zoom);
        cam.centerOn(x, y);
        done?.();
      },
    });
  }
}
