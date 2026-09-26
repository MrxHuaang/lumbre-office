import { DAILY_CAPS, dayStart, type ChatEvent, type PointReason, type PresenceStatus } from "@hyvento/shared";
import type { GameRepository, OfficeRecord, UserProfile } from "./types";

/** Repositorio en memoria para tests. */
export class MemoryRepository implements GameRepository {
  offices = new Map<string, OfficeRecord>();
  statuses = new Map<string, PresenceStatus>();
  profiles = new Map<string, UserProfile>();
  chat: ChatEvent[] = [];
  /** Libro de puntos en memoria. */
  ledger: { userId: string; amount: number; reason: PointReason; at: number; refId?: string }[] = [];

  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    for (const o of offices) {
      if (!this.offices.has(o.zoneId)) {
        this.offices.set(o.zoneId, { ...o, ownerId: null, ownerName: null, locked: false });
      }
    }
  }
  async listOffices() {
    return [...this.offices.values()].map((o) => ({ ...o }));
  }
  async setOfficeLocked(zoneId: string, locked: boolean) {
    const o = this.offices.get(zoneId);
    if (o) o.locked = locked;
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

  /** Helper de tests: asigna una oficina. */
  assign(zoneId: string, ownerId: string | null, ownerName: string | null) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.ownerId = ownerId;
    o.ownerName = ownerName;
  }
}
