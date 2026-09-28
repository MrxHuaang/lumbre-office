"use client";

// El tragamonedas del casino: se elige la apuesta, se tira de la palanca y los tres rodillos giran hasta
// lo que decidió el servidor (él cobra, tira y paga; aquí solo se anima). Debajo, lo que paga cada cosa.
import { slotSymbol, SLOT_GLYPH } from "@hyvento/map/art";
import { SLOT_SYMBOL_NAMES, SLOT_SYMBOLS, SLOTS, type SlotSymbol } from "@hyvento/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { toHtmlCanvas } from "@/game/iso/canvas";
import { sendSlotSpin, useMundoStore } from "@/game/mundo";
import { playReels, playSlotWin } from "@/game/mundoSonidos";
import { sfx } from "@/game/sfx";
import { useOfficeStore } from "@/game/store";
import { PixelIcon } from "../Cozy";
import { PanelShell, useMyPoints } from "../PointsPanels";
import { PixelImg } from "./kit";

const CELL = SLOT_GLYPH + 3;
const REEL_W = SLOT_GLYPH + 4;
const W = REEL_W * 3 + 8;
const H = CELL * 3 + 6;
/** Cada rodillo tiene su orden (así no giran iguales). */
const STRIPS: SlotSymbol[][] = [0, 2, 4].map((k) => [...SLOT_SYMBOLS.slice(k), ...SLOT_SYMBOLS.slice(0, k), "tinto", "arepa", "mango", "tinto"]);
/** Cuándo frena cada rodillo (fracción del giro). */
const STOPS = [0.55, 0.78, 1];
/** Si el servidor no contesta, se deja de girar. */
const TIMEOUT_MS = 4000;

type Phase = "idle" | "spinning";

