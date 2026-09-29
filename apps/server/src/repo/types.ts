import type { ArcadeBoardEntry, ArcadeGame, BoardGameKind, BoardRankingEntry, RaceBoard, CasinoSettingsDTO, ChatEvent, Direction, HumanAvatar, Look, OfficeItemDTO, PointReason, ManualStatus, StatChange } from "@hyvento/shared";
import type { ItemStack, PetBondRecord, QuestDelta, QuestRecord } from "@hyvento/shared";

export interface AwardOnceInput {
  userId: string;
  amount: number;
  reason: PointReason;
  refId: string;
  refPrefix: string;
  maxPerDay: number;
}

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
  getUserStatus(userId: string): Promise<ManualStatus | null>;
  /** Perfil guardado (para reflejar cambios hechos desde la web sin reconectar). */
  getUserProfile(userId: string): Promise<UserProfile | null>;
  setUserStatus(userId: string, status: ManualStatus): Promise<void>;
  /** Últimos mensajes globales, del más antiguo al más reciente. */
  loadGlobalChat(limit: number): Promise<ChatEvent[]>;
  saveChat(event: ChatEvent, authorUserId: string): Promise<void>;
  /** Saldo de puntos de alguien (0 si no existe). */
  getPoints(userId: string): Promise<number>;
  /** Suma puntos respetando el tope diario del motivo; devuelve lo sumado y el saldo nuevo. */
  awardPoints(input: { userId: string; amount: number; reason: PointReason }): Promise<{ awarded: number; balance: number }>;
  /**
   * Premio que se paga una sola vez por `refId` y hasta `maxPerDay` veces por día entre los que empiezan
   * con `refPrefix` (felicitaciones de cumpleaños, bloques del modo foco). También respeta el tope del motivo.
   */
  awardPointsOnce(input: AwardOnceInput): Promise<{ status: "ok" | "duplicate" | "limit"; awarded: number; balance: number }>;
  /** Quienes pusieron su cumpleaños ("MM-DD"), para saber quién cumple hoy. */
  listBirthdays(): Promise<{ userId: string; name: string; birthday: string }[]>;
  /** Bono de bienvenida: una sola vez por persona (`granted` = se dio ahora). */
  grantWelcome(userId: string): Promise<{ granted: boolean; balance: number }>;
  /** Gasta puntos solo si alcanzan (`ok: false` = no se cobró nada). */
  spendPoints(input: { userId: string; amount: number; reason: PointReason; refId?: string }): Promise<{ ok: boolean; balance: number }>;
  /** Ajustes del casino (límite diario de pérdidas, abierto o cerrado). */
  getCasinoSettings(): Promise<CasinoSettingsDTO>;
  /** Cambios del editor de la casa, por nivel (JSON crudo: se valida al leer). */
  loadWorldEdits(): Promise<Record<string, unknown>>;
  saveWorldEdits(area: string, edits: unknown, userId: string): Promise<void>;
  /** Reloj del juego guardado tras un /time (JSON crudo: se valida al leer), o null si nunca se movió. */
  loadGameClock(): Promise<unknown>;
  saveGameClock(clock: { anchorReal: number; anchorMinute: number }, userId: string): Promise<void>;
  /** Trazos de la pizarra de una sala (JSON crudo: se valida al leer), o null si nunca se dibujó. */
  loadBoard(zoneId: string): Promise<unknown>;
  saveBoard(zoneId: string, strokes: unknown): Promise<void>;
  /** Descuenta una apuesta si alcanza el saldo. */
  casinoBet(input: { userId: string; amount: number; refId: string }): Promise<{ ok: true; balance: number } | { ok: false; error: "funds"; balance: number }>;
  /** Paga un premio del casino (o devuelve una apuesta): suma sin tope. */
  casinoPayout(input: { userId: string; amount: number; refId: string }): Promise<{ balance: number }>;
  /**
   * Pesca: guarda el pez atrapado y suma sus puntos (LEISURE, con el tope diario) en una transacción.
   * Devuelve el más grande que tenía de esa especie (null = primero), lo sumado y el saldo.
   */
  saveFishCatch(input: { userId: string; species: string; size: number; points: number }): Promise<{
    previousBest: number | null;
    awarded: number;
    balance: number;
  }>;
  /**
   * Guarda una partida del arcade (ya validada) y dice si era la primera del día de esa persona (desde
   * `dayStart`, en cualquier juego) y cuál era el récord de la semana de ese juego antes de ella (desde
   * `weekStart`; 0 si no había) y de quién (null si no había). `name` solo lo usa la versión en memoria
   * (Prisma lo lee del usuario).
   */
  saveArcadeScore(input: { userId: string; name: string; game: ArcadeGame; score: number; dayStart: number; weekStart: number }): Promise<{
    firstToday: boolean;
    weekBest: number;
    weekBestUserId: string | null;
  }>;
  /** Récords de un juego desde `since`: el mejor puntaje de cada persona, de mayor a menor. */
  arcadeBoard(input: { game: ArcadeGame; since: number; limit: number }): Promise<ArcadeBoardEntry[]>;
  /** Carrera de sillas: guarda un tiempo (ms) y la tabla de la semana (el menor tiempo de cada uno). */
  saveRaceTime(input: { userId: string; name: string; ms: number }): Promise<void>;
  raceBoard(input: { since: number; limit: number; userId: string }): Promise<RaceBoard>;
  /** Ajedrez y damas: guarda una victoria (en la tabla de récords del arcade, un punto por victoria). */
  saveBoardWin(input: { userId: string; name: string; game: BoardGameKind }): Promise<void>;
  /** Ranking de victorias de un juego desde `since`, de más a menos. */
  boardRanking(input: { game: BoardGameKind; since: number; limit: number }): Promise<BoardRankingEntry[]>;
  /** Logros: los contadores y los logros que ya tiene alguien. */
  loadAchievements(userId: string): Promise<{ stats: Record<string, number>; unlocked: string[] }>;
  /**
   * Guarda varios cambios de contadores juntos (`inc` suma, `max` se queda con el mayor), todo o nada, con
   * el avance de los encargos que salió de ellos (misma transacción).
   */
  saveStats(userId: string, changes: StatChange[], quests?: QuestDelta[]): Promise<void>;
  /** Desbloquea un logro; true solo la primera vez. */
  unlockAchievement(userId: string, achievementId: string): Promise<boolean>;
  /** Mochila: suma unidades de algo (crea la fila si no existía) y devuelve cuántas tiene ahora. */
  addInventory(userId: string, itemId: string, quantity: number): Promise<number>;
  /** Mochila: saca unidades solo si alcanzan (`false` = no tenía tantas y no se tocó nada). */
  takeInventory(userId: string, itemId: string, quantity: number): Promise<boolean>;
  /**
   * Contadores de todos con una clave que empieza así (los votos de los nombres del gallinero, que se
   * guardan como UserStat: ver `voteValue` de @hyvento/shared/granja).
   */
  loadStatsByPrefix(prefix: string): Promise<{ userId: string; key: string; value: number }[]>;
  /** Mochila: la casilla guardada de cada cosa (itemId → 0..35). */
  loadBagSlots(userId: string): Promise<Record<string, number>>;
  /** Mochila: guarda casillas nuevas o movidas y olvida las de lo que ya no está (`null`). */
  saveBagSlots(userId: string, changes: Record<string, number | null>): Promise<void>;
  /** Jardín vivo: las parcelas sembradas del huerto (las vacías no vienen). */
  loadGarden(): Promise<GardenPlotRecord[]>;
  /** Guarda una parcela sembrada, o la deja vacía (`null`: se cosechó). */
  saveGardenPlot(id: number, plot: Omit<GardenPlotRecord, "id"> | null): Promise<void>;
}

