import { deleteDoorNote, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishDoorNotesChanged } from "@/lib/events";

type Params = { params: Promise<{ id: string }> };

/** Borrar una nota de tu puerta (siempre filtrando por destinatario: las ajenas no se tocan). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const { id } = await params;
  if (!(await deleteDoorNote(prisma, user.id, id))) return NextResponse.json({ error: "No existe" }, { status: 404 });
  await publishDoorNotesChanged(user.id);
  return NextResponse.json({ ok: true });
}
