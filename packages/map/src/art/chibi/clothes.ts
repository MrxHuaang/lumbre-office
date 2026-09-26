// Ropa del chibi: piernas y zapatos, brazos, parte de arriba y conjuntos.
import type { Outfit } from "@hyvento/shared";
import { hex, type PixelCanvas, type RGBA } from "../pixel";
import type { Ctx, Row, Tones, View } from "./kit";

/** Piernas (o piel, con vestido) y zapatos. Sentado, las piernas se doblan hacia adelante. */
export function drawLegs({ c, t, look, view, frame, sit, Y }: Ctx) {
  const shoe = t.shoes[1];
  // Con vestido se ven las piernas (piel) y, sentado, la falda sobre las rodillas.
  const legs: [RGBA, RGBA] = look.outfit === "dress" ? [t.skin[0], t.skin[1]] : t.pants;
  const lap: [RGBA, RGBA] = look.outfit === "dress" ? [t.shirt[0], t.shirt[1]] : t.pants;
  if (sit) {
    if (view === "front") {
      c.rect(5, Y(20), 7, 2, lap[1]);
      c.rect(5, Y(22), 7, 1, lap[0]);
      c.rect(10, Y(22), 3, 2, legs[0]);
      c.rect(10, Y(24), 4, 1, shoe);
    } else {
      c.rect(4, Y(20), 8, 2, lap[0]);
    }
    return;
  }
  const lift = (leg: 0 | 1) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1);
  for (const leg of [0, 1] as const) {
    const x = leg === 0 ? 5 : 8;
    const up = lift(leg) ? 1 : 0;
    c.rect(x, Y(19), 3, 4 - up, legs[leg === 0 ? 1 : 0]);
    c.rect(x - (leg === 0 ? 1 : 0), Y(23 - up), 4, 1, shoe);
    c.rect(x - (leg === 0 ? 1 : 0), Y(22 - up), 4, 1, leg === 0 ? t.shoes[2] : shoe);
  }
}

/** Brazos (se balancean al caminar). Con chaqueta, las mangas son de la chaqueta. */
export function drawArms({ c, t, look, y, swing }: Ctx) {
  const sleeve = look.outfit === "jacket" ? t.accent[0] : t.shirt[0];
  c.rect(3, y(14), 1, 4 + swing, sleeve);
  c.set(3, y(18 + swing), t.skin[1]);
  c.rect(12, y(14), 1, 4 - swing, sleeve);
  c.set(12, y(18 - swing), t.skin[0]);
}

/** Parte de arriba, cinturón y, si hay, el conjunto encima. */
export function drawTorso({ c, t, look, view, sit, y, Y }: Ctx) {
  c.rect(4, y(13), 8, 6, t.shirt[1]);
  c.rect(11, y(13), 1, 6, t.shirt[0]);
  c.rect(5, y(13), 1, 3, t.shirt[2]);
  c.rect(4, y(18), 8, 1, t.pants[0]);
  if (view === "front") c.rect(7, y(13), 3, 1, t.shirt[2]);
  if (look.outfit) drawOutfit(c, look.outfit, t, view, sit, y, Y);
}

/** Conjuntos encima de la camisa (el torso ya está dibujado con la camisa y el cinturón). */
function drawOutfit(c: PixelCanvas, outfit: Outfit, t: Tones, view: View, sit: boolean, y: Row, Y: Row) {
  const front = view === "front";
  if (outfit === "overalls") {
    // Overol del color del pantalón: tirantes con botones, peto y la camisa asomando arriba.
    const [p0, p1] = t.pants;
    const button = hex("#f4d35e");
    c.set(5, y(13), p1);
    c.set(10, y(13), p1);
    if (front) {
      c.rect(5, y(14), 6, 2, p1);
      c.rect(7, y(15), 2, 1, p0);
      c.set(5, y(14), button);
      c.set(10, y(14), button);
    } else {
      c.rect(5, y(14), 1, 2, p1);
      c.rect(10, y(14), 1, 2, p1);
    }
    c.rect(4, y(16), 8, 3, p1);
    c.rect(11, y(16), 1, 3, p0);
    c.rect(4, y(16), 1, 1, p0);
    return;
  }
  if (outfit === "dress") {
    // Vestido del color de la camisa: lazo en la cintura y falda con vuelo que tapa el pantalón.
    const [s0, s1, s2] = t.shirt;
    if (front) c.rect(7, y(13), 3, 1, t.skin[1]);
    c.rect(4, y(17), 8, 1, s0);
    c.rect(4, y(18), 8, 1, s1);
    c.rect(11, y(18), 1, 1, s0);
    if (sit) return;
    // La falda se abre abajo; en la fila de las manos queda angosta para no taparlas.
    c.rect(4, y(19), 8, 1, s1);
    c.rect(3, y(20), 10, 1, s1);
    c.set(11, y(19), s0);
    c.rect(11, y(20), 2, 1, s0);
    c.rect(4, y(18), 1, 2, s2);
    c.set(3, y(20), s2);
    for (const x of [6, 9]) c.set(x, y(20), s0);
    return;
  }
  if (outfit === "jacket") {
    // Chaqueta abierta del color de acento: de frente se ve la camisa en el medio.
    const [a0, a1, a2] = t.accent;
    if (front) {
      c.rect(4, y(13), 3, 6, a1);
      c.rect(10, y(13), 2, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.set(6, y(13), a2);
      c.set(10, y(13), a2);
      c.set(6, y(16), a0);
      c.set(5, y(17), a0);
    } else {
      c.rect(4, y(13), 8, 6, a1);
      c.rect(11, y(13), 1, 6, a0);
      c.rect(5, y(13), 1, 3, a2);
      c.rect(5, y(13), 6, 1, a2);
      c.rect(8, y(16), 1, 3, a0);
    }
    return;
  }
  // Delantal crema, como el de la cafetería.
  const [c0, c1, c2] = t.cream;
  if (front) {
    c.set(6, y(13), c1);
    c.set(9, y(13), c1);
    c.rect(6, y(14), 4, 2, c1);
    c.rect(6, y(14), 4, 1, c2);
    c.rect(5, y(16), 6, 3, c1);
    c.rect(10, y(16), 1, 3, c0);
    c.set(4, y(16), c0);
    c.set(11, y(16), c0);
    c.rect(7, y(17), 2, 1, c0);
    if (sit) c.rect(6, Y(20), 5, 1, c1);
    else {
      c.rect(5, y(19), 6, 2, c1);
      c.rect(10, y(19), 1, 2, c0);
      c.rect(5, y(20), 6, 1, c0);
    }
  } else {
    // De espaldas solo se ven la tira de la cintura y el lazo.
    c.rect(4, y(16), 8, 1, c1);
    c.rect(7, y(16), 2, 1, c2);
    c.set(6, y(15), c1);
    c.set(9, y(15), c1);
    c.set(7, y(17), c0);
    c.set(8, y(17), c0);
  }
}