/** Una parcela del huerto como se guarda (tabla GardenPlot): `id` es el índice de la parcela. */
export interface GardenPlotRecord {
  id: number;
  crop: string;
  plantedBy: string;
  plantedByName: string;
  plantedAt: number;
  growthMs: number;
  growthAt: number;
  wateredUntil: number;
}

/** Un lado de un intercambio: lo que da esa persona (a la otra). */
export interface TradeSideInput {
  userId: string;
  points: number;
  items: ItemStack[];
}

/**
 * Resultado de un intercambio: los saldos nuevos, o quién no tenía los puntos (`funds`) o los objetos
 * (`items`), llegó al tope diario de dar puntos (`limit`) o muebles (`limit-items`) o no puso nada (`one-sided`), cuando se revalidó
 * (entonces no se movió nada).
 */
export type TradeResult =
  | { ok: true; balances: Record<string, number> }
  | { ok: false; error: "funds" | "items" | "limit" | "limit-items" | "one-sided"; userId: string };

/** Regalos e intercambios (fase 5): van en su propia interfaz y se suman a GameRepository. */
export interface SocialRepository {
  /** Lo que alguien tiene en la mochila (solo lo que tiene al menos una unidad). */
  getInventory(userId: string): Promise<ItemStack[]>;
  /** Cuántos puntos y cuántos muebles dio hoy (día de Bogotá) en regalos e intercambios: los topes diarios de dar. */
  givenToday(userId: string): Promise<{ points: number; items: number }>;
  /**
   * Intercambio en una sola transacción: cada lado paga sus puntos (motivo GIFT, dentro del tope diario
   * de dar) y saca sus objetos solo si los tiene, y la otra persona los recibe. Si algo no alcanza, no se
   * mueve nada.
   */
  executeTrade(input: { refId: string; a: TradeSideInput; b: TradeSideInput }): Promise<TradeResult>;
  /**
   * Propina del tubo en una sola transacción: quien la tira paga (GIFT, refId "tip:…", dentro del tope de
   * propinas y del de dar) y quien baila la recibe entera.
   */
  tip(input: TipInput): Promise<TipResult>;
}

