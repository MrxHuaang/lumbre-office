"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COZY } from "@/lib/cozy";
import { DIFFICULTIES, chord, minesLeft, newBoard, reveal, toggleFlag, type Board, type DifficultyId } from "./minesweeper";

/** Colores clásicos de los números, oscurecidos lo justo para leerse sobre el papel. */
const NUMBER_INK = ["", "#2b56c4", "#2f7a2a", "#c8281e", "#1d2a86", "#7a1c14", "#0f7a78", COZY.void, "#6e6258"];

const WOOD_TILE = { background: COZY.woodLight, boxShadow: `inset 2px 2px 0 #f4b872, inset -2px -2px 0 ${COZY.wood}` };
const PAPER_TILE = { background: COZY.paperLight, boxShadow: `inset 1px 1px 0 ${COZY.paperDark}` };

// ---------- Récords (localStorage) ----------

const RECORDS_KEY = "hyvento.pc.buscaminas.records";
/** Mejor tiempo por dificultad, en milisegundos. */
type Records = Partial<Record<DifficultyId, number>>;

function loadRecords(): Records {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(RECORDS_KEY) ?? "{}");
    const out: Records = {};
    if (typeof data !== "object" || data === null) return out;
    for (const id of Object.keys(DIFFICULTIES) as DifficultyId[]) {
      const v = (data as Record<string, unknown>)[id];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveRecords(r: Records) {
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    // Modo privado o almacenamiento lleno: el récord vale solo por esta visita.
  }
}

const secondsFmt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatRecord = (ms: number) => `${secondsFmt.format(ms / 1000)} s`;

const freshBoard = (d: DifficultyId) => newBoard(DIFFICULTIES[d].w, DIFFICULTIES[d].h, DIFFICULTIES[d].mines);

