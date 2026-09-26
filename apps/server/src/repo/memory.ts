import type { ChatEvent, PresenceStatus } from "@hyvento/shared";
import type { GameRepository, OfficeRecord } from "./types";

/** Repositorio en memoria para tests. */
export class MemoryRepository implements GameRepository {
  offices = new Map<string, OfficeRecord>();
  statuses = new Map<string, PresenceStatus>();
  chat: ChatEvent[] = [];

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
  async setUserStatus(userId: string, status: PresenceStatus) {
    this.statuses.set(userId, status);
  }
  async loadGlobalChat(limit: number) {
    return this.chat.slice(-limit);
  }
  async saveChat(event: ChatEvent) {
    if (event.scope === "global") this.chat.push(event);
  }

  /** Helper de tests: asigna una oficina. */
  assign(zoneId: string, ownerId: string | null, ownerName: string | null) {
    const o = this.offices.get(zoneId);
    if (!o) throw new Error(`No existe ${zoneId}`);
    o.ownerId = ownerId;
    o.ownerName = ownerName;
  }
}
