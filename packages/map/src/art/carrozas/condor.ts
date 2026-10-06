// El Cóndor de los Andes: el cóndor monumental con las alas abiertas que aletean, el collar blanco de
// plumón, la cresta roja y el pico de oro, posado en una peña sobre montañas de colores, con el sol que da
// vueltas detrás y dos llamas con borlas que bailan en la cubierta.
import { en, liso, mirando, por, suma, Escultor, type V3 } from "./escultura";
import { ceja, LINEA, ojo, parpado } from "./figuras";
import type { CarrozaArte } from "./partes";
import { ANCHO, ARCOIRIS, ciclo, calco, camion, conCara, marcoDe, ORO, pluma3d, soloCalco } from "./piezas";
import { rombosAndinos } from "./plataforma";
import { rampa, tono } from "./pintura";

const LARGO = 112;
const PLUMA = rampa("#2c2f5a");
const BRILLO_AZUL = rampa("#3e58b0");
const BLANCO = rampa("#f2eee6");
const CRESTA = rampa("#c8283a");
const CABEZA = rampa("#e07a7a");
const PEÑA = rampa("#8a6a9a");
const LLAMA = rampa("#f0e2c8");

export function condor(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: rombosAndinos(ARCOIRIS, rampa("#2c2f5a")), cubierta: (u, v) => tono(rampa("#5aa83c"), 3 + (Math.floor((u + v) / 5) % 2 ? 0.5 : -0.3)), flecos: ARCOIRIS });
  // Las montañas de colores atrás (franjas como los cultivos de la cordillera) con nieve en la punta.
  const montanas = [rampa("#8a3cc8"), rampa("#f2711c"), rampa("#3db842"), rampa("#f7c518"), rampa("#1fb8b0")];
  for (const [x, y, r, h] of [
    [18, 8, 16, 40],
    [42, 4, 18, 52],
    [LARGO - 22, 8, 16, 44],
  ] as const)
    e.cono(x, y, 0, r, h, (q) => (q.l[1] > 0.78 ? { r: BLANCO, brillo: 0.4 } : { r: ciclo(montanas, Math.floor(q.l[1] * 8 + Math.sin(q.u * 3) * 0.6) + x), brillo: 0.2 }));

  const B: V3 = [LARGO * 0.5, ANCHO * 0.5, 0];
  const M = mirando(1.0);
  const C = en(B, M, 0, 52, 0);
  // El sol detrás, que da vueltas despacio.
  const S = en(B, M, 0, 92, -26);
  e.parte("sol", S, { mov: { rueda: { periodo: 24000 } } });
  e.lamina(en(S, M, -38, -38, 0), M.der, M.arr, 76, 76, (q) => {
    const d = Math.hypot(q.u - 38, q.v - 38);
    const a = Math.atan2(q.v - 38, q.u - 38);
    if (d < 20) return { r: ORO, t: d < 14 ? 1 : 0, brillo: 0.6 };
    return { r: Math.floor((a + Math.PI) * 8 / Math.PI) % 2 ? rampa("#f2711c") : rampa("#f7c518"), brillo: 0.3 };
  }, (u, v) => {
    const d = Math.hypot(u - 38, v - 38);
    const a = Math.atan2(v - 38, u - 38);
    return d < 20 || d < 26 + Math.abs(Math.cos(a * 8)) * 12;
  });

  // La peña y las garras.
  e.parte("cuerpo", B, { mov: { gira: { amp: 0.012, periodo: 5000 } } });
  e.elipsoide(en(B, M, 0, 8, 0), 30, 14, 20, M, (q) => ({ r: PEÑA, t: Math.abs(Math.sin(q.u * 4 + q.v * 3)) < 0.12 ? -1.2 : 0, brillo: 0.2 }), (l) => l[1] > -0.5);
  for (const l of [-1, 1]) for (let k = -1; k <= 1; k++) e.capsula(en(B, M, l * 9 + k * 2.4, 20, 8), en(B, M, l * 9 + k * 3, 16, 14), 1.8, 1, liso(ORO, 0.3, 0.9));
  // El cuerpo negro azulado con las plumas en escamas.
  e.elipsoide(C, 22, 30, 20, M, (q) => {
    const fila = Math.floor((q.l[1] + 1) * 7);
    const esc = Math.abs(Math.sin((Math.atan2(q.l[0], q.l[2]) * 9 + (fila % 2) * 1.6))) < 0.25;
    return { r: q.l[2] > 0.5 && Math.abs(q.l[0]) < 0.4 && q.l[1] < 0.3 ? BRILLO_AZUL : PLUMA, t: esc ? -1 : 0.3, brillo: 0.6 };
  });
  // El collar de plumón blanco.
  for (let a = -Math.PI; a < Math.PI; a += 0.38) e.esfera(en(C, M, Math.cos(a) * 12, 27 + Math.sin(a * 2) * 1.2, Math.sin(a) * 10), 4.6, liso(BLANCO, 0.5, 0.2));
  e.capsula(en(C, M, 0, 28, 1), en(C, M, 0, 40, 5), 6, 5, liso(CABEZA, 0, 0.5));

  // La cabeza con la cresta, los ojos grandes y el pico de oro.
  const H = en(C, M, 0, 46, 7);
  const cara = calco(11, 11, (p, cx, cy) => {
    for (const l of [-1, 1] as const) {
      ojo(p, cx + l * 5.5, cy - 1, 8, 3.6, 2.6, l, { iris: rampa("#d08a1a"), pestanas: 3 });
      ceja(p, cx + l * 6, cy - 6, 8, l, LINEA, 1.2);
    }
  });
  e.parte("cabeza", en(C, M, 0, 34, 2), { padre: "cuerpo", mov: { gira: { amp: 0.09, periodo: 3600 } } });
  e.elipsoide(H, 11, 11, 10, M, conCara(() => ({ r: CABEZA, brillo: 0.6 }), cara, 0.1));
  e.elipsoide(en(H, M, 0, 10, 1), 3, 7, 7, M, liso(CRESTA, 0.3, 0.7));
  e.capsula(en(H, M, 0, -1, 8), en(H, M, 0, -4, 18), 3.6, 1.4, liso(ORO, 0.5, 0.95));
  e.capsula(en(H, M, 0, -4, 18), en(H, M, 0, -8, 17), 1.4, 0.6, liso(ORO, 0.5, 0.95));
  e.parte("parpados", en(C, M, 0, 34, 2), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 3400, dura: 170 } } });
  e.elipsoide(H, 11.5, 11.5, 10.5, M, soloCalco(calco(11.5, 11.5, (p, cx, cy) => { for (const l of [-1, 1] as const) parpado(p, cx + l * 5.5, cy - 1, 8, 3.6, 2.6, l, CABEZA); }), 0.1));

  // Las alas abiertas: las cobertoras negras, la franja blanca y las primarias (los "dedos") de colores.
  for (const lado of [-1, 1] as const) {
    const raiz = en(C, M, lado * 16, 14, -6);
    e.parte(lado > 0 ? "ala-der" : "ala-izq", raiz, { padre: "cuerpo", mov: { gira: { amp: 0.13, periodo: 2300, fase: lado > 0 ? 0 : 0.5 } } });
    for (let i = 0; i < 7; i++) {
      const a = -0.35 + i * 0.16;
      const radial = suma(por(M.der, lado * Math.cos(a)), por(M.arr, Math.sin(a)));
      const dir = suma(radial, por(M.fre, -0.3));
      pluma3d(e, suma(raiz, por(radial, 22)), dir, M.fre, 34 + (i > 4 ? -6 : 0), 8, ARCOIRIS[(i + (lado > 0 ? 0 : 3)) % ARCOIRIS.length]!, { t: -0.4 });
      pluma3d(e, suma(raiz, por(radial, 10), por(M.fre, 1.5)), dir, M.fre, 24, 9, BLANCO, { t: 0.3 });
      pluma3d(e, suma(raiz, por(M.fre, 3)), dir, M.fre, 16, 9, PLUMA, { t: 0.2 });
    }
  }

  // Las dos llamas con borlas de colores, que bailan.
  const llama = (id: string, b: V3, fase: number, borla: number) => {
    const m = mirando(0.9);
    e.parte(id, b, { mov: { vaiven: { dy: -1.6, periodo: 700, fase }, gira: { amp: 0.06, periodo: 1400, fase } } });
    for (const [a, f] of [
      [-3, -5],
      [3, -5],
      [-3, 5],
      [3, 5],
    ] as const)
      e.capsula(en(b, m, a, 0, f), en(b, m, a, 9, f), 1.6, 1.8, liso(LLAMA, -0.3));
    e.elipsoide(en(b, m, 0, 13, 0), 6, 5, 9, m, (q) => ({ r: q.l[1] > 0.4 ? ciclo(ARCOIRIS, Math.floor(q.u * 3) + borla) : LLAMA, brillo: 0.2 }));
    e.capsula(en(b, m, 0, 15, 6), en(b, m, 0, 25, 9), 2.6, 2.2, liso(LLAMA));
    e.elipsoide(en(b, m, 0, 27, 11), 3, 3, 4.4, m, liso(LLAMA, 0.3));
    for (const l of [-1, 1]) {
      e.capsula(en(b, m, l * 1.6, 29, 9), en(b, m, l * 2.4, 33, 8), 0.9, 0.6, liso(LLAMA));
      e.esfera(en(b, m, l * 2.4, 33.5, 8), 1.4, liso(ARCOIRIS[(borla + 2 + l) % 7]!, 0.5));
    }
    e.esfera(en(b, m, 1.6, 28, 14.2), 0.8, () => ({ c: LINEA }));
  };
  llama("llama-1", [10, ANCHO - 9, 0], 0, 0);
  llama("llama-2", [LARGO - 12, ANCHO - 12, 0], 0.5, 3);

  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
