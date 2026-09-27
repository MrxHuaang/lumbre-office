// Los minijuegos de cada máquina, y la pantalla de "fuera de servicio".
import { getWorld, INTERACT_REACH_TILES, pointsOfType } from "@hyvento/map";
import type { ArcadeGame } from "@hyvento/shared";
import { Breakout } from "./breakout";
import { Flappy } from "./flappy";
import { PAL, rect, SCREEN_H, SCREEN_W, type MiniGame } from "./kit";
import { Snake } from "./snake";

export function createGame(game: ArcadeGame, seed: number): MiniGame {
  if (game === "snake") return new Snake(seed);
  if (game === "breakout") return new Breakout(seed);
  return new Flappy(seed);
}

/** ¿El juego está esperando que se lance (la pelota sobre la paleta, el pajarito antes del primer aleteo)? */
export const isWaiting = (g: MiniGame) => "waiting" in g && Boolean((g as { waiting: boolean }).waiting);

/** Estática de una máquina rota: ruido gris que se mueve y una franja que baja. */
export function drawStatic(g: CanvasRenderingContext2D, t: number) {
  rect(g, 0, 0, SCREEN_W, SCREEN_H, PAL.stone(0));
  const k = Math.floor(t / 70);
  for (let y = 0; y < SCREEN_H; y += 2)
    for (let x = 0; x < SCREEN_W; x += 2) {
      const n = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
      const v = n - Math.floor(n);
      if (v > 0.55) rect(g, x, y, 2, 2, v > 0.85 ? PAL.stone(4) : PAL.stone(2));
    }
  const band = (Math.floor(t / 16) % (SCREEN_H + 20)) - 10;
  rect(g, 0, band, SCREEN_W, 6, PAL.stone(3));
}

/** Máquina que tengo delante (índice de los puntos "arcade" del sótano), o null. */
export function machineAt(x: number, y: number): number | null {
  const map = getWorld().areas.get("sotano");
  if (!map) return null;
  const reach = INTERACT_REACH_TILES * map.tileSize;
  let best: { i: number; d: number } | null = null;
  pointsOfType(map, "arcade").forEach((p, i) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= reach && (!best || d < best.d)) best = { i, d };
  });
  return (best as { i: number; d: number } | null)?.i ?? null;
}
