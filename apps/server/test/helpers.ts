import type { ColyseusTestServer } from "@colyseus/testing";
import { MSG, signGameToken, type AgentChatJob, type GameTokenClaims } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import type { OfficeState } from "../src/state";

export const SECRET = "test-secret-test-secret-test-secret-123";
process.env.GAME_TOKEN_SECRET = SECRET;

export const TILE = 32;
/** Centro de un tile en píxeles. */
export const c = (t: number) => t * TILE + TILE / 2;

export const token = (sub: string, name: string, avatar: GameTokenClaims["avatar"] = "ada") =>
  signGameToken({ sub, name, avatar, role: "MEMBER" }, SECRET);

export const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

type ServerRoom = Awaited<ReturnType<ColyseusTestServer["createRoom"]>> & { state: OfficeState };

/** Mueve a un jugador en pasos pequeños en línea recta (como lo haría el cliente real). */
export async function walkTo(client: ClientRoom, room: ServerRoom, x: number, y: number) {
  const p = room.state.players.get(client.sessionId)!;
  let cx = p.x;
  let cy = p.y;
  while (Math.hypot(x - cx, y - cy) > 1) {
    const d = Math.hypot(x - cx, y - cy);
    const step = Math.min(10, d);
    cx += ((x - cx) / d) * step;
    cy += ((y - cy) / d) * step;
    client.send(MSG.move, { x: cx, y: cy, dir: "down", moving: true });
  }
  await room.waitForNextPatch();
  await tick(20);
}

/** Recorre una lista de puntos (en tiles) desde la posición actual. */
export async function walkPath(client: ClientRoom, room: ServerRoom, tiles: [number, number][]) {
  for (const [tx, ty] of tiles) await walkTo(client, room, c(tx), c(ty));
}

/** Ruta desde el spawn (fila 13) hasta el interior de la oficina 4 (puerta en x=24, y=8). */
export const INTO_OFFICE_4: [number, number][] = [
  [24, 13],
  [24, 10],
  [24, 6],
];
/** Justo afuera de la puerta de la oficina 4. */
export const OUTSIDE_OFFICE_4: [number, number][] = [
  [24, 13],
  [24, 10],
];

/** Cola de agentes simulada: guarda los trabajos encolados. */
export class FakeAgentQueue {
  jobs: AgentChatJob[] = [];
  fail = false;
  async enqueue(job: AgentChatJob) {
    if (this.fail) throw new Error("cola caída");
    this.jobs.push(job);
  }
}
