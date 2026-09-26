import { WebSocketTransport } from "@colyseus/ws-transport";
import { INTERNAL_ROUTES, ROOM_NAME } from "@hyvento/shared";
import { Server } from "colyseus";
import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { GameRepository } from "./repo/types";
import { OfficeRoom } from "./rooms/OfficeRoom";

/** Compara el `Authorization: Bearer <secreto>` sin filtrar información por tiempos. */
function authorized(req: IncomingMessage, secret: string | undefined): boolean {
  const header = req.headers.authorization ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Rutas HTTP propias (Colyseus atiende antes las de matchmaking):
 * - GET  /health: chequeo de salud del hosting.
 * - POST /internal/offices-changed: la web avisa que cambiaron dueños/nombres de oficinas.
 * - POST /internal/points-changed: la web cambió el saldo de alguien (body `{ userId }`).
 */
async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? "").split("?")[0];
  if (req.method === "GET" && (path === INTERNAL_ROUTES.health || path === "/")) {
    return json(res, 200, { ok: true, rooms: OfficeRoom.instances.size });
  }
  if (req.method === "POST" && path === INTERNAL_ROUTES.officesChanged) {
    if (!authorized(req, process.env.GAME_TOKEN_SECRET)) return json(res, 401, { error: "no autorizado" });
    try {
      await OfficeRoom.reloadOfficesEverywhere();
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error("reloadOffices", err);
      return json(res, 500, { error: "no se pudieron recargar las oficinas" });
    }
  }
  if (req.method === "POST" && path === INTERNAL_ROUTES.pointsChanged) {
    if (!authorized(req, process.env.GAME_TOKEN_SECRET)) return json(res, 401, { error: "no autorizado" });
    const body = (await readJson(req)) as { userId?: unknown } | null;
    if (!body || typeof body.userId !== "string") return json(res, 400, { error: "falta userId" });
    try {
      await OfficeRoom.reloadPointsEverywhere(body.userId);
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error("reloadPoints", err);
      return json(res, 500, { error: "no se pudo recargar el saldo" });
    }
  }
  json(res, 404, { error: "no encontrado" });
}

/** Lee un cuerpo JSON chico (hasta 4 KB); null si no es válido. */
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
      if (data.length > 4096) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

export function createGameServer({ repo }: { repo: GameRepository }) {
  OfficeRoom.repo = repo;
  const http = createServer((req, res) => void handleHttp(req, res));
  const server = new Server({ transport: new WebSocketTransport({ server: http }) });
  server.define(ROOM_NAME, OfficeRoom);
  return server;
}
