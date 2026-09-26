import { canStandAt, spawnPoint, zoneAt, type OfficeMap, type Zone } from "@hyvento/map";
import { loadOfficeMap } from "@hyvento/map/node";
import {
  canHear,
  ChatSendMessage,
  CLOSE_CODE,
  JoinOptions,
  MoveMessage,
  MSG,
  PLAYER_SPEED,
  StatusMessage,
  verifyGameToken,
  type ChatEvent,
  type GameTokenClaims,
  type MoveCorrection,
  type Positioned,
} from "@hyvento/shared";
import { Room, ServerError, type Client } from "colyseus";
import { randomUUID } from "node:crypto";
import { OfficeState, Player } from "../state";

interface UserData {
  lastMoveAt: number;
  chatTimes: number[];
}

const CHAT_HISTORY_SIZE = 50;
const CHAT_RATE = { max: 5, windowMs: 5_000 };
const RECONNECT_SECONDS = 15;

function gameTokenSecret() {
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) throw new Error("Falta GAME_TOKEN_SECRET en el entorno");
  return secret;
}

let sharedMap: OfficeMap | undefined;
const getMap = () => (sharedMap ??= loadOfficeMap());

export class OfficeRoom extends Room<OfficeState, unknown, UserData> {
  maxClients = 64;
  patchRate = 50; // 20 Hz

  private map!: OfficeMap;
  private zonesById = new Map<string, Zone>();
  private globalHistory: ChatEvent[] = [];

  onCreate() {
    this.map = getMap();
    for (const z of this.map.zones) this.zonesById.set(z.id, z);
    this.setState(new OfficeState());

    this.onMessage(MSG.move, (client, raw) => this.handleMove(client, raw));
    this.onMessage(MSG.chatSend, (client, raw) => this.handleChat(client, raw));
    this.onMessage(MSG.status, (client, raw) => {
      const parsed = StatusMessage.safeParse(raw);
      const player = this.state.players.get(client.sessionId);
      if (parsed.success && player) player.status = parsed.data.status;
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

  onJoin(client: Client<UserData>, _options: unknown, auth: GameTokenClaims) {
    // Una sola presencia por persona: la pestaña nueva reemplaza a la anterior.
    for (const other of this.clients) {
      if (other.sessionId !== client.sessionId && this.state.players.get(other.sessionId)?.userId === auth.sub) {
        this.state.players.delete(other.sessionId);
        other.leave(CLOSE_CODE.replaced);
      }
    }

    const spawn = spawnPoint(this.map);
    const pos = this.freeSpotNear(spawn.x, spawn.y + this.map.tileSize / 2 - 2);

    const player = new Player();
    player.userId = auth.sub;
    player.name = auth.name;
    player.avatar = auth.avatar;
    player.x = pos.x;
    player.y = pos.y;
    player.zoneId = zoneAt(this.map, pos.x, pos.y)?.id ?? "";
    this.state.players.set(client.sessionId, player);

    client.userData = { lastMoveAt: Date.now(), chatTimes: [] };
    client.send(MSG.chatHistory, this.globalHistory);
  }

  async onLeave(client: Client<UserData>, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!consented && player) {
      player.moving = false;
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        return;
      } catch {
        // no volvió a tiempo
      }
    }
    this.state.players.delete(client.sessionId);
  }

  private handleMove(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = MoveMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const { x, y, dir, moving } = parsed.data;

    const now = Date.now();
    const dt = (now - client.userData.lastMoveAt) / 1000;
    client.userData.lastMoveAt = now;
    // Tolerancia: latencia/jitter + mínimo de medio tile.
    const maxDist = Math.max(this.map.tileSize * 0.75, dt * PLAYER_SPEED * 1.6);
    const dist = Math.hypot(x - player.x, y - player.y);

    if (dist > maxDist || !canStandAt(this.map, x, y)) {
      const correction: MoveCorrection = { x: player.x, y: player.y };
      client.send(MSG.moveCorrection, correction);
      return;
    }

    player.x = x;
    player.y = y;
    player.dir = dir;
    player.moving = moving;
    player.zoneId = zoneAt(this.map, x, y)?.id ?? "";
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

  private positioned(p: Player): Positioned {
    const zone = p.zoneId ? this.zonesById.get(p.zoneId) : undefined;
    return { x: p.x, y: p.y, zoneId: zone?.id ?? null, zoneIsolated: zone?.isolated ?? false };
  }

  /** Busca un punto libre (sin muros ni otros avatares) alrededor del spawn. */
  private freeSpotNear(x: number, y: number) {
    const ts = this.map.tileSize;
    const occupied = (px: number, py: number) =>
      [...this.state.players.values()].some((p) => Math.hypot(p.x - px, p.y - py) < ts * 0.6);
    for (let attempt = 0; attempt < 30; attempt++) {
      const ox = attempt === 0 ? 0 : Math.round((Math.random() - 0.5) * ts * 5);
      const oy = attempt === 0 ? 0 : Math.round((Math.random() - 0.5) * ts * 1.5);
      if (canStandAt(this.map, x + ox, y + oy) && !occupied(x + ox, y + oy)) return { x: x + ox, y: y + oy };
    }
    return { x, y };
  }
}
