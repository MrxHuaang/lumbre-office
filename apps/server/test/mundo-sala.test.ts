// Mundo lleno en la sala: el dispensador de agua del piso 2 (a la mochila), el tragamonedas del sótano (con
// el casino abierto y cerrado), los telescopios de adorno de noche y la impresora con tus notas.
import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld } from "@hyvento/map";
import { MSG, MUNDO_MSG, OBS_MSG, ROOM_NAME, SLOTS_MSG, stepsTo, type MundoNotice, type SkyEvent, type SlotResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { MUNDO_CLOCK } from "../src/rooms/mundo";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bagOf, bootServer, goToArea, tick, token, until, walkToTile, type ServerRoom } from "./helpers";

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let now = 1_000_000;
const world = getWorld();

/** Un tile libre pegado a un mueble de ese tipo en el nivel, sin pared de por medio (para usarlo). */
function besideOf(area: string, type: string) {
  const map = world.areas.get(area)!;
  const f = map.furniture.find((x) => x.type === type)!;
  const around = [
    [f.x + f.w, f.y],
    [f.x, f.y + f.d],
    [f.x - 1, f.y],
    [f.x, f.y - 1],
  ] as const;
  for (const [x, y] of around)
    if (x >= 0 && y >= 0 && x < map.width && y < map.height && !map.blocked[y * map.width + x] && stepsTo(map, x, y, f, 1) <= 1) return { f, x, y };
  throw new Error(`Sin lugar junto a ${type}`);
}

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
  OfficeRoom.observatorioNow = () => now;
  MUNDO_CLOCK.random = () => 99;
  OfficeRoom.gameClockInitial = { anchorReal: now, anchorMinute: 1440 + 12 * 60 };
});
afterEach(() => {
  OfficeRoom.gameClockNow = () => Date.now();
  OfficeRoom.observatorioNow = () => Date.now();
  MUNDO_CLOCK.random = (n: number) => Math.floor(Math.random() * n);
  OfficeRoom.gameClockInitial = null;
});

async function join(room: ServerRoom, id: string) {
  const client = await colyseus.connectTo(room, { token: await token(id, id) });
  const notices: MundoNotice[] = [];
  const slots: SlotResult[] = [];
  const sky: SkyEvent[] = [];
  client.onMessage(MUNDO_MSG.notice, (n: MundoNotice) => notices.push(n));
  client.onMessage(SLOTS_MSG.result, (r: SlotResult) => slots.push(r));
  client.onMessage(OBS_MSG.sky, (e: SkyEvent) => sky.push(e));
  client.onMessage("*", () => {});
  await room.waitForNextPatch();
  return { client, notices, slots, sky };
}

const use = (client: ClientRoom, f: { type: string; x: number; y: number }) => client.send(MSG.furnitureUse, { type: f.type, x: f.x, y: f.y });

describe("mundo lleno en la sala", () => {
  it("el dispensador de agua del piso 2 deja un vaso de agua en la mochila", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const { client } = await join(room, "ana");
    await goToArea(client, room, "piso-2");
    const spot = besideOf("piso-2", "water-cooler");
    await walkToTile(client, room, spot.x, spot.y);
    use(client, spot.f);
    await until(() => bagOf(room).count("ana", "obj:vaso-agua") === 1, "el vaso de agua");
    expect(room.state.players.get(client.sessionId)!.held).toBe("vaso-agua");
  });

  it("el tragamonedas cobra y paga junto a la máquina; con el casino cerrado, no se juega", async () => {
    repo.ledger.push({ userId: "ana", amount: 50, reason: "ADMIN", at: 0 });
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const { client, slots } = await join(room, "ana");
    // Lejos de la máquina: no.
    client.send(SLOTS_MSG.spin, { bet: 1 });
    await until(() => slots.length === 1, "la respuesta lejos");
    expect(slots[0]).toEqual({ ok: false, error: "far" });
    await goToArea(client, room, "sotano");
    const spot = besideOf("sotano", "slot-machine");
    await walkToTile(client, room, spot.x, spot.y);
    // Con el azar en 99 salen tres sietes.
    client.send(SLOTS_MSG.spin, { bet: 1 });
    await until(() => slots.length === 2, "la tirada");
    expect(slots[1]).toMatchObject({ ok: true, reels: ["siete", "siete", "siete"], won: 250 });
    expect(await repo.getPoints("ana")).toBe(50 - 1 + 250);
    await until(() => room.state.players.get(client.sessionId)!.points === 299, "el saldo nuevo");
    repo.casinoSettings = { enabled: false };
    await OfficeRoom.reloadCasinoSettingsEverywhere();
    await tick(1300);
    client.send(SLOTS_MSG.spin, { bet: 1 });
    await until(() => slots.length === 3, "la tirada cerrada");
    expect(slots[2]).toEqual({ ok: false, error: "disabled" });
  });

  it("los telescopios de adorno: de noche se ve el cielo; de día, vuelve de noche", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const { client, sky } = await join(room, "ana");
    await goToArea(client, room, "piso-3");
    const spot = besideOf("piso-3", "telescope");
    await walkToTile(client, room, spot.x, spot.y);
    client.send(OBS_MSG.telescopeLook);
    await until(() => sky.length === 1, "el cielo de día");
    expect(sky[0]).toMatchObject({ kind: "sky", night: false });
    now += 9 * 150_000; // las 21:00 del juego
    client.send(OBS_MSG.telescopeLook);
    await until(() => sky.length === 2, "el cielo de noche");
    expect(sky[1]).toMatchObject({ kind: "sky", night: true });
  });

  it("la impresora imprime tu nota más reciente (y sin notas, avisa)", async () => {
    const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
    const { client, notices } = await join(room, "ana");
    await goToArea(client, room, "piso-2");
    // La de la sala de cabinas (las de las oficinas están adentro de ellas).
    const map = world.areas.get("piso-2")!;
    const printer = map.furniture.find((f) => f.type === "printer" && f.x === 0)!;
    await walkToTile(client, room, 1, printer.y);
    use(client, printer);
    await until(() => notices.length === 1, "el aviso sin notas");
    expect(notices[0]).toEqual({ code: "noNote" });
    repo.notes.set("ana", ["Ideas para la cabaña"]);
    await tick(3_100);
    use(client, printer);
    await until(() => notices.length === 2, "la hoja");
    expect(notices[1]).toEqual({ code: "printed", text: "Ideas para la cabaña" });
    await until(() => bagOf(room).count("ana", "obj:hoja") === 1, "la hoja en la mochila");
  });
});
