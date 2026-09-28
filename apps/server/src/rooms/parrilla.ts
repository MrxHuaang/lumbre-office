// La parrilla en el servidor: cocinar en el horno de barro o en la parrilla con lo de la mochila (tarda,
// y va más rápido con más gente cocinando a la vez), traer queso y chorizo de la cafetería con puntos y
// repartir porciones del plato que se lleva en la mano. Las reglas están en @hyvento/shared/parrilla.
// Este módulo no conoce Colyseus: la sala le da la mochila, los puntos, el reloj y las personas.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import {
  GrillBuyMessage,
  GrillCookMessage,
  GRILL_RECIPES,
  grillMissing,
  grillProgress,
  grillRate,
  grillRecipe,
  GRANJA_STATS,
  isGrillDish,
  objItemId,
  pantryItem,
  PARRILLA,
  PortionMessage,
  portionOf,
  type GrillNotice,
  type GrillState,
  type PortionShared,
} from "@hyvento/shared";

/** Lo que se sincroniza de cada plato en el fuego (el `GrillJob` de state.ts). */
export interface GrillJobView {
  name: string;
  recipe: string;
  station: string;
  progress: number;
  rate: number;
  at: number;
  cookMs: number;
}

/** Una persona para la parrilla: dónde está y qué lleva en la mano. */
export interface GrillWho {
  userId: string;
  sessionId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface ParrillaDeps {
  jobs: {
    get(userId: string): GrillJobView | undefined;
    set(userId: string, job: GrillJobView): unknown;
    delete(userId: string): unknown;
    forEach(cb: (job: GrillJobView, userId: string) => void): void;
    readonly size: number;
  };
  create(): GrillJobView;
  /** El jardín (con los cambios del editor). */
  map(): OfficeMap;
  /** La mochila (Bag). */
  bag: {
    count(userId: string, itemId: string): number;
    fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack";
    take(userId: string, itemId: string, quantity: number): Promise<boolean>;
    add(userId: string, itemId: string, quantity: number, opts: { pick?: boolean }): Promise<"ok" | "full" | "stack">;
    /** Lo de la mano (el dibujo y los usos que le quedan a la unidad empezada). */
    get(userId: string): { item: string; left: readonly number[] } | undefined;
    /** Gasta un uso de lo de la mano (una porción que se regala). */
    use(userId: string, now: number, opts: { skipCooldown?: boolean }): { ok: boolean };
  };
  award(userId: string, amount: number): Promise<number>;
  /** Cobra con puntos (motivo PURCHASE): `ok` false = no alcanzó y no se cobró nada. */
  spend(userId: string, amount: number, refId: string): Promise<{ ok: boolean; balance: number }>;
  /** Dónde está ahora alguien (undefined si se fue). */
  where(userId: string): GrillWho | undefined;
  /** Contadores (logros). */
  bump(userId: string, key: string, by?: number): void;
  /** Aviso que llega después (el plato que sale). */
  notify(userId: string, notice: GrillNotice): void;
  /** Multiplica lo que tarda cada receta (los tests lo acortan). */
  timeScale(): number;
}

export class Parrilla {
  private lastActionAt = new Map<string, number>();
  private lastPortionAt = new Map<string, number>();
  /** Si cocinó con alguien más al lado en algún momento (bono de puntos). */
  private together = new Set<string>();
  /** Platos que salieron del fuego y todavía no llegaron a la mochila (userId → receta). */
  private pending = new Map<string, string>();
  private delivering = new Set<string>();
  /** Los que no cupieron: cuándo se reintenta y a quién ya se le avisó. */
  private retryAt = new Map<string, number>();
  private warned = new Set<string>();

  constructor(private readonly deps: ParrillaDeps) {}

  private near(who: GrillWho) {
    return who.area === this.deps.map().id && nearPointOfType(this.deps.map(), "grill", who.x, who.y);
  }

  private busy(userId: string, now: number) {
    if (now - (this.lastActionAt.get(userId) ?? -Infinity) < PARRILLA.actionCooldownMs) return true;
    this.lastActionAt.set(userId, now);
    return false;
  }

  /** Lo de la mochila que sirve para cocinar aquí. */
  state(userId: string): GrillState {
    const pantry: Record<string, number> = {};
    const ids = new Set(GRILL_RECIPES.flatMap((r) => Object.keys(r.needs)));
    for (const id of ids) {
      const n = this.deps.bag.count(userId, objItemId(id));
      if (n > 0) pantry[id] = n;
    }
    return { pantry, cooking: this.deps.jobs.get(userId)?.recipe ?? "" };
  }

