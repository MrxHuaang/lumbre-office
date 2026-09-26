import { prisma, type PresenceStatus as DbStatus } from "@hyvento/db";
import type { ChatEvent, PresenceStatus } from "@hyvento/shared";
import type { GameRepository } from "./types";

const toDbStatus = (s: PresenceStatus) => s.toUpperCase() as DbStatus;
const fromDbStatus = (s: DbStatus) => s.toLowerCase() as PresenceStatus;

export class PrismaRepository implements GameRepository {
  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    await prisma.$transaction(
      offices.map((o) =>
        prisma.office.upsert({ where: { zoneId: o.zoneId }, create: o, update: {} }),
      ),
    );
  }

  async listOffices() {
    const rows = await prisma.office.findMany({ include: { owner: { select: { name: true } } } });
    return rows.map((o) => ({
      zoneId: o.zoneId,
      name: o.name,
      ownerId: o.ownerId,
      ownerName: o.owner?.name ?? null,
      locked: o.isLocked,
    }));
  }

  async setOfficeLocked(zoneId: string, locked: boolean) {
    await prisma.office.update({ where: { zoneId }, data: { isLocked: locked } });
  }

  async getUserStatus(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    return user ? fromDbStatus(user.status) : null;
  }

  async setUserStatus(userId: string, status: PresenceStatus) {
    await prisma.user.update({ where: { id: userId }, data: { status: toDbStatus(status) } });
  }

  async loadGlobalChat(limit: number) {
    const rows = await prisma.chatMessage.findMany({
      where: { scope: "GLOBAL" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { name: true } } },
    });
    return rows.reverse().map(
      (m): ChatEvent => ({
        id: m.id,
        // No es una sesión viva: los globos solo se muestran para mensajes recientes.
        fromId: `user:${m.authorId}`,
        fromName: m.author.name,
        text: m.text,
        scope: "global",
        zoneId: m.zoneId,
        ts: m.createdAt.getTime(),
      }),
    );
  }

  async saveChat(event: ChatEvent, authorUserId: string) {
    // Solo se persiste el canal global; el chat de proximidad/oficina es efímero.
    if (event.scope !== "global") return;
    await prisma.chatMessage.create({
      data: {
        id: event.id,
        authorId: authorUserId,
        scope: "GLOBAL",
        zoneId: event.zoneId,
        text: event.text,
        createdAt: new Date(event.ts),
      },
    });
  }
}
