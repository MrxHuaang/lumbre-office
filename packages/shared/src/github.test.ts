import { describe, expect, it } from "vitest";
import { githubPullNotice, parseGithubNoticeKinds, SystemNotice } from "./github";

const pr = (action: string, extra: Record<string, unknown> = {}) => ({
  action,
  pull_request: {
    number: 42,
    title: "feat: la radio suena en el jardín",
    merged: false,
    draft: false,
    user: { login: "ana" },
    merged_by: null,
    base: { ref: "main" },
    ...extra,
  },
  repository: { name: "lumbre" },
  sender: { login: "beto" },
});

describe("avisos de GitHub", () => {
  it("por defecto solo anuncia los PR mezclados; la variable agrega los abiertos", () => {
    expect([...parseGithubNoticeKinds(undefined)]).toEqual(["merged"]);
    expect([...parseGithubNoticeKinds("  ")]).toEqual(["merged"]);
    expect([...parseGithubNoticeKinds("Opened, merged")].sort()).toEqual(["merged", "opened"]);
    expect([...parseGithubNoticeKinds("opened,cualquiera")]).toEqual(["opened"]);
    expect([...parseGithubNoticeKinds("cualquiera")]).toEqual(["merged"]);
  });

  it("un PR mezclado se anuncia con quien lo mezcló y la rama", () => {
    const merged = pr("closed", { merged: true, merged_by: { login: "juanjo" } });
    expect(githubPullNotice("pull_request", merged, new Set(["merged"]))).toEqual({
      from: "GitHub",
      text: "juanjo mezcló el PR #42 «feat: la radio suena en el jardín» en lumbre a main.",
    });
  });

  it("un PR cerrado sin mezclar no se anuncia", () => {
    expect(githubPullNotice("pull_request", pr("closed"), new Set(["merged", "opened"]))).toBeNull();
  });

  it("abrir se anuncia solo si está configurado y no es borrador", () => {
    expect(githubPullNotice("pull_request", pr("opened"), new Set(["merged"]))).toBeNull();
    expect(githubPullNotice("pull_request", pr("opened"), new Set(["opened"]))?.text).toBe(
      "ana abrió el PR #42 «feat: la radio suena en el jardín» en lumbre.",
    );
    expect(githubPullNotice("pull_request", pr("opened", { draft: true }), new Set(["opened"]))).toBeNull();
    expect(githubPullNotice("pull_request", pr("ready_for_review"), new Set(["opened"]))?.text).toMatch(/^ana abrió/);
    expect(githubPullNotice("pull_request", pr("reopened"), new Set(["opened"]))?.text).toMatch(/^ana reabrió/);
  });

  it("ignora otros eventos, acciones y payloads raros", () => {
    const all = new Set(["merged", "opened"] as const);
    expect(githubPullNotice("push", pr("closed", { merged: true }), all)).toBeNull();
    expect(githubPullNotice("pull_request", pr("synchronize"), all)).toBeNull();
    expect(githubPullNotice("pull_request", { zen: "hola" }, all)).toBeNull();
    expect(githubPullNotice("pull_request", null, all)).toBeNull();
  });

  it("corta títulos largos y el aviso siempre cabe en el chat", () => {
    const notice = githubPullNotice("pull_request", pr("opened", { title: "x".repeat(400) }), new Set(["opened"]))!;
    expect(notice.text).toContain("…");
    expect(SystemNotice.safeParse(notice).success).toBe(true);
  });
});
