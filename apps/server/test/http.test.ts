import type { ColyseusTestServer } from "@colyseus/testing";
import { INTERNAL_ROUTES, ROOM_NAME } from "@hyvento/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, SECRET, TEST_PORT } from "./helpers";

const base = `http://localhost:${TEST_PORT}`;
let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});

describe("rutas HTTP del servidor de juego", () => {
  it("GET /health responde ok (chequeo del hosting)", async () => {
    const res = await fetch(`${base}${INTERNAL_ROUTES.health}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("el aviso de oficinas exige el secreto compartido", async () => {
    const sin = await fetch(`${base}${INTERNAL_ROUTES.officesChanged}`, { method: "POST" });
    expect(sin.status).toBe(401);
    const malo = await fetch(`${base}${INTERNAL_ROUTES.officesChanged}`, {
      method: "POST",
      headers: { Authorization: "Bearer otro-secreto" },
    });
    expect(malo.status).toBe(401);
  });

  it("con el secreto correcto recarga las oficinas de las salas abiertas", async () => {
    OfficeRoom.repo = repo;
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    repo.assign("office-2", "u-ana", "Ana");
    const res = await fetch(`${base}${INTERNAL_ROUTES.officesChanged}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    expect(res.status).toBe(200);
    expect(room.state.offices.get("office-2")!.ownerName).toBe("Ana");
  });

  it("rutas desconocidas devuelven 404", async () => {
    expect((await fetch(`${base}/nada`)).status).toBe(404);
  });
});
