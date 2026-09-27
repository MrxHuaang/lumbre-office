// Intercambios en vivo entre dos personas del mismo nivel y cerca: invitar, armar la oferta (puntos y
// objetos de la mochila), "Listo" y un "Confirmar" final. El servidor lo valida todo y lo ejecuta en una
// transacción del repositorio; se cancela si alguien se aleja, se desconecta o cierra.
import {
  MSG,
  TRADE,
  TradeOfferMessage,
  TradeReadyMessage,
  TradeRequestMessage,
  TradeRespondMessage,
  tradeReach,
  tradeRefId,
  type ItemStack,
  type TradeCloseReason,
  type TradeClosed,
  type TradeError,
  type TradeInvite,
  type TradeProblem,
  type TradeSideView,
  type TradeView,
} from "@hyvento/shared";
import { randomUUID } from "node:crypto";
import type { GameRepository } from "../repo/types";

/** Lo que el intercambio necesita saber de cada persona (un `Player` del estado). */
export interface TradePlayer {
  userId: string;
  name: string;
  area: string;
  x: number;
  y: number;
  status: string;
}

export interface TradeDeps {
  player(sessionId: string): TradePlayer | undefined;
  send(sessionId: string, type: string, message: unknown): void;
  repo(): GameRepository;
  /** Cambió el saldo de alguien (la sala lo copia a sus `Player`). */
  setPoints(userId: string, balance: number): void;
  later(ms: number, fn: () => void): { clear(): void };
}

interface Side {
  sessionId: string;
  userId: string;
  name: string;
  points: number;
  items: ItemStack[];
  ready: boolean;
  confirmed: boolean;
}

interface Trade {
  id: string;
  a: Side;
  b: Side;
  /** Las ofertas y la confirmación van de a una (esperan a la base): cada una ve lo que dejó la anterior. */
  queue: Promise<unknown>;
  closed: boolean;
}

interface Invite {
  requestId: string;
  from: string;
  to: string;
  timer: { clear(): void };
}

const sameStacks = (x: readonly ItemStack[], y: readonly ItemStack[]) =>
  x.length === y.length && x.every((it, i) => it.itemId === y[i]!.itemId && it.quantity === y[i]!.quantity);

export class Trades {
  private trades = new Map<string, Trade>();
  /** Sesión → intercambio en el que está (una a la vez). */
  private bySession = new Map<string, Trade>();
  private invites = new Map<string, Invite>();
  /** `${desde}:${hacia}` → última invitación (por sesión). */
  private lastInviteAt = new Map<string, number>();

  constructor(private readonly deps: TradeDeps) {}

  /** ¿Está en un intercambio? (para los tests y para no abrir dos). */
  activeFor(sessionId: string): boolean {
    return this.bySession.has(sessionId);
  }

  // ---------- Invitaciones ----------

  request(from: string, raw: unknown) {
    const parsed = TradeRequestMessage.safeParse(raw);
    const me = this.deps.player(from);
    if (!parsed.success || !me) return;
    const to = parsed.data.sessionId;
    const problem = (error: TradeError) => this.problem(from, error);
    if (to === from) return problem("self");
    const other = this.deps.player(to);
    if (!other || other.userId === me.userId) return problem(other ? "self" : "unknown");
    if (this.bySession.has(from) || this.bySession.has(to)) return problem("busy");
    if (!tradeReach(me, other)) return problem("far");
    if (other.status === "dnd") return problem("dnd");
    const key = `${from}:${to}`;
    const now = Date.now();
    if (now - (this.lastInviteAt.get(key) ?? 0) < TRADE.requestCooldownMs) return problem("too-soon");
    this.lastInviteAt.set(key, now);

    const requestId = randomUUID();
    const timer = this.deps.later(TRADE.requestTimeoutMs, () => {
      if (!this.invites.delete(requestId)) return;
      this.closed(from, { id: requestId, reason: "timeout", with: other.name });
    });
    this.invites.set(requestId, { requestId, from, to, timer });
    this.deps.send(to, MSG.tradeInvite, { requestId, fromSessionId: from, fromName: me.name, expiresAt: now + TRADE.requestTimeoutMs } satisfies TradeInvite);
  }

