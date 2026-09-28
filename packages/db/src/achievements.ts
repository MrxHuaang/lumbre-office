// Logros y estadísticas del perfil: contadores por persona (UserStat) y logros desbloqueados
// (UserAchievement). El catálogo y las reglas están en @hyvento/shared (achievements.ts); acá solo se guarda.
import { BAG_SLOT_PREFIX, type StatChange } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

/** Suma `by` a un contador (lo crea si no existe). */
export async function bumpStat(client: Client, userId: string, key: string, by = 1): Promise<void> {
  if (!Number.isFinite(by) || by === 0) return;
  const inc = Math.round(by);
  await client.userStat.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: inc },
    update: { value: { increment: inc } },
  });
}

/**
 * Guarda el máximo entre lo que había y `value` (el pez más grande, la racha más larga). Un solo
 * INSERT … ON CONFLICT: dos avisos a la vez nunca bajan el valor.
 */
export async function setStatMax(client: Client, userId: string, key: string, value: number): Promise<void> {
  if (!Number.isFinite(value)) return;
  const v = Math.round(value);
  await client.$executeRaw`
    INSERT INTO "UserStat" ("userId", "key", "value", "updatedAt")
    VALUES (${userId}, ${key}, ${v}, NOW())
    ON CONFLICT ("userId", "key") DO UPDATE
    SET "value" = GREATEST("UserStat"."value", EXCLUDED."value"), "updatedAt" = NOW()
    WHERE "UserStat"."value" < EXCLUDED."value"`;
}

/** Varios cambios de una vez (lo que el servidor de juego juntó en unos segundos), en una transacción. */
export async function applyStatChanges(client: PrismaClient, userId: string, changes: StatChange[]): Promise<void> {
  if (changes.length === 0) return;
  await client.$transaction(async (tx) => {
    for (const c of changes) {
      if (c.op === "inc") await bumpStat(tx, userId, c.key, c.value);
      else await setStatMax(tx, userId, c.key, c.value);
    }
  });
}

/** Desbloquea un logro. Idempotente: devuelve true solo la primera vez. */
export async function unlockAchievement(client: Client, userId: string, achievementId: string, at?: Date): Promise<boolean> {
  const r = await client.userAchievement.createMany({
    data: [{ userId, achievementId, unlockedAt: at ?? new Date() }],
    skipDuplicates: true,
  });
  return r.count === 1;
}

export interface AchievementRecord {
  stats: Record<string, number>;
  /** id del logro → cuándo se desbloqueó. */
  unlocked: Record<string, Date>;
}

/** Contadores y logros de alguien (para el perfil y para que el servidor de juego sepa desde dónde sigue). */
export async function loadAchievementRecord(client: Client, userId: string): Promise<AchievementRecord> {
  const [stats, unlocked] = await Promise.all([
    // Las casillas de la mochila también viven en UserStat, pero no son estadísticas.
    client.userStat.findMany({ where: { userId, NOT: { key: { startsWith: BAG_SLOT_PREFIX } } }, select: { key: true, value: true } }),
    client.userAchievement.findMany({ where: { userId }, select: { achievementId: true, unlockedAt: true } }),
  ]);
  return {
    stats: Object.fromEntries(stats.map((s) => [s.key, s.value])),
    unlocked: Object.fromEntries(unlocked.map((u) => [u.achievementId, u.unlockedAt])),
  };
}

/** Cuántas personas tienen cada logro (para mostrar qué tan raro es en el equipo). */
export async function achievementCounts(client: Client): Promise<Record<string, number>> {
  const rows = await client.userAchievement.groupBy({ by: ["achievementId"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.achievementId, r._count._all]));
}
