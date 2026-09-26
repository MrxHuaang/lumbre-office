import { fileURLToPath } from "node:url";

// .env de la raíz del monorepo (en producción las variables vienen del entorno).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // sin .env
}

for (const key of ["DATABASE_URL", "REDIS_URL"]) {
  if (!process.env[key]) {
    console.error(`❌ Falta ${key}. Copia .env.example a .env y complétalo.`);
    process.exit(1);
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️ Falta ANTHROPIC_API_KEY: los agentes responderán con un aviso hasta que la configures.");
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { Worker } = await import("bullmq");
const { Redis } = await import("ioredis");
const { AGENT_QUEUE, AgentChatJob, REDIS_CHANNEL } = await import("@hyvento/shared");
const { runChat } = await import("./run-chat");
const { StatusAggregator } = await import("./status");
const { PrismaChatStore } = await import("./store");

const redisUrl = process.env.REDIS_URL!;
const pub = new Redis(redisUrl);
const publish = async (event: unknown) => {
  await pub.publish(REDIS_CHANNEL.agentEvents, JSON.stringify(event));
};
const statuses = new StatusAggregator(publish);
const store = new PrismaChatStore();

let client: InstanceType<typeof Anthropic> | undefined;
const getClient = () => (client ??= new Anthropic());

const concurrency = Number(process.env.AGENT_CONCURRENCY ?? 3);
const worker = new Worker(
  AGENT_QUEUE,
  async (job) => {
    const data = AgentChatJob.parse(job.data);
    const result = await runChat(data, {
      client: getClient,
      store,
      publish,
      setStatus: (agentId, runId, status, detail) => statuses.set(agentId, runId, status, detail),
    });
    return { error: result.error };
  },
  // BullMQ necesita maxRetriesPerRequest: null en su conexión.
  { connection: new Redis(redisUrl, { maxRetriesPerRequest: null }), concurrency },
);

worker.on("failed", (job, err) => console.error(`[agents] job ${job?.id} falló:`, err.message));
worker.on("ready", () => console.log(`🤖 Worker de agentes listo (cola "${AGENT_QUEUE}", concurrencia ${concurrency})`));

const shutdown = async () => {
  await worker.close();
  pub.disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
