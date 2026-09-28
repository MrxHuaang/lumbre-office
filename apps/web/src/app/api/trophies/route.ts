import { prisma } from "@hyvento/db";
import { rarityCounts, type TrophyCaseDTO } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Las vitrinas de trofeos de las oficinas: cuántos logros (y de qué rareza) tiene el dueño de cada una.
 * Lo mismo que se ve en su perfil público; solo con sesión.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const offices = await prisma.office.findMany({
    where: { ownerId: { not: null } },
    select: { zoneId: true, ownerId: true, owner: { select: { name: true, email: true } } },
  });
  const ownerIds = offices.map((o) => o.ownerId!);
  const rows = ownerIds.length
    ? await prisma.userAchievement.findMany({ where: { userId: { in: ownerIds } }, select: { userId: true, achievementId: true } })
    : [];
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.achievementId]);
  const cases: TrophyCaseDTO[] = offices.map((o) => {
    const ids = byUser.get(o.ownerId!) ?? [];
    const rarities = rarityCounts(ids);
    return {
      zoneId: o.zoneId,
      ownerId: o.ownerId!,
      ownerName: o.owner?.name || o.owner?.email.split("@")[0] || "Alguien",
      count: Object.values(rarities).reduce((a, b) => a + b, 0),
      rarities,
    };
  });
  return NextResponse.json(cases, { headers: { "Cache-Control": "no-store" } });
}
