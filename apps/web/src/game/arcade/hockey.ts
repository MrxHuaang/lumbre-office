// Red y estado del hockey de mesa en el cliente: la mesa (fase, jugadores, goles) viene en el estado de la
// sala y el disco y los mazos en cuadros (`MSG.hockeyFrame`) que se guardan para interpolar. network.ts
// llama a `bindHockey` con cada sala nueva. Las reglas están en el servidor: acá solo se muestra.
import {
  HOCKEY_ERROR_TEXT,
  MSG,
  type HockeyFrame,
  type HockeyPhase,
  type HockeyResult,
  type HockeySettled,
  type HockeySide,
} from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "../store";

export interface HockeySideView {
  userId: string;
  name: string;
  score: number;
  bot: boolean;
}

export interface HockeyView {
  phase: HockeyPhase;
  match: number;
  endsAt: number;
  winner: number;
  forfeit: boolean;
  sides: [HockeySideView, HockeySideView];
}

interface RemoteHockey {
  phase: string;
  match: number;
  endsAt: number;
  winner: number;
  forfeit: boolean;
  sides: HockeySideView[];
}

const EMPTY_SIDE: HockeySideView = { userId: "", name: "", score: 0, bot: false };

interface HockeyStore {
  table: HockeyView;
  /** Últimos cuadros del partido (hora del servidor creciente), para interpolar el disco. */
  frames: HockeyFrame[];
  /** Respuesta a sumarse (cambia `seq` en cada una). */
  lastResult: (HockeyResult & { seq: number }) | null;
  /** Cómo me fue en el último partido. */
  lastSettled: HockeySettled | null;
}

let seq = 0;
/** Cuántos cuadros se guardan (a 20 por segundo: medio segundo largo). */
const KEEP_FRAMES = 12;

export const useHockeyStore = create<HockeyStore>(() => ({
  table: { phase: "idle", match: 0, endsAt: 0, winner: -1, forfeit: false, sides: [EMPTY_SIDE, EMPTY_SIDE] },
  frames: [],
  lastResult: null,
  lastSettled: null,
}));

/** Lado donde juego yo en el partido de ahora (o null). */
export function mySide(table: HockeyView, userId: string | null): HockeySide | null {
  if (!userId) return null;
  if (table.sides[0].userId === userId && !table.sides[0].bot) return 0;
  if (table.sides[1].userId === userId && !table.sides[1].bot) return 1;
  return null;
}

let room: Room | null = null;

export function bindHockey(r: Room) {
  room = r;
  useHockeyStore.setState({ frames: [] });
  const $ = getStateCallbacks(r as Room<{ hockey: RemoteHockey }>);
  const state = r.state as { hockey?: RemoteHockey };
  const sync = () => {
    const h = state.hockey;
    if (!h) return;
    const sides = [...h.sides].map((s) => ({ userId: s.userId, name: s.name, score: s.score, bot: s.bot }));
    const prev = useHockeyStore.getState().table;
    // Partido nuevo: los cuadros del anterior ya no sirven.
    if (h.match !== prev.match) useHockeyStore.setState({ frames: [] });
    useHockeyStore.setState({
      table: {
        phase: h.phase as HockeyPhase,
        match: h.match,
        endsAt: h.endsAt,
        winner: h.winner,
        forfeit: h.forfeit,
        sides: [sides[0] ?? EMPTY_SIDE, sides[1] ?? EMPTY_SIDE],
      },
    });
  };
  // La mesa llega con el primer estado: los callbacks se enganchan cuando aparece.
  $(r.state as { hockey: RemoteHockey }).listen("hockey", (h) => {
    if (!h) return;
    const h$ = $(h);
    h$.onChange(sync);
    h$.sides.onAdd((side) => {
      $(side).onChange(sync);
      sync();
    });
    sync();
  });
  r.onMessage(MSG.hockeyFrame, (f: HockeyFrame) => {
    const frames = useHockeyStore.getState().frames;
    // Si el reloj va para atrás (otro partido, reconexión), se empieza de nuevo.
    const next = frames.length && frames.at(-1)!.t > f.t ? [f] : [...frames.slice(-(KEEP_FRAMES - 1)), f];
    useHockeyStore.setState({ frames: next });
  });
  r.onMessage(MSG.hockeyResult, (res: HockeyResult) => {
    useHockeyStore.setState({ lastResult: { ...res, seq: ++seq } });
    if (!res.ok) useOfficeStore.getState().notify(HOCKEY_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(MSG.hockeySettled, (s: HockeySettled) => {
    useHockeyStore.setState({ lastSettled: s });
    const text =
      s.outcome === "win"
        ? `¡Ganaste el partido! +${s.won}${s.bonus > 0 ? ` y ${s.bonus} de premio` : ""}.`
        : s.outcome === "tie"
          ? "Empate: te devuelven la moneda."
          : s.outcome === "refund"
            ? "No llegó nadie a jugar: te devolvimos la moneda."
            : s.forfeit
              ? "Dejaste la mesa: el partido lo gana el otro lado."
              : "Perdiste el partido. ¡La revancha!";
    useOfficeStore.getState().notify(text, s.outcome === "win" ? "success" : "info");
  });
}

/** Sumarse en la punta donde estoy (`bot` = contra la máquina). */
export function sendHockeyJoin(bot = false) {
  room?.send(MSG.hockeyJoin, bot ? { bot: true } : {});
}

/** A dónde quiero llevar mi mazo (coordenadas de la cancha). */
export function sendHockeyMove(x: number, y: number) {
  room?.send(MSG.hockeyMove, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
}

export function sendHockeyLeave() {
  room?.send(MSG.hockeyLeave, {});
}

/**
 * Dónde van el disco y los mazos a la hora `serverNow` (un poco en el pasado: se interpola entre los dos
 * cuadros que la rodean; si no hay cuadro más nuevo, se sigue al disco con su velocidad un ratito).
 */
export function hockeyPose(frames: readonly HockeyFrame[], serverNow: number): { puck: { x: number; y: number }; mallets: [{ x: number; y: number }, { x: number; y: number }] } | null {
  if (!frames.length) return null;
  const t = serverNow;
  const next = frames.findIndex((f) => f.t > t);
  const at = (f: HockeyFrame, dt = 0) => ({
    puck: { x: f.p[0] + f.p[2] * dt, y: f.p[1] + f.p[3] * dt },
    mallets: [
      { x: f.m[0], y: f.m[1] },
      { x: f.m[2], y: f.m[3] },
    ] as [{ x: number; y: number }, { x: number; y: number }],
  });
  // Sin cuadro más nuevo: el disco sigue con su velocidad (hasta 150 ms; después se queda quieto).
  if (next === -1) return at(frames.at(-1)!, Math.min(0.15, Math.max(0, (t - frames.at(-1)!.t) / 1000)));
  if (next === 0) return at(frames[0]!);
  const a = frames[next - 1]!;
  const b = frames[next]!;
  const k = (t - a.t) / (b.t - a.t);
  const lerp = (u: number, v: number) => u + (v - u) * k;
  // Si entre los dos cuadros hubo un gol (el disco saltó al saque), no se interpola el salto.
  const jump = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) > 12;
  return {
    puck: jump ? { x: b.p[0], y: b.p[1] } : { x: lerp(a.p[0], b.p[0]), y: lerp(a.p[1], b.p[1]) },
    mallets: [
      { x: lerp(a.m[0], b.m[0]), y: lerp(a.m[1], b.m[1]) },
      { x: lerp(a.m[2], b.m[2]), y: lerp(a.m[3], b.m[3]) },
    ],
  };
}
