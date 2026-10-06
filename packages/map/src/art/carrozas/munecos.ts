// Los muñecos chicos de las carrozas (las figuras que acompañan a la monumental) y la cosecha: guaguas,
// cuyes, mazorcas de colores, papas y quinua. Pintados de frente, como las figuras grandes.
import { type Ramp } from "../pixel";
import { BRILLO, LINEA, mejilla } from "./figuras";
import { capsula, circulo, caja, elipse, Pintura, poligono, rampa, tono } from "./pintura";

export interface FiguritaOpts {
  piel: Ramp;
  ropa: Ramp;
  sombrero?: Ramp;
  /** Con una mazorca en la mano levantada. */
  mazorca?: boolean;
  /** Lo que lleva en la mano levantada (si no es mazorca). */
  lleva?: (p: Pintura, x: number, y: number) => void;
  pelo?: Ramp;
  /** Falda en vez de pantalón. */
  falda?: boolean;
}

/** Un muñeco chico de papel maché (unos 52 px a escala 1), parado con los pies en (cx, by). */
export function figurita(p: Pintura, cx: number, by: number, s: number, o: FiguritaOpts) {
  const S = (v: number) => v * s;
  const oscuro = rampa("#3a2a3e");
  // Las piernas o la falda.
  if (o.falda) p.volumen(poligono([[cx - S(5), by - S(22)], [cx + S(5), by - S(22)], [cx + S(10), by - S(2)], [cx - S(10), by - S(2)]]), o.ropa, { alto: S(4), base: -0.5 });
  else for (const d of [-1, 1]) p.volumen(capsula(cx + d * S(3.5), by - S(16), cx + d * S(4), by - S(2), S(2.6)), oscuro, { alto: S(2) });
  // Los brazos: uno levantado (bailando) y el otro en jarra.
  p.volumen(capsula(cx + S(8), by - S(30), cx + S(15), by - S(44), S(2.4)), o.ropa, { alto: S(2), sombra: 0.3 });
  p.volumen(capsula(cx - S(8), by - S(30), cx - S(13), by - S(21), S(2.4)), o.ropa, { alto: S(2) });
  // La ruana: un rombo con rayas.
  p.volumen(poligono([[cx, by - S(36)], [cx + S(13), by - S(22)], [cx, by - S(14)], [cx - S(13), by - S(22)]]), o.ropa, {
    alto: S(5),
    patron: (q) => (Math.floor((q.y - by) / S(3)) % 3 === 0 ? rampa("#f2e6c8") : o.ropa),
  });
  // Las manos.
  p.volumen(circulo(cx + S(15.5), by - S(45), S(2.4)), o.piel, { alto: S(2) });
  p.volumen(circulo(cx - S(13), by - S(20), S(2.2)), o.piel, { alto: S(2) });
  if (o.mazorca) mazorca(p, cx + S(17), by - S(46), S(9), rampa("#f2c22a"), -0.3);
  o.lleva?.(p, cx + S(16), by - S(47));
  // La cabeza.
  const hy = by - S(42);
  if (o.pelo) p.volumen(elipse(cx, hy - S(1), S(10), S(9)), o.pelo, { alto: S(4) });
  p.volumen(circulo(cx, hy, S(8.5)), o.piel, { alto: S(5), brillo: 0.6 });
  for (const d of [-1, 1]) {
    p.plano(elipse(cx + d * S(3.2), hy, S(1.2), S(1.7)), LINEA);
    p.punto(Math.round(cx + d * S(3.2) - 0.5), Math.round(hy - S(0.8)), BRILLO);
    mejilla(p, cx + d * S(5), hy + S(3), S(2), S(1.2), tono(rampa("#ef6ba0"), 3));
  }
  p.curva(cx - S(2.5), hy + S(3.5), cx, hy + S(6), cx + S(2.5), hy + S(3.5), LINEA, 1);
  if (o.sombrero) {
    p.volumen(elipse(cx, hy - S(6), S(13), S(3)), o.sombrero, { alto: S(2), sombra: 0.3 });
    p.volumen(caja(cx - S(6), hy - S(13), cx + S(6), hy - S(5), S(2)), o.sombrero, { alto: S(3) });
    p.plano(caja(cx - S(6), hy - S(8), cx + S(6), hy - S(6.5)), tono(rampa("#e0283c"), 3));
  }
}

