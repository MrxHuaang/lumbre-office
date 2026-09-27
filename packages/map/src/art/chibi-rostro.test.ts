// Pelo, cara y cabeza del chibi: cada opción del creador de personajes tiene que verse donde corresponde,
// usar su color y convivir con las demás (la gorra no deja pasar el pelo, la corona no flota).
import {
  EYE_STYLES,
  FACE_ITEMS,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEAD_ITEMS,
  type EyeStyle,
  type HairStyle,
  type HeadItem,
} from "@hyvento/shared";
import { describe, expect, it } from "vitest";
import { BODY_X, BODY_Y, drawCharacter, drawSitting, FRAME, SHEET_DIRECTIONS, SIT_DROP, type CharacterStyle } from "./chibi";
import { OUT } from "./palette";
import type { PixelCanvas } from "./pixel";

const base: CharacterStyle = { skin: "#f1c27d", hair: "#3b2219", shirt: "#e76f51", pants: "#264653", accent: "#4660a0", hairStyle: "short" };

const RIGHT = SHEET_DIRECTIONS.indexOf("right");
const UP = SHEET_DIRECTIONS.indexOf("up");

/** Píxeles de una celda (FRAME x FRAME) de una hoja (desde la fila `y0` hasta la `y1` de la celda). */
function cell(sheet: PixelCanvas, col: number, row: number, y0 = 0, y1 = FRAME): number[] {
  const out: number[] = [];
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < FRAME; x++) {
      const i = ((row * FRAME + y) * sheet.width + col * FRAME + x) * 4;
      out.push(sheet.data[i]!, sheet.data[i + 1]!, sheet.data[i + 2]!, sheet.data[i + 3]!);
    }
  return out;
}

const same = (a: ArrayLike<number>, b: ArrayLike<number>) => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);

/** El píxel i (RGBA) de una celda. */
const pixel = (c: number[], i: number) => c.slice(i * 4, i * 4 + 4);
const isOut = (p: number[]) => p[0] === OUT[0] && p[1] === OUT[1] && p[2] === OUT[2] && p[3] === 255;

/** Las celdas de frente: de pie (quieto) y sentado. */
const frontCells = (style: CharacterStyle) => [cell(drawCharacter(style), 0, RIGHT), cell(drawSitting(style), RIGHT, 0)];

/**
 * Píxeles (x, fila) del cuerpo de frente, de pie y sentado. El cuerpo va BODY_X columnas adentro de la
 * celda; de pie la fila r es la r + BODY_Y de la celda y sentado baja SIT_DROP más.
 */
function frontBodyPixels(style: CharacterStyle, points: readonly (readonly [number, number])[]): number[][] {
  const [standing, sitting] = frontCells(style);
  return points.flatMap(([x, r]) => [pixel(standing!, (r + BODY_Y) * FRAME + x + BODY_X), pixel(sitting!, (r + BODY_Y + SIT_DROP) * FRAME + x + BODY_X)]);
}

type View =
  | "frente"
  | "paso A de frente"
  | "paso B de frente"
  | "sentado de frente"
  | "espaldas"
  | "paso A de espaldas"
  | "paso B de espaldas"
  | "sentado de espaldas";
const FRONT: View[] = ["frente", "paso A de frente", "paso B de frente", "sentado de frente"];
const BACK: View[] = ["espaldas", "paso A de espaldas", "paso B de espaldas", "sentado de espaldas"];
const ALL: View[] = [...FRONT, ...BACK];

