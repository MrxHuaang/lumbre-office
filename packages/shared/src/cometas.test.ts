import { describe, expect, it } from "vitest";
import { bagItemInfo } from "./bolsa";
import { CINEMATICAS, cineProblems } from "./cinematicas";
import { COMETA_COLORES, COMETA_FORMAS, cometaCode, cometaCodeOf, cometaMateriales, cometaName, cometaPartes, validCometaCode } from "./cometa";
import { advanceVuelo, autoVuelo, CometaSim, sePuedeVolar, VUELO, vientoDelClima, vientoRumbo } from "./cometa-vuelo";
import { COMETAS_CINE, COMETAS_CINEMATICAS, cometaGanadora, COMETAS_SHOP, faltanMateriales } from "./cometas";
import { festivalById } from "./festivales";
import { WEATHERS } from "./weather";

describe("la cometa en el id del objeto", () => {
  it("el código lleva forma, dos colores y cola; lo demás no sirve", () => {
    const code = cometaCode({ forma: "p", color1: "r", color2: "a", cola: 3 });
    expect(code).toBe("pra3");
    expect(cometaPartes(code)).toEqual({ forma: "pajaro", color1: "r", color2: "a", cola: 3 });
    expect(cometaCodeOf(`obj:cometa:${code}`)).toBe(code);
    expect(cometaCodeOf("cometa:xxa2")).toBeNull();
    expect(validCometaCode("rra4")).toBe(false);
    expect(cometaName("rrr2")).toBe("Cometa de rombo roja");
    expect(cometaName("zza3")).toBe("Cometa pez azul y amarilla");
    expect(bagItemInfo(`obj:cometa:${code}`).name).toBe("Cometa pájaro roja y amarilla");
  });

  it("gasta papel, palitos y cabuya (un palito más la hexagonal y el pájaro)", () => {
    expect(cometaMateriales("rra2")).toEqual({ "papel-seda": 2, "palitos-guadua": 2, "carrete-cabuya": 1 });
    expect(cometaMateriales("hra2")["palitos-guadua"]).toBe(3);
    expect(faltanMateriales("pra2", (i) => (i === "papel-seda" ? 2 : 1))).toEqual({ "palitos-guadua": 2 });
    for (const f of Object.keys(COMETA_FORMAS)) for (const c of Object.keys(COMETA_COLORES)) expect(validCometaCode(`${f}${c}${c}1`)).toBe(true);
  });
});

describe("el vuelo", () => {
  it("el viento sale del clima: más con nubes o niebla, poco despejado y nada con lluvia, tormenta o nieve", () => {
    expect(vientoDelClima("nublado")).toBeGreaterThan(vientoDelClima("despejado"));
    expect(vientoDelClima("niebla")).toBeGreaterThan(vientoDelClima("despejado"));
    for (const w of ["lluvia", "tormenta", "nieve"] as const) expect(sePuedeVolar(w)).toBe(false);
    for (const w of WEATHERS) expect(vientoDelClima(w)).toBeGreaterThanOrEqual(0);
    expect(vientoRumbo(3, 600)).toBe(vientoRumbo(3, 600));
  });

  it("es determinista: el mismo vuelo repetido por pedazos da la misma altura", () => {
    const setup = { seed: 4242, viento: vientoDelClima("nublado"), code: "rra2" };
    const run = autoVuelo(setup, { hasta: 1500 });
    const sim = new CometaSim(setup);
    const hold = { hold: false };
    // Como lo manda el navegador: de a pedazos.
    for (let f = 300; f <= run.frames; f += 300) expect(advanceVuelo(sim, hold, run.toggles.filter((t) => t >= sim.frame && t < f), f)).toBe(true);
    expect(advanceVuelo(sim, hold, run.toggles.filter((t) => t >= sim.frame), run.frames)).toBe(true);
    expect(sim.altura).toBe(run.sim.altura);
    expect(sim.tension).toBe(run.sim.tension);
  });

  it("rechaza botones desordenados, hacia atrás o más allá del tope", () => {
    const sim = new CometaSim({ seed: 1, viento: 0.85, code: "rra2" });
    expect(advanceVuelo(sim, { hold: false }, [5, 3], 10)).toBe(false);
    expect(advanceVuelo(sim, { hold: false }, [], VUELO.maxFrames + 1)).toBe(false);
    const hold = { hold: false };
    expect(advanceVuelo(sim, hold, [0, 8], 20)).toBe(true);
    expect(sim.frame).toBe(20);
    expect(advanceVuelo(sim, hold, [10], 40)).toBe(false);
    expect(advanceVuelo(sim, hold, [], 10)).toBe(false);
  });

  it("jalando bien sube; sin jalar se viene al suelo; jalando sin parar se revienta la cabuya", () => {
    const setup = { seed: 77, viento: vientoDelClima("nublado"), code: "rra2" };
    expect(autoVuelo(setup, { hasta: 1800 }).sim.altura).toBeGreaterThan(80);
    const suelto = new CometaSim(setup);
    advanceVuelo(suelto, { hold: false }, [], VUELO.maxFrames);
    expect(suelto.fin).toBe("caida");
    const jalando = new CometaSim(setup);
    advanceVuelo(jalando, { hold: false }, [0], VUELO.maxFrames);
    expect(jalando.fin).toBe("rota");
    expect(jalando.frame).toBeLessThan(VUELO_HZ_SEC(5));
  });

  it("con más viento sube más (en el mismo tiempo, jugando igual)", () => {
    const alt = (w: "despejado" | "nublado") => autoVuelo({ seed: 9, viento: vientoDelClima(w), code: "zra3" }, { hasta: 1200 }).sim.altura;
    expect(alt("nublado")).toBeGreaterThan(alt("despejado"));
  });
});

const VUELO_HZ_SEC = (s: number) => s * 30;

describe("el concurso, el puesto y las cinemáticas", () => {
  it("gana la más votada; en empate, la que se inscribió primero; sin votos, nadie", () => {
    expect(cometaGanadora([{ votes: 0, at: 1 }])).toBeNull();
    expect(cometaGanadora([{ votes: 2, at: 5 }, { votes: 2, at: 3 }, { votes: 1, at: 1 }])).toEqual({ votes: 2, at: 3 });
  });

  it("el puesto vende los materiales y lo del carrito; todo existe en la mochila", () => {
    for (const i of COMETAS_SHOP) expect(bagItemInfo(`obj:${i.id}`).name, i.id).not.toMatch(/^[a-z]/);
    expect(COMETAS_SHOP.some((i) => i.tab === "refrescos")).toBe(true);
  });

  it("las cinemáticas están en el catálogo y no tienen problemas", () => {
    for (const def of COMETAS_CINEMATICAS) {
      expect(CINEMATICAS[def.id]).toBe(def);
      expect(cineProblems(def)).toEqual([]);
    }
    expect(CINEMATICAS[COMETAS_CINE.premiacion]).toBeDefined();
    expect(festivalById("cometas")?.dia).toBe(9);
  });
});