/** Una mazorca de maíz (de colores, con las hojas abiertas abajo), de largo `l`, inclinada `ang`. */
export function mazorca(p: Pintura, x: number, y: number, l: number, granos: Ramp, ang = 0) {
  const ux = Math.sin(ang);
  const uy = -Math.cos(ang);
  const tip = { x: x + ux * l, y: y + uy * l };
  // Las hojas (amero) abiertas en la base.
  for (const d of [-1, 1]) p.volumen(capsula(x, y, x + ux * l * 0.55 + d * l * 0.28, y + uy * l * 0.55, l * 0.08, l * 0.16), rampa("#d8c27a"), { alto: 1.5 });
  p.volumen(capsula(x + ux * l * 0.15, y + uy * l * 0.15, tip.x, tip.y, l * 0.2, l * 0.12), granos, {
    alto: l * 0.12,
    brillo: 0.5,
    pinta: (q, c) => ((q.x + q.y) % 2 === 0 ? c : tono(granos, 2)),
  });
}

/** Una papa (morada o amarilla), redondita con sus ojitos. */
export function papa(p: Pintura, x: number, y: number, r: number, color: Ramp) {
  p.volumen(elipse(x, y - r * 0.6, r * 1.2, r * 0.85, 0.3), color, { alto: r * 0.6, brillo: 0.3, sombra: 0.3 });
  p.punto(Math.round(x - r * 0.3), Math.round(y - r * 0.8), tono(color, 1));
  p.punto(Math.round(x + r * 0.4), Math.round(y - r * 0.4), tono(color, 1));
}

/** Una mata de quinua: tallos y las panojas de color. */
export function quinua(p: Pintura, x: number, y: number, h: number, color: Ramp) {
  const tallo = rampa("#5a8a3a");
  for (const d of [-1, 0, 1]) {
    const tx = x + d * h * 0.25;
    const ty = y - h * (0.75 + (d === 0 ? 0.2 : 0));
    p.volumen(capsula(x + d * 1.5, y, tx, ty, 1, 0.8), tallo, { alto: 1, borde: false });
    for (let k = 0; k < 4; k++) p.volumen(circulo(tx + ((k % 2) - 0.5) * 2.4, ty + k * 2.6, 2.4 - k * 0.3), color, { alto: 1.5, brillo: 0.3, sombra: 0.2 });
  }
  for (const d of [-1, 1]) p.volumen(elipse(x + d * 4, y - h * 0.3, 4, 1.6, d * 0.5), tallo, { alto: 1 });
}

/** Un cuy de papel maché (sentado, de frente), con los pies en (x, y). */
export function cuy(p: Pintura, x: number, y: number, s: number, pelaje: Ramp, manchas?: Ramp) {
  p.volumen(elipse(x, y - s * 5, s * 8, s * 5.5), pelaje, {
    alto: s * 3,
    brillo: 0.4,
    patron: manchas ? (q) => ((Math.floor((q.x - x) / (s * 4)) + 8) % 2 && q.y < y - s * 5 ? manchas : pelaje) : undefined,
  });
  p.volumen(elipse(x + s * 5, y - s * 9, s * 4.6, s * 4), pelaje, { alto: s * 2.5, brillo: 0.5, sombra: 0.3 });
  p.volumen(circulo(x + s * 2.6, y - s * 12.4, s * 1.6), rampa("#e89aa0"), { alto: s });
  p.plano(circulo(x + s * 6.3, y - s * 9.6, s * 1.1), LINEA);
  p.punto(Math.round(x + s * 6), Math.round(y - s * 10.2), BRILLO);
  p.plano(circulo(x + s * 9.2, y - s * 8.4, s * 0.9), rampa("#e06a7a")[2]!);
  for (const d of [-1, 1]) p.volumen(elipse(x + d * s * 3.5, y - s * 0.6, s * 1.8, s * 1), rampa("#e89aa0"), { alto: 1 });
}
