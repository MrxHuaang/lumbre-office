import { describe, expect, it } from "vitest";
import { CINEMATICAS, cineProblems, fillCine, type CineDef } from "./cinematicas";

describe("cinemáticas", () => {
  it("todas las del catálogo están bien armadas", () => {
    for (const def of Object.values(CINEMATICAS)) expect(cineProblems(def), def.id).toEqual([]);
  });

  it("el id de cada una es su clave", () => {
    for (const [k, def] of Object.entries(CINEMATICAS)) expect(def.id).toBe(k);
  });

  it("encuentra lo que está mal", () => {
    const bad: CineDef = {
      id: "mala",
      kind: "momento",
      steps: [
        { op: "bars", on: true },
        { op: "say", who: "nadie", text: "hola" },
        { op: "walk", who: "yo", to: { dx: 1, dy: 1 } },
        { op: "choice", options: [{ id: "a", label: "A" }] },
      ],
    };
    const p = cineProblems(bad);
    expect(p.some((x) => x.includes("franjas"))).toBe(true);
    expect(p.some((x) => x.includes("nadie"))).toBe(true);
    expect(p.some((x) => x.includes("el jugador no camina"))).toBe(true);
    expect(p.some((x) => x.includes("opciones"))).toBe(true);
  });

  it("los actores puestos con spawn existen después", () => {
    const ok: CineDef = {
      id: "ok",
      kind: "historia",
      steps: [
        { op: "spawn", id: "e", like: "aurora", at: { x: 1, y: 1 } },
        { op: "say", who: "e", text: "Volví." },
        { op: "despawn", id: "e" },
      ],
    };
    expect(cineProblems(ok)).toEqual([]);
  });

  it("llena las variables y deja las que no vienen", () => {
    expect(fillCine("¡{pez}! {cm} cm {x}", { pez: "Bagre", cm: 42 })).toBe("¡Bagre! 42 cm {x}");
  });
});
