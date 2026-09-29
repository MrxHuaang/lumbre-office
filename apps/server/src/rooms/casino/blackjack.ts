// La mesa de blackjack del sótano: 5 asientos, crupier automático y sabot de 6 mazos. Lo decide todo el
// servidor; la carta tapada del crupier no viaja al cliente hasta que se destapa.
import {
  BLACKJACK,
  BlackjackActionMessage,
  BlackjackBetMessage,
  blackjackOutcome,
  blackjackReturn,
  casinoRefId,
  dealerShouldHit,
  handValue,
  HIDDEN_CARD,
  isBlackjack,
  type BlackjackSettled,
  type Card,
  type CasinoResult,
  type CasinoSettingsDTO,
} from "@hyvento/shared";
import { randomInt } from "node:crypto";
import type { GameRepository } from "../../repo/types";
import { BlackjackSeat, type BlackjackState } from "../../state";
import { payoutWithRetry, TableQueue } from "./common";
import type { OpenRounds } from "./recovery";

export interface BlackjackTimings {
  bettingMs: number;
  turnMs: number;
  dealerStepMs: number;
  resultMs: number;
}

interface Deps {
  state: BlackjackState;
  repo: () => GameRepository;
  settings: () => CasinoSettingsDTO;
  later: (ms: number, fn: () => void) => void;
  setPoints: (userId: string, balance: number) => void;
  notify: (userId: string, settled: BlackjackSettled) => void;
  timings: () => BlackjackTimings;
  /** Baraja un sabot nuevo (en los tests, un orden fijo). */
  shuffle: () => Card[];
  /** Rondas abiertas (para devolver lo apostado si la sala se cierra antes de pagar). */
  rounds?: OpenRounds;
}

/** Sabot de 6 mazos barajado con el generador criptográfico (Fisher-Yates). */
export function randomShoe(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < BLACKJACK.decks; d++) for (let c = 0; c < 52; c++) cards.push(c);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

type Player = { userId: string; name: string };

export class BlackjackTable {
  private shoe: Card[] = [];
  /** Cartas reales del crupier (en el estado la segunda va tapada hasta su turno). */
  private dealerCards: Card[] = [];
  /** Cambia en cada turno: un temporizador viejo no planta a nadie. */
  private turnToken = 0;
  /** Apuestas y jugadas de a una (ver `TableQueue`). */
  private readonly queue = new TableQueue();
  /** El pago de la ronda en curso (al cerrar la sala se espera a que termine). */
  private settling: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(private readonly d: Deps) {
    for (let i = 0; i < BLACKJACK.seats; i++) d.state.seats.push(new BlackjackSeat());
    d.rounds?.attach(this);
  }

  private ref(round: number) {
    return this.d.rounds?.ref("blackjack", round) ?? casinoRefId("blackjack", round);
  }

  /** La sala se cierra: no más apuestas; se esperan las que se estaban cobrando y el pago en curso. */
  async close() {
    this.closed = true;
    await this.queue.run(async () => undefined);
    await this.settling;
  }

  private get s() {
    return this.d.state;
  }

  private draw(): Card {
    if (this.shoe.length === 0) this.shoe = this.d.shuffle();
    return this.shoe.pop()!;
  }

  /** Apostar en tu asiento (`seat` = índice de la banqueta donde estás sentado, o null si no lo estás). */
  bet(player: Player, seat: number | null, raw: unknown): Promise<CasinoResult | null> {
    return this.queue.run(() => this.placeBet(player, seat, raw));
  }

