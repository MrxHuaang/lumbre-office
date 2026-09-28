// Propinas en el tubo del club: quien mira desde el escenario le tira billetes a quien baila. El servidor
// valida (que baile de verdad, la distancia, la pausa) y mueve los puntos en una transacción del
// repositorio (el saldo y los topes diarios se revisan ahí); todos los del nivel ven volar los billetes.
import { zoneAt, type OfficeMap, type PlacedFurniture } from "@hyvento/map";
import { CLUB, CLUB_TIP, ClubTipMessage, dayStart, MSG, poleKey, tipRefId, type ClubTipError, type ClubTipEvent, type TipAmount } from "@hyvento/shared";
import type { GameRepository } from "../repo/types";
import type { ClubState } from "../state";

/** Lo que la propina necesita saber de cada persona (un `Player` del estado). */
export interface TipPlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
}

export interface ClubTipsDeps {
  player(sessionId: string): TipPlayer | undefined;
  map(area: string): OfficeMap;
  repo(): GameRepository;
  /** Cambió el saldo de alguien (la sala lo copia a sus `Player`). */
  setPoints(userId: string, balance: number): void;
  toArea(area: string, type: string, message: unknown): void;
  toSession(sessionId: string, type: string, message: unknown): void;
  now(): number;
  newId(): string;
  /** Salió una propina (para los logros de quien la tira y de quien baila). */
  tipped?(fromId: string, toId: string, amount: number): void;
}

/** El tubo con esa llave, si está en el club. */
export function poleByKey(map: OfficeMap, key: string): PlacedFurniture | undefined {
  if (map.id !== CLUB.area) return undefined;
  return map.furniture.find((f) => f.type === "dance-pole" && poleKey(f.x, f.y) === key);
}

/** ¿Llega a tirarle billetes a quien baila en `pole` desde (x, y)? Dentro del club y cerca de la tarima. */
export function inTipReach(map: OfficeMap, pole: PlacedFurniture, x: number, y: number): boolean {
  const ts = map.tileSize;
  if (map.id !== CLUB.area || zoneAt(map, x, y)?.id !== CLUB.zone) return false;
  return Math.hypot((pole.x + pole.w / 2) * ts - x, (pole.y + pole.d / 2) * ts - y) <= CLUB_TIP.reachPx;
}

export class ClubTips {
  /** Cuándo puede volver a tirar cada persona (se marca antes de ir a la base: la ráfaga no pasa). */
  private tipAt = new Map<string, number>();
  /** Lo que recibió cada quien hoy (para "la que más recibió"); se vacía al cambiar el día de Bogotá. */
  private received = new Map<string, { name: string; total: number }>();
  private day = 0;

  constructor(
    private readonly state: ClubState,
    private readonly deps: ClubTipsDeps,
  ) {}

  async tip(sessionId: string, raw: unknown): Promise<void> {
    const fail = (error: ClubTipError) => this.deps.toSession(sessionId, MSG.clubTipResult, { ok: false, error });
    const parsed = ClubTipMessage.safeParse(raw);
    const me = this.deps.player(sessionId);
    if (!me) return;
    if (!parsed.success) return fail("invalid");
    const { to, amount } = parsed.data;
    const target = this.deps.player(to);
    if (to === sessionId || target?.userId === me.userId) return fail("self");
    const dancer = this.state.dancers.get(to);
    if (!target || dancer?.kind !== "pole") return fail("not-dancing");
    const map = this.deps.map(target.area);
    const pole = poleByKey(map, dancer.move);
    if (!pole || me.area !== target.area || !inTipReach(map, pole, me.x, me.y)) return fail("far");
    const now = this.deps.now();
    if (now < (this.tipAt.get(me.userId) ?? 0)) return fail("busy");
    this.tipAt.set(me.userId, now + CLUB_TIP.cooldownMs);
    // Las pausas viejas ya no frenan nada: se sacan para que el mapa no crezca mientras la sala vive.
    for (const [k, at] of this.tipAt) if (at < now) this.tipAt.delete(k);

    let result: Awaited<ReturnType<GameRepository["tip"]>>;
    try {
      result = await this.deps.repo().tip({ refId: tipRefId(this.deps.newId()), fromId: me.userId, toId: target.userId, amount });
    } catch (err) {
      console.error("clubTip", err);
      return fail("failed");
    }
    if (!result.ok) return fail(result.error);
    for (const [userId, balance] of Object.entries(result.balances)) this.deps.setPoints(userId, balance);
    this.count(me.name, target.userId, target.name, amount, now);
    this.deps.tipped?.(me.userId, target.userId, amount);
    const event: ClubTipEvent = { fromSessionId: sessionId, fromName: me.name, toSessionId: to, toName: target.name, amount: amount as TipAmount, pole: dancer.move };
    this.deps.toArea(target.area, MSG.clubTipped, event);
  }

  /** Las marcas del día: la mayor propina y quién recibió más (se ven en el panel del club). */
  private count(fromName: string, toId: string, toName: string, amount: number, now: number) {
    const s = this.state.tips;
    const day = dayStart(now);
    if (day !== this.day) {
      this.day = day;
      this.received.clear();
      s.best = 0;
      s.bestFrom = "";
      s.bestTo = "";
      s.topName = "";
      s.topTotal = 0;
    }
    if (amount > s.best) {
      s.best = amount;
      s.bestFrom = fromName;
      s.bestTo = toName;
    }
    const r = this.received.get(toId) ?? { name: toName, total: 0 };
    r.name = toName;
    r.total += amount;
    this.received.set(toId, r);
    if (r.total > s.topTotal) {
      s.topTotal = r.total;
      s.topName = r.name;
    }
  }
}
