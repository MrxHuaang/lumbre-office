// El Páramo: el espíritu del páramo, una mujer con antifaz de colores de pavo real, labios dorados, tocado
// de piedras de colores con un cuernito y el pelo de muchos colores, con alas de mariposa que aletean y la
// mano gigante de uñas largas pintadas y anillos de oro que sube y baja con una pluma de pavo real; a su
// alrededor, frailejones y colibríes en sus resortes.
import { en, liso, mirando, por, suma, Escultor, type V3 } from "./escultura";
import { gigante } from "./gigante";
import type { CarrozaArte } from "./partes";
import { ANCHO, ARCOIRIS, camion, ciclo, mano3d, marcoDe, ORO, pluma3d } from "./piezas";
import { rombosAndinos } from "./plataforma";
import { elipse, rampa, tono } from "./pintura";

const LARGO = 104;
const PIEL = rampa("#b8805a");
const PAVO = [rampa("#0f8a8a"), rampa("#1f5ac8"), rampa("#2fa84a"), rampa("#e8b81c")];
const MAGENTA = rampa("#d0287a");
const NARANJA = rampa("#f2711c");
const FRAILEJON = rampa("#a8b88a");
const TRONCO = rampa("#7a6a4a");
const MUSGO = rampa("#5a8a3a");

function frailejon(e: Escultor, b: V3, h: number) {
  e.capsula(b, [b[0], b[1], b[2] + h], 3.2, 2.8, (q) => ({ r: TRONCO, t: Math.sin(q.v * 2) > 0.5 ? 0.6 : -0.3, brillo: 0.1 }));
  const top: V3 = [b[0], b[1], b[2] + h];
  for (let k = 0; k < 14; k++) {
    const a = k * 2.4;
    const up = 0.5 + (k % 3) * 0.2;
    const dir: V3 = [Math.cos(a), Math.sin(a), up];
    pluma3d(e, top, dir, [-Math.sin(a), Math.cos(a), 0], 9, 3.2, FRAILEJON, { t: 0.4 });
  }
  e.capsula(top, [top[0] + 1, top[1], top[2] + 8], 0.8, 0.8, liso(MUSGO));
  e.esfera([top[0] + 1, top[1], top[2] + 9], 2, liso(rampa("#f2c21c"), 0.5, 0.4));
}

