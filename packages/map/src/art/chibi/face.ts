// Cara del chibi: ojos, rubor, boca, vello facial y lo que va en la cara (gafas).
import { OUT } from "../palette";
import { alpha, hex } from "../pixel";
import type { Ctx } from "./kit";

/** Cara (solo de frente): ojos de 2px, rubor, boca y vello facial. */
export function drawFace({ c, t, look, y }: Ctx) {
  c.rect(7, y(7), 1, 2, OUT);
  c.rect(10, y(7), 1, 2, OUT);
  c.set(7, y(7), hex("#4a3a5a"));
  if (look.blush) {
    c.set(6, y(9), alpha(hex("#e5707a"), 0.55));
    c.set(11, y(9), alpha(hex("#e5707a"), 0.55));
  }
  c.set(9, y(10), t.skin[0]);
  const hr = t.hair;
  if (look.facialHair === "beard") {
    c.rect(4, y(9), 2, 3, hr[1]);
    c.rect(11, y(9), 2, 3, hr[0]);
    c.rect(5, y(11), 7, 1, hr[1]);
    c.rect(7, y(12), 3, 1, hr[0]);
    c.set(9, y(10), hr[0]);
  }
}

/** Lo que va en la cara, por encima del pelo. */
export function drawFaceGear({ c, look, view, y }: Ctx) {
  if (look.face !== "glasses") return;
  const frameC = hex("#1f2a44");
  if (view === "front") {
    for (const x of [6, 8, 9, 11]) c.set(x, y(7), frameC);
    c.set(7, y(6), frameC);
    c.set(10, y(6), frameC);
    c.set(7, y(8), alpha(hex("#bfe3ff"), 0.5));
    c.set(10, y(8), alpha(hex("#bfe3ff"), 0.5));
  } else {
    c.set(3, y(7), frameC);
    c.set(12, y(7), frameC);
  }
}
