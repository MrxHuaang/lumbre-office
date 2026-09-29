// Mundo lleno: lo que se dibuja en los paneles nuevos del sótano. Los símbolos de los rodillos del
// tragamonedas (tinto, arepa, mango, campana, estrella y el siete), en pixel de 12x12 con contorno como el
// resto del arte (letras por color, "o" = contorno, "." = vacío).
import type { SlotSymbol } from "@hyvento/shared";
import { OUT } from "./palette";
import { PixelCanvas, hex, type RGBA } from "./pixel";

interface Glyph {
  rows: string[];
  colors: Record<string, string>;
}

const SYMBOLS: Record<SlotSymbol, Glyph> = {
  // El pocillo de tinto con su humito.
  tinto: {
    rows: ["............", "....h..h....", ".....hh.....", "............", "oooooooooo..", "oSsssssssoo.", "owwwwwwwwo.o", "owwwwwwwwo.o", "owwwwwwwwooo", ".owwwwwwo...", "ppppppppppp.", ".ooooooooo.."],
    colors: { h: "#e8e0d0", S: "#6e3a22", s: "#2a140c", w: "#f2e8d6", p: "#ddd0b8" },
  },
  // La arepa asada con las marcas de la parrilla.
  arepa: {
    rows: ["............", "...oooooo...", ".ooyyyyyyoo.", "oyyYyyyyYyyo", "oyyydyyyyyyo", "oyyyydyyYyyo", "oyYyyydyyyyo", "oyyyyyydyyyo", "oyyyYyyyyyyo", ".ooyyyyyyoo.", "...oooooo...", "............"],
    colors: { y: "#f0d890", Y: "#fff0c0", d: "#a8783a" },
  },
  // El mango maduro con su hojita.
  mango: {
    rows: [".......gg...", "......gGo...", "....oooo....", "...orrrao...", "..orrraaao..", ".orraaaaYao.", ".oraaaaaYYo.", ".oaaaaaYYYo.", ".oaaaaYYYYo.", "..oaaYYYYo..", "...ooooooo..", "............"],
    colors: { g: "#6fb34a", G: "#3f7a2e", r: "#e0503a", a: "#f39a2e", Y: "#f7d84a" },
  },
  // La campana dorada.
  campana: {
    rows: [".....oo.....", "....oyyo....", "...oyYyyo...", "...oyYyyo...", "..oyYyyyyo..", "..oyYyyyyo..", ".oyYyyyyyyo.", ".oyYyyyyyyo.", "oyyyyyyyyyyo", "oooooooooooo", ".....oyo....", "......o....."],
    colors: { y: "#e8b83a", Y: "#fff0a8" },
  },
  // La estrella de cinco puntas.
  estrella: {
    rows: [".....oo.....", ".....oyo....", "....oyYo....", "....oyYyo...", "oooooyYyoooo", "oyyyyyYyyyyo", ".oyyyyyyyyo.", "..oyyyyyyo..", "..oyyoyyyo..", ".oyyo..oyyo.", ".oyo....oyo.", ".oo......oo."],
    colors: { y: "#f7d84a", Y: "#fffbe0" },
  },
  // El siete rojo del premio mayor.
  siete: {
    rows: ["oooooooooooo", "orrrrrrrrrRo", "orrrrrrrrrRo", "oooooooorrRo", ".......orrRo", "......orrRo.", ".....orrRo..", "....orrRo...", "...orrRo....", "...orrRo....", "...orrRo....", "...ooooo...."],
    colors: { r: "#d93a2b", R: "#8a1f18" },
  },
};

export const SLOT_GLYPH = 12;

/** El símbolo `s` de los rodillos (12x12). */
export function slotSymbol(s: SlotSymbol): PixelCanvas {
  const g = SYMBOLS[s];
  const c = new PixelCanvas(SLOT_GLYPH, SLOT_GLYPH);
  const colors: Record<string, RGBA> = Object.fromEntries(Object.entries(g.colors).map(([k, v]) => [k, hex(v)]));
  g.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === ".") continue;
      c.set(x, y, ch === "o" ? OUT : (colors[ch] ?? OUT));
    }
  });
  return c;
}
