import {
  allZones,
  applyDecorEdit,
  buildArea,
  canStandAt,
  canWalkBetween,
  decorateAreaDef,
  checkWorldEdit,
  parseWorldEdits,
  planDef,
  setWorldEdits,
  type WorldEdits,
  defaultOfficeItems,
  storedEdit,
  BLACKJACK_SEATS,
  getWorld,
  nearPointOfType,
  nearPortal,
  officeDoor,
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
  type PointsAwarded,
  verifyGameToken,
  type CafeOrderResult,
  type CasinoSettingsDTO,
  type RouletteSettled,
  type BlackjackSettled,
  BLACKJACK,
  type EmoteEvent,
  type ChatEvent,
  type Direction,
  type GameTokenClaims,
  type KnockOutcome,
  type KnockRequest,
  type KnockResult,
  type MoveCorrection,
  type OfficeEditResult,
  WorldEditMessage,
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
  PET_MSG,
  type PetEvent,
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
} from "@hyvento/shared";
import { Room, ServerError, type Client, type Deferred } from "colyseus";
import { randomInt, randomUUID } from "node:crypto";
import type { GameRepository, OfficeItemsResult, OfficeRecord } from "../repo/types";
import { GardenPlotState, OfficeInfo, OfficeItem, OfficeState, Pet, Player } from "../state";
import { BlackjackTable, randomShoe, type BlackjackTimings } from "./casino/blackjack";
import { randomSpin, RouletteTable, type RouletteTimings } from "./casino/roulette";
import { HeldItems } from "./consumables";
import { Drunkenness } from "./drunk";
import { DEFAULT_SWIVEL_TIMINGS, Swivels, type SwivelTimings } from "./swivels";
import { Toasts, type Toaster } from "./toasts";
import { devToolsEnabled, parseDevJump, parseDevWeather } from "./devtools";
import { WeatherCycle } from "./weather";
import { FurnitureUses } from "./usables";
import { FISHING, initialWeather, type FishingTimings, type Weather } from "@hyvento/shared";
import { Fishery } from "./fishing";
import { acceptEmote, TRADE, type GiftReceived, type GiftSentNotice } from "@hyvento/shared";
import { Trades } from "./trades";
import { CasaViva } from "./casa";
import { Pets, type PetUser } from "./mascotas";
import { Arcade } from "./arcade";
import { HockeyTable } from "./hockey";
import { Club, musicOf, type ClubWho } from "./club";
import { Cinema } from "./cinema";
import { FALLBACK_TITLE, lookupYoutube, type YoutubeLookup } from "./youtube";
import { Whiteboards, type BoardWho } from "./whiteboards";
import { ChairRaces, type RaceOutcome } from "./races";
import { PHOTO_TIMINGS, PhotoBooth } from "./photos";
import { AchievementTracker } from "./achievements";
import { HUERTO_MSG, type HuertoNotice } from "@hyvento/shared";
import { Huerto, isHuertoAction } from "./huerto";

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
  /** Admin del equipo (puede usar el editor de la casa). */
  admin?: boolean;
  /** Emotes aceptados hace poco (pausa entre uno y otro y tope por ráfaga, ver `acceptEmote`). */
  emoteTimes?: number[];
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
const RECONNECT_SECONDS = 15;
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
  /** Cuánto dura en la mano lo pedido en la cafetería (los tests lo acortan). */
  static heldMs: number = CAFE.heldMs;
  /** Pausa entre dos usos de lo que se tiene en la mano (los tests la acortan). */
  static consumeCooldownMs: number = CONSUME.cooldownMs;
  /** Tiempos de la ruleta y de dónde sale el número (los tests los acortan y fijan el resultado). */
  static rouletteTimings: RouletteTimings = { ...CASINO.roulette };
  static rouletteSpin: () => number = randomSpin;
  static blackjackTimings: BlackjackTimings = { ...BLACKJACK };
  static blackjackShuffle: () => number[] = randomShoe;
  /** Pesca: el azar (entero en [0, n)), la hora (para el horario de los peces) y los tiempos del lance. */
  static fishingRandom: (n: number) => number = (n) => randomInt(n);
  static fishingNow: () => number = () => Date.now();
  static fishingTimings: FishingTimings = { ...FISHING };
  /** Casa viva: el azar de las mascotas y cuánto se está en el baño (los tests los fijan y acortan). */
  static petRandom: () => number = Math.random;
  static stallMs: number = CASA.stallMs;
  /** Reloj del huerto (los tests lo adelantan para que crezca lo sembrado). */
  static huertoNow: () => number = () => Date.now();
  /** Semilla de cada partida del arcade (los tests la fijan). */
  static arcadeSeed: () => number = () => randomInt(2 ** 31);
  /** Reloj del arcade (los tests lo adelantan para no esperar la duración mínima de una partida). */
  static arcadeNow: () => number = () => Date.now();
  /** Azar y reloj del clima (los tests los fijan); `weatherInitial` null = según la hora de Bogotá. */
  static weatherRandom: () => number = () => randomInt(2 ** 30) / 2 ** 30;
  static weatherNow: () => number = () => Date.now();
  static weatherInitial: Weather | null = null;
  /** Cada cuánto se guardan juntas las estadísticas de los logros (los tests lo acortan). */
  static statsFlushMs = 20_000;

  /** Relee los ajustes del casino en todas las salas (los cambió un admin en /admin). */
  /** Otra sala guardó un cambio del editor de la casa: se aplica acá también. */
  static applyWorldEditsEverywhere(area: string, edits: WorldEdits) {
    for (const r of OfficeRoom.instances) r.applyWorldEdits(area, edits);
  }

  /** Se subió o se borró una foto (lo avisa la web): todos vuelven a pedir la lista del tablón. */
  static broadcastPhotosChanged() {
    for (const r of OfficeRoom.instances) r.broadcast(MSG.photosChanged, {});
  }

  /** Cuenta regresiva y pausa entre fotos (los tests las acortan). */
  static photoTimings: { countdownMs: number; cooldownMs: number } = { ...PHOTO_TIMINGS };

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
  /** Lo que cada persona lleva en la mano y sus usos (por userId: sobrevive a recargar la página). */
  private held = new HeldItems(
    { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
    () => OfficeRoom.heldMs,
    (userId, item, left) => {
      for (const p of this.state.players.values())
        if (p.userId === userId) {
          p.held = item;
          p.heldLeft = formatHeldLeft(left);
        }
    },
    () => OfficeRoom.consumeCooldownMs,
  );
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
  /** El clima de afuera (lo ven todos: `state.weather`). */
  private weather = new WeatherCycle(
    {
      clock: { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      now: () => OfficeRoom.weatherNow(),
      random: () => OfficeRoom.weatherRandom(),
      onChange: (w) => {
        this.state.weather = w;
      },
    },
    OfficeRoom.weatherInitial ?? initialWeather(OfficeRoom.weatherNow()),
  );
  /** Lo que dura un desmayo (los tests lo acortan). */
  static faintMs: number = DRUNK.faintMs;
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
    },
    caught: (userId, fish, size, first, treasure) => this.fishCaught(userId, fish, size, first, treasure),
  });
  /** Estadísticas y logros (ver achievements.ts): se suman en memoria y se guardan juntas. */
  private achievements = new AchievementTracker({
    repo: () => this.repo,
    onUnlock: (userId, achievement) => {
      for (const [sessionId, p] of this.state.players) {
        if (p.userId !== userId) continue;
        this.sendToArea(p.area, MSG.achievementUnlocked, { sessionId, name: p.name, achievementId: achievement.id } satisfies AchievementUnlockedEvent);
      }
    },
  });

  /** Fotos: la cuenta 3-2-1, quiénes salen y el ticket para subirla (ver photos.ts). */
  private photos = new PhotoBooth({
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    now: () => Date.now(),
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
  /** Intercambios en vivo entre dos personas cerca (fase 5). */
  private trades = new Trades({
    player: (sessionId) => this.state.players.get(sessionId),
    send: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
    repo: () => this.repo,
    setPoints: (userId, balance) => {
      for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
    },
    later: (ms, fn) => this.clock.setTimeout(fn, ms),
    inviteTimeoutMs: () => OfficeRoom.tradeInviteMs,
  });
  /** Cuánto espera una invitación a intercambiar (los tests lo acortan). */
  static tradeInviteMs: number = TRADE.requestTimeoutMs;

  /** La web avisó que alguien mandó un regalo: si quien lo recibe está conectado, le llega el aviso. */
  static giftReceivedEverywhere(notice: GiftSentNotice) {
    const { toId, ...gift } = notice;
    for (const room of OfficeRoom.instances)
      for (const c of room.clients) if (room.state.players.get(c.sessionId)?.userId === toId) c.send(MSG.giftReceived, gift satisfies GiftReceived);
  }
  /** Casa viva: lo gratis que queda en la mano, los cubículos del baño y las mascotas. */
  private casa!: CasaViva;
  private pets!: Pets;
  /** El club del sótano (música, pista y tubo) y el arcade. */
  private club!: Club;
  private arcade!: Arcade;
  /** El cine del sótano (la cola de la función). */
  private cinema!: Cinema;
  /** Jardín vivo: el huerto, el cobertizo y la miel (ver huerto.ts). */
  private huerto!: Huerto<GardenPlotState>;
  /** El hockey de mesa del arcade (un partido a la vez; ver hockey.ts). */
  private hockey!: HockeyTable;

  private get repo() {
    return OfficeRoom.repo;
  }

  async onCreate() {
    // Copia propia de la lista de niveles: rearmar el piso 2 no toca el mundo compartido del módulo.
    const base = getWorld();
    this.world = { ...base, areas: new Map(base.areas) };
    for (const z of allZones(this.world)) this.zonesById.set(z.id, z);
    for (const [areaId, map] of this.world.areas) for (const z of map.zones) this.areaOfZone.set(z.id, areaId);
    this.setState(new OfficeState());
    this.casa = new CasaViva(
      this.state.stalls,
      { setTimeout: (fn, ms) => this.clock.setTimeout(fn, ms) },
      (userId, item) => this.held.give(userId, item),
      () => OfficeRoom.stallMs,
    );
    this.furnitureUses = new FurnitureUses(this.state.switches, {
      counters: this.state.counters,
      occupant: this.casa.occupant,
      holding: (userId) => this.held.get(userId)?.item,
    });
    this.startPets();
    this.club = new Club(this.state.club);
    this.cinema = new Cinema(this.state.cinema);
    this.arcade = new Arcade({
      repo: () => this.repo,
      seed: () => OfficeRoom.arcadeSeed(),
      token: () => randomUUID(),
      award: (userId, amount) => this.awardLeisure(userId, amount),
      setPoints: (userId, balance) => {
        for (const p of this.state.players.values()) if (p.userId === userId) p.points = balance;
      },
    });
    this.huerto = new Huerto({
      plots: this.state.garden,
      create: () => new GardenPlotState(),
      repo: () => this.repo,
      held: {
        get: (userId) => this.held.get(userId),
        give: (userId, item) => this.held.give(userId, item),
        spend: (userId, now) => {
          const used = this.held.use(userId, now, 0, { skipCooldown: true, tool: true });
          return used.ok ? { done: used.done } : null;
        },
      },
      award: (userId, amount) => this.awardLeisure(userId, amount),
    });
    this.startHockey();
    OfficeRoom.instances.add(this);

    this.onMessage(HUERTO_MSG.shedTake, (client, raw) => this.handleShed(client, raw));
    this.onMessage(MSG.move, (client, raw) => this.handleMove(client, raw));
    this.onMessage(MSG.chatSend, (client, raw) => this.handleChat(client, raw));
    this.onMessage(MSG.status, (client, raw) => this.handleStatus(client, raw));
    this.onMessage(MSG.profileChanged, (client) => void this.handleProfileChanged(client));
    this.onMessage(MSG.officeLock, (client, raw) => this.handleLock(client, raw));
    this.onMessage(MSG.officeNote, (client, raw) => this.handleOfficeNote(client, raw));
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
    this.onMessage(MSG.knock, (client, raw) => this.handleKnock(client, raw));
    this.onMessage(MSG.knockRespond, (client, raw) => this.handleKnockRespond(client, raw));
    this.onMessage(MSG.travel, (client, raw) => this.handleTravel(client, raw));
    this.onMessage(MSG.activity, (client) => this.markActive(client));
    this.onMessage(MSG.cafeOrder, (client, raw) => void this.handleCafeOrder(client, raw));
    this.onMessage(MSG.barOrder, (client, raw) => void this.handleOrder(client, raw, "bar"));
    this.onMessage(MSG.cinemaOrder, (client, raw) => void this.handleOrder(client, raw, "cine"));
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
    this.onMessage(MSG.worldEdit, (client, raw) => {
      this.serial(() => this.handleWorldEdit(client, raw)).catch((err) => {
        console.error("worldEdit", err);
        client.send(MSG.worldEditResult, { ok: false, error: "failed" } satisfies WorldEditResult);
      });
    });
    this.onMessage(MSG.emote, (client, raw) => this.handleEmote(client, raw));
    this.onMessage(MSG.photoTake, (client) => {
      this.markActive(client);
      this.photos.take(client.sessionId);
    });
    this.onMessage(MSG.rouletteBet, (client, raw) => void this.handleRouletteBet(client, raw));
    this.onMessage(MSG.blackjackBet, (client, raw) => void this.handleBlackjack(client, raw, "bet"));
    this.onMessage(MSG.blackjackAction, (client, raw) => void this.handleBlackjack(client, raw, "action"));
    this.onMessage(MSG.fishCast, (client) => this.handleFishCast(client));
    this.onMessage(MSG.fishHook, (client, raw) => this.withFisher(client, (userId) => this.fishery.hook(userId, raw)));
    this.onMessage(MSG.fishFinish, (client, raw) => this.withFisher(client, (userId) => void this.fishery.finish(userId, raw)));
    this.onMessage(MSG.fishCancel, (client) => this.withFisher(client, (userId) => this.fishery.cancel(userId)));
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
    this.onMessage(MSG.cinemaQueue, (client, raw) => void this.handleCinema(client, raw));
    this.onMessage(MSG.arcadeBoard, (client, raw) => void this.handleArcadeBoard(client, raw));
    this.onMessage(MSG.arcadeStart, (client, raw) => void this.handleArcadeStart(client, raw));
    this.onMessage(MSG.arcadeFinish, (client, raw) => void this.handleArcadeFinish(client, raw));
    this.onMessage(MSG.hockeyJoin, (client, raw) => void this.handleHockeyJoin(client, raw));
    this.onMessage(MSG.hockeyMove, (client, raw) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.hockey.move(p.userId, raw);
    });
    this.onMessage(MSG.hockeyLeave, (client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.hockey.leave(p.userId);
    });
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
      this.cinema.tick(Date.now());
    }, 500);
    this.clock.setInterval(() => void this.presenceTick(), OfficeRoom.presenceTickMs);
    this.weather.start();
    this.clock.setInterval(() => void this.achievements.flushAll(), OfficeRoom.statsFlushMs);

    const officeZones = allZones(this.world).filter((z) => z.type === "office");
    await this.repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));
    await this.reloadCasinoSettings();
    await this.loadWorldEdits();
    await this.huerto.load().catch((err) => console.error("loadGarden", err));
    this.startCasino();
    await this.reloadOffices();
    this.globalHistory = await this.repo.loadGlobalChat(CHAT_HISTORY_SIZE);
  }

  onDispose() {
    OfficeRoom.instances.delete(this);
    this.drunk.dispose();
    this.toasts.dispose();
    this.weather.dispose();
    void this.achievements.flushAll();
    void this.whiteboards.flush();
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

  async onJoin(client: Client<UserData>, _options: unknown, auth: GameTokenClaims) {
    this.removeOtherPresences(auth.sub, client.sessionId);
    this.fishery.forget(auth.sub); // un lance de la sesión anterior no sigue en la nueva

    // Todos aparecen en el jardín, frente a la cabaña.
    const area = this.world.spawnArea;
    const map = this.mapOf(area);
    const spawn = spawnPoint(map);
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
    player.status = (await this.repo.getUserStatus(auth.sub).catch(() => null)) ?? "available";
    // La primera vez que entra, el bono de bienvenida (una sola vez; ver POINTS.welcomeBonus).
    const welcome = await this.repo.grantWelcome(auth.sub).catch(() => null);
    player.points = welcome?.balance ?? (await this.repo.getPoints(auth.sub).catch(() => 0));
    const held = this.held.get(auth.sub);
    player.held = held?.item ?? "";
    player.heldLeft = held ? formatHeldLeft(held.left) : "";
    player.drunk = this.drunk.stage(auth.sub);
    this.state.players.set(client.sessionId, player);

    client.userData = { lastMoveAt: Date.now(), chatTimes: [], lastActiveAt: Date.now(), admin: auth.role === "ADMIN" };
    void this.achievements.load(auth.sub).then(() => {
      this.achievements.visit(auth.sub, area);
      this.achievements.max(auth.sub, STAT_KEYS.pointsPeak, player.points);
    });
    client.send(MSG.chatHistory, this.globalHistory);
    // La hora del servidor, para que el cliente calcule bien los conteos regresivos (la ruleta).
    client.send(MSG.clock, { now: Date.now() });
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

  /** Editor de la casa (solo admins): valida el cambio, lo guarda y lo aplica en todas las salas. */
  private async handleWorldEdit(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = WorldEditMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const reply = (r: WorldEditResult) => client.send(MSG.worldEditResult, r);
    if (!client.userData.admin) return reply({ ok: false, error: "admin" });
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
      if (p.seated ? seatAtPoint(map, p.x, p.y) : canStandAt(map, p.x, p.y)) continue;
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
    reply({ ok: true });
  }

  /** ¿Puede este jugador estar en (x, y)? Bloquea oficinas cerradas a quien no es dueño ni invitado. */
  private canAccess(player: Player, x: number, y: number): boolean {
    const zone = zoneAt(this.mapOf(player.area), x, y);
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

    office.locked = parsed.data.locked;
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
        office.radioVideo = "";
        office.radioTitle = "";
        office.radioStartedAt = 0;
        office.radioPaused = false;
        office.radioPausedAt = 0;
        office.radioDurationMs = 0;
        return;
    }
  }

  /** La nota de la placa de la puerta: solo el dueño de la oficina, una línea corta. */
  private handleOfficeNote(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = OfficeNoteMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const office = [...this.state.offices.values()].find((o) => o.ownerId === player.userId);
    if (!office) return;
    office.note = cleanOfficeNote(parsed.data.note);
  }

  private handleKnock(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = KnockMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const office = this.state.offices.get(parsed.data.zoneId);
    if (!office || !office.ownerId || office.ownerId === player.userId) return;

    const reply = (outcome: KnockOutcome) =>
      client.send(MSG.knockResult, { zoneId: office.zoneId, outcome, ownerName: office.ownerName } satisfies KnockResult);

    if (!office.locked || office.guests.includes(player.userId)) return reply("not-locked");

    const key = `${player.userId}:${office.zoneId}`;
    const now = Date.now();
    if (now - (this.lastKnockAt.get(key) ?? 0) < KNOCK_COOLDOWN_MS) return reply("too-soon");
    this.lastKnockAt.set(key, now);

    const owner = this.clientOfUser(office.ownerId);
    if (!owner) return reply("owner-away");

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

  private handleKnockRespond(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = KnockRespondMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const knock = this.pendingKnocks.get(parsed.data.requestId);
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

    const map = this.mapOf(player.area);
    // Desmayado no se mueve (el cliente ya lo sabe; esto es por si insiste).
    if (this.drunk.fainted(player.userId)) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y } satisfies MoveCorrection);
      return;
    }
    const now = Date.now();
    const dt = (now - client.userData.lastMoveAt) / 1000;
    client.userData.lastMoveAt = now;
    // Tolerancia: latencia/jitter + mínimo de medio tile. Sentarse y levantarse "saltan" hasta
    // el asiento (p. ej. del tile de enfrente a la silla), así que ahí se permite algo más.
    const snap = seated !== player.seated ? map.tileSize * SEAT_REACH_TILES : 0;
    // En la carrera de sillas se va más rápido.
    const speed = PLAYER_SPEED * (player.racing ? CHAIR_RACE.speedMul : 1);
    const maxDist = Math.max(map.tileSize * 0.75, dt * speed * 1.6, snap);
    const dist = Math.hypot(x - player.x, y - player.y);

    // Sentado: la posición debe ser la de un asiento libre (los muebles bloquean el paso, así que
    // no se valida canStandAt) y se mira hacia donde mira el asiento. De pie: el tramo desde la
    // posición anterior no puede cruzar paredes (son bordes delgados entre tiles).
    const seat = seated ? seatAtPoint(map, x, y) : undefined;
    const fromSeat = player.seated && !seated;
    const validSpot = seated
      ? Boolean(seat) && !this.seatTaken(client.sessionId, x, y)
      : canStandAt(map, x, y) && (fromSeat || canWalkBetween(map, player.x, player.y, x, y));
    if (seat) dir = seat.facing;

    if (dist > maxDist || !validSpot || !this.canAccess(player, x, y)) {
      const correction: MoveCorrection = { x: player.x, y: player.y };
      client.send(MSG.moveCorrection, correction);
      return;
    }

    const previousZoneId = player.zoneId;
    if (x !== player.x || y !== player.y) {
      client.userData.lastActiveAt = now;
      // Casa viva: moverse te saca del cubículo del baño.
      this.casa.leaveStall(player.userId);
    }
    player.x = x;
    player.y = y;
    player.dir = dir;
    player.moving = seated ? false : moving;
    player.seated = seated;
    player.zoneId = zoneAt(map, x, y)?.id ?? "";
    player.place = placeAt(map, x, y);
    this.revokeGuestOnExit(player, previousZoneId);
    this.whiteboards.moved(client.sessionId, player.zoneId);
    this.fishery.moved(player.userId, x, y, seated);
    this.trades.moved(client.sessionId);
    this.club.moved({ sessionId: client.sessionId, area: player.area, x, y, seated });
    if (player.racing) void this.raceOutcome(client.sessionId, this.races.moved(map, client.sessionId, player, now));
    if (!seated && !fromSeat && dist > 0) this.achievements.walk(player.userId, dist / map.tileSize);
  }

  /** Pasar a otro nivel por un portal: hay que estar parado junto a él. */
  private handleTravel(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = TravelMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const map = this.mapOf(player.area);
    const portal = map.portals.find((p) => p.id === parsed.data.portal);
    if (!portal || player.seated || this.drunk.fainted(player.userId) || !nearPortal(map, portal, player.x, player.y)) {
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
    client.userData.lastMoveAt = Date.now();
    this.fishery.cancel(player.userId);
    this.achievements.visit(player.userId, target.id);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
    this.trades.moved(client.sessionId);
    void this.raceOutcome(client.sessionId, this.races.cancel(client.sessionId, player, "lane"));
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
    const since = weekStart(Date.now());
    const before = await this.repo.raceBoard({ since, limit: 1, userId: player.userId }).catch(() => null);
    await this.repo.saveRaceTime({ userId: player.userId, name: player.name, ms: outcome.ms }).catch((err) => console.error("saveRaceTime", err));
    const board = await this.repo.raceBoard({ since, limit: CHAIR_RACE.boardSize, userId: player.userId }).catch(() => ({ entries: [], myBest: outcome.ms }));
    const best = before?.myBest == null || outcome.ms < before.myBest;
    const record = !before?.entries[0] || outcome.ms < before.entries[0].ms;
    client?.send(MSG.raceResult, { ok: true, ms: outcome.ms, best, board } satisfies RaceResult);
    const event: RaceEvent = { sessionId, name: player.name, ms: outcome.ms, record };
    this.sendToArea(player.area, MSG.raceEvent, event);
  }

  private async sendRaceBoard(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const board = await this.repo.raceBoard({ since: weekStart(Date.now()), limit: CHAIR_RACE.boardSize, userId: player.userId }).catch(() => null);
    if (board) client.send(MSG.raceBoardResult, board);
  }

  /** Se pasó de tragos: se le cae lo que tenía en la mano, vomita y queda en el piso (lo ve su nivel). */
  private blackout(userId: string) {
    this.achievements.bump(userId, STAT_KEYS.blackouts);
    this.held.drop(userId);
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
      const free = restSeats.filter((s) => !this.seatTaken(sessionId, s.x, s.y));
      // Los sofás primero (se descansa mejor que en una banqueta).
      const seat = free.find((s) => s.type.includes("sofa")) ?? free[0];
      const near = restSeats[0] ?? { x: map.tileSize, y: map.tileSize };
      const pos = seat ?? this.freeSpotNear(map, near.x, near.y);
      const previousZoneId = player.zoneId;
      player.area = map.id;
      player.x = pos.x;
      player.y = pos.y;
      player.moving = false;
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

  /** ¿Hay otra persona sentada en (x, y)? */
  private seatTaken(sessionId: string, x: number, y: number) {
    for (const [id, p] of this.state.players) {
      if (id !== sessionId && p.seated && Math.abs(p.x - x) <= 0.5 && Math.abs(p.y - y) <= 0.5) return true;
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
    const profile = await this.repo.getUserProfile(userId).catch((err) => {
      console.error("getUserProfile", err);
      return null;
    });
    const player = this.state.players.get(client.sessionId); // pudo irse mientras tanto
    if (!profile || !player) return;
    player.name = profile.name;
    player.avatar = profile.avatar;
    player.look = profile.look ? JSON.stringify(profile.look) : "";
  }

  private handleStatus(client: Client<UserData>, raw: unknown) {
    const parsed = StatusMessage.safeParse(raw);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    player.status = parsed.data.status;
    this.repo.setUserStatus(player.userId, parsed.data.status).catch((err) => console.error("setUserStatus", err));
  }

  /** Solo en desarrollo: "/ir <nivel> [punto]" (ver devtools.ts). Devuelve si era el comando. */
  private devJump(client: Client<UserData>, player: Player, text: string): boolean {
    const jump = parseDevJump(text, getWorld().areas);
    if (!jump) return false;
    if ("error" in jump) {
      const note: ChatEvent = { id: randomUUID(), fromId: "", fromName: "Dev", text: jump.error, scope: "proximity", zoneId: null, ts: Date.now() };
      client.send(MSG.chatEvent, note);
      return true;
    }
    const target = this.mapOf(jump.area);
    const ts = target.tileSize;
    const pos = this.freeSpotNear(target, jump.x * ts + ts / 2, jump.y * ts + ts / 2);
    player.area = target.id;
    player.x = pos.x;
    player.y = pos.y;
    player.moving = false;
    player.seated = false;
    player.zoneId = zoneAt(target, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(target, pos.x, pos.y);
    client.userData!.lastMoveAt = Date.now();
    this.achievements.visit(player.userId, target.id);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
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

  private handleChat(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = ChatSendMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;

    const now = Date.now();
    const times = client.userData.chatTimes.filter((t) => now - t < CHAT_RATE.windowMs);
    if (times.length >= CHAT_RATE.max) return;
    times.push(now);
    client.userData.chatTimes = times;
    if (devToolsEnabled() && (this.devJump(client, player, parsed.data.text) || this.devWeather(client, parsed.data.text))) return;
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
      if (!player || !data || player.status === "away" || now - data.lastActiveAt > OfficeRoom.idleMs) continue;
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
    this.achievements.bump(userId, `${STAT_PREFIX.secArea}${player.area}`, secs);
    if (player.zoneId) this.achievements.bump(userId, `${STAT_PREFIX.secZone}${player.zoneId}`, secs);
    this.achievements.activeAt(userId, now);
  }

  private async reloadPoints(userId: string) {
    const players = [...this.state.players.values()].filter((p) => p.userId === userId);
    if (players.length === 0) return;
    const balance = await this.repo.getPoints(userId);
    for (const p of players) p.points = balance;
    // La web pudo sumar estadísticas (racha del buzón, misiones): se releen y se revisan los logros.
    await this.achievements.refresh(userId).catch((err) => console.error("achievements.refresh", err));
    this.achievements.max(userId, STAT_KEYS.pointsPeak, balance);
  }

  // ---------- Casino ----------

  private casinoSettings: CasinoSettingsDTO = { enabled: true };
  private roulette?: RouletteTable;
  private blackjack?: BlackjackTable;

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
    });
    this.roulette.start();
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

  private async handleBlackjack(client: Client<UserData>, raw: unknown, kind: "bet" | "action") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.blackjack) return;
    const seat = this.blackjackSeatOf(player);
    const who = { userId: player.userId, name: player.name };
    const result = kind === "bet" ? await this.blackjack.bet(who, seat, raw) : await this.blackjack.action(who, seat, raw);
    if (result) client.send(MSG.casinoResult, result);
  }

  private async handleRouletteBet(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.roulette) return;
    const near = nearPointOfType(this.mapOf(player.area), "roulette", player.x, player.y);
    const result = await this.roulette.bet({ userId: player.userId, name: player.name }, raw, near);
    if (result) client.send(MSG.casinoResult, result);
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
    client.userData.lastOrderAt = now;

    const userId = player.userId;
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
    this.held.give(userId, item.id);
    const a = this.achievements;
    // La confitería del cine cuenta como la cafetería (no es trago).
    a.bump(userId, menu === "bar" ? STAT_KEYS.barOrders : STAT_KEYS.cafeOrders);
    a.bump(userId, `${STAT_PREFIX.order}${item.id}`);
    const holds: readonly string[] = item.holds;
    if (holds.includes("tinto") || holds.includes("cafe-leche")) a.bump(userId, STAT_KEYS.coffees);
    if (holds.includes("habano")) a.bump(userId, STAT_KEYS.habanos);
    reply({ ok: true, item: item.id, balance: result.balance });
  }

  /** Usar lo que se tiene en la mano (una pitada, un sorbo, un mordisco): lo ven los del mismo nivel. */
  private handleUseHeld(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = UseHeldMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const now = Date.now();
    const used = this.held.use(player.userId, now, parsed.data?.part);
    if (!used.ok) return;
    this.countUse(player.userId, used.art, used.action);
    this.drunk.consumed(player.userId, used.art);
    client.userData.lastActiveAt = now;
    const event: HeldUsedEvent = { sessionId: client.sessionId, part: used.part, art: used.art, action: used.action, left: used.left };
    this.sendToArea(player.area, MSG.heldUsed, event);
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
    const used = this.held.use(userId, Date.now(), part, { skipCooldown: true });
    if (!used.ok) return null;
    this.drunk.consumed(userId, used.art);
    // Cada vaso que choca es un brindis (logro "¡Salud!") y un sorbo más.
    this.achievements.bump(userId, STAT_KEYS.toasts);
    this.countUse(userId, used.art, used.action);
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

  private countUse(userId: string, art: string, action: string) {
    const a = this.achievements;
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
      // Casa viva: por qué no (las manos llenas, el baño ocupado); lo demás se ignora como antes.
      if (result.error === "hands" || result.error === "stall") client.send(CASA_MSG.notice, { code: result.error } satisfies CasaNotice);
      return;
    }
    client.userData.lastActiveAt = now;
    // Jardín vivo: las parcelas, el barril y el pozo y las colmenas tienen sus reglas (huerto.ts).
    if (result.kind === "event" && isHuertoAction(result.event.action)) return void this.handleHuerto(client, player, result.event);
    this.countFurniture(player.userId, result);
    if (result.kind === "event") {
      const event: FurnitureEvent = { sessionId: client.sessionId, ...result.event };
      this.sendToArea(player.area, MSG.furnitureEvent, event);
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
    this.sendToArea(area, MSG.furnitureEvent, { sessionId: client.sessionId, ...result.event } satisfies FurnitureEvent);
  }

  /** Sacar la regadera o semillas del cobertizo (junto a su puerta). */
  private handleShed(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = this.huerto.shed(this.mapOf(player.area), player, raw);
    if (result && !result.ok) client.send(HUERTO_MSG.notice, result.notice satisfies HuertoNotice);
  }

  // ---------- Casa viva: mascotas ----------

  /** Las mascotas aparecen durmiendo en sus camas y el servidor las mueve seguido. */
  private startPets() {
    this.pets = new Pets({
      pets: this.state.pets,
      create: () => new Pet(),
      map: (area) => this.mapOf(area),
      rng: () => OfficeRoom.petRandom(),
    });
    let last = Date.now();
    this.pets.start(last);
    this.clock.setInterval(() => {
      const now = Date.now();
      this.pets.tick(now, Math.min(500, now - last));
      last = now;
    }, PET.tickMs);
  }

  /** Llamar a una mascota (clic) o acariciarla y darle un premio (de cerca): lo ven los del nivel. */
  private handlePet(client: Client<UserData>, raw: unknown, kind: "call" | "action") {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const now = Date.now();
    const who: PetUser = { userId: player.userId, area: player.area, x: player.x, y: player.y };
    const result = kind === "call" ? this.pets.call(who, raw, now) : this.pets.act(who, raw, now);
    if (!result.ok) {
      // Al que pidió acariciar o dar un premio se le dice por qué no (llamar lejos no avisa: es un clic).
      if (result.error === "fed" || (kind === "action" && result.error === "far")) {
        client.send(CASA_MSG.notice, { code: result.error === "fed" ? "fed" : "petFar" } satisfies CasaNotice);
      }
      return;
    }
    const action = result.action;
    client.userData.lastActiveAt = now;
    const pet = (raw as { pet: string }).pet;
    this.sendToArea(player.area, PET_MSG.event, { pet, sessionId: client.sessionId, action } satisfies PetEvent);
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

  private sendToArea(area: string, type: string, message: unknown) {
    for (const other of this.clients) {
      if (this.state.players.get(other.sessionId)?.area === area) other.send(type, message);
    }
  }

  // ---------- Pesca ----------

  /** Lanzar la caña: el servidor valida que estés junto a un punto de pesca del lago y de pie. */
  private handleFishCast(client: Client<UserData>) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const near = nearPointOfType(this.mapOf(player.area), "fishing_spot", player.x, player.y);
    this.fishery.cast({ userId: player.userId, x: player.x, y: player.y, seated: player.seated }, near);
  }

  /** Sacó algo del lago: peces, basura, botas, legendarios, especies nuevas y el más grande. */
  private fishCaught(userId: string, fish: FishSpecies, size: number, first: boolean, treasure: boolean) {
    const a = this.achievements;
    if (fish.rarity === "basura") {
      a.bump(userId, STAT_KEYS.fishTrash);
      if (fish.id === "bota") a.bump(userId, STAT_KEYS.boots);
      return;
    }
    a.bump(userId, STAT_KEYS.fishCaught);
    if (first) a.bump(userId, STAT_KEYS.fishSpecies);
    if (fish.rarity === "legendario") a.bump(userId, STAT_KEYS.legendaryFish);
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
        result = this.club.enqueue({ videoId, title: info.title }, player.name, Date.now());
        break;
      }
      case "replay":
        result = this.club.replay(msg.id, player.name, now);
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

  private async handleHockeyJoin(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    const result = await this.hockey.join(player, raw);
    if (result) client.send(MSG.hockeyResult, result);
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
      return awarded;
    } catch (err) {
      console.error("awardPoints", err);
      return 0;
    }
  }

  // ---------- Utilidades ----------

  private removePlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    this.state.players.delete(sessionId);
    this.club?.forget(sessionId);
    this.whiteboards.forget(sessionId);
    this.races.forget(sessionId);
    if (!player) return;
    // Si ya no le queda ninguna sesión, deja de ser invitado en cualquier oficina.
    const stillHere = [...this.state.players.values()].some((p) => p.userId === player.userId);
    if (stillHere) return;
    this.fishery.forget(player.userId);
    this.hockey?.leave(player.userId);
    this.casa.forget(player.userId);
    this.swivels.forget(player.userId);
    void this.achievements.forget(player.userId);
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

  private positioned(p: Player): Positioned {
    const zone = p.zoneId ? this.zonesById.get(p.zoneId) : undefined;
    return { area: p.area, x: p.x, y: p.y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false };
  }

  private mapOf(area: string): OfficeMap {
    return this.world.areas.get(area) ?? this.world.areas.get(this.world.spawnArea)!;
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
}
