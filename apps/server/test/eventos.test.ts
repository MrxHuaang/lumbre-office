import type { ColyseusTestServer } from "@colyseus/testing";
import { BIRTHDAY, MSG, ROOM_NAME, type CongratsEvent, type CongratsResult, type PointsAwarded } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

/** Hora de Bogotá (UTC-5) como timestamp. */
const bogota = (y: number, m: number, d: number, h: number, min = 0) => Date.UTC(y, m - 1, d, h + 5, min);
// El 2 de octubre de 2026 es viernes.
const FRIDAY_NOON = bogota(2026, 10, 2, 12);

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
  OfficeRoom.eventsNow = () => FRIDAY_NOON;
});
afterEach(() => {
  OfficeRoom.eventsNow = () => Date.now();
  OfficeRoom.eventsRefreshMs = 30_000;
});

function collect<T>(client: ClientRoom, type: string): T[] {
  const out: T[] = [];
  client.onMessage(type, (m: T) => out.push(m));
  return out;
}

async function setup(names: [string, string][] = [["u-alice", "Alice"], ["u-bob", "Bob"], ["u-carla", "Carla"]]) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const clients: ClientRoom[] = [];
  for (const [id, name] of names) clients.push(await colyseus.connectTo(room, { token: await token(id, name) }));
  await room.waitForNextPatch();
  return { room, clients };
}

describe("cumpleaños", () => {
  it("quien cumple hoy (día de Bogotá) aparece en el estado, aunque no esté conectado", async () => {
    repo.birthdays.set("u-alice", { name: "Alice", birthday: "10-02" });
    repo.birthdays.set("u-dario", { name: "Darío", birthday: "10-02" });
    repo.birthdays.set("u-bob", { name: "Bob", birthday: "10-03" });
    const { room } = await setup();
    expect(Object.fromEntries(room.state.events.birthdays.entries())).toEqual({ "u-alice": "Alice", "u-dario": "Darío" });
  });

  it("felicitar da puntos a quien cumple una vez por persona y día, y nadie se felicita solo", async () => {
    repo.birthdays.set("u-alice", { name: "Alice", birthday: "10-02" });
    const { room, clients } = await setup();
    const [alice, bob, carla] = clients as [ClientRoom, ClientRoom, ClientRoom];
    const bobResults = collect<CongratsResult>(bob, MSG.congratsResult);
    const aliceResults = collect<CongratsResult>(alice, MSG.congratsResult);
    const aliceAwards = collect<PointsAwarded>(alice, MSG.pointsAwarded);
    const events = collect<CongratsEvent>(carla, MSG.congratsEvent);
    carla.onMessage(MSG.congratsResult, () => undefined);
    bob.onMessage(MSG.congratsEvent, () => undefined);
    alice.onMessage(MSG.congratsEvent, () => undefined);

    bob.send(MSG.congrats, { userId: "u-alice" });
    await tick(80);
    bob.send(MSG.congrats, { userId: "u-alice" });
    alice.send(MSG.congrats, { userId: "u-alice" });
    bob.send(MSG.congrats, { userId: "u-carla" });
    carla.send(MSG.congrats, { userId: "u-alice" });
    await tick(120);

    expect(bobResults).toEqual([{ ok: true, toName: "Alice" }, { ok: false, error: "already" }, { ok: false, error: "not-birthday" }]);
    expect(aliceResults).toEqual([{ ok: false, error: "self" }]);
    expect(aliceAwards.map((a) => [a.amount, a.reason])).toEqual([
      [BIRTHDAY.congratsPoints, "GIFT"],
      [BIRTHDAY.congratsPoints, "GIFT"],
    ]);
    expect(await repo.getPoints("u-alice")).toBe(BIRTHDAY.congratsPoints * 2);
    expect(room.state.players.get(alice.sessionId)!.points).toBe(BIRTHDAY.congratsPoints * 2);
    expect(events.map((e) => [e.fromName, e.toName, e.points])).toEqual([
      ["Bob", "Alice", BIRTHDAY.congratsPoints],
      ["Carla", "Alice", BIRTHDAY.congratsPoints],
    ]);
  });

  it("las felicitaciones con puntos tienen tope por día (después se agradecen igual)", async () => {
    repo.birthdays.set("u-alice", { name: "Alice", birthday: "10-02" });
    const people: [string, string][] = [["u-alice", "Alice"]];
    for (let i = 0; i <= BIRTHDAY.congratsDailyCap; i++) people.push([`u-${i}`, `Persona ${i}`]);
    const { clients } = await setup(people);
    const results: CongratsResult[] = [];
    for (const c of clients.slice(1)) {
      c.onMessage(MSG.congratsResult, (r: CongratsResult) => results.push(r));
      c.onMessage(MSG.congratsEvent, () => undefined);
      c.send(MSG.congrats, { userId: "u-alice" });
    }
    clients[0]!.onMessage(MSG.congratsEvent, () => undefined);
    clients[0]!.onMessage(MSG.pointsAwarded, () => undefined);
    await tick(200);
    expect(results.filter((r) => r.ok)).toHaveLength(BIRTHDAY.congratsDailyCap + 1);
    expect(await repo.getPoints("u-alice")).toBe(BIRTHDAY.congratsPoints * BIRTHDAY.congratsDailyCap);
  });

  it("al cambiar el perfil se vuelve a leer quién cumple", async () => {
    const { room, clients } = await setup([["u-bob", "Bob"]]);
    expect(room.state.events.birthdays.size).toBe(0);
    repo.birthdays.set("u-bob", { name: "Bob", birthday: "10-02" });
    clients[0]!.send(MSG.profileChanged);
    await tick(80);
    await room.waitForNextPatch();
    expect(room.state.events.birthdays.get("u-bob")).toBe("Bob");
  });
});

describe("viernes de karaoke", () => {
  it("el club es karaoke los viernes desde las 17:00 de Bogotá", async () => {
    OfficeRoom.eventsNow = () => bogota(2026, 10, 2, 16, 59);
    OfficeRoom.eventsRefreshMs = 50;
    const { room } = await setup([["u-bob", "Bob"]]);
    expect(room.state.events.karaoke).toBe(false);
    OfficeRoom.eventsNow = () => bogota(2026, 10, 2, 17, 0);
    await tick(150);
    expect(room.state.events.karaoke).toBe(true);
    // A la medianoche se apaga.
    OfficeRoom.eventsNow = () => bogota(2026, 10, 3, 0, 0);
    await tick(150);
    expect(room.state.events.karaoke).toBe(false);
  });

  it("un jueves de noche no hay karaoke", async () => {
    OfficeRoom.eventsNow = () => bogota(2026, 10, 1, 20);
    const { room } = await setup([["u-bob", "Bob"]]);
    expect(room.state.events.karaoke).toBe(false);
  });
});