export interface TipInput {
  refId: string;
  fromId: string;
  toId: string;
  amount: number;
}

/** Los saldos nuevos de los dos, o por qué no se movió nada (`limit-tips`: tope de propinas; `limit`: tope de dar). */
export type TipResult = { ok: true; balances: Record<string, number> } | { ok: false; error: "funds" | "limit" | "limit-tips" };

// Se funde con la declaración de arriba: el repositorio del juego también hace regalos e intercambios.
export interface GameRepository extends SocialRepository {}

/** Resultado de dejar una nota en una puerta: cuántas le quedan hoy a quien la dejó y cuántas sin leer tiene el dueño. */
export type DoorNoteSaveResult = { ok: true; left: number; unread: number } | { ok: false; error: "limit" };

/** Notas en la puerta (door-notes.ts de @hyvento/shared): el servidor las deja y cuenta las sin leer. */
export interface DoorNotesRepository {
  /** Guarda la nota si quien la deja no llegó al tope del día (contado en la misma transacción). */
  saveDoorNote(input: { fromId: string; toId: string; zoneId: string; text: string }): Promise<DoorNoteSaveResult>;
  /** Notas sin leer de cada persona (las que no tienen no vienen). */
  unreadDoorNotes(userIds: string[]): Promise<Record<string, number>>;
}

// También se funde con GameRepository.
export interface GameRepository extends DoorNotesRepository {}
/** Logros a la vista (la insignia del nombre) y las mascotas adoptadas: su propia interfaz, sumada a GameRepository. */
export interface ShowcaseRepository {
  /** La insignia destacada guardada (id de un logro), o null. El servidor igual revisa que la tenga. */
  getFeaturedBadge(userId: string): Promise<string | null>;
  /** Dueños y cariño de las mascotas. */
  loadPetBonds(): Promise<PetBondRecord[]>;
  /** Guarda dueño y cariño de una mascota (dueño null = vuelve a ser de la casa). */
  savePetBond(bond: PetBondRecord): Promise<void>;
}

export interface GameRepository extends ShowcaseRepository {}

/** Entregar un encargo (ver encargos.ts de @hyvento/shared): lo que paga, ya decidido por la sala. */
export interface QuestClaimInput {
  userId: string;
  questId: string;
  period: string;
  points: number;
  skill: string;
  xp: number;
  /** Historias: el paso que se abre al entregar este. */
  next?: { questId: string; goal: number };
  now: number;
}

/** Lo pagado (menos que lo prometido si llegó al tope diario) o por qué no se entregó. */
export type QuestClaimOutcome = { ok: true; awarded: number; balance: number } | { ok: false; error: "not-done" | "claimed" | "capped" };

/** Encargos: su propia interfaz, sumada a GameRepository. */
export interface QuestRepository {
  /** Los encargos guardados de alguien en esos períodos (y los de historia); antes crea los de `assign` que falten. */
  loadQuests(userId: string, periods: string[], assign: { questId: string; period: string; goal: number }[]): Promise<QuestRecord[]>;
  /** Entrega un encargo cumplido en una transacción: lo marca, paga (QUEST, con tope) y suma la experiencia. */
  claimQuest(input: QuestClaimInput): Promise<QuestClaimOutcome>;
}

export interface GameRepository extends QuestRepository {}

/** Retención del chat global (rooms/chatRetention.ts). */
export interface ChatRetentionRepository {
  /** Borra los mensajes guardados creados antes de `cutoff`; devuelve cuántos se borraron. */
  pruneChatBefore(cutoff: Date): Promise<number>;
}

export interface GameRepository extends ChatRetentionRepository {}