  respond(sessionId: string, raw: unknown) {
    const parsed = TradeRespondMessage.safeParse(raw);
    if (!parsed.success) return;
    const invite = this.invites.get(parsed.data.requestId);
    if (!invite || invite.to !== sessionId) return;
    invite.timer.clear();
    this.invites.delete(invite.requestId);
    const me = this.deps.player(sessionId);
    const other = this.deps.player(invite.from);
    if (!me) return;
    if (!other) return this.problem(sessionId, "unknown");
    if (!parsed.data.accept) return this.closed(invite.from, { id: invite.requestId, reason: "declined", with: me.name });
    if (this.bySession.has(sessionId) || this.bySession.has(invite.from)) return this.problem(sessionId, "busy");
    if (!tradeReach(me, other)) {
      this.problem(sessionId, "far");
      return this.problem(invite.from, "far");
    }
    const side = (s: string, p: TradePlayer): Side => ({ sessionId: s, userId: p.userId, name: p.name, points: 0, items: [], ready: false, confirmed: false });
    const trade: Trade = { id: randomUUID(), a: side(invite.from, other), b: side(sessionId, me), queue: Promise.resolve(), closed: false };
    this.trades.set(trade.id, trade);
    this.bySession.set(trade.a.sessionId, trade);
    this.bySession.set(trade.b.sessionId, trade);
    // Quien entra a un intercambio deja de esperar respuesta a otras invitaciones.
    for (const inv of [...this.invites.values()]) if ([inv.from, inv.to].some((s) => s === trade.a.sessionId || s === trade.b.sessionId)) this.dropInvite(inv);
    this.broadcast(trade);
  }

  // ---------- Dentro del intercambio ----------

  /** Mi oferta (reemplaza la anterior). Se revisa que tenga los puntos y los objetos. */
  offer(sessionId: string, raw: unknown) {
    const trade = this.bySession.get(sessionId);
    const parsed = TradeOfferMessage.safeParse(raw);
    if (!trade || !parsed.success) return;
    const items = [...parsed.data.items].sort((x, y) => x.itemId.localeCompare(y.itemId));
    return this.serial(trade, async () => {
      if (!this.checkNear(trade)) return;
      const side = this.sideOf(trade, sessionId);
      if (side.points === parsed.data.points && sameStacks(side.items, items)) return;
      const repo = this.deps.repo();
      const [balance, inventory] = await Promise.all([repo.getPoints(side.userId), repo.getInventory(side.userId)]);
      if (trade.closed) return;
      if (parsed.data.points > balance) return this.problem(sessionId, "funds");
      const has = (it: ItemStack) => (inventory.find((e) => e.itemId === it.itemId)?.quantity ?? 0) >= it.quantity;
      if (!items.every(has)) return this.problem(sessionId, "items");
      side.points = parsed.data.points;
      side.items = items;
      this.unready(trade);
      this.broadcast(trade);
    });
  }

  ready(sessionId: string, raw: unknown) {
    const trade = this.bySession.get(sessionId);
    const parsed = TradeReadyMessage.safeParse(raw);
    if (!trade || !parsed.success) return;
    return this.serial(trade, async () => {
      if (!this.checkNear(trade)) return;
      const side = this.sideOf(trade, sessionId);
      if (side.ready === parsed.data.ready) return;
      side.ready = parsed.data.ready;
      // Desmarcar "Listo" también retira las confirmaciones: hay que volver a revisar.
      trade.a.confirmed = trade.b.confirmed = false;
      this.broadcast(trade);
    });
  }

  /** El "Confirmar" final (solo con los dos listos). Cuando confirman los dos, se hace. */
  confirm(sessionId: string) {
    const trade = this.bySession.get(sessionId);
    if (!trade) return;
    return this.serial(trade, async () => {
      if (!this.checkNear(trade) || !trade.a.ready || !trade.b.ready) return;
      const side = this.sideOf(trade, sessionId);
      if (side.confirmed) return;
      const empty = (s: Side) => s.points === 0 && s.items.length === 0;
      if (empty(trade.a) && empty(trade.b)) return this.problem(sessionId, "empty");
      side.confirmed = true;
      if (!trade.a.confirmed || !trade.b.confirmed) return this.broadcast(trade);
      await this.execute(trade);
    });
  }

  cancel(sessionId: string) {
    const trade = this.bySession.get(sessionId);
    if (trade) this.close(trade, "cancelled");
  }

  // ---------- Ganchos de la sala ----------

  /** Alguien se movió o cambió de nivel: si se alejó de con quien intercambia, se cancela. */
  moved(sessionId: string) {
    const trade = this.bySession.get(sessionId);
    if (trade) this.checkNear(trade);
  }

  /** Alguien se fue (o se cortó su conexión): se cancela su intercambio y sus invitaciones. */
  left(sessionId: string) {
    const trade = this.bySession.get(sessionId);
    if (trade) this.close(trade, "left");
    for (const inv of [...this.invites.values()]) if (inv.from === sessionId || inv.to === sessionId) this.dropInvite(inv);
  }

