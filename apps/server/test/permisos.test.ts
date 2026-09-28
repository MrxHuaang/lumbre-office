import type { ColyseusTestServer } from "@colyseus/testing";
import { EMPTY_EDITS, planDef, setWorldEdits, worldFurniture } from "@hyvento/map";
import { INTERNAL_ROUTES, MSG, PERMISOS_MSG, ROOM_NAME, type PermisosView, type WorldEditLockResult, type WorldEditResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, SECRET, TEST_PORT, token, until } from "./helpers";

// Permisos por persona: el servidor decide con lo que dice la base (no con el cliente) y los relee en
// caliente cuando la web avisa por la ruta interna.
let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
});
afterEach(() => {
  setWorldEdits("planta-baja", EMPTY_EDITS);
});

/** Conecta y guarda lo último que el servidor le dijo de sus permisos. */
async function join(room: Awaited<ReturnType<ColyseusTestServer["createRoom"]>>, sub: string, name: string, role: "ADMIN" | "MEMBER" = "MEMBER") {
  const client = await colyseus.connectTo(room, { token: await token(sub, name, "ada", role) });
  const seen: { last: PermisosView | null } = { last: null };
  client.onMessage(PERMISOS_MSG.state, (m: PermisosView) => (seen.last = m));
  await until(() => seen.last, `los permisos de ${name}`);
  return { client, seen };
}

async function lock(client: ClientRoom): Promise<WorldEditLockResult> {
  const got = new Promise<WorldEditLockResult>((resolve) => client.onMessage(MSG.worldEditLockResult, resolve));
  client.send(MSG.worldEditLock, { on: true });
  return got;
}

async function edit(client: ClientRoom): Promise<WorldEditResult> {
  const plant = worldFurniture(planDef("planta-baja")!).find((f) => f.type === "plant")!;
  const got = new Promise<WorldEditResult>((resolve) => client.onMessage(MSG.worldEditResult, resolve));
  client.send(MSG.worldEdit, { area: "planta-baja", op: { action: "remove", key: plant.key } });
  return got;
}

const avisar = () =>
  fetch(`http://localhost:${TEST_PORT}${INTERNAL_ROUTES.permissionsChanged}`, { method: "POST", headers: { Authorization: `Bearer ${SECRET}` } });

describe("permisos por persona", () => {
  it("sin permiso se rechaza y con el permiso se acepta", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    repo.permisos.set("u-eva", ["editar-casa"]);
    const bob = await join(room, "u-bob", "Bob");
    const eva = await join(room, "u-eva", "Eva");

    expect(bob.seen.last).toEqual({ admin: false, permisos: [] });
    expect(await lock(bob.client)).toEqual({ ok: false, error: "not-allowed" });
    expect(await edit(bob.client)).toEqual({ ok: false, error: "admin" });

    expect(eva.seen.last).toEqual({ admin: false, permisos: ["editar-casa"] });
    expect(await lock(eva.client)).toEqual({ ok: true });
    expect(await edit(eva.client)).toEqual({ ok: true });
  });

  it("el admin siempre puede, aunque no tenga filas", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    expect(ana.seen.last).toEqual({ admin: true, permisos: ["anunciar", "editar-casa"] });
    expect(await edit(ana.client)).toEqual({ ok: true });
  });

  it('"todos pueden" habilita a cualquiera', async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    repo.permisosTodos = ["editar-casa"];
    const bob = await join(room, "u-bob", "Bob");
    expect(bob.seen.last?.permisos).toEqual(["editar-casa"]);
    expect(await edit(bob.client)).toEqual({ ok: true });
  });

  it("dar y quitar el permiso en caliente: el aviso de la web lo aplica sin reconectar", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const bob = await join(room, "u-bob", "Bob");
    expect(await edit(bob.client)).toEqual({ ok: false, error: "admin" });

    repo.permisos.set("u-bob", ["editar-casa"]);
    expect((await avisar()).status).toBe(200);
    await until(() => bob.seen.last?.permisos.includes("editar-casa"), "que le llegue el permiso");
    expect(await lock(bob.client)).toEqual({ ok: true });
    expect(await edit(bob.client)).toEqual({ ok: true });

    // Se lo quitan con el editor abierto: lo suelta y ya no puede editar.
    repo.permisos.delete("u-bob");
    expect((await avisar()).status).toBe(200);
    await until(() => bob.seen.last?.permisos.length === 0, "que se le quite el permiso");
    expect(await edit(bob.client)).toEqual({ ok: false, error: "admin" });
    const eva = await join(room, "u-eva", "Eva", "ADMIN");
    expect(await lock(eva.client)).toEqual({ ok: true });
  });

  it("la ruta interna exige el secreto compartido", async () => {
    const res = await fetch(`http://localhost:${TEST_PORT}${INTERNAL_ROUTES.permissionsChanged}`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});
