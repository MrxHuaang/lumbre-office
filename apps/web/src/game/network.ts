import { bindCocina } from "./cocina";
import { bindGranja } from "./granjaNet";
import { bindVelitas } from "./velitas";
import { bindRace } from "./race";
import {
  DIRECTIONS,
  MSG,
  ROOM_NAME,
  menuItem,
  type BarItemId,
  type CinemaMenuItemId,
  type CafeItemId,
  type DoorNoteResult,
  type FurnitureEvent,
  type HeldUsedEvent,
  type DrunkBlackoutEvent,
  type SwivelEvent,
  type BoardRemoveEvent,
  type BoardStateEvent,
  type BoardStrokeEvent,
  type BoardStrokeInput,
  type WorldEditLockResult,
  type OfficeRadioMessage,
  type OfficeRadioResult,
  OFFICE_RADIO_ERROR_TEXT,
  type ToastEvent,
  type ToastResult,
  TOAST_ERROR_TEXT,
  type CafeOrderResult,
  CASINO_ERROR_TEXT,
  type CasinoResult,
  type ChatEvent,
  type ChatScope,
  type BlackjackAction,
  type BlackjackSettled,
  type RouletteBetSpec,
  type RouletteSettled,
  type Direction,
  type EmoteEvent,
  type EmoteId,
  type JoinOptions,
  type Invitation,
  type InviteResult,
  type KnockRequest,
  type KnockResult,
  type MoveCorrection,
  type MoveMessage,
  type OfficeEditError,
  type OfficeEditMessage,
  type OfficeEditResult,
  type PointsAwarded,
  LEISURE_FULL_TEXT,
  LEISURE_MSG,
  type LeisureState,
  type PresenceStatus,
  type WorldEditMessage,
  type WorldEditResult,
  PET_MSG,
  type PetEvent,
  CASA_MSG,
  RECHAZO_MSG,
  RECHAZO_TEXT,
  type RechazoNotice,
  CASA_NOTICES,
  type CasaNotice,
  PET_NOTICES,
  type PetAction,
  type PetNotice,
  HUERTO_MSG,
  huertoNoticeText,
  BUS_MSG,
  BUS_NOTICES,
  casaPropiaNoticeText,
  CASA_PROPIA_MSG,
  type CasaPropiaNotice,
  type BusNotice,
  type HuertoNotice,
  isWeather,
  type PhotoCountdownEvent,
  type PhotoFlashEvent,
  type PhotoShot,
  achievementById,
  type AchievementUnlockedEvent,
  CONGRATS_ERROR_TEXT,
  FOCUS_CANCEL_TEXT,
  type CongratsEvent,
  type CongratsResult,
  type FocusEvent,
  type FocusPhase,
  type FocusPresetId,
  SOMBRERO_ERROR_TEXT,
  SOMBRERO_THANKS,
  sombreroItem,
  type SombreroBuyResult,
  type SombreroItemId,
} from "@hyvento/shared";
import { parseWorldEdits, setWorldEdits, WORLD_EDIT_ERRORS } from "@hyvento/map";
import { Client, getStateCallbacks, type Room } from "colyseus.js";
import { useCasinoStore, type RouletteBetView } from "./casino";
import { bindArcade } from "./arcade/net";
import { bindHockey } from "./arcade/hockey";
import { bindMesas } from "./mesas";
import { bindBoardGames } from "./boardgames";
import { bindClub, togglePole } from "./club/net";
import { bindCinema } from "./cinema/net";
import { bindPiscina, sendAgua } from "./piscina/net";
import { selectMyUserId, useOfficeStore, type Interactable } from "./store";
import { ESCENARIO, ESCENARIO_MSG, PODCAST_MSG } from "@hyvento/shared";
import { media } from "./media";
import { useEscenarioStore } from "./escenario/store";
import { useDoorNotesStore } from "./doorNotes";
import { usePhoneStore as useCelularStore } from "./phone/state";
import { fishingSpotAction } from "./fishing/net";
import { handleFishEvent } from "./fishing/store";
import { useAchievementStore } from "./achievements";
import { bindBag } from "./bag";
import { bindCasaArbol } from "./casaArbol";
import { bindCasas, casasAbiertasPara, useCasasStore } from "./casaVisitas";
import { bindPesca } from "./pesca";
import { sfx } from "./sfx";
import { bindNotify } from "./notify";
import { bindPhone, resetPhone } from "./phone";
import { bindPermisos } from "./permisos";
import { bindComunicacion, resetComunicacion } from "./comunicacion";
import { useSombreroStore } from "./npcs/store";
import { RESTART_MSG } from "@hyvento/shared";
import { isDeadReconnection, isServerUnavailable, leaveAction, RECONNECT_BUDGET_MS, reconnectDelays, RESTART_BUDGET_MS, unreachableText, withJitter } from "@/lib/reconnect";
import { GAME_SERVER_URL, IS_DEV, useReconnectStore } from "./reconexion";
import { fetchGameToken, SessionExpiredError } from "./gameToken";
import { forgetOldSession } from "./sesionNueva";

