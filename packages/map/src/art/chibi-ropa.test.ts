import { BACK_ITEMS, BOTTOMS, NECK_ITEMS, OUTFITS, PATTERNS, SHOES, TOPS, type Top } from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { drawCharacter, drawSitting, FRAME, SHEET_DIRECTIONS, type CharacterStyle } from "./chibi";
import { three } from "./chibi/kit";
import type { PixelCanvas } from "./pixel";

// Ropa, cuello y espalda del creador de personajes: cada opción tiene que verse donde corresponde, con
// el color que el editor deja elegir para ella, y el dibujo tiene que ser siempre el mismo.

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#4660a0", hairStyle: "short" };
const CREAM = "#f7ebc8";

const RIGHT = SHEET_DIRECTIONS.indexOf("right");
const UP = SHEET_DIRECTIONS.indexOf("up");

type View = "frente" | "espaldas" | "paso de frente" | "paso de espaldas" | "sentado de frente" | "sentado de espaldas";
const ALL: View[] = ["frente", "espaldas", "paso de frente", "paso de espaldas", "sentado de frente", "sentado de espaldas"];
/** Donde se ven las piernas: sentado de espaldas quedan delante del cuerpo. */
const LEGS: View[] = ["frente", "espaldas", "paso de frente", "paso de espaldas", "sentado de frente"];
const FRONT: View[] = ["frente", "paso de frente", "sentado de frente"];

/** Píxeles de una celda de 32x32 de una hoja (opcionalmente solo algunas filas). */
function cell(sheet: PixelCanvas, col: number, row: number, rows: [number, number] = [0, FRAME - 1]): number[] {
  const out: number[] = [];
  for (let y = rows[0]; y <= rows[1]; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = ((row * FRAME + y) * sheet.width + col * FRAME + x) * 4;
      out.push(sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!);
    }
  return out;
}

const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);

/** Vistas en las que dos looks se dibujan distinto (los dos pasos tienen que cambiar para contar). */
function changedViews(a: CharacterStyle, b: CharacterStyle): View[] {
  const [wa, wb, sa, sb] = [drawCharacter(a), drawCharacter(b), drawSitting(a), drawSitting(b)];
  const differs = (sheetA: PixelCanvas, sheetB: PixelCanvas, col: number, row: number) =>
    !same(cell(sheetA, col, row), cell(sheetB, col, row));
  const views: Record<View, boolean> = {
    frente: differs(wa, wb, 0, RIGHT),
    espaldas: differs(wa, wb, 0, UP),
    "paso de frente": [1, 2].every((f) => differs(wa, wb, f, RIGHT)),
    "paso de espaldas": [1, 2].every((f) => differs(wa, wb, f, UP)),
    "sentado de frente": differs(sa, sb, RIGHT, 0),
    "sentado de espaldas": differs(sa, sb, UP, 0),
  };
  return ALL.filter((v) => views[v]);
}

const missing = (want: View[], got: View[]) => want.filter((v) => !got.includes(v));

type ColorKey = "shirt" | "top2" | "pants" | "shoeColor" | "accent";
/** ¿Cambiar ese color cambia algún píxel, caminando o sentado? */
function usesColor(style: CharacterStyle, key: ColorKey): boolean {
  const other: CharacterStyle = { ...style, [key]: "#ff00ff" };
  // top2 cae al acento si no viene: se fija para que cambiar uno no mueva el otro.
  const fixed: CharacterStyle = { top2: CREAM, ...style };
  const fixedOther: CharacterStyle = { top2: CREAM, ...other };
  return (
    !same(drawCharacter(fixed).data, drawCharacter(fixedOther).data) || !same(drawSitting(fixed).data, drawSitting(fixedOther).data)
  );
}

