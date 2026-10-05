import {
  allZones,
  applyDecorEdit,
  buildArea,
  canStandAt,
  canSwimAt,
  canSwimBetween,
  canWalkBetweenAxes,
  decorateAreaDef,
  checkWorldEdit,
  parseWorldEdits,
  planDef,
  setWorldEdits,
  type WorldEdits,
  defaultOfficeItems,
  storedEdit,
  BLACKJACK_SEATS,
  CONEXIONES,
  CASA_CONEXIONES,
  pointsOfType,
  BOARD_TABLES,
  getWorld,
  nearPointOfType,
  nearPortal,
  officeDoor,
  phoneInReach,
  placeAt,
  SEAT_REACH_TILES,
  seatAtPoint,
  spawnPoint,
  wallBetween,
  zoneAt,
  type AreaDecor,
  type DecorEdit,
  type OfficeMap,
  type TilePos,
  type World,
  type Zone,
} from "@hyvento/map";
import {
  BOARD_GAME,
  BoardRankingMessage,
  type BoardGameKind,
  type BoardRanking,
  type BoardResult,
  CAFE,
  CASINO,
  CafeOrderMessage,
  EMOTE,
  EmoteMessage,
  canHear,
  ChatSendMessage,
  CLOSE_CODE,
  JoinOptions,
  KNOCK_COOLDOWN_MS,
  KNOCK_TIMEOUT_MS,
  IdleMessage,
  KnockMessage,
  KnockRespondMessage,
  MoveMessage,
  MSG,
  OfficeEditMessage,
  OfficeLockMessage,
  OfficeNoteMessage,
  cleanOfficeNote,
  OfficeRadioMessage,
  type OfficeRadioError,
  type OfficeRadioResult,
  PLAYER_SPEED,
  StatusMessage,
  TravelMessage,
  POINTS,
  type PointReason,
  type PresenceStatus,
  type PointsAwarded,
  verifyGameToken,
  PERMISOS_MSG,
  permisosEfectivos,
  puede,
  type Permiso,
  type PermisosView,
  type CafeOrderResult,
  type CasinoSettingsDTO,
  type RouletteSettled,
  MESA_POINT,
  MESAS,
  type MesaId,
  type MesaSettled,
  type BlackjackSettled,
  BLACKJACK,
  type EmoteEvent,
  type ChatEvent,
  type ChatScope,
  type Direction,
  type GameTokenClaims,
  type KnockOutcome,
  type KnockRequest,
  type KnockResult,
  type MoveCorrection,
  type OfficeEditResult,
  WorldEditMessage,
  WorldEditLockMessage,
  type WorldEditLockResult,
  type WorldEditResult,
  type OfficeItemDTO,
  type Positioned,
  BarOrderMessage,
  CinemaOrderMessage,
  MENUS,
  UseHeldMessage,
  CONSUME,
  menuRefId,
  formatHeldLeft,
  DRUNK,
  type DrunkBlackoutEvent,
  menuItem,
  type FurnitureEvent,
  type HeldUsedEvent,
  type MenuId,
  CASA,
  CASA_MSG,
  type CasaNotice,
  PET,
  PET_BOND,
  PET_MSG,
  petFoodIn,
  validFeaturedBadge,
  type PetEvent,
  type PetNotice,
  ClockPingMessage,
  type ClockPong,
  drinkPart,
  parseHeldLeft,
  SWIVEL,
  SwivelMessage,
  CLUB_VIDEO,
  BOARD,
  CHAIR_RACE,
  RaceStartMessage,
  weekStart,
  type RaceEvent,
  type RaceResult,
  ClubQueueMessage,
  ClubReactMessage,
  CinemaMessage,
  type CinemaError,
  isPlaying,
  parseYoutubeId,
  type ClubError,
  type ClubReactionEvent,
  TOAST,
  ToastMessage,
  type SwivelEvent,
  type ToastResult,
  type ToastTimings,
  ALCOHOL_PER_SIP,
  STAT_KEYS,
  STAT_PREFIX,
  type AchievementUnlockedEvent,
  type FishSpecies,
  type FishingRod,
  rodCatchesKey,
  addGameTime,
  formatGameTime,
  gameTime,
  initialClock,
  parseGameClock,
  parseTimeCommand,
  pauseClock,
  resumeClock,
  setGameTime,
  estacionDelDia,
  isSeason,
  type GameClockState,
  type GameTime,
  type Season,
  BUS,
  BUS_MSG,
  BUS_TIMINGS,
  BusBoardMessage,
  BusCallMessage,
  type BusNotice,
  type BusTimings,
  AGUA,
  TINA,
  AGUA_MSG,
  isNightMinute,
  type AguaNotice,
  BIRTHDAY,
  CongratsMessage,
  congratsRef,
  congratsRefPrefix,
  eventDay,
  FOCUS,
  focusMs,
  focusRefPrefix,
  type CongratsEvent,
  type CongratsResult,
  type FocusEvent,
  type FocusPresetId,
  type ManualStatus,
  PHONE,
  PhoneAnswerMessage,
  PhoneCallMessage,
  type PhoneError,
  type PhoneEvent,
  SOMBRERO,
  SombreroBuyMessage,
  sombreroItem,
  sombreroRefId,
  TRIP,
  tripSpeedMul,
  type SombreroBuyResult,
} from "@hyvento/shared";
import { Room, ServerError, type Client, type Deferred } from "colyseus";
import { randomInt, randomUUID } from "node:crypto";
import type { GameRepository, OfficeItemsResult, OfficeRecord } from "../repo/types";
import { FarmAnimal, GardenPlotState, GrillJob, MesaState, OfficeInfo, OfficeItem, OfficeState, Pet, Player } from "../state";
import { acceptCasinoMessage } from "./casino/common";
import { BlackjackTable, randomShoe, type BlackjackTimings } from "./casino/blackjack";
import { randomSpin, RouletteTable, type RouletteTimings } from "./casino/roulette";
import { Bag } from "./bag";
import { DEFAULT_MESA_TIMINGS, MesaTable, parseMesaBet, randomMesaDraw, type MesaTimings } from "./casino/mesas";
import { OpenRounds } from "./casino/recovery";
import { settleAll } from "./shutdown";
import { Drunkenness } from "./drunk";
import { DEFAULT_SWIVEL_TIMINGS, Swivels, type SwivelTimings } from "./swivels";
import { Toasts, type Toaster } from "./toasts";
import { devToolsEnabled, parseCasaJump, parseDevFestival, parseDevJump, parseDevSombrero, parseDevWeather } from "./devtools";
import { Festivales } from "./festivales";
import { NocheBrujas } from "./nocheBrujas";
import { festivalDecorAreas, setFestivalDecor } from "@hyvento/map";
import { BRUJAS_CINE, BRUJAS_MSG, FESTIVAL_MSG, brujasActiva, fechaDelJuego, type BrujasBuyResult, type FestivalCineEvent, type PumpkinResult, type TrickResult } from "@hyvento/shared";
import { WeatherCycle } from "./weather";
import { FurnitureUses } from "./usables";
import { FISHING, initialWeather, type FishingTimings, type Weather } from "@hyvento/shared";
import { Fishery } from "./fishing";
import { PESCA_MSG, type PescaBuyResult, type PescaSoldEvent } from "@hyvento/shared";
import { LEISURE_MSG, type LeisureState } from "@hyvento/shared";
import { RECHAZO_MSG, type RechazoCode, type RechazoNotice } from "@hyvento/shared";
import { PescaStand } from "./pescaTienda";
import { CAPITULOS, QUEST_MSG, currentQuests, dailyPeriod, weeklyPeriod, type ActiveQuest, type Capitulo, type QuestClaimResult, type QuestSeasons } from "@hyvento/shared";
import { encargosDeSala, type Encargos } from "./encargos";
import { bindHistoria } from "./historia";
import { isNewcomer } from "@hyvento/shared";
import { bindOficios, oficiosDeSala, type Oficios } from "./oficios";
import { acceptEmote, TRADE, type GiftReceived, type GiftSentNotice, type SystemNotice } from "@hyvento/shared";
import { Trades } from "./trades";
import { CasaViva } from "./casa";
import { Pets, type PetUser } from "./mascotas";
import { Arcade } from "./arcade";
import { BoardGames } from "./boardGames";
import { HockeyTable } from "./hockey";
import { Club, musicOf, type ClubWho } from "./club";
import { ClubTips } from "./clubTips";
import { Cinema } from "./cinema";
import { Escenario } from "./escenario";
import { Podcast, type Inside, type PodcastNotices } from "./podcast";
import {
  ESCENARIO,
  ESCENARIO_MSG,
  FloorMessage,
  HandMessage,
  PODCAST,
  PODCAST_MSG,
  PodcastConsentMessage,
  StageMessage,
  stageRole,
  type ApplauseEvent,
  type EscenarioNotice,
  type EscenarioNoticeCode,
  type PodcastNotice,
} from "@hyvento/shared";
import { FALLBACK_TITLE, lookupYoutube, type YoutubeLookup } from "./youtube";
import { Whiteboards, type BoardWho } from "./whiteboards";
import { ChairRaces, RaceBoards, type RaceOutcome } from "./races";
import { PHOTO_TIMINGS, PhotoBooth } from "./photos";
import { AchievementTracker } from "./achievements";
import { DoorNotes } from "./door-notes";
import { Invites } from "./invites";
import { CabinEvents } from "./events";
import { FocusTimers } from "./focus";
import { Phones } from "./phones";
import { registerComunicacion, type Comunicacion } from "./comunicacion";
import { HUERTO_MSG, type HuertoNotice } from "@hyvento/shared";
import { BAG, BAG_MSG, CELULAR_ITEM, BagDropMessage, BagMoveMessage, BagSelectMessage, bagItemsOf, isStoryItem, objIdOf, objItemId, type BagNotice, type BagView } from "@hyvento/shared";
import { Huerto, isHuertoAction } from "./huerto";
import { CASA_ARBOL, CASA_ARBOL_MSG, type CasaArbolNotice } from "@hyvento/shared";
import { CasaArbol } from "./casaArbol";
import {
  CASA_FIESTA,
  CASA_FIESTA_MSG,
  CasaFiestaMessage,
  CasaRadioMessage,
  fiestaAnnouncement,
  CASA_MODO_DEFAULT,
  CASA_PROPIA_MSG,
  casaAreaOf,
  CasaKickMessage,
  CasaModoMessage,
  casaOwnerOf,
  isCasaArea,
  isCasaModo,
  statAreaOf,
  type CasaAcceso,
  type CasaPropiaNotice,
} from "@hyvento/shared";
import { CasaState } from "../state";
import { CasasPropias } from "./casaPropia";
import { BusLine, type BusSchedule } from "./bus";
import { Piscina } from "./piscina";
import { Tina } from "./tina";
import { Observatorio } from "./observatorio";
import { MARSHMALLOW, OBS_MSG, SKY, type MarshmallowTimings, type SignalPing, type SkyTimings } from "@hyvento/shared";
import { COCINA_MSG, isWet, type CocinaNotice, type CocinaState } from "@hyvento/shared";
import { Cocina, type CocinaResult } from "./cocina";
import {
  GALLINERO,
  GRANJA_MSG,
  GRANJA_STATS,
  isGameNight,
  isGranjaAction,
  PARRILLA_MSG,
  type CoopState,
  type GranjaNotice,
  type GrillNotice,
  type GrillState,
  type PortionShared,
} from "@hyvento/shared";
import { Granja } from "./granja";
import { Parrilla, type GrillWho } from "./parrilla";
import { ManDelSombrero } from "./sombrero";
import { Trips, type TripTimings } from "./trips";
import { PresenceTracker } from "./presence";
import { nearUsable, registerMundo, type MundoHandle, type MundoRoom } from "./mundo";
import { DECOR_SCOPES, isMundoAction } from "@hyvento/shared";
import { inRowboat } from "@hyvento/map";
import { VIAJE, VIAJE_MSG, type ViajeNotice } from "@hyvento/shared";
import { QuickTravel } from "./viaje";
import { RECONNECT_WINDOW_SECONDS } from "@hyvento/shared";
import { closeForRestart } from "./reinicio";
import { startChatRetention } from "./chatRetention";
import { orElse } from "../log";
import { MSG_RATE, newBucket, takeToken, type RateConfig, type TokenBucket } from "@hyvento/shared";

interface UserData {
  lastMoveAt: number;
  chatTimes: number[];
  /** Última actividad real (mouse, teclado, moverse): sin ella no se ganan puntos de presencia. */
  lastActiveAt: number;
  /** Último pedido en la cafetería (para no cobrar dos veces por un doble clic). */
  lastOrderAt?: number;
  /** Cambios recientes en el editor de oficina (tope para no inundar la base). */
  editTimes?: number[];
  /** Último emote (para que no se puedan mandar en ráfaga). */
  lastEmoteAt?: number;
  /** Admin del equipo (tiene todos los permisos y además /time). */
  admin?: boolean;
  /** Permisos efectivos (ver permisos.ts de @hyvento/shared); se releen en caliente si un admin los cambia. */
  permisos?: Permiso[];
  /** Emotes aceptados hace poco (pausa entre uno y otro y tope por ráfaga, ver `acceptEmote`). */
  emoteTimes?: number[];
  /** Mensajes recientes al casino (tope por ráfaga, ver `acceptCasinoMessage`). */
  casinoTimes?: number[];
  /** Última compra al Man del Sombrero (para no cobrar dos veces por un doble clic). */
  lastSombreroAt?: number;
}

/** Lo que el modo foco cambió al empezar un bloque, para devolverlo al terminar (si nadie lo tocó). */
interface FocusClaim {
  /** Estado de antes (no se toca si ya estaba en "No molestar"). */
  status?: ManualStatus;
  /** Oficina que el foco cerró (estaba abierta). */
  lockedZone?: string;
  /** Nota que tenía la placa de su oficina. */
  note?: { zoneId: string; prev: string };
}

interface PendingKnock {
  requestId: string;
  zoneId: string;
  requesterSessionId: string;
  requesterUserId: string;
  timer: { clear(): void };
}

const CHAT_HISTORY_SIZE = 50;
const CHAT_RATE = { max: 5, windowMs: 5_000 };
const EDIT_RATE = { max: 10, windowMs: 3_000 };
const RECONNECT_SECONDS = RECONNECT_WINDOW_SECONDS;
/** Hasta qué distancia (en tiles) se busca lugar para quien quedó dentro de un mueble. */
const UNSTICK_RADIUS = 6;

const itemDTO = (i: OfficeItem): OfficeItemDTO => ({ id: i.id, type: i.type, x: i.x, y: i.y, facing: i.facing as Direction });

function gameTokenSecret() {
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) throw new Error("Falta GAME_TOKEN_SECRET en el entorno");
  return secret;
}

export class OfficeRoom extends Room<OfficeState, unknown, UserData> {
  /** Persistencia inyectada por `createGameServer`. */
  static repo: GameRepository;
  /** Salas vivas, para propagar cambios externos (p. ej. reasignación de oficinas). */
  static readonly instances = new Set<OfficeRoom>();

