// La carrera de sillas en el cliente: si estoy corriendo (desde cuándo, para el cronómetro), la tabla de
// la semana y cómo me fue la última vez. La hora que cuenta es la del servidor; esto es solo para mostrar.
import { CHAIR_RACE, MSG, RACE_PROBLEM_TEXT, raceTimeText, type RaceBoard, type RaceEvent, type RaceResult } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "./store";

interface RaceStore {
  /** Corriendo desde (hora local), o null. */
  since: number | null;
  board: RaceBoard | null;
  last: Extract<RaceResult, { ok: true }> | null;
  setSince: (t: number | null) => void;
  setBoard: (b: RaceBoard) => void;
  setLast: (r: Extract<RaceResult, { ok: true }> | null) => void;
}

export const useRaceStore = create<RaceStore>((set) => ({
  since: null,
  board: null,
  last: null,
  setSince: (since) => {
    boost = 0;
    set({ since });
  },
  setBoard: (board) => set({ board }),
  setLast: (last) => set({ last }),
}));

let room: Room | null = null;

// El impulso del minijuego (0 a 1): fuera del store porque cambia en cada frame.
let boost = 0;
/** Impulso de ahora (0 a 1). */
export const raceBoost = () => boost;
/** Un clic o Espacio: más impulso. */
export function pumpRace() {
  boost = Math.min(1, boost + CHAIR_RACE.pump);
}
/** Cada frame el impulso se va perdiendo. */
export function decayRace(dt: number) {
  boost = Math.max(0, boost - CHAIR_RACE.decayPerSec * dt);
}
/** Velocidad de avance (relativa a la de caminar) con el impulso de ahora. */
export const raceForwardMul = () => CHAIR_RACE.baseMul + (CHAIR_RACE.speedMul - CHAIR_RACE.baseMul) * boost;

export function bindRace(r: Room) {
  room = r;
  r.onMessage(MSG.raceBoardResult, (b: RaceBoard) => useRaceStore.getState().setBoard(b));
  r.onMessage(MSG.raceResult, (res: RaceResult) => {
    const s = useRaceStore.getState();
    s.setSince(null);
    if (!res.ok) {
      useOfficeStore.getState().notify(RACE_PROBLEM_TEXT[res.problem], res.problem === "busy" ? "info" : "warning");
      return;
    }
    s.setLast(res);
    s.setBoard(res.board);
    useOfficeStore.getState().openPanel("race", false);
  });
  r.onMessage(MSG.raceEvent, (e: RaceEvent) => {
    if (e.sessionId === useOfficeStore.getState().sessionId) return;
    useOfficeStore.getState().notify(`${e.name} llegó a la meta en ${raceTimeText(e.ms)}${e.record ? ": ¡récord de la semana!" : "."}`, "info");
  });
}

export function sendRaceStart() {
  room?.send(MSG.raceStart, {});
}

export function sendRaceCancel() {
  room?.send(MSG.raceCancel);
}

export function requestRaceBoard() {
  room?.send(MSG.raceBoard);
}
