import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld } from "@hyvento/map";
import { MSG, PODCAST, PODCAST_MSG, ROOM_NAME, podcastBlock, podcastSignLit, type PodcastNotice } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Podcast, type Inside } from "../src/rooms/podcast";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { PodcastState, type OfficeState } from "../src/state";
import { bootServer, goToArea, tick, TILE, token, walkToTile, type ServerRoom } from "./helpers";

// El estudio de grabación (nivel `podcast`, por la puerta del final del pasillo del piso 3): se entra y se
// sale por esa puerta, se graba solo con el permiso de todos los de adentro y, mientras se pide permiso o
// se graba, la puerta no deja entrar.

let colyseus: ColyseusTestServer;
let room: ServerRoom;

beforeAll(async () => {
  colyseus = await bootServer(new MemoryRepository());
});
afterAll(async () => {
  await colyseus.shutdown();
});
beforeEach(async () => {
  await colyseus.cleanup();
  OfficeRoom.repo = new MemoryRepository();
  room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
});

interface Person {
  client: ClientRoom;
  podcast: PodcastNotice[];
}

async function join(name: string): Promise<Person> {
  const client = await colyseus.connectTo(room, { token: await token(`u-${name.toLowerCase()}`, name) });
  await room.waitForNextPatch();
  const p: Person = { client, podcast: [] };
  client.onMessage(PODCAST_MSG.notice, (n: PodcastNotice) => p.podcast.push(n));
  return p;
}

const me = (p: Person) => room.state.players.get(p.client.sessionId)!;
const piso3 = () => getWorld().areas.get("piso-3")!;
const door = () => piso3().portals.find((p) => p.id === PODCAST.portal)!;

async function send(p: Person, type: string, raw?: unknown) {
  p.client.send(type, raw);
  await tick(60);
  await room.waitForNextPatch();
}

/** Sube hasta el pasillo del piso 3, se para frente a la puerta del estudio y pide entrar. */
async function enter(p: Person) {
  if (me(p).area !== "piso-3") await goToArea(p.client, room, "piso-3");
  const t = door().tiles[0]!;
  await walkToTile(p.client, room, t.x, t.y);
  await send(p, MSG.travel, { portal: door().id });
}

/** Sale del estudio por su puerta (al pasillo del piso 3). */
async function leave(p: Person) {
  const out = getWorld().areas.get(PODCAST.area)!.portals[0]!;
  await walkToTile(p.client, room, out.tiles[0]!.x, out.tiles[0]!.y);
  await send(p, MSG.travel, { portal: out.id });
}

describe("estudio de grabación (en la sala)", () => {
  it("se entra por la puerta del pasillo del piso 3 a una sala aislada y se sale al mismo lugar", { timeout: 30000 }, async () => {
    const a = await join("Ana");
    await enter(a);
    expect(me(a).area).toBe(PODCAST.area);
    expect(me(a).zoneId).toBe(PODCAST.zone);
    await leave(a);
    expect(me(a).area).toBe("piso-3");
    const llegada = getWorld().areas.get(PODCAST.area)!.portals[0]!.to;
    expect([Math.floor(me(a).x / TILE), Math.floor(me(a).y / TILE)]).toEqual([llegada.x, llegada.y]);
  });

  it("se graba solo si todos aceptan, y mientras tanto la puerta no deja entrar (con aviso)", { timeout: 40000 }, async () => {
    const [a, b, cc] = [await join("Ana"), await join("Beto"), await join("Caro")];
    await enter(a);
    await enter(b);
    // Desde afuera no se pide grabar.
    await goToArea(cc.client, room, "piso-3");
    await send(cc, PODCAST_MSG.start);
    expect(cc.podcast.at(-1)?.code).toBe("outside");
    await send(a, PODCAST_MSG.start);
    expect(room.state.podcast.phase).toBe("asking");
    expect(room.state.podcast.host).toBe(me(a).userId);
    expect(room.state.podcast.consents.get(me(a).userId)).toBe(true);
    expect(room.state.podcast.consents.get(me(b).userId)).toBe(false);
    // Pidiendo permiso nadie entra, y se entera de por qué.
    await enter(cc);
    expect(me(cc).area).toBe("piso-3");
    expect(cc.podcast.at(-1)?.code).toBe("onAir");
    await send(b, PODCAST_MSG.consent, { accept: true });
    expect(room.state.podcast.phase).toBe("recording");
    expect(a.podcast.at(-1)?.code).toBe("started");
    await enter(cc);
    expect(me(cc).area).toBe("piso-3");
    // Beto retira su permiso: se deja de grabar y se abre la puerta.
    await send(b, PODCAST_MSG.stop);
    expect(room.state.podcast.phase).toBe("idle");
    expect(a.podcast.at(-1)).toEqual({ code: "stopped", name: "Beto" });
    await enter(cc);
    expect(me(cc).area).toBe(PODCAST.area);
    // Ahora son tres: si Caro dice que no, no se graba (pide Beto: Ana acaba de pedir).
    await send(b, PODCAST_MSG.start);
    await send(a, PODCAST_MSG.consent, { accept: true });
    await send(cc, PODCAST_MSG.consent, { accept: false });
    expect(room.state.podcast.phase).toBe("idle");
    expect(a.podcast.at(-1)).toEqual({ code: "declined", name: "Caro" });
  });

  it("si sale quien graba, se detiene al instante", { timeout: 30000 }, async () => {
    const [a, b] = [await join("Ana"), await join("Beto")];
    await enter(a);
    await enter(b);
    await send(a, PODCAST_MSG.start);
    await send(b, PODCAST_MSG.consent, { accept: true });
    expect(room.state.podcast.phase).toBe("recording");
    await leave(a);
    expect(room.state.podcast.phase).toBe("idle");
    expect(b.podcast.at(-1)).toEqual({ code: "hostLeft", name: "Ana" });
  });
});

