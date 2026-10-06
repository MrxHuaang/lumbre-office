// La Luna en el lago: la luna llena como el rostro de una mujer dormida (pestañas largas, mejillas rosadas,
// la sonrisa en calma) que de vez en cuando abre un ojo, el pelo de olas azules con estrellas, las
// estrellas que giran a su alrededor, las olas del lago que corren, los peces de escamas de colores que
// saltan y la llavecita oxidada que cuelga y se mece.
import { en, hacia, liso, mirando, por, suma, Escultor, type V3 } from "./escultura";
import { BRILLO, LINEA, mejilla, ojo, parpado, sonrisa, ceja } from "./figuras";
import type { CarrozaArte } from "./partes";
import { ANCHO, ARCOIRIS, calco, camion, ciclo, conCara, marcoDe, ORO, soloCalco } from "./piezas";
import { zigzag } from "./plataforma";
import { circulo, rampa, tono } from "./pintura";

const LARGO = 104;
const LUNA = rampa("#d8d2ee");
const AZUL = rampa("#2a5ac8");
const TURQUESA = rampa("#1fb8c8");
const NOCHE = rampa("#2a2a6a");
const ROSA = rampa("#ef6ba0");
const OXIDO = rampa("#b8683a");
const ESPUMA = rampa("#eef6ff");

