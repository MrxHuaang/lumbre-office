// El escenario del jardín: quién está en la tarima (dos como mucho), la fila de turnos de las gradas, la
// palabra y los aplausos. La proximidad especial (la tarima se oye en todo el anfiteatro) la calcula cada
// cliente con `stageRole` y la zona que pone el servidor; aquí se valida lo que la hace posible.
import { nearPointOfType, zoneAt, type OfficeMap } from "@hyvento/map";
import { ESCENARIO, inAmphitheater, type EscenarioNoticeCode } from "@hyvento/shared";
import { StageHand, type StageState } from "../state";

/** Lo que se necesita saber de cada jugador (un `Player` del estado sirve). */
export interface StagePlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  zoneId: string;
  seated: boolean;
}

export type StagePlayers = Iterable<[sessionId: string, player: StagePlayer]>;

export type StageMove = { ok: true; x: number; y: number } | { ok: false; code: EscenarioNoticeCode };
export type StageOutcome = { ok: true } | { ok: false; code: EscenarioNoticeCode };

const OK: StageOutcome = { ok: true };
const fail = (code: EscenarioNoticeCode): { ok: false; code: EscenarioNoticeCode } => ({ ok: false, code });

const inZone = (p: StagePlayer, zone: string) => p.area === ESCENARIO.area && p.zoneId === zone;

export class Escenario {
  /** Último aplauso y último cambio de mano de cada persona (pausas), y los aplausos recientes. */
  private clapAt = new Map<string, number>();
  private handAt = new Map<string, number>();
  private claps: { userId: string; at: number }[] = [];

  constructor(private readonly state: StageState) {}

  /** Cuántos hay en la tarima (sin contar a `except`). */
  onStage(players: StagePlayers, except?: string): number {
    let n = 0;
    for (const [id, p] of players) if (id !== except && inZone(p, ESCENARIO.stageZone)) n++;
    return n;
  }

  /** ¿Puede pisar (x, y)? A la tarima no sube un tercero; los que ya están se mueven libres. */
  canEnter(map: OfficeMap, sessionId: string, who: StagePlayer, x: number, y: number, players: StagePlayers): boolean {
    if (map.id !== ESCENARIO.area || who.zoneId === ESCENARIO.stageZone) return true;
    if (zoneAt(map, x, y)?.id !== ESCENARIO.stageZone) return true;
    return this.onStage(players, sessionId) < ESCENARIO.maxOnStage;
  }

  /**
   * "E · Subir al escenario" junto a la escalerita (lo deja en el lugar libre de la tarima más cerca del
   * atril) o bajar (lo deja al pie de la escalerita). `taken` dice si alguien más está parado ahí.
   */
  move(map: OfficeMap, sessionId: string, who: StagePlayer, on: boolean, players: StagePlayers, taken: (x: number, y: number) => boolean): StageMove {
    if (map.id !== ESCENARIO.area || who.area !== ESCENARIO.area) return fail("far");
    if (who.seated) return fail("seated");
    const ts = map.tileSize;
    const point = map.points.find((p) => p.type === ESCENARIO.stagePoint);
    const zone = map.zones.find((z) => z.id === ESCENARIO.stageZone);
    if (!point || !zone) return fail("far");
    if (!on) {
      if (who.zoneId !== ESCENARIO.stageZone) return fail("notStage");
      return { ok: true, x: point.x, y: point.y };
    }
    if (who.zoneId === ESCENARIO.stageZone) return fail("onStage");
    if (!nearPointOfType(map, ESCENARIO.stagePoint, who.x, who.y)) return fail("far");
    if (this.onStage(players, sessionId) >= ESCENARIO.maxOnStage) return fail("full");
    const spots: { x: number; y: number }[] = [];
    for (let ty = zone.y / ts; ty < (zone.y + zone.height) / ts; ty++)
      for (let tx = zone.x / ts; tx < (zone.x + zone.width) / ts; tx++) {
        if (map.blocked[ty * map.width + tx]) continue;
        spots.push({ x: tx * ts + ts / 2, y: ty * ts + ts / 2 });
      }
    // Primero junto a la escalerita (y al atril), después hacia las puntas.
    spots.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
    const spot = spots.find((s) => !taken(s.x, s.y));
    return spot ? { ok: true, ...spot } : fail("full");
  }

  /** Levantar la mano (solo en las gradas: queda al final de la fila) o bajarla (en cualquier lado). */
  hand(sessionId: string, who: StagePlayer, up: boolean, now: number): StageOutcome {
    const i = this.state.hands.findIndex((h) => h.userId === who.userId);
    if (!up) {
      if (i >= 0) this.state.hands.splice(i, 1);
      return OK;
    }
    if (!inZone(who, ESCENARIO.seatsZone)) return fail("notSeats");
    if (i >= 0) return OK;
    if (now - (this.handAt.get(who.userId) ?? -Infinity) < ESCENARIO.handCooldownMs) return OK;
    this.handAt.set(who.userId, now);
    const h = new StageHand();
    h.sessionId = sessionId;
    h.userId = who.userId;
    h.name = who.name;
    h.at = now;
    this.state.hands.push(h);
    return OK;
  }

  /** Desde la tarima: darle la palabra a alguien de las gradas (se le baja la mano) o quitarla (null). */
  floor(who: StagePlayer, target: string | null, players: StagePlayers): StageOutcome {
    if (!inZone(who, ESCENARIO.stageZone)) return fail("notSpeaker");
    if (target === null) {
      this.state.floor = "";
      this.state.floorName = "";
      return OK;
    }
    let person: StagePlayer | undefined;
    for (const [, p] of players) if (p.userId === target && inZone(p, ESCENARIO.seatsZone)) person = p;
    if (!person) return fail("notInSeats");
    this.state.floor = person.userId;
    this.state.floorName = person.name;
    const i = this.state.hands.findIndex((h) => h.userId === person!.userId);
    if (i >= 0) this.state.hands.splice(i, 1);
    return OK;
  }

  /** Aplaudir en el anfiteatro: devuelve cuántas personas distintas aplauden ahora (o null si no se pudo). */
  clap(who: StagePlayer, now: number): number | null {
    if (who.area !== ESCENARIO.area || !inAmphitheater(who.zoneId)) return null;
    if (now - (this.clapAt.get(who.userId) ?? -Infinity) < ESCENARIO.clapCooldownMs) return null;
    this.clapAt.set(who.userId, now);
    this.claps = this.claps.filter((c) => now - c.at < ESCENARIO.crowdWindowMs && c.userId !== who.userId);
    this.claps.push({ userId: who.userId, at: now });
    return this.claps.length;
  }

  /**
   * Cada tanto (y al salir alguien): la mano de quien dejó las gradas se baja, y la palabra se pierde si
   * quien la tiene se fue de las gradas o ya no queda nadie en la tarima.
   */
  sweep(players: StagePlayers) {
    const list = [...players];
    const bySession = new Map(list);
    for (let i = this.state.hands.length - 1; i >= 0; i--) {
      const p = bySession.get(this.state.hands[i]!.sessionId);
      if (!p || !inZone(p, ESCENARIO.seatsZone)) this.state.hands.splice(i, 1);
    }
    if (this.state.floor) {
      const holder = list.some(([, p]) => p.userId === this.state.floor && inZone(p, ESCENARIO.seatsZone));
      const speaker = list.some(([, p]) => inZone(p, ESCENARIO.stageZone));
      if (!holder || !speaker) {
        this.state.floor = "";
        this.state.floorName = "";
      }
    }
  }

  forget(userId: string) {
    this.clapAt.delete(userId);
    this.handAt.delete(userId);
  }
}
