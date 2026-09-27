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
  MENUS,
  UseHeldMessage,
  CONSUME,
  menuRefId,
  formatHeldLeft,
  menuItem,
  type FurnitureEvent,
  type HeldUsedEvent,
  type MenuId,
} from "@hyvento/shared";
import { Room, ServerError, type Client, type Deferred } from "colyseus";
import { randomUUID } from "node:crypto";
import type { GameRepository, OfficeItemsResult, OfficeRecord } from "../repo/types";
import { OfficeInfo, OfficeItem, OfficeState, Player } from "../state";
import { BlackjackTable, randomShoe, type BlackjackTimings } from "./casino/blackjack";
import { randomSpin, RouletteTable, type RouletteTimings } from "./casino/roulette";
import { HeldItems } from "./consumables";
import { devToolsEnabled, parseDevJump } from "./devtools";
import { FurnitureUses } from "./usables";
import { FISHING, type FishingTimings } from "@hyvento/shared";
import { randomInt } from "node:crypto";
import { Fishery } from "./fishing";

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

  /** Relee los ajustes del casino en todas las salas (los cambió un admin en /admin). */
  /** Otra sala guardó un cambio del editor de la casa: se aplica acá también. */
  static applyWorldEditsEverywhere(area: string, edits: WorldEdits) {
    for (const r of OfficeRoom.instances) r.applyWorldEdits(area, edits);
  }

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
    },
  });

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
    this.furnitureUses = new FurnitureUses(this.state.switches);
    OfficeRoom.instances.add(this);

    this.onMessage(MSG.move, (client, raw) => this.handleMove(client, raw));
    this.onMessage(MSG.chatSend, (client, raw) => this.handleChat(client, raw));
    this.onMessage(MSG.status, (client, raw) => this.handleStatus(client, raw));
    this.onMessage(MSG.profileChanged, (client) => void this.handleProfileChanged(client));
    this.onMessage(MSG.officeLock, (client, raw) => this.handleLock(client, raw));
    this.onMessage(MSG.knock, (client, raw) => this.handleKnock(client, raw));
    this.onMessage(MSG.knockRespond, (client, raw) => this.handleKnockRespond(client, raw));
    this.onMessage(MSG.travel, (client, raw) => this.handleTravel(client, raw));
    this.onMessage(MSG.activity, (client) => this.markActive(client));
    this.onMessage(MSG.cafeOrder, (client, raw) => void this.handleCafeOrder(client, raw));
    this.onMessage(MSG.barOrder, (client, raw) => void this.handleOrder(client, raw, "bar"));
    this.onMessage(MSG.useHeld, (client, raw) => this.handleUseHeld(client, raw));
    this.onMessage(MSG.furnitureUse, (client, raw) => this.handleFurnitureUse(client, raw));
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
    this.onMessage(MSG.rouletteBet, (client, raw) => void this.handleRouletteBet(client, raw));
    this.onMessage(MSG.blackjackBet, (client, raw) => void this.handleBlackjack(client, raw, "bet"));
    this.onMessage(MSG.blackjackAction, (client, raw) => void this.handleBlackjack(client, raw, "action"));
    this.onMessage(MSG.fishCast, (client) => this.handleFishCast(client));
    this.onMessage(MSG.fishHook, (client, raw) => this.withFisher(client, (userId) => this.fishery.hook(userId, raw)));
    this.onMessage(MSG.fishFinish, (client, raw) => this.withFisher(client, (userId) => void this.fishery.finish(userId, raw)));
    this.onMessage(MSG.fishCancel, (client) => this.withFisher(client, (userId) => this.fishery.cancel(userId)));
    this.clock.setInterval(() => void this.presenceTick(), OfficeRoom.presenceTickMs);

    const officeZones = allZones(this.world).filter((z) => z.type === "office");
    await this.repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));
    await this.reloadCasinoSettings();
    await this.loadWorldEdits();
    this.startCasino();
    await this.reloadOffices();
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
    this.state.players.set(client.sessionId, player);

    client.userData = { lastMoveAt: Date.now(), chatTimes: [], lastActiveAt: Date.now(), admin: auth.role === "ADMIN" };
    client.send(MSG.chatHistory, this.globalHistory);
    // La hora del servidor, para que el cliente calcule bien los conteos regresivos (la ruleta).
    client.send(MSG.clock, { now: Date.now() });
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

  // ---------- Movimiento, chat y estado ----------

  private handleMove(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = MoveMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const { x, y, moving } = parsed.data;
    let { dir } = parsed.data;
    const seated = parsed.data.seated ?? false;

    const map = this.mapOf(player.area);
    const now = Date.now();
    const dt = (now - client.userData.lastMoveAt) / 1000;
    client.userData.lastMoveAt = now;
    // Tolerancia: latencia/jitter + mínimo de medio tile. Sentarse y levantarse "saltan" hasta
    // el asiento (p. ej. del tile de enfrente a la silla), así que ahí se permite algo más.
    const snap = seated !== player.seated ? map.tileSize * SEAT_REACH_TILES : 0;
    const maxDist = Math.max(map.tileSize * 0.75, dt * PLAYER_SPEED * 1.6, snap);
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
    if (x !== player.x || y !== player.y) client.userData.lastActiveAt = now;
    player.x = x;
    player.y = y;
    player.dir = dir;
    player.moving = seated ? false : moving;
    player.seated = seated;
    player.zoneId = zoneAt(map, x, y)?.id ?? "";
    player.place = placeAt(map, x, y);
    this.revokeGuestOnExit(player, previousZoneId);
    this.fishery.moved(player.userId, x, y, seated);
  }

  /** Pasar a otro nivel por un portal: hay que estar parado junto a él. */
  private handleTravel(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    const parsed = TravelMessage.safeParse(raw);
    if (!player || !parsed.success || !client.userData) return;
    const map = this.mapOf(player.area);
    const portal = map.portals.find((p) => p.id === parsed.data.portal);
    if (!portal || player.seated || !nearPortal(map, portal, player.x, player.y)) {
      client.send(MSG.moveCorrection, { x: player.x, y: player.y, area: player.area } satisfies MoveCorrection);
      return;
    }
    const target = this.mapOf(portal.to.area);
    const ts = target.tileSize;
    const pos = this.freeSpotNear(target, portal.to.x * ts + ts / 2, portal.to.y * ts + ts / 2);
    const previousZoneId = player.zoneId;
    player.area = target.id;
    player.x = pos.x;
    player.y = pos.y;
    player.dir = portal.to.facing;
    player.moving = false;
    player.zoneId = zoneAt(target, pos.x, pos.y)?.id ?? "";
    player.place = placeAt(target, pos.x, pos.y);
    this.revokeGuestOnExit(player, previousZoneId);
    client.userData.lastMoveAt = Date.now();
    this.fishery.cancel(player.userId);
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
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
    client.send(MSG.moveCorrection, { x: pos.x, y: pos.y, area: target.id } satisfies MoveCorrection);
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
    if (devToolsEnabled() && this.devJump(client, player, parsed.data.text)) return;

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
    } catch (err) {
      console.error("awardPoints", err);
    }
  }

  private async reloadPoints(userId: string) {
    const players = [...this.state.players.values()].filter((p) => p.userId === userId);
    if (players.length === 0) return;
    const balance = await this.repo.getPoints(userId);
    for (const p of players) p.points = balance;
  }

  // ---------- Casino ----------

  private casinoSettings: CasinoSettingsDTO = { enabled: true, dailyLossLimit: CASINO.defaultDailyLossLimit };
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
      notify: (userId, settled: RouletteSettled) => {
        for (const c of this.clients) if (this.state.players.get(c.sessionId)?.userId === userId) c.send(MSG.rouletteSettled, settled);
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
      },
      timings: () => OfficeRoom.blackjackTimings,
      shuffle: () => OfficeRoom.blackjackShuffle(),
    });
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
    if (now - (client.userData.lastEmoteAt ?? 0) < EMOTE.cooldownMs) return;
    client.userData.lastEmoteAt = now;
    client.userData.lastActiveAt = now;
    const event: EmoteEvent = { sessionId: client.sessionId, emote: parsed.data.emote };
    for (const other of this.clients) {
      if (this.state.players.get(other.sessionId)?.area === player.area) other.send(MSG.emoteEvent, event);
    }
  }

  // ---------- Cafetería y bar ----------

  private handleCafeOrder(client: Client<UserData>, raw: unknown) {
    return this.handleOrder(client, raw, "cafe");
  }

  /**
   * Pedido en la barra de la cafetería o del club: hay que estar junto a esa barra y tener saldo. Lo
   * pedido se lleva en la mano un rato (y se usa con F).
   */
  private async handleOrder(client: Client<UserData>, raw: unknown, menu: MenuId) {
    const player = this.state.players.get(client.sessionId);
    const parsed = (menu === "cafe" ? CafeOrderMessage : BarOrderMessage).safeParse(raw);
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
    client.userData.lastActiveAt = now;
    const event: HeldUsedEvent = { sessionId: client.sessionId, part: used.part, art: used.art, action: used.action, left: used.left };
    this.sendToArea(player.area, MSG.heldUsed, event);
  }

  // ---------- Muebles que se usan ----------

  /** Tele, lámparas y tocadiscos se prenden para todos; instrumentos y gato avisan a los del nivel. */
  private handleFurnitureUse(client: Client<UserData>, raw: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    const now = Date.now();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const result = this.furnitureUses.use(this.mapOf(player.area), player, raw, now, seed);
    if (!result.ok) return;
    client.userData.lastActiveAt = now;
    if (result.kind === "event") {
      const event: FurnitureEvent = { sessionId: client.sessionId, ...result.event };
      this.sendToArea(player.area, MSG.furnitureEvent, event);
    }
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

  private withFisher(client: Client<UserData>, fn: (userId: string) => void) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !client.userData) return;
    client.userData.lastActiveAt = Date.now();
    fn(player.userId);
  }

  // ---------- Utilidades ----------

  private removePlayer(sessionId: string) {
    const player = this.state.players.get(sessionId);
    this.state.players.delete(sessionId);
    if (!player) return;
    // Si ya no le queda ninguna sesión, deja de ser invitado en cualquier oficina.
    const stillHere = [...this.state.players.values()].some((p) => p.userId === player.userId);
    if (stillHere) return;
    this.fishery.forget(player.userId);
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
