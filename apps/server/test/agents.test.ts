import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { MSG, ROOM_NAME, type AgentAck, type AgentSay, type AgentStreamMessage } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createGameServer } from "../src/app";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { c, FakeAgentQueue, tick, token } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let queue: FakeAgentQueue;

beforeAll(async () => {
  colyseus = await boot(createGameServer({ repo: new MemoryRepository(), agentQueue: new FakeAgentQueue() }));
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  repo.agents = [{ id: "a1", name: "Nova", role: "Asistente general", sprite: "bot-amber", deskId: "desk-1" }];
  queue = new FakeAgentQueue();
  OfficeRoom.repo = repo;
  OfficeRoom.agentQueue = queue;
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

function next<T>(client: ClientRoom, type: string): Promise<T> {
  return new Promise((resolve) => {
    const off = client.onMessage(type, (m: T) => {
      off();
      resolve(m);
    });
  });
}

function collect<T>(client: ClientRoom, type: string): T[] {
  const got: T[] = [];
  client.onMessage(type, (m: T) => got.push(m));
  return got;
}

describe("agentes en la oficina", () => {
  it("ubica al agente en su escritorio del laboratorio", async () => {
    const { room } = await setup();
    const nova = room.state.agents.get("a1")!;
    expect(nova.name).toBe("Nova");
    expect(nova.status).toBe("idle");
    expect(nova.zoneId).toBe("lab");
    // desk-1: silla en el tile (3, 19)
    expect(Math.floor(nova.x / 32)).toBe(3);
    expect(Math.floor(nova.y / 32)).toBe(19);
  });

  it("preguntar encola un trabajo con la identidad del servidor y permite una sola respuesta en curso", async () => {
    const { alice } = await setup();
    const ackP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "¿Qué clima hace?" });
    const ack = await ackP;
    expect(ack.runId).toBeTruthy();
    expect(queue.jobs).toEqual([
      { kind: "chat", runId: ack.runId, agentId: "a1", userId: "u-alice", userName: "Alice", message: "¿Qué clima hace?" },
    ]);

    const secondP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "otra" });
    expect((await secondP).error).toMatch(/todavía está respondiendo/);
    expect(queue.jobs).toHaveLength(1);
  });

  it("el estado es visible para todos, pero la respuesta solo le llega a quien preguntó", async () => {
    const { room, alice, bob } = await setup();
    const ackP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "hola" });
    const { runId } = await ackP;
    const aliceStream = collect<AgentStreamMessage>(alice, MSG.agentStream);
    const bobStream = collect<AgentStreamMessage>(bob, MSG.agentStream);
    const aliceSay = collect<AgentSay>(alice, MSG.agentSay);

    OfficeRoom.handleAgentEvent({ type: "agent.status", agentId: "a1", runId: "status", seq: 1, ts: 1, status: "writing" });
    await room.waitForNextPatch();
    expect(room.state.agents.get("a1")!.status).toBe("writing");

    OfficeRoom.handleAgentEvent({ type: "agent.delta", agentId: "a1", runId: runId!, seq: 0, ts: 1, userId: "u-alice", text: "Hola " });
    OfficeRoom.handleAgentEvent({
      type: "agent.reply",
      agentId: "a1",
      runId: runId!,
      seq: 1,
      ts: 2,
      userId: "u-alice",
      text: "Hola **Alice**, todo bien.\n\n**Fuentes**\n- [x](https://x.example)",
    });
    await tick(80);

    expect(aliceStream.map((m) => [m.text.slice(0, 5), m.done])).toEqual([
      ["Hola ", false],
      ["Hola ", true],
    ]);
    expect(bobStream).toHaveLength(0);
    expect(aliceSay).toEqual([{ agentId: "a1", text: "Hola Alice, todo bien." }]);

    // Terminada la respuesta, se puede volver a preguntar.
    const againP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "gracias" });
    expect((await againP).runId).toBeTruthy();
  });

  it("si la cola no está disponible avisa y permite reintentar", async () => {
    const { alice } = await setup();
    queue.fail = true;
    const failP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "hola" });
    expect((await failP).error).toMatch(/no está disponible/);

    queue.fail = false;
    const okP = next<AgentAck>(alice, MSG.agentAck);
    alice.send(MSG.agentAsk, { agentId: "a1", text: "hola" });
    expect((await okP).runId).toBeTruthy();
  });

  it("los cambios en los agentes (editor) se reflejan al recargar", async () => {
    const { room } = await setup();
    repo.agents = [{ id: "a2", name: "Atlas", role: "Investigador", sprite: "bot-blue", deskId: "desk-2" }];
    await OfficeRoom.reloadAgentsEverywhere();
    await room.waitForNextPatch();
    expect([...room.state.agents.keys()]).toEqual(["a2"]);
    expect(Math.floor(room.state.agents.get("a2")!.x / 32)).toBe(8);
    expect(c(0)).toBe(16);
  });
});
