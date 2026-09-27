import {
  BACK_ITEMS,
  BOTTOMS,
  HAIR_STYLES,
  NECK_ITEMS,
  normalizeLook,
  OUTFITS,
  PATTERNS,
  SHOES,
  SWIMWEAR,
  TOPS,
  type Outfit,
} from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BODY_X, BODY_Y, drawCharacter, drawSitting, FEET_Y, FRAME, SHEET_DIRECTIONS, SIT_DROP, type CharacterStyle } from "./chibi";
import { top2Parts, TOPS_WITH_TOP2 } from "./chibi/clothes";
import { ACCENT_BACK_ITEMS, ACCENT_NECK_ITEMS } from "./chibi/gear";
import { tone } from "./chibi/kit";
import { OUT } from "./palette";
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

/** Píxeles de una celda (FRAME x FRAME) de una hoja (opcionalmente solo algunas filas). */
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

/** Color de un píxel del cuerpo (columna x de 0 a 15, fila del cuerpo) dentro de la celda (col, row). */
function bodyPixel(sheet: PixelCanvas, col: number, row: number, x: number, bodyRow: number): string {
  // El frame de 16 px va centrado en la celda (desde BODY_X) y la fila 0 del cuerpo cae en BODY_Y.
  const sx = col * FRAME + BODY_X + x;
  const sy = row * FRAME + BODY_Y + bodyRow;
  const i = (sy * sheet.width + sx) * 4;
  return Array.from(sheet.data.slice(i, i + 4)).join();
}

/** Las dos hojas (caminata y sentado) de un look. */
const sheets = (s: CharacterStyle) => [drawCharacter(s), drawSitting(s)];

/** Índices de los píxeles que cambian entre dos hojas. */
function changedPixels(a: PixelCanvas, b: PixelCanvas): number[] {
  const out: number[] = [];
  for (let i = 0; i < a.data.length; i += 4) if ([0, 1, 2, 3].some((k) => a.data[i + k] !== b.data[i + k])) out.push(i);
  return out;
}

