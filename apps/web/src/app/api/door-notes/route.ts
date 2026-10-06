import { listDoorNotes, markDoorNotesRead, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { publishDoorNotesChanged } from "@/lib/events";

/** Las notas que te dejaron en la puerta de tu oficina (solo las tuyas), de la más nueva a la más vieja. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const notes = await listDoorNotes(prisma, user.id);
  return NextResponse.json({ notes }, { headers: { "Cache-Control": "no-store" } });
}

/** Marcar como leídas todas tus notas: los post-its de tu puerta desaparecen. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const changed = await markDoorNotesRead(prisma, user.id);
  if (changed > 0) await publishDoorNotesChanged(user.id);
  return NextResponse.json({ ok: true, changed });
}
