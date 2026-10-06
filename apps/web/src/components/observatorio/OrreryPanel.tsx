"use client";

// El orrery del observatorio: la hora del reloj de la cabaña y el clima de afuera como planetas. El
// planeta de la hora da una vuelta al sol por día del juego (arriba es mediodía, abajo medianoche) y el
// del clima se viste según lo que decidió el servidor (despejado, nubes, lluvia, tormenta o niebla).
import { formatGameTime, isNightMinute, WEATHER_TEXT, type Weather } from "@hyvento/shared";
import { useEffect, useRef } from "react";
import { useGameTime } from "@/game/gameClock";
import { useOfficeStore } from "@/game/store";
import { PanelShell } from "../PointsPanels";

const S = 240;

/** Cómo se ve el planeta del clima: color, franjas y si lleva anillo. */
const WEATHER_PLANET: Record<Weather, { base: string; band: string; ring: boolean; line: string }> = {
  despejado: { base: "#f3d672", band: "#dcae3f", ring: true, line: "Despejado: el planeta dorado brilla con su anillo." },
  nublado: { base: "#bdb8c0", band: "#9a95a0", ring: false, line: "Nublado: el planeta gris se envuelve en nubes." },
  lluvia: { base: "#6f93bf", band: "#34507a", ring: false, line: "Lluvia: el planeta azul gotea sobre la cabaña." },
  tormenta: { base: "#6e3a96", band: "#34194f", ring: false, line: "Tormenta: el planeta violeta suelta chispas." },
  niebla: { base: "#e6d0a6", band: "#cdb08a", ring: false, line: "Niebla: el planeta pálido casi no se ve." },
  nieve: { base: "#f0f0f2", band: "#b5d9f5", ring: false, line: "Nieve: el planeta blanco se cubre de escarcha." },
};

function disc(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1);
  }
}

export function OrreryPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const time = useGameTime();
  const weather = useOfficeStore((s) => s.weather);
  const minute = time?.minuteOfDay ?? 0;
  const night = isNightMinute(minute);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    let id = 0;
    const draw = () => {
      const t = performance.now();
      c.imageSmoothingEnabled = false;
      c.fillStyle = "#2b1b17";
      c.fillRect(0, 0, S, S);
      const cx = S / 2;
      const cy = S / 2;
      // Aros de latón de las órbitas.
      for (const r of [52, 86, 108]) {
        c.fillStyle = "#b98424";
        for (let a = 0; a < Math.PI * 2; a += 0.012) c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.55), 1, 1);
      }
      // El sol en su columna.
      c.fillStyle = "#8a5c17";
      c.fillRect(cx - 1, cy, 3, 60);
      disc(c, cx, cy, 13, "#ee7a22");
      disc(c, cx - 2, cy - 2, 9, "#fbb23c");
      // El planeta de la hora: mediodía arriba (lejos), medianoche abajo (cerca).
      const ah = (minute / 1440) * Math.PI * 2 + Math.PI / 2;
      const hx = cx + Math.cos(ah) * 52;
      const hy = cy + Math.sin(ah) * 52 * 0.55;
      c.fillStyle = "#dcae3f";
      c.fillRect(Math.round(Math.min(cx, hx)), Math.round(cy), Math.round(Math.abs(hx - cx)), 1);
      disc(c, hx, hy, 8, night ? "#34457f" : "#5d9c46");
      disc(c, hx - 2, hy - 2, 4, night ? "#4a5c98" : "#8cc653");
      // Su luna gira sola.
      const am = t / 900;
      disc(c, hx + Math.cos(am) * 13, hy + Math.sin(am) * 7, 2, "#e0dce0");
      // El planeta del clima: da vueltas despacio en la órbita de afuera.
      const p = WEATHER_PLANET[weather];
      const aw = t / 5000;
      const wx = cx + Math.cos(aw) * 98;
      const wy = cy + Math.sin(aw) * 98 * 0.55;
      disc(c, wx, wy, 11, p.base);
      c.fillStyle = p.band;
      c.fillRect(Math.round(wx - 10), Math.round(wy - 2), 21, 2);
      c.fillRect(Math.round(wx - 9), Math.round(wy + 4), 19, 1);
      if (p.ring) {
        c.fillStyle = "#fff0b0";
        for (let a = 0; a < Math.PI * 2; a += 0.05) c.fillRect(Math.round(wx + Math.cos(a) * 17), Math.round(wy + Math.sin(a) * 4 - Math.cos(a) * 2), 1, 1);
      }
      if (weather === "lluvia" || weather === "tormenta") {
        c.fillStyle = weather === "tormenta" ? "#fde38a" : "#9cb9da";
        for (let i = 0; i < 4; i++) c.fillRect(Math.round(wx - 6 + i * 4), Math.round(wy + 13 + ((t / 90 + i * 3) % 6)), 1, 2);
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [minute, night, weather]);
  return (
    <PanelShell title="Planetario de mesa: el clima en planetas" icon="sun" onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        <canvas ref={ref} width={S} height={S} className="h-60 w-60 border-4 border-cozy-wood [image-rendering:pixelated]" aria-hidden />
        <p className="text-[18px] font-semibold">
          {time ? `Son las ${formatGameTime(minute)} del día ${time.day + 1}` : "El reloj de la cabaña todavía no llega."}
        </p>
        <p className="text-[14px] text-cozy-ink-soft">
          El planeta verde es la hora: arriba es mediodía y abajo, medianoche ({night ? "ahora es de noche" : "ahora es de día"}).{" "}
          {WEATHER_PLANET[weather].line} Afuera: {WEATHER_TEXT[weather].toLowerCase()}.
        </p>
      </div>
    </PanelShell>
  );
}
