import {
  canStandAt,
  findPath,
  isBlockedTile,
  nearestFreeTile,
  parseOfficeMap,
  zoneAt,
  type OfficeMap,
  type TiledMap,
  type TilePos,
} from "@hyvento/map";
import { HUMAN_AVATARS, MOVE_SEND_HZ, PLAYER_SPEED, type Direction, type MoveMessage } from "@hyvento/shared";
import Phaser from "phaser";
import { Avatar } from "./Avatar";
import { onMoveCorrection, onRoom, sendMove, type OfficeRoom, type RemotePlayer } from "./network";
import { useOfficeStore } from "./store";
import { getStateCallbacks } from "colyseus.js";

const TILE_LAYERS = ["floor", "walls", "furniture"] as const;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

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
    );
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
      if (canStandAt(this.officeMap, nx, y)) x = nx;
      if (canStandAt(this.officeMap, x, ny)) y = ny;
      moving = x !== avatar.x || y !== avatar.y;
      if (!moving && this.path.length) this.clearPath();
      dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? "right" : "left") : vy > 0 ? "down" : "up";
      avatar.setPosition(x, y);
    }
    avatar.setMotion(dir, moving);
    if (moving) this.updateZone();

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
    const path = findPath(this.officeMap, start, goal);
    if (!path || path.length === 0) return;
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
