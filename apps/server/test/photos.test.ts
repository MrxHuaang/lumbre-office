import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, verifyPhotoTicket, type PhotoCountdownEvent, type PhotoFlashEvent, type PhotoShot } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { PhotoBooth } from "../src/rooms/photos";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, SECRET, tick, token, until } from "./helpers";

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
  OfficeRoom.photoTimings = { countdownMs: 80, cooldownMs: 400 };
});
afterEach(() => {
  OfficeRoom.photoNow = () => Date.now();
  vi.restoreAllMocks();
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
  await room.waitForNextPatch();
  const got = {
    countdown: { alice: [] as PhotoCountdownEvent[], bob: [] as PhotoCountdownEvent[], carla: [] as PhotoCountdownEvent[] },
    flash: { bob: [] as PhotoFlashEvent[], carla: [] as PhotoFlashEvent[] },
    shot: { alice: [] as PhotoShot[], bob: [] as PhotoShot[] },
    changed: { alice: 0, carla: 0 },
  };
  alice.onMessage(MSG.photoCountdown, (e: PhotoCountdownEvent) => got.countdown.alice.push(e));
  bob.onMessage(MSG.photoCountdown, (e: PhotoCountdownEvent) => got.countdown.bob.push(e));
  carla.onMessage(MSG.photoCountdown, (e: PhotoCountdownEvent) => got.countdown.carla.push(e));
  bob.onMessage(MSG.photoFlash, (e: PhotoFlashEvent) => got.flash.bob.push(e));
  carla.onMessage(MSG.photoFlash, (e: PhotoFlashEvent) => got.flash.carla.push(e));
  alice.onMessage(MSG.photoShot, (e: PhotoShot) => got.shot.alice.push(e));
  bob.onMessage(MSG.photoShot, (e: PhotoShot) => got.shot.bob.push(e));
  alice.onMessage(MSG.photosChanged, () => got.changed.alice++);
  carla.onMessage(MSG.photosChanged, () => got.changed.carla++);
  return { room, alice, bob, carla, got };
}

describe("fotos", () => {
  it("la cuenta 3-2-1 la ven los del mismo nivel; el ticket, solo quien la sacó y con quiénes salen", async () => {
    // Cuenta larga: "todavía contando" no depende de qué tan rápido lleguen los mensajes.
    OfficeRoom.photoTimings = { countdownMs: 400, cooldownMs: 400 };
    const { room, alice, carla, got } = await setup();
    await goToArea(carla, room, "planta-baja");
    alice.send(MSG.photoTake);
    await until(() => got.countdown.alice.length && got.countdown.bob.length, "la cuenta en el jardín");
    expect(got.countdown.alice).toEqual([{ sessionId: alice.sessionId, ms: 400 }]);
    expect(got.countdown.bob).toHaveLength(1);
    expect(got.shot.alice).toEqual([]); // todavía contando

    await until(() => got.shot.alice.length && got.flash.bob.length, "la foto");
    expect(got.shot.alice).toHaveLength(1);
    expect(got.shot.bob).toEqual([]);
    expect(got.flash.bob).toEqual([{ sessionId: alice.sessionId }]);
    expect(got.flash.carla).toEqual([]);
    expect(got.countdown.carla).toEqual([]);

    const shot = got.shot.alice[0]!;
    // Todos aparecen en el mismo punto del jardín: Alice primero, Bob a su lado, Carla está en otro nivel.
    expect(shot.people.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    const claims = await verifyPhotoTicket(shot.ticket, SECRET);
    expect(claims).toMatchObject({ sub: "u-alice", area: "jardin", people: shot.people, takenAt: shot.takenAt });
    expect(claims.jti).toBeTruthy();
  });

  it("no se pueden sacar en ráfaga", async () => {
    // La pausa se mide con un reloj fijo: con esperas de verdad, un mensaje que el servidor lee tarde
    // (máquina cargada) acorta la pausa que "ve" el servidor y la segunda foto salía rechazada.
    let now = 1_000_000;
    OfficeRoom.photoNow = () => now;
    const takes = vi.spyOn(PhotoBooth.prototype, "take");
    const { alice, got } = await setup();
    alice.send(MSG.photoTake);
    alice.send(MSG.photoTake); // la primera todavía cuenta
    await until(() => got.shot.alice.length === 1, "la primera foto");
    expect(got.countdown.alice).toHaveLength(1);

    now += 399; // todavía en la pausa
    alice.send(MSG.photoTake);
    await until(() => takes.mock.calls.length === 3, "que el servidor lea el tercer pedido");
    expect(got.countdown.alice).toHaveLength(1);

    now += 1; // se cumplió la pausa
    alice.send(MSG.photoTake);
    await until(() => got.shot.alice.length === 2, "la segunda foto");
    expect(got.countdown.alice).toHaveLength(2);
  });

  it("si se va a otro nivel durante la cuenta, no hay foto", async () => {
    OfficeRoom.photoTimings = { countdownMs: 3000, cooldownMs: 400 };
    const { room, alice, got } = await setup();
    alice.send(MSG.photoTake);
    await tick(40);
    await goToArea(alice, room, "planta-baja");
    await tick(3100);
    expect(got.shot.alice).toEqual([]);
  }, 10_000);

  it("el aviso de la web llega a todos (para refrescar el tablón)", async () => {
    const { got } = await setup();
    OfficeRoom.broadcastPhotosChanged();
    await until(() => got.changed.alice && got.changed.carla, "el aviso");
    expect(got.changed).toEqual({ alice: 1, carla: 1 });
  });
});
