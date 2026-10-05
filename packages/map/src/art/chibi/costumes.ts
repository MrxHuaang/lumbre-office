// Detalles que solo llevan los trajes completos (ver packages/shared/src/costumes.ts): se pintan encima
// de la ropa ya dibujada. `body` va después del torso (bolsillos, estampados, cintas) y `head` al final
// (lo que vuela junto a la cabeza).
import type { CostumeDetail } from "@hyvento/shared";
import { hex, type RGBA } from "../pixel";
import type { Ctx } from "./kit";

type Layer = "body" | "head";
type Detail = { layer: Layer; draw: (ctx: Ctx) => void };

const BLUE = hex("#4660a0");
const RED = hex("#c0392b");
const YELLOW = hex("#f4d35e");
const BEE_BLACK = hex("#2b1b17");
const WING = hex("#e8f4ff", 200);
const PAINT: RGBA[] = [hex("#c0392b"), hex("#4660a0"), hex("#f4d35e"), hex("#5ea247")];
const CONFETTI: RGBA[] = [hex("#ff5fd2"), hex("#f4d35e"), hex("#3fd0dd"), hex("#8cc653")];
const FANG = hex("#fffaf0");
const LIPS = hex("#8e2a3a");
/** Lo tallado de la cara de ahuyama del disfraz y los huesos del esqueleto (no se tiñen). */
const CARVED = hex("#3a1a14");
const BONE = hex("#f3f1ec");
const BONE_DARK = hex("#cfc8d8");

/** Filas de las manos en este frame (el brazo de atrás y el de adelante), para lo que va en los brazos. */
const armLen = ({ swing }: Ctx) => [6 + swing, 6 - swing] as const;

