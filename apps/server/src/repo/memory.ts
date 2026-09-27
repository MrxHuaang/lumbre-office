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
  /** Bono de bienvenida de los tests: 0 (apagado) salvo que un test lo prenda. */
  welcomeBonus = 0;
  private welcomed = new Set<string>();
  async grantWelcome(userId: string) {
    if (this.welcomeBonus <= 0 || this.welcomed.has(userId)) return { granted: false, balance: await this.getPoints(userId) };
    this.welcomed.add(userId);
    this.ledger.push({ userId, amount: this.welcomeBonus, reason: "ADMIN", at: Date.now(), refId: "bienvenida" });
    return { granted: true, balance: await this.getPoints(userId) };
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
}