/** Forma del estado sincronizado (espejo de apps/server/src/state.ts). */
export interface RemotePlayer {
  userId: string;
  name: string;
  avatar: string;
  /** Look en JSON ("" = personaje fijo). */
  look: string;
  /** Nivel de la cabaña ("jardin", "planta-baja", "piso-2"). */
  area: string;
  x: number;
  y: number;
  dir: MoveMessage["dir"];
  moving: boolean;
  seated: boolean;
  status: PresenceStatus;
  zoneId: string;
  place: string;
  points: number;
  /** Lo que lleva en la mano (la casilla elegida de la mochila: el id de su dibujo; "" = nada). */
  held: string;
  /** Usos que le quedan a lo de la mano ("4"). */
  heldLeft: string;
  /** Pesca: "", "wait", "nibble", "bite", "reel" o "show:<pez>". */
  fishing: string;
  /** Con qué caña pesca ("" o "bambu", "fibra", "carbono"): el color de la caña. */
  fishingRod: string;
  /** Borrachera: 0 sobrio … 3 borracho (DrunkStage). */
  drunk: number;
  /** Corriendo la carrera de sillas. */
  racing: boolean;
  /** Nadando en la piscina del jardín y recién salido del agua (gotea). */
  swimming: boolean;
  wet: boolean;
  /** Insignia destacada (id de un logro; "" = ninguna). */
  badge: string;
  /** Nivel de vecino (la suma de los niveles de los oficios; 0 = todavía no llegó). */
  vecino?: number;
  /** Energía de un plato de la cocina (id de la receta; "" = nada). */
  buff: string;
  /** Modo foco: "" nada, "work" o "break"; cuándo termina (hora del servidor) y el preset. */
  focus?: string;
  focusEndsAt?: number;
  focusPreset?: string;
  /** Teléfono: "", "calling", "ringing" o "talking" (CallPhase), con quién (userId) y desde cuándo. */
  call: string;
  callWith: string;
  callSince: number;
  /** Lo que le hizo la mercancía del Man del Sombrero (TripKind; "" = nada) y hasta cuándo (hora del servidor). */
  trip: string;
  tripUntil: number;
  /** Id de la llamada (los que hablan en la misma se oyen entre todos) y el anuncio por voz del admin (ver comunicacion.ts). */
  callId?: string;
  broadcastUntil?: number;
}
/** El Man del Sombrero como viaja en el estado (espejo de `SombreroState` en apps/server/src/state.ts). */
export interface RemoteSombrero {
  present: boolean;
  hideout: number;
  area: string;
  x: number;
  y: number;
  facing: string;
}
export interface RemoteOfficeItem {
  id: string;
  type: string;
  x: number;
  y: number;
  facing: string;
}
export interface RemoteOffice {
  zoneId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  locked: boolean;
  note: string;
  notes: number;
  radioVideo: string;
  radioTitle: string;
  radioStartedAt: number;
  radioPaused: boolean;
  radioPausedAt: number;
  radioDurationMs: number;
  guests: string[];
  /** Fase 3c: decoración (ver OfficeView en store.ts). */
  customized: boolean;
  items: RemoteOfficeItem[];
  floor: string;
  wallpaper: string;
}
export interface RemoteRoulette {
  phase: "betting" | "spinning" | "result";
  round: number;
  endsAt: number;
  result: number;
  history: number[];
  bets: RouletteBetView[];
}
export interface RemoteBlackjackSeat {
  userId: string;
  name: string;
  bet: number;
  cards: number[];
  status: string;
  doubled: boolean;
  outcome: string;
  payout: number;
}
export interface RemoteBlackjack {
  phase: "waiting" | "betting" | "playing" | "dealer" | "result";
  round: number;
  endsAt: number;
  turn: number;
  dealer: number[];
  seats: RemoteBlackjackSeat[];
}
export interface OfficeStateView {
  players: Map<string, RemotePlayer>;
  offices: Map<string, RemoteOffice>;
  roulette: RemoteRoulette;
  blackjack: RemoteBlackjack;
  /** Muebles prendidos o apagados (tele, lámparas, tocadiscos), por `furnitureKey`. */
  switches: Map<string, boolean>;
  /** Cambios del editor de la casa por nivel (JSON de WorldEdits). */
  worldEdits: Map<string, string>;
  /** Clima de afuera (Weather de @hyvento/shared). */
  weather: string;
  /** Reloj del juego (GameClockState de @hyvento/shared). */
  clockAnchorReal: number;
  clockAnchorMinute: number;
  clockPaused: boolean;
  /** El festival de hoy y su fase (ver rooms/festivales.ts del servidor). */
  festival: string;
  festivalFase: string;
  /** La Noche de velitas: las prendidas (por "x,y"), cuántas van y los deseos soltados (rooms/velitas.ts). */
  velitas: { placed: Map<string, { x: number; y: number; by: string }>; lit: number; wishes: Map<string, { name: string; text: string }> };
  /** Casa viva: contadores (ajedrez, puzle, pizarras), cubículos ocupados (clave → userId) y mascotas. */
  counters: Map<string, number>;
  stalls: Map<string, string>;
  pets: Map<string, RemotePet>;
  /** Eventos del calendario: quién cumple hoy (userId → nombre) y el karaoke de los viernes. */
  events?: RemoteEvents;
  /** Jardín vivo: las parcelas sembradas del huerto, por índice (PlotState de @hyvento/shared). */
  garden: Map<string, RemoteGardenPlot>;
  /** La granja del jardín: los animales, lo que está en el fuego y los huevos del nido. */
  granja: RemoteGranja;
  /** El Man del Sombrero: si anda por ahí y en qué escondite. */
  sombrero: RemoteSombrero;
  /** El Megabús de la parada del jardín (BusState en apps/server/src/state.ts). */
  bus: { phase: string; since: number; nextAt: number; run: number };
  casas: Map<
    string,
    {
      ownerId: string;
      ownerName: string;
      modo: string;
      guests: string[];
      fiesta: boolean;
      radioVideo: string;
      radioTitle: string;
      radioStartedAt: number;
      radioPaused: boolean;
      radioPausedAt: number;
      radioDurationMs: number;
    }
  >;
}

/** La granja como viaja en el estado (espejo de `GranjaState` en apps/server/src/state.ts). */
export interface RemoteGranja {
  animals: Map<string, RemoteFarmAnimal>;
  grill: Map<string, RemoteGrillJob>;
  eggs: number;
}
export interface RemoteFarmAnimal {
  id: string;
  kind: string;
  coat: string;
  name: string;
  x: number;
  y: number;
  dir: string;
  pose: string;
}
export interface RemoteGrillJob {
  name: string;
  recipe: string;
  station: string;
  progress: number;
  rate: number;
  at: number;
  cookMs: number;
}

/** Una parcela sembrada como viaja en el estado (espejo de `GardenPlotState` en apps/server/src/state.ts). */
export interface RemoteGardenPlot {
  crop: string;
  plantedBy: string;
  plantedByName: string;
  plantedAt: number;
  growthMs: number;
  growthAt: number;
  wateredUntil: number;
  /** La estación del juego del tramo ("" = sin estación). */
  season: string;
}

export interface RemoteEvents {
  day: number;
  birthdays: Map<string, string>;
  karaoke: boolean;
}

/** Casa viva: una mascota como viaja en el estado (espejo de `Pet` en apps/server/src/state.ts). */
export interface RemotePet {
  id: string;
  name: string;
  kind: string;
  coat: string;
  area: string;
  x: number;
  y: number;
  dir: string;
  pose: string;
  /** Dueño si la adoptaron ("" = de la casa) y su nombre. */
  ownerId: string;
  ownerName: string;
  /** Cariño (0 a PET_BOND.max). */
  love: number;
}

export type OfficeRoom = Room<OfficeStateView>;

const SERVER_URL = GAME_SERVER_URL;

let client: Client | null = null;
let room: OfficeRoom | null = null;
const correctionListeners = new Set<(c: MoveCorrection) => void>();
const roomListeners = new Set<(r: OfficeRoom) => void>();
const emoteListeners = new Set<(e: EmoteEvent) => void>();
const heldUsedListeners = new Set<(e: HeldUsedEvent) => void>();
const furnitureListeners = new Set<(e: FurnitureEvent) => void>();
const petListeners = new Set<(e: PetEvent) => void>();

// Al cerrar/recargar la pestaña, salir "con consentimiento" para que el avatar desaparezca
// al instante en vez de quedar esperando una reconexión.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    const current = room;
    room = null;
    void current?.leave(true).catch(() => undefined);
  });
  // Si el navegador la restaura desde el bfcache (botón atrás), la conexión ya se cerró: recargar.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.location.reload();
  });
}

export function getRoom() {
  return room;
}

/** Notifica cada vez que hay una sala activa (conexión inicial y reconexiones). */
export function onRoom(cb: (r: OfficeRoom) => void) {
  roomListeners.add(cb);
  if (room) cb(room);
  return () => roomListeners.delete(cb);
}

export function onMoveCorrection(cb: (c: MoveCorrection) => void) {
  correctionListeners.add(cb);
  return () => correctionListeners.delete(cb);
}

/** Emotes de quienes están en tu nivel (también los tuyos, cuando el servidor los acepta). */
export function onEmote(cb: (e: EmoteEvent) => void) {
  emoteListeners.add(cb);
  return () => emoteListeners.delete(cb);
}

