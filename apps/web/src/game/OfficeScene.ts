import {
  allZones,
  BLACKJACK_SEATS,
  BOARD_TABLES,
  applyDecorEdit,
  buildArea,
  canStandAt,
  canSwimAt,
  poolExitSpot,
  swimMap,
  catalogItem,
  decorateAreaDef,
  findPath,
  footprint,
  furnitureTiles,
  getWorld,
  isBlockedTile,
  nearestFreeTile,
  officeDoor,
  officeFurniture,
  placeAt,
  INTERACT_REACH_TILES,
  phoneInReach,
  isPhone,
  pointsOfType,
  portalAtTile,
  SEAT_REACH_TILES,
  seatAtPoint,
  seatAtTile,
  seatStandSpot,
  zoneAt,
  zoneCenterTile,
  type AreaDecor,
  type DecorEdit,
  type DecorEditResult,
  type OfficeFurniture,
  type OfficeMap,
  type PlacedFurniture,
  type Seat,
  type TilePos,
  type World,
  type Zone,
  type WallFeature,
} from "@hyvento/map";
import { CHIMNEY_TOPS, SCREEN_INSET, tileCursor, WORLD_TO_ART } from "@hyvento/map/art";
import {
  hearing,
  MOVE_SEND_HZ,
  PLAYER_SPEED,
  type Direction,
  type MoveCorrection,
  type MoveMessage,
  type Positioned,
  MENUS,
  voiceNearby,
  BUS,
  BUS_NOTICES,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import type { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, STATUS_HEX } from "@/lib/cozy";
import { Avatar } from "./Avatar";
import { ClubMode } from "./club";
import { EventsView } from "./eventos";
import { CinemaMode } from "./cinema";
import { EscenarioMode } from "./escenario";
import { podcastBlockFor } from "./escenario/net";
import { useEscenarioStore } from "./escenario/store";
import { ESCENARIO, PODCAST, listeners as listenersOf, podcastNoticeText, stageRole } from "@hyvento/shared";
import { AreaView, DEPTH_FLAT, DEPTH_OVERLAY, ensureTexture, furnitureImage, screenToWorld, tileDiamond, worldToScreen, type FurniturePose } from "./iso/view";
import { queuePrerender } from "./iso/prerender";
import { entryStage } from "./entryStore";
import { installCameraCulling } from "./iso/culling";
import { ensureCharacterTextures, parseLook } from "./looks";
import { media, useMediaStore } from "./media";
import {
  DECOR_ERRORS,
  activateInteractable,
  getRoom,
  onEmote,
  onAchievementUnlocked,
  onFurnitureEvent,
  onPhotoCountdown,
  onPhotoFlash,
  onPhotoShot,
  onPhotosChanged,
  onHeldUsed,
  onDrunkBlackout,
  onSwivelEvent,
  onToastEvent,
  onMoveCorrection,
  onWorldEdits,
  onRoom,
  sendFurnitureUse,
  sendMove,
  sendPetAction,
  sendUseHeld,
  sendSwivel,
  sendWorldEditLock,
  sendToast,
  sendOfficeEdit,
  sendTravel,
  type OfficeRoom,
  type RemotePlayer,
} from "./network";
import { followGameNight } from "./gameClock";
import { canEnterOffice, PET_USABLE_PREFIX, selectMyOffice, selectMyUserId, useOfficeStore, type Interactable, type OfficeView, type PanelKind } from "./store";
import { TableMode, type TableKind } from "./table";
import { InteractMarkers } from "./markers";
import { WorldEditor } from "./worldEditor";
import { clientPoint, personAt, useSocialStore } from "./social";
import { Usables, type UsableHit } from "./usables";
import { FishingController } from "./fishing/controller";
import { ObservatorioVivo } from "./observatorioVivo";
import { FishingRods } from "./fishing/rods";
import { DRUNK_NOTICE, DrunkVision, WAKE_NOTICE } from "./drunk";
import { setSfxArea, setSfxListener, sfx } from "./sfx";
import { bindUiSounds } from "./sfxBindings";
import { bindWeatherSounds } from "./weatherSound";
import { ALCOHOL_PER_SIP, DRUNK, isSwivelSeat, spinMs, type DrunkStage, type SwivelEvent } from "@hyvento/shared";
import { AGUA, isSunSeat, spaKindOf, type DiveEvent } from "@hyvento/shared";
import { PoolView } from "./piscina";
import { TinaView } from "./tina";
import { onDive } from "./piscina/net";
import { poolSfx } from "./piscina/sound";
import { playAnticSound } from "./antics-sound";
import { ToastController } from "./toasts";

/** Cómo se lee el estado del dueño en la placa de su puerta. */
const DOOR_STATUS: Record<PresenceStatus, string> = { available: "Disponible", busy: "Ocupado", dnd: "No molestar", away: "Ausente", meeting: "En reunión" };

/** Avisos de dar muchas vueltas en la silla (van rotando) y de cuando se pasa el mareo. */
const SWIVEL_DIZZY_NOTICE = [
  "Tantas vueltas… la oficina sigue girando un ratito.",
  "Ya ni sabes dónde quedó el PC. Mejor para un poquito.",
  "El mundo da vueltas y tú también. ¿Seguro que esto es trabajar?",
];
const SWIVEL_SOBER_NOTICE = "Se te pasó el mareo. La oficina por fin se quedó quieta.";
import { WeatherView } from "./weather";
import { Critters } from "./critters";
import { CHAIR_RACE, type PhotoShot, type PresenceStatus } from "@hyvento/shared";
import { disposeRadio, updateRadio } from "./radio";
import { decayRace, pumpRace, raceForwardMul, sendRaceCancel, useRaceStore } from "./race";
import { WallMount, wallQuad } from "./wallMount";
import { cameraZoom, cssZoomOf } from "./pixelRatio";
import { PhotoBoards } from "./photos/board";
import { headOf, useMinimapStore, type MinimapPerson } from "./minimap";
import { BusView } from "./bus";
import { busDoorsOpenNow } from "./busStore";
import { Aquariums } from "./aquarium";
import { DoorPostIts } from "./doorPostIts";
import { useDoorNotesStore } from "./doorNotes";
import { TrophyCases } from "./trofeos";
import { captureShot } from "./photos/capture";
import { usePhotoStore } from "./photos/store";
import { casaArbolBlockFor } from "./casaArbol";
import { TreeLadderLayer } from "./casaArbolLayer";
import { CASA_ARBOL, CASA_ARBOL_BLOCK_TEXT } from "@hyvento/shared";
import { useAchievementStore } from "./achievements";
import { localSpeedMul, useCocinaStore } from "./cocina";
import { PORTION_USABLE_PREFIX, sendPortion } from "./granjaNet";
import { SeasonView } from "./seasons";
import { NpcCast } from "./npcs/cast";
import { QuestMarkers, questGiverToTalk } from "./encargosMarcas";
import { useOficios } from "./oficios";
import { MUNCHIES, TRIP_NOTICE, TripVision, tripLook } from "./trip";
import { isTripKind, SOMBRERO, type TripKind } from "@hyvento/shared";
import { broadcastActive, noteManualMove, voiceFlags } from "./comunicacion";

// 1 = la vista más abierta: se ve harto más de la cabaña alrededor.
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
/** Distancia (px de mundo) a la puerta de una oficina cerrada para ofrecer "tocar". */
const DOOR_PROMPT_RADIUS = 44;
/** Cada cuánto se recalcula a quién se oye (audio/video por proximidad). */
const HEARING_INTERVAL_MS = 250;
const FADE_MS = 180;
/** Orden de los niveles de abajo hacia arriba (para que la escalera suene a subir o a bajar). */
const LEVEL_ORDER = ["sotano", "planta-baja", "piso-2", "piso-3"];
/** Puntos del mapa y muebles (para el clic) de cada objeto con el que se interactúa. */
const INTERACTABLES: { kind: Interactable; point: string; furniture: string[] }[] = [
  { kind: "mailbox", point: "mailbox", furniture: ["mailbox"] },
  { kind: "board", point: "task_board", furniture: ["notice-board"] },
  { kind: "cafe", point: "cafe_counter", furniture: ["counter-coffee", "pastry-case", "counter"] },
  { kind: "shop", point: "shop_counter", furniture: ["shop-counter", "display-shelf"] },
  { kind: "fitting", point: "fitting_room", furniture: ["fitting-booth", "clothes-rack"] },
  { kind: "pole", point: "pole_stage", furniture: ["dance-pole"] },
  { kind: "roulette", point: "roulette", furniture: ["roulette-table", "roulette-wheel"] },
  { kind: "cashier", point: "casino_cashier", furniture: ["casino-cashier"] },
  { kind: "bar", point: MENUS.bar.point, furniture: [...MENUS.bar.furniture] },
  { kind: "fishing", point: "fishing_spot", furniture: ["flat-rock"] },
  { kind: "pesca", point: "fishing_shop", furniture: ["pesca-mostrador", "pesca-caseta", "pesca-canas", "pesca-nevera"] },
  { kind: "dj", point: "dj_booth", furniture: ["dj-booth"] },
  { kind: "cinema", point: "cinema", furniture: ["projector"] },
  { kind: "snacks", point: MENUS.cine.point, furniture: [...MENUS.cine.furniture] },
  { kind: "arcade", point: "arcade", furniture: ["arcade-cabinet"] },
  { kind: "hockey", point: "air_hockey", furniture: ["air-hockey"] },
  { kind: "baccarat", point: "baccarat", furniture: ["baccarat-table"] },
  { kind: "dados", point: "sicbo", furniture: ["sicbo-table"] },
  { kind: "caballos", point: "horse_race", furniture: ["horse-race-table"] },
  { kind: "boardgame", point: "board_game", furniture: ["chess-table", "checkers-table"] },
  { kind: "photos", point: "photo_board", furniture: ["photo-board"] },
  { kind: "race", point: "chair_race", furniture: ["race-flag"] },
  { kind: "aquarium", point: "aquarium", furniture: ["acuario"] },
  { kind: "shed", point: "tool_shed", furniture: ["tool-shed"] },
  // La piscina: la escalera (sin mueble: el destello quedaría en el medio del agua) y el trampolín.
  { kind: "pool", point: "pool_steps", furniture: [] },
  { kind: "dive", point: "diving_board", furniture: ["diving-board"] },
  { kind: "grill", point: "grill", furniture: ["clay-oven", "brick-grill", "prep-table", "menu-board"] },
  { kind: "coop", point: "farm_sign", furniture: ["farm-sign"] },
  { kind: "trophies", point: "trophy_case", furniture: ["trophy-case"] },
  { kind: "kitchen", point: "kitchen_stove", furniture: ["stove", "pantry-shelf"] },
  // La estación del Megabús: solo con E (un clic en la plataforma es para caminar por ella).
  { kind: "bus", point: "bus_stop", furniture: [] },
  { kind: "stage", point: "stage", furniture: ["stage-lectern", "stage-deck"] },
  { kind: "podcast", point: "podcast", furniture: ["podcast-console"] },
  // El observatorio: la fogata de malvaviscos del jardín y lo de adentro de la torre.
  { kind: "marshmallow", point: "marshmallow_fire", furniture: ["marshmallow-fire"] },
  { kind: "telescope", point: "telescope", furniture: ["brass-telescope"] },
  { kind: "orrery", point: "orrery", furniture: ["orrery"] },
  { kind: "radar", point: "signal_radar", furniture: ["signal-radar"] },
  { kind: "logbook", point: "logbook", furniture: ["log-desk"] },
  // La astrónoma (un personaje, no un mueble: se le habla desde el punto de delante).
  { kind: "astronomer", point: "astronomer", furniture: [] },
];
const TRAVEL_TIMEOUT_MS = 3000;
/** Cuánto hay que alejarse de donde se llegó para que los portales vuelvan a funcionar (tiles). */
const ARRIVAL_CLEAR_TILES = 1.5;
/** Colores del editor de oficina: grilla, y fantasma/huella cuando se puede (verde) o no (rojo). */
const DECOR_COLORS = { grid: 0xfff4d6, ok: 0x6fcf5f, bad: 0xe05a4a };

type Keys = Record<
  "W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E" | "R" | "F" | "B" | "ESC" | "DELETE" | "BACKSPACE",
  Phaser.Input.Keyboard.Key
>;
/** Teclas de un toque apretadas en este frame con el juego libre (ver `readTaps`). */
type Taps = Record<"e" | "r" | "f" | "b" | "esc" | "del", boolean>;

/** Paneles del casino (el hockey del arcade y los juegos de mesa) que se juegan en la mesa (modo mesa) en vez de en una ventana. */
const isTablePanel = (kind: PanelKind | undefined): kind is TableKind =>
  kind === "roulette" || kind === "blackjack" || kind === "hockey" || kind === "boardgame" || isStandingTable(kind);
/** Mesas donde se apuesta parado (caminar te saca de ellas, como de la ruleta). */
const isStandingTable = (kind: PanelKind | TableKind | null | undefined): boolean => kind === "roulette" || kind === "baccarat" || kind === "dados" || kind === "caballos";

/** Dirección del sprite según hacia dónde se mueve en pantalla (+x = sureste, +y = suroeste). */
function facingFor(vx: number, vy: number): Direction {
  const sx = vx - vy;
  const sy = vx + vy;
  return sy >= 0 ? (sx >= 0 ? "right" : "down") : sx >= 0 ? "up" : "left";
}

export class OfficeScene extends Phaser.Scene {
  private world!: World;
  /** Nivel que se está mostrando (el del jugador local). */
  private map!: OfficeMap;
  private view?: AreaView;
  private keys!: Keys;
  private avatars = new Map<string, Avatar>();
  private local?: Avatar;
  private localId: string | null = null;
  private path: TilePos[] = [];
  /** Asiento en el que estoy sentado. */
  private seat: Seat | null = null;
  /** Asiento al que voy caminando (clic en una silla): al llegar me siento. */
  private pendingSeat: Seat | null = null;
  /** Zona a la que voy, aunque esté en otro nivel ("ir a mi oficina"). */
  private pendingZone: string | null = null;
  /** Persona hasta la que voy ("Ir hasta" en Conectados o "Ir" en una invitación), aunque esté en otro nivel. */
  private pendingPerson: { sessionId: string; tries: number } | null = null;
  /** Objeto al que voy caminando (clic en el buzón o el tablón): al llegar se abre. */
  private pendingInteract: Interactable | null = null;
  private pathMarker?: Phaser.GameObjects.Image;
  private hoverCursor?: Phaser.GameObjects.Image;
  private lastSent: MoveMessage | null = null;
  private sendAccumulator = 0;
  private seenMessages = 0;
  private nameplates = new Map<string, Phaser.GameObjects.Text>();
  /** Debajo de cada placa: cómo está el dueño (disponible, ocupado, en reunión…) y su nota. */
  private statusPlates = new Map<string, Phaser.GameObjects.Text>();
  private cleanups: (() => void)[] = [];
  private roomDetach: (() => void)[] = [];
  /** La escena fue destruida: ignorar cualquier evento tardío de la sala. */
  private disposed = false;
  private hearingElapsed = 0;
  /** ¿Había alguien cerca en la última revisión de la sala de video? (histéresis de `voiceNearby`) */
  private voiceNear = false;
  private zonesById = new Map<string, Zone>();
  /** sessionId → userId y nivel de cada avatar (LiveKit usa userId). */
  private userOfSession = new Map<string, string>();
  private areaOfSession = new Map<string, string>();
  /** Pantallas de presentación en la pared (punto "screen") → video que muestran. */
  /** La pantalla compartida de cada tele de sala, montada sobre la pared (ver wallMount.ts). */
  private screens = new Map<number, { identity: string | null; track: Track; el: HTMLVideoElement; mount: WallMount; feature: WallFeature }>();
  /** Esperando la respuesta del servidor tras pisar un portal. */
  private travelling = false;
  /** Tile de portal en el que quedé (no se vuelve a usar hasta salir de él). */
  private portalTile = "";
  /**
   * Donde se llegó por el último portal. Los portales no se disparan hasta alejarse de ahí (si no, con W
   * apretada se sube y se baja la escalera en un ciclo), salvo que se haga clic justo en el portal.
   */
  private arrivedAt: { x: number; y: number } | null = null;
  /** Portal al que se hizo clic ("x,y"): ese sí se dispara aunque se acabe de llegar. */
  private clickedPortal: string | null = null;
  private ambient: Phaser.Time.TimerEvent[] = [];
  /** Decoración aplicada a cada nivel (JSON), para rearmarlo solo cuando cambia. */
  private decorApplied = new Map<string, string>();
  /** Editor de oficina: grilla sobre la oficina, huella y fantasma del mueble bajo el puntero. */
  private decorGrid?: Phaser.GameObjects.Graphics;
  private decorMarks?: Phaser.GameObjects.Graphics;
  private decorGhost?: { key: string; img: Phaser.GameObjects.Image };
  /** Tile bajo el puntero en el modo decorar. */
  private decorHover: TilePos | null = null;
  /** Cambió la decoración de alguna oficina: el nivel se rearma una vez, en el próximo frame. */
  private decorDirty = false;
  /** Cuándo se dejó de escribir o se apagó el PC (mismo reloj que `event.timeStamp`). */
  private keysFreeAt = 0;
  /** Modo mesa del casino (ruleta o blackjack con la cámara sobre la mesa). */
  private table!: TableMode;
  /** Muebles que se usan (tele, lámparas, instrumentos, gato) y el que está al alcance. */
  private usables!: Usables;
  private usableNear: UsableHit | null = null;
  /** Mascota al alcance para acariciarla con E (si no hay un mueble ni un asiento más cerca). */
  private petNear: string | null = null;
  /** La granja: a quién le pido una porción con E (sessionId), si alguien con un plato está al lado. */
  private portionNear: string | null = null;
  /** Rombitos sobre lo que se puede usar (ver markers.ts). */
  private markers!: InteractMarkers;
  /** Editor de la casa (admins; ver worldEditor.ts). */
  private worldEditor!: WorldEditor;
  /** Mueble al que voy caminando (clic en la tele, el piano…): al llegar se usa. */
  private pendingUse: PlacedFurniture | null = null;
  /** Pesca: la caña y el minijuego del jugador local, y las cañas de todos. */
  private fishing!: FishingController;
  private rods!: FishingRods;
  /** El observatorio: el orrery que gira y el palito del malvavisco en la mano. */
  private observatorio!: ObservatorioVivo;
  /** El club del sótano (música, luces al ritmo, bailes) y las pantallas del arcade. */
  private club!: ClubMode;
  /** Cumpleaños, karaoke y foco: el pastel, el neón y lo de sobre el nombre (ver eventos.ts). */
  private eventsView!: EventsView;
  /** El cine del sótano (la función en la pantalla, las luces y el haz del proyector). */
  private cinema!: CinemaMode;
  /** El escenario del jardín y el estudio de grabación (pantalla grande, manos, carteles, grabador). */
  private escenario!: EscenarioMode;
  /** Lo que ve quien tomó de más (filtros sobre el canvas) y su zigzag al caminar. */
  private drunkVision!: DrunkVision;
  private drunkStage: DrunkStage = 0;
  /** Desmayado: no se camina hasta que el servidor me despierta (y ahí vuelve la imagen). */
  private fainted = false;
  /** Brindis: animaciones y la ayuda "B" del HUD (se recalcula unas veces por segundo). */
  private toasts!: ToastController;
  private toastPromptAt = 0;
  /** El mareo de ahora es de dar vueltas en la silla (no del bar): cambia el aviso al subir y al pasarse. */
  private dizzyOnly = false;
  private dizzySpins = 0;
  /** El clima de afuera (lluvia, nubes, niebla, relámpagos) y la fauna del jardín. */
  private weatherView!: WeatherView;
  /** Las estaciones afuera: tono del pasto, hojas, pétalos y nieve (ver seasons.ts). */
  private seasonView!: SeasonView;
  private critters!: Critters;
  /** Ya llegó el clima de esta conexión (el primero se pone de una, sin transición). */
  private weatherKnown = false;
  /** Velo del cambio de día a noche (y cuándo se armó la vista: recién llegado no hace falta fundido). */
  private nightVeil?: Phaser.GameObjects.Rectangle;
  private viewBuiltAt = 0;
  /** Las fotos pinchadas en el tablón de la cafetería. */
  private photoBoards!: PhotoBoards;
  private treeLadder!: TreeLadderLayer;
  /** El Megabús de la parada del jardín (el bus de la calle y los sonidos de adentro). */
  private busView!: BusView;
  private busNoticeAt = -1e9;
  /** La piscina del jardín (reflejos, flotadores, la lona y las salpicaduras) y si estoy nadando. */
  private pool!: PoolView;
  /** La tina y la sauna del lago: el agua que se mueve, el vapor y los destellos del reflejo. */
  private tina!: TinaView;
  private swimming = false;
  /** Los peces del acuario del salón y los post-its de las puertas de las oficinas. */
  private aquariums!: Aquariums;
  private postIts!: DoorPostIts;
  private trophyCases!: TrophyCases;
  /** El personal del casino y el Man del Sombrero (ver npcs/cast.ts). */
  private npcs!: NpcCast;
  /** Las marcas "!" y "?" de mis encargos sobre quien los da (ver encargosMarcas.ts). */
  private questMarks!: QuestMarkers;
  /** Lo que ve quien tomó algo del Man del Sombrero (ver trip.ts). */
  private tripVision!: TripVision;
  private tripKind: TripKind | "" = "";
  /** Cuándo toca el próximo antojo (trabado). */
  private munchiesAt = 0;

  constructor() {
    super("office");
  }

  /** El arte pre-dibujado en el build (fondos, muebles, bosque): lo que falte se dibuja después. */
  preload() {
    // La pantalla de carga cuenta los archivos (el manifiesto agrega el resto al llegar: antes no se sabe).
    entryStage.start("arte");
    this.load.on("progress", () => {
      if (this.load.totalToLoad > 1) entryStage.progress("arte", this.load.totalComplete / this.load.totalToLoad);
    });
    this.load.once("complete", () => entryStage.done("arte"));
    queuePrerender(this);
  }

  create() {
    entryStage.done("arte");
    entryStage.start("mundo");
    try {
      this.setupScene();
    } catch (err) {
      this.failMap(err);
    }
  }

  /**
   * No se pudo armar o dibujar el nivel: en vez de quedar en "Entrando…" para siempre, la pantalla de
   * error con "Reintentar" (vuelve a conectar y a crear el juego).
   */
  private failMap(err: unknown) {
    console.error("No se pudo cargar el mapa", err);
    if (!this.disposed) useOfficeStore.getState().setConnection("error", "No se pudo cargar el mapa. Reintenta o recarga la página.");
  }

  /**
   * El nivel quedó armado: la pantalla de carga espera además el primer cuadro dibujado, así al irse ya
   * está el juego detrás (sin pantallazo del fondo vacío).
   */
  private markMapReady() {
    if (useOfficeStore.getState().mapReady) return;
    useOfficeStore.getState().setMapReady(true);
    entryStage.done("mundo");
    entryStage.start("cuadro");
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => entryStage.done("cuadro"));
  }

  private setupScene() {
    // Copia propia de la lista de niveles: la decoración de las oficinas rearma el piso 2 solo aquí.
    const base = getWorld();
    this.world = { ...base, areas: new Map(base.areas) };
    for (const z of allZones(this.world)) this.zonesById.set(z.id, z);
    useOfficeStore.getState().setZoneNames(Object.fromEntries(allZones(this.world).map((z) => [z.id, z.name])));
    // La noche la manda el reloj del juego (el botón del HUD solo la fuerza un rato).
    this.cleanups.push(followGameNight());
    // Hasta saber dónde está el jugador se muestra el jardín.
    this.map = this.world.areas.get(this.world.spawnArea)!;
    // Las oficinas pueden haber llegado antes que la escena: su decoración ya se aplica.
    this.applyDecor(useOfficeStore.getState().offices);

    ensureTexture(this, "cursor-tile", () => tileCursor());
    this.hoverCursor = this.add.image(0, 0, "cursor-tile").setVisible(false).setDepth(-5e5);
    this.tweens.add({ targets: this.hoverCursor, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(cameraZoom(this.defaultZoom()));
    cam.setRoundPixels(true);
    // Solo se dibuja lo que cae en la vista (ver culling.ts).
    this.cleanups.push(installCameraCulling(this));

    // Sin captura: el teclado sigue funcionando en los inputs de la UI.
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,R,F,B,ESC,DELETE,BACKSPACE", false) as Keys;
    this.table = new TableMode(this);
    this.usables = new Usables(this, (id) => this.avatars.get(id), () => this.local);
    this.markers = new InteractMarkers(this);
    this.worldEditor = new WorldEditor(this, {
      map: () => this.map,
      view: () => this.view,
      me: () => (this.local ? { x: this.local.x, y: this.local.y } : null),
    });
    this.cleanups.push(onWorldEdits((area) => this.rebuildFromWorld(area)));
    this.fishing = new FishingController(this, () => this.local, () => this.map);
    this.rods = new FishingRods(this, (id) => this.avatars.get(id), (id) => this.areaOfSession.get(id) === this.map.id);
    this.observatorio = new ObservatorioVivo(this, (id) => this.avatars.get(id), (id) => this.areaOfSession.get(id) === this.map.id);
    this.club = new ClubMode(this, (id) => this.avatars.get(id), () => this.local, () => this.localId);
    this.eventsView = new EventsView(this, () => this.avatars, (id) => this.userOfSession.get(id));
    this.cinema = new CinemaMode(this, () => this.local);
    this.escenario = new EscenarioMode({ scene: this, local: () => this.local, avatars: () => this.avatars });
    this.drunkVision = new DrunkVision(() => this.game.canvas);
    this.toasts = new ToastController(this, {
      avatar: (id) => this.avatars.get(id),
      here: (id) => this.areaOfSession.get(id) === this.map.id,
      localId: () => this.localId,
      name: (id) => useOfficeStore.getState().players[id]?.name ?? "Alguien",
      present: () => [...this.areaOfSession].filter(([, area]) => area === this.map.id).map(([id]) => id),
    });
    this.weatherView = new WeatherView(this);
    this.weatherView.setNight(useOfficeStore.getState().night);
    this.weatherView.setWeather(useOfficeStore.getState().weather, true);
    this.seasonView = new SeasonView(this);
    this.seasonView.setWeather(useOfficeStore.getState().weather, true);
    this.critters = new Critters(this, () => this.peopleHere());
    this.critters.setConditions(useOfficeStore.getState().night, useOfficeStore.getState().weather);
    this.photoBoards = new PhotoBoards(this);
    this.treeLadder = new TreeLadderLayer(this);
    this.busView = new BusView(this, () => getRoom() ?? undefined);
    this.pool = new PoolView(this);
    this.tina = new TinaView(this);
    this.aquariums = new Aquariums(this);
    this.postIts = new DoorPostIts(this);
    this.trophyCases = new TrophyCases(this);
    this.tripVision = new TripVision(() => this.game.canvas.parentElement);
    this.questMarks = new QuestMarkers(this, { local: () => (this.local ? { x: this.local.x, y: this.local.y } : null) });
    // Alguien del nivel subió de nivel en un oficio: chispas sobre su personaje.
    useOficios.subscribe((st, prev) => st.levelUp && st.levelUp !== prev.levelUp && this.avatars.get(st.levelUp.sessionId)?.sparkle());
    this.npcs = new NpcCast(this, {
      local: () => (this.local ? { x: this.local.x, y: this.local.y } : null),
      people: () => {
        const players = useOfficeStore.getState().players;
        const out: { sessionId: string; name: string; x: number; y: number; zoneId: string }[] = [];
        for (const [id, a] of this.avatars) {
          const info = players[id];
          if (info && this.areaOfSession.get(id) === this.map.id) out.push({ sessionId: id, name: info.name, x: a.x, y: a.y, zoneId: info.zoneId });
        }
        return out;
      },
    });
    // Carrera de sillas: Espacio da impulso (sin contar la repetición de la tecla apretada).
    this.input.keyboard!.on("keydown-SPACE", (e: KeyboardEvent) => {
      if (!e.repeat && this.local?.isRiding && !useOfficeStore.getState().typing) pumpRace();
    });
    this.input.on("gameout", () => (this.pointerOutside = true));
    this.input.on("gameover", () => (this.pointerOutside = false));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const s = useOfficeStore.getState();
      // En la carrera, el clic es impulso (no caminar).
      if (this.local?.isRiding) return pumpRace();
      if (s.pcOn) return; // con el PC prendido no se camina
      if (this.fishing.pointerDown()) return; // pescando, el clic es para la caña
      if (this.table.pointerDown(p.worldX, p.worldY)) return; // en la mesa, el clic pone fichas
      // Clic sobre quien baila en el tubo (cerca de la tarima): le tira un billete.
      if (!s.decorating && !s.worldEditing && this.club.pointerDown(p.worldX, p.worldY)) return;
      // Clic sobre otra persona: su menú (regalar, intercambiar) en vez de caminar.
      const person = s.decorating || s.worldEditing ? null : personAt(this.avatars, this.localId, p.worldX, p.worldY);
      if (person) return useSocialStore.getState().openPersonMenu(person, ...clientPoint(this.game.canvas, this.scale.width, p.x, p.y));
      useSocialStore.getState().closePersonMenu();
      if (s.worldEditing) this.worldEditor.click(p.worldX, p.worldY); // editor de la casa (admins)
      else if (s.decorating) this.decorClick(p.worldX, p.worldY); // decorando, el clic pone o elige muebles
      else this.clickAt(p.worldX, p.worldY);
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.table.pointerMove(p.worldX, p.worldY)) this.hoverCursor?.setVisible(false);
      else this.hoverAt(p.worldX, p.worldY);
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.table.kind) return; // en la mesa el zoom lo maneja el modo mesa
      cam.setZoom(cameraZoom(Phaser.Math.Clamp(Math.round(cssZoomOf(cam.zoom)) + (dy > 0 ? -1 : 1), MIN_ZOOM, MAX_ZOOM)));
    });

    this.cleanups.push(
      onRoom((room) => this.bindRoom(room)),
      onMoveCorrection((c) => this.handleCorrection(c)),
      onEmote((e) => this.avatars.get(e.sessionId)?.emote(e.emote)),
      onHeldUsed((e) => {
        this.avatars.get(e.sessionId)?.useHeld(e.part, e.action, e.left);
        if (e.sessionId === this.localId && ALCOHOL_PER_SIP[e.art]) this.dizzyOnly = false;
      }),
      onToastEvent((e) => {
        this.toasts.handle(e);
        // Brindé: el sorbo pudo llevar alcohol, así que los avisos vuelven a ser los del bar.
        if (e.kind === "clink" && e.sips.some((sip) => sip.sessionId === this.localId)) this.dizzyOnly = false;
      }),
      onSwivelEvent((e) => this.handleSwivel(e)),
      onDrunkBlackout((e) => {
        this.avatars.get(e.sessionId)?.faint(this.time.now);
        if (e.sessionId === this.localId) this.faintLocal();
      }),
      onFurnitureEvent((e) => this.usables.handleEvent(e)),
      onPhotoCountdown((e) => {
        this.avatars.get(e.sessionId)?.countdown(e.ms);
        if (e.sessionId === this.localId) usePhotoStore.getState().setCounting(Date.now() + e.ms);
      }),
      // Quien la saca no ve su propio destello en la foto: su flash es la pantalla en blanco.
      onPhotoFlash((e) => e.sessionId !== this.localId && this.avatars.get(e.sessionId)?.photoFlash()),
      onPhotoShot((shot) => this.takePhoto(shot)),
      onDive((e) => this.handleDive(e)),
      () => this.pool.destroy(),
      () => this.tina.destroy(),
      onPhotosChanged(() => {
        const watching = PhotoBoards.hasBoard(this.map) || useOfficeStore.getState().panel?.kind === "photos";
        usePhotoStore.getState().markStale(watching);
      }),
      () => this.photoBoards.destroy(),
      () => this.treeLadder.destroy(),
      this.bindVoiceDemand(),
      () => this.busView.destroy(),
      () => this.aquariums.destroy(),
      () => this.postIts.destroy(),
      () => this.trophyCases.destroy(),
      onAchievementUnlocked((e) => this.avatars.get(e.sessionId)?.celebrate()),
      () => this.usables.destroy(),
      () => this.fishing.destroy(),
      () => this.rods.destroy(),
      () => this.observatorio.destroy(),
      () => this.club.destroy(),
      () => this.eventsView.destroy(),
      () => this.cinema.destroy(),
      () => this.escenario.destroy(),
      () => disposeRadio(),
      () => this.drunkVision.destroy(),
      () => this.tripVision.destroy(),
      () => this.npcs.destroy(),
      bindUiSounds(),
      bindWeatherSounds(),
      () => this.toasts.destroy(),
      () => this.weatherView.destroy(),
      () => this.seasonView.destroy(),
      () => this.critters.destroy(),
      useOfficeStore.subscribe((s) => this.showNewBubbles(s.messages)),
      useMediaStore.subscribe((m, prev) => {
        if (m.speaking !== prev.speaking) this.updateSpeaking(m.speaking);
        if (m.trackVersion !== prev.trackVersion || m.cam !== prev.cam || m.screen !== prev.screen || m.hearing !== prev.hearing || m.participants !== prev.participants) {
          this.syncVideos();
          this.syncScreens();
        }
      }),
      useOfficeStore.subscribe((s, prev) => {
        // Quién está dónde y su estado cambian la línea de las placas ("En reunión", "Ocupado").
        if (s.players !== prev.players && s.offices === prev.offices) this.updateNameplates(s.offices);
        if (s.offices !== prev.offices) {
          // Un patch trae muchos cambios seguidos (la primera edición copia ~10 muebles): se rearma una vez.
          this.decorDirty = true;
          this.updateNameplates(s.offices);
        }
        if ((prev.typing || prev.pcOn) && !s.typing && !s.pcOn) this.keysFreeAt = performance.now();
        if (s.walkTarget && s.walkTarget !== prev.walkTarget) {
          if (s.walkTarget.kind === "zone") this.walkToZone(s.walkTarget.zoneId);
          else if (s.walkTarget.kind === "point") this.walkTo(s.walkTarget.x, s.walkTarget.y);
          else this.walkToPlayer(s.walkTarget.sessionId);
        }
        if (s.weather !== prev.weather) {
          this.pool.setWeather(s.weather);
          this.weatherView.setWeather(s.weather, !this.weatherKnown);
          this.seasonView.setWeather(s.weather, !this.weatherKnown);
          this.weatherKnown = true;
        }
        if (s.weather !== prev.weather || s.night !== prev.night) this.critters.setConditions(s.night, s.weather);
        if (s.night !== prev.night) this.changeNight();
        if (s.lastAward && s.lastAward !== prev.lastAward) this.floatAward(s.lastAward.amount);
        if (s.panel?.kind !== prev.panel?.kind) this.syncTable(s.panel?.kind, prev.panel?.kind);
        if (s.decorating !== prev.decorating || s.decorPick !== prev.decorPick || s.decorFacing !== prev.decorFacing) {
          this.refreshDecor();
        }
        // Entrar o salir del editor de la casa pide o suelta el candado (una persona a la vez).
        if (s.worldEditing !== prev.worldEditing) sendWorldEditLock(s.worldEditing);
        if (s.worldEditing !== prev.worldEditing || (s.worldEditing && (s.decorPick !== prev.decorPick || s.decorFacing !== prev.decorFacing))) {
          this.worldEditor.refresh(true);
        }
      }),
    );
    // `game.destroy()` emite DESTROY (no SHUTDOWN): hay que limpiar en ambos casos, o la escena
    // muerta seguiría suscrita a la sala siguiente y rompería sus callbacks de estado.
    const cleanup = () => {
      this.disposed = true;
      this.table.dispose();
      this.clearScreens();
      this.unbindRoom();
      this.cleanups.forEach((fn) => fn());
      this.cleanups = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  update(time: number, delta: number) {
    if (this.local) setSfxListener(this.local.x, this.local.y);
    this.markers?.update(time, this.local ? { x: this.local.x, y: this.local.y } : null, this.map?.tileSize ?? 32);
    if (this.decorDirty) {
      this.decorDirty = false;
      this.applyDecor(useOfficeStore.getState().offices);
    }
    this.updateLocal(delta, this.readTaps());
    this.table.update();
    // En la mesa se atenúa a quien la tape, y también los muebles de adelante (un pinball junto a los caballitos).
    const covering: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [...this.avatars.values()].map((a) => a.sprite);
    covering.push(...this.npcs.sprites());
    if (this.table.kind && this.view) covering.push(...this.view.furnitureSprites());
    this.table.fadeAvatars(covering);
    // En la mesa (casino, hockey) los nombres se esconden: con tanto zoom taparían la mesa. En el ajedrez
    // y las damas no (el tablero va en la tira y se quiere ver quién juega).
    const hideNames = Boolean(this.table.kind) && this.table.kind !== "boardgame";
    for (const a of this.avatars.values()) a.setNameHidden(hideNames);
    // Los NPC (crupier, dealer, cajera, portero) también: su nombre tapaba la mesa igual que el de los jugadores.
    this.npcs.setNameHidden(hideNames);
    this.updateNameTags();
    this.hearingElapsed += delta;
    if (this.hearingElapsed >= HEARING_INTERVAL_MS) {
      this.hearingElapsed = 0;
      this.updateHearing();
      // Alguien pudo pararse donde iba el mueble: el fantasma se vuelve a revisar.
      if (this.decorGhost) this.updateGhost();
    }
    for (const [id, avatar] of this.avatars) {
      if (id !== this.localId) avatar.interpolate(delta);
      avatar.sway(time);
    }
    this.shakePhones(time);
    this.drunkVision.update(time, delta, this.tripVision.update(time, delta));
    this.npcs.update(time);
    this.questMarks.update(time);
    this.publishMinimap(time);
    this.updateMunchies(time);
    this.weatherView.update(time, delta);
    this.seasonView.update(time, delta);
    this.critters.update(time, delta);
    this.usables.update();
    this.busView.update(delta);
    this.fishing.update(delta);
    this.rods.update();
    this.observatorio.update(time);
    // Al final: el club tapa el cuerpo de quien baila después de que el avatar se acomodó.
    this.club.update();
    this.eventsView.update();
    this.cinema.update(time);
    this.pool.update(time);
    this.tina.update(time);
    this.escenario.update(time);
    this.updateToastPrompt(time);
    this.updatePrivateRoom();
    this.updateOfficeRadio();
    this.updateScreenMounts();
    this.syncTextResolution(time);
  }

  private textRes = 0;
  private textScanAt = 0;

  /**
   * Los textos del canvas (nombres, placas, burbujas) se rasterizan a la escala a la que se ven: cada
   * píxel del texto cae en un píxel de pantalla. Con una resolución fija más alta, la cámara los achicaba
   * saltando filas de píxeles (se veían borrosos o comidos). Se revisa cada tanto por los textos nuevos.
   */
  private syncTextResolution(time: number) {
    const r = Math.max(1, Math.round(this.cameras.main.zoom));
    if (r === this.textRes && time < this.textScanAt) return;
    this.textRes = r;
    this.textScanAt = time + 300;
    const visit = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        if (o instanceof Phaser.GameObjects.Text) {
          // Phaser solo copia la resolución a la textura al crear el texto: sin esto se dibuja achicado.
          if (o.style.resolution !== r) {
            o.frame.source.resolution = r;
            o.setResolution(r);
          }
        } else if (o instanceof Phaser.GameObjects.Container) visit(o.list);
      }
    };
    visit(this.children.list);
  }

  /** La radio de la oficina donde estoy (si tiene): suena solo adentro, al segundo del servidor. */
  private updateOfficeRadio() {
    const s = useOfficeStore.getState();
    const office = s.zone?.type === "office" ? s.offices[s.zone.id] : undefined;
    const parent = this.game.canvas.parentElement;
    if (parent) updateRadio(parent, office?.radio ?? null);
  }

  /**
   * Modo privado: dentro de cualquier sala de la casa (una oficina, la cafetería, la biblioteca…), sus
   * paredes altas y afuera a oscuras. En la carrera de sillas, lo mismo con el pasillo: se ve bien la
   * pista y dónde termina.
   */
  private updatePrivateRoom() {
    const s = useOfficeStore.getState();
    const ts = this.map?.tileSize ?? 32;
    let rect: { x: number; y: number; w: number; h: number } | null = null;
    if (this.local?.isRiding && this.map?.id === CHAIR_RACE.area)
      rect = { x: 0, y: CHAIR_RACE.laneY0, w: this.map.width, h: CHAIR_RACE.laneY1 - CHAIR_RACE.laneY0 + 1 };
    else if (s.privateWalls && this.map && !this.map.outdoor && this.local) {
      const tx = Math.floor(this.local.x / ts);
      const ty = Math.floor(this.local.y / ts);
      const room = this.map.def.rooms.find((r) => tx >= r.rect.x && tx < r.rect.x + r.rect.w && ty >= r.rect.y && ty < r.rect.y + r.rect.h);
      if (room) rect = room.rect;
    }
    this.view?.setPrivateRoom(rect);
    this.postIts.setVeil(rect);
    // El panel lateral ofrece el botón de las paredes en cualquier sala interior.
    const indoors = Boolean(this.map && !this.map.outdoor);
    if (s.indoors !== indoors) s.setIndoors(indoors);
    // Los de afuera tampoco se ven (asomarían por encima del muro alto), ni las mascotas.
    this.usables.setPetVeil(rect ? { x: rect.x * ts, y: rect.y * ts, w: rect.w * ts, h: rect.h * ts } : null);
    for (const [id, a] of this.avatars) {
      const inside = !rect || id === this.localId || (a.x >= rect.x * ts && a.x < (rect.x + rect.w) * ts && a.y >= rect.y * ts && a.y < (rect.y + rect.h) * ts);
      a.setVeiled(!inside);
      a.setOverShade(Boolean(rect) && inside);
    }
    this.npcs.setOverShade(rect, ts);
  }

  // ---------- Fotos ----------

  /**
   * El servidor disparó mi foto: se recorta el canvas justo después de dibujar el cuadro (sin el HUD,
   * que es DOM), la pantalla hace flash y queda lista para escribirle el pie y subirla.
   */
  private takePhoto(shot: PhotoShot) {
    usePhotoStore.getState().setCounting(0);
    // El globo del 3-2-1 no sale en la foto (si el reloj del juego se atrasó, todavía puede estar).
    for (const a of this.avatars.values()) a.clearCountdown();
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      const me = this.local;
      if (this.disposed || !me) return;
      const cam = this.cameras.main;
      const canvas = captureShot(this.game.canvas, { zoom: cam.zoom, x: cam.x, y: cam.y, worldView: cam.worldView }, worldToScreen(me.x, me.y));
      sfx.shutter();
      usePhotoStore.getState().flash();
      usePhotoStore.getState().setPending({ shot: canvas, ticket: shot.ticket, area: shot.area, people: shot.people, takenAt: shot.takenAt });
    });
  }

  // ---------- Niveles ----------

  /** Muestra un nivel: se redibuja todo y solo se ven los avatares que están en él. */
  private enterArea(areaId: string) {
    try {
      this.showArea(areaId);
    } catch (err) {
      this.failMap(err);
    }
  }

  private showArea(areaId: string) {
    const map = this.world.areas.get(areaId);
    if (!map) return;
    const changed = !this.view || map.id !== this.map.id;
    this.map = map;
    setSfxArea(map);
    if (changed) {
      this.view?.destroy();
      this.view = new AreaView(this, map, useOfficeStore.getState().night);
      this.viewBuiltAt = performance.now();
      this.usables.setArea(map, this.view);
      this.markers.setArea(map, this.view, INTERACTABLES);
      this.weatherView.setArea(map, this.view.bounds);
      this.seasonView.setArea(map, this.view.bounds);
      this.critters.setArea(map);
      this.photoBoards.setArea(map);
      this.treeLadder.setArea(map, this.view);
      this.busView.setArea(map);
      this.aquariums.setArea(map, this.view);
      this.postIts.setArea(map);
      this.trophyCases.setArea(map);
      this.markMapReady();
      this.rods.setArea(map);
      this.observatorio.setArea(map);
      this.fishing.reset();
      this.club.setArea(map, this.view);
      this.eventsView.setArea(map, this.view);
      this.cinema.setArea(map);
      this.escenario.setArea(map);
      this.npcs.setArea(map);
      this.questMarks.setArea(map);
    this.pool.setArea(map, this.view, useOfficeStore.getState().weather, useOfficeStore.getState().night);
    this.tina.setArea(map, useOfficeStore.getState().night);
      this.createNameplates();
      this.clearScreens();
      this.startAmbient();
    }
    for (const [sessionId, avatar] of this.avatars) avatar.setHidden(this.areaOfSession.get(sessionId) !== map.id);
    useOfficeStore.getState().setArea(map.id);
    this.updateNameplates(useOfficeStore.getState().offices);
    this.syncScreens();
    this.refreshDecor();
  }

  /** Decoración de las oficinas de un nivel según el estado de la sala (solo las que tienen algo). */
  private decorOf(areaId: string, offices: Record<string, OfficeView>): AreaDecor {
    const decor: AreaDecor = {};
    for (const z of getWorld().areas.get(areaId)?.zones ?? []) {
      const o = z.type === "office" ? offices[z.id] : undefined;
      if (!o || (!o.customized && !o.floor && !o.wallpaper)) continue;
      decor[z.id] = { items: o.customized ? o.items : null, floor: o.floor || null, wallpaper: o.wallpaper || null };
    }
    return decor;
  }

  /**
   * Cambió la decoración de alguna oficina: se rearma su nivel (colisión y asientos locales, igual que
   * el servidor) y, si es el que se está viendo, se vuelve a dibujar.
   */
  private applyDecor(offices: Record<string, OfficeView>) {
    for (const [areaId, base] of getWorld().areas) {
      if (!base.zones.some((z) => z.type === "office")) continue;
      const decor = this.decorOf(areaId, offices);
      const applied = JSON.stringify(decor);
      if (applied === (this.decorApplied.get(areaId) ?? "{}")) continue;
      let map: OfficeMap;
      try {
        const def = decorateAreaDef(base.def, decor);
        map = def === base.def ? base : buildArea(def);
      } catch (err) {
        console.error("No se pudo rearmar el nivel con la decoración", err);
        continue;
      }
      this.decorApplied.set(areaId, applied);
      this.world.areas.set(areaId, map);
      if (this.map.id === areaId) this.redrawArea(map);
    }
    this.updateGhost();
  }

  /** Vuelve a dibujar el nivel actual con otro mapa (misma área, otra decoración). */
  private redrawArea(map: OfficeMap) {
    try {
      this.showRedrawn(map);
    } catch (err) {
      this.failMap(err);
    }
  }

  private showRedrawn(map: OfficeMap) {
    this.map = map;
    setSfxArea(map);
    this.view?.destroy();
    this.view = new AreaView(this, map, useOfficeStore.getState().night);
    this.usables.setArea(map, this.view);
    this.markers.setArea(map, this.view, INTERACTABLES);
    this.weatherView.setArea(map, this.view.bounds);
    this.seasonView.setArea(map, this.view.bounds);
    this.critters.setArea(map);
    this.photoBoards.setArea(map);
    this.treeLadder.setArea(map, this.view);
      this.busView.setArea(map);
    this.aquariums.setArea(map, this.view);
    this.trophyCases.setArea(map);
    this.rods.setArea(map);
    this.observatorio.setArea(map);
    this.club.setArea(map, this.view);
    this.eventsView.setArea(map, this.view);
    this.cinema.setArea(map);
    this.pool.setArea(map, this.view, useOfficeStore.getState().weather, useOfficeStore.getState().night);
    this.tina.setArea(map, useOfficeStore.getState().night);
    this.escenario.setArea(map);
    AreaView.dropStaleBases(this, map);
    this.markMapReady();
    // La ruta en curso se recalcula: pudo aparecer un mueble en el camino.
    const goal = this.path.at(-1);
    if (goal && this.local) {
      const ts = map.tileSize;
      this.path = findPath(this.swimming ? swimMap(map) : map, { x: Math.floor(this.local.x / ts), y: Math.floor(this.local.y / ts) }, goal) ?? [];
      if (this.path.length === 0) this.clearPath();
    }
    if (this.seat) this.seat = seatAtPoint(map, this.seat.x, this.seat.y) ?? this.seat;
    this.refreshDecor();
    this.worldEditor?.refresh(true);
  }

  /**
   * Cambió un nivel con el editor de la casa (el mundo del módulo ya lo tiene): se rearma la copia de la
   * escena con la decoración de las oficinas encima y, si es el que se ve, se vuelve a dibujar.
   */
  private rebuildFromWorld(areaId: string) {
    const base = getWorld().areas.get(areaId);
    if (!base) return;
    this.decorApplied.delete(areaId);
    const decor = this.decorOf(areaId, useOfficeStore.getState().offices);
    let map: OfficeMap = base;
    try {
      const def = decorateAreaDef(base.def, decor);
      if (def !== base.def) map = buildArea(def);
    } catch (err) {
      console.error("No se pudo rearmar el nivel", err);
    }
    this.decorApplied.set(areaId, JSON.stringify(decor));
    this.world.areas.set(areaId, map);
    if (this.map?.id === areaId) this.redrawArea(map);
  }

  private handleCorrection(c: MoveCorrection) {
    this.clearPath();
    // El servidor no aceptó el movimiento (p. ej. el asiento ya estaba ocupado): quedar de pie.
    if (this.seat) {
      this.seat = null;
      this.local?.setSeated(null);
      // Si era una banqueta del blackjack o una silla de ajedrez o damas, también se sale de la mesa.
      if (this.table.kind === "blackjack" || this.table.kind === "boardgame") useOfficeStore.getState().closePanel();
    }
    const cam = this.cameras.main;
    if (c.area && c.area !== this.map.id) {
      if (this.localId) this.areaOfSession.set(this.localId, c.area);
      this.enterArea(c.area);
      this.local?.setPosition(c.x, c.y);
      this.portalTile = `${Math.floor(c.x / this.map.tileSize)},${Math.floor(c.y / this.map.tileSize)}`;
      this.arrivedAt = { x: c.x, y: c.y };
      this.updateZone();
      cam.fadeIn(FADE_MS * 1.5, 0, 0, 0);
      if (this.pendingZone) {
        const zone = this.pendingZone;
        this.time.delayedCall(FADE_MS, () => this.walkToZone(zone));
      } else if (this.pendingPerson) {
        const who = this.pendingPerson;
        this.time.delayedCall(FADE_MS, () => {
          if (this.pendingPerson === who) this.walkToPlayer(who.sessionId, who.tries);
        });
      }
    } else {
      this.local?.setPosition(c.x, c.y);
      if (this.travelling || (this.fainted && c.area)) cam.fadeIn(FADE_MS * (this.fainted ? 4 : 1), 0, 0, 0);
    }
    this.travelling = false;
    // Al despertar del desmayo el servidor me deja sentado descansando.
    if (c.seated) {
      const seat = seatAtPoint(this.map, c.x, c.y) ?? null;
      this.seat = seat;
      this.local?.setSeated(seat ? seat.facing : null, seat);
    }
    // Solo la corrección del despertar trae el nivel (las de un paso rechazado mientras tanto, no).
    if (this.fainted && c.area) {
      this.fainted = false;
      sfx.wake();
      useOfficeStore.getState().notify(WAKE_NOTICE, "info");
    }
  }

  /** Pisar un portal (puerta, escaleras): fundido a negro y se le pide el cambio al servidor. */
  private checkPortal() {
    const avatar = this.local;
    if (!avatar || this.travelling || this.seat || this.swimming) return;
    const tx = Math.floor(avatar.x / this.map.tileSize);
    const ty = Math.floor(avatar.y / this.map.tileSize);
    const key = `${tx},${ty}`;
    const ts = this.map.tileSize;
    if (this.arrivedAt && Math.hypot(avatar.x - this.arrivedAt.x, avatar.y - this.arrivedAt.y) >= ARRIVAL_CLEAR_TILES * ts) this.arrivedAt = null;
    const portal = portalAtTile(this.map, tx, ty);
    if (!portal) {
      this.portalTile = "";
      return;
    }
    if (key === this.portalTile) return;
    // Del Megabús solo se baja con el bus en la estación y las puertas abiertas (el servidor también lo valida).
    // Parado en la puerta, se baja solo en cuanto abran (el aviso sale cada tanto, no en cada cuadro).
    if (this.map.id === BUS.area && !busDoorsOpenNow()) {
      if (performance.now() - this.busNoticeAt > 5000) {
        this.busNoticeAt = performance.now();
        useOfficeStore.getState().notify(BUS_NOTICES.route, "info");
      }
      return;
    }
    // Recién llegado: el portal de vuelta no se dispara por seguir caminando, solo con un clic en él.
    if (this.arrivedAt && this.clickedPortal !== key) return;
    this.arrivedAt = null;
    this.clickedPortal = null;
    this.portalTile = key;
    // La casa del árbol llena o con la escalera recogida: ni se intenta (el servidor igual lo rechaza).
    const block = portal.to.area === CASA_ARBOL.area ? casaArbolBlockFor(selectMyUserId(useOfficeStore.getState())) : null;
    if (block) {
      useOfficeStore.getState().notify(CASA_ARBOL_BLOCK_TEXT[block], "warning");
      return;
    }
    // El estudio de grabación lleno, o pidiendo permiso o grabando (el cartel prendido): tampoco.
    const onAir = portal.to.area === PODCAST.area ? podcastBlockFor(selectMyUserId(useOfficeStore.getState())) : null;
    if (onAir) {
      useOfficeStore.getState().notify(podcastNoticeText({ code: onAir }), "warning");
      return;
    }
    this.travelling = true;
    this.path = [];
    this.pathMarker?.destroy();
    this.pathMarker = undefined;
    this.sendPosition(avatar.direction, false);
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    this.portalSound(portal.to.area);
    sendTravel(portal.id);
    // Si la respuesta se pierde (p. ej. se reinició el servidor), no quedarse en negro para siempre.
    this.time.delayedCall(TRAVEL_TIMEOUT_MS, () => {
      if (!this.travelling) return;
      this.travelling = false;
      this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
    });
  }

  /** La puerta si se entra o se sale de la casa; si no, la escalera (subiendo o bajando). */
  private portalSound(to: string) {
    const target = this.world.areas.get(to);
    if (this.map.def.outdoor || target?.def.outdoor) return sfx.door();
    sfx.stairs(LEVEL_ORDER.indexOf(to) > LEVEL_ORDER.indexOf(this.map.id));
  }

  /** Detalles vivos del nivel: humo de la chimenea de la casa. */
  /** Dónde están los personajes del nivel que se ve (para que la fauna se asuste). */
  private peopleHere(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const [id, a] of this.avatars) if (this.areaOfSession.get(id) === this.map.id) out.push({ x: a.x, y: a.y });
    return out;
  }

  private startAmbient() {
    this.ambient.forEach((t) => t.remove());
    this.ambient = [];
    // Lo que tenga chimenea: la casa del jardín (o la cabaña vieja) y las estufas de la tina y la sauna.
    const ts = this.map.tileSize;
    for (const cabin of this.map.furniture.filter((f) => Object.hasOwn(CHIMNEY_TOPS, f.type))) {
      const c = CHIMNEY_TOPS[cabin.type]!;
      this.smokeFrom(worldToScreen(cabin.x * ts + c.x / WORLD_TO_ART, cabin.y * ts + c.y / WORLD_TO_ART, c.z));
    }
  }

  /** Humo que sube de una chimenea (en pantalla). */
  private smokeFrom(top: { x: number; y: number }) {
    this.ambient.push(
      this.time.addEvent({
        delay: 700,
        loop: true,
        callback: () => {
          const size = Phaser.Math.Between(2, 4);
          const puff = this.add
            .rectangle(top.x + Phaser.Math.Between(-2, 2), top.y, size, size, 0xd8d0c8, 0.8)
            .setDepth(DEPTH_OVERLAY - 1);
          this.tweens.add({
            targets: puff,
            x: puff.x + Phaser.Math.Between(4, 12),
            y: puff.y - Phaser.Math.Between(18, 28),
            alpha: 0,
            duration: 2600,
            onComplete: () => puff.destroy(),
          });
        },
      }),
    );
  }

  // ---------- Red ----------

  private bindRoom(room: OfficeRoom) {
    // Reconstruye todo en cada (re)conexión.
    this.unbindRoom();
    this.usables.bind(room);
    this.busView.bind(room);
    this.fishing.reset();
    this.rods.destroy();
    for (const a of this.avatars.values()) a.destroy();
    this.avatars.clear();
    this.local = undefined;
    this.seat = null;
    this.pendingSeat = null;
    this.travelling = false;
    this.cameras.main.resetFX();
    // Al reconectar se sale de la mesa (la cámara vuelve a seguir al personaje nuevo).
    this.table.exit();
    if (isTablePanel(useOfficeStore.getState().panel?.kind)) useOfficeStore.getState().closePanel();
    this.localId = room.sessionId;
    this.lastSent = null;
    this.weatherKnown = false;
    this.seenMessages = useOfficeStore.getState().messages.length;

    const $ = getStateCallbacks(room);
    // Ojo: no usar sys.isActive(): durante create() la escena aún no está "activa" y
    // los jugadores existentes se notifican justo en ese momento.
    const alive = () => !this.disposed;
    this.roomDetach.push(
      $(room.state).players.onAdd((player, sessionId) => {
        if (alive()) this.addAvatar(sessionId, player, $);
      }),
      $(room.state).players.onRemove((_p, sessionId) => {
        if (!alive()) return;
        this.avatars.get(sessionId)?.destroy();
        this.avatars.delete(sessionId);
        this.rods.remove(sessionId);
        this.userOfSession.delete(sessionId);
        this.areaOfSession.delete(sessionId);
      }),
    );
  }

  private unbindRoom() {
    this.roomDetach.forEach((detach) => detach());
    this.roomDetach = [];
  }

  private addAvatar(sessionId: string, player: RemotePlayer, $: ReturnType<typeof getStateCallbacks>) {
    this.avatars.get(sessionId)?.destroy();
    const isLocal = sessionId === this.localId;
    this.userOfSession.set(sessionId, player.userId);
    this.areaOfSession.set(sessionId, player.area);
    const avatar = new Avatar(this, this.textureFor(player), player.name, player.x, player.y, isLocal);
    avatar.setStatus(player.status);
    avatar.setMotion(player.dir, false);
    avatar.setSeated(player.seated ? player.dir : null, player.seated ? seatAtPoint(this.map, player.x, player.y) : null);
    avatar.setHeld(player.held, player.heldLeft);
    avatar.setDrunk((player.drunk ?? 0) as DrunkStage);
    avatar.setRiding(Boolean(player.racing));
    avatar.setSwimming(Boolean(player.swimming));
    avatar.setWet(Boolean(player.wet));
    avatar.setBadge(player.badge ?? "");
    avatar.setNeighborLevel(player.vecino ?? 0);
    avatar.setCall(player.call ?? "");
    this.avatars.set(sessionId, avatar);

    const p$ = $(player);
    p$.listen("status", (status) => avatar.setStatus(status));
    // Cambios de personaje en vivo (el editor de la oficina), también para mí.
    p$.listen("look", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("avatar", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("name", (name) => avatar.setName(name));
    p$.listen("badge", (badge) => avatar.setBadge(badge ?? ""));
    p$.listen("vecino", (level) => avatar.setNeighborLevel(level ?? 0));
    p$.listen("held", (held) => avatar.setHeld(held, player.heldLeft));
    p$.listen("heldLeft", (left) => avatar.setHeld(player.held, left));
    p$.listen("fishing", (phase) => this.rods.set(sessionId, phase));
    p$.listen("fishingRod", (rod) => this.rods.setRod(sessionId, rod ?? ""));
    // Teléfono: el globo que vibra (le suenan) o el auricular en la mano (llamando o hablando).
    p$.listen("call", (phase) => avatar.setCall(phase ?? ""));
    // Carrera de sillas: montado en la silla; si soy yo, arranca el cronómetro.
    p$.listen("racing", (racing) => {
      avatar.setRiding(Boolean(racing));
      if (isLocal) useRaceStore.getState().setSince(racing ? Date.now() : null);
    });
    // Lo del Man del Sombrero: los ojos cambian (otra textura) y se ríe, tiembla o se marea.
    avatar.setTrip(isTripKind(player.trip) ? player.trip : "");
    p$.listen("trip", (value) => {
      const kind = isTripKind(value) ? value : "";
      avatar.setTrip(kind);
      avatar.setAppearance(this.textureFor(player));
      if (isLocal) this.setTripKind(kind);
    });
    // La piscina: nadando (medio cuerpo; si soy yo, me muevo por el agua) y mojado al salir.
    p$.listen("swimming", (value) => {
      avatar.setSwimming(Boolean(value));
      if (isLocal) this.setSwimming(Boolean(value));
    });
    p$.listen("wet", (value) => avatar.setWet(Boolean(value)));
    p$.listen("drunk", (value) => {
      const stage = (value ?? 0) as DrunkStage;
      avatar.setDrunk(stage);
      if (isLocal) this.setDrunkStage(stage);
    });
    // La energía de un plato de la cocina: mi paso va a la velocidad que acepta el servidor.
    if (isLocal) p$.listen("buff", (dish) => useCocinaStore.getState().setBuff(dish ?? ""));
    this.syncVideos();
    if (isLocal) {
      this.local = avatar;
      this.swimming = Boolean(player.swimming);
      this.setDrunkStage((player.drunk ?? 0) as DrunkStage);
      this.tripKind = isTripKind(player.trip) ? player.trip : "";
      this.tripVision.setTrip(this.tripKind);
      this.enterArea(player.area);
      // Al reconectar se conserva el asiento que el servidor recuerda.
      this.seat = player.seated ? (seatAtPoint(this.map, player.x, player.y) ?? null) : null;
      avatar.setSeated(player.seated ? player.dir : null, this.seat);
      this.portalTile = `${Math.floor(player.x / this.map.tileSize)},${Math.floor(player.y / this.map.tileSize)}`;
      this.cameras.main.startFollow(avatar.sprite, true, 0.15, 0.15);
      this.updateZone();
      return;
    }
    avatar.setHidden(player.area !== this.map.id);
    p$.onChange(() => {
      if (player.area !== this.areaOfSession.get(sessionId)) {
        this.areaOfSession.set(sessionId, player.area);
        avatar.setHidden(player.area !== this.map.id);
        avatar.setPosition(player.x, player.y);
      }
      avatar.targetX = player.x;
      avatar.targetY = player.y;
      avatar.setSeated(player.seated ? player.dir : null, player.seated ? seatAtPoint(this.map, player.x, player.y) : null);
      avatar.setMotion(player.dir, player.moving);
    });
  }

  /** Cambió mi borrachera: la visión cambia de a poco y un aviso cuenta cómo voy. */
  private setDrunkStage(stage: DrunkStage) {
    const prev = this.drunkStage;
    this.drunkStage = stage;
    this.drunkVision.setStage(stage);
    if (stage === prev) return;
    // Mareado de dar vueltas: el aviso ya salió con el giro; al pasarse, uno propio.
    if (this.dizzyOnly) {
      if (stage === 0) {
        this.dizzyOnly = false;
        useOfficeStore.getState().notify(SWIVEL_SOBER_NOTICE, "info");
      }
      return;
    }
    // Al subir se avisa cada etapa; al bajar, solo cuando se pasa del todo.
    if (stage > prev || stage === 0) useOfficeStore.getState().notify(DRUNK_NOTICE[stage], stage >= 3 ? "warning" : "info");
  }

  /** Me desmayé: se suelta todo, se vomita un rato y la pantalla se va a negro hasta que el servidor me despierta. */
  private faintLocal() {
    this.clearPath();
    this.pendingSeat = null;
    this.pendingInteract = null;
    this.pendingUse = null;
    this.pendingZone = null;
    this.pendingPerson = null;
    if (this.seat) {
      this.seat = null;
      this.local?.setSeated(null);
    }
    if (this.table.kind) useOfficeStore.getState().closePanel();
    this.fainted = true;
    this.time.delayedCall(DRUNK.vomitMs + 400, () => {
      if (this.fainted) this.cameras.main.fadeOut(1400, 0, 0, 0);
    });
  }

  // ---------- La piscina ----------

  /** Entré o salí del agua: la ruta de antes ya no sirve (el agua y el deck no se cruzan). */
  private setSwimming(on: boolean) {
    if (on === this.swimming) return;
    this.swimming = on;
    this.clearPath();
    this.pendingSeat = null;
    this.pendingInteract = null;
    this.pendingUse = null;
    this.pendingZone = null;
  }

  /** Alguien de mi nivel se tiró del trampolín: el salto, la salpicadura y el chapuzón. */
  private handleDive(e: DiveEvent) {
    const avatar = this.avatars.get(e.sessionId);
    if (!avatar || this.areaOfSession.get(e.sessionId) !== this.map.id) return;
    if (e.sessionId === this.localId) {
      this.clearPath();
      // En el aire no se ofrece nada (la ayuda vuelve al caer al agua).
      useOfficeStore.getState().setInteract(null);
    }
    avatar.diveFrom({ x: e.fromX, y: e.fromY }, { x: e.toX, y: e.toY }, AGUA.diveMs, () => {
      this.pool.splash(e.toX, e.toY);
      const me = this.local;
      const dist = me ? Math.hypot(me.x - e.toX, me.y - e.toY) : 0;
      poolSfx.splash(e.sessionId === this.localId ? 1 : Math.max(0, 1 - dist / (32 * 9)));
    });
  }

  // ---------- Brindis y sillas giratorias ----------

  /** La ayuda "B" del HUD (unas veces por segundo: mira a los de alrededor). */
  private updateToastPrompt(time: number) {
    if (time - this.toastPromptAt < 150) return;
    this.toastPromptAt = time;
    const next = this.fainted ? null : this.toasts.prompt();
    const s = useOfficeStore.getState();
    const cur = s.toastPrompt;
    if (next?.mode !== cur?.mode || next?.name !== cur?.name) s.setToastPrompt(next);
  }

  /** Pedirle al servidor un giro (él valida la silla y la pausa; mientras gira no se insiste). */
  private spinChair() {
    if (this.local?.isSpinning) return;
    sendSwivel();
  }

  /** Alguien de mi nivel gira en su silla: el giro lo ven todos; si fui yo y me mareé, un aviso. */
  private handleSwivel(e: SwivelEvent) {
    const avatar = this.avatars.get(e.sessionId);
    avatar?.spin(e.turns, e.dizzy);
    const me = this.localId ? this.avatars.get(this.localId) : undefined;
    const dist = avatar && me ? Math.hypot(avatar.x - me.x, avatar.y - me.y) : 0;
    playAnticSound("swivel-whoosh", { dist, turns: e.turns, durationMs: spinMs(e.turns) });
    if (!e.dizzy) return;
    playAnticSound("swivel-dizzy", { dist });
    if (e.sessionId !== this.localId) return;
    // Solo si no venía tomado: si ya estaba borracho, el mareo de la silla no cambia nada.
    if (this.drunkStage === 0 || this.dizzyOnly) this.dizzyOnly = true;
    useOfficeStore.getState().notify(SWIVEL_DIZZY_NOTICE[this.dizzySpins++ % SWIVEL_DIZZY_NOTICE.length]!, "info");
  }

  /** Textura del personaje (fijo o personalizado), dibujada en el navegador. */
  private textureFor(player: RemotePlayer): string {
    const trip = isTripKind(player.trip) ? player.trip : "";
    return ensureCharacterTextures(this, player.avatar, tripLook(parseLook(player.look), player.avatar, trip));
  }

  /** Cambió lo que me hizo la mercancía: la visión cambia de a poco y un aviso cuenta qué pasa. */
  private setTripKind(kind: TripKind | "") {
    if (kind === this.tripKind) return;
    this.tripKind = kind;
    this.tripVision.setTrip(kind);
    this.munchiesAt = 0;
    useOfficeStore.getState().notify(TRIP_NOTICE[kind], "info");
  }

  /** Trabado, de vez en cuando da antojo (un aviso con algo de la cafetería). */
  private updateMunchies(time: number) {
    if (this.tripKind !== "trabado") return;
    if (!this.munchiesAt) this.munchiesAt = time + 20_000;
    if (time < this.munchiesAt) return;
    this.munchiesAt = time + 35_000 + Math.random() * 25_000;
    useOfficeStore.getState().notify(MUNCHIES[Math.floor(Math.random() * MUNCHIES.length)]!, "info");
  }

  private showNewBubbles(messages: { fromId: string; text: string; ts: number }[]) {
    // Los mensajes que llegan ya vienen filtrados por el servidor (proximidad/zona).
    // El historial que llega al conectar no genera globos.
    const now = Date.now();
    for (let i = this.seenMessages; i < messages.length; i++) {
      const m = messages[i]!;
      if (now - m.ts < 10_000) this.avatars.get(m.fromId)?.say(m.text);
    }
    this.seenMessages = messages.length;
  }

  // ---------- Movimiento local ----------

  /**
   * Teclas de un toque de este frame. Se consumen siempre: Phaser escucha el teclado en window, así que
   * una "r" escrita en el chat, o la Esc que cerró un diálogo, quedaría pendiente y se dispararía al
   * volver al juego. Solo cuentan las apretadas con el juego libre (sin escribir y con el PC apagado).
   */
  private readTaps(): Taps {
    const { typing, pcOn } = useOfficeStore.getState();
    const tap = (key: Phaser.Input.Keyboard.Key) =>
      Phaser.Input.Keyboard.JustDown(key) && !typing && !pcOn && key.timeDown > this.keysFreeAt;
    const k = this.keys;
    const del = tap(k.DELETE);
    const backspace = tap(k.BACKSPACE);
    return { e: tap(k.E), r: tap(k.R), f: tap(k.F), b: tap(k.B), esc: tap(k.ESC), del: del || backspace };
  }

  private updateLocal(delta: number, taps: Taps) {
    const avatar = this.local;
    if (!avatar || this.travelling || this.fainted) return;
    const dt = delta / 1000;
    const ts = this.map.tileSize;
    if (this.fishing.busy) return this.updateFishing(avatar, delta, taps);
    // Saltando del trampolín no se maneja nada hasta caer al agua.
    if (avatar.isDiving) return;

    let vx = 0;
    let vy = 0;
    const { typing, pcOn } = useOfficeStore.getState();
    // Escribiendo en la UI o usando el PC: el teclado no mueve al personaje.
    if (!typing && !pcOn) {
      const k = this.keys;
      // Las teclas van alineadas a la pantalla: arriba = noroeste+noreste del mundo, etc.
      const up = k.W.isDown || k.UP.isDown ? 1 : 0;
      const down = k.S.isDown || k.DOWN.isDown ? 1 : 0;
      const left = k.A.isDown || k.LEFT.isDown ? 1 : 0;
      const right = k.D.isDown || k.RIGHT.isDown ? 1 : 0;
      vx = down - up + right - left;
      vy = down - up - right + left;
      // En el hockey las flechas mueven el mazo (lo lee la mesa), no al personaje.
      if (this.table.kind === "hockey") vx = vy = 0;
      // En el club, E sobre la pista baila o deja de bailar (si no hay otro objeto al lado).
      if (taps.e && !this.seat && !this.table.kind && this.club.tapE(useOfficeStore.getState().interact)) taps.e = false;
      if (taps.e) {
        // Junto al buzón, el tablón o la barra, E los abre; junto a un mueble que se usa (si le gana al
        // asiento), lo usa; si no, sienta o levanta.
        const near = useOfficeStore.getState().interact;
        if (near && !this.seat) activateInteractable(near);
        else if (this.usableNear && !this.seat && !this.table.kind) this.useFurniture(this.usableNear.f);
        else if (this.petNear && !this.seat && !this.table.kind) sendPetAction(this.petNear, "pet");
        else if (this.portionNear && !this.seat && !this.table.kind) sendPortion(this.portionNear);
        else this.toggleSeat();
      }
      // F: usar lo que se tiene en la mano (el servidor valida que haya algo y la pausa); no en la mesa.
      if (taps.f && this.local?.holding && !useOfficeStore.getState().decorating && !this.table.kind) sendUseHeld();
      const editing = useOfficeStore.getState().decorating || useOfficeStore.getState().worldEditing;
      // B: brindar (invitar o sumarse; el servidor valida la bebida, la distancia y la pausa).
      if (taps.b && !editing && !this.table.kind) sendToast();
      // R, sentado en una silla de oficina: girar (decorando, R gira el mueble elegido).
      if (taps.r && this.seat && isSwivelSeat(this.seat) && !editing && !this.table.kind) this.spinChair();
      if (useOfficeStore.getState().decorating) this.decorKeys(taps);
      if (useOfficeStore.getState().worldEditing) this.worldEditor.keys(taps);
      // Esc sale de la mesa (y del blackjack te levanta).
      if (taps.esc && this.table.kind) useOfficeStore.getState().closePanel();
      // Esc suelta el tubo o deja de bailar en la pista.
      else if (taps.esc && this.local?.isRiding) sendRaceCancel();
      else if (taps.esc && !useOfficeStore.getState().decorating && !this.cinema.esc()) this.club.esc();
    }

    if (vx !== 0 || vy !== 0) {
      // Caminar te saca de la ruleta y de mirar una partida (del blackjack y del ajedrez, al levantarte).
      if (isStandingTable(this.table.kind) || (this.table.kind === "boardgame" && !this.seat)) useOfficeStore.getState().closePanel();
      this.clearPath(); // el teclado cancela el clic-para-caminar
      this.pendingZone = null;
      this.pendingPerson = null;
      noteManualMove(); // y deja de seguir a alguien
      this.pendingInteract = null;
      this.pendingUse = null;
      if (this.seat) this.standUp(); // caminar te levanta
    } else if (this.path.length > 0) {
      const next = this.path[0]!;
      const tx = next.x * ts + ts / 2;
      const ty = next.y * ts + ts / 2;
      const dx = tx - avatar.x;
      const dy = ty - avatar.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        this.path.shift();
        if (this.path.length === 0) {
          const seat = this.pendingSeat;
          this.clearPath();
          if (seat) this.sit(seat);
          const target = this.pendingInteract;
          this.pendingInteract = null;
          if (target && this.interactableInReach() === target) activateInteractable(target);
          const use = this.pendingUse;
          this.pendingUse = null;
          if (use && this.usables.reaches(use, avatar.x, avatar.y)) this.useFurniture(use);
          this.arrivedNearPerson();
        }
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    // Mareado se camina en zigzag (misma velocidad, la dirección va de lado a lado).
    [vx, vy] = this.drunkVision.drift(this.time.now, vx, vy);
    // Con el yagé también se camina ladeado.
    [vx, vy] = this.tripVision.drift(this.time.now, vx, vy);
    // Carrera de sillas: la silla avanza sola hacia la meta (+x) con el impulso de los clics, y las teclas
    // solo cambian de carril (y del mundo).
    if (avatar.isRiding) {
      decayRace(dt);
      // Corriendo no se usa nada (ni la "E" de la salida).
      if (useOfficeStore.getState().interact) useOfficeStore.getState().setInteract(null);
      const steer = Math.sign(vy);
      const nx = avatar.x + PLAYER_SPEED * raceForwardMul() * dt;
      const ny = avatar.y + steer * PLAYER_SPEED * CHAIR_RACE.steerMul * dt;
      let x = avatar.x;
      let y = avatar.y;
      if (this.canMoveTo(nx, y)) x = nx;
      if (steer && this.canMoveTo(x, ny)) y = ny;
      avatar.setPosition(x, y);
      avatar.setMotion("right", true);
      this.updateZone();
      this.sendAccumulator += delta;
      if (this.sendAccumulator >= 1000 / MOVE_SEND_HZ) {
        this.sendAccumulator = 0;
        this.sendPosition("right", true);
      }
      return;
    }
    let moving = false;
    let dir: Direction = avatar.direction;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      // Con la energía de un plato de la cocina se camina un poco más rápido (el servidor lo acepta);
      // trabado o nadando, más despacio (el servidor usa la misma velocidad).
      const step = Math.min(PLAYER_SPEED * localSpeedMul() * this.tripVision.speedMul() * (this.swimming ? AGUA.swimSpeedMul : 1) * dt, 12);
      const nx = avatar.x + (vx / len) * step;
      const ny = avatar.y + (vy / len) * step;
      let x = avatar.x;
      let y = avatar.y;
      // Ejes por separado para deslizar a lo largo de las paredes.
      if (this.canMoveTo(nx, y)) x = nx;
      if (this.canMoveTo(x, ny)) y = ny;
      moving = x !== avatar.x || y !== avatar.y;
      if (!moving && this.path.length) this.clearPath();
      dir = facingFor(vx, vy);
      avatar.setPosition(x, y);
    }
    avatar.setMotion(dir, moving);
    if (moving) {
      this.updateZone();
      this.checkPortal();
    } else if (this.map.id === BUS.area && busDoorsOpenNow()) {
      // Quien esperaba parado en la puerta del Megabús se baja en cuanto se abre.
      this.checkPortal();
    }
    this.updateDoorPrompt();
    // Sentado, E levanta: el aviso "E" de los objetos solo aparece de pie.
    let near = this.seat ? null : this.interactableInReach();
    // Pegado a una silla libre de la mesa de ajedrez o damas, E sienta (para mirar, desde el norte o el sur).
    if (near === "boardgame" && this.local) {
      const s = this.nearestFreeSeat();
      if (s && this.isBoardSeat(s) && Math.hypot(s.x - this.local.x, s.y - this.local.y) < 1.2 * this.map.tileSize) near = null;
    }
    if (near !== useOfficeStore.getState().interact) useOfficeStore.getState().setInteract(near);
    this.updateUsable(near !== null);
    this.updateSeatPrompt();

    this.sendAccumulator += delta;
    if (this.sendAccumulator >= 1000 / MOVE_SEND_HZ) {
      this.sendAccumulator = 0;
      this.sendPosition(dir, moving);
    }
  }

  /** Pescando: el personaje queda quieto mirando al agua; E, espacio, clic y Esc manejan la caña. */
  private updateFishing(avatar: Avatar, delta: number, taps: Taps) {
    // Lo que quedaba pendiente (una ruta, un objeto al que iba) se olvida: al soltar la caña no se retoma solo.
    if (this.path.length || this.pendingInteract || this.pendingUse || this.pendingZone) {
      this.clearPath();
      this.pendingInteract = null;
      this.pendingUse = null;
      this.pendingZone = null;
      this.pendingPerson = null;
    }
    const { typing, pcOn } = useOfficeStore.getState();
    if (!typing && !pcOn) {
      const k = this.keys;
      const moving = [k.W, k.A, k.S, k.D, k.UP, k.DOWN, k.LEFT, k.RIGHT].some((key) => key.isDown);
      this.fishing.control(taps, moving);
    }
    const face = this.fishing.facing();
    if (face && face !== avatar.direction) avatar.setMotion(face, false);
    if (useOfficeStore.getState().interact) useOfficeStore.getState().setInteract(null);
    this.sendAccumulator += delta;
    if (this.sendAccumulator >= 1000 / MOVE_SEND_HZ) {
      this.sendAccumulator = 0;
      this.sendPosition(avatar.direction, false);
    }
  }

  /** Envía la posición si cambió algo desde el último envío. */
  private sendPosition(dir: Direction, moving: boolean) {
    const avatar = this.local;
    if (!avatar) return;
    const seated = this.seat !== null;
    // Sentado: la posición exacta del asiento (el servidor la compara con la del mapa).
    const round = (v: number) => (seated ? v : Math.round(v * 10) / 10);
    const msg: MoveMessage = { x: round(avatar.x), y: round(avatar.y), dir, moving: seated ? false : moving, seated };
    const last = this.lastSent;
    if (
      !last ||
      last.x !== msg.x ||
      last.y !== msg.y ||
      last.dir !== msg.dir ||
      last.moving !== msg.moving ||
      last.seated !== msg.seated
    ) {
      sendMove(msg);
      this.lastSent = msg;
    }
  }

  // ---------- Sentarse ----------

  private toggleSeat() {
    if (this.swimming) return;
    if (this.seat) {
      this.standUp();
      return;
    }
    const seat = this.nearestFreeSeat();
    if (seat) this.sit(seat);
  }

  private sit(seat: Seat) {
    const avatar = this.local;
    if (!avatar || this.swimming) return;
    const reach = SEAT_REACH_TILES * this.map.tileSize;
    if (Math.hypot(seat.x - avatar.x, seat.y - avatar.y) > reach || !this.canEnterZoneAt(seat.x, seat.y)) return;
    if (this.seatOccupied(seat)) {
      useOfficeStore.getState().notify("Ese asiento está ocupado.", "info");
      return;
    }
    this.clearPath();
    this.seat = seat;
    avatar.setPosition(seat.x, seat.y);
    avatar.setMotion(seat.facing, false);
    if (this.isBlackjackSeat(seat)) useOfficeStore.getState().openPanel("blackjack", true);
    else if (this.isBoardSeat(seat)) useOfficeStore.getState().openPanel("boardgame", true);
    avatar.setSeated(seat.facing, seat);
    this.updateZone();
    this.sendPosition(seat.facing, false);
  }

  /**
   * Abre o cierra el modo mesa según el panel del casino que se abrió (ruleta o blackjack). Solo te
   * levanta del blackjack cerrar su panel (Esc, "Levantarse" o caminar): si encima se abre otro panel
   * (la mochila, los puntos), se sale de la mesa sin levantarte y se vuelve a ella al cerrarlo.
   */
  private syncTable(kind: PanelKind | undefined, prev: PanelKind | undefined) {
    if (isTablePanel(kind) && this.local) {
      if (this.table.enter(kind, this.map, this.local, () => this.blackjackSeatIndex())) return;
      useOfficeStore.getState().closePanel(); // en este nivel no está esa mesa
      return;
    }
    if (this.table.kind) this.table.exit(this.local?.sprite);
    const seatPanel = this.seat ? (this.isBlackjackSeat(this.seat) ? "blackjack" : this.isBoardSeat(this.seat) ? "boardgame" : null) : null;
    if (kind || !seatPanel) return;
    if (prev === seatPanel) this.standUp();
    else useOfficeStore.getState().openPanel(seatPanel, true); // se cerró el otro panel: de vuelta a la mesa
  }

  /** Banqueta del blackjack donde estoy sentado (índice de BLACKJACK_SEATS), o null. */
  private blackjackSeatIndex(): number | null {
    const seat = this.seat;
    if (!seat || this.map.id !== "sotano") return null;
    const i = BLACKJACK_SEATS.findIndex((b) => b.x === seat.tileX && b.y === seat.tileY);
    return i >= 0 ? i : null;
  }

  /** ¿Es una silla de una mesa de ajedrez o de damas (BOARD_TABLES)? */
  private isBoardSeat(seat: Seat): boolean {
    return BOARD_TABLES.some((t) => t.area === this.map.id && t.seats.some((s) => s.x === seat.tileX && s.y === seat.tileY));
  }

  /** ¿Es una de las banquetas de la mesa de blackjack del sótano? */
  private isBlackjackSeat(seat: Seat): boolean {
    return this.map.id === "sotano" && BLACKJACK_SEATS.some((b) => b.x === seat.tileX && b.y === seat.tileY);
  }

  private standUp() {
    const avatar = this.local;
    const seat = this.seat;
    if (!avatar || !seat) return;
    const spot = seatStandSpot(this.map, seat);
    this.seat = null;
    avatar.setSeated(null);
    avatar.setPosition(spot.x, spot.y);
    this.portalTile = "";
    this.updateZone();
    this.sendPosition(avatar.direction, false);
    // Al final: cerrar el panel saca del modo mesa, que ya te encuentra de pie.
    const panel = useOfficeStore.getState().panel?.kind;
    if ((this.isBlackjackSeat(seat) && panel === "blackjack") || (this.isBoardSeat(seat) && panel === "boardgame")) useOfficeStore.getState().closePanel();
  }

  private seatOccupied(seat: Seat) {
    let taken = false;
    getRoom()?.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.area === this.map.id && p.seated && Math.abs(p.x - seat.x) <= 0.5 && Math.abs(p.y - seat.y) <= 0.5) {
        taken = true;
      }
    });
    return taken;
  }

  /** Asiento libre más cercano a mi alcance (para la tecla E y la ayuda en pantalla). */
  private nearestFreeSeat(): Seat | null {
    const avatar = this.local;
    if (!avatar) return null;
    let best: Seat | null = null;
    let bestDist = SEAT_REACH_TILES * this.map.tileSize;
    for (const seat of this.map.seats.values()) {
      const d = Math.hypot(seat.x - avatar.x, seat.y - avatar.y);
      if (d > bestDist || !this.canEnterZoneAt(seat.x, seat.y) || this.seatOccupied(seat)) continue;
      best = seat;
      bestDist = d;
    }
    return best;
  }

  private updateSeatPrompt() {
    const free = this.seat || this.swimming ? null : this.nearestFreeSeat();
    const prompt = this.seat ? "stand" : free && !this.usableNear && !this.petNear ? "sit" : null;
    const s = useOfficeStore.getState();
    if (prompt !== s.seatPrompt) s.setSeatPrompt(prompt);
    // En las reposeras de la piscina la ayuda dice "tomar el sol"; en la tina y la sauna, "meterse".
    const sun = Boolean((this.seat ?? free) && isSunSeat((this.seat ?? free)!.type));
    if (sun !== s.seatSun) s.setSeatSun(sun);
    const spa = this.seat ?? free ? spaKindOf((this.seat ?? free)!.type) : null;
    if (spa !== s.seatSpa) s.setSeatSpa(spa);
    const atComputer = this.seat?.computer ?? false;
    if (atComputer !== s.atComputer) s.setAtComputer(atComputer);
    const atSwivel = this.seat ? isSwivelSeat(this.seat) : false;
    if (atSwivel !== s.atSwivel) s.setAtSwivel(atSwivel);
    // Sentado en el escritorio, E levanta: el teléfono queda en un botón junto a "Encender PC".
    const atPhone = Boolean(this.seat && this.local && phoneInReach(this.map, this.local.x, this.local.y));
    if (atPhone !== s.atPhone) s.setAtPhone(atPhone);
  }

  // ---------- Clic para caminar ----------

  /**
   * Tile bajo el puntero. Si hay algo alto "encima" se prefiere eso: un asiento (sillas) o un portal
   * (clic sobre la puerta de la cabaña o una escalera lleva al tile que la usa).
   */
  private tileUnder(sx: number, sy: number): { tile: TilePos; seat?: Seat } | null {
    const ts = this.map.tileSize;
    for (const lift of [0, 6, 12]) {
      const w = screenToWorld(sx, sy + lift);
      const tile = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
      const seat = seatAtTile(this.map, tile.x, tile.y);
      if (seat) return { tile, seat };
    }
    const w = screenToWorld(sx, sy);
    const tile = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    // Solo si se hizo clic sobre algo sólido: si no, un clic en el piso junto a la salida te sacaría.
    if (isBlockedTile(this.map, tile.x, tile.y)) {
      for (let lift = 4; lift <= 48; lift += 4) {
        const l = screenToWorld(sx, sy + lift);
        const t = { x: Math.floor(l.x / ts), y: Math.floor(l.y / ts) };
        if (portalAtTile(this.map, t.x, t.y)) return { tile: t };
      }
    }
    if (tile.x < 0 || tile.y < 0 || tile.x >= this.map.width || tile.y >= this.map.height) return null;
    return { tile };
  }

  private hoverAt(sx: number, sy: number) {
    const cursor = this.hoverCursor;
    if (!cursor) return;
    if (useOfficeStore.getState().worldEditing) {
      cursor.setVisible(false);
      this.worldEditor.hoverAt(sx, sy);
      return;
    }
    if (useOfficeStore.getState().decorating) {
      cursor.setVisible(false);
      this.decorHoverAt(sx, sy);
      return;
    }
    const hit = this.tileUnder(sx, sy);
    if (!hit || (isBlockedTile(this.swimming ? swimMap(this.map) : this.map, hit.tile.x, hit.tile.y) && !hit.seat)) return cursor.setVisible(false);
    const ts = this.map.tileSize;
    const s = worldToScreen((hit.tile.x + 0.5) * ts, (hit.tile.y + 0.5) * ts);
    cursor.setPosition(s.x, s.y).setVisible(true);
  }

  private clickAt(sx: number, sy: number) {
    // Sentado en una silla de oficina, clic en mi personaje: girar (en vez de levantarme).
    if (this.seat && isSwivelSeat(this.seat) && this.local?.sprite.getBounds().contains(sx, sy)) {
      this.spinChair();
      return;
    }
    this.pendingZone = null;
    this.pendingPerson = null;
    this.pendingInteract = null;
    this.pendingUse = null;
    // Clic sobre otra persona: su perfil (sin caminar).
    // Clic sobre el Man del Sombrero: ir hasta él y hablarle al llegar.
    const man = this.local && !this.seat ? this.npcs.sombreroUnder(sx, sy) : null;
    if (man) {
      if (this.interactableInReach() === "sombrero") return activateInteractable("sombrero");
      noteManualMove();
      this.walkTo(man.x, man.y);
      this.pendingInteract = "sombrero";
      return;
    }
    const person = this.personUnder(sx, sy);
    if (person) {
      useAchievementStore.getState().openProfile(person);
      return;
    }
    const ts = this.map.tileSize;
    // Nadando, el clic solo lleva a otro lugar de la pileta.
    if (this.swimming) {
      const w = screenToWorld(sx, sy);
      noteManualMove(); // caminar a mano deja de seguir a alguien
      this.walkTo(w.x, w.y);
      return;
    }
    // Clic sobre el buzón, el tablón o la barra: caminar hasta su punto y abrirlo al llegar.
    const target = this.interactableUnder(sx, sy);
    if (target) {
      if (this.interactableInReach() === target.kind) {
        activateInteractable(target.kind);
        return;
      }
      noteManualMove();
      this.walkTo(target.x, target.y);
      this.pendingInteract = target.kind;
      return;
    }
    // Clic en un mueble que se usa: usarlo si está al alcance, o caminar hasta él y usarlo al llegar.
    const usable = this.local && !this.seat ? this.usables.under(sx, sy) : null;
    if (usable && this.local) {
      if (this.usables.reaches(usable, this.local.x, this.local.y)) return this.useFurniture(usable);
      const spot = this.usables.standSpot(usable);
      noteManualMove();
      this.walkTo(spot.x, spot.y);
      this.pendingUse = usable;
      return;
    }
    const hit = this.tileUnder(sx, sy);
    if (!hit) return;
    noteManualMove(); // clic en el suelo: caminar a mano deja de seguir a alguien
    this.walkTo((hit.tile.x + 0.5) * ts, (hit.tile.y + 0.5) * ts);
  }

  /** userId de otra persona dibujada bajo el puntero (la de más adelante si hay varias), o null. */
  private personUnder(sx: number, sy: number): string | null {
    const players = useOfficeStore.getState().players;
    let best: { userId: string; depth: number } | null = null;
    for (const [sessionId, avatar] of this.avatars) {
      if (sessionId === this.localId || !avatar.sprite.visible) continue;
      const info = players[sessionId];
      if (!info || info.area !== this.map.id) continue;
      // Solo la parte opaca del cuerpo, no el cuadro entero del frame (que es más ancho que el chibi).
      const b = avatar.sprite.getBounds();
      if (!Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(b.x + b.width * 0.25, b.y + b.height * 0.2, b.width * 0.5, b.height * 0.8), sx, sy)) continue;
      if (!best || avatar.sprite.depth > best.depth) best = { userId: info.userId, depth: avatar.sprite.depth };
    }
    return best?.userId ?? null;
  }

  /** Objeto interactivo dibujado bajo el puntero (se revisa un poco más abajo: los objetos son altos). */
  private interactableUnder(sx: number, sy: number): { kind: Interactable; x: number; y: number } | null {
    const ts = this.map.tileSize;
    for (let lift = 0; lift <= 30; lift += 4) {
      const w = screenToWorld(sx, sy + lift);
      const tx = Math.floor(w.x / ts);
      const ty = Math.floor(w.y / ts);
      // El teléfono va encima del escritorio: si el tile tiene uno, gana él.
      const onTile = this.map.furniture.filter((f) => tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.d);
      const phone = onTile.find((f) => isPhone(f.type));
      if (phone) {
        const spot = this.phoneStandSpot(phone);
        if (spot) return { kind: "phone", ...spot };
      }
      const f = onTile[0];
      const spec = f && INTERACTABLES.find((i) => i.furniture.includes(f.type));
      if (!f || !spec) continue;
      // El punto más cercano al mueble (la barra tiene dos).
      const fx = (f.x + f.w / 2) * ts;
      const fy = (f.y + f.d / 2) * ts;
      const point = pointsOfType(this.map, spec.point).sort((a, b) => Math.hypot(a.x - fx, a.y - fy) - Math.hypot(b.x - fx, b.y - fy))[0];
      if (point) return { kind: spec.kind, x: point.x, y: point.y };
    }
    return null;
  }

  /** Objeto interactivo al alcance del jugador local (o null). */
  private interactableInReach(): Interactable | null {
    const avatar = this.local;
    if (!avatar) return null;
    // El Man del Sombrero, si está en su escondite de hoy (no tiene rombito: se tiene que encontrar).
    if (this.npcs.sombreroNear(avatar.x, avatar.y, Math.min(INTERACT_REACH_TILES, SOMBRERO.reachTiles))) return "sombrero";
    // Nadando solo se ofrece salir, y solo junto al borde (el servidor usa la misma cuenta).
    if (this.swimming) return poolExitSpot(this.map, avatar.x, avatar.y, AGUA.exitReachTiles) ? "swimOut" : null;
    const reach = INTERACT_REACH_TILES * this.map.tileSize;
    for (const spec of INTERACTABLES) {
      for (const p of pointsOfType(this.map, spec.point)) {
        if (Math.hypot(p.x - avatar.x, p.y - avatar.y) <= reach) return spec.kind;
      }
    }
    // El teléfono es un mueble fijo (no un punto del mapa): se alcanza igual que lo valida el servidor.
    if (phoneInReach(this.map, avatar.x, avatar.y)) return "phone";
    // Un personaje que me dio un encargo y no tiene otro objeto al lado (el portero, la dealer).
    if (questGiverToTalk()) return "encargo";
    return null;
  }

  /** Dónde pararse para usar un teléfono: un tile libre pegado a él, del mismo lado de la pared. */
  private phoneStandSpot(f: PlacedFurniture): { x: number; y: number } | null {
    const ts = this.map.tileSize;
    const around: TilePos[] = [];
    for (let x = f.x - 1; x <= f.x + f.w; x++) around.push({ x, y: f.y + f.d }, { x, y: f.y - 1 });
    for (let y = f.y; y < f.y + f.d; y++) around.push({ x: f.x - 1, y }, { x: f.x + f.w, y });
    const me = this.local;
    const spots = around
      .filter((t) => !isBlockedTile(this.map, t.x, t.y) && phoneInReach(this.map, (t.x + 0.5) * ts, (t.y + 0.5) * ts) === f)
      .sort((a, b) => (me ? Math.hypot(a.x * ts - me.x, a.y * ts - me.y) - Math.hypot(b.x * ts - me.x, b.y * ts - me.y) : 0));
    const t = spots[0];
    return t ? { x: (t.x + 0.5) * ts, y: (t.y + 0.5) * ts } : null;
  }

  /**
   * Mueble que se usa al alcance (de pie y sin un objeto interactivo al lado). Si hay un asiento libre
   * más cerca, gana el asiento: así E sigue sentando junto a un sofá con lámpara.
   */
  private updateUsable(besideObject: boolean) {
    const avatar = this.local;
    let hit = avatar && !this.seat && !besideObject && !this.swimming ? this.usables.nearest(avatar.x, avatar.y) : null;
    const seat = hit && avatar ? this.nearestFreeSeat() : null;
    if (hit && seat && avatar && Math.hypot(seat.x - avatar.x, seat.y - avatar.y) < hit.dist + this.map.tileSize / 2) hit = null;
    this.usableNear = hit;
    // Sin mueble al lado, E acaricia a la mascota de al lado (si está más cerca que el asiento libre).
    const pet = avatar && !hit && !this.seat && !besideObject ? this.usables.petNear(avatar.x, avatar.y) : null;
    const freeSeat = pet && avatar ? this.nearestFreeSeat() : null;
    const petWins = pet && avatar && (!freeSeat || pet.dist < Math.hypot(freeSeat.x - avatar.x, freeSeat.y - avatar.y));
    this.petNear = petWins ? pet.id : null;
    // La granja: con alguien al lado que lleva un plato de la parrilla, E le pide una porción (si no hay
    // mueble ni mascota más a la mano).
    const portion = avatar && !hit && !petWins && !this.seat && !besideObject ? this.usables.portionNear() : null;
    this.portionNear = portion?.sessionId ?? null;
    const s = useOfficeStore.getState();
    const next = hit
      ? { type: hit.f.type, x: hit.f.x, y: hit.f.y, label: this.usables.label(hit.f) }
      : petWins
        ? { type: `${PET_USABLE_PREFIX}${pet.id}`, x: 0, y: 0, label: `Acariciar a ${pet.name}` }
        : portion
          ? { type: `${PORTION_USABLE_PREFIX}${portion.sessionId}`, x: 0, y: 0, label: portion.label }
          : null;
    const cur = s.usable;
    if (next?.type !== cur?.type || next?.x !== cur?.x || next?.y !== cur?.y || next?.label !== cur?.label) s.setUsable(next);
  }

  private useFurniture(f: PlacedFurniture) {
    sfx.interact();
    sendFurnitureUse(f.type, f.x, f.y);
  }

  /** "+N" dorado que sube sobre el personaje al ganar puntos. */
  private floatAward(amount: number) {
    const avatar = this.local;
    if (!avatar) return;
    sfx.coin();
    const s = worldToScreen(avatar.x, avatar.y);
    const text = this.add
      .text(s.x + 10, s.y - 34, `+${amount}`, {
        fontFamily: cozyFontFamily(),
        fontSize: "9px",
        color: "#f3d672",
        stroke: COZY.frame,
        strokeThickness: 2,
        resolution: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_OVERLAY + 10);
    this.tweens.add({ targets: text, y: text.y - 16, alpha: 0, duration: 1600, ease: "Sine.out", onComplete: () => text.destroy() });
  }

  private walkTo(worldX: number, worldY: number) {
    if (!this.local || this.travelling) return;
    const ts = this.map.tileSize;
    let goal: TilePos | null = { x: Math.floor(worldX / ts), y: Math.floor(worldY / ts) };
    // Nadando, la ruta va por el agua (y no hay sillas).
    const walkMap = this.swimming ? swimMap(this.map) : this.map;
    // Clic en una silla o sofá: caminar hasta al lado y sentarse al llegar.
    const seat = this.swimming ? undefined : seatAtTile(this.map, goal.x, goal.y);
    if (seat && seat === this.seat) return;
    if (this.seat) this.standUp();
    if (seat) {
      if (Math.hypot(seat.x - this.local.x, seat.y - this.local.y) <= ts * 1.1) {
        this.sit(seat);
        return;
      }
      const spot = seatStandSpot(this.map, seat);
      goal = { x: Math.floor(spot.x / ts), y: Math.floor(spot.y / ts) };
    }
    if (isBlockedTile(walkMap, goal.x, goal.y)) goal = nearestFreeTile(walkMap, goal);
    if (!goal) return;
    const start = { x: Math.floor(this.local.x / ts), y: Math.floor(this.local.y / ts) };
    let path = findPath(walkMap, start, goal);
    if (!path) return;
    // Si la ruta entra a una oficina cerrada sin permiso, llegar solo hasta la puerta.
    const blockedAt = path.findIndex((t) => !this.canEnterZoneAt(t.x * ts + ts / 2, t.y * ts + ts / 2));
    if (blockedAt >= 0) path = path.slice(0, blockedAt);
    if (path.length === 0) {
      if (seat) this.sit(seat);
      return;
    }
    goal = path[path.length - 1]!;
    this.path = path;
    this.clickedPortal = portalAtTile(this.map, goal.x, goal.y) ? `${goal.x},${goal.y}` : null;
    this.pendingSeat = seat ?? null;
    this.pathMarker?.destroy();
    const m = worldToScreen(goal.x * ts + ts / 2, goal.y * ts + ts / 2);
    this.pathMarker = this.add.image(m.x, m.y, "cursor-tile").setDepth(-4e5).setTint(0xffe08a);
  }

  private clearPath() {
    this.path = [];
    this.clickedPortal = null;
    this.pendingSeat = null;
    this.pathMarker?.destroy();
    this.pathMarker = undefined;
  }

  /** Camina hasta una zona; si está en otro nivel, primero hasta el portal que lleva hacia allá. */
  private walkToZone(zoneId: string) {
    const target = [...this.world.areas.values()].find((a) => a.zones.some((z) => z.id === zoneId));
    if (!target || !this.local) return;
    this.pendingPerson = null;
    const ts = this.map.tileSize;
    if (target.id === this.map.id) {
      this.pendingZone = null;
      const zone = target.zones.find((z) => z.id === zoneId)!;
      const center = zoneCenterTile(this.map, zone);
      this.walkTo(center.x * ts + ts / 2, center.y * ts + ts / 2);
      return;
    }
    if (this.walkTowardArea(target.id)) this.pendingZone = zoneId;
  }

  /**
   * Camina hasta el portal que lleva hacia `areaId` (siguiente salto por el grafo de portales, BFS entre
   * niveles). Al llegar al otro lado, `handleCorrection` retoma lo pendiente. false = no hay camino.
   */
  private walkTowardArea(areaId: string): boolean {
    const ts = this.map.tileSize;
    const prev = new Map<string, { from: string; portal: string } | null>([[this.map.id, null]]);
    const queue = [this.map.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const portal of this.world.areas.get(id)!.portals)
        if (!prev.has(portal.to.area)) {
          prev.set(portal.to.area, { from: id, portal: portal.id });
          queue.push(portal.to.area);
        }
    }
    let hop = prev.get(areaId);
    while (hop && hop.from !== this.map.id) hop = prev.get(hop.from);
    const portal = hop && this.map.portals.find((p) => p.id === hop!.portal);
    if (!portal) return false;
    const t = portal.tiles[0]!;
    this.walkTo(t.x * ts + ts / 2, t.y * ts + ts / 2);
    return true;
  }

  /**
   * Camina hasta un tile libre junto a otra persona (el más cercano a mí con ruta). Si está en otro nivel,
   * primero hasta el portal que lleva hacia allá y se sigue al llegar. Si está en una oficina cerrada donde
   * no puedo entrar, `walkTo` corta la ruta en la puerta (y ahí aparece "Tocar la puerta").
   */
  private minimapAt = 0;

  /** El minimapa (React) lee quién está en el nivel unas veces por segundo; no hace falta a cada frame. */
  private publishMinimap(time: number) {
    if (time < this.minimapAt || !this.map) return;
    this.minimapAt = time + 250;
    const players = useOfficeStore.getState().players;
    const people: MinimapPerson[] = [];
    for (const [id, a] of this.avatars) {
      if (id === this.localId || this.areaOfSession.get(id) !== this.map.id || !a.sprite.visible) continue;
      people.push({ sessionId: id, name: players[id]?.name ?? "", x: a.x, y: a.y, head: this.headFor(a) });
    }
    const me = this.local ? { x: this.local.x, y: this.local.y } : null;
    const mine = this.local ? this.headFor(this.local) : null;
    useMinimapStore.getState().publish({ map: this.map, me, people: me ? [{ sessionId: this.localId ?? "", name: "", ...me, head: mine }, ...people] : people });
  }

  private headFor(a: Avatar) {
    // La hoja de caminata (sin "-sit"/"-swim"): su frame 0 es quieto mirando al frente.
    const key = a.sprite.texture.key.replace(/-(sit|swim)$/, "");
    if (!this.textures.exists(key)) return null;
    const frame = this.textures.getFrame(key, 0);
    if (!frame) return null;
    return headOf(frame.source.image as HTMLCanvasElement, key, frame.cutX, frame.cutY, frame.cutWidth);
  }

  private walkToPlayer(sessionId: string, tries = 0) {
    if (!this.local || this.travelling || this.fainted || sessionId === this.localId) return;
    const store = useOfficeStore.getState();
    const info = store.players[sessionId];
    const area = this.areaOfSession.get(sessionId) ?? info?.area;
    if (!info || !area) {
      this.pendingPerson = null;
      store.notify("Esa persona ya no está conectada.", "info");
      return;
    }
    this.pendingZone = null;
    this.pendingInteract = null;
    this.pendingUse = null;
    if (area !== this.map.id) {
      if (this.walkTowardArea(area)) this.pendingPerson = { sessionId, tries };
      else {
        this.pendingPerson = null;
        store.notify(`No encuentro cómo llegar hasta ${info.name}.`, "warning");
      }
      return;
    }
    const other = this.avatars.get(sessionId);
    if (!other) return;
    const ts = this.map.tileSize;
    const me = { x: Math.floor(this.local.x / ts), y: Math.floor(this.local.y / ts) };
    const at = { x: Math.floor(other.x / ts), y: Math.floor(other.y / ts) };
    if (Math.max(Math.abs(me.x - at.x), Math.abs(me.y - at.y)) <= 1) {
      this.pendingPerson = null;
      return; // ya estoy a su lado
    }
    // Vecinos libres (primero los de al lado, luego a dos tiles), del más cercano a mí al más lejano.
    const spots: TilePos[] = [];
    for (const r of [1, 2])
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const t = { x: at.x + dx, y: at.y + dy };
          if (!isBlockedTile(this.map, t.x, t.y) && canStandAt(this.map, t.x * ts + ts / 2, t.y * ts + ts / 2)) spots.push(t);
        }
    const dist = (t: TilePos) => Math.hypot(t.x - me.x, t.y - me.y);
    // Los de al lado ganan a los de dos tiles; entre iguales, el más cercano a mí.
    const ring = (t: TilePos) => Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y));
    spots.sort((a, b) => ring(a) - ring(b) || dist(a) - dist(b));
    const goal = spots.find((t) => findPath(this.map, me, t)) ?? nearestFreeTile(this.map, at);
    if (!goal) return;
    this.pendingPerson = { sessionId, tries };
    if (this.seat) this.standUp();
    this.walkTo(goal.x * ts + ts / 2, goal.y * ts + ts / 2);
    // La ruta para en la puerta si está en una oficina cerrada donde no puedo entrar: avisar por qué.
    if (!this.canEnterZoneAt(goal.x * ts + ts / 2, goal.y * ts + ts / 2)) {
      this.pendingPerson = null;
      store.notify(`${info.name} está en una oficina cerrada: te llevo hasta la puerta.`, "info");
    }
  }

  /** Llegué al final de la ruta: si iba hacia alguien que se movió, lo sigo un par de veces más. */
  private arrivedNearPerson() {
    const who = this.pendingPerson;
    if (!who || !this.local) return;
    const other = this.avatars.get(who.sessionId);
    const ts = this.map.tileSize;
    // En otro nivel: esta ruta era hasta el portal; al cruzar, `handleCorrection` sigue.
    if (this.areaOfSession.get(who.sessionId) !== this.map.id) return;
    const far = !other || Math.hypot(other.x - this.local.x, other.y - this.local.y) > ts * 2.5;
    if (far && who.tries < 3) this.walkToPlayer(who.sessionId, who.tries + 1);
    else this.pendingPerson = null;
  }

  // ---------- Editor de oficina (modo decorar) ----------

  /** Mi oficina, si estoy decorando y está en el nivel que se ve. */
  private decorZone(): Zone | null {
    const s = useOfficeStore.getState();
    if (!s.decorating) return null;
    const mine = selectMyOffice(s);
    return (mine && this.map.zones.find((z) => z.id === mine.zoneId)) || null;
  }

  /** Muebles de una oficina tal como están (con los fijos y los ids que entiende el servidor). */
  private decorFurniture(zoneId: string): OfficeFurniture[] {
    const def = getWorld().areas.get(this.map.id)?.def;
    if (!def) return [];
    return officeFurniture(def, zoneId, this.decorOf(this.map.id, useOfficeStore.getState().offices)[zoneId]);
  }

  /** Misma validación que el servidor, con quienes están en el nivel (yo, donde me veo). */
  private checkDecor(zoneId: string, edit: DecorEdit): DecorEditResult {
    const def = getWorld().areas.get(this.map.id)!.def;
    const people: { x: number; y: number }[] = [];
    getRoom()?.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.area === this.map.id) people.push({ x: p.x, y: p.y });
    });
    if (this.local) people.push({ x: this.local.x, y: this.local.y });
    return applyDecorEdit({ def, decor: this.decorOf(this.map.id, useOfficeStore.getState().offices), zoneId, people }, edit);
  }

  /** Dónde caería el mueble elegido con el puntero en `tile` (centrado bajo el puntero si es grande). */
  private ghostPose(tile: TilePos): FurniturePose | null {
    const { decorPick, decorFacing } = useOfficeStore.getState();
    if (!decorPick) return null;
    const [w, d] = footprint(catalogItem(decorPick.type), decorFacing);
    return { type: decorPick.type, x: tile.x - Math.floor((w - 1) / 2), y: tile.y - Math.floor((d - 1) / 2), facing: decorFacing };
  }

  private poseEdit(pose: FurniturePose): DecorEdit {
    const pick = useOfficeStore.getState().decorPick;
    return pick?.itemId ? { action: "move", itemId: pick.itemId, ...pose } : { action: "place", ...pose };
  }

  /** Muestra u oculta la grilla del modo decorar y atenúa el mueble que se está moviendo. */
  private refreshDecor() {
    const zone = this.decorZone();
    if (!zone) {
      this.decorGrid?.destroy();
      this.decorGrid = undefined;
      this.decorHover = null;
      this.view?.dimFurniture(null);
      this.updateGhost();
      return;
    }
    const ts = this.map.tileSize;
    this.decorGrid ??= this.add.graphics().setDepth(DEPTH_FLAT + 1);
    const g = this.decorGrid.clear().lineStyle(1, DECOR_COLORS.grid, 0.35);
    const x0 = zone.x / ts;
    const y0 = zone.y / ts;
    const x1 = x0 + zone.width / ts;
    const y1 = y0 + zone.height / ts;
    for (let x = x0; x <= x1; x++) {
      const a = worldToScreen(x * ts, y0 * ts);
      const b = worldToScreen(x * ts, y1 * ts);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (let y = y0; y <= y1; y++) {
      const a = worldToScreen(x0 * ts, y * ts);
      const b = worldToScreen(x1 * ts, y * ts);
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const pick = useOfficeStore.getState().decorPick;
    const moving = pick?.itemId ? this.decorFurniture(zone.id).find((f) => f.id === pick.itemId) : undefined;
    this.view?.dimFurniture(moving ? (f) => f.type === moving.type && f.x === moving.x && f.y === moving.y && f.facing === moving.facing : null);
    this.updateGhost(true);
  }

  /** Fantasma del mueble elegido bajo el puntero: verde si se puede poner ahí, rojo si no. */
  /** Pone en la vista la noche del store (y el fantasma del editor, que también cambia de textura). */
  private applyNight() {
    this.view?.setNight(useOfficeStore.getState().night);
    this.weatherView.setNight(useOfficeStore.getState().night);
    // Los reflejos de la piscina también tienen versión de noche.
    this.pool.setNight(useOfficeStore.getState().night);
    this.tina.setNight(useOfficeStore.getState().night);
    this.updateGhost(true);
  }

  /**
   * Cambió la noche (el reloj del juego cruzó las 19:00 o las 7:00, o el botón del HUD): un velo azul
   * oscurece la pantalla, se cambian las luces por debajo y se aclara. Recién armada la vista, sin velo.
   * El velo es propio (no el fundido de la cámara) para no pisarse con el de los portales.
   */
  private changeNight() {
    if (!this.view || performance.now() - this.viewBuiltAt < 1500) {
      this.nightVeil?.destroy();
      this.nightVeil = undefined;
      return this.applyNight();
    }
    const cam = this.cameras.main;
    // Con scrollFactor 0 igual lo agranda el zoom (alrededor del centro): se hace de sobra.
    const k = 3 / Math.min(cam.zoom, 1);
    const veil = (this.nightVeil ??= this.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width * k, cam.height * k, 0x1b1633, 0)
      .setScrollFactor(0)
      .setDepth(1e9));
    this.tweens.killTweensOf(veil);
    const PEAK = 0.85;
    this.tweens.add({
      targets: veil,
      alpha: PEAK,
      duration: 500 * (1 - veil.alpha / PEAK),
      ease: "Sine.easeIn",
      onComplete: () => {
        this.applyNight();
        this.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 900,
          ease: "Sine.easeOut",
          onComplete: () => {
            veil.destroy();
            if (this.nightVeil === veil) this.nightVeil = undefined;
          },
        });
      },
    });
  }

  private updateGhost(redraw = false) {
    const zone = this.decorZone();
    const pose = zone && this.decorHover ? this.ghostPose(this.decorHover) : null;
    const ok = Boolean(zone && pose && this.checkDecor(zone.id, this.poseEdit(pose)).ok);
    const key = pose ? `${pose.type}:${pose.x},${pose.y}:${pose.facing}:${ok}` : "";
    if (redraw || !pose || this.decorGhost?.key !== key) {
      this.decorGhost?.img.destroy();
      this.decorGhost = undefined;
    }
    this.decorMarks?.clear();
    if (!zone || !pose) return;
    const ts = this.map.tileSize;
    if (!this.decorGhost) {
      const { img } = furnitureImage(this, pose, useOfficeStore.getState().night, ts, ok ? "ok" : "bad");
      // Un poco por delante de su lugar; una alfombra, sobre la grilla y la huella.
      img.setDepth(catalogItem(pose.type).flat ? DEPTH_FLAT + 3 : img.depth + 0.5).setAlpha(0.85);
      this.decorGhost = { key, img };
    }
    this.decorMarks ??= this.add.graphics().setDepth(DEPTH_FLAT + 2);
    this.decorMarks.fillStyle(ok ? DECOR_COLORS.ok : DECOR_COLORS.bad, 0.45);
    for (const t of furnitureTiles(pose)) this.decorMarks.fillPoints(tileDiamond(t.x, t.y, ts), true);
  }

  private decorHoverAt(sx: number, sy: number) {
    const ts = this.map.tileSize;
    const w = screenToWorld(sx, sy);
    const tile = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    if (this.decorHover?.x === tile.x && this.decorHover.y === tile.y) return;
    this.decorHover = tile;
    this.updateGhost();
  }

  /** Mueble de mi oficina dibujado bajo el puntero (los altos se buscan un poco más abajo, como los objetos). */
  private decorItemUnder(sx: number, sy: number, zoneId: string): OfficeFurniture | null {
    const ts = this.map.tileSize;
    const items = this.decorFurniture(zoneId);
    const at = (lift: number, flat: boolean) => {
      const w = screenToWorld(sx, sy + lift);
      const tx = Math.floor(w.x / ts);
      const ty = Math.floor(w.y / ts);
      return items.find((f) => Boolean(catalogItem(f.type).flat) === flat && furnitureTiles(f).some((t) => t.x === tx && t.y === ty));
    };
    for (let lift = 0; lift <= 30; lift += 4) {
      const f = at(lift, false);
      if (f) return f;
    }
    return at(0, true) ?? null; // las alfombras, solo si se hizo clic justo encima
  }

  /** Clic en el modo decorar: pone o mueve el mueble elegido; sin nada elegido, elige el que se tocó. */
  private decorClick(sx: number, sy: number) {
    const zone = this.decorZone();
    if (!zone) return;
    const s = useOfficeStore.getState();
    const ts = this.map.tileSize;
    const w = screenToWorld(sx, sy);
    this.decorHover = { x: Math.floor(w.x / ts), y: Math.floor(w.y / ts) };
    const pose = this.ghostPose(this.decorHover);
    if (pose) {
      const edit = this.poseEdit(pose);
      const check = this.checkDecor(zone.id, edit);
      if (!check.ok) {
        s.notify(DECOR_ERRORS[check.error], "warning");
        return;
      }
      sendOfficeEdit({ ...edit, zoneId: zone.id });
      // Movido, se suelta; uno nuevo se puede seguir poniendo mientras queden en la mochila.
      if (edit.action === "move") s.pickDecor(null);
      return;
    }
    const under = this.decorItemUnder(sx, sy, zone.id);
    if (!under) return;
    if (under.fixed) s.notify(DECOR_ERRORS.fixed, "info");
    else s.pickDecor({ type: under.type, itemId: under.id }, under.facing);
  }

  /** Teclas del modo decorar: R gira, Supr quita lo elegido y Esc lo suelta (o sale del modo). */
  private decorKeys(taps: Taps) {
    const s = useOfficeStore.getState();
    if (taps.esc) {
      // Esc gana: en el mismo frame no se gira ni se quita lo que se acaba de soltar.
      if (s.decorPick) s.pickDecor(null);
      else s.setDecorating(false);
      return;
    }
    if (taps.r && s.decorPick) s.rotateDecor();
    const pick = useOfficeStore.getState().decorPick;
    const zone = this.decorZone();
    if (taps.del && zone && pick?.itemId) {
      const check = this.checkDecor(zone.id, { action: "remove", itemId: pick.itemId });
      if (!check.ok) return s.notify(DECOR_ERRORS[check.error], "warning");
      sendOfficeEdit({ action: "remove", zoneId: zone.id, itemId: pick.itemId });
      s.pickDecor(null);
    }
  }

  // ---------- Nombres ----------

  /** El mouse salió del lienzo: nadie queda resaltado. */
  private pointerOutside = false;

  /**
   * Aplica la preferencia de nombres (completos, cortos u ocultos) y muestra completo el de quien está bajo
   * el mouse (uno solo: el de más adelante, que es el que se ve encima).
   */
  private updateNameTags() {
    const mode = useOfficeStore.getState().nameTags;
    let hovered: Avatar | null = null;
    if (!this.pointerOutside) {
      const p = this.input.activePointer;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      for (const a of this.avatars.values()) if (a.hitTest(w.x, w.y) && (!hovered || a.y > hovered.y)) hovered = a;
    }
    for (const a of this.avatars.values()) a.setNameMode(mode, a === hovered);
  }

  // ---------- Audio/video por proximidad ----------

  private positioned(area: string, x: number, y: number, zoneId: string | null, userId = ""): Positioned {
    const zone = zoneId ? this.zonesById.get(zoneId) : undefined;
    // En el anfiteatro del jardín: quien está en la tarima (o tiene la palabra) se oye en todo el anfiteatro.
    const stage = area === ESCENARIO.area ? stageRole(zoneId, userId, useEscenarioStore.getState().floor) : undefined;
    // La llamada grupal y el anuncio del admin a toda la cabaña (comunicacion.ts).
    return { area, x, y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false, ...(stage ? { stage } : {}), ...voiceFlags(userId) };
  }

  /** Teléfonos del nivel que están sonando (el de la oficina de quien recibe una llamada). */
  private ringingPhones: PlacedFurniture[] = [];

  /** Busca los teléfonos que suenan: el de la oficina de cada persona a la que le están llamando. */
  private findRingingPhones() {
    const room = getRoom();
    const offices = useOfficeStore.getState().offices;
    const ts = this.map.tileSize;
    const ringing = new Set<string>();
    room?.state.players.forEach((p) => {
      if (p.call === "ringing") ringing.add(p.userId);
    });
    const next: PlacedFurniture[] = [];
    if (ringing.size)
      for (const zone of this.map.zones) {
        const office = offices[zone.id];
        if (zone.type !== "office" || !office || !ringing.has(office.ownerId)) continue;
        for (const f of this.map.furniture)
          if (isPhone(f.type) && zoneAt(this.map, (f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts)?.id === zone.id) next.push(f);
      }
    for (const f of this.ringingPhones) if (!next.includes(f)) this.view?.nudgeFurniture(f, 0);
    this.ringingPhones = next;
  }

  /** El teléfono que suena tiembla sobre el escritorio (a ráfagas, como el timbre). */
  private shakePhones(time: number) {
    if (!this.ringingPhones.length) return;
    const on = time % 1500 < 900;
    const dx = on ? (Math.floor(time / 45) % 2 ? 1 : -1) : 0;
    const dy = on && Math.floor(time / 90) % 2 ? -1 : 0;
    for (const f of this.ringingPhones) this.view?.nudgeFurniture(f, dx, dy);
  }

  /**
   * La sala de LiveKit se abre solo si hace falta (ver media.ts): alguien cerca, un poco antes de que se
   * oiga, o una llamada (también sonando, para que al contestar ya esté lista). Lo consulta media.ts con
   * su propio reloj: el de Phaser se detiene con la pestaña oculta y la sala quedaría abierta.
   */
  private bindVoiceDemand() {
    media.setDemand(() => {
      const room = getRoom();
      if (!room || !this.local || !this.localId) return (this.voiceNear = false);
      const mine = room.state.players.get(this.localId);
      if (mine?.call && mine.callWith) return true;
      if (broadcastActive()) return true;
      const me = this.positioned(this.map.id, this.local.x, this.local.y, zoneAt(this.map, this.local.x, this.local.y)?.id ?? null);
      const others: Positioned[] = [];
      room.state.players.forEach((p, sessionId) => {
        if (sessionId !== this.localId && p.userId) others.push(this.positioned(p.area, p.x, p.y, p.zoneId || null));
      });
      this.voiceNear = voiceNearby(me, others, this.voiceNear);
      return this.voiceNear;
    });
    return () => media.setDemand(null);
  }

  private updateHearing() {
    const room = getRoom();
    if (!room || !this.local) return;
    const myUserId = selectMyUserId(useOfficeStore.getState()) ?? "";
    const me = this.positioned(this.map.id, this.local.x, this.local.y, zoneAt(this.map, this.local.x, this.local.y)?.id ?? null, myUserId);
    const others = new Map<string, Positioned>();
    room.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.userId) others.set(p.userId, this.positioned(p.area, p.x, p.y, p.zoneId || null, p.userId));
    });

    // En una llamada (lo decide el servidor: `callWith` de mi jugador), la otra persona se oye siempre.
    const mine = this.localId ? room.state.players.get(this.localId) : undefined;
    const inCall = new Set(mine?.call === "talking" && mine.callWith ? [mine.callWith] : []);
    const current = useMediaStore.getState().hearing;
    const next = hearing(me, others, new Set(Object.keys(current)), undefined, inCall);
    // Solo publicar si cambió quién se oye o algún volumen cambió de forma perceptible.
    // Quienes me oyen sin que yo los oiga (el público, si estoy en la tarima) también pueden suscribirse.
    const prevListeners = useMediaStore.getState().listeners;
    const heard = listenersOf(me, myUserId, others, new Set(prevListeners)).filter((id) => !next.has(id)).sort();
    const changed =
      next.size !== Object.keys(current).length ||
      [...next].some(([id, v]) => current[id] === undefined || Math.abs(current[id]! - v) > 0.05) ||
      heard.join(",") !== [...prevListeners].sort().join(",");
    if (changed) useMediaStore.getState().setHearing(Object.fromEntries(next), heard);
    // Alguien pudo entrar/salir de la sala: revisar las pantallas de presentación.
    this.syncScreens();
    this.findRingingPhones();
  }

  /** Cámara sobre la cabeza: la mía si la tengo encendida, y la de quienes oigo con cámara. */
  private syncVideos() {
    const m = useMediaStore.getState();
    for (const [sessionId, avatar] of this.avatars) {
      const isLocal = sessionId === this.localId;
      const userId = this.userOfSession.get(sessionId) ?? "";
      const track = isLocal
        ? m.cam
          ? media.videoTrack(null, "camera")
          : undefined
        : m.hearing[userId] !== undefined
          ? media.videoTrack(userId, "camera")
          : undefined;
      avatar.setVideo(track ?? null, {
        mirror: isLocal,
        onClick: () => useMediaStore.getState().setFocused({ identity: isLocal ? null : userId, source: "camera" }),
      });
    }
  }

  private clearScreens() {
    for (const s of this.screens.values()) {
      s.track.detach(s.el);
      s.mount.destroy();
    }
    this.screens.clear();
  }

  /** Cada frame: la pantalla compartida sigue a la tele de la pared cuando se mueve la cámara. */
  private updateScreenMounts() {
    const parent = this.game.canvas.parentElement;
    if (!parent) return;
    for (const s of this.screens.values()) s.mount.place(wallQuad(this, this.map, s.feature, SCREEN_INSET, parent), false);
  }

  /**
   * Pantalla de presentaciones de la sala: muestra la pantalla compartida de alguien que esté
   * dentro de esa sala. Solo quienes lo oyen tienen el track, así que desde afuera no se ve.
   */
  private syncScreens() {
    const room = getRoom();
    const m = useMediaStore.getState();
    const myZone = this.local ? (zoneAt(this.map, this.local.x, this.local.y)?.id ?? null) : null;
    for (const point of pointsOfType(this.map, "screen")) {
      let presenter: { identity: string | null; track: Track } | null = null;
      if (m.screen && myZone === point.zone) {
        const t = media.videoTrack(null, "screen");
        if (t) presenter = { identity: null, track: t };
      }
      room?.state.players.forEach((p, sessionId) => {
        if (presenter || sessionId === this.localId || p.zoneId !== point.zone || !m.participants[p.userId]?.screen) return;
        const t = media.videoTrack(p.userId, "screen");
        if (t) presenter = { identity: p.userId, track: t };
      });

      const current = this.screens.get(point.id);
      if (current && current.track === (presenter as { track: Track } | null)?.track) continue;
      if (current) {
        current.track.detach(current.el);
        current.mount.destroy();
        this.screens.delete(point.id);
      }
      if (!presenter) continue;
      const { identity, track } = presenter as { identity: string | null; track: Track };
      // La tele de la pared más cercana al punto de la sala.
      const feature = this.map.def.features
        .filter((f) => f.kind === "screen")
        .sort((a, b) => Math.hypot(a.x - point.tileX, a.y - point.tileY) - Math.hypot(b.x - point.tileX, b.y - point.tileY))[0];
      const parent = this.game.canvas.parentElement;
      if (!feature || !parent) continue;

      // Se ve sobre la tele, inclinada con la pared (como el video del club); un clic la abre en grande.
      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      Object.assign(el.style, { width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" } satisfies Partial<CSSStyleDeclaration>);
      const mount = new WallMount(parent, {
        onClick: () => useMediaStore.getState().setFocused({ identity, source: "screen" }),
        titles: { small: "Ver la presentación en grande", big: "" },
      });
      mount.frame.appendChild(el);
      track.attach(el);
      this.screens.set(point.id, { identity, track, el, mount, feature });
    }
  }

  private updateSpeaking(speaking: string[]) {
    const set = new Set(speaking);
    for (const [sessionId, avatar] of this.avatars) {
      avatar.setSpeaking(set.has(this.userOfSession.get(sessionId) ?? ""));
    }
  }

  /** Colisión del nivel + oficinas cerradas a las que no tengo acceso (misma regla que el servidor). */
  private canMoveTo(x: number, y: number) {
    if (this.swimming) return canSwimAt(this.map, x, y);
    return canStandAt(this.map, x, y) && this.canEnterZoneAt(x, y);
  }

  /** Oficinas cerradas: solo su dueño y los invitados pueden estar adentro. */
  private canEnterZoneAt(x: number, y: number) {
    const zone = zoneAt(this.map, x, y);
    // La tarima (dos como mucho): la misma regla que el servidor, para no chocar contra la corrección.
    if (zone && this.local && this.map.id === ESCENARIO.area) {
      const here = zoneAt(this.map, this.local.x, this.local.y)?.id;
      const inZone = (id: string) => {
        let n = 0;
        getRoom()?.state.players.forEach((p, sessionId) => {
          if (sessionId !== this.localId && p.area === ESCENARIO.area && p.zoneId === id) n++;
        });
        return n;
      };
      if (zone.id === ESCENARIO.stageZone && here !== zone.id && inZone(zone.id) >= ESCENARIO.maxOnStage) return false;
    }
    if (zone?.type !== "office") return true;
    const s = useOfficeStore.getState();
    return canEnterOffice(s.offices[zone.id], selectMyUserId(s));
  }

  private updateDoorPrompt() {
    if (!this.local) return;
    const s = useOfficeStore.getState();
    const me = selectMyUserId(s);
    let prompt: string | null = null;
    // Puerta de una oficina ajena con dueño: se le puede dejar una nota (esté cerrada o no).
    let noteDoor: string | null = null;
    for (const zone of this.map.zones) {
      if (zone.type !== "office") continue;
      const office = s.offices[zone.id];
      if (!office) continue;
      const door = officeDoor(zone);
      if (Math.hypot(door.x - this.local.x, door.y - this.local.y) >= DOOR_PROMPT_RADIUS) continue;
      if (office.ownerId && office.ownerId !== me) noteDoor ??= zone.id;
      if (!canEnterOffice(office, me)) prompt ??= zone.id;
    }
    if (prompt !== s.doorPrompt) s.setDoorPrompt(prompt);
    // Adentro de la oficina no se ofrece (la puerta queda a un paso, pero ya entraste).
    useDoorNotesStore.getState().setDoor(s.zone?.id === noteDoor ? null : noteDoor);
  }

  /** Placas con el nombre del dueño sobre la puerta de cada oficina del nivel. */
  private createNameplates() {
    for (const plate of [...this.nameplates.values(), ...this.statusPlates.values()]) plate.destroy();
    this.nameplates.clear();
    this.statusPlates.clear();
    for (const zone of this.map.zones) {
      if (zone.type !== "office" || !zone.doorEdge) continue;
      const p = worldToScreen(zone.doorEdge.x, zone.doorEdge.y, 18);
      const plate = this.add
        .text(p.x, p.y, "", {
          fontFamily: cozyFontFamily(),
          fontSize: "7px",
          color: COZY.ink,
          backgroundColor: COZY.paperLight,
          padding: { x: 3, y: 1 },
          resolution: 6,
        })
        .setOrigin(0.5, 1)
        .setDepth(4e7);
      this.nameplates.set(zone.id, plate);
      const status = this.add
        .text(p.x, p.y + 1, "", { fontFamily: cozyFontFamily(), fontSize: "6px", color: COZY.paperLight, padding: { x: 3, y: 1 }, resolution: 6 })
        .setOrigin(0.5, 0)
        .setDepth(4e7)
        .setVisible(false);
      this.statusPlates.set(zone.id, status);
    }
  }

  private updateNameplates(offices: Record<string, OfficeView>) {
    for (const [zoneId, plate] of this.nameplates) {
      const office = offices[zoneId];
      const owner = office?.ownerName;
      // Placa: crema con dueño, roja si está cerrada, apagada si está libre.
      plate.setText(owner ? `${office.locked ? "Cerrada · " : ""}${owner}` : "Libre");
      plate.setColor(office?.locked ? COZY.paperLight : owner ? COZY.ink : COZY.inkSoft);
      plate.setBackgroundColor(office?.locked ? COZY.red : owner ? COZY.paperLight : COZY.paperDark);
      const status = this.statusPlates.get(zoneId);
      const line = office ? this.doorStatus(office) : null;
      status?.setVisible(Boolean(line));
      if (line && status) status.setText(line.text).setBackgroundColor(line.color);
    }
    this.postIts.update(offices);
    this.updateDoorPrompt();
  }

  /**
   * La línea de estado de la placa: "No molestar" manda (no le llegan toques); si el dueño está en su
   * oficina con alguien, "En reunión"; si no, su estado (el modo foco lo pone en "No molestar", la sala de
   * reuniones en "En reunión"). Con la nota que dejó al lado. Sin dueño, nada.
   */
  private doorStatus(office: OfficeView): { text: string; color: string } | null {
    if (!office.ownerId) return null;
    const players = Object.values(useOfficeStore.getState().players);
    const owner = players.find((p) => p.userId === office.ownerId);
    const meeting = owner && owner.status !== "dnd" && owner.zoneId === office.zoneId && players.some((p) => p.userId !== office.ownerId && p.zoneId === office.zoneId);
    const state = !owner ? { text: "Fuera de la cabaña", color: STATUS_HEX.away } : meeting ? { text: "En reunión", color: COZY.sky } : { text: DOOR_STATUS[owner.status], color: STATUS_HEX[owner.status] };
    return { text: office.note ? `${state.text} · ${office.note}` : state.text, color: state.color };
  }

  private updateZone() {
    if (!this.local) return;
    const place = placeAt(this.map, this.local.x, this.local.y);
    if (place !== useOfficeStore.getState().place) useOfficeStore.getState().setPlace(place);
    const z = zoneAt(this.map, this.local.x, this.local.y);
    const current = useOfficeStore.getState().zone;
    if ((z?.id ?? null) === (current?.id ?? null)) return;
    useOfficeStore.getState().setZone(z ? { id: z.id, name: z.name, type: z.type, isolated: z.isolated } : null);
  }

  private defaultZoom() {
    // Un paso más lejos que antes: se ve más de la sala (la rueda acerca hasta MAX_ZOOM).
    return window.innerHeight >= 1100 ? 3 : 2;
  }
}
