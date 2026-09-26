import {
  allZones,
  canStandAt,
  findPath,
  getWorld,
  isBlockedTile,
  nearestFreeTile,
  officeDoor,
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
  type OfficeMap,
  type Seat,
  type TilePos,
  type World,
  type Zone,
} from "@hyvento/map";
import { CABIN_CHIMNEY_TOP, tileCursor, WORLD_TO_ART } from "@hyvento/map/art";
import {
  hearing,
  MOVE_SEND_HZ,
  PLAYER_SPEED,
  type Direction,
  type MoveCorrection,
  type MoveMessage,
  type Positioned,
} from "@hyvento/shared";
import { getStateCallbacks } from "colyseus.js";
import { Track } from "livekit-client";
import * as Phaser from "phaser";
import { COZY, cozyFontFamily, isNightNow } from "@/lib/cozy";
import { Avatar } from "./Avatar";
import { AreaView, DEPTH_OVERLAY, ensureTexture, screenToWorld, worldToScreen } from "./iso/view";
import { ensureCharacterTextures, parseLook } from "./looks";
import { media, useMediaStore } from "./media";
import { getRoom, onMoveCorrection, onRoom, sendMove, sendTravel, type OfficeRoom, type RemotePlayer } from "./network";
import { canEnterOffice, selectMyUserId, useOfficeStore, type Interactable, type OfficeView } from "./store";

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
];
const TRAVEL_TIMEOUT_MS = 3000;

