import { describe, expect, it } from "vitest";
import { commandSearchText, listCommands, registerCommand, registerCommandSource, subscribeCommands, type Command } from "./commands";

const cmd = (id: string, group: string, extra: Partial<Command> = {}): Command => ({ id, group, title: id, run: () => undefined, ...extra });

describe("registro de comandos de la paleta", () => {
  it("fijos y de fuente, por grupo en el orden de la paleta, sin repetir ids", () => {
    const offs = [
      registerCommand(cmd("b-abrir", "Abrir")),
      registerCommand(cmd("a-persona", "Personas")),
      registerCommand(cmd("z-otro", "Comunicación")),
      registerCommandSource(() => [cmd("c-lugar", "Lugares"), cmd("a-persona", "Personas", { title: "repetido" })]),
    ];
    const ids = listCommands().map((c) => c.id);
    expect(ids).toEqual(["a-persona", "c-lugar", "b-abrir", "z-otro"]);
    expect(listCommands().find((c) => c.id === "a-persona")?.title).toBe("a-persona");
    offs.forEach((off) => off());
    expect(listCommands()).toEqual([]);
  });

  it("`when` los esconde y una fuente que falla no rompe la lista", () => {
    let visible = false;
    const offs = [
      registerCommand(cmd("pc", "Abrir", { when: () => visible })),
      registerCommandSource(() => {
        throw new Error("se rompió");
      }),
      registerCommand(cmd("mochila", "Abrir")),
    ];
    const quiet = console.error;
    console.error = () => undefined;
    expect(listCommands().map((c) => c.id)).toEqual(["mochila"]);
    visible = true;
    expect(listCommands().map((c) => c.id)).toEqual(["pc", "mochila"]);
    console.error = quiet;
    offs.forEach((off) => off());
  });

  it("avisa al registrar y al sacar, y busca también por palabras clave", () => {
    let calls = 0;
    const unsub = subscribeCommands(() => calls++);
    const off = registerCommand(cmd("x", "Abrir", { title: "Mochila", keywords: ["inventario"] }));
    off();
    unsub();
    expect(calls).toBe(2);
    expect(commandSearchText(cmd("x", "Abrir", { title: "Mochila", keywords: ["inventario"] }))).toContain("inventario");
  });
});
