// Estado de la pesca del jugador local (para la escena y el HUD). Lo mueve lo que avisa el servidor
// (`MSG.fishEvent`): el servidor decide; aquí solo se refleja.
import {
  NIBBLES,
  fishById,
  type FishCatchResult,
  type FishingChallenge,
  type FishingEvent,
  type FishingMastery,
  type FishOutcome,
  type FishRefusal,
} from "@hyvento/shared";
import { create } from "zustand";
import { useOfficeStore } from "../store";
import { playFishSound } from "./sound";

/**
 * - `casting`: se mandó el lance, esperando al servidor.
 * - `waiting`: la boya flota; E o moverse recoge el sedal.
 * - `bite`: ¡pica! Hay que responder ya (E, espacio o clic).
 * - `reeling`: el minijuego.
 * - `finishing`: se mandó el resultado.
 */
export type FishingLocalPhase = "idle" | "casting" | "waiting" | "bite" | "hooking" | "reeling" | "finishing";

interface FishingStore {
  phase: FishingLocalPhase;
  castId: string | null;
  challenge: FishingChallenge | null;
  /** Hasta cuándo dura la picada (reloj local). */
  biteUntil: number;
  /** Hasta cuándo tiembla la boya por un mordisqueo (responder ahí asusta al pez). */
  nibbleUntil: number;
  /** La maestría de la caña del lance en curso (para la ayuda de abajo). */
  mastery: FishingMastery | null;
  /** Última captura, para la tarjeta (cambia `id` en cada una). */
  card: (FishCatchResult & { id: number }) | null;
  /** Sube con cada captura: el álbum se vuelve a pedir. */
  albumVersion: number;
  setPhase: (phase: FishingLocalPhase) => void;
  dismissCard: () => void;
}

let cardId = 0;

export const useFishingStore = create<FishingStore>((set) => ({
  phase: "idle",
  castId: null,
  challenge: null,
  biteUntil: 0,
  nibbleUntil: 0,
  mastery: null,
  card: null,
  albumVersion: 0,
  setPhase: (phase) => set(phase === "idle" ? { phase, castId: null, challenge: null } : { phase }),
  dismissCard: () => set({ card: null }),
}));

const OUTCOME_TEXT: Partial<Record<FishOutcome, string>> = {
  escaped: "Se te escapó… ¡casi!",
  missed: "Picó y se fue. Hay que responder más rápido.",
  early: "Recogiste antes de tiempo: el pez se asustó.",
  stolen: "Era un mordisqueo: el pez se llevó la carnada.",
  timeout: "El pez se cansó de esperar y se soltó.",
  invalid: "No se pudo contar esa pesca. Intenta de nuevo.",
};

const REFUSED_TEXT: Record<FishRefusal, string> = {
  far: "Acércate a la orilla o a la punta del muelle para pescar.",
  busy: "Ya tienes la caña en el agua.",
  seated: "Levántate para pescar.",
};

/** Lo que avisa el servidor sobre mi lance. */
export function handleFishEvent(e: FishingEvent) {
  const s = useFishingStore.getState();
  const office = useOfficeStore.getState();
  switch (e.type) {
    case "cast":
      useFishingStore.setState({ phase: "waiting", castId: e.castId, challenge: null, nibbleUntil: 0, mastery: e.mastery ?? null });
      playFishSound("cast");
      return;
    case "nibble":
      if (s.castId !== e.castId || s.phase !== "waiting") return;
      useFishingStore.setState({ nibbleUntil: performance.now() + NIBBLES.showMs });
      playFishSound("nibble");
      return;
    case "bite":
      if (s.castId !== e.castId) return;
      useFishingStore.setState({ phase: "bite", biteUntil: performance.now() + e.windowMs });
      playFishSound("bite");
      return;
    case "start":
      if (s.castId !== e.castId) return;
      useFishingStore.setState({ phase: "reeling", challenge: e.challenge });
      if (e.group) office.notify("Pescando en compañía: pican más raros.", "info");
      return;
    case "refused":
      if (s.phase === "casting") useFishingStore.setState({ phase: "idle", castId: null, challenge: null });
      office.notify(REFUSED_TEXT[e.error], "info");
      return;
    case "end": {
      // Un aviso de un lance viejo (o de un resultado repetido) no toca el lance actual.
      if (s.castId && s.castId !== e.castId) return;
      useFishingStore.setState({ phase: "idle", castId: null, challenge: null });
      if (e.outcome === "caught" && e.catch) {
        const f = fishById(e.catch.species);
        useFishingStore.setState((st) => ({ card: { ...e.catch!, id: ++cardId }, albumVersion: st.albumVersion + 1 }));
        playFishSound(f?.rarity === "basura" ? "trash" : e.catch.record && !e.catch.first ? "record" : "catch");
        if (e.catch.treasure) setTimeout(() => playFishSound("treasure"), 450);
        return;
      }
      // Lo de la historia (la llavecita del capítulo 3) lo cuenta su cinemática.
      if (e.outcome === "story") return;
      if (e.outcome === "escaped") playFishSound("escape");
      const text = OUTCOME_TEXT[e.outcome];
      if (text) office.notify(text, e.outcome === "invalid" ? "warning" : "info");
      return;
    }
  }
}
