import { casinoStats, casinoTodayNetTx, getCasinoSettings, prisma } from "@hyvento/db";
import { CASINO, casinoRankings, type CasinoPeriod, type CasinoPlayerStats } from "@hyvento/shared";
import { NextResponse, type NextRequest } from "next/server";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

/**
 * La caja del casino: tu saldo, cómo vas hoy, tus números, los rankings (quién más ganó, quién más perdió
 * y los cobros más grandes) y las estadísticas de cada juego. `?periodo=siempre` cuenta todo; si no, los
 * últimos `CASINO.rankingDays` días.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const period: CasinoPeriod = req.nextUrl.searchParams.get("periodo") === "siempre" ? "siempre" : "semana";
  const since = period === "siempre" ? null : new Date(Date.now() - CASINO.rankingDays * 86_400_000);
  const [settings, todayNet, stats] = await Promise.all([
    getCasinoSettings(prisma),
    casinoTodayNetTx(prisma, user.id),
    casinoStats(prisma, since),
  ]);
  const ranks = casinoRankings(stats.players);
  const ids = new Set([...ranks.winners, ...ranks.losers, ...ranks.bigWins].map((p) => p.userId));
  const people = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, avatar: true, look: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows = (list: CasinoPlayerStats[]) =>
    list.flatMap((s) => {
      const p = byId.get(s.userId);
      return p
        ? [
            {
              userId: p.id,
              name: p.name || "Alguien",
              avatar: asAvatar(p.avatar),
              look: asLook(p.look),
              net: s.net,
              best: s.best,
            },
          ]
        : [];
    });
  const mine = stats.players.find((p) => p.userId === user.id) ?? {
    userId: user.id,
    net: 0,
    staked: 0,
    paid: 0,
    bets: 0,
    best: 0,
  };
  return NextResponse.json(
    {
      balance: user.points,
      enabled: settings.enabled,
      todayNet,
      period,
      days: CASINO.rankingDays,
      mine,
      winners: rows(ranks.winners),
      losers: rows(ranks.losers),
      bigWins: rows(ranks.bigWins),
      games: stats.games,
      total: stats.total,
      me: user.id,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
