import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@hyvento/shared";
import { Server } from "colyseus";
import { OfficeRoom } from "./rooms/OfficeRoom";

export function createGameServer() {
  const server = new Server({ transport: new WebSocketTransport() });
  server.define(ROOM_NAME, OfficeRoom);
  return server;
}