  private async placeBet(player: Player, seat: number | null, raw: unknown): Promise<CasinoResult | null> {
    const parsed = BlackjackBetMessage.safeParse(raw);
    if (!parsed.success) return null;
    const settings = this.d.settings();
    if (!settings.enabled) return { ok: false, error: "disabled" };
    if (seat === null) return { ok: false, error: "seat" };
    if ((this.s.phase !== "waiting" && this.s.phase !== "betting") || this.closed) return { ok: false, error: "closed" };
    const place = this.s.seats[seat]!;
    if (place.bet > 0) return { ok: false, error: place.userId === player.userId ? "max-bets" : "seat" };

    const round = this.s.round + (this.s.phase === "waiting" ? 1 : 0);
    const { amount } = parsed.data;
    const refId = this.ref(round);
    const outcome = await this.charge(player.userId, amount, refId);
    if (!outcome.ok) return outcome;
    const stillOpen = (this.s.phase === "waiting" || this.s.phase === "betting") && place.bet === 0 && !this.closed;
    if (!stillOpen) {
      await this.refund(player.userId, amount, refId);
      return { ok: false, error: "closed" };
    }
    place.userId = player.userId;
    place.name = player.name;
    place.bet = amount;
    if (this.s.phase === "waiting") {
      this.s.round = round;
      this.s.phase = "betting";
      this.s.endsAt = Date.now() + this.d.timings().bettingMs;
      this.d.later(this.d.timings().bettingMs, () => this.deal());
    }
    return outcome;
  }

  /** Jugada en tu turno. */
  action(player: Player, seat: number | null, raw: unknown): Promise<CasinoResult | null> {
    return this.queue.run(() => this.play(player, seat, raw));
  }

  private async play(player: Player, seat: number | null, raw: unknown): Promise<CasinoResult | null> {
    const parsed = BlackjackActionMessage.safeParse(raw);
    if (!parsed.success) return null;
    const place = seat === null ? undefined : this.s.seats[seat];
    if (this.s.phase !== "playing" || seat === null || this.s.turn !== seat || place?.userId !== player.userId || place.status !== "playing") {
      return { ok: false, error: "turn" };
    }
    const token = this.turnToken;
    const { action } = parsed.data;
    if (action === "double") {
      if (place.cards.length !== 2 || place.doubled) return { ok: false, error: "turn" };
      // Lo que cobra *esta* jugada: si hay que devolver, se devuelve esto y no `place.bet`.
      const extra = place.bet;
      const refId = this.ref(this.s.round);
      const outcome = await this.charge(player.userId, extra, refId);
      if (!outcome.ok) return outcome;
      // Mientras se cobraba pudo vencer el turno (o cerrarse la sala): se devuelve.
      if (token !== this.turnToken || place.doubled || this.closed) {
        await this.refund(player.userId, extra, refId);
        return { ok: false, error: "turn" };
      }
      place.bet += extra;
      place.doubled = true;
      place.cards.push(this.draw());
      place.status = handValue([...place.cards]).total > 21 ? "bust" : "stand";
      this.nextTurn();
      return outcome;
    }
    if (action === "hit") {
      place.cards.push(this.draw());
      const total = handValue([...place.cards]).total;
      if (total > 21) place.status = "bust";
      else if (total === 21) place.status = "stand";
      if (place.status !== "playing") this.nextTurn();
      else this.startTurnTimer();
      return null; // el estado de la mesa ya lo muestra
    }
    place.status = "stand";
    this.nextTurn();
    return null;
  }

  private async charge(userId: string, amount: number, refId: string): Promise<CasinoResult> {
    // La ronda queda anotada antes de cobrar: si el servidor se cae, la próxima corrida la devuelve.
    if (this.d.rounds && !(await this.d.rounds.opening(refId))) return { ok: false, error: this.closed ? "closed" : "failed" };
    try {
      const outcome = await this.d.repo().casinoBet({ userId, amount, refId });
      this.d.setPoints(userId, outcome.balance);
      return outcome.ok ? { ok: true, balance: outcome.balance } : { ok: false, error: outcome.error };
    } catch (err) {
      console.error("casinoBet", err);
      return { ok: false, error: "failed" };
    }
  }

  private async refund(userId: string, amount: number, refId: string) {
    const paid = await payoutWithRetry(this.d.repo, { userId, amount, refId }, "devolución");
    if (paid) this.d.setPoints(userId, paid.balance);
  }