export function sendEmote(emote: EmoteId) {
  room?.send(MSG.emote, { emote });
}

/** Alguien de tu nivel usó lo que tenía en la mano (también tú, cuando el servidor lo acepta). */
export function onHeldUsed(cb: (e: HeldUsedEvent) => void) {
  heldUsedListeners.add(cb);
  return () => heldUsedListeners.delete(cb);
}

const blackoutListeners = new Set<(e: DrunkBlackoutEvent) => void>();
/** Alguien de mi nivel se pasó de tragos (vomita y se desmaya). */
export function onDrunkBlackout(cb: (e: DrunkBlackoutEvent) => void) {
  blackoutListeners.add(cb);
  return () => blackoutListeners.delete(cb);
}

const toastListeners = new Set<(e: ToastEvent) => void>();
/** Brindis en mi nivel: invitaciones, quién se suma, el choque de vasos y los que brindan solos. */
export function onToastEvent(cb: (e: ToastEvent) => void) {
  toastListeners.add(cb);
  return () => toastListeners.delete(cb);
}

/** Brindar (B): el servidor valida la bebida, que haya alguien cerca y la pausa. */
export function sendToast() {
  room?.send(MSG.toast);
}

const swivelListeners = new Set<(e: SwivelEvent) => void>();
/** Alguien de mi nivel gira en la silla de su escritorio. */
export function onSwivelEvent(cb: (e: SwivelEvent) => void) {
  swivelListeners.add(cb);
  return () => swivelListeners.delete(cb);
}

/** Girar en la silla (R): el servidor valida que esté sentado en una que gira y la pausa. */
export function sendSwivel() {
  room?.send(MSG.swivel);
}

/** Lo que llega de la pizarra abierta: la pizarra entera, un trazo nuevo o trazos que se van. */
export type BoardEvent = ({ kind: "state" } & BoardStateEvent) | ({ kind: "stroke" } & BoardStrokeEvent) | ({ kind: "remove" } & BoardRemoveEvent);
const boardListeners = new Set<(e: BoardEvent) => void>();
export function onBoardEvent(cb: (e: BoardEvent) => void) {
  boardListeners.add(cb);
  return () => boardListeners.delete(cb);
}

/** Abrir o cerrar la pizarra de la sala, deshacer mi último trazo o borrarla entera. */
export function sendBoard(action: "open" | "close" | "undo" | "clear", board: string) {
  const type = { open: MSG.boardOpen, close: MSG.boardClose, undo: MSG.boardUndo, clear: MSG.boardClear }[action];
  room?.send(type, { board });
}

export function sendBoardStroke(board: string, stroke: BoardStrokeInput) {
  room?.send(MSG.boardStroke, { board, stroke });
}

const achievementListeners = new Set<(e: AchievementUnlockedEvent) => void>();
/** Alguien de mi nivel (o yo) desbloqueó un logro: la escena hace un destello sobre su avatar. */
export function onAchievementUnlocked(cb: (e: AchievementUnlockedEvent) => void) {
  achievementListeners.add(cb);
  return () => achievementListeners.delete(cb);
}

/** El propio logro se anuncia grande; el de otra persona del nivel, con un aviso chiquito. */
function handleAchievement(e: AchievementUnlockedEvent) {
  achievementListeners.forEach((cb) => cb(e));
  const ach = achievementById(e.achievementId);
  if (!ach) return;
  if (e.sessionId === room?.sessionId) {
    useAchievementStore.getState().pushToast(ach.id);
    sfx.achievement(ach.rarity === "epico" || ach.rarity === "legendario");
  }
  // De los demás solo se avisan los épicos y legendarios: con tantos logros, los comunes llenarían la pantalla.
  else if (ach.rarity === "epico" || ach.rarity === "legendario") useOfficeStore.getState().notify(`${e.name} desbloqueó «${ach.name}».`, "success");
}

/** Alguien de tu nivel tocó un instrumento o acarició al gato. */
export function onFurnitureEvent(cb: (e: FurnitureEvent) => void) {
  furnitureListeners.add(cb);
  return () => furnitureListeners.delete(cb);
}

const photoCountdownListeners = new Set<(e: PhotoCountdownEvent) => void>();
const photoFlashListeners = new Set<(e: PhotoFlashEvent) => void>();
const photoShotListeners = new Set<(e: PhotoShot) => void>();
const photosChangedListeners = new Set<() => void>();
/** Alguien de mi nivel va a sacar una foto (3-2-1 sobre su cabeza). */
export function onPhotoCountdown(cb: (e: PhotoCountdownEvent) => void) {
  photoCountdownListeners.add(cb);
  return () => photoCountdownListeners.delete(cb);
}
/** El flash de la cámara de alguien de mi nivel (también la mía). */
export function onPhotoFlash(cb: (e: PhotoFlashEvent) => void) {
  photoFlashListeners.add(cb);
  return () => photoFlashListeners.delete(cb);
}
/** Mi foto: el servidor disparó y manda el ticket para subirla. */
export function onPhotoShot(cb: (e: PhotoShot) => void) {
  photoShotListeners.add(cb);
  return () => photoShotListeners.delete(cb);
}
/** Alguien subió o borró una foto: el tablón se vuelve a pedir. */
export function onPhotosChanged(cb: () => void) {
  photosChangedListeners.add(cb);
  return () => photosChangedListeners.delete(cb);
}
/** Sacar una foto: el servidor cuenta 3-2-1 (y aplica la pausa entre fotos). */
export function sendPhotoTake() {
  room?.send(MSG.photoTake);
}

/** Usar lo que tengo en la mano (F): el servidor valida que tenga algo y la pausa entre usos. */
export function sendUseHeld() {
  room?.send(MSG.useHeld);
}

/** Usar un mueble de mi nivel (tele, lámpara, piano…): el servidor valida que esté al alcance. */
export function sendFurnitureUse(type: string, x: number, y: number) {
  room?.send(MSG.furnitureUse, { type, x, y });
}

/** Sacar la regadera o semillas del cobertizo: el servidor valida que estés junto a su puerta. */
export function sendShedTake(item: string) {
  room?.send(HUERTO_MSG.shedTake, { item });
}

/** Casa viva: alguien de tu nivel llamó, acarició o le dio un premio a una mascota. */
export function onPetEvent(cb: (e: PetEvent) => void) {
  petListeners.add(cb);
  return () => petListeners.delete(cb);
}

/** Llamar a una mascota (clic): el servidor valida que esté en tu nivel y no muy lejos. */
export function sendPetCall(pet: string) {
  room?.send(PET_MSG.call, { pet });
}

/** Acariciar, darle croquetas o la comida de la mano, adoptarla o soltarla (de cerca). */
export function sendPetAction(pet: string, action: PetAction) {
  room?.send(PET_MSG.action, { pet, action });
}

/** Apostar en la ruleta (el servidor valida que estés junto a la mesa y cobra). */
export function sendRouletteBet(bet: RouletteBetSpec, amount: number) {
  room?.send(MSG.rouletteBet, { bet, amount });
}

