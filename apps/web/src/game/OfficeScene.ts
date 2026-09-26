import {
  canStandAt,
  findPath,
  isBlockedTile,
  nearestFreeTile,
  officeDoor,
  parseOfficeMap,
  zoneAt,
  zoneCenterTile,
  type OfficeMap,
  type Zone,
  type TiledMap,
  type TilePos,
} from "@hyvento/map";
import { HUMAN_AVATARS, MOVE_SEND_HZ, PLAYER_SPEED, type Direction, type MoveMessage } from "@hyvento/shared";
import Phaser from "phaser";
import { Avatar } from "./Avatar";
import { onMoveCorrection, onRoom, sendMove, type OfficeRoom, type RemotePlayer } from "./network";
import { canEnterOffice, selectMyUserId, useOfficeStore, type OfficeView } from "./store";
import { getStateCallbacks } from "colyseus.js";

const TILE_LAYERS = ["floor", "walls", "furniture"] as const;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
/** Distancia (px) a la puerta de una oficina cerrada para ofrecer "tocar". */
const DOOR_PROMPT_RADIUS = 44;

type Keys = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT", Phaser.Input.Keyboard.Key>;

export class OfficeScene extends Phaser.Scene {
  private officeMap!: OfficeMap;
  private keys!: Keys;
  private avatars = new Map<string, Avatar>();
  private local?: Avatar;
  private localId: string | null = null;
  private path: TilePos[] = [];
  private pathMarker?: Phaser.GameObjects.Rectangle;
  private lastSent: MoveMessage | null = null;
  private sendAccumulator = 0;
  private seenMessages = 0;
  private officeZones: Zone[] = [];
  private nameplates = new Map<string, Phaser.GameObjects.Text>();
  private cleanups: (() => void)[] = [];

  constructor() {
    super("office");
  }

  preload() {
    this.load.tilemapTiledJSON("office", "/assets/office.json");
    this.load.image("tiles", "/assets/tileset.png");
    for (const a of HUMAN_AVATARS) {
      this.load.spritesheet(a, `/assets/characters/${a}.png`, { frameWidth: 32, frameHeight: 32 });
    }
  }

  create() {
    const tilemap = this.make.tilemap({ key: "office" });
    const tileset = tilemap.addTilesetImage("office", "tiles");
    if (!tileset) throw new Error("No se pudo cargar el tileset 'office'");
    TILE_LAYERS.forEach((name, i) => tilemap.createLayer(name, tileset, 0, 0)?.setDepth(-10 + i));

    this.officeMap = parseOfficeMap(this.cache.tilemap.get("office").data as TiledMap);
    this.officeZones = this.officeMap.zones.filter((z) => z.type === "office");
    this.createNameplates();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, tilemap.widthInPixels, tilemap.heightInPixels);
    cam.setBackgroundColor("#161824");
    cam.setZoom(this.defaultZoom());
    cam.setRoundPixels(true);

