"use client";

// Fase 4: la mesa de ruleta del sótano. Rondas compartidas: todos ven la rueda, el tiempo y las apuestas.
import { CASINO, colorOf, rouletteBetLabel, WHEEL_ORDER, type RouletteBetSpec } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { rouletteRemaining, useCasinoStore, type RouletteBetView, type RouletteView } from "@/game/casino";
import { sendRouletteBet } from "@/game/network";
import { selectMyUserId, useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell, useMyPoints } from "../PointsPanels";

const CHIPS = [1, 5, 10, 25, 50] as const;
const COLOR = { red: "#c0392b", black: "#2b2233", green: "#3f8a4f" } as const;

/** Clave de una apuesta para juntar las fichas iguales sobre el paño. */
const keyOf = (b: { kind: string; param: number }) => `${b.kind}:${b.param}`;
const specKey = (s: RouletteBetSpec) => keyOf({ kind: s.kind, param: s.kind === "number" ? s.n : s.kind === "dozen" ? s.d : s.kind === "column" ? s.c : -1 });

export function RoulettePanel({ atObject, onClose }: { atObject: boolean; onClose: () => void }) {
  const r = useCasinoStore((s) => s.roulette);
  const offset = useCasinoStore((s) => s.offset);
  const me = useOfficeStore(selectMyUserId);
  const points = useMyPoints();
  const [chip, setChip] = useState<number>(5);
  const remaining = useCountdown(r, offset);
  const canBet = atObject && r.phase === "betting" && remaining > 0;

  const mine = r.bets.filter((b) => b.userId === me);
  const staked = mine.reduce((a, b) => a + b.amount, 0);
  const players = new Set(r.bets.map((b) => b.userId)).size;
  const onBoard = new Map<string, { mine: number; others: number }>();
  for (const b of r.bets) {
    const t = onBoard.get(keyOf(b)) ?? { mine: 0, others: 0 };
    if (b.userId === me) t.mine += b.amount;
    else t.others += b.amount;
    onBoard.set(keyOf(b), t);
  }

  const bet = (spec: RouletteBetSpec) => {
    if (!canBet) return;
    sendRouletteBet(spec, chip);
  };

  return (
    <PanelShell title="Ruleta" icon="coin" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Wheel r={r} />
          <div className="flex min-w-[12rem] flex-1 flex-col gap-2">
            <p className="text-[18px] font-semibold">{phaseText(r, remaining)}</p>
            <p className="text-[13px] text-cozy-ink-soft">
              Ronda {r.round} · {players === 0 ? "nadie ha apostado" : players === 1 ? "1 persona apostando" : `${players} personas apostando`}
            </p>
            <div className="flex flex-wrap items-center gap-1" aria-label="Últimos números">
              {r.history.map((n, i) => (
                <span
                  key={`${r.round}-${i}`}
                  className="grid h-6 w-6 place-items-center border-2 border-cozy-frame text-[12px] font-semibold text-cozy-paper-light"
                  style={{ background: COLOR[colorOf(n)], opacity: i === 0 ? 1 : 0.75 }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px]">Ficha:</span>
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={chip === c}
              onClick={() => setChip(c)}
              className="cozy-btn h-9 min-w-9 rounded-full px-2 text-[14px]"
            >
              {c}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[14px]">
            <PixelIcon name="coin" size={13} color="var(--color-cozy-gold)" />
            {points}
          </span>
        </div>

        <Board canBet={canBet} onBet={bet} onBoard={onBoard} result={r.phase === "result" ? r.result : -1} />

        <p className="text-[13px] text-cozy-ink-soft">
          {!atObject
            ? "Acércate a la mesa de ruleta (en el sótano) para apostar."
            : mine.length > 0
              ? `Tus apuestas: ${mine.map((b) => `${labelOf(b)} (${b.amount})`).join(", ")} · total ${staked}.`
              : `Elige una ficha y toca dónde apostar. Máximo ${CASINO.roulette.maxBetsPerRound} apuestas por ronda.`}
        </p>
      </div>
    </PanelShell>
  );
}

function phaseText(r: RouletteView, remaining: number): string {
  const s = Math.ceil(remaining / 1000);
  if (r.phase === "betting") return s > 0 ? `Hagan sus apuestas · ${s} s` : "No va más";
  if (r.phase === "spinning") return "¡No va más! Gira la rueda…";
  return r.result >= 0 ? `Salió el ${r.result} ${colorName(r.result)}` : "…";
}

const colorName = (n: number) => ({ red: "rojo", black: "negro", green: "verde" })[colorOf(n)];

function labelOf(b: RouletteBetView): string {
  const spec =
    b.kind === "number"
      ? ({ kind: "number", n: b.param } as const)
      : b.kind === "dozen"
        ? ({ kind: "dozen", d: b.param as 1 | 2 | 3 } as const)
        : b.kind === "column"
          ? ({ kind: "column", c: b.param as 1 | 2 | 3 } as const)
          : ({ kind: b.kind } as RouletteBetSpec);
  return rouletteBetLabel(spec);
}

/** Milisegundos que le quedan a la fase (se actualiza 4 veces por segundo). */
function useCountdown(r: RouletteView, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return rouletteRemaining(r, offset, now);
}

/** Paño: el cero, la grilla de 3x12, las columnas, las docenas y las apuestas de afuera. */
function Board({
  canBet,
  onBet,
  onBoard,
  result,
}: {
  canBet: boolean;
  onBet: (s: RouletteBetSpec) => void;
  onBoard: Map<string, { mine: number; others: number }>;
  result: number;
}) {
  const cell = (spec: RouletteBetSpec, label: string, bg: string, extra = "") => {
    const t = onBoard.get(specKey(spec));
    const win = spec.kind === "number" && spec.n === result;
    return (
      <button
        key={specKey(spec)}
        type="button"
        disabled={!canBet}
        onClick={() => onBet(spec)}
        title={rouletteBetLabel(spec)}
        aria-label={rouletteBetLabel(spec)}
        className={`relative grid min-h-8 place-items-center border border-[#e8d9a8] text-[13px] font-semibold text-cozy-paper-light enabled:hover:brightness-125 disabled:cursor-default ${extra} ${win ? "outline-3 outline-cozy-gold" : ""}`}
        style={{ background: bg }}
      >
        {label}
        {t && (t.mine > 0 || t.others > 0) && (
          <span
            className={`absolute -top-1.5 -right-1.5 grid min-h-4 min-w-4 place-items-center rounded-full border-2 px-0.5 text-[10px] leading-none ${
              t.mine > 0 ? "border-cozy-frame bg-cozy-gold text-cozy-ink" : "border-cozy-paper-light bg-cozy-sky text-cozy-paper-light"
            }`}
          >
            {t.mine > 0 ? t.mine : "•"}
          </span>
        )}
      </button>
    );
  };
  const felt = "#2e6b45";
  const rows = [3, 2, 1];
  return (
    <div className="cozy-scroll overflow-x-auto">
      <div className="grid min-w-[36rem] grid-cols-[2.2rem_repeat(12,minmax(0,1fr))_2.6rem] gap-0.5 border-4 border-[#5a2a1c] p-1" style={{ background: felt }}>
        <div className="row-span-3 grid">{cell({ kind: "number", n: 0 }, "0", COLOR.green)}</div>
        {rows.map((row) => (
          <FragmentRow key={row}>
            {Array.from({ length: 12 }, (_, i) => {
              const n = i * 3 + row;
              return cell({ kind: "number", n }, String(n), COLOR[colorOf(n) as "red" | "black"]);
            })}
            {cell({ kind: "column", c: row as 1 | 2 | 3 }, "2:1", felt)}
          </FragmentRow>
        ))}
        <div />
        <div className="col-span-4 grid">{cell({ kind: "dozen", d: 1 }, "1.ª 12", felt)}</div>
        <div className="col-span-4 grid">{cell({ kind: "dozen", d: 2 }, "2.ª 12", felt)}</div>
        <div className="col-span-4 grid">{cell({ kind: "dozen", d: 3 }, "3.ª 12", felt)}</div>
        <div />
        <div />
        <div className="col-span-2 grid">{cell({ kind: "low" }, "1-18", felt)}</div>
        <div className="col-span-2 grid">{cell({ kind: "even" }, "Par", felt)}</div>
        <div className="col-span-2 grid">{cell({ kind: "red" }, "Rojo", COLOR.red)}</div>
        <div className="col-span-2 grid">{cell({ kind: "black" }, "Negro", COLOR.black)}</div>
        <div className="col-span-2 grid">{cell({ kind: "odd" }, "Impar", felt)}</div>
        <div className="col-span-2 grid">{cell({ kind: "high" }, "19-36", felt)}</div>
        <div />
      </div>
    </div>
  );
}

/** Los hijos de una fila del paño van directo a la grilla (sin envolver). */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * La rueda en pixel-art (lienzo chico ampliado sin suavizar). Mientras gira, se anima hasta dejar el
 * número que salió bajo la flecha de arriba; en el resultado queda quieta ahí.
 */
function Wheel({ r }: { r: RouletteView }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0);
  const offset = useCasinoStore((s) => s.offset);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const sector = (Math.PI * 2) / WHEEL_ORDER.length;
    // Ángulo que deja `n` arriba (la flecha está en -90°).
    const targetFor = (n: number) => -Math.PI / 2 - (WHEEL_ORDER.indexOf(n) + 0.5) * sector;
    let raf = 0;
    const start = angle.current;
    const total = CASINO.roulette.spinMs;
    let target = start;
    if (r.phase === "spinning" && r.result >= 0) {
      const base = targetFor(r.result);
      // Varias vueltas completas antes de frenar.
      target = base - Math.PI * 2 * 5;
      while (target > start - Math.PI * 2 * 4) target -= Math.PI * 2;
    } else if (r.result >= 0) {
      target = targetFor(r.result);
    }
    const t0 = Date.now() + offset;
    const end = r.phase === "spinning" ? r.endsAt : t0;
    const draw = () => {
      const now = Date.now() + offset;
      const p = r.phase === "spinning" ? Math.min(1, 1 - (end - now) / total) : 1;
      const eased = 1 - Math.pow(1 - Math.max(0, p), 3);
      angle.current = start + (target - start) * eased;
      paintWheel(ctx, canvas.width, angle.current, r.phase === "spinning" && p < 1);
      if (r.phase === "spinning" && p < 1) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [r.phase, r.result, r.endsAt, offset]);

  return (
    <canvas
      ref={ref}
      width={72}
      height={72}
      className="h-36 w-36 shrink-0 [image-rendering:pixelated]"
      aria-label={r.result >= 0 ? `Rueda: salió el ${r.result}` : "Rueda de la ruleta"}
    />
  );
}

function paintWheel(ctx: CanvasRenderingContext2D, size: number, rot: number, spinning: boolean) {
  const c = size / 2;
  const sector = (Math.PI * 2) / WHEEL_ORDER.length;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  // Marco de madera y aro dorado.
  ctx.fillStyle = "#5a2a1c";
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dcae3f";
  ctx.beginPath();
  ctx.arc(c, c, c - 4, 0, Math.PI * 2);
  ctx.fill();
  WHEEL_ORDER.forEach((n, i) => {
    ctx.fillStyle = COLOR[colorOf(n)];
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, c - 6, rot + i * sector, rot + (i + 1) * sector);
    ctx.closePath();
    ctx.fill();
  });
  // Centro de madera con la torreta dorada.
  ctx.fillStyle = "#95552c";
  ctx.beginPath();
  ctx.arc(c, c, c * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f3d672";
  ctx.fillRect(c - 3, c - 3, 6, 6);
  // La bolita: gira rápido mientras la rueda da vueltas; al frenar queda arriba, bajo la flecha.
  const ball = spinning ? -rot * 1.7 : -Math.PI / 2;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(Math.round(c + Math.cos(ball) * (c - 10)) - 1, Math.round(c + Math.sin(ball) * (c - 10)) - 1, 3, 3);
  // Flecha arriba.
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.moveTo(c - 4, 1);
  ctx.lineTo(c + 4, 1);
  ctx.lineTo(c, 7);
  ctx.closePath();
  ctx.fill();
}
