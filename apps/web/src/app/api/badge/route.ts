import { prisma } from "@hyvento/db";
import { FeaturedBadgeUpdate, validFeaturedBadge } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** La insignia destacada propia (id de un logro, o null). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const row = await prisma.featuredBadge.findUnique({ where: { userId: user.id }, select: { achievementId: true } }).catch(() => null);
  return NextResponse.json({ achievementId: row?.achievementId ?? null }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Elige la insignia que se ve junto al nombre: solo un logro que ya se tiene (null = ninguna). Después el
 * navegador avisa a la sala (`profileChanged`) y el servidor de juego la vuelve a validar.
 */
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const parsed = FeaturedBadgeUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Algo no cuadra en lo que se mandó. Intenta de nuevo." }, { status: 400 });
  const { achievementId } = parsed.data;
  if (!achievementId) {
    await prisma.featuredBadge.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ achievementId: null });
  }
  const owned = await prisma.userAchievement.findUnique({ where: { userId_achievementId: { userId: user.id, achievementId } }, select: { achievementId: true } });
  if (!validFeaturedBadge(achievementId, owned ? [owned.achievementId] : [])) {
    return NextResponse.json({ error: "Ese logro todavía no es tuyo." }, { status: 400 });
  }
  await prisma.featuredBadge.upsert({ where: { userId: user.id }, create: { userId: user.id, achievementId }, update: { achievementId } });
  return NextResponse.json({ achievementId });
}
