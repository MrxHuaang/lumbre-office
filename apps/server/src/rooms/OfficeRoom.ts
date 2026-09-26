import { canStandAt, placeAt, pointsOfType, spawnPoint, zoneAt, type OfficeMap, type Zone } from "@hyvento/map";
import { loadOfficeMap } from "@hyvento/map/node";
import {
  AgentAskMessage,
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
  OfficeLockMessage,
  PLAYER_SPEED,
  StatusMessage,
  verifyGameToken,
  type AgentAck,
  type AgentEvent,
  type AgentSay,
  type AgentStreamMessage,
  type ChatEvent,
  type GameTokenClaims,
  type KnockOutcome,
  type KnockRequest,
  type KnockResult,
  type MoveCorrection,
  type Positioned,
} from "@hyvento/shared";
import { Room, ServerError, type Client, type Deferred } from "colyseus";
import { randomUUID } from "node:crypto";
import type { AgentQueue, GameRepository, OfficeRecord } from "../repo/types";
import { AgentInfo, OfficeInfo, OfficeState, Player } from "../state";

interface UserData {
  lastMoveAt: number;
  chatTimes: number[];
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
const RECONNECT_SECONDS = 15;
/** Si el worker nunca responde, liberar la conversación para poder volver a preguntar. */
const AGENT_RUN_TIMEOUT_MS = 3 * 60_000;
const AGENT_SAY_CHARS = 90;

function gameTokenSecret() {
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) throw new Error("Falta GAME_TOKEN_SECRET en el entorno");
  return secret;
}

let sharedMap: OfficeMap | undefined;
const getMap = () => (sharedMap ??= loadOfficeMap());

export class OfficeRoom extends Room<OfficeState, unknown, UserData> {
  /** Persistencia inyectada por `createGameServer`. */
  static repo: GameRepository;
  /** Salas vivas, para propagar cambios externos (p. ej. reasignación de oficinas). */
  static readonly instances = new Set<OfficeRoom>();
  /** Cola del worker de agentes, inyectada por `createGameServer`. */
  static agentQueue: AgentQueue;