  // ---------- Internos ----------

  private async execute(trade: Trade) {
    let result;
    try {
      result = await this.deps.repo().executeTrade({
        refId: tradeRefId(trade.id),
        a: { userId: trade.a.userId, points: trade.a.points, items: trade.a.items },
        b: { userId: trade.b.userId, points: trade.b.points, items: trade.b.items },
      });
    } catch (err) {
      console.error("executeTrade", err);
      result = null;
    }
    if (trade.closed) return; // se cerró mientras se guardaba (p. ej. se desconectó): ya se avisó
    if (!result || !result.ok) {
      // No se movió nada: se vuelve a la oferta para que lo arreglen.
      const who = result ? this.sideByUser(trade, result.userId)?.name : undefined;
      this.unready(trade);
      for (const s of [trade.a, trade.b]) this.problem(s.sessionId, result ? result.error : "failed", who);
      this.broadcast(trade);
      return;
    }
    for (const [userId, balance] of Object.entries(result.balances)) this.deps.setPoints(userId, balance);
    const bundle = (s: Side) => ({ points: s.points, items: s.items.map((i) => ({ ...i })) });
    this.finish(trade);
    for (const [me, them] of [
      [trade.a, trade.b],
      [trade.b, trade.a],
    ] as const) {
      this.closed(me.sessionId, { id: trade.id, reason: "done", with: them.name, got: bundle(them), gave: bundle(me), balance: result.balances[me.userId] });
    }
  }

  /** Revisa que sigan cerca y en el mismo nivel (y conectados); si no, cancela. */
  private checkNear(trade: Trade): boolean {
    if (trade.closed) return false;
    const a = this.deps.player(trade.a.sessionId);
    const b = this.deps.player(trade.b.sessionId);
    if (!a || !b) {
      this.close(trade, "left");
      return false;
    }
    if (!tradeReach(a, b)) {
      this.close(trade, "far");
      return false;
    }
    return true;
  }

  private close(trade: Trade, reason: TradeCloseReason) {
    if (trade.closed) return;
    this.finish(trade);
    this.closed(trade.a.sessionId, { id: trade.id, reason, with: trade.b.name });
    this.closed(trade.b.sessionId, { id: trade.id, reason, with: trade.a.name });
  }

  private finish(trade: Trade) {
    trade.closed = true;
    this.trades.delete(trade.id);
    if (this.bySession.get(trade.a.sessionId) === trade) this.bySession.delete(trade.a.sessionId);
    if (this.bySession.get(trade.b.sessionId) === trade) this.bySession.delete(trade.b.sessionId);
  }

  private dropInvite(inv: Invite) {
    inv.timer.clear();
    this.invites.delete(inv.requestId);
  }

  private unready(trade: Trade) {
    for (const s of [trade.a, trade.b]) {
      s.ready = false;
      s.confirmed = false;
    }
  }

  private serial(trade: Trade, fn: () => Promise<unknown>) {
    const run = trade.queue.then(fn);
    trade.queue = run.catch((err) => console.error("trade", err));
    return trade.queue;
  }

  private sideOf(trade: Trade, sessionId: string): Side {
    return trade.a.sessionId === sessionId ? trade.a : trade.b;
  }

  private sideByUser(trade: Trade, userId: string): Side | undefined {
    return [trade.a, trade.b].find((s) => s.userId === userId);
  }

  private view(trade: Trade, me: Side): TradeView {
    const them = me === trade.a ? trade.b : trade.a;
    const copy = (s: Side): TradeSideView => ({
      sessionId: s.sessionId,
      name: s.name,
      points: s.points,
      items: s.items.map((i) => ({ ...i })),
      ready: s.ready,
      confirmed: s.confirmed,
    });
    return { id: trade.id, you: copy(me), them: copy(them), stage: trade.a.ready && trade.b.ready ? "confirm" : "offer" };
  }

  private broadcast(trade: Trade) {
    for (const s of [trade.a, trade.b]) this.deps.send(s.sessionId, MSG.tradeUpdate, this.view(trade, s));
  }

  private problem(sessionId: string, error: TradeError, who?: string) {
    this.deps.send(sessionId, MSG.tradeProblem, (who ? { error, who } : { error }) satisfies TradeProblem);
  }

  private closed(sessionId: string, msg: TradeClosed) {
    this.deps.send(sessionId, MSG.tradeClosed, msg);
  }
}
