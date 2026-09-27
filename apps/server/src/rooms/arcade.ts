// Arcade del sótano: una partida por persona. Al empezar (parada delante de la máquina) el servidor cobra
// la partida (ARCADE_PRICE.machine), da una semilla y anota la hora; al terminar repite la partida con esa semilla y las teclas que mandó el
// cliente (tiene que dar el mismo puntaje), compara la duración con su propio reloj, la guarda en el
// repositorio y reparte el premio de ocio si corresponde.
import { INTERACT_REACH_TILES, pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  ARCADE,
  ARCADE_PRICE,
  ARCADE_RECORD_MIN,
  ARCADE_STEP_MS,
  ArcadeBoardMessage,
  ArcadeFinishMessage,
  arcadeGameOf,
  arcadeRefId,
  ArcadeStartMessage,
  dayStart,
  plausibleScore,
  replayArcade,
  weekStart,
  type ArcadeBoard,
  type ArcadeBoardEntry,
  type ArcadeError,
  type ArcadeGame,
  type ArcadeResult,
  type ArcadeStarted,
} from "@hyvento/shared";
import type { GameRepository } from "../repo/types";

export interface ArcadeWho {
  userId: string;
  name: string;
  x: number;
  y: number;
}

interface Session {
  token: string;
  machine: number;
  game: ArcadeGame;
  seed: number;
  startedAt: number;
}

export interface ArcadeDeps {
  repo: () => GameRepository;
  /** Semilla de cada partida (los tests la fijan). */
  seed: () => number;
  token: () => string;
  /** Suma puntos de ocio (LEISURE) y avisa a la persona; devuelve lo que realmente se sumó (tope diario). */
  award: (userId: string, amount: number) => Promise<number>;
  /** Refleja el saldo nuevo en el jugador (el contador del HUD) después de cobrar la partida. */
  setPoints: (userId: string, balance: number) => void;
}

/** Tablas de un juego: la del día y la de la semana. */
interface Boards {
  at: number;
  today: ArcadeBoardEntry[];
  week: ArcadeBoardEntry[];
}

/** ¿Está (x, y) delante de la máquina `machine` (su punto "arcade", en el orden de las máquinas)? */
export function atMachine(map: OfficeMap, machine: number, x: number, y: number): boolean {
  const p = pointsOfType(map, "arcade")[machine];
  return Boolean(p) && Math.hypot(p!.x - x, p!.y - y) <= INTERACT_REACH_TILES * map.tileSize;
}

