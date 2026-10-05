// Preferencias de cada persona que viven en este navegador (Ajustes): "menos movimiento" y el modo
// trabajo. No cambian nada del mundo ni del servidor: solo cómo se ve y se siente la cabaña aquí. Los
// volúmenes por tipo de sonido están en game/mixer.ts.
import { create } from "zustand";

/** "system" = como diga el sistema operativo (prefers-reduced-motion); "reduce" y "full", elegido a mano. */
export type MotionPref = "system" | "reduce" | "full";

/** Qué cinemáticas se ven: todas, solo las de la historia (sin los momentos cortos) o ninguna. */
export type CinePref = "todas" | "historia" | "ninguna";

interface PrefsStore {
  motion: MotionPref;
  /** Modo trabajo: el HUD sin lo de juego (puntos, avisos de logros, tiras de juego). */
  workMode: boolean;
  cine: CinePref;
  setMotion: (m: MotionPref) => void;
  setWorkMode: (on: boolean) => void;
  setCine: (c: CinePref) => void;
}

type Saved = Pick<PrefsStore, "motion" | "workMode" | "cine">;

const KEY = "hyvento:preferencias";

function load(): Saved {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const v = raw ? (JSON.parse(raw) as Partial<PrefsStore>) : {};
    const motion: MotionPref = v.motion === "reduce" || v.motion === "full" ? v.motion : "system";
    const cine: CinePref = v.cine === "historia" || v.cine === "ninguna" ? v.cine : "todas";
    return { motion, workMode: v.workMode === true, cine };
  } catch {
    return { motion: "system", workMode: false, cine: "todas" };
  }
}

function save(p: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // sin almacenamiento: vale solo para esta visita
  }
}

export const usePrefsStore = create<PrefsStore>((set, get) => ({
  ...load(),
  setMotion: (motion) => {
    set({ motion });
    save({ motion, workMode: get().workMode, cine: get().cine });
    applyMotionAttr();
  },
  setWorkMode: (workMode) => {
    set({ workMode });
    save({ motion: get().motion, workMode, cine: get().cine });
  },
  setCine: (cine) => {
    set({ cine });
    save({ motion: get().motion, workMode: get().workMode, cine });
  },
}));

const systemReduces = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * ¿Menos movimiento? Lo elegido en Ajustes y, si no se eligió, lo del sistema. Lo consultan el HUD y la
 * escena de Phaser (lluvia, hojas, destellos, sacudidas): llamarlo cada vez, no guardarlo, así el cambio
 * se ve sin recargar.
 */
export function lessMotion(): boolean {
  const m = usePrefsStore.getState().motion;
  return m === "system" ? systemReduces() : m === "reduce";
}

/**
 * Marca `<html data-motion="reduce">` cuando se pidió a mano: el CSS del juego lo usa además de la media
 * query del sistema (una media query no se puede prender desde la app).
 */
export function applyMotionAttr() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (usePrefsStore.getState().motion === "reduce") root.dataset.motion = "reduce";
  else if (usePrefsStore.getState().motion === "full") root.dataset.motion = "full";
  else delete root.dataset.motion;
}
