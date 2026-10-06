import { describe, expect, it } from "vitest";
import {
  CARNAVAL,
  CARNAVAL_CINEMATICAS,
  CARNAVAL_SHOP,
  COMPARSAS,
  concursoAbierto,
  desfileDeLaHora,
  fraseAcciones,
  frasePose,
  ganadorDelConcurso,
  programarFrase,
  quienes,
} from "./carnaval";
import { BAG_OBJECTS } from "./bolsa";
import { CINEMATICAS, cineProblems } from "./cinematicas";
import { COSTUMES } from "./costumes";
import { festivalById } from "./festivales";

describe("el Carnaval de Negros y Blancos", () => {
  it("es el día 18 del verano", () => {
    expect(festivalById(CARNAVAL.id)).toMatchObject({ estacion: "verano", dia: 18 });
  });

  it("el desfile sale a las 11, a las 15 y a las 19 del reloj del juego, con un rato de margen", () => {
    expect(desfileDeLaHora(11 * 60)).toBe(11);
    expect(desfileDeLaHora(15 * 60 + CARNAVAL.ventanaMin - 1)).toBe(15);
    expect(desfileDeLaHora(15 * 60 + CARNAVAL.ventanaMin)).toBeNull();
    expect(desfileDeLaHora(19 * 60 + 5)).toBe(19);
    expect(desfileDeLaHora(12 * 60)).toBeNull();
  });

  it("cada coreografía vuelve al puesto al terminar (así se repite en bucle sin saltos)", () => {
    for (const c of COMPARSAS) {
      const prog = programarFrase(c.frase, c.bailarines.length);
      expect(prog.ms, c.id).toBeGreaterThan(1000);
      for (let i = 0; i < c.bailarines.length; i++) {
        const end = frasePose(prog, i, prog.ms);
        expect([end.dx, end.dy], `${c.id} b${i}`).toEqual([0, 0]);
      }
      // Cada bailarín hace algo en la frase.
      for (let i = 0; i < c.bailarines.length; i++) expect(prog.eventos.some((e) => e.who === i), `${c.id} b${i}`).toBe(true);
    }
  });

  it("la frase se mide en el tiempo: quien llega a la mitad ve a cada bailarín donde va", () => {
    const galeras = COMPARSAS.find((c) => c.id === "galeras")!;
    const prog = programarFrase(galeras.frase, 4);
    // Corriendo en círculo: a mitad del primer tramo, el bailarín 0 va camino a (0.8, 0).
    const first = prog.eventos.find((e) => e.kind === "walk" && e.who === 0)!;
    const mid = frasePose(prog, 0, first.at + first.dur / 2);
    expect(mid.walking).toBe(true);
    expect(mid.dx).toBeCloseTo(0.4, 5);
    // Las acciones salen una sola vez por vuelta.
    const all = fraseAcciones(prog, -1, prog.ms);
    expect(all.length).toBe(prog.eventos.filter((e) => e.kind === "act").length);
    expect(fraseAcciones(prog, prog.ms, prog.ms + 1000)).toHaveLength(0);
    expect(quienes("pares", 4)).toEqual([0, 2]);
    expect(quienes("b9", 4)).toEqual([]);
  });

  it("nadie tiene la piel oscurecida: el blanco y negro va en la ropa", () => {
    const pieles = new Set(COMPARSAS.flatMap((c) => c.bailarines.map((b) => b.skin)));
    expect(pieles.has("#24212e")).toBe(false);
    for (const c of COMPARSAS) for (const b of c.bailarines) expect([b.shirt, b.pants]).not.toEqual([b.skin, b.skin]);
    for (const id of ["comparsa-blanca", "arlequin-pastuso", "talco-ceniza"] as const) expect(COSTUMES[id].category).toBe("carnaval");
  });

  it("gana el más votado y, si empatan, quien se postuló primero; sin votos no gana nadie", () => {
    expect(ganadorDelConcurso([])).toBeNull();
    expect(ganadorDelConcurso([{ userId: "a", votos: 0, at: 1 }])).toBeNull();
    expect(ganadorDelConcurso([{ userId: "a", votos: 2, at: 5 }, { userId: "b", votos: 3, at: 9 }])?.userId).toBe("b");
    expect(ganadorDelConcurso([{ userId: "a", votos: 3, at: 5 }, { userId: "b", votos: 3, at: 2 }])?.userId).toBe("b");
    expect(concursoAbierto(CARNAVAL.concursoCierre * 60 - 1)).toBe(true);
    expect(concursoAbierto(CARNAVAL.concursoCierre * 60)).toBe(false);
  });

  it("lo de la tienda está en la mochila y las cinemáticas están en el catálogo y son válidas", () => {
    for (const item of CARNAVAL_SHOP) expect(BAG_OBJECTS[item.id], item.id).toBeDefined();
    for (const def of CARNAVAL_CINEMATICAS) {
      expect(CINEMATICAS[def.id]).toBe(def);
      expect(cineProblems(def), def.id).toEqual([]);
    }
  });
});
