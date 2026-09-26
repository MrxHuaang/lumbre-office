import type { ChatEvent, HumanAvatar, Look, PointReason, PresenceStatus } from "@hyvento/shared";

/** Nombre visible y personaje de una persona, como están guardados. */
export interface UserProfile {
  name: string;
  avatar: HumanAvatar;
  look: Look | null;
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
  /** Perfil guardado (para reflejar cambios hechos desde la web sin reconectar). */
  getUserProfile(userId: string): Promise<UserProfile | null>;
  setUserStatus(userId: string, status: PresenceStatus): Promise<void>;
  /** Últimos mensajes globales, del más antiguo al más reciente. */
  loadGlobalChat(limit: number): Promise<ChatEvent[]>;
  saveChat(event: ChatEvent, authorUserId: string): Promise<void>;
  /** Saldo de puntos de alguien (0 si no existe). */
  getPoints(userId: string): Promise<number>;
  /** Suma puntos respetando el tope diario del motivo; devuelve lo sumado y el saldo nuevo. */
  awardPoints(input: { userId: string; amount: number; reason: PointReason }): Promise<{ awarded: number; balance: number }>;
}

