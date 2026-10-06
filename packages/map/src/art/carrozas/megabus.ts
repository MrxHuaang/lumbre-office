// El Megabús de la alegría, que cierra el desfile: el bus de la parada vuelto una figura de fiesta, verde
// lima con flores y franjas de colores pintadas, con ojos grandes en el parabrisas que parpadean y una
// sonrisa en el bómper; encima, muñecos que bailan, banderas que ondean y un rehilete que da vueltas.
import { en, liso, mirando, Escultor, type V3 } from "./escultura";
import { ojo, parpado, sonrisa } from "./figuras";
import type { CarrozaArte } from "./partes";
import { ANCHO, ARCOIRIS, calco, ciclo, marcoDe, muneco3d, ORO, Z } from "./piezas";
import { leerCalco } from "./escultura";
import { rampa, tono } from "./pintura";

const LARGO = 132;
const LIMA = rampa("#a6d23a");
const VIDRIO = rampa("#1c2a3a");
const LLANTA = rampa("#2c2634");
const ALTO = 34;
const ANCHO_BUS = ANCHO - 4;

export function megabus(): CarrozaArte {
  const e = new Escultor();
  e.parte("plataforma", [0, 0, 0]);
  const cara = calco(ANCHO_BUS / 2, 16, (p, cx, cy) => {
    for (const l of [-1, 1] as const) ojo(p, cx + l * 8.5, cy - 4, 13, 6, 4.4, l, { iris: rampa("#2a5ac8"), mira: 1 });
  });
  const lids = calco(ANCHO_BUS / 2, 16, (p, cx, cy) => {
    for (const l of [-1, 1] as const) parpado(p, cx + l * 8.5, cy - 4, 13, 6, 4.4, l, LIMA);
  });
  const boca = calco(ANCHO_BUS / 2, 8, (p, cx, cy) => sonrisa(p, cx, cy - 1, 20, 6));
  // Las ruedas.
  for (const x of [18, 36, LARGO - 24])
    e.rueda(x, ANCHO - 4, Z.piso + 7, 7, 3, (q) => (q.l[2] === 1 && Math.hypot(q.l[0], q.l[1]) < 0.4 ? { r: ORO, t: 0.5, brillo: 0.9 } : { r: LLANTA }));
  const z0 = Z.piso + 4;
  const h = ALTO - z0;
  // El costado: franjas de colores abajo, las ventanas y las flores pintadas.
  e.caja(0, 2, z0, LARGO, ANCHO_BUS, h, (q) => ({ r: (Math.floor(q.u / 10) + Math.floor(q.v / 10)) % 2 ? LIMA : rampa("#f2c21c"), t: 0.4, brillo: 0.6 }), (q) => {
    const z = q.v + z0;
    if ([18, 36, LARGO - 24].some((x) => Math.hypot(q.u - x, z - (Z.piso + 7)) < 8.5)) return null;
    if (z < 2) return { r: ciclo(ARCOIRIS, Math.floor((q.u + z * 2) / 6)), brillo: 0.6 };
    if (z > 12 && z < 26) {
      const k = ((q.u % 22) + 22) % 22;
      if (k < 2.5) return { r: LIMA, t: -0.5 };
      return { r: VIDRIO, t: Math.abs(((q.u + z) % 26) - 13) < 1.2 ? 3 : 0, brillo: 0.95 };
    }
    const fu = ((q.u % 14) + 14) % 14 - 7;
    const fz = z > 26 ? z - 30 : z - 7;
    const d = Math.hypot(fu, fz * 1.4);
    const ang = Math.atan2(fz, fu);
    if (d < 1.4) return { r: rampa("#f2c21c"), t: 1 };
    if (d < 3.6 + Math.cos(ang * 5)) return { r: ciclo([rampa("#e0283c"), rampa("#c8287a"), rampa("#2f6fd6")], Math.floor(q.u / 14)), t: 0.5, brillo: 0.6 };
    return { r: LIMA, brillo: 0.6 };
  }, (q) => {
    // El frente: el parabrisas con los ojos y el bómper con la sonrisa.
    const z = q.v + z0;
    if (z > 10 && z < 30 && q.u > 2 && q.u < ANCHO_BUS - 2) {
      const c = leerCalco(cara, (q.u - ANCHO_BUS / 2) / (ANCHO_BUS / 2), (z - 20) / 16);
      if (c) return { c, brillo: 0.5 };
      return { r: VIDRIO, t: 1, brillo: 0.95 };
    }
    if (z < 6) {
      const c = leerCalco(boca, (q.u - ANCHO_BUS / 2) / (ANCHO_BUS / 2), (z - 1) / 8);
      if (c) return { c };
      if (z < 2 && (q.u < 7 || q.u > ANCHO_BUS - 7)) return { r: rampa("#fff2b0"), t: 1, brillo: 1 };
    }
    return { r: LIMA, t: -0.2, brillo: 0.6 };
  });
  e.sombraSuelo(-3, 1, LARGO + 6, ANCHO + 4, Z.piso, 0.34);
  e.parte("parpados", [LARGO, ANCHO / 2, 20], { contorno: false, mov: { parpadeo: { cada: 3300, dura: 190 } } });
  e.lamina([LARGO + 0.4, 2, 10], [0, 1, 0], [0, 0, 1], ANCHO_BUS, 20, (q) => {
    const c = leerCalco(lids, (q.u - ANCHO_BUS / 2) / (ANCHO_BUS / 2), (q.v + 10 - 20) / 16);
    return c ? { c } : null;
  });

  // Los muñecos que bailan en el techo.
  const cols = ["#e0283c", "#2f6fd6", "#c8287a"];
  [28, 64, 100].forEach((x, k) => {
    const b: V3 = [x, ANCHO / 2, ALTO];
    e.parte(`muneco-${k}`, b, { mov: { vaiven: { dy: -2, periodo: 600 + k * 70, fase: k * 0.3 }, gira: { amp: 0.1, periodo: 1200, fase: k * 0.3 } } });
    muneco3d(e, b, 1, { piel: rampa(["#c98a5a", "#e8b088", "#8a5a3a"][k]!), ropa: rampa(cols[k]!), sombrero: rampa("#f2c21c"), pelo: rampa("#2a2236"), mira: 1.1 });
  });
  // Las banderas de colores que ondean y el rehilete.
  [8, LARGO - 6].forEach((x, k) => {
    const b: V3 = [x, 6, ALTO];
    e.parte(`bandera-${k}`, b, { mov: { escala: { sx: 0.12, periodo: 800, fase: k * 0.5 }, gira: { amp: 0.05, periodo: 1600 } } });
    e.capsula(b, [x, 6, ALTO + 36], 1, 1, liso(rampa("#7a4a2a")));
    e.lamina([x + 1, 6, ALTO + 22], [1, 0, 0], [0, 0, 1], 20, 13, (q) => ({ r: ciclo(ARCOIRIS, Math.floor(q.v / 1.9)), brillo: 0.4 }), (u, v) => Math.abs(Math.sin(u * 0.4)) * 1.2 + v < 13);
  });
  const rh: V3 = [LARGO - 18, ANCHO - 6, ALTO + 26];
  e.parte("rehilete-palo", rh);
  e.capsula([rh[0], rh[1], ALTO], rh, 0.9, 0.9, liso(rampa("#7a4a2a")));
  e.parte("rehilete", rh, { mov: { rueda: { periodo: 1400, sentido: -1 } } });
  const m = mirando(1.0);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    e.lamina(rh, [m.der[0] * Math.cos(a) + m.arr[0] * Math.sin(a), m.der[1] * Math.cos(a) + m.arr[1] * Math.sin(a), Math.sin(a)], [m.der[0] * -Math.sin(a), m.der[1] * -Math.sin(a), Math.cos(a)], 12, 8, () => ({ r: ciclo(ARCOIRIS, k * 2), t: 0.5, brillo: 0.5 }), (u, v) => v < 8 - u * 0.66);
  }
  e.esfera(en(rh, m, 0, 0, 0.6), 1.6, liso(ORO, 0.5, 0.95));
  void tono;
  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
