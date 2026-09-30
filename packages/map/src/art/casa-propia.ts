// Lo de adentro de la casa de cada persona (docs/plan-casas.md): la cama sencilla del cuarto, con la
// cabecera de tablas, la almohada y la cobija de retazos. Coordenadas locales de arte (tile = 16), mirando
// hacia +x (la cabecera en -x, contra la pared). Las fachadas de la calle están en
// art/casa-propia-exterior.ts (se registran en outdoor.ts porque tienen versión de noche).
import { Escena, type Tinte } from "./exterior-escena";
import type { Variant } from "./kit";
import { C } from "./palette";
import { at, noise, type RGBA, type Sprite } from "./pixel";

const T = (c: RGBA): Tinte => () => c;

/** Retazos de la cobija: los colores de siempre de la cabaña, gastados. */
const RETAZOS = [C.rose, C.sage, C.mustard, C.blue, C.cream];

/** Cobija de retazos cuadrados de 4, con la costura oscura y una puntada clara al medio de cada uno. */
function cobija(u: number, v: number, luz: number): RGBA {
  const cu = Math.floor(u / 4);
  const cv = Math.floor(v / 4);
  if (u % 4 < 0.5 || v % 4 < 0.5) return at(C.woodDark, 3 + luz);
  const r = RETAZOS[Math.floor(noise(cu, cv, 17) * RETAZOS.length)]!;
  if (Math.abs((u % 4) - 2) < 0.4 && Math.abs((v % 4) - 2) < 0.4) return at(C.cream, 5);
  return at(r, 3 + luz);
}

/** Tablas de la cabecera y de las patas (madera de la casa, con la veta). */
const madera = (luz: number): Tinte => (u, v) => at(C.wood, (Math.floor(u / 3) % 2 ? 3 : 2) + luz + (v > 13 ? 1 : 0));

function cama(): Sprite {
  const s = new Escena({ x0: -4, y0: -4, z0: -2, x1: 36, y1: 20, z1: 28 }, 2);
  s.shadow(1, 1, 31, 15, 0.3);
  // Las cuatro patas y el marco.
  for (const [x, y] of [
    [2, 1.5],
    [2, 13],
    [29.5, 1.5],
    [29.5, 13],
  ] as const)
    s.solid(x, y, 0, 1.5, 1.5, 4, at(C.woodDark, 3), at(C.woodDark, 2), at(C.woodDark, 1));
  s.box(2, 1.5, 4, 29, 13, 2.5, T(at(C.wood, 3)), madera(-1), madera(-1));
  // El colchón con la sábana crema que asoma por la cabecera.
  s.box(3, 2, 6.5, 27.5, 12, 3.5, T(at(C.cream, 5)), T(at(C.cream, 3)), T(at(C.cream, 2)));
  // La almohada, contra la cabecera.
  s.box(4, 3.5, 10, 6, 9, 2.5, (u) => at(C.white, u > 4.5 ? 3 : 4), T(at(C.cream, 3)), T(at(C.cream, 2)));
  // La cobija de retazos: tapa del medio hasta los pies y cuelga un poco por el lado de adelante y el pie.
  s.box(11, 1.5, 10, 20, 13, 0.8, (u, v) => cobija(u, v, 1), (u, v) => cobija(u, v + 13, 0), (u, v) => cobija(u + 20, v, -1));
  s.quad([11, 14.5, 4.5], [1, 0, 0], [0, 0, 1], 20, 5.5, (u, v) => cobija(u, v, 0));
  s.quad([31, 1.5, 5], [0, 1, 0], [0, 0, 1], 13, 5, (u, v) => cobija(u, v, -1));
  // La cabecera de tablas con dos postes redondeados arriba.
  s.box(0.5, 1, 4, 2, 14, 18, T(at(C.wood, 4)), madera(0), madera(-1));
  for (const y of [1, 13]) s.solid(0.3, y - 0.2, 22, 2.4, 2.4, 2, at(C.woodDark, 4), at(C.woodDark, 3), at(C.woodDark, 2));
  return s.sprite();
}

export const CASA_PROPIA_DRAW: Record<string, (v: Variant) => Sprite> = {
  "casa-cama": cama,
};
