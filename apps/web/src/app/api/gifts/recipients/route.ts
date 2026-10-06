import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { asAvatar, asLook, getCurrentUser } from "@/lib/current-user";

/** Para quien no puso nombre: lo que va antes de la @ (el correo completo no se muestra al equipo). */
function publicName(email: string | null) {
  return email?.split("@")[0] || "Sin nombre";
}

/** A quién se le puede regalar: todo el equipo menos tú (también quien no está conectado). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const people = await prisma.user.findMany({
    where: { id: { not: user.id }, onboardedAt: { not: null } },
    select: { id: true, name: true, email: true, avatar: true, look: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  return NextResponse.json(
    { people: people.map((p) => ({ id: p.id, name: p.name || publicName(p.email), avatar: asAvatar(p.avatar), look: asLook(p.look) })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
