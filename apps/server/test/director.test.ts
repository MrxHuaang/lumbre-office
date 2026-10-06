// El panel del director en la sala (VIR-175): sin el permiso no hace nada; con él prende festivales, fija el
// clima, mueve el reloj (y el huerto sigue con la estación nueva) y dispara momentos, y todo sale en el chat.
import type { ColyseusTestServer } from "@colyseus/testing";
import {
  DIRECTOR_MSG,
  FESTIVAL_MSG,
  MSG,
  ROOM_NAME,
  estacionDelDia,
  festivalCineId,
  gameTime,
  type ChatEvent,
  type DirectorAction,
  type DirectorResult,
  type FestivalCineEvent,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, until, type ServerRoom } from "./helpers";

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
  // Día 2 del juego (3 de primavera, sin festival) a las 8:00.
  OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 2 * 1440 + 8 * 60 };
  OfficeRoom.weatherInitial = "despejado";
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.gameClockInitial = null;
  OfficeRoom.weatherInitial = null;
});

interface Who {
  client: ClientRoom;
  results: DirectorResult[];
  chat: ChatEvent[];
  cines: string[];
}

async function join(room: ServerRoom, sub: string, name: string, role: "ADMIN" | "MEMBER" = "MEMBER"): Promise<Who> {
  const client = await colyseus.connectTo(room, { token: await token(sub, name, "ada", role) });
  const who: Who = { client, results: [], chat: [], cines: [] };
  client.onMessage(DIRECTOR_MSG.result, (r: DirectorResult) => who.results.push(r));
  client.onMessage(MSG.chatEvent, (e: ChatEvent) => who.chat.push(e));
  client.onMessage(FESTIVAL_MSG.cine, (e: FestivalCineEvent) => who.cines.push(e.id));
  await room.waitForNextPatch();
  return who;
}

async function act(who: Who, room: ServerRoom, action: DirectorAction): Promise<DirectorResult> {
  const n = who.results.length;
  who.client.send(DIRECTOR_MSG.action, action);
  await until(() => who.results.length > n, "la respuesta del director");
  await room.waitForNextPatch();
  return who.results.at(-1)!;
}

const clockOf = (room: ServerRoom) => gameTime({ anchorReal: room.state.clockAnchorReal, anchorMinute: room.state.clockAnchorMinute }, now);
const avisos = (w: Who) => w.chat.filter((e) => e.fromId === "" && e.scope === "global").map((e) => e.text);

