// La cocina en el servidor: la despensa de cada persona (lo cosechado y la miel que dejó en el cobertizo
// o en la cocina), cocinar en la estufa y la energía de los platos. Las reglas están en
// @hyvento/shared/cocina. Este módulo no conoce Colyseus: la sala le da la mano, los puntos y el reloj, y
// manda lo que devuelve. Como lo que se lleva en la mano, la despensa vive en la memoria del servidor
// (por userId: sobrevive a recargar la página, no a reiniciar el servidor).
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  COCINA,
  CookMessage,
  canCook,
  dayStart,
  dishSpeedMul,
  isDish,
  isFreeHold,
  isIngredient,
  recipeById,
  takeIngredients,
  type CocinaNotice,
  type CocinaState,
  type Pantry,
} from "@hyvento/shared";

export interface CocinaDeps {
  /** Lo que lleva en la mano (HeldItems). */
  held: {
    get(userId: string): { item: string; left: readonly number[] } | undefined;
    give(userId: string, item: string): void;
    drop(userId: string): void;
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
  private pantries = new Map<string, Record<string, number>>();
  /** Puntos que dio la cocina hoy a cada persona (el día de Bogotá). */
  private today = new Map<string, { day: number; points: number }>();
  private buffs = new Map<string, Buff>();
  private lastCookAt = new Map<string, number>();

  constructor(private readonly deps: CocinaDeps) {}

  pantry(userId: string): Pantry {
    return this.pantries.get(userId) ?? {};
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

  /** Guardar en la despensa lo que se lleva en la mano: junto al cobertizo del jardín o a una estufa. */
  store(map: OfficeMap, who: CocinaWho, now: number): CocinaResult {
    if (!Cocina.atPantry(map, who)) return { notice: { code: "far" } };
    const held = this.deps.held.get(who.userId);
    if (!held) return { notice: { code: "nothing" } };
    if (!isIngredient(held.item)) return { notice: { code: "notIngredient" } };
    const pantry = { ...this.pantry(who.userId) };
    if ((pantry[held.item] ?? 0) >= COCINA.pantryMax) return { notice: { code: "full", item: held.item } };
    pantry[held.item] = (pantry[held.item] ?? 0) + 1;
    this.pantries.set(who.userId, pantry);
    this.deps.held.drop(who.userId);
    return { state: this.state(who.userId, now), notice: { code: "stored", item: held.item } };
  }

  /**
   * Cocinar junto a la estufa: la receta tiene que alcanzar con la despensa (más lo que se lleve en la
   * mano, que se guarda primero). El plato queda en la mano; si da puntos, se suman con su tope.
   */
  async cook(map: OfficeMap, who: CocinaWho, raw: unknown, now: number): Promise<CocinaResult> {
    const parsed = CookMessage.safeParse(raw);
    if (!parsed.success) return null;
    const recipe = recipeById(parsed.data.recipe)!;
    if (!nearPointOfType(map, "kitchen_stove", who.x, who.y)) return { notice: { code: "far" } };
    if (now - (this.lastCookAt.get(who.userId) ?? 0) < COCINA.cookCooldownMs) return { notice: { code: "busy" } };
    const held = this.deps.held.get(who.userId);
    // El plato va a la mano: no pisa lo que se pagó con puntos.
    if (held && !isFreeHold(held.item)) return { notice: { code: "hands" } };
    const pantry: Record<string, number> = { ...this.pantry(who.userId) };
    // Lo que trae en la mano cuenta (si es un ingrediente, se usa o queda guardado).
    const carried = held && isIngredient(held.item) ? held.item : undefined;
    if (carried) pantry[carried] = (pantry[carried] ?? 0) + 1;
    if (!canCook(recipe, pantry)) return { notice: { code: "missing" } };

    this.lastCookAt.set(who.userId, now);
    const left = takeIngredients(recipe, pantry);
    // Si lo de la mano sobró y ya no cabe, queda en el tope (no se pierde más de la cuenta).
    if (carried && (left[carried] ?? 0) > COCINA.pantryMax) left[carried] = COCINA.pantryMax;
    this.pantries.set(who.userId, left);
    this.deps.held.give(who.userId, recipe.id);

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

  /** Para los tests: llena la despensa. */
  fill(userId: string, pantry: Pantry) {
    this.pantries.set(userId, { ...pantry });
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