  /** Cambió cuánta gente cocina: todos los platos siguen desde donde iban, al ritmo nuevo. */
  private rebase(now: number) {
    const cooks = this.deps.jobs.size;
    const rate = grillRate(cooks);
    this.deps.jobs.forEach((job, userId) => {
      job.progress = grillProgress(job, now);
      job.at = now;
      job.rate = rate;
      if (cooks >= 2) this.together.add(userId);
    });
  }

  /** Poner una receta al fuego: se gastan los ingredientes de la mochila y sale la barra sobre el horno. */
  async cook(who: GrillWho, raw: unknown, now: number): Promise<{ state?: GrillState; notice: GrillNotice } | null> {
    const parsed = GrillCookMessage.safeParse(raw);
    if (!parsed.success) return null;
    const recipe = grillRecipe(parsed.data.recipe)!;
    if (!this.near(who)) return { notice: { code: "far" } };
    if (this.deps.jobs.get(who.userId) || this.pending.has(who.userId)) return { notice: { code: "busy" } };
    if (this.busy(who.userId, now)) return null;
    const pantry = this.state(who.userId).pantry;
    if (Object.keys(grillMissing(recipe, pantry)).length) return { state: this.state(who.userId), notice: { code: "missing" } };
    // El plato tendrá que caber: si algún ingrediente se acaba, su casilla queda libre.
    const freed = Object.entries(recipe.needs).some(([id, n]) => (pantry[id] ?? 0) === n);
    if (!freed && this.deps.bag.fits(who.userId, [[objItemId(recipe.id), 1]]) !== "ok") return { notice: { code: "bagFull" } };
    const taken: [string, number][] = [];
    for (const [id, n] of Object.entries(recipe.needs)) {
      if (!(await this.deps.bag.take(who.userId, objItemId(id), n))) {
        for (const [back, m] of taken) await this.deps.bag.add(who.userId, objItemId(back), m, {});
        return { state: this.state(who.userId), notice: { code: "missing" } };
      }
      taken.push([id, n]);
    }
    // Pudo empezar otro mientras se sacaban los ingredientes (doble clic): se devuelven.
    if (this.deps.jobs.get(who.userId)) {
      for (const [back, m] of taken) await this.deps.bag.add(who.userId, objItemId(back), m, {});
      return { notice: { code: "busy" } };
    }
    const job = this.deps.create();
    Object.assign(job, { name: who.name, recipe: recipe.id, station: recipe.station, progress: 0, rate: 1, at: now, cookMs: Math.max(1, Math.round(recipe.cookMs * this.deps.timeScale())) });
    this.together.delete(who.userId);
    this.rebase(now);
    this.deps.jobs.set(who.userId, job);
    this.rebase(now);
    return { state: this.state(who.userId), notice: { code: "cooking", item: recipe.id } };
  }

  /** Cada tanto: lo que ya se cocinó sale del fuego (y se reintenta lo que no cupo en la mochila). */
  tick(now: number) {
    const done: string[] = [];
    this.deps.jobs.forEach((job, userId) => {
      if (grillProgress(job, now) >= 1) done.push(userId);
    });
    for (const [userId, at] of this.retryAt) if (now >= at) void this.deliver(userId);
    if (!done.length) return;
    for (const userId of done) {
      this.pending.set(userId, this.deps.jobs.get(userId)!.recipe);
      this.deps.jobs.delete(userId);
    }
    this.rebase(now);
    for (const userId of done) void this.deliver(userId);
  }

