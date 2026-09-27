// Lo que el cliente le pide al servidor sobre la pesca. Las respuestas llegan por `MSG.fishEvent` y las
// maneja `handleFishEvent` (store.ts).
import { MSG } from "@hyvento/shared";
import { getRoom } from "../network";
import { useFishingStore } from "./store";

/** E junto al lago: lanzar si no hay lance; con la boya en el agua, recoger; con la picada, responder. */
export function fishingSpotAction() {
  const { phase } = useFishingStore.getState();
  if (phase === "idle") return castLine();
  if (phase === "waiting") return cancelFishing();
  if (phase === "bite") return hookFish();
}

export function castLine() {
  const room = getRoom();
  if (!room || useFishingStore.getState().phase !== "idle") return;
  useFishingStore.getState().setPhase("casting");
  room.send(MSG.fishCast);
}

export function hookFish() {
  const { castId, phase } = useFishingStore.getState();
  if (!castId || phase !== "bite") return;
  useFishingStore.getState().setPhase("hooking");
  getRoom()?.send(MSG.fishHook, { castId });
}

export function sendFishResult(frames: number, inputs: number[]) {
  const { castId } = useFishingStore.getState();
  if (!castId) return;
  useFishingStore.getState().setPhase("finishing");
  getRoom()?.send(MSG.fishFinish, { castId, frames, inputs });
}

/** Recoger el sedal (Esc, caminar): el servidor cierra el lance. */
export function cancelFishing() {
  const { phase } = useFishingStore.getState();
  if (phase === "idle") return;
  getRoom()?.send(MSG.fishCancel);
  // Si el servidor ya no tenía lance, igual se vuelve a quedar libre.
  if (phase === "casting" || phase === "waiting" || phase === "bite") useFishingStore.getState().setPhase("idle");
}
