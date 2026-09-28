// Conjuntos del chibi: lo que va encima de la parte de arriba y de la de abajo (overol, chaqueta,
// delantal, vestido, mono, saco, chaleco, abrigo, impermeable, bata, filipina, pijama, ruana…) y los
// trajes de baño, que van en lugar de la ropa. Filas del cuerpo: torso 13-19, cintura 20, piernas 21-24.
import type { Outfit, Swimwear } from "@hyvento/shared";
import type { RGBA } from "../pixel";
import { BUTTON, type Cloth } from "./clothes";
import type { Ctx, Three, View } from "./kit";

/** Filas de tela de cada traje de baño (columnas por fila), de frente y de espaldas. */
type SwimCut = Record<number, readonly number[]>;
const span = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const SWIM_CUT: Record<Exclude<Swimwear, "trunks">, Record<View, SwimCut>> = {
  // Entero: tirantes, escote redondo adelante y espalda abierta; la pierna bien cortada en la cadera.
  swimsuit: {
    front: {
      13: [5, 10],
      14: [4, 5, 6, 9, 10, 11],
      15: span(4, 11),
      16: span(4, 11),
      17: span(4, 11),
      18: span(4, 11),
      19: span(4, 11),
      20: span(4, 11),
      21: span(6, 9),
    },
    back: {
      13: [5, 10],
      14: [4, 5, 10, 11],
      15: [4, 5, 10, 11],
      16: [4, 5, 10, 11],
      17: span(4, 11),
      18: span(4, 11),
      19: span(4, 11),
      20: span(4, 11),
      21: span(6, 9),
    },
  },
  // Bikini: tiras al cuello, dos copas y la parte de abajo; de espaldas, la tira que cruza con su lazo.
  bikini: {
    front: { 13: [6, 9], 14: [5, 6, 9, 10], 15: span(5, 10), 16: [5, 6, 7, 9, 10], 20: span(4, 11), 21: span(6, 9) },
    back: { 16: span(4, 11), 17: [7, 9], 20: span(4, 11), 21: span(6, 9) },
  },
};

/**
 * Traje de baño: torso de piel y encima el bañador (del color de abajo, con cordón y franja de acento) o
 * el entero y el bikini (del color de arriba, con su patrón). Sentado, lo que va sobre el muslo lo dibuja
 * drawLap.
 */
export function drawSwimwear(ctx: Ctx, outfit: Swimwear, paint: Cloth) {
  const { c, t, view, sit, y } = ctx;
  const front = view === "front";
  const [k0, k1] = t.skin;
  // Los brazos son de piel como el torso: el de atrás (con luz) se separa del torso con una sombra y el de
  // adelante (en sombra) con el torso claro.
  for (let r = 13; r <= 20; r++)
    for (let x = 4; x <= 11; x++) c.set(x, y(r), (x === 4 && r >= 14) || (x === 11 && r === 13) ? k0 : k1);
  // Ombligo (el entero lo tapa).
  if (front && outfit !== "swimsuit") c.set(8, y(18), k0);
  if (outfit === "trunks") {
    // Pretina del color de abajo con el cordón de acento adelante.
    const [p0, p1] = t.pants;
    c.rect(4, y(20), 8, 1, p0);
    c.set(4, y(20), p1);
    if (front) {
      c.set(7, y(20), t.accent[2]);
      c.set(8, y(20), t.accent[1]);
    }
    return;
  }
  for (const [row, xs] of Object.entries(SWIM_CUT[outfit][view])) {
    const r = Number(row);
    if (sit && r > 20) continue;
    for (const x of xs) paint(x, r, x === 11 ? 0 : x === 5 && r <= 16 ? 2 : 1);
  }
  // Nudo del lazo del bikini en la espalda.
  if (outfit === "bikini" && !front) paint(8, 16, 2);
}

/** Un bloque de tela con sombra a la derecha (columna `x1`) y luz arriba a la izquierda. */
function slab(ctx: Ctx, x0: number, x1: number, r0: number, r1: number, k: Three | [RGBA, RGBA]) {
  const [k0, k1] = k;
  const k2 = k.length > 2 ? (k as Three)[2] : k1;
  for (let r = r0; r <= r1; r++) for (let x = x0; x <= x1; x++) ctx.c.set(x, ctx.y(r), x === x1 ? k0 : x === x0 + 1 && r <= r0 + 3 ? k2 : k1);
}

