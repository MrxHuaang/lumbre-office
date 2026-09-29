"use client";

// La rueda de la fortuna del casino: una vuelta gratis al día. El servidor elige el sector; aquí la rueda
// gira (pixel a pixel, con el tic de cada clavija) hasta quedar con ese sector bajo la flecha de arriba.
import { FORTUNE, FORTUNE_SECTORS, bagItemInfo, objItemId } from "@hyvento/shared";
import { useEffect, useRef, useState } from "react";
import { askFortune, sendFortuneSpin, useMundoStore } from "@/game/mundo";
import { playWheelTick } from "@/game/mundoSonidos";
import { sfx } from "@/game/sfx";
import { PanelShell } from "../PointsPanels";

const SIZE = 72;
const R = SIZE / 2 - 2;
const SECTOR = (Math.PI * 2) / FORTUNE_SECTORS.length;
const COLORS = FORTUNE_SECTORS.map((s) => [parseInt(s.color.slice(1, 3), 16), parseInt(s.color.slice(3, 5), 16), parseInt(s.color.slice(5, 7), 16)]);

/** Dibuja la rueda girada `theta` (radianes): cada píxel toma el color de su sector, con aro y clavijas. */
function paint(c: CanvasRenderingContext2D, theta: number) {
  const img = c.createImageData(SIZE, SIZE);
  const d = img.data;
  const cx = SIZE / 2;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cx;
      const r = Math.hypot(dx, dy);
      if (r > R + 1.5) continue;
      const i = (y * SIZE + x) * 4;
      let col: number[];
      if (r > R - 1) col = [43, 27, 23];
      else if (r > R - 3) col = [220, 174, 63];
      else if (r < 4) col = r < 2.5 ? [243, 214, 114] : [43, 27, 23];
      else {
        // Ángulo desde arriba, en el sentido del reloj, en el marco de la rueda.
        const a = (((Math.atan2(dx, -dy) - theta) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
        const k = Math.floor(a / SECTOR);
        const edge = Math.abs(a - Math.round(a / SECTOR) * SECTOR) * r < 0.7;
        col = edge ? [43, 27, 23] : COLORS[k]!;
        // Un poco de luz arriba a la izquierda.
        if (!edge && dx + dy < -R * 0.6) col = col.map((v) => Math.min(255, v + 22));
      }
      d[i] = col[0]!;
      d[i + 1] = col[1]!;
      d[i + 2] = col[2]!;
      d[i + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  // Clavijas del aro, una por sector.
  c.fillStyle = "#fff4d6";
  for (let k = 0; k < FORTUNE_SECTORS.length; k++) {
    const a = k * SECTOR + theta;
    c.fillRect(Math.round(cx + Math.sin(a) * (R - 2)) - 1, Math.round(cx - Math.cos(a) * (R - 2)) - 1, 2, 2);
  }
  // La flecha de arriba.
  c.fillStyle = "#2b1b17";
  c.fillRect(cx - 3, 0, 7, 2);
  c.fillRect(cx - 2, 2, 5, 2);
  c.fillRect(cx - 1, 4, 3, 2);
  c.fillStyle = "#d93a2b";
  c.fillRect(cx - 2, 0, 5, 1);
  c.fillRect(cx - 1, 1, 3, 2);
}

export function FortunePanel({ onClose }: { onClose: () => void }) {
  const fortune = useMundoStore((s) => s.fortune);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef({ theta: 0, from: 0, to: 0, startedAt: 0, spinning: false, seq: -1, tick: 0 });
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    run.current.seq = useMundoStore.getState().fortune.last?.seq ?? 0;
    askFortune();
  }, []);

  // Llegó la vuelta: la rueda gira unas cuantas vueltas y frena en el sector.
  useEffect(() => {
    const last = fortune.last;
    const r = run.current;
    if (!last || last.seq <= r.seq) return;
    r.seq = last.seq;
    const target = -(last.sector + 0.5) * SECTOR;
    const base = r.theta - (r.theta % (Math.PI * 2));
    r.from = r.theta;
    r.to = base + Math.PI * 2 * 6 + ((target - base) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    r.startedAt = performance.now();
    r.spinning = true;
    setSpinning(true);
    setResult(null);
    const s = FORTUNE_SECTORS[last.sector]!;
    const prize = s.item
      ? last.kept
        ? `¡${bagItemInfo(objItemId(s.item)).name}! Quedó en tu mochila.`
        : `¡${bagItemInfo(objItemId(s.item)).name}! No te cabía: te dimos ${last.points} puntos.`
      : last.points > 0
        ? `¡Ganaste ${last.points} puntos!`
        : s.points > 0
          ? "Ganaste puntos, pero ya llegaste al tope de ocio de hoy."
          : "Esta vez nada. ¡Mañana será!";
    window.setTimeout(() => {
      setResult(prize);
      if (last.points > 0 || last.kept) sfx.win();
      else sfx.lose();
    }, FORTUNE.spinMs + 100);
  }, [fortune.last]);

  useEffect(() => {
    const c = canvas.current?.getContext("2d");
    if (!c) return;
    let id = 0;
    const frame = (t: number) => {
      const r = run.current;
      if (r.spinning) {
        const k = Math.min(1, (t - r.startedAt) / FORTUNE.spinMs);
        const ease = 1 - (1 - k) ** 3;
        r.theta = r.from + (r.to - r.from) * ease;
        // Un tic cada vez que una clavija pasa por la flecha.
        const tick = Math.floor(r.theta / SECTOR);
        if (tick !== r.tick) {
          r.tick = tick;
          playWheelTick();
        }
        if (k >= 1) {
          r.spinning = false;
          setSpinning(false);
        }
      }
      paint(c, r.theta);
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);

  const spun = fortune.spun;
  return (
    <PanelShell title="Rueda de la fortuna" icon="star" onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        <canvas ref={canvas} width={SIZE} height={SIZE} className="block w-56 max-w-full [image-rendering:pixelated]" aria-label="La rueda de la fortuna" />
        <p aria-live="polite" className="min-h-6 text-center text-[15px]">
          {result ?? (spinning ? "Girando…" : spun === null ? "Un segundito…" : spun ? "Ya giraste hoy. La rueda te espera mañana." : "Una vuelta gratis al día. ¡Suerte!")}
        </p>
        <button type="button" onClick={sendFortuneSpin} disabled={spinning || spun !== false} className="cozy-btn cozy-btn-primary px-5 py-2 text-[15px]">
          Girar
        </button>
        <ul className="grid w-full grid-cols-4 gap-1 text-center text-[12px]">
          {FORTUNE_SECTORS.map((s) => (
            <li key={s.id} className="flex items-center justify-center gap-1 border-2 border-cozy-paper-dark bg-cozy-paper-light px-1 py-0.5">
              <span className="h-2.5 w-2.5 shrink-0 border border-cozy-frame" style={{ background: s.color }} />
              {s.points ? `${s.label} pts` : s.label}
            </li>
          ))}
        </ul>
      </div>
    </PanelShell>
  );
}
