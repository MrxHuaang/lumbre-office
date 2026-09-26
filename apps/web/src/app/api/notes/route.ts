import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { NOTE_SELECT, NoteCreate, toNoteDTO } from "@/lib/notes";

/** Todas las notas del usuario actual, incluidas las de la papelera. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: NOTE_SELECT,
  });
  return NextResponse.json({ notes: notes.map(toNoteDTO) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = NoteCreate.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const note = await prisma.note.create({ data: { ...parsed.data, userId: user.id }, select: NOTE_SELECT });
  return NextResponse.json({ note: toNoteDTO(note) }, { status: 201 });
}
