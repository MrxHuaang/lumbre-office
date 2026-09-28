// Red y estado de las mesas de rondas compartidas del casino (baccarat, dados y caballitos)
// en el cliente: una copia simple para React y el modo mesa. network.ts llama a `bindMesas` con cada
// sala nueva. Las reglas y el azar están en el servidor: acá solo se muestra.
import { MESAS, MSG, mesaResultText, type MesaId, type MesaPhase, type MesaSettled } from "@hyvento/shared";
import { getStateCallbacks, type Room } from "colyseus.js";
import { create } from "zustand";
import { useOfficeStore } from "./store";

export interface MesaBetView {
  userId: string;
  name: string;
  bet: string;
  amount: number;
}

export interface MesaView {
  phase: MesaPhase;
  round: number;
  /** Fin de la fase en hora del servidor (ms). */
  endsAt: number;
  /** Cartas, dados u orden de llegada (vacío mientras se apuesta). */
  result: number[];
  history: number[];
  bets: MesaBetView[];
}

interface RemoteMesa {
  phase: string;
  round: number;
  endsAt: number;
  result: number[];
  history: number[];
  bets: MesaBetView[];
}

const EMPTY: MesaView = { phase: "betting", round: 0, endsAt: 0, result: [], history: [], bets: [] };

interface MesasStore {
  tables: Record<MesaId, MesaView>;
  /** Lo que se ganó en la última ronda en la que apostaste (en cualquier mesa). */
  lastSettled: MesaSettled | null;
}

export const useMesasStore = create<MesasStore>(() => ({
  tables: Object.fromEntries(MESAS.map((id) => [id, EMPTY])) as Record<MesaId, MesaView>,
  lastSettled: null,
}));

let room: Room | null = null;

export function bindMesas(r: Room) {
  room = r;
  const $ = getStateCallbacks(r as Room<{ mesas: Map<string, RemoteMesa> }>);
  const sync = (id: string, t: RemoteMesa) => {
    if (!(MESAS as readonly string[]).includes(id)) return;
    const next: MesaView = {
      phase: t.phase as MesaPhase,
      round: t.round,
      endsAt: t.endsAt,
      result: [...t.result],
      history: [...t.history],
      bets: [...t.bets].map((b) => ({ userId: b.userId, name: b.name, bet: b.bet, amount: b.amount })),
    };
    useMesasStore.setState((s) => ({ tables: { ...s.tables, [id]: next } }));
  };
  $(r.state as { mesas: Map<string, RemoteMesa> }).mesas.onAdd((t: RemoteMesa, id: string) => {
    const t$ = $(t);
    const push = () => sync(id, t);
    t$.onChange(push);
    t$.bets.onAdd(push);
    t$.bets.onRemove(push);
    t$.result.onAdd(push);
    t$.result.onRemove(push);
    t$.history.onAdd(push);
    t$.history.onRemove(push);
    push();
  });
  r.onMessage(MSG.mesaSettled, (s: MesaSettled) => {
    useMesasStore.setState({ lastSettled: s });
    const profit = s.won - s.staked;
    const what = mesaResultText(s.table, s.result);
    useOfficeStore
      .getState()
      .notify(s.won > 0 ? `${what}: recibes ${s.won} (${profit >= 0 ? "+" : ""}${profit}).` : `${what}. Esta vez no hubo suerte.`, s.won > s.staked ? "success" : "info");
  });
}

export function sendMesaBet(table: MesaId, bet: string, amount: number) {
  room?.send(MSG.mesaBet, { table, bet, amount });
}
