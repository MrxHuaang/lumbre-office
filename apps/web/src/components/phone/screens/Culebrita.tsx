"use client";

// La culebrita clásica en pantalla verde de una tinta. Flechas o 2/4/6/8 para doblar, OK o 5 para
// pausar. El récord queda en este navegador (no da puntos: sería un premio que no valida el servidor).
import { useCallback, useEffect, useRef, useState } from "react";
import { phoneSounds } from "@/game/phone/audio";
import { PHONE_SNAKE, PhoneSnake } from "@/game/phone/snake";
import { usePhoneStore } from "@/game/phone/state";
import { dirOf, usePhone, usePhoneKeys } from "../kit";

const CELL = 4;
const W = PHONE_SNAKE.cols * CELL;
const H = PHONE_SNAKE.rows * CELL;
// Verdes de las pantallas monocromas de antes.
const LCD = { bg: "#b4cf7a", dim: "#a6c26c", ink: "#233b18", mid: "#56713a" };

type Phase = "intro" | "play" | "pause" | "over";

/** Letras de 3x5 para "CULEBRITA" en la portada (como las del neón de la cabaña). */
const FONT: Record<string, string[]> = {
  C: ["###", "#..", "#..", "#..", "###"],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  L: ["#..", "#..", "#..", "#..", "###"],
  E: ["###", "#..", "##.", "#..", "###"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
};

function draw(g: CanvasRenderingContext2D, s: PhoneSnake, phase: Phase, t: number) {
  g.fillStyle = LCD.bg;
  g.fillRect(0, 0, W, H);
  // Rejilla muy suave de píxeles apagados (el "fantasma" de la pantalla LCD).
  g.fillStyle = LCD.dim;
  for (let y = 0; y < PHONE_SNAKE.rows; y++) for (let x = 0; x < PHONE_SNAKE.cols; x++) g.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  if (phase === "intro") {
    const word = "CULEBRITA";
    const x0 = Math.floor((W - word.length * 4 * 2 + 2) / 2);
    [...word].forEach((ch, i) =>
      FONT[ch]!.forEach((row, y) =>
        [...row].forEach((p, x) => {
          if (p !== "#") return;
          g.fillStyle = LCD.ink;
          g.fillRect(x0 + i * 8 + x * 2, 12 + y * 2 + (Math.floor(t / 250 + i) % 4 === 0 ? -1 : 0), 2, 2);
        }),
      ),
    );
  }
  g.fillStyle = LCD.ink;
  // Comida: un cuadrito con esquinas vacías; el bicho titila.
  const f = s.food;
  g.fillRect(f.x * CELL + 1, f.y * CELL, 2, CELL);
  g.fillRect(f.x * CELL, f.y * CELL + 1, CELL, 2);
  if (s.bug && Math.floor(t / 150) % 2 === 0) {
    g.fillRect(s.bug.x * CELL, s.bug.y * CELL, CELL, CELL);
    g.fillStyle = LCD.bg;
    g.fillRect(s.bug.x * CELL + 1, s.bug.y * CELL + 1, 2, 2);
    g.fillStyle = LCD.ink;
  }
  if (phase === "intro") return;
  s.body.forEach((c, i) => {
    if (phase === "over" && Math.floor(t / 200) % 2 === 0) return; // al perder, la culebra parpadea
    g.fillRect(c.x * CELL, c.y * CELL, CELL, CELL);
    if (i === 0) {
      g.fillStyle = LCD.bg;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, 1, 1); // el ojo
      g.fillStyle = LCD.ink;
    } else if (i % 2 === 0) {
      g.fillStyle = LCD.mid;
      g.fillRect(c.x * CELL + 1, c.y * CELL + 1, 2, 2);
      g.fillStyle = LCD.ink;
    }
  });
}

export function CulebritaApp() {
  const { back } = usePhone();
  const best = usePhoneStore((s) => s.snakeBest);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef(new PhoneSnake());
  const [phase, setPhase] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [record, setRecord] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Pintar seguido (para las animaciones) y avanzar según la velocidad de la culebra.
  useEffect(() => {
    let raf = 0;
    let acc = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = game.current;
      if (phaseRef.current === "play") {
        acc += Math.min(250, now - last);
        while (acc >= s.stepMs && !s.over) {
          acc -= s.stepMs;
          const ev = s.step();
          if (ev === "eat") phoneSounds.snakeEat();
          if (ev === "bug") phoneSounds.snakeBug();
          if (ev) setScore(s.score);
          if (ev === "die") {
            phoneSounds.snakeDie();
            const { snakeBest, setPrefs } = usePhoneStore.getState();
            setRecord(s.score > snakeBest);
            if (s.score > snakeBest) setPrefs({ snakeBest: s.score });
            setPhase("over");
          }
        }
      }
      last = now;
      const g = canvas.current?.getContext("2d");
      if (g) draw(g, s, phaseRef.current, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = useCallback(() => {
    game.current = new PhoneSnake();
    setScore(0);
    setRecord(false);
    setPhase("play");
  }, []);

  usePhoneKeys(
    (k) => {
      const letter = k.startsWith("char:") ? k.slice(5).toLowerCase() : "";
      const d = dirOf(k) ?? ({ w: "up", s: "down", a: "left", d: "right" } as const)[letter as "w"] ?? null;
      if (phase === "play" && d) return game.current.turn(d), true;
      if (k === "ok" || k === "softL" || k === "5" || letter === " ") {
        if (phase === "play") setPhase("pause");
        else if (phase === "pause") setPhase("play");
        else start();
        return true;
      }
      if (k === "softR" || k === "back") return back(), true;
      return d !== null; // las flechas fuera de la partida no hacen nada (ni salen de la app)
    },
    {
      left: phase === "play" ? "Pausa" : phase === "pause" ? "Seguir" : "Jugar",
      right: "Salir",
    },
  );

  return (
    <div className="flex flex-1 flex-col" style={{ background: LCD.bg, color: LCD.ink }}>
      <div className="flex h-[15px] items-center justify-between px-1 text-[11px] leading-none" style={{ borderBottom: `2px solid ${LCD.ink}` }}>
        <span>{String(score).padStart(4, "0")}</span>
        <span>REC {String(Math.max(best, score)).padStart(4, "0")}</span>
      </div>
      <div className="relative flex-1">
        <canvas ref={canvas} width={W} height={H} className="pixelated absolute inset-0 h-full w-full" />
        {phase !== "play" && (
          <div className="absolute inset-x-0 bottom-1 text-center text-[11px] leading-tight">
            {phase === "intro" && "OK para jugar"}
            {phase === "pause" && "Pausa"}
            {phase === "over" && (record ? `¡Récord nuevo! ${score}` : `Fin del juego: ${score}`)}
          </div>
        )}
      </div>
    </div>
  );
}