const DETAILS: Record<CostumeDetail, Detail> = {
  // Lapicero en el bolsillo del pecho.
  "pocket-pen": {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view !== "front") return;
      c.set(5, y(14), BLUE);
      c.set(6, y(14), t.metal[2]);
      c.rect(5, y(15), 2, 1, t.shirt[0]);
    },
  },
  // Pañuelo de bolsillo del saco, en el lado de adelante.
  "pocket-square": {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view !== "front") return;
      c.set(10, y(15), t.white[2]);
      c.set(11, y(15), t.white[1]);
      c.set(10, y(16), t.white[1]);
    },
  },
  // "</>" en el pecho del buzo, con el color secundario.
  "code-print": {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view !== "front") return;
      // "<" y ">" con aire entre medio (y sin los cordones del buzo encima).
      for (const [x, r] of [[7, 15], [9, 15], [7, 14], [9, 14]] as const) c.set(x, y(r), t.shirt[1]);
      for (const [x, r] of [[6, 15], [5, 16], [6, 17], [9, 15], [10, 16], [9, 17]] as const) c.set(x, y(r), t.top2[2]);
    },
  },
  // Los cuadros del pantalón de cocina los pinta la pierna (clothes.ts); aquí nada más.
  "chef-check": { layer: "body", draw() {} },
  // Ligas en las mangas del crupier.
  "sleeve-garters": {
    layer: "body",
    draw({ c, t, y }) {
      c.set(3, y(16), t.accent[1]);
      c.set(12, y(16), t.accent[0]);
    },
  },
  // Cintas reflectivas: en el pecho y en los brazos (en las piernas las pinta la pierna).
  reflective: {
    layer: "body",
    draw(ctx) {
      const { c, t, y } = ctx;
      for (let x = 4; x <= 11; x++) {
        c.set(x, y(17), t.metal[2]);
        c.set(x, y(18), YELLOW);
      }
      const [back, front] = armLen(ctx);
      if (back >= 5) c.set(3, y(18), t.metal[2]);
      if (front >= 5) c.set(12, y(18), t.metal[1]);
    },
  },
  // Parche de la misión en el pecho y la bandera en el hombro.
  "space-patch": {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view === "front") {
        c.set(5, y(15), BLUE);
        c.set(6, y(15), RED);
        c.set(5, y(16), t.white[2]);
        c.set(6, y(16), RED);
        c.set(9, y(17), t.accent[0]);
        c.set(10, y(17), BLUE);
      } else {
        c.set(4, y(15), BLUE);
        c.set(4, y(16), RED);
      }
      c.set(3, y(15), RED);
    },
  },
  // Una abeja que acompaña al apicultor, junto a la cabeza.
  "bee-buddy": {
    layer: "head",
    draw({ c, view, y, frame }) {
      const x = view === "front" ? 14 : 0;
      const r = 7 + (frame === 1 ? 1 : 0);
      c.set(x, y(r), YELLOW);
      c.set(x + 1, y(r), BEE_BLACK);
      c.set(x, y(r - 1), WING);
    },
  },
  // Bolsita de semillas colgada del cinturón.
  "seed-pouch": {
    layer: "body",
    draw({ c, view, y }) {
      const x = view === "front" ? 4 : 10;
      const leather = hex("#8a5a2b");
      c.rect(x, y(20), 2, 2, leather);
      c.rect(x, y(20), 2, 1, hex("#5a331d"));
      c.set(x + 1, y(21), hex("#5ea247"));
    },
  },
  // Manchas de pintura en el delantal y las mangas.
  "paint-spots": {
    layer: "body",
    draw({ c, view, y }) {
      const spots: [number, number][] = view === "front" ? [[6, 15], [9, 17], [7, 20], [8, 22]] : [[5, 16], [10, 18]];
      spots.forEach(([x, r], i) => c.set(x, y(r), PAINT[i % PAINT.length]!));
      c.set(3, y(17), PAINT[2]!);
    },
  },
  // Escudo del superhéroe en el pecho: borde dorado y el centro del color de acento.
  emblem: {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view !== "front") return;
      const [g0, g1, g2] = t.gold;
      c.rect(6, y(15), 4, 1, g2);
      c.set(6, y(16), g1);
      c.rect(7, y(16), 2, 1, t.accent[1]);
      c.set(9, y(16), g0);
      c.rect(7, y(17), 2, 1, g1);
      c.set(8, y(16), t.accent[2]);
    },
  },
  // Estrellas doradas bordadas en la túnica.
  stars: {
    layer: "body",
    draw({ c, t, view, y }) {
      const pts: [number, number][] = view === "front" ? [[5, 16], [10, 19], [6, 22], [9, 14]] : [[6, 15], [9, 18], [7, 21]];
      for (const [x, r] of pts) {
        c.set(x, y(r), t.gold[2]);
        c.set(x, y(r - 1), t.gold[0]);
      }
    },
  },
  // Colmillos del vampiro: la boca oscura y un colmillo blanco a cada lado.
  fangs: {
    layer: "head",
    draw({ c, view, y }) {
      if (view !== "front") return;
      c.set(9, y(10), LIPS);
      c.set(8, y(10), FANG);
      c.set(10, y(10), FANG);
    },
  },
  // Cara de ahuyama tallada en la barriga del disfraz de calabaza; de espaldas, los gajos.
  "pumpkin-face": {
    layer: "body",
    draw({ c, t, view, y }) {
      if (view !== "front") {
        for (const x of [6, 9]) for (let r = 14; r <= 19; r++) c.set(x, y(r), t.pants[0]);
        return;
      }
      for (const [x, r] of [[6, 15], [5, 16], [6, 16], [7, 16], [9, 15], [8, 16], [9, 16], [10, 16]] as const) c.set(x, y(r), CARVED);
      for (const x of [5, 6, 8, 9, 10]) c.set(x, y(18), CARVED);
      for (const x of [6, 7, 8, 9]) c.set(x, y(19), CARVED);
    },
  },
  // Huesos pintados sobre el mono negro: la columna, las costillas, la pelvis y los huesos de los brazos.
  bones: {
    layer: "body",
    draw(ctx) {
      const { c, view, y } = ctx;
      const spine = view === "front" ? 8 : 7;
      for (let r = 14; r <= 19; r++) c.set(spine, y(r), BONE_DARK);
      if (view === "front") {
        for (const r of [14, 16, 18]) for (let x = 5; x <= 10; x++) if (x !== spine) c.set(x, y(r), r === 18 && (x === 5 || x === 10) ? BONE_DARK : BONE);
      } else for (const [x, r] of [[5, 15], [6, 15], [9, 15], [10, 15], [5, 16], [10, 16]] as const) c.set(x, y(r), BONE);
      for (let x = 6; x <= 10; x++) c.set(x, y(20), x === 6 || x === 10 ? BONE_DARK : BONE);
      const [back, front] = armLen(ctx);
      for (let r = 15; r <= 17; r++) {
        if (back >= r - 13) c.set(3, y(r), BONE_DARK);
        if (front >= r - 13) c.set(12, y(r), BONE);
      }
    },
  },
  // Papel picado de fiesta sobre la ropa.
  confetti: {
    layer: "body",
    draw({ c, view, y }) {
      const pts: [number, number][] = view === "front" ? [[4, 14], [10, 16], [6, 19], [9, 13], [5, 22]] : [[5, 15], [9, 17], [7, 19]];
      pts.forEach(([x, r], i) => c.set(x, y(r), CONFETTI[i % CONFETTI.length]!));
    },
  },
};

/** Pinta los detalles del traje de esa capa. */
export function drawCostumeDetails(ctx: Ctx, layer: Layer) {
  for (const d of ctx.look.details) if (DETAILS[d].layer === layer) DETAILS[d].draw(ctx);
}
