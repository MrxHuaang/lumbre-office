import { createGameServer } from "./app";

const port = Number(process.env.GAME_SERVER_PORT ?? 2567);
const server = createGameServer();
await server.listen(port);
console.log(`🏢 Servidor de juego escuchando en ws://localhost:${port}`);