    // Sin captura: el teclado sigue funcionando en los inputs de la UI.
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT", false) as Keys;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.walkTo(p.worldX, p.worldY));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, MIN_ZOOM, MAX_ZOOM));
    });

    this.cleanups.push(
      onRoom((room) => this.bindRoom(room)),
      onMoveCorrection((c) => {
        this.path = [];
        this.local?.setPosition(c.x, c.y);
      }),
      useOfficeStore.subscribe((s) => this.showNewBubbles(s.messages)),
      useOfficeStore.subscribe((s, prev) => {
        if (s.offices !== prev.offices) this.updateNameplates(s.offices);
        if (s.walkTarget && s.walkTarget !== prev.walkTarget) this.walkToZone(s.walkTarget.zoneId);
      }),
    );
    this.updateNameplates(useOfficeStore.getState().offices);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanups.forEach((fn) => fn()));
  }

  update(_time: number, delta: number) {
    this.updateLocal(delta);
    for (const [id, avatar] of this.avatars) if (id !== this.localId) avatar.interpolate(delta);
  }

  // ---------- Red ----------

  private bindRoom(room: OfficeRoom) {
    // Reconstruye todo en cada (re)conexión.
    for (const a of this.avatars.values()) a.destroy();
    this.avatars.clear();
    this.local = undefined;
    this.localId = room.sessionId;
    this.lastSent = null;
    this.seenMessages = useOfficeStore.getState().messages.length;

    const $ = getStateCallbacks(room);
    $(room.state).players.onAdd((player, sessionId) => this.addAvatar(sessionId, player, $));
    $(room.state).players.onRemove((_p, sessionId) => {
      this.avatars.get(sessionId)?.destroy();
      this.avatars.delete(sessionId);
    });
  }

  private addAvatar(sessionId: string, player: RemotePlayer, $: ReturnType<typeof getStateCallbacks>) {
    this.avatars.get(sessionId)?.destroy();
    const isLocal = sessionId === this.localId;
    const texture = (HUMAN_AVATARS as readonly string[]).includes(player.avatar) ? player.avatar : "ada";
    const avatar = new Avatar(this, texture, player.name, player.x, player.y, isLocal);
    avatar.setStatus(player.status);
    avatar.setMotion(player.dir, false);
    this.avatars.set(sessionId, avatar);

    const p$ = $(player);
    p$.listen("status", (status) => avatar.setStatus(status));
    if (isLocal) {
      this.local = avatar;
      this.cameras.main.startFollow(avatar.sprite, true, 0.15, 0.15);
      this.updateZone();
      return;
    }
    p$.onChange(() => {
      avatar.targetX = player.x;
      avatar.targetY = player.y;
      avatar.setMotion(player.dir, player.moving);
    });
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
    if (!useOfficeStore.getState().typing) {
      const k = this.keys;
      vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }

    if (vx !== 0 || vy !== 0) {
      this.clearPath(); // el teclado cancela el clic-para-caminar
    } else if (this.path.length > 0) {
      const next = this.path[0]!;
      const tx = next.x * this.officeMap.tileSize + this.officeMap.tileSize / 2;
      const ty = next.y * this.officeMap.tileSize + this.officeMap.tileSize * 0.75;
      const dx = tx - avatar.x;
      const dy = ty - avatar.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        this.path.shift();
        if (this.path.length === 0) this.clearPath();
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

    this.sendAccumulator += delta;
    if (this.sendAccumulator >= 1000 / MOVE_SEND_HZ) {
      this.sendAccumulator = 0;
      const msg: MoveMessage = { x: Math.round(avatar.x * 10) / 10, y: Math.round(avatar.y * 10) / 10, dir, moving };
      const last = this.lastSent;
      if (!last || last.x !== msg.x || last.y !== msg.y || last.dir !== msg.dir || last.moving !== msg.moving) {
        sendMove(msg);
        this.lastSent = msg;
      }
    }
  }

  private walkTo(worldX: number, worldY: number) {
    if (!this.local) return;
    const ts = this.officeMap.tileSize;
    let goal: TilePos | null = { x: Math.floor(worldX / ts), y: Math.floor(worldY / ts) };
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
    this.pathMarker?.destroy();
    this.pathMarker = this.add
      .rectangle(goal.x * ts + ts / 2, goal.y * ts + ts / 2, ts - 6, ts - 6)
      .setStrokeStyle(2, 0xffe08a, 0.9)
      .setDepth(-1);
  }

  private clearPath() {
    this.path = [];
    this.pathMarker?.destroy();
    this.pathMarker = undefined;
  }

  /** Colisión del mapa + oficinas cerradas a las que no tengo acceso (misma regla que el servidor). */
  private canMoveTo(x: number, y: number) {
    if (!canStandAt(this.officeMap, x, y)) return false;
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
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: "10px",
          color: "#f4efe3",
          backgroundColor: "rgba(22,24,36,0.88)",
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
      plate.setText(owner ? `${office.locked ? "🔒 " : ""}${owner}` : "Libre");
      plate.setColor(office?.locked ? "#ffb4a2" : owner ? "#ffe08a" : "#8a8fa3");
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
    const z = zoneAt(this.officeMap, this.local.x, this.local.y);
    const current = useOfficeStore.getState().zone;
    if ((z?.id ?? null) === (current?.id ?? null)) return;
    useOfficeStore.getState().setZone(z ? { id: z.id, name: z.name, type: z.type, isolated: z.isolated } : null);
  }

  private defaultZoom() {
    return Phaser.Math.Clamp(Math.round((window.innerHeight / 620) * 2) / 2, MIN_ZOOM, MAX_ZOOM);
  }
}
