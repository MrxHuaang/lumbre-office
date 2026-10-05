// Las novenas en el navegador (VIR-159): cómo está el pesebre del recibidor (lo dibuja eventos.ts como
// capa), E junto a él para poner la figura del día, las cinemáticas de la novena y los aguinaldos (las
// invitaciones y el juego en curso, que muestra components/novenas/Aguinaldos.tsx). Lo valida todo el
// servidor; aquí solo se muestra y se manda.
import {
  AGUINALDO,
  AGUINALDO_MSG,
  aguinaldoFinText,
  aguinaldoProblemaText,
  nearPesebre,
  NOVENA_MSG,
  NOVENAS_FESTIVAL,
  novenaAvisoText,
  type AguinaldoFin,
  type AguinaldoInvitacion,
  type AguinaldoJuego,
  type AguinaldoProblema,
  type AguinaldoView,
  type NovenaAviso,
  type NovenaCineEvent,
  type PesebreEstado,
} from "@hyvento/shared";
import { create } from "zustand";
import { playCinematic } from "./cinematicas/puerta";
import { getRoom, onInteract, onRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

interface NovenasStore {
  pesebre: PesebreEstado;
  /** Invitaciones a un aguinaldo que esperan respuesta (con la hora local en que vencen). */
  invitaciones: (AguinaldoInvitacion & { until: number })[];
  /** El juego en curso, con la hora local en que se acaba el tiempo que corre. */
  juego: (AguinaldoView & { until: number }) | null;
}

export const useNovenas = create<NovenasStore>(() => ({
  pesebre: { dia: 0, figuras: 0, por: "" },
  invitaciones: [],
  juego: null,
}));

/** ¿Corre la novena? (los aguinaldos se ofrecen solo entonces). */
export const useEnNovena = () => useOfficeStore((s) => s.festival.id === NOVENAS_FESTIVAL);

/** ¿Está el jugador local junto al pesebre (con la novena)? Lo que anticipa la escena para ofrecer la E. */
export function pesebreInReach(p: { area: string; x: number; y: number } | null, tileSize: number): boolean {
  return Boolean(p && useNovenas.getState().pesebre.dia > 0 && nearPesebre(p, tileSize));
}

// ---------- Mensajes al servidor ----------

export function retarAguinaldo(sessionId: string, juego: AguinaldoJuego) {
  getRoom()?.send(AGUINALDO_MSG.reto, { sessionId, juego });
  const name = useOfficeStore.getState().players[sessionId]?.name ?? "esa persona";
  useOfficeStore.getState().notify(`Retaste a ${name}. A ver si acepta.`, "info");
}

export function responderAguinaldo(id: string, accept: boolean) {
  useNovenas.setState((s) => ({ invitaciones: s.invitaciones.filter((i) => i.id !== id) }));
  getRoom()?.send(AGUINALDO_MSG.responder, { id, accept });
}

export const contestarAguinaldo = (text: string) => getRoom()?.send(AGUINALDO_MSG.respuesta, { text });
export const rendirseAguinaldo = () => getRoom()?.send(AGUINALDO_MSG.rendirse);

// ---------- Mensajes del servidor ----------

function attach(r: OfficeRoom) {
  useNovenas.setState({ invitaciones: [], juego: null });
  const notify = (...args: Parameters<ReturnType<typeof useOfficeStore.getState>["notify"]>) => useOfficeStore.getState().notify(...args);

  r.onMessage(NOVENA_MSG.estado, (e: PesebreEstado) => useNovenas.setState({ pesebre: e }));
  r.onMessage(NOVENA_MSG.cine, (e: NovenaCineEvent) => void playCinematic(e.id, e.vars));
  r.onMessage(NOVENA_MSG.aviso, (a: NovenaAviso) => notify(novenaAvisoText(a), a.code === "rezo" ? "success" : "info"));

  r.onMessage(AGUINALDO_MSG.invitacion, (inv: AguinaldoInvitacion) => {
    // Un margen por la latencia: la tarjeta se va antes de que el servidor ya no la acepte.
    const ms = Math.max(0, inv.ttlMs - 1500);
    useNovenas.setState((s) => ({ invitaciones: [...s.invitaciones.filter((i) => i.fromSessionId !== inv.fromSessionId), { ...inv, until: Date.now() + ms }] }));
    setTimeout(() => useNovenas.setState((s) => ({ invitaciones: s.invitaciones.filter((i) => i.id !== inv.id) })), ms);
  });
  r.onMessage(AGUINALDO_MSG.juego, (v: AguinaldoView) => useNovenas.setState({ juego: { ...v, until: Date.now() + v.leftMs } }));
  r.onMessage(AGUINALDO_MSG.fin, (f: AguinaldoFin) => {
    useNovenas.setState((s) => (s.juego?.id === f.id ? { juego: null } : s));
    const yo = useOfficeStore.getState().sessionId ?? "";
    notify(aguinaldoFinText(f, yo), f.ganador?.sessionId === yo ? "success" : f.ganador ? "warning" : "info");
  });
  r.onMessage(AGUINALDO_MSG.problema, (p: AguinaldoProblema) => notify(aguinaldoProblemaText(p), "warning"));
}

if (typeof window !== "undefined") {
  onRoom(attach);
  // E junto al pesebre: poner la figura del día (el servidor dice si ya la pusieron).
  onInteract("pesebre", () => void getRoom()?.send(NOVENA_MSG.figura));
}

/** Lo que dura el juego (para la barrita del tiempo). */
export const aguinaldoTotalMs = (juego: AguinaldoJuego) => (juego === "pajita" ? AGUINALDO.pajitaMs : AGUINALDO.turnoMs);
