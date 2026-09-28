import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Comprueba la cabecera `X-Hub-Signature-256` de GitHub ("sha256=<hex>"): HMAC-SHA256 del cuerpo crudo
 * con el secreto del webhook. Sin secreto configurado no se acepta nada.
 */
export function validGithubSignature(body: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", secret).update(body, "utf8").digest();
  // Comparación en tiempo constante (y el largo primero, porque timingSafeEqual lo exige).
  return given.length === expected.length && timingSafeEqual(given, expected);
}
