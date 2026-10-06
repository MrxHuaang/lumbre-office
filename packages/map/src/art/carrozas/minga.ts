// La Minga de la cosecha: la Pachamama gigante, homenaje al agua y a la tierra (como las carrozas del
// Desfile Magno): el rostro de mujer pintado de turquesa y verde con detalles amarillos y rosados, los ojos
// grandes, la sonrisa, el tocado enorme de plumas en abanico con todo el arcoíris, la vincha tejida, los
// collares de cuentas y las dos manos que ofrecen una totuma de la que se derrama el agua. A los lados, las
// alas; adelante, la cosecha (papa, maíz de colores y quinua) y dos guaguas que bailan.
import { TEJIDO } from "@hyvento/shared";
import { Escultor, en, liso, mirando, por, suma, type V3 } from "./escultura";
import { ceja, LINEA, mejilla, ojo, parpado, sonrisa } from "./figuras";
import type { CarrozaArte } from "./partes";
import { abanico3d, ANCHO, ARCOIRIS, calco, camion, conCara, cuentas3d, mano3d, marcoDe, mazorca3d, muneco3d, ORO, papa3d, pluma3d, quinua3d, soloCalco } from "./piezas";
import { rombosAndinos } from "./plataforma";
import { circulo, poligono, rampa, tono } from "./pintura";

const LARGO = 104;
const TURQUESA = rampa("#22b5ad");
const VERDE = rampa("#45ad55");
const AMARILLO = rampa("#f6c625");
const ROSADO = rampa("#ef6ba0");
const PELO = rampa("#2a2236");
const TOTUMA = rampa("#c77a2c");
const AGUA = rampa("#3cc4e6");
const TELA = TEJIDO.map(rampa);
const CREMA = rampa("#f3e3c0");
const MORADO = rampa("#7a2a5e");

/** La cara pintada (la calcomanía): ojos grandes con sombra rosada, cejas, mejillas, pintura y sonrisa. */
const OJOS = { dx: 8.5, dy: -1, w: 14, hu: 5.6, hl: 3.8 };
function caraPintada() {
  return calco(20, 24, (p, cx, cy) => {
    for (const l of [-1, 1] as const) {
      mejilla(p, cx + l * 12, cy + 7, 4, 2.6, tono(ROSADO, 3));
      for (let k = 0; k < 4; k++) p.plano(circulo(cx + l * (8 + k * 2.6), cy + 5 + Math.abs(k - 1.5) * 0.7, 0.8), tono(AMARILLO, 5));
      ceja(p, cx + l * (OJOS.dx + 0.5), cy + OJOS.dy - OJOS.hu - 3.5, OJOS.w, l, LINEA, 1.6);
      ojo(p, cx + l * OJOS.dx, cy + OJOS.dy, OJOS.w, OJOS.hu, OJOS.hl, l, { iris: rampa("#8a4a1a"), sombra: ROSADO, mira: 0.5 });
      p.curva(cx + l * 3, cy + 19, cx + l * 7, cy + 16, cx + l * 11, cy + 18, tono(AMARILLO, 4), 1);
      p.punto(Math.round(cx + l * 2), Math.round(cy + 7), tono(VERDE, 0));
    }
    p.plano(poligono([[cx, cy + 17], [cx - 2, cy + 21], [cx + 2, cy + 21]]), tono(AMARILLO, 4));
    sonrisa(p, cx, cy + 12, 14, 5, rampa("#d8336e"));
  });
}
function parpadosPintados() {
  return calco(20.6, 24.6, (p, cx, cy) => {
    for (const l of [-1, 1] as const) parpado(p, cx + l * OJOS.dx, cy + OJOS.dy, OJOS.w, OJOS.hu, OJOS.hl, l, TURQUESA, ROSADO);
  });
}

