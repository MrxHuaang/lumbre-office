import "server-only";
import { addInventoryTx, prisma, type Prisma } from "@hyvento/db";

/**
 * Asigna una oficina a un usuario (o la deja libre con `userId = null`).
 * Un usuario tiene como máximo una oficina: si ya tenía otra, la libera.
 * Al cambiar de dueño la oficina se abre (el candado era del dueño anterior) y su decoración vuelve a
 * la mochila de quien la tenía: la oficina queda como la del mapa para la persona nueva.
 */
export async function assignOffice(zoneId: string, userId: string | null) {
  await prisma.$transaction(async (tx) => {
    if (userId) {
      const released = await tx.office.findMany({ where: { ownerId: userId, NOT: { zoneId } }, select: { id: true, ownerId: true } });
      for (const o of released) await returnDecor(tx, o);
      await tx.office.updateMany({
        where: { ownerId: userId, NOT: { zoneId } },
        data: { ownerId: null, isLocked: false },
      });
    }
    const current = await tx.office.findUniqueOrThrow({ where: { zoneId }, select: { id: true, ownerId: true } });
    if (current.ownerId !== userId) await returnDecor(tx, current);
    await tx.office.update({ where: { zoneId }, data: { ownerId: userId, isLocked: false } });
  });
}

/** Devuelve los muebles puestos a la mochila de la dueña o dueño y deja la oficina como la del mapa. */
async function returnDecor(tx: Prisma.TransactionClient, office: { id: string; ownerId: string | null }) {
  const items = await tx.officeItem.findMany({ where: { officeId: office.id }, select: { type: true } });
  if (office.ownerId) {
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.type, (counts.get(i.type) ?? 0) + 1);
    for (const [type, n] of counts) await addInventoryTx(tx, office.ownerId, type, n);
  }
  await tx.officeItem.deleteMany({ where: { officeId: office.id } });
  await tx.office.update({ where: { id: office.id }, data: { customized: false, floor: null, wallpaper: null } });
}

/** Primera oficina libre (por zoneId) para asignar automáticamente, o null si no hay. */
export async function firstFreeOffice() {
  return prisma.office.findFirst({ where: { ownerId: null }, orderBy: { zoneId: "asc" } });
}
