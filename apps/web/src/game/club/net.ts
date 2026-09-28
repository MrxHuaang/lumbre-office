// Red del club: copia `OfficeState.club` al store y manda lo que se hace en la cabina, la pista y el tubo.
// network.ts llama a `bindClub` con cada sala nueva (conexión y reconexiones).
import {
  CLUB_ERROR_TEXT,
  CLUB_TIP,
  CLUB_TIP_ERROR_TEXT,
  MSG,
  type ClubDjMessage,
  type ClubQueueMessage,
  type ClubReaction,
  type ClubReactionEvent,
  type ClubResult,
  type ClubTipEvent,
  type ClubTipResult,
  type ClubVideoView,
  type DanceMoveId,
  type TipAmount,
} from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { useOfficeStore } from "../store";
import { startClockSync } from "./clock";
import { useClubStore, type ClubDancerView, type ClubTipStatsView } from "./store";

interface RemoteDancer {
  kind: string;
  move: string;
  since: number;
}
interface RemoteVideo {
  id: string;
  videoId: string;
  title: string;
  by: string;
  durationMs: number;
}
interface RemoteList {
  onAdd(cb: (v: RemoteVideo) => void): void;
  onRemove(cb: () => void): void;
  forEach(cb: (v: RemoteVideo) => void): void;
}
interface RemoteClub {
  track: string;
  video: RemoteVideo;
  queue: RemoteList;
  history: RemoteList;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
  dj: string;
  dancers: Map<string, RemoteDancer>;
  tips?: ClubTipStatsView;
}

let room: Room | null = null;

const view = (v: RemoteVideo): ClubVideoView => ({ id: v.id, videoId: v.videoId, title: v.title, by: v.by, durationMs: v.durationMs });
const list = (l: RemoteList) => {
  const out: ClubVideoView[] = [];
  l.forEach((v) => out.push(view(v)));
  return out;
};

const reactionListeners = new Set<(e: ClubReactionEvent) => void>();
/** Reacciones de los del club (la escena las hace flotar sobre la pantalla). */
export function onClubReaction(cb: (e: ClubReactionEvent) => void) {
  reactionListeners.add(cb);
  return () => reactionListeners.delete(cb);
}

const tipListeners = new Set<(e: ClubTipEvent) => void>();
/** Propinas en el tubo (la escena hace volar los billetes). */
export function onClubTip(cb: (e: ClubTipEvent) => void) {
  tipListeners.add(cb);
  return () => tipListeners.delete(cb);
}

export function bindClub(r: Room) {
  room = r;
  startClockSync(r);
  const $ = getStateCallbacks(r as Room<{ club: RemoteClub }>);
  const state = r.state as { club?: RemoteClub };
  const syncMusic = () => {
    const c = state.club;
    if (c) useClubStore.getState().setMusic({ track: c.track, video: c.video?.videoId ?? "", startedAt: c.startedAt, paused: c.paused, pausedAt: c.pausedAt, dj: c.dj });
  };
  const syncVideos = () => {
    const c = state.club;
    if (!c?.video) return;
    useClubStore.getState().setVideos({ now: c.video.videoId ? view(c.video) : null, queue: list(c.queue), history: list(c.history) });
    syncMusic();
  };
  const syncDancers = () => {
    const c = state.club;
    if (!c) return;
    const dancers: Record<string, ClubDancerView> = {};
    c.dancers.forEach((d, id) => {
      dancers[id] = { kind: d.kind === "pole" ? "pole" : "floor", move: d.move, since: d.since };
    });
    useClubStore.getState().setDancers(dancers);
  };
  const syncTips = () => {
    const t = state.club?.tips;
    if (t) useClubStore.getState().setTipStats({ best: t.best, bestFrom: t.bestFrom, bestTo: t.bestTo, topName: t.topName, topTotal: t.topTotal });
  };
  // El club llega con el primer estado: los callbacks se enganchan cuando aparece.
  $(r.state as { club: RemoteClub }).listen("club", (club) => {
    if (!club) return;
    const c$ = $(club);
    c$.onChange(syncMusic);
    c$.dancers.onAdd((d) => {
      $(d).onChange(syncDancers);
      syncDancers();
    });
    c$.dancers.onRemove(syncDancers);
    c$.listen("video", (v) => v && $(v).onChange(syncVideos));
    c$.listen("tips", (t) => {
      if (t) $(t).onChange(syncTips);
      syncTips();
    });
    // La cola y lo que sonó: el tipo de los callbacks de listas no se deduce de estas interfaces sueltas.
    type ListCallbacks = { onAdd(cb: (v: RemoteVideo) => void): void; onRemove(cb: () => void): void };
    for (const l of [c$.queue, c$.history] as unknown as ListCallbacks[]) {
      l.onAdd((v) => {
        $(v).onChange(syncVideos);
        syncVideos();
      });
      l.onRemove(syncVideos);
    }
    syncMusic();
    syncVideos();
    syncDancers();
  });
  r.onMessage(MSG.clubReaction, (e: ClubReactionEvent) => reactionListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.clubTipped, (e: ClubTipEvent) => {
    const me = useOfficeStore.getState().sessionId;
    // A quien baila le avisa quién le tiró; los demás solo ven los billetes (y el "+5" sobre quien tira).
    if (e.toSessionId === me) useOfficeStore.getState().notify(`+${e.amount} de ${e.fromName}`, "success");
    tipListeners.forEach((cb) => cb(e));
  });
  r.onMessage(MSG.clubTipResult, (res: ClubTipResult) => useOfficeStore.getState().notify(CLUB_TIP_ERROR_TEXT[res.error], res.error === "busy" ? "info" : "warning"));
  r.onMessage(MSG.clubResult, (res: ClubResult) => useOfficeStore.getState().notify(CLUB_ERROR_TEXT[res.error], res.error === "busy" ? "info" : "warning"));
}

export function sendClubDj(msg: ClubDjMessage) {
  room?.send(MSG.clubDj, msg);
}

/** La cola de videos (agregar, mover, quitar, saltar) y lo que avisa el reproductor. */
export function sendClubQueue(msg: ClubQueueMessage) {
  room?.send(MSG.clubQueue, msg);
}

export function sendClubReact(emoji: ClubReaction) {
  room?.send(MSG.clubReact, { emoji });
}

/** Bailar en la pista con un paso (o dejar de bailar con null). */
export function sendClubDance(move: DanceMoveId | null) {
  room?.send(MSG.clubDance, { move });
}

/** Engancharse al tubo o soltarlo. */
export function sendClubPole(on: boolean) {
  room?.send(MSG.clubPole, { on });
}

/** E junto a la tarima: engancharse al tubo o, si ya estoy en él, soltarlo. */
export function togglePole() {
  const id = useOfficeStore.getState().sessionId;
  const mine = id ? useClubStore.getState().dancers[id] : undefined;
  sendClubPole(mine?.kind !== "pole");
}

/** Cuándo tiré la última propina (el clic repetido no manda más rápido de lo que el servidor acepta). */
let lastTipAt = 0;

/** Tirarle billetes a quien baila en el tubo. Devuelve si se mandó (false si fue demasiado seguido). */
export function sendClubTip(to: string, amount: TipAmount): boolean {
  const now = Date.now();
  if (!room || now - lastTipAt < CLUB_TIP.cooldownMs) return false;
  lastTipAt = now;
  room.send(MSG.clubTip, { to, amount });
  return true;
}
