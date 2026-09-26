import {
  KNOCK_TIMEOUT_MS,
  type ChatEvent,
  type ChatScope,
  type HumanAvatar,
  type Look,
  type KnockOutcome,
  type KnockRequest,
  type KnockResult,
  type PointsAwarded,
  type PresenceStatus,
} from "@hyvento/shared";
import { create } from "zustand";

export interface Profile {
  name: string;
  avatar: HumanAvatar;
  /** Personaje personalizado; null = usa `avatar`. */
  look: Look | null;
}

export interface PlayerInfo {
  sessionId: string;
  userId: string;
  name: string;
  avatar: string;
  /** Nivel de la cabaña donde está. */
  area: string;
  zoneId: string;
  /** Lugar para mostrar (zona, "door:<zona>" o ""). */
  place: string;
  status: PresenceStatus;
  points: number;
}

/**
 * Objetos con los que se interactúa (tecla E o clic): buzón y tablón del jardín, barra de la cafetería,
 * mostrador de la tienda y probador.
 */
export type Interactable = "mailbox" | "board" | "cafe" | "shop" | "fitting";
/** Paneles sobre la cabaña: los de los objetos y la mochila (se abre desde el HUD). */
export type PanelKind = Interactable | "backpack";

export interface OfficeView {
  zoneId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  locked: boolean;
  guests: string[];
}

export interface ZoneInfo {
  id: string;
  name: string;
  type: string;
  isolated: boolean;
}

