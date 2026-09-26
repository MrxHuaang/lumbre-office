import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";

/** Oficina del usuario actual (para el panel "Tu oficina"). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const office = await prisma.office.findUnique({
    where: { ownerId: user.id },
    select: { zoneId: true, name: true, notes: true },
  });
  return NextResponse.json({ office }, { headers: { "Cache-Control": "no-store" } });
}

const NotesUpdate = z.object({ notes: z.string().max(5000) });

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = NotesUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Notas demasiado largas" }, { status: 400 });

  const result = await prisma.office.updateMany({ where: { ownerId: user.id }, data: { notes: parsed.data.notes } });
  if (result.count === 0) return NextResponse.json({ error: "No tienes oficina asignada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