describe("ropa del chibi: parte de arriba", () => {
  it("cada parte de arriba se distingue de la camiseta en todas las vistas", () => {
    const tee: CharacterStyle = { ...base, top: "tshirt", top2: CREAM };
    for (const top of TOPS.filter((t) => t !== "tshirt"))
      expect(missing(ALL, changedViews(tee, { ...tee, top })), top).toEqual([]);
  });

  it("las partes de arriba se distinguen entre sí de frente", () => {
    const fronts = TOPS.map((top) => cell(drawCharacter({ ...base, top, top2: CREAM }), 0, RIGHT));
    TOPS.forEach((a, i) =>
      TOPS.forEach((b, j) => {
        if (i < j) expect(same(fronts[i]!, fronts[j]!), `${a} = ${b}`).toBe(false);
      }),
    );
  });

  it("usan el color de la camisa y el secundario solo las que lo llevan", () => {
    // Capucha, cuello del suéter, corbata y cuello del polo van con top2; la camiseta, la manga larga y el
    // esqueleto lisos no (así el look por defecto no depende de un color que el editor no muestra).
    const withTop2: Top[] = ["hoodie", "sweater", "shirt-tie", "polo"];
    for (const top of TOPS) {
      expect(usesColor({ ...base, top }, "shirt"), `${top}: camisa`).toBe(true);
      expect(usesColor({ ...base, top }, "top2"), `${top}: secundario`).toBe(withTop2.includes(top));
      expect(usesColor({ ...base, top }, "accent"), `${top}: acento`).toBe(false);
    }
  });

  it("cada patrón se ve en todas las vistas, sobre cualquier parte de arriba, con el color secundario", () => {
    for (const top of TOPS)
      for (const pattern of PATTERNS.filter((p) => p !== "solid")) {
        const plain: CharacterStyle = { ...base, top, top2: CREAM };
        expect(missing(ALL, changedViews(plain, { ...plain, pattern })), `${top} con ${pattern}`).toEqual([]);
        expect(usesColor({ ...base, top, pattern }, "top2"), `${top} con ${pattern}: secundario`).toBe(true);
      }
    // Rayas y puntos no se confunden.
    expect(changedViews({ ...base, top2: CREAM, pattern: "stripes" }, { ...base, top2: CREAM, pattern: "dots" })).toEqual(ALL);
  });

  it("el vestido lleva el patrón", () => {
    const dress: CharacterStyle = { ...base, outfit: "dress", top2: CREAM };
    for (const pattern of ["stripes", "dots"] as const)
      expect(missing(ALL, changedViews(dress, { ...dress, pattern })), pattern).toEqual([]);
  });
});

describe("ropa del chibi: parte de abajo y zapatos", () => {
  it("cada parte de abajo se distingue del pantalón donde se ven las piernas", () => {
    for (const bottom of BOTTOMS.filter((b) => b !== "pants"))
      expect(missing(LEGS, changedViews(base, { ...base, bottom })), bottom).toEqual([]);
    expect(changedViews({ ...base, bottom: "shorts" }, { ...base, bottom: "skirt" })).toEqual(expect.arrayContaining(LEGS));
  });

  it("cada zapato se distingue de los tenis donde se ven los pies", () => {
    for (const shoes of SHOES.filter((s) => s !== "sneakers"))
      expect(missing(LEGS, changedViews(base, { ...base, shoes })), shoes).toEqual([]);
    expect(changedViews({ ...base, shoes: "boots" }, { ...base, shoes: "sandals" })).toEqual(expect.arrayContaining(LEGS));
  });

  it("la parte de abajo usa el color de abajo y los zapatos el suyo, caminando y sentado", () => {
    for (const bottom of BOTTOMS) {
      const style: CharacterStyle = { ...base, bottom };
      expect(usesColor(style, "pants"), bottom).toBe(true);
      // Sentado de frente también: cambia el regazo.
      const sit = (s: CharacterStyle) => cell(drawSitting(s), RIGHT, 0);
      expect(same(sit(style), sit({ ...style, pants: "#ff00ff" })), `${bottom} sentado`).toBe(false);
    }
    for (const shoes of SHOES) {
      const style: CharacterStyle = { ...base, shoes };
      const sit = (s: CharacterStyle) => cell(drawSitting(s), RIGHT, 0);
      const walk = (s: CharacterStyle) => cell(drawCharacter(s), 0, RIGHT);
      expect(same(walk(style), walk({ ...style, shoeColor: "#ff00ff" })), `${shoes} caminando`).toBe(false);
      expect(same(sit(style), sit({ ...style, shoeColor: "#ff00ff" })), `${shoes} sentado`).toBe(false);
    }
  });

  it("caminan: en cada paso se levanta un pie distinto, con cualquier parte de abajo y zapato", () => {
    // Filas de los pies en la hoja (cuerpo 21-23).
    const feet: [number, number] = [26, 28];
    for (const bottom of BOTTOMS)
      for (const shoes of SHOES) {
        const sheet = drawCharacter({ ...base, bottom, shoes });
        for (const row of [RIGHT, UP]) {
          const [f0, f1, f2] = [0, 1, 2].map((f) => cell(sheet, f, row, feet));
          const name = `${bottom} con ${shoes} (${SHEET_DIRECTIONS[row]})`;
          expect(same(f0!, f1!), `${name}: paso A`).toBe(false);
          expect(same(f0!, f2!), `${name}: paso B`).toBe(false);
          expect(same(f1!, f2!), `${name}: los dos pasos`).toBe(false);
        }
      }
  });
});

describe("ropa del chibi: conjuntos encima de las partes nuevas", () => {
  it("el vestido tapa la parte de abajo (y no usa su color); el overol y la chaqueta van encima de todo", () => {
    for (const top of TOPS) {
      const dresses = BOTTOMS.map((bottom) => drawCharacter({ ...base, top, bottom, outfit: "dress" }).data);
      for (const d of dresses.slice(1)) expect(same(d, dresses[0]!), `vestido sobre ${top}`).toBe(true);
      for (const bottom of BOTTOMS) {
        const plain: CharacterStyle = { ...base, top, bottom, top2: CREAM };
        expect(usesColor({ ...plain, outfit: "dress" }, "pants"), `vestido, ${top}, ${bottom}`).toBe(false);
        expect(usesColor({ ...plain, outfit: "overalls" }, "pants"), `overol, ${top}, ${bottom}`).toBe(true);
        expect(usesColor({ ...plain, outfit: "jacket" }, "accent"), `chaqueta, ${top}, ${bottom}`).toBe(true);
        for (const outfit of OUTFITS)
          expect(missing(FRONT, changedViews(plain, { ...plain, outfit })), `${outfit} sobre ${top} y ${bottom}`).toEqual([]);
      }
    }
  });
});

