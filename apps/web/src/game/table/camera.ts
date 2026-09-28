// Cámara del modo mesa: se acerca a la mesa con una transición suave y, al salir, vuelve a seguir al
// personaje con el zoom de antes. Coordenadas de pantalla del juego (las del arte a zoom 1). Qué se
// encuadra y con qué zoom está en @hyvento/map/art (casino-camara.ts), sin Phaser y con tests.
import { PIXEL_RATIO } from "../pixelRatio";
import type { ScreenBox, TableViewport } from "@hyvento/map/art";
import * as Phaser from "phaser";
import { useCasinoStore } from "../casino";

const MOVE_MS = 700;

export class TableCamera {
  private tween?: Phaser.Tweens.Tween;
  /** Zoom que había antes de entrar a la mesa (para volver). */
  private savedZoom: number | null = null;
  /**
   * Zoom al que está volviendo la cámara (mientras dura la transición de salida). Si se vuelve a entrar
   * antes de que termine, ese es el zoom a recordar, no el de la mitad de la animación.
   */
  private returning: number | null = null;
  /** A dónde apunta ahora (para no repetir la misma transición). */
  private goal = "";
  private last?: { rect: ScreenBox; zoom: number };

  constructor(private readonly scene: Phaser.Scene) {}

  private get cam() {
    return this.scene.cameras.main;
  }

  /** La ventana del juego y lo que tapa la tira de abajo (medida por la tira). */
  get viewport(): TableViewport {
    // La tira es DOM (px CSS) y la cámara cuenta en píxeles de pantalla.
    return { w: this.cam.width, h: this.cam.height, strip: useCasinoStore.getState().stripPx * PIXEL_RATIO };
  }

  /** Lleva la cámara a mostrar `rect` con `zoom` (deja de seguir al personaje). */
  focus(rect: ScreenBox, zoom: number, ms = MOVE_MS) {
    const cam = this.cam;
    this.last = { rect, zoom };
    // El centro baja media tira: la mesa queda centrada en el espacio libre de arriba.
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2 + this.viewport.strip / 2 / zoom;
    const key = `${cx.toFixed(1)},${cy.toFixed(1)},${zoom}`;
    if (key === this.goal) return;
    this.goal = key;
    if (this.savedZoom === null) this.savedZoom = this.returning ?? cam.zoom;
    this.returning = null;
    cam.stopFollow();
    this.animate(cx, cy, zoom, ms);
  }

  /** La tira cambió de alto: se recentra la mesa (con el mismo zoom, sin rehacer los dibujos). */
  recenter() {
    if (this.savedZoom !== null && this.last) this.focus(this.last.rect, this.last.zoom, 250);
  }

  /** Vuelve a seguir a `target` con el zoom de antes. */
  release(target: Phaser.GameObjects.Components.Transform | undefined, ms = MOVE_MS) {
    if (this.savedZoom === null) return;
    const zoom = this.savedZoom;
    this.savedZoom = null;
    this.goal = "";
    this.last = undefined;
    if (!target) {
      this.tween?.stop();
      this.cam.setZoom(zoom);
      return;
    }
    this.returning = zoom;
    this.animate(target.x, target.y, zoom, ms, () => {
      this.returning = null;
      this.cam.startFollow(target as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform, true, 0.15, 0.15);
    });
  }

  /** Corta la transición en curso (al destruir la escena o cambiar de nivel). */
  stop() {
    this.tween?.stop();
    this.tween = undefined;
    // Si se cortó a la mitad de la vuelta, el zoom queda en el de destino (entero: el pixel-art parejo).
    // Al destruir la escena (reconexión) la cámara ya no existe: no hay zoom que dejar.
    if (this.returning !== null) this.scene.cameras?.main?.setZoom(this.returning);
    this.returning = null;
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
