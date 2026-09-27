import {
  CASINO,
  DAILY_CAPS,
  dayStart,
  remainingToday,
  type CasinoSettingsDTO,
  type ChatEvent,
  type OfficeItemDTO,
  type PointReason,
  type PresenceStatus,
} from "@hyvento/shared";
import type { GameRepository, OfficeItemsInput, OfficeItemsResult, OfficeRecord, UserProfile } from "./types";
import { giftAllowedToday, type ItemStack } from "@hyvento/shared";
import type { TradeResult, TradeSideInput } from "./types";

/** Repositorio en memoria para tests. */
export class MemoryRepository implements GameRepository {
  offices = new Map<string, OfficeRecord>();
  statuses = new Map<string, PresenceStatus>();
  profiles = new Map<string, UserProfile>();
  chat: ChatEvent[] = [];
  /** Libro de puntos en memoria. */
  ledger: { userId: string; amount: number; reason: PointReason; at: number; refId?: string }[] = [];
  /** Mochilas: `${userId}:${itemId}` → unidades guardadas. */
  inventory = new Map<string, number>();
  private nextItemId = 1;

  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    for (const o of offices) {
      if (!this.offices.has(o.zoneId)) {
        this.offices.set(o.zoneId, { ...o, ownerId: null, ownerName: null, locked: false, floor: null, wallpaper: null, customized: false, items: [] });
      }
    }
  }
  async listOffices() {
    return [...this.offices.values()].map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }));
  }
  async setOfficeLocked(zoneId: string, locked: boolean) {
    const o = this.offices.get(zoneId);
    if (o) o.locked = locked;
  }

  async editOfficeItems({ zoneId, userId, defaults, edit }: OfficeItemsInput): Promise<OfficeItemsResult> {
    const office = this.offices.get(zoneId);
    if (!office) return { ok: false, error: "unknown" };
    // Se trabaja sobre copias y se guarda al final: si algo falla no queda nada a medias (como la transacción).
    let items = office.items.map((i) => ({ ...i }));
    const ids = new Map<string, string>();
    if (!office.customized) {
      for (const d of defaults) {
        const id = `item-${this.nextItemId++}`;
        ids.set(d.id, id);
        items.push({ ...d, id });
      }
    }
    const inventory = new Map(this.inventory);
    const key = (itemId: string) => `${userId}:${itemId}`;
    switch (edit.action) {
      case "place": {
        const have = inventory.get(key(edit.type)) ?? 0;
        if (have < 1) return { ok: false, error: "not-owned" };
        inventory.set(key(edit.type), have - 1);
        items.push({ id: `item-${this.nextItemId++}`, type: edit.type, x: edit.x, y: edit.y, facing: edit.facing });
        break;
      }
      case "move": {
        const id = ids.get(edit.itemId) ?? edit.itemId;
        const item = items.find((i) => i.id === id);
        if (!item) return { ok: false, error: "unknown" };
        Object.assign(item, { x: edit.x, y: edit.y, facing: edit.facing });
        break;
      }
      case "remove": {
        const id = ids.get(edit.itemId) ?? edit.itemId;
        const item = items.find((i) => i.id === id);
        if (!item) return { ok: false, error: "unknown" };
        items = items.filter((i) => i !== item);
        inventory.set(key(item.type), (inventory.get(key(item.type)) ?? 0) + 1);
        break;
      }
    }
    office.items = items;
    office.customized = true;
    this.inventory = inventory;
    return { ok: true, items: items.map((i) => ({ ...i })) };
  }

  async setOfficeStyle(zoneId: string, style: { floor?: string; wallpaper?: string }) {
    const o = this.offices.get(zoneId);
    if (!o) return;
    if (style.floor) o.floor = style.floor;
    if (style.wallpaper) o.wallpaper = style.wallpaper;
  }

  async getUserStatus(userId: string) {
    return this.statuses.get(userId) ?? null;
  }
  async getUserProfile(userId: string) {
    return this.profiles.get(userId) ?? null;
  }
  async setUserStatus(userId: string, status: PresenceStatus) {
    this.statuses.set(userId, status);
  }
  async loadGlobalChat(limit: number) {
    return this.chat.slice(-limit);
  }
  async saveChat(event: ChatEvent) {
    if (event.scope === "global") this.chat.push(event);
  }

  async getPoints(userId: string) {
    return this.ledger.filter((m) => m.userId === userId).reduce((a, m) => a + m.amount, 0);
  }
  async awardPoints({ userId, amount, reason }: { userId: string; amount: number; reason: PointReason }) {
    const now = Date.now();
    const cap = DAILY_CAPS[reason];
    if (cap !== null) {
      const today = this.ledger
        .filter((m) => m.userId === userId && m.reason === reason && m.at >= dayStart(now))
        .reduce((a, m) => a + m.amount, 0);
      amount = Math.min(amount, cap - today);
    }
    if (amount > 0) this.ledger.push({ userId, amount, reason, at: now });
    return { awarded: Math.max(0, amount), balance: await this.getPoints(userId) };
  }
  async spendPoints({ userId, amount, reason, refId }: { userId: string; amount: number; reason: PointReason; refId?: string }) {
    const balance = await this.getPoints(userId);
    if (balance < amount) return { ok: false, balance };
    this.ledger.push({ userId, amount: -amount, reason, at: Date.now(), refId });
    return { ok: true, balance: balance - amount };
  }

  /** Ajustes del casino en memoria (los tests los cambian directo). */
  casinoSettings: CasinoSettingsDTO = { enabled: true, dailyLossLimit: CASINO.defaultDailyLossLimit };
  async getCasinoSettings() {
    return { ...this.casinoSettings };
  }
  async casinoBet({ userId, amount, refId, limit }: { userId: string; amount: number; refId: string; limit: number }) {
    const net = this.ledger
      .filter((m) => m.userId === userId && m.reason === "CASINO" && m.at >= dayStart(Date.now()))
      .reduce((a, m) => a + m.amount, 0);
    const balance = await this.getPoints(userId);
    if (amount > remainingToday(limit, net)) return { ok: false as const, error: "limit" as const, balance };
    const spent = await this.spendPoints({ userId, amount, reason: "CASINO", refId });
    return spent.ok ? { ok: true as const, balance: spent.balance } : { ok: false as const, error: "funds" as const, balance: spent.balance };
  }
  async casinoPayout({ userId, amount, refId }: { userId: string; amount: number; refId: string }) {
    if (amount > 0) this.ledger.push({ userId, amount, reason: "CASINO", at: Date.now(), refId });
    return { balance: await this.getPoints(userId) };
  }

  /** Helper de tests: asigna una oficina. */
  assign(zoneId: string, ownerId: string | null, ownerName: string | null) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.ownerId = ownerId;
    o.ownerName = ownerName;
  }

  /** Helper de tests: mete unidades en la mochila de alguien. */
  give(userId: string, itemId: string, quantity = 1) {
    const key = `${userId}:${itemId}`;
    this.inventory.set(key, (this.inventory.get(key) ?? 0) + quantity);
  }

  /** Helper de tests: unidades guardadas. */
  held(userId: string, itemId: string) {
    return this.inventory.get(`${userId}:${itemId}`) ?? 0;
  }

  /** Helper de tests: decora una oficina a mano. */
  decorate(zoneId: string, items: OfficeItemDTO[]) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.items = items.map((i) => ({ ...i }));
    o.customized = true;
  }

  // ---------- Regalos e intercambios ----------

  async getInventory(userId: string): Promise<ItemStack[]> {
    const prefix = `${userId}:`;
    return [...this.inventory]
      .filter(([key, quantity]) => key.startsWith(prefix) && quantity > 0)
      .map(([key, quantity]) => ({ itemId: key.slice(prefix.length), quantity }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }

  async givenPointsToday(userId: string, now = Date.now()) {
    const since = dayStart(now);
    return -this.ledger.filter((m) => m.userId === userId && m.reason === "GIFT" && m.amount < 0 && m.at >= since).reduce((sum, m) => sum + m.amount, 0);
  }

  /** Si se fija, `executeTrade` espera esta promesa antes de escribir (para probar lo que pasa mientras). */
  tradeGate: Promise<void> | null = null;

  async executeTrade({ refId, a, b }: { refId: string; a: TradeSideInput; b: TradeSideInput }): Promise<TradeResult> {
    if (this.tradeGate) await this.tradeGate;
    // Todo se revalida y se aplica sobre copias: si algo no alcanza no queda nada a medias (como la transacción).
    const inventory = new Map(this.inventory);
    const moves: typeof this.ledger = [];
    const now = Date.now();
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      if (from.points > 0) {
        const given = await this.givenPointsToday(from.userId, now);
        if (giftAllowedToday({ gifts: 0, points: given }, from.points) !== "ok") return { ok: false, error: "limit", userId: from.userId };
        if ((await this.getPoints(from.userId)) < from.points) return { ok: false, error: "funds", userId: from.userId };
        moves.push({ userId: from.userId, amount: -from.points, reason: "GIFT", at: now, refId });
        moves.push({ userId: to.userId, amount: from.points, reason: "GIFT", at: now, refId });
      }
      for (const it of from.items) {
        const have = inventory.get(`${from.userId}:${it.itemId}`) ?? 0;
        if (have < it.quantity) return { ok: false, error: "items", userId: from.userId };
        inventory.set(`${from.userId}:${it.itemId}`, have - it.quantity);
      }
    }
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const)
      for (const it of from.items) inventory.set(`${to.userId}:${it.itemId}`, (inventory.get(`${to.userId}:${it.itemId}`) ?? 0) + it.quantity);
    this.inventory = inventory;
    this.ledger.push(...moves);
    return { ok: true, balances: { [a.userId]: await this.getPoints(a.userId), [b.userId]: await this.getPoints(b.userId) } };
  }
}
