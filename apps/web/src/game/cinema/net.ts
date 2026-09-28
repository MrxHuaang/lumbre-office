// Red del cine: copia `OfficeState.cinema` al store y manda lo que se hace con la cola de la función.
// network.ts llama a `bindCinema` con cada sala nueva (conexión y reconexiones). La hora del servidor
// ya la mide el club (clock.ts), que se engancha antes.
import { CINEMA_ERROR_TEXT, MSG, type CinemaMessage, type CinemaResult, type ClubVideoView } from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { useOfficeStore } from "../store";
import { useCinemaStore } from "./store";

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
interface RemoteCinema {
  video: RemoteVideo;
  queue: RemoteList;
  history: RemoteList;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
}

let room: Room | null = null;

const view = (v: RemoteVideo): ClubVideoView => ({ id: v.id, videoId: v.videoId, title: v.title, by: v.by, durationMs: v.durationMs });
const list = (l: RemoteList) => {
  const out: ClubVideoView[] = [];
  l.forEach((v) => out.push(view(v)));
  return out;
};

export function bindCinema(r: Room) {
  room = r;
  const $ = getStateCallbacks(r as Room<{ cinema: RemoteCinema }>);
  const state = r.state as { cinema?: RemoteCinema };
  const sync = () => {
    const c = state.cinema;
    if (!c?.video) return;
    useCinemaStore.getState().setShow({
      video: c.video.videoId,
      startedAt: c.startedAt,
      paused: c.paused,
      pausedAt: c.pausedAt,
      now: c.video.videoId ? view(c.video) : null,
      queue: list(c.queue),
      history: list(c.history),
    });
  };
  $(r.state as { cinema: RemoteCinema }).listen("cinema", (cinema) => {
    if (!cinema) return;
    const c$ = $(cinema);
    c$.onChange(sync);
    c$.listen("video", (v) => v && $(v).onChange(sync));
    // La cola y lo que se vio: el tipo de los callbacks de listas no se deduce de estas interfaces sueltas.
    type ListCallbacks = { onAdd(cb: (v: RemoteVideo) => void): void; onRemove(cb: () => void): void };
    for (const l of [c$.queue, c$.history] as unknown as ListCallbacks[]) {
      l.onAdd((v) => {
        $(v).onChange(sync);
        sync();
      });
      l.onRemove(sync);
    }
    sync();
  });
  r.onMessage(MSG.cinemaResult, (res: CinemaResult) =>
    useOfficeStore.getState().notify(CINEMA_ERROR_TEXT[res.error], res.error === "busy" ? "info" : "warning"),
  );
}

/** La cola de la función (programar, mover, quitar, saltar, pausar, seguir) y lo que avisa el reproductor. */
export function sendCinema(msg: CinemaMessage) {
  room?.send(MSG.cinemaQueue, msg);
}
