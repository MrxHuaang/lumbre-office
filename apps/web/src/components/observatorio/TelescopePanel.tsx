"use client";

// El telescopio del observatorio: de noche (del reloj del juego) se ve el cielo de la cabaña con sus
// constelaciones de nombres inventados, que giran despacio con la hora; cada tanto cruza una estrella
// fugaz que decide el servidor y quien dice primero "¡La vi!" se lleva el logro. De día, "vuelve de noche".
import { backgroundStars, CONSTELLATIONS, SKY, type ShootingStar } from "@hyvento/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameTime } from "@/game/gameClock";
import { spotStar, telescopeClose, telescopeLook, useObservatorio } from "@/game/observatorio";
import { PanelShell } from "../PointsPanels";

const W = SKY.width / 2;
const H = SKY.height / 2;

/** Dónde va la cabeza de la estrella fugaz (0 a 1 del vuelo) en coordenadas del cielo. */
function starHead(s: ShootingStar, k: number) {
  const a = (s.angle * Math.PI) / 180;
  return { x: s.x + Math.cos(a) * s.length * k, y: s.y + Math.sin(a) * s.length * k };
}

function SkyCanvas({ minute, names, onStar }: { minute: number; names: boolean; onStar: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bg = useMemo(() => backgroundStars(), []);
  const star = useObservatorio((s) => s.star);
  // El cielo gira alrededor de un punto arriba del horizonte: unos grados por hora del juego.
  const turn = ((minute / 60) * 2.5 * Math.PI) / 180;
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    let id = 0;
    const draw = () => {
      const t = performance.now();
      c.imageSmoothingEnabled = false;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0c1024");
      g.addColorStop(0.7, "#212c5a");
      g.addColorStop(1, "#4f2672");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H * 1.1;
      const rot = (x: number, y: number) => {
        const dx = x / 2 - cx;
        const dy = y / 2 - cy;
        return { x: Math.round(cx + dx * Math.cos(turn) - dy * Math.sin(turn)), y: Math.round(cy + dx * Math.sin(turn) + dy * Math.cos(turn)) };
      };
      // Estrellas del fondo que titilan.
      bg.forEach(([x, y, b], i) => {
        const p = rot(x, y);
        const tw = 0.55 + 0.45 * Math.sin(t / 700 + i * 1.7);
        c.fillStyle = `rgba(255, 244, 214, ${(b === 2 ? 0.9 : 0.55) * tw})`;
        c.fillRect(p.x, p.y, b, b);
      });
      // Constelaciones: líneas tenues, estrellas brillantes y (si se pide) el nombre.
      for (const k of CONSTELLATIONS) {
        const pts = k.stars.map(([x, y]) => rot(x, y));
        c.strokeStyle = "rgba(220, 174, 63, 0.45)";
        c.lineWidth = 1;
        for (const [a, b] of k.lines) {
          c.beginPath();
          c.moveTo(pts[a]!.x + 0.5, pts[a]!.y + 0.5);
          c.lineTo(pts[b]!.x + 0.5, pts[b]!.y + 0.5);
          c.stroke();
        }
        k.stars.forEach(([, , b], i) => {
          const p = pts[i]!;
          c.fillStyle = "#fff0b0";
          c.fillRect(p.x - (b > 1 ? 1 : 0), p.y, b > 1 ? 3 : 1, 1);
          c.fillRect(p.x, p.y - (b > 1 ? 1 : 0), 1, b > 1 ? 3 : 1);
        });
        if (names) {
          const mid = pts.reduce((m, p) => ({ x: m.x + p.x / pts.length, y: m.y + p.y / pts.length }), { x: 0, y: 0 });
          c.font = "10px var(--font-pixel), monospace";
          c.fillStyle = "rgba(243, 214, 114, 0.9)";
          c.textAlign = "center";
          c.fillText(k.name, Math.round(mid.x), Math.round(mid.y + 22));
        }
      }
      // La estrella fugaz: cabeza blanca y estela que se apaga.
      if (star) {
        const k = (t - star.seenAt) / star.flightMs;
        if (k >= 0 && k <= 1.15) {
          for (let i = 0; i < 18; i++) {
            const kk = Math.min(1, k) - i * 0.012;
            if (kk < 0) break;
            const p = starHead(star, kk);
            c.fillStyle = `rgba(255, 250, 230, ${Math.max(0, (1 - i / 18) * (k > 1 ? 1.15 - k : 1) * 6.6) / 6.6})`;
            c.fillRect(Math.round(p.x / 2), Math.round(p.y / 2), i === 0 ? 2 : 1, i === 0 ? 2 : 1);
          }
        }
      }
      // El horizonte: copas de árboles y la baranda de la cúpula.
      c.fillStyle = "#101a14";
      for (let x = 0; x < W; x += 2) {
        const h = 14 + Math.sin(x * 0.09) * 5 + Math.sin(x * 0.23 + 1) * 3;
        c.fillRect(x, H - h, 2, h);
      }
      c.fillStyle = "#3f2416";
      c.fillRect(0, H - 6, W, 6);
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [bg, names, star, turn]);
  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      onClick={onStar}
      className="block w-full cursor-crosshair border-4 border-cozy-wood [image-rendering:pixelated]"
      aria-label="El cielo por el telescopio"
    />
  );
}

export function TelescopePanel({ onClose }: { onClose: () => void }) {
  const sky = useObservatorio((s) => s.sky);
  const star = useObservatorio((s) => s.star);
  const note = useObservatorio((s) => s.starNote);
  const time = useGameTime();
  const [names, setNames] = useState(true);
  useEffect(() => {
    telescopeLook();
    return () => telescopeClose();
  }, []);
  const spot = () => {
    if (star) spotStar(star.id);
  };
  return (
    <PanelShell title="Telescopio" icon="star" onClose={onClose} wide>
      {!sky ? (
        <p className="py-10 text-center text-cozy-ink-soft">Ajustando el lente…</p>
      ) : !sky.night ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[20px] font-semibold">Vuelve de noche</p>
          <p className="max-w-sm text-[14px] text-cozy-ink-soft">
            De día el sol no deja ver nada. Las estrellas salen a las 19:00 del reloj de la cabaña
            {time ? ` (ahora son las ${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")})` : ""}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SkyCanvas minute={time?.minuteOfDay ?? 0} names={names} onStar={spot} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} />
              Ver los nombres
            </label>
            <span className="min-h-5 text-cozy-ink-soft" aria-live="polite">
              {note?.text ?? (star ? "¡Algo cruza el cielo!" : "Paciencia: cada tanto pasa una estrella fugaz.")}
            </span>
            <button type="button" onClick={spot} disabled={!star} className="cozy-btn cozy-btn-primary px-3 py-1.5">
              ¡La vi!
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] max-sm:grid-cols-1">
            {CONSTELLATIONS.map((k) => (
              <li key={k.id}>
                <span className="font-semibold">{k.name}.</span> <span className="text-cozy-ink-soft">{k.story}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelShell>
  );
}
