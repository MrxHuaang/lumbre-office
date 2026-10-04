import type { ColyseusTestServer } from "@colyseus/testing";
import { CASA_CONEXIONES } from "@hyvento/map";
import { CASA_PROPIA, CASA_PROPIA_MSG, casaAreaOf, MSG, ROOM_NAME, STAT_PREFIX, VIAJE_MSG, type CasaPropiaNotice, type ViajeNotice } from "@hyvento/shared";
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
  // A la casa todavía no se llega en bus (VIR-142): los tests entran con "/ir casa".
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
/** Los niveles de casa armados en la sala (privado: solo para mirar que se suelten). */
const casasOf = (room: ServerRoom) => (room as unknown as { casas: CasasPropias }).casas;

async function say(client: ClientRoom, room: ServerRoom, text: string) {
  client.send(MSG.chatSend, { text, scope: "proximity" });
  await tick(40);
  await room.waitForNextPatch();
}

async function home(client: ClientRoom, room: ServerRoom, userId: string) {
  await say(client, room, "/ir casa");
  await until(() => player(room, client).area === casaAreaOf(userId), "llegar a la casa");
}

describe("casa de cada persona", () => {
  it("cada quien tiene la suya, se recorre de afuera hasta arriba por los portales y se vuelve a salir", { timeout: 40000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    await home(beto, room, "u-beto");
    // Cada uno en su nivel: la proximidad (y el video) no los junta.
    expect(player(room, ana).area).toBe("casa:u-ana");
    expect(player(room, beto).area).toBe("casa:u-beto");

    await goToArea(ana, room, casaAreaOf("u-ana", "abajo"));
    expect(player(room, ana).zoneId).toBe("casa:u-ana:abajo:recibidor");
    await goToArea(ana, room, casaAreaOf("u-ana", "arriba"));
    expect(player(room, ana).area).toBe("casa:u-ana:arriba");
    await goToArea(ana, room, casaAreaOf("u-ana"));
    expect(player(room, ana).area).toBe("casa:u-ana");
    expect(casasOf(room).size).toBeGreaterThanOrEqual(2);
  });

  it("nadie entra a la casa de otro: el servidor lo rechaza con un aviso y queda donde estaba", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(beto, room, "u-beto");

    const before = player(room, ana).area;
    const notices: CasaPropiaNotice[] = [];
    ana.onMessage(CASA_PROPIA_MSG.notice, (n: CasaPropiaNotice) => notices.push(n));
    for (const target of ["casa:u-beto", "casa:u-beto:abajo", "casa:u-beto:arriba"]) await say(ana, room, `/ir ${target}`);
    await until(() => notices.length >= 3, "los avisos de casa ajena");
    expect(notices.every((n) => n.code === "ajena")).toBe(true);
    expect(player(room, ana).area).toBe(before);
  });

  it("el viaje rápido junto a alguien que está en su casa no mete a nadie adentro", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(beto, room, "u-beto");

    const before = player(room, ana).area;
    const notices: ViajeNotice[] = [];
    ana.onMessage(VIAJE_MSG.notice, (n: ViajeNotice) => notices.push(n));
    ana.send(VIAJE_MSG.go, { kind: "person", userId: "u-beto" });
    await until(() => notices.length > 0, "el aviso del viaje");
    expect(notices[0]!.code).toBe("casaAjena");
    expect(player(room, ana).area).toBe(before);
  });

  it("las casas vacías se sueltan de la memoria y todas cuentan como un solo nivel para los logros", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    await goToArea(ana, room, casaAreaOf("u-ana", "abajo"));
    await say(ana, room, "/ir jardin");
    await until(() => player(room, ana).area === "jardin", "volver al jardín");
    // Ana ya salió: al armar la de Beto se sueltan los niveles de la suya.
    await home(beto, room, "u-beto");
    expect(casasOf(room).size).toBe(1);

    const stats = (room as unknown as { achievements: { snapshot(id: string): { stats: Record<string, number> } | undefined } }).achievements;
    const anaStats = stats.snapshot("u-ana")!.stats;
    expect(anaStats[`${STAT_PREFIX.visit}${CASA_PROPIA.statArea}`]).toBe(1);
    expect(Object.keys(anaStats).some((k) => k.startsWith(`${STAT_PREFIX.visit}casa:`))).toBe(false);
  });
});

describe("CasasPropias", () => {
  it("arma los pisos al pedirlos, no arma lo que no es una casa y suelta los que quedan vacíos", () => {
    let areas = ["casa:u-ana", "casa:u-ana:arriba"];
    const casas = new CasasPropias(() => areas);
    expect(casas.get("casa:u-ana")?.id).toBe("casa:u-ana");
    expect(casas.get("casa:u-ana:arriba")?.id).toBe("casa:u-ana:arriba");
    expect(casas.get("jardin")).toBeUndefined();
    expect(casas.get("casa:u-ana:sotano")).toBeUndefined();
    expect(casas.size).toBe(2);
    // Ana salió y entra Beto: los de Ana se sueltan.
    areas = ["jardin", "casa:u-beto"];
    casas.get("casa:u-beto");
    expect(casas.size).toBe(1);
    areas = [];
    casas.sweep();
    expect(casas.size).toBe(0);
  });

  it("solo el dueño entra, y la llegada del bus está en la vereda", () => {
    const casas = new CasasPropias(() => []);
    expect(casas.canEnter("casa:u-ana:abajo", "u-ana")).toBeNull();
    expect(casas.canEnter("casa:u-ana:abajo", "u-beto")).toBe("ajena");
    expect(casas.canEnter("jardin", "u-beto")).toBeNull();
    const map = casas.get("casa:u-ana")!;
    const { x, y } = CASA_CONEXIONES.afuera.parada.llegada;
    expect(map.blocked[y * map.width + x]).toBe(0);
  });
});
