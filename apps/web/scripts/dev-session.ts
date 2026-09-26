/**
 * SOLO DESARROLLO LOCAL. Crea (o reutiliza) un usuario de prueba `<nombre>@hyvento.test` y
 * genera una cookie de sesión de Auth.js para probar la oficina con varias personas sin Google.
 *
 *   pnpm --filter @hyvento/web dev:session "Tester Uno" [--office office-2] [--avatar carla] [--admin]
 *
 * Pega el valor impreso en el navegador (DevTools → consola):
 *   document.cookie = "authjs.session-token=<valor>; path=/"
 */
import { prisma } from "@hyvento/db";
import { INTERNAL_ROUTES } from "@hyvento/shared";
import { encode } from "next-auth/jwt";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--")) ?? "Tester";
const flag = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const dbUrl = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || !/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.error("dev-session solo funciona contra una base de datos local.");
  process.exit(1);
}
const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("Falta AUTH_SECRET");

const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@hyvento.test`;
const user = await prisma.user.upsert({
  where: { email },
  create: { email, name, avatar: flag("--avatar") ?? "carla", onboardedAt: new Date(), role: args.includes("--admin") ? "ADMIN" : "MEMBER" },
  update: args.includes("--admin") ? { role: "ADMIN" } : {},
});

const office = flag("--office");
if (office) {
  await prisma.office.updateMany({ where: { ownerId: user.id }, data: { ownerId: null, isLocked: false } });
  await prisma.office.update({ where: { zoneId: office }, data: { ownerId: user.id, isLocked: false } });
  // Avisar al servidor de juego local para que actualice la placa.
  const base = (process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567").replace(/^ws/, "http");
  await fetch(`${base}${INTERNAL_ROUTES.officesChanged}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GAME_TOKEN_SECRET}` },
  }).catch(() => console.warn("(el servidor de juego no está corriendo; la placa se verá al reiniciarlo)"));
}

const token = await encode({
  token: { sub: user.id, uid: user.id, name: user.name, email },
  secret,
  salt: "authjs.session-token",
  maxAge: 60 * 60 * 24,
});
console.log(`Usuario: ${user.name} <${email}>${office ? ` · dueño de ${office}` : ""}`);
console.log(token);
await prisma.$disconnect();
