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
    orderBy: { createdAt: "asc" },
    select: NOTE_SELECT,
  });
  return NextResponse.json({ notes: notes.map(toNoteDTO) }, { headers: { "Cache-Control": "no-store" } });
}

/** Crear una nota, en la raíz o como subpágina de otra (propia y fuera de la papelera). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const parsed = NoteCreate.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { parentId, ...data } = parsed.data;
  if (parentId) {
    const parent = await prisma.note.findFirst({ where: { id: parentId, userId: user.id, deletedAt: null } });
    if (!parent) return NextResponse.json({ error: "La página madre no existe" }, { status: 404 });
  }
  const note = await prisma.note.create({ data: { ...data, parentId, userId: user.id }, select: NOTE_SELECT });
  return NextResponse.json({ note: toNoteDTO(note) }, { status: 201 });
}
