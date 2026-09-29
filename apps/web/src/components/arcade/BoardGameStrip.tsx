"use client";

// La tira de la mesa de ajedrez o de damas (sala de juegos): mientras la cámara mira la mesa, abajo va el
// tablero en pixel art (clic en tu pieza, se marcan las casillas a las que puede ir, clic en el destino),
// los dos jugadores con su reloj, los botones (listo, reloj, tablas, rendirse) y el ranking de victorias.
// Quien no está sentado en la mesa mira la partida en vivo.
import { BOARD_TABLES, TILE_SIZE, type BoardTableDef } from "@hyvento/map";
import { boardArt, chessPieceArt, checkersPieceArt, squareAtPoint, BOARD_PX } from "@hyvento/map/art";
import {
  BOARD_GAME,
  BOARD_GAME_NAME,
  BOARD_REASON_TEXT,
  BOARD_SIDE_NAME,
  boardClockText,
  decodeBoard,
  legalBoardMoves,
  squareName,
  type BoardMove,
  type BoardSide,
  type ChessPromo,
} from "@hyvento/shared";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  myBoardSide,
  requestBoardRanking,
  sendBoardDraw,
  sendBoardMove,
  sendBoardReady,
  sendBoardResign,
  useBoardGamesStore,
  type BoardSeatView,
  type BoardTableView,
} from "@/game/boardgames";
import { useCasinoStore } from "@/game/casino";
import { getRoom } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { ArtImage } from "../casino/PixelArt";
import { Divider, LeaveButton, Strip } from "../casino/TableStrip";

/** Mesa más cercana a donde estoy (en mi nivel) y la silla donde estoy sentado, o null. */
function useMyTable(): { def: BoardTableDef; seat: BoardSide | null } | null {
  const sessionId = useOfficeStore((s) => s.sessionId);
  const area = useOfficeStore((s) => s.area);
  const [spot, setSpot] = useState<{ def: BoardTableDef; seat: BoardSide | null } | null>(null);
  useEffect(() => {
    // La posición no está en el store (cambia 60 veces por segundo): se lee de la sala cada tanto.
    const read = () => {
      const p = sessionId ? getRoom()?.state.players.get(sessionId) : undefined;
      const here = BOARD_TABLES.filter((t) => t.area === area);
      if (!p || !here.length) return setSpot(null);
      const tx = p.x / TILE_SIZE;
      const ty = p.y / TILE_SIZE;
      const def = [...here].sort((a, b) => Math.hypot(a.x + 0.5 - tx, a.y + 0.5 - ty) - Math.hypot(b.x + 0.5 - tx, b.y + 0.5 - ty))[0]!;
      const i = p.seated ? def.seats.findIndex((s) => s.x === Math.floor(tx) && s.y === Math.floor(ty)) : -1;
      const seat = i === 0 || i === 1 ? i : null;
      setSpot((prev) => (prev?.def.id === def.id && prev.seat === seat ? prev : { def, seat }));
    };
    read();
    const id = setInterval(read, 300);
    return () => clearInterval(id);
  }, [sessionId, area]);
  return spot;
}

