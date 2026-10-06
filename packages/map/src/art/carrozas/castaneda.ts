// La Familia Castañeda llega: la abuela viajera gigante, de vestido de época vino tinto con pañolón
// mostaza, gafitas redondas y sombrerito de flores, con la sombrilla de rayas que se mece y el pañuelo con
// que saluda; los baúles de viaje, el loro de colores que aletea en su percha y el abuelito de sombrero.
import { en, liso, mirando, por, suma, type Escultor as E, Escultor, type V3 } from "./escultura";
import { brazo, gigante } from "./gigante";
import type { CarrozaArte } from "./partes";
import { ANCHO, camion, marcoDe, muneco3d, ORO, pluma3d } from "./piezas";
import { floresBarniz } from "./plataforma";
import { circulo, rampa, resta, tono } from "./pintura";

const LARGO = 104;
const VINO = rampa("#93203f");
const MOSTAZA = rampa("#e0a428");
const BOTELLA = rampa("#1f7a5a");
const CREMA = rampa("#f4e6c8");
const PIEL = rampa("#f0b088");
const CANAS = rampa("#d9d4e4");
const ROSA = rampa("#ec7aa6");
const TURQUESA = rampa("#28a8b8");
const MADERA = rampa("#7a4a2a");

function baul(e: E, x: number, y: number, z: number, w: number, d: number, h: number, r: typeof VINO) {
  const zuncho = (u: number) => Math.floor(u) % 7 < 1;
  e.caja(
    x,
    y,
    z,
    w,
    d,
    h,
    (q) => (zuncho(q.u) ? { r: ORO, brillo: 0.9 } : { r, t: 0.5 }),
    (q) => (zuncho(q.u) || q.v > h - 1.4 ? { r: ORO, brillo: 0.9 } : Math.abs(q.u - w / 2) < 1.4 && q.v > h - 5 ? { r: ORO, t: 1.5 } : { r }),
    (q) => (q.v > h - 1.4 ? { r: ORO } : { r, t: -0.5 }),
  );
}