  static async reloadOfficesEverywhere() {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadOffices()));
  }

  static async reloadAgentsEverywhere() {
    await Promise.all([...OfficeRoom.instances].map((r) => r.reloadAgents()));
  }

  /** Evento del worker de agentes (llega por Redis). */
  static handleAgentEvent(event: AgentEvent) {
    for (const room of OfficeRoom.instances) room.applyAgentEvent(event);
  }

  maxClients = 64;
  patchRate = 50; // 20 Hz

  private map!: OfficeMap;
  private zonesById = new Map<string, Zone>();
  private globalHistory: ChatEvent[] = [];
  private pendingReconnections = new Map<string, Deferred<Client>>();
  private pendingKnocks = new Map<string, PendingKnock>();
  private lastKnockAt = new Map<string, number>(); // `${userId}:${zoneId}` → ts
  /** Conversaciones en curso: `${userId}:${agentId}` → runId. */
  private activeRuns = new Map<string, { runId: string; timer: { clear(): void } }>();

  private get repo() {
    return OfficeRoom.repo;
  }

  async onCreate() {
    this.map = getMap();
    for (const z of this.map.zones) this.zonesById.set(z.id, z);
    this.setState(new OfficeState());
    OfficeRoom.instances.add(this);

    this.onMessage(MSG.move, (client, raw) => this.handleMove(client, raw));
    this.onMessage(MSG.chatSend, (client, raw) => this.handleChat(client, raw));
    this.onMessage(MSG.status, (client, raw) => this.handleStatus(client, raw));
    this.onMessage(MSG.officeLock, (client, raw) => this.handleLock(client, raw));
    this.onMessage(MSG.knock, (client, raw) => this.handleKnock(client, raw));
    this.onMessage(MSG.knockRespond, (client, raw) => this.handleKnockRespond(client, raw));
    this.onMessage(MSG.agentAsk, (client, raw) => void this.handleAgentAsk(client, raw));

    const officeZones = this.map.zones.filter((z) => z.type === "office");
    await this.repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));
    await this.reloadOffices();
    await this.reloadAgents();
    this.globalHistory = await this.repo.loadGlobalChat(CHAT_HISTORY_SIZE);
  }

  onDispose() {
    OfficeRoom.instances.delete(this);
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

    const spawn = spawnPoint(this.map);
    const pos = this.freeSpotNear(spawn.x, spawn.y + this.map.tileSize / 2 - 2);

    const player = new Player();
    player.userId = auth.sub;
    player.name = auth.name;
    player.avatar = auth.avatar;
    player.x = pos.x;
    player.y = pos.y;
    player.zoneId = zoneAt(this.map, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(this.map, pos.x, pos.y);
    player.status = (await this.repo.getUserStatus(auth.sub).catch(() => null)) ?? "available";
    this.state.players.set(client.sessionId, player);

    client.userData = { lastMoveAt: Date.now(), chatTimes: [] };
    client.send(MSG.chatHistory, this.globalHistory);
  }

  async onLeave(client: Client<UserData>, consented: boolean) {
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

  /** Sincroniza `state.offices` con la base de datos (dueños, nombres, candado). */
  async reloadOffices() {
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
  }

  /** ¿Puede este jugador estar en (x, y)? Bloquea oficinas cerradas a quien no es dueño ni invitado. */
  private canAccess(player: Player, x: number, y: number): boolean {
    const zone = zoneAt(this.map, x, y);
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

  // ---------- Agentes ----------

  /** Ubica a cada agente activo en su escritorio del laboratorio (punto "agent_desk"). */
  async reloadAgents() {
    const records = await this.repo.listAgents();
    const desks = pointsOfType(this.map, "agent_desk");
    const used = new Set<string>();
    const seen = new Set<string>();
    for (const r of records) {
      const desk =
        desks.find((d) => d.ref === r.deskId && !used.has(d.ref ?? "")) ?? desks.find((d) => !used.has(d.ref ?? ""));
      if (!desk) continue; // sin escritorio libre: no se muestra
      used.add(desk.ref ?? "");
      seen.add(r.id);
      let agent = this.state.agents.get(r.id);
      if (!agent) {
        agent = new AgentInfo();
        agent.id = r.id;
        this.state.agents.set(r.id, agent);
      }
      agent.name = r.name;
      agent.role = r.role;
      agent.sprite = r.sprite;
      agent.x = desk.x;
      agent.y = desk.y + this.map.tileSize / 4;
      agent.dir = "up"; // mirando al computador
      agent.zoneId = zoneAt(this.map, agent.x, agent.y)?.id ?? "";
    }
    for (const id of [...this.state.agents.keys()]) if (!seen.has(id)) this.state.agents.delete(id);
  }

  private async handleAgentAsk(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = AgentAskMessage.safeParse(raw);
    if (!player || !parsed.success) return;
    const { agentId, text } = parsed.data;
    const ack = (a: AgentAck) => client.send(MSG.agentAck, a);
    const agent = this.state.agents.get(agentId);
    if (!agent) return ack({ agentId, runId: null, error: "Ese agente no está en la oficina." });

    const key = `${player.userId}:${agentId}`;
    if (this.activeRuns.has(key)) {
      return ack({ agentId, runId: null, error: `${agent.name} todavía está respondiendo tu mensaje anterior.` });
    }
    const runId = randomUUID();
    const timer = this.clock.setTimeout(() => this.activeRuns.delete(key), AGENT_RUN_TIMEOUT_MS);
    this.activeRuns.set(key, { runId, timer });
    try {
      await OfficeRoom.agentQueue.enqueue({ kind: "chat", runId, agentId, userId: player.userId, userName: player.name, message: text });
    } catch (err) {
      console.error("No se pudo encolar la pregunta al agente:", err);
      timer.clear();
      this.activeRuns.delete(key);
      return ack({ agentId, runId: null, error: "El servicio de agentes no está disponible ahora." });
    }
    ack({ agentId, runId });
  }

  private applyAgentEvent(event: AgentEvent) {
    const agent = this.state.agents.get(event.agentId);
    if (!agent) return;
    if (event.type === "agent.status") {
      agent.status = event.status;
      agent.detail = event.detail ?? "";
      return;
    }

    // Texto de la respuesta: solo a quien preguntó (todas sus sesiones en esta sala).
    const targets = this.clients.filter((c) => this.state.players.get(c.sessionId)?.userId === event.userId);
    const done = event.type === "agent.reply";
    const msg: AgentStreamMessage = {
      agentId: event.agentId,
      runId: event.runId,
      seq: event.seq,
      text: event.text,
      done,
      error: done ? event.error : undefined,
    };
    for (const c of targets) c.send(MSG.agentStream, msg);

    if (done) {
      const key = `${event.userId}:${event.agentId}`;
      const active = this.activeRuns.get(key);
      if (active?.runId === event.runId) {
        active.timer.clear();
        this.activeRuns.delete(key);
      }
      // Globo sobre el agente, también solo para quien preguntó (la conversación es privada).
      const plain = event.text.replace(/\*\*Fuentes\*\*[\s\S]*$/, "").replace(/[*_#`>]/g, "").trim();
      const say: AgentSay = {
        agentId: event.agentId,
        text: plain.length > AGENT_SAY_CHARS ? `${plain.slice(0, AGENT_SAY_CHARS - 1)}…` : plain,
      };
      for (const c of targets) c.send(MSG.agentSay, say);
    }
  }

  // ---------- Movimiento, chat y estado ----------

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

    if (dist > maxDist || !canStandAt(this.map, x, y) || !this.canAccess(player, x, y)) {
      const correction: MoveCorrection = { x: player.x, y: player.y };
      client.send(MSG.moveCorrection, correction);
      return;
    }

    const previousZoneId = player.zoneId;
    player.x = x;
    player.y = y;
    player.dir = dir;
    player.moving = moving;
    player.zoneId = zoneAt(this.map, x, y)?.id ?? "";
    player.place = placeAt(this.map, x, y);
    this.revokeGuestOnExit(player, previousZoneId);
  }

  private handleStatus(client: Client<UserData>, raw: unknown) {
    const parsed = StatusMessage.safeParse(raw);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    player.status = parsed.data.status;
    this.repo.setUserStatus(player.userId, parsed.data.status).catch((err) => console.error("setUserStatus", err));
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

  // ---------- Utilidades ----------

  private removePlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    this.state.players.delete(sessionId);
    if (!player) return;
    // Si ya no le queda ninguna sesión, deja de ser invitado en cualquier oficina.
    const stillHere = [...this.state.players.values()].some((p) => p.userId === player.userId);
    if (stillHere) return;
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
