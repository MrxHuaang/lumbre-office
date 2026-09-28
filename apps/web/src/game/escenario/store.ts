// Estado del escenario y del estudio de grabación en el cliente: copia de lo que sincroniza el servidor
// (la fila de turnos, la palabra, la grabación y los permisos) y dónde estoy yo (lo calcula la escena).
import type { HandView, PodcastPhase } from "@hyvento/shared";
import { create } from "zustand";

export interface EscenarioHere {
  /** En la tarima (hablo para todo el anfiteatro). */
  onStage: boolean;
  /** En las gradas (el público). */
  inSeats: boolean;
  /** Adentro del estudio de grabación (el nivel `podcast`). */
  inBooth: boolean;
}

export interface PodcastView {
  phase: PodcastPhase;
  host: string;
  hostName: string;
  askedAt: number;
  startedAt: number;
  /** userId → aceptó. */
  consents: Record<string, boolean>;
}

interface EscenarioStore {
  hands: HandView[];
  floor: string;
  floorName: string;
  podcast: PodcastView;
  here: EscenarioHere;
  /** Nombres de quienes están adentro de la cabina (para el diálogo de permiso). */
  boothNames: string[];
  /** Grabando en este navegador (soy quien pidió grabar y el grabador está andando). */
  recording: boolean;
  setStage: (s: { hands: HandView[]; floor: string; floorName: string }) => void;
  setPodcast: (p: PodcastView) => void;
  setHere: (h: EscenarioHere, boothNames: string[]) => void;
  setRecording: (r: boolean) => void;
}

const IDLE: PodcastView = { phase: "idle", host: "", hostName: "", askedAt: 0, startedAt: 0, consents: {} };

export const useEscenarioStore = create<EscenarioStore>((set, get) => ({
  hands: [],
  floor: "",
  floorName: "",
  podcast: IDLE,
  here: { onStage: false, inSeats: false, inBooth: false },
  boothNames: [],
  recording: false,
  setStage: (s) => set(s),
  setPodcast: (podcast) => set({ podcast }),
  setHere: (here, boothNames) => {
    const h = get().here;
    const same = h.onStage === here.onStage && h.inSeats === here.inSeats && h.inBooth === here.inBooth && get().boothNames.join("|") === boothNames.join("|");
    if (!same) set({ here, boothNames });
  },
  setRecording: (recording) => set({ recording }),
}));