describe("ropa del chibi: cuello y espalda", () => {
  it("cada cosa del cuello se ve de frente, con el color de acento", () => {
    for (const neck of NECK_ITEMS.filter((n) => n !== "none")) {
      expect(missing(FRONT, changedViews(base, { ...base, neck })), neck).toEqual([]);
      expect(usesColor({ ...base, neck }, "accent"), neck).toBe(true);
    }
    // De espaldas: la bufanda da la vuelta y el broche del collar queda en la nuca; corbata y corbatín no se ven.
    expect(changedViews(base, { ...base, neck: "scarf" })).toEqual(ALL);
    expect(changedViews(base, { ...base, neck: "necklace" })).toContain("espaldas");
    for (const neck of ["tie", "bowtie"] as const) expect(changedViews(base, { ...base, neck }), neck).not.toContain("espaldas");
  });

  it("las cosas del cuello se distinguen entre sí de frente", () => {
    const items = NECK_ITEMS.filter((n) => n !== "none");
    const fronts = items.map((neck) => cell(drawCharacter({ ...base, neck }), 0, RIGHT));
    items.forEach((a, i) =>
      items.forEach((b, j) => {
        if (i < j) expect(same(fronts[i]!, fronts[j]!), `${a} = ${b}`).toBe(false);
      }),
    );
  });

  it("el morral y la capa se ven en todas las vistas, con el color de acento", () => {
    for (const back of BACK_ITEMS.filter((b) => b !== "none")) {
      expect(missing(ALL, changedViews(base, { ...base, back })), back).toEqual([]);
      expect(usesColor({ ...base, back }, "accent"), back).toBe(true);
    }
    expect(changedViews({ ...base, back: "backpack" }, { ...base, back: "cape" })).toEqual(ALL);
  });

  it("de espaldas, el pelo largo cae por encima del morral, la capa y el collar", () => {
    const long: CharacterStyle = { ...base, hairStyle: "long", hair: "#d4a017" };
    const hair = three(long.hair).map((c) => c.join());
    const plain = cell(drawCharacter(long), 0, UP);
    for (const extra of [{ back: "backpack" }, { back: "cape" }, { neck: "necklace" }] as const) {
      const worn = cell(drawCharacter({ ...long, ...extra }), 0, UP);
      for (let i = 0; i < plain.length; i += 4) {
        if (!hair.includes(plain.slice(i, i + 4).join())) continue;
        expect(worn.slice(i, i + 4), JSON.stringify(extra)).toEqual(plain.slice(i, i + 4));
      }
    }
  });

  it("la capa tapa toda la espalda aunque la camisa sea del color del pelo o de la cinta", () => {
    // De espaldas no queda nada de la camisa a la vista: la vista no depende de su color.
    const back = (shirt: string) => cell(drawCharacter({ ...base, hair: "#6886c4", shirt, back: "cape" }), 0, UP);
    const reference = back("#437a55");
    for (const shirt of ["#c05a4a", "#6886c4", "#f7ebc8"]) expect(back(shirt), shirt).toEqual(reference);
  });
});

describe("ropa del chibi: dibujo", () => {
  it("lo que viene por defecto se dibuja igual que si se eligiera", () => {
    // Guarda de los tests de arriba: sin cambios, ninguna vista cambia.
    expect(changedViews(base, base)).toEqual([]);
    const explicit: CharacterStyle = { ...base, top: "tshirt", pattern: "solid", bottom: "pants", shoes: "sneakers", neck: "none", back: "none" };
    expect(changedViews(base, explicit)).toEqual([]);
  });

  it("es determinista y las hojas mantienen su tamaño", () => {
    const style: CharacterStyle = {
      ...base,
      top: "hoodie",
      top2: CREAM,
      pattern: "dots",
      bottom: "skirt",
      shoes: "boots",
      shoeColor: "#5a331d",
      neck: "necklace",
      back: "cape",
      outfit: "jacket",
    };
    const a = drawCharacter(style);
    expect(same(a.data, drawCharacter(style).data)).toBe(true);
    expect(same(drawSitting(style).data, drawSitting(style).data)).toBe(true);
    expect([a.width, a.height]).toEqual([FRAME * 3, FRAME * 4]);
    const s = drawSitting(style);
    expect([s.width, s.height]).toEqual([FRAME * 4, FRAME]);
  });
});
