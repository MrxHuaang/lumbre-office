import type { ColyseusTestServer } from "@colyseus/testing";
import { CLOSE_CODE, MSG, ROOM_NAME, signGameToken, type ChatEvent, type MoveCorrection } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, c, goToArea, intoOffice, SECRET, tick, TILE, token, toOfficeDoor, walkTo, walkToTile } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;

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
});

async function setup() {
  const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  return { room, alice, bob };
}

function collectChat(client: { onMessage: (t: string, cb: (m: ChatEvent) => void) => void }) {
  const got: ChatEvent[] = [];
  client.onMessage(MSG.chatEvent, (m) => got.push(m));
  return got;
}

describe("OfficeRoom: ingreso y sesiones", () => {
  it("rechaza ingresos sin token o con token inválido", async () => {
    const room = await colyseus.createRoom(ROOM_NAME, {});
    await expect(colyseus.connectTo(room, { name: "Alice", avatar: "ada" })).rejects.toThrow();
    await expect(colyseus.connectTo(room, { token: "no-es-un-jwt" })).rejects.toThrow();
    const forged = await signGameToken(
      { sub: "u-x", name: "X", avatar: "ada", role: "ADMIN" },
      "otro-secreto-otro-secreto-otro-secreto",
    );
    await expect(colyseus.connectTo(room, { token: forged })).rejects.toThrow();
  });

  it("crea el jugador en el jardín, frente a la cabaña", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    expect(p.name).toBe("Alice");
    expect(p.userId).toBe("u-alice");
    expect(p.area).toBe("jardin");
    expect(p.zoneId).toBe("jardin");
    expect(room.state.players.size).toBe(2);
  });

  it("una misma persona en otra pestaña reemplaza su sesión anterior", async () => {
    const { room, alice } = await setup();
    const codes: number[] = [];
    alice.onLeave((code) => codes.push(code));
    const alice2 = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await tick();
    expect(codes).toEqual([CLOSE_CODE.replaced]);
    const alices = [...room.state.players.values()].filter((p) => p.userId === "u-alice");
    expect(alices).toHaveLength(1);
    expect(room.state.players.has(alice2.sessionId)).toBe(true);
  });

  it("al recargar la página no queda un avatar duplicado esperando reconexión", async () => {
    const { room, alice } = await setup();
    await alice.leave(false); // cierre sin consentimiento (recarga)
    await tick();
    expect([...room.state.players.values()].filter((p) => p.userId === "u-alice")).toHaveLength(1);

    const alice2 = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    await room.waitForNextPatch();
    await tick();
    const alices = [...room.state.players.entries()].filter(([, p]) => p.userId === "u-alice");
    expect(alices.map(([id]) => id)).toEqual([alice2.sessionId]);
  });
});

describe("OfficeRoom: movimiento", () => {
  it("acepta movimientos válidos", async () => {
    const { room, alice } = await setup();
    const p = room.state.players.get(alice.sessionId)!;
    const startX = p.x;
    await walkTo(alice, room, p.x + 40, p.y);
    expect(room.state.players.get(alice.sessionId)!.x).toBeCloseTo(startX + 40, 0);
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("jardin");
  });

  it("publica el lugar de cada jugador, incluida la entrada de una oficina", async () => {
    const { room, alice } = await setup();
    const me = () => room.state.players.get(alice.sessionId)!;
    expect(me().place).toBe("jardin");
    await toOfficeDoor(alice, room, "office-4");
    expect(me().area).toBe("piso-2");
    expect(me().place).toBe("door:office-4");
    expect(me().zoneId).toBe("pasillo"); // el umbral no aísla el audio
    await intoOffice(alice, room, "office-4");
    expect(me().place).toBe("office-4");
  });

  it("corrige teletransportes, movimientos dentro de muebles y atravesar paredes", async () => {
    const { room, alice } = await setup();
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    const before = { ...room.state.players.get(alice.sessionId)!.toJSON() };

    alice.send(MSG.move, { x: before.x + 500, y: before.y, dir: "right", moving: true });
    alice.send(MSG.move, { x: c(10), y: c(5), dir: "left", moving: true }); // dentro de la cabaña
    await room.waitForNextPatch();
    await tick();
    expect(corrections.length).toBe(2);
    expect(room.state.players.get(alice.sessionId)!.x).toBe(before.x);

    // En el piso 2: del pasillo (y = 11) a la oficina 1 (y = 10) de un salto a través de la pared.
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 10, 11);
    alice.send(MSG.move, { x: c(10), y: c(10), dir: "up", moving: true });
    await room.waitForNextPatch();
    await tick();
    expect(room.state.players.get(alice.sessionId)!.y).toBe(c(11));
  });
});