/** Las vistas en las que `to` se dibuja distinto que `from`. */
function changedViews(from: CharacterStyle, to: CharacterStyle): View[] {
  const w0 = drawCharacter(from);
  const w1 = drawCharacter(to);
  const s0 = drawSitting(from);
  const s1 = drawSitting(to);
  const walk = (f: number, row: number) => !same(cell(w0, f, row), cell(w1, f, row));
  const views: Record<View, boolean> = {
    frente: walk(0, RIGHT),
    "paso A de frente": walk(1, RIGHT),
    "paso B de frente": walk(2, RIGHT),
    "sentado de frente": !same(cell(s0, RIGHT, 0), cell(s1, RIGHT, 0)),
    espaldas: walk(0, UP),
    "paso A de espaldas": walk(1, UP),
    "paso B de espaldas": walk(2, UP),
    "sentado de espaldas": !same(cell(s0, UP, 0), cell(s1, UP, 0)),
  };
  return ALL.filter((v) => views[v]);
}

/** Las vistas de `want` en las que no cambió nada. */
const missing = (want: View[], got: View[]) => want.filter((v) => !got.includes(v));

type ColorKey = "hair" | "skin" | "accent" | "eyeColor";

/** ¿Cambiar ese color cambia algún píxel, caminando o sentado? */
function usesColor(style: CharacterStyle, key: ColorKey): boolean {
  const other: CharacterStyle = { ...style, [key]: "#ff00ff" };
  return (
    !same(drawCharacter(style).data, drawCharacter(other).data) || !same(drawSitting(style).data, drawSitting(other).data)
  );
}

/** Cada par de la lista se dibuja distinto en esa vista (de pie). */
function allDistinct<T extends string>(options: readonly T[], look: (o: T) => CharacterStyle, row: number): string[] {
  const cells = options.map((o) => cell(drawCharacter(look(o)), 0, row));
  const clashes: string[] = [];
  for (let i = 0; i < options.length; i++)
    for (let j = i + 1; j < options.length; j++) if (same(cells[i]!, cells[j]!)) clashes.push(`${options[i]} = ${options[j]}`);
  return clashes;
}

/** De pie, la fila r del cuerpo es la r + BODY_Y de la celda: arriba de esto, la cabeza por encima de la frente (filas < 5). */
const ABOVE_BROW = BODY_Y + 5;

describe("peinados", () => {
  it("los 20 peinados se distinguen entre sí, de frente y de espaldas", () => {
    const look = (hairStyle: HairStyle): CharacterStyle => ({ ...base, hairStyle });
    expect(allDistinct(HAIR_STYLES, look, RIGHT), "de frente").toEqual([]);
    expect(allDistinct(HAIR_STYLES, look, UP), "de espaldas").toEqual([]);
  });

  it("cada peinado usa el color del pelo (el calvo no tiene)", () => {
    for (const hairStyle of HAIR_STYLES) expect(usesColor({ ...base, hairStyle }, "hair"), hairStyle).toBe(hairStyle !== "bald");
  });

  it("el calvo deja ver la cabeza: la piel llega arriba, de frente y de espaldas", () => {
    const topUsesSkin = (style: CharacterStyle) => {
      const a = drawCharacter(style);
      const b = drawCharacter({ ...style, skin: "#ff00ff" });
      return [RIGHT, UP].map((row) => !same(cell(a, 0, row, 0, ABOVE_BROW), cell(b, 0, row, 0, ABOVE_BROW)));
    };
    expect(topUsesSkin({ ...base, hairStyle: "bald" })).toEqual([true, true]);
    expect(topUsesSkin({ ...base, hairStyle: "short" })).toEqual([false, false]);
  });

  it("las colitas, las rastas y el mullet se mecen al caminar", () => {
    // Entre los dos pasos el cuerpo sube igual; en la cabeza y el pelo de arriba de los hombros solo cambia lo
    // que se mece (el corto no cambia nada).
    const HEAD_ROWS = BODY_Y + 14;
    const swings = (hairStyle: HairStyle) => {
      const s = drawCharacter({ ...base, hairStyle });
      return !same(cell(s, 1, RIGHT, 0, HEAD_ROWS), cell(s, 2, RIGHT, 0, HEAD_ROWS));
    };
    expect(swings("short")).toBe(false);
    for (const hairStyle of ["ponytail", "pigtails", "dreads", "mullet"] as const) expect(swings(hairStyle), hairStyle).toBe(true);
  });
});

