// Estado del club en el cliente: copia de lo que sincroniza el servidor (qué suena, desde cuándo y quién
// baila) y lo que es solo de esta persona (volumen y silencio de la música, guardados en el navegador).
import { beatAt, DANCE_MOVE_IDS, isPlaying, TIP_AMOUNTS, trackElapsed, type ClubMusicState, type ClubVideoView, type DanceMoveId, type TipAmount } from "@hyvento/shared";
import { create } from "zustand";
import { useCasinoStore } from "../casino";
import { measuredOffset } from "./clock";

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
  /** A quién le puedo tirar billetes ahora (sessionId de quien baila en el tubo, cerca de mí), o null. */
  tipTarget: string | null;
}

/** Las marcas de las propinas de hoy (espejo de `ClubTipStats`). */
export interface ClubTipStatsView {
  best: number;
  bestFrom: string;
  bestTo: string;
  topName: string;
  topTotal: number;
}

interface ClubStore extends ClubMusicState {
  dj: string;
  /** El video de YouTube que suena (o null), lo que viene y lo que ya sonó. */
  now: ClubVideoView | null;
  queue: ClubVideoView[];
  history: ClubVideoView[];
  /** El navegador no dejó sonar el video solo: hace falta un toque (botón "Activar sonido"). */
  needsTap: boolean;
  /** Ver el video en grande (clic en la pantalla del club). */
  videoBig: boolean;
  setVideos: (v: { now: ClubVideoView | null; queue: ClubVideoView[]; history: ClubVideoView[] }) => void;
  setNeedsTap: (b: boolean) => void;
  setVideoBig: (b: boolean) => void;
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
  /** El billete elegido para las propinas (el último que tiré) y si el selector está abierto. */
  tipAmount: TipAmount;
  tipOpen: boolean;
  tipStats: ClubTipStatsView;
  setTipAmount: (a: TipAmount) => void;
  setTipOpen: (open: boolean) => void;
  setTipStats: (s: ClubTipStatsView) => void;
}

const PREFS_KEY = "hyvento:club";

type Prefs = { volume: number; muted: boolean; move: DanceMoveId; tipAmount: TipAmount };

function loadPrefs(): Prefs {
  const fallback: Prefs = { volume: 0.7, muted: false, move: "vaiven", tipAmount: 5 };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : fallback.volume,
      muted: typeof p.muted === "boolean" ? p.muted : fallback.muted,
      // Un paso guardado que ya no existe haría que "Bailar" mande algo que el servidor rechaza.
      move: DANCE_MOVE_IDS.includes(p.move as DanceMoveId) ? (p.move as DanceMoveId) : fallback.move,
      tipAmount: TIP_AMOUNTS.includes(p.tipAmount as TipAmount) ? (p.tipAmount as TipAmount) : fallback.tipAmount,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: Prefs) {
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
  video: "",
  now: null,
  queue: [],
  history: [],
  needsTap: false,
  videoBig: false,
  setVideos: (v) => set(v),
  setNeedsTap: (needsTap) => get().needsTap !== needsTap && set({ needsTap }),
  setVideoBig: (videoBig) => set({ videoBig }),
  dancers: {},
  ...loadPrefs(),
  here: { inClub: false, onFloor: false, dancing: null, tipTarget: null },
  setHere: (here) => {
    const h = get().here;
    if (h.inClub !== here.inClub || h.onFloor !== here.onFloor || h.dancing !== here.dancing || h.tipTarget !== here.tipTarget)
      // Sin a quién tirarle, el selector de billetes se cierra solo.
      set(here.tipTarget ? { here } : { here, tipOpen: false });
  },
  setMusic: (m) => set(m),
  setDancers: (dancers) => set({ dancers }),
  setVolume: (volume) => {
    set({ volume });
    savePrefs({ ...prefsOf(get()), volume });
  },
  setMuted: (muted) => {
    set({ muted });
    savePrefs({ ...prefsOf(get()), muted });
  },
  setMove: (move) => {
    set({ move });
    savePrefs({ ...prefsOf(get()), move });
  },
  tipOpen: false,
  tipStats: { best: 0, bestFrom: "", bestTo: "", topName: "", topTotal: 0 },
  setTipAmount: (tipAmount) => {
    set({ tipAmount });
    savePrefs({ ...prefsOf(get()), tipAmount });
  },
  setTipOpen: (tipOpen) => get().tipOpen !== tipOpen && set({ tipOpen }),
  setTipStats: (tipStats) => set({ tipStats }),
}));

function prefsOf(s: Prefs): Prefs {
  return { volume: s.volume, muted: s.muted, move: s.move, tipAmount: s.tipAmount };
}

/** Hora del servidor ahora (ms): con la medida del ping/pong si ya hay, o con la que llegó al entrar. */
export const serverNow = () => Date.now() + (measuredOffset() ?? useCasinoStore.getState().offset);

/** El tiempo (en negras) de la música ahora, o null si no suena. */
export function clubBeat(): number | null {
  const s = useClubStore.getState();
  return isPlaying(s) ? beatAt(s, serverNow()) : null;
}

/** Tiempo transcurrido de la pista ahora (ms), o null. */
export function clubElapsed(): number | null {
  return trackElapsed(useClubStore.getState(), serverNow());
}
