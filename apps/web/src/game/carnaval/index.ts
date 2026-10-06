// El Carnaval de Negros y Blancos en el navegador (ver carnaval.ts de @hyvento/shared): lo que muestra el
// HUD (el desfile, el concurso, el puesto), los pedidos al servidor (sumarse a la comparsa, echar maicena
// o serpentinas, postularse, votar, comprar) y sus respuestas. Todo lo decide la sala; aquí solo se pide y
// se muestra. El desfile en la calle lo dibuja `desfile.ts`.
import { desfileEstado, DESFILE_TIMING, filaEn, type DesfileTiming } from "@hyvento/map";
import {
  CARNAVAL,
  CARNAVAL_BUY_ERROR_TEXT,
  CARNAVAL_MSG,
  CONCURSO_ERROR_TEXT,
  JOIN_ERROR_TEXT,
  LANZAR_ERROR_TEXT,
  ESPUMA,
  MAICENA,
  bagItemName,
  carnavalActivo,
  carnavalShopItem,
  isLanzable,
  objItemId,
  type CarnavalBuyResult,
  type CarnavalShopId,
  type ConcursoResult,
  type JoinResult,
  type LanzadoEvent,
  type LanzarResult,
} from "@hyvento/shared";
import { create } from "zustand";
import { serverNow } from "../club/store";
import { getRoom, type OfficeRoom } from "../network";
import { useOfficeStore } from "../store";

export interface CandidatoView {
  userId: string;
  name: string;
  look: string;
  avatar: string;
  votos: number;
  at: number;
}

interface CarnavalStore {
  /** El desfile: "" (no pasa), "espera" o "desfile", cuándo empezó (hora del servidor) y su paso. */
  fase: string;
  inicio: number;
  corrida: number;
  timing: DesfileTiming;
  candidatos: CandidatoView[];
  ganador: string;
  cerrado: boolean;
  /** Por quién voté en este carnaval (lo sabe el navegador por la respuesta). */
  miVoto: string | null;
  /** ¿Puedo sumarme ahora (desde la vereda, junto a la comparsa de la cabaña)? ¿Voy en ella? */
  puedoSumarme: boolean;
  enComparsa: boolean;
  /** No quiero recibir maicena, espuma ni serpentinas (se guarda en este navegador). */
  noTalco: boolean;
  lastBuy: (CarnavalBuyResult & { seq: number }) | null;
}

const NO_TALCO_KEY = "hyvento.carnaval.notalco";
function readNoTalco(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(NO_TALCO_KEY) === "1";
  } catch {
    return false;
  }
}

export const useCarnavalStore = create<CarnavalStore>(() => ({
  fase: "",
  inicio: 0,
  corrida: 0,
  timing: DESFILE_TIMING,
  candidatos: [],
  ganador: "",
  cerrado: false,
  miVoto: null,
  puedoSumarme: false,
  enComparsa: false,
  noTalco: readNoTalco(),
  lastBuy: null,
}));

/** ¿Está abierto el Carnaval ahora? */
export const carnavalAhora = () => {
  const f = useOfficeStore.getState().festival;
  return carnavalActivo(f.id, f.fase);
};

/** Cuántos ms lleva el desfile en la calle (o null si no pasa). */
export function desfileMs(): number | null {
  const s = useCarnavalStore.getState();
  return s.fase === "desfile" ? serverNow() - s.inicio : null;
}

interface RemoteCarnaval {
  fase: string;
  inicio: number;
  corrida: number;
  velocidad: number;
  paradaMs: number;
  ganador: string;
  concursoCerrado: boolean;
  candidatos: Map<string, CandidatoView>;
}

let lastSig = "";
/** Copia el estado de la sala al store (desde la escena, cada cuadro; solo cambia si algo cambió). */
export function syncCarnaval(room: OfficeRoom | undefined, me: { x: number; y: number; area: string; comparsa: boolean } | null) {
  const c = (room?.state as unknown as { carnaval?: RemoteCarnaval } | undefined)?.carnaval;
  if (!c) return;
  const cands = [...(c.candidatos?.values() ?? [])].map((x) => ({ userId: x.userId, name: x.name, look: x.look, avatar: x.avatar, votos: x.votos, at: x.at }));
  const sig = `${c.fase}|${c.inicio}|${c.corrida}|${c.velocidad}|${c.paradaMs}|${c.ganador}|${c.concursoCerrado}|${cands.map((x) => `${x.userId}:${x.votos}:${x.name}:${x.look.length}`).join(",")}`;
  const store = useCarnavalStore.getState();
  if (sig !== lastSig) {
    lastSig = sig;
    const timing = c.velocidad > 0 ? { velocidad: c.velocidad, paradaMs: c.paradaMs } : DESFILE_TIMING;
    // Un concurso nuevo (otro día): el voto de antes ya no cuenta.
    const miVoto = cands.length === 0 ? null : store.miVoto;
    useCarnavalStore.setState({ fase: c.fase, inicio: c.inicio, corrida: c.corrida, timing, ganador: c.ganador, cerrado: c.concursoCerrado, candidatos: cands.sort((a, b) => a.at - b.at), miVoto });
  }
  const ms = desfileMs();
  let puede = false;
  if (me && ms !== null && !me.comparsa && me.area === "jardin" && carnavalAhora()) {
    // Durante todo el desfile, desde la vereda, donde vaya pasando la fila (un pelito más estricto que la sala).
    const cabeza = desfileEstado(ms, useCarnavalStore.getState().timing).cabeza;
    puede = me.y >= CARNAVAL.veredaDesdeY * 32 && filaEn(me.x / 32 + 0.4, cabeza) && filaEn(me.x / 32 - 0.4, cabeza);
  }
  if (puede !== store.puedoSumarme || Boolean(me?.comparsa) !== store.enComparsa) useCarnavalStore.setState({ puedoSumarme: puede, enComparsa: Boolean(me?.comparsa) });
}

