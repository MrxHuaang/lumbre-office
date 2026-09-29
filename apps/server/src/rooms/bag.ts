// La mochila de cada persona en el servidor (ver bolsa.ts de @hyvento/shared): lo que tiene (una copia de
// InventoryItem), en qué casilla va cada cosa y qué casilla eligió en la barra, que es lo que lleva en la
// mano. Usar lo de la mano (F, o el huerto con E) gasta usos de la unidad empezada y, al acabarla, una
// unidad de la mochila. La base manda: la copia se relee al entrar y cuando algo cambia afuera (la web, un
// intercambio). Este módulo no conoce Colyseus: la sala copia la mano a `Player` y manda la vista.
import {
  BAG,
  CONSUMABLES,
  EMPTY_CAN,
  HUERTO,
  WATERING_CAN,
  arrangeBag,
  bagItemInfo,
  bagItemsOf,
  consumeActionOf,
  objIdOf,
  objItemId,
  sheetNoteIdOf,
  usesOf,
  type BagView,
  type ConsumeAction,
  type ItemStack,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";

export type BagRepo = Pick<GameRepository, "getInventory" | "addInventory" | "takeInventory" | "loadBagSlots" | "saveBagSlots" | "noteTitles">;

export interface BagDeps {
  repo(): BagRepo;
  /** Cambió lo que lleva en la mano: la sala lo copia a sus `Player` ("" = nada). */
  onHeld(userId: string, item: string, left: readonly number[]): void;
  /** Cambió la mochila: la sala se la manda a esa persona. */
  onBag(userId: string, view: BagView): void;
  /** Pausa mínima entre dos usos (los tests la acortan). */
  cooldownMs(): number;
}

export type UseResult = { ok: true; part: number; art: string; action: ConsumeAction; left: number; done: boolean } | { ok: false; error: "empty" | "busy" };

/** Lo que está en la mano: la cosa de la mochila, su dibujo y los usos de la unidad empezada. */
export interface Hand {
  itemId: string;
  /** Id del objeto (sin `obj:`). */
  id: string;
  /** Lo que se dibuja (la regadera sin agua es `regadera-vacia`). */
  art: string;
  left: number;
}

interface UserBag {
  stacks: Map<string, number>;
  /** Casilla guardada de cada cosa que se tiene. */
  saved: Record<string, number>;
  grid: (ItemStack | null)[];
  overflow: ItemStack[];
  selected: number;
  /** Título de las hojas impresas de sus propias notas (itemId → título); las ajenas no están. */
  titles: Map<string, string>;
  /** Usos que le quedan a la unidad empezada de cada cosa (lo que no está: entera). La regadera: su agua. */
  uses: Map<string, number>;
  lastUseAt: number;
  loaded: boolean;
  /** Sube con cada cambio de la copia: una lectura de la base que se cruzó con uno se repite. */
  version: number;
  /** Lo que se escribe en la base va de a uno y en orden (una lectura posterior ve lo anterior). */
  queue: Promise<unknown>;
}

export class Bag {
  private byUser = new Map<string, UserBag>();

  constructor(private readonly deps: BagDeps) {}

  private bag(userId: string): UserBag {
    let b = this.byUser.get(userId);
    if (!b) {
      b = {
        stacks: new Map(),
        saved: {},
        grid: Array(BAG.slots).fill(null),
        overflow: [],
        selected: 0,
        titles: new Map(),
        uses: new Map(),
        lastUseAt: 0,
        loaded: false,
        version: 0,
        queue: Promise.resolve(),
      };
      this.byUser.set(userId, b);
    }
    return b;
  }

  /** Encola algo contra la base (los errores se anotan y no cortan la cola). */
  private enqueue<T>(b: UserBag, what: string, fn: () => Promise<T>): Promise<T | undefined> {
    const run = b.queue.then(fn).catch((err) => {
      console.error(what, err);
      return undefined;
    });
    b.queue = run;
    return run;
  }

  /** Lee de la base lo que tiene y dónde va cada cosa (al entrar, o porque cambió afuera). */
  load(userId: string): Promise<void> {
    const b = this.bag(userId);
    return this.enqueue(b, "bag.load", async () => {
      const repo = this.deps.repo();
      const version = b.version;
      const [stacks, saved] = await Promise.all([repo.getInventory(userId), repo.loadBagSlots(userId)]);
      // Algo cambió mientras se leía (y su escritura está en la cola, después de esta lectura): se relee.
      if (b.version !== version) return void this.load(userId);
      b.stacks = new Map(stacks.filter((s) => s.quantity > 0).map((s) => [s.itemId, s.quantity]));
      b.saved = { ...saved };
      b.titles = await this.sheetTitles(userId, [...b.stacks.keys()]);
      if (b.version !== version) return void this.load(userId);
      // Lo empezado de algo que ya no se tiene (se regaló, se cambió) se olvida.
      for (const id of [...b.uses.keys()]) if (!b.stacks.has(objItemId(id))) b.uses.delete(id);
      const first = !b.loaded;
      b.loaded = true;
      this.arrange(userId, b);
      this.emit(userId, b, first);
    }).then(() => undefined);
  }

  /**
   * Títulos de las hojas impresas entre estas cosas, en una sola consulta y solo de las notas de `userId`:
   * una hoja regalada, cambiada o de una nota borrada no encuentra nada y se ve genérica. Si falla, genéricas.
   */
  private async sheetTitles(userId: string, itemIds: readonly string[]): Promise<Map<string, string>> {
    const byNote = new Map<string, string>();
    for (const itemId of itemIds) {
      const id = objIdOf(itemId);
      const noteId = id === null ? null : sheetNoteIdOf(id);
      if (noteId) byNote.set(noteId, itemId);
    }
    if (!byNote.size) return new Map();
    const found = await this.deps
      .repo()
      .noteTitles(userId, [...byNote.keys()])
      .catch((err) => {
        console.error("noteTitles", err);
        return {} as Record<string, string>;
      });
    return new Map(Object.entries(found).flatMap(([noteId, title]) => (byNote.has(noteId) ? [[byNote.get(noteId)!, title] as const] : [])));
  }

  /** Espera lo pendiente contra la base (tests). */
  flush(userId: string) {
    return this.bag(userId).queue;
  }

  /** Espera lo pendiente de todos (al cerrar la sala). */
  async flushAll(): Promise<void> {
    await Promise.all([...this.byUser.values()].map((b) => b.queue));
  }

  view(userId: string): BagView {
    const b = this.bag(userId);
    const view: BagView = { slots: b.grid.map((s) => s && { ...s }), overflow: b.overflow.map((s) => ({ ...s })), selected: b.selected };
    // Solo los títulos de lo que sigue en la mochila.
    const titles = [...b.titles].filter(([itemId]) => b.stacks.has(itemId));
    if (titles.length) view.titles = Object.fromEntries(titles);
    return view;
  }

  /** Unidades de algo (0 si no tiene). */
  count(userId: string, itemId: string): number {
    return this.byUser.get(userId)?.stacks.get(itemId) ?? 0;
  }

  /** Lo que está en la mano (un mueble elegido no se lleva: manos libres). */
  hand(userId: string): Hand | null {
    const b = this.byUser.get(userId);
    return b ? this.handOf(b) : null;
  }

  /** Lo de la mano como lo guarda el estado (`Player.held` y sus usos), o undefined con las manos libres. */
  get(userId: string): { item: string; left: readonly number[] } | undefined {
    const h = this.hand(userId);
    return h ? { item: h.art, left: [h.left] } : undefined;
  }

  private handOf(b: UserBag): Hand | null {
    const itemId = b.grid[b.selected]?.itemId;
    const id = itemId ? objIdOf(itemId) : null;
    if (!itemId || id === null) return null;
    if (id === WATERING_CAN) {
      const water = b.uses.get(id) ?? 0;
      // Sin agua se ve la regadera vacía (con un "uso" solo para que se dibuje en la mano).
      return water > 0 ? { itemId, id, art: WATERING_CAN, left: water } : { itemId, id, art: EMPTY_CAN, left: 1 };
    }
    // El dibujo: una hoja de nota (`hoja:<noteId>`) se ve como la hoja impresa.
    return { itemId, id, art: bagItemInfo(itemId).art, left: b.uses.get(id) ?? usesOf(id) };
  }

  /** ¿Caben estas cosas (itemId, unidades)? Lo nuevo necesita una casilla libre; lo que ya hay, no pasar su tope. */
  fits(userId: string, items: readonly (readonly [string, number])[]): "ok" | "full" | "stack" {
    const b = this.bag(userId);
    const want = new Map<string, number>();
    for (const [itemId, n] of items) want.set(itemId, (want.get(itemId) ?? 0) + n);
    let free = BAG.slots - b.stacks.size;
    for (const [itemId, n] of want) {
      const have = b.stacks.get(itemId) ?? 0;
      if (have + n > bagItemInfo(itemId).max) return "stack";
      if (have === 0) free -= 1;
    }
    return free >= 0 ? "ok" : "full";
  }

  /**
   * Suma algo a la mochila (lo pedido, lo cosechado, lo gratis). Con `pick` y las manos libres (la casilla
   * elegida vacía) queda en la mano. `title`: el de la nota de una hoja recién impresa (la impresora ya lo
   * leyó de las notas de esa persona). Devuelve por qué no, si no cabe.
   */
  async add(userId: string, itemId: string, quantity = 1, opts: { pick?: boolean; title?: string } = {}): Promise<"ok" | "full" | "stack"> {
    const b = this.bag(userId);
    const fits = this.fits(userId, [[itemId, quantity]]);
    if (fits !== "ok") return fits;
    // La copia cambia ya (un segundo pedido seguido ve este); la base, en la cola.
    const free = !b.grid[b.selected];
    b.stacks.set(itemId, (b.stacks.get(itemId) ?? 0) + quantity);
    if (opts.title !== undefined) b.titles.set(itemId, opts.title);
    b.version += 1;
    this.arrange(userId, b);
    const slot = b.grid.findIndex((s) => s?.itemId === itemId);
    const pick = Boolean(opts.pick && free && slot >= 0);
    if (pick) b.selected = slot;
    this.emit(userId, b, pick);
    const saved = await this.enqueue(b, "addInventory", () => this.deps.repo().addInventory(userId, itemId, quantity));
    // No se guardó: la copia vuelve a lo que diga la base.
    if (saved === undefined) await this.load(userId);
    return "ok";
  }

  /**
   * Lo de antes de la mochila (`held.give(userId, id)`): da algo con un id de carta, de lo gratis o de un
   * dibujo de items.ts (un combo, cada parte por separado) y queda en la mano si estaban libres. Para lo
   * nuevo que se vende o se regala (la mercancía de un NPC): chequear antes `fits(userId, bagItemsOf(id)…)`
   * si se cobra, y llamar a esto después de cobrar.
   */
  async give(userId: string, id: string): Promise<"ok" | "full" | "stack"> {
    const parts = bagItemsOf(id);
    const items = parts.length ? parts : [objItemId(id)];
    const fits = this.fits(userId, items.map((i) => [i, 1] as const));
    if (fits !== "ok") return fits;
    for (const itemId of items) await this.add(userId, itemId, 1, { pick: true });
    return "ok";
  }

  /** Saca unidades (tirar un objeto). false = no tenía tantas. */
  async take(userId: string, itemId: string, quantity = 1): Promise<boolean> {
    const b = this.bag(userId);
    if ((b.stacks.get(itemId) ?? 0) < quantity) return false;
    const ok = await this.enqueue(b, "takeInventory", () => this.deps.repo().takeInventory(userId, itemId, quantity));
    if (!ok) {
      // La copia estaba vieja (lo sacó la web): se relee.
      await this.load(userId);
      return false;
    }
    this.remove(userId, b, itemId, quantity);
    return true;
  }

  private remove(userId: string, b: UserBag, itemId: string, quantity: number) {
    b.version += 1;
    const left = (b.stacks.get(itemId) ?? 0) - quantity;
    if (left > 0) b.stacks.set(itemId, left);
    else {
      b.stacks.delete(itemId);
      const id = objIdOf(itemId);
      if (id) b.uses.delete(id);
    }
    this.arrange(userId, b);
    this.emit(userId, b, false);
  }

  /** Elegir la casilla de la barra: lo que haya ahí queda en la mano (vacía o un mueble: manos libres). */
  select(userId: string, slot: number) {
    const b = this.bag(userId);
    if (!Number.isInteger(slot) || slot < 0 || slot >= BAG.slots || slot === b.selected) return;
    b.selected = slot;
    this.emitHeld(userId, b);
  }

  /** Llevar algo a otra casilla: si ahí había otra cosa, pasa a la casilla de donde salió. */
  move(userId: string, itemId: string, to: number): boolean {
    const b = this.bag(userId);
    if (!b.stacks.has(itemId) || !Number.isInteger(to) || to < 0 || to >= BAG.slots) return false;
    const from = b.grid.findIndex((s) => s?.itemId === itemId);
    if (from === to) return true;
    const other = b.grid[to]?.itemId;
    const changes: Record<string, number | null> = { [itemId]: to };
    b.version += 1;
    b.saved[itemId] = to;
    if (other) {
      // Lo que no tenía casilla (no cabía) deja su lugar a lo que se movía y queda aparte.
      if (from >= 0) b.saved[other] = from;
      else delete b.saved[other];
      changes[other] = from >= 0 ? from : null;
    }
    this.save(userId, b, changes);
    this.arrange(userId, b);
    this.emit(userId, b, false);
    return true;
  }

  /**
   * Usar lo de la mano: comer, tomar o fumar con F, o (con `tool`) lo que gasta el huerto (semillas,
   * agua de la regadera). Al acabar una unidad sale de la mochila y, si hay más, se sigue con otra.
   */
  use(userId: string, now: number, opts: { skipCooldown?: boolean; tool?: boolean } = {}): UseResult {
    const b = this.byUser.get(userId);
    const h = b && this.handOf(b);
    if (!b || !h || h.art === EMPTY_CAN) return { ok: false, error: "empty" };
    const info = bagItemInfo(h.itemId);
    // Las herramientas del huerto no se "comen" con F, y lo que no es de comer solo se lleva.
    if ((info.use === "tool") !== Boolean(opts.tool)) return { ok: false, error: "empty" };
    if (info.use === "consume" && !CONSUMABLES[h.art]) return { ok: false, error: "empty" };
    if (!info.use) return { ok: false, error: "empty" };
    // El sorbo del brindis no espera la pausa: el brindis ya tiene la suya.
    if (!opts.skipCooldown && now - b.lastUseAt < this.deps.cooldownMs()) return { ok: false, error: "busy" };
    b.lastUseAt = now;
    const left = h.left - 1;
    const result: UseResult = { ok: true, part: 0, art: h.art, action: consumeActionOf(h.art), left, done: left <= 0 };
    if (info.durable || left > 0) {
      b.uses.set(h.id, Math.max(0, left));
      this.emitHeld(userId, b);
    } else {
      // Se acabó esta unidad: sale de la mochila (lo que sigue en la pila empieza entera).
      b.uses.delete(h.id);
      void this.enqueue(b, "takeInventory", () => this.deps.repo().takeInventory(userId, h.itemId, 1));
      this.remove(userId, b, h.itemId, 1);
    }
    return result;
  }

  /** Se da entero lo de la mano (a una mascota): sale una unidad de la mochila. */
  takePart(userId: string, _part = 0) {
    const b = this.byUser.get(userId);
    const h = b && this.handOf(b);
    if (!b || !h || bagItemInfo(h.itemId).durable) return;
    b.uses.delete(h.id);
    void this.enqueue(b, "takeInventory", () => this.deps.repo().takeInventory(userId, h.itemId, 1));
    this.remove(userId, b, h.itemId, 1);
  }

  /** Llenar la regadera que se lleva en la mano (en el barril o el pozo). */
  fill(userId: string): boolean {
    const b = this.byUser.get(userId);
    const h = b && this.handOf(b);
    if (!b || h?.id !== WATERING_CAN) return false;
    b.uses.set(WATERING_CAN, HUERTO.canUses);
    this.emitHeld(userId, b);
    return true;
  }

  /** Acomoda las casillas y guarda las de lo nuevo (y olvida las de lo que ya no está). */
  private arrange(userId: string, b: UserBag) {
    const stacks = [...b.stacks].map(([itemId, quantity]) => ({ itemId, quantity })).sort((x, y) => x.itemId.localeCompare(y.itemId));
    const r = arrangeBag(stacks, b.saved);
    const changes: Record<string, number | null> = { ...r.assigned };
    for (const itemId of Object.keys(b.saved)) if (!b.stacks.has(itemId)) changes[itemId] = null;
    for (const [itemId, slot] of Object.entries(changes)) {
      if (slot === null) delete b.saved[itemId];
      else b.saved[itemId] = slot;
    }
    // Lo que no cabe no tiene casilla guardada.
    for (const s of r.overflow)
      if (b.saved[s.itemId] !== undefined) {
        delete b.saved[s.itemId];
        changes[s.itemId] = null;
      }
    b.grid = r.slots;
    b.overflow = r.overflow;
    this.save(userId, b, changes);
  }

  private save(userId: string, b: UserBag, changes: Record<string, number | null>) {
    if (Object.keys(changes).length === 0) return;
    void this.enqueue(b, "saveBagSlots", () => this.deps.repo().saveBagSlots(userId, changes));
  }

  private emit(userId: string, b: UserBag, pick: boolean) {
    const view = this.view(userId);
    this.deps.onBag(userId, pick ? { ...view, pick: true } : view);
    this.emitHeld(userId, b);
  }

  private emitHeld(userId: string, b: UserBag) {
    const h = this.handOf(b);
    this.deps.onHeld(userId, h?.art ?? "", h ? [h.left] : []);
  }
}
