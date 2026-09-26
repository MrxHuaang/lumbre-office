"use server";

import { prisma } from "@hyvento/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/current-user";
import { publishOfficesChanged } from "@/lib/events";
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
  if (!parsed.success) return { error: "Datos inválidos" };
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
