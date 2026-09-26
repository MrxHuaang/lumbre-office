import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { NOTE_SELECT, NoteUpdate, toNoteDTO } from "@/lib/notes";

type Params = { params: Promise<{ id: string }> };

/** Editar título/texto, mandar a la papelera o restaurar. */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = NoteUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { trashed, ...content } = parsed.data;
  const data = { ...content, ...(trashed !== undefined && { deletedAt: trashed ? new Date() : null }) };
  // updateMany con userId: nadie puede tocar notas ajenas aunque adivine el id.
  const { count } = await prisma.note.updateMany({ where: { id, userId: user.id }, data });
  if (count === 0) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const note = await prisma.note.findUniqueOrThrow({ where: { id }, select: NOTE_SELECT });
  return NextResponse.json({ note: toNoteDTO(note) });
}

/** Borrar para siempre (solo notas que ya están en la papelera). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.note.deleteMany({ where: { id, userId: user.id, deletedAt: { not: null } } });
  if (count === 0) return NextResponse.json({ error: "No está en la papelera" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
