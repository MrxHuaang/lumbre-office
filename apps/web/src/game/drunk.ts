// Borrachera en el cliente. La etapa la decide el servidor (`Player.drunk`); acá solo se dibuja: la
// pantalla de quien tomó se nubla, ondula y se ve doble, camina en zigzag, y los demás lo ven tambalearse.
import { DRUNK_STAGE_TEXT, type DrunkStage } from "@hyvento/shared";
import type { CanvasFx } from "./trip";
import { lessMotion } from "@/lib/prefs";

/** Cuánto pesa cada etapa en lo que se ve (0 = nada, 1 = lo más fuerte). */
const INTENSITY: Record<DrunkStage, number> = { 0: 0, 1: 0.3, 2: 0.65, 3: 1, 4: 1 };

/** Lo que se tambalea el personaje (grados) en cada etapa (desmayado se cae: ver `Avatar.faint`). */
export const SWAY_DEG: Record<DrunkStage, number> = { 0: 0, 1: 1.5, 2: 3.5, 3: 6, 4: 0 };

/** Cuánto se desvía al caminar (radianes, de lado a lado) en cada etapa. */
const DRIFT_RAD: Record<DrunkStage, number> = { 0: 0, 1: 0, 2: 0.35, 3: 0.65, 4: 0 };

export const DRUNK_NOTICE: Record<DrunkStage, string> = {
  0: "Se te pasó el trago. Todo vuelve a su lugar.",
  1: `${DRUNK_STAGE_TEXT[1]}: el mundo se ve un poquito más bonito.`,
  2: `${DRUNK_STAGE_TEXT[2]}: la cabaña se mueve un poco…`,
  3: `${DRUNK_STAGE_TEXT[3]}: mejor siéntate un rato (se pasa en unos minutos).`,
  4: "Te pasaste de tragos… todo se pone negro.",
};

/** Al despertar del desmayo, descansando en la casa. */
export const WAKE_NOTICE = "Despertaste en la zona de descanso. Todavía da vueltas todo…";


/**
 * La visión de quien tomó: filtros CSS sobre el canvas del juego (sirve con el render Canvas 2D, sin
 * WebGL). El HUD queda fuera del canvas y se sigue leyendo bien. Entra y sale de a poco.
 */
export class DrunkVision {
  private stage: DrunkStage = 0;
  /** Lo que se ve ahora (va hacia `INTENSITY[stage]` de a poco). */
  private level = 0;
  private applied = false;

  constructor(private readonly canvas: () => HTMLCanvasElement | undefined) {}

  setStage(stage: DrunkStage) {
    this.stage = stage;
  }

  /**
   * Cada cuadro. `extra`: lo del Man del Sombrero (ver trip.ts), que se suma a lo de la borrachera en el
   * mismo canvas.
   */
  update(time: number, delta: number, extra: CanvasFx | null = null) {
    const target = INTENSITY[this.stage];
    // Sube en ~3 s y baja en ~6 s: el trago pega de a poco y se va más lento.
    const rate = (target > this.level ? 1 / 3000 : 1 / 6000) * delta;
    this.level = target > this.level ? Math.min(target, this.level + rate) : Math.max(target, this.level - rate);
    const el = this.canvas();
    if (!el) return;
    const own = this.level > 0.001 ? this.fx(time) : null;
    if (!own && !extra) {
      if (this.applied) this.clear(el);
      return;
    }
    this.applied = true;
    el.style.filter = [own?.filter, extra?.filter].filter(Boolean).join(" ");
    el.style.transform = [own?.transform, extra?.transform].filter(Boolean).join(" ");
  }

  /** Lo que se ve borracho: nublado, con los colores corridos, imagen doble y todo meciéndose. */
  private fx(time: number): CanvasFx {
    const k = this.level;
    const t = time / 1000;
    const blur = (0.4 + 1.6 * k).toFixed(2);
    const sat = (1 + 0.5 * k).toFixed(2);
    // Con menos movimiento: solo nublado, sin ondas ni imagen doble que se mueva.
    if (lessMotion()) return { filter: `blur(${blur}px) saturate(${sat})`, transform: "" };
    const hue = (Math.sin(t * 0.7) * 25 * k).toFixed(1);
    // La imagen doble: una copia rosada corrida que va y viene.
    const gx = (Math.sin(t * 1.3) * 7 * k).toFixed(1);
    const gy = (Math.cos(t * 0.9) * 3 * k).toFixed(1);
    const ghost = k > 0.4 ? ` drop-shadow(${gx}px ${gy}px 0 rgba(255, 190, 220, ${(0.45 * k).toFixed(2)}))` : "";
    const rot = (Math.sin(t * 0.8) * 1.6 * k).toFixed(2);
    const scale = (1 + 0.04 * k + Math.sin(t * 1.1) * 0.012 * k).toFixed(3);
    return { filter: `blur(${blur}px) saturate(${sat}) hue-rotate(${hue}deg)${ghost}`, transform: `rotate(${rot}deg) scale(${scale})` };
  }

  /** Cómo se desvía al caminar: se gira la dirección de lado a lado (sin cambiar la velocidad). */
  drift(time: number, vx: number, vy: number): [number, number] {
    const amp = DRIFT_RAD[this.stage];
    if (!amp || (vx === 0 && vy === 0)) return [vx, vy];
    const a = Math.sin(time / 520) * amp + Math.sin(time / 1370) * amp * 0.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [vx * c - vy * s, vx * s + vy * c];
  }

  private clear(el: HTMLCanvasElement) {
    el.style.filter = "";
    el.style.transform = "";
    this.applied = false;
  }

  destroy() {
    const el = this.canvas();
    if (el) this.clear(el);
  }
}
