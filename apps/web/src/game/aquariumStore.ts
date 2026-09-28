// El álbum de pesca del equipo en el cliente (GET /api/aquarium): lo usan el acuario de la escena (qué
// peces nadan) y su panel (quién los sacó). Se pide al entrar a un nivel con acuario, al abrir el panel y
// cuando saco un pez (el álbum de la pesca sube su versión).
import { pickAquariumFish, type TeamFishEntry } from "@hyvento/shared";
import { create } from "zustand";
import { useFishingStore } from "./fishing/store";

interface AquariumStore {
  entries: TeamFishEntry[];
  loaded: boolean;
  error: string | null;
  /** Las especies que nadan en el acuario (las más raras y recientes). */
  swimming: string[];
  refresh: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useAquariumStore = create<AquariumStore>((set) => ({
  entries: [],
  loaded: false,
  error: null,
  swimming: [],
  refresh: () => {
    inFlight ??= (async () => {
      try {
        const res = await fetch("/api/aquarium", { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as { entries?: TeamFishEntry[]; error?: string } | null;
        if (!res.ok || !body?.entries) throw new Error(body?.error ?? "No se pudo ver el acuario.");
        set({ entries: body.entries, loaded: true, error: null, swimming: pickAquariumFish(body.entries) });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : "No se pudo ver el acuario." });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
}));

// Saqué un pez: puede ser una especie nueva para el acuario (solo si ya se había pedido la lista).
useFishingStore.subscribe((s, prev) => {
  if (s.albumVersion !== prev.albumVersion && useAquariumStore.getState().loaded) void useAquariumStore.getState().refresh();
});
