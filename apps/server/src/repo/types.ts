import type { AgentChatJob, ChatEvent, PresenceStatus } from "@hyvento/shared";

export interface AgentInfoRecord {
  id: string;
  name: string;
  role: string;
  sprite: string;
  deskId: string | null;
}

export interface OfficeRecord {
  zoneId: string;
  name: string;
  ownerId: string | null;
  ownerName: string | null;
  locked: boolean;
}

/**
 * Persistencia que necesita el servidor de juego. Implementaciones:
 * - `PrismaRepository` (Postgres) en desarrollo/producción.
 * - `MemoryRepository` en tests (sin base de datos).
 */
export interface GameRepository {
  /** Crea las filas de Office que falten para las zonas `office` del mapa. */
  ensureOffices(offices: { zoneId: string; name: string }[]): Promise<void>;
  listOffices(): Promise<OfficeRecord[]>;
  setOfficeLocked(zoneId: string, locked: boolean): Promise<void>;
  getUserStatus(userId: string): Promise<PresenceStatus | null>;
  setUserStatus(userId: string, status: PresenceStatus): Promise<void>;
  /** Últimos mensajes globales, del más antiguo al más reciente. */
  loadGlobalChat(limit: number): Promise<ChatEvent[]>;
  saveChat(event: ChatEvent, authorUserId: string): Promise<void>;
  /** Agentes activos (NPCs del laboratorio). */
  listAgents(): Promise<AgentInfoRecord[]>;
}

/** Cola de trabajos para el worker de agentes (BullMQ en producción). */
export interface AgentQueue {
  enqueue(job: AgentChatJob): Promise<void>;
}