export interface Notice {
  id: number;
  text: string;
  tone: "info" | "success" | "warning";
  action?: { label: string; run: () => void };
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface OfficeStore {
  connection: ConnectionStatus;
  error: string | null;
  sessionId: string | null;
  players: Record<string, PlayerInfo>;
  offices: Record<string, OfficeView>;
  zone: ZoneInfo | null;
  /** Lugar actual del jugador local (ver `placeAt`), calculado en el cliente. */
  place: string;
  /** Nombres de las zonas del mapa, por id. */
  zoneNames: Record<string, string>;
  messages: ChatEvent[];
  unread: number;
  chatScope: ChatScope;
  chatOpen: boolean;
  /** Hay un input de texto enfocado: el juego no debe leer el teclado. */
  typing: boolean;
  /** Oficina cerrada frente a cuya puerta está el jugador (para ofrecer "tocar"). */
  doorPrompt: string | null;
  /** Junto a un asiento libre ("sit") o sentado ("stand"), para mostrar la ayuda de la tecla E. */
  seatPrompt: "sit" | "stand" | null;
  /** Sentado frente a un escritorio con computador (se puede prender el PC). */
  atComputer: boolean;
  /** El PC está prendido: el mapa no responde a clics ni teclas. */
  pcOn: boolean;
  /** Oficina a la que tocamos y cuya respuesta esperamos. */
  pendingKnock: string | null;
  /** Toques recibidos en mi oficina, pendientes de respuesta. */
  knockRequests: (KnockRequest & { expiresAt: number })[];
  notices: Notice[];
  /** Pedido a la escena de caminar hasta una zona (cambia `nonce` para repetir). */
  walkTarget: { zoneId: string; nonce: number } | null;
  /** Nivel en el que está el jugador local. */
  area: string;
  /** Modo noche (luces encendidas); arranca según la hora local. */
  night: boolean;
  /** Objeto al alcance del jugador (para ofrecer "E: abrir"). */
  interact: Interactable | null;
  /** Panel abierto (buzón o tablón); `atObject` = se abrió junto al objeto (permite reclamar). */
  panel: { kind: PanelKind; atObject: boolean } | null;
  /** Último premio de puntos (cambia `id` en cada uno, para animarlo). */
  lastAward: (PointsAwarded & { id: number }) | null;

  setConnection: (c: ConnectionStatus, error?: string | null) => void;
  setSessionId: (id: string | null) => void;
  upsertPlayer: (p: PlayerInfo) => void;
  removePlayer: (sessionId: string) => void;
  upsertOffice: (o: OfficeView) => void;
  removeOffice: (zoneId: string) => void;
  setZone: (z: ZoneInfo | null) => void;
  setPlace: (place: string) => void;
  setZoneNames: (names: Record<string, string>) => void;
  addMessages: (m: ChatEvent[]) => void;
  setChatScope: (s: ChatScope) => void;
  setChatOpen: (open: boolean) => void;
  setTyping: (t: boolean) => void;
  setDoorPrompt: (zoneId: string | null) => void;
  setSeatPrompt: (prompt: "sit" | "stand" | null) => void;
  setAtComputer: (at: boolean) => void;
  setPcOn: (on: boolean) => void;
  setPendingKnock: (zoneId: string | null) => void;
  addKnockRequest: (r: KnockRequest) => void;
  removeKnockRequest: (requestId: string) => void;
  handleKnockResult: (r: KnockResult) => void;
  notify: (text: string, tone?: Notice["tone"], action?: Notice["action"]) => void;
  dismissNotice: (id: number) => void;
  walkToZone: (zoneId: string) => void;
  setArea: (area: string) => void;
  setNight: (night: boolean) => void;
  setInteract: (i: Interactable | null) => void;
  openPanel: (kind: PanelKind, atObject: boolean) => void;
  closePanel: () => void;
  addAward: (a: PointsAwarded) => void;
  reset: () => void;
}

const MAX_MESSAGES = 200;
const NOTICE_MS = 4500;
let noticeId = 0;

const KNOCK_TEXT: Record<KnockOutcome, (owner: string) => { text: string; tone: Notice["tone"] }> = {
  accepted: (o) => ({ text: `${o} te dejó pasar.`, tone: "success" }),
  declined: (o) => ({ text: `${o} no puede atenderte ahora.`, tone: "warning" }),
  timeout: (o) => ({ text: `${o} no respondió.`, tone: "warning" }),
  "owner-away": (o) => ({ text: `${o} no está conectado ahora.`, tone: "info" }),
  "not-locked": () => ({ text: "La puerta está abierta, puedes entrar.", tone: "info" }),
  "too-soon": () => ({ text: "Espera un momento antes de volver a tocar.", tone: "info" }),
};

const initial = {
  connection: "idle" as ConnectionStatus,
  error: null,
  sessionId: null,
  players: {},
  offices: {},
  zone: null,
  place: "",
  zoneNames: {},
  messages: [],
  unread: 0,
  chatScope: "proximity" as ChatScope,
  chatOpen: true,
  typing: false,
  doorPrompt: null,
  seatPrompt: null as "sit" | "stand" | null,
  atComputer: false,
  pcOn: false,
  pendingKnock: null,
  knockRequests: [],
  notices: [],
  walkTarget: null,
  area: "",
  night: false,
  interact: null as Interactable | null,
  panel: null as { kind: PanelKind; atObject: boolean } | null,
  lastAward: null as (PointsAwarded & { id: number }) | null,
};

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  ...initial,
  setConnection: (connection, error = null) => set({ connection, error }),
  setSessionId: (sessionId) => set({ sessionId }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.sessionId]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.players;
      return { players: rest };
    }),
  upsertOffice: (o) => set((s) => ({ offices: { ...s.offices, [o.zoneId]: o } })),
  removeOffice: (zoneId) =>
    set((s) => {
      const { [zoneId]: _removed, ...rest } = s.offices;
      return { offices: rest };
    }),
  setZone: (zone) => set({ zone }),
  setPlace: (place) => set({ place }),
  setZoneNames: (zoneNames) => set({ zoneNames }),
  addMessages: (m) =>
    set((s) => {
      const known = new Set(s.messages.map((x) => x.id));
      const fresh = m.filter((x) => !known.has(x.id));
      return {
        messages: [...s.messages, ...fresh].slice(-MAX_MESSAGES),
        unread: s.chatOpen ? 0 : s.unread + fresh.length,
      };
    }),
  setChatScope: (chatScope) => set({ chatScope }),
  setChatOpen: (chatOpen) => set((s) => ({ chatOpen, unread: chatOpen ? 0 : s.unread })),
  setTyping: (typing) => set({ typing }),
  setDoorPrompt: (doorPrompt) => set({ doorPrompt }),
  setSeatPrompt: (seatPrompt) => set({ seatPrompt }),
  setAtComputer: (atComputer) => set({ atComputer }),
  setPcOn: (pcOn) => set({ pcOn }),
  setPendingKnock: (pendingKnock) => set({ pendingKnock }),
  addKnockRequest: (r) => {
    const expiresAt = Date.now() + KNOCK_TIMEOUT_MS;
    set((s) => ({ knockRequests: [...s.knockRequests, { ...r, expiresAt }] }));
    setTimeout(() => get().removeKnockRequest(r.requestId), KNOCK_TIMEOUT_MS);
  },
  removeKnockRequest: (requestId) =>
    set((s) => ({ knockRequests: s.knockRequests.filter((k) => k.requestId !== requestId) })),
  handleKnockResult: (r) => {
    if (get().pendingKnock === r.zoneId) set({ pendingKnock: null });
    const { text, tone } = KNOCK_TEXT[r.outcome](r.ownerName || "La persona");
    get().notify(text, tone);
  },
  notify: (text, tone = "info", action) => {
    const id = ++noticeId;
    set((s) => ({ notices: [...s.notices.slice(-3), { id, text, tone, action }] }));
    setTimeout(() => get().dismissNotice(id), action ? NOTICE_MS * 2 : NOTICE_MS);
  },
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  walkToZone: (zoneId) => set({ walkTarget: { zoneId, nonce: Date.now() } }),
  setArea: (area) => set({ area }),
  setNight: (night) => set({ night }),
  setInteract: (interact) => set({ interact }),
  openPanel: (kind, atObject) => set({ panel: { kind, atObject } }),
  closePanel: () => set({ panel: null }),
  addAward: (a) => set({ lastAward: { ...a, id: ++noticeId } }),
  reset: () => set((s) => ({ ...initial, zoneNames: s.zoneNames, night: s.night })),
}));

/** User.id del jugador local. */
export function selectMyUserId(s: Pick<OfficeStore, "sessionId" | "players">): string | null {
  return s.sessionId ? (s.players[s.sessionId]?.userId ?? null) : null;
}

/** Oficina de la que el jugador local es dueño. */
export function selectMyOffice(s: Pick<OfficeStore, "sessionId" | "players" | "offices">): OfficeView | null {
  const me = selectMyUserId(s);
  if (!me) return null;
  return Object.values(s.offices).find((o) => o.ownerId === me) ?? null;
}

/** ¿Puede este usuario entrar a la oficina? (misma regla que el servidor). */
export function canEnterOffice(office: OfficeView | undefined, userId: string | null): boolean {
  if (!office || !office.locked || !office.ownerId) return true;
  return userId !== null && (office.ownerId === userId || office.guests.includes(userId));
}