// ---------- Pedidos ----------

export const sumarseComparsa = () => getRoom()?.send(CARNAVAL_MSG.join, {});
export const salirseComparsa = () => getRoom()?.send(CARNAVAL_MSG.leave, {});
export const postularme = () => getRoom()?.send(CARNAVAL_MSG.postular, {});
let votoPendiente: string | null = null;
export function votarPor(userId: string) {
  votoPendiente = userId;
  getRoom()?.send(CARNAVAL_MSG.votar, { userId });
}
export const sendCarnavalBuy = (item: CarnavalShopId) => getRoom()?.send(CARNAVAL_MSG.buy, { item });

export function setNoTalco(off: boolean) {
  useCarnavalStore.setState({ noTalco: off });
  try {
    window.localStorage.setItem(NO_TALCO_KEY, off ? "1" : "0");
  } catch {
    // Sin almacenamiento: vale solo por esta visita.
  }
  getRoom()?.send(CARNAVAL_MSG.talcoPref, { off });
}

/**
 * F con la maicena, la espuma o las serpentinas en la mano: se le echa a la persona más cercana del nivel (a quien se
 * tenga al lado). Devuelve si era eso (así la escena no manda el "usar" de siempre).
 */
export function lanzarConF(me: { x: number; y: number } | undefined): boolean {
  const s = useOfficeStore.getState();
  const mine = s.sessionId ? s.players[s.sessionId] : undefined;
  if (!me || !mine || !isLanzable(mine.held)) return false;
  const room = getRoom();
  let best: { id: string; d: number } | null = null;
  for (const [id, p] of room?.state.players ?? []) {
    if (id === s.sessionId || p.area !== mine.area) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (!best || d < best.d) best = { id, d };
  }
  if (!best || best.d > (CARNAVAL.lanzarReachTiles - 0.2) * 32) {
    s.notify(LANZAR_ERROR_TEXT.far, "info");
    return true;
  }
  room?.send(CARNAVAL_MSG.lanzar, { to: best.id });
  return true;
}

// ---------- Respuestas ----------

let seq = 0;
/** Lo que hace la escena cuando a alguien le echan algo (el polvo o el confeti sobre su personaje). */
const lanzadoListeners = new Set<(e: LanzadoEvent) => void>();
export function onLanzado(fn: (e: LanzadoEvent) => void) {
  lanzadoListeners.add(fn);
  return () => lanzadoListeners.delete(fn);
}

const nameOf = (sessionId: string) => useOfficeStore.getState().players[sessionId]?.name ?? "Alguien";
const kindText = (kind: string) => (kind === MAICENA ? "maicena" : kind === ESPUMA ? "espuma" : "serpentinas");

/** Engancha las respuestas (en cada conexión) y la E del palco y del puesto. */
export function bindCarnaval(r: OfficeRoom) {
  lastSig = "";
  // Lo que se eligió en este navegador (no recibir talco) vale también para la sala nueva.
  if (useCarnavalStore.getState().noTalco) r.send(CARNAVAL_MSG.talcoPref, { off: true });
  r.onMessage(CARNAVAL_MSG.joinResult, (res: JoinResult) => {
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(JOIN_ERROR_TEXT[res.error], res.error === "far" ? "info" : "warning");
    if (!res.joined) store.notify("Te saliste de la comparsa. ¡Hasta el próximo desfile!", "info");
  });
  r.onMessage(CARNAVAL_MSG.lanzarResult, (res: LanzarResult) => {
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(res.name && res.error !== "busy" ? `${res.name}: ${LANZAR_ERROR_TEXT[res.error]}` : LANZAR_ERROR_TEXT[res.error], "info");
    store.notify(res.kind === MAICENA ? `Le echaste maicena a ${res.name}.` : res.kind === ESPUMA ? `Le echaste espuma a ${res.name}.` : `Le tiraste serpentinas a ${res.name}.`, "success");
  });
  r.onMessage(CARNAVAL_MSG.lanzado, (e: LanzadoEvent) => {
    for (const fn of lanzadoListeners) fn(e);
    const store = useOfficeStore.getState();
    if (e.to === store.sessionId) store.notify(`${nameOf(e.from)} te echó ${kindText(e.kind)}.`, "info");
  });
  r.onMessage(CARNAVAL_MSG.concursoResult, (res: ConcursoResult) => {
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(CONCURSO_ERROR_TEXT[res.error], "warning");
    if (res.kind === "votado") {
      useCarnavalStore.setState({ miVoto: votoPendiente });
      store.notify(`Votaste por la pinta de ${res.name}.`, "success");
    } else store.notify("Tu pinta quedó postulada al concurso.", "success");
  });
  r.onMessage(CARNAVAL_MSG.buyResult, (res: CarnavalBuyResult) => {
    useCarnavalStore.setState({ lastBuy: { ...res, seq: ++seq } });
    const store = useOfficeStore.getState();
    if (!res.ok) return store.notify(CARNAVAL_BUY_ERROR_TEXT[res.error], "warning");
    store.notify(`${carnavalShopItem(res.item)?.name ?? bagItemName(objItemId(res.item))} a la mochila.`, "success");
  });
}