describe("OfficeRoom: niveles", () => {
  it("usar la puerta de la cabaña lleva a la planta baja y avisa al cliente", async () => {
    const { room, alice } = await setup();
    const corrections: MoveCorrection[] = [];
    alice.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));
    await goToArea(alice, room, "planta-baja");
    const p = room.state.players.get(alice.sessionId)!;
    expect(p.area).toBe("planta-baja");
    expect(p.zoneId).toBe("recibidor");
    expect(corrections.at(-1)).toEqual({ x: p.x, y: p.y, area: "planta-baja" });
  });

  it("no se puede usar un portal desde lejos ni uno de otro nivel", async () => {
    const { room, alice } = await setup();
    alice.send(MSG.travel, { portal: "jardin-casa" }); // el spawn queda a varios tiles de la puerta
    alice.send(MSG.travel, { portal: "piso-2-escalera" });
    await room.waitForNextPatch();
    await tick();
    expect(room.state.players.get(alice.sessionId)!.area).toBe("jardin");
  });

  it("no se oye a quien está en otro nivel, aunque las coordenadas coincidan", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    await goToArea(alice, room, "planta-baja");
    alice.send(MSG.chatSend, { text: "¿hay alguien afuera?", scope: "proximity" });
    alice.send(MSG.chatSend, { text: "para todos", scope: "global" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot.map((m) => m.text)).toEqual(["para todos"]);
  });
});

describe("OfficeRoom: chat y estado", () => {
  it("el chat global llega a todos y se persiste", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    alice.send(MSG.chatSend, { text: "hola a todos", scope: "global" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot.map((m) => m.text)).toEqual(["hola a todos"]);
    expect(repo.chat.map((m) => m.text)).toEqual(["hola a todos"]);
  });

  it("una sala nueva carga el historial global guardado", async () => {
    repo.chat.push({ id: "m1", fromId: "user:u-x", fromName: "X", text: "de ayer", scope: "global", zoneId: null, ts: 1 });
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
    const history = await new Promise<ChatEvent[]>((resolve) => alice.onMessage(MSG.chatHistory, resolve));
    expect(history.map((m) => m.text)).toEqual(["de ayer"]);
  });

  it("el chat de proximidad solo llega a quien está cerca", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    alice.send(MSG.chatSend, { text: "cerca", scope: "proximity" });
    await room.waitForNextPatch();

    await walkToTile(alice, room, 22, 20);
    alice.send(MSG.chatSend, { text: "lejos", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();

    expect(bobGot.map((m) => m.text)).toEqual(["cerca"]);
    expect(repo.chat).toHaveLength(0); // la proximidad no se persiste
  });

  it("el chat de proximidad no atraviesa la pared de una oficina", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);

    await intoOffice(alice, room, "office-4");
    await toOfficeDoor(bob, room, "office-4");
    expect(room.state.players.get(alice.sessionId)!.zoneId).toBe("office-4");

    alice.send(MSG.chatSend, { text: "reunión privada", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot).toHaveLength(0);
  });

  it("dentro de una sala se oye a todos aunque estén lejos (sin proximidad)", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    // Esquinas opuestas de la sala de reuniones (piso 2): ~12 tiles de distancia (> radio de 5 tiles).
    await goToArea(alice, room, "piso-2");
    await walkToTile(alice, room, 19, 1);
    await goToArea(bob, room, "piso-2");
    await walkToTile(bob, room, 28, 9);
    const a = room.state.players.get(alice.sessionId)!;
    const b = room.state.players.get(bob.sessionId)!;
    expect([a.zoneId, b.zoneId]).toEqual(["meeting-main", "meeting-main"]);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5 * TILE);

    alice.send(MSG.chatSend, { text: "¿me oyes desde allá?", scope: "proximity" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot.map((m) => m.text)).toEqual(["¿me oyes desde allá?"]);
  });

  it("limita la tasa de mensajes de chat", async () => {
    const { room, alice, bob } = await setup();
    const bobGot = collectChat(bob);
    for (let i = 0; i < 8; i++) alice.send(MSG.chatSend, { text: `m${i}`, scope: "global" });
    await room.waitForNextPatch();
    await tick();
    expect(bobGot).toHaveLength(5);
  });

  it("el estado de presencia se guarda y se restaura al volver", async () => {
    const { room, bob } = await setup();
    bob.send(MSG.status, { status: "busy" });
    await room.waitForNextPatch();
    await tick();
    expect(repo.statuses.get("u-bob")).toBe("busy");

    await bob.leave(true);
    const bob2 = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
    await room.waitForNextPatch();
    expect(room.state.players.get(bob2.sessionId)!.status).toBe("busy");
  });
});

