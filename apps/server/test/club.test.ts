import type { ColyseusTestServer } from "@colyseus/testing";
import { getWorld, isBlockedTile, pointsOfType, zoneAt, type OfficeMap } from "@hyvento/map";
import { CLUB, MSG, ROOM_NAME, loopMs, clubTrack, poleKey, type ClubResult } from "@hyvento/shared";
import type { Room as ClientRoom } from "colyseus.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { Club, onDanceFloor, poleNear, type ClubWho } from "../src/rooms/club";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import { ClubState, type OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkTo, walkToTile, type ServerRoom } from "./helpers";

// ---------- Reglas (con el sótano de verdad) ----------

const sotano = () => getWorld().areas.get("sotano")!;
const furniture = (map: OfficeMap, type: string) => map.furniture.find((f) => f.type === type)!;

/** Alguien parado en el tile (tx, ty) del sótano. */
const at = (tx: number, ty: number, sessionId = "s-a", seated = false): ClubWho => ({
  sessionId,
  userId: `u-${sessionId}`,
  name: sessionId,
  area: "sotano",
  x: c(tx),
  y: c(ty),
  seated,
});

/** Un tile libre de la tarima junto al tubo, y otro libre de la pista de baile. */
function spots(map: OfficeMap) {
  const stage = pointsOfType(map, "pole_stage").filter((p) => !isBlockedTile(map, p.tileX, p.tileY));
  const floor = furniture(map, "dance-floor");
  const booth = pointsOfType(map, "dj_booth")[0]!;
  return {
    stage: stage.map((p) => ({ x: p.tileX, y: p.tileY })),
    floor: { x: floor.x + 2, y: floor.y + 2 },
    booth: { x: booth.tileX, y: booth.tileY },
  };
}

function rules() {
  const state = new ClubState();
  return { state, club: new Club(state), map: sotano(), ...spots(sotano()) };
}