  private deal() {
    const players = [...this.s.seats].filter((p) => p.bet > 0);
    if (players.length === 0) {
      this.s.phase = "waiting";
      return;
    }
    if (this.shoe.length < BLACKJACK.reshuffleAt) this.shoe = this.d.shuffle();
    // Como en la mesa: una carta a cada quien, una al crupier, la segunda a cada quien y la tapada.
    for (const p of players) p.cards.push(this.draw());
    this.dealerCards = [this.draw()];
    for (const p of players) p.cards.push(this.draw());
    this.dealerCards.push(this.draw());
    this.s.dealer.clear();
    this.s.dealer.push(this.dealerCards[0]!, HIDDEN_CARD);
    for (const p of players) p.status = isBlackjack([...p.cards]) ? "blackjack" : "playing";
    this.s.phase = "playing";
    this.s.turn = -1;
    this.nextTurn();
  }

  /** Pasa al siguiente asiento que tiene que jugar, o al crupier si ya jugaron todos. */
  private nextTurn() {
    const seats = this.s.seats;
    let i = this.s.turn + 1;
    while (i < seats.length && seats[i]!.status !== "playing") i++;
    if (i < seats.length) {
      this.s.turn = i;
      this.startTurnTimer();
      return;
    }
    this.s.turn = -1;
    this.turnToken++;
    this.dealerPlays();
  }

  /** Cada turno tiene su tiempo; si vence, la persona se planta. */
  private startTurnTimer() {
    const token = ++this.turnToken;
    const seat = this.s.turn;
    this.s.endsAt = Date.now() + this.d.timings().turnMs;
    this.d.later(this.d.timings().turnMs, () => {
      if (token !== this.turnToken || this.s.turn !== seat) return;
      this.s.seats[seat]!.status = "stand";
      this.nextTurn();
    });
  }

  /** El crupier destapa y pide hasta 17 (si alguien sigue en juego), de a una carta para que se vea. */
  private dealerPlays() {
    this.s.phase = "dealer";
    this.s.dealer.clear();
    this.s.dealer.push(...this.dealerCards);
    const alive = [...this.s.seats].some((p) => p.status === "stand" || p.status === "blackjack");
    const step = () => {
      if (alive && dealerShouldHit(this.dealerCards)) {
        const card = this.draw();
        this.dealerCards.push(card);
        this.s.dealer.push(card);
        this.d.later(this.d.timings().dealerStepMs, step);
        return;
      }
      this.settling = this.settle();
    };
    this.d.later(this.d.timings().dealerStepMs, step);
  }

  private async settle() {
    const round = this.s.round;
    this.s.phase = "result";
    this.s.endsAt = Date.now() + this.d.timings().resultMs;
    this.d.later(this.d.timings().resultMs, () => this.reset());
    // Primero se calcula todo: mientras se paga (con reintentos) la mesa puede reiniciarse.
    const results = [...this.s.seats]
      .filter((p) => p.bet > 0)
      .map((p) => {
        const outcome = blackjackOutcome([...p.cards], this.dealerCards);
        const won = blackjackReturn(outcome, p.bet);
        p.outcome = outcome;
        p.payout = won;
        return { userId: p.userId, outcome, won, staked: p.bet };
      });
    for (const r of results) {
      if (r.won > 0) {
        const paid = await payoutWithRetry(this.d.repo, { userId: r.userId, amount: r.won, refId: this.ref(round) }, "premio");
        if (paid) this.d.setPoints(r.userId, paid.balance);
      }
      this.d.notify(r.userId, { round, outcome: r.outcome, won: r.won, staked: r.staked });
    }
    this.d.rounds?.settled(this.ref(round));
  }

  private reset() {
    for (const p of this.s.seats) {
      p.userId = "";
      p.name = "";
      p.bet = 0;
      p.cards.clear();
      p.status = "";
      p.doubled = false;
      p.outcome = "";
      p.payout = 0;
    }
    this.s.dealer.clear();
    this.dealerCards = [];
    this.s.turn = -1;
    this.s.phase = "waiting";
  }
}
