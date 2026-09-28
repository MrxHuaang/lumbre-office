// SOLO DESARROLLO LOCAL: entrar sin Google con un usuario de prueba `<nombre>@hyvento.test`.
// Lo usan el botón "Entrar de prueba" del login y el script `pnpm --filter @hyvento/web dev:session`.
// Nunca funciona en producción: exige que no sea un build de producción y una base de datos local.
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@hyvento/db";

/** Cookie propia del login de prueba (la de Supabase es `sb-*`): `<userId>.<firma>`. */
export const DEV_SESSION_COOKIE = "lumbre-dev-session";
export const DEV_SESSION_MAX_AGE = 60 * 60 * 24;

/** ¿Se puede entrar de prueba? Solo fuera de producción (`next dev` o el script) y con una base local. */
export function devLoginEnabled(): boolean {
  const dbUrl = process.env.DATABASE_URL ?? "";
  return process.env.NODE_ENV !== "production" && /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl);
}

export function devEmail(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "tester"}@hyvento.test`;
}

function devSecret(): string {
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!secret) throw new Error("Falta GAME_TOKEN_SECRET en el .env");
  return secret;
}

function sign(userId: string): string {
  return createHmac("sha256", devSecret()).update(`dev-session:${userId}`).digest("base64url");
}

/** El id del usuario de la cookie de prueba, si la firma es válida y el ingreso de prueba está habilitado. */
export function readDevSession(value: string | undefined): string | null {
  if (!value || !devLoginEnabled()) return null;
  const [userId, sig] = value.split(".");
  if (!userId || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(userId));
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}

/**
 * Crea (o reutiliza) el usuario de prueba y devuelve el valor de la cookie de sesión. Con `admin`
 * además queda como administrador (para probar /admin).
 */
export async function createDevSession(name: string, opts: { admin?: boolean; avatar?: string } = {}) {
  if (!devLoginEnabled()) throw new Error("El ingreso de prueba solo funciona en desarrollo con una base local.");
  const email = devEmail(name);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, avatar: opts.avatar ?? "carla", onboardedAt: new Date(), role: opts.admin ? "ADMIN" : "MEMBER" },
    update: opts.admin ? { role: "ADMIN" } : {},
  });
  return { user, email, token: `${user.id}.${sign(user.id)}` };
}
