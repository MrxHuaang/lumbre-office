/**
 * SOLO DESARROLLO LOCAL. Crea (o reutiliza) un usuario de prueba `<nombre>@hyvento.test` y
 * genera una cookie de sesión de prueba para probar la oficina con varias personas sin Google.
 *
 *   pnpm --filter @hyvento/web dev:session "Tester Uno" [--office office-2] [--avatar carla] [--admin]
 *
 * Pega el valor impreso en el navegador (DevTools → consola):
 *   document.cookie = "lumbre-dev-session=<valor>; path=/"
 * (Más fácil: en el login local aparece el botón "Entrar de prueba".)
 */
import { prisma } from "@hyvento/db";
import { INTERNAL_ROUTES } from "@hyvento/shared";
import { createDevSession, devLoginEnabled } from "../src/lib/dev-login";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--")) ?? "Tester";
const flag = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!devLoginEnabled()) {
  console.error("dev-session solo funciona contra una base de datos local.");
  process.exit(1);
}

const { user, email, token } = await createDevSession(name, { admin: args.includes("--admin"), avatar: flag("--avatar") });

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

console.log(`Usuario: ${user.name} <${email}>${office ? ` · dueño de ${office}` : ""}`);
console.log(token);
await prisma.$disconnect();
