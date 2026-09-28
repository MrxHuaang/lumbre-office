import { describe, expect, it } from "vitest";
import { chatSuggestions } from "./chatCommands";

const member = { admin: false, dev: false };
const admin = { admin: true, dev: false };
const labels = (text: string, who = member) => chatSuggestions(text, who).map((s) => s.label);

describe("ayuda de comandos del chat", () => {
  it("sin / no sugiere nada", () => {
    expect(chatSuggestions("hola", admin)).toEqual([]);
    expect(chatSuggestions("", admin)).toEqual([]);
  });

  it("al escribir / se ven los comandos; los de admin solo para admins", () => {
    expect(labels("/")).toEqual(["/time", "/hora"]);
    const forAdmin = labels("/", admin);
    expect(forAdmin).toContain("/time add <n|nh>");
    expect(forAdmin.some((l) => l.startsWith("/time set"))).toBe(true);
    expect(forAdmin.some((l) => l.startsWith("/ir"))).toBe(false);
    expect(labels("/", { admin: false, dev: true })).toContain("/clima <tipo>");
  });

  it("filtra por lo escrito y sigue mostrando la ayuda mientras se escriben los argumentos", () => {
    expect(labels("/ho")).toEqual(["/hora"]);
    expect(labels("/time a", admin)).toEqual(["/time add <n|nh>"]);
    expect(labels("/time add 2h", admin)).toEqual(["/time add <n|nh>"]);
    expect(labels("/time add", member)).toEqual([]);
  });

  it("en /time set ofrece los nombres de hora", () => {
    const s = chatSuggestions("/time set me", admin);
    expect(s.map((x) => x.insert)).toEqual(["/time set mediodia", "/time set medianoche"]);
    expect(s[0]!.help).toBe("Las 12:00");
    // Con la hora ya escrita queda la ayuda del comando.
    expect(labels("/time set 18:30", admin)[0]).toMatch(/^\/time set </);
  });
});
