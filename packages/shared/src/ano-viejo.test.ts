import { describe, expect, it } from "vitest";
import { STAT_KEYS } from "./achievements";
import {
  AGUEROS,
  ANO_VIEJO_BAG_OBJECTS,
  ANO_VIEJO_CINEMATICAS,
  ANO_VIEJO_SHOP,
  aporteDe,
  agueroStatKey,
  avanzarMaleta,
  cleanTestamento,
  etapaMuneco,
  faltaMuneco,
  festivalFueKey,
  finCampanadas,
  juzgarUva,
  MALETA,
  MALETA_RUTA,
  MUNECO,
  paradaMaletaEn,
  PRENDAS_MUNECO,
  RELLENOS_MUNECO,
  resumenBaseKey,
  resumenDelAno,
  TESTAMENTO,
  tieneGroseria,
  TRAJE_AMARILLO,
  UVAS,
  type Campanadas,
} from "./ano-viejo";
import { BAG_OBJECTS } from "./bolsa";
import { cineById, cineProblems } from "./cinematicas";
import { COSTUMES } from "./costumes";
import { FESTIVAL_IDS } from "./festivales";

describe("año viejo: el muñeco", () => {
  it("crece por etapas con prendas y relleno (las dos cosas)", () => {
    expect(etapaMuneco(0, 0)).toBe(0);
    expect(etapaMuneco(5, 0)).toBe(0);
    expect(etapaMuneco(1, 1)).toBe(1);
    expect(etapaMuneco(2, 3)).toBe(2);
    expect(etapaMuneco(4, 5)).toBe(3);
    expect(etapaMuneco(6, 7)).toBe(4);
    expect(etapaMuneco(60, 70)).toBe(MUNECO.etapas.length);
    expect(MUNECO.nombres.length).toBe(MUNECO.etapas.length + 1);
    expect(faltaMuneco(1, 1)).toEqual({ prendas: 1, rellenos: 2 });
    expect(faltaMuneco(6, 7)).toBeNull();
    // Hacen falta varios: una sola persona no lo termina.
    const ultima = MUNECO.etapas.at(-1)!;
    expect(ultima.prendas + ultima.rellenos).toBeGreaterThan(MUNECO.porPersona);
  });

  it("sirven las prendas viejas y el relleno de la mochila, nada más", () => {
    for (const p of PRENDAS_MUNECO) {
      expect(aporteDe(p)).toBe("prenda");
      expect(BAG_OBJECTS[p], p).toBeDefined();
    }
    for (const r of RELLENOS_MUNECO) expect(aporteDe(r)).toBe("relleno");
    expect(aporteDe("tinto")).toBeNull();
    for (const id of Object.keys(ANO_VIEJO_BAG_OBJECTS)) expect(BAG_OBJECTS[id]).toBeDefined();
    for (const i of ANO_VIEJO_SHOP) expect(BAG_OBJECTS[i.id], i.id).toBeDefined();
  });
});

describe("año viejo: el testamento", () => {
  it("un renglón, corto, sin enlaces ni groserías", () => {
    expect(cleanTestamento("  Dejo   mis ganas\nde madrugar ")).toEqual({ ok: true, text: "Dejo mis ganas de madrugar" });
    expect(cleanTestamento("   ")).toEqual({ ok: false, error: "vacio" });
    expect(cleanTestamento("a".repeat(TESTAMENTO.max + 1))).toEqual({ ok: false, error: "largo" });
    expect(cleanTestamento("Dejo esto en www.algo.com")).toEqual({ ok: false, error: "enlace" });
    expect(cleanTestamento("vean mi-pagina.co")).toEqual({ ok: false, error: "enlace" });
    expect(cleanTestamento("Dejo al jefe por malparido")).toEqual({ ok: false, error: "grosero" });
  });

  it("las groserías no se esconden con tildes, números ni letras repetidas; las palabras normales pasan", () => {
    expect(tieneGroseria("qué MIÉRDA")).toBe(true);
    expect(tieneGroseria("pendejadas")).toBe(true);
    expect(tieneGroseria("m1erda")).toBe(true);
    expect(tieneGroseria("perrrrra")).toBe(true);
    expect(tieneGroseria("Dejo una pera, un computador y la película del sábado")).toBe(false);
    expect(tieneGroseria("Le dejo el perro a Mariana")).toBe(false);
  });
});

describe("año viejo: las doce uvas", () => {
  const c: Campanadas = { inicio: 10_000, intervalo: UVAS.intervaloMs, n: UVAS.n };
  const bell = (k: number) => c.inicio + k * c.intervalo;

  it("una uva por campanada, a tiempo y en orden", () => {
    for (let k = 0; k < UVAS.n; k++) expect(juzgarUva(c, k, bell(k) + 200)).toEqual({ ok: true, k });
    expect(juzgarUva(c, UVAS.n, bell(11) + 300)).toEqual({ ok: false, error: "fin" });
  });

  it("antes de su campanada es esperar (no se pierde); después, se pasó", () => {
    expect(juzgarUva(c, 0, c.inicio - 2000)).toEqual({ ok: false, error: "espera" });
    // Dos uvas en la misma campanada: la segunda espera a la que sigue.
    expect(juzgarUva(c, 1, bell(0) + 300)).toEqual({ ok: false, error: "espera" });
    expect(juzgarUva(c, 1, bell(1) - UVAS.antesMs + 1)).toMatchObject({ ok: true });
    // Saltarse una campanada: ya no salen las doce en esta tanda.
    expect(juzgarUva(c, 3, bell(4) + 100)).toEqual({ ok: false, error: "tarde" });
    expect(juzgarUva(c, 0, finCampanadas(c) + 10)).toEqual({ ok: false, error: "fin" });
  });
});

