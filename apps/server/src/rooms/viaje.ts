// Viaje rápido (reglas en viaje.ts de @hyvento/shared, destinos en viaje.ts de @hyvento/map): ir de una
// a un lugar o junto a alguien. Aquí se decide si se puede y dónde se aparece, con las mismas reglas que
// cruzar un portal (`handleTravel`: cupos y cierres de la casa del árbol y del estudio, no bajarse del bus
// en ruta) y que caminar (oficinas cerradas ajenas, la tarima del escenario). Mover a la persona (y todo lo
// que eso arrastra: zona, invitados, pizarras, logros) lo hace OfficeRoom con el resultado.
import type { MapSchema } from "@colyseus/schema";
import {
  canStandAt,
  isGameSeat,
  nearestFreeSpot,
  portalAtTile,
  seatAtPoint,
  travelDestination,
  zoneAt,
  type OfficeMap,
} from "@hyvento/map";
import {
  BUS,
  ESCENARIO,
  fishingBlocksTravel,
  VIAJE,
  ViajeGoMessage,
  viajeAreaBlock,
  viajeSelfBlock,
  type CasaArbolBlock,
  type Direction,
  type PodcastBlock,
  type ViajeNotice,
} from "@hyvento/shared";
import type { OfficeInfo, Player } from "../state";

export interface QuickTravelDeps {
  players: MapSchema<Player>;
  offices: MapSchema<OfficeInfo>;
  map(area: string): OfficeMap;
  areas(): Iterable<OfficeMap>;
  now(): number;
  cooldownMs(): number;
  fainted(userId: string): boolean;
  /** Carrera, hockey u otro minijuego que no se puede dejar tirado (la pesca se ve en `Player.fishing`). */
  playing(sessionId: string, player: Player): boolean;
  busDoorsOpen(): boolean;
  treeHouse(userId: string): CasaArbolBlock | null;
  studio(userId: string): PodcastBlock | null;
}

/** Adónde se quiere ir: un punto (px) de un nivel, la zona si el destino es una sala, y hacia dónde mirar. */
interface Target {
  area: string;
  zoneId?: string | null;
  x: number;
  y: number;
  dir: Direction;
}

export type QuickTravelPlan = { ok: true; area: string; x: number; y: number; dir: Direction } | { ok: false; notice: ViajeNotice };

export class QuickTravel {
  /** Cuándo viajó cada persona por última vez (User.id: con dos pestañas es la misma pausa). */
  private lastAt = new Map<string, number>();

  constructor(private readonly d: QuickTravelDeps) {}

  /** ¿Puede viajar y adónde? No mueve a nadie: eso lo hace la sala con `ok`, y después llama a `done`. */
  plan(sessionId: string, player: Player, raw: unknown): QuickTravelPlan {
    const parsed = ViajeGoMessage.safeParse(raw);
    if (!parsed.success) return this.no("unknown");
    const now = this.d.now();
    const here = this.d.map(player.area);
    const seat = player.seated ? seatAtPoint(here, player.x, player.y) : undefined;
    const self = viajeSelfBlock({
      gameSeat: player.seated && isGameSeat(here, player.x, player.y, seat?.type),
      swimming: player.swimming,
      fainted: this.d.fainted(player.userId),
      playing: player.racing || fishingBlocksTravel(player.fishing) || this.d.playing(sessionId, player),
      onBusInRoute: player.area === BUS.area && !this.d.busDoorsOpen(),
      cooldownLeftMs: Math.max(0, (this.lastAt.get(player.userId) ?? -Infinity) + this.d.cooldownMs() - now),
    });
    if (self === "cooldown") return { ok: false, notice: { code: "cooldown", waitMs: (this.lastAt.get(player.userId) ?? now) + this.d.cooldownMs() - now } };
    if (self) return this.no(self);

    const target = parsed.data.kind === "place" ? this.placeTarget(parsed.data.id) : this.personTarget(sessionId, player, parsed.data.userId);
    if ("code" in target) return this.no(target.code);
    // Ya estoy en esa sala.
    if (target.zoneId && player.zoneId === target.zoneId) return this.no("here");
    const area = viajeAreaBlock(target.area, { userId: player.userId, treeHouse: this.d.treeHouse(player.userId), studio: this.d.studio(player.userId) });
    if (area) return this.no(area);
    const map = this.d.map(target.area);
    // Un lugar donde pararse: que se pise, sin nadie encima, sin oficinas cerradas ajenas, fuera de la
    // tarima del escenario y de los portales (si no, el primer paso lo mandaría a otro nivel).
    const ts = map.tileSize;
    const ok = (x: number, y: number) =>
      canStandAt(map, x, y) &&
      !portalAtTile(map, Math.floor(x / ts), Math.floor(y / ts)) &&
      zoneAt(map, x, y)?.id !== ESCENARIO.stageZone &&
      this.canBeIn(map, player.userId, x, y) &&
      !this.occupied(sessionId, map, x, y);
    const spot = nearestFreeSpot(map, target.x, target.y, ok);
    if (!spot) return this.no("unknown");
    if (map.id === player.area && Math.hypot(spot.x - player.x, spot.y - player.y) < ts * 1.5) return this.no("here");
    return { ok: true, area: map.id, x: spot.x, y: spot.y, dir: target.dir };
  }