/** Date.now() refrescado mientras `active`. */
function useTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function MinesweeperApp() {
  const [diff, setDiff] = useState<DifficultyId>("facil");
  const [board, setBoard] = useState(() => freshBoard("facil"));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [records, setRecords] = useState<Records>(loadRecords);
  const [newRecord, setNewRecord] = useState(false);
  /** Casilla con el foco del teclado (una sola en el orden de tabulación; se mueve con las flechas). */
  const [cursor, setCursor] = useState(0);
  const [cell, setCell] = useState(28);
  const areaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const now = useTicker(board.status === "playing");

  const over = board.status === "won" || board.status === "lost";

  // El tablero se ajusta a la ventana (también al maximizar): casillas de 14 a 32 px.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.floor(Math.min((el.clientWidth - 20) / board.w, (el.clientHeight - 20) / board.h)) - 1;
      setCell(Math.max(14, Math.min(32, s)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board.w, board.h]);

  const restart = (d: DifficultyId = diff) => {
    setDiff(d);
    setBoard(freshBoard(d));
    setStartedAt(null);
    setEndedAt(null);
    setNewRecord(false);
    setCursor((c) => Math.min(c, DIFFICULTIES[d].w * DIFFICULTIES[d].h - 1));
  };

  /** Aplica una jugada: arranca el reloj en la primera y guarda el récord al ganar. */
  const apply = (next: Board) => {
    if (next === board) return;
    const t = Date.now();
    const started = startedAt ?? (next.status === "ready" ? null : t);
    if (startedAt === null && started !== null) setStartedAt(started);
    if ((next.status === "won" || next.status === "lost") && !over) {
      setEndedAt(t);
      if (next.status === "won" && started !== null) {
        const ms = Math.max(1, t - started);
        const best = records[diff];
        if (best === undefined || ms < best) {
          const r = { ...records, [diff]: ms };
          setRecords(r);
          saveRecords(r);
          setNewRecord(true);
        }
      }
    }
    setBoard(next);
  };

  const act = (i: number, flag: boolean) => {
    if (flag || flagMode) return apply(board.state[i] === "open" ? chord(board, i) : toggleFlag(board, i));
    apply(board.state[i] === "open" ? chord(board, i) : reveal(board, i));
  };

  const moveCursor = (i: number) => {
    setCursor(i);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-i="${i}"]`)?.focus();
  };

  const onCellKey = (e: React.KeyboardEvent, i: number) => {
    const x = i % board.w;
    const y = Math.floor(i / board.w);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = moves[e.key];
    if (d) {
      e.preventDefault();
      const nx = Math.min(board.w - 1, Math.max(0, x + d[0]));
      const ny = Math.min(board.h - 1, Math.max(0, y + d[1]));
      moveCursor(ny * board.w + nx);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      act(i, true);
    }
  };

  const elapsed = startedAt === null ? 0 : Math.max(0, (endedAt ?? now) - startedAt);
  const mood: FaceMood = board.status === "lost" ? "dead" : board.status === "won" ? "cool" : pressing ? "wow" : "smile";
  const best = records[diff];

  const cellLabel = (i: number) => {
    const pos = `Fila ${Math.floor(i / board.w) + 1}, columna ${(i % board.w) + 1}`;
    const s = board.state[i];
    if (board.status === "lost" && board.mine[i] && s !== "flag") return `${pos}: mina`;
    if (s === "flag") return `${pos}: bandera`;
    if (s === "hidden") return `${pos}: tapada`;
    const n = board.adj[i] ?? 0;
    return `${pos}: ${n === 0 ? "vacía" : `${n} ${n === 1 ? "mina" : "minas"} alrededor`}`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-cozy-paper-light select-none">
      {/* Dificultad y modo bandera (para pantallas táctiles, donde no hay clic derecho). */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b-2 border-cozy-frame bg-cozy-paper px-2 py-1.5">
        {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={diff === id}
            onClick={() => restart(id)}
            className="cozy-btn px-2 py-1 text-[12px]"
          >
            {DIFFICULTIES[id].label}
            <span className="text-cozy-ink-soft">
              {DIFFICULTIES[id].w}×{DIFFICULTIES[id].h}
            </span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={flagMode}
          onClick={() => setFlagMode((v) => !v)}
          title="Con el modo bandera, un toque pone o quita banderas"
          className="cozy-btn ml-auto px-2 py-1 text-[12px]"
        >
          <FlagGlyph size={14} />
          Bandera
        </button>
      </div>

      {/* Minas que faltan, carita (nueva partida) y tiempo. */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <Led value={minesLeft(board)} label="Minas por marcar" />
        <button
          type="button"
          onClick={() => restart()}
          aria-label="Nueva partida"
          title="Nueva partida"
          className="cozy-btn h-9 w-9 p-0"
        >
          <Face mood={mood} />
        </button>
        <Led value={Math.floor(elapsed / 1000)} label="Segundos" />
      </div>

      <div ref={areaRef} className="grid min-h-0 flex-1 place-items-center overflow-auto px-2 pb-2">
        <div
          ref={gridRef}
          role="group"
          aria-label={`Tablero de ${board.w} por ${board.h}`}
          className="grid border-2 border-cozy-frame"
          style={{ gridTemplateColumns: `repeat(${board.w}, ${cell}px)`, gap: 1, background: COZY.frame, boxShadow: `3px 3px 0 rgb(20 10 24 / 0.35)` }}
          onPointerDown={(e) => e.button === 0 && !over && !flagMode && setPressing(true)}
          onPointerUp={() => setPressing(false)}
          onPointerLeave={() => setPressing(false)}
          onPointerCancel={() => setPressing(false)}
        >
          {board.state.map((s, i) => {
            const isMine = board.mine[i] ?? false;
            const lost = board.status === "lost";
            const showMine = lost && isMine && s !== "flag";
            const wrongFlag = lost && s === "flag" && !isMine;
            const n = board.adj[i] ?? 0;
            const tile = s === "open" || showMine || wrongFlag ? (board.exploded === i ? { background: COZY.red, boxShadow: "none" } : PAPER_TILE) : WOOD_TILE;
            const glyph = Math.round(cell * 0.72);
            return (
              <button
                key={i}
                type="button"
                data-i={i}
                tabIndex={i === cursor ? 0 : -1}
                aria-label={cellLabel(i)}
                onFocus={() => setCursor(i)}
                onClick={() => act(i, false)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  act(i, true);
                }}
                onKeyDown={(e) => onCellKey(e, i)}
                className={`grid place-items-center leading-none font-semibold outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-cozy-red ${
                  s !== "open" && !over ? "cursor-pointer hover:brightness-105" : "cursor-default"
                }`}
                style={{ ...tile, width: cell, height: cell, fontSize: Math.round(cell * 0.62), color: NUMBER_INK[n] }}
              >
                {showMine ? (
                  <MineGlyph size={glyph} />
                ) : wrongFlag ? (
                  <MineGlyph size={glyph} crossed />
                ) : s === "flag" ? (
                  <FlagGlyph size={glyph} />
                ) : s === "open" && n > 0 ? (
                  n
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-cozy-frame bg-cozy-paper px-3 py-1 text-[11px] text-cozy-ink-soft">
        <span className={board.status === "won" || board.status === "lost" ? "font-semibold text-cozy-ink" : ""}>
          {board.status === "won"
            ? newRecord
              ? `¡Nuevo récord! ${formatRecord(elapsed)}`
              : `¡Ganaste en ${formatRecord(elapsed)}!`
            : board.status === "lost"
              ? "¡Boom! Toca la carita para jugar otra vez."
              : "Clic derecho: bandera · clic en un número: abre alrededor"}
        </span>
        <span className="shrink-0">Récord: {best === undefined ? "—" : formatRecord(best)}</span>
      </footer>
    </div>
  );
}

/** Contador de tres cifras estilo LED (sobre la noche de la cabaña). */
function Led({ value, label }: { value: number; label: string }) {
  const text = value < 0 ? `-${String(Math.min(99, -value)).padStart(2, "0")}` : String(Math.min(999, value)).padStart(3, "0");
  return (
    <span
      role="img"
      aria-label={`${label}: ${value}`}
      className="min-w-[3.4em] border-2 border-cozy-frame px-1.5 py-1 text-center text-[20px] leading-none font-semibold tabular-nums"
      style={{ background: COZY.void, color: "#ff6b4a", boxShadow: `inset 2px 2px 0 rgb(0 0 0 / 0.35)` }}
    >
      {text}
    </span>
  );
}

type FaceMood = "smile" | "wow" | "cool" | "dead";

/** La carita del Buscaminas en pixel (16x16): sonríe, se asusta al hacer clic, lentes al ganar, X al perder. */
function Face({ mood }: { mood: FaceMood }) {
  const ink = COZY.frame;
  const px = (x: number, y: number, w = 1, h = 1) => <rect key={`${x}-${y}-${w}-${h}`} x={x} y={y} width={w} height={h} fill={ink} />;
  const smile = [px(5, 10, 6), px(4, 9), px(11, 9)];
  const eyes = [px(5, 5, 2, 2), px(9, 5, 2, 2)];
  const features =
    mood === "smile"
      ? [...eyes, ...smile]
      : mood === "wow"
        ? [...eyes, px(7, 9, 2, 3)]
        : mood === "cool"
          ? [px(3, 5, 10), px(4, 5, 3, 3), px(9, 5, 3, 3), ...smile]
          : [px(4, 5), px(6, 5), px(5, 6), px(4, 7), px(6, 7), px(9, 5), px(11, 5), px(10, 6), px(9, 7), px(11, 7), px(5, 10, 6), px(4, 11), px(11, 11)];
  return (
    <svg width={24} height={24} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="0" width="10" height="16" fill={ink} />
      <rect x="1" y="2" width="14" height="12" fill={ink} />
      <rect x="0" y="3" width="16" height="10" fill={ink} />
      <rect x="4" y="1" width="8" height="14" fill="#f6c945" />
      <rect x="2" y="3" width="12" height="10" fill="#f6c945" />
      <rect x="1" y="4" width="14" height="8" fill="#f6c945" />
      {features}
    </svg>
  );
}

function MineGlyph({ size, crossed = false }: { size: number; crossed?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <path d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13" stroke={COZY.void} strokeWidth="1.5" />
      <rect x="4" y="4" width="8" height="8" fill={COZY.void} />
      <rect x="3" y="5" width="10" height="6" fill={COZY.void} />
      <rect x="5" y="3" width="6" height="10" fill={COZY.void} />
      <rect x="6" y="5" width="2" height="2" fill={COZY.paperLight} />
      {crossed && <path d="M2 2l12 12M14 2L2 14" stroke={COZY.red} strokeWidth="2" />}
    </svg>
  );
}

/** Banderín rojo grande (pequeño se confundía con un "1"), con mástil y base. */
function FlagGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <rect x="7" y="1" width="3" height="8" fill={COZY.red} />
      <rect x="4" y="2" width="3" height="6" fill={COZY.red} />
      <rect x="2" y="3" width="2" height="4" fill={COZY.red} />
      <rect x="1" y="4" width="1" height="2" fill={COZY.red} />
      <rect x="4" y="3" width="2" height="1" fill="#ee7a6a" />
      <rect x="10" y="1" width="2" height="11" fill={COZY.frame} />
      <rect x="7" y="11" width="7" height="1" fill={COZY.frame} />
      <rect x="5" y="12" width="10" height="2" fill={COZY.frame} />
    </svg>
  );
}
