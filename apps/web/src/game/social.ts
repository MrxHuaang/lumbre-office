// Fase 5 en el cliente: el menú de una persona (Regalar / Intercambiar), los avisos de regalos y el
// estado del intercambio en curso. Lo valida todo el servidor; aquí solo se muestra y se manda.
import {
  describeBundle,
  MSG,
  TRADE,
  TRADE_ERROR_TEXT,
  type GiftReceived,
  type TradeClosed,
  type TradeInvite,
  type TradeOfferMessage,
  type TradeProblem,
  type TradeView,
} from "@hyvento/shared";
import { create } from "zustand";
import { getRoom, onRoom, type OfficeRoom } from "./network";
import { useOfficeStore } from "./store";

/** A quién se le regala (desde la lista de conectados, el menú de la persona o el buzón). */
export interface GiftTarget {
  userId: string;
  name: string;
}

interface SocialStore {
  /** Menú abierto sobre una persona del juego (posición en px de la ventana). */
  personMenu: { sessionId: string; x: number; y: number } | null;
  /** Ventana de regalo abierta (fuera del buzón). */
  giftTo: GiftTarget | null;
  /** Regalos sin abrir en el buzón (null = todavía no se sabe). */
  unopened: number | null;
  /** Invitaciones a intercambiar que esperan respuesta (con la hora local en que vencen). */
  invites: (TradeInvite & { until: number })[];
  /** El intercambio abierto. */
  trade: TradeView | null;
  /** Último problema del intercambio (cambia `id` en cada uno: la ventana vuelve a lo que aceptó el servidor). */
  problem: (TradeProblem & { id: number }) | null;

  openPersonMenu: (sessionId: string, x: number, y: number) => void;
  closePersonMenu: () => void;
  openGift: (to: GiftTarget | null) => void;
  setUnopened: (n: number | null) => void;
}

let problemId = 0;

export const useSocialStore = create<SocialStore>((set) => ({
  personMenu: null,
  giftTo: null,
  unopened: null,
  invites: [],
  trade: null,
  problem: null,
  openPersonMenu: (sessionId, x, y) => set({ personMenu: { sessionId, x, y } }),
  closePersonMenu: () => set({ personMenu: null }),
  openGift: (giftTo) => set({ giftTo, personMenu: null }),
  setUnopened: (unopened) => set({ unopened }),
}));

// ---------- Mensajes al servidor ----------

export function sendTradeRequest(sessionId: string) {
  getRoom()?.send(MSG.tradeRequest, { sessionId });
  const name = useOfficeStore.getState().players[sessionId]?.name ?? "esa persona";
  useOfficeStore.getState().notify(`Invitaste a ${name} a intercambiar.`, "info");
}

export function respondTrade(requestId: string, accept: boolean) {
  useSocialStore.setState((s) => ({ invites: s.invites.filter((i) => i.requestId !== requestId) }));
  getRoom()?.send(MSG.tradeRespond, { requestId, accept });
}

export const sendTradeOffer = (offer: TradeOfferMessage) => getRoom()?.send(MSG.tradeOffer, offer);
export const sendTradeReady = (ready: boolean) => getRoom()?.send(MSG.tradeReady, { ready });
export const sendTradeConfirm = () => getRoom()?.send(MSG.tradeConfirm);
export function sendTradeCancel() {
  getRoom()?.send(MSG.tradeCancel);
}

// ---------- Mensajes del servidor ----------

const CLOSED_TEXT: Record<Exclude<TradeClosed["reason"], "done">, (who: string) => string> = {
  declined: (w) => `${w} no quiso intercambiar ahora.`,
  timeout: (w) => `${w} no respondió la invitación.`,
  cancelled: (w) => `Se canceló el intercambio con ${w}.`,
  far: (w) => `Se canceló el intercambio: te alejaste de ${w}.`,
  left: (w) => `Se canceló el intercambio: ${w} se desconectó.`,
};

function attachSocial(r: OfficeRoom) {
  // Una sala nueva (o una reconexión): lo de la anterior ya no vale.
  useSocialStore.setState({ invites: [], trade: null, personMenu: null });
  const notify = (...args: Parameters<ReturnType<typeof useOfficeStore.getState>["notify"]>) => useOfficeStore.getState().notify(...args);

  r.onMessage(MSG.giftReceived, (g: GiftReceived) => {
    const s = useSocialStore.getState();
    s.setUnopened((s.unopened ?? 0) + 1);
    const what = describeBundle(g.points, g.itemId ? [{ itemId: g.itemId, quantity: g.quantity }] : []);
    notify(`${g.fromName} te mandó un regalo (${what}). Te espera en el buzón.`, "success", {
      label: "Ver",
      run: () => useOfficeStore.getState().openPanel("mailbox", false),
    });
  });
  r.onMessage(MSG.tradeInvite, (inv: TradeInvite) => {
    const until = Date.now() + TRADE.requestTimeoutMs;
    useSocialStore.setState((s) => ({ invites: [...s.invites.filter((i) => i.fromSessionId !== inv.fromSessionId), { ...inv, until }] }));
    setTimeout(() => useSocialStore.setState((s) => ({ invites: s.invites.filter((i) => i.requestId !== inv.requestId) })), TRADE.requestTimeoutMs);
  });
  r.onMessage(MSG.tradeUpdate, (view: TradeView) => useSocialStore.setState({ trade: view, personMenu: null }));
  r.onMessage(MSG.tradeProblem, (p: TradeProblem) => {
    useSocialStore.setState({ problem: { ...p, id: ++problemId } });
    const text = TRADE_ERROR_TEXT[p.error];
    notify(p.who && (p.error === "funds" || p.error === "items") ? `${text} (${p.who})` : text, "warning");
  });
  r.onMessage(MSG.tradeClosed, (c: TradeClosed) => {
    const { trade } = useSocialStore.getState();
    if (trade && trade.id === c.id) useSocialStore.setState({ trade: null });
    if (c.reason === "done") {
      const got = c.got ? describeBundle(c.got.points, c.got.items) : "nada";
      notify(`¡Intercambio hecho con ${c.with}! Recibiste ${got}.`, "success");
    } else {
      notify(CLOSED_TEXT[c.reason](c.with), c.reason === "cancelled" ? "info" : "warning");
    }
  });
}

if (typeof window !== "undefined") onRoom(attachSocial);

// ---------- La escena ----------

interface Pickable {
  sprite: { visible: boolean; getBounds(): { contains(x: number, y: number): boolean } };
}

/** Punto del canvas del juego (px del juego) → px de la ventana, para ubicar el menú junto al clic. */
export function clientPoint(canvas: HTMLCanvasElement, gameWidth: number, px: number, py: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  const k = gameWidth ? r.width / gameWidth : 1;
  return [r.left + px * k, r.top + py * k];
}

/** Persona (otra que no soy yo) dibujada bajo el puntero, en coordenadas del mundo de la cámara. */
export function personAt(avatars: Map<string, Pickable>, localId: string | null, wx: number, wy: number): string | null {
  for (const [id, a] of avatars) {
    if (id === localId || !a.sprite.visible) continue;
    if (a.sprite.getBounds().contains(wx, wy)) return id;
  }
  return null;
}