/** Hora del servidor que se refresca 4 veces por segundo (para los relojes). */
function useServerNow() {
  const offset = useCasinoStore((s) => s.offset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now + offset;
}

/** Escala del tablero: más grande en pantallas altas. */
function useBoardScale() {
  const [scale, setScale] = useState(2);
  useLayoutEffect(() => {
    const measure = () => setScale(window.innerHeight >= 980 && window.innerWidth >= 900 ? 3 : 2);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return scale;
}

const samePrefix = (path: readonly number[], prefix: readonly number[]) => prefix.every((sq, i) => path[i] === sq);

/** El tablero: se dibuja entero en cada cambio (es chico) y el clic se pasa a la casilla. */
function Board({ t, me }: { t: BoardTableView; me: BoardSide | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = useBoardScale();
  const [sel, setSel] = useState<number[]>([]);
  const [promo, setPromo] = useState<BoardMove | null>(null);
  const pos = useMemo(() => {
    try {
      return decodeBoard(t.game, t.position, t.turn);
    } catch {
      return null;
    }
  }, [t.game, t.position, t.turn]);
  const myTurn = t.phase === "playing" && me !== null && t.turn === me;
  const legal = useMemo(() => (pos && myTurn ? legalBoardMoves(pos) : []), [pos, myTurn]);
  // Llegó otra posición (jugó alguien): se suelta lo elegido.
  useEffect(() => {
    setSel([]);
    setPromo(null);
  }, [t.position, t.phase]);

  const candidates = sel.length ? legal.filter((m) => samePrefix(m.path, sel)) : [];
  const targets = candidates.map((m) => m.path[sel.length]!).filter((sq) => sq !== undefined);
  const flipped = me === 1;
  const squares = pos ? pos.g.board : [];
  const check = pos && t.check && pos.game === "ajedrez" ? pos.g.board.indexOf(t.turn === 0 ? "K" : "k") : undefined;

  useEffect(() => {
    const el = ref.current;
    if (!el || !pos) return;
    const art = boardArt({ game: t.game, squares, flipped, selected: sel.at(-1), targets, last: sel.length > 1 ? sel : t.last, check });
    el.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(art.data), art.width, art.height), 0, 0);
    // `targets` y `squares` salen de lo de abajo: con eso alcanza.
  }, [pos, t.game, t.last, flipped, sel, legal, check]);

  const pick = (sq: number) => {
    if (!myTurn || sq < 0) return;
    const starts = legal.some((m) => m.path[0] === sq);
    if (!sel.length) return setSel(starts ? [sq] : []);
    if (targets.includes(sq)) {
      const next = [...sel, sq];
      const done = candidates.find((m) => m.path.length === next.length && samePrefix(m.path, next));
      if (!done) return setSel(next);
      if (done.promo) return setPromo(done);
      sendBoardMove(t.id, done.path);
      return setSel([]);
    }
    // Otra pieza propia (o la misma: se suelta).
    setSel(starts && sq !== sel[0] ? [sq] : []);
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BOARD_PX;
    const y = ((e.clientY - r.top) / r.height) * BOARD_PX;
    pick(squareAtPoint(t.game, x, y, flipped));
  };

  return (
    <div className="relative shrink-0">
      <canvas
        ref={ref}
        width={BOARD_PX}
        height={BOARD_PX}
        onClick={onClick}
        aria-label={`Tablero de ${BOARD_GAME_NAME[t.game].toLowerCase()}`}
        className={`block border-2 border-cozy-frame [image-rendering:pixelated] ${myTurn ? "cursor-pointer" : ""}`}
        style={{ width: BOARD_PX * scale, height: BOARD_PX * scale }}
      />
      {promo && (
        <div role="dialog" aria-label="Coronar" className="cozy-panel absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 px-3 py-2">
          <span className="text-[13px]">¿A qué corona el peón?</span>
          <div className="flex gap-1">
            {(["q", "r", "b", "n"] as ChessPromo[]).map((p) => {
              const letter = me === 1 ? p : p.toUpperCase();
              return (
                <button
                  key={p}
                  type="button"
                  className="cozy-btn cozy-hit grid place-items-center p-1"
                  title={{ q: "Dama", r: "Torre", b: "Alfil", n: "Caballo" }[p]}
                  onClick={() => {
                    sendBoardMove(t.id, promo.path, p);
                    setPromo(null);
                    setSel([]);
                  }}
                >
                  <ArtImage id={`corona-${letter}`} make={() => chessPieceArt(letter)} scale={2} alt="" />
                </button>
              );
            })}
          </div>
          <button type="button" className="text-[12px] text-cozy-ink-soft underline" onClick={() => setPromo(null)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

/** Un jugador: su color, el nombre, si está listo o fuera de la mesa y su reloj cuando le toca. */
function SeatRow({ t, side, seat, me, now }: { t: BoardTableView; side: BoardSide; seat: BoardSeatView; me: boolean; now: number }) {
  const turn = t.phase === "playing" && t.turn === side;
  const piece = t.game === "ajedrez" ? (side === 0 ? "K" : "k") : side === 0 ? "w" : "b";
  let note = "";
  if (t.phase === "idle") note = seat.userId ? (seat.ready ? "listo" : "sentado") : "silla libre";
  else if (t.phase === "playing" && seat.awaySince) note = `fuera de la mesa · ${boardClockText(BOARD_GAME.awayMs - (now - seat.awaySince))}`;
  else if (t.phase === "over") note = t.winner === -1 ? "tablas" : t.winner === side ? "ganó" : "perdió";
  return (
    <div className={`flex items-center gap-2 border-2 px-1.5 py-1 ${turn ? "border-cozy-red bg-cozy-paper-light" : "border-transparent"}`}>
      <ArtImage id={`lado-${t.game}-${piece}`} make={() => (t.game === "ajedrez" ? chessPieceArt(piece) : checkersPieceArt(piece))} scale={2} alt="" />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={`truncate text-[14px] ${seat.userId ? "text-cozy-ink" : "text-cozy-ink-soft"}`}>
          {me ? "Tú" : seat.name || "—"} <span className="text-[12px] text-cozy-ink-soft">({BOARD_SIDE_NAME[side]})</span>
        </span>
        {note && <span className="text-[12px] text-cozy-ink-soft">{note}</span>}
      </div>
      {turn && t.clock > 0 && (
        <span className={`border-2 border-cozy-frame px-1.5 py-0.5 text-[14px] tabular-nums ${t.turnEndsAt - now < 15_000 ? "bg-[#983a3c] text-[#fffaf0]" : "bg-[#2b2331] text-[#fdf0c8]"}`}>
          {boardClockText(t.turnEndsAt - now)}
        </span>
      )}
    </div>
  );
}

const CLOCK_LABEL = (s: number) => (s === 0 ? "Sin reloj" : `${s / 60} min`);

function Ranking({ t }: { t: BoardTableView }) {
  const ranking = useBoardGamesStore((s) => s.rankings[t.game]);
  const [all, setAll] = useState(false);
  useEffect(() => requestBoardRanking(t.game), [t.game]);
  const rows = (all ? ranking?.all : ranking?.week) ?? [];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-cozy-ink">Victorias</span>
        <div role="tablist" className="flex gap-1">
          {[false, true].map((v) => (
            <button key={String(v)} type="button" role="tab" aria-selected={all === v} data-on={all === v} onClick={() => setAll(v)} className="cozy-btn px-1.5 py-0 text-[12px]">
              {v ? "Siempre" : "Semana"}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <ol className="flex flex-col text-[13px] leading-tight">
          {rows.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">
                {i + 1}. {r.name}
              </span>
              <span className="tabular-nums text-cozy-ink-soft">{r.wins}</span>
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-[12px] text-cozy-ink-soft">Nadie ganó todavía. ¡Estrénalo!</span>
      )}
    </div>
  );
}

export function BoardGameStrip() {
  const spot = useMyTable();
  const t = useBoardGamesStore((s) => (spot ? s.tables[spot.def.id] : undefined));
  const meId = useOfficeStore(selectMyUserId);
  const now = useServerNow();
  const [confirmResign, setConfirmResign] = useState(false);
  useEffect(() => setConfirmResign(false), [t?.phase, t?.match]);
  if (!spot || !t) return null;
  const side = myBoardSide(t, meId);
  // Antes de empezar, "yo" es la silla donde estoy sentado; jugando, el lado de la partida.
  const me = t.phase === "idle" ? spot.seat : side;
  const name = BOARD_GAME_NAME[t.game];

  let status = "";
  if (t.phase === "idle") {
    if (spot.seat === null) status = t.seats.some((s) => s.userId) ? "Esperando a que se sienten los dos" : "Siéntate en una silla de la mesa para jugar";
    else if (!t.seats[spot.seat === 0 ? 1 : 0].userId) status = "Esperando rival en la otra silla";
    else status = t.seats[spot.seat].ready ? "Esperando a que el otro diga listo" : "Cuando estés listo, empieza la partida";
  } else if (t.phase === "playing") {
    const turnName = me === t.turn ? "Te toca" : `Juegan las ${BOARD_SIDE_NAME[t.turn]}`;
    status = `${turnName}${t.check ? " · ¡Jaque!" : ""}`;
    if (t.drawOffer >= 0) status += t.drawOffer === me ? " · ofreciste tablas" : me !== null ? " · te ofrecen tablas" : " · hay tablas ofrecidas";
  } else {
    const why = t.reason ? BOARD_REASON_TEXT[t.reason] : "";
    status = t.winner === -1 ? `Tablas (${why})` : me !== null ? `${t.winner === me ? "¡Ganaste!" : "Perdiste"} (${why})` : `Ganan las ${BOARD_SIDE_NAME[t.winner as BoardSide]} (${why})`;
  }
  const lastText =
    t.last.length >= 2 && t.game === "ajedrez" ? `Última: ${squareName(t.last[0]!)}–${squareName(t.last.at(-1)!)}` : t.last.length >= 2 ? `Última: ${t.last.length - 1} ${t.last.length > 2 ? "saltos" : "paso"}` : "";

  const seated = spot.seat !== null;
  let actions: React.ReactNode = null;
  if ((t.phase === "idle" || t.phase === "over") && seated) {
    const ready = t.phase === "idle" && t.seats[spot.seat!].ready;
    actions = (
      <div className="flex flex-col gap-1.5">
        <div role="radiogroup" aria-label="Reloj por jugada" className="flex flex-wrap gap-1">
          {BOARD_GAME.clockOptions.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={t.clock === s}
              data-on={t.clock === s}
              disabled={t.phase !== "idle"}
              onClick={() => sendBoardReady(t.id, t.seats[spot.seat!].ready, s)}
              className="cozy-btn px-1.5 py-0.5 text-[12px]"
            >
              {CLOCK_LABEL(s)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => sendBoardReady(t.id, !ready)} className={`cozy-btn ${ready ? "" : "cozy-btn-primary"} px-3 py-1.5 text-[14px]`}>
          {t.phase === "over" ? "Revancha" : ready ? "Ya no estoy listo" : "¡Listo!"}
        </button>
      </div>
    );
  } else if (t.phase === "playing" && side !== null) {
    const offered = t.drawOffer === side;
    const theyOffer = t.drawOffer >= 0 && !offered;
    actions = (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={offered} onClick={() => sendBoardDraw(t.id)} className={`cozy-btn ${theyOffer ? "cozy-btn-primary" : ""} px-2 py-1 text-[13px]`}>
          {theyOffer ? "Aceptar tablas" : offered ? "Tablas ofrecidas" : "Ofrecer tablas"}
        </button>
        {confirmResign ? (
          <button type="button" onClick={() => sendBoardResign(t.id)} className="cozy-btn cozy-btn-danger px-2 py-1 text-[13px]">
            ¿Seguro? Rendirse
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmResign(true)} className="cozy-btn px-2 py-1 text-[13px]">
            Rendirse
          </button>
        )}
      </div>
    );
  }

  const info = (
    <>
      <span>{name} · el oeste juega con blancas</span>
      {t.clock > 0 && <span>{boardClockText(t.clock * 1000)} por jugada: si se acaba, pierdes</span>}
      {side !== null && t.phase === "playing" && <span>Si te levantas, tienes {BOARD_GAME.awayMs / 60_000} min para volver</span>}
      {t.game === "damas" && <span>Captura obligatoria y de la mayor cantidad</span>}
    </>
  );
  return (
    <Strip label={`Mesa de ${name.toLowerCase()}`} info={info}>
      <Board t={t} me={me} />
      <Divider />
      <div className="flex w-[15.5rem] flex-col gap-2 self-stretch">
        <SeatRow t={t} side={1} seat={t.seats[1]} me={me === 1} now={now} />
        <SeatRow t={t} side={0} seat={t.seats[0]} me={me === 0} now={now} />
        <div className="flex flex-col gap-0.5" aria-live="polite">
          <span className="text-[14px] leading-tight">{status}</span>
          {lastText && <span className="text-[12px] text-cozy-ink-soft">{lastText}</span>}
        </div>
        {actions}
        <Ranking t={t} />
        <div className="mt-auto flex justify-end">
          <LeaveButton text={seated ? "Levantarse" : "Salir"} />
        </div>
      </div>
    </Strip>
  );
}
