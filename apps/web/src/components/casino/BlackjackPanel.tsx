"use client";

// Fase 4: la mesa de blackjack del sótano. Se abre al sentarse en una de sus banquetas.
import { BLACKJACK_SEATS, TILE_SIZE } from "@hyvento/map";
import { cardRank, cardSuit, handValue, HIDDEN_CARD, isRedSuit, RANK_LABEL, SUIT_NAMES } from "@hyvento/shared";
import { useEffect, useState } from "react";
import { rouletteRemaining, useCasinoStore, type BlackjackSeatView, type BlackjackView } from "@/game/casino";
import { getRoom, sendBlackjackAction, sendBlackjackBet } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon, type PixelIconName } from "../Cozy";
import { PanelShell, useMyPoints } from "../PointsPanels";

const CHIPS = [1, 5, 10, 25, 50] as const;
const SUIT_ICON: PixelIconName[] = ["spade", "heart", "diamond", "club"];
const OUTCOME_TEXT: Record<string, string> = { blackjack: "¡Blackjack!", win: "Gana", push: "Empate", lose: "Pierde" };

export function BlackjackPanel({ onClose }: { onClose: () => void }) {
  const t = useCasinoStore((s) => s.blackjack);
  const offset = useCasinoStore((s) => s.offset);
  const me = useOfficeStore(selectMyUserId);
  const mySeat = useMySeat();
  const points = useMyPoints();
  const [chip, setChip] = useState<number>(10);
  const remaining = useTick(t, offset);

  const seat = mySeat === null ? undefined : t.seats[mySeat];
  const canBet = mySeat !== null && (t.phase === "waiting" || t.phase === "betting") && (seat?.bet ?? 0) === 0;
  const myTurn = mySeat !== null && t.phase === "playing" && t.turn === mySeat && seat?.userId === me;
  const canDouble = myTurn && seat!.cards.length === 2 && !seat!.doubled && points >= seat!.bet;

  return (
    <PanelShell title="Blackjack" icon="spade" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <p className="text-[16px] font-semibold">{phaseText(t, remaining, myTurn)}</p>

        {/* Crupier */}
        <div className="flex flex-col gap-1.5 border-4 border-[#5a2a1c] bg-[#2e6b45] px-3 py-2.5">
          <span className="text-[13px] text-cozy-paper-light">
            Crupier{t.dealer.length > 0 ? ` · ${handTotal(t.dealer)}` : ""}
          </span>
          <Cards cards={t.dealer} />
        </div>

        {/* Asientos */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {t.seats.map((s, i) => (
            <SeatBox key={i} index={i} seat={s} mine={i === mySeat} turn={t.phase === "playing" && t.turn === i} />
          ))}
        </div>

        {mySeat === null ? (
          <p className="text-[14px] text-cozy-ink-soft">Siéntate en una de las banquetas de la mesa para jugar.</p>
        ) : myTurn ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => sendBlackjackAction("hit")} className="cozy-btn cozy-btn-primary px-4 py-2">
              Pedir carta
            </button>
            <button type="button" onClick={() => sendBlackjackAction("stand")} className="cozy-btn px-4 py-2">
              Plantarse
            </button>
            <button type="button" disabled={!canDouble} onClick={() => sendBlackjackAction("double")} className="cozy-btn px-4 py-2" title="Duplica la apuesta y recibe una sola carta más">
              Doblar
            </button>
          </div>
        ) : canBet ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px]">Apuesta:</span>
            {CHIPS.map((c) => (
              <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)} className="cozy-btn h-9 min-w-9 rounded-full px-2 text-[14px]">
                {c}
              </button>
            ))}
            <button type="button" disabled={points < chip} onClick={() => sendBlackjackBet(chip)} className="cozy-btn cozy-btn-primary px-4 py-2">
              Apostar {chip}
            </button>
            <span className="ml-auto flex items-center gap-1 text-[14px]">
              <PixelIcon name="coin" size={13} color="var(--color-cozy-gold)" />
              {points}
            </span>
          </div>
        ) : (
          <p className="text-[14px] text-cozy-ink-soft">
            {seat && seat.bet > 0 ? `Apostaste ${seat.bet}${seat.doubled ? " (doblada)" : ""}.` : "Espera a la próxima mano para apostar."}
          </p>
        )}

        <p className="text-[12px] text-cozy-ink-soft">
          El crupier pide hasta 17 y se planta con 17. El blackjack paga 3 a 2 y el empate devuelve la apuesta. Sin seguro ni división.
        </p>
      </div>
    </PanelShell>
  );
}

