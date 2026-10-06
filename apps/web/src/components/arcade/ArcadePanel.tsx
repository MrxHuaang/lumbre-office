"use client";

// La pantalla de una máquina del arcade, con su gabinete alrededor: el juego se juega con el teclado
// (flechas y espacio) y Esc sale. Cada partida cuesta monedas (las cobra el servidor al empezar); al
// terminar se manda el puntaje con las teclas grabadas: el servidor repite la partida, la guarda y, si
// corresponde, da el premio de ocio. Entre partidas, los récords de hoy y de la semana.
import { ARCADE, ARCADE_ERROR_TEXT, ARCADE_GAME_INFO, ARCADE_KEYS, ARCADE_PRICE, ARCADE_STEP_MS, arcadeGameOf, ArcadeRecorder, type ArcadeBoardEntry, type ArcadeGame } from "@hyvento/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, drawStatic } from "@/game/arcade/games";
import { SCREEN_H, SCREEN_W, type ArcadeKey, type HeldKeys, type MiniGame } from "@/game/arcade/kit";
import { localMachine } from "@/game/arcade/local";
import { sendArcadeBoard, sendArcadeFinish, sendArcadeStart, useArcadeStore } from "@/game/arcade/net";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PixelNumber } from "../casino/PixelArt";
import { NEON } from "../club/neon";
import { useMyPoints } from "../PointsPanels";

/** Después de perder, cuánto hay que esperar para volver a jugar (así el Espacio del último aleteo no cuenta). */
const RESTART_MS = 700;
const KEYS: Record<string, ArcadeKey> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  " ": "action",
  Enter: "action",
};

type Phase = "attract" | "starting" | "playing" | "over";

/** Colores del gabinete de cada juego (marco y marquesina). */
const CABINET: Record<ArcadeGame | "off", { body: string; glow: string }> = {
  snake: { body: "#2e5a40", glow: "#8cc653" },
  breakout: { body: "#34194f", glow: "#ff5fd2" },
  flappy: { body: "#12627a", glow: "#f3d672" },
  bloques: { body: "#4f2672", glow: "#8ef0f0" },
  pinball: { body: "#7a1f2b", glow: "#ff9ae6" },
  off: { body: "#3c3a44", glow: "#9a95a0" },
};

