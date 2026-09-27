// Estado del cine en el cliente: copia de lo que sincroniza el servidor (la función, la cola y lo que ya
// se vio) y lo que es solo de esta persona (volumen y silencio, guardados en el navegador; ver en grande).
import { showElapsed, type CinemaShowState, type ClubVideoView } from "@hyvento/shared";
import { create } from "zustand";
import { serverNow } from "../club/store";

export interface CinemaHere {
  /** Dentro de la sala del cine (ahí se oye la función y se programa). */
  inCinema: boolean;
  /** En la cabina, junto al proyector (ahí se pausa y se sigue). */
  atBooth: boolean;
}

interface CinemaStore extends CinemaShowState {
  /** La película de ahora (o null), lo que viene y lo que ya se vio. */
  now: ClubVideoView | null;
  queue: ClubVideoView[];
  history: ClubVideoView[];
  setShow: (s: CinemaShowState & { now: ClubVideoView | null; queue: ClubVideoView[]; history: ClubVideoView[] }) => void;
  /** El navegador no dejó sonar la función sola: hace falta un toque. */
  needsTap: boolean;
  setNeedsTap: (b: boolean) => void;
  /** Ver la función en grande (clic en la pantalla). */
  big: boolean;
  setBig: (b: boolean) => void;
  volume: number;
  muted: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  here: CinemaHere;
  setHere: (h: CinemaHere) => void;
}

const PREFS_KEY = "hyvento:cine";

function loadPrefs(): { volume: number; muted: boolean } {
  const fallback = { volume: 0.8, muted: false };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : fallback.volume,
      muted: typeof p.muted === "boolean" ? p.muted : fallback.muted,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: { volume: number; muted: boolean }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // sin almacenamiento: vale solo para esta visita
  }
}

export const useCinemaStore = create<CinemaStore>((set, get) => ({
  video: "",
  startedAt: 0,
  paused: false,
  pausedAt: 0,
  now: null,
  queue: [],
  history: [],
  setShow: (s) => set(s),
  needsTap: false,
  setNeedsTap: (needsTap) => get().needsTap !== needsTap && set({ needsTap }),
  big: false,
  setBig: (big) => set({ big }),
  ...loadPrefs(),
  setVolume: (volume) => {
    set({ volume });
    savePrefs({ volume, muted: get().muted });
  },
  setMuted: (muted) => {
    set({ muted });
    savePrefs({ volume: get().volume, muted });
  },
  here: { inCinema: false, atBooth: false },
  setHere: (here) => {
    const h = get().here;
    if (h.inCinema !== here.inCinema || h.atBooth !== here.atBooth) set({ here });
  },
}));

/** Punto de la función ahora (ms), o null si no hay. */
export function cinemaElapsed(): number | null {
  return showElapsed(useCinemaStore.getState(), serverNow());
}
