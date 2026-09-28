// Lo que ve quien tomó algo del Man del Sombrero. El efecto y hasta cuándo los decide el servidor
// (`Player.trip`); acá solo se dibuja, como la borrachera (ver drunk.ts): filtros CSS sobre el canvas del
// juego y, para la bruma y las visiones, una capa encima (sin tocar el HUD, que sigue legible).
import { styleFor } from "@hyvento/map/art";
import { TRIP_TEXT, tripSpeedMul, type EyeStyle, type Look, type TripKind } from "@hyvento/shared";
import { lessMotion } from "@/lib/prefs";

/** Filtro y transformación que se suman a los de la borrachera (los aplica DrunkVision). */
export interface CanvasFx {
  filter: string;
  transform: string;
}

/** Avisos al empezar cada efecto (y al pasarse). */
export const TRIP_NOTICE: Record<TripKind | "", string> = {
  "": "Se te pasó el efecto. Todo vuelve a la normalidad… más o menos.",
  trabado: `${TRIP_TEXT.trabado}: todo va más despacio y te está dando hambre.`,
  acelere: `${TRIP_TEXT.acelere}: no puedes quedarte quieto, ¡hágale, hágale!`,
  colores: `${TRIP_TEXT.colores}: la cabaña respira y los colores bailan.`,
  yage: `${TRIP_TEXT.yage}: los patrones se abren… siéntate, que marea.`,
  tusi: `${TRIP_TEXT.tusi}: todo se puso rosado y el cuerpo pide perreo.`,
  keta: `${TRIP_TEXT.keta}: todo va en cámara lenta y se ve lejísimos…`,
};

/** Antojos del trabado (van rotando en los avisos). */
export const MUNCHIES = [
  "Qué antojo de un pandebono…",
  "Uy, una empanada con ají ahorita…",
  "¿Y si pido un cholado? O dos.",
  "Mataría por una arepa de huevo.",
];

/**
 * Los ojos de cada efecto: entrecerrados trabado, pelados acelerado, felices con los colores, cerrados con
 * el yagé, guiñando con el tusi y perdidos (bien abiertos) con la keta.
 */
const TRIP_EYES: Record<TripKind, EyeStyle> = { trabado: "sleepy", acelere: "big", colores: "happy", yage: "closed", tusi: "wink", keta: "big" };

/** El look con los ojos del efecto (los personajes fijos también: se parte de su preset). */
export function tripLook(look: Look | null, avatar: string, trip: TripKind | ""): Look | null {
  if (!trip) return look;
  const base = styleFor(avatar, look);
  return { ...base, accessories: base.accessories ?? [], eyes: TRIP_EYES[trip] } as Look;
}


export class TripVision {
  private kind: TripKind | "" = "";
  /** El efecto que se está viendo (se queda mientras baja la intensidad al terminar). */
  private shown: TripKind | "" = "";
  private level = 0;
  private overlay?: HTMLDivElement;

  constructor(private readonly parent: () => HTMLElement | null | undefined) {}

  setTrip(kind: TripKind | "") {
    this.kind = kind;
    if (kind) this.shown = kind;
  }

  get active(): TripKind | "" {
    return this.kind;
  }

  /** Cuánto se camina: trabado o con la keta, más despacio (el servidor tampoco deja ir más rápido). */
  speedMul(): number {
    return tripSpeedMul(this.kind);
  }

  /** Con el yagé se camina ladeado, como mareado (la misma velocidad). */
  drift(time: number, vx: number, vy: number): [number, number] {
    if (this.kind !== "yage" || (vx === 0 && vy === 0)) return [vx, vy];
    const a = Math.sin(time / 640) * 0.45;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [vx * c - vy * s, vx * s + vy * c];
  }