function phaseText(t: BlackjackView, remaining: number, myTurn: boolean): string {
  const s = Math.ceil(remaining / 1000);
  switch (t.phase) {
    case "waiting":
      return "Esperando apuestas";
    case "betting":
      return `Hagan sus apuestas · ${s} s`;
    case "playing":
      return myTurn ? `¡Tu turno! · ${s} s` : `Juega el asiento ${t.turn + 1} · ${s} s`;
    case "dealer":
      return "Juega el crupier…";
    case "result":
      return "Resultado de la mano";
  }
}

function handTotal(cards: number[]): string {
  if (cards.includes(HIDDEN_CARD)) return String(handValue(cards).total);
  const { total, soft } = handValue(cards);
  return total > 21 ? `${total} (se pasó)` : soft && total < 21 ? `${total - 10}/${total}` : String(total);
}

function SeatBox({ index, seat, mine, turn }: { index: number; seat: BlackjackSeatView; mine: boolean; turn: boolean }) {
  const empty = !seat.userId;
  return (
    <div
      className={`flex min-h-28 flex-col gap-1 border-2 px-2 py-1.5 ${turn ? "border-cozy-gold bg-cozy-paper-light" : mine ? "border-cozy-wood bg-cozy-paper-light" : "border-cozy-paper-dark"}`}
    >
      <span className="truncate text-[12px] text-cozy-ink-soft">
        {index + 1}. {empty ? (mine ? "Tú" : "Libre") : seat.name}
        {mine && !empty ? " (tú)" : ""}
      </span>
      {seat.bet > 0 && (
        <span className="flex items-center gap-1 text-[12px]">
          <PixelIcon name="coin" size={11} color="var(--color-cozy-gold)" />
          {seat.bet}
          {seat.cards.length > 0 && <span className="ml-auto font-semibold">{handTotal(seat.cards)}</span>}
        </span>
      )}
      <Cards cards={seat.cards} small />
      {seat.outcome && (
        <span className={`text-[12px] font-semibold ${seat.outcome === "lose" ? "text-cozy-red-deep" : "text-cozy-green"}`}>
          {OUTCOME_TEXT[seat.outcome]}
          {seat.payout > 0 ? ` · ${seat.payout}` : ""}
        </span>
      )}
    </div>
  );
}

/** Cartas en pixel: blancas con el valor y el palo, o el dorso (la tapada del crupier). */
function Cards({ cards, small = false }: { cards: number[]; small?: boolean }) {
  const size = small ? "h-9 w-6.5 text-[11px]" : "h-14 w-10 text-[15px]";
  return (
    <div className="flex flex-wrap gap-1">
      {cards.map((c, i) =>
        c === HIDDEN_CARD ? (
          <span key={i} className={`${size} border-2 border-cozy-frame bg-[repeating-linear-gradient(45deg,#983a3c_0_3px,#c05a4a_3px_6px)]`} aria-label="Carta tapada" />
        ) : (
          <span
            key={i}
            aria-label={`${RANK_LABEL[cardRank(c)]} de ${SUIT_NAMES[cardSuit(c)]}`}
            className={`${size} flex flex-col items-center justify-between border-2 border-cozy-frame bg-[#fffaf0] py-0.5 font-semibold`}
            style={{ color: isRedSuit(c) ? "#c0392b" : "#2b2233" }}
          >
            <span className="leading-none">{RANK_LABEL[cardRank(c)]}</span>
            <PixelIcon name={SUIT_ICON[cardSuit(c)]!} size={small ? 9 : 13} />
          </span>
        ),
      )}
    </div>
  );
}

/** Asiento donde está sentado el jugador local (según su posición y BLACKJACK_SEATS), o null. */
function useMySeat(): number | null {
  const sessionId = useOfficeStore((s) => s.sessionId);
  const area = useOfficeStore((s) => s.area);
  const [seat, setSeat] = useState<number | null>(null);
  useEffect(() => {
    // La posición no está en el store (cambia 60 veces por segundo): se lee de la sala cada tanto.
    const read = () => {
      const p = sessionId ? getRoom()?.state.players.get(sessionId) : undefined;
      if (!p || area !== "sotano" || !p.seated) return setSeat(null);
      const i = BLACKJACK_SEATS.findIndex((s) => s.x === Math.floor(p.x / TILE_SIZE) && s.y === Math.floor(p.y / TILE_SIZE));
      setSeat(i >= 0 ? i : null);
    };
    read();
    const id = setInterval(read, 300);
    return () => clearInterval(id);
  }, [sessionId, area]);
  return seat;
}

function useTick(t: BlackjackView, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return rouletteRemaining(t, offset, now);
}
