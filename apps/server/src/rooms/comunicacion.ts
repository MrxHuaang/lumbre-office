// Engancha la comunicación rápida a la sala (llamadas.ts, saludos.ts y anuncio.ts): arma los tres con lo
// que la sala ya tiene y registra sus mensajes (`COM_MSG`). En OfficeRoom queda una sola línea.
import { randomUUID } from "node:crypto";
import { COM_MSG, COMUNICACION, STAT_KEYS } from "@hyvento/shared";
import type { Client, Room } from "colyseus";
import type { OfficeState, Player } from "../state";
import { Anuncio } from "./anuncio";
import { Llamadas } from "./llamadas";
import type { Phones } from "./phones";
import { Saludos } from "./saludos";

/** Pausas y topes (los tests los acortan). */
export const COM_TIMINGS = {
  callCooldownMs: COMUNICACION.callCooldownMs as number,
  waveCooldownMs: COMUNICACION.waveCooldownMs as number,
  announceCooldownMs: COMUNICACION.announceCooldownMs as number,
  broadcastMaxMs: COMUNICACION.broadcastMaxMs as number,
};

/** Lo que la sala le presta al módulo (lo demás lo saca de la sala misma: estado, clientes, reloj). */
export interface ComunicacionRoomDeps {
  phones: Phones;
  /** Contador de logros (las llamadas suman a "phoneCalls"). */
  bump: (userId: string, key: string) => void;
  /** Hubo actividad real (para los puntos de presencia). */
  markActive: (client: Client) => void;
}

export interface Comunicacion {
  /** Una sesión nueva: si hay anuncio por voz, que lo sepa. */
  greet(sessionId: string): void;
  /** Alguien se fue del todo: se corta su anuncio y se olvidan sus pausas. */
  forget(userId: string): void;
  dispose(): void;
}

type AdminData = { admin?: boolean };

export function registerComunicacion(room: Room<OfficeState>, deps: ComunicacionRoomDeps): Comunicacion {
  const who = (p: Player | undefined) => p && { userId: p.userId, name: p.name, status: p.status };
  const byUser = (userId: string) => [...room.state.players.values()].find((p) => p.userId === userId);
  const sessionOfUser = (userId: string) => {
    for (const [sessionId, p] of room.state.players.entries()) if (p.userId === userId && room.clients.getById(sessionId)) return sessionId;
    return null;
  };
  const send = (sessionId: string, type: string, message: unknown) => room.clients.getById(sessionId)?.send(type, message);

  const llamadas = new Llamadas({
    phones: deps.phones,
    who: (sessionId) => who(room.state.players.get(sessionId)),
    whoByUser: (userId) => who(byUser(userId)),
    send,
    now: () => Date.now(),
    called: (userId) => deps.bump(userId, STAT_KEYS.phoneCalls),
    cooldownMs: () => COM_TIMINGS.callCooldownMs,
  });
  const saludos = new Saludos({
    person: (sessionId) => who(room.state.players.get(sessionId)),
    sessionOfUser,
    send,
    now: () => Date.now(),
    newId: () => randomUUID(),
    cooldownMs: () => COM_TIMINGS.waveCooldownMs,
  });
  const anuncio = new Anuncio({
    person: (sessionId) => {
      const p = room.state.players.get(sessionId);
      const admin = (room.clients.getById(sessionId)?.userData as AdminData | undefined)?.admin ?? false;
      return p && { userId: p.userId, name: p.name, admin };
    },
    toAll: (type, message) => room.broadcast(type, message),
    toSession: send,
    setBroadcast: (userId, until) => {
      for (const p of room.state.players.values()) if (p.userId === userId) p.broadcastUntil = until;
    },
    later: (ms, fn) => room.clock.setTimeout(fn, ms),
    now: () => Date.now(),
    newId: () => randomUUID(),
    maxMs: () => COM_TIMINGS.broadcastMaxMs,
    cooldownMs: () => COM_TIMINGS.announceCooldownMs,
  });

  const active = (client: Client, fn: (sessionId: string) => void) => {
    deps.markActive(client);
    fn(client.sessionId);
  };
  room.onMessage(COM_MSG.call, (client, raw) => active(client, (id) => llamadas.call(id, raw)));
  room.onMessage(COM_MSG.add, (client, raw) => active(client, (id) => llamadas.add(id, raw)));
  room.onMessage(COM_MSG.wave, (client, raw) => active(client, (id) => saludos.wave(id, raw)));
  room.onMessage(COM_MSG.announce, (client, raw) => active(client, (id) => anuncio.announce(id, raw)));
  room.onMessage(COM_MSG.broadcastStart, (client) => active(client, (id) => anuncio.start(id)));
  room.onMessage(COM_MSG.broadcastStop, (client) => anuncio.stop(client.sessionId));

  return {
    greet: (sessionId) => anuncio.greet(sessionId),
    forget: (userId) => {
      anuncio.forget(userId);
      llamadas.forget(userId);
    },
    dispose: () => anuncio.dispose(),
  };
}