describe("cara", () => {
  it("cada forma de ojos cambia la cara, solo de frente", () => {
    for (const eyes of EYE_STYLES.filter((e) => e !== "normal")) {
      const views = changedViews(base, { ...base, eyes });
      expect(missing(FRONT, views), eyes).toEqual([]);
      expect(views.filter((v) => BACK.includes(v)), eyes).toEqual([]);
    }
    expect(allDistinct(EYE_STYLES, (eyes) => ({ ...base, eyes }), RIGHT)).toEqual([]);
  });

  it("los ojos abiertos usan el color de ojos; los cerrados no lo muestran", () => {
    const closed: EyeStyle[] = ["happy", "closed"];
    for (const eyes of EYE_STYLES) expect(usesColor({ ...base, eyes }, "eyeColor"), eyes).toBe(!closed.includes(eyes));
  });

  it("el rubor y las pecas se ven solo de frente", () => {
    for (const [name, from, to] of [
      ["rubor", { blush: false }, { blush: true }],
      ["pecas", { freckles: false }, { freckles: true }],
    ] as const) {
      const views = changedViews({ ...base, ...from }, { ...base, ...to });
      expect(missing(FRONT, views), name).toEqual([]);
      expect(views.filter((v) => BACK.includes(v)), name).toEqual([]);
    }
  });

  it("cada vello facial se ve de frente y es del color del pelo", () => {
    for (const facialHair of FACIAL_HAIR.filter((f) => f !== "none")) {
      const views = changedViews(base, { ...base, facialHair });
      expect(missing(FRONT, views), facialHair).toEqual([]);
      expect(views.filter((v) => BACK.includes(v)), facialHair).toEqual([]);
      // Con la cabeza calva el único pelo es el de la cara.
      expect(usesColor({ ...base, hairStyle: "bald", facialHair }, "hair"), facialHair).toBe(true);
    }
    expect(allDistinct(FACIAL_HAIR, (facialHair) => ({ ...base, facialHair }), RIGHT)).toEqual([]);
  });

  it("el vello facial deja piel debajo de los ojos (no se junta con el ojo en una raya)", () => {
    // Con pelo oscuro, un píxel de vello justo debajo del ojo se lee como una cicatriz hasta la barbilla.
    const UNDER_EYES = [
      [7, 9],
      [10, 9],
    ] as const;
    for (const eyes of EYE_STYLES) {
      const look: CharacterStyle = { ...base, hair: "#1b1b1b", eyes };
      const bare = frontBodyPixels(look, UNDER_EYES);
      for (const facialHair of FACIAL_HAIR)
        expect(frontBodyPixels({ ...look, facialHair }, UNDER_EYES), `${facialHair} con ojos ${eyes}`).toEqual(bare);
    }
  });

  it("lo de la cara se ve de frente y de espaldas (patillas, cinta) y no usa el acento", () => {
    for (const face of FACE_ITEMS.filter((f) => f !== "none")) {
      expect(missing(ALL, changedViews(base, { ...base, face })), face).toEqual([]);
      expect(usesColor({ ...base, face }, "accent"), face).toBe(false);
    }
    expect(allDistinct(FACE_ITEMS, (face) => ({ ...base, face }), RIGHT)).toEqual([]);
  });

  it("las gafas respetan cada forma de ojos y el vidrio no cae sobre la piel", () => {
    const MAGENTA = "#ff00ff";
    for (const eyes of EYE_STYLES)
      for (const face of ["glasses", "round-glasses"] as const) {
        const look: CharacterStyle = { ...base, eyes };
        const plain = frontCells(look);
        const plainEyes = frontCells({ ...look, eyeColor: MAGENTA });
        const worn = frontCells({ ...look, face });
        const wornEyes = frontCells({ ...look, face, eyeColor: MAGENTA });
        const wornSkin = frontCells({ ...look, face, skin: MAGENTA });
        const name = `${face} con ojos ${eyes}`;
        plain.forEach((c, k) => {
          for (let i = 0; i < FRAME * FRAME; i++) {
            const p = pixel(c, i);
            const w = pixel(worn[k]!, i);
            // Las pestañas (todo lo OUT) siguen ahí: el marco no borra la forma del ojo.
            if (isOut(p)) expect(isOut(w), `${name}: pestaña tapada`).toBe(true);
            // El iris se sigue viendo a través del vidrio.
            if (!same(p, pixel(plainEyes[k]!, i))) expect(same(w, pixel(wornEyes[k]!, i)), `${name}: iris tapado`).toBe(false);
            // Lo que agregan las gafas es marco o vidrio sobre el ojo, nunca vidrio sobre la piel.
            if (!same(p, w)) expect(same(w, pixel(wornSkin[k]!, i)), `${name}: vidrio sobre la piel`).toBe(true);
          }
        });
      }
  });

  it("de espaldas, las patillas de las gafas redondas se ven sobre el pelo castaño y el oscuro", () => {
    for (const hair of ["#6b3a22", "#3b2219", "#1b1b1b"]) {
      const bare = cell(drawCharacter({ ...base, hair }), 0, UP);
      const worn = cell(drawCharacter({ ...base, hair, face: "round-glasses" }), 0, UP);
      let changed = 0;
      for (let i = 0; i < FRAME * FRAME; i++) {
        const [a, b] = [pixel(bare, i), pixel(worn, i)];
        if (same(a, b)) continue;
        changed++;
        const diff = Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);
        expect(diff, `patilla sobre ${hair}`).toBeGreaterThan(100);
      }
      expect(changed, hair).toBeGreaterThan(0);
    }
  });
});

