// Red del club: copia `OfficeState.club` al store y manda lo que se hace en la cabina, la pista y el tubo.
// network.ts llama a `bindClub` con cada sala nueva (conexión y reconexiones).
import { CLUB_ERROR_TEXT, MSG, type ClubDjMessage, type ClubResult, type DanceMoveId } from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { useOfficeStore } from "../store";
import { startClockSync } from "./clock";
import { useClubStore, type ClubDancerView } from "./store";

interface RemoteDancer {
  kind: string;
  move: string;
  since: number;
}
interface RemoteClub {
  track: string;
  startedAt: number;
  paused: boolean;
  pausedAt: number;
  dj: string;
  dancers: Map<string, RemoteDancer>;
}

let room: Room | null = null;

export function bindClub(r: Room) {
  room = r;
  startClockSync(r);
  const $ = getStateCallbacks(r as Room<{ club: RemoteClub }>);
  const state = r.state as { club?: RemoteClub };
  const syncMusic = () => {
    const c = state.club;
    if (c) useClubStore.getState().setMusic({ track: c.track, startedAt: c.startedAt, paused: c.paused, pausedAt: c.pausedAt, dj: c.dj });
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
    syncMusic();
    syncDancers();
  });
  r.onMessage(MSG.clubResult, (res: ClubResult) => useOfficeStore.getState().notify(CLUB_ERROR_TEXT[res.error], res.error === "busy" ? "info" : "warning"));
}

export function sendClubDj(msg: ClubDjMessage) {
  room?.send(MSG.clubDj, msg);
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