export function castaneda(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: floresBarniz(VINO, [MOSTAZA, ROSA, CREMA, TURQUESA], ORO), cubierta: (u, v) => tono((Math.floor(u / 6) + Math.floor(v / 6)) % 2 ? MOSTAZA : rampa("#b8742c"), 3), flecos: [MOSTAZA, VINO, BOTELLA, ROSA] });
  // Los baúles de viaje, atrás y a los lados.
  baul(e, 4, 3, 0, 20, 14, 12, TURQUESA);
  baul(e, 7, 5, 12, 14, 10, 9, VINO);
  baul(e, LARGO - 24, 2, 0, 18, 12, 10, BOTELLA);

  const g = gigante(e, {
    base: [LARGO * 0.47, ANCHO * 0.45, 0],
    piel: PIEL,
    pelo: CANAS,
    peinado: "moño",
    iris: rampa("#3f7a3a"),
    mejillas: tono(ROSA, 3),
    cejas: tono(CANAS, 1),
    labios: rampa("#c8405a"),
    ropa: (q) => ({ r: q.p[2] > 60 && q.p[2] < 70 ? CREMA : q.p[2] > 40 && q.p[2] <= 60 && (Math.floor(q.u * 4) % 2 === 0) ? MOSTAZA : (Math.floor(q.p[0] * 0.7) + Math.floor(q.p[2] * 0.4)) % 9 === 0 ? MOSTAZA : VINO, brillo: 0.4 }),
    pinta: (p, cx, cy) => {
      for (const l of [-1, 1]) p.plano(resta(circulo(cx + l * 8.5, cy - 1, 8), circulo(cx + l * 8.5, cy - 1, 6.8)), tono(ORO, 3));
      p.trazo(cx - 1.5, cy - 2, cx + 1.5, cy - 2, tono(ORO, 3), 1);
    },
  });
  const { M, H } = g;
  // El camafeo, el collar de perlas y el sombrerito de flores con su pluma.
  e.parte("cuerpo", g.pecho);
  e.elipsoide(en(g.pecho, M, 0, 10, 15), 5, 6, 2.4, M, liso(ORO, 0.5, 0.95));
  e.elipsoide(en(g.pecho, M, 0, 10, 17), 3, 4, 1.2, M, liso(ROSA, 0.5, 0.8));
  e.parte("cabeza", g.cuello);
  e.cono(...(en(H, M, -2, 21, -6) as [number, number, number]), 10, 8, liso(BOTELLA, 0, 0.4), 8.5);
  e.disco(...(en(H, M, -2, 21, -6) as [number, number, number]), 14, (q) => ({ r: BOTELLA, t: Math.hypot(q.l[0], q.l[1]) > 0.9 ? -1 : 0.5 }));
  for (const [a, r] of [
    [-6, ROSA],
    [-1, MOSTAZA],
    [4, CREMA],
    [8, ROSA],
  ] as const)
    e.esfera(en(H, M, a, 29, 6), 3, liso(r, 0.4, 0.4));
  pluma3d(e, en(H, M, 6, 28, -4), suma(por(M.arr, 1), por(M.der, 0.6), por(M.fre, -0.3)), M.fre, 24, 6, TURQUESA);

  // La sombrilla: el brazo derecho, el bastón y la copa de rayas (se mece).
  const hd = g.hombro(1);
  e.parte("sombrilla", hd, { padre: "cuerpo", mov: { gira: { amp: 0.07, periodo: 3100, fase: 0.3 } } });
  const manoS = en(hd, M, 14, 24, 8);
  brazo(e, hd, en(hd, M, 14, 6, 8), manoS, 1, liso(VINO, 0, 0.4), PIEL);
  const punta = en(hd, M, 10, 84, 0);
  e.capsula(en(hd, M, 14.5, 18, 8), punta, 1.2, 1.2, liso(MADERA, 0, 0.6));
  e.elipsoide(en(hd, M, 6, 78, 0), 31, 15, 31, M, (q) => ({ r: Math.floor((q.u + Math.PI) * 2.6) % 2 ? CREMA : ROSA, t: q.l[1] < 0.12 ? -0.6 : 0, brillo: 0.5 }), (l) => l[1] > 0);
  e.esfera(en(hd, M, 10, 97, 0), 2.6, liso(ORO, 0.5, 0.95));

  // El brazo izquierdo, que saluda con el pañuelo de encaje.
  const hi = g.hombro(-1);
  e.parte("panuelo", hi, { padre: "cuerpo", mov: { gira: { amp: 0.16, periodo: 1500 } } });
  const manoP = en(hi, M, -16, 30, 6);
  brazo(e, hi, en(hi, M, -16, 10, 6), manoP, 1, liso(VINO, 0, 0.4), PIEL);
  e.lamina(manoP, por(M.der, -1), suma(por(M.arr, 1), por(M.fre, 0.3)), 16, 14, (q) => ({ r: (q.u + q.v) % 4 < 0.6 ? ROSA : CREMA, brillo: 0.3 }), (u, v) => v < 14 - u * 0.4 + Math.sin(u) * 1.2);

  // El loro en su percha (aletea) y el abuelito de sombrero alto.
  const pie: V3 = [LARGO - 12, ANCHO - 7, 0];
  e.parte("percha", pie);
  e.capsula(pie, [pie[0], pie[1], 30], 1.6, 1.6, liso(MADERA));
  e.capsula([pie[0] - 8, pie[1], 30], [pie[0] + 8, pie[1], 30], 1.6, 1.6, liso(MADERA));
  e.elipsoide([pie[0], pie[1], 0.8], 7, 1, 5, mirando(0), liso(MADERA, -0.5));
  const L: V3 = [pie[0], pie[1], 34];
  const ML = mirando(1.2);
  e.parte("loro", L, { padre: "percha", mov: { gira: { amp: 0.12, periodo: 1700 } } });
  e.elipsoide(en(L, ML, 0, 6, 0), 5, 8, 5, ML, liso(rampa("#e0283c"), 0, 0.7));
  e.esfera(en(L, ML, 0, 16, 1), 4.5, liso(rampa("#e0283c"), 0.3, 0.7));
  e.elipsoide(en(L, ML, 0, 16, 4.2), 2.6, 2.6, 1, ML, liso(CREMA, 0.5));
  e.esfera(en(L, ML, 0, 16.4, 5.2), 1, liso(rampa("#2a2236")));
  e.capsula(en(L, ML, 0, 14, 4), en(L, ML, 0, 11, 7), 1.6, 0.6, liso(rampa("#3a3040"), 0, 0.8));
  pluma3d(e, en(L, ML, 0, 2, -2), suma(por(ML.arr, -1), por(ML.fre, -0.4)), ML.der, 16, 5, rampa("#2f6fd6"));
  pluma3d(e, en(L, ML, 1, 1, -1), suma(por(ML.arr, -1), por(ML.fre, -0.2)), ML.der, 12, 4, MOSTAZA);
  e.parte("ala-loro", en(L, ML, 4.5, 10, -1), { padre: "loro", mov: { gira: { amp: 0.35, periodo: 520, centro: 0.15 } } });
  for (const [r, l, a] of [
    [rampa("#2f6fd6"), 14, -0.9],
    [rampa("#3db842"), 11, -0.6],
    [MOSTAZA, 8, -0.3],
  ] as const)
    pluma3d(e, en(L, ML, 4.5, 10, -1), suma(por(ML.der, Math.cos(a)), por(ML.arr, Math.sin(a))), ML.fre, l, 4.5, r);
  e.parte("abuelo", [10, ANCHO - 5, 0], { mov: { gira: { amp: 0.07, periodo: 1600 }, vaiven: { dy: -1.2, periodo: 800 } } });
  muneco3d(e, [10, ANCHO - 5, 0], 1, { piel: PIEL, ropa: BOTELLA, ropa2: CREMA, sombrero: rampa("#2a2236"), pelo: CANAS });

  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
