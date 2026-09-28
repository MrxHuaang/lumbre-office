import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, gameTime, type ChatEvent } from "@hyvento/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 1_000_000;

beforeAll(async () => {
  repo = new MemoryRepository();
  colyseus = await bootServer(repo);
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  now = 1_000_000;
  OfficeRoom.gameClockNow = () => now;
  // Arranca el día 2 a las 10:00.
  OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 2 * 1440 + 10 * 60 };
  OfficeRoom.weatherInitial = null;
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
});

async function join(role: "ADMIN" | "MEMBER") {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const client = await colyseus.connectTo(room, { token: await token(`u-${role}`, role, "ada", role) });
  const notes: string[] = [];
  const events: ChatEvent[] = [];
  client.onMessage(MSG.chatEvent, (e: ChatEvent) => {
    notes.push(e.text);
    events.push(e);
  });
  await room.waitForNextPatch();
  const clock = () => gameTime({ anchorReal: room.state.clockAnchorReal, anchorMinute: room.state.clockAnchorMinute }, now);
  return { room, client, notes, events, clock };
}

describe("reloj del juego en la sala", () => {
  it("todos ven el reloj en el estado y corre una hora del juego cada 2,5 minutos", async () => {
    const { clock } = await join("MEMBER");
    expect(clock()).toMatchObject({ day: 2, hour: 10, minute: 0 });
    now += 225_000;
    expect(clock()).toMatchObject({ hour: 11, minute: 30 });
  });

  it("un admin cambia la hora con /time set y /time add", async () => {
    const { client, room, notes, clock } = await join("ADMIN");
    client.send(MSG.chatSend, { text: "/time set noche", scope: "proximity" });
    await tick(80);
    await room.waitForNextPatch();
    expect(clock()).toMatchObject({ day: 2, hour: 20 });
    client.send(MSG.chatSend, { text: "/time add 6h", scope: "proximity" });
    await tick(80);
    await room.waitForNextPatch();
    expect(clock()).toMatchObject({ day: 3, hour: 2 });
    expect(notes.at(-1)).toBe("Día 4, 02:00.");
  });

  it("alguien que no es admin solo puede preguntar la hora", async () => {
    const { client, notes, clock } = await join("MEMBER");
    client.send(MSG.chatSend, { text: "/time set noche", scope: "proximity" });
    await tick(80);
    expect(clock()).toMatchObject({ hour: 10 });
    expect(notes).toContain("Solo un admin puede cambiar la hora.");
    client.send(MSG.chatSend, { text: "/hora", scope: "proximity" });
    await tick(80);
    expect(notes.at(-1)).toBe("Día 3, 10:00.");
  });

  it("el aviso del reloj es del sistema y llega en la pestaña donde se escribió", async () => {
    const { client, events } = await join("MEMBER");
    client.send(MSG.chatSend, { text: "/time", scope: "global" });
    await tick(80);
    expect(events.at(-1)).toMatchObject({ fromId: "", fromName: "Reloj", scope: "global", text: "Día 3, 10:00." });
  });

  it("el clima con que arranca la sala sigue la hora del juego (niebla de mañana)", async () => {
    OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 6 * 60 };
    const morning = await join("MEMBER");
    expect(morning.room.state.weather).toBe("niebla");
    await colyseus.cleanup();
    OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 13 * 60 };
    const noon = await join("MEMBER");
    expect(noon.room.state.weather).toBe("despejado");
  });
});
