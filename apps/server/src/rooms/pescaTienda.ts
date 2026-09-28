// El puesto de pesca del lago (ver pesca-tienda.ts de @hyvento/shared): la compra (junto al mostrador,
// con pausa, que quepa en la mochila, que la caña no sea repetida y con saldo) y el equipo con que se
// pesca cada lance (la caña y la carnada que uno tiene en la mochila; la carnada se descuenta al lanzar).
// La sala le da la mochila, la base y el reloj; este módulo no conoce Colyseus.
import {
  PESCA,
  PescaBuyMessage,
  fishingGear,
  objItemId,
  pescaItem,
  pescaRefId,
  type FishingGear,
  type PescaBuyResult,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { Bag } from "./bag";

export interface PescaDeps {
  repo(): Pick<GameRepository, "spendPoints">;
  held: Pick<Bag, "count" | "fits" | "add" | "take" | "hand">;
  now(): number;
}

export class PescaStand {
  private lastBuyAt = new Map<string, number>();

  constructor(private readonly deps: PescaDeps) {}

  /**
   * Comprar en el puesto. `near`: si está junto al mostrador (lo mide la sala con el punto `fishing_shop`).
   * Devuelve la respuesta para quien compró (null si el mensaje no sirve).
   */
  async buy(userId: string, raw: unknown, near: boolean): Promise<PescaBuyResult | null> {
    const parsed = PescaBuyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const id = parsed.data.item;
    const item = pescaItem(id)!;
    const fail = (error: Extract<PescaBuyResult, { ok: false }>["error"]): PescaBuyResult => ({ ok: false, item: id, error });
    const now = this.deps.now();
    if (now - (this.lastBuyAt.get(userId) ?? -Infinity) < PESCA.buyCooldownMs) return fail("busy");
    if (!near) return fail("far");
    const held = this.deps.held;
    const itemId = objItemId(id);
    // Una caña se compra una sola vez (la de bambú no se vende: es la de siempre).
    if (item.kind === "rod" && held.count(userId, itemId) > 0) return fail("owned");
    const fits = held.fits(userId, [[itemId, item.gives]]);
    if (fits !== "ok") return fail(fits);
    this.lastBuyAt.set(userId, now);
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.deps.repo().spendPoints({ userId, amount: item.price, reason: "PURCHASE", refId: pescaRefId(id) });
    } catch (err) {
      console.error("pesca spendPoints", err);
      return fail("failed");
    }
    if (!paid.ok) return { ok: false, item: id, error: "funds" };
    // A la mochila; la caña nueva queda en la mano si estaban libres (la carnada, no: se usa sola).
    await held.add(userId, itemId, item.gives, { pick: item.kind === "rod" });
    return { ok: true, item: id, balance: paid.balance };
  }

  /** Con qué pesca ahora: lo de la mano si es una caña o una carnada, o lo mejor que tenga. */
  gear(userId: string): FishingGear {
    const held = this.deps.held;
    return fishingGear((art) => held.count(userId, objItemId(art)), held.hand(userId)?.id ?? "");
  }

  /** Se lanzó con carnada: se gasta una. */
  spendBait(userId: string, gear: FishingGear) {
    if (gear.bait) void this.deps.held.take(userId, objItemId(gear.bait), 1);
  }

  /** Se fue de la sala. */
  forget(userId: string) {
    this.lastBuyAt.delete(userId);
  }
}