/** Blackjack: apostar en tu asiento o jugar tu turno. */
export function sendBlackjackBet(amount: number) {
  room?.send(MSG.blackjackBet, { amount });
}
export function sendBlackjackAction(action: BlackjackAction) {
  room?.send(MSG.blackjackAction, { action });
}

/**
 * Objetos que no abren un panel sino que hacen algo con E (la fogata de malvaviscos): los registra su
 * módulo, así network.ts no lo importa (evita importaciones circulares).
 */
const interactActions = new Map<Interactable, () => void>();
export function onInteract(kind: Interactable, fn: () => void) {
  interactActions.set(kind, fn);
}

/** Quienes se enteran de cada E, además de lo que hace el objeto (los encargos de ese personaje). */
const interactListeners = new Set<(kind: Interactable) => void>();
export function onAnyInteract(fn: (kind: Interactable) => void) {
  interactListeners.add(fn);
  return () => interactListeners.delete(fn);
}

/** Usar un objeto interactivo: casi todos abren su panel (el Man del Sombrero, su menú); el tubo del sótano hace bailar. */
/** E en la estación: subirse al Megabús (el servidor valida que esté parado con las puertas abiertas). */
export function sendBusBoard() {
  // Con casas ajenas abiertas (o que me dejaron pasar), primero se elige a cuál se va.
  if (casasAbiertasPara(selectMyUserId(useOfficeStore.getState())).length) return useCasasStore.getState().setChoosing(true);
  room?.send(BUS_MSG.board, {});
}

export function activateInteractable(kind: Interactable) {
  for (const fn of interactListeners) fn(kind);
  if (kind === "pole") return togglePole();
  if (kind === "bus") return sendBusBoard();
  if (kind === "homeBus") return void room?.send(BUS_MSG.call, {});
  // La escalerita: sube a la tarima o, si ya estoy arriba, baja (lo valida el servidor).
  if (kind === "stage") return void room?.send(ESCENARIO_MSG.stage, { on: useOfficeStore.getState().zone?.id !== ESCENARIO.stageZone });
  if (kind === "podcast") return podcastAction();
  if (kind === "fishing") return fishingSpotAction();
  // La piscina no abre panel: se mete, salta o sale (el servidor valida y avisa si no).
  if (kind === "pool") return sendAgua("swim");
  if (kind === "dive") return sendAgua("dive");
  if (kind === "swimOut") return sendAgua("out");
  const action = interactActions.get(kind);
  if (action) return action();
  useOfficeStore.getState().openPanel(kind, true);
}

/** La consola del estudio: pedir permiso para grabar (con el audio conectado) o, si ya se graba, detener. */
function podcastAction() {
  if (useEscenarioStore.getState().podcast.phase !== "idle") return void room?.send(PODCAST_MSG.stop);
  if (!media.connected) return useOfficeStore.getState().notify("Para grabar hay que tener el audio conectado.", "warning");
  room?.send(PODCAST_MSG.start);
}

export class ConnectionCancelled extends Error {}

/** Cada connect/disconnect invalida las conexiones anteriores que sigan en vuelo. */
let generation = 0;

export async function connect(options: JoinOptions): Promise<OfficeRoom> {
  const gen = ++generation;
  const store = useOfficeStore.getState();
  store.setConnection("connecting");
  client ??= new Client(SERVER_URL);
  let joined: OfficeRoom;
  try {
    joined = await client.joinOrCreate<OfficeStateView>(ROOM_NAME, options);
  } catch (err) {
    if (gen === generation) store.setConnection("error", describeError(err));
    throw err;
  }
  if (gen !== generation) {
    // Se desmontó (o se reconectó) mientras entrábamos: esta sesión sobra.
    void joined.leave(true).catch(() => undefined);
    throw new ConnectionCancelled();
  }
  attach(joined);
  return joined;
}

export async function disconnect() {
  generation++;
  const current = room;
  room = null;
  // Reset síncrono: si se reconecta enseguida (StrictMode), no debe borrar la sesión nueva.
  useOfficeStore.getState().reset();
  resetPhone();
  resetComunicacion();
  await current?.leave(true).catch(() => undefined);
}

/** Número del último paso enviado: el servidor lo devuelve al rechazarlo (ver `correctionIsStale`). */
let moveSeq = 0;

export function sendMove(m: MoveMessage) {
  if (!room) return;
  moveSeq += 1;
  room.send(MSG.move, { ...m, seq: moveSeq });
}

/** El `seq` del último paso enviado (0 si todavía ninguno). */
export function lastMoveSeq() {
  return moveSeq;
}

/** Avisa a la sala que la web guardó el perfil: el servidor lo relee y todos ven el cambio. */
export function sendProfileChanged() {
  room?.send(MSG.profileChanged);
}

/** Pide pasar a otro nivel por un portal (el servidor responde con una corrección con `area`). */
export function sendTravel(portal: string) {
  room?.send(MSG.travel, { portal });
}

/** Pide algo en la barra de la cafetería (el servidor valida que estés junto a ella y cobra). */
export function sendCafeOrder(item: CafeItemId) {
  room?.send(MSG.cafeOrder, { item });
}

/** Pide algo en la barra del club (igual que la cafetería, junto a la barra del sótano). */
export function sendBarOrder(item: BarItemId) {
  room?.send(MSG.barOrder, { item });
}

/** Pide algo en la confitería del cine (junto a la máquina de crispetas). */
export function sendCinemaOrder(item: CinemaMenuItemId) {
  room?.send(MSG.cinemaOrder, { item });
}

/** Comprarle al Man del Sombrero (el servidor valida que esté, que estés junto a él y el saldo). */
export function sendSombreroBuy(item: SombreroItemId) {
  room?.send(MSG.sombreroBuy, { item });
}

function handleSombreroResult(r: SombreroBuyResult) {
  useSombreroStore.getState().setResult(r);
  const store = useOfficeStore.getState();
  if (!r.ok) return store.notify(SOMBRERO_ERROR_TEXT[r.error], "warning");
  const name = sombreroItem(r.item)?.name ?? "la mercancía";
  const thanks = SOMBRERO_THANKS[Math.floor(Math.random() * SOMBRERO_THANKS.length)]!;
  useSombreroStore.getState().speak(thanks);
  store.notify(`${name} en la mano. Con F la usas.`, "success");
}

const CAFE_ERRORS: Record<Extract<CafeOrderResult, { ok: false }>["error"], string> = {
  far: "Acércate a la barra para pedir.",
  funds: "No te alcanzan los puntos.",
  busy: "Un momento, ya viene tu pedido.",
  failed: "No se pudo hacer el pedido. Intenta de nuevo.",
  full: "No te cabe en la mochila: haz espacio (tira algo o pon un mueble en tu oficina).",
};

function handleCafeResult(r: CafeOrderResult) {
  const store = useOfficeStore.getState();
  const item = menuItem(r.item);
  const name = item?.name ?? "tu pedido";
  if (r.ok) {
    store.closePanel();
    const cheers = item?.menu === "bar" ? "¡Salud!" : item?.menu === "cine" ? "¡Buena función!" : "¡Buen provecho!";
    store.notify(`Aquí tienes: ${name} (quedó en tu mochila). ${cheers}`, "success");
  } else {
    store.notify(CAFE_ERRORS[r.error], "warning");
  }
}

