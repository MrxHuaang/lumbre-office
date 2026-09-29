// Encargos: el progreso de cada persona (QuestProgress) y la experiencia de los oficios (SkillXp). El
// catálogo, quién recibe qué y las reglas están en @hyvento/shared (encargos.ts); acá solo se guarda. El
// servidor de juego avanza los encargos junto con los contadores (misma transacción que `applyStatChanges`)
// y la web, cuando suma un contador por su lado (`bumpStatWithQuests`).
import { DAILY_CAPS, currentQuests, dayStart, questDeltas, STORY_PERIOD, type QuestDelta, type QuestRecord } from "@hyvento/shared";
import type { Prisma, PrismaClient } from "@prisma/client";
import { bumpStat } from "./achievements";
import { awardPointsTx } from "./points";

type Client = PrismaClient | Prisma.TransactionClient;

const toRecord = (r: { questId: string; period: string; progress: number; goal: number; status: string }): QuestRecord => ({
  questId: r.questId,
  period: r.period,
  progress: r.progress,
  goal: r.goal,
  status: r.status as QuestRecord["status"],
});

/**
 * Los encargos guardados de alguien en esos períodos (y los pasos de historia). Antes crea los que le tocan
 * y todavía no estaban (`assign`): así el encargo queda asignado desde que se mira, aunque no avance.
 */
export async function loadQuests(client: Client, userId: string, periods: readonly string[], assign: readonly { questId: string; period: string; goal: number }[] = []): Promise<QuestRecord[]> {
  if (assign.length) {
    await client.questProgress.createMany({
      data: assign.map((a) => ({ userId, questId: a.questId, period: a.period, goal: a.goal })),
      skipDuplicates: true,
    });
  }
  const rows = await client.questProgress.findMany({
    where: { userId, period: { in: [...new Set([...periods, STORY_PERIOD])] } },
    select: { questId: true, period: true, progress: true, goal: true, status: true },
  });
  return rows.map(toRecord);
}

/**
 * Avanza encargos (sin pasarse de la meta): el que llega queda DONE; los cumplidos o entregados no se
 * tocan. Si no existía la fila, la crea. Devuelve los que se cumplieron ahora.
 */
export async function advanceQuestsTx(tx: Prisma.TransactionClient, userId: string, deltas: readonly QuestDelta[], now = Date.now()): Promise<QuestDelta[]> {
  const done: QuestDelta[] = [];
  for (const d of deltas) {
    if (!(d.delta > 0)) continue;
    const key = { userId, questId: d.questId, period: d.period };
    // La fila se crea si falta sin chocar: si la web y el servidor la crean a la vez, la segunda espera
    // a la primera y no hace nada (en vez de tumbar la transacción por la llave repetida).
    await tx.questProgress.createMany({ data: [{ ...key, goal: d.goal, createdAt: new Date(now) }], skipDuplicates: true });
    // El UPDATE bloquea la fila hasta el final: dos avances a la vez se suman bien.
    const bumped = await tx.questProgress.updateMany({ where: { ...key, status: "ACTIVE" }, data: { progress: { increment: Math.round(d.delta) } } });
    if (bumped.count === 0) continue; // ya cumplido o entregado
    const closed = await tx.questProgress.updateMany({
      where: { ...key, status: "ACTIVE", progress: { gte: d.goal } },
      data: { status: "DONE", progress: d.goal, doneAt: new Date(now) },
    });
    if (closed.count > 0) done.push(d);
  }
  return done;
}

/**
 * La web sumó un contador (una misión, una foto): lo suma y avanza los encargos de hoy que lo siguen. Lo
 * que depende de la noche o del clima no avanza desde acá (la web no lo sabe).
 */
export async function bumpStatWithQuests(client: PrismaClient, userId: string, key: string, by = 1, now = Date.now()): Promise<QuestDelta[]> {
  return client.$transaction((tx) => bumpStatWithQuestsTx(tx, userId, key, by, now));
}

export async function bumpStatWithQuestsTx(tx: Prisma.TransactionClient, userId: string, key: string, by = 1, now = Date.now()): Promise<QuestDelta[]> {
  await bumpStat(tx, userId, key, by);
  return advanceQuestsTx(tx, userId, questDeltas(currentQuests(userId, now), key, by, {}), now);
}

export interface ClaimQuestInput {
  userId: string;
  questId: string;
  period: string;
  points: number;
  skill: string;
  xp: number;
  /** Historias: el paso siguiente, que se abre al entregar este. */
  next?: { questId: string; goal: number };
  now?: number;
}

export type ClaimQuestResult = { ok: true; awarded: number; balance: number } | { ok: false; error: "not-done" | "claimed" | "capped" };

/**
 * Entrega un encargo cumplido, todo en una transacción: lo marca entregado (solo si estaba DONE: dos
 * entregas a la vez pagan una sola), paga los puntos (QUEST, con su tope diario), suma la experiencia del
 * oficio y, si es una historia, abre el paso siguiente. Si los puntos no caben enteros bajo el tope de hoy
 * no se entrega (`capped`): queda cumplido para mañana, dentro del día de gracia, en vez de perderse.
 */
export async function claimQuestTx(tx: Prisma.TransactionClient, input: ClaimQuestInput): Promise<ClaimQuestResult> {
  const { userId, questId, period } = input;
  const now = input.now ?? Date.now();
  const cap = DAILY_CAPS.QUEST;
  if (cap !== null && input.points > 0) {
    // Se bloquea la fila: dos entregas a la vez no leen la misma suma.
    await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const today = await tx.pointTransaction.aggregate({ where: { userId, reason: "QUEST", createdAt: { gte: new Date(dayStart(now)) } }, _sum: { amount: true } });
    if ((today._sum.amount ?? 0) + input.points > cap) {
      const row = await tx.questProgress.findUnique({ where: { userId_questId_period: { userId, questId, period } }, select: { status: true } });
      if (row?.status === "DONE") return { ok: false, error: "capped" };
    }
  }
  const marked = await tx.questProgress.updateMany({ where: { userId, questId, period, status: "DONE" }, data: { status: "CLAIMED", claimedAt: new Date(now) } });
  if (marked.count === 0) {
    const row = await tx.questProgress.findUnique({ where: { userId_questId_period: { userId, questId, period } }, select: { status: true } });
    return { ok: false, error: row?.status === "CLAIMED" ? "claimed" : "not-done" };
  }
  const paid =
    input.points > 0
      ? await awardPointsTx(tx, { userId, amount: input.points, reason: "QUEST", refId: `encargo:${questId}:${period}`, now })
      : { awarded: 0, balance: (await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { points: true } })).points };
  if (input.xp > 0) {
    await tx.skillXp.upsert({
      where: { userId_skill: { userId, skill: input.skill } },
      create: { userId, skill: input.skill, xp: input.xp },
      update: { xp: { increment: input.xp } },
    });
  }
  if (input.next) {
    await tx.questProgress.createMany({ data: [{ userId, questId: input.next.questId, period: STORY_PERIOD, goal: input.next.goal }], skipDuplicates: true });
  }
  return { ok: true, awarded: paid.awarded, balance: paid.balance };
}

export function claimQuest(client: PrismaClient, input: ClaimQuestInput): Promise<ClaimQuestResult> {
  return client.$transaction((tx) => claimQuestTx(tx, input));
}

/** Experiencia de cada oficio de alguien. */
export async function loadSkillXp(client: Client, userId: string): Promise<Record<string, number>> {
  const rows = await client.skillXp.findMany({ where: { userId }, select: { skill: true, xp: true } });
  return Object.fromEntries(rows.map((r) => [r.skill, r.xp]));
}
