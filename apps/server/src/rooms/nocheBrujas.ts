// La Noche de brujas en la sala (ver noche-brujas.ts de @hyvento/shared): la canasta para todos al abrir
// el festival, el dulce o truco (a los NPC con su mensaje, y a las puertas de las oficinas y el timbre de
// las casas con el toque de siempre), la calabaza dorada del laberinto (una por persona por festival,
// guardada en `UserStat`) y el puesto del caldero. La sala le da la mochila, los contadores, la base, el
// reloj y el azar; este módulo no conoce Colyseus.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  BRUJAS,
  BrujasBuyMessage,
  CALABAZA_DORADA,
  CANASTA_DULCES,
  STAT_KEYS,
  SOMBRERO_BRUJA,
  TrickMessage,
  brujasActiva,
  brujasNpc,
  brujasRefId,
  brujasShopItem,
  objItemId,
  pumpkinStatKey,
  trickKey,
  trickLine,
  trickOutcome,
  type BrujasBuyResult,
  type PumpkinResult,
  type TrickResult,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { AchievementTracker } from "./achievements";
import type { Bag } from "./bag";

/** Quien pide: dónde está (en px del nivel). */
export interface BrujasWho {
  userId: string;
  area: string;
  x: number;
  y: number;
}

export interface NocheBrujasDeps {
  /** El festival de ahora (`state.festival`, su fase) y la fecha del juego. */
  festival(): { id: string; fase: string; day: number; año: number };
  mapOf(area: string): OfficeMap;
  held: Pick<Bag, "count" | "fits" | "add" | "hand">;
  stats: Pick<AchievementTracker, "stat" | "max" | "bump" | "isLoaded">;
  repo(): Pick<GameRepository, "spendPoints">;
  now(): number;
  /** Entero al azar en 0..n-1 (los tests lo fijan). */
  random(n: number): number;
}

export class NocheBrujas {
  /** A quién ya le pidió cada uno hoy (`userId|npc:aurora`); se vacía al cambiar el día del juego. */
  private asked = new Set<string>();
  private askedDay = -1;
  private lastAt = new Map<string, number>();

  constructor(private readonly deps: NocheBrujasDeps) {}

  /** ¿Está abierta la Noche de brujas? */
  active(): boolean {
    const f = this.deps.festival();
    return brujasActiva(f.id, f.fase);
  }

  /** ¿Lleva la canasta en la mano? */
  hasBasket(userId: string): boolean {
    return this.deps.held.hand(userId)?.id === CANASTA_DULCES;
  }

  /** Con el festival abierto, la canasta a quien no la tiene (en la mano, si estaba libre). */
  async giveBasket(userId: string): Promise<boolean> {
    const itemId = objItemId(CANASTA_DULCES);
    if (!this.active() || this.deps.held.count(userId, itemId) > 0 || this.deps.held.fits(userId, [[itemId, 1]]) !== "ok") return false;
    return (await this.deps.held.add(userId, itemId, 1, { pick: true })) === "ok";
  }

  /** Pausa entre dos pedidos o compras de la misma persona. */
  private busy(userId: string): boolean {
    const now = this.deps.now();
    if (now - (this.lastAt.get(userId) ?? -Infinity) < BRUJAS.cooldownMs) return true;
    this.lastAt.set(userId, now);
    return false;
  }

  /** Pedirle dulce o truco a un NPC (cerca de él, en su nivel). Null si el mensaje no sirve. */
  async trickNpc(who: BrujasWho, raw: unknown): Promise<TrickResult | null> {
    const parsed = TrickMessage.safeParse(raw);
    const npc = parsed.success ? brujasNpc(parsed.data.npc) : undefined;
    if (!npc) return null;
    if (!this.active()) return { ok: false, error: "off", from: npc.name };
    if (!this.hasBasket(who.userId)) return { ok: false, error: "basket", from: npc.name };
    const ts = this.deps.mapOf(who.area).tileSize;
    const dist = Math.hypot(who.x - (npc.tile.x + 0.5) * ts, who.y - (npc.tile.y + 0.5) * ts);
    if (who.area !== npc.area || dist > BRUJAS.npcReachTiles * ts) return { ok: false, error: "far", from: npc.name };
    if (this.busy(who.userId)) return { ok: false, error: "busy", from: npc.name };
    return this.reward(who.userId, trickKey("npc", npc.id), npc.name, { npc: npc.id, line: trickLine(npc.id, this.deps.random(1000)) });
  }

