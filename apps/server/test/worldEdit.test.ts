import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, isBlockedTile, parseWorldEdits, planDef, setWorldEdits, EMPTY_EDITS, worldFurniture } from "@hyvento/map";
import { MSG, ROOM_NAME, type WorldEditLockResult, type WorldEditResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token } from "./helpers";

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
  // El mundo es compartido en el proceso: se deja como en el plano.
  setWorldEdits("planta-baja", EMPTY_EDITS);
});

async function send(client: ClientRoom, msg: unknown): Promise<WorldEditResult> {
  const got = new Promise<WorldEditResult>((resolve) => client.onMessage(MSG.worldEditResult, resolve));
  client.send(MSG.worldEdit, msg);
  return got;
}

async function lock(client: ClientRoom, on = true): Promise<WorldEditLockResult> {
  const got = new Promise<WorldEditLockResult>((resolve) => client.onMessage(MSG.worldEditLockResult, resolve));
  client.send(MSG.worldEditLock, { on });
  return got;
}

describe("editor de la casa", () => {
  it("solo quien tiene el permiso de la casa edita, y una persona a la vez", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana", "ada", "ADMIN", { houseEditor: true }) });
    const otro = await colyseus.connectTo(room, { token: await token("u-otro", "Otro", "bruno", "ADMIN", { houseEditor: false }) });
    const eva = await colyseus.connectTo(room, { token: await token("u-eva", "Eva", "ada", "ADMIN") });
    await room.waitForNextPatch();
    const plant = worldFurniture(planDef("planta-baja")!).find((f) => f.type === "plant")!;
    const quitar = { area: "planta-baja", op: { action: "remove", key: plant.key } };

    // Un admin sin el permiso de la casa (HOUSE_EDITOR_EMAIL) no entra ni edita.
    expect(await lock(otro)).toEqual({ ok: false, error: "not-allowed" });
    expect(await send(otro, quitar)).toEqual({ ok: false, error: "admin" });
    // Ana toma el editor; Eva (admin con token viejo, sin el campo) tiene que esperar.
    expect(await lock(ana)).toEqual({ ok: true });
    expect(await lock(eva)).toEqual({ ok: false, error: "busy", by: "Ana" });
    expect(await send(eva, quitar)).toEqual({ ok: false, error: "busy" });
    expect(await send(ana, quitar)).toEqual({ ok: true });
    // Ana sale del editor (o se va): Eva puede entrar.
    ana.send(MSG.worldEditLock, { on: false });
    await tick(60);
    expect(await lock(eva)).toEqual({ ok: true });
    await eva.leave();
    await tick(60);
    expect(await lock(ana)).toEqual({ ok: true });
  });


  it("un admin quita un mueble del plano: se guarda, llega al estado y el nivel cambia; alguien sin permisos no puede", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const admin = await colyseus.connectTo(room, { token: await token("u-admin", "Ana", "ada", "ADMIN") });
    const member = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    const plant = worldFurniture(planDef("planta-baja")!).find((f) => f.type === "plant")!;

    expect(await send(member, { area: "planta-baja", op: { action: "remove", key: plant.key } })).toEqual({ ok: false, error: "admin" });
    expect(await send(admin, { area: "planta-baja", op: { action: "remove", key: plant.key } })).toEqual({ ok: true });
    await tick(60);
    expect(parseWorldEdits(repo.worldEdits["planta-baja"]).removed).toEqual([plant.key]);
    expect(parseWorldEdits(JSON.parse(room.state.worldEdits.get("planta-baja")!)).removed).toEqual([plant.key]);
    expect(isBlockedTile(getWorld().areas.get("planta-baja")!, plant.x, plant.y)).toBe(false);
    // Poner algo sobre una escalera no se puede.
    const stairs = worldFurniture(planDef("planta-baja")!).find((f) => f.fixed)!;
    expect(await send(admin, { area: "planta-baja", op: { action: "remove", key: stairs.key } })).toEqual({ ok: false, error: "fixed" });
  });

  it("los cambios guardados se cargan al crear la sala", async () => {
    const plant = worldFurniture(planDef("planta-baja")!).find((f) => f.type === "plant")!;
    repo.worldEdits["planta-baja"] = { removed: [plant.key], added: [] };
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    expect(room.state.worldEdits.get("planta-baja")).toContain(plant.key);
    expect(isBlockedTile(getWorld().areas.get("planta-baja")!, plant.x, plant.y)).toBe(false);
  });
});
