// SOLO DESARROLLO LOCAL: entrar sin Google con un usuario de prueba `<nombre>@hyvento.test`.
// Lo usan el botón "Entrar de prueba" del login y el script `pnpm --filter @hyvento/web dev:session`.
// Nunca funciona en producción: exige que no sea un build de producción y una base de datos local.
import { prisma } from "@hyvento/db";
import { encode } from "next-auth/jwt";

/** Nombre de la cookie de sesión de Auth.js en http (en local no hay "__Secure-"). */
export const DEV_SESSION_COOKIE = "authjs.session-token";
export const DEV_SESSION_MAX_AGE = 60 * 60 * 24;

/** ¿Se puede entrar de prueba? Solo fuera de producción (`next dev` o el script) y con una base local. */
export function devLoginEnabled(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? "";
  return process.env.NODE_ENV !== "production" && /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
}

export function devEmail(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "tester"}@hyvento.test`;
}

/**
 * Crea (o reutiliza) el usuario de prueba y devuelve el valor de la cookie de sesión. Con `admin`
 * además queda como administrador (para probar /admin).
 */
export async function createDevSession(name: string, opts: { admin?: boolean; avatar?: string } = {}) {
  if (!devLoginEnabled()) throw new Error("El ingreso de prueba solo funciona en desarrollo con una base local.");
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET en el .env");
  const email = devEmail(name);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, avatar: opts.avatar ?? "carla", onboardedAt: new Date(), role: opts.admin ? "ADMIN" : "MEMBER" },
    update: opts.admin ? { role: "ADMIN" } : {},
  });
  const token = await encode({
    token: { sub: user.id, uid: user.id, name: user.name, email },
    secret,
    salt: DEV_SESSION_COOKIE,
    maxAge: DEV_SESSION_MAX_AGE,
  });
  return { user, email, token };
}
