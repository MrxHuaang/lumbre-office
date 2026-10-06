import { STORY_PERIOD, questKey, type QuestView } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { accionDeOpcion, charlaDeEncargos, MAX_ENTREGAS, pasoDeHistoria } from "./encargosCharla";

const OLLA = questKey("evelio-olla", "d:2026-10-05");

const q = (questId: string, o: Partial<QuestView> = {}): QuestView => ({
  questId,
  period: "d:2026-10-05",
  goal: 3,
  progress: 1,
  status: "ACTIVE",
  shared: false,
  late: false,
  ...o,
});

const ids = (c: { opciones: { id: string }[] }) => c.opciones.map((o) => o.id);

describe("la charla con quien da encargos", () => {
  it("sin nada pendiente: el saludo, que vuelva mañana y despedirse", () => {
    const c = charlaDeEncargos("evelio", [], "¡Ve, mijo!");
    expect(c.lineas[0]).toBe("¡Ve, mijo!");
    expect(c.lineas).toHaveLength(2);
    expect(ids(c)).toEqual(["chao"]);
  });

  it("uno en curso: cuánto lleva y \"Ver encargos\"; listo: \"Entregar\"", () => {
    const enCurso = charlaDeEncargos("evelio", [q("evelio-olla")], "Hola");
    expect(enCurso.lineas[1]).toContain("1/3");
    expect(ids(enCurso)).toEqual(["ver", "chao"]);
    const listo = charlaDeEncargos("evelio", [q("evelio-olla", { status: "DONE", progress: 3 })], "Hola");
    expect(ids(listo)).toEqual([`entregar:${OLLA}`, "ver", "chao"]);
    expect(listo.opciones[0]!.label).toBe("Entregar");
    expect(accionDeOpcion(listo.opciones[0]!.id)).toEqual({ tipo: "entregar", key: OLLA });
  });

  it("varios listos: uno por uno con su título, hasta el máximo; lo de otro no cuenta", () => {
    const quests = ["tablon-tinto", "tablon-sembrar", "tablon-cosecha", "tablon-tina"].map((id) => q(id, { status: "DONE", progress: 3 }));
    const c = charlaDeEncargos("tablon", [...quests, q("evelio-olla", { status: "DONE" })], "Una nota dice:");
    const entregas = c.opciones.filter((o) => o.id.startsWith("entregar:"));
    expect(entregas).toHaveLength(MAX_ENTREGAS);
    expect(entregas[0]!.label).toContain("«");
    expect(c.lineas[1]).toContain("4");
    expect(c.opciones.at(-1)!.label).toBe("Dejar el tablón");
  });

  it("después de entregar: las gracias sin lo entregado y sin repetir que vuelva mañana", () => {
    const listo = q("evelio-olla", { status: "DONE", progress: 3 });
    const c = charlaDeEncargos("evelio", [listo], "¡Gracias, mijo!", { entregado: OLLA, gracias: true });
    expect(c.lineas).toEqual(["¡Gracias, mijo!"]);
    expect(ids(c)).toEqual(["chao"]);
  });

  it("el paso de la historia: el consejo, saludar a Doña Aurora y lo que se le pregunta", () => {
    const paso3 = q("llegada-3", { period: STORY_PERIOD, goal: 1, progress: 0 });
    expect(pasoDeHistoria([paso3])).toBe(paso3);
    const aurora = charlaDeEncargos("aurora", [paso3], "Venga, mijo.");
    expect(aurora.lineas.length).toBe(3);
    expect(ids(aurora)).toContain("saludar");
    expect(accionDeOpcion("saludar")).toEqual({ tipo: "saludar" });
    // A otro no le toca ese paso.
    expect(ids(charlaDeEncargos("evelio", [paso3], "Hola"))).not.toContain("saludar");
    const llave = q("llave-1", { period: STORY_PERIOD, goal: 1, progress: 0 });
    const celeste = charlaDeEncargos("celeste", [llave], "Hola");
    const preguntar = celeste.opciones.find((o) => o.id.startsWith("preguntar:"));
    expect(preguntar?.label).toBe("Preguntarle por el agua que brilla");
    expect(accionDeOpcion(preguntar!.id)).toEqual({ tipo: "preguntar", questId: "llave-1" });
    // Cumplido (por entregar): ya no se pregunta.
    expect(ids(charlaDeEncargos("celeste", [{ ...llave, status: "DONE" }], "Hola")).some((id) => id.startsWith("preguntar:"))).toBe(false);
  });
});
