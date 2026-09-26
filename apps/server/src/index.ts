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

const { createGameServer } = await import("./app");
const { PrismaRepository } = await import("./repo/prisma");

const { loadOfficeMap } = await import("@hyvento/map/node");

const repo = new PrismaRepository();
// Las oficinas del mapa existen en la DB desde el arranque (el panel /admin las lista y asigna).
const officeZones = loadOfficeMap().zones.filter((z) => z.type === "office");
await repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));

// Render (y otros hostings) asignan el puerto en PORT.
const port = Number(process.env.PORT ?? process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer({ repo });
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en el puerto ${port}`);