/** Editor de oficina: poner, mover, quitar o cambiar piso/papel tapiz (lo valida el servidor). */
export function sendOfficeEdit(edit: OfficeEditMessage) {
  room?.send(MSG.officeEdit, edit);
}

/** Por qué no se pudo, en palabras (los mismos motivos que muestra el fantasma rojo). */
export const DECOR_ERRORS: Record<OfficeEditError, string> = {
  "not-owner": "Solo puedes decorar tu propia oficina.",
  "not-owned": "Ese mueble ya no está en tu mochila.",
  outside: "Tiene que quedar dentro de tu oficina.",
  blocked: "Ahí choca con otro mueble.",
  door: "Así taparías la puerta o el paso hasta tu escritorio.",
  occupied: "Hay alguien ahí.",
  fixed: "El escritorio con el PC, su teléfono y su silla no se mueven.",
  unknown: "Ese mueble no existe.",
  failed: "No se pudo guardar. Intenta de nuevo.",
};

function handleOfficeEditResult(r: OfficeEditResult) {
  const store = useOfficeStore.getState();
  store.setDecorResult(r);
  if (!r.ok) store.notify(DECOR_ERRORS[r.error], "warning");
}

/** Editor de la casa (solo admins): un cambio en un nivel. */
export function sendWorldEdit(edit: WorldEditMessage) {
  room?.send(MSG.worldEdit, edit);
}

const WORLD_EDIT_TEXT: Record<string, string> = {
  ...WORLD_EDIT_ERRORS,
  admin: "Necesitas el permiso para editar la casa (se lo pides a un admin).",
  busy: "Otra persona está editando la casa.",
  failed: "No se pudo guardar. Intenta de nuevo.",
};

/** Entrar o salir del editor de la casa (el servidor da el candado a una persona a la vez). */
export function sendWorldEditLock(on: boolean) {
  room?.send(MSG.worldEditLock, { on });
}

function handleWorldEditLockResult(r: WorldEditLockResult) {
  if (r.ok) return;
  const s = useOfficeStore.getState();
  s.setWorldEditing(false);
  s.notify(r.error === "busy" ? `${r.by} está editando la casa: una persona a la vez.` : "Necesitas el permiso para editar la casa (se lo pides a un admin).", "warning");
}

function handleWorldEditResult(r: WorldEditResult) {
  if (!r.ok) useOfficeStore.getState().notify(WORLD_EDIT_TEXT[r.error] ?? WORLD_EDIT_TEXT.failed!, "warning");
}

/** Llegaron cambios del editor de la casa para un nivel: se aplican al mundo y se avisa a la escena. */
function applyWorldEditsJson(area: string, json: string) {
  try {
    setWorldEdits(area, parseWorldEdits(JSON.parse(json)));
  } catch (err) {
    console.error("Cambios de la casa inválidos", err);
    return;
  }
  worldEditListeners.forEach((cb) => cb(area));
}

const worldEditListeners = new Set<(area: string) => void>();
/** La escena rearma el nivel cuando cambia (ver OfficeScene). */
export function onWorldEdits(cb: (area: string) => void) {
  worldEditListeners.add(cb);
  return () => worldEditListeners.delete(cb);
}

/** Hubo actividad real (mouse/teclado): cuenta para los puntos de presencia. */
export function sendActivity() {
  room?.send(MSG.activity);
}

/** Último aviso de inactividad: se repite al reconectar (la sesión nueva empieza activa). */
let idleNow = false;
/** El navegador lleva rato sin uso (o volvió): el servidor pone o quita el "Ausente" automático. */
export function sendIdle(idle: boolean) {
  idleNow = idle;
  room?.send(MSG.idle, { idle });
}

/** Sin sala (el laboratorio del celular, /laboratorio/celular): lo que se escribe en Mensajes va aquí. */
let offlineChat: ((text: string, scope: ChatScope) => void) | null = null;
export const setOfflineChat = (fn: typeof offlineChat) => void (offlineChat = fn);

export function sendChat(text: string, scope: ChatScope) {
  if (room) room.send(MSG.chatSend, { text, scope });
  else offlineChat?.(text, scope);
}

export function sendStatus(status: PresenceStatus) {
  room?.send(MSG.status, { status });
}

/** Felicitar a quien cumple hoy (el servidor valida que sea hoy y que no lo hayas felicitado ya). */
export function sendCongrats(userId: string) {
  room?.send(MSG.congrats, { userId });
}

/** Empezar un bloque de enfoque (el servidor lleva el reloj) o dejarlo / saltar el descanso. */
export function sendFocusStart(preset: FocusPresetId) {
  room?.send(MSG.focusStart, { preset });
}
export function sendFocusStop() {
  room?.send(MSG.focusStop);
}

const congratsListeners = new Set<(e: CongratsEvent) => void>();
/** Alguien felicitó a quien cumple (la escena tira confeti sobre su avatar). */
export function onCongrats(cb: (e: CongratsEvent) => void) {
  congratsListeners.add(cb);
  return () => congratsListeners.delete(cb);
}

const focusListeners = new Set<(e: FocusEvent) => void>();
/** Cómo va mi pomodoro (lo avisa el servidor: completo, descanso terminado o cancelado). */
export function onFocusEvent(cb: (e: FocusEvent) => void) {
  focusListeners.add(cb);
  return () => focusListeners.delete(cb);
}

function handleCongratsResult(r: CongratsResult) {
  const store = useOfficeStore.getState();
  if (r.ok) store.notify(`Le deseaste feliz cumpleaños a ${r.toName || "quien cumple"}.`, "success");
  else store.notify(CONGRATS_ERROR_TEXT[r.error], "info");
}

function handleCongratsEvent(e: CongratsEvent) {
  const store = useOfficeStore.getState();
  const mine = selectMyUserId(store) === e.toUserId;
  if (mine) {
    store.notify(`¡${e.fromName} te deseó feliz cumpleaños!${e.points > 0 ? ` +${e.points}` : ""}`, "success");
    store.throwConfetti();
  }
  congratsListeners.forEach((cb) => cb(e));
}

function handleFocusEvent(e: FocusEvent) {
  const store = useOfficeStore.getState();
  if (e.kind === "done")
    store.notify(
      e.points > 0 ? `¡Bloque de enfoque completo! +${e.points}. Tómate un descanso.` : e.capped ? "Bloque completo. Ya sumaste los pomodoros con puntos de hoy." : "Bloque completo. Tómate un descanso.",
      "success",
    );
  else if (e.kind === "break-over") store.notify("Se acabó el descanso: cuando quieras, empieza otro bloque.", "info");
  else store.notify(FOCUS_CANCEL_TEXT[e.reason], e.reason === "left" ? "warning" : "info");
  focusListeners.forEach((cb) => cb(e));
}

/** La radio de mi oficina (poner un link, pausar, seguir, apagar) o la duración que dio el reproductor. */
export function sendOfficeRadio(msg: OfficeRadioMessage) {
  room?.send(MSG.officeRadio, msg);
}

/** La nota de la placa de mi oficina ("" la borra). */
export function sendOfficeNote(note: string) {
  room?.send(MSG.officeNote, { note });
}

export function sendOfficeLock(locked: boolean) {
  room?.send(MSG.officeLock, { locked });
}

