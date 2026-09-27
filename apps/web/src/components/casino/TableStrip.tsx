"use client";

// La tira del modo mesa: lo único que queda en pantalla mientras se juega sobre la mesa (el juego se
// ve en el mundo, dibujado por game/table). Fichas para elegir, saldo, cuenta regresiva o turno, los
// botones del blackjack y "Levantarse" (o Esc), que devuelve la cámara.
import { BLACKJACK_SEATS, TILE_SIZE } from "@hyvento/map";
import { chipStack, CHIP_VALUES } from "@hyvento/map/art";
import { CASINO, colorOf } from "@hyvento/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { rouletteRemaining, useCasinoStore } from "@/game/casino";
import { getRoom, sendBlackjackAction, sendBlackjackBet } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { useMyPoints } from "../PointsPanels";
import { ArtImage, PixelNumber } from "./PixelArt";

/** Colores de las casillas del historial (los del paño). */
const TILE = { red: "#983a3c", black: "#2b2331", green: "#2e5a40" } as const;
const CREAM = "#fffaf0";

/** Milisegundos que le quedan a la fase de una mesa (se refresca 4 veces por segundo). */
function useRemaining(t: { endsAt: number }) {
  const offset = useCasinoStore((s) => s.offset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return rouletteRemaining(t, offset, now);
}

/**
 * Mide cuánto tapa la tira desde abajo de la ventana (con los controles de micrófono y cámara) y se lo
 * pasa a la cámara del modo mesa, que centra la mesa en lo que queda libre arriba. En pantallas angostas
 * la tira pasa a varias filas y es más alta.
 */
function useStripHeight() {
  const ref = useRef<HTMLElement>(null);
  const setStripPx = useCasinoStore((s) => s.setStripPx);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const px = Math.round(window.innerHeight - el.getBoundingClientRect().top + 8);
      if (Math.abs(px - useCasinoStore.getState().stripPx) > 2) setStripPx(px);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [setStripPx]);
  return ref;
}

/**
 * Marco común, abajo al centro y encima de los controles de micrófono y cámara (que siguen a mano):
 * una línea chica con datos (`info`) y la fila principal.
 */
function Strip({ children, info, label }: { children: React.ReactNode; info: React.ReactNode; label: string }) {
  const ref = useStripHeight();
  return (
    <section
      ref={ref}
      aria-label={label}
      className="cozy-panel absolute bottom-[4.75rem] left-1/2 z-20 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col gap-1.5 px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] leading-tight text-cozy-ink-soft">{info}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">{children}</div>
    </section>
  );
}

function Divider() {
  return <span aria-hidden className="h-9 w-[3px] bg-cozy-wood max-sm:hidden" />;
}

/** Las cinco fichas: la elegida sube y lleva el recuadro rojo. */
function ChipPicker({ disabled = false }: { disabled?: boolean }) {
  const chip = useCasinoStore((s) => s.chip);
  const setChip = useCasinoStore((s) => s.setChip);
  const points = useMyPoints();
  return (
    <div role="radiogroup" aria-label="Ficha" className="flex items-end gap-1">
      {CHIP_VALUES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={chip === c}
          aria-label={`Ficha de ${c}`}
          title={`Ficha de ${c}`}
          disabled={disabled || points < c}
          onClick={() => setChip(c)}
          className={`grid place-items-center transition-transform duration-100 disabled:opacity-40 ${chip === c ? "-translate-y-1 outline-3 outline-cozy-red" : "hover:-translate-y-0.5"}`}
        >
          <ArtImage id={`ficha-${c}`} make={() => chipStack(c, 2, 3).canvas} scale={2} alt="" />
        </button>
      ))}
    </div>
  );
}

function Balance() {
  const points = useMyPoints();
  return (
    <div className="flex items-center gap-1.5" title="Tu saldo">
      <PixelIcon name="coin" size={16} color="var(--color-cozy-gold)" />
      <PixelNumber value={points} scale={2} color="var(--color-cozy-ink)" label={`${points} puntos`} />
    </div>
  );
}

function LeaveButton({ text }: { text: string }) {
  const closePanel = useOfficeStore((s) => s.closePanel);
  return (
    <button type="button" onClick={closePanel} className="cozy-btn px-3 py-1.5 text-[14px]">
      {text}
      <kbd className="cozy-kbd">Esc</kbd>
    </button>
  );
}

/** Estado de la mesa: una línea de texto y, si corre el tiempo, los segundos en grande. */
function Status({ text, seconds, children }: { text: string; seconds?: number; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-[9rem] items-center gap-2" aria-live="polite">
      {seconds !== undefined && (
        <span className="grid h-9 min-w-9 place-items-center border-2 border-cozy-frame bg-[#2e5a40] px-1">
          <PixelNumber value={seconds} scale={2} color={seconds <= 5 ? "#f3d672" : CREAM} label={`${seconds} segundos`} />
        </span>
      )}
      {children}
      <span className="text-[14px] leading-tight">{text}</span>
    </div>
  );
}

