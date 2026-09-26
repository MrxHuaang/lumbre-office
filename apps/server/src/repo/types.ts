import type { ChatEvent, Direction, HumanAvatar, Look, OfficeItemDTO, PointReason, PresenceStatus } from "@hyvento/shared";

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
  /** Fase 3c: piso y papel tapiz elegidos (null = los del mapa). */
  floor: string | null;
  wallpaper: string | null;
  /** false = sus muebles son los del mapa; true = los de `items`. */
  customized: boolean;
  items: OfficeItemDTO[];
}

/** Cambio en los muebles de una oficina (ya validado con `applyDecorEdit` de @hyvento/map). */
export type OfficeItemEdit =
  | { action: "place"; type: string; x: number; y: number; facing: Direction }
  | { action: "move"; itemId: string; x: number; y: number; facing: Direction }
  | { action: "remove"; itemId: string };

export interface OfficeItemsInput {
  zoneId: string;
  /** Dueña o dueño: de su mochila sale lo que se pone y a ella vuelve lo que se quita. */
  userId: string;
  /**
   * Muebles del mapa de la oficina (ids "map-N"). Si todavía no está decorada, se copian a la base con
   * ids propios antes del cambio (y un `itemId` "map-N" se refiere a su copia).
   */
  defaults: OfficeItemDTO[];
  edit: OfficeItemEdit;
}

/** Cómo quedan los muebles, o por qué no se hizo nada (`not-owned`: no está en la mochila). */
export type OfficeItemsResult = { ok: true; items: OfficeItemDTO[] } | { ok: false; error: "not-owned" | "unknown" };

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
  /**
   * Pone, mueve o quita un mueble de una oficina, todo en una transacción: la primera vez copia los
   * muebles del mapa (y marca la oficina como decorada); poner resta 1 de la mochila (solo si hay) y
   * quitar la devuelve (+1 del tipo del mueble).
   */
  editOfficeItems(input: OfficeItemsInput): Promise<OfficeItemsResult>;
  /** Cambia piso y/o papel tapiz (lo que no venga queda igual). */
  setOfficeStyle(zoneId: string, style: { floor?: string; wallpaper?: string }): Promise<void>;
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
  /** Gasta puntos solo si alcanzan (`ok: false` = no se cobró nada). */
  spendPoints(input: { userId: string; amount: number; reason: PointReason; refId?: string }): Promise<{ ok: boolean; balance: number }>;
}
