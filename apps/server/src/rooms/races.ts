// Carrera de sillas (chair-race.ts de @hyvento/shared): se larga junto a la bandera del pasillo del piso
// 2 y termina al cruzar la meta. El tiempo lo cuenta el reloj del servidor; salirse del carril, sentarse,
// cambiar de nivel o tardar demasiado la anulan.
import { nearPointOfType, type OfficeMap } from "@hyvento/map";
import { CHAIR_RACE, inRaceLane, minRaceMs, PLAYER_SPEED, type RaceProblem } from "@hyvento/shared";

/** Lo que la carrera necesita saber del jugador (y lo único que toca: `racing`). */
export interface Racer {
  userId: string;
  area: string;
  x: number;
  y: number;
  seated: boolean;
  racing: boolean;
}

export type RaceOutcome = { kind: "finish"; ms: number } | { kind: "cancel"; problem: RaceProblem } | null;

export class ChairRaces {
  private started = new Map<string, { at: number; fromX: number }>();
  private nextAt = new Map<string, number>();

  /** Largar: junto a la salida, de pie y sin estar corriendo ya. Devuelve el problema o null. */
  start(map: OfficeMap, sessionId: string, p: Racer, now: number): RaceProblem | null {
    if (p.area !== CHAIR_RACE.area || map.id !== CHAIR_RACE.area || !nearPointOfType(map, CHAIR_RACE.point, p.x, p.y)) return "far";
    if (p.seated) return "seated";
    if (p.racing || now < (this.nextAt.get(p.userId) ?? 0)) return "busy";
    this.nextAt.set(p.userId, now + CHAIR_RACE.cooldownMs);
    this.started.set(sessionId, { at: now, fromX: p.x });
    p.racing = true;
    return null;
  }

  /** Se movió: ¿llegó a la meta, se salió del carril o se sentó? */
  moved(map: OfficeMap, sessionId: string, p: Racer, now: number): RaceOutcome {
    const race = this.started.get(sessionId);
    if (!race || !p.racing) return null;
    const ts = map.tileSize;
    if (p.area !== CHAIR_RACE.area || p.seated || !inRaceLane(p.x, p.y, ts)) return this.cancel(sessionId, p, "lane");
    if (p.x < CHAIR_RACE.finishX * ts) return now - race.at > CHAIR_RACE.maxMs ? this.cancel(sessionId, p, "timeout") : null;
    const ms = now - race.at;
    this.stop(sessionId, p);
    // El servidor ya limita la velocidad de cada paso; esto atrapa lo que se escape (saltos con lag).
    if (ms < minRaceMs(race.fromX, ts, PLAYER_SPEED)) return { kind: "cancel", problem: "fast" };
    return { kind: "finish", ms };
  }

  /** Cada tanto: las carreras que se pasaron de tiempo. */
  sweep(now: number, players: { get(sessionId: string): Racer | undefined }): [string, RaceOutcome][] {
    const out: [string, RaceOutcome][] = [];
    for (const [id, race] of [...this.started]) {
      const p = players.get(id);
      if (!p) this.started.delete(id);
      else if (now - race.at > CHAIR_RACE.maxMs) out.push([id, this.cancel(id, p, "timeout")]);
    }
    return out;
  }

  cancel(sessionId: string, p: Racer, problem: RaceProblem): RaceOutcome {
    if (!this.started.has(sessionId)) return null;
    this.stop(sessionId, p);
    return { kind: "cancel", problem };
  }

  forget(sessionId: string) {
    this.started.delete(sessionId);
  }

  private stop(sessionId: string, p: Racer) {
    this.started.delete(sessionId);
    p.racing = false;
  }
}
