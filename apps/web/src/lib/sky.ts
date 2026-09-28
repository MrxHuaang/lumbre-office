// La ventanita del reloj del HUD (como el dial de Stardew): un cielo pixel de 14x10 donde el sol cruza
// de 5:00 a 19:00 y la luna de 19:00 a 5:00, con los colores del momento. Todo puro, para probarlo sin DOM.
import { skyPhase, type SkyPhase } from "@hyvento/shared";

export const SKY_W = 14;
export const SKY_H = 10;
/** Filas de colinas abajo (tapan al sol cuando sale y cuando se pone). */
const HILLS = 2;
/** Lado del sol y de la luna. */
const BODY = 4;

const SUN_FROM = 5 * 60;
const SUN_SPAN = 14 * 60;
const MOON_FROM = 19 * 60;
const MOON_SPAN = 10 * 60;

/** Cielo de arriba y de abajo, y las colinas (arriba y abajo) de cada momento. */
export const SKY_COLORS: Record<SkyPhase, { top: string; bottom: string; hill: string; hillDark: string }> = {
  amanecer: { top: "#8a7fc0", bottom: "#f6b98a", hill: "#5f7f45", hillDark: "#4a6538" },
  dia: { top: "#7cc6ea", bottom: "#c4ecf6", hill: "#6fae4f", hillDark: "#4f8a3a" },
  atardecer: { top: "#c96a78", bottom: "#f5b264", hill: "#6a7a3e", hillDark: "#51602f" },
  noche: { top: "#1c1d4a", bottom: "#3a3470", hill: "#2c4a3a", hillDark: "#223a2e" },
};

export interface SkyBody {
  kind: "sun" | "moon";
  /** Esquina de arriba a la izquierda del cuerpo (4x4), en píxeles del cielo. */
  x: number;
  y: number;
}

/** Dónde va el sol o la luna: un arco de izquierda a derecha, más alto a mitad de su rato. */
export function skyBody(minuteOfDay: number): SkyBody {
  const m = ((minuteOfDay % 1440) + 1440) % 1440;
  const sun = m >= SUN_FROM && m < MOON_FROM;
  const t = sun ? (m - SUN_FROM) / SUN_SPAN : ((((m - MOON_FROM) % 1440) + 1440) % 1440) / MOON_SPAN;
  const x = Math.round(t * (SKY_W - BODY));
  // Arriba del todo a mitad del arco; en las puntas queda medio escondido detrás de las colinas.
  const top = 1;
  const low = SKY_H - HILLS - 1;
  const y = Math.round(low - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * (low - top));
  return { kind: sun ? "sun" : "moon", x, y };
}

export type SkyPixel = { x: number; y: number; color: string };

// Sol: un disco de 4x4 con un brillo. Luna: una media luna que mira a la derecha.
const SUN = [".YY.", "YhYY", "YYYY", ".YY."];
const MOON = [".WW.", "WW..", "WW..", ".WW."];
const STARS: [number, number][] = [
  [2, 1],
  [9, 2],
  [12, 0],
  [5, 3],
  [11, 5],
  [1, 5],
];

/** Los píxeles del cielo en orden de dibujo (fondo, estrellas, sol o luna y las colinas encima). */
export function skyPixels(minuteOfDay: number): SkyPixel[] {
  const phase = skyPhase(minuteOfDay);
  const c = SKY_COLORS[phase];
  const out: SkyPixel[] = [];
  // Cielo en dos bandas (arriba y abajo), sin degradado: se ve pixel.
  for (let y = 0; y < SKY_H - HILLS; y++) {
    const color = y < (SKY_H - HILLS) / 2 ? c.top : c.bottom;
    for (let x = 0; x < SKY_W; x++) out.push({ x, y, color });
  }
  const body = skyBody(minuteOfDay);
  // Estrellas lejos de la luna (pegadas a ella se ven como una mancha).
  if (phase === "noche") {
    for (const [x, y] of STARS) {
      const near = x >= body.x - 1 && x <= body.x + BODY && y >= body.y - 1 && y <= body.y + BODY;
      if (!near) out.push({ x, y, color: "#fff4b0" });
    }
  }
  const art = body.kind === "sun" ? SUN : MOON;
  const low = phase === "atardecer" || phase === "amanecer";
  const sunCore = low ? "#f28a3a" : "#f8d247";
  const sunShine = low ? "#f8d247" : "#fff6c4";
  art.forEach((row, dy) =>
    [...row].forEach((ch, dx) => {
      if (ch === ".") return;
      const color = ch === "Y" ? sunCore : ch === "h" ? sunShine : "#f3ecc8";
      out.push({ x: body.x + dx, y: body.y + dy, color });
    }),
  );
  // Colinas: una loma suave arriba y el pasto oscuro abajo.
  for (let x = 0; x < SKY_W; x++) {
    const bump = x >= 3 && x <= 8;
    if (bump) out.push({ x, y: SKY_H - HILLS - 1, color: c.hill });
    out.push({ x, y: SKY_H - HILLS, color: c.hill });
    out.push({ x, y: SKY_H - 1, color: c.hillDark });
  }
  return out.filter((p) => p.x >= 0 && p.x < SKY_W && p.y >= 0 && p.y < SKY_H);
}
