import { awardPointsTx, prisma } from "@hyvento/db";
import { claimedToday, dailyReward, dayStart, nextStreak } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishPointsChanged } from "@/lib/events";

/** Reclamar la recompensa diaria del buzón: una vez por día (de Bogotá), más puntos con la racha. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (claimedToday(user.lastDailyAt)) return NextResponse.json({ error: "Ya reclamaste la recompensa de hoy" }, { status: 409 });

  const now = Date.now();
  const streak = nextStreak(user.lastDailyAt, user.streak, now);
  const reward = dailyReward(streak);
  const result = await prisma.$transaction(async (tx) => {
    // Solo si nadie reclamó hoy entre medio (doble clic, dos pestañas): update condicional.
    const claimed = await tx.user.updateMany({
      where: { id: user.id, OR: [{ lastDailyAt: null }, { lastDailyAt: { lt: new Date(dayStart(now)) } }] },
      data: { lastDailyAt: new Date(now), streak },
    });
    if (claimed.count === 0) return null;
    return awardPointsTx(tx, { userId: user.id, amount: reward, reason: "DAILY", now });
  });
  if (!result) return NextResponse.json({ error: "Ya reclamaste la recompensa de hoy" }, { status: 409 });

  await publishPointsChanged(user.id);
  return NextResponse.json({ reward, streak, balance: result.balance });
}
