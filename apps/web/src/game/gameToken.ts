/** La sesión de la web venció: ya se mandó a /login, no tiene sentido reintentar. */
export class SessionExpiredError extends Error {}

/** Pide a la web el token firmado para entrar al servidor de juego (al entrar y al volver tras un reinicio). */
export async function fetchGameToken(): Promise<string> {
  const res = await fetch("/api/game-token", { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new SessionExpiredError("Sesión expirada");
  }
  const body = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!res.ok || !body?.token) throw new Error(body?.error ?? "No se pudo obtener el acceso a la cabaña");
  return body.token;
}
