import type { ColyseusTestServer } from "@colyseus/testing";
import { findPath, getWorld, isBlockedTile, pointsOfType, spawnPoint } from "@hyvento/map";
import {
  EMPTY_CAN,
  GREENHOUSE_PLOT_BASE,
  HUERTO,
  HUERTO_MSG,
  MSG,
  ROOM_NAME,
  WATERING_CAN,
  cropById,
  seedsOf,
  type FurnitureEvent,
  type HuertoNotice,
} from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, tick, token, walkToTile, type ServerRoom } from "./helpers";

// El huerto del jardín en la sala: el cobertizo, sembrar, regar (llenando la regadera en el barril),
// cosechar con puntos, la miel de las colmenas y que las herramientas no se gasten con F.

const jardin = getWorld().areas.get("jardin")!;
const plots = pointsOfType(jardin, "garden_plot");
const shedPoint = pointsOfType(jardin, "tool_shed")[0]!;
const barrel = jardin.furniture.find((f) => f.type === "water-barrel")!;
const hive = jardin.furniture.find((f) => f.type === "beehive")!;
const beds = pointsOfType(jardin, "greenhouse_plot");
const greenhouse = jardin.furniture.find((f) => f.type === "greenhouse")!;
const start = { x: spawnPoint(jardin).tileX, y: spawnPoint(jardin).tileY };

/** Un tile libre al lado del mueble al que se llega caminando. */
function beside(f: { x: number; y: number; w: number; d: number }) {
  for (let y = f.y - 1; y <= f.y + f.d; y++)
    for (let x = f.x - 1; x <= f.x + f.w; x++) {
      const inside = x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.d;
      if (!inside && !isBlockedTile(jardin, x, y) && findPath(jardin, start, { x, y })) return { x, y };
    }
  throw new Error("Sin lugar al lado");
}

let colyseus: ColyseusTestServer;
let repo: MemoryRepository;
let clock = Date.now();

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  repo = new MemoryRepository();
  OfficeRoom.repo = repo;
  clock = Date.now();
  OfficeRoom.huertoNow = () => clock;
});
afterEach(() => {
  OfficeRoom.huertoNow = () => Date.now();
});

const me = (client: ClientRoom, room: ServerRoom) => room.state.players.get(client.sessionId)!;

async function join(name = "Alice") {
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const notices: HuertoNotice[] = [];
  const events: FurnitureEvent[] = [];
  client.onMessage(HUERTO_MSG.notice, (n: HuertoNotice) => notices.push(n));
  client.onMessage(MSG.furnitureEvent, (e: FurnitureEvent) => events.push(e));
  return { room, client, notices, events };
}

async function send(client: ClientRoom, room: ServerRoom, type: string, raw: unknown, wait = 80) {
  client.send(type, raw);
  await tick(wait);
  await room.waitForNextPatch();
}

/** Usar una parcela, el barril o una colmena (espera la pausa entre usos del servidor). */
async function use(client: ClientRoom, room: ServerRoom, type: string, x: number, y: number) {
  await send(client, room, MSG.furnitureUse, { type, x, y });
  await tick(1600);
}

async function takeFromShed(client: ClientRoom, room: ServerRoom, item: string) {
  await walkToTile(client, room, shedPoint.tileX, shedPoint.tileY);
  await send(client, room, HUERTO_MSG.shedTake, { item });
}

