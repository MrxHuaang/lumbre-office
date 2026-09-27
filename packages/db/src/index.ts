import { PrismaClient } from "@prisma/client";

// Reutiliza el cliente en dev (hot reload de Next/tsx crea módulos nuevos).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export * from "./points";
export * from "./inventory";
export * from "./casino";
export * from "./fishing";
export * from "./photos";
export * from "./achievements";
