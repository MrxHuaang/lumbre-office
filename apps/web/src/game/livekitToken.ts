/** Margen antes del vencimiento: un token que vence en menos de esto ya no se reutiliza. */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/** Vencimiento (ms) del JWT de LiveKit (`exp`), o null si no se puede leer. No verifica la firma. */
export function tokenExpiresAt(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * ¿Sirve este token para otra conexión? La sala se abre y se cierra según haya gente cerca: se reusa el
 * mismo token mientras no esté por vencer, en vez de pedir uno en cada reconexión.
 */
export function tokenUsable(token: string, now: number, margin = TOKEN_REFRESH_MARGIN_MS): boolean {
  const exp = tokenExpiresAt(token);
  return exp !== null && exp - margin > now;
}
