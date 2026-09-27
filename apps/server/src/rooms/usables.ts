// Muebles que se usan (piano, guitarra, tocadiscos, tele, lámparas, gato). Lo que cambia para todos
// (prendido/apagado) queda en `OfficeState.switches`; tocar un instrumento o acariciar al gato es un evento.
import { INTERACT_REACH_TILES, zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { FurnitureUseMessage, furnitureKey, isSwitchedOn, usableSpec, type FurnitureEvent } from "@hyvento/shared";

/** Lo que se pueda guardar como interruptores (un MapSchema<boolean> en la sala, un Map en los tests). */
export interface Switches {
  get(key: string): boolean | undefined;
  set(key: string, on: boolean): unknown;
  delete(key: string): unknown;
  keys(): IterableIterator<string>;
}

export type FurnitureUseResult =
  | { ok: true; kind: "toggle"; key: string; on: boolean }
  | { ok: true; kind: "event"; event: Omit<FurnitureEvent, "sessionId"> }
  | { ok: false; error: "invalid" | "far" | "busy" };

/** El mueble usable de ese tipo con esquina en (x, y), si existe en el nivel. */
export function usableAt(map: OfficeMap, type: string, x: number, y: number): PlacedFurniture | undefined {
  if (!usableSpec(type)) return undefined;
  return map.furniture.find((f) => f.type === type && f.x === x && f.y === y);
}

/** ¿Están los pies en (px, py) al alcance del mueble? Se mide al borde de lo que ocupa, no a su esquina. */
export function inReach(map: OfficeMap, f: PlacedFurniture, px: number, py: number): boolean {
  const ts = map.tileSize;
  const dx = Math.max(f.x * ts - px, 0, px - (f.x + f.w) * ts);
  const dy = Math.max(f.y * ts - py, 0, py - (f.y + f.d) * ts);
  return Math.hypot(dx, dy) <= INTERACT_REACH_TILES * ts;
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

export class FurnitureUses {
  /** Cuándo puede volver a usar un mueble cada persona. */
  private nextAt = new Map<string, number>();

  constructor(private readonly switches: Switches) {}

  use(map: OfficeMap, who: { userId: string; x: number; y: number }, raw: unknown, now: number, seed = 0): FurnitureUseResult {
    const parsed = FurnitureUseMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { type, x, y } = parsed.data;
    const f = usableAt(map, type, x, y);
    const spec = usableSpec(type);
    if (!f || !spec) return { ok: false, error: "invalid" };
    if (!inReach(map, f, who.x, who.y) || !sameRoom(map, f, who.x, who.y)) return { ok: false, error: "far" };
    if (now < (this.nextAt.get(who.userId) ?? 0)) return { ok: false, error: "busy" };
    this.nextAt.set(who.userId, now + spec.cooldownMs);
    if (spec.action === "toggle") {
      const key = furnitureKey(map.id, type, x, y);
      const on = !isSwitchedOn(this.switches, map.id, type, x, y);
      this.switches.set(key, on);
      return { ok: true, kind: "toggle", key, on };
    }
    return { ok: true, kind: "event", event: { type, x, y, action: spec.action, seed } };
  }

  /** Se rearmó un nivel (decoración de oficinas): se olvidan los interruptores de muebles que ya no están. */
  prune(map: OfficeMap) {
    const prefix = `${map.id}:`;
    const alive = new Set(map.furniture.map((f) => furnitureKey(map.id, f.type, f.x, f.y)));
    for (const key of [...this.switches.keys()]) if (key.startsWith(prefix) && !alive.has(key)) this.switches.delete(key);
  }
}
