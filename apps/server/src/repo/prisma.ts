import { awardPoints, prisma, type PresenceStatus as DbStatus } from "@hyvento/db";
import { HUMAN_AVATARS, Look, type ChatEvent, type HumanAvatar, type PointReason, type PresenceStatus } from "@hyvento/shared";
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

  async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, avatar: true, look: true } });
    if (!user) return null;
    const avatar = (HUMAN_AVATARS as readonly string[]).includes(user.avatar) ? (user.avatar as HumanAvatar) : "ada";
    const look = Look.safeParse(user.look);
    // Mismo nombre que va en el token de juego (ver /api/game-token).
    return { name: user.name || user.email, avatar, look: look.success ? look.data : null };
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

  async getPoints(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } });
    return user?.points ?? 0;
  }

  awardPoints(input: { userId: string; amount: number; reason: PointReason }) {
    return awardPoints(prisma, input);
  }
}