type Keys = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E", Phaser.Input.Keyboard.Key>;

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
  private ambient: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super("office");
  }

  create() {
    this.world = getWorld();
    for (const z of allZones(this.world)) this.zonesById.set(z.id, z);
    useOfficeStore.getState().setZoneNames(Object.fromEntries(allZones(this.world).map((z) => [z.id, z.name])));
    if (!useOfficeStore.getState().area) useOfficeStore.getState().setNight(isNightNow());
    // Hasta saber dónde está el jugador se muestra el jardín.
    this.map = this.world.areas.get(this.world.spawnArea)!;

    ensureTexture(this, "cursor-tile", () => tileCursor());
    this.hoverCursor = this.add.image(0, 0, "cursor-tile").setVisible(false).setDepth(-5e5);
    this.tweens.add({ targets: this.hoverCursor, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });

    const cam = this.cameras.main;
    cam.setZoom(this.defaultZoom());
    cam.setRoundPixels(true);

    // Sin captura: el teclado sigue funcionando en los inputs de la UI.
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E", false) as Keys;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!useOfficeStore.getState().pcOn) this.clickAt(p.worldX, p.worldY); // con el PC prendido no se camina
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.hoverAt(p.worldX, p.worldY));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(Math.round(cam.zoom) + (dy > 0 ? -1 : 1), MIN_ZOOM, MAX_ZOOM));
    });

    this.cleanups.push(
      onRoom((room) => this.bindRoom(room)),
      onMoveCorrection((c) => this.handleCorrection(c)),
      useOfficeStore.subscribe((s) => this.showNewBubbles(s.messages)),
      useMediaStore.subscribe((m, prev) => {
        if (m.speaking !== prev.speaking) this.updateSpeaking(m.speaking);
        if (m.trackVersion !== prev.trackVersion || m.cam !== prev.cam || m.screen !== prev.screen || m.hearing !== prev.hearing || m.participants !== prev.participants) {
          this.syncVideos();
          this.syncScreens();
        }
      }),
      useOfficeStore.subscribe((s, prev) => {
        if (s.offices !== prev.offices) this.updateNameplates(s.offices);
        if (s.walkTarget && s.walkTarget !== prev.walkTarget) this.walkToZone(s.walkTarget.zoneId);
        if (s.night !== prev.night) this.view?.setNight(s.night);
        if (s.lastAward && s.lastAward !== prev.lastAward) this.floatAward(s.lastAward.amount);
      }),
    );
    // `game.destroy()` emite DESTROY (no SHUTDOWN): hay que limpiar en ambos casos, o la escena
    // muerta seguiría suscrita a la sala siguiente y rompería sus callbacks de estado.
    const cleanup = () => {
      this.disposed = true;
      this.clearScreens();
      this.unbindRoom();
      this.cleanups.forEach((fn) => fn());
      this.cleanups = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  update(_time: number, delta: number) {
    this.updateLocal(delta);
    this.hearingElapsed += delta;
    if (this.hearingElapsed >= HEARING_INTERVAL_MS) {
      this.hearingElapsed = 0;
      this.updateHearing();
    }
    for (const [id, avatar] of this.avatars) if (id !== this.localId) avatar.interpolate(delta);
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
      this.createNameplates();
      this.clearScreens();
      this.startAmbient();
    }
    for (const [sessionId, avatar] of this.avatars) avatar.setHidden(this.areaOfSession.get(sessionId) !== map.id);
    useOfficeStore.getState().setArea(map.id);
    this.updateNameplates(useOfficeStore.getState().offices);
    this.syncScreens();
  }

  private handleCorrection(c: MoveCorrection) {
    this.clearPath();
    // El servidor no aceptó el movimiento (p. ej. el asiento ya estaba ocupado): quedar de pie.
    if (this.seat) {
      this.seat = null;
      this.local?.setSeated(null);
    }
    const cam = this.cameras.main;
    if (c.area && c.area !== this.map.id) {
      if (this.localId) this.areaOfSession.set(this.localId, c.area);
      this.enterArea(c.area);
      this.local?.setPosition(c.x, c.y);
      this.portalTile = `${Math.floor(c.x / this.map.tileSize)},${Math.floor(c.y / this.map.tileSize)}`;
      this.updateZone();
      cam.fadeIn(FADE_MS * 1.5, 0, 0, 0);
      if (this.pendingZone) {
        const zone = this.pendingZone;
        this.time.delayedCall(FADE_MS, () => this.walkToZone(zone));
      }
    } else {
      this.local?.setPosition(c.x, c.y);
      if (this.travelling) cam.fadeIn(FADE_MS, 0, 0, 0);
    }
    this.travelling = false;
  }

  /** Pisar un portal (puerta, escaleras): fundido a negro y se le pide el cambio al servidor. */
  private checkPortal() {
    const avatar = this.local;
    if (!avatar || this.travelling || this.seat) return;
    const tx = Math.floor(avatar.x / this.map.tileSize);
    const ty = Math.floor(avatar.y / this.map.tileSize);
    const key = `${tx},${ty}`;
    const portal = portalAtTile(this.map, tx, ty);
    if (!portal) {
      this.portalTile = "";
      return;
    }
    if (key === this.portalTile) return;
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

  /** Detalles vivos del nivel: humo de la chimenea de la cabaña. */
  private startAmbient() {
    this.ambient.forEach((t) => t.remove());
    this.ambient = [];
    const cabin = this.map.furniture.find((f) => f.type === "cabin");
    if (!cabin) return;
    const ts = this.map.tileSize;
    const c = CABIN_CHIMNEY_TOP;
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
    for (const a of this.avatars.values()) a.destroy();
    this.avatars.clear();
    this.local = undefined;
    this.seat = null;
    this.pendingSeat = null;
    this.travelling = false;
    this.cameras.main.resetFX();
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
    avatar.setSeated(player.seated ? player.dir : null);
    avatar.setHeld(player.held);
    this.avatars.set(sessionId, avatar);

    const p$ = $(player);
    p$.listen("status", (status) => avatar.setStatus(status));
    // Cambios de personaje en vivo (el editor de la oficina), también para mí.
    p$.listen("look", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("avatar", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("name", (name) => avatar.setName(name));
    p$.listen("held", (held) => avatar.setHeld(held));
    this.syncVideos();
    if (isLocal) {
      this.local = avatar;
      this.enterArea(player.area);
      // Al reconectar se conserva el asiento que el servidor recuerda.
      this.seat = player.seated ? (seatAtPoint(this.map, player.x, player.y) ?? null) : null;
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
      avatar.setSeated(player.seated ? player.dir : null);
      avatar.setMotion(player.dir, player.moving);
    });
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

  private updateLocal(delta: number) {
    const avatar = this.local;
    if (!avatar || this.travelling) return;
    const dt = delta / 1000;
    const ts = this.map.tileSize;

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
      if (Phaser.Input.Keyboard.JustDown(k.E)) {
        // Junto al buzón, el tablón o la barra, E los abre; si no, sienta o levanta.
        const near = useOfficeStore.getState().interact;
        if (near && !this.seat) useOfficeStore.getState().openPanel(near, true);
        else this.toggleSeat();
      }
    }

    if (vx !== 0 || vy !== 0) {
      this.clearPath(); // el teclado cancela el clic-para-caminar
      this.pendingZone = null;
      this.pendingInteract = null;
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
          if (target && this.interactableInReach() === target) useOfficeStore.getState().openPanel(target, true);
        }
      } else {
        vx = dx / dist;
        vy = dy / dist;
      }
    }

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
    this.updateSeatPrompt();
    // Sentado, E levanta: el aviso "E" de los objetos solo aparece de pie.
    const near = this.seat ? null : this.interactableInReach();
    if (near !== useOfficeStore.getState().interact) useOfficeStore.getState().setInteract(near);

    this.sendAccumulator += delta;
    if (this.sendAccumulator >= 1000 / MOVE_SEND_HZ) {
      this.sendAccumulator = 0;
      this.sendPosition(dir, moving);
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
    avatar.setSeated(seat.facing);
    this.updateZone();
    this.sendPosition(seat.facing, false);
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
    const prompt = this.seat ? "stand" : this.nearestFreeSeat() ? "sit" : null;
    const s = useOfficeStore.getState();
    if (prompt !== s.seatPrompt) s.setSeatPrompt(prompt);
    const atComputer = this.seat?.computer ?? false;
    if (atComputer !== s.atComputer) s.setAtComputer(atComputer);
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
    const hit = this.tileUnder(sx, sy);
    if (!hit || (isBlockedTile(this.map, hit.tile.x, hit.tile.y) && !hit.seat)) return cursor.setVisible(false);
    const ts = this.map.tileSize;
    const s = worldToScreen((hit.tile.x + 0.5) * ts, (hit.tile.y + 0.5) * ts);
    cursor.setPosition(s.x, s.y).setVisible(true);
  }

  private clickAt(sx: number, sy: number) {
    this.pendingZone = null;
    this.pendingInteract = null;
    const ts = this.map.tileSize;
    // Clic sobre el buzón, el tablón o la barra: caminar hasta su punto y abrirlo al llegar.
    const target = this.interactableUnder(sx, sy);
    if (target) {
      if (this.interactableInReach() === target.kind) {
        useOfficeStore.getState().openPanel(target.kind, true);
        return;
      }
      this.walkTo(target.x, target.y);
      this.pendingInteract = target.kind;
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
    this.pendingSeat = seat ?? null;
    this.pathMarker?.destroy();
    const m = worldToScreen(goal.x * ts + ts / 2, goal.y * ts + ts / 2);
    this.pathMarker = this.add.image(m.x, m.y, "cursor-tile").setDepth(-4e5).setTint(0xffe08a);
  }

  private clearPath() {
    this.path = [];
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