  static async reloadOfficesEverywhere() {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadOffices()));
  }

  /** La web cambió el saldo de alguien (buzón, misiones): refrescarlo en vivo. */
  static async reloadPointsEverywhere(userId: string) {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadPoints(userId)));
  }

  /** Cada cuánto se reparten puntos de presencia y cuánto dura la actividad (los tests los acortan). */
  static presenceTickMs: number = POINTS.tickMs;
  static idleMs: number = POINTS.idleMs;
  /** Pausa entre dos usos de lo que se tiene en la mano (los tests la acortan). */
  static consumeCooldownMs: number = CONSUME.cooldownMs;
  /** Tiempos de la ruleta y de dónde sale el número (los tests los acortan y fijan el resultado). */
  static rouletteTimings: RouletteTimings = { ...CASINO.roulette };
  static rouletteSpin: () => number = randomSpin;
  static blackjackTimings: BlackjackTimings = { ...BLACKJACK };
  static blackjackShuffle: () => number[] = randomShoe;
  /** Baccarat, dados y caballitos: tiempos y resultado (los tests los acortan y los fijan). */
  static mesaTimings: MesaTimings = { ...DEFAULT_MESA_TIMINGS };
  static mesaDraw: (table: MesaId) => number[] = randomMesaDraw((n) => randomInt(n));
  /** Pesca: el azar (entero en [0, n)), el reloj real (para los tiempos del minijuego) y los tiempos del lance. */
  static fishingRandom: (n: number) => number = (n) => randomInt(n);
  static fishingNow: () => number = () => Date.now();
  static fishingTimings: FishingTimings = { ...FISHING };
  /** Reloj de las compras del puesto de pesca (los tests lo corren para saltarse la pausa). */
  static pescaNow: () => number = () => Date.now();
  /** La Noche de brujas: el azar del dulce o truco y el reloj de la pausa (los tests los fijan). */
  static brujasRandom: (n: number) => number = (n) => randomInt(n);
  static brujasNow: () => number = () => Date.now();
  /**
   * Dar la canasta de dulce o truco al entrar y al abrir la Noche de brujas. Los tests lo apagan
   * (test/setup.ts: el reloj real puede caer en el festival y cambiarles la mano); noche-brujas.test.ts lo prende.
   */
  static brujasCanasta = true;
  /** Encargos: el reloj (día de Bogotá) y qué le toca a cada quien (los tests lo fijan). */
  static encargosNow: () => number = () => Date.now();
  static encargosPick: (userId: string, now: number, seasons: QuestSeasons) => ActiveQuest[] = currentQuests;
  /** Los capítulos de la historia (los tests ponen los suyos para probar el motor; ver historia.ts). */
  static encargosChapters: readonly Capitulo[] = CAPITULOS;
  /** Oficios: el azar de las ventajas (la cosecha doble) y el reloj (los tests lo fijan). */
  static oficiosRandom: (n: number) => number = (n) => randomInt(n);
  static oficiosNow: () => number = () => Date.now();
  /** Casa viva: el azar de las mascotas y cuánto se está en el baño (los tests los fijan y acortan). */
  static petRandom: () => number = Math.random;
  static stallMs: number = CASA.stallMs;
  /** Reloj del huerto (los tests lo adelantan para que crezca lo sembrado). */
  static huertoNow: () => number = () => Date.now();
  /** Semilla de cada partida del arcade (los tests la fijan). */
  static arcadeSeed: () => number = () => randomInt(2 ** 31);
  /** Reloj del arcade (los tests lo adelantan para no esperar la duración mínima de una partida). */
  static arcadeNow: () => number = () => Date.now();
  /** Azar del clima y con cuál arranca (los tests los fijan); `weatherInitial` null = según la hora del juego. */
  static weatherRandom: () => number = () => randomInt(2 ** 30) / 2 ** 30;
  static weatherInitial: Weather | null = null;
  /** Reloj real para el reloj del juego y hora con la que arranca (los tests los fijan; null = la de Bogotá). */
  static gameClockNow: () => number = () => Date.now();
  static gameClockInitial: GameClockState | null = null;
  /** Cada cuánto se guarda el reloj mientras corre (por si un deploy reinicia sin avisar). */
  static clockSaveMs = 5 * 60_000;
  /** Observatorio: el reloj y el azar de la fogata y de las estrellas fugaces, y sus tiempos (los tests los fijan). */
  static observatorioNow: () => number = () => Date.now();
  static observatorioRandom: (n: number) => number = (n) => randomInt(n);
  static marshmallowTimings: MarshmallowTimings = { ...MARSHMALLOW };
  static skyTimings: SkyTimings = { ...SKY };
  /** Man del Sombrero: el azar del escondite de cada día (entero en [0, n)) y cada cuánto se revisa. */
  static sombreroRandom: (n: number) => number = (n) => randomInt(n);
  static sombreroTickMs = 1000;
  /** Duración de los efectos de la mercancía (los tests la acortan). */
  static tripTimings: TripTimings = { scale: 1, maxMs: TRIP.maxMs };
  /** Cada cuánto se guardan juntas las estadísticas de los logros (los tests lo acortan). */
  static statsFlushMs = 20_000;
  /** Límite de mensajes por cliente (ver limite-mensajes.ts); null = sin límite (los tests lo apagan en setup.ts). */
  static msgRate: RateConfig | null = MSG_RATE;
  /**
   * Dar el celular al entrar a quien no lo tiene. Los tests lo apagan (test/setup.ts) para que la mochila
   * tenga solo lo que cada uno pone; test/celular.test.ts lo prende.
   */
  static celularAlEntrar = true;
  /** Tiempos y horario del Megabús (los tests los acortan). */
  static busTimings: BusTimings = { ...BUS_TIMINGS };
  static busSchedule: BusSchedule = { firstInMs: BUS.firstInMs, maxWaitMs: BUS.maxWaitMs };
  /** La piscina: cuánto se queda mojado, cada cuánto da puntos el sol y cada cuánto se revisa (los tests los acortan). */
  static aguaTimings: { wetMs: number; tickMs: number; diveCooldownMs: number; checkMs: number } = {
    wetMs: AGUA.wetMs,
    tickMs: AGUA.tickMs,
    diveCooldownMs: AGUA.diveCooldownMs,
    checkMs: AGUA.checkMs,
  };
  /** La tina y la sauna del lago: cada cuánto da puntos el descanso y cada cuánto se revisa (los tests los acortan). */
  static tinaTimings: { tickMs: number; checkMs: number } = { tickMs: TINA.tickMs, checkMs: TINA.checkMs };

  /** Otra sala guardó un cambio del editor de la casa: se aplica acá también. */
  static applyWorldEditsEverywhere(area: string, edits: WorldEdits) {
    for (const r of OfficeRoom.instances) r.applyWorldEdits(area, edits);
  }

  /** Se subió o se borró una foto (lo avisa la web): todos vuelven a pedir la lista del tablón. */
  static broadcastPhotosChanged() {
    for (const r of OfficeRoom.instances) r.broadcast(MSG.photosChanged, {});
  }

  /** Notas en la puerta: la cuenta de las sin leer de alguien en todas las salas (post-its de su puerta). */
  static setDoorNotesEverywhere(ownerId: string, unread: number) {
    for (const r of OfficeRoom.instances) r.setDoorNotes(ownerId, unread);
  }

  /** El dueño leyó o borró notas desde la web: se vuelven a contar. */
  static async reloadDoorNotesEverywhere(userId: string) {
    const counts = await OfficeRoom.repo.unreadDoorNotes([userId]);
    OfficeRoom.setDoorNotesEverywhere(userId, counts[userId] ?? 0);
  }

  /** Cuenta regresiva y pausa entre fotos (los tests las acortan). */
  static photoTimings: { countdownMs: number; cooldownMs: number } = { ...PHOTO_TIMINGS };
  /** Reloj de la pausa entre fotos (los tests lo fijan: con la máquina cargada los mensajes llegan tarde). */
  static photoNow: () => number = () => Date.now();

  /** Reloj de los eventos del calendario (los tests lo fijan en un cumpleaños o un viernes de noche). */
  static eventsNow: () => number = () => Date.now();
  /** Cada cuánto se revisan (los tests lo acortan). */
  static eventsRefreshMs = 30_000;
  /** Duración de las fases del modo foco (los tests la acortan). */
  static focusPhaseMs: (preset: FocusPresetId, phase: "work" | "break") => number = focusMs;

  /** Relee los ajustes del casino en todas las salas (los cambió un admin en /admin). */
  static async reloadCasinoSettingsEverywhere() {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadCasinoSettings()));
  }

  maxClients = 64;
  patchRate = 50; // 20 Hz

  /** Niveles de esta sala: los del mapa, con el piso 2 rearmado según la decoración de las oficinas. */
  private world!: World;
  private zonesById = new Map<string, Zone>();
  /** Nivel de cada zona (para saber qué nivel rearmar al decorar una oficina). */
  private areaOfZone = new Map<string, string>();
  /** Los cambios de decoración (y las recargas de oficinas) van de a uno: cada uno valida sobre el anterior. */
  private decorQueue: Promise<unknown> = Promise.resolve();
  private globalHistory: ChatEvent[] = [];
  private pendingReconnections = new Map<string, Deferred<Client>>();
  private pendingKnocks = new Map<string, PendingKnock>();
  private lastKnockAt = new Map<string, number>(); // `${userId}:${zoneId}` → ts
  /**
   * La mochila de cada persona (ver bag.ts): lo que tiene, sus casillas y la elegida en la barra, que es
   * lo que lleva en la mano (`Player.held`). Por userId: lo empezado sobrevive a recargar la página.
   */
  private held = new Bag({
    repo: () => this.repo,
    onHeld: (userId, item, left) => {
      for (const p of this.state.players.values())
        if (p.userId === userId) {
          p.held = item;
          p.heldLeft = formatHeldLeft(left);
        }
    },
    onBag: (userId, view) => this.sendToUser(userId, BAG_MSG.state, view satisfies BagView),
    cooldownMs: () => OfficeRoom.consumeCooldownMs,
  });
  /** Cuánto alcohol lleva cada persona (por userId: recargar no te deja sobrio). */
  private drunk = new Drunkenness(
    { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
    () => Date.now(),
    {
      onChange: (userId, stage) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.drunk = stage;
      },
      onBlackout: (userId) => this.blackout(userId),
      onWake: (userId) => this.wakeToRest(userId),
    },
    () => OfficeRoom.faintMs,
  );
  /** Con qué hora del juego arranca la sala (el clima inicial ya la necesita, antes de onCreate). */
  private readonly startClock: GameClockState = OfficeRoom.gameClockInitial ?? initialClock();
  /** El clima de afuera (lo ven todos: `state.weather`); la niebla sigue la hora del juego. */
  private weather = new WeatherCycle(
    {
      clock: { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      hour: () => this.gameTimeNow().hour,
      season: () => this.gameSeason(),
      random: () => OfficeRoom.weatherRandom(),
      onChange: (w) => {
        this.state.weather = w;
        // Con lluvia se tapa la piscina y salen todos del agua.
        this.piscina?.weatherChanged(w);
        // La lluvia riega sola el huerto (y sigue regando mientras dure: ver el intervalo de onCreate).
        if (isWet(w)) this.rainOnGarden();
        // Con la tormenta sale el Man del Sombrero (y se va cuando escampa, si no es su hora).
        this.sombrero?.refresh();
      },
    },
    OfficeRoom.weatherInitial ?? initialWeather(gameTime(this.startClock, OfficeRoom.gameClockNow()).hour),
  );
  /** Lo que dura un desmayo (los tests lo acortan). */
  static faintMs: number = DRUNK.faintMs;
  /** Lo que le hizo a cada uno la mercancía del Man del Sombrero (por userId). */
  private trips = new Trips(
    { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
    () => Date.now(),
    (userId, kind, until) => {
      for (const p of this.state.players.values())
        if (p.userId === userId) {
          p.trip = kind;
          p.tripUntil = until;
        }
    },
    () => OfficeRoom.tripTimings,
  );
  /** El Man del Sombrero: si está y en qué escondite (`state.sombrero`). */
  private sombrero!: ManDelSombrero;
  /** Tiempos del brindis (los tests los acortan). */
  static toastTimings: ToastTimings = { ...TOAST };
  /** Brindis abiertos: invitaciones que se vencen y grupos que chocan los vasos. */
  private toasts = new Toasts(
    { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
    () => Date.now(),
    {
      person: (userId) => {
        for (const [sessionId, p] of this.state.players) if (p.userId === userId) return this.toaster(sessionId, p);
        return undefined;
      },
      people: (area) => [...this.state.players].filter(([, p]) => p.area === area).map(([id, p]) => this.toaster(id, p)),
      send: (area, event) => this.sendToArea(area, MSG.toastEvent, event),
      sip: (userId) => this.toastSip(userId),
    },
    () => OfficeRoom.toastTimings,
  );
  /** Cómo se averigua el título de un video de YouTube (los tests no salen a internet). */
  static youtubeLookup: YoutubeLookup = lookupYoutube;
  /** Cuánto se espera sin cambios para guardar una pizarra (los tests lo acortan). */
  static boardSaveDelayMs: number = BOARD.saveDelayMs;
  /** Pizarras de las oficinas y de la sala de reuniones (ver whiteboards.ts). */
  private whiteboards = new Whiteboards(
    {
      send: (sessionId, type, msg) => this.clients.getById(sessionId)?.send(type, msg),
      load: (board) => this.repo.loadBoard(board),
      save: (board, strokes) => this.repo.saveBoard(board, strokes),
      later: (ms, fn) => this.clock.setTimeout(fn, ms),
      saveDelayMs: () => OfficeRoom.boardSaveDelayMs,
    },
    { state: MSG.boardState, stroke: MSG.boardStrokeEvent, remove: MSG.boardRemove },
  );
  /** La carrera de sillas del pasillo del piso 2 (ver races.ts). */
  private races = new ChairRaces();
  private raceBoards = new RaceBoards((userId, since) => this.repo.raceBoard({ since, limit: CHAIR_RACE.boardSize, userId }));
  /** Cuándo puede volver a reaccionar cada persona en el club. */
  private reactAt = new Map<string, number>();
  /** Tiempos de las sillas giratorias y cuántas vueltas da cada giro (los tests los fijan). */
  static swivelTimings: SwivelTimings = { ...DEFAULT_SWIVEL_TIMINGS };
  static swivelTurns: () => number = () => randomInt(SWIVEL.minTurns, SWIVEL.maxTurns + 1);
  private swivels = new Swivels(
    () => OfficeRoom.swivelTurns(),
    () => OfficeRoom.swivelTimings,
  );
  /** Muebles que se usan (tele, lámparas, instrumentos, gato). */
  private furnitureUses!: FurnitureUses;
  /** La pesca en el lago del jardín (ver fishing.ts). */
  private fishery = new Fishery({
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    now: () => OfficeRoom.fishingNow(),
    random: (n) => OfficeRoom.fishingRandom(n),
    timings: () => OfficeRoom.fishingTimings,
    hour: () => this.gameTimeNow().hour,
    weather: () => this.state.weather as Weather,
    repo: () => this.repo,
    newId: () => randomUUID(),
    setPhase: (userId, phase) => {
      for (const p of this.state.players.values()) if (p.userId === userId) p.fishing = phase;
    },
    send: (userId, event) => {
      for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.fishEvent, event);
    },
    points: (userId, awarded, balance) => {
      for (const c of this.clients) {
        const p = this.state.players.get(c.sessionId);
        if (p?.userId !== userId) continue;
        p.points = balance;
        if (awarded > 0) c.send(MSG.pointsAwarded, { amount: awarded, reason: "LEISURE", balance } satisfies PointsAwarded);
      }
      this.achievements.max(userId, STAT_KEYS.pointsPeak, balance);
      void this.sendLeisure(userId);
    },
    rodCatches: (userId, rod) => this.achievements.stat(userId, rodCatchesKey(rod)) ?? 0,
    caught: (userId, fish, size, first, treasure, rod) => this.fishCaught(userId, fish, size, first, treasure, rod),
  });
  /** El puesto de pesca del lago: las compras y el equipo de cada lance (ver pescaTienda.ts). */
  private pesca = new PescaStand({ repo: () => this.repo, held: this.held, now: () => OfficeRoom.pescaNow() });
  /** La Noche de brujas: la canasta, el dulce o truco, la calabaza dorada y el puesto (ver nocheBrujas.ts). */
  private brujas = new NocheBrujas({
    festival: () => ({ id: this.state.festival, fase: this.state.festivalFase, day: this.gameTimeNow().day, año: fechaDelJuego(this.gameTimeNow().day).año }),
    mapOf: (area) => this.mapOf(area),
    held: this.held,
    // Los contadores se crean más abajo: se piden al usarlos.
    stats: {
      stat: (u, k) => this.achievements.stat(u, k),
      max: (u, k, v) => this.achievements.max(u, k, v),
      bump: (u, k, by) => this.achievements.bump(u, k, by),
      isLoaded: (u) => this.achievements.isLoaded(u),
    },
    repo: () => this.repo,
    now: () => OfficeRoom.brujasNow(),
    random: (n) => OfficeRoom.brujasRandom(n),
  });
  /** Estadísticas y logros (ver achievements.ts): se suman en memoria y se guardan juntas. */
  private achievements: AchievementTracker = new AchievementTracker({
    repo: () => this.repo,
    onUnlock: (userId, achievement) => {
      for (const [sessionId, p] of this.state.players) {
        if (p.userId !== userId) continue;
        this.sendToArea(p.area, MSG.achievementUnlocked, { sessionId, name: p.name, achievementId: achievement.id } satisfies AchievementUnlockedEvent);
      }
    },
    quests: { onStat: (u, key, by) => (this.encargos.onStat(u, key, by), this.oficios.onStat(u, key, by)), take: (u) => this.encargos.take(u), restore: (u, d) => this.encargos.restore(u, d) },
    // Lo que sumó la web (regalos, misiones, fotos) también da experiencia de oficio.
    onExternal: (u, key, by) => this.oficios.onStat(u, key, by),
  });
  /** Encargos del tablón y de los personajes (ver encargos.ts): avanzan con los contadores y se entregan con E. */
  private encargos: Encargos = encargosDeSala({ room: this, repo: () => this.repo, held: this.held, stats: this.achievements, minuteOfDay: () => this.gameTimeNow().minuteOfDay, mapOf: (a) => this.mapOf(a), now: () => OfficeRoom.encargosNow(), pick: (u, t) => OfficeRoom.encargosPick(u, t, this.questSeasons(t)), xp: (u, o, xp) => this.oficios.credit(u, o, xp), chapters: OfficeRoom.encargosChapters });
  /** Oficios con nivel (ver oficios.ts): la experiencia de las acciones y los encargos, y las ventajas. */
  private oficios: Oficios = oficiosDeSala({ room: this, repo: () => this.repo, held: this.held, stats: this.achievements, now: () => OfficeRoom.oficiosNow(), random: (n) => OfficeRoom.oficiosRandom(n), hideout: () => this.sombrero?.hideout?.place ?? null, areas: () => [...this.world.areas.values()].map((a) => ({ id: a.id, name: a.name })), tileSize: 32 });

  /** Fotos: la cuenta 3-2-1, quiénes salen y el ticket para subirla (ver photos.ts). */
  private photos = new PhotoBooth({
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    now: () => OfficeRoom.photoNow(),
    newId: () => randomUUID(),
    secret: gameTokenSecret,
    timings: () => OfficeRoom.photoTimings,
    subject: (sessionId) => {
      const p = this.state.players.get(sessionId);
      return p ? { sessionId, userId: p.userId, name: p.name, area: p.area, x: p.x, y: p.y } : null;
    },
    inArea: (area) =>
      [...this.state.players.entries()]
        .filter(([, p]) => p.area === area)
        .map(([sessionId, p]) => ({ sessionId, userId: p.userId, name: p.name, area: p.area, x: p.x, y: p.y })),
    toArea: (area, type, message) => {
      for (const c of this.clients) if (this.state.players.get(c.sessionId)?.area === area) c.send(type, message);
    },
    toSession: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
    messages: { countdown: MSG.photoCountdown, shot: MSG.photoShot, flash: MSG.photoFlash },
  });
  /** Notas en la puerta de las oficinas (ver door-notes.ts). */
  /** Invitaciones desde la lista de Conectados ("te invita a su oficina"). */
  private invites = new Invites({
    person: (sessionId) => {
      const p = this.state.players.get(sessionId);
      return p ? { userId: p.userId, name: p.name, status: p.status as PresenceStatus } : null;
    },
    sessionOfUser: (userId) => this.clientOfUser(userId)?.sessionId ?? null,
    placeOf: (sessionId) => {
      const p = this.state.players.get(sessionId);
      // En su propia casa: invitar deja pasar y lleva hasta allá (las salas de la casa no cuentan aparte).
      if (p && casaOwnerOf(p.area) === p.userId) return { place: "casa", placeName: "su casa", casaOwnerId: p.userId };
      const zone = p?.zoneId ? this.zonesById.get(p.zoneId) : undefined;
      if (!p || !zone) return { place: "here", placeName: "" };
      const office = zone.type === "office" ? this.state.offices.get(zone.id) : undefined;
      if (office?.ownerId === p.userId) return { place: "office", placeName: zone.name, officeZoneId: zone.id };
      return { place: "zone", placeName: zone.name };
    },
    send: (sessionId, type, payload) => this.clients.getById(sessionId)?.send(type, payload),
    letIn: (zoneId, ownerUserId, userId) => {
      const office = this.state.offices.get(zoneId);
      if (office?.ownerId === ownerUserId && office.locked && !office.guests.includes(userId)) office.guests.push(userId);
    },
    letInCasa: (ownerUserId, userId) => this.letInCasa(ownerUserId, userId),
    setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms),
    now: () => Date.now(),
  });

  private doorNotes = new DoorNotes({
    repo: () => this.repo,
    author: (sessionId) => {
      const p = this.state.players.get(sessionId);
      return p ? { userId: p.userId, area: p.area, x: p.x, y: p.y } : null;
    },
    office: (zoneId) => {
      const office = this.state.offices.get(zoneId);
      const zone = this.zonesById.get(zoneId);
      const area = this.areaOfZone.get(zoneId);
      if (!office || !zone?.door || !area) return null;
      return { ownerId: office.ownerId, ownerName: office.ownerName, area, door: officeDoor(zone) };
    },
    reply: (sessionId, result) => this.clients.getById(sessionId)?.send(MSG.doorNoteResult, result),
    setUnread: (ownerId, unread) => OfficeRoom.setDoorNotesEverywhere(ownerId, unread),
  });
  /** Intercambios en vivo entre dos personas cerca (fase 5). */
  private trades = new Trades({
    player: (sessionId) => this.state.players.get(sessionId),
    send: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
    repo: () => this.repo,
    setPoints: (userId, balance) => {
      for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      // Se hizo el intercambio: los objetos pasaron de una mochila a la otra.
      void this.held.load(userId);
    },
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    inviteTimeoutMs: () => OfficeRoom.tradeInviteMs,
  });
  /** Cuánto suena el teléfono antes de darse por no contestado (los tests lo acortan). */
  static phoneRingMs: number = PHONE.ringMs;
  /** Llamadas entre oficinas (ver phones.ts): el estado queda en `Player.call` y `callWith`. */
  private phones = new Phones({
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    now: () => Date.now(),
    newId: () => randomUUID(),
    ringMs: () => OfficeRoom.phoneRingMs,
    send: (userId, event) => {
      for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.phoneEvent, event);
    },
    setPhase: (userId, phase, withUserId, since, callId) => {
      for (const p of this.state.players.values())
        if (p.userId === userId) {
          p.call = phase;
          p.callWith = withUserId;
          p.callSince = since;
          p.callId = callId;
        }
    },
  });
  /** Cuánto espera una invitación a intercambiar (los tests lo acortan). */
  static tradeInviteMs: number = TRADE.requestTimeoutMs;

  /** La web avisó que alguien mandó un regalo: si quien lo recibe está conectado, le llega el aviso. */
  static giftReceivedEverywhere(notice: GiftSentNotice) {
    const { toId, ...gift } = notice;
    for (const room of OfficeRoom.instances)
      for (const c of room.clients) if (room.state.players.get(c.sessionId)?.userId === toId) c.send(MSG.giftReceived, gift satisfies GiftReceived);
  }
  /**
   * La web mandó un aviso del sistema (p. ej. un PR mezclado en GitHub): va al chat global de todas las
   * salas. Sin autor (fromId vacío) y sin guardar en la base, que exige autor; queda en el historial en memoria.
   */
  static systemNoticeEverywhere(notice: SystemNotice) {
    const event: ChatEvent = { id: randomUUID(), fromId: "", fromName: notice.from, text: notice.text, scope: "global", zoneId: null, ts: Date.now() };
    for (const room of OfficeRoom.instances) {
      room.globalHistory.push(event);
      if (room.globalHistory.length > CHAT_HISTORY_SIZE) room.globalHistory.shift();
      room.broadcast(MSG.chatEvent, event);
    }
  }
  /** Cumpleaños y viernes de karaoke (ver events.ts). */
  private events!: CabinEvents;
  /** Modo foco: el reloj de cada pomodoro y lo que cambió al empezar (ver focus.ts). */
  private focusClaims = new Map<string, FocusClaim>();
  /** Estados automáticos: "Ausente" por inactividad y "En reunión" (ver presence.ts). */
  private autoStatus = new PresenceTracker(
    { get: (id) => this.state.players.get(id), entries: () => this.state.players.entries() },
    (zoneId) => this.zonesById.get(zoneId)?.type === "meeting",
  );
  private focus = new FocusTimers({
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    now: () => Date.now(),
    phaseMs: (preset, phase) => OfficeRoom.focusPhaseMs(preset, phase),
    show: (userId, phase, endsAt, preset) => {
      for (const p of this.state.players.values())
        if (p.userId === userId) {
          p.focus = phase;
          p.focusEndsAt = endsAt;
          p.focusPreset = preset;
        }
    },
    claim: (userId) => this.claimFocus(userId),
    release: (userId) => this.releaseFocus(userId),
    award: (userId) => this.awardFocus(userId),
    send: (userId, event: FocusEvent) => this.sendToUser(userId, MSG.focusEvent, event),
  });
  /** Casa viva: lo gratis que queda en la mano, los cubículos del baño y las mascotas. */
  private casa!: CasaViva;
  private pets!: Pets;
  /** El club del sótano (música, pista y tubo) y el arcade. */
  private club!: Club;
  /** Las propinas a quien baila en el tubo. */
  private clubTips!: ClubTips;
  private arcade!: Arcade;
  /** El cine del sótano (la cola de la función). */
  private cinema!: Cinema;
  /** El escenario del jardín (tarima, fila de turnos, palabra, aplausos) y el estudio de grabación. */
  private escenario!: Escenario;
  private podcast!: Podcast;
  /** Jardín vivo: el huerto, el cobertizo y la miel (ver huerto.ts). */
  private huerto!: Huerto<GardenPlotState>;
  private casaArbol!: CasaArbol;
  /** Los niveles de las casas de cada persona que tienen a alguien adentro (se arman al entrar y se sueltan al vaciarse). */
  private readonly casas = new CasasPropias(
    () => [...this.state.players.values()].map((p) => p.area),
    (ownerId) => this.casaAcceso(ownerId),
  );
  /** A qué casa va cada uno que subió al bus en la estación (el dueño; si falta, la propia). */
  private readonly busDest = new Map<string, string>();
  /** El hockey de mesa del arcade (un partido a la vez; ver hockey.ts). */
  private hockey!: HockeyTable;
  /** El Megabús de la parada del jardín (ver bus.ts): lo ven todos en `state.bus`. */
  bus!: BusLine;
  /**
   * Los de a bordo que van a la estación y no a su casa: quien llamó el bus desde la suya y quien "llega en
   * bus". En la parada "Casa" no se bajan; los demás sí, cada uno en la suya.
   */
  private readonly toStation = new Set<string>();
  /** "Esperar el bus" en curso, por persona (se cancela si se va de la parada o se desconecta). */
  private readonly busCalls = new Map<string, { clear(): void }>();
  /** La piscina del jardín: nadar, el trampolín, las reposeras al sol y quedar mojado (ver piscina.ts). */
  private piscina?: Piscina;
  /** La tina caliente y la sauna del lago: los puntos del descanso y quedar mojado al salir (ver tina.ts). */
  private tina?: Tina;
  /** Ajedrez y damas de la sala de juegos (ver boardGames.ts). */
  private boardGames!: BoardGames;
  /** Reloj de la cocina (los tests lo adelantan para que se acabe la energía). */
  static cocinaNow: () => number = () => Date.now();
  /** La cocina: la despensa de cada persona, la estufa y la energía de los platos (ver cocina.ts). */
  private cocina = new Cocina({
    bag: {
      count: (userId, itemId) => this.held.count(userId, itemId),
      fits: (userId, items) => this.held.fits(userId, items),
      take: (userId, itemId, n) => this.held.take(userId, itemId, n),
      add: (userId, itemId, n, opts) => this.held.add(userId, itemId, n, opts),
    },
    award: (userId, amount) => this.awardLeisure(userId, amount),
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    onBuff: (userId, dish) => {
      for (const p of this.state.players.values()) if (p.userId === userId) p.buff = dish;
    },
    level: (userId, oficio) => this.oficios.level(userId, oficio),
  });

  /** La granja: el azar de los animales, su reloj y cuánto tarda cada receta (los tests los fijan y acortan). */
  static granjaRandom: () => number = Math.random;
  static granjaNow: () => number = () => Date.now();
  static parrillaTimeScale = 1;
  static molinoTimeScale = 1;
  /** El gallinero, el corral y el molino (ver granja.ts) y la parrilla (parrilla.ts). */
  private granja!: Granja;
  private parrilla!: Parrilla;

  /**
   * El repositorio con el que nació la sala: un tic que quedó en vuelo al cerrarla no escribe en el de
   * la sala siguiente (en los tests, cada uno trae su repositorio en memoria).
   */
  private readonly ownRepo = OfficeRoom.repo;
  private get repo() {
    return this.ownRepo;
  }

  async onCreate() {
    // Copia propia de la lista de niveles: rearmar el piso 2 no toca el mundo compartido del módulo.
    const base = getWorld();
    this.world = { ...base, areas: new Map(base.areas) };
    for (const z of allZones(this.world)) this.zonesById.set(z.id, z);
    for (const [areaId, map] of this.world.areas) for (const z of map.zones) this.areaOfZone.set(z.id, areaId);
    this.setState(new OfficeState());
    this.events = new CabinEvents({ state: this.state.events, now: () => OfficeRoom.eventsNow(), repo: () => this.repo });
    this.casa = new CasaViva(
      this.state.stalls,
      { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      (userId, item) => void this.held.add(userId, objItemId(item), 1, { pick: true }),
      () => OfficeRoom.stallMs,
    );
    this.furnitureUses = new FurnitureUses(this.state.switches, {
      counters: this.state.counters,
      occupant: this.casa.occupant,
      bagFits: (userId, items) => items.every((item) => this.held.fits(userId, [[objItemId(item), 1]]) === "ok"),
    });
    this.startPets();
    this.startGranja();
    this.club = new Club(this.state.club);
    this.clubTips = new ClubTips(this.state.club, {
      player: (sessionId) => this.state.players.get(sessionId),
      map: (area) => this.mapOf(area),
      repo: () => this.repo,
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
        this.achievements.max(userId, STAT_KEYS.pointsPeak, balance);
      },
      toArea: (area, type, message) => this.sendToArea(area, type, message),
      toSession: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
      now: () => Date.now(),
      newId: () => randomUUID(),
      tipped: (fromId, toId, amount) => {
        this.achievements.bump(fromId, STAT_KEYS.tipsGiven, amount);
        this.achievements.bump(toId, STAT_KEYS.tipsReceived, amount);
      },
    });
    this.cinema = new Cinema(this.state.cinema);
    this.escenario = new Escenario(this.state.stage);
    this.podcast = new Podcast(this.state.podcast);
    this.arcade = new Arcade({
      repo: () => this.repo,
      seed: () => OfficeRoom.arcadeSeed(),
      token: () => randomUUID(),
      award: (userId, amount) => this.awardLeisure(userId, amount),
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      },
    });
    this.casaArbol = new CasaArbol(this.state.treeHouse, this.state.players);
    this.huerto = new Huerto({
      plots: this.state.garden,
      create: () => new GardenPlotState(),
      repo: () => this.repo,
      held: {
        get: (userId) => this.held.get(userId),
        spend: (userId, now) => {
          const used = this.held.use(userId, now, { skipCooldown: true, tool: true });
          return used.ok ? { done: used.done } : null;
        },
        fill: (userId) => this.held.fill(userId),
      },
      bag: {
        fits: (userId, itemId) => this.held.fits(userId, [[itemId, 1]]),
        add: (userId, itemId) => this.held.add(userId, itemId, 1, { pick: true }),
      },
      award: (userId, amount) => this.awardLeisure(userId, amount),
      season: () => this.gameSeason(),
    });
    this.startHockey();
    this.startBus();
    this.startPiscina();
    this.startTina();
    this.startBoardGames();
    this.startViaje();
    OfficeRoom.instances.add(this);

    this.onMessage(HUERTO_MSG.shedTake, (client, raw) => void this.handleShed(client, raw));
    this.onMessage(BAG_MSG.select, (client, raw) => this.handleBagSelect(client, raw));
    this.onMessage(BAG_MSG.move, (client, raw) => this.handleBagMove(client, raw));
    this.onMessage(BAG_MSG.drop, (client, raw) => void this.handleBagDrop(client, raw));
    this.onMessage(AGUA_MSG.action, (client, raw) => this.handleAgua(client, raw));
    this.startObservatorio();
    bindOficios(this, this.oficios, (id) => this.state.players.get(id)?.userId ?? null);
    bindHistoria(this, { encargos: this.encargos, who: (id) => this.state.players.get(id), mapOf: (a) => this.mapOf(a), bump: (u, k) => this.achievements.bump(u, k) });
    this.mundo = registerMundo(this as unknown as MundoRoom);
    this.comunicacion = registerComunicacion(this, { phones: this.phones, bump: (u, k) => this.achievements.bump(u, k), markActive: (c) => this.markActive(c) });
    this.onMessage(COCINA_MSG.open, (client) => void this.withCook(client, (p, now) => ({ state: this.cocina.state(p.userId, now) })));
    this.onMessage(COCINA_MSG.store, (client) => void this.withCook(client, (p, now) => this.cocina.store(this.mapOf(p.area), p, now)));
    this.onMessage(GRANJA_MSG.coopOpen, (client) => void this.handleCoop(client));
    this.onMessage(GRANJA_MSG.vote, (client, raw) => void this.handleCoopVote(client, raw));
    this.onMessage(PARRILLA_MSG.open, (client) => void this.withGrill(client, (who) => ({ state: this.parrilla.state(who.userId) })));
    this.onMessage(PARRILLA_MSG.cook, (client, raw) => void this.withGrill(client, (who, now) => this.parrilla.cook(who, raw, now)));
    this.onMessage(PARRILLA_MSG.buy, (client, raw) => void this.withGrill(client, (who, now) => this.parrilla.buy(who, raw, now)));
    this.onMessage(PARRILLA_MSG.portion, (client, raw) => void this.handlePortion(client, raw));
    this.onMessage(COCINA_MSG.cook, (client, raw) => void this.withCook(client, (p, now) => this.cocina.cook(this.mapOf(p.area), p, raw, now)));
    this.onMessage(MSG.move, (client, raw) => this.handleMove(client, raw));
    this.onMessage(MSG.chatSend, (client, raw) => this.handleChat(client, raw));
    this.onMessage(MSG.status, (client, raw) => this.handleStatus(client, raw));
    this.onMessage(MSG.idle, (client, raw) => {
      const parsed = IdleMessage.safeParse(raw);
      if (parsed.success) this.autoStatus.setIdle(client.sessionId, parsed.data.idle);
    });
    this.onMessage(MSG.profileChanged, (client) => void this.handleProfileChanged(client));
    this.onMessage(MSG.officeLock, (client, raw) => this.handleLock(client, raw));
    this.onMessage(MSG.officeNote, (client, raw) => this.handleOfficeNote(client, raw));
    this.onMessage(MSG.doorNote, (client, raw) => void this.doorNotes.leave(client.sessionId, raw));
    this.onMessage(MSG.officeRadio, (client, raw) => void this.handleOfficeRadio(client, raw));
    this.onMessage(MSG.raceStart, (client, raw) => this.handleRaceStart(client, raw));
    this.onMessage(MSG.raceCancel, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) void this.raceOutcome(client.sessionId, this.races.cancel(client.sessionId, p, "lane"));
    });
    this.onMessage(MSG.raceBoard, (client) => void this.sendRaceBoard(client));
    this.onMessage(MSG.boardOpen, (client, raw) => this.withBoard(client, (who) => this.whiteboards.open(who, raw)));
    this.onMessage(MSG.boardClose, (client, raw) => this.whiteboards.close(client.sessionId, raw));
    this.onMessage(MSG.boardStroke, (client, raw) => this.withBoard(client, (who) => this.whiteboards.stroke(who, raw, Date.now())));
    this.onMessage(MSG.boardUndo, (client, raw) => this.withBoard(client, (who) => this.whiteboards.undo(who, raw)));
    this.onMessage(MSG.boardClear, (client, raw) => this.withBoard(client, (who) => this.whiteboards.clear(who, raw)));
    this.onMessage(MSG.knock, (client, raw) => void this.handleKnock(client, raw));
    this.onMessage(BRUJAS_MSG.trick, (client, raw) => void this.handleBrujasTrick(client, raw));
    this.onMessage(BRUJAS_MSG.pumpkin, (client) => void this.handleBrujasPumpkin(client));
    this.onMessage(BRUJAS_MSG.buy, (client, raw) => void this.handleBrujasBuy(client, raw));
    this.onMessage(MSG.invite, (client, raw) => this.invites.invite(client.sessionId, raw));
    this.onMessage(MSG.inviteRespond, (client, raw) => this.invites.respond(client.sessionId, raw));
    this.onMessage(MSG.phoneCall, (client, raw) => this.handlePhoneCall(client, raw));
    this.onMessage(MSG.phoneAnswer, (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      const parsed = PhoneAnswerMessage.safeParse(raw);
      if (player && parsed.success) this.phones.answer(player.userId, parsed.data.callId, parsed.data.accept);
    });
    this.onMessage(MSG.phoneHangup, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.phones.hangup(player.userId);
    });
    this.onMessage(MSG.knockRespond, (client, raw) => this.handleKnockRespond(client, raw));
    this.onMessage(MSG.travel, (client, raw) => this.handleTravel(client, raw));
    this.onMessage(CASA_ARBOL_MSG.ladder, (client, raw) => this.withTreeHouse(client, (p) => this.casaArbol.ladder(p, raw)));
    this.onMessage(CASA_ARBOL_MSG.focus, (client, raw) => this.withTreeHouse(client, (p) => this.casaArbol.focus(p, raw, Date.now())));
    this.onMessage(BUS_MSG.board, (client, raw) => this.handleBusBoard(client, raw));
    this.onMessage(BUS_MSG.call, (client, raw) => this.handleBusCall(client, raw));
    this.onMessage(CASA_PROPIA_MSG.modo, (client, raw) => this.handleCasaModo(client, raw));
    this.onMessage(CASA_PROPIA_MSG.kick, (client, raw) => this.handleCasaKick(client, raw));
    this.onMessage(CASA_FIESTA_MSG.radio, (client, raw) => void this.handleCasaRadio(client, raw));
    this.onMessage(CASA_FIESTA_MSG.fiesta, (client, raw) => this.handleCasaFiesta(client, raw));
    this.onMessage(MSG.activity, (client) => this.markActive(client));
    this.onMessage(MSG.cafeOrder, (client, raw) => void this.handleCafeOrder(client, raw));
    this.onMessage(MSG.barOrder, (client, raw) => void this.handleOrder(client, raw, "bar"));
    this.onMessage(MSG.cinemaOrder, (client, raw) => void this.handleOrder(client, raw, "cine"));
    this.onMessage(MSG.sombreroBuy, (client, raw) => void this.handleSombreroBuy(client, raw));
    this.onMessage(MSG.useHeld, (client, raw) => this.handleUseHeld(client, raw));
    this.onMessage(MSG.furnitureUse, (client, raw) => this.handleFurnitureUse(client, raw));
    this.onMessage(PET_MSG.call, (client, raw) => this.handlePet(client, raw, "call"));
    this.onMessage(PET_MSG.action, (client, raw) => this.handlePet(client, raw, "action"));
    this.onMessage(MSG.toast, (client, raw) => this.handleToast(client, raw));
    this.onMessage(MSG.swivel, (client, raw) => this.handleSwivel(client, raw));
    this.onMessage(MSG.officeEdit, (client, raw) => {
      this.serial(() => this.handleOfficeEdit(client, raw)).catch((err) => {
        // Un error inesperado igual se responde: si no, el editor se queda esperando.
        console.error("officeEdit", err);
        client.send(MSG.officeEditResult, { ok: false, error: "failed" } satisfies OfficeEditResult);
      });
    });
    this.onMessage(MSG.worldEditLock, (client, raw) => this.handleWorldEditLock(client, raw));
    this.onMessage(MSG.worldEdit, (client, raw) => {
      this.serial(() => this.handleWorldEdit(client, raw)).catch((err) => {
        console.error("worldEdit", err);
        client.send(MSG.worldEditResult, { ok: false, error: "failed" } satisfies WorldEditResult);
      });
    });
    this.onMessage(MSG.emote, (client, raw) => this.handleEmote(client, raw));
    this.onMessage(ESCENARIO_MSG.stage, (client, raw) => this.handleStage(client, raw));
    this.onMessage(ESCENARIO_MSG.hand, (client, raw) => this.handleHand(client, raw));
    this.onMessage(ESCENARIO_MSG.floor, (client, raw) => this.handleFloor(client, raw));
    this.onMessage(ESCENARIO_MSG.clap, (client) => this.handleClap(client));
    this.onMessage(PODCAST_MSG.start, (client) => this.withPodcast(client, (who, inside, now) => this.podcast.start(who, inside, now)));
    this.onMessage(PODCAST_MSG.consent, (client, raw) => {
      const parsed = PodcastConsentMessage.safeParse(raw);
      if (parsed.success) this.withPodcast(client, (who, inside, now) => this.podcast.consent(who, parsed.data.accept, inside, now));
    });
    this.onMessage(PODCAST_MSG.stop, (client) => this.withPodcast(client, (who, inside) => this.podcast.stop(who, inside)));
    this.onMessage(MSG.photoTake, (client) => {
      this.markActive(client);
      this.photos.take(client.sessionId);
    });
    this.onMessage(MSG.rouletteBet, (client, raw) => void this.handleRouletteBet(client, raw));
    this.onMessage(MSG.mesaBet, (client, raw) => void this.handleMesaBet(client, raw));
    this.onMessage(MSG.blackjackBet, (client, raw) => void this.handleBlackjack(client, raw, "bet"));
    this.onMessage(MSG.blackjackAction, (client, raw) => void this.handleBlackjack(client, raw, "action"));
    this.onMessage(MSG.fishCast, (client) => this.handleFishCast(client));
    this.onMessage(MSG.fishHook, (client, raw) => this.withFisher(client, (userId) => this.fishery.hook(userId, raw)));
    this.onMessage(MSG.fishFinish, (client, raw) => this.withFisher(client, (userId) => void this.fishery.finish(userId, raw)));
    this.onMessage(MSG.fishCancel, (client) => this.withFisher(client, (userId) => this.fishery.cancel(userId)));
    this.onMessage(PESCA_MSG.buy, (client, raw) => void this.handlePescaBuy(client, raw));
    this.onMessage(QUEST_MSG.claim, (client, raw) => {
      const p = this.state.players.get(client.sessionId);
      this.markActive(client);
      if (p) void this.encargos.claim(p.userId, raw).then((r) => r && client.send(QUEST_MSG.result, r satisfies QuestClaimResult));
    });
    this.onMessage(MSG.tradeRequest, (client, raw) => this.trades.request(client.sessionId, raw));
    this.onMessage(MSG.tradeRespond, (client, raw) => this.trades.respond(client.sessionId, raw));
    this.onMessage(MSG.tradeOffer, (client, raw) => void this.trades.offer(client.sessionId, raw));
    this.onMessage(MSG.tradeReady, (client, raw) => void this.trades.ready(client.sessionId, raw));
    this.onMessage(MSG.tradeConfirm, (client) => void this.trades.confirm(client.sessionId));
    this.onMessage(MSG.tradeCancel, (client) => this.trades.cancel(client.sessionId));
    this.onMessage(MSG.clubDj, (client, raw) => this.handleClub(client, raw, "dj"));
    this.onMessage(MSG.clubDance, (client, raw) => this.handleClub(client, raw, "dance"));
    this.onMessage(MSG.clubPole, (client, raw) => this.handleClub(client, raw, "pole"));
    this.onMessage(MSG.clubQueue, (client, raw) => void this.handleClubQueue(client, raw));
    this.onMessage(MSG.clubReact, (client, raw) => this.handleClubReact(client, raw));
    this.onMessage(MSG.clubTip, (client, raw) => {
      if (client.userData) client.userData.lastActiveAt = Date.now();
      void this.clubTips.tip(client.sessionId, raw);
    });
    this.onMessage(MSG.cinemaQueue, (client, raw) => void this.handleCinema(client, raw));
    this.onMessage(MSG.arcadeBoard, (client, raw) => void this.handleArcadeBoard(client, raw));
    this.onMessage(MSG.arcadeStart, (client, raw) => void this.handleArcadeStart(client, raw));
    this.onMessage(MSG.arcadeFinish, (client, raw) => void this.handleArcadeFinish(client, raw));
    this.onMessage(MSG.congrats, (client, raw) => void this.handleCongrats(client, raw));
    this.onMessage(MSG.focusStart, (client, raw) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.markActive(client);
      this.focus.start(player.userId, raw);
    });
    this.onMessage(MSG.focusStop, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) this.focus.stop(player.userId);
    });
    this.onMessage(MSG.hockeyJoin, (client, raw) => void this.handleHockeyJoin(client, raw));
    this.onMessage(MSG.hockeyMove, (client, raw) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.hockey.move(p.userId, raw);
    });
    this.onMessage(MSG.hockeyLeave, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.hockey.leave(p.userId);
    });
    this.onMessage(MSG.boardReady, (client, raw) => this.handleBoard(client, raw, "ready"));
    this.onMessage(MSG.boardMove, (client, raw) => this.handleBoard(client, raw, "move"));
    this.onMessage(MSG.boardResign, (client, raw) => this.handleBoard(client, raw, "resign"));
    this.onMessage(MSG.boardDraw, (client, raw) => this.handleBoard(client, raw, "draw"));
    this.onMessage(MSG.boardRanking, (client, raw) => void this.sendBoardRanking(client, raw));
    this.onMessage(MSG.clockPing, (client, raw) => {
      const parsed = ClockPingMessage.safeParse(raw);
      if (parsed.success) client.send(MSG.clockPong, { id: parsed.data.id, now: Date.now() } satisfies ClockPong);
    });
    // Quien se fue, cambió de nivel o se alejó deja de bailar (moverse ya lo revisa; esto cubre el resto).
    this.clock.setInterval(() => {
      this.club.sweep(this.state.players);
      for (const [id, outcome] of this.races.sweep(Date.now(), this.state.players)) void this.raceOutcome(id, outcome);
      // Y el video que terminó pasa al siguiente aunque nadie en el club lo esté mirando.
      this.club.tick(Date.now());
      // El foco se cancela si salió de su oficina por cualquier camino (desmayo, editor que lo corrió…).
      for (const p of this.state.players.values()) if (p.focus === "work") this.focus.moved(p.userId, p.zoneId);
      this.cinema.tick(Date.now());
      // La casa del árbol que se vació (por donde sea) baja la escalera, y el modo foco cambia de fase.
      this.casaArbol.sweep(Date.now());
      // "En reunión" también para quien entró o salió sin caminar (portal, desmayo, se desconectó).
      this.autoStatus.refreshMeetings();
      // Escenario y cabina: la mano o la palabra de quien se fue, y el acuerdo para grabar.
      this.escenario.sweep(this.state.players);
      this.sendPodcastNotices(this.podcast.sync(this.podcastInside(), Date.now()));
    }, 500);
    // Cumpleaños del día y el karaoke de los viernes: se revisa seguido (cambian con la hora de Bogotá).
    this.clock.setInterval(() => void this.events.refresh(), OfficeRoom.eventsRefreshMs);
    this.clock.setInterval(() => void this.presenceTick(), OfficeRoom.presenceTickMs);
    // Sin nadie adentro el reloj está quieto: corre desde que entra el primero (ver resumeGameClock).
    this.setGameClock(pauseClock(this.startClock, OfficeRoom.gameClockNow()));
    this.clock.setInterval(() => !this.state.clockPaused && void this.saveClock(), OfficeRoom.clockSaveMs);
    this.clock.setInterval(() => this.checkSeason(), 5_000);
    // El festival del día del calendario (ver festivales.ts): abre a las 9:00 y cierra a las 22:00 del juego.
    this.clock.setInterval(() => {
      this.festivales.tick();
      this.syncFestival();
    }, 2_000);
    this.weather.start();
    // Mientras llueve, lo que se va secando se vuelve a regar solo.
    this.clock.setInterval(() => isWet(this.weather.weather) && this.rainOnGarden(), 60_000);
    this.sombrero = new ManDelSombrero({
      state: this.state.sombrero,
      time: () => this.gameTimeNow(),
      weather: () => this.state.weather as Weather,
      random: (n) => OfficeRoom.sombreroRandom(n),
    });
    this.sombrero.refresh();
    this.clock.setInterval(() => this.sombrero.refresh(), OfficeRoom.sombreroTickMs);
    this.clock.setInterval(() => void this.achievements.flushAll(), OfficeRoom.statsFlushMs);
    this.clock.setInterval(() => void this.oficios.flushAll(), OfficeRoom.statsFlushMs);

    try {
      const officeZones = allZones(this.world).filter((z) => z.type === "office");
      await this.repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));
      await this.reloadCasinoSettings();
      await this.loadWorldEdits();
      await this.loadGameClock();
      this.season = this.gameSeason();
      this.festivales.start();
      this.syncFestival();
      await this.huerto.load().catch((err) => console.error("loadGarden", err));
      this.startCasino();
      // Apuestas de una corrida anterior que se cayó sin pagarlas (y cada tanto, por si era reciente).
      await this.casinoRounds.recover();
      this.clock.setInterval(() => void this.casinoRounds.recover(), OpenRounds.recoverEveryMs);
      await this.reloadOffices();
      await this.events.refresh();
      this.globalHistory = await this.repo.loadGlobalChat(CHAT_HISTORY_SIZE);
      startChatRetention(this.clock, () => this.repo);
    } catch (err) {
      // Colyseus no cierra una sala que falló al crearse: se paran sus relojes para que no quede viva a medias.
      console.error("OfficeRoom.onCreate: no se pudo abrir la sala", err);
      OfficeRoom.instances.delete(this);
      this.clock.clear();
      throw err;
    }
  }

  // ---------- Límite de mensajes ----------

  // Por conexión (una reconexión trae otro objeto y empieza con el balde lleno); WeakMap: se va con ella.
  private readonly msgBuckets = new WeakMap<Client, TokenBucket>();
  private readonly floodLoggedAt = new WeakMap<Client, number>();

  /** ¿Pasa este mensaje? El exceso se descarta en silencio, sin sacar al cliente (se anota de vez en cuando). */
  private withinRate(client: Client, type: string | number): boolean {
    const cfg = OfficeRoom.msgRate;
    if (!cfg) return true;
    const now = Date.now();
    let bucket = this.msgBuckets.get(client);
    if (!bucket) this.msgBuckets.set(client, (bucket = newBucket(now, cfg)));
    if (takeToken(bucket, now, cfg)) return true;
    if (now - (this.floodLoggedAt.get(client) ?? -Infinity) >= MSG_RATE.logEveryMs) {
      this.floodLoggedAt.set(client, now);
      const userId = this.state.players.get(client.sessionId)?.userId ?? "?";
      console.warn(`Límite de mensajes: ${userId} se pasó (último: "${type}"); se descarta el exceso`);
    }
    return false;
  }

  // Todo mensaje pasa por el límite, también los que registran los módulos de las salas (llaman a este método).
  override onMessage<T = any>(type: "*", callback: (client: Client<UserData>, type: string | number, message: T) => void): any;
  override onMessage<T = any>(type: string | number, callback: (client: Client<UserData>, message: T) => void, validate?: (message: unknown) => T): any;
  override onMessage(type: string | number, callback: (...args: any[]) => void, validate?: (message: unknown) => unknown) {
    if (type === "*") {
      return super.onMessage("*", (client: Client<UserData>, t: string | number, message: unknown) => {
        if (this.withinRate(client, t)) callback(client, t, message);
      });
    }
    return super.onMessage(
      type,
      (client: Client<UserData>, message: unknown) => {
        if (this.withinRate(client, type)) callback(client, message);
      },
      validate,
    );
  }

  // Apagado por deploy: avisar y cerrar con el código de reinicio (ver reinicio.ts). El reloj se guarda
  // antes, por si acaso (al vaciarse la sala y en onDispose se vuelve a guardar).
  onBeforeShutdown() {
    void this.saveClock();
    void closeForRestart(this);
  }

  async onDispose() {
    OfficeRoom.instances.delete(this);
    // La decoración del festival es del mundo compartido: la última sala la quita.
    if (OfficeRoom.instances.size === 0) setFestivalDecor(null);
    this.piscina?.dispose();
    this.drunk.dispose();
    this.trips.dispose();
    this.toasts.dispose();
    this.weather.dispose();
    this.bus?.dispose();
    this.cocina.dispose();
    this.phones.dispose();
    this.comunicacion?.dispose();
    // Primero se devuelve lo cobrado o sacado de la mochila que no alcanzó a terminar (Colyseus espera
    // esta promesa antes de apagar el proceso)...
    const restore = (userId: string, itemId: string, n: number) => this.repo.addInventory(userId, itemId, n);
    await settleAll("devoluciones", {
      casino: () => this.casinoRounds.close(),
      parrilla: () => this.parrilla?.close(restore),
      molino: () => this.granja?.close(restore),
    });
    // ...y después se guarda lo pendiente (las devoluciones pudieron sumar contadores).
    await settleAll("guardado", {
      logros: () => this.achievements.flushAll(),
      oficios: () => this.oficios.flushAll(),
      pizarras: () => this.whiteboards.flush(),
      mascotas: () => this.pets?.flush(Date.now()),
      huerto: () => this.huerto?.flush(),
      mochilas: () => this.held.flushAll(),
      arcade: () => this.arcade?.flush(),
      decoracion: () => this.decorQueue,
      reloj: () => this.saveClock(),
    });
  }

  async onAuth(_client: Client, options: unknown): Promise<GameTokenClaims> {
    const parsed = JoinOptions.safeParse(options);
    if (!parsed.success) throw new ServerError(400, "Opciones de ingreso inválidas");
    try {
      return await verifyGameToken(parsed.data.token, gameTokenSecret());
    } catch {
      throw new ServerError(401, "Sesión inválida o expirada. Vuelve a iniciar sesión.");
    }
  }

  async onJoin(client: Client<UserData>, options: unknown, auth: GameTokenClaims) {
    this.resumeGameClock();
    this.festivales.welcome((type, msg) => client.send(type, msg));
    this.removeOtherPresences(auth.sub, client.sessionId);
    this.fishery.forget(auth.sub); // un lance de la sesión anterior no sigue en la nueva

    // Todos aparecen en el jardín, frente a la cabaña; o, con "Llegar en bus", adentro del Megabús, que
    // los trae hasta la estación (si el próximo tarda, sale uno de refuerzo).
    const byBus = JoinOptions.safeParse(options).data?.arriveByBus === true;
    const area = byBus ? BUS.area : this.world.spawnArea;
    const map = this.mapOf(area);
    const spawn = byBus ? this.busArrival() : spawnPoint(map);
    const pos = this.freeSpotNear(map, spawn.x, spawn.y);

    const player = new Player();
    player.userId = auth.sub;
    player.name = auth.name;
    player.avatar = auth.avatar;
    player.look = auth.look ? JSON.stringify(auth.look) : "";
    player.area = area;
    player.x = pos.x;
    player.y = pos.y;
    player.zoneId = zoneAt(map, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(map, pos.x, pos.y);
    // Lo que se lee de la base al entrar no depende entre sí: va todo a la vez (una espera, no cuatro).
    const [status, points, permisos] = await Promise.all([
      this.repo.getUserStatus(auth.sub).catch(orElse("onJoin.getUserStatus", null, { userId: auth.sub })),
      // La primera vez que entra, el bono de bienvenida (una sola vez; ver POINTS.welcomeBonus).
      this.repo
        .grantWelcome(auth.sub)
        .catch(orElse("onJoin.grantWelcome", null, { userId: auth.sub }))
        .then(async (welcome) => welcome?.balance ?? (await this.repo.getPoints(auth.sub).catch(orElse("onJoin.getPoints", 0, { userId: auth.sub })))),
      this.repo.loadPermisos([auth.sub]).catch((err) => {
        console.error("loadPermisos", err);
        return { everyone: [] as Permiso[], byUser: {} as Record<string, Permiso[]> };
      }),
      // La mochila se lee de la base al entrar (la web pudo cambiarla mientras no estaba).
      this.held.load(auth.sub),
    ]);
    player.status = status ?? "available";
    player.points = points;
    // Cuánto ocio lleva hoy (para el celular), sin esperar a que gane algo.
    void this.sendLeisure(auth.sub);
    // El celular (el chat vive en él) lo tiene todo el mundo: al que le falta se le da gratis, en la
    // última casilla para no ocupar la mano (la primera casilla es la que queda elegida al entrar).
    if (OfficeRoom.celularAlEntrar && this.held.count(auth.sub, CELULAR_ITEM) === 0) {
      const given = await this.held.add(auth.sub, CELULAR_ITEM).catch(() => "full" as const);
      if (given === "ok") this.held.move(auth.sub, CELULAR_ITEM, BAG.slots - 1);
    }
    // En plena Noche de brujas, la canasta de dulce o truco a quien no la tiene.
    if (OfficeRoom.brujasCanasta) await this.brujas.giveBasket(auth.sub).catch(() => false);
    const held = this.held.get(auth.sub);
    player.held = held?.item ?? "";
    player.heldLeft = held ? formatHeldLeft(held.left) : "";
    player.drunk = this.drunk.stage(auth.sub);
    player.wet = this.piscina?.isWet(auth.sub) ?? false;
    player.buff = this.cocina.buffOf(auth.sub, OfficeRoom.cocinaNow());
    const trip = this.trips.get(auth.sub);
    player.trip = trip?.kind ?? "";
    player.tripUntil = trip?.until ?? 0;
    this.state.players.set(client.sessionId, player);
    this.autoStatus.join(client.sessionId, player.status as ManualStatus);
    this.focus.joined(auth.sub);
    // Si recargó la página en medio de una llamada, la sesión nueva la retoma.
    this.phones.restore(auth.sub);
    this.comunicacion?.greet(client.sessionId);

    const admin = auth.role === "ADMIN";
    client.userData = {
      lastMoveAt: Date.now(),
      chatTimes: [],
      lastActiveAt: Date.now(),
      admin,
      permisos: permisosEfectivos({ admin, granted: permisos.byUser[auth.sub] ?? [], everyone: permisos.everyone }),
    };
    void this.achievements.load(auth.sub).then(() => {
      this.achievements.visit(auth.sub, area);
      this.achievements.max(auth.sub, STAT_KEYS.pointsPeak, player.points);
    });
    void this.encargos.load(auth.sub, { join: true, newcomer: isNewcomer(auth.onboardedAt, Date.now()), byBus });
    void this.oficios.load(auth.sub, { join: true });
    if (byBus) {
      this.toStation.add(auth.sub);
      this.bus.requestRide();
    }
    void this.refreshBadge(auth.sub);
    client.send(MSG.chatHistory, this.globalHistory);
    // La mochila, con la casilla elegida (el cliente la adopta: por eso `pick`).
    client.send(BAG_MSG.state, { ...this.held.view(auth.sub), pick: true } satisfies BagView);
    // La hora del servidor, para que el cliente calcule bien los conteos regresivos (la ruleta).
    client.send(MSG.clock, { now: Date.now() });
    this.sendPermisos(client);
  }

  // ---------- Permisos ----------

  private sendPermisos(client: Client<UserData>) {
    const d = client.userData;
    if (d) client.send(PERMISOS_MSG.state, { admin: Boolean(d.admin), permisos: d.permisos ?? [] } satisfies PermisosView);
  }

  /** Un admin cambió permisos desde la web: se releen los de todos los conectados y se les avisa. */
  static async reloadPermisosEverywhere() {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadPermisos()));
  }

  private async reloadPermisos() {
    const clients = this.clients.filter((c) => c.userData && this.state.players.has(c.sessionId));
    const userIds = [...new Set(clients.map((c) => this.state.players.get(c.sessionId)!.userId))];
    const { everyone, byUser } = await this.repo.loadPermisos(userIds);
    for (const c of clients) {
      const player = this.state.players.get(c.sessionId);
      if (!player || !c.userData) continue;
      c.userData.permisos = permisosEfectivos({ admin: Boolean(c.userData.admin), granted: byUser[player.userId] ?? [], everyone });
      // Si le quitaron el editor de la casa mientras lo tenía, lo suelta (el cliente cierra el panel).
      if (this.houseEditLock?.sessionId === c.sessionId && !puede(c.userData, "editar-casa")) this.houseEditLock = null;
      this.sendPermisos(c);
    }
  }

  async onLeave(client: Client<UserData>, consented: boolean) {
    // Un intercambio no espera a que vuelva: se cancela en cuanto se corta la conexión.
    this.trades.left(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!consented && player) {
      player.moving = false;
      const reconnection = this.allowReconnection(client, RECONNECT_SECONDS);
      this.pendingReconnections.set(client.sessionId, reconnection);
      try {
        await reconnection;
        return;
      } catch {
        // no volvió a tiempo, o entró con una sesión nueva (ver removeOtherPresences)
      } finally {
        this.pendingReconnections.delete(client.sessionId);
      }
    }
    this.removePlayer(client.sessionId);
  }

  // ---------- Oficinas ----------

  /** Sincroniza `state.offices` con la base de datos (dueños, nombres, candado y decoración). */
  async reloadOffices() {
    // En la fila de la decoración: así no pisa con datos viejos un cambio que se está guardando.
    await this.serial(async () => {
      const records = await this.repo.listOffices();
      const seen = new Set<string>();
      for (const r of records) {
        if (!this.zonesById.has(r.zoneId)) continue; // oficina que ya no está en el mapa
        seen.add(r.zoneId);
        this.applyOfficeRecord(r);
      }
      for (const zoneId of [...this.state.offices.keys()]) {
        if (!seen.has(zoneId)) this.state.offices.delete(zoneId);
      }
      for (const areaId of new Set([...seen].map((z) => this.areaOfZone.get(z)!))) this.rebuildArea(areaId);
    });
    await this.reloadDoorNotes();
  }

  /** Los post-its de cada puerta: las notas sin leer de cada dueño. */
  private async reloadDoorNotes() {
    const owners = [...new Set([...this.state.offices.values()].map((o) => o.ownerId).filter(Boolean))];
    try {
      const counts = await this.repo.unreadDoorNotes(owners);
      for (const office of this.state.offices.values()) office.notes = Math.min(255, counts[office.ownerId] ?? 0);
    } catch (err) {
      console.error("unreadDoorNotes", err);
    }
  }

  private setDoorNotes(ownerId: string, unread: number) {
    for (const office of this.state.offices.values()) if (office.ownerId && office.ownerId === ownerId) office.notes = Math.min(255, unread);
  }

  private applyOfficeRecord(r: OfficeRecord) {
    let office = this.state.offices.get(r.zoneId);
    if (!office) {
      office = new OfficeInfo();
      office.zoneId = r.zoneId;
      this.state.offices.set(r.zoneId, office);
    }
    const ownerChanged = office.ownerId !== (r.ownerId ?? "");
    office.name = r.name;
    office.ownerId = r.ownerId ?? "";
    office.ownerName = r.ownerName ?? "";
    // Una oficina sin dueño no puede estar cerrada.
    office.locked = Boolean(r.ownerId) && r.locked;
    if (ownerChanged || !office.locked) office.guests.clear();
    // La radio y la nota de la placa eran del dueño anterior: el nuevo empieza con la oficina callada.
    if (ownerChanged) {
      this.stopRadio(office);
      office.note = "";
    }
    office.floor = r.floor ?? "";
    office.wallpaper = r.wallpaper ?? "";
    office.customized = r.customized;
    this.syncItems(office, r.customized ? r.items : []);
  }

  /** Deja `office.items` igual a `items` tocando solo lo que cambió (así el cliente recibe poco). */
  private syncItems(office: OfficeInfo, items: OfficeItemDTO[]) {
    const wanted = new Set(items.map((i) => i.id));
    for (let i = office.items.length - 1; i >= 0; i--) if (!wanted.has(office.items[i]!.id)) office.items.splice(i, 1);
    for (const it of items) {
      let item = office.items.find((x) => x.id === it.id);
      if (!item) {
        item = new OfficeItem();
        item.id = it.id;
        office.items.push(item);
      }
      item.type = it.type;
      item.x = it.x;
      item.y = it.y;
      item.facing = it.facing;
    }
  }

  // ---------- Decoración (fase 3c) ----------

  /** Encola una tarea de decoración: corre cuando terminó la anterior. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.decorQueue.then(fn);
    this.decorQueue = run.catch(() => undefined);
    return run;
  }

  /** Decoración de las oficinas de un nivel, como la entiende `decorateArea`. */
  private decorOf(areaId: string): AreaDecor {
    const decor: AreaDecor = {};
    for (const office of this.state.offices.values()) {
      if (this.areaOfZone.get(office.zoneId) !== areaId) continue;
      decor[office.zoneId] = {
        items: office.customized ? office.items.map(itemDTO) : null,
        floor: office.floor || null,
        wallpaper: office.wallpaper || null,
      };
    }
    return decor;
  }

  /**
   * El reloj guardado (al vaciarse la sala, cada tanto y con /time): sigue desde el minuto en que quedó,
   * quieto hasta que entre alguien. Sin fila, el reloj de siempre (cuenta desde el día 0). También trae la
   * estación con que se repartieron los encargos de hoy y de la semana.
   */
  private async loadGameClock() {
    if (OfficeRoom.gameClockInitial) return;
    const raw = await this.repo.loadGameClock().catch((err) => console.error("loadGameClock", err));
    const saved = parseGameClock(raw);
    if (!saved) return;
    const now = OfficeRoom.gameClockNow();
    const frozen = pauseClock(saved, now);
    this.setGameClock(this.state.clockPaused ? frozen : resumeClock(frozen, now));
    const seasons = (raw as { questSeasons?: unknown }).questSeasons;
    if (seasons && typeof seasons === "object")
      for (const [period, season] of Object.entries(seasons)) if (isSeason(season)) this.questSeasonMemo[period] = season;
    this.sombrero.refresh();
  }

  /** Carga los cambios guardados del editor de la casa y los aplica a cada nivel. */
  private async loadWorldEdits() {
    const saved = await this.repo.loadWorldEdits().catch((err) => {
      console.error("loadWorldEdits", err);
      return {} as Record<string, unknown>;
    });
    for (const [area, raw] of Object.entries(saved)) if (planDef(area)) this.applyWorldEdits(area, parseWorldEdits(raw));
  }

  /** Aplica los cambios del editor a un nivel: el mundo compartido, la copia de esta sala y el estado. */
  private applyWorldEdits(area: string, edits: WorldEdits) {
    setWorldEdits(area, edits);
    this.state.worldEdits.set(area, JSON.stringify(edits));
    this.rebuildArea(area);
  }

  /** Quién tiene el editor de la casa (una persona a la vez). */
  private houseEditLock: { sessionId: string; name: string } | null = null;

  /** Entrar o salir del editor de la casa: solo quien puede editar, y si nadie más lo tiene. */
  private handleWorldEditLock(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = WorldEditLockMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const reply = (r: WorldEditLockResult) => client.send(MSG.worldEditLockResult, r);
    if (!parsed.data.on) {
      if (this.houseEditLock?.sessionId === client.sessionId) this.houseEditLock = null;
      return;
    }
    if (!puede(client.userData, "editar-casa")) return reply({ ok: false, error: "not-allowed" });
    const lock = this.houseEditLock;
    if (lock && lock.sessionId !== client.sessionId && this.state.players.has(lock.sessionId)) return reply({ ok: false, error: "busy", by: lock.name });
    this.houseEditLock = { sessionId: client.sessionId, name: player.name };
    reply({ ok: true });
  }

  /** Editor de la casa (permiso `editar-casa`): valida el cambio, lo guarda y lo aplica en todas las salas. */
  private async handleWorldEdit(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = WorldEditMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const reply = (r: WorldEditResult) => client.send(MSG.worldEditResult, r);
    if (!puede(client.userData, "editar-casa")) return reply({ ok: false, error: "admin" });
    // Una sola persona edita la casa a la vez: la que tiene el candado (lo toma si está libre).
    if (this.houseEditLock && this.houseEditLock.sessionId !== client.sessionId) return reply({ ok: false, error: "busy" });
    this.houseEditLock ??= { sessionId: client.sessionId, name: player.name };
    const { area, op } = parsed.data;
    const def = planDef(area);
    if (!def) return reply({ ok: false, error: "unknown" });
    const current = parseWorldEdits(JSON.parse(this.state.worldEdits.get(area) ?? "null"));
    const people = [...this.state.players.values()].filter((p) => p.area === area).map((p) => ({ x: p.x, y: p.y }));
    const check = checkWorldEdit(def, current, op, people, randomUUID().slice(0, 8));
    if (!check.ok) return reply({ ok: false, error: check.error });
    try {
      await this.repo.saveWorldEdits(area, check.edits, player.userId);
    } catch (err) {
      console.error("saveWorldEdits", err);
      return reply({ ok: false, error: "failed" });
    }
    OfficeRoom.applyWorldEditsEverywhere(area, check.edits);
    reply({ ok: true });
  }

  /** Rearma un nivel con la decoración actual (colisión y asientos del servidor). */
  private rebuildArea(areaId: string) {
    const base = getWorld().areas.get(areaId);
    if (!base) return;
    const def = decorateAreaDef(base.def, this.decorOf(areaId));
    this.world.areas.set(areaId, def === base.def ? base : buildArea(def));
    this.unstick(areaId);
    this.furnitureUses?.prune(this.mapOf(areaId));
    // Casa viva: si un mueble nuevo quedó encima de una mascota o de su ruta, se corre.
    this.pets?.rebuilt(areaId);
  }

  /**
   * Nadie queda dentro de un mueble: la validación lo evita, pero alguien pudo pisar ahí mientras se
   * guardaba. Se le mueve al tile libre más cercano (y se levanta si su asiento ya no está).
   */
  private unstick(areaId: string) {
    const map = this.mapOf(areaId);
    const ts = map.tileSize;
    for (const [sessionId, p] of this.state.players) {
      if (p.area !== areaId) continue;
      if (p.swimming ? canSwimAt(map, p.x, p.y) : p.seated ? seatAtPoint(map, p.x, p.y) : canStandAt(map, p.x, p.y)) continue;
      p.swimming = false;
      const tile = this.freeTileFor(map, p);
      const zone = zoneAt(map, p.x, p.y);
      // Sin lugar libre cerca: a la puerta de su oficina (afuera, en el pasillo).
      const spot = tile ? { x: tile.x * ts + ts / 2, y: tile.y * ts + ts / 2 } : zone?.door ? officeDoor(zone) : null;
      if (!spot) continue;
      p.x = spot.x;
      p.y = spot.y;
      p.seated = false;
      p.moving = false;
      p.zoneId = zoneAt(map, p.x, p.y)?.id ?? "";
      p.place = placeAt(map, p.x, p.y);
      this.clients.getById(sessionId)?.send(MSG.moveCorrection, { x: p.x, y: p.y } satisfies MoveCorrection);
    }
  }

  /**
   * Tile libre más cercano para sacar a alguien de un mueble (BFS por tiles). No cruza paredes (las
   * oficinas vecinas comparten pared) ni entra a una oficina cerrada que no le toca; se prefiere
   * quedar en la misma zona y, si no hay lugar ahí, el tile libre más cercano de otra.
   */
  private freeTileFor(map: OfficeMap, player: Player): TilePos | null {
    const ts = map.tileSize;
    const start = { x: Math.floor(player.x / ts), y: Math.floor(player.y / ts) };
    const zoneId = zoneAt(map, player.x, player.y)?.id ?? "";
    const seen = new Set([start.y * map.width + start.x]);
    let frontier: TilePos[] = [start];
    let other: TilePos | null = null;
    for (let r = 0; r <= UNSTICK_RADIUS && frontier.length; r++) {
      const next: TilePos[] = [];
      for (const t of frontier) {
        const cx = t.x * ts + ts / 2;
        const cy = t.y * ts + ts / 2;
        if (!this.canAccess(player, cx, cy)) continue; // ni se queda ni se pasa por ahí
        if (canStandAt(map, cx, cy)) {
          if ((zoneAt(map, cx, cy)?.id ?? "") === zoneId) return t;
          other ??= t;
        }
        // Se puede pasar por debajo de los muebles (está dentro de uno), pero no a través de una pared.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = { x: t.x + dx, y: t.y + dy };
          const i = n.y * map.width + n.x;
          if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || seen.has(i)) continue;
          if (wallBetween(map, t.x, t.y, n.x, n.y)) continue;
          seen.add(i);
          next.push(n);
        }
      }
      frontier = next;
    }
    return other;
  }

  /**
   * Editor de oficina: solo la dueña o dueño de esa oficina. Se valida con la misma regla que usa el
   * cliente (`applyDecorEdit`) y se guarda en una transacción (mochila incluida).
   */
  private async handleOfficeEdit(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = OfficeEditMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const msg = parsed.data;
    const reply = (r: OfficeEditResult) => client.send(MSG.officeEditResult, r);

    const now = Date.now();
    const times = (client.userData.editTimes ?? []).filter((t) => now - t < EDIT_RATE.windowMs);
    if (times.length >= EDIT_RATE.max) return reply({ ok: false, error: "failed" });
    times.push(now);
    client.userData.editTimes = times;

    const office = this.state.offices.get(msg.zoneId);
    const areaId = this.areaOfZone.get(msg.zoneId);
    if (!office || !areaId) return reply({ ok: false, error: "unknown" });
    if (!office.ownerId || office.ownerId !== player.userId) return reply({ ok: false, error: "not-owner" });

    if (msg.action === "style") {
      const style = { floor: msg.floor, wallpaper: msg.wallpaper };
      if (!style.floor && !style.wallpaper) return reply({ ok: true });
      try {
        await this.repo.setOfficeStyle(office.zoneId, style);
      } catch (err) {
        console.error("setOfficeStyle", err);
        return reply({ ok: false, error: "failed" });
      }
      if (style.floor) office.floor = style.floor;
      if (style.wallpaper) office.wallpaper = style.wallpaper;
      this.rebuildArea(areaId);
      return reply({ ok: true });
    }

    const edit: DecorEdit =
      msg.action === "place"
        ? { action: "place", type: msg.type, x: msg.x, y: msg.y, facing: msg.facing }
        : msg.action === "move"
          ? { action: "move", itemId: msg.itemId, x: msg.x, y: msg.y, facing: msg.facing }
          : { action: "remove", itemId: msg.itemId };
    const def = getWorld().areas.get(areaId)!.def;
    const people = [...this.state.players.values()].filter((p) => p.area === areaId).map((p) => ({ x: p.x, y: p.y }));
    const check = applyDecorEdit({ def, decor: this.decorOf(areaId), zoneId: office.zoneId, people }, edit);
    if (!check.ok) return reply({ ok: false, error: check.error });

    let result: OfficeItemsResult;
    try {
      result = await this.repo.editOfficeItems({
        zoneId: office.zoneId,
        userId: player.userId,
        defaults: office.customized ? [] : defaultOfficeItems(def, office.zoneId),
        // La base guarda la decoración relativa a la oficina.
        edit: storedEdit(def, office.zoneId, edit),
      });
    } catch (err) {
      console.error("editOfficeItems", err);
      return reply({ ok: false, error: "failed" });
    }
    if (!result.ok) return reply({ ok: false, error: result.error });
    const current = this.state.offices.get(office.zoneId); // pudo recargarse mientras se guardaba
    if (current) {
      current.customized = true;
      this.syncItems(current, result.items);
    }
    this.rebuildArea(areaId);
    this.achievements.bump(player.userId, STAT_KEYS.decorEdits);
    // Poner saca un mueble de la mochila y quitarlo lo devuelve.
    void this.held.load(player.userId);
    reply({ ok: true });
  }

  /** ¿Puede este jugador estar en (x, y)? Bloquea oficinas cerradas a quien no es dueño ni invitado. */
  private canAccess(player: Player, x: number, y: number): boolean {
    const map = this.mapOf(player.area);
    // La tarima del escenario (dos como mucho).
    const sessionId = [...this.state.players.entries()].find(([, p]) => p === player)?.[0] ?? "";
    if (!this.escenario.canEnter(map, sessionId, player, x, y, this.state.players)) return false;
    const zone = zoneAt(map, x, y);
    if (zone?.type !== "office") return true;
    const office = this.state.offices.get(zone.id);
    if (!office?.locked || !office.ownerId) return true;
    return office.ownerId === player.userId || office.guests.includes(player.userId);
  }

  private handleLock(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = OfficeLockMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const office = [...this.state.offices.values()].find((o) => o.ownerId === player.userId);
    if (!office || office.locked === parsed.data.locked) return;
    // La puerta la movió a mano: al terminar el foco ya no se vuelve a abrir sola.
    const claim = this.focusClaims.get(player.userId);
    if (claim) delete claim.lockedZone;
    this.setOfficeLocked(office, parsed.data.locked);
  }

  /** Abre o cierra una oficina (quien ya está adentro queda como invitado) y lo guarda. */
  private setOfficeLocked(office: OfficeInfo, locked: boolean) {
    office.locked = locked;
    office.guests.clear();
    if (office.locked) {
      // Quien ya está adentro queda como invitado: cerrar no expulsa a nadie.
      for (const p of this.state.players.values()) {
        if (p.zoneId === office.zoneId && p.userId !== office.ownerId && !office.guests.includes(p.userId)) {
          office.guests.push(p.userId);
        }
      }
    }
    this.repo.setOfficeLocked(office.zoneId, office.locked).catch((err) => console.error("setOfficeLocked", err));
  }

  /** Quién usa una pizarra: la zona donde tiene los pies, su tipo y si es el dueño de esa oficina. */
  private withBoard(client: Client<UserData>, fn: (who: BoardWho) => Promise<void>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const zone = zoneAt(this.mapOf(player.area), player.x, player.y);
    client.userData.lastActiveAt = Date.now();
    const who: BoardWho = {
      sessionId: client.sessionId,
      userId: player.userId,
      zoneId: zone?.id ?? "",
      zoneType: zone?.type ?? "",
      owner: Boolean(zone && this.state.offices.get(zone.id)?.ownerId === player.userId),
    };
    fn(who).catch((err) => console.error("pizarra", err));
  }

  /**
   * La radio de la oficina: el dueño pone un video (con su título de oEmbed), la pausa, la sigue o la
   * apaga. La duración la informa cualquiera que esté adentro (la primera vale): así da la vuelta.
   */
  private async handleOfficeRadio(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = OfficeRadioMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const msg = parsed.data;
    const now = Date.now();
    if (msg.action === "duration") {
      const office = this.state.offices.get(player.zoneId);
      if (office && office.radioVideo === msg.videoId && !office.radioDurationMs && msg.ms > 0)
        office.radioDurationMs = Math.min(CLUB_VIDEO.maxDurationMs, Math.max(CLUB_VIDEO.minDurationMs, msg.ms));
      return;
    }
    const fail = (error: OfficeRadioError) => client.send(MSG.officeRadioResult, { ok: false, error } satisfies OfficeRadioResult);
    const office = [...this.state.offices.values()].find((o) => o.ownerId === player.userId);
    if (!office) return fail("not-owner");
    switch (msg.action) {
      case "set": {
        const videoId = parseYoutubeId(msg.url);
        if (!videoId) return fail("not-youtube");
        const info = await OfficeRoom.youtubeLookup(videoId).catch(() => ({ ok: true as const, title: FALLBACK_TITLE }));
        if (!info.ok) return fail(info.error);
        // Mientras se buscaba el video la oficina pudo cambiar de dueño.
        if (office.ownerId !== player.userId) return fail("not-owner");
        office.radioVideo = videoId;
        office.radioTitle = info.title.slice(0, CLUB_VIDEO.maxTitle);
        office.radioStartedAt = Date.now();
        office.radioPaused = false;
        office.radioPausedAt = 0;
        office.radioDurationMs = 0;
        return;
      }
      case "pause":
        if (!office.radioVideo || office.radioPaused) return;
        office.radioPausedAt = now - office.radioStartedAt;
        office.radioPaused = true;
        return;
      case "resume":
        if (!office.radioVideo || !office.radioPaused) return;
        office.radioStartedAt = now - office.radioPausedAt;
        office.radioPaused = false;
        office.radioPausedAt = 0;
        return;
      case "stop":
        this.stopRadio(office);
        return;
    }
  }

  private stopRadio(office: OfficeInfo) {
    office.radioVideo = "";
    office.radioTitle = "";
    office.radioStartedAt = 0;
    office.radioPaused = false;
    office.radioPausedAt = 0;
    office.radioDurationMs = 0;
  }

  /** La nota de la placa de la puerta: solo el dueño de la oficina, una línea corta. */
  private handleOfficeNote(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = OfficeNoteMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const office = [...this.state.offices.values()].find((o) => o.ownerId === player.userId);
    if (!office) return;
    // Escribió su propia nota durante el foco: esa se queda.
    const claim = this.focusClaims.get(player.userId);
    if (claim) delete claim.note;
    office.note = cleanOfficeNote(parsed.data.note);
  }

  private async handleKnock(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = KnockMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    // El timbre de una casa: `zoneId` es el nivel de afuera de esa casa.
    if (isCasaArea(parsed.data.zoneId)) {
      const ownerId = casaOwnerOf(parsed.data.zoneId);
      if (ownerId && ownerId !== player.userId) {
        const ownerName = this.state.casas.get(ownerId)?.ownerName || [...this.state.players.values()].find((p) => p.userId === ownerId)?.name || "La casa";
        this.sendTrick(client, await this.brujas.trickDoor(player, "casa", ownerId, ownerName, null));
      }
      return this.handleCasaRing(client, player, parsed.data.zoneId);
    }
    const office = this.state.offices.get(parsed.data.zoneId);
    if (!office || !office.ownerId || office.ownerId === player.userId) return;

    const reply = (outcome: KnockOutcome) =>
      client.send(MSG.knockResult, { zoneId: office.zoneId, outcome, ownerName: office.ownerName } satisfies KnockResult);

    // Noche de brujas con la canasta en la mano y frente a la puerta: además de tocar, dulce o truco.
    const zone = this.zonesById.get(office.zoneId);
    const area = this.areaOfZone.get(office.zoneId);
    const door = zone?.door && area ? { area, ...officeDoor(zone) } : null;
    const trick = door ? await this.brujas.trickDoor(player, "puerta", office.zoneId, office.ownerName, door) : null;
    this.sendTrick(client, trick);
    // Con la puerta abierta, pedir dulce no es tocar para entrar.
    if (!office.locked || office.guests.includes(player.userId)) return trick ? undefined : reply("not-locked");

    const key = `${player.userId}:${office.zoneId}`;
    const now = Date.now();
    if (now - (this.lastKnockAt.get(key) ?? 0) < KNOCK_COOLDOWN_MS) return reply("too-soon");
    this.lastKnockAt.set(key, now);

    const owner = this.clientOfUser(office.ownerId);
    if (!owner) return reply("owner-away");
    // En "No molestar" no le llegan toques (el que toca se entera y no queda esperando).
    if (this.state.players.get(owner.sessionId)?.status === "dnd") return reply("dnd");

    const requestId = randomUUID();
    const timer = this.clock.setTimeout(() => {
      this.pendingKnocks.delete(requestId);
      this.clients.getById(client.sessionId)?.send(MSG.knockResult, {
        zoneId: office.zoneId,
        outcome: "timeout",
        ownerName: office.ownerName,
      } satisfies KnockResult);
    }, KNOCK_TIMEOUT_MS);
    this.pendingKnocks.set(requestId, {
      requestId,
      zoneId: office.zoneId,
      requesterSessionId: client.sessionId,
      requesterUserId: player.userId,
      timer,
    });
    owner.send(MSG.knockRequest, { requestId, zoneId: office.zoneId, fromName: player.name } satisfies KnockRequest);
    this.achievements.bump(player.userId, STAT_KEYS.knocks);
  }

  /** La respuesta del dulce o truco: a quien pidió, y si fue truco, su cinemática corta. */
  private sendTrick(client: Client<UserData>, result: TrickResult | null) {
    if (!result) return;
    client.send(BRUJAS_MSG.trickResult, result satisfies TrickResult);
    if (result.ok && result.outcome.kind === "truco") client.send(FESTIVAL_MSG.cine, { id: BRUJAS_CINE.truco(result.outcome.truco) } satisfies FestivalCineEvent);
  }

  /** Dulce o truco a un NPC (ver nocheBrujas.ts). */
  private async handleBrujasTrick(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.drunk.fainted(player.userId)) return;
    this.markActive(client);
    this.sendTrick(client, await this.brujas.trickNpc(player, raw));
  }

  /** La calabaza dorada del laberinto: a la mochila y su cinemática. */
  private async handleBrujasPumpkin(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.drunk.fainted(player.userId)) return;
    this.markActive(client);
    const result = await this.brujas.pumpkin(player);
    client.send(BRUJAS_MSG.pumpkinResult, result satisfies PumpkinResult);
    if (result.ok) client.send(FESTIVAL_MSG.cine, { id: BRUJAS_CINE.calabaza } satisfies FestivalCineEvent);
  }

  /** El puesto del caldero (junto a su punto). */
  private async handleBrujasBuy(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.markActive(client);
    const near = nearPointOfType(this.mapOf(player.area), "festival_shop", player.x, player.y) && !this.drunk.fainted(player.userId);
    const result = await this.brujas.buy(player.userId, raw, near);
    if (!result) return;
    if (result.ok) {
      for (const p of this.state.players.values()) if (p.userId === player.userId) p.points = result.balance;
      this.achievements.bump(player.userId, `${STAT_PREFIX.order}${result.item}`);
    }
    client.send(BRUJAS_MSG.buyResult, result satisfies BrujasBuyResult);
  }

  private handleKnockRespond(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = KnockRespondMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const knock = this.pendingKnocks.get(parsed.data.requestId);
    if (knock && isCasaArea(knock.zoneId)) return this.respondCasaRing(player, knock, parsed.data.accept);
    const office = knock && this.state.offices.get(knock.zoneId);
    if (!knock || !office || office.ownerId !== player.userId) return;

    knock.timer.clear();
    this.pendingKnocks.delete(knock.requestId);
    const accepted = parsed.data.accept;
    if (accepted && !office.guests.includes(knock.requesterUserId)) office.guests.push(knock.requesterUserId);
    this.clients.getById(knock.requesterSessionId)?.send(MSG.knockResult, {
      zoneId: office.zoneId,
      outcome: accepted ? "accepted" : "declined",
      ownerName: office.ownerName,
    } satisfies KnockResult);
  }

  // ---------- Teléfono ----------

  /**
   * Llamar a la oficina `zoneId`: hay que estar junto a un teléfono y la oficina tiene que tener dueño; le
   * suena a esa persona esté donde esté (ocupado, "No molestar" y desconectado los decide `Phones`). Con
   * `userId`, a una persona del directorio (las reglas y la pausa son las de comunicacion.ts).
   */
  private handlePhoneCall(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = PhoneCallMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.markActive(client);
    const office = "zoneId" in parsed.data ? this.state.offices.get(parsed.data.zoneId) : undefined;
    const fail = (error: PhoneError) =>
      client.send(MSG.phoneEvent, { kind: "failed", error, withName: office?.ownerName ?? "" } satisfies PhoneEvent);
    const map = this.mapOf(player.area);
    const phone = phoneInReach(map, player.x, player.y);
    if (!phone) return fail("far");
    const ts = map.tileSize;
    const zone = zoneAt(map, (phone.x + phone.w / 2) * ts, (phone.y + phone.d / 2) * ts);
    if ("userId" in parsed.data) return this.comunicacion?.phoneCall(client.sessionId, parsed.data.userId, this.phoneOrigin(player.userId, zone, phone.type));
    if (!office?.ownerId) return fail("invalid");
    if (office.ownerId === player.userId) return fail("self");
    const owner = [...this.state.players.values()].find((p) => p.userId === office.ownerId);
    const error = this.phones.call(
      { userId: player.userId, name: player.name, status: player.status },
      owner && { userId: owner.userId, name: owner.name, status: owner.status },
      this.phoneOrigin(player.userId, zone, phone.type),
    );
    if (error) fail(error);
    else this.achievements.bump(player.userId, STAT_KEYS.phoneCalls);
  }

  /** Llamar sin teléfono, llamadas grupales, saludar y el anuncio del admin (ver rooms/comunicacion.ts). */
  private comunicacion?: Comunicacion;

  /** Cómo se completa "te llama desde …" según dónde está el teléfono. */
  private phoneOrigin(callerId: string, zone: Zone | undefined, type: string): string {
    if (zone?.type === "office") {
      const office = this.state.offices.get(zone.id);
      if (office?.ownerId === callerId) return "su oficina";
      return office?.ownerName ? `la oficina de ${office.ownerName}` : `la ${zone.name}`;
    }
    if (type === "desk-phone-counter") return "la recepción";
    return zone ? zone.name : "un teléfono de la cabaña";
  }

  /** Al salir de una oficina, el invitado pierde el permiso. */
  private revokeGuestOnExit(player: Player, previousZoneId: string) {
    if (!previousZoneId || previousZoneId === player.zoneId) return;
    const office = this.state.offices.get(previousZoneId);
    if (!office) return;
    const i = office.guests.indexOf(player.userId);
    if (i >= 0) office.guests.splice(i, 1);
  }

  // ---------- Movimiento, chat y estado ----------

  private handleMove(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = MoveMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const { x, y, moving } = parsed.data;
    let { dir } = parsed.data;
    const seated = parsed.data.seated ?? false;
    // Los rechazos de un paso llevan su `seq`: así el cliente ignora los de pasos que ya superó.
    const seq = parsed.data.seq === undefined ? {} : { seq: parsed.data.seq };

    const map = this.mapOf(player.area);
    // Desmayado no se mueve (el cliente ya lo sabe; esto es por si insiste).
    if (this.drunk.fainted(player.userId)) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, ...seq } satisfies MoveCorrection);
      return;
    }
    const now = Date.now();
    const dt = (now - client.userData.lastMoveAt) / 1000;
    client.userData.lastMoveAt = now;
    // Tolerancia: latencia/jitter + mínimo de medio tile. Sentarse y levantarse "saltan" hasta
    // el asiento (p. ej. del tile de enfrente a la silla), así que ahí se permite algo más.
    const snap = seated !== player.seated ? map.tileSize * SEAT_REACH_TILES : 0;
    // En la carrera de sillas se va más rápido; con la energía de un plato de la cocina, también; trabado
    // (lo del Man del Sombrero: trabado o con la keta) o nadando, más lento.
    const tripMul = tripSpeedMul(this.trips.get(player.userId)?.kind);
    const swim = player.swimming;
    const speed =
      PLAYER_SPEED *
      (player.racing ? CHAIR_RACE.speedMul : this.cocina.speedMul(player.userId, OfficeRoom.cocinaNow())) *
      tripMul *
      (swim ? AGUA.swimSpeedMul : 1);
    const maxDist = Math.max(map.tileSize * 0.75, dt * speed * 1.6, snap);
    const dist = Math.hypot(x - player.x, y - player.y);

    // Sentado: la posición debe ser la de un asiento libre (los muebles bloquean el paso, así que
    // no se valida canStandAt) y se mira hacia donde mira el asiento. De pie: el tramo desde la
    // posición anterior no puede cruzar paredes (son bordes delgados entre tiles). Nadando, solo se
    // está en el agua de la piscina (se sale con E, por el borde) y no se sienta nadie.
    const seat = seated ? seatAtPoint(map, x, y) : undefined;
    const fromSeat = player.seated && !seated;
    const validSpot = swim
      ? !seated && canSwimAt(map, x, y) && canSwimBetween(map, player.x, player.y, x, y)
      : seated
        ? Boolean(seat) && !this.seatTaken(client.sessionId, map.id, x, y)
        : canStandAt(map, x, y) && (fromSeat || canWalkBetweenAxes(map, player.x, player.y, x, y));
    if (seat) dir = seat.facing;

    if (dist > maxDist || !validSpot || !this.canAccess(player, x, y)) {
      const correction: MoveCorrection = { x: player.x, y: player.y, ...seq };
      client.send(MSG.moveCorrection, correction);
      // Sentarse en una silla que ganó otra persona: la corrección sola dejaba de pie sin decir por qué.
      if (seated && !player.seated && seat && this.seatTaken(client.sessionId, map.id, x, y)) this.rechazo(client, "seatTaken");
      return;
    }

    const previousZoneId = player.zoneId;
    // El asiento que deja (si se para o se cambia a otro): al salir de la tina o de la sauna, mojado.
    const leftSeat = player.seated && (!seated || x !== player.x || y !== player.y) ? seatAtPoint(map, player.x, player.y)?.type : undefined;
    if (x !== player.x || y !== player.y) {
      client.userData.lastActiveAt = now;
      // Casa viva: moverse te saca del cubículo del baño.
      this.casa.leaveStall(player.userId);
    }
    player.x = x;
    player.y = y;
    player.dir = dir;
    player.moving = seated ? false : moving;
    const wasSeated = player.seated;
    player.seated = seated;
    player.zoneId = zoneAt(map, x, y)?.id ?? "";
    // La historia (paso 2): sentarse en la oficina propia.
    if (seated && !wasSeated && this.state.offices.get(player.zoneId)?.ownerId === player.userId) this.achievements.bump(player.userId, STAT_KEYS.ownOfficeSits);
    player.place = placeAt(map, x, y);
    this.revokeGuestOnExit(player, previousZoneId);
    if (previousZoneId !== player.zoneId) this.autoStatus.refreshMeetings();
    this.whiteboards.moved(client.sessionId, player.zoneId);
    this.focus.moved(player.userId, player.zoneId);
    this.fishery.moved(player.userId, x, y, seated);
    this.trades.moved(client.sessionId);
    this.club.moved({ sessionId: client.sessionId, area: player.area, x, y, seated });
    if (player.racing) void this.raceOutcome(client.sessionId, this.races.moved(map, client.sessionId, player, now));
    if (!seated && !fromSeat && dist > 0) this.achievements.walk(player.userId, dist / map.tileSize);
    if (leftSeat && leftSeat !== seat?.type) this.tina?.stoodUp(player.userId, leftSeat);
  }

  /** Pasar a otro nivel por un portal: hay que estar parado junto a él. */
  private handleTravel(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = TravelMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const map = this.mapOf(player.area);
    const portal = map.portals.find((p) => p.id === parsed.data.portal);
    if (!portal || player.seated || player.swimming || this.drunk.fainted(player.userId) || !nearPortal(map, portal, player.x, player.y)) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      return;
    }
    // La casa del árbol: cupo y escalera recogida (el cliente lo anticipa; aquí se decide).
    const blocked = portal.to.area === CASA_ARBOL.area ? this.casaArbol.canEnter(player.userId) : null;
    if (blocked) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      client.send(CASA_ARBOL_MSG.notice, { code: blocked } satisfies CasaArbolNotice);
      return;
    }
    // El estudio de grabación: lleno, o pidiendo permiso o grabando (el cartel de la puerta prendido).
    const onAir = portal.to.area === PODCAST.area ? this.podcast.canEnter(player.userId, this.podcastInside()) : null;
    if (onAir) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      client.send(PODCAST_MSG.notice, { code: onAir } satisfies PodcastNotice);
      return;
    }
    // La casa de otra persona: según su modo y si el dueño lo dejó pasar.
    const ajena = this.casas.canEnter(portal.to.area, player.userId);
    if (ajena) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      client.send(CASA_PROPIA_MSG.notice, { code: ajena } satisfies CasaPropiaNotice);
      return;
    }
    // Del Megabús solo se baja con el bus en la estación y las puertas abiertas (nunca en ruta).
    if (map.id === BUS.area && !this.bus.doorsOpen()) {
      client.send(BUS_MSG.notice, { code: "route" } satisfies BusNotice);
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      return;
    }
    const target = this.mapOf(portal.to.area);
    const ts = target.tileSize;
    const pos = this.freeSpotNear(target, portal.to.x * ts + ts / 2, portal.to.y * ts + ts / 2);
    this.casa.leaveStall(player.userId);
    const previousZoneId = player.zoneId;
    player.area = target.id;
    player.x = pos.x;
    player.y = pos.y;
    player.dir = portal.to.facing;
    player.moving = false;
    player.zoneId = zoneAt(target, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(target, pos.x, pos.y);
    this.revokeGuestOnExit(player, previousZoneId);
    this.whiteboards.moved(client.sessionId, player.zoneId);
    this.focus.moved(player.userId, player.zoneId);
    client.userData.lastMoveAt = Date.now();
    this.fishery.cancel(player.userId);
    this.achievements.visit(player.userId, target.id);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
    this.trades.moved(client.sessionId);
    void this.raceOutcome(client.sessionId, this.races.cancel(client.sessionId, player, "lane"));
    this.casaArbol.sweep(Date.now());
    this.sweepCasaGuests();
    // Salir del estudio (o entrar) cambia a quiénes cuenta el acuerdo para grabar: se revisa ya.
    this.sendPodcastNotices(this.podcast.sync(this.podcastInside(), Date.now()));
  }

  /** Algo de la casa del árbol (la escalera, el modo foco): solo desde adentro; cuenta como actividad. */
  private withTreeHouse(client: Client<UserData>, fn: (player: Player) => boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    if (fn(player)) client.userData.lastActiveAt = Date.now();
  }

  // ---------- Viaje rápido (viaje.ts) ----------

  /** Reloj y pausa del viaje rápido (los tests los fijan). */
  static viajeNow: () => number = () => Date.now();
  static viajeCooldownMs: number = VIAJE.cooldownMs;
  private quickTravel!: QuickTravel;

  private startViaje() {
    this.quickTravel = new QuickTravel({
      players: this.state.players,
      offices: this.state.offices,
      map: (area) => this.mapOf(area),
      areas: () => this.world.areas.values(),
      now: () => OfficeRoom.viajeNow(),
      cooldownMs: () => OfficeRoom.viajeCooldownMs,
      fainted: (userId) => this.drunk.fainted(userId),
      playing: (_sessionId, p) => this.hockey.sideOf(p.userId) !== null,
      busDoorsOpen: () => this.bus.doorsOpen(),
      treeHouse: (userId) => this.casaArbol.canEnter(userId),
      studio: (userId) => this.podcast.canEnter(userId, this.podcastInside()),
    });
    this.onMessage(VIAJE_MSG.go, (client, raw) => this.handleQuickTravel(client, raw));
  }

  /** Ir de una a un lugar o junto a alguien: lo mismo que al llegar por un portal, pero a cualquier punto. */
  private handleQuickTravel(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const plan = this.quickTravel.plan(client.sessionId, player, raw);
    if (!plan.ok) return client.send(VIAJE_MSG.notice, plan.notice satisfies ViajeNotice);
    this.quickTravel.done(player.userId);
    const target = this.mapOf(plan.area);
    const previousZoneId = player.zoneId;
    this.casa.leaveStall(player.userId);
    this.fishery.cancel(player.userId);
    player.area = target.id;
    player.x = plan.x;
    player.y = plan.y;
    player.dir = plan.dir;
    player.moving = false;
    player.seated = false;
    player.zoneId = zoneAt(target, plan.x, plan.y)?.id ?? "";
    player.place = placeAt(target, plan.x, plan.y);
    this.revokeGuestOnExit(player, previousZoneId);
    if (previousZoneId !== player.zoneId) this.autoStatus.refreshMeetings();
    this.whiteboards.moved(client.sessionId, player.zoneId);
    this.focus.moved(player.userId, player.zoneId);
    this.club.moved({ sessionId: client.sessionId, area: player.area, x: plan.x, y: plan.y, seated: false });
    client.userData.lastMoveAt = Date.now();
    client.userData.lastActiveAt = Date.now();
    this.achievements.visit(player.userId, target.id);
    client.send(MSG.moveCorrection, { x: plan.x, y: plan.y, area: target.id } satisfies MoveCorrection);
    this.sweepCasaGuests();
    this.trades.moved(client.sessionId);
    this.escenario.sweep(this.state.players);
    this.casaArbol.sweep(Date.now());
    this.sendPodcastNotices(this.podcast.sync(this.podcastInside(), Date.now()));
  }

  // ---------- Carrera de sillas ----------

  /** E junto a la bandera: largar (el tiempo corre desde ahora, con el reloj del servidor). */
  private handleRaceStart(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData || !RaceStartMessage.safeParse(raw).success) return;
    const problem = this.races.start(this.mapOf(player.area), client.sessionId, player, Date.now());
    client.userData.lastActiveAt = Date.now();
    if (problem) client.send(MSG.raceResult, { ok: false, problem } satisfies RaceResult);
  }

  /** Terminó (o se anuló) una carrera: el tiempo se guarda, llega a quien corrió y a los de su nivel. */
  private async raceOutcome(sessionId: string, outcome: RaceOutcome) {
    if (!outcome) return;
    const client = this.clients.getById(sessionId);
    const player = this.state.players.get(sessionId);
    if (outcome.kind === "cancel") {
      client?.send(MSG.raceResult, { ok: false, problem: outcome.problem } satisfies RaceResult);
      return;
    }
    if (!player) return;
    this.achievements.bump(player.userId, STAT_KEYS.racesFinished);
    const before = await this.raceBoards.get(player.userId, Date.now()).catch(orElse("raceBoard", null, { userId: player.userId }));
    await this.repo.saveRaceTime({ userId: player.userId, name: player.name, ms: outcome.ms }).catch((err) => console.error("saveRaceTime", err));
    this.raceBoards.invalidate();
    const board = await this.raceBoards.get(player.userId, Date.now()).catch(orElse("raceBoard", { entries: [], myBest: outcome.ms }, { userId: player.userId }));
    const best = before?.myBest == null || outcome.ms < before.myBest;
    const record = !before?.entries[0] || outcome.ms < before.entries[0].ms;
    client?.send(MSG.raceResult, { ok: true, ms: outcome.ms, best, board } satisfies RaceResult);
    const event: RaceEvent = { sessionId, name: player.name, ms: outcome.ms, record };
    this.sendToArea(player.area, MSG.raceEvent, event);
  }

  private async sendRaceBoard(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const board = await this.raceBoards.get(player.userId, Date.now()).catch(orElse("raceBoard", null, { userId: player.userId }));
    if (board) client.send(MSG.raceBoardResult, board);
  }

  /** Se pasó de tragos: se le cae lo que tenía en la mano, vomita y queda en el piso (lo ve su nivel). */
  private blackout(userId: string) {
    this.achievements.bump(userId, STAT_KEYS.blackouts);
    // Lo de la mano no se pierde: sigue en la mochila.
    this.fishery.cancel(userId);
    for (const [sessionId, p] of this.state.players) {
      if (p.userId !== userId) continue;
      p.moving = false;
      p.seated = false;
      this.sendToArea(p.area, MSG.drunkBlackout, { sessionId } satisfies DrunkBlackoutEvent);
    }
  }

  /**
   * Se despierta del desmayo descansando en la casa: sentado en un asiento libre de la zona de descanso del
   * piso 2 (o de pie ahí mismo, si están todos ocupados).
   */
  private wakeToRest(userId: string) {
    const map = this.mapOf(DRUNK.restArea);
    const restSeats = [...map.seats.values()].filter((s) => zoneAt(map, s.x, s.y)?.id === DRUNK.restZone);
    for (const [sessionId, player] of this.state.players) {
      if (player.userId !== userId) continue;
      const free = restSeats.filter((s) => !this.seatTaken(sessionId, map.id, s.x, s.y));
      // Los sofás primero (se descansa mejor que en una banqueta).
      const seat = free.find((s) => s.type.includes("sofa")) ?? free[0];
      const near = restSeats[0] ?? { x: map.tileSize, y: map.tileSize };
      const pos = seat ?? this.freeSpotNear(map, near.x, near.y);
      const previousZoneId = player.zoneId;
      player.area = map.id;
      player.x = pos.x;
      player.y = pos.y;
      player.moving = false;
      player.swimming = false;
      player.seated = Boolean(seat);
      if (seat) player.dir = seat.facing;
      player.zoneId = zoneAt(map, pos.x, pos.y)?.id ?? "";
      player.place = placeAt(map, pos.x, pos.y);
      this.revokeGuestOnExit(player, previousZoneId);
      this.whiteboards.moved(sessionId, player.zoneId);
      const client = this.clients.getById(sessionId);
      if (client?.userData) client.userData.lastMoveAt = Date.now();
      client?.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: map.id, seated: Boolean(seat) } satisfies MoveCorrection);
    }
    // Despertó en la zona de descanso (una vez por desmayo, aunque tenga dos pestañas).
    if ([...this.state.players.values()].some((p) => p.userId === userId)) {
      this.achievements.bump(userId, STAT_KEYS.sofaNaps);
      this.achievements.visit(userId, map.id);
    }
  }

  /** ¿Hay otra persona sentada en (x, y) de ese nivel? (Varios pisos tienen asientos en las mismas coordenadas.) */
  private seatTaken(sessionId: string, area: string, x: number, y: number) {
    for (const [id, p] of this.state.players) {
      if (id !== sessionId && p.seated && p.area === area && Math.abs(p.x - x) <= 0.5 && Math.abs(p.y - y) <= 0.5) return true;
    }
    return false;
  }

  /**
   * La persona cambió su nombre o personaje desde la web. No se confía en lo que manda el
   * cliente: se vuelve a leer de la base y se refleja para todos, sin reconectar.
   */
  private async handleProfileChanged(client: Client<UserData>) {
    const userId = this.state.players.get(client.sessionId)?.userId;
    if (!userId) return;
    // La insignia destacada también se elige en la web (el perfil).
    void this.refreshBadge(userId);
    // Pudo cambiar su nombre o su cumpleaños: la lista de quién cumple hoy se vuelve a leer.
    void this.events.refresh(true);
    const profile = await this.repo.getUserProfile(userId).catch((err) => {
      console.error("getUserProfile", err);
      return null;
    });
    const player = this.state.players.get(client.sessionId); // pudo irse mientras tanto
    if (!profile || !player) return;
    player.name = profile.name;
    this.phones.rename(userId, profile.name);
    player.avatar = profile.avatar;
    player.look = profile.look ? JSON.stringify(profile.look) : "";
  }

  /**
   * La insignia destacada junto al nombre: la guardada en la base, solo si es de un logro que tiene (lo
   * que sabe el rastreador de logros, no lo que diga el cliente). Si no, ninguna.
   */
  private async refreshBadge(userId: string) {
    const saved = await this.repo.getFeaturedBadge(userId).catch((err) => {
      console.error("getFeaturedBadge", err);
      return null;
    });
    await this.achievements.load(userId);
    const badge = validFeaturedBadge(saved, this.achievements.snapshot(userId)?.unlocked ?? []);
    for (const p of this.state.players.values()) if (p.userId === userId && p.badge !== badge) p.badge = badge;
  }

  private handleStatus(client: Client<UserData>, raw: unknown) {
    const parsed = StatusMessage.safeParse(raw);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    this.autoStatus.setManual(client.sessionId, parsed.data.status, true);
    this.repo.setUserStatus(player.userId, parsed.data.status).catch((err) => console.error("setUserStatus", err));
  }

  /** Solo en desarrollo: "/ir <nivel> [punto]" (ver devtools.ts). Devuelve si era el comando. */
  private devJump(client: Client<UserData>, player: Player, text: string): boolean {
    // "/ir casa" (la tuya) o "/ir casa:<userId>[:piso]": con la misma regla que todos los caminos.
    const casa = parseCasaJump(text, player.userId);
    if (casa) {
      const ajena = this.casas.canEnter(casa.area, player.userId);
      if (ajena) client.send(CASA_PROPIA_MSG.notice, { code: ajena } satisfies CasaPropiaNotice);
      else this.devTeleport(client, player, casa.area, casa.x, casa.y);
      return true;
    }
    const jump = parseDevJump(text, getWorld().areas);
    if (!jump) return false;
    if ("error" in jump) {
      const note: ChatEvent = { id: randomUUID(), fromId: "", fromName: "Dev", text: jump.error, scope: "proximity", zoneId: null, ts: Date.now() };
      client.send(MSG.chatEvent, note);
      return true;
    }
    this.devTeleport(client, player, jump.area, jump.x, jump.y);
    return true;
  }

  /** Solo desarrollo: lleva a alguien junto a un tile de un nivel (sin caminar ni portal). */
  private devTeleport(client: Client<UserData>, player: Player, area: string, tx: number, ty: number) {
    const target = this.mapOf(area);
    const ts = target.tileSize;
    const pos = this.freeSpotNear(target, tx * ts + ts / 2, ty * ts + ts / 2);
    player.area = target.id;
    player.x = pos.x;
    player.y = pos.y;
    player.moving = false;
    player.seated = false;
    player.swimming = false;
    player.zoneId = zoneAt(target, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(target, pos.x, pos.y);
    client.userData!.lastMoveAt = Date.now();
    this.achievements.visit(player.userId, target.id);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
    this.sweepCasaGuests();
  }

  /** Solo en desarrollo: "/sombrero [escondite]" lo hace salir ya y lleva ahí a quien lo pidió. */
  private devSombrero(client: Client<UserData>, player: Player, text: string): boolean {
    const cmd = parseDevSombrero(text);
    if (cmd === false) return false;
    const note = (msg: string) =>
      client.send(MSG.chatEvent, { id: randomUUID(), fromId: "", fromName: "Dev", text: msg, scope: "proximity", zoneId: null, ts: Date.now() } satisfies ChatEvent);
    if ("error" in cmd) {
      note(cmd.error);
      return true;
    }
    const h = this.sombrero.summon(cmd.hideout);
    // Al lado (un tile al frente de donde mira), no encima.
    this.devTeleport(client, player, h.area, h.x + (h.facing === "right" ? 1 : 0), h.y + (h.facing === "down" ? 1 : 0));
    note(`El Man del Sombrero está ${h.place} (${h.area}). Se queda hasta el próximo día del juego.`);
    return true;
  }

  /** Solo en desarrollo: "/festival <id|off>" prende un festival ya (ver devtools.ts). Devuelve si era el comando. */
  private devFestival(client: Client<UserData>, text: string): boolean {
    const cmd = parseDevFestival(text);
    if (!cmd) return false;
    const reply = "error" in cmd ? cmd.error : cmd.id ? `Festival prendido: ${cmd.id}.` : "Festivales según el calendario.";
    if (!("error" in cmd)) this.festivales.force(cmd.id);
    client.send(MSG.chatEvent, { id: randomUUID(), fromId: "", fromName: "Dev", text: reply, scope: "proximity", zoneId: null, ts: Date.now() } satisfies ChatEvent);
    return true;
  }

  /** Solo en desarrollo: "/clima <tipo>" pone ese clima ya (ver devtools.ts). Devuelve si era el comando. */
  private devWeather(client: Client<UserData>, text: string): boolean {
    const w = parseDevWeather(text);
    if (!w) return false;
    if (typeof w === "object") {
      const note: ChatEvent = { id: randomUUID(), fromId: "", fromName: "Dev", text: w.error, scope: "proximity", zoneId: null, ts: Date.now() };
      client.send(MSG.chatEvent, note);
      return true;
    }
    this.weather.force(w);
    return true;
  }

  /** Reloj del juego de la sala (el mismo que ven todos en `state`). */
  gameClock(): GameClockState {
    return { anchorReal: this.state.clockAnchorReal, anchorMinute: this.state.clockAnchorMinute, paused: this.state.clockPaused };
  }

  /** Hora del juego ahora. */
  gameTimeNow(): GameTime {
    return gameTime(this.gameClock(), OfficeRoom.gameClockNow());
  }

  private setGameClock(c: GameClockState) {
    this.state.clockAnchorReal = c.anchorReal;
    this.state.clockAnchorMinute = c.anchorMinute;
    this.state.clockPaused = Boolean(c.paused);
  }

  /** La estación del calendario del juego ahora (ver calendario.ts). */
  gameSeason(): Season {
    return estacionDelDia(this.gameTimeNow().day);
  }

  /** Entra alguien a la sala vacía: el reloj sigue desde el minuto en que quedó. */
  private resumeGameClock() {
    if (this.state.clockPaused) this.setGameClock(resumeClock(this.gameClock(), OfficeRoom.gameClockNow()));
  }

  /**
   * Salió el último: el reloj se queda quieto (así no pasan días ni estaciones sin nadie) y se guarda el
   * minuto en que quedó. Quien espera para reconectarse sigue en `players`: mientras, el reloj corre.
   */
  private pauseGameClockIfEmpty() {
    if (this.state.clockPaused || this.state.players.size > 0 || this.clients.length > 0) return;
    this.setGameClock(pauseClock(this.gameClock(), OfficeRoom.gameClockNow()));
    void this.saveClock();
  }

  /** Guarda el reloj (en pausa, con el minuto en que va) y la estación de los encargos. */
  private saveClock(userId = ""): Promise<void> {
    const clock = { ...pauseClock(this.gameClock(), OfficeRoom.gameClockNow()), questSeasons: { ...this.questSeasonMemo } };
    return this.repo.saveGameClock(clock, userId).catch((err) => console.error("saveGameClock", err));
  }

  /** Los festivales del calendario del juego (ver festivales.ts). */
  private festivales = new Festivales({
    state: () => this.state,
    time: () => this.gameTimeNow(),
    broadcast: (type, msg) => this.broadcast(type, msg),
  });
  /** El festival (y su día) cuya decoración tiene puesta esta sala, y para cuál ya repartió las canastas. */
  private festivalShown = { id: "", day: 0 };
  private basketsFor = "";

  /**
   * Sigue al festival de hoy: pone o quita su decoración (como los cambios del editor de la casa, sin tocar
   * el plano) y, al abrir la Noche de brujas, le da la canasta a todos los que están.
   */
  private syncFestival() {
    const id = this.state.festival;
    const day = this.gameTimeNow().day;
    this.state.festivalDia = id ? day : 0;
    const was = this.festivalShown;
    if (was.id !== id || (id && was.day !== day)) {
      this.festivalShown = { id, day };
      setFestivalDecor(id || null, day);
      for (const area of new Set([...festivalDecorAreas(was.id), ...festivalDecorAreas(id)])) this.rebuildArea(area);
    }
    const open = brujasActiva(id, this.state.festivalFase) ? `${id}:${day}` : "";
    if (open && this.basketsFor !== open && OfficeRoom.brujasCanasta) for (const p of this.state.players.values()) void this.brujas.giveBasket(p.userId);
    this.basketsFor = open;
  }

  /** La estación con que se vio el mundo la última vez (para notar el cambio). */
  private season: Season | null = null;

  /** Cambió la estación del juego: el huerto sigue con la nueva. */
  private checkSeason() {
    const season = this.gameSeason();
    if (season === this.season) return;
    const first = this.season === null;
    this.season = season;
    if (!first) this.huerto?.reseason(OfficeRoom.huertoNow());
  }

  /**
   * Con qué estación del juego se reparten los encargos de cada período: la de la primera vez que se
   * reparte en ese período (así lo asignado no cambia si la estación cambia a mitad del día o de la
   * semana). Se guarda con el reloj para que un reinicio tampoco lo cambie.
   */
  private questSeasonMemo: Record<string, Season> = {};
  private questSeasons(now: number): QuestSeasons {
    const day = dailyPeriod(now);
    const week = weeklyPeriod(now);
    const memo = this.questSeasonMemo;
    const daily = memo[day];
    const weekly = memo[week];
    if (daily && weekly) return { daily, weekly };
    const season = this.gameSeason();
    this.questSeasonMemo = { [day]: daily ?? season, [week]: weekly ?? season };
    void this.saveClock();
    return { daily: daily ?? season, weekly: weekly ?? season };
  }

  /**
   * "/time" (o "/hora"): cualquiera pregunta la hora; solo los admins la cambian (set/add, como en
   * Minecraft). La respuesta le llega solo a quien escribió. Devuelve si era el comando.
   */
  private timeCommand(client: Client<UserData>, text: string, scope: ChatScope): boolean {
    const cmd = parseTimeCommand(text);
    if (!cmd) return false;
    // Aviso del sistema (fromId vacío): se responde en la pestaña donde se escribió el comando.
    const note = (msg: string) =>
      client.send(MSG.chatEvent, { id: randomUUID(), fromId: "", fromName: "Reloj", text: msg, scope, zoneId: null, ts: Date.now() } satisfies ChatEvent);
    if (cmd.kind !== "query") {
      if (!client.userData?.admin) {
        note("Solo un admin puede cambiar la hora.");
        return true;
      }
      const now = OfficeRoom.gameClockNow();
      this.setGameClock(cmd.kind === "set" ? setGameTime(this.gameClock(), now, cmd.minuteOfDay) : addGameTime(this.gameClock(), now, cmd.minutes));
      // Se guarda para que un reinicio del servidor no deshaga el cambio.
      void this.saveClock(this.state.players.get(client.sessionId)?.userId ?? "");
      this.sombrero.refresh();
    }
    const t = this.gameTimeNow();
    note(`Día ${t.day + 1}, ${formatGameTime(t.minuteOfDay)}.`);
    return true;
  }

  /** Le dice a quien lo intentó por qué no se hizo (el texto lo pone el cliente). */
  private rechazo(client: Client<UserData>, code: RechazoCode) {
    client.send(RECHAZO_MSG.notice, { code } satisfies RechazoNotice);
  }

  private handleChat(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = ChatSendMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;

    const now = Date.now();
    const times = client.userData.chatTimes.filter((t) => now - t < CHAT_RATE.windowMs);
    if (times.length >= CHAT_RATE.max) return this.rechazo(client, "rate");
    times.push(now);
    client.userData.chatTimes = times;
    if (devToolsEnabled() && (this.devJump(client, player, parsed.data.text) || this.devWeather(client, parsed.data.text) || this.devFestival(client, parsed.data.text) || this.devSombrero(client, player, parsed.data.text))) return;
    if (this.timeCommand(client, parsed.data.text, parsed.data.scope)) return;
    this.achievements.bump(player.userId, STAT_KEYS.chatMessages);

    const event: ChatEvent = {
      id: randomUUID(),
      fromId: client.sessionId,
      fromName: player.name,
      text: parsed.data.text,
      scope: parsed.data.scope,
      zoneId: player.zoneId || null,
      ts: now,
    };

    if (event.scope === "global") {
      this.globalHistory.push(event);
      if (this.globalHistory.length > CHAT_HISTORY_SIZE) this.globalHistory.shift();
      this.broadcast(MSG.chatEvent, event);
      this.repo.saveChat(event, player.userId).catch((err) => console.error("saveChat", err));
      return;
    }

    const from = this.positioned(player);
    for (const other of this.clients) {
      const target = this.state.players.get(other.sessionId);
      if (!target) continue;
      if (other.sessionId === client.sessionId || canHear(from, this.positioned(target))) {
        other.send(MSG.chatEvent, event);
      }
    }
  }

  // ---------- Puntos ----------

  private markActive(client: Client<UserData>) {
    if (client.userData) client.userData.lastActiveAt = Date.now();
  }

  /**
   * Reparte los puntos de presencia: a quien tuvo actividad reciente y no está ausente. En la sala de
   * reuniones con alguien más, además los de reunión. Los topes diarios los aplica el repositorio.
   */
  private async presenceTick() {
    const now = Date.now();
    const inZone = new Map<string, number>();
    for (const p of this.state.players.values()) if (p.zoneId) inZone.set(p.zoneId, (inZone.get(p.zoneId) ?? 0) + 1);
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      const data = client.userData as UserData | undefined;
      // Concentrado en un bloque de foco cuenta como activo (está trabajando, aunque no toque la cabaña).
      const active = now - (data?.lastActiveAt ?? 0) <= OfficeRoom.idleMs || player?.focus === "work";
      if (!player || !data || player.status === "away" || !active) continue;
      this.countPresence(player, now);
      await this.award(client, player, POINTS.presence, "PRESENCE");
      const zone = this.zonesById.get(player.zoneId);
      if (zone?.type === "meeting" && (inZone.get(zone.id) ?? 0) >= 2) await this.award(client, player, POINTS.meeting, "MEETING");
    }
  }

  private async award(client: Client, player: Player, amount: number, reason: PointReason) {
    try {
      const { awarded, balance } = await this.repo.awardPoints({ userId: player.userId, amount, reason });
      player.points = balance;
      if (awarded > 0) client.send(MSG.pointsAwarded, { amount: awarded, reason, balance } satisfies PointsAwarded);
      this.achievements.max(player.userId, STAT_KEYS.pointsPeak, balance);
    } catch (err) {
      console.error("awardPoints", err);
    }
  }

  /** Tiempo activo en la cabaña (y en cada nivel y zona), y si es de madrugada o de noche. */
  private countPresence(player: Player, now: number) {
    const secs = Math.max(1, Math.round(OfficeRoom.presenceTickMs / 1000));
    const { userId } = player;
    this.achievements.bump(userId, STAT_KEYS.secondsOnline, secs);
    // Todas las casas de cada persona cuentan como un solo nivel (no una clave por casa).
    this.achievements.bump(userId, `${STAT_PREFIX.secArea}${statAreaOf(player.area)}`, secs);
    if (player.zoneId) this.achievements.bump(userId, `${STAT_PREFIX.secZone}${player.zoneId}`, secs);
    this.achievements.activeAt(userId, now);
  }

  private async reloadPoints(userId: string) {
    const players = [...this.state.players.values()].filter((p) => p.userId === userId);
    if (players.length === 0) return;
    const balance = await this.repo.getPoints(userId);
    for (const p of players) p.points = balance;
    // La web pudo cambiar la mochila (la tienda, un regalo abierto o mandado): se relee.
    await this.held.load(userId);
    // La web pudo sumar estadísticas (racha del buzón, misiones): se releen y se revisan los logros.
    await this.achievements.refresh(userId).catch((err) => console.error("achievements.refresh", err));
    this.achievements.max(userId, STAT_KEYS.pointsPeak, balance);
    // Y los encargos (una misión o una foto de la web pudieron avanzarlos).
    await this.encargos.load(userId, { force: true });
  }

  // ---------- Casino ----------

  private casinoSettings: CasinoSettingsDTO = { enabled: true };
  private roulette?: RouletteTable;
  private blackjack?: BlackjackTable;
  private readonly mesas = new Map<MesaId, MesaTable>();

  private async reloadCasinoSettings() {
    this.casinoSettings = await this.repo.getCasinoSettings().catch((err) => {
      console.error("getCasinoSettings", err);
      return this.casinoSettings;
    });
  }

  /** Arranca la mesa de ruleta del sótano (una sola por sala; las rondas corren solas). */
  private startCasino() {
    this.roulette = new RouletteTable({
      state: this.state.roulette,
      repo: () => this.repo,
      settings: () => this.casinoSettings,
      later: (ms, fn) => void this.clock.setTimeout(fn, ms),
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      },
      notify: (userId, settled: RouletteSettled, extra) => {
        for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.rouletteSettled, settled);
        this.casinoSettled(userId, settled.staked, settled.won);
        if (extra.straight) this.achievements.bump(userId, STAT_KEYS.rouletteStraights);
      },
      timings: () => OfficeRoom.rouletteTimings,
      spin: () => OfficeRoom.rouletteSpin(),
      rounds: this.casinoRounds,
    });
    this.roulette.start();
    for (const id of MESAS) {
      const state = new MesaState();
      this.state.mesas.set(id, state);
      const table = new MesaTable({
        id,
        state,
        repo: () => this.repo,
        settings: () => this.casinoSettings,
        later: (ms, fn) => void this.clock.setTimeout(fn, ms),
        setPoints: (userId, balance) => {
          for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
        },
        notify: (userId, settled: MesaSettled) => {
          for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.mesaSettled, settled);
          this.casinoSettled(userId, settled.staked, settled.won);
        },
        timings: () => OfficeRoom.mesaTimings,
        draw: (t) => OfficeRoom.mesaDraw(t),
        rounds: this.casinoRounds,
      });
      this.mesas.set(id, table);
      table.start();
    }
    this.blackjack = new BlackjackTable({
      state: this.state.blackjack,
      repo: () => this.repo,
      settings: () => this.casinoSettings,
      later: (ms, fn) => void this.clock.setTimeout(fn, ms),
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      },
      notify: (userId, settled: BlackjackSettled) => {
        for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.blackjackSettled, settled);
        this.casinoSettled(userId, settled.staked, settled.won);
        if (settled.outcome === "blackjack") this.achievements.bump(userId, STAT_KEYS.blackjackNaturals);
      },
      timings: () => OfficeRoom.blackjackTimings,
      shuffle: () => OfficeRoom.blackjackShuffle(),
      rounds: this.casinoRounds,
    });
  }

  /** Cerró una ronda del casino: lo apostado, lo devuelto, lo perdido y la mejor ganancia. */
  private casinoSettled(userId: string, staked: number, won: number) {
    if (staked <= 0) return;
    const a = this.achievements;
    a.bump(userId, STAT_KEYS.casinoBets);
    a.bump(userId, STAT_KEYS.casinoWagered, staked);
    a.bump(userId, STAT_KEYS.casinoReturned, won);
    if (won < staked) a.bump(userId, STAT_KEYS.casinoLost, staked - won);
    else a.max(userId, STAT_KEYS.casinoBestWin, won - staked);
    const p = [...this.state.players.values()].find((x) => x.userId === userId);
    if (p) a.max(userId, STAT_KEYS.pointsPeak, p.points);
  }

  /** Asiento del blackjack donde está sentada la persona (índice de BLACKJACK_SEATS), o null. */
  private blackjackSeatOf(player: Player): number | null {
    if (player.area !== "sotano" || !player.seated) return null;
    const ts = this.mapOf(player.area).tileSize;
    const tx = Math.floor(player.x / ts);
    const ty = Math.floor(player.y / ts);
    const i = BLACKJACK_SEATS.findIndex((s) => s.x === tx && s.y === ty);
    return i >= 0 ? i : null;
  }

  /** Frena las ráfagas de mensajes al casino (cada uno abre una transacción con la fila bloqueada). */
  private acceptCasino(client: Client<UserData>): boolean {
    if (!client.userData) return false;
    return acceptCasinoMessage((client.userData.casinoTimes ??= []), Date.now());
  }

  private async handleBlackjack(client: Client<UserData>, raw: unknown, kind: "bet" | "action") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.blackjack || !this.acceptCasino(client)) return;
    const seat = this.blackjackSeatOf(player);
    const who = { userId: player.userId, name: player.name };
    const result = kind === "bet" ? await this.blackjack.bet(who, seat, raw) : await this.blackjack.action(who, seat, raw);
    if (result) client.send(MSG.casinoResult, result);
  }

  private async handleRouletteBet(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.roulette || !this.acceptCasino(client)) return;
    const near = nearPointOfType(this.mapOf(player.area), "roulette", player.x, player.y);
    const result = await this.roulette.bet({ userId: player.userId, name: player.name }, raw, near);
    if (result) client.send(MSG.casinoResult, result);
  }

  private async handleMesaBet(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const msg = parseMesaBet(raw);
    const table = msg && this.mesas.get(msg.table);
    if (!player || !msg || !table || !this.acceptCasino(client)) return;
    const near = nearPointOfType(this.mapOf(player.area), MESA_POINT[msg.table], player.x, player.y);
    const result = await table.bet({ userId: player.userId, name: player.name }, msg, near);
    client.send(MSG.casinoResult, result);
  }

  // ---------- Emotes ----------

  /** Emote sobre la cabeza: lo ven quienes están en el mismo nivel (incluida la persona que lo hizo). */
  private handleEmote(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = EmoteMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const now = Date.now();
    if (!acceptEmote((client.userData.emoteTimes ??= []), now)) return;
    client.userData.lastEmoteAt = now;
    client.userData.lastActiveAt = now;
    const event: EmoteEvent = { sessionId: client.sessionId, emote: parsed.data.emote };
    this.achievements.bump(player.userId, STAT_KEYS.emotes);
    if (parsed.data.emote === "dance") this.achievements.bump(player.userId, STAT_KEYS.dances);
    for (const other of this.clients) {
      if (this.state.players.get(other.sessionId)?.area === player.area) other.send(MSG.emoteEvent, event);
    }
  }

  // ---------- Cafetería y bar ----------

  private handleCafeOrder(client: Client<UserData>, raw: unknown) {
    return this.handleOrder(client, raw, "cafe");
  }

  /**
   * Pedido en la barra de la cafetería, del club o en la confitería del cine: hay que estar junto a esa
   * barra y tener saldo. Lo pedido se lleva en la mano un rato (y se usa con F).
   */
  private async handleOrder(client: Client<UserData>, raw: unknown, menu: MenuId) {
    const player = this.state.players.get(client.sessionId);
    const parsed = (menu === "cafe" ? CafeOrderMessage : menu === "bar" ? BarOrderMessage : CinemaOrderMessage).safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const item = menuItem(parsed.data.item)!;
    const reply = (r: CafeOrderResult) => client.send(MSG.cafeResult, r);

    const now = Date.now();
    if (now - (client.userData.lastOrderAt ?? 0) < CAFE.orderCooldownMs) return reply({ ok: false, item: item.id, error: "busy" });
    if (!nearPointOfType(this.mapOf(player.area), MENUS[menu].point, player.x, player.y)) {
      return reply({ ok: false, item: item.id, error: "far" });
    }
    const userId = player.userId;
    // Lo pedido va a la mochila: tiene que caber antes de cobrar.
    const parts = bagItemsOf(item.id);
    if (this.held.fits(userId, parts.map((p) => [p, 1] as const)) !== "ok") return reply({ ok: false, item: item.id, error: "full" });
    client.userData.lastOrderAt = now;

    const refId = menuRefId(item.id);
    let result: { ok: boolean; balance: number };
    try {
      result = await this.repo.spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId });
    } catch (err) {
      console.error("spendPoints", err);
      return reply({ ok: false, item: item.id, error: "failed" });
    }
    for (const p of this.state.players.values()) if (p.userId === userId) p.points = result.balance;
    if (!result.ok) return reply({ ok: false, item: item.id, error: "funds" });
    // Cada parte a la mochila (el combo es dos cosas); la primera, a la mano si estaban libres.
    for (const part of parts) await this.held.add(userId, part, 1, { pick: true });
    const a = this.achievements;
    // La confitería del cine cuenta como la cafetería (no es trago).
    a.bump(userId, menu === "bar" ? STAT_KEYS.barOrders : STAT_KEYS.cafeOrders);
    a.bump(userId, `${STAT_PREFIX.order}${item.id}`);
    const holds: readonly string[] = item.holds;
    if (holds.includes("tinto") || holds.includes("cafe-leche")) a.bump(userId, STAT_KEYS.coffees);
    if (holds.includes("habano")) a.bump(userId, STAT_KEYS.habanos);
    reply({ ok: true, item: item.id, balance: result.balance });
  }

  // ---------- El Man del Sombrero ----------

  /**
   * Comprarle al Man del Sombrero: tiene que estar (sus horas o la tormenta), hay que estar junto a él y
   * tener saldo. Lo comprado va a la mochila como lo de la cafetería (y se usa con F).
   */
  private async handleSombreroBuy(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = SombreroBuyMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const item = sombreroItem(parsed.data.item)!;
    const reply = (r: SombreroBuyResult) => client.send(MSG.sombreroResult, r);
    const now = Date.now();
    if (now - (client.userData.lastSombreroAt ?? 0) < SOMBRERO.buyCooldownMs) return reply({ ok: false, item: item.id, error: "busy" });
    this.sombrero.refresh();
    if (!this.sombrero.present) return reply({ ok: false, item: item.id, error: "gone" });
    const map = this.mapOf(player.area);
    if (this.drunk.fainted(player.userId) || !this.sombrero.near(player.area, player.x, player.y, map.tileSize)) {
      return reply({ ok: false, item: item.id, error: "far" });
    }
    const userId = player.userId;
    // Lo comprado va a la mochila: tiene que caber antes de cobrar.
    if (this.held.fits(userId, bagItemsOf(item.id).map((p) => [p, 1] as const)) !== "ok") return reply({ ok: false, item: item.id, error: "full" });
    client.userData.lastSombreroAt = now;
    let result: { ok: boolean; balance: number };
    try {
      result = await this.repo.spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId: sombreroRefId(item.id) });
    } catch (err) {
      console.error("spendPoints", err);
      return reply({ ok: false, item: item.id, error: "failed" });
    }
    for (const p of this.state.players.values()) if (p.userId === userId) p.points = result.balance;
    if (!result.ok) return reply({ ok: false, item: item.id, error: "funds" });
    // A la mochila (y a la mano si estaban libres).
    await this.held.give(userId, item.id);
    this.achievements.bump(userId, `${STAT_PREFIX.order}${item.id}`);
    client.userData.lastActiveAt = now;
    reply({ ok: true, item: item.id, balance: result.balance });
  }

  /** Usar lo que se tiene en la mano (una pitada, un sorbo, un mordisco): lo ven los del mismo nivel. */
  private handleUseHeld(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = UseHeldMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const now = Date.now();
    const used = this.held.use(player.userId, now);
    if (!used.ok) return;
    this.countUse(player.userId, used.art, used.action, used.done);
    this.drunk.consumed(player.userId, used.art);
    this.trips.consumed(player.userId, used.art);
    client.userData.lastActiveAt = now;
    const event: HeldUsedEvent = { sessionId: client.sessionId, part: used.part, art: used.art, action: used.action, left: used.left };
    this.sendToArea(player.area, MSG.heldUsed, event);
    // Un plato de la cocina con energía: el primer bocado la prende.
    const energy = this.cocina.ate(player.userId, used.art, used.left, OfficeRoom.cocinaNow());
    if (energy) client.send(COCINA_MSG.notice, energy satisfies CocinaNotice);
  }

  // ---------- Cocina ----------

  /** Guardar en la despensa, cocinar o mirarla: responde el estado y el aviso solo a quien lo pidió. */
  private async withCook(client: Client<UserData>, fn: (p: Player, now: number) => CocinaResult | Promise<CocinaResult>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await Promise.resolve()
      .then(() => fn(player, OfficeRoom.cocinaNow()))
      .catch((err) => {
        console.error("cocina", err);
        return null;
      });
    if (!result) return;
    if (result.notice?.code === "cooked" || result.notice?.code === "capped") this.achievements.bump(player.userId, STAT_KEYS.dishesCooked);
    if (result.state) client.send(COCINA_MSG.state, result.state satisfies CocinaState);
    if (result.notice) client.send(COCINA_MSG.notice, result.notice satisfies CocinaNotice);
  }

  /** Llueve: las parcelas del jardín que se están secando se riegan solas. */
  private rainOnGarden() {
    if (!this.huerto) return;
    this.huerto.rain(this.mapOf("jardin"), OfficeRoom.huertoNow());
  }

  // ---------- Brindis ----------

  /** Cómo ve el brindis a alguien: dónde está y si tiene una bebida con sorbos (desmayado, no). */
  private toaster(sessionId: string, p: Player): Toaster {
    const drink = !this.drunk.fainted(p.userId) && drinkPart(p.held, parseHeldLeft(p.heldLeft)) >= 0;
    return { userId: p.userId, sessionId, area: p.area, x: p.x, y: p.y, drink };
  }

  /** El sorbo del brindis: como usar lo de la mano (F), sin esperar la pausa, y suma alcohol si lleva. */
  private toastSip(userId: string) {
    let sessionId: string | undefined;
    let player: Player | undefined;
    for (const [id, p] of this.state.players) if (p.userId === userId) [sessionId, player] = [id, p];
    const held = this.held.get(userId);
    const part = held ? drinkPart(held.item, held.left) : -1;
    if (!sessionId || !player || part < 0) return null;
    const used = this.held.use(userId, Date.now(), { skipCooldown: true });
    if (!used.ok) return null;
    this.drunk.consumed(userId, used.art);
    this.trips.consumed(userId, used.art);
    // Cada vaso que choca es un brindis (logro "¡Salud!") y un sorbo más.
    this.achievements.bump(userId, STAT_KEYS.toasts);
    this.countUse(userId, used.art, used.action, used.done);
    return { sessionId, part: used.part, left: used.left };
  }

  /** Brindar (B): invita a los de al lado con bebida, o se suma a un brindis que está abierto cerca. */
  private handleToast(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData || !ToastMessage.safeParse(raw).success) return;
    client.userData.lastActiveAt = Date.now();
    const result = this.toasts.raise(player.userId);
    if (!result.ok) client.send(MSG.toastResult, { ok: false, error: result.error } satisfies ToastResult);
  }

  // ---------- Sillas giratorias ----------

  /** Girar en la silla (R): sentado en una silla de oficina con ruedas. Lo ven los del nivel. */
  private handleSwivel(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData || !SwivelMessage.safeParse(raw).success) return;
    const seat = player.seated ? seatAtPoint(this.mapOf(player.area), player.x, player.y) : undefined;
    const now = Date.now();
    const result = this.swivels.spin(player.userId, seat, now);
    if (!result.ok) return;
    client.userData.lastActiveAt = now;
    this.achievements.bump(player.userId, STAT_KEYS.chairSpins, result.turns);
    // Tantas vueltas seguidas marean un poco (como el alcohol, pero sin pasar de "mareado").
    if (result.dizzy) this.drunk.dizzy(player.userId, SWIVEL.dizzyUnits, SWIVEL.dizzyCap);
    const event: SwivelEvent = { sessionId: client.sessionId, turns: result.turns, dizzy: result.dizzy };
    this.sendToArea(player.area, MSG.swivelEvent, event);
  }

  private countUse(userId: string, art: string, action: string, done = false) {
    const a = this.achievements;
    // Fumado hasta el final (la última pitada acaba la unidad).
    if (action === "smoke" && done) a.bump(userId, STAT_KEYS.smoked);
    a.bump(userId, action === "smoke" ? STAT_KEYS.puffs : action === "sip" ? STAT_KEYS.sips : STAT_KEYS.bites);
    a.bump(userId, `${STAT_PREFIX.use}${art}`);
    if (ALCOHOL_PER_SIP[art]) a.bump(userId, STAT_KEYS.alcoholSips);
  }

  // ---------- Muebles que se usan ----------

  /** Tele, lámparas y tocadiscos se prenden para todos; instrumentos y gato avisan a los del nivel. */
  private handleFurnitureUse(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const now = Date.now();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const result = this.furnitureUses.use(this.mapOf(player.area), player, raw, now, seed);
    if (!result.ok) {
      // Casa viva: por qué no (no cabe en la mochila, el baño ocupado); lo demás se ignora como antes.
      if (result.error === "full" || result.error === "stall") client.send(CASA_MSG.notice, { code: result.error } satisfies CasaNotice);
      else if (result.error === "far") this.rechazo(client, "far");
      else if (result.error === "busy") this.rechazo(client, "cooldown");
      // El taller: el carro ya tiene a alguien al volante.
      else if (result.error === "taken") this.rechazo(client, "carTaken");
      return;
    }
    client.userData.lastActiveAt = now;
    // Jardín vivo: las parcelas, el barril y el pozo y las colmenas tienen sus reglas (huerto.ts).
    if (result.kind === "event" && isHuertoAction(result.event.action)) return void this.handleHuerto(client, player, result.event);
    // La granja: el comedero, el nido y el molino (granja.ts).
    if (result.kind === "event" && isGranjaAction(result.event.action)) return void this.handleGranja(client, player, result.event);
    // Mundo lleno: la impresora, la ducha, la casita del perro, el reloj de sol, las barandas y los paneles (mundo.ts).
    if (result.kind === "event" && isMundoAction(result.event.action)) return void this.mundo?.use(client.sessionId, result.event);
    this.countFurniture(player.userId, result);
    if (result.kind === "event") {
      const event: FurnitureEvent = { sessionId: client.sessionId, ...result.event };
      this.sendToArea(player.area, MSG.furnitureEvent, event);
      // El radar de señales del observatorio oye los instrumentos de toda la cabaña.
      if (event.action === "play" && player.area !== "observatorio")
        this.sendToArea("observatorio", OBS_MSG.signal, { area: player.area, type: event.type, x: event.x, y: event.y } satisfies SignalPing);
    }
    // Casa viva: lo gratis a la mano (el malvavisco, al terminar de asarse, si sigue junto a la fogata) y
    // el cubículo ocupado.
    const area = player.area;
    this.casa.after(player.userId, result, () => {
      const p = this.state.players.get(client.sessionId);
      return !!p && p.area === area && result.kind === "event" && this.furnitureUses.stillInReach(this.mapOf(area), result.event, p.x, p.y);
    });
  }

  // ---------- Jardín vivo ----------

  /** Sembrar, regar, cosechar, llenar la regadera o sacar miel: lo ven los del nivel; si no, el porqué. */
  private async handleHuerto(client: Client<UserData>, player: Player, e: Omit<FurnitureEvent, "sessionId">) {
    const area = player.area;
    const result = await this.huerto.use(this.mapOf(area), player, e, OfficeRoom.huertoNow()).catch((err) => {
      console.error("huerto", err);
      return null;
    });
    if (!result) return;
    if (!result.ok) return void client.send(HUERTO_MSG.notice, result.notice satisfies HuertoNotice);
    const step = result.event.garden;
    if (step === "plant") this.achievements.bump(player.userId, STAT_KEYS.plantings);
    else if (step === "harvest") this.achievements.bump(player.userId, STAT_KEYS.harvests);
    if (step === "harvest" && result.event.item) void this.oficios.extraHarvest(player.userId, result.event.item);
    this.sendToArea(area, MSG.furnitureEvent, { sessionId: client.sessionId, ...result.event } satisfies FurnitureEvent);
  }

  /** Sacar la regadera o semillas del cobertizo (junto a su puerta): van a la mochila. */
  private async handleShed(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await this.huerto.shed(this.mapOf(player.area), player, raw);
    if (result && !result.ok) client.send(HUERTO_MSG.notice, result.notice satisfies HuertoNotice);
  }

  // ---------- Mochila ----------

  /** Elegir la casilla de la barra: lo que haya ahí queda en la mano (lo valida la mochila del servidor). */
  private handleBagSelect(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = BagSelectMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.held.select(player.userId, parsed.data.slot);
  }

  /** Reordenar la mochila (arrastrar en el menú): la casilla nueva se guarda. */
  private handleBagMove(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = BagMoveMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.held.move(player.userId, parsed.data.itemId, parsed.data.to);
  }

  /** Tirar unidades de un objeto (los muebles no se tiran: se ponen en la oficina). */
  private async handleBagDrop(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = BagDropMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const { itemId, quantity } = parsed.data;
    if (objIdOf(itemId) === null) return void client.send(BAG_MSG.notice, { code: "furniture" } satisfies BagNotice);
    if (itemId === CELULAR_ITEM) return void client.send(BAG_MSG.notice, { code: "keep" } satisfies BagNotice);
    if (isStoryItem(itemId)) return void client.send(BAG_MSG.notice, { code: "story" } satisfies BagNotice);
    // "Tirar todo" pide de más: se tira lo que haya.
    const n = Math.min(quantity, this.held.count(player.userId, itemId));
    if (n > 0) await this.held.take(player.userId, itemId, n);
  }

  // ---------- La piscina ----------

  /** La piscina del jardín: la gente de la sala, el mapa, el clima, la hora del juego y los puntos. */
  private startPiscina() {
    this.piscina = new Piscina({
      clock: { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      now: () => Date.now(),
      map: (area) => this.mapOf(area),
      weather: () => this.state.weather as Weather,
      night: () => isNightMinute(this.gameTimeNow().minuteOfDay),
      people: () => this.state.players.entries(),
      place: (sessionId, x, y, swimming) => this.placeBather(sessionId, x, y, swimming),
      setWet: (userId, wet) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.wet = wet;
      },
      toArea: (area, type, message) => this.sendToArea(area, type, message),
      notice: (sessionId, code) => this.clients.getById(sessionId)?.send(AGUA_MSG.notice, { code } satisfies AguaNotice),
      award: (userId, amount) => this.awardLeisure(userId, amount),
      active: (sessionId) => {
        const data = this.clients.getById(sessionId)?.userData as UserData | undefined;
        return Boolean(data) && Date.now() - data!.lastActiveAt <= OfficeRoom.idleMs;
      },
      freeSpot: (map, x, y) => this.freeSpotNear(map, x, y),
      timings: () => OfficeRoom.aguaTimings,
    });
    this.clock.setInterval(() => void this.piscina?.sunTick().catch((err) => console.error("piscina", err)), OfficeRoom.aguaTimings.checkMs);
  }

  // ---------- La tina y la sauna ----------

  /** La tina caliente y la sauna del lago: los puntos del descanso (con actividad) y el mojado de la piscina. */
  private startTina() {
    this.tina = new Tina({
      now: () => Date.now(),
      map: (area) => this.mapOf(area),
      people: () => this.state.players.entries(),
      award: (userId, amount) => this.awardLeisure(userId, amount),
      active: (sessionId) => {
        const data = this.clients.getById(sessionId)?.userData as UserData | undefined;
        return Boolean(data) && Date.now() - data!.lastActiveAt <= OfficeRoom.idleMs;
      },
      rested: (userId) => this.achievements.bump(userId, STAT_KEYS.spaRests),
      soak: (userId) => this.piscina?.soak(userId),
      timings: () => OfficeRoom.tinaTimings,
    });
    this.clock.setInterval(() => void this.tina?.tick().catch((err) => console.error("tina", err)), OfficeRoom.tinaTimings.checkMs);
  }

  /** Meterse, tirarse del trampolín o salir del agua (con E junto a la piscina). */
  private handleAgua(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData || this.drunk.fainted(player.userId)) return;
    client.userData.lastActiveAt = Date.now();
    this.piscina?.action(client.sessionId, player, raw);
  }

  /** La piscina movió a alguien (al agua, al deck): su zona y la corrección para su cliente. */
  private placeBather(sessionId: string, x: number, y: number, swimming: boolean) {
    const p = this.state.players.get(sessionId);
    if (!p) return;
    const map = this.mapOf(p.area);
    const previousZoneId = p.zoneId;
    p.x = x;
    p.y = y;
    p.swimming = swimming;
    p.seated = false;
    p.moving = false;
    p.zoneId = zoneAt(map, x, y)?.id ?? "";
    p.place = placeAt(map, x, y);
    this.revokeGuestOnExit(p, previousZoneId);
    this.fishery.cancel(p.userId);
    this.trades.moved(sessionId);
    const client = this.clients.getById(sessionId);
    if (client?.userData) client.userData.lastMoveAt = Date.now();
    client?.send(MSG.moveCorrection, { x, y } satisfies MoveCorrection);
  }

  // ---------- Casa viva: mascotas ----------

  /** Las mascotas aparecen durmiendo en sus camas y el servidor las mueve seguido. */
  // ---------- La granja ----------

  /** Los animales aparecen en su patio y el servidor los mueve; la parrilla revisa lo que está en el fuego. */
  private startGranja() {
    const jardin = () => this.mapOf("jardin");
    const bag = {
      count: (userId: string, itemId: string) => this.held.count(userId, itemId),
      fits: (userId: string, items: readonly (readonly [string, number])[]) => this.held.fits(userId, items),
      take: (userId: string, itemId: string, n: number) => this.held.take(userId, itemId, n),
      add: (userId: string, itemId: string, n: number, opts: { pick?: boolean }) => this.held.add(userId, itemId, n, opts),
    };
    this.granja = new Granja({
      animals: this.state.granja.animals,
      create: () => new FarmAnimal(),
      setEggs: (n) => {
        this.state.granja.eggs = n;
      },
      map: jardin,
      rng: () => OfficeRoom.granjaRandom(),
      bag,
      stats: {
        isLoaded: (userId) => this.achievements.isLoaded(userId),
        stat: (userId, key) => this.achievements.stat(userId, key),
        max: (userId, key, value) => this.achievements.max(userId, key, value),
        bump: (userId, key, by) => this.achievements.bump(userId, key, by),
      },
      award: (userId, amount) => this.awardLeisure(userId, amount),
      loadVotes: () => this.repo.loadStatsByPrefix(GRANJA_STATS.votePrefix),
      gameClock: () => this.gameClock(),
      gameNight: () => isGameNight(this.gameClock(), OfficeRoom.gameClockNow()),
      later: (ms, fn) => this.clock.setTimeout(fn, ms * OfficeRoom.molinoTimeScale),
      notify: (userId, notice) => this.clientOfUser(userId)?.send(GRANJA_MSG.notice, notice satisfies GranjaNotice),
    });
    this.parrilla = new Parrilla({
      jobs: this.state.granja.grill,
      create: () => new GrillJob(),
      map: jardin,
      bag: {
        ...bag,
        get: (userId) => this.held.get(userId),
        use: (userId, now, opts) => this.held.use(userId, now, opts),
      },
      award: (userId, amount) => this.awardLeisure(userId, amount),
      spend: async (userId, amount, refId) => {
        const r = await this.repo.spendPoints({ userId, amount, reason: "PURCHASE", refId });
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = r.balance;
        return r;
      },
      where: (userId) => {
        const c = this.clientOfUser(userId);
        return c ? this.grillWho(c) : undefined;
      },
      bump: (userId, key, by) => this.achievements.bump(userId, key, by),
      notify: (userId, notice) => {
        this.clientOfUser(userId)?.send(PARRILLA_MSG.notice, notice satisfies GrillNotice);
        // Cocina nivel 5: el plato trae una porción de más.
        if ((notice.code === "done" || notice.code === "doneBag") && notice.item) void this.oficios.extraPortion(userId, notice.item);
      },
      timeScale: () => OfficeRoom.parrillaTimeScale,
    });
    let last = OfficeRoom.granjaNow();
    this.granja.start(last);
    void this.granja.loadNames();
    this.clock.setInterval(() => {
      const now = OfficeRoom.granjaNow();
      this.granja.tick(now, Math.min(600, Math.max(0, now - last)));
      this.parrilla.tick(now);
      last = now;
    }, GALLINERO.tickMs);
  }

  private grillWho(client: Client): GrillWho | undefined {
    const p = this.state.players.get(client.sessionId);
    return p && { userId: p.userId, sessionId: client.sessionId, name: p.name, area: p.area, x: p.x, y: p.y };
  }

  /** Dar de comer, buscar huevos o moler: el aviso a quien lo hizo y la animación a los del nivel. */
  private async handleGranja(client: Client<UserData>, player: Player, e: Omit<FurnitureEvent, "sessionId">) {
    const now = OfficeRoom.granjaNow();
    const who = { userId: player.userId, name: player.name };
    let notice: GranjaNotice;
    let event = e;
    let ok = false;
    try {
      if (e.action === "feed") {
        notice = await this.granja.feed(who, now);
        ok = notice.code === "fed";
      } else if (e.action === "eggs") {
        notice = await this.granja.collectEggs(who, now);
        ok = notice.code === "eggs";
      } else {
        const r = await this.granja.grind(who, isWet(this.weather.weather), now);
        notice = r.notice;
        ok = r.ms !== undefined;
        // La semilla lleva lo que tarda: todos ven moler lo mismo.
        if (ok) event = { ...e, seed: r.ms! };
      }
    } catch (err) {
      console.error("granja", err);
      notice = { code: "failed" };
    }
    client.send(GRANJA_MSG.notice, notice satisfies GranjaNotice);
    if (ok) this.sendToArea(player.area, MSG.furnitureEvent, { sessionId: client.sessionId, ...event } satisfies FurnitureEvent);
  }

  /** El letrero del gallinero: cómo está hoy y los votos (solo a quien lo abrió). */
  private async handleCoop(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const state = await this.granja.coopState({ userId: player.userId, name: player.name }, OfficeRoom.granjaNow());
    client.send(GRANJA_MSG.coopState, state satisfies CoopState);
  }

  private async handleCoopVote(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const notice = await this.granja.vote({ userId: player.userId, name: player.name }, raw, OfficeRoom.granjaNow());
    if (!notice) return;
    client.send(GRANJA_MSG.notice, notice satisfies GranjaNotice);
    await this.handleCoop(client);
  }

  /** Cocinar, mirar la despensa o traer de la cafetería: el estado y el aviso solo a quien lo pidió. */
  private async withGrill(
    client: Client<UserData>,
    fn: (who: GrillWho, now: number) => GrillResult | Promise<GrillResult>,
  ) {
    const who = this.grillWho(client);
    if (!who || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await Promise.resolve()
      .then(() => fn(who, OfficeRoom.granjaNow()))
      .catch((err): GrillResult => {
        console.error("parrilla", err);
        return { notice: { code: "failed" } };
      });
    if (!result) return;
    if (result.state) client.send(PARRILLA_MSG.state, result.state satisfies GrillState);
    if (result.notice) client.send(PARRILLA_MSG.notice, result.notice satisfies GrillNotice);
  }

  /** Pedir una porción del plato que lleva otra persona: lo ven los del nivel. */
  private async handlePortion(client: Client<UserData>, raw: unknown) {
    const who = this.grillWho(client);
    if (!who || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const target = (raw as { sessionId?: unknown } | null)?.sessionId;
    const holderClient = typeof target === "string" ? this.clients.getById(target) : undefined;
    const holder = holderClient ? this.grillWho(holderClient) : undefined;
    const result = await this.parrilla.portion(who, holder, raw, OfficeRoom.granjaNow()).catch((err) => {
      console.error("porción", err);
      return { notice: { code: "failed" } satisfies GrillNotice };
    });
    if (!result) return;
    client.send(PARRILLA_MSG.notice, result.notice satisfies GrillNotice);
    if ("holderNotice" in result && result.holderNotice) holderClient?.send(PARRILLA_MSG.notice, result.holderNotice satisfies GrillNotice);
    if ("shared" in result && result.shared) this.sendToArea(who.area, PARRILLA_MSG.shared, result.shared satisfies PortionShared);
  }

  private startPets() {
    this.pets = new Pets({
      pets: this.state.pets,
      create: () => new Pet(),
      map: (area) => this.mapOf(area),
      rng: () => OfficeRoom.petRandom(),
      // La adoptada sigue a su dueño mientras esté conectado (en cualquier nivel).
      owner: (userId) => {
        for (const p of this.state.players.values()) if (p.userId === userId) return { userId, area: p.area, x: p.x, y: p.y, name: p.name };
        return undefined;
      },
      food: {
        peek: (userId) => {
          const held = this.held.get(userId);
          return held ? petFoodIn(held.item, held.left) : null;
        },
        take: (userId, part) => this.held.takePart(userId, part),
      },
      save: (bond) => this.repo.savePetBond(bond).catch((err) => console.error("savePetBond", err)),
    });
    let last = Date.now();
    this.pets.start(last);
    // Dueños y cariño guardados (si la base no tiene la tabla todavía, quedan todas de la casa).
    void this.repo
      .loadPetBonds()
      .then((bonds) => this.pets.loadBonds(bonds, Date.now()))
      .catch((err) => console.error("loadPetBonds", err));
    this.clock.setInterval(() => {
      const now = Date.now();
      this.pets.tick(now, Math.min(500, now - last));
      last = now;
    }, PET.tickMs);
    this.clock.setInterval(() => this.pets.flush(Date.now()), PET_BOND.saveMs);
  }

  /** Llamar a una mascota (clic) o acariciarla y darle un premio (de cerca): lo ven los del nivel. */
  private handlePet(client: Client<UserData>, raw: unknown, kind: "call" | "action") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const now = Date.now();
    const who: PetUser = { userId: player.userId, area: player.area, x: player.x, y: player.y, name: player.name };
    const result = kind === "call" ? this.pets.call(who, raw, now) : this.pets.act(who, raw, now);
    if (!result.ok) {
      // Al que pidió acariciar o dar un premio se le dice por qué no (llamar lejos no avisa: es un clic).
      if (result.error === "fed" || (kind === "action" && result.error === "far")) {
        client.send(CASA_MSG.notice, { code: result.error === "fed" ? "fed" : "petFar" } satisfies CasaNotice);
      }
      const e = result.error;
      if (e === "noFood" || e === "hasPet" || e === "taken" || e === "notOwner") {
        const name = this.state.pets.get((raw as { pet: string }).pet)?.name ?? "";
        client.send(PET_MSG.notice, { code: e, pet: name } satisfies PetNotice);
      }
      return;
    }
    const action = result.action;
    client.userData.lastActiveAt = now;
    if (action !== "call") this.achievements.bump(player.userId, STAT_KEYS.petCares);
    if (result.food) this.achievements.bump(player.userId, STAT_KEYS.petTreats);
    const pet = (raw as { pet: string }).pet;
    this.sendToArea(player.area, PET_MSG.event, { pet, sessionId: client.sessionId, action, ...(result.food ? { food: result.food } : {}) } satisfies PetEvent);
    // Cuidarla da un punto chiquito (los primeros del día; también cuenta el tope del ocio).
    if (result.reward > 0) void this.awardLeisure(player.userId, result.reward);
  }

  /** Tocar el piano, acariciar al gato, poner un disco, prender la tele o una lámpara. */
  private countFurniture(userId: string, result: Extract<ReturnType<FurnitureUses["use"]>, { ok: true }>) {
    const type = result.kind === "event" ? result.event.type : (result.key.split(":")[1] ?? "");
    const toggledOn = result.kind === "toggle" && result.on;
    const key: string | null =
      type === "piano"
        ? STAT_KEYS.pianoPlays
        : type === "guitar"
          ? STAT_KEYS.guitarPlays
          : type === "cat-bed"
            ? STAT_KEYS.catPets
            : type === "record-player"
              ? toggledOn
                ? STAT_KEYS.recordsPlayed
                : null
              : type === "tv-retro"
                ? STAT_KEYS.tvToggles
                : type.includes("lamp")
                  ? STAT_KEYS.lightsToggled
                  : null;
    if (key) this.achievements.bump(userId, key);
  }

  // ---------- Observatorio ----------

  /** El observatorio del jardín: la fogata de malvaviscos y el telescopio (ver observatorio.ts). */
  private observatorio?: Observatorio;

  private startObservatorio() {
    const obs = new Observatorio({
      now: () => OfficeRoom.observatorioNow(),
      random: (n) => OfficeRoom.observatorioRandom(n),
      marshmallowTimings: () => OfficeRoom.marshmallowTimings,
      skyTimings: () => OfficeRoom.skyTimings,
      isNight: () => isNightMinute(this.gameTimeNow().minuteOfDay),
      sky: () => ({ minuteOfDay: this.gameTimeNow().minuteOfDay, weather: this.state.weather as Weather }),
      player: (sessionId) => this.state.players.get(sessionId),
      map: (area) => this.mapOf(area),
      toSession: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
      toArea: (area, type, message) => this.sendToArea(area, type, message),
      later: (ms, fn) => this.clock.setTimeout(fn, ms),
      award: (userId, amount) => this.awardLeisure(userId, amount),
      bump: (userId, key, by) => this.achievements.bump(userId, key, by),
      held: { get: (userId) => this.held.get(userId), give: (userId, item) => this.held.give(userId, item) },
      scopeNear: (p) => Boolean(nearUsable(this.mapOf(p.area), DECOR_SCOPES, p.x, p.y)),
    });
    this.observatorio = obs;
    const active = (client: Client<UserData>, fn: (sessionId: string) => void) => {
      this.markActive(client);
      fn(client.sessionId);
    };
    this.onMessage(OBS_MSG.marshmallowStart, (client) => active(client, (id) => obs.start(id)));
    this.onMessage(OBS_MSG.marshmallowPull, (client) => active(client, (id) => obs.pull(id)));
    this.onMessage(OBS_MSG.telescopeLook, (client) => active(client, (id) => obs.look(id)));
    this.onMessage(OBS_MSG.telescopeClose, (client) => obs.close(client.sessionId));
    this.onMessage(OBS_MSG.starSpot, (client, raw) => active(client, (id) => obs.spot(id, raw)));
    this.onMessage(OBS_MSG.astronomerAsk, (client) => active(client, (id) => obs.ask(id)));
    this.clock.setInterval(() => obs.tick(), OfficeRoom.skyTimings.tickMs);
  }

  /** Para los tests: el observatorio y los contadores de alguien. */
  observatorioState() {
    return this.observatorio;
  }
  statsOf(userId: string) {
    return this.achievements.snapshot(userId);
  }

  private sendToArea(area: string, type: string, message: unknown) {
    for (const other of this.clients) {
      if (this.state.players.get(other.sessionId)?.area === area) other.send(type, message);
    }
  }

  // ---------- Mundo lleno ----------

  /** Los muebles que antes eran de adorno: todo en mundo.ts (la sala solo le presta lo suyo). */
  private mundo?: MundoHandle;

  // ---------- Pesca ----------

  /** Lanzar la caña: el servidor valida que estés junto a un punto de pesca del lago y de pie. */
  private handleFishCast(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    // Sentado en el bote del muelle también se pesca (y con más suerte: mundo lleno).
    const boat = player.seated && inRowboat(this.mapOf(player.area), player.x, player.y);
    const near = boat || nearPointOfType(this.mapOf(player.area), "fishing_spot", player.x, player.y);
    // La caña y la carnada que tiene (lo de la mano o lo mejor de la mochila); la carnada se gasta al lanzar.
    const gear = { ...this.pesca.gear(player.userId), ...this.oficios.fishingBonus(player.userId), ...(boat ? { boat } : {}) };
    if (!this.fishery.cast({ userId: player.userId, x: player.x, y: player.y, seated: player.seated, area: player.area }, near, gear)) return;
    this.pesca.spendBait(player.userId, gear);
    for (const p of this.state.players.values()) if (p.userId === player.userId) p.fishingRod = gear.rod;
  }

  /** Comprar en el puesto de pesca: junto al mostrador; si sale bien, Don Evelio lo dice para todos. */
  private async handlePescaBuy(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const near = nearPointOfType(this.mapOf(player.area), "fishing_shop", player.x, player.y) && !this.drunk.fainted(player.userId);
    const result = await this.pesca.buy(player.userId, raw, near);
    if (!result) return;
    if (result.ok) {
      for (const p of this.state.players.values()) if (p.userId === player.userId) p.points = result.balance;
      this.achievements.bump(player.userId, `${STAT_PREFIX.order}${result.item}`);
      this.sendToArea(player.area, PESCA_MSG.sold, { sessionId: client.sessionId, item: result.item, at: Date.now() } satisfies PescaSoldEvent);
    }
    client.send(PESCA_MSG.result, result satisfies PescaBuyResult);
  }

  /** Sacó algo del lago: peces, basura, botas, legendarios, míticos, especies nuevas y el más grande. */
  private fishCaught(userId: string, fish: FishSpecies, size: number, first: boolean, treasure: boolean, rod: FishingRod) {
    const a = this.achievements;
    if (fish.rarity === "basura") {
      a.bump(userId, STAT_KEYS.fishTrash);
      if (fish.id === "bota") a.bump(userId, STAT_KEYS.boots);
      return;
    }
    a.bump(userId, STAT_KEYS.fishCaught);
    a.bump(userId, rodCatchesKey(rod)); // la maestría de esa caña
    if (first) a.bump(userId, STAT_KEYS.fishSpecies);
    if (fish.rarity === "legendario") a.bump(userId, STAT_KEYS.legendaryFish);
    if (fish.rarity === "mitico") a.bump(userId, STAT_KEYS.mythicFish);
    if (treasure) a.bump(userId, STAT_KEYS.fishTreasures);
    a.max(userId, STAT_KEYS.fishBestCm, size);
  }

  private withFisher(client: Client<UserData>, fn: (userId: string) => void) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    fn(player.userId);
  }

  // ---------- Club y arcade ----------

  /** La cabina de DJ, bailar en la pista o engancharse al tubo: si no se pudo, se avisa por qué. */
  private handleClub(client: Client<UserData>, raw: unknown, kind: "dj" | "dance" | "pole") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const now = Date.now();
    const map = this.mapOf(player.area);
    const who: ClubWho = { sessionId: client.sessionId, userId: player.userId, name: player.name, area: player.area, x: player.x, y: player.y, seated: player.seated };
    const result = kind === "dj" ? this.club.dj(map, who, raw, now) : kind === "dance" ? this.club.dance(map, who, raw, now) : this.club.pole(map, who, raw, now);
    client.userData.lastActiveAt = now;
    if (!result.ok) client.send(MSG.clubResult, result);
  }

  /** La cola de videos: dentro del club, cualquiera agrega, reordena, quita o salta. */
  private async handleClubQueue(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = ClubQueueMessage.safeParse(raw);
    if (!player || !client.userData || !parsed.success) return;
    const msg = parsed.data;
    const now = Date.now();
    // Lo que avisan los reproductores (terminó, duración) vale desde cualquier parte del sótano.
    if (msg.action === "ended") return void this.club.ended(msg.id, now);
    if (msg.action === "duration") return void this.club.duration(msg.id, msg.ms);
    const fail = (error: ClubError) => client.send(MSG.clubResult, { ok: false, error });
    if (!this.club.inClub(this.mapOf(player.area), player)) return fail("far");
    client.userData.lastActiveAt = now;
    let result: { ok: true } | { ok: false; error: ClubError };
    switch (msg.action) {
      case "add": {
        const videoId = parseYoutubeId(msg.url);
        if (!videoId) return fail("not-youtube");
        const pre = this.club.canAdd(videoId);
        if (!pre.ok) return fail(pre.error);
        const info = await OfficeRoom.youtubeLookup(videoId).catch(() => ({ ok: true as const, title: FALLBACK_TITLE }));
        if (!info.ok) return fail(info.error);
        result = this.club.enqueue({ videoId, title: info.title }, player.name, Date.now(), player.userId);
        break;
      }
      case "replay":
        result = this.club.replay(msg.id, player.name, now, player.userId);
        break;
      case "move":
        result = this.club.move(msg.id, msg.to);
        break;
      case "remove":
        result = this.club.unqueue(msg.id);
        break;
      case "skip":
        result = this.club.skip(msg.id, now);
        break;
    }
    if (!result.ok) fail(result.error);
  }

  /**
   * La cola del cine: dentro de la sala cualquiera programa, reordena, quita o salta; pausar y seguir,
   * desde la cabina del proyector. Los avisos del reproductor (terminó, duración) valen desde donde sea.
   */
  private async handleCinema(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CinemaMessage.safeParse(raw);
    if (!player || !client.userData || !parsed.success) return;
    const msg = parsed.data;
    const now = Date.now();
    const videos = this.cinema.videos;
    if (msg.action === "ended") return void videos.ended(msg.id, now);
    if (msg.action === "duration") return void videos.duration(msg.id, msg.ms);
    const fail = (error: CinemaError) => client.send(MSG.cinemaResult, { ok: false, error });
    const map = this.mapOf(player.area);
    if (!this.cinema.inCinema(map, player)) return fail("far");
    client.userData.lastActiveAt = now;
    let result: { ok: true } | { ok: false; error: CinemaError };
    switch (msg.action) {
      case "add": {
        const videoId = parseYoutubeId(msg.url);
        if (!videoId) return fail("not-youtube");
        const pre = videos.canAdd(videoId);
        if (!pre.ok) return fail(pre.error);
        const info = await OfficeRoom.youtubeLookup(videoId).catch(() => ({ ok: true as const, title: FALLBACK_TITLE }));
        if (!info.ok) return fail(info.error);
        result = videos.enqueue({ videoId, title: info.title }, player.name, Date.now());
        break;
      }
      case "replay":
        result = videos.replay(msg.id, player.name, now);
        break;
      case "move":
        result = videos.move(msg.id, msg.to);
        break;
      case "remove":
        result = videos.unqueue(msg.id);
        break;
      case "skip":
        result = videos.skip(msg.id, now);
        break;
      case "pause":
      case "resume":
        result = this.cinema.control(map, { userId: player.userId, area: player.area, x: player.x, y: player.y }, msg.action, now);
        break;
    }
    if (!result.ok) fail(result.error);
  }

  /** Una reacción a lo que suena: la ven los del sótano (flota sobre la pantalla del club). */
  private handleClubReact(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = ClubReactMessage.safeParse(raw);
    if (!player || !client.userData || !parsed.success) return;
    const now = Date.now();
    if (!this.club.inClub(this.mapOf(player.area), player) || !isPlaying(musicOf(this.state.club))) return;
    if (now < (this.reactAt.get(player.userId) ?? 0)) return;
    this.reactAt.set(player.userId, now + CLUB_VIDEO.reactCooldownMs);
    client.userData.lastActiveAt = now;
    const event: ClubReactionEvent = { sessionId: client.sessionId, name: player.name, emoji: parsed.data.emoji };
    this.sendToArea(player.area, MSG.clubReaction, event);
  }

  private async handleArcadeBoard(client: Client<UserData>, raw: unknown) {
    const board = await this.arcade.board(raw, OfficeRoom.arcadeNow()).catch((err) => {
      console.error("arcadeBoard", err);
      return null;
    });
    if (board) client.send(MSG.arcadeBoardResult, board);
  }

  private async handleArcadeStart(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const started = await this.arcade.start(this.mapOf(player.area), player, raw, OfficeRoom.arcadeNow());
    if ("ok" in started) client.send(MSG.arcadeResult, started);
    else client.send(MSG.arcadeStarted, started);
  }

  private async handleArcadeFinish(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await this.arcade.finish(player, raw, OfficeRoom.arcadeNow());
    if (result.ok) {
      this.achievements.bump(player.userId, STAT_KEYS.arcadeGames);
      if (result.record) this.achievements.bump(player.userId, STAT_KEYS.arcadeRecords);
    }
    client.send(MSG.arcadeResult, result);
  }

  /** El hockey de mesa: cobra y paga por el repositorio, corre con el reloj de la sala y avisa a los del sótano. */
  private startHockey() {
    this.hockey = new HockeyTable({
      state: this.state.hockey,
      repo: () => this.repo,
      map: () => this.mapOf("sotano"),
      every: (ms, fn) => this.clock.setInterval(fn, ms),
      later: (ms, fn) => this.clock.setTimeout(fn, ms),
      now: () => Date.now(),
      where: (userId) => [...this.state.players.values()].find((p) => p.userId === userId) ?? null,
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      },
      frame: (frame) => this.sendToArea("sotano", MSG.hockeyFrame, frame),
      settled: (userId, settled) => this.clientOfUser(userId)?.send(MSG.hockeySettled, settled),
      bonus: (userId, amount) => this.awardLeisure(userId, amount),
    });
  }

  /** Ajedrez y damas: las mesas se revisan con el reloj de la sala; las victorias van al ranking. */
  private startBoardGames() {
    this.boardGames = new BoardGames({
      state: this.state.boards,
      tables: BOARD_TABLES,
      now: () => Date.now(),
      every: (ms, fn) => this.clock.setInterval(fn, ms),
      sitterAt: (area, tx, ty) => {
        const ts = this.mapOf(area).tileSize;
        for (const p of this.state.players.values())
          if (p.area === area && p.seated && Math.floor(p.x / ts) === tx && Math.floor(p.y / ts) === ty) return { userId: p.userId, name: p.name };
        return null;
      },
      saveWin: async (win) => {
        this.achievements.bump(win.userId, STAT_KEYS.boardWins);
        await this.repo.saveBoardWin(win);
        this.boardRankings.delete(win.game);
      },
      settled: (userId, settled) => {
        for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.boardSettled, settled);
      },
    });
    this.boardGames.start();
  }

  private handleBoard(client: Client<UserData>, raw: unknown, kind: "ready" | "move" | "resign" | "draw") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const g = this.boardGames;
    const result = kind === "ready" ? g.ready(player.userId, raw) : kind === "move" ? g.move(player.userId, raw) : kind === "resign" ? g.resign(player.userId, raw) : g.draw(player.userId, raw);
    if (result && !result.ok) client.send(MSG.boardResult, result satisfies BoardResult);
  }

  /** Rankings de victorias leídos hace poco (pedirlos en bucle no le pega a la base). */
  private boardRankings = new Map<BoardGameKind, { at: number; ranking: BoardRanking }>();

  private async sendBoardRanking(client: Client<UserData>, raw: unknown) {
    const parsed = BoardRankingMessage.safeParse(raw);
    if (!parsed.success) return;
    const { game } = parsed.data;
    const now = Date.now();
    const cached = this.boardRankings.get(game);
    if (cached && now - cached.at < BOARD_GAME.rankingCacheMs) return client.send(MSG.boardRankingResult, cached.ranking);
    try {
      const [week, all] = await Promise.all([
        this.repo.boardRanking({ game, since: weekStart(now), limit: BOARD_GAME.rankingSize }),
        this.repo.boardRanking({ game, since: 0, limit: BOARD_GAME.rankingSize }),
      ]);
      const ranking: BoardRanking = { game, week, all };
      this.boardRankings.set(game, { at: now, ranking });
      client.send(MSG.boardRankingResult, ranking);
    } catch (err) {
      console.error("boardRanking", err);
    }
  }

  private async handleHockeyJoin(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await this.hockey.join(player, raw);
    if (result) client.send(MSG.hockeyResult, result);
  }

  /** Cuánto ocio lleva hoy contra el tope, para el celular y el aviso de "tope lleno" (igual para todas las actividades). */
  private async sendLeisure(userId: string, capped = false) {
    try {
      const today = await this.repo.leisureToday(userId);
      const state: LeisureState = { today, cap: POINTS.leisureDailyCap, ...(capped ? { capped } : {}) };
      this.sendToUser(userId, LEISURE_MSG.state, state);
    } catch (err) {
      console.error("leisureToday", err);
    }
  }

  /** Premio de ocio (con su tope diario) para todas las sesiones de esa persona; devuelve lo sumado. */
  private async awardLeisure(userId: string, amount: number): Promise<number> {
    const client = this.clientOfUser(userId);
    const player = client && this.state.players.get(client.sessionId);
    if (!client || !player) return 0;
    try {
      const { awarded, balance } = await this.repo.awardPoints({ userId, amount, reason: "LEISURE" });
      for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      if (awarded > 0) client.send(MSG.pointsAwarded, { amount: awarded, reason: "LEISURE", balance } satisfies PointsAwarded);
      await this.sendLeisure(userId, amount > 0 && awarded < amount);
      return awarded;
    } catch (err) {
      console.error("awardPoints", err);
      return 0;
    }
  }

  // ---------- Cumpleaños ----------

  /**
   * Felicitar a quien cumple hoy: una vez por persona y día. Le da puntos (GIFT, con tope de felicitaciones
   * por día) y todos se enteran; los de su nivel ven confeti.
   */
  private async handleCongrats(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CongratsMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.markActive(client);
    const reply = (r: CongratsResult) => client.send(MSG.congratsResult, r);
    const to = parsed.data.userId;
    const from = player.userId;
    const problem = this.events.congratulate(from, to);
    if (problem) return reply({ ok: false, error: problem });
    const day = this.state.events.day;
    let result: Awaited<ReturnType<GameRepository["awardPointsOnce"]>>;
    try {
      result = await this.repo.awardPointsOnce({
        userId: to,
        amount: BIRTHDAY.congratsPoints,
        reason: "GIFT",
        refId: congratsRef(day, to, from),
        refPrefix: congratsRefPrefix(day, to),
        maxPerDay: BIRTHDAY.congratsDailyCap,
      });
    } catch (err) {
      console.error("congrats", err);
      this.events.undo(from, to);
      return reply({ ok: false, error: "failed" });
    }
    // Ya lo había felicitado antes de que la sala se reiniciara.
    if (result.status === "duplicate") return reply({ ok: false, error: "already" });
    for (const p of this.state.players.values()) if (p.userId === to) p.points = result.balance;
    if (result.awarded > 0) this.sendToUser(to, MSG.pointsAwarded, { amount: result.awarded, reason: "GIFT", balance: result.balance } satisfies PointsAwarded);
    const toName = this.state.events.birthdays.get(to) ?? "";
    this.broadcast(MSG.congratsEvent, { fromName: player.name, toUserId: to, toName, points: result.awarded } satisfies CongratsEvent);
    reply({ ok: true, toName });
  }

  // ---------- Modo foco ----------

  /** Empieza un bloque: no molestar y, si está en su oficina, la puerta cerrada y la placa. */
  private claimFocus(userId: string): string {
    const sessions = [...this.state.players.entries()].filter(([, p]) => p.userId === userId);
    const claim: FocusClaim = {};
    const first = sessions[0]?.[1];
    const manual = sessions[0] && this.autoStatus.manualOf(sessions[0][0]);
    if (manual && manual !== "dnd") {
      claim.status = manual;
      for (const [sessionId] of sessions) this.autoStatus.setManual(sessionId, "dnd");
    }
    let zoneId = "";
    const office = first ? this.state.offices.get(first.zoneId) : undefined;
    if (office && office.ownerId === userId) {
      zoneId = office.zoneId;
      if (!office.locked) {
        this.setOfficeLocked(office, true);
        claim.lockedZone = office.zoneId;
      }
      claim.note = { zoneId: office.zoneId, prev: office.note };
      office.note = cleanOfficeNote(FOCUS.note);
    }
    this.focusClaims.set(userId, claim);
    return zoneId;
  }

  /** Termina el bloque: vuelve lo que el foco cambió, salvo lo que la persona cambió a mano. */
  private releaseFocus(userId: string) {
    const claim = this.focusClaims.get(userId);
    if (!claim) return;
    this.focusClaims.delete(userId);
    if (claim.status)
      for (const [sessionId, p] of this.state.players.entries())
        if (p.userId === userId && this.autoStatus.manualOf(sessionId) === "dnd") this.autoStatus.setManual(sessionId, claim.status);
    const locked = claim.lockedZone ? this.state.offices.get(claim.lockedZone) : undefined;
    if (locked?.locked && locked.ownerId === userId) this.setOfficeLocked(locked, false);
    const noted = claim.note ? this.state.offices.get(claim.note.zoneId) : undefined;
    if (noted && noted.note === cleanOfficeNote(FOCUS.note)) noted.note = claim.note!.prev;
  }

  /** Los puntos de un bloque completo: hasta FOCUS.dailyCap por día (día de Bogotá). */
  private async awardFocus(userId: string): Promise<{ points: number; capped: boolean }> {
    this.achievements.bump(userId, STAT_KEYS.focusBlocks);
    const prefix = focusRefPrefix(eventDay(Date.now()));
    const r = await this.repo.awardPointsOnce({
      userId,
      amount: FOCUS.points,
      reason: "PRESENCE",
      refId: `${prefix}${randomUUID()}`,
      refPrefix: prefix,
      maxPerDay: FOCUS.dailyCap,
    });
    for (const p of this.state.players.values()) if (p.userId === userId) p.points = r.balance;
    if (r.awarded > 0) this.sendToUser(userId, MSG.pointsAwarded, { amount: r.awarded, reason: "PRESENCE", balance: r.balance } satisfies PointsAwarded);
    this.achievements.max(userId, STAT_KEYS.pointsPeak, r.balance);
    return { points: r.awarded, capped: r.status === "limit" };
  }

  // ---------- Utilidades ----------

  private sendToUser(userId: string, type: string, message: unknown) {
    for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(type, message);
  }

  private removePlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    this.observatorio?.forget(sessionId);
    if (player) this.mundo?.forget(player.userId);
    this.state.players.delete(sessionId);
    this.casaArbol?.sweep(Date.now());
    this.club?.forget(sessionId);
    this.whiteboards.forget(sessionId);
    this.races.forget(sessionId);
    if (this.houseEditLock?.sessionId === sessionId) this.houseEditLock = null;
    this.escenario?.sweep(this.state.players);
    if (this.podcast) this.sendPodcastNotices(this.podcast.sync(this.podcastInside(), Date.now()));
    this.pauseGameClockIfEmpty();
    if (!player) return;
    // Si ya no le queda ninguna sesión, deja de ser invitado en cualquier oficina.
    const stillHere = [...this.state.players.values()].some((p) => p.userId === player.userId);
    if (stillHere) return;
    this.quickTravel?.forget(player.userId);
    this.fishery.forget(player.userId);
    this.pesca.forget(player.userId);
    this.brujas.forget(player.userId);
    this.granja.forget(player.userId);
    this.parrilla.forget(player.userId);
    this.focus.forget(player.userId);
    this.phones.left(player.userId);
    this.comunicacion?.forget(player.userId);
    this.invites.forget(player.userId);
    this.hockey?.leave(player.userId);
    this.casa.forget(player.userId);
    this.swivels.forget(player.userId);
    this.piscina?.forget(player.userId);
    this.tina?.forget(player.userId);
    // Los encargos se olvidan después de guardar, y solo si no volvió a entrar mientras tanto (`gen`).
    const questGen = this.encargos.generation(player.userId);
    void this.achievements.forget(player.userId).then(() => this.encargos.forget(player.userId, questGen));
    void this.oficios.forget(player.userId, this.oficios.generation(player.userId));
    for (const office of this.state.offices.values()) {
      const i = office.guests.indexOf(player.userId);
      if (i >= 0) office.guests.splice(i, 1);
    }
  }

  /**
   * Una sola presencia por persona. Al entrar con una sesión nueva:
   * - una pestaña activa anterior se cierra con CLOSE_CODE.replaced;
   * - una sesión esperando reconexión (p. ej. tras recargar la página) se descarta de inmediato.
   */
  private removeOtherPresences(userId: string, keepSessionId: string) {
    for (const [sessionId, p] of this.state.players.entries()) {
      if (sessionId === keepSessionId || p.userId !== userId) continue;
      this.state.players.delete(sessionId);
      const pending = this.pendingReconnections.get(sessionId);
      if (pending) {
        pending.reject(new Error("reemplazada por una sesión nueva"));
        continue;
      }
      this.clients.getById(sessionId)?.leave(CLOSE_CODE.replaced);
    }
  }

  private clientOfUser(userId: string): Client | undefined {
    return this.clients.find((c) => this.state.players.get(c.sessionId)?.userId === userId);
  }

  // ---------- Megabús ----------

  private startBus() {
    const b = this.state.bus;
    this.bus = new BusLine({
      clock: { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      now: () => Date.now(),
      minuteOfDay: () => this.gameTimeNow().minuteOfDay,
      timings: () => OfficeRoom.busTimings,
      schedule: () => OfficeRoom.busSchedule,
      riders: () => this.busRiders().length,
      homeRiders: () => this.busRiders().filter((p) => !this.toStation.has(p.userId)).length,
      arriveHome: () => this.arriveHome(),
      onChange: (s) => {
        b.phase = s.phase;
        b.since = s.since;
        b.nextAt = s.nextAt;
        b.run = s.run;
        b.from = s.from;
        b.to = s.to;
        b.tripMs = OfficeRoom.busTimings.tripMs;
      },
    });
    this.bus.start();
  }

  private busRiders(): Player[] {
    return [...this.state.players.values()].filter((p) => p.area === BUS.area);
  }

  /**
   * El bus llegó a la parada "Casa": todos se bajan en la misma parada, pero cada uno aparece en la suya
   * (la vereda de su casa). Los que van a la estación siguen a bordo; devuelve cuántos.
   */
  private arriveHome(): number {
    let left = 0;
    for (const [sessionId, p] of this.state.players) {
      if (p.area !== BUS.area) continue;
      if (this.toStation.has(p.userId)) {
        left++;
        continue;
      }
      const { x, y, facing } = CASA_CONEXIONES.afuera.parada.llegada;
      // A la casa que eligió si todavía lo dejan entrar (pudo cerrarla en el camino); si no, a la suya.
      const to = this.busDest.get(p.userId);
      this.busDest.delete(p.userId);
      const dest = to && !this.casas.canEnter(casaAreaOf(to), p.userId) ? casaAreaOf(to) : casaAreaOf(p.userId);
      this.moveTo(sessionId, p, dest, x, y, facing);
    }
    // Lo que quedó de alguien que ya no va en el bus no cuenta para el próximo viaje.
    const aboard = new Set(this.busRiders().map((p) => p.userId));
    for (const id of [...this.toStation]) if (!aboard.has(id)) this.toStation.delete(id);
    return left;
  }

  /** Lleva a alguien a un tile de otro nivel (bajarse del bus, subirse desde la casa) y le avisa. */
  private moveTo(sessionId: string, player: Player, area: string, tx: number, ty: number, facing: Player["dir"]) {
    const target = this.mapOf(area);
    const ts = target.tileSize;
    const pos = this.freeSpotNear(target, tx * ts + ts / 2, ty * ts + ts / 2);
    const previousZoneId = player.zoneId;
    player.area = target.id;
    player.x = pos.x;
    player.y = pos.y;
    player.dir = facing;
    player.moving = false;
    player.seated = false;
    player.zoneId = zoneAt(target, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(target, pos.x, pos.y);
    this.revokeGuestOnExit(player, previousZoneId);
    this.whiteboards.moved(sessionId, player.zoneId);
    this.focus.moved(player.userId, player.zoneId);
    this.fishery.cancel(player.userId);
    this.trades.moved(sessionId);
    this.achievements.visit(player.userId, target.id);
    const client = this.clients.find((c) => c.sessionId === sessionId);
    if (client?.userData) client.userData.lastMoveAt = Date.now();
    client?.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
    this.sweepCasaGuests();
  }

  // ---------- Casa de cada persona: visitas (VIR-81/82) ----------

  /** La casa de un dueño en el estado (se arma la primera vez que hace falta). */
  private casaOf(ownerId: string): CasaState {
    let casa = this.state.casas.get(ownerId);
    if (!casa) {
      casa = new CasaState();
      casa.ownerId = ownerId;
      casa.modo = CASA_MODO_DEFAULT;
      this.state.casas.set(ownerId, casa);
    }
    const name = [...this.state.players.values()].find((p) => p.userId === ownerId)?.name;
    if (name) casa.ownerName = name;
    return casa;
  }

  private casaAcceso(ownerId: string): CasaAcceso | undefined {
    const casa = this.state.casas.get(ownerId);
    return casa && isCasaModo(casa.modo) ? { modo: casa.modo, guests: [...casa.guests] } : undefined;
  }

  /** Deja pasar a alguien a la casa de `ownerId` (invitación aceptada o timbre abierto) y lo lleva a la vereda. */
  private letInCasa(ownerId: string, userId: string) {
    const casa = this.casaOf(ownerId);
    if (casa.modo === "cerrada") return;
    if (!casa.guests.includes(userId)) casa.guests.push(userId);
    const entry = [...this.state.players.entries()].find(([, p]) => p.userId === userId);
    if (!entry) return;
    const [sessionId, p] = entry;
    // Ya está adentro de esa casa: nada que mover.
    if (casaOwnerOf(p.area) === ownerId) return;
    p.seated = false;
    p.swimming = false;
    this.toStation.delete(userId);
    const { x, y, facing } = CASA_CONEXIONES.afuera.parada.llegada;
    this.moveTo(sessionId, p, casaAreaOf(ownerId), x, y, facing);
  }

  /** Los que ya no están en la casa que los dejó pasar pierden el pase (como al salir de una oficina). */
  private sweepCasaGuests() {
    for (const casa of this.state.casas.values()) {
      if (!casa.guests.length) continue;
      const inside = new Set([...this.state.players.values()].filter((p) => casaOwnerOf(p.area) === casa.ownerId).map((p) => p.userId));
      for (let i = casa.guests.length - 1; i >= 0; i--) if (!inside.has(casa.guests[i]!)) casa.guests.splice(i, 1);
    }
  }

  /** Saca a una visita de la casa: el Megabús la deja en la estación. */
  private sendHome(sessionId: string, p: Player, code: "echado" | "cerro", ownerName: string) {
    const stop = pointsOfType(this.mapOf("jardin"), "bus_stop")[1] ?? pointsOfType(this.mapOf("jardin"), "bus_stop")[0];
    if (!stop) return;
    p.seated = false;
    p.swimming = false;
    this.busDest.delete(p.userId);
    this.moveTo(sessionId, p, "jardin", stop.tileX, stop.tileY, "up");
    this.clients.getById(sessionId)?.send(CASA_PROPIA_MSG.notice, { code, name: ownerName } satisfies CasaPropiaNotice);
  }

  /**
   * El dueño cambia quién entra. Al pasar a "solo invitados", los que ya estaban adentro quedan como
   * invitados; al cerrarla, las visitas se van a la estación.
   */
  private handleCasaModo(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CasaModoMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const casa = this.casaOf(player.userId);
    casa.modo = parsed.data.modo;
    // Cambiar el modo a mano termina la fiesta (que es la que la tenía abierta).
    casa.fiesta = false;
    casa.modoAntes = "";
    this.applyCasaModo(casa, player);
  }

  /** Lo que pasa con las visitas al cambiar el modo: cerrada se van; solo invitados, quedan invitadas. */
  private applyCasaModo(casa: CasaState, owner: Player) {
    const visits = [...this.state.players.entries()].filter(([, p]) => p.userId !== owner.userId && casaOwnerOf(p.area) === owner.userId);
    if (casa.modo === "cerrada") {
      casa.guests.clear();
      for (const [sessionId, p] of visits) this.sendHome(sessionId, p, "cerro", owner.name);
    } else if (casa.modo === "invitados") {
      for (const [, p] of visits) if (!casa.guests.includes(p.userId)) casa.guests.push(p.userId);
    }
  }

  /** Cuándo avisó cada persona su última fiesta en el chat global. */
  private readonly lastFiestaAt = new Map<string, number>();

  /**
   * El modo fiesta: la casa queda abierta mientras dura (al apagarla vuelve al modo de antes) y se avisa
   * en el chat global de todas las salas, con pausa por persona.
   */
  private handleCasaFiesta(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CasaFiestaMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const casa = this.casaOf(player.userId);
    if (parsed.data.on === casa.fiesta) return;
    if (parsed.data.on) {
      casa.modoAntes = casa.modo;
      casa.modo = "abierta";
      casa.fiesta = true;
      const now = Date.now();
      if (now - (this.lastFiestaAt.get(player.userId) ?? -Infinity) >= CASA_FIESTA.announceCooldownMs) {
        this.lastFiestaAt.set(player.userId, now);
        OfficeRoom.systemNoticeEverywhere({ from: "Megabús", text: fiestaAnnouncement(player.name) });
      }
      this.achievements.bump(player.userId, "parties_hosted");
      return;
    }
    casa.fiesta = false;
    casa.modo = isCasaModo(casa.modoAntes) ? casa.modoAntes : CASA_MODO_DEFAULT;
    casa.modoAntes = "";
    this.applyCasaModo(casa, player);
  }

  /**
   * La música de la casa: el dueño pone un video, lo pausa, lo sigue o lo apaga (como la radio de su
   * oficina). La duración la informa cualquiera que esté en la casa (la primera vale): así da la vuelta.
   */
  private async handleCasaRadio(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CasaRadioMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const msg = parsed.data;
    const now = Date.now();
    if (msg.action === "duration") {
      const owner = casaOwnerOf(player.area);
      const casa = owner ? this.state.casas.get(owner) : undefined;
      if (casa && casa.radioVideo === msg.videoId && !casa.radioDurationMs && msg.ms > 0)
        casa.radioDurationMs = Math.min(CLUB_VIDEO.maxDurationMs, Math.max(CLUB_VIDEO.minDurationMs, msg.ms));
      return;
    }
    const fail = (error: OfficeRadioError) => client.send(MSG.officeRadioResult, { ok: false, error } satisfies OfficeRadioResult);
    // Solo el dueño, desde su casa.
    if (casaOwnerOf(player.area) !== player.userId) return fail("not-owner");
    const casa = this.casaOf(player.userId);
    switch (msg.action) {
      case "set": {
        const videoId = parseYoutubeId(msg.url);
        if (!videoId) return fail("not-youtube");
        const info = await OfficeRoom.youtubeLookup(videoId).catch(() => ({ ok: true as const, title: FALLBACK_TITLE }));
        if (!info.ok) return fail(info.error);
        casa.radioVideo = videoId;
        casa.radioTitle = info.title.slice(0, CLUB_VIDEO.maxTitle);
        casa.radioStartedAt = Date.now();
        casa.radioPaused = false;
        casa.radioPausedAt = 0;
        casa.radioDurationMs = 0;
        return;
      }
      case "pause":
        if (!casa.radioVideo || casa.radioPaused) return;
        casa.radioPausedAt = now - casa.radioStartedAt;
        casa.radioPaused = true;
        return;
      case "resume":
        if (!casa.radioVideo || !casa.radioPaused) return;
        casa.radioStartedAt = now - casa.radioPausedAt;
        casa.radioPaused = false;
        casa.radioPausedAt = 0;
        return;
      case "stop":
        casa.radioVideo = "";
        casa.radioTitle = "";
        casa.radioStartedAt = 0;
        casa.radioPaused = false;
        casa.radioPausedAt = 0;
        casa.radioDurationMs = 0;
        return;
    }
  }

  /** El dueño le pide a alguien que se vaya de su casa. */
  private handleCasaKick(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = CasaKickMessage.safeParse(raw);
    if (!player || !parsed.success || parsed.data.userId === player.userId) return;
    const casa = this.casaOf(player.userId);
    const i = casa.guests.indexOf(parsed.data.userId);
    if (i >= 0) casa.guests.splice(i, 1);
    const entry = [...this.state.players.entries()].find(([, p]) => p.userId === parsed.data.userId && casaOwnerOf(p.area) === player.userId);
    if (entry) this.sendHome(entry[0], entry[1], "echado", player.name);
  }

  /** Tocar el timbre de la casa de alguien: le llega como un toque de puerta; si abre, entra. */
  private handleCasaRing(client: Client<UserData>, player: Player, area: string) {
    const ownerId = casaOwnerOf(area);
    if (!ownerId || ownerId === player.userId) return;
    const zoneId = casaAreaOf(ownerId);
    const ownerName = this.state.casas.get(ownerId)?.ownerName || [...this.state.players.values()].find((p) => p.userId === ownerId)?.name || "";
    const reply = (outcome: KnockOutcome) => client.send(MSG.knockResult, { zoneId, outcome, ownerName } satisfies KnockResult);
    // Abierta (o ya lo dejó pasar): no hace falta timbrar, se va directo.
    if (!this.casas.canEnter(zoneId, player.userId)) {
      this.letInCasa(ownerId, player.userId);
      return reply("not-locked");
    }
    if (this.state.casas.get(ownerId)?.modo === "cerrada") return reply("declined");
    const key = `${player.userId}:${zoneId}`;
    const now = Date.now();
    if (now - (this.lastKnockAt.get(key) ?? 0) < KNOCK_COOLDOWN_MS) return reply("too-soon");
    this.lastKnockAt.set(key, now);
    const owner = this.clientOfUser(ownerId);
    if (!owner) return reply("owner-away");
    if (this.state.players.get(owner.sessionId)?.status === "dnd") return reply("dnd");
    const requestId = randomUUID();
    const timer = this.clock.setTimeout(() => {
      this.pendingKnocks.delete(requestId);
      this.clients.getById(client.sessionId)?.send(MSG.knockResult, { zoneId, outcome: "timeout", ownerName } satisfies KnockResult);
    }, KNOCK_TIMEOUT_MS);
    this.pendingKnocks.set(requestId, { requestId, zoneId, requesterSessionId: client.sessionId, requesterUserId: player.userId, timer });
    owner.send(MSG.knockRequest, { requestId, zoneId, fromName: player.name } satisfies KnockRequest);
    this.achievements.bump(player.userId, STAT_KEYS.knocks);
  }

  private respondCasaRing(player: Player, knock: PendingKnock, accept: boolean) {
    if (casaOwnerOf(knock.zoneId) !== player.userId) return;
    knock.timer.clear();
    this.pendingKnocks.delete(knock.requestId);
    if (accept) this.letInCasa(player.userId, knock.requesterUserId);
    this.clients.getById(knock.requesterSessionId)?.send(MSG.knockResult, {
      zoneId: knock.zoneId,
      outcome: accept ? "accepted" : "declined",
      ownerName: player.name,
    } satisfies KnockResult);
  }

  /**
   * "Esperar el bus" en la parada de la casa propia: al rato pasa a recoger (`BUS.homeWaitMs`) y quien
   * espera queda a bordo, con destino la estación (si el próximo tarda, sale uno de refuerzo).
   */
  private handleBusCall(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData || !BusCallMessage.safeParse(raw ?? {}).success) return;
    const notice = (code: BusNotice["code"]) => client.send(BUS_MSG.notice, { code } satisfies BusNotice);
    if (player.seated || player.racing || player.swimming || this.drunk.fainted(player.userId)) return notice("busy");
    const atStop = () => {
      const p = this.state.players.get(client.sessionId);
      return p && p.area === casaAreaOf(p.userId) && nearPointOfType(this.mapOf(p.area), "home_bus_stop", p.x, p.y) ? p : null;
    };
    if (!atStop()) return notice("home");
    client.userData.lastActiveAt = Date.now();
    notice("coming");
    if (this.busCalls.has(player.userId)) return;
    const timer = this.clock.setTimeout(() => {
      this.busCalls.delete(player.userId);
      const p = atStop();
      if (!p || p.seated) return;
      const t = CONEXIONES.megabus.puertas.llegada;
      this.toStation.add(p.userId);
      this.moveTo(client.sessionId, p, BUS.area, t.x, t.y, t.facing);
      this.bus.requestRide();
    }, BUS.homeWaitMs);
    this.busCalls.set(player.userId, timer);
  }

  /** Dónde queda quien llega en bus: en el pasillo, junto a la puerta del medio. */
  private busArrival() {
    const ts = this.mapOf(BUS.area).tileSize;
    const t = CONEXIONES.megabus.puertas.llegada;
    return { x: t.x * ts + ts / 2, y: t.y * ts + ts / 2 };
  }

  /**
   * E en la estación: subirse al Megabús. Hay que estar en la plataforma, junto a una puerta, con el bus
   * parado y las puertas del todo abiertas. Se entra al nivel del bus, junto a la puerta que corresponde.
   */
  private handleBusBoard(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = BusBoardMessage.safeParse(raw ?? {});
    if (!player || !client.userData || !parsed.success) return;
    const notice = (code: BusNotice["code"]) => client.send(BUS_MSG.notice, { code } satisfies BusNotice);
    const map = this.mapOf(player.area);
    if (player.seated || player.racing || this.drunk.fainted(player.userId)) return notice("busy");
    if (player.area === BUS.area || !nearPointOfType(map, "bus_stop", player.x, player.y)) return notice("far");
    if (!this.bus.doorsOpen()) return notice("noBus");
    // Quien sube en la estación va a una casa: la suya o la que eligió (si lo dejan entrar al llegar).
    this.toStation.delete(player.userId);
    const to = parsed.data.to;
    if (to && to !== player.userId) this.busDest.set(player.userId, to);
    else this.busDest.delete(player.userId);
    const inside = this.mapOf(BUS.area);
    const ts = inside.tileSize;
    // Se entra por la puerta de adentro cuya bajada queda más cerca de donde está.
    const dist = (p: (typeof inside.portals)[number]) => Math.hypot((p.to.x + 0.5) * ts - player.x, (p.to.y + 0.5) * ts - player.y);
    const door = [...inside.portals].sort((a, b) => dist(a) - dist(b))[0]!;
    const t = door.tiles[0]!;
    // Dos pasos adentro de la puerta (las puertas están en la pared del norte, la de la plataforma).
    const pos = this.freeSpotNear(inside, t.x * ts + ts / 2, (t.y + 2) * ts + ts / 2);
    this.casa.leaveStall(player.userId);
    this.fishery.cancel(player.userId);
    const previousZoneId = player.zoneId;
    player.area = inside.id;
    player.x = pos.x;
    player.y = pos.y;
    player.dir = "down";
    player.moving = false;
    player.zoneId = zoneAt(inside, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(inside, pos.x, pos.y);
    this.revokeGuestOnExit(player, previousZoneId);
    this.whiteboards.moved(client.sessionId, player.zoneId);
    client.userData.lastMoveAt = Date.now();
    client.userData.lastActiveAt = Date.now();
    this.achievements.visit(player.userId, inside.id);
    this.trades.moved(client.sessionId);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: inside.id } satisfies MoveCorrection);
  }

  private positioned(p: Player): Positioned {
    const zone = p.zoneId ? this.zonesById.get(p.zoneId) : undefined;
    const stage = p.area === ESCENARIO.area ? stageRole(p.zoneId, p.userId, this.state.stage.floor) : undefined;
    return { area: p.area, x: p.x, y: p.y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false, ...(stage ? { stage } : {}) };
  }

  // ---------- Escenario del jardín ----------

  private stageNotice(client: Client<UserData>, code: EscenarioNoticeCode) {
    client.send(ESCENARIO_MSG.notice, { code } satisfies EscenarioNotice);
  }

  /** "E · Subir al escenario" (lo deja en la tarima si hay lugar) o bajar (al pie de la escalerita). */
  private handleStage(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = StageMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const map = this.mapOf(player.area);
    const ts = map.tileSize;
    const taken = (x: number, y: number) =>
      [...this.state.players.entries()].some(([id, p]) => id !== client.sessionId && p.area === map.id && Math.hypot(p.x - x, p.y - y) < ts * 0.6);
    const res = this.escenario.move(map, client.sessionId, player, parsed.data.on, this.state.players, taken);
    if (!res.ok) return this.stageNotice(client, res.code);
    // Al bajar: al pie de la escalerita o, si hay alguien, al lado (nunca de vuelta en la tarima).
    const below = [0, 1, -1, 2, -2].flatMap((dy) => [0, 1, 2].map((dx) => ({ x: res.x + dx * ts, y: res.y + dy * ts })));
    const pos = parsed.data.on ? res : (below.find((q) => canStandAt(map, q.x, q.y) && !taken(q.x, q.y) && zoneAt(map, q.x, q.y)?.id !== ESCENARIO.stageZone) ?? res);
    player.x = pos.x;
    player.y = pos.y;
    if (parsed.data.on) player.dir = "right";
    player.moving = false;
    player.zoneId = zoneAt(map, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(map, pos.x, pos.y);
    client.userData.lastMoveAt = Date.now();
    client.userData.lastActiveAt = Date.now();
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y } satisfies MoveCorrection);
    this.escenario.sweep(this.state.players);
  }

  private handleHand(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = HandMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.markActive(client);
    const res = this.escenario.hand(client.sessionId, player, parsed.data.up, Date.now());
    if (!res.ok) this.stageNotice(client, res.code);
  }

  private handleFloor(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = FloorMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    this.markActive(client);
    const res = this.escenario.floor(player, parsed.data.userId, this.state.players);
    if (!res.ok) this.stageNotice(client, res.code);
  }

  /** Aplaudir: el emote de aplausos para todo el nivel y cuántos aplauden a la vez (para la ovación). */
  private handleClap(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const crowd = this.escenario.clap(player, Date.now());
    if (crowd === null) return;
    this.markActive(client);
    this.sendToArea(player.area, MSG.emoteEvent, { sessionId: client.sessionId, emote: "clap" } satisfies EmoteEvent);
    this.sendToArea(player.area, ESCENARIO_MSG.applause, { sessionId: client.sessionId, crowd } satisfies ApplauseEvent);
  }

  // ---------- Estudio de grabación ----------

  /** Quiénes están adentro del estudio ahora (todo el nivel es la sala). */
  private podcastInside(): Inside[] {
    const out: Inside[] = [];
    for (const [sessionId, p] of this.state.players) if (p.area === PODCAST.area) out.push({ sessionId, userId: p.userId, name: p.name });
    return out;
  }

  private withPodcast(client: Client<UserData>, fn: (who: Inside, inside: Inside[], now: number) => PodcastNotices) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.markActive(client);
    this.sendPodcastNotices(fn({ sessionId: client.sessionId, userId: player.userId, name: player.name }, this.podcastInside(), Date.now()));
  }

  private sendPodcastNotices(notices: PodcastNotices) {
    for (const n of notices) for (const id of n.to) this.clients.getById(id)?.send(PODCAST_MSG.notice, n.notice);
  }

  private mapOf(area: string): OfficeMap {
    // Las casas de cada persona (`casa:<userId>[:piso]`) no están en el mundo: se arman al entrar.
    return this.world.areas.get(area) ?? this.casas.get(area) ?? this.world.areas.get(this.world.spawnArea)!;
  }

  /** Busca un punto libre (sin muros ni otros avatares) cerca de (x, y) en un nivel. */
  private freeSpotNear(map: OfficeMap, x: number, y: number) {
    const ts = map.tileSize;
    const occupied = (px: number, py: number) =>
      [...this.state.players.values()].some((p) => p.area === map.id && Math.hypot(p.x - px, p.y - py) < ts * 0.6);
    for (let attempt = 0; attempt < 30; attempt++) {
      const ox = attempt === 0 ? 0 : Math.round((Math.random() - 0.5) * ts * 3);
      const oy = attempt === 0 ? 0 : Math.round((Math.random() - 0.5) * ts * 1.5);
      if (canStandAt(map, x + ox, y + oy) && !occupied(x + ox, y + oy)) return { x: x + ox, y: y + oy };
    }
    return { x, y };
  }

  /** Rondas del casino con apuestas cobradas y sin pagar (se devuelven al cerrar; ver casino/recovery.ts). */
  private readonly casinoRounds = new OpenRounds({
    repo: () => this.repo,
    run: randomUUID().slice(0, 8),
    setPoints: (userId, balance) => {
      for (const p of this.state?.players.values() ?? []) if (p.userId === userId) p.points = balance;
    },
  });
}
/** Lo que responde la parrilla a quien la usó (o nada: se ignora). */
type GrillResult = { state?: GrillState; notice?: GrillNotice } | null;
