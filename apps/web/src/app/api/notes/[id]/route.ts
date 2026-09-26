import { Prisma, prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { NOTE_SELECT, NoteUpdate, subtreeIds, toNoteDTO } from "@/lib/notes";

type Params = { params: Promise<{ id: string }> };

/**
 * Editar (título, texto, documento, favorito), mandar a la papelera o restaurar. La papelera
 * mueve la nota con todas sus subpáginas; al restaurar vuelven juntas.
 */
export async function PATCH(req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const parsed = NoteUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  // Siempre filtrando por userId: nadie puede tocar notas ajenas aunque adivine el id.
  const note = await prisma.note.findFirst({ where: { id, userId: user.id } });
  if (!note) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const { trashed, content, ...fields } = parsed.data;
  const changed: string[] = [id];

  await prisma.$transaction(async (tx) => {
    if (Object.keys(fields).length || content !== undefined) {
      await tx.note.update({
        where: { id },
        data: { ...fields, ...(content !== undefined && { content: content as Prisma.InputJsonValue }) },
      });
    }
    if (trashed === undefined) return;

    const all = await tx.note.findMany({ where: { userId: user.id }, select: { id: true, parentId: true, deletedAt: true } });
    const subtree = subtreeIds(id, all);
    if (trashed && !note.deletedAt) {
      // Toda la rama con la misma fecha, para poder restaurarla junta.
      const now = new Date();
      const ids = subtree.filter((sid) => !all.find((n) => n.id === sid)?.deletedAt);
      await tx.note.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { deletedAt: now } });
      changed.push(...ids);
    } else if (!trashed && note.deletedAt) {
      const sameBatch = subtree.filter((sid) => all.find((n) => n.id === sid)?.deletedAt?.getTime() === note.deletedAt!.getTime());
      await tx.note.updateMany({ where: { id: { in: sameBatch }, userId: user.id }, data: { deletedAt: null } });
      // Si la madre sigue en la papelera (o ya no existe), la nota vuelve a la raíz.
      const parent = note.parentId ? all.find((n) => n.id === note.parentId) : null;
      if (note.parentId && (!parent || parent.deletedAt)) await tx.note.update({ where: { id }, data: { parentId: null } });
      changed.push(...sameBatch);
    }
  });

  const notes = await prisma.note.findMany({ where: { id: { in: [...new Set(changed)] }, userId: user.id }, select: NOTE_SELECT });
  return NextResponse.json({ note: toNoteDTO(notes.find((n) => n.id === id)!), changed: notes.map(toNoteDTO) });
}

/** Borrar para siempre (solo notas que ya están en la papelera; sus subpáginas se borran con ella). */
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const { count } = await prisma.note.deleteMany({ where: { id, userId: user.id, deletedAt: { not: null } } });
  if (count === 0) return NextResponse.json({ error: "No está en la papelera" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