describe("panel del director", () => {
  it("sin el permiso no cambia nada ni avisa", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const bob = await join(room, "u-bob", "Bob");
    const r = await act(bob, room, { kind: "festival", id: "carnaval" });
    expect(r).toMatchObject({ ok: false, error: "permiso" });
    expect(room.state.festival).toBe("");
    expect((await act(bob, room, { kind: "clima", weather: "tormenta" })).error).toBe("permiso");
    expect(room.state.weather).toBe("despejado");
    expect((await act(bob, room, { kind: "estacion", estacion: "invierno" })).error).toBe("permiso");
    expect(clockOf(room).day).toBe(2);
    expect(avisos(bob)).toEqual([]);
  });

  it("con el permiso prende un festival (con la fiesta abierta y su apertura) y avisa a todos", async () => {
    repo.permisos.set("u-eva", ["director"]);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const eva = await join(room, "u-eva", "Eva");
    const bob = await join(room, "u-bob", "Bob");
    const r = await act(eva, room, { kind: "festival", id: "feria-flores" });
    expect(r.ok).toBe(true);
    expect(room.state.festival).toBe("feria-flores");
    // Eran las 8:00: se llevó la hora a la fiesta.
    expect(room.state.festivalFase).toBe("fiesta");
    expect(clockOf(room)).toMatchObject({ day: 2, hour: 10 });
    await until(() => bob.cines.includes(festivalCineId("feria-flores", "apertura")), "la apertura");
    await until(() => avisos(bob).length > 0, "el aviso");
    expect(avisos(bob).at(-1)).toBe("Eva prendió Feria de las flores.");
    expect((await act(eva, room, { kind: "festival", id: null })).ok).toBe(true);
    expect(room.state.festival).toBe("");
  });

  it("la música del Carnaval suena para todos y para (sin permiso, nada)", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    const bob = await join(room, "u-bob", "Bob");
    const oidas: (string | null)[] = [];
    bob.client.onMessage(DIRECTOR_MSG.musica, (m: { pieza: string | null }) => oidas.push(m.pieza));
    expect((await act(bob, room, { kind: "musica", pieza: "son-vereda" })).error).toBe("permiso");
    expect((await act(ana, room, { kind: "musica", pieza: "son-vereda", nombre: "Son de la vereda" })).ok).toBe(true);
    await until(() => oidas.includes("son-vereda"), "la pieza para todos");
    await until(() => avisos(bob).includes("Ana puso a sonar Son de la vereda para todos."), "el aviso de la música");
    expect((await act(ana, room, { kind: "musica", pieza: null })).ok).toBe(true);
    await until(() => oidas.at(-1) === null, "que pare");
    expect(oidas).toEqual(["son-vereda", null]);
  });

  it("el clima se fija, la nieve solo en invierno y vuelve al natural", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    expect((await act(ana, room, { kind: "clima", weather: "lluvia", minutes: 30 })).ok).toBe(true);
    expect(room.state.weather).toBe("lluvia");
    expect(await act(ana, room, { kind: "clima", weather: "nieve" })).toMatchObject({ ok: false, error: "nieve" });
    expect(room.state.weather).toBe("lluvia");
    expect((await act(ana, room, { kind: "clima", weather: null })).ok).toBe(true);
    await until(() => avisos(ana).includes("Ana devolvió el clima a lo natural."), "el aviso del clima");
    expect(avisos(ana)).toContain("Ana cambió el clima a lluvia por 30 minutos.");
  });

  it("la hora, adelantar y saltar a la estación (el huerto sigue con la nueva)", async () => {
    repo.garden.set(0, { id: 0, crop: "cilantro", plantedBy: "u-ana", plantedByName: "Ana", plantedAt: Date.now(), growthMs: 0, growthAt: Date.now(), wateredUntil: 0 });
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    expect(room.state.garden.get("0")?.season).toBe("primavera");
    expect((await act(ana, room, { kind: "hora", minuteOfDay: 12 * 60 })).ok).toBe(true);
    expect(clockOf(room)).toMatchObject({ day: 2, hour: 12 });
    expect((await act(ana, room, { kind: "adelantar", minutes: 60 })).ok).toBe(true);
    expect(clockOf(room)).toMatchObject({ day: 2, hour: 13 });
    expect((await act(ana, room, { kind: "estacion", estacion: "invierno" })).ok).toBe(true);
    expect(estacionDelDia(clockOf(room).day)).toBe("invierno");
    expect(clockOf(room)).toMatchObject({ hour: 13 });
    expect(room.state.garden.get("0")?.season).toBe("invierno");
    // Se guardó (un reinicio no lo deshace) y ya no es otra vez invierno.
    expect(repo.gameClock).toMatchObject({ paused: true });
    expect((await act(ana, room, { kind: "estacion", estacion: "invierno" })).error).toBe("nada");
    // Ir al día de un festival: el de velitas (7 de invierno) a las 10:00.
    expect((await act(ana, room, { kind: "irFestival", id: "velitas" })).ok).toBe(true);
    expect(clockOf(room)).toMatchObject({ hour: 10 });
    expect(room.state.festival).toBe("velitas");
  });

  it("los momentos piden su festival: el desfile del Carnaval y repetir la apertura", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    expect(await act(ana, room, { kind: "momento", id: "carnaval-desfile" })).toMatchObject({ ok: false, error: "festival", festival: "carnaval" });
    expect((await act(ana, room, { kind: "momento", id: "no-existe" })).error).toBe("desconocido");
    await act(ana, room, { kind: "festival", id: "carnaval" });
    expect((await act(ana, room, { kind: "momento", id: "carnaval-desfile" })).ok).toBe(true);
    expect(room.state.carnaval.fase).toBe("desfile");
    expect((await act(ana, room, { kind: "momento", id: "carnaval-desfile" })).error).toBe("ocupado");
    const antes = ana.cines.filter((c) => c === festivalCineId("carnaval", "apertura")).length;
    expect((await act(ana, room, { kind: "momento", id: "apertura" })).ok).toBe(true);
    await until(() => ana.cines.filter((c) => c === festivalCineId("carnaval", "apertura")).length > antes, "la apertura otra vez");
  });

  it("los comandos del chat andan con el permiso (y sin él, son un mensaje cualquiera)", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const bob = await join(room, "u-bob", "Bob");
    bob.client.send(MSG.chatSend, { text: "/festival carnaval", scope: "global" });
    await tick(80);
    expect(room.state.festival).toBe("");
    const ana = await join(room, "u-ana", "Ana", "ADMIN");
    ana.client.send(MSG.chatSend, { text: "/festival carnaval", scope: "global" });
    await until(() => room.state.festival === "carnaval", "el Carnaval prendido");
    ana.client.send(MSG.chatSend, { text: "/desfile", scope: "global" });
    await until(() => room.state.carnaval.fase === "desfile", "el desfile");
    ana.client.send(MSG.chatSend, { text: "/clima tormenta", scope: "global" });
    await until(() => room.state.weather === "tormenta", "la tormenta");
  });

  it("/time también lo puede cambiar quien tiene el permiso del director", async () => {
    repo.permisos.set("u-eva", ["director"]);
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const eva = await join(room, "u-eva", "Eva");
    eva.client.send(MSG.chatSend, { text: "/time set noche", scope: "proximity" });
    await until(() => clockOf(room).hour === 20, "la hora nueva");
  });
});
