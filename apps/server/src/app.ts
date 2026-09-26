import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hyvento/shared";
import { Server } from "colyseus";
import type { AgentQueue, GameRepository } from "./repo/types";
import { OfficeRoom } from "./rooms/OfficeRoom";

export function createGameServer({ repo, agentQueue }: { repo: GameRepository; agentQueue: AgentQueue }) {
  OfficeRoom.repo = repo;
  OfficeRoom.agentQueue = agentQueue;
  const server = new Server({ transport: new WebSocketTransport() });
  server.define(ROOM_NAME, OfficeRoom);
  return server;
}