export function ArcadePanel({ onClose }: { onClose: () => void }) {
  const [machine] = useState(localMachine);
  const game = machine === null ? null : arcadeGameOf(machine);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<{ game: MiniGame; token: string; t: number; sent: boolean; rec: ArcadeRecorder } | null>(null);
  const demo = useRef<MiniGame | null>(null);
  /** Respuesta del servidor que había al mandar el puntaje: la que llegue después es la de esta partida. */
  const sentSeq = useRef(-1);
  /** Respuesta que había al pedir empezar: un error que llegue después es que no se pudo empezar. */
  const startSeq = useRef(-1);
  /** Cuándo se perdió la última partida (para no volver a empezar sin querer). */
  const overAt = useRef(0);
  const held = useRef<HeldKeys>({ left: false, right: false, up: false, down: false, action: false });
  const [phase, setPhase] = useState<Phase>("attract");
  const [score, setScore] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const boards = useArcadeStore((s) => (s.board && s.board.machine === machine ? s.board : null));
  const points = useMyPoints();
  const poor = points < ARCADE_PRICE.machine;
  const started = useArcadeStore((s) => s.started);
  const result = useArcadeStore((s) => s.result);
  const [shownResult, setShownResult] = useState<number>(result?.seq ?? 0);
  const lastResult = phase === "over" && result && result.seq > sentSeq.current ? result : null;
  // No se vuelve a jugar hasta que llegue el resultado de la anterior: si no, la respuesta vieja se
  // confunde con la de la partida nueva.
  const canStart = phase === "attract" || (phase === "over" && lastResult !== null);

  // Mientras está abierta, el teclado es de la máquina (no mueve al personaje).
  useEffect(() => {
    const { setTyping } = useOfficeStore.getState();
    setTyping(true);
    useArcadeStore.getState().reset();
    if (machine !== null && game) sendArcadeBoard(machine);
    return () => setTyping(false);
  }, [machine, game]);

  const start = useCallback(() => {
    if (machine === null || !game) return;
    if (phase === "over" && performance.now() - overAt.current < RESTART_MS) return;
    // Sin monedas ni se pide (el servidor igual lo revisa al cobrar).
    if (poor) return useOfficeStore.getState().notify(ARCADE_ERROR_TEXT.funds, "warning");
    startSeq.current = useArcadeStore.getState().result?.seq ?? 0;
    setPhase("starting");
    sendArcadeStart(machine);
  }, [machine, game, phase, poor]);

  // El servidor dio la semilla: empieza la partida (con las teclas que ya estaban apretadas).
  useEffect(() => {
    if (phase !== "starting" || !started || started.machine !== machine || !game) return;
    const rec = new ArcadeRecorder();
    for (const k of ARCADE_KEYS) if (held.current[k]) rec.hold(k);
    run.current = { game: createGame(game, started.seed), token: started.token, t: 0, sent: false, rec };
    setScore(0);
    setPhase("playing");
  }, [phase, started, machine, game]);

  // Respuestas del servidor: no se pudo empezar (lejos o máquina rota), o el resultado de la partida.
  useEffect(() => {
    if (!result || result.seq === shownResult) return;
    setShownResult(result.seq);
    const startErrors: readonly string[] = ["far", "invalid", "funds", "failed"];
    if (!result.ok && phase === "starting" && result.seq > startSeq.current && startErrors.includes(result.error)) {
      useOfficeStore.getState().notify(ARCADE_ERROR_TEXT[result.error], "warning");
      setPhase("attract");
    }
  }, [result, shownResult, phase]);

  // Teclado: en la partida, cada tecla se aplica al juego y se graba con el número de paso.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      if (held.current[k]) return;
      held.current[k] = true;
      const r = run.current;
      if (phase === "playing" && r && !r.game.over) {
        r.rec.hold(k);
        r.rec.press(k);
        r.game.press(k);
      } else if (k === "action" && canStart) start();
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (!k || !held.current[k]) return;
      held.current[k] = false;
      const r = run.current;
      if (phase === "playing" && r && !r.game.over) r.rec.release(k);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, start, canStart, onClose]);

  // El bucle: pasos fijos y dibujo en cada cuadro.
  useEffect(() => {
    const g = canvas.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const t0 = last;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const r = run.current;
      acc += Math.min(250, now - last);
      last = now;
      if (!game) {
        drawStatic(g, now - t0);
        return;
      }
      if (r && phase === "playing") {
        // Se deja de contar pasos al perder: el servidor repite exactamente estos.
        while (acc >= ARCADE_STEP_MS && !r.game.over) {
          acc -= ARCADE_STEP_MS;
          r.t += ARCADE_STEP_MS;
          r.game.step(held.current);
          r.rec.steps++;
        }
        r.game.draw(g, r.t);
        setScore(r.game.score);
        setWaiting(r.game.waiting);
        if (r.game.over && !r.sent) {
          r.sent = true;
          sentSeq.current = useArcadeStore.getState().result?.seq ?? 0;
          overAt.current = now;
          sendArcadeFinish(r.token, r.game.score, r.rec.steps, r.rec.inputs);
          setPhase("over");
        }
      } else if (r) {
        acc = 0;
        r.game.draw(g, r.t);
      } else {
        // Antes de la primera partida: la demo del juego, quieta y oscurecida.
        acc = 0;
        demo.current ??= createGame(game, 7);
        demo.current.draw(g, now - t0);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, game]);

  const info = game ? ARCADE_GAME_INFO[game] : null;
  const colors = CABINET[game ?? "off"];
  /** Lejos de todas las máquinas (el panel se abrió con un clic desde lejos): no es que esté rota. */
  const far = machine === null;
  const title = info?.name.toUpperCase() ?? (far ? "ARCADE" : "FUERA DE SERVICIO");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(20_12_30/0.72)] p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal
        aria-label={info ? `Máquina: ${info.name}` : far ? "Arcade" : "Máquina fuera de servicio"}
        className="cozy-scroll flex max-h-full w-[min(520px,100%)] flex-col items-stretch overflow-y-auto border-4 p-3 font-pixel"
        style={{ background: colors.body, borderColor: "#1d1128", boxShadow: `0 0 0 3px ${colors.glow}55, 6px 6px 0 #1d1128` }}
      >
        {/* Marquesina con el nombre del juego. */}
        <header className="relative mb-3 flex items-center justify-center border-4 border-[#1d1128] bg-[#1e1030] px-3 py-2">
          <h2 className="text-center text-[26px] leading-none tracking-wider" style={{ color: colors.glow, textShadow: `0 0 6px ${colors.glow}, 2px 2px 0 #000` }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} className="absolute top-1 right-1 px-2 text-[14px] text-[#fdf0c8]" aria-label="Salir de la máquina">
            <span className="inline-flex items-center gap-1">
              Esc <PixelIcon name="close" size={10} />
            </span>
          </button>
        </header>
        {/* La pantalla con su bisel. */}
        <div className="relative mx-auto w-full border-[6px] border-[#1d1128] bg-black" style={{ aspectRatio: `${SCREEN_W} / ${SCREEN_H}`, maxWidth: `max(160px, calc((100dvh - 15rem) * ${SCREEN_W} / ${SCREEN_H}))` }}>
          <canvas ref={canvas} width={SCREEN_W} height={SCREEN_H} className="h-full w-full [image-rendering:pixelated]" />
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.18)_0_1px,transparent_1px_3px)]" />
          {game && phase !== "attract" && (
            <span className="absolute top-1 left-2 text-[16px] text-[#fff0b0] [text-shadow:2px_2px_0_#000]">{score}</span>
          )}
          {!game && (
            <div className="absolute inset-0 flex items-center justify-center">
              {far ? (
                <span className="bg-[rgb(10_6_20/0.8)] px-3 py-1 text-center text-[15px] text-[#fdf0c8] [text-shadow:2px_2px_0_#000]">{ARCADE_ERROR_TEXT.far}</span>
              ) : (
                <span className="bg-[#a8262a] px-3 py-1 text-[18px] text-[#fdf0c8] [text-shadow:2px_2px_0_#000]">FUERA DE SERVICIO</span>
              )}
            </div>
          )}
          {game && phase === "playing" && waiting && (
            <p className="absolute inset-x-0 bottom-[30%] text-center text-[15px] text-[#fdf0c8] [text-shadow:2px_2px_0_#000]">Espacio para empezar</p>
          )}
          {game && (phase === "attract" || phase === "starting" || phase === "over") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgb(10_6_20/0.72)] p-3 text-center text-[#fdf0c8]">
              {phase === "over" && (
                <>
                  <p className="text-[22px] text-[#ff9ae6] [text-shadow:2px_2px_0_#000]">FIN DEL JUEGO</p>
                  <p className="text-[18px]">Puntaje: {score}</p>
                  <ResultLine result={lastResult} />
                </>
              )}
              <Boards today={boards?.today ?? null} week={boards?.board ?? null} />
              <p className="mt-1 animate-pulse text-[15px] text-[#f3d672]">
                {phase === "starting" ? "Insertando moneda…" : !canStart ? "Espera un momento…" : poor ? `Te faltan puntos (cuesta ${ARCADE_PRICE.machine})` : `Espacio: insertar moneda (${ARCADE_PRICE.machine})`}
              </p>
              <p className="text-[12px] text-[#c0e377]">{info?.controls}</p>
            </div>
          )}
        </div>
        {/* Tablero de controles: la palanca y los botones (de adorno) a los lados de la ranura de monedas. */}
        <div className="mt-3 flex items-center justify-between gap-3 border-4 border-[#1d1128] bg-[#1e1030] px-4 py-2">
          <span className="relative block h-8 w-8 shrink-0" aria-hidden>
            <span className="absolute bottom-0 left-1/2 h-5 w-2 -translate-x-1/2 bg-[#6e7a98]" />
            <span className="absolute top-0 left-1/2 h-5 w-5 -translate-x-1/2 bg-[#e0359f] shadow-[inset_-2px_-2px_0_#9c1a78]" />
          </span>
          <CoinSlot price={ARCADE_PRICE.machine} points={points} glow={colors.glow} />
          <span className="flex shrink-0 gap-2" aria-hidden>
            <span className="h-5 w-5 bg-[#3fd0dd] shadow-[inset_-2px_-2px_0_#1a95ad]" />
            <span className="h-5 w-5 bg-[#f3d672] shadow-[inset_-2px_-2px_0_#b98424]" />
          </span>
        </div>
        <p className="mt-1.5 text-center text-[12px] text-[#c9b8e0]">
          Flechas · Espacio · Esc para salir · la primera partida del día paga +{ARCADE.firstGameReward} y el récord de la semana +{ARCADE.recordReward}
        </p>
      </section>
    </div>
  );
}

