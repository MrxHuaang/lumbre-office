// Los instrumentos de las murgas del desfile (VIR-173), en pixel art pintado: el bombo, la trompeta, el
// acordeón, el redoblante y la tuba. El ancla (ox, oy) va donde el músico los agarra (a la altura de las
// manos del chibi).
import type { Instrumento } from "@hyvento/shared";
import type { Sprite } from "../pixel";
import { capsula, circulo, elipse, Pintura, poligono, rampa, tono, union } from "./pintura";

const ORO = rampa("#e6aa2a");
const ROJO = rampa("#d8283a");
const AZUL = rampa("#2a52d0");
const CUERO = rampa("#f2e2c0");
const MADERA = rampa("#8a5a32");
const NEGRO = rampa("#3a2a40");

const op = { planos: true, borde: "oscuro" as const };

export function instrumentoSprite(i: Instrumento): Sprite {
  const p = new Pintura(26, 26);
  switch (i) {
    case "bombo":
      // El tambor grande de lado: el aro rojo, el cuero y la maza.
      p.volumen(elipse(13, 15, 9, 8), ROJO, { alto: 5, ...op, patron: (q) => (Math.abs(q.x - 13 + (q.y - 15) * 0.3) % 6 < 1.4 ? ORO : ROJO) });
      p.volumen(elipse(10, 15, 5, 7.4), CUERO, { alto: 3, ...op });
      p.volumen(capsula(19, 6, 23, 3, 0.9), MADERA, { alto: 1, ...op });
      p.volumen(circulo(23.5, 2.6, 1.8), CUERO, { alto: 1, ...op });
      return { canvas: p.c, ox: 13, oy: 9 };
    case "trompeta":
      p.volumen(capsula(5, 12, 17, 10, 1.2), ORO, { alto: 1, brillo: 1, ...op });
      p.volumen(capsula(8, 14, 16, 13, 1.1), ORO, { alto: 1, brillo: 1, ...op });
      p.volumen(poligono([[16, 9], [23, 5], [24, 16], [16, 13]]), ORO, { alto: 2, brillo: 1, ...op });
      p.plano(elipse(23.4, 10.5, 1.2, 5), tono(ORO, 0));
      for (const x of [10, 12, 14]) p.volumen(capsula(x, 8, x, 10, 0.7), ORO, { alto: 1, ...op });
      return { canvas: p.c, ox: 11, oy: 12 };
    case "acordeon":
      // Los dos tableros y el fuelle de pliegues de colores.
      p.volumen(poligono([[8, 6], [18, 6], [19, 20], [7, 20]]), ROJO, { alto: 4, ...op, patron: (q) => (Math.floor(q.x) % 2 ? ROJO : rampa("#f2c21c")) });
      p.volumen(union(elipse(5, 13, 3, 7.5)), AZUL, { alto: 2, ...op });
      p.volumen(elipse(21, 13, 3, 7.5), AZUL, { alto: 2, ...op });
      for (const y of [9, 12, 15]) p.plano(circulo(21, y, 0.9), tono(CUERO, 5));
      return { canvas: p.c, ox: 13, oy: 13 };
    case "redoblante":
      p.volumen(elipse(13, 16, 8, 5), AZUL, { alto: 3, ...op, patron: (q) => (q.y > 16 && Math.floor(q.x / 3) % 2 ? ORO : AZUL) });
      p.volumen(elipse(13, 13.5, 8, 3), CUERO, { alto: 2, ...op });
      p.volumen(capsula(8, 6, 11, 12, 0.7), MADERA, { alto: 1, ...op });
      p.volumen(capsula(18, 6, 15, 12, 0.7), MADERA, { alto: 1, ...op });
      return { canvas: p.c, ox: 13, oy: 10 };
    case "tuba":
      p.volumen(union(elipse(12, 15, 6, 7), capsula(12, 8, 8, 4, 2.4)), ORO, { alto: 3, brillo: 1, ...op });
      p.volumen(elipse(7, 4, 6, 3.4, -0.3), ORO, { alto: 2, brillo: 1, ...op });
      p.plano(elipse(7, 4, 4, 2, -0.3), tono(NEGRO, 2));
      return { canvas: p.c, ox: 12, oy: 12 };
  }
}
