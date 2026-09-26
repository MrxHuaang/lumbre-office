// Dibujos de los emotes (van dentro de un globo sobre la cabeza). 9x9, con contorno propio.
import { OUT } from "./palette";
import { PixelCanvas, hex, type RGBA } from "./pixel";

const EMOTES: Record<string, { rows: string[]; colors: Record<string, RGBA> }> = {
  wave: {
    rows: [
      "..o.o....", //
      ".oso.o.o.",
      ".osooso.o",
      ".ossssoso",
      "osssssso.",
      "ossssso..",
      ".ossso...",
      "..ooo....",
      ".........",
    ],
    colors: { s: hex("#f1c27d") },
  },
  heart: {
    rows: [
      ".........", //
      ".oo...oo.",
      "orroorrro",
      "orwrrrrro",
      "orrrrrrRo",
      ".orrrrRo.",
      "..orrRo..",
      "...oRo...",
      "....o....",
    ],
    colors: { r: hex("#e5484d"), R: hex("#a8262a"), w: hex("#ffd0d0") },
  },
  laugh: {
    rows: [
      "..ooooo..", //
      ".oyyyyyo.",
      "oyoyyyoyo",
      "oyyyyyyyo",
      "oyoooooyo",
      "oyorrroyo",
      ".oyoooyo.",
      "..ooooo..",
      ".........",
    ],
    colors: { y: hex("#f6c945"), r: hex("#d9534f") },
  },
  clap: {
    rows: [
      "....o....", //
      "...oyo...",
      "oooyYyooo",
      "oyyyYyyyo",
      ".oyyyyyo.",
      "..oyyyo..",
      ".oyyoyyo.",
      ".oyo.oyo.",
      ".oo...oo.",
    ],
    colors: { y: hex("#f6c945"), Y: hex("#fff2a8") },
  },
  idea: {
    rows: [
      "..ooooo..", //
      ".oyYyyyo.",
      "oyYyyyyyo",
      "oyyyyyyyo",
      ".oyyyyyo.",
      "..oyyyo..",
      "..ogggo..",
      "..ogggo..",
      "...ooo...",
    ],
    colors: { y: hex("#ffd84a"), Y: hex("#fff6c8"), g: hex("#8a8a96") },
  },
  question: {
    rows: [
      "..ooooo..", //
      ".oqqqqqo.",
      "oqqoooqqo",
      ".oo..oqqo",
      "....oqqo.",
      "...oqqo..",
      "...oooo..",
      "...oqqo..",
      "...oooo..",
    ],
    colors: { q: hex("#7b5cd6") },
  },
  dance: {
    rows: [
      "....ooooo", //
      "....onnno",
      "....oo.oo",
      "....o..o.",
      "....o..o.",
      ".ooo.ooo.",
      "onnnonnno",
      ".ooo.ooo.",
      ".........",
    ],
    colors: { n: hex("#4f8a3c") },
  },
};

export const EMOTE_ART = Object.keys(EMOTES);

/** Dibujo de un emote (9x9). Un id desconocido devuelve un lienzo vacío de 1x1. */
export function drawEmote(id: string): PixelCanvas {
  const e = EMOTES[id];
  if (!e) return new PixelCanvas(1, 1);
  const c = new PixelCanvas(9, 9);
  e.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      const color = ch === "o" ? OUT : e.colors[ch];
      if (color) c.set(x, y, color);
    }),
  );
  return c;
}