export function paramo(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: rombosAndinos(PAVO, rampa("#2a2a5a")), cubierta: (u, v) => tono(Math.floor((u * 0.7 + v) / 4) % 3 ? MUSGO : FRAILEJON, 3), flecos: PAVO });
  frailejon(e, [8, 6, 0], 22);
  frailejon(e, [LARGO - 10, 5, 0], 26);
  frailejon(e, [LARGO - 22, 2, 0], 16);

  const g = gigante(e, {
    base: [LARGO * 0.5, ANCHO * 0.4, 0],
    piel: PIEL,
    pelo: rampa("#7a2a9a"),
    peinado: "largo",
    iris: rampa("#e8b81c"),
    sombraOjos: rampa("#0f8a8a"),
    labios: rampa("#e8b81c"),
    ropa: (q) => ({ r: ciclo(PAVO, Math.floor(q.p[2] / 7 + Math.sin(q.u * 3))), brillo: 0.6 }),
    pinta: (p, cx, cy) => {
      // El antifaz de pavo real: plumas pintadas alrededor de los ojos.
      for (const l of [-1, 1]) {
        for (let k = 0; k < 5; k++) {
          const a = -0.4 - k * 0.32;
          const x = cx + l * (8.5 + Math.cos(a) * 12);
          const y = cy - 1 + Math.sin(a) * 9;
          p.plano(elipse(x, y, 2.2, 3.4, l * a), tono(ciclo(PAVO, k), 3));
          p.plano(elipse(x, y, 1, 1.4, l * a), tono(PAVO[1]!, 1));
        }
      }
    },
  });
  const { M, H } = g;
  // Mechones de colores y el tocado de piedras con el cuernito.
  e.parte("cabeza", g.cuello);
  for (let k = 0; k < 7; k++) {
    const l = k % 2 ? 1 : -1;
    e.capsula(en(H, M, l * (14 + k), 10 - k * 4, -8), en(H, M, l * (20 + k), -28 - k * 3, -10), 3.2, 2, liso(ciclo(ARCOIRIS, k), 0.2, 0.8));
  }
  for (let k = -4; k <= 4; k++) e.esfera(en(H, M, k * 4.4, 23 - Math.abs(k) * 1.6, 9 - Math.abs(k) * 1.6), 3, liso(ciclo([MAGENTA, NARANJA, PAVO[0]!, PAVO[3]!, PAVO[1]!], k + 4), 0.6, 1));
  e.cono(...(en(H, M, 0, 26, 6) as [number, number, number]), 3.4, 13, liso(ORO, 0.4, 0.95));

  // Las alas de mariposa, que aletean.
  for (const lado of [-1, 1] as const) {
    const raiz = en(g.pecho, M, lado * 6, 14, -14);
    e.parte(lado > 0 ? "ala-der" : "ala-izq", raiz, { padre: "cuerpo", mov: { gira: { amp: 0.12, periodo: 1300, fase: lado > 0 ? 0 : 0.5 } } });
    const du = suma(por(M.der, lado), por(M.fre, -0.35));
    e.lamina(raiz, du, M.arr, 56, 76, (q) => {
      const u = q.u;
      const v = q.v - 43;
      const ojoAla = Math.hypot(u - 42, v - 18);
      if (ojoAla < 5) return { r: PAVO[1]!, t: 0, brillo: 0.8 };
      if (ojoAla < 9) return { r: PAVO[3]!, t: 0.6, brillo: 0.8 };
      if (Math.abs(Math.sin(Math.atan2(v, u) * 7)) < 0.08) return { r: rampa("#2a1a3a"), t: 0.5 };
      const borde = (Math.hypot(u, v) > 54 ? 1 : 0) + (Math.hypot(u, v) > 60 ? 1 : 0);
      return { r: borde === 2 ? rampa("#2a1a3a") : borde ? NARANJA : v > 0 ? MAGENTA : rampa("#7a2ac8"), t: 0.2, brillo: 0.5 };
    }, (u, v) => {
      const vv = v - 43;
      const lobulo = vv > 0 ? Math.hypot(u - 30, vv - 14) < 34 : Math.hypot(u - 22, vv + 12) < 24;
      return lobulo && u > 0;
    });
  }

  // La mano gigante de uñas pintadas y anillos de oro, con la pluma de pavo real (sube y baja).
  const hd = g.hombro(1);
  e.parte("mano", hd, { padre: "cuerpo", mov: { vaiven: { dy: -3, periodo: 2800 } } });
  const muneca = en(hd, M, 8, 6, 22);
  e.capsula(hd, en(hd, M, 10, -6, 10), 7, 6, liso(PAVO[2]!, 0, 0.5));
  e.capsula(en(hd, M, 10, -6, 10), muneca, 6, 5.5, liso(PAVO[2]!, 0, 0.5));
  for (let k = 0; k < 3; k++) e.elipsoide(en(muneca, M, 0, k * 2.6, -2), 6, 1.2, 6, M, liso(ORO, 0.4, 0.95));
  const palma = en(muneca, M, 2, 10, 4);
  mano3d(e, palma, suma(por(M.arr, 1), por(M.der, 0.25)), M.fre, 15, PIEL, { unas: MAGENTA, abre: 0.22, curva: -0.1 });
  for (const k of [-1, 0]) e.elipsoide(en(palma, M, k * 4, 9, 1), 2.4, 1.2, 2.4, M, liso(ORO, 0.5, 0.95));
  pluma3d(e, en(palma, M, -2, -2, 4), suma(por(M.arr, 1), por(M.der, -0.6), por(M.fre, 0.3)), M.fre, 28, 9, PAVO[2]!, { ojo: true });

  // Los colibríes en sus resortes (se mecen rápido).
  const colibri = (id: string, b: V3, h: number, fase: number, col: (typeof PIEL)) => {
    e.parte(id, b, { mov: { vaiven: { dx: 2.4, dy: -2, periodo: 700, fase }, gira: { amp: 0.12, periodo: 900, fase } } });
    for (let k = 0; k < 16; k++) e.esfera([b[0] + Math.cos(k * 1.3) * 1.6, b[1] + Math.sin(k * 1.3) * 1.6, b[2] + (k / 16) * h], 0.7, liso(rampa("#9a9aa8"), 0.5, 0.9));
    const c: V3 = [b[0], b[1], b[2] + h + 4];
    const m = mirando(0.6);
    e.elipsoide(c, 3, 3, 5.5, m, liso(col, 0.3, 1));
    e.esfera(en(c, m, 0, 2, 5), 2.6, liso(col, 0.6, 1));
    e.capsula(en(c, m, 0, 2, 7), en(c, m, 0, 1.5, 14), 0.6, 0.4, liso(rampa("#2a2236")));
    for (const l of [-1, 1]) e.lamina(en(c, m, l * 2, 1, 0), suma(por(m.der, l), por(m.arr, 0.5)), m.fre, 9, 5, () => ({ r: rampa("#c8e8f8"), t: 1, brillo: 0.5 }), (u, v) => Math.abs(v - 2.5) < 2.5 - u * 0.2);
  };
  colibri("colibri-1", [14, ANCHO - 6, 0], 30, 0, PAVO[2]!);
  colibri("colibri-2", [LARGO - 12, ANCHO - 12, 0], 38, 0.4, MAGENTA);
  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
