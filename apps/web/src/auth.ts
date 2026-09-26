import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@hyvento/db";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Lee AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET del entorno.
  providers: [Google],
  // JWT: la sesión no consulta la DB en cada request; los usuarios/cuentas sí se guardan con el adapter.
  session: { strategy: "jwt" },
  // Detrás del proxy del hosting (Vercel u otro) el host viene en las cabeceras.
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const email = (profile?.email ?? user.email)?.toLowerCase();
      if (!email || profile?.email_verified === false) return false;
      return isAllowedEmail(email);
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();
      const invite = await prisma.invite.findUnique({ where: { email } });
      await prisma.user.update({
        where: { id: user.id },
        data: { role: adminEmails().includes(email) ? "ADMIN" : (invite?.role ?? "MEMBER") },
      });
      if (invite && !invite.acceptedAt) {
        await prisma.invite.update({ where: { email }, data: { acceptedAt: new Date() } });
      }
    },
    async signIn({ user }) {
      // Si alguien se agrega a ADMIN_EMAILS después de su primer ingreso, se promueve aquí.
      if (user.id && user.email && adminEmails().includes(user.email.toLowerCase())) {
        await prisma.user.updateMany({ where: { id: user.id, role: { not: "ADMIN" } }, data: { role: "ADMIN" } });
      }
    },
  },
});
