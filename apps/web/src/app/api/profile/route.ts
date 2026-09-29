import { Prisma, loadSkillLevels, prisma } from "@hyvento/db";
import { ProfileUpdate, lockedCostume, unlockText } from "@hyvento/shared";
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
  const { look, ...profile } = parsed.data;
  // Los trajes de los oficios se ponen solo con el nivel (oficios.ts): lo decide el servidor, no el editor.
  if (look?.costume) {
    const locked = lockedCostume(look, await loadSkillLevels(prisma, user.id));
    if (locked) return NextResponse.json({ error: `Ese traje se desbloquea con ${unlockText(locked)}.` }, { status: 403 });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...profile,
      // undefined = no tocar; null = volver al personaje fijo.
      ...(look !== undefined && { look: look ?? Prisma.DbNull }),
      onboardedAt: user.onboardedAt ?? new Date(),
    },
    select: { name: true, avatar: true, look: true, office: { select: { zoneId: true } } },
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

  return NextResponse.json({ name: updated.name, avatar: updated.avatar, look: updated.look });
}
