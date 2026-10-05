import { prisma } from "@hyvento/db";
import { STORY_FLAGS, claimedToday, dailyReward, lettersFor, nextStreak, type PointReason } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Saldo, estado del buzón (racha y si ya reclamó hoy), las cartas de la historia, las banderas de los
 * capítulos terminados (para el diario de la mochila) y los últimos movimientos del usuario actual.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const moves = await prisma.pointTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, amount: true, reason: true, refId: true, createdAt: true },
  });
  // Las cartas del buzón: la de cada capítulo terminado, en orden (ver historia.ts).
  const story = await prisma.userStat.findMany({ where: { userId: user.id, key: { in: [...STORY_FLAGS] } }, select: { key: true, value: true } });
  const storyFlags: Record<string, number> = Object.fromEntries(story.map((s) => [s.key, s.value]));
  const letters = lettersFor(storyFlags);
  const claimed = claimedToday(user.lastDailyAt);
  // La racha que tendría al reclamar hoy (o la actual si ya reclamó).
  const streak = claimed ? user.streak : nextStreak(user.lastDailyAt, user.streak);
  return NextResponse.json(
    {
      balance: user.points,
      daily: { claimed, streak, reward: dailyReward(streak) },
      letters,
      storyFlags,
      moves: moves.map((m) => ({
        id: m.id,
        amount: m.amount,
        reason: m.reason as PointReason,
        refId: m.refId,
        at: m.createdAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
