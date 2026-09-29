import type { ColyseusTestServer } from "@colyseus/testing";
import { INTERNAL_ROUTES, RESTART_CLOSE_CODE, RESTART_MSG, ROOM_NAME } from "@hyvento/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, TEST_PORT, token, until } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});

describe("reinicio del servidor (deploy)", () => {
  it("al apagarse avisa a todos y cierra con el código de reinicio (no con 4000)", async () => {
    OfficeRoom.repo = repo;
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    let warned = false;
    let code: number | null = null;
    ana.onMessage(RESTART_MSG, () => (warned = true));
    ana.onLeave((c) => (code = c));
    // Hasta que el cliente confirma la entrada, el servidor le guarda los mensajes en cola.
    await room.waitForNextPatch();

    room.onBeforeShutdown();

    await until(() => code !== null, "el cierre del cliente");
    expect(warned).toBe(true);
    expect(code).toBe(RESTART_CLOSE_CODE);
    // Quien se va por el reinicio no queda esperando reconexión en una sala que se cierra.
    expect(room.state.players.size).toBe(0);
  });

  it("GET /health se puede leer desde el navegador (CORS)", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}${INTERNAL_ROUTES.health}`, { headers: { Origin: "https://lumbre.example" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
