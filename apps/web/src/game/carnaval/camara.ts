// La cámara de quien baila en la comparsa de la cabaña (docs/plan-carnaval.md): con 3 o más de la cabaña
// bailando, se acerca un paso para que se vea la fiesta de cerca; al salirse (o si quedan menos) vuelve
// a donde estaba. No pelea con la rueda: si alguien cambia el zoom mientras tanto, se respeta.
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";

/** Cuántos de la cabaña tienen que ir bailando para que la cámara se acerque. */
export const CAMARA_COMPARSA_MIN = 3;
const ANIM_MS = 700;

/** El zoom de la cámara de quien baila: un paso más cerca (entero, así el pixel art queda nítido). */
export function zoomComparsa(base: number, bailando: number, max: number): number {
  return bailando >= CAMARA_COMPARSA_MIN ? Math.min(max, Math.round(base) + 1) : Math.round(base);
}

export class CamaraComparsa {
  /** El zoom de antes de acercarse (null: no está acercada). */
  private base: number | null = null;
  /** El zoom que puso esta cámara (para no deshacer lo que alguien cambió después). */
  private puesto = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** El zoom de cámara más cercano permitido. */
    private readonly max: number,
  ) {}

  /** Cada cuadro: ¿voy bailando en la comparsa? ¿Cuántos de la cabaña van bailando (yo incluido)? */
  update(enComparsa: boolean, bailando: number) {
    const cam = this.scene.cameras?.main;
    if (!cam) return;
    const quiere = enComparsa && bailando >= CAMARA_COMPARSA_MIN;
    if (quiere && this.base === null) {
      const base = Math.round(cam.zoom);
      const z = zoomComparsa(base, bailando, this.max);
      if (z === base) return;
      this.base = base;
      this.puesto = z;
      this.zoom(z);
    } else if (!quiere && this.base !== null) {
      // Solo se devuelve si nadie la movió después (la rueda o una cinemática).
      if (Math.round(cam.zoom) === this.puesto || cam.zoomEffect.isRunning) this.zoom(this.base);
      this.base = null;
    }
  }

  private zoom(z: number) {
    const cam = this.scene.cameras.main;
    if (lessMotion()) cam.setZoom(z);
    else cam.zoomTo(z, ANIM_MS, "Sine.easeInOut", true);
  }
}
