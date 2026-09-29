// El zoom de la cámara con la rueda del mouse y con dos dedos. Va por los pasos de zoom de la cámara
// (píxeles de pantalla enteros: el pixel-art queda nítido; en pantallas retina hay pasos intermedios) y
// junta lo que manda la rueda: un touchpad manda muchos eventos chicos por gesto y antes cada uno saltaba
// un nivel entero. El cambio se anima corto (sin animación con "menos movimiento").
import type * as Phaser from "phaser";
import { lessMotion } from "@/lib/prefs";
import { cameraZoom } from "./pixelRatio";

/** Cuánto hay que girar la rueda (en px de delta) para un paso: una muesca de mouse es ~100. */
const WHEEL_STEP = 100;
/** Tiempo mínimo entre dos pasos de la rueda (un giro fuerte no salta de una punta a la otra). */
const WHEEL_GAP_MS = 110;
/** Cuánto hay que abrir o cerrar los dedos (proporción) para un paso. */
const PINCH_STEP = 1.22;
const ANIM_MS = 140;

export interface ZoomOptions {
  /** Zoom "de siempre" mínimo y máximo (px CSS por px de mundo). */
  min: number;
  max: number;
  /** En el modo mesa el zoom lo maneja la mesa. */
  blocked: () => boolean;
  /** Empezaron dos dedos: el primer toque no era para caminar. */
  onPinch?: () => void;
}

export function bindZoom(scene: Phaser.Scene, o: ZoomOptions): () => void {
  const cam = scene.cameras.main;
  const canvas = scene.game.canvas;
  const lo = cameraZoom(o.min);
  const hi = cameraZoom(o.max);
  /** A dónde va el zoom (entero), aunque la animación todavía no llegue. */
  let target = Math.round(cam.zoom);
  let wheel = 0;
  let lastStep = 0;

  const step = (dir: 1 | -1) => {
    const next = Math.max(lo, Math.min(hi, target + dir));
    if (next === target) return;
    target = next;
    if (lessMotion()) cam.setZoom(next);
    else cam.zoomTo(next, ANIM_MS, "Sine.easeOut", true);
  };

  const onWheel = (e: WheelEvent) => {
    if (o.blocked()) return;
    // Firefox manda líneas (unas 3 por muesca) en vez de píxeles.
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    // Si cambió de sentido, lo juntado antes no cuenta.
    if (Math.sign(dy) !== Math.sign(wheel)) wheel = 0;
    wheel += dy;
    const now = performance.now();
    if (Math.abs(wheel) < WHEEL_STEP || now - lastStep < WHEEL_GAP_MS) return;
    lastStep = now;
    step(wheel > 0 ? -1 : 1);
    wheel = 0;
  };

  let pinch: number | null = null;
  const spread = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return;
    pinch = spread(e.touches);
    o.onPinch?.();
  };
  const onTouchMove = (e: TouchEvent) => {
    if (pinch === null || e.touches.length !== 2 || o.blocked()) return;
    e.preventDefault();
    const d = spread(e.touches);
    if (d / pinch >= PINCH_STEP) {
      step(1);
      pinch = d;
    } else if (pinch / d >= PINCH_STEP) {
      step(-1);
      pinch = d;
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch = null;
  };

  // Si alguien más cambia el zoom (el modo mesa al salir), se sigue desde ahí.
  const sync = () => {
    if (!cam.zoomEffect.isRunning) target = Math.round(cam.zoom);
  };
  scene.events.on("postupdate", sync);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
  return () => {
    scene.events.off("postupdate", sync);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchcancel", onTouchEnd);
  };
}
