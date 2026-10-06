import { prisma } from "@hyvento/db";
import { BirthdayField } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { BirthdaysDTO } from "@/lib/birthdays";
import { getCurrentUser } from "@/lib/current-user";

/** Cumpleaños del equipo (lo ve cualquiera del equipo: es día y mes, sin año). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const users = await prisma.user.findMany({ where: { birthday: { not: null } }, select: { id: true, name: true, email: true, birthday: true } });
  const people = users.map((u) => ({ id: u.id, name: u.name || u.email.split("@")[0]!, birthday: u.birthday! }));
  const me = people.find((p) => p.id === user.id)?.birthday ?? null;
  return NextResponse.json({ me, people } satisfies BirthdaysDTO, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ birthday: BirthdayField });

/** Poner (o borrar, con null) mi cumpleaños. El cliente avisa a la sala con `profile:changed`. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Tu sesión se cerró. Vuelve a entrar." }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { birthday: parsed.data.birthday } });
  return NextResponse.json({ birthday: parsed.data.birthday });
}
