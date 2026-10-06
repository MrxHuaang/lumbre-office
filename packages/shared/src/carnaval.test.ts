import { describe, expect, it } from "vitest";
import {
  CARNAVAL,
  CARNAVAL_CINEMATICAS,
  CARNAVAL_SHOP,
  CARROZA_IDS,
  DESFILE_ORDEN,
  EVELIO_CARROZAS,
  TEJIDO,
  ola,
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

  it("el Desfile Magno sale una sola vez, a las 10 del reloj del juego (de día), con un rato de margen", () => {
    expect(desfileDeLaHora(10 * 60)).toBe(10);
    expect(desfileDeLaHora(10 * 60 + CARNAVAL.ventanaMin - 1)).toBe(10);
    expect(desfileDeLaHora(10 * 60 + CARNAVAL.ventanaMin)).toBeNull();
    for (let m = 0; m < 24 * 60; m += 5) if (desfileDeLaHora(m) !== null) expect(m).toBeLessThan(11 * 60);
    expect(desfileDeLaHora(19 * 60 + 5)).toBeNull();
    // El concurso se premia y el Carnaval cierra antes de que oscurezca (19:00).
    expect(CARNAVAL.concursoCierre).toBeLessThan(CARNAVAL.cierre);
    expect(CARNAVAL.cierre).toBeLessThan(19);
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

  it("salen las diez carrozas del plan en su orden (las nuevas antes del Megabús, que cierra), cada una con su color de acento", () => {
    const plan = ["castaneda", "condor", "galeras", "tablero", "reloj", "luna", "paramo", "minga", "tinto", "megabus"];
    expect(CARROZA_IDS.filter((id) => plan.includes(id))).toEqual(plan);
    expect(CARROZA_IDS.slice(0, 9)).toEqual(plan.slice(0, 9));
    expect(CARROZA_IDS.at(-1)).toBe("megabus");
    expect(DESFILE_ORDEN.at(-1)).toEqual({ tipo: "carroza", id: "megabus" });
    expect(COMPARSAS.map((c) => c.id)).toEqual([...CARROZA_IDS]);
    expect(new Set(COMPARSAS.map((c) => c.acento)).size).toBe(COMPARSAS.length);
    for (const c of COMPARSAS) expect(EVELIO_CARROZAS[c.id], c.id).toBeTruthy();
  });

  const prog = (id: string) => {
    const c = COMPARSAS.find((x) => x.id === id)!;
    return programarFrase(c.frase, c.bailarines.length);
  };

  it("el Tablero: los peones avanzan una casilla, giran dos veces y la reina cruza en diagonal corriendo", () => {
    const p = prog("tablero");
    for (const who of [0, 1, 2, 3]) {
      expect(p.eventos.some((e) => e.kind === "walk" && e.who === who && e.to.dx === 1 && e.to.dy === 0), `peón ${who}`).toBe(true);
      expect(p.eventos.filter((e) => e.kind === "act" && e.who === who && e.action === "girar"), `peón ${who}`).toHaveLength(2);
    }
    const reina = p.eventos.filter((e) => e.kind === "walk" && e.who === 4);
    expect(reina.every((e) => e.kind === "walk" && e.run)).toBe(true);
    expect(reina.some((e) => e.kind === "walk" && e.to.dx - e.from.dx !== 0 && Math.abs(e.to.dx - e.from.dx) === Math.abs(e.to.dy - e.from.dy))).toBe(true);
    // La reina cruza cuando los peones ya avanzaron.
    const avanzaron = Math.max(...p.eventos.filter((e) => e.kind === "walk" && e.who < 4 && e.to.dx === 1).map((e) => e.at + e.dur));
    expect(Math.min(...reina.map((e) => e.at))).toBeGreaterThanOrEqual(avanzaron);
  });

  it("la Luna: la ola en cadena, cada uno salta medio tiempo después del de al lado", () => {
    const p = prog("luna");
    const saltos = p.eventos.filter((e) => e.kind === "act" && e.action === "saltar");
    // La ida: el primer salto de cada uno, en orden, a medio tiempo.
    const ida = [0, 1, 2, 3, 4, 5].map((who) => saltos.find((e) => e.who === who)!.at);
    for (let i = 1; i < ida.length; i++) expect(ida[i]! - ida[i - 1]!).toBe(CARNAVAL.beatMs / 2);
    // La vuelta, al revés.
    const vuelta = [0, 1, 2, 3, 4, 5].map((who) => saltos.filter((e) => e.who === who)[1]!.at);
    for (let i = 1; i < vuelta.length; i++) expect(vuelta[i - 1]! - vuelta[i]!).toBe(CARNAVAL.beatMs / 2);
    expect(ola(3, "saltar", 250)).toMatchObject({ op: "together" });
  });

  it("el Páramo: los colibríes corren en zigzag delante de la carroza", () => {
    const p = prog("paramo");
    for (const who of [0, 1, 2, 3]) {
      const tramos = p.eventos.filter((e) => e.kind === "walk" && e.who === who);
      expect(tramos.every((e) => e.kind === "walk" && e.run), `colibrí ${who}`).toBe(true);
      // Van adelante (hacia +x, por delante de su puesto) y cambian de lado a cada tramo.
      expect(Math.max(...tramos.map((e) => (e.kind === "walk" ? e.to.dx : 0)))).toBeGreaterThanOrEqual(3);
      const dys = tramos.map((e) => (e.kind === "walk" ? Math.sign(e.to.dy - e.from.dy) : 0));
      for (let i = 1; i < dys.length; i++) if (dys[i] && dys[i - 1]) expect(dys[i]).not.toBe(dys[i - 1]);
    }
  });

  it("la Minga: la ronda pasa cada uno por el puesto de los demás y ofrecen la cosecha hacia la vereda", () => {
    const c = COMPARSAS.find((x) => x.id === "minga")!;
    const p = prog("minga");
    // Los puestos en la calle (relativos al de b0): columnas de a tres, cada 1.4 tiles, y fila cada 0.9.
    const puesto = (i: number) => ({ x: -Math.floor(i / 3) * 1.4, y: (i % 3) * 0.9 });
    const ronda = [0, 1, 3, 4];
    for (const who of ronda) {
      const pasa = p.eventos.filter((e) => e.kind === "walk" && e.who === who).map((e) => (e.kind === "walk" ? { x: puesto(who).x + e.to.dx, y: puesto(who).y + e.to.dy } : null));
      for (const otro of ronda)
        expect(pasa.some((q) => q && Math.abs(q.x - puesto(otro).x) < 1e-9 && Math.abs(q.y - puesto(otro).y) < 1e-9), `b${who} por el puesto de b${otro}`).toBe(true);
    }
    expect(p.eventos.some((e) => e.kind === "walk" && e.to.dy < 0)).toBe(true);
    expect(p.eventos.some((e) => e.kind === "act" && e.action === "celebrar")).toBe(true);
    // La faja de cada uno es de un color del tejido.
    for (const b of c.bailarines) expect(TEJIDO as readonly string[]).toContain(b.accent);
  });

  it("nadie tiene la piel oscurecida: el blanco y negro va en la ropa", () => {
    const pieles = new Set(COMPARSAS.flatMap((c) => c.bailarines.map((b) => b.skin)));
    expect(pieles.has("#24212e")).toBe(false);
    for (const c of COMPARSAS) for (const b of c.bailarines) expect([b.shirt, b.pants]).not.toEqual([b.skin, b.skin]);
    for (const id of ["comparsa-blanca", "arlequin-pastuso", "talco-ceniza", "sombrero-flores", "mascara-levantada"] as const) expect(COSTUMES[id].category).toBe("carnaval");
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