describe("OfficeRoom: sentarse", () => {
  // Silla oeste de la mesa 1 de la cafetería (13, 5): mira hacia la mesa (+x). Detrás está la pared del
  // salón; se llega por la esquina de la burbuja (13, 4).
  const seat = { x: c(13), y: c(5) };
  const toSeat = async (client: Parameters<typeof walkToTile>[0], room: Parameters<typeof walkToTile>[1]) => {
    await goToArea(client, room, "planta-baja");
    await walkToTile(client, room, 13, 4);
  };

  it("se sienta en una silla cercana y queda mirando hacia la mesa", async () => {
    const { room, alice } = await setup();
    await toSeat(alice, room);
    alice.send(MSG.move, { ...seat, dir: "down", moving: false, seated: true });
    await room.waitForNextPatch();
    await tick();
    const p = room.state.players.get(alice.sessionId)!;
    expect(p.seated).toBe(true);
    expect(p.dir).toBe("right");
    expect([p.x, p.y]).toEqual([seat.x, seat.y]);
    expect(p.zoneId).toBe("mesa-1");
  });

  it("no deja sentarse en un asiento ocupado ni desde lejos", async () => {
    const { room, alice, bob } = await setup();
    const corrections: MoveCorrection[] = [];
    bob.onMessage(MSG.moveCorrection, (m: MoveCorrection) => corrections.push(m));

    await goToArea(bob, room, "planta-baja");
    corrections.length = 0;
    bob.send(MSG.move, { ...seat, dir: "right", moving: false, seated: true }); // desde el recibidor
    await room.waitForNextPatch();
    await tick();
    expect(room.state.players.get(bob.sessionId)!.seated).toBe(false);

    await toSeat(alice, room);
    alice.send(MSG.move, { ...seat, dir: "right", moving: false, seated: true });
    await walkToTile(bob, room, 13, 6);
    bob.send(MSG.move, { ...seat, dir: "right", moving: false, seated: true });
    await room.waitForNextPatch();
    await tick();
    expect(room.state.players.get(alice.sessionId)!.seated).toBe(true);
    expect(room.state.players.get(bob.sessionId)!.seated).toBe(false);
    expect(corrections.length).toBe(2);
  });

  it("se sienta en el sofá y se levanta en el tile libre de al lado", async () => {
    const { room, alice } = await setup();
    const me = () => room.state.players.get(alice.sessionId)!;
    // Sofá de los probadores (39, 17..18) mirando hacia la izquierda; detrás está la pared y al lado queda (39, 16).
    await goToArea(alice, room, "planta-baja");
    await walkToTile(alice, room, 39, 16);
    alice.send(MSG.move, { x: c(39), y: c(17), dir: "down", moving: false, seated: true });
    await room.waitForNextPatch();
    await tick();
    expect(me().seated).toBe(true);
    expect(me().dir).toBe("left");

    alice.send(MSG.move, { x: c(39), y: c(16), dir: "down", moving: false, seated: false });
    await room.waitForNextPatch();
    await tick();
    expect(me().seated).toBe(false);
    expect(me().y).toBe(c(16));
  });

  it("no se puede usar un portal estando sentado", async () => {
    const { room, alice } = await setup();
    await goToArea(alice, room, "planta-baja");
    await walkToTile(alice, room, 39, 16);
    alice.send(MSG.move, { x: c(39), y: c(17), dir: "up", moving: false, seated: true });
    alice.send(MSG.travel, { portal: "planta-baja-salida" });
    await room.waitForNextPatch();
    await tick();
    expect(room.state.players.get(alice.sessionId)!.area).toBe("planta-baja");
  });
});

describe("OfficeRoom: personaje", () => {
  const look = {
    skin: "#e0ac69",
    hair: "#0d0d0d",
    shirt: "#ff48b0",
    pants: "#1f2a44",
    accent: "#0078bf",
    hairStyle: "curly" as const,
    accessories: ["glasses" as const, "cap" as const],
  };

  it("entra con el personaje personalizado del token", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const t = await signGameToken({ sub: "u-lu", name: "Lu", avatar: "eva", look, role: "MEMBER" }, SECRET);
    const lu = await colyseus.connectTo(room, { token: t });
    await room.waitForNextPatch();
    const p = room.state.players.get(lu.sessionId)!;
    expect(p.avatar).toBe("eva");
    expect(JSON.parse(p.look)).toEqual(look);
  });

  it("al guardar el perfil en la web, la sala refleja el nombre y el personaje guardados", async () => {
    const { room, alice, bob } = await setup();
    const me = () => room.state.players.get(alice.sessionId)!;
    expect(me().look).toBe("");

    repo.profiles.set("u-alice", { name: "Alicia", avatar: "carla", look });
    alice.send(MSG.profileChanged);
    await room.waitForNextPatch();
    await tick();
    expect(me().name).toBe("Alicia");
    expect(me().avatar).toBe("carla");
    expect(JSON.parse(me().look).hairStyle).toBe("curly");

    repo.profiles.set("u-alice", { name: "Alicia", avatar: "dario", look: null });
    alice.send(MSG.profileChanged);
    await room.waitForNextPatch();
    await tick();
    expect(me().avatar).toBe("dario");
    expect(me().look).toBe("");
    // Solo cambia quien avisó.
    expect(room.state.players.get(bob.sessionId)!.name).toBe("Bob");
  });
});
