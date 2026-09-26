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

const { AGENT_QUEUE, AgentEvent, REDIS_CHANNEL } = await import("@hyvento/shared");
const { createGameServer } = await import("./app");
const { PrismaRepository } = await import("./repo/prisma");
const { OfficeRoom } = await import("./rooms/OfficeRoom");

const { loadOfficeMap } = await import("@hyvento/map/node");

const repo = new PrismaRepository();
// Las oficinas del mapa existen en la DB desde el arranque (el panel /admin las lista y asigna).
const officeZones = loadOfficeMap().zones.filter((z) => z.type === "office");
await repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name })));

if (!process.env.REDIS_URL) {
  console.error("❌ Falta REDIS_URL (Redis es necesario para la cola de agentes y los eventos).");
  process.exit(1);
}
const { Queue } = await import("bullmq");
const { Redis } = await import("ioredis");
const redisUrl = process.env.REDIS_URL;

// Cola del worker de agentes: los trabajos se borran al terminar (el historial queda en Postgres).
const queue = new Queue(AGENT_QUEUE, { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }) });
const agentQueue = {
  enqueue: async (job: { runId: string }) => {
    await queue.add("chat", job, { jobId: job.runId, removeOnComplete: true, removeOnFail: 100 });
  },
};

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer({ repo, agentQueue });
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en ws://localhost:${port}`);

// Redis: cambios de oficinas/agentes (desde la web) y eventos de los agentes (desde el worker).
const sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
sub.on("error", (err) => console.error("Redis:", err.message));
sub.on("message", (channel, message) => {
  if (channel === REDIS_CHANNEL.officesChanged) {
    OfficeRoom.reloadOfficesEverywhere().catch((err) => console.error("reloadOffices", err));
  } else if (channel === REDIS_CHANNEL.agentsChanged) {
    OfficeRoom.reloadAgentsEverywhere().catch((err) => console.error("reloadAgents", err));
  } else if (channel === REDIS_CHANNEL.agentEvents) {
    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = AgentEvent.safeParse(data);
    if (parsed.success) OfficeRoom.handleAgentEvent(parsed.data);
  }
});
await sub.connect();
await sub.subscribe(REDIS_CHANNEL.officesChanged, REDIS_CHANNEL.agentsChanged, REDIS_CHANNEL.agentEvents);
console.log("📡 Suscrito a oficinas, agentes y eventos de agentes en Redis");
