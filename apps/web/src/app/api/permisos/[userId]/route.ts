import { permisosDados, permisosDeTodos, prisma, setPermiso } from "@hyvento/db";
import { PermisoId, type PermisosPersonaDTO } from "@hyvento/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { publishPermissionsChanged } from "@/lib/events";

// "Dar permiso…" desde el menú de una persona en la cabaña (lo mismo que la sección Permisos de /admin).
type Params = { params: Promise<{ userId: string }> };

async function adminOrError() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  if (me.role !== "ADMIN") return { error: NextResponse.json({ error: "Solo un admin da permisos" }, { status: 403 }) };
  return { me };
}

async function view(userId: string): Promise<PermisosPersonaDTO | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return null;
  const [granted, everyone] = await Promise.all([permisosDados(prisma, [userId]), permisosDeTodos(prisma)]);
  return { userId, admin: user.role === "ADMIN", granted: granted[userId] ?? [], everyone };
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await adminOrError();
  if (auth.error) return auth.error;
  const dto = await view((await params).userId);
  if (!dto) return NextResponse.json({ error: "No existe esa persona" }, { status: 404 });
  return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
}

const PutBody = z.object({ permiso: PermisoId, on: z.boolean() });

export async function PUT(req: Request, { params }: Params) {
  const auth = await adminOrError();
  if (auth.error) return auth.error;
  const { userId } = await params;
  const body = PutBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Permiso inválido" }, { status: 400 });
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
    return NextResponse.json({ error: "No existe esa persona" }, { status: 404 });
  }
  await setPermiso(prisma, { userId, ...body.data, grantedById: auth.me.id });
  await publishPermissionsChanged();
  return NextResponse.json(await view(userId));
}