/** La ranura de monedas: el precio de la partida y el saldo, con el aviso cuando no alcanza. */
function CoinSlot({ price, points, glow }: { price: number; points: number; glow: string }) {
  const poor = points < price;
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3" aria-label={`Cada partida cuesta ${price}. Tienes ${points}.`}>
      <span className="flex items-center gap-1.5 border-2 border-[#1d1128] bg-[#0c1024] px-2 py-1" title="Lo que cuesta cada partida">
        <span aria-hidden className="block h-4 w-1.5 bg-[#0a0612] shadow-[0_0_0_2px_#6e7a98]" />
        <PixelIcon name="coin" size={16} color="var(--color-cozy-gold)" />
        <PixelNumber value={price} scale={2} color={NEON.gold} />
        <span className="text-[12px] text-[#c9b8e0]">por partida</span>
      </span>
      <span className="flex items-center gap-1" title="Tu saldo">
        <span className="text-[12px] text-[#c9b8e0]">Tienes</span>
        <PixelNumber value={points} scale={2} color={poor ? NEON.pink : glow} />
      </span>
    </div>
  );
}

/** Récords de hoy y de la semana, uno al lado del otro (a lo ancho de la pantalla). */
function Boards({ today, week }: { today: ArcadeBoardEntry[] | null; week: ArcadeBoardEntry[] | null }) {
  return (
    <div className="grid w-[min(300px,95%)] grid-cols-2 gap-3 text-left">
      <BoardColumn title="HOY" color={NEON.gold} board={today} empty="Nadie jugó hoy." />
      <BoardColumn title="SEMANA" color={NEON.cyan} board={week} empty="¡Estrena la máquina!" />
    </div>
  );
}

