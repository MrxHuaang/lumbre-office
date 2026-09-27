import {
  allZones,
  BLACKJACK_SEATS,
  applyDecorEdit,
  buildArea,
  canStandAt,
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
} from "@hyvento/map";
import { CHIMNEY_TOPS, tileCursor, WORLD_TO_ART } from "@hyvento/map/art";
import {
  hearing,
  MOVE_SEND_HZ,
  PLAYER_SPEED,
  type Direction,
  type MoveCorrection,
  type MoveMessage,
  type Positioned,
  MENUS,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, isNightNow } from "@/lib/cozy";
import { Avatar } from "./Avatar";
import { AreaView, DEPTH_FLAT, DEPTH_OVERLAY, ensureTexture, furnitureImage, screenToWorld, tileDiamond, worldToScreen, type FurniturePose } from "./iso/view";
import { ensureCharacterTextures, parseLook } from "./looks";
import { media, useMediaStore } from "./media";
import {
  DECOR_ERRORS,
  activateInteractable,
  getRoom,
  onEmote,
  onFurnitureEvent,
  onHeldUsed,
  onDrunkBlackout,
  onSwivelEvent,
  onToastEvent,
  onMoveCorrection,
  onWorldEdits,
  onRoom,
  sendFurnitureUse,
  sendMove,
  sendUseHeld,
  sendSwivel,
  sendToast,
  sendOfficeEdit,
  sendTravel,
  type OfficeRoom,
  type RemotePlayer,
} from "./network";
import { canEnterOffice, selectMyOffice, selectMyUserId, useOfficeStore, type Interactable, type OfficeView, type PanelKind } from "./store";
import { TableMode } from "./table";
import { InteractMarkers } from "./markers";
import { WorldEditor } from "./worldEditor";
import { Usables, type UsableHit } from "./usables";
import { FishingController } from "./fishing/controller";
import { FishingRods } from "./fishing/rods";
import { DRUNK_NOTICE, DrunkVision, WAKE_NOTICE } from "./drunk";
import { ALCOHOL_PER_SIP, DRUNK, isSwivelSeat, spinMs, type DrunkStage, type SwivelEvent } from "@hyvento/shared";
import { playAnticSound } from "./antics-sound";
import { ToastController } from "./toasts";

/** Avisos de dar muchas vueltas en la silla (van rotando) y de cuando se pasa el mareo. */
const SWIVEL_DIZZY_NOTICE = [
  "Tantas vueltas… la oficina sigue girando un ratito.",
  "Ya ni sabes dónde quedó el PC. Mejor para un poquito.",
  "El mundo da vueltas y tú también. ¿Seguro que esto es trabajar?",
];
const SWIVEL_SOBER_NOTICE = "Se te pasó el mareo. La oficina por fin se quedó quieta.";

const MIN_ZOOM = 2;
const MAX_ZOOM = 5;
/** Distancia (px de mundo) a la puerta de una oficina cerrada para ofrecer "tocar". */
const DOOR_PROMPT_RADIUS = 44;
/** Cada cuánto se recalcula a quién se oye (audio/video por proximidad). */
const HEARING_INTERVAL_MS = 250;
const FADE_MS = 180;
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

