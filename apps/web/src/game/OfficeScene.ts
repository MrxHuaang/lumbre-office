import {
  canStandAt,
  findPath,
  isBlockedTile,
  nearestFreeTile,
  officeDoor,
  parseOfficeMap,
  placeAt,
  pointsOfType,
  SEAT_REACH_TILES,
  seatAtPoint,
  seatAtTile,
  seatStandSpot,
  zoneAt,
  zoneCenterTile,
  type OfficeMap,
  type Seat,
  type Zone,
  type TiledMap,
  type TilePos,
} from "@hyvento/map";
import {
  hearing,
  HUMAN_AVATARS,
  MOVE_SEND_HZ,
  PLAYER_SPEED,
  type Direction,
  type MoveMessage,
  type Positioned,
} from "@hyvento/shared";
import { Track } from "livekit-client";
import * as Phaser from "phaser";
import { Avatar } from "./Avatar";
import { ensureLookTextures, parseLook } from "./looks";
import { media, useMediaStore } from "./media";
import { getRoom, onMoveCorrection, onRoom, sendMove, type OfficeRoom, type RemotePlayer } from "./network";
import { canEnterOffice, selectMyUserId, useOfficeStore, type OfficeView } from "./store";
import { getStateCallbacks } from "colyseus.js";
import { RISO, risoFontFamily } from "@/lib/riso";

const TILE_LAYERS = ["floor", "walls", "furniture"] as const;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
/** Distancia (px) a la puerta de una oficina cerrada para ofrecer "tocar". */
const DOOR_PROMPT_RADIUS = 44;
/** Cada cuánto se recalcula a quién se oye (audio/video por proximidad). */
const HEARING_INTERVAL_MS = 250;

type Keys = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "E", Phaser.Input.Keyboard.Key>;

export class OfficeScene extends Phaser.Scene {
  private officeMap!: OfficeMap;
  private keys!: Keys;
  private avatars = new Map<string, Avatar>();
  private local?: Avatar;
  private localId: string | null = null;
  private path: TilePos[] = [];
  /** Asiento en el que estoy sentado. */
  private seat: Seat | null = null;
  /** Asiento al que voy caminando (clic en una silla): al llegar me siento. */
  private pendingSeat: Seat | null = null;
  private pathMarker?: Phaser.GameObjects.Rectangle;
  private lastSent: MoveMessage | null = null;
  private sendAccumulator = 0;
  private seenMessages = 0;
  private officeZones: Zone[] = [];
  private nameplates = new Map<string, Phaser.GameObjects.Text>();
  private cleanups: (() => void)[] = [];
  private roomDetach: (() => void)[] = [];
  /** La escena fue destruida: ignorar cualquier evento tardío de la sala. */
  private disposed = false;
  private hearingElapsed = 0;
  private zonesById = new Map<string, Zone>();
  /** sessionId → userId de cada avatar (para cruzar con LiveKit, que usa userId). */
  private userOfSession = new Map<string, string>();
  /** Pantallas de presentación en la pared (punto "screen" del mapa) → video que muestran. */
  private screens = new Map<number, { identity: string | null; track: Track; el: HTMLVideoElement; dom: Phaser.GameObjects.DOMElement }>();

  constructor() {
    super("office");
  }

