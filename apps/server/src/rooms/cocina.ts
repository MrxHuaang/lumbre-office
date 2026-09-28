// La cocina en el servidor: cocinar en la estufa con lo que se tiene en la mochila (lo cosechado y la
// miel: la "despensa" es la mochila, ver bag.ts) y la energía de los platos. Las reglas están en
// @hyvento/shared/cocina. Este módulo no conoce Colyseus: la sala le da la mochila, los puntos y el reloj,
// y manda lo que devuelve.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  COCINA,
  CookMessage,
  canCook,
  dayStart,
  dishSpeedMul,
  INGREDIENTS,
  isDish,
  objItemId,
  recipeById,
  takeIngredients,
  type CocinaNotice,
  type CocinaState,
  type Pantry,
} from "@hyvento/shared";

export interface CocinaDeps {
  /** La mochila (Bag): de ahí salen los ingredientes y ahí va el plato (a la mano, si estaban libres). */
  bag: {
    count(userId: string, itemId: string): number;
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    take(userId: string, itemId: string, quantity: number): Promise<boolean>;
    add(userId: string, itemId: string, quantity: number, opts: { pick?: boolean }): Promise<"ok" | "full" | "stack">;
  };
  /** Premio de ocio (LEISURE, con su tope diario): devuelve lo sumado. */
  award(userId: string, amount: number): Promise<number>;
  later(ms: number, fn: () => void): { clear(): void };
  /** Cambió la energía de alguien ("" = se le acabó): la sala la copia a sus `Player`. */
  onBuff(userId: string, dish: string): void;
}

export interface CocinaWho {
  userId: string;
  x: number;
  y: number;
}

/** Lo que pasó: el estado nuevo de la despensa y un aviso para quien lo intentó (o nada: se ignora). */
export type CocinaResult = { state?: CocinaState; notice?: CocinaNotice } | null;

interface Buff {
  dish: string;
  until: number;
  timer: { clear(): void };
}

export class Cocina {
  /** Puntos que dio la cocina hoy a cada persona (el día de Bogotá). */
  private today = new Map<string, { day: number; points: number }>();
  private buffs = new Map<string, Buff>();
  private lastCookAt = new Map<string, number>();

  constructor(private readonly deps: CocinaDeps) {}

  /** Los ingredientes que tiene en la mochila (lo que no tiene no aparece). */
  pantry(userId: string): Pantry {
    const out: Record<string, number> = {};
    for (const id of INGREDIENTS) {
      const n = this.deps.bag.count(userId, objItemId(id));
      if (n > 0) out[id] = n;
    }
    return out;
  }

  /** La despensa, lo de hoy y la energía de esa persona (para el panel). */
  state(userId: string, now: number): CocinaState {
    const buff = this.buffs.get(userId);
    return {
      pantry: { ...this.pantry(userId) },
      pointsToday: this.pointsToday(userId, now),
      buff: buff && buff.until > now ? buff.dish : "",
      buffLeftMs: buff ? Math.max(0, buff.until - now) : 0,
    };
  }

  /**
   * "Guardar en la despensa" (de antes de la mochila): lo cosechado ya queda en la mochila, así que solo
   * se avisa (y se manda cómo está).
   */
  store(map: OfficeMap, who: CocinaWho, now: number): CocinaResult {
    if (!Cocina.atPantry(map, who)) return { notice: { code: "far" } };
    return { state: this.state(who.userId, now), notice: { code: "inBag" } };
  }