/** Casilla de color con un número (historial y resultado). */
function NumberTile({ n, big = false, latest = false }: { n: number; big?: boolean; latest?: boolean }) {
  return (
    <span
      className={`grid place-items-center border-2 ${latest ? "border-cozy-gold" : "border-cozy-frame"} ${big ? "h-9 min-w-9 px-1" : "h-6 min-w-6 px-0.5"}`}
      style={{ background: TILE[colorOf(n)] }}
    >
      <PixelNumber value={n} scale={big ? 2 : 1} color={CREAM} />
    </span>
  );
}

// ---------- Ruleta ----------

export function RouletteStrip() {
  const r = useCasinoStore((s) => s.roulette);
  const me = useOfficeStore(selectMyUserId);
  const remaining = useRemaining(r);
  const seconds = Math.ceil(remaining / 1000);
  const mine = r.bets.filter((b) => b.userId === me);
  const staked = mine.reduce((a, b) => a + b.amount, 0);
  const players = new Set(r.bets.map((b) => b.userId)).size;

  let status: React.ReactNode;
  if (r.phase === "betting" && seconds > 0) status = <Status text={mine.length ? "Hagan sus apuestas" : "Toca el paño para apostar"} seconds={seconds} />;
  else if (r.phase === "spinning" || r.phase === "betting") status = <Status text="¡No va más!" />;
  else status = <Status text={r.result >= 0 ? `Salió el ${r.result}` : "…"}>{r.result >= 0 && <NumberTile n={r.result} big latest />}</Status>;

  const info = (
    <>
      <span className="flex items-center gap-1" aria-label="Últimos números">
        Últimos:
        {r.history.length === 0 ? " —" : r.history.slice(0, 8).map((n, i) => <NumberTile key={`${r.round}-${i}`} n={n} latest={i === 0} />)}
      </span>
      <span>
        Tu apuesta: <b className="text-cozy-ink">{staked}</b>
        {mine.length > 0 && ` (${mine.length}/${CASINO.roulette.maxBetsPerRound})`}
      </span>
      <span>{players === 0 ? "Nadie ha apostado" : players === 1 ? "1 persona apostando" : `${players} personas apostando`}</span>
    </>
  );
  return (
    <Strip label="Mesa de ruleta" info={info}>
      <ChipPicker disabled={r.phase !== "betting"} />
      <Divider />
      <Balance />
      <Divider />
      {status}
      <LeaveButton text="Levantarse" />
    </Strip>
  );
}

// ---------- Blackjack ----------

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

export function BlackjackStrip() {
  const t = useCasinoStore((s) => s.blackjack);
  const chip = useCasinoStore((s) => s.chip);
  const me = useOfficeStore(selectMyUserId);
  const mySeat = useMySeat();
  const points = useMyPoints();
  const remaining = useRemaining(t);
  const seconds = Math.ceil(remaining / 1000);

  const seat = mySeat === null ? undefined : t.seats[mySeat];
  const canBet = mySeat !== null && (t.phase === "waiting" || t.phase === "betting") && (seat?.bet ?? 0) === 0;
  const myTurn = mySeat !== null && t.phase === "playing" && t.turn === mySeat && seat?.userId === me;
  const canDouble = myTurn && seat!.cards.length === 2 && !seat!.doubled && points >= seat!.bet;

  let status: React.ReactNode;
  switch (t.phase) {
    case "waiting":
      status = <Status text={mySeat === null ? "Siéntate en una banqueta" : "Apuesta para empezar la mano"} />;
      break;
    case "betting":
      status = <Status text="Hagan sus apuestas" seconds={seconds} />;
      break;
    case "playing":
      status = <Status text={myTurn ? "¡Tu turno!" : `Juega el asiento ${t.turn + 1}`} seconds={seconds} />;
      break;
    case "dealer":
      status = <Status text="Juega el crupier…" />;
      break;
    case "result":
      status = <Status text="Resultado de la mano" />;
      break;
  }

  const info = (
    <>
      <span>El crupier pide hasta 16 y se planta con 17 · el blackjack paga 3 a 2 · sin seguro ni división</span>
      {seat && seat.bet > 0 && (
        <span>
          Apuesta: <b className="text-cozy-ink">{seat.bet}</b>
          {seat.doubled ? " (doblada)" : ""}
        </span>
      )}
    </>
  );
  return (
    <Strip label="Mesa de blackjack" info={info}>
      {myTurn ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => sendBlackjackAction("hit")} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[14px]">
            Pedir
          </button>
          <button type="button" onClick={() => sendBlackjackAction("stand")} className="cozy-btn px-3 py-1.5 text-[14px]">
            Plantarse
          </button>
          <button
            type="button"
            disabled={!canDouble}
            onClick={() => sendBlackjackAction("double")}
            className="cozy-btn px-3 py-1.5 text-[14px]"
            title="Duplica la apuesta y recibe una sola carta más"
          >
            Doblar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <ChipPicker disabled={!canBet} />
          <button type="button" disabled={!canBet || points < chip} onClick={() => sendBlackjackBet(chip)} className="cozy-btn cozy-btn-primary px-3 py-1.5 text-[14px]">
            Apostar
            <PixelNumber value={chip} scale={1} color="currentColor" />
          </button>
        </div>
      )}
      <Divider />
      <Balance />
      <Divider />
      {status}
      <LeaveButton text="Levantarse" />
    </Strip>
  );
}
