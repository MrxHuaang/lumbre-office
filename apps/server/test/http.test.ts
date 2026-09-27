import type { ColyseusTestServer } from "@colyseus/testing";
import { INTERNAL_ROUTES, MSG, ROOM_NAME, type GiftReceived } from "@hyvento/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, SECRET, TEST_PORT, tick, token } from "./helpers";

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

  it("el aviso de un regalo le llega solo a quien lo recibe (y exige el secreto)", async () => {
    OfficeRoom.repo = repo;
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    const beto = await colyseus.connectTo(room, { token: await token("u-beto", "Beto", "bruno") });
    const got = { ana: [] as GiftReceived[], beto: [] as GiftReceived[] };
    ana.onMessage(MSG.giftReceived, (g: GiftReceived) => got.ana.push(g));
    beto.onMessage(MSG.giftReceived, (g: GiftReceived) => got.beto.push(g));
    const body = { toId: "u-ana", fromName: "Beto", points: 25, itemId: "plant", quantity: 1 };
    const post = (b: unknown, secret = SECRET) =>
      fetch(`${base}${INTERNAL_ROUTES.giftSent}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
    expect((await post(body, "otro-secreto")).status).toBe(401);
    expect((await post({ toId: "u-ana" })).status).toBe(400);
    expect((await post(body)).status).toBe(200);
    await tick(80);
    expect(got.ana).toEqual([{ fromName: "Beto", points: 25, itemId: "plant", quantity: 1 }]);
    expect(got.beto).toEqual([]);
  });

  it("rutas desconocidas devuelven 404", async () => {
    expect((await fetch(`${base}/nada`)).status).toBe(404);
  });
});
