import "server-only";
import { REDIS_CHANNEL } from "@hyvento/shared";
import { Redis } from "ioredis";

const globalForRedis = globalThis as unknown as { redisPub?: Redis | null };

function publisher(): Redis | null {
  if (globalForRedis.redisPub !== undefined) return globalForRedis.redisPub;
  const url = process.env.REDIS_URL;
  globalForRedis.redisPub = url ? new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false }) : null;
  globalForRedis.redisPub?.on("error", (err) => console.error("Redis:", err.message));
  return globalForRedis.redisPub;
}

/** Avisa al servidor de juego que cambiaron dueños o nombres de oficinas. */
export async function publishOfficesChanged() {
  try {
    await publisher()?.publish(REDIS_CHANNEL.officesChanged, String(Date.now()));
  } catch (err) {
    console.error("No se pudo avisar del cambio de oficinas:", err);
  }
}
