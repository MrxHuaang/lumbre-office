// La radio de la oficina donde estoy: un reproductor de YouTube que no se ve (solo suena) y va al
// segundo del servidor, en bucle. El volumen y el silencio son de cada uno (se guardan en el navegador).
import { radioElapsed, type OfficeRadioMessage, type OfficeRadioState } from "@hyvento/shared";
import { create } from "zustand";
import { serverNow } from "./club/store";
import { sendOfficeRadio } from "./network";
import { YoutubeScreen } from "./youtube";

interface RadioStore {
  volume: number;
  muted: boolean;
  /** El navegador no dejó sonar la radio sola: hace falta un toque. */
  needsTap: boolean;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setNeedsTap: (b: boolean) => void;
}

const KEY = "hyvento:radio";

function load(): { volume: number; muted: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { volume?: unknown; muted?: unknown };
    return { volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : 0.5, muted: p.muted === true };
  } catch {
    return { volume: 0.5, muted: false };
  }
}

function save(p: { volume: number; muted: boolean }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // sin almacenamiento: vale solo para esta visita
  }
}

export const useRadioStore = create<RadioStore>((set, get) => ({
  ...(typeof window === "undefined" ? { volume: 0.5, muted: false } : load()),
  needsTap: false,
  setVolume: (volume) => {
    set({ volume });
    save({ volume, muted: get().muted });
  },
  setMuted: (muted) => {
    set({ muted });
    save({ volume: get().volume, muted });
  },
  setNeedsTap: (needsTap) => get().needsTap !== needsTap && set({ needsTap }),
}));

let screen: YoutubeScreen | null = null;
/** A quién se le informa la duración del video: la radio de la oficina o la música de la casa. */
let durationSink: (msg: OfficeRadioMessage) => void = sendOfficeRadio;

/**
 * Cada frame: la radio de la oficina donde estoy, o la música de la casa (con `send`, su propio mensaje),
 * o null para apagarla.
 */
export function updateRadio(parent: HTMLElement, radio: OfficeRadioState | null, send: (msg: OfficeRadioMessage) => void = sendOfficeRadio) {
  durationSink = send;
  if (!radio) {
    disposeRadio();
    return;
  }
  screen ??= new YoutubeScreen(parent, {
    id: "radio",
    loop: true,
    onDuration: (videoId, ms) => durationSink({ action: "duration", videoId, ms }),
    onNeedsTap: (needs) => useRadioStore.getState().setNeedsTap(needs),
  });
  const { volume, muted } = useRadioStore.getState();
  screen.update({
    // El id de la entrada es el del video: la radio no tiene cola.
    entry: { id: radio.videoId, videoId: radio.videoId },
    elapsedMs: radioElapsed(radio, serverNow()),
    paused: radio.paused,
    volume: muted ? 0 : volume,
    quad: null,
    big: false,
  });
}

export function disposeRadio() {
  screen?.destroy();
  screen = null;
}