  /** El plato a la mochila (y a la mano, si sigue junto al horno con las manos libres) y sus puntos. */
  private async deliver(userId: string) {
    const id = this.pending.get(userId);
    const recipe = id ? grillRecipe(id) : undefined;
    if (!recipe || this.delivering.has(userId)) return;
    this.delivering.add(userId);
    this.retryAt.delete(userId);
    try {
      const who = this.deps.where(userId);
      const map = this.deps.map();
      const grill = who && who.area === map.id ? nearestGrill(map, who) : undefined;
      const close = !!who && !!grill && Math.hypot(who.x - grill.x, who.y - grill.y) <= PARRILLA.handReachTiles * map.tileSize;
      const added = await this.deps.bag.add(userId, objItemId(recipe.id), 1, { pick: close });
      if (added !== "ok") {
        // No cabe: se queda tibio junto al horno y se vuelve a intentar en un rato (se avisa una vez).
        if (!this.warned.has(userId)) this.deps.notify(userId, { code: "bagFull" });
        this.warned.add(userId);
        this.retryAt.set(userId, Date.now() + 5_000);
        return;
      }
      this.pending.delete(userId);
      this.warned.delete(userId);
      const bonus = this.together.delete(userId) ? PARRILLA.togetherBonus : 0;
      this.deps.bump(userId, GRANJA_STATS.dishes);
      const points = await this.deps.award(userId, recipe.points + bonus);
      this.deps.notify(userId, { code: close ? "done" : "doneBag", item: recipe.id, points: points || undefined });
    } finally {
      this.delivering.delete(userId);
    }
  }

  /** Traer queso o chorizo de la cafetería: se paga con puntos y va a la mochila. */
  async buy(who: GrillWho, raw: unknown, now: number): Promise<{ state?: GrillState; notice: GrillNotice } | null> {
    const parsed = GrillBuyMessage.safeParse(raw);
    if (!parsed.success) return null;
    const item = pantryItem(parsed.data.item)!;
    if (!this.near(who)) return { notice: { code: "far" } };
    if (this.busy(who.userId, now)) return null;
    const { quantity } = parsed.data;
    if (this.deps.bag.fits(who.userId, [[objItemId(item.id), quantity]]) !== "ok") return { notice: { code: "bagFull" } };
    const paid = await this.deps.spend(who.userId, item.price * quantity, `parrilla:${item.id}`);
    if (!paid.ok) return { notice: { code: "funds" } };
    const added = await this.deps.bag.add(who.userId, objItemId(item.id), quantity, {});
    if (added !== "ok") return { notice: { code: "failed" } };
    return { state: this.state(who.userId), notice: { code: "bought", item: item.id, count: quantity } };
  }

  /**
   * Pedir una porción: `holder` lleva un plato de la parrilla en la mano con más de una porción (la
   * última es de quien cocinó). Se gasta una de las suyas y a quien pide le queda una porción en la mano.
   */
  async portion(who: GrillWho, holder: GrillWho | undefined, raw: unknown, now: number): Promise<{ notice: GrillNotice; shared?: PortionShared; holderNotice?: GrillNotice } | null> {
    if (!PortionMessage.safeParse(raw).success || !holder || holder.userId === who.userId) return null;
    const ts = this.deps.map().tileSize;
    if (holder.area !== who.area || Math.hypot(holder.x - who.x, holder.y - who.y) > PARRILLA.shareReachTiles * ts) return { notice: { code: "far" } };
    const hand = this.deps.bag.get(holder.userId);
    if (!hand || !isGrillDish(hand.item) || (hand.left[0] ?? 0) < 2) return { notice: { code: "noPortion" } };
    if (now - (this.lastPortionAt.get(who.userId) ?? -Infinity) < PARRILLA.shareCooldownMs) return null;
    const dish = hand.item;
    if (this.deps.bag.fits(who.userId, [[objItemId(portionOf(dish)), 1]]) !== "ok") return { notice: { code: "bagFull" } };
    this.lastPortionAt.set(who.userId, now);
    if (!this.deps.bag.use(holder.userId, now, { skipCooldown: true }).ok) return { notice: { code: "noPortion" } };
    await this.deps.bag.add(who.userId, objItemId(portionOf(dish)), 1, { pick: true });
    const points = await this.deps.award(holder.userId, PARRILLA.sharePoints);
    return {
      notice: { code: "gotPortion", item: dish, name: holder.name },
      holderNotice: { code: "gavePortion", item: dish, name: who.name, points: points || undefined },
      shared: { from: holder.sessionId, to: who.sessionId, dish },
    };
  }

  forget(userId: string) {
    this.lastActionAt.delete(userId);
    this.lastPortionAt.delete(userId);
  }
}

/** El punto del horno o de la parrilla más cercano. */
function nearestGrill(map: OfficeMap, who: { x: number; y: number }) {
  let best: { x: number; y: number } | undefined;
  let bestD = Infinity;
  for (const p of map.points)
    if (p.type === "grill") {
      const d = Math.hypot(p.x - who.x, p.y - who.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  return best;
}
