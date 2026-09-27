import {
  addInventoryTx,
  awardPoints,
  grantWelcomeBonus,
  casinoBet,
  getCasinoSettings,
  type PresenceStatus as DbStatus,
  prisma,
  type Prisma,
  spendPoints,
  takeInventoryTx,
} from "@hyvento/db";
import {
  DIRECTIONS,
  HUMAN_AVATARS,
  Look,
  type ChatEvent,
  type Direction,
  type HumanAvatar,
  type OfficeItemDTO,
  type PointReason,
  type PresenceStatus,
} from "@hyvento/shared";
import type { GameRepository, OfficeItemsInput, OfficeItemsResult } from "./types";

const toDbStatus = (s: PresenceStatus) => s.toUpperCase() as DbStatus;
const fromDbStatus = (s: DbStatus) => s.toLowerCase() as PresenceStatus;

const toItemDTO = (i: { id: string; type: string; x: number; y: number; facing: string }): OfficeItemDTO => ({
  id: i.id,
  type: i.type,
  x: i.x,
  y: i.y,
  facing: (DIRECTIONS as readonly string[]).includes(i.facing) ? (i.facing as Direction) : "right",
});

/** Corta la transacción del editor (se deshace todo) con el motivo para responder. */
class EditAborted extends Error {
  constructor(readonly code: "not-owned" | "unknown") {
    super(code);
  }
}

export class PrismaRepository implements GameRepository {
  async ensureOffices(offices: { zoneId: string; name: string }[]) {
    await prisma.$transaction(
      offices.map((o) =>
        prisma.office.upsert({ where: { zoneId: o.zoneId }, create: o, update: {} }),
      ),
    );
  }

  async listOffices() {
    const rows = await prisma.office.findMany({
      include: { owner: { select: { name: true } }, items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
    });
    return rows.map((o) => ({
      zoneId: o.zoneId,
      name: o.name,
      ownerId: o.ownerId,
      ownerName: o.owner?.name ?? null,
      locked: o.isLocked,
      floor: o.floor,
      wallpaper: o.wallpaper,
      customized: o.customized,
      items: o.items.map(toItemDTO),
    }));
  }

  async editOfficeItems({ zoneId, userId, defaults, edit }: OfficeItemsInput): Promise<OfficeItemsResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        const office = await tx.office.findUnique({ where: { zoneId }, select: { id: true } });
        if (!office) throw new EditAborted("unknown");
        const officeId = office.id;
        // Primera edición: los muebles del mapa pasan a ser filas propias. El update condicional hace que
        // se copien una sola vez aunque lleguen dos cambios a la vez.
        const ids = new Map<string, string>();
        const first = await tx.office.updateMany({ where: { id: officeId, customized: false }, data: { customized: true } });
        if (first.count === 1) {
          for (const d of defaults) {
            const row = await tx.officeItem.create({ data: { officeId, type: d.type, x: d.x, y: d.y, facing: d.facing }, select: { id: true } });
            ids.set(d.id, row.id);
          }
        }
        const itemId = (id: string) => ids.get(id) ?? id;

        switch (edit.action) {
          case "place": {
            // Descuento condicional: sin unidades en la mochila no se pone nada.
            if (!(await takeInventoryTx(tx, userId, edit.type))) throw new EditAborted("not-owned");
            await tx.officeItem.create({ data: { officeId, type: edit.type, x: edit.x, y: edit.y, facing: edit.facing } });
            break;
          }
          case "move": {
            const moved = await tx.officeItem.updateMany({
              where: { id: itemId(edit.itemId), officeId },
              data: { x: edit.x, y: edit.y, facing: edit.facing },
            });
            if (moved.count === 0) throw new EditAborted("unknown");
            break;
          }
          case "remove": {
            const row = await tx.officeItem.findFirst({ where: { id: itemId(edit.itemId), officeId }, select: { id: true, type: true } });
            if (!row) throw new EditAborted("unknown");
            await tx.officeItem.delete({ where: { id: row.id } });
            await addInventoryTx(tx, userId, row.type, 1);
            break;
          }
        }
        const items = await tx.officeItem.findMany({ where: { officeId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
        return { ok: true as const, items: items.map(toItemDTO) };
      });
    } catch (err) {
      if (err instanceof EditAborted) return { ok: false, error: err.code };
      throw err;
    }
  }

  async setOfficeStyle(zoneId: string, style: { floor?: string; wallpaper?: string }) {
    await prisma.office.update({ where: { zoneId }, data: { floor: style.floor, wallpaper: style.wallpaper } });
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
  grantWelcome(userId: string) {
    return grantWelcomeBonus(prisma, userId);
  }

  spendPoints(input: { userId: string; amount: number; reason: PointReason; refId?: string }) {
    return spendPoints(prisma, input);
  }

  getCasinoSettings() {
    return getCasinoSettings(prisma);
  }

  async loadWorldEdits() {
    const rows = await prisma.worldLayout.findMany();
    return Object.fromEntries(rows.map((r) => [r.area, r.edits as unknown]));
  }

  async saveWorldEdits(area: string, edits: unknown, userId: string) {
    const json = edits as Prisma.InputJsonValue;
    await prisma.worldLayout.upsert({ where: { area }, create: { area, edits: json, updatedBy: userId }, update: { edits: json, updatedBy: userId } });
  }

  casinoBet(input: { userId: string; amount: number; refId: string; limit: number }) {
    return casinoBet(prisma, input);
  }

  async casinoPayout({ userId, amount, refId }: { userId: string; amount: number; refId: string }) {
    const { balance } = await awardPoints(prisma, { userId, amount, reason: "CASINO", refId });
    return { balance };
  }
}
