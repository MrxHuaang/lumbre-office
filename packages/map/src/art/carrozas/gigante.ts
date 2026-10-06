// La figura monumental de las carrozas (VIR-173): un cuerpo de papel maché (falda o torso, hombros,
// cuello) y la cabeza con la cara pintada (calcomanía) y su parpadeo, en vista 3/4. Cada carroza le pone
// encima lo suyo (brazos, tocados, lo que lleva en las manos).
import type { Ramp, RGBA } from "../pixel";
import { en, liso, mirando, type Escultor, type Marco, type Tinte, type V3 } from "./escultura";
import { ceja, LINEA, mejilla, ojo, parpado, sonrisa } from "./figuras";
import type { Movimiento } from "./partes";
import { calco, conCara, soloCalco } from "./piezas";
import { Pintura, rampa, tono } from "./pintura";

export interface GiganteOpts {
  /** Dónde se para (en la cubierta) y hacia dónde mira (ángulo; 1 = 3/4 hacia la vereda de la cámara). */
  base: V3;
  mira?: number;
  /** Escala (1 = la cabeza de radio 20, unos 125 de alto). */
  s?: number;
  piel: Ramp;
  /** La piel por zonas (pintura de fantasía): por la coordenada local de la cara. */
  pielPatron?: (l: V3) => Ramp;
  pelo?: Ramp;
  peinado?: "moño" | "largo" | "corto" | "calvo";
  /** Tinte del cuerpo (vestido, ruana, túnica). */
  ropa: Tinte;
  /** La falda ancha (vestido, anaco) o un torso que sale de la cubierta. */
  falda?: boolean;
  iris?: Ramp;
  sombraOjos?: Ramp;
  labios?: Ramp;
  mejillas?: RGBA;
  cejas?: RGBA;
  /** Lo que se pinta además en la cara (gafas, bigote, pintura, antifaz). */
  pinta?: (p: Pintura, cx: number, cy: number) => void;
  /** Ojos dormidos (cerrados pintados). */
  dormida?: boolean;
  /** Movimiento de la cabeza y del cuerpo. */
  movCabeza?: Movimiento;
  movCuerpo?: Movimiento;
  /** Prefijo de las partes (para dos gigantes en una carroza). */
  id?: string;
  /** Sin nariz de bulto. */
  sinNariz?: boolean;
}

export interface Gigante {
  M: Marco;
  /** Centro de la cabeza, el cuello, el pecho y los hombros (para los brazos y los tocados). */
  H: V3;
  cuello: V3;
  pecho: V3;
  hombro: (lado: -1 | 1) => V3;
  /** Radios de la cabeza. */
  ra: number;
  rb: number;
  rf: number;
  s: number;
  id: (n: string) => string;
}