  preload() {
    // Sin mapa o tileset no hay nada que dibujar: mostrar el error en vez de una pantalla vacía.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === "office" || file.key === "tiles") {
        useOfficeStore.getState().setConnection("error", "No se pudo cargar el mapa de la oficina. Recarga la página.");
      }
    });
    this.load.tilemapTiledJSON("office", "/assets/office.json");
    this.load.image("tiles", "/assets/tileset.png");
    for (const a of HUMAN_AVATARS) {
      this.load.spritesheet(a, `/assets/characters/${a}.png`, { frameWidth: 32, frameHeight: 32 });
      this.load.spritesheet(`${a}-sit`, `/assets/characters/${a}-sit.png`, { frameWidth: 32, frameHeight: 32 });
    }
  }

  create() {
    const tilemap = this.make.tilemap({ key: "office" });
    const tileset = tilemap.addTilesetImage("office", "tiles");
    if (!tileset) throw new Error("No se pudo cargar el tileset 'office'");
    TILE_LAYERS.forEach((name, i) => tilemap.createLayer(name, tileset, 0, 0)?.setDepth(-10 + i));

    this.officeMap = parseOfficeMap(this.cache.tilemap.get("office").data as TiledMap);
    this.officeZones = this.officeMap.zones.filter((z) => z.type === "office");
    for (const z of this.officeMap.zones) this.zonesById.set(z.id, z);
    useOfficeStore.getState().setZoneNames(Object.fromEntries(this.officeMap.zones.map((z) => [z.id, z.name])));
    this.createNameplates();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    cam.setZoom(this.defaultZoom());
    cam.setRoundPixels(true);

    // Sin captura: el teclado sigue funcionando en los inputs de la UI.
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E", false) as Keys;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!useOfficeStore.getState().pcOn) this.walkTo(p.worldX, p.worldY); // con el PC prendido no se camina
    });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_ZOOM, MAX_ZOOM));
    });

    this.cleanups.push(
      onRoom((room) => this.bindRoom(room)),
      onMoveCorrection((c) => {
        this.clearPath();
        // El servidor no aceptó el movimiento (p. ej. el asiento ya estaba ocupado): quedar de pie.
        if (this.seat) {
          this.seat = null;
          this.local?.setSeated(null);
        }
        this.local?.setPosition(c.x, c.y);
      }),
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
      }),
    );
    this.updateNameplates(useOfficeStore.getState().offices);
    // `game.destroy()` emite DESTROY (no SHUTDOWN): hay que limpiar en ambos casos, o la escena
    // muerta seguiría suscrita a la sala siguiente y rompería sus callbacks de estado.
    const cleanup = () => {
      this.disposed = true;
      for (const s of this.screens.values()) {
        s.track.detach(s.el);
        s.dom.destroy();
      }
      this.screens.clear();
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

  // ---------- Red ----------

  private bindRoom(room: OfficeRoom) {
    // Reconstruye todo en cada (re)conexión.
    this.unbindRoom();
    for (const a of this.avatars.values()) a.destroy();
    this.avatars.clear();
    this.local = undefined;
    this.seat = null;
    this.pendingSeat = null;
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
    const avatar = new Avatar(this, this.textureFor(player), player.name, player.x, player.y, isLocal);
    avatar.setStatus(player.status);
    avatar.setMotion(player.dir, false);
    avatar.setSeated(player.seated ? seatFacing(player.dir) : null);
    this.avatars.set(sessionId, avatar);

    const p$ = $(player);
    p$.listen("status", (status) => avatar.setStatus(status));
    // Cambios de personaje en vivo (el editor de la oficina), también para mí.
    p$.listen("look", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("avatar", () => avatar.setAppearance(this.textureFor(player)));
    p$.listen("name", (name) => avatar.setName(name));
    this.syncVideos();
    if (isLocal) {
      this.local = avatar;
      // Al reconectar se conserva el asiento que el servidor recuerda.
      this.seat = player.seated ? (seatAtPoint(this.officeMap, player.x, player.y) ?? null) : null;
      this.cameras.main.startFollow(avatar.sprite, true, 0.15, 0.15);
      this.updateZone();
      return;
    }
    p$.onChange(() => {
      avatar.targetX = player.x;
      avatar.targetY = player.y;
      avatar.setSeated(player.seated ? seatFacing(player.dir) : null);
      avatar.setMotion(player.dir, player.moving);
    });
  }

  /** Textura del personaje: la del look personalizado, o la del personaje fijo. */
  private textureFor(player: RemotePlayer): string {
    const look = parseLook(player.look);
    if (look) return ensureLookTextures(this, look);
    return (HUMAN_AVATARS as readonly string[]).includes(player.avatar) ? player.avatar : "ada";
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
    if (!avatar) return;
    const dt = delta / 1000;

    let vx = 0;
    let vy = 0;
    const { typing, pcOn } = useOfficeStore.getState();
    // Escribiendo en la UI o usando el PC: el teclado no mueve al personaje.
    if (!typing && !pcOn) {
      const k = this.keys;
      vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      if (Phaser.Input.Keyboard.JustDown(k.E)) this.toggleSeat();
    }

    if (vx !== 0 || vy !== 0) {
      this.clearPath(); // el teclado cancela el clic-para-caminar
      if (this.seat) this.standUp(); // caminar te levanta
    } else if (this.path.length > 0) {
      const next = this.path[0]!;
      const tx = next.x * this.officeMap.tileSize + this.officeMap.tileSize / 2;
      const ty = next.y * this.officeMap.tileSize + this.officeMap.tileSize * 0.75;
      const dx = tx - avatar.x;
      const dy = ty - avatar.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        this.path.shift();
        if (this.path.length === 0) {
          const seat = this.pendingSeat;
          this.clearPath();
          if (seat) this.sit(seat);
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
      const step = PLAYER_SPEED * dt;
      const nx = avatar.x + (vx / len) * step;
      const ny = avatar.y + (vy / len) * step;
      let x = avatar.x;
      let y = avatar.y;
      // Ejes por separado para deslizar a lo largo de las paredes.
      if (this.canMoveTo(nx, y)) x = nx;
      if (this.canMoveTo(x, ny)) y = ny;
      moving = x !== avatar.x || y !== avatar.y;
      if (!moving && this.path.length) this.clearPath();
      dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? "right" : "left") : vy > 0 ? "down" : "up";
      avatar.setPosition(x, y);
    }
    avatar.setMotion(dir, moving);
    if (moving) this.updateZone();
    this.updateDoorPrompt();
    this.updateSeatPrompt();

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
    const reach = SEAT_REACH_TILES * this.officeMap.tileSize;
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
    const spot = seatStandSpot(this.officeMap, seat);
    this.seat = null;
    avatar.setSeated(null);
    avatar.setPosition(spot.x, spot.y);
    this.updateZone();
    this.sendPosition(avatar.direction, false);
  }

  private seatOccupied(seat: Seat) {
    let taken = false;
    getRoom()?.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.seated && Math.abs(p.x - seat.x) <= 0.5 && Math.abs(p.y - seat.y) <= 0.5) {
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
    let bestDist = SEAT_REACH_TILES * this.officeMap.tileSize;
    for (const seat of this.officeMap.seats.values()) {
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

  private walkTo(worldX: number, worldY: number) {
    if (!this.local) return;
    const ts = this.officeMap.tileSize;
    let goal: TilePos | null = { x: Math.floor(worldX / ts), y: Math.floor(worldY / ts) };
    // Clic en una silla o sofá: caminar hasta ahí y sentarse al llegar.
    const seat = seatAtTile(this.officeMap, goal.x, goal.y);
    if (seat && seat === this.seat) return;
    if (this.seat) this.standUp();
    if (seat) {
      if (Math.hypot(seat.x - this.local.x, seat.y - this.local.y) <= ts) {
        this.sit(seat);
        return;
      }
      const spot = seatStandSpot(this.officeMap, seat);
      goal = { x: Math.floor(spot.x / ts), y: Math.floor((spot.y - 1) / ts) };
    }
    if (isBlockedTile(this.officeMap, goal.x, goal.y)) goal = nearestFreeTile(this.officeMap, goal);
    if (!goal) return;
    const start = { x: Math.floor(this.local.x / ts), y: Math.floor((this.local.y - 1) / ts) };
    let path = findPath(this.officeMap, start, goal);
    if (!path) return;
    // Si la ruta entra a una oficina cerrada sin permiso, llegar solo hasta la puerta.
    const blockedAt = path.findIndex((t) => !this.canMoveTo(t.x * ts + ts / 2, t.y * ts + ts * 0.75));
    if (blockedAt >= 0) path = path.slice(0, blockedAt);
    if (path.length === 0) return;
    goal = path[path.length - 1]!;
    this.path = path;
    this.pendingSeat = seat ?? null;
    this.pathMarker?.destroy();
    this.pathMarker = this.add
      .rectangle(goal.x * ts + ts / 2, goal.y * ts + ts / 2, ts - 6, ts - 6)
      .setStrokeStyle(2, 0xffe08a, 0.9)
      .setDepth(-1);
  }

  private clearPath() {
    this.path = [];
    this.pendingSeat = null;
    this.pathMarker?.destroy();
    this.pathMarker = undefined;
  }

  // ---------- Audio/video por proximidad ----------

  private positioned(x: number, y: number, zoneId: string | null): Positioned {
    const zone = zoneId ? this.zonesById.get(zoneId) : undefined;
    return { x, y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false };
  }

  private updateHearing() {
    const room = getRoom();
    if (!room || !this.local) return;
    const me = this.positioned(this.local.x, this.local.y, zoneAt(this.officeMap, this.local.x, this.local.y)?.id ?? null);
    const others = new Map<string, Positioned>();
    room.state.players.forEach((p, sessionId) => {
      if (sessionId !== this.localId && p.userId) others.set(p.userId, this.positioned(p.x, p.y, p.zoneId || null));
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

  /** Cámara en lugar del personaje: para mí si la tengo encendida, y para quienes oigo con cámara. */
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

  /**
   * Pantalla de presentaciones de la sala: muestra la pantalla compartida de alguien que esté
   * dentro de esa sala. Solo quienes lo oyen tienen el track, así que desde afuera no se ve.
   */
  private syncScreens() {
    const room = getRoom();
    const m = useMediaStore.getState();
    const myZone = this.local ? (zoneAt(this.officeMap, this.local.x, this.local.y)?.id ?? null) : null;
    for (const point of pointsOfType(this.officeMap, "screen")) {
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

      const el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      Object.assign(el.style, {
        width: "84px",
        height: "50px",
        objectFit: "contain",
        background: "#000",
        border: `2px solid ${RISO.navy}`,
        cursor: "zoom-in",
        display: "block",
      } satisfies Partial<CSSStyleDeclaration>);
      el.title = "Ver presentación en grande";
      el.addEventListener("click", () => useMediaStore.getState().setFocused({ identity, source: "screen" }));
      track.attach(el);
      // La pizarra ocupa 2 tiles: centrar la pantalla entre ambos.
      const dom = this.add.dom(point.x + this.officeMap.tileSize / 2, point.y - 2, el).setOrigin(0.5, 0.5);
      this.screens.set(point.id, { identity, track, el, dom });
    }
  }

  private updateSpeaking(speaking: string[]) {
    const set = new Set(speaking);
    for (const [sessionId, avatar] of this.avatars) {
      avatar.setSpeaking(set.has(this.userOfSession.get(sessionId) ?? ""));
    }
  }

  /** Colisión del mapa + oficinas cerradas a las que no tengo acceso (misma regla que el servidor). */
  private canMoveTo(x: number, y: number) {
    return canStandAt(this.officeMap, x, y) && this.canEnterZoneAt(x, y);
  }

  /** Oficinas cerradas: solo su dueño y los invitados pueden estar adentro. */
  private canEnterZoneAt(x: number, y: number) {
    const zone = zoneAt(this.officeMap, x, y);
    if (zone?.type !== "office") return true;
    const s = useOfficeStore.getState();
    return canEnterOffice(s.offices[zone.id], selectMyUserId(s));
  }

  private updateDoorPrompt() {
    if (!this.local) return;
    const s = useOfficeStore.getState();
    const me = selectMyUserId(s);
    let prompt: string | null = null;
    for (const zone of this.officeZones) {
      const office = s.offices[zone.id];
      if (!office || canEnterOffice(office, me)) continue;
      const door = officeDoor(this.officeMap, zone);
      if (Math.hypot(door.x - this.local.x, door.y - this.local.y) < DOOR_PROMPT_RADIUS) {
        prompt = zone.id;
        break;
      }
    }
    if (prompt !== s.doorPrompt) s.setDoorPrompt(prompt);
  }

  private createNameplates() {
    for (const zone of this.officeZones) {
      const door = officeDoor(this.officeMap, zone);
      const plate = this.add
        .text(door.x, door.y - this.officeMap.tileSize / 2 + 1, "", {
          fontFamily: risoFontFamily(),
          fontStyle: "600",
          fontSize: "10px",
          color: RISO.navy,
          backgroundColor: RISO.paper,
          padding: { x: 5, y: 2 },
          resolution: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(50_000);
      this.nameplates.set(zone.id, plate);
    }
  }

  private updateNameplates(offices: Record<string, OfficeView>) {
    for (const [zoneId, plate] of this.nameplates) {
      const office = offices[zoneId];
      const owner = office?.ownerName;
      // Placa de la puerta: amarilla con dueño, rosa si está cerrada, papel si está libre.
      plate.setText(owner ? `${office.locked ? "🔒 " : ""}${owner}` : "Libre");
      plate.setColor(owner ? RISO.navy : RISO.muted);
      plate.setBackgroundColor(office?.locked ? RISO.pink : owner ? RISO.yellow : RISO.paper);
    }
    this.updateDoorPrompt();
  }

  private walkToZone(zoneId: string) {
    const zone = this.officeMap.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const center = zoneCenterTile(this.officeMap, zone);
    const ts = this.officeMap.tileSize;
    this.walkTo(center.x * ts + ts / 2, center.y * ts + ts / 2);
  }

  private updateZone() {
    if (!this.local) return;
    const place = placeAt(this.officeMap, this.local.x, this.local.y);
    if (place !== useOfficeStore.getState().place) useOfficeStore.getState().setPlace(place);
    const z = zoneAt(this.officeMap, this.local.x, this.local.y);
    const current = useOfficeStore.getState().zone;
    if ((z?.id ?? null) === (current?.id ?? null)) return;
    useOfficeStore.getState().setZone(z ? { id: z.id, name: z.name, type: z.type, isolated: z.isolated } : null);
  }

  private defaultZoom() {
    return Phaser.Math.Clamp(Math.round((window.innerHeight / 620) * 2) / 2, MIN_ZOOM, MAX_ZOOM);
  }
}

/** Los asientos solo miran hacia arriba o hacia abajo; cualquier otra dirección cuenta como "abajo". */
function seatFacing(dir: string): "up" | "down" {
  return dir === "up" ? "up" : "down";
}
