import { describe, expect, it } from "vitest";
import { TOKEN_REFRESH_MARGIN_MS, tokenExpiresAt, tokenUsable } from "./livekitToken";

/** JWT de prueba (sin firma válida: solo se lee `exp`). */
function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.firma`;
}

describe("token de LiveKit", () => {
  const exp = 1_900_000_000; // segundos

  it("lee el vencimiento del JWT", () => {
    expect(tokenExpiresAt(jwt({ exp, sub: "u-1", name: "Añá ¿?" }))).toBe(exp * 1000);
  });

  it("un token roto o sin `exp` no se reutiliza", () => {
    expect(tokenExpiresAt("basura")).toBeNull();
    expect(tokenExpiresAt("a.%%%.c")).toBeNull();
    expect(tokenUsable(jwt({ sub: "u-1" }), 0)).toBe(false);
  });

  it("se reutiliza mientras no esté por vencer", () => {
    const token = jwt({ exp });
    expect(tokenUsable(token, exp * 1000 - TOKEN_REFRESH_MARGIN_MS - 1)).toBe(true);
    expect(tokenUsable(token, exp * 1000 - TOKEN_REFRESH_MARGIN_MS)).toBe(false);
    expect(tokenUsable(token, exp * 1000 + 1)).toBe(false);
  });
});