/** De esos píxeles, los que no quedaron iguales en `worn` que en `plain`. */
const alteredAt = (pixels: number[], plain: PixelCanvas, worn: PixelCanvas) =>
  pixels.filter((i) => [0, 1, 2, 3].some((k) => plain.data[i + k] !== worn.data[i + k]));

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
    for (const top of TOPS) {
      expect(usesColor({ ...base, top }, "shirt"), `${top}: camisa`).toBe(true);
      expect(usesColor({ ...base, top }, "top2"), `${top}: secundario`).toBe(TOPS_WITH_TOP2.includes(top));
      expect(usesColor({ ...base, top }, "accent"), `${top}: acento`).toBe(false);
    }
  });

  it("top2Parts dice cuándo se ve el color secundario, con cualquier patrón y conjunto", () => {
    // El editor lo usa para mostrar el selector: tiene que coincidir con lo que se dibuja.
    const outfits: (Outfit | undefined)[] = [undefined, ...OUTFITS];
    for (const top of TOPS)
      for (const pattern of PATTERNS)
        for (const outfit of outfits) {
          const style: CharacterStyle = { ...base, top, pattern, ...(outfit ? { outfit } : {}) };
          const parts = top2Parts(normalizeLook(style));
          expect(parts.length > 0, `${top}, ${pattern}, ${outfit ?? "sin conjunto"}: ${parts.join()}`).toBe(usesColor(style, "top2"));
        }
    // El vestido tapa capucha, cuello y corbata; las mangas del suéter y del polo siguen con sus puños.
    expect(top2Parts(normalizeLook({ ...base, top: "hoodie", outfit: "dress" }))).toEqual([]);
    expect(top2Parts(normalizeLook({ ...base, top: "sweater", outfit: "dress" }))).toEqual(["cuffs"]);
    expect(top2Parts(normalizeLook({ ...base, top: "polo", outfit: "jacket", pattern: "dots" }))).toEqual(["dots", "collar"]);
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

  it("caminan: en cada paso se levanta un pie distinto, con cualquier parte de abajo, zapato y espalda", () => {
    // Filas de los pies en la hoja (cuerpo 24-26).
    const feet: [number, number] = [FEET_Y - 3, FEET_Y - 1];
    for (const bottom of BOTTOMS)
      for (const shoes of SHOES)
        for (const back of BACK_ITEMS) {
          const sheet = drawCharacter({ ...base, bottom, shoes, back });
          for (const row of [RIGHT, UP]) {
            const [f0, f1, f2] = [0, 1, 2].map((f) => cell(sheet, f, row, feet));
            const name = `${bottom} con ${shoes} y ${back} (${SHEET_DIRECTIONS[row]})`;
            expect(same(f0!, f1!), `${name}: paso A`).toBe(false);
            expect(same(f0!, f2!), `${name}: paso B`).toBe(false);
            expect(same(f1!, f2!), `${name}: los dos pasos`).toBe(false);
          }
        }
  });

  it("bajo la cintura se ve la tela de abajo en los tres frames: el short no desaparece y la bota no sube", () => {
    // Al dar el paso el torso baja un píxel y la cintura tapa la fila 21: la cadera pasa a la 22.
    const fabric = [tone(base.pants, -0.25), tone(base.pants, 0.1)].map((c) => c.join());
    for (const bottom of ["pants", "shorts"] as const)
      for (const shoes of SHOES) {
        const sheet = drawCharacter({ ...base, bottom, shoes, shoeColor: "#5a331d" });
        for (const row of [RIGHT, UP])
          for (const frame of [0, 1, 2]) {
            const hip = frame === 0 ? 21 : 22;
            for (let x = 5; x <= 10; x++)
              expect(fabric, `${bottom} con ${shoes}, ${SHEET_DIRECTIONS[row]}, frame ${frame}, x ${x}`).toContain(
                bodyPixel(sheet, frame, row, x, hip),
              );
          }
      }
  });

  it("el morral y la capa no tapan los pies al caminar", () => {
    // Se ven las suelas de los dos pies y el pie apoyado entero (filas 25 y 26 del cuerpo), en todos los frames.
    const outline = OUT.join();
    for (const back of BACK_ITEMS.filter((b) => b !== "none"))
      for (const shoes of SHOES) {
        const bare = drawCharacter({ ...base, shoes });
        const worn = drawCharacter({ ...base, shoes, back });
        SHEET_DIRECTIONS.forEach((dir, row) => {
          for (const frame of [0, 1, 2])
            for (const bodyRow of [25, 26])
              for (let x = 0; x < 16; x++) {
                const foot = bodyPixel(bare, frame, row, x, bodyRow);
                if (foot === outline || foot.endsWith(",0")) continue;
                expect(bodyPixel(worn, frame, row, x, bodyRow), `${back} con ${shoes}, ${dir}, frame ${frame}`).toBe(foot);
              }
        });
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

describe("ropa del chibi: trajes de baño", () => {
  const skin = tone(base.skin, 0).join();
  const shirt = tone(base.shirt!, 0).join();

  /** Color de un píxel del cuerpo en cada vista (los pasos bajan el torso uno y sentado baja SIT_DROP). */
  function torsoPixels(style: CharacterStyle, x: number, bodyRow: number): Record<View, string> {
    const walk = drawCharacter(style);
    const sit = drawSitting(style);
    return {
      frente: bodyPixel(walk, 0, RIGHT, x, bodyRow),
      espaldas: bodyPixel(walk, 0, UP, x, bodyRow),
      "paso de frente": bodyPixel(walk, 1, RIGHT, x, bodyRow + 1),
      "paso de espaldas": bodyPixel(walk, 2, UP, x, bodyRow + 1),
      "sentado de frente": bodyPixel(sit, RIGHT, 0, x, bodyRow + SIT_DROP),
      "sentado de espaldas": bodyPixel(sit, UP, 0, x, bodyRow + SIT_DROP),
    };
  }
  const everywhere = (color: string) => Object.fromEntries(ALL.map((v) => [v, color]));

  it("cada traje de baño se dibuja en todas las vistas, siempre igual y sin cambiar el tamaño de las hojas", () => {
    for (const outfit of SWIMWEAR) {
      const style: CharacterStyle = { ...base, outfit };
      expect(missing(ALL, changedViews(base, style)), outfit).toEqual([]);
      const [walk, sit] = sheets(style);
      expect(same(walk!.data, drawCharacter(style).data), outfit).toBe(true);
      expect(same(sit!.data, drawSitting(style).data), outfit).toBe(true);
      expect([walk!.width, walk!.height, sit!.width, sit!.height]).toEqual([FRAME * 3, FRAME * 4, FRAME * 4, FRAME]);
    }
    // Se distinguen entre sí en todas las vistas.
    SWIMWEAR.forEach((a, i) =>
      SWIMWEAR.forEach((b, j) => {
        if (i < j) expect(missing(ALL, changedViews({ ...base, outfit: a }, { ...base, outfit: b })), `${a} = ${b}`).toEqual([]);
      }),
    );
  });

  it("con el bañador y el bikini la barriga es de piel; con el entero, del color del traje", () => {
    // Fila 18 del cuerpo: la barriga, entre el pecho y la cintura.
    expect(torsoPixels({ ...base, outfit: "trunks" }, 6, 18)).toEqual(everywhere(skin));
    expect(torsoPixels({ ...base, outfit: "bikini" }, 6, 18)).toEqual(everywhere(skin));
    expect(torsoPixels({ ...base, outfit: "swimsuit" }, 6, 18)).toEqual(everywhere(shirt));
    // El pecho: al aire con el bañador; de frente, la copa del bikini y el entero.
    expect(torsoPixels({ ...base, outfit: "trunks" }, 6, 15)).toEqual(everywhere(skin));
    for (const outfit of ["bikini", "swimsuit"] as const) {
      const chest = torsoPixels({ ...base, outfit }, 6, 15);
      for (const v of FRONT) expect(chest[v], `${outfit}, ${v}`).toBe(shirt);
    }
  });

  it("los brazos van al aire y las piernas también, salvo lo que tapa el bañador", () => {
    const hip = tone(base.pants, 0.1).join();
    for (const outfit of SWIMWEAR) {
      const walk = drawCharacter({ ...base, outfit });
      for (const row of [RIGHT, UP]) {
        const name = `${outfit} (${SHEET_DIRECTIONS[row]})`;
        // Brazo de atrás (x = 3) a la altura del pecho.
        expect(bodyPixel(walk, 0, row, 3, 16), `${name}: brazo`).toBe(skin);
        // Pierna de atrás: el bañador llega a medio muslo; el entero y el bikini se cortan en la cadera.
        expect(bodyPixel(walk, 0, row, 6, 22), `${name}: muslo`).toBe(outfit === "trunks" ? hip : skin);
        expect(bodyPixel(walk, 0, row, 6, 23), `${name}: rodilla`).toBe(skin);
        if (outfit !== "trunks") expect(bodyPixel(walk, 0, row, 7, 21), `${name}: cadera`).toBe(shirt);
      }
    }
  });

  it("tapan la parte de arriba y la de abajo, y cada uno usa sus colores", () => {
    for (const outfit of SWIMWEAR) {
      const looks = TOPS.flatMap((top) => BOTTOMS.map((bottom) => sheets({ ...base, outfit, top, bottom })));
      for (const [walk, sit] of looks.slice(1)) {
        expect(same(walk!.data, looks[0]![0]!.data), `${outfit}: caminando`).toBe(true);
        expect(same(sit!.data, looks[0]![1]!.data), `${outfit}: sentado`).toBe(true);
      }
      const style: CharacterStyle = { ...base, outfit };
      const trunks = outfit === "trunks";
      // El bañador es del color de abajo con detalles de acento; el entero y el bikini, del de arriba.
      expect(usesColor(style, "pants"), `${outfit}: abajo`).toBe(trunks);
      expect(usesColor(style, "accent"), `${outfit}: acento`).toBe(trunks);
      expect(usesColor(style, "shirt"), `${outfit}: arriba`).toBe(!trunks);
      expect(usesColor(style, "top2"), `${outfit}: secundario`).toBe(false);
      // El estampado va en el entero y el bikini, en todas las vistas; en el bañador no.
      const plain: CharacterStyle = { ...style, top2: CREAM };
      for (const pattern of ["stripes", "dots"] as const) {
        const changed = changedViews(plain, { ...plain, pattern });
        if (trunks) expect(changed, `${outfit} con ${pattern}`).toEqual([]);
        else expect(changed.length, `${outfit} con ${pattern}`).toBeGreaterThan(0);
      }
      expect(missing(ALL, changedViews(plain, { ...plain, pattern: "stripes" })), `${outfit} con rayas`).toEqual(trunks ? ALL : []);
    }
  });

  it("no dejan píxeles sueltos: la silueta es la del esqueleto con shorts, también con morral o capa", () => {
    const alpha = (sheet: PixelCanvas) => Array.from(sheet.data.filter((_, i) => i % 4 === 3));
    for (const back of BACK_ITEMS) {
      const plain = sheets({ ...base, top: "tank", bottom: "shorts", back });
      for (const outfit of SWIMWEAR) {
        const swim = sheets({ ...base, outfit, back });
        swim.forEach((sheet, k) => expect(same(alpha(sheet), alpha(plain[k]!)), `${outfit} con ${back}`).toBe(true));
      }
    }
  });

  it("de espaldas la capa tapa todo el traje de baño, caminando y sentado", () => {
    for (const outfit of SWIMWEAR) {
      const key = outfit === "trunks" ? "pants" : "shirt";
      const back = (color: string) => {
        const style: CharacterStyle = { ...base, outfit, back: "cape", [key]: color };
        const walk = drawCharacter(style);
        return [0, 1, 2].map((f) => cell(walk, f, UP)).concat([cell(drawSitting(style), UP, 0)]);
      };
      expect(back("#ff00ff"), outfit).toEqual(back("#00ff00"));
    }
  });

  it("el morral y la capa no tapan los pies con traje de baño", () => {
    const outline = OUT.join();
    for (const outfit of SWIMWEAR)
      for (const back of BACK_ITEMS.filter((b) => b !== "none")) {
        const bare = drawCharacter({ ...base, outfit });
        const worn = drawCharacter({ ...base, outfit, back });
        SHEET_DIRECTIONS.forEach((dir, row) => {
          for (const frame of [0, 1, 2])
            for (const bodyRow of [25, 26])
              for (let x = 0; x < 16; x++) {
                const foot = bodyPixel(bare, frame, row, x, bodyRow);
                if (foot === outline || foot.endsWith(",0")) continue;
                expect(bodyPixel(worn, frame, row, x, bodyRow), `${outfit} con ${back}, ${dir}, frame ${frame}`).toBe(foot);
              }
        });
      }
  });
});

describe("ropa del chibi: cuello y espalda", () => {
  it("cada cosa del cuello se ve de frente, con el color de acento (las de ACCENT_NECK_ITEMS)", () => {
    for (const neck of NECK_ITEMS) {
      if (neck !== "none") expect(missing(FRONT, changedViews(base, { ...base, neck })), neck).toEqual([]);
      expect(usesColor({ ...base, neck }, "accent"), neck).toBe(ACCENT_NECK_ITEMS.includes(neck));
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

  it("el morral y la capa se ven en todas las vistas, con el color de acento (los de ACCENT_BACK_ITEMS)", () => {
    for (const back of BACK_ITEMS) {
      if (back !== "none") expect(missing(ALL, changedViews(base, { ...base, back })), back).toEqual([]);
      expect(usesColor({ ...base, back }, "accent"), back).toBe(ACCENT_BACK_ITEMS.includes(back));
    }
    expect(changedViews({ ...base, back: "backpack" }, { ...base, back: "cape" })).toEqual(ALL);
  });

  it("el pelo cae por encima del morral, la capa y el collar con cualquier peinado, aunque sea del color de la ropa o del acento", () => {
    // "bald" no tiene pelo que pueda quedar debajo.
    for (const hairStyle of HAIR_STYLES.filter((h) => h !== "bald")) {
      // Qué píxeles son pelo: los que cambian al cambiar solo su color.
      const [a, b] = [sheets({ ...base, hairStyle, hair: "#d4a017" }), sheets({ ...base, hairStyle, hair: "#35a0d0" })];
      const hairPixels = a.map((sheet, k) => changedPixels(sheet, b[k]!));
      expect(hairPixels[0]!.length, hairStyle).toBeGreaterThan(0);
      for (const hair of ["#d4a017", base.shirt!, base.accent!]) {
        const plain = sheets({ ...base, hairStyle, hair });
        for (const extra of [{ back: "backpack" }, { back: "cape" }, { neck: "necklace" }] as const) {
          const worn = sheets({ ...base, hairStyle, hair, ...extra });
          const altered = hairPixels.flatMap((pixels, k) => alteredAt(pixels, plain[k]!, worn[k]!));
          expect(altered, `${hairStyle}, pelo ${hair}, ${JSON.stringify(extra)}`).toEqual([]);
        }
      }
    }
  });

  it("la bufanda queda encima del morral y de la capa, de frente y de espaldas", () => {
    const outline = OUT.join();
    const bare = sheets(base);
    const scarf = sheets({ ...base, neck: "scarf" });
    // Los píxeles de la bufanda (sin el contorno, que cambia con la silueta).
    const scarfPixels = scarf.map((sheet, k) =>
      changedPixels(sheet, bare[k]!).filter((i) => Array.from(sheet.data.slice(i, i + 4)).join() !== outline),
    );
    for (const back of ["backpack", "cape"] as const) {
      const both = sheets({ ...base, neck: "scarf", back });
      const altered = scarfPixels.flatMap((pixels, k) => alteredAt(pixels, scarf[k]!, both[k]!));
      expect(altered, back).toEqual([]);
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
    const explicit: CharacterStyle = { ...base, top: "longsleeve", pattern: "solid", bottom: "pants", shoes: "sneakers", neck: "none", back: "none" };
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