export function SlotsPanel({ onClose }: { onClose: () => void }) {
  const points = useMyPoints();
  const [bet, setBet] = useState<number>(SLOTS.bets[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<{ text: string; tone: "win" | "lose" | "info" } | null>(null);
  const slot = useMundoStore((s) => s.slot);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glyphs = useRef<Record<string, HTMLCanvasElement>>({});
  const run = useRef({ pos: [0, 3, 6], targets: null as number[] | null, startedAt: 0, stopAt: [0, 0, 0], sentSeq: -1, spinning: false });

  if (Object.keys(glyphs.current).length === 0 && typeof document !== "undefined")
    for (const s of SLOT_SYMBOLS) glyphs.current[s] = toHtmlCanvas(slotSymbol(s));

  // El dibujo: tres ventanas con los símbolos que pasan y la raya del premio al medio.
  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    let id = 0;
    let last = performance.now();
    const draw = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const r = run.current;
      c.imageSmoothingEnabled = false;
      c.fillStyle = "#2a2033";
      c.fillRect(0, 0, W, H);
      for (let k = 0; k < 3; k++) {
        const strip = STRIPS[k]!;
        const L = strip.length;
        if (r.spinning) {
          if (r.targets && t >= r.stopAt[k]!) r.pos[k] = r.targets[k]!;
          else r.pos[k] = (r.pos[k]! + dt * 0.022) % L;
        }
        const x0 = 4 + k * REEL_W;
        c.fillStyle = "#fbf7ea";
        c.fillRect(x0, 3, REEL_W - 2, H - 6);
        const pos = r.pos[k]!;
        const base = Math.floor(pos);
        const frac = pos - base;
        for (let d = -2; d <= 2; d++) {
          const sym = strip[(((base + d) % L) + L) % L]!;
          const y = Math.round(3 + CELL + (d - frac) * CELL + 1);
          if (y < -CELL || y > H) continue;
          c.save();
          c.beginPath();
          c.rect(x0, 3, REEL_W - 2, H - 6);
          c.clip();
          c.drawImage(glyphs.current[sym]!, x0 + 1, y);
          c.restore();
        }
        // Sombra arriba y abajo: se ve curvo, como un rodillo.
        c.fillStyle = "rgba(42, 32, 51, 0.35)";
        c.fillRect(x0, 3, REEL_W - 2, 3);
        c.fillRect(x0, H - 6, REEL_W - 2, 3);
      }
      c.fillStyle = "#d93a2b";
      c.fillRect(1, 3 + CELL + CELL / 2, 2, 1);
      c.fillRect(W - 3, 3 + CELL + CELL / 2, 2, 1);
      // Terminó de girar el último rodillo.
      if (r.spinning && r.targets && t >= r.stopAt[2]! + 60) {
        r.spinning = false;
        setPhase("idle");
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  // La respuesta del servidor: a dónde frena cada rodillo (o, si no se pudo, se para).
  useEffect(() => {
    const r = run.current;
    if (!slot || slot.seq <= r.sentSeq) return;
    r.sentSeq = slot.seq;
    if (!slot.ok) {
      r.spinning = false;
      r.targets = null;
      setPhase("idle");
      setMessage(null);
      return;
    }
    const now = performance.now();
    const spin = Math.max(SLOTS.spinMs - (now - r.startedAt), 500);
    r.targets = slot.reels.map((s, k) => STRIPS[k]!.indexOf(s));
    r.stopAt = STOPS.map((f) => now + spin * f);
    const done = spin + 80;
    const win = slot.won;
    const text =
      slot.line === "three"
        ? slot.reels[0] === "siete"
          ? `¡¡TRES SIETES!! Ganaste ${win} puntos.`
          : `¡Tres ${SLOT_SYMBOL_NAMES[slot.reels[0]].toLowerCase()}s! Ganaste ${win} puntos.`
        : slot.line === "pair"
          ? `Par: te devuelve la apuesta (${win}).`
          : "Nada esta vez. ¿Otra?";
    window.setTimeout(() => {
      setMessage({ text, tone: slot.line === "three" ? "win" : slot.line === "pair" ? "info" : "lose" });
      if (slot.line === "three") playSlotWin(slot.reels[0] === "siete");
      else if (slot.line === "pair") sfx.coin();
    }, done);
  }, [slot]);

  // Si el servidor no contesta, el rodillo no gira para siempre.
  useEffect(() => {
    if (phase !== "spinning") return;
    const id = window.setTimeout(() => {
      const r = run.current;
      if (r.spinning && !r.targets) {
        r.spinning = false;
        setPhase("idle");
      }
    }, TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const pull = useCallback(() => {
    if (phase !== "idle") return;
    if (points < bet) return useOfficeStore.getState().notify("No te alcanzan los puntos.", "warning");
    const r = run.current;
    r.spinning = true;
    r.targets = null;
    r.startedAt = performance.now();
    r.sentSeq = useMundoStore.getState().slot?.seq ?? 0;
    setMessage(null);
    setPhase("spinning");
    playReels(SLOTS.spinMs);
    sendSlotSpin(bet);
  }, [phase, points, bet]);

  // Espacio o Enter tiran de la palanca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      pull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pull]);

  return (
    <PanelShell title="Tragamonedas" icon="star" onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-full border-4 border-[#7a1f2b] bg-[#3a1820] p-2 shadow-[4px_4px_0_#2a2033]">
          <p className="mb-1.5 text-center text-[13px] tracking-widest text-[#f3d672]">★ JACKPOT ★</p>
          <canvas ref={canvas} width={W} height={H} className="block w-full [image-rendering:pixelated]" aria-label="Los rodillos" />
        </div>
        <p aria-live="polite" className={`min-h-6 text-center text-[15px] ${message?.tone === "win" ? "font-semibold text-cozy-green" : "text-cozy-ink-soft"}`}>
          {message?.text ?? (phase === "spinning" ? "Girando…" : "Elige la apuesta y tira de la palanca.")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5" role="radiogroup" aria-label="Apuesta">
          {SLOTS.bets.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bet === b}
              data-on={bet === b || undefined}
              onClick={() => setBet(b)}
              disabled={phase !== "idle"}
              className="cozy-btn flex items-center gap-1 px-2.5 py-1 text-[14px]"
            >
              <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
              {b}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center justify-between gap-2">
          <span className="cozy-chip flex items-center gap-1 text-[13px]">
            <PixelIcon name="coin" size={12} color="var(--color-cozy-gold)" />
            {points} pts
          </span>
          <button type="button" onClick={pull} disabled={phase !== "idle" || points < bet} className="cozy-btn cozy-btn-primary px-4 py-2 text-[15px]">
            {phase === "spinning" ? "…" : `Tirar (${bet})`}
          </button>
        </div>
        <table className="w-full text-[13px]">
          <caption className="mb-1 text-left text-cozy-ink-soft">Lo que paga (por punto apostado)</caption>
          <tbody>
            {[...SLOT_SYMBOLS].reverse().map((s) => (
              <tr key={s} className="border-b-2 border-cozy-paper-dark last:border-b-0">
                <td className="py-0.5">
                  <span className="flex items-center gap-0.5">
                    {[0, 1, 2].map((k) => (
                      <PixelImg key={k} id={`slot-${s}`} draw={() => slotSymbol(s)} size={18} />
                    ))}
                  </span>
                </td>
                <td className="text-right font-semibold">×{SLOTS.three[s]}</td>
              </tr>
            ))}
            <tr>
              <td className="py-0.5 text-cozy-ink-soft">Dos iguales</td>
              <td className="text-right font-semibold">×{SLOTS.pair}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