function BoardColumn({ title, color, board, empty }: { title: string; color: string; board: ArcadeBoardEntry[] | null; empty: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 border-b-2 text-center text-[13px] tracking-wider" style={{ color, borderColor: `${color}66`, textShadow: `0 0 4px ${color}` }}>
        {title}
      </p>
      {!board ? (
        <p className="text-center text-[11px] text-[#9a95a0]">…</p>
      ) : board.length === 0 ? (
        <p className="text-center text-[11px] text-[#9a95a0]">{empty}</p>
      ) : (
        <ol className="text-[12px] leading-snug">
          {board.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex justify-between gap-2">
              <span className="truncate">
                <span style={{ color: i === 0 ? color : "#9a95a0" }}>{i + 1}.</span> {b.name}
              </span>
              <span style={{ color: i === 0 ? color : "#fdf0c8" }}>{b.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ResultLine({ result }: { result: ReturnType<typeof useArcadeStore.getState>["result"] }) {
  if (!result) return <p className="text-[12px] text-[#9a95a0]">Guardando…</p>;
  if (!result.ok) return <p className="text-[12px] text-[#ff9ae6]">{ARCADE_ERROR_TEXT[result.error]}</p>;
  const parts = [result.record ? "¡Récord de la semana!" : result.bestToday ? "¡Lo mejor de hoy!" : null, result.awarded > 0 ? `+${result.awarded} puntos` : null].filter(Boolean);
  return <p className="text-[13px] text-[#c0e377]">{parts.length ? parts.join(" · ") : "Puntaje guardado."}</p>;
}