describe("estudio de grabación (reglas)", () => {
  const ana: Inside = { sessionId: "s-a", userId: "u-a", name: "Ana" };
  const beto: Inside = { sessionId: "s-b", userId: "u-b", name: "Beto" };
  const caro: Inside = { sessionId: "s-c", userId: "u-c", name: "Caro" };

  it("caben tantos como sillas tiene la mesa, y grabando no entra nadie", () => {
    const seats = [...getWorld().areas.get(PODCAST.area)!.seats.values()].filter((s) => s.type === "chair");
    expect(seats).toHaveLength(PODCAST.capacity);
    expect(podcastBlock(PODCAST.capacity - 1, "idle")).toBeNull();
    expect(podcastBlock(PODCAST.capacity, "idle")).toBe("full");
    expect(podcastBlock(0, "asking")).toBe("onAir");
    expect(podcastBlock(0, "recording")).toBe("onAir");
    // Quien ya está adentro no se cuenta a sí mismo (p. ej. si reintenta el portal).
    const inside = Array.from({ length: PODCAST.capacity }, (_, i) => ({ sessionId: `s${i}`, userId: `u${i}`, name: `P${i}` }));
    const p = new Podcast(new PodcastState());
    expect(p.canEnter("nuevo", inside)).toBe("full");
    expect(p.canEnter("u0", inside)).toBeNull();
  });

  it("el cartel de la puerta se prende grabando y titila pidiendo permiso", () => {
    expect(podcastSignLit("idle", 0)).toBe(false);
    expect(podcastSignLit("recording", 0) && podcastSignLit("recording", 1)).toBe(true);
    expect([podcastSignLit("asking", 0), podcastSignLit("asking", 1)]).toEqual([true, false]);
  });

  it("solo en el estudio graba de una (su pedido ya es su permiso)", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    expect(p.start(ana, [ana], 1000)).toEqual([{ to: ["s-a"], notice: { code: "started" } }]);
    expect(state.phase).toBe("recording");
    expect(state.startedAt).toBe(1000);
  });

  it("si entra alguien nuevo (por donde sea) se detiene", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    p.consent(beto, true, [ana, beto], 10);
    expect(state.phase).toBe("recording");
    expect(p.sync([ana, beto, caro], 20)).toEqual([{ to: ["s-a", "s-b", "s-c"], notice: { code: "joined", name: "Caro" } }]);
    expect(state.phase).toBe("idle");
  });

  it("sin respuesta de todos se desiste, y una grabación se corta sola a la hora", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    // Mientras se pide permiso no se puede volver a pedir.
    expect(p.start(beto, [ana, beto], 1)[0]?.notice.code).toBe("busy");
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs - 1)).toEqual([]);
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs)[0]?.notice.code).toBe("timeout");
    expect(state.phase).toBe("idle");
    expect(p.start(ana, [ana, beto], PODCAST.askTimeoutMs + 1)).toEqual([]);
    p.consent(beto, true, [ana, beto], PODCAST.askTimeoutMs + 2);
    expect(state.phase).toBe("recording");
    expect(p.sync([ana, beto], PODCAST.askTimeoutMs + 2 + PODCAST.maxRecordMs)[0]?.notice.code).toBe("tooLong");
  });

  it("hay una pausa entre dos pedidos de la misma persona", () => {
    const p = new Podcast(new PodcastState());
    p.start(ana, [ana, beto], 0);
    p.consent(beto, false, [ana, beto], 10);
    expect(p.start(ana, [ana, beto], 20)[0]?.notice.code).toBe("wait");
    expect(p.start(ana, [ana, beto], PODCAST.askCooldownMs)).toEqual([]);
  });

  it("quien sale deja de contar; si queda solo quien graba, sigue", () => {
    const state = new PodcastState();
    const p = new Podcast(state);
    p.start(ana, [ana, beto], 0);
    p.consent(beto, true, [ana, beto], 1);
    expect(p.sync([ana], 2)).toEqual([]);
    expect(state.phase).toBe("recording");
    expect(state.consents.has("u-b")).toBe(false);
    // Si Beto vuelve a entrar, es alguien nuevo.
    expect(p.sync([ana, beto], 3)[0]?.notice.code).toBe("joined");
  });
});