/** Conjuntos encima de la parte de arriba (el torso ya está dibujado; los que la tapan la pintan entera). */
export function drawOutfit(ctx: Ctx, outfit: Outfit, paint: Cloth) {
  const draw = OUTFIT_DRAW[outfit as Exclude<Outfit, Swimwear>];
  draw?.(ctx, paint);
}

type Draw = (ctx: Ctx, paint: Cloth) => void;

const OUTFIT_DRAW: Record<Exclude<Outfit, Swimwear>, Draw> = {
  overalls({ c, t, view, y }) {
    // Overol del color de abajo: tirantes con botones, peto con bolsillo y la parte de arriba asomando.
    const [p0, p1] = t.pants;
    c.rect(5, y(13), 1, 2, p1);
    c.rect(10, y(13), 1, 2, p1);
    if (view === "front") {
      c.rect(5, y(15), 6, 3, p1);
      c.rect(7, y(16), 2, 1, p0);
      c.set(5, y(15), BUTTON);
      c.set(10, y(15), BUTTON);
    } else {
      c.rect(5, y(15), 1, 3, p1);
      c.rect(10, y(15), 1, 3, p1);
      c.rect(6, y(16), 4, 1, p1);
    }
    c.rect(4, y(18), 8, 3, p1);
    c.rect(11, y(18), 1, 3, p0);
    c.set(4, y(18), p0);
  },

  jacket({ c, t, view, y }) {
    // Chaqueta abierta del color de acento: de frente se ve la parte de arriba en el medio.
    const [a0, a1, a2] = t.accent;
    if (view === "front") {
      c.rect(4, y(13), 3, 8, a1);
      c.rect(10, y(13), 2, 8, a1);
      c.rect(11, y(13), 1, 8, a0);
      c.rect(5, y(13), 1, 4, a2);
      c.set(6, y(13), a2);
      c.set(10, y(13), a2);
      c.set(6, y(17), a0);
      c.set(5, y(18), a0);
      c.set(5, y(19), a0);
    } else {
      c.rect(4, y(13), 8, 8, a1);
      c.rect(11, y(13), 1, 8, a0);
      c.rect(5, y(13), 1, 4, a2);
      c.rect(5, y(13), 6, 1, a2);
      c.rect(8, y(17), 1, 4, a0);
    }
  },

  apron({ c, t, view, sit, y, Y }) {
    // Delantal crema, como el de la cafetería.
    const [c0, c1, c2] = t.cream;
    if (view === "front") {
      c.set(6, y(13), c1);
      c.set(9, y(13), c1);
      c.rect(6, y(14), 4, 3, c1);
      c.rect(6, y(14), 4, 1, c2);
      c.rect(5, y(17), 6, 4, c1);
      c.rect(10, y(17), 1, 4, c0);
      c.set(4, y(17), c0);
      c.set(11, y(17), c0);
      c.rect(7, y(19), 2, 1, c0);
      // Sentado, el delantal cae sobre el regazo.
      if (sit) c.rect(6, Y(25), 4, 1, c1);
      else {
        c.rect(5, y(21), 6, 2, c1);
        c.rect(10, y(21), 1, 2, c0);
        c.rect(5, y(22), 6, 1, c0);
      }
    } else {
      // De espaldas solo se ven la tira de la cintura y el lazo.
      c.rect(4, y(17), 8, 1, c1);
      c.rect(7, y(17), 2, 1, c2);
      c.set(6, y(16), c1);
      c.set(9, y(16), c1);
      c.set(7, y(18), c0);
      c.set(8, y(18), c0);
    }
  },

  dress({ c, t, view, sit, y }, paint) {
    // Vestido del color de arriba (con su patrón): lazo en la cintura y falda con vuelo.
    if (view === "front") {
      c.rect(7, y(13), 3, 1, t.skin[1]);
      c.set(8, y(14), t.skin[1]);
    }
    c.rect(4, y(19), 8, 1, t.shirt[0]);
    for (let x = 4; x <= 11; x++) paint(x, 20, x === 11 ? 0 : x === 4 ? 2 : 1);
    if (sit) return;
    // La falda se abre abajo; en la fila de las manos queda angosta para no taparlas.
    for (let x = 4; x <= 11; x++) paint(x, 21, x === 11 ? 0 : x === 4 ? 2 : 1);
    for (let x = 3; x <= 12; x++) paint(x, 22, x >= 11 || x === 6 || x === 9 ? 0 : x === 3 ? 2 : 1);
  },

  gown({ c, t, view, sit, y }, paint) {
    // Vestido largo sin mangas: escote con tirantes, lazo en la cintura y la falda hasta el suelo.
    const skin = view === "front" ? t.skin[1] : t.skin[0];
    c.set(4, y(13), skin);
    c.set(11, y(13), t.skin[0]);
    c.rect(6, y(13), 4, 1, skin);
    if (view === "front") c.rect(7, y(14), 2, 1, t.skin[1]);
    else c.rect(6, y(14), 4, 2, t.skin[0]);
    c.rect(4, y(19), 8, 1, t.shirt[0]);
    c.set(7, y(19), t.shirt[2]);
    for (let x = 4; x <= 11; x++) paint(x, 20, x === 11 ? 0 : x === 4 ? 2 : 1);
    if (sit) return;
    const rows: [number, number, number][] = [
      [21, 4, 11],
      [22, 3, 12],
      [23, 3, 12],
      [24, 2, 13],
      [25, 2, 13],
    ];
    for (const [r, x0, x1] of rows)
      for (let x = x0; x <= x1; x++) paint(x, r, x >= x1 - 1 || (r >= 22 && (x === 6 || x === 10)) ? 0 : x === x0 ? 2 : 1);
    for (let x = 2; x <= 13; x++) c.set(x, y(25), t.shirt[0]);
  },

  coveralls(ctx) {
    // Mono entero del color de abajo: cuello, cierre al medio, bolsillo del pecho y cinturón.
    const { c, t, view, y } = ctx;
    slab(ctx, 4, 11, 13, 20, t.pants);
    const [p0, p1] = t.pants;
    c.rect(4, y(20), 8, 1, p0);
    if (view === "front") {
      c.set(6, y(13), p1);
      c.set(9, y(13), p1);
      c.rect(7, y(13), 2, 1, t.skin[1]);
      for (let r = 14; r <= 19; r++) c.set(8, y(r), p0);
      c.set(8, y(14), t.metal[2]);
      c.rect(5, y(15), 2, 1, p0);
      c.set(8, y(20), t.metal[1]);
    } else {
      c.rect(5, y(13), 6, 1, p1);
      c.rect(5, y(16), 6, 1, p0);
    }
  },

  blazer({ c, t, view, y }) {
    // Saco de traje (color de abajo): solapas, un botón y el escote en V que deja ver la camisa.
    const [p0, p1] = t.pants;
    const lapel = t.pants[1];
    if (view === "front") {
      for (let r = 13; r <= 20; r++)
        for (let x = 4; x <= 11; x++) {
          const open = r <= 17 && (x === 7 || x === 8);
          if (open) continue;
          c.set(x, y(r), x === 11 ? p0 : p1);
        }
      // Solapas: el borde claro que baja en diagonal hasta el botón.
      c.set(6, y(13), t.shirt[2]);
      c.set(9, y(13), t.shirt[1]);
      c.set(6, y(14), lapel);
      c.set(6, y(15), p0);
      c.set(9, y(14), p0);
      c.set(9, y(15), p0);
      c.set(6, y(16), p0);
      c.set(9, y(16), p0);
      c.rect(7, y(18), 2, 1, p0);
      c.set(8, y(18), t.ink[2]);
      c.rect(9, y(19), 2, 1, p0);
      c.rect(4, y(20), 8, 1, p0);
    } else {
      for (let r = 13; r <= 20; r++) for (let x = 4; x <= 11; x++) c.set(x, y(r), x === 11 ? p0 : p1);
      c.rect(5, y(13), 6, 1, t.shirt[2]);
      c.rect(8, y(18), 1, 3, p0);
    }
  },

  vest({ c, t, view, y }) {
    // Chaleco (color de abajo): se ven las mangas de la camisa; escote en V y botones.
    const [p0, p1] = t.pants;
    if (view === "front") {
      for (let r = 13; r <= 20; r++)
        for (let x = 4; x <= 11; x++) {
          if (r === 13 && (x === 4 || x === 11)) continue;
          if (r <= 16 && (x === 7 || x === 8)) continue;
          c.set(x, y(r), x === 11 ? p0 : p1);
        }
      c.set(6, y(14), p0);
      c.set(9, y(14), p0);
      for (const r of [17, 19]) c.set(8, y(r), t.gold[2]);
      c.rect(4, y(20), 8, 1, p0);
      // Bolsillo con la cadena del reloj.
      c.set(10, y(18), t.gold[1]);
    } else {
      // La espalda del chaleco es de raso más oscuro, con la hebilla al medio.
      c.rect(4, y(14), 8, 7, p0);
      c.rect(5, y(14), 6, 1, p1);
      c.rect(7, y(18), 2, 1, t.metal[1]);
    }
  },

  coat({ c, t, view, y }) {
    // Abrigo acolchado (color de arriba): cuello alto, franjas de relleno y el cierre, hasta la cadera.
    const [s0, s1, s2] = t.shirt;
    for (let r = 12; r <= 21; r++)
      for (let x = r === 12 ? 5 : 4; x <= (r === 12 ? 10 : 11); x++) c.set(x, y(r), x === 11 ? s0 : x === 5 && r <= 16 ? s2 : s1);
    for (const r of [15, 18, 21]) for (let x = 4; x <= 11; x++) c.set(x, y(r), s0);
    if (view === "front") {
      c.rect(7, y(12), 2, 1, t.skin[1]);
      for (let r = 13; r <= 21; r++) c.set(8, y(r), s0);
      c.set(8, y(13), t.metal[2]);
    } else c.rect(6, y(12), 4, 1, s2);
  },

  raincoat({ c, t, view, y }) {
    // Impermeable largo (color de arriba): cuello, botones de palanca y bolsillos; tapa hasta la rodilla.
    const [s0, s1, s2] = t.shirt;
    for (let r = 12; r <= 23; r++)
      for (let x = r === 12 ? 5 : 4; x <= (r === 12 ? 10 : 11); x++) c.set(x, y(r), x === 11 ? s0 : x === 5 && r <= 16 ? s2 : s1);
    if (view === "front") {
      c.rect(7, y(12), 2, 1, t.skin[1]);
      for (let r = 13; r <= 23; r++) c.set(8, y(r), s0);
      for (const r of [15, 17, 19]) c.set(9, y(r), t.ink[2]);
      c.rect(5, y(19), 2, 1, s0);
      c.rect(10, y(19), 1, 1, s0);
    } else {
      // La capucha colgando y la costura de la espalda.
      c.rect(5, y(12), 6, 3, s1);
      c.rect(10, y(12), 1, 3, s0);
      c.rect(6, y(15), 4, 1, s0);
      c.rect(8, y(19), 1, 5, s0);
    }
    for (let x = 4; x <= 11; x++) c.set(x, y(23), s0);
  },

  "lab-coat"({ c, t, view, y }) {
    // Bata blanca abierta, hasta la rodilla: se ve lo de abajo en el medio; solapas y bolsillos.
    const [w0, w1, w2] = t.white;
    for (let r = 13; r <= 23; r++)
      for (let x = 4; x <= 11; x++) {
        if (view === "front" && (x === 7 || x === 8)) continue;
        c.set(x, y(r), x === 11 ? w0 : x === 5 && r <= 16 ? w2 : w1);
      }
    if (view === "front") {
      c.set(6, y(13), w2);
      c.set(9, y(13), w2);
      c.set(6, y(14), w0);
      c.set(9, y(14), w0);
      c.rect(4, y(20), 2, 1, w0);
      c.rect(10, y(20), 2, 1, w0);
      c.set(5, y(15), w0);
    } else {
      c.rect(5, y(13), 6, 1, w2);
      c.rect(6, y(19), 4, 1, w0);
      c.rect(8, y(20), 1, 4, w0);
    }
    for (let x = 4; x <= 11; x++) if (view === "back" || (x !== 7 && x !== 8)) c.set(x, y(23), w0);
  },

  "chef-coat"({ c, t, view, y }) {
    // Filipina blanca cruzada: cuello alto, dos filas de botones y la solapa que cruza.
    const [w0, w1, w2] = t.white;
    for (let r = 12; r <= 21; r++)
      for (let x = r === 12 ? 6 : 4; x <= (r === 12 ? 9 : 11); x++) c.set(x, y(r), x === 11 ? w0 : x === 5 && r <= 16 ? w2 : w1);
    if (view === "front") {
      for (let r = 13; r <= 21; r++) c.set(10, y(r), w0);
      for (const r of [14, 16, 18]) {
        c.set(6, y(r), t.ink[2]);
        c.set(9, y(r), t.ink[2]);
      }
    } else c.rect(6, y(12), 4, 1, w2);
    for (let x = 4; x <= 11; x++) c.set(x, y(21), w0);
  },

  pajamas({ c, t, view, y }, paint) {
    // Pijama: la tela del color de arriba con su patrón y los ribetes del color secundario.
    for (let r = 13; r <= 20; r++) for (let x = 4; x <= 11; x++) paint(x, r, x === 11 ? 0 : x === 5 && r <= 16 ? 2 : 1);
    const [k0, k1] = t.top2;
    if (view === "front") {
      c.set(6, y(13), k1);
      c.set(9, y(13), k1);
      c.rect(7, y(13), 2, 1, t.skin[1]);
      for (let r = 14; r <= 20; r++) c.set(8, y(r), k1);
      c.rect(5, y(16), 2, 1, k0);
    } else c.rect(5, y(13), 6, 1, k1);
    for (let x = 4; x <= 11; x++) if (x % 2) c.set(x, y(20), t.shirt[0]);
  },

  robe({ c, t, view, y }) {
    // Bata cruzada hasta la rodilla (color de arriba), con el ribete del color secundario y el cinturón.
    const [s0, s1, s2] = t.shirt;
    const [k0, k1] = t.top2;
    for (let r = 13; r <= 23; r++) for (let x = 4; x <= 11; x++) c.set(x, y(r), x === 11 ? s0 : x === 5 && r <= 16 ? s2 : s1);
    if (view === "front") {
      // Escote en V y el borde que cruza en diagonal.
      c.rect(7, y(13), 2, 1, t.skin[1]);
      c.set(8, y(14), t.skin[0]);
      for (const [x, r] of [[6, 13], [7, 14], [9, 13], [9, 14], [8, 15], [8, 16], [7, 17], [7, 18]] as const) c.set(x, y(r), k1);
      for (let r = 20; r <= 23; r++) c.set(7, y(r), k1);
    } else c.rect(5, y(13), 6, 1, k1);
    c.rect(4, y(19), 8, 1, s0);
    if (view === "front") {
      c.set(6, y(19), s2);
      c.set(6, y(20), s0);
      c.set(5, y(21), s0);
    }
    for (let x = 4; x <= 11; x++) c.set(x, y(23), k0);
  },

  ruana({ c, t, view, y }) {
    // Ruana de lana: un cuadro que cae de los hombros y tapa los brazos, con franjas y flecos.
    const [s0, s1, s2] = t.shirt;
    const [k0, k1] = t.top2;
    const rows: [number, number, number][] = [
      [12, 4, 11],
      [13, 3, 12],
    ];
    for (let r = 14; r <= 20; r++) rows.push([r, 2, 13]);
    for (const [r, x0, x1] of rows)
      for (let x = x0; x <= x1; x++) c.set(x, y(r), x >= x1 - 1 ? s0 : x <= x0 + 1 && r <= 16 ? s2 : s1);
    for (const r of [16, 19]) for (let x = 2; x <= 13; x++) c.set(x, y(r), x >= 12 ? k0 : k1);
    if (view === "front") {
      c.rect(7, y(12), 2, 1, t.skin[1]);
      for (let r = 14; r <= 20; r++) c.set(8, y(r), s0);
    }
    // Flecos.
    for (let x = 2; x <= 13; x += 2) c.set(x, y(21), x >= 12 ? s0 : s1);
  },

  "hi-vis"({ c, t, view, y }) {
    // Chaleco reflectivo naranja con dos cintas plateadas; se ven las mangas de la camiseta.
    const orange: Three = [[0xc2, 0x55, 0x1c, 255], [0xf0, 0x7a, 0x22, 255], [0xfb, 0xa0, 0x4a, 255]];
    const silver = t.metal[2];
    for (let r = 13; r <= 20; r++)
      for (let x = 4; x <= 11; x++) {
        if (r === 13 && (x === 4 || x === 11)) continue;
        if (view === "front" && r <= 14 && (x === 7 || x === 8)) continue;
        c.set(x, y(r), x === 11 ? orange[0] : x === 5 && r <= 16 ? orange[2] : orange[1]);
      }
    for (const r of [16, 19]) for (let x = 4; x <= 11; x++) c.set(x, y(r), silver);
    if (view === "front") for (const r of [15, 17, 18, 20]) c.set(8, y(r), orange[0]);
  },
};
