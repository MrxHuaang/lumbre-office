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

const { REDIS_CHANNEL } = await import("@hyvento/shared");
const { createGameServer } = await import("./app");
const { PrismaRepository } = await import("./repo/prisma");
const { OfficeRoom } = await import("./rooms/OfficeRoom");

const { loadOfficeMap } = await import("@hyvento/map/node");

const repo = new PrismaRepository();
// Las oficinas del mapa existen en la DB desde el arranque (el panel /admin las lista y asigna).
const officeZones = loadOfficeMap().zones.filter((z) => z.type === "office");
await repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer({ repo });
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en ws://localhost:${port}`);

// La web avisa por Redis cuando cambian dueños/nombres de oficinas.
if (process.env.REDIS_URL) {
  const { Redis } = await import("ioredis");
  const sub = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
  sub.on("error", (err) => console.error("Redis:", err.message));
  sub.on("message", (channel) => {
    if (channel === REDIS_CHANNEL.officesChanged) {
      OfficeRoom.reloadOfficesEverywhere().catch((err) => console.error("reloadOffices", err));
    }
  });
  await sub.connect();
  await sub.subscribe(REDIS_CHANNEL.officesChanged);
  console.log("📡 Suscrito a cambios de oficinas en Redis");
} else {
  console.warn("⚠️ Sin REDIS_URL: los cambios de oficinas hechos en /admin se verán al reiniciar el servidor.");
}
