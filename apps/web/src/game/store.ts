import type { ChatEvent, ChatScope, HumanAvatar, PresenceStatus } from "@hyvento/shared";
import { create } from "zustand";

export interface Profile {
  name: string;
  avatar: HumanAvatar;
}

export interface PlayerInfo {
  sessionId: string;
  name: string;
  avatar: string;
  zoneId: string;
  status: PresenceStatus;
}

export interface ZoneInfo {
  id: string;
  name: string;
  type: string;
  isolated: boolean;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface OfficeStore {
  connection: ConnectionStatus;
  error: string | null;
  sessionId: string | null;
  players: Record<string, PlayerInfo>;
  zone: ZoneInfo | null;
  messages: ChatEvent[];
  unread: number;
  chatScope: ChatScope;
  chatOpen: boolean;
  /** Hay un input de texto enfocado: el juego no debe leer el teclado. */
  typing: boolean;

  setConnection: (c: ConnectionStatus, error?: string | null) => void;
  setSessionId: (id: string | null) => void;
  upsertPlayer: (p: PlayerInfo) => void;
  removePlayer: (sessionId: string) => void;
  setZone: (z: ZoneInfo | null) => void;
  addMessages: (m: ChatEvent[]) => void;
  setChatScope: (s: ChatScope) => void;
  setChatOpen: (open: boolean) => void;
  setTyping: (t: boolean) => void;
  reset: () => void;
}

const MAX_MESSAGES = 200;

const initial = {
  connection: "idle" as ConnectionStatus,
  error: null,
  sessionId: null,
  players: {},
  zone: null,
  messages: [],
  unread: 0,
  chatScope: "proximity" as ChatScope,
  chatOpen: true,
  typing: false,
};

export const useOfficeStore = create<OfficeStore>((set) => ({
  ...initial,
  setConnection: (connection, error = null) => set({ connection, error }),
  setSessionId: (sessionId) => set({ sessionId }),
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.sessionId]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.players;
      return { players: rest };
    }),
  setZone: (zone) => set({ zone }),
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
  reset: () => set(initial),
}));
