import type { ColyseusTestServer } from "@colyseus/testing";
import { CASA_CONEXIONES } from "@hyvento/map";
import { CASA_FIESTA_MSG, CASA_PROPIA, CASA_PROPIA_MSG, type ChatEvent, casaAreaOf, MSG, ROOM_NAME, STAT_PREFIX, VIAJE_MSG, type CasaPropiaNotice, type Invitation, type KnockRequest, type KnockResult, type ViajeNotice } from "@hyvento/shared";
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

describe("visitas a la casa", () => {
  it("invitar desde la propia casa deja pasar y lleva hasta allá; al salir se pierde el pase", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    const invites: Invitation[] = [];
    beto.onMessage(MSG.inviteRequest, (inv: Invitation) => invites.push(inv));
    ana.send(MSG.invite, { toUserId: "u-beto" });
    await until(() => invites.length > 0, "la invitación");
    expect(invites[0]!.place).toBe("casa");
    beto.send(MSG.inviteRespond, { inviteId: invites[0]!.inviteId, accept: true });
    await until(() => player(room, beto).area === "casa:u-ana", "llegar a la casa de Ana");
    // Adentro puede recorrerla como el dueño.
    await goToArea(beto, room, casaAreaOf("u-ana", "abajo"));
    expect(player(room, beto).area).toBe("casa:u-ana:abajo");
    // Se va: ya no puede volver sin otra invitación.
    await say(beto, room, "/ir jardin");
    await until(() => player(room, beto).area === "jardin", "volver al jardín");
    expect(room.state.casas.get("u-ana")!.guests.length).toBe(0);
    const notices: CasaPropiaNotice[] = [];
    beto.onMessage(CASA_PROPIA_MSG.notice, (n: CasaPropiaNotice) => notices.push(n));
    await say(beto, room, "/ir casa:u-ana");
    await until(() => notices.length > 0, "el rechazo");
    expect(notices[0]!.code).toBe("ajena");
  });

  it("el timbre: si el dueño abre, entra; cerrada, ni suena", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    const rings: KnockRequest[] = [];
    const results: KnockResult[] = [];
    ana.onMessage(MSG.knockRequest, (r: KnockRequest) => rings.push(r));
    beto.onMessage(MSG.knockResult, (r: KnockResult) => results.push(r));
    beto.send(MSG.knock, { zoneId: casaAreaOf("u-ana") });
    await until(() => rings.length > 0, "el timbre");
    ana.send(MSG.knockRespond, { requestId: rings[0]!.requestId, accept: true });
    await until(() => player(room, beto).area === "casa:u-ana", "entrar");
    expect(results.at(-1)!.outcome).toBe("accepted");
    // La cierra: la visita se va a la estación y el timbre ya no suena.
    const notices: CasaPropiaNotice[] = [];
    beto.onMessage(CASA_PROPIA_MSG.notice, (n: CasaPropiaNotice) => notices.push(n));
    ana.send(CASA_PROPIA_MSG.modo, { modo: "cerrada" });
    await until(() => player(room, beto).area === "jardin", "salir");
    await until(() => notices.length > 0, "el aviso");
    expect(notices[0]).toMatchObject({ code: "cerro", name: "Ana" });
    beto.send(MSG.knock, { zoneId: casaAreaOf("u-ana") });
    await until(() => results.length >= 2, "la respuesta");
    expect(results.at(-1)!.outcome).toBe("declined");
    expect(rings.length).toBe(1);
  });

  it("abierta entra cualquiera; el dueño puede pedirle a alguien que se vaya", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    ana.send(CASA_PROPIA_MSG.modo, { modo: "abierta" });
    await until(() => room.state.casas.get("u-ana")?.modo === "abierta", "abrirla");
    await say(beto, room, "/ir casa:u-ana:abajo");
    await until(() => player(room, beto).area === "casa:u-ana:abajo", "entrar");
    ana.send(CASA_PROPIA_MSG.kick, { userId: "u-beto" });
    await until(() => player(room, beto).area === "jardin", "salir");
  });
});

describe("fiestas en la casa", () => {
  it("el modo fiesta abre la casa, avisa en el chat global y al apagarla vuelve al modo de antes", { timeout: 30000 }, async () => {
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    const chat: ChatEvent[] = [];
    beto.onMessage(MSG.chatEvent, (e: ChatEvent) => chat.push(e));
    ana.send(CASA_FIESTA_MSG.fiesta, { on: true });
    await until(() => room.state.casas.get("u-ana")?.fiesta === true, "la fiesta");
    expect(room.state.casas.get("u-ana")!.modo).toBe("abierta");
    await until(() => chat.some((e) => e.scope === "global" && e.fromId === "" && e.text.includes("Ana")), "el aviso");
    // Abierta: Beto entra sin invitación.
    await say(beto, room, "/ir casa:u-ana:abajo");
    await until(() => player(room, beto).area === "casa:u-ana:abajo", "entrar a la fiesta");
    // Se acaba: vuelve a solo invitados y quien estaba queda como invitado.
    ana.send(CASA_FIESTA_MSG.fiesta, { on: false });
    await until(() => room.state.casas.get("u-ana")?.fiesta === false, "apagarla");
    expect(room.state.casas.get("u-ana")!.modo).toBe("invitados");
    expect([...room.state.casas.get("u-ana")!.guests]).toContain("u-beto");
    // Otra fiesta enseguida no vuelve a avisar.
    const avisos = chat.filter((e) => e.fromId === "").length;
    ana.send(CASA_FIESTA_MSG.fiesta, { on: true });
    await until(() => room.state.casas.get("u-ana")?.fiesta === true, "otra fiesta");
    await tick(100);
    expect(chat.filter((e) => e.fromId === "").length).toBe(avisos);
  });

  it("la música la pone el dueño desde su casa y nadie más", { timeout: 30000 }, async () => {
    OfficeRoom.youtubeLookup = async () => ({ ok: true as const, title: "Cumbia de prueba" });
    const { room, clients } = await setup(["Ana", "Beto"]);
    const [ana, beto] = clients as [ClientRoom, ClientRoom];
    await home(ana, room, "u-ana");
    beto.send(CASA_FIESTA_MSG.radio, { action: "set", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    await tick(100);
    expect(room.state.casas.get("u-ana")?.radioVideo ?? "").toBe("");
    ana.send(CASA_FIESTA_MSG.radio, { action: "set", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    await until(() => room.state.casas.get("u-ana")?.radioVideo === "dQw4w9WgXcQ", "la música");
    expect(room.state.casas.get("u-ana")!.radioTitle).toBe("Cumbia de prueba");
    ana.send(CASA_FIESTA_MSG.radio, { action: "stop" });
    await until(() => room.state.casas.get("u-ana")?.radioVideo === "", "apagarla");
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