export class Arcade {
  /** La partida abierta de cada persona (una sola: empezar otra reemplaza la anterior). */
  private sessions = new Map<string, Session>();
  /** Tablas de cada juego leídas hace poco: pedirlas en bucle no le pega a la base. */
  private boards = new Map<ArcadeGame, Boards>();
  /** Las partidas se guardan de a una: dos que terminan a la vez no cobran las dos el mismo récord. */
  private saving: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: ArcadeDeps) {}

  /** Tablas de récords del día y de la semana del juego de esa máquina. */
  async board(raw: unknown, now: number): Promise<ArcadeBoard | null> {
    const parsed = ArcadeBoardMessage.safeParse(raw);
    const game = parsed.success ? arcadeGameOf(parsed.data.machine) : null;
    if (!parsed.success || !game) return null;
    const b = await this.boardsOf(game, now);
    return { machine: parsed.data.machine, game, board: b.week, today: b.today };
  }

  private async boardsOf(game: ArcadeGame, now: number): Promise<Boards> {
    const cached = this.boards.get(game);
    // Lo guardado vale unos segundos y nunca de un día a otro.
    if (cached && now - cached.at < ARCADE.boardCacheMs && cached.at >= dayStart(now)) return cached;
    const repo = this.deps.repo();
    const [week, today] = await Promise.all([
      repo.arcadeBoard({ game, since: weekStart(now), limit: ARCADE.boardSize }),
      repo.arcadeBoard({ game, since: dayStart(now), limit: ARCADE.boardSize }),
    ]);
    const b = { at: now, week, today };
    this.boards.set(game, b);
    return b;
  }

  /**
   * Empieza una partida: hay que estar delante de una máquina que funcione y tener para pagarla (se
   * cobra acá, con `spendPoints`: si no alcanza, no se juega).
   */
  async start(map: OfficeMap, who: ArcadeWho, raw: unknown, now: number): Promise<ArcadeStarted | { ok: false; error: ArcadeError }> {
    const parsed = ArcadeStartMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { machine } = parsed.data;
    const game = arcadeGameOf(machine);
    if (!game) return { ok: false, error: "invalid" };
    if (map.id !== "sotano" || !atMachine(map, machine, who.x, who.y)) return { ok: false, error: "far" };
    let paid: { ok: boolean; balance: number };
    try {
      paid = await this.deps.repo().spendPoints({ userId: who.userId, amount: ARCADE_PRICE.machine, reason: "PURCHASE", refId: arcadeRefId(game) });
    } catch (err) {
      console.error("arcade spendPoints", err);
      return { ok: false, error: "failed" };
    }
    this.deps.setPoints(who.userId, paid.balance);
    if (!paid.ok) return { ok: false, error: "funds" };
    this.forgetExpired(now);
    const session: Session = { token: this.deps.token(), machine, game, seed: this.deps.seed() >>> 0, startedAt: now };
    this.sessions.set(who.userId, session);
    return { machine, game, token: session.token, seed: session.seed, balance: paid.balance };
  }

  /**
   * Termina la partida: la repite con la semilla y las teclas, valida la duración con el reloj del servidor,
   * guarda y da el premio (primera del día; récord semanal si le gana a otra persona).
   */
  finish(who: ArcadeWho, raw: unknown, now: number): Promise<ArcadeResult> {
    const parsed = ArcadeFinishMessage.safeParse(raw);
    if (!parsed.success) return Promise.resolve({ ok: false, error: "invalid" });
    const session = this.sessions.get(who.userId);
    if (!session || session.token !== parsed.data.token) return Promise.resolve({ ok: false, error: "expired" });
    // La partida se cierra pase lo que pase: el mismo token no se puede mandar dos veces.
    this.sessions.delete(who.userId);
    const elapsed = now - session.startedAt;
    if (elapsed > ARCADE.sessionMs) return Promise.resolve({ ok: false, error: "expired" });
    const { score, steps, inputs } = parsed.data;
    const played = steps * ARCADE_STEP_MS;
    if (played < ARCADE.minMs || elapsed < ARCADE.minMs) return Promise.resolve({ ok: false, error: "short" });
    // El navegador no puede haber jugado más tiempo que el que pasó en el servidor.
    if (played > elapsed + ARCADE.clockSlackMs || !plausibleScore(session.game, score, played)) return Promise.resolve({ ok: false, error: "implausible" });
    const replay = replayArcade(session.game, session.seed, inputs, steps);
    if (!replay.valid || !replay.over || replay.score !== score) return Promise.resolve({ ok: false, error: "implausible" });

    const run = this.saving.then(() => this.save(who, session.game, score, now));
    this.saving = run.catch(() => undefined);
    return run;
  }

  private async save(who: ArcadeWho, game: ArcadeGame, score: number, now: number): Promise<ArcadeResult> {
    const repo = this.deps.repo();
    // El mejor del día antes de esta partida (para avisar "¡lo mejor de hoy!").
    const dayBest = (await repo.arcadeBoard({ game, since: dayStart(now), limit: 1 }).catch(() => []))[0]?.score ?? 0;
    let saved: { firstToday: boolean; weekBest: number; weekBestUserId: string | null };
    try {
      saved = await repo.saveArcadeScore({ userId: who.userId, name: who.name, game, score, dayStart: dayStart(now), weekStart: weekStart(now) });
    } catch (err) {
      console.error("saveArcadeScore", err);
      return { ok: false, error: "failed" };
    }
    this.boards.delete(game);
    const record = score > 0 && score > saved.weekBest;
    // Subir el propio récord no paga (si no, se cobra de a un punto) y el récord pide un mínimo.
    const recordPrize = record && saved.weekBestUserId !== who.userId && score >= ARCADE_RECORD_MIN[game];
    const prize = (saved.firstToday ? ARCADE.firstGameReward : 0) + (recordPrize ? ARCADE.recordReward : 0);
    const awarded = prize > 0 ? await this.deps.award(who.userId, prize) : 0;
    const boards = await this.boardsOf(game, now).catch(() => ({ week: [], today: [] }));
    return { ok: true, game, score, awarded, record, bestToday: score > 0 && score > dayBest, firstToday: saved.firstToday, board: boards.week, today: boards.today };
  }

  /** Cuántas partidas abiertas hay (para los tests). */
  get open() {
    return this.sessions.size;
  }

  /** Las partidas vencidas no hacen falta: sin esto el mapa crece con cada persona que jugó. */
  private forgetExpired(now: number) {
    if (this.sessions.size < 32) return;
    for (const [userId, s] of this.sessions) if (now - s.startedAt > ARCADE.sessionMs) this.sessions.delete(userId);
  }
}
