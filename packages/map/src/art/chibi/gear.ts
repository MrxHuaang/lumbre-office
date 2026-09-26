// Accesorios de cuello y espalda del chibi (usan el color de acento).
import type { PixelCanvas } from "../pixel";
import type { Ctx, Row, Three, View } from "./kit";

/** Lo que va en el cuello. De frente va antes del pelo (el pelo largo cae encima); de espaldas, después. */
export function drawNeckGear({ c, t, look, view, y }: Ctx) {
  if (look.neck === "scarf") drawScarf(c, t.accent, view, y);
}

/**
 * Lo que va en la espalda (morral, capa). Se llama dos veces: `behind` antes del cuerpo (lo que queda
 * detrás, visto de frente) y `over` al final (lo que se ve encima, visto de espaldas).
 */
export function drawBackGear(_ctx: Ctx, _layer: "behind" | "over") {
  // Todavía no hay nada para la espalda.
}

function drawScarf(c: PixelCanvas, a: Three, view: View, y: Row) {
  c.rect(4, y(12), 8, 2, a[1]);
  c.rect(11, y(12), 1, 2, a[0]);
  c.rect(5, y(12), 2, 1, a[2]);
  c.rect(4, y(13), 8, 1, a[0]);
  if (view === "front") {
    // La punta cuelga por delante, con flecos.
    c.rect(9, y(14), 2, 2, a[1]);
    c.rect(10, y(14), 1, 2, a[0]);
    c.set(9, y(16), a[0]);
    c.set(10, y(16), a[1]);
  } else {
    c.rect(5, y(14), 2, 1, a[1]);
    c.set(5, y(15), a[0]);
  }
}
