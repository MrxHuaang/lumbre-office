import "server-only";
import { prisma } from "@hyvento/db";
import { HUMAN_AVATARS, Look, type HumanAvatar } from "@hyvento/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEV_SESSION_COOKIE, readDevSession } from "@/lib/dev-login";
import { supabaseServer } from "@/lib/supabase";

export async function getCurrentUser() {
  const devUserId = readDevSession((await cookies()).get(DEV_SESSION_COOKIE)?.value);
  if (devUserId) return prisma.user.findUnique({ where: { id: devUserId } });
  // getUser (no getSession) valida el token con Supabase; el usuario de Neon se busca por correo.
  const supabase = await supabaseServer();
  const email = (await supabase?.auth.getUser())?.data.user?.email?.toLowerCase();
  if (!email) return null;
  return prisma.user.findUnique({ where: { email } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export function asAvatar(value: string): HumanAvatar {
  return (HUMAN_AVATARS as readonly string[]).includes(value) ? (value as HumanAvatar) : "ada";
}

/** Personaje personalizado guardado (JSON de la base), o null si no hay o no es válido. */
export function asLook(value: unknown): Look | null {
  const parsed = Look.safeParse(value);
  return parsed.success ? parsed.data : null;
}
