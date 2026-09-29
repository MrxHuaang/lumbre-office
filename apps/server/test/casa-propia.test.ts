import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld } from "@hyvento/map";
import { CASA_PROPIA, CASA_PROPIA_MSG, casaAreaOf, MSG, ROOM_NAME, STAT_PREFIX, type CasaPropiaNotice } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { CasasPropias } from "../src/rooms/casaPropia";
import type { OfficeState } from "../src/state";
import { bootServer, goToArea, tick, token, until, type ServerRoom } from "./helpers";

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
  // Al barrio todavía no se llega en bus (VIR-142): los tests saltan con "/ir barrio".
  process.env.HYVENTO_DEV_TOOLS = "1";
});
afterEach(() => {
  delete process.env.HYVENTO_DEV_TOOLS;
});

async function setup(names: string[]) {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const clients: ClientRoom[] = [];
  for (const name of names) clients.push(await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) }));
  await room.waitForNextPatch();
  return { room, clients };
}

const player = (room: ServerRoom, client: ClientRoom) => room.state.players.get(client.sessionId)!;
/** Las casas armadas en la sala (privado: solo para mirar que se suelten). */
const casasOf = (room: ServerRoom) => (room as unknown as { casas: CasasPropias }).casas;

async function say(client: ClientRoom, room: ServerRoom, text: string) {
  client.send(MSG.chatSend, { text, scope: "proximity" });
  await tick(40);
  await room.waitForNextPatch();
}

async function toBarrio(client: ClientRoom, room: ServerRoom) {
  await say(client, room, `/ir ${CASA_PROPIA.street}`);
  await until(() => player(room, client).area === CASA_PROPIA.street, "llegar al barrio");
}

describe("casa de cada persona", () => {
  it("la misma puerta del barrio lleva a cada quien a su casa, y se sale a la calle", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await toBarrio(ana, room);
    await toBarrio(beto, room);

    await goToArea(ana, room, casaAreaOf("u-ana"));
    await goToArea(beto, room, casaAreaOf("u-beto"));
    expect(player(room, ana)).toMatchObject({ area: "casa:u-ana", zoneId: "casa:u-ana" });
    expect(player(room, beto)).toMatchObject({ area: "casa:u-beto", zoneId: "casa:u-beto" });
    // Cada uno en su nivel: la proximidad (y el video) no los junta.
    expect(player(room, ana).area).not.toBe(player(room, beto).area);
    expect(casasOf(room).size).toBe(2);

    await goToArea(ana, room, CASA_PROPIA.street);
    const puerta = getWorld().areas.get(CASA_PROPIA.street)!.portals[0]!;
    expect(player(room, ana).area).toBe(CASA_PROPIA.street);
    // Llega frente a su puerta, un paso más abajo.
    expect(Math.floor(player(room, ana).y / 32)).toBe(puerta.tiles[0]!.y + 1);
  });

  it("nadie entra a la casa de otro: el servidor lo rechaza con un aviso y queda donde estaba", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await toBarrio(beto, room);
    await goToArea(beto, room, casaAreaOf("u-beto"));

    await toBarrio(ana, room);
    const notices: CasaPropiaNotice[] = [];
    ana.onMessage(CASA_PROPIA_MSG.notice, (n: CasaPropiaNotice) => notices.push(n));
    await say(ana, room, "/ir casa:u-beto");
    await until(() => notices.length > 0, "el aviso de casa ajena");
    expect(notices).toEqual([{ code: "ajena" }]);
    expect(player(room, ana).area).toBe(CASA_PROPIA.street);
    // A la suya sí.
    await say(ana, room, "/ir casa");
    await until(() => player(room, ana).area === "casa:u-ana", "entrar a la suya");
  });

  it("las casas vacías se sueltan de la memoria y todas cuentan como un solo nivel para los logros", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await toBarrio(ana, room);
    await goToArea(ana, room, casaAreaOf("u-ana"));
    await goToArea(ana, room, CASA_PROPIA.street);
    // Ana ya salió: al armar la de Beto se suelta la suya.
    await toBarrio(beto, room);
    await goToArea(beto, room, casaAreaOf("u-beto"));
    expect(casasOf(room).size).toBe(1);

    const stats = (room as unknown as { achievements: { snapshot(id: string): { stats: Record<string, number> } | undefined } }).achievements;
    const anaStats = stats.snapshot("u-ana")!.stats;
    expect(anaStats[`${STAT_PREFIX.visit}${CASA_PROPIA.statArea}`]).toBe(1);
    expect(Object.keys(anaStats).some((k) => k.startsWith(`${STAT_PREFIX.visit}casa:`))).toBe(false);
  });
});

describe("CasasPropias", () => {
  it("arma las casas al pedirlas, no arma lo que no es una casa y suelta las que quedan vacías", () => {
    let areas = ["casa:u-ana"];
    const casas = new CasasPropias(() => areas);
    expect(casas.get("casa:u-ana")?.id).toBe("casa:u-ana");
    expect(casas.get("jardin")).toBeUndefined();
    expect(casas.get(CASA_PROPIA.own)).toBeUndefined();
    expect(casas.size).toBe(1);
    // Ana salió y entra Beto: la de Ana se suelta.
    areas = ["barrio", "casa:u-beto"];
    casas.get("casa:u-beto");
    expect(casas.size).toBe(1);
    areas = [];
    casas.sweep();
    expect(casas.size).toBe(0);
  });

  it("solo el dueño entra", () => {
    const casas = new CasasPropias(() => []);
    expect(casas.canEnter("casa:u-ana", "u-ana")).toBeNull();
    expect(casas.canEnter("casa:u-ana", "u-beto")).toBe("ajena");
    expect(casas.canEnter("jardin", "u-beto")).toBeNull();
  });
});
