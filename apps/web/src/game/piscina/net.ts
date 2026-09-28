// Red de la piscina: pedirle al servidor meterse, tirarse del trampolín o salir del agua, y lo que
// responde (el chapuzón que ven todos y los avisos de por qué no). network.ts llama a `bindPiscina` con
// cada sala nueva.
import { AGUA_MSG, AGUA_NOTICES, type AguaAction, type AguaNotice, type DiveEvent } from "@hyvento/shared";
import type { Room } from "colyseus.js";
import { useOfficeStore } from "../store";

let room: Room | null = null;
const diveListeners = new Set<(e: DiveEvent) => void>();

export function bindPiscina(r: Room) {
  room = r;
  r.onMessage(AGUA_MSG.dive, (e: DiveEvent) => diveListeners.forEach((cb) => cb(e)));
  r.onMessage(AGUA_MSG.notice, (n: AguaNotice) => {
    const text = AGUA_NOTICES[n.code];
    if (text) useOfficeStore.getState().notify(text, n.code === "rain" ? "warning" : "info");
  });
}

/** Meterse (junto a la escalera), tirarse (junto al trampolín) o salir del agua (junto al borde). */
export function sendAgua(action: AguaAction) {
  room?.send(AGUA_MSG.action, { action });
}

/** Alguien de mi nivel se tiró del trampolín (también yo). */
export function onDive(cb: (e: DiveEvent) => void) {
  diveListeners.add(cb);
  return () => diveListeners.delete(cb);
}
