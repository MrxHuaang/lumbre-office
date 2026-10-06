// La Noche de velitas en el navegador (las reglas las decide el servidor, rooms/velitas.ts): el estado de
// las velitas prendidas y los deseos, los avisos, y qué hacen E, F y el clic con una velita o el farol de
// deseos en la mano. El dibujo (las velitas y los faroles que suben) está en velitasLayer.ts; este archivo
// lo importa también el HUD (el contador del letrero y el panel del deseo).
import { onWishDock, velitaBlock, velitaInReach, type OfficeMap } from "@hyvento/map";
import {
  FAROL_DESEOS,
  FESTIVAL_MSG,
  VELITA,
  VELITAS,
  VELITAS_CINE,
  VELITAS_MSG,
  velitasNoticeText,
  type Direction,
  type FarolEvent,
  type FestivalCineEvent,
  type VelitasNotice,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { create } from "zustand";
import { getRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

export interface VelitaView {
  key: string;
  x: number;
  y: number;
}

export interface DeseoView {
  userId: string;
  name: string;
  text: string;
}

interface VelitasStore {
  lit: number;
  placed: VelitaView[];
  wishes: DeseoView[];
}

export const useVelitasStore = create<VelitasStore>(() => ({ lit: 0, placed: [], wishes: [] }));

const farolListeners = new Set<(e: FarolEvent) => void>();
/** Alguien soltó su farol (la animación del que sube). */
export function onFarol(cb: (e: FarolEvent) => void) {
  farolListeners.add(cb);
  return () => farolListeners.delete(cb);
}

const sueltaListeners = new Set<(wishes: readonly DeseoView[]) => void>();
/** La suelta de faroles de las 21:00: todos los deseos de la noche suben juntos. */
export function onSuelta(cb: (wishes: readonly DeseoView[]) => void) {
  sueltaListeners.add(cb);
  return () => sueltaListeners.delete(cb);
}

const GOOD = new Set<VelitasNotice["code"]>(["regalo", "soltado"]);

/** Engancha el estado y los mensajes de la Noche de velitas (en cada conexión). */
export function bindVelitas(r: OfficeRoom) {
  const $ = getStateCallbacks(r);
  // Muchos cambios llegan juntos (al entrar, todas las velitas): se rearma una vez por tanda.
  let queued = false;
  const sync = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      const v = r.state.velitas;
      if (!v) return;
      const placed: VelitaView[] = [];
      v.placed.forEach((p, key) => placed.push({ key, x: p.x, y: p.y }));
      const wishes: DeseoView[] = [];
      v.wishes.forEach((w, userId) => wishes.push({ userId, name: w.name, text: w.text }));
      useVelitasStore.setState({ lit: v.lit, placed, wishes });
    });
  };
  // Lo de adentro se engancha cuando llega el estado de la noche (al entrar puede no estar todavía).
  $(r.state).listen("velitas", (v) => {
    if (!v) return;
    const v$ = $(v);
    v$.placed.onAdd(sync);
    v$.placed.onRemove(sync);
    v$.wishes.onAdd(sync);
    v$.wishes.onRemove(sync);
    v$.listen("lit", sync);
    sync();
  });
  r.onMessage(VELITAS_MSG.notice, (n: VelitasNotice) => useOfficeStore.getState().notify(velitasNoticeText(n), GOOD.has(n.code) ? "success" : "info"));
  r.onMessage(VELITAS_MSG.farol, (e: FarolEvent) => farolListeners.forEach((cb) => cb(e)));
  r.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => {
    if (e.id === VELITAS_CINE.faroles) sueltaListeners.forEach((cb) => cb(useVelitasStore.getState().wishes));
  });
}

export const sendVelitaPlace = (x: number, y: number) => getRoom()?.send(VELITAS_MSG.place, { x, y });
export const sendDeseo = (text: string) => getRoom()?.send(VELITAS_MSG.wish, { text });

/** ¿Está abierta la Noche de velitas? (se prenden velitas y se sueltan faroles). */
export function velitasAbiertas(): boolean {
  const f = useOfficeStore.getState().festival;
  return f.id === "velitas" && f.fase === "fiesta";
}

/** Lo que tengo en la mano (el dibujo, que para las velitas y el farol es su id). */
function myHeld(): string {
  const s = useOfficeStore.getState();
  return (s.sessionId && s.players[s.sessionId]?.held) || "";
}

const isTaken = (x: number, y: number) => useVelitasStore.getState().placed.some((p) => p.x === x && p.y === y);
const freeSpot = (map: OfficeMap, at: { x: number; y: number }, x: number, y: number) => !isTaken(x, y) && !velitaBlock(map, x, y) && velitaInReach(map, at.x, at.y, x, y);

const AHEAD: Record<Direction, [number, number]> = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };

/** Dónde va la velita con E: el tile de adelante, el de los pies o uno de al lado (el primero libre). */
function spotAhead(map: OfficeMap, at: { x: number; y: number }, dir: Direction): { x: number; y: number } | null {
  const tx = Math.floor(at.x / map.tileSize);
  const ty = Math.floor(at.y / map.tileSize);
  const [dx, dy] = AHEAD[dir];
  const tries: [number, number][] = [[tx + dx, ty + dy], [tx, ty], ...Object.values(AHEAD).map(([ax, ay]) => [tx + ax, ty + ay] as [number, number])];
  const t = tries.find(([x, y]) => freeSpot(map, at, x, y));
  return t ? { x: t[0], y: t[1] } : null;
}

/**
 * E o F con una velita o el farol en la mano, en la Noche de velitas: la velita se prende adelante y el
 * farol abre el deseo (si estoy en el muelle). Junto a otra cosa que se usa con E (`near`), E con la
 * velita es para esa cosa; el farol en el muelle gana (la punta del muelle es también para pescar).
 * Devuelve si lo usó (si no, la tecla hace lo de siempre).
 */
export function velitasKey(map: OfficeMap, at: { x: number; y: number }, dir: Direction, key: "e" | "f", near: boolean): boolean {
  if (!velitasAbiertas() || map.id !== VELITAS.area) return false;
  const held = myHeld();
  if (held === VELITA && (key === "f" || !near)) {
    const spot = spotAhead(map, at, dir);
    if (spot) sendVelitaPlace(spot.x, spot.y);
    else useOfficeStore.getState().notify(velitasNoticeText({ code: "bloqueado" }), "info");
    return true;
  }
  if (held === FAROL_DESEOS) {
    if (onWishDock(map, at.x, at.y)) {
      useOfficeStore.getState().openPanel("deseo", true);
      return true;
    }
    if (key === "f") {
      useOfficeStore.getState().notify(velitasNoticeText({ code: "muelle" }), "info");
      return true;
    }
  }
  return false;
}

/** Clic con una velita en la mano sobre un tile libre al alcance: se prende ahí (si no, se camina). */
export function velitasClick(map: OfficeMap, at: { x: number; y: number }, wx: number, wy: number): boolean {
  if (!velitasAbiertas() || map.id !== VELITAS.area || myHeld() !== VELITA) return false;
  const x = Math.floor(wx / map.tileSize);
  const y = Math.floor(wy / map.tileSize);
  if (!freeSpot(map, at, x, y)) return false;
  sendVelitaPlace(x, y);
  return true;
}
