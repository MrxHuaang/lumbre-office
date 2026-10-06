import { DIAS_POR_ESTACION, FESTIVALES, festivalById } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { rankCommands, type Command } from "./commands";
import { calendarioDelAño, directorCommands, fechaDelFestival } from "./director";

describe("panel del director", () => {
  it("el calendario tiene las cuatro estaciones de 21 días y cada festival en sus días", () => {
    const cal = calendarioDelAño();
    expect(cal.map((c) => c.estacion)).toEqual(["primavera", "verano", "otono", "invierno"]);
    for (const c of cal) expect(c.dias).toHaveLength(DIAS_POR_ESTACION);
    for (const f of FESTIVALES) {
      const dias = cal.find((c) => c.estacion === f.estacion)!.dias.filter((d) => d.festival?.id === f.id);
      expect(dias.map((d) => d.dia)).toEqual(Array.from({ length: f.dias }, (_, i) => f.dia + i));
    }
  });

  it("la fecha de un festival de varios días dice desde y hasta", () => {
    const novenas = festivalById("novenas")!;
    expect(fechaDelFestival(novenas, "invierno")).toBe(`${novenas.dia} al ${novenas.dia + novenas.dias - 1} de invierno`);
    expect(fechaDelFestival(festivalById("velitas")!, "invierno")).toBe("7 de invierno");
  });

  it("la paleta solo ofrece el panel con el permiso, y prende cada festival que no está", () => {
    const calls: string[] = [];
    const a = { open: () => calls.push("abrir"), festival: (id: string | null) => calls.push(`festival:${id}`) };
    expect(directorCommands(false, "", a)).toEqual([]);
    const cmds = directorCommands(true, "carnaval", a);
    expect(cmds.find((c) => c.id === "director:festival:carnaval")).toBeUndefined();
    cmds.find((c) => c.id === "director:abrir")!.run();
    cmds.find((c) => c.id === "director:festival:brujas")!.run();
    cmds.find((c) => c.id === "director:calendario")!.run();
    expect(calls).toEqual(["abrir", "festival:brujas", "festival:null"]);
  });

  it("en la paleta, \"director\" o \"panel\" con Enter abre el panel (no prende un festival)", () => {
    const a = { open: () => {}, festival: () => {} };
    const nada = () => {};
    // Algunos de los de siempre, para que compitan como en la paleta de verdad.
    const otros: Command[] = [
      { id: "abrir:mochila", group: "Abrir", title: "Mochila y estadísticas", keywords: ["inventario"], run: nada },
      { id: "abrir:ajustes", group: "Ajustes", title: "Ajustes", keywords: ["panel", "opciones"], run: nada },
      { id: "abrir:mapa", group: "Abrir", title: "Mapa de la cabaña", run: nada },
    ];
    for (const festivalNow of ["", "carnaval", "ano-viejo"]) {
      const all = [...otros, ...directorCommands(true, festivalNow, a)];
      for (const q of ["director", "Director", "panel", "panel del", "direc", "panel director"]) expect(rankCommands(q, all)[0]?.id, `${q} (${festivalNow})`).toBe("director:abrir");
      // Prender un festival sigue saliendo con su nombre.
      expect(rankCommands("ano viejo", all)[0]?.id).toBe(festivalNow === "ano-viejo" ? undefined : "director:festival:ano-viejo");
    }
  });
});
