// Arcade del sótano: una partida por persona. Al empezar (parada delante de la máquina) el servidor da
// una semilla y anota la hora; al terminar valida el puntaje con su propio reloj (duración mínima y lo
// máximo posible por segundo), lo guarda en el repositorio y reparte el premio de ocio si corresponde.
import { INTERACT_REACH_TILES, pointsOfType, type OfficeMap } from "@hyvento/map";
import {
  ARCADE,
  ArcadeBoardMessage,
  ArcadeFinishMessage,
  arcadeGameOf,
  ArcadeStartMessage,
  dayStart,
  plausibleScore,
  weekStart,
  type ArcadeBoard,
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
}

/** ¿Está (x, y) delante de la máquina `machine` (su punto "arcade", en el orden de las máquinas)? */
export function atMachine(map: OfficeMap, machine: number, x: number, y: number): boolean {
  const p = pointsOfType(map, "arcade")[machine];
  return Boolean(p) && Math.hypot(p!.x - x, p!.y - y) <= INTERACT_REACH_TILES * map.tileSize;
}

export class Arcade {
  /** La partida abierta de cada persona (una sola: empezar otra reemplaza la anterior). */
  private sessions = new Map<string, Session>();

  constructor(private readonly deps: ArcadeDeps) {}

  /** Tabla de récords de la semana del juego de esa máquina. */
  async board(raw: unknown, now: number): Promise<ArcadeBoard | null> {
    const parsed = ArcadeBoardMessage.safeParse(raw);
    const game = parsed.success ? arcadeGameOf(parsed.data.machine) : null;
    if (!parsed.success || !game) return null;
    const board = await this.deps.repo().arcadeBoard({ game, since: weekStart(now), limit: ARCADE.boardSize });
    return { machine: parsed.data.machine, game, board };
  }

  /** Empieza una partida: hay que estar delante de una máquina que funcione. */
  start(map: OfficeMap, who: ArcadeWho, raw: unknown, now: number): ArcadeStarted | { ok: false; error: "far" | "invalid" } {
    const parsed = ArcadeStartMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const { machine } = parsed.data;
    const game = arcadeGameOf(machine);
    if (!game) return { ok: false, error: "invalid" };
    if (map.id !== "sotano" || !atMachine(map, machine, who.x, who.y)) return { ok: false, error: "far" };
    this.forgetExpired(now);
    const session: Session = { token: this.deps.token(), machine, game, seed: this.deps.seed() >>> 0, startedAt: now };
    this.sessions.set(who.userId, session);
    return { machine, game, token: session.token, seed: session.seed };
  }

  /** Termina la partida: valida duración y puntaje, guarda y da el premio (primera del día, récord semanal). */
  async finish(who: ArcadeWho, raw: unknown, now: number): Promise<ArcadeResult> {
    const parsed = ArcadeFinishMessage.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "invalid" };
    const session = this.sessions.get(who.userId);
    if (!session || session.token !== parsed.data.token) return { ok: false, error: "expired" };
    // La partida se cierra pase lo que pase: el mismo token no se puede mandar dos veces.
    this.sessions.delete(who.userId);
    const elapsed = now - session.startedAt;
    if (elapsed > ARCADE.sessionMs) return { ok: false, error: "expired" };
    if (elapsed < ARCADE.minMs) return { ok: false, error: "short" };
    const { score } = parsed.data;
    if (!plausibleScore(session.game, score, elapsed)) return { ok: false, error: "implausible" };

    const repo = this.deps.repo();
    let saved: { firstToday: boolean; weekBest: number };
    try {
      saved = await repo.saveArcadeScore({ userId: who.userId, name: who.name, game: session.game, score, dayStart: dayStart(now), weekStart: weekStart(now) });
    } catch (err) {
      console.error("saveArcadeScore", err);
      return { ok: false, error: "failed" };
    }
    const record = score > 0 && score > saved.weekBest;
    const prize = (saved.firstToday ? ARCADE.firstGameReward : 0) + (record ? ARCADE.recordReward : 0);
    const awarded = prize > 0 ? await this.deps.award(who.userId, prize) : 0;
    const board = await repo.arcadeBoard({ game: session.game, since: weekStart(now), limit: ARCADE.boardSize }).catch(() => []);
    return { ok: true, game: session.game, score, awarded, record, firstToday: saved.firstToday, board };
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