  /**
   * Cocinar junto a la estufa: la receta tiene que alcanzar con lo que hay en la mochila, que se gasta. El
   * plato va a la mochila (y a la mano si estaban libres); si da puntos, se suman con su tope.
   */
  async cook(map: OfficeMap, who: CocinaWho, raw: unknown, now: number): Promise<CocinaResult> {
    const parsed = CookMessage.safeParse(raw);
    if (!parsed.success) return null;
    const recipe = recipeById(parsed.data.recipe)!;
    if (!nearPointOfType(map, "kitchen_stove", who.x, who.y)) return { notice: { code: "far" } };
    if (now - (this.lastCookAt.get(who.userId) ?? 0) < COCINA.cookCooldownMs) return { notice: { code: "busy" } };
    const pantry = this.pantry(who.userId);
    if (!canCook(recipe, pantry)) return { notice: { code: "missing" } };
    // El plato tiene que caber: con lo que se gasta se liberan casillas, así que se cuenta después.
    const freed = Object.entries(takeIngredients(recipe, pantry)).length < Object.keys(pantry).length;
    if (!freed && this.deps.bag.fits(who.userId, [[objItemId(recipe.id), 1]]) !== "ok") return { notice: { code: "bagFull" } };

    this.lastCookAt.set(who.userId, now);
    // Se gastan los ingredientes de a uno; si alguno ya no estaba (se regaló justo), se devuelve lo sacado.
    const taken: [string, number][] = [];
    for (const [item, n] of Object.entries(recipe.needs)) {
      if (!(await this.deps.bag.take(who.userId, objItemId(item), n))) {
        for (const [back, m] of taken) await this.deps.bag.add(who.userId, objItemId(back), m, {});
        return { state: this.state(who.userId, now), notice: { code: "missing" } };
      }
      taken.push([item, n]);
    }
    await this.deps.bag.add(who.userId, objItemId(recipe.id), 1, { pick: true });

    let points = 0;
    if (recipe.effect.kind === "points") {
      const room = Math.max(0, COCINA.pointsDailyCap - this.pointsToday(who.userId, now));
      const want = Math.min(room, recipe.effect.amount);
      if (want > 0) points = await this.deps.award(who.userId, want);
      if (points > 0) this.today.set(who.userId, { day: dayStart(now), points: this.pointsToday(who.userId, now) + points });
    }
    const capped = recipe.effect.kind === "points" && points === 0;
    return { state: this.state(who.userId, now), notice: { code: capped ? "capped" : "cooked", item: recipe.id, points: points || undefined } };
  }

  /**
   * Se probó algo de la mano (F): el primer bocado de un plato con energía la prende (reemplaza la que
   * hubiera). Devuelve el aviso si la prendió.
   */
  ate(userId: string, art: string, leftAfter: number, now: number): CocinaNotice | null {
    const recipe = isDish(art) ? recipeById(art) : undefined;
    if (!recipe || recipe.effect.kind !== "speed") return null;
    // Solo el primero: los demás bocados no alargan la energía.
    if (leftAfter !== recipe.uses - 1) return null;
    this.buffs.get(userId)?.timer.clear();
    const until = now + recipe.effect.ms;
    const timer = this.deps.later(recipe.effect.ms, () => {
      if (this.buffs.get(userId)?.until !== until) return;
      this.buffs.delete(userId);
      this.deps.onBuff(userId, "");
    });
    this.buffs.set(userId, { dish: recipe.id, until, timer });
    this.deps.onBuff(userId, recipe.id);
    return { code: "energy", item: recipe.id };
  }

  /** Plato cuya energía tiene ahora ("" = ninguna). */
  buffOf(userId: string, now: number): string {
    const b = this.buffs.get(userId);
    return b && b.until > now ? b.dish : "";
  }

  /**
   * Cuánto más rápido puede ir (para validar el movimiento). Con un margen después de que se acaba: la
   * última posición rápida del cliente puede llegar un poco tarde.
   */
  speedMul(userId: string, now: number): number {
    const b = this.buffs.get(userId);
    return b && now <= b.until + COCINA.speedGraceMs ? dishSpeedMul(b.dish) : 1;
  }

  /** ¿Está junto a la despensa (el cobertizo del huerto o una estufa de la cocina)? */
  static atPantry(map: OfficeMap, who: { x: number; y: number }): boolean {
    return nearPointOfType(map, "tool_shed", who.x, who.y) || nearPointOfType(map, "kitchen_stove", who.x, who.y);
  }

  dispose() {
    for (const b of this.buffs.values()) b.timer.clear();
    this.buffs.clear();
  }

  private pointsToday(userId: string, now: number): number {
    const t = this.today.get(userId);
    return t && t.day === dayStart(now) ? t.points : 0;
  }
}
