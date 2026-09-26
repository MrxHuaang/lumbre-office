import { casinoTodayNetTx, getCasinoSettings, prisma } from "@hyvento/db";
import { CASINO, remainingToday } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

/**
 * La caja del casino: tu saldo, cómo vas hoy (ganado o perdido), el límite de pérdidas y cuánto te
 * queda, y el ranking semanal por ganancia neta en el casino.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const [settings, todayNet, sums] = await Promise.all([
    getCasinoSettings(prisma),
    casinoTodayNetTx(prisma, user.id),
    prisma.pointTransaction.groupBy({
      by: ["userId"],
      where: { reason: "CASINO", createdAt: { gte: new Date(Date.now() - CASINO.rankingDays * 86_400_000) } },
      _sum: { amount: true },
    }),
  ]);
  const top = sums
    .map((s) => ({ userId: s.userId, net: s._sum.amount ?? 0 }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 10);
  const people = await prisma.user.findMany({
    where: { id: { in: top.map((t) => t.userId) } },
    select: { id: true, name: true, avatar: true, look: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const ranking = top.flatMap((t) => {
    const p = byId.get(t.userId);
    return p ? [{ userId: p.id, name: p.name || "Alguien", avatar: asAvatar(p.avatar), look: asLook(p.look), net: t.net }] : [];
  });
  return NextResponse.json(
    {
      balance: user.points,
      enabled: settings.enabled,
      limit: settings.dailyLossLimit,
      todayNet,
      remaining: remainingToday(settings.dailyLossLimit, todayNet),
      days: CASINO.rankingDays,
      ranking,
      me: user.id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
