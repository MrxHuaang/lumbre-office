import "server-only";
import { INTERNAL_ROUTES } from "@hyvento/shared";

/** URL HTTP del servidor de juego (por defecto, la misma de WebSocket con http/https). */
function gameServerHttpUrl(): string | null {
  const explicit = process.env.GAME_SERVER_HTTP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const ws = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  return ws ? ws.replace(/^ws/, "http").replace(/\/$/, "") : null;
}

/** Avisa al servidor de juego que cambiaron dueños o nombres de oficinas (para actualizar placas en vivo). */
export async function publishOfficesChanged() {
  const base = gameServerHttpUrl();
  const secret = process.env.GAME_TOKEN_SECRET;
  if (!base || !secret) return;
  try {
    const res = await fetch(`${base}${INTERNAL_ROUTES.officesChanged}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error(`El servidor de juego respondió ${res.status} al aviso de oficinas`);
  } catch (err) {
    // Si el servidor está dormido o caído, las placas se actualizan cuando vuelva a cargar las oficinas.
    console.error("No se pudo avisar del cambio de oficinas:", err instanceof Error ? err.message : err);
  }
}
