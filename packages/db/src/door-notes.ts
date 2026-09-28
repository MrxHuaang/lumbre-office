// Notas en la puerta: las deja el servidor de juego (con el tope diario de quien la deja, contado en la
// misma transacción) y las lee y borra solo su destinatario desde la web. Ver door-notes.ts de @hyvento/shared.
import { DOOR_NOTES, doorNotesDayStart, doorNotesLeft, type DoorNoteDTO } from "@hyvento/shared";
import type { PrismaClient } from "@prisma/client";

export interface DoorNoteInput {
  fromId: string;
  toId: string;
  zoneId: string;
  /** Ya limpio (cleanDoorNote). */
  text: string;
  now?: number;
}

export type DoorNoteSaved = { ok: true; left: number; unread: number } | { ok: false; error: "limit" };

export function leaveDoorNote(client: PrismaClient, input: DoorNoteInput): Promise<DoorNoteSaved> {
  const now = input.now ?? Date.now();
  return client.$transaction(async (tx) => {
    // Se bloquea la fila de quien la deja: dos notas a la vez no se saltan el tope.
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${input.fromId} FOR UPDATE`;
    const sent = await tx.doorNote.count({ where: { fromId: input.fromId, createdAt: { gte: new Date(doorNotesDayStart(now)) } } });
    if (sent >= DOOR_NOTES.perDay) return { ok: false as const, error: "limit" as const };
    await tx.doorNote.create({ data: { fromId: input.fromId, toId: input.toId, zoneId: input.zoneId, text: input.text, createdAt: new Date(now) } });
    // Se guardan las últimas: lo leído más viejo se va.
    const old = await tx.doorNote.findMany({
      where: { toId: input.toId, readAt: { not: null } },
      orderBy: { createdAt: "desc" },
      skip: DOOR_NOTES.keep,
      select: { id: true },
    });
    if (old.length) await tx.doorNote.deleteMany({ where: { id: { in: old.map((n) => n.id) } } });
    const unread = await tx.doorNote.count({ where: { toId: input.toId, readAt: null } });
    return { ok: true as const, left: doorNotesLeft(sent + 1), unread };
  });
}

/** Notas sin leer de cada persona (las que no tienen, no vienen). */
export async function unreadDoorNotes(client: PrismaClient, userIds: string[]): Promise<Record<string, number>> {
  if (userIds.length === 0) return {};
  const rows = await client.doorNote.groupBy({ by: ["toId"], where: { toId: { in: userIds }, readAt: null }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.toId, r._count._all]));
}

/** Las notas de alguien, de la más nueva a la más vieja (solo las suyas). */
export async function listDoorNotes(client: PrismaClient, userId: string): Promise<DoorNoteDTO[]> {
  const rows = await client.doorNote.findMany({
    where: { toId: userId },
    orderBy: { createdAt: "desc" },
    take: DOOR_NOTES.keep,
    select: { id: true, text: true, createdAt: true, readAt: true, from: { select: { name: true } } },
  });
  return rows.map((n) => ({ id: n.id, fromName: n.from.name || "Alguien", text: n.text, createdAt: n.createdAt.toISOString(), read: Boolean(n.readAt) }));
}

/** Marca como leídas todas las notas de alguien; devuelve cuántas cambiaron. */
export async function markDoorNotesRead(client: PrismaClient, userId: string, now = Date.now()): Promise<number> {
  const r = await client.doorNote.updateMany({ where: { toId: userId, readAt: null }, data: { readAt: new Date(now) } });
  return r.count;
}

/** Borra una nota, solo si es de quien la pide (false = no existe o es ajena). */
export async function deleteDoorNote(client: PrismaClient, userId: string, id: string): Promise<boolean> {
  const r = await client.doorNote.deleteMany({ where: { id, toId: userId } });
  return r.count > 0;
}