describe("huerto (en la sala)", () => {
  it("del cobertizo salen la regadera y las semillas, pero solo junto a su puerta", async () => {
    const { room, client, notices } = await join();
    await send(client, room, HUERTO_MSG.shedTake, { item: seedsOf("cilantro") });
    expect(notices.at(-1)?.code).toBe("far");
    expect(me(client, room).held).toBe("");
    await takeFromShed(client, room, seedsOf("cilantro"));
    expect(me(client, room).held).toBe(seedsOf("cilantro"));
    expect(me(client, room).heldLeft).toBe(String(HUERTO.seedUses));
    // Lo que no está en el cobertizo no se saca.
    await send(client, room, HUERTO_MSG.shedTake, { item: "whisky" });
    expect(me(client, room).held).toBe(seedsOf("cilantro"));
    await send(client, room, HUERTO_MSG.shedTake, { item: EMPTY_CAN });
    expect(me(client, room).held).toBe(EMPTY_CAN);
  });

  it("las herramientas no se gastan con F", async () => {
    const { room, client } = await join();
    await takeFromShed(client, room, seedsOf("papa"));
    await send(client, room, MSG.useHeld, undefined);
    expect(me(client, room).held).toBe(seedsOf("papa"));
    expect(me(client, room).heldLeft).toBe(String(HUERTO.seedUses));
  });

  it("se siembra con semillas, se riega con la regadera llena y se cosecha con puntos", { timeout: 30_000 }, async () => {
    const { room, client, notices, events } = await join();
    const plot = plots[0]!;
    // Sin semillas, la parcela vacía avisa qué hace falta.
    await walkToTile(client, room, plot.tileX, plot.tileY);
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(notices.at(-1)?.code).toBe("seeds");

    await takeFromShed(client, room, seedsOf("cilantro"));
    await walkToTile(client, room, plot.tileX, plot.tileY);
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    const planted = room.state.garden.get("0")!;
    expect(planted.crop).toBe("cilantro");
    expect(planted.plantedBy).toBe("u-alice");
    expect(me(client, room).heldLeft).toBe(String(HUERTO.seedUses - 1));
    expect(events.at(-1)).toMatchObject({ type: "garden-plot", action: "plot", garden: "plant", item: "cilantro" });
    expect(repo.garden.get(0)?.crop).toBe("cilantro");
    // Ya sembrada: con semillas en la mano no se vuelve a sembrar, avisa que está creciendo.
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(notices.at(-1)?.code).toBe("growing");

    // La regadera sale vacía: se llena en el barril.
    await takeFromShed(client, room, EMPTY_CAN);
    await walkToTile(client, room, plot.tileX, plot.tileY);
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(notices.at(-1)?.code).toBe("emptyCan");
    const spot = beside(barrel);
    await walkToTile(client, room, spot.x, spot.y);
    await use(client, room, "water-barrel", barrel.x, barrel.y);
    expect(me(client, room).held).toBe(WATERING_CAN);
    expect(me(client, room).heldLeft).toBe(String(HUERTO.canUses));

    await walkToTile(client, room, plot.tileX, plot.tileY);
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(room.state.garden.get("0")!.wateredUntil).toBeGreaterThan(clock);
    expect(me(client, room).heldLeft).toBe(String(HUERTO.canUses - 1));
    expect(events.at(-1)).toMatchObject({ garden: "water" });
    // Recién regada no se riega otra vez.
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(notices.at(-1)?.code).toBe("wet");

    // Crece: al rato está lista y se cosecha.
    const before = me(client, room).points;
    clock += cropById("cilantro")!.growMs;
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(room.state.garden.has("0")).toBe(false);
    expect(me(client, room).held).toBe("cilantro");
    expect(me(client, room).points).toBe(before + cropById("cilantro")!.points);
    expect(events.at(-1)).toMatchObject({ garden: "harvest", item: "cilantro" });
    await tick(50);
    expect(repo.garden.has(0)).toBe(false);
    expect(repo.ledger.some((m) => m.userId === "u-alice" && m.reason === "LEISURE" && m.amount === 2)).toBe(true);
  });

  it("lo que sembró otra persona lo cosecha ella durante la primera hora; después, cualquiera", async () => {
    const lulo = cropById("lulo")!;
    const t = clock;
    // Guardada de antes (se carga al abrir la sala) y lista desde ahora.
    repo.garden.set(3, { id: 3, crop: "lulo", plantedBy: "u-bob", plantedByName: "Bob", plantedAt: t - lulo.growMs, growthMs: lulo.growMs, growthAt: t, wateredUntil: 0 });
    const { room, client, notices } = await join();
    expect(room.state.garden.get("3")?.crop).toBe("lulo");
    const plot = plots[3]!;
    await walkToTile(client, room, plot.tileX, plot.tileY);
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(notices.at(-1)).toMatchObject({ code: "notYours", name: "Bob" });
    expect(room.state.garden.has("3")).toBe(true);
    clock = t + HUERTO.ownerHarvestMs;
    await use(client, room, "garden-plot", plot.tileX, plot.tileY);
    expect(room.state.garden.has("3")).toBe(false);
    expect(me(client, room).held).toBe(lulo.product);
  });

  it("cada persona siembra a lo más unas pocas parcelas", async () => {
    const { room, client, notices } = await join();
    for (let i = 0; i < HUERTO.maxPlotsPerPerson; i++) {
      const p = plots[i]!;
      if (i % HUERTO.seedUses === 0) await takeFromShed(client, room, seedsOf("cilantro"));
      await walkToTile(client, room, p.tileX, p.tileY);
      await use(client, room, "garden-plot", p.tileX, p.tileY);
    }
    expect([...room.state.garden.values()].filter((p) => p.plantedBy === "u-alice")).toHaveLength(HUERTO.maxPlotsPerPerson);
    const extra = plots[HUERTO.maxPlotsPerPerson]!;
    await takeFromShed(client, room, seedsOf("cilantro"));
    await walkToTile(client, room, extra.tileX, extra.tileY);
    await use(client, room, "garden-plot", extra.tileX, extra.tileY);
    expect(notices.at(-1)?.code).toBe("tooMany");
    expect(room.state.garden.has(String(HUERTO.maxPlotsPerPerson))).toBe(false);
  }, 60_000);

  it("la miel sale de la colmena una vez cada tanto", async () => {
    const { room, client, notices, events } = await join();
    const spot = beside(hive);
    await walkToTile(client, room, spot.x, spot.y);
    await use(client, room, "beehive", hive.x, hive.y);
    expect(me(client, room).held).toBe("miel");
    expect(events.at(-1)).toMatchObject({ type: "beehive", action: "honey" });
    await use(client, room, "beehive", hive.x, hive.y);
    expect(notices.at(-1)?.code).toBe("honeyWait");
    clock += HUERTO.honeyCooldownMs;
    await use(client, room, "beehive", hive.x, hive.y);
    expect(events.filter((e) => e.action === "honey")).toHaveLength(2);
  });

  it("en el invernadero se siembra lo de tierra caliente, crece sin regar y se cosecha", async () => {
    const { room, client, notices, events } = await join();
    const bed = beds[4]!; // el primero del costado oeste
    const aisle = { x: greenhouse.x + 1, y: greenhouse.y + 1 };
    // Lo de tierra caliente no se da afuera.
    await takeFromShed(client, room, seedsOf("pitahaya"));
    await walkToTile(client, room, plots[0]!.tileX, plots[0]!.tileY);
    await use(client, room, "garden-plot", plots[0]!.tileX, plots[0]!.tileY);
    expect(notices.at(-1)).toMatchObject({ code: "indoor", crop: "pitahaya" });
    expect(room.state.garden.size).toBe(0);
    // Desde afuera, a través del vidrio, no se alcanza.
    await walkToTile(client, room, greenhouse.x - 1, bed.tileY);
    await use(client, room, "greenhouse-bed", bed.tileX, bed.tileY);
    expect(notices.at(-1)?.code).toBe("inside");
    expect(room.state.garden.size).toBe(0);
    // Se entra por la puerta y se siembra en el bancal.
    await walkToTile(client, room, aisle.x, aisle.y);
    await use(client, room, "greenhouse-bed", bed.tileX, bed.tileY);
    const key = String(GREENHOUSE_PLOT_BASE + 4);
    expect(room.state.garden.get(key)?.crop).toBe("pitahaya");
    expect(events.at(-1)).toMatchObject({ type: "greenhouse-bed", garden: "plant", item: "pitahaya" });
    await tick(50);
    expect(repo.garden.get(GREENHOUSE_PLOT_BASE + 4)?.crop).toBe("pitahaya");
    // Lo del huerto no va en los bancales.
    await takeFromShed(client, room, seedsOf("papa"));
    await walkToTile(client, room, aisle.x, aisle.y);
    await use(client, room, "greenhouse-bed", beds[0]!.tileX, beds[0]!.tileY);
    expect(notices.at(-1)?.code).toBe("outdoor");
    // Con la regadera avisa que no hace falta, y sin regar queda lista a tiempo.
    await takeFromShed(client, room, EMPTY_CAN);
    await walkToTile(client, room, aisle.x, aisle.y);
    await use(client, room, "greenhouse-bed", bed.tileX, bed.tileY);
    expect(notices.at(-1)?.code).toBe("noWater");
    const before = me(client, room).points;
    clock += cropById("pitahaya")!.growMs;
    await use(client, room, "greenhouse-bed", bed.tileX, bed.tileY);
    expect(room.state.garden.has(key)).toBe(false);
    expect(me(client, room).held).toBe("pitahaya");
    expect(me(client, room).points).toBe(before + cropById("pitahaya")!.points);
  }, 30_000);

  it("desde lejos no se usa la parcela", async () => {
    const { room, client, events } = await join();
    await takeFromShed(client, room, seedsOf("fresa"));
    const far = plots[19]!;
    await use(client, room, "garden-plot", far.tileX, far.tileY);
    expect(room.state.garden.size).toBe(0);
    expect(events).toHaveLength(0);
  });
});