export function luna(): CarrozaArte {
  const e = new Escultor();
  camion(e, LARGO, { faldon: zigzag([AZUL, TURQUESA, NOCHE, LUNA]), cubierta: (u, v) => tono(Math.sin(u * 0.5 + v * 0.3) > 0.4 ? TURQUESA : AZUL, 3), flecos: [AZUL, TURQUESA, LUNA] });
  const M = mirando(1.0);
  const B: V3 = [LARGO * 0.5, ANCHO * 0.42, 0];
  const C = en(B, M, 0, 74, 0);
  const R = 34;
  const ojos = { dx: 12, dy: -2, w: 17, hu: 6.5, hl: 4.5 };
  const cara = calco(R, R, (p, cx, cy) => {
    // Los cráteres suaves.
    for (const [x, y, r] of [
      [-18, -20, 5],
      [20, -14, 4],
      [-22, 16, 3.5],
      [16, 22, 4],
    ] as const)
      p.plano(circulo(cx + x, cy + y, r), tono(LUNA, 2));
    for (const l of [-1, 1] as const) {
      parpado(p, cx + l * ojos.dx, cy + ojos.dy, ojos.w, ojos.hu, ojos.hl, l, LUNA, rampa("#b8a8e8"));
      ceja(p, cx + l * (ojos.dx + 0.5), cy - 12, 17, l, tono(NOCHE, 2), 1.6);
      mejilla(p, cx + l * 16, cy + 8, 5, 3, tono(ROSA, 3));
    }
    p.curva(cx - 6, cy + 15, cx, cy + 19, cx + 6, cy + 15, tono(rampa("#c8405a"), 2), 2);
  });
  const ojoAbierto = calco(R + 0.7, R + 0.7, (p, cx, cy) => {
    ojo(p, cx + ojos.dx, cy + ojos.dy, ojos.w, ojos.hu, ojos.hl, 1, { iris: rampa("#3a5ac8"), sombra: rampa("#b8a8e8"), mira: -1.5 });
  });

  // El pelo de olas (detrás) con estrellitas, y la luna.
  e.parte("luna", en(B, M, 0, 30, 0), { mov: { gira: { amp: 0.035, periodo: 5200 } } });
  for (let k = 0; k < 9; k++) {
    const a = -0.2 + (k / 8) * (Math.PI + 0.4);
    const r0 = R + 2;
    const p0 = en(C, M, Math.cos(a) * r0, Math.sin(a) * r0, -8);
    const p1 = en(C, M, Math.cos(a + 0.25) * (r0 + 12), Math.sin(a + 0.25) * (r0 + 12), -10);
    const p2 = en(C, M, Math.cos(a + 0.05) * (r0 + 22), Math.sin(a + 0.05) * (r0 + 22), -12);
    const col = k % 2 ? AZUL : TURQUESA;
    e.capsula(p0, p1, 7, 5, liso(col, 0, 0.7));
    e.capsula(p1, p2, 5, 2.5, liso(col, 0.3, 0.7));
    e.esfera(p2, 2.2, liso(ORO, 1, 0.95));
  }
  e.elipsoide(C, R, R, 26, M, conCara((q) => ({ r: LUNA, t: q.l[1] > 0.6 ? 0.4 : 0, brillo: 0.6 }), cara, 0.05));
  e.parte("ojo", en(B, M, 0, 30, 0), { padre: "luna", contorno: false, mov: { parpadeo: { cada: 5600, dura: 1100, fase: 0.4 } } });
  e.elipsoide(C, R + 0.7, R + 0.7, 26.7, M, soloCalco(ojoAbierto, 0.05));

  // Las estrellas que giran alrededor de la luna.
  e.parte("estrellas", C, { padre: "luna", mov: { rueda: { periodo: 18000 } } });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const s = en(C, M, Math.cos(a) * (R + 16), Math.sin(a) * (R + 16), 4);
    const m = hacia(M.fre);
    e.lamina(suma(s, por(m.der, -5), por(m.arr, -5)), m.der, m.arr, 10, 10, () => ({ r: ORO, t: 1, brillo: 0.9 }), (u, v) => {
      const dx = u - 5;
      const dy = v - 5;
      const ang = Math.atan2(dy, dx);
      return Math.hypot(dx, dy) < 2 + 3 * Math.pow(Math.abs(Math.cos(ang * 2.5)), 3);
    });
  }

  // La llavecita oxidada que cuelga de la barbilla y se mece.
  const colgante = en(C, M, 0, -R + 2, 16);
  e.parte("llave", colgante, { padre: "luna", mov: { gira: { amp: 0.28, periodo: 2300 } } });
  for (let k = 0; k < 4; k++) e.esfera(suma(colgante, [0, 0, -2 - k * 2.4]), 0.9, liso(ORO, 0.5, 0.95));
  const ll = suma(colgante, [0, 0, -12]);
  for (let a = 0; a < Math.PI * 2; a += 0.5) e.esfera(en(ll, M, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0), 1.2, liso(OXIDO, 0.3, 0.6));
  e.capsula(en(ll, M, 0, -3.5, 0), en(ll, M, 0, -14, 0), 1.2, 1.2, liso(OXIDO, 0, 0.6));
  e.caja(...(en(ll, M, 0, -14, 0) as [number, number, number]), 3, 1.5, 3, liso(OXIDO), liso(OXIDO, -0.4), liso(OXIDO, -0.8));

  // Los peces de escamas de colores que saltan (en arco, sobre su pivote en el agua).
  const pez = (id: string, agua: V3, fase: number, k: number) => {
    const m = mirando(0.3);
    const c = suma(agua, [0, 0, 18]);
    e.parte(id, agua, { mov: { gira: { amp: 0.55, periodo: 2600, fase } } });
    e.elipsoide(c, 4, 5, 10, m, (q) => {
      if (q.l[2] > 0.55 && q.l[1] > 0.15 && Math.abs(q.l[0]) > 0.5) return { c: q.l[1] > 0.45 ? BRILLO : LINEA };
      const fila = Math.floor((q.l[2] + 1) * 5);
      return { r: ciclo(ARCOIRIS, fila + k), t: Math.abs(Math.sin(q.u * 5 + fila)) < 0.3 ? -1 : 0.6, brillo: 1 };
    });
    e.lamina(en(c, m, 0, -4.5, -8), por(m.fre, -1), m.arr, 9, 9, (q) => ({ r: ciclo(ARCOIRIS, k + 2), t: q.u % 2 < 1 ? 0.5 : -0.5, brillo: 0.6 }), (u, v) => Math.abs(v - 4.5) < 1 + Math.abs(u) * 0.5);
  };
  pez("pez-1", [16, ANCHO - 5, 0], 0, 0);
  pez("pez-2", [LARGO - 16, ANCHO - 10, 0], 0.5, 3);

  // Las olas del lago adelante (dos filas que corren a destiempo).
  for (const [id, y, fase, col] of [
    ["ola-atras", ANCHO - 9, 0, AZUL],
    ["ola-adelante", ANCHO - 3, 0.5, TURQUESA],
  ] as const) {
    e.parte(id, [LARGO / 2, y, 0], { mov: { vaiven: { dx: 3, periodo: 2400, fase } } });
    for (let x = 4; x < LARGO - 4; x += 9) {
      e.capsula([x, y, 2], [x + 9, y, 2], 3, 3, liso(col, 0.2, 0.9), false);
      e.esfera([x + 4.5, y, 5 + Math.sin(x) * 0.8], 3.4, liso(col, 0.6, 0.9));
      e.esfera([x + 5.5, y + 0.6, 7.6], 1.6, liso(ESPUMA, 0.5, 0.6));
    }
  }
  void sonrisa;
  return { largo: LARGO, partes: e.render(), luces: [], marco: marcoDe(LARGO) };
}
