// Notas en la puerta (lado del navegador): frente a qué puerta ajena estoy, a quién le escribo y qué
// respondió el servidor. Las notas se leen y se borran por la web (/api/door-notes); aquí no hay Phaser
// (lo importa network.ts), los post-its de la escena están en doorPostIts.ts.
import { DOOR_NOTE_ERROR_TEXT, type DoorNoteResult } from "@hyvento/shared";
import { create } from "zustand";
import { useOfficeStore } from "./store";

interface DoorNotesStore {
  /** Puerta de una oficina ajena (con dueño) frente a la que estoy: se le puede dejar una nota. */
  door: string | null;
  /** Oficina a la que le estoy escribiendo (con el panel abierto). */
  target: string | null;
  sending: boolean;
  /** Por qué no se pegó la última nota (se muestra en el panel). */
  error: string | null;
  setDoor: (zoneId: string | null) => void;
  /** Abre el panel para escribirle una nota a la dueña o dueño de esa oficina. */
  write: (zoneId: string) => void;
  setSending: (sending: boolean) => void;
  handleResult: (res: DoorNoteResult) => void;
}

export const useDoorNotesStore = create<DoorNotesStore>((set, get) => ({
  door: null,
  target: null,
  sending: false,
  error: null,
  setDoor: (door) => {
    if (door !== get().door) set({ door });
  },
  write: (zoneId) => {
    set({ target: zoneId, error: null, sending: false });
    useOfficeStore.getState().openPanel("doorNote", true);
  },
  setSending: (sending) => set({ sending, error: sending ? null : get().error }),
  handleResult: (res) => {
    if (res.zoneId !== get().target) return;
    if (!res.ok) return set({ sending: false, error: DOOR_NOTE_ERROR_TEXT[res.error] });
    set({ sending: false, error: null, target: null });
    const office = useOfficeStore.getState();
    if (office.panel?.kind === "doorNote") office.closePanel();
    office.notify(
      `Le dejaste una nota a ${res.ownerName}. ${res.left === 0 ? "Por hoy no puedes dejar más." : `Te ${res.left === 1 ? "queda 1" : `quedan ${res.left}`} por hoy.`}`,
      "success",
    );
  },
}));
