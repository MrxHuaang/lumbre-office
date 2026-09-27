"use client";

// La pantalla de una máquina del arcade, con su gabinete alrededor: el juego se juega con el teclado
// (flechas y espacio) y Esc sale. Al terminar se manda el puntaje: el servidor lo valida, lo guarda y,
// si corresponde, da el premio de ocio. Arriba, la tabla de récords de la semana.
import { ARCADE_ERROR_TEXT, ARCADE_GAME_INFO, arcadeGameOf, type ArcadeGame } from "@hyvento/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGame, drawStatic, isWaiting, machineAt } from "@/game/arcade/games";
import { SCREEN_H, SCREEN_W, type ArcadeKey, type HeldKeys, type MiniGame } from "@/game/arcade/kit";
import { sendArcadeBoard, sendArcadeFinish, sendArcadeStart, useArcadeStore } from "@/game/arcade/net";
import { getRoom } from "@/game/network";
import { useOfficeStore } from "@/game/store";

const STEP_MS = 1000 / 60;
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
  off: { body: "#3c3a44", glow: "#9a95a0" },
};

export function ArcadePanel({ onClose }: { onClose: () => void }) {
  const [machine] = useState(() => {
    const sessionId = useOfficeStore.getState().sessionId;
    const me = sessionId ? getRoom()?.state.players.get(sessionId) : undefined;
    return me && me.area === "sotano" ? machineAt(me.x, me.y) : null;
  });
  const game = machine === null ? null : arcadeGameOf(machine);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef<{ game: MiniGame; token: string; t: number; sent: boolean } | null>(null);
  const demo = useRef<MiniGame | null>(null);
  /** Respuesta del servidor que había al mandar el puntaje: la que llegue después es la de esta partida. */
  const sentSeq = useRef(-1);
  const held = useRef<HeldKeys>({ left: false, right: false, up: false, down: false, action: false });
  const [phase, setPhase] = useState<Phase>("attract");
  const [score, setScore] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const board = useArcadeStore((s) => (s.board && s.board.machine === machine ? s.board.board : null));
  const started = useArcadeStore((s) => s.started);
  const result = useArcadeStore((s) => s.result);
  const [shownResult, setShownResult] = useState<number>(result?.seq ?? 0);

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
    setPhase("starting");
    sendArcadeStart(machine);
  }, [machine, game]);

  // El servidor dio la semilla: empieza la partida.
  useEffect(() => {
    if (phase !== "starting" || !started || started.machine !== machine || !game) return;
    run.current = { game: createGame(game, started.seed), token: started.token, t: 0, sent: false };
    setScore(0);
    setPhase("playing");
  }, [phase, started, machine, game]);

  // Respuestas del servidor: no se pudo empezar, o el resultado de la partida.
  useEffect(() => {
    if (!result || result.seq === shownResult) return;
    setShownResult(result.seq);
    if (!result.ok && phase === "starting") {
      useOfficeStore.getState().notify(ARCADE_ERROR_TEXT[result.error], "warning");
      setPhase("attract");
    }
  }, [result, shownResult, phase]);

  // Teclado.
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
      if (!held.current[k]) {
        held.current[k] = true;
        if (phase === "playing") run.current?.game.press(k);
        else if (k === "action" && (phase === "attract" || phase === "over")) start();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (k) held.current[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, start, onClose]);

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
        while (acc >= STEP_MS) {
          acc -= STEP_MS;
          r.t += STEP_MS;
          r.game.step(STEP_MS, held.current);
        }
        r.game.draw(g, r.t);
        setScore(r.game.score);
        setWaiting(isWaiting(r.game));
        if (r.game.over && !r.sent) {
          r.sent = true;
          sentSeq.current = useArcadeStore.getState().result?.seq ?? 0;
          sendArcadeFinish(r.token, r.game.score);
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
  const lastResult = phase === "over" && result && result.seq > sentSeq.current ? result : null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgb(20_12_30/0.72)] p-3" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal
        aria-label={info ? `Máquina: ${info.name}` : "Máquina fuera de servicio"}
        className="cozy-scroll flex max-h-full w-[min(520px,100%)] flex-col items-stretch overflow-y-auto border-4 p-3 font-pixel"
        style={{ background: colors.body, borderColor: "#1d1128", boxShadow: `0 0 0 3px ${colors.glow}55, 6px 6px 0 #1d1128` }}
      >
        {/* Marquesina con el nombre del juego. */}
        <header className="relative mb-3 flex items-center justify-center border-4 border-[#1d1128] bg-[#1e1030] px-3 py-2">
          <h2 className="text-center text-[26px] leading-none tracking-wider" style={{ color: colors.glow, textShadow: `0 0 6px ${colors.glow}, 2px 2px 0 #000` }}>
            {info?.name.toUpperCase() ?? "FUERA DE SERVICIO"}
          </h2>
          <button type="button" onClick={onClose} className="absolute top-1 right-1 px-2 text-[14px] text-[#fdf0c8]" aria-label="Salir de la máquina">
            Esc ✕
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
              <span className="bg-[#a8262a] px-3 py-1 text-[18px] text-[#fdf0c8] [text-shadow:2px_2px_0_#000]">FUERA DE SERVICIO</span>
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
              <Board board={board} />
              <p className="mt-1 animate-pulse text-[15px] text-[#f3d672]">{phase === "starting" ? "Insertando moneda…" : "Espacio para jugar"}</p>
              <p className="text-[12px] text-[#c0e377]">{info?.controls}</p>
            </div>
          )}
        </div>
        {/* Tablero de controles, de adorno. */}
        <div className="mt-3 flex items-center justify-between border-4 border-[#1d1128] bg-[#1e1030] px-5 py-2">
          <span className="relative block h-8 w-8" aria-hidden>
            <span className="absolute bottom-0 left-1/2 h-5 w-2 -translate-x-1/2 bg-[#6e7a98]" />
            <span className="absolute top-0 left-1/2 h-5 w-5 -translate-x-1/2 bg-[#e0359f] shadow-[inset_-2px_-2px_0_#9c1a78]" />
          </span>
          <span className="text-[12px] text-[#9a95a0]">Flechas · Espacio · Esc para salir</span>
          <span className="flex gap-2" aria-hidden>
            <span className="h-5 w-5 bg-[#3fd0dd] shadow-[inset_-2px_-2px_0_#1a95ad]" />
            <span className="h-5 w-5 bg-[#f3d672] shadow-[inset_-2px_-2px_0_#b98424]" />
          </span>
        </div>
      </section>
    </div>
  );
}

function Board({ board }: { board: { name: string; score: number }[] | null }) {
  return (
    <div className="w-[min(240px,90%)]">
      <p className="mb-1 text-[13px] text-[#8ef0f0]">Récords de la semana</p>
      {!board || board.length === 0 ? (
        <p className="text-[12px] text-[#9a95a0]">Nadie ha jugado esta semana. ¡Sé la primera persona!</p>
      ) : (
        <ol className="text-[13px]">
          {board.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex justify-between gap-3">
              <span className="truncate">
                {i + 1}. {b.name}
              </span>
              <span className="text-[#f3d672]">{b.score}</span>
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
  const parts = [result.record ? "¡Récord de la semana!" : null, result.awarded > 0 ? `+${result.awarded} puntos` : null].filter(Boolean);
  return <p className="text-[13px] text-[#c0e377]">{parts.length ? parts.join(" · ") : "Puntaje guardado."}</p>;
}
