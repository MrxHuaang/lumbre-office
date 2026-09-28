// Red del escenario y del estudio de grabación: copia `state.stage` y `state.podcast` al store y manda
// lo que se hace (subir o bajar de la tarima, la mano, la palabra, aplaudir, grabar y dar permiso). Se
// engancha solo a cada sala nueva (conexión y reconexiones) con `onRoom`.
import {
  ESCENARIO_MSG,
  ESCENARIO_NOTICES,
  PODCAST,
  PODCAST_MSG,
  podcastBlock,
  podcastNoticeText,
  type PodcastBlock,
  type ApplauseEvent,
  type EscenarioNotice,
  type HandView,
  type PodcastNotice,
  type PodcastPhase,
} from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { getRoom, onRoom } from "../network";
import { useOfficeStore } from "../store";
import { useEscenarioStore } from "./store";

interface RemoteHand {
  sessionId: string;
  userId: string;
  name: string;
  at: number;
}
interface RemoteStage {
  hands: { forEach(cb: (h: RemoteHand) => void): void };
  floor: string;
  floorName: string;
}
interface RemotePodcast {
  phase: string;
  host: string;
  hostName: string;
  askedAt: number;
  startedAt: number;
  consents: { forEach(cb: (v: boolean, k: string) => void): void };
}

const applauseListeners = new Set<(e: ApplauseEvent) => void>();

/** Alguien del nivel aplaudió (la escena hace sonar los aplausos y, si son muchos, la ovación). */
export function onApplause(cb: (e: ApplauseEvent) => void) {
  applauseListeners.add(cb);
  return () => applauseListeners.delete(cb);
}

function bind(r: Room) {
  const $ = getStateCallbacks(r as Room<{ stage: RemoteStage; podcast: RemotePodcast }>);
  const state = r.state as { stage?: RemoteStage; podcast?: RemotePodcast };
  const syncStage = () => {
    const s = state.stage;
    if (!s) return;
    const hands: HandView[] = [];
    s.hands.forEach((h) => hands.push({ sessionId: h.sessionId, userId: h.userId, name: h.name, at: h.at }));
    useEscenarioStore.getState().setStage({ hands, floor: s.floor, floorName: s.floorName });
  };
  const syncPodcast = () => {
    const p = state.podcast;
    if (!p) return;
    const consents: Record<string, boolean> = {};
    p.consents.forEach((v, k) => (consents[k] = v));
    useEscenarioStore.getState().setPodcast({ phase: p.phase as PodcastPhase, host: p.host, hostName: p.hostName, askedAt: p.askedAt, startedAt: p.startedAt, consents });
  };
  type ListCallbacks = { onAdd(cb: (v: unknown) => void): void; onRemove(cb: () => void): void; onChange?(cb: () => void): void };
  $(r.state as { stage: RemoteStage }).listen("stage", (stage) => {
    if (!stage) return;
    const s$ = $(stage);
    s$.onChange(syncStage);
    const hands = s$.hands as unknown as ListCallbacks;
    hands.onAdd(syncStage);
    hands.onRemove(syncStage);
    syncStage();
  });
  $(r.state as { podcast: RemotePodcast }).listen("podcast", (podcast) => {
    if (!podcast) return;
    const p$ = $(podcast);
    p$.onChange(syncPodcast);
    const consents = p$.consents as unknown as ListCallbacks;
    consents.onAdd(syncPodcast);
    consents.onRemove(syncPodcast);
    // Cambiar un permiso de false a true es un cambio en la misma clave del mapa.
    (consents as unknown as { onChange(cb: () => void): void }).onChange(syncPodcast);
    syncPodcast();
  });
  r.onMessage(ESCENARIO_MSG.notice, (n: EscenarioNotice) => useOfficeStore.getState().notify(ESCENARIO_NOTICES[n.code], "info"));
  r.onMessage(ESCENARIO_MSG.applause, (e: ApplauseEvent) => applauseListeners.forEach((cb) => cb(e)));
  r.onMessage(PODCAST_MSG.notice, (n: PodcastNotice) =>
    useOfficeStore.getState().notify(podcastNoticeText(n), n.code === "started" ? "success" : n.code === "declined" || n.code === "joined" || n.code === "hostLeft" || n.code === "full" || n.code === "onAir" ? "warning" : "info"),
  );
}

if (typeof window !== "undefined") onRoom(bind);

/** ¿Me dejarían entrar al estudio? (lo mismo que valida el servidor, con lo que se ve del estado). */
export function podcastBlockFor(myUserId: string | null): PodcastBlock | null {
  const room = getRoom();
  if (!room) return null;
  let inside = 0;
  (room.state as { players: { forEach(cb: (p: { area: string; userId: string }) => void): void } }).players.forEach((p) => {
    if (p.area === PODCAST.area && p.userId !== myUserId) inside++;
  });
  return podcastBlock(inside, useEscenarioStore.getState().podcast.phase);
}

/** Subir a la tarima desde la escalerita (o bajar). */
export const sendStage = (on: boolean) => getRoom()?.send(ESCENARIO_MSG.stage, { on });
/** Levantar o bajar la mano en las gradas. */
export const sendHand = (up: boolean) => getRoom()?.send(ESCENARIO_MSG.hand, { up });
/** Desde la tarima: dar la palabra (userId) o quitarla (null). */
export const sendFloor = (userId: string | null) => getRoom()?.send(ESCENARIO_MSG.floor, { userId });
export const sendClap = () => getRoom()?.send(ESCENARIO_MSG.clap);

export const sendPodcastStart = () => getRoom()?.send(PODCAST_MSG.start);
export const sendPodcastConsent = (accept: boolean) => getRoom()?.send(PODCAST_MSG.consent, { accept });
export const sendPodcastStop = () => getRoom()?.send(PODCAST_MSG.stop);