  /** Cada cuadro: sube o baja la intensidad y devuelve el filtro del canvas (o null si no hay nada). */
  update(time: number, delta: number): CanvasFx | null {
    const target = this.kind ? 1 : 0;
    // Pega en ~4 s y se va en ~6 s.
    const rate = (target > this.level ? 1 / 4000 : 1 / 6000) * delta;
    this.level = target > this.level ? Math.min(target, this.level + rate) : Math.max(target, this.level - rate);
    if (this.level <= 0.001) {
      this.shown = "";
      this.clearOverlay();
      return null;
    }
    const k = this.level;
    const t = time / 1000;
    const calm = lessMotion();
    switch (this.shown) {
      case "trabado": {
        // Bruma verdosa por los bordes que respira despacio, y todo un poquito borroso y lento.
        const pulse = calm ? 0.5 : 0.5 + Math.sin(t * 0.9) * 0.5;
        this.paintOverlay(
          `radial-gradient(ellipse at center, rgba(150, 210, 110, ${(0.1 * k).toFixed(3)}) 30%, rgba(90, 160, 70, ${((0.42 + 0.15 * pulse) * k).toFixed(3)}) 100%)`,
          "normal",
          1,
        );
        return { filter: `blur(${(0.5 * k).toFixed(2)}px) saturate(${(1 - 0.15 * k).toFixed(2)}) sepia(${(0.2 * k).toFixed(2)})`, transform: "" };
      }
      case "acelere": {
        // Contraste alto y la pantalla que tiembla (a saltos, como el corazón).
        this.clearOverlay();
        const jx = calm ? 0 : Math.round(Math.sin(t * 53) * 1.4 * k);
        const jy = calm ? 0 : Math.round(Math.cos(t * 47) * 1.2 * k);
        return { filter: `contrast(${(1 + 0.25 * k).toFixed(2)}) saturate(${(1 + 0.4 * k).toFixed(2)})`, transform: `translate(${jx}px, ${jy}px)` };
      }
      case "colores": {
        // Los colores dan la vuelta entera y el mundo ondula de lado a lado.
        this.clearOverlay();
        const hue = calm ? 90 * k : ((t * 70) % 360) * k;
        const filter = `hue-rotate(${hue.toFixed(0)}deg) saturate(${(1 + 1.1 * k).toFixed(2)})`;
        if (calm) return { filter, transform: "" };
        const sx = (Math.sin(t * 1.1) * 3 * k).toFixed(2);
        const sy = (Math.cos(t * 0.8) * 2 * k).toFixed(2);
        return { filter, transform: `skew(${sx}deg, ${sy}deg) scale(${(1 + 0.04 * k).toFixed(3)})` };
      }
      case "yage": {
        // Patrones de colores que giran encima del mundo (como los de las visiones) y el mareo.
        const spin = calm ? 0 : (t * 8) % 360;
        const alpha = ((0.22 + (calm ? 0 : Math.sin(t * 0.7) * 0.08)) * k).toFixed(3);
        this.paintOverlay(
          `repeating-conic-gradient(from ${spin.toFixed(1)}deg at 50% 50%, rgba(255, 90, 170, ${alpha}) 0deg 12deg, rgba(80, 220, 200, ${alpha}) 12deg 24deg, rgba(255, 210, 80, ${alpha}) 24deg 36deg), radial-gradient(circle at center, transparent 20%, rgba(40, 10, 60, ${(0.35 * k).toFixed(3)}) 90%)`,
          "overlay",
          1,
        );
        const rot = calm ? 0 : Math.sin(t * 0.6) * 1.8 * k;
        return { filter: `saturate(${(1 + 0.5 * k).toFixed(2)})`, transform: `rotate(${rot.toFixed(2)}deg) scale(${(1 + 0.03 * k).toFixed(3)})` };
      }
      case "tusi": {
        // Todo rosado chicle, que late al ritmo del perreo (~124 golpes por minuto).
        const beat = calm ? 0 : Math.max(0, Math.sin(t * Math.PI * 2 * (124 / 60))) ** 6;
        this.paintOverlay(
          `radial-gradient(ellipse at center, rgba(255, 120, 200, ${((0.3 + 0.12 * beat) * k).toFixed(3)}) 20%, rgba(255, 60, 170, ${(0.6 * k).toFixed(3)}) 100%)`,
          "color",
          1,
        );
        return {
          filter: `saturate(${(1 + 0.35 * k).toFixed(2)}) brightness(${(1 + (0.04 + 0.05 * beat) * k).toFixed(3)})`,
          transform: calm ? "" : `scale(${(1 + 0.008 * beat * k).toFixed(4)})`,
        };
      }
      case "keta": {
        // Cámara lenta: el mundo se aleja (como mirado desde el fondo de un hueco), pierde color y respira
        // despacito; los bordes se oscurecen como un túnel.
        const breathe = calm ? 0 : Math.sin(t * 0.35) * 0.02;
        this.paintOverlay(
          `radial-gradient(circle at center, transparent 30%, rgba(12, 10, 24, ${(0.8 * k).toFixed(3)}) 88%)`,
          "normal",
          1,
        );
        return {
          // Y una estela azulada que se arrastra detrás de todo, como si la imagen llegara tarde.
          filter: `saturate(${(1 - 0.55 * k).toFixed(2)}) blur(${(0.6 * k).toFixed(2)}px) contrast(${(1 - 0.1 * k).toFixed(2)})${calm ? "" : ` drop-shadow(${(Math.sin(t * 0.4) * 5 * k).toFixed(1)}px ${(Math.cos(t * 0.3) * 3 * k).toFixed(1)}px 0 rgba(170, 190, 255, ${(0.35 * k).toFixed(2)}))`}`,
          transform: `scale(${(1 - (0.16 - breathe) * k).toFixed(3)})`,
        };
      }
      default:
        this.clearOverlay();
        return null;
    }
  }

  /** La capa de encima del canvas (bruma, visiones): no recibe clics. */
  private paintOverlay(background: string, blend: string, opacity: number) {
    if (!this.overlay) {
      const host = this.parent();
      if (!host) return;
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;";
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.appendChild(el);
      this.overlay = el;
    }
    this.overlay.style.background = background;
    this.overlay.style.mixBlendMode = blend;
    this.overlay.style.opacity = String(opacity);
  }

  private clearOverlay() {
    this.overlay?.remove();
    this.overlay = undefined;
  }

  destroy() {
    this.clearOverlay();
  }
}