describe("club (reglas)", () => {
  it("la pista, la tarima y la cabina están en el club y se puede llegar a ellas", () => {
    const map = sotano();
    const { stage, floor, booth } = spots(map);
    expect(stage.length).toBeGreaterThan(3);
    expect(onDanceFloor(map, c(floor.x), c(floor.y))).toBe(true);
    for (const s of stage) expect(poleNear(map, c(s.x), c(s.y)), `${s.x},${s.y}`).toBeDefined();
    expect(isBlockedTile(map, booth.x, booth.y)).toBe(false);
    for (const t of [floor, booth, ...stage]) expect(zoneAt(map, c(t.x), c(t.y))?.id, `${t.x},${t.y}`).toBe(CLUB.zone);
  });

  it("una pista de baile fuera del club (movida con el editor de la casa) no sirve para bailar", () => {
    const jardin = getWorld().areas.get("jardin")!;
    const floor = furniture(sotano(), "dance-floor");
    const moved: OfficeMap = { ...jardin, furniture: [...jardin.furniture, { ...floor, x: 2, y: 2 }] };
    expect(onDanceFloor(moved, c(3), c(3))).toBe(false);
    // Ni en el sótano fuera de la sala del club.
    const map = sotano();
    let other: { x: number; y: number } | undefined;
    for (let y = 0; y < map.height && !other; y++)
      for (let x = 0; x < map.width && !other; x++) if (zoneAt(map, c(x), c(y)) && zoneAt(map, c(x), c(y))!.id !== CLUB.zone) other = { x, y };
    const inOther: OfficeMap = { ...map, furniture: [...map.furniture, { ...floor, x: other!.x, y: other!.y }] };
    expect(onDanceFloor(inOther, c(other!.x), c(other!.y))).toBe(false);
  });

  it("la cabina pone una pista con la hora del servidor, la pausa en su punto del loop y la sigue", () => {
    const { state, club, map, booth } = rules();
    const dj = at(booth.x, booth.y);
    expect(club.dj(map, dj, { action: "play", track: "house" }, 10_000)).toEqual({ ok: true });
    expect(state.track).toBe("house");
    expect(state.startedAt).toBe(10_000);
    expect(state.dj).toBe(dj.name);
    const loop = loopMs(clubTrack("house")!);
    expect(club.dj(map, dj, { action: "pause" }, 10_000 + loop + 1500)).toEqual({ ok: true });
    expect(state.paused).toBe(true);
    expect(state.pausedAt).toBe(1500);
    expect(club.dj(map, dj, { action: "resume" }, 90_000)).toEqual({ ok: true });
    expect(state.paused).toBe(false);
    expect(state.startedAt).toBe(90_000 - 1500);
    expect(club.dj(map, dj, { action: "stop" }, 91_000)).toEqual({ ok: true });
    expect(state.track).toBe("");
  });

  it("la cabina solo se usa de cerca, sin ráfagas y con pistas que existen", () => {
    const { state, club, map, booth, floor } = rules();
    expect(club.dj(map, at(floor.x, floor.y), { action: "play", track: "lofi" }, 0)).toEqual({ ok: false, error: "far" });
    expect(club.dj(map, at(booth.x, booth.y), { action: "play", track: "polka" }, 0)).toEqual({ ok: false, error: "invalid" });
    expect(club.dj(map, at(booth.x, booth.y), { action: "play", track: "lofi" }, 0)).toEqual({ ok: true });
    expect(club.dj(map, at(booth.x, booth.y), { action: "play", track: "disco" }, CLUB.djCooldownMs - 1)).toEqual({ ok: false, error: "busy" });
    expect(state.track).toBe("lofi");
  });

  it("en la pista se baila solo con música, parado encima y con un paso que existe", () => {
    const { state, club, map, booth, floor } = rules();
    const me = at(floor.x, floor.y, "s-b");
    expect(club.dance(map, me, { move: "robot" }, 0)).toEqual({ ok: false, error: "silence" });
    club.dj(map, at(booth.x, booth.y), { action: "play", track: "disco" }, 0);
    expect(club.dance(map, at(booth.x, booth.y, "s-b"), { move: "robot" }, 100)).toEqual({ ok: false, error: "far" });
    expect(club.dance(map, { ...me, seated: true }, { move: "robot" }, 100)).toEqual({ ok: false, error: "seated" });
    expect(club.dance(map, me, { move: "moonwalk" }, 100)).toEqual({ ok: false, error: "invalid" });
    expect(club.dance(map, me, { move: "robot" }, 100)).toEqual({ ok: true });
    expect(state.dancers.get("s-b")).toMatchObject({ kind: "floor", move: "robot", since: 100 });
    // Cambiar de paso sigue el mismo baile (no vuelve a empezar la cuenta).
    expect(club.dance(map, me, { move: "giro" }, 100 + CLUB.danceCooldownMs)).toEqual({ ok: true });
    expect(state.dancers.get("s-b")).toMatchObject({ move: "giro", since: 100 });
  });

  it("al pausar o parar la música se deja de bailar en la pista (el tubo sigue)", () => {
    const { state, club, map, booth, floor, stage } = rules();
    const dj = at(booth.x, booth.y);
    club.dj(map, dj, { action: "play", track: "synthwave" }, 0);
    club.dance(map, at(floor.x, floor.y, "s-b"), { move: "vaiven" }, 10);
    club.pole(map, at(stage[0]!.x, stage[0]!.y, "s-c"), { on: true }, 10);
    club.dj(map, dj, { action: "pause" }, 5000);
    expect(state.dancers.has("s-b")).toBe(false);
    expect(state.dancers.get("s-c")?.kind).toBe("pole");
  });

  it("en el tubo baila una sola persona; al soltarlo lo puede tomar otra", () => {
    const { state, club, map, stage } = rules();
    const pole = furniture(map, "dance-pole");
    const [a, b] = [at(stage[0]!.x, stage[0]!.y, "s-a"), at(stage[1]!.x, stage[1]!.y, "s-b")];
    expect(club.pole(map, a, { on: true }, 0)).toEqual({ ok: true });
    expect(state.dancers.get("s-a")).toMatchObject({ kind: "pole", move: poleKey(pole.x, pole.y), since: 0 });
    expect(club.pole(map, b, { on: true }, 100)).toEqual({ ok: false, error: "taken" });
    expect(club.pole(map, a, { on: false }, 200)).toEqual({ ok: true });
    expect(club.pole(map, b, { on: true }, 500)).toEqual({ ok: true });
    expect([...state.dancers.keys()]).toEqual(["s-b"]);
  });

  it("lejos del tubo, o sentado, no se engancha", () => {
    const { club, map, floor, stage } = rules();
    expect(club.pole(map, at(floor.x, floor.y), { on: true }, 0)).toEqual({ ok: false, error: "far" });
    expect(club.pole(map, at(stage[0]!.x, stage[0]!.y, "s-a", true), { on: true }, 0)).toEqual({ ok: false, error: "seated" });
  });

  it("caminando, sentándose o cambiando de nivel se deja de bailar", () => {
    const { state, club, map, stage, floor, booth } = rules();
    club.dj(map, at(booth.x, booth.y), { action: "play", track: "house" }, 0);
    const a = at(stage[0]!.x, stage[0]!.y, "s-a");
    const b = at(floor.x, floor.y, "s-b");
    club.pole(map, a, { on: true }, 0);
    club.dance(map, b, { move: "brazos" }, 0);
    // Un temblor de pocos píxeles no cuenta.
    club.moved({ ...a, x: a.x + 3 });
    expect(state.dancers.has("s-a")).toBe(true);
    club.moved({ ...a, x: a.x + CLUB.leavePx + 1 });
    expect(state.dancers.has("s-a")).toBe(false);
    club.sweep(new Map([["s-b", { ...b, area: "planta-baja" }]]));
    expect(state.dancers.has("s-b")).toBe(false);
  });
});