export function minga(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, {
    faldon: rombosAndinos(TELA, MORADO),
    cubierta: (u, v) => tono(Math.floor(v / 4) % 2 ? rampa("#5aa83c") : rampa("#7a5530"), 3 + (Math.floor(u) % 5 === 0 ? -0.6 : 0)),
    flecos: TELA,
  });

  const B: V3 = [LARGO * 0.5, ANCHO * 0.48, 0];
  const M = mirando(1.0);
  const H = en(B, M, 0, 98, 2);
  const T = en(B, M, 0, 36, 24);
  const tela = (q: { p: V3 }) => {
    const z = Math.floor((q.p[2] + Math.abs((((q.p[0] - q.p[1]) % 10) + 10) % 10 - 5) * 0.8) / 5);
    return { r: TELA[((z % TELA.length) + TELA.length) % TELA.length]!, brillo: 0.3 };
  };

  // Las alas (detrás de los hombros): plumas por capas de azul, turquesa, verde y oro.
  for (const lado of [-1, 1] as const) {
    const raiz = en(B, M, lado * 20, 54, -8);
    e.parte(lado > 0 ? "ala-der" : "ala-izq", raiz, { padre: "cuerpo", mov: { gira: { amp: 0.1, periodo: 2600, fase: lado > 0 ? 0 : 0.5 } } });
    const filas = [
      [rampa("#2a8fd0"), 50, 11],
      [TURQUESA, 40, 10],
      [VERDE, 30, 9],
      [AMARILLO, 20, 8],
    ] as const;
    filas.forEach(([r, largo, ancho], fila) => {
      for (let i = 0; i < 6; i++) {
        const a = -0.55 + i * 0.27;
        const radial = suma(por(M.der, lado * Math.cos(a)), por(M.arr, Math.sin(a)));
        pluma3d(e, suma(raiz, por(M.fre, fila * 1.6)), suma(radial, por(M.fre, -0.45)), M.fre, largo * (1 - Math.abs(i - 2.5) * 0.05), ancho, r, { t: fila * 0.2 - 0.3 });
      }
    });
  }

  // El tocado de plumas en arcoíris (atrás de la cabeza), con una corona corta de plumas claras.
  e.parte("tocado", H, { padre: "cabeza", mov: { gira: { amp: 0.03, periodo: 3300 } } });
  abanico3d(e, en(H, M, 0, 4, -10), M, 16, 50, -0.3, Math.PI + 0.3, 15, ARCOIRIS, 11, 0.32);
  for (let i = 0; i < 9; i++) {
    const a = 0.25 + (i / 8) * (Math.PI - 0.5);
    const radial = suma(por(M.der, Math.cos(a)), por(M.arr, Math.sin(a)));
    pluma3d(e, en(H, M, Math.cos(a) * 17, 4 + Math.sin(a) * 17, -5), suma(radial, por(M.fre, -0.15)), M.fre, 18, 6.5, i % 2 ? CREMA : AMARILLO, { t: 0.4 });
  }

  // El cuerpo: el anaco y la ruana con las rayas del tejido, los hombros, el cuello y los collares.
  e.parte("cuerpo", B, { mov: { gira: { amp: 0.012, periodo: 6200 } } });
  e.elipsoide(en(B, M, 0, 20, 0), 31, 26, 21, M, tela, (l) => l[1] > -0.76);
  e.elipsoide(en(B, M, 0, 50, 0), 25, 18, 16, M, tela);
  e.capsula(en(B, M, -23, 58, -3), en(B, M, 23, 58, -3), 9.5, 9.5, tela);
  e.capsula(en(B, M, 0, 60, 0), en(B, M, 0, 82, 1), 7.5, 7, liso(VERDE, 0, 0.5));
  for (const [z, f, r, cols] of [
    [70, 8, 2.3, [rampa("#e0283c"), AMARILLO, TURQUESA]],
    [66, 12, 2.5, [AMARILLO, rampa("#e0283c"), rampa("#f4f0e6")]],
    [61, 15, 2.7, [TURQUESA, ROSADO, AMARILLO, rampa("#2f6fd6")]],
  ] as const)
    cuentas3d(e, en(B, M, -16, z + 4, 3), en(B, M, 0, z - 12, f + 6), en(B, M, 16, z + 4, 3), r, cols);

  // La cabeza: el pelo, las trenzas, la cara pintada, la nariz, las orejas con aretes y la vincha tejida.
  e.parte("cabeza", en(B, M, 0, 76, 0), { padre: "cuerpo", mov: { gira: { amp: 0.05, periodo: 4700, fase: 0.2 } } });
  e.elipsoide(en(H, M, 0, 3, -9), 21.5, 25.5, 18, M, liso(PELO, 0, 0.8));
  for (const lado of [-1, 1] as const) {
    for (let k = 0; k < 6; k++) e.elipsoide(en(H, M, lado * (19 - k * 0.4), -14 - k * 6, -1 + k * 0.6), 4.6, 4, 4.2, M, liso(PELO, 0.2, 0.8));
    e.esfera(en(H, M, lado * 16.5, -51, 2), 3, liso(rampa("#e0283c"), 0, 0.7));
    e.elipsoide(en(H, M, lado * 19.5, 0, -2), 2.5, 5, 4, M, liso(VERDE));
    e.esfera(en(H, M, lado * 20.5, -9, 0), 3.4, liso(ORO, 0.5, 0.95));
  }
  e.elipsoide(H, 20, 24, 19, M, conCara((q) => ({ r: q.l[1] + Math.sin(q.l[0] * 9) * 0.06 > 0.05 ? TURQUESA : VERDE, brillo: 0.6 }), caraPintada()));
  e.elipsoide(en(H, M, 0, -3, 18.2), 2.2, 4.4, 3, M, liso(TURQUESA, 0.8, 0.8));
  e.elipsoide(
    H,
    20.8,
    24.8,
    19.8,
    M,
    (q) => {
      const ang = Math.atan2(q.l[0], q.l[2]);
      const u = Math.floor((ang + Math.PI) * 6);
      const d = Math.abs((((ang * 18) % 3) + 3) % 3 - 1.5) + Math.abs(q.l[1] - 0.52) * 18;
      return { r: d < 1.1 ? TELA[u % TELA.length]! : d < 1.8 ? AMARILLO : MORADO, brillo: 0.3 };
    },
    (l) => l[1] > 0.43 && l[1] < 0.61 && l[2] > -0.45,
  );
  e.esfera(en(H, M, 0, 13, 19), 4.4, liso(ORO, 0.5, 0.95));
  e.esfera(en(H, M, 0, 13, 23), 1.6, liso(rampa("#e0283c"), 0.5, 0.95));

  e.parte("parpados", en(B, M, 0, 76, 0), { padre: "cabeza", contorno: false, mov: { parpadeo: { cada: 4100, dura: 170, fase: 0.3 } } });
  e.elipsoide(H, 20.6, 24.6, 19.6, M, soloCalco(parpadosPintados()));

  // Las manos que ofrecen la totuma llena de agua, con las mangas de la ruana.
  e.parte("manos", T, { padre: "cuerpo", mov: { vaiven: { dy: 2.4, periodo: 3200, fase: 0.1 } } });
  for (const lado of [-1, 1] as const) e.capsula(en(B, M, lado * 25, 44, 2), en(T, M, lado * 15, -5, -3), 7.5, 6.5, tela);
  e.elipsoide(T, 17, 10, 13, M, (q) => ({ r: Math.floor((q.u + 4) * 2.5) % 3 === 0 ? rampa("#d6322e") : q.l[1] < -0.55 ? rampa("#2a9a4a") : TOTUMA, brillo: 0.8 }), (l) => l[1] < 0.15);
  e.elipsoide(en(T, M, 0, 1.4, 0), 15.6, 1, 11.8, M, (q) => ({ r: AGUA, t: Math.abs(Math.sin(q.l[0] * 7 + q.l[2] * 5)) > 0.9 ? 2 : 0.5, brillo: 0.95 }));
  for (const lado of [-1, 1] as const) {
    mano3d(e, en(T, M, lado * 15, -6, 1), suma(por(M.arr, 1), por(M.der, -lado * 0.5)), por(M.der, -lado), 12, VERDE, { curva: 0.35 });
    e.elipsoide(en(T, M, lado * 17, -11, -1), 5, 2.2, 5, M, liso(ORO, 0.4, 0.95));
  }

  // El agua que se derrama por el borde y cae hasta la cubierta, y el charquito.
  e.parte("chorro", en(T, M, 9, 1, 8), { padre: "manos", contorno: false, mov: { escala: { sx: 0.06, periodo: 420 } } });
  let prev = en(T, M, 9, 1, 8);
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const p = en(T, M, 9 + t * 3, 1 - t * (T[2] + 1), 8 + t * 6 + Math.sin(t * 2) * 2);
    e.capsula(prev, p, 2 + t * 0.6, 2 + t * 0.8, (q) => ({ r: AGUA, t: Math.cos(q.u) > 0.6 ? 1.6 : 0.4, brillo: 0.95 }), i === 12);
    prev = p;
  }
  e.elipsoide(suma(prev, [0, 0, 0.3]), 9, 0.6, 6, M, liso(AGUA, 0.6, 0.95));
  e.parte("gotas", en(T, M, 13, -4, 12), { padre: "manos", mov: { sube: { dx: 1, dy: 12, periodo: 700 } } });
  for (let k = 0; k < 3; k++) e.esfera(en(T, M, 13 + k, -4 - k * 9, 12 + k * 2), 1.6, liso(AGUA, 1.5, 1));

  // Adelante: la cosecha (maíz de colores, papas y quinua) en la orilla de la cubierta.
  e.parte("cosecha", [LARGO / 2, ANCHO - 4, 0]);
  quinua3d(e, [6, ANCHO - 12, 0], 16, rampa("#c83a2a"));
  quinua3d(e, [LARGO - 8, ANCHO - 20, 0], 14, rampa("#e8902a"));
  for (const [x, y, c, d] of [
    [16, ANCHO - 5, "#f2c22a", -1],
    [22, ANCHO - 3, "#8a2a8a", -1],
    [78, ANCHO - 4, "#d8402a", 1],
    [86, ANCHO - 6, "#f2c22a", 1],
  ] as const)
    mazorca3d(e, [x, y, 2], [x + d * 7, y + 1, 7], 2.6, rampa(c));
  for (const [x, y, c] of [
    [32, ANCHO - 4, "#9a5a8a"],
    [37, ANCHO - 3, "#b8803a"],
    [66, ANCHO - 4, "#b8803a"],
    [71, ANCHO - 5, "#9a5a8a"],
  ] as const)
    papa3d(e, [x, y, 2.5], 3, rampa(c));

  // Las dos guaguas que bailan en las esquinas de adelante.
  const guagua = (id: string, base: V3, ropa: string, sombrero: string, fase: number) => {
    e.parte(id, base, { mov: { gira: { amp: 0.08, periodo: 1300, fase }, vaiven: { dy: -1.5, periodo: 650, fase } } });
    muneco3d(e, base, 1, {
      piel: rampa("#c98a5a"),
      ropa: rampa(ropa),
      sombrero: rampa(sombrero),
      pelo: PELO,
      lleva: (ee, m) => mazorca3d(ee, m, suma(m, [1, 1, 8]), 2, rampa("#f2c22a")),
    });
  };
  guagua("guagua-1", [7, ANCHO - 4, 0], "#c8336e", "#2f8f6a", 0);
  guagua("guagua-2", [LARGO - 6, ANCHO - 14, 0], "#3a62b8", "#e8a317", 0.5);

  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
