"use server";

import { awardPoints, prisma, saveCasinoSettings, setPermiso, setPermisoTodos } from "@hyvento/db";
import { CasinoSettingsBody, DarPuntosBody, darPuntosRef, SetPermisoBody, SetPermisoTodosBody } from "@hyvento/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/current-user";
import { publishCasinoSettingsChanged, publishOfficesChanged, publishPermissionsChanged, publishPointsChanged } from "@/lib/events";
import { assignOffice } from "@/lib/offices";

const InviteInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export interface InviteState {
  error?: string;
  ok?: string;
}

export async function createInvite(_prev: InviteState, form: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const parsed = InviteInput.safeParse({ email: form.get("email"), role: form.get("role") ?? undefined });
  if (!parsed.success) return { error: "Escribe un correo válido." };

  const { email, role } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) return { error: `${email} ya tiene cuenta.` };
  await prisma.invite.upsert({
    where: { email },
    create: { email, role, invitedById: admin.id },
    update: { role },
  });
  revalidatePath("/admin");
  return { ok: `Invitación creada para ${email}. Ya puede entrar con Google.` };
}

export async function assignOfficeAction(zoneId: string, userId: string | null): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = z.object({ zoneId: z.string().min(1), userId: z.string().min(1).nullable() }).safeParse({ zoneId, userId });
  if (!parsed.success) return { error: "Algo no cuadra en lo que se mandó. Intenta de nuevo." };
  try {
    await assignOffice(parsed.data.zoneId, parsed.data.userId);
  } catch (err) {
    console.error("assignOffice", err);
    return { error: "No se pudo asignar la oficina" };
  }
  await publishOfficesChanged();
  revalidatePath("/admin");
  return {};
}

export async function revokeInvite(form: FormData) {
  await requireAdmin();
  const email = String(form.get("email") ?? "");
  await prisma.invite.deleteMany({ where: { email, acceptedAt: null } });
  revalidatePath("/admin");
}

/** Casino: abrirlo o cerrarlo. */
export async function saveCasinoSettingsAction(form: FormData) {
  await requireAdmin();
  const parsed = CasinoSettingsBody.safeParse({ enabled: form.get("enabled") === "on" });
  if (!parsed.success) return;
  await saveCasinoSettings(prisma, parsed.data);
  await publishCasinoSettingsChanged();
  revalidatePath("/admin");
}

/** Permisos: dar o quitar uno a una persona (a un admin no hace falta: los tiene todos). */
export async function setPermisoAction(userId: string, permiso: string, on: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = SetPermisoBody.safeParse({ userId, permiso, on });
  if (!parsed.success) return { error: "Algo no cuadra en lo que se mandó. Intenta de nuevo." };
  try {
    await setPermiso(prisma, { ...parsed.data, grantedById: admin.id });
  } catch (err) {
    console.error("setPermiso", err);
    return { error: "No se pudo guardar el permiso" };
  }
  await publishPermissionsChanged();
  revalidatePath("/admin");
  return {};
}

/** Permisos: "todos pueden" (abrirlo o cerrarlo para todo el equipo). */
export async function setPermisoTodosAction(permiso: string, on: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = SetPermisoTodosBody.safeParse({ permiso, on });
  if (!parsed.success) return { error: "Algo no cuadra en lo que se mandó. Intenta de nuevo." };
  try {
    await setPermisoTodos(prisma, parsed.data);
  } catch (err) {
    console.error("setPermisoTodos", err);
    return { error: "No se pudo guardar el permiso" };
  }
  await publishPermissionsChanged();
  revalidatePath("/admin");
  return {};
}

/**
 * Dar puntos a alguien (VIR-185): motivo ADMIN (sin tope diario), queda en el libro con quién lo dio, y el
 * contador de la cabaña se refresca sin recargar.
 */
export async function darPuntosAction(userId: string, amount: number): Promise<{ error?: string; ok?: string }> {
  const admin = await requireAdmin();
  const parsed = DarPuntosBody.safeParse({ userId, amount });
  if (!parsed.success) return { error: "La cantidad tiene que ser un número entero entre 1 y 100.000." };
  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, name: true, email: true } });
  if (!user) return { error: "No encontramos a esa persona." };
  try {
    const { awarded, balance } = await awardPoints(prisma, {
      userId: user.id,
      amount: parsed.data.amount,
      reason: "ADMIN",
      refId: darPuntosRef(admin.id, Date.now()),
    });
    await publishPointsChanged(user.id);
    revalidatePath("/admin");
    const quien = user.name || user.email;
    return { ok: `Listo: ${awarded.toLocaleString("es-CO")} puntos para ${quien}. Saldo: ${balance.toLocaleString("es-CO")}.` };
  } catch (err) {
    console.error("darPuntos", err);
    return { error: "No se pudieron dar los puntos" };
  }
}
