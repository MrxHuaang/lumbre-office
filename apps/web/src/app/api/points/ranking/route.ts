import { prisma } from "@hyvento/db";
import { POINTS } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

/** Ranking semanal: quién ganó más puntos en los últimos días (lo gastado no resta, lo regalado no suma). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const since = new Date(Date.now() - POINTS.rankingDays * 86_400_000);
  const sums = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    // Los regalos e intercambios no cuentan: si no, dos personas subirían regalándose lo mismo.
    // Tampoco las devoluciones de misiones canceladas: son el depósito que vuelve, no algo ganado.
    where: { createdAt: { gte: since }, amount: { gt: 0 }, reason: { not: "GIFT" }, OR: [{ refId: null }, { NOT: { refId: { endsWith: ":devolucion" } } }] },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 10,
  });
  const people = await prisma.user.findMany({
    where: { id: { in: sums.map((s) => s.userId) } },
    select: { id: true, name: true, avatar: true, look: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  const ranking = sums.flatMap((s) => {
    const p = byId.get(s.userId);
    if (!p) return [];
    return [{ userId: p.id, name: p.name || "Alguien", avatar: asAvatar(p.avatar), look: asLook(p.look), earned: s._sum.amount ?? 0 }];
  });
  return NextResponse.json({ days: POINTS.rankingDays, ranking, me: user.id }, { headers: { "Cache-Control": "no-store" } });
}
