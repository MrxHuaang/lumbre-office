import { prisma } from "@hyvento/db";
import { claimedToday, dailyReward, nextStreak, type PointReason } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** Saldo, estado del buzón (racha y si ya reclamó hoy) y los últimos movimientos del usuario actual. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const moves = await prisma.pointTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, amount: true, reason: true, createdAt: true },
  });
  const claimed = claimedToday(user.lastDailyAt);
  // La racha que tendría al reclamar hoy (o la actual si ya reclamó).
  const streak = claimed ? user.streak : nextStreak(user.lastDailyAt, user.streak);
  return NextResponse.json(
    {
      balance: user.points,
      daily: { claimed, streak, reward: dailyReward(streak) },
      moves: moves.map((m) => ({ id: m.id, amount: m.amount, reason: m.reason as PointReason, at: m.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
