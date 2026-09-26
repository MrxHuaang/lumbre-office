import { prisma } from "@hyvento/db";
import { ProfileUpdate } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = ProfileUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...parsed.data, onboardedAt: user.onboardedAt ?? new Date() },
    select: { name: true, avatar: true },
  });
  return NextResponse.json(updated);
}