/** Dejar una nota en la puerta de una oficina (el servidor valida la puerta y el tope del día). */
export function sendDoorNote(zoneId: string, text: string) {
  useDoorNotesStore.getState().setSending(true);
  room?.send(MSG.doorNote, { zoneId, text });
}

export function sendKnock(zoneId: string) {
  useOfficeStore.getState().setPendingKnock(zoneId);
  room?.send(MSG.knock, { zoneId });
}

export function respondKnock(requestId: string, accept: boolean) {
  useOfficeStore.getState().removeKnockRequest(requestId);
  room?.send(MSG.knockRespond, { requestId, accept });
}

/** Invitar a alguien a donde estoy (el servidor valida que esté conectado y el ritmo). */
export function sendInvite(toUserId: string) {
  room?.send(MSG.invite, { toUserId });
}

/** Responder una invitación: "Ir" camina hasta quien invitó, esté donde esté. */
export function respondInvite(inv: Pick<Invitation, "inviteId" | "fromSessionId"> & Partial<Pick<Invitation, "place">>, accept: boolean) {
  const store = useOfficeStore.getState();
  store.removeInvitation(inv.inviteId);
  room?.send(MSG.inviteRespond, { inviteId: inv.inviteId, accept });
  // A una casa no se camina: el servidor lo lleva hasta allá.
  if (inv.place === "casa") return;
  // Un respiro para que llegue el parche que me deja pasar a su oficina cerrada (si no, la ruta para en la puerta).
  if (accept) setTimeout(() => useOfficeStore.getState().walkToPlayer(inv.fromSessionId), 300);
}

/** El aviso de "tope de ocio lleno" ya salió (se rearma cuando el conteo baja: día nuevo). */
let leisureFullShown = false;

