import type { ColyseusTestServer } from "@colyseus/testing";
import { EMPTY_EDITS, planDef, setWorldEdits, worldFurniture } from "@hyvento/map";
import {
  COM_MSG,
  COMUNICACION,
  INTERNAL_ROUTES,
  MSG,
  PERMISOS_MSG,
  ROOM_NAME,
  type Announcement,
  type AnnounceResult,
  type PermisosView,
  type WorldEditLockResult,
  type WorldEditResult,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { COM_TIMINGS } from "../src/rooms/comunicacion";
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
  // Acá se prueba quién puede anunciar, no las pausas (tienen su test en comunicacion.test.ts).
  COM_TIMINGS.announceCooldownMs = 0;
  COM_TIMINGS.announceGapMs = 0;
});
afterEach(() => {
  setWorldEdits("planta-baja", EMPTY_EDITS);
  COM_TIMINGS.announceCooldownMs = COMUNICACION.announceCooldownMs;
  COM_TIMINGS.announceGapMs = COMUNICACION.announceGapMs;
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
    expect(ana.seen.last).toEqual({ admin: true, permisos: ["anunciar", "editar-casa", "director"] });
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

  describe("anunciar", () => {
    /** Manda un aviso y espera o el aviso (llegó a todos) o el rechazo. */
    async function anunciar(who: ClientRoom, text: string): Promise<"ok" | AnnounceResult["error"]> {
      return new Promise((resolve) => {
        who.onMessage(COM_MSG.announcement, (a: Announcement) => a.text === text && resolve("ok"));
        who.onMessage(COM_MSG.announceResult, (r: AnnounceResult) => resolve(r.error));
        who.send(COM_MSG.announce, { text });
      });
    }

    it("sin permiso se rechaza; con permiso, con 'todos pueden' y siendo admin se acepta", async () => {
      const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
      repo.permisos.set("u-eva", ["anunciar"]);
      const bob = await join(room, "u-bob", "Bob");
      const eva = await join(room, "u-eva", "Eva");
      const ana = await join(room, "u-ana", "Ana", "ADMIN");

      expect(await anunciar(bob.client, "hola bob")).toBe("admin");
      expect(await anunciar(eva.client, "hola eva")).toBe("ok");
      expect(await anunciar(ana.client, "hola ana")).toBe("ok");

      repo.permisosTodos = ["anunciar"];
      await avisar();
      await until(() => bob.seen.last?.permisos.includes("anunciar"), "que se abra a todos");
      expect(await anunciar(bob.client, "ahora sí")).toBe("ok");
    });

    it("quitar el permiso en caliente: el siguiente anuncio se rechaza", async () => {
      const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
      repo.permisos.set("u-eva", ["anunciar"]);
      const eva = await join(room, "u-eva", "Eva");
      expect(await anunciar(eva.client, "antes")).toBe("ok");

      repo.permisos.delete("u-eva");
      await avisar();
      await until(() => eva.seen.last?.permisos.length === 0, "que se le quite el permiso");
      expect(await anunciar(eva.client, "después")).toBe("admin");
    });
  });
});