// ---------- En la sala: todos ven lo mismo ----------

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
  const room = (await colyseus.createRoom<OfficeState>(ROOM_NAME, {})) as ServerRoom;
  const alice = await colyseus.connectTo(room, { token: await token("u-alice", "Alice") });
  const bob = await colyseus.connectTo(room, { token: await token("u-bob", "Bob", "bruno") });
  await room.waitForNextPatch();
  const errors: ClubResult[] = [];
  bob.onMessage(MSG.clubResult, (r: ClubResult) => errors.push(r));
  alice.onMessage(MSG.clubResult, () => undefined);
  const send = async (client: ClientRoom, type: string, msg: unknown) => {
    client.send(type, msg);
    await tick(60);
    await room.waitForNextPatch();
  };
  return { room, alice, bob, errors, send };
}

describe("club (en la sala)", () => {
  it("la pista que pone alguien en la cabina llega a todos con la hora del servidor", async () => {
    const { room, alice, bob, send } = await setup();
    const { booth } = spots(sotano());
    await goToArea(alice, room, "sotano");
    await walkToTile(alice, room, booth.x, booth.y);
    const before = Date.now();
    await send(alice, MSG.clubDj, { action: "play", track: "reggaeton" });
    expect(room.state.club.track).toBe("reggaeton");
    expect(room.state.club.startedAt).toBeGreaterThanOrEqual(before);
    expect(room.state.club.dj).toBe("Alice");
    // El cliente de Bob (aunque esté en otro nivel) recibe el mismo estado.
    await tick(80);
    expect((bob.state as unknown as OfficeState).club.track).toBe("reggaeton");
  });

  it("en el tubo baila una persona: la otra recibe el aviso, y al caminar se suelta", async () => {
    const { room, alice, bob, errors, send } = await setup();
    const { stage } = spots(sotano());
    await goToArea(alice, room, "sotano");
    await walkToTile(alice, room, stage[0]!.x, stage[0]!.y);
    await goToArea(bob, room, "sotano");
    await walkToTile(bob, room, stage[1]!.x, stage[1]!.y);
    await send(alice, MSG.clubPole, { on: true });
    expect(room.state.club.dancers.get(alice.sessionId)?.kind).toBe("pole");
    await send(bob, MSG.clubPole, { on: true });
    expect(errors.at(-1)).toEqual({ ok: false, error: "taken" });
    // Alice camina un tile y deja el tubo libre.
    const p = room.state.players.get(alice.sessionId)!;
    await walkTo(alice, room, p.x, p.y + 32);
    expect(room.state.club.dancers.has(alice.sessionId)).toBe(false);
    await send(bob, MSG.clubPole, { on: true });
    expect(room.state.club.dancers.get(bob.sessionId)?.kind).toBe("pole");
  });

  it("sin música no se baila en la pista, y al irse de la sala se deja de bailar", async () => {
    const { room, alice, bob, errors, send } = await setup();
    const { floor, booth } = spots(sotano());
    await goToArea(bob, room, "sotano");
    await walkToTile(bob, room, floor.x, floor.y);
    await send(bob, MSG.clubDance, { move: "giro" });
    expect(errors.at(-1)).toEqual({ ok: false, error: "silence" });
    await goToArea(alice, room, "sotano");
    await walkToTile(alice, room, booth.x, booth.y);
    await send(alice, MSG.clubDj, { action: "play", track: "house" });
    await send(bob, MSG.clubDance, { move: "giro" });
    expect(room.state.club.dancers.get(bob.sessionId)).toMatchObject({ kind: "floor", move: "giro" });
    await bob.leave(true);
    await tick(80);
    await room.waitForNextPatch();
    expect(room.state.club.dancers.size).toBe(0);
  });
});