  /** Viajó: empieza la pausa. */
  done(userId: string) {
    this.lastAt.set(userId, this.d.now());
  }

  forget(userId: string) {
    this.lastAt.delete(userId);
  }

  private no(code: ViajeNotice["code"]): QuickTravelPlan {
    return { ok: false, notice: { code } };
  }

  /** Un destino de la lista: el centro de su tile de entrada. */
  private placeTarget(id: string): Target | { code: "unknown" } {
    const dest = travelDestination(this.d.areas(), id);
    if (!dest) return { code: "unknown" };
    const ts = this.d.map(dest.area).tileSize;
    return { area: dest.area, zoneId: dest.zoneId, x: (dest.tile.x + 0.5) * ts, y: (dest.tile.y + 0.5) * ts, dir: "down" };
  }

  /**
   * Junto a alguien: al lado de donde está. Si está en una oficina cerrada donde no puedo entrar, junto a la
   * puerta de afuera (así no aparezco del otro lado de la pared, en la sala de al lado).
   */
  private personTarget(sessionId: string, me: Player, userId: string): Target | { code: "offline" | "here" | "office" } {
    if (userId === me.userId) return { code: "here" };
    let who: Player | undefined;
    for (const [id, p] of this.d.players) if (id !== sessionId && p.userId === userId) who = p;
    if (!who) return { code: "offline" };
    const map = this.d.map(who.area);
    if (who.area === me.area && Math.hypot(who.x - me.x, who.y - me.y) < VIAJE.nearTiles * map.tileSize) return { code: "here" };
    if (!this.canBeIn(map, me.userId, who.x, who.y)) {
      const zone = zoneAt(map, who.x, who.y);
      if (!zone?.door) return { code: "office" };
      return { area: who.area, x: zone.door.x, y: zone.door.y, dir: "down" };
    }
    return { area: who.area, x: who.x, y: who.y, dir: who.dir as Direction };
  }

  /** La misma regla que `canAccess` de la sala: la oficina cerrada es del dueño y de sus invitados. */
  private canBeIn(map: OfficeMap, userId: string, x: number, y: number): boolean {
    const zone = zoneAt(map, x, y);
    if (zone?.type !== "office") return true;
    const office = this.d.offices.get(zone.id);
    if (!office?.locked || !office.ownerId) return true;
    return office.ownerId === userId || office.guests.includes(userId);
  }

  private occupied(sessionId: string, map: OfficeMap, x: number, y: number): boolean {
    for (const [id, p] of this.d.players) if (id !== sessionId && p.area === map.id && Math.hypot(p.x - x, p.y - y) < map.tileSize * 0.6) return true;
    return false;
  }
}
