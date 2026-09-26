import { fileURLToPath } from "node:url";
import { createGameServer } from "./app";

// Variables del .env de la raíz del monorepo (opcional: en producción vienen del entorno).
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {
  // sin .env
}

if (!process.env.GAME_TOKEN_SECRET) {
  console.error("❌ Falta GAME_TOKEN_SECRET. Copia .env.example a .env y complétalo.");
  process.exit(1);
}

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer();
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en ws://localhost:${port}`);
