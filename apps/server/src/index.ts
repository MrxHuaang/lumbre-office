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

// Una promesa rechazada sin `catch` no tumba el servidor (con Node, por defecto, sí: se caería la sala con
// todos adentro): se anota con su pila para encontrarla.
process.on("unhandledRejection", (reason) => {
  console.error("❌ Promesa rechazada sin manejar:", reason);
});
// Una excepción sin atrapar sí deja el proceso en un estado dudoso: solo se anota aquí (el monitor no cambia
// qué pasa después). Colyseus apaga ordenado (cierra las salas, que devuelven y guardan) y sale con error;
// antes de que exista el servidor, Node sale como siempre.
process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.error(`❌ Excepción sin atrapar (${origin}): el servidor se apaga`, err);
});

const { createGameServer } = await import("./app");
const { PrismaRepository } = await import("./repo/prisma");

const { allZones } = await import("@hyvento/map");

const repo = new PrismaRepository();
// Las oficinas de la cabaña existen en la DB desde el arranque (el panel /admin las lista y asigna).
const officeZones = allZones().filter((z) => z.type === "office");
// Si la base no responde al arrancar, igual se levanta el servidor: la sala las vuelve a crear al abrirse.
await repo.ensureOffices(officeZones.map((z) => ({ zoneId: z.id, name: z.name }))).catch((err) => {
  console.error("❌ No se pudieron crear las oficinas al arrancar (se reintenta al abrir la sala)", err);
});

// Render (y otros hostings) asignan el puerto en PORT.
const port = Number(process.env.PORT ?? process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer({ repo });
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en el puerto ${port}`);
