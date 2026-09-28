import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validGithubSignature } from "./github-webhook";

const sign = (body: string, secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("firma del webhook de GitHub", () => {
  const body = JSON.stringify({ action: "closed", number: 1 });

  it("acepta la firma hecha con el mismo secreto", () => {
    expect(validGithubSignature(body, sign(body, "s3creto"), "s3creto")).toBe(true);
  });

  it("rechaza otro secreto, un cuerpo cambiado o una cabecera mal formada", () => {
    expect(validGithubSignature(body, sign(body, "otro"), "s3creto")).toBe(false);
    expect(validGithubSignature(`${body} `, sign(body, "s3creto"), "s3creto")).toBe(false);
    expect(validGithubSignature(body, sign(body, "s3creto").slice(0, 20), "s3creto")).toBe(false);
    expect(validGithubSignature(body, "sha1=abc", "s3creto")).toBe(false);
    expect(validGithubSignature(body, null, "s3creto")).toBe(false);
  });

  it("sin secreto configurado no acepta nada", () => {
    expect(validGithubSignature(body, sign(body, ""), undefined)).toBe(false);
    expect(validGithubSignature(body, sign(body, ""), "")).toBe(false);
  });
});
