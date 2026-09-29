// Permisos por persona (catálogo en `permisos.ts` de @hyvento/shared). Un admin los tiene todos sin fila;
// acá solo se guarda lo que se dio a mano y lo abierto a todos. Los ids que salieron del catálogo se ignoran.
import { isPermiso, type Permiso } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Permisos abiertos a todo el equipo ("todos pueden"). */
export async function permisosDeTodos(db: Db): Promise<Permiso[]> {
  const rows = await db.permissionSetting.findMany({ where: { everyone: true }, select: { permiso: true } });
  return rows.map((r) => r.permiso).filter(isPermiso);
}

/** Lo que se le dio a cada persona (sin contar admin ni "todos pueden"). */
export async function permisosDados(db: Db, userIds: readonly string[]): Promise<Record<string, Permiso[]>> {
  const out: Record<string, Permiso[]> = {};
  if (userIds.length === 0) return out;
  const rows = await db.userPermission.findMany({ where: { userId: { in: [...userIds] } }, select: { userId: true, permiso: true } });
  for (const r of rows) if (isPermiso(r.permiso)) (out[r.userId] ??= []).push(r.permiso);
  return out;
}

/** Dar o quitar un permiso a una persona (repetirlo no hace nada). */
export async function setPermiso(db: Db, input: { userId: string; permiso: Permiso; on: boolean; grantedById: string }) {
  const { userId, permiso } = input;
  if (input.on) {
    await db.userPermission.upsert({
      where: { userId_permiso: { userId, permiso } },
      create: { userId, permiso, grantedById: input.grantedById },
      update: {},
    });
  } else {
    await db.userPermission.deleteMany({ where: { userId, permiso } });
  }
}

/** Abrir o cerrar un permiso para todo el equipo. */
export async function setPermisoTodos(db: Db, input: { permiso: Permiso; on: boolean }) {
  await db.permissionSetting.upsert({
    where: { permiso: input.permiso },
    create: { permiso: input.permiso, everyone: input.on },
    update: { everyone: input.on },
  });
}
