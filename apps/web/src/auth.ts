import "server-only";
import { prisma } from "@hyvento/db";

/** Correos con acceso de administrador (y que no necesitan invitación). Separados por coma. */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Acceso solo por invitación: admins, usuarios existentes o correos invitados. */
export async function isAllowedEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (adminEmails().includes(e)) return true;
  const [user, invite] = await Promise.all([
    prisma.user.findUnique({ where: { email: e }, select: { id: true } }),
    prisma.invite.findUnique({ where: { email: e }, select: { id: true } }),
  ]);
  return Boolean(user || invite);
}

/**
 * Tras entrar con Supabase: crea el usuario en Neon la primera vez (rol según ADMIN_EMAILS o la
 * invitación, que queda aceptada) y, si ya existía, lo promueve si se agregó a ADMIN_EMAILS después.
 * El usuario se enlaza por correo: Supabase solo da la identidad.
 */
export async function syncUser(identity: { email: string; name?: string | null; image?: string | null }) {
  const email = identity.email.toLowerCase();
  const isAdmin = adminEmails().includes(email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (isAdmin && existing.role !== "ADMIN") {
      return prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    }
    return existing;
  }
  const invite = await prisma.invite.findUnique({ where: { email } });
  const user = await prisma.user.create({
    data: {
      email,
      name: identity.name ?? "",
      image: identity.image ?? null,
      emailVerified: new Date(),
      role: isAdmin ? "ADMIN" : (invite?.role ?? "MEMBER"),
    },
  });
  if (invite && !invite.acceptedAt) {
    await prisma.invite.update({ where: { email }, data: { acceptedAt: new Date() } });
  }
  return user;
}
