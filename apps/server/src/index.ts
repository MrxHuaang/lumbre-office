import { fileURLToPath } from "node:url";

// Variables del .env de la raíz del monorepo (opcional: en producción vienen del entorno).
// Se carga ANTES de importar módulos que leen el entorno al inicializarse (Prisma).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // sin .env
}

for (const key of ["GAME_TOKEN_SECRET", "DATABASE_URL"]) {
  if (!process.env[key]) {
    console.error(`❌ Falta ${key}. Copia .env.example a .env y complétalo.`);
    process.exit(1);
  }
}

// Colyseus ya atiende `uncaughtException` (anota y apaga ordenado). Una promesa rechazada sin `.catch`
// (p. ej. un guardado en la base que falló) solo se anota: no vale tumbar la cabaña de todos por eso.
process.on("unhandledRejection", (reason) => {
  console.error("[juego] promesa rechazada sin atender", reason);
});

const { createGameServer } = await import("./app");
const { PrismaRepository } = await import("./repo/prisma");

const { allZones } = await import("@hyvento/map");

const repo = new PrismaRepository();
// Las oficinas de la cabaña existen en la DB desde el arranque (el panel /admin las lista y asigna).
const officeZones = allZones().filter((z) => z.type === "office");
try {
  await repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));
} catch (err) {
  // Sin base no hay cabaña: se dice claro por qué antes de salir (Render reintenta el arranque).
  console.error("[juego] no se pudo conectar con la base al arrancar (ensureOffices)", err);
  process.exit(1);
}

// Render (y otros hostings) asignan el puerto en PORT.
const port = Number(process.env.PORT ?? process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer({ repo });
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en el puerto ${port}`);
