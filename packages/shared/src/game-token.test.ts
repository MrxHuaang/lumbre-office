import { describe, expect, it } from "vitest";
import { signGameToken, verifyGameToken, type GameTokenClaims } from "./game-token";

const SECRET = "a".repeat(40);
const claims: GameTokenClaims = { sub: "user_1", name: "Juanjo", avatar: "ada", role: "ADMIN" };

describe("game token", () => {
  it("firma y verifica los claims", async () => {
    const token = await signGameToken(claims, SECRET);
    await expect(verifyGameToken(token, SECRET)).resolves.toEqual(claims);
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const token = await signGameToken(claims, "b".repeat(40));
    await expect(verifyGameToken(token, SECRET)).rejects.toThrow();
  });

  it("rechaza un token expirado", async () => {
    const token = await signGameToken(claims, SECRET, "-1s");
    await expect(verifyGameToken(token, SECRET)).rejects.toThrow();
  });

  it("exige un secreto de al menos 32 caracteres", async () => {
    await expect(signGameToken(claims, "corto")).rejects.toThrow(/32/);
  });
});
