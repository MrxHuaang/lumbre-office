// Muebles que se usan (piano, guitarra, tocadiscos, tele, lámparas, gato). Lo que cambia para todos
// (prendido/apagado) queda en `OfficeState.switches`; tocar un instrumento o acariciar al gato es un evento.
import { INTERACT_REACH_TILES, usablesOf, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import {
  CASA,
  carTaken,
  FurnitureUseMessage,
  counterMax,
  furnitureKey,
  isSwitchedOn,
  pickGift,
  stepsTo,
  USE_STEPS,
  usableSpec,
  TALLER,
  type CarSeat,
  type FurnitureEvent,
} from "@hyvento/shared";

/** Lo que se pueda guardar como interruptores (un MapSchema<boolean> en la sala, un Map en los tests). */
export interface Switches {
  get(key: string): boolean | undefined;
  set(key: string, on: boolean): unknown;
  delete(key: string): unknown;
  keys(): IterableIterator<string>;
}

/** Contadores de la casa viva (ajedrez, puzle, pizarras): un MapSchema<number> en la sala, un Map en los tests. */
export interface Counters {
  get(key: string): number | undefined;
  set(key: string, n: number): unknown;
  delete(key: string): unknown;
  keys(): IterableIterator<string>;
}

/** Casa viva: con qué más cuenta el uso de muebles (los contadores y quién ocupa cada cubículo). */
export interface CasaOptions {
  counters?: Counters;
  /** userId de quien está en el cubículo con esa clave (o undefined si está libre). */
  occupant?: (key: string) => string | undefined;
  /** ¿Le cabe en la mochila algo de lo que da el mueble? (lo gratis va a la mochila). */
  bagFits?: (userId: string, items: readonly string[]) => boolean;
}

export type FurnitureUseResult =
  | { ok: true; kind: "toggle"; key: string; on: boolean }
  | {
      ok: true;
      kind: "event";
      event: Omit<FurnitureEvent, "sessionId">;
      /** Casa viva: lo que queda en la mano (y al rato: el malvavisco se asa primero). */
      gives?: { item: string; afterMs: number };
      /** Casa viva: el contador que avanzó (ajedrez, puzle, pizarra) y su valor nuevo. */
      counter?: { key: string; value: number };
      /** Casa viva: el cubículo del baño al que se entra. */
      stall?: string;
    }
  /** `full`: lo gratis no le cabe en la mochila; `stall`: el baño está ocupado; `taken`: otra persona va al volante del carro. */
  | { ok: false; error: "invalid" | "far" | "busy" | "full" | "stall" | "taken" };

/** El mueble usable de ese tipo con esquina en (x, y), si existe en el nivel. */
export function usableAt(map: OfficeMap, type: string, x: number, y: number): PlacedFurniture | undefined {
  if (!usableSpec(type)) return undefined;
  // Los muebles del nivel y, además, las cortinas de las ventanas (ver usablesOf).
  return usablesOf(map).find((f) => f.type === type && f.x === x && f.y === y);
}

/** ¿Están los pies en (px, py) al alcance del mueble? Se mide al borde de lo que ocupa, no a su esquina. */
export function inReach(map: OfficeMap, f: PlacedFurniture, px: number, py: number): boolean {
  const ts = map.tileSize;
  const dx = Math.max(f.x * ts - px, 0, px - (f.x + f.w) * ts);
  const dy = Math.max(f.y * ts - py, 0, py - (f.y + f.d) * ts);
  // La fogata se usa desde los troncos, un poco más lejos que el resto.
  return Math.hypot(dx, dy) <= (usableSpec(f.type)?.reachTiles ?? INTERACT_REACH_TILES) * ts;
}

/**
 * Una oficina no se usa desde afuera (ni al revés): la pared está en medio aunque el mueble quede al
 * alcance. Se compara la zona del mueble con la de quien lo usa si alguna es una oficina.
 */
export function sameRoom(map: OfficeMap, f: PlacedFurniture, px: number, py: number): boolean {
  const ts = map.tileSize;
  const fz = zoneAt(map, (f.x + f.w / 2) * ts, (f.y + f.d / 2) * ts);
  const pz = zoneAt(map, px, py);
  if (fz?.type !== "office" && pz?.type !== "office") return true;
  return fz?.id === pz?.id;
}

/**
 * ¿Hay pared de por medio? La distancia se mide en línea recta, así que una lámpara pegada a una pared
 * interior quedaría al alcance desde la sala de al lado: hace falta llegar tile a tile sin cruzar pared.
 */
export function noWallBetween(map: OfficeMap, f: PlacedFurniture, px: number, py: number): boolean {
  const ts = map.tileSize;
  return stepsTo(map, Math.floor(px / ts), Math.floor(py / ts), f, USE_STEPS) <= USE_STEPS;
}

/** Las tres reglas juntas: al alcance, sin pared de por medio y del mismo lado de la puerta de una oficina. */
export function canUse(map: OfficeMap, f: PlacedFurniture, px: number, py: number): boolean {
  return inReach(map, f, px, py) && noWallBetween(map, f, px, py) && sameRoom(map, f, px, py);
}

export class FurnitureUses {
  /** Cuándo puede volver a usar un mueble cada persona. */
  private nextAt = new Map<string, number>();
  /** Casa viva: cuándo puede volver a sacar algo gratis cada persona (nevera, cafetera, malvavisco). */
  private freebieAt = new Map<string, number>();
  /** El taller: quién va al volante de cada carro (clave del mueble) y hasta cuándo. */
  private carSeats = new Map<string, CarSeat>();
  private readonly counters: Counters;

  constructor(
    private readonly switches: Switches,
    private readonly casa: CasaOptions = {},
  ) {
    this.counters = casa.counters ?? new Map<string, number>();
  }

  use(map: OfficeMap, who: { userId: string; x: number; y: number }, raw: unknown, now: number, seed = 0): FurnitureUseResult {
    const parsed = FurnitureUseMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { type, x, y } = parsed.data;
    const f = usableAt(map, type, x, y);
    const spec = usableSpec(type);
    if (!f || !spec) return { ok: false, error: "invalid" };
    if (!canUse(map, f, who.x, who.y)) return { ok: false, error: "far" };
    if (now < (this.nextAt.get(who.userId) ?? 0)) return { ok: false, error: "busy" };
    const key = furnitureKey(map.id, type, x, y);
    // Lo gratis tiene su propia pausa (más larga), y a un cubículo ocupado no se entra.
    const freebie = spec.action === "take" || spec.action === "roast";
    if (freebie && now < (this.freebieAt.get(who.userId) ?? 0)) return { ok: false, error: "busy" };
    // Lo gratis va a la mochila: tiene que caber (sin pisar nada de lo que se lleva).
    if (freebie && spec.gives?.length && this.casa.bagFits && !this.casa.bagFits(who.userId, spec.gives)) return { ok: false, error: "full" };
    if (spec.action === "stall") {
      const inside = this.casa.occupant?.(key);
      if (inside && inside !== who.userId) return { ok: false, error: "stall" };
    }
    // El taller: al carro se sube una persona a la vez.
    if (spec.action === "drive" && carTaken(this.carSeats.get(key), who.userId, now)) return { ok: false, error: "taken" };
    this.forgetExpired(now);
    this.nextAt.set(who.userId, now + spec.cooldownMs);
    if (spec.action === "drive") this.carSeats.set(key, { userId: who.userId, until: now + TALLER.driveMs });
    if (spec.action === "toggle") {
      const on = !isSwitchedOn(this.switches, map.id, type, x, y);
      this.switches.set(key, on);
      return { ok: true, kind: "toggle", key, on };
    }
    const event: Omit<FurnitureEvent, "sessionId"> = { type, x, y, action: spec.action, seed };
    if (freebie && spec.gives?.length) {
      this.freebieAt.set(who.userId, now + CASA.freebieCooldownMs);
      const item = pickGift(spec.gives, seed);
      return { ok: true, kind: "event", event: { ...event, item }, gives: { item, afterMs: spec.action === "roast" ? CASA.roastMs : 0 } };
    }
    if (spec.action === "count") {
      // Avanza para todos; al llegar al tope vuelve a empezar (partida nueva, pizarra borrada).
      const value = ((this.counters.get(key) ?? 0) + 1) % (counterMax(type) + 1);
      this.counters.set(key, value);
      // El valor va en el evento: el cliente lo muestra sin esperar al parche del estado.
      return { ok: true, kind: "event", event: { ...event, count: value }, counter: { key, value } };
    }
    if (spec.action === "stall") return { ok: true, kind: "event", event, stall: key };
    return { ok: true, kind: "event", event };
  }

  /**
   * ¿Sigue al alcance del mueble de ese evento? (el malvavisco tarda en asarse: si se fue, no lo recibe).
   */
  stillInReach(map: OfficeMap, e: { type: string; x: number; y: number }, px: number, py: number): boolean {
    const f = usableAt(map, e.type, e.x, e.y);
    return Boolean(f && canUse(map, f, px, py));
  }

  /** Las pausas ya vencidas no hacen falta: sin esto el mapa crece con cada persona que pasó por la sala. */
  private forgetExpired(now: number) {
    for (const m of [this.nextAt, this.freebieAt]) {
      if (m.size < 64) continue;
      for (const [userId, at] of m) if (at <= now) m.delete(userId);
    }
    for (const [key, seat] of this.carSeats) if (seat.until <= now) this.carSeats.delete(key);
  }

  /** Cuántas pausas se recuerdan (para los tests). */
  get pending() {
    return this.nextAt.size;
  }

  /** Se rearmó un nivel (decoración de oficinas): se olvidan los interruptores de muebles que ya no están. */
  prune(map: OfficeMap) {
    const prefix = `${map.id}:`;
    const alive = new Set(usablesOf(map).map((f) => furnitureKey(map.id, f.type, f.x, f.y)));
    for (const key of [...this.switches.keys()]) if (key.startsWith(prefix) && !alive.has(key)) this.switches.delete(key);
    for (const key of [...this.counters.keys()]) if (key.startsWith(prefix) && !alive.has(key)) this.counters.delete(key);
  }
}