  /**
   * Tocó una puerta (`MSG.knock`): si es la Noche de brujas y lleva la canasta, además de tocar pide dulce
   * o truco. `door`: dónde queda la puerta de la oficina (null para el timbre de una casa, que suena desde
   * cualquier lado). Null si no cuenta (sin festival, sin canasta o lejos): el toque sigue como siempre.
   */
  async trickDoor(who: BrujasWho, kind: "puerta" | "casa", id: string, ownerName: string, door: { area: string; x: number; y: number } | null): Promise<TrickResult | null> {
    if (!this.active() || !this.hasBasket(who.userId)) return null;
    if (door) {
      const ts = this.deps.mapOf(who.area).tileSize;
      if (door.area !== who.area || Math.hypot(who.x - door.x, who.y - door.y) > BRUJAS.doorReachTiles * ts) return null;
    }
    if (this.busy(who.userId)) return { ok: false, error: "busy", from: ownerName };
    return this.reward(who.userId, trickKey(kind, id), ownerName, {});
  }

  /** Dulce (a la mochila) o truco, una vez por NPC o puerta por persona en el día del juego. */
  private async reward(userId: string, key: string, from: string, extra: { npc?: string; line?: string }): Promise<TrickResult> {
    const { day } = this.deps.festival();
    if (day !== this.askedDay) {
      this.asked.clear();
      this.askedDay = day;
    }
    const k = `${userId}|${key}`;
    if (this.asked.has(k)) return { ok: false, error: "done", from };
    const outcome = trickOutcome(this.deps.random(100), this.deps.random(1000));
    if (outcome.kind === "dulce") {
      const itemId = objItemId(outcome.dulce);
      if (this.deps.held.fits(userId, [[itemId, 1]]) !== "ok") return { ok: false, error: "full", from };
      this.asked.add(k);
      await this.deps.held.add(userId, itemId, 1);
      this.deps.stats.bump(userId, STAT_KEYS.trickOrTreats);
    } else this.asked.add(k);
    return { ok: true, from, outcome, ...extra };
  }

  /**
   * Tomar la calabaza dorada (junto a ella): una por persona por festival (la marca va en `UserStat` antes
   * de darla, así dos mensajes seguidos no dan dos).
   */
  async pumpkin(who: BrujasWho): Promise<PumpkinResult> {
    if (!this.active()) return { ok: false, error: "off" };
    if (!nearPointOfType(this.deps.mapOf(who.area), "golden_pumpkin", who.x, who.y)) return { ok: false, error: "far" };
    // Sin los contadores leídos no se sabe si ya la tomó.
    if (!this.deps.stats.isLoaded(who.userId) || this.busy(who.userId)) return { ok: false, error: "busy" };
    const key = pumpkinStatKey(this.deps.festival().año);
    if ((this.deps.stats.stat(who.userId, key) ?? 0) >= 1) return { ok: false, error: "done" };
    const itemId = objItemId(CALABAZA_DORADA);
    if (this.deps.held.fits(who.userId, [[itemId, 1]]) !== "ok") return { ok: false, error: "full" };
    this.deps.stats.max(who.userId, key, 1);
    this.deps.stats.bump(who.userId, STAT_KEYS.goldenPumpkins);
    await this.deps.held.add(who.userId, itemId, 1, { pick: true });
    return { ok: true };
  }

  /** Comprar en el puesto del caldero. `near`: si está junto al puesto (lo mide la sala). Null si el mensaje no sirve. */
  async buy(userId: string, raw: unknown, near: boolean): Promise<BrujasBuyResult | null> {
    const parsed = BrujasBuyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const item = brujasShopItem(parsed.data.item)!;
    const fail = (error: Extract<BrujasBuyResult, { ok: false }>["error"]): BrujasBuyResult => ({ ok: false, item: item.id, error });
    if (!this.active()) return fail("off");
    if (!near) return fail("far");
    const itemId = objItemId(item.id);
    const held = this.deps.held;
    if (item.id === SOMBRERO_BRUJA && held.count(userId, itemId) > 0) return fail("owned");
    const fits = held.fits(userId, [[itemId, item.gives]]);
    if (fits !== "ok") return fail(fits);
    if (this.busy(userId)) return fail("busy");
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.deps.repo().spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId: brujasRefId(item.id) });
    } catch (err) {
      console.error("brujas spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return fail("funds");
    await held.add(userId, itemId, item.gives);
    return { ok: true, item: item.id, balance: paid.balance };
  }

  /** Se fue de la sala. */
  forget(userId: string) {
    this.lastAt.delete(userId);
  }
}
