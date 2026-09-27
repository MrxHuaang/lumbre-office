import type { ColyseusTestServer } from "@colyseus/testing";
import { EMOTE, MSG, ROOM_NAME, type EmoteEvent } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token } from "./helpers";

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
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  const carla = await colyseus.connectTo(room, { token: await token("u-carla", "Carla", "carla") });
  await room.waitForNextPatch();
  const got = { alice: [] as EmoteEvent[], bob: [] as EmoteEvent[], carla: [] as EmoteEvent[] };
  alice.onMessage(MSG.emoteEvent, (e: EmoteEvent) => got.alice.push(e));
  bob.onMessage(MSG.emoteEvent, (e: EmoteEvent) => got.bob.push(e));
  carla.onMessage(MSG.emoteEvent, (e: EmoteEvent) => got.carla.push(e));
  return { room, alice, bob, carla, got };
}

describe("emotes", () => {
  it("los ve quien está en el mismo nivel (y quien lo hizo), no los de otro nivel", async () => {
    const { room, alice, carla, got } = await setup();
    await goToArea(carla, room, "planta-baja");
    alice.send(MSG.emote, { emote: "wave" });
    await tick(120);
    expect(got.alice).toEqual([{ sessionId: alice.sessionId, emote: "wave" }]);
    expect(got.bob).toEqual([{ sessionId: alice.sessionId, emote: "wave" }]);
    expect(got.carla).toEqual([]);
  });

  it("no se pueden mandar en ráfaga ni inventar emotes", async () => {
    const { alice, got } = await setup();
    alice.send(MSG.emote, { emote: "heart" });
    alice.send(MSG.emote, { emote: "heart" });
    alice.send(MSG.emote, { emote: "fuego" });
    await tick(120);
    expect(got.bob.map((e) => e.emote)).toEqual(["heart"]);
  });

  it("acepta los emotes nuevos, con pausa entre uno y otro y tope por ráfaga", async () => {
    const { alice, got } = await setup();
    const sent = ["cry", "angry", "sleep", "party", "coffee", "music", "surprise"] as const;
    for (const emote of sent) {
      alice.send(MSG.emote, { emote });
      await tick(EMOTE.cooldownMs + 30);
    }
    await tick(60);
    const seen = got.bob.map((e) => e.emote);
    // Aunque se respete la pausa, hay tope: no más de `burst` en la ventana (7 envíos en ~7 s).
    expect(seen).toEqual(sent.slice(0, EMOTE.burst));
  }, 20_000);
});
