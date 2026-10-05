// Intercambios en vivo entre dos personas del mismo nivel y cerca: invitar, armar la oferta (puntos y
// objetos de la mochila), "Listo" y un "Confirmar" final. El servidor lo valida todo y lo ejecuta en una
// transacción del repositorio; se cancela si alguien se aleja, se desconecta o cierra.
import {
  giftAllowedToday,
  isStoryItem,
  stackUnits,
  MSG,
  TRADE,
  TradeOfferMessage,
  TradeReadyMessage,
  TradeRequestMessage,
  TradeRespondMessage,
  tradeGap,
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
  /** Cuánto espera una invitación (los tests lo acortan). */
  inviteTimeoutMs?(): number;
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
  /** Se está guardando en la base: cerrarlo ahora no deshace nada, así que el cierre espera a ver cómo sale. */
  executing: boolean;
  /** Pidieron cerrarlo mientras se guardaba: si no se hizo, se cierra con este motivo. */
  pendingClose: TradeCloseReason | null;
}

interface Invite {
  requestId: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
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
    // Las pausas viejas ya no frenan nada: se sacan para que el mapa no crezca mientras la sala vive.
    for (const [k, at] of this.lastInviteAt) if (now - at >= TRADE.requestCooldownMs) this.lastInviteAt.delete(k);
    this.lastInviteAt.set(key, now);
    // Una sola invitación saliente a la vez: la anterior se retira (y se le avisa a quien la tenía).
    for (const inv of [...this.invites.values()]) if (inv.from === from) this.dropInvite(inv, [from]);

    const requestId = randomUUID();
    const timeoutMs = this.deps.inviteTimeoutMs?.() ?? TRADE.requestTimeoutMs;
    const timer = this.deps.later(timeoutMs, () => {
      if (!this.invites.delete(requestId)) return;
      this.closed(from, { id: requestId, reason: "timeout", with: other.name });
    });
    this.invites.set(requestId, { requestId, from, fromName: me.name, to, toName: other.name, timer });
    this.deps.send(to, MSG.tradeInvite, { requestId, fromSessionId: from, fromName: me.name, expiresAt: now + timeoutMs, ttlMs: timeoutMs } satisfies TradeInvite);
  }

  respond(sessionId: string, raw: unknown) {
    const parsed = TradeRespondMessage.safeParse(raw);
    if (!parsed.success) return;
    const invite = this.invites.get(parsed.data.requestId);
    // Aceptar una que ya venció (o que se retiró justo antes): se avisa, si no la tarjeta se va sin más.
    if (!invite || invite.to !== sessionId) return parsed.data.accept ? this.problem(sessionId, "expired") : undefined;
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
    const trade: Trade = {
      id: randomUUID(),
      a: side(invite.from, other),
      b: side(sessionId, me),
      queue: Promise.resolve(),
      closed: false,
      executing: false,
      pendingClose: null,
    };
    this.trades.set(trade.id, trade);
    this.bySession.set(trade.a.sessionId, trade);
    this.bySession.set(trade.b.sessionId, trade);
    // Quien entra a un intercambio deja de esperar respuesta a otras invitaciones.
    // A la otra punta de cada una se le avisa (si no, le queda una tarjeta que ya no lleva a nada).
    const inTrade = [trade.a.sessionId, trade.b.sessionId];
    for (const inv of [...this.invites.values()]) if (inTrade.includes(inv.from) || inTrade.includes(inv.to)) this.dropInvite(inv, inTrade);
    this.broadcast(trade);
  }

  // ---------- Dentro del intercambio ----------

  /** Mi oferta (reemplaza la anterior). Se revisa que tenga los puntos y los objetos. */
  offer(sessionId: string, raw: unknown) {
    const trade = this.bySession.get(sessionId);
    const parsed = TradeOfferMessage.safeParse(raw);
    if (!trade || !parsed.success) return;
    const items = [...parsed.data.items].sort((x, y) => x.itemId.localeCompare(y.itemId));
    // Lo de la historia no cambia de dueño (historia.ts).
    if (items.some((i) => isStoryItem(i.itemId))) return this.problem(sessionId, "story");
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
      // Los topes diarios de dar puntos y muebles (los mismos de los regalos): se avisa ya, y se revalida al confirmar.
      const units = stackUnits(items);
      if (parsed.data.points > side.points || units > stackUnits(side.items)) {
        const given = await repo.givenToday(side.userId);
        if (trade.closed) return;
        const allowed = giftAllowedToday({ gifts: 0, ...given }, parsed.data.points, units);
        if (allowed === "points") return this.problem(sessionId, "limit");
        if (allowed === "items") return this.problem(sessionId, "limit-items");
      }
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
      // Los dos tienen que poner algo: dar sin recibir es un regalo (va por el buzón, con sus topes).
      const gap = tradeGap(trade.a, trade.b);
      if (gap !== "ok") return this.problem(sessionId, gap);
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
    for (const inv of [...this.invites.values()]) if (inv.from === sessionId || inv.to === sessionId) this.dropInvite(inv, [sessionId]);
    for (const key of [...this.lastInviteAt.keys()]) if (key.startsWith(`${sessionId}:`) || key.endsWith(`:${sessionId}`)) this.lastInviteAt.delete(key);
  }

  /** Cuántas pausas entre invitaciones se recuerdan (para los tests). */
  cooldownsTracked(): number {
    return this.lastInviteAt.size;
  }

  // ---------- Internos ----------

  private async execute(trade: Trade) {
    let result;
    // Mientras se guarda, cancelar, alejarse o desconectarse no cierran: la base ya puede haberlo hecho.
    trade.executing = true;
    try {
      result = await this.deps.repo().executeTrade({
        refId: tradeRefId(trade.id),
        a: { userId: trade.a.userId, points: trade.a.points, items: trade.a.items },
        b: { userId: trade.b.userId, points: trade.b.points, items: trade.b.items },
      });
    } catch (err) {
      console.error("executeTrade", err);
      result = null;
    } finally {
      trade.executing = false;
    }
    if (trade.closed) return;
    if ((!result || !result.ok) && trade.pendingClose) return this.close(trade, trade.pendingClose);
    if (!result || !result.ok) {
      // No se movió nada: se vuelve a la oferta para que lo arreglen.
      const who = result ? this.sideByUser(trade, result.userId)?.name : undefined;
      this.unready(trade);
      for (const s of [trade.a, trade.b]) this.problem(s.sessionId, result ? result.error : "failed", who);
      this.broadcast(trade);
      return;
    }
    // Se hizo: aunque alguien haya pedido cerrar en el medio, los dos reciben el "hecho" y el saldo nuevo
    // (a quien se desconectó no le llega nada, pero su saldo ya quedó guardado).
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
    if (trade.executing) {
      trade.pendingClose ??= reason;
      return;
    }
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

  /** Retira una invitación y se lo avisa a las puntas que no están en `quiet` (y siguen conectadas). */
  private dropInvite(inv: Invite, quiet: readonly string[]) {
    inv.timer.clear();
    this.invites.delete(inv.requestId);
    if (!quiet.includes(inv.to) && this.deps.player(inv.to)) this.closed(inv.to, { id: inv.requestId, reason: "cancelled", with: inv.fromName });
    if (!quiet.includes(inv.from) && this.deps.player(inv.from)) this.closed(inv.from, { id: inv.requestId, reason: "cancelled", with: inv.toName });
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