function attach(r: OfficeRoom) {
  room = r;
  if (idleNow) r.send(MSG.idle, { idle: true });
  const store = useOfficeStore.getState();
  store.setSessionId(r.sessionId);
  store.setConnection("connected");

  const $ = getStateCallbacks(r);
  bindCasaArbol(r);
  bindCasas(r);
  bindPesca(r);
  $(r.state).players.onAdd((player, sessionId) => {
    const sync = () =>
      useOfficeStore.getState().upsertPlayer({
        sessionId,
        userId: player.userId,
        name: player.name,
        avatar: player.avatar,
        area: player.area,
        zoneId: player.zoneId,
        place: player.place,
        status: player.status,
        points: player.points,
        held: player.held,
        heldLeft: player.heldLeft,
        focus: (player.focus ?? "") as FocusPhase,
        focusEndsAt: player.focusEndsAt ?? 0,
        focusPreset: (player.focusPreset ?? "") as FocusPresetId | "",
        call: player.call ?? "",
        callWith: player.callWith ?? "",
      });
    sync();
    $(player).listen("focus", sync);
    $(player).listen("focusEndsAt", sync);
    $(player).listen("call", sync);
    $(player).listen("callWith", sync);
    $(player).listen("held", sync);
    $(player).listen("heldLeft", sync);
    $(player).listen("area", sync);
    $(player).listen("zoneId", sync);
    $(player).listen("place", sync);
    $(player).listen("status", sync);
    $(player).listen("name", sync);
    $(player).listen("points", sync);
  });
  $(r.state).players.onRemove((_player, sessionId) => useOfficeStore.getState().removePlayer(sessionId));

  $(r.state).offices.onAdd((office, zoneId) => {
    const push = () =>
      useOfficeStore.getState().upsertOffice({
        zoneId,
        name: office.name,
        ownerId: office.ownerId,
        ownerName: office.ownerName,
        locked: office.locked,
        note: office.note ?? "",
        notes: office.notes ?? 0,
        radio: office.radioVideo
          ? {
              videoId: office.radioVideo,
              title: office.radioTitle,
              startedAt: office.radioStartedAt,
              paused: office.radioPaused,
              pausedAt: office.radioPausedAt,
              durationMs: office.radioDurationMs,
            }
          : null,
        guests: [...office.guests],
        customized: office.customized,
        items: [...office.items].map((i) => ({
          id: i.id,
          type: i.type,
          x: i.x,
          y: i.y,
          facing: (DIRECTIONS as readonly string[]).includes(i.facing) ? (i.facing as Direction) : "right",
        })),
        floor: office.floor,
        wallpaper: office.wallpaper,
      });
    // Un patch dispara un callback por cada cambio (la primera edición agrega ~10 muebles y marca
    // `customized`): se juntan y el store recibe la oficina una sola vez, ya completa.
    let queued = false;
    const sync = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (room === r && r.state.offices.get(zoneId) === office) push();
      });
    };
    push();
    const o$ = $(office);
    o$.onChange(sync);
    o$.guests.onAdd(sync);
    o$.guests.onRemove(sync);
    // Muebles: al ponerlos, quitarlos y moverlos (x, y, facing cambian en el mismo objeto).
    o$.items.onAdd((item) => {
      sync();
      $(item).onChange(sync);
    });
    o$.items.onRemove(sync);
  });
  $(r.state).offices.onRemove((_office, zoneId) => useOfficeStore.getState().removeOffice(zoneId));
  $(r.state).worldEdits.onAdd((json, area) => applyWorldEditsJson(area, json));
  $(r.state).worldEdits.onChange((json, area) => applyWorldEditsJson(area, json));
  $(r.state).listen("weather", (w) => useOfficeStore.getState().setWeather(isWeather(w) ? w : "despejado"));
  // El Man del Sombrero: una copia para la escena y el panel (llega con el primer estado).
  $(r.state).listen("sombrero", (man) => {
    if (!man) return;
    const sync = () =>
      useSombreroStore.getState().setMan({ present: man.present, hideout: man.hideout, area: man.area, x: man.x, y: man.y, facing: man.facing });
    $(man).onChange(sync);
    sync();
  });
  // Las partes del ancla cambian juntas (/time, la pausa): se lee el reloj entero en cada aviso.
  const syncClock = () =>
    useOfficeStore.getState().setGameClock({ anchorReal: r.state.clockAnchorReal, anchorMinute: r.state.clockAnchorMinute, ...(r.state.clockPaused && { paused: true }) });
  $(r.state).listen("clockAnchorReal", syncClock);
  $(r.state).listen("clockAnchorMinute", syncClock);
  $(r.state).listen("clockPaused", syncClock);
  const syncFestival = () => useOfficeStore.setState({ festival: { id: r.state.festival ?? "", fase: r.state.festivalFase ?? "" } });
  $(r.state).listen("festival", syncFestival);
  $(r.state).listen("festivalFase", syncFestival);
  // Eventos del calendario: la lista de cumpleaños de hoy y el karaoke (llega con el primer estado).
  $(r.state).listen("events", (events) => {
    if (!events) return;
    const push = () => {
      const current = r.state.events;
      if (!current) return;
      const prev = useOfficeStore.getState();
      const birthdays = Object.fromEntries(current.birthdays.entries());
      const first = Object.keys(prev.birthdays).length === 0 && Object.keys(birthdays).length > 0;
      prev.setEvents({ birthdays, karaoke: current.karaoke });
      // Al entrar (o cuando empieza el día) con alguien de cumpleaños: confeti.
      if (first) prev.throwConfetti();
    };
    const e$ = $(events);
    e$.listen("karaoke", push);
    e$.birthdays.onAdd(push);
    e$.birthdays.onRemove(push);
    push();
  });

  // Ruleta del sótano: una copia simple para React (fase, cuenta regresiva, apuestas y números).
  const syncRoulette = () => {
    const rl = r.state.roulette;
    if (!rl) return;
    useCasinoStore.getState().setRoulette({
      phase: rl.phase,
      round: rl.round,
      endsAt: rl.endsAt,
      result: rl.result,
      history: [...rl.history],
      bets: [...rl.bets].map((b) => ({ userId: b.userId, name: b.name, kind: b.kind, param: b.param, amount: b.amount })),
    });
  };
  // La mesa llega con el primer estado: los callbacks se enganchan cuando aparece (antes no tiene refId).
  $(r.state).listen("roulette", (table) => {
    if (!table) return;
    const rl$ = $(table);
    rl$.onChange(syncRoulette);
    rl$.bets.onAdd(syncRoulette);
    rl$.bets.onRemove(syncRoulette);
    rl$.history.onAdd(syncRoulette);
    rl$.history.onRemove(syncRoulette);
    syncRoulette();
  });
  // Blackjack: igual que la ruleta, más las cartas de cada asiento y del crupier.
  const syncBlackjack = () => {
    const bj = r.state.blackjack;
    if (!bj) return;
    useCasinoStore.getState().setBlackjack({
      phase: bj.phase,
      round: bj.round,
      endsAt: bj.endsAt,
      turn: bj.turn,
      dealer: [...bj.dealer],
      seats: [...bj.seats].map((s) => ({
        userId: s.userId,
        name: s.name,
        bet: s.bet,
        cards: [...s.cards],
        status: s.status,
        doubled: s.doubled,
        outcome: s.outcome,
        payout: s.payout,
      })),
    });
  };
  $(r.state).listen("blackjack", (table) => {
    if (!table) return;
    const bj$ = $(table);
    bj$.onChange(syncBlackjack);
    bj$.dealer.onAdd(syncBlackjack);
    bj$.dealer.onRemove(syncBlackjack);
    bj$.seats.onAdd((seat) => {
      const s$ = $(seat);
      s$.onChange(syncBlackjack);
      s$.cards.onAdd(syncBlackjack);
      s$.cards.onRemove(syncBlackjack);
      syncBlackjack();
    });
    syncBlackjack();
  });
  r.onMessage(MSG.blackjackSettled, (s: BlackjackSettled) => {
    useCasinoStore.getState().setBlackjackSettled(s);
    const text = { blackjack: `¡Blackjack! Ganaste ${s.won}.`, win: `Le ganaste al crupier: +${s.won - s.staked}.`, push: "Empate: te devuelven la apuesta.", lose: `Perdiste ${s.staked}.` }[s.outcome];
    useOfficeStore.getState().notify(text, s.outcome === "lose" ? "info" : "success");
  });
  r.onMessage(MSG.clock, (m: { now: number }) => useCasinoStore.getState().setOffset(m.now));
  bindPermisos(r);
  // El club (música, pista y tubo) y el arcade tienen su propio módulo de red.
  bindClub(r);
  bindCinema(r);
  bindPiscina(r);
  bindRace(r);
  bindCocina(r);
  bindGranja(r);
  bindArcade(r);
  bindPhone(r);
  bindComunicacion(r);
  // Avisos del navegador con Lumbre en segundo plano (teléfono, puerta, menciones, invitaciones…).
  bindNotify(r);
  bindHockey(r);
  // La mochila y la barra de abajo.
  bindBag(r);
  bindMesas(r);
  bindBoardGames(r);
  bindVelitas(r);
  r.onMessage(MSG.casinoResult, (res: CasinoResult) => {
    useCasinoStore.getState().setResult(res);
    if (!res.ok) useOfficeStore.getState().notify(CASINO_ERROR_TEXT[res.error], "warning");
  });
  r.onMessage(MSG.rouletteSettled, (s: RouletteSettled) => {
    useCasinoStore.getState().setSettled(s);
    const profit = s.won - s.staked;
    useOfficeStore
      .getState()
      .notify(
        s.won > 0 ? `Salió el ${s.result}: ganaste ${s.won} (${profit >= 0 ? "+" : ""}${profit}).` : `Salió el ${s.result}. Esta vez no hubo suerte.`,
        s.won > 0 ? "success" : "info",
      );
  });

  r.onMessage(MSG.chatHistory, (history: ChatEvent[]) => {
    useOfficeStore.getState().addMessages(history);
    // Lo que ya estaba escrito al entrar no cuenta como "sin leer" en el celular.
    useCelularStore.getState().markRead(history.reduce((t, m) => Math.max(t, m.ts), 0));
  });
  r.onMessage(MSG.chatEvent, (event: ChatEvent) => useOfficeStore.getState().addMessages([event]));
  r.onMessage(MSG.knockRequest, (req: KnockRequest) => useOfficeStore.getState().addKnockRequest(req));
  r.onMessage(MSG.knockResult, (res: KnockResult) => useOfficeStore.getState().handleKnockResult(res));
  r.onMessage(MSG.inviteRequest, (inv: Invitation) => useOfficeStore.getState().addInvitation(inv));
  r.onMessage(MSG.inviteResult, (res: InviteResult) => useOfficeStore.getState().handleInviteResult(res));
  r.onMessage(MSG.doorNoteResult, (res: DoorNoteResult) => useDoorNotesStore.getState().handleResult(res));
  r.onMessage(MSG.moveCorrection, (c: MoveCorrection) => correctionListeners.forEach((cb) => cb(c)));
  r.onMessage(MSG.pointsAwarded, (a: PointsAwarded) => useOfficeStore.getState().addAward(a));
  // Tope de ocio del día: el conteo va al celular y, al llenarse, un aviso igual para todas las actividades.
  // Una sola vez por día: las reposeras y la tina premian cada tick y con el tope lleno avisarían siempre.
  r.onMessage(LEISURE_MSG.state, (n: LeisureState) => {
    const s = useOfficeStore.getState();
    const before = s.leisure;
    s.setLeisure(n);
    if (n.today < n.cap) leisureFullShown = false;
    else if (!leisureFullShown && (n.capped || (before && before.today < n.cap))) {
      leisureFullShown = true;
      s.notify(LEISURE_FULL_TEXT, "info");
    }
  });
  r.onMessage(MSG.cafeResult, handleCafeResult);
  r.onMessage(MSG.sombreroResult, handleSombreroResult);
  r.onMessage(MSG.officeEditResult, handleOfficeEditResult);
  r.onMessage(MSG.worldEditResult, handleWorldEditResult);
  r.onMessage(MSG.worldEditLockResult, handleWorldEditLockResult);
  r.onMessage(MSG.emoteEvent, (e: EmoteEvent) => emoteListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.heldUsed, (e: HeldUsedEvent) => heldUsedListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.drunkBlackout, (e: DrunkBlackoutEvent) => blackoutListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.toastEvent, (e: ToastEvent) => toastListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.toastResult, (res: ToastResult) => useOfficeStore.getState().notify(TOAST_ERROR_TEXT[res.error], "info"));
  r.onMessage(MSG.swivelEvent, (e: SwivelEvent) => swivelListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.officeRadioResult, (res: OfficeRadioResult) => useOfficeStore.getState().notify(OFFICE_RADIO_ERROR_TEXT[res.error], "warning"));
  r.onMessage(MSG.boardState, (e: BoardStateEvent) => boardListeners.forEach((cb) => cb({ kind: "state", ...e })));
  r.onMessage(MSG.boardStrokeEvent, (e: BoardStrokeEvent) => boardListeners.forEach((cb) => cb({ kind: "stroke", ...e })));
  r.onMessage(MSG.boardRemove, (e: BoardRemoveEvent) => boardListeners.forEach((cb) => cb({ kind: "remove", ...e })));
  r.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => furnitureListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.fishEvent, handleFishEvent);
  r.onMessage(PET_MSG.event, (e: PetEvent) => petListeners.forEach((cb) => cb(e)));
  // Rechazos genéricos (chat con límite, mueble lejos o en pausa, silla ocupada): aviso y "tuc".
  r.onMessage(RECHAZO_MSG.notice, (n: RechazoNotice) => {
    const text = RECHAZO_TEXT[n.code];
    if (!text) return;
    sfx.deny();
    useOfficeStore.getState().notify(text, "warning");
  });
  // Casa viva: por qué no se pudo (las manos llenas, el baño ocupado, la mascota ya comió…).
  r.onMessage(CASA_MSG.notice, (n: CasaNotice) => {
    const text = CASA_NOTICES[n.code];
    if (text) useOfficeStore.getState().notify(text, "info");
  });
  r.onMessage(PET_MSG.notice, (n: PetNotice) => {
    const text = PET_NOTICES[n.code]?.(n.pet);
    if (text) useOfficeStore.getState().notify(text, "info");
  });
  // Jardín vivo: por qué no se pudo sembrar, regar, cosechar o sacar miel.
  r.onMessage(HUERTO_MSG.notice, (n: HuertoNotice) => useOfficeStore.getState().notify(huertoNoticeText(n), "info"));
  // Megabús: por qué no se pudo subir o bajar.
  r.onMessage(BUS_MSG.notice, (n: BusNotice) => {
    const text = BUS_NOTICES[n.code];
    if (text) useOfficeStore.getState().notify(text, "info");
  });
  // Quiso entrar a la casa de otra persona (todavía no hay visitas).
  r.onMessage(CASA_PROPIA_MSG.notice, (n: CasaPropiaNotice) => useOfficeStore.getState().notify(casaPropiaNoticeText(n), "warning"));
  r.onMessage(MSG.photoCountdown, (e: PhotoCountdownEvent) => photoCountdownListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.photoFlash, (e: PhotoFlashEvent) => photoFlashListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.photoShot, (e: PhotoShot) => photoShotListeners.forEach((cb) => cb(e)));
  r.onMessage(MSG.photosChanged, () => photosChangedListeners.forEach((cb) => cb()));
  r.onMessage(MSG.achievementUnlocked, handleAchievement);
  r.onMessage(MSG.congratsResult, handleCongratsResult);
  r.onMessage(MSG.congratsEvent, handleCongratsEvent);
  r.onMessage(MSG.focusEvent, handleFocusEvent);

  // El servidor se va a reiniciar (deploy): el cierre que sigue no es una caída cualquiera.
  let restarting = false;
  r.onMessage(RESTART_MSG, () => {
    restarting = true;
  });
  r.onLeave((code) => {
    // Voluntario es solo nuestro disconnect() (o cerrar la pestaña): sueltan la sala antes de cerrarla.
    // Un 1000/4000 con la sala todavía puesta es el servidor que se apagó (cada deploy): se reintenta.
    if (room !== r) return;
    const action = leaveAction(code);
    if (action === "replaced") {
      // No reintentar: provocaría que las dos pestañas se expulsen mutuamente.
      room = null;
      useOfficeStore.getState().setConnection("error", "Entraste a la cabaña desde otra pestaña o dispositivo.");
      return;
    }
    void reconnect(r.reconnectionToken, restarting || action === "restart");
  });

  roomListeners.forEach((cb) => cb(r));
}

