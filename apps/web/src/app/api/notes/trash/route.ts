import { prisma } from "@hyvento/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/** Vaciar la papelera: borra para siempre todas las notas que están en ella. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { count } = await prisma.note.deleteMany({ where: { userId: user.id, deletedAt: { not: null } } });
  return NextResponse.json({ deleted: count });
}
