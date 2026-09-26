import { prisma } from "@hyvento/db";
import { ProfileUpdate } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishOfficesChanged } from "@/lib/events";
import { assignOffice, firstFreeOffice } from "@/lib/offices";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const parsed = ProfileUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const firstTime = !user.onboardedAt;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...parsed.data, onboardedAt: user.onboardedAt ?? new Date() },
    select: { name: true, avatar: true, office: { select: { zoneId: true } } },
  });

  let officesChanged = Boolean(updated.office) && user.name !== updated.name; // la placa muestra el nombre
  if (firstTime && !updated.office) {
    const free = await firstFreeOffice();
    if (free) {
      await assignOffice(free.zoneId, user.id);
      officesChanged = true;
    }
  }
  if (officesChanged) await publishOfficesChanged();

  return NextResponse.json({ name: updated.name, avatar: updated.avatar });
}