describe("cabeza", () => {
  const ITEMS = HEAD_ITEMS.filter((h) => h !== "none");

  it("cada cosa de la cabeza se ve en todas las vistas, con cualquier peinado", () => {
    for (const hairStyle of HAIR_STYLES)
      for (const head of ITEMS) {
        const look = { ...base, hairStyle };
        expect(missing(ALL, changedViews(look, { ...look, head })), `${head} con ${hairStyle}`).toEqual([]);
      }
    const look = (head: HeadItem): CharacterStyle => ({ ...base, head });
    expect(allDistinct(HEAD_ITEMS, look, RIGHT), "de frente").toEqual([]);
    expect(allDistinct(HEAD_ITEMS, look, UP), "de espaldas").toEqual([]);
  });

  it("gorra, gorro, moño y pañoleta usan el color de acento; sombrero, corona y flor tienen el suyo", () => {
    const accent: HeadItem[] = ["cap", "beanie", "headphones", "bow", "bandana"];
    for (const head of ITEMS) expect(usesColor({ ...base, head }, "accent"), head).toBe(accent.includes(head));
  });

  it("la gorra, el gorro, el sombrero y la pañoleta no dejan pasar el pelo por encima", () => {
    // Con cualquier peinado, lo más alto del dibujo es lo mismo que con el pelo corto: el sombrero.
    const topRow = (sheet: PixelCanvas, col: number, row: number) => {
      for (let y = 0; y < FRAME; y++)
        for (let x = 0; x < FRAME; x++) if (sheet.data[((row * FRAME + y) * sheet.width + col * FRAME + x) * 4 + 3]) return y;
      return FRAME;
    };
    const tops = (style: CharacterStyle) => {
      const w = drawCharacter(style);
      const s = drawSitting(style);
      return [topRow(w, 0, RIGHT), topRow(w, 0, UP), topRow(w, 1, RIGHT), topRow(s, RIGHT, 0), topRow(s, UP, 0)];
    };
    for (const head of ["cap", "beanie", "straw-hat", "bandana"] as const) {
      const ref = tops({ ...base, head });
      for (const hairStyle of HAIR_STYLES) expect(tops({ ...base, hairStyle, head }), `${head} con ${hairStyle}`).toEqual(ref);
    }
  });

  it("la corona, el moño, los audífonos y la flor se apoyan en el pelo o la cabeza (no flotan)", () => {
    // Algún píxel de la cosa (por encima de la frente) tiene justo debajo pelo o piel del dibujo sin ella.
    const rests = (style: CharacterStyle, head: HeadItem, row: number) => {
      const a = drawCharacter(style);
      const b = drawCharacter({ ...style, head });
      const px = (s: PixelCanvas, x: number, y: number) => {
        const i = ((row * FRAME + y) * s.width + x) * 4;
        return [s.data[i]!, s.data[i + 1]!, s.data[i + 2]!, s.data[i + 3]!];
      };
      const item = (x: number, y: number) => {
        const q = px(b, x, y);
        return q[3]! > 0 && !isOut(q) && !same(q, px(a, x, y));
      };
      for (let y = 0; y < ABOVE_BROW; y++)
        for (let x = 0; x < FRAME; x++) {
          if (!item(x, y) || item(x, y + 1)) continue;
          const below = px(a, x, y + 1);
          if (below[3]! > 0 && !isOut(below)) return true;
        }
      return false;
    };
    for (const head of ["crown", "bow", "headphones", "flower"] as const)
      for (const hairStyle of HAIR_STYLES)
        for (const [row, name] of [
          [RIGHT, "de frente"],
          [UP, "de espaldas"],
        ] as const)
          expect(rests({ ...base, hairStyle }, head, row), `${head} con ${hairStyle} ${name}`).toBe(true);
  });

  it("con corona, el moño y el moño alto asoman entre las puntas (no quedan como pelo corto)", () => {
    // ¿Algún píxel del pelo llega a la altura de las puntas de la corona o más arriba?
    const peeks = (hairStyle: HairStyle, row: number) => {
      const look: CharacterStyle = { ...base, hairStyle, head: "crown" };
      const crowned = cell(drawCharacter(look), 0, row);
      const recolored = cell(drawCharacter({ ...look, hair: "#ff00ff" }), 0, row);
      const bare = cell(drawCharacter({ ...base, hairStyle }), 0, row);
      let hairTop = FRAME;
      let crownTop = FRAME;
      for (let i = 0; i < FRAME * FRAME; i++) {
        const y = Math.floor(i / FRAME);
        const p = pixel(crowned, i);
        if (!same(p, pixel(recolored, i))) hairTop = Math.min(hairTop, y);
        else if (p[3] && !isOut(p) && !same(p, pixel(bare, i))) crownTop = Math.min(crownTop, y);
      }
      return hairTop <= crownTop;
    };
    for (const [row, name] of [
      [RIGHT, "de frente"],
      [UP, "de espaldas"],
    ] as const) {
      // Con el corto la banda tapa todo el pelo de arriba.
      expect(peeks("short", row), `corto ${name}`).toBe(false);
      for (const hairStyle of ["bun", "top-knot"] as const) expect(peeks(hairStyle, row), `${hairStyle} ${name}`).toBe(true);
    }
  });
});

it("el dibujo de pelo, cara y cabeza es determinista", () => {
  for (const style of [
    { ...base, hairStyle: "dreads", eyes: "big", eyeColor: "#437a55", freckles: true, facialHair: "goatee", face: "eyepatch", head: "bandana" },
    { ...base, hairStyle: "mohawk", eyes: "wink", facialHair: "stubble", face: "sunglasses", head: "crown" },
    { ...base, hairStyle: "pigtails", eyes: "happy", blush: false, face: "round-glasses", head: "bow" },
  ] satisfies CharacterStyle[]) {
    expect(same(drawCharacter(style).data, drawCharacter(style).data)).toBe(true);
    expect(same(drawSitting(style).data, drawSitting(style).data)).toBe(true);
  }
});
