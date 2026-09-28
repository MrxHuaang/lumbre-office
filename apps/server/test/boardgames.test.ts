import type { ColyseusTestServer } from "@colyseus/testing";
import { MapSchema } from "@colyseus/schema";
import { BOARD_TABLES, findPath, getWorld, pointsOfType, SEAT_REACH_TILES } from "@hyvento/map";
import { BOARD_GAME, MSG, ROOM_NAME, squareIndex, type BoardResult, type BoardSettled, type BoardSide } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { BoardGames, type BoardSitter, type Timer } from "../src/rooms/boardGames";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { BoardTableState, OfficeState } from "../src/state";
import { bootServer, c, goToArea, tick, token, walkToTile } from "./helpers";

// ---------- Reloj de mentira: las mesas se revisan con el reloj de la sala, acá se adelanta a mano ----------

class FakeClock {
  now = 1_000_000;
  private timers: { at: number; every: number; fn: () => void; dead: boolean }[] = [];

  every = (ms: number, fn: () => void): Timer => {
    const t = { at: this.now + ms, every: ms, fn, dead: false };
    this.timers.push(t);
    return { clear: () => void (t.dead = true) };
  };

  async advance(ms: number) {
    const end = this.now + ms;
    for (;;) {
      const due = this.timers.filter((t) => !t.dead && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.now = due.at;
      due.at += due.every;
      due.fn();
    }
    this.now = end;
    await flush();
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

const CHESS = BOARD_TABLES.find((t) => t.game === "ajedrez")!;
const CHECKERS = BOARD_TABLES.find((t) => t.game === "damas")!;
const sq = squareIndex;
/** Casilla de damas en (fila, columna). */
const at = (r: number, col: number) => r * 8 + col;

function setup() {
  const clock = new FakeClock();
  const state = new MapSchema<BoardTableState>();
  const repo = new MemoryRepository();
  /** Quién está sentado en cada silla ("area:x,y"). */
  const chairs = new Map<string, BoardSitter>();
  const settled: (BoardSettled & { userId: string })[] = [];
  const games = new BoardGames({
    state,
    tables: BOARD_TABLES,
    now: () => clock.now,
    every: clock.every,
    sitterAt: (area, tx, ty) => chairs.get(`${area}:${tx},${ty}`) ?? null,
    saveWin: (w) => repo.saveBoardWin(w),
    settled: (userId, s) => settled.push({ userId, ...s }),
  });
  games.start();
  const table = BOARD_TABLES[0]!;
  const sit = (def: typeof table, side: BoardSide, userId: string) => {
    const s = def.seats[side];
    chairs.set(`${def.area}:${s.x},${s.y}`, { userId, name: userId.slice(2).toUpperCase() });
  };
  const stand = (def: typeof table, side: BoardSide) => {
    const s = def.seats[side];
    chairs.delete(`${def.area}:${s.x},${s.y}`);
  };
  /** Los dos sentados y listos: empieza la partida. */
  const start = (def: typeof table, white = "u-ana", black = "u-beto") => {
    sit(def, 0, white);
    sit(def, 1, black);
    expect(games.ready(white, { table: def.id })).toEqual({ ok: true });
    expect(games.ready(black, { table: def.id })).toEqual({ ok: true });
    expect(state.get(def.id)!.phase).toBe("playing");
  };
  /** Jugadas de ajedrez alternadas (blancas primero) en notación "e2e4". */
  const chess = (...moves: string[]) =>
    moves.map((m, i) => games.move(i % 2 === 0 ? "u-ana" : "u-beto", { table: CHESS.id, path: [sq(m.slice(0, 2)), sq(m.slice(2, 4))] }));
  return { clock, state, repo, games, chairs, settled, sit, stand, start, chess };
}

describe("mesas de juego (el mapa)", () => {
  it("cada mesa tiene sus dos sillas a los lados, se llega a las dos y hay desde dónde mirar", () => {
    for (const def of BOARD_TABLES) {
      const map = getWorld().areas.get(def.area)!;
      expect(map.furniture.some((f) => f.type === def.type && f.x === def.x && f.y === def.y)).toBe(true);
      const spawn = map.portals[0]!.tiles[0]!;
      for (const s of def.seats) {
        expect(map.furniture.some((f) => f.type === "chair" && f.x === s.x && f.y === s.y && f.facing === s.facing)).toBe(true);
        expect(Math.abs(s.x - def.x) + Math.abs(s.y - def.y)).toBe(1);
        // Hay una casilla libre junto a la silla, a la que se llega caminando, desde donde sentarse.
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => Math.hypot(dx!, dy!) <= SEAT_REACH_TILES && findPath(map, spawn, { x: s.x + dx!, y: s.y + dy! }) !== null);
        expect(near).toBe(true);
      }
      const watch = pointsOfType(map, "board_game").filter((p) => Math.abs(p.x - (def.x + 0.5) * map.tileSize) < map.tileSize && Math.abs(p.y - (def.y + 0.5) * map.tileSize) < 2 * map.tileSize);
      expect(watch.length).toBeGreaterThan(0);
    }
  });
});

describe("ajedrez en la mesa", () => {
  it("mate del pastor: gana blancas, se avisa a los dos y la victoria va al ranking", async () => {
    const { state, repo, settled, start, chess, clock } = setup();
    start(CHESS);
    const results = chess("e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7");
    expect(results.every((r) => r?.ok)).toBe(true);
    const t = state.get(CHESS.id)!;
    expect(t.phase).toBe("over");
    expect(t.winner).toBe(0);
    expect(t.reason).toBe("mate");
    expect(t.check).toBe(true);
    expect(t.last).toBe(`${sq("h5")},${sq("f7")}`);
    await flush();
    expect(settled).toEqual([
      { userId: "u-ana", table: CHESS.id, game: "ajedrez", outcome: "win", reason: "mate", counted: true },
      { userId: "u-beto", table: CHESS.id, game: "ajedrez", outcome: "lose", reason: "mate", counted: false },
    ]);
    expect(await repo.boardRanking({ game: "ajedrez", since: 0, limit: 5 })).toEqual([{ name: "ANA", wins: 1 }]);
    // Pasado el resultado, la mesa queda libre con el tablero armado y los dos siguen sentados.
    await clock.advance(BOARD_GAME.overMs + BOARD_GAME.sweepMs);
    expect(t.phase).toBe("idle");
    expect(t.seats[0]!.userId).toBe("u-ana");
    expect(t.position.startsWith("rnbqkbnr/pppppppp")).toBe(true);
  });

  it("valida el turno, la silla y la jugada", () => {
    const { games, start, chess, stand, sit } = setup();
    // Sin sentarse no se puede decir listo.
    expect(games.ready("u-ana", { table: CHESS.id })).toEqual({ ok: false, error: "seat" });
    start(CHESS);
    expect(games.move("u-beto", { table: CHESS.id, path: [sq("e7"), sq("e5")] })).toEqual({ ok: false, error: "turn" });
    expect(games.move("u-ana", { table: CHESS.id, path: [sq("e2"), sq("e5")] })).toEqual({ ok: false, error: "illegal" });
    expect(games.move("u-cata", { table: CHESS.id, path: [sq("e2"), sq("e4")] })).toEqual({ ok: false, error: "busy" });
    // Levantado de la silla no se juega (pero la partida sigue).
    stand(CHESS, 0);
    expect(games.move("u-ana", { table: CHESS.id, path: [sq("e2"), sq("e4")] })).toEqual({ ok: false, error: "seat" });
    sit(CHESS, 0, "u-ana");
    expect(chess("e2e4")[0]).toEqual({ ok: true });
    // Mensajes mal armados se ignoran.
    expect(games.move("u-beto", { table: CHESS.id, path: [99] })).toBeNull();
    expect(games.move("u-beto", { table: "no-existe", path: [1, 2] })).toBeNull();
  });

  it("no se puede jugar contra uno mismo", () => {
    const { games, sit } = setup();
    sit(CHESS, 0, "u-ana");
    sit(CHESS, 1, "u-ana");
    expect(games.ready("u-ana", { table: CHESS.id })).toEqual({ ok: false, error: "self" });
  });

  it("coronación con elección", () => {
    const { games, start, state } = setup();
    start(CHESS);
    // Se arma a mano una posición con un peón a punto de coronar.
    const live = games.debugPosition(CHESS.id)!;
    if (live.game !== "ajedrez") throw new Error("no es ajedrez");
    live.g.board.fill("");
    live.g.board[sq("a7")] = "P";
    live.g.board[sq("h1")] = "K";
    live.g.board[sq("h8")] = "k";
    live.g.castling = "";
    expect(games.move("u-ana", { table: CHESS.id, path: [sq("a7"), sq("a8")], promo: "n" })).toEqual({ ok: true });
    expect(state.get(CHESS.id)!.position.startsWith("N6k/")).toBe(true);
  });

  it("rendirse, y las partidas muy cortas no suben el ranking", async () => {
    const { games, start, state, settled, repo } = setup();
    start(CHESS);
    expect(games.resign("u-beto", { table: CHESS.id })).toEqual({ ok: true });
    await flush();
    const t = state.get(CHESS.id)!;
    expect([t.phase, t.winner, t.reason]).toEqual(["over", 0, "resign"]);
    expect(settled[0]).toMatchObject({ userId: "u-ana", outcome: "win", counted: false });
    expect(await repo.boardRanking({ game: "ajedrez", since: 0, limit: 5 })).toEqual([]);
  });

  it("tablas de mutuo acuerdo: una ofrece y la otra acepta", async () => {
    const { games, start, state, chess } = setup();
    start(CHESS);
    chess("e2e4");
    expect(games.draw("u-ana", { table: CHESS.id })).toEqual({ ok: true });
    expect(state.get(CHESS.id)!.drawOffer).toBe(0);
    expect(games.draw("u-beto", { table: CHESS.id })).toEqual({ ok: true });
    expect(state.get(CHESS.id)!.phase).toBe("over");
    expect(state.get(CHESS.id)!.winner).toBe(-1);
    expect(state.get(CHESS.id)!.reason).toBe("agreed");
  });

  it("reloj por jugada: si se acaba, pierde el que tenía que mover", async () => {
    const { games, clock, state, sit } = setup();
    sit(CHESS, 0, "u-ana");
    sit(CHESS, 1, "u-beto");
    games.ready("u-ana", { table: CHESS.id, clock: 60 });
    games.ready("u-beto", { table: CHESS.id });
    const t = state.get(CHESS.id)!;
    expect(t.clock).toBe(60);
    expect(t.turnEndsAt).toBe(clock.now + 60_000);
    await clock.advance(30_000);
    games.move("u-ana", { table: CHESS.id, path: [sq("d2"), sq("d4")] });
    // Cada jugada vuelve a dar el minuto entero.
    await clock.advance(59_000);
    expect(t.phase).toBe("playing");
    await clock.advance(1_500);
    expect([t.phase, t.winner, t.reason]).toEqual(["over", 0, "time"]);
  });

  it("cambiar el reloj pide volver a decir listo", () => {
    const { games, state, sit } = setup();
    sit(CHESS, 0, "u-ana");
    sit(CHESS, 1, "u-beto");
    games.ready("u-ana", { table: CHESS.id });
    games.ready("u-beto", { table: CHESS.id, clock: 0 });
    const t = state.get(CHESS.id)!;
    expect(t.phase).toBe("idle");
    expect(t.seats[0]!.ready).toBe(false);
    expect(t.seats[1]!.ready).toBe(true);
    // Un reloj que no está en las opciones no vale.
    expect(games.ready("u-ana", { table: CHESS.id, clock: 7 })).toBeNull();
  });

  it("la partida sigue si alguien se levanta o se desconecta un rato; si no vuelve, pierde", async () => {
    const { clock, state, stand, sit, chess, games } = setup();
    // Sin reloj por jugada (si no, se le acabaría el tiempo antes que la ausencia).
    sit(CHESS, 0, "u-ana");
    sit(CHESS, 1, "u-beto");
    games.ready("u-ana", { table: CHESS.id, clock: 0 });
    games.ready("u-beto", { table: CHESS.id });
    chess("e2e4");
    stand(CHESS, 1);
    await clock.advance(BOARD_GAME.awayMs - 10_000);
    const t = state.get(CHESS.id)!;
    expect(t.phase).toBe("playing");
    expect(t.seats[1]!.awaySince).toBeGreaterThan(0);
    // Vuelve a tiempo y sigue jugando.
    sit(CHESS, 1, "u-beto");
    await clock.advance(BOARD_GAME.sweepMs);
    expect(t.seats[1]!.awaySince).toBe(0);
    expect(games.move("u-beto", { table: CHESS.id, path: [sq("e7"), sq("e5")] })).toEqual({ ok: true });
    // Otra persona en la silla no la reemplaza.
    stand(CHESS, 1);
    sit(CHESS, 1, "u-cata");
    await clock.advance(BOARD_GAME.awayMs + BOARD_GAME.sweepMs);
    expect([t.phase, t.winner, t.reason]).toEqual(["over", 0, "away"]);
  });

  it("antes de empezar, levantarse deja la silla libre (y ya no está listo)", async () => {
    const { games, clock, state, sit, stand } = setup();
    sit(CHESS, 0, "u-ana");
    games.ready("u-ana", { table: CHESS.id });
    const t = state.get(CHESS.id)!;
    expect(t.seats[0]!.ready).toBe(true);
    stand(CHESS, 0);
    await clock.advance(BOARD_GAME.sweepMs);
    expect(t.seats[0]!.userId).toBe("");
    expect(t.seats[0]!.ready).toBe(false);
    sit(CHESS, 1, "u-beto");
    await clock.advance(BOARD_GAME.sweepMs);
    expect(t.seats[1]!.name).toBe("BETO");
  });
});

describe("damas en la mesa", () => {
  it("captura múltiple obligatoria en una sola jugada y gana quien deja al otro sin piezas", async () => {
    const { games, start, state, repo } = setup();
    start(CHECKERS);
    const live = games.debugPosition(CHECKERS.id)!;
    if (live.game !== "damas") throw new Error("no es damas");
    // Se arma una posición: un peón blanco puede capturar dos negros seguidos.
    live.g.board.fill("");
    live.g.board[at(5, 0)] = "w";
    live.g.board[at(4, 1)] = "b";
    live.g.board[at(2, 3)] = "b";
    live.g.board[at(7, 6)] = "w";
    // Un paso simple no vale: hay que capturar, y todo lo posible.
    expect(games.move("u-ana", { table: CHECKERS.id, path: [at(7, 6), at(6, 5)] })).toEqual({ ok: false, error: "illegal" });
    expect(games.move("u-ana", { table: CHECKERS.id, path: [at(5, 0), at(3, 2)] })).toEqual({ ok: false, error: "illegal" });
    expect(games.move("u-ana", { table: CHECKERS.id, path: [at(5, 0), at(3, 2), at(1, 4)] })).toEqual({ ok: true });
    const t = state.get(CHECKERS.id)!;
    expect(t.position[at(4, 1)]).toBe(".");
    expect(t.position[at(2, 3)]).toBe(".");
    expect(t.position[at(1, 4)]).toBe("w");
    expect(t.last).toBe([at(5, 0), at(3, 2), at(1, 4)].join(","));
    // Las negras se quedaron sin piezas: ganan las blancas.
    expect([t.phase, t.winner, t.reason]).toEqual(["over", 0, "blocked"]);
    await flush();
    // Fue una partida de una jugada: no cuenta para el ranking.
    expect(await repo.boardRanking({ game: "damas", since: 0, limit: 5 })).toEqual([]);
  });

  it("las dos mesas juegan a la vez sin mezclarse", () => {
    const { start, state, chess, games } = setup();
    start(CHESS);
    start(CHECKERS, "u-cata", "u-dani");
    expect(chess("e2e4")[0]).toEqual({ ok: true });
    expect(games.move("u-cata", { table: CHECKERS.id, path: [at(5, 0), at(4, 1)] })).toEqual({ ok: true });
    expect(state.get(CHESS.id)!.turn).toBe(1);
    expect(state.get(CHECKERS.id)!.turn).toBe(1);
    // Jugar en la mesa de otro no se puede.
    expect(games.move("u-ana", { table: CHECKERS.id, path: [at(2, 1), at(3, 0)] })).toEqual({ ok: false, error: "busy" });
  });
});

// ---------- Con la sala de verdad: sentarse, jugar por mensajes y el ranking ----------

describe("ajedrez en la sala", () => {
  let colyseus: ColyseusTestServer;
  let repo: MemoryRepository;

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
  });

  it("dos personas se sientan, juegan el mate del pastor y la victoria sale en el ranking", async () => {
    const room = await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    const ana = await colyseus.connectTo(room, { token: await token("u-ana", "Ana") });
    const beto = await colyseus.connectTo(room, { token: await token("u-beto", "Beto") });
    await room.waitForNextPatch();
    const errors: BoardResult[] = [];
    const settled: BoardSettled[] = [];
    ana.onMessage(MSG.boardResult, (r: BoardResult) => errors.push(r));
    beto.onMessage(MSG.boardResult, (r: BoardResult) => errors.push(r));
    ana.onMessage(MSG.boardSettled, (s: BoardSettled) => settled.push(s));
    beto.onMessage(MSG.boardSettled, () => undefined);
    for (const [client, side] of [
      [ana, 0],
      [beto, 1],
    ] as const) {
      await goToArea(client, room, CHESS.area);
      const s = CHESS.seats[side];
      // Se llega por el norte de la silla y se sienta.
      await walkToTile(client, room, s.x, s.y - 1);
      client.send(MSG.move, { x: c(s.x), y: c(s.y), dir: s.facing, moving: false, seated: true });
      await room.waitForNextPatch();
      await tick(20);
      expect(room.state.players.get(client.sessionId)!.seated).toBe(true);
    }
    ana.send(MSG.boardReady, { table: CHESS.id });
    beto.send(MSG.boardReady, { table: CHESS.id });
    await tick(80);
    const t = room.state.boards.get(CHESS.id)!;
    expect(t.phase).toBe("playing");
    expect([t.seats[0]!.name, t.seats[1]!.name]).toEqual(["Ana", "Beto"]);
    const moves = ["e2e4", "e7e5", "f1c4", "b8c6", "d1h5", "g8f6", "h5f7"];
    for (const [i, m] of moves.entries()) {
      (i % 2 === 0 ? ana : beto).send(MSG.boardMove, { table: CHESS.id, path: [sq(m.slice(0, 2)), sq(m.slice(2, 4))] });
      await tick(30);
    }
    await tick(80);
    expect(errors).toEqual([]);
    expect([t.phase, t.winner, t.reason]).toEqual(["over", 0, "mate"]);
    expect(settled).toEqual([{ table: CHESS.id, game: "ajedrez", outcome: "win", reason: "mate", counted: true }]);
    const ranking = await new Promise<unknown>((resolve) => {
      beto.onMessage(MSG.boardRankingResult, resolve);
      beto.send(MSG.boardRanking, { game: "ajedrez" });
    });
    expect(ranking).toEqual({ game: "ajedrez", week: [{ name: "Ana", wins: 1 }], all: [{ name: "Ana", wins: 1 }] });
  });
});
