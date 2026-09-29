// Lo del navegador para volver a la cabaña cuando el servidor de juego se cae, se reinicia (deploy) o
// está dormido (Render free lo apaga sin visitas). Las reglas puras están en lib/reconnect.ts.
import { create } from "zustand";
import { healthUrl, pollUntil, WAKE_DEADLINE_DEV_MS, WAKE_DEADLINE_MS } from "@/lib/reconnect";

export const GAME_SERVER_URL = process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567";
export const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Consulta /health hasta que el servidor conteste (o venza el plazo). La primera consulta es la que lo
 * despierta; así, al entrar, el WebSocket no choca contra un servidor que todavía está arrancando.
 * Devuelve si contestó (si no, se intenta entrar igual y se muestra el error).
 */
export function wakeGameServer(cancelled?: () => boolean): Promise<boolean> {
  let url: string;
  try {
    url = healthUrl(GAME_SERVER_URL);
  } catch {
    return Promise.resolve(false); // URL rara: que lo diga el intento de conexión
  }
  const check = async (timeoutMs: number) => {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  };
  return pollUntil(check, { deadlineMs: IS_DEV ? WAKE_DEADLINE_DEV_MS : WAKE_DEADLINE_MS, cancelled });
}

/** Por qué se está reconectando: el servidor avisó que se reinicia, o simplemente se cortó. */
export type ReconnectReason = "restart" | "lost";

interface ReconnectStore {
  reason: ReconnectReason | null;
  setReason: (reason: ReconnectReason | null) => void;
}

export const useReconnectStore = create<ReconnectStore>((set) => ({
  reason: null,
  setReason: (reason) => set({ reason }),
}));
