// El Galeras que fuma: el volcán de Pasto con rostro (ojos que parpadean y la sonrisa), las faldas como
// una colcha de retazos de cultivos (verdes, amarillos y ocres separados por cercos), la nieve y el cráter
// encendido, el humo de colores que sale en volutas y los cuyes de papel maché que se asoman.
import { liso, mirando, type Tinte, Escultor, type V3 } from "./escultura";
import { LINEA, ojo, parpado, ceja, sonrisa, mejilla } from "./figuras";
import type { CarrozaArte } from "./partes";
import { ANCHO, calco, camion, marcoDe } from "./piezas";
import { leerCalco } from "./escultura";
import { zigzag } from "./plataforma";
import { rampa, tono } from "./pintura";

const LARGO = 104;
const RETAZOS = ["#3f9a3a", "#7cbf3a", "#e8c43a", "#c9883a", "#2f7a4a", "#a8c84a"].map(rampa);
const CERCO = rampa("#24502a");
const NIEVE = rampa("#f4f2f8");
const FUEGO = rampa("#f2711c");
const HUMO = ["#f28ab8", "#5fd6d0", "#f7d84a", "#b48ae8"].map(rampa);
const CUY = rampa("#c98a4a");
const BLANCO = rampa("#f4ece0");

const FRENTE = 1.0;
const ANGULO = 0.8;
/** Lee la cara pintada en el cono: el ángulo alrededor y la altura (k de 0 a 1). */
function caraEnCono(cara: Parameters<typeof leerCalco>[0], a: number, k: number) {
  let da = a - FRENTE;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  if (Math.abs(da) > ANGULO || k < 0.2 || k > 0.84) return null;
  return leerCalco(cara, -da / ANGULO, (k - 0.52) / 0.32);
}

export function galeras(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: zigzag([FUEGO, rampa("#e0283c"), rampa("#f7c518"), rampa("#3f9a3a")]), cubierta: (u, v) => tono(RETAZOS[(Math.floor(u / 8) + Math.floor(v / 8)) % RETAZOS.length]!, 3), flecos: [FUEGO, rampa("#f7c518"), rampa("#3f9a3a")] });
  const B: V3 = [LARGO * 0.5, ANCHO * 0.48, 0];
  const R = 40;
  const ALTO = 74;
  const cara = calco(40, 40, (p, cx, cy) => {
    for (const l of [-1, 1] as const) {
      mejilla(p, cx + l * 17, cy + 6, 6, 3.6, tono(rampa("#ef6ba0"), 3));
      ojo(p, cx + l * 11, cy - 4, 15, 6.2, 4.2, l, { iris: rampa("#6a3a1a"), mira: 1 });
      ceja(p, cx + l * 11.5, cy - 15, 15, l, LINEA, 2);
    }
    sonrisa(p, cx, cy + 11, 22, 8);
  });
  const lids = calco(40, 40, (p, cx, cy) => {
    for (const l of [-1, 1] as const) parpado(p, cx + l * 11, cy - 4, 15, 6.2, 4.2, l, RETAZOS[0]!);
  });
  const ladera: Tinte = (q) => {
    const k = q.l[1];
    const c = caraEnCono(cara, q.l[0], k);
    if (c) return { c, brillo: 0.4 };
    if (k > 0.86) return { r: NIEVE, t: Math.sin(q.u * 9) > 0.6 ? -0.5 : 0.4, brillo: 0.5 };
    if (k > 0.8 && Math.sin(q.u * 7) > -0.2) return { r: NIEVE, brillo: 0.4 };
    const ca = q.u * 5;
    const ck = k * 9 + Math.sin(q.u * 3) * 0.5;
    const borde = Math.abs(ca - Math.round(ca)) < 0.06 || Math.abs(ck - Math.round(ck)) < 0.07;
    if (borde) return { r: CERCO, t: 0.2 };
    return { r: RETAZOS[(Math.floor(ca) * 3 + Math.floor(ck) * 5 + 60) % RETAZOS.length]!, t: (Math.floor(q.v * 2) % 2) * 0.3, brillo: 0.3 };
  };
  e.parte("volcan", B, { mov: { vaiven: { dy: -0.6, periodo: 2600 } } });
  e.cono(B[0], B[1], 0, R, ALTO, ladera, 10);
  e.disco(B[0], B[1], ALTO, 10, (q) => ({ r: FUEGO, t: Math.hypot(q.l[0], q.l[1]) < 0.6 ? 2 : 0, brillo: 0.2 }));
  e.parte("parpados", B, { padre: "volcan", contorno: false, mov: { parpadeo: { cada: 4600, dura: 200 } } });
  e.cono(B[0], B[1], 0, R + 0.7, ALTO, (q) => {
    const c = caraEnCono(lids, q.l[0], q.l[1]);
    return c ? { c } : null;
  }, 10.7);
  // El humo de colores: volutas que suben del cráter, cada una con su color.
  HUMO.forEach((r, k) => {
    const v: V3 = [B[0], B[1], ALTO + 6];
    e.parte(`humo-${k}`, v, { contorno: true, mov: { sube: { dx: 8 + k * 3, dy: -60, periodo: 3600, fase: k / HUMO.length, crece: 1.2 } } });
    e.esfera(v, 6, liso(r, 0.6, 0.2));
    e.esfera([v[0] + 3, v[1] - 2, v[2] + 4], 4.5, liso(r, 1, 0.2));
    e.esfera([v[0] - 3, v[1] + 1, v[2] + 3], 4, liso(r, 0.8, 0.2));
  });
  // Los cuyes que se asoman en la falda.
  const cuy = (id: string, b: V3, ang: number, fase: number, manchas: boolean) => {
    const m = mirando(ang);
    e.parte(id, b, { mov: { vaiven: { dy: -1.8, periodo: 900, fase } } });
    e.elipsoide([b[0], b[1], b[2] + 5], 7, 5, 9, m, (q) => ({ r: manchas && q.l[0] * q.l[2] > 0.1 ? BLANCO : CUY, brillo: 0.3 }));
    const h: V3 = [b[0] + Math.cos(ang) * 7, b[1] + Math.sin(ang) * 7, b[2] + 9];
    e.elipsoide(h, 4.5, 4.4, 5, m, (q) => (q.l[2] > 0.5 && Math.abs(q.l[0]) > 0.35 && Math.abs(q.l[0]) < 0.6 && q.l[1] > 0 && q.l[1] < 0.35 ? { c: LINEA } : { r: manchas ? BLANCO : CUY, brillo: 0.4 }));
    for (const l of [-1, 1]) e.esfera([h[0] + Math.cos(ang + l * 1.4) * 3.6, h[1] + Math.sin(ang + l * 1.4) * 3.6, h[2] + 3.4], 1.8, liso(rampa("#e89aa0")));
    e.esfera([h[0] + Math.cos(ang) * 4.8, h[1] + Math.sin(ang) * 4.8, h[2] - 0.6], 1.2, liso(rampa("#e06a7a")));
  };
  cuy("cuy-1", [10, ANCHO - 7, 0], 1.3, 0, false);
  cuy("cuy-2", [LARGO - 12, ANCHO - 8, 0], 0.6, 0.4, true);
  cuy("cuy-3", [LARGO - 30, ANCHO - 3, 0], 1.6, 0.7, false);
  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