/** Paneles del casino que se juegan en la mesa (modo mesa) en vez de en una ventana. */
const isTablePanel = (kind: PanelKind | undefined): kind is "roulette" | "blackjack" => kind === "roulette" || kind === "blackjack";

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
  /** Objeto al que voy caminando (clic en el buzón o el tablón): al llegar se abre. */
  private pendingInteract: Interactable | null = null;
  private pathMarker?: Phaser.GameObjects.Image;
  private hoverCursor?: Phaser.GameObjects.Image;
  private lastSent: MoveMessage | null = null;
  private sendAccumulator = 0;
  private seenMessages = 0;
  private nameplates = new Map<string, Phaser.GameObjects.Text>();
  private cleanups: (() => void)[] = [];
  private roomDetach: (() => void)[] = [];
  /** La escena fue destruida: ignorar cualquier evento tardío de la sala. */
  private disposed = false;
  private hearingElapsed = 0;
  private zonesById = new Map<string, Zone>();
  /** sessionId → userId y nivel de cada avatar (LiveKit usa userId). */
  private userOfSession = new Map<string, string>();
  private areaOfSession = new Map<string, string>();
  /** Pantallas de presentación en la pared (punto "screen") → video que muestran. */
  private screens = new Map<number, { identity: string | null; track: Track; el: HTMLVideoElement; dom: Phaser.GameObjects.DOMElement }>();
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
  /** Rombitos sobre lo que se puede usar (ver markers.ts). */
  private markers!: InteractMarkers;
  /** Editor de la casa (admins; ver worldEditor.ts). */
  private worldEditor!: WorldEditor;
  /** Mueble al que voy caminando (clic en la tele, el piano…): al llegar se usa. */
  private pendingUse: PlacedFurniture | null = null;
  /** Pesca: la caña y el minijuego del jugador local, y las cañas de todos. */
  private fishing!: FishingController;
  private rods!: FishingRods;
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

  constructor() {
    super("office");
  }

  create() {
    // Copia propia de la lista de niveles: la decoración de las oficinas rearma el piso 2 solo aquí.
    const base = getWorld();
    this.world = { ...base, areas: new Map(base.areas) };
    for (const z of allZones(this.world)) this.zonesById.set(z.id, z);
    useOfficeStore.getState().setZoneNames(Object.fromEntries(allZones(this.world).map((z) => [z.id, z.name])));
    if (!useOfficeStore.getState().area) useOfficeStore.getState().setNight(isNightNow());
    // Hasta saber dónde está el jugador se muestra el jardín.
    this.map = this.world.areas.get(this.world.spawnArea)!;
    // Las oficinas pueden haber llegado antes que la escena: su decoración ya se aplica.
    this.applyDecor(useOfficeStore.getState().offices);

    ensureTexture(this, "cursor-tile", () => tileCursor());
    this.hoverCursor = this.add.image(0, 0, "cursor-tile").setVisible(false).setDepth(-5e5);
    this.tweens.add({ targets: this.hoverCursor, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(this.defaultZoom());
    cam.setRoundPixels(true);

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
    this.drunkVision = new DrunkVision(() => this.game.canvas);
    this.toasts = new ToastController(this, {
      avatar: (id) => this.avatars.get(id),
      here: (id) => this.areaOfSession.get(id) === this.map.id,
      localId: () => this.localId,
      name: (id) => useOfficeStore.getState().players[id]?.name ?? "Alguien",
      present: () => [...this.areaOfSession].filter(([, area]) => area === this.map.id).map(([id]) => id),
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const s = useOfficeStore.getState();
      if (s.pcOn) return; // con el PC prendido no se camina
      if (this.fishing.pointerDown()) return; // pescando, el clic es para la caña
      if (this.table.pointerDown(p.worldX, p.worldY)) return; // en la mesa, el clic pone fichas
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
      cam.setZoom(Phaser.Math.Clamp(Math.round(cam.zoom) + (dy > 0 ? -1 : 1), MIN_ZOOM, MAX_ZOOM));
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
      () => this.usables.destroy(),
      () => this.fishing.destroy(),
      () => this.rods.destroy(),
      () => this.drunkVision.destroy(),
      () => this.toasts.destroy(),
      useOfficeStore.subscribe((s) => this.showNewBubbles(s.messages)),
      useMediaStore.subscribe((m, prev) => {
        if (m.speaking !== prev.speaking) this.updateSpeaking(m.speaking);
        if (m.trackVersion !== prev.trackVersion || m.cam !== prev.cam || m.screen !== prev.screen || m.hearing !== prev.hearing || m.participants !== prev.participants) {
          this.syncVideos();
          this.syncScreens();
        }
      }),
      useOfficeStore.subscribe((s, prev) => {
        if (s.offices !== prev.offices) {
          // Un patch trae muchos cambios seguidos (la primera edición copia ~10 muebles): se rearma una vez.
          this.decorDirty = true;
          this.updateNameplates(s.offices);
        }
        if ((prev.typing || prev.pcOn) && !s.typing && !s.pcOn) this.keysFreeAt = performance.now();
        if (s.walkTarget && s.walkTarget !== prev.walkTarget) this.walkToZone(s.walkTarget.zoneId);
        if (s.night !== prev.night) {
          this.view?.setNight(s.night);
          this.updateGhost(true); // el fantasma también cambia de textura
        }
        if (s.lastAward && s.lastAward !== prev.lastAward) this.floatAward(s.lastAward.amount);
        if (s.panel?.kind !== prev.panel?.kind) this.syncTable(s.panel?.kind, prev.panel?.kind);
        if (s.decorating !== prev.decorating || s.decorPick !== prev.decorPick || s.decorFacing !== prev.decorFacing) {
          this.refreshDecor();
        }
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
    this.markers?.update(time, this.local ? { x: this.local.x, y: this.local.y } : null, this.map?.tileSize ?? 32);
    if (this.decorDirty) {
      this.decorDirty = false;
      this.applyDecor(useOfficeStore.getState().offices);
    }
    this.updateLocal(delta, this.readTaps());
    this.table.update();
    this.table.fadeAvatars([...this.avatars.values()].map((a) => a.sprite));
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
    this.drunkVision.update(time, delta);
    this.usables.update();
    this.fishing.update(delta);
    this.rods.update();
    this.updateToastPrompt(time);
  }

  // ---------- Niveles ----------

  /** Muestra un nivel: se redibuja todo y solo se ven los avatares que están en él. */
  private enterArea(areaId: string) {
    const map = this.world.areas.get(areaId);
    if (!map) return;
    const changed = !this.view || map.id !== this.map.id;
    this.map = map;
    if (changed) {
      this.view?.destroy();
      this.view = new AreaView(this, map, useOfficeStore.getState().night);
      this.usables.setArea(map, this.view);
      this.markers.setArea(map, this.view, INTERACTABLES);
      if (!useOfficeStore.getState().mapReady) useOfficeStore.getState().setMapReady(true);
      this.rods.setArea(map);
      this.fishing.reset();
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
    this.map = map;
    this.view?.destroy();
    this.view = new AreaView(this, map, useOfficeStore.getState().night);
    this.usables.setArea(map, this.view);
    this.markers.setArea(map, this.view, INTERACTABLES);
    this.rods.setArea(map);
    AreaView.dropStaleBases(this, map);
    if (!useOfficeStore.getState().mapReady) useOfficeStore.getState().setMapReady(true);
    // La ruta en curso se recalcula: pudo aparecer un mueble en el camino.
    const goal = this.path.at(-1);
    if (goal && this.local) {
      const ts = map.tileSize;
      this.path = findPath(map, { x: Math.floor(this.local.x / ts), y: Math.floor(this.local.y / ts) }, goal) ?? [];
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
      // Si era una banqueta del blackjack, también se sale de la mesa.
      if (this.table.kind === "blackjack") useOfficeStore.getState().closePanel();
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
      useOfficeStore.getState().notify(WAKE_NOTICE, "info");
    }
  }

  /** Pisar un portal (puerta, escaleras): fundido a negro y se le pide el cambio al servidor. */
  private checkPortal() {
    const avatar = this.local;
    if (!avatar || this.travelling || this.seat) return;
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
    // Recién llegado: el portal de vuelta no se dispara por seguir caminando, solo con un clic en él.
    if (this.arrivedAt && this.clickedPortal !== key) return;
    this.arrivedAt = null;
    this.clickedPortal = null;
    this.portalTile = key;
    this.travelling = true;
    this.path = [];
    this.pathMarker?.destroy();
    this.pathMarker = undefined;
    this.sendPosition(avatar.direction, false);
    this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
    sendTravel(portal.id);
    // Si la respuesta se pierde (p. ej. se reinició el servidor), no quedarse en negro para siempre.
    this.time.delayedCall(TRAVEL_TIMEOUT_MS, () => {
      if (!this.travelling) return;
      this.travelling = false;
      this.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
    });
  }

  /** Detalles vivos del nivel: humo de la chimenea de la casa. */
  private startAmbient() {
    this.ambient.forEach((t) => t.remove());
    this.ambient = [];
    // La casa del jardín (o la cabaña vieja): la que tenga chimenea.
    const cabin = this.map.furniture.find((f) => Object.hasOwn(CHIMNEY_TOPS, f.type));
    if (!cabin) return;
    const ts = this.map.tileSize;
    const c = CHIMNEY_TOPS[cabin.type]!;
    const top = worldToScreen(cabin.x * ts + c.x / WORLD_TO_ART, cabin.y * ts + c.y / WORLD_TO_ART, c.z);
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
    this.avatars.set(sessionId, avatar);

    const p$ = $(player);
    p$.listen("status", (status) => avatar.setStatus(status));
    // Cambios de personaje en vivo (el editor de la oficina), también para mí.
    p$.listen("look", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("avatar", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("name", (name) => avatar.setName(name));
    p$.listen("held", (held) => avatar.setHeld(held, player.heldLeft));
    p$.listen("heldLeft", (left) => avatar.setHeld(player.held, left));
    p$.listen("fishing", (phase) => this.rods.set(sessionId, phase));
    p$.listen("drunk", (value) => {
      const stage = (value ?? 0) as DrunkStage;
      avatar.setDrunk(stage);
      if (isLocal) this.setDrunkStage(stage);
    });
    this.syncVideos();
    if (isLocal) {
      this.local = avatar;
      this.setDrunkStage((player.drunk ?? 0) as DrunkStage);
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
    return ensureCharacterTextures(this, player.avatar, parseLook(player.look));
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
      if (taps.e) {
        // Junto al buzón, el tablón o la barra, E los abre; junto a un mueble que se usa (si le gana al
        // asiento), lo usa; si no, sienta o levanta.
        const near = useOfficeStore.getState().interact;
        if (near && !this.seat) activateInteractable(near);
        else if (this.usableNear && !this.seat && !this.table.kind) this.useFurniture(this.usableNear.f);
        else this.toggleSeat();
      }
      // F: usar lo que se tiene en la mano (el servidor valida que haya algo y la pausa); no en la mesa.
      if (taps.f && this.local?.holding && !useOfficeStore.getState().decorating && !this.table.kind) sendUseHeld();
      const editing = useOfficeStore.getState().decorating || useOfficeStore.getState().worldEditing;
      // B: brindar (invitar o sumarse; el servidor valida la bebida, la distancia y la pausa).
      if (taps.b && !editing && !this.table.kind) sendToast();
      // R, sentado en la silla del escritorio: girar (decorando, R gira el mueble elegido).
      if (taps.r && this.seat && isSwivelSeat(this.seat) && !editing && !this.table.kind) this.spinChair();
      if (useOfficeStore.getState().decorating) this.decorKeys(taps);
      if (useOfficeStore.getState().worldEditing) this.worldEditor.keys(taps);
      // Esc sale de la mesa (y del blackjack te levanta).
      if (taps.esc && this.table.kind) useOfficeStore.getState().closePanel();
    }

    if (vx !== 0 || vy !== 0) {
      // Caminar te saca de la ruleta (del blackjack te saca al levantarte).
      if (this.table.kind === "roulette") useOfficeStore.getState().closePanel();
      this.clearPath(); // el teclado cancela el clic-para-caminar
      this.pendingZone = null;
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
        }
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

    // Mareado se camina en zigzag (misma velocidad, la dirección va de lado a lado).
    [vx, vy] = this.drunkVision.drift(this.time.now, vx, vy);
    let moving = false;
    let dir: Direction = avatar.direction;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      const step = Math.min(PLAYER_SPEED * dt, 12);
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
    }
    this.updateDoorPrompt();
    // Sentado, E levanta: el aviso "E" de los objetos solo aparece de pie.
    const near = this.seat ? null : this.interactableInReach();
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
    if (this.seat) {
      this.standUp();
      return;
    }
    const seat = this.nearestFreeSeat();
    if (seat) this.sit(seat);
  }

  private sit(seat: Seat) {
    const avatar = this.local;
    if (!avatar) return;
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
    const atBlackjack = !!this.seat && this.isBlackjackSeat(this.seat);
    if (kind || !atBlackjack) return;
    if (prev === "blackjack") this.standUp();
    else useOfficeStore.getState().openPanel("blackjack", true); // se cerró el otro panel: de vuelta a la mesa
  }

  /** Banqueta del blackjack donde estoy sentado (índice de BLACKJACK_SEATS), o null. */
  private blackjackSeatIndex(): number | null {
    const seat = this.seat;
    if (!seat || this.map.id !== "sotano") return null;
    const i = BLACKJACK_SEATS.findIndex((b) => b.x === seat.tileX && b.y === seat.tileY);
    return i >= 0 ? i : null;
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
    if (this.isBlackjackSeat(seat) && useOfficeStore.getState().panel?.kind === "blackjack") useOfficeStore.getState().closePanel();
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
    const prompt = this.seat ? "stand" : this.nearestFreeSeat() && !this.usableNear ? "sit" : null;
    const s = useOfficeStore.getState();
    if (prompt !== s.seatPrompt) s.setSeatPrompt(prompt);
    const atComputer = this.seat?.computer ?? false;
    if (atComputer !== s.atComputer) s.setAtComputer(atComputer);
    const atSwivel = this.seat ? isSwivelSeat(this.seat) : false;
    if (atSwivel !== s.atSwivel) s.setAtSwivel(atSwivel);
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
    if (!hit || (isBlockedTile(this.map, hit.tile.x, hit.tile.y) && !hit.seat)) return cursor.setVisible(false);
    const ts = this.map.tileSize;
    const s = worldToScreen((hit.tile.x + 0.5) * ts, (hit.tile.y + 0.5) * ts);
    cursor.setPosition(s.x, s.y).setVisible(true);
  }

  private clickAt(sx: number, sy: number) {
    // Sentado en la silla del escritorio, clic en mi personaje: girar (en vez de levantarme).
    if (this.seat && isSwivelSeat(this.seat) && this.local?.sprite.getBounds().contains(sx, sy)) {
      this.spinChair();
      return;
    }
    this.pendingZone = null;
    this.pendingInteract = null;
    this.pendingUse = null;
    const ts = this.map.tileSize;
    // Clic sobre el buzón, el tablón o la barra: caminar hasta su punto y abrirlo al llegar.
    const target = this.interactableUnder(sx, sy);
    if (target) {
      if (this.interactableInReach() === target.kind) {
        activateInteractable(target.kind);
        return;
      }
      this.walkTo(target.x, target.y);
      this.pendingInteract = target.kind;
      return;
    }
    // Clic en un mueble que se usa: usarlo si está al alcance, o caminar hasta él y usarlo al llegar.
    const usable = this.local && !this.seat ? this.usables.under(sx, sy) : null;
    if (usable && this.local) {
      if (this.usables.reaches(usable, this.local.x, this.local.y)) return this.useFurniture(usable);
      const spot = this.usables.standSpot(usable);
      this.walkTo(spot.x, spot.y);
      this.pendingUse = usable;
      return;
    }
    const hit = this.tileUnder(sx, sy);
    if (!hit) return;
    this.walkTo((hit.tile.x + 0.5) * ts, (hit.tile.y + 0.5) * ts);
  }

  /** Objeto interactivo dibujado bajo el puntero (se revisa un poco más abajo: los objetos son altos). */
  private interactableUnder(sx: number, sy: number): { kind: Interactable; x: number; y: number } | null {
    const ts = this.map.tileSize;
    for (let lift = 0; lift <= 30; lift += 4) {
      const w = screenToWorld(sx, sy + lift);
      const tx = Math.floor(w.x / ts);
      const ty = Math.floor(w.y / ts);
      const f = this.map.furniture.find((f) => tx >= f.x && tx < f.x + f.w && ty >= f.y && ty < f.y + f.d);
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
    const reach = INTERACT_REACH_TILES * this.map.tileSize;
    for (const spec of INTERACTABLES) {
      for (const p of pointsOfType(this.map, spec.point)) {
        if (Math.hypot(p.x - avatar.x, p.y - avatar.y) <= reach) return spec.kind;
      }
    }
    return null;
  }

  /**
   * Mueble que se usa al alcance (de pie y sin un objeto interactivo al lado). Si hay un asiento libre
   * más cerca, gana el asiento: así E sigue sentando junto a un sofá con lámpara.
   */
  private updateUsable(besideObject: boolean) {
    const avatar = this.local;
    let hit = avatar && !this.seat && !besideObject ? this.usables.nearest(avatar.x, avatar.y) : null;
    const seat = hit && avatar ? this.nearestFreeSeat() : null;
    if (hit && seat && avatar && Math.hypot(seat.x - avatar.x, seat.y - avatar.y) < hit.dist + this.map.tileSize / 2) hit = null;
    this.usableNear = hit;
    const s = useOfficeStore.getState();
    const next = hit ? { type: hit.f.type, x: hit.f.x, y: hit.f.y, label: this.usables.label(hit.f) } : null;
    const cur = s.usable;
    if (next?.type !== cur?.type || next?.x !== cur?.x || next?.y !== cur?.y || next?.label !== cur?.label) s.setUsable(next);
  }

  private useFurniture(f: PlacedFurniture) {
    sendFurnitureUse(f.type, f.x, f.y);
  }

  /** "+N" dorado que sube sobre el personaje al ganar puntos. */
  private floatAward(amount: number) {
    const avatar = this.local;
    if (!avatar) return;
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
    // Clic en una silla o sofá: caminar hasta al lado y sentarse al llegar.
    const seat = seatAtTile(this.map, goal.x, goal.y);
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
    if (isBlockedTile(this.map, goal.x, goal.y)) goal = nearestFreeTile(this.map, goal);
    if (!goal) return;
    const start = { x: Math.floor(this.local.x / ts), y: Math.floor(this.local.y / ts) };
    let path = findPath(this.map, start, goal);
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
    const ts = this.map.tileSize;
    if (target.id === this.map.id) {
      this.pendingZone = null;
      const zone = target.zones.find((z) => z.id === zoneId)!;
      const center = zoneCenterTile(this.map, zone);
      this.walkTo(center.x * ts + ts / 2, center.y * ts + ts / 2);
      return;
    }
    // Siguiente salto por el grafo de portales (BFS entre niveles).
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
    let hop = prev.get(target.id);
    while (hop && hop.from !== this.map.id) hop = prev.get(hop.from);
    const portal = hop && this.map.portals.find((p) => p.id === hop!.portal);
    if (!portal) return;
    this.pendingZone = zoneId;
    const t = portal.tiles[0]!;
    this.walkTo(t.x * ts + ts / 2, t.y * ts + ts / 2);
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

  // ---------- Audio/video por proximidad ----------

  private positioned(area: string, x: number, y: number, zoneId: string | null): Positioned {
    const zone = zoneId ? this.zonesById.get(zoneId) : undefined;
    return { area, x, y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false };
  }

  private updateHearing() {
    const room = getRoom();
    if (!room || !this.local) return;
    const me = this.positioned(this.map.id, this.local.x, this.local.y, zoneAt(this.map, this.local.x, this.local.y)?.id ?? null);
    const others = new Map<string, Positioned>();
    room.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.userId) others.set(p.userId, this.positioned(p.area, p.x, p.y, p.zoneId || null));
    });

    const current = useMediaStore.getState().hearing;
    const next = hearing(me, others, new Set(Object.keys(current)));
    // Solo publicar si cambió quién se oye o algún volumen cambió de forma perceptible.
    const changed =
      next.size !== Object.keys(current).length ||
      [...next].some(([id, v]) => current[id] === undefined || Math.abs(current[id]! - v) > 0.05);
    if (changed) useMediaStore.getState().setHearing(Object.fromEntries(next));
    // Alguien pudo entrar/salir de la sala: revisar las pantallas de presentación.
    this.syncScreens();
  }

  /** Cámara sobre la cabeza: la mía si la tengo encendida, y la de quienes oigo con cámara. */
  private syncVideos() {
    const m = useMediaStore.getState();
    for (const [sessionId, avatar] of this.avatars) {
      const isLocal = sessionId === this.localId;
      const userId = this.userOfSession.get(sessionId) ?? "";
      const track = isLocal
        ? m.cam
          ? media.videoTrack(null, Track.Source.Camera)
          : undefined
        : m.hearing[userId] !== undefined
          ? media.videoTrack(userId, Track.Source.Camera)
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
      s.dom.destroy();
    }
    this.screens.clear();
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
        const t = media.videoTrack(null, Track.Source.ScreenShare);
        if (t) presenter = { identity: null, track: t };
      }
      room?.state.players.forEach((p, sessionId) => {
        if (presenter || sessionId === this.localId || p.zoneId !== point.zone || !m.participants[p.userId]?.screen) return;
        const t = media.videoTrack(p.userId, Track.Source.ScreenShare);
        if (t) presenter = { identity: p.userId, track: t };
      });

      const current = this.screens.get(point.id);
      if (current && current.track === (presenter as { track: Track } | null)?.track) continue;
      if (current) {
        current.track.detach(current.el);
        current.dom.destroy();
        this.screens.delete(point.id);
      }
      if (!presenter) continue;
      const { identity, track } = presenter as { identity: string | null; track: Track };
      const feature = this.view?.features.find((f) => f.kind === "screen");
      if (!feature) continue;

      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      // Inclinado como la pared norte (pendiente 1:2 del isométrico) para que parezca colgado.
      Object.assign(el.style, {
        width: "40px",
        height: "21px",
        objectFit: "contain",
        background: "#000",
        cursor: "zoom-in",
        display: "block",
        transform: "skewY(26.565deg)",
      } satisfies Partial<CSSStyleDeclaration>);
      el.title = "Ver presentación en grande";
      el.addEventListener("click", () => useMediaStore.getState().setFocused({ identity, source: "screen" }));
      track.attach(el);
      const dom = this.add.dom(feature.x, feature.y, el).setOrigin(0.5, 0.5);
      this.screens.set(point.id, { identity, track, el, dom });
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
    return canStandAt(this.map, x, y) && this.canEnterZoneAt(x, y);
  }

  /** Oficinas cerradas: solo su dueño y los invitados pueden estar adentro. */
  private canEnterZoneAt(x: number, y: number) {
    const zone = zoneAt(this.map, x, y);
    if (zone?.type !== "office") return true;
    const s = useOfficeStore.getState();
    return canEnterOffice(s.offices[zone.id], selectMyUserId(s));
  }

  private updateDoorPrompt() {
    if (!this.local) return;
    const s = useOfficeStore.getState();
    const me = selectMyUserId(s);
    let prompt: string | null = null;
    for (const zone of this.map.zones) {
      if (zone.type !== "office") continue;
      const office = s.offices[zone.id];
      if (!office || canEnterOffice(office, me)) continue;
      const door = officeDoor(zone);
      if (Math.hypot(door.x - this.local.x, door.y - this.local.y) < DOOR_PROMPT_RADIUS) {
        prompt = zone.id;
        break;
      }
    }
    if (prompt !== s.doorPrompt) s.setDoorPrompt(prompt);
  }

  /** Placas con el nombre del dueño sobre la puerta de cada oficina del nivel. */
  private createNameplates() {
    for (const plate of this.nameplates.values()) plate.destroy();
    this.nameplates.clear();
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
    }
    this.updateDoorPrompt();
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
    return window.innerHeight >= 860 ? 3 : 2;
  }
}
