// El tinto de Doña Aurora: la casera gigante, de ruana roja con rayas, delantal y moño blanco, que sirve
// de una cafetera de peltre enorme (se inclina y cae el chorrito) en un pocillo gigante que echa vapor;
// atrás los bultos de café de Nariño y los cafetos con sus granos rojos, y una chapolera que baila.
import { en, liso, por, suma, Escultor, type V3 } from "./escultura";
import { brazo, gigante } from "./gigante";
import type { CarrozaArte } from "./partes";
import { ANCHO, camion, marcoDe, muneco3d, ORO } from "./piezas";
import { zigzag } from "./plataforma";
import { rampa, tono } from "./pintura";

const LARGO = 104;
const RUANA = rampa("#c8323a");
const CREMA = rampa("#f4ead6");
const CAFE = rampa("#6a3a1e");
const PELTRE = rampa("#2f6fd6");
const PIEL = rampa("#d99a6c");
const HOJA = rampa("#2f8a3a");
const GRANO = rampa("#d6282e");
const COSTAL = rampa("#c9a36a");

export function tinto(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: zigzag([RUANA, CREMA, CAFE, rampa("#e8a317")]), cubierta: (u) => tono(CAFE, 3 + (Math.floor(u / 3) % 2 ? 0.5 : -0.3)), flecos: [RUANA, CREMA, rampa("#e8a317")] });
  // Los bultos de café y los cafetos, atrás.
  for (const [x, y] of [
    [8, 6],
    [18, 4],
    [LARGO - 16, 5],
  ] as const) {
    e.elipsoide([x, y, 7], 7, 7, 5, { der: [1, 0, 0], arr: [0, 0, 1], fre: [0, 1, 0] }, (q) => ({ r: COSTAL, t: Math.abs(q.l[1]) < 0.12 ? -1 : (Math.floor(q.u * 6) % 2 ? 0.2 : -0.2), brillo: 0.1 }));
  }
  for (const x of [30, LARGO - 30]) {
    e.capsula([x, 4, 0], [x, 4, 26], 1.3, 1, liso(CAFE));
    for (let k = 0; k < 7; k++) {
      const a = k * 2.3;
      const z = 10 + k * 2.6;
      e.elipsoide([x + Math.cos(a) * 5, 4 + Math.sin(a) * 3, z], 5, 2, 1.4, { der: [Math.cos(a), Math.sin(a), 0], arr: [0, 0, 1], fre: [-Math.sin(a), Math.cos(a), 0] }, liso(HOJA, 0, 0.6));
      e.esfera([x + Math.cos(a) * 3, 4 + Math.sin(a) * 2 + 1, z - 2], 1.3, liso(GRANO, 0.5, 0.9));
    }
  }

  const g = gigante(e, {
    base: [LARGO * 0.42, ANCHO * 0.45, 0],
    piel: PIEL,
    pelo: rampa("#4a3428"),
    peinado: "moño",
    iris: rampa("#4a2a14"),
    mejillas: tono(rampa("#e86a7a"), 3),
    labios: rampa("#c8405a"),
    ropa: (q) => {
      const delantal = Math.abs(q.l[0]) < 0.5 && q.l[2] > 0.3 && q.p[2] < 46;
      if (delantal) return { r: CREMA, t: Math.floor(q.p[2] / 4) % 4 === 0 ? -1 : 0.4, brillo: 0.2 };
      return { r: Math.floor(q.p[2] / 5) % 4 === 0 ? CREMA : RUANA, brillo: 0.3 };
    },
  });
  const { M, H } = g;
  // El moño blanco grande sobre el pelo.
  e.parte("cabeza", g.cuello);
  for (const l of [-1, 1]) e.elipsoide(en(H, M, l * 8, 30, -8), 8, 5, 4, M, liso(CREMA, 0.6, 0.5));
  e.esfera(en(H, M, 0, 30, -6), 4, liso(CREMA, 0.2, 0.5));

  // El brazo con la cafetera de peltre azul de pepitas blancas, que se inclina para servir.
  const hd = g.hombro(1);
  e.parte("cafetera", hd, { padre: "cuerpo", mov: { gira: { amp: 0.09, periodo: 2800, centro: 0.04 } } });
  const mano = en(hd, M, 16, 4, 16);
  brazo(e, hd, en(hd, M, 12, -10, 6), mano, 1, liso(RUANA, 0, 0.4), PIEL);
  const C = en(mano, M, 4, 6, 10);
  e.cono(C[0], C[1], C[2] - 12, 11, 20, (q) => ({ r: PELTRE, t: (Math.floor(q.u * 4) + Math.floor(q.v / 3)) % 5 === 0 ? 3 : 0.2, brillo: 0.9 }), 8);
  e.disco(C[0], C[1], C[2] + 8, 8, liso(PELTRE, 0.8, 0.9));
  e.esfera([C[0], C[1], C[2] + 10], 2.6, liso(ORO, 0.4, 0.9));
  const pico = en(C, M, 6, -4, 12);
  e.capsula(en(C, M, 2, -6, 8), pico, 3, 1.8, liso(PELTRE, 0.2, 0.9));

  // El chorrito de tinto que cae al pocillo.
  e.parte("chorro", pico, { padre: "cafetera", mov: { sube: { dx: -1, dy: 14, periodo: 600 } } });
  for (let k = 0; k < 3; k++) e.esfera(suma(pico, [0, 0, -3 - k * 5]), 1.7 - k * 0.2, liso(CAFE, 0.6, 1));

  // El pocillo gigante, adelante, con el tinto y la oreja.
  const P: V3 = [LARGO * 0.7, ANCHO - 9, 0];
  e.parte("pocillo", P);
  e.elipsoide([P[0], P[1], 16], 13, 9, 16, { der: [1, 0, 0], arr: [0, 0, 1], fre: [0, 1, 0] }, (q) => ({ r: CREMA, t: Math.abs(q.p[2] - 12) < 1.3 || Math.abs(q.p[2] - 19) < 1 ? -2.5 : 0.6, brillo: 0.9 }), (l) => l[1] < 0.6);
  e.disco(P[0], P[1], 21.4, 11.5, (q) => ({ r: CAFE, t: Math.hypot(q.l[0] + 0.3, q.l[1] + 0.3) < 0.25 ? 1.5 : -0.5, brillo: 0.9 }));
  for (let a = -1.2; a < 1.3; a += 0.25) e.esfera([P[0] + 14 + Math.cos(a) * 2, P[1] - 1, 12 + Math.sin(a) * 5], 1.6, liso(CREMA, 0.5, 0.8));
  e.disco(P[0], P[1], 0.6, 17, (q) => ({ r: CREMA, t: Math.hypot(q.l[0], q.l[1]) > 0.88 ? -1.5 : 0.2, brillo: 0.6 }));
  // El vapor que sube del pocillo (tres volutas).
  for (let k = 0; k < 3; k++) {
    const v: V3 = [P[0] - 4 + k * 4, P[1] - k * 2, 26];
    e.parte(`vapor-${k}`, v, { mov: { sube: { dx: (k - 1) * 3, dy: -26, periodo: 2400, fase: k / 3, crece: 0.8 } } });
    e.esfera(v, 4, liso(CREMA, 1, 0.1));
    e.esfera(suma(v, [2, -1, 3]), 3, liso(CREMA, 1.2, 0.1));
  }
  // Una chapolera con su canasto, que baila en la esquina de adelante.
  e.parte("chapolera", [8, ANCHO - 5, 0], { mov: { gira: { amp: 0.08, periodo: 1400 }, vaiven: { dy: -1.4, periodo: 700 } } });
  muneco3d(e, [8, ANCHO - 5, 0], 1, {
    piel: rampa("#c98a5a"),
    ropa: rampa("#e8a317"),
    ropa2: RUANA,
    sombrero: rampa("#e2c58a"),
    pelo: rampa("#2a2236"),
    lleva: (ee, m) => {
      ee.elipsoide(suma(m, [0, 0, 3]), 4, 3, 3, { der: [1, 0, 0], arr: [0, 0, 1], fre: [0, 1, 0] }, liso(rampa("#b8803a"), 0, 0.2), (l) => l[1] < 0.4);
      for (let k = 0; k < 3; k++) ee.esfera(suma(m, [k - 1, 0, 5]), 1.2, liso(GRANO, 0.5, 0.9));
    },
  });
  void por;
  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