describe("año viejo: la maleta", () => {
  it("la vuelta sale de la plaza, pasa por las paradas en orden y vuelve", () => {
    const t0 = 1_000;
    let r = avanzarMaleta(null, 2, t0);
    expect(r).toEqual({ v: null, evento: null });
    r = avanzarMaleta(null, 0, t0);
    expect(r.evento).toBe("salida");
    let v = r.v;
    // Una parada fuera de orden no cuenta.
    expect(avanzarMaleta(v, 3, t0 + 1000)).toEqual({ v, evento: null });
    for (let k = 1; k < MALETA_RUTA.length; k++) {
      r = avanzarMaleta(v, k, t0 + k * 8000);
      expect(r.evento).toBe("parada");
      v = r.v;
    }
    expect(v?.siguiente).toBe(0);
    expect(avanzarMaleta(v, 0, t0 + MALETA_RUTA.length * 8000).evento).toBe("llegada");
  });

  it("muy rápida no cuenta y muy lenta se pierde", () => {
    let v = avanzarMaleta(null, 0, 0).v;
    for (let k = 1; k < MALETA_RUTA.length; k++) v = avanzarMaleta(v, k, k * 100).v;
    expect(avanzarMaleta(v, 0, MALETA.minMs - 1).evento).toBe("rapido");
    const slow = avanzarMaleta(null, 0, 0).v;
    expect(avanzarMaleta(slow, -1, MALETA.maxMs + 1)).toEqual({ v: null, evento: "tarde" });
  });

  it("las paradas están separadas (no se cuentan dos a la vez)", () => {
    for (const [i, p] of MALETA_RUTA.entries()) expect(paradaMaletaEn(p.x + 0.5, p.y + 0.5)).toBe(i);
    expect(paradaMaletaEn(0, 0)).toBe(-1);
  });
});

describe("año viejo: los agüeros y el resumen del año", () => {
  it("cuatro agüeros con su marca por año, y la ropa amarilla es un traje del editor", () => {
    expect(AGUEROS.length).toBe(4);
    expect(agueroStatKey(2, "uvas")).toBe("festival:ano-viejo:2:aguero:uvas");
    expect(COSTUMES[TRAJE_AMARILLO].category).toBe("ano-viejo");
  });

  it("el resumen sale de los contadores: lo del año es lo de ahora menos lo del año viejo anterior", () => {
    const stats: Record<string, number> = {
      [STAT_KEYS.fishCaught]: 30,
      [STAT_KEYS.harvests]: 12,
      [STAT_KEYS.storyCh1]: 1,
      [STAT_KEYS.storyCh2]: 1,
      [resumenBaseKey("peces")]: 20,
      [resumenBaseKey("cosechas")]: 12,
      [resumenBaseKey("historia")]: 1,
      [festivalFueKey("velitas", 3)]: 1,
      [festivalFueKey("ano-viejo", 3)]: 1,
      [festivalFueKey("velitas", 2)]: 1,
      [agueroStatKey(3, "uvas")]: 1,
    };
    const { resumen, bases } = resumenDelAno((k) => stats[k], 3, FESTIVAL_IDS);
    expect(resumen.desdeQueLlego).toBe(false);
    // Lo que nunca se contó (platos, logros) no sale: no se inventa.
    expect(resumen.filas).toEqual([
      { id: "peces", label: "Peces sacados", n: 10 },
      { id: "cosechas", label: "Cosechas", n: 0 },
      { id: "historia", label: "Capítulos de la historia", n: 1 },
    ]);
    expect(resumen.festivales).toBe(2);
    expect(resumen.agueros).toEqual(["uvas"]);
    expect(bases).toEqual({ [resumenBaseKey("peces")]: 30, [resumenBaseKey("cosechas")]: 12, [resumenBaseKey("historia")]: 2 });
    // Sin año viejo anterior: es "desde que llegó".
    expect(resumenDelAno((k) => (k === STAT_KEYS.fishCaught ? 4 : undefined), 1, FESTIVAL_IDS).resumen).toMatchObject({ desdeQueLlego: true, filas: [{ id: "peces", n: 4 }] });
  });

  it("las cinemáticas están bien escritas", () => {
    for (const def of ANO_VIEJO_CINEMATICAS) {
      expect(cineProblems(def), def.id).toEqual([]);
      expect(cineById(def.id)).toBe(def);
    }
  });
});
