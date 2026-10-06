import { describe, expect, it } from "vitest";
import {
  AMOR,
  AMOR_CINEMATICAS,
  AMOR_SHOP,
  amigosDe,
  amorActivo,
  amorRefId,
  esGrosero,
  limpiarTexto,
  regalable,
  revelacionCine,
  serenataCine,
  sortearAmigos,
  TRIO_SERENATA,
  type Pareja,
} from "./amor-amistad";
import { BAG_OBJECTS, bagItemInfo } from "./bolsa";
import { cineById, cineProblems } from "./cinematicas";
import { CONSUMABLES } from "./consumables";

/** Un azar fijo (siempre el mismo orden) para que el test no dependa de la suerte. */
function semilla(n: number) {
  let s = n;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe("el sorteo del amigo secreto", () => {
  it("una ronda: cada uno regala y recibe una vez, y nadie se saca a sí mismo", () => {
    for (let n = 2; n <= 12; n++)
      for (let seed = 1; seed < 30; seed++) {
        const gente = Array.from({ length: n }, (_, i) => `u${i}`);
        const p = sortearAmigos(gente, [], semilla(seed));
        expect(p).toHaveLength(n);
        expect(p.every((x) => x.de !== x.para)).toBe(true);
        expect(new Set(p.map((x) => x.de)).size).toBe(n);
        expect(new Set(p.map((x) => x.para)).size).toBe(n);
      }
  });

  it("uno solo no se sortea, ni con `solo` si no hay más gente", () => {
    expect(sortearAmigos(["a"], [], Math.random)).toEqual([]);
    expect(sortearAmigos(["a"], [], Math.random, { solo: true })).toEqual([]);
  });

  it("los que llegan tarde hacen su propia ronda sin tocar las parejas que ya había", () => {
    const antes = sortearAmigos(["a", "b", "c"], [], semilla(3));
    const nuevas = sortearAmigos(["a", "b", "c", "d", "e"], antes, semilla(5));
    expect(nuevas).toHaveLength(2);
    expect(new Set(nuevas.flatMap((p) => [p.de, p.para]))).toEqual(new Set(["d", "e"]));
    // Ya están todos: no sale nada más.
    expect(sortearAmigos(["a", "b", "c", "d", "e"], [...antes, ...nuevas], semilla(7), { solo: true })).toEqual([]);
  });

  it("un tardío solo entra sin romper parejas: le regala a alguien y alguien le regala", () => {
    for (let seed = 1; seed < 40; seed++) {
      const antes: Pareja[] = sortearAmigos(["a", "b", "c", "d"], [], semilla(seed));
      expect(sortearAmigos(["a", "b", "c", "d", "x"], antes, semilla(seed))).toEqual([]);
      const nuevas = sortearAmigos(["a", "b", "c", "d", "x"], antes, semilla(seed), { solo: true });
      expect(nuevas).toHaveLength(2);
      const todas = [...antes, ...nuevas];
      // Las de antes siguen intactas, nadie se regala a sí mismo y x da y recibe.
      expect(todas.slice(0, antes.length)).toEqual(antes);
      expect(todas.every((p) => p.de !== p.para)).toBe(true);
      expect(amigosDe(todas, "x")).toHaveLength(1);
      expect(todas.filter((p) => p.para === "x")).toHaveLength(1);
      // Y un segundo tardío no cae sobre el mismo que ya quedó con dos.
      const y = sortearAmigos(["a", "b", "c", "d", "x", "y"], todas, semilla(seed + 1), { solo: true });
      const conDos = (k: "de" | "para") => new Set([...todas, ...y].map((p) => p[k]).filter((u, _i, arr) => arr.filter((v) => v === u).length > 1));
      expect(conDos("de").size).toBeLessThanOrEqual(2);
      expect(conDos("para").size).toBeLessThanOrEqual(2);
    }
  });

  it("dos anotados: se regalan entre ellos", () => {
    const p = sortearAmigos(["a", "b"], [], semilla(1));
    expect(p).toEqual(expect.arrayContaining([{ de: "a", para: "b" }, { de: "b", para: "a" }]));
  });
});

describe("las notitas y las cartas", () => {
  it("se limpian, con tope, sin enlaces ni groserías", () => {
    expect(limpiarTexto("  Hola   amigo\nsecreto  ", 60)).toEqual({ ok: true, text: "Hola amigo secreto" });
    expect(limpiarTexto("   ", 60)).toEqual({ ok: false, error: "vacio" });
    expect(limpiarTexto("", 60, { vacio: true })).toEqual({ ok: true, text: "" });
    expect(limpiarTexto("a".repeat(61), 60)).toEqual({ ok: false, error: "largo" });
    expect(limpiarTexto("mire www.algo.com", 60)).toEqual({ ok: false, error: "enlace" });
    expect(limpiarTexto("entre a https://x.y", 60)).toEqual({ ok: false, error: "enlace" });
    expect(limpiarTexto("usted es un malparido", 60)).toEqual({ ok: false, error: "grosero" });
  });

  it("las groserías se pescan con tildes, mayúsculas y letras estiradas, sin tocar palabras inocentes", () => {
    expect(esGrosero("IMBÉCIL")).toBe(true);
    expect(esGrosero("qué hijueputaaaa")).toBe(true);
    expect(esGrosero("p3nd3jo")).toBe(true);
    expect(esGrosero("Te traje una pera y un perrito")).toBe(false);
    expect(esGrosero("Feliz amor y amistad, con cariño")).toBe(false);
    expect(esGrosero("computador")).toBe(false);
  });
});

describe("lo que se regala y el puesto", () => {
  it("solo lo que se agarra: ni muebles, ni el celular, ni hojas, ni historia, ni herramientas", () => {
    const r = (id: string) => regalable(id, bagItemInfo(id));
    expect(r("obj:chocolatina-corazon")).toBe(true);
    expect(r("obj:tinto")).toBe(true);
    expect(r("plant")).toBe(false);
    expect(r("obj:celular")).toBe(false);
    expect(r("obj:hoja:abc")).toBe(false);
    expect(r("obj:llave-oxidada")).toBe(false);
  });

  it("todo lo del puesto existe en la mochila, con su refId; lo dulce se come", () => {
    for (const item of AMOR_SHOP) {
      expect(BAG_OBJECTS[item.id]).toBeDefined();
      expect(item.price).toBeGreaterThan(0);
      expect(amorRefId(item.id)).toBe(`festival:amor-amistad:${item.id}`);
    }
    expect(CONSUMABLES["chocolatina-corazon"]).toBeDefined();
    expect(CONSUMABLES["caja-bombones"]).toBeDefined();
  });

  it("solo con la fiesta abierta", () => {
    expect(amorActivo(AMOR.id, "fiesta")).toBe(true);
    expect(amorActivo(AMOR.id, "fin")).toBe(false);
    expect(amorActivo("brujas", "fiesta")).toBe(false);
  });
});

describe("las cinemáticas", () => {
  it("las fijas están en el catálogo y no tienen problemas", () => {
    for (const def of AMOR_CINEMATICAS) {
      expect(cineById(def.id)).toBe(def);
      expect(cineProblems(def)).toEqual([]);
    }
  });

  it("la revelación sale de una en una (con tope) y le dice a cada quien quién era el suyo", () => {
    const pares = Array.from({ length: 14 }, (_, i) => ({ de: `P${i}`, para: `P${(i + 1) % 14}`, deId: `u${i}`, paraId: `u${(i + 1) % 14}` }));
    const def = revelacionCine(pares, "u3");
    expect(cineProblems(def)).toEqual([]);
    const titulos = JSON.stringify(def.steps);
    for (let i = 0; i < AMOR.revelacionMax; i++) expect(titulos).toContain(`"text":"P${i}"`);
    expect(titulos).toContain("Y 4 parejas más");
    expect(titulos).toContain("Su amigo secreto era P2");
    expect(JSON.stringify(revelacionCine(pares.slice(0, 2), null).steps)).not.toContain("Su amigo secreto era");
  });

  it("la serenata pone al trío con sus instrumentos donde está quien la recibe", () => {
    const def = serenataCine({ x: 40, y: 30 }, { para: "Ana", de: "Beto", paraMi: true });
    expect(cineProblems(def)).toEqual([]);
    const spawns = def.steps.filter((s) => s.op === "spawn");
    expect(spawns.map((s) => s.op === "spawn" && s.holds)).toEqual(TRIO_SERENATA.map((m) => m.instrumento));
    for (const s of spawns) if (s.op === "spawn" && "x" in s.at) expect(Math.abs(s.at.x - 40) + Math.abs(s.at.y - 30)).toBeLessThan(12);
    expect(JSON.stringify(def.steps)).toContain("De parte de Beto");
    expect(JSON.stringify(serenataCine({ x: 1, y: 1 }, { para: "Ana", de: "", paraMi: false }).steps)).not.toContain('"who":"yo"');
  });
});