/**
 * Vuelve a la cabaña: primero con el token de reconexión (el servidor guarda el lugar un rato) y, si la
 * sala ya no existe —el servidor se reinició— o el lugar venció, entrando de nuevo con token nuevo. Tras
 * un reinicio avisado se entra de nuevo directamente. Reintenta con esperas crecientes (lib/reconnect.ts).
 */
async function reconnect(token: string, restart: boolean) {
  const gen = generation;
  const store = useOfficeStore.getState();
  store.setConnection("reconnecting");
  useReconnectStore.getState().setReason(restart ? "restart" : "lost");
  let fresh = restart;
  const delays = reconnectDelays(restart ? RESTART_BUDGET_MS : RECONNECT_BUDGET_MS);
  let next = 0;
  let wait = true;
  while (next < delays.length) {
    if (wait) await new Promise((res) => setTimeout(res, withJitter(delays[next++]!, Math.random())));
    wait = true;
    if (gen !== generation) return; // el usuario salió mientras reintentábamos
    try {
      const r = fresh ? await joinAgain() : await client!.reconnect<OfficeStateView>(token);
      if (gen !== generation) {
        void r.leave(true).catch(() => undefined);
        return;
      }
      // Sesión nueva: lo de la sala vieja (jugadores, llamada, paneles) no debe quedar como fantasma.
      if (r.sessionId !== useOfficeStore.getState().sessionId) {
        forgetOldSession();
        resetPhone();
      }
      // La escena ya está andando y lee room.state cada cuadro: no se engancha hasta tener el primer estado.
      await firstState(r);
      if (gen !== generation) {
        void r.leave(true).catch(() => undefined);
        return;
      }
      attach(r);
      return;
    } catch (err) {
      if (err instanceof SessionExpiredError) return; // ya va para /login
      // La reconexión ya no existe: entrar de nuevo, sin gastar la espera siguiente.
      if (!fresh && isDeadReconnection(err)) {
        fresh = true;
        wait = false;
      }
    }
  }
  store.setConnection("error", "Se perdió la conexión con la cabaña.");
}

/** Espera el primer estado de una sala recién unida (con tope, para no colgar la reconexión). */
function firstState(r: OfficeRoom): Promise<void> {
  if (r.state?.players) return Promise.resolve();
  return new Promise((res) => {
    const timer = setTimeout(res, 5_000);
    r.onStateChange.once(() => {
      clearTimeout(timer);
      res();
    });
  });
}

/** Entrar de nuevo con token nuevo (sesión nueva: aparece en el jardín, como al entrar). */
async function joinAgain(): Promise<OfficeRoom> {
  const token = await fetchGameToken();
  client ??= new Client(SERVER_URL);
  return client.joinOrCreate<OfficeStateView>(ROOM_NAME, { token });
}

function describeError(err: unknown): string {
  if (isServerUnavailable(err)) return unreachableText(IS_DEV);
  if (err instanceof Error && err.message) return err.message;
  return "No se pudo conectar con la cabaña.";
}
