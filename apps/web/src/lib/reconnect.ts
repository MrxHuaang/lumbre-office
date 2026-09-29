// Reconexión con el servidor de juego: qué hacer según cómo se cerró la sala, cuánto esperar entre
// intentos y cómo despertar al servidor dormido (Render free lo apaga sin visitas). Todo puro (el reloj
// y la red se inyectan) para probarlo; lo usan game/network.ts y game/wake.ts.
import { CLOSE_CODE, INTERNAL_ROUTES, RECONNECT_WINDOW_SECONDS, RESTART_CLOSE_CODE } from "@hyvento/shared";

// ---------- Cierre de la sala ----------

/**
 * Qué hacer cuando la sala se cierra sin que la soltáramos nosotros (nuestro `disconnect()` ya se filtró
 * antes). Solo "otra pestaña entró" no se reintenta: se expulsarían mutuamente. Todo lo demás —caída de
 * red, 1000/4000 de un servidor que se apaga (Colyseus cierra así en cada deploy) o el reinicio avisado—
 * se reintenta; tras un reinicio la sala vieja ya no existe, así que se entra de nuevo con token nuevo.
 */
export function leaveAction(code: number): "replaced" | "restart" | "retry" {
  if (code === CLOSE_CODE.replaced) return "replaced";
  if (code === RESTART_CLOSE_CODE) return "restart";
  return "retry";
}

// ---------- Esperas entre intentos ----------

/** Cuánto se sigue intentando tras una caída: la ventana del servidor más un margen para entrar de nuevo. */
export const RECONNECT_BUDGET_MS = RECONNECT_WINDOW_SECONDS * 1000 + 10_000;
/** Tras un reinicio el servidor nuevo puede tardar en arrancar: se espera más. */
export const RESTART_BUDGET_MS = 60_000;

const FIRST_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

/** Esperas antes de cada intento: 0,5 s, 1, 2, 4 y después de a 5 s, sin pasarse del presupuesto. */
export function reconnectDelays(budgetMs = RECONNECT_BUDGET_MS): number[] {
  const out: number[] = [];
  let total = 0;
  for (let delay = FIRST_DELAY_MS; total + delay <= budgetMs; delay = Math.min(MAX_DELAY_MS, delay * 2)) {
    out.push(delay);
    total += delay;
  }
  return out;
}

/** ±25 % de azar (`random` en 0..1): tras un reinicio no vuelven todos en el mismo milisegundo. */
export const withJitter = (ms: number, random: number) => Math.round(ms * (0.75 + Math.min(1, Math.max(0, random)) * 0.5));

/**
 * ¿El servidor contestó que esa reconexión ya no existe (sala cerrada o lugar vencido)? Colyseus lo dice
 * con un MatchMakeError (códigos 4xxx): insistir no sirve, hay que entrar de nuevo. Una caída de red o un
 * 5xx del hosting mientras arranca, en cambio, se reintentan igual.
 */
export function isDeadReconnection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, code } = err as { name?: unknown; code?: unknown };
  if (name === "MatchMakeError") return true;
  return typeof code === "number" && code >= 4000 && code < 5000;
}

/**
 * ¿El servidor no está (red caída, apagado o el hosting respondiendo 5xx mientras arranca)? Al entrar se
 * muestra el aviso de "no contesta" en vez del mensaje técnico.
 */
export function isServerUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { type, code, name, message } = err as { type?: unknown; code?: unknown; name?: unknown; message?: unknown };
  if (type === "error") return true; // el XHR del matchmaking falló (sin respuesta)
  if (typeof code === "number" && code >= 500 && code < 600) return true;
  return name === "TypeError" && typeof message === "string" && /fetch|network/i.test(message);
}

// ---------- Despertar al servidor ----------

/** El chequeo de salud del servidor de juego a partir de su URL de WebSocket (ws→http, wss→https). */
export function healthUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  if (url.protocol === "ws:") url.protocol = "http:";
  else if (url.protocol === "wss:") url.protocol = "https:";
  url.pathname = url.pathname.replace(/\/+$/, "") + INTERNAL_ROUTES.health;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Lo máximo que se espera al servidor dormido antes de intentar entrar igual (y mostrar el error). */
export const WAKE_DEADLINE_MS = 60_000;
/** En desarrollo no hay nada que despertar: si no contesta enseguida, mejor el aviso de `pnpm dev`. */
export const WAKE_DEADLINE_DEV_MS = 4_000;
/** Tope de cada consulta: el proxy de Render retiene la primera mientras el servidor arranca. */
const WAKE_TRY_MS = 15_000;
const WAKE_PAUSE_MS = 2_000;

interface PollOptions {
  deadlineMs: number;
  pauseMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  cancelled?: () => boolean;
}

/**
 * Repite `check` (que recibe cuánto puede tardar) hasta que diga que sí o se acabe el plazo. Un error
 * cuenta como "todavía no". Devuelve si lo logró.
 */
export async function pollUntil(check: (timeoutMs: number) => Promise<boolean>, opts: PollOptions): Promise<boolean> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms)));
  const end = now() + opts.deadlineMs;
  for (;;) {
    if (opts.cancelled?.()) return false;
    const left = end - now();
    if (left <= 0) return false;
    if (await check(Math.min(WAKE_TRY_MS, left)).catch(() => false)) return true;
    const rest = end - now();
    if (rest <= 0 || opts.cancelled?.()) return false;
    await sleep(Math.min(opts.pauseMs ?? WAKE_PAUSE_MS, rest));
  }
}

// ---------- Textos ----------

/** Sin servidor al entrar: en desarrollo, la pista de siempre; en producción, algo que le sirva a cualquiera. */
export function unreachableText(dev: boolean): string {
  return dev
    ? "No se pudo conectar con el servidor de juego. ¿Está corriendo `pnpm dev`?"
    : "La cabaña no contesta todavía: puede estar despertando o actualizándose. Espera un momentico y dale a Reintentar.";
}
