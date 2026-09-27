// Estado del club en el cliente: copia de lo que sincroniza el servidor (qué suena, desde cuándo y quién
// baila) y lo que es solo de esta persona (volumen y silencio de la música, guardados en el navegador).
import { beatAt, DANCE_MOVE_IDS, isPlaying, trackElapsed, type ClubMusicState, type DanceMoveId } from "@hyvento/shared";
import { create } from "zustand";
import { useCasinoStore } from "../casino";

export interface ClubDancerView {
  kind: "floor" | "pole";
  /** Paso de la pista, o la llave del tubo. */
  move: string;
  since: number;
}

export interface ClubHere {
  inClub: boolean;
  onFloor: boolean;
  dancing: "floor" | "pole" | null;
}

interface ClubStore extends ClubMusicState {
  dj: string;
  dancers: Record<string, ClubDancerView>;
  /** Volumen de la música para mí (0 a 1) y si la silencié. */
  volume: number;
  muted: boolean;
  /** Paso elegido para la pista (el último que usé). */
  move: DanceMoveId;
  /** Dónde estoy (lo calcula la escena): en el club, parado sobre la pista, y si estoy bailando. */
  here: ClubHere;
  setHere: (h: ClubHere) => void;
  setMusic: (m: ClubMusicState & { dj: string }) => void;
  setDancers: (d: Record<string, ClubDancerView>) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setMove: (m: DanceMoveId) => void;
}

const PREFS_KEY = "hyvento:club";

function loadPrefs(): { volume: number; muted: boolean; move: DanceMoveId } {
  const fallback = { volume: 0.7, muted: false, move: "vaiven" as DanceMoveId };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : fallback.volume,
      muted: typeof p.muted === "boolean" ? p.muted : fallback.muted,
      // Un paso guardado que ya no existe haría que "Bailar" mande algo que el servidor rechaza.
      move: DANCE_MOVE_IDS.includes(p.move as DanceMoveId) ? (p.move as DanceMoveId) : fallback.move,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: { volume: number; muted: boolean; move: DanceMoveId }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // sin almacenamiento: vale solo para esta visita
  }
}

export const useClubStore = create<ClubStore>((set, get) => ({
  track: "",
  startedAt: 0,
  paused: false,
  pausedAt: 0,
  dj: "",
  dancers: {},
  ...loadPrefs(),
  here: { inClub: false, onFloor: false, dancing: null },
  setHere: (here) => {
    const h = get().here;
    if (h.inClub !== here.inClub || h.onFloor !== here.onFloor || h.dancing !== here.dancing) set({ here });
  },
  setMusic: (m) => set(m),
  setDancers: (dancers) => set({ dancers }),
  setVolume: (volume) => {
    set({ volume });
    savePrefs({ volume, muted: get().muted, move: get().move });
  },
  setMuted: (muted) => {
    set({ muted });
    savePrefs({ volume: get().volume, muted, move: get().move });
  },
  setMove: (move) => {
    set({ move });
    savePrefs({ volume: get().volume, muted: get().muted, move });
  },
}));

/** Hora del servidor ahora (ms), con la diferencia que se midió al entrar. */
export const serverNow = () => Date.now() + useCasinoStore.getState().offset;

/** El tiempo (en negras) de la música ahora, o null si no suena. */
export function clubBeat(): number | null {
  const s = useClubStore.getState();
  return isPlaying(s) ? beatAt(s, serverNow()) : null;
}

/** Tiempo transcurrido de la pista ahora (ms), o null. */
export function clubElapsed(): number | null {
  return trackElapsed(useClubStore.getState(), serverNow());
}