export function gigante(e: Escultor, o: GiganteOpts): Gigante {
  const s = o.s ?? 1;
  const S = (v: number) => v * s;
  const M = mirando(o.mira ?? 1.0);
  const B = o.base;
  const id = (n: string) => (o.id ? `${o.id}-${n}` : n);
  const ra = S(20);
  const rb = S(24);
  const rf = S(19);
  const H = en(B, M, 0, S(98), S(2));
  const cuello = en(B, M, 0, S(76), 0);
  const pecho = en(B, M, 0, S(50), 0);

  e.parte(id("cuerpo"), B, { mov: o.movCuerpo ?? { gira: { amp: 0.012, periodo: 6200 } } });
  if (o.falda !== false) e.elipsoide(en(B, M, 0, S(20), 0), S(31), S(26), S(22), M, o.ropa, (l) => l[1] > -0.76);
  else e.elipsoide(en(B, M, 0, S(22), 0), S(24), S(24), S(16), M, o.ropa, (l) => l[1] > -0.9);
  e.elipsoide(pecho, S(25), S(18), S(16), M, o.ropa);
  e.capsula(en(B, M, -S(23), S(58), -S(3)), en(B, M, S(23), S(58), -S(3)), S(9.5), S(9.5), o.ropa);
  e.capsula(en(B, M, 0, S(60), 0), en(B, M, 0, S(82), S(1)), S(7.5), S(7), liso(o.piel, 0, 0.5));

  const ojos = { dx: S(8.5), dy: -S(1), w: S(14), hu: S(5.6), hl: S(3.8) };
  const cara = calco(ra, rb, (p, cx, cy) => {
    for (const l of [-1, 1] as const) {
      if (o.mejillas) mejilla(p, cx + l * S(12), cy + S(7), S(4), S(2.6), o.mejillas);
      ceja(p, cx + l * (ojos.dx + 0.5), cy + ojos.dy - ojos.hu - S(3.5), ojos.w, l, o.cejas ?? LINEA, Math.max(1.3, S(1.6)));
      if (o.dormida) parpado(p, cx + l * ojos.dx, cy + ojos.dy, ojos.w, ojos.hu, ojos.hl, l, o.piel, o.sombraOjos);
      else ojo(p, cx + l * ojos.dx, cy + ojos.dy, ojos.w, ojos.hu, ojos.hl, l, { iris: o.iris ?? rampa("#6a3a1a"), ...(o.sombraOjos ? { sombra: o.sombraOjos } : {}), mira: 0.5 });
    }
    sonrisa(p, cx, cy + S(12), S(17), S(6.5), o.labios);
    o.pinta?.(p, cx, cy);
  });

  e.parte(id("cabeza"), cuello, { padre: id("cuerpo"), mov: o.movCabeza ?? { gira: { amp: 0.05, periodo: 4700, fase: 0.2 } } });
  const pelo = o.pelo ?? rampa("#2a2236");
  const peinado = o.peinado ?? "corto";
  if (peinado !== "calvo") e.elipsoide(en(H, M, 0, S(3), -S(9)), S(21.5), S(25.5), S(18), M, liso(pelo, 0, 0.8));
  if (peinado === "moño") e.elipsoide(en(H, M, 0, S(24), -S(8)), S(11), S(9), S(10), M, liso(pelo, 0.3, 0.8));
  if (peinado === "largo")
    for (const l of [-1, 1]) e.capsula(en(H, M, l * S(18), -S(4), -S(6)), en(H, M, l * S(21), -S(40), -S(6)), S(7), S(5), liso(pelo, 0, 0.8));
  for (const l of [-1, 1]) e.elipsoide(en(H, M, l * S(19.5), 0, -S(2)), S(2.5), S(5), S(4), M, liso(o.piel));
  const piel = (q: { l: V3 }) => ({ r: o.pielPatron ? o.pielPatron(q.l) : o.piel, brillo: 0.6 });
  e.elipsoide(H, ra, rb, rf, M, conCara(piel, cara));
  if (!o.sinNariz) e.elipsoide(en(H, M, 0, -S(3), S(18.2)), S(2.4), S(4.4), S(3), M, liso(o.piel, 0.6, 0.8));

  if (!o.dormida) {
    const lids = calco(ra + 0.6, rb + 0.6, (p, cx, cy) => {
      for (const l of [-1, 1] as const) parpado(p, cx + l * ojos.dx, cy + ojos.dy, ojos.w, ojos.hu, ojos.hl, l, o.piel, o.sombraOjos);
    });
    e.parte(id("parpados"), cuello, { padre: id("cabeza"), contorno: false, mov: { parpadeo: { cada: 3900 + (o.id?.length ?? 0) * 300, dura: 170, fase: 0.3 } } });
    e.elipsoide(H, ra + 0.6, rb + 0.6, rf + 0.6, M, soloCalco(lids));
  }
  return { M, H, cuello, pecho, hombro: (l) => en(B, M, l * S(25), S(58), -S(2)), ra, rb, rf, s, id };
}

/** Un brazo (manga y mano) del hombro al codo y a la muñeca. */
export function brazo(e: Escultor, hombro: V3, codo: V3, muneca: V3, s: number, manga: Tinte, piel: Ramp) {
  e.capsula(hombro, codo, 7.5 * s, 6.5 * s, manga);
  e.capsula(codo, muneca, 6.5 * s, 5.5 * s, manga);
  e.esfera(muneca, 6.2 * s, liso(piel, 0.2, 0.5));
}

export { tono };
