import "server-only";
import { prisma } from "@hyvento/db";

/**
 * Asigna una oficina a un usuario (o la deja libre con `userId = null`).
 * Un usuario tiene como máximo una oficina: si ya tenía otra, la libera.
 * Al cambiar de dueño la oficina se abre (el candado era del dueño anterior).
 */
export async function assignOffice(zoneId: string, userId: string | null) {
  await prisma.$transaction(async (tx) => {
    if (userId) {
      await tx.office.updateMany({
        where: { ownerId: userId, NOT: { zoneId } },
        data: { ownerId: null, isLocked: false },
      });
    }
    await tx.office.update({ where: { zoneId }, data: { ownerId: userId, isLocked: false } });
  });
}

/** Primera oficina libre (por zoneId) para asignar automáticamente, o null si no hay. */
export async function firstFreeOffice() {
  return prisma.office.findFirst({ where: { ownerId: null }, orderBy: { zoneId: "asc" } });
}
